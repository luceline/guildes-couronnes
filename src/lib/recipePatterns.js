// ═══════════════════════════════════════════════════════════════
// recipePatterns.js : Schéma strict : T2→T5 patterns
// T2 = 1×T1 propre + 2×T1 d'autres métiers
// T3 = 3×T2 d'autres métiers
// T4 = 4×T3 d'autres métiers
// T5 = 5×T4 d'autres métiers (FIXES : ne pas modifier)
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
    cooldown: 240,
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
      { key: "quartz_poli", quantity: 1 }, // Orfèvre T2 : vernis cristallin
      { key: "pierre_brute",quantity: 1 }, // Mineur T2
    ],
    output: { key: "meuble", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Planches + Quartz poli (Orfèvre, vernis cristallin) + Pierre taillée (Mineur, socle) → 1 meuble",
  },
  {
    id: "craft_armure",
    name: "Tunique de travail",
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
    cooldown: 960,
    description: "Meuble (cadre boisé) + Lingots fer (plaques) + Potion (huile protectrice) + Parchemin (brevet) → 1 Tunique de travail",
  },
  
  {
    id: "craft_etai_recolte",
    name: "Étai de récolte",
    icon: "🪵",
    profession: "Bûcheron",
    tier: 3,
    inputs: [
      { key: "planches", quantity: 1 },
      { key: "charbon", quantity: 1 },
      { key: "farine", quantity: 1 },
    ],
    output: { key: "etai_recolte", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Planches ×1 + Charbon ×1 + Farine ×1 → 1 Étai de récolte",
  },

  // ════ MINEUR ════
  {
    id: "craft_pierre_brute",
    name: "Pierre taillée",
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
    cooldown: 240,
    description: "Minerai + Bois (Bûcheron, étais) + Blé (Fermier, liant) → 2 pierres taillées",
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
      { key: "farine",      quantity: 1 }, // Fermier T2 : liant de creuset
    ],
    output: { key: "lingots_fer", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Charbon (Forgeron, combustible) + Pierre taillée (moule) + Farine (Fermier, liant creuset) → 2 lingots de fer",
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
    cooldown: 960,
    description: "Lingots fer (lames) + Tissu (poignées rembourrées) + Outil multifonction (acier trempé) + Pain (nourriture de chantier) → 2 outils",
  },
  
  {
    id: "craft_pierre_aiguiser",
    name: "Pierre à aiguiser",
    icon: "🪊",
    profession: "Mineur",
    tier: 2,
    inputs: [
      { key: "pierre", quantity: 1 },
      { key: "minerai_fer", quantity: 1 },
      { key: "bois_brut", quantity: 1 },
    ],
    output: { key: "pierre_aiguiser", quantity: 1 },
    costGold: 0,
    cooldown: 240,
    description: "Pierre ×1 + Minerai ×1 + Bois brut ×1 → 1 Pierre à aiguiser",
  },
  {
    id: "craft_marteau_armurier",
    name: "Marteau d'armurier",
    icon: "🔨",
    profession: "Mineur",
    tier: 3,
    inputs: [
      { key: "charbon", quantity: 1 },
      { key: "pierre_brute", quantity: 1 },
      { key: "fil", quantity: 1 },
    ],
    output: { key: "marteau_armurier", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Charbon ×1 + Pierre taillée ×1 + Fil ×1 → 1 Marteau d'armurier",
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
    cooldown: 240,
    description: "Blé + Herbes (Alchimiste, levain) + Laine (Tisserand, filtre) → 3 farines",
  },
  {
    id: "craft_cataplasme_fermier",
    name: "Cataplasme",
    icon: "🩹",
    profession: "Fermier",
    tier: 2,
    inputs: [
      { key: "herbes",    quantity: 1 }, // Alchimiste T1
      { key: "ble",       quantity: 1 }, // Fermier T1 (propre)
      { key: "bois_brut", quantity: 1 }, // Bûcheron T1 (planche, support du cataplasme)
    ],
    output: { key: "cataplasme", quantity: 1 },
    costGold: 0,
    cooldown: 240,
    description: "Herbes (Alchimiste, principe actif) + Blé (mucilage) + Bois (support) → 1 cataplasme (+1❤️)",
  },
  {
    id: "craft_pain",
    name: "Pain",
    icon: "🍞",
    profession: "Fermier",
    tier: 3,
    inputs: [
      { key: "farine",  quantity: 1 }, // Fermier T2
      { key: "extrait", quantity: 1 }, // Alchimiste T2 : levain concentré
      { key: "encre",   quantity: 1 }, // Marchand T2 : cachet de qualité
    ],
    output: { key: "pain", quantity: 1 },
    costGold: 0,
    cooldown: 480,
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
      { key: "lingots_fer", quantity: 1 }, // Mineur T3 : marmite en fer
      { key: "tissu",       quantity: 1 }, // Tisserand T3 : étamine de filtrage
      { key: "potion_soin", quantity: 1 }, // Alchimiste T3 : bouillon fortifiant
    ],
    output: { key: "ragout", quantity: 1 },
    costGold: 0,
    cooldown: 960,
    description: "Pain (base) + Lingots fer (marmite) + Tissu (étamine) + Potion soin (bouillon fortifiant) → 2 ragoûts",
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
    cooldown: 240,
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
      { key: "extrait", quantity: 1 }, // Alchimiste T2 : apprêt chimique
      { key: "planches",quantity: 1 }, // Bûcheron T2 : cadre de métier à tisser
    ],
    output: { key: "tissu", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Fil + Extrait (Alchimiste, apprêt) + Planches (Bûcheron, cadre de tissage) → 2 tissus",
  },
  {
    id: "craft_besace",
    name: "Sac de voyage",
    icon: "🎒",
    profession: "Tisserand",
    tier: 4,
    inputs: [
      { key: "tissu",       quantity: 1 }, // Tisserand T3
      { key: "lingots_fer", quantity: 1 }, // Mineur T3 : armatures
      { key: "lingots_or",  quantity: 1 }, // Orfèvre T3 : fermoirs
      { key: "parchemin",   quantity: 1 }, // Marchand T3 : étiquette officielle
    ],
    output: { key: "besace", quantity: 1 },
    costGold: 0,
    cooldown: 960,
    description: "Tissu + Lingots fer (armatures) + Lingots or (fermoirs dorés) + Parchemin (étiquette) → 1 Sac de voyage",
  },
  
  {
    id: "craft_bandeau_erudit",
    name: "Bandeau d'érudit",
    icon: "🎓",
    profession: "Tisserand",
    tier: 3,
    inputs: [
      { key: "fil", quantity: 1 },
      { key: "farine", quantity: 1 },
      { key: "extrait", quantity: 1 },
    ],
    output: { key: "bandeau_erudit", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Fil ×1 + Farine ×1 + Extrait ×1 → 1 Bandeau d'érudit",
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
    cooldown: 240,
    description: "Pierre + Bois (Bûcheron, combustion) + Laine (Tisserand, soufflet) → 2 charbons",
  },
  {
    id: "craft_epee_courte",
    name: "Outil multifonction",
    icon: "🛠️",
    profession: "Forgeron",
    tier: 3,
    inputs: [
      { key: "charbon",     quantity: 1 }, // Forgeron T2
      { key: "pierre_brute",quantity: 1 }, // Mineur T2
      { key: "quartz_poli", quantity: 1 }, // Orfèvre T2 : abrasif d'affûtage
    ],
    output: { key: "epee_courte", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Charbon (forge) + Pierre taillée + Quartz poli → 1 Outil multifonction (durabilité 10, débloque craft T3).",
  },
  {
    id: "craft_epee_longue",
    name: "Outil multifonction renforcé",
    icon: "⚒️",
    profession: "Forgeron",
    tier: 4,
    inputs: [
      { key: "epee_courte", quantity: 1 }, // Forgeron T3 (propre)
      { key: "tissu",       quantity: 1 }, // Tisserand T3 : garde et poignée
      { key: "lingots_fer", quantity: 1 }, // Mineur T3 : allonge de lame
      { key: "meuble",      quantity: 1 }, // Bûcheron T3 : atelier de forge boisé
    ],
    output: { key: "epee_longue", quantity: 1 },
    costGold: 0,
    cooldown: 960,
    description: "Outil multifonction + Tissu + Lingots fer + Meuble → 1 Outil multifonction renforcé (durabilité 10, débloque craft T5).",
  },
  
  {
    id: "craft_affutage_maitre",
    name: "Affûtage de maître",
    icon: "⚙️",
    profession: "Forgeron",
    tier: 3,
    inputs: [
      { key: "charbon", quantity: 1 },
      { key: "pierre_brute", quantity: 1 },
      { key: "quartz_poli", quantity: 1 },
    ],
    output: { key: "affutage_maitre", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Charbon ×1 + Pierre taillée ×1 + Quartz poli ×1 → 1 Affûtage de maître",
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
      { key: "laine_brute", quantity: 1 }, // Tisserand T1 : filtre
      { key: "minerai_fer", quantity: 1 }, // Mineur T1 : alambic
    ],
    output: { key: "extrait", quantity: 1 },
    costGold: 0,
    cooldown: 240,
    description: "Herbes + Laine (Tisserand, filtre) + Minerai (Mineur, alambic) → 2 extraits",
  },
  {
    id: "craft_cataplasme_alchimiste",
    name: "Cataplasme",
    icon: "🩹",
    profession: "Alchimiste",
    tier: 2,
    inputs: [
      { key: "herbes",    quantity: 1 }, // Alchimiste T1 (propre)
      { key: "ble",       quantity: 1 }, // Fermier T1
      { key: "bois_brut", quantity: 1 }, // Bûcheron T1
    ],
    output: { key: "cataplasme", quantity: 1 },
    costGold: 0,
    cooldown: 240,
    description: "Herbes (principe actif) + Blé (mucilage) + Bois (support) → 1 cataplasme (+1❤️)",
  },
  {
    id: "craft_potion_soin",
    name: "Potion de soin",
    icon: "🧪",
    profession: "Alchimiste",
    tier: 3,
    inputs: [
      { key: "extrait",quantity: 1 }, // Alchimiste T2 (propre)
      { key: "fil",    quantity: 1 }, // Tisserand T2 : filtre de coton médicinal
      { key: "encre",  quantity: 1 }, // Marchand T2 : étiquette de dosage
    ],
    output: { key: "potion_soin", quantity: 1 },
    costGold: 0,
    cooldown: 480,
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
      { key: "pain",        quantity: 1 }, // Fermier T3 : nutriments
      { key: "lingots_or",  quantity: 1 }, // Orfèvre T3 : or colloïdal alchimique
      { key: "parchemin",   quantity: 1 }, // Marchand T3 : formule secrète
    ],
    output: { key: "potion_endur", quantity: 1 },
    costGold: 0,
    cooldown: 960,
    description: "Potion soin + Pain (nutriments) + Lingots or (or colloïdal) + Parchemin (formule) → 1 potion d'endurance",
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
      { key: "ble",         quantity: 1 }, // Fermier T1 : pâte de polissage
      { key: "minerai_fer", quantity: 1 }, // Mineur T1 : abrasif
    ],
    output: { key: "quartz_poli", quantity: 1 },
    costGold: 0,
    cooldown: 240,
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
      { key: "charbon",      quantity: 1 }, // Forgeron T2 : fusion haute température
      { key: "fil",          quantity: 1 }, // Tisserand T2 : creuset tressé
    ],
    output: { key: "lingots_or", quantity: 1 },
    costGold: 0,
    cooldown: 480,
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
      { key: "tissu",       quantity: 1 }, // Tisserand T3 : polissage final
      { key: "epee_courte", quantity: 1 }, // Forgeron T3 : acier de moule
      { key: "parchemin",   quantity: 1 }, // Marchand T3 : certificat d'authenticité
    ],
    output: { key: "lingot_raffine", quantity: 1 },
    costGold: 0,
    cooldown: 960,
    description: "Lingot or + Tissu (polissage) + Outil multifonction (moule acier) + Parchemin (certificat) → 1 lingot raffiné [Fonderie]",
  },
  
  {
    id: "craft_bon_tresor_orfevre",
    name: "Bon du Trésor",
    icon: "💼",
    profession: "Orfèvre",
    tier: 3,
    inputs: [
      { key: "quartz_poli", quantity: 1 },
      { key: "encre", quantity: 1 },
      { key: "fil", quantity: 1 },
    ],
    output: { key: "bon_tresor", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Quartz poli ×1 + Encre ×1 + Fil ×1 → 1 Bon du Trésor",
  },

  // ════ MARCHAND ════
  {
    id: "craft_encre",
    name: "Encre",
    icon: "🖋️",
    profession: "Marchand",
    tier: 2,
    inputs: [
      { key: "herbes",      quantity: 1 }, // Alchimiste T1 : pigments
      { key: "quartz_brut", quantity: 1 }, // Orfèvre T1 : fixateur minéral
      { key: "laine_brute", quantity: 1 }, // Tisserand T1 : fibre absorbante
    ],
    output: { key: "encre", quantity: 1 },
    costGold: 0,
    cooldown: 240,
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
      { key: "planches",quantity: 1 }, // Bûcheron T2 : presse à imprimer
      { key: "farine",  quantity: 1 }, // Fermier T2 : pâte à papier
    ],
    output: { key: "parchemin", quantity: 1 },
    costGold: 0,
    cooldown: 480,
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
      { key: "epee_courte", quantity: 1 }, // Forgeron T3 : sceau de forge
      { key: "meuble",      quantity: 1 }, // Bûcheron T3 : bureau de signature
      { key: "potion_soin", quantity: 1 }, // Alchimiste T3 : cachet d'authenticité
    ],
    output: { key: "contrat_artisan", quantity: 1 },
    costGold: 0,
    cooldown: 960,
    description: "Parchemin + Outil multifonction (sceau de forge) + Meuble (bureau) + Potion soin (cachet alchimique) → 1 contrat artisan",
  },
    
  {
    id: "craft_bon_tresor_marchand",
    name: "Bon du Trésor",
    icon: "💼",
    profession: "Marchand",
    tier: 3,
    inputs: [
      { key: "encre", quantity: 1 },
      { key: "quartz_poli", quantity: 1 },
      { key: "planches", quantity: 1 },
    ],
    output: { key: "bon_tresor", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Encre ×1 + Quartz poli ×1 + Planches ×1 → 1 Bon du Trésor",
  },
  {
    id: "craft_carnet_commande",
    name: "Carnet de commande",
    icon: "📒",
    profession: "Marchand",
    tier: 3,
    inputs: [
      { key: "encre", quantity: 1 },
      { key: "farine", quantity: 1 },
      { key: "planches", quantity: 1 },
    ],
    output: { key: "carnet_commande", quantity: 1 },
    costGold: 0,
    cooldown: 480,
    description: "Encre ×1 + Farine ×1 + Planches ×1 → 1 Carnet de commande",
  },

  // ════════════════════════════════════════════════
  // T1 COMBAT : items équipables (Forgeron + Tisserand)
  // 3 ressources T1 simples → 1 item au grade 0
  // ════════════════════════════════════════════════

  // ── ARME (Forgeron) : 1 seule arme universelle (Phase 3 Option B) ──
  {
    id: "craft_epee",
    name: "Épée",
    icon: "⚔️",
    profession: "Forgeron",
    tier: 1,
    inputs: [
      { key: "minerai_fer",  quantity: 1 },
      { key: "bois_brut",    quantity: 1 },
      { key: "pierre",       quantity: 1 },
    ],
    output: { key: "epee", quantity: 1 },
    costGold: 0,
    cooldown: 60,
    description: "Minerai + Bois + Pierre → 1 Épée (grade 0).",
  },

  // ── BOUCLIER (Forgeron) : défense additionnelle V2 ──
  // Recette identique à l'épée (1 fer + 1 bois + 1 pierre) : premium symétrique.
  {
    id: "craft_bouclier",
    name: "Bouclier",
    icon: "🛡️",
    profession: "Forgeron",
    tier: 1,
    inputs: [
      { key: "minerai_fer",  quantity: 1 }, // Mineur : plaques
      { key: "bois_brut",    quantity: 1 }, // Bûcheron : arçon
      { key: "pierre",       quantity: 1 }, // Mineur : boss central
    ],
    output: { key: "bouclier", quantity: 1 },
    costGold: 0,
    cooldown: 60,
    description: "Fer + Bois + Pierre → 1 Bouclier (grade 0). Permet de défendre une 2e zone en PvP comme en biome.",
  },

  // ── DÉFENSE (Tisserand) ──
  {
    id: "craft_heaume",
    name: "Heaume",
    icon: "🪖",
    profession: "Tisserand",
    tier: 1,
    inputs: [
      { key: "laine_brute",  quantity: 1 },
      { key: "minerai_fer",  quantity: 1 },
      { key: "bois_brut",    quantity: 1 },
    ],
    output: { key: "heaume", quantity: 1 },
    costGold: 0,
    cooldown: 60,
    description: "Laine + Minerai + Bois → 1 Heaume (grade 0).",
  },
  {
    id: "craft_cuirasse",
    name: "Cuirasse",
    icon: "🛡️",
    profession: "Tisserand",
    tier: 1,
    inputs: [
      { key: "laine_brute",  quantity: 2 },
      { key: "minerai_fer",  quantity: 1 },
    ],
    output: { key: "cuirasse", quantity: 1 },
    costGold: 0,
    cooldown: 60,
    description: "2 Laines + Minerai → 1 Cuirasse (grade 0).",
  },
  {
    id: "craft_brassard",
    name: "Brassard",
    icon: "🛡️",
    profession: "Tisserand",
    tier: 1,
    inputs: [
      { key: "laine_brute",  quantity: 1 },
      { key: "minerai_fer",  quantity: 1 },
      { key: "herbes",       quantity: 1 },
    ],
    output: { key: "brassard", quantity: 1 },
    costGold: 0,
    cooldown: 60,
    description: "Laine + Minerai + Herbes → 1 Brassard (grade 0).",
  },
  {
    id: "craft_jambiere",
    name: "Jambière",
    icon: "🦵",
    profession: "Tisserand",
    tier: 1,
    inputs: [
      { key: "laine_brute",  quantity: 1 },
      { key: "bois_brut",    quantity: 1 },
      { key: "minerai_fer",  quantity: 1 },
    ],
    output: { key: "jambiere", quantity: 1 },
    costGold: 0,
    cooldown: 60,
    description: "Laine + Bois + Minerai → 1 Jambière (grade 0).",
  },
];

export default { CRAFTING_RECIPES_REFACTORED };
