import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, ChevronLeft, X } from "lucide-react";

const STEPS = [
  {
    icon: "🕯️",
    title: "Approchez, voyageur…",
    content: "Je m'appelle Aldebert, conteur de guilde, et j'ai parcouru bien des royaumes. Asseyez-vous, je vais vous conter ce monde. Ici, des villes se disputent la gloire, de simples hameaux qui rêvent de devenir des empires. Vous y serez citoyen, artisan, soldat ou stratège selon votre humeur.\n\nDeux destinées s'écrivent en même temps : celle de votre cité, qui monte de Hameau à Empire à force de lingots royaux, et la vôtre, qui grandit de novice à légende par les ressources rares des terres sauvages.\n\nChaque aurore renouvelle les chances. Chaque crépuscule juge vos choix.",
    tip: "📜 Aldebert murmure : « Il n'est point de victoire définitive ici. Les villes s'élèvent, s'effondrent, et se relèvent. Bienvenue dans le monde des Guildes et Couronnes. »",
  },
  {
    icon: "⚒️",
    title: "Les huit corps de métier",
    content: "Nul ne peut tout faire seul. Voilà la première vérité de ce monde. Huit métiers se partagent le labeur : le Bûcheron abat les forêts, le Mineur creuse les entrailles de la terre, le Fermier nourrit les ventres, le Tisserand habille les corps, le Forgeron arme les bras, l'Alchimiste distille les mystères, l'Orfèvre fond les lingots royaux, et le Marchand fait circuler tout cela.\n\nSans Mineur, les forges s'éteignent. Sans Fermier, les estomacs gargouillent. Voyez les bannières sur chaque métier : ✨ Rare signifie que la ville a besoin de vous, ❌ Saturé que vous serez noyé dans la foule.\n\nVous pouvez changer de métier depuis votre ville d'origine. Réfléchissez bien, la cité compte sur vous.",
    tip: "📜 Aldebert grogne : « J'ai vu des villes péricliter faute d'un seul Fermier. Choisissez votre métier selon les besoins de votre cité, pas selon votre caprice ! »",
  },
  {
    icon: "⚡",
    title: "La fatigue et la faim",
    content: "Deux jauges gouvernent votre quotidien, toutes visibles en haut de chaque page.\n\nLa faim et l'énergie partagent désormais le même fonctionnement : chaque action consomme 1 point au hasard entre les deux. Si la jauge tirée est vide, l'autre est utilisée à sa place. Si les deux sont à zéro, l'action est bloquée et il faut se reposer.\n\nLes deux jauges sont plafonnées à 15, plus un bonus selon votre logement : tente +2, cabane +5, maison +8, manoir +10.\n\nElles se régénèrent automatiquement : un point aléatoire toutes les 1h en tente, jusqu'à 30 minutes en manoir. La régen passive s'arrête à 5/15 ; au-delà il faut consommer ou dormir à la taverne. Blé, farine et pain remontent la faim (1, 5 et 20 points instant) ; herbes, extrait et potion de soin remontent l'énergie (1, 5 et 20 points instant). Le ragoût et la potion d'endurance, eux, sont des ressources militaires : seul le maire les dépose en entrepôt depuis l'onglet Approvisionnement armée.",
    tip: "📜 Aldebert tapote son ventre : « Surveillez vos deux jauges dans la barre de statut en haut de page. Les pastilles colorées vous disent où vous en êtes d'un coup d'oeil. »",
  },
  {
    icon: "❤️",
    title: "Les points de vie",
    content: "Chaque chevalier a ses entrailles, et chaque entrailles ses limites. Vous démarrez à 10 points de vie, et chaque coup non paré au combat zoné vous en fait perdre un.\n\nÀ zéro point de vie, votre personnage est blessé pendant 48 heures. Vous restez intouchable durant cette période, mais votre ville ne peut plus compter sur vous : vous ne contribuez plus aucune unité à son armée. Une mauvaise nouvelle pour les généraux.\n\nLes points de vie ne sont pas restaurés par les potions : celles-ci ne servent désormais qu'à remonter votre énergie. Pour soigner vos blessures, il vous faudra patienter les 48 heures de convalescence, ou compter sur les soins de la taverne. Préparez-vous bien avant le combat, car aucun élixir miraculeux ne vous attend.",
    tip: "📜 Aldebert ouvre sa besace : « Vérifiez vos points de vie avant chaque défi. À zéro, vous serez bloqué deux jours pleins : ni attaque, ni défense, ni soutien à votre armée. »",
  },
  {
    icon: "📦",
    title: "Les vertus cachées des objets",
    content: "Ne sous-estimez jamais ce que vous portez ! Chaque item a ses effets propres, détaillés au survol dans votre inventaire.\n\nCertains agissent en passif, tant qu'ils restent dans votre sac : les planches et la tunique de travail réduisent vos délais de production, le fil et le tissu augmentent ce que vous pouvez transporter, la pierre taillée et les lingots de fer augmentent votre énergie maximale, le quartz et les lingots d'or réduisent vos taxes d'achat au marché. Le charbon, lui, ajoute discrètement +5% de chance de double rendement à toutes vos productions et récoltes : sa simple présence suffit, plus besoin de l'activer.\n\nLe sac de voyage, autrefois requis pour fabriquer du T4, est devenu un compagnon de route : tant qu'il dort dans votre inventaire, tous vos voyages durent moitié moins longtemps.\n\nL'outil multifonction et sa version renforcée s'usent à chaque craft de tier supérieur (T4 puis T5), avec une durabilité de 10 charges. Le T3, lui, est désormais libre : aucun outil requis. Et si vous possédez un set d'Outils 🔧, chaque fabrication T4 vous offrira en bonus un objet T3 aléatoire (4 charges avant que les Outils ne se brisent).\n\nTous vos bonus actifs et passifs apparaissent en temps réel dans votre barre de statut, avec une explication au survol.",
    tip: "📜 Aldebert soulève sa besace : « Passez votre souris sur chaque item de votre inventaire. Le texte vous dira exactement ce qu'il fait et comment l'utiliser. »",
  },
  {
    icon: "🌿",
    title: "Les biomes et la bénédiction",
    content: "Six contrées s'étendent au-delà des murailles : forêt, champs, mine, atelier, forge, guilde. Chacune abrite ses créatures à terrasser dans une grande épopée quotidienne.\n\nUne fois par jour, dans le biome de votre choix, vous lancez une expédition qui enchaîne cinq vagues de monstres successives, du plus faible au plus redoutable. Vos points de vie se transmettent d'une vague à l'autre, et un cataplasme peut vous soigner entre deux vagues. Si vous tombez à zéro point de vie ou que vous abandonnez, l'épopée s'arrête, et vous ne pourrez retenter qu'au prochain matin.\n\nLe combat contre les monstres est tactique : à chaque tour, vous lisez l'intention du monstre (la zone qu'il vise) et choisissez où parer. Une parade réussie évite les dégâts et permet de contre-attaquer. Vos armes et armures de combat ne servent pas contre les bêtes sauvages ; elles sont réservées aux duels entre humains.\n\nChaque vague vaincue rapporte de l'or et parfois un drop de la ressource rare du biome. Votre maîtrise du biome augmente avec chaque monstre tué, et vous débloque des paliers de bonus permanents (or, points de vie, drops).\n\nDès la première vague gagnée, une bénédiction biome d'une heure vous attend, peu importe votre métier : votre production s'emballe avec dix pour cent de chance de doubler les rendements et dix pour cent de réduction sur vos cooldowns. Si vous consommez un T1 du biome pendant cette heure, vous obtenez en prime un bonus de récolte de cinq minutes supplémentaires.",
    tip: "📜 Aldebert lève les yeux : « Une seule épopée par jour, cinq vagues à enchaîner. Lancez-vous dans le biome qui vous parle, vivez l'aventure, et profitez vite de la bénédiction qui s'ensuit. »",
  },
  {
    icon: "🏪",
    title: "Le marché et les taxes",
    content: "Chaque ville a son marché où les prix sont libres. Mais attention : quand vous achetez, la taxe n'est pas prélevée sur le champ. Elle s'accumule dans l'ombre tout au long du jour, ville par ville. À l'aube suivante, chaque mairie vient réclamer son dû séparément.\n\nAchetez dans trois villes différentes, et trois mairies tendront la main à l'aurore. Si vous n'avez pas assez d'or, une dette s'accumule et sera remboursée sur vos prochaines récompenses.\n\nLe Sceau royal de votre ville absorbe taxes et impôts jusqu'à cent dix pièces d'or. Le Parchemin vous accorde une réduction sur votre prochain voyage en prime.\n\nUne annonce non vendue expire au bout de trois jours et les marchandises vous sont rendues automatiquement.",
    tip: "📜 Aldebert cligne de l'oeil : « Regardez votre barre de statut : elle affiche les taxes accumulées en rouge. Bonne manière de ne pas avoir de surprise à l'aurore. »",
  },
  {
    icon: "🎯",
    title: "Les quêtes quotidiennes",
    content: "Chaque matin, jusqu'à six missions vous attendent dans l'onglet Quêtes. Fabriquer, vendre au marché, voyager vers une autre ville, approvisionner l'entrepôt de sa propre cité ou d'une ville étrangère. Les combinaisons varient selon votre métier.\n\nLes récompenses sont versées en or dès la validation. Vous les retrouvez dans le journal de votre tableau de bord, qui se met à jour automatiquement.\n\nSi vous possédez un Contrat artisan, une mission supplémentaire s'ouvre : forger cinq objets pour cent dix pièces d'or.\n\nCes missions expirent à l'aurore suivante. Planifiez votre route car certaines quêtes vous demandent de traverser des contrées lointaines.",
    tip: "📜 Aldebert consulte son parchemin : « Les quêtes de livraison en ville étrangère sont les plus lucratives. Préparez votre voyage et vos ressources avant de partir. »",
  },
  {
    icon: "🏠",
    title: "Le logement et la renommée personnelle",
    content: "De la simple tente au manoir seigneurial, votre demeure influence votre quotidien sur trois plans : elle détermine la vitesse de régénération automatique de la faim et de l'énergie (de 1h en tente à 30min en manoir), elle augmente leur plafond maximum (de +2 à +10 sur chaque jauge), et elle agrandit votre inventaire. Le Meuble (objet T3) réduit de moitié le coût d'entretien de votre logement pendant dix jours.\n\nVotre grandeur ne se mesure pas qu'à votre toit. Elle tient aussi à ce que vous avez accompli dans les terres sauvages. Chaque ressource rare consommée vous fait grimper dans les rangs, du novice jusqu'à la légende. Et chaque rang gagné vous rend plus rapide à la production, et plus chanceux pour doubler vos récoltes.\n\nTous ces bienfaits s'additionnent avec ceux de votre cité et des bénédictions des biomes.",
    tip: "📜 Aldebert pointe son doigt : « Dès votre deuxième titre, vous travaillez plus vite et doublez parfois votre production. Regardez vos bonus actifs dans la barre de statut. »",
  },
  {
    icon: "🏗️",
    title: "L'entrepôt et les bâtiments",
    content: "Chaque bâtiment de la cité exige son tribut chaque nuit : la scierie réclame des planches, le moulin de la farine, la bergerie du fil. La taverne veut son pain. Si l'entrepôt est vide au petit matin, le bâtiment s'effondre. Simple et impitoyable.\n\nChaque résident de la ville consomme aussi une ressource brute par jour, prélevée directement dans l'entrepôt. Plus la ville est peuplée, plus l'entrepôt se vide vite. Le maire peut suivre l'état de ses stocks et les jours d'autonomie restants dans son tableau de bord.\n\nDéposez régulièrement vos matériaux transformés. Les bâtiments défensifs font exception : ils tombent après avoir servi, mais n'ont pas besoin d'entretien quotidien.",
    tip: "📜 Aldebert brandit un poing sévère : « J'ai vu une ville entière perdre sa fonderie en une nuit faute d'avoir rempli l'entrepôt. La négligence coûte cher. »",
  },
  {
    icon: "👑",
    title: "La mairie et les officiers",
    content: "Chaque cité a son maire, élu tous les dix jours par les résidents. Le trône coûte vingt pièces d'or à briguer. Le maire fixe les taxes du marché et les impôts quotidiens. Trop gourmand, et les habitants partent ailleurs.\n\nLe maire peut nommer trois officiers parmi ses résidents, depuis l'onglet Habitants :\n\nLe Percepteur accède aux réglages d'impôts et taxes à la place du maire.\nLe Chef de guerre gère l'onglet armée et les campagnes militaires.\nL'Acheteur configure les offres de rachat de l'entrepôt.\n\nCes rôles s'affichent en badge à côté du nom de chaque joueur dans la liste des habitants. Si un officier déménage, il perd automatiquement sa charge.",
    tip: "📜 Aldebert souffle : « Un bon maire délègue. Donnez les clés de la guerre à celui qui veut se battre, et la comptabilité à celui qui sait compter. »",
  },
  {
    icon: "📊",
    title: "Le tableau de bord du maire",
    content: "Le maire dispose d'un tableau de bord dédié dans l'onglet Gouvernance. Il y trouve tout ce qui concerne la santé de sa cité.\n\nLa trésorerie : entrées et sorties sur 24 heures ou 7 jours, résumé par source (taxes, impôts, péages, salaires), journal complet des transactions de la ville.\n\nL'entrepôt : stocks actuels par tier, avec une indication de jours d'autonomie restants pour chaque ressource consommée. Les pastilles rouges, oranges et vertes signalent l'urgence d'un réapprovisionnement.\n\nLes mouvements : qui a déposé quoi, ce que le reset nocturne a prélevé, les pénalités si l'entrepôt était vide.\n\nLa population : résidents, visiteurs, or de chacun.",
    tip: "📜 Aldebert pointe son registre : « Une pastille rouge, c'est une ressource qui manquera demain matin. Ne l'ignorez pas. »",
  },
  {
    icon: "📈",
    title: "Les paliers de la cité",
    content: "La gloire d'une ville se mesure aux lingots royaux que les orfèvres livrent à la mairie. Dix lingots, et le hameau devient village et tous ses habitants travaillent dix pour cent plus vite. Trente lingots, et c'est le bourg avec ses propres avantages économiques. Puis la cité, la capitale, l'empire.\n\nMais ces lingots peuvent être saisis lors d'une guerre. Voilà pourquoi les armées existent et pourquoi l'entrepôt doit rester bien gardé.",
    tip: "📜 Aldebert sourit : « Un village donne à tous ses résidents dix pour cent de vitesse en plus, cumulé avec vos titres personnels et les bénédictions des biomes. Trois bonnes nouvelles à la fois. »",
  },
  {
    icon: "🛡️",
    title: "L'équipement de combat zoné",
    content: "Quand viendra l'heure du duel entre humains, ce ne sont plus la maîtrise des biomes ni les ressources brutes qui décideront du sort. Ce sont vos équipements forgés sur mesure.\n\nVotre corps se découpe en quatre zones de défense : la tête, le torse, les bras, les jambes. À chacune correspond une armure dédiée : heaume, cuirasse, brassard, jambière, cousue par le Tisserand. Soit quatre emplacements de défense. À cela s'ajoute un seul emplacement d'attaque, votre épée principale, forgée par le Forgeron, capable de viser n'importe laquelle des quatre zones de votre adversaire.\n\nCinq emplacements en tout. Tous démarrent au grade 0 et offrent +1 d'effet. Plus le grade monte, plus le bonus grimpe : jusqu'à +6 au grade 5.\n\nVous gérez vos équipements depuis l'onglet Combat, où vous voyez en temps réel vos pièces équipées, leur grade, leur durabilité, et les boutons d'amélioration qui s'éclairent dès que vous avez les ressources nécessaires.",
    tip: "📜 Aldebert hoche la tête : « Une épée, quatre armures. Cinq pièces qui font de vous un guerrier. Choisissez votre voie : pure attaque, pure défense, ou polyvalence. »",
  },
  {
    icon: "⚒️",
    title: "L'amélioration des grades",
    content: "Un objet au grade 0, c'est mieux que rien, mais bien peu pour un guerrier qui se respecte. Pour le hisser jusqu'au grade 5, plus besoin de frapper à la porte d'aucun artisan. Tout se fait depuis votre onglet Combat, en libre-service.\n\nÀ chaque palier, vous consommez trois ressources brutes que vous récoltez vous-même ou achetez au marché : du Bois brut, du Minerai de fer, et du Quartz brut. Les quantités doublent à chaque grade. Quelques pièces suffisent pour le saut grade 0 vers grade 1, mais le passage du grade 4 au grade 5 réclame cinquante de chaque ressource principale, et bien davantage de quartz. Le grade 5 se mérite : comptez plusieurs semaines d'efforts coordonnés.\n\nL'épée coûte quatre fois plus cher qu'une armure, à grade équivalent. Logique : le défenseur a besoin de quatre armures pour couvrir tout son corps, l'attaquant n'a qu'une seule épée pour frapper partout.\n\nUn cooldown court suit chaque amélioration : entre une minute et seize minutes selon le palier. Mais ce cooldown s'applique pièce par pièce : pendant que votre cuirasse s'améliore, votre brassard reste disponible. Patience à doses homéopathiques.",
    tip: "📜 Aldebert sourit : « Cinq grades, autant de patience que de récolte. Nul artisan ne forgera votre légende à votre place. »",
  },
  {
    icon: "🛡️",
    title: "La durabilité et la réparation",
    content: "Vos armes et armures ne sont pas éternelles. Chaque pièce équipée dispose de dix points de durabilité au départ. L'usure ne provient plus du temps qui passe : ce sont vos combats qui érodent l'acier.\n\nQuand vous attaquez un autre joueur en duel, votre épée perd un point de durabilité à chaque coup porté, peu importe le résultat. Quand vous êtes attaqué et que vous prenez un coup, l'objet qui défendait la zone touchée perd un point : armure de zone ou bouclier si vous l'aviez placé là. Une parade parfaite ou un coup absorbé sans dégât n'use rien.\n\nÀ zéro point de durabilité, l'item reste dans son emplacement, mais cesse de procurer son bonus d'attaque ou de défense. Il vous regarde tristement, vous rappelant qu'il faut le réparer.\n\nLa réparation ne demande ni or ni artisan, juste deux ressources humbles. Une Pierre rend un point de durabilité à votre épée. Une Laine brute rend un point de durabilité à l'une de vos armures. Tout cela se gère depuis l'onglet Combat, où chaque pièce équipée affiche un bouton « 🔧 Réparer » à côté du bouton d'amélioration.\n\nLes combats de biome (épopée quotidienne) n'usent rien : seul le PvP entre humains érode votre équipement.",
    tip: "📜 Aldebert tend une pierre et un brin de laine : « Vos lames vivent au rythme de vos batailles. Plus vous attaquez, plus vous devez réparer. Le berger et le carrier deviennent vos meilleurs amis. »",
  },
  {
    icon: "⚔️",
    title: "Le combat zoné entre humains",
    content: "Vient l'heure de croiser le fer. Quand vous défiez un autre joueur (de votre ville ou présent dans le même biome), vous choisissez d'abord la zone que vous attaquez : tête, torse, bras ou jambes. Votre adversaire reçoit alors un avis et dispose de douze heures pour choisir la zone qu'il défendra.\n\nSi les deux zones coïncident, le coup est paré. Aucun dégât ne tombe, et le défenseur peut riposter à son tour pour douze heures, en choisissant à son tour la zone qu'il attaque.\n\nSi les deux zones diffèrent, on compare votre score d'attaque sur la zone visée au score de défense de votre adversaire sur cette même zone. Le plus fort l'emporte. En cas de victoire, vous prélevez de l'or sur votre cible et lui infligez un point de vie en moins.\n\nLe pourcentage d'or volé dépend du grade de votre épée : dix pour cent au grade 0, jusqu'à vingt-cinq pour cent au grade 5. Le butin reste plafonné à cent pièces par coup. La bourse de protection, elle, plafonne le vol subi à dix pièces d'or et encaisse exactement cinq attaques avant de se briser pour de bon.\n\nUn même attaquant ne peut viser une même cible qu'une fois par jour. Mais plusieurs assaillants peuvent se relayer sur la même victime.",
    tip: "📜 Aldebert range son épée : « La parade laisse intact. Le coup non paré coûte un point de vie. Et un combattant à zéro point de vie ne sert plus son armée pendant deux jours. Voilà le vrai prix du sang. »",
  },
  {
    icon: "⚔️",
    title: "L'armée et la gouvernance militaire",
    content: "Six types de guerriers se recrutent dans l'onglet Gouvernance : milicien, archer, fantassin, cavalier, catapulte, chevalier. Chacun a ses forces et ses faiblesses. Les archers transpercent la cavalerie. La catapulte réduit la défense adverse de trente pour cent. Le chevalier est redoutable mais coûte des lingots d'or.\n\nChaque unité réclame son entretien chaque nuit sur les ressources de l'entrepôt. Une garnison mal nourrie fond au petit matin.\n\nN'oubliez pas : un citoyen blessé (zéro point de vie) ne contribue plus aucune unité à son armée pendant deux jours. Les coups portés sur vos soldats sont aussi des coups portés à votre cité.\n\nLe Chef de guerre nommé par le maire accède à cet onglet et peut gérer les troupes en autonomie.\n\n📖 Pour le détail des chiffres (attaque, défense, pertes selon ratio…), ouvrez le panneau Campagne et cliquez sur « Comprendre les combats ».",
    tip: "📜 Aldebert fronce les sourcils : « Une garnison bien nourrie, c'est la fondation de toute victoire. Négligez l'entrepôt, et vos soldats désertent. »",
  },
  {
    icon: "🗺️",
    title: "La guerre et les routes",
    content: "Seul le maire peut sonner le tocsin, ou le Chef de guerre qu'il a désigné. Il désigne une ville voisine reliée par une route, car nul ne marche à travers des terres sans chemin.\n\nUne fois l'attaque déclarée, trente minutes s'écoulent pendant lesquelles les résidents envoient leurs unités à la bataille. Les soldats quittent la garnison et la cité se retrouve temporairement à découvert. L'armée marche selon la durée de la route. À l'arrivée, le combat se règle seul.\n\nLa ville défenderesse est prévenue dès le départ de l'armée. Elle a le temps de se préparer, de recruter, d'organiser sa résistance.",
    tip: "📜 Aldebert baisse la voix : « Si vous envoyez toute votre garnison attaquer, votre ville est nue. Un ennemi malin peut en profiter pour frapper derrière vous. »",
  },
  {
    icon: "🗡️",
    title: "Le sabotage dans l'ombre",
    content: "Chaque maître artisan peut forger un objet de nuisance qui frappe dans l'ombre. L'huile inflammable détruit un bâtiment ennemi. La poudre corrosive ravage leurs réserves. Le festin empoisonné affame leurs habitants pendant deux jours. La clé forgée dérobe des lingots à leur mairie. L'élixir de discorde détourne leurs taxes vers votre ville. La lettre de désinformation alourdit leurs impôts.\n\nSept bâtiments défensifs peuvent parer ces coups, mais chacun tombe après usage.\n\nLe Contrat noble, lui, annule la prochaine attaque T5 ennemie sur votre cité.",
    tip: "📜 Aldebert sourit en coin : « Sabotage et guerre simultanés sur une même ville, voilà comment on brise un empire en une semaine. Coordonnez-vous. »",
  },
  {
    icon: "🏰",
    title: "La stratégie d'attaque de ville",
    content: "Briser une cité ne se fait pas d'un coup d'épée, voyageur. Cela se prépare en plusieurs actes, comme une pièce de théâtre. Voici l'art de la guerre tel que je l'ai vu pratiquer par les meilleurs stratèges.\n\nActe premier : affaiblir les défenseurs. Repérez les guerriers de la cité ennemie, ceux dont l'épée brille fort et dont les armures sont bien forgées. Défiez-les en combat zoné, faites tomber leurs points de vie à zéro. Tant qu'ils sont blessés, ils ne contribuent plus à l'armée. Quarante-huit heures de répit pour vous, et leurs équipements continuent même de s'user pendant qu'ils sont au lit.\n\nActe deuxième : empoisonner l'arrière-pays. Avant l'assaut, lâchez l'huile inflammable pour détruire un bâtiment-clé, le festin empoisonné pour affamer les habitants, la lettre de désinformation pour vider leurs caisses. Une cité affaiblie est une cité qui résiste mal.\n\nActe troisième : sonner le tocsin. Lancez la guerre quand l'ennemi est à genoux. Ses citoyens blessés ne peuvent renforcer la garnison, ses bâtiments défensifs sont peut-être déjà tombés sous les sabotages, son trésor est à sec.\n\nActe quatrième : le butin. La victoire vous donne accès à leurs lingots royaux, qui ralentissent leur progression de palier. Voilà le vrai trophée. Tout le reste n'est que poussière.",
    tip: "📜 Aldebert regarde au loin : « Une guerre se gagne avant qu'elle ne commence. Affaiblir, saboter, frapper. Trois actes, un empire à genoux. »",
  },
  {
    icon: "🏪",
    title: "L'atelier ouvert",
    content: "Tout artisan peut ouvrir son atelier de production depuis l'onglet Production. Il fixe un tarif pour les objets de base et un autre pour les objets transformés. Un habitant de la même ville peut alors lui passer commande : il fournit ses propres ingrédients, paie le prix de service, et reçoit les items produits.\n\nLe cooldown, la faim et la fatigue sont ceux du client, pas ceux de l'artisan. Ses propres bonus s'appliquent aussi : buff biome, rang personnel.\n\nC'est une manière d'échanger des compétences plutôt que des marchandises. Et l'artisan peut dormir et ses marteaux travaillent encore.",
    tip: "📜 Aldebert sourit : « Le Forgeron dort, et ses marteaux travaillent encore. Voilà la magie de l'atelier ouvert. »",
  },
  {
    icon: "🎲",
    title: "La table de hazart, le hasard partagé",
    content: "Toute taverne du royaume vous donne accès à la table de hazart. Plus question de seuil minimum de joueurs présents : si la taverne est ouverte, vous pouvez vous y mettre. Et tout défi posé dans n'importe quelle cité est visible et acceptable depuis n'importe quelle autre. Le royaume entier est votre tablée.\n\nLes règles du jeu sont simples. Vous misez entre dix et deux cents pièces d'or, vous lancez vos trois dés sur le coup, vos dés sont scellés sur la table mais leur valeur reste secrète aux yeux des autres joueurs. Quiconque relève votre défi tente sa chance ensuite, sans savoir ce qu'il devra battre. Au plus haut score le pot, moins la commission de dix pour cent que retient le tavernier pour la peine. Une tierce, c'est-à-dire trois dés identiques, paie la mise au triple.\n\nVous pouvez retirer votre défi avant qu'il soit relevé, mais le tavernier garde la moitié de votre mise. C'est le prix à payer pour préserver l'honneur des joueurs : pas question de relancer ses dés indéfiniment jusqu'à obtenir un bon score.\n\nMaximum cinq parties par jour et par joueur. Au-delà, le tavernier vous coupe le passage : la maison veille sur les bourses.",
    tip: "📜 Aldebert chuchote : « J'ai vu un Forgeron sortir d'une taverne avec mille pièces et l'air d'un homme qui ne dormirait pas. À la table, le hasard ne flatte personne. »",
  },
  {
    icon: "🎰",
    title: "La loterie hebdomadaire du royaume",
    content: "Dans chaque taverne, le ménestrel tend désormais des billets de loterie aux passants. Cinq pièces d'or le billet, vingt billets maximum par semaine et par joueur. La cagnotte est commune à tout le royaume : peu importe la cité où vous achetez vos billets, vous misez dans le même pot.\n\nChaque lundi à l'aube, le sort tranche un seul gagnant. Plus vous avez acheté de billets, plus vos chances grimpent. Le vainqueur empoche quatre-vingt-quinze pour cent de la cagnotte ; les cinq pour cent restants partent en fumée pour le bien commun du royaume.\n\nLes cités sans taverne devront se déplacer pour participer. Voilà une raison de plus pour les hameaux modestes de bâtir cet édifice convivial.\n\nDix minutes avant le tirage, les ventes se ferment : nul ne peut venir grappiller des chances à la dernière seconde.",
    tip: "📜 Aldebert hoche la tête : « Cinq pièces, c'est peu. Mais les cinq pièces des autres font, parfois, votre fortune. »",
  },
  {
    icon: "🗿",
    title: "La Statue royale itinérante",
    content: "Une œuvre d'art dorée parcourt le royaume. Chaque aurore, elle change de cité au gré du hasard. Là où elle se pose, un onglet apparaît dans la mairie, et tous les habitants peuvent y déposer leurs offrandes. Les ressources brutes, les denrées, les objets transformés : tout ce qui n'est pas un objet de prestige (les T5 ne sont pas acceptés).\n\nChaque don est valorisé en or virtuel selon les prix du marché du moment. Une planche, un fil, un lingot, autant de biens qui rejoignent le cumul royal. Une seule offrande par jour et par personne, mais sans limite de quantité : à vous de jauger ce que vous voulez sacrifier.\n\nLe cumul collectif débloque cinq paliers de bénédictions tant que le cycle dure : cooldown de craft réduit, quête bonus, drops augmentés, voyages accélérés, et au sommet, une capacité de farm en absence triplée. Plus vous donnez collectivement, plus vous récoltez ensemble.\n\nTous les quinze jours, la statue rend son verdict. Les trois plus généreux empochent des récompenses substantielles. Tous les contributeurs reçoivent leur juste part au prorata de leur générosité. Trente pour cent du cumul retourne au néant, comme un tribut au royaume.\n\nLa statue ne révèle pas ses gagnants pendant le cycle, mais elle vous murmure combien il vous manque pour entrer dans le Top 3. Elle ne se montre que dans la cité où elle se trouve : si vous voulez la trouver, voyagez.",
    tip: "📜 Aldebert sourit : « La couronne récompense les généreux, et le hasard ne sait jamais où ils se cachent. À l'aurore, la statue s'envole. Suivez-la, ou laissez-la venir à vous. »",
  },
  {
    icon: "🌅",
    title: "Une journée dans la vie d'un citoyen",
    content: "À l'aube, les taxes sont prélevées, les bâtiments entretenus, les soldats nourris. Votre première pensée du matin : vérifiez vos jauges, vos points de vie, et l'état de vos pièces équipées dans l'onglet Combat (la durabilité ne baisse plus la nuit, mais vos combats de la veille ont pu y laisser des traces).\n\nEnsuite : produisez, transformez, forgez. Accomplissez vos quêtes du jour. Lancez votre épopée quotidienne dans le biome de votre choix pendant que la bénédiction qui s'ensuit dure encore. Vendez vos surplus au marché. Déposez vos matériaux à l'entrepôt communautaire.\n\nSi vous êtes un guerrier dans l'âme, montez vos grades depuis l'onglet Combat dès que vous avez les ressources, et entretenez vos équipements avec une pierre pour l'épée et des laines brutes pour vos armures. Et si vous cherchez la gloire personnelle, défiez un autre joueur en duel zoné, mais souvenez-vous qu'une blessure coûte deux jours de service militaire.\n\nSi vous êtes maire, consultez votre tableau de bord dans Gouvernance : trésorerie, stocks critiques, population. Nommez vos officiers si vous ne l'avez pas encore fait.",
    tip: "📜 Aldebert résume d'un geste : « Outils, quêtes, biome, entrepôt, marché. Et de temps en temps, un duel pour le panache. Dans cet ordre, et vous dormez le ventre plein et la conscience tranquille. »",
  },
  {
    icon: "♾️",
    title: "La route est longue, voyageur",
    content: "Voilà ce que j'avais à vous conter ce soir. Les villes naissent hameaux et aspirent à l'empire. Les hommes naissent novices et rêvent de légendes. L'entretien ronge les négligents. Les guerres redistribuent les richesses. Les maires gouvernent et tombent. Les duellistes attaquent zone par zone, parent ou tombent. Rien n'est jamais acquis. C'est la beauté de ce monde.\n\nRevenez me voir si vous avez des questions. Je serai là, près du feu, avec d'autres histoires à raconter.",
    tip: "📜 Aldebert se lève et s'incline : « Bonne route, citoyen. Que vos forges ne s'éteignent jamais et que vos lingots restent hors de portée des pillards. Consultez ces pages à tout moment en cliquant sur le ❓ dans le menu. »",
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
