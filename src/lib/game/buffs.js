// ═══════════════════════════════════════════════════════════════════════════
// buffs.js — Bonus actifs sur un profil joueur (passifs items + temporaires)
// ═══════════════════════════════════════════════════════════════════════════
// Tous les helpers qui prennent un `profile` et renvoient un bonus chiffré.
// Catégories :
//   - Passifs items (présence d'un item en inventaire) : Tunique, Outils,
//     Planches (cooldown), Lingots/Pierre (énergie max), Tissu/Fil (invent),
//     Besace (voyage), Charbon (double prod)
//   - Temporaires (timestamp expires_at sur le profile) : cooldown, énergie,
//     inventaire, convoi (×2 invent), biome cooldown
//   - Taxe marché : passive items → getActiveTaxDiscountItem / getMarketTaxDiscount
//   - Bourse de protection (T1.5) : tracking max 5 utilisations
//
// La source de vérité des `value` d'effet est craftingData.ITEMS — voir
// _passiveEffectValueFromItem.

import { ITEMS as ITEMS_DEF } from "../craftingData.js";

// ── Bonus passif cooldown ──
// Règles de cumul :
//   - Tunique / Outils / Planches = sources d'items, MAX entre elles (non cumulable)
//   - Bonus item temporaire (cooldown_bonus_value) = MAX avec les passifs items
//     (même catégorie : un seul item à la fois)
//   - Bonus biome (combat épique, biome_cooldown_bonus_value) = CUMULABLE avec tout
//     (catégorie distincte : récompense d'activité, pas un objet)
//
// Sources items : planches T2 (−20%), outils T4 (−30%), armure/Tunique T4 (−40%)
// Source biome : −10% pendant 1h après combat épique réussi
export function getPassiveCooldownBonus(profile) {
  const inv = profile.inventory || [];
  let itemValue = 0;
  // Tunique (armure) : −40%
  if (inv.some(i => i.item_key === "armure" && (i.quantity || 0) > 0)) {
    itemValue = Math.max(itemValue, 0.40);
  }
  // Outils : −30% (durabilité, mais effet passif tant que présent)
  if (inv.some(i => i.item_key === "outils" && (i.quantity || 0) > 0 && (i.durability ?? 4) > 0)) {
    itemValue = Math.max(itemValue, 0.30);
  }
  // Planches : −20%
  if (inv.some(i => i.item_key === "planches" && (i.quantity || 0) > 0)) {
    itemValue = Math.max(itemValue, 0.20);
  }
  // Bonus item temporaire (planches activées, meuble) : même catégorie que les passifs items
  if (profile.cooldown_bonus_expires_at && new Date(profile.cooldown_bonus_expires_at) > new Date()) {
    itemValue = Math.max(itemValue, profile.cooldown_bonus_value || 0);
  }
  // Bonus biome (combat épique) : CUMULABLE avec les sources items
  let biomeValue = 0;
  if (profile.biome_cooldown_bonus_expires_at && new Date(profile.biome_cooldown_bonus_expires_at) > new Date()) {
    biomeValue = profile.biome_cooldown_bonus_value || 0;
  }
  // Plafond de sécurité à 0.85 pour éviter qu'un cooldown tombe à zéro
  return Math.min(0.85, itemValue + biomeValue);
}

// Helper exposé : retourne la meilleure source passive cooldown active
// (utilisé par la status bar pour afficher le bon item)
export function getBestPassiveCooldownSource(profile) {
  const inv = profile.inventory || [];
  if (inv.some(i => i.item_key === "armure" && (i.quantity || 0) > 0)) {
    return { item: "armure", name: "Tunique de travail", icon: "🥋", value: 0.40 };
  }
  if (inv.some(i => i.item_key === "outils" && (i.quantity || 0) > 0 && (i.durability ?? 4) > 0)) {
    return { item: "outils", name: "Outils", icon: "🔧", value: 0.30 };
  }
  if (inv.some(i => i.item_key === "planches" && (i.quantity || 0) > 0)) {
    return { item: "planches", name: "Planches", icon: "🪵", value: 0.20 };
  }
  return null;
}

