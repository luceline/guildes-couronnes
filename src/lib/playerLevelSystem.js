// ─────────────────────────────────────────────
// SYSTÈME DE NIVEAU DE JOUEUR
// ─────────────────────────────────────────────
// 1 ressource rare = 100 XP (échange et consommation)
// Niveaux 1-50, courbe exponentielle
// +5% drop rare + -2% cooldown par 5 niveaux

// 18/05/2026 — Concours mensuel : l'XP gagnée est aussi comptée dans
// cumul_xp_mois (reset paresseux + récompenses 100/50/20 top 3 le 1er).
import { getMonthlyUpdates } from "./monthlyRanking";

const MAX_PLAYER_LEVEL = 50;

// XP requise par niveau (courbe exponentielle : 1.15× multiplicateur)
function getXPRequiredForLevel(level) {
  // Level 1 = 0 XP, Level 2 = 100 XP, Level 3 = 215 XP, Level 4 = 347 XP...
  let xp = 0;
  for (let i = 1; i < level; i++) {
    xp += Math.floor(100 * Math.pow(1.15, i - 1));
  }
  return xp;
}

// Obtenir le niveau actuel à partir de l'XP total
export function getLevelFromXP(totalXP) {
  for (let level = MAX_PLAYER_LEVEL; level >= 1; level--) {
    if (totalXP >= getXPRequiredForLevel(level)) {
      return level;
    }
  }
  return 1;
}

// Obtenir l'XP requis pour le prochain niveau
export function getXPForNextLevel(currentLevel) {
  if (currentLevel >= MAX_PLAYER_LEVEL) return null;
  return getXPRequiredForLevel(currentLevel + 1);
}

// Obtenir l'XP actuelle du joueur (depuis le dernier level)
export function getCurrentLevelXP(totalXP) {
  const level = getLevelFromXP(totalXP);
  const xpForThisLevel = getXPRequiredForLevel(level);
  return totalXP - xpForThisLevel;
}

// Obtenir l'XP requise pour progresser dans le level actuel
export function getXPNeededForLevelUp(currentLevel, totalXP) {
  if (currentLevel >= MAX_PLAYER_LEVEL) return null;
  const xpForThisLevel = getXPRequiredForLevel(currentLevel);
  const xpForNextLevel = getXPRequiredForLevel(currentLevel + 1);
  return xpForNextLevel - xpForThisLevel;
}

// Calculer les bonus du joueur par niveau
export function getPlayerLevelBonuses(level) {
  const lvl = Math.max(1, Math.min(level || 1, MAX_PLAYER_LEVEL));
  const fullTiers = Math.floor((lvl - 1) / 5); // Nombre de paliers complets de 5

  return {
    dropRareBonus:           fullTiers * 5,  // +5% drop rare tous les 5 niveaux
    cooldownBonus:           lvl - 1,        // −1% cooldown par niveau (−1% à lvl2, −49% à lvl50)
    doubleProductionBonus:   lvl - 1,        // +1% chance double production par niveau
  };
}

// Informations de prestige du joueur
export function getPlayerLevelInfo(totalXP) {
  const level = getLevelFromXP(totalXP);
  const xpForThisLevel = getXPRequiredForLevel(level);
  const xpForNextLevel = getXPRequiredForLevel(Math.min(level + 1, MAX_PLAYER_LEVEL));
  const currentLevelXP = totalXP - xpForThisLevel;
  const levelDuration = xpForNextLevel - xpForThisLevel;
  const progressPercent = levelDuration > 0 ? (currentLevelXP / levelDuration) * 100 : 100;

  return {
    level,
    totalXP,
    currentLevelXP,
    xpForNextLevel,
    levelDuration,
    progressPercent: Math.min(100, progressPercent),
    isMaxLevel: level >= MAX_PLAYER_LEVEL,
    bonuses: getPlayerLevelBonuses(level),
  };
}

// Consommer une ressource rare (1 ressource = 100 XP)
export function consumeRareResource(profile) {
  const newXPTotal = (profile.player_xp_total || 0) + 100;
  const newLevel = getLevelFromXP(newXPTotal);
  const oldLevel = getLevelFromXP(profile.player_xp_total || 0);
  const leveledUp = newLevel > oldLevel;

  return {
    newXPTotal,
    newLevel,
    leveledUp,
    oldLevel,
  };
}

// ─────────────────────────────────────────────
// Tableau central des récompenses XP
// Pour ajuster le rythme global de progression, modifier ici.
// ─────────────────────────────────────────────
export const XP_REWARDS = {
  // Production / récolte
  HARVEST_T1:        1,   // récolte sur biome (handleFarm dans Production.jsx)
  CRAFT_T2:          2,
  CRAFT_T3:          3,
  CRAFT_T4:          5,
  CRAFT_T5:          8,
  // Combat
  COMBAT_KILL:       1,   // par mob tué
  COMBAT_WAVE_DONE:  2,   // bonus pour vague complète
  COMBAT_EPIC_DONE: 10,   // bonus pour épopée complète (toutes vagues)
  // Consommation d'aliments
  CONSUME_BLE:       1,
  CONSUME_HERBES:    1,
  // Activation ressource rare (déjà défini dans rareResources.js comme XP_PER_RARE_RESOURCE)
};

/**
 * Récompense d'XP de craft selon le tier produit.
 * @param {number} tier
 * @returns {number} Gain XP, ou 0 si tier non standard
 */
export function getCraftXPReward(tier) {
  switch (tier) {
    case 2: return XP_REWARDS.CRAFT_T2;
    case 3: return XP_REWARDS.CRAFT_T3;
    case 4: return XP_REWARDS.CRAFT_T4;
    case 5: return XP_REWARDS.CRAFT_T5;
    default: return 0;
  }
}

/**
 * Calcule l'effet d'un gain d'XP sur un profil.
 * Ne modifie pas le profil — retourne juste les données à passer à PlayerProfile.update
 * et au toast.
 *
 * @param {object} profile - Le profil joueur courant (lecture uniquement)
 * @param {number} xpAmount - Le nombre d'XP à ajouter
 * @returns {{
 *   newXPTotal: number,
 *   oldLevel: number,
 *   newLevel: number,
 *   leveledUp: boolean,
 *   updates: { player_xp_total: number, player_level?: number }
 * }}
 *
 * Usage typique :
 *   const xp = grantXP(profile, XP_REWARDS.HARVEST_T1);
 *   await base44.entities.PlayerProfile.update(profile.id, { ...otherUpdates, ...xp.updates });
 *   toast.success(`✨ +${xpAmount} XP`);
 *   if (xp.leveledUp) toast.success(`🌟 Niveau ${xp.newLevel} atteint !`);
 */
export function grantXP(profile, xpAmount) {
  const oldXP = profile?.player_xp_total || 0;
  const newXPTotal = oldXP + xpAmount;
  const oldLevel = getLevelFromXP(oldXP);
  const newLevel = getLevelFromXP(newXPTotal);
  const leveledUp = newLevel > oldLevel;

  // 18/05/2026 — Concours mensuel : on injecte aussi cumul_xp_mois (et le
  // reset paresseux si nécessaire) directement dans les updates retournés.
  // Les appelants n'ont rien à faire en plus, ça passe transparent.
  const monthlyUpdates = getMonthlyUpdates(profile, { xp: xpAmount });

  const updates = { player_xp_total: newXPTotal, ...monthlyUpdates };
  if (leveledUp) updates.player_level = newLevel;

  return { newXPTotal, oldLevel, newLevel, leveledUp, updates };
}

export const MAX_PLAYER_LEVEL_EXPORT = MAX_PLAYER_LEVEL;