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
    use: "−10% cooldown 1h. Buff biome → +1 récolte T1 (5min).",
  },
  minerai_fer: {
    name: "Minerai de fer", icon: "🪨", category: "fer", tier: 1,
    trigger: "consumed", effect: "energy_max_bonus", value: 2, duration_h: 1,
    biome_profession: "Mineur", biome_key: "mine",
    use: "+2 énergie max 1h. Buff biome → +1 récolte T1 (5min).",
  },
  ble: {
    name: "Blé", icon: "🌾", category: "nourriture", tier: 1,
    trigger: "consumed", effect: "hunger_restore", value: 1,
    biome_profession: "Fermier", biome_key: "champs",
    use: "+1 faim. Buff biome → +1 récolte T1 (5min).",
  },
  laine_brute: {
    name: "Laine brute", icon: "🧶", category: "tissu", tier: 1,
    trigger: "consumed", effect: "biome_buff_only",
    biome_profession: "Tisserand", biome_key: "atelier",
    use: "Buff biome → +1 récolte T1 (5min). Sinon aucun effet.",
  },
  herbes: {
    name: "Herbes", icon: "🌿", category: "potions", tier: 1,
    trigger: "consumed", effect: "fatigue_restore", value: 1,
    biome_profession: "Alchimiste", biome_key: "foret",
    use: "+1 énergie. Buff biome → +1 récolte T1 (5min).",
  },
  quartz_brut: {
    name: "Quartz brut", icon: "🔮", category: "or", tier: 1,
    trigger: "passive", effect: "market_tax_discount", value: 0.01,
    biome_profession: "Orfèvre", biome_key: "forge",
    use: "Passif : −1% taxe marché. Buff biome → +1 récolte T1 (5min).",
  },
  pierre: {
    name: "Pierre", icon: "🧱", category: "pierre", tier: 1,
    trigger: "consumed", effect: "biome_buff_only",
    biome_profession: "Forgeron", biome_key: "forge",
    use: "Buff biome → +1 récolte T1 (5min). Sinon aucun effet.",
  },

  // ════════════════════════════════
  // T1 COMBAT — items équipables (Forgeron + Tisserand)
  // Au craft, grade 0 (effet 0). Améliorables jusqu'au grade 5.
  // Casse aléatoire selon grade (5%, 4%, 3%, 2%, 1.5%, 1%).
  // ════════════════════════════════
  // ── ARME (Forgeron) — 1 seule épée universelle (Phase 3 - Option B) ──
  // Avant : 4 items zonés (casque-arme, plastron-arme, épée, pic). Migration des
  // anciens items vers "epee" — leurs grades sont conservés mais ils s'empilent
  // sur le slot "weapon".
  epee: {
    name: "Épée", icon: "⚔️", category: "armes_combat", tier: 1,
    profession: "Forgeron",
    combat_slot: "weapon",
    trigger: "equipped", effect: "combat_attack", base_value: 1,
    steal_pct: 0.10,
    use: "Arme principale. Vol 10–20% selon grade (max 100💰). Améliorable chez le Bûcheron.",
  },

  // ── DÉFENSE (Tisserand) — 4 zones ──
  heaume: {
    name: "Heaume", icon: "🪖", category: "armures_combat", tier: 1,
    profession: "Tisserand",
    combat_slot: "head_def",
    trigger: "equipped", effect: "combat_defense_zone", zone: "head", base_value: 1,
    use: "Armure tête. Améliorable chez le Mineur.",
  },
  cuirasse: {
    name: "Cuirasse", icon: "🛡️", category: "armures_combat", tier: 1,
    profession: "Tisserand",
    combat_slot: "torso_def",
    trigger: "equipped", effect: "combat_defense_zone", zone: "torso", base_value: 1,
    use: "Armure torse. Améliorable chez le Mineur.",
  },
  brassard: {
    name: "Brassard", icon: "🛡️", category: "armures_combat", tier: 1,
    profession: "Tisserand",
    combat_slot: "arms_def",
    trigger: "equipped", effect: "combat_defense_zone", zone: "arms", base_value: 1,
    use: "Armure bras. Améliorable chez le Mineur.",
  },
  jambiere: {
    name: "Jambière", icon: "🦵", category: "armures_combat", tier: 1,
    profession: "Tisserand",
    combat_slot: "legs_def",
    trigger: "equipped", effect: "combat_defense_zone", zone: "legs", base_value: 1,
    use: "Armure jambes. Améliorable chez le Mineur.",
  },

  // ════════════════════════════════
  // T2 — Premières transformations
  // ════════════════════════════════

  planches: {
    name: "Planches", icon: "🪵", category: "bois", tier: 2,
    trigger: "passive", effect: "cooldown_bonus", value: 0.20,
    use: "Passif : −20% cooldown production.",
  },
  pierre_brute: {
    name: "Pierre brute", icon: "🗿", category: "pierre", tier: 2,
    trigger: "passive", effect: "energy_max_bonus", value: 2,
    use: "Passif : +2 énergie max.",
  },
  fil: {
    name: "Fil", icon: "🧵", category: "tissu", tier: 2,
    trigger: "passive", effect: "inventory_bonus", value: 40,
    use: "Passif : +40 capacité inventaire (le meilleur s'applique).",
  },
  charbon: {
    name: "Charbon", icon: "⚫", category: "fer", tier: 2,
    trigger: "consumed", effect: "double_prod_bonus", value: 0.10, duration_h: 1, xp_reward: 50,
    use: "+10% chance double prod 1h (cumulable) + 50 XP.",
  },
  extrait: {
    name: "Extrait", icon: "🫗", category: "potions", tier: 2,
    trigger: "consumed", effect: "fatigue_restore", value: 5, xp_reward: 50,
    use: "+5⚡ + 50 XP.",
  },
  quartz_poli: {
    name: "Quartz poli", icon: "💠", category: "or", tier: 2,
    trigger: "passive", effect: "market_tax_discount", value: 0.02,
    use: "Passif : −2% taxe marché (le meilleur s'applique).",
  },
  encre: {
    name: "Encre", icon: "🖋️", category: "parchemins", tier: 2,
    trigger: "consumed", effect: "travel_and_gamble", value: 0.20, gamble_max: 60, xp_reward: 50,
    next_t2_gives_t1: true,
    use: "Consommée : −20% voyage + 0–60💰 + 50 XP. Le prochain craft T2 donne un T1 bonus.",
  },
  farine: {
    name: "Farine", icon: "🧺", category: "nourriture", tier: 2,
    trigger: "consumed", effect: "hunger_restore", value: 5, xp_reward: 50,
    use: "+5🍞 + 50 XP.",
  },

  // ════════════════════════════════
  // T3 — Objets utiles
  // ════════════════════════════════

  meuble: {
    name: "Meuble", icon: "🪑", category: "bois", tier: 3, expires_days: 15,
    trigger: "consumed", effect: "housing_maintenance", value: 0.50, duration_days: 10,
    use: "Installer : −50% entretien logement pendant 10 jours.",
  },
  lingots_fer: {
    name: "Lingots de fer", icon: "🔩", category: "fer", tier: 3,
    trigger: "passive", effect: "energy_max_bonus", value: 5,
    use: "Passif : +5 énergie max.",
  },
  tissu: {
    name: "Tissu", icon: "🪡", category: "tissu", tier: 3,
    trigger: "passive", effect: "inventory_bonus", value: 60,
    use: "Passif : +60 capacité inventaire (le meilleur s'applique).",
  },
  epee_courte: {
    name: "Outil multifonction", icon: "🛠️", category: "outils", tier: 3,
    trigger: "durability", effect: "craft_tool", value: 0, durability: 10,
    craft_unlock_tier: 3,
    use: "Requis pour craft T3 (1 charge / craft, 10 max).",
  },
  potion_soin: {
    name: "Potion de soin", icon: "🧪", category: "potions", tier: 3,
    trigger: "consumed", effect: "fatigue_and_regen", value: 10, duration_h: 2,
    regen_interval_min: 5, regen_value: 1, xp_reward: 50,
    hp_restore: 5,
    use: "+10⚡ + regen +1⚡/5min (2h) + 5 PV + 50 XP.",
  },
  lingots_or: {
    name: "Lingot d'or", icon: "🪙", category: "or", tier: 3,
    trigger: "passive", effect: "market_tax_discount", value: 0.03,
    use: "Passif : −3% taxe marché (le meilleur s'applique). Requis pour lingot raffiné.",
  },
  parchemin: {
    name: "Parchemin", icon: "📜", category: "parchemins", tier: 3,
    trigger: "consumed", effect: "travel_and_gamble", value: 0.35, gamble_max: 100, xp_reward: 50,
    use: "−35% voyage + gamble 0–100💰 + 50 XP.",
  },
  pain: {
    name: "Pain", icon: "🍞", category: "nourriture", tier: 3,
    trigger: "consumed", effect: "hunger_and_regen", value: 10, duration_h: 2,
    regen_interval_min: 5, regen_value: 1, xp_reward: 50,
    use: "+10🍞 + regen +1🍞/5min (2h) + 50 XP.",
  },
  contrat_artisan: {
    name: "Contrat artisan", icon: "📋", category: "parchemins", tier: 3,
    trigger: "consumed", effect: "quest_activate", value: 1,
    use: "Activer une quête (5 T2 → 110💰).",
  },

  // ════════════════════════════════
  // T4 — Objets puissants
  // ════════════════════════════════

  armure: {
    name: "Tunique de travail", icon: "🥋", category: "outils", tier: 4,
    trigger: "passive", effect: "cooldown_bonus", value: 0.40,
    use: "Passif : −40% cooldown production (meilleur s'applique).",
  },
  outils: {
    name: "Outils", icon: "🔧", category: "outils", tier: 4,
    trigger: "durability", effect: "cooldown_reduction", value: 0.30, durability: 4,
    craft_tier_bonus: 4, craft_bonus_output_tier: 3, cooldown_reduction: 0.30,
    use: "Passif : −30% CD prod + bonus T3 sur craft T4 (durabilité 4).",
  },
  ragout: {
    name: "Ragoût", icon: "🍲", category: "nourriture", tier: 4,
    trigger: "consumed", effect: "hunger_and_regen", value: 20, duration_h: 2,
    regen_interval_min: 5, regen_value: 1, xp_reward: 100,
    use: "+20🍞 + regen +1🍞/5min (2h) + 100 XP + 50 nourriture armée.",
  },
  besace: {
    name: "Sac de voyage", icon: "🎒", category: "outils", tier: 4,
    trigger: "durability", effect: "craft_tool", value: 0, durability: 10,
    craft_unlock_tier: 4, inventory_bonus: 50,
    use: "Requis pour craft T4 (1 charge / craft, 10 max). Passif : +50 inventaire.",
  },
  epee_longue: {
    name: "Outil multifonction renforcé", icon: "⚒️", category: "outils", tier: 4,
    trigger: "durability", effect: "craft_tool", value: 0, durability: 10,
    craft_unlock_tier: 5,
    use: "Requis pour craft T5 (1 charge / craft, 10 max).",
  },
  potion_endur: {
    name: "Potion d'endurance", icon: "💪", category: "potions", tier: 4,
    trigger: "consumed", effect: "fatigue_and_regen", value: 20, duration_h: 2,
    regen_interval_min: 5, regen_value: 1, xp_reward: 100,
    hp_restore: 10,
    use: "+20⚡ + regen +1⚡/5min (2h) + 10 PV + 100 XP + 50 énergie armée.",
  },
  lingot_raffine: {
    name: "Lingot raffiné", icon: "🏅", category: "or", tier: 4,
    trigger: "passive", effect: "market_tax_discount", value: 0.04,
    use: "Passif : −4% taxe marché. Requis pour lingot royal.",
  },

  // ════════════════════════════════
  // T1.5 — Items PvP quotidiens
  // ════════════════════════════════

  camouflage: {
    name: "Camouflage", icon: "👻", category: "parchemins", tier: 1.5,
    trigger: "consumed", effect: "stealth_next_theft", value: 1,
    use: "Passif : masque votre identité lors de votre prochain vol.",
  },
  tracts_greve: {
    name: "Tracts de Grève", icon: "⚡", category: "parchemins", tier: 1.5,
    trigger: "consumed", effect: "city_cooldown_malus", value: 0.20, duration_h: 24,
    use: "Imposer +20% CD prod à toute une ville (24h).",
  },
  bourse_protection: {
    name: "Bourse de protection", icon: "👜", category: "parchemins", tier: 1.5,
    trigger: "passive", effect: "theft_cap", value: 10, break_chance: 0.10,
    use: "Passif : plafonne le vol subi à 10💰. Casse 10% par attaque.",
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
    use: "Attaque ville : manger coûte 5⚡ de plus pendant 2j.",
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
    use: "Attaque ville : taxes détournées vers votre ville (2j).",
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
    use: "Vendable mairie : 156💰. Compte pour le prestige.",
  },
  autorisation_marche: {
    name: "Autorisation de marché", icon: "📜", category: "parchemins", tier: 1,
    trigger: "consumed", effect: "market_permit", value: 1,
    biome_profession: "Marchand", biome_key: "guilde",
    use: "Requis pour poster au marché. Buff biome Guilde → +1 production.",
  },
  sceau_royal: {
    name: "Sceau royal", icon: "🏵️", category: "parchemins", tier: 0,
    trigger: "passive", effect: "tax_absorb", value: 110,
    use: "100💰 → 110💰 de couverture fiscale (absorbe impôts/taxes). 1/jour, réservé aux joueurs ≥ 300💰.",
  },
};

