import { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PlayerStatusBar from "../components/PlayerStatusBar";
import BiomeHub from "../components/BiomeHub";
import { toast } from "sonner";
import { checkAndAwardObjective, filterTodayActiveObjectives } from "@/lib/questRewards";
import { logGold } from '@/lib/goldLog';
import { useCityEvents } from "@/lib/useCityEvents";
import { useRoyalStatue } from "@/lib/useRoyalStatue";
import {
  ROAD_TYPES, ROAD_COLORS,
  getDailyRouteCost, computeTravelCost, computeWallToll, getRouteType,
  MAX_HUNGER, isHungry, hasHungerPenalty, applyRandomActionCost, getMaxHunger, getCityHungerBonus,
  getPassiveTravelDiscount,
} from "../lib/gameData";

// Données des biomes
import { BIOMES } from "../lib/biomes";



export default function Travel({ profile, city, homeCity, onRefresh }) {
  const [routes, setRoutes] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [traveling, setTraveling] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [worldEvents, setWorldEvents] = useState(null);
  const [selectedBiome, setSelectedBiome] = useState(null);
  const completingRef = useRef(false);

  // ── Sprint 5B : buff Procession des routes (-50% temps voyage) ──
  // On lit les buffs sur la ville d'origine du joueur (pas la ville actuelle si en visite)
  const cityEvents = useCityEvents(homeCity?.id || city?.id);

  // ── Sprint 2C : palier 4 statue royale (-20% voyage, péage détruit) ──
  const royalStatue = useRoyalStatue(profile?.home_city_id);

  useEffect(() => {
    async function load() {
      const [allRoutes, allCities, ecoArr] = await Promise.all([
        base44.entities.TravelRoute.list(),
        base44.entities.City.list(),
        base44.entities.EconomySettings.filter({ setting_key: "global" }).catch(() => []),
      ]);
      setRoutes(allRoutes);
      setCities(allCities);
      setWorldEvents(ecoArr[0]?.world_events || null);
      setLoading(false);
    }
    load();
  }, []);

  const checkTravel = useCallback(() => {
    if (!profile?.is_traveling || !profile?.travel_arrival_time) return;
    const arrival = new Date(profile.travel_arrival_time).getTime();
    const now = Date.now();
    if (now >= arrival) {
      completeTravel();
    } else {
      setTimeLeft(Math.ceil((arrival - now) / 1000));
    }
  }, [profile]);

  useEffect(() => {
    checkTravel();
    const interval = setInterval(checkTravel, 1000);
    return () => clearInterval(interval);
  }, [checkTravel]);

  const validateTravelQuests = async () => {
    try {
      const allTravelObjs = await base44.entities.PlayerObjective.filter({
        player_email: profile.user_email,
        status: "active",
        type: "travel",
      });
      const travelObjectives = filterTodayActiveObjectives(allTravelObjs, "travel");
      for (const obj of travelObjectives) {
        await checkAndAwardObjective({ obj, addedQty: 1, profile, city: null });
      }
    } catch(e) { console.error("Erreur validation objectifs voyage:", e); }
  };
  const completeTravel = async () => {
    if (!profile) return;
    if (completingRef.current) return; // évite les appels parallèles du timer
    completingRef.current = true;
    const destId = profile.travel_destination_id;

    // ── Arrivée dans un biome ──
    if (destId && destId.startsWith("biome:")) {
      await base44.entities.PlayerProfile.update(profile.id, {
        is_traveling: false,
        travel_arrival_time: "",
        // travel_destination_id conservé → CityPage détecte le biome
      });
      await validateTravelQuests();
      toast.success("🌿 Vous foulez enfin les terres sauvages — que la chasse soit bonne !");
      completingRef.current = false;
      onRefresh?.();
      return;
    }

    const allCitiesNow = cities.length > 0 ? cities : await base44.entities.City.list();
    const arrivalCity = allCitiesNow.find(c => c.id === destId);
    let toll = computeWallToll(arrivalCity, profile);

    // ── Hook chaudron 💨 Plume de vent : prochain voyage gratuit (péage 0) ──
    let plumeUsed = false;
    if (profile.next_travel_free && toll > 0) {
      plumeUsed = true;
      toll = 0;
    }
    // ── Sprint 2C : palier 4 statue royale annule le péage (Mur d'enceinte) ──
    if (royalStatue.hasPalier(4) && toll > 0) {
      toll = 0;
    }

    const visited = [...new Set([...(profile.visited_cities || []), destId])];

    const profileUpdates = {
      city_id: destId,
      is_traveling: false,
      travel_destination_id: "",
      travel_arrival_time: "",
      visited_cities: visited,
    };

    // Consomme le flag plume après usage
    if (plumeUsed) {
      profileUpdates.next_travel_free = false;
      toast.success(`💨 La Plume de vent souffle pour vous : péage offert pour ce voyage !`);
    }

    if (toll > 0) {
      const actualToll = Math.min(toll, profile.gold || 0);
      profileUpdates.gold = (profile.gold || 0) - actualToll;

      if (arrivalCity && actualToll > 0) {
        await base44.entities.City.update(arrivalCity.id, {
          gold_treasury: (arrivalCity.gold_treasury || 0) + actualToll,
          treasury_cumulative: (arrivalCity.treasury_cumulative || 0) + actualToll,
        });
        await logGold(profile.user_email, profile.character_name, arrivalCity.id, arrivalCity.name,
          -actualToll, "peage", `Péage remparts de ${arrivalCity.name}`);
        toast.info(`🏰 Les gardes des remparts tendent la main : −${actualToll} 💰 pour entrer dans ${arrivalCity.name}.`);
      }
    }

    await base44.entities.PlayerProfile.update(profile.id, profileUpdates);

    // ── Bandit (événement monde) — résolu à l'arrivée ──
    try {
      const ecoArr = await base44.entities.EconomySettings.filter({ setting_key: "global" }).catch(() => []);
      const bandit = ecoArr[0]?.world_events?.bandit;
      const lastRouteId = profile.last_travel_route_id;
      if (bandit?.active && lastRouteId === bandit.route_id) {
        const rand = Math.random();
        if (rand < (bandit.chance || 0.15)) {
          // Vérifier si le joueur est immunisé (score défense ≥ 2)
          const { getDefenseScore } = await import("../lib/gameData");
          const defScore = getDefenseScore(profile);
          if (defScore >= 2) {
            // Immunisé — perd 1 durabilité sur un item de défense
            const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
            if (freshP) {
              const newInv = (freshP.inventory || []).map(i => {
                if (["armure","besace"].includes(i.item_key) && (i.durability || 0) > 0 && !i._hit) {
                  i._hit = true;
                  return { ...i, durability: i.durability - 1 };
                }
                return i;
              }).filter(i => i.quantity > 0);
              await base44.entities.PlayerProfile.update(profile.id, { inventory: newInv }).catch(() => {});
            }
            toast.info("🛡️ Un brigand vous a barré la route — mais votre équipement l'a tenu à distance. Une entaille de plus sur votre armure.");
          } else {
            // Perd 10% des ressources transportées
            const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
            if (freshP) {
              const newInv = (freshP.inventory || []).map(i => ({
                ...i,
                quantity: Math.max(0, Math.floor(i.quantity * (1 - (bandit.loss_pct || 0.10)))),
              })).filter(i => i.quantity > 0);
              await base44.entities.PlayerProfile.update(profile.id, { inventory: newInv }).catch(() => {});
            }
            toast.error("🦹 Embuscade sur la route ! Un brigand vous a délésté de quelques ressources avant de disparaître dans les bois.");
          }
        }
      }
    } catch(e) { console.warn("bandit check:", e); }

    await validateTravelQuests();
    toast.success("🏘️ Les portes de la cité s'ouvrent devant vous — bienvenue, voyageur !");
    completingRef.current = false;
    onRefresh?.();
  };

  const handleTravel = async (destinationId, baseTravelMinutes, roadType, routeId) => {
    if (!profile) return;

    // ── Vérification faim ──
    if (isHungry(profile)) {
      toast.error("🍽️ Votre ventre crie famine — nul ne voyage le ventre vide ! Mangez avant de partir.");
      return;
    }

    const departCity = cities.find(c => c.id === profile.city_id);
    const arrivalCity = cities.find(c => c.id === destinationId);

    let travelCost = computeTravelCost(roadType, routeId, departCity, profile);

    // ── Péage doublé (événement monde) ──
    const peage = worldEvents?.peage;
    const peageActive = peage?.active && peage?.route_id === routeId;
    if (peageActive) {
      travelCost = travelCost * (peage.multiplier || 2);
      toast(`🚧 Péage doublé sur cette route jusqu'au ${peage.expires_date} ! Coût ×${peage.multiplier}.`);
    }

    let toll = computeWallToll(arrivalCity, profile);
    // ── Sprint 2C : palier 4 statue royale annule le péage (Mur d'enceinte) ──
    const palier4TollWaived = royalStatue.hasPalier(4) && toll > 0;
    if (palier4TollWaived) toll = 0;

    if (travelCost > 0 && (profile.gold || 0) < travelCost) {
      toast.error(`Pas assez d'or pour les frais de route ! Il faut ${travelCost} 💰${peageActive ? " (péage doublé)" : ""}.`);
      return;
    }

    if (toll > 0 && (profile.gold || 0) - travelCost < toll) {
      const proceed = window.confirm(
        `⚠️ Attention : à l'arrivée, vous devrez payer ${toll} 💰 de péage (Mur d'enceinte) mais vous risquez de ne pas avoir assez d'or. Partir quand même ?`
      );
      if (!proceed) return;
    }

    setTraveling(true);

    const isMaritime = roadType === "maritime";
    const baseMinutes = isMaritime ? baseTravelMinutes * 5 : baseTravelMinutes;
    // ── Réduction durée voyage (REFONTE v5) ──
    // - Sac de voyage T4 = passif PERMANENT -50% (lu depuis l'inventaire via helper)
    // - travel_discount résiduel sur le profil (legacy : encre/parchemin/contrat_artisan)
    //   → conservé pour rétro-compat, on prend le meilleur des deux
    const passiveTravelDiscount = getPassiveTravelDiscount(profile);
    const legacyTravelDiscount = profile.travel_discount || 0;
    const travelDiscount = Math.max(passiveTravelDiscount, legacyTravelDiscount);
    // ── Hook événement mairie : 🛣️ Procession des routes (-50% temps voyage, cumul multiplicatif) ──
    const processionMultiplier = cityEvents.hasBuff("road_procession") ? 0.50 : 1.0;
    // ── Sprint 2C : Palier 4 statue royale (-20% temps voyage, cumul multiplicatif) ──
    const statuePalier4Multiplier = royalStatue.hasPalier(4) ? 0.80 : 1.0;
    const actualMinutes = travelDiscount > 0
      ? Math.max(1, Math.round(baseMinutes * (1 - travelDiscount) * processionMultiplier * statuePalier4Multiplier))
      : Math.max(1, Math.round(baseMinutes * processionMultiplier * statuePalier4Multiplier));
    const arrivalTime = new Date(Date.now() + actualMinutes * 60 * 1000).toISOString();

    // Système unifié : 1 point aléatoire faim/énergie
    const costResult = applyRandomActionCost(profile, 1);
    if (!costResult.ok) { toast.error(costResult.errorMessage); return; }

    const updates = {
      is_traveling: true,
      travel_destination_id: destinationId,
      travel_arrival_time: arrivalTime,
      // Le legacy travel_discount est consommé à chaque voyage. Le passif (besace) reste tant qu'on a l'item.
      travel_discount: 0,
      last_travel_route_id: routeId,
      hunger:  costResult.newHunger,
      fatigue: costResult.newFatigue,
    };

    if (travelCost > 0) {
      updates.gold = (profile.gold || 0) - travelCost;
      if (arrivalCity) {
        await base44.entities.City.update(arrivalCity.id, {
          gold_treasury: (arrivalCity.gold_treasury || 0) + travelCost,
          treasury_cumulative: (arrivalCity.treasury_cumulative || 0) + travelCost,
        });
        if (travelCost > 0) {
          await logGold(profile.user_email, profile.character_name, arrivalCity.id, arrivalCity.name,
            -travelCost, "frais_voyage", `Frais de route vers ${arrivalCity.name}`);
        }
      }
    }

    await base44.entities.PlayerProfile.update(profile.id, updates);

    const costMsg = travelCost > 0 ? ` (−${travelCost} 💰 frais de route)` : "";
    const maritimeMsg = isMaritime ? " ⛵ Route maritime" : "";
    const discountMsg = travelDiscount > 0
      ? (passiveTravelDiscount > 0
          ? ` 🎒 −${Math.round(travelDiscount * 100)}% durée (Sac de voyage)`
          : ` 🗺️ −${Math.round(travelDiscount * 100)}% durée`)
      : "";
    toast.success(`🐴 En selle ! Votre monture prend la route — arrivée dans ${actualMinutes} min.${costMsg}${maritimeMsg}${discountMsg}`);
    completingRef.current = false;
    setTraveling(false);
    onRefresh?.();
  };

  if (!profile) return null;

  // Si un biome est sélectionné, afficher le BiomeHub
  if (selectedBiome) {
    return (
      <div className="space-y-6 pb-20 md:pb-0">
        <Button
          variant="outline"
          className="font-heading"
          onClick={() => setSelectedBiome(null)}
        >
          ← Retour au voyage
        </Button>
        <BiomeHub
          profile={profile}
          biomeKey={selectedBiome}
          biomeInfo={BIOMES[selectedBiome]}
          city={city}
          onRefresh={onRefresh}
        />
      </div>
    );
  }

  const departCity = cities.find(c => c.id === profile.city_id);
  const hasPort = departCity?.buildings?.some(b => b.building_type === "port") || false;
  const isMarchand = profile.profession === "Marchand";
  const hunger = profile.hunger ?? MAX_HUNGER;
  const maxHunger = getMaxHunger(profile, getCityHungerBonus(homeCity?.buildings || []));
  const hungryBlocked = isHungry(profile);
  const hungerPenalty = hasHungerPenalty(profile);

  const availableRoutes = routes.filter(
    r => r.city_from_id === profile.city_id || r.city_to_id === profile.city_id
  );

  const visibleRoutes = availableRoutes.filter(r => {
    const rt = getRouteType(r);
    if (rt === "maritime") return hasPort;
    const destId = r.city_from_id === profile.city_id ? r.city_to_id : r.city_from_id;
    const destCity = cities.find(c => c.id === destId);
    // Exclure si ville introuvable (supprimée) ou ville bot
    if (!destCity || destCity.is_bot_city) return false;
    return true;
  });

  const getCityName = (id) => cities.find(c => c.id === id)?.name || "Inconnue";
  const getDestination = (route) =>
    route.city_from_id === profile.city_id ? route.city_to_id : route.city_from_id;
  const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <PlayerStatusBar profile={profile} homeCity={homeCity} city={city} onRefresh={onRefresh} />

      {getPassiveTravelDiscount(profile) > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm font-body text-emerald-800">
          🎒 <strong>Sac de voyage</strong> : −50% sur la durée de tous vos voyages (passif permanent tant que le sac est en stock).
        </div>
      )}
      {(profile.travel_discount || 0) > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 text-sm font-body text-indigo-800">
          🗺️ <strong>Réduction voyage active</strong> : −{Math.round((profile.travel_discount || 0) * 100)}% sur la durée du prochain voyage (usage unique, héritage).
        </div>
      )}

      {/* ── Événements monde ── */}
      {worldEvents && (() => {
        const events = [];
        const now = new Date();
        const nowHour = now.getHours();

        // Caravane royale
        const c = worldEvents.caravane;
        if (c?.active) {
          const caravaneHour = c.starts_at_hour || 10;
          const isActive = nowHour >= caravaneHour && nowHour < caravaneHour + 6;
          events.push(
            <div key="caravane" className={`rounded-lg border px-4 py-3 text-sm font-body ${isActive ? "border-amber-400 bg-amber-50" : "border-border bg-muted/30"}`}>
              <div className="flex items-center gap-2 font-semibold">
                <span>🐪</span>
                <span className={isActive ? "text-amber-800" : "text-muted-foreground"}>
                  Caravane royale {isActive ? "— EN COURS !" : `— démarre à ${caravaneHour}h`}
                </span>
              </div>
              <p className="text-xs mt-1 text-muted-foreground">
                Route : <strong>{c.route_name}</strong> · Achète {c.item} à <strong>×{c.price_multiplier} le prix</strong> pendant 6h.
                {isActive && " Vendez maintenant pour en profiter !"}
              </p>
            </div>
          );
        }

        // Bandit
        const b = worldEvents.bandit;
        if (b?.active) {
          events.push(
            <div key="bandit" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-body">
              <div className="flex items-center gap-2 font-semibold text-red-800">
                <span>🦹</span><span>Bandit de grand chemin</span>
              </div>
              <p className="text-xs mt-1 text-red-700">
                Route dangereuse : <strong>{b.route_name}</strong> · 15% de chance de perdre 10% de vos ressources.
                Jusqu'au {b.expires_date}. (Immunisé si défense ≥ 2)
              </p>
            </div>
          );
        }

        // Épidémie
        const e = worldEvents.epidemie;
        if (e?.active) {
          events.push(
            <div key="epidemie" className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-body">
              <div className="flex items-center gap-2 font-semibold text-orange-800">
                <span>🤒</span><span>Épidémie à {e.city_name}</span>
              </div>
              <p className="text-xs mt-1 text-orange-700">
                Faim max −3 pour les résidents de {e.city_name} jusqu'au {e.expires_date}. Forte demande en nourriture sur le marché !
              </p>
            </div>
          );
        }

        // Péage doublé
        const p = worldEvents.peage;
        if (p?.active) {
          events.push(
            <div key="peage" className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-body">
              <div className="flex items-center gap-2 font-semibold text-yellow-800">
                <span>🚧</span><span>Péage doublé</span>
              </div>
              <p className="text-xs mt-1 text-yellow-700">
                Route : <strong>{p.route_name}</strong> · Coût ×{p.multiplier} jusqu'au {p.expires_date}.
              </p>
            </div>
          );
        }

        if (events.length === 0) return null;
        return (
          <div className="space-y-2">
            <h3 className="font-heading font-semibold text-sm">🌍 Événements du monde</h3>
            {events}
          </div>
        );
      })()}

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold heading-medieval">Voyage</h2>
        <div className="text-xs text-muted-foreground font-body bg-muted/60 rounded-lg px-3 py-1.5">
          📅 Prix du jour — changent chaque nuit
        </div>
      </div>

      {/* Avertissement faim trop basse pour voyager (la jauge est dans la status bar) */}
      {hungryBlocked && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 flex items-center gap-3">
          <span className="text-xl">💤</span>
          <span className="text-sm font-body font-semibold text-red-700">
            Trop épuisé pour voyager — mangez d'abord !
          </span>
        </div>
      )}

      {profile.is_traveling && (
        <Card className="border-accent border-2">
          <CardContent className="p-6 text-center">
            <div className="text-4xl mb-3 animate-bounce">🐴</div>
            <h3 className="font-heading text-lg font-semibold">
              En route vers {
  profile.travel_destination_id?.startsWith("biome:")
    ? (BIOMES[profile.travel_destination_id.replace("biome:", "")]?.name || profile.travel_destination_id)
    : getCityName(profile.travel_destination_id)
}
            </h3>
            {timeLeft !== null && timeLeft > 0 ? (
              <div className="mt-2">
                <p className="text-muted-foreground font-body">Temps restant :</p>
                <p className="font-heading text-2xl text-accent font-bold">{formatTime(timeLeft)}</p>
              </div>
            ) : (
              <p className="text-chart-2 font-body font-semibold mt-2">Arrivée imminente...</p>
            )}
          </CardContent>
        </Card>
      )}

      {!profile.is_traveling && (
        <>
          <div className="space-y-1">
            <p className="text-muted-foreground font-body">
              Vous êtes à <strong>{city?.name || "..."}</strong>. Choisissez votre destination.
            </p>
            <p className="text-sm text-muted-foreground font-body italic">
              ⚠️ Les taxes d'une ville sont inconnues tant que vous n'y avez pas voyagé.
            </p>
            {hasPort && (
              <p className="text-sm text-blue-600 font-body">
                ⚓ Votre ville a un port — les routes maritimes sont disponibles (gratuites, mais 5× plus longues).
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : visibleRoutes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground font-body">
                Cette cité semble isolée du reste du monde — aucune route ne s'en échappe pour l'instant.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleRoutes.map(route => {
                const destId = getDestination(route);
                const destCity = cities.find(c => c.id === destId);
                const roadType = getRouteType(route);
                const rtDef = ROAD_TYPES[roadType] || ROAD_TYPES.royale;
                const isMaritime = roadType === "maritime";

                const isInterTerritory = route.is_inter_territory || route.road_type === "inter_territoire";
                const travelCost = computeTravelCost(roadType, route.id, departCity, profile);
                const toll = computeWallToll(destCity, profile);
                const totalCost = travelCost + toll;
                const displayMinutes = isMaritime ? route.travel_time_minutes * 5 : route.travel_time_minutes;
                const canAfford = (profile.gold || 0) >= travelCost;

                const hasRoutePavee = departCity?.buildings?.some(b => b.building_type === "route");
                const isResident = profile.home_city_id === departCity?.id || profile.city_id === departCity?.id;
                const guildCount = (departCity?.buildings || []).filter(b => b.building_type === "caserne").length;
                const hasGuildDiscount = isResident && guildCount > 0;
                const baseCost = getDailyRouteCost(roadType, route.id);
                const hasDiscount = !isMaritime && travelCost < baseCost && baseCost > 0;

                return (
                  <Card key={route.id} className={`hover:border-primary/50 transition-colors ${isInterTerritory ? "border-2 border-amber-400/60 bg-amber-50/5" : ""}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          {isInterTerritory && (
                            <span style={{ fontSize: "10px", background: "#92400e", color: "#fde68a", padding: "2px 8px", borderRadius: "999px", fontWeight: "bold", letterSpacing: 1, marginBottom: "4px", display: "inline-block" }}>
                              🌍 ROUTE INTER-TERRITOIRE
                            </span>
                          )}
                          <h4 className="font-heading font-semibold text-lg">{destCity?.name || "???"}</h4>
                          <p className="text-xs text-muted-foreground font-body">
                            👑 {destCity?.mayor_name} — 👥 {destCity?.population || 0}/{destCity?.max_population || 5}
                          </p>
                        </div>
                        <Badge className={ROAD_COLORS[roadType] || "bg-gray-100 text-gray-800"}>
                          {rtDef.label}
                        </Badge>
                      </div>

                      <div className="text-xs font-body space-y-1 bg-muted/40 rounded-lg px-3 py-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">⏱️ Durée</span>
                          <span className="font-semibold">
                            {displayMinutes} min
                            {isMaritime && <span className="text-blue-500 ml-1">(×5)</span>}
                          </span>
                        </div>

                        <div className="flex justify-between">
                           <span className="text-muted-foreground">💰 Frais de route</span>
                           <span className={travelCost > 0 ? "font-semibold text-amber-700" : "text-green-700 font-semibold"}>
                             {isMaritime ? "⛵ Gratuit" : travelCost > 0 ? (
                               <span>
                                 {travelCost} or
                                 {hasDiscount && (
                                   <span className="line-through text-muted-foreground ml-1 text-xs">{baseCost}</span>
                                 )}
                               </span>
                             ) : "Gratuit"}
                           </span>
                         </div>
                        {!isMarchand && hasRoutePavee && baseCost > 0 && !isMaritime && (
                          <div className="flex justify-between text-green-700">
                            <span>🛣️ Route pavée</span>
                            <span className="font-semibold">−50% frais</span>
                          </div>
                        )}
                        {!isMarchand && hasGuildDiscount && baseCost > 0 && !isMaritime && (
                          <div className="flex justify-between text-green-700">
                            <span>🧭 Guilde des voyageurs</span>
                            <span className="font-semibold">−30% frais</span>
                          </div>
                        )}

                        <div className="flex justify-between text-muted-foreground">
                          <span>🍽️ Coût en faim</span>
                          <span className={hungryBlocked ? "text-red-600 font-semibold" : ""}>−1</span>
                        </div>

                        {toll > 0 && (
                          <div className="flex justify-between text-orange-700 font-semibold border-t border-orange-200 pt-1 mt-1">
                            <span>🏰 Péage (arrivée)</span>
                            <span>{toll} or</span>
                          </div>
                        )}

                        {travelCost > 0 && toll > 0 && (
                          <div className="flex justify-between font-bold border-t pt-1 mt-1">
                            <span>Total estimé</span>
                            <span>{totalCost} or</span>
                          </div>
                        )}
                      </div>

                      {!canAfford && (
                         <p className="text-xs text-red-600 font-body font-semibold">
                           ⚠️ Pas assez d'or pour les frais de route.
                         </p>
                       )}

                      {hungryBlocked && (
                        <p className="text-xs text-red-600 font-body font-semibold">
                          🍽️ Mangez quelque chose avant de partir !
                        </p>
                      )}

                      <Button
                        size="sm"
                        className="w-full font-heading"
                        onClick={() => handleTravel(destId, route.travel_time_minutes, roadType, route.id)}
                        disabled={traveling || !canAfford || hungryBlocked}
                        variant={canAfford && !hungryBlocked ? "default" : "outline"}
                      >
                        {hungryBlocked
                          ? "💤 Épuisé"
                          : isMaritime
                            ? "Embarquer ⛵"
                            : (canAfford || isMarchand)
                              ? "Partir 🐴"
                              : "Pas assez d'or"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
              </div>
              )}

              {/* ── Biomes accessibles ── */}
              <div className="mt-8 border-t border-border pt-6">
              <h3 className="font-heading text-lg font-semibold mb-3">🌍 Biomes explorables</h3>
              <p className="text-sm text-muted-foreground font-body mb-4">
              Explorez les biomes pour vivre une épopée quotidienne (5 vagues enchaînées) et récolter des ressources rares. Une seule épopée par jour, gratuite et sans impôt.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(BIOMES).map(([key, biome]) => (
               <Card key={key} className="hover:border-primary/50 transition-colors">
                 <CardContent className="p-4 space-y-2">
                   <div className="flex items-center gap-2">
                     <span className="text-2xl">{biome.icon}</span>
                     <h4 className="font-heading font-semibold">{biome.name}</h4>
                   </div>
                   <p className="text-xs text-muted-foreground font-body">{biome.description}</p>
                   <Button
                     size="sm"
                     className="w-full font-heading mt-2"
                     onClick={() => setSelectedBiome(key)}
                     disabled={hungryBlocked}
                   >
                     🗺️ Explorer
                   </Button>
                 </CardContent>
               </Card>
              ))}
              </div>
              </div>
              </>
              )}
              </div>
              );
              }

