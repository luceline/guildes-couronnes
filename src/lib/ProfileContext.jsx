/**
 * ProfileContext.jsx — Source unique de vérité pour le profil joueur (11/05/2026).
 *
 * Avant ce refacto : chaque composant qui modifiait le profile (~47 fichiers)
 * ne déclenchait pas de mise à jour globale, donc la MiniStatusBar et autres
 * affichages dépendant du profile n'étaient pas synchronisés en temps réel.
 *
 * Approche : un context React qui détient le profil + 2 méthodes :
 *   - refreshProfile() : relit depuis PocketBase, source de vérité (utiliser
 *                        après toute mutation ou pour synchroniser un état
 *                        potentiellement obsolète).
 *   - refreshOptimistic(patch) : merge un objet partiel dans le state local
 *                                immédiatement, puis trigger un refresh BDD
 *                                en arrière-plan pour valider. Utiliser pour
 *                                les actions visuellement critiques (achat,
 *                                récolte, combat) où on ne veut pas attendre
 *                                la round-trip réseau.
 *
 * Safety net : un polling toutes les 30s relit le profile en arrière-plan,
 * uniquement si l'onglet est visible. Évite toute désynchro durable.
 */
import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "./AuthContext";

const ProfileContext = createContext({
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  refreshOptimistic: () => {},
});

const SAFETY_POLL_MS = 30 * 1000; // 30s : safety net pour rattraper toute désynchro

export function ProfileProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Ref pour stocker l'id sans déclencher de re-render à chaque setProfile
  const profileIdRef = useRef(null);

  // Chargement initial du profil dès qu'on a un user
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthenticated || !user?.email) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const profiles = await base44.entities.PlayerProfile.filter({ user_email: user.email });
        if (cancelled) return;
        const p = profiles[0] || null;
        setProfile(p);
        profileIdRef.current = p?.id || null;
      } catch (e) {
        console.error("ProfileContext: erreur chargement initial", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.email]);

  /**
   * refreshProfile : recharge le profile depuis PocketBase et synchronise
   * le state global. À appeler après toute mutation ou pour réconcilier
   * un état potentiellement obsolète.
   */
  const refreshProfile = useCallback(async () => {
    const id = profileIdRef.current;
    if (!id) return;
    try {
      const fresh = await base44.entities.PlayerProfile.get(id);
      if (fresh) setProfile(fresh);
    } catch (e) {
      console.warn("ProfileContext: refresh échec", e);
    }
  }, []);

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
    refreshProfile();
  }, [refreshProfile]);

  // ─── Safety net : polling 30s si onglet visible ────────────────────────
  useEffect(() => {
    if (!profile?.id) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      refreshProfile();
    };
    const interval = setInterval(tick, SAFETY_POLL_MS);
    return () => clearInterval(interval);
  }, [profile?.id, refreshProfile]);

  return (
    <ProfileContext.Provider value={{ profile, loading, refreshProfile, refreshOptimistic }}>
      {children}
    </ProfileContext.Provider>
  );
}

/**
 * Hook principal : retourne { profile, loading, refreshProfile, refreshOptimistic }.
 * Utilisable depuis n'importe quel composant sous <ProfileProvider>.
 */
export function useProfile() {
  return useContext(ProfileContext);
}
