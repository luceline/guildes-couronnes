/**
 * biomes.js : source de vérité unique pour les biomes du jeu.
 *
 * Avant ce fichier, les noms et icônes des biomes étaient répétés dans :
 *   - src/lib/biomeData.js (BIOMES avec descriptions narratives)
 *   - src/components/combat/CombatScreen.jsx (BIOME_NAMES)
 *   - src/components/combat/CombatEpic.jsx (BIOME_NAMES)
 *   - src/pages/Dashboard.jsx (HARVEST_BIOME_NAMES)
 *   - et indirectement dans craftingData.js (biome_key sur les items T1)
 *
 * Désormais, tout vit ici. biomeData.js est obsolète.
 *
 * MAI 2026 : refonte égalitaire. Le champ `profession` est conservé à titre
 * de LORE (texte d'ambiance) mais n'a PLUS aucun effet gameplay. Tous les
 * joueurs sont traités à égalité dans tous les biomes (drops, buffs, etc.).
 *
 * Usage :
 *   import { BIOMES, getBiomeName, getBiomeIcon, getBiomeProfession } from "@/lib/biomes";
 *   const label = getBiomeName("foret");          // "Forêt ancestrale"
 *   const short = getBiomeName("foret", true);    // "Forêt"
 *   const icon  = getBiomeIcon("forge");          // "🔥"
 *   const desc  = BIOMES.foret.description;       // narratif long
 */

export const BIOMES = {
  foret: {
    name: "Forêt ancestrale",
    short: "Forêt",
    icon: "🌲",
    description: "Les grands arbres murmurent des secrets anciens. Bois noueux et herbes rares y poussent à l'abri des frondaisons.",
  },
  champs: {
    name: "Champs dorés",
    short: "Champs",
    icon: "🌾",
    description: "À perte de vue, les épis se balancent sous le vent. Chaque sillon recèle la promesse d'une moisson généreuse.",
  },
  mine: {
    name: "Mines profondes",
    short: "Mine",
    icon: "⛏️",
    description: "Les galeries résonnent de coups sourds. La terre y cache jalousement ses richesses dans ses entrailles.",
  },
  atelier: {
    name: "Atelier des artisans",
    short: "Atelier",
    icon: "🧵",
    description: "Métiers à tisser, bobines et fils colorés : ici les étoffes naissent de la patience et de la dextérité.",
  },
  forge: {
    name: "Forge du destin",
    short: "Forge",
    icon: "🔥",
    description: "La chaleur des brasiers rougeoie nuit et jour. Acier et métaux précieux s'y façonnent au son du marteau.",
  },
  guilde: {
    name: "Guilde des marchands",
    short: "Guilde",
    icon: "🏛️",
    description: "Sous les colonnes de la Guilde, contrats, autorisations et pièces d'or circulent dans un ballet incessant.",
  },
  // ── Biomes ajoutés mai 2026 ──
  jardin: {
    name: "Jardin somptueux",
    short: "Jardin",
    icon: "🌸",
    description: "Un labyrinthe végétal où les plantes médicinales abondent. Les herbes rares y ondoient sous une brise parfumée, gardées par des créatures discrètes.",
  },
  carriere: {
    name: "Carrière d'améthyste",
    short: "Carrière",
    icon: "💜",
    description: "Une faille violette dans la roche, où les cristaux affleurent au moindre coup de pioche. Les éclats luisent dans la pénombre, attirant chasseurs comme curieux.",
  },
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
