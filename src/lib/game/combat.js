// ═══════════════════════════════════════════════════════════════════════════
// combat.js — Système de combat zoné + upgrades libre-service
// ═══════════════════════════════════════════════════════════════════════════
// Refonte avril 2026 (zonage) + v4 (upgrades libre-service) + v5 (durabilité
// au combat PvP uniquement, plus de casse aléatoire).
//
// 4 zones : tête / torse / bras / jambes.
// 6 slots : weapon, shield, head_def, torso_def, arms_def, legs_def.
// Items grade 0 → 5 (+1 à +6 d'effet). Items combat T1 craftables.

import { ITEMS as ITEMS_DEF } from "../craftingData.js";

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
export const COMBAT_SLOTS = [
  "weapon",
  "shield",
  "head_def",
  "torso_def",
  "arms_def",
  "legs_def",
];

// Mapping slot → { zone, type }
// "weapon" et "shield" n'ont pas de zone fixe.
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
export function getCombatItemValue(grade) {
  return 1 + (grade ?? 0);
}

/**
 * @deprecated REFONTE v4 — la casse aléatoire au combat a été supprimée.
 * Stub conservé pour compat avec combatPvP.js.
 */
export function getCombatBreakPct() {
  return 0;
}

/** @deprecated REFONTE v4 — tableau de 0 conservé pour rétro-compat. */
export const COMBAT_BREAK_PCT_BY_GRADE = [0, 0, 0, 0, 0, 0];

// ─────────────────────────────────────────────
// UPGRADES LIBRE-SERVICE (depuis l'onglet Combat)
// 5 ressources requises par upgrade : Bois, Minerai, Quartz, Pierre, Laine.
// Blé et Herbes intentionnellement EXCLUS (consommables).
// ─────────────────────────────────────────────

export const COMBAT_UPGRADE_ATK_ITEMS = ["epee"];
export const COMBAT_UPGRADE_DEF_ITEMS = ["heaume", "cuirasse", "brassard", "jambiere"];

// Coûts d'amélioration par grade (g0→g1, g1→g2, ..., g4→g5)
// EQUILIBRAGE v5 (09/05/2026) - 5 ressources egales.
// Progression x2 par palier. Ratio épée x4 vs armure.
export const COMBAT_UPGRADE_COSTS = {
  def: [
    { bois_brut: 2,  minerai_fer: 2,  quartz_brut: 2,  pierre: 2,  laine_brute: 2  },
    { bois_brut: 3,  minerai_fer: 3,  quartz_brut: 3,  pierre: 3,  laine_brute: 3  },
    { bois_brut: 6,  minerai_fer: 6,  quartz_brut: 6,  pierre: 6,  laine_brute: 6  },
    { bois_brut: 12, minerai_fer: 12, quartz_brut: 12, pierre: 12, laine_brute: 12 },
    { bois_brut: 23, minerai_fer: 23, quartz_brut: 23, pierre: 23, laine_brute: 23 },
  ],
  atk: [
    { bois_brut: 6,  minerai_fer: 6,  quartz_brut: 6,  pierre: 6,  laine_brute: 6  },
    { bois_brut: 12, minerai_fer: 12, quartz_brut: 12, pierre: 12, laine_brute: 12 },
    { bois_brut: 23, minerai_fer: 23, quartz_brut: 23, pierre: 23, laine_brute: 23 },
    { bois_brut: 47, minerai_fer: 47, quartz_brut: 47, pierre: 47, laine_brute: 47 },
    { bois_brut: 92, minerai_fer: 92, quartz_brut: 92, pierre: 92, laine_brute: 92 },
  ],
  shield: [
    { bois_brut: 6,  minerai_fer: 6,  quartz_brut: 6,  pierre: 6,  laine_brute: 6  },
    { bois_brut: 12, minerai_fer: 12, quartz_brut: 12, pierre: 12, laine_brute: 12 },
    { bois_brut: 23, minerai_fer: 23, quartz_brut: 23, pierre: 23, laine_brute: 23 },
    { bois_brut: 47, minerai_fer: 47, quartz_brut: 47, pierre: 47, laine_brute: 47 },
    { bois_brut: 92, minerai_fer: 92, quartz_brut: 92, pierre: 92, laine_brute: 92 },
  ],
};

// Cooldowns d'amélioration (en secondes) par grade visé. PAR ITEM.
// 11/05/2026 : valeurs doublées (×2) pour ralentir la progression PvP.
export const COMBAT_UPGRADE_COOLDOWN_SEC = [120, 240, 480, 960, 1920];

