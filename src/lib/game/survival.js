// ═══════════════════════════════════════════════════════════════════════════
// survival.js — Faim, fatigue, capacité d'inventaire et coûts d'action
// ═══════════════════════════════════════════════════════════════════════════
// Refonte avril 2026 : système unifié faim/énergie. Chaque action paie 1
// point tiré au sort (pile/face) sur la jauge faim ou la jauge énergie.
// Si la jauge tirée est vide, on bascule sur l'autre. Si les deux sont
// vides, l'action est bloquée.
//
// Les helpers ville (getCityHungerBonus, getCityFatigueBonus, getRegenCap,
// getRegenInterval) prennent une liste de bâtiments en argument pour rester
// indépendants du module buildings (lecture directe de building.building_type).

import { HOUSING } from "./housing.js";
import {
  getPassiveEnergyMaxBonus,
  getPassiveInventoryBonus,
} from "./buffs.js";
import { ITEMS as ITEMS_DEF } from "../craftingData.js";

// ── Constantes ──

export const MAX_HUNGER  = 15;        // base, avant bonus logement
export const MAX_FATIGUE = 15;        // base, avant bonus logement
export const REGEN_AUTO_CAP = 5;      // plafond de la régen auto pour les deux jauges
export const HUNGER_WARNING_THRESHOLD = 4; // seuil UI uniquement (warning visuel "mangez bientôt") — n'a plus d'effet mécanique
// Regen faim : UNIQUEMENT via consommables ou bâtiments (Fontaine/Hospice/Cathédrale)

export const FATIGUE_REGEN_INTERVAL_MS = 7200000; // valeur par défaut (maison) — voir getFatigueRegenInterval

// Regen énergie liée au logement : tente = 1h, cabane = 50min, maison = 40min, manoir = 30min
export function getFatigueRegenInterval(housingLevel) {
  const intervals = {
    tente:  3600000,   // 1 heure
    cabane: 3000000,   // 50 minutes
    maison: 2400000,   // 40 minutes
    manoir: 1800000,   // 30 minutes
  };
  return intervals[housingLevel] || 3600000; // fallback tente
}

// Items qui restaurent la faim — DÉRIVÉ AUTOMATIQUEMENT depuis craftingData.ITEMS
// REFACTO 09/05/2026 : source unique de vérité = ITEMS_DEF (craftingData.js).
// Évite la divergence entre `value`/`use` côté craftingData et cet objet.
// Pattern identique à FOOD_ITEMS_WITH_FATIGUE dans craftingData.js.
//
// Filtre : trigger=consumed + effect=hunger_restore
// → Capture automatiquement : ble, farine, pain, botte_paille, miel_fees,
//   et tout futur item qui aurait ces deux propriétés.
//
// POUR MODIFIER UNE VALEUR : changer uniquement `value` dans craftingData.js ITEMS,
// la mise à jour se propage partout automatiquement.
//
// Cas spécial ajouté manuellement après la dérivation :
// - potion_endur : maintenant fatigue_restore +50 directement (cf. craftingData.js).
//   La ligne legacy "+2 faim" reste pour compat avec d'anciens inventaires.
export const HUNGER_FOOD_ITEMS = {
  ...Object.fromEntries(
    Object.entries(ITEMS_DEF)
      .filter(([, v]) =>
        v.trigger === "consumed" &&
        v.effect === "hunger_restore"
      )
      .map(([key, v]) => [key, {
        hunger_restore: v.value,
        label: v.name,
        icon: v.icon,
      }])
  ),
  // 11/05/2026 : potion_endur a désormais effect "fatigue_restore" (cf craftingData)
  // mais on garde un fallback hunger=2 ici au cas où le code y accède via HUNGER_FOOD_ITEMS.
  potion_endur: { hunger_restore: 2, label: "Potion d'endurance", icon: "💪" },
};

// ── Capacité inventaire ──

