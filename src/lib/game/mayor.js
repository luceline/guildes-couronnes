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

// ── Calcul maintenance journalière totale d'une ville ──
// Agrège le coût de tous ses bâtiments (avec multiplicateur résidents + niveau).
// MAINTENANCE_FULL_RESIDENTS : nb joueurs à partir duquel l'entretien est à 100%.
// En dessous : entretien réduit proportionnellement, plancher à MAINTENANCE_FLOOR.
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
