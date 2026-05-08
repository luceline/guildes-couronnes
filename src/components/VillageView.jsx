// src/components/VillageView.jsx
//
// Vue village isometrique de la ville. Affiche :
//   1. Un fond vert uni (sol decoratif a ajouter plus tard)
//   2. Les batiments fixes (mairie, taverne, etc.) toujours visibles
//   3. Les batiments construisibles UNIQUEMENT s'ils existent dans city.buildings
//   4. Les decors (arbres, buisson) toujours visibles
//
// Le placement utilise une grille virtuelle 20 colonnes x 12 lignes (240 tuiles).
// Chaque batiment occupe un footprint (gridW x gridH) tuiles et est ancre par
// son coin haut-gauche (col, row).
//
// Stack des maisons : si le joueur en a 2 construites, on affiche maison
// (placement principal) + maison_2 (placement secondaire avec flip).
//
// Le sprite de la mairie change selon le tier :
//   tier 1-2 (Hameau/Village)  -> mairie_n1
//   tier 3   (Bourg)            -> mairie_n2
//   tier 4   (Cite)             -> mairie_n3
//   tier 5+  (Capitale/Empire)  -> mairie_n4

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getCityTier } from "@/lib/gameData";

const SPRITE_BASE = "/sprites/village";

// ─────────────────────────────────────────────────────────────────────────
// Grille virtuelle
// ─────────────────────────────────────────────────────────────────────────
const GRID_COLS = 20;
const GRID_ROWS = 12;
const TILE_W = 100 / GRID_COLS;  // 5 %
const TILE_H = 100 / GRID_ROWS;  // 8.33 %

function gridCenter(col, row, gridW, gridH) {
  return {
    cx: (col + gridW / 2) * TILE_W,
    cy: (row + gridH / 2) * TILE_H,
  };
}

function spriteWidth(gridW, gridH, scale) {
  // Formule alignee sur l'editeur de placement :
  // baseWidth = 22% * scale * max(gridW, gridH) / 2
  return 22 * scale * Math.max(gridW, gridH) / 2;
}

// ─────────────────────────────────────────────────────────────────────────
// Routage des clics
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

function mairieSpriteForTier(level) {
  if (level >= 5) return "mairie_n4";
  if (level >= 4) return "mairie_n3";
  if (level >= 3) return "mairie_n2";
  return "mairie_n1";
}

// ─────────────────────────────────────────────────────────────────────────
// Batiments fixes : toujours affiches (placement issu de l'editeur)
// ─────────────────────────────────────────────────────────────────────────
const FIXED_BUILDINGS = [
  { key: "mairie",       sprite: "DYNAMIC",                     col: 9,  row: 4, gridW: 3, gridH: 3, scale: 0.5, flip: false, label: "Mairie",         target: "mairie"       },
  { key: "taverne",      sprite: "taverne",                     col: 12, row: 4, gridW: 2, gridH: 2, scale: 0.5, flip: false, label: "Taverne",        target: "taverne"      },
  { key: "marche",       sprite: "construction_marche",         col: 10, row: 7, gridW: 2, gridH: 2, scale: 0.5, flip: false, label: "Marche",         target: "marche"       },
  { key: "atelier",      sprite: "atelier",                     col: 10, row: 2, gridW: 2, gridH: 2, scale: 0.5, flip: false, label: "Atelier",        target: "atelier"      },
  { key: "chaudron",     sprite: "chaudron",                    col: 8,  row: 2, gridW: 2, gridH: 2, scale: 0.5, flip: true,  label: "Chaudron",       target: "chaudron"     },
  { key: "ecurie",       sprite: "ecurie",                      col: 7,  row: 4, gridW: 2, gridH: 2, scale: 0.5, flip: false, label: "Ecurie",         target: "ecurie"       },
  { key: "entrepot",     sprite: "entrepot",                    col: 12, row: 6, gridW: 2, gridH: 2, scale: 0.5, flip: false, label: "Entrepot",       target: "entrepot"     },
  { key: "quetes",       sprite: "construction_tableau_quetes", col: 6,  row: 5, gridW: 1, gridH: 2, scale: 0.5, flip: false, label: "Tableau quetes", target: "quetes"       },
  { key: "bibliotheque", sprite: "construction_bibliotheque",   col: 5,  row: 3, gridW: 2, gridH: 2, scale: 0.5, flip: true,  label: "Bibliotheque",   target: "bibliotheque" },
  { key: "arene",        sprite: "construction_arene",          col: 12, row: 2, gridW: 2, gridH: 2, scale: 0.5, flip: false, label: "Arene",          target: "arene"        },
];

