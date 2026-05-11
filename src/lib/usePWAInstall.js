/**
 * usePWAInstall.js — Hook de détection et déclenchement de l'install PWA
 * (11/05/2026)
 *
 * Extrait de l'ancienne LandingPage.jsx pour être réutilisable depuis
 * n'importe quelle page (notamment LoginPage maintenant que la landing
 * a été supprimée).
 *
 * Comportement par plateforme :
 *   - Android Chrome/Edge : déclenche `beforeinstallprompt`, bouton actif
 *   - iOS Safari          : pas d'API d'install standard (Apple), affiche
 *                           des instructions manuelles
 *   - Desktop Chrome/Edge : déclenche `beforeinstallprompt` aussi
 *
 * Retourne :
 *   - canInstall   : true si l'install est possible via API (bouton à afficher)
 *   - promptInstall : fonction à appeler au clic pour déclencher l'install
 *   - isInstalled  : true si la PWA est déjà installée (= lancée en standalone)
 *   - isIOS        : true si l'utilisateur est sur iPhone/iPad (fallback texte)
 */

import { useEffect, useState } from "react";

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Détection si déjà installée (mode standalone = lancé depuis l'icône PWA)
    const checkInstalled = () => {
      if (typeof window === "undefined") return false;
      return window.matchMedia?.("(display-mode: standalone)").matches
        || window.navigator?.standalone === true;  // iOS Safari
    };
    setIsInstalled(checkInstalled());

    // Capture l'event d'installation pour le déclencher au clic
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Détecte l'installation réussie pour cacher la bannière
    const installedHandler = () => setIsInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  // Détecte l'OS pour le message de fallback iOS
  const isIOS = typeof navigator !== "undefined"
    && /iPad|iPhone|iPod/.test(navigator.userAgent)
    && !window.MSStream;

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return { canInstall: !!deferredPrompt, promptInstall, isInstalled, isIOS };
}

export default usePWAInstall;
