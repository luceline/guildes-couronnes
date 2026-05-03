// Game constants and helper data
import { ITEMS as ITEMS_DEF } from "./craftingData.js";

// ── Admin access list ──
export const ADMIN_EMAILS = [
  "lucas.brunet51@gmail.com",
  "lucas.brunet51@hotmail.fr",
];

export const PROFESSIONS = {
  Bûcheron:   { icon: "🪓", description: "Source principale de bois, chanvre et charbon. Fournit Forgeron, Orfèvre, Tisserand et Marchand en matières premières.",
    startItems: [{ item_key: "bois_brut",   item_name: "Bois brut",   item_category: "bois",      quantity: 20 }] },
  Mineur:     { icon: "⛏️", description: "Extrait pierre et minerai pour le Forgeron, et polit le quartz brut de l'Orfèvre — clé indispensable pour les lingots d'or.",
    startItems: [{ item_key: "pierre_brute", item_name: "Pierre taillée", item_category: "pierre",   quantity: 16 },
                 { item_key: "minerai_fer",  item_name: "Minerai de fer", item_category: "fer",     quantity: 8 }] },
  Fermier:    { icon: "🐄", description: "Hub central. Produit la nourriture qui maintient la faim de tous les joueurs. Sans lui, personne ne peut agir longtemps.",
    startItems: [{ item_key: "ble",         item_name: "Blé",         item_category: "nourriture", quantity: 20 },
                 { item_key: "laine_brute", item_name: "Laine brute", item_category: "tissu",      quantity: 8 }] },
  Tisserand:  { icon: "🧵", description: "File la laine du Fermier en tissu, fabrique besaces et équipements.",
    startItems: [{ item_key: "laine_brute", item_name: "Laine brute", item_category: "tissu",      quantity: 16 }] },
  Forgeron:   { icon: "⚒️", description: "Fond le minerai du Mineur en lingots, forge les outils dont tous les métiers ont besoin pour produire plus vite.",
    startItems: [{ item_key: "minerai_fer", item_name: "Minerai de fer", item_category: "fer",     quantity: 12 },
                 { item_key: "planches",    item_name: "Planches",    item_category: "bois",       quantity: 6 }] },
  Alchimiste: { icon: "⚗️", description: "Distille herbes en extraits, puis en potions. Seul à craft les potions.",
    startItems: [{ item_key: "herbes",      item_name: "Herbes",      item_category: "potions",    quantity: 12 }] },
  Orfèvre:    { icon: "🏅", description: "Seul à produire des lingots d'or — mais dépend du Mineur (quartz poli), du Forgeron (lingots fer) et du Bûcheron (charbon).",
    startItems: [{ item_key: "quartz_brut", item_name: "Quartz brut", item_category: "or",         quantity: 12 },
                 { item_key: "charbon",     item_name: "Charbon",     item_category: "fer",        quantity: 4 }] },
  Marchand:   { icon: "🏪", description: "Organise convois et contrats. Récupère 50% des taxes sur ses propres ventes.",
    startItems: [{ item_key: "tissu",       item_name: "Tissu",       item_category: "tissu",      quantity: 10 },
                 { item_key: "planches",    item_name: "Planches",    item_category: "bois",       quantity: 8 }] },
};

export const ITEM_CATEGORIES = {
  bois:       { icon: "🪵", color: "text-amber-700" },
  pierre:     { icon: "🪨", color: "text-stone-500" },
  fer:        { icon: "⚙️", color: "text-gray-600" },
  nourriture: { icon: "🍞", color: "text-yellow-600" },
  tissu:      { icon: "🧶", color: "text-purple-600" },
  outils:     { icon: "🔧", color: "text-blue-600" },
  armes:      { icon: "⚔️", color: "text-red-600" },
  armures:    { icon: "🥋", color: "text-slate-600" },
  potions:    { icon: "🧪", color: "text-green-600" },
  parchemins: { icon: "📜", color: "text-amber-600" },
  meubles:    { icon: "🪑", color: "text-orange-700" },
  or:         { icon: "🏅", color: "text-yellow-500" },
  ressources_rares: { icon: "✨", color: "text-violet-600" },
};

export const HOUSING_MAINTENANCE = {
  tente: 0, cabane: 3, maison: 12, manoir: 45,
};

export const HOUSING = {
  tente:  { name: "Tente",   cost: 0,    icon: "⛺", capacity: 30,  fatigueBonus: 2,  hungerBonus: 2  },
  cabane: { name: "Cabane",  cost: 200,  icon: "🛖", capacity: 60,  fatigueBonus: 5,  hungerBonus: 5  },
  maison: { name: "Maison",  cost: 800,  icon: "🏠", capacity: 90,  fatigueBonus: 8,  hungerBonus: 8  },
  manoir: { name: "Manoir",  cost: 3000, icon: "🏰", capacity: 120, fatigueBonus: 10, hungerBonus: 10 },
};

// ─────────────────────────────────────────────
// SYSTÈME DE COMBAT ZONÉ (refonte avril 2026)
// 4 zones : tête / torse / bras / jambes
// Chaque zone a 2 slots : atk (item Forgeron) + def (item Tisserand)
// Items au grade 0 (effet 0) → améliorables jusqu'au grade 5 (+5)
// PV : max 10. À 0 PV : KO 48h (pas de contribution unités armée).
// Casse aléatoire au combat : 5% (g0) → 1% (g5).
// ─────────────────────────────────────────────

export const COMBAT_ZONES = ["head", "torso", "arms", "legs"];
export const COMBAT_ZONE_LABELS = {
  head:  { label: "Tête",   icon: "🪖" },
  torso: { label: "Torse",  icon: "🛡️" },
  arms:  { label: "Bras",   icon: "🤜" },
  legs:  { label: "Jambes", icon: "🦵" },
};

// 6 slots d'équipement de combat (Phase 3 — Option B + Bouclier V2) :
//   - 1 arme universelle (épée) : utilisée pour toutes les zones d'attaque
//   - 4 armures, une par zone défendue (heaume/cuirasse/brassard/jambière)
//   - 1 bouclier (universal) : permet de défendre une 2e zone en combat biome
//     (ajoute son grade à la défense de la zone choisie)
// Note : avant la simplification, on avait 8 slots (4 zones × atk/def). Une migration
// existante (migration_combat_simplify.mjs) a converti les anciennes "armes par zone"
// en épées génériques.
export const COMBAT_SLOTS = [
  "weapon",
  "shield",
  "head_def",
  "torso_def",
  "arms_def",
  "legs_def",
];

// Mapping slot → { zone, type }
// "weapon" et "shield" n'ont pas de zone fixe (le shield est appliqué dynamiquement en combat).
export const COMBAT_SLOT_INFO = {
  weapon:    { zone: null,    type: "atk" },
  shield:    { zone: null,    type: "shield" },
  head_def:  { zone: "head",  type: "def" },
  torso_def: { zone: "torso", type: "def" },
  arms_def:  { zone: "arms",  type: "def" },
  legs_def:  { zone: "legs",  type: "def" },
};

export const COMBAT_MAX_GRADE = 5;
// REFONTE v4 : casse aléatoire au combat SUPPRIMÉE (anti-frustration).
// REFONTE v5 : tick journalier de durabilité SUPPRIMÉ. L'usure provient désormais
// uniquement des combats PvP (épée -1/attaque, défense -1 si touché).
// L'ancien tableau COMBAT_BREAK_PCT_BY_GRADE est conservé en commentaire pour archivage.
// export const COMBAT_BREAK_PCT_BY_GRADE = [0.05, 0.04, 0.03, 0.02, 0.015, 0.01];
export const COMBAT_MAX_HP = 10;
export const COMBAT_KO_DURATION_HOURS = 48;
export const COMBAT_PARRY_TIMER_HOURS = 12;
export const COMBAT_STEAL_MAX_GOLD = 100;
/** @deprecated REFONTE ITEMS v5 — la bourse de protection casse désormais après 5 utilisations
 * (système déterministe) au lieu d'un roll 10% par attaque. Voir consumeBourseUse(). */
export const BOURSE_PROTECTION_BREAK_PCT = 0.10;

