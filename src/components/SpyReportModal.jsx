/**
 * SpyReportModal.jsx : modale de révélation du rapport d'espionnage du hibou.
 *
 * Affiché après que le joueur a utilisé un Hibou messager et choisi une cible.
 * Révèle :
 *   - Trésorerie de la ville
 *   - Contenu de l'entrepôt
 *   - Statut du dôme de protection (actif oui/non, sans durée)
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ITEMS } from "@/lib/craftingData";

export default function SpyReportModal({ open, onClose, report }) {
  if (!report) return null;

  // Trier les items de l'entrepôt par tier puis par nom
  const warehouseItems = Object.entries(report.warehouse || {})
    .filter(([key, qty]) => qty > 0 && ITEMS[key])
    .map(([key, qty]) => ({ key, qty, def: ITEMS[key] }))
    .sort((a, b) => {
      const tierDiff = (a.def.tier || 1) - (b.def.tier || 1);
      if (tierDiff !== 0) return tierDiff;
      return (a.def.name || "").localeCompare(b.def.name || "");
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <span className="text-2xl">🦉</span>
            <span>Rapport d'espionnage</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <p className="text-xs italic text-muted-foreground font-body">
            Le hibou survole {report.cityName} sans bruit et observe...
          </p>

          {/* Trésorerie */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="text-xs font-body font-semibold text-amber-900 mb-1">💰 Trésorerie de la mairie</div>
            <div className="text-2xl font-heading text-amber-700">{report.gold_treasury} 💰</div>
          </div>

          {/* Statut dôme */}
          <div className={`border rounded-lg p-3 ${
            report.domeActive
              ? "bg-blue-50 border-blue-300"
              : "bg-stone-50 border-stone-300"
          }`}>
            <div className="text-xs font-body font-semibold mb-1">🛡️ Protection magique</div>
            <div className={`text-sm font-heading ${
              report.domeActive ? "text-blue-800" : "text-stone-700"
            }`}>
              {report.domeActive
                ? "✓ Un dôme protège la cité"
                : "✗ Aucun dôme actif"}
            </div>
          </div>

          {/* Entrepôt */}
          <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-xs font-body font-semibold mb-2">📦 Contenu de l'entrepôt</div>
            {warehouseItems.length === 0 ? (
              <div className="text-xs italic text-muted-foreground font-body">
                L'entrepôt est vide.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {warehouseItems.map(item => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-2 px-2 py-1 bg-muted/30 rounded text-xs font-body"
                  >
                    <span className="flex items-center gap-1 truncate">
                      <span>{item.def.icon}</span>
                      <span className="truncate">{item.def.name}</span>
                    </span>
                    <span className="font-semibold shrink-0">×{item.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-[10px] italic text-muted-foreground font-body text-center">
            Un message anonyme a été déposé dans la taverne de {report.cityName} pour les avertir...
          </p>
        </div>

        <DialogFooter className="mt-2">
          <Button onClick={onClose} className="w-full font-heading">
            Fermer le rapport
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
