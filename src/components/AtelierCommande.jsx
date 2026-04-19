/**
 * AtelierCommande — Permet à un client de commander une production
 * auprès d'un autre joueur dont l'atelier est ouvert.
 * Affiché dans l'onglet Habitants de CityView quand on clique sur un joueur.
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  PROFESSION_PRODUCTION,
  CRAFTING_RECIPES,
  ITEMS,
} from "../lib/craftingData";
import {
  MAX_HUNGER, HUNGER_WARNING_THRESHOLD,
  getMaxFatigue, TIER_ACTION_COST,
} from "../lib/gameData";
import { getPlayerLevelBonuses } from "../lib/playerLevelSystem";

// Calcule le cooldown restant pour une recette dans l'inventaire du client
function getCooldownLeft(recipeId, clientProfile) {
  const cooldowns = clientProfile?.production_cooldowns || {};
  const lastUsed = cooldowns[recipeId];
  if (!lastUsed) return 0;

  // Réduction cooldown du client (niveau + buff biome + palier ville)
  const levelBonuses = getPlayerLevelBonuses(clientProfile?.player_level || 1);
  const levelCd = (levelBonuses.cooldownBonus || 0) / 100;
  const biomeCd = (clientProfile?.biome_cooldown_bonus_expires_at &&
    new Date(clientProfile.biome_cooldown_bonus_expires_at) > new Date())
    ? 0.10 : 0;
  const totalReduction = Math.min(0.9, levelCd + biomeCd);

  // Cooldown de base (on utilise 80s par défaut pour T1, recette pour craft)
  const baseCooldown = 80; // secondes
  const effectiveCd = Math.round(baseCooldown * (1 - totalReduction));
  const elapsed = (Date.now() - new Date(lastUsed).getTime()) / 1000;
  return Math.max(0, effectiveCd - elapsed);
}

function formatCd(s) {
  if (s <= 0) return null;
  const m = Math.floor(s / 60), sec = Math.round(s % 60);
  return m > 0 ? `${m}m${sec > 0 ? sec + "s" : ""}` : `${sec}s`;
}

export default function AtelierCommande({ producer, clientProfile, onClose, onRefresh }) {
  const [ordering, setOrdering] = useState(null);
  const vitrine = producer.atelier_vitrine || {};
  if (!vitrine.active) return null;

  const priceT1    = vitrine.price_t1 ?? 2;
  const priceT2plus = vitrine.price_t2plus ?? 5;

  // Recettes T1 du producteur (récolte)
  const t1Recipes = PROFESSION_PRODUCTION[producer.profession] || [];

  // Recettes T2-T5 du producteur (craft) — filtrées par profession
  // On utilise toutes les recettes disponibles (pas de restriction par profession côté craft)
  const craftRecipes = CRAFTING_RECIPES.filter(r => r.output?.key && r.inputs?.length > 0);

  const clientHunger  = clientProfile.hunger ?? MAX_HUNGER;
  const clientFatigue = clientProfile.fatigue ?? getMaxFatigue(clientProfile);

  const canAffordFatigue = (tier) => {
    const cost = TIER_ACTION_COST?.[tier] || { fatigue: 1, hunger: 1 };
    const extra = clientHunger < HUNGER_WARNING_THRESHOLD ? 1 : 0;
    return clientFatigue >= (cost.fatigue + extra);
  };

  const hasIngredients = (inputs) => {
    const inv = clientProfile.inventory || [];
    return inputs.every(req => {
      const found = inv.find(i => i.item_key === req.key || i.item_name === ITEMS[req.key]?.name);
      return found && found.quantity >= req.quantity;
    });
  };

  const handleOrder = async (recipe, isT1 = false) => {
    const recipeId  = isT1 ? recipe.id : recipe.id;
    const tier      = isT1 ? 1 : (ITEMS[recipe.output?.key]?.tier || 2);
    const price     = tier === 1 ? priceT1 : priceT2plus;
    const tierCost  = TIER_ACTION_COST?.[tier] || { fatigue: 1, hunger: 1 };
    const extra     = clientHunger < HUNGER_WARNING_THRESHOLD ? 1 : 0;
    const fatCost   = tierCost.fatigue + extra;
    const hunCost   = tierCost.hunger;

    // Validations
    if ((clientProfile.gold || 0) < price) {
      toast.error(`Il vous faut ${price} 💰 pour ce service.`); return;
    }
    if (clientFatigue < fatCost) {
      toast.error("Vos bras ne répondent plus — reposez-vous avant de commander."); return;
    }
    if (clientHunger <= 0) {
      toast.error("Votre ventre crie famine — mangez avant de commander."); return;
    }
    const cdLeft = getCooldownLeft(recipeId, clientProfile);
    if (cdLeft > 0) {
      toast.error(`Encore ${formatCd(cdLeft)} avant de pouvoir utiliser cette recette.`); return;
    }

    // Pour T2+, vérifier les ingrédients dans l'inventaire du CLIENT
    if (!isT1 && recipe.inputs) {
      if (!hasIngredients(recipe.inputs)) {
        toast.error("Vous n'avez pas les ingrédients nécessaires."); return;
      }
    }

    setOrdering(recipeId);
    try {
      // ── Lire profils frais ──
      const [freshClient, freshProducer] = await Promise.all([
        base44.entities.PlayerProfile.get(clientProfile.id),
        base44.entities.PlayerProfile.get(producer.id),
      ]);

      let clientInv = [...(freshClient.inventory || [])];

      // ── Déduire les ingrédients de l'inventaire client (T2+) ──
      if (!isT1 && recipe.inputs) {
        for (const req of recipe.inputs) {
          const idx = clientInv.findIndex(i =>
            i.item_key === req.key || i.item_name === ITEMS[req.key]?.name
          );
          if (idx < 0) { toast.error("Ingrédient manquant."); return; }
          clientInv[idx] = { ...clientInv[idx], quantity: clientInv[idx].quantity - req.quantity };
        }
        clientInv = clientInv.filter(i => i.quantity > 0);
      }

      // ── Calculer la quantité produite avec les bonus du client ──
      const outputKey   = isT1 ? recipe.outputKey : recipe.output.key;
      const baseQty     = isT1 ? recipe.quantity  : recipe.output.quantity;

      // Bonus biome client
      let biomeBonusQty = 0;
      const biomeBuffActive = freshClient.biome_cooldown_bonus_expires_at &&
        new Date(freshClient.biome_cooldown_bonus_expires_at) > new Date();
      if (biomeBuffActive) {
        const biomeChance = freshClient.biome_double_prod_bonus ?? 0.10;
        if (Math.random() < biomeChance) {
          biomeBonusQty = baseQty;
          toast.success("🌿 Buff biome ! Double production !");
        }
      }

      // Bonus double production par niveau client
      const levelBonusClient = getPlayerLevelBonuses(freshClient.player_level || 1);
      const doubleChance = (levelBonusClient.doubleProductionBonus || 0) / 100;
      const doubleBonus = (doubleChance > 0 && Math.random() < doubleChance) ? baseQty : 0;
      if (doubleBonus > 0) toast.success(`✨ Coup de maître ! Double production (rang ${freshClient.player_level || 1}) !`);

      const outputQty = baseQty + biomeBonusQty + doubleBonus;
      const outputItem = ITEMS[outputKey];
      const existing   = clientInv.find(i => i.item_key === outputKey || i.item_name === outputItem?.name);
      if (existing) {
        existing.quantity += outputQty;
      } else {
        clientInv.push({
          item_key:      outputKey,
          item_name:     outputItem?.name || outputKey,
          item_category: outputItem?.category || "ressources",
          quantity:      outputQty,
        });
      }

      // ── Cooldown + faim + fatigue client ──
      const newCooldowns = {
        ...(freshClient.production_cooldowns || {}),
        [recipeId]: new Date().toISOString(),
      };
      const newFatigue = Math.max(0, (freshClient.fatigue ?? getMaxFatigue(freshClient)) - fatCost);
      const newHunger  = Math.max(0, (freshClient.hunger ?? MAX_HUNGER) - hunCost);
      const newGold    = (freshClient.gold || 0) - price;

      // ── Créditer le producteur ──
      const producerGold = (freshProducer.gold || 0) + price;

      await Promise.all([
        base44.entities.PlayerProfile.update(freshClient.id, {
          inventory:            clientInv,
          production_cooldowns: newCooldowns,
          fatigue:              newFatigue,
          hunger:               newHunger,
          gold:                 newGold,
        }),
        base44.entities.PlayerProfile.update(freshProducer.id, {
          gold: producerGold,
        }),
      ]);

      // Log transaction
      await base44.entities.GoldTransaction.create({
        player_email: clientProfile.user_email,
        player_name:  clientProfile.character_name || "",
        city_id:      clientProfile.city_id || "",
        city_name:    "",
        amount:       -price,
        type:         "service_atelier",
        description:  `Service d'atelier : ${outputItem?.name || outputKey} par ${producer.character_name}`,
      }).catch(() => {});

      const itemName = isT1 ? (outputItem?.name || outputKey) : (outputItem?.name || recipe.output.key);
      toast.success(`✅ ${outputQty}× ${itemName} produit${outputQty > 1 ? "s" : ""} par ${producer.character_name} ! −${price} 💰`);
      onRefresh?.();
    } catch(e) {
      console.error("AtelierCommande:", e);
      toast.error("Une erreur est survenue lors de la commande.");
    } finally {
      setOrdering(null);
    }
  };

  return (
    <div className="space-y-4 mt-3 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-heading font-semibold">
          🏪 Atelier de {producer.character_name}
          <span className="text-xs font-body font-normal text-muted-foreground ml-2">
            T1 : {priceT1}💰 · T2+ : {priceT2plus}💰 par action
          </span>
        </p>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground font-body">✕ Fermer</button>
      </div>

      <p className="text-xs text-muted-foreground font-body italic">
        Vous fournissez vos ingrédients, {producer.character_name} produit. Cooldown, faim et fatigue sont les vôtres.
      </p>

      {/* T1 — récolte du producteur */}
      {t1Recipes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wide">Récolte T1</p>
          {t1Recipes.map(recipe => {
            const cdLeft = getCooldownLeft(recipe.id, clientProfile);
            const noFat  = !canAffordFatigue(1);
            return (
              <div key={recipe.id} className="flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2 text-sm font-body">
                <span className="text-xl">{recipe.icon}</span>
                <div className="flex-1">
                  <div className="font-semibold">{recipe.name}</div>
                  <div className="text-xs text-muted-foreground">→ {recipe.quantity}× {ITEMS[recipe.outputKey]?.name || recipe.outputKey}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary" className="text-xs">{priceT1} 💰</Badge>
                  {cdLeft > 0
                    ? <span className="text-xs text-orange-600">⏳ {formatCd(cdLeft)}</span>
                    : noFat
                      ? <span className="text-xs text-red-500">Épuisé</span>
                      : <Button size="sm" className="h-7 text-xs font-heading"
                          disabled={!!ordering}
                          onClick={() => handleOrder(recipe, true)}>
                          {ordering === recipe.id ? "..." : "Commander"}
                        </Button>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* T2-T5 — craft */}
      {craftRecipes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wide">Craft (vous fournissez les ingrédients)</p>
          {craftRecipes.map(recipe => {
            const tier     = ITEMS[recipe.output?.key]?.tier || 2;
            const cdLeft   = getCooldownLeft(recipe.id, clientProfile);
            const noFat    = !canAffordFatigue(tier);
            const hasIngr  = hasIngredients(recipe.inputs || []);
            const disabled = !!ordering || !hasIngr;
            return (
              <div key={recipe.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-body ${hasIngr ? "bg-muted/40" : "bg-muted/20 opacity-60"}`}>
                <span className="text-xl">{ITEMS[recipe.output.key]?.icon || "⚒️"}</span>
                <div className="flex-1">
                  <div className="font-semibold">{ITEMS[recipe.output.key]?.name || recipe.output.key}</div>
                  <div className="text-xs text-muted-foreground">
                    {recipe.inputs.map(i => `${i.quantity}× ${ITEMS[i.key]?.name || i.key}`).join(", ")}
                    {!hasIngr && <span className="text-red-500 ml-1">— ingrédients manquants</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary" className="text-xs">{priceT2plus} 💰</Badge>
                  {cdLeft > 0
                    ? <span className="text-xs text-orange-600">⏳ {formatCd(cdLeft)}</span>
                    : noFat
                      ? <span className="text-xs text-red-500">Épuisé</span>
                      : <Button size="sm" className="h-7 text-xs font-heading"
                          disabled={disabled}
                          onClick={() => handleOrder(recipe, false)}>
                          {ordering === recipe.id ? "..." : "Commander"}
                        </Button>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}