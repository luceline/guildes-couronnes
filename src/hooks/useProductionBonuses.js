// ═══════════════════════════════════════════════════════════════════════════
// useProductionBonuses.js — Hook centralisant les calculs de bonus production
// ═══════════════════════════════════════════════════════════════════════════
// 14/05/2026 — Extraction depuis Production.jsx (Vague 3 refacto).
//
// Pourquoi ce hook :
// Dans Production.jsx, le calcul des bonus était dupliqué entre getCooldownLeft,
// handleFarm et handleCraft (lingot ville, level joueur, événements mairie,
// statue royale, charbon passif, biome, etc.). Chaque ajout d'un nouveau bonus
// devait être fait à 2-3 endroits, source d'incohérences. Ce hook unifie tout.
//
// API exposée :
//   - cityFatigueBonus / cityHungerBonus : bonus ville pour stats joueur
//   - computeEffectiveCooldown(recipe)   : durée cooldown réelle avec tous bonus
//   - computeFarmYield(recipe)           : quantités produites pour une farm action
//   - computeCraftYield(recipe)          : quantités produites pour une craft action
//
// Principe : le hook CALCULE et retourne des données. Le composant parent reste
// responsable des side-effects (setCoupDeMaitre, toasts, BDD update).
//
// Note : computeFarmYield et computeCraftYield utilisent Math.random() pour le
// roll de double production. Ce sont des fonctions NON-IDEMPOTENTES par design.
// Le composant parent les appelle une seule fois par action, stocke le résultat.

import {
  getCityFatigueBonus,
  getCityHungerBonus,
  getCityBonuses,
  getPassiveCooldownBonus,
  getPassiveCharbonDoubleProdBonus,
} from "@/lib/gameData";
import { ITEM_EFFECTS } from "@/lib/craftingData";
import { getPlayerLevelBonuses } from "@/lib/playerLevelSystem";
import {
  getBiomeDoubleProdChance,
  isBiomeHarvestActive,
} from "@/lib/playerBuffs";

/**
 * Hook centralisant les calculs de bonus pour les actions de production.
 *
 * @param {Object} args
 * @param {Object} args.profile - profile joueur (peut être null pendant chargement)
 * @param {Object} args.city - ville courante du joueur (peut être null)
 * @param {Array}  args.cityBuildings - bâtiments de la ville
 * @param {Object} args.cityEvents - hook useCityEvents() (avec .hasBuff)
 * @param {Object} args.royalStatue - hook useRoyalStatue() (avec .hasPalier)
 * @param {Object} args.buildingLevels - { scierie: N, mine: N, ... } (0 si absent)
 * @param {Object} args.buildingBonuses - { atelier: bool, ... } (rétro-compat legacy)
 *
 * @returns {Object} - voir API ci-dessus
 */
