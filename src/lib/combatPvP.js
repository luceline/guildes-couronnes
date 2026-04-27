/**
 * combatPvP.js — Helpers de résolution du combat zoné humain (Phase 3).
 *
 * Le combat se déroule en 2 temps :
 *   1) L'attaquant crée un défi (zone visée + arme utilisée).
 *      → CombatChallenge { status: "pending_defense", expires_at: +12h }
 *   2) Le défenseur a 12h pour choisir sa zone de défense (et optionnellement une armure).
 *      → On résout le combat dès qu'il valide, ou à expiration (résolution sans défense).
 *
 * Règles principales :
 *   - Parade = choix de zone identique (peu importe l'armure), zéro dégât, riposte 12h ouverte.
 *   - Combat normal = comparaison atk_score (zone visée) vs def_score (zone visée).
 *   - Sur coup porté : 1 PV en moins, vol d'or selon arme (capé 100💰), bourse de protection
 *     plafonne le vol subi à 10💰 et se brise 10% du temps.
 *   - Cassure : roll % selon grade pour chaque item ayant servi (arme côté atk si coup porté,
 *     armure côté def si zone touchée et armure équipée).
 *   - Pas de cassure sur parade réussie.
 *
 * Limite : 1 attaque par jour entre une paire (attaquant, défenseur). Plusieurs attaquants
 * peuvent se relayer sur la même cible.
 *
 * Riposte : si parade réussie, le défenseur peut lancer UN défi vers l'attaquant initial
 * dans les 12h. Ce défi se résout normalement, sans déclencher de re-riposte (pas de boucle).
 */

import {
  COMBAT_ZONES,
  COMBAT_KO_DURATION_HOURS,
  COMBAT_PARRY_TIMER_HOURS,
  COMBAT_STEAL_MAX_GOLD,
  COMBAT_BREAK_PCT_BY_GRADE,
  COMBAT_MAX_HP,
  BOURSE_PROTECTION_BREAK_PCT,
  getAttackScoreByZone,
  getDefenseScoreByZone,
  getCombatBreakPct,
  getCombatStealPct,
  getCombatItemValue,
  getPlayerHP,
  isPlayerKO,
  getEquippedItem,
} from "./gameData";

// ──────────────────────────────────────────────────────────────────────────
// Validation de la cible
// ──────────────────────────────────────────────────────────────────────────

/**
 * Vérifie qu'un joueur peut être défié. Retourne { ok: true } ou { ok: false, reason }.
 *
 * Refus possibles :
 *   - cible KO (HP=0 ou hp_ko_until > maintenant)
 *   - attaquant KO
 *   - attaquant et cible identiques
 *   - déjà attaqué cette cible aujourd'hui
 *   - pas dans la même ville ni dans le même biome
 */
