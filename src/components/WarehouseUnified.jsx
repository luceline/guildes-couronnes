import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { removeFromInventory } from "@/lib/inventoryHelpers";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ITEM_CATEGORIES } from "../lib/gameData";
import { ITEMS as GAME_ITEMS } from "../lib/craftingData";
// REFONTE MARCHAND (10/05/2026) : prix dynamique pour la revente Marchand à l'entrepôt.
import { SUGGESTED_PRICES_T1 } from "../lib/pricingData";

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
import { checkAndAwardObjective } from "@/lib/questRewards";
import { QUEST_TEMPLATES } from "../lib/objectiveGenerator";
import { toast } from "sonner";

// ── Log entrepôt ──────────────────────────────────────────────
async function logWarehouse(profile, city, action, itemKey, itemName, quantity, source = "player") {
  try {
    await base44.entities.WarehouseLog.create({
      city_id:     city?.id   || "",
      city_name:   city?.name || "",
      player_email: profile.user_email || "",
      player_name:  profile.character_name || "",
      action,       // "deposit" ou "withdraw"
      item_key:    itemKey,
      item_name:   itemName,
      quantity,
      source,
    });
  } catch(e) { console.warn("WarehouseLog:", e); }
}



const T1_ITEMS = [
  { key: "bois_brut",   name: "Bois brut",      icon: "🪵" },
  { key: "pierre",      name: "Pierre",         icon: "🪨" },
  { key: "minerai_fer", name: "Minerai de fer", icon: "⚙️" },
  { key: "ble",         name: "Blé",            icon: "🌾" },
  { key: "laine_brute", name: "Laine brute",    icon: "🧶" },
  { key: "herbes",      name: "Herbes",         icon: "🌿" },
  { key: "quartz_brut", name: "Quartz brut",    icon: "🔮" },
];

// Set des keys T1 pour vérification rapide dans le tracking de quête deposit_t1
const T1_KEYS_SET = new Set(T1_ITEMS.map(i => i.key));

/**
 * Tracking quête "deposit_t1" : si l'item déposé est un T1, on incrémente
 * la progression de toutes les quêtes deposit_t1 actives du joueur, peu
 * importe la ville (n'importe quel entrepôt compte).
 */
async function trackDepositT1Quest(itemKey, qty, depositT1Objectives, profile, city) {
  if (!T1_KEYS_SET.has(itemKey)) return;
  if (!depositT1Objectives || depositT1Objectives.length === 0) return;
  for (const obj of depositT1Objectives) {
    try {
      await checkAndAwardObjective({ obj, addedQty: qty, profile, city });
    } catch (e) { console.warn("[deposit_t1 quest] error:", e); }
  }
}