export function useProductionBonuses({
  profile,
  city,
  cityBuildings,
  cityEvents,
  royalStatue,
  buildingLevels,
  buildingBonuses,
}) {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Bonus statiques (lecture directe depuis cityBuildings)
  // ─────────────────────────────────────────────────────────────────────────
  const cityFatigueBonus = getCityFatigueBonus(cityBuildings);
  const cityHungerBonus = getCityHungerBonus(cityBuildings);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. computeEffectiveCooldown — durée cooldown réelle pour une recette
  // ─────────────────────────────────────────────────────────────────────────
  // Combine : outil d'artisan, malus tracts, bonus lingot ville, passif cooldown,
  // pierre de feu (chaudron), fête du travail (événement mairie), statue palier 1,
  // bonus niveau joueur. Le malus tracts est multiplicatif (×1.2), tous les autres
  // sont des réductions appliquées multiplicativement.
  const computeEffectiveCooldown = (recipe) => {
    if (!recipe) return 0;
    const hasToolCharges = (profile?.tool_charges || 0) > 0;
    const reduction = hasToolCharges ? (ITEM_EFFECTS.outils?.value || 0) : 0;
    // 11/05/2026 : COOLDOWN_PENALTY_NO_TOOLS retiré. L'outil ne pénalise plus à 0.
    const tractsActive =
      city?.production_malus?.tracts_greve_active_until &&
      new Date(city.production_malus.tracts_greve_active_until) > new Date();
    const tractsMalus = tractsActive ? 1.2 : 1;
    const cityLingotBonus = getCityBonuses(city?.lingots_cumul || 0).cooldownReduction / 100;
    const tempCooldownBonus = getPassiveCooldownBonus(profile);
    // Chaudron : 🔥 Pierre de feu : -30% durée crafts pendant 4h
    const pierreFeuActive =
      profile?.craft_speed_buff_until &&
      new Date(profile.craft_speed_buff_until) > new Date();
    const pierreFeuBonus = pierreFeuActive ? (profile.craft_speed_buff_value || 0.30) : 0;
    // Événement mairie : 🛠️ Fête du travail : -50% durée crafts (cumul multiplicatif)
    const workFestivalBonus = cityEvents.hasBuff("work_festival") ? 0.50 : 0;
    // Sprint 2C : palier 1 statue royale : -10% cooldown crafts (cumul multiplicatif)
    const statuePalier1Bonus = royalStatue.hasPalier(1) ? 0.10 : 0;
    const levelBonuses = getPlayerLevelBonuses(profile?.player_level || 1);
    const levelCooldownBonus = levelBonuses.cooldownBonus / 100; // −1% par niveau
    return (
      recipe.cooldown *
      (1 - reduction) *
      (1 - cityLingotBonus) *
      (1 - tempCooldownBonus) *
      (1 - pierreFeuBonus) *
      (1 - workFestivalBonus) *
      (1 - statuePalier1Bonus) *
      (1 - levelCooldownBonus) *
      tractsMalus
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 3. computeFarmYield — quantités produites pour une action FARM
  // ─────────────────────────────────────────────────────────────────────────
  // ATTENTION : utilise Math.random() pour le roll de double production.
  // Retour : { totalQty, baseQty, bonusQty, buildingQtyBonus, doubleBonus,
  //           doubleSources, biomeHarvestBonus }
  const computeFarmYield = (recipe) => {
    const cityProdBonus = getCityBonuses(city?.lingots_cumul || 0).cooldownReduction;
    const bonusQty = cityProdBonus > 0 ? Math.floor(recipe.quantity * cityProdBonus / 100) : 0;

    // REFONTE bonus bâtiments : +1 par niveau du bâtiment (niveau 1 = +1, ..., niveau 5 = +5)
    let buildingQtyBonus = 0;
    if (recipe.outputKey === "bois_brut" && buildingLevels.scierie > 0)      buildingQtyBonus += buildingLevels.scierie;
    if (recipe.outputKey === "minerai_fer" && buildingLevels.mine > 0)       buildingQtyBonus += buildingLevels.mine;
    if (recipe.outputKey === "ble" && buildingLevels.moulin > 0)             buildingQtyBonus += buildingLevels.moulin;
    if (recipe.outputKey === "laine_brute" && buildingLevels.bergerie > 0)   buildingQtyBonus += buildingLevels.bergerie;
    if (recipe.outputKey === "herbes" && buildingLevels.laboratoire > 0)     buildingQtyBonus += buildingLevels.laboratoire;
    if (recipe.outputKey === "quartz_brut" && buildingLevels.fonderie > 0)   buildingQtyBonus += buildingLevels.fonderie;
    // Atelier (T2 tissu) : effet legacy non scalé pour le moment
    if (recipe.outputKey === "tissu" && buildingBonuses?.atelier)            buildingQtyBonus += 1;
    // REFONTE : fonderie ne donne plus +1 lingots_or (son effet est uniquement le bonus quartz).

    // Chance double production : tous les bonus additifs (REFONTE v5)
    // Charbon T2 est un PASSIF : présence dans inventaire = +5%, peu importe la quantité.
    const biomeDoubleChanceProd = getBiomeDoubleProdChance(profile);
    const levelBonusesProd = getPlayerLevelBonuses(profile?.player_level || 1);
    const doubleChanceLevel = levelBonusesProd.doubleProductionBonus / 100;
    const charbonBonus = getPassiveCharbonDoubleProdBonus(profile);
    // Événement mairie : 💰 Bénédiction de l'abondance : +5% double prod
    const blessingBonus = cityEvents.hasBuff("abundance_blessing") ? 0.05 : 0;
    const doubleChance = doubleChanceLevel + biomeDoubleChanceProd + charbonBonus + blessingBonus;
    const doubleBonus =
      !isNaN(doubleChance) && doubleChance > 0 && Math.random() < doubleChance
        ? recipe.quantity
        : 0;
    const doubleSources =
      doubleBonus > 0
        ? [
            doubleChanceLevel > 0     ? `rang ${profile?.player_level || 1}` : null,
            biomeDoubleChanceProd > 0 ? `biome`                              : null,
            charbonBonus > 0          ? `charbon`                            : null,
            blessingBonus > 0         ? `bénédiction`                        : null,
          ].filter(Boolean).join(" + ")
        : "";

    // Biome harvest bonus T1 (timer 5min : indépendant du double prod)
    const biomeHarvestBonus =
      recipe.tier === 1 && isBiomeHarvestActive(profile) ? 1 : 0;

    const totalQty = recipe.quantity + bonusQty + buildingQtyBonus + doubleBonus + biomeHarvestBonus;

    return {
      totalQty,
      baseQty: recipe.quantity,
      bonusQty,
      buildingQtyBonus,
      doubleBonus,
      doubleSources,
      biomeHarvestBonus,
    };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 4. computeCraftYield — quantités produites pour une action CRAFT
  // ─────────────────────────────────────────────────────────────────────────
  // ATTENTION : utilise Math.random() pour le roll de double production.
  // Retour : { totalQty, baseQty, cityBonusQty, doubleBonus, doubleSources }
  //
  // Note : la fonderie ne donne plus de bonus craft (REFONTE).
  const computeCraftYield = (recipe) => {
    const cityProdBonus = getCityBonuses(city?.lingots_cumul || 0).cooldownReduction;
    const cityBonusQty =
      cityProdBonus > 0 ? Math.floor(recipe.output.quantity * cityProdBonus / 100) : 0;

    const levelBonusesCraft = getPlayerLevelBonuses(profile?.player_level || 1);
    const doubleChanceLevelCraft = levelBonusesCraft.doubleProductionBonus / 100;
    const biomeDoubleChanceCraft = getBiomeDoubleProdChance(profile);
    const charbonBonusCraft = getPassiveCharbonDoubleProdBonus(profile);
    const doubleChanceCraft = doubleChanceLevelCraft + biomeDoubleChanceCraft + charbonBonusCraft;
    const doubleBonus =
      !isNaN(doubleChanceCraft) && doubleChanceCraft > 0 && Math.random() < doubleChanceCraft
        ? recipe.output.quantity
        : 0;
    const doubleSources =
      doubleBonus > 0
        ? [
            doubleChanceLevelCraft > 0 ? `rang ${profile?.player_level || 1}` : null,
            biomeDoubleChanceCraft > 0 ? `biome`                              : null,
            charbonBonusCraft > 0      ? `charbon`                            : null,
          ].filter(Boolean).join(" + ")
        : "";

    const totalQty = recipe.output.quantity + cityBonusQty + doubleBonus;

    return {
      totalQty,
      baseQty: recipe.output.quantity,
      cityBonusQty,
      doubleBonus,
      doubleSources,
    };
  };

  return {
    cityFatigueBonus,
    cityHungerBonus,
    computeEffectiveCooldown,
    computeFarmYield,
    computeCraftYield,
  };
}
