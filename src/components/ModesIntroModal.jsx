// src/components/ModesIntroModal.jsx (11/05/2026)
//
// Modale d'accueil affichée à la PREMIÈRE ouverture de la vue village
// pour expliquer le système d'auto-switch carte/menu selon l'orientation.
//
// Flag persisté en localStorage via village-modes-intro-seen → la modale
// n'apparait qu'une seule fois par device.

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { hasSeenModesIntro, markModesIntroSeen } from "@/lib/useVillageViewMode";

export default function ModesIntroModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Décaler à l'open via setTimeout pour ne pas ouvrir avant que la page
    // soit rendue (sinon ça flash et l'utilisateur peut être confus)
    const timer = setTimeout(() => {
      if (!hasSeenModesIntro()) setOpen(true);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    markModesIntroSeen();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg heading-medieval">
            🏰 Bienvenue dans votre cité
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm font-body leading-relaxed">
            Votre village peut s'afficher de <strong>deux manières</strong> selon comment vous tenez votre téléphone :
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg border-2 border-border bg-card">
              <div className="text-2xl mb-1">🏰</div>
              <div className="font-heading text-sm font-semibold">Carte</div>
              <div className="text-[11px] font-body text-muted-foreground leading-tight">
                Vue illustrée en paysage
              </div>
            </div>
            <div className="p-3 rounded-lg border-2 border-border bg-card">
              <div className="text-2xl mb-1">📋</div>
              <div className="font-heading text-sm font-semibold">Menu</div>
              <div className="text-[11px] font-body text-muted-foreground leading-tight">
                Tableau de bord en portrait
              </div>
            </div>
          </div>

          <p className="text-sm font-body leading-relaxed">
            Le mode s'adapte automatiquement à l'orientation de votre écran. <strong>Testez les deux vues</strong> en tournant votre téléphone !
          </p>

          <p className="text-[11px] font-body text-muted-foreground italic">
            Vous pouvez aussi forcer un mode dans les Paramètres ⚙️
          </p>
        </div>

        <button
          onClick={handleClose}
          className="w-full mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-heading font-semibold hover:bg-primary/90 transition-colors"
        >
          C'est parti !
        </button>
      </DialogContent>
    </Dialog>
  );
}
