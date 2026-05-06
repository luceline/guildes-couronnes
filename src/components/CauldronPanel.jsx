/**
 * CauldronPanel.jsx : Le Chaudron Magique du joueur.
 *
 * Affiché en haut de la page Production. Trois états :
 *   1. Pas de chaudron → panneau de fabrication (8 T1 + 50 or)
 *   2. Chaudron actif → utilisation quotidienne + nourrissage
 *   3. Chaudron déjà utilisé aujourd'hui → message d'attente
 *
 * Fonctionnalités :
 *   - Création du chaudron (consomme 8 T1 + 50 or)
 *   - Utilisation quotidienne (consomme inputs aléatoires du jour, donne un output aléatoire)
 *   - Animation de révélation du loot (~3s suspense)
 *   - Évolution rang 1 → 2 → 3 via "Nourrir" (donner des items qui s'accumulent en or virtuel)
 *   - Sélecteur de ville cible pour Parchemin marchand, Étoile filante, Hibou messager
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ITEMS } from "@/lib/craftingData";
import { CRAFTING_RECIPES_REFACTORED } from "@/lib/recipePatterns";
import { calculateDynamicPrices } from "@/lib/pricingData";
import { getInventoryQty, removeFromInventory, addToInventory } from "@/lib/inventoryHelpers";
import {
  loadMyCauldron,
  invalidateCauldronCache,
  loadDailyInputs,
  getInputsForRank,
  hasUsedCauldronToday,
  rollOutput,
  computeFeedValue,
  getNextRankThreshold,
  CAULDRON_CREATION_COST,
  CAULDRON_OUTPUTS,
} from "@/lib/cauldronHelpers";
import { logGold } from "@/lib/goldLog";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────
function getRankLabel(rank) {
  if (rank === 1) return "Rang 1 (T1)";
  if (rank === 2) return "Rang 2 (T1-T2)";
  if (rank === 3) return "Rang 3 (T1-T3)";
  return "Rang ?";
}

function getRankColor(rank) {
  if (rank === 1) return "bg-stone-100 border-stone-300 text-stone-800";
  if (rank === 2) return "bg-amber-100 border-amber-300 text-amber-800";
  if (rank === 3) return "bg-purple-100 border-purple-300 text-purple-800";
  return "";
}

// ─── Sous-composant : carte d'une recette pour un rang donné ─────────────
/**
 * Affiche la liste d'ingrédients du jour pour un rang précis, le bouton
 * d'invocation et l'état (déjà utilisé / ingrédients manquants / prêt).
 *
 * Props :
 *   - rank        : 1 | 2 | 3
 *   - status      : { required: [...], hasAll: bool, missing: [...] }
 *   - alreadyUsed : bool : le rang a-t-il déjà été cuisiné aujourd'hui
 *   - profile     : pour afficher le stock courant
 *   - submitting  : true si une cuisson est en cours
 *   - onUse       : callback (rank) lors du clic sur "Invoquer"
 *   - compact     : true → version condensée (mobile dans tabs)
 */
