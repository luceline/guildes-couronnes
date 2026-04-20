// Game constants and helper data

// ── Admin access list ──
export const ADMIN_EMAILS = [
  "lucas.brunet51@gmail.com",
  "lucas.brunet51@hotmail.fr",
];

export const PROFESSIONS = {
  Bûcheron:   { icon: "🪓", description: "Source principale de bois, chanvre et charbon. Fournit Forgeron, Orfèvre, Tisserand et Marchand en matières premières.",
    startItems: [{ item_key: "bois_brut",   item_name: "Bois brut",   item_category: "bois",      quantity: 20 }] },
  Mineur:     { icon: "⛏️", description: "Extrait pierre et minerai pour le Forgeron, et polit le quartz brut de l'Orfèvre — clé indispensable pour les lingots d'or.",
    startItems: [{ item_key: "pierre_brute", item_name: "Pierre brute", item_category: "pierre",   quantity: 16 },
                 { item_key: "minerai_fer",  item_name: "Minerai de fer", item_category: "fer",     quantity: 8 }] },
  Fermier:    { icon: "🐄", description: "Hub central. Produit la nourriture qui maintient la faim de tous les joueurs. Sans lui, personne ne peut agir longtemps.",
    startItems: [{ item_key: "ble",         item_name: "Blé",         item_category: "nourriture", quantity: 20 },
                 { item_key: "laine_brute", item_name: "Laine brute", item_category: "tissu",      quantity: 8 }] },
  Tisserand:  { icon: "🧵", description: "File la laine du Fermier en tissu, fabrique besaces et équipements.",
    startItems: [{ item_key: "laine_brute", item_name: "Laine brute", item_category: "tissu",      quantity: 16 }] },
  Forgeron:   { icon: "⚒️", description: "Fond le minerai du Mineur en lingots, forge les outils dont tous les métiers ont besoin pour produire plus vite.",
    startItems: [{ item_key: "minerai_fer", item_name: "Minerai de fer", item_category: "fer",     quantity: 12 },
                 { item_key: "planches",    item_name: "Planches",    item_category: "bois",       quantity: 6 }] },
  Alchimiste: { icon: "⚗️", description: "Distille herbes en extraits, puis en potions. Seul à craft les potions.",
    startItems: [{ item_key: "herbes",      item_name: "Herbes",      item_category: "potions",    quantity: 12 }] },
  Orfèvre:    { icon: "🏅", description: "Seul à produire des lingots d'or — mais dépend du Mineur (quartz poli), du Forgeron (lingots fer) et du Bûcheron (charbon).",
    startItems: [{ item_key: "quartz_brut", item_name: "Quartz brut", item_category: "or",         quantity: 12 },
                 { item_key: "charbon",     item_name: "Charbon",     item_category: "fer",        quantity: 4 }] },
  Marchand:   { icon: "🏪", description: "Organise convois et contrats. Récupère 50% des taxes sur ses propres ventes.",
    startItems: [{ item_key: "tissu",       item_name: "Tissu",       item_category: "tissu",      quantity: 10 },
                 { item_key: "planches",    item_name: "Planches",    item_category: "bois",       quantity: 8 }] },
};

export const ITEM_CATEGORIES = {
  bois:       { icon: "🪵", color: "text-amber-700" },
  pierre:     { icon: "🪨", color: "text-stone-500" },
  fer:        { icon: "⚙️", color: "text-gray-600" },
  nourriture: { icon: "🍞", color: "text-yellow-600" },
  tissu:      { icon: "🧶", color: "text-purple-600" },
  outils:     { icon: "🔧", color: "text-blue-600" },
  armes:      { icon: "⚔️", color: "text-red-600" },
  armures:    { icon: "🥋", color: "text-slate-600" },
  potions:    { icon: "🧪", color: "text-green-600" },
  parchemins: { icon: "📜", color: "text-amber-600" },
  meubles:    { icon: "🪑", color: "text-orange-700" },
  or:         { icon: "🏅", color: "text-yellow-500" },
  ressources_rares: { icon: "✨", color: "text-violet-600" },
};

export const HOUSING_MAINTENANCE = {
  tente: 2, cabane: 3, maison: 12, manoir: 45,
};

export const HOUSING = {
  tente:  { name: "Tente",   cost: 0,    icon: "⛺", capacity: 30,  maxFatigue: 20 },
  cabane: { name: "Cabane",  cost: 200,  icon: "🛖", capacity: 60,  maxFatigue: 45 },
  maison: { name: "Maison",  cost: 800,  icon: "🏠", capacity: 90,  maxFatigue: 50 },
  manoir: { name: "Manoir",  cost: 3000, icon: "🏰", capacity: 120, maxFatigue: 60 },
};

// ─────────────────────────────────────────────
// SYSTÈME DE FAIM
// La faim va de 0 à MAX_HUNGER.
// Chaque action (production, voyage, craft) consomme 1 point de faim.
// Sous HUNGER_WARNING_THRESHOLD : coût fatigue +1 par action.
// À 0 : impossible d'agir.
// Se restaure uniquement en consommant des items alimentaires.
// ─────────────────────────────────────────────
export const MAX_HUNGER = 10;
export const HUNGER_WARNING_THRESHOLD = 3; // En dessous : pénalité fatigue
// Regen faim : UNIQUEMENT via consommables ou bâtiments (Fontaine/Hospice/Cathédrale)
export const FATIGUE_REGEN_INTERVAL_MS = 7200000; // valeur par défaut (maison) — voir getFatigueRegenInterval

// Regen énergie liée au logement : tente = 1h, cabane = 50min, maison = 40min, manoir = 30min
export function getFatigueRegenInterval(housingLevel) {
  const intervals = {
    tente:  3600000,   // 1 heure
    cabane: 3000000,   // 50 minutes
    maison: 2400000,   // 40 minutes
    manoir: 1800000,   // 30 minutes
  };
  return intervals[housingLevel] || 3600000; // fallback tente
}

// Items qui restaurent la faim (définis ici pour être accessibles partout)
export const HUNGER_FOOD_ITEMS = {
  ble:     { hunger_restore: 1, label: "Blé",     icon: "🌾" },
  farine:  { hunger_restore: 5, label: "Farine",  icon: "🧺" },
  pain:    { hunger_restore: 5, label: "Pain",     icon: "🍞" },
  ragout:  { hunger_restore: 10, label: "Ragoût",  icon: "🍲" },
  potion_endur: { hunger_restore: 2, label: "Potion d'endurance", icon: "💪" },
};

