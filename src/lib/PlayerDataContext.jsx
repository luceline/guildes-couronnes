/**
 * PlayerDataContext.jsx — Source unique de vérité pour le profil joueur ET
 * les villes (12/05/2026).
 *
 * Refacto de ProfileContext + usePlayerData :
 *   Avant : ProfileContext portait profile (global) et usePlayerData fetch
 *   ses propres profile/city/homeCity/cities (local à chaque mount).
 *   Conséquence : N instances de city dans l'app → désynchro après voyage
 *   (GameLayout affiche encore Valmur alors que TravelPage est passé à
 *   Vertpré). Bug observé le 12/05/2026.
 *
 *   Après : un seul context porte TOUT (profile, city, homeCity, cities).
 *   Toutes les pages consomment ce context via usePlayerData() — qui devient
 *   un simple consumer, plus un hook avec fetch propre.
 *
 * API publique :
 *   - profile : profil joueur (faim regen + arrivée voyage appliquées)
 *   - city : ville où se trouve actuellement le joueur
 *   - homeCity : ville de résidence du joueur
 *   - cities : toutes les villes (utile pour Profile, Travel, etc.)
 *   - loading : true pendant le chargement initial
 *   - refresh() : recharge depuis PocketBase (à appeler après toute mutation)
 *   - refreshOptimistic(patch) : applique un patch local immédiat puis trigger
 *       un refresh BDD en arrière-plan (réactivité visuelle instantanée pour
 *       les actions critiques : achat, récolte, combat).
 *
 * Safety net : un polling toutes les 30s relit profile + city + homeCity en
 * arrière-plan, uniquement si l'onglet est visible. Évite toute désynchro
 * durable si un autre joueur modifie la BDD (ex: maire change la taxe).
 *
 * Auto-refresh à l'arrivée d'un voyage : un setTimeout programmé pile à
 * l'heure d'arrivée déclenche un refresh. Plus besoin de refresh manuel.
 *
 * Compat ascendante : le hook useProfile() est exporté ici comme alias de
 * usePlayerData() pour ne pas casser GameLayout (le seul consumer historique
 * de ProfileContext) ni les usages futurs.
 */
import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "./AuthContext";
import { applyHungerRegen } from "./hungerRegen";
import { handleTravelArrival } from "./handleTravelArrival";

const PlayerDataContext = createContext({
  profile: null,
  city: null,
  homeCity: null,
  cities: [],
  loading: true,
  refresh: async () => {},
  refreshOptimistic: () => {},
  // Aliases pour compat ascendante avec ProfileContext (GameLayout)
  refreshProfile: async () => {},
});

const SAFETY_POLL_MS = 30 * 1000;

