/**
 * transactionTypes.js — Source de vérité des types de transactions or
 *
 * Importé par :
 *   - Dashboard.jsx        (journal joueur  → utilise TRANSACTION_LABELS)
 *   - MaireDashboard.jsx   (journal mairie  → utilise TX_LABELS, CITY_IN_TYPES, CITY_OUT_TYPES)
 *
 * Pour ajouter un type : l'ajouter ici UNIQUEMENT, les deux dashboards en héritent.
 *
 * Chaque entrée :
 *   icon  — emoji affiché
 *   label — texte humain court
 *   side  — "in" | "out" | "both" | "none"
 *             in   = rentre dans la trésorerie ville
 *             out  = sort de la trésorerie ville
 *             both = peut être les deux selon le signe (vols, etc.)
 *             none = flux joueur uniquement, n'affecte pas la trésorerie ville
 *   cityAmountInverted — optionnel, défaut true
 *             true  = les GoldTransaction sont enregistrées côté JOUEUR
 *                     (il faut donc inverser le signe pour voir l'impact ville)
 *             false = le montant est déjà stocké du point de vue ville
 *                     (treasury_decay → player_email="system")
 */

export const TRANSACTION_TYPES = {
  // ── Marché ──────────────────────────────────────────────────────────────
  vente:              { icon: "🏪", label: "Vente marché",              side: "none" },
  achat:              { icon: "🛒", label: "Achat marché",              side: "none" },
  taxe_marche:        { icon: "📊", label: "Taxe marché",               side: "in"   },
  // 20% du montant client va à la ville (le reste à l'artisan, paiement P2P)
  service_atelier:    { icon: "🏪", label: "Service d'atelier",         side: "in",  cityShare: 0.20 },

  // ── Fiscalité ────────────────────────────────────────────────────────────
  impot:              { icon: "💸", label: "Impôt journalier",          side: "in"   },
  peage:              { icon: "🏰", label: "Péage",                     side: "in"   },
  frais_voyage:       { icon: "🛤️", label: "Frais de voyage",           side: "none" },
  cout_production:    { icon: "⚒️", label: "Coût production",           side: "none" },

  // ── Logement & ville ─────────────────────────────────────────────────────
  // Or détruit (entretien purement coûteux pour le joueur, ne va pas à la ville)
  logement:           { icon: "🏠", label: "Entretien logement",         side: "none" },
  maire:              { icon: "👑", label: "Investiture maire",          side: "in"   },
  demenagement:       { icon: "🚚", label: "Déménagement",               side: "in"   },
  changement_metier:  { icon: "⚒️", label: "Changement de métier",       side: "in"   },
  // 20% du montant client va à la ville (le reste à l'artisan)
  amelioration_combat:{ icon: "🛠️", label: "Amélioration équipement",    side: "in",  cityShare: 0.20 },
  salaire:            { icon: "🎖️", label: "Salaire versé",              side: "out"  },
  salaire_maire:      { icon: "👑", label: "Salaire maire",              side: "out"  },
  salaire_resident:   { icon: "🎖️", label: "Salaire résident",           side: "out"  },
  entretien:          { icon: "🔧", label: "Entretien bâtiment",         side: "out"  },
  treasury_decay:     { icon: "📉", label: "Taxe de déclin",             side: "out",  cityAmountInverted: false },

  // ── Entrepôt ─────────────────────────────────────────────────────────────
  rachat_entrepot:  { icon: "📦", label: "Rachat entrepôt",           side: "out"  },
  rachat_t2t3:      { icon: "📦", label: "Rachat entrepôt T2/T3",     side: "out"  },

  // ── Banque ───────────────────────────────────────────────────────────────
  pret:             { icon: "🏦", label: "Prêt bancaire",             side: "none" },
  remboursement:    { icon: "💳", label: "Remboursement",             side: "none" },
  depot:            { icon: "🏦", label: "Dépôt bancaire",            side: "none" },
  retrait_depot:    { icon: "💰", label: "Retrait dépôt",             side: "none" },

  // ── Vols (côté joueur uniquement) ─────────────────────────────────────────
  vol_recu:         { icon: "🦹", label: "Vol réussi (reçu)",         side: "none" },
  vol_subi:         { icon: "😤", label: "Vol subi",                  side: "none" },
  vol_echoue:       { icon: "❌", label: "Tentative de vol échouée",  side: "none" },
  vol_repousse:     { icon: "🛡️", label: "Vol repoussé",              side: "none" },

  // ── Quêtes ───────────────────────────────────────────────────────────────
  objectif:         { icon: "🎯", label: "Objectif accompli",         side: "none" },
};

/**
 * Convertit le montant côté joueur en montant côté trésorerie ville.
 * Par défaut on inverse le signe (sauf pour les types marqués cityAmountInverted:false).
 * Si un type a un cityShare (ex: 0.20), on applique ce coefficient pour refléter
 * la part qui va vraiment au trésor (le reste va à un autre joueur).
 */
export function toCityAmount(tx) {
  const meta = TRANSACTION_TYPES[tx.type];
  if (!meta) return 0;
  const raw = tx.amount || 0;
  const inverted = meta.cityAmountInverted !== false; // défaut true
  const baseAmount = inverted ? -raw : raw;
  const share = meta.cityShare !== undefined ? meta.cityShare : 1;
  return Math.floor(baseAmount * share);
}

// ── Helpers Dashboard joueur ────────────────────────────────────────────────

/** Retourne { icon, label } pour un type donné (fallback générique). */
export function getTxLabel(type) {
  return TRANSACTION_TYPES[type] ?? { icon: "💱", label: type };
}

/** Types de vol — utilisés pour séparer le bloc "vols" dans Dashboard.jsx */
export const VOL_TYPES = new Set(["vol_recu", "vol_subi", "vol_echoue", "vol_repousse"]);

// ── Helpers Dashboard maire ─────────────────────────────────────────────────

/** Types qui renflouent la trésorerie de la ville. */
export const CITY_IN_TYPES = new Set(
  Object.entries(TRANSACTION_TYPES)
    .filter(([, v]) => v.side === "in")
    .map(([k]) => k)
);

/** Types qui font sortir de l'or de la trésorerie de la ville. */
export const CITY_OUT_TYPES = new Set(
  Object.entries(TRANSACTION_TYPES)
    .filter(([, v]) => v.side === "out")
    .map(([k]) => k)
);