// ─────────────────────────────────────────────
// SYSTÈME D'ITEMS COMPÉTITIFS INTER-VILLES
// Chaque item a : un crafteur, un coût en faim à l'utilisation,
// un effet, une ville cible, et un délai d'activation (minuit suivant).
// Plafond : 1 item offensif par joueur par ville cible par jour.
// ─────────────────────────────────────────────
export const COMPETITIVE_ITEMS = {
  // ── T5 JCJ — 1 par profession ──
  huile_inflammable: {
    name: "Huile inflammable", icon: "🔥", category: "parchemins",
    craftedBy: ["Bûcheron"], hungerCost: 5, mayorOnly: false,
    effect: "disable_building",
    effectValue: { duration: 1 },
    counterBuilding: "caserne",
    description: "Détruit un bâtiment aléatoire de la ville adverse. Contre-mesure : Guilde des voyageurs.",
    delay: true,
    tavernMessage: "🔥 Un bâtiment a subi d'étranges dégâts cette nuit...",
  },
  poudre_corrosive: {
    name: "Poudre corrosive", icon: "💥", category: "parchemins",
    craftedBy: ["Mineur"], hungerCost: 5, mayorOnly: false,
    effect: "destroy_warehouse_stock",
    effectValue: { min: 10, max: 20 },
    counterBuilding: "entrepot_fortifie",
    description: "Détruit 80% des unités d'une ressource aléatoire de l'entrepôt ennemi. Contre-mesure : Entrepôt fortifié.",
    delay: true,
    tavernMessage: "💥 Des stocks ont été retrouvés endommagés...",
  },
  festin_empoisonne: {
    name: "Festin empoisonné", icon: "🍖", category: "nourriture",
    craftedBy: ["Fermier"], hungerCost: 5, mayorOnly: false,
    effect: "hunger_max_malus",
    effectValue: { reduction: 3, duration: 2 },
    counterBuilding: "hospice",
    description: "Récupération de faim = −5⚡ supplémentaires pendant 2j pour les résidents. Contre-mesure : Hospice.",
    delay: true,
    tavernMessage: "🤢 Plusieurs habitants se sentent faibles depuis hier...",
  },
  faux_contrat: {
    name: "Faux contrat", icon: "📄", category: "parchemins",
    craftedBy: ["Tisserand"], hungerCost: 5, mayorOnly: false,
    effect: "blind_travel",
    effectValue: { duration: 2 },
    counterBuilding: "guilde_marchands",
    description: "Pendant 2j les résidents de la ville cible voyagent à l'aveugle (destinations des routes inconnues). Contre-mesure : Guilde des marchands.",
    delay: true,
    tavernMessage: "📄 Des rumeurs de faux contrats sèment la confusion parmi les voyageurs...",
  },
  cle_forgee: {
    name: "Clé forgée", icon: "🗝️", category: "parchemins",
    craftedBy: ["Forgeron"], hungerCost: 5, mayorOnly: false,
    effect: "steal_treasury",
    effectValue: { pct: 0.20 },
    counterBuilding: "coffre_fort",
    description: "🗝️ Vole 20% des lingots stockés à la mairie ennemie (classement inter-villes). Contre-mesure : Coffre-fort.",
    delay: true,
    tavernMessage: "🗝️ Le coffre de la ville a été partiellement vidé...",
  },
  elixir_discorde: {
    name: "Élixir de discorde", icon: "☠️", category: "potions",
    craftedBy: ["Alchimiste"], hungerCost: 5, mayorOnly: false,
    effect: "redirect_taxes",
    effectValue: { duration: 2 },
    counterBuilding: "scriptorium",
    description: "Les taxes de la ville cible sont détournées vers votre ville pendant 2j. Contre-mesure : Scriptorium.",
    delay: true,
    tavernMessage: "📜 Des rumeurs ont semé le doute parmi les marchands...",
  },
  lettre_desinformation: {
    name: "Lettre de désinformation", icon: "✉️", category: "parchemins",
    craftedBy: ["Marchand"], hungerCost: 5, mayorOnly: false,
    effect: "tax_loss",
    effectValue: 0.30,
    counterBuilding: "tour_guet",
    description: "+30% de taxes sur la ville cible pendant 2j. Contre-mesure : Tour de guet.",
    delay: true,
    tavernMessage: "📰 Des nouvelles troublantes circulent en ville...",
  },
  rapport_commerce: {
    name: "Rapport de commerce", icon: "🔍", category: "parchemins",
    craftedBy: ["Marchand"], hungerCost: 2, mayorOnly: false,
    effect: "reveal_warehouse",
    effectValue: 24,
    counterBuilding: "tour_guet",
    description: "Révèle le contenu de l'entrepôt d'une ville pendant 24h.",
    delay: false,
  },

  traite_commercial: {
    name: "Traité commercial", icon: "🤝", category: "parchemins",
    craftedBy: ["Marchand"], hungerCost: 2, mayorOnly: true,
    effect: "travel_discount_mutual",
    effectValue: { reduction: 0.50, duration: 3 },
    description: "−50% frais voyage entre deux villes pendant 3 jours.",
    delay: false,
  },
  rumors: {
    name: "Rumors", icon: "📰", category: "parchemins",
    craftedBy: ["Marchand"], hungerCost: 3, mayorOnly: false,
    effect: "tax_increase",
    effectValue: { increase: 0.10, duration: 1 },
    counterBuilding: "bibliotheque",
    description: "Augmente les taxes d'une ville ennemie de 10% pendant 1 jour.",
    delay: true,
    tavernMessage: "📣 Des rumeurs troublantes circulent et perturbent les collectes...",
  },
  // ── T1.5 Items (nouveaux) ──
  camouflage: {
    name: "Camouflage", icon: "👻", category: "parchemins",
    craftedBy: ["Bûcheron", "Mineur", "Fermier", "Tisserand", "Forgeron", "Alchimiste", "Orfèvre", "Marchand"], hungerCost: 2, mayorOnly: false,
    effect: "steal_anonymously",
    effectValue: { duration: 1 },
    description: "👻 Prochain vol anonyme : votre nom n'apparaît pas dans la taverne adverse. Consommé automatiquement lors du vol. Craftable par toutes les professions.",
    delay: false,
  },
  tracts_greve: {
    name: "Tracts de Grève", icon: "⚡", category: "parchemins",
    craftedBy: ["Bûcheron", "Mineur", "Fermier", "Tisserand", "Forgeron", "Alchimiste", "Orfèvre", "Marchand"], hungerCost: 2, mayorOnly: false,
    effect: "production_cooldown_malus",
    effectValue: { increase: 0.20, duration: 1 },
    description: "⚡ +20% cooldowns de production pour tous les habitants de la VILLE CIBLE pendant 24h. Utiliser en page Ville (panneau Attaque).",
    delay: true,
    tavernMessage: "⚡ Une grève sauvage paralyse les productions de la ville...",
  },
  bourse_protection: {
    name: "Bourse de protection", icon: "👜", category: "parchemins",
    craftedBy: ["Bûcheron", "Mineur", "Fermier", "Tisserand", "Forgeron", "Alchimiste", "Orfèvre", "Marchand"], hungerCost: 0, mayorOnly: false,
    effect: "steal_cap",
    effectValue: { max_stolen: 100, durability: 3 },
    description: "👜 Durabilité 3 — vous ne pouvez pas perdre plus de 100 or lors d'un vol. Se dégrade à chaque vol subi (réussi).",
    delay: false,
  },
  blocus: {
    name: "Blocus", icon: "🚧", category: "parchemins",
    craftedBy: ["Forgeron"], hungerCost: 3, mayorOnly: true,
    effect: "blocus",
    effectValue: { fatigueCost: 2, duration: 2 },
    counterBuilding: "remparts",
    description: "Augmente le coût de voyage vers une ville ennemie pendant 2 jours.",
    delay: true,
    tavernMessage: "🚧 Des routes sont bloquées aux alentours...",
  },
};

