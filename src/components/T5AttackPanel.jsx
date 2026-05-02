import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ITEMS as GAME_ITEMS } from "../lib/craftingData";
import { applyRandomActionCost } from "../lib/gameData";
import HelpTooltip from "./HelpTooltip";

const EFFECT_MAP = {
  huile_inflammable:   { effect: "disable_building",          counterBuilding: "caserne",           effectValue: { duration: 1 },         description: "🏚️ Détruit 1 bâtiment aléatoire" },
  poudre_corrosive:    { effect: "destroy_warehouse_stock",   counterBuilding: "entrepot_fortifie", effectValue: { min: 10, max: 20 },    description: "📦 Détruit 80% d'une ressource aléatoire de l'entrepôt" },
  festin_empoisonne:   { effect: "hunger_regen_fatigue_drain",counterBuilding: "hospice",           effectValue: { value: 5, duration: 2 },description: "☠️ Manger soigne la faim mais coûte 5⚡ par usage (2j)" },
  faux_contrat:        { effect: "blind_travel",              counterBuilding: "guilde_marchands",  effectValue: { duration: 2 },         description: "👁️ Destinations des routes inconnues (2j)" },
  cle_forgee:          { effect: "steal_treasury",            counterBuilding: "coffre_fort",       effectValue: { min: 0.20, max: 0.20 },description: "🏦 Vole 20% de la trésorerie" },
  elixir_discorde:     { effect: "redirect_taxes",            counterBuilding: "scriptorium",       effectValue: { duration: 2 },         description: "💰 Taxes détournées vers votre ville (2j)" },
  lingot_royal:        { effect: "sellable",                  effectValue: { gold: 120, shared: 80 },                                    description: "👑 Vendable (prix dynamique)" },
  lettre_desinformation:{ effect: "tax_loss",                 counterBuilding: "tour_guet",         effectValue: 0.30,                    description: "📰 +30% taxes sur la ville cible (2j)" },
  // T1.5 PvP
  tracts_greve:        { effect: "production_cooldown_malus", effectValue: { increase: 0.20, duration: 1 },                             description: "⚡ +20% cooldowns production pour tous les habitants (24h)" },
};

