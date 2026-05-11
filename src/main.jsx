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

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