// Get total inventory weight (1 unit = 1 weight regardless of item type)
export function getInventoryWeight(profile) {
  return (profile.inventory || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
}

// Get max inventory capacity for a profile based on housing
// ── Bonus passif inventaire (non cumulable — meilleur bonus) ──
export function getPassiveCooldownBonus(profile) {
  const inv = profile.inventory || [];
  // Planches T2 : −20% cooldown passif (meilleur entre passif et temporaire)
  const hasPassif = inv.some(i => i.item_key === "planches" && (i.quantity || 0) > 0);
  const passifValue = hasPassif ? 0.20 : 0;
  const tempValue = getTemporaryCooldownBonus(profile);
  return Math.max(passifValue, tempValue);
}

export function getPassiveEnergyMaxBonus(profile) {
  const inv = profile.inventory || [];
  // pierre_brute T2 : +5, lingots_fer T3 : +10 (meilleur actif)
  let best = 0;
  if (inv.some(i => i.item_key === "lingots_fer" && (i.quantity || 0) > 0)) best = Math.max(best, 10);
  if (inv.some(i => i.item_key === "pierre_brute" && (i.quantity || 0) > 0)) best = Math.max(best, 5);
  // Comparer avec bonus temporaire
  return Math.max(best, getTemporaryEnergyMaxBonus(profile));
}

export function getPassiveInventoryBonus(profile) {
  const inv = profile.inventory || [];
  // tissu T3 : +60, fil T2 : +40 (meilleur actif)
  let best = 0;
  if (inv.some(i => i.item_key === "tissu" && (i.quantity || 0) > 0)) best = Math.max(best, 60);
  if (inv.some(i => i.item_key === "fil" && (i.quantity || 0) > 0)) best = Math.max(best, 40);
  // Comparer avec bonus temporaire
  return Math.max(best, getTemporaryInventoryBonus(profile));
}

export function getMaxWeight(profile) {
  return (HOUSING[profile.housing_level || "tente"]?.capacity || 100) + getPassiveInventoryBonus(profile);
}

// Get max fatigue for a profile based on housing
export function getMaxFatigue(profile, cityFatigueBonus = 0) {
  const base = (HOUSING[profile.housing_level || "tente"]?.maxFatigue || 80) + cityFatigueBonus;
  const epidemieMalus = (profile.epidemie_malus_until && new Date(profile.epidemie_malus_until) > new Date()) ? -3 : 0;
  return Math.max(5, base + getPassiveEnergyMaxBonus(profile) + epidemieMalus);
}

// Get effective max weight (with convoi bonus if active)
export function getEffectiveMaxWeight(profile) {
  const base = getMaxWeight(profile);
  if (profile.convoi_expires_at && new Date(profile.convoi_expires_at) > new Date()) {
    return base * 2;
  }
  return base;
}

// Check if adding qty units would exceed capacity
export function wouldExceedCapacity(profile, qty) {
  return getInventoryWeight(profile) + qty > getEffectiveMaxWeight(profile);
}

// ── Getters faim ──
export function getHunger(profile) {
  return profile.hunger ?? MAX_HUNGER; // par défaut plein si champ absent
}

export function isHungry(profile) {
  return getHunger(profile) <= 0;
}

export function hasHungerPenalty(profile) {
  return getHunger(profile) < HUNGER_WARNING_THRESHOLD;
}

// Coût réel en fatigue d'une action selon l'état de faim
export function getActionFatigueCost(profile, baseCost = 1) {
  if (hasHungerPenalty(profile)) return baseCost + 1;
  return baseCost;
}

// ─────────────────────────────────────────────
// BUILDING TYPES — complete system
// ─────────────────────────────────────────────
export const BUILDING_TYPES = {

  // ── Logement ──
  maison: {
    name: "Maison", icon: "🏠",
    category: "logement",
    popBonus: 2,
    stackable: true, unique: false,
    costBase: { bois_brut: 20, pierre: 10 },
    maintenance: { bois_brut: 1, or: 1 },
    effect: "+2 emplacements de population par maison construite.",
    functionType: "population",
  },
  quartier: {
    name: "Quartier résidentiel", icon: "🏘️",
    category: "logement",
    popBonus: 5,
    stackable: true, unique: false,
    costBase: { bois_brut: 50, pierre: 30, minerai_fer: 10 },
    maintenance: { quartz_poli: 1, or: 2 },
    effect: "+5 emplacements de population.",
    functionType: "population",
  },
  manoir_ville: {
    name: "Manoir seigneurial", icon: "🏯",
    category: "logement",
    popBonus: 10,
    stackable: false, unique: true,
    costBase: { pierre: 60, minerai_fer: 30, or: 15 },
    maintenance: { pierre_brute: 1, or: 3 },
    effect: "+10 emplacements de population. Réduit l'impôt journalier de 1 💰 pour tous les habitants.",
    functionType: "population",
  },

  // ── Production ──
  scierie: {
    name: "Scierie", icon: "🌲",
    category: "production",
    popBonus: 0,
    stackable: true, unique: false,
    costBase: { bois_brut: 30, pierre: 15, minerai_fer: 5 },
    maintenance: { planches: 1, or: 1 },
    effect: "+2 bois brut par action au niveau 1, jusqu'à +5 au niveau 5. Coût et entretien doublent à chaque niveau.",
    functionType: "production_bonus", functionValue: 25, targetProfession: "Bûcheron",
  },
  mine: {
    name: "Mine", icon: "⛏️",
    category: "production",
    popBonus: 0,
    stackable: true, unique: false,
    costBase: { pierre: 40, bois_brut: 15, minerai_fer: 10 },
    maintenance: { pierre_brute: 1, or: 1 },
    effect: "+1 minerai de fer par action au niveau 1, jusqu'à +5 au niveau 5. Coût et entretien doublent.",
    functionType: "production_bonus", functionValue: 25, targetProfession: "Mineur",
  },
  moulin: {
    name: "Moulin", icon: "🌾",
    category: "production",
    popBonus: 0,
    stackable: true, unique: false,
    costBase: { bois_brut: 25, pierre: 10 },
    maintenance: { farine: 1, or: 1 },
    effect: "−1 faim par action pour le Fermier. Bonus blé : +1/action (niv.1) à +5/action (niv.5). Coût et entretien doublent.",
    functionType: "production_bonus", functionValue: 50, targetProfession: "Fermier" },
  bergerie: {
    name: "Bergerie", icon: "🐑",
    category: "production",
    popBonus: 0,
    stackable: true, unique: false,
    costBase: { bois_brut: 20, ble: 15 },
    maintenance: { fil: 1, or: 1 },
    effect: "+2 laine brute par tonte au niveau 1, jusqu'à +5 au niveau 5. Coût et entretien doublent.",
    functionType: "production_bonus", functionValue: 25, targetProfession: "Fermier",
  },
  laboratoire: {
    name: "Laboratoire", icon: "⚗️",
    category: "production",
    popBonus: 0,
    stackable: true, unique: false,
    costBase: { pierre: 30, bois_brut: 15, herbes: 8 },
    maintenance: { extrait: 1, or: 1 },
    effect: "−1 faim par action pour l'Alchimiste. Bonus herbes : +1/action (niv.1) à +5/action (niv.5). Coût et entretien doublent.",
    functionType: "production_bonus", functionValue: 25, targetProfession: "Alchimiste",
  },
  fonderie: {
    name: "Fonderie", icon: "🏅",
    category: "production",
    popBonus: 0,
    stackable: true, unique: false,
    costBase: { pierre: 40, minerai_fer: 20, bois_brut: 15 },
    maintenance: { quartz_poli: 1, or: 2 },
    effect: "Réduit le cooldown de craft du Forgeron de 5% (niv.1) à 25% (niv.5). Coût et entretien doublent.",
    functionType: "production_bonus", functionValue: 1, targetProfession: "Forgeron",
  },

  // ── Commerce ──
  taverne: {
    name: "Taverne", icon: "🍺",
    category: "commerce",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 40, pierre: 15, ble: 20 },
    maintenance: { farine: 1, or: 2 },
    effect: "Tchat entre joueurs + possibilité de dormir pour récupérer de l'énergie.",
    functionType: "chat",
  },
  marche: {
    name: "Marché couvert", icon: "🏪",
    category: "commerce",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 30, pierre: 20 },
    maintenance: { encre: 1, or: 2 },
    effect: "Le marché met en surbrillance les produits les mieux placés financièrement.",
    functionType: "market_discount", functionValue: 3,
  },
  route: {
    name: "Route pavée", icon: "🛣️",
    category: "commerce",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 50, bois_brut: 15 },
    maintenance: { pierre_brute: 1, or: 2 },
    effect: "-50% de frais de voyage sur toutes les routes depuis cette ville.",
    functionType: "travel_cost_reduction", functionValue: 50,
  },
  port: {
    name: "Port", icon: "⚓",
    category: "commerce",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 60, minerai_fer: 20, or: 15 },
    maintenance: { planches: 1, fil: 1, or: 3 },
    effect: "Ouvre des routes maritimes depuis cette ville (gratuites mais 5× plus longues).",
    functionType: "maritime_routes",
  },
  relais: {
    name: "Relais postal", icon: "📮",
    category: "commerce",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 25, ble: 8 },
    maintenance: { encre: 1, or: 1 },
    effect: "Permet d'envoyer des ressources à des joueurs dans d'autres villes.",
    functionType: "relay",
  },
  comptoir: {
    name: "Comptoir bancaire", icon: "🏦",
    category: "commerce",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 35, bois_brut: 15, or: 10 },
    maintenance: { charbon: 1, or: 2 },
    effect: "Débloque la Banque de ville : le maire peut fixer des taux de prêt et de dépôt pour les résidents.",
    functionType: "bank",
  },

  // ── Bien-être ──
  hospice: {
    name: "Hospice", icon: "🏥",
    category: "bien_etre",
    popBonus: 0,
    stackable: true, unique: false,
    costBase: { laine_brute: 8, minerai_fer: 8, bois_brut: 8, quartz_brut: 6, ble: 6, herbes: 6, pierre: 6 },
    maintenance: { extrait: 1, or: 2 },
    effect: "Distribue +2 faim à tous les résidents au reset quotidien (par niveau : +2/+4/+6/+8/+10). Contre-mesure : Festin empoisonné. Coût et entretien doublent.",
    functionType: "hunger_max_bonus", functionValue: 2,
  },
  eglise: {
    name: "Église", icon: "⛪",
    category: "bien_etre",
    popBonus: 0,
    stackable: true, unique: false,
    costBase: { pierre: 60, bois_brut: 30, or: 10 },
    maintenance: { fil: 1, or: 2 },
    effect: "+10 énergie max (niveau 1), +20 (niv.2), +30 (niv.3), +40 (niv.4), +50 (niv.5). Coût et entretien doublent.",
    functionType: "fatigue_max_bonus", functionValue: 10,
  },
  fontaine: {
    name: "Fontaine", icon: "💧",
    category: "bien_etre",
    popBonus: 0,
    stackable: true, unique: false,
    costBase: { pierre: 25, bois_brut: 8 },
    maintenance: { extrait: 1, or: 1 },
    effect: "Regen de faim passive ×2. Coût et entretien doublent à chaque tier.",
    functionType: "hunger_regen_boost",
  },
  bibliotheque: {
    name: "Bibliothèque", icon: "📚",
    category: "bien_etre",
    popBonus: 0,
    stackable: true, unique: false,
    costBase: { bois_brut: 40, ble: 15 },
    maintenance: { encre: 1, or: 2 },
    effect: "+30 capacité inventaire (niveau 1), +31 (niv.2), +32 (niv.3), +33 (niv.4), +34 (niv.5).",
    functionType: "inventory_bonus", functionValue: 30,
  },
  grenier: {
    name: "Grenier", icon: "🌾",
    category: "bien_etre",
    popBonus: 0,
    stackable: true, unique: false,
    costBase: { bois_brut: 30, ble: 20, quartz_brut: 4 },
    maintenance: { farine: 1, or: 1 },
    effect: "Distribue automatiquement 1 blé/jour aux résidents. Coût et entretien doublent à chaque tier.",
    functionType: "bread_auto_distribution", functionValue: 1,
  },

  // ── Défense (coût réduit — 20-25 par T1 sélectionné, pas 50 de chaque) ──
  tour_guet: {
    name: "Tour de guet", icon: "🗼",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "Bloque une attaque Lettre de désinformation. Se détruit après avoir absorbé l'attaque.",
    functionType: "alert",
    counters: "lettre_desinformation",
  },
  remparts: {
    name: "Mur d'enceinte", icon: "🏰",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "Chaque visiteur entrant dans la ville paye un péage de 1 💰 (versé à la trésorerie). Bloque aussi une attaque Blocus et se détruit après l'avoir absorbée.",
    functionType: "wall_defense",
    counters: "blocus",
  },
  caserne: {
    name: "Guilde des voyageurs", icon: "🧭",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "Bloque une attaque Huile inflammable et se détruit après l'avoir absorbée.",
    functionType: "guild_travel_defense",
    counters: "huile_inflammable",
  },
  coffre_fort: {
    name: "Coffre-fort", icon: "🔒",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "Bloque une attaque Clé forgée. Se détruit après avoir absorbé l'attaque.",
    functionType: "treasury_defense",
    counters: "cle_forgee",
  },
  scriptorium: {
    name: "Scriptorium", icon: "✍️",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "Bloque une attaque Élixir de discorde. Se détruit après avoir absorbé l'attaque.",
    functionType: "anti_propaganda_defense",
    counters: "elixir_discorde",
  },
  entrepot_fortifie: {
    name: "Entrepôt fortifié", icon: "🏗️",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "Bloque une attaque Poudre corrosive. Se détruit après avoir absorbé l'attaque.",
    functionType: "warehouse_defense",
    counters: "poudre_corrosive",
  },
  guilde_marchands: {
    name: "Guilde des marchands", icon: "🏛️",
    category: "defense",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { bois_brut: 50, pierre: 50, minerai_fer: 50, ble: 50, laine_brute: 50, herbes: 50, quartz_brut: 50 },
    maintenance: {},
    effect: "Bloque une attaque Faux contrat. Se détruit après avoir absorbé l'attaque.",
    functionType: "guild_defense",
    counters: "faux_contrat",
  },

  // ── Prestige ──
  universite: {
    name: "Université", icon: "🎓",
    category: "prestige",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 80, bois_brut: 40, ble: 20, or: 20 },
    maintenance: { quartz_poli: 1, farine: 1, or: 3 },
    effect: "+1 faim max pour tous les habitants de la ville.",
    functionType: "hunger_max_bonus", functionValue: 1,
  },
  palais: {
    name: "Palais", icon: "👑",
    category: "prestige",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 100, bois_brut: 60, or: 30, laine_brute: 20 },
    maintenance: { charbon: 1, tissu: 1, or: 4 },
    effect: "+1 or distribué chaque jour à chaque résident de la ville (sans condition).",
    functionType: "daily_gold_per_resident", functionValue: 1,
  },
  grande_place: {
    name: "Grande Place", icon: "🏟️",
    category: "prestige",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 60, bois_brut: 40, or: 15 },
    maintenance: { encre: 1, pierre_brute: 1, or: 2 },
    effect: "+20 unités de capacité inventaire pour tous les habitants de la ville.",
    functionType: "inventory_bonus", functionValue: 20,
  },
  cathedrale: {
    name: "Cathédrale", icon: "🌟",
    category: "prestige",
    popBonus: 0,
    stackable: false, unique: true,
    costBase: { pierre: 120, bois_brut: 50, or: 40, herbes: 15 },
    maintenance: { fil: 1, extrait: 1, or: 4 },
    effect: "+10 énergie max et +2 faim max pour tous les habitants. Distribue aussi +3 faim au reset quotidien.",
    functionType: "fatigue_max_bonus", functionValue: 10,
  },
};

