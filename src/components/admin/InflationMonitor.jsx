import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

export default function InflationMonitor() {
  const [economySettings, setEconomySettings] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newReward, setNewReward] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Charger EconomySettings
      const settings = await base44.entities.EconomySettings.filter({ setting_key: "global" }).catch(() => []);
      if (settings.length > 0) {
        setEconomySettings(settings[0]);
        setNewReward(settings[0].objective_reward_base || 50);
      }

      // Charger historique 30 jours
      const snaps = await base44.entities.EconomySnapshot.list("-created_date", 30).catch(() => []);
      setHistory(snaps.reverse());
    } catch (e) {
      console.warn("InflationMonitor load error:", e);
    }
    setLoading(false);
  }

  async function adjustReward(adjustment) {
    if (!economySettings) return;
    const current = economySettings.objective_reward_base || 50;
    const newVal = Math.max(30, Math.min(100, current + adjustment));
    
    try {
      await base44.entities.EconomySettings.update(economySettings.id, {
        objective_reward_base: newVal,
      });
      setNewReward(newVal);
      toast.success(`Récompense objectif ajustée à ${newVal}💰`);
      await loadData();
    } catch (e) {
      toast.error("Erreur: impossible d'ajuster la récompense");
    }
  }

  const currentInflation = economySettings?.inflation_daily_rate ?? 0;
  const rewardBase = economySettings?.objective_reward_base ?? 50;
  const targetMin = 1;
  const targetMax = 3;
  const isHealthy = currentInflation >= targetMin && currentInflation <= targetMax;

  const chartData = history.map(snap => ({
    date: snap.date,
    players_gold: Math.round(snap.total_players_gold / snap.player_count || 0),
    inflation: snap.inflation_rate || 0,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Indicateurs clés */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-xs text-muted-foreground font-body mb-1">Inflation quotidienne</div>
              <div className={`text-3xl font-heading font-bold ${isHealthy ? "text-green-600" : currentInflation > targetMax ? "text-red-600" : "text-orange-600"}`}>
                {currentInflation.toFixed(2)}%
              </div>
              <div className="text-xs font-body text-muted-foreground mt-2">
                Cible: {targetMin}–{targetMax}%
              </div>
              <Badge className={`mt-2 ${isHealthy ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                {isHealthy ? "✅ Sain" : currentInflation > targetMax ? "⚠️ Trop haute" : "⚠️ Trop basse"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-xs text-muted-foreground font-body mb-1">Récompense objectif</div>
              <div className="text-3xl font-heading font-bold text-blue-600">{rewardBase}💰</div>
              <div className="text-xs font-body text-muted-foreground mt-2">Par objectif quotidien</div>
              <div className="flex gap-2 mt-2 justify-center">
                <Button size="sm" variant="outline" onClick={() => adjustReward(-5)} className="text-xs font-body">−5</Button>
                <Button size="sm" variant="outline" onClick={() => adjustReward(5)} className="text-xs font-body">+5</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-xs text-muted-foreground font-body mb-1">Or moyen/joueur</div>
              <div className="text-3xl font-heading font-bold text-amber-600">
                {(economySettings?.or_moyen_par_joueur || 0).toLocaleString()}
              </div>
              <div className="text-xs font-body text-muted-foreground mt-2">Snapshot d'hier</div>
              <div className="text-xs font-body text-muted-foreground mt-1">
                Mis à jour: {economySettings?.last_updated || "—"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphique historique */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">📈 Tendance inflation (30j)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} label={{ value: "Or moyen", angle: -90, position: "insideLeft" }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} label={{ value: "Inflation %", angle: 90, position: "insideRight" }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="players_gold" stroke="#8884d8" name="Or moyen/joueur" />
                <Line yAxisId="right" type="monotone" dataKey="inflation" stroke="#82ca9d" name="Inflation %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tableau historique détaillé */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">📊 Historique quotidien</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead className="border-b">
                <tr className="text-muted-foreground">
                  <th className="text-left py-2 px-3">Date</th>
                  <th className="text-right py-2 px-3">Joueurs</th>
                  <th className="text-right py-2 px-3">Or total</th>
                  <th className="text-right py-2 px-3">Or moyen</th>
                  <th className="text-right py-2 px-3">Villes</th>
                  <th className="text-right py-2 px-3">Inflation</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((snap, i) => (
                  <tr key={i} className="hover:bg-muted/50">
                    <td className="py-2 px-3">{snap.date}</td>
                    <td className="text-right py-2 px-3">{snap.player_count}</td>
                    <td className="text-right py-2 px-3">{snap.total_players_gold.toLocaleString()}💰</td>
                    <td className="text-right py-2 px-3 font-semibold">
                      {snap.player_count > 0 ? Math.round(snap.total_players_gold / snap.player_count) : 0}💰
                    </td>
                    <td className="text-right py-2 px-3">{snap.total_cities_gold.toLocaleString()}💰</td>
                    <td className={`text-right py-2 px-3 font-semibold ${
                      (snap.inflation_rate ?? 0) >= 1 && (snap.inflation_rate ?? 0) <= 3 
                        ? "text-green-600" 
                        : (snap.inflation_rate ?? 0) > 3 
                        ? "text-red-600" 
                        : "text-orange-600"
                    }`}>
                      {(snap.inflation_rate ?? 0).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Guide */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="font-heading text-sm text-blue-900">💡 Système d'inflation auto-ajusté</CardTitle>
        </CardHeader>
        <CardContent className="text-sm font-body text-blue-900 space-y-2">
          <p>
            • <strong>Inflation mesurée</strong> quotidiennement = (or_moyen_auj / or_moyen_hier − 1) × 100
          </p>
          <p>
            • <strong>Cible</strong> : 1–3% par jour pour une croissance équilibrée
          </p>
          <p>
            • <strong>Ajustement automatique</strong> : récompense objectif augmente si inflation &lt; 1%, baisse si &gt; 3%
          </p>
          <p>
            • <strong>Contrôle admin</strong> : override manuel de la récompense de base via ±5💰
          </p>
          <p>
            • <strong>Sources d'or</strong> : objectifs quotidiens, vente lingots orfèvre, intérêts trésorerie
          </p>
        </CardContent>
      </Card>
    </div>
  );
}