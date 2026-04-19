import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ══════════════════════════════════════════════════════
// seedGameData — Peuple ItemDef, CraftingRecipe, ProfessionDef
// depuis les constantes JS du jeu.
// À appeler UNE FOIS (ou pour reset les données).
// Admin only.
// ══════════════════════════════════════════════════════

const ITEMS_DATA = [
  // T1
  { key:"bois_brut",    name:"Bois brut",       icon:"🪵", category:"bois",       tier:1, use:"Matériau de construction de base.", market_price_suggested:2 },
  { key:"minerai_fer",  name:"Minerai de fer",  icon:"🪨", category:"fer",        tier:1, use:"Minerai extrait de la roche.", market_price_suggested:3 },
  { key:"ble",          name:"Blé",             icon:"🌾", category:"nourriture", tier:1, use:"🌾 +1 faim si consommé.", hunger_restore:1, market_price_suggested:2 },
  { key:"laine_brute",  name:"Laine brute",     icon:"🐑", category:"tissu",      tier:1, use:"Laine tondue, à filer.", market_price_suggested:2 },
  { key:"herbes",       name:"Herbes",          icon:"🌿", category:"potions",    tier:1, use:"Herbes médicinales de base.", market_price_suggested:2 },
  { key:"quartz_brut",  name:"Quartz brut",     icon:"🔮", category:"or",         tier:1, use:"Pierre précieuse brute.", market_price_suggested:4 },
  { key:"pierre",       name:"Pierre",          icon:"🪨", category:"pierre",     tier:1, use:"🗡️ Consommé : +1 score attaque vol pendant 1h.", market_price_suggested:3 },
  // T2
  { key:"planches",     name:"Planches",        icon:"🪵", category:"bois",       tier:2, use:"Bois transformé. Matériau de construction.", market_price_suggested:6 },
  { key:"pierre_brute", name:"Pierre brute",    icon:"🗿", category:"pierre",     tier:2, use:"🗿 Passif inventaire : +5 énergie max (non cumulable, meilleur bonus).", market_price_suggested:6 },
  { key:"fil",          name:"Fil",             icon:"🧵", category:"tissu",      tier:2, use:"Fil filé, base du tissu.", market_price_suggested:6 },
  { key:"charbon",      name:"Charbon",         icon:"⬛", category:"fer",        tier:2, use:"Combustible pour la forge.", market_price_suggested:5 },
  { key:"extrait",      name:"Extrait",         icon:"🫗", category:"potions",    tier:2, use:"⚡ +3 énergie si consommé.", fatigue_restore:3, market_price_suggested:7 },
  { key:"quartz_poli",  name:"Quartz poli",     icon:"💠", category:"or",         tier:2, use:"Quartz taillé et poli.", market_price_suggested:10 },
  { key:"encre",        name:"Encre",           icon:"🖋️", category:"parchemins", tier:2, use:"Encre alchimique. Base des parchemins.", market_price_suggested:6 },
  { key:"autorisation_marche", name:"Autorisation de marché", icon:"📝", category:"parchemins", tier:2, use:"🎯 Débloque un objectif : produire 10 T1. Récompense : 40💰.", market_price_suggested:20 },
  // T3
  { key:"meuble",       name:"Meuble",          icon:"🪑", category:"meubles",    tier:3, use:"🏠 Réduit l'entretien logement de 30% (passif).", market_price_suggested:18 },
  { key:"lingots_fer",  name:"Lingots de fer",  icon:"⬜", category:"fer",        tier:3, use:"Métal fondu. Matériau pour outils et armes.", market_price_suggested:15 },
  { key:"farine",       name:"Farine",          icon:"🧺", category:"nourriture", tier:3, use:"🌾 +3 faim si consommée.", hunger_restore:3, market_price_suggested:12 },
  { key:"tissu",        name:"Tissu",           icon:"🧶", category:"tissu",      tier:3, use:"Tissu tissé. Matériau pour vêtements.", market_price_suggested:14 },
  { key:"epee_courte",  name:"Épée courte",     icon:"🗡️", category:"armes",      tier:3, use:"⚔️ +1 score attaque pour les vols. Durabilité 4.", market_price_suggested:20 },
  { key:"potion_soin",  name:"Potion de soin",  icon:"🧪", category:"potions",    tier:3, use:"⚡ +8 énergie instantané.", fatigue_restore:8, market_price_suggested:18 },
  { key:"lingots_or",   name:"Lingot d'or",     icon:"🥇", category:"or",         tier:3, use:"💰 Vendable : 25💰 orfèvre + 15💰 partagés aux résidents.", market_price_suggested:40 },
  { key:"parchemin",    name:"Parchemin",       icon:"📜", category:"parchemins", tier:3, use:"Parchemin vierge. Base des contrats.", market_price_suggested:12 },
  { key:"pain",         name:"Pain",            icon:"🍞", category:"nourriture", tier:3, use:"🍞 +4 faim si consommé.", hunger_restore:4, market_price_suggested:14 },
  { key:"contrat_artisan", name:"Contrat artisan", icon:"📋", category:"parchemins", tier:3, use:"🎯 Objectif : produire 5 T2 ou vendre 8 items. Récompense : 110💰.", market_price_suggested:50 },
  // T4
  { key:"armure",       name:"Armure",          icon:"🥋", category:"armures",    tier:4, use:"⚔️ +2 défense contre les vols. Durabilité 6.", market_price_suggested:35 },
  { key:"outils",       name:"Outils",          icon:"🔧", category:"outils",     tier:4, use:"⚒️ +3 actions bonus avant cooldown. Durabilité 5.", market_price_suggested:30 },
  { key:"ragout",       name:"Ragoût",          icon:"🍲", category:"nourriture", tier:4, use:"🍽️ +7 faim si consommé.", hunger_restore:7, market_price_suggested:22 },
  { key:"besace",       name:"Besace",          icon:"🎒", category:"armures",    tier:4, use:"👜 +60 capacité inventaire + +1 défense vol. Durée 7 jours.", expires_days:7, market_price_suggested:45 },
  { key:"epee_longue",  name:"Épée longue",     icon:"⚔️", category:"armes",      tier:4, use:"⚔️ +2 score attaque pour les vols. Durabilité 6.", market_price_suggested:40 },
  { key:"potion_endur", name:"Potion d'endurance", icon:"💪", category:"potions", tier:4, use:"⚡ +20 énergie instantané.", fatigue_restore:20, market_price_suggested:35 },
  { key:"lingot_raffine", name:"Lingot raffiné", icon:"🏅", category:"or",        tier:4, use:"💰 Vendable : 55💰 orfèvre + 35💰 partagés aux résidents. Fonderie requise.", market_price_suggested:90 },
  // T5
  { key:"huile_inflammable",  name:"Huile inflammable",  icon:"🔥", category:"parchemins", tier:5, use:"🏙️ Désactive 1 bâtiment aléatoire dans une ville ennemie pendant 1 jour.", is_competitive:true, market_price_suggested:120 },
  { key:"poudre_corrosive",   name:"Poudre corrosive",   icon:"💥", category:"parchemins", tier:5, use:"📦 Détruit 15 unités d'une ressource aléatoire de l'entrepôt ennemi.", is_competitive:true, market_price_suggested:120 },
  { key:"festin_empoisonne",  name:"Festin empoisonné",  icon:"🍖", category:"nourriture", tier:5, use:"☠️ Réduit la faim max des résidents d'une ville ennemie de 3 points pendant 2 jours.", is_competitive:true, market_price_suggested:120 },
  { key:"faux_contrat",       name:"Faux contrat",        icon:"📄", category:"parchemins", tier:5, use:"👁️ Attaque : les routes restent inconnues pour les voyageurs ennemis pendant 2 jours.", is_competitive:true, market_price_suggested:120 },
  { key:"cle_forgee",         name:"Clé forgée",          icon:"🗝️", category:"parchemins", tier:5, use:"🏦 Vole 10-15% de la trésorerie d'une ville ennemie.", is_competitive:true, market_price_suggested:120 },
  { key:"elixir_discorde",    name:"Élixir de discorde",  icon:"☠️", category:"potions",    tier:5, use:"📉 Réduit les taxes collectées par une ville ennemie de 10% pendant 1 jour.", is_competitive:true, market_price_suggested:120 },
  { key:"lingot_royal",       name:"Lingot royal",        icon:"👑", category:"or",         tier:5, use:"💰 Vendable : 120💰 orfèvre + 80💰 partagés aux résidents. Fonderie requise.", market_price_suggested:200 },
  { key:"lettre_desinformation", name:"Lettre de désinformation", icon:"✉️", category:"parchemins", tier:5, use:"📰 −10% taxes ville ennemie + rumeur en taverne pendant 1 jour.", is_competitive:true, market_price_suggested:130 },
  { key:"contrat_noble",      name:"Contrat noble",       icon:"📜", category:"parchemins", tier:5, use:"🎯 Débloque un objectif majeur. Récompense : 550💰.", market_price_suggested:180 },
];

