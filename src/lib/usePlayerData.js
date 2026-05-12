/**
 * usePlayerData.js
 *
 * Refacto 12/05/2026 : ce hook est désormais un simple re-export depuis
 * PlayerDataContext. Avant, il avait sa propre logique de fetch local
 * (un fetch par instance, donc N instances = N copies de city → bug
 * de désynchro après voyage). Maintenant, il consomme le context unique.
 *
 * Tous les call sites continuent à fonctionner sans modification :
 *   const { profile, city, homeCity, cities, loading, refresh } = usePlayerData();
 *
 * Nouveautés disponibles via ce même hook :
 *   - refreshOptimistic(patch) : update optimiste pour réactivité instantanée
 *   - refreshProfile : alias de refresh (compat ProfileContext historique)
 */
export { usePlayerData } from "./PlayerDataContext";
