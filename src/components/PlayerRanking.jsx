import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { getVendeurRank, getContributeurRank, getPvpRank } from "@/lib/gameData";
import { PROFESSIONS } from "@/lib/gameData";

const TABS = [
  { key: "vendeur", label: "🛒 Vendeurs", field: "cumul_ventes_or", getRank: getVendeurRank, unit: "💰" },
  { key: "contributeur", label: "📦 Contributeurs", field: "cumul_contributions_warehouse", getRank: getContributeurRank, unit: "ressources" },
  { key: "pvp", label: "⚔️ Militaire", field: "cumul_t5_envoyes", getRank: getPvpRank, unit: "attaques" },
  { key: "biome", label: "👹 Chasseurs", field: "biome_mastery", getRank: () => ({ icon: "👹", label: "" }), unit: "victoires" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

export default function PlayerRanking() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("vendeur");

  useEffect(() => {
    base44.entities.PlayerProfile.list("-cumul_ventes_or", 200).then(data => {
      setPlayers(data.filter(p => p.character_name));
      setLoading(false);
    });
  }, []);

  const tab = TABS.find(t => t.key === activeTab);
  const getFieldValue = (p) => {
    if (tab.key === "biome") {
      return Object.values(p.biome_mastery || {}).reduce((s, v) => s + (v || 0), 0);
    }
    return p[tab.field] || 0;
  };

  const sorted = [...players]
    .sort((a, b) => getFieldValue(b) - getFieldValue(a))
    .filter(p => getFieldValue(p) > 0)
    .slice(0, 20);

  return (
    <div className="space-y-3">
      {/* Tab bar */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 text-xs font-body py-1.5 px-2 rounded-md transition-colors ${
              activeTab === t.key
                ? "bg-card text-foreground shadow font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-center text-muted-foreground font-body text-sm py-8">Aucun joueur classé pour l'instant.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((p, idx) => {
            const value = getFieldValue(p);
            const rank = tab.getRank(value);
            const prof = PROFESSIONS[p.profession];
            return (
              <Card key={p.id} className={idx < 3 ? "border-amber-300 bg-amber-50/40 dark:bg-amber-900/10" : ""}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="text-xl w-7 text-center shrink-0">
                    {MEDALS[idx] || <span className="text-sm font-bold text-muted-foreground">#{idx + 1}</span>}
                  </div>
                  <div className="text-lg">{prof?.icon || "👤"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-semibold text-sm">{p.character_name}</span>
                      <span className="text-xs text-muted-foreground font-body">{p.profession}</span>
                    </div>
                    <div className="text-xs text-muted-foreground font-body">
                      {rank.icon} {rank.label}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm text-accent">{value.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground font-body">{tab.unit}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}