const RECIPES_DATA = [
  // BÛCHERON
  { recipe_id:"craft_planches",   name:"Planches",        icon:"🪵", profession:"Bûcheron",  tier:2, output_key:"planches",          output_quantity:3, cost_gold:0,   inputs:[{key:"bois_brut",qty:4},{key:"pierre_brute",qty:2}],          description:"Bois ×4 + Pierre ×2 → 3 planches" },
  { recipe_id:"craft_meuble",     name:"Meuble",          icon:"🪑", profession:"Bûcheron",  tier:3, output_key:"meuble",            output_quantity:1, cost_gold:0,   inputs:[{key:"planches",qty:3},{key:"fil",qty:2}],                    description:"Planches ×3 + Fil ×2 → 1 meuble" },
  { recipe_id:"craft_armure",     name:"Armure",          icon:"🥋", profession:"Bûcheron",  tier:4, output_key:"armure",            output_quantity:1, cost_gold:5,   inputs:[{key:"meuble",qty:2},{key:"lingots_fer",qty:2}],              description:"Meuble ×2 + Lingots fer ×2 → 1 armure" },
  { recipe_id:"craft_huile_inflammable", name:"Huile inflammable", icon:"🔥", profession:"Bûcheron", tier:5, output_key:"huile_inflammable", output_quantity:1, cost_gold:10, inputs:[{key:"armure",qty:1},{key:"planches",qty:2},{key:"potion_soin",qty:1}], description:"Armure ×1 + Planches ×2 + Potion soin ×1 → Huile inflammable" },
  // MINEUR
  { recipe_id:"craft_pierre",     name:"Pierre brute",    icon:"🗿", profession:"Mineur",    tier:2, output_key:"pierre_brute",      output_quantity:3, cost_gold:0,   inputs:[{key:"minerai_fer",qty:3},{key:"bois_brut",qty:2}],          description:"Minerai ×3 + Bois ×2 → 3 pierres brutes" },
  { recipe_id:"craft_lingots_fer",name:"Lingots de fer",  icon:"⬜", profession:"Mineur",    tier:3, output_key:"lingots_fer",       output_quantity:2, cost_gold:3,   inputs:[{key:"minerai_fer",qty:3},{key:"pierre_brute",qty:2},{key:"charbon",qty:1}], description:"Minerai ×3 + Pierre ×2 + Charbon ×1 → 2 lingots de fer" },
  { recipe_id:"craft_outils",     name:"Outils",          icon:"🔧", profession:"Mineur",    tier:4, output_key:"outils",            output_quantity:2, cost_gold:0,   inputs:[{key:"lingots_fer",qty:2},{key:"planches",qty:2}],            description:"Lingots fer ×2 + Planches ×2 → 2 outils" },
  { recipe_id:"craft_poudre_corrosive", name:"Poudre corrosive", icon:"💥", profession:"Mineur", tier:5, output_key:"poudre_corrosive", output_quantity:1, cost_gold:10, inputs:[{key:"outils",qty:1},{key:"epee_courte",qty:1},{key:"minerai_fer",qty:4}], description:"Outils ×1 + Épée courte ×1 + Minerai ×4 → Poudre corrosive" },
  // FERMIER
  { recipe_id:"craft_farine",     name:"Farine",          icon:"🧺", profession:"Fermier",   tier:3, output_key:"farine",            output_quantity:3, cost_gold:2,   inputs:[{key:"ble",qty:4},{key:"pierre_brute",qty:2}],              description:"Blé ×4 + Pierre ×2 → 3 farine" },
  { recipe_id:"craft_pain",       name:"Pain",            icon:"🍞", profession:"Fermier",   tier:3, output_key:"pain",              output_quantity:3, cost_gold:0,   inputs:[{key:"farine",qty:2},{key:"extrait",qty:1}],                 description:"Farine ×2 + Extrait ×1 → 3 pains" },
  { recipe_id:"craft_ragout",     name:"Ragoût",          icon:"🍲", profession:"Fermier",   tier:4, output_key:"ragout",            output_quantity:2, cost_gold:2,   inputs:[{key:"farine",qty:2},{key:"extrait",qty:2},{key:"ble",qty:2}], description:"Farine ×2 + Extrait ×2 + Blé ×2 → 2 ragoûts" },
  { recipe_id:"craft_festin_empoisonne", name:"Festin empoisonné", icon:"🍖", profession:"Fermier", tier:5, output_key:"festin_empoisonne", output_quantity:1, cost_gold:0, inputs:[{key:"armure",qty:1},{key:"outils",qty:1},{key:"besace",qty:1},{key:"potion_endur",qty:1},{key:"contrat_artisan",qty:1}], description:"Armure ×1 + Outils ×1 + Besace ×1 + Potion endurance ×1 + Contrat artisan ×1 → Festin empoisonné" },
  // TISSERAND
  { recipe_id:"craft_fil",        name:"Fil",             icon:"🧵", profession:"Tisserand", tier:2, output_key:"fil",               output_quantity:4, cost_gold:0,   inputs:[{key:"laine_brute",qty:4},{key:"extrait",qty:1}],            description:"Laine ×4 + Extrait ×1 → 4 fil" },
  { recipe_id:"craft_tissu",      name:"Tissu",           icon:"🧶", profession:"Tisserand", tier:3, output_key:"tissu",             output_quantity:2, cost_gold:0,   inputs:[{key:"fil",qty:3},{key:"encre",qty:1}],                      description:"Fil ×3 + Encre ×1 → 2 tissu" },
  { recipe_id:"craft_besace",     name:"Besace",          icon:"🎒", profession:"Tisserand", tier:4, output_key:"besace",            output_quantity:1, cost_gold:0,   inputs:[{key:"tissu",qty:2},{key:"meuble",qty:1}],                   description:"Tissu ×2 + Meuble ×1 → 1 besace" },
  // FORGERON
  { recipe_id:"craft_pierre",      name:"Pierre",          icon:"🪨", profession:"Forgeron",  tier:1, output_key:"pierre",             output_quantity:3, cost_gold:0,   inputs:[{key:"minerai_fer",qty:2},{key:"bois_brut",qty:1}],          description:"Minerai ×2 + Bois ×1 → 3 pierres" },
  { recipe_id:"craft_charbon",    name:"Charbon",         icon:"⬛", profession:"Forgeron",  tier:2, output_key:"charbon",           output_quantity:2, cost_gold:0,   inputs:[{key:"pierre",qty:1},{key:"bois_brut",qty:1},{key:"laine_brute",qty:1}], description:"Pierre ×1 + Bois ×1 + Laine ×1 → 2 charbons" },
  { recipe_id:"craft_epee_courte",name:"Épée courte",     icon:"🗡️", profession:"Forgeron",  tier:3, output_key:"epee_courte",       output_quantity:1, cost_gold:5,   inputs:[{key:"lingots_fer",qty:2},{key:"charbon",qty:2},{key:"pierre_brute",qty:1}], description:"Lingots fer ×2 + Charbon ×2 + Pierre brute ×1 → 1 épée courte" },
  { recipe_id:"craft_epee_longue",name:"Épée longue",     icon:"⚔️", profession:"Forgeron",  tier:4, output_key:"epee_longue",       output_quantity:1, cost_gold:8,   inputs:[{key:"epee_courte",qty:2},{key:"outils",qty:1}],             description:"Épée courte ×2 + Outils ×1 → 1 épée longue" },
  { recipe_id:"craft_cle_forgee", name:"Clé forgée",      icon:"🗝️", profession:"Forgeron",  tier:5, output_key:"cle_forgee",        output_quantity:1, cost_gold:20,  inputs:[{key:"epee_longue",qty:1},{key:"lingots_or",qty:1},{key:"charbon",qty:3}], description:"Épée longue ×1 + Lingot or ×1 + Charbon ×3 → Clé forgée" },
  // ALCHIMISTE
  { recipe_id:"craft_extrait",    name:"Extrait",         icon:"🫗", profession:"Alchimiste",tier:2, output_key:"extrait",           output_quantity:3, cost_gold:0,   inputs:[{key:"herbes",qty:4},{key:"ble",qty:2}],                     description:"Herbes ×4 + Blé ×2 → 3 extraits" },
  { recipe_id:"craft_potion_soin",name:"Potion de soin",  icon:"🧪", profession:"Alchimiste",tier:3, output_key:"potion_soin",       output_quantity:2, cost_gold:0,   inputs:[{key:"extrait",qty:2},{key:"fil",qty:1},{key:"herbes",qty:2}], description:"Extrait ×2 + Fil ×1 + Herbes ×2 → 2 potions de soin" },
  { recipe_id:"craft_potion_endur",name:"Potion d'endurance",icon:"💪",profession:"Alchimiste",tier:4,output_key:"potion_endur",    output_quantity:1, cost_gold:5,   inputs:[{key:"potion_soin",qty:2},{key:"ragout",qty:1}],             description:"Potion soin ×2 + Ragoût ×1 → 1 potion d'endurance" },
  { recipe_id:"craft_elixir_discorde",name:"Élixir de discorde",icon:"☠️",profession:"Alchimiste",tier:5,output_key:"elixir_discorde",output_quantity:1,cost_gold:20, inputs:[{key:"potion_endur",qty:1},{key:"epee_courte",qty:1},{key:"herbes",qty:5}], description:"Potion end. ×1 + Épée courte ×1 + Herbes ×5 → Élixir de discorde" },
  // ORFÈVRE
  { recipe_id:"craft_quartz_poli",name:"Quartz poli",     icon:"💠", profession:"Orfèvre",   tier:2, output_key:"quartz_poli",       output_quantity:2, cost_gold:0,   inputs:[{key:"quartz_brut",qty:4},{key:"charbon",qty:2}],            description:"Quartz ×4 + Charbon ×2 → 2 quartz polis" },
  { recipe_id:"craft_lingots_or", name:"Lingot d'or",     icon:"🥇", profession:"Orfèvre",   tier:3, output_key:"lingots_or",        output_quantity:1, cost_gold:5,   inputs:[{key:"quartz_poli",qty:2},{key:"minerai_fer",qty:2}],        description:"Quartz poli ×2 + Minerai ×2 → 1 lingot d'or" },
  { recipe_id:"craft_lingot_raffine",name:"Lingot raffiné",icon:"🏅",profession:"Orfèvre",  tier:4, output_key:"lingot_raffine",    output_quantity:1, cost_gold:10, requires_building:"fonderie", inputs:[{key:"lingots_or",qty:2},{key:"extrait",qty:2}], description:"Lingot or ×2 + Extrait ×2 → 1 lingot raffiné [Fonderie requise]" },
  { recipe_id:"craft_lingot_royal",name:"Lingot royal",   icon:"👑", profession:"Orfèvre",   tier:5, output_key:"lingot_royal",      output_quantity:1, cost_gold:20, requires_building:"fonderie", inputs:[{key:"lingot_raffine",qty:2},{key:"planches",qty:3}], description:"Lingot raffiné ×2 + Planches ×3 → 1 lingot royal [Fonderie requise]" },
  // MARCHAND
  { recipe_id:"craft_encre",      name:"Encre",           icon:"🖋️", profession:"Marchand",  tier:2, output_key:"encre",             output_quantity:3, cost_gold:0,   inputs:[{key:"herbes",qty:3},{key:"charbon",qty:2}],                 description:"Herbes ×3 + Charbon ×2 → 3 encres" },
  { recipe_id:"craft_autorisation_marche",name:"Autorisation de marché",icon:"📝",profession:"Marchand", tier:2, output_key:"autorisation_marche", output_quantity:2, cost_gold:10, inputs:[{key:"ble",qty:3},{key:"bois_brut",qty:3},{key:"herbes",qty:3}], description:"Blé ×3 + Bois ×3 + Herbes ×3 → 2 autorisations de marché" },
  { recipe_id:"craft_parchemin",  name:"Parchemin",       icon:"📜", profession:"Marchand",  tier:3, output_key:"parchemin",         output_quantity:2, cost_gold:0,   inputs:[{key:"encre",qty:2},{key:"planches",qty:2}],                 description:"Encre ×2 + Planches ×2 → 2 parchemins" },
  { recipe_id:"craft_contrat_artisan",name:"Contrat artisan",icon:"📋",profession:"Marchand",tier:3, output_key:"contrat_artisan",   output_quantity:1, cost_gold:30,  inputs:[{key:"planches",qty:2},{key:"farine",qty:2},{key:"fil",qty:2}], description:"Planches ×2 + Farine ×2 + Fil ×2 → Contrat artisan" },
  { recipe_id:"craft_contrat_noble",name:"Contrat noble", icon:"📜", profession:"Marchand",  tier:5, output_key:"contrat_noble",     output_quantity:1, cost_gold:200, inputs:[{key:"besace",qty:1},{key:"epee_longue",qty:1},{key:"potion_endur",qty:1},{key:"lingots_or",qty:1}], description:"Besace + Épée longue + Potion end. + Lingot or → Contrat noble" },
  { recipe_id:"craft_lettre_desinformation",name:"Lettre de désinformation",icon:"✉️",profession:"Marchand",tier:5,output_key:"lettre_desinformation",output_quantity:1,cost_gold:50,inputs:[{key:"contrat_noble",qty:1},{key:"armure",qty:1},{key:"tissu",qty:3}], description:"Contrat noble + Armure + Tissu ×3 → Lettre de désinformation" },
];

