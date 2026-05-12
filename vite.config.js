import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
    // ── PWA (10/05/2026) ─────────────────────────────────────────────
    // - Force le mode paysage sur Android (iOS ignore mais l'utilisateur
    //   peut tourner manuellement).
    // - Service worker avec strategy NetworkFirst pour HTML/JS (toujours
    //   à jour) + CacheFirst pour les assets (sprites, fonts).
    // - registerType 'autoUpdate' : déploiement transparent, le SW se met
    //   à jour seul au prochain refresh.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Guildes & Couronnes',
        short_name: 'G&C',
        description: 'Le royaume médiéval multijoueur',
        theme_color: '#8b5e3c',         // brun médiéval (UI standalone)
        // 12/05/2026 : background_color aligné avec le fond du splash inline
        // (index.html). #0d0805 = brun très sombre proche noir, matche les
        // bords du splash.png. Évite tout flash entre splash Android natif
        // et notre splash inline.
        background_color: '#0d0805',
        display: 'standalone',
        // 11/05/2026 : orientation 'any' (au lieu de 'landscape') pour que
        // l'app suive l'orientation physique du téléphone. La vue village
        // bascule automatiquement : portrait → mode Menu, landscape → mode
        // Carte. Le joueur peut aussi forcer un mode dans les Paramètres.
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Précache : tout le build initial (HTML, JS, CSS, sprites principaux)
        // 12/05/2026 : globPatterns capture déjà splash.png via **/*.png
        // donc rien à ajouter de spécifique pour le splash.
        globPatterns: ['**/*.{js,css,html,png,svg,webp,jpg,jpeg,woff2}'],
        // Strategy par type
        runtimeCaching: [
          {
            // API PocketBase : NetworkFirst (toujours fresh)
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pb-api',
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Sprites : CacheFirst (statiques, peuvent être mis en cache long)
            urlPattern: /\/sprites\/.*\.(png|webp|jpg|svg)/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sprites',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: {
        // Désactivé en dev : le service worker peut interférer avec le HMR
        enabled: false,
      },
    }),
  ]
});
