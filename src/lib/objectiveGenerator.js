import { ITEMS } from "./craftingData.js";

// ── Récompenses de quêtes : montant fixe par type ──
export const QUEST_REWARDS = {
  // Quêtes existantes
  deposit:    20,
  sell:        5,
  produce:    15,  // Artisan actif (T2/T3 craft) : récompense plus élevée car craft = effort + ressources
  travel:      5,
  profession:  5,
  contribute: 20,
  // Nouvelles quêtes (toutes à 5 or)
  deposit_t1:  5,
  buy:         5,
  pvp:         5,
  cauldron:    5,
  dice:        5,
  statue:      5,
};

// ── T2_DEPOSIT_ITEMS : dérivé automatique depuis ITEMS ──
export const T2_DEPOSIT_ITEMS = Object.entries(ITEMS)
  .filter(([, v]) => v.tier === 2 && v.trigger !== "attack" && v.trigger !== "sellable")
  .map(([key, v]) => ({ key, name: v.name, icon: v.icon }));

// ── T2 principal par profession (utilisé pour les quêtes deposit/contribute) ──
export const PROFESSION_T2 = {
  "Bûcheron":  { key: "planches",    name: "Planches",    icon: "🪵" },
  "Mineur":    { key: "pierre_brute",name: "Pierre taillée",icon: "🗿" },
  "Fermier":   { key: "farine",      name: "Farine",      icon: "🧺" },
  "Tisserand": { key: "fil",         name: "Fil",         icon: "🧵" },
  "Forgeron":  { key: "charbon",     name: "Charbon",     icon: "⚫" },
  "Alchimiste":{ key: "extrait",     name: "Extrait",     icon: "🫗" },
  "Orfèvre":   { key: "quartz_poli", name: "Quartz poli", icon: "💠" },
  "Marchand":  { key: "encre",       name: "Encre",       icon: "🖋️" },
};

// ── QUEST_TEMPLATES : source de vérité des quêtes ──
// Pour modifier une quête : toucher uniquement ce bloc.
// reward: voir QUEST_REWARDS en haut du fichier
export const QUEST_TEMPLATES = {

  // ═══ QUÊTES "ANCIENNES" ═══

  deposit: {
    title: "📦 Approvisionnement",
    // item = T2 de la profession active du joueur : déposé dans SA ville
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
    // item = T2 de la profession active du joueur : déposé dans une AUTRE ville (implique voyage)
    description: (item) => `Exportez votre savoir-faire ! Déposez 2 ${item.icon} ${item.name} dans l'entrepôt d'une ville étrangère.`,
    target_item: (item) => item.key,
    target_quantity: 2,
    reward: "base",
  },

  // ═══ NOUVELLES QUÊTES (toutes 5 or) ═══

  deposit_t1: {
    title: "🌾 Réserves communales",
    description: () => "Approvisionnez l'entrepôt en ressources brutes. Déposez 10 items T1 (au choix) dans n'importe quel entrepôt.",
    target_item: () => "any_t1",
    target_quantity: 10,
    reward: "small",
  },

  buy: {
    title: "🛒 Acheteur compulsif",
    description: () => "Faites tourner l'économie. Achetez 10 objets au marché, peu importe lesquels.",
    target_item: () => "any",
    target_quantity: 10,
    reward: "small",
  },

  pvp: {
    title: "⚔️ Lance le défi",
    description: () => "Croisez le fer. Lancez 1 combat zoné contre un autre joueur (peu importe l'issue).",
    target_item: () => "any",
    target_quantity: 1,
    reward: "small",
  },

  cauldron: {
    title: "🪄 Mage d'un jour",
    description: () => "Invoquez les arts magiques. Utilisez votre chaudron une fois aujourd'hui (n'importe quel rang).",
    target_item: () => "any",
    target_quantity: 1,
    reward: "small",
  },

  dice: {
    title: "🎲 Tenter sa chance",
    description: () => "La taverne réclame de l'animation. Lancez un défi à la table de hazart.",
    target_item: () => "any",
    target_quantity: 1,
    reward: "small",
  },

  statue: {
    title: "🗿 Offrande royale",
    description: () => "La statue itinérante attend votre tribut. Faites une offrande aujourd'hui.",
    target_item: () => "any",
    target_quantity: 1,
    reward: "small",
  },

  // ── Quête métier : titre/desc/item/qty définis dans PROFESSION_QUESTS ──
  profession: {
    reward: "big",
  },
};

// ── PROFESSION_QUESTS : quêtes spéciales par métier ──
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
    // 13/05/2026 — Remplacement de autorisation_marche par billet_fortune
    // (T1 Marchand actuel depuis la refonte du 10/05). Avant cette refonte,
    // autorisation_marche était l'item de profession Marchand mais elle a été
    // retirée du jeu en tant que recette. La quête tirait donc un item
    // impossible à produire → blocage joueur.
    { title: "🎫 Imprimeur de billets",  item: "billet_fortune", qty: 8, desc: "Produisez 8 billets de fortune." },
    { title: "💼 Négociant",             item: "any_t2", qty: 4, desc: "Mettez en vente 4 items T2 ou T3." },
  ],
};

