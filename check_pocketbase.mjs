/**
 * check_pocketbase.mjs
 * Vérifie que toutes les collections PocketBase sont accessibles
 * et que les API rules sont correctement configurées.
 *
 * Usage :
 *   node check_pocketbase.mjs
 */

const PB_URL = "https://guildescouronnes.fr";
const PB_EMAIL = "lucas.brunet51@gmail.com";
const PB_PASS = "H4457w9Q7dNzjnF";

// Collections à vérifier + opérations attendues
const COLLECTIONS = [
  { name: "player_profiles",   ops: ["list", "create", "update"] },
  { name: "cities",            ops: ["list", "update"] },
  { name: "player_objectives", ops: ["list", "create", "update"] },
  { name: "tavern_messages",   ops: ["list", "create"] },
  { name: "gold_transactions", ops: ["list", "create"] },
  { name: "market_listings",   ops: ["list", "create", "update"] },
  { name: "city_armies",       ops: ["list"] },
  { name: "economy_settings",  ops: ["list"] },
  { name: "travel_routes",     ops: ["list"] },
  { name: "system_messages",   ops: ["list"] },
  { name: "daily_resets",      ops: ["list", "create"] },
  { name: "tax_history",       ops: ["list"] },
  { name: "music",             ops: ["list"] },
  { name: "military_campaigns",ops: ["list"] },
  { name: "economy_snapshots", ops: ["list"] },
  { name: "bounties",          ops: ["list"] },
  { name: "trade_history",     ops: ["list"] },
  { name: "bank_deposits",     ops: ["list"] },
  { name: "warehouselog",      ops: ["list", "create"] },  // nouvelle collection
];

// Champs obligatoires par collection critique
const REQUIRED_FIELDS = {
  player_objectives: ["player_email", "type", "status", "quest_date", "reward_gold", "current_quantity", "target_quantity"],
  gold_transactions: ["player_email", "city_id", "amount", "type", "description"],
  warehouselog:      ["city_id", "city_name", "player_email", "player_name", "action", "item_key", "item_name", "quantity", "source"],
};

const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";

let token = null;
let errors = 0;
let warnings = 0;

async function login() {
  // Essai 1 : endpoint superusers (PocketBase v0.23+)
  let res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
  });
  // Essai 2 : endpoint admins (PocketBase v0.20-)
  if (!res.ok) {
    res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
    });
  }
  // Essai 3 : endpoint users classique
  if (!res.ok) {
    res = await fetch(`${PB_URL}/api/collections/users/auth-with-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
    });
  }
  if (!res.ok) throw new Error(`Login échoué : ${res.status} — ${await res.text()}`);
  const data = await res.json();
  token = data.token;
  console.log(`${GREEN}✓ Authentification OK${RESET}`);
}

async function fetchCollection(col, limit = 1) {
  const url = `${PB_URL}/api/collections/${col}/records?page=1&perPage=${limit}`;
  const headers = token ? { Authorization: token } : {};
  const res = await fetch(url, { headers });
  return { status: res.status, ok: res.ok, data: res.ok ? await res.json() : null };
}

async function checkSchema(col) {
  const url = `${PB_URL}/api/collections/${col}`;
  const headers = { Authorization: token };
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const data = await res.json();
  return data.fields || data.schema || [];
}

async function testCreate(col) {
  // On fait juste un POST vide pour voir si l'API rules bloque ou pas
  // On ne veut pas créer de vrais enregistrements — on envoie des données invalides
  // et on vérifie qu'on obtient 400 (validation) et pas 403 (interdit)
  const url = `${PB_URL}/api/collections/${col}/records`;
  const headers = { Authorization: token, "Content-Type": "application/json" };
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ _test: true }) });
  // 400 = règles OK mais données invalides (ce qu'on veut)
  // 403 = API rules bloquent
  // 200/201 = créé (inattendu mais pas bloquant)
  return res.status;
}

async function run() {
  console.log(`\n${BOLD}=== Vérification PocketBase — ${PB_URL} ===${RESET}\n`);

  // 1. Auth
  try {
    await login();
  } catch(e) {
    console.error(`${RED}✗ Impossible de se connecter : ${e.message}${RESET}`);
    process.exit(1);
  }

  console.log(`\n${BOLD}--- Collections ---${RESET}`);

  for (const { name, ops } of COLLECTIONS) {
    process.stdout.write(`  ${name.padEnd(25)}`);

    // Test LIST
    const { status, ok, data } = await fetchCollection(name);
    if (ok) {
      process.stdout.write(`${GREEN}LIST:OK${RESET} `);
    } else if (status === 403) {
      process.stdout.write(`${RED}LIST:403(bloqué)${RESET} `);
      errors++;
    } else if (status === 404) {
      process.stdout.write(`${RED}LIST:404(inexistante!)${RESET} `);
      errors++;
    } else {
      process.stdout.write(`${YELLOW}LIST:${status}${RESET} `);
      warnings++;
    }

    // Test CREATE si requis
    if (ops.includes("create")) {
      const createStatus = await testCreate(name);
      if (createStatus === 400 || createStatus === 200 || createStatus === 201) {
        process.stdout.write(`${GREEN}CREATE:OK${RESET} `);
      } else if (createStatus === 403) {
        process.stdout.write(`${RED}CREATE:403(bloqué)${RESET} `);
        errors++;
      } else {
        process.stdout.write(`${YELLOW}CREATE:${createStatus}${RESET} `);
        warnings++;
      }
    }

    console.log();
  }

  // 2. Vérification des champs obligatoires
  console.log(`\n${BOLD}--- Champs obligatoires ---${RESET}`);

  for (const [col, requiredFields] of Object.entries(REQUIRED_FIELDS)) {
    console.log(`  ${col} :`);
    const schema = await checkSchema(col);
    if (!schema) {
      console.log(`    ${RED}✗ Impossible de lire le schéma${RESET}`);
      errors++;
      continue;
    }
    const fieldNames = schema.map(f => f.name);
    for (const field of requiredFields) {
      if (fieldNames.includes(field)) {
        console.log(`    ${GREEN}✓ ${field}${RESET}`);
      } else {
        console.log(`    ${RED}✗ ${field} MANQUANT${RESET}`);
        errors++;
      }
    }
  }

  // 3. Résumé
  console.log(`\n${BOLD}--- Résumé ---${RESET}`);
  if (errors === 0 && warnings === 0) {
    console.log(`${GREEN}${BOLD}✓ Tout est OK !${RESET}`);
  } else {
    if (errors > 0)   console.log(`${RED}✗ ${errors} erreur(s) à corriger${RESET}`);
    if (warnings > 0) console.log(`${YELLOW}⚠ ${warnings} avertissement(s)${RESET}`);
  }
  console.log();
}

run().catch(e => {
  console.error(`${RED}Erreur fatale : ${e.message}${RESET}`);
  process.exit(1);
});
