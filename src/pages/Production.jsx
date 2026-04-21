import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlayerStatusBar from "../components/PlayerStatusBar";
import {
  PROFESSIONS, ITEM_CATEGORIES, getInventoryWeight, getMaxWeight, getMaxFatigue,
  wouldExceedCapacity, getCityBonuses, getCityTier, getPassiveCooldownBonus,
  MAX_HUNGER, HUNGER_WARNING_THRESHOLD, HUNGER_FOOD_ITEMS,
  EQUIPMENT_KEYS, EQUIPMENT_MAX_DURABILITY, EQUIPMENT_DURABILITY,
  FATIGUE_REGEN_INTERVAL_MS, getFatigueRegenInterval,
  TIER_ACTION_COST, PARCHEMIN_REWARDS,
} from "../lib/gameData";
import { getPriceMultiplier } from "../lib/pricingData";
import {
  PROFESSION_PRODUCTION, CRAFTING_RECIPES, ITEMS, ITEM_EFFECTS,
  FOOD_ITEMS_WITH_FATIGUE, TEMP_EFFECT_ITEMS, ACTION_FATIGUE_COST, TOOL_CHARGES_PER_SET,
  COOLDOWN_PENALTY_NO_TOOLS, computeFatigueWithDailyReset, getTodayStr,
} from "../lib/craftingData";
import { getTodayPvpRecipes } from "../lib/pvpRecipes";
import { OBJECTIVE_TEMPLATES, QUEST_TEMPLATES } from "../lib/objectiveGenerator";
import { checkAndAwardObjective, filterTodayActiveObjectives } from "@/lib/questRewards";
import { toast } from "sonner";
import ItemTooltip from "../components/ItemTooltip";
import HelpTooltip from "../components/HelpTooltip";
import AtelierVitrine from "../components/AtelierVitrine";
import { getPlayerLevelBonuses } from "../lib/playerLevelSystem";


async function logGold(playerEmail, playerName, cityId, cityName, amount, type, description) {
  try {
    await base44.entities.GoldTransaction.create({
      player_email: playerEmail, player_name: playerName || "",
      city_id: cityId || "", city_name: cityName || "",
      amount, type, description,
    });
  } catch (e) { console.warn("logGold:", e); }
}

