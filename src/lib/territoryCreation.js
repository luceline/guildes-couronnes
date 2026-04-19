import { base44 } from "@/api/base44Client";

// Composants pour générer des noms aléatoires de territoires
const TERRITORY_PREFIXES = [
  "Région", "Marches", "Terres", "Contrée", "Domaine", "Royaume",
  "Comté", "Duché", "Baronnie", "Province", "Empire",
];

const TERRITORY_SUFFIXES = [
  "du Nord", "de l'Ouest", "du Levant", "du Sud", "des Montagnes",
  "des Forêts", "des Côtes", "de la Vallée", "du Fleuve", "de la Plaine",
  "de l'Est", "Centrale", "Septentrionale", "Méridionale", "Orientale",
];

function generateTerritoryName(usedNames) {
  let name;
  let attempts = 0;
  do {
    const prefix = TERRITORY_PREFIXES[Math.floor(Math.random() * TERRITORY_PREFIXES.length)];
    const suffix = TERRITORY_SUFFIXES[Math.floor(Math.random() * TERRITORY_SUFFIXES.length)];
    name = `${prefix} ${suffix}`;
    attempts++;
  } while (usedNames.has(name) && attempts < 10);
  return name;
}

const TERRITORY_DESCRIPTIONS = [
  "Un vaste territoire regroupant plusieurs cités prospères.",
  "Une région d'influence stratégique, carrefour des routes commerciales.",
  "Des terres historiques marquées par des légendes anciennes.",
  "Un domaine agricole richement peuplé, source de ressources abondantes.",
  "Une contrée en développement, ouverte à de nouvelles aventures.",
];

export async function createNewTerritory() {
  // Charger les territoires existants
  const existingTerritories = await base44.entities.Territory.list().catch(() => []);
  const usedNames = new Set(existingTerritories.map(t => t.name));
  
  // Générer un nom et description aléatoires
  const name = generateTerritoryName(usedNames);
  const description = TERRITORY_DESCRIPTIONS[Math.floor(Math.random() * TERRITORY_DESCRIPTIONS.length)];

  // Créer le territoire
  const newTerritory = await base44.entities.Territory.create({
    name,
    description,
    cities_count: 0,
  });

  return newTerritory;
}