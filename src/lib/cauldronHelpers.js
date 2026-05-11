/**
 * cauldronHelpers.js : helpers frontend pour le chaudron magique.
 *
 * Couvre :
 *   - chargement du chaudron du joueur (loadMyCauldron)
 *   - récupération des inputs du jour (loadDailyInputs)
 *   - calcul des effets pondérés des outputs (rollOutput)
 *   - vérification des dômes de protection actifs (isCityProtected)
 *   - calcul de la valeur en or virtuel d'un item (computeFeedValue)
 */
import { base44 } from "@/api/base44Client";
import { getDonationValue } from "@/lib/royalStatueHelpers";

// ─── Constantes ──────────────────────────────────────────────────────────
export const CAULDRON_RANK_THRESHOLDS = {
  2: 200,  // or virtuels à nourrir pour passer rang 1 -> 2
  3: 800,  // or virtuels à nourrir pour passer rang 2 -> 3
};

export const CAULDRON_CREATION_COST = {
  gold: 50,
  items: [
    { key: "bois_brut",         qty: 1 },
    { key: "minerai_fer",       qty: 1 },
    { key: "ble",               qty: 1 },
    { key: "laine_brute",       qty: 1 },
    { key: "herbes",            qty: 1 },
    { key: "quartz_brut",       qty: 1 },
    { key: "pierre",            qty: 1 },
    // REFONTE MARCHAND (10/05/2026) : autorisation_marche retirée
    // (devenue un T1 sans valeur d'usage, ne fait plus sens comme coût).
  ],
};

// ─── Pool d'outputs avec pondérations ────────────────────────────────────
// Format : { key, weight, tier }
// La pondération est appliquée par rang :
//   Rang 1 : seuls les T1 (4 items)
//   Rang 2 : T1 (30%) + T2 (70%)
//   Rang 3 : T1 (15%) + T2 (35%) + T3 (50%)

export const CAULDRON_OUTPUTS = [
  // ── T1 (4 items, équiprobables au sein du tier) ──
  { key: "tisane_revigorante", tier: 1, weight: 1 },
  { key: "botte_paille",       tier: 1, weight: 1 },
  { key: "trefle_chance",      tier: 1, weight: 1 },
  { key: "plume_vent",         tier: 1, weight: 1 },

  // ── T2 (5 items, équiprobables au sein du tier) ──
  { key: "piece_porte_bonheur", tier: 2, weight: 1 },
  { key: "pierre_feu",          tier: 2, weight: 1 },
  { key: "parchemin_marchand",  tier: 2, weight: 1 },
  { key: "miel_fees",           tier: 2, weight: 1 },
  { key: "pierre_energetique",  tier: 2, weight: 1 },

  // ── T3 (6 items, équiprobables au sein du tier) ──
  { key: "hibou_messager",       tier: 3, weight: 1 },
  { key: "sablier_ages",         tier: 3, weight: 1 },
  { key: "etoile_filante",       tier: 3, weight: 1 },
  { key: "talisman_protection",  tier: 3, weight: 1 },
  { key: "parchemin_craft",      tier: 3, weight: 1 },
  { key: "oeil_archer",          tier: 3, weight: 1 },
];

// Probabilités de tier selon le rang du chaudron
const TIER_DISTRIBUTION = {
  1: { 1: 1.00, 2: 0.00, 3: 0.00 },   // Rang 1 : 100% T1
  2: { 1: 0.30, 2: 0.70, 3: 0.00 },   // Rang 2 : 30% T1, 70% T2
  3: { 1: 0.15, 2: 0.35, 3: 0.50 },   // Rang 3 : 15% T1, 35% T2, 50% T3
};

// ─── Cache local ────────────────────────────────────────────────────────
let _cauldronCache = null;
let _cauldronCacheAt = 0;
let _inputsCache = null;
let _inputsCacheAt = 0;
const CACHE_TTL_MS = 30 * 1000; // 30s

export function invalidateCauldronCache() {
  _cauldronCache = null;
  _cauldronCacheAt = 0;
}

// ─── Chargement du chaudron du joueur ────────────────────────────────────
/**
 * Charge le chaudron du joueur (avec cache court).
 * Retourne null si le joueur n'a pas encore de chaudron.
 */
export async function loadMyCauldron(playerEmail, force = false) {
  const now = Date.now();
  if (!force && _cauldronCache?.player_email === playerEmail && (now - _cauldronCacheAt) < CACHE_TTL_MS) {
    return _cauldronCache;
  }

  try {
    const list = await base44.entities.MagicCauldron.filter({
      player_email: playerEmail,
    });
    _cauldronCache = list[0] || null;
    _cauldronCacheAt = now;
  } catch (e) {
    console.warn("[Cauldron] load failed:", e);
    _cauldronCache = null;
  }
  return _cauldronCache;
}

// ─── Chargement des inputs du jour ───────────────────────────────────────
/**
 * Charge les inputs du chaudron pour aujourd'hui (avec cache).
 * Retourne null si pas encore générés.
 */
