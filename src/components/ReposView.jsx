/**
 * ReposView : vue simplifiée affichée quand le joueur séjourne à Repos-sur-Mer.
 *
 * 13/05/2026 — Mode "repos" remplaçant le mode vacances par flag.
 *
 * Le joueur a voyagé volontairement vers cette ville (50 or, 10 min). À
 * l'arrivée, l'UI rend cette vue extrêmement épurée : aucun panneau d'action,
 * juste l'ambiance narrative et un bouton de retour gratuit vers home_city.
 *
 * Côté serveur, le joueur est exempté d'impôts, de génération de quêtes et
 * d'intérêts dépôts/prêts tant que sa city_id pointe sur une bot_city (cf.
 * server/players.js).
 *
 * Le bouton retour déclenche un voyage standard (gratuit) qui dure 10 min.
 * Cohérent avec le pacing du jeu : on ne téléporte pas, on revient en voyage.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { REPOS_TRAVEL_DURATION_MIN } from "@/lib/repos";

export default function ReposView({ profile, onRefresh }) {
  const [returning, setReturning] = useState(false);

  // Nom de la home_city pour l'affichage. Si pour une raison X la home_city
  // n'est plus accessible (rare), on affiche "votre ville" en fallback.
  const [homeName, setHomeName] = useState("votre ville");

  // Fetch lazy du nom de la home_city une fois au montage.
  useEffect(() => {
    if (!profile?.home_city_id) return;
    base44.entities.City.get(profile.home_city_id)
      .then(c => { if (c?.name) setHomeName(c.name); })
      .catch(() => {});
  }, [profile?.home_city_id]);

  async function handleReturn() {
    if (returning) return;
    if (!profile?.home_city_id) {
      toast.error("Aucune ville d'origine définie.");
      return;
    }

    setReturning(true);
    try {
      const arrivalTime = new Date(Date.now() + REPOS_TRAVEL_DURATION_MIN * 60 * 1000).toISOString();
      await base44.entities.PlayerProfile.update(profile.id, {
        is_traveling: true,
        travel_destination_id: profile.home_city_id,
        travel_arrival_time: arrivalTime,
      });
      toast.success(`Vous reprenez la route. Arrivée dans ${REPOS_TRAVEL_DURATION_MIN} minutes.`);
      if (onRefresh) await onRefresh();
    } catch (e) {
      toast.error("Impossible de partir. Réessayez.");
      console.error("ReposView.handleReturn:", e);
      setReturning(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
        <CardContent className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <div className="text-6xl">🏖️</div>
            <h1 className="font-display text-2xl">Repos-sur-Mer</h1>
            <p className="text-sm text-muted-foreground italic">
              Le vent du large caresse les drapeaux. Les mouettes tournoient au-dessus du port.
            </p>
          </div>

          <div className="space-y-3 font-body text-sm text-foreground/80">
            <p>
              Vous vous êtes éloigné du tumulte du royaume. Ici, pas de marché qui s'agite,
              pas d'atelier qui fume, pas d'huissier qui réclame son dû.
            </p>
            <p>
              Vous reposez l'âme et le corps. Vos terres et votre maison restent intactes,
              gardées par ceux que vous y avez laissés.
            </p>
            <p className="text-xs text-muted-foreground">
              Tant que vous êtes ici, vous ne participez plus à l'économie : aucun impôt,
              aucun loyer, aucune quête générée. Mais aucun revenu non plus.
            </p>
          </div>

          <div className="pt-4 border-t border-blue-200">
            <Button
              onClick={handleReturn}
              disabled={returning || profile.is_traveling}
              className="w-full"
              size="lg"
            >
              {returning || profile.is_traveling
                ? "🐴 En route..."
                : `🏰 Retourner à ${homeName} (gratuit, ${REPOS_TRAVEL_DURATION_MIN} min)`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
