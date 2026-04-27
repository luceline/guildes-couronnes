// ═══════════════════════════════════════════════════════════════
// dailyReset.js — Reset quotidien global à 6h UTC (≈ 8h heure française)
//
// Logique :
// - Un enregistrement DailyReset unique en BDD fait office de verrou global
// - Le premier joueur qui charge CityView après 6h UTC déclenche le reset
// - Tous les autres voient le statut "done" → ne font rien
// - Élimine localStorage, useRef, et tous les guards par joueur
//
// Maintenance bâtiments :
// - Les bâtiments sont traités un par un dans un ordre aléatoire
// - Les ressources disponibles dans l'entrepôt sont déduites au fur et à mesure
// - Si l'entrepôt n'a pas assez pour un bâtiment → il est DÉTRUIT
// - Pas de rattrapage multi-jours (reset = 1 jour, déclenché à heure fixe)
//
// Impôt impayé :
// - Si le joueur ne peut pas payer la totalité → inventaire vidé, faim=0, fatigue=0
// ═══════════════════════════════════════════════════════════════

import { base44 } from "@/api/base44Client";
import {
  generateDailyTax,
  generateDailyTaxPerPlayer,
  generateWarehouseBuybackPrices,
  generateMayorCost,
  BUILDING_TYPES,
  HOUSING_MAINTENANCE,
  HOUSING,
} from "./gameData";
import { calculateDynamicPrices, sampleEconomyData } from "./pricingData";
import { generatePlayerObjectives } from "./objectiveGenerator";

const RESET_HOUR_UTC = 6; // 6h UTC = ~8h heure française

// Date de reset courante : avant 6h UTC → date d'hier, après → aujourd'hui
export function getResetDateStr() {
  const now = new Date();
  if (now.getUTCHours() < RESET_HOUR_UTC) {
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return yesterday.toISOString().split("T")[0];
  }
  return now.toISOString().split("T")[0];
}

export function isPastResetTime() {
  return new Date().getUTCHours() >= RESET_HOUR_UTC;
}

// ── Point d'entrée — appelé depuis CityView au chargement ──
export async function checkAndRunDailyReset(triggerEmail) {
  if (!isPastResetTime()) return false;

  const resetDate = getResetDateStr();

  let records;
  try {
    records = await base44.entities.DailyReset.list("-created_date", 1);
  } catch (e) {
    console.warn("DailyReset: lecture impossible", e);
    return false;
  }

  const last = records?.[0];
  if (last?.reset_date === resetDate && (last?.status === "done" || last?.status === "running")) {
    return false;
  }

  // Poser le verrou immédiatement
  let lockRecord;
  try {
    lockRecord = await base44.entities.DailyReset.create({
      reset_date:   resetDate,
      reset_time:   new Date().toISOString(),
      triggered_by: triggerEmail || "unknown",
      status:       "running",
    });
  } catch (e) {
    console.warn("DailyReset: verrou impossible", e);
    return false;
  }

  try {
    await runDailyReset(resetDate);
  } catch (e) {
    console.error("DailyReset: erreur pendant le reset", e);
  }

  try {
    await base44.entities.DailyReset.update(lockRecord.id, { status: "done" });
  } catch (e) {
    console.warn("DailyReset: impossible de libérer le verrou", e);
  }

  return true;
}

async function runDailyReset(resetDate) {
  const [cities, players] = await Promise.all([
    base44.entities.City.list(),
    base44.entities.PlayerProfile.list(),
  ]);

  const realCities = cities.filter(c => !c.is_bot_city);

  for (const city of realCities) {
    await resetCity(city, resetDate, players);
    await checkLevelUp(city);
  }

  // Recharger les villes après les resetCity (certains bâtiments ont pu être détruits)
  const updatedCities = await base44.entities.City.list().catch(() => cities);

  await collectDailyTax(players, updatedCities, resetDate);
  await applyBankingAndExpiry(players, resetDate);
  await refreshPlayerObjectives(players, updatedCities, resetDate);
  await rotateWorldEvents(updatedCities, resetDate);
  await snapshotEconomy(resetDate, players, cities);
  await spawnSceauxRoyaux(players, updatedCities, resetDate);
  await applyMilitaryMaintenance(updatedCities);
  await applyPopulationConsumption(updatedCities, players);
  await rotateInterTerritoryGateways(updatedCities);
  // applySatietyVitalityDecay retiré (barres appétit/forme supprimées du jeu)
  await expireMarketListings(resetDate);
}

// ── Snapshot économique quotidien ──
// Inflation calculée SEULEMENT sur l'or des joueurs (pas trésorerie villes)
// ── Événements monde ──
async function rotateWorldEvents(cities, resetDate) {
  try {
    const ecoArr = await base44.entities.EconomySettings.filter({ setting_key: "global" }).catch(() => []);
    if (ecoArr.length === 0) return;
    const eco = ecoArr[0];
    const current = eco.world_events || {};
    const allRoutes = await base44.entities.TravelRoute.list().catch(() => []);
    const realCities = cities.filter(c => !c.is_bot_city);

    function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function addDays(dateStr, n) {
      const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0];
    }

    // ── T2 items pour la caravane ──
    const T3_ITEMS = ["meuble","lingots_fer","pain","tissu","epee_courte","potion_soin","lingots_or","parchemin"];

    // ── Caravane royale : renouveler chaque jour ──
    // Active 6h à partir d'une heure aléatoire (stockée), sur une route aléatoire
    const caravaneHour = Math.floor(Math.random() * 18) + 5; // 5h-23h
    const caravaneRoute = allRoutes.length > 0 ? pickRandom(allRoutes) : null;
    const caravaneItem = pickRandom(T3_ITEMS);
    const caravane = caravaneRoute ? {
      active: true,
      route_id: caravaneRoute.id,
      route_name: caravaneRoute.name || `${caravaneRoute.city1_name} ↔ ${caravaneRoute.city2_name}`,
      item: caravaneItem,
      price_multiplier: 2.5, // 2.5× le prix normal
      starts_at_hour: caravaneHour,
      expires_date: resetDate, // expire à minuit ce jour
    } : { active: false };

    // ── Bandit : change toutes les 2 nuits sur routes forestières ──
    const forestRoutes = allRoutes.filter(r =>
      r.road_type === "forestier" || r.danger_level === "modéré"
    );
    let bandit = current.bandit || { active: false };
    if (!bandit.active || bandit.expires_date <= resetDate) {
      const banditRoute = forestRoutes.length > 0 ? pickRandom(forestRoutes) : pickRandom(allRoutes);
      bandit = banditRoute ? {
        active: true,
        route_id: banditRoute.id,
        route_name: banditRoute.name || `${banditRoute.city1_name} ↔ ${banditRoute.city2_name}`,
        expires_date: addDays(resetDate, 2),
        chance: 0.15, // 15% de chance de rencontre
        loss_pct: 0.10, // 10% des ressources perdues
      } : { active: false };
    }

    // ── Épidémie : change toutes les 2 nuits, touche une ville différente ──
    let epidemie = current.epidemie || { active: false };
    if (!epidemie.active || epidemie.expires_date <= resetDate) {
      const prevCityId = epidemie.city_id;
      const eligibleCities = realCities.filter(c => c.id !== prevCityId);
      const epiCity = eligibleCities.length > 0 ? pickRandom(eligibleCities) : null;
      epidemie = epiCity ? {
        active: true,
        city_id: epiCity.id,
        city_name: epiCity.name,
        hunger_malus: -3,
        expires_date: addDays(resetDate, 2),
      } : { active: false };

      // Appliquer le malus faim à tous les résidents de la ville touchée
      if (epiCity) {
        const allPlayers = await base44.entities.PlayerProfile.list().catch(() => []);
        const residents = allPlayers.filter(p => p.home_city_id === epiCity.id || p.city_id === epiCity.id);
        for (const p of residents) {
          await base44.entities.PlayerProfile.update(p.id, {
            epidemie_malus_until: addDays(resetDate, 2),
          }).catch(() => {});
        }
        await base44.entities.TavernMessage.create({
          city_id: epiCity.id, author_email: "system", author_name: "Messager royal",
          profession: "",
          message: `🤒 Une épidémie frappe ${epiCity.name} ! La faim maximale est réduite de 3 pendant 2 jours. Achetez de la nourriture en urgence !`,
        }).catch(() => {});
      }
    }

    // ── Péage doublé : change toutes les 2 nuits ──
    let peage = current.peage || { active: false };
    if (!peage.active || peage.expires_date <= resetDate) {
      const peageRoute = allRoutes.length > 0 ? pickRandom(allRoutes) : null;
      peage = peageRoute ? {
        active: true,
        route_id: peageRoute.id,
        route_name: peageRoute.name || `${peageRoute.city1_name} ↔ ${peageRoute.city2_name}`,
        multiplier: 2,
        expires_date: addDays(resetDate, 2),
      } : { active: false };
    }

    await base44.entities.EconomySettings.update(eco.id, {
      world_events: { caravane, bandit, epidemie, peage },
    }).catch(() => {});

  } catch(e) {
    console.warn("rotateWorldEvents error:", e);
  }
}