// ── TEMP_EFFECT_ITEMS — dérivé automatique de ITEMS ──
// Ne pas modifier directement : modifiez l'objet dans ITEMS ci-dessus.
//
// On ne garde que les items qui demandent un clic explicite "Activer" :
//   - trigger === "consumed" ou "attack"  (pas passive/equipped/durability/sellable)
//   - et qui ne sont pas déjà couverts par d'autres boutons :
//     - hunger_restore / hunger_and_regen → bouton "Manger" séparé
//     - quest_activate (contrats) → bouton "📜 Activer" séparé
//     - housing_maintenance (meuble) → bouton "🪑 Installer" séparé
const _ACTIVATABLE_TRIGGERS = new Set(["consumed", "attack"]);
const _COVERED_ELSEWHERE_EFFECTS = new Set([
  "hunger_restore",
  "hunger_and_regen",
  "quest_activate",
  "housing_maintenance",
  "market_permit",      // consommé auto au marché, pas de bouton manuel
  "combat_attack",      // équipé, géré dans Combat
  "combat_defense_zone", // équipé, géré dans Combat
]);
export const TEMP_EFFECT_ITEMS = Object.entries(ITEMS)
  .filter(([, v]) =>
    v.trigger && v.effect
    && _ACTIVATABLE_TRIGGERS.has(v.trigger)
    && !_COVERED_ELSEWHERE_EFFECTS.has(v.effect)
  )
  .map(([key, v]) => ({
    key,
    name: v.name,
    icon: v.icon,
    trigger: v.trigger,
    effect: v.effect,
    value: v.value,
    gamble_max: v.gamble_max ?? null,
    duration_h: v.duration_h ?? null,
    duration_days: v.duration_days ?? null,
    regen_interval_min: v.regen_interval_min ?? null,
    regen_value: v.regen_value ?? null,
    next_t2_gives_t1: v.next_t2_gives_t1 ?? false,
    xp_reward: v.xp_reward ?? null,
    // label utilisé sur les boutons "✨ Activer" — court, pas la description complète
    // (la description est affichée à part via `data.use` ou `effect.description`).
    label: v.name,
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