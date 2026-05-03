import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { getLevelFromXP, getPlayerLevelInfo } from "@/lib/playerLevelSystem";
import { RARE_RESOURCES, XP_PER_RARE_RESOURCE } from "@/lib/rareResources";

// RARE_RESOURCES retiré : utiliser la source de vérité @/lib/rareResources.
// Voir le commentaire dans InventoryPanel.jsx pour le contexte du bug fixé.

export default function RareResourceActivator({ profile, onProfileUpdate }) {
  const [selectedResource, setSelectedResource] = useState(null);
  const [loading, setLoading] = useState(false);

  // Trouver les ressources rares dans l'inventaire
  const rareResources = profile.inventory?.filter(item => RARE_RESOURCES[item.item_key] && item.quantity > 0) || [];

  const handleActivate = async (resourceKey) => {
    const item = rareResources.find(i => i.item_key === resourceKey);
    if (!item || item.quantity <= 0) return;

    setLoading(true);
    try {
      // Calculer le nouvel XP
      const newXPTotal = (profile.player_xp_total || 0) + XP_PER_RARE_RESOURCE;
      const oldLevel = getLevelFromXP(profile.player_xp_total || 0);
      const newLevel = getLevelFromXP(newXPTotal);

      // Mettre à jour l'inventaire (retirer 1 ressource)
      const updatedInventory = profile.inventory.map(inv => {
        if (inv.item_key === resourceKey) {
          return { ...inv, quantity: inv.quantity - 1 };
        }
        return inv;
      }).filter(inv => inv.quantity > 0);

      // Mettre à jour le profil
      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: updatedInventory,
        player_xp_total: newXPTotal,
        player_level: newLevel,
      });

      // Notifier l'utilisateur
      const resource = RARE_RESOURCES[resourceKey];
      if (newLevel > oldLevel) {
        toast.success(`🎉 ${resource.name} activée! +100 XP : Niveau ${newLevel}!`, {
          duration: 4000,
        });
      } else {
        toast.success(`✨ ${resource.name} activée! +100 XP`, {
          duration: 3000,
        });
      }

      // Mettre à jour le profil dans le parent
      if (onProfileUpdate) {
        onProfileUpdate({
          ...profile,
          inventory: updatedInventory,
          player_xp_total: newXPTotal,
          player_level: newLevel,
        });
      }

      setSelectedResource(null);
    } catch (error) {
      console.error("Erreur activation ressource:", error);
      toast.error("Erreur lors de l'activation");
    } finally {
      setLoading(false);
    }
  };

  if (rareResources.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-2">
        <h3 className="text-sm font-heading font-semibold text-foreground">Ressources rares</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {rareResources.map((item) => {
            const resource = RARE_RESOURCES[item.item_key];
            return (
              <button
                key={item.item_key}
                onClick={() => setSelectedResource(item.item_key)}
                className="flex flex-col items-center p-2 rounded-lg border border-accent/40 bg-accent/5 hover:bg-accent/10 hover:border-accent/60 transition-all"
              >
                <span className="text-2xl mb-1">{resource.icon}</span>
                <span className="text-xs font-semibold text-foreground text-center">{resource.name}</span>
                <span className="text-xs text-muted-foreground">×{item.quantity}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selectedResource} onOpenChange={(open) => !open && setSelectedResource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activer ressource rare</DialogTitle>
            <DialogDescription>
              Consommer 1 {selectedResource && RARE_RESOURCES[selectedResource]?.name} pour +{XP_PER_RARE_RESOURCE} XP?
            </DialogDescription>
          </DialogHeader>

          {selectedResource && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-accent/10 border border-accent/40">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{RARE_RESOURCES[selectedResource].icon}</span>
                  <div>
                    <p className="font-semibold">{RARE_RESOURCES[selectedResource].name}</p>
                    <p className="text-sm text-muted-foreground">+100 XP</p>
                  </div>
                </div>
              </div>

              {/* Aperçu du niveau futur */}
              {(() => {
                const newXP = (profile.player_xp_total || 0) + XP_PER_RARE_RESOURCE;
                const levelInfo = getPlayerLevelInfo(newXP);
                const currentInfo = getPlayerLevelInfo(profile.player_xp_total || 0);

                return (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Progression:</p>
                    <div className="flex items-center justify-between text-sm">
                      <span>Niveau {currentInfo.level} → {levelInfo.level}</span>
                      {levelInfo.leveledUp && (
                        <span className="text-accent font-semibold">🎉 +1 Niveau!</span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedResource(null)} disabled={loading}>
              Annuler
            </Button>
            <Button
              onClick={() => handleActivate(selectedResource)}
              disabled={loading}
              className="bg-accent hover:bg-accent/90"
            >
              {loading ? "Activation..." : "Activer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}