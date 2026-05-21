/**
 * src/components/BiomeReturnPanel.jsx
 *
 * Panneau "Écurie" affiché dans le drawer Écurie en mode menu portrait,
 * quand le joueur est dans un biome. Affiche un bouton pour rentrer à la
 * ville d'origine avec une dialog de confirmation.
 *
 * Reprend la logique de retour de BiomeView.jsx (16/05/2026).
 */
import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { applyRandomActionCost } from "@/lib/gameData";
import { BIOMES, getBiomeName } from "@/lib/biomes";

const TRAVEL_DURATION_MINUTES = 2;

export default function BiomeReturnPanel({ profile, city, onRefresh, biomeKey }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [returning, setReturning] = useState(false);

  const homeCityName = city?.name || "votre ville";

  const handleConfirm = async () => {
    if (returning) return;
    setReturning(true);
    try {
      // Coût d'1 PA (faim ou énergie) pour le voyage retour
      const costResult = applyRandomActionCost(profile, 1);
      if (!costResult.ok) {
        toast.error(costResult.errorMessage);
        setReturning(false);
        return;
      }

      const arrivalTime = new Date(Date.now() + TRAVEL_DURATION_MINUTES * 60 * 1000).toISOString();
      const destinationId = profile.home_city_id || profile.city_id;

      if (!destinationId) {
        toast.error("Impossible de déterminer votre ville d'origine.");
        setReturning(false);
        return;
      }

      await base44.entities.PlayerProfile.update(profile.id, {
        is_traveling: true,
        travel_destination_id: destinationId,
        travel_arrival_time: arrivalTime,
        hunger: costResult.newHunger,
        fatigue: costResult.newFatigue,
      });
      toast.success(`🐴 En route vers ${homeCityName} (${TRAVEL_DURATION_MINUTES} min)`);
      setConfirmOpen(false);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Erreur retour ville:", e);
      toast.error("Impossible de retourner à la ville pour le moment.");
    } finally {
      setReturning(false);
    }
  };

  return (
    <div className="py-4">
      <div className="text-center mb-6">
        <div className="text-5xl mb-3">🐴</div>
        <h3 className="font-heading text-lg font-bold mb-2">Écurie</h3>
        <p className="text-sm text-muted-foreground">
          Vous êtes en exploration {biomeKey && BIOMES[biomeKey] ? `(${getBiomeName(biomeKey)})` : ""}.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Voulez-vous retourner à <strong>{homeCityName}</strong> ?
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Voyage de {TRAVEL_DURATION_MINUTES} min · coûte 1 PA (faim ou fatigue)
        </p>
      </div>

      <button
        onClick={() => setConfirmOpen(true)}
        disabled={returning}
        className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        🏰 Rentrer à {homeCityName}
      </button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retour à {homeCityName} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous allez quitter ce biome et voyager pendant {TRAVEL_DURATION_MINUTES} minutes.
              Ce voyage coûte 1 PA (faim ou fatigue).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={returning}>Rester ici</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={returning}>
              {returning ? "En route..." : "Oui, voyager"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
