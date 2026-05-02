/**
 * itemHelpers.js : helpers d'affichage des items.
 *
 * Premier pas vers une "source de vérité unique" pour les métadonnées
 * d'items. Au lieu que chaque composant lise un item_name potentiellement
 * périmé en base PocketBase, on lit toujours depuis le dictionnaire
 * central ITEMS qui est mis à jour au moindre rename.
 *
 * Usage :
 *   import { getItemName } from "@/lib/itemHelpers";
 *   <span>{getItemName(item.item_key, item.item_name)}</span>
 *
 * Si plus tard on étend la centralisation à l'icône, au tier, etc.,
 * on ajoute getItemIcon(), getItemTier(), etc. dans ce même fichier.
 */
import { ITEMS } from "./craftingData";

/**
 * Retourne le nom à afficher pour un item.
 * Priorité 1 : la source de vérité ITEMS[item_key]
 * Priorité 2 (fallback) : le item_name figé en base, si l'item_key
 *                        est inconnu de ITEMS (rare, items système ou legacy)
 *
 * @param {string} itemKey - L'identifiant technique de l'item
 * @param {string} fallback - Le nom à utiliser si l'item_key n'est pas dans ITEMS
 * @returns {string} Le nom à afficher
 */
export function getItemName(itemKey, fallback = "") {
  if (itemKey && ITEMS[itemKey]?.name) return ITEMS[itemKey].name;
  return fallback || itemKey || "(inconnu)";
}
