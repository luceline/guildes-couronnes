// src/lib/playerCumulators.js
//
// SOURCE UNIQUE DE VÉRITÉ pour les incréments de classement joueur.
// Tout changement aux compteurs all-time + mensuels passe par ces helpers.
//
// MOTIVATION (18/05/2026) :
//   Avant cette refacto, les compteurs étaient incrémentés à 15+ endroits
//   différents (Market, CityView, WarehouseUnified, CauldronPanel, etc.)
//   sans cohérence. Conséquence : pour ajouter le concours mensuel ou
//   modifier le calcul, il fallait patcher 15+ fichiers — fragile.
//
//   Désormais, tout passe par 4 helpers ci-dessous. Chacun renvoie un objet
//   `updates` à fusionner dans l'appel `PlayerProfile.update()`. Le calcul
//   du mois courant + reset paresseux est encapsulé.
//
// USAGE :
//   import { awardSales } from "@/lib/playerCumulators";
//   await base44.entities.PlayerProfile.update(profile.id, {
//     gold: profile.gold + amount,
//     ...awardSales(profile, amount),  // ← gère cumul_ventes_or + _mois
//   });

import { getMonthlyUpdates } from "./monthlyRanking";


// ─────────────────────────────────────────────────────────────────────────
// 1. VENTES (or reçu en vendant) → onglet 🛒 Vendeurs
// ─────────────────────────────────────────────────────────────────────────
/**
 * Incrémente cumul_ventes_or (all-time) + cumul_ventes_or_mois (mensuel).
 *
 * @param {object} profile  Profile actuel (lecture seule)
 * @param {number} goldAmount  Or reçu (positif)
 * @returns {object} Updates à fusionner dans l'appel PB
 */
export function awardSales(profile, goldAmount) {
  const amount = Math.max(0, Number(goldAmount) || 0);
  if (amount === 0) return {};
  return {
    cumul_ventes_or: (Number(profile?.cumul_ventes_or) || 0) + amount,
    ...getMonthlyUpdates(profile, { ventes_or: amount }),
  };
}


// ─────────────────────────────────────────────────────────────────────────
// 2. CONTRIBUTIONS ENTREPÔT → onglet 📦 Contributeurs
// ─────────────────────────────────────────────────────────────────────────
/**
 * Incrémente cumul_contributions_warehouse (all-time) + _mois.
 *
 * @param {object} profile  Profile actuel (lecture seule)
 * @param {number} qty      Quantité d'items déposés
 * @returns {object} Updates à fusionner
 */
export function awardContribution(profile, qty) {
  const amount = Math.max(0, Number(qty) || 0);
  if (amount === 0) return {};
  return {
    cumul_contributions_warehouse: (Number(profile?.cumul_contributions_warehouse) || 0) + amount,
    ...getMonthlyUpdates(profile, { contributions_warehouse: amount }),
  };
}


// ─────────────────────────────────────────────────────────────────────────
// 3. COURONNES MAGIQUES → onglet 👑 Couronnes + 🏆 Concours mensuel
// ─────────────────────────────────────────────────────────────────────────
/**
 * Incrémente cumul_couronnes_total (all-time) + cumul_couronnes_mois.
 *
 * @param {object} profile  Profile actuel (lecture seule)
 * @param {number} points   Score de la couronne (fer 34, bronze 92, argent 174, or 256)
 * @returns {object} Updates à fusionner
 */
export function awardCouronne(profile, points) {
  const amount = Math.max(0, Number(points) || 0);
  if (amount === 0) return {};
  return {
    cumul_couronnes_total: (Number(profile?.cumul_couronnes_total) || 0) + amount,
    ...getMonthlyUpdates(profile, { couronnes: amount }),
  };
}


// ─────────────────────────────────────────────────────────────────────────
// 4. XP (player_xp_total existe déjà, on ajoute juste le _mois)
//    Note : pour rester compatible avec grantXP() de playerLevelSystem.js,
//    on ne touche PAS à player_xp_total ici. C'est grantXP qui calcule
//    newXPTotal + level + appelle getMonthlyUpdates en interne.
//
//    Cette fonction est utile pour les rares endroits qui incrémentent
//    player_xp_total directement SANS passer par grantXP (Production.jsx,
//    InventoryPanel.jsx). On expose un wrapper qui fait les 2 + level-up.
// ─────────────────────────────────────────────────────────────────────────
import { getLevelFromXP } from "./playerLevelSystem";

