import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import * as XLSX from 'npm:xlsx@0.18.5';

// ── Données copiées depuis craftingData.js / gameData.js ──

const PROFESSION_PRODUCTION = {
  Bûcheron:   [{ id: "farm_bois",      outputKey: "bois_brut",   quantity: 5, cooldown: 90  }],
  Mineur:     [{ id: "farm_minerai",   outputKey: "minerai_fer", quantity: 4, cooldown: 120 },
               { id: "farm_quartz",    outputKey: "quartz_brut", quantity: 3, cooldown: 120 }],
  Fermier:    [{ id: "farm_ble",       outputKey: "ble",         quantity: 7, cooldown: 60  },
               { id: "farm_laine",     outputKey: "laine_brute", quantity: 5, cooldown: 120 },
               { id: "farm_herbes",    outputKey: "herbes",      quantity: 6, cooldown: 90  }],
  Tisserand:  [{ id: "farm_laine_t",   outputKey: "laine_brute", quantity: 5, cooldown: 100 }],
  Forgeron:   [{ id: "farm_minerai_f", outputKey: "minerai_fer", quantity: 3, cooldown: 120 }],
  Alchimiste: [{ id: "farm_herbes_a",  outputKey: "herbes",      quantity: 6, cooldown: 80  }],
  Orfèvre:    [{ id: "farm_quartz_o",  outputKey: "quartz_brut", quantity: 3, cooldown: 120 }],
  Marchand:   [{ id: "farm_herbes_m",  outputKey: "herbes",      quantity: 3, cooldown: 120 },
               { id: "farm_bois_m",    outputKey: "bois_brut",   quantity: 3, cooldown: 120 }],
};

const ITEMS = {
  bois_brut:    { name: "Bois brut",       tier: 1, use: "Matériau de construction de base." },
  minerai_fer:  { name: "Minerai de fer",  tier: 1, use: "Minerai extrait de la roche." },
  ble:          { name: "Blé",             tier: 1, use: "+1 faim si consommé." },
  laine_brute:  { name: "Laine brute",     tier: 1, use: "Laine tondue, à filer." },
  herbes:       { name: "Herbes",          tier: 1, use: "Herbes médicinales de base." },
  quartz_brut:  { name: "Quartz brut",     tier: 1, use: "Pierre précieuse brute." },
  pierre:       { name: "Pierre",          tier: 1, use: "Consommé : +1 score attaque vol pendant 1h." },
  planches:     { name: "Planches",        tier: 2, use: "Bois transformé. Matériau de construction." },
  pierre_brute: { name: "Pierre brute",    tier: 2, use: "Passif inventaire : +5 énergie max (non cumulable, meilleur bonus)." },
  fil:          { name: "Fil",             tier: 2, use: "Fil filé, base du tissu." },
  charbon:      { name: "Charbon",         tier: 2, use: "Combustible pour la forge." },
  extrait:      { name: "Extrait",         tier: 2, use: "+3 énergie si consommé." },
  quartz_poli:  { name: "Quartz poli",     tier: 2, use: "Matériau précieux." },
  encre:        { name: "Encre",           tier: 2, use: "Base des parchemins." },
  autorisation_marche: { name: "Autorisation de marché", tier: 2, use: "Objectif : produire 10 T1. Récompense 40💰." },
  meuble:       { name: "Meuble",          tier: 3, use: "Réduit l'entretien logement de 30% (passif)." },
  lingots_fer:  { name: "Lingots de fer",  tier: 3, use: "Matériau pour outils et armes." },
  farine:       { name: "Farine",          tier: 3, use: "+3 faim si consommée." },
  tissu:        { name: "Tissu",           tier: 3, use: "Matériau pour vêtements." },
  epee_courte:  { name: "Épée courte",     tier: 3, use: "+1 score attaque. Durabilité 4." },
  potion_soin:  { name: "Potion de soin",  tier: 3, use: "+8 énergie instantané." },
  lingots_or:   { name: "Lingot d'or",     tier: 3, use: "Vendable : 25💰 + 15💰 partagés résidents." },
  parchemin:    { name: "Parchemin",       tier: 3, use: "Base des contrats." },
  pain:         { name: "Pain",            tier: 3, use: "+4 faim si consommé." },
  contrat_artisan: { name: "Contrat artisan", tier: 3, use: "Objectif : 5 T2 ou vendre 8. Récompense 110💰." },
  armure:       { name: "Armure",          tier: 4, use: "+2 défense vols. Durabilité 6." },
  outils:       { name: "Outils",          tier: 4, use: "+3 actions bonus. Durabilité 5." },
  ragout:       { name: "Ragoût",          tier: 4, use: "+7 faim si consommé." },
  besace:       { name: "Besace",          tier: 4, use: "+60 capacité inventaire + +1 défense. 7 jours." },
  epee_longue:  { name: "Épée longue",     tier: 4, use: "+2 score attaque. Durabilité 6." },
  potion_endur: { name: "Potion d'endurance", tier: 4, use: "+20 énergie instantané." },
  lingot_raffine: { name: "Lingot raffiné", tier: 4, use: "Vendable : 55💰 + 35💰 résidents. [Fonderie]" },
  huile_inflammable:  { name: "Huile inflammable",  tier: 5, use: "JCJ: Désactive 1 bâtiment ennemi 1 jour." },
  poudre_corrosive:   { name: "Poudre corrosive",   tier: 5, use: "JCJ: Détruit 15 unités ressource entrepôt ennemi." },
  festin_empoisonne:  { name: "Festin empoisonné",  tier: 5, use: "JCJ: Réduit faim max résidents ennemis -3 pendant 2j." },
  faux_contrat:       { name: "Faux contrat",        tier: 5, use: "JCJ: Routes inconnues pour les voyageurs de la ville ennemie pendant 2j." },
  cle_forgee:         { name: "Clé forgée",          tier: 5, use: "JCJ: Vole 10-15% trésorerie ennemie." },
  elixir_discorde:    { name: "Élixir de discorde",  tier: 5, use: "JCJ: Réduit taxes ennemies -10% 1j." },
  lingot_royal:       { name: "Lingot royal",        tier: 5, use: "Vendable : 120💰 + 80💰 résidents. [Fonderie]" },
  lettre_desinformation: { name: "Lettre de désinformation", tier: 5, use: "JCJ: −10% taxes + rumeur taverne 1j." },
  contrat_noble: { name: "Contrat noble",  tier: 5, use: "Objectif majeur. Récompense 550💰." },
};

