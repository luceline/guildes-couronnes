// src/components/VillageView.jsx
//
// Vue village isometrique de la ville. Affiche :
//   1. Un sol SVG isometrique : grille d'herbe avec une grande place pavee centrale
//   2. Les batiments fixes (mairie, taverne, atelier, etc.) poses sur la place pavee
//   3. Les batiments construisibles (city.buildings) en bordure, sur l'herbe
//   4. Les decors (arbres, buisson) en peripherie pour combler les vides
//
// Le sprite de la mairie change selon le tier de la ville (lingots_cumul) :
//   tier 1-2 (Hameau/Village)  -> mairie_n1
//   tier 3   (Bourg)            -> mairie_n2
//   tier 4   (Cite)             -> mairie_n3
//   tier 5+  (Capitale/Empire)  -> mairie_n4
//
// Responsive :
//   - Mobile (< 640px)       : 4/3, prend toute la largeur ecran
//   - Tablet (640-1024)      : 16/10, max-width 900px
//   - Desktop (>= 1024px)    : 21/9, max-width 1200px (panoramique)
//
// Routage au clic (architecture hybride, conserve depuis v1) :
//   - Batiments "lieu d'action" -> redirection vers page dediee (/taverne, /market, etc.)
//   - Batiments "specifiques ville" (mairie, gestion batiments) -> onOpenModal(tab)
//   - Batiments construits sans page dediee -> onShowBuildingInfo(buildingType)

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getCityTier } from "@/lib/gameData";

const SPRITE_BASE = "/sprites/village";

// ─────────────────────────────────────────────────────────────────────────
// Routage des clics : pour chaque target, on definit comment reagir.
// ─────────────────────────────────────────────────────────────────────────
const CLICK_ROUTES = {
  taverne:      { type: "navigate", path: "/taverne"     },
  marche:       { type: "navigate", path: "/market"      },
  atelier:      { type: "navigate", path: "/production"  },
  ecurie:       { type: "navigate", path: "/travel"      },
  arene:        { type: "navigate", path: "/combat"      },
  bibliotheque: { type: "navigate", path: "/savoir"      },
  quetes:       { type: "navigate", path: "/quetes"      },
  chaudron:     { type: "navigate", path: "/production"  },
  mairie:       { type: "modal",    tab:  "mairie"       },
  entrepot:     { type: "modal",    tab:  "mairie"       },
};

// ─────────────────────────────────────────────────────────────────────────
// Sprite de mairie selon le tier de ville
// ─────────────────────────────────────────────────────────────────────────
function mairieSpriteForTier(level) {
  if (level >= 5) return "mairie_n4";  // Capitale ou Empire
  if (level >= 4) return "mairie_n3";  // Cite
  if (level >= 3) return "mairie_n2";  // Bourg
  return "mairie_n1";                   // Hameau ou Village
}

// ─────────────────────────────────────────────────────────────────────────
// Layout : positions des batiments fixes (toujours visibles).
// Coordonnees en % du conteneur (responsive).
// Les batiments fixes sont positionnes SUR la place pavee centrale
// (zone approximative : x [25..75], y [25..80]).
// L'ordre dans le tableau n'a pas d'importance : on tri par y au rendu.
// ─────────────────────────────────────────────────────────────────────────
const FIXED_BUILDINGS = [
  // Mairie : centre, dominante (sprite dynamique selon tier)
  { key: "mairie",       sprite: "DYNAMIC",                     x: 50, y: 28, scale: 1.35, label: "Mairie",       target: "mairie"       },

  // Rang 2 : taverne (gauche) + marche (droite), commerce/social
  { key: "taverne",      sprite: "taverne",                     x: 26, y: 42, scale: 0.95, label: "Taverne",      target: "taverne"      },
  { key: "marche",       sprite: "construction_marche",         x: 74, y: 42, scale: 0.95, label: "Marche",       target: "marche"       },

  // Rang 3 : atelier (gauche) + chaudron (droite), production/craft
  { key: "atelier",      sprite: "atelier",                     x: 32, y: 58, scale: 0.95, label: "Atelier",      target: "atelier"      },
  { key: "chaudron",     sprite: "chaudron",                    x: 68, y: 58, scale: 0.95, label: "Chaudron",     target: "chaudron"     },

  // Rang 4 : ecurie + entrepot + tableau quetes (rangee avant)
  { key: "ecurie",       sprite: "ecurie",                      x: 28, y: 74, scale: 0.9,  label: "Ecurie",       target: "ecurie"       },
  { key: "entrepot",     sprite: "entrepot",                    x: 50, y: 78, scale: 1.0,  label: "Entrepot",     target: "entrepot"     },
  { key: "quetes",       sprite: "construction_tableau_quetes", x: 72, y: 74, scale: 0.8,  label: "Quetes",       target: "quetes"       },

  // Rang 5 : bibliotheque (extreme gauche, hors place pavee) + arene (extreme droite, hors place)
  { key: "bibliotheque", sprite: "construction_bibliotheque",   x: 11, y: 60, scale: 0.85, label: "Bibliotheque", target: "bibliotheque" },
  { key: "arene",        sprite: "construction_arene",          x: 89, y: 60, scale: 0.95, label: "Arene",        target: "arene"        },
];

