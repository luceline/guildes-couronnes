/**
 * repos.js : Mode "repos" — séjour temporaire dans une ville système.
 *
 * 13/05/2026 — Refonte du mode vacances.
 *
 * Au lieu d'un flag abstrait `vacation_until` qui bloque les actions du joueur
 * partout (30+ patches nécessaires), on utilise un LIEU dans le monde du jeu :
 * la ville "Repos-sur-Mer" (id stocké en BDD avec `is_bot_city: true`).
 *
 * Le joueur voyage vers cette ville (50 or, 10 min). À l'arrivée, l'UI rend une
 * vue simplifiée sans aucun panneau d'action. Pour reprendre le jeu, le joueur
 * fait un voyage retour (gratuit, 10 min) vers sa home_city.
 *
 * Côté serveur (server/players.js), les fonctions collectDailyTax,
 * refreshPlayerObjectives et applyBankingAndExpiry skippent les joueurs dont
 * la city_id pointe sur une bot_city. Donc pendant le séjour :
 *   - pas d'impôts
 *   - pas de génération de nouvelles quêtes
 *   - pas d'intérêts dépôts/prêts (vraie pause intégrale)
 *
 * Avantages vs flag vacation_until :
 *   - Pattern existant (is_bot_city) déjà filtré partout (carte, ranking, PvP,
 *     militaire, voyage). Aucun patch à ajouter pour ces aspects.
 *   - Cohérent narrativement ("le joueur est en retraite à Repos-sur-Mer").
 *   - Pas de "mode" abstrait à expliquer au joueur.
 */

// ID de la ville Repos-sur-Mer en base. Créé manuellement via PocketBase Admin
// le 13/05/2026. Si on devait recréer la ville (rare), il faudrait mettre à
// jour cet ID partout où il est référencé.
export const REPOS_CITY_ID = "9303qoira4j8eqo";

// Coût du voyage ALLER (le retour est gratuit).
export const REPOS_TRAVEL_COST = 50;

// Durée des voyages aller ET retour (en minutes). Cohérent avec un voyage
// standard moyen pour ne pas casser le pacing.
export const REPOS_TRAVEL_DURATION_MIN = 10;

/**
 * Le joueur est-il actuellement à Repos-sur-Mer ?
 * Basé sur city_id (la ville où il EST), pas home_city_id (chez lui).
 */
export function isInRepos(profile) {
  return profile?.city_id === REPOS_CITY_ID;
}

/**
 * Vérifie si le joueur peut partir à Repos-sur-Mer.
 * Retourne { ok: true } ou { ok: false, reason: "message" }.
 *
 * Règle "ne participe plus à l'économie" (13/05/2026) : le joueur doit avoir
 * réglé toutes ses affaires en cours avant de partir :
 *   - pas de prêt actif (doit rembourser)
 *   - pas de dépôt actif (doit retirer)
 *   - pas de listing marché actif (doit retirer les items en vente)
 *   - pas de challenge PvP entrant en cours (doit y répondre ou attendre)
 *   - pas en voyage déjà
 *   - pas en combat PvE actif (résoudre avant)
 *   - or suffisant pour payer les 50 or
 *
 * Le check des listings et challenges nécessite un fetch en BDD ; ces deux-là
 * sont passés en arguments séparés au check pour éviter une dépendance à la
 * couche réseau dans ce module utilitaire.
 */
export function canGoToRepos(profile, { listings = [], incomingChallenges = [] } = {}) {
  if (!profile) return { ok: false, reason: "Profil indisponible." };

  if (profile.city_id === REPOS_CITY_ID) {
    return { ok: false, reason: "Vous êtes déjà à Repos-sur-Mer." };
  }

  if ((profile.gold || 0) < REPOS_TRAVEL_COST) {
    return { ok: false, reason: `Il vous faut ${REPOS_TRAVEL_COST} or pour le voyage (vous en avez ${profile.gold || 0}).` };
  }

  if (profile.is_traveling) {
    return { ok: false, reason: "Vous êtes déjà en voyage. Attendez votre arrivée avant de repartir." };
  }

  if (profile.biome_combat_started_at && !profile.biome_combat_resolved) {
    return { ok: false, reason: "Un combat est en cours dans le biome. Terminez-le avant de partir." };
  }

  if ((profile.active_loans || []).length > 0) {
    return { ok: false, reason: "Vous avez un prêt en cours. Remboursez-le avant de partir." };
  }

  if ((profile.active_deposits || []).length > 0) {
    return { ok: false, reason: "Vous avez un dépôt en cours. Retirez-le avant de partir." };
  }

  if (listings.length > 0) {
    return { ok: false, reason: `Vous avez ${listings.length} item(s) en vente au marché. Retirez-les avant de partir.` };
  }

  if (incomingChallenges.length > 0) {
    return { ok: false, reason: "Un défi PvP est en cours contre vous. Répondez avant de partir." };
  }

  return { ok: true };
}
