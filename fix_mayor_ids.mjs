/**
 * fix_mayor_ids.mjs
 * Vérifie que tous les mayor_id des villes correspondent
 * bien à un vrai ID PocketBase de player_profiles.
 * Corrige automatiquement si une correspondance est trouvée via mayor_name.
 *
 * Usage : node fix_mayor_ids.mjs
 */

const PB_URL  = "https://guildescouronnes.fr";
const PB_EMAIL = "lucas.brunet51@gmail.com";
const PB_PASS  = "H4457w9Q7dNzjnF";

const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";

let token = null;

async function login() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
  });
  if (!res.ok) throw new Error(`Login échoué : ${res.status}`);
  token = (await res.json()).token;
  console.log(`${GREEN}✓ Authentifié${RESET}`);
}

async function getAll(collection) {
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records?perPage=500`, {
    headers: { Authorization: token },
  });
  if (!res.ok) throw new Error(`Erreur lecture ${collection} : ${res.status}`);
  return (await res.json()).items || [];
}

async function patch(collection, id, data) {
  const res = await fetch(`${PB_URL}/api/collections/${collection}/records/${id}`, {
    method: "PATCH",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Erreur patch ${collection}/${id} : ${res.status} ${await res.text()}`);
  return res.json();
}

async function run() {
  console.log(`\n${BOLD}=== Correction des mayor_id ===${RESET}\n`);
  await login();

  const [cities, profiles] = await Promise.all([
    getAll("cities"),
    getAll("player_profiles"),
  ]);

  console.log(`${profiles.length} profils, ${cities.length} villes chargés.\n`);

  // Index des profils par ID et par character_name
  const profileById   = Object.fromEntries(profiles.map(p => [p.id, p]));
  const profileByName = Object.fromEntries(profiles.map(p => [p.character_name?.toLowerCase(), p]));
  const profileByEmail = Object.fromEntries(profiles.map(p => [p.user_email?.toLowerCase(), p]));

  console.log(`${BOLD}--- Vérification des villes ---${RESET}`);
  let fixed = 0;
  let errors = 0;

  for (const city of cities) {
    if (!city.mayor_id) continue;

    const mayorId   = city.mayor_id;
    const mayorName = city.mayor_name;

    process.stdout.write(`  ${city.name.padEnd(20)} mayor_id: ${mayorId.padEnd(26)} `);

    // Le mayor_id correspond déjà à un vrai profil ?
    if (profileById[mayorId]) {
      console.log(`${GREEN}✓ OK (${profileById[mayorId].character_name})${RESET}`);
      continue;
    }

    // Non — on essaie de retrouver le bon profil via mayor_name
    const match = mayorName ? profileByName[mayorName.toLowerCase()] : null;
    const matchByEmail = mayorId.includes("@") ? profileByEmail[mayorId.toLowerCase()] : null;
    const correctProfile = match || matchByEmail;

    if (correctProfile) {
      console.log(`${YELLOW}⚠ ID obsolète → correction vers ${correctProfile.id} (${correctProfile.character_name})${RESET}`);
      try {
        await patch("cities", city.id, { mayor_id: correctProfile.id });
        console.log(`    ${GREEN}✓ Corrigé${RESET}`);
        fixed++;
      } catch(e) {
        console.log(`    ${RED}✗ Erreur : ${e.message}${RESET}`);
        errors++;
      }
    } else {
      console.log(`${RED}✗ Impossible de retrouver le profil pour "${mayorName}" — à corriger manuellement${RESET}`);
      errors++;
    }
  }

  // Vérifier aussi les home_city_id et city_id des profils
  console.log(`\n${BOLD}--- Vérification des city_id dans les profils ---${RESET}`);
  const cityById = Object.fromEntries(cities.map(c => [c.id, c]));
  let cityFixed = 0;

  for (const p of profiles) {
    const issues = [];
    if (p.city_id && !cityById[p.city_id]) issues.push(`city_id invalide (${p.city_id})`);
    if (p.home_city_id && !cityById[p.home_city_id]) issues.push(`home_city_id invalide (${p.home_city_id})`);
    if (issues.length > 0) {
      console.log(`  ${YELLOW}⚠ ${p.character_name} (${p.user_email}) : ${issues.join(", ")}${RESET}`);
    }
  }

  console.log(`\n${BOLD}--- Résumé ---${RESET}`);
  console.log(`${GREEN}✓ ${fixed} mayor_id corrigé(s)${RESET}`);
  if (errors > 0) console.log(`${RED}✗ ${errors} erreur(s) à corriger manuellement${RESET}`);
  if (fixed === 0 && errors === 0) console.log(`${GREEN}Tout était déjà correct !${RESET}`);
  console.log();
}

run().catch(e => {
  console.error(`${RED}Erreur fatale : ${e.message}${RESET}`);
  process.exit(1);
});
