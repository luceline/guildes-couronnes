/**
 * links.js : URL externes utilisées dans l'app.
 *
 * Centralise les liens vers les services tiers (Discord, etc.) pour qu'on n'ait
 * qu'un seul endroit à modifier quand un lien change. Évite de chercher partout
 * dans le code et d'oublier des emplacements.
 *
 * Bonne pratique : importer ces constantes plutôt que coller l'URL en dur.
 *   import { DISCORD_INVITE_URL } from "@/lib/links";
 *   <a href={DISCORD_INVITE_URL}>Discord</a>
 */

/**
 * Lien d'invitation publique vers le Discord du jeu.
 * Format invitation : https://discord.gg/XXXX (jamais expirée).
 * Utilisé sur la landing page et dans le GameLayout (header + drawer mobile).
 */
export const DISCORD_INVITE_URL = "https://discord.gg/C5vt8GYCZ";
