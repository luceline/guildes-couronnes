import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronLeft, X, Search, ArrowLeft } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Catégories : regroupement thématique des chapitres pour navigation rapide
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "demarrage",  icon: "🎯", label: "Démarrage" },
  { id: "production", icon: "🌾", label: "Production & Récolte" },
  { id: "economie",   icon: "🛒", label: "Économie" },
  { id: "duel",       icon: "⚔️", label: "Duel personnel" },
  { id: "mairie",     icon: "🏛️", label: "Mairie & Cité" },
  { id: "loisirs",    icon: "🎲", label: "Loisirs" },
  { id: "synthese",   icon: "📜", label: "Synthèse" },
];

// ─────────────────────────────────────────────────────────────────────────────
// STEPS : chapitres du tutoriel, dans l'ordre de lecture recommandé
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  // ═══ DÉMARRAGE ═══
  {
    category: "demarrage",
    icon: "🕯️",
    title: "Approchez, voyageur…",
    content: "Je m'appelle Aldebert, conteur de guilde, et j'ai parcouru bien des royaumes. Asseyez-vous, je vais vous conter ce monde. Ici, des villes se disputent la gloire, de simples hameaux qui rêvent de devenir des empires. Vous y serez citoyen, artisan ou stratège selon votre humeur.\n\nDeux destinées s'écrivent en même temps : celle de votre cité, qui monte de Hameau à Empire à force de richesses investies, et la vôtre, qui grandit de novice à légende par les ressources rares des terres sauvages.\n\nChaque aurore renouvelle les chances. Chaque crépuscule juge vos choix.",
    tip: "📜 Aldebert murmure : « Il n'est point de victoire définitive ici. Les villes s'élèvent, s'effondrent, et se relèvent. Bienvenue dans le monde des Guildes et Couronnes. »",
  },
  {
    category: "demarrage",
    icon: "⚒️",
    title: "Les huit corps de métier",
    content: "Nul ne peut tout faire seul. Voilà la première vérité de ce monde. Huit métiers se partagent le labeur : le Bûcheron abat les forêts, le Mineur creuse les entrailles de la terre, le Fermier nourrit les ventres, le Tisserand habille les corps, le Forgeron arme les bras, l'Alchimiste distille les mystères, l'Orfèvre fond les métaux précieux, et le Marchand fait circuler tout cela. Le Marchand jouit de privilèges singuliers : nulle taxe ne pèse sur ses achats au marché, et sa propre mairie lui rachète chaque jour jusqu'à deux cents pièces de marchandises brutes au prix du marché, même si l'Acheteur a fermé boutique.\n\nSans Mineur, les forges s'éteignent. Sans Fermier, les estomacs gargouillent. Voyez les bannières sur chaque métier : ✨ Rare signifie que la ville a besoin de vous, ❌ Saturé que vous serez noyé dans la foule.\n\nVous pouvez changer de métier depuis votre ville d'origine. Réfléchissez bien, la cité compte sur vous.",
    tip: "📜 Aldebert grogne : « J'ai vu des villes péricliter faute d'un seul Fermier. Choisissez votre métier selon les besoins de votre cité, pas selon votre caprice ! »",
  },
  {
    category: "demarrage",
    icon: "⚡",
    title: "La fatigue et la faim",
    content: "Deux jauges gouvernent votre quotidien, toutes visibles en haut de chaque page.\n\nLa faim et l'énergie partagent désormais le même fonctionnement : chaque action consomme 1 point au hasard entre les deux. Si la jauge tirée est vide, l'autre est utilisée à sa place. Si les deux sont à zéro, l'action est bloquée et il faut se reposer.\n\nLes deux jauges sont plafonnées à 15, plus un bonus selon votre logement : tente +2, cabane +5, maison +8, manoir +10.\n\nElles se régénèrent automatiquement : un point aléatoire toutes les 1h en tente, jusqu'à 30 minutes en manoir. La régen passive s'arrête à 5/15 ; au-delà il faut consommer ou dormir à la taverne. Le blé, la farine, le pain et le ragoût remontent la faim ; les herbes, l'extrait, la potion de soin et la potion d'endurance remontent l'énergie. La botte de paille et le miel des fées (chaudron) viennent s'ajouter aux réserves du ventre ; la tisane revigorante et la pierre énergétique (chaudron) à celles du nerf.",
    tip: "📜 Aldebert tapote son ventre : « Surveillez vos deux jauges dans la barre de statut en haut de page. Les pastilles colorées vous disent où vous en êtes d'un coup d'oeil. »",
  },
  {
    category: "demarrage",
    icon: "❤️",
    title: "Les points de vie",
    content: "Chaque chevalier a ses entrailles, et chaque entrailles ses limites. Vous démarrez à 10 points de vie, et chaque coup non paré au combat zoné vous en fait perdre un.\n\nÀ zéro point de vie, votre personnage est blessé pendant 48 heures. Vous restez intouchable durant cette période, mais vous ne pouvez plus relever de défi en combat. Une mauvaise nouvelle pour les ambitieux.\n\nLes points de vie ne sont pas restaurés par les potions : celles-ci ne servent désormais qu'à remonter votre énergie. Pour soigner vos blessures, il vous faudra patienter les 48 heures de convalescence, ou compter sur les soins de la taverne. Préparez-vous bien avant le combat, car aucun élixir miraculeux ne vous attend.",
    tip: "📜 Aldebert ouvre sa besace : « Vérifiez vos points de vie avant chaque défi. À zéro, vous serez bloqué deux jours pleins en convalescence. »",
  },

  // ═══ PRODUCTION & RÉCOLTE ═══
  {
    category: "production",
    icon: "📦",
    title: "Les vertus cachées des objets",
    content: "Ne sous-estimez jamais ce que vous portez ! Chaque item a ses effets propres, détaillés au survol dans votre inventaire.\n\nCertains agissent en passif, tant qu'ils restent dans votre sac : les planches et la tunique de travail réduisent vos délais de production, le fil et le tissu augmentent ce que vous pouvez transporter, la pierre taillée et les lingots de fer augmentent votre énergie maximale, le quartz et les lingots d'or réduisent vos taxes d'achat au marché. Le charbon, lui, ajoute discrètement +5% de chance de double rendement à toutes vos productions et récoltes : sa simple présence suffit, plus besoin de l'activer.\n\nLe sac de voyage, autrefois requis pour fabriquer du T4, est devenu un compagnon de route : tant qu'il dort dans votre inventaire, tous vos voyages durent moitié moins longtemps.\n\nL'outil multifonction s'use à chaque craft T4, avec une durabilité de 10 charges. Le T3 est libre, aucun outil n'est requis. Et si vous possédez un set d'Outils 🔧, chaque fabrication T4 vous offrira en bonus un objet T3 aléatoire (4 charges avant que les Outils ne se brisent).\n\nTous vos bonus actifs et passifs apparaissent en temps réel dans votre barre de statut, avec une explication au survol.",
    tip: "📜 Aldebert soulève sa besace : « Passez votre souris sur chaque item de votre inventaire. Le texte vous dira exactement ce qu'il fait et comment l'utiliser. »",
  },
  {
    category: "production",
    icon: "🌿",
    title: "Les biomes et la bénédiction",
    content: "Six contrées s'étendent au-delà des murailles : forêt, champs, mine, atelier, forge, guilde. Chacune abrite ses créatures à terrasser dans une grande épopée quotidienne.\n\nUne fois par jour, dans le biome de votre choix, vous lancez une expédition qui enchaîne cinq vagues de monstres successives, du plus faible au plus redoutable. Vos points de vie se transmettent d'une vague à l'autre, et un cataplasme peut vous soigner entre deux vagues. Si vous tombez à zéro point de vie ou que vous abandonnez, l'épopée s'arrête, et vous ne pourrez retenter qu'au prochain matin.\n\nLe combat contre les monstres est tactique : à chaque tour, vous lisez l'intention du monstre (la zone qu'il vise) et choisissez où parer. Une parade réussie évite les dégâts et permet de contre-attaquer. Vos armes et armures de combat ne servent pas contre les bêtes sauvages ; elles sont réservées aux duels entre humains.\n\nChaque vague vaincue rapporte de l'or et parfois un drop de la ressource rare du biome. Votre maîtrise du biome augmente avec chaque monstre tué, et vous débloque des paliers de bonus permanents (or, points de vie, drops).\n\nDès la première vague gagnée, une bénédiction biome d'une heure vous attend, peu importe votre métier : votre production s'emballe avec dix pour cent de chance de doubler les rendements et dix pour cent de réduction sur vos cooldowns. Si vous consommez un T1 du biome pendant cette heure, vous obtenez en prime un bonus de récolte de cinq minutes supplémentaires.",
    tip: "📜 Aldebert lève les yeux : « Une seule épopée par jour, cinq vagues à enchaîner. Lancez-vous dans le biome qui vous parle, vivez l'aventure, et profitez vite de la bénédiction qui s'ensuit. »",
  },
  {
    category: "production",
    icon: "🏪",
    title: "L'atelier ouvert",
    content: "Tout artisan peut ouvrir son atelier de production depuis l'onglet Production. Il fixe un tarif pour les objets de base et un autre pour les objets transformés. Un habitant de la même ville peut alors lui passer commande : il fournit ses propres ingrédients, paie le prix de service, et reçoit les items produits.\n\nLe cooldown, la faim et la fatigue sont ceux du client, pas ceux de l'artisan. Ses propres bonus s'appliquent aussi : buff biome, niveau personnel, bâtiments de cité.\n\nC'est une manière d'échanger des compétences plutôt que des marchandises. Et l'artisan peut dormir et ses marteaux travaillent encore.",
    tip: "📜 Aldebert sourit : « Le Forgeron dort, et ses marteaux travaillent encore. Voilà la magie de l'atelier ouvert. »",
  },
  {
    category: "production",
    icon: "⭐",
    title: "Les niveaux et l'expérience",
    content: "Au-delà de votre métier, votre personnage progresse au fil de ses peines. Chaque action vous rapporte de l'expérience : récolter un T1 vous donne 1 XP, fabriquer un T2 vous donne 2 XP, un T3 trois, un T4 cinq. Consommer du blé ou des herbes vous rapporte aussi de menus points. Mais c'est dans les terres sauvages que se gagnent les vrais titres : chaque ressource rare consommée depuis votre inventaire vous offre cent points d'expérience d'un coup.\n\nDe l'expérience naît le niveau, qui grimpe lentement de 1 à 50. Plus vous montez, plus vos cooldowns raccourcissent et plus vos chances de double production grimpent : un point de chacun par niveau gagné. Tous les cinq niveaux, un palier supplémentaire s'ouvre : cinq pour cent de chances en plus de drop rare dans les biomes.\n\nVotre niveau s'affiche en haut de chaque page sous une étoile dorée. Cliquez dessus pour voir votre progression vers le palier suivant et le détail de vos bonus actifs. Comme tous les autres bonus du jeu, ceux du niveau se cumulent multiplicativement avec votre logement, votre cité, votre métier et les bénédictions biome.",
    tip: "📜 Aldebert lève sa coupe : « Une légende ne se forge pas en un jour. Récoltez, transformez, défiez, et consommez vos drops rares pour avancer. Chaque niveau vous rend plus rapide et plus chanceux que la veille. »",
  },

  // ═══ ÉCONOMIE ═══
  {
    category: "economie",
    icon: "🏪",
    title: "Le marché et les taxes",
    content: "Chaque ville a son marché où les prix sont libres. Mais attention : quand vous achetez, la taxe n'est pas prélevée sur le champ. Elle s'accumule dans l'ombre tout au long du jour, ville par ville. À l'aube suivante, chaque mairie vient réclamer son dû séparément.\n\nAchetez dans trois villes différentes, et trois mairies tendront la main à l'aurore. Si vous n'avez pas assez d'or, une dette s'accumule et sera remboursée sur vos prochaines récompenses.\n\nLe Sceau royal de votre ville absorbe taxes et impôts jusqu'à cent dix pièces d'or. Le Parchemin vous accorde une réduction sur votre prochain voyage en prime.\n\nLe Marchand, lui, ne paie aucune taxe à l'achat : ses caravanes franchissent les portes sans laisser une seule pièce aux gardes.\n\nUne annonce non vendue expire au bout de trois jours. Les marchandises vous sont rendues, mais ne croyez pas qu'elles regagnent votre besace toutes seules : ouvrez l'onglet « Mes annonces » et cliquez sur Annuler pour les rapatrier. Tant que vous ne le faites pas, elles dorment chez le crieur.",
    tip: "📜 Aldebert cligne de l'oeil : « Regardez votre barre de statut : elle affiche les taxes accumulées en rouge. Bonne manière de ne pas avoir de surprise à l'aurore. »",
  },
  {
    category: "economie",
    icon: "📦",
    title: "Le marché unifié et les colis",
    content: "Toutes les annonces du royaume sont visibles depuis n'importe quelle ville. Que vous soyez au cœur de votre cité ou en voyage, vous voyez les offres de tous les marchés réunis. Vous pouvez acheter n'importe quoi à n'importe qui, peu importe la distance.\n\nMais attention : les marchandises ne se téléportent pas. Si vous achetez un item sur un marché de votre ville actuelle, il rejoint directement votre inventaire. Si vous achetez à distance, l'item part en colis et vous attend à la ville du vendeur. Vous le verrez apparaître dans la section « Mes colis » du marché, avec le nom de la ville de retrait.\n\nDeux moyens de récupérer un colis. Le premier : voyager dans la ville du vendeur et le retirer sur place. Aucun frais, juste le temps du voyage. Le second : si votre ville actuelle possède un Relais postal, ce bâtiment marchand peut vous livrer le colis pour cinq pièces d'or détruites par envoi. Pratique pour qui veut éviter les longs trajets.\n\nUn dernier détail qui compte : la taxe de marché s'applique à la ville du vendeur, pas à la vôtre. Acheter chez une cité au taux modeste reste un bon plan, même de loin.",
    tip: "📜 Aldebert tapote sa besace : « Acheter loin, c'est commercer avec le royaume entier. Mais ce qu'on achète, il faut aller le chercher, ou payer le coursier. À vous de calculer. »",
  },
  {
    category: "economie",
    icon: "🎯",
    title: "Les quêtes quotidiennes",
    content: "Chaque matin, jusqu'à six missions vous attendent dans l'onglet Quêtes. Fabriquer, vendre au marché, voyager vers une autre ville, approvisionner l'entrepôt de sa propre cité ou d'une ville étrangère. Les combinaisons varient selon votre métier.\n\nLes récompenses sont versées en or dès la validation. Vous les retrouvez dans le journal de votre tableau de bord, qui se met à jour automatiquement.\n\nSi vous possédez un Contrat artisan, une mission supplémentaire s'ouvre : forger cinq objets pour cent dix pièces d'or.\n\nCes missions expirent à l'aurore suivante. Planifiez votre route car certaines quêtes vous demandent de traverser des contrées lointaines.",
    tip: "📜 Aldebert consulte son parchemin : « Les quêtes de livraison en ville étrangère sont les plus lucratives. Préparez votre voyage et vos ressources avant de partir. »",
  },
  {
    category: "economie",
    icon: "📜",
    title: "Les contrats du marché",
    content: "Le marché ordinaire vous laisse vendre ce que vous possédez, en espérant que quelqu'un l'achètera. Mais que faire quand vous avez besoin de quelque chose de précis et que personne ne le propose ? Vous posez un contrat.\n\nDepuis l'onglet Contrats du marché, vous formulez une demande publique : tel item, telle quantité, telle récompense en or pour le livreur. Vous fixez les trois nombres librement, entre cinq et cinquante unités, et entre dix et mille pièces d'or de récompense. Au moment où vous validez, votre or quitte votre bourse : il sera détenu par la mairie en attendant la livraison, plus une taxe de trente pour cent qui revient à votre cité. Cette taxe est destinée à éviter les contrats fantaisistes : poser un contrat sérieux a un coût.\n\nVotre contrat reste ouvert pendant trois jours. Pendant ce temps, n'importe quel joueur peut le consulter et décider de livrer la marchandise demandée. Quand il valide la livraison, il prélève sur son inventaire la quantité exacte et empoche la totalité de la récompense. La mairie verse le tout instantanément.\n\nSi le contrat expire sans livreur au bout de trois jours, votre or vous est restitué (sauf la taxe, déjà versée à la cité : c'est le prix du risque). La marchandise non livrée n'arrive jamais, mais vous récupérez l'essentiel.\n\nDeux limites pratiques. D'abord, chaque joueur ne peut maintenir que cinq contrats actifs en même temps, pour éviter d'inonder le marché. Ensuite, certains items sont exclus du système : tout ce qui est équipable, et tout ce qui dépasse le tier 3. Les contrats existent pour les matières premières et les transformations courantes, pas pour les armes et les couronnes.\n\nUn conseil tactique : surveillez les prix moyens à sept jours qu'affiche l'écran. Une récompense trop basse n'attirera personne ; une récompense trop haute fera fortune au premier livreur venu. L'art du contrat est de fixer la prime au prix du marché ou légèrement au-dessus.",
    tip: "📜 Aldebert vous tend un parchemin vierge : « Quand le marché vous boude, le contrat vous écoute. Mais payez la juste prime : un livreur ne se déplace pas pour des miettes. Et surveillez vos cinq contrats actifs comme on surveille ses chevaux : on ne perd pas l'or qu'on a mis en jeu. »",
  },
  {
    category: "economie",
    icon: "⭐",
    title: "La prime au pionnier",
    content: "Changer de métier est normalement une décision coûteuse : cent pièces d'or, détruites au passage, prix de la rupture avec votre savoir-faire passé. Mais le royaume a besoin d'équilibre, et certains corps de métier se vident parfois plus vite que d'autres. Quand un métier devient critique pour la communauté, la mairie offre une prime au pionnier qui vient combler le manque.\n\nÀ tout moment, l'un des huit métiers porte un badge enflammé : très demandé. Ce statut est calculé automatiquement en croisant le nombre d'artisans actifs et le stock de leurs ressources de base sur les marchés. Quand un métier manque cruellement de bras et que ses ressources se font rares, son score grimpe en tête. Et quand un métier porte ce badge, pivoter vers lui devient gratuit. Pas vingt pièces, pas dix : zéro. La mairie absorbe le coût.\n\nLa règle est dynamique. Dès qu'un joueur bascule, le scoring se recalcule en temps réel : un autre métier prend la tête, et la prime se déplace. Il est donc parfaitement possible de pivoter gratuitement entre deux métiers en pénurie qui se relaient en tête. C'est même souhaitable : votre va-et-vient alimente les deux marchés, et le royaume y gagne.\n\nL'écran de changement de métier affiche en haut un bandeau jaune dès qu'une prime est active. Le métier concerné porte un badge spécial. Et le bouton de validation passe automatiquement en mode gratuit si vous le sélectionnez. Aucune démarche supplémentaire, aucun formulaire : la mairie reconnaît votre service et le récompense en silence.",
    tip: "📜 Aldebert hoche la tête, satisfait. « Suivez le badge enflammé, mon ami. Le royaume vous offre la migration. Et si vous oscillez entre deux métiers en pénurie, vous nourrissez deux marchés à la fois. Voilà ce qu'on appelle un bon citoyen. »",
  },

  // ═══ DUEL PERSONNEL ═══
  {
    category: "duel",
    icon: "🛡️",
    title: "L'équipement de combat zoné",
    content: "Quand viendra l'heure du duel entre humains, ce ne sont plus la maîtrise des biomes ni les ressources brutes qui décideront du sort. Ce sont vos équipements forgés sur mesure.\n\nVotre corps se découpe en quatre zones de défense : la tête, le torse, les bras, les jambes. À chacune correspond une armure dédiée : heaume, cuirasse, brassard, jambière, cousue par le Tisserand. Soit quatre emplacements de défense. À cela s'ajoute un seul emplacement d'attaque, votre épée principale, forgée par le Forgeron, capable de viser n'importe laquelle des quatre zones de votre adversaire.\n\nCinq emplacements en tout. Tous démarrent au grade 0 et offrent +1 d'effet. Plus le grade monte, plus le bonus grimpe : jusqu'à +6 au grade 5.\n\nVous gérez vos équipements depuis l'onglet Combat, où vous voyez en temps réel vos pièces équipées, leur grade, leur durabilité, et les boutons d'amélioration qui s'éclairent dès que vous avez les ressources nécessaires.",
    tip: "📜 Aldebert hoche la tête : « Une épée, quatre armures. Cinq pièces qui font de vous un guerrier. Choisissez votre voie : pure attaque, pure défense, ou polyvalence. »",
  },
  {
    category: "duel",
    icon: "⚒️",
    title: "L'amélioration des grades",
    content: "Un objet au grade 0, c'est mieux que rien, mais bien peu pour un guerrier qui se respecte. Pour le hisser jusqu'au grade 5, plus besoin de frapper à la porte d'aucun artisan. Tout se fait depuis votre onglet Combat, en libre-service.\n\nÀ chaque palier, vous consommez trois ressources brutes que vous récoltez vous-même ou achetez au marché : du Bois brut, du Minerai de fer, et du Quartz brut. Les quantités doublent à chaque grade. Quelques pièces suffisent pour le saut grade 0 vers grade 1, mais le passage du grade 4 au grade 5 réclame cinquante de chaque ressource principale, et bien davantage de quartz. Le grade 5 se mérite : comptez plusieurs semaines d'efforts coordonnés.\n\nL'épée coûte quatre fois plus cher qu'une armure, à grade équivalent. Logique : le défenseur a besoin de quatre armures pour couvrir tout son corps, l'attaquant n'a qu'une seule épée pour frapper partout.\n\nUn cooldown court suit chaque amélioration : entre une minute et seize minutes selon le palier. Mais ce cooldown s'applique pièce par pièce : pendant que votre cuirasse s'améliore, votre brassard reste disponible. Patience à doses homéopathiques.",
    tip: "📜 Aldebert sourit : « Cinq grades, autant de patience que de récolte. Nul artisan ne forgera votre légende à votre place. »",
  },
  {
    category: "duel",
    icon: "🛡️",
    title: "La durabilité et l'entretien",
    content: "Vos armes et armures ne sont pas éternelles. Chaque pièce équipée dispose de dix points de durabilité au départ. L'usure ne provient pas du temps qui passe : ce sont vos combats qui érodent l'acier, tant en duel qu'en épopée de biome.\n\nLa règle pour votre arme est plus subtile qu'il n'y paraît. À chaque coup que vous portez, l'arme prend un point d'usure systématique au moment où vous frappez. Mais si votre coup touche la cible, elle regagne immédiatement ce point en récompense. Net sur le tour : votre arme ne s'use que sur vos coups qui ratent. Touchez juste, et votre lame restera éternellement aiguisée.\n\nPour l'armure, chaque jet de défense réussi vous coûte un point sur la pièce qui défendait la zone touchée (bouclier si vous l'avez placé là, sinon armure de zone). Si le jet d'armure rate, elle reste intacte mais le coup passe. Une parade parfaite n'use rien : c'est l'art de la défense gratuite.\n\nÀ zéro point de durabilité, l'item reste dans son emplacement mais cesse de procurer son bonus. Il vous regarde tristement, vous rappelant qu'il faut le réparer.\n\nL'entretien se fait grâce au Marteau d'armurier, fabriqué par les Mineurs au tier 3. Sa consommation vous offre dix points de réparation à répartir librement entre vos six pièces équipées. Vous décidez où va chaque point : tout sur l'épée, ou cinq sur le bouclier et cinq sur la cuirasse, ou un point partout. Une fois consommé, le marteau est usé.\n\nL'épopée de biome use votre équipement de la même façon que le duel. Cinq vagues consécutives peuvent réduire significativement votre durabilité si vous ratez vos jets. Prévoyez toujours un ou deux marteaux d'armurier en stock, ou nouez de bons rapports avec un Mineur.",
    tip: "📜 Aldebert vous tend un marteau au manche usé : « Touchez juste, et votre lame ne s'use pas. C'est l'art du combat propre. Et gardez toujours un marteau de rab : la dura ne se refait pas toute seule. »",
  },
  {
    category: "duel",
    icon: "⚔️",
    title: "Le combat zoné entre humains",
    content: "Vient l'heure de croiser le fer. Quand vous défiez un autre joueur (de votre ville ou présent dans le même biome), vous choisissez d'abord la zone que vous attaquez : tête, torse, bras ou jambes. Votre adversaire reçoit alors un avis et dispose de douze heures pour choisir la zone qu'il défendra.\n\nLa mécanique se déroule en trois phases. D'abord, la parade : si votre adversaire devine la zone que vous visez, son arme tente d'intercepter votre coup. Plus sa durabilité d'arme est haute, plus la chance de réussite grimpe. Une parade réussie offre un bonus de +1 point de durabilité à l'arme du défenseur, comme une récompense pour son talent. Une parade ratée ne coûte rien : votre arme tient bon dans tous les cas.\n\nEnsuite, si la parade n'a pas eu lieu ou qu'elle a échoué, intervient votre jet d'attaque. Votre arme tente sa précision, basée sur sa durabilité courante. Si elle rate, le coup tombe à plat et votre lame perd un point d'usure pour son effort inutile. Si elle touche, le point de durabilité est immédiatement compensé : net, votre arme ne s'érode que sur les ratés.\n\nEnfin, si le coup touche, vient la phase de défense : l'armure de la zone visée tente d'amortir. Si elle réussit son jet, elle s'use d'un point et compare son grade au grade de votre épée. Voici le détail crucial : pour bloquer le coup, l'armure doit avoir un grade STRICTEMENT supérieur à celui de votre arme. À grade égal, le coup passe quand même. Un grade zéro contre un grade zéro signifie que vos coups portent. Cette règle empêche les combats sans fin entre joueurs en armure basique.\n\nSi le grade de l'armure surpasse celui de votre arme, le coup est bloqué : aucun dégât ne passe. Sinon, le dégât est encaissé. Si l'armure rate son jet de durabilité, elle reste intacte mais le coup la traverse directement.\n\nEn cas de coup réussi, vous prélevez de l'or sur votre cible et lui infligez un point de vie en moins. Le pourcentage d'or volé dépend du grade de votre épée : dix pour cent au grade 0, jusqu'à vingt-cinq pour cent au grade 5. Le butin reste plafonné à cent pièces par coup. La bourse de protection plafonne le vol subi à dix pièces d'or et encaisse exactement cinq attaques avant de se briser.\n\nUn même attaquant ne peut viser une même cible qu'une fois par jour. Mais plusieurs assaillants peuvent se relayer sur la même victime.",
    tip: "📜 Aldebert range son épée. « À grade égal, le coup passe : vos armures vous protègent vraiment quand elles surpassent l'arme adverse. C'est la science du duel, et c'est aussi pourquoi un grade au-dessus change tout. »",
  },
  {
    category: "duel",
    icon: "💰",
    title: "Le tableau des primes",
    content: "Quand un joueur vous nuit ou que vous voulez voir tomber un rival, point besoin de croiser le fer vous-même. Les primes existent pour cela. Depuis le tableau des primes, vous postez une récompense en or sur la tête d'une cible. L'or quitte votre bourse à l'instant où vous validez : la prime devient un contrat ouvert au royaume entier.\n\nDès lors, n'importe quel joueur qui défie cette cible et la bat en combat zoné empoche la totalité de la prime. La récompense suit la cible : peu importe la ville où elle se trouve, peu importe qui s'en charge, le premier vainqueur ramasse tout. Le bounty bascule alors en statut « réclamé » et disparaît du tableau.\n\nDeux règles à connaître. Vous ne pouvez pas réclamer votre propre prime : si vous battez votre propre cible, l'or n'est pas versé (mais le combat reste réglé normalement). Et plusieurs primes peuvent coexister sur la même tête : si trois joueurs ont posté chacun cinquante pièces, le premier vainqueur empoche les cent cinquante.\n\nLes primes restent actives jusqu'à ce qu'elles soient réclamées. Elles ne s'effacent ni par le voyage de la cible, ni par son changement de ville. Elles attendent leur dénouement.",
    tip: "📜 Aldebert sourit malicieusement : « L'or aiguise les épées des autres. Si vous craignez quelqu'un, postez sa prime, et laissez le royaume s'en occuper. C'est l'art de combattre sans se salir les mains. »",
  },
  {
    category: "duel",
    icon: "🐉",
    title: "L'arène du Dragon de Nuit",
    content: "Chaque matin, un Dragon de Nuit se dresse sur la place de l'arène. Sa carcasse compte cinq points de vie par aventurier actif de la semaine, figés au moment de son apparition. Le royaume entier peut le défier, mais le monstre ne tombera que sous l'effort collectif. Sur seize joueurs actifs, cela représente quatre-vingts points de vie à arracher.\n\nVous disposez d'une seule tentative par jour, et le combat est limité à trente tours. Quand vous lancez l'assaut, un verrou de dix minutes se pose sur le boss : nul autre ne peut l'engager avant que vous ne terminiez ou que le temps s'écoule.\n\nÀ chaque tour, vous choisissez trois actions simultanées : la zone que vous attaquez, la zone que vous parerez si le boss frappe au bon endroit, et la zone où vous placez votre bouclier en défense supplémentaire. Le système de parade, d'attaque et de défense reprend la mécanique du combat zoné, mais avec deux particularités propres au boss.\n\nPremièrement, le Dragon dispose lui aussi d'une armure sur ses quatre zones (tête, torse, bras, jambes) ainsi que d'un bouclier. Ces protections sont volontairement basiques (grade zéro) mais leurs durabilités tournent à dix points et bénéficient d'une régénération naturelle : chaque tour, chacune des cinq pièces a quarante pour cent de chances de regagner un point de durabilité. Le monstre s'entretient seul. Vos coups doivent donc être à la fois fréquents et précis pour épuiser sa résistance avant qu'il ne se reforge.\n\nDeuxièmement, le Dragon se régénère en santé. À chaque coup qu'il vous porte, il récupère un point de vie. Vous frappez sans relâche, mais lui ne s'épuise jamais sans aide. La seule façon de l'abattre est de faire pleuvoir les coups plus vite qu'il ne peut se soigner, à plusieurs si nécessaire.\n\nL'arme du Dragon possède son propre plancher : sa durabilité ne descend jamais en dessous de trois, garantissant qu'il reste menaçant même en fin de combat. Son grade évolue dynamiquement avec ses points de vie restants : plus il est blessé, plus son arme devient redoutable (grade cinq à pleine santé, jusqu'au grade dix en mode rage sous les trente-trois pour cent). Le mécanisme de déstabilisation peut rendre le boss vulnérable pour quelques tours si vous enchaînez deux coups consécutifs sans rater : son bouclier tombe alors hors de la défense temporairement.\n\nLes récompenses suivent la contribution. Chaque coup porté rapporte de l'or immédiat. Celui qui porte le coup fatal empoche trois cents points d'expérience, cinquante pièces d'or supplémentaires, et dix jetons de guilde. Un classement quotidien affiche les meilleurs contributeurs dès la première tentative.",
    tip: "📜 Aldebert lève les yeux vers le ciel. « Une bête qui se régénère à chaque morsure qu'elle inflige, et dont l'armure se reforge dans la nuit. Seuls, vous y laisserez vos os. À plusieurs, vous en ferez un trophée. Soignez votre équipement avant l'aube : le Dragon attend, et il ne pardonne pas l'amateurisme. »",
  },
  {
    category: "duel",
    icon: "💎",
    title: "Les gemmes serties dans l'équipement",
    content: "Au-delà du grade et de la durabilité, vos pièces d'équipement peuvent recevoir des gemmes serties, qui leur confèrent des pouvoirs particuliers durant les combats contre le Dragon de Nuit. Ces gemmes apparaissent uniquement dans les affrontements communautaires : elles restent muettes en duel zoné classique.\n\nDeux familles de gemmes existent. La première est dite de drain : sertie sur l'arme ou le bouclier, elle siphonne un peu d'énergie au boss à chaque interaction. Plus le drain est élevé, plus le monstre s'affaiblit lentement mais sûrement. La seconde famille est la régénération : sertie sur une pièce d'armure (tête, torse, bras, jambes) ou sur votre arme et votre bouclier, elle offre une chance, au début de chaque tour, de récupérer un point de durabilité sur la pièce concernée. Le pourcentage de réussite est défini par la qualité de la gemme.\n\nL'idée est simple à expliquer mais profonde à utiliser : un combattant léger fera tomber sa durabilité plus vite qu'un combattant gemme à fond, qui tiendra plus longtemps dans l'arène. Les gemmes de drain conviennent aux assauts rapides ; les gemmes de régénération conviennent aux combats longs et défensifs.\n\nLe sertissage se fait depuis votre onglet Combat. Une fois sertie, la gemme reste à demeure et s'active automatiquement à chaque combat boss. Aucune action particulière à effectuer durant le duel : votre équipement parle de lui-même.",
    tip: "📜 Aldebert hoche la tête, songeur. « Une lame sans gemme est une lame ordinaire. Une lame sertie est une lame qui pense un peu pour vous. Choisissez vos pierres comme vous choisiriez vos compagnons : selon ce que vous comptez affronter. »",
  },

  // ═══ MAIRIE & CITÉ ═══
  {
    category: "mairie",
    icon: "🏠",
    title: "Le logement et la renommée personnelle",
    content: "De la simple tente au manoir seigneurial, votre demeure influence votre quotidien sur trois plans : elle détermine la vitesse de régénération automatique de la faim et de l'énergie (de 1h en tente à 30min en manoir), elle augmente leur plafond maximum (de +2 à +10 sur chaque jauge), et elle agrandit votre inventaire. Le Meuble (objet T3) réduit de moitié le coût d'entretien de votre logement pendant dix jours.\n\nVotre grandeur ne se mesure pas qu'à votre toit. Elle tient aussi à ce que vous avez accompli dans les terres sauvages, à votre niveau d'expérience accumulé, et aux bonus que vous avez débloqués au fil des ans.\n\nTous ces bienfaits s'additionnent avec ceux de votre cité et des bénédictions des biomes.",
    tip: "📜 Aldebert pointe son doigt : « Votre logement, votre niveau, votre cité, vos bénédictions biome. Quatre sources de bonus qui s'empilent et vous rendent toujours plus efficace. Surveillez votre barre de statut : elle vous dit ce qui est actif. »",
  },
  {
    category: "mairie",
    icon: "🏗️",
    title: "L'entrepôt et les bâtiments",
    content: "Chaque bâtiment de la cité exige son tribut chaque nuit : la scierie réclame des planches, le moulin de la farine, la bergerie du fil. La taverne veut son pain. Si l'entrepôt est vide au petit matin, le bâtiment s'effondre. Simple et impitoyable.\n\nChaque résident de la ville consomme aussi une ressource brute par jour, prélevée directement dans l'entrepôt. Plus la ville est peuplée, plus l'entrepôt se vide vite. Le maire peut suivre l'état de ses stocks et les jours d'autonomie restants dans son tableau de bord.\n\nDéposez régulièrement vos matériaux transformés. Les bâtiments défensifs font exception : ils tombent après avoir servi, mais n'ont pas besoin d'entretien quotidien.\n\nLe Marchand, par son privilège, peut revendre n'importe quelle ressource brute à l'entrepôt de sa ville d'origine, même quand l'Acheteur n'a rien proposé. La mairie lui paie le prix moyen du marché, dans les limites raisonnables. Mais ses caravanes ont leur quota : deux cents pièces d'or par jour, pas une de plus, pour ne pas vider les coffres royaux à lui seul.",
    tip: "📜 Aldebert brandit un poing sévère : « J'ai vu une ville entière perdre sa fonderie en une nuit faute d'avoir rempli l'entrepôt. La négligence coûte cher. »",
  },
  {
    category: "mairie",
    icon: "👑",
    title: "La mairie et les officiers",
    content: "Chaque cité a son maire, élu tous les dix jours par les résidents. Le trône coûte vingt pièces d'or à briguer. Le maire fixe les taxes du marché et les impôts quotidiens. Trop gourmand, et les habitants partent ailleurs.\n\nLe maire peut nommer deux officiers parmi ses résidents, depuis l'onglet Habitants :\n\nLe Percepteur accède aux réglages d'impôts et taxes à la place du maire.\nL'Acheteur configure les offres de rachat de l'entrepôt.\n\nCes rôles s'affichent en badge à côté du nom de chaque joueur dans la liste des habitants. Si un officier déménage, il perd automatiquement sa charge.",
    tip: "📜 Aldebert souffle : « Un bon maire délègue. Donnez la comptabilité à celui qui sait compter, et les rachats à celui qui connaît les besoins de la ville. »",
  },
  {
    category: "mairie",
    icon: "📊",
    title: "Le tableau de bord du maire",
    content: "Le maire dispose d'un tableau de bord dédié dans l'onglet Gouvernance. Il y trouve tout ce qui concerne la santé de sa cité.\n\nLa trésorerie : entrées et sorties sur 24 heures ou 7 jours, résumé par source (taxes, impôts, péages, salaires), journal complet des transactions de la ville.\n\nL'entrepôt : stocks actuels par tier, avec une indication de jours d'autonomie restants pour chaque ressource consommée. Les pastilles rouges, oranges et vertes signalent l'urgence d'un réapprovisionnement.\n\nLes mouvements : qui a déposé quoi, ce que le reset nocturne a prélevé, les pénalités si l'entrepôt était vide.\n\nLes offres de rachat : si l'Acheteur (ou le maire) a configuré des prix d'achat, les habitants peuvent y vendre directement leurs surplus à la ville. Pratique pour assurer un approvisionnement régulier et donner un débouché stable aux producteurs.\n\nLa population : résidents, visiteurs, or de chacun.",
    tip: "📜 Aldebert pointe son registre : « Une pastille rouge, c'est une ressource qui manquera demain matin. Ne l'ignorez pas. »",
  },
  {
    category: "mairie",
    icon: "📈",
    title: "Les paliers de la cité",
    content: "La gloire d'une cité se mesure aux richesses qu'elle thésaurise. Les tiers (Hameau, Village, Bourg, Cité, Capitale, Empire) débloquent des bonus économiques pour tous les résidents — crafts plus rapides, voyages écourtés, taxes réduites. Le système actuel de progression est en cours de refonte : la prochaine version permettra à la mairie d'investir sa trésorerie directement pour monter les paliers, à raison d'un point par pièce d'or sacrifiée. En attendant, les villes restent au tier où elles sont parvenues.",
    tip: "📜 Aldebert sourit : « Un village donne à tous ses résidents dix pour cent de vitesse en plus, cumulé avec vos titres personnels et les bénédictions des biomes. Trois bonnes nouvelles à la fois. »",
  },
  {
    category: "mairie",
    icon: "🎉",
    title: "Les événements de mairie et la razzia",
    content: "Le maire dispose d'un nouvel onglet dans son hôtel de ville : les Événements. Sept actions s'offrent à lui, à condition d'investir l'entrepôt commun de la cité. Une seule action par jour et par mairie, alors le choix se médite.\n\nLa Course aux trésors coûte cent T1 et offre une seconde épopée du jour à tous les résidents. La Fête du travail coûte soixante-dix T1 et divise par deux le temps des crafts pour la journée. La Procession des routes coûte cinquante T1 et accélère d'autant les voyages. Le Festin royal coûte vingt T1 par résident et regarnit dix points d'énergie et dix points de faim à chaque habitant. La Bénédiction de l'abondance coûte cent T1 et ajoute cinq pour cent de chance de double production sur tous les crafts. La Forge collective coûte vingt T1 par résident et remet à neuf le quota quotidien de réparations.\n\nMais surtout : la Razzia. Investissez librement vos T1 dans cette opération, choisissez une cité voisine, et frappez sa trésorerie. Chaque ressource sacrifiée vole deux pièces d'or à l'ennemi. Sept jours de cooldown par cible. Et gare au dôme adverse : si la cible est protégée, vos ressources sont perdues sans rien rapporter en retour. Une cité avertie en vaut deux.\n\nTous les buffs durent jusqu'au prochain reset de l'aube et se cumulent multiplicativement avec vos autres bonus. Une mairie active fait toute la différence pour ses habitants.",
    tip: "📜 Aldebert tape sur la table : « Une mairie qui dort est une mairie qui se ratatine. Une mairie qui festoie, qui investit, qui razzie, voilà une mairie qui nourrit ses citoyens. Le maire est un cuisinier, pas un comptable. »",
  },

  // ═══ LOISIRS ═══
  {
    category: "loisirs",
    icon: "🎲",
    title: "La table de hazart, le hasard partagé",
    content: "Toute taverne du royaume vous donne accès à la table de hazart. Plus question de seuil minimum de joueurs présents : si la taverne est ouverte, vous pouvez vous y mettre. Et tout défi posé dans n'importe quelle cité est visible et acceptable depuis n'importe quelle autre. Le royaume entier est votre tablée.\n\nLes règles du jeu sont simples. Vous misez entre dix et deux cents pièces d'or, vous lancez vos trois dés sur le coup, vos dés sont scellés sur la table mais leur valeur reste secrète aux yeux des autres joueurs. Quiconque relève votre défi tente sa chance ensuite, sans savoir ce qu'il devra battre. Au plus haut score le pot, moins la commission de dix pour cent que retient le tavernier pour la peine. Une tierce, c'est-à-dire trois dés identiques, paie la mise au triple.\n\nVous pouvez retirer votre défi avant qu'il soit relevé, mais le tavernier garde la moitié de votre mise. C'est le prix à payer pour préserver l'honneur des joueurs : pas question de relancer ses dés indéfiniment jusqu'à obtenir un bon score.\n\nMaximum cinq parties par jour et par joueur. Au-delà, le tavernier vous coupe le passage : la maison veille sur les bourses.",
    tip: "📜 Aldebert chuchote : « J'ai vu un Forgeron sortir d'une taverne avec mille pièces et l'air d'un homme qui ne dormirait pas. À la table, le hasard ne flatte personne. »",
  },
  {
    category: "loisirs",
    icon: "🎰",
    title: "La loterie hebdomadaire du royaume",
    content: "Dans chaque taverne, le ménestrel tend désormais des billets de loterie aux passants. Cinq pièces d'or le billet, vingt billets maximum par semaine et par joueur. La cagnotte est commune à tout le royaume : peu importe la cité où vous achetez vos billets, vous misez dans le même pot.\n\nChaque lundi à l'aube, le sort tranche un seul gagnant. Plus vous avez acheté de billets, plus vos chances grimpent. Le vainqueur empoche quatre-vingt-quinze pour cent de la cagnotte ; les cinq pour cent restants partent en fumée pour le bien commun du royaume.\n\nLes cités sans taverne devront se déplacer pour participer. Voilà une raison de plus pour les hameaux modestes de bâtir cet édifice convivial.\n\nDix minutes avant le tirage, les ventes se ferment : nul ne peut venir grappiller des chances à la dernière seconde.",
    tip: "📜 Aldebert hoche la tête : « Cinq pièces, c'est peu. Mais les cinq pièces des autres font, parfois, votre fortune. »",
  },
  {
    category: "loisirs",
    icon: "🍯",
    title: "Le chaudron magique de la mairie",
    content: "Dans le sous-sol de chaque hôtel de ville mijote une vieille marmite enchantée. Chaque aurore, elle réclame quatre paires de matériaux tirés au sort : c'est le menu du jour, identique pour tout le royaume. Apportez ces composants à l'office du maire et payez huit pièces d'or, et vous pourrez cuisiner l'un des quinze grimoires d'effets que recèle l'alchimie ancienne.\n\nLes recettes se classent en trois rangs. Au rang 1, accessible à tous, vous savez exactement ce que vous obtenez. Aux rangs 2 et 3, l'évolution coûte deux cents puis huit cents pièces d'or virtuelles, et le résultat se révèle à la dernière minute selon des pondérations cachées : trente pour cent de chance d'un objet rang 1, soixante-dix pour cent d'un rang 2 au deuxième palier ; quinze, trente-cinq et cinquante pour cent réparti sur les trois rangs au troisième.\n\nLes objets cuisinés s'activent depuis votre inventaire. Talisman de protection, Pierre de feu pour les artisans pressés, Botte de paille pour calmer la faim, Philtre de chance, Parchemin marchand voleur d'or, Hibou messager espion, Plume de phénix résurrectrice, et bien d'autres. Quinze trésors à découvrir, et leur grimoire complet dans l'onglet Codex pour qui veut anticiper.\n\nUne marmite, une cuisson par jour. Choisissez bien ce que vous voulez infuser dans votre destin.",
    tip: "📜 Aldebert hume l'air avec un sourire malicieux : « L'alchimie n'est pas un commerce, c'est un pari. Au rang 1, vous êtes maître de votre potion. Au rang 3, vous êtes au mieux complice du chaudron. À vous de voir ce qui vous convient. »",
  },
  {
    category: "loisirs",
    icon: "🛡️",
    title: "Les objets à cible et le dôme bleuté",
    content: "Certains objets du chaudron ne s'activent pas sur vous-même mais sur une autre cité. Le Parchemin marchand vole vingt pièces d'or à la trésorerie d'une ville voisine. L'Étoile filante en vole cinquante. Le Hibou messager espionne une ville et vous rapporte ses stocks et son trésor. Quand vous activez l'un de ces objets, une fenêtre s'ouvre pour vous laisser choisir votre cible parmi les villes du royaume.\n\nMais attention : si la cible est protégée par un Talisman, vos objets se brisent contre un dôme bleuté sans rien rapporter. Le Talisman, justement, est l'œuvre d'un sage qui veut mettre sa cité à l'abri pendant douze heures. Une fois posé, le dôme apparaît clairement dans le panneau Événements de la mairie, avec son horaire de fin. Aucune razzia, aucun parchemin, aucune étoile filante ne pourra le percer.\n\nUn dôme et son temps : pesez bien le moment où vous l'utilisez. Les douze heures défilent vite quand vous dormez.",
    tip: "📜 Aldebert chuchote : « L'art de l'alchimie défensive : poser le dôme la veille d'une nuit où l'on suspecte des fauteurs de trouble. La paranoïa, voyez-vous, n'est qu'une forme appliquée de prudence. »",
  },

  // ═══ SYNTHÈSE ═══
  {
    category: "synthese",
    icon: "🏆",
    title: "Le concours mensuel et les quatre couronnes",
    content: "Chaque mois, le royaume compte ses meilleurs. Non pas un seul vainqueur, mais quatre, sur quatre disciplines distinctes : l'expérience gagnée, l'or amassé par vos ventes, les ressources que vous avez versées à l'entrepôt de votre cité, et les couronnes magiques que vous avez forgées au chaudron. Quatre classements indépendants, et un joueur peut briller sur les quatre à la fois.\n\nLe premier de chaque catégorie reçoit cent pièces d'or à minuit le premier de chaque mois. Le second, cinquante pièces. Le troisième, vingt. Et ces récompenses se cumulent : terminer premier en ventes ET en couronnes, c'est deux cents pièces d'or. Quatre catégories, jusqu'à quatre cents pièces d'or pour le citoyen complet.\n\nLes compteurs se réinitialisent automatiquement à votre première action du nouveau mois. Vendez quelque chose le premier juin, et vous repartez de zéro pour le concours de juin. Pas besoin d'attendre, pas besoin d'agir spécialement : la mécanique fait son office en silence.\n\nDepuis votre onglet Classement, un bandeau jaune vous rappelle en permanence les enjeux : combien d'or se joue, combien de temps reste avant la prochaine remise. Les trois premiers de chaque catégorie portent une pastille dorée affichant ce qu'ils empocheraient si le mois s'arrêtait à cet instant.\n\nLa diversité paie. Le marchand obsessionnel qui n'amasse que l'or pourra toucher cent pièces. Le joueur complet qui explore, qui craft, qui contribue, qui élève son rang, peut en toucher quatre cents. La leçon est claire : aucune métrique n'est plus précieuse qu'une autre, et la richesse durable se gagne en remplissant plusieurs cases à la fois.",
    tip: "📜 Aldebert frappe sur la table en désignant le tableau d'affichage : « Quatre concours, quatre coffres. Le citoyen qui ne se spécialise pas remporte plus que le spécialiste obstiné. Vendez, contribuez, forgez, progressez. Le premier du mois n'attendra pas. »",
  },
  {
    category: "synthese",
    icon: "🌅",
    title: "Une journée dans la vie d'un citoyen",
    content: "À l'aube, les taxes sont prélevées, les bâtiments entretenus, la cité repart. Votre première pensée du matin : vérifiez vos jauges, vos points de vie, et l'état de vos pièces équipées dans l'onglet Combat (la durabilité ne baisse plus la nuit, mais vos combats de la veille ont pu y laisser des traces).\n\nEnsuite : produisez, transformez, forgez. Accomplissez vos quêtes du jour. Lancez votre épopée quotidienne dans le biome de votre choix pendant que la bénédiction qui s'ensuit dure encore. Vendez vos surplus au marché. Récupérez vos colis si vous avez voyagé. Déposez vos matériaux à l'entrepôt communautaire.\n\nSi vous êtes un guerrier dans l'âme, montez vos grades depuis l'onglet Combat dès que vous avez les ressources, et entretenez vos équipements abîmés grâce à un Marteau d'armurier qui répartit dix points de réparation où bon vous semble. Et si vous cherchez la gloire personnelle, défiez un autre joueur en duel zoné, mais souvenez-vous qu'une blessure coûte deux jours de convalescence.\n\nSi vous êtes maire, consultez votre tableau de bord dans Gouvernance : trésorerie, stocks critiques, population, offres de rachat. Nommez vos officiers si vous ne l'avez pas encore fait.",
    tip: "📜 Aldebert résume d'un geste : « Outils, quêtes, biome, entrepôt, marché. Et de temps en temps, un duel pour le panache. Dans cet ordre, et vous dormez le ventre plein et la conscience tranquille. »",
  },
  {
    category: "synthese",
    icon: "♾️",
    title: "La route est longue, voyageur",
    content: "Voilà ce que j'avais à vous conter ce soir. Les villes naissent hameaux et aspirent à l'empire. Les hommes naissent novices et rêvent de légendes. L'entretien ronge les négligents. Les maires gouvernent et tombent. Les duellistes attaquent zone par zone, parent ou tombent. Rien n'est jamais acquis. C'est la beauté de ce monde.\n\nRevenez me voir si vous avez des questions. Je serai là, près du feu, avec d'autres histoires à raconter.",
    tip: "📜 Aldebert se lève et s'incline : « Bonne route, citoyen. Que vos forges ne s'éteignent jamais et que vos richesses fassent prospérer votre cité. Consultez ces pages à tout moment en cliquant sur le ❓ dans le menu. »",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────
export default function Tutorial({ onClose }) {
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState(STEPS[0].category);
  // mobileView : "categories" / "chapters" / "content" : gère la navigation à étages sur mobile
  const [mobileView, setMobileView] = useState("content");

  // Filtre les chapitres selon la recherche (titre + contenu + tip)
  const filteredSteps = useMemo(() => {
    if (!search.trim()) return null;
    const needle = search.toLowerCase().trim();
    return STEPS
      .map((s, idx) => ({ ...s, index: idx }))
      .filter(s =>
        s.title.toLowerCase().includes(needle) ||
        s.content.toLowerCase().includes(needle) ||
        (s.tip || "").toLowerCase().includes(needle)
      );
  }, [search]);

  // Chapitres de la catégorie active (hors recherche)
  const stepsInActiveCategory = useMemo(() => {
    return STEPS
      .map((s, idx) => ({ ...s, index: idx }))
      .filter(s => s.category === activeCategoryId);
  }, [activeCategoryId]);

  const current = STEPS[step];

  // Navigation : aller au chapitre N et synchroniser la catégorie active
  const goToStep = (idx) => {
    setStep(idx);
    setActiveCategoryId(STEPS[idx].category);
    setMobileView("content");
  };

  // Compteur par catégorie
  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const cat of CATEGORIES) {
      counts[cat.id] = STEPS.filter(s => s.category === cat.id).length;
    }
    return counts;
  }, []);

  // Highlight du terme recherché : entoure les occurrences avec <mark>
  const highlight = (text) => {
    if (!search.trim()) return text;
    const needle = search.trim();
    const re = new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    return text.split(re).map((part, i) =>
      i % 2 === 1
        ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/60 rounded px-0.5">{part}</mark>
        : part
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <Card className="w-full max-w-5xl border-2 border-primary/30 shadow-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col my-auto">

        {/* ── Header ── */}
        <div className="relative p-4 pb-3 border-b border-border shrink-0 flex items-center gap-3">
          <span className="text-2xl">📜</span>
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-lg font-bold leading-tight">Le grand livre d'Aldebert</h2>
            <p className="text-[11px] text-muted-foreground font-body italic">Tutoriel et chroniques du royaume</p>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* ── Barre de recherche ── */}
        <div className="p-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Chercher un thème, un mot-clé..."
              className="pl-8 h-9 text-sm font-body"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Effacer la recherche"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Corps : sidebar + contenu (desktop) ou navigation à étages (mobile) ── */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

          {/* MODE RECHERCHE : liste plate des résultats */}
          {filteredSteps && (
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 min-h-0">
              {filteredSteps.length === 0 ? (
                <p className="text-sm text-muted-foreground italic text-center py-8 font-body">
                  Aucun chapitre ne correspond à votre recherche.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground font-body mb-2">
                    {filteredSteps.length} chapitre{filteredSteps.length > 1 ? "s" : ""} trouvé{filteredSteps.length > 1 ? "s" : ""}
                  </p>
                  {filteredSteps.map((s) => (
                    <button
                      key={s.index}
                      onClick={() => { goToStep(s.index); setSearch(""); }}
                      className="w-full text-left p-3 rounded-lg border border-border hover:bg-primary/5 hover:border-primary/40 transition-colors flex gap-3"
                    >
                      <span className="text-2xl shrink-0">{s.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-semibold text-sm mb-1">{highlight(s.title)}</p>
                        <p className="text-xs text-muted-foreground font-body line-clamp-2">{highlight(s.content.substring(0, 200))}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* MODE NORMAL */}
          {!filteredSteps && (
            <>
              {/* Sidebar catégories : visible en desktop, conditionnelle en mobile */}
              <div className={`md:w-56 md:border-r border-border md:overflow-y-auto shrink-0 ${
                mobileView === "categories" ? "block flex-1 overflow-y-auto" : "hidden md:block"
              }`}>
                <div className="p-2 space-y-1">
                  {CATEGORIES.map(cat => {
                    const isActive = cat.id === activeCategoryId;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setActiveCategoryId(cat.id);
                          setMobileView("chapters");
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm font-body transition-colors flex items-center gap-2 ${
                          isActive
                            ? "bg-amber-700 text-white font-semibold shadow-sm dark:bg-amber-500 dark:text-stone-900"
                            : "hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        <span className="text-lg">{cat.icon}</span>
                        <span className="flex-1 min-w-0 truncate">{cat.label}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{categoryCounts[cat.id]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Liste des chapitres (mobile uniquement, vue=chapters) */}
              <div className={`flex-1 overflow-y-auto p-3 ${mobileView === "chapters" ? "block md:hidden" : "hidden"}`}>
                <button
                  onClick={() => setMobileView("categories")}
                  className="text-xs font-body text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Catégories</span>
                </button>
                <div className="space-y-1.5">
                  {stepsInActiveCategory.map((s) => (
                    <button
                      key={s.index}
                      onClick={() => goToStep(s.index)}
                      className={`w-full text-left p-2.5 rounded-md transition-colors flex items-center gap-2 ${
                        s.index === step
                          ? "bg-amber-700 text-white shadow-sm dark:bg-amber-500 dark:text-stone-900"
                          : "border border-transparent hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className="text-xl shrink-0">{s.icon}</span>
                      <span className="text-sm font-body flex-1 min-w-0 truncate">{s.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Contenu du chapitre courant */}
              <div className={`flex-1 overflow-y-auto min-h-0 ${
                mobileView === "content" ? "block" : "hidden md:block"
              }`}>
                {/* Bandeau navigation desktop : tabs horizontaux des chapitres de la cat active */}
                <div className="hidden md:flex flex-wrap gap-1 p-3 border-b border-border bg-muted/30">
                  {stepsInActiveCategory.map((s) => (
                    <button
                      key={s.index}
                      onClick={() => goToStep(s.index)}
                      className={`text-[11px] font-body px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                        s.index === step
                          ? "bg-amber-700 text-white shadow-sm dark:bg-amber-500 dark:text-stone-900"
                          : "bg-stone-50 dark:bg-stone-800 border border-stone-300 dark:border-stone-600 hover:bg-amber-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200"
                      }`}
                    >
                      <span>{s.icon}</span>
                      <span className="max-w-[160px] truncate">{s.title}</span>
                    </button>
                  ))}
                </div>

                {/* Bouton retour mobile */}
                <button
                  onClick={() => setMobileView("chapters")}
                  className="md:hidden text-xs font-body text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 pt-3"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>{CATEGORIES.find(c => c.id === activeCategoryId)?.label}</span>
                </button>

                {/* Contenu */}
                <div className="p-4 md:p-6 space-y-4">
                  <div className="text-center md:text-left space-y-2">
                    <span className="text-5xl">{current.icon}</span>
                    <h3 className="font-heading text-xl font-bold mt-2">{current.title}</h3>
                  </div>
                  <p className="font-body text-muted-foreground leading-relaxed text-sm whitespace-pre-line">{current.content}</p>
                  {current.tip && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
                      <p className="font-body text-sm italic">{current.tip}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Footer : navigation prev/next ── */}
        {!filteredSteps && mobileView === "content" && (
          <div className="border-t border-border p-3 shrink-0 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="font-body gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Précédent</span>
            </Button>
            <span className="text-[11px] text-muted-foreground font-body">
              {step + 1} / {STEPS.length}
            </span>
            {step < STEPS.length - 1 ? (
              <Button
                size="sm"
                onClick={() => goToStep(step + 1)}
                className="font-heading gap-1"
              >
                <span className="hidden sm:inline">Suivant</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={onClose} className="font-heading">
                En route ! ⚔️
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