async function snapshotEconomy(resetDate, players, cities) {
  try {
    const totalPlayersGold = players.reduce((s, p) => s + (p.gold || 0), 0);
    const totalCitiesGold  = cities.reduce((s, c) => s + (c.gold_treasury || 0), 0);
    const playerCount = players.length;
    const orMoyenParJoueur = playerCount > 0 ? Math.round(totalPlayersGold / playerCount) : 0;
    
    // Calcul inflation vs jour précédent (SEULEMENT total_players_gold)
    const snapshots = await base44.entities.EconomySnapshot.list("-created_date", 2).catch(() => []);
    let inflationRate = 0;
    if (snapshots.length >= 2) {
      const prev = snapshots[1];
      const prevMoyen = prev.player_count > 0 ? (prev.total_players_gold / prev.player_count) : 0;
      inflationRate = prevMoyen > 0 ? ((orMoyenParJoueur / prevMoyen) - 1) * 100 : 0;
    }
    
    // ── Sampling économique : panel de 100 joueurs actifs + 10 listings par catégorie ──
    const allListings = await base44.entities.MarketListing.filter({ status: "active" }).catch(() => []);
    const economySample = sampleEconomyData(players, allListings);

    // Calcul des prix dynamiques T2-T5 depuis les listings sampléisés T1
    const sampledListings = Object.values(economySample.listingsByCategory).flat();
    const dynamicPrices = calculateDynamicPrices(sampledListings);
    
    // Mise à jour EconomySettings avec inflation + ajustement multiplicateur objectifs + prix dynamiques
    const ecoSettings = await base44.entities.EconomySettings.filter({ setting_key: "global" }).catch(() => []);
    if (ecoSettings.length > 0) {
      const eco = ecoSettings[0];
      // Ajuster objective_reward_multiplier selon l'inflation du jour précédent
      // Inflation > 2% → récompenses baissent (×0.9), inflation < 0% → récompenses montent (×1.1)
      let newMultiplier = eco.objective_reward_multiplier ?? 1.0;
      if (inflationRate > 2) {
        newMultiplier = Math.max(0.5, newMultiplier * 0.9);
      } else if (inflationRate < 0) {
        newMultiplier = Math.min(2.0, newMultiplier * 1.1);
      }
      newMultiplier = Math.round(newMultiplier * 100) / 100;

      await base44.entities.EconomySettings.update(eco.id, {
        or_moyen_par_joueur: orMoyenParJoueur,
        last_updated: resetDate,
        inflation_daily_rate: inflationRate,
        objective_reward_multiplier: newMultiplier,
        dynamic_prices: dynamicPrices, // Stocké pour admin (métiers secondaires le révèleront plus tard)
      }).catch(() => {});
    }
    
    await base44.entities.EconomySnapshot.create({
      date: resetDate,
      total_players_gold: totalPlayersGold,
      total_cities_gold: totalCitiesGold,
      total_circulation: totalPlayersGold + totalCitiesGold,
      player_count: playerCount,
      inflation_rate: inflationRate,
    });
  } catch(e) { console.warn("EconomySnapshot:", e); }
}



