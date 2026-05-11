// src/components/PWAInstallBanner.jsx (11/05/2026)
//
// Bannière sticky en haut d'écran proposant d'installer la PWA.
// Affichée sur LoginPage (et autres pages publiques si besoin).
// Cachée si déjà installée.
//
// Styles inline pour s'intégrer à la palette médiévale (#c9a44a + #0e0b05)
// indépendamment du thème Tailwind du joueur.

import { usePWAInstall } from "@/lib/usePWAInstall";

export default function PWAInstallBanner() {
  const { canInstall, promptInstall, isInstalled, isIOS } = usePWAInstall();

  if (isInstalled) return null;

  return (
    <div
      style={{
        background: "#c9a44a",
        padding: "0.6rem 1rem",
        textAlign: "center",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.8rem",
        flexWrap: "wrap",
      }}
    >
      {canInstall ? (
        <>
          <p
            style={{
              fontFamily: "sans-serif",
              fontSize: 12,
              fontWeight: 600,
              color: "#0e0b05",
              margin: 0,
              letterSpacing: 0.5,
            }}
          >
            📲 Installez Guildes & Couronnes pour une meilleure expérience
          </p>
          <button
            onClick={promptInstall}
            style={{
              padding: "0.4rem 1.2rem",
              background: "#0e0b05",
              color: "#c9a44a",
              border: "none",
              fontFamily: "sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              cursor: "pointer",
              borderRadius: 4,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = 0.85)}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = 1)}
          >
            ⬇️ Installer l'app
          </button>
        </>
      ) : isIOS ? (
        <p
          style={{
            fontFamily: "sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: "#0e0b05",
            margin: 0,
            letterSpacing: 0.5,
          }}
        >
          📲 iPhone/iPad : appuyez sur Partager
          <span style={{ display: "inline-block", padding: "0 0.3rem" }}>↑</span>
          puis "Sur l'écran d'accueil"
        </p>
      ) : (
        <p
          style={{
            fontFamily: "sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: "#0e0b05",
            margin: 0,
            letterSpacing: 0.5,
          }}
        >
          📲 Installez le jeu : ouvrez le menu de votre navigateur et choisissez "Installer l'application"
        </p>
      )}
    </div>
  );
}
