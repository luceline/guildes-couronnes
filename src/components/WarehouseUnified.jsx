import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ITEM_CATEGORIES } from "../lib/gameData";
import { ITEMS as GAME_ITEMS } from "../lib/craftingData";

const WAREHOUSE_LABELS = {
  bois_brut:   "Bois brut",
  pierre:      "Pierre",
  minerai_fer: "Minerai de fer",
  ble:         "Blé",
  laine_brute: "Laine brute",
  herbes:      "Herbes",
  quartz_brut: "Quartz brut",
  or:          "Or",
};
import { base44 } from "@/api/base44Client";
import { QUEST_TEMPLATES } from "../lib/objectiveGenerator";
import { toast } from "sonner";

const T1_ITEMS = [
  { key: "bois_brut",   name: "Bois brut",      icon: "🪵" },
  { key: "pierre",      name: "Pierre",         icon: "🪨" },
  { key: "minerai_fer", name: "Minerai de fer", icon: "⚙️" },
  { key: "ble",         name: "Blé",            icon: "🌾" },
  { key: "laine_brute", name: "Laine brute",    icon: "🐑" },
  { key: "herbes",      name: "Herbes",         icon: "🌿" },
  { key: "quartz_brut", name: "Quartz brut",    icon: "🔮" },
];

const T2_ITEMS = [
  { key: "planches",     name: "Planches",       icon: "🏗️", tier: 2 },
  { key: "pierre_brute", name: "Pierre brute",   icon: "🪨", tier: 2 },
  { key: "fil",          name: "Fil",            icon: "🧵", tier: 2 },
  { key: "charbon",      name: "Charbon",        icon: "⚫", tier: 2 },
  { key: "extrait",      name: "Extrait",        icon: "💎", tier: 2 },
  { key: "quartz_poli",  name: "Quartz poli",    icon: "✨", tier: 2 },
  { key: "encre",        name: "Encre",          icon: "🖋️", tier: 2 },
  { key: "farine",       name: "Farine",         icon: "🌾", tier: 2 },
];

const T3_ITEMS = [
  { key: "meuble",        name: "Meuble",         icon: "🪑", tier: 3 },
  { key: "lingots_fer",   name: "Lingots fer",    icon: "⚔️", tier: 3 },
  { key: "tissu",         name: "Tissu",          icon: "🧵", tier: 3 },
  { key: "pain",          name: "Pain",           icon: "🍞", tier: 3 },
  { key: "potion_soin",   name: "Potion soin",    icon: "🧪", tier: 3 },
  { key: "lingot_royal",  name: "Lingot royal",   icon: "👑", tier: 3 },
  { key: "lingots_or",    name: "Lingots or",     icon: "💛", tier: 3 },
  { key: "parchemin",     name: "Parchemin",      icon: "📜", tier: 3 },
  { key: "contrat_artisan", name: "Contrat artisan", icon: "📋", tier: 3 },
];

