import { ITEMS } from "./craftingData.js";

// ── Récompenses de quêtes — montant fixe par type ──
export const QUEST_REWARDS = {
  deposit:    20,
  sell:        5,
  produce:     5,
  travel:      5,
  profession:  5,
  contribute: 20,
};

// ── T2_DEPOSIT_ITEMS — dérivé automatique depuis ITEMS ──
export const T2_DEPOSIT_ITEMS = Object.entries(ITEMS)
  .filter(([, v]) => v.tier === 2 && v.trigger !== "attack" && v.trigger !== "sellable")
  .map(([key, v]) => ({ key, name: v.name, icon: v.icon }));

// ── T2 principal par profession (utilisé pour les quêtes deposit/contribute) ──
export const PROFESSION_T2 = {
  "Bûcheron":  { key: "planches",    name: "Planches",    icon: "🪵" },
  "Mineur":    { key: "pierre_brute",name: "Pierre brute",icon: "🗿" },
  "Fermier":   { key: "farine",      name: "Farine",      icon: "🧺" },
  "Tisserand": { key: "fil",         name: "Fil",         icon: "🧵" },
  "Forgeron":  { key: "charbon",     name: "Charbon",     icon: "⚫" },
  "Alchimiste":{ key: "extrait",     name: "Extrait",     icon: "🫗" },
  "Orfèvre":   { key: "quartz_poli", name: "Quartz poli", icon: "💠" },
  "Marchand":  { key: "encre",       name: "Encre",       icon: "🖋️" },
};

// ── QUEST_TEMPLATES — source de vérité des quêtes ──
// Pour modifier une quête : toucher uniquement ce bloc.
// reward: voir QUEST_REWARDS en haut du fichier
export const QUEST_TEMPLATES = {

  deposit: {
    title: "📦 Approvisionnement",
    // item = T2 de la profession active du joueur — déposé dans SA ville
    description: (item) => `Approvisionnez votre ville. Déposez 2 ${item.icon} ${item.name} dans l'entrepôt de votre ville de résidence.`,
    target_item: (item) => item.key,
    target_quantity: 2,
    reward: "big",
  },

  sell: {
    title: "🏪 Marchand du jour",
    description: () => "Le marché est animé aujourd'hui. Mettez en vente 2 items T2 ou T3 sur n'importe quel marché.",
    target_item: () => "any_t2",
    target_quantity: 2,
    reward: "base",
  },

  produce: {
    title: "⚒️ Artisan actif",
    description: () => "Mettez votre savoir-faire à profit. Fabriquez 3 items T2 ou T3.",
    target_item: () => "any_t2",
    target_quantity: 3,
    reward: "base",
  },

  travel: {
    title: "🐴 Voyageur du jour",
    description: () => "Les routes sont dégagées. Voyagez vers une nouvelle ville pour explorer le marché.",
    target_item: () => "any",
    target_quantity: 1,
    reward: "base",
  },

  contribute: {
    title: "🤝 Contributeur civic",
    // item = T2 de la profession active du joueur — déposé dans une AUTRE ville (implique voyage)
    description: (item) => `Exportez votre savoir-faire ! Déposez 2 ${item.icon} ${item.name} dans l'entrepôt d'une ville étrangère.`,
    target_item: (item) => item.key,
    target_quantity: 2,
    reward: "base",
  },

  // ── Quête métier — titre/desc/item/qty définis dans PROFESSION_QUESTS ──
  profession: {
    reward: "big",
  },
};