// Effet d'un item équipé selon son grade : grade 0 = +1, grade 5 = +6 (base_value + grade)
// Note : si on veut grade 0 = +0 et grade 5 = +5, mettre `return grade`
// Ici on retourne `1 + grade` car base_value = 1 pour les nouveaux items combat
// (un item de base donne déjà un effet minimal de +1, l'amélioration ajoute par-dessus)
// IMPORTANT : cette fonction est utilisée pour le score, voir aussi base_value dans l'item
export function getCombatItemValue(grade) {
  return 1 + (grade ?? 0);
}

/**
 * @deprecated REFONTE v4 — la casse aléatoire au combat a été supprimée.
 * Ce stub renvoie toujours 0 pour préserver la compatibilité avec combatPvP.js
 * qui appelle encore cette fonction. À retirer définitivement quand combatPvP.js
 * sera nettoyé de ses appels (Math.random() < 0).
 */
export function getCombatBreakPct() {
  return 0;
}

/**
 * @deprecated REFONTE v4 — la casse aléatoire au combat a été supprimée.
 * Ce tableau est conservé pour rétro-compat avec combatPvP.js qui l'importe
 * encore mais ne l'utilise plus de fait (getCombatBreakPct() retourne 0).
 * À retirer quand combatPvP.js sera nettoyé.
 */
export const COMBAT_BREAK_PCT_BY_GRADE = [0, 0, 0, 0, 0, 0];

// ─────────────────────────────────────────────
// REFONTE v4 — UPGRADES EN LIBRE-SERVICE (depuis l'onglet Combat)
// Plus d'artisan intermédiaire. Le joueur consomme directement ses ressources T1.
// 3 ressources requises à chaque upgrade : Bois, Minerai de fer, Quartz brut.
// Blé et Herbes intentionnellement EXCLUS (gardent leur usage consommable).
// Pierre et Laine brute dédiées à la RÉPARATION (cf. REPAIR_RESOURCES).
// ─────────────────────────────────────────────

// Items concernés par l'upgrade ATK (épée — slot weapon)
export const COMBAT_UPGRADE_ATK_ITEMS = ["epee"];
// Items concernés par l'upgrade DEF (4 armures — slots head/torso/arms/legs_def)
export const COMBAT_UPGRADE_DEF_ITEMS = ["heaume", "cuirasse", "brassard", "jambiere"];

// Coûts d'amélioration par grade (g0→g1, g1→g2, ..., g4→g5)
// Pour CHAQUE upgrade, le joueur paie 3 ressources T1 (pas d'or).
// Progression x2 par palier (3/6/12/25/50). Quartz plus rare (1/2/4/8/15).
// Ratio épée x4 vs armure pour l'équilibrage économique.
export const COMBAT_UPGRADE_COSTS = {
  // ARMURES — 1 pièce
  def: [
    // index = grade actuel (g0 → g1 = index 0)
    { bois_brut: 3,  minerai_fer: 3,  quartz_brut: 1  },
    { bois_brut: 6,  minerai_fer: 6,  quartz_brut: 2  },
    { bois_brut: 12, minerai_fer: 12, quartz_brut: 4  },
    { bois_brut: 25, minerai_fer: 25, quartz_brut: 8  },
    { bois_brut: 50, minerai_fer: 50, quartz_brut: 15 },
  ],
  // ÉPÉE — x4 vs armure
  atk: [
    { bois_brut: 12,  minerai_fer: 12,  quartz_brut: 4  },
    { bois_brut: 24,  minerai_fer: 24,  quartz_brut: 8  },
    { bois_brut: 48,  minerai_fer: 48,  quartz_brut: 16 },
    { bois_brut: 100, minerai_fer: 100, quartz_brut: 32 },
    { bois_brut: 200, minerai_fer: 200, quartz_brut: 60 },
  ],
  // BOUCLIER — coûts identiques à l'épée (premium symétrique : objet d'élite)
  shield: [
    { bois_brut: 12,  minerai_fer: 12,  quartz_brut: 4  },
    { bois_brut: 24,  minerai_fer: 24,  quartz_brut: 8  },
    { bois_brut: 48,  minerai_fer: 48,  quartz_brut: 16 },
    { bois_brut: 100, minerai_fer: 100, quartz_brut: 32 },
    { bois_brut: 200, minerai_fer: 200, quartz_brut: 60 },
  ],
};

// Cooldowns d'amélioration (en secondes) par grade visé. PAR ITEM (pas global).
// Si j'upgrade ma cuirasse, mon brassard reste disponible à upgrade en parallèle.
export const COMBAT_UPGRADE_COOLDOWN_SEC = [60, 120, 240, 480, 960];

// Plage de tarif autorisée pour le service d'amélioration proposé par un artisan
// (Bûcheron pour épée / Mineur pour armures, depuis l'atelier d'amélioration).
// Le client paie cette somme à l'artisan + 20% à la trésorerie de la ville.
// Pré-refonte v4 ces tarifs étaient encore actifs ; depuis l'upgrade en libre-service
// ils servent uniquement aux artisans qui acceptent encore de proposer le service.
export const COMBAT_UPGRADE_PRICE_MIN = 0;
export const COMBAT_UPGRADE_PRICE_MAX = 500;

// Répartition de l'or payé par le client : 80% à l'artisan, 20% au trésor de la ville
export const COMBAT_UPGRADE_ARTISAN_SHARE = 0.80;
export const COMBAT_UPGRADE_CITY_SHARE = 0.20;

// Ressources de réparation : 1 pierre = +1 dura arme, 1 laine = +1 dura armure.
// Réparation manuelle, panel dédié dans l'inventaire, pas de coût en or, pas de cooldown.
export const REPAIR_RESOURCES = {
  weapon: "pierre",       // épée → consomme 1 pierre par +1 dura
  armor:  "laine_brute",  // armures → consomme 1 laine_brute par +1 dura
};

// ─────────────────────────────────────────────────────────────────────────────
// V6 — Quota journalier de réparation
// ─────────────────────────────────────────────────────────────────────────────
// Chaque joueur dispose de N points de réparation par jour. Une réparation +1
// consomme 1 point. Le compteur se reset implicitement au changement de date
// (pattern date-based, pas de reset serveur). Le hook getDailyRepairPoints
// permet d'augmenter le quota plus tard via items, bâtiments, décrets, etc.

export const DAILY_REPAIR_POINTS_BASE = 5;

/** Renvoie le quota total de points de réparation pour un joueur ce jour.
 *  Pour l'instant : base seule. Hook prévu pour extensions futures. */
export function getDailyRepairPoints(profile) {
  let total = DAILY_REPAIR_POINTS_BASE;
  // FUTUR : ajouter ici les bonus selon items équipés (marteau_forgeron),
  // bâtiments municipaux (forge_perfectionnee), décrets temporaires, etc.
  return total;
}

/** Renvoie le nombre de points déjà utilisés aujourd'hui par le joueur.
 *  Si la date stockée n'est pas celle du jour, renvoie 0 (rollover passif). */
export function getRepairPointsUsedToday(profile) {
  const today = new Date().toISOString().split("T")[0];
  const storedDate = profile?.repair_points_date || "";
  if (storedDate !== today) return 0;
  return Number(profile?.repair_points_used_today || 0);
}

/** Vérifie qu'on a au moins `cost` points disponibles pour réparer. */
export function canAffordRepair(profile, cost = 1) {
  const used = getRepairPointsUsedToday(profile);
  const total = getDailyRepairPoints(profile);
  return (total - used) >= cost;
}

/** Construit le patch d'update à appliquer en plus de la réparation.
 *  Renvoie un objet { repair_points_used_today, repair_points_date }
 *  à merger dans le payload de PlayerProfile.update. */
export function buildRepairQuotaUpdate(profile, cost = 1) {
  const today = new Date().toISOString().split("T")[0];
  const used = getRepairPointsUsedToday(profile);
  return {
    repair_points_used_today: used + cost,
    repair_points_date: today,
  };
}

// Renvoie le coût d'amélioration pour un grade donné et un type (atk/def).
// Format de retour : objet { bois_brut, minerai_fer, quartz_brut } avec les quantités requises.
export function getCombatUpgradeCost(type, currentGrade) {
  if (currentGrade < 0 || currentGrade >= COMBAT_MAX_GRADE) return null;
  const arr = COMBAT_UPGRADE_COSTS[type];
  return arr ? arr[currentGrade] : null;
}

