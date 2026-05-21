/**
 * useCityState : hook centralisant les calculs et handlers de la ville.
 *
 * Extrait de CityView.jsx (10/05/2026, Phase 4 refacto) pour permettre la
 * réutilisation par MairieDrawer (drawer ouvert depuis VillageView) sans
 * dupliquer la logique métier.
 *
 * Couverture :
 *   - Chargement : cityPlayers (présents + résidents, hors voyageurs/biome),
 *     routes, allCitiesForMilitary
 *   - Calculs dérivés : mayorActive, isMayor, isAdmin, isHomeCity, cityRoles,
 *     nbResidents, dailyMaintenance, buildingsByCategory, isPlayerOnline
 *   - Handlers maire : handleSetRole, handleExpel, handleBuild
 *   - States locaux pour MairieContent : building (anti-double-click),
 *     selectedAtelier, challengeTarget, activeCategory
 *
 * Hors périmètre (restent dans CityView) :
 *   - Banque (depositObjectives, sellToWarehouseAmounts, handleSell...)
 *   - Dôme de protection (activeDome)
 *   - Devenir maire / Sceau royal (handleBuySceau, handleBecomeMayor)
 *   - Élection / vote satisfaction
 */
import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  BUILDING_TYPES,
  getBuildingCost, getBuildingLevel, canBuildMore,
  getCityDailyMaintenance, getTodayDateStr,
  ADMIN_EMAILS,
} from "@/lib/gameData";
import { notifyTavern } from "@/lib/tavernNotifier";

