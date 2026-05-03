/**
 * professions.js : source de vérité unique pour les professions du royaume.
 *
 * Avant ce fichier, plusieurs endroits maintenaient leur propre liste des
 * professions :
 *   - src/components/ProfessionChangePanel.jsx (liste avec "Producteur" obsolète)
 *   - src/components/admin/GameDataManager.jsx (autre liste en dur)
 *   - src/lib/gameData.js (PROFESSIONS objet — la vraie source canonique)
 *
 * Maintenant tout passe par ce fichier. Bénéfice :
 *   - Si on ajoute/retire une profession, 1 seul endroit à modifier (gameData.js)
 *   - Plus de risque de garder un ancien métier ("Producteur") dans une liste oubliée
 *   - Les helpers de ce fichier permettent un usage idiomatique :
 *       getProfessionsList(), getProfessionIcon(), isValidProfession()
 *
 * NOTE : la définition canonique reste dans gameData.js pour des raisons
 * historiques (gros fichier déjà importé partout). Ce fichier est juste une
 * couche d'accès propre.
 */

import { PROFESSIONS } from "./gameData";
import { getProfessionBiome as _getProfessionBiome } from "./biomes";

/**
 * Retourne la liste ordonnée des noms de professions valides.
 * Utile pour les <Select>, les itérations, les écrans admin.
 *
 * Ordre par défaut : ordre d'apparition dans gameData.js (logique métier :
 * producteurs primaires → secondaires → tertiaires).
 *
 * @returns {string[]} Ex: ["Bûcheron", "Mineur", "Fermier", ...]
 */
export function getProfessionsList() {
  return Object.keys(PROFESSIONS);
}

/**
 * Vérifie qu'une profession existe bien dans le jeu actuel.
 * Pratique pour valider les inputs utilisateur ou détecter les profils
 * avec un ancien métier supprimé (ex: "Producteur").
 *
 * @param {string} profession
 * @returns {boolean}
 */
export function isValidProfession(profession) {
  return Object.prototype.hasOwnProperty.call(PROFESSIONS, profession);
}

/**
 * Retourne l'icône emoji d'une profession.
 * @param {string} profession
 * @returns {string} L'emoji, ou "❓" si profession inconnue.
 */
export function getProfessionIcon(profession) {
  return PROFESSIONS[profession]?.icon || "❓";
}

/**
 * Retourne la description narrative d'une profession.
 * @param {string} profession
 * @returns {string|null}
 */
export function getProfessionDescription(profession) {
  return PROFESSIONS[profession]?.description || null;
}

/**
 * Retourne les items de départ d'une profession (donnés à la création de personnage).
 * @param {string} profession
 * @returns {Array} Liste d'items {item_key, item_name, item_category, quantity}
 */
export function getProfessionStartItems(profession) {
  return PROFESSIONS[profession]?.startItems || [];
}

/**
 * Retourne le biome principal associé à une profession.
 * Re-export depuis biomes.js pour avoir tous les helpers profession au même endroit.
 *
 * Note : certaines professions partagent des biomes (Alchimiste/Bûcheron en forêt,
 * Forgeron/Orfèvre en forge). Cette fonction retourne le biome "principal".
 *
 * @param {string} profession
 * @returns {string|null} La clé biome ("foret", "mine", etc.)
 */
export function getProfessionBiome(profession) {
  return _getProfessionBiome(profession);
}

/**
 * Liste détaillée des professions (utile pour l'écran admin et les sélecteurs riches).
 * Renvoie un array d'objets {name, icon, description, startItems}.
 *
 * @returns {Array}
 */
export function getProfessionsDetailed() {
  return Object.entries(PROFESSIONS).map(([name, def]) => ({
    name,
    icon: def.icon,
    description: def.description,
    startItems: def.startItems,
  }));
}
