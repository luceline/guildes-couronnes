import { base44 } from "@/api/base44Client";
import { notifyTavern } from "@/lib/tavernNotifier";

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

const TERRITORY_PREFIXES = [
  "Région", "Marches", "Terres", "Contrée", "Domaine",
  "Comté", "Duché", "Baronnie", "Province",
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
  } while (usedNames.has(name) && attempts < 20);
  return name;
}

const MAX_CITIES_PER_TERRITORY = 10;

export async function createNewCityWithRoutes(existingCities) {
  const usedNames = new Set(existingCities.map(c => c.name));
  const availableName = generateCityName(usedNames);
  const description = CITY_DESCRIPTIONS[Math.floor(Math.random() * CITY_DESCRIPTIONS.length)];

  const realCities = existingCities.filter(c => !c.is_bot_city);

  // ── Gestion des territoires ──
  // Charger tous les territoires existants
  const territories = await base44.entities.Territory.list().catch(() => []);

  let targetTerritoryId = null;
  let isNewTerritory = false;
  let newTerritoryName = null;

  if (territories.length === 0) {
    // Premier territoire : créer le territoire 1
    const usedTerritoryNames = new Set();
    newTerritoryName = generateTerritoryName(usedTerritoryNames);
    const newTerritory = await base44.entities.Territory.create({
      name: newTerritoryName,
      description: "Le berceau du royaume, où tout a commencé.",
      cities_count: 1,
    });
    targetTerritoryId = newTerritory.id;
    isNewTerritory = true;
  } else {
    // Trouver le territoire avec de la place (< 10 villes)
    const citiesPerTerritory = {};
    for (const city of realCities) {
      if (city.territory_id) {
        citiesPerTerritory[city.territory_id] = (citiesPerTerritory[city.territory_id] || 0) + 1;
      }
    }

    const availableTerritory = territories.find(t =>
      (citiesPerTerritory[t.id] || 0) < MAX_CITIES_PER_TERRITORY
    );

    if (availableTerritory) {
      targetTerritoryId = availableTerritory.id;
      // Mettre à jour le compteur
      await base44.entities.Territory.update(availableTerritory.id, {
        cities_count: (availableTerritory.cities_count || 0) + 1,
      }).catch(() => {});
    } else {
      // Tous les territoires sont pleins → créer un nouveau territoire
      const usedTerritoryNames = new Set(territories.map(t => t.name));
      newTerritoryName = generateTerritoryName(usedTerritoryNames);
      const newTerritory = await base44.entities.Territory.create({
        name: newTerritoryName,
        description: "De nouvelles terres s'ouvrent aux aventuriers intrépides.",
        cities_count: 1,
      });
      targetTerritoryId = newTerritory.id;
      isNewTerritory = true;
    }
  }

  // ── Créer la ville ──
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
    territory_id: targetTerritoryId,
  });

  // ── Créer routes vers les villes DU MÊME territoire ──
  const sameTerrityCities = realCities.filter(c => c.territory_id === targetTerritoryId);
  for (const city of sameTerrityCities) {
    await Promise.all([
      base44.entities.TravelRoute.create({
        city_from_id: newCity.id,
        city_to_id: city.id,
        travel_time_minutes: 60,
        road_type: "royale",
        danger_level: "sûr",
        is_inter_territory: false,
        is_maritime: false,
      }),
      base44.entities.TravelRoute.create({
        city_from_id: city.id,
        city_to_id: newCity.id,
        travel_time_minutes: 60,
        road_type: "royale",
        danger_level: "sûr",
        is_inter_territory: false,
        is_maritime: false,
      }),
    ]);
  }

  // ── Si nouveau territoire → créer la route inter-territoire ──
  if (isNewTerritory && territories.length > 0) {
    // Prendre le dernier territoire existant
    const previousTerritory = territories[territories.length - 1];
    const previousTerrityCities = realCities.filter(c => c.territory_id === previousTerritory.id);

    if (previousTerrityCities.length > 0) {
      // Choisir une ville aléatoire dans l'ancien territoire
      const gatewayCity = previousTerrityCities[Math.floor(Math.random() * previousTerrityCities.length)];

      await Promise.all([
        base44.entities.TravelRoute.create({
          city_from_id: newCity.id,
          city_to_id: gatewayCity.id,
          travel_time_minutes: 120,
          road_type: "inter_territoire",
          danger_level: "sûr",
          is_inter_territory: true,
          is_maritime: false,
        }),
        base44.entities.TravelRoute.create({
          city_from_id: gatewayCity.id,
          city_to_id: newCity.id,
          travel_time_minutes: 120,
          road_type: "inter_territoire",
          danger_level: "sûr",
          is_inter_territory: true,
          is_maritime: false,
        }),
      ]);

      // Stocker les villes de passage dans les territoires
      await base44.entities.Territory.update(targetTerritoryId, {
        gateway_city_id: newCity.id,
      }).catch(() => {});
      await base44.entities.Territory.update(previousTerritory.id, {
        gateway_city_id: gatewayCity.id,
      }).catch(() => {});

      // Annoncer dans les tavernes
      for (const city of [...sameTerrityCities, ...previousTerrityCities]) {
        await notifyTavern({
          cityId: city.id,
          audience: "public",
          authorName: "Héraut royal",
          message: `🌍 De nouveaux horizons s'ouvrent ! Le territoire "${newTerritoryName}" vient d'être fondé. Une route royale inter-territoire relie désormais ${gatewayCity.name} à ${availableName} (2h de voyage).`,
        });
      }
    }
  } else {
    // Annoncer dans les tavernes du même territoire
    for (const city of sameTerrityCities) {
      await notifyTavern({
        cityId: city.id,
        audience: "public",
        authorName: "Héraut royal",
        message: `📯 Une nouvelle bourgade vient d'être fondée : **${availableName}** ! Une route royale relie désormais nos cités.`,
      });
    }
  }

  return newCity;
}
