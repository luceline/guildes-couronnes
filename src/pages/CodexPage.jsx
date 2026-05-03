/**
 * CodexPage.jsx : Le Codex / Livre de recettes du royaume.
 *
 * Affiche tous les items du jeu avec leurs métadonnées, recettes et effets.
 * Permet aux joueurs de planifier leur production sans avoir à naviguer dans
 * Production pour découvrir ce qu'ils peuvent crafter.
 *
 * Fonctionnalités :
 *   - Recherche par nom
 *   - Filtres : tier (T1-T5), catégorie, profession
 *   - Affichage par item : nom, icône, tier, description, effets
 *   - Pour les items craftables : recette complète (ingrédients cliquables)
 *   - Indique le biome de récolte pour les T1
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

const TIERS = [1, 2, 3, 4, 5];

export default function CodexPage() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState(null);     // null = tous
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [professionFilter, setProfessionFilter] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);   // item key affiché en détail

  // Toutes les professions disponibles (extraites des recettes + biome_profession des items T1)
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

  // Toutes les catégories vraiment utilisées par des items
  const allCategories = useMemo(() => {
    const set = new Set();
    for (const def of Object.values(ITEMS)) {
      if (def?.category) set.add(def.category);
    }
    return [...set].filter(c => ITEM_CATEGORIES[c]).sort();
  }, []);

  // Liste filtrée d'items affichables
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
    <div className="container mx-auto px-3 py-4 max-w-5xl">
      <div className="mb-4">
        <h1 className="font-heading text-2xl md:text-3xl mb-1">📖 Le Codex du royaume</h1>
        <p className="font-body text-sm text-muted-foreground">
          Tous les biens, leurs effets et leurs recettes. {filteredItems.length} entrée{filteredItems.length > 1 ? "s" : ""}.
        </p>
      </div>

      {/* Barre de recherche + filtres */}
      <Card className="mb-4">
        <CardContent className="pt-4 space-y-3">
          <Input
            placeholder="Rechercher par nom (ex : Pierre, Potion...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="font-body"
          />

          {/* Tiers */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-body text-muted-foreground mr-1">Tier :</span>
            <Button
              size="sm"
              variant={tierFilter === null ? "default" : "outline"}
              onClick={() => setTierFilter(null)}
              className="h-7 px-2 font-body text-xs"
            >Tous</Button>
            {TIERS.map(t => (
              <Button
                key={t}
                size="sm"
                variant={tierFilter === t ? "default" : "outline"}
                onClick={() => setTierFilter(tierFilter === t ? null : t)}
                className="h-7 px-2 font-body text-xs"
              >T{t}</Button>
            ))}
          </div>

          {/* Catégories */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-body text-muted-foreground mr-1">Catégorie :</span>
            <Button
              size="sm"
              variant={categoryFilter === null ? "default" : "outline"}
              onClick={() => setCategoryFilter(null)}
              className="h-7 px-2 font-body text-xs"
            >Toutes</Button>
            {allCategories.map(cat => (
              <Button
                key={cat}
                size="sm"
                variant={categoryFilter === cat ? "default" : "outline"}
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                className="h-7 px-2 font-body text-xs"
              >
                {ITEM_CATEGORIES[cat]?.icon} {cat.replace(/_/g, " ")}
              </Button>
            ))}
          </div>

          {/* Professions */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-body text-muted-foreground mr-1">Métier :</span>
            <Button
              size="sm"
              variant={professionFilter === null ? "default" : "outline"}
              onClick={() => setProfessionFilter(null)}
              className="h-7 px-2 font-body text-xs"
            >Tous</Button>
            {allProfessions.map(prof => (
              <Button
                key={prof}
                size="sm"
                variant={professionFilter === prof ? "default" : "outline"}
                onClick={() => setProfessionFilter(professionFilter === prof ? null : prof)}
                className="h-7 px-2 font-body text-xs"
              >{prof}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Colonne gauche : liste */}
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

        {/* Colonne droite : détail */}
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
                {/* Effet / usage */}
                {selectedItem.use && (
                  <div>
                    <div className="font-semibold text-xs uppercase text-muted-foreground mb-1">Effet</div>
                    <p>{selectedItem.use}</p>
                  </div>
                )}

                {/* Récolte (T1 ressources) */}
                {selectedItem.biome_key && selectedItem.biome_profession && (
                  <div>
                    <div className="font-semibold text-xs uppercase text-muted-foreground mb-1">Récolte</div>
                    <p>
                      Récolté en <span className="font-semibold">{getBiomeName(selectedItem.biome_key)}</span>
                      {" "}par le <span className="font-semibold">{selectedItem.biome_profession}</span>.
                    </p>
                  </div>
                )}

                {/* Recette */}
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