// Batiments fixes upgradables : recoivent glow + badge si construits en BDD
const UPGRADABLE_FIXED = {
  bibliotheque: "bibliotheque",
};

// ─────────────────────────────────────────────────────────────────────────
// Slots des batiments construisibles : visibles UNIQUEMENT si presents
// dans city.buildings.
//
// Sprite mappe par building_type. Si plusieurs slots pointent sur le meme
// building_type (ex: maison + maison_2), on les remplit dans l'ordre selon
// le nombre d'instances construites par le joueur.
// ─────────────────────────────────────────────────────────────────────────
const BUILD_SLOTS = {
  scierie:       { type: "scierie",       sprite: "construction_scierie",        col: 2,  row: 8,  gridW: 2, gridH: 2, scale: 0.5, flip: true  },
  mine:          { type: "mine",          sprite: "construction_mine",           col: 2,  row: 6,  gridW: 2, gridH: 2, scale: 0.5, flip: true  },
  moulin:        { type: "moulin",        sprite: "construction_moulin",         col: 4,  row: 6,  gridW: 2, gridH: 2, scale: 0.5, flip: true  },
  bergerie:      { type: "bergerie",      sprite: "construction_bergerie",       col: 1,  row: 4,  gridW: 2, gridH: 2, scale: 0.5, flip: false },
  laboratoire:   { type: "laboratoire",   sprite: "construction_laboratoire",    col: 4,  row: 8,  gridW: 2, gridH: 2, scale: 0.5, flip: false },
  fonderie:      { type: "fonderie",      sprite: "construction_fonderie",       col: 3,  row: 4,  gridW: 2, gridH: 2, scale: 0.5, flip: false },
  hospice:       { type: "hospice",       sprite: "construction_hospice",        col: 14, row: 2,  gridW: 2, gridH: 2, scale: 0.5, flip: false },
  grenier:       { type: "grenier",       sprite: "construction_grenier",        col: 17, row: 4,  gridW: 2, gridH: 2, scale: 0.5, flip: false },
  eglise:        { type: "eglise",        sprite: "construction_sanctuaire",     col: 14, row: 4,  gridW: 2, gridH: 2, scale: 0.5, flip: false },
  comptoir:      { type: "comptoir",      sprite: "construction_banque",         col: 6,  row: 7,  gridW: 2, gridH: 2, scale: 0.5, flip: true  },
  relais:        { type: "relais",        sprite: "construction_relais_postal",  col: 8,  row: 8,  gridW: 2, gridH: 2, scale: 0.5, flip: false },

  // Maisons (max 2 par ville) : 2 slots distincts qui pointent sur "maison"
  maison_1:      { type: "maison",        sprite: "logement_maison",             col: 13, row: 9,  gridW: 1, gridH: 1, scale: 0.5, flip: false },
  maison_2:      { type: "maison",        sprite: "logement_maison",             col: 12, row: 9,  gridW: 1, gridH: 1, scale: 0.5, flip: true  },


  // Statue royale (entite separee mais affichee comme un building si presente dans city.buildings)
  statue_royale: { type: "statue_royale", sprite: "construction_statue_royale",  col: 16, row: 6,  gridW: 1, gridH: 1, scale: 1.35, flip: false },

  // Trophee
  trophee:       { type: "trophee",       sprite: "construction_trophee",        col: 9,  row: 7,  gridW: 1, gridH: 1, scale: 0.5, flip: false },
};

