/**
 * Réimporte les travel_routes avec les bons IDs PocketBase
 * Usage : $env:PB_EMAIL="x"; $env:PB_PASS="y"; node migrate_routes.js
 */
import { createClient } from '@base44/sdk';

const PB_URL   = 'http://178.104.201.139';
const PB_EMAIL = process.env.PB_EMAIL || '';
const PB_PASS  = process.env.PB_PASS  || '';

const base44 = createClient({
  appId: '69d298c60a12568e6d687b5c',
  headers: { 'api_key': 'c8474ffe63474801afbe83324fecc77e' }
});

async function authPB() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
  });
  const d = await res.json();
  if (!d.token) throw new Error('Auth PB échouée');
  return d.token;
}

async function main() {
  console.log('\n🗺️ Migration routes de voyage\n');

  const token = await authPB();
  const headers = { 'Content-Type': 'application/json', 'Authorization': token };

  // 1. Récupérer les villes depuis PocketBase avec leur base44_id
  const pbCitiesRes = await fetch(`${PB_URL}/api/collections/cities/records?perPage=500`, { headers });
  const pbCities = (await pbCitiesRes.json()).items || [];
  console.log(`✅ ${pbCities.length} villes dans PocketBase`);

  // 2. Récupérer les villes depuis base44 pour créer le mapping
  const b44Cities = await base44.entities.City.list();
  console.log(`✅ ${b44Cities.length} villes dans base44`);

  // 3. Créer le mapping ancien ID base44 → nouveau ID PocketBase (par nom de ville)
  const nameToNewId = {};
  for (const pbCity of pbCities) {
    nameToNewId[pbCity.name] = pbCity.id;
  }

  const oldIdToNewId = {};
  for (const b44City of b44Cities) {
    const newId = nameToNewId[b44City.name];
    if (newId) {
      oldIdToNewId[b44City.id] = newId;
      console.log(`  📍 ${b44City.name}: ${b44City.id} → ${newId}`);
    } else {
      console.log(`  ⚠️ ${b44City.name}: pas trouvé dans PocketBase`);
    }
  }

  // 4. Vider les routes existantes
  const existingRes = await fetch(`${PB_URL}/api/collections/travel_routes/records?perPage=500`, { headers });
  const existing = (await existingRes.json()).items || [];
  for (const r of existing) {
    await fetch(`${PB_URL}/api/collections/travel_routes/records/${r.id}`, { method: 'DELETE', headers });
  }
  console.log(`\n🗑️ ${existing.length} anciennes routes supprimées`);

  // 5. Réimporter les routes avec les nouveaux IDs
  const b44Routes = await base44.entities.TravelRoute.list();
  let ok = 0, err = 0;
  for (const route of b44Routes) {
    const newFromId = oldIdToNewId[route.city_from_id];
    const newToId   = oldIdToNewId[route.city_to_id];
    if (!newFromId || !newToId) {
      console.log(`  ⚠️ Route ignorée: ${route.city_from_id} → ${route.city_to_id} (IDs introuvables)`);
      err++;
      continue;
    }
    const res = await fetch(`${PB_URL}/api/collections/travel_routes/records`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        city_from_id: newFromId,
        city_to_id:   newToId,
        travel_time_minutes: route.travel_time_minutes,
        danger_level: route.danger_level,
        road_type:    route.road_type || 'royale',
        is_active:    true,
      }),
    });
    if (res.ok) ok++; else { err++; console.log('❌', await res.text()); }
  }

  console.log(`\n✅ ${ok} routes importées · ❌ ${err} erreurs`);
  console.log('\n🎉 Terminé !');
}

main().catch(console.error);
