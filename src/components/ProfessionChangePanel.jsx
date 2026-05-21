import { PROFESSION_CHANGE_COST } from "../lib/gameData";
import { useState, useEffect, useMemo } from "react";
import { base44, pb } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PROFESSIONS } from "../lib/gameData";
// 17/05/2026 — Scoring de pénurie professionnelle (basé joueurs + listings T1).
// Aide le joueur à choisir un métier utile à la communauté plutôt que saturé.
// 18/05/2026 — Phase 3 : "Prime au pionnier" — pivoter vers un métier 🔥 est
// GRATUIT (le serveur valide et applique). Sinon flow normal (20 or via serveur).
import { computeProfessionScores } from "../lib/professionScoring";

export default function ProfessionChangePanel({ profile, city, onRefresh }) {
  const [changing, setChanging] = useState(false);
  const [chosen, setChosen] = useState("");
  const [players, setPlayers] = useState([]);
  const [listings, setListings] = useState([]);
  const [loadingScores, setLoadingScores] = useState(true);

  // Charge les données nécessaires au scoring de pénurie au montage.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [allPlayers, allListings] = await Promise.all([
        base44.entities.PlayerProfile.list().catch(() => []),
        base44.entities.MarketListing.filter({ status: "active" }, "", 500).catch(() => []),
      ]);
      if (cancelled) return;
      setPlayers(allPlayers);
      setListings(allListings);
      setLoadingScores(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Calcul des scores de pénurie (depuis données chargées).
  const professionScores = useMemo(
    () => computeProfessionScores(players, listings),
    [players, listings]
  );

  // Métier en top-1 (🔥 Très demandé) = prime au pionnier active.
  // Le client le pré-affiche, mais l'autorité finale reste serveur.
  const topProfKey = useMemo(() => {
    const entries = Object.entries(professionScores);
    if (entries.length === 0) return null;
    return entries.sort(([, a], [, b]) => b.score - a.score)[0][0];
  }, [professionScores]);

  // Métier choisi a-t-il la prime ?
  const chosenIsPrime = chosen && chosen === topProfKey;

  const handleChange = async () => {
    if (!chosen || chosen === profile.profession) {
      toast.error("Choisissez un métier différent du vôtre.");
      return;
    }

    setChanging(true);
    try {
      const res = await pb.send('/api/profession/change', {
        method: 'POST',
        body: JSON.stringify({ profession: chosen }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (res?.was_free) {
        toast.success(`⭐ Prime au pionnier reçue ! Vous êtes maintenant ${chosen} (gratuit).`);
      } else {
        toast.success(`✅ Métier changé ! Vous êtes maintenant ${chosen} (-${res?.gold_charged ?? PROFESSION_CHANGE_COST} 💰).`);
      }
      setChosen("");
      onRefresh?.();
    } catch (err) {
      // L'API renvoie l'erreur dans err.response.data
      const data = err?.response?.data;
      const msg = data?.error || err?.message || 'Erreur changement métier.';
      // Cas 402 : pas assez d'or → message clair
      if (data?.error === "pas assez d'or") {
        toast.error(`Il vous manque ${data.required - data.current} 💰 pour changer de métier.`);
      } else {
        toast.error(msg);
      }
    } finally {
      setChanging(false);
    }
  };

  // Liste triée par priorité du badge (Très demandé en premier).
  // On exclut la profession actuelle (on ne peut pas la "rechoisir").
  const sortedProfessions = Object.entries(PROFESSIONS)
    .filter(([key]) => key !== profile.profession)
    .sort(([keyA], [keyB]) => {
      const pA = professionScores[keyA]?.badge?.priority ?? 99;
      const pB = professionScores[keyB]?.badge?.priority ?? 99;
      return pA - pB;
    });

  const canAfford = (profile.gold || 0) >= PROFESSION_CHANGE_COST;
  // Si la prime est active sur le choix, le bouton n'a pas besoin d'or
  const buttonEnabled = chosen && !changing && !loadingScores && (chosenIsPrime || canAfford);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-xs font-body text-muted-foreground">
        <span className="text-lg shrink-0">🏛️</span>
        <p>
          <strong>Changer de métier</strong> coûte <strong>{PROFESSION_CHANGE_COST} 💰</strong> (l'or est détruit).
          Les métiers <strong>en pénurie</strong> sont mis en avant : ceux dont le royaume manque actuellement,
          en croisant le nombre d'artisans et le stock disponible sur les marchés.
        </p>
      </div>

      {/* 18/05/2026 — Bandeau "Prime au pionnier" si un métier est 🔥 Très demandé.
          Le serveur autorise le changement gratuit pour ce métier précis. */}
      {!loadingScores && topProfKey && topProfKey !== profile.profession && (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 px-3 py-2.5 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-base">⭐</span>
            <span className="font-heading font-semibold text-sm text-amber-900">
              Prime au pionnier
            </span>
          </div>
          <p className="text-xs font-body text-amber-800">
            Le royaume manque de <strong>{topProfKey}</strong>. Pivoter vers ce métier est <strong>gratuit</strong> aujourd'hui.
          </p>
        </div>
      )}

      {loadingScores ? (
        <p className="text-xs text-muted-foreground italic">Évaluation des besoins du royaume…</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {sortedProfessions.map(([key, val]) => {
            const scoring = professionScores[key];
            const badge = scoring?.badge || { label: "—", color: "bg-muted text-muted-foreground border-border" };
            const isSelected = chosen === key;
            const isPrimary = key === topProfKey;  // métier 🔥 = prime active
            return (
              <button
                key={key}
                onClick={() => setChosen(key)}
                className={`w-full text-left rounded-lg border p-3 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : isPrimary
                    ? "border-amber-300 hover:border-amber-500 bg-amber-50/40"
                    : "border-border hover:border-primary/40 bg-card"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl shrink-0">{val.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-semibold text-sm">{key}</span>
                      <Badge className={`text-xs border ${badge.color}`}>{badge.label}</Badge>
                      {isPrimary && (
                        <Badge className="text-xs border bg-amber-100 text-amber-900 border-amber-300 font-heading">
                          ⭐ Gratuit
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-body mt-0.5 line-clamp-2">{val.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <Button
          size="sm"
          className="font-heading"
          disabled={!buttonEnabled}
          onClick={handleChange}
        >
          {changing
            ? "…"
            : chosen
              ? chosenIsPrime
                ? `⭐ Confirmer : ${chosen} (gratuit)`
                : `Confirmer : ${chosen} (${PROFESSION_CHANGE_COST} 💰)`
              : `Choisir un métier`
          }
        </Button>
        {chosen && !chosenIsPrime && !canAfford && (
          <span className="text-xs text-red-600 font-body">
            Il vous manque {PROFESSION_CHANGE_COST - (profile.gold || 0)}💰
          </span>
        )}
      </div>

      <p className="text-xs text-orange-600 font-body pt-1">
        ⚠️ Votre progression et vos recettes actuelles seront liées au nouveau métier.
      </p>
    </div>
  );
}
