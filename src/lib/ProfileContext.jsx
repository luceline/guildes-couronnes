/**
 * ProfileContext.jsx
 *
 * Refacto 12/05/2026 : ce fichier est conservé uniquement comme alias de
 * compat ascendante. Toute la logique a migré vers PlayerDataContext qui
 * porte désormais TOUT (profile, city, homeCity, cities) en source unique
 * de vérité.
 *
 * Avant : ProfileContext (profile global) + usePlayerData (profile/city
 * locaux par mount). Conséquence : N instances de city dans l'app → bug
 * de désynchro après voyage (GameLayout affichait l'ancienne ville).
 *
 * Après : PlayerDataContext gère tout. ProfileContext et usePlayerData
 * sont des re-exports pour ne casser aucun call site existant.
 *
 * Pour le code nouveau : préférer import { usePlayerData } from
 * "./PlayerDataContext".
 */
export { PlayerDataProvider as ProfileProvider, useProfile } from "./PlayerDataContext";