export default function Production({ profile, city, homeCity, onRefresh }) {
  const [objectives, setObjectives] = useState([]);
  const [cityBuildings, setCityBuildings] = useState([]);
  const [priceMultiplier, setPriceMultiplier] = useState(1.0);

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
  const [crafting, setCrafting] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [consumingFood, setConsumingFood] = useState(null);
  const regenInProgress = useRef(false);
  const egliseActionCounter = useRef(0);

  const fonderieLevels = cityBuildings.filter(b => b.building_type === "fonderie").length;
  const hasCraftingBonus = fonderieLevels > 0;
  const fonderieCooldownReduction = fonderieLevels * 0.05; // 5% par niveau, max 25%
  const buildingBonuses = {
    scierie:     cityBuildings.some(b => b.building_type === "scierie"),
    mine:        cityBuildings.some(b => b.building_type === "mine"),
    moulin:      cityBuildings.some(b => b.building_type === "moulin"),
    bergerie:    cityBuildings.some(b => b.building_type === "bergerie"),
    laboratoire: cityBuildings.some(b => b.building_type === "laboratoire"),
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
  const effectiveMaxHunger = MAX_HUNGER + (buildingBonuses.universite ? 2 : 0);

  const [localFatigue, setLocalFatigue] = useState(null);
  const [localHunger, setLocalHunger] = useState(null);

  useEffect(() => {
    if (!profile) return;
    const maxFat = getMaxFatigue(profile);
    const fatigue = profile.fatigue ?? maxFat;
    setLocalFatigue(fatigue);
  }, [profile?.id, profile?.fatigue]);

  useEffect(() => {
    if (!profile) return;
    if (profile.hunger !== undefined && profile.hunger !== null) {
      setLocalHunger(profile.hunger);
    } else if (localHunger === null) {
      setLocalHunger(MAX_HUNGER);
      base44.entities.PlayerProfile.update(profile.id, { hunger: MAX_HUNGER });
    }
  }, [profile?.id, profile?.hunger]);


  // Regen faim via Fontaine : +2/h supplémentaires (regen passive de base : +1/h toujours active)
  useEffect(() => {
    if (!profile) return;
    if (!buildingBonuses.fontaine) return; // Fontaine requise pour regen passive
    if (regenInProgress.current) return;
    const hunger = localHunger ?? (profile.hunger ?? MAX_HUNGER);
    if (hunger >= MAX_HUNGER) return;
    const lastRegen = profile.hunger_regen_at ? new Date(profile.hunger_regen_at).getTime() : 0;
    if (Date.now() < lastRegen + 3600000) return; // 1h avec Fontaine

    regenInProgress.current = true;
    const regenAmount = 2; // Fontaine = +2/h
    const effMax = MAX_HUNGER + (buildingBonuses.universite ? 2 : 0);
    const newHunger = Math.min(effMax, hunger + regenAmount);
    setLocalHunger(newHunger);
    base44.entities.PlayerProfile.update(profile.id, {
      hunger: newHunger,
      hunger_regen_at: new Date().toISOString(),
    }).then(() => {
      regenInProgress.current = false;
      onRefresh?.();
    }).catch(() => { regenInProgress.current = false; });
  }, [profile?.id, now, buildingBonuses.fontaine]);

  const today = getTodayStr();
  const cathedraleFatigueBonus = buildingBonuses.cathedrale ? 10 : 0;
  const maxFatigue = getMaxFatigue(profile || {}, cathedraleFatigueBonus);
  const currentFatigue = localFatigue ?? computeFatigueWithDailyReset(profile || {}, maxFatigue).fatigue;
  const currentHunger = localHunger ?? (profile?.hunger ?? MAX_HUNGER);

  const currentWeight = getInventoryWeight(profile || {});
  const baseMaxWeight = getMaxWeight(profile || {});
  const maxWeight = baseMaxWeight + (buildingBonuses.bibliotheque ? 30 : 0) + (buildingBonuses.grande_place ? 20 : 0);
  const weightFull = currentWeight >= maxWeight;

  const actualFatigueCost = currentHunger < HUNGER_WARNING_THRESHOLD
    ? ACTION_FATIGUE_COST + 1
    : ACTION_FATIGUE_COST;

  // Coût réel affiché pour une recette (farm ou craft)
  const getRecipeCost = (tier, isFarm = false) => {
    const base = TIER_ACTION_COST?.[tier] || { hunger: 1, fatigue: 1 };
    const moulinFermier = buildingBonuses.moulin && profile?.profession === "Fermier";
    const laboAlchimiste = buildingBonuses.laboratoire && profile?.profession === "Alchimiste";
    const hungerPenalty = currentHunger < HUNGER_WARNING_THRESHOLD ? 1 : 0;
    const fat = Math.max(0, base.fatigue - (moulinFermier ? 1 : 0)) + hungerPenalty;
    const hun = Math.max(0, base.hunger - (laboAlchimiste ? 1 : 0));
    return { fatigue: fat, hunger: hun };
  };


  const handleEatForHunger = async (itemKey) => {
    const hungerDef = HUNGER_FOOD_ITEMS[itemKey];
    if (!hungerDef) return;
    if (currentHunger >= MAX_HUNGER) { toast("🍽️ Vous n'avez pas faim !"); return; }
    const invItem = (profile.inventory || []).find(i => i.item_key === itemKey || i.item_name === hungerDef.label);
    if (!invItem || invItem.quantity <= 0) { toast.error("Vous n'avez plus cet aliment !"); return; }
    setConsumingFood(itemKey + "_hunger");
    const newHunger = Math.min(MAX_HUNGER, currentHunger + hungerDef.hunger_restore);
    setLocalHunger(newHunger);
    const itemData = ITEMS[itemKey];
    const fatBonus = itemData?.fatigue_restore || 0;
    const newFatFromFood = fatBonus > 0 ? Math.min(maxFatigue, currentFatigue + fatBonus) : null;
    if (newFatFromFood !== null) setLocalFatigue(newFatFromFood);
    const newInventory = (profile.inventory || [])
      .map(i => (i.item_key === itemKey || i.item_name === hungerDef.label) ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0);
    const upd = { hunger: newHunger, inventory: newInventory };
    if (newFatFromFood !== null) { upd.fatigue = newFatFromFood; }
    await base44.entities.PlayerProfile.update(profile.id, upd);
    const bonusMsg = fatBonus > 0 ? ` +${fatBonus}⚡` : "";
    toast.success(`${hungerDef.icon} ${hungerDef.label} mangé ! +${hungerDef.hunger_restore}🍽️${bonusMsg}`);
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

    toast.success(`📜 Le contrat est signé ! ${def.title} — ${def.description} Récompense promise : ${def.reward_gold} 💰`);
    onRefresh?.();
  };

  // ── Prix de rachat mairie — uniquement le lingot royal (T5 Orfèvre) ──
  const LINGOT_ROYAL_PRICE = (city?.lingot_buy_prices?.lingot_royal) || 156;

  const handleSellLingotToMairie = async (itemKey, itemName) => {
    if (itemKey !== "lingot_royal") return; // seul le T5 est accepté
    if (profile.home_city_id !== city?.id) {
      toast.error("🏛️ Vous ne pouvez vendre vos lingots qu'à la mairie de votre ville d'origine.");
      return;
    }
    const price = LINGOT_ROYAL_PRICE;
    const treasury = city.gold_treasury || 0;
    const FONDS_MIN = 200;
    if (treasury - price < FONDS_MIN) {
      toast.error(`🏦 La trésorerie est insuffisante (fonds minimum : ${FONDS_MIN}💰 réservés).`);
      return;
    }
    const lingotInv = (profile.inventory || []).find(i => i.item_key === itemKey || i.item_name === itemName);
    if (!lingotInv || lingotInv.quantity <= 0) {
      toast.error("Vous n'avez pas ce lingot."); return;
    }
    const newInv = (profile.inventory || [])
      .map(i => (i.item_key === itemKey || i.item_name === lingotInv.item_name)
        ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0);

    await base44.entities.PlayerProfile.update(profile.id, {
      gold: (profile.gold || 0) + price,
      inventory: newInv,
    });

    // Stocker dans l'entrepôt + incrémenter lingots_cumul (prestige)
    const currentWarehouse = city.warehouse || {};
    const currentRoyalStock = currentWarehouse.lingot_royal || 0;
    const currentCumul = city.lingots_cumul || 0;
    await base44.entities.City.update(city.id, {
      gold_treasury:  Math.max(0, treasury - price),
      warehouse:      { ...currentWarehouse, lingot_royal: currentRoyalStock + 1 },
      lingots_stock:  currentRoyalStock + 1, // garde la compatibilité avec steal_treasury
      lingots_cumul:  currentCumul + 1,
    });

    try {
      await base44.entities.GoldTransaction.create({
        player_email: profile.user_email, player_name: profile.character_name || "",
        city_id: city?.id || "", city_name: city?.name || "",
        amount: price, type: "vente_lingot",
        description: `Vente lingot royal à la mairie (trésorerie −${price}💰)`,
      });
    } catch(e) {}
    toast.success(`👑 Le maire reçoit votre lingot royal avec faste ! +${price}💰. La cité compte désormais ${currentRoyalStock + 1} lingot(s) royal/aux.`);
    onRefresh?.();
  };


  const handleConsumeFood = async (foodKey) => {
    const foodDef = FOOD_ITEMS_WITH_FATIGUE.find(f => f.key === foodKey);
    if (!foodDef) return;
    const invItem = (profile.inventory || []).find(i => i.item_key === foodKey || i.item_name === foodDef.name);
    if (!invItem || invItem.quantity <= 0) { toast.error("Vous n'avez plus cet aliment !"); return; }

    // Potion d'endurance : effet selon profession
    if (foodKey === "potion_endur") {
      if (profile.profession === "Fermier") {
        // +2 faim pour le Fermier
        if (currentHunger >= MAX_HUNGER) { toast("🍽️ Vous n'avez pas faim !"); return; }
        setConsumingFood(foodKey);
        const newHunger = Math.min(MAX_HUNGER, currentHunger + 2);
        setLocalHunger(newHunger);
        const newInventory = (profile.inventory || [])
          .map(i => (i.item_key === foodKey || i.item_name === foodDef.name) ? { ...i, quantity: i.quantity - 1 } : i)
          .filter(i => i.quantity > 0);
        await base44.entities.PlayerProfile.update(profile.id, { hunger: newHunger, inventory: newInventory });
        toast.success(`💪 Potion d'endurance bue ! +2🍽️ faim (${newHunger}/${MAX_HUNGER})`);
        setConsumingFood(null);
        onRefresh?.();
        return;
      }
      // Sinon (Alchimiste et autres) : +20⚡ énergie
    }

    if (currentFatigue >= maxFatigue) { toast("⚡ Vous êtes déjà au maximum de votre énergie !"); return; }
    setConsumingFood(foodKey);
    const newFatigue = Math.min(maxFatigue, currentFatigue + foodDef.fatigue_restore);
    setLocalFatigue(newFatigue);
    const newInventory = (profile.inventory || [])
      .map(i => (i.item_key === foodKey || i.item_name === foodDef.name) ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0);
    const xpUpdates = { fatigue: newFatigue, inventory: newInventory };
    if (foodDef.xp_reward) {
      const freshPxp = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
      xpUpdates.player_xp_total = (freshPxp?.player_xp_total || 0) + foodDef.xp_reward;
    }
    // ── Buff biome harvest bonus pour les T1 fatigue_restore (herbes) ──
    const itemDefFatigue = ITEMS[foodKey];
    if (itemDefFatigue?.biome_profession && itemDefFatigue?.biome_key) {
      const biomeBuffActiveFat = profile.biome_cooldown_bonus_expires_at &&
        new Date(profile.biome_cooldown_bonus_expires_at) > new Date();
      if (biomeBuffActiveFat) {
        xpUpdates.biome_harvest_bonus_expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        toast(`🌿 Buff biome actif ! +1 récolte bonus sur ta prochaine production T1.`);
      }
    }
    await base44.entities.PlayerProfile.update(profile.id, xpUpdates);
    const xpMsg = foodDef.xp_reward ? ` · +${foodDef.xp_reward} XP` : "";
    toast.success(`${foodDef.icon} ${foodDef.name} consommé ! +${foodDef.fatigue_restore}⚡ énergie (${newFatigue}/${maxFatigue})${xpMsg}`);
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

    } else if (itemDef.effect === "attack_bonus") {
      updates.attack_bonus_expires_at = expiresAt;
      updates.attack_bonus_value = itemDef.value || 1;

    } else if (itemDef.effect === "defense_bonus") {
      updates.defense_bonus_expires_at = expiresAt;
      updates.defense_bonus_value = itemDef.value || 2;

    } else if (itemDef.effect === "double_prod_bonus") {
      // Charbon T2 : +10% chance double prod cumulable
      const currentBonus = profile.double_prod_bonus || 0;
      const addBonus = itemDef.value || 0.10;
      updates.double_prod_bonus = Math.min(0.80, currentBonus + addBonus); // plafond 80%
      updates.double_prod_bonus_expires_at = expiresAt;
      toast.success(`⬛ +${Math.round(addBonus * 100)}% chance double production 1h ! Total : ${Math.round(updates.double_prod_bonus * 100)}%`);
      if (itemDef.xp_reward) {
        const freshPxpC = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
        updates.player_xp_total = (freshPxpC?.player_xp_total || profile.player_xp_total || 0) + itemDef.xp_reward;
      }
      await base44.entities.PlayerProfile.update(profile.id, updates);
      onRefresh?.();
      return;

    } else if (itemDef.effect === "travel_and_gamble") {
      // Encre / Parchemin : -x% voyage + gamble or
      updates.travel_discount = itemDef.value;
      const gambleMax = itemDef.gamble_max || 60;
      const gambleGold = Math.floor(Math.random() * (gambleMax + 1));
      if (gambleGold > 0) {
        const freshP2 = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
        updates.gold = (freshP2?.gold || profile.gold || 0) + gambleGold;
        toast.success(`${itemDef.icon} ${gambleGold > gambleMax * 0.6 ? "📖 Votre ouvrage fait fureur !" : gambleGold > 20 ? "📖 Succès modeste..." : "📖 Un flop, hélas..."} +${gambleGold} 💰 · −${Math.round(itemDef.value * 100)}% prochain voyage`);
      } else {
        toast(`📖 Votre livre est resté dans les cartons... Personne n'a mordu. −${Math.round(itemDef.value * 100)}% prochain voyage tout de même.`);
      }
      // Créditer XP
      if (itemDef.xp_reward) {
        const freshP3 = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
        const curXp = freshP3?.player_xp_total || 0;
        updates.player_xp_total = curXp + itemDef.xp_reward;
      }
      await base44.entities.PlayerProfile.update(profile.id, updates);
      onRefresh?.();
      return;



    } else if (itemDef.effect === "hunger_restore") {
      // Farine : +5 faim
      const currentHunger = profile.hunger ?? MAX_HUNGER;
      updates.hunger = Math.min(MAX_HUNGER, currentHunger + (itemDef.value || 5));

    } else if (itemDef.effect === "hunger_and_regen") {
      // Pain / Ragoût : +x faim + regen
      const currentHunger = profile.hunger ?? MAX_HUNGER;
      updates.hunger = Math.min(MAX_HUNGER, currentHunger + (itemDef.value || 5));
      if (expiresAt) {
        updates.hunger_regen_bonus_expires_at = expiresAt;
        updates.hunger_regen_interval_min = itemDef.regen_interval_min || 10;
        updates.hunger_regen_value = itemDef.regen_value || 1;
      }

    } else if (itemDef.effect === "fatigue_and_regen") {
      // Potion de soin / Potion d'endurance : +énergie + regen + éventuellement +def
      const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
      const currentFat = freshP?.fatigue ?? (profile.fatigue || 0);
      const maxFat = getMaxFatigue(profile, 0);
      updates.fatigue = Math.min(maxFat, currentFat + (itemDef.value || 20));
      if (expiresAt) {
        updates.energy_regen_bonus_expires_at = expiresAt;
        updates.energy_regen_interval_min = itemDef.regen_interval_min || 5;
        updates.energy_regen_value = itemDef.regen_value || 1;
      }
      // Bonus défense si défini sur l'item (potion de soin T3 : +2 def 6h)
      if (itemDef.defense_bonus) {
        const defExpires = new Date(now.getTime() + (itemDef.defense_bonus_h || 6) * 3600000).toISOString();
        updates.defense_bonus_expires_at = defExpires;
        updates.defense_bonus_value = itemDef.defense_bonus;
      }

    } else if (itemDef.effect === "market_tax_discount") {
      // passif en inventaire — si consommé manuellement : +def temporaire (quartz poli T2)
      if (itemDef.defense_bonus) {
        const defExpires = new Date(now.getTime() + (itemDef.defense_bonus_h || 6) * 3600000).toISOString();
        updates.defense_bonus_expires_at = defExpires;
        updates.defense_bonus_value = itemDef.defense_bonus;
        toast.success(`💠 Cristal brisé ! +${itemDef.defense_bonus} défense vol pendant ${itemDef.defense_bonus_h || 6}h`);
        await base44.entities.PlayerProfile.update(profile.id, updates);
        onRefresh?.();
        return;
      }
      // Quartz brut T1 : si buff biome actif, activer le harvest bonus
      if (itemDef.biome_profession && itemDef.biome_key) {
        const biomeBuffActiveQz = profile.biome_cooldown_bonus_expires_at &&
          new Date(profile.biome_cooldown_bonus_expires_at) > now;
        if (biomeBuffActiveQz) {
          await base44.entities.PlayerProfile.update(profile.id, {
            biome_harvest_bonus_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          });
          toast(`🌿 Buff biome actif ! +1 récolte bonus sur ta prochaine production T1.`);
          onRefresh?.();
          return;
        }
      }
      toast(`💠 Le quartz poli agit passivement — pas besoin de le consommer.`);
      return;

    } else if (itemDef.effect === "housing_maintenance") {
      // Meuble : -50% entretien pendant 10j
      const expiresDay = new Date(now.getTime() + (itemDef.duration_days || 10) * 86400000).toISOString().split("T")[0];
      updates.meuble_expires_at = expiresDay;
      updates.meuble_discount = itemDef.value || 0.50;

    } else if (itemDef.effect === "quest_activate") {
      // Contrat artisan — géré par handleActivateContrat
      toast("📋 Utilisez le bouton 'Activer' dédié pour le Contrat artisan.");
      return;
    }

    // ── XP reward sur consommation ──
    if (itemDef.xp_reward && itemDef.effect !== "travel_and_gamble") {
      const freshPxp = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
      updates.player_xp_total = (freshPxp?.player_xp_total || 0) + itemDef.xp_reward;
    }

    // ── Buff biome harvest bonus (T1) ──
    if (itemDef.biome_profession && itemDef.biome_key) {
      const biomeBuffActive = profile.biome_cooldown_bonus_expires_at &&
        new Date(profile.biome_cooldown_bonus_expires_at) > now;
      if (biomeBuffActive) {
        updates.biome_harvest_bonus_expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // +5 min
        toast(`🌿 Buff biome actif ! +1 récolte bonus sur ta prochaine production T1.`);
      }
    }

    await base44.entities.PlayerProfile.update(profile.id, updates);
    const xpMsg = itemDef.xp_reward ? ` · +${itemDef.xp_reward} XP` : "";
    toast.success(`${itemDef.icon} ${itemDef.name} consommé !${xpMsg}`);
    onRefresh?.();
  };

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadObjectives = useCallback(async () => {
    if (!profile) return;
    const objs = await base44.entities.PlayerObjective.filter({ player_email: profile.user_email, status: "active" });
    // Garder toutes les quêtes actives — contrats ET quêtes du jour
    // Les quêtes du jour sont filtrées à la validation via filterTodayActiveObjectives
    setObjectives(objs);
    // Bâtiments depuis la ville d'origine (homeCity) — fallback sur la ville actuelle
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
    const penalty = hasToolCharges ? 1 : COOLDOWN_PENALTY_NO_TOOLS;
    const tractsActive = city?.production_malus?.tracts_greve_active_until && new Date(city.production_malus.tracts_greve_active_until) > new Date();
    const tractsMalus = tractsActive ? 1.2 : 1;
    const cityLingotBonus = getCityBonuses(city?.lingots_cumul || 0).cooldownReduction / 100;
    const tempCooldownBonus = getPassiveCooldownBonus(profile);
    const fonderiBonus = (profile?.profession === "Forgeron") ? fonderieCooldownReduction : 0;
    const levelBonuses = getPlayerLevelBonuses(profile?.player_level || 1);
    const levelCooldownBonus = levelBonuses.cooldownBonus / 100; // −1% par niveau
    const effectiveCooldown = recipe.cooldown * (1 - reduction) * (1 - cityLingotBonus) * (1 - tempCooldownBonus) * (1 - fonderiBonus) * (1 - levelCooldownBonus) * penalty * tractsMalus;
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
    if (profile.is_traveling) { toast.error("🐴 Votre monture avance — on ne forge pas en chemin !"); return; }
    if (currentHunger <= 0) { toast.error("🍽️ Votre ventre crie famine — nul artisan ne travaille à jeun. Mangez d'abord !"); return; }
    if (currentFatigue < actualFatigueCost) { toast.error("⚡ Vos bras ne répondent plus — reposez-vous à la taverne ou mangez pour reprendre des forces."); return; }
    if (wouldExceedCapacity(profile, recipe.quantity)) {
      toast.error(`📦 Votre besace déborde ! (${currentWeight}/${maxWeight}) Allégez votre charge avant de produire davantage.`);
      return;
    }
    const cooldown = getCooldownLeft(recipe.id);
    if (cooldown > 0) { toast.error(`Encore ${formatCooldown(cooldown)} avant de produire.`); return; }
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
    if (recipe.outputKey === "bois_brut"   && buildingBonuses.scierie)    buildingQtyBonus += 1;
    if (recipe.outputKey === "minerai_fer" && buildingBonuses.mine)        buildingQtyBonus += 1;
    if (recipe.outputKey === "laine_brute" && buildingBonuses.bergerie)    buildingQtyBonus += 1;
    if (recipe.outputKey === "tissu"       && buildingBonuses.atelier)     buildingQtyBonus += 1;
    if (recipe.outputKey === "lingots_or"  && hasCraftingBonus)            buildingQtyBonus += 1;

    // ── Chance double production — tous les bonus additifs ──
    const biomeBuffActive = profile?.biome_cooldown_bonus_expires_at && new Date(profile.biome_cooldown_bonus_expires_at) > new Date();
    const levelBonusesProd       = getPlayerLevelBonuses(profile?.player_level || 1);
    const doubleChanceLevel      = levelBonusesProd.doubleProductionBonus / 100;
    const biomeDoubleChanceProd  = biomeBuffActive ? (profile?.biome_double_prod_bonus ?? 0.10) : 0;
    const charbonBonus = (profile?.double_prod_bonus || 0) > 0 &&
      profile?.double_prod_bonus_expires_at &&
      new Date(profile.double_prod_bonus_expires_at) > now
      ? (profile.double_prod_bonus || 0) : 0;
    const doubleChance = doubleChanceLevel + biomeDoubleChanceProd + charbonBonus;
    const doubleBonus  = (!isNaN(doubleChance) && doubleChance > 0 && Math.random() < doubleChance) ? recipe.quantity : 0;
    const biomeBonusQty = 0; // absorbé dans doubleBonus
    if (doubleBonus > 0) {
      const sources = [
        doubleChanceLevel     > 0 ? `rang ${profile?.player_level || 1}` : null,
        biomeDoubleChanceProd > 0 ? `biome` : null,
        charbonBonus          > 0 ? `charbon` : null,
      ].filter(Boolean).join(" + ");
      toast.success(`🎲 Coup de maître ! +${doubleBonus} ${item?.name || recipe.name} en bonus ! (${sources})`, { duration: 4000 });
    }
    // Biome harvest bonus T1 (timer 5min — indépendant du double prod)
    let biomeHarvestBonus = 0;
    if (recipe.tier === 1 && profile?.biome_harvest_bonus_expires_at && new Date(profile.biome_harvest_bonus_expires_at) > new Date()) {
      biomeHarvestBonus = 1;
    }
    const totalQty = recipe.quantity + bonusQty + buildingQtyBonus + doubleBonus + biomeHarvestBonus;
    if (biomeHarvestBonus > 0) toast(`🌿 Bonus biome récolte ! +1 ${recipe.outputKey} !`);

    const isEquipment = EQUIPMENT_KEYS.includes(recipe.outputKey);
    const itemName = item?.name || recipe.name;
    const itemCategory = item?.category || "parchemins";
    if (isEquipment) {
      const alreadyHas = (profile.inventory || []).some(i =>
        i.item_key === recipe.outputKey && (i.durability ?? EQUIPMENT_MAX_DURABILITY) > 0
      );
      if (alreadyHas) {
        toast.error(`Vous possédez déjà un(e) ${item.name} en état. Attendez qu'il soit détruit.`);
        setProducing(null);
        return;
      }
      newInventory.push({ item_key: recipe.outputKey, item_name: item.name, item_category: item.category, quantity: 1, durability: EQUIPMENT_DURABILITY[recipe.outputKey] ?? EQUIPMENT_MAX_DURABILITY });
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
    const tierCost = TIER_ACTION_COST?.[recipeTier] || { hunger: 1, fatigue: 1 };
    // Moulin (Fermier) : -1 fatigue par action (ne se cumule pas avec le palier)
    const moulinFermier = buildingBonuses.moulin && profile.profession === "Fermier";
    // Laboratoire (Alchimiste) : -1 faim par action (ne se cumule pas avec le palier)
    const laboAlchimiste = buildingBonuses.laboratoire && profile.profession === "Alchimiste";
    egliseActionCounter.current += 1;
    const egliseSkip = buildingBonuses.eglise && egliseActionCounter.current % 2 === 0;
    const hungerCost = Math.max(0, tierCost.hunger - (laboAlchimiste ? 1 : 0) - (egliseSkip ? 1 : 0));
    const fatigueCost = Math.max(0, tierCost.fatigue - (moulinFermier ? 1 : 0));
    const newFatigue = Math.max(0, currentFatigue - fatigueCost);
    setLocalFatigue(newFatigue);
    const newHunger = Math.max(0, currentHunger - hungerCost);
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

    await base44.entities.PlayerProfile.update(profile.id, {
      inventory: updatedInventory,
      production_cooldowns: newCooldowns,
        // biome_harvest_bonus_expires_at expire tout seul — pas besoin de décrémenter
      fatigue: newFatigue,
      tool_charges: newToolCharges,
      hunger: newHunger,
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
    else if (newHunger < HUNGER_WARNING_THRESHOLD) msg += ` 🍽️ Faim : ${newHunger}/${MAX_HUNGER} — mangez bientôt !`;
    toast.success(msg);
    setProducing(null);
    onRefresh?.();
    loadObjectives();
  };

  const handleCraft = async (recipe) => {
    if (profile.is_traveling) { toast.error("🐴 Impossible de fabriquer pendant un voyage !"); return; }
    if (currentHunger <= 0) { toast.error("🍽️ Votre ventre crie famine — nul artisan ne travaille à jeun. Mangez d'abord !"); return; }
    if (currentFatigue < actualFatigueCost) { toast.error("⚡ Vos bras ne répondent plus — reposez-vous à la taverne ou mangez pour reprendre des forces."); return; }

    // ── Vérification équipement requis par tier ──
    const outputTier = ITEMS[recipe.output.key]?.tier || 1;
    const equipInv = profile.inventory || [];
    if (outputTier >= 3) {
      const hasEpeeCourte = equipInv.some(i => i.item_key === "epee_courte" && (i.durability ?? 0) > 0);
      if (!hasEpeeCourte) { toast.error("🗡️ Une Épée courte (avec durabilité) est requise pour crafter du T3 !"); return; }
    }
    if (outputTier >= 4) {
      const hasBesace = equipInv.some(i => i.item_key === "besace" && (i.durability ?? 0) > 0);
      if (!hasBesace) { toast.error("🎒 Une Besace (avec durabilité) est requise pour crafter du T4 !"); return; }
    }
    if (outputTier >= 5) {
      const hasEpeeLongue = equipInv.some(i => i.item_key === "epee_longue" && (i.durability ?? 0) > 0);
      if (!hasEpeeLongue) { toast.error("⚔️ Une Épée longue (avec durabilité) est requise pour crafter du T5 !"); return; }
    }

    const cooldownLeft = getCooldownLeft(recipe.id);
    if (cooldownLeft > 0) { toast.error(`⏳ Encore ${formatCooldown(cooldownLeft)} avant de pouvoir fabriquer.`); return; }

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

    const forgeBonusQty = hasCraftingBonus ? Math.floor(recipe.output.quantity * 0.2) : 0;
    const cityProdBonus = getCityBonuses(city?.lingots_cumul || 0).cooldownReduction;
    const cityBonusQty = cityProdBonus > 0 ? Math.floor(recipe.output.quantity * cityProdBonus / 100) : 0;
    
    // ── Chance double production — tous les bonus additifs ──
    const levelBonusesCraft = getPlayerLevelBonuses(profile?.player_level || 1);
    const doubleChanceLevelCraft  = levelBonusesCraft.doubleProductionBonus / 100;
    const biomeDoubleChanceCraft  = (profile?.biome_cooldown_bonus_expires_at &&
      new Date(profile.biome_cooldown_bonus_expires_at) > new Date())
      ? (profile?.biome_double_prod_bonus ?? 0.10) : 0;
    const charbonBonusCraft = (profile?.double_prod_bonus || 0) > 0 &&
      profile?.double_prod_bonus_expires_at &&
      new Date(profile.double_prod_bonus_expires_at) > new Date()
      ? (profile.double_prod_bonus || 0) : 0;
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
      toast.success(`🎲 Coup de maître ! +${doubleBonusCraft} ${ITEMS[recipe.output.key]?.name || recipe.name} en bonus ! (${sources})`, { duration: 4000 });
    }

    const totalQty = recipe.output.quantity + forgeBonusQty + cityBonusQty + doubleBonusCraft;

    const outItem = ITEMS[recipe.output.key];

    const isEquipmentCraft = EQUIPMENT_KEYS.includes(recipe.output.key);
    const isCraftBonusItem = !!(ITEMS[recipe.output.key]?.craft_tier_bonus);
    if (isEquipmentCraft && !isCraftBonusItem) {
      const alreadyHas = (profile.inventory || []).some(i =>
        i.item_key === recipe.output.key && (i.durability ?? EQUIPMENT_MAX_DURABILITY) > 0
      );
      if (alreadyHas) {
        toast.error(`Vous possédez déjà un(e) ${outItem?.name}. Attendez qu'il soit détruit.`);
        setCrafting(null);
        return;
      }
      inv.push({ item_key: recipe.output.key, item_name: outItem.name, item_category: outItem.category, quantity: 1, durability: EQUIPMENT_DURABILITY[recipe.output.key] ?? EQUIPMENT_MAX_DURABILITY });
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
    const craftTierCost = TIER_ACTION_COST?.[craftTier] || { hunger: 1, fatigue: 1 };
    // Moulin (Fermier) : -1 fatigue par action de craft
    const moulinFermierCraft = buildingBonuses.moulin && profile.profession === "Fermier";
    // Laboratoire (Alchimiste) : -1 faim par action de craft
    const laboAlchimisteCraft = buildingBonuses.laboratoire && profile.profession === "Alchimiste";
    egliseActionCounter.current += 1;
    const egliseSkipCraft = buildingBonuses.eglise && egliseActionCounter.current % 2 === 0;
    const hungerCostCraft = Math.max(0, craftTierCost.hunger - (laboAlchimisteCraft ? 1 : 0) - (egliseSkipCraft ? 1 : 0));
    const fatigueCostCraft = Math.max(0, craftTierCost.fatigue - (moulinFermierCraft ? 1 : 0));
    const newFatigue = Math.max(0, currentFatigue - fatigueCostCraft);
    setLocalFatigue(newFatigue);
    const newHunger = Math.max(0, currentHunger - hungerCostCraft);
    setLocalHunger(newHunger);

    let newToolCharges = profile.tool_charges || 0;
    let finalInv = cleanInv;
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

    await base44.entities.PlayerProfile.update(profile.id, {
      inventory: finalInv,
      fatigue: newFatigue,
      tool_charges: newToolCharges,
      hunger: newHunger,
      production_cooldowns: { ...(profile.production_cooldowns || {}), [recipe.id]: new Date().toISOString() },
    });

    const bonusDesc = [
      forgeBonusQty   > 0 ? `+${forgeBonusQty} Forge`       : null,
      cityBonusQty    > 0 ? `+${cityBonusQty} ville`        : null,
      biomeBonusQty   > 0 ? `+${biomeBonusQty} biome ⭐`    : null,
      doubleBonusCraft > 0 ? `+${doubleBonusCraft} 🎲 double` : null,
    ].filter(Boolean).join(", ");
    if (bonusDesc) toast.success(`⚒️ ${totalQty}× ${outItem.name} fabriqués (${bonusDesc}) !`);
    else toast.success(`⚒️ ${totalQty}× ${outItem.name} fabriqués !`);

    if (newHunger <= 0) toast.warning("🍽️ Vous avez faim ! Mangez avant de continuer.");
    else if (newHunger < HUNGER_WARNING_THRESHOLD) toast(`🍽️ Faim : ${newHunger}/${MAX_HUNGER} — mangez bientôt !`);

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

  const getInventoryQty = (itemKey) => {
    const itemDef = ITEMS[itemKey];
    return (profile?.inventory || []).find(i =>
      i.item_key === itemKey ||
      i.item_name === itemDef?.name ||
      i.item_name?.toLowerCase().replace(/ /g, "_") === itemKey
    )?.quantity || 0;
  };

  const canCraft = (recipe) => recipe.inputs.every(inp => getInventoryQty(inp.key) >= inp.quantity);

  if (!profile) return null;
  const prof = PROFESSIONS[profile.profession];

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
      <PlayerStatusBar profile={profile} homeCity={homeCity} />
      <div>
        <h2 className="font-heading text-2xl font-bold mb-1">{prof?.icon} Production — {profile.profession}</h2>
        <p className="text-muted-foreground font-body text-sm">Récoltez des ressources brutes, puis transformez-les en objets de valeur.</p>
      </div>

      {(() => {
        const fatiguePct = (currentFatigue / maxFatigue) * 100;
        const hungerPct = (currentHunger / MAX_HUNGER) * 100;
        const foodInInventory = FOOD_ITEMS_WITH_FATIGUE.filter(f =>
          (profile.inventory || []).some(i => (i.item_key === f.key || i.item_name === f.name) && i.quantity > 0)
          && !ITEMS[f.key]?.hunger_restore
        );
        return (
          <div className={`rounded-lg border p-4 space-y-3 ${hungryBlocked ? "border-red-400 bg-red-50" : currentFatigue === 0 ? "border-red-400 bg-red-50" : "border-border bg-muted/30"}`}>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-heading font-semibold text-sm flex items-center gap-2">
                🍽️ Faim
                <HelpTooltip text="La faim va de 0 à 10. Chaque action coûte 1 faim. En dessous de 3 : +1 énergie par action. À 0 : impossible de travailler. Aucune regen passive — mangez ! Fontaine en ville = +2/h. Consommables : blé +1, farine +5, pain +5 + regen 1/10min, ragoût +10 + regen 1/5min." />
                  {hungerPenalty && <span className="text-xs text-orange-600 font-body font-normal">⚠️ Fatigue +1 par action</span>}
                  {hungryBlocked && <span className="text-xs text-red-600 font-body font-normal">⛔ Trop faim pour travailler</span>}
                </span>
                <span className="text-sm font-body text-muted-foreground">{currentHunger} / {MAX_HUNGER}</span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${hungerPct > 50 ? "bg-green-500" : hungerPct > 20 ? "bg-orange-400" : "bg-red-500"}`}
                  style={{ width: `${hungerPct}%` }} />
              </div>
              {(hungryBlocked || hungerPenalty || currentHunger < MAX_HUNGER) && hungerFoodAvailable.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground font-body">Manger pour calmer la faim :</p>
                  <div className="flex flex-wrap gap-2">
                    {hungerFoodAvailable.map(([key, def]) => {
                      const qty = (profile.inventory || []).find(i => i.item_key === key || i.item_name === def.label)?.quantity || 0;
                      return (
                        <button key={key} onClick={() => handleEatForHunger(key)}
                          disabled={consumingFood === key + "_hunger" || currentHunger >= MAX_HUNGER}
                          className="flex items-center gap-1.5 bg-orange-100 hover:bg-orange-200 border border-orange-300 text-orange-800 text-xs px-2.5 py-1.5 rounded-lg font-body transition-colors disabled:opacity-50">
                          {def.icon} {def.label} <span className="font-semibold">+{def.hunger_restore}🍽️</span>
                          <span className="text-orange-600 ml-1">×{qty}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {currentHunger < HUNGER_WARNING_THRESHOLD && hungerFoodAvailable.length === 0 && (
                <p className="text-xs text-orange-700 font-body mt-1">
                  🍽️ Achetez de la nourriture au marché (blé, farine, pain, ragoût) pour calmer votre faim.
                </p>
              )}
              {currentHunger < MAX_HUNGER && !buildingBonuses.fontaine && (
                <p className="text-xs text-orange-600 font-body mt-1">
                  ⚠️ Aucune regen passive — achetez de la nourriture ou construisez une <strong>Fontaine</strong> en ville.
                </p>
              )}
              {currentHunger < MAX_HUNGER && buildingBonuses.fontaine && (() => {
                const lastRegen = profile.hunger_regen_at ? new Date(profile.hunger_regen_at).getTime() : 0;
                const nextRegen = lastRegen + 3600000;
                const msLeft = Math.max(0, nextRegen - now);
                if (msLeft === 0) return (
                  <p className="text-xs text-green-600 font-body mt-1">⏰ +2 🍽️ disponible (Fontaine) !</p>
                );
                const mLeft = Math.floor(msLeft / 60000);
                const sLeft = Math.floor((msLeft % 60000) / 1000);
                return (
                  <p className="text-xs text-muted-foreground font-body mt-1">
                    ⏰ +2 🍽️ dans {mLeft > 0 ? `${mLeft}m ${sLeft}s` : `${sLeft}s`} (Fontaine)
                  </p>
                );
              })()}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-heading font-semibold text-sm flex items-center gap-2">⚡ Énergie <HelpTooltip text="L'énergie se dépense à chaque action. Regen selon logement : Tente=+1/1h, Cabane=+1/50min, Maison=+1/40min, Manoir=+1/30min. Récupération rapide : taverne, potions, herbes. Max dépend du logement (tente=20, cabane=45, maison=50, manoir=60). Bonus passifs : Pierre brute +5, Lingots de fer +10." /></span>
                <span className="text-sm font-body text-muted-foreground">{currentFatigue} / {maxFatigue}</span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${fatiguePct > 60 ? "bg-green-500" : fatiguePct > 30 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${fatiguePct}%` }} />
              </div>
              {currentFatigue === 0 && (
                <p className="text-xs text-red-600 font-body font-semibold mt-1">⚠️ Épuisé ! Vous ne pouvez plus effectuer d'actions. Mangez ou dormez à la taverne.</p>
              )}
            </div>

            {/* Appétit & Forme */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-heading font-semibold text-sm flex items-center gap-2">
                    🍽️ Appétit
                    <HelpTooltip text="Perte de 0-2 pts/jour. Chaque point manquant ajoute +10% cooldown. Se remonte avec blé, farine, pain, ragoût." />
                  </span>
                  <span className="text-sm font-body text-muted-foreground">{profile?.satiety ?? 10} / 10</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${
                    (profile?.satiety ?? 10) > 6 ? "bg-amber-500" : (profile?.satiety ?? 10) > 3 ? "bg-orange-400" : "bg-red-500"
                  }`} style={{ width: `${((profile?.satiety ?? 10) / 10) * 100}%` }} />
                </div>
                {(profile?.satiety ?? 10) < 10 && (
                  <p className="text-xs text-orange-500 font-body mt-1">
                    ⚠️ +{(10 - (profile?.satiety ?? 10)) * 10}% cooldown
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-heading font-semibold text-sm flex items-center gap-2">
                    ✨ Forme
                    <HelpTooltip text="Perte de 0-2 pts/jour. Chaque point manquant réduit l'inventaire de 10%. Se remonte avec herbes, extraits et potions." />
                  </span>
                  <span className="text-sm font-body text-muted-foreground">{profile?.vitality ?? 10} / 10</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${
                    (profile?.vitality ?? 10) > 6 ? "bg-green-500" : (profile?.vitality ?? 10) > 3 ? "bg-orange-400" : "bg-red-500"
                  }`} style={{ width: `${((profile?.vitality ?? 10) / 10) * 100}%` }} />
                </div>
                {(profile?.vitality ?? 10) < 10 && (
                  <p className="text-xs text-green-600 font-body mt-1">
                    ⚠️ -{(10 - (profile?.vitality ?? 10)) * 10}% inventaire
                  </p>
                )}
              </div>
            </div>

            {(hungerPenalty || hungryBlocked) && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 text-xs font-body text-orange-800">
                ⚠️ Coût actuel par action T1 : <strong>{getRecipeCost(1).fatigue} ⚡ + {getRecipeCost(1).hunger} 🍽️</strong>
                {getRecipeCost(2).fatigue !== getRecipeCost(1).fatigue && <span className="text-xs font-body font-normal ml-1">(T2: {getRecipeCost(2).fatigue}⚡+{getRecipeCost(2).hunger}🍽️ · T3: {getRecipeCost(3).fatigue}⚡+{getRecipeCost(3).hunger}🍽️)</span>}
                {hungerPenalty ? " (pénalité de faim active)" : ""}
              </div>
            )}

            {(() => {
              const now = new Date();
              const bonuses = [];
              // ── Bonus temporaires ──
              if (profile?.attack_bonus_expires_at && new Date(profile.attack_bonus_expires_at) > now)
                bonuses.push({ icon: "⚔️", label: "+1 attaque vol", expires: profile.attack_bonus_expires_at });
              if (profile?.defense_bonus_expires_at && new Date(profile.defense_bonus_expires_at) > now)
                bonuses.push({ icon: "🛡️", label: "+1 défense vol", expires: profile.defense_bonus_expires_at });
              if (profile?.energy_max_bonus_expires_at && new Date(profile.energy_max_bonus_expires_at) > now)
                bonuses.push({ icon: "⚡", label: `+${profile.energy_max_bonus_value} énergie max`, expires: profile.energy_max_bonus_expires_at });
              if (profile?.cooldown_bonus_expires_at && new Date(profile.cooldown_bonus_expires_at) > now)
                bonuses.push({ icon: "⏱️", label: `−${Math.round((profile.cooldown_bonus_value || 0) * 100)}% cooldown`, expires: profile.cooldown_bonus_expires_at });
              if (profile?.hunger_regen_bonus_expires_at && new Date(profile.hunger_regen_bonus_expires_at) > now)
                bonuses.push({ icon: "🍞", label: `+${profile.hunger_regen_value || 1} faim/${profile.hunger_regen_interval_min || 10}min`, expires: profile.hunger_regen_bonus_expires_at });
              if (profile?.energy_regen_bonus_expires_at && new Date(profile.energy_regen_bonus_expires_at) > now)
                bonuses.push({ icon: "💊", label: `+${profile.energy_regen_value || 1} énergie/${profile.energy_regen_interval_min || 5}min`, expires: profile.energy_regen_bonus_expires_at });
              // ── Bonus passifs inventaire ──
              const inv = profile?.inventory || [];
              if (inv.some(i => i.item_key === "planches" && i.quantity > 0))
                bonuses.push({ icon: "🪵", label: "−20% cooldown (Planches)", passive: true });
              if (inv.some(i => i.item_key === "pierre_brute" && i.quantity > 0))
                bonuses.push({ icon: "🗿", label: "+5 énergie max (Pierre brute)", passive: true });
              if (inv.some(i => i.item_key === "lingots_fer" && i.quantity > 0))
                bonuses.push({ icon: "🔩", label: "+10 énergie max (Lingots de fer)", passive: true });
              if (inv.some(i => i.item_key === "fil" && i.quantity > 0))
                bonuses.push({ icon: "🧵", label: "+40 inventaire (Fil)", passive: true });
              if (inv.some(i => i.item_key === "tissu" && i.quantity > 0))
                bonuses.push({ icon: "🧶", label: "+60 inventaire (Tissu)", passive: true });
              if (bonuses.length === 0) return null;
              return (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 space-y-1">
                  <p className="text-xs font-heading font-semibold text-indigo-800">✨ Bonus actifs</p>
                  {bonuses.map((b, i) => {
                    if (b.passive) return (
                      <div key={i} className="flex items-center justify-between text-xs font-body text-indigo-700">
                        <span>{b.icon} {b.label}</span>
                        <span className="text-indigo-400 italic">passif</span>
                      </div>
                    );
                    const mins = Math.max(0, Math.round((new Date(b.expires) - now) / 60000));
                    const h = Math.floor(mins / 60), m = mins % 60;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs font-body text-indigo-700">
                        <span>{b.icon} {b.label}</span>
                        <span className="text-indigo-500">{h > 0 ? `${h}h${m}m` : `${m}min`}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {(() => {
              const weightPct = (currentWeight / maxWeight) * 100;
              return (
                <div className={`space-y-1 rounded-lg border px-3 py-2 ${weightFull ? "border-red-300 bg-red-50" : weightPct >= 80 ? "border-orange-300 bg-orange-50" : "border-border bg-background"}`}>
                  <div className="flex items-center justify-between text-sm font-body">
                    <span className="font-semibold">📦 Inventaire</span>
                    <span className={weightFull ? "text-red-600 font-bold" : "text-muted-foreground"}>{currentWeight} / {maxWeight}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${weightFull ? "bg-red-500" : weightPct >= 80 ? "bg-orange-400" : "bg-blue-400"}`}
                      style={{ width: `${Math.min(weightPct, 100)}%` }} />
                  </div>
                  {weightFull && <p className="text-xs text-red-600 font-body font-semibold">⚠️ Inventaire plein ! Vendez des items sur le marché.</p>}
                  {!weightFull && weightPct >= 80 && <p className="text-xs text-orange-700 font-body">Inventaire presque plein — pensez à vendre.</p>}
                </div>
              );
            })()}

            <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-body border ${(profile.tool_charges || 0) === 0 ? "border-orange-300 bg-orange-50" : "border-border bg-background"}`}>
              <div className="flex items-center gap-2">
                <span>🔧</span>
                <span className="font-semibold">Outils</span>
                <HelpTooltip text="Les Outils (T4, Forgeron) : −30% cooldown production + produire un T3 génère un T2 aléatoire en bonus. Durabilité 5. Sans outil actif : cooldown ×2. Les Planches (T2 passif) donnent aussi −20% cooldown tant qu'en inventaire." />
                {(profile.tool_charges || 0) === 0 && <span className="text-xs text-orange-700 font-semibold">⚠️ Épuisés — cooldown ×2</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={(profile.tool_charges || 0) === 0 ? "text-orange-600 font-bold" : "text-foreground"}>
                  {profile.tool_charges || 0} charge{(profile.tool_charges || 0) !== 1 ? "s" : ""}
                </span>
                {(() => {
                  const toolsInInventory = (profile.inventory || []).find(i => i.item_key === "outils" || i.item_name === "Outils");
                  return toolsInInventory ? (
                    <span className="text-xs text-muted-foreground">({toolsInInventory.quantity} set{toolsInInventory.quantity !== 1 ? "s" : ""} en inv.)</span>
                  ) : null;
                })()}
              </div>
            </div>

            {(profile.sceau_balance || 0) > 0 && (
              <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-body border border-amber-300 bg-amber-50">
                <div className="flex items-center gap-2">
                  <span>🏵️</span>
                  <span className="font-semibold text-amber-900">Sceau royal actif</span>
                  <HelpTooltip text="Le Sceau royal absorbe automatiquement vos taxes marché et impôts journaliers jusqu'à épuisement du solde. Acheté à la mairie lors d'événements spéciaux." />
                </div>
                <span className="font-bold text-amber-800">{profile.sceau_balance}💰 restants</span>
              </div>
            )}

            {foodInInventory.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-body">Consommer pour récupérer de l'énergie :</p>
                <div className="flex flex-wrap gap-2">
                  {foodInInventory.map(food => {
                    const qty = (profile.inventory || []).find(i => i.item_key === food.key || i.item_name === food.name)?.quantity || 0;
                    return (
                      <button key={food.key} onClick={() => handleConsumeFood(food.key)}
                        disabled={consumingFood === food.key || currentFatigue >= maxFatigue}
                        className="flex items-center gap-1.5 bg-green-100 hover:bg-green-200 border border-green-300 text-green-800 text-xs px-2.5 py-1.5 rounded-lg font-body transition-colors disabled:opacity-50">
                        {food.icon} {food.name} <span className="font-semibold">+{food.fatigue_restore}⚡</span>
                        <span className="text-green-600 ml-1">×{qty}</span>
                      </button>
                    );
                  })}
                </div>
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

      <Tabs defaultValue="farm">
        <TabsList className="font-heading">
          <TabsTrigger value="farm">🌾 Récolter</TabsTrigger>
          <TabsTrigger value="craft">⚒️ Fabriquer</TabsTrigger>
          <TabsTrigger value="atelier">🏪 Mon atelier</TabsTrigger>
          <TabsTrigger value="inventory">📦 Inventaire</TabsTrigger>
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
              const blocked = hungryBlocked || currentFatigue < actualFatigueCost;
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
                          Produit ×{recipe.quantity} {item?.name} · coût {getRecipeCost(recipe.tier || 1).fatigue}⚡ + {getRecipeCost(recipe.tier || 1).hunger}🍽️
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
                        : <Badge variant="secondary">{hungryBlocked ? "🍽️ Faim" : !ready ? formatCooldown(cooldown) : "Ingrédients"}</Badge>
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
            <HelpTooltip text="Le craft transforme des matières premières en items de tier supérieur (T2-T5). ⚠️ Pour crafter du T3 et T4 vous devez avoir une Épée courte (T3) ou une Besace (T4) en inventaire avec de la durabilité. Pour le T5, une Épée longue est requise. Ces items s'usent à chaque craft." />
          </div>
          {(() => {
            const inv = profile?.inventory || [];
            const hasEpeeCourte = inv.some(i => i.item_key === "epee_courte" && (i.durability ?? 0) > 0);
            const hasBesace = inv.some(i => i.item_key === "besace" && (i.durability ?? 0) > 0);
            const hasEpeeLongue = inv.some(i => i.item_key === "epee_longue" && (i.durability ?? 0) > 0);
            if (hasEpeeCourte && hasBesace && hasEpeeLongue) return null;
            return (
              <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs font-body text-orange-800 mb-2 space-y-1">
                <p className="font-semibold">⚠️ Équipement requis pour crafter :</p>
                {!hasEpeeCourte && <p>• 🗡️ <strong>Épée courte</strong> (avec durabilité) — nécessaire pour crafter les <strong>T3</strong></p>}
                {!hasBesace    && <p>• 🎒 <strong>Besace</strong> (avec durabilité) — nécessaire pour crafter les <strong>T4</strong></p>}
                {!hasEpeeLongue && <p>• ⚔️ <strong>Épée longue</strong> (avec durabilité) — nécessaire pour crafter les <strong>T5</strong></p>}
                <p className="text-orange-600 italic">Ces items sont craftés par le Forgeron et le Tisserand.</p>
              </div>
            );
          })()}
          {hasCraftingBonus && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm font-body text-amber-800">
              ⚒️ <strong>Bonus Forge</strong> : +20% de quantité produite sur toutes les fabrications !
            </div>
          )}

          {/* Recettes PvP T1.5 quotidiennes */}
          <div className="mt-4">
            <h4 className="font-heading text-sm font-semibold mb-2 text-accent">⚔️ Items PvP (Inputs quotidiens aléatoires)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {getTodayPvpRecipes().filter(recipe => recipe.profession === profile?.profession).map(recipe => {
                const possible = canCraft(recipe);
                const outItem = ITEMS[recipe.output.key];
                const blocked = hungryBlocked || currentFatigue < actualFatigueCost;
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
                            <div className="text-xs text-muted-foreground font-body">→ ×{recipe.output.quantity} · {getRecipeCost(1).fatigue}⚡ + {getRecipeCost(1).hunger}🍽️</div>
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
                        {crafting === recipe.id ? "Fabrication..." : hungryBlocked ? "🍽️ Trop faim" : possible ? "Fabriquer" : "Ressources manquantes"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Recettes standard T2-T5 */}
          <div className="mt-4">
            <h4 className="font-heading text-sm font-semibold mb-2">⚒️ Recettes standard (T2-T5)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CRAFTING_RECIPES.filter(recipe => !recipe.profession || recipe.profession === profile?.profession).map(recipe => {
                const possible = canCraft(recipe);
                const outItem = ITEMS[recipe.output.key];
                const blocked = hungryBlocked || currentFatigue < actualFatigueCost;
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
                            <div className="text-xs text-muted-foreground font-body">→ ×{recipe.output.quantity} {outItem?.name} · {getRecipeCost(outItem?.tier || 1).fatigue}⚡ + {getRecipeCost(outItem?.tier || 1).hunger}🍽️</div>
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
                        {crafting === recipe.id ? "Fabrication..." : !ready ? formatCooldown(cooldown) : hungryBlocked ? "🍽️ Trop faim" : possible ? "Fabriquer" : "Ressources manquantes"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="atelier" className="mt-4">
          <AtelierVitrine profile={profile} onRefresh={onRefresh} />
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="font-heading text-lg">📦 Inventaire complet</CardTitle></CardHeader>
            <CardContent>
              {(profile.inventory || []).length === 0 ? (
                <p className="text-muted-foreground font-body text-sm">Inventaire vide. Commencez par récolter des ressources !</p>
              ) : (
                <div className="space-y-2">
                  {(profile.inventory || []).filter(i => i.quantity > 0).map((item, idx) => {
                    const data = ITEMS[item.item_key] ||
                      Object.values(ITEMS).find(d => d.name === item.item_name) ||
                      ITEMS[item.item_name?.toLowerCase().replace(/ /g, "_")];
                    const cat = ITEM_CATEGORIES[item.item_category];
                    const effect = item.item_key ? ITEM_EFFECTS[item.item_key] :
                      (data ? ITEM_EFFECTS[Object.keys(ITEMS).find(k => ITEMS[k] === data)] : null);
                    const hungerDef = item.item_key ? HUNGER_FOOD_ITEMS[item.item_key] : null;
                    return (
                      <div key={idx} className="flex items-center gap-3 bg-muted/40 rounded-lg p-3 text-sm font-body">
                        <span className="text-2xl">{data?.icon || cat?.icon || "📦"}</span>
                        <div className="flex-1">
                          <div className="font-semibold">{item.item_name}</div>
                          <div className="text-xs text-muted-foreground">{data?.use || "Vendable sur le marché"}</div>
                          {effect && <div className="text-xs text-primary mt-0.5">✨ {effect.description}</div>}
                          {hungerDef && <div className="text-xs text-orange-600 mt-0.5">🍽️ +{hungerDef.hunger_restore} faim si mangé</div>}
                          {item.item_key === "potion_endur" && (
                            <div className="text-xs text-blue-600 mt-0.5">
                              {profile.profession === "Fermier" ? "🍽️ +2 faim si bu" : "⚡ +20 énergie si bu"}
                            </div>
                          )}
                          {item.durability !== undefined && (() => {
                            const maxDur = EQUIPMENT_DURABILITY?.[item.item_key] ?? EQUIPMENT_MAX_DURABILITY;
                            return <div className="text-xs text-slate-500 mt-0.5">🛡️ Durabilité : {item.durability}/{maxDur}</div>;
                          })()}
                          {(item.item_key === "meuble" || item.item_name === "Meuble") && (
                            <div className="text-xs text-amber-700 mt-0.5">
                              {profile.meuble_expires_at && profile.meuble_expires_at >= new Date().toISOString().split("T")[0]
                                ? `🪑 Actif jusqu'au ${profile.meuble_expires_at}`
                                : "Inactif — cliquez pour installer (15 jours)"}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="secondary">×{item.quantity}</Badge>
                          {hungerDef && currentHunger < MAX_HUNGER && (
                            <button onClick={() => handleEatForHunger(item.item_key)}
                              disabled={consumingFood === item.item_key + "_hunger"}
                              className="text-xs bg-orange-100 hover:bg-orange-200 border border-orange-300 text-orange-800 px-2 py-0.5 rounded font-body transition-colors">
                              Manger
                            </button>
                          )}
                          {(item.item_key === "meuble" || item.item_name === "Meuble") && !(profile.meuble_expires_at && profile.meuble_expires_at >= new Date().toISOString().split("T")[0]) && (
                            <button onClick={handleActivateMeuble}
                              className="text-xs bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 px-2 py-0.5 rounded font-body transition-colors">
                              🪑 Installer
                            </button>
                          )}
                          {(() => {
                            const tempDef = TEMP_EFFECT_ITEMS.find(t => t.key === item.item_key);
                            if (!tempDef) return null;
                            return (
                              <button onClick={() => handleConsumeTempEffect(tempDef)}
                                className="text-xs bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 text-indigo-900 px-2 py-0.5 rounded font-body transition-colors">
                                ✨ {tempDef.label}
                              </button>
                            );
                          })()}
                          {Object.keys(CONTRAT_DEFS).includes(item.item_key) && (
                            <button onClick={() => handleActivateContrat(item.item_key)}
                              className="text-xs bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 px-2 py-0.5 rounded font-body transition-colors">
                              📜 Activer
                            </button>
                          )}
                          {item.item_key === "contrat_noble" && (() => {
                            const nobleActive = !!city?.contrat_noble_active;
                            const isResident = profile.home_city_id === city?.id;
                            if (!isResident) return <span className="text-xs text-muted-foreground font-body italic">Activable dans votre ville</span>;
                            if (nobleActive) return <span className="text-xs text-emerald-600 font-body">🛡️ Déjà actif</span>;
                            return (
                              <button
                                onClick={async () => {
                                  const newInv = (profile.inventory || [])
                                    .map(i => i.item_key === "contrat_noble" ? {...i, quantity: i.quantity - 1} : i)
                                    .filter(i => i.quantity > 0);
                                  await base44.entities.PlayerProfile.update(profile.id, { inventory: newInv });
                                  await base44.entities.City.update(city.id, { contrat_noble_active: true });
                                  toast.success("📜 Contrat Noble activé ! La ville est protégée contre la prochaine attaque T5.");
                                  onRefresh?.();
                                }}
                                className="text-xs bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-900 px-2 py-0.5 rounded font-body transition-colors">
                                📜 Activer bouclier
                              </button>
                            );
                          })()}
                          {item.item_key === "lingot_royal" && (() => {
                            const canSell = profile.home_city_id === city?.id
                              && (city?.gold_treasury || 0) - LINGOT_ROYAL_PRICE >= 200;
                            return (
                              <button
                                onClick={() => handleSellLingotToMairie(item.item_key, item.item_name)}
                                disabled={!canSell}
                                title={!canSell ? (profile.home_city_id !== city?.id ? "Uniquement dans votre ville d'origine" : "Trésorerie insuffisante (min 200💰)") : ""}
                                className={`text-xs px-2 py-0.5 rounded font-body transition-colors border ${canSell ? "bg-yellow-400 hover:bg-yellow-500 border-yellow-500 text-yellow-900" : "bg-muted border-border text-muted-foreground opacity-50 cursor-not-allowed"}`}>
                                👑 Vendre à la mairie (+{LINGOT_ROYAL_PRICE}💰)
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
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
    </div>
  );
}