// ── Mélange Fisher-Yates pour ordonner les bâtiments aléatoirement ──
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function resetCity(city, resetDate, players = []) {
  const cityUpdates = {};
  const mayorActive = !!(city.mayor_id && city.mayor_until && city.mayor_until >= resetDate);

  // ── Résolution élection : le jour où le mandat se termine ──
  // mayor_until = J10 → on résout le soir du J10 (resetDate === mayor_until)
  if (city.mayor_until && city.mayor_until === resetDate) {
    const candidates = city.election_candidates || [];
    const votes = city.election_votes || {};

    if (candidates.length > 0) {
      // Compter les votes par candidat
      const tally = {};
      for (const candidateId of Object.values(votes)) {
        tally[candidateId] = (tally[candidateId] || 0) + 1;
      }

      // Trouver le candidat avec le plus de votes
      let winnerId = null;
      let maxVotes = -1;
      for (const candidate of candidates) {
        const voteCount = tally[candidate.player_id] || 0;
        if (voteCount > maxVotes) {
          maxVotes = voteCount;
          winnerId = candidate.player_id;
        }
      }

      if (winnerId) {
        const winner = candidates.find(c => c.player_id === winnerId);
        const newUntil = new Date(resetDate);
        newUntil.setDate(newUntil.getDate() + 10);
        const newUntilStr = newUntil.toISOString().split("T")[0];

        cityUpdates.mayor_id   = winner.player_id;
        cityUpdates.mayor_name = winner.player_name;
        cityUpdates.mayor_until = newUntilStr;
        cityUpdates.election_candidates = [];
        cityUpdates.election_votes = {};

        const hasTavern = (city.buildings || []).some(b => b.building_type === "taverne");
        if (hasTavern) {
          await base44.entities.TavernMessage.create({
            city_id: city.id, author_email: "system", author_name: "Héraut royal",
            profession: "",
            message: `🗳️ Résultats de l'élection de ${city.name} : ${winner.player_name} est élu(e) maire avec ${maxVotes} vote${maxVotes > 1 ? "s" : ""} ! Mandat jusqu'au ${newUntilStr}.`,
          }).catch(() => {});
        }
      } else {
        // Pas de votes → pas de maire
        cityUpdates.election_candidates = [];
        cityUpdates.election_votes = {};
      }
    } else {
      // Aucun candidat → pas de maire, on nettoie
      cityUpdates.election_candidates = [];
      cityUpdates.election_votes = {};
      cityUpdates.mayor_id = "";
      cityUpdates.mayor_name = "";
      cityUpdates.mayor_until = "";
    }
  }

  // ── Gestion du surpeuplement ──
  // Si population > max_population, expulser les résidents en excédent vers des villes aléatoires
  const residentsInCity = players.filter(p => p.home_city_id === city.id);
  const maxPop = city.max_population || 3;
  if (residentsInCity.length > maxPop) {
    const excess = residentsInCity.length - maxPop;
    const allCities = await base44.entities.City.list().catch(() => []);
    const otherCities = allCities.filter(c => c.id !== city.id && !c.is_bot_city);
    
    for (let i = 0; i < excess && otherCities.length > 0; i++) {
      const targetPlayer = residentsInCity[residentsInCity.length - 1 - i];
      const destCity = otherCities[Math.floor(Math.random() * otherCities.length)];
      try {
        // Rembourser 60% du logement acheté
        let refund = 0;
        const housingLevel = targetPlayer.housing_level || "tente";
        const housingCost = HOUSING[housingLevel]?.cost || 0;
        if (housingCost > 0) {
          refund = Math.floor(housingCost * 0.6);
        }
        
        await base44.entities.PlayerProfile.update(targetPlayer.id, {
          city_id: destCity.id,
          home_city_id: destCity.id,
          gold: (targetPlayer.gold || 0) + refund,
        });
        
        console.log(`DailyReset [${city.name}]: ${targetPlayer.character_name} expulsé(e) (surpeuplement) + remboursé ${refund} 💰`);
        
        await base44.entities.TavernMessage.create({
          city_id: city.id,
          author_email: "system",
          author_name: "Autorités",
          profession: "",
          message: `📍 ${targetPlayer.character_name} a été relocalisé(e) en raison du surpeuplement de ${city.name}. Remboursement: ${refund} 💰.`,
        }).catch(() => {});
      } catch (e) { console.warn(`DailyReset: expulsion surpeuplement échouée pour ${targetPlayer.user_email}`, e); }
    }
  }

  // ── Versement taxes marché journalières en trésorerie ──
  const dailyTaxCollected = city.daily_tax_collected || 0;
  if (dailyTaxCollected > 0) {
    cityUpdates.gold_treasury       = (city.gold_treasury || 0) + dailyTaxCollected;
    cityUpdates.treasury_cumulative = (city.treasury_cumulative || 0) + dailyTaxCollected;
    cityUpdates.daily_tax_collected = 0;
  }

  // ── Taxe de déclin sur la trésorerie (destruction d'or) ──
  // TREASURY_DECAY_RATE : % prélevé chaque jour sur la trésorerie
  // TREASURY_DECAY_FLOOR : plancher — pas de taxe en dessous de ce montant
  const TREASURY_DECAY_RATE  = 0.02; // 2% par jour
  const TREASURY_DECAY_FLOOR = 200;  // pas de taxe si tréso < 200💰
  const currentTreasury = (cityUpdates.gold_treasury ?? city.gold_treasury) || 0;
  if (currentTreasury > TREASURY_DECAY_FLOOR) {
    const decay = Math.floor(currentTreasury * TREASURY_DECAY_RATE);
    if (decay > 0) {
      cityUpdates.gold_treasury = currentTreasury - decay;
      await base44.entities.GoldTransaction.create({
        player_email: "system",
        character_name: "Système",
        city_id: city.id,
        city_name: city.name || "",
        amount: -decay,
        type: "treasury_decay",
        description: `Taxe de déclin : −${decay} 💰 (2% de ${currentTreasury} 💰)`,
        date: resetDate,
      }).catch(() => {});
    }
  }

  // ── Application du taux de taxe marché J+1 fixé par le maire ──
  // Si tax_rate_next a été défini par le maire (CityView ou MairieTab), on l'applique
  // ce matin et on remet tax_rate_next à null pour éviter des applications répétées.
  if (mayorActive
      && city.tax_rate_next !== undefined
      && city.tax_rate_next !== null
      && typeof city.tax_rate_next === "number") {
    cityUpdates.tax_rate      = city.tax_rate_next;
    cityUpdates.tax_rate_next = null;
  }

  // Taux de taxe + coût maire aléatoire (si pas de maire)
  if (city.tax_last_updated !== resetDate && !mayorActive) {
    cityUpdates.tax_rate             = generateDailyTax();
    cityUpdates.daily_tax_per_player = generateDailyTaxPerPlayer();
    cityUpdates.tax_last_updated     = resetDate;
  }
  // Coût pour devenir maire : aléatoire chaque jour (1-500, ou 1-200 avec Palais)
  if (!mayorActive) {
    const hasPalais = (city.buildings || []).some(b => b.building_type === "palais");
    cityUpdates.daily_mayor_cost = generateMayorCost(hasPalais);
  }

  // ── Palais : distribue 1 or par résident par jour (sans condition de maire) ──
  const hasPalais = (city.buildings || []).some(b => b.building_type === "palais");
  if (hasPalais) {
    const residents = players.filter(p => p.home_city_id === city.id);
    for (const resident of residents) {
      try {
        await base44.entities.PlayerProfile.update(resident.id, {
          gold: (resident.gold || 0) + 1,
        });
        await base44.entities.GoldTransaction.create({
          player_email: resident.user_email,
          player_name:  resident.character_name || "",
          city_id:      city.id,
          city_name:    city.name || "",
          amount:       1,
          type:         "salaire",
          description:  `Palais royal — distribution journalière`,
        }).catch(() => {});
      } catch(e) { console.warn("Palais gold dist:", e); }
    }
  }

  // ── Notifications phases électorales ──
  if (mayorActive && city.mayor_until) {
    const hasTavern = (city.buildings || []).some(b => b.building_type === "taverne");
    const mayorUntil = new Date(city.mayor_until);
    const today = new Date(resetDate);
    const daysLeft = Math.round((mayorUntil - today) / 86400000);

    // J8 : ouverture du vote (2 jours avant la fin)
    if (daysLeft === 2 && hasTavern) {
      const candidates = city.election_candidates || [];
      const candidateNames = candidates.length > 0
        ? candidates.map(c => c.player_name).join(", ")
        : "aucun candidat pour l'instant";
      await base44.entities.TavernMessage.create({
        city_id: city.id, author_email: "system", author_name: "Héraut royal",
        profession: "",
        message: `🗳️ Le vote est ouvert ! Le mandat de ${city.mayor_name} se termine dans 2 jours. Candidats : ${candidateNames}. Rendez-vous en page Ville pour voter !`,
      }).catch(() => {});
    }

    // J7 : ouverture des candidatures (début du dernier tiers)
    if (daysLeft === 7 && hasTavern) {
      await base44.entities.TavernMessage.create({
        city_id: city.id, author_email: "system", author_name: "Héraut royal",
        profession: "",
        message: `📜 Les candidatures sont ouvertes ! Le mandat de ${city.mayor_name} se termine dans 7 jours. Résidents, vous pouvez vous déclarer candidat en page Ville jusqu'au J8.`,
      }).catch(() => {});
    }
  }

  // Prix de rachat entrepôt
  if (city.buyback_price_date !== resetDate && !mayorActive) {
    cityUpdates.warehouse_buyback_prices = generateWarehouseBuybackPrices();
    cityUpdates.buyback_price_date       = resetDate;
  }

  // ── Maintenance bâtiments ──
  // Chaque bâtiment est traité individuellement dans un ordre aléatoire.
  // Les ressources sont déduites de l'entrepôt au fur et à mesure.
  // Si l'entrepôt manque de ressources pour un bâtiment → ce bâtiment est DÉTRUIT.
  // Pas de rattrapage multi-jours : le reset est déclenché à heure fixe (6h UTC).
  if (city.maintenance_last_run !== resetDate) {
    const buildings = city.buildings || [];

    if (buildings.length > 0) {
      // Copie de travail de l'entrepôt
      // L'or d'entretien est prélevé sur la trésorerie de la ville, pas sur l'entrepôt
      const warehouse = { ...(city.warehouse || {}), or: city.gold_treasury || 0 };
      let treasuryGoldUsed = 0;
      // Multiplicateur entretien : +20% par résident supplémentaire
      const residentCount = players.filter(p => p.home_city_id === city.id).length;
      const maintMultiplier = 1 + 0.2 * Math.max(0, residentCount - 1);
      // Ordre aléatoire : aucun bâtiment n'est systématiquement prioritaire
      const shuffled = shuffleArray(buildings);
      const surviving = [];
      const destroyed = [];

      for (const building of shuffled) {
        const bType = BUILDING_TYPES[building.building_type];
        const baseMaint = bType?.maintenance ?? {};
        // Appliquer le multiplicateur résidents + niveau du bâtiment
        // Les bâtiments production/bien_etre ont leur entretien qui double à chaque niveau
        const level = building.level || 1;
        const levelMultiplier = (bType?.category === "production" || bType?.category === "bien_etre")
          ? Math.pow(2, level - 1)
          : 1;
        const maint = Object.fromEntries(
          Object.entries(baseMaint).map(([res, qty]) => [res, Math.ceil(qty * maintMultiplier * levelMultiplier)])
        );

        if (Object.keys(maint).length === 0) {
          // Pas de coût d'entretien → survit toujours
          surviving.push(building);
          continue;
        }

        // Vérifier si on peut payer l'entretien complet de CE bâtiment
        const canAfford = Object.entries(maint).every(
          ([res, qty]) => (warehouse[res] || 0) >= qty
        );

        if (canAfford) {
          // Déduire les ressources consommées
          for (const [res, qty] of Object.entries(maint)) {
            warehouse[res] = (warehouse[res] || 0) - qty;
            if (qty > 0) base44.entities.WarehouseLog.create({
              city_id: city.id, city_name: city.name,
              player_email: "", player_name: bType?.name || building.building_type,
              action: "withdraw", item_key: res, item_name: res, quantity: qty, source: "maintenance",
            }).catch(() => {});
          }
          surviving.push(building);
        } else {
          // Ressources insuffisantes → bâtiment détruit
          destroyed.push(building);
          console.log(
            `DailyReset [${city.name}] : bâtiment "${bType?.name || building.building_type}" détruit (entretien insuffisant)`
          );
        }
      }

      // Retirer l'or utilisé de la trésorerie (pas du warehouse)
      const orUsed = (city.gold_treasury || 0) - warehouse.or;
      if (orUsed > 0) {
        cityUpdates.gold_treasury = Math.max(0, (city.gold_treasury || 0) - orUsed);
      }
      // Supprimer or du warehouse (il n'y est pas stocké)
      delete warehouse.or;
      cityUpdates.warehouse            = warehouse;
      cityUpdates.buildings            = surviving;
      cityUpdates.maintenance_last_run = resetDate;

      // Réduire max_population pour chaque bâtiment de logement détruit
      let maxPopReduction = 0;
      for (const destroyed_bldg of destroyed) {
        const bType = BUILDING_TYPES[destroyed_bldg.building_type];
        if (bType?.popBonus > 0) {
          maxPopReduction += bType.popBonus;
        }
      }
      if (maxPopReduction > 0) {
        cityUpdates.max_population = Math.max(3, (city.max_population || 3) - maxPopReduction);
      }

      // Message taverne si des bâtiments ont été détruits
      if (destroyed.length > 0) {
        const names = destroyed
          .map(b => BUILDING_TYPES[b.building_type]?.name || b.building_type)
          .join(", ");
        try {
          await base44.entities.TavernMessage.create({
            city_id:      city.id,
            author_email: "system",
            author_name:  "Intendant royal",
            profession:   "",
            message:      `🏚️ Faute d'entretien, ${destroyed.length > 1 ? "ces bâtiments ont été détruits" : "ce bâtiment a été détruit"} : ${names}.`,
          });
        } catch (e) { console.warn("DailyReset: TavernMessage destruction impossible", e); }
      }
    } else {
      cityUpdates.maintenance_last_run = resetDate;
    }
  }

  // Reset budget rachat entrepôt chaque jour
  cityUpdates.warehouse_rachat_budget_used = 0;
  // Reset quota rachat T1 chaque jour
  cityUpdates.rachat_t1_bought_today = {};
  // Reset budget rachat T2/T3 chaque jour
  cityUpdates.rachat_t2t3_bought_today = {};
  // Reset j'aimes bâtiments chaque jour
  cityUpdates.building_likes = {};
  // Reset votes satisfaction maire chaque jour
  cityUpdates.mayor_satisfaction = {};

  // ── Salaire résidents ──
  if (city.resident_salary_enabled && (city.resident_salary || 0) > 0) {
    // Utiliser la trésorerie effective (après ajout des taxes collectées)
    const effectiveTreasury = (cityUpdates.gold_treasury ?? city.gold_treasury) || 0;
    const salaryPerResident = city.resident_salary || 5;
    const residents = players.filter(p => p.home_city_id === city.id);
    const totalSalary = salaryPerResident * residents.length;
    if (effectiveTreasury >= 200 && effectiveTreasury - totalSalary >= 0 && residents.length > 0) {
      for (const resident of residents) {
        try {
          await base44.entities.PlayerProfile.update(resident.id, {
            gold: (resident.gold || 0) + salaryPerResident,
          });
          await base44.entities.GoldTransaction.create({
            player_email: resident.user_email,
            player_name:  resident.character_name || "",
            city_id:      city.id,
            city_name:    city.name || "",
            amount:       salaryPerResident,
            type:         "salaire",
            description:  `Salaire journalier de ${city.name}`,
          }).catch(() => {});
        } catch (e) { console.warn("dailyReset salary:", e); }
      }
      cityUpdates.gold_treasury = effectiveTreasury - totalSalary;
      cityUpdates.treasury_cumulative = Math.max(0, ((cityUpdates.treasury_cumulative ?? city.treasury_cumulative) || 0) - totalSalary);
    }
  }

  if (Object.keys(cityUpdates).length > 0) {
    await base44.entities.City.update(city.id, cityUpdates);
  }

  // ── Résolution des pending_effects (attaques inter-villes) ──
  // Traité APRÈS la mise à jour cityUpdates pour avoir la ville fraîche
  await resolvePendingEffects(city, players, resetDate);
}

