// ═══════════════════════════════════════════════════════════════════════════
// professions.js — Métiers du jeu et catégories d'items
// ═══════════════════════════════════════════════════════════════════════════
// 8 professions actives : Bûcheron, Mineur, Fermier, Tisserand, Forgeron,
// Alchimiste, Orfèvre, Marchand. Chacune a un kit de départ (startItems)
// distribué à la création du personnage.
//
// ITEM_CATEGORIES sert au tri/affichage de l'inventaire (icône + couleur
// par catégorie). La liste reflète les catégories réellement utilisées par
// les items dans craftingData.js.

export const PROFESSIONS = {
  Bûcheron:   { icon: "🪓", description: "Source principale de bois, chanvre et charbon. Fournit Forgeron, Orfèvre, Tisserand et Marchand en matières premières.",
    startItems: [{ item_key: "bois_brut",   item_name: "Bois brut",   item_category: "bois",      quantity: 20 }] },
  Mineur:     { icon: "⛏️", description: "Extrait pierre et minerai pour le Forgeron, et polit le quartz brut de l'Orfèvre — clé indispensable pour les lingots d'or.",
    startItems: [{ item_key: "pierre_brute", item_name: "Pierre taillée", item_category: "pierre",   quantity: 16 },
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
  Marchand:   { icon: "🏪", description: "Privilèges singuliers : exonération de taxe à l'achat sur tous les marchés, et revente quotidienne à l'entrepôt de sa propre ville (jusqu'à 200💰/jour, prix marché) même sans offre du maire.",
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
  jetons:     { icon: "🪙", color: "text-amber-500" },
  ressources_rares: { icon: "✨", color: "text-violet-600" },
};
