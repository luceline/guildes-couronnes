import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ITEM_CATEGORIES,
  EQUIPMENT_MAX_DURABILITY,
  MAX_HUNGER, HUNGER_FOOD_ITEMS, MAX_SATIETY, MAX_VITALITY, SATIETY_ITEMS, VITALITY_ITEMS,
} from "../lib/gameData";
import {
  ITEMS, ITEM_EFFECTS, TEMP_EFFECT_ITEMS, EQUIPMENT_DURABILITY,
} from "../lib/craftingData";
import { getLevelFromXP } from "../lib/playerLevelSystem";

// Ressources rares des biomes
const RARE_RESOURCES = {
  essence_foret:     { name: "Essence forestière",   icon: "🌿", biome: "Forêt" },
  poussiere_moisson: { name: "Poussière de récolte", icon: "🌾", biome: "Champs" },
  fragment_cristal:  { name: "Fragment cristallin",  icon: "💎", biome: "Mine" },
  fil_enchante:      { name: "Fil enchanté",         icon: "✨", biome: "Atelier" },
  cendre_forge:      { name: "Cendre de forge",      icon: "🔥", biome: "Forge" },
  piece_ancienne:    { name: "Pièce d'or ancienne",  icon: "🪙", biome: "Guilde" },
};

const CONTRAT_DEFS = {
  parchemin:         { label: "📜 Activer contrat", type: "quest_activate",   parchemin_type: "parchemin" },
  contrat_artisan:   { label: "⚒️ Activer contrat",  type: "quest_activate",   parchemin_type: "contrat_artisan" },
};

// Prix de revente lingot royal (fallback si pas de city)
const LINGOT_ROYAL_PRICE_DEFAULT = 156;

