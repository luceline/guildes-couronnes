import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DailyResetManager() {
  const [resets, setResets] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const r = await base44.entities.DailyReset.list("-created_date", 10);
      setResets(r);
    } catch (e) {
      console.warn("DailyResetManager load:", e);
    }
  }

  const statusColor = (s) =>
    s === "done"    ? "bg-green-100 text-green-800"
    : s === "running" ? "bg-blue-100 text-blue-800"
    : "bg-yellow-100 text-yellow-800";

  const lastReset = resets[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">🔄 Reset quotidien</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs font-body text-muted-foreground">
            Le reset quotidien est exécuté automatiquement par un cron côté serveur, tous les jours à <strong>6h UTC</strong> (= 8h heure française).
            Aucune intervention manuelle n'est nécessaire ni possible depuis cette interface.
          </p>

          {lastReset ? (
            <div className="bg-muted/40 rounded-lg p-3 font-body text-sm space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">Dernier reset :</span>
                <span>{lastReset.reset_date}</span>
                <Badge className={statusColor(lastReset.status)}>{lastReset.status}</Badge>
              </div>
              {lastReset.reset_time && (
                <div className="text-xs text-muted-foreground">
                  Heure : {new Date(lastReset.reset_time).toLocaleString("fr-FR")}
                </div>
              )}
              {lastReset.triggered_by && (
                <div className="text-xs text-muted-foreground">
                  Déclenché par : {lastReset.triggered_by}
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground font-body text-sm">Aucun reset enregistré.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-sm">📜 Historique des resets (10 derniers)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {resets.length === 0 ? (
            <p className="text-xs font-body text-muted-foreground">Aucun reset enregistré pour le moment.</p>
          ) : (
            resets.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm font-body border-b pb-1 last:border-0">
                <span>{r.reset_date}</span>
                <span className="text-xs text-muted-foreground">{r.triggered_by || "-"}</span>
                <Badge className={statusColor(r.status)}>{r.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
