// ═══════════════════════════════════════════════════════════════
// craftingData.js — Système de craft T1→T5 avec interdépendances
// REFACTORED: T2 = 2×T1 (autres) + 1×T1 (propre)
//             T3 = 3×T2 (autres) | T4 = 4×T3 (autres) | T5 = 5×T4 (autres)
// ═══════════════════════════════════════════════════════════════

import recipePatternModule from './recipePatterns.js';

export const CRAFTING_RECIPES = recipePatternModule?.CRAFTING_RECIPES_REFACTORED || recipePatternModule?.default || [];

// ── PROFESSION_PRODUCTION: T1 harvesting recipes by profession ──
export const PROFESSION_PRODUCTION = {
  Bûcheron: [
    {
      id: "harvest_bois",
      name: "Récolter du bois",
      icon: "🪵",
      outputKey: "bois_brut",
      quantity: 1,
      cooldown: 80,
      tier: 1,
    },
  ],
  Mineur: [
    {
      id: "harvest_minerai",
      name: "Extraire du minerai",
      icon: "🪨",
      outputKey: "minerai_fer",
      quantity: 1,
      cooldown: 80,
      tier: 1,
    },
  ],
  Fermier: [
    {
      id: "harvest_ble",
      name: "Récolter du blé",
      icon: "🌾",
      outputKey: "ble",
      quantity: 2,
      cooldown: 80,
      tier: 1,
    },
  ],
  Tisserand: [
    {
      id: "harvest_laine",
      name: "Tondre la laine",
      icon: "🧶",
      outputKey: "laine_brute",
      quantity: 1,
      cooldown: 80,
      tier: 1,
    },
  ],
  Forgeron: [
    {
      id: "harvest_pierre",
      name: "Extraire de la pierre",
      icon: "🧱",
      outputKey: "pierre",
      quantity: 1,
      cooldown: 80,
      tier: 1,
    },
  ],
  Alchimiste: [
    {
      id: "harvest_herbes",
      name: "Cueillir des herbes",
      icon: "🌿",
      outputKey: "herbes",
      quantity: 2,
      cooldown: 80,
      tier: 1,
    },
  ],
  Orfèvre: [
    {
      id: "harvest_quartz",
      name: "Tailler du quartz",
      icon: "🔮",
      outputKey: "quartz_brut",
      quantity: 1,
      cooldown: 80,
      tier: 1,
    },
  ],
  Marchand: [
    {
      id: "harvest_autorisation",
      name: "Autorisation de marché",
      icon: "📜",
      outputKey: "autorisation_marche",
      quantity: 1,
      cooldown: 80,
      tier: 1,
    },
  ],
};