const PROFESSIONS_DATA = [
  { key:"Bûcheron",   name:"Bûcheron",   icon:"🪓", description:"Source principale de bois et charbon.", start_gold:100, start_items:[{item_key:"bois_brut",item_name:"Bois brut",item_category:"bois",quantity:20}], production_actions:[{id:"farm_bois",name:"Couper du bois",output_key:"bois_brut",quantity:5,cooldown:90,cost_gold:0,icon:"🌲"}] },
  { key:"Mineur",     name:"Mineur",     icon:"⛏️", description:"Extrait pierre et minerai pour le Forgeron, et quartz brut pour l'Orfèvre.", start_gold:100, start_items:[{item_name:"Pierre brute",item_category:"pierre",quantity:16},{item_name:"Minerai de fer",item_category:"fer",quantity:8}], production_actions:[{id:"farm_minerai",name:"Extraire le minerai",output_key:"minerai_fer",quantity:4,cooldown:120,cost_gold:0,icon:"🪨"},{id:"farm_quartz",name:"Extraire du quartz",output_key:"quartz_brut",quantity:3,cooldown:120,cost_gold:0,icon:"🔮"}] },
  { key:"Fermier",    name:"Fermier",    icon:"🐄", description:"Hub central. Produit la nourriture qui maintient la faim de tous les joueurs.", start_gold:100, start_items:[{item_name:"Blé",item_category:"nourriture",quantity:20},{item_name:"Laine brute",item_category:"tissu",quantity:8}], production_actions:[{id:"farm_ble",name:"Récolter le blé",output_key:"ble",quantity:7,cooldown:60,cost_gold:0,icon:"🌾"},{id:"farm_laine",name:"Tondre les moutons",output_key:"laine_brute",quantity:5,cooldown:120,cost_gold:0,icon:"🐑"},{id:"farm_herbes",name:"Cultiver des herbes",output_key:"herbes",quantity:6,cooldown:90,cost_gold:0,icon:"🌿"}] },
  { key:"Tisserand",  name:"Tisserand",  icon:"🧵", description:"File la laine en tissu, fabrique besaces et équipements.", start_gold:100, start_items:[{item_key:"laine_brute",item_name:"Laine brute",item_category:"tissu",quantity:16}], production_actions:[{id:"farm_laine_t",name:"Tondre la laine",output_key:"laine_brute",quantity:5,cooldown:100,cost_gold:0,icon:"🐑"}] },
  { key:"Forgeron",   name:"Forgeron",   icon:"⚒️", description:"Fond le minerai en lingots, forge les outils et armes.", start_gold:100, start_items:[{item_name:"Minerai de fer",item_category:"fer",quantity:12},{item_name:"Planches",item_category:"bois",quantity:6}], production_actions:[{id:"farm_minerai_f",name:"Extraire le minerai",output_key:"minerai_fer",quantity:3,cooldown:120,cost_gold:0,icon:"🪨"}] },
  { key:"Alchimiste", name:"Alchimiste", icon:"⚗️", description:"Distille herbes en extraits, puis en potions. Seul à craft les potions.", start_gold:100, start_items:[{item_name:"Herbes",item_category:"potions",quantity:12}], production_actions:[{id:"farm_herbes_a",name:"Cueillir des herbes",output_key:"herbes",quantity:6,cooldown:80,cost_gold:0,icon:"🌿"}] },
  { key:"Orfèvre",    name:"Orfèvre",    icon:"🏅", description:"Seul à produire des lingots d'or — dépend du Mineur, Forgeron et Bûcheron.", start_gold:100, start_items:[{item_name:"Quartz brut",item_category:"or",quantity:12},{item_name:"Charbon",item_category:"bois",quantity:4}], production_actions:[{id:"farm_quartz_o",name:"Extraire du quartz",output_key:"quartz_brut",quantity:3,cooldown:120,cost_gold:0,icon:"🔮"}] },
  { key:"Marchand",   name:"Marchand",   icon:"🏪", description:"Organise convois et contrats. Voyage GRATUITEMENT. Récupère 50% des taxes sur ses propres ventes.", start_gold:100, start_items:[{item_name:"Tissu",item_category:"tissu",quantity:10},{item_name:"Planches",item_category:"bois",quantity:8}], production_actions:[{id:"farm_herbes_m",name:"Collecter des herbes",output_key:"herbes",quantity:3,cooldown:120,cost_gold:0,icon:"🌿"},{id:"farm_bois_m",name:"Collecter du bois",output_key:"bois_brut",quantity:3,cooldown:120,cost_gold:0,icon:"🪵"}] },
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const { action = "seed" } = await req.json().catch(() => ({}));

  if (action === "reset") {
    // Supprimer toutes les données existantes
    const [existingItems, existingRecipes, existingProfs] = await Promise.all([
      base44.asServiceRole.entities.ItemDef.list(),
      base44.asServiceRole.entities.CraftingRecipe.list(),
      base44.asServiceRole.entities.ProfessionDef.list(),
    ]);
    await Promise.all([
      ...existingItems.map(i => base44.asServiceRole.entities.ItemDef.delete(i.id)),
      ...existingRecipes.map(r => base44.asServiceRole.entities.CraftingRecipe.delete(r.id)),
      ...existingProfs.map(p => base44.asServiceRole.entities.ProfessionDef.delete(p.id)),
    ]);
  }

  // Seed items
  const itemResults = [];
  for (const item of ITEMS_DATA) {
    const existing = await base44.asServiceRole.entities.ItemDef.filter({ key: item.key });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.ItemDef.update(existing[0].id, item);
      itemResults.push({ key: item.key, status: "updated" });
    } else {
      await base44.asServiceRole.entities.ItemDef.create({ ...item, is_active: true });
      itemResults.push({ key: item.key, status: "created" });
    }
  }

  // Seed recipes
  const recipeResults = [];
  for (const recipe of RECIPES_DATA) {
    const existing = await base44.asServiceRole.entities.CraftingRecipe.filter({ recipe_id: recipe.recipe_id });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.CraftingRecipe.update(existing[0].id, recipe);
      recipeResults.push({ id: recipe.recipe_id, status: "updated" });
    } else {
      await base44.asServiceRole.entities.CraftingRecipe.create({ ...recipe, is_active: true });
      recipeResults.push({ id: recipe.recipe_id, status: "created" });
    }
  }

  // Seed professions
  const profResults = [];
  for (const prof of PROFESSIONS_DATA) {
    const existing = await base44.asServiceRole.entities.ProfessionDef.filter({ key: prof.key });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.ProfessionDef.update(existing[0].id, prof);
      profResults.push({ key: prof.key, status: "updated" });
    } else {
      await base44.asServiceRole.entities.ProfessionDef.create({ ...prof, is_active: true });
      profResults.push({ key: prof.key, status: "created" });
    }
  }

  return Response.json({
    success: true,
    items: itemResults,
    recipes: recipeResults,
    professions: profResults,
    summary: `${itemResults.length} items, ${recipeResults.length} recettes, ${profResults.length} professions`
  });
});