export default function WarehouseUnified({
  city,
  profile,
  isHomeCity,
  contributing,
  setContributing,
  depositObjectives,
  logGold,
  onRefresh,
}) {
  const [selectedTier, setSelectedTier] = useState("t1");
  const [amounts, setAmounts] = useState({});

  const warehouse = city.warehouse || {};
  const dailyMaintenance = city?.maintenance_daily || {};

  const getTierItems = () => {
    if (selectedTier === "t1") return T1_ITEMS;
    if (selectedTier === "t2") return T2_ITEMS;
    return T3_ITEMS;
  };

  const handleDepositT1 = async (itemKey, qty, isSale = false) => {
    const isGold = itemKey === "or";

    if (isGold) {
      if ((profile.gold || 0) < qty) { toast.error("Votre bourse est vide — il vous manque de l'or pour ce dépôt."); return; }
    } else {
      const invItem = (profile.inventory || []).find(i => i.item_key === itemKey);
      if (!invItem || invItem.quantity < qty) { toast.error(`Vous n'avez pas assez de ${WAREHOUSE_LABELS[itemKey]}.`); return; }
    }

    const offers = city.rachat_t1_offers || {};
    const offer = offers[itemKey];
    const hasOffer = offer && offer.price > 0 && offer.qty_max > 0;

    // Mode vente avec offre
    if (isSale && hasOffer) {
      const pricePerUnit = offer.price;
      const totalGold = qty * pricePerUnit;
      if ((city.gold_treasury || 0) < totalGold) {
        toast.error("🏦 Les coffres de la ville sont à sec — la mairie ne peut honorer cette offre."); return;
      }
      const boughtToday = (city.rachat_t1_bought_today || {})[itemKey] || 0;
      if (boughtToday >= offer.qty_max) {
        toast.error(`📦 Le quota journalier de ${itemKey} est épuisé — la ville ne rachète plus rien de ce genre aujourd'hui.`); return;
      }
      const actualQty = Math.min(qty, offer.qty_max - boughtToday);
      const actualGold = actualQty * pricePerUnit;

      const newInv = isGold
        ? (profile.inventory || [])
        : (profile.inventory || [])
          .map(i => i.item_key === itemKey ? { ...i, quantity: i.quantity - actualQty } : i)
          .filter(i => i.quantity > 0);
      const newWarehouse = { ...(warehouse || {}), [itemKey]: ((warehouse?.[itemKey]) || 0) + actualQty };
      const newBought = { ...(city.rachat_t1_bought_today || {}), [itemKey]: boughtToday + actualQty };

      try {
        setContributing(true);
        await Promise.all([
          base44.entities.City.update(city.id, {
            warehouse: newWarehouse,
            gold_treasury: (city.gold_treasury || 0) - actualGold,
            rachat_t1_bought_today: newBought,
          }),
          base44.entities.PlayerProfile.update(profile.id, {
            gold: (profile.gold || 0) + (isGold ? -actualQty + actualGold : actualGold),
            inventory: isGold ? newInv : newInv,
            cumul_ventes_or: (profile.cumul_ventes_or || 0) + actualGold,
            cumul_contributions_warehouse: (profile.cumul_contributions_warehouse || 0) + actualQty,
          }),
        ]);
        await logGold(profile.user_email, profile.character_name, city.id, city.name,
          actualGold, "rachat_entrepot", `Vente entrepôt T1 : ${actualQty}× ${itemKey}`);
        toast.success(`🤝 Marché conclu ! ${actualQty}× ${itemKey} livrés à la ville contre ${actualGold}💰.`);

        if (isHomeCity) for (const obj of depositObjectives) {
          if (obj.target_item === itemKey) {
            const newQty = (obj.current_quantity || 0) + actualQty;
            const completed = newQty >= obj.target_quantity;
            await base44.entities.PlayerObjective.update(obj.id, {
              current_quantity: newQty,
              status: completed ? "completed" : "active",
            });
            if (completed) {
              const reward = obj.reward_gold || QUEST_TEMPLATES[obj.type]?.defaultReward || 7; // fallback si reward_gold absent en base
              if (reward > 0) {
                const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
                const currentGold = freshP ? (freshP.gold || 0) : (profile.gold || 0);
                await base44.entities.PlayerProfile.update(profile.id, { gold: currentGold + reward });
              }
              toast.success(`🎉 Quête accomplie : ${obj.title}${reward > 0 ? ` +${reward} 💰` : ""} !`);
            }
          }
        }

        // ── Valider les quêtes "contribute" ──
        try {
          const todayStr = new Date().toISOString().split("T")[0];
          const allContrib = await base44.entities.PlayerObjective.filter({
            player_email: profile.user_email,
            status: "active",
            type: "contribute",
          });
          const contributeObjs = allContrib.filter(o => (o.created_date || o.quest_date || "").startsWith(todayStr));
          if (!isHomeCity) for (const obj of contributeObjs) {
            if (obj.target_item === itemKey) {
              const newQty = (obj.current_quantity || 0) + actualQty;
              const completed = newQty >= obj.target_quantity;
              await base44.entities.PlayerObjective.update(obj.id, {
                current_quantity: newQty,
                status: completed ? "completed" : "active",
              });
              if (completed) {
                const reward = obj.reward_gold || QUEST_TEMPLATES[obj.type]?.defaultReward || 7; // fallback si reward_gold absent en base
                if (reward > 0) {
                  const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
                  const currentGold = freshP ? (freshP.gold || 0) : (profile.gold || 0);
                  await base44.entities.PlayerProfile.update(profile.id, { gold: currentGold + reward });
                }
                toast.success(`🎉 Quête accomplie : ${obj.title}${reward > 0 ? ` +${reward} 💰` : ""} !`);
              }
            }
          }
        } catch(e) { console.warn("contributeObjective:", e); }

        onRefresh?.();
      } finally {
        setContributing(false);
      }
    } else {
      // Mode dépôt libre
      const newInv = isGold
        ? (profile.inventory || [])
        : (profile.inventory || [])
          .map(i => i.item_key === itemKey ? { ...i, quantity: i.quantity - qty } : i)
          .filter(i => i.quantity > 0);
      const newWarehouse = isGold
        ? { ...(warehouse || {}) }  // l'or va en trésorerie, pas dans warehouse
        : { ...(warehouse || {}), [itemKey]: ((warehouse?.[itemKey]) || 0) + qty };

      try {
        setContributing(true);
        await Promise.all([
          base44.entities.City.update(city.id, {
            warehouse: newWarehouse,
            ...(isGold ? { gold_treasury: (city.gold_treasury || 0) + qty, treasury_cumulative: (city.treasury_cumulative || 0) + qty } : {}),
          }),
          base44.entities.PlayerProfile.update(profile.id, {
            gold: isGold ? (profile.gold || 0) - qty : (profile.gold || 0),
            inventory: isGold ? (profile.inventory || []) : newInv,
            cumul_contributions_warehouse: (profile.cumul_contributions_warehouse || 0) + qty,
          })
        ]);
        toast.success(isGold
          ? `💰 ${qty} or versé à la trésorerie de la ville — la ville vous remercie !`
          : `📦 ${qty}× ${WAREHOUSE_LABELS[itemKey]} versé(e)s à l'entrepôt communautaire — la ville vous remercie !`
        );

        if (isHomeCity) for (const obj of depositObjectives) {
          if (obj.target_item === itemKey) {
            const newQty = (obj.current_quantity || 0) + qty;
            const completed = newQty >= obj.target_quantity;
            await base44.entities.PlayerObjective.update(obj.id, {
              current_quantity: newQty,
              status: completed ? "completed" : "active",
            });
            if (completed) {
              const reward = obj.reward_gold || QUEST_TEMPLATES[obj.type]?.defaultReward || 7; // fallback si reward_gold absent en base
              if (reward > 0) {
                const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
                const currentGold = freshP ? (freshP.gold || 0) : (profile.gold || 0);
                await base44.entities.PlayerProfile.update(profile.id, { gold: currentGold + reward });
              }
              toast.success(`🎉 Quête accomplie : ${obj.title}${reward > 0 ? ` +${reward} 💰` : ""} !`);
            }
          }
        }

        // ── Valider les quêtes "contribute" ──
        try {
          const todayStr = new Date().toISOString().split("T")[0];
          const allContrib = await base44.entities.PlayerObjective.filter({
            player_email: profile.user_email,
            status: "active",
            type: "contribute",
          });
          const contributeObjs = allContrib.filter(o => (o.created_date || o.quest_date || "").startsWith(todayStr));
          if (!isHomeCity) for (const obj of contributeObjs) {
            if (obj.target_item === itemKey) {
              const newQty = (obj.current_quantity || 0) + qty;
              const completed = newQty >= obj.target_quantity;
              await base44.entities.PlayerObjective.update(obj.id, {
                current_quantity: newQty,
                status: completed ? "completed" : "active",
              });
              if (completed) {
                const reward = obj.reward_gold || QUEST_TEMPLATES[obj.type]?.defaultReward || 7; // fallback si reward_gold absent en base
                if (reward > 0) {
                  const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
                  const currentGold = freshP ? (freshP.gold || 0) : (profile.gold || 0);
                  await base44.entities.PlayerProfile.update(profile.id, { gold: currentGold + reward });
                }
                toast.success(`🎉 Quête accomplie : ${obj.title}${reward > 0 ? ` +${reward} 💰` : ""} !`);
              }
            }
          }
        } catch(e) { console.warn("contributeObjective:", e); }

        onRefresh?.();
      } finally {
        setContributing(false);
      }
    }
  };

  const handleDepositT2T3 = async (itemKey, qty, isSale = false) => {
    const invItem = (profile.inventory || []).find(i => i.item_key === itemKey);
    if (!invItem || invItem.quantity < qty) {
      toast.error(`Votre besace est insuffisante en ${itemKey} — récoltez davantage avant de revenir.`); return;
    }

    const offers = city.rachat_t2t3_offers || {};
    const offer = offers[itemKey];
    const hasOffer = offer && offer.price > 0 && offer.qty_max > 0;

    // Mode vente avec offre
    if (isSale && hasOffer) {
      const pricePerUnit = offer.price;
      const totalGold = qty * pricePerUnit;
      if ((city.gold_treasury || 0) < totalGold) {
        toast.error("🏦 Les coffres de la ville sont à sec — la mairie ne peut honorer cette offre."); return;
      }
      const boughtToday = city.rachat_t2t3_bought_today || {};
      const alreadyBought = boughtToday[itemKey] || 0;
      if (alreadyBought >= offer.qty_max) {
        toast.error(`📦 Le quota journalier de ${itemKey} est épuisé — la ville ne rachète plus rien de ce genre aujourd'hui.`); return;
      }
      const actualQty = Math.min(qty, offer.qty_max - alreadyBought);
      const actualGold = actualQty * pricePerUnit;

      const newInv = (profile.inventory || [])
        .map(i => i.item_key === itemKey ? { ...i, quantity: i.quantity - actualQty } : i)
        .filter(i => i.quantity > 0);
      const newWarehouse = { ...(warehouse || {}), [itemKey]: ((warehouse?.[itemKey]) || 0) + actualQty };
      const newBought = { ...boughtToday, [itemKey]: alreadyBought + actualQty };

      try {
        setContributing(true);
        await Promise.all([
          base44.entities.City.update(city.id, {
            warehouse: newWarehouse,
            gold_treasury: (city.gold_treasury || 0) - actualGold,
            rachat_t2t3_bought_today: newBought,
          }),
          base44.entities.PlayerProfile.update(profile.id, {
            gold: (profile.gold || 0) + actualGold,
            inventory: newInv,
            cumul_ventes_or: (profile.cumul_ventes_or || 0) + actualGold,
            cumul_contributions_warehouse: (profile.cumul_contributions_warehouse || 0) + actualQty,
          }),
        ]);
        await logGold(profile.user_email, profile.character_name, city.id, city.name,
          actualGold, "rachat_t2t3", `Vente entrepôt T2/T3 : ${actualQty}× ${itemKey}`);
        toast.success(`🤝 Marché conclu ! ${actualQty}× ${itemKey} livrés à la ville contre ${actualGold}💰.`);

        if (isHomeCity) for (const obj of depositObjectives) {
          if (obj.target_item === itemKey) {
            const newQty = (obj.current_quantity || 0) + actualQty;
            const completed = newQty >= obj.target_quantity;
            await base44.entities.PlayerObjective.update(obj.id, {
              current_quantity: newQty,
              status: completed ? "completed" : "active",
            });
            if (completed) {
              const reward = obj.reward_gold || QUEST_TEMPLATES[obj.type]?.defaultReward || 7; // fallback si reward_gold absent en base
              if (reward > 0) {
                const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
                const currentGold = freshP ? (freshP.gold || 0) : (profile.gold || 0);
                await base44.entities.PlayerProfile.update(profile.id, { gold: currentGold + reward });
              }
              toast.success(`🎉 Quête accomplie : ${obj.title}${reward > 0 ? ` +${reward} 💰` : ""} !`);
            }
          }
        }

        // ── Valider les quêtes "contribute" ──
        try {
          const todayStr = new Date().toISOString().split("T")[0];
          const allContrib = await base44.entities.PlayerObjective.filter({
            player_email: profile.user_email,
            status: "active",
            type: "contribute",
          });
          const contributeObjs = allContrib.filter(o => (o.created_date || o.quest_date || "").startsWith(todayStr));
          if (!isHomeCity) for (const obj of contributeObjs) {
            if (obj.target_item === itemKey) {
              const newQty = (obj.current_quantity || 0) + actualQty;
              const completed = newQty >= obj.target_quantity;
              await base44.entities.PlayerObjective.update(obj.id, {
                current_quantity: newQty,
                status: completed ? "completed" : "active",
              });
              if (completed) {
                const reward = obj.reward_gold || QUEST_TEMPLATES[obj.type]?.defaultReward || 7; // fallback si reward_gold absent en base
                if (reward > 0) {
                  const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
                  const currentGold = freshP ? (freshP.gold || 0) : (profile.gold || 0);
                  await base44.entities.PlayerProfile.update(profile.id, { gold: currentGold + reward });
                }
                toast.success(`🎉 Quête accomplie : ${obj.title}${reward > 0 ? ` +${reward} 💰` : ""} !`);
              }
            }
          }
        } catch(e) { console.warn("contributeObjective:", e); }

        onRefresh?.();
      } finally {
        setContributing(false);
      }
    } else {
      // Mode dépôt libre (sans offre ou pas de vente)
      const newInv = (profile.inventory || [])
        .map(i => i.item_key === itemKey ? { ...i, quantity: i.quantity - qty } : i)
        .filter(i => i.quantity > 0);
      const newWarehouse = { ...(warehouse || {}), [itemKey]: ((warehouse?.[itemKey]) || 0) + qty };

      try {
        setContributing(true);
        await Promise.all([
          base44.entities.City.update(city.id, {
            warehouse: newWarehouse,
          }),
          base44.entities.PlayerProfile.update(profile.id, {
            inventory: newInv,
            cumul_contributions_warehouse: (profile.cumul_contributions_warehouse || 0) + qty,
          }),
        ]);
        toast.success(`📦 ${qty}× ${itemKey} versé(e)s à l'entrepôt — les bâtiments de la ville vous en seront reconnaissants !`);

        if (isHomeCity) for (const obj of depositObjectives) {
          if (obj.target_item === itemKey) {
            const newQty = (obj.current_quantity || 0) + qty;
            const completed = newQty >= obj.target_quantity;
            await base44.entities.PlayerObjective.update(obj.id, {
              current_quantity: newQty,
              status: completed ? "completed" : "active",
            });
            if (completed) {
              const reward = obj.reward_gold || QUEST_TEMPLATES[obj.type]?.defaultReward || 7; // fallback si reward_gold absent en base
              if (reward > 0) {
                const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
                const currentGold = freshP ? (freshP.gold || 0) : (profile.gold || 0);
                await base44.entities.PlayerProfile.update(profile.id, { gold: currentGold + reward });
              }
              toast.success(`🎉 Quête accomplie : ${obj.title}${reward > 0 ? ` +${reward} 💰` : ""} !`);
            }
          }
        }

        // ── Valider les quêtes "contribute" ──
        try {
          const todayStr = new Date().toISOString().split("T")[0];
          const allContrib = await base44.entities.PlayerObjective.filter({
            player_email: profile.user_email,
            status: "active",
            type: "contribute",
          });
          const contributeObjs = allContrib.filter(o => (o.created_date || o.quest_date || "").startsWith(todayStr));
          if (!isHomeCity) for (const obj of contributeObjs) {
            if (obj.target_item === itemKey) {
              const newQty = (obj.current_quantity || 0) + qty;
              const completed = newQty >= obj.target_quantity;
              await base44.entities.PlayerObjective.update(obj.id, {
                current_quantity: newQty,
                status: completed ? "completed" : "active",
              });
              if (completed) {
                const reward = obj.reward_gold || QUEST_TEMPLATES[obj.type]?.defaultReward || 7; // fallback si reward_gold absent en base
                if (reward > 0) {
                  const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
                  const currentGold = freshP ? (freshP.gold || 0) : (profile.gold || 0);
                  await base44.entities.PlayerProfile.update(profile.id, { gold: currentGold + reward });
                }
                toast.success(`🎉 Quête accomplie : ${obj.title}${reward > 0 ? ` +${reward} 💰` : ""} !`);
              }
            }
          }
        } catch(e) { console.warn("contributeObjective:", e); }

        onRefresh?.();
      } finally {
        setContributing(false);
      }
    }
  };

  const items = getTierItems();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg flex items-center gap-2">📦 Entrepôt - Dépôts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtre tier */}
        <div className="flex gap-2">
          {[
            { value: "t1", label: "T1 - Brutes" },
            { value: "t2", label: "T2 - Travaillées" },
            { value: "t3", label: "T3 - Finies" },
          ].map(tier => (
            <button
              key={tier.value}
              onClick={() => setSelectedTier(tier.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-body border transition-colors ${
                selectedTier === tier.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted border-border hover:border-primary/50"
              }`}
            >
              {tier.label}
            </button>
          ))}
        </div>

        {/* Grille d'items */}
        {selectedTier === "t1" ? (
          <div className="space-y-2">
            {[...items].map(item => {
              const isGold = item.key === "or";
              const playerStock = isGold
                ? (profile.gold || 0)
                : ((profile.inventory || []).find(i => i.item_key === item.key)?.quantity || 0);
              const warehouseStock = isHomeCity ? (warehouse[item.key] || 0) : null;
              const offers = city.rachat_t1_offers || {};
              const offer = offers[item.key];
              const hasOffer = offer && offer.price > 0 && offer.qty_max > 0;
              const boughtToday = (city.rachat_t1_bought_today || {})[item.key] || 0;
              const remaining = hasOffer ? (offer.qty_max - boughtToday) : 0;
              const amount = amounts[item.key] ?? 1;
              const dailyUse = dailyMaintenance[item.key] || 0;

              if (playerStock === 0 && !isGold) {
                return (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-body rounded-lg px-3 py-2 bg-muted/30 text-muted-foreground">
                      <span>{item.icon}</span>
                      <span className="flex-1 font-semibold">{item.name}</span>
                      <span>Vous n'en avez pas</span>
                    </div>
                    {hasOffer && remaining > 0 && (
                      <div className="text-xs font-body text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                        🏪 La ville rachète jusqu'à <strong>{offer.qty_max}</strong> unité{offer.qty_max > 1 ? "s" : ""} à <strong>{offer.price} or</strong> pièce — quota restant : <strong>{remaining}</strong>. Apportez-en !
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                    <span className="text-lg w-8 text-center">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-body font-semibold">{item.name}</span>
                      <div className="text-xs text-muted-foreground font-body">
                        {isHomeCity && warehouseStock !== null && <span>📦 Entrepôt : {warehouseStock} · </span>}
                        Votre stock : {playerStock}
                        {dailyUse > 0 && <span> · consommation : {dailyUse}/j</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-1.5">
                      <Input
                         type="number"
                         min={1}
                         max={playerStock}
                         value={Math.min(amount, playerStock)}
                         onChange={e => setAmounts(prev => ({ ...prev, [item.key]: Math.max(1, Math.min(playerStock, Number(e.target.value))) }))}
                         className="w-14 h-7 text-xs text-center text-foreground"
                         disabled={contributing}
                       />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-body shrink-0 text-blue-700 border-blue-300 hover:bg-blue-50"
                        onClick={() => handleDepositT1(item.key, Math.min(amount, playerStock), false)}
                        disabled={contributing}
                      >
                        {contributing ? "..." : "Déposer"}
                      </Button>
                    </div>
                  </div>
                  {hasOffer && remaining > 0 && (
                    <div className="flex flex-col gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 sm:flex-row sm:items-center">
                      <span className="text-xs font-body text-green-800 flex-1">
                        🏪 La ville rachète jusqu'à <strong>{offer.qty_max}</strong> unité{offer.qty_max > 1 ? "s" : ""} à <strong>{offer.price} or</strong> pièce — quota restant aujourd'hui : <strong>{remaining}</strong>
                      </span>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <Input
                           type="number"
                           min={1}
                           max={Math.min(playerStock, remaining)}
                           value={Math.min(amount, playerStock, remaining)}
                           onChange={e => setAmounts(prev => ({ ...prev, [item.key]: Math.max(1, Math.min(playerStock, remaining, Number(e.target.value))) }))}
                           className="w-14 h-7 text-xs text-center text-foreground border-green-300"
                           disabled={contributing}
                         />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-body shrink-0 text-green-700 border-green-300 hover:bg-green-100"
                          onClick={() => handleDepositT1(item.key, Math.min(amount, playerStock, remaining), true)}
                          disabled={contributing}
                        >
                          {contributing ? "..." : "Vendre"}
                        </Button>
                      </div>
                    </div>
                  )}
                  {hasOffer && remaining === 0 && (
                    <div className="text-xs font-body text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5">
                      🏪 La ville rachète ce produit — quota journalier atteint, revenez demain.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(item => {
              const playerQty = (profile.inventory || []).find(i => i.item_key === item.key)?.quantity || 0;
              const warehouseStock = isHomeCity ? (warehouse[item.key] || 0) : null;
              const offers = city.rachat_t2t3_offers || {};
              const offer = offers[item.key];
              const hasOffer = offer && offer.price > 0 && offer.qty_max > 0;
              const boughtToday = (city.rachat_t2t3_bought_today || {})[item.key] || 0;
              const remaining = hasOffer ? (offer.qty_max - boughtToday) : 0;
              const amount = amounts[item.key] ?? 1;

              if (playerQty === 0) {
                return (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-body rounded-lg px-3 py-2 bg-muted/30 text-muted-foreground">
                      <span>{item.icon}</span>
                      <span className="flex-1 font-semibold">{item.name}</span>
                      <span>Vous n'en avez pas</span>
                    </div>
                    {hasOffer && remaining > 0 && (
                      <div className="text-xs font-body text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                        🏪 La ville rachète jusqu'à <strong>{offer.qty_max}</strong> unité{offer.qty_max > 1 ? "s" : ""} à <strong>{offer.price} or</strong> pièce — quota restant : <strong>{remaining}</strong>. Apportez-en !
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                    <span className="text-lg w-8 text-center">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-body font-semibold">{item.name}</span>
                      <div className="text-xs text-muted-foreground font-body">
                        {isHomeCity && warehouseStock !== null && <span>📦 Entrepôt : {warehouseStock} · </span>}
                        Votre stock : {playerQty}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-1.5">
                      <Input
                         type="number"
                         min={1}
                         max={playerQty}
                         value={Math.min(amount, playerQty)}
                         onChange={e => setAmounts(prev => ({ ...prev, [item.key]: Math.max(1, Math.min(playerQty, Number(e.target.value))) }))}
                         className="w-14 h-7 text-xs text-center text-foreground"
                         disabled={contributing}
                       />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs font-body shrink-0 text-blue-700 border-blue-300 hover:bg-blue-50"
                        onClick={() => handleDepositT2T3(item.key, Math.min(amount, playerQty), false)}
                        disabled={contributing}
                      >
                        {contributing ? "..." : "Déposer"}
                      </Button>
                    </div>
                  </div>
                  {hasOffer && remaining > 0 && (
                    <div className="flex flex-col gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 sm:flex-row sm:items-center">
                      <span className="text-xs font-body text-green-800 flex-1">
                        🏪 La ville rachète jusqu'à <strong>{offer.qty_max}</strong> unité{offer.qty_max > 1 ? "s" : ""} à <strong>{offer.price} or</strong> pièce — quota restant aujourd'hui : <strong>{remaining}</strong>
                      </span>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <Input
                           type="number"
                           min={1}
                           max={Math.min(playerQty, remaining)}
                           value={Math.min(amount, playerQty, remaining)}
                           onChange={e => setAmounts(prev => ({ ...prev, [item.key]: Math.max(1, Math.min(playerQty, remaining, Number(e.target.value))) }))}
                           className="w-14 h-7 text-xs text-center text-foreground border-green-300"
                           disabled={contributing}
                         />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-body shrink-0 text-green-700 border-green-300 hover:bg-green-100"
                          onClick={() => handleDepositT2T3(item.key, Math.min(amount, playerQty, remaining), true)}
                          disabled={contributing}
                        >
                          {contributing ? "..." : "Vendre"}
                        </Button>
                      </div>
                    </div>
                  )}
                  {hasOffer && remaining === 0 && (
                    <div className="text-xs font-body text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5">
                      🏪 La ville rachète ce produit — quota journalier atteint, revenez demain.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

