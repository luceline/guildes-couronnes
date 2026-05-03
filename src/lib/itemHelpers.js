/**
 * itemHelpers.js : helpers d'affichage des items.
 *
 * Source de vérité unique pour les métadonnées d'items.
 * Au lieu que chaque composant lise un item_name potentiellement
 * périmé en base PocketBase, on lit toujours depuis le dictionnaire
 * central ITEMS qui est mis à jour au moindre rename.
 *
 * Helpers disponibles :
 *   - getItemName(itemKey, fallback)        : nom à afficher
 *   - getItemIcon(itemKey, fallback)        : emoji icon
 *   - getItemTier(itemKey, fallback)        : tier (1, 2, 3...)
 *   - getItemCategory(itemKey, fallback)    : catégorie ("bois", "pierre"...)
 *   - getItemDef(itemKey, fallback)         : la définition complète depuis ITEMS
 *   - getCanonicalItemKey(itemKey, fallback): retrouve la clé canonique d'un legacy
 *
 * Usage :
 *   import { getItemName, getItemIcon } from "@/lib/itemHelpers";
 *   <span>{getItemIcon(item.item_key)} {getItemName(item.item_key, item.item_name)}</span>
 */
import { ITEMS } from "./craftingData";

// Index inverse name -> key, construit une seule fois au chargement.
// Permet de retrouver la clé canonique à partir d'un ancien nom figé en base
// (ex : un listing legacy avec item_name "Pierre brute" alors que la clé
// "pierre_brute" affiche maintenant "Pierre taillée").
const NAME_TO_KEY = {};
for (const [key, def] of Object.entries(ITEMS)) {
  if (def?.name) {
    NAME_TO_KEY[def.name.toLowerCase().trim()] = key;
  }
}

// Liste de noms historiques connus pour des items renommés.
// IMPORTANT : ne mapper QUE des noms qui n'existent plus du tout dans ITEMS
// aujourd'hui. Si un nom est encore utilisé par un autre item (ex: "Pierre"
// désigne ITEMS.pierre tier 1), ne pas l'inclure ici.
// Si plus tard tu renommes un autre item, ajoute son ancien nom ici.
const LEGACY_NAME_TO_KEY = {
  "pierre brute": "pierre_brute",  // ancien nom de l'item pierre_brute (tier 2)
  // Ajouter les futurs renames ici.
};

/**
 * Résout un (itemKey, fallback) vers la définition complète de l'item dans ITEMS.
 * Stratégie :
 *   1. ITEMS[itemKey] si la clé est canonique
 *   2. Recherche inverse via fallback (ancien nom en base)
 *   3. null si rien trouvé
 *
 * @returns {object|null} L'objet ITEMS[key] ou null
 */
function resolveItem(itemKey, fallback = "") {
  if (itemKey && ITEMS[itemKey]) return ITEMS[itemKey];
  if (fallback) {
    const norm = fallback.toLowerCase().trim();
    const resolvedKey = NAME_TO_KEY[norm] || LEGACY_NAME_TO_KEY[norm];
    if (resolvedKey && ITEMS[resolvedKey]) return ITEMS[resolvedKey];
  }
  return null;
}

/**
 * Retourne le nom à afficher pour un item.
 * @param {string} itemKey
 * @param {string} fallback - Le item_name figé en base, utilisé si itemKey est inconnu
 * @returns {string}
 */
export function getItemName(itemKey, fallback = "") {
  const item = resolveItem(itemKey, fallback);
  if (item?.name) return item.name;
  return fallback || itemKey || "(inconnu)";
}

/**
 * Retourne l'icône emoji d'un item.
 * @param {string} itemKey
 * @param {string} fallback - L'item_name pour la recherche inverse, ou une icône en dernier recours
 * @returns {string}
 */
export function getItemIcon(itemKey, fallback = "") {
  const item = resolveItem(itemKey, fallback);
  if (item?.icon) return item.icon;
  // Si fallback ressemble à un emoji court, on le rend tel quel
  if (fallback && fallback.length <= 4 && !/[a-zA-Z]/.test(fallback)) return fallback;
  return "📦";
}

/**
 * Retourne le tier d'un item (1, 2, 3, 4...).
 * @param {string} itemKey
 * @param {string} fallback - item_name pour la recherche inverse
 * @returns {number} Le tier, ou 1 par défaut.
 */
export function getItemTier(itemKey, fallback = "") {
  const item = resolveItem(itemKey, fallback);
  return item?.tier ?? 1;
}

/**
 * Retourne la catégorie d'un item (ex: "bois", "pierre", "armes_combat").
 * @param {string} itemKey
 * @param {string} fallback - item_name pour la recherche inverse
 * @returns {string|null}
 */
export function getItemCategory(itemKey, fallback = "") {
  const item = resolveItem(itemKey, fallback);
  return item?.category || null;
}

/**
 * Retourne la définition complète d'un item depuis ITEMS.
 * Pratique quand un composant veut accéder à plusieurs propriétés
 * (effect, value, biome_profession, etc.) sans appeler 5 helpers.
 *
 * @param {string} itemKey
 * @param {string} fallback - item_name pour la recherche inverse
 * @returns {object|null} L'objet complet de ITEMS, ou null
 */
export function getItemDef(itemKey, fallback = "") {
  return resolveItem(itemKey, fallback);
}

/**
 * Retourne la clé canonique d'un item à partir de l'item_key (si valide)
 * ou du item_name historique. Utile pour regrouper des listings legacy
 * sous la même clé que les listings modernes.
 *
 * @param {string} itemKey - L'identifiant technique (potentiellement obsolète)
 * @param {string} fallback - Le item_name à utiliser pour la recherche inverse
 * @returns {string} La clé canonique, ou itemKey/fallback si rien trouvé
 */
export function getCanonicalItemKey(itemKey, fallback = "") {
  if (itemKey && ITEMS[itemKey]) return itemKey;
  if (fallback) {
    const norm = fallback.toLowerCase().trim();
    const resolved = NAME_TO_KEY[norm] || LEGACY_NAME_TO_KEY[norm];
    if (resolved) return resolved;
  }
  return itemKey || fallback || "";
}