function RankRecipeCard({ rank, status, alreadyUsed, profile, submitting, onUse, compact = false }) {
  const required = status?.required || [];

  if (alreadyUsed) {
    return (
      <div className="bg-purple-100 border border-purple-300 rounded-lg p-3 text-center text-xs font-body italic text-purple-800">
        ✓ Recette du rang {rank} déjà invoquée aujourd'hui. Repassez demain à l'aube.
      </div>
    );
  }

  if (required.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center text-xs font-body italic text-amber-800">
        ⏳ Pas d'ingrédients tirés pour le rang {rank} aujourd'hui.
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-lg p-3 space-y-2 ${compact ? "" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-xs font-body font-semibold">
          Recette du rang {rank}
        </div>
        <Badge className={`text-[10px] ${getRankColor(rank)}`}>R{rank}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {required.map(req => {
          const has = getInventoryQty(profile.inventory || [], req.key);
          const ok = has >= req.qty;
          const def = ITEMS[req.key];
          return (
            <span
              key={req.key}
              className={`text-xs px-2 py-0.5 rounded-full border font-body ${
                ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {def?.icon} ×{req.qty} ({has})
            </span>
          );
        })}
      </div>
      <Button
        className="w-full font-heading"
        size={compact ? "sm" : "default"}
        disabled={!status.hasAll || submitting}
        onClick={() => onUse(rank)}
      >
        {submitting ? "Sortilège en cours..." : status.hasAll ? `🪄 Invoquer rang ${rank}` : "Ingrédients manquants"}
      </Button>
      {status.missing && status.missing.length > 0 && (
        <p className="text-[10px] text-red-700 italic font-body text-center">
          Il vous manque : {status.missing.map(m => `${m.missing} ${ITEMS[m.key]?.name || m.key}`).join(", ")}
        </p>
      )}
    </div>
  );
}

// Items qui demandent une cible (ville)
const TARGETED_ITEMS = ["parchemin_marchand", "etoile_filante", "hibou_messager"];

export default function CauldronPanel({ profile, city, onRefresh }) {
  const [cauldron, setCauldron] = useState(null);
  const [dailyInputs, setDailyInputs] = useState(null);
  const [usedToday, setUsedToday] = useState({ 1: false, 2: false, 3: false });
  // Tab actif pour la version mobile : initialisé au rang du chaudron au load
  const [activeRankTab, setActiveRankTab] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modale révélation du loot
  const [revealModal, setRevealModal] = useState(null); // { phase: "rolling" | "result", outputKey, item }

  // Modale nourrissage
  const [feedModalOpen, setFeedModalOpen] = useState(false);
  const [feedBasket, setFeedBasket] = useState({});

  // Prix dynamiques (pour valoriser les items lors du nourrissage)
  const [dynamicPrices, setDynamicPrices] = useState(null);
  const [pricesLoading, setPricesLoading] = useState(true);

  // ─── Chargement initial ───
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, di, ut] = await Promise.all([
        loadMyCauldron(profile.user_email, true),
        loadDailyInputs(true),
        hasUsedCauldronToday(profile.user_email),
      ]);
      setCauldron(c);
      setDailyInputs(di);
      setUsedToday(ut);
      // Sur mobile, par défaut on affiche le tab du rang max du chaudron
      // (la "meilleure" recette disponible). Le joueur peut changer après.
      if (c?.rank) setActiveRankTab(c.rank);
    } catch (e) {
      console.error("[Cauldron] load error:", e);
    } finally {
      setLoading(false);
    }
  }, [profile.user_email]);

  // Prix dynamiques
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPricesLoading(true);
      try {
        const listings = await base44.entities.MarketListing.filter({ status: "active" });
        const prices = calculateDynamicPrices(listings || [], CRAFTING_RECIPES_REFACTORED);
        if (!cancelled) setDynamicPrices(prices);
      } catch (e) {
        console.warn("[Cauldron] price calc error:", e);
      } finally {
        if (!cancelled) setPricesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ─── Fabrication du chaudron ───
  const canCreate = useMemo(() => {
    if (cauldron) return false;
    const goldOk = (profile.gold || 0) >= CAULDRON_CREATION_COST.gold;
    const itemsOk = CAULDRON_CREATION_COST.items.every(req => {
      return getInventoryQty(profile.inventory || [], req.key) >= req.qty;
    });
    return goldOk && itemsOk;
  }, [profile.gold, profile.inventory, cauldron]);

  const handleCreate = async () => {
    if (!canCreate) {
      toast.error("Il vous manque des ressources ou de l'or.");
      return;
    }
    setSubmitting(true);
    try {
      // Retirer items et or
      let inv = [...(profile.inventory || [])];
      for (const req of CAULDRON_CREATION_COST.items) {
        inv = removeFromInventory(inv, req.key, req.qty);
      }
      const newGold = (profile.gold || 0) - CAULDRON_CREATION_COST.gold;

      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: inv,
        gold: newGold,
      });

      // Créer le chaudron rang 1
      await base44.entities.MagicCauldron.create({
        player_email: profile.user_email,
        player_name: profile.character_name || "",
        rank: 1,
        feed_progress: 0,
        total_uses: 0,
        created_at: new Date().toISOString(),
      });

      await logGold({
        profile, city,
        amount: -CAULDRON_CREATION_COST.gold,
        type: "chaudron_creation",
        description: "🪄 Fabrication du chaudron magique (rang 1)",
      });

      toast.success("🪄 Votre chaudron magique est forgé ! Il sommeille au rang 1.");
      invalidateCauldronCache();
      onRefresh?.();
      loadAll();
    } catch (e) {
      console.error("[Cauldron] create error:", e);
      toast.error("La forge a refusé : impossible de créer le chaudron.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Utilisation du chaudron ───
  // Pour chaque rang disponible (1, 2, ..., jusqu'au rang du chaudron),
  // calcule les inputs requis. Permet d'afficher chaque recette séparément
  // et de cuisiner chaque rang une fois par jour.
  const availableRanks = useMemo(() => {
    if (!cauldron) return [];
    const ranks = [];
    for (let r = 1; r <= cauldron.rank; r++) ranks.push(r);
    return ranks;
  }, [cauldron]);

  const inputsByRank = useMemo(() => {
    if (!cauldron || !dailyInputs) return {};
    const result = {};
    for (const r of availableRanks) {
      result[r] = getInputsForRank(dailyInputs, r);
    }
    return result;
  }, [cauldron, dailyInputs, availableRanks]);

  // Renvoie { rank: { hasAll, missing: [...] } } pour chaque rang disponible
  const inputsStatus = useMemo(() => {
    const status = {};
    for (const r of availableRanks) {
      const required = inputsByRank[r] || [];
      const missing = required
        .map(req => {
          const has = getInventoryQty(profile.inventory || [], req.key);
          return { ...req, has, missing: Math.max(0, req.qty - has) };
        })
        .filter(x => x.missing > 0);
      status[r] = {
        required,
        hasAll: required.length > 0 && missing.length === 0,
        missing,
      };
    }
    return status;
  }, [availableRanks, inputsByRank, profile.inventory]);

  const handleUse = async (selectedRank) => {
    if (!cauldron) return;
    if (usedToday[selectedRank]) {
      toast.error(`Vous avez déjà invoqué le rang ${selectedRank} aujourd'hui.`);
      return;
    }
    const status = inputsStatus[selectedRank];
    if (!status || !status.hasAll) {
      const missing = (status?.missing || []).map(m => `${m.missing}× ${ITEMS[m.key]?.name || m.key}`).join(", ");
      toast.error(`Il vous manque : ${missing}`);
      return;
    }

    setSubmitting(true);
    setRevealModal({ phase: "rolling", outputKey: null, item: null });

    try {
      // 1. Tirage de l'output au rang sélectionné
      const outputKey = rollOutput(selectedRank);
      const outputItem = ITEMS[outputKey];

      // 2. Retirer les inputs du rang sélectionné et ajouter l'output
      let inv = [...(profile.inventory || [])];
      for (const req of status.required) {
        inv = removeFromInventory(inv, req.key, req.qty);
      }
      inv = addToInventory(inv, outputKey, 1);

      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: inv,
      });

      // 3. Logger l'utilisation au rang sélectionné
      const todayStr = new Date().toISOString().split("T")[0];
      await base44.entities.CauldronUses.create({
        player_email: profile.user_email,
        player_name: profile.character_name || "",
        cycle_date: todayStr,
        rank_used: selectedRank,
        output_received: outputKey,
        used_at: new Date().toISOString(),
      });

      // 4. Incrémenter le compteur du chaudron
      await base44.entities.MagicCauldron.update(cauldron.id, {
        total_uses: (cauldron.total_uses || 0) + 1,
      });

      await logGold({
        profile, city,
        amount: 0,
        type: "chaudron_usage",
        description: `🪄 Chaudron rang ${selectedRank} utilisé : ${outputItem?.icon || ""} ${outputItem?.name || outputKey}`,
      }).catch(() => {});

      // 5. Animation suspense ~3s puis révélation
      setTimeout(() => {
        setRevealModal({ phase: "result", outputKey, item: outputItem });
        setUsedToday(prev => ({ ...prev, [selectedRank]: true }));
        invalidateCauldronCache();
        onRefresh?.();
        loadAll();
      }, 3000);
    } catch (e) {
      console.error("[Cauldron] use error:", e);
      toast.error("Le chaudron crépite et refuse de cuire.");
      setRevealModal(null);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Nourrissage du chaudron ───
  const eligibleFeedInventory = useMemo(() => {
    if (!cauldron || cauldron.rank >= 3) return [];
    const inv = profile?.inventory || [];
    return inv
      .map(slot => ({ ...slot, def: ITEMS[slot.item_key] }))
      .filter(slot => slot.def && (slot.def.tier || 1) <= 4 && (slot.quantity || 0) > 0)
      // Exclut les items magiques du chaudron (catégorie chaudron)
      .filter(slot => slot.def.category !== "chaudron")
      .sort((a, b) => {
        const tierDiff = (a.def.tier || 1) - (b.def.tier || 1);
        if (tierDiff !== 0) return tierDiff;
        return (a.def.name || "").localeCompare(b.def.name || "");
      });
  }, [profile?.inventory, cauldron]);

  const feedSummary = useMemo(() => {
    if (!dynamicPrices) return { totalValue: 0, items: [] };
    let totalValue = 0;
    const items = [];
    for (const [key, qty] of Object.entries(feedBasket)) {
      if (qty <= 0) continue;
      const value = computeFeedValue(key, qty, dynamicPrices);
      totalValue += value;
      items.push({ key, qty, value, def: ITEMS[key] });
    }
    return { totalValue, items };
  }, [feedBasket, dynamicPrices]);

  const handleFeedBasketChange = (itemKey, newQty) => {
    const max = getInventoryQty(profile.inventory || [], itemKey);
    const sanitized = Math.max(0, Math.min(parseInt(newQty, 10) || 0, max));
    setFeedBasket(prev => {
      const next = { ...prev };
      if (sanitized === 0) delete next[itemKey];
      else next[itemKey] = sanitized;
      return next;
    });
  };

  const handleConfirmFeed = async () => {
    if (!cauldron || cauldron.rank >= 3) return;
    if (feedSummary.items.length === 0) {
      toast.error("Votre offrande est vide.");
      return;
    }

    setSubmitting(true);
    try {
      // Retirer les items
      let inv = [...(profile.inventory || [])];
      for (const item of feedSummary.items) {
        inv = removeFromInventory(inv, item.key, item.qty);
      }

      // Calcul progression
      const newProgress = (cauldron.feed_progress || 0) + feedSummary.totalValue;
      const nextThreshold = getNextRankThreshold(cauldron.rank);
      const willEvolve = newProgress >= nextThreshold;
      const newRank = willEvolve ? cauldron.rank + 1 : cauldron.rank;
      const finalProgress = willEvolve ? 0 : newProgress;

      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: inv,
      });

      await base44.entities.MagicCauldron.update(cauldron.id, {
        rank: newRank,
        feed_progress: finalProgress,
      });

      const itemDesc = feedSummary.items.map(i => `${i.qty}× ${i.def?.name || i.key}`).join(", ");
      await logGold({
        profile, city,
        amount: 0,
        type: "chaudron_feed",
        description: `🪄 Nourriture chaudron (+${feedSummary.totalValue}💰 virtuels) : ${itemDesc}`,
      }).catch(() => {});

      if (willEvolve) {
        toast.success(`🪄✨ Votre chaudron évolue au rang ${newRank} ! De nouveaux mystères s'offrent à vous.`);
      } else {
        toast.success(`🪄 +${feedSummary.totalValue}💰 virtuels nourris au chaudron (${finalProgress}/${nextThreshold}).`);
      }

      setFeedBasket({});
      setFeedModalOpen(false);
      invalidateCauldronCache();
      onRefresh?.();
      loadAll();
    } catch (e) {
      console.error("[Cauldron] feed error:", e);
      toast.error("Le chaudron rejette votre offrande.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Rendu ───
  if (loading) {
    return (
      <Card className="border-2 border-purple-300/50">
        <CardContent className="pt-4 text-sm text-muted-foreground italic">
          🪄 Chargement du chaudron magique...
        </CardContent>
      </Card>
    );
  }

  // ÉTAT 1 : Pas encore de chaudron → panneau de fabrication
  if (!cauldron) {
    return (
      <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50/40 to-pink-50/40">
        <CardContent className="pt-4 space-y-3">
          <div className="text-center space-y-1">
            <div className="text-4xl">🪄</div>
            <div className="font-heading text-lg">Forger votre Chaudron magique</div>
            <p className="text-xs italic text-muted-foreground font-body">
              Un alchimiste itinérant a vendu sa recette aux artisans du royaume.
              Rassemblez les ingrédients et cinquante pièces d'or pour amorcer le sortilège.
            </p>
          </div>

          <div className="bg-card border border-purple-200 rounded-lg p-3 space-y-2">
            <div className="text-xs font-body font-semibold">Ingrédients requis :</div>
            <div className="grid grid-cols-2 gap-1.5">
              {CAULDRON_CREATION_COST.items.map(req => {
                const has = getInventoryQty(profile.inventory || [], req.key);
                const ok = has >= req.qty;
                const def = ITEMS[req.key];
                return (
                  <div key={req.key} className={`text-xs px-2 py-1 rounded border font-body flex justify-between ${
                    ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
                  }`}>
                    <span>{def?.icon} {def?.name}</span>
                    <span>{has}/{req.qty}</span>
                  </div>
                );
              })}
            </div>
            <div className={`text-xs px-2 py-1 rounded border font-body flex justify-between ${
              (profile.gold || 0) >= CAULDRON_CREATION_COST.gold
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}>
              <span>💰 Or</span>
              <span>{profile.gold || 0}/{CAULDRON_CREATION_COST.gold}</span>
            </div>
          </div>

          <Button
            className="w-full font-heading"
            disabled={!canCreate || submitting}
            onClick={handleCreate}
          >
            {submitting ? "Forge en cours..." : canCreate ? "🪄 Forger mon chaudron magique" : "Ressources manquantes"}
          </Button>

          <p className="text-[10px] italic text-muted-foreground font-body text-center">
            Une fois forgé, le chaudron consommera des ressources tirées au sort chaque jour
            pour vous offrir un objet mystérieux. Évolue jusqu'au rang 3.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ÉTAT 2 : Chaudron actif → utilisation + nourrissage
  const nextThreshold = getNextRankThreshold(cauldron.rank);
  const feedProgress = cauldron.feed_progress || 0;
  const progressPct = nextThreshold > 0 ? Math.min(100, Math.round((feedProgress / nextThreshold) * 100)) : 100;

  return (
    <>
      <Card className={`border-2 ${cauldron.rank === 3 ? "border-purple-500" : "border-purple-300"} bg-gradient-to-br from-purple-50/40 to-pink-50/40`}>
        <CardContent className="pt-4 space-y-3">
          {/* Hero */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="text-3xl">🪄</div>
              <div>
                <div className="font-heading text-base">Chaudron magique</div>
                <Badge className={`text-[10px] ${getRankColor(cauldron.rank)}`}>
                  {getRankLabel(cauldron.rank)}
                </Badge>
              </div>
            </div>
            <div className="text-xs text-muted-foreground font-body italic">
              {cauldron.total_uses || 0} utilisation{(cauldron.total_uses || 0) > 1 ? "s" : ""}
            </div>
          </div>

          {/* Section utilisation quotidienne : A en desktop, B en mobile (tabs) */}
          {!dailyInputs ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center text-xs font-body italic text-amber-800">
              ⏳ Les ingrédients du jour ne sont pas encore tirés. Patientez quelques minutes.
            </div>
          ) : availableRanks.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center text-xs font-body italic text-amber-800">
              ⏳ Chaudron non initialisé.
            </div>
          ) : (
            <>
              {/* Indication globale : récap simple en haut quand plusieurs rangs */}
              {availableRanks.length > 1 && (
                <div className="text-[11px] text-muted-foreground font-body italic px-1">
                  Vous pouvez invoquer une recette de chaque rang par jour.
                </div>
              )}

              {/* Layout A : Desktop : toutes les recettes empilées (md et plus) */}
              <div className="hidden md:flex md:flex-col md:gap-2">
                {availableRanks.map(r => (
                  <RankRecipeCard
                    key={r}
                    rank={r}
                    status={inputsStatus[r]}
                    alreadyUsed={usedToday[r]}
                    profile={profile}
                    submitting={submitting}
                    onUse={handleUse}
                  />
                ))}
              </div>

              {/* Layout B : Mobile : tabs (1 recette visible à la fois) */}
              <div className="md:hidden space-y-2">
                {availableRanks.length > 1 && (
                  <div className="flex gap-1 bg-muted/50 rounded-md p-1">
                    {availableRanks.map(r => {
                      const isActive = r === activeRankTab;
                      const isDone = usedToday[r];
                      return (
                        <button
                          key={r}
                          onClick={() => setActiveRankTab(r)}
                          className={`flex-1 text-xs font-body py-1.5 rounded transition-colors flex items-center justify-center gap-1 ${
                            isActive
                              ? "bg-background shadow-sm font-semibold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <span>Rang {r}</span>
                          {isDone && <span className="text-[10px]">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                <RankRecipeCard
                  rank={activeRankTab}
                  status={inputsStatus[activeRankTab]}
                  alreadyUsed={usedToday[activeRankTab]}
                  profile={profile}
                  submitting={submitting}
                  onUse={handleUse}
                  compact
                />
              </div>
            </>
          )}

          {/* Section évolution */}
          {cauldron.rank < 3 && (
            <div className="bg-card border border-border rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-body font-semibold">Évolution rang {cauldron.rank + 1}</span>
                <span className="text-xs font-body text-muted-foreground">
                  {feedProgress}/{nextThreshold} 💰 virtuels
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full font-heading"
                onClick={() => setFeedModalOpen(true)}
              >
                📥 Nourrir le chaudron
              </Button>
            </div>
          )}

          {cauldron.rank === 3 && (
            <div className="bg-purple-100 border border-purple-300 rounded-lg p-2 text-center text-[11px] italic font-body text-purple-800">
              ✨ Votre chaudron a atteint le rang maximum. La pleine puissance des arts magiques s'offre à vous.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modale révélation du loot */}
      {revealModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border-2 border-purple-400">
            {revealModal.phase === "rolling" ? (
              <>
                <div className="text-center space-y-3">
                  <div className="text-5xl animate-pulse">🪄</div>
                  <div className="font-heading text-lg">Le chaudron mijote...</div>
                  <div className="text-xs italic text-muted-foreground font-body">
                    Les vapeurs colorées montent dans les airs.
                  </div>
                </div>
                <div className="flex justify-center gap-3 py-4">
                  <span className="text-4xl animate-bounce" style={{ animationDelay: "0ms" }}>✨</span>
                  <span className="text-4xl animate-bounce" style={{ animationDelay: "200ms" }}>🌟</span>
                  <span className="text-4xl animate-bounce" style={{ animationDelay: "400ms" }}>💫</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-center space-y-3">
                  <div className="text-2xl text-purple-700 font-heading">✨ Vous obtenez ✨</div>
                  <div className="text-7xl py-2">{revealModal.item?.icon}</div>
                  <div className="font-heading text-xl text-purple-900">{revealModal.item?.name}</div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="text-xs italic text-purple-800 font-body leading-relaxed">
                      {revealModal.item?.use}
                    </div>
                  </div>
                </div>
                <Button className="w-full font-heading" onClick={() => setRevealModal(null)}>
                  Récupérer le butin
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modale nourrissage */}
      <Dialog open={feedModalOpen} onOpenChange={(open) => !submitting && setFeedModalOpen(open)}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-heading">📥 Nourrir le chaudron (rang {cauldron.rank} → {cauldron.rank + 1})</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <p className="text-xs italic text-muted-foreground font-body">
              Donnez des ressources au chaudron. Leur valeur en or virtuel s'accumule pour faire évoluer le chaudron.
              Les items magiques (issus du chaudron) ne peuvent pas être donnés.
            </p>

            {pricesLoading && (
              <div className="text-xs italic text-muted-foreground font-body">Calcul des valeurs...</div>
            )}

            {!pricesLoading && eligibleFeedInventory.length === 0 && (
              <div className="text-xs italic text-muted-foreground font-body text-center py-4">
                Aucun item nourrissable dans votre inventaire.
              </div>
            )}

            {!pricesLoading && eligibleFeedInventory.length > 0 && (
              <div className="space-y-1">
                {eligibleFeedInventory.map(slot => {
                  const value = dynamicPrices ? computeFeedValue(slot.item_key, 1, dynamicPrices) : 0;
                  const inBasket = feedBasket[slot.item_key] || 0;
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
                        onChange={e => handleFeedBasketChange(slot.item_key, e.target.value)}
                        disabled={submitting}
                        className="w-16 h-7 text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {feedSummary.items.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded p-2 text-xs font-body">
                <div className="font-semibold mb-1">Votre offrande :</div>
                {feedSummary.items.map(i => (
                  <div key={i.key} className="flex justify-between">
                    <span>{i.def?.icon} {i.def?.name} × {i.qty}</span>
                    <span className="text-purple-700">{i.value}💰</span>
                  </div>
                ))}
                <div className="border-t border-purple-300 mt-1 pt-1 flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-purple-900">{feedSummary.totalValue}💰 virtuels</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Progression après : {feedProgress + feedSummary.totalValue}/{nextThreshold}
                  {feedProgress + feedSummary.totalValue >= nextThreshold && " ✨ Évolution !"}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => setFeedModalOpen(false)}
              disabled={submitting}
              className="font-body"
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirmFeed}
              disabled={submitting || feedSummary.items.length === 0}
              className="font-heading"
            >
              {submitting ? "Nourriture en cours..." : "Confirmer l'offrande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
