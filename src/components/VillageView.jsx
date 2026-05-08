// src/components/VillageView.jsx
//
// Vue village isométrique de la ville. Affiche les bâtiments fixes (mairie,
// taverne, atelier, etc.) et les bâtiments construisibles présents dans
// city.buildings. Utilise les sprites pixel art livrés dans /sprites/village/.
//
// Le sprite de la mairie change selon le tier de la ville (lingots_cumul) :
//   tier 1-2 (Hameau/Village)  → mairie_n1
//   tier 3   (Bourg)            → mairie_n2
//   tier 4   (Cité)             → mairie_n3
//   tier 5   (Capitale)         → mairie_n4
//
// Layout : grille isométrique simple, position en pourcentage pour responsive.
//
// Routage au clic (architecture hybride) :
//   - Bâtiments "lieu d'action" (taverne, marché, atelier, etc.) → redirection
//     vers la page dédiée existante (/taverne, /market, /production, etc.)
//   - Bâtiments "spécifiques à cette ville" (mairie, gestion bâtiments) →
//     callback `onOpenModal(target)` que CityView gère pour afficher l'onglet
//     correspondant en modale.
//   - Bâtiments construits sans page dédiée (mine, fonderie, etc.) → callback
//     `onShowBuildingInfo(buildingType)` pour afficher une modale d'infos.

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getCityTier } from "@/lib/gameData";

const SPRITE_BASE = "/sprites/village";

// ─────────────────────────────────────────────────────────────────────────
// Routage des clics : pour chaque target, on définit comment réagir.
//   { type: "navigate", path: "/x" }  → navigate(path) côté router
//   { type: "modal", tab: "x" }       → onOpenModal("x")
//   { type: "info" }                  → onShowBuildingInfo(target)
// Si aucune entrée, le clic ne fait rien.
// ─────────────────────────────────────────────────────────────────────────
const CLICK_ROUTES = {
  // ─── Bâtiments fixes : lieu d'action → redirection vers page dédiée ───
  taverne:      { type: "navigate", path: "/taverne"     },
  marche:       { type: "navigate", path: "/market"      },
  atelier:      { type: "navigate", path: "/production"  },
  ecurie:       { type: "navigate", path: "/travel"      },
  arene:        { type: "navigate", path: "/combat"      },
  bibliotheque: { type: "navigate", path: "/savoir"      },
  quetes:       { type: "navigate", path: "/quetes"      },
  chaudron:     { type: "navigate", path: "/aventure"    },

  // ─── Bâtiments fixes : spécifiques à la ville → modale ───
  mairie:       { type: "modal", tab: "mairie"     },
  entrepot:     { type: "modal", tab: "batiments"  },

  // ─── Bâtiments construits (BDD) → modale d'infos sans onglet dédié ───
  // Utilisé via fallback : si target n'est pas listé ci-dessus mais que c'est
  // un building_type connu de BUILDING_SPRITE_MAP, on tombe sur "info".
};

// ─────────────────────────────────────────────────────────────────────────
// Mapping tier de ville → sprite mairie
// ─────────────────────────────────────────────────────────────────────────
function mairieSpriteForTier(level) {
  if (level >= 5) return "mairie_n4";  // Capitale
  if (level >= 4) return "mairie_n3";  // Cité
  if (level >= 3) return "mairie_n2";  // Bourg
  return "mairie_n1";                   // Hameau ou Village
}

