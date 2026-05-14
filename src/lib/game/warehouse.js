// ═══════════════════════════════════════════════════════════════════════════
// warehouse.js — Prix de rachat entrepôt (reset quotidien) et cap de vente
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  MIROIR SERVEUR : WAREHOUSE_BUYBACK_PRICES et generateWarehouseBuybackPrices
// sont utilisés par le cron quotidien serveur pour fixer les prix du jour.

// ── Prix de rachat de l'entrepôt (reset quotidien) ──
export const WAREHOUSE_BUYBACK_PRICES = {
  bois_brut:    { min: 1, max: 3,  label: "Bois brut",    icon: "🪵" },
  pierre:       { min: 1, max: 3,  label: "Pierre",       icon: "🪨" },
  pierre_brute: { min: 1, max: 3,  label: "Pierre taillée", icon: "🗿" },
  minerai_fer:  { min: 2, max: 5,  label: "Minerai de fer", icon: "🪨" },
  ble:          { min: 1, max: 3,  label: "Blé",           icon: "🌾" },
  laine_brute:  { min: 1, max: 4,  label: "Laine brute",  icon: "🧶" },
  herbes:       { min: 1, max: 4,  label: "Herbes",        icon: "🌿" },
  quartz_brut:  { min: 2, max: 6,  label: "Quartz brut",  icon: "🔮" },
  lingots_or:   { min: 5, max: 15, label: "Lingot d'or",  icon: "🏅" },
};

export const WAREHOUSE_DAILY_SELL_CAP = 20;

export function generateWarehouseBuybackPrices() {
  const prices = {};
  for (const [key, def] of Object.entries(WAREHOUSE_BUYBACK_PRICES)) {
    const mid = Math.floor((def.min + def.max) / 2);
    prices[key] = def.min + Math.floor(Math.random() * (mid - def.min + 1));
  }
  return prices;
}
