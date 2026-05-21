// ═══════════════════════════════════════════════════════════════════════════
// rankings.js — Login streak, rangs joueur (vendeur/contributeur/PvP), XP rare
// ═══════════════════════════════════════════════════════════════════════════

// ── Récompenses connexion quotidienne (modifier ici pour rééquilibrer) ──
// 13/05/2026 — Refonte du login streak.
// Avant : paliers fixes 1/2/3/8/15/35/100 or aux jours 1/2/3/5/7/14/30.
//   → Trop généreux : un joueur stable à streak 30+ gagnait 100 or/jour
//     passifs (= ~3000 or/mois sans rien faire). Source majeure d'inflation.
// Maintenant : progression LINÉAIRE de J1 à J14 (1, 2, ..., 14 or) puis
// PLAFOND à 15 or/jour maintenu indéfiniment. Total max sur 30j ≈ 345 or
// (au lieu de 790+). Récompense la fidélité long terme sans casser l'éco.
//
// Le tableau ci-dessous n'est plus une grille de paliers (la formule est
// faite dans getRewardForStreak côté widget). Il sert juste à l'affichage
// du jalon "palier max atteint" dans l'UI.
export const STREAK_REWARDS = [
  { days: 1,  gold: 1,  label: "1 jour",     icon: "🌱" },
  { days: 7,  gold: 7,  label: "1 semaine",  icon: "🔥" },
  { days: 15, gold: 15, label: "Palier max", icon: "👑" },
];

// Récompense effective d'un streak donné. Source de vérité unique.
// Streak ≤ 0  → 0 or (sécurité, ne devrait jamais arriver en pratique)
// Streak 1-14 → streak or (linéaire)
// Streak 15+  → 15 or (plafond)
export function getStreakReward(streak) {
  if (streak <= 0) return 0;
  if (streak >= 15) return 15;
  return streak;
}

// ── XP par ressource rare échangée/consommée ──
export const RARE_RESOURCE_XP = 100;

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

// ── Couronnes : prestige magique (17/05/2026) ──
// Score = nb T1 cumulés nécessaires au craft + 10 par rang de couronne.
// Échelle : fer 34, bronze 92, argent 174, or 256.
export function getCouronnesRank(cumul = 0) {
  if (cumul >= 5000) return { label: "Souverain du Royaume", icon: "👑", next: null,                  nextAt: null };
  if (cumul >= 1500) return { label: "Grand Couronné",       icon: "🏛️", next: "Souverain du Royaume", nextAt: 5000 };
  if (cumul >= 500)  return { label: "Couronné",             icon: "🎖️", next: "Grand Couronné",       nextAt: 1500 };
  if (cumul >= 100)  return { label: "Vassal Loyal",         icon: "🛡️", next: "Couronné",             nextAt: 500  };
  if (cumul >= 34)   return { label: "Apprenti Couronnier",  icon: "⚒️", next: "Vassal Loyal",         nextAt: 100  };
  return                    { label: "Sans Titre",           icon: "🪙", next: "Apprenti Couronnier",  nextAt: 34   };
}
