/**
 * AventureHubPage : page-passerelle pour Voyage, Combat, Quêtes.
 * Accessible via /aventure (regroupement "Aventure" du menu principal).
 *
 * Affiche un badge "X défis en attente" sur la carte Combat si le joueur a
 * des défis PvP non répondus.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import HubPage from "../components/HubPage";

export default function AventureHubPage() {
  const [pendingDefenses, setPendingDefenses] = useState(0);

  // Calcule combien de défis PvP attendent une défense (logique identique à GameLayout)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await base44.auth.me();
        if (!user?.email) return;
        const challenges = await base44.entities.CombatChallenge.filter({
          target_email: user.email,
          status: "pending_defense",
        });
        if (cancelled) return;
        setPendingDefenses((challenges || []).length);
      } catch (e) { /* silencieux */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const cards = [
    {
      path: "/travel",
      icon: "🐴",
      title: "Voyage",
      description: "Quitter votre cité pour explorer le royaume. Vers une autre ville ou les biomes sauvages.",
    },
    {
      path: "/combat",
      icon: "⚔️",
      title: "Combat",
      description: "Croiser le fer avec un autre joueur, défendre vos droits, ou poster une prime sur une tête.",
      badge: pendingDefenses > 0 ? `${pendingDefenses} défi${pendingDefenses > 1 ? "s" : ""} en attente` : null,
    },
    {
      path: "/quetes",
      icon: "🎯",
      title: "Quêtes",
      description: "Consulter vos six missions du jour. Les compléter rapporte de l'or.",
    },
  ];

  return (
    <HubPage
      title="⚔️ L'aventure"
      subtitle="Aldebert range son ouvrage. « Le monde est vaste, et il vous attend. »"
      cards={cards}
    />
  );
}
