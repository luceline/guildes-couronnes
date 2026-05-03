import { base44 } from "@/api/base44Client";
import { checkAndAwardObjective, filterTodayActiveObjectives } from "@/lib/questRewards";
import { computeDebtRepayment, getTotalDebt } from "../lib/debtRepayment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getInventoryWeight, getEffectiveMaxWeight, wouldExceedCapacity, getMarketTaxDiscount } from "../lib/gameData";
import { ITEMS, EQUIPMENT_KEYS } from "../lib/craftingData";
import { getItemName, getCanonicalItemKey } from "../lib/itemHelpers";
import { removeFromInventory } from "../lib/inventoryHelpers";
import { SUGGESTED_PRICES_T1, SUGGESTED_PRICES_SPECIAL, getPriceMultiplier, getSuggestedPrice, calculateDynamicPrices } from "../lib/pricingData";
import { CRAFTING_RECIPES_REFACTORED } from "../lib/recipePatterns";
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
  const [filterCity, setFilterCity] = useState("all"); // "all" = marché unifié, "local" = ville actuelle
  const [priceMultiplier, setPriceMultiplier] = useState(1.0);
  const [dynamicPrices, setDynamicPrices] = useState({});
  const [worldEvents, setWorldEvents] = useState(null);
  const [allCities, setAllCities] = useState([]); // toutes les villes (pour tax_rate par city_id du listing)

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
    const [allListings, allMyListings, citiesData] = await Promise.all([
      // MARCHÉ UNIFIÉ : toutes les annonces actives, toutes villes confondues
      base44.entities.MarketListing.filter(
        { status: "active" },
        "-created_date",
        500
      ),
      // Toutes mes annonces actives (annulables depuis n'importe où)
      base44.entities.MarketListing.filter(
        { seller_email: profile.user_email, status: "active" }
      ),
      // Toutes les villes (pour tax_rate par city_id du listing)
      base44.entities.City.list().catch(() => []),
    ]);
    const today = new Date().toISOString().split("T")[0];
    setListings(allListings.filter(l =>
      l.seller_email !== profile.user_email &&
      (!l.expires_at || l.expires_at >= today)
    ));
    setMyListings(allMyListings);
    setAllCities(citiesData);

    // Recalcule les prix dynamiques T2-T5 frontend, basé sur les vrais prix T1 du marché
    // Si pas encore d'annonces T1, fallback sur SUGGESTED_PRICES_T1 (médians)
    try {
      const calc = calculateDynamicPrices(allListings || [], CRAFTING_RECIPES_REFACTORED);
      setDynamicPrices(calc);
    } catch (e) {
      console.warn("[Market] dynamic prices calc failed:", e);
    }

    setLoading(false);
  }

  // Taux de taxe pour une ville donnée (utilisé pour la ville du vendeur lors d'un achat)
  // MARCHÉ UNIFIÉ : la taxe appliquée est celle de la ville où l'objet est physiquement.
  function getTaxRateForCity(cityId) {
    if (!cityId) return 0;
    const c = allCities.find(x => x.id === cityId);
    if (!c) return 0;
    const baseTaxRate = c.tax_rate || 10;
    const cum = c.treasury_cumulative || 0;
    let discount = 0;
    if (cum >= 35000) discount = 15;
    else if (cum >= 15000) discount = 10;
    else if (cum >= 6000) discount = 5;
    return Math.max(0, baseTaxRate - discount);
  }

  // Taux de taxe de la ville actuelle (pour l'affichage, et pour la pose de listing par le vendeur)
  function getTaxRate(cityBuildings) {
    if (!city) return 0;
    return getTaxRateForCity(city.id);
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
    const filteredInv = (profile.inventory || []).filter(i => i.quantity > 0);
    const rawItem = filteredInv[idx];
    if (!rawItem || sellForm.quantity <= 0 || sellForm.quantity > rawItem.quantity) {
      toast.error("La quantité indiquée n'est pas valide : vérifiez votre saisie.");
      return;
    }
    // Résoudre item_key manquant depuis ITEMS par item_name
    const resolvedKey = rawItem.item_key ||
      Object.entries(ITEMS).find(([, def]) => def.name === rawItem.item_name)?.[0] || "";
    const item = { ...rawItem, item_key: resolvedKey };
    const itemDef = ITEMS[item.item_key];

    // ── REFONTE v5 : Items avec compteur (charges/durabilité) doivent être full pour être vendus ──
    // Bourse : doit avoir ses 5 charges intactes
    if (item.item_key === "bourse_protection") {
      const usesLeft = profile.bourse_uses_left ?? 5;
      if (usesLeft < 5) {
        toast.error(`👜 Cette bourse a déjà servi (${usesLeft}/5 attaques restantes). Seules les bourses neuves (5/5) peuvent être mises en vente.`);
        return;
      }
    }
    // Tous les items à durabilité (épée, armures, bouclier, outils utilitaires) :
    // l'instance vendue doit avoir sa durabilité au max.
    if (itemDef?.durability !== undefined || item.durability !== undefined) {
      const currentDura = item.durability ?? itemDef?.durability ?? 0;
      const maxDura = itemDef?.durability ?? 10;
      if (currentDura < maxDura) {
        toast.error(`🛡️ Cet objet a déjà servi (${currentDura}/${maxDura}). Seuls les objets neufs (au maximum de leur durabilité) peuvent être mis en vente. Réparez-le d'abord ou craftez-en un neuf.`);
        return;
      }
    }

    // Vérifier le bon d'autorisation (sauf pour l'Autorisation elle-même)
    if (!getHasPermitForItem(item.item_key)) {
      toast.error("📜 Les gardes du marché vous barrent la route : il vous faut une Autorisation de mise sur le marché pour exposer vos marchandises !");
      return;
    }
    // Consommer l'autorisation SAUF si c'est l'Autorisation qu'on vend
    let inventoryAfterPermit = [...(profile.inventory || [])];
    if (!isPermit(item)) {
      inventoryAfterPermit = removeFromInventory(inventoryAfterPermit, "autorisation_marche", 1);
    }

    // Construction du listing : on capture grade et durability si présents,
    // pour qu'ils soient transmis fidèlement à l'acheteur (REFONTE v5).
    const listingData = {
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
    };
    if (item.grade !== undefined) listingData.item_grade = item.grade;
    if (item.durability !== undefined) listingData.item_durability = item.durability;

    await base44.entities.MarketListing.create(listingData);
    // Déduire depuis l'inventaire en ciblant l'INSTANCE EXACTE (par index dans la liste filtrée).
    // Pour les équipements, chaque instance est une ligne distincte avec son grade/durability.
    // On ne peut donc pas se contenter de matcher par item_key (sinon on retire la mauvaise instance
    // si le joueur a plusieurs lignes du même type avec des grades/dura différents).
    const targetInInventory = inventoryAfterPermit.findIndex(i =>
      i.item_key === item.item_key &&
      (i.grade ?? 0) === (item.grade ?? 0) &&
      (i.durability ?? null) === (item.durability ?? null)
    );
    let newInventory;
    if (targetInInventory >= 0) {
      newInventory = inventoryAfterPermit.map((i, j) =>
        j === targetInInventory ? { ...i, quantity: i.quantity - sellForm.quantity } : i
      ).filter(i => i.quantity > 0);
    } else {
      // Fallback (ne devrait pas arriver) : ancien comportement par item_key
      newInventory = inventoryAfterPermit.map(i => {
        if (item.item_key && i.item_key === item.item_key) return { ...i, quantity: i.quantity - sellForm.quantity };
        if (!item.item_key && i.item_name === item.item_name) return { ...i, quantity: i.quantity - sellForm.quantity };
        return i;
      }).filter(i => i.quantity > 0);
    }

    await base44.entities.PlayerProfile.update(profile.id, { inventory: newInventory });
    toast.success(`🏷️ Votre étale est dressée sur le marché de ${city?.name} : que les acheteurs affluent !`);
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
  // MARCHÉ UNIFIÉ : la taxe appliquée est celle de la ville du listing (= ville du vendeur),
  // pas celle de la ville où l'acheteur se trouve actuellement.
  const handleBuy = async (listing) => {
    const qty = buyQtys[listing.id] || listing.quantity;
    const totalBase = listing.price_per_unit * qty;
    // Taux de taxe = taux de la ville du listing (et non de la ville actuelle de l'acheteur)
    const listingTaxRate = getTaxRateForCity(listing.city_id);
    // Taxe calculée pour affichage uniquement — prélevée au reset
    // Taxe exacte sans arrondi — on cumule les centimes, arrondi au reset uniquement
    const taxAmount = listingTaxRate > 0 ? totalBase * listingTaxRate / 100 : 0;
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
      toast.error("La quantité indiquée n'est pas valide : vérifiez votre saisie.");
      return;
    }
    // MARCHÉ UNIFIÉ v2 : la vérification du poids n'a lieu qu'à l'achat LOCAL.
    // Pour les achats à distance, le poids est vérifié au moment du retrait du colis.
    const isRemote = listing.city_id && listing.city_id !== profile.city_id;
    if (!isRemote && wouldExceedCapacity(profile, qty)) {
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
    const itemDef = ITEMS[resolvedItemKey];

    // ── MARCHÉ UNIFIÉ v2 : livraison physique ──
    // Si l'acheteur N'EST PAS dans la ville du listing, on crée un "colis en attente" :
    //   - L'or est immédiatement débité (et le vendeur crédité, voir plus bas)
    //   - L'item ne va PAS dans l'inventaire, mais dans pending_packages[]
    //   - Le poids n'est PAS vérifié à l'achat (seulement au retrait)
    //   - L'acheteur devra voyager dans la bonne ville pour retirer son colis
    // Si l'acheteur EST dans la ville du listing, livraison directe à l'inventaire.
    const isRemotePurchase = listing.city_id && listing.city_id !== profile.city_id;
    const listingCity = allCities.find(c => c.id === listing.city_id);

    // Détection des items à instance unique (équipement/bourse/outils)
    const isInstanceItem = itemDef && (
      itemDef.durability !== undefined ||
      itemDef.category === "armes_combat" ||
      itemDef.category === "armures_combat" ||
      resolvedItemKey === "bourse_protection"
    );

    // Normaliser les item_key manquants dans l'inventaire existant (pour les achats locaux)
    let newInventory = (profile.inventory || []).map(i => {
      if (i.item_key) return i;
      const found = Object.entries(ITEMS).find(([, def]) => def.name === i.item_name);
      return found ? { ...i, item_key: found[0] } : i;
    });
    // Si achat à distance : on prépare la liste des colis (un colis par instance pour items à instance,
    // sinon un seul colis avec quantity=qty)
    let newPendingPackages = Array.isArray(profile.pending_packages) ? [...profile.pending_packages] : [];

    if (isRemotePurchase) {
      // Créer le(s) colis selon le type d'item
      if (isInstanceItem) {
        for (let n = 0; n < qty; n++) {
          const pkg = {
            package_id:    `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${n}`,
            listing_id:    listing.id,
            city_id:       listing.city_id,
            city_name:     listingCity?.name || "",
            item_name:     listing.item_name,
            item_key:      resolvedItemKey,
            item_category: itemDef?.category || listing.item_category,
            quantity:      1,
            purchased_at:  new Date().toISOString(),
          };
          if (listing.item_grade !== undefined && listing.item_grade > 0) {
            pkg.item_grade = listing.item_grade;
          } else {
            pkg.item_grade = 0;
          }
          if (listing.item_durability !== undefined && listing.item_durability > 0) {
            pkg.item_durability = listing.item_durability;
          } else if (itemDef?.durability !== undefined) {
            pkg.item_durability = itemDef.durability;
          }
          newPendingPackages.push(pkg);
        }
      } else {
        // Item normal : un seul colis stackable
        newPendingPackages.push({
          package_id:    `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          listing_id:    listing.id,
          city_id:       listing.city_id,
          city_name:     listingCity?.name || "",
          item_name:     listing.item_name,
          item_key:      resolvedItemKey,
          item_category: itemDef?.category || listing.item_category,
          quantity:      qty,
          purchased_at:  new Date().toISOString(),
        });
      }
    } else {
      // Achat local : livraison directe à l'inventaire (comportement identique à avant)
      if (isInstanceItem) {
        for (let n = 0; n < qty; n++) {
          const newLine = {
            item_name:     listing.item_name,
            item_key:      resolvedItemKey,
            item_category: itemDef?.category || listing.item_category,
            quantity:      1,
          };
          if (listing.item_grade !== undefined && listing.item_grade > 0) {
            newLine.grade = listing.item_grade;
          } else {
            newLine.grade = 0;
          }
          if (listing.item_durability !== undefined && listing.item_durability > 0) {
            newLine.durability = listing.item_durability;
          } else if (itemDef?.durability !== undefined) {
            newLine.durability = itemDef.durability;
          }
          newInventory.push(newLine);
        }
      } else {
        const existing = newInventory.find(i => i.item_key === resolvedItemKey);
        if (existing) {
          existing.quantity += qty;
          if (itemDef?.category && existing.item_category !== itemDef.category) {
            existing.item_category = itemDef.category;
          }
        } else {
          newInventory.push({
            item_name:     listing.item_name,
            item_key:      resolvedItemKey,
            item_category: itemDef?.category || listing.item_category,
            quantity:      qty,
          });
        }
      }
    }

    let finalInventory = newInventory;
    if (hasParchemin) {
      finalInventory = removeFromInventory(finalInventory, "parchemin", 1);
    }

    // ── Accumuler la taxe par ville (city_id → montant) ──
    // MARCHÉ UNIFIÉ : taxe versée à la trésorerie de la ville du listing (= ville du vendeur),
    // car c'est elle qui "héberge" l'objet vendu.
    const pendingTax = { ...(profile.pending_market_tax || {}) };
    if (taxToAccumulate > 0 && listing.city_id) {
      pendingTax[listing.city_id] = (pendingTax[listing.city_id] || 0) + taxToAccumulate;
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

    // REFONTE v5 : si l'acheteur reçoit une bourse de protection neuve et n'en a pas déjà une,
    // on initialise bourse_uses_left = 5 (sinon le fallback null→5 fait l'affaire, mais on est explicite).
    // MARCHÉ UNIFIÉ v2 : pending_packages est persisté (livraison physique différée).
    const buyerUpdates = {
      inventory:          finalInventory,
      gold:               (profile.gold || 0) - totalBase,  // prix pur seulement
      sceau_balance:      newSceauBalance,
      pending_market_tax: pendingTax,
      pending_packages:   newPendingPackages,
    };
    // Pour la bourse : seulement si livraison locale (sinon on initialisera au retrait)
    const isBuyingBourse = listing.item_key === "bourse_protection";
    const hadBourseBefore = (profile.inventory || []).some(
      i => i.item_key === "bourse_protection" && (i.quantity || 0) > 0
    );
    if (!isRemotePurchase && isBuyingBourse && !hadBourseBefore) {
      buyerUpdates.bourse_uses_left = 5;
    }
    await base44.entities.PlayerProfile.update(profile.id, buyerUpdates);

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
        `Vente ${qty}× ${getItemName(listing.item_key, listing.item_name)}${taxBonus > 0 ? ` (+${taxBonus} bonus Marchand)` : ""}${caravaneBonus > 0 ? ` (+${caravaneBonus} bonus Caravane)` : ""}${sellerRepaid > 0 ? ` (−${sellerRepaid} remboursement dette)` : ""}`
      );
    }

    await logGold(profile.user_email, profile.character_name, city?.id, city?.name,
      -totalBase, "achat",
      `Achat ${qty}× ${getItemName(listing.item_key, listing.item_name)}${effectiveTaxAmount > 0 ? ` (taxe ${effectiveTaxAmount}💰 due au reset)` : ""}`
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
      ? " (📜 Parchemin : exonéré de taxe !)"
      : taxFromSceau > 0 && taxToAccumulate === 0
        ? ` (🏵️ taxe couverte par le Sceau royal)`
        : taxToAccumulate > 0
          ? ` (taxe ${taxToAccumulate}💰 due au reset${taxDiscountRate > 0 ? ` −${Math.round(taxDiscountRate*100)}%` : ""})`
          : "";
    if (isRemotePurchase) {
      toast.success(`📦 Commande passée ! ${qty}× ${getItemName(listing.item_key, listing.item_name)} vous attend à ${listingCity?.name || "destination"}${taxMsg}. Voyagez sur place pour récupérer votre colis.`);
    } else {
      toast.success(`🤝 Affaire conclue ! ${qty}× ${getItemName(listing.item_key, listing.item_name)} acquis pour ${totalBase} 💰${taxMsg}`);
    }

    setBuying(null);
    setBuyQtys(prev => ({ ...prev, [listing.id]: 1 }));
    onRefresh?.();
    loadAll();
  };

  // ── PICKUP : récupérer un colis en attente (achat à distance) ──
  // L'acheteur doit être physiquement dans la ville du colis (sauf via relais postal de la ville actuelle).
  const [pickingUp, setPickingUp] = useState(null);
  const RELAIS_FEE = 5; // or détruit (sink) pour livraison à distance via Relais postal
  const handlePickup = async (pkg, options = {}) => {
    const viaRelais = !!options.viaRelais;
    if (pickingUp) return;

    // Cas livraison "physique" : il faut être dans la ville du colis
    if (!viaRelais && pkg.city_id !== profile.city_id) {
      toast.error(`📦 Vous devez être à ${pkg.city_name || "la ville de livraison"} pour récupérer ce colis.`);
      return;
    }

    // Cas relais postal : la ville actuelle doit avoir un relais ET on doit avoir 5💰
    if (viaRelais) {
      const hasRelais = (city?.buildings || []).some(b => b.building_type === "relais");
      if (!hasRelais) {
        toast.error("📮 Cette ville n'a pas de Relais postal pour la livraison à distance.");
        return;
      }
      if ((profile.gold || 0) < RELAIS_FEE) {
        toast.error(`📮 Le Relais postal coûte ${RELAIS_FEE}💰 mais vous n'en avez que ${profile.gold || 0}💰.`);
        return;
      }
    }

    // Vérification du poids au moment du retrait (toujours)
    if (wouldExceedCapacity(profile, pkg.quantity || 1)) {
      const w = getInventoryWeight(profile);
      const max = getEffectiveMaxWeight(profile);
      toast.error(`🎒 Inventaire trop chargé pour récupérer ce colis (${w}/${max}). Allégez-vous d'abord.`);
      return;
    }
    setPickingUp(pkg.package_id);
    try {
      const itemDef = ITEMS[pkg.item_key];
      // Construit la nouvelle inventaire en intégrant le colis
      let newInventory = (profile.inventory || []).map(i => {
        if (i.item_key) return i;
        const found = Object.entries(ITEMS).find(([, def]) => def.name === i.item_name);
        return found ? { ...i, item_key: found[0] } : i;
      });
      const isInstanceItem = itemDef && (
        itemDef.durability !== undefined ||
        itemDef.category === "armes_combat" ||
        itemDef.category === "armures_combat" ||
        pkg.item_key === "bourse_protection"
      );
      if (isInstanceItem) {
        // Pour les items à instance, le colis est toujours quantity:1 (un colis par exemplaire)
        const newLine = {
          item_name:     pkg.item_name,
          item_key:      pkg.item_key,
          item_category: itemDef?.category || pkg.item_category,
          quantity:      1,
        };
        if (pkg.item_grade !== undefined && pkg.item_grade > 0) newLine.grade = pkg.item_grade;
        else newLine.grade = 0;
        if (pkg.item_durability !== undefined && pkg.item_durability > 0) newLine.durability = pkg.item_durability;
        else if (itemDef?.durability !== undefined) newLine.durability = itemDef.durability;
        newInventory.push(newLine);
      } else {
        const existing = newInventory.find(i => i.item_key === pkg.item_key);
        if (existing) {
          existing.quantity += (pkg.quantity || 1);
          if (itemDef?.category && existing.item_category !== itemDef.category) {
            existing.item_category = itemDef.category;
          }
        } else {
          newInventory.push({
            item_name:     pkg.item_name,
            item_key:      pkg.item_key,
            item_category: itemDef?.category || pkg.item_category,
            quantity:      pkg.quantity || 1,
          });
        }
      }
      // Retire ce colis de pending_packages
      const newPendingPackages = (profile.pending_packages || []).filter(p => p.package_id !== pkg.package_id);

      // Init bourse_uses_left si on retire une bourse neuve et qu'on n'en avait pas
      const updates = {
        inventory:        newInventory,
        pending_packages: newPendingPackages,
      };
      // Cas relais : débite 5💰 (or détruit, sink)
      if (viaRelais) {
        updates.gold = (profile.gold || 0) - RELAIS_FEE;
      }
      if (pkg.item_key === "bourse_protection") {
        const hadBourseBefore = (profile.inventory || []).some(
          i => i.item_key === "bourse_protection" && (i.quantity || 0) > 0
        );
        if (!hadBourseBefore && (profile.bourse_uses_left ?? null) === null) {
          updates.bourse_uses_left = 5;
        }
      }
      await base44.entities.PlayerProfile.update(profile.id, updates);

      // Log la dépense relais
      if (viaRelais) {
        await logGold(profile.user_email, profile.character_name, city?.id, city?.name,
          -RELAIS_FEE, "service_atelier",
          `Relais postal : livraison ${pkg.quantity || 1}× ${pkg.item_name} depuis ${pkg.city_name || "ville inconnue"}`
        ).catch(() => {});
      }

      const successMsg = viaRelais
        ? `📮 Livraison express ! ${pkg.quantity || 1}× ${pkg.item_name} reçu via Relais postal (−${RELAIS_FEE}💰).`
        : `📦 Colis récupéré : ${pkg.quantity || 1}× ${pkg.item_name} ajouté à votre inventaire !`;
      toast.success(successMsg);
      onRefresh?.();
      loadAll();
    } catch (e) {
      console.error("Pickup error:", e);
      toast.error("Erreur lors de la récupération du colis.");
    } finally {
      setPickingUp(null);
    }
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
  const categoryFiltered = filterCategory === "all"
    ? listings
    : listings.filter(l => l.item_category === filterCategory);

  // Filtre ville : "all" = marché unifié (toutes villes), "local" = ville actuelle uniquement
  const filteredListings = filterCity === "local"
    ? categoryFiltered.filter(l => l.city_id === profile.city_id)
    : categoryFiltered;

  // Regroupement par clé canonique : on traduit les anciens listings (item_key
  // vide ou item_key obsolète) vers la clé d'aujourd'hui via getCanonicalItemKey.
  // Ainsi, les annonces legacy "Pierre" et "Pierre brute" fusionnent dans le
  // même groupe que les annonces modernes "pierre_brute" et le titre est unique.
  const listingsByItem = {};
  for (const l of filteredListings) {
    const groupKey = getCanonicalItemKey(l.item_key, l.item_name) || l.item_name;
    if (!listingsByItem[groupKey]) listingsByItem[groupKey] = [];
    listingsByItem[groupKey].push(l);
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
          <h2 className="font-heading text-2xl font-bold heading-medieval">🌍 Marché unifié</h2>
          <p className="text-muted-foreground text-sm font-body">
            💰 Taxe en vendant à <strong>{city.name}</strong> : {taxRate}%
            {city.tax_rate_next !== undefined && city.tax_rate_next !== null && (
              <span className="ml-2 text-amber-600">→ {city.tax_rate_next}% demain</span>
            )}
            {" · "}Maire : {city.mayor_name || "Aucun"}
          </p>
          <p className="text-xs text-muted-foreground font-body italic">
            Toutes les annonces de toutes les villes sont visibles : la taxe appliquée est celle de la ville du vendeur.
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
                  onFocus={e => e.target.select()}
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

      <MarketInsights />

      <Tabs defaultValue="buy">
        <TabsList className="font-heading flex-wrap h-auto gap-1">
          <TabsTrigger value="buy">🛒 Acheter ({listings.length})</TabsTrigger>
          <TabsTrigger value="mine">📦 Mes annonces ({myListings.length})</TabsTrigger>
          <TabsTrigger value="orders">🚚 Mes commandes ({(profile.pending_packages || []).length})</TabsTrigger>
        </TabsList>

        {/* ── BUY TAB ── */}
        <TabsContent value="buy" className="space-y-3 mt-4">

          <div className="flex flex-wrap gap-2">
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
            <select
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
              className="border border-border rounded-lg px-3 py-1.5 text-xs font-body bg-background"
            >
              <option value="all">🌍 Marché unifié (toutes villes)</option>
              <option value="local">📍 Ma ville uniquement ({city?.name || "—"})</option>
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : Object.keys(listingsByItem).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground font-body">
                {filterCity === "local"
                  ? `Les étales de ${city?.name || "cette ville"} sont désertes : essayez le marché unifié pour voir d'autres villes.`
                  : "Aucune annonce en cours sur le marché unifié — revenez quand les artisans auront sorti leurs marchandises."}
              </CardContent>
            </Card>
          ) : (
            Object.entries(listingsByItem).map(([groupKey, itemListings]) => {
              const cat = ITEM_CATEGORIES[itemListings[0].item_category];
              // groupKey est déjà canonique (passé par getCanonicalItemKey).
              // Le nom à afficher vient donc de ITEMS[groupKey] en priorité.
              const firstListing = itemListings[0];
              const displayName = getItemName(groupKey, firstListing.item_name);

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
                <Card key={groupKey}>
                  <CardHeader className="pb-2">
                    <CardTitle className="font-heading text-base flex items-center gap-2">
                      <span>{cat?.icon || "📦"}</span>
                      <ItemTooltip itemName={displayName} side="top">
                        <span className="cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2">{displayName}</span>
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
                        // MARCHÉ UNIFIÉ : taxe selon la ville du listing (pas celle de l'acheteur)
                        const listingTaxRate = getTaxRateForCity(listing.city_id);
                        // Taxe exacte sans arrondi — on cumule les centimes, arrondi au reset uniquement
                        const taxAmount = listingTaxRate > 0 ? totalBase * listingTaxRate / 100 : 0;
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
                                  // MARCHÉ UNIFIÉ : indiquer la ville du listing avec son taux de taxe
                                  const listingCity = allCities.find(c => c.id === listing.city_id);
                                  if (!listingCity) return null;
                                  const isLocal = listing.city_id === profile.city_id;
                                  return (
                                    <span className={`ml-2 inline-block text-xs font-semibold px-1.5 py-0.5 rounded border ${
                                      isLocal
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                        : "bg-sky-100 text-sky-800 border-sky-300"
                                    }`} title={`Taxe : ${listingTaxRate}% (versée à ${listingCity.name})`}>
                                      📍 {listingCity.name}{listingTaxRate > 0 ? ` · ${listingTaxRate}%` : " · 0%"}
                                    </span>
                                  );
                                })()}
                                {(() => {
                                  const d = getDaysLeft(listing.expires_at);
                                  if (d === null) return null;
                                  if (d <= 1) return <span className="ml-1 text-red-500 font-semibold text-xs">⏳ expire demain</span>;
                                  return <span className="ml-1 text-muted-foreground text-xs">{d}j restants</span>;
                                })()}
                                {listing.item_grade !== undefined && listing.item_grade > 0 && (
                                  <span className="ml-2 inline-block bg-violet-100 text-violet-800 text-xs font-semibold px-1.5 py-0.5 rounded border border-violet-300">
                                    Grade {listing.item_grade}
                                  </span>
                                )}
                                {listing.item_durability !== undefined && (
                                  <span className="ml-1 inline-block bg-slate-100 text-slate-700 text-xs px-1.5 py-0.5 rounded border border-slate-300">
                                    🛡️ {listing.item_durability}/{listing.item_durability}
                                  </span>
                                )}
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
                                onFocus={e => e.target.select()}
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground font-body">
                                Prix : <strong>{totalBase} 💰</strong>
                                {taxAmount > 0
                                  ? <span className="text-amber-600"> · taxe ~{Math.ceil(taxAmount)}💰 due au reset</span>
                                  : <span className="text-green-600"> · sans taxe</span>}
                                {listing.city_id !== profile.city_id && (
                                  <span className="block text-sky-700 italic mt-0.5">
                                    📦 Achat à distance : voyage requis pour récupérer le colis
                                  </span>
                                )}
                              </span>
                              <Button
                                size="sm" className="font-heading"
                                onClick={() => handleBuy(listing)}
                                disabled={buying === listing.id || !canAfford}
                                variant={canAfford ? "default" : "outline"}
                              >
                                {buying === listing.id
                                  ? "..."
                                  : !canAfford
                                    ? "Pas assez d'or"
                                    : listing.city_id !== profile.city_id
                                      ? `📦 Commander ×${qty}`
                                      : `Acheter ×${qty}`}
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
                          <ItemTooltip itemName={getItemName(listing.item_key, listing.item_name)} side="top">
                            <div className="font-semibold font-body cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2">{getItemName(listing.item_key, listing.item_name)}</div>
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

        {/* ── ORDERS TAB : colis en attente de récupération physique ── */}
        <TabsContent value="orders" className="space-y-3 mt-4">
          <Card>
            <CardContent className="py-3 px-4 bg-amber-50 border-amber-200">
              <p className="text-sm font-body text-amber-900">
                📦 <strong>Vos commandes en attente.</strong> Pour récupérer un colis, voyagez à la ville où il est entreposé. Si la ville où vous êtes a un <strong>📮 Relais postal</strong>, vous pouvez vous faire livrer directement contre {RELAIS_FEE}💰.
              </p>
            </CardContent>
          </Card>
          {(() => {
            const packages = profile.pending_packages || [];
            if (packages.length === 0) {
              return (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground font-body">
                    Aucune commande en attente. Achetez sur le marché unifié pour commander à distance !
                  </CardContent>
                </Card>
              );
            }
            // La ville actuelle a-t-elle un Relais postal ?
            const hasRelaisHere = (city?.buildings || []).some(b => b.building_type === "relais");
            // Regrouper par ville pour rendre la lecture plus lisible
            const byCity = {};
            for (const p of packages) {
              const cid = p.city_id || "?";
              if (!byCity[cid]) byCity[cid] = [];
              byCity[cid].push(p);
            }
            return Object.entries(byCity).map(([cid, pkgs]) => {
              const cityName = pkgs[0].city_name || "Ville inconnue";
              const isHere = cid === profile.city_id;
              return (
                <Card key={cid} className={isHere ? "border-emerald-300 bg-emerald-50" : ""}>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-heading text-base flex items-center gap-2">
                      📍 {cityName}
                      {isHere
                        ? <span className="text-xs font-body text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">Vous y êtes !</span>
                        : <span className="text-xs font-body text-muted-foreground">(voyagez sur place ou utilisez un Relais)</span>
                      }
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pkgs.map(pkg => (
                      <div key={pkg.package_id} className="flex items-center justify-between gap-2 border border-border rounded-lg p-2 bg-card">
                        <div className="text-sm font-body">
                          <span className="font-semibold">{pkg.quantity}× {pkg.item_name}</span>
                          {pkg.item_grade !== undefined && pkg.item_grade > 0 && (
                            <span className="ml-2 inline-block bg-violet-100 text-violet-800 text-xs font-semibold px-1.5 py-0.5 rounded border border-violet-300">
                              Grade {pkg.item_grade}
                            </span>
                          )}
                          {pkg.item_durability !== undefined && (
                            <span className="ml-1 inline-block bg-slate-100 text-slate-700 text-xs px-1.5 py-0.5 rounded border border-slate-300">
                              🛡️ {pkg.item_durability}/{pkg.item_durability}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {/* Bouton récupération physique : actif uniquement si on est dans la bonne ville */}
                          <Button
                            size="sm"
                            variant={isHere ? "default" : "outline"}
                            disabled={!isHere || pickingUp === pkg.package_id}
                            onClick={() => handlePickup(pkg, { viaRelais: false })}
                            className="font-heading"
                          >
                            {pickingUp === pkg.package_id ? "..." : isHere ? "📦 Récupérer" : "🐴 Voyagez"}
                          </Button>
                          {/* Bouton relais postal : visible uniquement si on est ailleurs ET la ville actuelle a un relais */}
                          {!isHere && hasRelaisHere && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={pickingUp === pkg.package_id || (profile.gold || 0) < RELAIS_FEE}
                              onClick={() => handlePickup(pkg, { viaRelais: true })}
                              className="font-heading"
                              title={`Livraison express via Relais postal (${RELAIS_FEE}💰)`}
                            >
                              📮 Livrer ({RELAIS_FEE}💰)
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            });
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
