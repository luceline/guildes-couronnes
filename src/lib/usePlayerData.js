/**
 * usePlayerData.js
 * Hook centralisé pour charger les données du joueur connecté.
 *
 * Remplace le code dupliqué dans :
 *   CityPage, MarketPage, ProductionPage, ProfilePage, TravelPage
 *
 * Retourne :
 *   profile   : profil joueur mis à jour (faim regen + arrivée voyage)
 *   city      : ville courante du joueur
 *   homeCity  : ville de résidence
 *   cities    : toutes les villes (utile pour Profile, Travel…)
 *   loading   : true pendant le chargement initial
 *   refresh   : fonction pour recharger manuellement
 */

import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { applyHungerRegen } from "./hungerRegen";
import { handleTravelArrival } from "./handleTravelArrival";

export function usePlayerData() {
  const [profile, setProfile]   = useState(null);
  const [city, setCity]         = useState(null);
  const [homeCity, setHomeCity] = useState(null);
  const [cities, setCities]     = useState([]);
  const [loading, setLoading]   = useState(true);

  const refresh = useCallback(async () => {
    try {
      const user = await base44.auth.me();
      if (!user) { setLoading(false); return; }

      const [profiles, allCities] = await Promise.all([
        base44.entities.PlayerProfile.filter({ user_email: user.email }),
        base44.entities.City.list(),
      ]);

      if (profiles.length === 0) { setLoading(false); return; }

      let p = profiles[0];
      // Régen passive : on passe la ville d'origine pour bénéficier de Fontaine/Hospice
      const homeCityForRegen = allCities.find(c => c.id === (p.home_city_id || p.city_id)) || null;
      p = await applyHungerRegen(p, homeCityForRegen);
      p = await handleTravelArrival(p);

      setCities(allCities);
      setProfile(p);

      if (p.city_id) {
        // Utiliser City.get() pour avoir les données fraîches de la ville courante
        const freshCity = await base44.entities.City.get(p.city_id).catch(() => null);
        setCity(freshCity || allCities.find(c => c.id === p.city_id) || null);
        const homeCityId = p.home_city_id || p.city_id;
        setHomeCity(allCities.find(c => c.id === homeCityId) || null);
      }
    } catch (e) {
      console.warn("usePlayerData:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh à l'arrivée d'un voyage : programme un setTimeout qui se
  // déclenche pile à l'heure d'arrivée pour recharger le profil. Ainsi le
  // joueur n'a plus besoin de rafraîchir manuellement la page.
  // Le timer est cleanup à chaque changement de profil ou démontage.
  useEffect(() => {
    if (!profile?.is_traveling || !profile?.travel_arrival_time) return;
    const arrivalMs = new Date(profile.travel_arrival_time).getTime();
    const delay = arrivalMs - Date.now();
    // Si déjà arrivé (delay négatif ou nul) : refresh immédiat
    // Sinon, on programme le refresh pour l'instant exact + 200ms de marge
    // (la marge évite les race conditions où le serveur n'a pas encore validé
    // la transition is_traveling=false côté handleTravelArrival)
    const timer = setTimeout(() => {
      refresh();
    }, Math.max(0, delay) + 200);
    return () => clearTimeout(timer);
  }, [profile?.is_traveling, profile?.travel_arrival_time, refresh]);

  return { profile, city, homeCity, cities, loading, refresh };
}
