import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, ChevronLeft, X } from "lucide-react";

const STEPS = [
  {
    icon: "🕯️",
    title: "Approchez, voyageur…",
    content: "Je m'appelle Aldebert, conteur de guilde, et j'ai parcouru bien des royaumes. Asseyez-vous, je vais vous conter ce monde. Ici, des villes se disputent la gloire — simples hameaux qui rêvent de devenir des empires. Vous y serez citoyen, artisan, soldat ou traître selon votre humeur. Deux destinées s'écrivent en même temps : celle de votre cité, qui monte de Hameau à Empire à force de lingots royaux, et la vôtre, qui grandit de novice à légende par les ressources rares des terres sauvages. Chaque aurore renouvelle les chances. Chaque crépuscule juge vos choix.",
    tip: "📜 Aldebert murmure : « Il n'est point de victoire définitive ici. Les villes s'élèvent, s'effondrent, et se relèvent. Les alliances se font et se trahissent. Bienvenue dans le monde des Guildes et Couronnes. »",
  },
  {
    icon: "⚒️",
    title: "Les huit corps de métier",
    content: "Nul ne peut tout faire seul — voilà la première vérité de ce monde. Huit métiers se partagent le labeur : le Bûcheron abat les forêts, le Mineur creuse les entrailles de la terre, le Fermier nourrit les ventres, le Tisserand habille les corps, le Forgeron arme les bras, l'Alchimiste distille les mystères, l'Orfèvre fond les lingots royaux, et le Marchand fait circuler tout cela. Sans Mineur, les forges s'éteignent. Sans Fermier, les estomacs gargouillent. Voyez les bannières sur chaque métier : ✨ Rare signifie que la ville a besoin de vous, ❌ Saturé que vous serez noyé dans la foule.",
    tip: "📜 Aldebert grogne : « J'ai vu des villes péricliter faute d'un seul Fermier. Choisissez votre métier selon les besoins de votre cité, pas selon votre caprice ! »",
  },
  {
    icon: "⚡",
    title: "La fatigue et la faim — vos deux ennemis silencieux",
    content: "Chaque coup de hache, chaque transaction, chaque geste coûte une part de vos forces et creuse l'estomac. Votre vigueur dépend de votre toit : qui dort sous une tente reprend souffle lentement, qui possède un manoir se remet bien plus vite. La faim, elle, remonte d'elle-même avec les heures — une miette par heure, lentement. Mais un bon pain, un ragoût fumant, et vous voilà ragaillardi ! Gardez aussi vos outils en bon état : trois usages, pas davantage. Un artisan sans outils met deux fois plus de temps à tout faire.",
    tip: "📜 Aldebert tapote son ventre : « J'ai vu des forgerons vigoureux rater leur journée entière par simple oubli de manger. Le Fermier est le pilier invisible de toute cité prospère. »",
  },
  {
    icon: "📦",
    title: "Les vertus cachées des objets",
    content: "Ne sous-estimez jamais ce que vous portez ! Les planches de chêne en votre sac réduisent vos délais de travail. Le fil de laine augmente ce que vous pouvez transporter. La pierre brute vous fortifie. Ces bienfaits sont silencieux, permanents, tant que l'objet vous appartient — ils ne s'usent pas par le simple fait d'être portés. Les outils eux s'usent à chaque usage — trois fois, et ils sont bons pour la forge. Sans eux, attendez deux fois plus longtemps entre chaque labeur.",
    tip: "📜 Aldebert soulève sa besace : « Voyez — je porte toujours des planches et du tissu. Ils ne pèsent rien et me donnent des ailes. »",
  },
  {
    icon: "🏪",
    title: "Le marché et les taxes — l'art de la discrétion",
    content: "Chaque ville a son marché où les prix sont libres comme l'air. Mais attention : quand vous achetez, la taxe de la ville ne vous est pas prélevée sur le champ — elle s'accumule dans l'ombre tout au long du jour. À l'aube suivante, la mairie vient réclamer son dû, ville par ville. Achetez dans dix villes différentes, et dix mairies tendront la main à l'aurore. Le Parchemin vous exonère entièrement. Le Sceau royal de votre ville absorbe taxes et impôts jusqu'à cent dix pièces d'or. Une annonce non vendue expire au bout de trois jours — les marchandises vous sont rendues automatiquement.",
    tip: "📜 Aldebert cligne de l'œil : « Le marchand avisé compte ses achats de la journée avant de dormir. Et il ne laisse pas ses étales moisir trois jours sans preneurs ! »",
  },
  {
    icon: "🏠",
    title: "Le logement et votre renommée personnelle",
    content: "De la simple tente au manoir seigneurial, votre demeure décide de combien vite vous récupérez vos forces. Mais votre grandeur ne se mesure pas qu'à votre toit — elle tient aussi à ce que vous avez accompli dans les terres sauvages. Chaque ressource rare des biomes, consommée, vous forge. Cent ressources rares, un titre de plus. Et chaque titre vous rend plus rapide, plus chanceux à la production. Ces bienfaits se cumulent avec ceux de votre cité et des biomes.",
    tip: "📜 Aldebert pointe son doigt : « Dès votre deuxième titre, vous travaillez plus vite et doublez parfois votre production. Ces privilèges ne se voient pas — regardez vos Bonus actifs dans votre blason de statut. »",
  },
  {
    icon: "🏗️",
    title: "L'entrepôt et les bâtiments — nourrir la ville",
    content: "Chaque bâtiment de la cité exige son tribut chaque nuit : la scierie réclame des planches, le moulin de la farine, la bergerie du fil. La taverne veut son pain. Si l'entrepôt est vide au petit matin, le bâtiment s'effondre. C'est simple et impitoyable. Déposez régulièrement vos matériaux transformés avant que l'aurore ne vienne juger votre cité. Les bâtiments de défense font exception : ils tombent après avoir servi, mais n'ont pas besoin d'entretien quotidien.",
    tip: "📜 Aldebert brandit un poing sévère : « J'ai vu une ville entière perdre sa fonderie en une nuit parce que nul n'avait pensé à remplir l'entrepôt. La négligence coûte cher. »",
  },
  {
    icon: "📈",
    title: "Les paliers de la cité — de hameau à empire",
    content: "La gloire d'une ville se mesure aux lingots royaux que les orfèvres livrent à la mairie. Dix lingots, et le hameau devient village — tous ses habitants travaillent dix pour cent plus vite. Trente lingots, et c'est le bourg — chaque citoyen peut combattre un monstre supplémentaire par jour dans les biomes. Puis la cité, la capitale, l'empire. Mais ces lingots peuvent être volés lors d'une guerre — voilà pourquoi les armées existent.",
    tip: "📜 Aldebert sourit : « Un village donne à tous ses résidents dix pour cent de vitesse en plus, cumulé avec vos titres personnels et les bénédictions des biomes. Trois bonnes nouvelles en même temps ! »",
  },
  {
    icon: "🌿",
    title: "Les biomes — les terres sauvages",
    content: "Six contrées s'étendent au-delà des murailles : forêt, champs, mine, atelier, forge, guilde. Chacune abrite des créatures à terrasser. Une victoire rapporte de l'or — cinq pièces pour un adversaire facile, dix pour un redoutable. Parfois, un trésor rare tombe de la bête vaincue. Consommez-le pour gagner en renommée, ou vendez-le au marché. Si votre métier est celui du biome, une bénédiction d'une heure vous attend : votre production s'emballe et vous doublez parfois vos récoltes.",
    tip: "📜 Aldebert lève les yeux : « Cinq combats par jour, six si votre ville est un bourg. La bénédiction du biome dure une heure — allez travailler tout de suite après ! »",
  },
  {
    icon: "🎯",
    title: "Les quêtes — votre feuille de route quotidienne",
    content: "Chaque matin, jusqu'à six missions vous attendent dans l'onglet Quêtes. Certaines demandent de fabriquer un objet et de le porter dans une autre cité. D'autres vous poussent à vendre au marché, ou simplement à voyager. Si vous possédez un Contrat artisan, une septième quête s'offre à vous : forger cinq objets pour cent dix pièces d'or. Ces missions expirent à l'aurore suivante. Planifiez votre route — certaines quêtes vous demandent de traverser des contrées lointaines.",
    tip: "📜 Aldebert consulte son parchemin : « Les quêtes de livraison vous obligent à voyager. Ne les acceptez pas si vous n'avez pas le temps de partir ! »",
  },
  {
    icon: "👑",
    title: "La mairie — pouvoir et intrigues",
    content: "Chaque cité a son maire, élu tous les dix jours par les résidents. Le trône coûte vingt pièces d'or à briguer. Le maire fixe les taxes du marché et les impôts quotidiens — trop gourmand, et les habitants partent ailleurs. Il peut aussi déclarer la guerre. Trois jours avant la fin du mandat, les candidatures s'ouvrent. Les votes se recueillent les trois derniers jours. Le Sceau royal, acheté à la mairie pour cent pièces, absorbe taxes et impôts jusqu'à cent dix pièces d'or.",
    tip: "📜 Aldebert souffle : « Un bon maire équilibre subtilement enrichir la trésorerie et ne pas affamer ses citoyens. Les tyrans fiscaux se retrouvent seuls très vite. »",
  },
  {
    icon: "⚔️",
    title: "L'armée — recrutement et entretien",
    content: "Six types de guerriers se recrutent dans l'onglet Gouvernance : milicien, archer, fantassin, cavalier, catapulte, chevalier. Chacun exige ses ressources pour être formé, et réclame chaque nuit sa part de l'entrepôt communautaire. Si l'entrepôt est vide au matin, les soldats désertent. Les unités disponibles dépendent du palier de votre cité — un hameau ne lève pas de chevaliers.",
    tip: "📜 Aldebert fronce les sourcils : « Une garnison bien nourrie, c'est la fondation de toute victoire. Négligez l'entrepôt, et vos soldats fondent comme neige au soleil. »",
  },
  {
    icon: "🏹",
    title: "Les guerriers — forces et faiblesses",
    content: "Le milicien est le plus humble : peu de défense, peu d'attaque, mais il ne coûte presque rien. L'archer perce la cavalerie mais tient mal les chocs. Le fantassin résiste comme un roc. Le cavalier frappe fort mais craint les archers. La catapulte est dévastatrice mais sans défense propre — elle réduit la défense ennemie de trente pour cent. Le chevalier, enfin, est la fleur de toute armée : attaque et défense redoutables, mais il exige des lingots d'or pour être formé.",
    tip: "📜 Aldebert pointe un parchemin : « Archers et fantassins défendent bien. Catapultes et cavaliers attaquent vite. Les faibles meurent en premier — sachez ce que vous sacrifiez. »",
  },
  {
    icon: "🗺️",
    title: "La guerre — déclaration et marche des armées",
    content: "Seul le maire peut sonner le tocsin. Il désigne une ville voisine reliée par une route — car nul ne marche à travers des terres sans chemin. Une fois l'attaque déclarée, trente minutes s'écoulent pendant lesquelles les résidents envoient leurs unités à la bataille. Les soldats quittent alors la garnison — la cité se retrouve temporairement à découvert. L'armée marche selon la durée de la route. À l'arrivée, le combat se règle seul, sans intervention possible.",
    tip: "📜 Aldebert baisse la voix : « Si vous envoyez toute votre garnison attaquer, votre ville est nue comme un agneau. Un ennemi malin peut profiter de cette fenêtre pour frapper derrière vous. »",
  },
  {
    icon: "⚖️",
    title: "Le combat — comment la victoire se calcule",
    content: "L'attaque cumule les forces de chaque guerrier, bonifiées par le palier de la cité et la présence d'un maire actif. La défense additionne les remparts et le palais à la garnison adverse. Une catapulte réduit cette défense de trente pour cent. Si l'attaque écrase la défense, le pillage est total : ressources de l'entrepôt saisies, lingots royaux volés. Si l'attaque est trop faible, l'armée se brise sur les murailles et rentre en lambeaux.",
    tip: "📜 Aldebert trace des lignes dans la poussière : « Voler des lingots royaux ralentit directement la progression de la cité adverse. C'est là le vrai but d'une guerre, plus que le pillage de vivres. »",
  },
  {
    icon: "💰",
    title: "Après la bataille — gloire et récompenses",
    content: "Qu'on gagne ou qu'on perde, tout guerrier ayant contribué reçoit titres d'expérience et pièces d'or. La victoire double ces dons. Les ressources pillées et les lingots volés sont distribués automatiquement. La taverne des deux cités annonce le résultat au monde entier. La ville défenderesse avait été prévenue dès le départ de l'armée ennemie — elle a eu le temps d'organiser sa résistance, de recruter, de se préparer.",
    tip: "📜 Aldebert lève son hanap : « Même les défaites instruisent et enrichissent. Contribuez toujours à une campagne, ne serait-ce qu'avec un seul milicien. »",
  },
  {
    icon: "🗡️",
    title: "Le sabotage — la guerre dans l'ombre",
    content: "Chaque maître artisan peut forger un objet de nuisance qui frappe dans l'ombre plutôt qu'en plein jour. L'huile inflammable détruit un bâtiment ennemi. La poudre corrosive ravage leurs réserves. Le festin empoisonné affame leurs habitants pendant deux jours. La clé forgée dérobe des lingots à leur mairie. L'élixir de discorde détourne leurs taxes vers votre ville. La lettre de désinformation alourdit leurs impôts. Sept bâtiments défensifs peuvent parer ces coups, mais tombent après usage.",
    tip: "📜 Aldebert sourit en coin : « Sabotage et guerre simultanés sur une même ville — voilà comment on brise un empire en une semaine. Coordonnez-vous avec vos alliés. »",
  },
  {
    icon: "🛤️",
    title: "Les routes et la carte du monde",
    content: "L'onglet Voyage vous donne accès à la carte du monde et aux chemins qui relient les cités. Quatre types de routes existent : la voie royale, libre d'accès, la voie forestière qui coûte quelques pièces, la passe de montagne plus onéreuse, et la route maritime, gratuite pour qui s'y risque. Seules les villes reliées par une route peuvent se déclarer la guerre. Les voyageurs se déplacent en temps réel — des points dorés glissent sur les routes pour les signaler.",
    tip: "📜 Aldebert déroule sa carte : « La carte se rafraîchit souvent. Si vous voyez une armée ennemie s'approcher, vous avez encore le temps de vous préparer. »",
  },
  {
    icon: "🌅",
    title: "Une journée dans la vie d'un citoyen",
    content: "À l'aube, les taxes sont prélevées, les bâtiments entretenus, les soldats nourris. Votre première pensée : vérifiez votre faim et vos forces. Ensuite, produisez, transformez, forgez — en vous servant de vos outils pendant qu'ils tiennent. Accomplissez vos quêtes du jour, allez terrasser les monstres du biome pendant que la bénédiction dure. Vendez vos surplus, déposez vos matériaux à l'entrepôt. Si vous êtes maire, vérifiez la garnison et jugez si l'heure d'attaquer est venue.",
    tip: "📜 Aldebert résume d'un geste : « Outils → quêtes → biome → entrepôt → marché. Dans cet ordre, et vous dormez le ventre plein et la conscience tranquille. »",
  },
  {
    icon: "🏪",
    title: "L'atelier — travailler pour autrui",
    content: "Tout artisan peut ouvrir son atelier depuis l'onglet Production. Il fixe un tarif pour les T1 et un tarif pour les T2 et plus. Un autre habitant de la même ville peut alors lui passer commande : il fournit ses propres ingrédients, paie le prix de service, et reçoit les items produits — sans que l'artisan soit présent. Le cooldown, la faim et la fatigue sont ceux du client. Ses propres bonus s'appliquent aussi : buff biome, rang personnel. C'est une manière d'échanger des compétences plutôt que des marchandises.",
    tip: "📜 Aldebert sourit : « Le Forgeron dort — et ses marteaux travaillent encore. Voilà la magie de l'atelier ouvert ! »",
  },
  {
    icon: "♾️",
    title: "La route est longue, voyageur",
    content: "Voilà ce que j'avais à vous conter ce soir. Les villes naissent hameaux et aspirent à l'empire. Les hommes naissent novices et rêvent de légendes. L'entretien ronge les négligents. Les guerres redistribuent les richesses. Les maires gouvernent et tombent. Rien n'est jamais acquis — c'est là la beauté du monde. Revenez me voir si vous avez des questions, je serai là, près du feu, avec d'autres histoires à raconter.",
    tip: "📜 Aldebert se lève et s'incline : « Bonne route, citoyen. Que vos forges ne s'éteignent jamais et que vos lingots restent hors de portée des pillards. Consultez ces pages à tout moment en cliquant sur ❓ »",
  },
];

