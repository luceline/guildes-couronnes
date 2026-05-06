/**
 * LabeurHubPage : page-passerelle pour Production, Marché, Inventaire.
 * Accessible via /labeur (regroupement "Production" du menu principal).
 */
import HubPage from "../components/HubPage";

export default function LabeurHubPage() {
  const cards = [
    {
      path: "/production",
      icon: "⚒️",
      title: "Atelier",
      description: "Récolter, fabriquer, transformer. Lancer votre épopée du jour ou ouvrir votre atelier aux clients.",
    },
    {
      path: "/market",
      icon: "🏪",
      title: "Marché",
      description: "Vendre votre surplus, acheter ce qui vous manque, récupérer vos colis en attente.",
    },
    {
      path: "/inventaire",
      icon: "📦",
      title: "Inventaire",
      description: "Consulter ce que vous portez, activer vos objets utilitaires, gérer votre équipement.",
    },
  ];

  return (
    <HubPage
      title="⚒️ Le labeur"
      subtitle="Aldebert lève les yeux. « Voici les outils du quotidien. À vous de jouer. »"
      cards={cards}
    />
  );
}
