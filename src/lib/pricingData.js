// ═══════════════════════════════════════════════════════════════════════════
// pricingData.js : Système de pricing DYNAMIQUE basé sur recettes
// ═══════════════════════════════════════════════════════════════════════════
// PRINCIPES :
// • T1 : prix fixes (référence marché)
// • T2 : moyenne(prix T1 des ingrédients) × facteur effort
// • T3-T5 : progression multiplicatrice depuis T2
// ═══════════════════════════════════════════════════════════════════════════

// ── PRIX CONSEILLÉS T1 (références pour nouvelles ventes) ──
// Fourchettes calibrées selon la DEMANDE relative dans le jeu :
//   • laine_brute : #1 craft (25% des inputs cumulés) + répare 4 armures
//   • pierre      : peu en craft mais ultra-demandée pour bâtiments + répare arme/bouclier
//   • minerai_fer : craft + upgrades combat (200/200/60 par upgrade haut grade)
//   • bois_brut   : bâtiments + craft + upgrades
//   • quartz_brut : upgrades combat (matière "rare" mais peu d'usages alternatifs)
//   • herbes      : surtout alimentaire (récolte rapide en biome)
//   • ble         : nourriture de base (le plus disponible)
export const SUGGESTED_PRICES_T1 = {
  laine_brute:  { min: 2, max: 7 },  // demande la plus large (craft + répa armures)
  pierre:       { min: 2, max: 7 },  // bâtiments + répa arme/bouclier
  minerai_fer:  { min: 2, max: 6 },  // craft + upgrades combat
  bois_brut:    { min: 2, max: 6 },  // bâtiments + craft + upgrades
  quartz_brut:  { min: 2, max: 6 },  // upgrades combat haut grade
  herbes:       { min: 1, max: 5 },  // alimentaire (récolte rapide)
  ble:          { min: 1, max: 4 },  // nourriture de base, le plus disponible
};

// ── PRIX SPÉCIAUX (items non-craftés, parchemins fixes) ──
// REFONTE MARCHAND v2 (10/05/2026) : autorisation_marche supprimée.
// billet_fortune : prix forcé à 3 or côté UI ET côté logique d'achat marché
// (cf. pages/Market.jsx). La fourchette ci-dessous n'est qu'indicative.
export const SUGGESTED_PRICES_SPECIAL = {
  billet_fortune:      { min: 3, max: 3 },
  contrat_artisan:     { min: 55, max: 80  },
};

/**
 * Obtient le prix T1 moyen (réel ou suggéré)
 * @param {string} itemKey - Clé de l'item
 * @param {number} realPrice - Prix réel du marché (optionnel)
 * @returns {number} Prix moyen
 */
export function getT1Price(itemKey, realPrice) {
  if (realPrice) return realPrice;
  const suggested = SUGGESTED_PRICES_T1[itemKey];
  return suggested ? (suggested.min + suggested.max) / 2 : 3;
}

/**
 * Calcule le multiplicateur économique basé sur l'or moyen par joueur
 * @param {number} orMoyen - Or moyen par joueur
 * @returns {number} Multiplicateur (0.8 à 2.0)
 */
export function getPriceMultiplier(orMoyen) {
  if (!orMoyen || orMoyen < 200) return 0.8;
  if (orMoyen < 500)  return 1.0;
  if (orMoyen < 1000) return 1.2;
  if (orMoyen < 2000) return 1.5;
  return 2.0;
}

/**
 * Crée une fourchette de prix (min/max) depuis un prix de base
 * @param {number} basePrice - Prix de base calculé
 * @param {number} costGold - Coût en or de la recette
 * @returns {Object} { min, max }
 */
function createPriceRange(basePrice, costGold = 0) {
  const withCost = basePrice + costGold;
  return {
    min: Math.max(Math.round(withCost * 0.9), 1),
    max: Math.round(withCost * 1.2)
  };
}

/**
 * Échantillonne des joueurs actifs et des listings T1
 * Réduit les API calls pour le calcul économique à grande échelle
 * 
 * @param {Array} players - Tous les joueurs
 * @param {Array} listings - Toutes les listings actives
 * @returns {Object} { sampledPlayers, sampledListings, sampleSize, listingsByCategory }
 */