// ── Résolution des effets T5 en attente ──
async function resolvePendingEffects(city, players, resetDate) {
  const pending = city.pending_effects || {};
  const keys = Object.keys(pending);
  if (keys.length === 0) return;

  const cityUpdates = {};
  const cityBuildings = city.buildings || [];

  // Recharger la ville pour avoir l'état le plus récent (après maintenance)
  let freshCity;
  try { freshCity = await base44.entities.City.get(city.id); }
  catch(e) { freshCity = city; }

  for (const effectKey of keys) {
    const eff = pending[effectKey];
    if (!eff?.effect) continue;

    // ── Contrat Noble : priorité absolue ──
    if (freshCity.contrat_noble_active && eff.effect !== "sellable") {
      cityUpdates.contrat_noble_active = false;
      await base44.entities.TavernMessage.create({
        city_id: city.id, author_email: "system", author_name: "Événement",
        profession: "", message: `📜 Un Contrat Noble a mystérieusement neutralisé une attaque ennemie...`,
      }).catch(() => {});
      continue;
    }

    // ── Bâtiment défensif contre-attaque ──
    const counterBuilding = eff.counterBuilding;
    const hasCounter = counterBuilding
      ? cityBuildings.some(b => b.building_type === counterBuilding)
      : false;

    if (hasCounter) {
      // Bâtiment défensif absorbe l'attaque → il est détruit
      const idx = cityBuildings.findIndex(b => b.building_type === counterBuilding);
      const survivingBuildings = cityBuildings.filter((_, i) => i !== idx);
      cityUpdates.buildings = survivingBuildings;
      await base44.entities.TavernMessage.create({
        city_id: city.id, author_email: "system", author_name: "Défense",
        profession: "", message: `🛡️ Une attaque de ${eff.fromCityName || "ville inconnue"} a été repoussée ! Le bâtiment défensif a été détruit dans l'effort.`,
      }).catch(() => {});
      continue;
    }

    // ── Appliquer l'effet ──
    switch (eff.effect) {

      case "disable_building": {
        const eligible = cityBuildings.filter(b => b.building_type !== "taverne");
        if (eligible.length > 0) {
          const target = eligible[Math.floor(Math.random() * eligible.length)];
          const expiresAt = new Date(Date.now() + (eff.effectValue?.duration || 1) * 86400000).toISOString();
          cityUpdates.disabled_buildings = {
            ...(freshCity.disabled_buildings || {}),
            [target.building_type]: expiresAt,
          };
          await base44.entities.TavernMessage.create({
            city_id: city.id, author_email: "system", author_name: "Incident",
            profession: "", message: `🔥 Un incendie criminel a endommagé ${target.building_type} — désactivé pour ${eff.effectValue?.duration || 1} jour(s).`,
          }).catch(() => {});
        }
        break;
      }

      case "destroy_warehouse_stock": {
        const warehouse = { ...(freshCity.warehouse || {}) };
        const resources = Object.keys(warehouse).filter(k => (warehouse[k] || 0) > 0);
        if (resources.length > 0) {
          const target = resources[Math.floor(Math.random() * resources.length)];
          const destroyed = Math.floor((warehouse[target] || 0) * 0.80);
          warehouse[target] = Math.max(0, (warehouse[target] || 0) - destroyed);
          cityUpdates.warehouse = warehouse;
          await base44.entities.TavernMessage.create({
            city_id: city.id, author_email: "system", author_name: "Incident",
            profession: "", message: `💥 L'entrepôt a été saboté — ${destroyed} unités de ${target} détruites.`,
          }).catch(() => {});
        }
        break;
      }

      case "hunger_regen_fatigue_drain": {
        const expiresAt = new Date(Date.now() + (eff.effectValue?.duration || 2) * 86400000).toISOString();
        cityUpdates.production_malus = {
          ...(freshCity.production_malus || {}),
          hunger_drain_active_until: expiresAt,
          hunger_drain_value: eff.effectValue?.value || 5,
        };
        await base44.entities.TavernMessage.create({
          city_id: city.id, author_email: "system", author_name: "Alerte",
          profession: "", message: `☠️ Un festin empoisonné circule en ville — la récupération de faim coûte ${eff.effectValue?.value || 5}⚡ supplémentaires pendant ${eff.effectValue?.duration || 2} jour(s).`,
        }).catch(() => {});
        break;
      }

      case "blind_travel": {
        const expiresAt = new Date(Date.now() + (eff.effectValue?.duration || 2) * 86400000).toISOString();
        cityUpdates.blind_travel_until = expiresAt;
        await base44.entities.TavernMessage.create({
          city_id: city.id, author_email: "system", author_name: "Rumeur",
          profession: "", message: `👁️ De faux contrats circulent — les destinations des routes sont brouillées pour ${eff.effectValue?.duration || 2} jour(s).`,
        }).catch(() => {});
        break;
      }

      case "steal_treasury": {
        const warehouseRoyal = (freshCity.warehouse || {}).lingot_royal || 0;
        const stolenLingots = Math.floor(warehouseRoyal * 0.20);
        if (stolenLingots > 0) {
          const newWarehouse = { ...(freshCity.warehouse || {}), lingot_royal: Math.max(0, warehouseRoyal - stolenLingots) };
          cityUpdates.warehouse = newWarehouse;
          cityUpdates.lingots_stock = Math.max(0, (freshCity.lingots_stock || 0) - stolenLingots);
          if (eff.fromCityId) {
            try {
              const attackerCity = await base44.entities.City.get(eff.fromCityId);
              if (attackerCity) {
                await base44.entities.City.update(eff.fromCityId, {
                  lingots_stolen_cumul: (attackerCity.lingots_stolen_cumul || 0) + stolenLingots,
                });
              }
            } catch(e) {}
          }
          await base44.entities.TavernMessage.create({
            city_id: city.id, author_email: "system", author_name: "Incident",
            profession: "", message: `🗝️ Une clé forgée a dérobé ${stolenLingots} lingot${stolenLingots > 1 ? "s" : ""} royal/aux de l'entrepôt de la mairie !`,
          }).catch(() => {});
        }
        break;
      }

      case "redirect_taxes": {
        const expiresAt = new Date(Date.now() + (eff.effectValue?.duration || 2) * 86400000).toISOString();
        cityUpdates.taxes_redirected_until = expiresAt;
        cityUpdates.taxes_redirected_to = eff.fromCityId;
        await base44.entities.TavernMessage.create({
          city_id: city.id, author_email: "system", author_name: "Alerte",
          profession: "", message: `💰 Un élixir de discorde détourne les taxes vers ${eff.fromCityName || "une ville rivale"} pendant ${eff.effectValue?.duration || 2} jour(s).`,
        }).catch(() => {});
        break;
      }

      case "tax_loss": {
        const expiresAt = new Date(Date.now() + 2 * 86400000).toISOString();
        cityUpdates.tax_penalty_until = expiresAt;
        cityUpdates.tax_penalty_rate = eff.effectValue || 0.30;
        await base44.entities.TavernMessage.create({
          city_id: city.id, author_email: "system", author_name: "Rumeur",
          profession: "", message: `📰 De fausses informations se répandent — les taxes sont majorées de ${Math.round((eff.effectValue || 0.30) * 100)}% pendant 2 jours.`,
        }).catch(() => {});
        break;
      }

      case "production_cooldown_malus": {
        const tractsUntil = new Date(Date.now() + (eff.effectValue?.duration || 1) * 86400000).toISOString();
        cityUpdates.production_malus = {
          ...(cityUpdates.production_malus || freshCity.production_malus || {}),
          tracts_greve_active_until: tractsUntil,
        };
        await base44.entities.TavernMessage.create({
          city_id: city.id, author_email: "system", author_name: "Perturbation",
          profession: "", message: `⚡ Des tracts de grève circulent — cooldowns de production +20% pendant 24h.`,
        }).catch(() => {});
        break;
      }

      default:
        break;
    }
  }

  // Vider les pending_effects traités + appliquer les mises à jour
  cityUpdates.pending_effects = {};
  if (Object.keys(cityUpdates).length > 0) {
    await base44.entities.City.update(city.id, cityUpdates).catch(e => console.warn("resolvePendingEffects update:", e));
  }
}