// ── Mairie ──
// Coût fixe pour devenir maire : 20💰
export const MAYOR_COST_MAX = 20;
export const MAYOR_COST_MAX_PALAIS = 20;
export const MAYOR_DAYS = 10;
export const PROFESSION_CHANGE_COST = 100; // or versé à la mairie

// ── Récompenses connexion quotidienne (modifier ici pour rééquilibrer) ──
export const STREAK_REWARDS = [
  { days: 1,  gold: 5,   label: "1 jour",    icon: "🌱" },
  { days: 2,  gold: 10,  label: "2 jours",   icon: "🌿" },
  { days: 3,  gold: 15,  label: "3 jours",   icon: "🌾" },
  { days: 5,  gold: 25,  label: "5 jours",   icon: "⭐" },
  { days: 7,  gold: 40,  label: "1 semaine", icon: "🔥" },
  { days: 14, gold: 80,  label: "2 semaines",icon: "💎" },
  { days: 30, gold: 150, label: "1 mois",    icon: "👑" },
];

// ── XP par ressource rare échangée/consommée ──
export const RARE_RESOURCE_XP = 100;

// ── Système de durabilité des équipements ──
// EQUIPMENT_KEYS et EQUIPMENT_DURABILITY sont dérivés automatiquement depuis ITEMS dans craftingData.js
// Importer depuis craftingData si nécessaire : import { EQUIPMENT_KEYS, EQUIPMENT_DURABILITY } from "./craftingData.js"
// Conservés ici pour rétrocompatibilité — se synchronisent avec craftingData.ITEMS
export { EQUIPMENT_KEYS, EQUIPMENT_DURABILITY } from "./craftingData.js";
import { ITEMS as ITEMS_DEF } from "./craftingData.js";
export const EQUIPMENT_MAX_DURABILITY = 5;

