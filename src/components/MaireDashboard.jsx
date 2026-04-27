/**
 * MaireDashboard.jsx
 * Dashboard financier et entrepôt pour le maire de la ville.
 * Visible uniquement si isMayor === true.
 *
 * Affiche :
 *  - Trésorerie actuelle + bilan 24h (entrées / sorties / net)
 *  - Journal des transactions de la ville (GoldTransaction filtrées par city_id)
 *  - Stock entrepôt actuel par ressource avec indicateurs visuels
 *  - Résumé population : résidents, coût journalier estimé
 */

import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BUILDING_TYPES } from "@/lib/gameData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getTxLabel, CITY_IN_TYPES, CITY_OUT_TYPES, TRANSACTION_TYPES, toCityAmount } from "@/lib/transactionTypes";
import { PROFESSION_EMOJIS } from "@/lib/objectiveGenerator";

// ── Ressources entrepôt avec noms et icônes ──
const WAREHOUSE_ITEMS = {
  bois_brut:    { name: "Bois brut",      icon: "🪵", tier: 1 },
  minerai_fer:  { name: "Minerai de fer", icon: "🪨", tier: 1 },
  ble:          { name: "Blé",            icon: "🌾", tier: 1 },
  laine_brute:  { name: "Laine brute",    icon: "🧶", tier: 1 },
  herbes:       { name: "Herbes",         icon: "🌿", tier: 1 },
  quartz_brut:  { name: "Quartz brut",    icon: "🔮", tier: 1 },
  pierre:       { name: "Pierre",         icon: "🪨", tier: 1 },
  planches:     { name: "Planches",       icon: "🪵", tier: 2 },
  pierre_brute: { name: "Pierre brute",   icon: "🗿", tier: 2 },
  fil:          { name: "Fil",            icon: "🧵", tier: 2 },
  charbon:      { name: "Charbon",        icon: "⚫", tier: 2 },
  extrait:      { name: "Extrait",        icon: "🫗", tier: 2 },
  quartz_poli:  { name: "Quartz poli",    icon: "💠", tier: 2 },
  farine:       { name: "Farine",         icon: "🧺", tier: 2 },
  encre:        { name: "Encre",          icon: "🖋️", tier: 2 },
  lingots_fer:  { name: "Lingots de fer", icon: "🔩", tier: 2 },
  lingot_or:    { name: "Lingot d'or",    icon: "🥇", tier: 3 },
  lingot_royal: { name: "Lingot royal",   icon: "👑", tier: 3 },
};

