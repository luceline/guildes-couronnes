/**
 * SavoirHubPage : page-passerelle pour Codex, Tutoriel, Profil.
 * Accessible via /savoir et via le drawer Bibliothèque (sprite biblio map).
 *
 * (10/05/2026) :
 * - Ajout du TodayCheckup en tête (depuis la refonte mobile full-screen,
 *   le Dashboard n'est plus accessible directement sur mobile).
 * - Classement remplacé par Tutoriel (le classement reste accessible via
 *   le sprite "trophée" sur la map).
 */
import { useState } from "react";
import HubPage from "../components/HubPage";
import TodayCheckup from "../components/TodayCheckup";
import Tutorial from "../components/Tutorial";

export default function SavoirHubPage() {
  const [showTutorial, setShowTutorial] = useState(false);

  const cards = [
    {
      path: "/codex",
      icon: "📖",
      title: "Codex",
      description: "Le grand livre des objets, recettes et créatures du royaume. Tout ce qu'il faut savoir pour comprendre le monde.",
    },
    {
      // Pas de path : on déclenche le composant Tutorial via onClick
      onClick: () => setShowTutorial(true),
      icon: "🎓",
      title: "Tutoriel",
      description: "Re-découvrez les fondamentaux du jeu. Aldebert vous reprend par la main pour vous expliquer les rouages du royaume.",
    },
    {
      path: "/profile",
      icon: "👤",
      title: "Profil",
      description: "Vos statistiques, vos titres, vos accomplissements. Le portrait du joueur que vous êtes devenu.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tableau de bord du jour : tuiles d'état (faim, énergie, quêtes,
       * épopée, récolte, production, marché, entrepôt, streak). */}
      <TodayCheckup />

      {/* Hub classique : Codex / Tutoriel / Profil */}
      <HubPage
        title="📚 Le savoir"
        subtitle="Aldebert ouvre un grimoire. « Pour ceux qui prennent le temps de comprendre. »"
        cards={cards}
      />

      {/* Tutorial modal (déclenché par la card "Tutoriel" ci-dessus) */}
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
    </div>
  );
}