// Batiments fixes qui sont aussi ameliorables via city.buildings.
const UPGRADABLE_FIXED = {
  bibliotheque: "bibliotheque",
};

// ─────────────────────────────────────────────────────────────────────────
// Batiments construisibles : visibles UNIQUEMENT si presents dans city.buildings.
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
  eglise:       "construction_sanctuaire",
  comptoir:     "construction_banque",
  relais:       "construction_relais_postal",
};

// Slots pour les batiments construisibles, places sur l'herbe en peripherie.
const BUILD_SLOTS = [
  { x:  9, y: 22 },
  { x: 91, y: 22 },
  { x:  9, y: 42 },
  { x: 91, y: 42 },
  { x:  9, y: 80 },
  { x: 91, y: 80 },
  { x: 32, y: 12 },
  { x: 68, y: 12 },
  { x: 32, y: 92 },
  { x: 68, y: 92 },
];

// ─────────────────────────────────────────────────────────────────────────
// Decors : positions fixes purement esthetiques, sur l'herbe.
// ─────────────────────────────────────────────────────────────────────────
const DECORS = [
  { sprite: "decor_arbre",      x:  5, y:  6, scale: 0.45 },
  { sprite: "decor_arbre",      x: 95, y:  8, scale: 0.45 },
  { sprite: "decor_arbre",      x:  4, y: 95, scale: 0.4  },
  { sprite: "decor_arbre",      x: 96, y: 95, scale: 0.4  },
  { sprite: "decor_buisson",    x: 18, y: 92, scale: 0.35 },
  { sprite: "decor_buisson",    x: 82, y: 92, scale: 0.35 },
  { sprite: "decor_lampadaire", x: 38, y: 21, scale: 0.30 },
  { sprite: "decor_lampadaire", x: 62, y: 21, scale: 0.30 },
];