export function useCityState(profile, city, onRefresh) {
  // ── States ─────────────────────────────────────────────────────────────
  const [cityPlayers, setCityPlayers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [allCitiesForMilitary, setAllCitiesForMilitary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [selectedAtelier, setSelectedAtelier] = useState(null);
  const [challengeTarget, setChallengeTarget] = useState(null);
  const [activeCategory, setActiveCategory] = useState("logement");

  // ── Chargement initial ────────────────────────────────────────────────
  useEffect(() => {
    if (!city?.id) return;
    let cancelled = false;
    async function load() {
      const [presentPlayers, residentPlayers, allRoutes, allCities] = await Promise.all([
        base44.entities.PlayerProfile.filter({ city_id: city.id }, "character_name", 50),
        base44.entities.PlayerProfile.filter({ home_city_id: city.id }, "character_name", 50),
        base44.entities.TravelRoute.list(),
        base44.entities.City.list(),
      ]);
      if (cancelled) return;
      // Exclure les joueurs en voyage ou en biome (cf. mai 2026 "se cacher")
      const isPhysicallyInCity = (p) => !p.is_traveling && !p.current_biome;
      const filteredPresent = (presentPlayers || []).filter(isPhysicallyInCity);
      const filteredResidents = (residentPlayers || []).filter(isPhysicallyInCity);
      const allIds = new Set(filteredPresent.map(p => p.id));
      const merged = [...filteredPresent, ...filteredResidents.filter(p => !allIds.has(p.id))];
      setCityPlayers(merged);
      setRoutes(allRoutes || []);
      setAllCitiesForMilitary((allCities || []).filter(c => !c.is_bot_city));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [city?.id]);

  // ── Calculs dérivés ───────────────────────────────────────────────────
  const todayStr = getTodayDateStr();

  const mayorActive = useMemo(() => {
    if (!city) return false;
    return !!(
      city.mayor_id &&
      city.mayor_until &&
      city.mayor_until.length === 10 &&  // format YYYY-MM-DD
      city.mayor_until >= todayStr
    );
  }, [city, todayStr]);

  const isMayor = useMemo(() => {
    return mayorActive && city?.mayor_id === profile?.id;
  }, [mayorActive, city?.mayor_id, profile?.id]);

  const isAdmin = useMemo(() => {
    return ADMIN_EMAILS.includes(profile?.user_email);
  }, [profile?.user_email]);

  const isHomeCity = useMemo(() => {
    return profile?.home_city_id === city?.id;
  }, [profile?.home_city_id, city?.id]);

  const cityRoles = useMemo(() => city?.city_roles || {}, [city?.city_roles]);

  const nbResidents = useMemo(() => {
    if (!city) return 0;
    return cityPlayers.filter(p => p.home_city_id === city.id).length;
  }, [cityPlayers, city?.id]);

  const dailyMaintenance = useMemo(() => {
    if (!city) return {};
    return getCityDailyMaintenance(city, nbResidents);
  }, [city, nbResidents]);

  const buildingsByCategory = useMemo(() => {
    const result = {};
    Object.entries(BUILDING_TYPES).forEach(([key, bType]) => {
      const cat = bType.category;
      if (!result[cat]) result[cat] = [];
      result[cat].push({ key, ...bType });
    });
    return result;
  }, []);

  const isPlayerOnline = (player) => {
    if (!player?.last_active_at) return false;
    const lastActive = new Date(player.last_active_at);
    const now = new Date();
    const minsSinceActive = (now - lastActive) / (1000 * 60);
    return minsSinceActive < 5;
  };

  // ── Handlers ──────────────────────────────────────────────────────────

  /**
   * Nomme ou démet un joueur d'un rôle de cité (percepteur, chef de guerre, acheteur).
   * Si player == null → retire le rôle.
   */
  const handleSetRole = async (role, player) => {
    if (!city) return;
    const roles = { ...(city.city_roles || {}) };
    if (player) {
      roles[`${role}_id`]   = player.id;
      roles[`${role}_name`] = player.character_name;
    } else {
      delete roles[`${role}_id`];
      delete roles[`${role}_name`];
    }
    await base44.entities.City.update(city.id, { city_roles: roles });
    toast.success(player
      ? `👑 ${player.character_name} nommé(e) comme ${
          role === "percepteur" ? "Percepteur" :
          role === "chef_guerre" ? "Chef de guerre" :
          "Acheteur"
        } !`
      : `Rôle retiré.`);
    onRefresh?.();
  };

  /**
   * Expulse un joueur de la ville (réservé maire). Le joueur est téléporté
   * dans une autre ville aléatoire (pas un bot).
   */
  const handleExpel = async (targetPlayer) => {
    if (!isMayor) return;
    if (targetPlayer.id === profile.id) {
      toast.error("Vous ne pouvez pas vous expulser vous-même.");
      return;
    }
    const confirmed = window.confirm(
      `Expulser ${targetPlayer.character_name} de ${city.name} ? Il sera téléporté dans une ville aléatoire.`
    );
    if (!confirmed) return;
    const allCities = await base44.entities.City.list();
    const otherCities = allCities.filter(c => c.id !== city.id && !c.is_bot_city);
    const dest = otherCities[Math.floor(Math.random() * otherCities.length)];
    if (!dest) {
      toast.error("Aucune ville disponible pour l'expulsion.");
      return;
    }
    await base44.entities.PlayerProfile.update(targetPlayer.id, {
      city_id: dest.id,
      home_city_id: dest.id,
    });
    await notifyTavern({
      cityId: city.id,
      audience: "residents",
      authorName: "Garde royal",
      message: `🚫 ${targetPlayer.character_name} a été expulsé(e) de ${city.name} par ordre du maire.`,
    });
    toast.success(`${targetPlayer.character_name} a été expulsé(e) !`);
    onRefresh?.();
  };

  /**
   * Construit ou améliore un bâtiment. Vérifie ressources entrepôt + max
   * niveau, débite l'entrepôt, met à jour les buildings de la ville et
   * recalcule max_population si construction (popBonus appliqué).
   */
  const handleBuild = async (buildingKey) => {
    if (!isMayor) {
      toast.error("⚔️ Seul le maire en exercice peut construire des bâtiments.");
      return;
    }
    const bType = BUILDING_TYPES[buildingKey];
    if (!bType) return;
    if (!canBuildMore(city, buildingKey)) {
      const currentLevel = getBuildingLevel(city, buildingKey);
      if (currentLevel >= 5) {
        toast.error(`${bType.name} est déjà au niveau maximum (5).`);
      } else {
        toast.error(`Impossible de construire ${bType.name} ici.`);
      }
      return;
    }

    const currentLevel = getBuildingLevel(city, buildingKey);
    const isUpgrade = currentLevel > 0 && !bType.stackable;
    const cost = getBuildingCost(buildingKey, currentLevel);
    const warehouse = city.warehouse || {};

    for (const [res, qty] of Object.entries(cost)) {
      if ((warehouse[res] || 0) < qty) {
        toast.error(`L'entrepôt manque de ${res} (${warehouse[res] || 0}/${qty}).`);
        return;
      }
    }

    setBuilding(true);
    try {
      const newWarehouse = { ...warehouse };
      for (const [res, qty] of Object.entries(cost)) {
        newWarehouse[res] = (newWarehouse[res] || 0) - qty;
      }

      let newBuildings;
      let newMaxPop = city.max_population || 3;

      if (isUpgrade) {
        // UPGRADE : on augmente le level (le popBonus est déjà appliqué)
        newBuildings = (city.buildings || []).map(b =>
          b.building_type === buildingKey
            ? { ...b, level: (b.level || 1) + 1 }
            : b
        );
      } else {
        // CONSTRUCTION : on ajoute une nouvelle entrée au tableau (niveau 1)
        newBuildings = [...(city.buildings || []), {
          building_type: buildingKey,
          name: bType.name,
          level: 1,
          built_date: getTodayDateStr(),
        }];
        // popBonus s'applique uniquement à la construction initiale
        if (bType.popBonus > 0) {
          newMaxPop = (city.max_population || 3) + bType.popBonus;
        }
      }

      await base44.entities.City.update(city.id, {
        warehouse: newWarehouse,
        buildings: newBuildings,
        max_population: newMaxPop,
      });

      if (isUpgrade) {
        toast.success(`🔧 ${bType.name} améliorée au niveau ${currentLevel + 1} !`);
      } else {
        toast.success(`🏗️ ${bType.name} construite ! Ressources prélevées de l'entrepôt.`);
      }
      onRefresh?.();
    } catch (e) {
      console.error("[handleBuild]", e);
      toast.error("Erreur lors de la construction.");
    } finally {
      setBuilding(false);
    }
  };

  return {
    // States
    cityPlayers, routes, allCitiesForMilitary, loading,
    building, selectedAtelier, setSelectedAtelier,
    challengeTarget, setChallengeTarget,
    activeCategory, setActiveCategory,
    // Calculs dérivés
    mayorActive, isMayor, isAdmin, isHomeCity, cityRoles,
    nbResidents, dailyMaintenance, buildingsByCategory,
    isPlayerOnline, todayStr,
    // Handlers
    handleSetRole, handleExpel, handleBuild,
  };
}
