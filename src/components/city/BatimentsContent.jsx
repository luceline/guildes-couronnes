/**
 * BatimentsContent.jsx
 * Phase 3 (10/05/2026) : extraction de l'onglet "Bâtiments" de CityView.
 * Affiche la liste des bâtiments construits + le catalogue des constructibles
 * regroupés par catégorie. Le maire peut construire / améliorer.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import HelpTooltip from "../HelpTooltip";
import {
  BUILDING_TYPES, BUILDING_CATEGORIES, ITEM_CATEGORIES,
  getBuildingCost, getBuildingLevel, getBuildingCount, canBuildMore,
  isCategoryUnlocked, getCityTier, CITY_LEVELS,
  getTodayDateStr,
} from "../../lib/gameData";
import { ITEMS as GAME_ITEMS } from "../../lib/craftingData";

// Labels T1 (les T2/T3 sont repris depuis GAME_ITEMS si absents).
// Dupliqué de CityView.jsx (sera unifié en lib/warehouseLabels.js si besoin).
const WAREHOUSE_LABELS = {
  bois_brut:   "Bois brut",
  pierre:      "Pierre",
  minerai_fer: "Minerai de fer",
  ble:         "Blé",
  laine_brute: "Laine brute",
  herbes:      "Herbes",
  quartz_brut: "Quartz brut",
  or:          "Or",
};

export default function BatimentsContent({
  city,
  profile,
  isMayor,
  isHomeCity,
  buildingsByCategory,
  activeCategory,
  setActiveCategory,
  handleBuild,
  dailyMaintenance,
  nbResidents,
  building,
}) {
  // Entrepôt communautaire : ressources disponibles pour construire / améliorer.
  // Repris de CityView qui calculait `const warehouse = city.warehouse || {}`
  // au top-level de la fonction.
  const warehouse = city.warehouse || {};

  return (
    <>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs text-muted-foreground font-body">Les bâtiments améliorent la vie en ville et débloquent des fonctions.</p>
            <HelpTooltip text="Seul le maire peut construire. Chaque bâtiment consomme des ressources de l'entrepôt à la construction ET chaque nuit pour son entretien. Bâtiments de production : entretien en T2 (paliers 1-4) ou T3 (palier 5). Taverne : pain T3. Sans ressources → destruction aléatoire." />
          </div>

          {(city.buildings || []).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-heading text-base">🏛️ Bâtiments existants</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {(city.buildings || []).map((b, idx) => {
                    const bType = BUILDING_TYPES[b.building_type];
                    const lvl = b.level || 1;
                    const isMaxLevel = lvl >= 5;
                    const canUpgrade = isMayor && !bType?.stackable && !isMaxLevel;
                    const upgradeCost = canUpgrade ? getBuildingCost(b.building_type, lvl) : null;
                    const canAfford = upgradeCost
                      ? Object.entries(upgradeCost).every(([res, qty]) => (warehouse[res] || 0) >= qty)
                      : false;
                    return (
                      <div key={idx} className="bg-muted/50 rounded-lg p-2.5 text-center border border-border">
                        <span className="text-xl">{bType?.icon || "🏠"}</span>
                        <div className="font-body text-xs font-semibold mt-1">{b.name}</div>
                        <div className="text-xs text-muted-foreground font-body">
                          Niv. {lvl}{isMaxLevel ? " (MAX)" : ""}
                        </div>
                        {bType?.effect && <div className="text-xs text-primary font-body mt-1">{bType.effect}</div>}
                        {canUpgrade && (
                          <div className="mt-2 space-y-1">
                            <div className="text-[10px] font-body text-muted-foreground">
                              Niv. {lvl + 1} : {Object.entries(upgradeCost).map(([res, qty]) => `${qty} ${WAREHOUSE_LABELS[res] || GAME_ITEMS[res]?.name || res}`).join(" · ")}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="font-heading text-xs h-7 w-full"
                              onClick={() => handleBuild(b.building_type)}
                              disabled={building || !canAfford}
                              title={!canAfford ? "Ressources insuffisantes dans l'entrepôt" : `Améliorer au niveau ${lvl + 1}`}
                            >
                              🔧 Améliorer
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {Object.keys(dailyMaintenance).length > 0 && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-body text-amber-800">
                    🔧 Entretien quotidien : {Object.entries(dailyMaintenance).map(([r, q]) => `${q} ${WAREHOUSE_LABELS[r] || GAME_ITEMS[r]?.name || r}`).join(" · ")}
                    <span className="ml-2 text-amber-600">({nbResidents} résident{nbResidents > 1 ? "s" : ""} : ×{(1 + 0.2 * Math.max(0, nbResidents - 1)).toFixed(1)} multiplicateur)</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(BUILDING_CATEGORIES).map(([catKey, cat]) => {
              // 13/05/2026 — Indicateur visuel si catégorie verrouillée par palier.
              // La catégorie reste cliquable (pour voir ce qu'elle contient), mais
              // les bâtiments seront non-constructibles via canBuildMore.
              const unlocked = isCategoryUnlocked(city, catKey);
              return (
                <button
                  key={catKey}
                  onClick={() => setActiveCategory(catKey)}
                  className={`text-xs px-3 py-1.5 rounded-full font-body border transition-colors ${
                    activeCategory === catKey
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted border-border text-muted-foreground hover:border-primary/50"
                  } ${!unlocked ? "opacity-50" : ""}`}
                >
                  {!unlocked && "🔒 "}{cat.label}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground font-body">{BUILDING_CATEGORIES[activeCategory]?.description}</p>

          {/* 13/05/2026 — Bannière si catégorie verrouillée. On indique seulement
              le palier requis pour ne pas décourager (sans afficher le seuil exact). */}
          {!isCategoryUnlocked(city, activeCategory) && (() => {
            const unlockingTier = CITY_LEVELS.find(l => (l.unlocksCategories || []).includes(activeCategory));
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-xs font-body text-amber-900 mt-2">
                🔒 Catégorie verrouillée. Débloquée au palier <strong>{unlockingTier?.icon} {unlockingTier?.label}</strong>.
              </div>
            );
          })()}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(buildingsByCategory[activeCategory] || []).map(bType => {
              const count = getBuildingCount(city, bType.key);
              const currentLevel = getBuildingLevel(city, bType.key);
              const cost = getBuildingCost(bType.key, currentLevel);
              const canBuild = canBuildMore(city, bType.key);
              const warehouseOk = Object.entries(cost).every(([res, qty]) => (warehouse[res] || 0) >= qty);

              return (
                <Card key={bType.key} className={`${!canBuild ? "opacity-60" : warehouseOk ? "border-green-200" : "border-border"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{bType.icon}</span>
                        <div>
                          <div className="font-heading font-semibold text-sm">{bType.name}</div>
                          {count > 0 && (
                            <Badge variant="secondary" className="text-xs font-body">
                              {count} construit{count > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {bType.unique && <Badge variant="outline" className="text-xs font-body">Unique</Badge>}
                    </div>

                    <p className="text-xs text-muted-foreground font-body mb-3">{bType.effect}</p>

                    <div className="mb-3">
                       <p className="text-xs font-body text-muted-foreground mb-1">
                         {bType.category === "production" ? (
                           <>
                             Coût {currentLevel > 0 ? `(T${currentLevel + 1}/${currentLevel >= 5 ? 5 : currentLevel + 1})` : "(T1/5)"}
                             {currentLevel >= 5 && <span className="text-green-600 font-semibold"> ✅ MAX</span>}
                           </>
                         ) : (
                           `Coût ${currentLevel > 0 ? `(Niv.${currentLevel + 1})` : ""}`
                         )}
                       </p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(cost).map(([res, qty]) => {
                          const has = warehouse[res] || 0;
                          const ok = has >= qty;
                          return (
                            <span key={res} className={`text-xs px-2 py-0.5 rounded-full border font-body ${
                              ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
                            }`}>
                              {ITEM_CATEGORIES[res]?.icon} {WAREHOUSE_LABELS[res] || GAME_ITEMS[res]?.name || res} {has}/{qty}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {Object.keys(bType.maintenance || {}).length > 0 && (
                       <p className="text-xs text-amber-700 font-body mb-3">
                         🔧 Entretien/j : {bType.category === "production" && currentLevel > 0 ? (
                           <span>
                             {Object.entries(bType.maintenance).map(([r, q]) => {
                               const mult = Math.pow(2, currentLevel - 1);
                               const label = WAREHOUSE_LABELS[r] || GAME_ITEMS[r]?.name || r;
                               return `${Math.ceil(q * mult)} ${label}`;
                             }).join(", ")} (T{currentLevel})
                           </span>
                         ) : (
                           Object.entries(bType.maintenance).map(([r, q]) =>
                             `${q} ${WAREHOUSE_LABELS[r] || GAME_ITEMS[r]?.name || r}`
                           ).join(", ")
                         )}
                       </p>
                     )}

                    {/* J'aime pour signaler l'intérêt au maire */}
                    {isHomeCity && !isMayor && canBuild && (() => {
                      const todayStr = getTodayDateStr();
                      const likes = city.building_likes || {};
                      const myLikeKey = `${bType.key}_${profile.id}_${todayStr}`;
                      const alreadyLiked = !!likes[myLikeKey];
                      const likeCount = Object.keys(likes).filter(k => k.startsWith(`${bType.key}_`) && k.endsWith(`_${todayStr}`)).length;
                      return (
                        <button
                          onClick={async () => {
                            if (alreadyLiked) return;
                            const newLikes = { ...likes, [myLikeKey]: true };
                            await base44.entities.City.update(city.id, { building_likes: newLikes });
                            toast.success(`👍 Vote enregistré pour ${bType.name} !`);
                            onRefresh?.();
                          }}
                          className={`w-full text-xs font-body rounded-md py-1 border transition-colors ${alreadyLiked ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-muted border-border hover:border-blue-300 hover:text-blue-600"}`}
                        >
                          👍 {alreadyLiked ? "Voté" : "Je veux ce bâtiment"} {likeCount > 0 ? `· ${likeCount} vote${likeCount > 1 ? "s" : ""} aujourd'hui` : ""}
                        </button>
                      );
                    })()}
                    {isMayor && (
                    <Button
                      size="sm"
                      className="w-full font-heading"
                      onClick={() => handleBuild(bType.key)}
                      disabled={building || !canBuild || !warehouseOk}
                      variant={warehouseOk && canBuild ? "default" : "outline"}
                    >
                      {!canBuild
                        ? "✅ Déjà construit (unique)"
                        : !warehouseOk
                          ? "⚠️ Entrepôt insuffisant"
                          : building ? "Construction..." : `🏗️ Construire`}
                    </Button>
                    )}
                    {!isMayor && canBuild && (
                      <p className="text-xs text-muted-foreground font-body text-center">Seul le maire peut construire</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
    </>
  );
}
