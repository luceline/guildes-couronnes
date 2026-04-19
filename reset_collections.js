/**
 * Supprime toutes les collections PocketBase sauf 'users'
 * puis relance migrate_schema.js
 * Usage : $env:PB_EMAIL="email"; $env:PB_PASS="mdp"; node reset_collections.js
 */
const PB_URL   = 'http://178.104.201.139';
const PB_EMAIL = process.env.PB_EMAIL || '';
const PB_PASS  = process.env.PB_PASS  || '';

async function main() {
  console.log('\n🗑️  Suppression des collections PocketBase\n');

  // Auth
  const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
  });
  const { token } = await authRes.json();
  if (!token) { console.error('Auth échouée'); process.exit(1); }
  console.log('✅ Auth OK\n');

  const headers = { 'Content-Type': 'application/json', 'Authorization': token };

  // Lister toutes les collections
  const listRes = await fetch(`${PB_URL}/api/collections?perPage=200`, { headers });
  const { items } = await listRes.json();

  // Supprimer tout sauf 'users'
  for (const col of items) {
    if (col.name === 'users') {
      console.log(`⏭️  users — conservé`);
      continue;
    }
    const delRes = await fetch(`${PB_URL}/api/collections/${col.id}`, {
      method: 'DELETE',
      headers,
    });
    if (delRes.ok) {
      console.log(`🗑️  ${col.name} supprimé`);
    } else {
      const err = await delRes.json();
      console.log(`❌ ${col.name} : ${err.message}`);
    }
  }

  console.log('\n✅ Suppression terminée — relance maintenant migrate_schema.js puis migrate_data.js');
}

main().catch(console.error);
