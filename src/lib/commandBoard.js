// src/lib/commandBoard.js
//
// Helpers client pour la Bourse aux contrats (CommandBoard).
// Encapsule les appels aux endpoints serveur /api/commandboard/*
// et les requêtes lecture sur la collection command_contract.
//
// IMPORTANT : aucune mutation directe via base44.entities.CommandContract.
// PocketBase refuse les écritures côté client (createRule/updateRule = null),
// tout DOIT passer par les routes serveur.

import { pb, base44 } from "@/api/base44Client";


// ─────────────────────────────────────────────────────────────────────────────
// WHITELIST CLIENT (mirror de TRADABLE_ITEMS dans command_contract.pb.js)
// ─────────────────────────────────────────────────────────────────────────────
// On la duplique côté client pour le formulaire de pose et la validation
// upfront. La validation autoritaire reste serveur.
// ⚠️ À synchroniser avec le hook si on ajoute des items.
export const TRADABLE_ITEMS = {
  // ─── T1 ───
  bois_brut:        { name: 'Bois brut',           icon: '🪵', category: 'bois',         tier: 1 },
  minerai_fer:      { name: 'Minerai de fer',      icon: '🪨', category: 'fer',          tier: 1 },
  ble:              { name: 'Blé',                 icon: '🌾', category: 'nourriture',   tier: 1 },
  laine_brute:      { name: 'Laine brute',         icon: '🧶', category: 'tissu',        tier: 1 },
  herbes:           { name: 'Herbes',              icon: '🌿', category: 'potions',      tier: 1 },
  quartz_brut:      { name: 'Quartz brut',         icon: '🔮', category: 'or',           tier: 1 },
  pierre:           { name: 'Pierre',              icon: '🧱', category: 'pierre',       tier: 1 },
  jeton_guilde:     { name: 'Jeton de la guilde',  icon: '🪙', category: 'jetons',       tier: 1 },
  billet_fortune:   { name: 'Billet de fortune',   icon: '🎫', category: 'parchemins',   tier: 1 },

  // ─── T2 ───
  planches:               { name: 'Planches',                icon: '🪵', category: 'bois',       tier: 2 },
  pierre_brute:           { name: 'Pierre taillée',          icon: '🗿', category: 'pierre',     tier: 2 },
  fil:                    { name: 'Fil',                     icon: '🧵', category: 'tissu',      tier: 2 },
  charbon:                { name: 'Charbon',                 icon: '⚫', category: 'fer',        tier: 2 },
  extrait:                { name: 'Extrait',                 icon: '🫗', category: 'potions',    tier: 2 },
  cataplasme:             { name: 'Cataplasme',              icon: '🩹', category: 'potions',    tier: 2 },
  quartz_poli:            { name: 'Quartz poli',             icon: '💠', category: 'or',         tier: 2 },
  encre:                  { name: 'Encre',                   icon: '🖋️', category: 'parchemins', tier: 2 },
  farine:                 { name: 'Farine',                  icon: '🧺', category: 'nourriture', tier: 2 },
  pierre_aiguiser:        { name: 'Pierre à aiguiser',       icon: '🪊', category: 'pierre',     tier: 2 },
  reparation_universelle: { name: 'Réparation universelle',  icon: '🔩', category: 'outils',     tier: 2 },

  // ─── T3 ───
  meuble:           { name: 'Meuble',           icon: '🪑', category: 'bois',       tier: 3 },
  lingots_fer:      { name: 'Lingots de fer',   icon: '🔩', category: 'fer',        tier: 3 },
  tissu:            { name: 'Tissu',            icon: '🪡', category: 'tissu',      tier: 3 },
  potion_soin:      { name: 'Potion de soin',   icon: '🧪', category: 'potions',    tier: 3 },
  lingots_or:       { name: "Lingot d'or",      icon: '🪙', category: 'or',         tier: 3 },
  parchemin:        { name: 'Parchemin',        icon: '📜', category: 'parchemins', tier: 3 },
  pain:             { name: 'Pain',             icon: '🍞', category: 'nourriture', tier: 3 },
  contrat_artisan:  { name: 'Contrat artisan',  icon: '📋', category: 'parchemins', tier: 3 },
  etai_recolte:     { name: 'Étai de récolte',  icon: '🪵', category: 'bois',       tier: 3 },
  marteau_armurier: { name: "Marteau d'armurier", icon: '🔨', category: 'fer',      tier: 3 },
};


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES — alignées avec le hook serveur
// ─────────────────────────────────────────────────────────────────────────────
export const CMD_LIMITS = {
  MAX_ACTIVE_PER_PLAYER: 5,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 50,
  MIN_REWARD_GOLD: 10,
  MAX_REWARD_GOLD: 10000,
  MAX_NOTE_LENGTH: 100,
  // 19/05/2026 : taxe désormais dynamique selon city.tax_rate. Fallback 10%
  // si la ville n'a pas de tax_rate défini. La constante ci-dessous n'est plus
  // utilisée par computeContractTax (signature changée). Conservée pour info.
  DEFAULT_TAX_PCT: 10,
  DURATION_DAYS: 3,
};

