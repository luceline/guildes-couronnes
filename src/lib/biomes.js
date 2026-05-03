/**
 * biomes.js : source de vérité unique pour les biomes du jeu.
 *
 * Avant ce fichier, les noms et icônes des biomes étaient répétés dans :
 *   - src/components/combat/CombatScreen.jsx
 *   - src/components/combat/CombatEpic.jsx
 *   - src/pages/Dashboard.jsx (HARVEST_BIOME_NAMES)
 *   - et indirectement dans craftingData.js (biome_key sur les items T1)
 *
 * Désormais, le mapping biome_key -> métadonnées vit ici. Pour ajouter
 * un biome ou en renommer un, c'est ici qu'on touche.
 *
 * Usage :
 *   import { BIOMES, getBiomeName, getBiomeIcon, getBiomeProfession } from "@/lib/biomes";
 *   const label = getBiomeName("foret");          // "Forêt ancestrale"
 *   const short = getBiomeName("foret", true);    // "Forêt"
 *   const icon  = getBiomeIcon("forge");          // "🔥"
 *   const prof  = getBiomeProfession("mine");     // "Mineur"
 */

export const BIOMES = {
  foret:   { name: "Forêt ancestrale", short: "Forêt",   icon: "🌲", profession: "Bûcheron"  },
  champs:  { name: "Champs dorés",     short: "Champs",  icon: "🌾", profession: "Fermier"   },
  mine:    { name: "Mines profondes",  short: "Mine",    icon: "⛏️", profession: "Mineur"    },
  atelier: { name: "Atelier",          short: "Atelier", icon: "🧵", profession: "Tisserand" },
  forge:   { name: "Forge",            short: "Forge",   icon: "🔥", profession: "Forgeron"  },
  guilde:  { name: "Guilde",           short: "Guilde",  icon: "🏛️", profession: "Marchand"  },
};

/**
 * Retourne le nom d'un biome.
 * @param {string} biomeKey - "foret", "champs", etc.
 * @param {boolean} short - Si true, retourne le nom court ("Forêt"). Sinon, le nom long ("Forêt ancestrale").
 * @returns {string} Le nom à afficher, ou la clé en fallback si le biome est inconnu.
 */
export function getBiomeName(biomeKey, short = false) {
  const biome = BIOMES[biomeKey];
  if (!biome) return biomeKey || "(biome inconnu)";
  return short ? biome.short : biome.name;
}

/**
 * Retourne l'icône emoji d'un biome.
 * @param {string} biomeKey
 * @returns {string} L'emoji, ou "❓" en fallback.
 */
export function getBiomeIcon(biomeKey) {
  return BIOMES[biomeKey]?.icon || "❓";
}

/**
 * Retourne la profession associée à un biome.
 * @param {string} biomeKey
 * @returns {string|null} La profession (ex: "Mineur"), ou null si biome inconnu.
 */
export function getBiomeProfession(biomeKey) {
  return BIOMES[biomeKey]?.profession || null;
}

/**
 * Retourne le biome principal d'une profession.
 * Note : certaines professions ont plusieurs biomes possibles dans craftingData
 * (ex: Alchimiste partage la forêt avec le Bûcheron). Ici on renvoie le biome
 * "principal" tel que défini dans BIOMES. Pour le biome de récolte spécifique
 * d'un item, lire item.biome_key dans craftingData.
 * @param {string} profession - "Mineur", "Bûcheron", etc.
 * @returns {string|null} La clé biome (ex: "mine"), ou null si profession inconnue.
 */
export function getProfessionBiome(profession) {
  for (const [key, def] of Object.entries(BIOMES)) {
    if (def.profession === profession) return key;
  }
  return null;
}

/**
 * Retourne la liste de toutes les clés de biomes (utile pour itérer).
 * @returns {string[]}
 */
export function getAllBiomeKeys() {
  return Object.keys(BIOMES);
}