// Helper : lit le `value` d'un effet passif d'item depuis ITEMS_DEF.
// Source unique de vérité = craftingData.ITEMS. Évite la duplication des
// constantes dans le code et garantit la cohérence avec la description
// affichée au joueur (`use`).
function _passiveEffectValueFromItem(itemKey, expectedEffect) {
  const def = ITEMS_DEF[itemKey];
  if (!def || def.trigger !== "passive" || def.effect !== expectedEffect) return 0;
  return def.value || 0;
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

// ── DEPRECATED ── Réduction cooldown production temporaire
// Cette fonction a été absorbée dans getPassiveCooldownBonus pour gérer le
// cumul correct entre items passifs et bonus biome. Conservée pour compat avec
// d'éventuels appelants externes, mais à ne plus utiliser dans le nouveau code.
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

// Lit dynamiquement les valeurs depuis ITEMS_DEF (craftingData.js).
// Si on rebalance pierre_brute ou lingots_fer, ce code n'a pas besoin d'être touché.
export function getPassiveEnergyMaxBonus(profile) {
  const inv = profile.inventory || [];
  let best = 0;
  for (const itemKey of ["lingots_fer", "pierre_brute"]) {
    if (inv.some(i => i.item_key === itemKey && (i.quantity || 0) > 0)) {
      best = Math.max(best, _passiveEffectValueFromItem(itemKey, "energy_max_bonus"));
    }
  }
  // Bonus permanent du chaudron (Pierre énergétique) : se cumule avec le max temp/passif
  const permaBonus = profile.energy_max_perma_bonus || 0;
  // Comparer avec bonus temporaire
  return Math.max(best, getTemporaryEnergyMaxBonus(profile)) + permaBonus;
}

// Lit dynamiquement les valeurs depuis ITEMS_DEF (craftingData.js).
// Si on rebalance fil ou tissu, ce code n'a pas besoin d'être touché.
export function getPassiveInventoryBonus(profile) {
  const inv = profile.inventory || [];
  let best = 0;
  for (const itemKey of ["tissu", "fil"]) {
    if (inv.some(i => i.item_key === itemKey && (i.quantity || 0) > 0)) {
      best = Math.max(best, _passiveEffectValueFromItem(itemKey, "inventory_bonus"));
    }
  }
  // Comparer avec bonus temporaire
  return Math.max(best, getTemporaryInventoryBonus(profile));
}

// ── Réduction taxe marché acheteur ──
// Dérivé automatiquement depuis ITEMS (effect === "market_tax_discount"), trié par value desc.
// Pour ajouter un item tax-discount : ajoutez-le dans ITEMS avec effect: "market_tax_discount".
//
// Deux fonctions exposées :
//   - getMarketTaxDiscount(profile)     → renvoie juste la valeur (0.04, 0.03, ...) ou 0
//   - getActiveTaxDiscountItem(profile) → renvoie l'item gagnant complet { key, name, value }
//                                         ou null. Utilisé par l'UI pour afficher le label.
//
// Les deux fonctions partagent la même source (_TAX_DISCOUNTS) donc impossible
// qu'elles divergent : si vous changez la liste d'items côté ITEMS, les deux
// fonctions reflètent automatiquement le changement.
const _TAX_DISCOUNTS = Object.entries(ITEMS_DEF)
  .filter(([, v]) => v.effect === "market_tax_discount" && v.trigger === "passive")
  .map(([key, v]) => ({ key, name: v.name, value: v.value }))
  .sort((a, b) => b.value - a.value);

/** Renvoie l'item tax-discount actif (le meilleur dans l'inventaire) ou null.
 *  Format: { key, name, value }. Source unique pour le calcul ET l'affichage. */
export function getActiveTaxDiscountItem(profile) {
  const inv = profile?.inventory || [];
  for (const d of _TAX_DISCOUNTS) {
    if (inv.some(i => i.item_key === d.key && (i.quantity || 0) > 0)) return d;
  }
  return null;
}

/** Renvoie la valeur de réduction de taxe (0 à 1) appliquée au profil, ou 0. */
export function getMarketTaxDiscount(profile) {
  return getActiveTaxDiscountItem(profile)?.value ?? 0;
}

// ─────────────────────────────────────────────
// REFONTE ITEMS v5 — nouveaux helpers passifs
// ─────────────────────────────────────────────

// ── Sac de voyage T4 : passif PERMANENT -50% durée voyage ──
// Renvoie 0.50 si la besace est dans l'inventaire, 0 sinon.
// Branché dans Travel.jsx pour appliquer baseMinutes × (1 - discount).
export function getPassiveTravelDiscount(profile) {
  const inv = profile.inventory || [];
  if (inv.some(i => i.item_key === "besace" && (i.quantity || 0) > 0)) {
    return 0.50;
  }
  return 0;
}

// ── Charbon T2 : passif +5% double prod (s'AJOUTE aux bonus biome et niveau) ──
// Non-cumulable avec lui-même : un charbon en stock = +5%, peu importe la quantité.
// Renvoie 0.05 si charbon présent, 0 sinon.
export function getPassiveCharbonDoubleProdBonus(profile) {
  const inv = profile.inventory || [];
  if (inv.some(i => i.item_key === "charbon" && (i.quantity || 0) > 0)) {
    return 0.05;
  }
  return 0;
}

// ── Bourse de protection T1.5 : tracking max 5 utilisations ──
// Le profil stocke `bourse_uses_left` (initialisé à 5 quand on craft une bourse).
// Si non défini sur le profil, on retourne 5 par défaut (rétro-compat).
// Quand on retombe à 0, la bourse se brise (à nettoyer côté combat).
export function getBourseUsesLeft(profile) {
  const inv = profile.inventory || [];
  const hasBourse = inv.some(i => i.item_key === "bourse_protection" && (i.quantity || 0) > 0);
  if (!hasBourse) return 0;
  // Si pas encore défini, considère 5 par défaut (l'item a été crafté avant la refonte v5)
  return profile.bourse_uses_left ?? 5;
}

// Calcule le nouvel état du profil après une attaque subie consommant 1 utilisation.
// Retourne { updates, broken } : updates = champs PlayerProfile à patcher, broken = bool.
// - Si la bourse a encore des charges après décrément → updates.bourse_uses_left mis à jour
// - Si la bourse tombe à 0 → updates.inventory met le bourse_protection à 0 et le filtre,
//   et updates.bourse_uses_left = null (reset pour la prochaine bourse craftée)
export function consumeBourseUse(profile) {
  const inv = profile.inventory || [];
  const hasBourse = inv.some(i => i.item_key === "bourse_protection" && (i.quantity || 0) > 0);
  if (!hasBourse) return { updates: {}, broken: false }; // pas de bourse, rien à faire
  const usesLeft = profile.bourse_uses_left ?? 5;
  // Cas 1 : compteur > 1 → on décrémente normalement
  if (usesLeft > 1) {
    return { updates: { bourse_uses_left: usesLeft - 1 }, broken: false };
  }
  // Cas 2 : compteur <= 1 (1 ou stuck à 0) → casser la bourse maintenant
  // Cela inclut les bourses "stuck à 0" qui n'avaient pas été cassées correctement.
  const newInv = inv
    .map(i => i.item_key === "bourse_protection" ? { ...i, quantity: (i.quantity || 0) - 1 } : i)
    .filter(i => (i.quantity || 0) > 0);
  return {
    updates: { inventory: newInv, bourse_uses_left: null },
    broken: true,
  };
}