// Plage de tarif autorisée pour le service d'amélioration proposé par un artisan.
// Le client paie cette somme à l'artisan + 20% à la trésorerie de la ville.
export const COMBAT_UPGRADE_PRICE_MIN = 0;
export const COMBAT_UPGRADE_PRICE_MAX = 500;
export const COMBAT_UPGRADE_ARTISAN_SHARE = 0.80;
export const COMBAT_UPGRADE_CITY_SHARE = 0.20;

export function getCombatUpgradeCost(type, currentGrade) {
  if (currentGrade < 0 || currentGrade >= COMBAT_MAX_GRADE) return null;
  const arr = COMBAT_UPGRADE_COSTS[type];
  return arr ? arr[currentGrade] : null;
}

export function canUpgradeCombatItem(inventory, type, currentGrade) {
  const cost = getCombatUpgradeCost(type, currentGrade);
  if (!cost) return false;
  for (const [resKey, qty] of Object.entries(cost)) {
    const stock = (inventory || []).find(i => i.item_key === resKey)?.quantity || 0;
    if (stock < qty) return false;
  }
  return true;
}

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

// ── Helpers équipement / score ──

export function getEquippedItem(profile, slot) {
  return profile?.equipment?.[slot] || null;
}

// Score d'attaque universel : effet de l'épée équipée (slot "weapon").
export function getCombatAttackScore(profile) {
  const equipped = getEquippedItem(profile, "weapon");
  if (!equipped) return 0;
  return getCombatItemValue(equipped.grade);
}

// Compat : ancienne fonction zone-based, redirige vers le score universel.
export function getAttackScoreByZone(profile /* , zone */) {
  return getCombatAttackScore(profile);
}

export function getDefenseScoreByZone(profile, zone) {
  const slot = `${zone}_def`;
  const equipped = getEquippedItem(profile, slot);
  if (!equipped) return 0;
  return getCombatItemValue(equipped.grade);
}

// ── Alias rétro-compat ──

// Phase 3 Option B : 1 seule arme universelle.
export function getAttackScore(profile) {
  return getCombatAttackScore(profile);
}

// Score de défense TOTAL (somme des 4 zones) — conservé pour compatibilité affichage.
export function getDefenseScore(profile) {
  return COMBAT_ZONES.reduce((sum, zone) => sum + getDefenseScoreByZone(profile, zone), 0);
}

// getCombatScore conservé pour compat (attaque seulement, utilisé par le voleur).
export function getCombatScore(profile) {
  return getAttackScore(profile);
}

// ── Vol d'or ──

// Progression du % de vol selon le grade de l'arme (REFONTE v4).
// G0 = 10%, G5 = 25%. Capé à COMBAT_STEAL_MAX_GOLD (100💰) en valeur absolue.
export const COMBAT_STEAL_PCT_BY_GRADE = [0.10, 0.13, 0.16, 0.19, 0.22, 0.25];

export function getCombatStealPct(itemKey, grade = 0) {
  const item = ITEMS_DEF?.[itemKey];
  if (!item) return 0;
  const baseAtG0 = item.steal_pct ?? 0;
  const idx = Math.max(0, Math.min(grade ?? 0, COMBAT_STEAL_PCT_BY_GRADE.length - 1));
  const standardG0 = COMBAT_STEAL_PCT_BY_GRADE[0]; // 0.10
  const standardAtGrade = COMBAT_STEAL_PCT_BY_GRADE[idx];
  const delta = standardAtGrade - standardG0;
  return Math.max(0, baseAtG0 + delta);
}

// ── HP / KO ──

export function getPlayerHP(profile) {
  if (profile?.hp === undefined || profile?.hp === null) return COMBAT_MAX_HP;
  return Math.max(0, Math.min(COMBAT_MAX_HP, profile.hp));
}

export function isPlayerKO(profile) {
  if (getPlayerHP(profile) <= 0) return true;
  if (profile?.hp_ko_until && new Date(profile.hp_ko_until) > new Date()) return true;
  return false;
}

// ── Durabilité (re-export de craftingData) ──
// EQUIPMENT_KEYS et EQUIPMENT_DURABILITY sont dérivés automatiquement depuis ITEMS dans craftingData.js
// Conservés ici pour rétrocompatibilité — se synchronisent avec craftingData.ITEMS
export { EQUIPMENT_KEYS, EQUIPMENT_DURABILITY } from "../craftingData.js";
export const EQUIPMENT_MAX_DURABILITY = 10;
