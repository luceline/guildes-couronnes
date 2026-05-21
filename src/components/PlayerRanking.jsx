import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { getVendeurRank, getContributeurRank, getCouronnesRank } from "@/lib/gameData";
import { PROFESSIONS } from "@/lib/gameData";
import { getLevelFromXP } from "@/lib/playerLevelSystem";
import { getTimeUntilMonthlyReset, MONTHLY_REWARDS_GOLD } from "@/lib/monthlyRanking";

// 17/05/2026 — Refonte classements : retiré "pvp"/"biome", ajouté "couronnes".
// 18/05/2026 — Phase 5 : bascule TOUS les onglets sur compteurs mensuels (_mois).
//   Toutes les catégories sont remises à zéro le 1er à 00:05 UTC.
//   Top 3 reçoit 100/50/20 or via cron PB (monthly_rewards.pb.js).
//   "Niveau" devient "XP du mois" (XP gagnés sur le mois, pas le niveau atteint).
const TABS = [
  { key: "niveau",        label: "⭐ XP du mois",      field: "cumul_xp_mois",                       getRank: () => ({ icon: "", label: "" }), unit: "XP" },
  { key: "vendeur",       label: "🛒 Vendeurs",        field: "cumul_ventes_or_mois",                getRank: getVendeurRank,      unit: "💰" },
  { key: "contributeur",  label: "📦 Contributeurs",  field: "cumul_contributions_warehouse_mois",  getRank: getContributeurRank, unit: "ressources" },
  { key: "couronnes",     label: "👑 Couronnes",      field: "cumul_couronnes_mois",                getRank: getCouronnesRank,    unit: "pts" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

export default function PlayerRanking() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("vendeur");
  // 18/05/2026 — Décompte avant remise à zéro. Re-calculé à chaque rendu, et
  // rafraîchi toutes les minutes pour que les heures s'actualisent.
  const [, setNow] = useState(Date.now());

  useEffect(() => {
    base44.entities.PlayerProfile.list("-cumul_ventes_or_mois", 200).then(data => {
      setPlayers(data.filter(p => p.character_name));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);  // 1 min
    return () => clearInterval(id);
  }, []);

  const tab = TABS.find(t => t.key === activeTab);
  const getFieldValue = (p) => p[tab.field] || 0;

  // Tri : valeur du tab desc. Tie-break par all-time correspondant
  // (ventes_or pour vendeur, contributions_warehouse pour contributeur,
  // couronnes_total pour couronnes, player_xp_total pour niveau).
  const TIE_BREAK_FIELD = {
    niveau:       "player_xp_total",
    vendeur:      "cumul_ventes_or",
    contributeur: "cumul_contributions_warehouse",
    couronnes:    "cumul_couronnes_total",
  };
  const tieField = TIE_BREAK_FIELD[tab.key];

  const sorted = [...players]
    .sort((a, b) => {
      const diff = getFieldValue(b) - getFieldValue(a);
      if (diff !== 0) return diff;
      return (b[tieField] || 0) - (a[tieField] || 0);
    })
    .filter(p => getFieldValue(p) > 0)
    .slice(0, 20);

  // Décompte avant le 1er à 00:05 UTC
  const countdown = getTimeUntilMonthlyReset();

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

      {/* 18/05/2026 — Bandeau "Récompenses + décompte" sur chaque onglet.
          Affichage cohérent : top 3 reçoit 100/50/20 or le 1er à 00:05 UTC,
          puis tous les compteurs _mois sont remis à zéro. */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs font-body text-amber-900">
          <span className="font-heading font-semibold">🏆 Récompenses :</span>{" "}
          🥇{MONTHLY_REWARDS_GOLD[0]}💰{" "}
          🥈{MONTHLY_REWARDS_GOLD[1]}💰{" "}
          🥉{MONTHLY_REWARDS_GOLD[2]}💰
        </div>
        <div className="text-xs font-body text-amber-800 font-semibold">
          ⏳ {countdown.label}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-center text-muted-foreground font-body text-sm py-8">
          Aucun joueur classé ce mois-ci. Sois le premier à marquer des points !
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((p, idx) => {
            const value = getFieldValue(p);
            const rank = tab.getRank(value);
            const prof = PROFESSIONS[p.profession];
            const isPodium = idx < 3;
            const rewardAmount = isPodium ? MONTHLY_REWARDS_GOLD[idx] : null;
            return (
              <Card key={p.id} className={isPodium ? "border-amber-300 bg-amber-50/40 dark:bg-amber-900/10" : ""}>
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
                      {rank.icon ? `${rank.icon} ${rank.label}` : `\u00A0`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm text-accent">{value.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground font-body">{tab.unit}</div>
                    {/* Pastille or pour le top 3 : "100💰 si arrêt aujourd'hui" */}
                    {rewardAmount !== null && (
                      <div className="mt-0.5 inline-block rounded-full bg-amber-200 border border-amber-400 px-1.5 py-0.5 text-xs font-heading font-bold text-amber-900">
                        +{rewardAmount}💰
                      </div>
                    )}
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
