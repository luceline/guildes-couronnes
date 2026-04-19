import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TaxAuditPanel() {
  const [players, setPlayers] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState("all");

  useEffect(() => {
    async function load() {
      const [ps, cs] = await Promise.all([
        base44.entities.PlayerProfile.list(),
        base44.entities.City.list(),
      ]);
      setPlayers(ps);
      setCities(cs);
      setLoading(false);
    }
    load();
  }, []);

  // Construire la liste des joueurs avec leurs taxes en attente
  const rows = players
    .filter(p => {
      const pending = p.pending_market_tax || {};
      const total = Object.values(pending).reduce((s, v) => s + v, 0);
      return total > 0;
    })
    .map(p => {
      const pending = p.pending_market_tax || {};
      const byCity = Object.entries(pending)
        .filter(([, v]) => v > 0)
        .map(([cid, amount]) => {
          const city = cities.find(c => c.id === cid);
          return {
            cityId: cid,
            cityName: city?.name || cid,
            taxRate: city?.tax_rate || 0,
            amountRaw: amount,
            amountRounded: Math.ceil(amount),
          };
        });
      const total = byCity.reduce((s, r) => s + r.amountRaw, 0);
      return { player: p, byCity, total };
    })
    .filter(r => selectedCity === "all" || r.byCity.some(b => b.cityId === selectedCity))
    .sort((a, b) => b.total - a.total);

  // Totaux par ville
  const cityTotals = {};
  players.forEach(p => {
    const pending = p.pending_market_tax || {};
    Object.entries(pending).forEach(([cid, amount]) => {
      if (amount > 0) cityTotals[cid] = (cityTotals[cid] || 0) + amount;
    });
  });

  if (loading) return <p className="text-muted-foreground text-sm font-body text-center py-8">Chargement...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-heading text-lg font-semibold">📊 Audit taxes marché</h2>
        <select
          value={selectedCity}
          onChange={e => setSelectedCity(e.target.value)}
          className="text-xs font-body border border-border rounded px-2 py-1 bg-background text-foreground"
        >
          <option value="all">Toutes les villes</option>
          {cities.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground font-body">
          {rows.length} joueur(s) avec taxes en attente
        </span>
      </div>

      {/* Résumé par ville */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading">Taxes en attente par ville (ce reset)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(cityTotals).map(([cid, total]) => {
              const city = cities.find(c => c.id === cid);
              return (
                <div key={cid} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-body">
                  <span className="font-semibold text-amber-900">{city?.name || cid}</span>
                  <span className="text-amber-700 ml-2">taux {city?.tax_rate || 0}%</span>
                  <span className="ml-2 font-heading font-bold text-amber-800">→ ~{Math.ceil(total)}💰</span>
                </div>
              );
            })}
            {Object.keys(cityTotals).length === 0 && (
              <p className="text-xs text-muted-foreground font-body">Aucune taxe en attente.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Détail par joueur */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading">Détail par joueur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground font-body text-center py-4">Aucun joueur avec taxes en attente.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-body">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-semibold">Joueur</th>
                    <th className="text-left py-2 pr-4 font-semibold">Or actuel</th>
                    <th className="text-left py-2 pr-4 font-semibold">Ville</th>
                    <th className="text-right py-2 pr-4 font-semibold">Achats bruts</th>
                    <th className="text-right py-2 pr-4 font-semibold">Taux</th>
                    <th className="text-right py-2 pr-4 font-semibold">Taxe exacte</th>
                    <th className="text-right py-2 font-semibold">Taxe arrondie</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ player, byCity, total }) =>
                    byCity.map((b, i) => {
                      // Recalculer le montant brut d'achats : taxeRaw / taux * 100
                      const achatsBruts = b.taxRate > 0
                        ? Math.round(b.amountRaw / b.taxRate * 100)
                        : "—";
                      const canPay = (player.gold || 0) >= Math.ceil(total);
                      return (
                        <tr key={`${player.id}-${b.cityId}`} className="border-b border-border/50 hover:bg-muted/20">
                          {i === 0 && (
                            <>
                              <td className="py-2 pr-4 font-semibold text-foreground" rowSpan={byCity.length}>
                                {player.character_name}
                                <span className="text-muted-foreground font-normal ml-1">({player.profession})</span>
                              </td>
                              <td className="py-2 pr-4" rowSpan={byCity.length}>
                                <span className={canPay ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
                                  {player.gold || 0}💰
                                </span>
                                {!canPay && (
                                  <Badge className="ml-1 bg-red-100 text-red-700 border-red-200 text-xs">dette</Badge>
                                )}
                              </td>
                            </>
                          )}
                          <td className="py-2 pr-4 text-muted-foreground">{b.cityName}</td>
                          <td className="py-2 pr-4 text-right">{achatsBruts}💰</td>
                          <td className="py-2 pr-4 text-right text-amber-700">{b.taxRate}%</td>
                          <td className="py-2 pr-4 text-right text-amber-600">{b.amountRaw.toFixed(2)}💰</td>
                          <td className="py-2 text-right font-semibold text-amber-800">{b.amountRounded}💰</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td colSpan={5} className="py-2 text-xs font-body text-muted-foreground">
                      Total taxes à percevoir au prochain reset
                    </td>
                    <td className="py-2 text-right text-amber-600">
                      {rows.reduce((s, r) => s + r.total, 0).toFixed(2)}💰
                    </td>
                    <td className="py-2 text-right text-amber-800">
                      {rows.reduce((s, r) => s + Math.ceil(r.total), 0)}💰
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