export default function T5AttackPanel({ profile, city, onRefresh }) {
  const [targetCity, setTargetCity] = useState("");
  const [allCities, setAllCities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attacking, setAttacking] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const cities = await base44.entities.City.list();
        setAllCities(cities.filter(c => c.id !== city.id && !c.is_bot_city));
      } catch (e) {
        console.warn("Failed to load cities:", e);
      }
    }
    load();
  }, [city.id]);

  // T5 items dans l'inventaire
  const t5Items = (profile.inventory || []).filter(i =>
    Object.keys(EFFECT_MAP).includes(i.item_key) && i.quantity > 0
  );

  // Clé de cooldown attaque : joueur + ville cible + jour
  const getTodayStr = () => new Date().toISOString().split("T")[0];
  const getAttackCooldownKey = (targetCityId) => `t5_attack_${targetCityId}_${getTodayStr()}`;

  const hasAttackedTodayCity = (targetCityId) => {
    const cooldowns = profile.competitive_cooldowns || {};
    return !!cooldowns[getAttackCooldownKey(targetCityId)];
  };

  const handleAttack = async (item) => {
    if (!targetCity) {
      toast.error("Sélectionnez une ville cible.");
      return;
    }
    // Système unifié faim/énergie : tirage aléatoire 1 point
    const costResult = applyRandomActionCost(profile, 1);
    if (!costResult.ok) {
      toast.error(costResult.errorMessage);
      return;
    }
    // Limite : 1 attaque T5 par joueur par ville cible par jour
    if (hasAttackedTodayCity(targetCity)) {
      toast.error("⏳ Vous avez déjà lancé une attaque contre cette ville aujourd'hui.");
      return;
    }

    setAttacking(item.item_key);
    try {
      const targetCityData = await base44.entities.City.get(targetCity);
      if (!targetCityData) {
        toast.error("Ville cible introuvable.");
        setAttacking(null);
        return;
      }

      // Tracts de grève : vérifier qu'aucun n'est déjà actif sur la cible
      if (item.item_key === "tracts_greve") {
        const existingPending = targetCityData.pending_effects || {};
        const tractsAlreadyPending = Object.values(existingPending).some(
          e => e.effect === "production_cooldown_malus"
        );
        const tractsAlreadyActive = targetCityData.production_malus?.tracts_greve_active_until
          && new Date(targetCityData.production_malus.tracts_greve_active_until) > new Date();
        if (tractsAlreadyPending || tractsAlreadyActive) {
          toast.error("⚡ Des tracts de grève sont déjà actifs (ou en attente) sur cette ville.");
          setAttacking(null);
          return;
        }
      }

      // Créer l'effet en pending_effects : sera résolu par le dailyReset à 6h UTC
      const pending = { ...(targetCityData.pending_effects || {}) };
      const effectKey = `attack_${profile.id}_${item.item_key}_${Date.now()}`;
      const eff = EFFECT_MAP[item.item_key];

      pending[effectKey] = {
        ...eff,
        fromCityId: city.id,
        fromCityName: city.name,
        fromPlayerId: profile.id,
        fromPlayerName: profile.character_name,
      };

      await base44.entities.City.update(targetCity, { pending_effects: pending });

      // Retirer l'item, réduire la faim, enregistrer le cooldown
      const newInv = (profile.inventory || [])
        .map(i => i.item_key === item.item_key ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0);
      const newCooldowns = {
        ...(profile.competitive_cooldowns || {}),
        [getAttackCooldownKey(targetCity)]: true,
      };
      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: newInv,
        hunger:  costResult.newHunger,
        fatigue: costResult.newFatigue,
        competitive_cooldowns: newCooldowns,
        cumul_t5_envoyes: (profile.cumul_t5_envoyes || 0) + 1,
      });

      toast.success(`⚔️ Attaque lancée contre ${targetCityData.name} ! Effet résolu au prochain reset quotidien (6h UTC).`);
      setTargetCity("");
      onRefresh?.();
    } catch (e) {
      console.error("Attack error:", e);
      toast.error("Erreur lors de l'attaque.");
    } finally {
      setAttacking(null);
    }
  };

  if (t5Items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground font-body">
        🎁 Vous n'avez aucun item T5 pour le moment. Craftez-les dans la page Production !
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sélecteur de ville */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs font-body text-muted-foreground">Cible :</label>
        <select
          value={targetCity}
          onChange={e => setTargetCity(e.target.value)}
          className="flex-1 border border-border rounded-md px-3 py-1.5 text-sm font-body bg-background"
        >
          <option value="">→ Choisir une ville...</option>
          {allCities.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} ({(c.population || 0)}/{c.max_population || 3} hab.)
            </option>
          ))}
        </select>
      </div>

      {/* Grille items T5 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {t5Items.map(item => {
          const itemDef = GAME_ITEMS[item.item_key];
          const eff = EFFECT_MAP[item.item_key];
          return (
            <Card key={item.item_key} className="border-red-200 bg-red-50/30">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-heading font-semibold text-sm">
                      {itemDef?.icon} {itemDef?.name || item.item_name}
                    </div>
                    {eff && (
                      <p className="text-xs text-red-700 font-body mt-1">{eff.description}</p>
                    )}
                  </div>
                  <Badge className="bg-red-100 text-red-800">×{item.quantity}</Badge>
                </div>
                {(() => {
                  const alreadyAttacked = targetCity && hasAttackedTodayCity(targetCity);
                  return (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs font-heading text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleAttack(item)}
                      disabled={!targetCity || attacking === item.item_key || (profile.hunger || 0) < 1 || alreadyAttacked}
                    >
                      {attacking === item.item_key ? "⏳ Attaque..." : alreadyAttacked ? "✅ Déjà attaqué aujourd'hui" : "🎯 Attaquer"}
                    </Button>
                  );
                })()}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground font-body italic">
        💡 Les effets sont résolus au reset quotidien (6h UTC). 1 attaque par ville cible par jour. La ville peut se défendre avec les bâtiments appropriés.
      </p>
    </div>
  );
}