// ── ITEMS — source de vérité unique ──
// Chaque objet contient : identité (name/icon/category/tier/use)
//                       + effet mécanique (trigger/effect/value/duration_h...)
// TEMP_EFFECT_ITEMS et ITEM_EFFECTS sont dérivés automatiquement — ne pas modifier ceux-là.
export const ITEMS = {

  // ════════════════════════════════
  // T1 — Ressources brutes
  // ════════════════════════════════

  bois_brut: {
    name: "Bois brut", icon: "🪵", category: "bois", tier: 1,
    trigger: "consumed", effect: "cooldown_bonus", value: 0.10, duration_h: 1,
    biome_profession: "Bûcheron", biome_key: "foret",
    use: "Consommé : −10% cooldown 1h. Si buff biome Forêt actif : +1 récolte T1 bonus pendant 5 minutes.",
  },
  minerai_fer: {
    name: "Minerai de fer", icon: "🪨", category: "fer", tier: 1,
    trigger: "consumed", effect: "energy_max_bonus", value: 2, duration_h: 1,
    biome_profession: "Mineur", biome_key: "mine",
    use: "Consommé : +2 énergie max 1h. Si buff biome Mine actif : +1 récolte T1 bonus pendant 5 minutes.",
  },
  ble: {
    name: "Blé", icon: "🌾", category: "nourriture", tier: 1,
    trigger: "consumed", effect: "hunger_restore", value: 1,
    biome_profession: "Fermier", biome_key: "champs",
    use: "Consommé : +1 faim. Si buff biome Champs actif : +1 récolte T1 bonus pendant 5 minutes.",
  },
  laine_brute: {
    name: "Laine brute", icon: "🧶", category: "tissu", tier: 1,
    trigger: "consumed", effect: "defense_bonus", value: 2, duration_h: 6,
    biome_profession: "Tisserand", biome_key: "atelier",
    use: "Consommé : +2 défense vol 6h. Si buff biome Atelier actif : +1 récolte T1 bonus pendant 5 minutes.",
  },
  herbes: {
    name: "Herbes", icon: "🌿", category: "potions", tier: 1,
    trigger: "consumed", effect: "fatigue_restore", value: 1,
    biome_profession: "Alchimiste", biome_key: "foret",
    use: "Consommé : +1 énergie. Si buff biome Forêt actif : +1 récolte T1 bonus pendant 5 minutes.",
  },
  quartz_brut: {
    name: "Quartz brut", icon: "🔮", category: "or", tier: 1,
    trigger: "passive", effect: "market_tax_discount", value: 0.01,
    biome_profession: "Orfèvre", biome_key: "forge",
    use: "Passif inventaire : −1% taxe marché acheteur. Consommé avec buff biome Forge actif : +1 récolte T1 bonus pendant 5 minutes.",
  },
  pierre: {
    name: "Pierre", icon: "🧱", category: "pierre", tier: 1,
    trigger: "consumed", effect: "attack_bonus", value: 1, duration_h: 1,
    biome_profession: "Forgeron", biome_key: "forge",
    use: "Consommé : +1 attaque vol 1h. Si buff biome Forge actif : +1 récolte T1 bonus pendant 5 minutes.",
  },

  // ════════════════════════════════
  // T2 — Premières transformations
  // ════════════════════════════════

  planches: {
    name: "Planches", icon: "🪵", category: "bois", tier: 2,
    trigger: "passive", effect: "cooldown_bonus", value: 0.20,
    use: "Passif inventaire : −20% cooldown production",
  },
  pierre_brute: {
    name: "Pierre brute", icon: "🗿", category: "pierre", tier: 2,
    trigger: "passive", effect: "energy_max_bonus", value: 5,
    use: "Passif inventaire : +5 énergie max",
  },
  fil: {
    name: "Fil", icon: "🧵", category: "tissu", tier: 2,
    trigger: "passive", effect: "inventory_bonus", value: 40,
    use: "Passif inventaire : +40 capacité inventaire (non cumulable avec Tissu — seul le meilleur bonus s'applique)",
  },
  charbon: {
    name: "Charbon", icon: "⚫", category: "fer", tier: 2,
    trigger: "consumed", effect: "double_prod_bonus", value: 0.10, duration_h: 1, xp_reward: 50,
    use: "Consommé : +10% chance double production 1h (cumulable) · +50 XP",
  },
  extrait: {
    name: "Extrait", icon: "🫗", category: "potions", tier: 2,
    trigger: "consumed", effect: "fatigue_restore", value: 5, xp_reward: 50,
    use: "Consommé : +5 énergie · +50 XP",
  },
  quartz_poli: {
    name: "Quartz poli", icon: "💠", category: "or", tier: 2,
    trigger: "passive", effect: "market_tax_discount", value: 0.02,
    defense_bonus: 2, defense_bonus_h: 6,
    use: "Passif inventaire : −2% taxe marché. Consommé : +2 défense vol 6h (cristal de protection).",
  },
  encre: {
    name: "Encre", icon: "🖋️", category: "parchemins", tier: 2,
    trigger: "durability", effect: "travel_and_gamble", value: 0.20, gamble_max: 60, xp_reward: 50,
    durability: 4, craft_tier_bonus: 2, craft_bonus_output_tier: 1, cooldown_reduction: 0.10,
    use: "Consommé : −20% prochain voyage + gain 0–60💰 aléatoire · +50 XP. Équipée (durabilité 4) : −10% cooldown · Craft T2 → bonus ressource T1.",
  },
  farine: {
    name: "Farine", icon: "🧺", category: "nourriture", tier: 2,
    trigger: "consumed", effect: "hunger_restore", value: 5, xp_reward: 50,
    use: "Consommé : +5 faim · +50 XP",
  },

  // ════════════════════════════════
  // T3 — Objets utiles
  // ════════════════════════════════

  meuble: {
    name: "Meuble", icon: "🪑", category: "bois", tier: 3, expires_days: 15,
    trigger: "consumed", effect: "housing_maintenance", value: 0.50, duration_days: 10,
    use: "Consommé : −50% coût d'entretien de logement pendant 10 jours (effet actif tant que la date n'est pas expirée).",
  },
  lingots_fer: {
    name: "Lingots de fer", icon: "🔩", category: "fer", tier: 3,
    trigger: "passive", effect: "energy_max_bonus", value: 10,
    use: "Passif inventaire : +10 énergie max",
  },
  tissu: {
    name: "Tissu", icon: "🪡", category: "tissu", tier: 3,
    trigger: "passive", effect: "inventory_bonus", value: 60,
    use: "Passif inventaire : +60 capacité inventaire (non cumulable avec Fil — seul le meilleur bonus s'applique)",
  },
  epee_courte: {
    name: "Épée courte", icon: "🗡️", category: "armes", tier: 3,
    trigger: "durability", effect: "attack_bonus", value: 2, durability: 4, steal_pct: 0.10,
    craft_tier_bonus: 3, craft_bonus_output_tier: 2, cooldown_reduction: 0.20,
    use: "Équipée passivement : +2 attaque vol · Vol réussi vole 10% or · −20% cooldown production · Craft T3 → bonus ressource T2. Durabilité 4.",
  },
  potion_soin: {
    name: "Potion de soin", icon: "🧪", category: "potions", tier: 3,
    trigger: "consumed", effect: "fatigue_and_regen", value: 10, duration_h: 2,
    regen_interval_min: 5, regen_value: 1, xp_reward: 50,
    defense_bonus: 2, defense_bonus_h: 6,
    use: "Consommé : +10 énergie · regen +1⚡/5min pendant 2h · +2 défense vol 6h · +50 XP.",
  },
  lingots_or: {
    name: "Lingot d'or", icon: "🪙", category: "or", tier: 3,
    trigger: "passive", effect: "market_tax_discount", value: 0.03,
    use: "Passif inventaire : −3% taxe marché acheteur (non cumulable — seul le meilleur parmi quartz brut/poli/lingot or/raffiné s'applique). Nécessaire pour lingot raffiné",
  },
  parchemin: {
    name: "Parchemin", icon: "📜", category: "parchemins", tier: 3,
    trigger: "consumed", effect: "travel_and_gamble", value: 0.35, gamble_max: 100, xp_reward: 50,
    use: "Consommé : −35% prochain voyage + gamble 0–100💰 (fortune ou ruine ?) · +50 XP",
  },
  pain: {
    name: "Pain", icon: "🍞", category: "nourriture", tier: 3,
    trigger: "consumed", effect: "hunger_and_regen", value: 10, duration_h: 2,
    regen_interval_min: 5, regen_value: 1, xp_reward: 50,
    use: "Consommé : +10 faim (remonte au max) · regen +1🍞/5min pendant 2h · +50 XP.",
  },
  contrat_artisan: {
    name: "Contrat artisan", icon: "📋", category: "parchemins", tier: 3,
    trigger: "consumed", effect: "quest_activate", value: 1,
    use: "Consommé : Activer une quête (5 T2, récompense 110 or)",
  },

  // ════════════════════════════════
  // T4 — Objets puissants
  // ════════════════════════════════

  armure: {
    name: "Armure", icon: "🥋", category: "armures", tier: 4,
    trigger: "durability", effect: "combat_defense", value: 3, durability: 3, steal_cap_pct: 0.05,
    use: "Équipée passivement : +3 défense vol · Vol subi plafonné à 5% or. Durabilité 3.",
  },
  outils: {
    name: "Outils", icon: "🔧", category: "outils", tier: 4,
    trigger: "durability", effect: "cooldown_reduction", value: 0.30, durability: 4,
    craft_tier_bonus: 4, craft_bonus_output_tier: 3, cooldown_reduction: 0.30,
    use: "Équipée passivement : −30% cooldown production · Craft T4 → bonus ressource T3. Durabilité 4.",
  },
  ragout: {
    name: "Ragoût", icon: "🍲", category: "nourriture", tier: 4,
    trigger: "consumed", effect: "hunger_and_regen", value: 10, duration_h: 2,
    regen_interval_min: 5, regen_value: 1, xp_reward: 100,
    use: "Consommé : +10 faim · regen +1🍞/5min pendant 2h · +100 XP · +50 pts nourriture armée.",
  },
  besace: {
    name: "Besace", icon: "🎒", category: "armures", tier: 4,
    trigger: "durability", effect: "combat_defense", value: 2, durability: 3, inventory_bonus: 50,
    use: "Équipée passivement : +2 défense vol · +50 capacité inventaire · Nécessaire pour craft T5. Durabilité 3.",
  },
  epee_longue: {
    name: "Épée longue", icon: "⚔️", category: "armes", tier: 4,
    trigger: "durability", effect: "combat_attack", value: 4, durability: 3, steal_pct: 0.20,
    use: "Équipée passivement : +4 attaque vol · Vol réussi vole 20% or · Nécessaire pour craft T5. Durabilité 3.",
  },
  potion_endur: {
    name: "Potion d'endurance", icon: "💪", category: "potions", tier: 4,
    trigger: "consumed", effect: "fatigue_and_regen", value: 20, duration_h: 2,
    regen_interval_min: 5, regen_value: 1, xp_reward: 100,
    use: "Consommé : +20 énergie · regen +1⚡/5min pendant 2h · +100 XP · +50 pts énergie armée.",
  },
  lingot_raffine: {
    name: "Lingot raffiné", icon: "🏅", category: "or", tier: 4,
    trigger: "passive", effect: "market_tax_discount", value: 0.04,
    use: "Passif inventaire : −4% taxe marché acheteur. Nécessaire pour lingot royal",
  },

  // ════════════════════════════════
  // T1.5 — Items PvP quotidiens
  // ════════════════════════════════

  camouflage: {
    name: "Camouflage", icon: "👻", category: "parchemins", tier: 1.5,
    trigger: "consumed", effect: "stealth_next_theft", value: 1,
    use: "Passif inventaire : masque automatiquement votre identité lors de votre prochain vol réussi (victime voit 'un inconnu').",
  },
  tracts_greve: {
    name: "Tracts de Grève", icon: "⚡", category: "parchemins", tier: 1.5,
    trigger: "consumed", effect: "city_cooldown_malus", value: 0.20, duration_h: 24,
    use: "Actif : imposez +20% de cooldown de production à tous les joueurs d'une ville pendant 24h. Activez depuis la page Production.",
  },
  bourse_protection: {
    name: "Bourse de protection", icon: "👜", category: "parchemins", tier: 1.5,
    trigger: "durability", effect: "theft_cap", value: 10, durability: 3,
    use: "Équipée passivement : plafonne le vol subi à 10 or par attaque. Durabilité 3",
  },

  // ════════════════════════════════
  // T5 — Items JCJ offensifs/défensifs
  // ════════════════════════════════

  huile_inflammable: {
    name: "Huile inflammable", icon: "🔥", category: "parchemins", tier: 5,
    trigger: "attack", effect: "destroy_building", value: 1,
    use: "Attaque : détruit un bâtiment aléatoire de la ville adverse",
  },
  poudre_corrosive: {
    name: "Poudre corrosive", icon: "💥", category: "parchemins", tier: 5,
    trigger: "attack", effect: "destroy_warehouse_80pct", value: 0.80,
    use: "Attaque : détruit 80% d'une ressource aléatoire de l'entrepôt ennemi",
  },
  festin_empoisonne: {
    name: "Festin empoisonné", icon: "🍖", category: "nourriture", tier: 5,
    trigger: "attack", effect: "hunger_regen_fatigue_drain", value: 5, duration_days: 2,
    use: "Attaque : les résidents de la ville cible perdent −5⚡ supplémentaires à chaque récupération de faim pendant 2j",
  },
  faux_contrat: {
    name: "Faux contrat", icon: "📄", category: "parchemins", tier: 5,
    trigger: "attack", effect: "blind_travel", value: 2,
    use: "Attaque : routes inconnues pour les voyageurs ennemis pendant 2j",
  },
  cle_forgee: {
    name: "Clé forgée", icon: "🗝️", category: "parchemins", tier: 5,
    trigger: "attack", effect: "steal_treasury_20pct", value: 0.20,
    use: "Attaque : vole 20% des lingots royaux stockés dans l'entrepôt ennemi",
  },
  elixir_discorde: {
    name: "Élixir de discorde", icon: "☠️", category: "potions", tier: 5,
    trigger: "attack", effect: "redirect_taxes", value: 2,
    use: "Attaque : taxes de la ville cible détournées vers votre ville pendant 2j",
  },
  lettre_desinformation: {
    name: "Lettre de désinformation", icon: "✉️", category: "parchemins", tier: 5,
    trigger: "attack", effect: "tax_increase_30pct", value: 0.30,
    use: "Attaque : taxes de la ville cible augmentées de 30% pendant 2j",
  },
  contrat_noble: {
    name: "Contrat noble", icon: "📜", category: "parchemins", tier: 5,
    trigger: "consumed", effect: "city_defense", value: 1,
    use: "Défense : annule la prochaine attaque T5 ennemie",
  },

  // ════════════════════════════════
  // Divers
  // ════════════════════════════════

  lingot_royal: {
    name: "Lingot royal", icon: "👑", category: "or", tier: 5,
    trigger: "sellable", effect: "sellable", value: 156,
    use: "Vendu à la mairie pour 156💰 · Comptabilisé pour le prestige et les paliers de développement de la ville.",
  },
  autorisation_marche: {
    name: "Autorisation de marché", icon: "📜", category: "parchemins", tier: 1,
    trigger: "consumed", effect: "market_permit", value: 1,
    biome_profession: "Marchand", biome_key: "guilde",
    use: "Nécessaire pour poster une annonce au marché · Consommé avec buff biome Guilde actif : +1 production bonus.",
  },
  sceau_royal: {
    name: "Sceau royal", icon: "🏵️", category: "parchemins", tier: 0,
    trigger: "passive", effect: "tax_absorb", value: 110,
    use: "Coûte 100💰 · Crédite 110💰 de couverture fiscale (absorbe impôts et taxes marché). Non taxable. 1 achat/joueur/jour · Réservé aux joueurs ≥ 300💰 · Disponible sur certains marchés quand l'or moyen dépasse 500💰.",
  },
};

