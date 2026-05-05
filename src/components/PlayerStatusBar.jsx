import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PROFESSIONS, HOUSING, getInventoryWeight, getMaxWeight, getMaxFatigue, MAX_HUNGER, getMaxHunger, getCityHungerBonus, getCityFatigueBonus, getFestinHungerDrain, getRegenInterval, getRegenCap, getVendeurRank, getContributeurRank, getPvpRank, getPassiveEnergyMaxBonus, getPassiveInventoryBonus, getBestPassiveCooldownSource, getPassiveCharbonDoubleProdBonus, getPassiveTravelDiscount, getActiveTaxDiscountItem, HUNGER_FOOD_ITEMS } from "../lib/gameData";
import { computeFatigueWithDailyReset, ITEMS, FOOD_ITEMS_WITH_FATIGUE } from "../lib/craftingData";
import HelpTooltip from "./HelpTooltip";
import { getTotalDebt } from "../lib/debtRepayment";
import PlayerLevelBadge from "./PlayerLevelBadge";
import { getPlayerLevelInfo, grantXP, XP_REWARDS } from "../lib/playerLevelSystem";
import { removeFromInventory } from "../lib/inventoryHelpers";
import { showXPToast } from "../lib/xpToasts";
import { isBiomeBuffActive, isBiomeHarvestActive, getBiomeBuffRemainingMs, getBiomeHarvestRemainingMs } from "../lib/playerBuffs";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

