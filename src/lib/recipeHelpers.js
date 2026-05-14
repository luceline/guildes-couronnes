// ═══════════════════════════════════════════════════════════════════════════
// recipeHelpers.js — Fonctions pures liées aux recettes (production/craft)
// ═══════════════════════════════════════════════════════════════════════════
// 14/05/2026 — Extraction depuis Production.jsx (Vague 1 refacto).
// Ces fonctions sont volontairement PURES : aucune dépendance à un state, aucun
// side-effect. Toute donnée nécessaire est passée en paramètre explicite.
// Cela les rend triviales à tester et réutilisables (panneau craft, panneau
// farm, atelier, etc.).

import { getInventoryQty } from "@/lib/inventoryHelpers";

/**
 * Formate un cooldown en secondes en chaîne lisible "Xm Ys" ou "Xs".
 * Retourne null si le cooldown est nul ou négatif (rien à afficher).
 *
 * @param {number} s - secondes restantes
 * @returns {string|null}
 *
 * @example
 *   formatCooldown(0)    // null
 *   formatCooldown(45)   // "45s"
 *   formatCooldown(125)  // "2m 5s"
 *   formatCooldown(180)  // "3m "
 */
export function formatCooldown(s) {
  if (s <= 0) return null;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${s > 60 ? sec + "s" : ""}` : `${sec}s`;
}

/**
 * Vérifie si un joueur a tous les ingrédients requis pour exécuter une recette.
 * N'évalue PAS les autres conditions (cooldown, outil, équipement, etc.) : juste l'inventaire.
 *
 * @param {Object} recipe - recette avec .inputs = [{ key, quantity }]
 * @param {Array} inventory - inventaire du joueur (profile.inventory)
 * @returns {boolean}
 *
 * @example
 *   canCraftRecipe({ inputs: [{ key: "bois_brut", quantity: 2 }] }, inv)
 *   // → true si inv contient au moins 2 bois_brut
 */
export function canCraftRecipe(recipe, inventory) {
  if (!recipe?.inputs) return true; // recette sans inputs = toujours craftable
  return recipe.inputs.every(inp => getInventoryQty(inventory, inp.key) >= inp.quantity);
}