// ── Passage de niveau ville : basé sur lingots_cumul ──
async function checkLevelUp(city) {
  const lingotsCumul = city.lingots_cumul || 0;
  const lastLevel = city.last_level || 1;

  // Paliers basés sur les lingots accumulés
  const levels = [
    { level: 1, threshold: 0 },
    { level: 2, threshold: 10 },
    { level: 3, threshold: 30 },
    { level: 4, threshold: 80 },
    { level: 5, threshold: 160 },
    { level: 6, threshold: 400 },
  ];

  let currentLevel = 1;
  for (const l of levels) {
    if (lingotsCumul >= l.threshold) currentLevel = l.level;
  }

  if (currentLevel > lastLevel) {
    try {
      await base44.entities.City.update(city.id, {
        last_level: currentLevel,
      });
      // Message taverne
      const hasTavern = (city.buildings || []).some(b => b.building_type === "taverne");
      if (hasTavern) {
        const levelNames = ["","Hameau","Village","Bourg","Cité","Capitale"];
        await base44.entities.TavernMessage.create({
          city_id: city.id,
          author_email: "system",
          author_name: "Héraut royal",
          profession: "",
          message: `🏆 ${city.name} est devenue un${currentLevel >= 3 ? "e" : ""} ${levelNames[currentLevel]} !`,
        });
      }
    } catch(e) { console.warn("checkLevelUp:", e); }
  }
}

async function collectDailyTax(players, cities, resetDate) {
  for (const player of players) {
    // Mode vacances → exonéré d'impôt
    if (player.vacation_until && new Date(player.vacation_until) > new Date()) continue;
    if (!player.home_city_id) continue;
    const homeCity = cities.find(c => c.id === player.home_city_id);
    if (!homeCity || homeCity.is_bot_city) continue;

    const buildings = homeCity.buildings || [];

    // ── Bonus faim quotidien des bâtiments ──
    let hungerBonus = 0;
    if (buildings.some(b => b.building_type === "hospice"))    hungerBonus += 2;
    if (buildings.some(b => b.building_type === "cathedrale")) hungerBonus += 3;

    const maxHunger = 10 + (buildings.some(b => b.building_type === "universite") ? 2 : 0);

    if (hungerBonus > 0 && (player.hunger ?? 10) < maxHunger) {
      const newHunger = Math.min(5, (player.hunger ?? 10) + hungerBonus); // bonus bâtiments plafonné à 5 (regen passive)
      try {
        await base44.entities.PlayerProfile.update(player.id, { hunger: newHunger });
      } catch(e) { console.warn("hunger bonus reset:", e); }
    }

    if (player.daily_tax_paid === resetDate) continue;

    const dailyTax = homeCity.daily_tax_per_player || 0;

    if (dailyTax <= 0) {
      await base44.entities.PlayerProfile.update(player.id, { daily_tax_paid: resetDate });
      continue;
    }

    // ── Maintenance logement ──
    const housingCost = HOUSING_MAINTENANCE[player.housing_level || "tente"] || 0;
    // Le meuble donne -50% pendant 10 jours (nouveau système)
    const hasMeuble = player.meuble_expires_at && player.meuble_expires_at >= resetDate;
    const meubleDiscount = hasMeuble ? (player.meuble_discount || 0.50) : 0;
    const effectiveHousingCost = hasMeuble ? Math.max(0, Math.floor(housingCost * (1 - meubleDiscount))) : housingCost;

    // ── Taxes marché différées (pending_market_tax par ville) ──
    const pendingTax = player.pending_market_tax || {};
    const pendingCityIds = Object.keys(pendingTax).filter(cid => pendingTax[cid] > 0);
    let totalMarketTaxPaid = 0;
    if (pendingCityIds.length > 0) {
      let playerGoldForTax = player.gold || 0;
      let sceauForTax = player.sceau_balance || 0;
      const debtByCity = { ...(player.debt_by_city || {}) };

      for (const cid of pendingCityIds) {
        let taxDue = Math.ceil(pendingTax[cid]); // arrondi au reset, pas par achat
        // Sceau absorbe en priorité
        if (sceauForTax > 0) {
          const fromSceau = Math.min(sceauForTax, taxDue);
          sceauForTax -= fromSceau;
          taxDue -= fromSceau;
        }
        // Or du joueur
        const actualTax = Math.min(taxDue, playerGoldForTax);
        const debtAdded = taxDue - actualTax;
        playerGoldForTax -= actualTax;
        totalMarketTaxPaid += actualTax;

        // Si le joueur ne peut pas tout payer → dette envers la ville
        if (debtAdded > 0) {
          debtByCity[cid] = (debtByCity[cid] || 0) + debtAdded;
          try {
            await base44.entities.GoldTransaction.create({
              player_email: player.user_email, player_name: player.character_name || "",
              city_id: cid, city_name: "",
              amount: -debtAdded, type: "taxe_marche",
              description: `Taxe marché impayée → dette envers ville (${debtAdded}💰)`,
            });
          } catch (e) { /* silencieux */ }
        }

        // Verser ce qui a été payé à la ville (avec redirection si Élixir de discorde)
        if (actualTax > 0) {
          try {
            const taxCity = await base44.entities.City.get(cid).catch(() => null);
            if (taxCity) {
              // Vérifier redirection taxes marché
              const mktRedirectActive = taxCity.taxes_redirected_until &&
                taxCity.taxes_redirected_until >= resetDate &&
                taxCity.taxes_redirected_to;
              const mktTargetId = mktRedirectActive ? taxCity.taxes_redirected_to : cid;
              const mktTargetCity = mktRedirectActive
                ? (cities.find(c => c.id === mktTargetId) || await base44.entities.City.get(mktTargetId).catch(() => taxCity))
                : taxCity;
              await base44.entities.City.update(mktTargetId, {
                gold_treasury:       (mktTargetCity.gold_treasury || 0) + actualTax,
                treasury_cumulative: (mktTargetCity.treasury_cumulative || 0) + actualTax,
                daily_tax_collected: (mktTargetCity.daily_tax_collected || 0) + actualTax,
              });
              await base44.entities.GoldTransaction.create({
                player_email: player.user_email, player_name: player.character_name || "",
                city_id: mktTargetId, city_name: mktTargetCity?.name || "",
                amount: -actualTax, type: "taxe_marche",
                description: mktRedirectActive
                  ? `Taxe marché détournée → ${mktTargetCity?.name || mktTargetId} (Élixir de discorde)`
                  : `Taxe marché journalière → ${taxCity.name || "ville"}`,
              }).catch(() => {});
            }
          } catch (e) { console.warn("DailyReset: pending_market_tax city update failed", e); }
        }
      }
      // Déduire du profil, vider pending_market_tax, enregistrer les dettes
      try {
        await base44.entities.PlayerProfile.update(player.id, {
          gold: playerGoldForTax,
          sceau_balance: sceauForTax,
          pending_market_tax: {},
          debt_by_city: debtByCity,
        });
      } catch (e) { console.warn("DailyReset: pending_market_tax player update failed", e); }
      // Mettre à jour les valeurs locales pour la suite du traitement
      player.gold = playerGoldForTax;
      player.sceau_balance = sceauForTax;
      player.debt_by_city = debtByCity;
    }

    const playerGold = player.gold || 0;
    const totalDue = dailyTax + effectiveHousingCost;

    // ── Sceau royal : absorbe l'impôt en priorité ──
    let sceauBalance = player.sceau_balance || 0;
    let remainingDue = totalDue;
    let sceauUsed = 0;
    if (sceauBalance > 0 && remainingDue > 0) {
      sceauUsed = Math.min(sceauBalance, remainingDue);
      remainingDue = Math.max(0, remainingDue - sceauUsed);
      sceauBalance = Math.max(0, sceauBalance - sceauUsed);
    }

    const canPayFull = playerGold >= remainingDue;

    if (canPayFull) {
      // ── Paiement normal (sceau en priorité, or pour le reste) ──
      await base44.entities.PlayerProfile.update(player.id, {
        daily_tax_paid: resetDate,
        gold: playerGold - remainingDue,
        sceau_balance: sceauBalance,
      });

      const taxToTreasury = Math.max(0, dailyTax - sceauUsed); // seul l'or va en trésorerie

      // ── Élixir de discorde : redirection des taxes vers une autre ville ──
      const redirectActive = homeCity.taxes_redirected_until &&
        homeCity.taxes_redirected_until >= resetDate &&
        homeCity.taxes_redirected_to;
      const taxTargetId = redirectActive ? homeCity.taxes_redirected_to : homeCity.id;
      const taxTargetCity = redirectActive
        ? (cities.find(c => c.id === taxTargetId) || await base44.entities.City.get(taxTargetId).catch(() => null))
        : null;
      const taxTargetName = taxTargetCity?.name || homeCity.name;

      const freshCity = await base44.entities.City.get(taxTargetId).catch(() => taxTargetCity || homeCity);
      await base44.entities.City.update(taxTargetId, {
        gold_treasury:       (freshCity.gold_treasury || 0) + taxToTreasury,
        treasury_cumulative: (freshCity.treasury_cumulative || 0) + taxToTreasury,
      });

      try {
        await base44.entities.GoldTransaction.create({
          player_email: player.user_email, player_name: player.character_name || "",
          city_id: taxTargetId, city_name: taxTargetName,
          amount: -dailyTax, type: "impot",
          description: redirectActive
            ? `Impôt journalier détourné → ${taxTargetName} (Élixir de discorde)`
            : `Impôt journalier → ${homeCity.name}`,
        });
      } catch (e) { console.warn("logGold impot:", e); }
      if (effectiveHousingCost > 0) {
        try {
          await base44.entities.GoldTransaction.create({
            player_email: player.user_email, player_name: player.character_name || "",
            city_id: homeCity.id, city_name: homeCity.name || "",
            amount: -effectiveHousingCost, type: "logement",
            description: `Entretien ${player.housing_level || "tente"}${hasMeuble ? ` (−${Math.round(meubleDiscount * 100)}% meuble)` : ""}`,
          });
        } catch (e) { console.warn("logGold housing:", e); }
      }

    } else {
      // ── Paiement impossible — DETTE par ville ──
      // L'or disponible est prélevé, le reste s'accumule en debt_by_city[homeCity.id].
      const actualPaid = playerGold;
      const debtAdded = remainingDue - actualPaid;
      const debtByCity = { ...(player.debt_by_city || {}) };
      debtByCity[homeCity.id] = (debtByCity[homeCity.id] || 0) + debtAdded;

      try {
        await base44.entities.PlayerProfile.update(player.id, {
          daily_tax_paid: resetDate,
          gold:           0,
          sceau_balance:  sceauBalance,
          debt_by_city:   debtByCity,
        });
      } catch (e) { console.warn("DailyReset: dette impôt impossible", e); }

      // Verser l'or partiel à la trésorerie
      if (actualPaid > 0) {
        const freshCity = await base44.entities.City.get(homeCity.id).catch(() => homeCity);
        await base44.entities.City.update(homeCity.id, {
          gold_treasury:       (freshCity.gold_treasury || 0) + actualPaid,
          treasury_cumulative: (freshCity.treasury_cumulative || 0) + actualPaid,
        });
      }

      try {
        await base44.entities.GoldTransaction.create({
          player_email: player.user_email, player_name: player.character_name || "",
          city_id: homeCity.id, city_name: homeCity.name || "",
          amount: -actualPaid, type: "impot",
          description: `Impôt partiellement payé → ${homeCity.name} (dette : ${debtAdded} 💰)`,
        });
      } catch (e) { console.warn("logGold impot dette:", e); }
    }

    // ── Prêts en retard : plafonner fatigue et faim à 3 ──
    const today = resetDate;
    const overdueLoans = (player.active_loans || []).filter(
      l => l.status === "active" && l.due_at && l.due_at < today
    );
    if (overdueLoans.length > 0) {
      try {
        await base44.entities.PlayerProfile.update(player.id, {
          fatigue: Math.min(player.fatigue ?? 100, 3),
          hunger:  Math.min(player.hunger  ?? 10,  3),
          loan_defaulted: true,
        });
      } catch (e) { console.warn("DailyReset: overdue loan cap:", e); }
    } else {
      // Effacer le flag si tous les prêts sont remboursés
      if (player.loan_defaulted) {
        try {
          await base44.entities.PlayerProfile.update(player.id, { loan_defaulted: false });
        } catch (e) {}
      }
    }
  }
}

