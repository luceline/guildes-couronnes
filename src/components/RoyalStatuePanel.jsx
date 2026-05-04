/**
 * RoyalStatuePanel.jsx : Panneau d'offrande à la statue royale.
 *
 * Affiché dans CityView quand la statue est dans la ville actuelle.
 *
 * Mécaniques :
 *   - Le joueur peut donner T1, T2, T3 ou T4 (T5 exclu)
 *   - 1 don par jour par joueur (transaction unique avec panier multi-items)
 *   - La valeur en or virtuel est calculée via calculateDynamicPrices
 *   - Affichage : cumul actuel, palier atteint, indicateur "X or pour Top 3"
 *   - Confirmation modale avant validation (action irréversible)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ITEMS, CRAFTING_RECIPES_REFACTORED } from "@/lib/craftingData";
import { calculateDynamicPrices } from "@/lib/pricingData";
import { getInventoryQty, removeFromInventory } from "@/lib/inventoryHelpers";
import {
  loadActiveStatue,
  invalidateStatueCache,
  getDonationValue,
  getMyContribution,
  getAllContributions,
  computeTop3Gap,
} from "@/lib/royalStatueHelpers";
import { logGold } from "@/lib/goldLog";
import { toast } from "sonner";

// Catégorie de paliers : titre et description
const PALIER_INFOS = [
  { num: 1, label: "Cooldown craft -10%", icon: "⚡" },
  { num: 2, label: "Quête bonus loterie quotidienne", icon: "🎰" },
  { num: 3, label: "Drop combat biome +5%", icon: "🎯" },
  { num: 4, label: "Voyage -20% (péage détruit)", icon: "🐴" },
  { num: 5, label: "Stockage récolte AFK 4 → 10", icon: "📦" },
];

function formatTimeRemaining(targetDate) {
  const ms = targetDate.getTime() - Date.now();
  if (ms <= 0) return "Tirage imminent…";
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  if (d > 0) return `${d}j ${h}h`;
  return `${h}h ${totalMin % 60}min`;
}

export default function RoyalStatuePanel({ profile, city, onRefresh }) {
  const [statue, setStatue] = useState(null);
  const [myContribution, setMyContribution] = useState(null);
  const [allContributions, setAllContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Panier : { itemKey: quantity }
  const [basket, setBasket] = useState({});

  // ─── Chargement des prix dynamiques (pour valoriser les dons) ───
  const [dynamicPrices, setDynamicPrices] = useState(null);
  const [pricesLoading, setPricesLoading] = useState(true);

  // ─── Helpers ───
  const todayStr = new Date().toISOString().split("T")[0];
  const alreadyDonatedToday = myContribution?.offered_today === todayStr;

  // ─── Inventaire filtré : T1 à T4, hors T5 ───
  const eligibleInventory = useMemo(() => {
    const inv = profile?.inventory || [];
    return inv
      .map(slot => ({
        ...slot,
        def: ITEMS[slot.item_key],
      }))
      .filter(slot => slot.def && (slot.def.tier || 1) <= 4 && (slot.quantity || 0) > 0)
      .sort((a, b) => {
        // Tri : tier croissant puis nom
        const tierDiff = (a.def.tier || 1) - (b.def.tier || 1);
        if (tierDiff !== 0) return tierDiff;
        return (a.def.name || "").localeCompare(b.def.name || "");
      });
  }, [profile?.inventory]);

  // ─── Chargement des données ───
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const s = await loadActiveStatue(true);
      setStatue(s);

      if (s) {
        const [mine, all] = await Promise.all([
          getMyContribution(s.cycle_number, profile.user_email),
          getAllContributions(s.cycle_number),
        ]);
        setMyContribution(mine);
        setAllContributions(all);
      }
    } catch (e) {
      console.error("[RoyalStatue] load error:", e);
    } finally {
      setLoading(false);
    }
  }, [profile.user_email]);

  // ─── Chargement initial des prix dynamiques ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPricesLoading(true);
      try {
        const listings = await base44.entities.MarketListing.filter({ status: "active" });
        const prices = calculateDynamicPrices(listings || [], CRAFTING_RECIPES_REFACTORED);
        if (!cancelled) setDynamicPrices(prices);
      } catch (e) {
        console.warn("[RoyalStatue] price calc error:", e);
      } finally {
        if (!cancelled) setPricesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Calculs dérivés sur le panier ───
  const basketSummary = useMemo(() => {
    if (!dynamicPrices) return { totalValue: 0, items: [] };
    let totalValue = 0;
    const items = [];
    for (const [key, qty] of Object.entries(basket)) {
      if (qty <= 0) continue;
      const value = getDonationValue(key, qty, dynamicPrices);
      totalValue += value;
      items.push({ key, qty, value, def: ITEMS[key] });
    }
    return { totalValue, items };
  }, [basket, dynamicPrices]);

  const top3Info = useMemo(() => {
    if (!allContributions || allContributions.length === 0) {
      return { rank: null, gap: 1, isInTop3: false };
    }
    return computeTop3Gap(allContributions, profile.user_email);
  }, [allContributions, profile.user_email]);

  // ─── Modification du panier ───
  const handleBasketChange = (itemKey, newQty) => {
    const max = getInventoryQty(profile.inventory || [], itemKey);
    const sanitized = Math.max(0, Math.min(parseInt(newQty, 10) || 0, max));
    setBasket(prev => {
      const next = { ...prev };
      if (sanitized === 0) delete next[itemKey];
      else next[itemKey] = sanitized;
      return next;
    });
  };

  // ─── Validation de l'offrande ───
  const handleConfirmDonation = async () => {
    if (!statue) {
      toast.error("La statue n'est pas accessible.");
      return;
    }
    if (alreadyDonatedToday) {
      toast.error("Vous avez déjà offert aujourd'hui. Repassez demain !");
      return;
    }
    if (basketSummary.items.length === 0) {
      toast.error("Votre panier est vide.");
      return;
    }
    if (basketSummary.totalValue <= 0) {
      toast.error("La valeur du don est nulle.");
      return;
    }

    setSubmitting(true);
    setConfirmOpen(false);
    try {
      // 1. Retirer les items de l'inventaire
      let updatedInventory = [...(profile.inventory || [])];
      for (const item of basketSummary.items) {
        updatedInventory = removeFromInventory(updatedInventory, item.key, item.qty);
      }

      // 2. Mettre à jour le profil joueur
      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: updatedInventory,
      });

      // 3. Mettre à jour ou créer la contribution du joueur
      const totalItems = basketSummary.items.reduce((s, i) => s + i.qty, 0);
      if (myContribution) {
        await base44.entities.StatueContribution.update(myContribution.id, {
          total_value: (myContribution.total_value || 0) + basketSummary.totalValue,
          items_count: (myContribution.items_count || 0) + totalItems,
          last_offering_at: new Date().toISOString(),
          offered_today: todayStr,
        });
      } else {
        await base44.entities.StatueContribution.create({
          cycle_number: statue.cycle_number,
          player_email: profile.user_email,
          player_name: profile.character_name || "",
          total_value: basketSummary.totalValue,
          items_count: totalItems,
          last_offering_at: new Date().toISOString(),
          offered_today: todayStr,
        });
      }

      // 4. Mettre à jour la statue (cumul global + recalcul palier)
      const newCumul = (statue.current_value || 0) + basketSummary.totalValue;
      const thresholds = Array.isArray(statue.thresholds) && statue.thresholds.length === 5
        ? statue.thresholds
        : [500, 1500, 3000, 6000, 12000];
      let newTier = 0;
      for (let i = 0; i < thresholds.length; i++) {
        if (newCumul >= thresholds[i]) newTier = i + 1;
      }

      await base44.entities.RoyalStatue.update(statue.id, {
        current_value: newCumul,
        bonus_tier_active: newTier,
      });

      // 5. Log (don d'items, pas de transfert d'or, donc on log différemment)
      const itemDesc = basketSummary.items
        .map(i => `${i.qty}× ${i.def?.name || i.key}`)
        .join(", ");
      // On log via GoldTransaction avec amount=0 mais description claire (pour l'historique)
      await base44.entities.GoldTransaction.create({
        player_email: profile.user_email,
        player_name: profile.character_name || "",
        city_id: city.id,
        city_name: city.name || "",
        amount: 0,
        type: "statue_offrande",
        description: `🗿 Offrande à la statue royale (${basketSummary.totalValue} or virtuels) : ${itemDesc}`,
      }).catch(() => {});

      toast.success(`🗿 ${basketSummary.totalValue} or virtuels offerts à la statue. La couronne vous remarque...`);
      setBasket({});
      invalidateStatueCache();
      onRefresh?.();
      loadData();
    } catch (e) {
      console.error("[RoyalStatue] donation error:", e);
      toast.error("L'offrande n'a pu être déposée.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Rendu ───
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-4 text-sm text-muted-foreground italic">
          Chargement de la statue royale…
        </CardContent>
      </Card>
    );
  }

  if (!statue) {
    return (
      <Card>
        <CardContent className="pt-4 text-sm text-muted-foreground italic">
          Aucune statue active actuellement. Repassez plus tard.
        </CardContent>
      </Card>
    );
  }

  const cumul = statue.current_value || 0;
  const thresholds = Array.isArray(statue.thresholds) && statue.thresholds.length === 5
    ? statue.thresholds
    : [500, 1500, 3000, 6000, 12000];
  const activeTier = statue.bonus_tier_active || 0;
  const cycleEnd = new Date(statue.cycle_end);
  const myValue = myContribution?.total_value || 0;

  return (
    <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50/50 to-yellow-50/50">
      <CardContent className="pt-4 space-y-4">
        {/* Hero : la statue */}
        <div className="text-center space-y-2">
          <div className="text-5xl">🗿</div>
          <div className="font-heading text-xl">La Statue Royale</div>
          <div className="text-xs italic text-muted-foreground font-body">
            Une œuvre d'art itinérante. Offrez-lui vos biens, la couronne récompensera les plus généreux.
          </div>
        </div>

        {/* Cumul + paliers */}
        <div className="bg-card border border-amber-200 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="font-heading text-sm">Cumul actuel</span>
            <span className="text-2xl font-heading text-amber-900">{cumul} 💰</span>
          </div>

          {/* Barre de progression sur les 5 paliers */}
          <div className="space-y-2">
            {PALIER_INFOS.map((p, idx) => {
              const seuil = thresholds[idx];
              const reached = activeTier >= p.num;
              const progress = Math.min(100, Math.round((cumul / seuil) * 100));
              return (
                <div key={p.num} className={`p-2 rounded border ${
                  reached
                    ? "bg-green-50 border-green-300"
                    : "bg-muted/30 border-border"
                }`}>
                  <div className="flex justify-between items-center text-xs font-body">
                    <span className={reached ? "font-semibold text-green-800" : ""}>
                      {reached ? "✅" : p.icon} Palier {p.num} : {p.label}
                    </span>
                    <span className={reached ? "font-semibold text-green-700" : "text-muted-foreground"}>
                      {seuil}💰
                    </span>
                  </div>
                  {!reached && (
                    <div className="mt-1 h-1.5 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Infos joueur */}
        <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-xs font-body">
          <div className="flex justify-between">
            <span>Cycle se termine dans :</span>
            <span className="font-semibold">{formatTimeRemaining(cycleEnd)}</span>
          </div>
          <div className="flex justify-between">
            <span>Vos offrandes ce cycle :</span>
            <span className="font-semibold">{myValue} 💰 virtuels</span>
          </div>
          {top3Info.isInTop3 && (
            <div className="flex justify-between bg-green-100 px-2 py-1 rounded">
              <span className="font-semibold text-green-800">🏆 Vous êtes dans le Top 3 !</span>
              <span className="text-green-800">{top3Info.rank}{top3Info.rank === 1 ? "er" : "e"}</span>
            </div>
          )}
          {!top3Info.isInTop3 && allContributions.length >= 3 && (
            <div className="flex justify-between text-amber-700 italic">
              <span>Pour entrer dans le Top 3, il manque :</span>
              <span className="font-semibold">{top3Info.gap} 💰 virtuels</span>
            </div>
          )}
        </div>

        {/* Section offrande */}
        {alreadyDonatedToday ? (
          <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 text-center text-xs font-body italic text-amber-800">
            ✓ Vous avez déjà fait votre offrande aujourd'hui. Repassez demain !
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-3 space-y-2">
            <div className="font-heading text-sm">🎁 Composer votre offrande</div>
            <p className="text-xs italic text-muted-foreground font-body">
              Acceptés : items T1 à T4. Une seule offrande par jour, pas de limite de quantité.
            </p>

            {pricesLoading && (
              <div className="text-xs italic text-muted-foreground font-body">
                Calcul des valeurs en cours…
              </div>
            )}

            {!pricesLoading && eligibleInventory.length === 0 && (
              <div className="text-xs italic text-muted-foreground font-body">
                Aucun item éligible dans votre inventaire.
              </div>
            )}

            {!pricesLoading && eligibleInventory.length > 0 && (
              <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                {eligibleInventory.map(slot => {
                  const value = dynamicPrices ? getDonationValue(slot.item_key, 1, dynamicPrices) : 0;
                  const inBasket = basket[slot.item_key] || 0;
                  return (
                    <div key={slot.item_key} className="flex items-center gap-2 py-1 px-2 hover:bg-muted/30 rounded">
                      <span className="text-lg shrink-0">{slot.def?.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-body font-semibold truncate">{slot.def?.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          T{slot.def?.tier || 1} · ~{value}💰/u · stock {slot.quantity}
                        </div>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={slot.quantity}
                        value={inBasket}
                        onChange={e => handleBasketChange(slot.item_key, e.target.value)}
                        disabled={submitting}
                        className="w-16 h-7 text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Récap panier */}
            {basketSummary.items.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs font-body">
                <div className="font-semibold mb-1">Votre panier :</div>
                {basketSummary.items.map(i => (
                  <div key={i.key} className="flex justify-between">
                    <span>{i.def?.icon} {i.def?.name} × {i.qty}</span>
                    <span className="text-amber-700">{i.value}💰</span>
                  </div>
                ))}
                <div className="border-t border-amber-300 mt-1 pt-1 flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-amber-900">{basketSummary.totalValue}💰 virtuels</span>
                </div>
              </div>
            )}

            <Button
              className="w-full font-heading"
              disabled={submitting || basketSummary.items.length === 0 || pricesLoading}
              onClick={() => setConfirmOpen(true)}
            >
              🗿 Offrir à la statue
            </Button>
          </div>
        )}
      </CardContent>

      {/* Confirmation modale */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">🗿 Confirmer votre offrande</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm font-body">
            <p>
              Vous allez offrir à la statue royale :
            </p>
            <ul className="bg-muted/40 rounded p-2 space-y-1">
              {basketSummary.items.map(i => (
                <li key={i.key} className="flex justify-between">
                  <span>{i.def?.icon} {i.def?.name} × {i.qty}</span>
                  <span className="text-amber-700 font-semibold">{i.value}💰</span>
                </li>
              ))}
            </ul>
            <div className="bg-amber-100 border border-amber-300 rounded p-2 flex justify-between font-semibold">
              <span>Total ajouté à la statue</span>
              <span className="text-amber-900">{basketSummary.totalValue}💰 virtuels</span>
            </div>
            <p className="text-xs italic text-muted-foreground">
              ⚠️ Cette action est <strong>irréversible</strong> et limitée à <strong>1 par jour</strong>.
              Les items quitteront votre inventaire définitivement.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
              className="font-body"
            >
              Reculer
            </Button>
            <Button
              onClick={handleConfirmDonation}
              disabled={submitting}
              className="font-heading"
            >
              {submitting ? "Offrande en cours…" : "Confirmer l'offrande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
