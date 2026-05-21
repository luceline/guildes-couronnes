// src/pages/PavillonPage.jsx
//
// Pavillon de la Fortune (Tombola du Marchand)
// ──────────────────────────────────────────────────────────────────────
// Drawer ouvert au clic sur le sprite "construction_pavillon_fortune" en (17,7).
// Contenu : cagnotte actuelle, compte à rebours, stats du cycle, statut perso,
// historique 5 derniers tirages.
//
// Pas de bouton d'achat ici : les billets s'achètent sur le marché ou via l'atelier
// d'un Marchand (cf. Market.jsx + AtelierCommande.jsx, refonte v2 du 10/05/2026).
//
// Le drawer déclenche aussi un "filet de sécurité" frontend : si le cycle est
// expiré et qu'aucun tirage n'a été enregistré (cf. tombola_state.last_tirage_date),
// le drawer tente de déclencher le tirage côté frontend (avec lock anti-race).
// Cas normal : le cron VPS server_reset_v2 fait le tirage à 06:00 UTC.

import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlayerData } from "@/lib/usePlayerData";
import { runTombolaTirageIfDue } from "@/lib/tombolaClient";

// Format "Xj Yh Zmin" pour le compte à rebours
function formatCountdown(ms) {
  if (ms <= 0) return "Tirage imminent…";
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}j ${hours}h ${mins}min`;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function PavillonPage() {
  const { profile, loading: profileLoading } = usePlayerData();
  const [state, setState] = useState(null);          // entrée unique tombola_state
  const [myParticipation, setMyParticipation] = useState(null);  // participation du joueur sur ce cycle
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [history, setHistory] = useState([]);        // 5 derniers tirages
  const [cities, setCities] = useState([]);          // 17/05/2026 — pour afficher contributions tombola par ville (1% trésorerie/jour)
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [showHistory, setShowHistory] = useState(false);
  const [showContributions, setShowContributions] = useState(false);

  // ── Charger l'état complet (state + my participation + history + cities) ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1. État global de la tombola
      const states = await base44.entities.TombolaState.list().catch(() => []);
      const tombolaState = states[0] || null;
      setState(tombolaState);

      // 2. Filet frontend : si le cycle est expiré et qu'aucun tirage n'a eu
      // lieu, tenter de déclencher le tirage. Le helper gère le lock anti-race.
      if (tombolaState && profile?.user_email) {
        await runTombolaTirageIfDue(tombolaState, profile);
      }

      // 3. Ma participation sur le cycle actuel
      if (tombolaState && profile?.user_email) {
        const cycleId = tombolaState.cycle_debut?.split("T")[0] || "";
        const parts = await base44.entities.TombolaParticipations.filter({
          cycle_id: cycleId,
          player_email: profile.user_email,
        }).catch(() => []);
        setMyParticipation(parts[0] || null);

        // Total participants distincts du cycle
        const allParts = await base44.entities.TombolaParticipations.filter({
          cycle_id: cycleId,
        }).catch(() => []);
        setTotalParticipants(allParts.length);
      }

      // 4. Historique : 5 derniers tirages
      // 17/05/2026 (fix) : signature base44Client.list est (sort, limit), pas
      // un objet { sort, limit }. L'ancien appel échouait silencieusement
      // (avalé par .catch(() => [])) et l'historique restait vide alors que
      // la BDD contenait bien des tirages.
      const allHistory = await base44.entities.TombolaHistory
        .list("-date_tirage", 5)
        .catch(() => []);
      setHistory(allHistory.slice(0, 5));

      // 5. Villes : pour calculer les contributions quotidiennes au pot (1% trésorerie)
      const allCities = await base44.entities.City.list().catch(() => []);
      // On exclut les villes "bot" et celles à trésorerie nulle pour clarté UX
      setCities((allCities || []).filter(c => !c.is_bot_city));
    } catch (e) {
      console.error("[PavillonPage] loadAll error", e);
    } finally {
      setLoading(false);
    }
  }, [profile?.user_email]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Tick chaque minute pour le compte à rebours
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  if (profileLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="p-6 text-center">
        <p className="font-body text-muted-foreground">
          🎰 La tombola n'a pas encore été initialisée par les Marchands de la Couronne.
        </p>
      </div>
    );
  }

  // ── Stats dérivées ──
  const finPrevue = state.cycle_fin_prevue ? new Date(state.cycle_fin_prevue).getTime() : 0;
  const remainingMs = Math.max(0, finPrevue - now);
  const cagnotte = state.cagnotte_actuelle || 0;
  const totalBillets = state.billets_vendus_total || 0;
  const myBillets = myParticipation?.billets_count || 0;
  const myShare = totalBillets > 0 ? ((myBillets / totalBillets) * 100).toFixed(1) : "0";

  // Plafond /jour : lire le compteur du jour (17/05/2026 : passé de 5 à 20)
  const todayStr = new Date().toISOString().split("T")[0];
  const billetsToday = (myParticipation?.billets_today || {})[todayStr] || 0;
  const remainingToday = Math.max(0, 20 - billetsToday);

  // 17/05/2026 — Contributions tombola : 1% de la trésorerie de chaque ville
  // est ajouté à la cagnotte chaque jour (cron VPS). Cf. tombola.js côté serveur.
  const cityContributions = cities
    .map(c => ({
      id: c.id,
      name: c.name,
      treasury: c.gold_treasury || 0,
      contribution: Math.floor((c.gold_treasury || 0) * 0.01),
    }))
    .filter(c => c.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution);
  const totalContributionPerDay = cityContributions.reduce((s, c) => s + c.contribution, 0);

  return (
    <div className="space-y-4 p-1">
      {/* ── Cagnotte (gros chiffre) ── */}
      <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50">
        <CardContent className="pt-6 pb-4 text-center">
          <p className="font-body text-xs text-amber-700 uppercase tracking-wider mb-1">
            Cagnotte du cycle
          </p>
          <p className="font-heading text-4xl font-bold text-amber-900">
            💰 {cagnotte} or
          </p>
          <p className="font-body text-xs text-amber-700 mt-2">
            ⏳ Prochain tirage dans : <strong>{formatCountdown(remainingMs)}</strong>
          </p>
          <p className="font-body text-[11px] text-muted-foreground mt-1">
            ({formatDateTime(state.cycle_fin_prevue)})
          </p>
        </CardContent>
      </Card>

      {/* ── Contributions des villes (17/05/2026) ──
          Chaque jour, 1% de la trésorerie de chaque ville est versé à la cagnotte
          par le cron VPS server_reset_v2/tombola.js. Cette section affiche la
          répartition attendue au prochain reset (06:00 UTC). */}
      {cityContributions.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader
            className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setShowContributions(!showContributions)}
          >
            <CardTitle className="font-heading text-sm flex items-center justify-between">
              <span>🏛️ Contributions des villes</span>
              <span className="text-xs font-body font-normal">
                {totalContributionPerDay}💰/jour
                <span className="ml-1 text-muted-foreground">{showContributions ? "▼" : "▶"}</span>
              </span>
            </CardTitle>
          </CardHeader>
          {showContributions && (
            <CardContent className="space-y-1 text-xs font-body pt-0">
              <p className="text-muted-foreground italic mb-2">
                Chaque aurore, 1% de la trésorerie de chaque cité alimente le pot du Marchand.
              </p>
              {cityContributions.map(c => (
                <div key={c.id} className="flex justify-between items-center py-0.5">
                  <span className="text-foreground">📍 {c.name}</span>
                  <span className="text-muted-foreground">
                    trésorerie {c.treasury}💰 →
                    <strong className="text-amber-700 ml-1">+{c.contribution}💰/jour</strong>
                  </span>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground italic mt-2 pt-2 border-t border-border">
                Soit <strong>{totalContributionPerDay * 3}💰</strong> attendus sur le cycle de 3 jours,
                avant les billets des joueurs.
              </p>
            </CardContent>
          )}
        </Card>
      )}

      {/* ── Stats du cycle ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-sm">📊 Cycle en cours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm font-body">
          <div className="flex justify-between">
            <span className="text-muted-foreground">🎫 Billets vendus</span>
            <strong>{totalBillets}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">👥 Participants distincts</span>
            <strong>{totalParticipants}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">📅 Cycle ouvert le</span>
            <strong>{formatDateTime(state.cycle_debut)}</strong>
          </div>
        </CardContent>
      </Card>

      {/* ── Statut personnel ── */}
      <Card className={myBillets > 0 ? "border-emerald-300 bg-emerald-50/40" : ""}>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-sm">🪙 Votre participation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm font-body">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Billets ce cycle</span>
            <strong>{myBillets}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Billets aujourd'hui</span>
            <strong>{billetsToday} / 20</strong>
            {remainingToday === 0 && (
              <Badge variant="outline" className="ml-2 text-[10px] text-red-600 border-red-300">
                Plafond atteint
              </Badge>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Votre part de la cagnotte</span>
            <strong className="text-amber-700">{myShare}%</strong>
          </div>
          {myBillets === 0 && (
            <p className="text-xs text-muted-foreground italic mt-2">
              💡 Achetez des billets sur le marché ou via l'atelier d'un Marchand (3💰 le billet,
              max 20/jour, 60 sur le cycle de 3 jours).
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Historique des tirages ── */}
      <Card>
        <CardHeader
          className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setShowHistory(!showHistory)}
        >
          <CardTitle className="font-heading text-sm flex items-center justify-between">
            <span>🏆 Derniers tirages</span>
            <span className="text-xs text-muted-foreground">{showHistory ? "▼" : "▶"}</span>
          </CardTitle>
        </CardHeader>
        {showHistory && (
          <CardContent className="text-xs font-body space-y-2">
            {history.length === 0 ? (
              <p className="text-muted-foreground italic">Aucun tirage encore enregistré.</p>
            ) : (
              history.map(h => (
                <div key={h.id} className="border-l-2 border-amber-300 pl-2 py-1">
                  <div className="font-semibold text-amber-900">
                    {formatDateTime(h.date_tirage)} · {h.cagnotte_totale}💰 distribués
                  </div>
                  <div className="text-muted-foreground mt-0.5 space-y-0.5">
                    {h.gagnant_1_name && (
                      <div>🥇 <strong>{h.gagnant_1_name}</strong> : {h.montant_1}💰</div>
                    )}
                    {h.gagnant_2_name && (
                      <div>🥈 <strong>{h.gagnant_2_name}</strong> : {h.montant_2}💰</div>
                    )}
                    {h.gagnant_3_name && (
                      <div>🥉 <strong>{h.gagnant_3_name}</strong> : {h.montant_3}💰</div>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {h.billets_vendus} billet(s) · {h.participants_count} participant(s)
                  </div>
                </div>
              ))
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Mention thématique ── */}
      <p className="text-center text-xs text-muted-foreground italic font-body py-2">
        🎩 Animé par les Marchands de la Couronne
      </p>
    </div>
  );
}
