/**
 * handleTravelArrival.js
 * Gestion centralisée de l'arrivée automatique en voyage.
 *
 * Appelé par toutes les pages au chargement (ProductionPage, CityPage,
 * MarketPage, TravelPage, ProfilePage) quand le joueur a un voyage terminé.
 *
 * Retourne le profil mis à jour (ou le profil inchangé si pas de voyage terminé).
 */

import { base44 } from '@/api/base44Client';
import { checkAndAwardObjective } from '@/lib/questRewards';
import { logGold } from '@/lib/goldLog';
import { toast } from 'sonner';

const todayStr = () => new Date().toISOString().split('T')[0];

export async function handleTravelArrival(p) {
  // Pas en voyage ou voyage pas encore terminé → rien à faire
  if (!p.is_traveling || !p.travel_arrival_time) return p;
  if (new Date(p.travel_arrival_time) > new Date()) return p;

  const destId = p.travel_destination_id;

  // ── Arrivée dans un biome ──
  if (destId && destId.startsWith('biome:')) {
    await base44.entities.PlayerProfile.update(p.id, {
      is_traveling: false,
      travel_arrival_time: '',
      // travel_destination_id conservé → CityPage détecte le biome
    });
    p = { ...p, is_traveling: false, travel_arrival_time: '' };

    // Valider les quêtes travel (biome compte comme voyage)
    await _validateTravelQuests(p);
    return p;
  }

  // ── Arrivée en ville ──
  const allCities = await base44.entities.City.list();
  const arrivalCity = allCities.find(c => c.id === destId);
  const visited = [...new Set([...(p.visited_cities || []), destId])];

  const profileUpdates = {
    city_id: destId,
    is_traveling: false,
    travel_destination_id: '',
    travel_arrival_time: '',
    visited_cities: visited,
  };

  // Péage remparts
  if (arrivalCity) {
    const wallCount = (arrivalCity.buildings || []).filter(b => b.building_type === 'remparts').length;
    const isResident = p.home_city_id === destId || p.city_id === destId;
    const toll = (!isResident && wallCount > 0) ? wallCount : 0;
    if (toll > 0) {
      const actualToll = Math.min(toll, p.gold || 0);
      profileUpdates.gold = (p.gold || 0) - actualToll;
      await base44.entities.City.update(arrivalCity.id, {
        gold_treasury: (arrivalCity.gold_treasury || 0) + actualToll,
        treasury_cumulative: (arrivalCity.treasury_cumulative || 0) + actualToll,
      });
      // Log péage
      await logGold({
        profile: p,
        city: arrivalCity,
        amount: -actualToll, type: 'peage',
        description: `Péage remparts de ${arrivalCity.name}`,
      });
      toast.info(`🏰 Péage : −${actualToll} 💰 pour entrer dans ${arrivalCity.name}.`);
    }
  }

  await base44.entities.PlayerProfile.update(p.id, profileUpdates);
  p = { ...p, ...profileUpdates };

  // Valider les quêtes travel
  await _validateTravelQuests(p, arrivalCity);

  return p;
}

async function _validateTravelQuests(p, arrivalCity = null) {
  try {
    const allTravelObjs = await base44.entities.PlayerObjective.filter({
      player_email: p.user_email,
      status: 'active',
      type: 'travel',
    });
    const today = todayStr();
    const travelObjs = allTravelObjs.filter(o =>
      (o.created_date || o.quest_date || '').startsWith(today)
    );
    for (const obj of travelObjs) {
      await checkAndAwardObjective({ obj, addedQty: 1, profile: p, city: arrivalCity });
    }
  } catch (e) {
    console.warn('handleTravelArrival: validateTravelQuests:', e);
  }
}
