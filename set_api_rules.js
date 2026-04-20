/**
 * Configure les API rules de toutes les collections
 * Usage :
 *   $env:PB_EMAIL="lucas.brunet51@gmail.com"
 *   $env:PB_PASS="H4457w9Q7dNzjnF"
 *   node set_api_rules.js
 */

const PB_URL   = 'http://178.104.201.139';
const PB_EMAIL = process.env.PB_EMAIL || '';
const PB_PASS  = process.env.PB_PASS  || '';

const COLLECTIONS = [
  'player_profiles',
  'cities',
  'player_objectives',
  'tavern_messages',
  'gold_transactions',
  'market_listings',
  'city_armies',
  'economy_settings',
  'travel_routes',
  'system_messages',
  'daily_resets',
  'tax_history',
  'music',
  'military_campaigns',
  'building_type_defs',
  'resource_stocks',
  'profession_defs',
  'crafting_recipes',
  'biomes',
  'economy_snapshots',
  'bounties',
  'trade_history',
  'territories',
  'item_defs',
  'bank_deposits',
];

// Règle : utilisateur connecté uniquement
const AUTH_RULE = '@request.auth.id != ""';

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

async function setRules(token, col) {
  const res = await fetch(`${PB_URL}/api/collections/${col}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({
      listRule:   AUTH_RULE,
      viewRule:   AUTH_RULE,
      createRule: AUTH_RULE,
      updateRule: AUTH_RULE,
      deleteRule: AUTH_RULE,
    }),
  });
  return res.ok;
}

async function main() {
  console.log('\n🔐 Configuration des API rules\n');
  if (!PB_EMAIL || !PB_PASS) {
    console.error('Usage:\n  $env:PB_EMAIL="lucas.brunet51@gmail.com"\n  $env:PB_PASS="H4457w9Q7dNzjnF"\n  node set_api_rules.js');
    process.exit(1);
  }

  console.log('🔑 Auth PocketBase...');
  const token = await authPB();
  console.log('✅ Auth OK\n');

  let ok = 0, skip = 0, err = 0;

  for (const col of COLLECTIONS) {
    process.stdout.write(`  ${col} ... `);
    const success = await setRules(token, col);
    if (success) {
      console.log('✅');
      ok++;
    } else {
      console.log('⚠️  (collection absente, ignorée)');
      skip++;
    }
  }

  console.log('\n─────────────────────────────');
  console.log(`✅ Configurées : ${ok}`);
  console.log(`⚠️  Ignorées   : ${skip}`);
  console.log('\n🎉 Terminé !');
}

main().catch(console.error);
