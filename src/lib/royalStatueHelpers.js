/**
 * royalStatueHelpers.js : helpers frontend pour la statue royale.
 *
 * Côté client, on lit la statue active (status="active") et on expose
 * des helpers pour savoir si elle est dans une ville donnée et quels
 * paliers de bonus sont actifs.
 */
import { base44 } from "@/api/base44Client";

let _cache = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Charge la statue active (avec cache court).
 * Retourne null si aucune statue active.
 */
export async function loadActiveStatue(force = false) {
  const now = Date.now();
  if (!force && _cache && (now - _cacheAt) < CACHE_TTL_MS) return _cache;

  try {
    const list = await base44.entities.RoyalStatue.filter({ status: "active" });
    _cache = list[0] || null;
    _cacheAt = now;
  } catch (e) {
    console.warn("[RoyalStatue] load failed:", e);
    _cache = null;
  }
  return _cache;
}

/**
 * Invalide le cache après une offrande pour forcer le reload.
 */
export function invalidateStatueCache() {
  _cache = null;
  _cacheAt = 0;
}

/**
 * Renvoie true si la statue est actuellement dans la ville donnée.
 */
export function isStatueInCity(statue, cityId) {
  if (!statue || !cityId) return false;
  return statue.current_city_id === cityId;
}

/**
 * Renvoie le palier actif (0 à 5) selon le cumul actuel et les seuils.
 */
export function getActiveTier(statue) {
  if (!statue) return 0;
  return statue.bonus_tier_active || 0;
}

/**
 * Renvoie un objet { palier1: bool, palier2: bool, ..., palier5: bool }
 * pour tester rapidement quels bonus sont actifs.
 */
export function getActiveBonuses(statue) {
  const tier = getActiveTier(statue);
  return {
    palier1: tier >= 1,
    palier2: tier >= 2,
    palier3: tier >= 3,
    palier4: tier >= 4,
    palier5: tier >= 5,
  };
}

/**
 * Calcule la valeur en or virtuel d'un item selon les prix dynamiques.
 * Utilisé pour calculer combien un don ajoute à la statue.
 *
 * @param {string} itemKey - clé de l'item (ex: "bois_brut")
 * @param {number} quantity
 * @param {Object} dynamicPrices - résultat de calculateDynamicPrices()
 * @returns {number} valeur totale en or virtuel
 */
export function getDonationValue(itemKey, quantity, dynamicPrices) {
  if (!itemKey || !quantity || quantity <= 0) return 0;
  if (!dynamicPrices) return 0;

  // Cherche l'item dans les tiers 1 à 4 (T5 exclu pour les offrandes)
  for (const tier of [1, 2, 3, 4]) {
    const tierPrices = dynamicPrices[`tier${tier}`] || dynamicPrices[tier] || {};
    if (tierPrices[itemKey]) {
      const price = tierPrices[itemKey];
      // Le prix peut être un objet {min, max} ou un nombre direct
      const value = typeof price === "object" ? (price.min + price.max) / 2 : price;
      return Math.floor(value * quantity);
    }
  }
  return 0;
}

/**
 * Renvoie la contribution actuelle du joueur pour le cycle en cours.
 */
export async function getMyContribution(cycleNumber, playerEmail) {
  try {
    const list = await base44.entities.StatueContribution.filter({
      cycle_number: cycleNumber,
      player_email: playerEmail,
    });
    return list[0] || null;
  } catch (e) {
    console.warn("[RoyalStatue] getMyContribution failed:", e);
    return null;
  }
}

/**
 * Renvoie toutes les contributions du cycle (pour calculer le rang du joueur).
 */
export async function getAllContributions(cycleNumber) {
  try {
    return await base44.entities.StatueContribution.filter({
      cycle_number: cycleNumber,
    });
  } catch (e) {
    console.warn("[RoyalStatue] getAllContributions failed:", e);
    return [];
  }
}

/**
 * Calcule combien il manque au joueur pour entrer dans le Top 3.
 * Renvoie un objet { rank, gap, isInTop3 }.
 *   - rank : position actuelle du joueur (1-indexed), null si pas contribué
 *   - gap : nombre d'or virtuels nécessaires pour entrer dans le Top 3
 *   - isInTop3 : true si le joueur est déjà dans le Top 3
 */
export function computeTop3Gap(allContributions, myEmail) {
  const sorted = [...allContributions].sort(
    (a, b) => (b.total_value || 0) - (a.total_value || 0)
  );
  const myIdx = sorted.findIndex(c => c.player_email === myEmail);
  const myValue = myIdx >= 0 ? (sorted[myIdx].total_value || 0) : 0;

  if (myIdx >= 0 && myIdx < 3) {
    return { rank: myIdx + 1, gap: 0, isInTop3: true };
  }

  const top3Threshold = sorted[2]?.total_value || 0;
  const gap = Math.max(0, top3Threshold - myValue + 1);
  return {
    rank: myIdx >= 0 ? myIdx + 1 : null,
    gap,
    isInTop3: false,
  };
}
