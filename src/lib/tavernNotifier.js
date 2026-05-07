/**
 * tavernNotifier.js : helper centralisé pour les messages système taverne.
 *
 * Pourquoi : avant mai 2026, chaque endroit du code créait directement des
 * TavernMessage avec base44.entities.TavernMessage.create({...}). Problème :
 * la collection PocketBase a `is_active` avec DEFAULT FALSE. Quand un appel
 * oubliait de passer `is_active: true` (ce qui est arrivé partout sauf dans
 * TavernPage.jsx pour les messages joueurs), le message était stocké en base
 * mais EXCLU de l'affichage par le filter (m.is_active !== false).
 *
 * Résultat : 113 messages cachés en base contre 26 visibles. Razzias, hibou,
 * étoile filante, événements maire, alertes éclaireur, candidatures...
 * tout invisible.
 *
 * Solution : tout passe désormais par ce helper qui force is_active: true et
 * définit clairement l'audience (publique = grande salle, résidents = salle
 * privée).
 *
 * Usage :
 *   await notifyTavern({
 *     cityId: city.id,
 *     audience: "residents",          // "public" ou "residents"
 *     authorName: "🏛️ Mairie",
 *     message: "🗡️ Razzia réussie !",
 *   });
 *
 * Pour les messages JOUEUR (chat libre), continuer d'utiliser directement
 * TavernMessage.create dans TavernPage.jsx (déjà correct, force is_active).
 */

import { base44 } from "@/api/base44Client";

/**
 * Crée un message système dans la taverne.
 *
 * @param {Object} opts
 * @param {string} opts.cityId       - ID de la ville cible (obligatoire)
 * @param {"public"|"residents"} opts.audience - Salle d'affichage
 *   - "public"    : grande salle, visible par tous les joueurs en ville
 *   - "residents" : salle privée, visible seulement par les résidents
 * @param {string} opts.message      - Texte du message
 * @param {string} opts.authorName   - Nom affiché de l'auteur (ex: "🏛️ Mairie")
 * @param {string} [opts.authorEmail="system"] - Email auteur (défaut: "system")
 * @param {string} [opts.profession=""]        - Profession (cosmétique)
 *
 * @returns {Promise<Object|null>} le message créé, ou null si erreur (silencieux)
 */
export async function notifyTavern({
  cityId,
  audience = "residents",
  message,
  authorName,
  authorEmail = "system",
  profession = "",
}) {
  if (!cityId || !message || !authorName) {
    console.warn("[notifyTavern] params manquants:", { cityId, message, authorName });
    return null;
  }
  try {
    const record = await base44.entities.TavernMessage.create({
      city_id:      cityId,
      author_email: authorEmail,
      author_name:  authorName,
      profession,
      message,
      is_private:   audience === "residents",
      is_active:    true,
    });
    return record;
  } catch (e) {
    console.warn("[notifyTavern] create failed:", e);
    return null;
  }
}
