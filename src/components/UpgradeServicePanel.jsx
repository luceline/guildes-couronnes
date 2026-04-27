/**
 * UpgradeServicePanel — Affiche les services d'amélioration d'un artisan
 * (Bûcheron ou Mineur) précis, vu côté client.
 *
 * Affiché dans CityView après AtelierCommande quand on consulte la fiche
 * d'un Bûcheron ou Mineur. Permet au client d'améliorer ses items combat
 * en payant l'artisan.
 *
 * Si le client est lui-même artisan de la même profession, le service
 * s'applique à lui-même (ne devrait normalement pas s'afficher dans ce cas
 * vu qu'on consulte la fiche d'un AUTRE joueur, mais on garde le check).
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  COMBAT_UPGRADE_ATK_ITEMS,
  COMBAT_UPGRADE_DEF_ITEMS,
  COMBAT_UPGRADE_COOLDOWN_SEC,
  COMBAT_UPGRADE_ARTISAN_SHARE,
  COMBAT_MAX_GRADE,
  COMBAT_SLOT_INFO,
  getCombatItemValue,
  getCombatUpgradeCost,
  applyRandomActionCost,
} from "../lib/gameData";
import { ITEMS } from "../lib/craftingData";
import { logGold } from "@/lib/goldLog";

const DEFAULT_UPGRADE_PRICE = 5;

export default function UpgradeServicePanel({ producer, clientProfile, city, onRefresh }) {
  const [busy, setBusy] = useState(false);

  if (!producer || !clientProfile || !city) return null;
  const isBucheron = producer.profession === "Bûcheron";
  const isMineur   = producer.profession === "Mineur";
  if (!isBucheron && !isMineur) return null;

  const type = isBucheron ? "atk" : "def";
  const itemKeys = type === "atk" ? COMBAT_UPGRADE_ATK_ITEMS : COMBAT_UPGRADE_DEF_ITEMS;
  const goldCost = (producer.upgrade_price === undefined || producer.upgrade_price === null)
    ? DEFAULT_UPGRADE_PRICE
    : producer.upgrade_price;

  // Auto-service si client === producer (même joueur, même profession) → gratuit
  const isSelf = clientProfile.id === producer.id;
  const effectiveCost = isSelf ? 0 : goldCost;

  // Items du client améliorables
  const getUpgradableItems = () => {
    const result = [];
    const eq = clientProfile.equipment || {};
    for (const slot of Object.keys(eq)) {
      const item = eq[slot];
      if (!item) continue;
      const def = ITEMS[item.item_key];
      if (!def || !itemKeys.includes(item.item_key)) continue;
      if ((item.grade ?? 0) >= COMBAT_MAX_GRADE) continue;
      result.push({ source: "equipped", slot, item_key: item.item_key, grade: item.grade ?? 0, def });
    }
    const inv = clientProfile.inventory || [];
    for (const invItem of inv) {
      if (!itemKeys.includes(invItem.item_key)) continue;
      if ((invItem.quantity || 0) <= 0) continue;
      const def = ITEMS[invItem.item_key];
      if (!def) continue;
      const grade = invItem.grade ?? 0;
      if (grade >= COMBAT_MAX_GRADE) continue;
      result.push({ source: "inventory", item_key: invItem.item_key, grade, quantity: invItem.quantity, def });
    }
    return result;
  };

  const upgradable = getUpgradableItems();

  const hasResources = (cost) => {
    const inv = clientProfile.inventory || [];
    const has = (key, qty) => {
      const found = inv.find(i => i.item_key === key);
      return (found?.quantity || 0) >= qty;
    };
    if (cost.primary && !has(cost.primary.key, cost.primary.qty)) return false;
    if (cost.secondary && !has(cost.secondary.key, cost.secondary.qty)) return false;
    if (cost.tertiary && !has(cost.tertiary.key, cost.tertiary.qty)) return false;
    return true;
  };

  const handleUpgrade = async (target) => {
    const cost = getCombatUpgradeCost(type, target.grade);
    if (!cost) {
      toast.error("Item déjà au grade maximum.");
      return;
    }
    if (!isSelf && (clientProfile.gold || 0) < effectiveCost) {
      toast.error(`Il faut ${effectiveCost}💰 pour cette amélioration.`);
      return;
    }
    if (!hasResources(cost)) {
      toast.error("Ressources insuffisantes.");
      return;
    }
    const cdKey = `upgrade_${type}_${target.item_key}`;
    const nextAvailable = clientProfile.production_cooldowns?.[cdKey];
    if (nextAvailable && new Date(nextAvailable) > new Date()) {
      const sec = Math.ceil((new Date(nextAvailable) - new Date()) / 1000);
      toast.error(`Atelier en activité — patientez ${sec}s.`);
      return;
    }

    setBusy(true);
    try {
      // 1. Consomme ressources + or
      let newInv = (clientProfile.inventory || []).map(i => ({ ...i }));
      const consumeFromInv = (key, qty) => {
        const idx = newInv.findIndex(i => i.item_key === key);
        if (idx >= 0) {
          newInv[idx].quantity = (newInv[idx].quantity || 0) - qty;
          if (newInv[idx].quantity <= 0) newInv.splice(idx, 1);
        }
      };
      consumeFromInv(cost.primary.key, cost.primary.qty);
      if (cost.secondary) consumeFromInv(cost.secondary.key, cost.secondary.qty);
      if (cost.tertiary) consumeFromInv(cost.tertiary.key, cost.tertiary.qty);

      // 2. Upgrade item
      const newGrade = target.grade + 1;
      const updates = {
        gold: (clientProfile.gold || 0) - effectiveCost,
        inventory: newInv,
      };
      const cost1 = applyRandomActionCost(clientProfile);
      if (cost1) Object.assign(updates, cost1);

      if (target.source === "equipped") {
        const newEquipment = { ...(clientProfile.equipment || {}) };
        newEquipment[target.slot] = { ...newEquipment[target.slot], grade: newGrade };
        updates.equipment = newEquipment;
      } else {
        const idx = newInv.findIndex(i => i.item_key === target.item_key && (i.grade ?? 0) === target.grade);
        if (idx >= 0) {
          newInv[idx].quantity = (newInv[idx].quantity || 0) - 1;
          if (newInv[idx].quantity <= 0) newInv.splice(idx, 1);
        }
        const upgradedIdx = newInv.findIndex(i => i.item_key === target.item_key && (i.grade ?? 0) === newGrade);
        if (upgradedIdx >= 0) {
          newInv[upgradedIdx].quantity = (newInv[upgradedIdx].quantity || 0) + 1;
        } else {
          newInv.push({
            item_key: target.item_key,
            item_name: target.def.name,
            item_category: target.def.category || "",
            quantity: 1,
            grade: newGrade,
          });
        }
      }

      // 3. Cooldown
      const cdSec = COMBAT_UPGRADE_COOLDOWN_SEC[target.grade];
      const newCds = { ...(clientProfile.production_cooldowns || {}) };
      newCds[cdKey] = new Date(Date.now() + cdSec * 1000).toISOString();
      updates.production_cooldowns = newCds;

      await base44.entities.PlayerProfile.update(clientProfile.id, updates);

      // 4. Verser à l'artisan + ville (sauf auto-service)
      if (!isSelf && effectiveCost > 0) {
        const artisanShare = Math.floor(effectiveCost * COMBAT_UPGRADE_ARTISAN_SHARE);
        const cityShare = effectiveCost - artisanShare;
        try {
          const freshArtisan = await base44.entities.PlayerProfile.get(producer.id);
          await base44.entities.PlayerProfile.update(producer.id, { gold: (freshArtisan.gold || 0) + artisanShare });
          const freshCity = await base44.entities.City.get(city.id);
          await base44.entities.City.update(city.id, {
            gold_treasury: (freshCity.gold_treasury || 0) + cityShare,
            treasury_cumulative: (freshCity.treasury_cumulative || 0) + cityShare,
          });
          await base44.entities.GoldTransaction.create({
            player_email: clientProfile.user_email,
            player_name: clientProfile.character_name || "",
            city_id: city.id,
            city_name: city.name || "",
            amount: -effectiveCost,
            type: "amelioration_combat",
            description: `Amélioration ${target.def.name} grade ${target.grade}→${newGrade} chez ${producer.character_name}`,
          });
          await logGold?.(clientProfile, -effectiveCost, "amelioration_combat");
        } catch (e) { console.error("Verse artisan/ville", e); }
      }

      toast.success(isSelf
        ? `✅ ${target.def.name} amélioré au grade ${newGrade} (auto-service gratuit) !`
        : `✅ ${target.def.name} amélioré au grade ${newGrade} chez ${producer.character_name} !`);
      onRefresh?.();
    } catch (e) {
      console.error("Erreur upgrade", e);
      toast.error("Erreur lors de l'amélioration.");
    } finally {
      setBusy(false);
    }
  };

  const cardTitle = isBucheron
    ? `🪓 Atelier d'amélioration — ${producer.character_name || producer.user_email}`
    : `⛏️ Atelier d'amélioration — ${producer.character_name || producer.user_email}`;
  const itemsType = type === "atk" ? "armes" : "armures";

  return (
    <Card className="border-amber-300 mt-3">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-sm flex items-center gap-2 flex-wrap">
          {cardTitle}
          {isSelf ? (
            <Badge className="bg-green-100 text-green-800 border-green-300 font-heading">Auto-service gratuit</Badge>
          ) : (
            <Badge variant="secondary" className="font-heading">{goldCost}💰 / amélioration</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs font-body text-muted-foreground">
          {isSelf
            ? `Vous pouvez améliorer vos propres ${itemsType} gratuitement (juste les ressources).`
            : `${producer.character_name || "Cet artisan"} améliore vos ${itemsType} pour ${goldCost}💰 (${Math.round(COMBAT_UPGRADE_ARTISAN_SHARE * 100)}% pour ${producer.character_name || "lui"}, ${Math.round((1 - COMBAT_UPGRADE_ARTISAN_SHARE) * 100)}% pour le trésor de la ville).`
          }
        </p>

        {upgradable.length === 0 ? (
          <p className="text-xs font-body text-muted-foreground italic">
            Vous n'avez pas d'item {type === "atk" ? "d'attaque" : "de défense"} à améliorer (ni équipé, ni en inventaire).
          </p>
        ) : (
          <div className="space-y-1.5">
            {upgradable.map((target, idx) => {
              const cost = getCombatUpgradeCost(type, target.grade);
              const canPay = (clientProfile.gold || 0) >= effectiveCost;
              const canResources = hasResources(cost);
              const cdKey = `upgrade_${type}_${target.item_key}`;
              const cdUntil = clientProfile.production_cooldowns?.[cdKey];
              const cdActive = cdUntil && new Date(cdUntil) > new Date();
              const cdSec = cdActive ? Math.ceil((new Date(cdUntil) - new Date()) / 1000) : 0;
              const disabled = busy || !canPay || !canResources || cdActive;
              const slotInfo = target.slot ? COMBAT_SLOT_INFO[target.slot] : null;

              return (
                <div key={`${target.item_key}-${target.grade}-${idx}`} className="border rounded-lg p-2 space-y-1 bg-card">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs font-body">
                      <span>{target.def.icon}</span>
                      <span className="font-heading">{target.def.name}</span>
                      <Badge variant="outline" className="text-xs h-4 px-1.5 font-body">Grade {target.grade}</Badge>
                      {target.source === "equipped" && (
                        <Badge variant="secondary" className="text-xs h-4 px-1.5">📌 équipé {slotInfo?.zone}</Badge>
                      )}
                      <span className="text-muted-foreground">→ Grade {target.grade + 1} (+{getCombatItemValue(target.grade + 1)})</span>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 text-xs font-heading"
                      onClick={() => handleUpgrade(target)}
                      disabled={disabled}
                    >
                      {cdActive ? `⏳ ${cdSec}s` : busy ? "..." : isSelf ? "Améliorer (gratuit)" : `Améliorer ${effectiveCost}💰`}
                    </Button>
                  </div>
                  <div className="text-xs font-body text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className={canResources ? "" : "text-red-600"}>
                      🧱 {cost.primary.qty}× {ITEMS[cost.primary.key]?.name || cost.primary.key}
                    </span>
                    {cost.secondary && (
                      <span className={canResources ? "" : "text-red-600"}>
                        + {cost.secondary.qty}× {ITEMS[cost.secondary.key]?.name || cost.secondary.key}
                      </span>
                    )}
                    {cost.tertiary && (
                      <span className={canResources ? "" : "text-red-600"}>
                        + {cost.tertiary.qty}× {ITEMS[cost.tertiary.key]?.name || cost.tertiary.key}
                      </span>
                    )}
                    <span className="text-muted-foreground/70">⏱️ {COMBAT_UPGRADE_COOLDOWN_SEC[target.grade]}s</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