export async function loadDailyInputs(force = false) {
  const todayStr = new Date().toISOString().split("T")[0];
  const now = Date.now();
  if (!force && _inputsCache?.cycle_date === todayStr && (now - _inputsCacheAt) < CACHE_TTL_MS) {
    return _inputsCache;
  }

  try {
    const list = await base44.entities.CauldronDailyInputs.filter({
      cycle_date: todayStr,
    });
    _inputsCache = list[0] || null;
    _inputsCacheAt = now;
  } catch (e) {
    console.warn("[Cauldron] inputs load failed:", e);
    _inputsCache = null;
  }
  return _inputsCache;
}

/**
 * Renvoie les inputs requis pour un rang donné, depuis le record du jour.
 */
export function getInputsForRank(dailyInputs, rank) {
  if (!dailyInputs) return [];
  const arr = dailyInputs[`inputs_rank${rank}`] || [];
  return Array.isArray(arr) ? arr : [];
}

// ─── Vérification : a-t-il déjà utilisé son chaudron aujourd'hui ? ───────
/**
 * Renvoie un objet { 1: bool, 2: bool, 3: bool } indiquant pour chaque rang
 * si le joueur l'a déjà utilisé aujourd'hui.
 *
 * Le joueur peut désormais utiliser une recette par rang et par jour
 * (ex: à rang 3, il peut cuisiner une recette rang 1, une rang 2 ET une rang 3
 * sur la même journée).
 */
export async function hasUsedCauldronToday(playerEmail) {
  const todayStr = new Date().toISOString().split("T")[0];
  const result = { 1: false, 2: false, 3: false };
  try {
    const list = await base44.entities.CauldronUses.filter({
      player_email: playerEmail,
      cycle_date: todayStr,
    });
    for (const use of list) {
      const r = Number(use.rank_used) || 1;
      if (r >= 1 && r <= 3) result[r] = true;
    }
    return result;
  } catch (e) {
    console.warn("[Cauldron] hasUsedToday failed:", e);
    return result;
  }
}

// ─── Tirage de l'output ──────────────────────────────────────────────────
/**
 * Tire un output au hasard selon le rang du chaudron et les pondérations
 * de tier définies dans TIER_DISTRIBUTION.
 *
 * Renvoie la clé de l'item gagné (ex: "trefle_chance", "etoile_filante").
 */
export function rollOutput(rank) {
  const distribution = TIER_DISTRIBUTION[rank] || TIER_DISTRIBUTION[1];

  // 1. On choisit le tier selon les probas
  const r = Math.random();
  let pickedTier = 1;
  let cumul = 0;
  for (const tier of [1, 2, 3]) {
    cumul += distribution[tier] || 0;
    if (r <= cumul) {
      pickedTier = tier;
      break;
    }
  }

  // 2. On filtre les outputs du tier choisi
  const candidates = CAULDRON_OUTPUTS.filter(o => o.tier === pickedTier);
  if (candidates.length === 0) {
    // Fallback (ne devrait jamais arriver)
    return CAULDRON_OUTPUTS[0].key;
  }

  // 3. Tirage uniforme dans les candidats du tier
  const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
  let pick = Math.random() * totalWeight;
  for (const c of candidates) {
    pick -= c.weight;
    if (pick <= 0) return c.key;
  }
  return candidates[0].key;
}

// ─── Valeur en or virtuel d'un item (pour nourrir le chaudron) ───────────
/**
 * Calcule la valeur en or virtuel d'un item (utilisé pour le système
 * de nourrissage du chaudron). Réutilise le helper de la statue royale.
 */
export function computeFeedValue(itemKey, qty, dynamicPrices) {
  return getDonationValue(itemKey, qty, dynamicPrices);
}

// ─── Vérification du dôme de protection ──────────────────────────────────
/**
 * Vérifie si une ville est protégée par un dôme actif (talisman).
 * Renvoie { protected: bool, expiresAt: Date | null }
 */
export async function isCityProtected(cityId) {
  if (!cityId) return { protected: false, expiresAt: null };

  try {
    const list = await base44.entities.ProtectionDome.filter({
      city_id: cityId,
      status: "active",
    });

    const now = new Date();
    for (const d of list) {
      const exp = new Date(d.expires_at);
      if (exp > now) {
        return { protected: true, expiresAt: exp };
      }
    }
    return { protected: false, expiresAt: null };
  } catch (e) {
    console.warn("[Cauldron] dome check failed:", e);
    return { protected: false, expiresAt: null };
  }
}

// ─── Renvoie le prochain seuil d'évolution ───────────────────────────────
/**
 * Renvoie le seuil d'or virtuel à atteindre pour passer au rang suivant.
 * Renvoie 0 si le chaudron est au rang max.
 */
export function getNextRankThreshold(currentRank) {
  if (currentRank >= 3) return 0;
  return CAULDRON_RANK_THRESHOLDS[currentRank + 1] || 0;
}