export default function Tutorial({ onClose }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-2 border-primary/30 shadow-2xl">
        <div className="relative p-6 pb-4">
          <Button variant="ghost" size="icon" className="absolute top-3 right-3 text-muted-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="text-center space-y-2">
            <span className="text-5xl">{current.icon}</span>
            <h2 className="font-heading text-xl font-bold mt-3">{current.title}</h2>
          </div>
        </div>

        <div className="px-6 pb-4 space-y-4">
          <p className="font-body text-muted-foreground leading-relaxed text-sm whitespace-pre-line">{current.content}</p>
          {current.tip && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
              <p className="font-body text-sm italic">{current.tip}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-2">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground font-body text-right mt-1">{step + 1} / {STEPS.length}</p>
        </div>

        <div className="flex items-center justify-between p-6 pt-2 gap-3">
          <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0} className="font-body gap-1">
            <ChevronLeft className="h-4 w-4" /> Précédent
          </Button>
          <div className="flex gap-1.5 flex-wrap justify-center flex-1">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => setStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === step ? "bg-primary scale-125" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"}`}
              />
            ))}
          </div>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} className="font-heading gap-1">
              Suivant <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={onClose} className="font-heading">En route ! ⚔️</Button>
          )}
        </div>
      </Card>
    </div>
  );
}
