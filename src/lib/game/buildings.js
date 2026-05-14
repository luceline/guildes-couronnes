// ═══════════════════════════════════════════════════════════════════════════
// buildings.js — Bâtiments de ville (BUILDING_TYPES + helpers)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️  MIROIR SERVEUR  ⚠️
//
// BUILDING_TYPES est DUPLIQUÉ côté serveur dans :
//   /opt/guildes/server_reset_v2/lib/gameData.js  (VPS prod)
//
// Toute modification sur `maintenance`, `costBase`, ou `category` d'un
// bâtiment DOIT être répercutée côté serveur, sinon le cron quotidien
// prélèvera des ressources différentes de ce que le client affiche.
//
// Historique : un bug a fait que la maison disait "1 planche" côté client
// mais prélevait "1 bois brut" côté serveur pendant plusieurs semaines.
//
// Pour synchroniser : scp ce fichier (et mayor.js qui contient
// getCityDailyMaintenance) vers le serveur, ou éditer en parallèle.
// ═══════════════════════════════════════════════════════════════════════════

import { getCityTier, isCategoryUnlocked, getMaxBuildingLevel } from "./cityTiers.js";

export const BUILDING_TYPES = {

  // ── Logement ──
  maison: {
    name: "Maison", icon: "🏠",
    category: "logement",
    popBonus: 2,
    stackable: true, unique: false, maxStack: 2,
    costBase: { bois_brut: 20, pierre: 10 },
    maintenance: { bois_brut: 1, or: 1 },
    effect: "+2 emplacements de population par maison construite (max 2 maisons).",
    functionType: "population",
  },

  // ── Production ──
  scierie: {
    name: "Scierie", icon: "🌲",
    category: "production",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 30, pierre: 15, minerai_fer: 5 },
    maintenance: { planches: 1, or: 1 },
    effect: "Bonus bois : +1 bois brut par action au niveau 1, jusqu'à +5 au niveau 5. Coût et entretien augmentent linéairement par niveau.",
    functionType: "production_bonus", functionValue: 25, targetProfession: "Bûcheron",
  },
  mine: {
    name: "Mine", icon: "⛏️",
    category: "production",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 40, bois_brut: 15, minerai_fer: 10 },
    maintenance: { pierre_brute: 1, or: 1 },
    effect: "+1 minerai de fer par action au niveau 1, jusqu'à +5 au niveau 5. Coût et entretien augmentent linéairement par niveau.",
    functionType: "production_bonus", functionValue: 25, targetProfession: "Mineur",
  },
  moulin: {
    name: "Moulin", icon: "🌾",
    category: "production",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 25, pierre: 10 },
    maintenance: { farine: 1, or: 1 },
    effect: "Bonus blé : +1/action (niv.1) à +5/action (niv.5). Coût et entretien augmentent linéairement par niveau.",
    functionType: "production_bonus", functionValue: 50, targetProfession: "Fermier" },
  bergerie: {
    name: "Bergerie", icon: "🧶",
    category: "production",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 20, ble: 15 },
    maintenance: { fil: 1, or: 1 },
    effect: "Bonus laine : +1 laine brute par tonte au niveau 1, jusqu'à +5 au niveau 5. Coût et entretien augmentent linéairement par niveau.",
    functionType: "production_bonus", functionValue: 25, targetProfession: "Fermier",
  },
  laboratoire: {
    name: "Laboratoire", icon: "⚗️",
    category: "production",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 30, bois_brut: 15, herbes: 8 },
    maintenance: { extrait: 1, or: 1 },
    effect: "Bonus herbes : +1/action (niv.1) à +5/action (niv.5). Coût et entretien augmentent linéairement par niveau.",
    functionType: "production_bonus", functionValue: 25, targetProfession: "Alchimiste",
  },
  fonderie: {
    name: "Fonderie", icon: "🏅",
    category: "production",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 40, minerai_fer: 20, bois_brut: 15 },
    maintenance: { quartz_poli: 1, or: 2 },
    effect: "Bonus quartz : +1/action (niv.1) à +5/action (niv.5). Coût et entretien augmentent linéairement par niveau.",
    functionType: "production_bonus", functionValue: 1, targetProfession: "Forgeron",
  },

  // ── Commerce ──
  taverne: {
    name: "Taverne", icon: "🍺",
    category: "commerce",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 40, pierre: 15, ble: 20 },
    maintenance: { farine: 1, or: 2 },
    effect: "Tchat entre joueurs. Dormir restaure 50% de l'énergie max (1×/jour, payant). Annonces officielles de la ville.",
    functionType: "chat",
  },
  marche: {
    name: "Marché couvert", icon: "🏪",
    category: "commerce",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 30, pierre: 20 },
    maintenance: { encre: 1, or: 2 },
    effect: "Le marché met en surbrillance les produits les mieux placés financièrement.",
    functionType: "market_discount", functionValue: 3,
  },
  route: {
    name: "Route pavée", icon: "🛣️",
    category: "commerce",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 50, bois_brut: 15 },
    maintenance: { pierre_brute: 1, or: 2 },
    effect: "-50% de frais de voyage sur toutes les routes depuis cette ville.",
    functionType: "travel_cost_reduction", functionValue: 50,
  },
  port: {
    name: "Port", icon: "⚓",
    category: "commerce",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 60, minerai_fer: 20, or: 15 },
    maintenance: { planches: 1, fil: 1, or: 3 },
    effect: "Ouvre des routes maritimes depuis cette ville (gratuites mais 5× plus longues).",
    functionType: "maritime_routes",
  },
  relais: {
    name: "Relais postal", icon: "📮",
    category: "commerce",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 25, ble: 8 },
    maintenance: { encre: 1, or: 1 },
    effect: "Permet de récupérer ses commandes du marché à distance, sans voyager : 5 💰 (or détruit) par colis livré.",
    functionType: "relay",
  },
  comptoir: {
    name: "Comptoir bancaire", icon: "🏦",
    category: "commerce",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 35, bois_brut: 15, or: 10 },
    maintenance: { charbon: 1, or: 2 },
    effect: "Débloque la Banque de ville : le maire peut fixer des taux de prêt et de dépôt pour les résidents.",
    functionType: "bank",
  },

  // ── Bien-être ──
  hospice: {
    name: "Hospice", icon: "🏥",
    category: "bien_etre",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { laine_brute: 8, minerai_fer: 8, bois_brut: 8, quartz_brut: 6, ble: 6, herbes: 6, pierre: 6 },
    maintenance: { extrait: 1, or: 2 },
    effect: "Augmente le plafond de la régénération automatique (faim et énergie) de +1 par niveau (6/15 au niv.1, 7/15 au niv.2, 8/15 au niv.3, 9/15 au niv.4, 10/15 au niv.5). Coût et entretien augmentent linéairement par niveau.",
    functionType: "regen_cap_bonus", functionValue: 1,
  },
  eglise: {
    name: "Église", icon: "⛪",
    category: "bien_etre",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 60, bois_brut: 30, or: 10 },
    maintenance: { fil: 1, or: 2 },
    effect: "10% de chance qu'une action ne consomme ni faim ni énergie. Coût et entretien augmentent linéairement par niveau.",
    functionType: "action_skip_alternate",
  },
  fontaine: {
    name: "Fontaine", icon: "💧",
    category: "bien_etre",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 25, bois_brut: 8 },
    maintenance: { extrait: 1, or: 1 },
    effect: "Double la vitesse de régénération automatique (faim et énergie). Toujours plafonné par l'Hospice si présent. Coût et entretien augmentent linéairement par niveau.",
    functionType: "regen_speed_x2",
  },
  bibliotheque: {
    name: "Bibliothèque", icon: "📚",
    category: "bien_etre",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 40, ble: 15 },
    maintenance: { encre: 1, or: 2 },
    effect: "+30 capacité inventaire (niveau 1), +40 (niv.2), +50 (niv.3), +60 (niv.4), +70 (niv.5).",
    functionType: "inventory_bonus", functionValue: 30,
  },
  grenier: {
    name: "Grenier", icon: "🌾",
    category: "bien_etre",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 30, ble: 20, quartz_brut: 4 },
    maintenance: { farine: 1, or: 1 },
    effect: "Distribue automatiquement 1 blé/jour aux résidents. Coût et entretien augmentent linéairement par niveau.",
    functionType: "bread_auto_distribution", functionValue: 1,
  },

  // ── Défense (coût réduit — 20-25 par T1 sélectionné, pas 50 de chaque) ──
  tour_guet: {
    name: "Tour de guet", icon: "🗼",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "⏳ Bâtiment de défense désactivé. Le système d'attaques inter-villes a été retiré. Ce bâtiment pourra retrouver une utilité dans un futur patch.",
    functionType: "alert",
  },
  remparts: {
    name: "Mur d'enceinte", icon: "🏰",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "Chaque visiteur entrant dans la ville paye un péage de 1 💰 (versé à la trésorerie). Bloque aussi une attaque Blocus et se détruit après l'avoir absorbée.",
    functionType: "wall_defense",
    counters: "blocus",
  },
  caserne: {
    name: "Guilde des voyageurs", icon: "🧭",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "⏳ Bâtiment de défense désactivé. Le système d'attaques inter-villes a été retiré. Ce bâtiment pourra retrouver une utilité dans un futur patch.",
    functionType: "guild_travel_defense",
  },
  coffre_fort: {
    name: "Coffre-fort", icon: "🔒",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "⏳ Bâtiment de défense désactivé. Le système d'attaques inter-villes a été retiré. Ce bâtiment pourra retrouver une utilité dans un futur patch.",
    functionType: "treasury_defense",
  },
  scriptorium: {
    name: "Scriptorium", icon: "✍️",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "⏳ Bâtiment de défense désactivé. Le système d'attaques inter-villes a été retiré. Ce bâtiment pourra retrouver une utilité dans un futur patch.",
    functionType: "anti_propaganda_defense",
  },
  entrepot_fortifie: {
    name: "Entrepôt fortifié", icon: "🏗️",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "⏳ Bâtiment de défense désactivé. Le système d'attaques inter-villes a été retiré. Ce bâtiment pourra retrouver une utilité dans un futur patch.",
    functionType: "warehouse_defense",
  },
  guilde_marchands: {
    name: "Guilde des marchands", icon: "🏛️",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "⏳ Bâtiment de défense désactivé. Le système d'attaques inter-villes a été retiré. Ce bâtiment pourra retrouver une utilité dans un futur patch.",
    functionType: "guild_defense",
  },

  // ── Prestige ──
  universite: {
    name: "Université", icon: "🎓",
    category: "prestige",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 80, bois_brut: 40, ble: 20, or: 20 },
    maintenance: { quartz_poli: 1, farine: 1, or: 3 },
    effect: "+2 faim max pour tous les habitants de la ville.",
    functionType: "hunger_max_bonus", functionValue: 2,
  },
  palais: {
    name: "Palais", icon: "👑",
    category: "prestige",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 100, bois_brut: 60, or: 30, laine_brute: 20 },
    maintenance: { charbon: 1, tissu: 1, or: 4 },
    effect: "+1 or distribué chaque jour à chaque résident de la ville (sans condition). +15 défense militaire pour la ville.",
    functionType: "daily_gold_per_resident", functionValue: 1,
  },
  grande_place: {
    name: "Grande Place", icon: "🏟️",
    category: "prestige",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 60, bois_brut: 40, or: 15 },
    maintenance: { encre: 1, pierre_brute: 1, or: 2 },
    effect: "+20 unités de capacité inventaire pour tous les habitants de la ville.",
    functionType: "inventory_bonus", functionValue: 20,
  },
  cathedrale: {
    name: "Cathédrale", icon: "🌟",
    category: "prestige",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 120, bois_brut: 50, or: 40, herbes: 15 },
    maintenance: { fil: 1, extrait: 1, or: 4 },
    effect: "+2 faim max et +2 énergie max pour tous les habitants de la ville.",
    functionType: "fatigue_and_hunger_max_bonus", functionValue: 2,
  },
};