// Score d'attaque : epee_courte +1, epee_longue +2
// + bonus temporaire consommable (pierre T1, charbon T2) via attack_bonus_expires_at
export function getAttackScore(profile) {
  const inv = profile.inventory || [];
  let score = 0;
  // Lecture dynamique depuis ITEMS — modifier craftingData.js pour changer les valeurs
  for (const invItem of inv) {
    const def = ITEMS_DEF?.[invItem.item_key];
    if (!def) continue;
    if (def.trigger === "durability" && def.effect === "attack_bonus" || def.trigger === "durability" && def.effect === "combat_attack") {
      const dur = invItem.durability ?? def.durability ?? 1;
      if (dur > 0) score += def.value || 0;
    }
  }
  // Bonus temporaire via consommable (pierre T1, charbon T2)
  if (profile.attack_bonus_expires_at && new Date(profile.attack_bonus_expires_at) > new Date()) {
    score += profile.attack_bonus_value || 1;
  }
  return score;
}

// Score de défense : lu dynamiquement depuis ITEMS dans craftingData.js
// + bonus temporaire consommable (laine_brute T1) via defense_bonus_expires_at
export function getDefenseScore(profile) {
  const inv = profile.inventory || [];
  let score = 0;
  // Lecture dynamique depuis ITEMS — modifier craftingData.js pour changer les valeurs
  for (const invItem of inv) {
    const def = ITEMS_DEF?.[invItem.item_key];
    if (!def) continue;
    if (def.trigger === "durability" && (def.effect === "combat_defense" || def.effect === "defense_bonus")) {
      const dur = invItem.durability ?? def.durability ?? 1;
      if (dur > 0) score += def.value || 0;
    }
  }
  // Bonus temporaire via consommable (laine_brute T1)
  if (profile.defense_bonus_expires_at && new Date(profile.defense_bonus_expires_at) > new Date()) {
    score += profile.defense_bonus_value || 2;
  }
  return score;
}

