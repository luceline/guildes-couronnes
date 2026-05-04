/**
 * TargetCityModal.jsx : modale de sélection d'une ville cible.
 *
 * Utilisée par les items du chaudron qui demandent une cible :
 *   - Parchemin marchand (vol 20 or)
 *   - Étoile filante (vol 50 or)
 *   - Hibou messager (espionnage)
 *
 * Affiche la liste des villes joueurs (sauf celle du joueur), avec leur
 * trésorerie visible. Le joueur clique sur une ville pour confirmer.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";

export default function TargetCityModal({
  open,
  onClose,
  onConfirm,           // (selectedCity) => void
  itemIcon,
  itemName,
  description,         // texte du contexte ("Vous allez voler 20 or à...", etc.)
  excludeCityId,       // city_id à exclure (la ville du joueur)
  submitting = false,
}) {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSelectedCity(null);
      try {
        const all = await base44.entities.City.list();
        // Exclut bots et la ville du joueur
        const filtered = (all || [])
          .filter(c => !c.is_bot_city)
          .filter(c => c.id !== excludeCityId);
        if (!cancelled) setCities(filtered);
      } catch (e) {
        console.error("[TargetCityModal] load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, excludeCityId]);

  const handleConfirm = () => {
    if (!selectedCity) return;
    onConfirm(selectedCity);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && !o && onClose?.()}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <span className="text-2xl">{itemIcon}</span>
            <span>{itemName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <p className="text-xs italic text-muted-foreground font-body">
            {description}
          </p>

          {loading && (
            <div className="text-xs italic text-muted-foreground font-body text-center py-4">
              Chargement des villes...
            </div>
          )}

          {!loading && cities.length === 0 && (
            <div className="text-xs italic text-muted-foreground font-body text-center py-4">
              Aucune ville disponible.
            </div>
          )}

          {!loading && cities.length > 0 && (
            <div className="space-y-1.5">
              {cities.map(c => (
                <Card
                  key={c.id}
                  className={`cursor-pointer transition-all ${
                    selectedCity?.id === c.id
                      ? "border-2 border-purple-500 bg-purple-50"
                      : "border border-border hover:border-purple-300 hover:bg-muted/30"
                  }`}
                  onClick={() => setSelectedCity(c)}
                >
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-heading text-sm font-semibold">{c.name}</div>
                      <div className="text-xs text-muted-foreground font-body">
                        Niveau {c.level || 1} · Tier {c.tier || 1}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-heading text-amber-700">
                        {c.gold_treasury || 0} 💰
                      </div>
                      <div className="text-[10px] text-muted-foreground font-body">trésorerie</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="font-body"
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || !selectedCity}
            className="font-heading"
          >
            {submitting ? "En cours..." : selectedCity ? `Cibler ${selectedCity.name}` : "Sélectionnez une ville"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
