/**
 * MayorEventsPanel.jsx : panneau "Événements de mairie".
 *
 * Affiché dans CityView dans un nouvel onglet "🎉 Événements".
 * Visible par tous les résidents (transparence du gameplay maire).
 * Boutons "Lancer" actifs uniquement pour le maire.
 *
 * Fonctionnalités :
 *   - Liste des 7 événements avec coût et description
 *   - Affichage des événements actifs sur la ville (avec timer)
 *   - Modale de confirmation avec sélection des T1 dans l'entrepôt
 *   - Modale spéciale pour Razzia (cible + montant libre)
 *   - Cooldown 7j sur razzia par cible
 *   - 1 événement / jour max
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ITEMS } from "@/lib/craftingData";
import { getMaxFatigue, getMaxHunger, getCityHungerBonus, getCityFatigueBonus } from "@/lib/gameData";
import {
  CITY_EVENTS_CATALOG,
  ACCEPTED_T1_KEYS,
  getEventCost,
  getNextResetExpiry,
  loadActiveEventsForCity,
  hasMayorLaunchedToday,
  checkRazziaCooldown,
} from "@/lib/cityEventsHelpers";
import { checkCityDome } from "@/lib/cauldronEffects";
import { logGold } from "@/lib/goldLog";
import { notifyTavern } from "@/lib/tavernNotifier";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────
function formatTimeLeft(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expiré";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m}min`;
}

export default function MayorEventsPanel({ city, profile, isMayor, onRefresh }) {
  const [activeEvents, setActiveEvents] = useState([]);
  const [launchedToday, setLaunchedToday] = useState(false);
  const [activeDome, setActiveDome] = useState(null); // { protected: bool, expiresAt: Date }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modales
  const [confirmEvent, setConfirmEvent] = useState(null); // eventKey
  const [t1Basket, setT1Basket] = useState({}); // {key: qty}
  const [razziaTarget, setRazziaTarget] = useState(null); // {city, basket}

  // Tick pour rafraîchir les timers
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // ─── Chargement ────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!city?.id) return;
    setLoading(true);
    try {
      const [evs, today, dome] = await Promise.all([
        loadActiveEventsForCity(city.id),
        hasMayorLaunchedToday(city.id),
        checkCityDome(city.id),
      ]);
      setActiveEvents(evs);
      setLaunchedToday(today);
      setActiveDome(dome);
    } catch (e) {
      console.error("[MayorEventsPanel] load error:", e);
    } finally {
      setLoading(false);
    }
  }, [city?.id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ─── Détermination du statut de chaque événement ───────────────────────
  const eventsState = useMemo(() => {
    const result = {};
    for (const key of Object.keys(CITY_EVENTS_CATALOG)) {
      const def = CITY_EVENTS_CATALOG[key];
      const cost = getEventCost(key, city);
      const active = activeEvents.find(e => e.event_type === key && e.effect_until && new Date(e.effect_until) > new Date());
      const warehouseTotal = ACCEPTED_T1_KEYS.reduce((s, k) => s + ((city?.warehouse?.[k]) || 0), 0);
      const canAfford = def.cost_type === "free" || warehouseTotal >= cost;
      result[key] = {
        def,
        cost,
        active,
        canAfford,
        warehouseTotal,
      };
    }
    return result;
  }, [activeEvents, city]);

  // ─── Calcul du panier T1 ───────────────────────────────────────────────
  const basketTotal = useMemo(() => {
    return Object.values(t1Basket).reduce((s, q) => s + (q || 0), 0);
  }, [t1Basket]);

  const handleBasketChange = (itemKey, newQty) => {
    const max = (city?.warehouse?.[itemKey]) || 0;
    const sanitized = Math.max(0, Math.min(parseInt(newQty, 10) || 0, max));
    setT1Basket(prev => {
      const next = { ...prev };
      if (sanitized === 0) delete next[itemKey];
      else next[itemKey] = sanitized;
      return next;
    });
  };

  // ─── Lancement d'un événement classique (non-Razzia) ───────────────────
  const handleConfirmEvent = async () => {
    if (!confirmEvent) return;
    const def = CITY_EVENTS_CATALOG[confirmEvent];
    const requiredCost = getEventCost(confirmEvent, city);
    if (basketTotal < requiredCost) {
      toast.error(`Il manque ${requiredCost - basketTotal} T1 dans votre offrande.`);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Retirer les T1 de l'entrepôt
      const newWarehouse = { ...(city.warehouse || {}) };
      for (const [key, qty] of Object.entries(t1Basket)) {
        newWarehouse[key] = Math.max(0, (newWarehouse[key] || 0) - qty);
      }

      // 2. Appliquer les effets instantanés (Festin royal)
      // Effets instantanés sur les résidents : on les marque avec un flag
      // que les hooks frontend liront au prochain refresh
      let effectsApplied = false;
      let effectsApplyErrors = 0;
      if (confirmEvent === "royal_feast") {
        // Boucle sur les résidents : régénération faim & énergie
        // Sprint 5 fix : utilise les VRAIS max (housing + bâtiments + perma bonus)
        // au lieu d'un hardcode 20. Logue les erreurs au lieu de les masquer.
        const cityHungerBonus = getCityHungerBonus(city.buildings || []);
        const cityFatigueBonus = getCityFatigueBonus(city.buildings || []);
        const residents = await base44.entities.PlayerProfile.filter({ home_city_id: city.id });
        for (const res of (residents || [])) {
          try {
            const maxH = getMaxHunger(res, cityHungerBonus);
            const maxF = getMaxFatigue(res, cityFatigueBonus);
            const updates = {
              hunger: Math.min(maxH, (res.hunger ?? maxH) + 10),
              fatigue: Math.min(maxF, (res.fatigue ?? maxF) + 10),
            };
            await base44.entities.PlayerProfile.update(res.id, updates);
          } catch (e) {
            console.error("[royal_feast] update", res.user_email, ":", e.message);
            effectsApplyErrors++;
          }
        }
        effectsApplied = true;
        if (effectsApplyErrors > 0) {
          toast.error(`⚠️ ${effectsApplyErrors} résident(s) n'ont pas pu être mis à jour.`);
        }
      }

      // 3. Créer le record event
      const expiresAt = def.effect_buff ? getNextResetExpiry() : null;
      await base44.entities.CityEvent.create({
        city_id: city.id,
        city_name: city.name || "",
        event_type: confirmEvent,
        cost_resources: t1Basket,
        total_cost: basketTotal,
        mayor_email: profile.user_email,
        mayor_name: profile.character_name || "",
        effect_until: expiresAt,
        created_at: new Date().toISOString(),
      });

      // 4. Update l'entrepôt
      await base44.entities.City.update(city.id, { warehouse: newWarehouse });

      // 5. Log "or" symbolique pour traçabilité
      await logGold(profile.user_email, profile.character_name, city.id, city.name,
        0, "event_mairie", `${def.icon} ${def.name} : −${basketTotal} T1`).catch(() => {});

      // 6. Message taverne
      await notifyTavern({
        cityId: city.id,
        audience: "residents",
        authorName: "🏛️ Mairie",
        message: `${def.icon} La mairie organise une **${def.name}** ! ${def.description}`,
      });

      toast.success(`${def.icon} ${def.name} lancé ! −${basketTotal} T1 de l'entrepôt.`);
      setConfirmEvent(null);
      setT1Basket({});
      await loadAll();
      onRefresh?.();
    } catch (e) {
      console.error("[MayorEventsPanel] launch error:", e);
      toast.error("Le lancement de l'événement a échoué.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Razzia : sélection cible ──────────────────────────────────────────
  const handleStartRazzia = async () => {
    setSubmitting(true);
    try {
      const allCities = await base44.entities.City.list();
      const targets = (allCities || [])
        .filter(c => !c.is_bot_city && c.id !== city.id);
      setRazziaTarget({ cities: targets, selected: null, basket: {}, cooldownInfo: null });
    } catch (e) {
      console.error("[MayorEventsPanel] razzia target load:", e);
      toast.error("Impossible de charger la liste des villes.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectRazziaTarget = async (targetCity) => {
    setSubmitting(true);
    try {
      const cooldownInfo = await checkRazziaCooldown(city.id, targetCity.id);
      setRazziaTarget(prev => ({ ...prev, selected: targetCity, cooldownInfo }));
    } catch (e) {
      console.warn("[MayorEventsPanel] cooldown check:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRazziaBasketChange = (itemKey, newQty) => {
    const max = (city?.warehouse?.[itemKey]) || 0;
    const sanitized = Math.max(0, Math.min(parseInt(newQty, 10) || 0, max));
    setRazziaTarget(prev => {
      const newBasket = { ...prev.basket };
      if (sanitized === 0) delete newBasket[itemKey];
      else newBasket[itemKey] = sanitized;
      return { ...prev, basket: newBasket };
    });
  };

  const razziaBasketTotal = useMemo(() => {
    if (!razziaTarget?.basket) return 0;
    return Object.values(razziaTarget.basket).reduce((s, q) => s + (q || 0), 0);
  }, [razziaTarget?.basket]);

  const handleConfirmRazzia = async () => {
    if (!razziaTarget?.selected) return;
    if (razziaBasketTotal < 1) {
      toast.error("Vous devez investir au moins 1 ressource.");
      return;
    }

    setSubmitting(true);
    try {
      const target = razziaTarget.selected;

      // 1. Vérifier le dôme de protection
      const dome = await checkCityDome(target.id);

      // 2. Calcul du vol
      const expectedSteal = razziaBasketTotal * 2; // 1 T1 = 2 or
      const targetTreasury = target.gold_treasury || 0;
      const actualSteal = dome.protected ? 0 : Math.min(expectedSteal, targetTreasury);

      // 3. Retirer les T1 de l'entrepôt source
      const newWarehouse = { ...(city.warehouse || {}) };
      for (const [key, qty] of Object.entries(razziaTarget.basket)) {
        newWarehouse[key] = Math.max(0, (newWarehouse[key] || 0) - qty);
      }

      // 4. Update les villes
      await base44.entities.City.update(city.id, {
        warehouse: newWarehouse,
        gold_treasury: (city.gold_treasury || 0) + actualSteal,
        treasury_cumulative: (city.treasury_cumulative || 0) + actualSteal,
      });

      if (actualSteal > 0) {
        await base44.entities.City.update(target.id, {
          gold_treasury: Math.max(0, (target.gold_treasury || 0) - actualSteal),
        });
      }

      // 5. Log event
      await base44.entities.CityEvent.create({
        city_id: city.id,
        city_name: city.name || "",
        event_type: "razzia",
        target_city_id: target.id,
        target_city_name: target.name || "",
        cost_resources: razziaTarget.basket,
        total_cost: razziaBasketTotal,
        gold_stolen: actualSteal,
        mayor_email: profile.user_email,
        mayor_name: profile.character_name || "",
        created_at: new Date().toISOString(),
      });

      // 6. Messages tavernes (source ET cible) - en salle privée résidents
      if (dome.protected) {
        await notifyTavern({
          cityId: city.id,
          audience: "residents",
          authorName: "🏛️ Mairie",
          message: `🛡️ La razzia contre ${target.name} a échoué : un dôme de protection l'enveloppe ! Les ${razziaBasketTotal} ressources sont perdues.`,
        });
        toast.error(`🛡️ ${target.name} était protégée ! Vos ressources sont perdues.`);
      } else {
        await notifyTavern({
          cityId: city.id,
          audience: "residents",
          authorName: "🏛️ Mairie",
          message: `🗡️ Razzia réussie contre ${target.name} ! +${actualSteal}💰 dans la trésorerie.`,
        });
        await notifyTavern({
          cityId: target.id,
          audience: "residents",
          authorName: "⚠️ Garde",
          message: `🗡️ Votre ville a été razziée par ${city.name} ! La trésorerie a perdu ${actualSteal}💰.`,
        });
        toast.success(`🗡️ Razzia réussie : +${actualSteal}💰 volés à ${target.name} !`);
      }

      // 7. Log gold (2 transactions distinctes, comme pour Parchemin/Étoile)
      if (actualSteal > 0) {
        // Côté maire qui lance la razzia (gain pour sa ville)
        await logGold(profile.user_email, profile.character_name, city.id, city.name,
          actualSteal, "razzia_gain", `Razzia sur ${target.name} : +${actualSteal}💰`).catch(() => {});
        // Côté ville victime : player_email vide pour ne pas polluer le journal du maire attaquant
        await base44.entities.GoldTransaction.create({
          player_email: "",
          player_name: "",
          city_id: target.id,
          city_name: target.name || "",
          amount: -actualSteal,
          type: "razzia_loss",
          description: `Razziée par ${city.name} : −${actualSteal}💰`,
        }).catch(() => {});
      }

      setRazziaTarget(null);
      await loadAll();
      onRefresh?.();
    } catch (e) {
      console.error("[MayorEventsPanel] razzia error:", e);
      toast.error("La razzia a échoué.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="text-sm italic text-muted-foreground py-4">
        Chargement des événements...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bandeau info */}
      <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-300">
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎉</span>
            <div>
              <div className="font-heading text-lg">Événements de mairie</div>
              <p className="text-xs italic text-muted-foreground font-body">
                Le maire peut investir des ressources de l'entrepôt pour offrir des bonus à toute la ville,
                ou lancer une razzia contre une autre ville.
              </p>
            </div>
          </div>
          {launchedToday && isMayor && (
            <div className="bg-amber-100 border border-amber-300 rounded p-2 text-xs font-body text-amber-900">
              ⏳ Vous avez déjà lancé un événement aujourd'hui. Repassez après le reset 06:00 UTC.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bandeau dôme de protection actif */}
      {activeDome?.protected && activeDome.expiresAt && (
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-300">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛡️</span>
              <div className="flex-1">
                <div className="font-heading text-sm text-blue-900">
                  Votre ville est protégée par un Talisman
                </div>
                <p className="text-xs font-body text-blue-800">
                  Aucune razzia, aucun parchemin marchand ni étoile filante ne peut vous atteindre
                  jusqu'à <strong>{new Date(activeDome.expiresAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</strong>
                  {' '}({formatTimeLeft(activeDome.expiresAt)} restant{formatTimeLeft(activeDome.expiresAt)?.endsWith('min') ? 'es' : ''}).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Événements actifs */}
      {activeEvents.filter(e => e.effect_until && new Date(e.effect_until) > new Date()).length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="text-xs font-body font-semibold">Événements actifs aujourd'hui :</div>
            {activeEvents
              .filter(e => e.effect_until && new Date(e.effect_until) > new Date())
              .map(e => {
                const def = CITY_EVENTS_CATALOG[e.event_type];
                if (!def) return null;
                return (
                  <div key={e.id} className="bg-green-50 border border-green-200 rounded p-2 text-xs font-body">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{def.icon} {def.name}</span>
                      <Badge className="text-[10px] bg-green-100 text-green-800 border-green-300">
                        ⏱️ {formatTimeLeft(e.effect_until)}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-muted-foreground italic">
                      Lancé par {e.mayor_name || "le maire"} · −{e.total_cost} T1
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* Liste des événements */}
      <div className="grid gap-2">
        {Object.values(CITY_EVENTS_CATALOG).map(def => {
          const state = eventsState[def.key];
          const disabled = !isMayor || launchedToday || (def.cost_type !== "free" && !state.canAfford);
          return (
            <Card key={def.key} className={state.active ? "border-2 border-green-300 bg-green-50/40" : ""}>
              <CardContent className="pt-3 pb-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-heading text-sm">
                      {def.icon} {def.name}
                      {state.active && <span className="ml-2 text-xs text-green-700">✓ Actif</span>}
                    </div>
                    <p className="text-xs italic text-muted-foreground font-body mt-1">
                      {def.description}
                    </p>
                    <div className="text-xs font-body mt-1">
                      <span className="text-muted-foreground">Coût : </span>
                      {def.cost_type === "fixed" && <span className="font-semibold">{state.cost} T1</span>}
                      {def.cost_type === "per_resident" && (
                        <span className="font-semibold">
                          {def.cost_value} T1/résident = {state.cost} T1 total
                        </span>
                      )}
                      {def.cost_type === "free" && <span className="italic">Libre (1 T1 = 2 or volés)</span>}
                    </div>
                  </div>
                  {isMayor && (
                    <Button
                      size="sm"
                      disabled={disabled || submitting}
                      onClick={() => {
                        if (def.key === "razzia") handleStartRazzia();
                        else { setConfirmEvent(def.key); setT1Basket({}); }
                      }}
                      className="font-heading shrink-0"
                    >
                      Lancer
                    </Button>
                  )}
                </div>
                {!state.canAfford && def.cost_type !== "free" && isMayor && (
                  <div className="text-[10px] text-red-700 italic font-body">
                    Entrepôt insuffisant : {state.warehouseTotal}/{state.cost} T1 acceptés
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modale confirmation événement classique */}
      <Dialog open={!!confirmEvent} onOpenChange={(o) => !submitting && !o && setConfirmEvent(null)}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {confirmEvent && CITY_EVENTS_CATALOG[confirmEvent]?.icon} Lancer{" "}
              {confirmEvent && CITY_EVENTS_CATALOG[confirmEvent]?.name}
            </DialogTitle>
          </DialogHeader>
          {confirmEvent && (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                <p className="text-xs italic text-muted-foreground font-body">
                  {CITY_EVENTS_CATALOG[confirmEvent].description}
                </p>
                <p className="text-xs font-body">
                  Coût total : <strong>{getEventCost(confirmEvent, city)} T1</strong> de l'entrepôt.
                </p>

                <div className="space-y-1">
                  <div className="text-xs font-body font-semibold">Choisissez vos T1 dans l'entrepôt :</div>
                  {ACCEPTED_T1_KEYS.map(key => {
                    const def = ITEMS[key];
                    const stock = (city?.warehouse?.[key]) || 0;
                    if (stock === 0) return null;
                    const inBasket = t1Basket[key] || 0;
                    return (
                      <div key={key} className="flex items-center gap-2 py-1 px-2 hover:bg-muted/30 rounded">
                        <span className="text-lg shrink-0">{def?.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-body font-semibold truncate">{def?.name}</div>
                          <div className="text-[10px] text-muted-foreground">stock {stock}</div>
                        </div>
                        <Input
                          type="number"
                       inputMode="numeric"
                       pattern="[0-9]*"
                          min={0}
                          max={stock}
                          value={inBasket}
                          onChange={e => handleBasketChange(key, e.target.value)}
                          disabled={submitting}
                          className="w-16 h-7 text-xs"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs font-body">
                  <div className="flex justify-between">
                    <span>Votre offrande</span>
                    <span className="font-semibold">
                      {basketTotal} / {getEventCost(confirmEvent, city)} T1
                    </span>
                  </div>
                  {basketTotal < getEventCost(confirmEvent, city) && (
                    <div className="text-[10px] text-red-700 italic mt-1">
                      Il manque {getEventCost(confirmEvent, city) - basketTotal} T1.
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 mt-2">
                <Button variant="outline" onClick={() => setConfirmEvent(null)} disabled={submitting} className="font-body">
                  Annuler
                </Button>
                <Button
                  onClick={handleConfirmEvent}
                  disabled={submitting || basketTotal < getEventCost(confirmEvent, city)}
                  className="font-heading"
                >
                  {submitting ? "Lancement..." : "Confirmer"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modale Razzia */}
      <Dialog open={!!razziaTarget} onOpenChange={(o) => !submitting && !o && setRazziaTarget(null)}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-heading">🗡️ Lancer une Razzia</DialogTitle>
          </DialogHeader>
          {razziaTarget && (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {!razziaTarget.selected ? (
                  // Étape 1 : choisir la cible
                  <>
                    <p className="text-xs italic text-muted-foreground font-body">
                      Choisissez la ville à razzier. Vous volerez son or selon votre investissement (1 T1 = 2 or volés).
                    </p>
                    <div className="space-y-1">
                      {(razziaTarget.cities || []).map(c => (
                        <Card
                          key={c.id}
                          className="cursor-pointer hover:border-purple-400 transition-all"
                          onClick={() => handleSelectRazziaTarget(c)}
                        >
                          <CardContent className="p-3 flex items-center justify-between">
                            <div>
                              <div className="font-heading text-sm font-semibold">{c.name}</div>
                              <div className="text-xs text-muted-foreground font-body">Niveau {c.level || 1}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-heading text-amber-700">{c.gold_treasury || 0} 💰</div>
                              <div className="text-[10px] text-muted-foreground">trésorerie</div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                ) : (
                  // Étape 2 : choisir l'investissement
                  <>
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <div className="text-sm font-heading">🎯 Cible : {razziaTarget.selected.name}</div>
                      <div className="text-xs font-body text-red-800 mt-1">
                        Trésorerie : {razziaTarget.selected.gold_treasury || 0} 💰
                      </div>
                      {razziaTarget.cooldownInfo?.onCooldown && (
                        <div className="text-xs text-red-700 italic mt-1">
                          ⏳ Cooldown actif : {razziaTarget.cooldownInfo.daysRemaining}j restants
                        </div>
                      )}
                    </div>

                    <p className="text-xs italic text-muted-foreground font-body">
                      Investissez vos T1 de l'entrepôt. 1 T1 = 2 or volés à la trésorerie cible.
                    </p>

                    <div className="space-y-1">
                      {ACCEPTED_T1_KEYS.map(key => {
                        const def = ITEMS[key];
                        const stock = (city?.warehouse?.[key]) || 0;
                        if (stock === 0) return null;
                        const inBasket = razziaTarget.basket?.[key] || 0;
                        return (
                          <div key={key} className="flex items-center gap-2 py-1 px-2 hover:bg-muted/30 rounded">
                            <span className="text-lg shrink-0">{def?.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-body font-semibold truncate">{def?.name}</div>
                              <div className="text-[10px] text-muted-foreground">stock {stock}</div>
                            </div>
                            <Input
                              type="number"
                       inputMode="numeric"
                       pattern="[0-9]*"
                              min={0}
                              max={stock}
                              value={inBasket}
                              onChange={e => handleRazziaBasketChange(key, e.target.value)}
                              disabled={submitting}
                              className="w-16 h-7 text-xs"
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-red-50 border border-red-300 rounded p-2 text-xs font-body">
                      <div className="flex justify-between">
                        <span>Investissement</span>
                        <span className="font-semibold">{razziaBasketTotal} T1</span>
                      </div>
                      <div className="flex justify-between mt-1">
                        <span>Or volé estimé</span>
                        <span className="font-semibold text-red-800">
                          {Math.min(razziaBasketTotal * 2, razziaTarget.selected.gold_treasury || 0)} 💰
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground italic mt-1">
                        ⚠️ Si la cible est protégée par un dôme, vos ressources seront perdues sans rien voler.
                      </div>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="gap-2 mt-2">
                <Button variant="outline" onClick={() => setRazziaTarget(null)} disabled={submitting} className="font-body">
                  Annuler
                </Button>
                {razziaTarget.selected && (
                  <Button
                    onClick={handleConfirmRazzia}
                    disabled={
                      submitting ||
                      razziaBasketTotal < 1 ||
                      razziaTarget.cooldownInfo?.onCooldown
                    }
                    className="font-heading bg-red-600 hover:bg-red-700"
                  >
                    {submitting ? "Razzia..." : "🗡️ Lancer la razzia"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
