// ═══════════════════════════════════════════════════════════════════════════
// travel.js — Système de voyage : routes, coûts, péage, types
// ═══════════════════════════════════════════════════════════════════════════
// 4 types de route : royale (sûre), forestier (modéré), montagneux
// (dangereux), maritime (gratuit mais 5× plus long).
// Le coût se base sur un seed déterministe (date + routeId) → tous les
// joueurs voient le même prix du jour pour une route donnée.
//
// Bonus appliqués dans computeTravelCost :
//   - Route pavée dans ville de départ : −50% frais
//   - Guilde des voyageurs (caserne) pour résident : −30% frais

import { getTodayDateStr } from "./time.js";

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