const CRAFTING_RECIPES = [
  // Bûcheron
  { profession: "Bûcheron",  name: "Planches",        tier: 2, inputs: [{ key: "bois_brut", qty: 4 }, { key: "pierre_brute", qty: 2 }], output: { key: "planches", qty: 3 }, gold: 0 },
  { profession: "Bûcheron",  name: "Meuble",          tier: 3, inputs: [{ key: "planches", qty: 3 }, { key: "fil", qty: 2 }], output: { key: "meuble", qty: 1 }, gold: 0 },
  { profession: "Bûcheron",  name: "Armure",          tier: 4, inputs: [{ key: "meuble", qty: 2 }, { key: "lingots_fer", qty: 2 }], output: { key: "armure", qty: 1 }, gold: 5 },
  { profession: "Bûcheron",  name: "Huile inflammable", tier: 5, inputs: [{ key: "armure", qty: 1 }, { key: "planches", qty: 2 }, { key: "potion_soin", qty: 1 }], output: { key: "huile_inflammable", qty: 1 }, gold: 10 },
  // Mineur
  { profession: "Mineur",    name: "Pierre brute",    tier: 2, inputs: [{ key: "minerai_fer", qty: 3 }, { key: "bois_brut", qty: 2 }], output: { key: "pierre_brute", qty: 3 }, gold: 0 },
  { profession: "Mineur",    name: "Lingots de fer",  tier: 3, inputs: [{ key: "minerai_fer", qty: 3 }, { key: "pierre_brute", qty: 2 }, { key: "charbon", qty: 1 }], output: { key: "lingots_fer", qty: 2 }, gold: 3 },
  { profession: "Mineur",    name: "Outils",          tier: 4, inputs: [{ key: "lingots_fer", qty: 2 }, { key: "planches", qty: 2 }], output: { key: "outils", qty: 2 }, gold: 0 },
  { profession: "Mineur",    name: "Poudre corrosive", tier: 5, inputs: [{ key: "outils", qty: 1 }, { key: "epee_courte", qty: 1 }, { key: "minerai_fer", qty: 4 }], output: { key: "poudre_corrosive", qty: 1 }, gold: 10 },
  // Fermier
  { profession: "Fermier",   name: "Farine",          tier: 3, inputs: [{ key: "ble", qty: 4 }, { key: "pierre_brute", qty: 2 }], output: { key: "farine", qty: 3 }, gold: 2 },
  { profession: "Fermier",   name: "Pain",            tier: 3, inputs: [{ key: "farine", qty: 2 }, { key: "extrait", qty: 1 }], output: { key: "pain", qty: 3 }, gold: 0 },
  { profession: "Fermier",   name: "Ragoût",          tier: 4, inputs: [{ key: "farine", qty: 2 }, { key: "extrait", qty: 2 }, { key: "ble", qty: 2 }], output: { key: "ragout", qty: 2 }, gold: 2 },
  { profession: "Fermier",   name: "Festin empoisonné", tier: 5, inputs: [{ key: "armure", qty: 1 }, { key: "outils", qty: 1 }, { key: "besace", qty: 1 }, { key: "potion_endur", qty: 1 }, { key: "contrat_artisan", qty: 1 }], output: { key: "festin_empoisonne", qty: 1 }, gold: 0 },
  // Tisserand
  { profession: "Tisserand", name: "Fil",             tier: 2, inputs: [{ key: "laine_brute", qty: 4 }, { key: "extrait", qty: 1 }], output: { key: "fil", qty: 4 }, gold: 0 },
  { profession: "Tisserand", name: "Tissu",           tier: 3, inputs: [{ key: "fil", qty: 3 }, { key: "encre", qty: 1 }], output: { key: "tissu", qty: 2 }, gold: 0 },
  { profession: "Tisserand", name: "Besace",          tier: 4, inputs: [{ key: "tissu", qty: 2 }, { key: "meuble", qty: 1 }], output: { key: "besace", qty: 1 }, gold: 0 },
  // Forgeron
  { profession: "Forgeron",  name: "Pierre",          tier: 1, inputs: [{ key: "minerai_fer", qty: 2 }, { key: "bois_brut", qty: 1 }], output: { key: "pierre", qty: 3 }, gold: 0 },
  { profession: "Forgeron",  name: "Charbon",         tier: 2, inputs: [{ key: "pierre", qty: 1 }, { key: "bois_brut", qty: 1 }, { key: "laine_brute", qty: 1 }], output: { key: "charbon", qty: 2 }, gold: 0 },
  { profession: "Forgeron",  name: "Épée courte",     tier: 3, inputs: [{ key: "lingots_fer", qty: 2 }, { key: "charbon", qty: 2 }, { key: "pierre_brute", qty: 1 }], output: { key: "epee_courte", qty: 1 }, gold: 5 },
  { profession: "Forgeron",  name: "Épée longue",     tier: 4, inputs: [{ key: "epee_courte", qty: 2 }, { key: "outils", qty: 1 }], output: { key: "epee_longue", qty: 1 }, gold: 8 },
  { profession: "Forgeron",  name: "Clé forgée",      tier: 5, inputs: [{ key: "epee_longue", qty: 1 }, { key: "lingots_or", qty: 1 }, { key: "charbon", qty: 3 }], output: { key: "cle_forgee", qty: 1 }, gold: 20 },
  // Alchimiste
  { profession: "Alchimiste", name: "Extrait",        tier: 2, inputs: [{ key: "herbes", qty: 4 }, { key: "ble", qty: 2 }], output: { key: "extrait", qty: 3 }, gold: 0 },
  { profession: "Alchimiste", name: "Potion de soin", tier: 3, inputs: [{ key: "extrait", qty: 2 }, { key: "fil", qty: 1 }, { key: "herbes", qty: 2 }], output: { key: "potion_soin", qty: 2 }, gold: 0 },
  { profession: "Alchimiste", name: "Potion d'endurance", tier: 4, inputs: [{ key: "potion_soin", qty: 2 }, { key: "ragout", qty: 1 }], output: { key: "potion_endur", qty: 1 }, gold: 5 },
  { profession: "Alchimiste", name: "Élixir de discorde", tier: 5, inputs: [{ key: "potion_endur", qty: 1 }, { key: "epee_courte", qty: 1 }, { key: "herbes", qty: 5 }], output: { key: "elixir_discorde", qty: 1 }, gold: 20 },
  // Orfèvre
  { profession: "Orfèvre",   name: "Quartz poli",    tier: 2, inputs: [{ key: "quartz_brut", qty: 4 }, { key: "charbon", qty: 2 }], output: { key: "quartz_poli", qty: 2 }, gold: 0 },
  { profession: "Orfèvre",   name: "Lingot d'or",    tier: 3, inputs: [{ key: "quartz_poli", qty: 2 }, { key: "minerai_fer", qty: 2 }], output: { key: "lingots_or", qty: 1 }, gold: 5 },
  { profession: "Orfèvre",   name: "Lingot raffiné", tier: 4, inputs: [{ key: "lingots_or", qty: 2 }, { key: "extrait", qty: 2 }], output: { key: "lingot_raffine", qty: 1 }, gold: 10, requires: "Fonderie" },
  { profession: "Orfèvre",   name: "Lingot royal",   tier: 5, inputs: [{ key: "lingot_raffine", qty: 2 }, { key: "planches", qty: 3 }], output: { key: "lingot_royal", qty: 1 }, gold: 20, requires: "Fonderie" },
  // Marchand
  { profession: "Marchand",  name: "Encre",          tier: 2, inputs: [{ key: "herbes", qty: 3 }, { key: "charbon", qty: 2 }], output: { key: "encre", qty: 3 }, gold: 0 },
  { profession: "Marchand",  name: "Autorisation de marché", tier: 2, inputs: [{ key: "ble", qty: 3 }, { key: "bois_brut", qty: 3 }, { key: "herbes", qty: 3 }], output: { key: "autorisation_marche", qty: 2 }, gold: 10 },
  { profession: "Marchand",  name: "Parchemin",      tier: 3, inputs: [{ key: "encre", qty: 2 }, { key: "planches", qty: 2 }], output: { key: "parchemin", qty: 2 }, gold: 0 },
  { profession: "Marchand",  name: "Contrat artisan", tier: 3, inputs: [{ key: "planches", qty: 2 }, { key: "farine", qty: 2 }, { key: "fil", qty: 2 }], output: { key: "contrat_artisan", qty: 1 }, gold: 30 },
  { profession: "Marchand",  name: "Contrat noble",  tier: 5, inputs: [{ key: "besace", qty: 1 }, { key: "epee_longue", qty: 1 }, { key: "potion_endur", qty: 1 }, { key: "lingots_or", qty: 1 }], output: { key: "contrat_noble", qty: 1 }, gold: 200 },
  { profession: "Marchand",  name: "Lettre de désinformation", tier: 5, inputs: [{ key: "contrat_noble", qty: 1 }, { key: "armure", qty: 1 }, { key: "tissu", qty: 3 }], output: { key: "lettre_desinformation", qty: 1 }, gold: 50 },
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // ── Feuille 1 : Ressources T1 par profession ──
  const t1Rows = [["Profession", "Ressource T1", "Quantité par action", "Cooldown (min)", "Effet / Usage"]];
  for (const [prof, actions] of Object.entries(PROFESSION_PRODUCTION)) {
    for (const a of actions) {
      const item = ITEMS[a.outputKey];
      t1Rows.push([prof, item?.name ?? a.outputKey, a.quantity, a.cooldown, item?.use ?? ""]);
    }
  }

  // ── Feuille 2 : Crafts T2→T5 ──
  const craftRows = [["Profession", "Tier", "Craft produit", "Qté produite", "Coût 💰", "Bâtiment requis", "Ingrédient 1", "Qté 1", "Ingrédient 2", "Qté 2", "Ingrédient 3", "Qté 3", "Ingrédient 4", "Qté 4", "Effet / Usage"]];
  for (const r of CRAFTING_RECIPES) {
    const row = [
      r.profession,
      `T${r.tier}`,
      r.name,
      r.output.qty,
      r.gold || 0,
      r.requires || "",
    ];
    for (let i = 0; i < 4; i++) {
      const ing = r.inputs[i];
      row.push(ing ? (ITEMS[ing.key]?.name ?? ing.key) : "");
      row.push(ing ? ing.qty : "");
    }
    row.push(ITEMS[r.output.key]?.use ?? "");
    craftRows.push(row);
  }

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet(t1Rows);
  ws1['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Ressources T1");

  const ws2 = XLSX.utils.aoa_to_sheet(craftRows);
  ws2['!cols'] = [{ wch: 14 }, { wch: 6 }, { wch: 26 }, { wch: 12 }, { wch: 10 }, { wch: 16 },
                  { wch: 20 }, { wch: 6 }, { wch: 20 }, { wch: 6 }, { wch: 20 }, { wch: 6 }, { wch: 20 }, { wch: 6 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Crafts T2 à T5");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="professions_medieval.xlsx"`,
    },
  });
});