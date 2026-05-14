// ═══════════════════════════════════════════════════════════════════════════
// taxes.js — Taxes ville, taxes joueur, parchemin royal, sceau, coûts tier
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  MIROIR SERVEUR : PARCHEMIN_REWARDS et generateDailyTax* sont utilisés
// par le cron quotidien serveur. Toute modification doit être répercutée
// sur /opt/guildes/server_reset_v2/lib/gameData.js.

export function generateDailyTax() {
  const rates = [5, 8, 10, 12, 15, 18, 20];
  return rates[Math.floor(Math.random() * rates.length)];
}

export function generateDailyTaxPerPlayer() {
  const amounts = [0, 5, 5, 5, 10, 10, 15, 20, 25, 30];
  return amounts[Math.floor(Math.random() * amounts.length)];
}

// ── Récompenses parchemins d'objectifs (calibrées anti-inflation) ──
export const PARCHEMIN_REWARDS = {
  contrat_artisan:  80,  // était 110, réduit pour équilibre économique
  // contrat_noble : récompense dynamique (voir Production.jsx CONTRAT_NOBLE_REWARD)
};

export const SCEAU_PRICE = 100;   // or détruit à l'achat
export const SCEAU_VALUE = 110;   // valeur absorbée en taxes/impôts

// Coût d'action total par tier (refonte avril 2026 : un seul nombre, prélevé aléatoirement
// sur faim ou énergie via applyRandomActionCost). Ancienne forme : { hunger, fatigue } sur chaque.
export const TIER_ACTION_COST = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
};
