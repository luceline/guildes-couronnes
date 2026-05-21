// src/lib/professionScoring.js
//
// 17/05/2026 — Système de recommandation de métier basé sur 2 signaux :
//   1. Nombre de joueurs déjà dans le métier (saturation humaine)
//   2. Volume de la matière première T1 disponible sur le marché (saturation économique)
//
// Utilisé par CharacterCreation (nouveau joueur) et ProfessionChangePanel
// (changement payant via Mairie).
//
// Algo :
//   score_pénurie(P) = 100 - poids_joueurs × nb_joueurs - poids_listings × qty_T1_marché
//   Plus le score est haut, plus le métier est demandé.
//   Tri descendant → top 1 = "Très demandé", top 2-3 = "Conseillé", reste "Présent",
//   et si score très bas → "Saturé".

import { base44 } from "@/api/base44Client";
import { PROFESSION_PRODUCTION } from "./craftingData";

// ── Mapping profession → T1 (matière première principale) ──
// Récupéré automatiquement depuis PROFESSION_PRODUCTION pour éviter divergence.
// Le Marchand est traité spécialement (pas de signal marché, juste nb_joueurs).
export function getT1KeyForProfession(profKey) {
  const recipes = PROFESSION_PRODUCTION[profKey];
  if (!recipes || recipes.length === 0) return null;
  // Première recette T1 du métier (tous les métiers actuels n'en ont qu'une)
  return recipes[0].outputKey;
}

// ── Poids du score ──
// Ajustables si la calibration ne convient pas.
// Avec 16 joueurs et ~5 listings T1 actifs en moyenne :
//   - 0 joueur, 0 listing → score = 100 (max)
//   - 1 joueur, 5 unités T1 → score = 100 - 25 - 2.5 = 72.5
//   - 3 joueurs, 30 unités → score = 100 - 75 - 15 = 10
//   - 5 joueurs, 80 unités → score = 100 - 125 - 40 = -65 (saturation forte)
const WEIGHT_PLAYERS = 25;
const WEIGHT_LISTINGS = 0.5;

/**
 * Charge tous les signaux nécessaires (joueurs + listings actifs) en parallèle.
 * Renvoie un dict { [profession]: { count_players, qty_listings_t1, score, badge } }.
 *
 * @returns {Promise<Object>}
 */
export async function loadProfessionScores() {
  // 1. Compter les joueurs par profession
  const [allPlayers, allListings] = await Promise.all([
    base44.entities.PlayerProfile.list().catch(() => []),
    base44.entities.MarketListing.filter({ status: "active" }, "", 500).catch(() => []),
  ]);

  // ── Comptage joueurs par profession ──
  const playerCounts = {};
  for (const p of allPlayers || []) {
    if (p.profession) {
      playerCounts[p.profession] = (playerCounts[p.profession] || 0) + 1;
    }
  }

  // ── Comptage quantités T1 sur marché par profession ──
  // On somme les `quantity` des listings actifs dont l'item_key correspond
  // au T1 d'une profession.
  const t1ByProfession = {};
  for (const profKey of Object.keys(PROFESSION_PRODUCTION)) {
    t1ByProfession[getT1KeyForProfession(profKey)] = profKey;
  }
  const listingCounts = {};
  for (const listing of allListings || []) {
    const prof = t1ByProfession[listing.item_key];
    if (prof) {
      listingCounts[prof] = (listingCounts[prof] || 0) + (listing.quantity || 0);
    }
  }

  // ── Calcul du score pénurie par profession ──
  const results = {};
  for (const profKey of Object.keys(PROFESSION_PRODUCTION)) {
    const nbPlayers = playerCounts[profKey] || 0;
    const qtyListings = listingCounts[profKey] || 0;
    // Cas spécial Marchand : pas de signal marché (billet_fortune en cours de
    // dépréciation). On ne compte que les joueurs.
    const effectiveListings = profKey === "Marchand" ? 0 : qtyListings;
    const score = 100 - (nbPlayers * WEIGHT_PLAYERS) - (effectiveListings * WEIGHT_LISTINGS);
    results[profKey] = {
      count_players: nbPlayers,
      qty_listings_t1: qtyListings,
      score,
    };
  }

  // ── Attribution des badges ──
  // Stratégie : trier par score décroissant.
  //   - Top 1 (score le plus haut) → "Très demandé"
  //   - Top 2-3 → "Conseillé"
  //   - Score < 0 → "Saturé"
  //   - Le reste → "Présent"
  const sortedProfs = Object.entries(results)
    .sort(([, a], [, b]) => b.score - a.score)
    .map(([k]) => k);

  sortedProfs.forEach((profKey, idx) => {
    const { score } = results[profKey];
    let badge;
    if (score < 0) {
      badge = {
        label: "❌ Saturé",
        color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
        priority: 3,
      };
    } else if (idx === 0) {
      badge = {
        label: "🔥 Très demandé",
        color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
        priority: 0,
      };
    } else if (idx <= 2) {
      badge = {
        label: "✨ Conseillé",
        color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
        priority: 1,
      };
    } else {
      badge = {
        label: "⚠️ Présent",
        color: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
        priority: 2,
      };
    }
    results[profKey].badge = badge;
  });

  return results;
}

