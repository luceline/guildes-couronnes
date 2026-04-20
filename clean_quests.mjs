const PB_URL = 'https://guildescouronnes.fr';

async function main() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: process.env.PB_EMAIL, password: process.env.PB_PASS }),
  });
  const { token } = await res.json();
  const headers = { Authorization: token };

  const today = new Date().toISOString().split('T')[0];
  console.log(`\n🧹 Nettoyage des quêtes — conservation uniquement de aujourd'hui (${today})\n`);

  // Récupérer toutes les quêtes
  const r = await fetch(`${PB_URL}/api/collections/player_objectives/records?perPage=500`, { headers });
  const all = (await r.json()).items || [];
  console.log(`📦 ${all.length} quêtes trouvées`);

  // Garder uniquement celles d'aujourd'hui ou les contrats actifs (parchemin_type)
  const toDelete = all.filter(q => {
    if (q.parchemin_type && q.status === 'active') return false; // garder contrats actifs
    const d = q.quest_date || q.created_date || '';
    return !d.startsWith(today);
  });

  console.log(`🗑️ ${toDelete.length} quêtes à supprimer · ${all.length - toDelete.length} à conserver\n`);

  let ok = 0;
  for (const q of toDelete) {
    const r = await fetch(`${PB_URL}/api/collections/player_objectives/records/${q.id}`, {
      method: 'DELETE', headers
    });
    if (r.ok) ok++;
  }

  console.log(`✅ ${ok} quêtes supprimées`);
  console.log('\n🎉 Terminé !');
}

main().catch(console.error);