/**
 * Wrapper complet pour incrémenter player_xp_total + cumul_xp_mois + level-up.
 *
 * @param {object} profile  Profile actuel
 * @param {number} xpAmount XP à ajouter
 * @returns {{ updates, leveledUp, newLevel, oldLevel }}
 */
export function awardXP(profile, xpAmount) {
  const amount = Math.max(0, Number(xpAmount) || 0);
  if (amount === 0) {
    return {
      updates: {},
      leveledUp: false,
      newLevel: getLevelFromXP(profile?.player_xp_total || 0),
      oldLevel: getLevelFromXP(profile?.player_xp_total || 0),
    };
  }
  const oldXP = Number(profile?.player_xp_total) || 0;
  const newXPTotal = oldXP + amount;
  const oldLevel = getLevelFromXP(oldXP);
  const newLevel = getLevelFromXP(newXPTotal);
  const leveledUp = newLevel > oldLevel;

  const updates = {
    player_xp_total: newXPTotal,
    ...getMonthlyUpdates(profile, { xp: amount }),
  };
  if (leveledUp) updates.player_level = newLevel;

  return { updates, leveledUp, newLevel, oldLevel };
}


// ─────────────────────────────────────────────────────────────────────────
// 5. MULTI — combine plusieurs catégories en UN SEUL appel
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ IMPORTANT : ne pas spread plusieurs awardX() sur le même update PB.
// Quand on bascule de mois, chaque awardX() inclut un reset à 0 des autres
// champs _mois, ce qui écrase les valeurs des spreads précédents. Bug subtil
// qui ne se déclenche que le 1er du mois — silencieux le reste du temps.
//
// Solution : utiliser awardMulti qui fait UN seul appel à getMonthlyUpdates
// avec toutes les catégories en même temps.
//
// USAGE :
//   await base44.entities.PlayerProfile.update(profile.id, {
//     gold: profile.gold + totalGold,
//     inventory: newInv,
//     ...awardMulti(profile, { sales: totalGold, contributions: actualQty }),
//   });
/**
 * @param {object} profile
 * @param {object} amounts   { sales?, contributions?, xp?, couronnes? }
 * @returns {object} Updates combinés (all-time + mensuel cohérent)
 */
export function awardMulti(profile, amounts = {}) {
  const sales = Math.max(0, Number(amounts.sales) || 0);
  const contributions = Math.max(0, Number(amounts.contributions) || 0);
  const xp = Math.max(0, Number(amounts.xp) || 0);
  const couronnes = Math.max(0, Number(amounts.couronnes) || 0);

  const updates = {};

  if (sales > 0) {
    updates.cumul_ventes_or = (Number(profile?.cumul_ventes_or) || 0) + sales;
  }
  if (contributions > 0) {
    updates.cumul_contributions_warehouse = (Number(profile?.cumul_contributions_warehouse) || 0) + contributions;
  }
  if (couronnes > 0) {
    updates.cumul_couronnes_total = (Number(profile?.cumul_couronnes_total) || 0) + couronnes;
  }
  if (xp > 0) {
    const oldXP = Number(profile?.player_xp_total) || 0;
    const newXPTotal = oldXP + xp;
    updates.player_xp_total = newXPTotal;
    const oldLevel = getLevelFromXP(oldXP);
    const newLevel = getLevelFromXP(newXPTotal);
    if (newLevel > oldLevel) updates.player_level = newLevel;
  }

  // UN seul appel monthly pour toutes les catégories actives
  const monthlyDeltas = {};
  if (sales > 0) monthlyDeltas.ventes_or = sales;
  if (contributions > 0) monthlyDeltas.contributions_warehouse = contributions;
  if (couronnes > 0) monthlyDeltas.couronnes = couronnes;
  if (xp > 0) monthlyDeltas.xp = xp;

  if (Object.keys(monthlyDeltas).length > 0) {
    Object.assign(updates, getMonthlyUpdates(profile, monthlyDeltas));
  }

  return updates;
}
