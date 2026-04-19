import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { checkAndRunDailyReset } from "../../lib/dailyReset";

export default function DailyResetManager() {
  const [resets, setResets] = useState([]);
  const [running, setRunning] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const r = await base44.entities.DailyReset.list("-created_date", 10);
    setResets(r);
  }

  async function forceReset() {
    if (!window.confirm("Forcer un reset quotidien maintenant ? Cela déclenchera taxes, maintenance, etc.")) return;
    setRunning(true);
    try {
      const user = await base44.auth.me();
      // Supprimer le verrou du jour pour forcer le reset
      const records = await base44.entities.DailyReset.list("-created_date", 1);
      if (records[0]?.status === "done" || records[0]?.status === "running") {
        await base44.entities.DailyReset.update(records[0].id, { status: "pending", reset_date: "force" });
      }
      await checkAndRunDailyReset(user?.email || "admin");
    } catch (e) {
      toast.error("Erreur : " + e.message);
    }
    setRunning(false);
    load();
  }

  const statusColor = (s) => s === "done" ? "bg-green-100 text-green-800" : s === "running" ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800";

  const lastReset = resets[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="font-heading text-lg">🔄 Reset quotidien</CardTitle></CardHeader>
        <CardContent className="space-y-4">
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
                <div className="text-xs text-muted-foreground">Déclenché par : {lastReset.triggered_by}</div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground font-body text-sm">Aucun reset enregistré.</p>
          )}

          <Button onClick={forceReset} disabled={running} variant="destructive" className="font-heading">
            {running ? "Reset en cours..." : "⚡ Forcer le reset maintenant"}
          </Button>
          <p className="text-xs text-muted-foreground font-body">
            ⚠️ Le reset déclenche : impôts, entretien logements, bâtiments, intérêts, objectifs, reset fatigue/faim.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-heading text-sm">📜 Historique des resets (10 derniers)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {resets.map(r => (
            <div key={r.id} className="flex items-center justify-between text-sm font-body border-b pb-1 last:border-0">
              <span>{r.reset_date}</span>
              <span className="text-xs text-muted-foreground">{r.triggered_by || "—"}</span>
              <Badge className={statusColor(r.status)}>{r.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}