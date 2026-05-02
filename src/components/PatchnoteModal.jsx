import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ScrollText } from "lucide-react";

const CURRENT_VERSION = "2.1";
const STORAGE_KEY = `gc_patchnote_seen_${CURRENT_VERSION}`;

export const ALL_PATCHNOTES = [
  {
    version: "2.1",
    date: "Mai 2026",
    notes: [
      { icon: "✨", title: "Le jet de sauvegarde, dernière chance du défenseur", text: "Quand toutes les défenses ont cédé et que le coup s'apprête à porter, le défenseur tente un dernier jet basé sur son expérience de combattant. Tout joueur dispose de 10 pour cent de base, augmentés de 5 pour cent par niveau d'écart en sa faveur, jusqu'à 50 pour cent au plus. Un combattant aguerri résiste mieux, même mal équipé. Une sauvegarde réussie réduit les dégâts d'un point : le coup standard devient inoffensif, le coup à la tête ne fait plus que blesser. L'or, lui, reste prélevé. Voilà de quoi rééquilibrer les duels où l'écart de grade semblait insurmontable." },
      { icon: "🎬", title: "Le replay animé du combat", text: "Chaque duel résolu se rejoue désormais sous vos yeux comme une scène de chevalerie. Les dés roulent un à un pour chaque jet, les verdicts tombent en couleur, et la conclusion s'affiche avec ses dégâts et son or. À votre prochaine connexion, le dernier combat dans lequel vous étiez impliqué se déclenchera tout seul, comme un récit de la veille à découvrir. Et chaque défi de votre historique reçoit un bouton « Revoir » pour relancer la séquence quand l'envie vous prend." },
      { icon: "🩹", title: "Vos personnages naissent en pleine forme", text: "Un bug de longue date faisait apparaître les nouveaux personnages avec zéro point de vie au sortir de la création. Désormais, tout chevalier qui rejoint le royaume démarre à dix sur dix, prêt à en découdre dès la première heure. Les anciens joueurs ayant subi cette infortune peuvent demander un soin auprès d'un administrateur." },
      { icon: "🔧", title: "Le quota de réparation s'affiche en clair", text: "Le panneau de réparation indique désormais en permanence combien de points il vous reste pour la journée. Un bandeau coloré au sommet du panneau passe au gris tant que tout va bien, à l'orange quand il ne reste qu'un point, au rouge quand votre forge journalière est épuisée. Plus besoin de deviner si vous pouvez encore restaurer cette épée avant le coucher du soleil." },
      { icon: "🛡️", title: "Verrouillage anti-tricherie sur les défis", text: "Un index unique a été ajouté côté serveur pour empêcher qu'un même attaquant ne lance plusieurs défis à la même cible le même jour. Cette protection est atomique, elle bloque toute tentative quelle que soit la méthode employée. Les ripostes restent autorisées, naturellement, car elles sont l'expression légitime de la cible qui se rebiffe." },
    ],
  },
  {
    version: "2.0",
    date: "Mai 2026",
    notes: [
      { icon: "🎲", title: "La durabilité décide du combat", text: "L'acier d'une lame ne ment pas. Désormais, c'est l'état de votre équipement qui détermine vos chances de toucher et de parer, plus seulement son grade. Une épée à 8 sur 10 de durabilité touche 8 fois sur 10. Une cuirasse à 5 sur 10 bloque une attaque sur deux. Un grade 5 négligé s'effondre face à un grade 0 fraîchement entretenu : la qualité ne dispense plus du soin. Le grade conserve son poids dans le butin et tranche les égalités, mais c'est l'usure qui mène la danse." },
      { icon: "🎯", title: "Trois jets pour trancher chaque duel", text: "Un combat se résout désormais en trois temps. D'abord la parade : si vous devinez juste la zone visée, votre armure tente de l'absorber selon sa durabilité. Si elle réussit, le coup est annulé et vous ripostez. Sinon, l'attaquant lance son arme : si l'épée est trop usée, elle se dérobe et l'attaque s'évanouit dans le vide. Si elle frappe, votre armure de la zone touchée tente à son tour de bloquer. Trois moments de tension, trois occasions de retournement. La lame n'est plus une certitude." },
      { icon: "🪖", title: "La tête, coup décisif", text: "Viser la tête n'est plus un choix anodin. Si le coup porte malgré le heaume adverse, c'est deux points de vie qui s'envolent au lieu d'un. Quatre coups bien placés peuvent désormais mettre un adversaire à genoux, là où il en fallait dix auparavant. Mais la zone reste petite et le heaume y règne : pesez bien votre risque." },
      { icon: "🛡️", title: "Le bouclier joue son va-tout", text: "Posé sur une zone autre que votre parade, le bouclier conserve son rôle : ajouter sa puissance à la défense de la zone qu'il protège. Mais lui aussi obéit désormais à la durabilité : un bouclier dura 3 sur 10 n'a que trois chances sur dix d'intervenir au bon moment. Tenez-le en bon état, ou il glissera quand vous en aurez le plus besoin." },
      { icon: "🔧", title: "Cinq points de réparation par jour", text: "Le marteau du forgeron a ses limites. Désormais, vous ne pouvez restaurer que cinq points de durabilité par jour, toutes pièces confondues. Une cuirasse passe de 3 à 8, et c'est tout votre quota du jour qui s'envole. À vous de choisir : remettre une seule pièce à neuf, ou redonner un peu de souffle à plusieurs ? La pierre et la laine brute restent les seuls matériaux nécessaires, mais leur usage devient stratégique. Le panneau de réparation affiche en permanence les points qu'il vous reste pour la journée." },
      { icon: "⚔️", title: "L'usure suit la justice du combat", text: "Votre épée perd toujours un point de durabilité à chaque attaque, même quand elle se dérobe. Mais votre armure ne s'use plus quand un coup la traverse sans qu'elle ne l'arrête : si elle a échoué à bloquer, elle n'a pas servi, elle ne s'use pas. Inversement, une parade réussie use l'armure d'un point, parce qu'elle a fait son office. Le bouclier suit la même règle : il ne s'use que lorsqu'il intervient réellement." },
      { icon: "👁️", title: "L'avant-combat se lit en chiffres", text: "Avant chaque défi, vous voyez désormais votre véritable chance de toucher : un pourcentage clair, coloré, calculé sur l'état de votre épée. Et votre adversaire, en défense, voit le même pourcentage pour chacune de ses quatre zones d'armure. Plus de combats à l'aveugle sur l'efficacité réelle de votre matériel : la prise de décision devient lisible, l'investissement dans l'entretien devient visible, et le suspense se déplace là où il doit être : sur le choix de la zone." },
      { icon: "💨", title: "Une nouvelle issue : l'attaque qui se dérobe", text: "Quand l'épée d'un attaquant rate son jet, l'attaque ne porte tout simplement pas. Pas de dégâts, pas de vol d'or, pas de parade : la lame s'est dérobée à mi-course. La taverne saluera l'événement avec un message dédié. C'est le rappel que même bien préparé, on ne contrôle pas tout : entretenez vos armes, ou subissez les caprices de l'acier mal soigné." },
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

  // V2.0 : on n'affiche que la version courante, pas l'historique complet
  const currentPatch = ALL_PATCHNOTES.find(p => p.version === CURRENT_VERSION) || ALL_PATCHNOTES[0];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
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
          {currentPatch && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-heading font-semibold text-sm text-primary">v{currentPatch.version}</span>
                <span className="text-xs text-muted-foreground font-body">· {currentPatch.date}</span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-body">Nouveau</span>
              </div>
              <div className="space-y-3">
                {currentPatch.notes.map((note, i) => (
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
          )}
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