// ─────────────────────────────────────────────────────────────────────────
// Hash deterministe d'une string + PRNG seede (variations stables par ville)
// ─────────────────────────────────────────────────────────────────────────
function hashString(str) {
  let h = 0;
  if (!str) return 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function makeSeededRandom(seed) {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Genere des touffes d'herbe deterministes, hors de la place pavee centrale
function generateGrassTufts(cityId, count = 22) {
  const rand = makeSeededRandom(hashString(cityId || "default"));
  const tufts = [];
  // Test si un point est dans le rhombe pave central
  const inPaved = (x, y) => Math.abs(x - 50) / 38 + Math.abs(y - 50) / 38 <= 1;

  let attempts = 0;
  while (tufts.length < count && attempts < count * 8) {
    attempts++;
    const x = rand() * 100;
    const y = rand() * 100;
    if (inPaved(x, y)) continue;
    if (x < 3 || x > 97 || y < 3 || y > 97) continue;
    tufts.push({ x, y, size: 4 + rand() * 4, opacity: 0.15 + rand() * 0.2 });
  }
  return tufts;
}

// ─────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────
export default function VillageView({ city, onOpenModal, onShowBuildingInfo }) {
  const navigate = useNavigate();

  const handleBuildingClick = (target) => {
    const route = CLICK_ROUTES[target];
    if (route) {
      if (route.type === "navigate") navigate(route.path);
      else if (route.type === "modal") onOpenModal?.(route.tab);
      return;
    }
    if (BUILDING_SPRITE_MAP[target]) {
      onShowBuildingInfo?.(target);
      return;
    }
    console.log("[VillageView] clic non route :", target);
  };

  const cityTier = useMemo(() => {
    if (!city) return { level: 1, label: "Hameau", icon: "" };
    return getCityTier(city.lingots_cumul || 0);
  }, [city]);

  const mairieSprite = mairieSpriteForTier(cityTier.level);

  const fixedUpgradeLevels = useMemo(() => {
    if (!city?.buildings) return {};
    const result = {};
    for (const [fixedKey, buildingType] of Object.entries(UPGRADABLE_FIXED)) {
      const built = (city.buildings || []).find(b => b.building_type === buildingType);
      if (built) result[fixedKey] = built.level || 1;
    }
    return result;
  }, [city?.buildings]);

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

  const grassTufts = useMemo(
    () => generateGrassTufts(city?.id, 22),
    [city?.id]
  );

  if (!city) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        Pas de ville chargee.
      </div>
    );
  }

  const allBuildings = [
    ...FIXED_BUILDINGS.map(b => ({
      ...b,
      sprite: b.sprite === "DYNAMIC" ? mairieSprite : b.sprite,
      level: fixedUpgradeLevels[b.key] || undefined,
      upgraded: !!fixedUpgradeLevels[b.key],
    })),
    ...builtConstructions,
  ].sort((a, b) => a.y - b.y);

  const allDecors = DECORS.slice().sort((a, b) => a.y - b.y);

  return (
    <div className="village-view-wrapper">
      {/* SOL ISOMETRIQUE : herbe + place pavee centrale + touffes */}
      <svg
        className="village-ground"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          {/* Gradient herbe (vert plus clair au centre, plus sombre aux bords) */}
          <radialGradient id="grass-gradient" cx="50%" cy="50%" r="65%">
            <stop offset="0%"   stopColor="#8aab5e" />
            <stop offset="60%"  stopColor="#6e9148" />
            <stop offset="100%" stopColor="#4f6c33" />
          </radialGradient>

          {/* Gradient pave (gris-dore, plus clair au centre) */}
          <radialGradient id="paved-gradient" cx="50%" cy="50%" r="60%">
            <stop offset="0%"   stopColor="#c2b08a" />
            <stop offset="60%"  stopColor="#9d8a64" />
            <stop offset="100%" stopColor="#7a6a4a" />
          </radialGradient>

          {/* Pattern de pavage iso : petits losanges qui tilent */}
          <pattern id="paved-pattern" x="0" y="0" width="6" height="3" patternUnits="userSpaceOnUse">
            <rect width="6" height="3" fill="rgba(60, 50, 35, 0.18)" />
            <polygon
              points="3,0.3 5.7,1.5 3,2.7 0.3,1.5"
              fill="rgba(212, 192, 150, 0.55)"
              stroke="rgba(80, 65, 45, 0.35)"
              strokeWidth="0.08"
            />
          </pattern>

          {/* Bordure de la place pavee (sable/terre tassee) */}
          <radialGradient id="border-gradient" cx="50%" cy="50%" r="55%">
            <stop offset="0%"   stopColor="rgba(155, 130, 90, 0)" />
            <stop offset="85%"  stopColor="rgba(155, 130, 90, 0.6)" />
            <stop offset="100%" stopColor="rgba(110, 90, 60, 0.85)" />
          </radialGradient>

          {/* Clip pour le pattern pavage (limite le pattern au rhombe central) */}
          <clipPath id="paved-clip">
            <polygon points="50,12 88,50 50,88 12,50" />
          </clipPath>
        </defs>

        {/* Couche 1 : herbe pleine */}
        <rect x="0" y="0" width="100" height="100" fill="url(#grass-gradient)" />

        {/* Couche 2 : touffes d'herbe deterministes */}
        {grassTufts.map((t, i) => (
          <ellipse
            key={`tuft-${i}`}
            cx={t.x}
            cy={t.y}
            rx={t.size * 0.6}
            ry={t.size * 0.3}
            fill={`rgba(110, 145, 65, ${t.opacity})`}
          />
        ))}

        {/* Couche 3 : bordure douce autour de la place pavee */}
        <polygon
          points="50,8 92,50 50,92 8,50"
          fill="url(#border-gradient)"
        />

        {/* Couche 4 : place pavee centrale (rhombe iso) */}
        <polygon
          points="50,12 88,50 50,88 12,50"
          fill="url(#paved-gradient)"
        />

        {/* Couche 5 : pattern de pavage clip dans le rhombe */}
        <rect
          x="0" y="0" width="100" height="100"
          fill="url(#paved-pattern)"
          clipPath="url(#paved-clip)"
          opacity="0.55"
        />

        {/* Couche 6 : bordure du rhombe (relief) */}
        <polygon
          points="50,12 88,50 50,88 12,50"
          fill="none"
          stroke="rgba(60, 45, 25, 0.35)"
          strokeWidth="0.4"
        />
      </svg>

      {/* SCENE : decors + batiments */}
      <div className="village-view-stage">
        {allDecors.map((d, idx) => (
          <SpriteImg
            key={`decor-${idx}`}
            src={`${SPRITE_BASE}/${d.sprite}.png`}
            x={d.x} y={d.y} scale={d.scale}
            zIndex={Math.round(d.y * 10)}
            decorative
          />
        ))}

        {allBuildings.map(b => (
          <SpriteImg
            key={b.key}
            src={`${SPRITE_BASE}/${b.sprite}.png`}
            x={b.x} y={b.y} scale={b.scale}
            zIndex={Math.round(b.y * 10) + 100}
            label={b.label}
            level={b.level}
            upgraded={b.upgraded}
            onClick={() => handleBuildingClick(b.target)}
          />
        ))}
      </div>

      {/* En-tete : nom de la ville + tier */}
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
          margin: 0 auto;
          aspect-ratio: 4 / 3;
          max-width: 100%;
          background: #4f6c33;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4),
                      inset 0 0 60px rgba(0, 0, 0, 0.25);
        }

        @media (min-width: 640px) {
          .village-view-wrapper {
            aspect-ratio: 16 / 10;
            max-width: 900px;
            border-radius: 12px;
          }
        }

        @media (min-width: 1024px) {
          .village-view-wrapper {
            aspect-ratio: 21 / 9;
            max-width: 1200px;
          }
        }

        .village-ground {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          user-select: none;
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
          background: rgba(20, 16, 12, 0.7);
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
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
        }

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
          transform: translate(-50%, -52%) scale(1.05);
          filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.45))
                  drop-shadow(0 0 14px rgba(247, 215, 116, 0.7));
          animation: none;
          z-index: 9999 !important;
        }

        .village-sprite img {
          display: block;
          width: 100%;
          height: auto;
          filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.35));
        }

        .village-sprite-label {
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          padding: 2px 8px;
          background: rgba(20, 16, 12, 0.9);
          color: #f5e9c8;
          font-size: 11px;
          font-family: var(--font-body, sans-serif);
          font-weight: 500;
          border-radius: 4px;
          white-space: nowrap;
          opacity: 0;
          transition: opacity 0.15s ease-out;
          pointer-events: none;
          z-index: 1;
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
          border: 1px solid rgba(20, 16, 12, 0.5);
          font-family: var(--font-heading, serif);
          z-index: 2;
        }

        @media (max-width: 640px) {
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
// Sous-composant : un sprite positionne en absolu
// ─────────────────────────────────────────────────────────────────────────
function SpriteImg({ src, x, y, scale = 1, zIndex = 0, label, level, upgraded, decorative, onClick }) {
  const baseWidth = 22 * scale;
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