/**
 * Version synchrone qui prend en input les données déjà chargées par l'appelant.
 * Utile si CharacterCreation veut éviter un double load (il charge déjà allPlayers).
 *
 * @param {Array} allPlayers - liste des PlayerProfile
 * @param {Array} allListings - liste des MarketListing actifs (status="active")
 * @returns {Object}
 */
export function computeProfessionScores(allPlayers, allListings) {
  // ── Comptage joueurs ──
  const playerCounts = {};
  for (const p of allPlayers || []) {
    if (p.profession) {
      playerCounts[p.profession] = (playerCounts[p.profession] || 0) + 1;
    }
  }

  // ── Mapping T1 → profession ──
  const t1ByProfession = {};
  for (const profKey of Object.keys(PROFESSION_PRODUCTION)) {
    t1ByProfession[getT1KeyForProfession(profKey)] = profKey;
  }

  // ── Comptage listings T1 ──
  const listingCounts = {};
  for (const listing of allListings || []) {
    const prof = t1ByProfession[listing.item_key];
    if (prof) {
      listingCounts[prof] = (listingCounts[prof] || 0) + (listing.quantity || 0);
    }
  }

  // ── Score + badge ──
  const results = {};
  for (const profKey of Object.keys(PROFESSION_PRODUCTION)) {
    const nbPlayers = playerCounts[profKey] || 0;
    const qtyListings = listingCounts[profKey] || 0;
    const effectiveListings = profKey === "Marchand" ? 0 : qtyListings;
    const score = 100 - (nbPlayers * WEIGHT_PLAYERS) - (effectiveListings * WEIGHT_LISTINGS);
    results[profKey] = {
      count_players: nbPlayers,
      qty_listings_t1: qtyListings,
      score,
    };
  }

  const sortedProfs = Object.entries(results)
    .sort(([, a], [, b]) => b.score - a.score)
    .map(([k]) => k);

  sortedProfs.forEach((profKey, idx) => {
    const { score } = results[profKey];
    let badge;
    if (score < 0) {
      badge = {
        label: "❌ Saturé",
        color: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
        priority: 3,
      };
    } else if (idx === 0) {
      badge = {
        label: "🔥 Très demandé",
        color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
        priority: 0,
      };
    } else if (idx <= 2) {
      badge = {
        label: "✨ Conseillé",
        color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
        priority: 1,
      };
    } else {
      badge = {
        label: "⚠️ Présent",
        color: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
        priority: 2,
      };
    }
    results[profKey].badge = badge;
  });

  return results;
}
