/**
 * CodexPage.jsx : Le Codex / Livre du royaume.
 *
 * Deux onglets :
 *  - Items : tous les biens du jeu avec recettes et effets
 *  - Bestiaire : tous les monstres rencontrés en combat épique, avec
 *    leur pattern spécial (comportement) et les vagues où ils apparaissent
 *
 * Ne reflète QUE les vraies données du jeu : ITEMS, CRAFTING_RECIPES_REFACTORED,
 * MONSTERS_DATA, WAVE_MONSTER_POOLS, WAVE_STATS. Si on ajoute un monstre dans
 * combatPvE.js, il apparaît automatiquement ici.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ITEMS } from "@/lib/craftingData";
import { CRAFTING_RECIPES_REFACTORED } from "@/lib/recipePatterns";
import { ITEM_CATEGORIES } from "@/lib/gameData";
import { BIOMES, getBiomeName } from "@/lib/biomes";
import {
  MONSTERS_DATA,
  WAVE_MONSTER_POOLS,
  WAVE_STATS,
  describePattern,
} from "@/lib/combatPvE";

// Construit un index recipe.outputKey -> recette pour récupérer rapidement
// la recette qui produit un item donné.
const RECIPES_BY_OUTPUT = (() => {
  const m = {};
  for (const r of CRAFTING_RECIPES_REFACTORED) {
    const k = r.output?.key || r.outputKey;
    if (k) m[k] = r;
  }
  return m;
})();

// Index inverse : pour chaque item, liste des recettes qui le CONSOMMENT
// (en input) ou le REQUIÈRENT (requiresItems, non consommé). Permet d'afficher
// dans le Codex "cet objet est nécessaire pour fabriquer : ...".
const RECIPES_USING_ITEM = (() => {
  const m = {};
  for (const r of CRAFTING_RECIPES_REFACTORED) {
    const outputKey = r.output?.key || r.outputKey;
    if (!outputKey) continue;

    // Inputs consommés
    for (const inp of (r.inputs || [])) {
      if (!inp?.key) continue;
      if (!m[inp.key]) m[inp.key] = [];
      m[inp.key].push({ recipe: r, outputKey, role: "consumed", quantity: inp.quantity });
    }

    // Items requis mais non consommés (requiresItems, ex: outils en T4)
    for (const req of (r.requiresItems || [])) {
      if (!req?.key) continue;
      if (!m[req.key]) m[req.key] = [];
      m[req.key].push({ recipe: r, outputKey, role: "required", quantity: req.quantity });
    }
  }
  return m;
})();

// Pour chaque monstre, calcule la liste des vagues où il peut apparaître,
// dérivée à 100% de WAVE_MONSTER_POOLS. Si on modifie le pool, ça suit.
const MONSTER_WAVES_BY_INDEX = (() => {
  const result = MONSTERS_DATA.map(() => []);
  WAVE_MONSTER_POOLS.forEach((pool, waveIdx) => {
    pool.forEach((monsterIdx) => {
      result[monsterIdx].push(waveIdx + 1); // vagues numérotées 1-5
    });
  });
  return result;
})();

const TIERS = [1, 2, 3, 4, 5];

export default function CodexPage() {
  const [activeTab, setActiveTab] = useState("items"); // "items" | "bestiary"

  return (
    <div className="container mx-auto px-3 py-4 max-w-5xl">
      <div className="mb-4">
        <h1 className="font-heading text-2xl md:text-3xl mb-1">📖 Le Codex du royaume</h1>
        <p className="font-body text-sm text-muted-foreground">
          Tous les biens, leurs effets et leurs recettes — et le bestiaire des contrées sauvages.
        </p>
      </div>

      {/* Onglets */}
      <div className="mb-4 flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("items")}
          className={`font-heading text-sm px-4 py-2 border-b-2 transition-colors ${
            activeTab === "items"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          📦 Biens & Recettes
        </button>
        <button
          onClick={() => setActiveTab("bestiary")}
          className={`font-heading text-sm px-4 py-2 border-b-2 transition-colors ${
            activeTab === "bestiary"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          🐉 Bestiaire
        </button>
      </div>

      {activeTab === "items" ? <ItemsTab /> : <BestiaryTab />}
    </div>
  );
}

