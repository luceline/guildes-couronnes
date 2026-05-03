// ─────────────────────────────────────────────
// SYSTÈME MILITAIRE : Données et logique de combat
// ─────────────────────────────────────────────

import { getCityTier } from "./gameData";
import { hasInInventory } from "./inventoryHelpers";

// ── Définition des unités ──────────────────────────────────────────────────
// ── Coûts fixes militaires ──
export const WAR_DECLARATION_COST = 75; // or détruit sur la trésorerie
export const WAR_CONTRIBUTION_WINDOW_MIN = 30;

// ── Jauges ravitaillement armée (REFONTE ITEMS v5) ──
// T3 et T4 sont désormais spécialisés :
//   T3 perso = +20 faim/énergie INSTANT pour le joueur (handlers Production/Inventory)
//   T4 armée = +80 nourriture/énergie pour la ville (déposé par le maire)
// Les valeurs ci-dessous sont utilisées quand le maire dépose l'item en entrepôt.
export const FOOD_VALUES = {
  ble:          1,    // T1
  farine:       5,    // T2
  pain:         20,   // T3 (refonte v5 : 10 → 20, cohérent avec effet perso)
  ragout:       80,   // T4 (refonte v5 : 50 → 80, spécialisation militaire)
};
export const ENERGY_VALUES = {
  herbes:       1,    // T1
  extrait:      5,    // T2
  potion_soin:  20,   // T3 (refonte v5 : 15 → 20, cohérent avec effet perso)
  potion_endur: 80,   // T4 (refonte v5 : 50 → 80, spécialisation militaire)
}; // minutes pour contribuer des unités

export const UNIT_TYPES = {
  milicien: {
    name: "Milicien",
    icon: "🗡️",
    atk: 10,
    def: 5,
    cost: { bois_brut: 3, minerai_fer: 2 },
    goldCost: 5,
    goldValue: 25,
    special: null,
    counters: null,
    entretien: 1,
    food_cost: 1,   // points nourriture/jour
    energy_cost: 0, // points énergie/jour
    palierRequired: 1,
    description: "Unité de base, peu coûteuse.",
  },
  archer: {
    name: "Archer",
    icon: "🏹",
    atk: 5,
    def: 15,
    cost: { laine_brute: 3, bois_brut: 2 },
    goldCost: 5,
    goldValue: 25,
    special: "anti_cavalier",
    counters: null,
    entretien: 1,
    food_cost: 2,
    energy_cost: 0,
    palierRequired: 1,
    description: "Défenseur efficace. ×1.5 contre la cavalerie.",
  },
  fantassin: {
    name: "Fantassin",
    icon: "🪖",
    atk: 15,
    def: 20,
    cost: { pierre: 4, minerai_fer: 2 },
    goldCost: 8,
    goldValue: 30,
    special: null,
    counters: null,
    entretien: 2,
    food_cost: 3,
    energy_cost: 0,
    palierRequired: 2,
    description: "Unité polyvalente, bon équilibre ATK/DEF.",
  },
  cavalier: {
    name: "Cavalier",
    icon: "🐴",
    atk: 30,
    def: 10,
    cost: { lingots_fer: 2, bois_brut: 2 },
    goldCost: 15,
    goldValue: 40,
    special: null,
    counters: "archer",
    entretien: 3,
    food_cost: 4,
    energy_cost: 1,
    palierRequired: 2,
    description: "Fort en attaque mais vulnérable aux archers.",
  },
  catapulte: {
    name: "Catapulte",
    icon: "💥",
    atk: 50,
    def: 0,
    cost: { planches: 5, minerai_fer: 3 },
    goldCost: 30,
    goldValue: 90,
    special: "siege",
    counters: null,
    entretien: 5,
    food_cost: 2,
    energy_cost: 4,
    palierRequired: 3,
    description: "Réduit la DEF adverse de 30%. Aucune défense.",
  },
  chevalier: {
    name: "Chevalier",
    icon: "⚔️",
    atk: 60,
    def: 30,
    cost: { lingots_fer: 3, lingots_or: 1 },
    goldCost: 50,
    goldValue: 105,
    special: null,
    counters: null,
    entretien: 10,
    food_cost: 5,
    energy_cost: 2,
    palierRequired: 4,
    description: "Élite militaire. Très puissant, très coûteux.",
  },
};

