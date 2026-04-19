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
  if (!d.token) throw new Error('Auth PB échouée: ' + JSON.stringify(d));
  return d.token;
}

async function clearCollection(token, col) {
  const headers = { 'Content-Type': 'application/json', 'Authorization': token };
  const res = await fetch(`${PB_URL}/api/collections/${col}/records?perPage=500`, { headers });
  if (!res.ok) return;
  const { items } = await res.json();
  for (const item of (items || [])) {
    await fetch(`${PB_URL}/api/collections/${col}/records/${item.id}`, { method: 'DELETE', headers });
  }
}

async function insertPB(token, col, record) {
  // Stocker toutes les données dans le champ 'data' (JSON)
  const clean = { ...record };
  delete clean.id;
  delete clean._id;
  delete clean.created_date;
  delete clean.updated_date;
  delete clean.__v;

  const res = await fetch(`${PB_URL}/api/collections/${col}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': token },
    body: JSON.stringify(clean),
  });
  return res.ok;
}

const ENTITIES = [
  { name: 'City',            col: 'cities' },
  { name: 'PlayerProfile',   col: 'player_profiles' },
  { name: 'TravelRoute',     col: 'travel_routes' },
  { name: 'EconomySettings', col: 'economy_settings' },
  { name: 'CityArmy',        col: 'city_armies' },
  { name: 'TavernMessage',   col: 'tavern_messages' },
  { name: 'MarketListing',   col: 'market_listings' },
  { name: 'GoldTransaction', col: 'gold_transactions' },
  { name: 'PlayerObjective', col: 'player_objectives' },
  { name: 'Bounty',          col: 'bounties' },
  { name: 'DailyReset',      col: 'daily_resets' },
  { name: 'Music',           col: 'music' },
  { name: 'SystemMessage',   col: 'system_messages' },
];

async function migrate() {
  console.log('\n🏰 Migration base44 → PocketBase\n');
  if (!PB_EMAIL || !PB_PASS) { console.error('Usage: $env:PB_EMAIL="x"; $env:PB_PASS="y"; node migrate_data.js'); process.exit(1); }

  console.log('🔑 Auth PocketBase...');
  const token = await authPB();
  console.log('✅ Auth OK\n');

  let totalOk = 0, totalErr = 0;

  for (const { name, col } of ENTITIES) {
    process.stdout.write(`📦 ${name} → ${col} ... `);
    try {
      const records = await base44.entities[name].list();
      if (!records || records.length === 0) { console.log('0 enregistrements'); continue; }
      // Vider d'abord la collection
      await clearCollection(token, col);
      let ok = 0, err = 0;
      for (const record of records) {
        const success = await insertPB(token, col, record);
        if (success) ok++; else err++;
      }
      console.log(`${records.length} trouvés → ✅ ${ok} importés · ❌ ${err} erreurs`);
      totalOk += ok; totalErr += err;
    } catch (e) {
      console.log(`❌ Erreur: ${e.message}`);
      totalErr++;
    }
  }

  console.log('\n─────────────────────────────');
  console.log(`✅ Total importés : ${totalOk}`);
  console.log(`❌ Total erreurs  : ${totalErr}`);
  console.log('\n🎉 Migration terminée !');
}

migrate().catch(console.error);