// getCombatScore conservé pour compatibilité (attaque seulement pour le voleur)
export function getCombatScore(profile) {
  return getAttackScore(profile);
}

// ── Bonus énergie max temporaire (minerai T1, pierre_brute T2, lingots_fer T3) ──
export function getTemporaryEnergyMaxBonus(profile) {
  if (profile.energy_max_bonus_expires_at && new Date(profile.energy_max_bonus_expires_at) > new Date()) {
    return profile.energy_max_bonus_value || 0;
  }
  return 0;
}

// ── Bonus inventaire temporaire (laine_brute T1, fil T2, tissu T3) ──
export function getTemporaryInventoryBonus(profile) {
  if (profile.inventory_bonus_expires_at && new Date(profile.inventory_bonus_expires_at) > new Date()) {
    return profile.inventory_bonus_value || 0;
  }
  return 0;
}

// ── Réduction cooldown production temporaire (bois_brut T1, planches T2, meuble T3 + bonus biome) ──
export function getTemporaryCooldownBonus(profile) {
  let bonus = 0;
  
  // Bonus cooldown items (planches, meuble, etc)
  if (profile.cooldown_bonus_expires_at && new Date(profile.cooldown_bonus_expires_at) > new Date()) {
    bonus = Math.max(bonus, profile.cooldown_bonus_value || 0);
  }
  
  // Bonus cooldown biome (-15% si victoire dans biome compatible)
  if (profile.biome_cooldown_bonus_expires_at && new Date(profile.biome_cooldown_bonus_expires_at) > new Date()) {
    bonus = Math.max(bonus, profile.biome_cooldown_bonus_value || 0);
  }
  
  return bonus;
}

// ── Réduction taxe marché acheteur ──
// Dérivé automatiquement depuis ITEMS (effect === "market_tax_discount"), trié par value desc.
// Pour ajouter un item tax-discount : ajoutez-le dans ITEMS avec effect: "market_tax_discount".
import { ITEMS as _ITEMS_FOR_TAX } from "./craftingData.js";
const _TAX_DISCOUNTS = Object.entries(_ITEMS_FOR_TAX)
  .filter(([, v]) => v.effect === "market_tax_discount" && v.trigger === "passive")
  .map(([key, v]) => ({ key, value: v.value }))
  .sort((a, b) => b.value - a.value);

export function getMarketTaxDiscount(profile) {
  const inv = profile.inventory || [];
  for (const d of _TAX_DISCOUNTS) {
    if (inv.some(i => i.item_key === d.key && (i.quantity || 0) > 0)) return d.value;
  }
  return 0;
}

// ── Niveaux de ville ──
export const CITY_LEVELS = [
  { level: 1, threshold: 0,   label: "Hameau",   icon: "🏕️",
    cooldownReduction: 0,  extraBiomeCombat: 0, maintenanceReduction: 0, fatigueBonus: 0,
    description: "Point de départ. Aucun bonus." },
  { level: 2, threshold: 10,  label: "Village",  icon: "🏘️",
    cooldownReduction: 10, extraBiomeCombat: 0, maintenanceReduction: 0, fatigueBonus: 0,
    description: "−10% cooldown production (cumulable avec bonus biome et niveau joueur)." },
  { level: 3, threshold: 30,  label: "Bourg",    icon: "🏙️",
    cooldownReduction: 10, extraBiomeCombat: 1, maintenanceReduction: 0, fatigueBonus: 0,
    description: "−10% cooldown production + 1 combat biome supplémentaire par jour (6 au lieu de 5)." },
  { level: 4, threshold: 80,  label: "Cité",     icon: "🏛️",
    cooldownReduction: 10, extraBiomeCombat: 1, maintenanceReduction: 0, fatigueBonus: 0,
    description: "À venir." },
  { level: 5, threshold: 160, label: "Capitale", icon: "👑",
    cooldownReduction: 10, extraBiomeCombat: 1, maintenanceReduction: 0, fatigueBonus: 0,
    description: "À venir." },
  { level: 6, threshold: 400, label: "Empire",   icon: "🌟",
    cooldownReduction: 10, extraBiomeCombat: 1, maintenanceReduction: 0, fatigueBonus: 0,
    description: "À venir." },
];

