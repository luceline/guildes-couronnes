/**
 * fix_inventory_names.mjs
 * Corrige les anciens noms d'items dans les inventaires des joueurs
 * (migration Base44 → PocketBase)
 *
 * Usage : node fix_inventory_names.mjs
 */

const PB_URL   = "https://guildescouronnes.fr";
const PB_EMAIL = "lucas.brunet51@gmail.com";
const PB_PASS  = "H4457w9Q7dNzjnF";

const GREEN = "\x1b[32m"; const RED = "\x1b[31m"; const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";  const BOLD = "\x1b[1m";

// Mapping anciens noms → nouveaux (item_key correct + item_name correct)
const ITEM_NAME_MAP = {
  // Anciens noms possibles de Base44
  "mouton":        { key: "laine_brute",  name: "Laine brute" },
  "Mouton":        { key: "laine_brute",  name: "Laine brute" },
  "laine":         { key: "laine_brute",  name: "Laine brute" },
  "Laine":         { key: "laine_brute",  name: "Laine brute" },
  "bois":          { key: "bois_brut",    name: "Bois brut" },
  "Bois":          { key: "bois_brut",    name: "Bois brut" },
  "minerai":       { key: "minerai_fer",  name: "Minerai de fer" },
  "Minerai":       { key: "minerai_fer",  name: "Minerai de fer" },
  "blé":           { key: "ble",          name: "Blé" },
  "Blé":           { key: "ble",          name: "Blé" },
  "herbe":         { key: "herbes",       name: "Herbes" },
  "Herbe":         { key: "herbes",       name: "Herbes" },
  "quartz":        { key: "quartz_brut",  name: "Quartz brut" },
  "Quartz":        { key: "quartz_brut",  name: "Quartz brut" },
  "pierre brute":  { key: "pierre_brute", name: "Pierre brute" },
  "Pierre brute":  { key: "pierre_brute", name: "Pierre brute" },
  "épée courte":   { key: "epee_courte",  name: "Épée courte" },
  "Épée courte":   { key: "epee_courte",  name: "Épée courte" },
  "épée longue":   { key: "epee_longue",  name: "Épée longue" },
  "Épée longue":   { key: "epee_longue",  name: "Épée longue" },
};

// Mapping item_key corrects (pour normaliser les item_name si item_key est bon)
const KEY_TO_NAME = {
  bois_brut:    "Bois brut",
  minerai_fer:  "Minerai de fer",
  ble:          "Blé",
  laine_brute:  "Laine brute",
  herbes:       "Herbes",
  quartz_brut:  "Quartz brut",
  pierre:       "Pierre",
  pierre_brute: "Pierre brute",
  planches:     "Planches",
  charbon:      "Charbon",
  fil:          "Fil",
  farine:       "Farine",
  extrait:      "Extrait",
  quartz_poli:  "Quartz poli",
  encre:        "Encre",
  lingots_fer:  "Lingots de fer",
  lingot_or:    "Lingot d'or",
  lingot_raffine: "Lingot raffiné",
  lingot_royal: "Lingot royal",
  pain:         "Pain",
  tissu:        "Tissu",
  parchemin:    "Parchemin",
  epee_courte:  "Épée courte",
  epee_longue:  "Épée longue",
  armure:       "Armure",
  besace:       "Besace",
  outils:       "Outils",
  potion_soin:  "Potion de soin",
  potion_endur: "Potion d'endurance",
  meuble:       "Meuble",
  ragout:       "Ragoût",
  bourse_protection: "Bourse de protection",
};

let token = null;

async function login() {
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
  });
  token = (await res.json()).token;
  console.log(`${GREEN}✓ Authentifié${RESET}`);
}

async function getAll(col) {
  const res = await fetch(`${PB_URL}/api/collections/${col}/records?perPage=500`, {
    headers: { Authorization: token },
  });
  return (await res.json()).items || [];
}

async function patch(col, id, data) {
  const res = await fetch(`${PB_URL}/api/collections/${col}/records/${id}`, {
    method: "PATCH",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

async function run() {
  console.log(`\n${BOLD}=== Correction des inventaires ===${RESET}\n`);
  await login();

  const profiles = await getAll("player_profiles");
  console.log(`${profiles.length} profils chargés.\n`);

  let totalFixed = 0;

  for (const p of profiles) {
    const inv = p.inventory || [];
    if (inv.length === 0) continue;

    let changed = false;
    const newInv = inv.map(item => {
      let { item_key, item_name, ...rest } = item;

      // 1. Corriger via item_name inconnu
      const nameMatch = ITEM_NAME_MAP[item_name] || ITEM_NAME_MAP[item_key];
      if (nameMatch && item_key !== nameMatch.key) {
        console.log(`  ${YELLOW}${p.character_name} : "${item_key}" (${item_name}) → "${nameMatch.key}" (${nameMatch.name})${RESET}`);
        item_key = nameMatch.key;
        item_name = nameMatch.name;
        changed = true;
      }

      // 2. Normaliser item_name si item_key est correct mais item_name est différent
      const correctName = KEY_TO_NAME[item_key];
      if (correctName && item_name !== correctName) {
        console.log(`  ${YELLOW}${p.character_name} : nom normalisé "${item_name}" → "${correctName}" (${item_key})${RESET}`);
        item_name = correctName;
        changed = true;
      }

      return { item_key, item_name, ...rest };
    });

    if (changed) {
      try {
        await patch("player_profiles", p.id, { inventory: newInv });
        console.log(`  ${GREEN}✓ ${p.character_name} corrigé${RESET}`);
        totalFixed++;
      } catch(e) {
        console.log(`  ${RED}✗ Erreur ${p.character_name} : ${e.message}${RESET}`);
      }
    }
  }

  console.log(`\n${BOLD}--- Résumé ---${RESET}`);
  if (totalFixed === 0) {
    console.log(`${GREEN}Aucun inventaire à corriger — tout est propre !${RESET}`);
  } else {
    console.log(`${GREEN}✓ ${totalFixed} inventaire(s) corrigé(s)${RESET}`);
  }
}

run().catch(console.error);
