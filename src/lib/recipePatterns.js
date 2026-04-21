// ═══════════════════════════════════════════════════════════════
// recipePatterns.js — Schéma strict : T2→T5 patterns
// T2 = 1×T1 propre + 2×T1 d'autres métiers
// T3 = 3×T2 d'autres métiers
// T4 = 4×T3 d'autres métiers
// T5 = 5×T4 d'autres métiers (FIXES — ne pas modifier)
// ═══════════════════════════════════════════════════════════════

export const CRAFTING_RECIPES_REFACTORED = [

  // ════ BÛCHERON ════
  {
    id: "craft_planches",
    name: "Planches",
    icon: "🪵",
    profession: "Bûcheron",
    tier: 2,
    inputs: [
      { key: "bois_brut",   quantity: 1 }, // Bûcheron T1 (propre)
      { key: "minerai_fer", quantity: 1 }, // Mineur T1
      { key: "laine_brute", quantity: 1 }, // Tisserand T1
    ],
    output: { key: "planches", quantity: 1 },
    costGold: 0,
    cooldown: 120,
    description: "Bois ×1 + Minerai ×1 (Mineur) + Laine ×1 (Tisserand) → 3 planches",
  },
  {
    id: "craft_meuble",
    name: "Meuble",
    icon: "🪑",
    profession: "Bûcheron",
    tier: 3,
    inputs: [
      { key: "planches",    quantity: 1 }, // Bûcheron T2 (propre)
      { key: "quartz_poli", quantity: 1 }, // Orfèvre T2 — vernis cristallin
      { key: "pierre_brute",quantity: 1 }, // Mineur T2
    ],
    output: { key: "meuble", quantity: 1 },
    costGold: 0,
    cooldown: 240,
    description: "Planches + Quartz poli (Orfèvre, vernis cristallin) + Pierre brute (Mineur, socle) → 1 meuble",
  },
  {
    id: "craft_armure",
    name: "Armure",
    icon: "🥋",
    profession: "Bûcheron",
    tier: 4,
    inputs: [
      { key: "meuble",      quantity: 1 }, // Bûcheron T3
      { key: "lingots_fer", quantity: 1 }, // Mineur T3
      { key: "potion_soin", quantity: 1 }, // Alchimiste T3
      { key: "parchemin",   quantity: 1 }, // Marchand T3
    ],
    output: { key: "armure", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Meuble (cadre boisé) + Lingots fer (plaques) + Potion (huile protectrice) + Parchemin (brevet) → 1 armure",
  },
  {
    id: "craft_huile_inflammable",
    name: "Huile inflammable",
    icon: "🔥",
    profession: "Bûcheron",
    tier: 5,
    inputs: [
      { key: "ragout",         quantity: 1 }, // Fermier T4
      { key: "epee_longue",    quantity: 1 }, // Forgeron T4
      { key: "besace",         quantity: 1 }, // Tisserand T4
      { key: "potion_endur",   quantity: 1 }, // Alchimiste T4
      { key: "lingot_raffine", quantity: 1 }, // Orfèvre T4
    ],
    output: { key: "huile_inflammable", quantity: 1 },
    costGold: 0,
    cooldown: 960,
    description: "Ragout + Épée longue + Besace + Potion endurance + Lingot raffiné → Huile inflammable",
  },

  // ════ MINEUR ════
  {
    id: "craft_pierre_brute",
    name: "Pierre brute",
    icon: "🗿",
    profession: "Mineur",
    tier: 2,
    inputs: [
      { key: "minerai_fer", quantity: 1 }, // Mineur T1 (propre)
      { key: "bois_brut",   quantity: 1 }, // Bûcheron T1
      { key: "ble",         quantity: 1 }, // Fermier T1
    ],
    output: { key: "pierre_brute", quantity: 1 },
    costGold: 0,
    cooldown: 120,
    description: "Minerai + Bois (Bûcheron, étais) + Blé (Fermier, liant) → 2 pierres brutes",
  },
  {
    id: "craft_lingots_fer",
    name: "Lingots de fer",
    icon: "🔩",
    profession: "Mineur",
    tier: 3,
    inputs: [
      { key: "charbon",     quantity: 1 }, // Forgeron T2
      { key: "pierre_brute",quantity: 1 }, // Mineur T2 (propre)
      { key: "farine",      quantity: 1 }, // Fermier T2 — liant de creuset
    ],
    output: { key: "lingots_fer", quantity: 1 },
    costGold: 0,
    cooldown: 240,
    description: "Charbon (Forgeron, combustible) + Pierre brute (moule) + Farine (Fermier, liant creuset) → 2 lingots de fer",
  },
  {
    id: "craft_outils",
    name: "Outils",
    icon: "🔧",
    profession: "Mineur",
    tier: 4,
    inputs: [
      { key: "lingots_fer",  quantity: 1 }, // Mineur T3
      { key: "tissu",        quantity: 1 }, // Tisserand T3
      { key: "epee_courte",  quantity: 1 }, // Forgeron T3
      { key: "pain",         quantity: 1 }, // Fermier T3
    ],
    output: { key: "outils", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Lingots fer (lames) + Tissu (poignées rembourrées) + Épée courte (acier trempé) + Pain (nourriture de chantier) → 2 outils",
  },
  {
    id: "craft_poudre_corrosive",
    name: "Poudre corrosive",
    icon: "💥",
    profession: "Mineur",
    tier: 5,
    inputs: [
      { key: "armure",          quantity: 1 }, // Bûcheron T4
      { key: "ragout",          quantity: 1 }, // Fermier T4
      { key: "besace",          quantity: 1 }, // Tisserand T4
      { key: "epee_longue",     quantity: 1 }, // Forgeron T4
      { key: "contrat_artisan", quantity: 1 }, // Marchand T4
    ],
    output: { key: "poudre_corrosive", quantity: 1 },
    costGold: 0,
    cooldown: 960,
    description: "Armure + Ragout + Besace + Épée longue + Contrat artisan → Poudre corrosive",
  },

  // ════ FERMIER ════
  {
    id: "craft_farine",
    name: "Farine",
    icon: "🧺",
    profession: "Fermier",
    tier: 2,
    inputs: [
      { key: "ble",         quantity: 1 }, // Fermier T1 (propre)
      { key: "herbes",      quantity: 1 }, // Alchimiste T1
      { key: "laine_brute", quantity: 1 }, // Tisserand T1
    ],
    output: { key: "farine", quantity: 1 },
    costGold: 0,
    cooldown: 120,
    description: "Blé + Herbes (Alchimiste, levain) + Laine (Tisserand, filtre) → 3 farines",
  },
  {
    id: "craft_pain",
    name: "Pain",
    icon: "🍞",
    profession: "Fermier",
    tier: 3,
    inputs: [
      { key: "farine",  quantity: 1 }, // Fermier T2
      { key: "extrait", quantity: 1 }, // Alchimiste T2 — levain concentré
      { key: "encre",   quantity: 1 }, // Marchand T2 — cachet de qualité
    ],
    output: { key: "pain", quantity: 1 },
    costGold: 0,
    cooldown: 240,
    description: "Farine + Extrait (Alchimiste, levain actif) + Encre (Marchand, cachet boulangers) → 3 pains",
  },
  {
    id: "craft_ragout",
    name: "Ragoût",
    icon: "🍲",
    profession: "Fermier",
    tier: 4,
    inputs: [
      { key: "pain",        quantity: 1 }, // Fermier T3
      { key: "lingots_fer", quantity: 1 }, // Mineur T3 — marmite en fer
      { key: "tissu",       quantity: 1 }, // Tisserand T3 — étamine de filtrage
      { key: "potion_soin", quantity: 1 }, // Alchimiste T3 — bouillon fortifiant
    ],
    output: { key: "ragout", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Pain (base) + Lingots fer (marmite) + Tissu (étamine) + Potion soin (bouillon fortifiant) → 2 ragoûts",
  },
  {
    id: "craft_festin_empoisonne",
    name: "Festin empoisonné",
    icon: "🍖",
    profession: "Fermier",
    tier: 5,
    inputs: [
      { key: "armure",          quantity: 1 }, // Bûcheron T4
      { key: "outils",          quantity: 1 }, // Mineur T4
      { key: "besace",          quantity: 1 }, // Tisserand T4
      { key: "potion_endur",    quantity: 1 }, // Alchimiste T4
      { key: "contrat_artisan", quantity: 1 }, // Marchand T4
    ],
    output: { key: "festin_empoisonne", quantity: 1 },
    costGold: 0,
    cooldown: 960,
    description: "Armure + Outils + Besace + Potion endurance + Contrat artisan → Festin empoisonné",
  },

  // ════ TISSERAND ════
  {
    id: "craft_fil",
    name: "Fil",
    icon: "🧵",
    profession: "Tisserand",
    tier: 2,
    inputs: [
      { key: "laine_brute", quantity: 1 }, // Tisserand T1 (propre)
      { key: "herbes",      quantity: 1 }, // Alchimiste T1
      { key: "quartz_brut", quantity: 1 }, // Orfèvre T1
    ],
    output: { key: "fil", quantity: 1 },
    costGold: 0,
    cooldown: 120,
    description: "Laine + Herbes (Alchimiste, teinture) + Quartz (Orfèvre, abrasif de filage) → 3 fils",
  },
  {
    id: "craft_tissu",
    name: "Tissu",
    icon: "🧶",
    profession: "Tisserand",
    tier: 3,
    inputs: [
      { key: "fil",     quantity: 1 }, // Tisserand T2 (propre)
      { key: "extrait", quantity: 1 }, // Alchimiste T2 — apprêt chimique
      { key: "planches",quantity: 1 }, // Bûcheron T2 — cadre de métier à tisser
    ],
    output: { key: "tissu", quantity: 1 },
    costGold: 0,
    cooldown: 240,
    description: "Fil + Extrait (Alchimiste, apprêt) + Planches (Bûcheron, cadre de tissage) → 2 tissus",
  },
  {
    id: "craft_besace",
    name: "Besace",
    icon: "🎒",
    profession: "Tisserand",
    tier: 4,
    inputs: [
      { key: "tissu",       quantity: 1 }, // Tisserand T3
      { key: "lingots_fer", quantity: 1 }, // Mineur T3 — armatures
      { key: "lingots_or",  quantity: 1 }, // Orfèvre T3 — fermoirs
      { key: "parchemin",   quantity: 1 }, // Marchand T3 — étiquette officielle
    ],
    output: { key: "besace", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Tissu + Lingots fer (armatures) + Lingots or (fermoirs dorés) + Parchemin (étiquette) → 1 besace",
  },
  {
    id: "craft_faux_contrat",
    name: "Faux contrat",
    icon: "📄",
    profession: "Tisserand",
    tier: 5,
    inputs: [
      { key: "armure",         quantity: 1 }, // Bûcheron T4
      { key: "outils",         quantity: 1 }, // Mineur T4
      { key: "epee_longue",    quantity: 1 }, // Forgeron T4
      { key: "potion_endur",   quantity: 1 }, // Alchimiste T4
      { key: "lingot_raffine", quantity: 1 }, // Orfèvre T4
    ],
    output: { key: "faux_contrat", quantity: 1 },
    costGold: 0,
    cooldown: 960,
    description: "Armure + Outils + Épée longue + Potion endurance + Lingot raffiné → Faux contrat",
  },

  // ════ FORGERON ════
  {
    id: "craft_charbon",
    name: "Charbon",
    icon: "⚫",
    profession: "Forgeron",
    tier: 2,
    inputs: [
      { key: "pierre",      quantity: 1 }, // Forgeron T1 (propre)
      { key: "bois_brut",   quantity: 1 }, // Bûcheron T1
      { key: "laine_brute", quantity: 1 }, // Tisserand T1
    ],
    output: { key: "charbon", quantity: 1 },
    costGold: 0,
    cooldown: 120,
    description: "Pierre + Bois (Bûcheron, combustion) + Laine (Tisserand, soufflet) → 2 charbons",
  },
  {
    id: "craft_epee_courte",
    name: "Épée courte",
    icon: "🗡️",
    profession: "Forgeron",
    tier: 3,
    inputs: [
      { key: "charbon",     quantity: 1 }, // Forgeron T2
      { key: "pierre_brute",quantity: 1 }, // Mineur T2
      { key: "quartz_poli", quantity: 1 }, // Orfèvre T2 — abrasif d'affûtage
    ],
    output: { key: "epee_courte", quantity: 1 },
    costGold: 0,
    cooldown: 240,
    description: "Charbon (forge) + Pierre brute (enclume/moule) + Quartz poli (Orfèvre, affûtage) → 1 épée courte",
  },
  {
    id: "craft_epee_longue",
    name: "Épée longue",
    icon: "⚔️",
    profession: "Forgeron",
    tier: 4,
    inputs: [
      { key: "epee_courte", quantity: 1 }, // Forgeron T3 (propre)
      { key: "tissu",       quantity: 1 }, // Tisserand T3 — garde et poignée
      { key: "lingots_fer", quantity: 1 }, // Mineur T3 — allonge de lame
      { key: "meuble",      quantity: 1 }, // Bûcheron T3 — atelier de forge boisé
    ],
    output: { key: "epee_longue", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Épée courte + Tissu (garde/poignée) + Lingots fer (allonge) + Meuble (Bûcheron, atelier équipé) → 1 épée longue",
  },
  {
    id: "craft_cle_forgee",
    name: "Clé forgée",
    icon: "🗝️",
    profession: "Forgeron",
    tier: 5,
    inputs: [
      { key: "ragout",       quantity: 1 }, // Fermier T4
      { key: "epee_longue",  quantity: 1 }, // Forgeron T4
      { key: "outils",       quantity: 1 }, // Mineur T4
      { key: "besace",       quantity: 1 }, // Tisserand T4
      { key: "potion_endur", quantity: 1 }, // Alchimiste T4
    ],
    output: { key: "cle_forgee", quantity: 1 },
    costGold: 0,
    cooldown: 960,
    description: "Ragout + Épée longue + Outils + Besace + Potion endurance → Clé forgée",
  },

  // ════ ALCHIMISTE ════
  {
    id: "craft_extrait",
    name: "Extrait",
    icon: "🫗",
    profession: "Alchimiste",
    tier: 2,
    inputs: [
      { key: "herbes",      quantity: 1 }, // Alchimiste T1 (propre)
      { key: "laine_brute", quantity: 1 }, // Tisserand T1 — filtre
      { key: "minerai_fer", quantity: 1 }, // Mineur T1 — alambic
    ],
    output: { key: "extrait", quantity: 1 },
    costGold: 0,
    cooldown: 120,
    description: "Herbes + Laine (Tisserand, filtre) + Minerai (Mineur, alambic) → 2 extraits",
  },
  {
    id: "craft_potion_soin",
    name: "Potion de soin",
    icon: "🧪",
    profession: "Alchimiste",
    tier: 3,
    inputs: [
      { key: "extrait",quantity: 1 }, // Alchimiste T2 (propre)
      { key: "fil",    quantity: 1 }, // Tisserand T2 — filtre de coton médicinal
      { key: "encre",  quantity: 1 }, // Marchand T2 — étiquette de dosage
    ],
    output: { key: "potion_soin", quantity: 1 },
    costGold: 0,
    cooldown: 240,
    description: "Extrait + Fil (Tisserand, filtre médicinal) + Encre (Marchand, étiquette dosage) → 2 potions de soin",
  },
  {
    id: "craft_potion_endur",
    name: "Potion d'endurance",
    icon: "💪",
    profession: "Alchimiste",
    tier: 4,
    inputs: [
      { key: "potion_soin", quantity: 1 }, // Alchimiste T3
      { key: "pain",        quantity: 1 }, // Fermier T3 — nutriments
      { key: "lingots_or",  quantity: 1 }, // Orfèvre T3 — or colloïdal alchimique
      { key: "parchemin",   quantity: 1 }, // Marchand T3 — formule secrète
    ],
    output: { key: "potion_endur", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Potion soin + Pain (nutriments) + Lingots or (or colloïdal) + Parchemin (formule) → 1 potion d'endurance",
  },
  {
    id: "craft_elixir_discorde",
    name: "Élixir de discorde",
    icon: "☠️",
    profession: "Alchimiste",
    tier: 5,
    inputs: [
      { key: "armure",          quantity: 1 }, // Bûcheron T4
      { key: "outils",          quantity: 1 }, // Mineur T4
      { key: "ragout",          quantity: 1 }, // Fermier T4
      { key: "epee_longue",     quantity: 1 }, // Forgeron T4
      { key: "contrat_artisan", quantity: 1 }, // Marchand T4
    ],
    output: { key: "elixir_discorde", quantity: 1 },
    costGold: 0,
    cooldown: 960,
    description: "Armure + Outils + Ragout + Épée longue + Contrat artisan → Élixir de discorde",
  },

  // ════ ORFÈVRE ════
  {
    id: "craft_quartz_poli",
    name: "Quartz poli",
    icon: "💠",
    profession: "Orfèvre",
    tier: 2,
    inputs: [
      { key: "quartz_brut", quantity: 1 }, // Orfèvre T1 (propre)
      { key: "ble",         quantity: 1 }, // Fermier T1 — pâte de polissage
      { key: "minerai_fer", quantity: 1 }, // Mineur T1 — abrasif
    ],
    output: { key: "quartz_poli", quantity: 1 },
    costGold: 0,
    cooldown: 120,
    description: "Quartz brut + Blé (Fermier, pâte abrasive) + Minerai (Mineur, abrasif) → 2 quartz polis",
  },
  {
    id: "craft_lingots_or",
    name: "Lingot d'or",
    icon: "🪙",
    profession: "Orfèvre",
    tier: 3,
    inputs: [
      { key: "quartz_poli",  quantity: 1 }, // Orfèvre T2 (propre)
      { key: "charbon",      quantity: 1 }, // Forgeron T2 — fusion haute température
      { key: "fil",          quantity: 1 }, // Tisserand T2 — creuset tressé
    ],
    output: { key: "lingots_or", quantity: 1 },
    costGold: 0,
    cooldown: 240,
    description: "Quartz poli + Charbon (Forgeron, fusion) + Fil (Tisserand, creuset tressé) → 1 lingot d'or",
  },
  {
    id: "craft_lingot_raffine",
    name: "Lingot raffiné",
    icon: "🏅",
    profession: "Orfèvre",
    tier: 4,
    requiresBuilding: "fonderie",
    inputs: [
      { key: "lingots_or",  quantity: 1 }, // Orfèvre T3
      { key: "tissu",       quantity: 1 }, // Tisserand T3 — polissage final
      { key: "epee_courte", quantity: 1 }, // Forgeron T3 — acier de moule
      { key: "parchemin",   quantity: 1 }, // Marchand T3 — certificat d'authenticité
    ],
    output: { key: "lingot_raffine", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Lingot or + Tissu (polissage) + Épée courte (moule acier) + Parchemin (certificat) → 1 lingot raffiné [Fonderie]",
  },
  {
    id: "craft_lingot_royal",
    name: "Lingot royal",
    icon: "👑",
    profession: "Orfèvre",
    tier: 5,
    requiresBuilding: "fonderie",
    inputs: [
      { key: "armure",         quantity: 1 }, // Bûcheron T4
      { key: "outils",         quantity: 1 }, // Mineur T4
      { key: "besace",         quantity: 1 }, // Tisserand T4
      { key: "epee_longue",    quantity: 1 }, // Forgeron T4
      { key: "lingot_raffine", quantity: 1 }, // Orfèvre T4
    ],
    output: { key: "lingot_royal", quantity: 1 },
    costGold: 0,
    cooldown: 960,
    description: "Lingot raffiné + Armure + Outils + Besace + Épée longue → Lingot royal [Fonderie]",
  },

  // ════ MARCHAND ════
  {
    id: "craft_encre",
    name: "Encre",
    icon: "🖋️",
    profession: "Marchand",
    tier: 2,
    inputs: [
      { key: "herbes",      quantity: 1 }, // Alchimiste T1 — pigments
      { key: "quartz_brut", quantity: 1 }, // Orfèvre T1 — fixateur minéral
      { key: "laine_brute", quantity: 1 }, // Tisserand T1 — fibre absorbante
    ],
    output: { key: "encre", quantity: 1 },
    costGold: 0,
    cooldown: 120,
    description: "Herbes (pigments) + Quartz (Orfèvre, fixateur) + Laine (Tisserand, fibre) → 3 encres",
  },
  {
    id: "craft_parchemin",
    name: "Parchemin",
    icon: "📜",
    profession: "Marchand",
    tier: 3,
    inputs: [
      { key: "encre",   quantity: 1 }, // Marchand T2 (propre)
      { key: "planches",quantity: 1 }, // Bûcheron T2 — presse à imprimer
      { key: "farine",  quantity: 1 }, // Fermier T2 — pâte à papier
    ],
    output: { key: "parchemin", quantity: 1 },
    costGold: 0,
    cooldown: 240,
    description: "Encre + Planches (Bûcheron, presse) + Farine (Fermier, pâte à papier) → 2 parchemins",
  },
  {
    id: "craft_contrat_artisan",
    name: "Contrat artisan",
    icon: "📋",
    profession: "Marchand",
    tier: 4,
    inputs: [
      { key: "parchemin",   quantity: 1 }, // Marchand T3
      { key: "epee_courte", quantity: 1 }, // Forgeron T3 — sceau de forge
      { key: "meuble",      quantity: 1 }, // Bûcheron T3 — bureau de signature
      { key: "potion_soin", quantity: 1 }, // Alchimiste T3 — cachet d'authenticité
    ],
    output: { key: "contrat_artisan", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Parchemin + Épée courte (sceau de forge) + Meuble (bureau) + Potion soin (cachet alchimique) → 1 contrat artisan",
  },
  {
    id: "craft_contrat_noble",
    name: "Contrat noble",
    icon: "📜",
    profession: "Marchand",
    tier: 5,
    inputs: [
      { key: "contrat_artisan", quantity: 1 }, // Marchand T4
      { key: "armure",          quantity: 1 }, // Bûcheron T4
      { key: "epee_longue",     quantity: 1 }, // Forgeron T4
      { key: "potion_endur",    quantity: 1 }, // Alchimiste T4
      { key: "lingot_raffine",  quantity: 1 }, // Orfèvre T4
    ],
    output: { key: "contrat_noble", quantity: 1 },
    costGold: 200,
    cooldown: 960,
    description: "Contrat artisan + Armure + Épée longue + Potion endurance + Lingot raffiné → Contrat noble",
  },
  {
    id: "craft_lettre_desinformation",
    name: "Lettre de désinformation",
    icon: "✉️",
    profession: "Marchand",
    tier: 5,
    inputs: [
      { key: "armure",         quantity: 1 }, // Bûcheron T4
      { key: "outils",         quantity: 1 }, // Mineur T4
      { key: "besace",         quantity: 1 }, // Tisserand T4
      { key: "epee_longue",    quantity: 1 }, // Forgeron T4
      { key: "lingot_raffine", quantity: 1 }, // Orfèvre T4
    ],
    output: { key: "lettre_desinformation", quantity: 1 },
    costGold: 0,
    cooldown: 960,
    description: "Armure + Outils + Besace + Épée longue + Lingot raffiné → Lettre de désinformation",
  },
];

export default { CRAFTING_RECIPES_REFACTORED };
