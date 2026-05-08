// src/components/BuildingInfoModal.jsx
//
// Modale réutilisable affichant les infos d'un bâtiment construit dans la
// ville (mine, scierie, fonderie, hospice, etc.). Ouverte au clic sur un
// bâtiment depuis la VillageView quand ce bâtiment n'a pas de page dédiée.
//
// Affiche :
//   - Nom, icône, catégorie
//   - Niveau actuel
//   - Effet du bâtiment
//   - Coût d'entretien
//   - Bouton "Gérer dans l'onglet Bâtiments" (ouvre la modale Bâtiments)

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BUILDING_TYPES, BUILDING_CATEGORIES } from "@/lib/gameData";

export default function BuildingInfoModal({
  buildingType,        // string : key dans BUILDING_TYPES (ex: "mine")
  city,                // city object pour récupérer le building construit
  open,                // bool : modale ouverte ?
  onOpenChange,        // fonction : appelée quand la modale se ferme
  onManageClick,       // fonction : appelée quand l'utilisateur veut gérer (= ouvrir onglet bâtiments)
}) {
  // Si pas de buildingType, on ne rend rien
  if (!buildingType) return null;

  const buildingDef = BUILDING_TYPES[buildingType];
  if (!buildingDef) {
    // Building inconnu, on rend une modale d'erreur soft
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bâtiment inconnu</DialogTitle>
            <DialogDescription>
              Aucune information disponible pour « {buildingType} ».
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  // Récupérer le bâtiment construit depuis city.buildings (si présent)
  const builtInstance = (city?.buildings || []).find(b => b.building_type === buildingType);
  const level = builtInstance?.level || 0;

  const categoryDef = BUILDING_CATEGORIES?.[buildingDef.category];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="text-2xl">{buildingDef.icon}</span>
            <span>{buildingDef.name}</span>
            {level > 0 && (
              <Badge variant="outline" className="ml-auto bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700">
                Niveau {level}
              </Badge>
            )}
          </DialogTitle>
          {categoryDef && (
            <DialogDescription className="flex items-center gap-1 text-xs">
              {categoryDef.icon && <span>{categoryDef.icon}</span>}
              <span>{categoryDef.name || buildingDef.category}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* Effet du bâtiment */}
          {buildingDef.effect && (
            <div className="text-sm bg-muted/50 border border-border rounded-lg p-3">
              <div className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wide">
                Effet
              </div>
              <p className="text-foreground leading-relaxed">{buildingDef.effect}</p>
            </div>
          )}

          {/* Profession ciblée */}
          {buildingDef.targetProfession && (
            <div className="text-sm flex items-center justify-between border border-border rounded-lg p-3">
              <span className="text-muted-foreground">Profession bonifiée</span>
              <span className="font-semibold">{buildingDef.targetProfession}</span>
            </div>
          )}

          {/* Coût de construction (si pas encore construit) */}
          {level === 0 && buildingDef.costBase && (
            <div className="text-sm bg-muted/30 border border-border rounded-lg p-3">
              <div className="text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wide">
                Coût de construction
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(buildingDef.costBase).map(([key, qty]) => (
                  <Badge key={key} variant="secondary" className="text-xs">
                    {qty} {key.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Coût d'entretien quotidien */}
          {buildingDef.maintenance && Object.keys(buildingDef.maintenance).length > 0 && (
            <div className="text-sm bg-muted/30 border border-border rounded-lg p-3">
              <div className="text-xs text-muted-foreground font-semibold mb-2 uppercase tracking-wide">
                Entretien quotidien
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(buildingDef.maintenance).map(([key, qty]) => (
                  <Badge key={key} variant="outline" className="text-xs">
                    {qty} {key.replace(/_/g, " ")} / jour
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* État actuel */}
          {level === 0 ? (
            <div className="text-xs text-muted-foreground italic text-center py-2">
              Ce bâtiment n'est pas construit dans la ville.
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic text-center py-2">
              Construit le {builtInstance?.built_date || "—"}.
            </div>
          )}

          {/* Bouton de gestion */}
          {onManageClick && (
            <Button
              className="w-full"
              variant="default"
              onClick={() => {
                onOpenChange?.(false);
                onManageClick();
              }}
            >
              {level === 0 ? "Construire ce bâtiment" : "Gérer / Améliorer"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