// ── Catégories de bâtiments ──
// 13/05/2026 — Ajout d'`aventure` (débloqué au palier Cité, contenu à venir).
// Le déblocage par palier est défini dans cityTiers.js (CITY_LEVELS.unlocksCategories).
export const BUILDING_CATEGORIES = {
  logement:   { label: "🏠 Logement",    description: "Augmente la capacité d'accueil de la ville." },
  production: { label: "⚒️ Production",  description: "Améliore la production de ressources des habitants." },
  commerce:   { label: "🏪 Commerce",    description: "Facilite les échanges et réduit les taxes." },
  bien_etre:  { label: "🌿 Bien-être",   description: "Améliore la faim, l'énergie et le confort des résidents." },
  aventure:   { label: "🗡️ Aventure",   description: "Bâtiments liés à l'exploration et aux quêtes (contenu à venir)." },
  defense:    { label: "🛡️ Défense",    description: "Protège la ville contre les attaques ennemies." },
  prestige:   { label: "👑 Prestige",    description: "Bâtiments de prestige uniques pour les villes développées." },
};

// ── Utilitaires bâtiments ──

/** Niveau actuel d'un bâtiment dans une ville (1-5).
 * REFONTE : on lit le champ `level` du bâtiment au lieu de compter les exemplaires.
 * Retourne 0 si le bâtiment n'existe pas. */