// ── Intérêts bancaires + expiration items ──
async function applyBankingAndExpiry(players, resetDate) {
  for (const player of players) {
    const updates = {};

    // ── Intérêts dépôts ──
    if (player.active_deposits && player.active_deposits.length > 0) {
      const newDeposits = player.active_deposits.map(d => {
        const rate = (d.interest_rate || 0) / 100;
        const newAmount = Math.floor(d.amount * (1 + rate));
        return { ...d, amount: newAmount };
      });
      updates.active_deposits = newDeposits;
    }

    // ── Intérêts prêts ──
    if (player.active_loans && player.active_loans.length > 0) {
      const newLoans = player.active_loans.map(l => {
        const rate = (l.interest_rate || 0) / 100;
        const newAmount = Math.floor(l.amount * (1 + rate));
        return { ...l, amount: newAmount };
      });
      updates.active_loans = newLoans;
    }

    // ── Clearance items temporaires expirés ──
    if (player.convoi_expires_at && player.convoi_expires_at < resetDate) {
      updates.convoi_expires_at = "";
    }
    if (player.meuble_expires_at && player.meuble_expires_at < resetDate) {
      updates.meuble_expires_at = "";
    }
    // ── Nettoyage bonus temporaires consommables ──
    const nowIso = new Date().toISOString();
    if (player.attack_bonus_expires_at && player.attack_bonus_expires_at < nowIso) {
      updates.attack_bonus_expires_at = "";
    }
    if (player.defense_bonus_expires_at && player.defense_bonus_expires_at < nowIso) {
      updates.defense_bonus_expires_at = "";
    }
    if (player.energy_max_bonus_expires_at && player.energy_max_bonus_expires_at < nowIso) {
      updates.energy_max_bonus_expires_at = "";
      updates.energy_max_bonus_value = 0;
    }
    if (player.inventory_bonus_expires_at && player.inventory_bonus_expires_at < nowIso) {
      updates.inventory_bonus_expires_at = "";
      updates.inventory_bonus_value = 0;
    }
    if (player.cooldown_bonus_expires_at && player.cooldown_bonus_expires_at < nowIso) {
      updates.cooldown_bonus_expires_at = "";
      updates.cooldown_bonus_value = 0;
    }
    if (player.epidemie_malus_until && player.epidemie_malus_until < resetDate) {
      updates.epidemie_malus_until = "";
    }
    // ── Nettoyage regen faim/énergie ──
    if (player.hunger_regen_bonus_expires_at && player.hunger_regen_bonus_expires_at < nowIso) {
      updates.hunger_regen_bonus_expires_at = "";
      updates.hunger_regen_interval_min = 0;
      updates.hunger_regen_value = 0;
    }
    if (player.energy_regen_bonus_expires_at && player.energy_regen_bonus_expires_at < nowIso) {
      updates.energy_regen_bonus_expires_at = "";
      updates.energy_regen_interval_min = 0;
      updates.energy_regen_value = 0;
    }

    // ── Mise à jour si modifications ──
    if (Object.keys(updates).length > 0) {
      try {
        await base44.entities.PlayerProfile.update(player.id, updates);
      } catch (e) {
        console.warn(`DailyReset: banking/expiry for ${player.user_email}:`, e);
      }
    }
  }
}

// ── Spawn sceaux royaux anti-inflation ──
async function spawnSceauxRoyaux(players, cities, resetDate) {
  try {
    const ecoArr = await base44.entities.EconomySettings.filter({ setting_key: "global" }).catch(() => []);
    const eco = ecoArr[0];
    if (!eco) return;

    const orMoyen = eco.or_moyen_par_joueur || 0;
    const SEUIL = 500;
    if (orMoyen <= SEUIL) return;

    const nbSceaux = Math.min(5, Math.floor((orMoyen - SEUIL) / 100));
    if (nbSceaux <= 0) return;

    // Vérifier s'il reste déjà des sceaux actifs du système — si oui, ne pas en remettre
    const existingSceaux = await base44.entities.MarketListing.filter({
      seller_email: "system",
      status: "active",
    }).catch(() => []);
    const activeSceaux = existingSceaux.filter(l => l.item_name === "Sceau royal");
    if (activeSceaux.length > 0) {
      console.log(`DailyReset: ${activeSceaux.length} sceau(x) royal/aux déjà en vente, pas de nouveau spawn.`);
      return;
    }

    // Tirer N villes aléatoires parmi les villes réelles non-bot
    const realCities = cities.filter(c => !c.is_bot_city);
    if (realCities.length === 0) return;

    const shuffled = [...realCities].sort(() => Math.random() - 0.5);
    const selectedCities = shuffled.slice(0, Math.min(nbSceaux, shuffled.length));

    for (const city of selectedCities) {
      await base44.entities.MarketListing.create({
        seller_email:  "system",
        seller_name:   "Trésor royal",
        city_id:       city.id,
        item_name:     "Sceau royal",
        item_category: "parchemins",
        item_tier:     0,
        quantity:      1,
        price_per_unit: 100,
        status:        "active",
      }).catch(() => {});

      // Annonce en taverne si présente
      const hasTavern = (city.buildings || []).some(b => b.building_type === "taverne");
      if (hasTavern) {
        await base44.entities.TavernMessage.create({
          city_id: city.id, author_email: "system", author_name: "Crieur royal",
          profession: "",
          message: `🏵️ Le Trésor royal propose un Sceau royal à 100💰 sur le marché de ${city.name} ! Il absorbe jusqu'à 110💰 de taxes et d'impôts. 1 par joueur par jour — réservé aux joueurs ayant au moins 300💰.`,
        }).catch(() => {});
      }
    }

    console.log(`DailyReset: ${nbSceaux} sceau(x) royal/aux spawné(s) (or moyen: ${orMoyen}💰)`);
  } catch(e) {
    console.warn("spawnSceauxRoyaux error:", e);
  }
}