// ─────────────────────────────────────────────────────────────────────────
// Layout : positions des bâtiments fixes (toujours présents dans toute ville,
// quels que soient les buildings construits).
// Coordonnées en % pour rester responsive sur mobile et desktop.
// L'ordre dans le tableau définit le z-index implicite : plus tard = devant.
// On range donc du fond vers l'avant pour que les sprites se chevauchent
// correctement (un bâtiment en bas chevauche celui qui est plus haut).
//
// 10 bâtiments en 4 rangs. La bibliothèque et l'arène sont fixes parce
// qu'elles servent de portail UI (codex/tutoriel pour la bibliothèque,
// onglet combat pour l'arène). Si city.buildings contient `bibliotheque`,
// le sprite de la bibliothèque sera enrichi d'un badge de niveau et d'un
// glow doré (cf. composant SpriteImg avec prop `upgraded`).
// ─────────────────────────────────────────────────────────────────────────
const FIXED_BUILDINGS = [
  // Rang du fond — la mairie domine au centre
  { key: "mairie",       sprite: "DYNAMIC",                       x: 50, y: 18, scale: 1.4,  label: "Mairie",       target: "mairie"       },

  // Deuxième rang : taverne et marché (lieux sociaux/commerciaux)
  { key: "taverne",      sprite: "taverne",                       x: 20, y: 35, scale: 0.95, label: "Taverne",      target: "taverne"      },
  { key: "marche",       sprite: "construction_marche",           x: 80, y: 35, scale: 0.95, label: "Marché",       target: "marche"       },

  // Rang central : atelier et chaudron (lieux de production)
  { key: "atelier",      sprite: "atelier",                       x: 28, y: 54, scale: 0.95, label: "Atelier",      target: "atelier"      },
  { key: "chaudron",     sprite: "chaudron",                      x: 72, y: 54, scale: 0.95, label: "Chaudron",     target: "chaudron"     },

  // Rang central+ : bibliothèque (toujours visible, portail codex/tutoriel)
  // et arène (toujours visible, portail combat)
  { key: "bibliotheque", sprite: "construction_bibliotheque",     x: 12, y: 56, scale: 0.85, label: "Bibliothèque", target: "bibliotheque" },
  { key: "arene",        sprite: "construction_arene",            x: 88, y: 56, scale: 0.95, label: "Arène",        target: "arene"        },

  // Rang avant : écurie + entrepôt + tableau des quêtes
  { key: "ecurie",       sprite: "ecurie",                        x: 22, y: 76, scale: 0.9,  label: "Écurie",       target: "ecurie"       },
  { key: "entrepot",     sprite: "entrepot",                      x: 50, y: 76, scale: 1.0,  label: "Entrepôt",     target: "entrepot"     },
  { key: "quetes",       sprite: "construction_tableau_quetes",   x: 78, y: 76, scale: 0.8,  label: "Quêtes",       target: "quetes"       },
];

// Bâtiments fixes qui sont aussi améliorables via city.buildings.
// Quand le maire construit/améliore le building correspondant, on enrichit
// visuellement le sprite (glow doré + badge niveau).
const UPGRADABLE_FIXED = {
  bibliotheque: "bibliotheque",  // key fixe → building_type (BDD)
  // arene n'est pas dans BUILDING_TYPES pour l'instant → pas d'upgrade
};

// ─────────────────────────────────────────────────────────────────────────
// Bâtiments construisibles : visibles SEULEMENT si présents dans
// city.buildings. Mapping building_type (gameData) → sprite.
// Si un bâtiment n'a pas de sprite, on l'ignore silencieusement.
//
// Note : la bibliothèque n'est PAS dans cette map parce qu'elle est déjà
// affichée comme bâtiment fixe (portail codex/tutoriel). Quand le maire
// la construit/améliore, on enrichit le sprite fixe via UPGRADABLE_FIXED.
// ─────────────────────────────────────────────────────────────────────────
const BUILDING_SPRITE_MAP = {
  scierie:      "construction_scierie",
  mine:         "construction_mine",
  moulin:       "construction_moulin",
  bergerie:     "construction_bergerie",
  laboratoire:  "construction_laboratoire",
  fonderie:     "construction_fonderie",
  hospice:      "construction_hospice",
  grenier:      "construction_grenier",
  eglise:       "construction_sanctuaire",   // l'entité s'appelle "eglise" en BDD
  comptoir:     "construction_banque",       // comptoir bancaire
  relais:       "construction_relais_postal",
  // Pas de sprite (à venir ou autre traitement) : palais, cathedrale,
  // tour_guet, remparts, caserne, scriptorium, université, etc.
  // bibliotheque : géré comme bâtiment fixe upgradable (cf. UPGRADABLE_FIXED)
};