// Vérifie si le joueur a toutes les ressources nécessaires pour upgrader son item.
// `inventory` est la liste d'items du joueur (chacun avec item_key et quantity).
export function canUpgradeCombatItem(inventory, type, currentGrade) {
  const cost = getCombatUpgradeCost(type, currentGrade);
  if (!cost) return false;
  for (const [resKey, qty] of Object.entries(cost)) {
    const stock = (inventory || []).find(i => i.item_key === resKey)?.quantity || 0;
    if (stock < qty) return false;
  }
  return true;
}

// Renvoie un objet décrivant les ressources manquantes pour un upgrade donné.
// Utile pour afficher un tooltip "Manque X bois, Y fer, Z quartz".
// Retourne {} si rien ne manque.
export function getMissingUpgradeResources(inventory, type, currentGrade) {
  const cost = getCombatUpgradeCost(type, currentGrade);
  if (!cost) return {};
  const missing = {};
  for (const [resKey, qty] of Object.entries(cost)) {
    const stock = (inventory || []).find(i => i.item_key === resKey)?.quantity || 0;
    if (stock < qty) missing[resKey] = qty - stock;
  }
  return missing;
}

// Récupère l'item équipé sur un slot donné
export function getEquippedItem(profile, slot) {
  return profile?.equipment?.[slot] || null;
}

// Score d'attaque universel : effet de l'épée équipée (slot "weapon").
// Identique quelle que soit la zone visée (système simplifié Option B).
export function getCombatAttackScore(profile) {
  const equipped = getEquippedItem(profile, "weapon");
  if (!equipped) return 0;
  return getCombatItemValue(equipped.grade);
}

// Compat : ancienne fonction zone-based, redirige vers le score universel.
// Conservée pour ne pas casser le code existant qui appelle encore getAttackScoreByZone.
export function getAttackScoreByZone(profile /* , zone */) {
  return getCombatAttackScore(profile);
}

// Calcule le score de défense sur une zone donnée (armure équipée sur cette zone)
export function getDefenseScoreByZone(profile, zone) {
  const slot = `${zone}_def`;
  const equipped = getEquippedItem(profile, slot);
  if (!equipped) return 0;
  return getCombatItemValue(equipped.grade);
}

// REFONTE v4 : casse aléatoire au combat SUPPRIMÉE — getCombatBreakPct() est maintenant un
// stub (toujours 0, défini plus haut). Toute logique appelant getCombatBreakPct dans
// combatPvP.js a été retirée.

// Progression du % de vol selon le grade de l'arme (REFONTE v4).
// Index = grade (0 à 5). +3% par grade. G0 = 10%, G5 = 25%.
// Plus incitatif que l'ancienne version (G5 = 20%) pour récompenser l'investissement.
// Capé à COMBAT_STEAL_MAX_GOLD (100💰) en valeur absolue.
export const COMBAT_STEAL_PCT_BY_GRADE = [0.10, 0.13, 0.16, 0.19, 0.22, 0.25];

// % de vol d'or pour une arme donnée (item_key) à un grade donné.
// Le steal_pct défini dans craftingData.js sert de base au G0 et est ignoré sinon
// (pour l'épée actuelle). Si un nouvel item d'attaque arrive avec un steal_pct
// différent, on garde sa valeur de base et on applique le même barème additif.
export function getCombatStealPct(itemKey, grade = 0) {
  const item = ITEMS_DEF?.[itemKey];
  if (!item) return 0;
  // Pour l'épée (et tout item dont le steal_pct de base = 0.10), on utilise
  // directement le barème de progression.
  const baseAtG0 = item.steal_pct ?? 0;
  const idx = Math.max(0, Math.min(grade ?? 0, COMBAT_STEAL_PCT_BY_GRADE.length - 1));
  // Différentiel = ce qu'ajoute le grade par rapport au G0 standard (0.10)
  const standardG0 = COMBAT_STEAL_PCT_BY_GRADE[0]; // 0.10
  const standardAtGrade = COMBAT_STEAL_PCT_BY_GRADE[idx];
  const delta = standardAtGrade - standardG0;
  return Math.max(0, baseAtG0 + delta);
}

// HP du joueur, avec valeur par défaut et clamp [0, MAX_HP]
export function getPlayerHP(profile) {
  if (profile?.hp === undefined || profile?.hp === null) return COMBAT_MAX_HP;
  return Math.max(0, Math.min(COMBAT_MAX_HP, profile.hp));
}

// True si le joueur est KO (0 PV ou hp_ko_until > maintenant)
export function isPlayerKO(profile) {
  if (getPlayerHP(profile) <= 0) return true;
  if (profile?.hp_ko_until && new Date(profile.hp_ko_until) > new Date()) return true;
  return false;
}


export const MAX_HUNGER  = 15;        // base, avant bonus logement
export const MAX_FATIGUE = 15;        // base, avant bonus logement
export const REGEN_AUTO_CAP = 5;      // plafond de la régen auto pour les deux jauges
export const HUNGER_WARNING_THRESHOLD = 4; // seuil UI uniquement (warning visuel "mangez bientôt") — n'a plus d'effet mécanique
// Regen faim : UNIQUEMENT via consommables ou bâtiments (Fontaine/Hospice/Cathédrale)

export const FATIGUE_REGEN_INTERVAL_MS = 7200000; // valeur par défaut (maison) — voir getFatigueRegenInterval

// Regen énergie liée au logement : tente = 1h, cabane = 50min, maison = 40min, manoir = 30min
export function getFatigueRegenInterval(housingLevel) {
  const intervals = {
    tente:  3600000,   // 1 heure
    cabane: 3000000,   // 50 minutes
    maison: 2400000,   // 40 minutes
    manoir: 1800000,   // 30 minutes
  };
  return intervals[housingLevel] || 3600000; // fallback tente
}

// Items qui restaurent la faim (définis ici pour être accessibles partout)
export const HUNGER_FOOD_ITEMS = {
  ble:     { hunger_restore: 1, label: "Blé",     icon: "🌾" },
  farine:  { hunger_restore: 5, label: "Farine",  icon: "🧺" },
  pain:    { hunger_restore: 5, label: "Pain",     icon: "🍞" },
  ragout:  { hunger_restore: 10, label: "Ragoût",  icon: "🍲" },
  potion_endur: { hunger_restore: 2, label: "Potion d'endurance", icon: "💪" },
};

