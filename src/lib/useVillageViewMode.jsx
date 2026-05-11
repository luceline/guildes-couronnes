/**
 * useVillageViewMode.jsx (11/05/2026, v2 auto-switch)
 *
 * Gère le mode d'affichage de la vue village avec auto-switch selon
 * l'orientation physique du téléphone :
 *
 *   - Portrait  → mode "menu"
 *   - Landscape → mode "map"
 *
 * Le joueur peut surcharger ce comportement via les Paramètres :
 *
 *   - override = "auto" : suit l'orientation (défaut)
 *   - override = "map"  : force la carte peu importe l'orientation
 *   - override = "menu" : force le menu peu importe l'orientation
 *
 * L'override est persisté en localStorage. L'orientation est observée en
 * live via matchMedia, donc une rotation physique du téléphone bascule
 * le mode instantanément (si override = "auto").
 *
 * Bonus : flag intro pour afficher un message "Le jeu se joue dans les
 * deux modes, testez les deux vues" à la première ouverture uniquement.
 */

import { createContext, useContext, useEffect, useState } from "react";

const VillageViewModeContext = createContext(null);

const STORAGE_KEY_OVERRIDE = "village-view-override";
const STORAGE_KEY_INTRO_SEEN = "village-modes-intro-seen";

function getInitialOverride() {
  if (typeof window === "undefined") return "auto";
  const saved = localStorage.getItem(STORAGE_KEY_OVERRIDE);
  return ["auto", "map", "menu"].includes(saved) ? saved : "auto";
}

function isPortraitNow() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(orientation: portrait)").matches;
}

export function VillageViewModeProvider({ children }) {
  const [override, setOverrideState] = useState(getInitialOverride);
  const [orientation, setOrientation] = useState(() =>
    isPortraitNow() ? "portrait" : "landscape"
  );

  // Listener orientation : bascule en live à chaque rotation physique
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(orientation: portrait)");
    const update = () => setOrientation(mq.matches ? "portrait" : "landscape");
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Mode calculé : override > orientation
  const mode = override === "auto"
    ? (orientation === "portrait" ? "menu" : "map")
    : override;

  // Persiste l'override
  const setOverride = (next) => {
    if (!["auto", "map", "menu"].includes(next)) return;
    setOverrideState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_OVERRIDE, next);
    }
  };

  return (
    <VillageViewModeContext.Provider value={{ mode, override, setOverride, orientation }}>
      {children}
    </VillageViewModeContext.Provider>
  );
}

export function useVillageViewMode() {
  const ctx = useContext(VillageViewModeContext);
  if (!ctx) throw new Error("useVillageViewMode must be used within VillageViewModeProvider");
  return ctx;
}

// ─── Intro modale "testez les deux vues" ──────────────────────────────
// Utilitaires pour gérer le flag de première ouverture.
export function hasSeenModesIntro() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY_INTRO_SEEN) === "1";
}

export function markModesIntroSeen() {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_INTRO_SEEN, "1");
}
