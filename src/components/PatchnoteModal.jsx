import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ScrollText } from "lucide-react";

const CURRENT_VERSION = "1.4";
const STORAGE_KEY = `gc_patchnote_seen_${CURRENT_VERSION}`;

export const ALL_PATCHNOTES = [
  {
    version: "1.4",
    date: "Avril 2026",
    notes: [
      { icon: "🏰", title: "Le royaume a déménagé", text: "Guildes & Couronnes vit désormais sur ses propres terres : guildescouronnes.fr. Un nouveau serveur, plus solide, taillé pour durer. Vos personnages, vos cités, vos trésors — tout a été transféré. L'ancienne auberge ferme ses portes." },
      { icon: "📲", title: "Le jeu s'installe sur vos appareils", text: "Guildes & Couronnes peut désormais s'installer comme une vraie application. Sur Chrome et Edge, cherchez l'icône d'installation dans la barre d'adresse. Sur iOS, ouvrez Safari, appuyez sur Partager puis 'Sur l'écran d'accueil'. Le royaume vous suit partout." },
      { icon: "⭐", title: "Les coups de maître s'annoncent", text: "Quand votre marteau frappe juste, le royaume le sait. Un coup de maître ne passe plus inaperçu — une bannière dorée s'illumine pour saluer votre prouesse. De même, tenter de forger en chevauchant vous sera signalé avec la sévérité qui convient." },
      { icon: "💰", title: "L'or retrouve sa place", text: "L'or déposé dans l'entrepôt communautaire rejoint désormais directement la trésorerie de la cité. L'entretien des bâtiments et des armées est prélevé sur cette même trésorerie — plus aucun lingot ne se perd dans les limbes." },
      { icon: "🍺", title: "La taverne ouvre ses portes", text: "Les cités qui ont bâti une taverne disposent désormais de son onglet dédié. Buvez, reposez-vous, bavardez — le bâtiment prend enfin toute sa place dans la vie du royaume." },
      { icon: "🏗️", title: "L'administrateur peut bâtir", text: "En cas de destruction injuste ou de bug de maintenance, l'administrateur peut désormais construire ou supprimer n'importe quel bâtiment dans n'importe quelle cité — sans coût, sans délai. La justice du royaume est plus rapide." },
      { icon: "🖋️", title: "Les outils du savoir-faire", text: "Encre, Épée courte et Outils confèrent désormais un bonus de craft à qui les porte. L'encre réduit vos cadences T2 de 10% et génère une ressource T1 en prime. L'épée courte fait de même pour le T3, les outils pour le T4. Chacun dispose de 4 charges avant de s'user." },
      { icon: "🌾", title: "La cité nourrit ses résidents", text: "Chaque habitant coûte désormais une ressource T1 par jour à l'entrepôt communautaire. Si les réserves manquent, la cité y perd quand même — en proportion. Approvisionnez vos greniers, ou la population se débrouillera à vos dépens." },
      { icon: "📅", title: "Le temps du reset est juste", text: "Le compte à rebours des quêtes pointait vers minuit. Il pointe désormais vers 6h UTC — l'heure véritable du renouveau quotidien. Les chroniques sont enfin à l'heure." },
    ],
  },
  {
    version: "1.3",
    date: "Mars 2026",
    notes: [
      { icon: "🏪", title: "Les ateliers s'ouvrent", text: "Tout artisan peut désormais ouvrir son atelier depuis l'onglet Production. Les habitants de la même cité peuvent lui passer commande — ils fournissent leurs ingrédients, paient le service, et reçoivent les fruits du labeur." },
      { icon: "⏳", title: "Les étales ont une durée de vie", text: "Une annonce au marché n'est plus éternelle. Au bout de trois jours sans preneur, elle est retirée et vos marchandises vous sont restituées. Les marchés se désengorgeront, les prix bougeront. Le monde tourne." },
      { icon: "💰", title: "Les prix conseillés s'affinent", text: "Quand vous mettez en vente sur le marché, une fourchette de prix s'affiche désormais pour tous les objets. Elle est calculée chaque nuit depuis les vrais prix du marché." },
      { icon: "🏛️", title: "La Ville s'organise", text: "L'onglet Ville a été réorganisé. Panneau d'affichage du maire, approvisionnement d'urgence, et changement de métier — tout est désormais accessible depuis des sélecteurs dédiés." },
      { icon: "⚡", title: "La tente n'est plus un désert", text: "Même sous une tente, l'énergie remonte désormais — lentement, mais sûrement. Une unité par heure. La cabane offre cinquante minutes, la maison quarante, le manoir trente." },
      { icon: "🎶", title: "La musique respecte votre quiétude", text: "Quand vous changez d'application sur votre téléphone, la musique s'interrompt. Elle reprend à votre retour. Et si vous avez plusieurs onglets ouverts, un seul joue à la fois." },
      { icon: "🔧", title: "Ce qui était cassé a été réparé", text: "Les taxes de marché s'accumulent et sont bien versées à la trésorerie. Les attaques T5, les lingots royaux, les offres de rachat du maire — tout ce qui semblait se perdre dans les limbes est de retour." },
    ],
  },
];

export default function PatchnoteModal({ forceOpen = false, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (forceOpen) { setVisible(true); return; }
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setVisible(true);
  }, [forceOpen]);

  const close = () => {
    if (!forceOpen) localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    onClose?.();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-2 border-primary/30 shadow-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="relative pb-2 shrink-0">
          <button onClick={close} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
          <CardTitle className="font-heading text-xl flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-accent" />
            Chroniques du royaume
          </CardTitle>
          <p className="text-xs text-muted-foreground font-body italic">
            🎶 Le ménestrel déroule son parchemin et annonce les nouvelles du monde…
          </p>
        </CardHeader>

        <CardContent className="overflow-y-auto space-y-6 py-2">
          {ALL_PATCHNOTES.map((patch) => (
            <div key={patch.version}>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-heading font-semibold text-sm text-primary">v{patch.version}</span>
                <span className="text-xs text-muted-foreground font-body">— {patch.date}</span>
                {patch.version === CURRENT_VERSION && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-body">Nouveau</span>
                )}
              </div>
              <div className="space-y-3">
                {patch.notes.map((note, i) => (
                  <div key={i} className="flex gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0">
                    <span className="text-2xl shrink-0 mt-0.5">{note.icon}</span>
                    <div>
                      <p className="font-heading font-semibold text-sm mb-1">{note.title}</p>
                      <p className="text-xs text-muted-foreground font-body leading-relaxed italic">{note.text}</p>
                    </div>
                  </div>
                ))}
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