export function getBuildingLevel(city, buildingType) {
  const buildings = city?.buildings || [];
  const found = buildings.find(b => b.building_type === buildingType);
  if (!found) return 0;
  return found.level || 1;
}

/** Nombre de bâtiments d'un type dans une ville (utile pour stackables : maison/quartier) */
export function getBuildingCount(city, buildingType) {
  return (city?.buildings || []).filter(b => b.building_type === buildingType).length;
}

/** Peut-on construire ou ameliorer ce batiment ?
 * - Batiments uniques (scierie, mine, etc.) : level max = 5
 * - Batiments stackables : limite definie par maxStack (defaut 5) */
export function canBuildMore(city, buildingType) {
  const bType = BUILDING_TYPES[buildingType];
  if (!bType) return false;
  // 13/05/2026 — Filtrer par catégorie débloquée selon le palier de la ville.
  if (bType.category && !isCategoryUnlocked(city, bType.category)) return false;
  // 13/05/2026 — Niveau max plafonné par le palier de la ville.
  const tierMaxLevel = getMaxBuildingLevel(city);
  if (bType.stackable) {
    const maxStack = bType.maxStack || 5;
    return getBuildingCount(city, buildingType) < maxStack;
  }
  // Bâtiments uniques : l'amélioration est limitée par le plus restrictif
  // entre le plafond global (5) et le plafond du palier de la ville.
  const currentLevel = getBuildingLevel(city, buildingType);
  return currentLevel < Math.min(5, tierMaxLevel);
}