/**
 * Calcule la taxe exacte du contrat (mirror serveur : round(reward * tax_pct/100)).
 * @param {number} rewardGold — récompense au livreur en or
 * @param {number} taxPct     — taux de taxe en pourcentage (ex: 10 pour 10%)
 * @returns {number} taxe arrondie au plus proche
 */
export function computeContractTax(rewardGold, taxPct = CMD_LIMITS.DEFAULT_TAX_PCT) {
  const r = Math.max(0, Math.floor(Number(rewardGold) || 0));
  const pct = Math.max(0, Math.min(100, Number(taxPct) || 0));
  return Math.round(r * (pct / 100));
}

/**
 * Coût total à débourser pour poser un contrat dans une ville à taxPct%.
 */
export function computeContractTotalCost(rewardGold, taxPct = CMD_LIMITS.DEFAULT_TAX_PCT) {
  const r = Math.max(0, Math.floor(Number(rewardGold) || 0));
  return r + computeContractTax(r, taxPct);
}


// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINTS SERVEUR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/commandboard/post — crée un nouveau contrat.
 * Le serveur valide tout (gold, qty, item whitelisté, limites) et débite
 * le poseur de (reward + taxe).
 *
 * @param {object} params
 * @param {string} params.itemKey
 * @param {number} params.quantity   (1-50)
 * @param {number} params.rewardGold (10-10000)
 * @param {string} [params.note]
 * @returns {Promise<{ok: boolean, contract_id: string, gold_spent: number, breakdown: {reward,tax}, expires_at: string}>}
 * @throws Error avec message lisible si l'API rejette
 */
