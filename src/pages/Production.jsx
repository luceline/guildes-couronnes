import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TargetCityModal from "@/components/TargetCityModal";
import SpyReportModal from "@/components/SpyReportModal";
import { applyCauldronEffect, applyCityProtect, executeStealTreasury, executeSpyCity } from "@/lib/cauldronEffects";
import { useCityEvents } from "@/lib/useCityEvents";
import { useRoyalStatue } from "@/lib/useRoyalStatue";
import PlayerStatusBar from "../components/PlayerStatusBar";
import {
  PROFESSIONS, ITEM_CATEGORIES, getInventoryWeight, getMaxWeight, getMaxFatigue,
  wouldExceedCapacity, getCityBonuses, getCityTier, getPassiveCooldownBonus,
  MAX_HUNGER, HUNGER_WARNING_THRESHOLD, HUNGER_FOOD_ITEMS,
  EQUIPMENT_KEYS, EQUIPMENT_MAX_DURABILITY, EQUIPMENT_DURABILITY,
  FATIGUE_REGEN_INTERVAL_MS, getFatigueRegenInterval,
  TIER_ACTION_COST, PARCHEMIN_REWARDS, applyRandomActionCost, getMaxHunger,
  getCityHungerBonus, getCityFatigueBonus, getFestinHungerDrain,
  getPassiveCharbonDoubleProdBonus,
} from "../lib/gameData";
import { logGold } from '@/lib/goldLog';
import { getPriceMultiplier } from "../lib/pricingData";
import {
  PROFESSION_PRODUCTION, CRAFTING_RECIPES, ITEMS, ITEM_EFFECTS,
  FOOD_ITEMS_WITH_FATIGUE, TEMP_EFFECT_ITEMS, ACTION_FATIGUE_COST, TOOL_CHARGES_PER_SET,
  computeFatigueWithDailyReset, getTodayStr,
} from "../lib/craftingData";
import { getTodayPvpRecipes } from "../lib/pvpRecipes";
import { OBJECTIVE_TEMPLATES, QUEST_TEMPLATES } from "../lib/objectiveGenerator";
import { checkAndAwardObjective, filterTodayActiveObjectives } from "@/lib/questRewards";
import { toast } from "sonner";
import GameModal from "../components/GameModal";
import ItemTooltip from "../components/ItemTooltip";
import HelpTooltip from "../components/HelpTooltip";
import AtelierVitrine from "../components/AtelierVitrine";
import RepairGearModal from "../components/RepairGearModal";
import { getPlayerLevelBonuses, grantXP, XP_REWARDS, getCraftXPReward } from "../lib/playerLevelSystem";
import { findInventoryItem, getInventoryQty as getInvQty, removeFromInventory, addToInventory, hasInInventory } from "../lib/inventoryHelpers";
import { showXPToast } from "../lib/xpToasts";
import { isBiomeBuffActive, isBiomeHarvestActive, getBiomeDoubleProdChance, activateBiomeHarvestBonus } from "../lib/playerBuffs";