// ── Ordre des pertes (les plus faibles meurent en premier) ────────────────
export const UNIT_ORDER_BY_STRENGTH = ["milicien", "archer", "fantassin", "cavalier", "catapulte", "chevalier"];

// ── Calcul entretien total d'une armée (or/jour) ──────────────────────────
export function computeDailyMaintenance(units = {}) {
  let total = 0;
  for (const [type, qty] of Object.entries(units)) {
    const u = UNIT_TYPES[type];
    if (u && qty > 0) total += u.entretien * qty;
  }
  return total;
}

// ── Bonus ATK/DEF par palier de ville ────────────────────────────────────
export function getCityMilitaryBonus(lingotsCumul = 0) {
  const tier = getCityTier(lingotsCumul);
  const bonuses = { 1: 0, 2: 5, 3: 10, 4: 15, 5: 20, 6: 25 };
  return (bonuses[tier.level] || 0) / 100;
}

// ── Calcul score offensif ─────────────────────────────────────────────────
export function computeAttackScore(units, lingotsCumul = 0, isMayor = false) {
  let atk = 0;
  for (const [type, qty] of Object.entries(units)) {
    const u = UNIT_TYPES[type];
    if (!u || !qty) continue;
    atk += u.atk * qty;
  }
  const cityBonus = getCityMilitaryBonus(lingotsCumul);
  const mayorBonus = isMayor ? 0.10 : 0;
  return Math.round(atk * (1 + cityBonus + mayorBonus));
}

// ── Calcul score défensif ─────────────────────────────────────────────────
export function computeDefenseScore(units, city, hasCatapulte = false) {
  let def = 0;
  const attackerHasCavalier = Object.keys(units).includes("cavalier") && (units.cavalier || 0) > 0;

  for (const [type, qty] of Object.entries(units)) {
    const u = UNIT_TYPES[type];
    if (!u || !qty) continue;
    let unitDef = u.def;
    if (type === "archer" && attackerHasCavalier) unitDef = Math.round(unitDef * 1.5);
    def += unitDef * qty;
  }

  const buildings = city?.buildings || [];
  const remparts = buildings.filter(b => b.building_type === "remparts").length;
  const palais = buildings.filter(b => b.building_type === "palais").length;
  def += remparts * 20;
  def += palais * 15;

  const cityBonus = getCityMilitaryBonus(city?.lingots_cumul || 0);
  def = Math.round(def * (1 + cityBonus));

  if (hasCatapulte) def = Math.round(def * 0.70);

  return Math.max(1, def);
}

// ── Table des résultats ───────────────────────────────────────────────────
export function getCombatResult(atkScore, defScore) {
  const ratio = atkScore / Math.max(1, defScore);

  if (ratio < 0.5)  return { outcome: "defeat_total",    lossAtk: 0.80, lossDef: 0.10, lootPct: 0,    lingots: 0, label: "L'armée s'est brisée sur les murailles" };
  if (ratio < 0.8)  return { outcome: "defeat",          lossAtk: 0.50, lossDef: 0.20, lootPct: 0,    lingots: 0, label: "Les soldats ont battu en retraite" };
  if (ratio < 1.0)  return { outcome: "short_victory",   lossAtk: 0.30, lossDef: 0.50, lootPct: 0.10, lingots: 0, label: "La brèche fut courte mais fructueuse" };
  if (ratio < 1.5)  return { outcome: "victory",         lossAtk: 0.20, lossDef: 0.70, lootPct: 0.15, lingots: 1, label: "La ville fut prise d'assaut" };
  if (ratio < 2.0)  return { outcome: "net_victory",     lossAtk: 0.10, lossDef: 0.90, lootPct: 0.20, lingots: 2, label: "La garnison ennemie fut balayée" };
  return              { outcome: "crushing_victory",  lossAtk: 0.05, lossDef: 1.00, lootPct: 0.25, lingots: 3, label: "Victoire écrasante : la ville est à genoux" };
}