export default function InventoryPanel({ profile, city, onRefresh }) {
  const [activating, setActivating]       = useState(null);
  const [consumingFood, setConsumingFood] = useState(null);

  if (!profile) return null;

  const inventory     = (profile.inventory || []).filter(i => i.quantity > 0);
  const currentHunger = profile.hunger ?? MAX_HUNGER;
  const LINGOT_ROYAL_PRICE = city?.lingot_buy_prices?.lingot_royal || LINGOT_ROYAL_PRICE_DEFAULT;

  // ── Activation ressource rare → +100 XP ──
  const handleActivateRare = async (resourceKey) => {
    const item = inventory.find(i => i.item_key === resourceKey);
    if (!item || item.quantity <= 0) return;
    setActivating(resourceKey);
    try {
      const newXP    = (profile.player_xp_total || 0) + 100;
      const oldLevel = getLevelFromXP(profile.player_xp_total || 0);
      const newLevel = getLevelFromXP(newXP);
      const newInv   = inventory
        .map(i => i.item_key === resourceKey ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0);
      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: newInv, player_xp_total: newXP, player_level: newLevel,
      });
      const rare = RARE_RESOURCES[resourceKey];
      toast.success(newLevel > oldLevel
        ? `🎉 ${rare.name} activée ! +100 XP — Niveau ${newLevel} !`
        : `✨ ${rare.name} activée ! +100 XP`, { duration: 3000 });
      onRefresh?.();
    } catch { toast.error("Erreur lors de l'activation"); }
    finally  { setActivating(null); }
  };

  // ── Manger (faim + appétit) ──
  const handleEatForHunger = async (itemKey) => {
    const foodDef = HUNGER_FOOD_ITEMS[itemKey];
    const satietyDef = SATIETY_ITEMS[itemKey];
    const vitalityDef = VITALITY_ITEMS[itemKey];
    if (!foodDef && !satietyDef && !vitalityDef) return;
    const maxHunger = MAX_HUNGER + (profile.hunger_max_bonus || 0);
    if (currentHunger >= maxHunger && (profile.satiety ?? MAX_SATIETY) >= MAX_SATIETY && (profile.vitality ?? MAX_VITALITY) >= MAX_VITALITY) {
      toast("🍽️ Vous n'avez besoin de rien !");
      return;
    }
    setConsumingFood(itemKey + "_hunger");
    try {
      const newInv = inventory
        .map(i => i.item_key === itemKey ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0);
      const updates = { inventory: newInv };
      let toastMsg = [];

      if (foodDef) {
        const newHunger = Math.min(maxHunger, currentHunger + foodDef.hunger_restore);
        updates.hunger = newHunger;
        toastMsg.push(`+${foodDef.hunger_restore} faim`);
      }
      if (satietyDef) {
        const newSatiety = Math.min(MAX_SATIETY, (profile.satiety ?? MAX_SATIETY) + satietyDef.satiety_restore);
        updates.satiety = newSatiety;
        toastMsg.push(`+${satietyDef.satiety_restore} appétit`);
      }
      if (vitalityDef) {
        const newVitality = Math.min(MAX_VITALITY, (profile.vitality ?? MAX_VITALITY) + vitalityDef.vitality_restore);
        updates.vitality = newVitality;
        toastMsg.push(`+${vitalityDef.vitality_restore} forme`);
      }

      await base44.entities.PlayerProfile.update(profile.id, updates);
      toast.success(`🍽️ ${toastMsg.join(" · ")} !`);
      onRefresh?.();
    } catch { toast.error("Erreur"); }
    finally { setConsumingFood(null); }
  };

  // ── Consommer herbes/extraits pour la forme ──
  const handleConsumeVitality = async (itemKey) => {
    const vitalityDef = VITALITY_ITEMS[itemKey];
    if (!vitalityDef) return;
    const currentVitality = profile.vitality ?? MAX_VITALITY;
    if (currentVitality >= MAX_VITALITY) { toast("✨ Vous êtes en pleine forme !"); return; }
    setConsumingFood(itemKey + "_vitality");
    try {
      const newInv = inventory
        .map(i => i.item_key === itemKey ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0);
      const newVitality = Math.min(MAX_VITALITY, currentVitality + vitalityDef.vitality_restore);
      await base44.entities.PlayerProfile.update(profile.id, { inventory: newInv, vitality: newVitality });
      toast.success(`✨ +${vitalityDef.vitality_restore} forme ! (${newVitality}/${MAX_VITALITY})`);
      onRefresh?.();
    } catch { toast.error("Erreur"); }
    finally { setConsumingFood(null); }
  };

  // ── Meuble ──
  const handleActivateMeuble = async () => {
    const today = new Date().toISOString().split("T")[0];
    const expires = new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0];
    const newInv = inventory
      .map(i => (i.item_key === "meuble" || i.item_name === "Meuble") ? { ...i, quantity: i.quantity - 1 } : i)
      .filter(i => i.quantity > 0);
    try {
      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: newInv, meuble_expires_at: expires, meuble_discount: 0.50,
      });
      toast.success("🪑 Meuble installé ! −50% entretien logement pendant 15 jours.");
      onRefresh?.();
    } catch { toast.error("Erreur"); }
  };

  // ── Effets temporaires consommables ──
  const handleConsumeTempEffect = async (itemDef) => {
    if (itemDef.trigger === "passive") return;
    const item = inventory.find(i => i.item_key === itemDef.key);
    if (!item || item.quantity <= 0) return;
    setActivating(itemDef.key);
    try {
      const newInv = inventory
        .map(i => i.item_key === itemDef.key ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0);
      const expiresAt = new Date(Date.now() + (itemDef.durationHours || 24) * 3600000).toISOString();
      const updates = { inventory: newInv };

      if (itemDef.effect === "cooldown_bonus") {
        updates.cooldown_bonus_expires_at = expiresAt;
        updates.cooldown_bonus_value      = itemDef.value || 0.10;
      } else if (itemDef.effect === "energy_max_bonus") {
        updates.energy_max_bonus_expires_at = expiresAt;
        updates.energy_max_bonus_value      = itemDef.value || 10;
      } else if (itemDef.effect === "attack_bonus") {
        updates.attack_bonus_expires_at = expiresAt;
      } else if (itemDef.effect === "defense_bonus") {
        updates.defense_bonus_expires_at = expiresAt;
        updates.defense_bonus_value = itemDef.value || 2;
      } else if (itemDef.effect === "double_prod_bonus") {
        const currentBonus = profile.double_prod_bonus || 0;
        updates.double_prod_bonus = Math.min(0.80, currentBonus + (itemDef.value || 0.10));
        updates.double_prod_bonus_expires_at = expiresAt;
        if (itemDef.xp_reward) updates.player_xp_total = (profile.player_xp_total || 0) + itemDef.xp_reward;
      } else if (itemDef.effect === "travel_and_gamble") {
        updates.travel_discount = itemDef.value || 0.20;
        // gamble or — géré côté Production.jsx avec toast, ici on applique juste le travel
        const gambleMax = itemDef.gamble_max || 60;
        const gambleGold = Math.floor(Math.random() * (gambleMax + 1));
        if (gambleGold > 0) updates.gold = (profile.gold || 0) + gambleGold;
        if (itemDef.xp_reward) updates.player_xp_total = (profile.player_xp_total || 0) + itemDef.xp_reward;

      } else if (itemDef.effect === "hunger_restore") {
        const maxH = MAX_HUNGER + (profile.hunger_max_bonus || 0);
        updates.hunger = Math.min(maxH, currentHunger + (itemDef.value || 5));
        if (itemDef.xp_reward) updates.player_xp_total = (profile.player_xp_total || 0) + itemDef.xp_reward;
      } else if (itemDef.effect === "fatigue_restore") {
        const maxFatigue = (profile.fatigue_max || 20) + (profile.energy_max_bonus_value || 0);
        updates.fatigue = Math.min(maxFatigue, (profile.fatigue ?? 20) + (itemDef.value || 5));
        if (itemDef.xp_reward) updates.player_xp_total = (profile.player_xp_total || 0) + itemDef.xp_reward;
      } else if (itemDef.effect === "hunger_and_regen") {
        const maxH = MAX_HUNGER + (profile.hunger_max_bonus || 0);
        updates.hunger = Math.min(maxH, currentHunger + (itemDef.value || 5));
        updates.hunger_regen_bonus_expires_at = expiresAt;
        updates.hunger_regen_interval_min     = itemDef.regen_interval_min || 10;
        updates.hunger_regen_value            = itemDef.regen_value || 1;
        if (itemDef.xp_reward) updates.player_xp_total = (profile.player_xp_total || 0) + itemDef.xp_reward;
      } else if (itemDef.effect === "fatigue_and_regen") {
        updates.fatigue = Math.min(
          (profile.fatigue_max || 20) + (profile.energy_max_bonus_value || 0),
          (profile.fatigue ?? 20) + (itemDef.value || 10)
        );
        updates.energy_regen_bonus_expires_at = expiresAt;
        updates.energy_regen_interval_min     = itemDef.regen_interval_min || 5;
        updates.energy_regen_value            = itemDef.regen_value || 1;
        if (itemDef.xp_reward) updates.player_xp_total = (profile.player_xp_total || 0) + itemDef.xp_reward;
        if (itemDef.defense_bonus) {
          updates.defense_bonus_expires_at = new Date(Date.now() + (itemDef.defense_bonus_h || 6) * 3600000).toISOString();
          updates.defense_bonus_value = itemDef.defense_bonus;
        }
      } else if (itemDef.effect === "housing_maintenance") {
        const expires15 = new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0];
        updates.meuble_expires_at = expires15;
        updates.meuble_discount   = itemDef.value || 0.50;
      } else if (itemDef.effect === "quest_activate") {
        updates.active_parchemin_type = itemDef.parchemin_type;
      }

      // Quartz poli passif consommé : +def temporaire
      if (itemDef.effect === "market_tax_discount" && itemDef.defense_bonus) {
        updates.defense_bonus_expires_at = new Date(Date.now() + (itemDef.defense_bonus_h || 6) * 3600000).toISOString();
        updates.defense_bonus_value = itemDef.defense_bonus;
      }
      // Biome harvest bonus T1
      if (itemDef.biome_profession && itemDef.biome_key) {
        const biomeActive = profile.biome_cooldown_bonus_expires_at &&
          new Date(profile.biome_cooldown_bonus_expires_at) > new Date();
        if (biomeActive) {
          updates.biome_harvest_bonus_expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // +5 min
        }
      }
      await base44.entities.PlayerProfile.update(profile.id, updates);
      toast.success(`✨ ${itemDef.label || itemDef.name || itemDef.key} activé !`);
      onRefresh?.();
    } catch { toast.error("Erreur lors de l'activation"); }
    finally  { setActivating(null); }
  };

  // ── Contrats ──
  const handleActivateContrat = async (itemKey) => {
    const def = CONTRAT_DEFS[itemKey];
    if (!def) return;
    await handleConsumeTempEffect({ ...def, key: itemKey });
  };

  // ── Vente lingot royal à la mairie ──
  const handleSellLingotToMairie = async () => {
    if (!city) { toast.error("Vous devez être dans votre ville."); return; }
    const isResident = profile.home_city_id === city.id;
    if (!isResident) { toast.error("Uniquement dans votre ville d'origine."); return; }
    const treasury = city.gold_treasury || 0;
    if (treasury - LINGOT_ROYAL_PRICE < 200) { toast.error("Trésorerie insuffisante (min 200💰 après achat)."); return; }
    setActivating("lingot_royal");
    try {
      const newInv = inventory
        .map(i => i.item_key === "lingot_royal" ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0);
      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: newInv, gold: (profile.gold || 0) + LINGOT_ROYAL_PRICE,
      });
      const newLingotsCumul = (city.lingots_cumul || 0) + 1;
      const newWarehouse    = { ...(city.warehouse || {}), lingot_royal: (city.warehouse?.lingot_royal || 0) + 1 };
      await base44.entities.City.update(city.id, {
        gold_treasury:  treasury - LINGOT_ROYAL_PRICE,
        lingots_stock:  (city.lingots_stock || 0) + 1,
        lingots_cumul:  newLingotsCumul,
        warehouse:      newWarehouse,
      });
      toast.success(`👑 Lingot royal vendu à la mairie ! +${LINGOT_ROYAL_PRICE}💰`);
      onRefresh?.();
    } catch { toast.error("Erreur lors de la vente."); }
    finally  { setActivating(null); }
  };

  const rareItems   = inventory.filter(i => RARE_RESOURCES[i.item_key]);
  const normalItems = inventory.filter(i => !RARE_RESOURCES[i.item_key]);

  return (
    <div className="space-y-4">

      {/* ── Ressources rares ── */}
      {rareItems.length > 0 && (
        <Card className="border-violet-200 bg-violet-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              ✨ Ressources rares
              <span className="text-xs font-body font-normal text-muted-foreground">
                — Activez pour +100 XP
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rareItems.map((item) => {
                const rare = RARE_RESOURCES[item.item_key];
                return (
                  <div key={item.item_key} className="flex items-center gap-3 bg-white/60 border border-violet-200 rounded-lg px-3 py-2.5">
                    <span className="text-2xl shrink-0">{rare.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-heading font-semibold">{rare.name}</div>
                      <div className="text-xs text-muted-foreground font-body">×{item.quantity} · {rare.biome}</div>
                    </div>
                    <button
                      onClick={() => handleActivateRare(item.item_key)}
                      disabled={activating === item.item_key}
                      className="text-xs bg-violet-100 hover:bg-violet-200 border border-violet-300 text-violet-700 px-2 py-0.5 rounded font-body transition-colors shrink-0"
                    >
                      {activating === item.item_key ? "..." : "+100 XP"}
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Inventaire normal ── */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">
            📦 Inventaire
            <span className="text-sm font-body font-normal text-muted-foreground ml-2">
              ({normalItems.length} type{normalItems.length !== 1 ? "s" : ""})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {normalItems.length === 0 ? (
            <p className="text-muted-foreground text-sm font-body text-center py-8">Inventaire vide.</p>
          ) : (
            <div className="space-y-2">
              {normalItems.map((item, idx) => {
                const data     = ITEMS[item.item_key] || Object.values(ITEMS).find(d => d.name === item.item_name);
                const cat      = ITEM_CATEGORIES[item.item_category];
                const effect   = item.item_key ? ITEM_EFFECTS[item.item_key] : null;
                const hungerDef = item.item_key ? HUNGER_FOOD_ITEMS[item.item_key] : null;
                const tempDef  = TEMP_EFFECT_ITEMS?.find(t => t.key === item.item_key);
                const isMeuble = item.item_key === "meuble" || item.item_name === "Meuble";
                const meubleActive = isMeuble && profile.meuble_expires_at >= new Date().toISOString().split("T")[0];
                const isLingotRoyal = item.item_key === "lingot_royal";
                const isContrat = Object.keys(CONTRAT_DEFS).includes(item.item_key);
                const isContratNoble = item.item_key === "contrat_noble";
                const nobleActive = !!city?.contrat_noble_active;
                const isResident  = profile.home_city_id === city?.id;

                return (
                  <div key={idx} className="flex items-center gap-3 bg-muted/40 rounded-lg p-3 text-sm font-body">
                    <span className="text-2xl">{data?.icon || cat?.icon || "📦"}</span>
                    <div className="flex-1">
                      <div className="font-semibold">{item.item_name}</div>
                      <div className="text-xs text-muted-foreground">{data?.use || "Vendable sur le marché"}</div>
                      {item.durability !== undefined && (() => {
                        const maxDur = EQUIPMENT_DURABILITY?.[item.item_key] ?? EQUIPMENT_MAX_DURABILITY;
                        return <div className="text-xs text-slate-500 mt-0.5">🛡️ Durabilité : {item.durability}/{maxDur}</div>;
                      })()}
                      {isMeuble && (
                        <div className="text-xs text-amber-700 mt-0.5">
                          {meubleActive ? `🪑 Actif jusqu'au ${profile.meuble_expires_at}` : "Inactif — cliquez pour installer (15 jours)"}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="secondary">×{item.quantity}</Badge>

                      {/* Manger */}
                      {hungerDef && currentHunger < MAX_HUNGER && (
                        <button onClick={() => handleEatForHunger(item.item_key)}
                          disabled={consumingFood === item.item_key + "_hunger"}
                          className="text-xs bg-orange-100 hover:bg-orange-200 border border-orange-300 text-orange-800 px-2 py-0.5 rounded font-body transition-colors">
                          Manger
                        </button>
                      )}

                      {/* Meuble */}
                      {isMeuble && !meubleActive && (
                        <button onClick={handleActivateMeuble}
                          className="text-xs bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 px-2 py-0.5 rounded font-body transition-colors">
                          🪑 Installer
                        </button>
                      )}

                      {/* Effets temporaires */}
                      {tempDef && !isMeuble && (
                        <button onClick={() => handleConsumeTempEffect(tempDef)}
                          disabled={activating === item.item_key}
                          className="text-xs bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 text-indigo-900 px-2 py-0.5 rounded font-body transition-colors">
                          {activating === item.item_key ? "..." : `✨ ${tempDef.label}`}
                        </button>
                      )}

                      {/* Contrats */}
                      {isContrat && (
                        <button onClick={() => handleActivateContrat(item.item_key)}
                          disabled={activating === item.item_key}
                          className="text-xs bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 px-2 py-0.5 rounded font-body transition-colors">
                          {activating === item.item_key ? "..." : "📜 Activer"}
                        </button>
                      )}

                      {/* Contrat noble */}
                      {isContratNoble && (() => {
                        if (!isResident) return <span className="text-xs text-muted-foreground italic">Activable dans votre ville</span>;
                        if (nobleActive) return <span className="text-xs text-emerald-600">🛡️ Déjà actif</span>;
                        return (
                          <button
                            disabled={activating === "contrat_noble"}
                            onClick={async () => {
                              setActivating("contrat_noble");
                              try {
                                const newInv = inventory
                                  .map(i => i.item_key === "contrat_noble" ? { ...i, quantity: i.quantity - 1 } : i)
                                  .filter(i => i.quantity > 0);
                                await base44.entities.PlayerProfile.update(profile.id, { inventory: newInv });
                                await base44.entities.City.update(city.id, { contrat_noble_active: true });
                                toast.success("📜 Contrat Noble activé ! La ville est protégée contre la prochaine attaque T5.");
                                onRefresh?.();
                              } catch { toast.error("Erreur"); }
                              finally { setActivating(null); }
                            }}
                            className="text-xs bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-900 px-2 py-0.5 rounded font-body transition-colors">
                            📜 Activer bouclier
                          </button>
                        );
                      })()}

                      {/* Lingot royal */}
                      {isLingotRoyal && (() => {
                        const canSell = isResident && (city?.gold_treasury || 0) - LINGOT_ROYAL_PRICE >= 200;
                        return (
                          <button
                            onClick={handleSellLingotToMairie}
                            disabled={!canSell || activating === "lingot_royal"}
                            title={!canSell ? (isResident ? "Trésorerie insuffisante (min 200💰)" : "Uniquement dans votre ville d'origine") : ""}
                            className={`text-xs px-2 py-0.5 rounded font-body transition-colors border ${canSell ? "bg-yellow-400 hover:bg-yellow-500 border-yellow-500 text-yellow-900" : "bg-muted border-border text-muted-foreground opacity-50 cursor-not-allowed"}`}>
                            {activating === "lingot_royal" ? "..." : `👑 Vendre (+${LINGOT_ROYAL_PRICE}💰)`}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}