export function sampleEconomyData(players = [], listings = []) {
  // Panel de 100 joueurs actifs max (ou moins si moins de 100 joueurs)
  const PANEL_SIZE = 100;
  
  // Filtrer joueurs actifs : last_active_at dans les 7 derniers jours
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const activePlayers = players.filter(p => 
    p.last_active_at && new Date(p.last_active_at) >= sevenDaysAgo
  );
  
  // Si moins de PANEL_SIZE joueurs actifs, on prend tous les actifs
  const targetSize = Math.min(PANEL_SIZE, activePlayers.length);
  const sampledPlayers = [];
  
  if (targetSize >= activePlayers.length) {
    sampledPlayers.push(...activePlayers);
  } else {
    // Fisher-Yates shuffle et prendre les N premiers
    const shuffled = [...activePlayers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    sampledPlayers.push(...shuffled.slice(0, targetSize));
  }
  
  // Grouper listings T1 par catégorie et en prendre 10 au hasard chacun
  const listingsByCategory = {};
  const LISTINGS_PER_CATEGORY = 10;
  
  Object.keys(SUGGESTED_PRICES_T1).forEach(itemKey => {
    const listingsForItem = listings.filter(l => 
      l.status === 'active' && l.item_key === itemKey && l.item_tier === 1
    );
    
    if (listingsForItem.length > 0) {
      // Prendre min(10, all) listings
      const sampleCount = Math.min(LISTINGS_PER_CATEGORY, listingsForItem.length);
      const sampled = [];
      
      if (sampleCount >= listingsForItem.length) {
        sampled.push(...listingsForItem);
      } else {
        const shuffled = [...listingsForItem];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        sampled.push(...shuffled.slice(0, sampleCount));
      }
      
      listingsByCategory[itemKey] = sampled;
    }
  });
  
  return {
    sampledPlayers,
    sampleSize: sampledPlayers.length,
    listingsByCategory,
  };
}

/**
 * NOUVEL ALGO : Calcule les prix T2-T5 DYNAMIQUEMENT
 * Basé sur les recettes actuelles et les prix T1 réels du marché
 * 
 * @param {Array} listings - Annonces MarketListing actives
 * @param {Array} recipes - Recettes CRAFTING_RECIPES (avec ingrédients T1/T2/T3/T4)
 * @returns {Object} { tier2: {...}, tier3: {...}, tier4: {...}, tier5: {...} }
 */
export function calculateDynamicPrices(listings = [], recipes = []) {
  // === ÉTAPE 1 : Construire base de prix réels T1 ===
  const t1RealPrices = {};
  SUGGESTED_PRICES_T1 && Object.keys(SUGGESTED_PRICES_T1).forEach(key => {
    const listingsForKey = listings.filter(l => l.item_key === key);
    if (listingsForKey.length > 0) {
      const sum = listingsForKey.reduce((s, l) => s + l.price_per_unit, 0);
      t1RealPrices[key] = Math.round(sum / listingsForKey.length);
    }
  });

  // === ÉTAPE 2 : Index tous les items/prix par tier ===
  const pricesByTier = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };
  
  // Peupler T1 avec prix réels ou suggérés
  Object.entries(SUGGESTED_PRICES_T1).forEach(([key, suggested]) => {
    pricesByTier[1][key] = t1RealPrices[key] || (suggested.min + suggested.max) / 2;
  });

  // === ÉTAPE 3 : Calculer T2-T5 récursivement ===
  recipes.forEach(recipe => {
    if (!recipe.output || !recipe.output.key) return;

    const { output, inputs, tier, costGold = 0 } = recipe;

    // Calculer prix moyen des ingrédients (formule MOYENNE, pas SOMME)
    // Rationnel : un T2 vaut "le tier d'un input moyen", peu importe combien il en faut.
    // La SOMME compounderait à chaque tier et ferait exploser le T5 (cf. simulations).
    let ingredientSum = 0;
    if (inputs && inputs.length > 0) {
      ingredientSum = inputs.reduce((sum, ing) => {
        const ingPrice = pricesByTier[tier - 1] ? pricesByTier[tier - 1][ing.key] : 5;
        return sum + (ingPrice || 5);
      }, 0);
    }
    const avgIngredientPrice = inputs.length > 0 ? ingredientSum / inputs.length : 5;

    // Markup progressif par tier (rétrocompense l'investissement temps + matière)
    const tieredMultiplier = {
      2: 2,  // T2 = ×2
      3: 3,  // T3 = ×3
      4: 4,  // T4 = ×4
      5: 5,  // T5 = ×5
    };

    // Taxe marché de 20% appliquée systématiquement (le crafteur doit la couvrir
    // pour ne pas vendre à perte après commission marché).
    const TAX_MARKET = 1.2;

    const finalPrice = Math.round(
      avgIngredientPrice * (tieredMultiplier[tier] || 1.0) * TAX_MARKET + costGold
    );
    pricesByTier[tier][output.key] = finalPrice;
  });

  // === ÉTAPE 4 : Retourner fourchettes (min/max) ===
  // Sprint 2C fix : on inclut aussi tier1 (T1 de base) pour que les valorisations
  // (ex: dons à la statue royale) puissent calculer la valeur des ressources brutes.
  const result = { tier1: {}, tier2: {}, tier3: {}, tier4: {}, tier5: {} };

  // T1 : on retourne les prix tels quels (déjà calculés depuis SUGGESTED_PRICES_T1)
  Object.entries(pricesByTier[1]).forEach(([itemKey, basePrice]) => {
    result.tier1[itemKey] = createPriceRange(basePrice, 0);
  });

  [2, 3, 4, 5].forEach(tier => {
    Object.entries(pricesByTier[tier]).forEach(([itemKey, basePrice]) => {
      result[`tier${tier}`][itemKey] = createPriceRange(basePrice, 0);
    });
  });

  return result;
}

