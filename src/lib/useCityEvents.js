/**
 * useCityEvents.js : hook React pour charger les événements actifs d'une ville
 * et exposer les buffs synchroniquement aux composants qui en ont besoin
 * (Production, Travel, CombatEpic).
 *
 * Usage :
 *   const { activeBuffs, hasBuff, getBuffMultiplier } = useCityEvents(city?.id);
 *
 *   // Buff actif ?
 *   if (hasBuff("work_festival")) { ... }
 *
 *   // Multiplicateur cooldown (ex: 0.5 si Fête du travail = -50%)
 *   const cooldownMultiplier = getBuffMultiplier("work_festival", 0.5);
 */
import { useState, useEffect, useCallback } from "react";
import { loadActiveEventsForCity, findActiveBuff } from "@/lib/cityEventsHelpers";

export function useCityEvents(cityId) {
  const [activeBuffs, setActiveBuffs] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!cityId) {
      setActiveBuffs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const events = await loadActiveEventsForCity(cityId);
      setActiveBuffs(events || []);
    } catch (e) {
      console.warn("[useCityEvents] load failed:", e);
      setActiveBuffs([]);
    } finally {
      setLoading(false);
    }
  }, [cityId]);

  useEffect(() => {
    reload();
    // Recharge toutes les 60s pour catch les nouveaux events
    const timer = setInterval(reload, 60000);
    return () => clearInterval(timer);
  }, [reload]);

  /**
   * Renvoie true si un buff de ce type est actif.
   */
  const hasBuff = useCallback((eventType) => {
    return findActiveBuff(activeBuffs, eventType) !== null;
  }, [activeBuffs]);

  /**
   * Renvoie le multiplicateur de réduction pour un buff actif (ou 0 si pas actif).
   * Exemple : pour Fête du travail (-50% cooldown), retourne 0.5 si actif, 0 sinon.
   */
  const getBuffMultiplier = useCallback((eventType, defaultValue = 0) => {
    return hasBuff(eventType) ? defaultValue : 0;
  }, [hasBuff]);

  return {
    activeBuffs,
    hasBuff,
    getBuffMultiplier,
    loading,
    reload,
  };
}
