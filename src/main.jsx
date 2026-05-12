import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// ── Service Worker PWA (10/05/2026) ─────────────────────────────────────
// vite-plugin-pwa enregistre automatiquement le SW au build prod.
// L'import virtuel ci-dessous active l'auto-update : la nouvelle version
// se télécharge en arrière-plan et s'active au prochain refresh.
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    // Une nouvelle version est dispo : on force un refresh silencieux.
    // On pourrait afficher un toast "nouvelle version disponible, cliquer
    // pour recharger" mais pour 14 joueurs c'est inutile.
    console.log('[PWA] Nouvelle version dispo, mise à jour en arrière-plan');
  },
  onOfflineReady() {
    console.log('[PWA] Application prête pour usage hors ligne');
  },
})

// ── Splash screen : retrait après mount React + délai min (12/05/2026) ──
// Voir index.html pour le markup et le CSS du splash. Logique :
//   1. On mémorise t0 = moment où ce script s'exécute (juste avant render)
//   2. requestAnimationFrame après render = React a peint au moins une frame
//   3. On attend que (Date.now() - t0) >= SPLASH_MIN_MS pour éviter le flash
//      désagréable quand le bundle est en cache et charge en < 200ms
//   4. On ajoute .splash-hide → transition CSS opacity 300ms
//   5. On retire l'élément du DOM après la transition (cleanup propre)
//
// Si le splash n'est pas présent (cas dev sans index.html à jour) on no-op.
const SPLASH_MIN_MS = 500;        // durée min visible pour ne pas flasher
const SPLASH_FADE_MS = 300;       // doit matcher la transition CSS dans index.html

const t0 = Date.now();

function hideSplash() {
  const splash = document.getElementById('app-splash');
  if (!splash) return;
  splash.classList.add('splash-hide');
  // Retirer du DOM après la fin du fade-out pour ne pas garder un élément
  // invisible inutile (mémoire + lecteurs d'écran).
  setTimeout(() => splash.remove(), SPLASH_FADE_MS + 50);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// rAF garantit qu'au moins une frame React a été peinte. Le délai min est
// calculé à partir de t0 (start du script), pas du mount React, pour
// rester stable même si React monte instantanément en cache chaud.
requestAnimationFrame(() => {
  const elapsed = Date.now() - t0;
  const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
  setTimeout(hideSplash, wait);
});
