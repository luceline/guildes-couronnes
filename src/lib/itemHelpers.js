/**
 * itemHelpers.js : helpers d'affichage des items.
 *
 * Source de vérité unique pour les métadonnées d'items.
 * Au lieu que chaque composant lise un item_name potentiellement
 * périmé en base PocketBase, on lit toujours depuis le dictionnaire
 * central ITEMS qui est mis à jour au moindre rename.
 *
 * Usage :
 *   import { getItemName } from "@/lib/itemHelpers";
 *   <span>{getItemName(item.item_key, item.item_name)}</span>
 */
import { ITEMS } from "./craftingData";

// Index inverse name -> key, construit une seule fois au chargement.
// Permet de retrouver la clé canonique à partir d'un ancien nom figé en base
// (ex : un listing legacy avec item_name "Pierre" ou "Pierre brute" alors que
// la clé "pierre_brute" affiche maintenant "Pierre taillée").
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
 * Retourne le nom à afficher pour un item.
 *
 * Stratégie de résolution (1ère qui matche) :
 *   1. ITEMS[itemKey].name si itemKey est canonique
 *   2. Match exact sur fallback dans NAME_TO_KEY (nom actuel)
 *   3. Match dans LEGACY_NAME_TO_KEY (anciens noms connus)
 *   4. Le fallback tel quel
 *
 * @param {string} itemKey - L'identifiant technique de l'item
 * @param {string} fallback - Le nom à utiliser si l'item_key n'est pas dans ITEMS
 * @returns {string} Le nom à afficher
 */
export function getItemName(itemKey, fallback = "") {
  // 1. Cas normal : clé canonique connue
  if (itemKey && ITEMS[itemKey]?.name) return ITEMS[itemKey].name;

  // 2 et 3 : tenter de retrouver la clé via le fallback (ancien nom en base)
  if (fallback) {
    const norm = fallback.toLowerCase().trim();
    const resolvedKey = NAME_TO_KEY[norm] || LEGACY_NAME_TO_KEY[norm];
    if (resolvedKey && ITEMS[resolvedKey]?.name) {
      return ITEMS[resolvedKey].name;
    }
  }

  // 4. Rien trouvé : afficher ce qu'on a
  return fallback || itemKey || "(inconnu)";
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
