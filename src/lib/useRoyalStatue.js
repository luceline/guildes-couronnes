/**
 * useRoyalStatue.js : hook React pour charger la statue royale active
 * et exposer les paliers actifs synchroniquement aux composants
 * (Production, Travel, BiomeHub, CombatEpic, objectiveGenerator).
 *
 * Usage :
 *   const { statue, activeTier, isHosting, hasPalier } = useRoyalStatue(profile?.home_city_id);
 *
 *   // Palier 1 actif sur la ville d'origine du joueur ?
 *   if (hasPalier(1)) { ... }
 *
 *   // Multiplicateur cooldown (-10% si palier 1)
 *   const reduction = hasPalier(1) ? 0.10 : 0;
 */
import { useState, useEffect, useCallback } from "react";
import {
  loadActiveStatue,
  isStatueInCity,
  getActiveTier,
} from "@/lib/royalStatueHelpers";

export function useRoyalStatue(playerHomeCityId) {
  const [statue, setStatue] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const s = await loadActiveStatue();
      setStatue(s);
    } catch (e) {
      console.warn("[useRoyalStatue] load failed:", e);
      setStatue(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    // Recharge toutes les 2 minutes (la statue change rarement)
    const timer = setInterval(reload, 120000);
    return () => clearInterval(timer);
  }, [reload]);

  // Statue active ET dans la ville d'origine du joueur ?
  const isHosting = isStatueInCity(statue, playerHomeCityId);
  const activeTier = isHosting ? getActiveTier(statue) : 0;

  /**
   * Renvoie true si le palier N est actif sur la ville hôte.
   * Le palier doit être <= au tier actuel.
   */
  const hasPalier = useCallback(
    (n) => isHosting && activeTier >= n,
    [isHosting, activeTier]
  );

  return {
    statue,
    activeTier,
    isHosting,
    hasPalier,
    loading,
    reload,
  };
}
