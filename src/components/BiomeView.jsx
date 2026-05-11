/**
 * BiomeView.jsx
 *
 * Map immersive d'un biome (forêt, mine, champs, atelier, forge, guilde,
 * jardin, carrière) avec sprites cliquables :
 *   - Coffre (col 4, row 4) : inventaire personnel du joueur
 *   - Épopée (col 9, row 5) : sanctuaire pour lancer l'épopée du jour
 *   - Écurie (col 5, row 8) : retour à la ville d'origine
 *   - Récolte (col 14, row 5) : drawer de récolte AFK (sprite contextuel
 *     selon le biome : scierie pour forêt, moulin pour champs, etc.)
 *
 * Créé le 10/05/2026 dans le cadre de la refonte map-first mobile.
 */
import { useMemo, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import CombatEpic from "@/components/combat/CombatEpic";
import BiomeHub from "@/components/BiomeHub";
import InventairePage from "@/pages/InventairePage";
import SystemMessageBanner from "@/components/SystemMessageBanner";
import { BIOMES, getBiomeName } from "@/lib/biomes";
import { applyRandomActionCost } from "@/lib/gameData";

const SPRITE_BASE = "/sprites/village";
const BIOME_BASE = "/sprites/biomes";

// Grille identique à VillageView pour cohérence (20 colonnes × 12 rangs)
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

// Mapping sprite récolte selon le biome (réutilise les sprites existants
// de la ville pour cohérence visuelle — le joueur reconnaît les bâtiments).
const HARVEST_SPRITE_BY_BIOME = {
  foret:    "construction_scierie",
  champs:   "construction_moulin",
  mine:     "construction_mine",
  atelier:  "construction_bergerie",   // tisserands → bergerie (laine)
  forge:    "construction_fonderie",
  guilde:   "construction_sanctuaire",
  jardin:   "construction_laboratoire", // jardin → labo (alchimie)
  carriere: "construction_mine",       // carrière → mine (extraction)
};

// Cibles des drawers
const DRAWER_TARGETS = {
  coffre:  { title: "Coffre",   Component: InventairePage,   needsProps: false },
  recolte: { title: "Récolte",  Component: BiomeHub,         needsProps: "harvest" },
  epopee:  { title: "Épopée",   Component: CombatEpic,       needsProps: "epic" },
};

// Sous-composant sprite simple (réutilise les classes CSS de VillageView)
function BiomeSprite({ src, cx, cy, widthPct, zIndex = 0, flip, label, onClick }) {
  return (
    <div
      className="village-sprite"
      style={{
        left: `${cx}%`,
        top: `${cy}%`,
        width: `${widthPct}%`,
        zIndex,
      }}
      onClick={onClick}
      role="button"
      aria-label={label || ""}
    >
      <img
        src={src}
        alt={label || ""}
        loading="lazy"
        className={flip ? "flipped" : ""}
      />
      {label && (
        <span className="village-sprite-label">{label}</span>
      )}
    </div>
  );
}

export default function BiomeView({ profile, city, onRefresh, biomeKey: biomeKeyProp, onExit }) {
  const [openDrawer, setOpenDrawer] = useState(null);
  const [returning, setReturning] = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(false);

  // Détermine le biome actuel :
  // 1. Si biomeKey passé en prop (depuis Travel.jsx avec state local) → utilise ça
  // 2. Sinon, lit depuis travel_destination_id ("biome:foret" → "foret")
  const biomeKey = useMemo(() => {
    if (biomeKeyProp) return biomeKeyProp;
    const dest = profile?.travel_destination_id || "";
    if (dest.startsWith("biome:")) return dest.replace("biome:", "");
    return null;
  }, [biomeKeyProp, profile?.travel_destination_id]);

  const biomeInfo = biomeKey ? BIOMES[biomeKey] : null;
  const harvestSprite = biomeKey ? HARVEST_SPRITE_BY_BIOME[biomeKey] : null;

  if (!biomeKey || !biomeInfo) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        Biome inconnu.
      </div>
    );
  }

  // Handler "retour ville" (10/05/2026) :
  // - Si onExit fourni (mode exploration locale via Travel.jsx) → on appelle onExit
  //   pour fermer la BiomeView sans toucher au profile (rétro-compat)
  // - Sinon (mode persistant, vrai voyage en biome) → on lance un voyage de
  //   2 minutes vers la ville d'origine du joueur (home_city_id). Symétrie
  //   avec le voyage aller : 2 min + 1 PA aléatoire.
  // La confirmation est gérée via une AlertDialog avant l'appel à ce handler.
  const handleReturnToCityConfirmed = async () => {
    if (returning) return;
    if (onExit) {
      onExit();
      return;
    }
    setReturning(true);
    try {
      // Coût d'1 PA (faim ou énergie) pour le voyage retour
      const costResult = applyRandomActionCost(profile, 1);
      if (!costResult.ok) {
        toast.error(costResult.errorMessage);
        setReturning(false);
        return;
      }

      const TRAVEL_DURATION_MINUTES = 2;
      const arrivalTime = new Date(Date.now() + TRAVEL_DURATION_MINUTES * 60 * 1000).toISOString();
      const destinationId = profile.home_city_id || profile.city_id;

      if (!destinationId) {
        toast.error("Impossible de déterminer votre ville d'origine.");
        setReturning(false);
        return;
      }

      await base44.entities.PlayerProfile.update(profile.id, {
        is_traveling: true,
        travel_destination_id: destinationId,
        travel_arrival_time: arrivalTime,
        hunger: costResult.newHunger,
        fatigue: costResult.newFatigue,
        // current_biome reste set pendant le voyage (retiré à l'arrivée par
        // handleTravelArrival). Cela permet à TravelPage de continuer à afficher
        // le timer de voyage correctement.
      });
      const cityName = city?.name || "votre ville";
      toast.success(`🐴 En route vers ${cityName} (${TRAVEL_DURATION_MINUTES} min)`);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Erreur retour ville:", e);
      toast.error("Impossible de retourner à la ville pour le moment.");
    } finally {
      setReturning(false);
    }
  };

  // Wrapper qui ouvre la modal de confirmation avant retour
  const handleReturnToCity = () => {
    if (returning) return;
    if (onExit) {
      // Mode exploration locale : pas de confirmation, retour immédiat
      onExit();
      return;
    }
    // Mode persistant : ouvrir la modal
    setConfirmReturn(true);
  };

  // Liste des sprites placés en utilisant la même grille que VillageView
  // Position demandée : épopée 9:5, coffre 4:4, écurie 5:8, récolte 14:5
  const sprites = [
    {
      key: "coffre",
      src: `${BIOME_BASE}/sprite_coffre.webp`,
      col: 4, row: 4, gridW: 2, gridH: 2,
      scale: 0.45, flip: false,
      label: "Coffre",
      target: "coffre",
    },
    {
      key: "epopee",
      src: `${BIOME_BASE}/sprite_epopee.png`,
      col: 9, row: 5, gridW: 3, gridH: 3,
      scale: 0.7, flip: false,
      label: "Sanctuaire",
      target: "epopee",
    },
    {
      key: "ecurie",
      src: `${SPRITE_BASE}/ecurie.png`,
      col: 5, row: 8, gridW: 2, gridH: 2,
      scale: 0.5, flip: false,
      label: "Retour à la ville",
      target: "_return_city",  // Handler spécial
    },
    {
      key: "recolte",
      src: harvestSprite ? `${SPRITE_BASE}/${harvestSprite}.png` : null,
      col: 14, row: 5, gridW: 2, gridH: 2,
      scale: 0.5, flip: false,
      label: "Récolte",
      target: "recolte",
    },
  ].filter(s => s.src);

  // Calcul des positions (cx/cy + widthPct)
  const placedSprites = sprites.map(s => {
    const center = gridCenter(s.col, s.row, s.gridW, s.gridH);
    return {
      ...s,
      cx: center.cx,
      cy: center.cy,
      widthPct: s.gridW * TILE_W * (s.scale || 1) * 1.6,
    };
  }).sort((a, b) => a.cy - b.cy);  // tri par y pour overlap correct

  // Drawer rendering helper
  const renderDrawerContent = () => {
    if (!openDrawer || !DRAWER_TARGETS[openDrawer]) return null;
    const target = DRAWER_TARGETS[openDrawer];
    const Comp = target.Component;
    if (target.needsProps === "harvest") {
      return <Comp profile={profile} biomeKey={biomeKey} biomeInfo={biomeInfo} city={city} onRefresh={onRefresh} />;
    }
    if (target.needsProps === "epic") {
      return <Comp profile={profile} biomeKey={biomeKey} onExit={() => { setOpenDrawer(null); if (onRefresh) onRefresh(); }} />;
    }
    return <Comp />;
  };

  // Click handler : drawer ou retour ville
  const handleSpriteClick = (target) => {
    if (target === "_return_city") {
      handleReturnToCity();
      return;
    }
    setOpenDrawer(target);
  };

  return (
    <>
      {/* Mobile : on rend la map en position fixed inset-0 pour fullscreen
       * (au-dessus du main qui peut être en overflow-y-auto pour les autres
       * pages). Sur desktop, la map est en relative dans le flow normal. */}
      <div className="biome-view-fullscreen village-view-wrapper">
        {/* Fond du biome (couvre tout le wrapper) */}
        <div
          className="village-ground"
          style={{ backgroundImage: `url('${BIOME_BASE}/biome_${biomeKey}_ground.webp')` }}
        />

        {/* Bandeau système en overlay (visible uniquement mobile) */}
        <div className="md:hidden absolute top-0 left-0 right-0 z-20 pointer-events-none">
          <SystemMessageBanner mode="overlay" />
        </div>

        {/* Header titre du biome (en haut au centre) */}
        <div className="village-view-header">
          <div className="village-view-title">
            <span className="village-view-title-icon">{biomeInfo.icon}</span>
            <span className="village-view-title-name">{biomeInfo.short}</span>
            <span className="village-view-tier">{biomeInfo.name}</span>
          </div>
        </div>

        {/* Sprites */}
        <div className="village-view-stage">
          {placedSprites.map((s, idx) => (
            <BiomeSprite
              key={s.key}
              src={s.src}
              cx={s.cx}
              cy={s.cy}
              widthPct={s.widthPct}
              zIndex={Math.round(s.cy * 10)}
              flip={s.flip}
              label={s.label}
              onClick={() => handleSpriteClick(s.target)}
            />
          ))}
        </div>
      </div>

      {/* CSS scoped : fullscreen mobile, normal desktop + styles sprites
       * (10/05/2026) On duplique le CSS sprites de VillageView pour que les
       * sprites de BiomeView aient le même rendu visuel (drop-shadow, hover,
       * label au survol, etc.). À terme, ce CSS pourrait être extrait dans
       * index.css pour éviter la duplication.
       */}
      <style>{`
        /* Desktop par défaut : aspect-ratio panoramique */
        .biome-view-fullscreen {
          position: relative;
          width: 100%;
          margin: 0 auto;
          aspect-ratio: 21 / 9;
          max-width: 1400px;
          background: #6e9148;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4),
                      inset 0 0 60px rgba(0, 0, 0, 0.25);
        }
        @media (max-width: 1023px) {
          .biome-view-fullscreen {
            aspect-ratio: 16 / 10;
            max-width: 900px;
          }
        }

        /* Mobile (< 768px) : fullscreen overlay */
        @media (max-width: 767px) {
          .biome-view-fullscreen {
            position: fixed !important;
            inset: 0 !important;
            z-index: 30 !important;
            border-radius: 0 !important;
            aspect-ratio: auto !important;
            height: 100% !important;
            width: 100% !important;
            max-width: none !important;
            box-shadow: none !important;
          }
          .biome-view-fullscreen .village-ground {
            background-size: 100% 100% !important;
          }
        }

        /* CSS sprites (cohérent avec VillageView) */
        .biome-view-fullscreen .village-ground {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          pointer-events: none;
        }
        .biome-view-fullscreen .village-view-stage {
          position: absolute;
          inset: 0;
        }
        .biome-view-fullscreen .village-sprite {
          position: absolute;
          transform: translate(-50%, -50%);
          transition: transform 0.15s ease-out, filter 0.15s ease-out;
          pointer-events: auto;
          cursor: pointer;
        }
        .biome-view-fullscreen .village-sprite:hover {
          transform: translate(-50%, -52%) scale(1.05);
          filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.45))
                  drop-shadow(0 0 14px rgba(247, 215, 116, 0.7));
          z-index: 9999 !important;
        }
        .biome-view-fullscreen .village-sprite img {
          display: block;
          width: 100%;
          height: auto;
          filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.35));
        }
        .biome-view-fullscreen .village-sprite img.flipped {
          transform: scaleX(-1);
        }
        .biome-view-fullscreen .village-sprite-label {
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
        .biome-view-fullscreen .village-sprite:hover .village-sprite-label {
          opacity: 1;
        }
        .biome-view-fullscreen .village-view-header {
          position: absolute;
          top: 8px;
          left: 12px;
          right: 12px;
          z-index: 25;
          display: flex;
          justify-content: center;
          align-items: center;
          pointer-events: none;
        }
        .biome-view-fullscreen .village-view-title {
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
        .biome-view-fullscreen .village-view-title-icon {
          font-size: 18px;
        }
        .biome-view-fullscreen .village-view-tier {
          padding: 1px 8px;
          background: rgba(212, 175, 55, 0.25);
          color: #f7d774;
          border: 1px solid rgba(212, 175, 55, 0.4);
          border-radius: 4px;
          font-size: 11px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        @media (max-width: 640px) {
          .biome-view-fullscreen .village-view-title {
            font-size: 12px;
            padding: 4px 8px;
          }
          .biome-view-fullscreen .village-sprite-label {
            font-size: 10px;
          }
        }
      `}</style>

      {/* Drawer pour les sprites cliquables */}
      {/* Drawer pour les sprites cliquables */}
      <Drawer open={!!openDrawer} onOpenChange={(open) => !open && setOpenDrawer(null)}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>
              {openDrawer && DRAWER_TARGETS[openDrawer]?.title}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6 flex-1">
            {renderDrawerContent()}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Modal de confirmation pour retour ville (voyage 2 min) */}
      <AlertDialog open={confirmReturn} onOpenChange={setConfirmReturn}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🐴 Retour à la ville</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous retourner à <strong>{city?.name || "votre ville"}</strong> ?
              <br />
              Le voyage dure <strong>2 minutes</strong> et consomme 1 point de faim ou d'énergie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={returning}>Rester ici</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReturnToCityConfirmed}
              disabled={returning}
            >
              {returning ? "En route..." : "Oui, voyager"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
