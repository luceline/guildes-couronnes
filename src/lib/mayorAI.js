import { base44 } from "@/api/base44Client";
import { BUILDING_TYPES, getTodayDateStr, generateDailyTax, HOUSING_MAINTENANCE, getCityDailyMaintenance, PARCHEMIN_REWARDS } from "./gameData";
import { logGold } from "./goldLog";

// Mayor AI decision-making logic

const MAYOR_MESSAGES = [
  "Les caisses sont vides, il faut renflouer !", 
  "Le commerce prospère, les impôts baissent.",
  "Guerre imminente, les taxes augmentent.",
  "Bonne récolte, le maire est généreux.",
  "Les marchands réclament de meilleures routes.",
];

// Determine which building the mayor should build next
export function getMayorBuildingPriority(city) {
  const built = (city.buildings || []).map(b => b.building_type);
  const available = Object.keys(BUILDING_TYPES).filter(k => !built.includes(k));
  if (available.length === 0) return null;

  // Mayor chooses based on city level and population needs
  const population = city.population || 0;
  const maxPop = city.max_population || 5;
  const ratio = population / maxPop;

  // If near capacity, prioritize pop-boosting buildings
  if (ratio > 0.7) {
    const popBuildings = available.filter(k => BUILDING_TYPES[k].popBonus >= 4);
    if (popBuildings.length > 0) {
      return popBuildings[Math.floor(Math.random() * popBuildings.length)];
    }
  }

  // Otherwise random from available
  return available[Math.floor(Math.random() * available.length)];
}

// Run daily mayor tick for a city
export async function runMayorTick(city) {
  const today = getTodayDateStr();
  if (city.tax_last_updated === today) return null; // Already ran today

  const newTax = generateDailyTax();
  const reason = MAYOR_MESSAGES[Math.floor(Math.random() * MAYOR_MESSAGES.length)];

  // Update city taxes
  await base44.entities.City.update(city.id, {
    tax_rate: newTax,
    tax_last_updated: today,
  });

  // Log tax history
  await base44.entities.TaxHistory.create({
    city_id: city.id,
    city_name: city.name,
    tax_rate: newTax,
    date: today,
    reason,
  });

  return { newTax, reason };
}

// IA build désactivé : seul un maire joueur peut construire
export async function mayerTryBuild(city) {
  return null; // Désactivé : seul le maire joueur peut construire
  const targetBuilding = getMayorBuildingPriority(city);
  if (!targetBuilding) return null;

  const bType = BUILDING_TYPES[targetBuilding];
  const treasury = city.gold_treasury || 0;
  const cityResources = city.resources || {};

  // Check if city has enough resources (simplified: check gold)
  // Vérifier que l'entrepôt a les ressources nécessaires
  const warehouse = city.warehouse || {};
  const costBase = bType.costBase || {};
  const canAfford = Object.entries(costBase).every(([res, qty]) => (warehouse[res] || 0) >= qty);
  if (!canAfford) return null;

  // Déduire les ressources de l'entrepôt
  const newWarehouse = { ...warehouse };
  for (const [res, qty] of Object.entries(costBase)) {
    newWarehouse[res] = Math.max(0, (newWarehouse[res] || 0) - qty);
  }

  const newBuildings = [...(city.buildings || []), {
    building_type: targetBuilding,
    name: bType.name,
    level: 1,
    built_date: getTodayDateStr(),
  }];

  const newMaxPop = bType.popBonus > 0
    ? (city.max_population || 3) + bType.popBonus
    : (city.max_population || 3);

  await base44.entities.City.update(city.id, {
    buildings: newBuildings,
    warehouse: newWarehouse,
    max_population: newMaxPop,
  });

  return { building: bType.name };
}

// Rotate resources between cities (simplified simulation)
export async function rotateResources(cities) {
  // Find surplus and deficit cities
  const stocks = await base44.entities.ResourceStock.list();
  const resourceTypes = ["bois", "pierre", "fer", "nourriture", "tissu"];

  for (const resType of resourceTypes) {
    const cityStocks = stocks.filter(s => s.resource_type === resType);
    if (cityStocks.length < 2) continue;

    const sorted = [...cityStocks].sort((a, b) => b.quantity - a.quantity);
    const surplus = sorted[0];
    const deficit = sorted[sorted.length - 1];

    if (surplus.quantity > 50 && deficit.quantity < 20) {
      const transfer = Math.floor((surplus.quantity - deficit.quantity) * 0.1);
      if (transfer > 0) {
        await base44.entities.ResourceStock.update(surplus.id, {
          quantity: surplus.quantity - transfer,
        });
        await base44.entities.ResourceStock.update(deficit.id, {
          quantity: deficit.quantity + transfer,
        });
      }
    }
  }
}