// Positions disponibles pour les bâtiments construisibles (slots autour
// du noyau central). Si plus de bâtiments que de slots, on tourne en boucle.
const BUILD_SLOTS = [
  { x: 8,  y: 18 },
  { x: 92, y: 18 },
  { x: 8,  y: 50 },
  { x: 92, y: 50 },
  { x: 8,  y: 82 },
  { x: 92, y: 82 },
  { x: 38, y: 8  },
  { x: 62, y: 8  },
  { x: 38, y: 90 },
  { x: 62, y: 90 },
];

// ─────────────────────────────────────────────────────────────────────────
// Décors : positions fixes, purement esthétiques. Réutilisent les sprites
// arbre/buisson plusieurs fois pour combler les vides sans alourdir.
// ─────────────────────────────────────────────────────────────────────────
const DECORS = [
  { sprite: "decor_arbre",     x: 5,   y: 8,  scale: 0.45 },
  { sprite: "decor_arbre",     x: 95,  y: 12, scale: 0.45 },
  { sprite: "decor_arbre",     x: 4,   y: 95, scale: 0.4  },
  { sprite: "decor_arbre",     x: 96,  y: 95, scale: 0.4  },
  { sprite: "decor_buisson",   x: 50,  y: 50, scale: 0.4  },
  { sprite: "decor_lampadaire",x: 35,  y: 32, scale: 0.35 },
  { sprite: "decor_lampadaire",x: 65,  y: 32, scale: 0.35 },
];

