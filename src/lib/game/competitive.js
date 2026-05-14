// ═══════════════════════════════════════════════════════════════════════════
// competitive.js — Items inter-villes (rapports, traités, tracts, bourse...)
// ═══════════════════════════════════════════════════════════════════════════
// Chaque item a : un crafteur, un coût en faim à l'utilisation,
// un effet, une ville cible, et un délai d'activation (minuit suivant).
// Plafond : 1 item offensif par joueur par ville cible par jour.
//
// 11/05/2026 — Les 7 items T5 d'attaque inter-villes ont été RETIRÉS avec
// le système militaire (huile_inflammable, poudre_corrosive, festin_empoisonne,
// faux_contrat, cle_forgee, elixir_discorde, lettre_desinformation).
// Ne restent que les outils Marchand (non militaires) + les items T1.5
// transverses (camouflage, tracts_greve, bourse_protection, blocus).

export const COMPETITIVE_ITEMS = {

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
    effectValue: { max_stolen: 10, max_uses: 5 },
    description: "👜 Plafonne le vol subi à 10💰. Casse définitive après 5 attaques subies.",
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