// ── Régénération objectifs quotidiens ──
async function refreshPlayerObjectives(players, cities, resetDate) {
  const ecoSettingsArr = await base44.entities.EconomySettings.filter({ setting_key: "global" }).catch(() => []);
  const ecoSettings = ecoSettingsArr[0] || {};

  for (const player of players) {
    if (!player.home_city_id) continue;
    const homeCity = cities.find(c => c.id === player.home_city_id);
    if (!homeCity) continue;

    try {
      // Expirer tous les objectifs actifs du joueur
      const activeObjectives = await base44.entities.PlayerObjective.filter({
        player_email: player.user_email,
        status: "active",
      }).catch(() => []);

      for (const obj of activeObjectives) {
        try { await base44.entities.PlayerObjective.update(obj.id, { status: "expired" }); }
        catch (e) { /* silencieux */ }
      }

      // Générer exactement 4 nouvelles quêtes
      const newObjectives = generatePlayerObjectives(player, homeCity.id, ecoSettings, cities);
      for (const obj of newObjectives) {
        try { await base44.entities.PlayerObjective.create(obj); }
        catch (e) { console.warn("refreshPlayerObjectives: create failed", e); }
      }
    } catch (e) {
      console.warn(`DailyReset: refreshPlayerObjectives for ${player.user_email}:`, e);
    }
  }
}
// ── Entretien quotidien des unités militaires ──────────────────────────────
// Pour chaque ville, prélève les ressources d'entretien sur l'entrepôt.
// Si l'entrepôt est insuffisant, les unités les plus faibles désertent.
// ── Entretien militaire quotidien — prélevé sur la trésorerie de la ville ──
// Or détruit directement (pas redistribué). Désertions si trésorerie insuffisante.
// ── Expiration des annonces marché (J+3) ──────────────────────────────────
async function expireMarketListings(resetDate) {
  try {
    const activeListings = await base44.entities.MarketListing.filter({ status: "active" }).catch(() => []);
    const expired = activeListings.filter(l => l.expires_at && l.expires_at < resetDate);
    
    for (const listing of expired) {
      try {
        // Rendre les items au vendeur
        const profiles = await base44.entities.PlayerProfile.filter({ user_email: listing.seller_email }).catch(() => []);
        const seller = profiles[0];
        if (seller && (listing.quantity || 0) > 0) {
          const inv = [...(seller.inventory || [])];
          const existing = inv.find(i => i.item_key === listing.item_key || i.item_name === listing.item_name);
          if (existing) {
            existing.quantity += listing.quantity;
          } else {
            inv.push({
              item_key:      listing.item_key || "",
              item_name:     listing.item_name,
              item_category: listing.item_category || "ressources",
              quantity:      listing.quantity,
            });
          }
          await base44.entities.PlayerProfile.update(seller.id, { inventory: inv }).catch(() => {});
        }
        await base44.entities.MarketListing.update(listing.id, { status: "expired" }).catch(() => {});
      } catch(e) { console.warn("expireMarketListings: erreur listing", listing.id, e); }
    }
    if (expired.length > 0) {
      console.log(`expireMarketListings: ${expired.length} annonce(s) expirée(s), items restitués.`);
    }
  } catch(e) { console.warn("expireMarketListings error:", e); }
}




// applySatietyVitalityDecay : retiré (barres appétit/forme supprimées du jeu)
// La fonction décrémentait satiety/vitality dans player_profiles. Comme ces
// colonnes vont être droppées, on retire toute la logique.

async function rotateInterTerritoryGateways(cities) {
  // Chaque jour, changer aléatoirement la ville de passage entre territoires
  try {
    const territories = await base44.entities.Territory.list().catch(() => []);
    if (territories.length < 2) return;

    const realCities = cities.filter(c => !c.is_bot_city);

    // Supprimer les anciennes routes inter-territoire
    const allRoutes = await base44.entities.TravelRoute.list().catch(() => []);
    const interRoutes = allRoutes.filter(r => r.is_inter_territory);
    for (const route of interRoutes) {
      await base44.entities.TravelRoute.delete(route.id).catch(() => {});
    }

    // Pour chaque paire de territoires adjacents, créer une nouvelle route
    for (let i = 0; i < territories.length - 1; i++) {
      const t1 = territories[i];
      const t2 = territories[i + 1];

      const t1Cities = realCities.filter(c => c.territory_id === t1.id);
      const t2Cities = realCities.filter(c => c.territory_id === t2.id);

      if (t1Cities.length === 0 || t2Cities.length === 0) continue;

      const gateway1 = t1Cities[Math.floor(Math.random() * t1Cities.length)];
      const gateway2 = t2Cities[Math.floor(Math.random() * t2Cities.length)];

      await Promise.all([
        base44.entities.TravelRoute.create({
          city_from_id: gateway1.id,
          city_to_id: gateway2.id,
          travel_time_minutes: 120,
          road_type: "inter_territoire",
          danger_level: "sûr",
          is_inter_territory: true,
          is_maritime: false,
        }),
        base44.entities.TravelRoute.create({
          city_from_id: gateway2.id,
          city_to_id: gateway1.id,
          travel_time_minutes: 120,
          road_type: "inter_territoire",
          danger_level: "sûr",
          is_inter_territory: true,
          is_maritime: false,
        }),
      ]);

      // Mettre à jour les gateway_city_id dans les territoires
      await base44.entities.Territory.update(t1.id, { gateway_city_id: gateway1.id }).catch(() => {});
      await base44.entities.Territory.update(t2.id, { gateway_city_id: gateway2.id }).catch(() => {});

      // Annoncer dans les tavernes
      for (const city of [...t1Cities, ...t2Cities]) {
        try {
          await base44.entities.TavernMessage.create({
            city_id: city.id,
            author_email: "system",
            author_name: "Héraut royal",
            profession: "",
            message: `🛤️ La route inter-territoire change de tracé ! Aujourd'hui le passage entre les territoires relie ${gateway1.name} à ${gateway2.name}.`,
          });
        } catch (e) { /* silencieux */ }
      }

      console.log(`InterTerritory gateway: ${gateway1.name} (${t1.name}) ↔ ${gateway2.name} (${t2.name})`);
    }
  } catch (e) {
    console.error("rotateInterTerritoryGateways error:", e);
  }
}

async function applyPopulationConsumption(cities, players) {
  // Chaque résident actif coûte 1 ressource T1 aléatoire/jour à l'entrepôt communautaire
  const T1_KEYS = ["bois_brut", "pierre_brute", "minerai_fer", "ble", "laine_brute", "herbes", "quartz_brut"];

  for (const city of cities) {
    if (city.is_bot_city) continue;
    const residents = players.filter(p => p.home_city_id === city.id);
    if (residents.length === 0) continue;

    const warehouse = { ...(city.warehouse || {}) };
    let changed = false;

    for (const resident of residents) {
      // Tirer uniquement parmi les T1 présentes en stock
      const available = T1_KEYS.filter(k => (warehouse[k] || 0) > 0);
      if (available.length > 0) {
        // Stock disponible → consommer 1 unité d'une T1 présente au hasard
        const needed = available[Math.floor(Math.random() * available.length)];
        warehouse[needed] = (warehouse[needed] || 0) - 1;
        changed = true;
        base44.entities.WarehouseLog.create({
          city_id: city.id, city_name: city.name,
          player_email: resident.user_email || "", player_name: resident.character_name || "",
          action: "withdraw", item_key: needed, item_name: needed, quantity: 1, source: "population",
        }).catch(() => {});
      } else {
        // Entrepôt complètement vide → pénalité 20% sur la T1 la plus abondante
        const nonEmpty = T1_KEYS.filter(k => (warehouse[k] || 0) > 0);
        if (nonEmpty.length > 0) {
          const fallback = nonEmpty[Math.floor(Math.random() * nonEmpty.length)];
          const loss = Math.floor((warehouse[fallback] || 0) * 0.20);
          if (loss > 0) {
            warehouse[fallback] = Math.max(0, (warehouse[fallback] || 0) - loss);
            changed = true;
            console.log(`PopulationConsumption [${city.name}] : ${resident.character_name || resident.user_email} — entrepôt vide, perd ${loss}× ${fallback}`);
            base44.entities.WarehouseLog.create({
              city_id: city.id, city_name: city.name,
              player_email: resident.user_email || "", player_name: resident.character_name || "",
              action: "withdraw", item_key: fallback, item_name: fallback, quantity: loss, source: "population_penalty",
            }).catch(() => {});
          }
        }
      }
    }

    if (changed) {
      await base44.entities.City.update(city.id, { warehouse }).catch(() => {});
      console.log(`PopulationConsumption [${city.name}] : ${residents.length} résidents consommés`);
    }
  }
}