const T2_ITEMS = [
  { key: "planches",     name: "Planches",       icon: "🏗️", tier: 2 },
  { key: "pierre_brute", name: "Pierre taillée",   icon: "🪨", tier: 2 },
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
  depositT1Objectives = [],
  logGold,
  onRefresh,
}) {
  const [selectedTier, setSelectedTier] = useState("t1");
  const [amounts, setAmounts] = useState({});

  // ── REFONTE MARCHAND (10/05/2026) ──────────────────────────────────────
  // Le Marchand peut revendre n'importe quel T1 à l'entrepôt même si le maire
  // a désactivé la fonction. Le prix appliqué = moyenne réelle du marché pour
  // cet item, clampée dans la fourchette suggérée [min, max].
  // On charge les listings actifs au mount pour calculer ces moyennes.
  const isMarchand = profile?.profession === "Marchand";
  const [marketPrices, setMarketPrices] = useState({}); // { itemKey: prixClampé }
  useEffect(() => {
    if (!isMarchand) return; // Pas besoin de charger pour les non-Marchands.
    let cancelled = false;
    base44.entities.MarketListing.filter({ status: "active" }).then(listings => {
      if (cancelled) return;
      const computed = {};
      Object.entries(SUGGESTED_PRICES_T1).forEach(([key, range]) => {
        const matching = (listings || []).filter(l => l.item_key === key && l.price_per_unit > 0);
        let price;
        if (matching.length > 0) {
          // Moyenne réelle des listings actifs pour cet item.
          const sum = matching.reduce((s, l) => s + l.price_per_unit, 0);
          const avg = sum / matching.length;
          // Clamp dans [min, max] de la fourchette suggérée.
          price = Math.max(range.min, Math.min(range.max, Math.round(avg)));
        } else {
          // Aucun listing → fallback sur le max conseillé.
          price = range.max;
        }
        computed[key] = price;
      });
      setMarketPrices(computed);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isMarchand]);

  /**
   * Prix de revente d'un T1 par le Marchand à l'entrepôt.
   * (10/05/2026) On ajoute +1 or au prix de marché pour que le Marchand fasse
   * un bénéfice sur la revente à l'entrepôt (sans cela, il ne gagnait rien
   * par rapport à une vente directe sur le marché).
   * @returns {number} Prix par unité (or)
   */
  const getMerchantSellPrice = (itemKey) => {
    const basePrice = marketPrices[itemKey] || SUGGESTED_PRICES_T1[itemKey]?.max || 0;
    return basePrice > 0 ? basePrice + 1 : 0;
  };

  // ── Quota journalier Marchand : 200 or/jour à l'entrepôt ────────────────
  // Le Marchand ne peut pas revendre plus de 200 or par jour à l'entrepôt
  // (offre maire + prix dynamique cumulés). Stocké dans le profil :
  //   merchant_warehouse_sold_today: { date: "YYYY-MM-DD", amount: <or vendu> }
  // Reset auto au changement de date.
  const MERCHANT_DAILY_GOLD_CAP = 200;
  const todayStrMerchant = new Date().toISOString().split("T")[0];
  const getMerchantSoldToday = () => {
    const data = profile?.merchant_warehouse_sold_today;
    if (!data || data.date !== todayStrMerchant) return 0;
    return data.amount || 0;
  };
  /**
   * Renvoie l'or maximum encore vendable aujourd'hui (0 si plafond atteint).
   * Pour un non-Marchand, retourne Infinity (pas de quota).
   */
  const getMerchantRemainingGold = () => {
    if (!isMarchand) return Infinity;
    return Math.max(0, MERCHANT_DAILY_GOLD_CAP - getMerchantSoldToday());
  };
  /**
   * Construit le nouvel objet merchant_warehouse_sold_today après une vente.
   * @returns {Object|null} null si non-Marchand
   */
  const buildNewMerchantSoldToday = (addedGold) => {
    if (!isMarchand) return null;
    return { date: todayStrMerchant, amount: getMerchantSoldToday() + addedGold };
  };

  const warehouse = city.warehouse || {};
  const dailyMaintenance = city?.maintenance_daily || {};

  const getTierItems = () => {
    if (selectedTier === "t1") return T1_ITEMS;
    if (selectedTier === "t2") return T2_ITEMS;
    return T3_ITEMS;
  };

  const handleDepositT1 = async (itemKey, qty, isSale = false) => {
    const isGold = itemKey === "or";

    // REFONTE MARCHAND (10/05/2026) : le Marchand peut revendre même si le rachat
    // est désactivé par le maire. Pour les autres joueurs, le check reste actif.
    if (isSale && !city.warehouse_rachat_enabled && !isMarchand) {
      toast.error("📦 Le rachat est désactivé : le maire doit l'activer via la Mairie.");
      return;
    }

    if (isGold) {
      if ((profile.gold || 0) < qty) { toast.error("Votre bourse est vide : il vous manque de l'or pour ce dépôt."); return; }
    } else {
      const invItem = (profile.inventory || []).find(i => i.item_key === itemKey);
      if (!invItem || invItem.quantity < qty) { toast.error(`Vous n'avez pas assez de ${WAREHOUSE_LABELS[itemKey]}.`); return; }
    }

    const offers = city.rachat_t1_offers || {};
    const offer = offers[itemKey];
    const hasOffer = offer && offer.price > 0 && offer.qty_max > 0;

    // ── REFONTE MARCHAND (10/05/2026) ─────────────────────────────────────
    // Mode B : Marchand + vente + pas d'offre du maire → vente quand même au prix
    // dynamique clampé (moyenne marché bornée par la fourchette suggérée).
    // Privilège local : seulement dans la ville d'origine du Marchand.
    // Quota : 200 or/jour partagé avec le mode A (offre maire).
    if (isSale && isMarchand && !hasOffer && !isGold) {
      if (!isHomeCity) {
        toast.error("🏪 Marchand : ce privilège ne s'exerce qu'à l'entrepôt de votre ville d'origine.");
        return;
      }
      const pricePerUnit = getMerchantSellPrice(itemKey);
      if (!pricePerUnit) {
        toast.error("📦 Cet item ne peut pas être revendu à l'entrepôt par le Marchand.");
        return;
      }
      // Plafonner la quantité par le quota or restant.
      const remainingGold = getMerchantRemainingGold();
      if (remainingGold <= 0) {
        toast.error(`📦 Quota Marchand atteint : ${MERCHANT_DAILY_GOLD_CAP}💰/jour à l'entrepôt. Revenez demain.`);
        return;
      }
      const maxQtyByQuota = Math.floor(remainingGold / pricePerUnit);
      if (maxQtyByQuota === 0) {
        toast.error(`📦 Le prix unitaire (${pricePerUnit}💰) dépasse votre quota Marchand restant (${remainingGold}💰).`);
        return;
      }
      const actualQty = Math.min(qty, maxQtyByQuota);
      const totalGold = actualQty * pricePerUnit;
      if ((city.gold_treasury || 0) < totalGold) {
        toast.error("🏦 Les coffres de la ville sont à sec : la mairie ne peut honorer cette revente.");
        return;
      }
      const newInv = removeFromInventory(profile.inventory, itemKey, actualQty);
      const newWarehouse = { ...(warehouse || {}), [itemKey]: ((warehouse?.[itemKey]) || 0) + actualQty };
      try {
        setContributing(true);
        await Promise.all([
          base44.entities.City.update(city.id, {
            warehouse: newWarehouse,
            gold_treasury: (city.gold_treasury || 0) - totalGold,
          }),
          base44.entities.PlayerProfile.update(profile.id, {
            gold: (profile.gold || 0) + totalGold,
            inventory: newInv,
            cumul_ventes_or: (profile.cumul_ventes_or || 0) + totalGold,
            cumul_contributions_warehouse: (profile.cumul_contributions_warehouse || 0) + actualQty,
            merchant_warehouse_sold_today: buildNewMerchantSoldToday(totalGold),
          }),
        ]);
        await logGold(profile.user_email, profile.character_name, city.id, city.name,
          totalGold, "rachat_entrepot", `Revente Marchand T1 : ${actualQty}× ${itemKey}`);
        const partial = actualQty < qty ? ` (quota : ${actualQty}/${qty})` : "";
        toast.success(`🏪 Marchand : ${actualQty}× ${itemKey} revendus pour ${totalGold}💰${partial}.`);
        await logWarehouse(profile, city, "deposit", itemKey, WAREHOUSE_LABELS[itemKey] || itemKey, actualQty, "player");
        if (isHomeCity) for (const obj of depositObjectives) {
          if (obj.target_item === itemKey) {
            await checkAndAwardObjective({ obj, addedQty: actualQty, profile, city });
          }
        }
        onRefresh?.();
      } catch (e) {
        console.error("[Marchand revente entrepôt]", e);
        toast.error("Erreur lors de la revente.");
      } finally {
        setContributing(false);
      }
      return;
    }

    // Mode vente avec offre
    if (isSale && hasOffer) {
      const pricePerUnit = offer.price;
      const totalGold = qty * pricePerUnit;
      if ((city.gold_treasury || 0) < totalGold) {
        toast.error("🏦 Les coffres de la ville sont à sec : la mairie ne peut honorer cette offre."); return;
      }
      const boughtToday = (city.rachat_t1_bought_today || {})[itemKey] || 0;
      if (boughtToday >= offer.qty_max) {
        toast.error(`📦 Le quota journalier de ${itemKey} est épuisé : la ville ne rachète plus rien de ce genre aujourd'hui.`); return;
      }
      let actualQty = Math.min(qty, offer.qty_max - boughtToday);

      // ── REFONTE MARCHAND (10/05/2026) : quota global 200 or/jour ────────
      // Si Marchand : plafonner la quantité par le quota or restant.
      if (isMarchand) {
        const remainingGold = getMerchantRemainingGold();
        if (remainingGold <= 0) {
          toast.error(`📦 Quota Marchand atteint : ${MERCHANT_DAILY_GOLD_CAP}💰/jour à l'entrepôt. Revenez demain.`);
          return;
        }
        const maxQtyByQuota = Math.floor(remainingGold / pricePerUnit);
        if (maxQtyByQuota === 0) {
          toast.error(`📦 Le prix unitaire (${pricePerUnit}💰) dépasse votre quota Marchand restant (${remainingGold}💰).`);
          return;
        }
        actualQty = Math.min(actualQty, maxQtyByQuota);
      }

      const actualGold = actualQty * pricePerUnit;

      const newInv = isGold
        ? (profile.inventory || [])
        : removeFromInventory(profile.inventory, itemKey, actualQty);
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
            // Quota Marchand : tracker l'or vendu aujourd'hui (null pour non-Marchand)
            ...(isMarchand ? { merchant_warehouse_sold_today: buildNewMerchantSoldToday(actualGold) } : {}),
          }),
        ]);
        await logGold(profile.user_email, profile.character_name, city.id, city.name,
          actualGold, "rachat_entrepot", `Vente entrepôt T1 : ${actualQty}× ${itemKey}`);
        toast.success(`🤝 Marché conclu ! ${actualQty}× ${itemKey} livrés à la ville contre ${actualGold}💰.`);
        await logWarehouse(profile, city, "deposit", itemKey, WAREHOUSE_LABELS[itemKey] || itemKey, actualQty, "player");

        if (isHomeCity) for (const obj of depositObjectives) {
          if (obj.target_item === itemKey) {
            await checkAndAwardObjective({ obj, addedQty: actualQty, profile, city });
          }
        }

        // Tracking quête deposit_t1 (n'importe quel entrepôt, n'importe quel T1)
        await trackDepositT1Quest(itemKey, actualQty, depositT1Objectives, profile, city);

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
              await checkAndAwardObjective({ obj, addedQty: actualQty, profile, city });
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
        : removeFromInventory(profile.inventory, itemKey, qty);
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
        await logWarehouse(profile, city, "deposit", itemKey, WAREHOUSE_LABELS[itemKey] || itemKey, isGold ? 0 : qty, "player");
        toast.success(isGold
          ? `💰 ${qty} or versé à la trésorerie de la ville : la ville vous remercie !`
          : `📦 ${qty}× ${WAREHOUSE_LABELS[itemKey]} versé(e)s à l'entrepôt communautaire : la ville vous remercie !`
        );

        if (isHomeCity) for (const obj of depositObjectives) {
          if (obj.target_item === itemKey) {
            await checkAndAwardObjective({ obj, addedQty: qty, profile, city });
          }
        }

        // Tracking quête deposit_t1 (compte uniquement les T1, ignore l'or)
        if (!isGold) {
          await trackDepositT1Quest(itemKey, qty, depositT1Objectives, profile, city);
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
              await checkAndAwardObjective({ obj, addedQty: qty, profile, city });
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
      toast.error(`Votre besace est insuffisante en ${itemKey} : récoltez davantage avant de revenir.`); return;
    }

    const offers = city.rachat_t2t3_offers || {};
    const offer = offers[itemKey];
    const hasOffer = offer && offer.price > 0 && offer.qty_max > 0;

    // Mode vente avec offre
    if (isSale && hasOffer) {
      const pricePerUnit = offer.price;
      const totalGold = qty * pricePerUnit;
      if ((city.gold_treasury || 0) < totalGold) {
        toast.error("🏦 Les coffres de la ville sont à sec : la mairie ne peut honorer cette offre."); return;
      }
      const boughtToday = city.rachat_t2t3_bought_today || {};
      const alreadyBought = boughtToday[itemKey] || 0;
      if (alreadyBought >= offer.qty_max) {
        toast.error(`📦 Le quota journalier de ${itemKey} est épuisé : la ville ne rachète plus rien de ce genre aujourd'hui.`); return;
      }
      const actualQty = Math.min(qty, offer.qty_max - alreadyBought);
      const actualGold = actualQty * pricePerUnit;

      const newInv = removeFromInventory(profile.inventory, itemKey, actualQty);
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
        await logWarehouse(profile, city, "deposit", itemKey, GAME_ITEMS[itemKey]?.name || itemKey, actualQty, "player");

        if (isHomeCity) for (const obj of depositObjectives) {
          if (obj.target_item === itemKey) {
            await checkAndAwardObjective({ obj, addedQty: actualQty, profile, city });
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
              await checkAndAwardObjective({ obj, addedQty: actualQty, profile, city });
            }
          }
        } catch(e) { console.warn("contributeObjective:", e); }

        onRefresh?.();
      } finally {
        setContributing(false);
      }
    } else {
      // Mode dépôt libre (sans offre ou pas de vente)
      const newInv = removeFromInventory(profile.inventory, itemKey, qty);
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
        toast.success(`📦 ${qty}× ${itemKey} versé(e)s à l'entrepôt : les bâtiments de la ville vous en seront reconnaissants !`);
        await logWarehouse(profile, city, "deposit", itemKey, GAME_ITEMS[itemKey]?.name || itemKey, qty, "player");

        if (isHomeCity) for (const obj of depositObjectives) {
          if (obj.target_item === itemKey) {
            await checkAndAwardObjective({ obj, addedQty: qty, profile, city });
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
              await checkAndAwardObjective({ obj, addedQty: qty, profile, city });
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
      <CardContent className="pt-3 space-y-3">
        {/* 11/05/2026 : CardTitle "📦 Entrepôt - Dépôts" retiré (info déjà
            donnée par le drawer header + sous-onglet "Approvisionnement"). */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
                  <div key={item.key} className="flex flex-col gap-1 min-h-[110px]">
                    <div className="flex items-center gap-2 text-xs font-body rounded-lg px-3 py-2 bg-muted/30 text-muted-foreground">
                      <span>{item.icon}</span>
                      <span className="flex-1 font-semibold">{item.name}</span>
                      <span>Vous n'en avez pas</span>
                    </div>
                    {hasOffer && remaining > 0 && city.warehouse_rachat_enabled && (
                      <div className="text-xs font-body text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                        🏪 La ville rachète jusqu'à <strong>{offer.qty_max}</strong> unité{offer.qty_max > 1 ? "s" : ""} à <strong>{offer.price} or</strong> pièce : quota restant : <strong>{remaining}</strong>. Apportez-en !
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={item.key} className="flex flex-col gap-1 min-h-[110px]">
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Input
                         type="number"
                       inputMode="numeric"
                       pattern="[0-9]*"
                         min={1}
                         max={playerStock}
                         value={Math.min(amount, playerStock)}
                         onChange={e => setAmounts(prev => ({ ...prev, [item.key]: Math.max(1, Math.min(playerStock, Number(e.target.value))) }))}
                         className="w-14 h-7 text-xs text-center text-foreground"
                         disabled={contributing}
                         onFocus={e => e.target.select()}
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
                  {hasOffer && remaining > 0 && city.warehouse_rachat_enabled && (
                    <div className="flex flex-col gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 sm:flex-row sm:items-center">
                      <span className="text-xs font-body text-green-800 flex-1">
                        🏪 La ville rachète jusqu'à <strong>{offer.qty_max}</strong> unité{offer.qty_max > 1 ? "s" : ""} à <strong>{offer.price} or</strong> pièce : quota restant aujourd'hui : <strong>{remaining}</strong>
                      </span>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <Input
                           type="number"
                       inputMode="numeric"
                       pattern="[0-9]*"
                           min={1}
                           max={Math.min(playerStock, remaining)}
                           value={Math.min(amount, playerStock, remaining)}
                           onChange={e => setAmounts(prev => ({ ...prev, [item.key]: Math.max(1, Math.min(playerStock, remaining, Number(e.target.value))) }))}
                           className="w-14 h-7 text-xs text-center text-foreground border-green-300"
                           disabled={contributing}
                           onFocus={e => e.target.select()}
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

                  {/* ── REFONTE MARCHAND (10/05/2026) : bandeau revente Marchand ── */}
                  {/* Le Marchand peut revendre n'importe quel T1 à l'entrepôt à prix dynamique, */}
                  {/* uniquement dans sa VILLE D'ORIGINE, et seulement si pas déjà couvert       */}
                  {/* par le bandeau "offre maire" ci-dessus.                                    */}
                  {isMarchand && isHomeCity && !isGold && !(hasOffer && remaining > 0 && city.warehouse_rachat_enabled) && (() => {
                    const merchantPrice = getMerchantSellPrice(item.key);
                    const remainingGold = getMerchantRemainingGold();
                    if (!merchantPrice) return null;
                    const maxQtyByQuota = Math.floor(remainingGold / merchantPrice);
                    const maxSellable = Math.min(playerStock, maxQtyByQuota);
                    const quotaReached = remainingGold <= 0 || maxSellable === 0;
                    return (
                      <div className="flex flex-col gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 sm:flex-row sm:items-center">
                        <span className="text-xs font-body text-amber-800 flex-1">
                          🏪 <strong>Marchand</strong> : revendez à <strong>{merchantPrice} or</strong>/u (prix marché). Quota restant aujourd'hui : <strong>{remainingGold}💰</strong> / {MERCHANT_DAILY_GOLD_CAP}💰.
                        </span>
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <Input
                             type="number"
                       inputMode="numeric"
                       pattern="[0-9]*"
                             min={1}
                             max={Math.max(1, maxSellable)}
                             value={Math.min(amount, Math.max(1, maxSellable))}
                             onChange={e => setAmounts(prev => ({ ...prev, [item.key]: Math.max(1, Math.min(maxSellable, Number(e.target.value))) }))}
                             className="w-14 h-7 text-xs text-center text-foreground border-amber-300"
                             disabled={contributing || quotaReached}
                             onFocus={e => e.target.select()}
                           />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs font-body shrink-0 text-amber-700 border-amber-300 hover:bg-amber-100"
                            onClick={() => handleDepositT1(item.key, Math.min(amount, maxSellable), true)}
                            disabled={contributing || quotaReached}
                          >
                            {contributing ? "..." : quotaReached ? "Quota atteint" : "Vendre"}
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                  {hasOffer && remaining === 0 && (
                    <div className="text-xs font-body text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5">
                      🏪 La ville rachète ce produit : quota journalier atteint, revenez demain.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
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
                  <div key={item.key} className="flex flex-col gap-1 min-h-[110px]">
                    <div className="flex items-center gap-2 text-xs font-body rounded-lg px-3 py-2 bg-muted/30 text-muted-foreground">
                      <span>{item.icon}</span>
                      <span className="flex-1 font-semibold">{item.name}</span>
                      <span>Vous n'en avez pas</span>
                    </div>
                    {hasOffer && remaining > 0 && city.warehouse_rachat_enabled && (
                      <div className="text-xs font-body text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                        🏪 La ville rachète jusqu'à <strong>{offer.qty_max}</strong> unité{offer.qty_max > 1 ? "s" : ""} à <strong>{offer.price} or</strong> pièce : quota restant : <strong>{remaining}</strong>. Apportez-en !
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={item.key} className="flex flex-col gap-1 min-h-[110px]">
                  <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                    <span className="text-lg w-8 text-center">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-body font-semibold">{item.name}</span>
                      <div className="text-xs text-muted-foreground font-body">
                        {isHomeCity && warehouseStock !== null && <span>📦 Entrepôt : {warehouseStock} · </span>}
                        Votre stock : {playerQty}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Input
                         type="number"
                       inputMode="numeric"
                       pattern="[0-9]*"
                         min={1}
                         max={playerQty}
                         value={Math.min(amount, playerQty)}
                         onChange={e => setAmounts(prev => ({ ...prev, [item.key]: Math.max(1, Math.min(playerQty, Number(e.target.value))) }))}
                         className="w-14 h-7 text-xs text-center text-foreground"
                         disabled={contributing}
                         onFocus={e => e.target.select()}
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
                  {hasOffer && remaining > 0 && city.warehouse_rachat_enabled && (
                    <div className="flex flex-col gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 sm:flex-row sm:items-center">
                      <span className="text-xs font-body text-green-800 flex-1">
                        🏪 La ville rachète jusqu'à <strong>{offer.qty_max}</strong> unité{offer.qty_max > 1 ? "s" : ""} à <strong>{offer.price} or</strong> pièce : quota restant aujourd'hui : <strong>{remaining}</strong>
                      </span>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <Input
                           type="number"
                       inputMode="numeric"
                       pattern="[0-9]*"
                           min={1}
                           max={Math.min(playerQty, remaining)}
                           value={Math.min(amount, playerQty, remaining)}
                           onChange={e => setAmounts(prev => ({ ...prev, [item.key]: Math.max(1, Math.min(playerQty, remaining, Number(e.target.value))) }))}
                           className="w-14 h-7 text-xs text-center text-foreground border-green-300"
                           disabled={contributing}
                           onFocus={e => e.target.select()}
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
                      🏪 La ville rachète ce produit : quota journalier atteint, revenez demain.
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