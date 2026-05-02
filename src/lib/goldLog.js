/**
 * goldLog.js : Fonction centralisée pour logger les transactions or.
 *
 * Remplace les 6 définitions locales identiques dans :
 *   CityView, Market, Production, Travel, Profile, ProfessionChangePanel
 */

import { base44 } from '@/api/base44Client';

export async function logGold(playerEmail, playerName, cityId, cityName, amount, type, description) {
  try {
    await base44.entities.GoldTransaction.create({
      player_email: playerEmail,
      player_name:  playerName  || '',
      city_id:      cityId      || '',
      city_name:    cityName    || '',
      amount,
      type,
      description,
    });
  } catch (e) {
    console.warn('logGold:', e);
  }
}
