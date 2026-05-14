// ═══════════════════════════════════════════════════════════════════════════
// housing.js — Niveaux de logement personnel du joueur
// ═══════════════════════════════════════════════════════════════════════════
// HOUSING_MAINTENANCE est encore référencé pour rétro-compatibilité avec
// d'anciens calculs (les vrais coûts d'entretien sont aujourd'hui dans
// HOUSING[level].cost et BUILDING_TYPES.maison.maintenance).

export const HOUSING_MAINTENANCE = {
  tente: 0, cabane: 3, maison: 12, manoir: 45,
};

export const HOUSING = {
  tente:  { name: "Tente",   cost: 0,    icon: "⛺", capacity: 30,  fatigueBonus: 2,  hungerBonus: 2  },
  cabane: { name: "Cabane",  cost: 200,  icon: "🛖", capacity: 60,  fatigueBonus: 5,  hungerBonus: 5  },
  maison: { name: "Maison",  cost: 800,  icon: "🏠", capacity: 90,  fatigueBonus: 8,  hungerBonus: 8  },
  manoir: { name: "Manoir",  cost: 3000, icon: "🏰", capacity: 120, fatigueBonus: 10, hungerBonus: 10 },
};