// ============================================================================
// ONGLET ITEMS
// ============================================================================

function ItemsTab() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [professionFilter, setProfessionFilter] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);

  const allProfessions = useMemo(() => {
    const set = new Set();
    for (const r of CRAFTING_RECIPES_REFACTORED) {
      if (r.profession) set.add(r.profession);
    }
    for (const def of Object.values(ITEMS)) {
      if (def?.biome_profession) set.add(def.biome_profession);
    }
    return [...set].sort();
  }, []);

  const allCategories = useMemo(() => {
    const set = new Set();
    for (const def of Object.values(ITEMS)) {
      if (def?.category) set.add(def.category);
    }
    return [...set].filter(c => ITEM_CATEGORIES[c]).sort();
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.entries(ITEMS)
      .filter(([key, def]) => {
        if (!def?.name) return false;
        if (q && !def.name.toLowerCase().includes(q) && !key.toLowerCase().includes(q)) return false;
        if (tierFilter && (def.tier || 1) !== tierFilter) return false;
        if (categoryFilter && def.category !== categoryFilter) return false;
        if (professionFilter) {
          const recipe = RECIPES_BY_OUTPUT[key];
          const matchProf = recipe?.profession === professionFilter ||
                            def.biome_profession === professionFilter;
          if (!matchProf) return false;
        }
        return true;
      })
      .sort(([, a], [, b]) => {
        const tierDiff = (a.tier || 1) - (b.tier || 1);
        if (tierDiff !== 0) return tierDiff;
        return (a.name || "").localeCompare(b.name || "");
      });
  }, [search, tierFilter, categoryFilter, professionFilter]);

  const selectedItem = selectedKey ? ITEMS[selectedKey] : null;
  const selectedRecipe = selectedKey ? RECIPES_BY_OUTPUT[selectedKey] : null;

  return (
    <>
      <Card className="mb-4">
        <CardContent className="pt-4 space-y-3">
          <Input
            placeholder="Rechercher par nom (ex : Pierre, Potion...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="font-body"
          />

          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-body text-muted-foreground mr-1">Tier :</span>
            <Button size="sm" variant={tierFilter === null ? "default" : "outline"}
                    onClick={() => setTierFilter(null)} className="h-7 px-2 font-body text-xs">Tous</Button>
            {TIERS.map(t => (
              <Button key={t} size="sm" variant={tierFilter === t ? "default" : "outline"}
                      onClick={() => setTierFilter(tierFilter === t ? null : t)}
                      className="h-7 px-2 font-body text-xs">T{t}</Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-body text-muted-foreground mr-1">Catégorie :</span>
            <Button size="sm" variant={categoryFilter === null ? "default" : "outline"}
                    onClick={() => setCategoryFilter(null)} className="h-7 px-2 font-body text-xs">Toutes</Button>
            {allCategories.map(cat => (
              <Button key={cat} size="sm" variant={categoryFilter === cat ? "default" : "outline"}
                      onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                      className="h-7 px-2 font-body text-xs">
                {ITEM_CATEGORIES[cat]?.icon} {cat.replace(/_/g, " ")}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-body text-muted-foreground mr-1">Métier :</span>
            <Button size="sm" variant={professionFilter === null ? "default" : "outline"}
                    onClick={() => setProfessionFilter(null)} className="h-7 px-2 font-body text-xs">Tous</Button>
            {allProfessions.map(prof => (
              <Button key={prof} size="sm" variant={professionFilter === prof ? "default" : "outline"}
                      onClick={() => setProfessionFilter(professionFilter === prof ? null : prof)}
                      className="h-7 px-2 font-body text-xs">{prof}</Button>
            ))}
          </div>

          <div className="text-xs text-muted-foreground font-body pt-1">
            {filteredItems.length} entrée{filteredItems.length > 1 ? "s" : ""}.
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Liste */}
        <div className="space-y-2 max-h-[70vh] md:max-h-none overflow-y-auto pr-1">
          {filteredItems.length === 0 && (
            <Card><CardContent className="py-6 text-center text-sm font-body text-muted-foreground">
              Aucun bien trouvé avec ces filtres.
            </CardContent></Card>
          )}
          {filteredItems.map(([key, def]) => {
            const isSelected = key === selectedKey;
            const cat = ITEM_CATEGORIES[def.category];
            const recipe = RECIPES_BY_OUTPUT[key];
            return (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                className={`w-full text-left p-3 rounded-lg border transition-colors font-body ${
                  isSelected
                    ? "bg-primary/10 border-primary"
                    : "bg-card hover:bg-muted/50 border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl">{def.icon}</span>
                    <div className="min-w-0">
                      <div className="font-heading text-sm truncate">{def.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {cat?.icon} {def.category?.replace(/_/g, " ") || "?"}
                        {def.biome_profession && ` · ${def.biome_profession}`}
                        {recipe && ` · ${recipe.profession || "Tous"}`}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-body text-xs flex-shrink-0">
                    T{def.tier || 1}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>

        {/* Détail */}
        <div>
          {!selectedItem ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-5xl mb-3">📖</div>
                <p className="font-body text-sm text-muted-foreground">
                  Choisissez un bien dans la liste pour consulter sa fiche.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="md:sticky md:top-4">
              <CardHeader>
                <CardTitle className="font-heading text-xl flex items-center gap-2">
                  <span className="text-3xl">{selectedItem.icon}</span>
                  <div className="flex-1">
                    <div>{selectedItem.name}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <Badge variant="secondary" className="font-body text-xs">T{selectedItem.tier || 1}</Badge>
                      {selectedItem.category && (
                        <Badge variant="outline" className="font-body text-xs">
                          {ITEM_CATEGORIES[selectedItem.category]?.icon} {selectedItem.category.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 font-body text-sm">
                {selectedItem.use && (
                  <div>
                    <div className="font-semibold text-xs uppercase text-muted-foreground mb-1">Effet</div>
                    <p>{selectedItem.use}</p>
                  </div>
                )}

                {selectedItem.biome_key && selectedItem.biome_profession && (
                  <div>
                    <div className="font-semibold text-xs uppercase text-muted-foreground mb-1">Récolte</div>
                    <p>
                      Récolté en <span className="font-semibold">{getBiomeName(selectedItem.biome_key)}</span>
                      {" "}par le <span className="font-semibold">{selectedItem.biome_profession}</span>.
                    </p>
                  </div>
                )}

                {selectedRecipe ? (
                  <div>
                    <div className="font-semibold text-xs uppercase text-muted-foreground mb-1">Fabrication</div>
                    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                      <div className="text-xs">
                        <span className="font-semibold">Métier :</span> {selectedRecipe.profession || "Tous"}
                        {selectedRecipe.cooldown && (
                          <span className="ml-2">· <span className="font-semibold">Cooldown :</span> {selectedRecipe.cooldown}min</span>
                        )}
                        {selectedRecipe.costGold > 0 && (
                          <span className="ml-2">· <span className="font-semibold">Coût :</span> {selectedRecipe.costGold}💰</span>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold mb-1">Ingrédients :</div>
                        <ul className="space-y-1">
                          {(selectedRecipe.inputs || []).map((inp, i) => {
                            const inpDef = ITEMS[inp.key];
                            return (
                              <li key={i} className="flex items-center gap-2 text-sm">
                                <span>{inpDef?.icon || "📦"}</span>
                                <button
                                  onClick={() => setSelectedKey(inp.key)}
                                  className="underline decoration-dotted hover:text-primary"
                                >
                                  {inpDef?.name || inp.key}
                                </button>
                                <span className="text-muted-foreground">×{inp.quantity}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <div className="text-xs pt-1 border-t">
                        <span className="font-semibold">Produit :</span> {selectedRecipe.output?.quantity || 1}× {selectedItem.name}
                      </div>
                      {selectedRecipe.requiresItems && selectedRecipe.requiresItems.length > 0 && (
                        <div className="text-xs">
                          <span className="font-semibold">Requiert :</span>{" "}
                          {selectedRecipe.requiresItems.map(r => {
                            const reqDef = ITEMS[r.key];
                            return `${reqDef?.icon || ""} ${reqDef?.name || r.key} ×${r.quantity}`;
                          }).join(", ")}
                          <span className="text-muted-foreground"> (non consommé)</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (selectedItem.tier || 1) >= 2 && (
                  <div>
                    <div className="font-semibold text-xs uppercase text-muted-foreground mb-1">Fabrication</div>
                    <p className="text-muted-foreground italic">Recette non disponible.</p>
                  </div>
                )}

                {/* Utilisé pour fabriquer : liste des recettes qui consomment cet item */}
                {(RECIPES_USING_ITEM[selectedKey] || []).length > 0 && (
                  <div>
                    <div className="font-semibold text-xs uppercase text-muted-foreground mb-1">
                      Utilisé pour fabriquer
                    </div>
                    <ul className="space-y-1">
                      {RECIPES_USING_ITEM[selectedKey].map((entry, i) => {
                        const outDef = ITEMS[entry.outputKey];
                        if (!outDef) return null;
                        return (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <span>{outDef.icon || "📦"}</span>
                            <button
                              onClick={() => setSelectedKey(entry.outputKey)}
                              className="underline decoration-dotted hover:text-primary"
                            >
                              {outDef.name}
                            </button>
                            <span className="text-muted-foreground text-xs">
                              ×{entry.quantity}
                              {entry.role === "required" && " (non consommé)"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// ONGLET BESTIAIRE
// ============================================================================

function BestiaryTab() {
  const [search, setSearch] = useState("");
  const [waveFilter, setWaveFilter] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);

  const filteredMonsters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MONSTERS_DATA
      .map((m, idx) => ({
        ...m,
        idx,
        waves: MONSTER_WAVES_BY_INDEX[idx],
        patternInfo: describePattern(m.pattern),
      }))
      .filter(m => {
        if (q && !m.name.toLowerCase().includes(q)) return false;
        if (waveFilter && !m.waves.includes(waveFilter)) return false;
        return true;
      })
      .sort((a, b) => {
        const aFirst = a.waves[0] || 99;
        const bFirst = b.waves[0] || 99;
        if (aFirst !== bFirst) return aFirst - bFirst;
        return a.name.localeCompare(b.name);
      });
  }, [search, waveFilter]);

  const selected = selectedIdx != null
    ? {
        ...MONSTERS_DATA[selectedIdx],
        idx: selectedIdx,
        waves: MONSTER_WAVES_BY_INDEX[selectedIdx],
        patternInfo: describePattern(MONSTERS_DATA[selectedIdx].pattern),
      }
    : null;

  return (
    <>
      <Card className="mb-4">
        <CardContent className="pt-4 space-y-3">
          <Input
            placeholder="Rechercher un monstre (ex : Vampire, Loup...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="font-body"
          />

          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-body text-muted-foreground mr-1">Vague :</span>
            <Button size="sm" variant={waveFilter === null ? "default" : "outline"}
                    onClick={() => setWaveFilter(null)} className="h-7 px-2 font-body text-xs">Toutes</Button>
            {[1, 2, 3, 4, 5].map(w => (
              <Button key={w} size="sm" variant={waveFilter === w ? "default" : "outline"}
                      onClick={() => setWaveFilter(waveFilter === w ? null : w)}
                      className="h-7 px-2 font-body text-xs">V{w}</Button>
            ))}
          </div>

          <div className="text-xs text-muted-foreground font-body pt-1">
            {filteredMonsters.length} créature{filteredMonsters.length > 1 ? "s" : ""}.
            {" "}Plus la vague est haute, plus le mob est tanky (V1: {WAVE_STATS[0].hp} PV → V5: {WAVE_STATS[4].hp} PV).
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Liste */}
        <div className="space-y-2 max-h-[70vh] md:max-h-none overflow-y-auto pr-1">
          {filteredMonsters.length === 0 && (
            <Card><CardContent className="py-6 text-center text-sm font-body text-muted-foreground">
              Aucun monstre trouvé avec ces filtres.
            </CardContent></Card>
          )}
          {filteredMonsters.map(m => {
            const isSelected = m.idx === selectedIdx;
            return (
              <button
                key={m.idx}
                onClick={() => setSelectedIdx(m.idx)}
                className={`w-full text-left p-3 rounded-lg border transition-colors font-body ${
                  isSelected
                    ? "bg-primary/10 border-primary"
                    : "bg-card hover:bg-muted/50 border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl">{m.icon}</span>
                    <div className="min-w-0">
                      <div className="font-heading text-sm truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {m.patternInfo
                          ? `${m.patternInfo.icon} ${m.patternInfo.label}`
                          : "Comportement standard"}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 flex-shrink-0">
                    {m.waves.map(w => (
                      <Badge key={w} variant="secondary" className="font-body text-xs">V{w}</Badge>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Détail */}
        <div>
          {!selected ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-5xl mb-3">🐉</div>
                <p className="font-body text-sm text-muted-foreground">
                  Choisissez une créature dans la liste pour consulter sa fiche.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="md:sticky md:top-4">
              <CardHeader>
                <CardTitle className="font-heading text-xl flex items-center gap-2">
                  <span className="text-4xl">{selected.icon}</span>
                  <div className="flex-1">
                    <div>{selected.name}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selected.waves.map(w => (
                        <Badge key={w} variant="secondary" className="font-body text-xs">
                          Vague {w} ({WAVE_STATS[w - 1]?.hp} PV)
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 font-body text-sm">
                {/* Comportement */}
                <div>
                  <div className="font-semibold text-xs uppercase text-muted-foreground mb-1">Comportement</div>
                  {selected.patternInfo ? (
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="font-heading text-sm mb-1">
                        {selected.patternInfo.icon} {selected.patternInfo.label}
                      </div>
                      <p className="text-muted-foreground">{selected.patternInfo.desc}</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">
                      Attaque standard, sans capacité particulière. Vise une zone aléatoire et frappe.
                    </p>
                  )}
                </div>

                {/* Apparitions */}
                <div>
                  <div className="font-semibold text-xs uppercase text-muted-foreground mb-1">Où le rencontrer</div>
                  <p>
                    Apparaît dans les vagues{" "}
                    <span className="font-semibold">
                      {selected.waves.length === 1
                        ? `V${selected.waves[0]}`
                        : `V${selected.waves[0]} à V${selected.waves[selected.waves.length - 1]}`}
                    </span>{" "}
                    de l'épopée quotidienne (n'importe quel biome).
                  </p>
                </div>

                {/* Conseils stratégiques */}
                {selected.patternInfo && getStrategicTip(selected.pattern) && (
                  <div>
                    <div className="font-semibold text-xs uppercase text-muted-foreground mb-1">Conseil</div>
                    <p className="text-muted-foreground">
                      {getStrategicTip(selected.pattern)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Conseils stratégiques par pattern. Texte court, orienté gameplay.
 * Pas de mention de chiffres exacts (ces nombres peuvent évoluer dans
 * combatPvE.js, on évite la dérive avec la doc).
 */
function getStrategicTip(pattern) {
  switch (pattern) {
    case "weak":    return "Cible facile : tuez-le en premier pour cumuler les bonus de fin de vague.";
    case "blurry":  return "Indice imprécis sur ses attaques : pariez sur une parade large (mode double) en priorité.";
    case "thief":   return "Tuez-le rapidement avant qu'il ne vous touche, sinon vous perdez de l'or.";
    case "elusive": return "Vos contres ratent souvent. Visez plutôt des cibles plus prévisibles d'abord, puis finissez-le.";
    case "drain":   return "Plus il vous touche, plus il guérit. Coupez le cycle en l'achevant tôt.";
    case "feint":   return "Méfiance sur l'indice : la zone réelle peut être l'opposée de celle annoncée.";
    case "revive":  return "Il revient une fois à 1 PV. Frappez-le DEUX fois pour vous en débarrasser définitivement.";
    case "heavy":   return "Plus tanky que la moyenne. Concentrez le feu pour passer le mur de PV.";
    case "healer":  return "Il soigne tous les autres. Priorité absolue : éliminez-le AVANT les autres mobs.";
    case "regen":   return "Se régénère doucement. Plus vous traînez, plus il se rétablit. Allez vite.";
    default: return null;
  }
}
