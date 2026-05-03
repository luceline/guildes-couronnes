import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { logGold } from "@/lib/goldLog";
import { getItemName } from "@/lib/itemHelpers";
import { findInventoryItem, removeFromInventory } from "@/lib/inventoryHelpers";
import { showXPToast } from "@/lib/xpToasts";
import { isBiomeBuffActive, activateBiomeHarvestBonus } from "@/lib/playerBuffs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ITEM_CATEGORIES,
  EQUIPMENT_MAX_DURABILITY,
  MAX_HUNGER, getMaxHunger, getCityHungerBonus, getFestinHungerDrain, HUNGER_FOOD_ITEMS,
  COMBAT_MAX_HP, getPlayerHP, isPlayerKO,
} from "../lib/gameData";
import {
  ITEMS, ITEM_EFFECTS, TEMP_EFFECT_ITEMS, EQUIPMENT_DURABILITY,
} from "../lib/craftingData";
import { getLevelFromXP, grantXP } from "../lib/playerLevelSystem";
import { RARE_RESOURCES, XP_PER_RARE_RESOURCE } from "../lib/rareResources";

// RARE_RESOURCES retiré : utiliser la source de vérité @/lib/rareResources.
// Les keys utilisées sont celles que CombatEpic distribue effectivement en loot
// (essence_foret, poussiere_moisson, fragment_cristal, fil_or, lingot_runique,
// sceau_guilde). Les anciennes keys "fil_enchante", "cendre_forge", "piece_ancienne"
// n'étaient en réalité jamais alimentées par le combat → bug XP corrigé.

const CONTRAT_DEFS = {
  // L'entrée "parchemin" a été retirée car elle créait un double bouton dans l'inventaire :
  //   - "+100 XP" via la branche effect:"xp_reward" (vraie action utile)
  //   - "📜 Activer contrat" via cette table (ne faisait rien de fonctionnel)
  // On garde uniquement "contrat_artisan" qui a son propre flow de quête.
  contrat_artisan:   { label: "⚒️ Activer contrat",  type: "quest_activate",   parchemin_type: "contrat_artisan" },
};

// Prix de revente lingot royal (fallback si pas de city)
// Référence économique : un T5 contient 180 ressources T1 (5×36 T1 par cumul du schéma T5).
// Avec une fourchette T1 de 1 à 6 or, la matière brute vaut 180-1080 or. Le prix de départ
// à 800 or assure un bénéfice net au crafteur dans la majorité des cas.
const LINGOT_ROYAL_PRICE_DEFAULT = 800;