// ── PROFESSION_QUESTS — quêtes spéciales par métier ──
export const PROFESSION_QUESTS = {
  Bûcheron: [
    { title: "🌲 Bûcheronnage intensif", item: "bois_brut",  qty: 8, desc: "Récoltez 8 bois brut aujourd'hui." },
    { title: "🪵 Charpentier du jour",   item: "planches",   qty: 4, desc: "Fabriquez 4 planches." },
  ],
  Mineur: [
    { title: "⛏️ Minage intensif",       item: "minerai_fer", qty: 8, desc: "Récoltez 8 minerais de fer." },
    { title: "⬛ Maître du charbon",      item: "charbon",     qty: 4, desc: "Fabriquez 4 charbons." },
  ],
  Fermier: [
    { title: "🌾 Moisson du jour",       item: "ble",     qty: 8, desc: "Récoltez 8 blés." },
    { title: "🥐 Boulanger artisan",     item: "pain",    qty: 4, desc: "Fabriquez 4 pains." },
  ],
  Tisserand: [
    { title: "🐑 Tondeur de laine",      item: "laine_brute", qty: 8, desc: "Récoltez 8 laines brutes." },
    { title: "🧵 Tisserand assidu",      item: "fil",         qty: 4, desc: "Fabriquez 4 fils." },
  ],
  Forgeron: [
    { title: "🔨 Forgeur du jour",       item: "lingots_fer", qty: 8, desc: "Fabriquez 8 lingots de fer." },
    { title: "⚔️ Armurier",             item: "epee_courte", qty: 4, desc: "Fabriquez 4 épées courtes." },
  ],
  Alchimiste: [
    { title: "🌿 Herboriste",            item: "herbes",      qty: 8, desc: "Récoltez 8 herbes." },
    { title: "🧪 Alchimiste du jour",    item: "potion_soin", qty: 4, desc: "Fabriquez 4 potions de soin." },
  ],
  Orfèvre: [
    { title: "🔮 Cristallier",           item: "quartz_brut", qty: 8, desc: "Récoltez 8 quartz bruts." },
    { title: "💠 Polisseur",             item: "quartz_poli", qty: 4, desc: "Fabriquez 4 quartz polis." },
  ],
  Marchand: [
    { title: "📜 Greffier du commerce",  item: "autorisation_marche", qty: 8, desc: "Produisez 8 autorisations de marché." },
    { title: "💼 Négociant",             item: "any_t2", qty: 4, desc: "Mettez en vente 4 items T2 ou T3." },
  ],
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Génère 6 quêtes quotidiennes pour un joueur.
 * Pour modifier les quêtes : toucher QUEST_TEMPLATES ou PROFESSION_QUESTS ci-dessus.
 * Pour modifier les récompenses : changer QUEST_REWARDS en haut du fichier.
 */
export function generatePlayerObjectives(player, cityId, ecoSettings = {}) {
  const multiplier = Math.max(0.5, Math.min(3.0, ecoSettings.objective_reward_multiplier ?? 1.0));
  const reward = (type) => Math.round((QUEST_REWARDS[type] ?? 5) * multiplier);
  const todayStr   = new Date().toISOString().split("T")[0];

  // T2 selon la profession active du joueur
  const profT2 = PROFESSION_T2[player.profession] || pickRandom(T2_DEPOSIT_ITEMS);
  const depositItem    = profT2;
  const contributeItem = profT2;

  const profQuests = PROFESSION_QUESTS[player.profession] || PROFESSION_QUESTS["Marchand"];
  const profQuest  = pickRandom(profQuests);
  const profType   = profQuest.item === "any_t2" ? "sell" : "produce";

  const base = (type, overrides) => ({
    player_email:     player.user_email,
    city_id:          cityId,
    current_quantity: 0,
    status:           "active",
    quest_date: todayStr,
    reward_gold:      reward(type),
    ...overrides,
  });

  return [
    base("deposit", {
      type:             "deposit",
      title:            QUEST_TEMPLATES.deposit.title,
      description:      QUEST_TEMPLATES.deposit.description(depositItem),
      target_item:      QUEST_TEMPLATES.deposit.target_item(depositItem),
      target_quantity:  QUEST_TEMPLATES.deposit.target_quantity,
    }),
    base("sell", {
      type:             "sell",
      title:            QUEST_TEMPLATES.sell.title,
      description:      QUEST_TEMPLATES.sell.description(),
      target_item:      QUEST_TEMPLATES.sell.target_item(),
      target_quantity:  QUEST_TEMPLATES.sell.target_quantity,
    }),
    base("produce", {
      type:             "produce",
      title:            QUEST_TEMPLATES.produce.title,
      description:      QUEST_TEMPLATES.produce.description(),
      target_item:      QUEST_TEMPLATES.produce.target_item(),
      target_quantity:  QUEST_TEMPLATES.produce.target_quantity,
    }),
    base("travel", {
      type:             "travel",
      title:            QUEST_TEMPLATES.travel.title,
      description:      QUEST_TEMPLATES.travel.description(),
      target_item:      QUEST_TEMPLATES.travel.target_item(),
      target_quantity:  QUEST_TEMPLATES.travel.target_quantity,
    }),
    base("profession", {
      type:             profType,
      title:            profQuest.title,
      description:      profQuest.desc + ` Récompense : ${reward("profession")}💰.`,
      target_item:      profQuest.item,
      target_quantity:  profQuest.qty,
    }),
    base("contribute", {
      type:             "contribute",
      title:            QUEST_TEMPLATES.contribute.title,
      description:      QUEST_TEMPLATES.contribute.description(contributeItem),
      target_item:      QUEST_TEMPLATES.contribute.target_item(contributeItem),
      target_quantity:  QUEST_TEMPLATES.contribute.target_quantity,
    }),
  ];
}

export const OBJECTIVE_TEMPLATES = {};
export const PROFESSION_EMOJIS = {
  Bûcheron: "🌲", Mineur: "⛏️", Fermier: "🌾", Tisserand: "🧵",
  Forgeron: "⚒️", Alchimiste: "🧪", Orfèvre: "💎", Marchand: "💼",
};