/**
 * Helper : obtient la fourchette de prix conseillée pour un item
 * @param {string} itemKey - Clé de l'item
 * @param {number} tier - Tier (1-5)
 * @returns {Object|null} { min, max } ou null si non trouvé
 */
export function getSuggestedPrice(itemKey, tier) {
  if (tier === 1) {
    return SUGGESTED_PRICES_T1[itemKey] || null;
  }
  if (SUGGESTED_PRICES_SPECIAL[itemKey]) {
    return SUGGESTED_PRICES_SPECIAL[itemKey];
  }
  return null;
}
// ═══════════════════════════════════════════════════════════════════════════
// FLATTENING RÉCURSIF DES RECETTES (11/05/2026)
// ═══════════════════════════════════════════════════════════════════════════
// Pour la Couronne en bronze : calcule combien de chaque T1 est cumulé dans
// la chaîne complète de fabrication, pour évaluer sa valeur de marché.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pour un itemKey donné, retourne la map { t1_key: quantity_cumulée } des T1
 * nécessaires pour fabriquer 1 unité de l'item. Parcourt récursivement les
 * inputs jusqu'à atteindre les T1 (récoltes basiques).
 *
 * @param {string} itemKey - Clé de l'item à flatten
 * @param {Array} recipePatterns - Tableau des recettes (CRAFTING_RECIPES_REFACTORED)
 * @param {Set<string>} t1Keys - Set des keys T1 (terminaux)
 * @param {number} depth - Profondeur de récursion (protection cycle)
 * @returns {Object} { t1_key: quantity, ... }
 */
export function flattenToT1(itemKey, recipePatterns, t1Keys, depth = 0) {
  if (depth > 10) return {}; // Protection cycle
  if (t1Keys.has(itemKey)) {
    return { [itemKey]: 1 };
  }
  // Trouve la recette qui produit cet item
  const recipe = recipePatterns.find(r => r.output?.key === itemKey);
  if (!recipe || !recipe.inputs) {
    return { [itemKey]: 1 }; // Item non craftable, on le compte tel quel
  }
  const outQty = recipe.output.quantity || 1;
  const cumul = {};
  for (const input of recipe.inputs) {
    const sub = flattenToT1(input.key, recipePatterns, t1Keys, depth + 1);
    for (const [k, v] of Object.entries(sub)) {
      cumul[k] = (cumul[k] || 0) + (v * input.quantity) / outQty;
    }
  }
  return cumul;
}

/**
 * Calcule la valeur de marché totale d'une map { t1_key: quantity }.
 * Pour chaque T1, multiplie sa quantité par son prix moyen de marché
 * (clampé dans [SUGGESTED_PRICES_T1.min, SUGGESTED_PRICES_T1.max]).
 *
 * @param {Object} t1Map - { t1_key: quantity_cumulée }
 * @param {Array} listings - Listings marché actifs (pour calcul prix moyen)
 * @returns {number} Valeur totale en or (arrondie)
 */
export function calculateT1MarketValue(t1Map, listings = []) {
  let total = 0;
  for (const [t1Key, qty] of Object.entries(t1Map)) {
    const range = SUGGESTED_PRICES_T1[t1Key];
    if (!range) {
      // T1 inconnu ou item non-T1 (parchemins, etc.) : on ignore
      continue;
    }
    // Prix moyen réel du marché pour ce T1
    const matching = listings.filter(l => l.item_key === t1Key && l.price_per_unit > 0);
    let price;
    if (matching.length > 0) {
      const sum = matching.reduce((s, l) => s + l.price_per_unit, 0);
      const avg = sum / matching.length;
      price = Math.max(range.min, Math.min(range.max, Math.round(avg)));
    } else {
      // Aucun listing actif : on prend le centre de la fourchette
      price = (range.min + range.max) / 2;
    }
    total += qty * price;
  }
  return Math.round(total);
}
