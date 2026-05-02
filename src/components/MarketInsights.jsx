import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ITEMS } from "../lib/craftingData";
import { ITEM_CATEGORIES } from "../lib/gameData";

// Calcule les tendances sur les 24 dernières heures vs les 24h précédentes
function computeTrends(trades) {
  const now = Date.now();
  const H24 = 24 * 3600 * 1000;
  const H48 = 48 * 3600 * 1000;

  const recent = trades.filter(t => now - new Date(t.created_date).getTime() < H24);
  const older  = trades.filter(t => {
    const age = now - new Date(t.created_date).getTime();
    return age >= H24 && age < H48;
  });

  const byItem = {};

  for (const t of [...recent, ...older]) {
    const key = t.item_key || Object.entries(ITEMS).find(([, d]) => d.name === t.item_name)?.[0] || t.item_name;
    if (!byItem[key]) byItem[key] = { name: t.item_name, key, recent: [], older: [] };
    const bucket = now - new Date(t.created_date).getTime() < H24 ? "recent" : "older";
    byItem[key][bucket].push(t);
  }

  const insights = [];
  for (const [key, data] of Object.entries(byItem)) {
    if (data.recent.length === 0) continue;

    const recentVol  = data.recent.reduce((s, t) => s + (t.quantity || 1), 0);
    const olderVol   = data.older.reduce((s,  t) => s + (t.quantity || 1), 0);
    const recentAvg  = data.recent.reduce((s, t) => s + t.price_per_unit, 0) / data.recent.length;
    const olderAvg   = data.older.length > 0
      ? data.older.reduce((s, t) => s + t.price_per_unit, 0) / data.older.length
      : recentAvg;

    const volChange  = olderVol > 0 ? ((recentVol - olderVol) / olderVol) : 1;
    const priceChange = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) : 0;

    let signal = null;
    if (recentVol >= 5 && volChange > 0.5) {
      signal = { type: "hot",  label: "Se vend bien",    icon: "🔥", color: "text-orange-600 bg-orange-50 border-orange-200" };
    } else if (recentVol >= 3 && priceChange < -0.15) {
      signal = { type: "cheap", label: "Prix en baisse",  icon: "📉", color: "text-blue-600 bg-blue-50 border-blue-200" };
    } else if (recentVol >= 3 && priceChange > 0.15) {
      signal = { type: "rising", label: "Prix en hausse", icon: "📈", color: "text-green-600 bg-green-50 border-green-200" };
    } else if (olderVol > 0 && recentVol === 0) {
      signal = { type: "slow", label: "Peu de demande",   icon: "💤", color: "text-muted-foreground bg-muted/40 border-border" };
    }

    if (signal) {
      const itemDef = ITEMS[key];
      const cat = ITEM_CATEGORIES[itemDef?.category];
      insights.push({
        key,
        name: data.name,
        icon: itemDef?.icon || cat?.icon || "📦",
        signal,
        avgPrice: Math.round(recentAvg),
        recentVol,
        priceChange,
      });
    }
  }

  // Trier : hot > rising > cheap > slow, puis par volume
  const order = { hot: 0, rising: 1, cheap: 2, slow: 3 };
  return insights
    .sort((a, b) => (order[a.signal.type] - order[b.signal.type]) || (b.recentVol - a.recentVol))
    .slice(0, 6);
}

export default function MarketInsights() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setLoading(true);
    // MARCHÉ UNIFIÉ : tendances globales sur toutes les ventes du royaume,
    // cohérent avec l'unification du marché et les prix dynamiques globaux.
    base44.entities.TradeHistory.filter({}, "-created_date", 500)
      .then(trades => {
        setInsights(computeTrends(trades));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (insights.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="font-heading font-semibold text-sm">Tendances du royaume (24h)</span>
        </div>
        <span className="text-muted-foreground text-xs">{open ? "▲ Réduire" : "▼ Voir"}</span>
      </button>

      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {insights.map(ins => (
            <div
              key={ins.key}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${ins.signal.color}`}
            >
              <span className="text-lg shrink-0">{ins.icon}</span>
              <div className="min-w-0">
                <div className="font-body text-xs font-semibold truncate">{ins.name}</div>
                <div className="font-body text-xs flex items-center gap-1">
                  <span>{ins.signal.icon} {ins.signal.label}</span>
                </div>
                <div className="font-body text-xs text-muted-foreground">
                  moy. {ins.avgPrice}💰
                  {ins.priceChange !== 0 && (
                    <span className={ins.priceChange > 0 ? "text-green-600" : "text-blue-600"}>
                      {" "}{ins.priceChange > 0 ? "+" : ""}{Math.round(ins.priceChange * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}