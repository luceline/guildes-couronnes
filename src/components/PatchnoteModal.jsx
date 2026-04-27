import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ScrollText } from "lucide-react";

const CURRENT_VERSION = "1.5";
const STORAGE_KEY = `gc_patchnote_seen_${CURRENT_VERSION}`;

export const ALL_PATCHNOTES = [
  {
    version: "1.5",
    date: "Avril 2026",
    notes: [
      { icon: "⚔️", title: "Le combat zoné fait son entrée", text: "Le royaume connaît enfin l'art de la lame. Défiez n'importe quel habitant d'une même cité depuis l'onglet Localité : choisissez la zone que vous visez (tête, torse, bras, jambes), et l'épée fait le reste. Le défié dispose de douze heures pour deviner où vous frapperez et choisir sa propre zone de défense. S'il pare juste, le coup est annulé et il pourra riposter dans la foulée. Sinon, le plus fort sur la zone visée l'emporte. Une attaque par jour vers une même cible, mais plusieurs attaquants peuvent se relayer." },
      { icon: "🛡️", title: "L'épée et l'armure se simplifient", text: "Fini les quatre armes zonées (casque-arme, plastron-arme, épée, pic) : il n'existe désormais qu'une seule arme universelle, l'épée. Les anciens items ont été convertis en épées, leurs grades conservés. Côté défense, les quatre armures restent : heaume, cuirasse, brassard, jambière — une par zone du corps. L'épée s'améliore chez le Bûcheron, les armures chez le Mineur." },
      { icon: "💰", title: "L'épée affûtée vole davantage", text: "Plus votre épée est forgée, plus elle vous rend riche. Au grade 0, vous prenez 10% de l'or de votre victime. Au grade 5, vous en arrachez 20%. Le butin reste capé à 100 pièces par coup, et la bourse de protection plafonne toujours le vol subi à 10. La progression du grade prend tout son sens." },
      { icon: "❤️", title: "Les points de vie protègent", text: "Chaque combattant dispose de dix points de vie. Un coup porté en retire un. À zéro, le joueur est blessé pendant 48 heures : il ne peut ni attaquer, ni être attaqué, ni faire partir ses unités armées. Les potions de soin et d'endurance restaurent les PV." },
      { icon: "⚒️", title: "Les armes se brisent", text: "Une lame, ça n'est pas éternel. Au grade 0, votre épée a 5% de chance de se briser à chaque coup porté. Au grade 5, ce n'est plus que 1%. Idem pour les armures. Investissez dans la qualité, ou tenez-vous prêt à reforger." },
      { icon: "🔔", title: "Les défis vous trouvent", text: "Quand un combattant vous lance le gant, vous le saurez. Une notification vous alerte à votre prochaine connexion, un compteur rouge clignote sur l'onglet Combat tant qu'un défi attend votre réponse. Personne ne pourra plus vous frapper pendant votre sommeil sans que vous ne le voyiez." },
      { icon: "⏱️", title: "Le temps tranche pour vous", text: "Si vous laissez passer les douze heures sans répondre à un défi, la lame frappe quand même — sans parade possible, mais votre armure joue son rôle si elle est portée sur la zone visée. Le système se résout tout seul, plus aucun combat ne reste en suspens." },
      { icon: "🎯", title: "Les quêtes ne se dédoublent plus", text: "Un bug avait laissé certains joueurs avec quatre cents quêtes du jour empilées. Plus de douze mille quêtes fantômes ont été nettoyées, et le système refuse désormais d'en générer en double. Vos six quêtes quotidiennes sont à nouveau six." },
      { icon: "📜", title: "Les chroniques sont fiables", text: "Le tableau de bord du maire et le journal de chaque joueur affichent désormais les bonnes transactions, dans le bon ordre. Le filtre 24h/48h/7j fonctionne, les sources d'or sont dépliables, et les changements de métier sont correctement étiquetés." },
      { icon: "🤝", title: "Les ateliers partagent l'or", text: "Quand vous faites améliorer une arme ou une armure chez un artisan, votre paiement se répartit désormais : 80% pour l'artisan qui œuvre, 20% pour la trésorerie de la cité qui héberge l'atelier. La forge fait vivre la ville." },
      { icon: "🌅", title: "La routine du matin se cale", text: "Le reset quotidien tourne désormais une seule fois par jour, à 6h UTC, côté serveur. Les multiples relances qui avaient lieu quand plusieurs joueurs se connectaient au même moment ne se reproduiront plus. Vos quêtes, vos cités, vos économies repartent du bon pied chaque matin." },
      { icon: "🎁", title: "La fidélité retrouve la mesure", text: "Les récompenses de connexion quotidienne ont été revues à la baisse pour rester équilibrées : 1, 2, 3 puis 8 pièces aux jours 1, 2, 3 et 5. Quinze pièces au septième jour, trente-cinq au quatorzième, cent au trentième. La régularité paie toujours, mais sans inflation." },
    ],
  },
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
