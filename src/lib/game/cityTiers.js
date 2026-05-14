// ═══════════════════════════════════════════════════════════════════════════
// cityTiers.js — Paliers de ville (Hameau → Empire) et bonus liés
// ═══════════════════════════════════════════════════════════════════════════
// 13/05/2026 — Refonte du système de paliers de ville.
//
// AVANT : seuils en "lingots_cumul" (lingot_royal vendu par Orfèvre, +1-3
//   volés par bataille militaire). Bonus génériques (% cooldown, +combat
//   biome, maintenance, fatigue) souvent à "À venir" passé Bourg.
//
// MAINTENANT : le maire INVESTIT l'or de la trésorerie de la ville pour
// faire monter le palier (cf. CityInvestmentPanel). 1 or = 1 unité dans
// city.lingots_cumul (nom conservé pour éviter une migration BDD, mais
// c'est désormais de l'or). Chaque palier débloque :
//   - un niveau MAX de bâtiment supplémentaire (1 → 5)
//   - éventuellement une nouvelle CATÉGORIE de bâtiments
//
// Le système militaire (s'il revient) vole du lingots_cumul = vole de la
// progression au défenseur. Compatible avec ces nouvelles règles.
//
// Bonus chiffrés (cooldown, biome, maintenance, fatigue) : conservés pour
// rétrocompatibilité de l'affichage mais ne sont plus la vraie carotte —
// c'est désormais le déblocage de contenu qui motive.

export const CITY_LEVELS = [
  { level: 1, threshold: 0,     label: "Hameau",   icon: "🏕️",
    cooldownReduction: 0,  extraBiomeCombat: 0, maintenanceReduction: 0, fatigueBonus: 0,
    unlocksCategories: ["logement", "production", "commerce"],
    maxBuildingLevel: 1,
    description: "Point de départ. Bâtiments de base, niveau 1." },
  { level: 2, threshold: 5000,  label: "Village",  icon: "🏘️",
    cooldownReduction: 10, extraBiomeCombat: 0, maintenanceReduction: 0, fatigueBonus: 0,
    unlocksCategories: ["logement", "production", "commerce"],
    maxBuildingLevel: 2,
    description: "Vos bâtiments peuvent désormais être améliorés au niveau 2. −10% cooldown production." },
  { level: 3, threshold: 13000, label: "Bourg",    icon: "🏙️",
    cooldownReduction: 10, extraBiomeCombat: 1, maintenanceReduction: 0, fatigueBonus: 0,
    unlocksCategories: ["logement", "production", "commerce", "bien_etre"],
    maxBuildingLevel: 2,
    description: "Débloque les bâtiments de Bien-être. +1 combat biome par jour." },
  { level: 4, threshold: 24000, label: "Cité",     icon: "🏛️",
    cooldownReduction: 10, extraBiomeCombat: 1, maintenanceReduction: 0, fatigueBonus: 0,
    unlocksCategories: ["logement", "production", "commerce", "bien_etre", "aventure"],
    maxBuildingLevel: 3,
    description: "Débloque les bâtiments d'Aventure et le niveau 3 des constructions." },
  { level: 5, threshold: 38000, label: "Capitale", icon: "👑",
    cooldownReduction: 10, extraBiomeCombat: 1, maintenanceReduction: 0, fatigueBonus: 0,
    unlocksCategories: ["logement", "production", "commerce", "bien_etre", "aventure", "defense"],
    maxBuildingLevel: 4,
    description: "Débloque les bâtiments de Défense et le niveau 4 des constructions." },
  { level: 6, threshold: 55000, label: "Empire",   icon: "🌟",
    cooldownReduction: 10, extraBiomeCombat: 1, maintenanceReduction: 0, fatigueBonus: 0,
    unlocksCategories: ["logement", "production", "commerce", "bien_etre", "aventure", "defense", "prestige"],
    maxBuildingLevel: 5,
    description: "Sommet du royaume : tous les bâtiments débloqués, niveau 5 atteignable." },
];

// Coût cumulé pour aller du palier N au palier N+1 (or à investir depuis le
// niveau précédent). Calcul direct depuis les thresholds : Village = 5000
// (depuis 0), Bourg = 13000-5000 = 8000, Cité = 11000, etc.
// Cumul TOTAL pour atteindre Empire depuis Hameau = 55000 or.
// Seuils exprimés en lingots accumulés (city.lingots_cumul).

export function getCityTier(lingotsCumul = 0) {
  let tier = CITY_LEVELS[0];
  for (const l of CITY_LEVELS) {
    if (lingotsCumul >= l.threshold) tier = l;
  }
  return tier;
}

export function getCityBonuses(lingotsCumul = 0) {
  const tier = getCityTier(lingotsCumul);
  return {
    cooldownReduction:    tier.cooldownReduction,
    maintenanceReduction: tier.maintenanceReduction,
    fatigueBonus:         tier.fatigueBonus,
    productionBonus: 0,
    marketDiscount:  0,
  };
}

// 13/05/2026 — Helpers de déblocage par palier.

/**
 * La catégorie est-elle débloquée pour cette ville ?
 * Lit le palier actuel de la ville via lingots_cumul puis vérifie la liste
 * unlocksCategories du palier.
 */
export function isCategoryUnlocked(city, categoryKey) {
  const tier = getCityTier(city?.lingots_cumul || 0);
  return (tier.unlocksCategories || []).includes(categoryKey);
}

/**
 * Niveau MAX atteignable par un bâtiment dans cette ville selon le palier.
 * Hameau = 1, Village = 2, Bourg = 2, Cité = 3, Capitale = 4, Empire = 5.
 * Sert à griser les boutons "Améliorer" quand le niveau cible dépasse ce max.
 */
export function getMaxBuildingLevel(city) {
  const tier = getCityTier(city?.lingots_cumul || 0);
  return tier.maxBuildingLevel ?? 1;
}