// Get total inventory weight (1 unit = 1 weight regardless of item type)
export function getInventoryWeight(profile) {
  return (profile.inventory || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
}

export function getMaxWeight(profile) {
  return (HOUSING[profile.housing_level || "tente"]?.capacity || 100) + getPassiveInventoryBonus(profile);
}

// Get effective max weight (with convoi bonus)
export function getEffectiveMaxWeight(profile) {
  const base = getMaxWeight(profile);
  let weight = base;
  if (profile.convoi_expires_at && new Date(profile.convoi_expires_at) > new Date()) {
    weight = base * 2;
  }
  return Math.max(10, Math.floor(weight));
}

// Check if adding qty units would exceed capacity
export function wouldExceedCapacity(profile, qty) {
  return getInventoryWeight(profile) + qty > getEffectiveMaxWeight(profile);
}

// ── Faim / énergie : max ──

// Get max fatigue for a profile based on housing
export function getMaxFatigue(profile, cityFatigueBonus = 0) {
  const housingBonus = HOUSING[profile.housing_level || "tente"]?.fatigueBonus || 0;
  const epidemieMalus = (profile.epidemie_malus_until && new Date(profile.epidemie_malus_until) > new Date()) ? -3 : 0;
  return Math.max(5, MAX_FATIGUE + housingBonus + cityFatigueBonus + getPassiveEnergyMaxBonus(profile) + epidemieMalus);
}

export function getMaxHunger(profile, cityHungerBonus = 0) {
  const housingBonus = HOUSING[profile.housing_level || "tente"]?.hungerBonus || 0;
  return Math.max(5, MAX_HUNGER + housingBonus + cityHungerBonus + (profile.hunger_max_bonus || 0));
}

// ── Helpers ville → bonus pour faim/énergie/régen ──
// Ces fonctions prennent une liste de bâtiments (city.buildings) et retournent le bonus
// à passer aux fonctions getMaxHunger / getMaxFatigue / applyHungerRegen.
//
// Université = +2 faim max, Cathédrale = +2 faim max, +2 énergie max
// Hospice (par niveau) = +1/+2/+3/+4/+5 au plafond de régen automatique
// Fontaine = ×2 vitesse de régénération
export function getCityHungerBonus(buildings = []) {
  let bonus = 0;
  if (buildings.some(b => b.building_type === "universite"))  bonus += 2;
  if (buildings.some(b => b.building_type === "cathedrale"))  bonus += 2;
  return bonus;
}

export function getCityFatigueBonus(buildings = []) {
  let bonus = 0;
  if (buildings.some(b => b.building_type === "cathedrale")) bonus += 2;
  return bonus;
}

// Plafond de la régénération auto (faim et énergie) :
// 5 par défaut, + niveau de l'Hospice (max 10).
export function getRegenCap(buildings = []) {
  const hospice = buildings.find(b => b.building_type === "hospice");
  const lvl = hospice?.level || 0;
  return Math.min(MAX_HUNGER, REGEN_AUTO_CAP + lvl);
}

// Vitesse de régénération auto : intervalle de base divisé par 2 si Fontaine présente.
export function getRegenInterval(housingLevel, buildings = []) {
  const base = getFatigueRegenInterval(housingLevel || "tente");
  const hasFontaine = buildings.some(b => b.building_type === "fontaine");
  return hasFontaine ? Math.round(base / 2) : base;
}

// Festin empoisonné (T5) : pendant la durée de l'effet, manger pour restaurer la faim
// coûte X⚡ supplémentaires par usage. Retourne 0 si l'effet est inactif sur la ville.
export function getFestinHungerDrain(city) {
  if (!city?.production_malus) return 0;
  const until = city.production_malus.hunger_drain_active_until;
  if (!until) return 0;
  if (new Date(until) <= new Date()) return 0;
  return city.production_malus.hunger_drain_value || 5;
}

// ── Getters faim ──

export function getHunger(profile) {
  return profile.hunger ?? MAX_HUNGER; // par défaut plein si champ absent
}

export function isHungry(profile) {
  return getHunger(profile) <= 0;
}

// Conservé pour compat — toujours false depuis la refonte du système faim/énergie
export function hasHungerPenalty() {
  return false;
}

// Conservé pour compat — retourne toujours baseCost depuis la refonte
export function getActionFatigueCost(profile, baseCost = 1) {
  return baseCost;
}

// ─────────────────────────────────────────────
// applyRandomActionCost
// ─────────────────────────────────────────────
// Calcule le coût d'une action selon le système unifié faim/énergie.
//
// Tirage : pour chaque action, pile/face entre faim et énergie.
//   - jauge tirée a assez → on prélève dessus
//   - jauge tirée à 0 → on bascule sur l'autre jauge
//   - les deux insuffisantes → action bloquée
//
// Pour T2-T5 (cost > 1) : un seul tirage pour tout le coût d'un coup.
//   Si la jauge n'a pas assez, on bascule la totalité sur l'autre jauge.
//
// @param {Object} profile - PlayerProfile
// @param {number} cost - nombre de points à consommer (1 par défaut, 2 pour T2, etc.)
// @param {Object} opts - { cityFatigueBonus, cityHungerBonus } pour calculs max
// @returns { ok, newHunger, newFatigue, drainedFrom, errorMessage }
//   ok=false → action bloquée (errorMessage rempli)
//   drainedFrom = "hunger" | "fatigue" (la jauge qui a effectivement payé)
export function applyRandomActionCost(profile, cost = 1, opts = {}) {
  const { cityFatigueBonus = 0, cityHungerBonus = 0 } = opts;
  const currentHunger  = profile.hunger ?? getMaxHunger(profile, cityHungerBonus);
  const currentFatigue = profile.fatigue ?? getMaxFatigue(profile, cityFatigueBonus);

  // Si les deux jauges sont insuffisantes, on bloque
  if (currentHunger + currentFatigue < cost) {
    return {
      ok: false,
      newHunger: currentHunger,
      newFatigue: currentFatigue,
      drainedFrom: null,
      errorMessage: "💤 Vous êtes à bout de forces, reposez-vous !",
    };
  }

  // Tirage 50/50
  let pickHunger = Math.random() < 0.5;

  // Si la jauge tirée n'a pas assez, on bascule sur l'autre
  if (pickHunger && currentHunger < cost) pickHunger = false;
  else if (!pickHunger && currentFatigue < cost) pickHunger = true;

  if (pickHunger) {
    return {
      ok: true,
      newHunger:  Math.max(0, currentHunger - cost),
      newFatigue: currentFatigue,
      drainedFrom: "hunger",
      errorMessage: null,
    };
  } else {
    return {
      ok: true,
      newHunger:  currentHunger,
      newFatigue: Math.max(0, currentFatigue - cost),
      drainedFrom: "fatigue",
      errorMessage: null,
    };
  }
}
