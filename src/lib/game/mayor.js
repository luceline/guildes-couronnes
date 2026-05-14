// ═══════════════════════════════════════════════════════════════════════════
// mayor.js — Mairie, maintenance ville, changement de profession
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  MIROIR SERVEUR : getCityDailyMaintenance est dupliquée côté serveur.
// Toute modification de la formule DOIT être répercutée sur
// /opt/guildes/server_reset_v2/lib/gameData.js.

import { BUILDING_TYPES } from "./buildings.js";

// ── Mairie ──
// Coût fixe pour devenir maire : 20💰
export const MAYOR_COST_MAX = 20;
export const MAYOR_COST_MAX_PALAIS = 20;
export const MAYOR_DAYS = 10;
export const PROFESSION_CHANGE_COST = 20; // or détruit (n'enrichit pas la ville)

export function generateMayorCost() {
  return 20;
}

// ── Coût d'entretien journalier d'un seul bâtiment ──
// 14/05/2026 — Source unique de vérité de la règle d'entretien.
// Formule : qty × level (additif, toutes catégories, sans multiplicateur résidents).
// Retourne {} si le bâtiment n'a pas de maintenance définie.
export function getBuildingMaintenance(building) {
  if (!building) return {};
  const bType = BUILDING_TYPES[building.building_type];
  const baseMaint = bType?.maintenance ?? {};
  if (Object.keys(baseMaint).length === 0) return {};
  const level = building.level || 1;
  const result = {};
  for (const [res, qty] of Object.entries(baseMaint)) {
    result[res] = qty * level;
  }
  return result;
}

// ── Calcul maintenance journalière totale d'une ville ──
// Agrège le coût de tous ses bâtiments via getBuildingMaintenance.
// 14/05/2026 — Refonte : retrait du multiplicateur résidents + level additif uniforme.
export function getCityDailyMaintenance(city) {
  const buildings = city?.buildings || [];
  const totals = {};
  for (const building of buildings) {
    const maint = getBuildingMaintenance(building);
    for (const [res, qty] of Object.entries(maint)) {
      totals[res] = (totals[res] || 0) + qty;
    }
  }
  return totals;
}
