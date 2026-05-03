/**
 * playerBuffs.js : helpers centralisés pour les buffs/bonus du profil joueur.
 *
 * Avant ce fichier, des patterns se répétaient partout (5+ fichiers) :
 *   const isActive = profile.biome_cooldown_bonus_expires_at &&
 *     new Date(profile.biome_cooldown_bonus_expires_at) > new Date();
 *
 *   updates.biome_cooldown_bonus_expires_at = new Date(Date.now() + 3600000).toISOString();
 *
 * Avec le risque de fautes de frappe sur le nom du champ ou d'oubli du `> new Date()`.
 *
 * Maintenant on a des helpers explicites :
 *   if (isBiomeBuffActive(profile)) { ... }
 *   activateBiomeBuff(updates, { hours: 1, value: 0.10 });
 *
 * Liste des buffs gérés ici :
 *   - biome_cooldown_bonus : −cooldown sur les actions, gagné via combat épique
 *     champs : biome_cooldown_bonus_expires_at + biome_double_prod_bonus
 *   - biome_harvest_bonus : +1 récolte T1 pendant 5 min, déclenché par item rare
 *     champ : biome_harvest_bonus_expires_at
 */

// ── Constantes des durées ──
const BIOME_BUFF_DURATION_MS = 3600 * 1000;          // 1h pour le buff cooldown
const BIOME_HARVEST_DURATION_MS = 5 * 60 * 1000;     // 5 min pour le bonus récolte T1
const DEFAULT_DOUBLE_PROD_VALUE = 0.10;              // 10% chance de double prod par défaut

// ────────────────────────────────────────────────────────────────────────────
// BIOME COOLDOWN BUFF (combat épique → 1h de bonus cooldown + chance double prod)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Le joueur a-t-il actuellement le buff biome (cooldown réduit + double prod) ?
 * @param {object} profile - Le profil joueur
 * @returns {boolean}
 */
export function isBiomeBuffActive(profile) {
  if (!profile?.biome_cooldown_bonus_expires_at) return false;
  return new Date(profile.biome_cooldown_bonus_expires_at) > new Date();
}

/**
 * Retourne la valeur du bonus double-prod si actif, 0 sinon.
 * @param {object} profile
 * @returns {number} 0 si pas de buff, sinon la chance (ex: 0.10)
 */
export function getBiomeDoubleProdChance(profile) {
  if (!isBiomeBuffActive(profile)) return 0;
  return profile?.biome_double_prod_bonus ?? DEFAULT_DOUBLE_PROD_VALUE;
}

/**
 * Combien de millisecondes avant expiration du buff biome ? 0 si pas actif.
 * @param {object} profile
 * @returns {number}
 */
export function getBiomeBuffRemainingMs(profile) {
  if (!profile?.biome_cooldown_bonus_expires_at) return 0;
  const expires = new Date(profile.biome_cooldown_bonus_expires_at).getTime();
  return Math.max(0, expires - Date.now());
}

/**
 * Active le buff biome (cooldown bonus + chance double prod) pour la durée standard.
 * Mute l'objet `updates` (pour qu'il soit prêt à être passé à PlayerProfile.update).
 * @param {object} updates - L'objet updates à muter
 * @param {object} [opts]
 * @param {number} [opts.value] - Valeur du bonus double prod (défaut 0.10)
 * @param {number} [opts.durationMs] - Durée en ms (défaut 1h)
 */
export function activateBiomeBuff(updates, opts = {}) {
  const { value = DEFAULT_DOUBLE_PROD_VALUE, durationMs = BIOME_BUFF_DURATION_MS } = opts;
  updates.biome_double_prod_bonus = value;
  updates.biome_cooldown_bonus_expires_at = new Date(Date.now() + durationMs).toISOString();
}

// ────────────────────────────────────────────────────────────────────────────
// BIOME HARVEST BONUS (+1 récolte T1 pendant 5 min)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Le joueur a-t-il actuellement le bonus de récolte T1 (+1) actif ?
 * @param {object} profile
 * @returns {boolean}
 */
export function isBiomeHarvestActive(profile) {
  if (!profile?.biome_harvest_bonus_expires_at) return false;
  return new Date(profile.biome_harvest_bonus_expires_at) > new Date();
}

/**
 * Active le bonus +1 récolte T1 pour la durée standard (5 min).
 * Mute l'objet `updates`.
 * @param {object} updates
 * @param {object} [opts]
 * @param {number} [opts.durationMs] - Durée en ms (défaut 5 min)
 */
export function activateBiomeHarvestBonus(updates, opts = {}) {
  const { durationMs = BIOME_HARVEST_DURATION_MS } = opts;
  updates.biome_harvest_bonus_expires_at = new Date(Date.now() + durationMs).toISOString();
}

/**
 * Combien de millisecondes avant expiration du bonus récolte ? 0 si pas actif.
 * @param {object} profile
 * @returns {number}
 */
export function getBiomeHarvestRemainingMs(profile) {
  if (!profile?.biome_harvest_bonus_expires_at) return 0;
  const expires = new Date(profile.biome_harvest_bonus_expires_at).getTime();
  return Math.max(0, expires - Date.now());
}