export default function Production({ profile, city, homeCity, onRefresh, defaultTab = "farm" }) {
  const [objectives, setObjectives] = useState([]);
  const [cityBuildings, setCityBuildings] = useState([]);
  const [priceMultiplier, setPriceMultiplier] = useState(1.0);

  // ── Sprint 5B : buffs de mairie (Fête du travail, Bénédiction, etc.) ──
  // On lit les buffs sur la ville d'origine (homeCity) car les événements
  // de mairie s'appliquent aux résidents de la ville où ils sont organisés.
  const cityEventsHookId = homeCity?.id || city?.id;
  const cityEvents = useCityEvents(cityEventsHookId);

  // ── Sprint 2C : paliers de la statue royale ──
  // La statue royale, si présente dans la ville d'origine du joueur, accorde
  // 5 paliers progressifs de bonus. On utilise un hook qui se rafraîchit toutes les 2 min.
  const royalStatue = useRoyalStatue(profile?.home_city_id);

  useEffect(() => {
    base44.entities.EconomySettings.filter({ setting_key: "global" }).then(res => {
      if (res.length > 0) {
        const orMoyen = res[0].or_moyen_par_joueur || 0;
        if (orMoyen < 200) setPriceMultiplier(0.8);
        else if (orMoyen < 500) setPriceMultiplier(1.0);
        else if (orMoyen < 1000) setPriceMultiplier(1.2);
        else if (orMoyen < 2000) setPriceMultiplier(1.5);
        else setPriceMultiplier(2.0);
      }
    }).catch(() => {});
  }, []);
  const [producing, setProducing] = useState(null);
  const [coupDeMaitre, setCoupDeMaitre] = useState(null);
  const [travelingError, setTravelingError] = useState(false);
  const [crafting, setCrafting] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [confirmConsume, setConfirmConsume] = useState(null); // { type: "food"|"temp"|"meuble"|"contrat", key, def }
  const [consumingFood, setConsumingFood] = useState(null);

  // ── Sprint 4C.2 : modales chaudron items à cible ──
  const [targetModal, setTargetModal] = useState(null); // { itemDef, type: "steal" | "spy", value }
  const [spyReport, setSpyReport] = useState(null);
  const [repairModal, setRepairModal] = useState(null); // { itemDef } - Marteau d'armurier (effect repair_combat_gear)
  const [targetSubmitting, setTargetSubmitting] = useState(false);
  // REFONTE église : passe d'un compteur 1/2 à un random 10% par action.
  // Plus besoin de compteur de session.

  // ── REFONTE bonus bâtiments : on lit le NIVEAU (1 à 5) au lieu d'un booléen ──
  // Tous ces bâtiments sont uniques par ville (cf. flag unique:true dans gameData.js).
  // Helper : niveau du bâtiment ou 0 s'il n'existe pas.
  const getBuildingLevel = (type) => {
    const b = cityBuildings.find(x => x.building_type === type);
    return b ? (b.level || 1) : 0;
  };

  const fonderieLevel = getBuildingLevel("fonderie");
  // buildingLevels : 0 si absent, 1-5 si présent. Utilisé pour le scaling des bonus.
  const buildingLevels = {
    scierie:      getBuildingLevel("scierie"),
    mine:         getBuildingLevel("mine"),
    moulin:       getBuildingLevel("moulin"),
    bergerie:     getBuildingLevel("bergerie"),
    laboratoire:  getBuildingLevel("laboratoire"),
    fonderie:     fonderieLevel,
    bibliotheque: getBuildingLevel("bibliotheque"),
    hospice:      getBuildingLevel("hospice"),
    eglise:       getBuildingLevel("eglise"),
    fontaine:     getBuildingLevel("fontaine"),
    grenier:      getBuildingLevel("grenier"),
  };
  // buildingBonuses (rétro-compat) : booléens pour le code legacy qui teste juste la présence.
  const buildingBonuses = {
    scierie:     buildingLevels.scierie > 0,
    mine:        buildingLevels.mine > 0,
    moulin:      buildingLevels.moulin > 0,
    bergerie:    buildingLevels.bergerie > 0,
    laboratoire: buildingLevels.laboratoire > 0,
    atelier:     cityBuildings.some(b => b.building_type === "atelier"),
    hospice:     cityBuildings.some(b => b.building_type === "hospice"),
    eglise:      cityBuildings.some(b => b.building_type === "eglise"),
    fontaine:    cityBuildings.some(b => b.building_type === "fontaine"),
    bibliotheque:cityBuildings.some(b => b.building_type === "bibliotheque"),
    universite:  cityBuildings.some(b => b.building_type === "universite"),
    cathedrale:  cityBuildings.some(b => b.building_type === "cathedrale"),
    grande_place:cityBuildings.some(b => b.building_type === "grande_place"),
    palais:      cityBuildings.some(b => b.building_type === "palais"),
  };
  // Bonus ville (Cathédrale, Université) appliqués aux max
  const cityHungerBonus  = getCityHungerBonus(cityBuildings);
  const cityFatigueBonus = getCityFatigueBonus(cityBuildings);
  const effectiveMaxHunger = getMaxHunger(profile || {}, cityHungerBonus);

  const [localFatigue, setLocalFatigue] = useState(null);
  const [localHunger, setLocalHunger] = useState(null);

  useEffect(() => {
    if (!profile) return;
    const maxFat = getMaxFatigue(profile, cityFatigueBonus);
    const fatigue = profile.fatigue ?? maxFat;
    setLocalFatigue(fatigue);
  }, [profile?.id, profile?.fatigue, cityFatigueBonus]);

  useEffect(() => {
    if (!profile) return;
    if (profile.hunger !== undefined && profile.hunger !== null) {
      setLocalHunger(profile.hunger);
    } else if (localHunger === null) {
      const maxH = getMaxHunger(profile, cityHungerBonus);
      setLocalHunger(maxH);
      base44.entities.PlayerProfile.update(profile.id, { hunger: maxH });
    }
  }, [profile?.id, profile?.hunger, cityHungerBonus]);

  // NB : la régen Fontaine est désormais gérée par applyHungerRegen (×2 vitesse) : pas de useEffect ici.

  const today = getTodayStr();
  const maxFatigue = getMaxFatigue(profile || {}, cityFatigueBonus);
  const currentFatigue = localFatigue ?? computeFatigueWithDailyReset(profile || {}, maxFatigue).fatigue;
  const currentHunger = localHunger ?? (profile?.hunger ?? MAX_HUNGER);

  const currentWeight = getInventoryWeight(profile || {});
  const baseMaxWeight = getMaxWeight(profile || {});
  // Bibliothèque : +30 niv.1, +40 niv.2, +50 niv.3, +60 niv.4, +70 niv.5
  const bibliothequeBonus = buildingLevels.bibliotheque > 0 ? 20 + 10 * buildingLevels.bibliotheque : 0;
  const maxWeight = baseMaxWeight + bibliothequeBonus + (buildingBonuses.grande_place ? 20 : 0);
  const weightFull = currentWeight >= maxWeight;

  // Coût total d'une action selon le tier (système unifié faim+énergie aléatoire)
  // REFONTE : moulin/laboratoire ne réduisent plus le coût d'action.
  // Leur seul effet est désormais le bonus quantité scalé par niveau (cf. plus bas).
  const getRecipeCost = (tier, isFarm = false) => {
    const baseCost = TIER_ACTION_COST?.[tier] || 1;
    return Math.max(1, baseCost);
  };


  const handleEatForHunger = async (itemKey) => {
    const hungerDef = HUNGER_FOOD_ITEMS[itemKey];
    if (!hungerDef) return;

    const maxHungerVal = getMaxHunger(profile, cityHungerBonus);

    if (currentHunger >= maxHungerVal) {
      toast("🍽️ Vous n'avez pas faim !"); return;
    }

    const invItem = (profile.inventory || []).find(i => i.item_key === itemKey || i.item_name === hungerDef?.label);
    if (!invItem || invItem.quantity <= 0) { toast.error("Vous n'avez plus cet aliment !"); return; }

    setConsumingFood(itemKey + "_hunger");

    const newInventory = (profile.inventory || [])
      .map(i => (i.item_key === itemKey || i.item_name === hungerDef?.label) ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0);

    const newHunger = Math.min(maxHungerVal, currentHunger + hungerDef.hunger_restore);
    const upd = { inventory: newInventory, hunger: newHunger };
    setLocalHunger(newHunger);
    const msgs = [`+${hungerDef.hunger_restore}🍽️`];

    // Festin empoisonné actif sur la ville → drain énergie supplémentaire
    const festinDrain = getFestinHungerDrain(city);
    if (festinDrain > 0) {
      const newFat = Math.max(0, currentFatigue - festinDrain);
      upd.fatigue = newFat;
      setLocalFatigue(newFat);
      msgs.push(`☠️ −${festinDrain}⚡ (festin empoisonné)`);
    }

    // Bonus énergie de certains aliments
    const fatBonus = ITEMS[itemKey]?.fatigue_restore || 0;
    if (fatBonus > 0) {
      const fatBase = upd.fatigue ?? currentFatigue;
      const newFat = Math.min(maxFatigue, fatBase + fatBonus);
      upd.fatigue = newFat;
      setLocalFatigue(newFat);
      msgs.push(`+${fatBonus}⚡`);
    }

    // ── Gain XP : +1 XP si on mange du blé (action favorite, encourage la consommation T1) ──
    let xpGain = null;
    if (itemKey === "ble") {
      xpGain = grantXP(profile, XP_REWARDS.CONSUME_BLE);
      Object.assign(upd, xpGain.updates);
    }

    await base44.entities.PlayerProfile.update(profile.id, upd);
    toast.success(`${hungerDef?.icon || '🍽️'} ${msgs.join(' · ')} !`);
    // Toast XP séparé
    if (xpGain) {
      showXPToast(XP_REWARDS.CONSUME_BLE, xpGain, { icon: "🌾", context: "alimentation" });
    }
    setConsumingFood(null);
    onRefresh?.();
  };


  // Seul contrat_artisan déclenche une quête (contrat_noble est désormais défensif)
  const CONTRAT_DEFS = {
    contrat_artisan: { title: "Contrat artisan", type: "produce", target_item: "any_t2", target_quantity: 5, reward_gold: 110, description: "Fabriquez 5 objets de T2 ou plus. Récompense : 110💰." },
  };

  const handleActivateContrat = async (itemKey) => {
    const def = CONTRAT_DEFS[itemKey];
    if (!def) return;

    const existing = (objectives || []).find(o => o.parchemin_type === itemKey && o.status === "active");
    if (existing) {
      toast.error("Vous avez déjà un objectif de ce type en cours !");
      return;
    }

    const newInv = (profile.inventory || [])
      .map(i => i.item_key === itemKey ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0);
    await base44.entities.PlayerProfile.update(profile.id, { inventory: newInv });

    await base44.entities.PlayerObjective.create({
      player_email:     profile.user_email,
      player_name:      profile.character_name || "",
      city_id:          city?.id || "",
      title:            def.title,
      description:      def.description,
      type:             def.type,
      target_item:      def.target_item,
      target_quantity:  def.target_quantity,
      reward_gold:      def.reward_gold,
      parchemin_type:   itemKey,
      status:           "active",
      current_quantity: 0,
    });

    toast.success(`📜 Le contrat est signé ! ${def.title} : ${def.description} Récompense promise : ${def.reward_gold} 💰`);
    onRefresh?.();
  };

  // 11/05/2026 : handler handleSellLingotToMairie retiré.
  // L'item lingot_royal (T5) a été supprimé du jeu. La trésorerie de ville
  // sera mise à jour par le futur système "brûler trésorerie" pour monter
  // les tiers.


  const handleConsumeFood = async (foodKey) => {
    const foodDef = FOOD_ITEMS_WITH_FATIGUE.find(f => f.key === foodKey);
    if (!foodDef) return;
    const invItem = (profile.inventory || []).find(i => i.item_key === foodKey || i.item_name === foodDef.name);
    if (!invItem || invItem.quantity <= 0) { toast.error("Vous n'avez plus cet aliment !"); return; }

    if (currentFatigue >= maxFatigue) { toast("⚡ Vous êtes déjà au maximum de votre énergie !"); return; }
    setConsumingFood(foodKey);
    const newFatigue = Math.min(maxFatigue, currentFatigue + foodDef.fatigue_restore);
    setLocalFatigue(newFatigue);
    const newInventory = (profile.inventory || [])
      .map(i => (i.item_key === foodKey || i.item_name === foodDef.name) ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0);
    const xpUpdates = { fatigue: newFatigue, inventory: newInventory };
    // ── Gain XP : +1 XP si on consomme des herbes ──
    let xpGain = null;
    if (foodKey === "herbes") {
      xpGain = grantXP(profile, XP_REWARDS.CONSUME_HERBES);
      Object.assign(xpUpdates, xpGain.updates);
    }
    // ── Buff biome harvest bonus pour les T1 fatigue_restore (herbes) ──
    const itemDefFatigue = ITEMS[foodKey];
    if (itemDefFatigue?.biome_profession && itemDefFatigue?.biome_key) {
      if (isBiomeBuffActive(profile)) {
        activateBiomeHarvestBonus(xpUpdates);
        toast(`🌿 Buff biome actif ! +1 récolte bonus sur ta prochaine production T1.`);
      }
    }
    await base44.entities.PlayerProfile.update(profile.id, xpUpdates);
    toast.success(`${foodDef.icon} ${foodDef.name} consommé ! +${foodDef.fatigue_restore}⚡ énergie (${newFatigue}/${maxFatigue})`);
    // Toast XP séparé
    if (xpGain) {
      showXPToast(XP_REWARDS.CONSUME_HERBES, xpGain, { icon: "🌿", context: "récupération" });
    }
    setConsumingFood(null);
    onRefresh?.();
  };

  const handleActivateMeuble = async () => {
    const invItem = (profile.inventory || []).find(i => i.item_key === "meuble" || i.item_name === "Meuble");
    if (!invItem || invItem.quantity <= 0) { toast.error("Vous ne possédez aucun meuble à installer !"); return; }
    if (profile.meuble_expires_at && profile.meuble_expires_at >= new Date().toISOString().split("T")[0]) {
      toast("🪑 Un meuble est déjà actif !"); return;
    }
    const expiresAt = new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0];
    const newInventory = (profile.inventory || [])
      .map(i => (i.item_key === "meuble" || i.item_name === "Meuble") ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0);
    await base44.entities.PlayerProfile.update(profile.id, { inventory: newInventory, meuble_expires_at: expiresAt });
    toast.success(`🪑 Le meuble trône dans votre demeure ! Votre logement vous coûtera moitié moins cher pendant 10 jours.`);
    onRefresh?.();
  };

  const handleConsumeTempEffect = async (itemDef) => {
    // Les items passifs n'ont pas de bouton consommer
    if (itemDef.trigger === "passive") return;

    const invItem = (profile.inventory || []).find(i => i.item_key === itemDef.key || i.item_name === itemDef.name);
    if (!invItem || invItem.quantity <= 0) { toast.error(`Vous n'avez plus de ${itemDef.name} !`); return; }

    // ── Sprint 4C : items du chaudron magique ──
    // Délègue au helper centralisé pour ne pas dupliquer la logique entre
    // Production.jsx et InventoryPanel.jsx.
    if (itemDef.category === "chaudron") {
      const result = applyCauldronEffect(itemDef, profile, city, {
        cityHungerBonus,
        getMaxHunger,
        getMaxFatigue,
      });

      // Items à cible : ouvre la modale au lieu de consommer ici
      if (result?.needsTarget) {
        setTargetModal({
          itemDef,
          type: result.needsTarget === "spy_city" ? "spy" : "steal",
          value: result.value || 0,
        });
        return;
      }

      // Talisman de protection : appel async dédié
      if (result?.needsAsync === "city_protect") {
        try {
          const protectResult = await applyCityProtect(profile, city, result.duration_h);
          if (protectResult.error) {
            toast.error(protectResult.error);
            return;
          }
          const newInv = (profile.inventory || [])
            .map(i => i.item_key === itemDef.key ? { ...i, quantity: i.quantity - 1 } : i)
            .filter(i => i.quantity > 0);
          await base44.entities.PlayerProfile.update(profile.id, { inventory: newInv });
          toast.success(protectResult.toastMessage);
          onRefresh?.();
        } catch (e) {
          console.error("[Cauldron] talisman:", e);
          toast.error("Erreur lors de l'activation du talisman.");
        }
        return;
      }

      // Effet local appliqué : on consomme + applique
      if (result?.handled) {
        try {
          const newInv = (profile.inventory || [])
            .map(i => i.item_key === itemDef.key ? { ...i, quantity: i.quantity - 1 } : i)
            .filter(i => i.quantity > 0);
          await base44.entities.PlayerProfile.update(profile.id, {
            inventory: newInv,
            ...(result.updates || {}),
          });
          toast.success(result.toastMessage || `${itemDef.icon} ${itemDef.name} consommé !`);
          onRefresh?.();
        } catch (e) {
          console.error("[Cauldron] consume:", e);
          toast.error("Erreur lors de la consommation.");
        }
        return;
      }
    }

    // ── NOUVEAU v3 (09/05/2026) - Marteau d'armurier : ouvre une modale de répartition au lieu de consommer directement ──
    if (itemDef.effect === "repair_combat_gear") {
      setRepairModal({ itemDef });
      return;
    }

    // ── NOUVEAU v3 (09/05/2026) - Pierre a aiguiser / Affutage de maitre : recharge l'outil d'artisan (cap 50) ──
    if (itemDef.effect === "recharge_artisan_tool") {
      if (!profile.artisan_tool_obtained) {
        toast.error("Vous n'avez pas encore obtenu votre Outil d'artisan ! Cliquez sur 'Obtenir gratuitement' dans l'onglet Fabriquer.");
        return;
      }
      const currentCharges = profile.artisan_tool_charges || 0;
      if (currentCharges >= ARTISAN_TOOL_MAX_CHARGES) {
        toast(`🔨 Outil deja au maximum (${ARTISAN_TOOL_MAX_CHARGES}/${ARTISAN_TOOL_MAX_CHARGES}). Conservez votre ${itemDef.name} pour plus tard.`);
        return;
      }
      const rechargeValue = itemDef.value || 0;
      const newCharges = Math.min(ARTISAN_TOOL_MAX_CHARGES, currentCharges + rechargeValue);
      const realApplied = newCharges - currentCharges;
      const newInv = (profile.inventory || [])
        .map(i => (i.item_key === itemDef.key || i.item_name === itemDef.name) ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0);
      try {
        await base44.entities.PlayerProfile.update(profile.id, {
          inventory: newInv,
          artisan_tool_charges: newCharges,
        });
        toast.success(`🔨 Outil d'artisan recharge : ${currentCharges} -> ${newCharges} / ${ARTISAN_TOOL_MAX_CHARGES} (+${realApplied})`);
        onRefresh?.();
      } catch (e) {
        console.error("[recharge_artisan_tool]", e);
        toast.error("Erreur lors de la recharge de l'outil.");
      }
      return;
    }

    // ── NOUVEAU v3 (09/05/2026) - Etai de recolte : buff +25% chance bonus recolte pendant 1h ──
    // Reutilise le mecanisme existant biome_harvest_bonus_expires_at (active dans Production craft T1).
    // duration_minutes provient de l'item def (60 par defaut pour etai_recolte).
    if (itemDef.effect === "harvest_bonus_buff") {
      const durationMinutes = itemDef.duration_minutes || 60;
      const expiresAtBuff = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      const newInv = (profile.inventory || [])
        .map(i => (i.item_key === itemDef.key || i.item_name === itemDef.name) ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0);
      try {
        await base44.entities.PlayerProfile.update(profile.id, {
          inventory: newInv,
          biome_harvest_bonus_expires_at: expiresAtBuff,
        });
        toast.success(`🪵 ${itemDef.name} : +${itemDef.value || 25}% chance bonus de recolte pendant ${durationMinutes} min !`);
        onRefresh?.();
      } catch (e) {
        console.error("[harvest_bonus_buff]", e);
        toast.error("Erreur lors de l'activation du buff.");
      }
      return;
    }

    // ── NOUVEAU v3 (09/05/2026) - Bon du Tresor : +50 or sur prochaine epopee ──
    // FIX 10/05/2026 : utilisait par erreur next_epopee_gold_bonus (ancien
    // multiplicateur de piece_porte_bonheur), provoquant un affichage +5000%
    // (50 * 100). Bon champ = next_epopee_gold_flat (additif fixe).
    if (itemDef.effect === "epopee_gold_bonus") {
      const currentBonus = profile.next_epopee_gold_flat || 0;
      if (currentBonus > 0) {
        toast.error(`💼 Vous avez deja un Bon du Tresor en attente (+${currentBonus}💰). Utilisez votre prochaine epopee pour l'encaisser.`);
        return;
      }
      const bonusValue = itemDef.value || 50;
      const newInv = (profile.inventory || [])
        .map(i => (i.item_key === itemDef.key || i.item_name === itemDef.name) ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0);
      try {
        await base44.entities.PlayerProfile.update(profile.id, {
          inventory: newInv,
          next_epopee_gold_flat: bonusValue,
        });
        toast.success(`💼 ${itemDef.name} active : votre prochaine epopee rapportera +${bonusValue}💰 bonus !`);
        onRefresh?.();
      } catch (e) {
        console.error("[epopee_gold_bonus]", e);
        toast.error("Erreur lors de l'activation du bonus.");
      }
      return;
    }

    // ── NOUVEAU v3 (09/05/2026) - Bandeau d'erudit : +1 ressource rare prochaine epopee ──
    // FIX 10/05/2026 : utilisait par erreur next_epopee_drop_bonus (ancien
    // multiplicateur de trefle_chance, exprimé en %). Bon champ = next_epopee_rare_flat.
    if (itemDef.effect === "epopee_rare_bonus") {
      const currentBonus = profile.next_epopee_rare_flat || 0;
      if (currentBonus > 0) {
        toast.error(`🎓 Vous avez deja un Bandeau d'erudit actif (+${currentBonus} ressource rare). Utilisez votre prochaine epopee.`);
        return;
      }
      const bonusValue = itemDef.value || 1;
      const newInv = (profile.inventory || [])
        .map(i => (i.item_key === itemDef.key || i.item_name === itemDef.name) ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0);
      try {
        await base44.entities.PlayerProfile.update(profile.id, {
          inventory: newInv,
          next_epopee_rare_flat: bonusValue,
        });
        toast.success(`🎓 ${itemDef.name} active : votre prochaine epopee garantit +${bonusValue} ressource rare !`);
        onRefresh?.();
      } catch (e) {
        console.error("[epopee_rare_bonus]", e);
        toast.error("Erreur lors de l'activation du bonus.");
      }
      return;
    }

    // ── NOUVEAU v3 (09/05/2026) - Carnet de commande : quete bonus +35 or pour prochaine vente T2+ au marche ──
    // Set le champ pending_market_sale_bonus, consomme par Market.handleSell quand le joueur met en vente un T2+.
    if (itemDef.effect === "quest_market_sale") {
      const currentBonus = profile.pending_market_sale_bonus || 0;
      if (currentBonus > 0) {
        toast.error(`📒 Vous avez deja un Bon de commande en attente (+${currentBonus}💰). Vendez d'abord 1 item T2+ au marche pour pouvoir en activer un autre.`);
        return;
      }
      const bonusValue = itemDef.value || 35;
      const newInv = (profile.inventory || [])
        .map(i => (i.item_key === itemDef.key || i.item_name === itemDef.name) ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0);
      try {
        await base44.entities.PlayerProfile.update(profile.id, {
          inventory: newInv,
          pending_market_sale_bonus: bonusValue,
        });
        toast.success(`📒 ${itemDef.name} active : votre prochaine mise en vente d'un item T2+ vous rapportera +${bonusValue}💰 bonus !`);
        onRefresh?.();
      } catch (e) {
        console.error("[quest_market_sale]", e);
        toast.error("Erreur lors de l'activation du bon.");
      }
      return;
    }

    const now = new Date();
    const expiresAt = itemDef.duration_h
      ? new Date(now.getTime() + itemDef.duration_h * 3600000).toISOString()
      : null;

    const newInventory = (profile.inventory || [])
      .map(i => (i.item_key === itemDef.key || i.item_name === itemDef.name) ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0);

    const updates = { inventory: newInventory };

    if (itemDef.effect === "cooldown_bonus") {
      const currentVal = profile.cooldown_bonus_value || 0;
      if (profile.cooldown_bonus_expires_at && new Date(profile.cooldown_bonus_expires_at) > now && currentVal >= itemDef.value) {
        toast(`🪵 Bonus cooldown déjà actif (−${Math.round(currentVal * 100)}%).`); return;
      }
      updates.cooldown_bonus_expires_at = expiresAt;
      updates.cooldown_bonus_value = itemDef.value;

    } else if (itemDef.effect === "energy_max_bonus") {
      const currentVal = profile.energy_max_bonus_value || 0;
      if (profile.energy_max_bonus_expires_at && new Date(profile.energy_max_bonus_expires_at) > now && currentVal >= itemDef.value) {
        toast(`🪨 Bonus énergie max déjà actif (+${currentVal}).`); return;
      }
      updates.energy_max_bonus_expires_at = expiresAt;
      updates.energy_max_bonus_value = itemDef.value;

    } else if (itemDef.effect === "biome_buff_only") {
      // pierre, laine_brute : aucun effet à la consommation hors buff biome
      // (le buff biome est géré plus bas dans le flux T1 biome harvest)

    } else if (itemDef.effect === "double_prod_bonus") {
      // REFONTE v5 : charbon devient passif. Pas de consommation possible.
      toast("⚫ Le charbon agit passivement : pas besoin de le consommer.");
      return;

    } else if (itemDef.effect === "gamble") {
      // REFONTE v5 : Encre : gamble pur 0–80💰 (plus d'effet voyage/craft/XP)
      const gambleMax = itemDef.gamble_max || 80;
      const gambleGold = Math.floor(Math.random() * (gambleMax + 1));
      if (gambleGold > 0) {
        const freshP2 = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
        updates.gold = (freshP2?.gold || profile.gold || 0) + gambleGold;
        const flavor = gambleGold > gambleMax * 0.6 ? "📖 Votre ouvrage fait fureur !" : gambleGold > 20 ? "📖 Succès modeste..." : "📖 Un flop, hélas...";
        toast.success(`${itemDef.icon} ${flavor} +${gambleGold}💰`);
        await logGold({
          profile, city,
          amount: gambleGold, type: 'objectif',
          description: `Gamble ${itemDef.name || itemDef.key} : +${gambleGold}💰 (max ${gambleMax})`,
        });
      } else {
        toast(`📖 Votre livre est resté dans les cartons... Personne n'a mordu.`);
      }
      await base44.entities.PlayerProfile.update(profile.id, updates);
      onRefresh?.();
      return;

    } else if (itemDef.effect === "xp_reward") {
      // REFONTE v5 : Parchemin : pure récompense XP
      const xpAmount = itemDef.value || 100;
      const xpGain = grantXP(profile, xpAmount);
      Object.assign(updates, xpGain.updates);
      await base44.entities.PlayerProfile.update(profile.id, updates);
      showXPToast(xpAmount, xpGain, { icon: itemDef.icon });
      onRefresh?.();
      return;

    // 11/05/2026 : handler army_food / army_energy retiré (système militaire
    // supprimé). Ragoût T4 et Potion d'endurance T4 ont été reconvertis en
    // consommables joueur classiques (effect: "hunger_restore" / "fatigue_restore").

    } else if (itemDef.effect === "hunger_restore") {
      // Blé / Farine / Pain : +X faim instant
      const maxH = getMaxHunger(profile, cityHungerBonus);
      const currentHungerLoc = profile.hunger ?? maxH;
      updates.hunger = Math.min(maxH, currentHungerLoc + (itemDef.value || 5));
      // Festin empoisonné actif → drain énergie
      const festinDrain = getFestinHungerDrain(city);
      if (festinDrain > 0) {
        const fatBase = profile.fatigue ?? maxFatigue;
        updates.fatigue = Math.max(0, fatBase - festinDrain);
      }

    } else if (itemDef.effect === "fatigue_restore") {
      // Herbes / Extrait / Potion de soin : +X énergie instant
      const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
      const currentFat = freshP?.fatigue ?? (profile.fatigue || 0);
      const maxFat = getMaxFatigue(profile, 0);
      updates.fatigue = Math.min(maxFat, currentFat + (itemDef.value || 5));

    } else if (itemDef.effect === "market_tax_discount") {
      // Quartz brut T1 : si buff biome actif, activer le harvest bonus
      if (itemDef.biome_profession && itemDef.biome_key) {
        if (isBiomeBuffActive(profile)) {
          const harvestUpdates = {};
          activateBiomeHarvestBonus(harvestUpdates);
          await base44.entities.PlayerProfile.update(profile.id, harvestUpdates);
          toast(`🌿 Buff biome actif ! +1 récolte bonus sur ta prochaine production T1.`);
          onRefresh?.();
          return;
        }
      }
      toast(`💠 Le quartz poli agit passivement : pas besoin de le consommer.`);
      return;

    } else if (itemDef.effect === "housing_maintenance") {
      // Meuble : -50% entretien pendant 10j
      const expiresDay = new Date(now.getTime() + (itemDef.duration_days || 10) * 86400000).toISOString().split("T")[0];
      updates.meuble_expires_at = expiresDay;
      updates.meuble_discount = itemDef.value || 0.50;

    } else if (itemDef.effect === "quest_activate") {
      // Contrat artisan : géré par handleActivateContrat
      toast("📋 Utilisez le bouton 'Activer' dédié pour le Contrat artisan.");
      return;

    }

    // ── XP reward sur consommation (effets génériques qui ont encore xp_reward) ──
    if (itemDef.xp_reward) {
      const freshPxp = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
      updates.player_xp_total = (freshPxp?.player_xp_total || 0) + itemDef.xp_reward;
    }

    // ── Buff biome harvest bonus (T1) ──
    if (itemDef.biome_profession && itemDef.biome_key) {
      if (isBiomeBuffActive(profile)) {
        activateBiomeHarvestBonus(updates);
        toast(`🌿 Buff biome actif ! +1 récolte bonus sur ta prochaine production T1.`);
      }
    }

    await base44.entities.PlayerProfile.update(profile.id, updates);
    const xpMsg = itemDef.xp_reward ? ` · +${itemDef.xp_reward} XP` : "";
    toast.success(`${itemDef.icon} ${itemDef.name} consommé !${xpMsg}`);
    onRefresh?.();
  };

  // ── Sprint 4C.2 : confirmation de la cible pour Parchemin/Étoile/Hibou ──
  const handleConfirmTarget = async (selectedCity) => {
    if (!targetModal) return;
    const { itemDef, type, value } = targetModal;
    setTargetSubmitting(true);

    try {
      if (type === "steal") {
        const result = await executeStealTreasury(profile, selectedCity, value, itemDef.name);
        if (result.error) {
          toast.error(result.error);
          setTargetSubmitting(false);
          return;
        }
        // Consomme l'item dans tous les cas (réussite, blocage par dôme, ou trésorerie vide)
        const newInventory = (profile.inventory || [])
          .map(i => (i.item_key === itemDef.key || i.item_name === itemDef.name) ? { ...i, quantity: i.quantity - 1 } : i)
          .filter(i => i.quantity > 0);
        const updates = { inventory: newInventory };
        if (result.success && result.goldUpdate) {
          updates.gold = (profile.gold || 0) + result.goldUpdate;
        }
        await base44.entities.PlayerProfile.update(profile.id, updates);

        // Log côté ville cible (pour dashboard maire)
        if (result.success && result.stolenAmount > 0) {
          // Transaction VICTIME : player_email vide pour ne pas polluer le journal du voleur
          await base44.entities.GoldTransaction.create({
            player_email: "",
            player_name: "",
            city_id: selectedCity.id,
            city_name: selectedCity.name || "",
            amount: -result.stolenAmount,
            type: "vol_chaudron_subi",
            description: `🗡️ Vol par ${profile.character_name || profile.user_email} via ${itemDef.icon} ${itemDef.name} : -${result.stolenAmount}💰`,
          }).catch(() => {});

          // Transaction VOLEUR : visible dans le journal personnel du joueur
          await base44.entities.GoldTransaction.create({
            player_email: profile.user_email,
            player_name: profile.character_name || "",
            city_id: profile.home_city_id || "",
            city_name: "",
            amount: result.stolenAmount,
            type: "vol_chaudron_recu",
            description: result.logDescription || `Vol via ${itemDef.name}`,
          }).catch(() => {});
        }

        toast.success(result.toastMessage);

      } else if (type === "spy") {
        const result = await executeSpyCity(profile, selectedCity);
        if (result.error) {
          toast.error(result.error);
          setTargetSubmitting(false);
          return;
        }
        // Consomme l'item
        const newInventory = (profile.inventory || [])
          .map(i => (i.item_key === itemDef.key || i.item_name === itemDef.name) ? { ...i, quantity: i.quantity - 1 } : i)
          .filter(i => i.quantity > 0);
        await base44.entities.PlayerProfile.update(profile.id, { inventory: newInventory });

        // Affiche le rapport
        setSpyReport(result.report);
      }

      setTargetModal(null);
      onRefresh?.();
    } catch (e) {
      console.error("[Cauldron] target action failed:", e);
      toast.error("L'action a échoué.");
    } finally {
      setTargetSubmitting(false);
    }
  };

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadObjectives = useCallback(async () => {
    if (!profile) return;
    const objs = await base44.entities.PlayerObjective.filter({ player_email: profile.user_email, status: "active" });
    // Garder toutes les quêtes actives : contrats ET quêtes du jour
    // Les quêtes du jour sont filtrées à la validation via filterTodayActiveObjectives
    setObjectives(objs);
    // Bâtiments depuis la ville d'origine (homeCity) : fallback sur la ville actuelle
    const sourceCityBuildings = homeCity?.buildings || city?.buildings || [];
    setCityBuildings(sourceCityBuildings);
  }, [profile?.id, profile?.profession, homeCity?.id, profile?.user_email]);

  useEffect(() => {
    loadObjectives();
  }, [loadObjectives]);



  const getCooldownLeft = (recipeId) => {
    const cooldowns = profile?.production_cooldowns || {};
    const lastProduced = cooldowns[recipeId];
    if (!lastProduced) return 0;
    const allRecipes = [
      ...farmRecipes,
      ...CRAFTING_RECIPES,
      ...getTodayPvpRecipes(),
    ];
    const recipe = allRecipes.find(r => r.id === recipeId);
    if (!recipe) return 0;
    const hasToolCharges = (profile?.tool_charges || 0) > 0;
    const reduction = hasToolCharges ? (ITEM_EFFECTS.outils?.value || 0) : 0;
    // 11/05/2026 : COOLDOWN_PENALTY_NO_TOOLS retiré. Plus de malus quand
    // l'outil d'artisan est épuisé. L'outil reste utile pour son bonus
    // actif (reduction) mais ne pénalise plus quand il est à 0.
    const tractsActive = city?.production_malus?.tracts_greve_active_until && new Date(city.production_malus.tracts_greve_active_until) > new Date();
    const tractsMalus = tractsActive ? 1.2 : 1;
    const cityLingotBonus = getCityBonuses(city?.lingots_cumul || 0).cooldownReduction / 100;
    const tempCooldownBonus = getPassiveCooldownBonus(profile);
    // ── Hook chaudron : 🔥 Pierre de feu : -30% durée crafts pendant 4h ──
    const pierreFeuActive = profile?.craft_speed_buff_until && new Date(profile.craft_speed_buff_until) > new Date();
    const pierreFeuBonus = pierreFeuActive ? (profile.craft_speed_buff_value || 0.30) : 0;
    // ── Hook événement mairie : 🛠️ Fête du travail : -50% durée crafts (cumul multiplicatif) ──
    const workFestivalActive = cityEvents.hasBuff("work_festival");
    const workFestivalBonus = workFestivalActive ? 0.50 : 0;
    // ── Sprint 2C : Palier 1 statue royale : -10% cooldown crafts (cumul multiplicatif) ──
    const statuePalier1Bonus = royalStatue.hasPalier(1) ? 0.10 : 0;
    // REFONTE : la fonderie ne réduit plus le cooldown forgeron. Son seul effet est désormais
    // le bonus quantité quartz scalé par niveau (cf. plus bas).
    const levelBonuses = getPlayerLevelBonuses(profile?.player_level || 1);
    const levelCooldownBonus = levelBonuses.cooldownBonus / 100; // −1% par niveau
    const effectiveCooldown = recipe.cooldown * (1 - reduction) * (1 - cityLingotBonus) * (1 - tempCooldownBonus) * (1 - pierreFeuBonus) * (1 - workFestivalBonus) * (1 - statuePalier1Bonus) * (1 - levelCooldownBonus) * tractsMalus;
    const elapsed = (Date.now() - new Date(lastProduced).getTime()) / 1000;
    return Math.max(0, effectiveCooldown - elapsed);
  };

  const formatCooldown = (s) => {
    if (s <= 0) return null;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m > 0 ? `${m}m ${s > 60 ? sec + "s" : ""}` : `${sec}s`;
  };

  const farmRecipes = PROFESSION_PRODUCTION[profile?.profession] || [];

  const handleFarm = async (recipe) => {
    if (profile.is_traveling) { setTravelingError(true); return; }
    // NB : check faim/énergie effectué par applyRandomActionCost plus bas (avec toast).
    if (wouldExceedCapacity(profile, recipe.quantity)) {
      toast.error(`📦 Votre besace déborde ! (${currentWeight}/${maxWeight}) Allégez votre charge avant de produire davantage.`);
      return;
    }
    const cooldown = getCooldownLeft(recipe.id);
    if (cooldown > 0) { toast.error(`Encore ${formatCooldown(cooldown)} avant de produire.`); return; }

    // ── Check précoce faim/énergie (avant toute manipulation) ──
    const earlyFarmCost = TIER_ACTION_COST?.[recipe.tier || 1] || 1;
    if (currentHunger + currentFatigue < earlyFarmCost) {
      toast.error(`💤 Pas assez d'énergie ni de faim pour récolter (besoin de ${earlyFarmCost} points, vous avez ${currentHunger + currentFatigue}).`);
      return;
    }

    if (recipe.requiresItems) {
      for (const req of recipe.requiresItems) {
        const has = getInventoryQty(req.key);
        if (has < req.quantity) {
          toast.error(`Il vous faut ${req.quantity}× ${ITEMS[req.key]?.name || req.key} pour cette action.`);
          return;
        }
      }
    }

    setProducing(recipe.id);
    const item = ITEMS[recipe.outputKey];
    let newInventory = [...(profile.inventory || [])];

    if (recipe.requiresItems) {
      for (const req of recipe.requiresItems) {
        const itemDef = ITEMS[req.key];
        const idx = newInventory.findIndex(i =>
          i.item_key === req.key ||
          i.item_name === itemDef?.name ||
          i.item_name?.toLowerCase().replace(/ /g, "_") === req.key
        );
        if (idx >= 0) newInventory[idx] = { ...newInventory[idx], quantity: newInventory[idx].quantity - req.quantity };
      }
      newInventory = newInventory.filter(i => i.quantity > 0);
    }

    const cityProdBonus = getCityBonuses(city?.lingots_cumul || 0).cooldownReduction;
    const bonusQty = cityProdBonus > 0 ? Math.floor(recipe.quantity * cityProdBonus / 100) : 0;

    let buildingQtyBonus = 0;
    // REFONTE bonus bâtiments : +1 par niveau du bâtiment (niveau 1 = +1, ..., niveau 5 = +5)
    if (recipe.outputKey === "bois_brut"    && buildingLevels.scierie > 0)     buildingQtyBonus += buildingLevels.scierie;
    if (recipe.outputKey === "minerai_fer"  && buildingLevels.mine > 0)        buildingQtyBonus += buildingLevels.mine;
    if (recipe.outputKey === "ble"          && buildingLevels.moulin > 0)      buildingQtyBonus += buildingLevels.moulin;
    if (recipe.outputKey === "laine_brute"  && buildingLevels.bergerie > 0)    buildingQtyBonus += buildingLevels.bergerie;
    if (recipe.outputKey === "herbes"       && buildingLevels.laboratoire > 0) buildingQtyBonus += buildingLevels.laboratoire;
    if (recipe.outputKey === "quartz_brut"  && buildingLevels.fonderie > 0)    buildingQtyBonus += buildingLevels.fonderie;
    // Atelier (T2 tissu) : effet legacy non scalé pour le moment
    if (recipe.outputKey === "tissu"        && buildingBonuses.atelier)        buildingQtyBonus += 1;
    // REFONTE : la fonderie n'octroie plus +1 lingots_or (son effet est désormais le bonus quartz uniquement).

    // ── Chance double production : tous les bonus additifs (REFONTE v5) ──
    // Charbon T2 est désormais un PASSIF : présence dans inventaire = +5%, peu importe la quantité.
    // S'AJOUTE aux bonus biome et niveau (cumul additif).
    const biomeDoubleChanceProd  = getBiomeDoubleProdChance(profile);
    const levelBonusesProd       = getPlayerLevelBonuses(profile?.player_level || 1);
    const doubleChanceLevel      = levelBonusesProd.doubleProductionBonus / 100;
    const charbonBonus = getPassiveCharbonDoubleProdBonus(profile); // 0.05 si charbon en stock, sinon 0
    // ── Hook événement mairie : 💰 Bénédiction de l'abondance : +5% double prod ──
    const blessingBonus = cityEvents.hasBuff("abundance_blessing") ? 0.05 : 0;
    const doubleChance = doubleChanceLevel + biomeDoubleChanceProd + charbonBonus + blessingBonus;
    const doubleBonus  = (!isNaN(doubleChance) && doubleChance > 0 && Math.random() < doubleChance) ? recipe.quantity : 0;
    const biomeBonusQty = 0; // absorbé dans doubleBonus
    if (doubleBonus > 0) {
      const sources = [
        doubleChanceLevel     > 0 ? `rang ${profile?.player_level || 1}` : null,
        biomeDoubleChanceProd > 0 ? `biome` : null,
        charbonBonus          > 0 ? `charbon` : null,
        blessingBonus         > 0 ? `bénédiction` : null,
      ].filter(Boolean).join(" + ");
      setCoupDeMaitre({ qty: doubleBonus, itemName: item?.name || recipe.name, sources });
    }
    // Biome harvest bonus T1 (timer 5min : indépendant du double prod)
    let biomeHarvestBonus = 0;
    if (recipe.tier === 1 && isBiomeHarvestActive(profile)) {
      biomeHarvestBonus = 1;
    }
    const totalQty = recipe.quantity + bonusQty + buildingQtyBonus + doubleBonus + biomeHarvestBonus;
    if (biomeHarvestBonus > 0) toast(`🌿 Bonus biome récolte ! +1 ${recipe.outputKey} !`);

    const isEquipment = EQUIPMENT_KEYS.includes(recipe.outputKey);
    const itemName = item?.name || recipe.name;
    const itemCategory = item?.category || "parchemins";
    if (isEquipment) {
      // REFONTE ITEMS v5 : 1 seul exemplaire (équipé OU inventaire, dura=0 inclus car réparable)
      const inInv = (profile.inventory || []).some(i => i.item_key === recipe.outputKey);
      const inEq = Object.values(profile.equipment || {}).some(s => s && s.item_key === recipe.outputKey);
      if (inInv || inEq) {
        const repairKey = recipe.outputKey === "epee" ? "pierre" : "laine_brute";
        const repairName = ITEMS[repairKey]?.name || repairKey;
        toast.error(`Vous possédez déjà un(e) ${item.name}. S'il/elle est brisé(e), réparez-le/la avec une ${repairName} (onglet Combat).`);
        setProducing(null);
        return;
      }
      newInventory.push({ item_key: recipe.outputKey, item_name: item.name, item_category: item.category, quantity: 1, grade: 0, durability: EQUIPMENT_DURABILITY[recipe.outputKey] ?? EQUIPMENT_MAX_DURABILITY });
    } else {
      const existingIdx = newInventory.findIndex(i => i.item_key === recipe.outputKey || i.item_name === itemName);
      if (existingIdx >= 0) {
        newInventory[existingIdx] = { ...newInventory[existingIdx], quantity: newInventory[existingIdx].quantity + totalQty };
      } else {
        newInventory.push({ item_key: recipe.outputKey, item_name: itemName, item_category: itemCategory, quantity: totalQty });
      }
    }

    const newCooldowns = { ...(profile.production_cooldowns || {}), [recipe.id]: new Date().toISOString() };
    const recipeTier = recipe.tier || (ITEMS[recipe.outputKey]?.tier) || 1;
    const baseCost = TIER_ACTION_COST?.[recipeTier] || 1;
    // REFONTE : moulin/laboratoire ne réduisent plus le coût d'action.
    // Seule l'Église conserve son effet "1 action sur 2 gratuite".
    // REFONTE église : 10% de chance que cette action ne consomme rien (au lieu de 1/2 actions).
    const egliseSkip = buildingBonuses.eglise && Math.random() < 0.10;
    const reduction = egliseSkip ? 1 : 0;
    const actionCost = Math.max(0, baseCost - reduction);

    // Système unifié : tirage aléatoire faim/énergie via applyRandomActionCost
    const costResult = applyRandomActionCost({ ...profile, hunger: currentHunger, fatigue: currentFatigue }, actionCost, { cityFatigueBonus, cityHungerBonus });
    if (!costResult.ok) {
      toast.error(costResult.errorMessage);
      return;
    }
    const newFatigue = costResult.newFatigue;
    const newHunger  = costResult.newHunger;
    setLocalFatigue(newFatigue);
    setLocalHunger(newHunger);

    let newToolCharges = profile.tool_charges || 0;
    if (newToolCharges > 0) newToolCharges = newToolCharges - 1;

    let updatedInventory = newInventory;
    if (newToolCharges === 0) {
      const toolIdx = newInventory.findIndex(i => i.item_key === "outils" || i.item_name === "Outils");
      if (toolIdx >= 0 && newInventory[toolIdx].quantity > 0) {
        updatedInventory = newInventory.map((it, idx) =>
          idx === toolIdx ? { ...it, quantity: it.quantity - 1 } : it
        ).filter(i => i.quantity > 0);
        newToolCharges = TOOL_CHARGES_PER_SET;
      }
    }

    // ── Gain XP : +1 XP par récolte T1 sur biome ──
    const xpGain = grantXP(profile, XP_REWARDS.HARVEST_T1);

    await base44.entities.PlayerProfile.update(profile.id, {
      inventory: updatedInventory,
      production_cooldowns: newCooldowns,
        // biome_harvest_bonus_expires_at expire tout seul : pas besoin de décrémenter
      fatigue: newFatigue,
      tool_charges: newToolCharges,
      hunger: newHunger,
      ...(newHunger < (profile.hunger ?? 10) ? { hunger_regen_at: new Date().toISOString() } : {}),
      ...(newFatigue < (profile.fatigue ?? 80) ? { fatigue_regen_at: new Date().toISOString() } : {}),
      ...xpGain.updates,
    });
    // ── Mise à jour des objectifs produce via checkAndAwardObjective ──
    for (const obj of filterTodayActiveObjectives(objectives, "produce")) {
      const recTier = ITEMS[recipe.outputKey]?.tier || 1;
      const tierMatch = (obj.target_item === "any") ||
                        (obj.target_item === "any_t2" && recTier >= 2) ||
                        (obj.target_item === "any_t3" && recTier >= 3) ||
                        (obj.target_item === item?.category) ||
                        (obj.target_item === recipe.outputKey);
      if (!tierMatch) continue;
      const result = await checkAndAwardObjective({ obj, addedQty: totalQty, profile, city });
      if (result.completed) onRefresh?.();
    }

    const bonusDesc = [bonusQty > 0 ? `+${bonusQty} ville` : null, buildingQtyBonus > 0 ? `+${buildingQtyBonus} bâtiment` : null, biomeBonusQty > 0 ? `+${biomeBonusQty} biome ⭐` : null].filter(Boolean).join(", ");
    let msg = `✅ ${totalQty}× ${itemName} récoltés !${bonusDesc ? ` (${bonusDesc})` : ""}`;
    if (newHunger <= 0) msg += " 🍽️ Vous avez faim !";
    else if (newHunger < HUNGER_WARNING_THRESHOLD) msg += ` 🍽️ Faim : ${newHunger}/${getMaxHunger(profile, cityHungerBonus)} : mangez bientôt !`;
    toast.success(msg);
    // Toast XP
    showXPToast(XP_REWARDS.HARVEST_T1, xpGain, { context: "récolte" });
    setProducing(null);
    onRefresh?.();
    loadObjectives();
  };

  // ── NOUVEAU v3 (09/05/2026) - Obtenir l'outil d'artisan personnel (1ere fois, gratuit) ──
  // L'outil est materialise par 2 champs profile :
  //   - artisan_tool_obtained (bool) : a-t-il deja recupere son outil au moins une fois ?
  //   - artisan_tool_charges (number) : nombre de charges restantes (0-25)
  // Au premier clic : obtained = true, charges = 25. Le bouton disparait apres.
  // Cap fixe a 25 charges, surplus perdu lors des recharges (pierre_aiguiser/affutage_maitre).
  // 13/05/2026 — Cap abaisse de 50 a 25 pour creer de la tension de craft.
  const ARTISAN_TOOL_MAX_CHARGES = 25;
  const handleObtenirOutil = async () => {
    if (profile.artisan_tool_obtained) {
      toast("Vous possédez déjà votre outil d'artisan.");
      return;
    }
    try {
      await base44.entities.PlayerProfile.update(profile.id, {
        artisan_tool_obtained: true,
        artisan_tool_charges: ARTISAN_TOOL_MAX_CHARGES,
      });
      toast.success(`🔨 Vous avez obtenu votre Outil d'artisan ! ${ARTISAN_TOOL_MAX_CHARGES} charges disponibles.`);
      onRefresh?.();
    } catch (e) {
      console.error("[obtenirOutil]", e);
      toast.error("Erreur lors de l'obtention de l'outil.");
    }
  };

  const handleCraft = async (recipe) => {
    if (profile.is_traveling) { toast.error("🐴 Impossible de fabriquer pendant un voyage !"); return; }
    // NB : check faim/énergie effectué par applyRandomActionCost plus bas (avec toast).

    // ── Vérification équipement requis par tier (REFONTE ITEMS v5) ──
    // Nouveau pipeline : T3 = libre · T4 = Outil multifonction (epee_courte) · T5 = Outil multifonction renforcé (epee_longue)
    // L'ancienne check besace pour T4 a été retirée (la besace est maintenant un passif voyage).
    const outputTier = ITEMS[recipe.output.key]?.tier || 1;
    const equipInv = profile.inventory || [];

    // ── NOUVEAU v3 (09/05/2026) - Check outil d'artisan pour T2+ ──
    // Securite cote frontend : le filtre d'affichage masque deja les recettes T2+ si pas d'outil,
    // mais on double-check ici au cas ou (manipulation directe, race condition, etc).
    if (outputTier >= 2) {
      if (!profile.artisan_tool_obtained) {
        toast.error("🔨 Vous n'avez pas encore votre Outil d'artisan ! Cliquez sur 'Obtenir gratuitement' en haut de l'onglet Fabriquer.");
        return;
      }
      const charges = profile.artisan_tool_charges || 0;
      if (charges <= 0) {
        toast.error("🔨 Outil d'artisan vide ! Rechargez-le avec une Pierre à aiguiser (+15) ou un Affûtage de maître (+50).");
        return;
      }
    }

    if (outputTier >= 4) {
      const hasEpeeCourte = equipInv.some(i => i.item_key === "epee_courte" && (i.durability ?? 0) > 0);
      if (!hasEpeeCourte) { toast.error("🛠️ Un Outil multifonction (avec durabilité) est requis pour crafter du T4 !"); return; }
    }
    if (outputTier >= 5) {
      const hasEpeeLongue = equipInv.some(i => i.item_key === "epee_longue" && (i.durability ?? 0) > 0);
      if (!hasEpeeLongue) { toast.error("⚒️ Un Outil multifonction renforcé (avec durabilité) est requis pour crafter du T5 !"); return; }
    }

    const cooldownLeft = getCooldownLeft(recipe.id);
    if (cooldownLeft > 0) { toast.error(`⏳ Encore ${formatCooldown(cooldownLeft)} avant de pouvoir fabriquer.`); return; }

    // ── Check précoce faim/énergie (avant toute manipulation) ──
    // Évite que le joueur clique, voie son bouton "Fabrication...", et reçoive
    // une erreur en aval. On bloque dès l'entrée si pas assez de réserves.
    const earlyCraftTier = ITEMS[recipe.output?.key]?.tier || 1;
    const earlyCraftCost = TIER_ACTION_COST?.[earlyCraftTier] || 1;
    if (currentHunger + currentFatigue < earlyCraftCost) {
      toast.error(`💤 Pas assez d'énergie ni de faim pour ce craft (besoin de ${earlyCraftCost} points, vous avez ${currentHunger + currentFatigue}).`);
      return;
    }

    const inputWeight = recipe.inputs.reduce((s, i) => s + i.quantity, 0);
    const outputWeight = recipe.output.quantity;
    const netChange = outputWeight - inputWeight;
    if (netChange > 0 && wouldExceedCapacity(profile, netChange)) {
      toast.error(`📦 Inventaire plein ! (${currentWeight}/${maxWeight}) Vendez des items avant de fabriquer.`);
      return;
    }
    const inv = [...(profile.inventory || [])];
    for (const input of recipe.inputs) {
      const has = getInventoryQty(input.key);
      if (has < input.quantity) {
        const item = ITEMS[input.key];
        toast.error(`Il vous manque ${input.quantity}× ${item?.name || input.key}`);
        return;
      }
    }

    setCrafting(recipe.id);

    for (const input of recipe.inputs) {
      const itemDef = ITEMS[input.key];
      const idx = inv.findIndex(i =>
        i.item_key === input.key ||
        i.item_name === itemDef?.name ||
        i.item_name?.toLowerCase().replace(/ /g, "_") === input.key
      );
      inv[idx] = { ...inv[idx], quantity: inv[idx].quantity - input.quantity };
    }

    // REFONTE : la fonderie ne donne plus +20% de bonus au craft.
    const forgeBonusQty = 0;
    const cityProdBonus = getCityBonuses(city?.lingots_cumul || 0).cooldownReduction;
    const cityBonusQty = cityProdBonus > 0 ? Math.floor(recipe.output.quantity * cityProdBonus / 100) : 0;
    
    // ── Chance double production : tous les bonus additifs (REFONTE v5) ──
    const levelBonusesCraft = getPlayerLevelBonuses(profile?.player_level || 1);
    const doubleChanceLevelCraft  = levelBonusesCraft.doubleProductionBonus / 100;
    const biomeDoubleChanceCraft  = getBiomeDoubleProdChance(profile);
    const charbonBonusCraft = getPassiveCharbonDoubleProdBonus(profile);
    const doubleChanceCraft = doubleChanceLevelCraft + biomeDoubleChanceCraft + charbonBonusCraft;
    const doubleBonusCraft  = (!isNaN(doubleChanceCraft) && doubleChanceCraft > 0 && Math.random() < doubleChanceCraft)
      ? recipe.output.quantity : 0;
    const biomeBonusQty = 0; // absorbé dans doubleBonusCraft
    if (doubleBonusCraft > 0) {
      const sources = [
        doubleChanceLevelCraft  > 0 ? `rang ${profile?.player_level || 1}` : null,
        biomeDoubleChanceCraft  > 0 ? `biome` : null,
        charbonBonusCraft       > 0 ? `charbon` : null,
      ].filter(Boolean).join(" + ");
      setCoupDeMaitre({ qty: doubleBonusCraft, itemName: ITEMS[recipe.output.key]?.name || recipe.name, sources });
    }

    const totalQty = recipe.output.quantity + forgeBonusQty + cityBonusQty + doubleBonusCraft;

    const outItem = ITEMS[recipe.output.key];

    const isEquipmentCraft = EQUIPMENT_KEYS.includes(recipe.output.key);
    const isCraftBonusItem = !!(ITEMS[recipe.output.key]?.craft_tier_bonus);
    if (isEquipmentCraft && !isCraftBonusItem) {
      // REFONTE ITEMS v5 : 1 seul exemplaire (équipé OU inventaire, dura=0 inclus car réparable)
      const inInv = (profile.inventory || []).some(i => i.item_key === recipe.output.key);
      const inEq = Object.values(profile.equipment || {}).some(s => s && s.item_key === recipe.output.key);
      if (inInv || inEq) {
        const repairKey = recipe.output.key === "epee" ? "pierre" : "laine_brute";
        const repairName = ITEMS[repairKey]?.name || repairKey;
        toast.error(`Vous possédez déjà un(e) ${outItem?.name}. S'il/elle est brisé(e), réparez-le/la avec une ${repairName} (onglet Combat).`);
        setCrafting(null);
        return;
      }
      inv.push({ item_key: recipe.output.key, item_name: outItem.name, item_category: outItem.category, quantity: 1, grade: 0, durability: EQUIPMENT_DURABILITY[recipe.output.key] ?? EQUIPMENT_MAX_DURABILITY });
    } else if (isEquipmentCraft && isCraftBonusItem) {
      const newDurability = ITEMS[recipe.output.key]?.durability ?? 4;
      inv.push({ item_key: recipe.output.key, item_name: outItem.name, item_category: outItem.category, quantity: 1, durability: newDurability });
    } else {
      const existingOut = inv.find(i => i.item_key === recipe.output.key || i.item_name === outItem.name);
      if (existingOut) existingOut.quantity += totalQty;
      else inv.push({ item_key: recipe.output.key, item_name: outItem.name, item_category: outItem.category, quantity: totalQty });
    }

    const cleanInv = inv.filter(i => i.quantity > 0);
    const craftTier = ITEMS[recipe.output?.key]?.tier || 1;

    // ── REFONTE v5 : Outils T4 : bonus T3 aléatoire à chaque craft T4 ──
    // Si l'output est T4 et que le joueur a des Outils 🔧 avec durabilité > 0,
    // on consomme 1 charge et on ajoute 1 T3 aléatoire à l'inventaire.
    // ── Hook chaudron : 🪄 Parchemin de craft : skip la consommation d'outil pour ce craft ──
    let outilsBonusT3 = null;
    let parcheminCraftUsed = false;
    if (craftTier === 4 && recipe.output.key !== "outils") {
      const outilsIdx = cleanInv.findIndex(i =>
        i.item_key === "outils" && (i.durability ?? 0) > 0
      );
      if (outilsIdx >= 0) {
        // Si le joueur a un Parchemin de craft actif, on skip la décrémentation
        if (profile.next_t4_no_tool) {
          parcheminCraftUsed = true;
          // L'outil n'est PAS consommé, mais on garde quand même le bonus T3
        } else {
          // Décrémenter la durabilité (4 charges max, défini dans craftingData)
          const newDura = (cleanInv[outilsIdx].durability ?? 4) - 1;
          cleanInv[outilsIdx] = newDura > 0
            ? { ...cleanInv[outilsIdx], durability: newDura }
            : null; // marqué pour suppression
        }
        // Choisir un T3 aléatoire dans la liste
        const T3_KEYS = Object.entries(ITEMS)
          .filter(([, v]) => v.tier === 3)
          .map(([k]) => k);
        const randomT3 = T3_KEYS[Math.floor(Math.random() * T3_KEYS.length)];
        const t3Item = ITEMS[randomT3];
        // Ajouter à l'inventaire (en respectant la logique craft_tool / equipment / consumable)
        const isT3Equipment = EQUIPMENT_KEYS.includes(randomT3);
        if (isT3Equipment) {
          cleanInv.push({
            item_key: randomT3, item_name: t3Item.name, item_category: t3Item.category,
            quantity: 1, durability: EQUIPMENT_DURABILITY[randomT3] ?? EQUIPMENT_MAX_DURABILITY
          });
        } else {
          const existingT3 = cleanInv.find(i => i && i.item_key === randomT3);
          if (existingT3) existingT3.quantity += 1;
          else cleanInv.push({ item_key: randomT3, item_name: t3Item.name, item_category: t3Item.category, quantity: 1 });
        }
        outilsBonusT3 = { name: t3Item.name, icon: t3Item.icon, broken: newDura <= 0 };
      }
    }
    // Filtrer les nullables (Outils consommé à 0 dura)
    const cleanInvFinal = cleanInv.filter(i => i && (i.quantity || 0) > 0);

    // ── Bonus Encre : si pending_t2_to_t1_bonus actif et qu'on craft un T2,
    //    on ajoute 1× le 1er input T1 du recipe, et on consomme le flag.
    let encreBonusConsumed = false;
    if (profile.pending_t2_to_t1_bonus && craftTier === 2) {
      const firstT1Input = recipe.inputs.find(inp => (ITEMS[inp.key]?.tier || 1) === 1);
      if (firstT1Input) {
        const t1Item = ITEMS[firstT1Input.key];
        const existing = cleanInvFinal.find(i => i.item_key === firstT1Input.key || i.item_name === t1Item?.name);
        if (existing) existing.quantity += 1;
        else cleanInvFinal.push({ item_key: firstT1Input.key, item_name: t1Item.name, item_category: t1Item.category, quantity: 1 });
        encreBonusConsumed = true;
      }
    }

    const baseCraftCost = TIER_ACTION_COST?.[craftTier] || 1;
    // REFONTE : moulin/laboratoire ne réduisent plus le coût d'action. Seule l'Église conserve son effet.
    // REFONTE église : 10% de chance que cette action ne consomme rien.
    const egliseSkipCraft = buildingBonuses.eglise && Math.random() < 0.10;
    const reductionCraft = egliseSkipCraft ? 1 : 0;
    const craftActionCost = Math.max(0, baseCraftCost - reductionCraft);

    const craftCostResult = applyRandomActionCost(
      { ...profile, hunger: currentHunger, fatigue: currentFatigue },
      craftActionCost,
      { cityFatigueBonus, cityHungerBonus }
    );
    if (!craftCostResult.ok) {
      toast.error(craftCostResult.errorMessage);
      return;
    }
    const newFatigue = craftCostResult.newFatigue;
    const newHunger  = craftCostResult.newHunger;
    setLocalFatigue(newFatigue);
    setLocalHunger(newHunger);

    let newToolCharges = profile.tool_charges || 0;
    let finalInv = cleanInvFinal;
    if (recipe.output.key === "outils" && newToolCharges === 0) {
      const outIdx = finalInv.findIndex(i => i.item_key === "outils" || i.item_name === "Outils");
      if (outIdx >= 0 && finalInv[outIdx].quantity > 0) {
        finalInv = finalInv.map((it, idx) =>
          idx === outIdx ? { ...it, quantity: it.quantity - 1 } : it
        ).filter(i => i.quantity > 0);
        newToolCharges = TOOL_CHARGES_PER_SET;
        toast(`🔧 Outils chargés ! ${TOOL_CHARGES_PER_SET} charges disponibles.`);
      }
    }

    // REFONTE ITEMS v5 : initialise bourse_uses_left = 5 si on craft la 1ère bourse
    // (si le joueur en a déjà une avec un compteur en cours, on ne touche pas : la nouvelle stack)
    const isCraftingBourse = recipe.output.key === "bourse_protection";
    const hadBourseBeforeCraft = (profile.inventory || []).some(
      i => i.item_key === "bourse_protection" && (i.quantity || 0) > 0
    );
    const bourseInitUpdate = (isCraftingBourse && !hadBourseBeforeCraft)
      ? { bourse_uses_left: 5 }
      : {};

    // ── Gain XP : +X selon tier crafté (T2=2, T3=3, T4=5, T5=8, T1=0) ──
    const craftedTier = ITEMS[recipe.output.key]?.tier || recipe.tier || 1;
    const craftXP = getCraftXPReward(craftedTier);
    const xpGain = craftXP > 0 ? grantXP(profile, craftXP) : null;

    // ── NOUVEAU v3 (09/05/2026) - Decrement -1 charge d'outil d'artisan pour tout craft T2+ ──
    const artisanToolUpdate = (craftedTier >= 2 && profile.artisan_tool_obtained)
      ? { artisan_tool_charges: Math.max(0, (profile.artisan_tool_charges || 0) - 1) }
      : {};

    await base44.entities.PlayerProfile.update(profile.id, {
      inventory: finalInv,
      fatigue: newFatigue,
      tool_charges: newToolCharges,
      hunger: newHunger,
      ...(newHunger < (profile.hunger ?? 10) ? { hunger_regen_at: new Date().toISOString() } : {}),
      ...(newFatigue < (profile.fatigue ?? 80) ? { fatigue_regen_at: new Date().toISOString() } : {}),
      production_cooldowns: { ...(profile.production_cooldowns || {}), [recipe.id]: new Date().toISOString() },
      ...(encreBonusConsumed ? { pending_t2_to_t1_bonus: false } : {}),
      ...(parcheminCraftUsed ? { next_t4_no_tool: false } : {}),
      ...bourseInitUpdate,
      ...(xpGain?.updates || {}),
      ...artisanToolUpdate,
    });

    if (parcheminCraftUsed) {
      toast.success(`🪄 Parchemin de craft consommé : votre outil est préservé !`);
    }

    if (encreBonusConsumed) {
      const t1Input = recipe.inputs.find(inp => (ITEMS[inp.key]?.tier || 1) === 1);
      if (t1Input) {
        toast.success(`🖋️ Encre : +1 ${ITEMS[t1Input.key]?.name} bonus !`, { duration: 4000 });
      }
    }

    const bonusDesc = [
      forgeBonusQty   > 0 ? `+${forgeBonusQty} Forge`       : null,
      cityBonusQty    > 0 ? `+${cityBonusQty} ville`        : null,
      biomeBonusQty   > 0 ? `+${biomeBonusQty} biome ⭐`    : null,
      doubleBonusCraft > 0 ? `+${doubleBonusCraft} 🎲 double` : null,
    ].filter(Boolean).join(", ");
    if (bonusDesc) toast.success(`⚒️ ${totalQty}× ${outItem.name} fabriqués (${bonusDesc}) !`);
    else toast.success(`⚒️ ${totalQty}× ${outItem.name} fabriqués !`);

    // Toast XP
    if (xpGain) {
      showXPToast(craftXP, xpGain, { context: "fabrication" });
    }

    // ── REFONTE v5 : toast bonus T3 aléa des Outils 🔧 ──
    if (outilsBonusT3) {
      toast.success(`🔧 Vos Outils vous offrent +1 ${outilsBonusT3.icon} ${outilsBonusT3.name} en bonus !`);
      if (outilsBonusT3.broken) {
        toast(`🔧 Vos Outils se sont brisés après leur dernière charge !`);
      }
    }

    if (newHunger <= 0) toast.warning("🍽️ Vous avez faim ! Mangez avant de continuer.");
    else if (newHunger < HUNGER_WARNING_THRESHOLD) toast(`🍽️ Faim : ${newHunger}/${getMaxHunger(profile, cityHungerBonus)} : mangez bientôt !`);

    // ── Mise à jour des objectifs produce via checkAndAwardObjective ──
    for (const obj of filterTodayActiveObjectives(objectives, "produce")) {
      const craftTierObj = ITEMS[recipe.output?.key]?.tier || 1;
      const tierMatch = (obj.target_item === "any") ||
                        (obj.target_item === "any_t2" && craftTierObj >= 2) ||
                        (obj.target_item === "any_t3" && craftTierObj >= 3) ||
                        (obj.target_item === recipe.output?.key);
      if (!tierMatch) continue;
      const result = await checkAndAwardObjective({ obj, addedQty: totalQty, profile, city });
      if (result.completed) onRefresh?.();
    }

    setCrafting(null);
    onRefresh?.();
    loadObjectives();
  };

  // Wrapper local : passe l'inventaire courant à l'helper centralisé.
  // Voir src/lib/inventoryHelpers.js pour l'implémentation et la gestion legacy.
  const getInventoryQty = (itemKey) => getInvQty(profile?.inventory, itemKey);

  const canCraft = (recipe) => recipe.inputs.every(inp => getInventoryQty(inp.key) >= inp.quantity);

  if (!profile) return null;
  const prof = PROFESSIONS[profile.profession];

  const maxHungerVal = getMaxHunger(profile, cityHungerBonus);

  // Items de faim disponibles dans l'inventaire
  const hungerFoodAvailable = Object.entries(HUNGER_FOOD_ITEMS).filter(([key, def]) =>
    (profile.inventory || []).some(i => (i.item_key === key || i.item_name === def.label) && i.quantity > 0)
  );

  const hungryBlocked = currentHunger <= 0;
  const hungerPenalty = currentHunger > 0 && currentHunger < HUNGER_WARNING_THRESHOLD;

  // Bloquer si joueur en biome
  if (profile && !profile.is_traveling && profile.travel_destination_id?.startsWith("biome:")) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <span className="text-5xl">⛺</span>
        <h2 className="font-heading text-xl font-semibold">Vous êtes dans un biome</h2>
        <p className="text-muted-foreground font-body text-sm max-w-xs">
          La production n'est pas accessible depuis un biome. Vos ateliers sont en ville.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* PlayerStatusBar retiré (10/05/2026) — globale dans GameLayout */}
      {/* <PlayerStatusBar profile={profile} homeCity={homeCity} city={city} onRefresh={onRefresh} /> */}
      <div>
        <h2 className="font-heading text-2xl font-bold mb-1 heading-medieval">{prof?.icon} Production : {profile.profession}</h2>
        <p className="text-muted-foreground font-body text-sm">Récoltez des ressources brutes, puis transformez-les en objets de valeur.</p>
      </div>

      {/* Section Actions rapides : pas de duplication des jauges ni des boutons Manger (déjà dans PlayerStatusBar)
          On garde ici uniquement les actions contextuelles à la production :
          - Sceau royal actif
          - Outils & avertissement T1 si bloqué */}
      {(() => {
        const showSceau = (profile.sceau_balance || 0) > 0;
        const showT1Warning = hungryBlocked;
        // 11/05/2026 : showToolsWarning retiré. Plus de pénalité de cooldown
        // quand l'outil est à 0, donc plus d'avertissement à afficher.

        if (!showSceau && !showT1Warning) {
          return null;
        }

        return (
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
            {/* Avertissement T1 si faim à 0 */}
            {showT1Warning && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 text-xs font-body text-orange-800">
                ⚠️ Faim à 0 : l'énergie sera utilisée. Coût action T1 : <strong>{getRecipeCost(1)} ⚡/🍽️ aléatoire</strong>
                {getRecipeCost(2) !== getRecipeCost(1) && <span className="font-normal ml-1">(T2: {getRecipeCost(2)} · T3: {getRecipeCost(3)})</span>}
              </div>
            )}

            {/* 11/05/2026 : bloc "🔧 Outils épuisés" retiré (mécanique de
                pénalité supprimée). L'outil d'artisan continue d'exister mais
                sans malus quand il est à 0. */}

            {/* Sceau royal actif */}
            {showSceau && (
              <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-body border border-amber-300 bg-amber-50">
                <div className="flex items-center gap-2">
                  <span>🏵️</span>
                  <span className="font-semibold text-amber-900">Sceau royal actif</span>
                  <HelpTooltip text="Le Sceau royal absorbe automatiquement vos taxes marché et impôts journaliers jusqu'à épuisement du solde." />
                </div>
                <span className="font-bold text-amber-800">{profile.sceau_balance}💰 restants</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── ITEMS PVP ACTIVABLES ── */}
      {(() => {
        const hasTracts = (profile.inventory || []).some(i => i.item_key === "tracts_greve" && i.quantity > 0);
        const hasCamo   = (profile.inventory || []).some(i => i.item_key === "camouflage" && i.quantity > 0);
        const camo_qty  = (profile.inventory || []).find(i => i.item_key === "camouflage")?.quantity || 0;
        const tractsActive = city?.production_malus?.tracts_greve_active_until && new Date(city.production_malus.tracts_greve_active_until) > new Date();

        if (!hasTracts && !hasCamo) return null;

        return (
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader>
              <CardTitle className="font-heading text-sm flex items-center gap-2">⚔️ Items PvP en main</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">

              {/* Camouflage */}
              {hasCamo && (
                <ItemTooltip itemKey="camouflage">
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg cursor-help">
                    <div className="flex items-center gap-2">
                      <span>👻 Camouflage</span>
                      <Badge variant="outline" className="text-xs">×{camo_qty}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground font-body">Auto au prochain vol</span>
                  </div>
                </ItemTooltip>
              )}

              {/* Tracts de Grève */}
              {hasTracts && (
                <ItemTooltip itemKey="tracts_greve">
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 cursor-help">
                      <span>⚡ Tracts de Grève</span>
                      {tractsActive && <Badge variant="secondary" className="text-xs">Actif</Badge>}
                    </div>
                    <Button size="sm" variant={tractsActive ? "secondary" : "outline"} className="text-xs font-heading"
                      disabled={tractsActive}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const tomorrow = new Date(new Date().getTime() + 24 * 3600000).toISOString();
                        await base44.entities.City.update(city.id, {
                          production_malus: { ...city.production_malus, tracts_greve_active_until: tomorrow },
                        });
                        const newInv = (profile.inventory || []).map(i => i.item_key === "tracts_greve" ? {...i, quantity: i.quantity - 1} : i).filter(i => i.quantity > 0);
                        await base44.entities.PlayerProfile.update(profile.id, { inventory: newInv });
                        toast.success("⚡ Tracts de Grève activés ! Cooldowns +20% pour toute la ville pendant 24h.");
                        onRefresh?.();
                      }}>
                      {tractsActive ? "Actif (1j)" : "Activer ici"}
                    </Button>
                  </div>
                </ItemTooltip>
              )}



            </CardContent>
          </Card>
        );
      })()}
      <Tabs defaultValue={defaultTab}>
        <TabsList className="font-heading">
          <TabsTrigger value="farm">🌾 Récolter</TabsTrigger>
          <TabsTrigger value="craft">⚒️ Fabriquer</TabsTrigger>
          <TabsTrigger value="atelier">🏪 Mon atelier</TabsTrigger>
        </TabsList>

        <TabsContent value="farm" className="mt-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-muted-foreground font-body">Récoltez des ressources T1 propres à votre métier.</p>
            <HelpTooltip text="Récoltez vos ressources T1 : blé ×2, herbes ×2, tous les autres ×1 par action. Chaque T1 a un effet consommable ou passif en inventaire. Vos bonus de rang et buff biome s'appliquent ici." />
          </div>
          {farmRecipes.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground font-body">Votre métier ne permet pas de récolter directement. Achetez des matières premières sur le marché.</CardContent></Card>
          ) : (
            farmRecipes.map(recipe => {
              const cooldown = getCooldownLeft(recipe.id);
              const ready = cooldown <= 0;
              const item = ITEMS[recipe.outputKey];
              const reqsMet = !recipe.requiresItems || recipe.requiresItems.every(req => getInventoryQty(req.key) >= req.quantity);
              const farmCost = TIER_ACTION_COST?.[recipe.tier || 1] || 1;
              const blocked = (currentHunger + currentFatigue) < farmCost;
              const buildingRequired = recipe.requiresBuilding
                ? !(cityBuildings || []).some(b => b.building_type === recipe.requiresBuilding)
                : false;
              return (
                <Card key={recipe.id} className={ready && reqsMet && !blocked ? "border-primary/30" : "opacity-70"}>
                  <CardContent className="p-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4 flex-1">
                      <span className="text-3xl">{recipe.icon}</span>
                      <div className="flex-1">
                        <ItemTooltip itemKey={recipe.outputKey} side="top">
                          <div className="font-heading font-semibold cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2">{recipe.name}</div>
                        </ItemTooltip>
                        <div className="text-xs text-muted-foreground font-body">
                          Produit ×{recipe.quantity} {item?.name} · coût {getRecipeCost(recipe.tier || 1)} ⚡/🍽️
                        </div>
                        {recipe.requiresItems && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {recipe.requiresItems.map(req => {
                              const has = getInventoryQty(req.key);
                              const ok = has >= req.quantity;
                              return (
                                <ItemTooltip key={req.key} itemKey={req.key} side="top">
                                  <span className={`text-xs px-1.5 py-0.5 rounded border font-body cursor-help ${ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                                    {ITEMS[req.key]?.icon} ×{req.quantity} ({has})
                                  </span>
                                </ItemTooltip>
                              );
                            })}
                          </div>
                        )}
                        {!ready && <Progress value={100 - (cooldown / recipe.cooldown) * 100} className="h-1.5 mt-1.5" />}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {ready && reqsMet && !blocked
                        ? <Badge className="bg-green-100 text-green-800">Prêt</Badge>
                        : <Badge variant="secondary">{blocked ? "💤 Pas d'énergie" : !ready ? formatCooldown(cooldown) : "Ingrédients"}</Badge>
                      }
                      <Button size="sm" className="font-heading" onClick={() => handleFarm(recipe)}
                        disabled={!ready || !reqsMet || producing === recipe.id || blocked}>
                        {producing === recipe.id ? "..." : "Récolter"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="craft" className="mt-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-xs text-muted-foreground font-body">Transformez vos ressources en objets de valeur.</p>
            <HelpTooltip text="Le craft transforme des matières premières en items de tier supérieur (T2-T5). ⚠️ Le T3 est libre. Pour crafter du T4 il vous faut un Outil multifonction (T3) en inventaire avec de la durabilité. Pour le T5, un Outil multifonction renforcé (T4) est requis. Ces outils s'usent à chaque craft." />
          </div>
          {(() => {
            const inv = profile?.inventory || [];
            const hasEpeeCourte = inv.some(i => i.item_key === "epee_courte" && (i.durability ?? 0) > 0);
            const hasEpeeLongue = inv.some(i => i.item_key === "epee_longue" && (i.durability ?? 0) > 0);
            if (hasEpeeCourte && hasEpeeLongue) return null;
            return (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs font-body text-orange-800 mb-2 space-y-1">
                <p className="font-semibold">⚠️ Équipement requis pour crafter :</p>
                {!hasEpeeCourte && <p>• 🛠️ <strong>Outil multifonction</strong> (avec durabilité) : nécessaire pour crafter les <strong>T4</strong></p>}
                {!hasEpeeLongue && <p>• ⚒️ <strong>Outil multifonction renforcé</strong> (avec durabilité) : nécessaire pour crafter les <strong>T5</strong></p>}
                <p className="text-orange-600 italic">Ces outils sont craftés par le Forgeron.</p>
              </div>
            );
          })()}

          {/* Recettes PvP T1.5 quotidiennes */}
          <div className="mt-4">
            <h4 className="font-heading text-sm font-semibold mb-2 text-accent">⚔️ Items PvP (Inputs quotidiens aléatoires)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {getTodayPvpRecipes().filter(recipe => recipe.profession === profile?.profession).map(recipe => {
                const possible = canCraft(recipe);
                const outItem = ITEMS[recipe.output.key];
                const pvpCraftCost = TIER_ACTION_COST?.[1] || 1; // T1.5 = coût T1
                const blocked = (currentHunger + currentFatigue) < pvpCraftCost;
                return (
                  <Card key={recipe.id} className={possible && !blocked ? "border-accent/30 bg-accent/5" : "opacity-60"}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{recipe.icon}</span>
                          <div>
                            <ItemTooltip recipe={recipe} side="top">
                              <div className="font-heading font-semibold text-sm cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2">{recipe.name}</div>
                            </ItemTooltip>
                            <div className="text-xs text-muted-foreground font-body">→ ×{recipe.output.quantity} · {getRecipeCost(1)} ⚡/🍽️</div>
                          </div>
                        </div>
                        <Badge className="bg-accent text-accent-foreground text-xs">T1.5 PvP</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {recipe.inputs.map(inp => {
                          const inItem = ITEMS[inp.key];
                          const has = getInventoryQty(inp.key);
                          const ok = has >= inp.quantity;
                          return (
                            <ItemTooltip key={inp.key} itemKey={inp.key} side="top">
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-body cursor-help ${ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                                {inItem?.icon} ×{inp.quantity} ({has} dispo)
                              </span>
                            </ItemTooltip>
                          );
                        })}
                      </div>
                      <Button size="sm" className="w-full font-heading bg-accent hover:bg-accent/90" onClick={() => handleCraft(recipe)}
                        disabled={!possible || crafting === recipe.id || blocked}>
                        {crafting === recipe.id ? "Fabrication..." : blocked ? "💤 Pas assez d'énergie" : possible ? "Fabriquer" : "Ressources manquantes"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Recettes standard T2-T5 */}
          <div className="mt-4">
            {/* NOUVEAU v3 (09/05/2026) - Outil d'artisan : badge si possede, carte d'invitation sinon */}
            {profile.artisan_tool_obtained ? (() => {
              // Detection des items de recharge en inventaire (pour boutons rapides)
              const inv = profile.inventory || [];
              const pierreAiguiserQty = inv.find(i => i.item_key === "pierre_aiguiser")?.quantity || 0;
              const affutageMaitreQty = inv.find(i => i.item_key === "affutage_maitre")?.quantity || 0;
              const charges = profile.artisan_tool_charges || 0;
              const atMax = charges >= ARTISAN_TOOL_MAX_CHARGES;
              return (
                <div className={`mb-3 px-3 py-2 rounded text-sm flex items-center justify-between gap-2 flex-wrap ${
                  charges <= 0
                    ? "bg-red-50 border border-red-200 text-red-800"
                    : charges <= 5
                      ? "bg-amber-50 border border-amber-200 text-amber-800"
                      : "bg-emerald-50 border border-emerald-200 text-emerald-800"
                }`}>
                  <span className="flex items-center gap-1.5">
                    🔨 <span className="font-semibold">Outil d'artisan :</span>
                    <HelpTooltip text="Votre outil d'artisan personnel est consommé à chaque craft T2 ou supérieur (-1 charge par craft, quel que soit le tier). Si l'outil est vide (0 charge), les crafts T2+ sont BLOQUÉS — vous devez le recharger avant de pouvoir continuer. Les récoltes T1 et les crafts du chaudron magique restent disponibles. Rechargez avec une Pierre à aiguiser (+15 charges) ou un Affûtage de maître (+50 charges), dans la limite de 50 charges maximum." />
                    <span className="font-bold">{charges} / {ARTISAN_TOOL_MAX_CHARGES} charges</span>
                    {charges <= 0 && (
                      <span className="text-xs italic ml-2">Crafts T2+ bloqués — rechargez avec une Pierre à aiguiser ou un Affûtage de maître</span>
                    )}
                  </span>
                  {/* Boutons rapides de recharge (si item dispo et pas au max) */}
                  {!atMax && (pierreAiguiserQty > 0 || affutageMaitreQty > 0) && (
                    <span className="flex items-center gap-1.5 flex-wrap">
                      {pierreAiguiserQty > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2 bg-white"
                          disabled={crafting === "consume_pierre_aiguiser"}
                          onClick={() => handleConsumeTempEffect({ ...ITEMS["pierre_aiguiser"], key: "pierre_aiguiser" })}
                          title={`Consommer 1 Pierre à aiguiser (+5 charges, cap ${ARTISAN_TOOL_MAX_CHARGES})`}
                        >
                          🪨 Pierre à aiguiser ×{pierreAiguiserQty} (+5)
                        </Button>
                      )}
                      {affutageMaitreQty > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2 bg-white"
                          disabled={crafting === "consume_affutage_maitre"}
                          onClick={() => handleConsumeTempEffect({ ...ITEMS["affutage_maitre"], key: "affutage_maitre" })}
                          title={`Consommer 1 Affûtage de maître (+20 charges, cap ${ARTISAN_TOOL_MAX_CHARGES})`}
                        >
                          ⚙️ Affûtage de maître ×{affutageMaitreQty} (+20)
                        </Button>
                      )}
                    </span>
                  )}
                </div>
              );
            })() : (
              <Card className="mb-3 border-2 border-dashed border-amber-400 bg-amber-50">
                <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-3xl">🔨</span>
                    <div className="min-w-0">
                      <div className="font-heading font-semibold text-amber-900">Obtenez votre Outil d'artisan</div>
                      <div className="text-xs text-amber-800 font-body">Outil personnel gratuit. Indispensable pour fabriquer du T2 et T3. 50 charges au départ, rechargeable.</div>
                    </div>
                  </div>
                  <Button
                    onClick={handleObtenirOutil}
                    className="bg-amber-700 hover:bg-amber-800 text-white font-heading shrink-0"
                  >
                    🔨 Obtenir gratuitement
                  </Button>
                </CardContent>
              </Card>
            )}
            <h4 className="font-heading text-sm font-semibold mb-2">⚒️ Recettes standard (T2-T3)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* TEMP MASQUAGE T4/T5 (09/05/2026) - Restaurer en retirant le filtre tier <= 3 quand le joueur Lucas le demandera. Les recettes T4/T5 existent toujours dans CRAFTING_RECIPES, juste cachees a l affichage. */}
              {/* NOUVEAU v3 (09/05/2026) - Filtre outil d'artisan : si pas obtenu ou charges <= 0, on cache toutes les recettes T2+ */}
              {CRAFTING_RECIPES.filter(recipe => {
                const recipeTier = recipe.tier || 1;
                if (!recipe.profession || recipe.profession === profile?.profession) {
                  // Filtre profession OK
                } else {
                  return false;
                }
                if (recipeTier > 3) return false; // TEMP MASQUAGE T4/T5
                if (recipeTier >= 2) {
                  // Outil d'artisan requis pour T2+
                  if (!profile.artisan_tool_obtained) return false;
                  if ((profile.artisan_tool_charges || 0) <= 0) return false;
                }
                return true;
              }).map(recipe => {
                const possible = canCraft(recipe);
                const outItem = ITEMS[recipe.output.key];
                const recipeCraftCost = TIER_ACTION_COST?.[outItem?.tier || 1] || 1;
                const blocked = (currentHunger + currentFatigue) < recipeCraftCost;
                const buildingRequired = recipe.requiresBuilding
                  ? !(cityBuildings || []).some(b => b.building_type === recipe.requiresBuilding)
                  : false;
                const cooldown = getCooldownLeft(recipe.id);
                const ready = cooldown <= 0;
                return (
                  <Card key={recipe.id} className={possible && !blocked && !buildingRequired && ready ? "border-primary/20" : "opacity-60"}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{recipe.icon}</span>
                          <div>
                            <ItemTooltip itemKey={recipe.output.key} side="top">
                              <div className="font-heading font-semibold text-sm cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2">{recipe.name}</div>
                            </ItemTooltip>
                            <div className="text-xs text-muted-foreground font-body">→ ×{recipe.output.quantity} {outItem?.name} · {getRecipeCost(outItem?.tier || 1)} ⚡/🍽️</div>
                          </div>
                        </div>
                        <Badge variant={outItem?.tier === 3 ? "default" : "secondary"} className="text-xs">Tier {outItem?.tier}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {recipe.inputs.map(inp => {
                          const inItem = ITEMS[inp.key];
                          const has = getInventoryQty(inp.key);
                          const ok = has >= inp.quantity;
                          return (
                            <ItemTooltip key={inp.key} itemKey={inp.key} side="top">
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-body cursor-help ${ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
                                {inItem?.icon} ×{inp.quantity} ({has} dispo)
                              </span>
                            </ItemTooltip>
                          );
                        })}
                      </div>
                      {outItem?.tier === 3 && ITEM_EFFECTS[recipe.output.key] && (
                        <div className="text-xs text-muted-foreground font-body mb-2 bg-muted/40 rounded px-2 py-1">
                          ✨ {ITEM_EFFECTS[recipe.output.key].description}
                        </div>
                      )}
                      {!ready && <Progress value={100 - (cooldown / recipe.cooldown) * 100} className="h-1.5 mb-2" />}
                      <Button size="sm" className="w-full font-heading" onClick={() => handleCraft(recipe)}
                        disabled={!possible || crafting === recipe.id || blocked || !ready}>
                        {crafting === recipe.id ? "Fabrication..." : !ready ? formatCooldown(cooldown) : blocked ? "💤 Pas assez d'énergie" : possible ? "Fabriquer" : "Ressources manquantes"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="atelier" className="mt-4">
          <div className="space-y-4">
            <AtelierVitrine profile={profile} onRefresh={onRefresh} />
          </div>
        </TabsContent>
      </Tabs>





      {objectives.filter(o => o.parchemin_type).length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              📜 Contrats actifs
              <HelpTooltip text="Les contrats sont activés en utilisant un parchemin depuis votre inventaire. Ils sont indépendants des quêtes quotidiennes et offrent des récompenses plus élevées. Un parchemin consommé ne peut pas être récupéré. Vous ne pouvez avoir qu'un seul contrat actif par type de parchemin." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {objectives.filter(o => o.parchemin_type).map(obj => {
              const pct = Math.min(((obj.current_quantity || 0) / obj.target_quantity) * 100, 100);
              return (
                <div key={obj.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold font-body text-sm">{obj.title}</div>
                      <div className="text-xs text-amber-700 font-body">{obj.description}</div>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-body text-xs">+{obj.reward_gold}💰</Badge>
                  </div>
                  <div className="flex justify-between text-xs font-body mb-1">
                    <span>Progression</span><span>{obj.current_quantity || 0}/{obj.target_quantity}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    <GameModal
      show={!!coupDeMaitre}
      type="success"
      icon="⭐"
      title="Coup de Maître !"
      message={coupDeMaitre ? `+${coupDeMaitre.qty} ${coupDeMaitre.itemName} en bonus ! (${coupDeMaitre.sources})` : ""}
      onClose={() => setCoupDeMaitre(null)}
      duration={3500}
    />
    <GameModal
      show={travelingError}
      type="warning"
      icon="🐴"
      title="En déplacement"
      message="Vous ne pouvez pas produire pendant un voyage !"
      onClose={() => setTravelingError(false)}
      duration={3000}
    />

    {/* ── Modal de confirmation avant consommation/activation d'objet ── */}
    {confirmConsume && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-card border-2 border-primary/30 rounded-lg shadow-2xl max-w-sm w-full p-4 space-y-3">
          <h3 className="font-heading text-lg flex items-center gap-2">
            <span className="text-2xl">{confirmConsume.def?.icon || "❓"}</span>
            <span>Confirmer ?</span>
          </h3>
          <p className="text-sm font-body">
            {confirmConsume.type === "food" && <>Voulez-vous consommer <strong>{confirmConsume.def.name}</strong> ?<br /><span className="text-xs text-muted-foreground">+{confirmConsume.def.fatigue_restore}⚡ énergie</span></>}
            {confirmConsume.type === "eatForHunger" && <>Voulez-vous manger <strong>{confirmConsume.def.name}</strong> ?{confirmConsume.def.hunger_restore && <><br /><span className="text-xs text-muted-foreground">+{confirmConsume.def.hunger_restore}🍽️ faim</span></>}</>}
            {confirmConsume.type === "meuble" && <>Voulez-vous installer le <strong>Meuble</strong> dans votre logement ? <br /><span className="text-xs text-muted-foreground">Réduit les frais de logement de 50% pendant 10 jours.</span></>}
            {confirmConsume.type === "temp" && <>Voulez-vous activer <strong>{confirmConsume.def.label || confirmConsume.def.name}</strong> ?</>}
            {confirmConsume.type === "contrat" && <>Voulez-vous activer <strong>{confirmConsume.def.name}</strong> ?<br /><span className="text-xs text-muted-foreground">Cette action est irréversible.</span></>}
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setConfirmConsume(null)}
              className="text-sm font-heading px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={async () => {
                const c = confirmConsume;
                setConfirmConsume(null);
                if (c.type === "food") await handleConsumeFood(c.key);
                else if (c.type === "eatForHunger") await handleEatForHunger(c.key);
                else if (c.type === "meuble") await handleActivateMeuble();
                else if (c.type === "temp") await handleConsumeTempEffect(c.def);
                else if (c.type === "contrat") await handleActivateContrat(c.key);
              }}
              className="text-sm font-heading px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Confirmer
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Sprint 4C.2 : modales chaudron items à cible */}
    {targetModal && (
      <TargetCityModal
        open={!!targetModal}
        onClose={() => !targetSubmitting && setTargetModal(null)}
        onConfirm={handleConfirmTarget}
        itemIcon={targetModal.itemDef.icon}
        itemName={targetModal.itemDef.name}
        description={
          targetModal.type === "spy"
            ? "Choisissez la ville sur laquelle envoyer le hibou. Il vous rapportera un rapport complet : trésorerie, entrepôt et statut de protection."
            : `Choisissez la ville à voler. Vous dérobez ${targetModal.value}💰 à la trésorerie de la mairie. Si la ville est protégée par un dôme, votre item sera consommé sans effet.`
        }
        excludeCityId={profile?.home_city_id}
        hideTreasury={targetModal.type === "spy"}
        submitting={targetSubmitting}
      />
    )}
    {spyReport && (
      <SpyReportModal
        open={!!spyReport}
        onClose={() => setSpyReport(null)}
        report={spyReport}
      />
    )}
    {/* NOUVEAU v3 (09/05/2026) - Modale de répartition des points du Marteau d'armurier */}
    {repairModal && (
      <RepairGearModal
        itemDef={repairModal.itemDef}
        profile={profile}
        onClose={() => setRepairModal(null)}
        onConfirm={async (distribution) => {
          // Application : pour chaque slot, ajouter les points à la durabilité (cap 10)
          const newEquipment = { ...(profile.equipment || {}) };
          let totalApplied = 0;
          const detailLines = [];
          for (const [slotKey, points] of Object.entries(distribution)) {
            if (!points || points <= 0) continue;
            const eq = newEquipment[slotKey];
            if (!eq) continue;
            const curDura = eq.durability ?? EQUIPMENT_MAX_DURABILITY;
            const newDura = Math.min(EQUIPMENT_MAX_DURABILITY, curDura + points);
            const realApplied = newDura - curDura;
            if (realApplied <= 0) continue;
            newEquipment[slotKey] = { ...eq, durability: newDura };
            totalApplied += realApplied;
            const itemDef2 = ITEMS[eq.item_key];
            detailLines.push(`${itemDef2?.icon || ""} ${itemDef2?.name || eq.item_key} : ${curDura} → ${newDura}`);
          }

          // Décrémenter le marteau
          const itemDef = repairModal.itemDef;
          const newInv = (profile.inventory || [])
            .map(i => (i.item_key === itemDef.key || i.item_name === itemDef.name) ? { ...i, quantity: i.quantity - 1 } : i)
            .filter(i => i.quantity > 0);

          try {
            await base44.entities.PlayerProfile.update(profile.id, {
              inventory: newInv,
              equipment: newEquipment,
            });
            toast.success(
              `🔨 ${itemDef.name} consommé. +${totalApplied} dura répartis : ${detailLines.join(", ")}`
            );
            setRepairModal(null);
            onRefresh?.();
          } catch (e) {
            console.error("[repair_combat_gear]", e);
            toast.error("Erreur lors de la réparation.");
          }
        }}
      />
    )}
    </div>
  );
}