// ─────────────────────────────────────────────
// SYSTÈME D'ITEMS COMPÉTITIFS INTER-VILLES
// Chaque item a : un crafteur, un coût en faim à l'utilisation,
// un effet, une ville cible, et un délai d'activation (minuit suivant).
// Plafond : 1 item offensif par joueur par ville cible par jour.
// ─────────────────────────────────────────────
export const COMPETITIVE_ITEMS = {
  // ── T5 JCJ — 1 par profession ──
  huile_inflammable: {
    name: "Huile inflammable", icon: "🔥", category: "parchemins",
    craftedBy: ["Bûcheron"], hungerCost: 5, mayorOnly: false,
    effect: "disable_building",
    effectValue: { duration: 1 },
    counterBuilding: "caserne",
    description: "Détruit un bâtiment aléatoire de la ville adverse. Contre-mesure : Guilde des voyageurs.",
    delay: true,
    tavernMessage: "🔥 Un bâtiment a subi d'étranges dégâts cette nuit...",
  },
  poudre_corrosive: {
    name: "Poudre corrosive", icon: "💥", category: "parchemins",
    craftedBy: ["Mineur"], hungerCost: 5, mayorOnly: false,
    effect: "destroy_warehouse_stock",
    effectValue: { min: 10, max: 20 },
    counterBuilding: "entrepot_fortifie",
    description: "Détruit 80% des unités d'une ressource aléatoire de l'entrepôt ennemi. Contre-mesure : Entrepôt fortifié.",
    delay: true,
    tavernMessage: "💥 Des stocks ont été retrouvés endommagés...",
  },
  festin_empoisonne: {
    name: "Festin empoisonné", icon: "🍖", category: "nourriture",
    craftedBy: ["Fermier"], hungerCost: 5, mayorOnly: false,
    effect: "hunger_max_malus",
    effectValue: { reduction: 3, duration: 2 },
    counterBuilding: "hospice",
    description: "Récupération de faim = −5⚡ supplémentaires pendant 2j pour les résidents. Contre-mesure : Hospice.",
    delay: true,
    tavernMessage: "🤢 Plusieurs habitants se sentent faibles depuis hier...",
  },
  faux_contrat: {
    name: "Faux contrat", icon: "📄", category: "parchemins",
    craftedBy: ["Tisserand"], hungerCost: 5, mayorOnly: false,
    effect: "blind_travel",
    effectValue: { duration: 2 },
    counterBuilding: "guilde_marchands",
    description: "Pendant 2j les résidents de la ville cible voyagent à l'aveugle (destinations des routes inconnues). Contre-mesure : Guilde des marchands.",
    delay: true,
    tavernMessage: "📄 Des rumeurs de faux contrats sèment la confusion parmi les voyageurs...",
  },
  cle_forgee: {
    name: "Clé forgée", icon: "🗝️", category: "parchemins",
    craftedBy: ["Forgeron"], hungerCost: 5, mayorOnly: false,
    effect: "steal_treasury",
    effectValue: { pct: 0.20 },
    counterBuilding: "coffre_fort",
    description: "🗝️ Vole 20% des lingots stockés à la mairie ennemie (classement inter-villes). Contre-mesure : Coffre-fort.",
    delay: true,
    tavernMessage: "🗝️ Le coffre de la ville a été partiellement vidé...",
  },
  elixir_discorde: {
    name: "Élixir de discorde", icon: "☠️", category: "potions",
    craftedBy: ["Alchimiste"], hungerCost: 5, mayorOnly: false,
    effect: "redirect_taxes",
    effectValue: { duration: 2 },
    counterBuilding: "scriptorium",
    description: "Les taxes de la ville cible sont détournées vers votre ville pendant 2j. Contre-mesure : Scriptorium.",
    delay: true,
    tavernMessage: "📜 Des rumeurs ont semé le doute parmi les marchands...",
  },
  lettre_desinformation: {
    name: "Lettre de désinformation", icon: "✉️", category: "parchemins",
    craftedBy: ["Marchand"], hungerCost: 5, mayorOnly: false,
    effect: "tax_loss",
    effectValue: 0.30,
    counterBuilding: "tour_guet",
    description: "+30% de taxes sur la ville cible pendant 2j. Contre-mesure : Tour de guet.",
    delay: true,
    tavernMessage: "📰 Des nouvelles troublantes circulent en ville...",
  },
  rapport_commerce: {
    name: "Rapport de commerce", icon: "🔍", category: "parchemins",
    craftedBy: ["Marchand"], hungerCost: 2, mayorOnly: false,
    effect: "reveal_warehouse",
    effectValue: 24,
    counterBuilding: "tour_guet",
    description: "Révèle le contenu de l'entrepôt d'une ville pendant 24h.",
    delay: false,
  },

  traite_commercial: {
    name: "Traité commercial", icon: "🤝", category: "parchemins",
    craftedBy: ["Marchand"], hungerCost: 2, mayorOnly: true,
    effect: "travel_discount_mutual",
    effectValue: { reduction: 0.50, duration: 3 },
    description: "−50% frais voyage entre deux villes pendant 3 jours.",
    delay: false,
  },
  rumors: {
    name: "Rumors", icon: "📰", category: "parchemins",
    craftedBy: ["Marchand"], hungerCost: 3, mayorOnly: false,
    effect: "tax_increase",
    effectValue: { increase: 0.10, duration: 1 },
    counterBuilding: "bibliotheque",
    description: "Augmente les taxes d'une ville ennemie de 10% pendant 1 jour.",
    delay: true,
    tavernMessage: "📣 Des rumeurs troublantes circulent et perturbent les collectes...",
  },
  // ── T1.5 Items (nouveaux) ──
  camouflage: {
    name: "Camouflage", icon: "👻", category: "parchemins",
    craftedBy: ["Bûcheron", "Mineur", "Fermier", "Tisserand", "Forgeron", "Alchimiste", "Orfèvre", "Marchand"], hungerCost: 2, mayorOnly: false,
    effect: "steal_anonymously",
    effectValue: { duration: 1 },
    description: "👻 Prochain vol anonyme : votre nom n'apparaît pas dans la taverne adverse. Consommé automatiquement lors du vol. Craftable par toutes les professions.",
    delay: false,
  },
  tracts_greve: {
    name: "Tracts de Grève", icon: "⚡", category: "parchemins",
    craftedBy: ["Bûcheron", "Mineur", "Fermier", "Tisserand", "Forgeron", "Alchimiste", "Orfèvre", "Marchand"], hungerCost: 2, mayorOnly: false,
    effect: "production_cooldown_malus",
    effectValue: { increase: 0.20, duration: 1 },
    description: "⚡ +20% cooldowns de production pour tous les habitants de la VILLE CIBLE pendant 24h. Utiliser en page Ville (panneau Attaque).",
    delay: true,
    tavernMessage: "⚡ Une grève sauvage paralyse les productions de la ville...",
  },
  bourse_protection: {
    name: "Bourse de protection", icon: "👜", category: "parchemins",
    craftedBy: ["Bûcheron", "Mineur", "Fermier", "Tisserand", "Forgeron", "Alchimiste", "Orfèvre", "Marchand"], hungerCost: 0, mayorOnly: false,
    effect: "steal_cap",
    effectValue: { max_stolen: 10, max_uses: 5 },
    description: "👜 Plafonne le vol subi à 10💰. Casse définitive après 5 attaques subies.",
    delay: false,
  },
  blocus: {
    name: "Blocus", icon: "🚧", category: "parchemins",
    craftedBy: ["Forgeron"], hungerCost: 3, mayorOnly: true,
    effect: "blocus",
    effectValue: { fatigueCost: 2, duration: 2 },
    counterBuilding: "remparts",
    description: "Augmente le coût de voyage vers une ville ennemie pendant 2 jours.",
    delay: true,
    tavernMessage: "🚧 Des routes sont bloquées aux alentours...",
  },
};

