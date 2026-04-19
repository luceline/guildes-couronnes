import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

// Cache global pour éviter de recharger à chaque mount
let _cache = null;
let _loadingPromise = null;

export function useGameData() {
  const [gameData, setGameData] = useState(_cache);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) { setGameData(_cache); setLoading(false); return; }
    if (_loadingPromise) {
      _loadingPromise.then(data => { setGameData(data); setLoading(false); });
      return;
    }

    _loadingPromise = (async () => {
      try {
        const [itemDefs, craftingRecipes, profDefs] = await Promise.all([
          base44.entities.ItemDef.list("-created_date", 300),
          base44.entities.CraftingRecipe.list("-created_date", 200),
          base44.entities.ProfessionDef.list(),
        ]);

        // ItemDef → ITEMS {[key]: {name, icon, category, tier, use, fatigue_restore, hunger_restore}}
        const ITEMS = {};
        for (const item of itemDefs) {
          if (item.is_active === false) continue;
          ITEMS[item.key] = {
            name: item.name,
            icon: item.icon,
            category: item.category,
            tier: item.tier || 1,
            use: item.use || "",
            fatigue_restore: item.fatigue_restore || 0,
            hunger_restore: item.hunger_restore || 0,
            market_price_suggested: item.market_price_suggested || 0,
          };
        }

        // CraftingRecipe → CRAFTING_RECIPES [{id, name, icon, profession, output, inputs, requiresBuilding, costGold}]
        const CRAFTING_RECIPES = craftingRecipes
          .filter(r => r.is_active !== false)
          .map(r => ({
            id: r.recipe_id || r.id,
            name: r.name,
            icon: r.icon || "⚒️",
            profession: r.profession || null,
            output: { key: r.output_key, quantity: r.output_quantity || 1 },
            inputs: (r.inputs || []),
            requiresBuilding: r.requires_building || null,
            costGold: r.cost_gold || 0,
          }));

        // ProfessionDef → PROFESSION_PRODUCTION {[profKey]: [{id, name, icon, outputKey, quantity, cooldown, costGold, tier}]}
        const PROFESSION_PRODUCTION = {};
        for (const prof of profDefs) {
          if (prof.is_active === false) continue;
          PROFESSION_PRODUCTION[prof.key] = (prof.production_actions || []).map(a => ({
            id: a.id || `${prof.key}_${a.output_key}`,
            name: a.name || "",
            icon: a.icon || "⚡",
            outputKey: a.output_key,
            quantity: a.quantity || 1,
            cooldown: a.cooldown || 60,
            costGold: a.cost_gold || 0,
            tier: 1,
          }));
        }

        const data = { ITEMS, CRAFTING_RECIPES, PROFESSION_PRODUCTION };
        _cache = data;
        return data;
      } catch (e) {
        console.warn("useGameData: DB load failed, will fall back to static data", e);
        _loadingPromise = null;
        return null;
      }
    })();

    _loadingPromise.then(data => { setGameData(data); setLoading(false); });
  }, []);

  return { gameData, loading };
}

// Util pour invalider le cache (ex: après une modif admin)
export function invalidateGameDataCache() {
  _cache = null;
  _loadingPromise = null;
}