// Seuils exprimés en lingots accumulés (city.lingots_cumul)

// ── Utilitaires bâtiments ──

/** Niveau actuel d'un type de bâtiment dans une ville (0 = pas construit) */
export function getBuildingLevel(city, buildingType) {
  const buildings = city?.buildings || [];
  const matching = buildings.filter(b => b.building_type === buildingType);
  return matching.length; // chaque construction = +1 niveau
}

/** Nombre de bâtiments d'un type dans une ville */
export function getBuildingCount(city, buildingType) {
  return (city?.buildings || []).filter(b => b.building_type === buildingType).length;
}

/** Peut-on construire un bâtiment supplémentaire de ce type ? */
export function canBuildMore(city, buildingType) {
  const bType = BUILDING_TYPES[buildingType];
  if (!bType) return false;
  if (bType.unique) return getBuildingCount(city, buildingType) === 0;
  if (!bType.stackable) return getBuildingCount(city, buildingType) === 0;
  return getBuildingCount(city, buildingType) < 5; // max 5 niveaux pour stackable
}

/**
 * Coût de construction du prochain niveau.
 * costBase × 2^currentLevel (double à chaque niveau pour les bâtiments stackables)
 */
export function getBuildingCost(buildingType, currentLevel = 0) {
  const bType = BUILDING_TYPES[buildingType];
  if (!bType?.costBase) return {};
  const multiplier = Math.pow(2, currentLevel);
  return Object.fromEntries(
    Object.entries(bType.costBase).map(([res, qty]) => [res, Math.ceil(qty * multiplier)])
  );
}

export function getCityTier(lingotsCumul = 0) {
  let tier = CITY_LEVELS[0];
  for (const l of CITY_LEVELS) {
    if (lingotsCumul >= l.threshold) tier = l;
  }
  return tier;
}

export function getCityBonuses(lingotsCumul = 0) {
  const tier = getCityTier(lingotsCumul);
  return {
    cooldownReduction:    tier.cooldownReduction,
    maintenanceReduction: tier.maintenanceReduction,
    fatigueBonus:         tier.fatigueBonus,
    productionBonus: 0,
    marketDiscount:  0,
  };
}

// ─────────────────────────────────────────────
// SYSTÈME DE ROUTES
// ─────────────────────────────────────────────

export const ROAD_TYPES = {
  royale:     { label: "🛤️ Route royale",       baseMin: 0,  baseMax: 0,  maritime: false },
  forestier:  { label: "🌲 Chemin forestier",   baseMin: 3,  baseMax: 8,  maritime: false },
  montagneux: { label: "⛰️ Passage montagneux", baseMin: 10, baseMax: 20, maritime: false },
  maritime:   { label: "⛵ Route maritime",      baseMin: 0,  baseMax: 0,  maritime: true  },
};

export const ROAD_COLORS = {
  royale:     "bg-green-100 text-green-800 border-green-200",
  forestier:  "bg-yellow-100 text-yellow-800 border-yellow-200",
  montagneux: "bg-orange-100 text-orange-800 border-orange-200",
  maritime:   "bg-blue-100 text-blue-800 border-blue-200",
};

export function getDailyRouteCost(roadType, routeId) {
  const today = getTodayDateStr();
  const seed = today.replace(/-/g, "") + routeId;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const rnd = Math.abs(hash) / 2147483647;
  const rt = ROAD_TYPES[roadType];
  if (!rt) return 0;
  return Math.round(rt.baseMin + rnd * (rt.baseMax - rt.baseMin));
}

// ── Calcul du coût de voyage ──
export function computeTravelCost(roadType, routeId, departCity, playerProfile) {
  // Route maritime toujours gratuite
  if (roadType === "maritime") return 0;

  const baseCost = getDailyRouteCost(roadType, routeId);
  let cost = baseCost;

  // Route pavée → -50% frais
  const hasRoute = (departCity?.buildings || []).some(b => b.building_type === "route");
  if (hasRoute) cost = Math.floor(cost * 0.5);

  // Guilde des voyageurs → -30% frais pour les habitants
  const isResident = playerProfile?.home_city_id === departCity?.id ||
                     playerProfile?.city_id === departCity?.id;
  const guildCount = (departCity?.buildings || []).filter(b => b.building_type === "caserne").length;
  if (isResident && guildCount > 0) cost = Math.floor(cost * 0.7);

  return Math.max(0, cost);
}

export function computeWallToll(arrivalCity, playerProfile) {
  const wallCount = (arrivalCity?.buildings || []).filter(b => b.building_type === "remparts").length;
  if (wallCount === 0) return 0;
  const isResident = playerProfile?.home_city_id === arrivalCity?.id ||
                     playerProfile?.city_id === arrivalCity?.id;
  if (isResident) return 0;
  return wallCount;
}

export function getRouteType(route) {
  if (route.road_type) return route.road_type;
  const map = { "sûr": "royale", "modéré": "forestier", "dangereux": "montagneux" };
  return map[route.danger_level] || "royale";
}


export function generateDailyTax() {
  const rates = [5, 8, 10, 12, 15, 18, 20];
  return rates[Math.floor(Math.random() * rates.length)];
}

export function generateMayorCost() {
  return 20;
}

export function generateDailyTaxPerPlayer() {
  const amounts = [0, 5, 5, 5, 10, 10, 15, 20, 25, 30];
  return amounts[Math.floor(Math.random() * amounts.length)];
}

export function getTodayDateStr() {
  return new Date().toISOString().split("T")[0];
}





// ── Coût faim + énergie par tier d'action ──

// ── Récompenses parchemins d'objectifs (calibrées anti-inflation) ──
export const PARCHEMIN_REWARDS = {
  contrat_artisan:  80,  // était 110, réduit pour équilibre économique
  // contrat_noble : récompense dynamique (voir Production.jsx CONTRAT_NOBLE_REWARD)
};

