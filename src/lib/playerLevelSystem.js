// ─────────────────────────────────────────────
// SYSTÈME DE NIVEAU DE JOUEUR
// ─────────────────────────────────────────────
// 1 ressource rare = 100 XP (échange et consommation)
// Niveaux 1-50, courbe exponentielle
// +5% drop rare + -2% cooldown par 5 niveaux

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

export const MAX_PLAYER_LEVEL_EXPORT = MAX_PLAYER_LEVEL;