/**
 * SavoirHubPage : page-passerelle pour Codex, Classement, Profil.
 * Accessible via /savoir (regroupement "Savoir" du menu principal).
 */
import HubPage from "../components/HubPage";

export default function SavoirHubPage() {
  const cards = [
    {
      path: "/codex",
      icon: "📖",
      title: "Codex",
      description: "Le grand livre des objets, recettes et créatures du royaume. Tout ce qu'il faut savoir pour comprendre le monde.",
    },
    {
      path: "/ranking",
      icon: "🏆",
      title: "Classement",
      description: "Comparer votre progrès aux autres joueurs et cités. Voir qui dompte le royaume.",
    },
    {
      path: "/profile",
      icon: "👤",
      title: "Profil",
      description: "Vos statistiques, vos titres, vos accomplissements. Le portrait du joueur que vous êtes devenu.",
    },
  ];

  return (
    <HubPage
      title="📚 Le savoir"
      subtitle="Aldebert ouvre un grimoire. « Pour ceux qui prennent le temps de comprendre. »"
      cards={cards}
    />
  );
}