// ── Helper : formate une durée en mm ou h:mm
function formatDuration(ms) {
  if (ms <= 0) return "bientôt";
  const minLeft = Math.ceil(ms / 60000);
  const h = Math.floor(minLeft / 60);
  const m = minLeft % 60;
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, "0") + "m" : ""}` : `${minLeft}min`;
}

// ── Couleur unifiée pour les jauges selon le %
function gaugeColor(pct) {
  if (pct >= 60) return "bg-green-500";
  if (pct >= 30) return "bg-amber-400";
  return "bg-red-500";
}

// ── Composant : grande jauge claire avec countdown et boutons d'action ──
function BigGauge({ icon, label, value, max, regenLabel, dangerText, tooltip, actions }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = gaugeColor(pct);
  return (
    <div className="flex-1 min-w-[160px] bg-card border border-border rounded-lg px-3 py-2.5 flex flex-col">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        {tooltip && <HelpTooltip text={tooltip} side="bottom" />}
        <span className="ml-auto font-mono text-sm font-semibold tabular-nums">{value}/{max}</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1 text-[11px] font-body min-h-[14px]">
        {dangerText
          ? <span className="text-red-600 font-semibold">{dangerText}</span>
          : regenLabel
            ? <span className="text-muted-foreground">{regenLabel}</span>
            : <span />}
      </div>
      {/* Boutons d'action sous la jauge (consommation rapide) */}
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-border/50">
          {actions}
        </div>
      )}
    </div>
  );
}

export default function PlayerStatusBar({ profile, homeCity, city, onRefresh }) {
  const [now, setNow] = useState(Date.now());
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmConsume, setConfirmConsume] = useState(null); // { type: "hunger"|"fatigue", key, def }
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  if (!profile) return null;

  const prof = PROFESSIONS[profile.profession];
  const housing = HOUSING[profile.housing_level || "tente"];
  const homeCityBuildings = homeCity?.buildings || [];
  const cityFatigueBonus = getCityFatigueBonus(homeCityBuildings);
  const cityHungerBonus = getCityHungerBonus(homeCityBuildings);
  const grandePlaceBonus = homeCityBuildings.some(b => b.building_type === "grande_place") ? 20 : 0;
  const bibliothequeBonus = homeCityBuildings.some(b => b.building_type === "bibliotheque") ? 30 : 0;

  const maxFatigue = getMaxFatigue(profile, cityFatigueBonus);
  const { fatigue } = computeFatigueWithDailyReset(profile, maxFatigue);
  const maxHungerVal = getMaxHunger(profile, cityHungerBonus);
  const hunger = profile.hunger ?? MAX_HUNGER;
  const currentWeight = getInventoryWeight(profile);
  const maxWeight = getMaxWeight(profile) + grandePlaceBonus + bibliothequeBonus;

  // Plafond de la régen passive (5 par défaut, +1 par niveau d'Hospice).
  // Au-delà de ce plafond, la régen automatique s'arrête : il faut consommer ou dormir.
  const regenCap = getRegenCap(homeCityBuildings);
  const regenInterval = getRegenInterval(profile.housing_level || "tente", homeCityBuildings);

  // Countdown faim : ne s'affiche que si on est sous le plafond de régen passive
  let hungerRegenLabel = null;
  if (hunger < regenCap && regenInterval) {
    const lastRegen = profile.fatigue_regen_at ? new Date(profile.fatigue_regen_at).getTime() : Date.now();
    const msLeft = lastRegen + regenInterval - now;
    hungerRegenLabel = `+1 dans ${formatDuration(msLeft)}`;
  } else if (hunger >= regenCap && hunger < maxHungerVal) {
    hungerRegenLabel = `🔝 Plafond regen ${regenCap}/${maxHungerVal} : mangez pour aller plus haut`;
  }

  // Countdown énergie : idem, ne s'affiche que sous le plafond de régen
  let fatigueRegenLabel = null;
  if (fatigue < regenCap && regenInterval) {
    const lastRegen = profile.fatigue_regen_at ? new Date(profile.fatigue_regen_at).getTime() : Date.now();
    const msLeft = lastRegen + regenInterval - now;
    fatigueRegenLabel = `+1 dans ${formatDuration(msLeft)}`;
  } else if (fatigue >= regenCap && fatigue < maxFatigue) {
    fatigueRegenLabel = `🔝 Plafond regen ${regenCap}/${maxFatigue} : reposez-vous pour aller plus haut`;
  }

  // Or pending tax
  const pendingTax = profile.pending_market_tax || {};
  const totalPendingTax = Object.values(pendingTax).reduce((s, v) => s + v, 0);
  const debt = getTotalDebt(profile.debt_by_city);

  // ── Liste des buffs et passifs (rendue dans la zone détails) ──
  const buffs = [];
  const levelInfo = getPlayerLevelInfo(profile.player_xp_total || 0);
  const inv = profile.inventory || [];

  // Rang
  {
    const xpNeeded = levelInfo.isMaxLevel ? 0 : Math.max(0, (levelInfo.levelDuration ?? 0) - (levelInfo.currentLevelXP ?? 0));
    const hasBonus = (levelInfo.bonuses?.cooldownBonus || 0) > 0;
    buffs.push({
      icon: "⭐", label: `Rang ${levelInfo.level}`,
      detail: hasBonus ? `−${levelInfo.bonuses.cooldownBonus}% CD · +${levelInfo.bonuses.doubleProductionBonus}% dbl` : "pas de bonus",
      tooltip: hasBonus
        ? `Rang ${levelInfo.level} : −${levelInfo.bonuses.cooldownBonus}% cooldown · +${levelInfo.bonuses.doubleProductionBonus}% double prod.\n\n${levelInfo.isMaxLevel ? "Rang maximum atteint !" : `Encore ${xpNeeded} XP pour le rang ${levelInfo.level + 1}.`}`
        : `Rang 1 : pas encore de bonus.\nEncore ${xpNeeded} XP pour le rang 2.\n\nGagnez de l'XP en consommant potions, charbon, extrait, encre, parchemin et ressources rares.`,
      color: hasBonus ? "text-purple-700 bg-purple-50 border-purple-200" : "text-muted-foreground bg-muted/40 border-border",
    });
  }

  // Buff biome
  if (isBiomeBuffActive(profile)) {
    const t = formatDuration(getBiomeBuffRemainingMs(profile));
    buffs.push({
      icon: "🌿", label: "Biome", detail: `−10% CD · 10% dbl prod (${t})`,
      tooltip: `Bénédiction biome active encore ${t}. −10% cooldown + 10% chance double production.`,
      color: "text-green-700 bg-green-50 border-green-200",
    });
  }
  if (isBiomeHarvestActive(profile)) {
    const t = formatDuration(getBiomeHarvestRemainingMs(profile));
    buffs.push({
      icon: "🌾", label: "+1 récolte T1", detail: `(${t})`,
      tooltip: `La prochaine production T1 donne +1 ressource bonus. Expire dans ${t}.`,
      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    });
  }
  if (profile.cooldown_bonus_expires_at && new Date(profile.cooldown_bonus_expires_at) > new Date(now)) {
    const t = formatDuration(new Date(profile.cooldown_bonus_expires_at).getTime() - now);
    buffs.push({
      icon: "🪵", label: `−${Math.round((profile.cooldown_bonus_value || 0.1) * 100)}% CD`, detail: `(${t})`,
      tooltip: `Bois brut consommé : −${Math.round((profile.cooldown_bonus_value || 0.1) * 100)}% sur toutes les productions. Expire dans ${t}.`,
      color: "text-amber-700 bg-amber-50 border-amber-200",
    });
  }
  if (profile.double_prod_bonus > 0 && profile.double_prod_bonus_expires_at && new Date(profile.double_prod_bonus_expires_at) > new Date(now)) {
    const t = formatDuration(new Date(profile.double_prod_bonus_expires_at).getTime() - now);
    buffs.push({
      icon: "⚫", label: `+${Math.round((profile.double_prod_bonus || 0) * 100)}% dbl prod`, detail: `(${t})`,
      tooltip: `Charbon consommé : +${Math.round((profile.double_prod_bonus || 0) * 100)}% chance de doubler la récolte. Expire dans ${t}.`,
      color: "text-gray-700 bg-gray-100 border-gray-300",
    });
  }
  if (profile.energy_max_bonus_expires_at && new Date(profile.energy_max_bonus_expires_at) > new Date(now)) {
    const t = formatDuration(new Date(profile.energy_max_bonus_expires_at).getTime() - now);
    buffs.push({
      icon: "🪨", label: `+${profile.energy_max_bonus_value || 2} énergie max`, detail: `(${t})`,
      tooltip: `Minerai consommé : énergie max +${profile.energy_max_bonus_value || 2} pendant ${t}.`,
      color: "text-blue-700 bg-blue-50 border-blue-200",
    });
  }
  if (profile.travel_discount > 0) {
    buffs.push({
      icon: "🗺️", label: `−${Math.round((profile.travel_discount || 0) * 100)}% voyage`, detail: "",
      tooltip: `Réduction voyage : −${Math.round((profile.travel_discount || 0) * 100)}% sur le prochain voyage. Consommée à l'arrivée.`,
      color: "text-indigo-700 bg-indigo-50 border-indigo-200",
    });
  }
  if (profile.energy_regen_bonus_expires_at && new Date(profile.energy_regen_bonus_expires_at) > new Date(now)) {
    const t = formatDuration(new Date(profile.energy_regen_bonus_expires_at).getTime() - now);
    buffs.push({
      icon: "🧪", label: `+${profile.energy_regen_value || 1}⚡/${profile.energy_regen_interval_min || 5}min`, detail: `(${t})`,
      tooltip: `Régénération d'énergie active pendant ${t}.`,
      color: "text-teal-700 bg-teal-50 border-teal-200",
    });
  }
  if (profile.hunger_regen_bonus_expires_at && new Date(profile.hunger_regen_bonus_expires_at) > new Date(now)) {
    const t = formatDuration(new Date(profile.hunger_regen_bonus_expires_at).getTime() - now);
    buffs.push({
      icon: "🍞", label: `+${profile.hunger_regen_value || 1}🍞/${profile.hunger_regen_interval_min || 10}min`, detail: `(${t})`,
      tooltip: `Régénération de faim active pendant ${t}.`,
      color: "text-orange-700 bg-orange-50 border-orange-200",
    });
  }

  // Passifs inventaire
  const cdSource = getBestPassiveCooldownSource(profile);
  if (cdSource) {
    buffs.push({
      icon: cdSource.icon,
      label: `−${Math.round(cdSource.value * 100)}% CD`,
      detail: "passif",
      tooltip: `${cdSource.name} en inventaire : −${Math.round(cdSource.value * 100)}% cooldown de production.`,
      color: "text-amber-700 bg-amber-50 border-amber-200",
    });
  }
  const passiveEnergyBonus = getPassiveEnergyMaxBonus(profile);
  if (passiveEnergyBonus > 0) {
    const src = inv.some(i => i.item_key === "lingots_fer" && (i.quantity || 0) > 0) ? "Lingots de fer" : "Pierre taillée";
    buffs.push({ icon: "🗿", label: `+${passiveEnergyBonus} énergie max`, detail: "passif", tooltip: `${src} en inventaire : +${passiveEnergyBonus} énergie maximum.`, color: "text-blue-700 bg-blue-50 border-blue-200" });
  }
  const passiveInvBonus = getPassiveInventoryBonus(profile);
  if (passiveInvBonus > 0) {
    const src = inv.some(i => i.item_key === "tissu" && (i.quantity || 0) > 0) ? "Tissu" : "Fil";
    buffs.push({ icon: "🧶", label: `+${passiveInvBonus} inventaire`, detail: "passif", tooltip: `${src} en inventaire : +${passiveInvBonus} capacité.`, color: "text-purple-700 bg-purple-50 border-purple-200" });
  }
  const passiveCharbonBonus = getPassiveCharbonDoubleProdBonus(profile);
  if (passiveCharbonBonus > 0) {
    buffs.push({
      icon: "⚫",
      label: `+${Math.round(passiveCharbonBonus * 100)}% dbl prod`,
      detail: "passif",
      tooltip: `Charbon en inventaire : +${Math.round(passiveCharbonBonus * 100)}% chance de doubler vos productions et récoltes. S'ajoute aux bonus biome et niveau.`,
      color: "text-stone-700 bg-stone-100 border-stone-300",
    });
  }
  const passiveTravelDiscount = getPassiveTravelDiscount(profile);
  if (passiveTravelDiscount > 0) {
    buffs.push({
      icon: "🎒",
      label: `−${Math.round(passiveTravelDiscount * 100)}% voyage`,
      detail: "passif",
      tooltip: `Sac de voyage (besace) en inventaire : −${Math.round(passiveTravelDiscount * 100)}% sur la durée de tous vos voyages. Effet permanent tant que la besace reste dans votre sac.`,
      color: "text-indigo-700 bg-indigo-50 border-indigo-200",
    });
  }
  // Réduction taxe marché : on délègue à getActiveTaxDiscountItem qui dérive
  // automatiquement la liste depuis ITEMS (pas de duplication, pas de risque
  // de désynchro avec craftingData).
  const bestTax = getActiveTaxDiscountItem(profile);
  if (bestTax) {
    const pct = Math.round(bestTax.value * 100);
    buffs.push({ icon: "🔮", label: `−${pct}% taxe`, detail: "passif", tooltip: `${bestTax.name} en inventaire : −${pct}% taxe marché.`, color: "text-yellow-700 bg-yellow-50 border-yellow-200" });
  }
  const bourseInInv = inv.find(i => i.item_key === "bourse_protection" && (i.quantity || 0) > 0);
  if (bourseInInv) {
    const qty = bourseInInv.quantity || 1;
    const usesLeft = profile.bourse_uses_left ?? 5;
    buffs.push({
      icon: "👜",
      label: "Bourse active",
      detail: qty > 1 ? `×${qty} (${usesLeft}/5)` : `${usesLeft}/5`,
      tooltip: `Bourse de protection : plafonne le vol PvP subi à 10💰 par attaque. Encaisse exactement 5 attaques avant de se briser (compteur déterministe). Il vous reste ${usesLeft}/5 utilisation${usesLeft > 1 ? "s" : ""} sur la bourse en cours.`,
      color: "text-yellow-700 bg-yellow-50 border-yellow-200",
    });
  }

  // Sceau royal (couverture fiscale active)
  if ((profile.sceau_balance || 0) > 0) {
    buffs.push({
      icon: "🏵️",
      label: `Sceau royal`,
      detail: `${profile.sceau_balance}💰 restants`,
      tooltip: `Sceau royal actif : couverture fiscale automatique, ${profile.sceau_balance}💰 restants.`,
      color: "text-amber-700 bg-amber-50 border-amber-300",
    });
  }

  // Meuble installé (entretien logement réduit)
  if (profile.meuble_expires_at && profile.meuble_expires_at >= new Date().toISOString().split("T")[0]) {
    const daysLeft = Math.ceil((new Date(profile.meuble_expires_at).getTime() - now) / 86400000);
    buffs.push({
      icon: "🪑",
      label: `−${Math.round((profile.meuble_discount || 0.5) * 100)}% loyer`,
      detail: `${daysLeft}j`,
      tooltip: `Meuble installé : −${Math.round((profile.meuble_discount || 0.5) * 100)}% sur l'entretien du logement, expire dans ${daysLeft} jour(s).`,
      color: "text-orange-700 bg-orange-50 border-orange-200",
    });
  }

  // Contrat artisan actif (parchemin)
  if (profile.active_parchemin_type) {
    buffs.push({
      icon: "📋",
      label: `Contrat actif`,
      detail: profile.active_parchemin_type,
      tooltip: `Contrat artisan actif : type "${profile.active_parchemin_type}". Termine la quête associée pour le bonus.`,
      color: "text-indigo-700 bg-indigo-50 border-indigo-200",
    });
  }

  // Bonus encre en attente (prochain craft T2 donne T1)
  if (profile.pending_t2_to_t1_bonus) {
    buffs.push({
      icon: "🖋️",
      label: `Bonus encre`,
      detail: `prochain T2 → +1 T1`,
      tooltip: `Encre consommée : votre prochain craft T2 donnera 1 ressource T1 bonus.`,
      color: "text-blue-700 bg-blue-50 border-blue-200",
    });
  }

  // ── Buffs du chaudron magique (Sprint 4) ──

  // 💨 Plume de vent : prochain voyage gratuit
  if (profile.next_travel_free) {
    buffs.push({
      icon: "💨",
      label: "Plume de vent",
      detail: "voyage gratuit",
      tooltip: "Plume de vent active : votre prochain voyage est entièrement gratuit (frais de route et péage à 0).",
      color: "text-cyan-700 bg-cyan-50 border-cyan-200",
    });
  }

  // 🔥 Pierre de feu : -30% durée crafts pendant 4h
  if (profile.craft_speed_buff_until && new Date(profile.craft_speed_buff_until) > new Date(now)) {
    const t = formatDuration(new Date(profile.craft_speed_buff_until).getTime() - now);
    const pct = Math.round((profile.craft_speed_buff_value || 0.30) * 100);
    buffs.push({
      icon: "🔥",
      label: "Pierre de feu",
      detail: `−${pct}% CD (${t})`,
      tooltip: `Pierre de feu active encore ${t}. Réduit la durée de tous vos crafts de ${pct}%.`,
      color: "text-red-700 bg-red-50 border-red-200",
    });
  }

  // 🍀 Trèfle de chance : +5% drop sur la prochaine épopée
  if (profile.next_epopee_drop_bonus && profile.next_epopee_drop_bonus > 0) {
    const pct = Math.round(profile.next_epopee_drop_bonus * 100);
    buffs.push({
      icon: "🍀",
      label: "Trèfle de chance",
      detail: `+${pct}% drop épopée`,
      tooltip: `Trèfle de chance actif : votre prochaine épopée aura +${pct}% de chance de drop.`,
      color: "text-green-700 bg-green-50 border-green-200",
    });
  }

  // 💰 Pièce porte-bonheur : +20% or sur la prochaine épopée
  if (profile.next_epopee_gold_bonus && profile.next_epopee_gold_bonus > 0) {
    const pct = Math.round(profile.next_epopee_gold_bonus * 100);
    buffs.push({
      icon: "💰",
      label: "Pièce porte-bonheur",
      detail: `+${pct}% or épopée`,
      tooltip: `Pièce porte-bonheur active : votre prochaine épopée rapportera ${pct}% d'or en plus.`,
      color: "text-amber-700 bg-amber-50 border-amber-200",
    });
  }

  // 👁️ Œil d'archer : prochain T4 sans outil
  if (profile.next_t4_no_tool) {
    buffs.push({
      icon: "👁️",
      label: "Œil d'archer",
      detail: "prochain T4 sans outil",
      tooltip: "Œil d'archer actif : votre prochain craft T4 ne consommera pas de charge d'outil.",
      color: "text-indigo-700 bg-indigo-50 border-indigo-200",
    });
  }

  // Rangs prestige
  const vRank = getVendeurRank(profile.cumul_ventes_or || 0);
  const cRank = getContributeurRank(profile.cumul_contributions_warehouse || 0);
  const pRank = getPvpRank(profile.cumul_t5_envoyes || 0);
  const vCumul = profile.cumul_ventes_or || 0;
  const cCumul = profile.cumul_contributions_warehouse || 0;
  const pCumul = profile.cumul_t5_envoyes || 0;

  // Légende globale (un seul tooltip)
  const legendText =
    "Statut du joueur — légende\n\n" +
    "🍞 Faim · ⚡ Énergie · 📦 Inventaire — chaque action en consomme aléatoirement.\n" +
    "Vert ≥ 60% · Orange 30–60% · Rouge < 30%\n\n" +
    "✨ Effets actifs — tous les bonus en cours (buffs temporaires + passifs d'inventaire).\n" +
    "Cliquez sur un badge pour voir le détail et le temps restant.\n\n" +
    "💰 Or — taxes en attente apparaissent en rouge à côté.\n" +
    "🏠 Logement — détermine la régénération d'énergie.\n" +
    "🔧 Outils — sans charge, cooldown × 2.\n\n" +
    "Cliquez sur 'Rangs' pour voir votre niveau et vos rangs cumulés.";

  // ─── Handler : manger pour la faim ───
  const handleEatForHunger = async (itemKey) => {
    if (!onRefresh) return;
    const hungerDef = HUNGER_FOOD_ITEMS[itemKey];
    if (!hungerDef) return;
    if (hunger >= maxHungerVal) { toast("🍽️ Vous n'avez pas faim !"); return; }

    const invItem = inv.find(i => i.item_key === itemKey || i.item_name === hungerDef.label);
    if (!invItem || invItem.quantity <= 0) { toast.error("Vous n'avez plus cet aliment !"); return; }

    setBusy(true);
    try {
      const newInventory = removeFromInventory(inv, itemKey, 1);
      const newHunger = Math.min(maxHungerVal, hunger + hungerDef.hunger_restore);
      const upd = { inventory: newInventory, hunger: newHunger };
      const msgs = [`+${hungerDef.hunger_restore}🍽️`];

      // Festin empoisonné drain
      const festinDrain = getFestinHungerDrain(city);
      if (festinDrain > 0) {
        upd.fatigue = Math.max(0, fatigue - festinDrain);
        msgs.push(`☠️ −${festinDrain}⚡ (festin empoisonné)`);
      }
      // Bonus énergie de certains aliments
      const fatBonus = ITEMS[itemKey]?.fatigue_restore || 0;
      if (fatBonus > 0) {
        upd.fatigue = Math.min(maxFatigue, (upd.fatigue ?? fatigue) + fatBonus);
        msgs.push(`+${fatBonus}⚡`);
      }
      // ── Gain XP : +1 XP si on mange du blé ──
      let xpGain = null;
      if (itemKey === "ble") {
        xpGain = grantXP(profile, XP_REWARDS.CONSUME_BLE);
        Object.assign(upd, xpGain.updates);
      }
      await base44.entities.PlayerProfile.update(profile.id, upd);
      toast.success(`${hungerDef.icon} ${msgs.join(' · ')} !`);
      if (xpGain) {
        showXPToast(XP_REWARDS.CONSUME_BLE, xpGain, { icon: "🌾", context: "alimentation" });
      }
      onRefresh();
    } catch (e) {
      toast.error("Erreur lors de la consommation.");
    } finally {
      setBusy(false);
    }
  };

  // ─── Handler : consommer pour l'énergie ───
  const handleConsumeFood = async (foodKey) => {
    if (!onRefresh) return;
    const food = FOOD_ITEMS_WITH_FATIGUE.find(f => f.key === foodKey);
    if (!food) return;
    if (fatigue >= maxFatigue) { toast("⚡ Vous êtes au max d'énergie !"); return; }

    const invItem = inv.find(i => i.item_key === foodKey || i.item_name === food.name);
    if (!invItem || invItem.quantity <= 0) { toast.error("Vous n'avez plus cet item !"); return; }

    setBusy(true);
    try {
      const newInventory = removeFromInventory(inv, foodKey, 1);
      const newFatigue = Math.min(maxFatigue, fatigue + food.fatigue_restore);
      const upd = { inventory: newInventory, fatigue: newFatigue };
      const msgs = [`+${food.fatigue_restore}⚡`];

      // ── Gain XP : +1 XP si on consomme des herbes ──
      let xpGain = null;
      if (foodKey === "herbes") {
        xpGain = grantXP(profile, XP_REWARDS.CONSUME_HERBES);
        Object.assign(upd, xpGain.updates);
      }
      await base44.entities.PlayerProfile.update(profile.id, upd);
      toast.success(`${food.icon} ${msgs.join(' · ')} !`);
      if (xpGain) {
        showXPToast(XP_REWARDS.CONSUME_HERBES, xpGain, { icon: "🌿", context: "récupération" });
      }
      onRefresh();
    } catch (e) {
      toast.error("Erreur lors de la consommation.");
    } finally {
      setBusy(false);
    }
  };

  // ─── Construction des boutons d'action sous chaque jauge ───
  // Boutons "Manger" (faim) — uniquement si onRefresh fourni et qu'il y a quelque chose à manger
  const hungerActions = [];
  if (onRefresh && hunger < maxHungerVal) {
    for (const [key, def] of Object.entries(HUNGER_FOOD_ITEMS)) {
      const invEntry = inv.find(i => i.item_key === key || i.item_name === def.label);
      const qty = invEntry?.quantity || 0;
      if (qty <= 0) continue;
      hungerActions.push(
        <button
          key={key}
          onClick={() => setConfirmConsume({ type: "hunger", key, def: { name: def.label, icon: def.icon, restore: def.hunger_restore, restoreLabel: "🍽️ faim" } })}
          disabled={busy}
          className="flex items-center gap-1 text-[11px] bg-orange-100 hover:bg-orange-200 border border-orange-300 text-orange-800 px-1.5 py-0.5 rounded font-body transition-colors disabled:opacity-50"
          title={`${def.label} : +${def.hunger_restore}🍽️ (${qty} en stock)`}
        >
          <span>{def.icon}</span>
          <span className="font-semibold">+{def.hunger_restore}</span>
          <span className="opacity-70">×{qty}</span>
        </button>
      );
    }
  }

  // Boutons "Consommer" (énergie)
  const fatigueActions = [];
  if (onRefresh && fatigue < maxFatigue) {
    for (const food of FOOD_ITEMS_WITH_FATIGUE) {
      // Skip les items qui sont aussi nourriture-faim (pour éviter doublon avec hungerActions)
      if (ITEMS[food.key]?.hunger_restore) continue;
      const invEntry = inv.find(i => i.item_key === food.key || i.item_name === food.name);
      const qty = invEntry?.quantity || 0;
      if (qty <= 0) continue;
      fatigueActions.push(
        <button
          key={food.key}
          onClick={() => setConfirmConsume({ type: "fatigue", key: food.key, def: { name: food.name, icon: food.icon, restore: food.fatigue_restore, restoreLabel: "⚡ énergie" } })}
          disabled={busy}
          className="flex items-center gap-1 text-[11px] bg-green-100 hover:bg-green-200 border border-green-300 text-green-800 px-1.5 py-0.5 rounded font-body transition-colors disabled:opacity-50"
          title={`${food.name} : +${food.fatigue_restore}⚡ (${qty} en stock)`}
        >
          <span>{food.icon}</span>
          <span className="font-semibold">+{food.fatigue_restore}</span>
          <span className="opacity-70">×{qty}</span>
        </button>
      );
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-3 font-body">
      {/* ── LIGNE 1 : Identité & ressources principales ── */}
      <div className="flex items-center gap-3 flex-wrap text-sm">
        {/* Métier + nom */}
        <div className="flex items-center gap-2">
          <span className="text-xl">{prof?.icon}</span>
          <span className="font-heading font-semibold text-foreground">{profile.character_name}</span>
        </div>

        {/* Or */}
        <div className="flex items-center gap-1.5">
          <span>💰</span>
          <span className="font-semibold text-accent tabular-nums">{profile.gold || 0}</span>
        </div>

        {/* Pending tax */}
        {totalPendingTax > 0 && (
          <HelpTooltip
            text={`Taxes de marché accumulées aujourd'hui, déduites de votre or au reset (6h). Si vous n'avez pas assez d'or, la différence sera mise en dette.\n\nDétail par ville :\n${Object.entries(pendingTax).filter(([, v]) => v > 0).map(([, v]) => `  · ${v}💰`).join("\n")}`}
            side="bottom"
          >
            <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 cursor-help">
              −{totalPendingTax}💰 taxes
            </span>
          </HelpTooltip>
        )}

        {/* Dette */}
        {debt > 0 && (
          <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
            ⚠️ Dette : {debt}💰
          </span>
        )}

        {/* Logement */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span>{housing.icon}</span>
          <span className="text-xs">{housing.name}</span>
        </div>

        {/* Outils */}
        <div className={`flex items-center gap-1 text-xs ${(profile.tool_charges || 0) === 0 ? "text-orange-500 font-semibold" : "text-muted-foreground"}`}>
          <span>🔧</span>
          <span className="tabular-nums">{profile.tool_charges || 0}</span>
          {(profile.tool_charges || 0) === 0 && <span>×2 CD</span>}
        </div>

        {/* Voyage */}
        {profile.is_traveling && (
          <div className="flex items-center gap-1.5 text-accent animate-pulse text-xs">
            <span>🐴</span>
            <span>En voyage…</span>
          </div>
        )}

        {/* Légende globale + bouton "Rangs" à droite */}
        <div className="ml-auto flex items-center gap-2">
          <HelpTooltip text={legendText} side="bottom" />
          <button
            onClick={() => setDetailsOpen(o => !o)}
            className="text-xs font-heading text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 px-2 py-0.5 rounded hover:bg-muted"
          >
            <span>{detailsOpen ? "▾" : "▸"}</span>
            <span>{detailsOpen ? "Masquer" : "Rangs"}</span>
          </button>
        </div>
      </div>

      {/* ── LIGNE 2 : 3 jauges + Effets actifs ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        <BigGauge
          icon="🍞"
          label="Faim"
          value={hunger}
          max={maxHungerVal}
          regenLabel={hungerRegenLabel}
          dangerText={hunger <= 0 ? "Affamé !" : null}
          tooltip="Faim. Chaque action consomme 1 point aléatoire (faim ou énergie). Si une jauge est à 0, l'autre est utilisée. Régen +1/h jusqu'à 5. Restaurer : blé +1, farine +5, pain +5, ragoût +10."
          actions={hungerActions}
        />
        <BigGauge
          icon="⚡"
          label="Énergie"
          value={fatigue}
          max={maxFatigue}
          regenLabel={fatigueRegenLabel}
          dangerText={fatigue <= 0 ? "Épuisé !" : null}
          tooltip="Énergie. Chaque action consomme 1 point aléatoire. Régen automatique selon logement, plafonnée à 5. Restaurer : herbes +1, extrait +5, potion +10, taverne (+50%)."
          actions={fatigueActions}
        />
        <BigGauge
          icon="📦"
          label="Inventaire"
          value={currentWeight}
          max={maxWeight}
          regenLabel={null}
          dangerText={currentWeight >= maxWeight ? "PLEIN !" : null}
          tooltip="Capacité d'inventaire. Augmente avec logement, Grande Place et Bibliothèque. La Forme basse réduit la capacité (−10% par point manquant)."
        />

        {/* Colonne "Effets actifs" — toujours visible */}
        <div className="bg-card border border-border rounded-lg px-3 py-2.5 min-h-[88px]">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xl">✨</span>
            <span className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide">Effets actifs</span>
            <HelpTooltip
              text={"Tous les bonus en cours sur votre personnage.\n\n• Buffs temporaires (avec compte à rebours)\n• Passifs d'inventaire (tant que l'item est en sac)\n• Équipements (tant que durabilité > 0)\n\nCliquez sur un badge pour voir le détail."}
              side="bottom"
            />
            {buffs.length > 0 && (
              <span className="ml-auto text-[10px] font-bold text-purple-700 bg-purple-100 border border-purple-200 rounded-full px-1.5">
                {buffs.length}
              </span>
            )}
          </div>
          {buffs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic font-body">Aucun effet en cours.</p>
          ) : (
            <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto pr-1">
              {buffs.map((b, i) => (
                <Popover key={i}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`flex items-center gap-1 text-[11px] font-semibold border rounded px-1.5 py-0.5 cursor-help transition-opacity hover:opacity-80 ${b.color}`}
                    >
                      <span>{b.icon}</span>
                      <span>{b.label}</span>
                      {b.detail && <span className="font-normal opacity-75 text-[10px]">{b.detail}</span>}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" className="max-w-xs text-xs font-body leading-relaxed p-3 whitespace-pre-line">
                    {b.tooltip}
                  </PopoverContent>
                </Popover>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── LIGNE 3 : Rangs et niveau (collapsible) ── */}
      {detailsOpen && (
        <div className="border-t border-border pt-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <PlayerLevelBadge profile={profile} variant="compact" />

            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {vRank.icon} <strong className="text-foreground">{vRank.label}</strong>
              <HelpTooltip
                text={`🛒 Rang vendeur\n\nVentes cumulées : ${vCumul}💰${vRank.next ? `\nProchain rang "${vRank.next}" : ${vRank.nextAt}💰 (+${vRank.nextAt - vCumul}💰)` : "\n🏆 Rang maximum atteint !"}`}
                side="bottom"
              />
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {cRank.icon} <strong className="text-foreground">{cRank.label}</strong>
              <HelpTooltip
                text={`📦 Rang contributeur entrepôt\n\nContributions cumulées : ${cCumul} ressources${cRank.next ? `\nProchain rang "${cRank.next}" : ${cRank.nextAt} (+${cRank.nextAt - cCumul})` : "\n👑 Rang maximum atteint !"}`}
                side="bottom"
              />
            </span>
            {pCumul > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                {pRank.icon} <strong className="text-foreground">{pRank.label}</strong>
                <HelpTooltip
                  text={`⚔️ Rang militaire\n\nAttaques T5 lancées : ${pCumul}${pRank.next ? `\nProchain rang "${pRank.next}" : ${pRank.nextAt} attaques (+${pRank.nextAt - pCumul})` : "\n⚔️ Rang maximum atteint !"}`}
                  side="bottom"
                />
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Modal de confirmation ── */}
      {confirmConsume && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !busy && setConfirmConsume(null)}>
          <div className="bg-card border border-border rounded-lg p-4 max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{confirmConsume.def.icon}</span>
              <h3 className="font-heading font-semibold text-base">Confirmer ?</h3>
            </div>
            <p className="text-sm font-body">
              Voulez-vous {confirmConsume.type === "hunger" ? "manger" : "consommer"} <strong>{confirmConsume.def.name}</strong> ?
              <br />
              <span className="text-xs text-muted-foreground">+{confirmConsume.def.restore} {confirmConsume.def.restoreLabel}</span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmConsume(null)}
                disabled={busy}
                className="text-xs font-heading px-3 py-1.5 rounded border border-border hover:bg-muted disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  const c = confirmConsume;
                  setConfirmConsume(null);
                  if (c.type === "hunger") await handleEatForHunger(c.key);
                  else if (c.type === "fatigue") await handleConsumeFood(c.key);
                }}
                disabled={busy}
                className="text-xs font-heading px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
