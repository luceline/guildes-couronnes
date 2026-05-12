/**
 * inventoryHelpers.js : helpers pour manipuler l'inventaire d'un joueur.
 *
 * Avant ce fichier, les opérations inventaire étaient répétées partout :
 *   - 35+ endroits faisaient `inventory.find(i => i.item_key === X)` à la main
 *   - 41+ endroits faisaient `.filter(i => i.quantity > 0)` après un décrément
 *   - 32+ endroits utilisaient le fallback `item_key === X || item_name === Y`
 *     pour gérer les listings legacy avec item_key vide
 *
 * Désormais ces patterns sont centralisés ici. Bénéfice :
 *   - Si on change le format des items (ex: ajout d'item_uid pour différencier
 *     deux Épées avec durabilités différentes), un seul fichier à modifier
 *   - Plus de risques d'oublier le `.filter(quantity > 0)` qui laisserait
 *     traîner des entrées zombies à 0 dans l'inventaire
 *   - Code consommateur plus court et plus lisible
 *
 * Usage typique :
 *   import { findInventoryItem, getInventoryQty, removeFromInventory, addToInventory }
 *     from "@/lib/inventoryHelpers";
 *
 *   const qty = getInventoryQty(profile.inventory, "bois_brut");
 *   const newInv = removeFromInventory(profile.inventory, "bois_brut", 3);
 *   const newInv = addToInventory(profile.inventory, "potion_soin", 1, {
 *     item_name: "Potion de soin", item_category: "potions"
 *   });
 */
import { ITEMS } from "./craftingData";

/**
 * Trouve un item dans l'inventaire en gérant les cas legacy.
 *
 * Match dans cet ordre :
 *   1. item_key === itemKey (cas standard moderne)
 *   2. item_name === ITEMS[itemKey].name (cas où l'item_key n'a pas été migré
 *      mais le nom est à jour)
 *   3. item_name normalisé en snake_case === itemKey (heuristique pour les
 *      vieux items où item_name est l'unique identifiant fiable)
 *
 * @param {Array} inventory - L'array inventory du profile
 * @param {string} itemKey - La clé canonique recherchée
 * @returns {object|null} L'objet item de l'inventaire, ou null
 */
export function findInventoryItem(inventory, itemKey) {
  if (!inventory || !itemKey) return null;
  const itemDef = ITEMS[itemKey];
  return inventory.find(i =>
    i.item_key === itemKey ||
    (itemDef?.name && i.item_name === itemDef.name) ||
    (typeof i.item_name === "string" && i.item_name.toLowerCase().replace(/ /g, "_") === itemKey)
  ) || null;
}

/**
 * Retourne la quantité d'un item dans l'inventaire (0 si absent).
 *
 * @param {Array} inventory - L'array inventory du profile
 * @param {string} itemKey
 * @returns {number}
 */
export function getInventoryQty(inventory, itemKey) {
  return findInventoryItem(inventory, itemKey)?.quantity || 0;
}

/**
 * Retire une quantité d'un item de l'inventaire.
 * Si la quantité résultante est <= 0, l'item est complètement retiré.
 * Ne mute pas l'inventaire d'origine — retourne un nouveau tableau.
 *
 * @param {Array} inventory - L'array inventory du profile (non muté)
 * @param {string} itemKey - La clé canonique de l'item à décrémenter
 * @param {number} qty - Quantité à retirer (doit être > 0)
 * @returns {Array} Le nouvel inventaire
 *
 * Note : si l'item n'existe pas, retourne l'inventaire inchangé (pas d'erreur).
 * Si on demande à retirer plus que présent, l'item est retiré complètement.
 */
export function removeFromInventory(inventory, itemKey, qty = 1) {
  if (!inventory || !itemKey || qty <= 0) return inventory || [];
  return inventory
    .map(i => {
      const matches =
        i.item_key === itemKey ||
        (ITEMS[itemKey]?.name && i.item_name === ITEMS[itemKey].name) ||
        (typeof i.item_name === "string" && i.item_name.toLowerCase().replace(/ /g, "_") === itemKey);
      if (!matches) return i;
      return { ...i, quantity: i.quantity - qty };
    })
    .filter(i => i.quantity > 0);
}

/**
 * Ajoute une quantité d'un item à l'inventaire.
 * Si l'item existe déjà, on incrémente sa quantité (en gardant ses autres
 * champs intacts comme durabilité, propriétaire d'origine, etc.).
 * Sinon on push une nouvelle entrée avec les métadonnées tirées de ITEMS
 * (modulo les overrides passés via `extraProps`).
 * Ne mute pas l'inventaire d'origine — retourne un nouveau tableau.
 *
 * @param {Array} inventory - L'array inventory du profile (non muté)
 * @param {string} itemKey - La clé canonique de l'item à ajouter
 * @param {number} qty - Quantité à ajouter (doit être > 0)
 * @param {object} [extraProps] - Override/ajout sur les métadonnées : utile pour
 *   forcer un item_name spécifique (legacy) ou ajouter des champs custom
 *   (durability, sourceListing, etc.)
 * @returns {Array} Le nouvel inventaire
 */
export function addToInventory(inventory, itemKey, qty = 1, extraProps = {}) {
  if (!itemKey || qty <= 0) return inventory || [];
  const inv = [...(inventory || [])];

  // Index de l'item existant via les mêmes 3 conditions de match
  const existingIdx = inv.findIndex(i =>
    i.item_key === itemKey ||
    (ITEMS[itemKey]?.name && i.item_name === ITEMS[itemKey].name) ||
    (typeof i.item_name === "string" && i.item_name.toLowerCase().replace(/ /g, "_") === itemKey)
  );

  if (existingIdx >= 0) {
    inv[existingIdx] = {
      ...inv[existingIdx],
      quantity: inv[existingIdx].quantity + qty,
    };
    return inv;
  }

  // Nouvelle entrée : on s'appuie sur ITEMS comme source de vérité
  const def = ITEMS[itemKey] || {};
  inv.push({
    item_key: itemKey,
    item_name: def.name || itemKey,
    item_category: def.category || null,
    quantity: qty,
    ...extraProps,
  });
  return inv;
}

/**
 * Vérifie si l'inventaire contient au moins `qty` exemplaires de l'item.
 * Pratique pour les checks "peut-il crafter ?" plus lisibles que
 * `getInventoryQty(...) >= qty`.
 *
 * @param {Array} inventory
 * @param {string} itemKey
 * @param {number} qty - Défaut 1
 * @returns {boolean}
 */
export function hasInInventory(inventory, itemKey, qty = 1) {
  return getInventoryQty(inventory, itemKey) >= qty;
}

/**
 * Calcule le poids total d'un inventaire (somme des quantités).
 * Note : gameData.js a aussi `getInventoryWeight(profile)` qui prend un profile.
 * Cette version-ci prend directement un array d'inventory pour rester cohérente
 * avec les autres helpers de ce fichier. Si possible, préférer cette version
 * dans le code nouveau.
 *
 * @param {Array} inventory
 * @returns {number}
 */
export function getInventoryWeightFromArray(inventory) {
  if (!inventory) return 0;
  return inventory.reduce((sum, i) => sum + (i.quantity || 0), 0);
}