// ── POOL_OF_RANDOM_QUESTS : quêtes pouvant sortir au hasard ──
// La quête métier (profession) reste GARANTIE chaque jour, hors de ce pool.
// Parmi ce pool, on tire 5 quêtes au hasard pour compléter les 6 du jour.
const POOL_OF_RANDOM_QUESTS = [
  "deposit", "sell", "produce", "travel", "contribute",     // 5 anciennes
  "deposit_t1", "buy", "pvp", "cauldron", "dice", "statue", // 6 nouvelles
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Tire `count` éléments distincts au hasard d'un tableau (Fisher-Yates partiel).
 */
function pickRandomDistinct(arr, count) {
  const copy = [...arr];
  const result = [];
  while (result.length < count && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

/**
 * Génère 6 quêtes quotidiennes pour un joueur.
 *
 * Stratégie (mai 2026) : 1 quête métier GARANTIE + 5 quêtes tirées au hasard
 * parmi un pool de 11 candidats. Garantit qu'un joueur a toujours au moins
 * une quête liée à son métier, mais varie le reste pour éviter la routine.
 *
 * Pour modifier les quêtes : toucher QUEST_TEMPLATES, PROFESSION_QUESTS,
 * ou POOL_OF_RANDOM_QUESTS ci-dessus.
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

  // ── 1. Quête métier : toujours présente ──
  const professionQuest = base("profession", {
    type:             profType,
    title:            profQuest.title,
    description:      profQuest.desc + ` Récompense : ${reward("profession")}💰.`,
    target_item:      profQuest.item,
    target_quantity:  profQuest.qty,
  });

  // ── 2. Tirage de 5 quêtes au hasard parmi le pool ──
  const pickedTypes = pickRandomDistinct(POOL_OF_RANDOM_QUESTS, 5);

  // ── 3. Construction des 5 quêtes tirées ──
  const buildQuestFromType = (type) => {
    switch (type) {
      case "deposit":
        return base("deposit", {
          type:            "deposit",
          title:           QUEST_TEMPLATES.deposit.title,
          description:     QUEST_TEMPLATES.deposit.description(depositItem),
          target_item:     QUEST_TEMPLATES.deposit.target_item(depositItem),
          target_quantity: QUEST_TEMPLATES.deposit.target_quantity,
        });
      case "sell":
        return base("sell", {
          type:            "sell",
          title:           QUEST_TEMPLATES.sell.title,
          description:     QUEST_TEMPLATES.sell.description(),
          target_item:     QUEST_TEMPLATES.sell.target_item(),
          target_quantity: QUEST_TEMPLATES.sell.target_quantity,
        });
      case "produce":
        return base("produce", {
          type:            "produce",
          title:           QUEST_TEMPLATES.produce.title,
          description:     QUEST_TEMPLATES.produce.description(),
          target_item:     QUEST_TEMPLATES.produce.target_item(),
          target_quantity: QUEST_TEMPLATES.produce.target_quantity,
        });
      case "travel":
        return base("travel", {
          type:            "travel",
          title:           QUEST_TEMPLATES.travel.title,
          description:     QUEST_TEMPLATES.travel.description(),
          target_item:     QUEST_TEMPLATES.travel.target_item(),
          target_quantity: QUEST_TEMPLATES.travel.target_quantity,
        });
      case "contribute":
        return base("contribute", {
          type:            "contribute",
          title:           QUEST_TEMPLATES.contribute.title,
          description:     QUEST_TEMPLATES.contribute.description(contributeItem),
          target_item:     QUEST_TEMPLATES.contribute.target_item(contributeItem),
          target_quantity: QUEST_TEMPLATES.contribute.target_quantity,
        });
      case "deposit_t1":
        return base("deposit_t1", {
          type:            "deposit_t1",
          title:           QUEST_TEMPLATES.deposit_t1.title,
          description:     QUEST_TEMPLATES.deposit_t1.description(),
          target_item:     QUEST_TEMPLATES.deposit_t1.target_item(),
          target_quantity: QUEST_TEMPLATES.deposit_t1.target_quantity,
        });
      case "buy":
        return base("buy", {
          type:            "buy",
          title:           QUEST_TEMPLATES.buy.title,
          description:     QUEST_TEMPLATES.buy.description(),
          target_item:     QUEST_TEMPLATES.buy.target_item(),
          target_quantity: QUEST_TEMPLATES.buy.target_quantity,
        });
      case "pvp":
        return base("pvp", {
          type:            "pvp",
          title:           QUEST_TEMPLATES.pvp.title,
          description:     QUEST_TEMPLATES.pvp.description(),
          target_item:     QUEST_TEMPLATES.pvp.target_item(),
          target_quantity: QUEST_TEMPLATES.pvp.target_quantity,
        });
      case "cauldron":
        return base("cauldron", {
          type:            "cauldron",
          title:           QUEST_TEMPLATES.cauldron.title,
          description:     QUEST_TEMPLATES.cauldron.description(),
          target_item:     QUEST_TEMPLATES.cauldron.target_item(),
          target_quantity: QUEST_TEMPLATES.cauldron.target_quantity,
        });
      case "dice":
        return base("dice", {
          type:            "dice",
          title:           QUEST_TEMPLATES.dice.title,
          description:     QUEST_TEMPLATES.dice.description(),
          target_item:     QUEST_TEMPLATES.dice.target_item(),
          target_quantity: QUEST_TEMPLATES.dice.target_quantity,
        });
      case "statue":
        return base("statue", {
          type:            "statue",
          title:           QUEST_TEMPLATES.statue.title,
          description:     QUEST_TEMPLATES.statue.description(),
          target_item:     QUEST_TEMPLATES.statue.target_item(),
          target_quantity: QUEST_TEMPLATES.statue.target_quantity,
        });
      default:
        return null;
    }
  };

  const randomQuests = pickedTypes.map(buildQuestFromType).filter(Boolean);

  return [professionQuest, ...randomQuests];
}

export const OBJECTIVE_TEMPLATES = {};
export const PROFESSION_EMOJIS = {
  Bûcheron: "🌲", Mineur: "⛏️", Fermier: "🌾", Tisserand: "🧵",
  Forgeron: "⚒️", Alchimiste: "🧪", Orfèvre: "💎", Marchand: "💼",
};