export default function InventoryPanel({ profile, city, homeCity, onRefresh }) {
  const cityHungerBonus = getCityHungerBonus(homeCity?.buildings || []);
  const [activating, setActivating]       = useState(null);
  const [consumingFood, setConsumingFood] = useState(null);
  const [confirmConsume, setConfirmConsume] = useState(null); // { type, key, def }

  if (!profile) return null;

  const inventory     = (profile.inventory || []).filter(i => i.quantity > 0);
  const currentHunger = profile.hunger ?? MAX_HUNGER;
  const LINGOT_ROYAL_PRICE = city?.lingot_buy_prices?.lingot_royal || LINGOT_ROYAL_PRICE_DEFAULT;

  // ── Activation ressource rare → +100 XP ──
  const handleActivateRare = async (resourceKey) => {
    const item = findInventoryItem(inventory, resourceKey);
    if (!item || item.quantity <= 0) return;
    setActivating(resourceKey);
    try {
      const newXP    = (profile.player_xp_total || 0) + XP_PER_RARE_RESOURCE;
      const oldLevel = getLevelFromXP(profile.player_xp_total || 0);
      const newLevel = getLevelFromXP(newXP);
      const newInv   = removeFromInventory(inventory, resourceKey, 1);
      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: newInv, player_xp_total: newXP, player_level: newLevel,
      });
      const rare = RARE_RESOURCES[resourceKey];
      toast.success(newLevel > oldLevel
        ? `🎉 ${rare.name} activée ! +${XP_PER_RARE_RESOURCE} XP — Niveau ${newLevel} !`
        : `✨ ${rare.name} activée ! +${XP_PER_RARE_RESOURCE} XP`, { duration: 3000 });
      onRefresh?.();
    } catch { toast.error("Erreur lors de l'activation"); }
    finally  { setActivating(null); }
  };

  // ── Manger (faim) ──
  const handleEatForHunger = async (itemKey) => {
    const foodDef = HUNGER_FOOD_ITEMS[itemKey];
    if (!foodDef) return;
    const maxHunger = getMaxHunger(profile, cityHungerBonus);
    if (currentHunger >= maxHunger) {
      toast("🍽️ Vous n'avez pas faim !");
      return;
    }
    setConsumingFood(itemKey + "_hunger");
    try {
      const newInv = removeFromInventory(inventory, itemKey, 1);
      const newHunger = Math.min(maxHunger, currentHunger + foodDef.hunger_restore);
      const upd = { inventory: newInv, hunger: newHunger };
      const msgs = [`+${foodDef.hunger_restore} faim`];
      // Festin empoisonné actif → drain énergie
      const festinDrain = getFestinHungerDrain(city);
      if (festinDrain > 0) {
        upd.fatigue = Math.max(0, (profile.fatigue ?? 20) - festinDrain);
        msgs.push(`☠️ −${festinDrain}⚡ (festin empoisonné)`);
      }
      await base44.entities.PlayerProfile.update(profile.id, upd);
      toast.success(`🍽️ ${msgs.join(' · ')} !`);
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
    if (itemDef.trigger === "equipped") {
      toast("Cet objet s'équipe depuis l'onglet Profil → Équipement de combat.");
      return;
    }
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
      } else if (itemDef.effect === "biome_buff_only") {
        // pierre, laine_brute, bois_brut, minerai_fer : aucun effet hors buff biome
      } else if (itemDef.effect === "double_prod_bonus") {
        // REFONTE v5 : charbon devient passif, pas consommable
        toast("⚫ Le charbon agit passivement — pas besoin de le consommer.");
        setActivating(null);
        return;
      } else if (itemDef.effect === "gamble") {
        // REFONTE v5 : Encre — gamble pur 0–80💰
        const gambleMax = itemDef.gamble_max || 80;
        const gambleGold = Math.floor(Math.random() * (gambleMax + 1));
        if (gambleGold > 0) {
          updates.gold = (profile.gold || 0) + gambleGold;
          const flavor = gambleGold > gambleMax * 0.6 ? "📖 Votre ouvrage fait fureur !" : gambleGold > 20 ? "📖 Succès modeste..." : "📖 Un flop, hélas...";
          toast.success(`${itemDef.icon || "🖋️"} ${flavor} +${gambleGold}💰`);
          await logGold({
            profile, city,
            amount: gambleGold, type: 'objectif',
            description: `Gamble ${itemDef.name || itemDef.key} : +${gambleGold}💰 (max ${gambleMax})`,
          });
        } else {
          toast(`📖 Votre livre est resté dans les cartons... Personne n'a mordu.`);
        }
      } else if (itemDef.effect === "xp_reward") {
        // REFONTE v5 : Parchemin — récompense XP pure
        const xpAmount = itemDef.value || 100;
        const xpGain = grantXP(profile, xpAmount);
        Object.assign(updates, xpGain.updates);  // ajoute player_xp_total + player_level si level-up
        showXPToast(xpAmount, xpGain, { icon: itemDef.icon || "📜" });
      } else if (itemDef.effect === "army_food" || itemDef.effect === "army_energy") {
        // REFONTE v5 : Ragoût T4 / Potion d'endurance T4 — ressources militaires.
        // Le joueur ne peut pas les consommer individuellement — elles passent par le maire
        // qui les dépose en entrepôt depuis le panel Gouvernance > Approvisionnement armée.
        toast(`🏰 ${itemDef.name || itemDef.label} — ressource militaire, à déposer en entrepôt par le maire.`);
        setActivating(null);
        return;
      } else if (itemDef.effect === "hunger_restore") {
        // Blé / Farine / Pain : +X faim instant (REFONTE v5 : valeurs simplifiées)
        const maxH = getMaxHunger(profile, cityHungerBonus);
        updates.hunger = Math.min(maxH, currentHunger + (itemDef.value || 5));
        if (itemDef.xp_reward) updates.player_xp_total = (profile.player_xp_total || 0) + itemDef.xp_reward;
        // Festin empoisonné actif → drain énergie
        const festinDrain = getFestinHungerDrain(city);
        if (festinDrain > 0) {
          updates.fatigue = Math.max(0, (profile.fatigue ?? 20) - festinDrain);
        }
      } else if (itemDef.effect === "fatigue_restore") {
        // Herbes / Extrait / Potion de soin : +X énergie instant (REFONTE v5)
        const maxFatigue = (profile.fatigue_max || 20) + (profile.energy_max_bonus_value || 0);
        updates.fatigue = Math.min(maxFatigue, (profile.fatigue ?? 20) + (itemDef.value || 5));
        if (itemDef.xp_reward) updates.player_xp_total = (profile.player_xp_total || 0) + itemDef.xp_reward;
      } else if (itemDef.effect === "hp_restore") {
        // Cataplasme : +X PV instant (utilisable hors combat ou avant combat de biome)
        // Ne fonctionne pas si le joueur est KO (il doit attendre la fin du KO).
        if (isPlayerKO(profile)) {
          toast.error("Vous êtes KO, le cataplasme ne peut pas vous soigner. Reposez-vous.");
          setActivating(null);
          return;
        }
        const currentHp = getPlayerHP(profile);
        if (currentHp >= COMBAT_MAX_HP) {
          toast.info("Vos PV sont déjà au maximum.");
          setActivating(null);
          return;
        }
        updates.hp = Math.min(COMBAT_MAX_HP, currentHp + (itemDef.value || 5));
        if (itemDef.xp_reward) updates.player_xp_total = (profile.player_xp_total || 0) + itemDef.xp_reward;
      } else if (itemDef.effect === "housing_maintenance") {
        const expires15 = new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0];
        updates.meuble_expires_at = expires15;
        updates.meuble_discount   = itemDef.value || 0.50;
      } else if (itemDef.effect === "quest_activate") {
        updates.active_parchemin_type = itemDef.parchemin_type;
      }

      // Biome harvest bonus T1
      if (itemDef.biome_profession && itemDef.biome_key) {
        if (isBiomeBuffActive(profile)) {
          activateBiomeHarvestBonus(updates);  // +5 min de récolte +1
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

      // V6.1.7 — Trace dans le journal d'or (vente à la mairie : sortie trésorerie)
      await logGold(
        profile.user_email, profile.character_name,
        city.id, city.name,
        LINGOT_ROYAL_PRICE, "vente_lingot",
        `Vente lingot royal à la mairie de ${city.name}`
      );
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
                — Activez pour +{XP_PER_RARE_RESOURCE} XP
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
                      <div className="text-xs text-muted-foreground font-body">×{item.quantity} · {rare.biome_name}</div>
                    </div>
                    <button
                      onClick={() => handleActivateRare(item.item_key)}
                      disabled={activating === item.item_key}
                      className="text-xs bg-violet-100 hover:bg-violet-200 border border-violet-300 text-violet-700 px-2 py-0.5 rounded font-body transition-colors shrink-0"
                    >
                      {activating === item.item_key ? "..." : `+${XP_PER_RARE_RESOURCE} XP`}
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
                const maxHungerVal = getMaxHunger(profile, cityHungerBonus);
                const canEat = hungerDef && currentHunger < maxHungerVal;
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
                      <div className="font-semibold">{getItemName(item.item_key, item.item_name)}</div>
                      <div className="text-xs text-muted-foreground">{data?.use || "Vendable sur le marché"}</div>
                      {item.durability !== undefined && (() => {
                        const maxDur = EQUIPMENT_DURABILITY?.[item.item_key] ?? EQUIPMENT_MAX_DURABILITY;
                        return <div className="text-xs text-slate-500 mt-0.5">🛡️ Durabilité : {item.durability}/{maxDur}</div>;
                      })()}
                      {item.item_key === "bourse_protection" && (() => {
                        const usesLeft = profile.bourse_uses_left ?? 5;
                        return <div className="text-xs text-yellow-700 mt-0.5">👜 Charges : {usesLeft}/5 attaque{usesLeft > 1 ? "s" : ""}</div>;
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
                      {canEat && (
                        <button onClick={() => setConfirmConsume({ type: "eatForHunger", key: item.item_key, def: { name: item.item_name, icon: ITEMS[item.item_key]?.icon } })}
                          disabled={consumingFood === item.item_key + "_hunger"}
                          className="text-xs bg-orange-100 hover:bg-orange-200 border border-orange-300 text-orange-800 px-2 py-0.5 rounded font-body transition-colors">
                          Manger
                        </button>
                      )}

                      {/* Meuble */}
                      {isMeuble && !meubleActive && (
                        <button onClick={() => setConfirmConsume({ type: "meuble", key: item.item_key, def: { name: "Meuble", icon: "🪑" } })}
                          className="text-xs bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 px-2 py-0.5 rounded font-body transition-colors">
                          🪑 Installer
                        </button>
                      )}

                      {/* Effets temporaires */}
                      {tempDef && !isMeuble && (
                        <button onClick={() => setConfirmConsume({ type: "temp", key: item.item_key, def: tempDef })}
                          disabled={activating === item.item_key}
                          className="text-xs bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 text-indigo-900 px-2 py-0.5 rounded font-body transition-colors">
                          {activating === item.item_key ? "..." : `✨ ${tempDef.label}`}
                        </button>
                      )}

                      {/* Contrats */}
                      {isContrat && (
                        <button onClick={() => setConfirmConsume({ type: "contrat", key: item.item_key, def: { name: ITEMS[item.item_key]?.name || item.item_key, icon: ITEMS[item.item_key]?.icon || "📜" } })}
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

      {/* ── Modal de confirmation avant consommation/activation d'objet ── */}
      {confirmConsume && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border-2 border-primary/30 rounded-lg shadow-2xl max-w-sm w-full p-4 space-y-3">
            <h3 className="font-heading text-lg flex items-center gap-2">
              <span className="text-2xl">{confirmConsume.def?.icon || "❓"}</span>
              <span>Confirmer ?</span>
            </h3>
            <p className="text-sm font-body">
              {confirmConsume.type === "eatForHunger" && <>Voulez-vous manger <strong>{confirmConsume.def.name}</strong> pour récupérer de la faim ?</>}
              {confirmConsume.type === "meuble" && <>Voulez-vous installer le <strong>Meuble</strong> dans votre logement ? <br /><span className="text-xs text-muted-foreground">Réduit les frais de logement de 50% pendant 10 jours.</span></>}
              {confirmConsume.type === "temp" && <>Voulez-vous activer <strong>{confirmConsume.def.label || confirmConsume.def.name}</strong> ?</>}
              {confirmConsume.type === "contrat" && <>Voulez-vous activer <strong>{confirmConsume.def.name}</strong> ?<br /><span className="text-xs text-muted-foreground">Cette action est irréversible.</span></>}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setConfirmConsume(null)}
                className="text-sm font-heading px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  const c = confirmConsume;
                  setConfirmConsume(null);
                  if (c.type === "eatForHunger") await handleEatForHunger(c.key);
                  else if (c.type === "meuble") await handleActivateMeuble();
                  else if (c.type === "temp") await handleConsumeTempEffect(c.def);
                  else if (c.type === "contrat") await handleActivateContrat(c.key);
                }}
                className="text-sm font-heading px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}