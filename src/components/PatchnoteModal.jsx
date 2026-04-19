import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ScrollText } from "lucide-react";

// ── Incrémenter cette version à chaque nouveau patchnote ──
const CURRENT_VERSION = "1.3";
const STORAGE_KEY = `gc_patchnote_seen_${CURRENT_VERSION}`;

const PATCHNOTES = [
  {
    icon: "🏪",
    title: "Les ateliers s'ouvrent",
    text: "Tout artisan peut désormais ouvrir son atelier depuis l'onglet Production. Les habitants de la même cité peuvent lui passer commande — ils fournissent leurs ingrédients, paient le service, et reçoivent les fruits du labeur. Même sans que l'artisan soit présent. Leurs propres faveurs de rang et bénédictions de biome s'appliquent.",
  },
  {
    icon: "⏳",
    title: "Les étales ont une durée de vie",
    text: "Une annonce au marché n'est plus éternelle. Au bout de trois jours sans preneur, elle est retirée et vos marchandises vous sont restituées. Les marchés se désengorgeront, les prix bougeront. Le monde tourne.",
  },
  {
    icon: "💰",
    title: "Les prix conseillés s'affinent",
    text: "Quand vous mettez en vente sur le marché, une fourchette de prix s'affiche désormais pour tous les objets — T1 comme T2, T3, T4 et T5. Elle est calculée chaque nuit depuis les vrais prix du marché. Vendez en connaissance de cause.",
  },
  {
    icon: "🏛️",
    title: "La Ville s'organise",
    text: "L'onglet Ville a été réorganisé. Panneau d'affichage du maire, approvisionnement d'urgence, urgence T1 de la mairie, et changement de métier — tout est désormais accessible depuis des sélecteurs dédiés. Plus de navigation à tâtons.",
  },
  {
    icon: "⚡",
    title: "La tente n'est plus un désert",
    text: "Même sous une tente, l'énergie remonte désormais — lentement, mais sûrement. Une unité par heure. La cabane offre cinquante minutes, la maison quarante, le manoir trente. Le repos se mérite, mais il ne vous abandonne plus.",
  },
  {
    icon: "🎶",
    title: "La musique respecte votre quiétude",
    text: "Quand vous changez d'application sur votre téléphone, la musique s'interrompt. Elle reprend à votre retour, là où elle s'était tue. Et si vous avez plusieurs onglets ouverts, un seul joue à la fois.",
  },
  {
    icon: "🔧",
    title: "Ce qui était cassé a été réparé",
    text: "Les taxes de marché s'accumulent et sont bien versées à la trésorerie. Les attaques T5, les lingots royaux, les offres de rachat du maire — tout ce qui semblait se perdre dans les limbes est de retour. Les schémas de données ont été restaurés dans leur intégralité.",
  },
];

export default function PatchnoteModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setVisible(true);
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-2 border-primary/30 shadow-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="relative pb-2 shrink-0">
          <button
            onClick={close}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <CardTitle className="font-heading text-xl flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-accent" />
            Chroniques du royaume — v{CURRENT_VERSION}
          </CardTitle>
          <p className="text-xs text-muted-foreground font-body italic">
            🎶 Le ménestrel déroule son parchemin et annonce les nouvelles du monde…
          </p>
        </CardHeader>

        <CardContent className="overflow-y-auto space-y-4 py-2">
          {PATCHNOTES.map((note, i) => (
            <div key={i} className="flex gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0">
              <span className="text-2xl shrink-0 mt-0.5">{note.icon}</span>
              <div>
                <p className="font-heading font-semibold text-sm mb-1">{note.title}</p>
                <p className="text-xs text-muted-foreground font-body leading-relaxed italic">{note.text}</p>
              </div>
            </div>
          ))}
        </CardContent>

        <div className="p-4 pt-2 shrink-0 border-t border-border">
          <Button className="w-full font-heading" onClick={close}>
            🎶 Compris, qu'on continue l'aventure !
          </Button>
        </div>
      </Card>
    </div>
  );
}
