/**
 * useIsMobile.js — Détection robuste mobile vs desktop (11/05/2026).
 *
 * Le problème résolu :
 *   Les breakpoints CSS classiques (Tailwind `md:` = 768px) basent leur
 *   détection uniquement sur la largeur du viewport. Or, en landscape sur
 *   un smartphone moderne (ex: Pixel 8 Pro = 915×412 dp), la largeur dépasse
 *   768px, donc Tailwind considère que c'est du desktop → header desktop
 *   affiché, MiniStatusBar masquée, layouts cassés.
 *
 * La solution :
 *   On combine 3 signaux indépendants pour savoir si on est sur un VRAI mobile :
 *     1. `(pointer: coarse)` — pointeur imprécis (doigt vs souris)
 *     2. `(hover: none)`     — pas de hover natif (pas de curseur)
 *     3. `(max-width: 1023px)` — viewport raisonnablement étroit
 *
 *   Si au moins 2 sur 3 sont vrais → mobile.
 *
 * Ce hook marche en portrait ET landscape, sur tous les téléphones, tablettes,
 * et même les pliables (Galaxy Z Fold). Il ne se base PAS sur le user-agent
 * (fragile, ne couvre pas les nouveaux devices).
 *
 * Usage :
 *   const isMobile = useIsMobile();
 *   return isMobile ? <MobileView /> : <DesktopView />;
 *
 * Pour la cohérence avec Tailwind (qui reste utile pour le layout fluide),
 * ce hook n'est utilisé QUE pour les cas où le comportement doit changer
 * radicalement (header, navigation, fullscreen map, etc.), pas pour toutes
 * les classes responsives.
 */

import { useState, useEffect } from "react";

function evaluateIsMobile() {
  if (typeof window === "undefined") return false;

  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const narrowViewport = window.matchMedia("(max-width: 1023px)").matches;

  // Au moins 2 signaux sur 3 doivent être positifs.
  // - Téléphone portrait : les 3 → mobile ✓
  // - Téléphone landscape (Pixel 8 Pro, etc.) : coarse + noHover → mobile ✓
  // - Tablette landscape : coarse + noHover → mobile ✓
  // - Desktop avec écran tactile (Surface) : seul coarse parfois → desktop ✓
  // - Desktop classique : aucun → desktop ✓
  const score =
    (coarsePointer ? 1 : 0) + (noHover ? 1 : 0) + (narrowViewport ? 1 : 0);

  return score >= 2;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(evaluateIsMobile);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mqs = [
      window.matchMedia("(pointer: coarse)"),
      window.matchMedia("(hover: none)"),
      window.matchMedia("(max-width: 1023px)"),
    ];

    const update = () => setIsMobile(evaluateIsMobile());

    // Écouter les 3 media queries : on update si l'une change (ex: rotation)
    mqs.forEach((mq) => mq.addEventListener("change", update));

    return () => {
      mqs.forEach((mq) => mq.removeEventListener("change", update));
    };
  }, []);

  return isMobile;
}

export default useIsMobile;
