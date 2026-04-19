import { base44 } from "@/api/base44Client";

// Composants pour générer des noms aléatoires
const CITY_PREFIXES = [
  "Roche", "Mont", "Baie", "Val", "Fort", "Eau", "Bois", "Côte",
  "Port", "Haut", "Pont", "Feu", "Pré", "Lac", "Pierre", "Tyr",
];

const CITY_SUFFIXES = [
  "belle", "fond", "bourg", "croix", "mont", "terre", "fort", "val",
  "neuf", "clair", "vigne", "rive", "brille", "fleur", "côté", "garde",
];

function generateCityName(usedNames) {
  let name;
  let attempts = 0;
  do {
    const prefix = CITY_PREFIXES[Math.floor(Math.random() * CITY_PREFIXES.length)];
    const suffix = CITY_SUFFIXES[Math.floor(Math.random() * CITY_SUFFIXES.length)];
    name = prefix + suffix;
    attempts++;
  } while (usedNames.has(name) && attempts < 10);
  return name;
}

const CITY_DESCRIPTIONS = [
  "Une bourgade naissante aux portes de la forêt, prête à accueillir de nouveaux habitants.",
  "Un carrefour commercial prometteur, bâti sur les ruines d'un ancien comptoir.",
  "Un village fortifié sur une colline, dont la renommée commence à se répandre.",
  "Une communauté fondée par des pionniers courageux, en plein essor.",
  "Un établissement récent au bord d'une rivière poissonneuse, riche en ressources.",
];

export async function createNewCityWithRoutes(existingCities) {
  // Générer un nom aléatoire
  const usedNames = new Set(existingCities.map(c => c.name));
  const availableName = generateCityName(usedNames);
  const description = CITY_DESCRIPTIONS[Math.floor(Math.random() * CITY_DESCRIPTIONS.length)];

  // Créer la ville
  const newCity = await base44.entities.City.create({
    name: availableName,
    description,
    mayor_name: "Aucun",
    tax_rate: 10,
    population: 0,
    max_population: 3,
    level: 1,
    gold_treasury: 0,
    buildings: [],
    warehouse: {},
    is_bot_city: false,
    daily_tax_per_player: 0,
    treasury_cumulative: 0,
  });

  // Créer les routes bidirectionnelles vers toutes les villes non-bot existantes
  const realCities = existingCities.filter(c => !c.is_bot_city);
  for (const city of realCities) {
    await Promise.all([
      base44.entities.TravelRoute.create({
        city_from_id: newCity.id,
        city_to_id: city.id,
        travel_time_minutes: 60,
        road_type: "royale",
        danger_level: "sûr",
        is_maritime: false,
      }),
      base44.entities.TravelRoute.create({
        city_from_id: city.id,
        city_to_id: newCity.id,
        travel_time_minutes: 60,
        road_type: "royale",
        danger_level: "sûr",
        is_maritime: false,
      }),
    ]);
  }

  // Message taverne dans chaque ville existante pour annoncer la nouvelle ville
  for (const city of realCities) {
    try {
      await base44.entities.TavernMessage.create({
        city_id: city.id,
        author_email: "system",
        author_name: "Héraut royal",
        profession: "",
        message: `📯 Une nouvelle bourgade vient d'être fondée : **${availableName}** ! Une route royale relie désormais nos cités.`,
      });
    } catch (e) { /* silencieux */ }
  }

  return newCity;
}