export function PlayerDataProvider({ children }) {
  const { isAuthenticated, user } = useAuth();

  const [profile, setProfile]     = useState(null);
  const [city, setCity]           = useState(null);
  const [homeCity, setHomeCity]   = useState(null);
  const [cities, setCities]       = useState([]);
  const [loading, setLoading]     = useState(true);

  // Ref pour détecter si le composant est démonté (évite les setState après unmount).
  // Bien que le Provider soit normalement monté tout au long de la session, cette
  // ceinture+bretelles protège contre les race conditions au logout.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  /**
   * refresh : recharge profile + city + homeCity + cities depuis PocketBase.
   *
   * Tous les setState sont déclenchés ENSEMBLE après les await pour garantir
   * un batch unique par React 18 → un seul re-render avec données cohérentes.
   *
   * Sans cette précaution, on avait une fenêtre de ~100ms où profile.city_id
   * pointait sur la nouvelle ville mais city contenait encore l'ancienne
   * (bug d'arrivée de voyage observé le 12/05/2026).
   */
  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user?.email) {
      // Logout : reset complet
      if (mountedRef.current) {
        setProfile(null);
        setCity(null);
        setHomeCity(null);
        setCities([]);
        setLoading(false);
      }
      return;
    }

    try {
      const [profiles, allCities] = await Promise.all([
        base44.entities.PlayerProfile.filter({ user_email: user.email }),
        base44.entities.City.list(),
      ]);

      if (profiles.length === 0) {
        if (mountedRef.current) setLoading(false);
        return;
      }

      let p = profiles[0];
      // Régen passive : on passe la ville d'origine pour bénéficier de Fontaine/Hospice
      const homeCityForRegen = allCities.find(c => c.id === (p.home_city_id || p.city_id)) || null;
      p = await applyHungerRegen(p, homeCityForRegen);
      p = await handleTravelArrival(p);

      // Charger la ville fraîche AVANT les setState pour que tout soit batch ensemble.
      // City.get() pour les données les plus fraîches de la ville courante (les
      // données du list() ci-dessus peuvent dater de quelques ms si un autre
      // joueur a modifié la ville entre-temps).
      let freshCity = null;
      let freshHomeCity = null;
      if (p.city_id) {
        const fetched = await base44.entities.City.get(p.city_id).catch(() => null);
        freshCity = fetched || allCities.find(c => c.id === p.city_id) || null;
        const homeCityId = p.home_city_id || p.city_id;
        freshHomeCity = allCities.find(c => c.id === homeCityId) || null;
      }

      if (!mountedRef.current) return;

      // Tous les setState ensemble — batchés en un seul render par React 18
      setCities(allCities);
      setCity(freshCity);
      setHomeCity(freshHomeCity);
      setProfile(p);
    } catch (e) {
      console.warn("PlayerDataContext: refresh échec", e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [isAuthenticated, user?.email]);

  /**
   * refreshOptimistic(patch) : applique immédiatement un patch local au
   * profile (pour réactivité visuelle instantanée), puis trigger un refresh
   * BDD en arrière-plan pour valider/corriger.
   *
   * Exemple : après un achat, refreshOptimistic({ gold: profile.gold - 10 })
   *          mettra le gold à jour visuellement avant que la BDD réponde.
   */
  const refreshOptimistic = useCallback((patch) => {
    if (!patch || typeof patch !== "object") return;
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
    // Refresh BDD en arrière-plan pour valider
    refresh();
  }, [refresh]);

  // ─── Chargement initial dès qu'on a un user ────────────────────────────
  // Refresh au changement d'auth (login/logout) et au mount.
  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // ─── Safety net : polling 30s si onglet visible ────────────────────────
  useEffect(() => {
    if (!profile?.id) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      refresh();
    };
    const interval = setInterval(tick, SAFETY_POLL_MS);
    return () => clearInterval(interval);
  }, [profile?.id, refresh]);

  // ─── Auto-refresh à l'arrivée d'un voyage ──────────────────────────────
  // Programme un setTimeout qui se déclenche pile à l'heure d'arrivée pour
  // recharger le profil. Ainsi le joueur n'a plus besoin de rafraîchir
  // manuellement la page. Le timer est cleanup à chaque changement de
  // profile ou démontage.
  useEffect(() => {
    if (!profile?.is_traveling || !profile?.travel_arrival_time) return;
    const arrivalMs = new Date(profile.travel_arrival_time).getTime();
    const delay = arrivalMs - Date.now();
    // 200ms de marge évite les race conditions où le serveur n'a pas encore
    // validé la transition is_traveling=false côté handleTravelArrival.
    const timer = setTimeout(() => {
      refresh();
    }, Math.max(0, delay) + 200);
    return () => clearTimeout(timer);
  }, [profile?.is_traveling, profile?.travel_arrival_time, refresh]);

  const value = {
    profile,
    city,
    homeCity,
    cities,
    loading,
    refresh,
    refreshOptimistic,
    // Alias historique : refreshProfile = refresh, pour compat ProfileContext.
    // GameLayout l'utilise. À garder tant que des call sites externes pourraient
    // l'utiliser.
    refreshProfile: refresh,
  };

  return (
    <PlayerDataContext.Provider value={value}>
      {children}
    </PlayerDataContext.Provider>
  );
}

/**
 * Hook principal : retourne { profile, city, homeCity, cities, loading,
 * refresh, refreshOptimistic, refreshProfile }.
 * Utilisable depuis n'importe quel composant sous <PlayerDataProvider>.
 */
export function usePlayerData() {
  return useContext(PlayerDataContext);
}

/**
 * Alias de compat ascendante : useProfile() retourne le même context.
 * Permet à GameLayout (et tout code historique qui faisait useProfile())
 * de continuer à fonctionner sans modification.
 */
export function useProfile() {
  return useContext(PlayerDataContext);
}
