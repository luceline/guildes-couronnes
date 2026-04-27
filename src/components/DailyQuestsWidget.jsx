import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { generatePlayerObjectives } from "../lib/objectiveGenerator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import HelpTooltip from "./HelpTooltip";

const TYPE_META = {
  deposit: { icon: "📦", label: "Dépôt",     color: "bg-blue-50 border-blue-200" },
  sell:    { icon: "🏪", label: "Vente",      color: "bg-amber-50 border-amber-200" },
  produce: { icon: "⚒️",  label: "Production", color: "bg-green-50 border-green-200" },
  travel:  { icon: "🐴", label: "Voyage",     color: "bg-purple-50 border-purple-200" },
  contribute: { icon: "🤝", label: "Contribution", color: "bg-pink-50 border-pink-200" },
};

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setUTCDate(midnight.getUTCDate() + 1); midnight.setUTCHours(6, 0, 0, 0); // 6h UTC du lendemain
      const diff = midnight - now;
      const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setTimeLeft(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return timeLeft;
}

export default function DailyQuestsWidget({ profile, city }) {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const countdown = useCountdown();

  const todayStr = new Date().toISOString().split("T")[0];

  const isToday = (q) => {
    // created_date vient de normalizeRecord (champ PocketBase "created")
    // quest_date est le champ texte qu'on stocke dans la collection
    const d = q.created_date || q.quest_date || "";
    return d.startsWith(todayStr);
  };

  const loadQuests = useCallback(async () => {
    if (!profile?.user_email) return;
    setLoading(true);
    const all = await base44.entities.PlayerObjective.filter({
      player_email: profile.user_email,
    });

    // Garder uniquement les quêtes du jour, sans les contrats
    const todayAll = all.filter(q => !q.parchemin_type && isToday(q));

    // ── Auto-dédoublonnage en DB (anti-bug multi-reset) ──
    // Si > 6 quêtes pour aujourd'hui, on supprime le surplus pour éviter
    // que les hooks Production/Travel/Market itèrent sur des doublons.
    // Priorité de conservation : complétées d'abord, puis les plus anciennes.
    let todayQuests = todayAll;
    if (todayAll.length > 6) {
      const completed = todayAll.filter(q => q.status === "completed");
      const others = todayAll.filter(q => q.status !== "completed")
        .sort((a, b) => (a.created || a.created_date || "").localeCompare(b.created || b.created_date || ""));
      const keep = [...completed];
      const slotsLeft = Math.max(0, 6 - keep.length);
      keep.push(...others.slice(0, slotsLeft));

      const keepIds = new Set(keep.map(q => q.id));
      const toDelete = todayAll.filter(q => !keepIds.has(q.id));
      // Suppression best-effort, on ne bloque pas l'affichage si ça plante
      Promise.all(toDelete.map(q =>
        base44.entities.PlayerObjective.delete(q.id).catch(() => {})
      ));
      todayQuests = keep;
      console.warn(`[DailyQuestsWidget] Anti-doublons : ${todayAll.length} → ${keep.length} quêtes (${toDelete.length} supprimées en DB)`);
    }

    setQuests(todayQuests);
    setLoading(false);
    return todayQuests;
  }, [profile?.user_email, todayStr]);

  const generateQuests = useCallback(async () => {
    if (!profile || generating) return;
    setGenerating(true);
    try {
      // ── Verrou anti-double génération ──
      // On vérifie une dernière fois en DB avant de créer pour éviter qu'un autre
      // appel concurrent (ou un re-mount du composant) ne génère un 2e lot.
      const fresh = await base44.entities.PlayerObjective.filter({
        player_email: profile.user_email,
      }).catch(() => []);
      const existingToday = fresh.filter(q => !q.parchemin_type && isToday(q));
      if (existingToday.length > 0) {
        // Quêtes déjà présentes : on les charge et on s'arrête
        await loadQuests();
        return;
      }

      const ecoRes = await base44.entities.EconomySettings.filter({ setting_key: "global" }).catch(() => []);
      const ecoSettings = ecoRes[0] || {};
      const newQuests = generatePlayerObjectives(profile, profile.home_city_id || profile.city_id, ecoSettings);
      await base44.entities.PlayerObjective.bulkCreate(newQuests);
      toast.success("🎯 Nouvelles quêtes du jour générées !");
      await loadQuests();
    } finally {
      setGenerating(false);
    }
  }, [profile, generating, loadQuests]);

  useEffect(() => {
    loadQuests().then(async (q) => {
      if (!q || q.length > 0) return;
      const todayAll = await base44.entities.PlayerObjective.filter({
        player_email: profile?.user_email,
      }).catch(() => []);
      const alreadyGeneratedToday = todayAll.some(o => isToday(o) && !o.parchemin_type);
      if (!alreadyGeneratedToday) generateQuests();
    });
  }, [profile?.user_email]);

  const completed = quests.filter(q => q.status === "completed").length;
  const total = quests.length;
  const allDone = total > 0 && completed === total;

  return (
    <Card className={allDone ? "border-amber-400 shadow-md shadow-amber-100" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            🎯 Quêtes du jour
            <HelpTooltip text="Six quêtes se renouvellent chaque matin à 6h. Fabriquer, vendre, voyager, approvisionner l'entrepôt de votre ville ou d'une ville étrangère. La récompense en or est versée dès la validation et apparaît dans votre journal de bord." side="bottom" />
            {allDone && <Badge className="bg-amber-500 text-white font-heading text-xs">✨ Tout accompli !</Badge>}
          </CardTitle>
          <div className="flex items-center gap-3">
            {total > 0 && (
              <span className="text-xs font-body text-muted-foreground">
                {completed}/{total} · Reset dans <strong className="font-heading tabular-nums">{countdown}</strong>
              </span>
            )}
            <button
              onClick={loadQuests}
              className="text-xs text-muted-foreground hover:text-foreground font-body underline underline-offset-2"
            >
              🔄
            </button>
          </div>
        </div>
        {total > 0 && (
          <Progress value={(completed / total) * 100} className="h-1.5 mt-1" />
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground font-body text-center py-3">Chargement...</p>
        ) : quests.length === 0 ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-muted-foreground font-body">Aucune quête active pour aujourd'hui.</p>
            <button
              onClick={generateQuests}
              disabled={generating}
              className="text-xs font-heading bg-primary text-primary-foreground rounded-lg px-4 py-2 disabled:opacity-50"
            >
              {generating ? "Génération..." : "🎯 Générer mes quêtes du jour"}
            </button>
          </div>
        ) : (
          quests.map((q, i) => {
            const meta = TYPE_META[q.type] || TYPE_META.produce;
            const pct = Math.min(100, Math.floor(((q.current_quantity || 0) / (q.target_quantity || 1)) * 100));
            const done = q.status === "completed";
            const maxReward = Math.max(...quests.map(x => x.reward_gold || 0));
            const isBigQuest = (q.reward_gold || 0) === maxReward && maxReward > (quests.filter(x => x.reward_gold !== maxReward)[0]?.reward_gold || 0);

            return (
              <div
                key={q.id || i}
                className={`rounded-lg border p-3 space-y-2 transition-all ${
                  done
                    ? "bg-green-50 border-green-300 opacity-80"
                    : `${meta.color}`
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-base shrink-0">{done ? "✅" : meta.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-heading font-semibold text-sm ${done ? "line-through text-muted-foreground" : ""}`}>
                          {q.title}
                        </span>
                        {isBigQuest && !done && (
                          <Badge variant="outline" className="text-xs font-body border-amber-400 text-amber-700 bg-amber-50">⭐ Spéciale</Badge>
                        )}
                      </div>
                      <p className="text-xs font-body text-muted-foreground mt-0.5 leading-relaxed">{q.description}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-heading font-bold shrink-0 ${done ? "text-green-600" : "text-primary"}`}>
                    +{q.reward_gold}💰
                  </span>
                </div>

                {!done && (
                  <div className="space-y-1">
                    <Progress value={pct} className="h-1.5" />
                    <div className="flex justify-between text-xs text-muted-foreground font-body">
                      <span className="capitalize">{meta.label}</span>
                      <span>{q.current_quantity || 0} / {q.target_quantity}</span>
                    </div>
                  </div>
                )}
                {done && (
                  <p className="text-xs text-green-600 font-body font-semibold">✓ Quête accomplie !</p>
                )}
              </div>
            );
          })
        )}

        {quests.length > 0 && !loading && (
          <button
            onClick={generateQuests}
            disabled={generating || quests.length >= 6}
            className="w-full text-xs font-body text-muted-foreground hover:text-foreground underline underline-offset-2 pt-1 disabled:opacity-40 disabled:no-underline"
          >
            {generating ? "Génération en cours..." : quests.length < 6 ? "Compléter mes quêtes du jour" : ""}
          </button>
        )}
      </CardContent>
    </Card>
  );
}



