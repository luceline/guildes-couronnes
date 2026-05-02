/**
 * AldebertGreeting : message d'accueil narratif d'Aldebert au login.
 *
 * Affiché une fois par jour (lié au streak quotidien). Cinq variantes
 * par niveau de fidélité, tirées au hasard pour ne pas être répétitives.
 * La sélection est déterministe par jour : un même joueur le même jour
 * verra la même variante, mais d'un jour à l'autre elle change.
 *
 * Le composant ne fait QUE de l'affichage cosmétique. Toute la logique
 * de récompense reste dans LoginStreakWidget. Si profile.last_login_date
 * n'est pas aujourd'hui, on n'affiche rien (pas de re-flash en cours
 * de session après refresh).
 */
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";

// 5 variantes par niveau de streak. Pas de tirets cadratins, vocabulaire
// médiéval sans pédanterie, tutoiement, légère malice bienveillante.
const GREETINGS = {
  // Premier jour ou retour après coupure (streak = 1)
  newcomer: [
    "Aldebert lève les yeux de son registre. \"Tiens, encore un visage que mes vieux yeux ne reconnaissent pas. Bois un coup, voyageur, la maison offre la première gorgée à qui arrive.\"",
    "Le vieux conteur essuie un pichet. \"Toi, je te garderai en mémoire si tu reviens. Ici on accueille tout le monde, mais on ne se souvient que de ceux qui passent souvent.\"",
    "Aldebert pousse vers toi un tabouret. \"Pose ton sac, prends ton souffle. Ce qui se passe dehors a beau te presser, dans cette salle on a toujours le temps.\"",
    "L'aubergiste lève sa chope dans ta direction. \"À ta santé, étranger. Que la journée te soit douce et tes ennemis maladroits.\"",
    "Aldebert te dévisage un instant. \"Tu as cette tête de qui revient sans savoir vraiment pourquoi. C'est bon signe. Les meilleurs clients ont souvent commencé comme ça.\"",
  ],

  // Début de série (2-3 jours)
  beginner: [
    "Aldebert hoche la tête en te voyant. \"Deux ou trois fois déjà. Bon début. La fidélité, ça commence toujours par ne pas oublier le chemin.\"",
    "L'aubergiste te sert sans demander. \"Voilà, comme l'autre fois. Je commence à connaître ton visage, c'est mauvais signe pour mon repos mais bon pour ma caisse.\"",
    "Aldebert t'adresse un clin d'oeil. \"Encore là ? À ce rythme, je vais finir par devoir t'apprendre les histoires que je raconte aux enfants.\"",
    "Le vieux conteur ferme son registre. \"Bien, bien. Trois fois c'est plus qu'un hasard, moins qu'une habitude. On verra si tu tiens la cadence.\"",
    "Aldebert te tend un quignon de pain. \"Mange. Le monde dehors n'attend pas, mais il attendra mieux si tu as l'estomac plein.\"",
  ],

  // Habitué (4-6 jours)
  regular: [
    "Aldebert sourit franchement en te voyant entrer. \"Ah, te voilà ! Je commençais à craindre qu'un brigand ait eu raison de toi sur la route.\"",
    "L'aubergiste pose deux chopes sur le comptoir. \"L'une pour toi, l'autre pour moi. À cette heure, on a bien gagné notre pause tous les deux.\"",
    "Aldebert range son chiffon. \"Plusieurs jours d'affilée, maintenant. Tu commences à faire partie du décor, et c'est dit avec affection.\"",
    "Le vieux conteur te regarde avec satisfaction. \"On dit que la chance préfère ceux qui se présentent. Tu te présentes souvent, je te le concède.\"",
    "Aldebert te passe un siège près du foyer. \"Réserve-toi cette place. À force de venir, tu mérites bien un coin attitré.\"",
  ],

  // Semaine bouclée et plus (7-14 jours)
  loyal: [
    "Aldebert ouvre grand les bras en te voyant. \"Une semaine entière sans manquer ! Tu me fais douter que tu aies une vie ailleurs.\"",
    "L'aubergiste sert ta boisson sans même se retourner. \"Je connais ton pas dans l'escalier, maintenant. Tu sais ce que ça veut dire ? Que tu es chez toi ici.\"",
    "Aldebert te tape l'épaule au passage. \"Sept jours, dix jours, quinze peut-être. Tu tiens la distance là où d'autres flanchent au troisième matin.\"",
    "Le vieux conteur baisse la voix en se penchant vers toi. \"Entre nous, j'ai mis de côté une bonne fiole pour les fidèles. Demande-la quand le besoin se fera sentir.\"",
    "Aldebert te regarde avec un respect amusé. \"Voilà ce qu'on appelle un client de marque. Quand tu n'es pas là, la salle paraît plus vide.\"",
  ],

  // Vétéran (15+ jours)
  veteran: [
    "Aldebert se lève quand tu entres. C'est rare. \"Mon vieil ami. La salle t'attend, le foyer aussi. Prends ton temps.\"",
    "L'aubergiste te tend la clé d'une chambre sans demander. \"Tu sais où c'est. À ce stade, tu connais cette taverne mieux que ma propre fille.\"",
    "Aldebert te désigne d'un geste discret le coin du bar. \"Cette place, c'est la tienne maintenant. Personne ne s'y assoit quand tu n'es pas là, j'y veille.\"",
    "Le vieux conteur sourit sans dire un mot, juste un signe de tête appuyé. Avec le temps, vous n'avez plus besoin de phrases.",
    "Aldebert pousse vers toi une coupe sans alcool, et une autre avec. \"À toi de choisir. Ceux qui reviennent autant que toi ont gagné le droit de décider seuls de leur poison.\"",
  ],
};

function pickLevel(streak) {
  if (streak >= 15) return "veteran";
  if (streak >= 7) return "loyal";
  if (streak >= 4) return "regular";
  if (streak >= 2) return "beginner";
  return "newcomer";
}

/** Hash simple pour rendre la sélection déterministe par (joueur, jour). */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

export default function AldebertGreeting({ profile }) {
  const greeting = useMemo(() => {
    if (!profile) return null;

    // On n'affiche que si la connexion d'aujourd'hui a déjà été récompensée
    // par LoginStreakWidget (sinon on s'affiche avant la mise à jour du streak,
    // ce qui donnerait un message décalé d'un jour).
    const today = new Date().toISOString().split("T")[0];
    const isToday = profile.last_login_date === today && profile.streak_rewarded_today;
    if (!isToday) return null;

    const streak = profile.login_streak || 1;
    const level = pickLevel(streak);
    const variants = GREETINGS[level];

    // Sélection déterministe : même joueur, même jour, même variante.
    // Mais d'un jour à l'autre, on change.
    const seed = `${profile.user_email || profile.id}:${today}`;
    const idx = hashString(seed) % variants.length;
    return variants[idx];
  }, [profile?.id, profile?.last_login_date, profile?.streak_rewarded_today, profile?.login_streak, profile?.user_email]);

  if (!greeting) return null;

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50/60 to-stone-50">
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex gap-3 items-start">
          <span className="text-2xl shrink-0" aria-hidden="true">🍺</span>
          <p className="font-body text-sm leading-relaxed italic text-stone-700">
            {greeting}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
