import { base44 } from "@/api/base44Client";
import { checkAndAwardObjective, filterTodayActiveObjectives } from "@/lib/questRewards";
import { computeDebtRepayment, getTotalDebt } from "../lib/debtRepayment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getInventoryWeight, getEffectiveMaxWeight, wouldExceedCapacity, getMarketTaxDiscount } from "../lib/gameData";
import { ITEMS } from "../lib/craftingData";
import { SUGGESTED_PRICES_T1, SUGGESTED_PRICES_SPECIAL, getPriceMultiplier, getSuggestedPrice } from "../lib/pricingData";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import PlayerStatusBar from "../components/PlayerStatusBar";
import { ITEM_CATEGORIES } from "../lib/gameData";
import ItemTooltip from "../components/ItemTooltip";
import MarketInsights from "../components/MarketInsights";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { logGold } from '@/lib/goldLog';




function getDaysLeft(expiresAt) {
  if (!expiresAt) return null;
  const today = new Date().toISOString().split("T")[0];
  const diff = Math.ceil((new Date(expiresAt) - new Date(today)) / 86400000);
  return diff;
}

function getPriceHint(itemKey, price, multiplier = 1.0, dynamicPrices = {}) {
  // T1 et items spéciaux : fourchettes fixes
  const base = getSuggestedPrice(itemKey, 1) || SUGGESTED_PRICES_SPECIAL[itemKey];
  if (base && price) {
    const min = Math.round(base.min * multiplier);
    const max = Math.round(base.max * multiplier);
    if (price < min) return { label: `En dessous du marché (${min}–${max} 💰)`, color: "text-blue-600" };
    if (price > max) return { label: `Au-dessus du marché (${min}–${max} 💰)`, color: "text-orange-600" };
    return { label: `Prix dans la fourchette (${min}–${max} 💰)`, color: "text-green-600" };
  }
  // T2-T5 : prix dynamiques calculés au reset
  for (const tier of ["tier2", "tier3", "tier4", "tier5"]) {
    const tierPrices = dynamicPrices[tier];
    if (tierPrices && tierPrices[itemKey]) {
      const { min, max } = tierPrices[itemKey];
      if (!price) return null;
      if (price < min) return { label: `En dessous du marché (${min}–${max} 💰 estimés)`, color: "text-blue-600" };
      if (price > max) return { label: `Au-dessus du marché (${min}–${max} 💰 estimés)`, color: "text-orange-600" };
      return { label: `Prix dans la fourchette (${min}–${max} 💰 estimés)`, color: "text-green-600" };
    }
  }
  return null;
}



