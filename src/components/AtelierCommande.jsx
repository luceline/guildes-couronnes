/**
 * AtelierCommande : Permet à un client de commander une production
 * auprès d'un autre joueur dont l'atelier est ouvert.
 * Affiché dans l'onglet Habitants de CityView quand on clique sur un joueur.
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { logGold } from "@/lib/goldLog";
import { findInventoryItem, removeFromInventory } from "@/lib/inventoryHelpers";
import { isBiomeBuffActive, getBiomeDoubleProdChance } from "@/lib/playerBuffs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  PROFESSION_PRODUCTION,
  CRAFTING_RECIPES,
  ITEMS,
  EQUIPMENT_KEYS,
  EQUIPMENT_DURABILITY,
} from "../lib/craftingData";
import {
  MAX_HUNGER, HUNGER_WARNING_THRESHOLD, applyRandomActionCost,
  getMaxFatigue, TIER_ACTION_COST, EQUIPMENT_MAX_DURABILITY,
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
  const biomeCd = isBiomeBuffActive(clientProfile) ? 0.10 : 0;
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
  // Note (avril 2026) : on n'exit plus si pas de vitrine : d'autres services
  // peuvent être disponibles (ex: amélioration combat pour Bûcheron/Mineur).
  // Si pas de vitrine active ET aucune autre raison d'afficher, on rend null à la fin.
  if (!vitrine.active) return null;

  const priceT1    = vitrine.price_t1 ?? 2;
  const priceT2plus = vitrine.price_t2plus ?? 5;

  // Recettes T1 du producteur (récolte)
  const t1Recipes = PROFESSION_PRODUCTION[producer.profession] || [];

  // Recettes T2-T5 du producteur (craft) : filtrées par la PROFESSION DU PRODUCTEUR.
  // Un client qui passe par l'atelier d'un Bûcheron ne peut commander que des recettes Bûcheron.
  const craftRecipes = CRAFTING_RECIPES.filter(r =>
    r.output?.key &&
    r.inputs?.length > 0 &&
    (!r.profession || r.profession === producer.profession)
  );

  const clientHunger  = clientProfile.hunger ?? MAX_HUNGER;
  const clientFatigue = clientProfile.fatigue ?? getMaxFatigue(clientProfile);

  const canAffordFatigue = (tier) => {
    const cost = TIER_ACTION_COST?.[tier] || 1;
    // Système unifié : il faut faim + énergie cumulés ≥ cost pour pouvoir agir
    return clientHunger + clientFatigue >= cost;
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
    const actionCost = TIER_ACTION_COST?.[tier] || 1;

    // Validations
    if ((clientProfile.gold || 0) < price) {
      toast.error(`Il vous faut ${price} 💰 pour ce service.`); return;
    }
    if (clientHunger + clientFatigue < actionCost) {
      toast.error("💤 Vous êtes à bout de forces, reposez-vous !"); return;
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

    // ── REFONTE ITEMS v5 : Anti-doublon items combat (épée + 4 armures) ──
    // Règle : 1 seul exemplaire par type, équipé OU en inventaire, toutes dura confondues.
    // Si l'item est brisé (dura=0), le joueur doit le réparer (1 pierre = +1 dura
    // pour l'épée, 1 laine_brute pour les armures) plutôt que d'en commander un nouveau.
    const outputKeyToCheck = isT1 ? recipe.outputKey : recipe.output?.key;
    if (outputKeyToCheck && EQUIPMENT_KEYS.includes(outputKeyToCheck)) {
      // 1. Vérifier l'inventaire (tous les exemplaires, même cassés)
      const inInventory = (clientProfile.inventory || []).some(i =>
        i.item_key === outputKeyToCheck
      );
      // 2. Vérifier l'équipement (tous slots, même item brisé équipé)
      const eq = clientProfile.equipment || {};
      const inEquipment = Object.values(eq).some(slotItem =>
        slotItem && slotItem.item_key === outputKeyToCheck
      );
      if (inInventory || inEquipment) {
        const itemName = ITEMS[outputKeyToCheck]?.name || outputKeyToCheck;
        const repairKey = outputKeyToCheck === "epee" ? "pierre" : "laine_brute";
        const repairName = ITEMS[repairKey]?.name || repairKey;
        toast.error(`Vous possédez déjà un(e) ${itemName}. S'il/elle est brisé(e), réparez-le/la avec une ${repairName} (onglet Combat) plutôt que d'en commander un(e) nouveau/nouvelle.`);
        return;
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
          if (!findInventoryItem(clientInv, req.key)) {
            toast.error("Ingrédient manquant."); return;
          }
          clientInv = removeFromInventory(clientInv, req.key, req.quantity);
        }
      }

      // ── Calculer la quantité produite avec les bonus du client ──
      const outputKey   = isT1 ? recipe.outputKey : recipe.output.key;
      const baseQty     = isT1 ? recipe.quantity  : recipe.output.quantity;

      // Bonus biome client
      let biomeBonusQty = 0;
      const biomeChance = getBiomeDoubleProdChance(freshClient);
      if (biomeChance > 0 && Math.random() < biomeChance) {
        biomeBonusQty = baseQty;
        toast.success("🌿 Buff biome ! Double production !");
      }

      // Bonus double production par niveau client
      const levelBonusClient = getPlayerLevelBonuses(freshClient.player_level || 1);
      const doubleChance = (levelBonusClient.doubleProductionBonus || 0) / 100;
      const doubleBonus = (doubleChance > 0 && Math.random() < doubleChance) ? baseQty : 0;
      if (doubleBonus > 0) toast.success(`✨ Coup de maître ! Double production (rang ${freshClient.player_level || 1}) !`);

      const outputQty = baseQty + biomeBonusQty + doubleBonus;
      const outputItem = ITEMS[outputKey];

      // ── REFONTE COMBAT v4 : items équipables = grade 0 + durability + pas de stack ──
      // Pour les épées, heaumes, cuirasses, brassards, jambières et autres items à durabilité,
      // on crée systématiquement une nouvelle ligne avec grade=0 et la durability max de l'item.
      // On nettoie aussi les anciennes lignes du même item à dura=0 (déchets après destruction).
      // Cohérent avec Production.jsx (handleCraft) qui fait pareil.
      const isEquipmentOutput = EQUIPMENT_KEYS.includes(outputKey);
      if (isEquipmentOutput) {
        // Retirer les anciennes lignes du même item à dura ≤ 0 (déchets de destruction)
        clientInv = clientInv.filter(i =>
          !(i.item_key === outputKey && (i.durability ?? EQUIPMENT_MAX_DURABILITY) <= 0)
        );
        const dura = EQUIPMENT_DURABILITY[outputKey] ?? EQUIPMENT_MAX_DURABILITY;
        clientInv.push({
          item_key:      outputKey,
          item_name:     outputItem?.name || outputKey,
          item_category: outputItem?.category || "armes_combat",
          quantity:      1,
          grade:         0,
          durability:    dura,
        });
      } else {
        const existing = clientInv.find(i => i.item_key === outputKey || i.item_name === outputItem?.name);
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
      }

      // ── Cooldown + faim/énergie aléatoire (système unifié) ──
      const newCooldowns = {
        ...(freshClient.production_cooldowns || {}),
        [recipeId]: new Date().toISOString(),
      };
      const costResult = applyRandomActionCost(freshClient, actionCost);
      if (!costResult.ok) { toast.error(costResult.errorMessage); return; }
      const newFatigue = costResult.newFatigue;
      const newHunger  = costResult.newHunger;
      const newGold    = (freshClient.gold || 0) - price;

      // ── Split 80/20 : artisan reçoit 80%, ville reçoit 20% ──
      // Refonte mai 2026 : la commission ville est désormais d'au moins 1 or.
      // Avant, à prix bas (price=1 par exemple), Math.floor(price*0.80) = 0
      // donnait 0 à l'artisan ET 1 à la ville. Mais à prix=0 (cadeau),
      // la ville touchait 0, court-circuitant totalement la taxe.
      // Désormais : ville touche min(price, max(1, round(price * 0.20))).
      // Combiné avec min={1} sur l'input artisan, garantit ≥1 or par transaction.
      const cityShare    = Math.min(price, Math.max(1, Math.round(price * 0.20)));
      const artisanShare = price - cityShare;
      const producerGold = (freshProducer.gold || 0) + artisanShare;

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

      // ── Verser la commission au trésor de la ville où se trouve le client ──
      const cityIdForCommission = clientProfile.city_id;
      if (cityIdForCommission && cityShare > 0) {
        try {
          const freshCity = await base44.entities.City.get(cityIdForCommission);
          await base44.entities.City.update(cityIdForCommission, {
            gold_treasury:       (freshCity.gold_treasury || 0) + cityShare,
            treasury_cumulative: (freshCity.treasury_cumulative || 0) + cityShare,
          });
        } catch (e) { console.warn("Commission ville atelier:", e); }
      }

      // Log transaction (côté client = paiement)
      // V6.1.6 — On log AUSSI côté producteur. Avant, seul le client avait une
      // ligne dans gold_transactions, ce qui donnait l'impression au producteur
      // que l'or n'arrivait pas (alors qu'il était bien crédité sur son profil).
      // Le dashboard se basant sur gold_transactions, le producteur ne voyait
      // rien et soupçonnait un vol. Ces deux create() en parallèle règlent ça.
      await Promise.all([
        logGold({
          profile: clientProfile,
          city: { id: clientProfile.city_id, name: "" },
          amount: -price,
          type: "service_atelier",
          description: `Service d'atelier : ${outputItem?.name || outputKey} par ${producer.character_name} (${artisanShare}💰 artisan, ${cityShare}💰 ville)`,
        }),
        logGold({
          profile: producer,
          city: { id: producer.city_id, name: "" },
          amount: artisanShare,
          type: "service_atelier",
          description: `Service d'atelier rendu à ${clientProfile.character_name || "un client"} : ${outputItem?.name || outputKey}`,
        }),
      ]);

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

      {/* T1 : récolte du producteur */}
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

      {/* T2-T5 : craft */}
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
                    {!hasIngr && <span className="text-red-500 ml-1">· ingrédients manquants</span>}
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