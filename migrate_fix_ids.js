/**
 * Corrige les city_id dans toutes les collections
 * Usage : $env:PB_EMAIL="x"; $env:PB_PASS="y"; node migrate_fix_ids.js
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
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
  });
  const d = await res.json();
  if (!d.token) throw new Error('Auth PB échouée');
  return d.token;
}

async function getAll(token, col) {
  const res = await fetch(`${PB_URL}/api/collections/${col}/records?perPage=500`, {
    headers: { Authorization: token }
  });
  return (await res.json()).items || [];
}

async function update(token, col, id, data) {
  const res = await fetch(`${PB_URL}/api/collections/${col}/records/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(data),
  });
  return res.ok;
}

async function main() {
  console.log('\n🔧 Correction des IDs de villes\n');

  const token = await authPB();

  // Mapping ancien ID base44 → nouveau ID PocketBase (par nom)
  const pbCities = await getAll(token, 'cities');
  const b44Cities = await base44.entities.City.list();

  const nameToNewId = {};
  for (const c of pbCities) nameToNewId[c.name] = c.id;

  const oldToNew = {};
  for (const c of b44Cities) {
    if (nameToNewId[c.name]) oldToNew[c.id] = nameToNewId[c.name];
  }

  console.log(`📍 Mapping: ${Object.keys(oldToNew).length} villes`);
  for (const [old, nw] of Object.entries(oldToNew)) {
    console.log(`  ${old} → ${nw}`);
  }

  // Collections et champs à corriger
  const toFix = [
    { col: 'player_profiles',  fields: ['city_id', 'home_city_id'] },
    { col: 'market_listings',  fields: ['city_id'] },
    { col: 'tavern_messages',  fields: ['city_id'] },
    { col: 'gold_transactions',fields: ['city_id'] },
    { col: 'player_objectives',fields: ['city_id', 'target_city_id'] },
    { col: 'bounties',         fields: ['city_id'] },
    { col: 'bank_deposits',    fields: ['city_id'] },
    { col: 'tax_history',      fields: ['city_id'] },
  ];

  for (const { col, fields } of toFix) {
    const records = await getAll(token, col);
    let fixed = 0;
    for (const record of records) {
      const updates = {};
      for (const field of fields) {
        const oldId = record[field];
        if (oldId && oldToNew[oldId]) {
          updates[field] = oldToNew[oldId];
        }
      }
      if (Object.keys(updates).length > 0) {
        const ok = await update(token, col, record.id, updates);
        if (ok) fixed++;
      }
    }
    console.log(`✅ ${col}: ${fixed}/${records.length} corrigés`);
  }

  console.log('\n🎉 Terminé !');
}

main().catch(console.error);
