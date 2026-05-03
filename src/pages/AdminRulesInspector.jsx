import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ITEMS, CRAFTING_RECIPES } from '@/lib/craftingData';
import { getProfessionsList } from '@/lib/professions';
const CRAFTING_RECIPES_REFACTORED = CRAFTING_RECIPES;

export default function AdminRulesInspector() {
  const [selectedProfession, setSelectedProfession] = useState('Bûcheron');

  const professions = getProfessionsList();

  const getTierColor = (tier) => {
    const colors = { 1: 'bg-slate-100', 2: 'bg-blue-100', 3: 'bg-purple-100', 4: 'bg-orange-100', 5: 'bg-red-100' };
    return colors[tier] || 'bg-gray-100';
  };

  const getTierBadge = (tier) => {
    const variants = { 1: 'default', 2: 'outline', 3: 'outline', 4: 'outline', 5: 'destructive' };
    return <Badge variant={variants[tier]}>T{tier}</Badge>;
  };

  const getRecipesByProfession = (prof) => CRAFTING_RECIPES_REFACTORED.filter(r => r.profession === prof);

  const getItemsByTier = (tier) => Object.entries(ITEMS)
    .filter(([, item]) => item.tier === tier)
    .map(([key, item]) => ({ key, ...item }));

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-slate-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🔍 Vérificateur de Règles du Jeu</h1>
        <p className="text-slate-600">Affiche tous les items, métiers et recettes pour vérifier les incohérences.</p>
      </div>

      <Tabs defaultValue="professions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="professions">Métiers</TabsTrigger>
          <TabsTrigger value="items">Items par Tier</TabsTrigger>
          <TabsTrigger value="consistency">Cohérence</TabsTrigger>
        </TabsList>

        {/* TAB: PROFESSIONS */}
        <TabsContent value="professions" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            {professions.map(prof => (
              <button
                key={prof}
                onClick={() => setSelectedProfession(prof)}
                className={`p-3 rounded-lg font-medium transition ${
                  selectedProfession === prof
                    ? 'bg-primary text-white'
                    : 'bg-white border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {prof}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(tier => {
              const recipes = getRecipesByProfession(selectedProfession).filter(r => r.tier === tier);
              return (
                <Card key={tier} className={getTierColor(tier)}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {getTierBadge(tier)} - {selectedProfession}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recipes.length === 0 ? (
                      <p className="text-slate-500 italic">Aucune recette T{tier}</p>
                    ) : (
                      <div className="space-y-3">
                        {recipes.map(recipe => (
                          <div key={recipe.id} className="bg-white p-3 rounded-lg border border-slate-200">
                            <p className="font-semibold">{recipe.icon} {recipe.name}</p>
                            <p className="text-sm text-slate-600 mb-2">{recipe.description}</p>
                            <div className="text-xs text-slate-500">
                              <p>Cooldown: {recipe.cooldown}s | Coût: {recipe.costGold}💰</p>
                              {recipe.requiresBuilding && <p className="text-orange-600">Bâtiment requis: {recipe.requiresBuilding}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* TAB: ITEMS PAR TIER */}
        <TabsContent value="items" className="space-y-4">
          {[1, 2, 3, 4, 5].map(tier => {
            const items = getItemsByTier(tier);
            return (
              <Card key={tier} className={getTierColor(tier)}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getTierBadge(tier)} - {items.length} items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <p className="text-slate-500 italic">Aucun item T{tier}</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {items.map(item => (
                        <div key={item.key} className="bg-white p-3 rounded-lg border border-slate-200">
                          <p className="font-semibold">{item.icon} {item.name}</p>
                          <p className="text-sm text-slate-600">{item.use}</p>
                          <p className="text-xs text-slate-500 mt-1">Clé: {item.key}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* TAB: COHÉRENCE */}
        <TabsContent value="consistency" className="space-y-4">
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle>⚠️ Vérifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Vérifier que chaque item T2-T5 a une recette */}
              {[2, 3, 4, 5].map(tier => {
                const items = getItemsByTier(tier);
                const recipeOutputs = new Set(
                  CRAFTING_RECIPES_REFACTORED
                    .filter(r => r.tier === tier)
                    .map(r => r.output?.key)
                );
                const orphanItems = items.filter(item => !recipeOutputs.has(item.key));
                
                return orphanItems.length > 0 && (
                  <div key={`orphan-${tier}`} className="bg-white p-3 rounded-lg border border-orange-200">
                    <p className="font-semibold text-orange-700">❌ Items T{tier} sans recette:</p>
                    <ul className="list-disc list-inside text-sm text-slate-700 mt-1">
                      {orphanItems.map(item => (
                        <li key={item.key}>{item.icon} {item.name} ({item.key})</li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              {/* Vérifier incohérences tier item vs recette */}
              {CRAFTING_RECIPES_REFACTORED.map(recipe => {
                const itemDef = ITEMS[recipe.output?.key];
                if (itemDef && itemDef.tier !== recipe.tier) {
                  return (
                    <div key={`mismatch-${recipe.id}`} className="bg-white p-3 rounded-lg border border-red-200">
                      <p className="font-semibold text-red-700">❌ Incohérence: {recipe.output.key}</p>
                      <p className="text-sm text-slate-700">Recette T{recipe.tier} mais item défini T{itemDef.tier}</p>
                    </div>
                  );
                }
                return null;
              })}

              {/* Vérifier tous les métiers ont T1-T5 */}
              {professions.map(prof => {
                const tiers = new Set(
                  CRAFTING_RECIPES_REFACTORED
                    .filter(r => r.profession === prof)
                    .map(r => r.tier)
                );
                const missing = [2, 3, 4, 5].filter(t => !tiers.has(t));
                
                return missing.length > 0 && (
                  <div key={`missing-${prof}`} className="bg-white p-3 rounded-lg border border-blue-200">
                    <p className="font-semibold text-blue-700">⚠️ {prof}</p>
                    <p className="text-sm text-slate-700">Tiers manquants: {missing.map(t => `T${t}`).join(', ')}</p>
                  </div>
                );
              })}

              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <p className="font-semibold text-green-700">✅ Total: {Object.keys(ITEMS).length} items, {CRAFTING_RECIPES_REFACTORED.length} recettes</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}