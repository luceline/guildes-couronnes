/**
 * rareResources.js : source de vérité unique pour les ressources rares.
 *
 * Avant ce fichier, les ressources rares étaient définies dans 3 endroits
 * avec des incohérences entre eux :
 *   - src/components/combat/CombatEpic.jsx (BIOME_RARES) → ce qui drop en combat
 *   - src/components/InventoryPanel.jsx    (RARE_RESOURCES) → ce que l'inventaire
 *     reconnaît comme rare
 *   - src/components/RareResourceActivator.jsx (RARE_RESOURCES) → idem
 *
 * Conséquence du bug : les ressources rares atelier/forge/guilde droppaient en
 * combat avec les keys "fil_or", "lingot_runique", "sceau_guilde" mais l'inventaire
 * cherchait "fil_enchante", "cendre_forge", "piece_ancienne". Donc impossible de les
 * activer pour gagner de l'XP, alors que c'est le gameplay principal de progression.
 *
 * Cette source de vérité unique fixe les keys canoniques (= celles qui sortent
 * du combat) et les expose à tous les composants.
 *
 * Pour ajouter une ressource rare ou en renommer une, c'est ici qu'on touche.
 *
 * Usage :
 *   import { RARE_RESOURCES, getRareResourceFromBiome, isRareResource } from "@/lib/rareResources";
 *   const isRare = isRareResource(item.item_key);
 *   const def    = RARE_RESOURCES[item.item_key];
 *   const fromForet = getRareResourceFromBiome("foret"); // { key: "essence_foret", ... }
 */

// Keys canoniques = celles que CombatEpic/combatPvE distribuent en loot.
// On garde ces keys parce qu'elles sont déjà persistées dans les inventaires
// des joueurs depuis des semaines. Changer les keys casserait leurs items.
export const RARE_RESOURCES = {
  essence_foret:     { name: "Essence forestière",     icon: "🌿", biome_key: "foret",   biome_name: "Forêt"   },
  poussiere_moisson: { name: "Poussière de récolte",   icon: "🌾", biome_key: "champs",  biome_name: "Champs"  },
  fragment_cristal:  { name: "Fragment cristallin",    icon: "💎", biome_key: "mine",    biome_name: "Mine"    },
  fil_or:            { name: "Fil d'or",               icon: "🧵", biome_key: "atelier", biome_name: "Atelier" },
  lingot_runique:    { name: "Lingot runique",         icon: "🔥", biome_key: "forge",   biome_name: "Forge"   },
  sceau_guilde:      { name: "Sceau de la guilde",     icon: "🏛️", biome_key: "guilde",  biome_name: "Guilde"  },
};

/**
 * Vérifie si un item_key correspond à une ressource rare.
 * @param {string} itemKey
 * @returns {boolean}
 */
export function isRareResource(itemKey) {
  return Boolean(itemKey && RARE_RESOURCES[itemKey]);
}

/**
 * Retourne la définition de la ressource rare associée à un biome.
 * Utilisé par CombatEpic pour savoir quoi droper après un kill.
 * @param {string} biomeKey - "foret", "champs", "mine", "atelier", "forge", "guilde"
 * @returns {object|null} { key, name, icon, biome_key, biome_name } ou null
 */
export function getRareResourceFromBiome(biomeKey) {
  for (const [key, def] of Object.entries(RARE_RESOURCES)) {
    if (def.biome_key === biomeKey) {
      return { key, ...def };
    }
  }
  return null;
}

/**
 * Liste des keys de ressources rares (utile pour filtrer un inventaire).
 * @returns {string[]}
 */
export function getAllRareResourceKeys() {
  return Object.keys(RARE_RESOURCES);
}

/**
 * Constante d'XP gagnée par activation d'une ressource rare.
 * Centralisée ici pour qu'on puisse l'ajuster sans toucher 3 composants.
 */
export const XP_PER_RARE_RESOURCE = 100;
