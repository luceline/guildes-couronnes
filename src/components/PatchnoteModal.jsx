import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ScrollText } from "lucide-react";

const CURRENT_VERSION = "2.4";
const STORAGE_KEY = `gc_patchnote_seen_${CURRENT_VERSION}`;

export const ALL_PATCHNOTES = [
  {
    version: "2.4",
    date: "Mai 2026",
    notes: [
      { icon: "🔧", title: "La forge devient stratégique", text: "Le marteau du forgeron ne frappe plus avec la même ardeur selon l'état de la pièce. Réparer une lame fraîchement écornée vous coûtera un seul point de votre quota et une ressource humble. Mais vouloir hisser une cuirasse de huit à neuf de durabilité vous coûtera trois points et trois ressources. Vouloir lui rendre son dixième et dernier point exigera quatre points pleins de votre quota du jour, et trois ressources encore. La perfection se mérite : un guerrier sage acceptera ses lames à six ou sept de durabilité, et gardera ses précieux points pour les pièces critiques.\\n\\nLa table des coûts s'égrène ainsi : un point et une ressource jusqu'à quatre de durabilité, un point et deux ressources jusqu'à six, deux points et deux ressources jusqu'à sept, deux points et trois ressources pour passer de sept à huit, trois points et trois ressources pour passer de huit à neuf, quatre points et trois ressources pour le saut final vers dix." },
      { icon: "📅", title: "Vingt-cinq points par semaine, et pas un de plus", text: "Au plafond quotidien de cinq points s'ajoute désormais une jauge hebdomadaire glissante : vingt-cinq points sur sept jours roulants. Un guerrier rarement attaqué ne pourra plus tout réparer impunément : la jauge tient le compte de chaque point dépensé, et oublie ce qui a plus de sept jours. Vous ne pouvez plus vous permettre de tout maintenir à dix : il faut choisir vos pièces de prédilection, et accepter que d'autres restent fonctionnelles à six ou sept.\\n\\nLe panneau d'équipement de combat affiche désormais les deux jauges en permanence : votre quota du jour, et votre quota de la semaine. Quand l'une ou l'autre approche du fond, un avertissement coloré vous prévient." },
      { icon: "🪵", title: "Le bouclier réclame du bois, plus de la pierre", text: "L'ancienne convention voulait que la même pierre serve à la lame et au bouclier. Une simplification de fortune, qui n'avait plus sa place. Désormais, le bouclier se répare avec du Bois brut, ressource que tout Bûcheron sait fournir en abondance. Une cohérence retrouvée : la lame se forge à la pierre, le bouclier se taille au bois, et chaque pièce a son artisan dédié.\\n\\nVérifiez votre stock de bois avant de partir au combat : votre bouclier en aura besoin pour rester vaillant." },
      { icon: "🔮", title: "La cuirasse réclame du quartz", text: "Pour pousser plus loin la diversification, la cuirasse abandonne la laine commune au profit du Quartz brut. La pièce centrale de votre armure, celle qui couvre votre cœur, exige désormais cette gemme polie que seul l'Orfèvre récolte. Les heaumes, brassards et jambières restent fidèles à leur Laine brute, mais le torse devient une affaire de précieux.\\n\\nUn duelliste sage maintiendra des liens cordiaux avec son orfèvre local. Les marchés à quartz risquent fort de s'animer dans les prochains jours." },
      { icon: "🩹", title: "Le bris d'arme via combat expiré, enfin réparé", text: "Un bug pernicieux frappait les défis non répondus dans les temps : quand le cron du matin résolvait un combat expiré, l'arme ou l'armure brisée disparaissait purement et simplement de l'équipement, au lieu de simplement passer à zéro de durabilité comme prévu. Plusieurs joueurs ont vu leur épée s'évanouir dans la nuit. C'est désormais corrigé. Le combat expiré suit la même logique que le combat normal : usure déterministe, jet d'attaque selon l'état de la lame, jet de défense selon l'état de l'armure, et plus aucun item ne quitte votre équipement contre votre gré." },
    ],
  },
  {
    version: "2.3",
    date: "Mai 2026",
    notes: [
      { icon: "🍯", title: "Le chaudron magique bouillonne en mairie", text: "Une vieille marmite enchantée a fait son apparition dans chaque hôtel de ville. Chaque aurore, elle réclame quatre paires de matériaux tirés au sort, le même menu pour toutes les cités du royaume. À vous d'apporter ces composants à l'office du maire pour cuisiner l'un des quinze grimoires d'effets que recèle l'alchimie ancienne.\n\nLes recettes se classent en trois rangs. Le rang 1 vous tend les bras pour huit pièces et un peu d'efforts. Le rang 2 et le rang 3 demandent davantage, mais offrent des merveilles plus rares. Au rang 1, vous savez ce que vous obtenez. Aux rangs supérieurs, le chaudron mélange les pondérations et le résultat se révèle à la dernière minute, comme une potion qui change de couleur dans la fiole.\n\nLes objets ainsi cuisinés s'activent depuis votre inventaire, et leurs effets dépassent souvent le simple rendement. Talismans de protection, parchemins marchands voleurs d'or, étoiles filantes pillardes, hiboux espions, plumes de phénix, sabliers et sceaux de guilde. Quinze trésors à découvrir, et leur grimoire dans l'onglet Codex pour qui veut anticiper." },
      { icon: "🛡️", title: "Le dôme de protection révèle son halo", text: "Quand un alchimiste pose un Talisman sur sa cité, un dôme bleuté l'enveloppe pendant douze heures. Aucun parchemin marchand, aucune étoile filante, aucune razzia ne peut percer cette barrière. Désormais, un bandeau azur s'affiche dans le panneau Événements de la mairie pour avertir les résidents que leur cité est à l'abri, et jusqu'à quelle heure la protection tient bon. Plus de doute sur l'état des murailles invisibles." },
      { icon: "🎉", title: "La mairie organise des événements grandioses", text: "Le maire dispose désormais d'un nouvel onglet dans son hôtel de ville : les Événements. Sept actions s'offrent à lui, à condition d'investir l'entrepôt commun. Une Course aux trésors offre une seconde épopée du jour à tous les résidents. La Fête du travail divise par deux le temps des crafts. La Procession des routes accélère les voyages d'autant. Le Festin royal regarnit l'énergie et la faim de chaque habitant. La Bénédiction de l'abondance ajoute cinq pour cent de chance de double production. La Forge collective remet à neuf le quota de réparations.\n\nMais surtout : la Razzia. Investissez vos T1 dans cette opération, choisissez une cité voisine, et frappez sa trésorerie. Chaque ressource sacrifiée vole deux pièces d'or à l'ennemi. Sept jours de cooldown par cible, et gare au dôme adverse qui vous renverra bredouille avec vos ressources perdues. Une seule action par jour et par mairie : choisissez bien." },
      { icon: "🗿", title: "Les paliers de la statue royale prennent vie", text: "La statue itinérante affichait ses paliers depuis sa pose, mais leurs effets restaient lettre morte. C'est désormais corrigé. Les résidents de la cité hôte voient leurs cinq paliers s'appliquer concrètement.\n\nAu palier 1, vos crafts sont dix pour cent plus rapides. Au palier 2, chaque résident reçoit cinq pièces d'or à l'aurore, comme un don de la couronne. Au palier 3, vos drops de combat dans les biomes augmentent de cinq pour cent. Au palier 4, vos voyages durent vingt pour cent de moins et le péage des Murs d'enceinte s'évanouit. Au palier 5, votre stockage de récolte AFK passe de quatre à dix unités.\n\nLes effets se cumulent multiplicativement avec vos autres bonus. Donnez généreusement, et toute la ville en récolte les fruits." },
      { icon: "🩹", title: "Les bugs des items à cible enfin chassés", text: "Plusieurs alchimistes se plaignaient de voir leurs Parchemins marchands, Étoiles filantes et Hiboux messagers s'évanouir sans effet ni modale de cible. La cause se cachait dans une recopie incomplète des fiches d'objets. C'est réparé. Vos items à cible ouvrent désormais correctement leur fenêtre de sélection." },
      { icon: "🍖", title: "Le festin royal tient compte de vos bâtiments", text: "Le Festin royal régénère désormais l'énergie et la faim jusqu'au véritable maximum de chacun, en tenant compte du logement, des bâtiments municipaux et des bonus permanents. Un chevalier qui peut atteindre vingt-deux d'énergie touchera bien vingt-deux, plus seulement vingt comme avant." },
      { icon: "🛎️", title: "Le crieur public veille sur le cron du matin", text: "À l'invisible, derrière les rideaux du château, un mécanisme s'est durci. Le cron de l'aube qui prélève les taxes, soigne les hospices et fait tourner la statue ne s'arrête plus si l'un des modules trébuche : il continue avec les suivants, et l'administrateur reçoit un message dans son canal pour lui signaler la panne. Le royaume avance, même quand un rouage grince. Vous, citoyen, vous n'en verrez probablement rien : vous vous réveillerez le matin avec votre or, vos quêtes et vos bénédictions, comme à l'accoutumée." },
    ],
  },
  {
    version: "2.2",
    date: "Mai 2026",
    notes: [
      { icon: "🗿", title: "La Statue royale itinérante prend la route", text: "Une œuvre dorée parcourt désormais le royaume, changeant de cité chaque aurore au gré du hasard. Là où elle se pose, un onglet apparaît dans la mairie, et les habitants peuvent y déposer leurs offrandes : ressources brutes, planches, fil, lingots, tout ce qui n'est pas un objet de prestige (T5 exclu). La valeur de chaque don est calculée selon les prix du marché, en or virtuel.\n\nLes offrandes alimentent un cumul commun à tout le royaume, qui débloque cinq paliers de bénédictions tant que le cycle dure. Tous les quinze jours, la statue rend son verdict : les trois plus généreux empochent des récompenses substantielles, et tous les contributeurs reçoivent leur juste part au prorata de leur générosité. Trente pour cent du cumul retourne au néant, comme un tribut au royaume.\n\nUne offrande par jour et par personne, mais pas de limite de quantité : à vous de jauger ce que vous voulez sacrifier. La statue ne révèle ses gagnants qu'à la fin du cycle, mais elle vous murmure combien il vous manque pour entrer dans le Top 3." },
      { icon: "🎰", title: "La loterie hebdomadaire fait grossir les bourses", text: "Le tavernier, dans les cités qui possèdent une taverne, vous tend désormais des billets de loterie à cinq pièces d'or l'unité. Vingt billets maximum par semaine et par joueur, pas plus. La cagnotte est commune à tout le royaume : peu importe dans quelle taverne vous achetez, vous misez dans le même pot.\n\nChaque lundi à l'aube, le sort tranche : un seul gagnant emporte quatre-vingt-quinze pour cent de la cagnotte, les cinq pour cent restants partent en fumée pour le bien du royaume. Plus vous avez de billets, plus vos chances grimpent, mais nul n'est jamais sûr de rien.\n\nLes cités sans taverne devront se déplacer pour participer. Voilà une raison de plus de bâtir cet édifice de convivialité." },
      { icon: "🎲", title: "La table de hazart, le sort partagé", text: "La table de jeu n'est plus l'apanage d'une seule cité. Désormais, tout défi posé à la table de hazart est visible et accepté depuis n'importe quelle taverne du royaume. Plus de seuil minimum de joueurs présents : si la table est ouverte, vous pouvez jouer.\n\nLes règles évoluent aussi. Quand vous lancez votre défi, vous lancez vos dés sur le coup : trois dés roulés en grande pompe, votre score figé sur la table mais tenu secret aux yeux des autres. À celui qui relève votre défi de tenter sa chance ensuite, sans savoir ce qu'il devra battre. Le suspense fait partie du jeu.\n\nVous pouvez retirer votre défi avant qu'il soit relevé, mais le tavernier garde la moitié de votre mise pour le dérangement. C'est le prix à payer pour préserver l'honneur des joueurs." },
      { icon: "💸", title: "L'aubaine du marché s'évapore en partie", text: "Pour stabiliser l'or qui circule dans le royaume, cinq pour cent de chaque taxe de marché s'évanouit désormais à l'aube, retournant au néant avant même de rejoindre la trésorerie de la cité. Les cités touchent toujours quatre-vingt-quinze pour cent, mais le royaume n'enrichit plus indéfiniment ses coffres.\n\nC'est un ajustement discret, mais qui s'accumule. Sur la durée, il freine l'inflation et préserve la valeur de l'or que vous travaillez si dur à amasser." },
      { icon: "📜", title: "Le grimoire des recettes s'inverse", text: "Dans le Codex, chaque objet vous indique désormais non seulement la recette qui le produit, mais aussi toutes les recettes qui le consomment. Vous regardez du minerai de fer, et vous voyez immédiatement les charbons, lingots, cuirasses où il finira. Plus besoin de fouiller chaque page : l'index inverse est tracé sous vos yeux.\n\nUn confort pour les artisans qui veulent savoir où porter leurs efforts, et pour les marchands qui cherchent à anticiper la demande." },
      { icon: "🩹", title: "Vos quêtes du jour ne s'évanouiront plus", text: "Un bug pernicieux faisait disparaître vos missions quotidiennes si vous vous connectiez trop tôt avant l'aurore. Le cron du matin marquait expirées les quêtes que votre frontend venait de générer la veille, et vous découvriez avec stupeur que vos six missions du jour avaient disparu sans laisser de trace.\n\nLa correction est passée. Désormais, le cron ne touche plus aux quêtes du jour en cours : seules celles des aubes précédentes sont rangées dans le livre des défaites." },
    ],
  },
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-2 sm:p-4">
      <Card className="w-full max-w-lg border-2 border-primary/30 shadow-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col my-auto">
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

        <CardContent className="overflow-y-auto space-y-6 py-2 min-h-0">
          {currentPatch && (
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="font-heading font-semibold text-sm text-primary">v{currentPatch.version}</span>
                <span className="text-xs text-muted-foreground font-body">· {currentPatch.date}</span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-body">Nouveau</span>
              </div>
              <div className="space-y-3">
                {currentPatch.notes.map((note, i) => (
                  <div key={i} className="flex gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0">
                    <span className="text-2xl shrink-0 mt-0.5">{note.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading font-semibold text-sm mb-1">{note.title}</p>
                      <p className="text-xs text-muted-foreground font-body leading-relaxed italic whitespace-pre-line">{note.text}</p>
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
