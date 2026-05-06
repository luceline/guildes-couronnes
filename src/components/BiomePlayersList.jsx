/**
 * BiomePlayersList.jsx : liste des joueurs présents dans le biome courant
 *
 * Affiche les autres joueurs (current_biome === biomeKey) avec :
 *   - Leur nom + profession
 *   - Un bouton "Défier" si le joueur courant est aussi en biome (sameBiome)
 *
 * Le combat PvP en biome est géré par ChallengeForm avec context.biome = biomeKey.
 *
 * Mai 2026 : ajout en complément de la refonte biomes égalitaires.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sword } from "lucide-react";
import { canChallenge } from "@/lib/combatPvP";
import { isPlayerKO } from "@/lib/gameData";
import ChallengeForm from "./ChallengeForm";

export default function BiomePlayersList({ profile, biomeKey, biomeInfo, onRefresh }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [challengeTarget, setChallengeTarget] = useState(null);
  const [todayChallenges, setTodayChallenges] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [allPresent, attackerChallenges] = await Promise.all([
          base44.entities.PlayerProfile.filter({ current_biome: biomeKey }, "character_name", 50),
          base44.entities.CombatChallenge.filter({ attacker_email: profile.user_email }, "-created_date", 50),
        ]);
        if (cancelled) return;
        // Exclure le joueur courant
        const others = (allPresent || []).filter(p => p.id !== profile.id);
        setPlayers(others);
        // Conserver les défis du jour pour limiter les attaques répétées
        const today = new Date().toISOString().split("T")[0];
        setTodayChallenges(
          (attackerChallenges || []).filter(c => (c.created_date || "").startsWith(today))
        );
      } catch (e) {
        console.warn("[BiomePlayersList] load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [biomeKey, profile?.id, profile?.user_email]);

  const handleChallenge = (target) => {
    const ctx = { city_id: null, biome: biomeKey };
    const check = canChallenge(profile, target, todayChallenges, ctx);
    if (!check.ok) {
      // Pas de toast ici : ChallengeForm fera sa propre validation et affichera le message
    }
    setChallengeTarget(target);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-4 text-sm text-muted-foreground italic">
          Le {biomeInfo?.short || "biome"} est silencieux...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="pt-4 space-y-2">
          <h3 className="font-heading font-semibold text-base flex items-center gap-2">
            <span className="text-xl">{biomeInfo?.icon || "🌍"}</span>
            Présents dans ce biome
            <span className="text-xs text-muted-foreground font-body ml-auto">
              {players.length} joueur{players.length > 1 ? "s" : ""}
            </span>
          </h3>

          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body italic">
              Vous êtes seul ici. Le {biomeInfo?.short?.toLowerCase() || "biome"} ne livre ses secrets qu'à ceux qui le foulent.
            </p>
          ) : (
            <div className="space-y-2">
              {players.map(p => {
                const ko = isPlayerKO(p);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-heading font-semibold text-sm truncate">
                        {p.character_name}
                        {ko && <span className="ml-2 text-xs text-red-600">(KO)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground font-body truncate">
                        {p.profession || "Aventurier"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="font-heading shrink-0"
                      disabled={ko}
                      onClick={() => handleChallenge(p)}
                    >
                      <Sword className="h-3.5 w-3.5 mr-1" />
                      Défier
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal défi (réutilise ChallengeForm avec contexte biome) */}
      {challengeTarget && (
        <ChallengeForm
          attacker={profile}
          target={challengeTarget}
          city={null}
          context={{ city_id: null, biome: biomeKey }}
          onClose={() => setChallengeTarget(null)}
          onCreated={() => {
            setChallengeTarget(null);
            onRefresh?.();
          }}
        />
      )}
    </>
  );
}
