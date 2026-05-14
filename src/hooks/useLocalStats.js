// ═══════════════════════════════════════════════════════════════════════════
// useLocalStats.js — Hook de synchronisation locale fatigue/faim
// ═══════════════════════════════════════════════════════════════════════════
// 14/05/2026 — Extraction depuis Production.jsx (Vague 2 refacto).
//
// Pourquoi ce hook :
// Pendant les actions joueur (farm, craft, consommer un aliment...), on veut un
// affichage IMMÉDIAT du nouveau niveau de fatigue/faim, sans attendre l'aller-
// retour BDD via `onRefresh`. C'est le rôle de localFatigue/localHunger : des
// valeurs "optimistes" affichées tout de suite, puis re-synchronisées dès que
// PocketBase renvoie l'état réel du profile.
//
// Le composant parent appelle les setters retournés après chaque action :
//   setLocalFatigue(newFatigue) immédiatement après removeFromInventory + update.
//
// Les useEffect internes ré-alignent localFatigue/Hunger sur profile.fatigue/hunger
// quand le profile change (refetch, autre action, navigation).

import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getMaxFatigue, getMaxHunger } from "@/lib/gameData";

/**
 * Hook de stats locales fatigue/faim pour synchronisation optimiste UI.
 *
 * @param {Object} profile - profile joueur (peut être null pendant le chargement)
 * @param {number} cityFatigueBonus - bonus fatigue de la ville (depuis cityBuildings)
 * @param {number} cityHungerBonus - bonus faim de la ville (depuis cityBuildings)
 * @returns {{
 *   localFatigue: number|null,
 *   setLocalFatigue: Function,
 *   localHunger: number|null,
 *   setLocalHunger: Function
 * }}
 */
export function useLocalStats(profile, cityFatigueBonus, cityHungerBonus) {
  const [localFatigue, setLocalFatigue] = useState(null);
  const [localHunger, setLocalHunger] = useState(null);

  // ── Sync fatigue depuis le profile ──
  useEffect(() => {
    if (!profile) return;
    const maxFat = getMaxFatigue(profile, cityFatigueBonus);
    const fatigue = profile.fatigue ?? maxFat;
    setLocalFatigue(fatigue);
  }, [profile?.id, profile?.fatigue, cityFatigueBonus]);

  // ── Sync hunger depuis le profile ──
  //
  // @deprecated 14/05/2026 — Le bloc `else if (localHunger === null)` qui INIT
  // hunger en BDD est du code de migration legacy : il couvrait les joueurs
  // créés avant l'ajout du champ `hunger`. En pratique tous les joueurs actifs
  // ont désormais ce champ (le cron de reset le maintient). À supprimer après
  // vérification : SELECT COUNT(*) FROM player_profiles WHERE hunger IS NULL.
  // Si 0 → ce bloc devient du code mort et peut être nettoyé.
  useEffect(() => {
    if (!profile) return;
    if (profile.hunger !== undefined && profile.hunger !== null) {
      setLocalHunger(profile.hunger);
    } else if (localHunger === null) {
      const maxH = getMaxHunger(profile, cityHungerBonus);
      setLocalHunger(maxH);
      base44.entities.PlayerProfile.update(profile.id, { hunger: maxH });
    }
  }, [profile?.id, profile?.hunger, cityHungerBonus]);

  return { localFatigue, setLocalFatigue, localHunger, setLocalHunger };
}