// Get total inventory weight (1 unit = 1 weight regardless of item type)
export function getInventoryWeight(profile) {
  return (profile.inventory || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
}

// ── Bonus passif cooldown ──
// Règles de cumul :
//   - Tunique / Outils / Planches = sources d'items, MAX entre elles (non cumulable)
//   - Bonus item temporaire (cooldown_bonus_value) = MAX avec les passifs items
//     (même catégorie : un seul item à la fois)
//   - Bonus biome (combat épique, biome_cooldown_bonus_value) = CUMULABLE avec tout
//     (catégorie distincte : récompense d'activité, pas un objet)
//
// Sources items : planches T2 (−20%), outils T4 (−30%), armure/Tunique T4 (−40%)
// Source biome : −10% pendant 1h après combat épique réussi
export function getPassiveCooldownBonus(profile) {
  const inv = profile.inventory || [];
  let itemValue = 0;
  // Tunique (armure) : −40%
  if (inv.some(i => i.item_key === "armure" && (i.quantity || 0) > 0)) {
    itemValue = Math.max(itemValue, 0.40);
  }
  // Outils : −30% (durabilité, mais effet passif tant que présent)
  if (inv.some(i => i.item_key === "outils" && (i.quantity || 0) > 0 && (i.durability ?? 4) > 0)) {
    itemValue = Math.max(itemValue, 0.30);
  }
  // Planches : −20%
  if (inv.some(i => i.item_key === "planches" && (i.quantity || 0) > 0)) {
    itemValue = Math.max(itemValue, 0.20);
  }
  // Bonus item temporaire (planches activées, meuble) : même catégorie que les passifs items
  if (profile.cooldown_bonus_expires_at && new Date(profile.cooldown_bonus_expires_at) > new Date()) {
    itemValue = Math.max(itemValue, profile.cooldown_bonus_value || 0);
  }
  // Bonus biome (combat épique) : CUMULABLE avec les sources items
  let biomeValue = 0;
  if (profile.biome_cooldown_bonus_expires_at && new Date(profile.biome_cooldown_bonus_expires_at) > new Date()) {
    biomeValue = profile.biome_cooldown_bonus_value || 0;
  }
  // Plafond de sécurité à 0.85 pour éviter qu'un cooldown tombe à zéro
  return Math.min(0.85, itemValue + biomeValue);
}

// Helper exposé : retourne la meilleure source passive cooldown active
// (utilisé par la status bar pour afficher le bon item)
export function getBestPassiveCooldownSource(profile) {
  const inv = profile.inventory || [];
  if (inv.some(i => i.item_key === "armure" && (i.quantity || 0) > 0)) {
    return { item: "armure", name: "Tunique de travail", icon: "🥋", value: 0.40 };
  }
  if (inv.some(i => i.item_key === "outils" && (i.quantity || 0) > 0 && (i.durability ?? 4) > 0)) {
    return { item: "outils", name: "Outils", icon: "🔧", value: 0.30 };
  }
  if (inv.some(i => i.item_key === "planches" && (i.quantity || 0) > 0)) {
    return { item: "planches", name: "Planches", icon: "🪵", value: 0.20 };
  }
  return null;
}

// Helper : lit le `value` d'un effet passif d'item depuis ITEMS_DEF.
// Source unique de vérité = craftingData.ITEMS. Évite la duplication des
// constantes dans le code et garantit la cohérence avec la description
// affichée au joueur (`use`).
function _passiveEffectValueFromItem(itemKey, expectedEffect) {
  const def = ITEMS_DEF[itemKey];
  if (!def || def.trigger !== "passive" || def.effect !== expectedEffect) return 0;
  return def.value || 0;
}

export function getPassiveEnergyMaxBonus(profile) {
  const inv = profile.inventory || [];
  let best = 0;
  // Lit dynamiquement les valeurs depuis ITEMS_DEF (craftingData.js).
  // Si on rebalance pierre_brute ou lingots_fer, ce code n'a pas besoin d'être touché.
  for (const itemKey of ["lingots_fer", "pierre_brute"]) {
    if (inv.some(i => i.item_key === itemKey && (i.quantity || 0) > 0)) {
      best = Math.max(best, _passiveEffectValueFromItem(itemKey, "energy_max_bonus"));
    }
  }
  // Comparer avec bonus temporaire
  return Math.max(best, getTemporaryEnergyMaxBonus(profile));
}

export function getPassiveInventoryBonus(profile) {
  const inv = profile.inventory || [];
  let best = 0;
  // Lit dynamiquement les valeurs depuis ITEMS_DEF (craftingData.js).
  // Si on rebalance fil ou tissu, ce code n'a pas besoin d'être touché.
  for (const itemKey of ["tissu", "fil"]) {
    if (inv.some(i => i.item_key === itemKey && (i.quantity || 0) > 0)) {
      best = Math.max(best, _passiveEffectValueFromItem(itemKey, "inventory_bonus"));
    }
  }
  // Comparer avec bonus temporaire
  return Math.max(best, getTemporaryInventoryBonus(profile));
}

export function getMaxWeight(profile) {
  return (HOUSING[profile.housing_level || "tente"]?.capacity || 100) + getPassiveInventoryBonus(profile);
}

// Get max fatigue for a profile based on housing
export function getMaxFatigue(profile, cityFatigueBonus = 0) {
  const housingBonus = HOUSING[profile.housing_level || "tente"]?.fatigueBonus || 0;
  const epidemieMalus = (profile.epidemie_malus_until && new Date(profile.epidemie_malus_until) > new Date()) ? -3 : 0;
  return Math.max(5, MAX_FATIGUE + housingBonus + cityFatigueBonus + getPassiveEnergyMaxBonus(profile) + epidemieMalus);
}

export function getMaxHunger(profile, cityHungerBonus = 0) {
  const housingBonus = HOUSING[profile.housing_level || "tente"]?.hungerBonus || 0;
  return Math.max(5, MAX_HUNGER + housingBonus + cityHungerBonus + (profile.hunger_max_bonus || 0));
}

// Helpers ville → bonus pour faim/énergie/régen
// Ces fonctions prennent une liste de bâtiments (city.buildings) et retournent le bonus
// à passer aux fonctions getMaxHunger / getMaxFatigue / applyHungerRegen.
//
// Université = +2 faim max, Cathédrale = +2 faim max, +2 énergie max
// Hospice (par niveau) = +1/+2/+3/+4/+5 au plafond de régen automatique
// Fontaine = ×2 vitesse de régénération
export function getCityHungerBonus(buildings = []) {
  let bonus = 0;
  if (buildings.some(b => b.building_type === "universite"))  bonus += 2;
  if (buildings.some(b => b.building_type === "cathedrale"))  bonus += 2;
  return bonus;
}

export function getCityFatigueBonus(buildings = []) {
  let bonus = 0;
  if (buildings.some(b => b.building_type === "cathedrale")) bonus += 2;
  return bonus;
}

// Plafond de la régénération auto (faim et énergie) :
// 5 par défaut, + niveau de l'Hospice (max 10).
export function getRegenCap(buildings = []) {
  const hospice = buildings.find(b => b.building_type === "hospice");
  const lvl = hospice?.level || 0;
  return Math.min(MAX_HUNGER, REGEN_AUTO_CAP + lvl);
}

// Vitesse de régénération auto : intervalle de base divisé par 2 si Fontaine présente.
export function getRegenInterval(housingLevel, buildings = []) {
  const base = getFatigueRegenInterval(housingLevel || "tente");
  const hasFontaine = buildings.some(b => b.building_type === "fontaine");
  return hasFontaine ? Math.round(base / 2) : base;
}

// Festin empoisonné (T5) : pendant la durée de l'effet, manger pour restaurer la faim
// coûte X⚡ supplémentaires par usage. Retourne 0 si l'effet est inactif sur la ville.
export function getFestinHungerDrain(city) {
  if (!city?.production_malus) return 0;
  const until = city.production_malus.hunger_drain_active_until;
  if (!until) return 0;
  if (new Date(until) <= new Date()) return 0;
  return city.production_malus.hunger_drain_value || 5;
}

// Get effective max weight (with convoi bonus)
export function getEffectiveMaxWeight(profile) {
  const base = getMaxWeight(profile);
  let weight = base;
  if (profile.convoi_expires_at && new Date(profile.convoi_expires_at) > new Date()) {
    weight = base * 2;
  }
  return Math.max(10, Math.floor(weight));
}

// Check if adding qty units would exceed capacity
export function wouldExceedCapacity(profile, qty) {
  return getInventoryWeight(profile) + qty > getEffectiveMaxWeight(profile);
}

// ── Getters faim ──
export function getHunger(profile) {
  return profile.hunger ?? MAX_HUNGER; // par défaut plein si champ absent
}

export function isHungry(profile) {
  return getHunger(profile) <= 0;
}

// Conservé pour compat — toujours false depuis la refonte du système faim/énergie
export function hasHungerPenalty() {
  return false;
}

// Conservé pour compat — retourne toujours baseCost depuis la refonte
export function getActionFatigueCost(profile, baseCost = 1) {
  return baseCost;
}

// ─────────────────────────────────────────────
// applyRandomActionCost
// ─────────────────────────────────────────────
// Calcule le coût d'une action selon le système unifié faim/énergie.
//
// Tirage : pour chaque action, pile/face entre faim et énergie.
//   - jauge tirée a assez → on prélève dessus
//   - jauge tirée à 0 → on bascule sur l'autre jauge
//   - les deux insuffisantes → action bloquée
//
// Pour T2-T5 (cost > 1) : un seul tirage pour tout le coût d'un coup.
//   Si la jauge n'a pas assez, on bascule la totalité sur l'autre jauge.
//
// @param {Object} profile - PlayerProfile
// @param {number} cost - nombre de points à consommer (1 par défaut, 2 pour T2, etc.)
// @param {Object} opts - { cityFatigueBonus, cityHungerBonus } pour calculs max
// @returns { ok, newHunger, newFatigue, drainedFrom, errorMessage }
//   ok=false → action bloquée (errorMessage rempli)
//   drainedFrom = "hunger" | "fatigue" (la jauge qui a effectivement payé)
export function applyRandomActionCost(profile, cost = 1, opts = {}) {
  const { cityFatigueBonus = 0, cityHungerBonus = 0 } = opts;
  const currentHunger  = profile.hunger ?? getMaxHunger(profile, cityHungerBonus);
  const currentFatigue = profile.fatigue ?? getMaxFatigue(profile, cityFatigueBonus);

  // Si les deux jauges sont insuffisantes, on bloque
  if (currentHunger + currentFatigue < cost) {
    return {
      ok: false,
      newHunger: currentHunger,
      newFatigue: currentFatigue,
      drainedFrom: null,
      errorMessage: "💤 Vous êtes à bout de forces, reposez-vous !",
    };
  }

  // Tirage 50/50
  let pickHunger = Math.random() < 0.5;

  // Si la jauge tirée n'a pas assez, on bascule sur l'autre
  if (pickHunger && currentHunger < cost) pickHunger = false;
  else if (!pickHunger && currentFatigue < cost) pickHunger = true;

  if (pickHunger) {
    return {
      ok: true,
      newHunger:  Math.max(0, currentHunger - cost),
      newFatigue: currentFatigue,
      drainedFrom: "hunger",
      errorMessage: null,
    };
  } else {
    return {
      ok: true,
      newHunger:  currentHunger,
      newFatigue: Math.max(0, currentFatigue - cost),
      drainedFrom: "fatigue",
      errorMessage: null,
    };
  }
}

// ─────────────────────────────────────────────
// BUILDING TYPES — complete system
// ─────────────────────────────────────────────
export const BUILDING_TYPES = {

  // ── Logement ──
  maison: {
    name: "Maison", icon: "🏠",
    category: "logement",
    popBonus: 2,
    stackable: true, unique: false,
    costBase: { bois_brut: 20, pierre: 10 },
    maintenance: { planches: 1, or: 1 },
    effect: "+2 emplacements de population par maison construite.",
    functionType: "population",
  },
  quartier: {
    name: "Quartier résidentiel", icon: "🏘️",
    category: "logement",
    popBonus: 5,
    stackable: true, unique: false,
    costBase: { bois_brut: 50, pierre: 30, minerai_fer: 10 },
    maintenance: { quartz_poli: 1, or: 2 },
    effect: "+5 emplacements de population.",
    functionType: "population",
  },
  manoir_ville: {
    name: "Manoir seigneurial", icon: "🏯",
    category: "logement",
    popBonus: 10,
    stackable: false, unique: true,
    costBase: { pierre: 60, minerai_fer: 30, or: 15 },
    maintenance: { pierre_brute: 1, or: 3 },
    effect: "+10 emplacements de population.",
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
    effect: "⏳ Bâtiment en refonte. Effet temporairement désactivé le temps de revoir le système d'attaques T5.",
    functionType: "alert",
    counters: "lettre_desinformation",
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
    effect: "⏳ Bâtiment en refonte. Effet temporairement désactivé le temps de revoir le système d'attaques T5.",
    functionType: "guild_travel_defense",
    counters: "huile_inflammable",
  },
  coffre_fort: {
    name: "Coffre-fort", icon: "🔒",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "⏳ Bâtiment en refonte. Effet temporairement désactivé le temps de revoir le système d'attaques T5.",
    functionType: "treasury_defense",
    counters: "cle_forgee",
  },
  scriptorium: {
    name: "Scriptorium", icon: "✍️",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "⏳ Bâtiment en refonte. Effet temporairement désactivé le temps de revoir le système d'attaques T5.",
    functionType: "anti_propaganda_defense",
    counters: "elixir_discorde",
  },
  entrepot_fortifie: {
    name: "Entrepôt fortifié", icon: "🏗️",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "⏳ Bâtiment en refonte. Effet temporairement désactivé le temps de revoir le système d'attaques T5.",
    functionType: "warehouse_defense",
    counters: "poudre_corrosive",
  },
  guilde_marchands: {
    name: "Guilde des marchands", icon: "🏛️",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "⏳ Bâtiment en refonte. Effet temporairement désactivé le temps de revoir le système d'attaques T5.",
    functionType: "guild_defense",
    counters: "faux_contrat",
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
    maintenance: { charbon: 1, fil: 1, or: 4 },
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

// ── Mairie ──
// Coût fixe pour devenir maire : 20💰
export const MAYOR_COST_MAX = 20;
export const MAYOR_COST_MAX_PALAIS = 20;
export const MAYOR_DAYS = 10;
export const PROFESSION_CHANGE_COST = 20; // or détruit (n'enrichit pas la ville)

// ── Récompenses connexion quotidienne (modifier ici pour rééquilibrer) ──
export const STREAK_REWARDS = [
  { days: 1,  gold: 1,   label: "1 jour",    icon: "🌱" },
  { days: 2,  gold: 2,   label: "2 jours",   icon: "🌿" },
  { days: 3,  gold: 3,   label: "3 jours",   icon: "🌾" },
  { days: 5,  gold: 8,   label: "5 jours",   icon: "⭐" },
  { days: 7,  gold: 15,  label: "1 semaine", icon: "🔥" },
  { days: 14, gold: 35,  label: "2 semaines",icon: "💎" },
  { days: 30, gold: 100, label: "1 mois",    icon: "👑" },
];

// ── XP par ressource rare échangée/consommée ──
export const RARE_RESOURCE_XP = 100;

// ── Système de durabilité des équipements ──
// EQUIPMENT_KEYS et EQUIPMENT_DURABILITY sont dérivés automatiquement depuis ITEMS dans craftingData.js
// Importer depuis craftingData si nécessaire : import { EQUIPMENT_KEYS, EQUIPMENT_DURABILITY } from "./craftingData.js"
// Conservés ici pour rétrocompatibilité — se synchronisent avec craftingData.ITEMS
export { EQUIPMENT_KEYS, EQUIPMENT_DURABILITY } from "./craftingData.js";
// (ITEMS_DEF déjà importé en haut du fichier)
export const EQUIPMENT_MAX_DURABILITY = 10;

// Score d'attaque (Phase 3 Option B : 1 seule arme universelle, plus de somme par zone)
export function getAttackScore(profile) {
  return getCombatAttackScore(profile);
}

// Score de défense TOTAL (somme des 4 zones) — conservé pour compatibilité affichage
// Pour le combat réel, utiliser getDefenseScoreByZone(profile, zone)
export function getDefenseScore(profile) {
  return COMBAT_ZONES.reduce((sum, zone) => sum + getDefenseScoreByZone(profile, zone), 0);
}

// getCombatScore conservé pour compatibilité (attaque seulement pour le voleur)
export function getCombatScore(profile) {
  return getAttackScore(profile);
}

// ── Bonus énergie max temporaire (minerai T1, pierre_brute T2, lingots_fer T3) ──
export function getTemporaryEnergyMaxBonus(profile) {
  if (profile.energy_max_bonus_expires_at && new Date(profile.energy_max_bonus_expires_at) > new Date()) {
    return profile.energy_max_bonus_value || 0;
  }
  return 0;
}

// ── Bonus inventaire temporaire (laine_brute T1, fil T2, tissu T3) ──
export function getTemporaryInventoryBonus(profile) {
  if (profile.inventory_bonus_expires_at && new Date(profile.inventory_bonus_expires_at) > new Date()) {
    return profile.inventory_bonus_value || 0;
  }
  return 0;
}

// ── DEPRECATED ── Réduction cooldown production temporaire
// Cette fonction a été absorbée dans getPassiveCooldownBonus pour gérer le
// cumul correct entre items passifs et bonus biome. Conservée pour compat avec
// d'éventuels appelants externes, mais à ne plus utiliser dans le nouveau code.
export function getTemporaryCooldownBonus(profile) {
  let bonus = 0;

  // Bonus cooldown items (planches, meuble, etc)
  if (profile.cooldown_bonus_expires_at && new Date(profile.cooldown_bonus_expires_at) > new Date()) {
    bonus = Math.max(bonus, profile.cooldown_bonus_value || 0);
  }

  // Bonus cooldown biome (-15% si victoire dans biome compatible)
  if (profile.biome_cooldown_bonus_expires_at && new Date(profile.biome_cooldown_bonus_expires_at) > new Date()) {
    bonus = Math.max(bonus, profile.biome_cooldown_bonus_value || 0);
  }

  return bonus;
}

// ── Réduction taxe marché acheteur ──
// Dérivé automatiquement depuis ITEMS (effect === "market_tax_discount"), trié par value desc.
// Pour ajouter un item tax-discount : ajoutez-le dans ITEMS avec effect: "market_tax_discount".
import { ITEMS as _ITEMS_FOR_TAX } from "./craftingData.js";
const _TAX_DISCOUNTS = Object.entries(_ITEMS_FOR_TAX)
  .filter(([, v]) => v.effect === "market_tax_discount" && v.trigger === "passive")
  .map(([key, v]) => ({ key, value: v.value }))
  .sort((a, b) => b.value - a.value);

export function getMarketTaxDiscount(profile) {
  const inv = profile.inventory || [];
  for (const d of _TAX_DISCOUNTS) {
    if (inv.some(i => i.item_key === d.key && (i.quantity || 0) > 0)) return d.value;
  }
  return 0;
}

// ─────────────────────────────────────────────
// REFONTE ITEMS v5 — nouveaux helpers passifs
// ─────────────────────────────────────────────

// ── Sac de voyage T4 : passif PERMANENT -50% durée voyage ──
// Renvoie 0.50 si la besace est dans l'inventaire, 0 sinon.
// Branché dans Travel.jsx pour appliquer baseMinutes × (1 - discount).
export function getPassiveTravelDiscount(profile) {
  const inv = profile.inventory || [];
  if (inv.some(i => i.item_key === "besace" && (i.quantity || 0) > 0)) {
    return 0.50;
  }
  return 0;
}

// ── Charbon T2 : passif +5% double prod (s'AJOUTE aux bonus biome et niveau) ──
// Non-cumulable avec lui-même : un charbon en stock = +5%, peu importe la quantité.
// Renvoie 0.05 si charbon présent, 0 sinon.
export function getPassiveCharbonDoubleProdBonus(profile) {
  const inv = profile.inventory || [];
  if (inv.some(i => i.item_key === "charbon" && (i.quantity || 0) > 0)) {
    return 0.05;
  }
  return 0;
}

// ── Bourse de protection T1.5 : tracking max 5 utilisations ──
// Le profil stocke `bourse_uses_left` (initialisé à 5 quand on craft une bourse).
// Si non défini sur le profil, on retourne 5 par défaut (rétro-compat).
// Quand on retombe à 0, la bourse se brise (à nettoyer côté combat).
export function getBourseUsesLeft(profile) {
  const inv = profile.inventory || [];
  const hasBourse = inv.some(i => i.item_key === "bourse_protection" && (i.quantity || 0) > 0);
  if (!hasBourse) return 0;
  // Si pas encore défini, considère 5 par défaut (l'item a été crafté avant la refonte v5)
  return profile.bourse_uses_left ?? 5;
}

// Calcule le nouvel état du profil après une attaque subie consommant 1 utilisation.
// Retourne { updates, broken } : updates = champs PlayerProfile à patcher, broken = bool.
// - Si la bourse a encore des charges après décrément → updates.bourse_uses_left mis à jour
// - Si la bourse tombe à 0 → updates.inventory met le bourse_protection à 0 et le filtre,
//   et updates.bourse_uses_left = null (reset pour la prochaine bourse craftée)
export function consumeBourseUse(profile) {
  const inv = profile.inventory || [];
  const hasBourse = inv.some(i => i.item_key === "bourse_protection" && (i.quantity || 0) > 0);
  if (!hasBourse) return { updates: {}, broken: false }; // pas de bourse, rien à faire
  const usesLeft = profile.bourse_uses_left ?? 5;
  // Cas 1 : compteur > 1 → on décrémente normalement
  if (usesLeft > 1) {
    return { updates: { bourse_uses_left: usesLeft - 1 }, broken: false };
  }
  // Cas 2 : compteur <= 1 (1 ou stuck à 0) → casser la bourse maintenant
  // Cela inclut les bourses "stuck à 0" qui n'avaient pas été cassées correctement.
  const newInv = inv
    .map(i => i.item_key === "bourse_protection" ? { ...i, quantity: (i.quantity || 0) - 1 } : i)
    .filter(i => (i.quantity || 0) > 0);
  return {
    updates: { inventory: newInv, bourse_uses_left: null },
    broken: true,
  };
}

// ── Niveaux de ville ──
export const CITY_LEVELS = [
  { level: 1, threshold: 0,   label: "Hameau",   icon: "🏕️",
    cooldownReduction: 0,  extraBiomeCombat: 0, maintenanceReduction: 0, fatigueBonus: 0,
    description: "Point de départ. Aucun bonus." },
  { level: 2, threshold: 10,  label: "Village",  icon: "🏘️",
    cooldownReduction: 10, extraBiomeCombat: 0, maintenanceReduction: 0, fatigueBonus: 0,
    description: "−10% cooldown production (cumulable avec bonus biome et niveau joueur)." },
  { level: 3, threshold: 30,  label: "Bourg",    icon: "🏙️",
    cooldownReduction: 10, extraBiomeCombat: 1, maintenanceReduction: 0, fatigueBonus: 0,
    description: "−10% cooldown production + 1 combat biome supplémentaire par jour (6 au lieu de 5)." },
  { level: 4, threshold: 80,  label: "Cité",     icon: "🏛️",
    cooldownReduction: 10, extraBiomeCombat: 1, maintenanceReduction: 0, fatigueBonus: 0,
    description: "À venir." },
  { level: 5, threshold: 160, label: "Capitale", icon: "👑",
    cooldownReduction: 10, extraBiomeCombat: 1, maintenanceReduction: 0, fatigueBonus: 0,
    description: "À venir." },
  { level: 6, threshold: 400, label: "Empire",   icon: "🌟",
    cooldownReduction: 10, extraBiomeCombat: 1, maintenanceReduction: 0, fatigueBonus: 0,
    description: "À venir." },
];

// Seuils exprimés en lingots accumulés (city.lingots_cumul)

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

/** Peut-on construire/améliorer ce bâtiment ?
 * - Bâtiments uniques (scierie, mine, etc.) : level max = 5
 * - Bâtiments stackables (maison, quartier) : 5 exemplaires max */
export function canBuildMore(city, buildingType) {
  const bType = BUILDING_TYPES[buildingType];
  if (!bType) return false;
  if (bType.stackable) {
    return getBuildingCount(city, buildingType) < 5;
  }
  // Bâtiments uniques : on peut construire (si absent) OU améliorer (si level < 5)
  const currentLevel = getBuildingLevel(city, buildingType);
  return currentLevel < 5;
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

// ─────────────────────────────────────────────
// SYSTÈME DE ROUTES
// ─────────────────────────────────────────────

export const ROAD_TYPES = {
  royale:     { label: "🛤️ Route royale",       baseMin: 1,  baseMax: 3,  maritime: false },
  forestier:  { label: "🌲 Chemin forestier",   baseMin: 3,  baseMax: 8,  maritime: false },
  montagneux: { label: "⛰️ Passage montagneux", baseMin: 10, baseMax: 20, maritime: false },
  maritime:   { label: "⛵ Route maritime",      baseMin: 0,  baseMax: 0,  maritime: true  },
};

export const ROAD_COLORS = {
  royale:     "bg-green-100 text-green-800 border-green-200",
  forestier:  "bg-yellow-100 text-yellow-800 border-yellow-200",
  montagneux: "bg-orange-100 text-orange-800 border-orange-200",
  maritime:   "bg-blue-100 text-blue-800 border-blue-200",
};

export function getDailyRouteCost(roadType, routeId) {
  const today = getTodayDateStr();
  const seed = today.replace(/-/g, "") + routeId;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const rnd = Math.abs(hash) / 2147483647;
  const rt = ROAD_TYPES[roadType];
  if (!rt) return 0;
  return Math.round(rt.baseMin + rnd * (rt.baseMax - rt.baseMin));
}

// ── Calcul du coût de voyage ──
export function computeTravelCost(roadType, routeId, departCity, playerProfile) {
  // Route maritime toujours gratuite
  if (roadType === "maritime") return 0;

  const baseCost = getDailyRouteCost(roadType, routeId);
  let cost = baseCost;

  // Route pavée → -50% frais
  const hasRoute = (departCity?.buildings || []).some(b => b.building_type === "route");
  if (hasRoute) cost = Math.floor(cost * 0.5);

  // Guilde des voyageurs → -30% frais pour les habitants
  const isResident = playerProfile?.home_city_id === departCity?.id ||
                     playerProfile?.city_id === departCity?.id;
  const guildCount = (departCity?.buildings || []).filter(b => b.building_type === "caserne").length;
  if (isResident && guildCount > 0) cost = Math.floor(cost * 0.7);

  return Math.max(0, cost);
}

export function computeWallToll(arrivalCity, playerProfile) {
  const wallCount = (arrivalCity?.buildings || []).filter(b => b.building_type === "remparts").length;
  if (wallCount === 0) return 0;
  const isResident = playerProfile?.home_city_id === arrivalCity?.id ||
                     playerProfile?.city_id === arrivalCity?.id;
  if (isResident) return 0;
  return wallCount;
}

export function getRouteType(route) {
  // Priorité au danger_level (source de vérité affichée sur la carte).
  // road_type n'est utilisé qu'en fallback (ex: routes inter-territoires) ou si danger_level absent.
  const map = { "sûr": "royale", "modéré": "forestier", "dangereux": "montagneux" };
  if (route.danger_level && map[route.danger_level]) return map[route.danger_level];
  if (route.road_type) return route.road_type;
  return "royale";
}


export function generateDailyTax() {
  const rates = [5, 8, 10, 12, 15, 18, 20];
  return rates[Math.floor(Math.random() * rates.length)];
}

export function generateMayorCost() {
  return 20;
}

export function generateDailyTaxPerPlayer() {
  const amounts = [0, 5, 5, 5, 10, 10, 15, 20, 25, 30];
  return amounts[Math.floor(Math.random() * amounts.length)];
}

export function getTodayDateStr() {
  return new Date().toISOString().split("T")[0];
}





// ── Coût faim + énergie par tier d'action ──

// ── Récompenses parchemins d'objectifs (calibrées anti-inflation) ──
export const PARCHEMIN_REWARDS = {
  contrat_artisan:  80,  // était 110, réduit pour équilibre économique
  // contrat_noble : récompense dynamique (voir Production.jsx CONTRAT_NOBLE_REWARD)
};

export const SCEAU_PRICE = 100;   // or détruit à l'achat
export const SCEAU_VALUE = 110;   // valeur absorbée en taxes/impôts

// ── Prestige joueur ──
export function getVendeurRank(cumul = 0) {
  if (cumul >= 10000) return { label: "Expert",        icon: "🏆", next: null,              nextAt: null  };
  if (cumul >= 5000)  return { label: "Confirmé",      icon: "⭐", next: "Expert",          nextAt: 10000 };
  if (cumul >= 2000)  return { label: "Intermédiaire", icon: "🥈", next: "Confirmé",        nextAt: 5000  };
  if (cumul >= 1000)  return { label: "Débutant",      icon: "🥉", next: "Intermédiaire",   nextAt: 2000  };
  return                     { label: "Apprenti",      icon: "📦", next: "Débutant",        nextAt: 1000  };
}

export function getContributeurRank(cumul = 0) {
  if (cumul >= 10000) return { label: "Donateur premium", icon: "👑", next: null,               nextAt: null  };
  if (cumul >= 5000)  return { label: "Super donateur",   icon: "💎", next: "Donateur premium", nextAt: 10000 };
  if (cumul >= 2000)  return { label: "Bon donateur",     icon: "🌟", next: "Super donateur",   nextAt: 5000  };
  if (cumul >= 1000)  return { label: "Donateur simple",  icon: "🤝", next: "Bon donateur",     nextAt: 2000  };
  return                     { label: "Radin",            icon: "💰", next: "Donateur simple",  nextAt: 1000  };
}

export function getPvpRank(cumul = 0) {
  if (cumul >= 21) return { label: "Seigneur de Guerre", icon: "⚔️", next: null,                nextAt: null };
  if (cumul >= 11) return { label: "Baron",              icon: "🛡️", next: "Seigneur de Guerre", nextAt: 21  };
  if (cumul >= 6)  return { label: "Sire",               icon: "🏰", next: "Baron",             nextAt: 11  };
  if (cumul >= 3)  return { label: "Chevalier",          icon: "🗡️", next: "Sire",              nextAt: 6   };
  if (cumul >= 1)  return { label: "Écuyer",             icon: "🗡️", next: "Chevalier",         nextAt: 3   };
  return                  { label: "Manant",             icon: "🌾", next: "Écuyer",            nextAt: 1   };
}

// Coût d'action total par tier (refonte avril 2026 : un seul nombre, prélevé aléatoirement
// sur faim ou énergie via applyRandomActionCost). Ancienne forme : { hunger, fatigue } sur chaque.
export const TIER_ACTION_COST = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
};
// ── Prix de rachat de l'entrepôt (reset quotidien) ──
export const WAREHOUSE_BUYBACK_PRICES = {
  bois_brut:    { min: 1, max: 3,  label: "Bois brut",    icon: "🪵" },
  pierre:       { min: 1, max: 3,  label: "Pierre",       icon: "🪨" },
  pierre_brute: { min: 1, max: 3,  label: "Pierre taillée", icon: "🗿" },
  minerai_fer:  { min: 2, max: 5,  label: "Minerai de fer", icon: "🪨" },
  ble:          { min: 1, max: 3,  label: "Blé",           icon: "🌾" },
  laine_brute:  { min: 1, max: 4,  label: "Laine brute",  icon: "🧶" },
  herbes:       { min: 1, max: 4,  label: "Herbes",        icon: "🌿" },
  quartz_brut:  { min: 2, max: 6,  label: "Quartz brut",  icon: "🔮" },
  lingots_or:   { min: 5, max: 15, label: "Lingot d'or",  icon: "🏅" },
};

export const WAREHOUSE_DAILY_SELL_CAP = 20;

export function generateWarehouseBuybackPrices() {
  const prices = {};
  for (const [key, def] of Object.entries(WAREHOUSE_BUYBACK_PRICES)) {
    const mid = Math.floor((def.min + def.max) / 2);
    prices[key] = def.min + Math.floor(Math.random() * (mid - def.min + 1));
  }
  return prices;
}

// ── Catégories de bâtiments ──
export const BUILDING_CATEGORIES = {
  logement:   { label: "🏠 Logement",    description: "Augmente la capacité d'accueil de la ville." },
  production: { label: "⚒️ Production",  description: "Améliore la production de ressources des habitants." },
  commerce:   { label: "🏪 Commerce",    description: "Facilite les échanges et réduit les taxes." },
  bien_etre:  { label: "🌿 Bien-être",   description: "Améliore la faim, l'énergie et le confort des résidents." },
  defense:    { label: "🛡️ Défense",    description: "Protège la ville contre les attaques ennemies." },
  prestige:   { label: "👑 Prestige",    description: "Bâtiments de prestige uniques pour les villes développées." },
};

// ── Calcul maintenance journalière totale d'une ville ──
// Agrège le coût de tous ses bâtiments (avec multiplicateur résidents + niveau)
// MAINTENANCE_FULL_RESIDENTS : nb joueurs à partir duquel l'entretien est à 100%
// En dessous : entretien réduit proportionnellement, plancher à MAINTENANCE_FLOOR
export const MAINTENANCE_FULL_RESIDENTS = 20; // modifier ici pour ajuster la courbe
export const MAINTENANCE_FLOOR = 0.25;        // minimum 25% même avec 1 joueur

export function getCityDailyMaintenance(city, nbResidents = 1) {
  const buildings = city?.buildings || [];
  const maintMultiplier = Math.max(MAINTENANCE_FLOOR, Math.min(1.0, nbResidents / MAINTENANCE_FULL_RESIDENTS));
  const totals = {};
  for (const building of buildings) {
    const bType = BUILDING_TYPES[building.building_type];
    const baseMaint = bType?.maintenance ?? {};
    if (Object.keys(baseMaint).length === 0) continue;
    const level = building.level || 1;
    const levelMultiplier = (bType?.category === "production" || bType?.category === "bien_etre")
      ? Math.pow(2, level - 1)
      : 1;
    for (const [res, qty] of Object.entries(baseMaint)) {
      totals[res] = (totals[res] || 0) + Math.ceil(qty * maintMultiplier * levelMultiplier);
    }
  }
  return totals;
}