// Wealth tax: collect % of each player's gold → city treasury
export async function runWealthTax(players, city) {
  const taxRate = (city.tax_rate || 10) / 100;
  let totalCollected = 0;
  const results = [];

  for (const player of players) {
    if (!player.city_id || player.city_id !== city.id) continue;
    const gold = player.gold || 0;
    if (gold <= 10) continue; // Minimum exempt
    const taxed = Math.floor(gold * taxRate);
    if (taxed <= 0) continue;
    totalCollected += taxed;
    await base44.entities.PlayerProfile.update(player.id, { gold: gold - taxed });
    await logGold({
      profile: player, city,
      amount: -taxed, type: "impot",
      description: `Impôt journalier (${city.tax_rate}%) : ${city.name}`,
    });
    results.push({ name: player.character_name, taxed });
  }

  if (totalCollected > 0) {
    await base44.entities.City.update(city.id, {
      gold_treasury: (city.gold_treasury || 0) + totalCollected,
    });
    await base44.entities.TaxHistory.create({
      city_id: city.id,
      city_name: city.name,
      tax_rate: city.tax_rate,
      date: getTodayDateStr(),
      reason: `Taxe sur la richesse : ${totalCollected} or collectés auprès de ${results.length} joueur(s).`,
    });
  }

  return { totalCollected, results };
}

// Maintenance costs: deduct housing upkeep from each player
export async function runMaintenanceCosts(players) {
  const results = [];
  for (const player of players) {
    let cost = HOUSING_MAINTENANCE[player.housing_level || "tente"] || 0;
    if (cost <= 0) continue;
    // ── Meuble passif : -30% entretien logement ──
    const today = new Date().toISOString().split("T")[0];
    const hasMeuble = player.meuble_expires_at && player.meuble_expires_at >= today;
    if (hasMeuble) cost = Math.max(0, Math.floor(cost * 0.7));
    const newGold = Math.max(0, (player.gold || 0) - cost);
    await base44.entities.PlayerProfile.update(player.id, { gold: newGold });
    await logGold({
      profile: player,
      amount: -cost, type: "logement",
      description: `Entretien logement (${player.housing_level})${hasMeuble ? " -30% meuble" : ""}`,
    });
    results.push({ name: player.character_name, cost, housing: player.housing_level, meubleBonus: hasMeuble });
  }
  return results;
}

// Spend city treasury: distribute to all city players as bonus
export async function distributeTreasury(city, players, amount) {
  const cityPlayers = players.filter(p => p.city_id === city.id);
  if (cityPlayers.length === 0) return 0;
  const share = Math.floor(amount / cityPlayers.length);
  if (share <= 0) return 0;
  for (const player of cityPlayers) {
    await base44.entities.PlayerProfile.update(player.id, { gold: (player.gold || 0) + share });
  }
  await base44.entities.City.update(city.id, { gold_treasury: (city.gold_treasury || 0) - (share * cityPlayers.length) });
  return share;
}

// Generate player objectives based on their profession and city

// ─────────────────────────────────────────────────────────────
// Building maintenance: run once per day per city
// Consumes resources from city warehouse.
// If a resource is missing, the building loses 1 level.
// If level reaches 0, the building is destroyed.
// ─────────────────────────────────────────────────────────────
export async function runBuildingMaintenance(city) {
  const today = getTodayDateStr();
  if (city.maintenance_last_run === today) return { skipped: true };

  const warehouse = { ...(city.warehouse || {}) };
  const buildings = [...(city.buildings || [])];
  const dailyCost = getCityDailyMaintenance(city);
  const degraded = [];
  const destroyed = [];
  const report = [];

  // Check if warehouse can cover all costs
  const canAfford = Object.entries(dailyCost).every(([res, qty]) =>
    (warehouse[res] || 0) >= qty
  );

  if (canAfford) {
    // Deduct all maintenance costs
    for (const [res, qty] of Object.entries(dailyCost)) {
      warehouse[res] = Math.max(0, (warehouse[res] || 0) - qty);
    }
    report.push(`✅ Entretien payé : ${Object.entries(dailyCost).map(([r, q]) => `${q} ${r}`).join(", ")}`);
  } else {
    // Partial payment : identify which resources are missing
    const missing = Object.entries(dailyCost)
      .filter(([res, qty]) => (warehouse[res] || 0) < qty)
      .map(([res]) => res);

    // Deduct what we can
    for (const [res, qty] of Object.entries(dailyCost)) {
      const available = warehouse[res] || 0;
      warehouse[res] = Math.max(0, available - Math.min(available, qty));
    }

    // Degrade buildings that need missing resources
    const toRemove = [];
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const bType = BUILDING_TYPES[b.building_type];
      if (!bType?.maintenance) continue;
      const needsMissing = Object.keys(bType.maintenance).some(r => missing.includes(r));
      if (!needsMissing) continue;

      const newLevel = (b.level || 1) - 1;
      if (newLevel <= 0) {
        toRemove.push(b.building_type);
        destroyed.push(b.name || bType.name);
      } else {
        buildings[i] = { ...b, level: newLevel };
        degraded.push(`${b.name || bType.name} → Niv.${newLevel}`);
      }
    }

    // Remove destroyed buildings and adjust max_population
    let popLost = 0;
    const finalBuildings = buildings.filter(b => {
      if (toRemove.includes(b.building_type)) {
        const bType = BUILDING_TYPES[b.building_type];
        popLost += bType?.popBonus || 0;
        return false;
      }
      return true;
    });

    await base44.entities.City.update(city.id, {
      warehouse,
      buildings: finalBuildings,
      max_population: Math.max(3, (city.max_population || 3) - popLost),
      maintenance_last_run: today,
    });

    return { degraded, destroyed, missing, popLost, report };
  }

  await base44.entities.City.update(city.id, {
    warehouse,
    maintenance_last_run: today,
  });

  return { degraded: [], destroyed: [], missing: [], report };
}
