/**
 * LoginStreakPopup.jsx
 *
 * Affiche le LoginStreakWidget dans une modal compacte au lancement de l'app.
 * - Apparaît au premier render du GameLayout, sauf si déjà affiché aujourd'hui
 *   (flag stocké en localStorage : login-streak-shown-YYYY-MM-DD).
 * - Se ferme automatiquement après 6 secondes ou au tap.
 * - Backdrop cliquable pour fermer.
 *
 * Le LoginStreakWidget interne effectue lui-même la mise à jour du streak
 * en BDD (call API) au mount, donc même si l'utilisateur ferme la popup
 * tout de suite, la récompense est bien créditée.
 *
 * Créé le 10/05/2026 dans le cadre de la refonte mobile full-screen
 * (le streak n'a plus sa place dans le Dashboard puisqu'on redirige vers /city).
 */
import { useEffect, useState } from "react";
import LoginStreakWidget from "@/components/LoginStreakWidget";

const TODAY_KEY = () => `login-streak-shown-${new Date().toISOString().split("T")[0]}`;

export default function LoginStreakPopup({ profile, onProfileUpdate }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    // Ne montre la popup qu'une seule fois par jour
    try {
      if (localStorage.getItem(TODAY_KEY()) === "1") return;
    } catch (_) {}
    // Petit délai pour laisser le reste de l'UI se monter
    const showTimer = setTimeout(() => {
      setOpen(true);
      try { localStorage.setItem(TODAY_KEY(), "1"); } catch (_) {}
    }, 800);

    return () => clearTimeout(showTimer);
  }, [profile?.id]);

  // Auto-fermeture après 6 secondes
  useEffect(() => {
    if (!open) return;
    const closeTimer = setTimeout(() => setOpen(false), 6000);
    return () => clearTimeout(closeTimer);
  }, [open]);

  if (!profile || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-label="Récompense de connexion"
    >
      <div
        className="max-w-sm w-full animate-in slide-in-from-top-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <LoginStreakWidget profile={profile} onProfileUpdate={onProfileUpdate} />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-3 w-full py-2 text-center text-sm font-body text-white/80 hover:text-white transition-colors"
        >
          Tap pour fermer
        </button>
      </div>
    </div>
  );
}