export const SCEAU_PRICE = 100;   // or détruit à l'achat
export const SCEAU_VALUE = 110;   // valeur absorbée en taxes/impôts

// ── Prestige joueur ──
export function getVendeurRank(cumul = 0) {
  if (cumul >= 10000) return { label: "Expert",        icon: "🏆", next: null,              nextAt: null  };
  if (cumul >= 5000)  return { label: "Confirmé",      icon: "⭐", next: "Expert",          nextAt: 10000 };
  if (cumul >= 2000)  return { label: "Intermédiaire", icon: "🥈", next: "Confirmé",        nextAt: 5000  };
  if (cumul >= 1000)  return { label: "Débutant",      icon: "🥉", next: "Intermédiaire",   nextAt: 2000  };
  return                     { label: "Apprenti",      icon: "📦", next: "Débutant",        nextAt: 1000  };
}

export function getContributeurRank(cumul = 0) {
  if (cumul >= 10000) return { label: "Donateur premium", icon: "👑", next: null,               nextAt: null  };
  if (cumul >= 5000)  return { label: "Super donateur",   icon: "💎", next: "Donateur premium", nextAt: 10000 };
  if (cumul >= 2000)  return { label: "Bon donateur",     icon: "🌟", next: "Super donateur",   nextAt: 5000  };
  if (cumul >= 1000)  return { label: "Donateur simple",  icon: "🤝", next: "Bon donateur",     nextAt: 2000  };
  return                     { label: "Radin",            icon: "💰", next: "Donateur simple",  nextAt: 1000  };
}

export function getPvpRank(cumul = 0) {
  if (cumul >= 21) return { label: "Seigneur de Guerre", icon: "⚔️", next: null,                nextAt: null };
  if (cumul >= 11) return { label: "Baron",              icon: "🛡️", next: "Seigneur de Guerre", nextAt: 21  };
  if (cumul >= 6)  return { label: "Sire",               icon: "🏰", next: "Baron",             nextAt: 11  };
  if (cumul >= 3)  return { label: "Chevalier",          icon: "🗡️", next: "Sire",              nextAt: 6   };
  if (cumul >= 1)  return { label: "Écuyer",             icon: "🗡️", next: "Chevalier",         nextAt: 3   };
  return                  { label: "Manant",             icon: "🌾", next: "Écuyer",            nextAt: 1   };
}

export const TIER_ACTION_COST = {
  1: { hunger: 1, fatigue: 1 },
  2: { hunger: 2, fatigue: 2 },
  3: { hunger: 3, fatigue: 3 },
  4: { hunger: 4, fatigue: 4 },
  5: { hunger: 5, fatigue: 5 },
};
// ── Prix de rachat de l'entrepôt (reset quotidien) ──
export const WAREHOUSE_BUYBACK_PRICES = {
  bois_brut:    { min: 1, max: 3,  label: "Bois brut",    icon: "🪵" },
  pierre:       { min: 1, max: 3,  label: "Pierre",       icon: "🪨" },
  pierre_brute: { min: 1, max: 3,  label: "Pierre brute", icon: "🗿" },
  minerai_fer:  { min: 2, max: 5,  label: "Minerai de fer", icon: "🪨" },
  ble:          { min: 1, max: 3,  label: "Blé",           icon: "🌾" },
  laine_brute:  { min: 1, max: 4,  label: "Laine brute",  icon: "🐑" },
  herbes:       { min: 1, max: 4,  label: "Herbes",        icon: "🌿" },
  quartz_brut:  { min: 2, max: 6,  label: "Quartz brut",  icon: "🔮" },
  lingots_or:   { min: 5, max: 15, label: "Lingot d'or",  icon: "🏅" },
};

export const WAREHOUSE_DAILY_SELL_CAP = 20;

export function generateWarehouseBuybackPrices() {
  const prices = {};
  for (const [key, def] of Object.entries(WAREHOUSE_BUYBACK_PRICES)) {
    const mid = Math.floor((def.min + def.max) / 2);
    prices[key] = def.min + Math.floor(Math.random() * (mid - def.min + 1));
  }
  return prices;
}

// ── Catégories de bâtiments ──
export const BUILDING_CATEGORIES = {
  logement:   { label: "🏠 Logement",    description: "Augmente la capacité d'accueil de la ville." },
  production: { label: "⚒️ Production",  description: "Améliore la production de ressources des habitants." },
  commerce:   { label: "🏪 Commerce",    description: "Facilite les échanges et réduit les taxes." },
  bien_etre:  { label: "🌿 Bien-être",   description: "Améliore la faim, l'énergie et le confort des résidents." },
  defense:    { label: "🛡️ Défense",    description: "Protège la ville contre les attaques ennemies." },
  prestige:   { label: "👑 Prestige",    description: "Bâtiments de prestige uniques pour les villes développées." },
};

// ── Calcul maintenance journalière totale d'une ville ──
// Agrège le coût de tous ses bâtiments (avec multiplicateur résidents + niveau)
// MAINTENANCE_FULL_RESIDENTS : nb joueurs à partir duquel l'entretien est à 100%
// En dessous : entretien réduit proportionnellement, plancher à MAINTENANCE_FLOOR
export const MAINTENANCE_FULL_RESIDENTS = 20; // modifier ici pour ajuster la courbe
export const MAINTENANCE_FLOOR = 0.25;        // minimum 25% même avec 1 joueur

export function getCityDailyMaintenance(city, nbResidents = 1) {
  const buildings = city?.buildings || [];
  const maintMultiplier = Math.max(MAINTENANCE_FLOOR, Math.min(1.0, nbResidents / MAINTENANCE_FULL_RESIDENTS));
  const totals = {};
  for (const building of buildings) {
    const bType = BUILDING_TYPES[building.building_type];
    const baseMaint = bType?.maintenance ?? {};
    if (Object.keys(baseMaint).length === 0) continue;
    const level = building.level || 1;
    const levelMultiplier = (bType?.category === "production" || bType?.category === "bien_etre")
      ? Math.pow(2, level - 1)
      : 1;
    for (const [res, qty] of Object.entries(baseMaint)) {
      totals[res] = (totals[res] || 0) + Math.ceil(qty * maintMultiplier * levelMultiplier);
    }
  }
  return totals;
}
