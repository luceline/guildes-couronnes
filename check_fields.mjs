const PB_URL   = "https://guildescouronnes.fr";
const PB_EMAIL = "lucas.brunet51@gmail.com";
const PB_PASS  = "H4457w9Q7dNzjnF";

const GREEN  = "\x1b[32m"; const RED = "\x1b[31m"; const YELLOW = "\x1b[33m";
const RESET  = "\x1b[0m";  const BOLD = "\x1b[1m";

let token = null;

async function login() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
  });
  token = (await res.json()).token;
  console.log(`${GREEN}✓ Authentifié${RESET}`);
}

async function getSchema(col) {
  const res = await fetch(`${PB_URL}/api/collections/${col}`, {
    headers: { Authorization: token },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.fields || data.schema || []).map(f => f.name);
}

async function run() {
  await login();
  console.log(`\n${BOLD}--- Champs PlayerProfile ---${RESET}`);
  const pfFields = await getSchema("player_profiles");
  if (!pfFields) { console.log(`${RED}✗ Collection introuvable${RESET}`); return; }

  const required = [
    "biome_harvest_bonus_expires_at",
    "cooldown_bonus_expires_at", "cooldown_bonus_value",
    "double_prod_bonus", "double_prod_bonus_expires_at",
    "energy_max_bonus_expires_at", "energy_max_bonus_value",
    "attack_bonus_expires_at", "attack_bonus_value",
    "defense_bonus_expires_at", "defense_bonus_value",
    "travel_discount",
    "energy_regen_bonus_expires_at", "energy_regen_value", "energy_regen_interval_min",
    "hunger_regen_bonus_expires_at", "hunger_regen_value", "hunger_regen_interval_min",
    "player_xp_total", "player_level",
    "biome_cooldown_bonus_expires_at", "biome_double_prod_bonus",
  ];

  const missing = [];
  for (const f of required) {
    if (pfFields.includes(f)) {
      console.log(`  ${GREEN}✓ ${f}${RESET}`);
    } else {
      console.log(`  ${RED}✗ ${f} MANQUANT${RESET}`);
      missing.push(f);
    }
  }

  console.log(`\n${BOLD}--- Champ city_roles dans cities ---${RESET}`);
  const cityFields = await getSchema("cities");
  if (cityFields?.includes("city_roles")) {
    console.log(`  ${GREEN}✓ city_roles${RESET}`);
  } else {
    console.log(`  ${RED}✗ city_roles MANQUANT${RESET}`);
    missing.push("cities.city_roles");
  }

  console.log(`\n${BOLD}--- Résumé ---${RESET}`);
  if (missing.length === 0) {
    console.log(`${GREEN}✓ Tout est en ordre !${RESET}`);
  } else {
    console.log(`${RED}✗ ${missing.length} champ(s) manquant(s) :${RESET}`);
    missing.forEach(f => console.log(`  - ${f}`));
    console.log(`\n${YELLOW}Ces champs sont stockés en JSON dans PocketBase (champ JSON {}),`);
    console.log(`donc si la collection utilise un champ JSON unique, ils peuvent être absents du schéma`);
    console.log(`mais quand même fonctionner via le champ data.${RESET}`);
  }
}
run().catch(console.error);