export async function postContract({ itemKey, quantity, rewardGold, note }) {
  try {
    const res = await pb.send('/api/commandboard/post', {
      method: 'POST',
      body: JSON.stringify({
        item_key: itemKey,
        quantity: quantity,
        reward_gold: rewardGold,
        note: note || '',
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    return res;
  } catch (err) {
    // PB renvoie l'erreur du hook dans err.response.data
    const data = err?.response?.data;
    const msg = data?.error || data?.message || err?.message || 'Erreur inconnue';
    throw new Error(msg);
  }
}

/**
 * POST /api/commandboard/deliver — livre un contrat.
 * Le serveur valide l'inventaire, lock le contrat, transfère items + or.
 *
 * @param {string} contractId
 * @returns {Promise<{ok: boolean, gold_received: number, items_delivered: number}>}
 */
export async function deliverContract(contractId) {
  try {
    const res = await pb.send('/api/commandboard/deliver', {
      method: 'POST',
      body: JSON.stringify({ contract_id: contractId }),
      headers: { 'Content-Type': 'application/json' },
    });
    return res;
  } catch (err) {
    const data = err?.response?.data;
    const msg = data?.error || data?.message || err?.message || 'Erreur inconnue';
    throw new Error(msg);
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// LECTURE — utilise base44.entities.CommandContract (wrapper PB v0.23-safe)
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ NE PAS UTILISER pb.collection('command_contract').getList() : le SDK
// PocketBase ajoute skipTotal=1, incompatible avec PB v0.23 → 400 Bad Request.
// Le wrapper base44Client.js fait un fetch direct sans skipTotal.

/**
 * Liste les contrats actifs sur le royaume.
 * Trié du plus récent au plus ancien.
 */
export async function fetchActiveContracts() {
  try {
    return await base44.entities.CommandContract.filter(
      { status: 'active' },
      '-created',
      100
    );
  } catch (err) {
    console.warn('[commandBoard] fetchActive error:', err);
    return [];
  }
}

/**
 * Liste les contrats du joueur (actifs + delivered + expired récents).
 * @param {string} email
 */
export async function fetchMyContracts(email) {
  if (!email) return [];
  try {
    return await base44.entities.CommandContract.filter(
      { poster_email: email },
      '-created',
      100
    );
  } catch (err) {
    console.warn('[commandBoard] fetchMyContracts error:', err);
    return [];
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// PRIX MOYEN MARCHÉ 7 JOURS (pour aider à calibrer le formulaire)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Index inversé : item_name (FR) → item_key. Construit une seule fois au load.
 * Permet de matcher les rows trade_history qui n'ont pas de champ item_key
 * (schéma actuel : seulement item_name + item_category).
 */
const NAME_TO_KEY = (() => {
  const idx = {};
  for (const [k, v] of Object.entries(TRADABLE_ITEMS)) {
    idx[v.name] = k;
  }
  return idx;
})();

/**
 * Renvoie un dict { item_key: { avg, count, min, max } } basé sur les ventes
 * des 7 derniers jours dans trade_history. Cache mémoire 5 min pour limiter
 * les requêtes (l'historique change peu).
 *
 * Match : on essaie row.item_key d'abord (au cas où la colonne soit ajoutée
 * plus tard), puis on tombe sur l'index NAME_TO_KEY via row.item_name.
 *
 * En cas d'erreur réseau / pas de données, renvoie {}.
 */
let _avgCache = null;
let _avgCacheAt = 0;
const AVG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

export async function fetchMarketAverages7d() {
  const now = Date.now();
  if (_avgCache && (now - _avgCacheAt) < AVG_CACHE_TTL_MS) {
    return _avgCache;
  }

  try {
    // Date limite : 7 jours dans le passé
    const since = new Date(now - 7 * 86400000).toISOString();

    // base44.entities.TradeHistory.filter renvoie un tableau d'objets
    // (cf pattern dans MarketInsights.jsx). On filtre côté client par created.
    const all = await base44.entities.TradeHistory.filter({}, '-created_date', 500);

    const acc = {};
    for (const row of all) {
      // Date : champ created (format "YYYY-MM-DD HH:mm:ss.sssZ" en BDD, le
      // wrapper renvoie created_date). On compare en string ISO (chronologique).
      const createdStr = row.created_date || row.created;
      if (!createdStr) continue;

      // Conversion pour comparaison fiable
      const t = new Date(createdStr).getTime();
      if (!t || isNaN(t)) continue;
      if (t < (now - 7 * 86400000)) continue;

      // Résoudre item_key : champ direct ou fallback via item_name
      const realKey = row.item_key || NAME_TO_KEY[row.item_name];
      if (!realKey) continue;
      if (!TRADABLE_ITEMS[realKey]) continue;  // ignore items non échangeables

      const price = Number(row.price_per_unit) || 0;
      if (price <= 0) continue;

      if (!acc[realKey]) {
        acc[realKey] = { sum: 0, count: 0, min: Infinity, max: 0 };
      }
      acc[realKey].sum += price;
      acc[realKey].count += 1;
      if (price < acc[realKey].min) acc[realKey].min = price;
      if (price > acc[realKey].max) acc[realKey].max = price;
    }

    const result = {};
    for (const [k, v] of Object.entries(acc)) {
      result[k] = {
        avg: Math.round(v.sum / v.count),
        count: v.count,
        min: v.min === Infinity ? 0 : v.min,
        max: v.max,
      };
    }

    _avgCache = result;
    _avgCacheAt = now;
    return result;
  } catch (err) {
    console.warn('[commandBoard] fetchMarketAverages7d error:', err);
    return {};
  }
}

/**
 * Reset cache manuellement (utile après pose ou livraison).
 */
export function invalidateAveragesCache() {
  _avgCache = null;
  _avgCacheAt = 0;
}


// ─────────────────────────────────────────────────────────────────────────────
// UTILS UI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renvoie un texte type "Expire dans 2j 14h" / "Expire dans 5h" / "Expiré".
 * @param {string} expiresAtIso
 */
export function formatTimeLeft(expiresAtIso) {
  if (!expiresAtIso) return '';
  const exp = new Date(expiresAtIso).getTime();
  if (!exp || isNaN(exp)) return '';
  const now = Date.now();
  const diff = exp - now;
  if (diff <= 0) return 'Expiré';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Tri par profession utile : si le joueur est Marchand, les contrats parchemin/encre
 * d'abord. On expose une simple fonction de scoring.
 *
 * @param {object} contract
 * @param {string} playerProfession
 * @returns {number} plus haut = plus pertinent
 */
export function scoreContractForPlayer(contract, playerProfession) {
  let score = 0;
  const itemDef = TRADABLE_ITEMS[contract.item_key];
  if (!itemDef) return 0;

  // Items de la profession du joueur en priorité
  if (playerProfession === 'Marchand' && itemDef.category === 'parchemins') score += 100;
  if (playerProfession === 'Bûcheron'  && itemDef.category === 'bois') score += 100;
  if (playerProfession === 'Mineur'    && (itemDef.category === 'fer' || itemDef.category === 'pierre')) score += 100;
  if (playerProfession === 'Fermier'   && itemDef.category === 'nourriture') score += 100;
  if (playerProfession === 'Tisserand' && itemDef.category === 'tissu') score += 100;
  if (playerProfession === 'Alchimiste'&& itemDef.category === 'potions') score += 100;
  if (playerProfession === 'Orfèvre'   && itemDef.category === 'or') score += 100;
  if (playerProfession === 'Forgeron'  && (itemDef.category === 'fer' || itemDef.category === 'armes_combat')) score += 100;

  // Bonus or/qty (favorise les contrats plus juteux)
  score += Number(contract.reward_gold) || 0;

  return score;
}