// ─────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────
export default function VillageView({ city, onOpenModal, onShowBuildingInfo }) {
  const navigate = useNavigate();

  // Gestionnaire central des clics sur les bâtiments. Selon la nature du
  // bâtiment cliqué (target), on déclenche l'action appropriée :
  //   - navigation vers une page dédiée (taverne, marché, etc.)
  //   - ouverture d'une modale d'onglet (mairie, gestion bâtiments)
  //   - ouverture d'une modale d'infos pour un bâtiment construit (mine, etc.)
  const handleBuildingClick = (target) => {
    const route = CLICK_ROUTES[target];

    if (route) {
      if (route.type === "navigate") {
        navigate(route.path);
      } else if (route.type === "modal") {
        onOpenModal?.(route.tab);
      }
      return;
    }

    // Pas de route définie : si c'est un bâtiment construit (présent en BDD),
    // on déclenche la modale d'infos générique.
    if (BUILDING_SPRITE_MAP[target]) {
      onShowBuildingInfo?.(target);
      return;
    }

    // Sinon (bâtiment sans route), on ne fait rien — log debug uniquement.
    console.log("[VillageView] clic non routé :", target);
  };

  // Sprite dynamique de la mairie selon le tier
  const cityTier = useMemo(() => {
    if (!city) return { level: 1, label: "Hameau" };
    return getCityTier(city.lingots_cumul || 0);
  }, [city]);

  const mairieSprite = mairieSpriteForTier(cityTier.level);

  // Calcule le niveau d'upgrade pour les bâtiments fixes upgradables.
  // Un bâtiment fixe (toujours visible) peut avoir une version "construite"
  // dans city.buildings qui lui apporte un boost visuel + un badge level.
  const fixedUpgradeLevels = useMemo(() => {
    if (!city?.buildings) return {};
    const result = {};
    for (const [fixedKey, buildingType] of Object.entries(UPGRADABLE_FIXED)) {
      const built = (city.buildings || []).find(b => b.building_type === buildingType);
      if (built) {
        result[fixedKey] = built.level || 1;
      }
    }
    return result;
  }, [city?.buildings]);

  // Bâtiments construits par le joueur, dont on a un sprite
  const builtConstructions = useMemo(() => {
    if (!city?.buildings) return [];
    return (city.buildings || [])
      .filter(b => BUILDING_SPRITE_MAP[b.building_type])
      .map((b, idx) => ({
        key: `built-${b.building_type}-${idx}`,
        sprite: BUILDING_SPRITE_MAP[b.building_type],
        x: BUILD_SLOTS[idx % BUILD_SLOTS.length].x,
        y: BUILD_SLOTS[idx % BUILD_SLOTS.length].y,
        scale: 0.85,
        label: b.name || b.building_type,
        target: b.building_type,
        level: b.level || 1,
      }));
  }, [city?.buildings]);

  if (!city) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        Pas de ville chargée.
      </div>
    );
  }

  // Construction de la liste finale, triée par y croissant pour le z-index
  // (les bâtiments plus bas dans la scène doivent être devant).
  const allBuildings = [
    ...FIXED_BUILDINGS.map(b => ({
      ...b,
      sprite: b.sprite === "DYNAMIC" ? mairieSprite : b.sprite,
      // Si c'est un bâtiment fixe upgradable et qu'il est construit en BDD,
      // on récupère son niveau pour l'afficher (badge + glow).
      level: fixedUpgradeLevels[b.key] || undefined,
      upgraded: !!fixedUpgradeLevels[b.key],
    })),
    ...builtConstructions,
  ].sort((a, b) => a.y - b.y);

  const allDecors = DECORS.slice().sort((a, b) => a.y - b.y);

  return (
    <div className="village-view-wrapper">
      <div className="village-view-stage">
        {/* Décors en arrière-plan */}
        {allDecors.map((d, idx) => (
          <SpriteImg
            key={`decor-${idx}`}
            src={`${SPRITE_BASE}/${d.sprite}.webp`}
            x={d.x} y={d.y} scale={d.scale}
            zIndex={Math.round(d.y * 10)}
            decorative
          />
        ))}

        {/* Bâtiments (fixes + construits) */}
        {allBuildings.map(b => (
          <SpriteImg
            key={b.key}
            src={`${SPRITE_BASE}/${b.sprite}.webp`}
            x={b.x} y={b.y} scale={b.scale}
            zIndex={Math.round(b.y * 10) + 100}
            label={b.label}
            level={b.level}
            upgraded={b.upgraded}
            onClick={() => handleBuildingClick(b.target)}
          />
        ))}
      </div>

      {/* En-tête : nom de la ville + tier */}
      <div className="village-view-header">
        <div className="village-view-title">
          <span className="village-view-title-icon">{cityTier.icon}</span>
          <span>{city.name || "Ville sans nom"}</span>
          <span className="village-view-tier">{cityTier.label}</span>
        </div>
      </div>

      <style>{`
        .village-view-wrapper {
          position: relative;
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          aspect-ratio: 16 / 10;
          background:
            radial-gradient(circle at 50% 60%,
              rgba(180, 200, 140, 0.4) 0%,
              rgba(140, 165, 110, 0.5) 35%,
              rgba(110, 130, 85, 0.55) 100%);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25), inset 0 0 60px rgba(0,0,0,0.15);
        }

        .village-view-stage {
          position: absolute;
          inset: 0;
        }

        .village-view-header {
          position: absolute;
          top: 8px;
          left: 12px;
          right: 12px;
          z-index: 10000;
          display: flex;
          justify-content: space-between;
          align-items: center;
          pointer-events: none;
        }

        .village-view-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: rgba(20, 16, 12, 0.65);
          color: #f5e9c8;
          font-family: var(--font-heading, serif);
          font-size: 14px;
          font-weight: 600;
          border-radius: 8px;
          backdrop-filter: blur(4px);
        }

        .village-view-title-icon {
          font-size: 18px;
        }

        .village-view-tier {
          padding: 1px 8px;
          background: rgba(212, 175, 55, 0.25);
          color: #f7d774;
          border: 1px solid rgba(212, 175, 55, 0.4);
          border-radius: 4px;
          font-size: 11px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .village-sprite {
          position: absolute;
          transform: translate(-50%, -50%);
          transition: transform 0.15s ease-out, filter 0.15s ease-out;
          pointer-events: auto;
          cursor: pointer;
        }

        .village-sprite.decorative {
          pointer-events: none;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25));
        }

        /* Bâtiment fixe upgradé (construit en BDD) : glow doré subtil
           qui pulse doucement pour signaler "ce bâtiment a été amélioré". */
        .village-sprite.upgraded {
          filter: drop-shadow(0 6px 14px rgba(247, 215, 116, 0.45))
                  drop-shadow(0 0 8px rgba(247, 215, 116, 0.35));
          animation: village-sprite-pulse 3.5s ease-in-out infinite;
        }

        @keyframes village-sprite-pulse {
          0%, 100% {
            filter: drop-shadow(0 6px 14px rgba(247, 215, 116, 0.35))
                    drop-shadow(0 0 6px rgba(247, 215, 116, 0.25));
          }
          50% {
            filter: drop-shadow(0 6px 18px rgba(247, 215, 116, 0.55))
                    drop-shadow(0 0 12px rgba(247, 215, 116, 0.45));
          }
        }

        .village-sprite:not(.decorative):hover {
          transform: translate(-50%, -52%) scale(1.04);
          filter: drop-shadow(0 6px 12px rgba(0,0,0,0.4))
                  drop-shadow(0 0 12px rgba(247, 215, 116, 0.6));
          animation: none;  /* annule le pulse au hover pour clarté */
        }

        .village-sprite img {
          display: block;
          width: 100%;
          height: auto;
          /* Pixel-art friendly : pas de blur quand on zoome */
          image-rendering: pixelated;
          image-rendering: -moz-crisp-edges;
          /* Détourage souple : le fond blanc des JPG est neutralisé en
             multipliant par le fond, mais ça reste un JPG donc on accepte
             une légère halo. Pour un détourage parfait on regénérera
             en PNG transparent plus tard. */
          mix-blend-mode: multiply;
        }

        .village-sprite-label {
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          padding: 2px 8px;
          background: rgba(20, 16, 12, 0.85);
          color: #f5e9c8;
          font-size: 11px;
          font-family: var(--font-body, sans-serif);
          font-weight: 500;
          border-radius: 4px;
          white-space: nowrap;
          opacity: 0;
          transition: opacity 0.15s ease-out;
          pointer-events: none;
        }

        .village-sprite:hover .village-sprite-label {
          opacity: 1;
        }

        .village-sprite-level {
          position: absolute;
          top: -4px;
          right: -4px;
          padding: 1px 6px;
          background: rgba(212, 175, 55, 0.95);
          color: #1a1410;
          font-size: 10px;
          font-weight: 700;
          border-radius: 8px;
          border: 1px solid rgba(20,16,12,0.5);
          font-family: var(--font-heading, serif);
        }

        @media (max-width: 640px) {
          .village-view-wrapper {
            aspect-ratio: 4 / 3;
            border-radius: 8px;
          }
          .village-view-title {
            font-size: 12px;
            padding: 4px 8px;
          }
          .village-sprite-label {
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Sous-composant : un sprite positionné en absolu
// ─────────────────────────────────────────────────────────────────────────
function SpriteImg({ src, x, y, scale = 1, zIndex = 0, label, level, upgraded, decorative, onClick }) {
  // Largeur de base d'un sprite : ~22% du conteneur (à scale 1)
  const baseWidth = 22 * scale;

  // Affichage du badge level :
  // - sur un bâtiment construit "classique" : badge dès N2 (la N1 est implicite)
  // - sur un bâtiment fixe upgradable : badge dès N1 (pour signaler qu'il EST construit)
  const showLevelBadge = !decorative && level !== undefined && (upgraded ? level >= 1 : level >= 2);

  const classes = [
    "village-sprite",
    decorative ? "decorative" : "",
    upgraded ? "upgraded" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${baseWidth}%`,
        zIndex,
      }}
      onClick={decorative ? undefined : onClick}
      role={decorative ? "presentation" : "button"}
      aria-label={label || ""}
    >
      <img src={src} alt={label || ""} loading="lazy" />
      {showLevelBadge && (
        <span className="village-sprite-level">N{level}</span>
      )}
      {label && !decorative && (
        <span className="village-sprite-label">{label}</span>
      )}
    </div>
  );
}