// ── Appliquer les pertes ──────────────────────────────────────────────────
export function applyLosses(units, lossPct) {
  if (lossPct <= 0) return { ...units };
  const result = { ...units };
  let totalUnits = Object.values(result).reduce((s, v) => s + (v || 0), 0);
  let toKill = Math.ceil(totalUnits * lossPct);

  for (const type of UNIT_ORDER_BY_STRENGTH) {
    if (toKill <= 0) break;
    const available = result[type] || 0;
    if (available <= 0) continue;
    const killed = Math.min(available, toKill);
    result[type] = available - killed;
    toKill -= killed;
  }
  return result;
}

// ── Résoudre un combat complet ────────────────────────────────────────────
export function resolveCampaign(campaign, attackerCity, defenderCity, defenderArmy) {
  const committedUnits = campaign.units_committed || {};
  const defenderUnits = defenderArmy?.units || {};
  const hasCatapulte = (committedUnits.catapulte || 0) > 0;
  const mayorActive = !!(attackerCity?.mayor_id && attackerCity?.mayor_until &&
    attackerCity.mayor_until >= new Date().toISOString().split("T")[0]);

  const atkScore = computeAttackScore(committedUnits, attackerCity?.lingots_cumul || 0, mayorActive);
  const defScore = computeDefenseScore(defenderUnits, defenderCity, hasCatapulte);
  const combatResult = getCombatResult(atkScore, defScore);

  const survivingAttackers = applyLosses(committedUnits, combatResult.lossAtk);
  const survivingDefenders = applyLosses(defenderUnits, combatResult.lossDef);

  const defWarehouse = defenderCity?.warehouse || {};
  const loot = {};
  if (combatResult.lootPct > 0) {
    for (const [res, qty] of Object.entries(defWarehouse)) {
      if (typeof qty === "number" && qty > 0 && res !== "lingot_royal") {
        const stolen = Math.floor(qty * combatResult.lootPct);
        if (stolen > 0) loot[res] = stolen;
      }
    }
  }

  return {
    atkScore,
    defScore,
    ratio: atkScore / Math.max(1, defScore),
    ...combatResult,
    survivingAttackers,
    survivingDefenders,
    loot,
    lingotsStolen: combatResult.lingots,
  };
}

// ── Coût total recrutement (ressources + or) ──────────────────────────────
export function getRecruitCost(unitType, quantity) {
  const u = UNIT_TYPES[unitType];
  if (!u) return { resources: {}, gold: 0 };
  return {
    resources: Object.fromEntries(
      Object.entries(u.cost).map(([res, qty]) => [res, qty * quantity])
    ),
    gold: u.goldCost * quantity,
  };
}

// ── Vérifier si un joueur peut recruter ──────────────────────────────────
export function canAffordRecruitment(inventory, gold, unitType, quantity) {
  const { resources, gold: goldNeeded } = getRecruitCost(unitType, quantity);
  if ((gold || 0) < goldNeeded) return false;
  for (const [res, qty] of Object.entries(resources)) {
    if (!hasInInventory(inventory, res, qty)) return false;
  }
  return true;
}

// ── Palier requis ─────────────────────────────────────────────────────────
export function unitAvailableForCity(unitType, lingotsCumul = 0) {
  const u = UNIT_TYPES[unitType];
  if (!u) return false;
  const tier = getCityTier(lingotsCumul);
  return tier.level >= u.palierRequired;
}

// ── Total unités ──────────────────────────────────────────────────────────
export function totalUnits(units = {}) {
  return Object.values(units).reduce((s, v) => s + (v || 0), 0);
}

// ── Puissance d'une armée ─────────────────────────────────────────────────
export function armyPower(units = {}) {
  let power = 0;
  for (const [type, qty] of Object.entries(units)) {
    const u = UNIT_TYPES[type];
    if (u && qty) power += (u.atk + u.def) * qty;
  }
  return power;
}