// ─────────────────────────────────────────────────────────────────────────
// Decors : positions libres en %, toujours affiches
// ─────────────────────────────────────────────────────────────────────────
const DECORS = [
  { sprite: "decor_arbre",      x: 42.6, y: 57.2, scale: 0.4,  flip: false },
  { sprite: "decor_arbre",      x: 87.4, y: 27.8, scale: 0.4,  flip: false },
  { sprite: "decor_arbre",      x: 59.1, y: 39.2, scale: 0.4,  flip: false },
  { sprite: "decor_arbre",      x: 27.7, y: 19.7, scale: 0.4,  flip: false },
  { sprite: "decor_arbre",      x: 57.4, y: 85.3, scale: 0.4,  flip: false },
  { sprite: "decor_arbre",      x: 72.6, y: 56.7, scale: 0.4,  flip: false },
  { sprite: "decor_buisson",    x: 20.5, y: 86.8, scale: 0.3,  flip: false },
  { sprite: "decor_buisson",    x: 33.4, y: 81.2, scale: 0.3,  flip: false },
  { sprite: "decor_buisson",    x: 70.2, y: 73.0, scale: 0.3,  flip: false },
  { sprite: "decor_buisson",    x: 80.1, y: 72.6, scale: 0.3,  flip: false },
  { sprite: "decor_lampadaire", x: 37.4, y: 24.7, scale: 1.0,  flip: false },
  { sprite: "decor_lampadaire", x: 82.0, y: 30.9, scale: 1.0,  flip: false },
  { sprite: "decor_lampadaire", x: 47.3, y: 40.0, scale: 1.0,  flip: false },
  { sprite: "decor_lampadaire", x: 7.6,  y: 64.3, scale: 1.0,  flip: false },
  { sprite: "decor_charette",   x: 52.2, y: 77.3, scale: 0.3,  flip: false },
  { sprite: "decor_fontaine",   x: 75.3, y: 69.3, scale: 1.05, flip: false },
];

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
    // Pas de route definie : on ouvre la modale d'info du batiment
    onShowBuildingInfo?.(target);
  };

  // Tier de la ville (dictate le sprite de la mairie)
  const cityTier = useMemo(() => {
    if (!city) return { level: 1, label: "Hameau", icon: "" };
    return getCityTier(city.lingots_cumul || 0);
  }, [city]);

  const mairieSprite = mairieSpriteForTier(cityTier.level);

  // Niveaux d'upgrade pour les batiments fixes upgradables
  const fixedUpgradeLevels = useMemo(() => {
    if (!city?.buildings) return {};
    const result = {};
    for (const [fixedKey, buildingType] of Object.entries(UPGRADABLE_FIXED)) {
      const built = (city.buildings || []).find(b => b.building_type === buildingType);
      if (built) result[fixedKey] = built.level || 1;
    }
    return result;
  }, [city?.buildings]);

  // Compte le nombre d'instances de chaque building_type construit
  const builtCounts = useMemo(() => {
    if (!city?.buildings) return {};
    const counts = {};
    (city.buildings || []).forEach(b => {
      counts[b.building_type] = (counts[b.building_type] || 0) + 1;
    });
    return counts;
  }, [city?.buildings]);

  // Filtre les BUILD_SLOTS pour ne garder que ceux qui correspondent a un batiment construit.
  // Pour les types stackables (ex: 2 maisons), on remplit les slots dans l'ordre.
  const visibleBuildSlots = useMemo(() => {
    const slotsByType = {};
    // Regroupe les slots par building_type (ordre stable d'iteration)
    for (const [slotKey, slot] of Object.entries(BUILD_SLOTS)) {
      if (!slotsByType[slot.type]) slotsByType[slot.type] = [];
      slotsByType[slot.type].push({ slotKey, ...slot });
    }
    const visible = [];
    for (const [type, slots] of Object.entries(slotsByType)) {
      const count = Math.min(slots.length, builtCounts[type] || 0);
      // On affiche les `count` premiers slots de ce type
      for (let i = 0; i < count; i++) {
        visible.push(slots[i]);
      }
    }
    // Recupere le level pour chaque batiment construit (pour le badge)
    return visible.map(s => {
      const built = (city?.buildings || []).find(b => b.building_type === s.type);
      return { ...s, level: built?.level || 1 };
    });
  }, [builtCounts, city?.buildings]);

  if (!city) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        Pas de ville chargee.
      </div>
    );
  }

  // Construction de la liste finale des sprites a afficher (fixes + construits)
  // Tri par y (cy) croissant pour que les sprites du fond soient derriere ceux du devant
  const allBuildings = [
    ...FIXED_BUILDINGS.map(b => {
      const sprite = b.sprite === "DYNAMIC" ? mairieSprite : b.sprite;
      const upgraded = !!fixedUpgradeLevels[b.key];
      const level = fixedUpgradeLevels[b.key];
      return { ...b, sprite, upgraded, level };
    }),
    ...visibleBuildSlots.map(s => ({
      key: s.slotKey,
      sprite: s.sprite,
      col: s.col, row: s.row, gridW: s.gridW, gridH: s.gridH,
      scale: s.scale, flip: s.flip,
      label: s.type,
      target: s.type,
      level: s.level,
      upgraded: false,
    })),
  ].map(b => {
    const center = gridCenter(b.col, b.row, b.gridW, b.gridH);
    return { ...b, cx: center.cx, cy: center.cy };
  }).sort((a, b) => a.cy - b.cy);

  return (
    <div className="village-view-wrapper">
      {/* SOL : fond vert uni (decor a ajouter plus tard) */}
      <div className="village-ground" />

      {/* SCENE : decors + batiments */}
      <div className="village-view-stage">
        {/* Decors en arriere-plan (positions libres en %) */}
        {DECORS.slice().sort((a, b) => a.y - b.y).map((d, idx) => (
          <SpriteImg
            key={`decor-${idx}`}
            src={`${SPRITE_BASE}/${d.sprite}.png`}
            cx={d.x} cy={d.y}
            widthPct={22 * d.scale * 0.5}
            zIndex={Math.round(d.y * 10)}
            flip={d.flip}
            decorative
          />
        ))}

        {/* Batiments fixes + construits */}
        {allBuildings.map(b => (
          <SpriteImg
            key={b.key}
            src={`${SPRITE_BASE}/${b.sprite}.png`}
            cx={b.cx} cy={b.cy}
            widthPct={spriteWidth(b.gridW, b.gridH, b.scale)}
            zIndex={Math.round(b.cy * 10) + 100}
            flip={b.flip}
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
          {cityTier.icon && <span className="village-view-title-icon">{cityTier.icon}</span>}
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
          background: #6e9148;
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
            max-width: 1400px;
          }
        }

        .village-ground {
          position: absolute;
          inset: 0;
          background: #6e9148 url('/sprites/village/village_ground.webp') center / cover no-repeat;
          pointer-events: none;
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

        .village-sprite img.flipped {
          transform: scaleX(-1);
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
function SpriteImg({ src, cx, cy, widthPct, zIndex = 0, flip, label, level, upgraded, decorative, onClick }) {
  // Affichage du badge level :
  // - sur un batiment fixe upgradable construit : badge des N1
  // - sur un batiment construit "classique" : badge des N2
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
        left: `${cx}%`,
        top: `${cy}%`,
        width: `${widthPct}%`,
        zIndex,
      }}
      onClick={decorative ? undefined : onClick}
      role={decorative ? "presentation" : "button"}
      aria-label={label || ""}
    >
      <img
        src={src}
        alt={label || ""}
        loading="lazy"
        className={flip ? "flipped" : ""}
      />
      {showLevelBadge && (
        <span className="village-sprite-level">N{level}</span>
      )}
      {label && !decorative && (
        <span className="village-sprite-label">{label}</span>
      )}
    </div>
  );
}