// ── TEMP_EFFECT_ITEMS — dérivé automatique de ITEMS ──
// Ne pas modifier directement : modifiez l'objet dans ITEMS ci-dessus.
export const TEMP_EFFECT_ITEMS = Object.entries(ITEMS)
  .filter(([, v]) => v.trigger && v.effect)
  .map(([key, v]) => ({
    key,
    name: v.name,
    icon: v.icon,
    trigger: v.trigger,
    effect: v.effect,
    value: v.value,
    duration_h: v.duration_h ?? null,
    duration_days: v.duration_days ?? null,
    regen_interval_min: v.regen_interval_min ?? null,
    regen_value: v.regen_value ?? null,
    label: v.use,
  }));

// ── ITEM_EFFECTS — dérivé automatique de ITEMS ──
// Ne pas modifier directement : modifiez l'objet dans ITEMS ci-dessus.
export const ITEM_EFFECTS = Object.fromEntries(
  Object.entries(ITEMS)
    .filter(([, v]) => v.effect)
    .map(([key, v]) => [key, {
      type: v.trigger === "passive" ? v.effect + "_passive" : v.effect,
      value: v.value,
      description: v.use,
    }])
);

// ── NOURRITURE (restaure la faim) — dans gameData aussi ──



// ── FOOD_ITEMS_WITH_FATIGUE — dérivé automatique de ITEMS ──
// Items qui restaurent directement de l'énergie (fatigue_restore)
export const FOOD_ITEMS_WITH_FATIGUE = Object.entries(ITEMS)
  .filter(([, v]) => v.effect === "fatigue_restore" || v.effect === "fatigue_and_defense" || v.effect === "fatigue_and_regen")
  .map(([key, v]) => ({ key, name: v.name, icon: v.icon, fatigue_restore: v.value, xp_reward: v.xp_reward || 0 }));

// ── EQUIPMENT_KEYS & EQUIPMENT_DURABILITY — dérivés automatiques depuis ITEMS ──
// Ne pas modifier directement : ajoutez durability: N dans l'objet ITEMS.
export const EQUIPMENT_KEYS = Object.entries(ITEMS)
  .filter(([, v]) => v.durability !== undefined)
  .map(([key]) => key);

export const EQUIPMENT_DURABILITY = Object.fromEntries(
  Object.entries(ITEMS)
    .filter(([, v]) => v.durability !== undefined)
    .map(([key, v]) => [key, v.durability])
);

// ── TOOL_CHARGES_PER_SET ──
export const TOOL_CHARGES_PER_SET = 3;
export const COOLDOWN_PENALTY_NO_TOOLS = 1.5;

// ── Fonction utilitaire ──
export function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

// ── Calcul fatigue (regen passive — plus de reset quotidien) ──
export function computeFatigueWithDailyReset(profile, maxFatigue) {
  const today = getTodayStr();
  return { fatigue: profile?.fatigue ?? maxFatigue, needsReset: false, today };
}

export const ACTION_FATIGUE_COST = 1;