export default function Market({ profile, city, homeCity, onRefresh }) {
  const [listings, setListings] = useState([]);       // annonces de la ville actuelle, pas les miennes
  const [myListings, setMyListings] = useState([]);   // toutes mes annonces actives (toutes villes)
  const [loading, setLoading] = useState(true);
  const [sellOpen, setSellOpen] = useState(false);
  const [sellForm, setSellForm] = useState({ item_index: "", quantity: 1, price: 1, itemKey: "" });
  const [buying, setBuying] = useState(null);
  const [buyQtys, setBuyQtys] = useState({});
  const [filterCategory, setFilterCategory] = useState("all");
  const [priceMultiplier, setPriceMultiplier] = useState(1.0);
  const [dynamicPrices, setDynamicPrices] = useState({});
  const [worldEvents, setWorldEvents] = useState(null);

  useEffect(() => {
    base44.entities.EconomySettings.filter({ setting_key: "global" }).then(res => {
      if (res.length > 0) {
        setPriceMultiplier(getPriceMultiplier(res[0].or_moyen_par_joueur || 0));
        setWorldEvents(res[0].world_events || null);
        setDynamicPrices(res[0].dynamic_prices || {});
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!profile?.city_id) return;
    loadAll();
  }, [profile?.city_id]);

  async function loadAll() {
    setLoading(true);
    const [cityListings, allMyListings] = await Promise.all([
      // Uniquement les annonces de la ville où le joueur se trouve physiquement
      base44.entities.MarketListing.filter(
        { city_id: profile.city_id, status: "active" },
        "-created_date",
        200
      ),
      // Toutes mes annonces actives (annulables depuis n'importe où)
      base44.entities.MarketListing.filter(
        { seller_email: profile.user_email, status: "active" }
      ),
    ]);
    const today = new Date().toISOString().split("T")[0];
    setListings(cityListings.filter(l =>
      l.seller_email !== profile.user_email &&
      (!l.expires_at || l.expires_at >= today)
    ));
    setMyListings(allMyListings);
    setLoading(false);
  }

  // Taux de taxe de la ville actuelle
  function getTaxRate(cityBuildings) {
    if (!city) return 0;
    if (!city) return 0;
    const baseTaxRate = city.tax_rate || 10;
    const cum = city.treasury_cumulative || 0;
    let discount = 0;
    if (cum >= 35000) discount = 15;
    else if (cum >= 15000) discount = 10;
    else if (cum >= 6000) discount = 5;
      return Math.max(0, baseTaxRate - discount);
  }

  // Charger les bâtiments pour les bonus marché
  const [marketBuildings, setMarketBuildings] = useState([]);
  useEffect(() => {
    if (!city?.id) return;
    base44.entities.City.list().then(cities => {
      const c = cities.find(x => x.id === city.id);
      setMarketBuildings(c?.buildings || []);
    });
  }, [city?.id]);

  const taxRate = getTaxRate(marketBuildings);
  // Grande Place +15% prix de vente pour le vendeur
  // Guilde marchands +5% ventes

  // ── SELL : poste dans la ville actuelle ──
  const isPermit = (i) => i.item_key === "autorisation_marche" || i.item_name === "Autorisation de marché";
  const hasPermit = (profile.inventory || []).some(isPermit);
  
  // L'Autorisation de mise sur le marché peut être vendue sans bon d'autorisation
  const getHasPermitForItem = (itemKey) => {
    if (itemKey === "autorisation_marche" || itemKey === "") return true;
    return hasPermit;
  };

  const handleSell = async () => {
    const idx = parseInt(sellForm.item_index);
    const rawItem = (profile.inventory || []).filter(i => i.quantity > 0)[idx];
    if (!rawItem || sellForm.quantity <= 0 || sellForm.quantity > rawItem.quantity) {
      toast.error("La quantité indiquée n'est pas valide — vérifiez votre saisie.");
      return;
    }
    // Résoudre item_key manquant depuis ITEMS par item_name
    const resolvedKey = rawItem.item_key ||
      Object.entries(ITEMS).find(([, def]) => def.name === rawItem.item_name)?.[0] || "";
    const item = { ...rawItem, item_key: resolvedKey };

    // Vérifier le bon d'autorisation (sauf pour l'Autorisation elle-même)
    if (!getHasPermitForItem(item.item_key)) {
      toast.error("📜 Les gardes du marché vous barrent la route — il vous faut une Autorisation de mise sur le marché pour exposer vos marchandises !");
      return;
    }
    // Consommer l'autorisation SAUF si c'est l'Autorisation qu'on vend
    let inventoryAfterPermit = [...(profile.inventory || [])];
    if (!isPermit(item)) {
      const permitIdx = (profile.inventory || []).findIndex(isPermit);
      const newInventoryWithPermit = [...inventoryAfterPermit];
      newInventoryWithPermit[permitIdx] = { ...newInventoryWithPermit[permitIdx], quantity: newInventoryWithPermit[permitIdx].quantity - 1 };
      inventoryAfterPermit = newInventoryWithPermit.filter(i => i.quantity > 0);
    }

    await base44.entities.MarketListing.create({
      seller_email:     profile.user_email,
      seller_name:      profile.character_name,
      city_id:          profile.city_id,
      item_name:        item.item_name,
      item_key:         item.item_key,
      item_category:    item.item_category,
      item_tier:        ITEMS[item.item_key]?.tier || 0,
      quantity:         sellForm.quantity,
      quantity_initial: sellForm.quantity,
      price_per_unit:   sellForm.price,
      status:           "active",
      created_date:     new Date().toISOString().split("T")[0],
      expires_at:       new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
    });
    // Déduire depuis l'inventaire par item_key (ou item_name en fallback)
    const newInventory = inventoryAfterPermit.map(i => {
      if (item.item_key && i.item_key === item.item_key) return { ...i, quantity: i.quantity - sellForm.quantity };
      if (!item.item_key && i.item_name === item.item_name) return { ...i, quantity: i.quantity - sellForm.quantity };
      return i;
    }).filter(i => i.quantity > 0);

    await base44.entities.PlayerProfile.update(profile.id, { inventory: newInventory });
    toast.success(`🏷️ Votre étale est dressée sur le marché de ${city?.name} — que les acheteurs affluent !`);
    setSellOpen(false);
    setSellForm({ item_index: "", quantity: 1, price: 1, itemKey: "" });

    // ── Valider les quêtes "sell" via checkAndAwardObjective ──
    try {
      const itemTier = ITEMS[item.item_key]?.tier || 0;
      if (itemTier >= 2) {
        const allSell = await base44.entities.PlayerObjective.filter({
          player_email: profile.user_email,
          status: "active",
          type: "sell",
        });
        const sellObjs = filterTodayActiveObjectives(allSell, "sell");
        for (const obj of sellObjs) {
          const tierMatch = obj.target_item === "any_t2" || obj.target_item === "any_t3" || obj.target_item === "any" || obj.target_item === item.item_key || obj.target_item === item.item_category;
          if (!tierMatch) continue;
          await checkAndAwardObjective({ obj, addedQty: sellForm.quantity, profile, city });
        }
      }
    } catch(e) { console.warn("sellObjective:", e); }

    onRefresh?.();
    loadAll();
  };

  // ── BUY : taxes accumulées par ville sur le profil, versées au reset ──
  const handleBuy = async (listing) => {
    const qty = buyQtys[listing.id] || listing.quantity;
    const totalBase = listing.price_per_unit * qty;
    // Taxe calculée pour affichage uniquement — prélevée au reset
    // Taxe exacte sans arrondi — on cumule les centimes, arrondi au reset uniquement
    const taxAmount = taxRate > 0 ? totalBase * taxRate / 100 : 0;
    const totalCost = totalBase; // l'acheteur ne paie QUE le prix de base

    // ── Sceau royal system : règles spéciales ──
    const isSceauSystem = listing.item_name === "Sceau royal" && listing.seller_email === "system";
    if (isSceauSystem) {
      if ((profile.gold || 0) < 300) {
        toast.error("🏵️ Le Sceau royal est réservé aux bourses bien garnies — il vous faut au moins 300💰 pour le convoiter.");
        return;
      }
      const today = new Date().toISOString().split("T")[0];
      if (profile.sceau_last_bought === today) {
        toast.error("🏵️ Le Trésor royal ne vend qu'un Sceau par jour et par citoyen — revenez demain.");
        return;
      }
    }

    if ((profile.gold || 0) < totalCost) {
      toast.error(`Votre bourse est insuffisante — il vous faut ${totalCost} 💰 pour conclure cet achat.`);
      return;
    }
    if (qty <= 0 || qty > listing.quantity) {
      toast.error("La quantité indiquée n'est pas valide — vérifiez votre saisie.");
      return;
    }
    if (wouldExceedCapacity(profile, qty)) {
      const w = getInventoryWeight(profile);
      const max = getEffectiveMaxWeight(profile);
      toast.error(`📦 Votre besace déborde ! (${w}/${max}) Allégez votre charge avant d'acheter davantage.`);
      return;
    }

    setBuying(listing.id);

    // ── Parchemin : exonération de taxe ──
    const hasParchemin = (profile.inventory || []).some(i => i.item_key === "parchemin" || i.item_name === "Parchemin");
    // ── Quartz/Lingots Orfèvre : réduction de taxe ──
    const taxDiscountRate = getMarketTaxDiscount(profile);
    const discountedTaxAmount = taxDiscountRate > 0 ? Math.floor(taxAmount * (1 - taxDiscountRate)) : taxAmount;
    const effectiveTaxAmount = hasParchemin ? 0 : discountedTaxAmount;

    // ── Sceau royal : absorbe la taxe accumulée ──
    const sceauBalance = profile.sceau_balance || 0;
    let taxFromSceau = 0;
    let newSceauBalance = sceauBalance;
    if (sceauBalance > 0 && effectiveTaxAmount > 0) {
      taxFromSceau = Math.min(sceauBalance, effectiveTaxAmount);
      newSceauBalance = Math.max(0, sceauBalance - taxFromSceau);
    }
    const taxToAccumulate = effectiveTaxAmount - taxFromSceau;

    const remainingQty = listing.quantity - qty;
    if (remainingQty <= 0) {
      await base44.entities.MarketListing.update(listing.id, { status: "sold", quantity: 0 });
    } else {
      await base44.entities.MarketListing.update(listing.id, { quantity: remainingQty });
    }

    // Résoudre item_key s'il est vide dans le listing
    let resolvedItemKey = listing.item_key;
    if (!resolvedItemKey) {
      const found = Object.entries(ITEMS).find(([, item]) => item.name === listing.item_name);
      resolvedItemKey = found?.[0] || "";
    }

    // Normaliser les item_key manquants dans l'inventaire existant
    const newInventory = (profile.inventory || []).map(i => {
      if (i.item_key) return i;
      const found = Object.entries(ITEMS).find(([, def]) => def.name === i.item_name);
      return found ? { ...i, item_key: found[0] } : i;
    });
    const existing = newInventory.find(i =>
      i.item_key === resolvedItemKey && i.item_category === listing.item_category
    );
    if (existing) existing.quantity += qty;
    else newInventory.push({
      item_name:     listing.item_name,
      item_key:      resolvedItemKey,
      item_category: listing.item_category,
      quantity:      qty,
    });

    let finalInventory = newInventory;
    if (hasParchemin) {
      finalInventory = finalInventory.map(i =>
        (i.item_key === "parchemin" || i.item_name === "Parchemin")
          ? { ...i, quantity: i.quantity - 1 } : i
      ).filter(i => i.quantity > 0);
    }

    // ── Accumuler la taxe par ville (city_id → montant) ──
    const pendingTax = { ...(profile.pending_market_tax || {}) };
    if (taxToAccumulate > 0 && city?.id) {
      pendingTax[city.id] = (pendingTax[city.id] || 0) + taxToAccumulate;
    }

    // ── Sceau royal system : or détruit (sink), sceau_balance crédité, pas de vendeur ──
    if (isSceauSystem) {
      const today = new Date().toISOString().split("T")[0];
      await base44.entities.PlayerProfile.update(profile.id, {
        inventory:       finalInventory,
        gold:            (profile.gold || 0) - totalBase,
        sceau_balance:   (profile.sceau_balance || 0) + 110, // crédite 110 or de couverture
        sceau_last_bought: today,
        pending_market_tax: pendingTax,
      });
      await logGold(profile.user_email, profile.character_name, city?.id, city?.name,
        -totalBase, "achat", `Achat Sceau royal (100💰 détruits → +110💰 sceau)`
      );
      toast.success(`🏵️ Le Sceau royal est vôtre ! 100💰 dépensés — votre blason absorbe jusqu'à 110💰 de taxes et d'impôts.`);
      setBuying(null);
      onRefresh?.();
      loadAll();
      return;
    }

    await base44.entities.PlayerProfile.update(profile.id, {
      inventory:          finalInventory,
      gold:               (profile.gold || 0) - totalBase,  // prix pur seulement
      sceau_balance:      newSceauBalance,
      pending_market_tax: pendingTax,
    });

    // ── Vendeur : reçoit totalBase + bonus Marchand + bonus Caravane ──
    const sellers = await base44.entities.PlayerProfile.filter({ user_email: listing.seller_email });
    if (sellers.length > 0) {
      const isMarchand = sellers[0].profession === "Marchand";
      const taxBonus = isMarchand ? Math.floor(effectiveTaxAmount * 0.5) : 0;
      const caravane = worldEvents?.caravane;
      const nowHour = new Date().getHours();
      const caravaneActive = caravane?.active &&
        caravane?.item === listing.item_key &&
        nowHour >= (caravane.starts_at_hour || 10) &&
        nowHour < (caravane.starts_at_hour || 10) + 6;
      const caravaneBonus = caravaneActive
        ? Math.floor(totalBase * ((caravane.price_multiplier || 2.5) - 1))
        : 0;
      const sellerTotal = totalBase + taxBonus + caravaneBonus;
      const { repaid: sellerRepaid, debtByCity: sellerDebtByCity, goldAfterDebt: sellerGoldNet, cityPayments: sellerCityPayments } = computeDebtRepayment(sellers[0].debt_by_city || {}, sellerTotal);
      await base44.entities.PlayerProfile.update(sellers[0].id, {
        gold: (sellers[0].gold || 0) + sellerGoldNet,
        debt_by_city: sellerDebtByCity,
        cumul_ventes_or: (sellers[0].cumul_ventes_or || 0) + sellerTotal,
      });
      // Verser les remboursements aux trésoreries des villes créancières
      for (const [cid, amount] of Object.entries(sellerCityPayments)) {
        if (amount <= 0) continue;
        const creditorCity = await base44.entities.City.get(cid).catch(() => null);
        if (creditorCity) {
          await base44.entities.City.update(cid, {
            gold_treasury: (creditorCity.gold_treasury || 0) + amount,
            treasury_cumulative: (creditorCity.treasury_cumulative || 0) + amount,
          }).catch(() => {});
        }
      }
      await logGold(listing.seller_email, sellers[0].character_name, city?.id, city?.name,
        sellerTotal, "vente",
        `Vente ${qty}× ${listing.item_name}${taxBonus > 0 ? ` (+${taxBonus} bonus Marchand)` : ""}${caravaneBonus > 0 ? ` (+${caravaneBonus} bonus Caravane)` : ""}${sellerRepaid > 0 ? ` (−${sellerRepaid} remboursement dette)` : ""}`
      );
    }

    await logGold(profile.user_email, profile.character_name, city?.id, city?.name,
      -totalBase, "achat",
      `Achat ${qty}× ${listing.item_name}${effectiveTaxAmount > 0 ? ` (taxe ${effectiveTaxAmount}💰 due au reset)` : ""}`
    );

    await base44.entities.TradeHistory.create({
      buyer_email:    profile.user_email,
      seller_email:   listing.seller_email,
      city_id:        listing.city_id,
      item_name:      listing.item_name,
      item_category:  listing.item_category,
      quantity:       qty,
      price_per_unit: listing.price_per_unit,
      total_price:    totalCost,
      tax_amount:     taxAmount,
    });

    const taxMsg = hasParchemin
      ? " (📜 Parchemin — exonéré de taxe !)"
      : taxFromSceau > 0 && taxToAccumulate === 0
        ? ` (🏵️ taxe couverte par le Sceau royal)`
        : taxToAccumulate > 0
          ? ` (taxe ${taxToAccumulate}💰 due au reset${taxDiscountRate > 0 ? ` −${Math.round(taxDiscountRate*100)}%` : ""})`
          : "";
    toast.success(`🤝 Affaire conclue ! ${qty}× ${listing.item_name} acquis pour ${totalBase} 💰${taxMsg}`);

    setBuying(null);
    setBuyQtys(prev => ({ ...prev, [listing.id]: 1 }));
    onRefresh?.();
    loadAll();
  };

  // ── CANCEL listing ──
  const handleCancel = async (listing) => {
    await base44.entities.MarketListing.update(listing.id, { status: "cancelled" });
    // Résoudre item_key si absent du listing
    const resolvedKey = listing.item_key ||
      Object.entries(ITEMS).find(([, def]) => def.name === listing.item_name)?.[0] || "";
    // Normaliser les item_key manquants dans l'inventaire existant
    const newInventory = (profile.inventory || []).map(i => {
      if (i.item_key) return i;
      const found = Object.entries(ITEMS).find(([, def]) => def.name === i.item_name);
      return found ? { ...i, item_key: found[0] } : i;
    });
    const existing = newInventory.find(i =>
      i.item_key === resolvedKey && i.item_category === listing.item_category
    );
    if (existing) existing.quantity += listing.quantity;
    else newInventory.push({
      item_key:      resolvedKey,
      item_name:     listing.item_name,
      item_category: listing.item_category,
      quantity:      listing.quantity,
    });
    await base44.entities.PlayerProfile.update(profile.id, { inventory: newInventory });
    toast.success("Votre étale est démontée — les marchandises sont de retour dans votre besace.");
    onRefresh?.();
    loadAll();
  };

  if (!profile || !city) return null;

  // Filtre catégorie
  const filteredListings = filterCategory === "all"
    ? listings
    : listings.filter(l => l.item_category === filterCategory);

  const listingsByItem = {};
  for (const l of filteredListings) {
    if (!listingsByItem[l.item_name]) listingsByItem[l.item_name] = [];
    listingsByItem[l.item_name].push(l);
  }

  const categoriesInListings = [...new Set(listings.map(l => l.item_category).filter(Boolean))];

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <PlayerStatusBar profile={profile} homeCity={homeCity} city={city} onRefresh={onRefresh} />

      {/* ── Caravane royale ── */}
      {(() => {
        const c = worldEvents?.caravane;
        if (!c?.active) return null;
        const nowHour = new Date().getHours();
        const isActive = nowHour >= (c.starts_at_hour || 10) && nowHour < (c.starts_at_hour || 10) + 6;
        if (!isActive) return null;
        return (
          <div className="bg-amber-50 border border-amber-400 rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🐪</span>
            <div>
              <p className="font-heading font-semibold text-sm text-amber-900">Caravane royale — EN COURS !</p>
              <p className="text-xs font-body text-amber-700">
                La caravane achète <strong>{c.item}</strong> à <strong>×{c.price_multiplier} le prix normal</strong> pendant 6h.
                Route : {c.route_name}. Vendez maintenant pour en profiter !
              </p>
            </div>
          </div>
        );
      })()}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-heading text-2xl font-bold heading-medieval">🏪 Marché de {city.name}</h2>
          <p className="text-muted-foreground text-sm font-body">
            💰 Taxe aujourd'hui : {taxRate}%
            {city.tax_rate_next !== undefined && city.tax_rate_next !== null && (
              <span className="ml-2 text-amber-600">→ {city.tax_rate_next}% demain</span>
            )}
            {" — "}Maire : {city.mayor_name || "Aucun"}
          </p>
          {(city.daily_tax_collected || 0) > 0 && (
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              📊 Taxes collectées aujourd'hui : <strong>{city.daily_tax_collected}💰</strong> (versées à la trésorerie au reset)
            </p>
          )}
          {(() => {
            const pending = profile?.pending_market_tax || {};
            const total = Object.values(pending).reduce((s, v) => s + v, 0);
            if (total <= 0) return null;
            return (
              <p className="text-xs text-amber-700 font-body mt-0.5">
                ⏳ Taxes dues au reset : <strong>{total}💰</strong> (prélevées sur votre or, sinon mises en dette)
              </p>
            );
          })()}
          {true && (
            <p className="text-xs text-muted-foreground font-body mt-0.5 italic">
              Pour accéder au marché d'une autre ville, voyagez-y physiquement.
            </p>
          )}
        </div>

        <Dialog open={sellOpen} onOpenChange={setSellOpen}>
           <DialogTrigger asChild>
             <Button className="font-heading" disabled={!hasPermit}>
               Vendre 🏷️{!hasPermit && " (pas d'autorisation)"}
             </Button>
           </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Mettre en vente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground font-body bg-muted/40 rounded px-3 py-2">
                📍 Annonce postée sur le marché de <strong>{city.name}</strong>.
                {` L'acheteur paiera +${taxRate}% de taxes reversées à ${city.name}.`}
              </p>
              {!hasPermit ? (
                <p className="text-xs text-red-600 font-body bg-red-50 border border-red-200 rounded p-2">
                  📜 <strong>Autorisation requise</strong> — Il vous faut une <em>Autorisation de mise sur le marché</em> (produite par les Marchands, Tier 1) pour poster une annonce.
                </p>
              ) : (
                <p className="text-xs text-green-700 font-body bg-green-50 border border-green-200 rounded p-2">
                  📜 1 Autorisation de mise sur le marché sera consommée à la validation.
                </p>
              )}
              <div className="space-y-2">
                <Label className="font-body">Objet à vendre</Label>
                <Select
                  value={sellForm.item_index}
                  onValueChange={v => {
                    const selectedItem = (profile.inventory || []).filter(i => i.quantity > 0)[parseInt(v)];
                    const resolvedKey = selectedItem?.item_key ||
                      Object.entries(ITEMS).find(([, def]) => def.name === selectedItem?.item_name)?.[0] || "";
                    setSellForm({ ...sellForm, item_index: v, quantity: 1, itemKey: resolvedKey });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {(profile.inventory || []).filter(i => i.quantity > 0).map((item, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {ITEM_CATEGORIES[item.item_category]?.icon} {item.item_name} (×{item.quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {sellForm.item_index !== "" && (() => {
                const item = (profile.inventory || []).filter(i => i.quantity > 0)[parseInt(sellForm.item_index)];
                if (!item) return null;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-body">Quantité (max {item.quantity})</Label>
                      <span className="text-sm font-semibold">{sellForm.quantity}</span>
                    </div>
                    <Slider
                      min={1} max={item.quantity} step={1}
                      value={[sellForm.quantity]}
                      onValueChange={([v]) => setSellForm({ ...sellForm, quantity: v })}
                    />
                  </div>
                );
              })()}
              <div className="space-y-2">
                <Label className="font-body flex items-center gap-1">Prix unitaire (or) <span className="text-xs text-muted-foreground font-normal">(annonce active 3 jours)</span></Label>
                <Input
                  type="number" min={1} value={sellForm.price}
                  onChange={e => setSellForm({ ...sellForm, price: parseInt(e.target.value) || 1 })}
                />
                {sellForm.itemKey && sellForm.price > 0 && (() => {
                  const hint = getPriceHint(sellForm.itemKey, sellForm.price, priceMultiplier, dynamicPrices);
                  return hint ? (
                    <p className={`text-xs font-body mt-1 ${hint.color}`}>{hint.label}</p>
                  ) : null;
                })()}
              </div>

              {sellForm.quantity > 0 && sellForm.price > 0 && (
                <p className="text-xs text-muted-foreground font-body bg-muted/40 rounded p-2">
                  Vous recevrez <strong>{sellForm.quantity * sellForm.price} 💰</strong>
                  {` — l'acheteur paie +${taxRate}% taxes`}
                </p>
              )}
              <Button className="w-full font-heading" onClick={handleSell}>
                Mettre en vente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <MarketInsights cityId={city?.id} />

      <Tabs defaultValue="buy">
        <TabsList className="font-heading flex-wrap h-auto gap-1">
          <TabsTrigger value="buy">🛒 Acheter ({listings.length})</TabsTrigger>
          <TabsTrigger value="mine">📦 Mes annonces ({myListings.length})</TabsTrigger>
        </TabsList>

        {/* ── BUY TAB ── */}
        <TabsContent value="buy" className="space-y-3 mt-4">

          {categoriesInListings.length > 1 && (
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-xs font-body bg-background"
            >
              <option value="all">📦 Toutes catégories</option>
              {categoriesInListings.map(cat => (
                <option key={cat} value={cat}>
                  {ITEM_CATEGORIES[cat]?.icon} {cat}
                </option>
              ))}
            </select>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : Object.keys(listingsByItem).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground font-body">
                Les étales de {city.name} sont désertes — revenez quand les artisans auront sorti leurs marchandises.
              </CardContent>
            </Card>
          ) : (
            Object.entries(listingsByItem).map(([itemName, itemListings]) => {
              const cat = ITEM_CATEGORIES[itemListings[0].item_category];

              // Identifier les meilleures affaires : prix les plus bas
              const bestDeals = [];
              const hasMarchesCouvert = city?.buildings?.some(b => b.building_type === "marche");
              if (hasMarchesCouvert && itemListings.length > 1) {
                const sorted = [...itemListings].sort((a, b) => a.price_per_unit - b.price_per_unit);
                const minPrice = sorted[0].price_per_unit;
                // Mettre en surbrillance les offres au prix min
                bestDeals.push(...sorted.filter(l => l.price_per_unit === minPrice).map(l => l.id));
              }

              return (
                <Card key={itemName}>
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading text-base flex items-center gap-2">
                      <span>{cat?.icon || "📦"}</span>
                      <ItemTooltip itemName={itemName} side="top">
                        <span className="cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2">{itemName}</span>
                      </ItemTooltip>
                      <Badge variant="secondary" className="text-xs font-body ml-auto">
                        {itemListings.reduce((s, l) => s + l.quantity, 0)} disponibles
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {itemListings
                      .sort((a, b) => a.price_per_unit - b.price_per_unit)
                      .map(listing => {
                        const qty = buyQtys[listing.id] ?? listing.quantity;
                        const totalBase = listing.price_per_unit * qty;
                        // Taxe exacte sans arrondi — on cumule les centimes, arrondi au reset uniquement
    const taxAmount = taxRate > 0 ? totalBase * taxRate / 100 : 0;
                        const canAfford = (profile.gold || 0) >= totalBase;

                        const isBestDeal = bestDeals.includes(listing.id);
                        return (
                          <div key={listing.id} className={`border rounded-lg p-3 space-y-2 ${
                            isBestDeal 
                              ? "border-yellow-400 bg-yellow-50 shadow-md shadow-yellow-200" 
                              : "border-border"
                          }`}>
                            <div className="flex items-center justify-between text-sm font-body">
                              <span className="text-muted-foreground">
                                par {listing.seller_name}
                                {(() => {
                                  const d = getDaysLeft(listing.expires_at);
                                  if (d === null) return null;
                                  if (d <= 1) return <span className="ml-1 text-red-500 font-semibold text-xs">⏳ expire demain</span>;
                                  return <span className="ml-1 text-muted-foreground text-xs">{d}j restants</span>;
                                })()}
                              </span>
                              <span className="font-semibold">
                                {listing.price_per_unit} 💰/u · {listing.quantity} dispo
                      {(() => {
                        const hintKey = listing.item_key ||
                          Object.entries(SUGGESTED_PRICES_T1).find(([k]) =>
                            ITEMS[k]?.name === listing.item_name
                          )?.[0] || "";
                        const hint = getPriceHint(hintKey, listing.price_per_unit, priceMultiplier);
                        return hint ? <span className={`ml-1 text-xs ${hint.color}`}>({hint.label})</span> : null;
                      })()}

                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground font-body w-16">Qté : {qty}</span>
                              <Slider
                                min={1} max={listing.quantity} step={1}
                                value={[qty]}
                                onValueChange={([v]) => setBuyQtys(prev => ({ ...prev, [listing.id]: v }))}
                                className="flex-1"
                              />
                              <Input
                                type="number" min={1} max={listing.quantity}
                                value={qty}
                                onChange={e => setBuyQtys(prev => ({
                                  ...prev,
                                  [listing.id]: Math.max(1, Math.min(listing.quantity, Number(e.target.value))),
                                }))}
                                className="w-16 h-7 text-xs text-center"
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground font-body">
                                Prix : <strong>{totalBase} 💰</strong>
                                {taxAmount > 0
                                  ? <span className="text-amber-600"> · taxe ~{Math.ceil(taxAmount)}💰 due au reset</span>
                                  : <span className="text-green-600"> · sans taxe</span>}
                              </span>
                              <Button
                                size="sm" className="font-heading"
                                onClick={() => handleBuy(listing)}
                                disabled={buying === listing.id || !canAfford}
                                variant={canAfford ? "default" : "outline"}
                              >
                                {buying === listing.id ? "..." : canAfford ? `Acheter ×${qty}` : "Pas assez d'or"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── MES ANNONCES ── */}
        <TabsContent value="mine" className="space-y-4 mt-4">
          {myListings.length > 0 ? (
            <div className="space-y-2">
              <h3 className="font-heading font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Mes ventes actives
              </h3>
              <p className="text-xs text-muted-foreground font-body">
                Vous pouvez annuler vos annonces depuis n'importe quelle ville.
              </p>
              {myListings.map(listing => {
                const cat = ITEM_CATEGORIES[listing.item_category];
                return (
                  <Card key={listing.id}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{cat?.icon || "📦"}</span>
                        <div>
                          <ItemTooltip itemName={listing.item_name} side="top">
                            <div className="font-semibold font-body cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2">{listing.item_name}</div>
                          </ItemTooltip>
                          <div className="text-xs text-muted-foreground font-body">
                            ×{listing.quantity} à {listing.price_per_unit} 💰/u
                            {listing.quantity_initial && listing.quantity < listing.quantity_initial && (
                              <span className="ml-2 text-amber-600">
                                ({listing.quantity_initial - listing.quantity} vendus)
                              </span>
                            )}
                            {(() => {
                              const d = getDaysLeft(listing.expires_at);
                              if (d === null) return null;
                              if (d <= 0) return <span className="ml-2 text-red-600 font-semibold">⏳ expirée</span>;
                              if (d === 1) return <span className="ml-2 text-red-500 font-semibold">⏳ expire demain</span>;
                              return <span className="ml-2 text-muted-foreground">{d}j restants</span>;
                            })()}
                          </div>
                        </div>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => handleCancel(listing)}>
                        Annuler
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground font-body">
                Vous n'avez aucune annonce en cours sur les marchés du royaume.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