/**
 * Coût pour passer du niveau N au niveau N+1.
 * REFONTE : coût ADDITIF (×(level+1)) au lieu de doublé.
 * Ex pour scierie (costBase = 30 bois) :
 *   niveau 0 → 1 : 30 bois (1× base)
 *   niveau 1 → 2 : 60 bois (2× base)
 *   niveau 2 → 3 : 90 bois (3× base)
 *   niveau 3 → 4 : 120 bois (4× base)
 *   niveau 4 → 5 : 150 bois (5× base)
 *
 * @param {string} buildingType
 * @param {number} currentLevel - niveau actuel (0 si pas construit, 1-4 sinon)
 */
export function getBuildingCost(buildingType, currentLevel = 0) {
  const bType = BUILDING_TYPES[buildingType];
  if (!bType?.costBase) return {};
  const targetLevel = currentLevel + 1; // niveau qu'on va atteindre
  const multiplier = targetLevel; // multiplicateur additif (1, 2, 3, 4, 5)
  return Object.fromEntries(
    Object.entries(bType.costBase).map(([res, qty]) => [res, Math.ceil(qty * multiplier)])
  );
}

/**
 * Le type de bâtiment est-il constructible dans cette ville ?
 * Vérifie que sa catégorie est débloquée par le palier de la ville.
 * (Pour les bâtiments sans catégorie explicite : autorisé par défaut.)
 */
export function isBuildingTypeAvailable(city, buildingType) {
  const bType = BUILDING_TYPES[buildingType];
  if (!bType?.category) return true;
  return isCategoryUnlocked(city, bType.category);
}