export default function MaireDashboard({ city, profile, players = [] }) {
  const [transactions, setTransactions] = useState([]);
  const [warehouseLogs, setWarehouseLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("24h"); // "24h" | "48h" | "7j"
  const [expandedType, setExpandedType] = useState(null); // type déplié dans le résumé

  useEffect(() => {
    if (!city?.id) return;
    loadTransactions();
  }, [city?.id, period]);

  async function loadTransactions() {
    setLoading(true);
    try {
      const hours = period === "24h" ? 24 : period === "48h" ? 48 : 168;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      // Transactions or — on ne garde QUE celles qui affectent la trésorerie de la ville
      // (flux joueur-joueur comme vente/achat/vols/quêtes/banque sont exclus)
      const txs = await base44.entities.GoldTransaction.filter({ city_id: city.id }, "-created", 200);
      const filtered = txs
        .filter(t => new Date(t.created || t.created_date || t.created_at || 0) >= new Date(since))
        .filter(t => {
          const meta = TRANSACTION_TYPES[t.type];
          return meta && (meta.side === "in" || meta.side === "out");
        });
      setTransactions(filtered);
      // Logs entrepôt
      const wlogs = await base44.entities.WarehouseLog.filter({ city_id: city.id }, "-created", 300);
      const wfiltered = wlogs
        .filter(l => new Date(l.created || l.created_date || 0) >= new Date(since));
      setWarehouseLogs(wfiltered);
    } catch (e) {
      console.warn("MaireDashboard load:", e);
    }
    setLoading(false);
  }

  // ── Calculs trésorerie ──
  // Les GoldTransaction sont enregistrées du point de vue joueur ; on convertit
  // en montant "côté ville" via toCityAmount (inverse le signe sauf exception).
  let cityIn = 0, cityOut = 0;
  for (const t of transactions) {
    const amt = toCityAmount(t);
    if (amt > 0) cityIn += amt;
    else if (amt < 0) cityOut += Math.abs(amt);
  }
  const netBilan = cityIn - cityOut;

  // ── Entrepôt ──
  const warehouse = city?.warehouse || {};
  const warehouseEntries = Object.entries(warehouse)
    .filter(([k, v]) => v > 0 && WAREHOUSE_ITEMS[k])
    .sort((a, b) => {
      const ta = WAREHOUSE_ITEMS[a[0]]?.tier || 99;
      const tb = WAREHOUSE_ITEMS[b[0]]?.tier || 99;
      return ta !== tb ? ta - tb : b[1] - a[1];
    });
  const totalWarehouseItems = warehouseEntries.reduce((s, [, v]) => s + v, 0);
  const maxWarehouseItem = Math.max(1, ...warehouseEntries.map(([, v]) => v));

  // ── Population ──
  const residents = players.filter(p => p.home_city_id === city.id);
  const visitors  = players.filter(p => p.city_id === city.id && p.home_city_id !== city.id);
  const estimatedDailyCost = residents.length; // 1 T1 par résident

  // ── Consommation journalière estimée par ressource ──
  // Nouvelle logique : tirage parmi les T1 PRÉSENTES en stock uniquement
  // → le coût population est réparti proportionnellement au stock de chaque T1 présente
  const T1_KEYS = ["bois_brut", "minerai_fer", "ble", "laine_brute", "herbes", "quartz_brut", "pierre"];

  // T1 présentes en stock
  const t1Present = T1_KEYS.filter(k => (warehouse[k] || 0) > 0);
  const totalT1Stock = t1Present.reduce((s, k) => s + (warehouse[k] || 0), 0);

  const dailyCostByKey = {};
  // Coût population : réparti proportionnellement au stock de chaque T1 présente
  if (t1Present.length > 0 && residents.length > 0) {
    for (const k of t1Present) {
      const share = (warehouse[k] || 0) / totalT1Stock; // part de ce T1 dans le stock total
      dailyCostByKey[k] = (dailyCostByKey[k] || 0) + residents.length * share;
    }
  }
  // ── Coût entretien bâtiments (calculé depuis city.buildings comme dans dailyReset) ──
  const buildings = city?.buildings || [];
  const maintMultiplier = 1 + 0.2 * Math.max(0, residents.length - 1);
  for (const building of buildings) {
    const bType = BUILDING_TYPES[building.building_type];
    if (!bType?.maintenance) continue;
    const level = building.level || 1;
    const levelMultiplier = (bType.category === "production" || bType.category === "bien_etre")
      ? Math.pow(2, level - 1) : 1;
    for (const [res, qty] of Object.entries(bType.maintenance)) {
      if (res === "or") continue; // l'or vient de la trésorerie, pas de l'entrepôt
      const realCost = Math.ceil(qty * maintMultiplier * levelMultiplier);
      if (realCost > 0) {
        dailyCostByKey[res] = (dailyCostByKey[res] || 0) + realCost;
      }
    }
  }

  // Jours de stock restants par ressource
  const daysLeftByKey = {};
  for (const [k, cost] of Object.entries(dailyCostByKey)) {
    if (cost > 0) {
      daysLeftByKey[k] = Math.floor((warehouse[k] || 0) / cost);
    }
  }
  // Pour les ressources avec entretien bâtiment mais pas en stock → 0 jours
  for (const k of Object.keys(dailyCostByKey)) {
    if ((dailyCostByKey[k] || 0) > 0 && (warehouse[k] || 0) === 0) {
      daysLeftByKey[k] = 0;
    }
  }

  // Niveau d'alerte : rouge=0-1j, orange=2-5j, vert=6j+
  const stockAlert = (key) => {
    const days = daysLeftByKey[key];
    if (days === undefined) return null; // pas consommé
    if (days <= 1) return "red";
    if (days <= 5) return "orange";
    return "green";
  };

  // ── Grouper les transactions par type pour le résumé (montant côté ville) ──
  const txByType = {};
  for (const tx of transactions) {
    if (!txByType[tx.type]) txByType[tx.type] = { count: 0, total: 0 };
    txByType[tx.type].count++;
    txByType[tx.type].total += toCityAmount(tx);
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const isYesterday = d.getDate() !== now.getDate();
    return (isYesterday ? "Hier " : "") + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-4">

      {/* ── En-tête + sélecteur période ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-heading font-semibold text-base flex items-center gap-2">
          👑 Tableau de bord du maire
        </h3>
        <div className="flex gap-1">
          {["24h", "48h", "7j"].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs font-heading px-3 py-1 rounded-full border transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:border-primary"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Snapshot trésorerie ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card className="col-span-2 sm:col-span-1 bg-amber-50 border-amber-200">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground font-body mb-1">Trésorerie actuelle</div>
            <div className="font-heading font-bold text-lg text-amber-700">{city.gold_treasury || 0} 💰</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground font-body mb-1">Entrées ({period})</div>
            <div className="font-heading font-bold text-green-700">+{cityIn} 💰</div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground font-body mb-1">Sorties ({period})</div>
            <div className="font-heading font-bold text-red-700">−{cityOut} 💰</div>
          </CardContent>
        </Card>
        <Card className={netBilan >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground font-body mb-1">Bilan net ({period})</div>
            <div className={`font-heading font-bold ${netBilan >= 0 ? "text-green-700" : "text-red-700"}`}>
              {netBilan >= 0 ? "+" : ""}{netBilan} 💰
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Résumé par type de transaction (lignes dépliables) ── */}
      {Object.keys(txByType).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-sm">📋 Résumé par source ({period})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {Object.entries(txByType)
                .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
                .map(([type, { count, total }]) => {
                  const meta = getTxLabel(type);
                  const isPositive = total >= 0;
                  const isExpanded = expandedType === type;
                  const detailTxs = transactions.filter(t => t.type === type);
                  return (
                    <div key={type} className="rounded-md border border-transparent hover:border-border transition-colors">
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 text-xs font-body px-1.5 py-1 cursor-pointer hover:bg-muted/40 rounded"
                        onClick={() => setExpandedType(isExpanded ? null : type)}
                      >
                        <span className="w-3 text-center text-muted-foreground">{isExpanded ? "▾" : "▸"}</span>
                        <span className="w-5 text-center">{meta.icon}</span>
                        <span className="flex-1 text-left text-muted-foreground">{meta.label}</span>
                        <Badge variant="outline" className="text-xs font-body">{count}×</Badge>
                        <span className={`font-heading font-semibold w-20 text-right ${isPositive ? "text-green-600" : "text-red-600"}`}>
                          {isPositive ? "+" : ""}{total} 💰
                        </span>
                      </button>
                      {isExpanded && (
                        <div className="ml-8 mr-1 mb-2 mt-1 space-y-0.5 max-h-56 overflow-y-auto pr-1 border-l-2 border-muted pl-2">
                          {detailTxs.map((tx, i) => {
                            const cityAmt = toCityAmount(tx);
                            const isPos = cityAmt >= 0;
                            return (
                              <div key={i} className="flex items-center gap-2 text-[10px] font-body py-0.5">
                                <span className="text-muted-foreground/70 shrink-0">{formatTime(tx.created || tx.created_date)}</span>
                                <span className="flex-1 truncate text-muted-foreground">{tx.player_name || tx.description || ""}</span>
                                {cityAmt !== 0 && (
                                  <span className={`font-heading shrink-0 ${isPos ? "text-green-600" : "text-red-600"}`}>
                                    {isPos ? "+" : ""}{cityAmt}💰
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Entrepôt ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-sm flex items-center justify-between">
            <span>📦 Entrepôt communautaire</span>
            <span className="text-xs font-body text-muted-foreground font-normal">{totalWarehouseItems} objets au total</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {warehouseEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground font-body text-center py-3">Entrepôt vide</p>
          ) : (
            <div className="space-y-3">
              {/* T1 */}
              {[1, 2, 3].map(tier => {
                const tierItems = warehouseEntries.filter(([k]) => (WAREHOUSE_ITEMS[k]?.tier || 1) === tier);
                if (tierItems.length === 0) return null;
                return (
                  <div key={tier}>
                    <div className="text-xs font-heading text-muted-foreground mb-1.5">
                      Tier {tier} — {tier === 1 ? "Ressources brutes" : tier === 2 ? "Transformées" : "Rares"}
                    </div>
                    <div className="space-y-1.5">
                      {tierItems.map(([key, qty]) => {
                        const def = WAREHOUSE_ITEMS[key];
                        const pct = Math.min(100, Math.round((qty / maxWarehouseItem) * 100));
                        const alert = stockAlert(key);
                        const days = daysLeftByKey[key];
                        const colorClass = alert === "red" ? "text-red-600"
                          : alert === "orange" ? "text-orange-500"
                          : alert === "green" ? "text-green-600"
                          : "text-foreground";
                        const barClass = alert === "red" ? "[&>div]:bg-red-400"
                          : alert === "orange" ? "[&>div]:bg-orange-400"
                          : alert === "green" ? "[&>div]:bg-green-500"
                          : "";
                        const alertIcon = alert === "red" ? "🔴"
                          : alert === "orange" ? "🟠"
                          : alert === "green" ? "🟢"
                          : "";
                        return (
                          <div key={key} className="space-y-0.5">
                            <div className="flex items-center gap-2 text-xs font-body">
                              <span className="w-5 text-center">{alertIcon || def.icon}</span>
                              <span className="flex-1">{def.name}</span>
                              {days !== undefined && (
                                <span className={`text-xs font-body ${colorClass}`}>
                                  {days <= 1 ? "< 1j" : `~${days}j`}
                                </span>
                              )}
                              <span className={`font-heading font-semibold ${colorClass}`}>
                                {qty}
                              </span>
                            </div>
                            <Progress
                              value={pct}
                              className={`h-1 ${barClass}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Mouvements entrepôt ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-sm flex items-center justify-between">
            <span>🔄 Mouvements entrepôt ({period})</span>
            <div className="flex gap-3 text-xs font-body text-muted-foreground font-normal">
              <span className="text-green-600">▲ {warehouseLogs.filter(l => l.action === "deposit").reduce((s, l) => s + (l.quantity || 0), 0)} déposés</span>
              <span className="text-red-600">▼ {warehouseLogs.filter(l => l.action === "withdraw").reduce((s, l) => s + (l.quantity || 0), 0)} retirés</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {warehouseLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground font-body text-center py-3">Aucun mouvement sur cette période.</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {warehouseLogs.map((log, i) => {
                const isDeposit = log.action === "deposit";
                const sourceLabel = {
                  player: log.player_name || "Joueur",
                  maintenance: `Entretien — ${log.player_name || ""}`,
                  population: `Population — ${log.player_name || ""}`,
                  population_penalty: `Pénurie — ${log.player_name || ""}`,
                  reset: "Reset quotidien",
                }[log.source] || log.source;
                return (
                  <div key={i} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 text-xs font-body">
                    <span className="shrink-0">{isDeposit ? "▲" : "▼"}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold">{log.item_name || log.item_key}</span>
                      <span className="text-muted-foreground ml-1.5">{sourceLabel}</span>
                    </div>
                    <span className={`font-heading font-bold shrink-0 ${isDeposit ? "text-green-600" : "text-red-600"}`}>
                      {isDeposit ? "+" : "−"}{log.quantity}
                    </span>
                    <span className="text-muted-foreground shrink-0">{formatTime(log.created || log.created_date)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Population ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-sm">👥 Population</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/40 rounded-lg p-2">
              <div className="text-xs text-muted-foreground font-body">Résidents</div>
              <div className="font-heading font-bold">{residents.length} / {city.max_population || 3}</div>
            </div>
            <div className="bg-muted/40 rounded-lg p-2">
              <div className="text-xs text-muted-foreground font-body">Visiteurs</div>
              <div className="font-heading font-bold">{visitors.length}</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
              <div className="text-xs text-muted-foreground font-body">Coût/jour</div>
              <div className="font-heading font-bold text-amber-700">~{estimatedDailyCost} T1</div>
            </div>
          </div>
          {residents.length > 0 && (
            <div className="space-y-1">
              {residents.map(r => (
                <div key={r.id} className="flex items-center gap-2 text-xs font-body bg-muted/30 rounded px-2 py-1">
                  <span>{r.profession ? PROFESSION_EMOJIS[r.profession] || "👤" : "👤"}</span>
                  <span className="flex-1 font-semibold">{r.character_name || r.user_email}</span>
                  <span className="text-muted-foreground">{r.profession || "—"}</span>
                  <span className="text-amber-600 font-semibold">{r.gold || 0} 💰</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