async function applyMilitaryMaintenance(cities) {
  // Coût d'entretien en or/jour + nourriture/énergie par unité
  const UNIT_ENTRETIEN_GOLD = {
    milicien:  1,
    archer:    1,
    fantassin: 2,
    cavalier:  3,
    catapulte: 5,
    chevalier: 10,
  };
  const UNIT_STRENGTH_ORDER = ["milicien", "archer", "fantassin", "cavalier", "catapulte", "chevalier"];

  try {
    const armies = await base44.entities.CityArmy.list().catch(() => []);

    for (const army of armies) {
      const city = cities.find(c => c.id === army.city_id);
      if (!city) continue;

      const units = army.units || {};
      const totalByType = {};
      for (const [type, qty] of Object.entries(units)) {
        if ((qty || 0) > 0) totalByType[type] = qty;
      }
      if (Object.keys(totalByType).length === 0) continue;

      // Calculer l'entretien total en or
      let totalGoldCost = 0;
      for (const [type, qty] of Object.entries(totalByType)) {
        totalGoldCost += (UNIT_ENTRETIEN_GOLD[type] || 0) * qty;
      }
      if (totalGoldCost === 0) continue;

      const currentTreasury = city.gold_treasury || 0;

      if (currentTreasury >= totalGoldCost) {
        // Trésorerie suffisante — prélever l'or (détruit, pas redistribué)
        await base44.entities.City.update(city.id, {
          gold_treasury: currentTreasury - totalGoldCost,
        });
        console.log(`MilitaryMaintenance: ${city.name} — ${totalGoldCost}💰 prélevés sur trésorerie.`);
      } else {
        // Trésorerie insuffisante — désertions progressives (les plus faibles d'abord)
        const newUnits = { ...totalByType };
        let remaining = currentTreasury;
        let deserters = [];

        for (const type of UNIT_STRENGTH_ORDER) {
          if ((newUnits[type] || 0) <= 0) continue;
          const costPerUnit = UNIT_ENTRETIEN_GOLD[type] || 0;
          const totalForType = costPerUnit * newUnits[type];

          if (remaining >= totalForType) {
            // Peut payer ce type entièrement
            remaining -= totalForType;
          } else {
            // Peut payer partiellement — calculer combien d'unités peuvent rester
            const canKeep = costPerUnit > 0 ? Math.floor(remaining / costPerUnit) : newUnits[type];
            const lost = newUnits[type] - canKeep;
            if (lost > 0) {
              deserters.push({ type, qty: lost, icon: { milicien: "🗡️", archer: "🏹", fantassin: "🪖", cavalier: "🐴", catapulte: "💥", chevalier: "⚔️" }[type] || "👤" });
            }
            remaining -= canKeep * costPerUnit;
            newUnits[type] = canKeep;
          }
        }

        // Prélever ce qui reste de la trésorerie (tout est détruit)
        await base44.entities.CityArmy.update(army.id, { units: newUnits });
        await base44.entities.City.update(city.id, { gold_treasury: 0 });

        if (deserters.length > 0) {
          const msg = deserters.map(d => `${d.qty}× ${d.icon}`).join(" ");
          await base44.entities.TavernMessage.create({
            city_id: city.id,
            author_email: "system",
            author_name: "⚠️ Intendant militaire",
            profession: "",
            message: `⚠️ La trésorerie de ${city.name} ne peut plus payer l'entretien de l'armée (manque ${totalGoldCost - currentTreasury}💰). Déserteurs : ${msg}. Le maire doit renflouer la trésorerie !`,
          }).catch(() => {});
        }

        console.log(`MilitaryMaintenance: ${city.name} — trésorerie insuffisante, désertions : ${deserters.map(d => d.qty + "× " + d.type).join(", ")}`);
      }

      // ── Consommation nourriture ──
      let totalFoodCost = 0;
      let totalEnergyCost = 0;
      for (const [type, qty] of Object.entries(totalByType)) {
        totalFoodCost   += (UNIT_TYPES[type]?.food_cost   || 0) * qty;
        totalEnergyCost += (UNIT_TYPES[type]?.energy_cost || 0) * qty;
      }

      const cityUpdForSupply = {};
      const supplyDeserters = [];

      // Nourriture
      if (totalFoodCost > 0) {
        const currentFood = city.army_food || 0;
        if (currentFood >= totalFoodCost) {
          cityUpdForSupply.army_food = currentFood - totalFoodCost;
        } else {
          // Pénurie — désertions proportionnelles (unités les plus faibles d'abord)
          const shortage = totalFoodCost - currentFood;
          const newUnitsFood = { ...(await base44.entities.CityArmy.filter({ city_id: city.id }).catch(() => []))[0]?.units || totalByType };
          let toPurge = shortage; // points de nourriture manquants
          for (const type of UNIT_ORDER_BY_STRENGTH) {
            if (!newUnitsFood[type] || toPurge <= 0) continue;
            const fc = UNIT_TYPES[type]?.food_cost || 1;
            const canLose = Math.min(newUnitsFood[type], Math.ceil(toPurge / fc));
            if (canLose > 0) {
              supplyDeserters.push({ type, qty: canLose, reason: "faim" });
              newUnitsFood[type] = Math.max(0, newUnitsFood[type] - canLose);
              toPurge -= canLose * fc;
            }
          }
          // Mettre à jour l'armée
          const armyRec = await base44.entities.CityArmy.filter({ city_id: city.id }).catch(() => []);
          if (armyRec[0]) await base44.entities.CityArmy.update(armyRec[0].id, { units: newUnitsFood });
          cityUpdForSupply.army_food = 0;
        }
      }

      // Énergie
      if (totalEnergyCost > 0) {
        const currentEnergy = city.army_energy || 0;
        if (currentEnergy >= totalEnergyCost) {
          cityUpdForSupply.army_energy = currentEnergy - totalEnergyCost;
        } else {
          const shortage = totalEnergyCost - currentEnergy;
          const newUnitsEnergy = { ...(await base44.entities.CityArmy.filter({ city_id: city.id }).catch(() => []))[0]?.units || totalByType };
          let toPurge = shortage;
          for (const type of UNIT_ORDER_BY_STRENGTH) {
            if (!newUnitsEnergy[type] || toPurge <= 0) continue;
            const ec = UNIT_TYPES[type]?.energy_cost || 0;
            if (ec === 0) continue;
            const canLose = Math.min(newUnitsEnergy[type], Math.ceil(toPurge / ec));
            if (canLose > 0) {
              supplyDeserters.push({ type, qty: canLose, reason: "épuisement" });
              newUnitsEnergy[type] = Math.max(0, newUnitsEnergy[type] - canLose);
              toPurge -= canLose * ec;
            }
          }
          const armyRec = await base44.entities.CityArmy.filter({ city_id: city.id }).catch(() => []);
          if (armyRec[0]) await base44.entities.CityArmy.update(armyRec[0].id, { units: newUnitsEnergy });
          cityUpdForSupply.army_energy = 0;
        }
      }

      if (Object.keys(cityUpdForSupply).length > 0) {
        await base44.entities.City.update(city.id, cityUpdForSupply);
      }

      if (supplyDeserters.length > 0) {
        const foodMsg = supplyDeserters.filter(d => d.reason === "faim").map(d => `${d.qty}× ${UNIT_TYPES[d.type]?.icon || d.type}`).join(" ");
        const energyMsg = supplyDeserters.filter(d => d.reason === "épuisement").map(d => `${d.qty}× ${UNIT_TYPES[d.type]?.icon || d.type}`).join(" ");
        const parts = [];
        if (foodMsg) parts.push(`🍞 Déserteurs (faim) : ${foodMsg}`);
        if (energyMsg) parts.push(`⚡ Déserteurs (épuisés) : ${energyMsg}`);
        await base44.entities.TavernMessage.create({
          city_id: city.id,
          author_email: "system",
          author_name: "⚠️ Intendant militaire",
          profession: "",
          message: `⚠️ Les réserves de ravitaillement de ${city.name} sont épuisées ! ${parts.join(" — ")}. Le maire doit approvisionner les jauges via le panneau Armée.`,
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("applyMilitaryMaintenance error:", e);
  }
}
