const PB_URL = 'https://guildescouronnes.fr';
const PB_EMAIL = process.env.PB_EMAIL || '';
const PB_PASS = process.env.PB_PASS || '';

async function main() {
  // Auth superuser
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
  });
  const { token } = await res.json();
  const headers = { 'Content-Type': 'application/json', Authorization: token };

  // Récupérer tous les profils
  const profilesRes = await fetch(`${PB_URL}/api/collections/player_profiles/records?perPage=500`, { headers });
  const profiles = (await profilesRes.json()).items || [];

  // Récupérer tous les users existants
  const usersRes = await fetch(`${PB_URL}/api/collections/users/records?perPage=500`, { headers });
  const users = (await usersRes.json()).items || [];
  const userEmails = new Set(users.map(u => u.email));

  // Trouver les emails manquants
  const allEmails = [...new Set(profiles.map(p => p.user_email).filter(Boolean))];
  const missing = allEmails.filter(e => !userEmails.has(e));

  console.log(`\n📧 ${allEmails.length} emails dans player_profiles`);
  console.log(`👤 ${users.length} comptes users existants`);
  console.log(`❌ ${missing.length} comptes manquants :\n`);
  missing.forEach(e => console.log(' -', e));

  if (missing.length === 0) { console.log('\n✅ Tous les joueurs ont un compte !'); return; }

  // Créer les comptes manquants avec un mot de passe temporaire
  console.log('\n🔧 Création des comptes...\n');
  let ok = 0, err = 0;
  for (const email of missing) {
    const tempPassword = Math.random().toString(36).slice(2, 10) + 'Aa1!';
    const r = await fetch(`${PB_URL}/api/collections/users/records`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        password: tempPassword,
        passwordConfirm: tempPassword,
        emailVisibility: false,
        verified: false,
      }),
    });
    if (r.ok) {
      console.log(`✅ ${email} — compte créé`);
      ok++;
    } else {
      const err_data = await r.json();
      console.log(`❌ ${email} — ${JSON.stringify(err_data)}`);
      err++;
    }
  }

  console.log(`\n✅ ${ok} comptes créés · ❌ ${err} erreurs`);
  console.log('\n⚠️  Les joueurs devront utiliser "Mot de passe oublié" pour se connecter.');
}

main().catch(console.error);
