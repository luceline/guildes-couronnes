import { useState, useEffect } from "react";
import { PROFESSIONS, HOUSING, getInventoryWeight, getMaxWeight, getMaxFatigue, MAX_HUNGER, MAX_SATIETY, MAX_VITALITY, getFatigueRegenInterval, getVendeurRank, getContributeurRank, getPvpRank, getPassiveCooldownBonus, getPassiveEnergyMaxBonus, getPassiveInventoryBonus, getAttackScore, getDefenseScore } from "../lib/gameData";
import { computeFatigueWithDailyReset, ITEMS } from "../lib/craftingData";
import HelpTooltip from "./HelpTooltip";
import { getTotalDebt } from "../lib/debtRepayment";
import PlayerLevelBadge from "./PlayerLevelBadge";
import { getPlayerLevelInfo, getPlayerLevelBonuses } from "../lib/playerLevelSystem";

export default function PlayerStatusBar({ profile, homeCity }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  if (!profile) return null;

  const prof = PROFESSIONS[profile.profession];
  const housing = HOUSING[profile.housing_level || "tente"];
  const homeCityBuildings = homeCity?.buildings || [];
  const cathedraleFatigueBonus = homeCityBuildings.some(b => b.building_type === "cathedrale") ? 10 : 0;
  const grandePlaceBonus      = homeCityBuildings.some(b => b.building_type === "grande_place") ? 20 : 0;
  const bibliothequeBonus     = homeCityBuildings.some(b => b.building_type === "bibliotheque") ? 30 : 0;
  const maxFatigue = getMaxFatigue(profile, cathedraleFatigueBonus);
  const { fatigue } = computeFatigueWithDailyReset(profile, maxFatigue);
  const fatiguePct = Math.max(0, Math.min(100, (fatigue / maxFatigue) * 100));
  const fatigueColor = fatiguePct > 60 ? "bg-green-500" : fatiguePct > 30 ? "bg-yellow-500" : "bg-red-500";

  const currentWeight = getInventoryWeight(profile);
  const maxWeight = getMaxWeight(profile) + grandePlaceBonus + bibliothequeBonus;
  const weightPct = Math.min(100, (currentWeight / maxWeight) * 100);
  const weightFull = currentWeight >= maxWeight;
  const weightColor = weightFull ? "bg-red-500" : weightPct >= 80 ? "bg-orange-400" : "bg-blue-400";

  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-4 text-sm font-body">
      {/* Nom + métier */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{prof?.icon}</span>
        <span className="font-semibold text-foreground">{profile.character_name}</span>
      </div>

      {/* Or */}
      <div className="flex items-center gap-1.5">
        <span>💰</span>
        <span className="font-semibold text-accent">{profile.gold || 0} or</span>
        {(() => {
          const pendingTax = profile.pending_market_tax || {};
          const total = Object.values(pendingTax).reduce((s, v) => s + v, 0);
          if (total <= 0) return null;
          return (
            <HelpTooltip
              text={`Taxes de marché accumulées aujourd'hui, déduites de votre or au reset (6h). Si vous n'avez pas assez d'or, la différence sera mise en dette.\n\nDétail par ville :\n${Object.entries(pendingTax).filter(([,v]) => v > 0).map(([,v]) => `  · ${v}💰`).join("\n")}`}
              side="bottom"
            >
              <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 cursor-help">
                −{total}💰 taxes
              </span>
            </HelpTooltip>
          );
        })()}
        {getTotalDebt(profile.debt_by_city) > 0 && (
          <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
            ⚠️ Dette : {getTotalDebt(profile.debt_by_city)} 💰
          </span>
        )}
      </div>

      {/* Logement */}
      <div className="flex items-center gap-1.5">
        <span>{housing.icon}</span>
        <span className="text-muted-foreground">{housing.name}</span>
      </div>

      {/* Faim */}
      {(() => {
        const hunger = profile.hunger ?? MAX_HUNGER;
        const maxH = 10 + (profile.hunger_max_bonus || 0);
        const hungerColor = hunger <= 0 ? "text-red-600" : hunger <= 3 ? "text-orange-500" : "text-green-600";
        const hungerPct = Math.max(0, Math.min(100, (hunger / maxH) * 100));
        const hungerBarColor = hunger <= 0 ? "bg-red-500" : hunger <= 3 ? "bg-orange-400" : "bg-green-500";
        // Countdown vers prochain +1 faim
        let regenLabel = null;
        if (hunger < maxH) {
          const lastRegen = profile.hunger_regen_at
            ? new Date(profile.hunger_regen_at).getTime()
            : Date.now();
          const nextRegen = lastRegen + 3600000;
          const msLeft = nextRegen - now;
          if (msLeft > 0) {
            const minLeft = Math.ceil(msLeft / 60000);
            const h = Math.floor(minLeft / 60);
            const m = minLeft % 60;
            regenLabel = h > 0
              ? `+1🍞 ${h}h${m > 0 ? String(m).padStart(2,"0") + "m" : ""}`
              : `+1🍞 ${minLeft}min`;
          } else {
            regenLabel = "+1🍞 bientôt";
          }
        }
        return (
          <div className="flex items-center gap-2 min-w-[120px]">
            <span title="Faim">🍞</span>
            <HelpTooltip text="La faim se dépense à chaque action. En dessous de 3 : +1 énergie par action. À 0 : impossible de travailler. Se remonte avec blé, farine, pain ou ragoût." side="bottom" />
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[50px]">
              <div className={`h-full rounded-full transition-all duration-500 ${hungerBarColor}`}
                style={{ width: `${hungerPct}%` }} />
            </div>
            <span className={`text-xs whitespace-nowrap ${hungerColor}`}>{hunger}/{maxH}</span>
            {hunger <= 0 && <span className="text-xs font-semibold text-red-600">Affamé!</span>}
            {regenLabel && hunger < maxH && <span className="text-xs text-muted-foreground whitespace-nowrap">{regenLabel}</span>}
          </div>
        );
      })()}

      {/* Appétit */}
      {(() => {
        const satiety = profile.satiety ?? MAX_SATIETY;
        const satietyPct = Math.max(0, Math.min(100, (satiety / MAX_SATIETY) * 100));
        const satietyColor = satiety <= 0 ? "bg-red-500" : satiety <= 3 ? "bg-orange-400" : "bg-amber-500";
        const satietyTextColor = satiety <= 0 ? "text-red-600" : satiety <= 3 ? "text-orange-500" : "text-amber-600";
        const malus = MAX_SATIETY - satiety;
        return (
          <div className="flex items-center gap-2 min-w-[120px]">
            <span title="Appétit">🍽️</span>
            <HelpTooltip text="L'appétit représente votre état nutritionnel. Perte de 0-2 pts/jour. Chaque point manquant ajoute +10% cooldown de production. Se remonte avec blé, farine, pain, ragoût." side="bottom" />
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[50px]">
              <div className={`h-full rounded-full transition-all duration-500 ${satietyColor}`}
                style={{ width: `${satietyPct}%` }} />
            </div>
            <span className={`text-xs whitespace-nowrap ${satietyTextColor}`}>{satiety}/{MAX_SATIETY}</span>
            {malus > 0 && <span className="text-xs text-orange-500 font-semibold">+{malus * 10}% CD</span>}
          </div>
        );
      })()}

      {/* Forme */}
      {(() => {
        const vitality = profile.vitality ?? MAX_VITALITY;
        const vitalityPct = Math.max(0, Math.min(100, (vitality / MAX_VITALITY) * 100));
        const vitalityColor = vitality <= 0 ? "bg-red-500" : vitality <= 3 ? "bg-orange-400" : "bg-green-500";
        const vitalityTextColor = vitality <= 0 ? "text-red-600" : vitality <= 3 ? "text-orange-500" : "text-green-600";
        const malus = MAX_VITALITY - vitality;
        return (
          <div className="flex items-center gap-2 min-w-[120px]">
            <span title="Forme">✨</span>
            <HelpTooltip text="La forme représente votre vitalité. Perte de 0-2 pts/jour. Chaque point manquant réduit la capacité inventaire de 10%. Se remonte avec herbes, extraits d'herbes et potions." side="bottom" />
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[50px]">
              <div className={`h-full rounded-full transition-all duration-500 ${vitalityColor}`}
                style={{ width: `${vitalityPct}%` }} />
            </div>
            <span className={`text-xs whitespace-nowrap ${vitalityTextColor}`}>{vitality}/{MAX_VITALITY}</span>
            {malus > 0 && <span className="text-xs text-green-600 font-semibold">-{malus * 10}% inv</span>}
          </div>
        );
      })()}

      {/* Énergie */}
      {(() => {
        const fatigueRegenLabel = (() => {
          if (fatigue >= maxFatigue) return null;
          const regenInterval = getFatigueRegenInterval(profile.housing_level || "tente");
          const lastRegen = profile.fatigue_regen_at
            ? new Date(profile.fatigue_regen_at).getTime()
            : Date.now();
          const nextRegen = lastRegen + regenInterval;
          const msLeft = nextRegen - now;
          if (msLeft > 0) {
            const minLeft = Math.ceil(msLeft / 60000);
            const h = Math.floor(minLeft / 60);
            const m = minLeft % 60;
            return h > 0
              ? `+1⚡ ${h}h${m > 0 ? String(m).padStart(2,"0") + "m" : ""}`
              : `+1⚡ ${minLeft}min`;
          }
          return "+1⚡ bientôt";
        })();
        return (
          <div className="flex items-center gap-2 min-w-[120px]">
            <span title="Énergie">⚡</span>
            <HelpTooltip text="L'énergie se régénère selon votre logement : Tente +1/1h, Cabane +1/50min, Maison +1/40min, Manoir +1/30min. Se remonte aussi avec potions et taverne." side="bottom" />
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[60px]">
              <div className={`h-full rounded-full transition-all duration-500 ${fatigueColor}`}
                style={{ width: `${fatiguePct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{fatigue}/{maxFatigue}</span>
            {fatigueRegenLabel && <span className="text-xs text-muted-foreground whitespace-nowrap">{fatigueRegenLabel}</span>}
          </div>
        );
      })()}

      {/* Poids inventaire */}
      <div className="flex items-center gap-2 min-w-[120px]">
        <span title="Inventaire">📦</span>
            <HelpTooltip text="Capacité inventaire. Augmente avec logement, Grande Place et Bibliothèque. La Forme basse réduit la capacité (-10% par point manquant)." side="bottom" />
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[60px]">
          <div className={`h-full rounded-full transition-all duration-500 ${weightColor}`}
            style={{ width: `${weightPct}%` }} />
        </div>
        <span className={`text-xs whitespace-nowrap ${weightFull ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
          {currentWeight}/{maxWeight}
        </span>
        {weightFull && <span className="text-xs text-red-500 font-semibold">PLEIN</span>}
      </div>

      {/* Outils */}
      <div className={`flex items-center gap-1.5 text-xs ${(profile.tool_charges || 0) === 0 ? "text-orange-500" : "text-muted-foreground"}`}>
        <span title="Outils">🔧</span>
        <HelpTooltip text="Charges d'outils restantes. Sans outils actifs : cooldown de production multiplié par deux. Craftez des Outils (T4 par le Forgeron) pour recharger. Chaque action de production consomme une charge." side="bottom" />
        <span>{profile.tool_charges || 0}</span>
        {(profile.tool_charges || 0) === 0 && <span className="font-semibold">×2 CD</span>}
      </div>



      {/* ── Buffs actifs ── */}
      {/* Chaque badge est cliquable pour voir le détail */}
      {(() => {
        const levelInfo = getPlayerLevelInfo(profile.player_xp_total || 0);
        const buffs = [];

        // Rang joueur — affiché dès le rang 1 pour que le joueur sache où il en est
        {
          const xpNeeded = levelInfo.isMaxLevel ? 0 : Math.max(0, (levelInfo.levelDuration ?? 0) - (levelInfo.currentLevelXP ?? 0));
          const hasBonus = (levelInfo.bonuses?.cooldownBonus || 0) > 0;
          const xpSuffix = levelInfo.isMaxLevel ? "Rang maximum atteint !" : "Encore " + xpNeeded + " XP pour le rang " + (levelInfo.level + 1) + " (+1% a chaque rang).";
          const tooltipText = hasBonus
            ? "Rang " + levelInfo.level + " : -" + levelInfo.bonuses.cooldownBonus + "% cooldown de production · +" + levelInfo.bonuses.doubleProductionBonus + "% chance de doubler la recolte.\n\n" + xpSuffix
            : "Rang 1 : pas encore de bonus.\n\nEncore " + xpNeeded + " XP pour le rang 2 qui debloque -1% cooldown et +1% double production.\n\nGagnez de l'XP en consommant des potions, charbon, extrait, encre, parchemin et ressources rares de biome.";
          buffs.push({
            icon: "⭐", label: "Rang " + levelInfo.level,
            detail: hasBonus
              ? "-" + levelInfo.bonuses.cooldownBonus + "% CD · " + levelInfo.bonuses.doubleProductionBonus + "% dbl prod"
              : "aucun bonus encore",
            tooltip: tooltipText,
            color: hasBonus ? "text-purple-700 bg-purple-50 border-purple-200" : "text-muted-foreground bg-muted/40 border-border",
          });
        }

        // Buff biome (1h après combat biome)
        if (profile.biome_cooldown_bonus_expires_at && new Date(profile.biome_cooldown_bonus_expires_at) > new Date(now)) {
          const msLeft = new Date(profile.biome_cooldown_bonus_expires_at).getTime() - now;
          const minLeft = Math.ceil(msLeft / 60000);
          const h = Math.floor(minLeft / 60); const m = minLeft % 60;
          const t = h > 0 ? `${h}h${m > 0 ? String(m).padStart(2,"0")+"m" : ""}` : `${minLeft}min`;
          buffs.push({
            icon: "🌿", label: "Biome",
            detail: `−10% CD · 10% dbl prod (${t})`,
            tooltip: `Bénédiction biome active encore ${t}. −10% cooldown + 10% chance double production sur toutes les productions.`,
            color: "text-green-700 bg-green-50 border-green-200",
          });
        }

        // Bonus harvest biome (5min T1)
        if (profile.biome_harvest_bonus_expires_at && new Date(profile.biome_harvest_bonus_expires_at) > new Date(now)) {
          const msLeft = new Date(profile.biome_harvest_bonus_expires_at).getTime() - now;
          const minLeft = Math.max(1, Math.ceil(msLeft / 60000));
          buffs.push({
            icon: "🌾", label: "+1 récolte T1",
            detail: `(${minLeft}min)`,
            tooltip: `Bonus récolte biome : la prochaine production T1 donne +1 ressource bonus. Expire dans ${minLeft} min.`,
            color: "text-emerald-700 bg-emerald-50 border-emerald-200",
          });
        }

        // Cooldown bonus (bois brut T1)
        if (profile.cooldown_bonus_expires_at && new Date(profile.cooldown_bonus_expires_at) > new Date(now)) {
          const msLeft = new Date(profile.cooldown_bonus_expires_at).getTime() - now;
          const minLeft = Math.max(1, Math.ceil(msLeft / 60000));
          buffs.push({
            icon: "🪵", label: `−${Math.round((profile.cooldown_bonus_value||0.1)*100)}% CD`,
            detail: `(${minLeft}min)`,
            tooltip: `Bonus cooldown actif : −${Math.round((profile.cooldown_bonus_value||0.1)*100)}% sur toutes les productions. Expire dans ${minLeft} min.`,
            color: "text-amber-700 bg-amber-50 border-amber-200",
          });
        }

        // Double prod bonus (charbon)
        if (profile.double_prod_bonus > 0 && profile.double_prod_bonus_expires_at && new Date(profile.double_prod_bonus_expires_at) > new Date(now)) {
          const msLeft = new Date(profile.double_prod_bonus_expires_at).getTime() - now;
          const minLeft = Math.max(1, Math.ceil(msLeft / 60000));
          buffs.push({
            icon: "⚫", label: `+${Math.round((profile.double_prod_bonus||0)*100)}% dbl prod`,
            detail: `(${minLeft}min)`,
            tooltip: `Bonus double production du charbon : +${Math.round((profile.double_prod_bonus||0)*100)}% chance de doubler la récolte. Expire dans ${minLeft} min.`,
            color: "text-gray-700 bg-gray-100 border-gray-300",
          });
        }

        // Energy max bonus (minerai de fer)
        if (profile.energy_max_bonus_expires_at && new Date(profile.energy_max_bonus_expires_at) > new Date(now)) {
          const msLeft = new Date(profile.energy_max_bonus_expires_at).getTime() - now;
          const minLeft = Math.max(1, Math.ceil(msLeft / 60000));
          buffs.push({
            icon: "🪨", label: `+${profile.energy_max_bonus_value||2} énergie max`,
            detail: `(${minLeft}min)`,
            tooltip: `Minerai de fer consommé : énergie maximum augmentée de ${profile.energy_max_bonus_value||2} pendant ${minLeft} min.`,
            color: "text-blue-700 bg-blue-50 border-blue-200",
          });
        }

        // Attack bonus (pierre)
        if (profile.attack_bonus_expires_at && new Date(profile.attack_bonus_expires_at) > new Date(now)) {
          const msLeft = new Date(profile.attack_bonus_expires_at).getTime() - now;
          const minLeft = Math.max(1, Math.ceil(msLeft / 60000));
          buffs.push({
            icon: "⚔️", label: `+${profile.attack_bonus_value||1} attaque`,
            detail: `(${minLeft}min)`,
            tooltip: `Pierre consommée : +${profile.attack_bonus_value||1} en attaque vol pendant ${minLeft} min.`,
            color: "text-red-700 bg-red-50 border-red-200",
          });
        }

        // Defense bonus (laine brute / potion)
        if (profile.defense_bonus_expires_at && new Date(profile.defense_bonus_expires_at) > new Date(now)) {
          const msLeft = new Date(profile.defense_bonus_expires_at).getTime() - now;
          const minLeft = Math.max(1, Math.ceil(msLeft / 60000));
          const h = Math.floor(minLeft / 60); const m = minLeft % 60;
          const t = h > 0 ? `${h}h${m > 0 ? String(m).padStart(2,"0")+"m" : ""}` : `${minLeft}min`;
          buffs.push({
            icon: "🛡️", label: `+${profile.defense_bonus_value||2} défense`,
            detail: `(${t})`,
            tooltip: `Bonus défense actif : +${profile.defense_bonus_value||2} contre les vols pendant ${t}.`,
            color: "text-sky-700 bg-sky-50 border-sky-200",
          });
        }

        // Travel discount (encre/parchemin)
        if (profile.travel_discount > 0) {
          buffs.push({
            icon: "🗺️", label: `−${Math.round((profile.travel_discount||0)*100)}% voyage`,
            detail: "",
            tooltip: `Réduction voyage active : −${Math.round((profile.travel_discount||0)*100)}% sur le prochain voyage. Consommé à l'arrivée.`,
            color: "text-indigo-700 bg-indigo-50 border-indigo-200",
          });
        }

        // Energy regen bonus (potion de soin)
        if (profile.energy_regen_bonus_expires_at && new Date(profile.energy_regen_bonus_expires_at) > new Date(now)) {
          const msLeft = new Date(profile.energy_regen_bonus_expires_at).getTime() - now;
          const minLeft = Math.max(1, Math.ceil(msLeft / 60000));
          const h = Math.floor(minLeft / 60); const m = minLeft % 60;
          const t = h > 0 ? `${h}h${m > 0 ? String(m).padStart(2,"0")+"m" : ""}` : `${minLeft}min`;
          buffs.push({
            icon: "🧪", label: `+${profile.energy_regen_value||1}⚡/${profile.energy_regen_interval_min||5}min`,
            detail: `(${t})`,
            tooltip: `Régénération d'énergie active : +${profile.energy_regen_value||1} énergie toutes les ${profile.energy_regen_interval_min||5} min pendant ${t}.`,
            color: "text-teal-700 bg-teal-50 border-teal-200",
          });
        }

        // Hunger regen bonus (pain/ragoût)
        if (profile.hunger_regen_bonus_expires_at && new Date(profile.hunger_regen_bonus_expires_at) > new Date(now)) {
          const msLeft = new Date(profile.hunger_regen_bonus_expires_at).getTime() - now;
          const minLeft = Math.max(1, Math.ceil(msLeft / 60000));
          const h = Math.floor(minLeft / 60); const m = minLeft % 60;
          const t = h > 0 ? `${h}h${m > 0 ? String(m).padStart(2,"0")+"m" : ""}` : `${minLeft}min`;
          buffs.push({
            icon: "🍞", label: `+${profile.hunger_regen_value||1}🍞/${profile.hunger_regen_interval_min||10}min`,
            detail: `(${t})`,
            tooltip: `Régénération de faim active : +${profile.hunger_regen_value||1} faim toutes les ${profile.hunger_regen_interval_min||10} min pendant ${t}.`,
            color: "text-orange-700 bg-orange-50 border-orange-200",
          });
        }

        // ── Passifs inventaire ──
        const inv = profile.inventory || [];

        // Planches T2 : −20% cooldown
        if (inv.some(i => i.item_key === "planches" && (i.quantity||0) > 0)) {
          buffs.push({ icon: "🪵", label: "−20% CD", detail: "",
            tooltip: "Planches en inventaire : −20% cooldown de production (passif permanent tant qu'en inventaire).",
            color: "text-amber-700 bg-amber-50 border-amber-200" });
        }

        // Pierre brute T2 / Lingots de fer T3 : énergie max
        const passiveEnergyBonus = getPassiveEnergyMaxBonus(profile);
        if (passiveEnergyBonus > 0) {
          const src = inv.some(i => i.item_key === "lingots_fer" && (i.quantity||0) > 0) ? "Lingots de fer" : "Pierre brute";
          buffs.push({ icon: "🗿", label: `+${passiveEnergyBonus} énergie max`, detail: "",
            tooltip: `${src} en inventaire : +${passiveEnergyBonus} énergie maximum (passif permanent).`,
            color: "text-blue-700 bg-blue-50 border-blue-200" });
        }

        // Fil T2 / Tissu T3 : inventaire
        const passiveInvBonus = getPassiveInventoryBonus(profile);
        if (passiveInvBonus > 0) {
          const src = inv.some(i => i.item_key === "tissu" && (i.quantity||0) > 0) ? "Tissu" : "Fil";
          buffs.push({ icon: "🧶", label: `+${passiveInvBonus} inventaire`, detail: "",
            tooltip: `${src} en inventaire : +${passiveInvBonus} capacité inventaire (passif permanent, non cumulable).`,
            color: "text-purple-700 bg-purple-50 border-purple-200" });
        }

        // Quartz / Lingot : taxe marché
        const TAX_ITEMS = [
          { key: "lingot_raffine", label: "Lingot raffiné", value: 0.04 },
          { key: "lingot_or",      label: "Lingot d'or",    value: 0.03 },
          { key: "quartz_poli",    label: "Quartz poli",    value: 0.02 },
          { key: "quartz_brut",    label: "Quartz brut",    value: 0.01 },
        ];
        const bestTax = TAX_ITEMS.find(t => inv.some(i => i.item_key === t.key && (i.quantity||0) > 0));
        if (bestTax) {
          buffs.push({ icon: "🔮", label: `−${Math.round(bestTax.value*100)}% taxe`, detail: "",
            tooltip: `${bestTax.label} en inventaire : −${Math.round(bestTax.value*100)}% taxe marché acheteur (passif, seul le meilleur s'applique).`,
            color: "text-yellow-700 bg-yellow-50 border-yellow-200" });
        }

        // Épée courte / longue : attaque passive
        const passiveAttack = (() => {
          let score = 0; let src = "";
          for (const invItem of inv) {
            const def = ITEMS[invItem.item_key];
            if (!def) continue;
            if (def.trigger === "durability" && (def.effect === "attack_bonus" || def.effect === "combat_attack")) {
              const dur = invItem.durability ?? def.durability ?? 1;
              if (dur > 0) { score += def.value || 0; src = def.name; }
            }
          }
          return { score, src };
        })();
        if (passiveAttack.score > 0) {
          buffs.push({ icon: "⚔️", label: `+${passiveAttack.score} attaque`, detail: "(équipé)",
            tooltip: `${passiveAttack.src} équipée : +${passiveAttack.score} en attaque vol (passif tant que durabilité > 0).`,
            color: "text-red-700 bg-red-50 border-red-200" });
        }

        // Armure / Besace : défense passive
        const passiveDefense = (() => {
          let score = 0; let src = ""; let invBonus = 0;
          for (const invItem of inv) {
            const def = ITEMS[invItem.item_key];
            if (!def) continue;
            if (def.trigger === "durability" && (def.effect === "combat_defense" || def.effect === "defense_bonus")) {
              const dur = invItem.durability ?? def.durability ?? 1;
              if (dur > 0) { score += def.value || 0; src = def.name; invBonus += def.inventory_bonus || 0; }
            }
          }
          return { score, src, invBonus };
        })();
        if (passiveDefense.score > 0) {
          const invBonusStr = passiveDefense.invBonus > 0 ? ` · +${passiveDefense.invBonus} inventaire` : "";
          buffs.push({ icon: "🛡️", label: `+${passiveDefense.score} défense`, detail: "(équipé)",
            tooltip: `${passiveDefense.src} équipée : +${passiveDefense.score} défense vol${invBonusStr} (passif tant que durabilité > 0).`,
            color: "text-sky-700 bg-sky-50 border-sky-200" });
        }

        // Bourse de protection
        if (inv.some(i => i.item_key === "bourse_protection" && (i.durability ?? 3) > 0)) {
          const b = inv.find(i => i.item_key === "bourse_protection");
          buffs.push({ icon: "👜", label: "Bourse active", detail: `(${b?.durability ?? 3} charges)`,
            tooltip: `Bourse de protection : plafonne le vol subi à 10💰 maximum par attaque. Durabilité ${b?.durability ?? 3} charges restantes.`,
            color: "text-yellow-700 bg-yellow-50 border-yellow-200" });
        }

        if (buffs.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-1">
            {buffs.map((b, i) => (
              <HelpTooltip key={i} text={b.tooltip} side="bottom">
                <div className={`flex items-center gap-1 text-xs font-semibold border rounded px-2 py-0.5 cursor-help ${b.color}`}>
                  <span>{b.icon}</span>
                  <span>{b.label}</span>
                  {b.detail && <span className="font-normal opacity-75">{b.detail}</span>}
                </div>
              </HelpTooltip>
            ))}
          </div>
        );
      })()}

      {/* Voyage */}
      {profile.is_traveling && (
        <div className="flex items-center gap-1.5 text-accent animate-pulse">
          <span>🐴</span>
          <span>En voyage...</span>
        </div>
      )}

      {/* Niveau */}
      <PlayerLevelBadge profile={profile} variant="compact" />

      {/* Prestige */}
      {(() => {
        const vRank = getVendeurRank(profile.cumul_ventes_or || 0);
        const cRank = getContributeurRank(profile.cumul_contributions_warehouse || 0);
        const pRank = getPvpRank(profile.cumul_t5_envoyes || 0);
        const vCumul = profile.cumul_ventes_or || 0;
        const cCumul = profile.cumul_contributions_warehouse || 0;
        const pCumul = profile.cumul_t5_envoyes || 0;
        return (
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-body">
              {vRank.icon} {vRank.label}
              <HelpTooltip
                text={`🛒 Rang vendeur\n\nVentes cumulées : ${vCumul}💰${vRank.next ? `\nProchain rang "${vRank.next}" : ${vRank.nextAt}💰 (+${vRank.nextAt - vCumul}💰)` : "\n🏆 Rang maximum atteint !"}\n\nClassement : Apprenti → Débutant → Intermédiaire → Confirmé → Expert`}
                side="bottom"
              />
            </span>
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-body">
              {cRank.icon} {cRank.label}
              <HelpTooltip
                text={`📦 Rang contributeur entrepôt\n\nContributions cumulées : ${cCumul} ressources${cRank.next ? `\nProchain rang "${cRank.next}" : ${cRank.nextAt} (+${cRank.nextAt - cCumul})` : "\n👑 Rang maximum atteint !"}\n\nClassement : Radin → Donateur simple → Bon donateur → Super donateur → Donateur premium`}
                side="bottom"
              />
            </span>
            {pCumul > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-body">
                {pRank.icon} {pRank.label}
                <HelpTooltip
                  text={`⚔️ Rang militaire\n\nAttaques T5 lancées : ${pCumul}${pRank.next ? `\nProchain rang "${pRank.next}" : ${pRank.nextAt} attaques (+${pRank.nextAt - pCumul})` : "\n⚔️ Rang maximum atteint !"}\n\nClassement : Manant → Écuyer → Chevalier → Sire → Baron → Seigneur de Guerre`}
                  side="bottom"
                />
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}