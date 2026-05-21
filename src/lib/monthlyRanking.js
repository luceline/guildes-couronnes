// src/lib/monthlyRanking.js
//
// Compteurs mensuels pour le concours du mois (récompenses 100/50/20 or top 3
// le 1er de chaque mois pour les 4 catégories de classement).
//
// MÉCANIQUE — Reset paresseux :
//   Chaque profile a un champ `cumul_month_key` au format "YYYY-MM".
//   Quand on incrémente un cumul_X_mois pour un joueur :
//     - Si profile.cumul_month_key === mois courant → on incrémente direct
//     - Sinon → on RESET tous les _mois à 0 ET on met le delta sur _mois
//                puis on met à jour cumul_month_key au mois courant
//
//   Avantage : pas de cron de reset (le reset arrive "lazy" à la prochaine
//   action du joueur après le 1er du mois). Le cron `monthly_rewards.pb.js`
//   distribue juste les récompenses, il ne touche pas aux compteurs.
//
// CATÉGORIES SUIVIES (mirror des onglets de PlayerRanking.jsx) :
//   - xp                       → champ BDD : cumul_xp_mois
//   - ventes_or                → champ BDD : cumul_ventes_or_mois
//   - contributions_warehouse  → champ BDD : cumul_contributions_warehouse_mois
//   - couronnes                → champ BDD : cumul_couronnes_mois (existe déjà)

/**
 * Renvoie le mois courant au format "YYYY-MM" (UTC).
 * Choix UTC pour être cohérent avec le cron PB qui tourne en UTC.
 */
export function getCurrentMonthKey() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Mapping catégorie → champ BDD _mois.
 * Si tu ajoutes une catégorie, ajoute-la ici ET dans le cron PB.
 */
const FIELD_MAP = {
  xp:                      'cumul_xp_mois',
  ventes_or:               'cumul_ventes_or_mois',
  contributions_warehouse: 'cumul_contributions_warehouse_mois',
  couronnes:               'cumul_couronnes_mois',
};

const ALL_MONTHLY_FIELDS = Object.values(FIELD_MAP);

/**
 * Calcule les updates BDD à appliquer pour incrémenter un ou plusieurs
 * compteurs mensuels. Gère le reset paresseux si le mois a changé.
 *
 * @param {object} profile  Le profile actuel (au minimum cumul_month_key + tous les _mois)
 * @param {object} deltas   Map catégorie → valeur à ajouter
 *                          Ex: { ventes_or: 50, xp: 10 }
 * @returns {object}        Objet à fusionner dans l'update PB
 *
 * USAGE :
 *   await base44.entities.PlayerProfile.update(profile.id, {
 *     cumul_ventes_or: (profile.cumul_ventes_or || 0) + 50,
 *     ...getMonthlyUpdates(profile, { ventes_or: 50 }),
 *   });
 */
export function getMonthlyUpdates(profile, deltas) {
  if (!profile || !deltas || typeof deltas !== 'object') return {};

  const currentMonthKey = getCurrentMonthKey();
  const profileMonthKey = profile.cumul_month_key || '';
  const isStaleMonth = profileMonthKey !== currentMonthKey;

  const updates = {};

  if (isStaleMonth) {
    // Mois changé (ou premier passage) : reset tous les _mois à 0
    for (const field of ALL_MONTHLY_FIELDS) {
      updates[field] = 0;
    }
    updates.cumul_month_key = currentMonthKey;
  }

  // Appliquer les deltas par-dessus le reset
  for (const [category, delta] of Object.entries(deltas)) {
    const field = FIELD_MAP[category];
    if (!field) {
      console.warn(`[monthlyRanking] catégorie inconnue: ${category}`);
      continue;
    }
    const delta_num = Number(delta) || 0;
    if (delta_num === 0) continue;

    const baseValue = isStaleMonth ? 0 : (Number(profile[field]) || 0);
    updates[field] = baseValue + delta_num;
  }

  return updates;
}


/**
 * Calcule le temps restant avant la fin du mois courant (UTC).
 * Le cron tourne le 1er à 00:05 UTC, donc l'échéance c'est ce moment-là.
 *
 * @returns {{ days, hours, minutes, totalMs, label }}
 *   label : ex "Plus que 12j 4h" ou "Plus que 4h 23m" ou "Moins d'une minute"
 */
export function getTimeUntilMonthlyReset() {
  const now = new Date();
  // Premier jour du mois suivant à 00:05 UTC (alignement avec le cron PB)
  const nextReset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,  // mois suivant
    1,                       // jour 1
    0, 5, 0, 0,             // 00:05:00
  ));
  const totalMs = nextReset.getTime() - now.getTime();
  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, totalMs: 0, label: 'Récompenses imminentes' };
  }

  const days = Math.floor(totalMs / 86400000);
  const hours = Math.floor((totalMs % 86400000) / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);

  let label;
  if (days > 0) {
    label = `Plus que ${days}j ${hours}h`;
  } else if (hours > 0) {
    label = `Plus que ${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    label = `Plus que ${minutes}m`;
  } else {
    label = `Moins d'une minute`;
  }

  return { days, hours, minutes, totalMs, label };
}


/**
 * Récompenses du concours mensuel par catégorie.
 * Source de vérité unique côté client. Le cron PB applique les mêmes valeurs
 * (mirror dans monthly_rewards.pb.js).
 */
export const MONTHLY_REWARDS_GOLD = [100, 50, 20]; // top 1 / 2 / 3