export function canChallenge(attacker, target, todayChallenges = [], context = {}) {
  if (!attacker || !target) return { ok: false, reason: "Cible invalide." };
  if (attacker.id === target.id) return { ok: false, reason: "Vous ne pouvez pas vous défier vous-même." };
  if (isPlayerKO(attacker)) return { ok: false, reason: "Vous êtes blessé, vous ne pouvez pas attaquer." };
  if (isPlayerKO(target)) return { ok: false, reason: "Cette cible est blessée et intouchable." };

  // Limite 1 attaque/jour vers cette cible
  const today = new Date().toISOString().split("T")[0];
  const alreadyAttacked = todayChallenges.some(c =>
    c.attacker_email === attacker.user_email
    && c.defender_email === target.user_email
    && c.challenge_date === today
  );
  if (alreadyAttacked) return { ok: false, reason: "Vous avez déjà attaqué cette cible aujourd'hui." };

  // Contexte : même ville OU même biome
  const sameCity = context.city_id && context.city_id === target.city_id;
  const sameBiome = context.biome && context.biome === target.current_biome;
  if (!sameCity && !sameBiome) {
    return { ok: false, reason: "Vous devez être dans la même ville ou dans le même biome que la cible." };
  }

  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// Résolution
// ──────────────────────────────────────────────────────────────────────────

/**
 * Résout un combat. Prend l'état frais des deux profils + les paramètres du défi,
 * retourne un patch à appliquer (updates pour attacker, defender, et un objet
 * resolution avec tous les détails à stocker dans CombatChallenge).
 *
 * @param {Object} attacker - profil attaquant frais
 * @param {Object} defender - profil défenseur frais
 * @param {Object} challenge - { attack_zone, attack_weapon_key, defense_zone (null si pas défendu) }
 * @returns {Object} {
 *   resolution: { result, attack_score, defense_score, damage_dealt, gold_stolen,
 *                 attacker_break_item, defender_break_item, riposte_window_until },
 *   attackerUpdates: { gold, hp, hp_ko_until, equipment, inventory },
 *   defenderUpdates: { gold, hp, hp_ko_until, equipment, inventory },
 * }
 */
export function resolveCombat(attacker, defender, challenge) {
  const { attack_zone, attack_weapon_key, defense_zone } = challenge;

  const attackerUpdates = {};
  const defenderUpdates = {};

  // Helper : roll RNG entre 0 et 1
  const roll = () => Math.random();

  // ── 1) Parade ? ──
  // Parade = choix de zone identique. Pas besoin d'armure équipée.
  // Aucun dégât, aucune cassure, riposte ouverte 12h.
  if (defense_zone && defense_zone === attack_zone) {
    return {
      resolution: {
        result: "parried",
        attack_score: 0,
        defense_score: 0,
        damage_dealt: 0,
        gold_stolen: 0,
        attacker_break_item: null,
        defender_break_item: null,
        riposte_window_until: new Date(Date.now() + COMBAT_PARRY_TIMER_HOURS * 3600 * 1000).toISOString(),
      },
      attackerUpdates,
      defenderUpdates,
    };
  }

  // ── 2) Combat normal — comparaison sur la zone attaquée ──
  // Phase 3 Option B : l'arme est universelle (slot "weapon"), peu importe la zone visée.
  // Le score d'attaque vient de l'épée équipée. La défense est zonée (armure de la zone visée).
  const attackerWeapon = getEquippedItem(attacker, "weapon");
  const defenderEquippedDef = getEquippedItem(defender, `${attack_zone}_def`);

  // Score d'attaque : effet de l'épée si équipée (peu importe la zone visée)
  let attackScore = 0;
  if (attackerWeapon) {
    attackScore = getCombatItemValue(attackerWeapon.grade);
  }
  const defenseScore = getDefenseScoreByZone(defender, attack_zone);

  // Égalité ou supériorité = attaquant gagne. Si pas d'arme et pas d'armure, 0=0 → attaquant gagne quand même
  const attackerWins = attackScore >= defenseScore;

  // ── 3) Dégâts + vol d'or ──
  let damageDealt = 0;
  let goldStolen = 0;
  let bourseBroke = false;

  if (attackerWins) {
    damageDealt = 1;
    // Vol d'or : % défini par l'arme (10% pour épée), capé COMBAT_STEAL_MAX_GOLD
    // Si pas d'arme, score 0 et même victoire → pas de vol (0% de l'or)
    const stealPct = attackerWeapon ? getCombatStealPct(attackerWeapon.item_key) : 0;
    let theft = Math.floor((defender.gold || 0) * stealPct);
    theft = Math.min(theft, COMBAT_STEAL_MAX_GOLD);

    // Bourse de protection : plafonne à 10💰 et 10% de chance de casser
    const hasBourse = (defender.inventory || []).some(i => i.item_key === "bourse_protection" && (i.quantity || 0) > 0);
    if (hasBourse) {
      theft = Math.min(theft, 10);
      if (roll() < BOURSE_PROTECTION_BREAK_PCT) {
        bourseBroke = true;
      }
    }
    goldStolen = Math.max(0, theft);
  }

  // ── 4) Cassure d'arme/armure ──
  // Cassure côté attaquant : seulement si l'épée est équipée et a frappé.
  // Cassure côté défenseur : seulement si l'armure est équipée sur la zone touchée.
  let attackerBreakItem = null;
  let defenderBreakItem = null;

  if (attackerWeapon) {
    const grade = attackerWeapon.grade ?? 0;
    if (roll() < getCombatBreakPct(grade)) {
      attackerBreakItem = attackerWeapon.item_key;
    }
  }

  if (defenderEquippedDef) {
    const grade = defenderEquippedDef.grade ?? 0;
    if (roll() < getCombatBreakPct(grade)) {
      defenderBreakItem = defenderEquippedDef.item_key;
    }
  }

  // ── 5) Construction des updates ──

  // Attaquant : récupère l'or volé, casse son arme éventuellement
  if (attackerWins && goldStolen > 0) {
    attackerUpdates.gold = (attacker.gold || 0) + goldStolen;
  }
  if (attackerBreakItem) {
    const newEq = { ...(attacker.equipment || {}) };
    delete newEq.weapon;
    attackerUpdates.equipment = newEq;
  }

  // Défenseur : perd HP + or, peut casser son armure et/ou sa bourse
  if (damageDealt > 0) {
    const newHp = Math.max(0, getPlayerHP(defender) - damageDealt);
    defenderUpdates.hp = newHp;
    if (newHp === 0) {
      defenderUpdates.hp_ko_until = new Date(Date.now() + COMBAT_KO_DURATION_HOURS * 3600 * 1000).toISOString();
    }
  }
  if (goldStolen > 0) {
    defenderUpdates.gold = Math.max(0, (defender.gold || 0) - goldStolen);
  }
  if (defenderBreakItem) {
    const newEq = { ...(defender.equipment || {}) };
    delete newEq[`${attack_zone}_def`];
    defenderUpdates.equipment = newEq;
  }
  if (bourseBroke) {
    const newInv = (defender.inventory || []).map(i => ({ ...i }));
    const idx = newInv.findIndex(i => i.item_key === "bourse_protection");
    if (idx >= 0) {
      newInv[idx].quantity = (newInv[idx].quantity || 0) - 1;
      if (newInv[idx].quantity <= 0) newInv.splice(idx, 1);
      defenderUpdates.inventory = newInv;
    }
  }

  return {
    resolution: {
      result: attackerWins ? "attacker_won" : "defender_won",
      attack_score: attackScore,
      defense_score: defenseScore,
      damage_dealt: damageDealt,
      gold_stolen: goldStolen,
      attacker_break_item: attackerBreakItem,
      defender_break_item: defenderBreakItem,
      bourse_broke: bourseBroke,
      riposte_window_until: null, // pas de riposte sur combat résolu (uniquement sur parade)
    },
    attackerUpdates,
    defenderUpdates,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Sélection arme/armure pour défi
// ──────────────────────────────────────────────────────────────────────────

/**
 * Phase 3 Option B : retourne l'épée équipée (ou null si pas d'arme).
 * { item_key, grade, score, steal_pct } ou null.
 */
export function getEquippedWeapon(profile) {
  const eq = getEquippedItem(profile, "weapon");
  if (!eq) return null;
  return {
    item_key: eq.item_key,
    grade: eq.grade ?? 0,
    score: getCombatItemValue(eq.grade ?? 0),
    steal_pct: getCombatStealPct(eq.item_key),
  };
}

/**
 * Liste les armures équipées du défenseur (par zone) qui pourraient parer
 * une attaque sur cette zone. Note : avec la règle "parade sans armure",
 * cette fonction sert juste à montrer les bonus défense disponibles.
 */
export function getAvailableDefenseOptions(profile) {
  const options = [];
  for (const zone of COMBAT_ZONES) {
    const eq = getEquippedItem(profile, `${zone}_def`);
    options.push({
      zone,
      item_key: eq?.item_key || null,
      grade: eq?.grade ?? 0,
      score: getDefenseScoreByZone(profile, zone),
    });
  }
  return options;
}
