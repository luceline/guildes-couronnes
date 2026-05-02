/**
 * combatPvP.js — REFONTE V6 : Combat à jets de durabilité.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  PHILOSOPHIE V6
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La durabilité d'un équipement détermine désormais son TAUX DE RÉUSSITE.
 *   - Une épée à dura 8/10 a 80% de chance de toucher.
 *   - Une cuirasse à dura 5/10 a 50% de chance de parer ou bloquer.
 *   - Un bouclier à dura 3/10 a 30% de chance d'absorber l'attaque.
 * Un équipement à dura 0 est inopérant (mais occupe toujours le slot — il faut
 * le réparer pour pouvoir équiper un autre item du même type).
 *
 * Le grade ne sert plus à comparer les scores en combat. Il conditionne :
 *   - La quantité d'or volée (steal_pct)
 *   - Le tie-breaker en cas d'égalité (voir ci-dessous)
 *   - La valeur affichée pour info au joueur
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  SÉQUENCE DE RÉSOLUTION (3 JETS MAX)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1) PARADE PURE : si defense_zone == attack_zone, on tente la parade.
 *    - Jet sur la dura de l'armure de la zone parée.
 *    - Réussite → coup annulé, riposte ouverte 12h. Armure -1 dura.
 *    - Échec    → on bascule en combat normal sur cette zone (phase 2).
 *
 *    Cas particulier : pas d'armure équipée sur la zone parée → jet à 0%,
 *    bascule directe en phase 2. (Sans armure, pas de parade possible.)
 *
 * 2) JET D'ATTAQUE : selon dura de l'épée attaquante.
 *    - Jet sur la dura de l'épée.
 *    - Réussite → on passe au jet de défense (phase 3). Épée -1 dura.
 *    - Échec    → l'attaque rate. 0 dégât, défi consommé. Épée -1 dura.
 *
 *    Cas particulier : pas d'épée équipée → score à mains nues = jet 0%,
 *    l'attaque rate automatiquement (et défi consommé).
 *
 * 3) JET DE DÉFENSE : selon dura de l'armure de la zone touchée.
 *    Si l'attaquant frappe la zone bouclier, le bouclier intervient en plus
 *    via un 3e jet (phase 3bis).
 *
 *    - Jet armure réussi → blocage. On compare les grades :
 *        · grade_atk > grade_def → attaquant gagne malgré le blocage. Coup porté.
 *        · grade_atk < grade_def → défenseur tient. Coup absorbé. Armure -1 dura.
 *        · égalité de grade → défenseur gagne (favorise la défense).
 *      Si bouclier_zone == attack_zone et bouclier équipé → jet bouclier :
 *        · Bouclier réussi → son grade s'ajoute au grade armure pour le tie-break.
 *          Bouclier -1 dura.
 *        · Bouclier raté → ne contribue pas. Pas d'usure.
 *
 *    - Jet armure raté → coup porté direct. PV prennent. Armure intacte
 *      (le coup l'a contournée plutôt que d'avoir été stoppée par elle).
 *
 *    Cas particulier : pas d'armure équipée sur la zone touchée → jet à 0%,
 *    coup porté automatiquement.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EFFETS DU COUP PORTÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  - Dégâts : 1 PV (ou 2 si zone == "head" : la tête est un coup décisif).
 *  - Vol d'or : steal_pct de l'arme appliqué à l'or de la cible, capé à
 *    COMBAT_STEAL_MAX_GOLD. Bourse de protection plafonne à 10💰 et casse
 *    après 5 utilisations.
 *  - Si HP atteint 0 → KO 48h.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  USURE DE DURABILITÉ (RÉCAP)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  | Situation                          | Épée | Armure zone | Bouclier |
 *  |------------------------------------|------|-------------|----------|
 *  | Parade pure réussie                |  0   |     -1      |    0     |
 *  | Parade pure ratée → phase 2/3      |  -1  | (selon 2/3) | (s./3bis)|
 *  | Jet attaque raté                   |  -1  |      0      |    0     |
 *  | Attaque réussie + blocage réussi   |  -1  |     -1      | -1 si OK |
 *  | Attaque réussie + blocage raté     |  -1  |      0      |    0     |
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  RIPOSTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une parade pure réussie ouvre une fenêtre de riposte de 12h pour le défenseur
 * vers l'attaquant initial. Une seule riposte par chaîne (parent_challenge_id) :
 * la riposte d'une riposte n'ouvre pas de nouvelle fenêtre. Pas de riposte sur
 * blocage ni sur attaque ratée.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  RNG INJECTABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * resolveCombat accepte un 4e paramètre `rng` (fonction renvoyant [0, 1[).
 * Par défaut : Math.random. Les tests peuvent injecter un faux RNG pour des
 * résultats déterministes (ex: () => 0.5 → tous les jets passent à 50%).
 */

import {
  COMBAT_KO_DURATION_HOURS,
  COMBAT_PARRY_TIMER_HOURS,
  COMBAT_STEAL_MAX_GOLD,
  COMBAT_ZONES,
  EQUIPMENT_MAX_DURABILITY,
  consumeBourseUse,
  getCombatItemValue,
  getCombatStealPct,
  getDefenseScoreByZone,
  getEquippedItem,
  getPlayerHP,
  isPlayerKO,
} from "./gameData";

// ──────────────────────────────────────────────────────────────────────────
// Helpers internes
// ──────────────────────────────────────────────────────────────────────────

/**
 * Probabilité de réussite d'un jet d'équipement, à partir de sa durabilité.
 * Renvoie un nombre dans [0, 1]. Si l'item est null/undefined → 0.
 * Si dura = 0 → 0 (cassé). Si dura >= EQUIPMENT_MAX_DURABILITY → 1.
 *
 * COMPATIBILITÉ V5 : si le champ durability est absent (équipement créé avant
 * V6), on considère qu'il est neuf à EQUIPMENT_MAX_DURABILITY. C'est cohérent
 * avec le comportement V5 où un nouvel équipement démarrait à 10.
 */
function durabilityChance(item) {
  if (!item) return 0;
  const dura = item.durability == null ? EQUIPMENT_MAX_DURABILITY : item.durability;
  if (dura <= 0) return 0;
  if (dura >= EQUIPMENT_MAX_DURABILITY) return 1;
  return dura / EQUIPMENT_MAX_DURABILITY;
}

/**
 * Décrémente la durabilité d'un slot d'équipement.
 * Renvoie un nouvel objet equipment (immutable). Clamp à 0 (pas de négatif).
 */
function decrementDurability(equipment, slot) {
  const item = equipment?.[slot];
  if (!item) return equipment;
  // Compat V5 : durability absente = équipement neuf à EQUIPMENT_MAX_DURABILITY
  const currentDura = item.durability == null ? EQUIPMENT_MAX_DURABILITY : item.durability;
  if (currentDura <= 0) return equipment;
  return {
    ...equipment,
    [slot]: { ...item, durability: currentDura - 1 },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Validation de la cible (inchangé V5)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Vérifie qu'un joueur peut être défié. Retourne { ok: true } ou { ok: false, reason }.
 */
export function canChallenge(attacker, target, todayChallenges = [], context = {}) {
  if (!attacker || !target) return { ok: false, reason: "Cible invalide." };
  if (attacker.id === target.id) return { ok: false, reason: "Vous ne pouvez pas vous défier vous-même." };
  if (isPlayerKO(attacker)) return { ok: false, reason: "Vous êtes blessé, vous ne pouvez pas attaquer." };
  if (isPlayerKO(target)) return { ok: false, reason: "Cette cible est blessée et intouchable." };

  const today = new Date().toISOString().split("T")[0];
  const alreadyAttacked = todayChallenges.some(c =>
    c.attacker_email === attacker.user_email
    && c.defender_email === target.user_email
    && c.challenge_date === today
  );
  if (alreadyAttacked) return { ok: false, reason: "Vous avez déjà attaqué cette cible aujourd'hui." };

  const sameCity = context.city_id && context.city_id === target.city_id;
  const sameBiome = context.biome && context.biome === target.current_biome;
  if (!sameCity && !sameBiome) {
    return { ok: false, reason: "Vous devez être dans la même ville ou dans le même biome que la cible." };
  }

  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// Résolution V6
// ──────────────────────────────────────────────────────────────────────────

/**
 * Résout un combat selon la séquence V6 (jets de durabilité).
 *
 * @param {Object} attacker - profil attaquant frais
 * @param {Object} defender - profil défenseur frais
 * @param {Object} challenge - {
 *     attack_zone, attack_weapon_key, defense_zone, shield_zone
 *   }
 * @param {Function} [rng] - générateur d'aléa (défaut Math.random). Injectable
 *   pour tests déterministes.
 *
 * @returns {Object} {
 *     resolution: {
 *       result: "parried" | "attacker_won" | "defender_won" | "attack_missed",
 *       attack_score, defense_score,
 *       damage_dealt, gold_stolen,
 *       parry_attempted, parry_succeeded,
 *       attack_roll_succeeded,
 *       defense_roll_succeeded,
 *       shield_attempted, shield_succeeded, shield_used,
 *       attacker_break_item, defender_break_item, // legacy, toujours null en V6
 *       bourse_broke,
 *       riposte_window_until,
 *       rolls: { parry, attack, defense, shield }, // valeurs RNG pour debug
 *     },
 *     attackerUpdates,
 *     defenderUpdates,
 *   }
 */
export function resolveCombat(attacker, defender, challenge, rng = Math.random) {
  const { attack_zone, defense_zone, shield_zone } = challenge;

  const attackerUpdates = {};
  const defenderUpdates = {};

  // Le bouclier n'est appliqué que s'il est sur une zone DIFFÉRENTE de la parade.
  // Sinon on l'ignore (pas de cumul parade + bouclier sur la même zone).
  const effectiveShieldZone =
    shield_zone && shield_zone !== defense_zone ? shield_zone : null;

  // Récupération des items pertinents
  const attackerWeapon = getEquippedItem(attacker, "weapon");
  const parryArmor = defense_zone ? getEquippedItem(defender, `${defense_zone}_def`) : null;
  const blockArmor = getEquippedItem(defender, `${attack_zone}_def`);
  const defenderShield = getEquippedItem(defender, "shield");

  // Scores informatifs (pour affichage / log) — ne déterminent plus l'issue,
  // mais utilisés en tie-breaker
  const attackScore = attackerWeapon ? getCombatItemValue(attackerWeapon.grade) : 0;
  const baseDefenseScore = getDefenseScoreByZone(defender, attack_zone);

  // État courant des equipment (mutable au fil des décréments)
  let attackerNewEquipment = attacker.equipment || {};
  let defenderNewEquipment = defender.equipment || {};

  // Trace des jets pour debug / annonces
  const rolls = { parry: null, attack: null, defense: null, shield: null };

  // ───────────────────────────────────────────────────────────────────
  // PHASE 1 — TENTATIVE DE PARADE PURE
  // ───────────────────────────────────────────────────────────────────
  let parryAttempted = false;
  let parrySucceeded = false;

  if (defense_zone && defense_zone === attack_zone) {
    parryAttempted = true;
    const parryChance = durabilityChance(parryArmor);
    const parryRoll = rng();
    rolls.parry = parryRoll;

    if (parryRoll < parryChance) {
      // Parade réussie → coup annulé, riposte ouverte, armure -1 dura
      parrySucceeded = true;
      defenderNewEquipment = decrementDurability(defenderNewEquipment, `${defense_zone}_def`);
      if (defenderNewEquipment !== (defender.equipment || {})) {
        defenderUpdates.equipment = defenderNewEquipment;
      }

      return {
        resolution: {
          result: "parried",
          attack_score: attackScore,
          defense_score: baseDefenseScore,
          damage_dealt: 0,
          gold_stolen: 0,
          parry_attempted: true,
          parry_succeeded: true,
          attack_roll_succeeded: null,
          defense_roll_succeeded: null,
          shield_attempted: false,
          shield_succeeded: false,
          shield_used: false,
          save_attempted: false,
          save_succeeded: false,
          attacker_break_item: null,
          defender_break_item: null,
          bourse_broke: false,
          riposte_window_until: new Date(
            Date.now() + COMBAT_PARRY_TIMER_HOURS * 3600 * 1000
          ).toISOString(),
          rolls,
        },
        attackerUpdates,
        defenderUpdates,
      };
    }
    // Parade ratée → on continue en phase 2/3 sur la zone attaquée.
    // (Aucune usure d'armure sur parade ratée : elle n'a pas servi.)
  }

  // ───────────────────────────────────────────────────────────────────
  // PHASE 2 — JET D'ATTAQUE
  // ───────────────────────────────────────────────────────────────────
  const attackChance = durabilityChance(attackerWeapon);
  const attackRoll = rng();
  rolls.attack = attackRoll;
  const attackRollSucceeded = attackRoll < attackChance;

  // L'épée s'use à chaque attaque, peu importe le résultat
  if (attackerWeapon) {
    attackerNewEquipment = decrementDurability(attackerNewEquipment, "weapon");
  }

  if (!attackRollSucceeded) {
    // L'attaque rate. Défi consommé, 0 dégât, 0 vol.
    if (attackerNewEquipment !== (attacker.equipment || {})) {
      attackerUpdates.equipment = attackerNewEquipment;
    }
    return {
      resolution: {
        result: "attack_missed",
        attack_score: attackScore,
        defense_score: baseDefenseScore,
        damage_dealt: 0,
        gold_stolen: 0,
        parry_attempted: parryAttempted,
        parry_succeeded: false,
        attack_roll_succeeded: false,
        defense_roll_succeeded: null,
        shield_attempted: false,
        shield_succeeded: false,
        shield_used: false,
        save_attempted: false,
        save_succeeded: false,
        attacker_break_item: null,
        defender_break_item: null,
        bourse_broke: false,
        riposte_window_until: null,
        rolls,
      },
      attackerUpdates,
      defenderUpdates,
    };
  }

  // ───────────────────────────────────────────────────────────────────
  // PHASE 3 — JET DE DÉFENSE (BLOCAGE PAR L'ARMURE DE LA ZONE)
  // ───────────────────────────────────────────────────────────────────
  const defenseChance = durabilityChance(blockArmor);
  const defenseRoll = rng();
  rolls.defense = defenseRoll;
  const defenseRollSucceeded = defenseRoll < defenseChance;

  // ── PHASE 3bis — JET BOUCLIER (uniquement si shield placé sur la zone touchée)
  let shieldAttempted = false;
  let shieldSucceeded = false;
  let shieldUsed = false; // true si le bouclier a effectivement absorbé l'attaque
  let shieldGradeBonus = 0;

  if (effectiveShieldZone === attack_zone && defenderShield) {
    shieldAttempted = true;
    const shieldChance = durabilityChance(defenderShield);
    const shieldRoll = rng();
    rolls.shield = shieldRoll;
    if (shieldRoll < shieldChance) {
      shieldSucceeded = true;
      shieldGradeBonus = getCombatItemValue(defenderShield.grade);
    }
  }

  // ── Détermination du résultat ──
  let attackerWins;

  if (!defenseRollSucceeded) {
    // L'armure n'a pas bloqué. Le coup porte direct, peu importe le bouclier
    // (le bouclier ne peut intervenir que si l'armure a au moins fait son office).
    // Note design : on aurait pu décider que le bouclier puisse seul absorber le
    // coup. Ce n'est PAS le choix retenu en V6 — bouclier = bonus à l'armure.
    attackerWins = true;
  } else {
    // L'armure a bloqué. On compare les grades pour départager.
    const defenderGrade = (blockArmor?.grade ?? 0) + (shieldSucceeded ? (defenderShield?.grade ?? 0) : 0);
    const attackerGrade = attackerWeapon?.grade ?? 0;
    if (attackerGrade > defenderGrade) {
      // Attaquant a un meilleur grade : son arme passe malgré le blocage
      attackerWins = true;
    } else {
      // Grade défense >= grade attaque : défenseur tient
      attackerWins = false;
      shieldUsed = shieldSucceeded; // le bouclier n'est "réellement utile" que si on a tenu
    }
  }

  // ── Effets du coup porté ──
  let damageDealt = 0;
  let goldStolen = 0;
  let bourseBroke = false;
  let bourseConsumeResult = null;

  // V6.1 — Jet de sauvegarde basé sur le niveau (ajouté pour réduire l'écart
  // de domination des hauts grades). Tenté UNIQUEMENT si l'attaque va porter.
  // Formule C : base 10% + 5% par niveau d'écart de défenseur, cap à 50%.
  // Effet en cas de succès : -1 dégât (donc 0 pour zones standard, 1 pour tête).
  let saveAttempted = false;
  let saveSucceeded = false;
  let saveChance = 0;

  if (attackerWins) {
    // Dégâts : 1 PV par défaut, 2 si tête (coup décisif)
    damageDealt = attack_zone === "head" ? 2 : 1;

    // ── Jet de sauvegarde ──
    saveAttempted = true;
    const defenderLevel = Number(defender.player_level) || 1;
    const attackerLevel = Number(attacker.player_level) || 1;
    const levelGap = defenderLevel - attackerLevel;
    saveChance = Math.max(0.10, Math.min(0.50, 0.10 + Math.max(0, levelGap) * 0.05));
    const saveRoll = rng();
    saveSucceeded = saveRoll < saveChance;

    rolls.save = { chance: saveChance, roll: saveRoll, succeeded: saveSucceeded, defenderLevel, attackerLevel };

    if (saveSucceeded) {
      damageDealt = Math.max(0, damageDealt - 1);
    }

    // Vol d'or
    const stealPct = attackerWeapon
      ? getCombatStealPct(attackerWeapon.item_key, attackerWeapon.grade ?? 0)
      : 0;
    let theft = Math.floor((defender.gold || 0) * stealPct);
    theft = Math.min(theft, COMBAT_STEAL_MAX_GOLD);

    // Bourse de protection
    const hasBourse = (defender.inventory || []).some(
      i => i.item_key === "bourse_protection" && (i.quantity || 0) > 0
    );
    if (hasBourse) {
      theft = Math.min(theft, 10);
      bourseConsumeResult = consumeBourseUse(defender);
      bourseBroke = bourseConsumeResult.broken;
    }
    goldStolen = Math.max(0, theft);
  }

  // ── Usure des défenses (uniquement si elles ont servi avec succès) ──
  if (!attackerWins) {
    // Le défenseur a tenu : armure -1 dura
    if (blockArmor) {
      defenderNewEquipment = decrementDurability(defenderNewEquipment, `${attack_zone}_def`);
    }
    // Bouclier -1 dura uniquement s'il a contribué à tenir
    if (shieldSucceeded) {
      defenderNewEquipment = decrementDurability(defenderNewEquipment, "shield");
    }
  }
  // Si attackerWins ET defenseRollSucceeded : l'armure a bloqué mais pas suffisamment.
  // Règle V6 : on considère qu'elle a tout de même servi → -1 dura. Idem bouclier
  // s'il a eu son moment de gloire avant d'être surclassé.
  else if (defenseRollSucceeded) {
    if (blockArmor) {
      defenderNewEquipment = decrementDurability(defenderNewEquipment, `${attack_zone}_def`);
    }
    if (shieldSucceeded) {
      defenderNewEquipment = decrementDurability(defenderNewEquipment, "shield");
    }
  }
  // Sinon (defenseRollSucceeded === false) : l'armure n'a rien arrêté, pas d'usure.

  // ── Construction des updates ──

  // Attaquant
  if (attackerWins && goldStolen > 0) {
    attackerUpdates.gold = (attacker.gold || 0) + goldStolen;
  }
  if (attackerNewEquipment !== (attacker.equipment || {})) {
    attackerUpdates.equipment = attackerNewEquipment;
  }

  // Défenseur
  if (damageDealt > 0) {
    const newHp = Math.max(0, getPlayerHP(defender) - damageDealt);
    defenderUpdates.hp = newHp;
    if (newHp === 0) {
      defenderUpdates.hp_ko_until = new Date(
        Date.now() + COMBAT_KO_DURATION_HOURS * 3600 * 1000
      ).toISOString();
    }
  }
  if (goldStolen > 0) {
    defenderUpdates.gold = Math.max(0, (defender.gold || 0) - goldStolen);
  }
  if (defenderNewEquipment !== (defender.equipment || {})) {
    defenderUpdates.equipment = defenderNewEquipment;
  }
  if (bourseConsumeResult && Object.keys(bourseConsumeResult.updates).length > 0) {
    Object.assign(defenderUpdates, bourseConsumeResult.updates);
  }

  return {
    resolution: {
      result: attackerWins ? "attacker_won" : "defender_won",
      attack_score: attackScore,
      defense_score: baseDefenseScore + shieldGradeBonus,
      damage_dealt: damageDealt,
      gold_stolen: goldStolen,
      parry_attempted: parryAttempted,
      parry_succeeded: false,
      attack_roll_succeeded: true,
      defense_roll_succeeded: defenseRollSucceeded,
      shield_attempted: shieldAttempted,
      shield_succeeded: shieldSucceeded,
      shield_used: shieldUsed,
      // V6.1 — Jet de sauvegarde (basé sur niveau)
      save_attempted: saveAttempted,
      save_succeeded: saveSucceeded,
      save_chance: saveChance,
      attacker_break_item: null,
      defender_break_item: null,
      bourse_broke: bourseBroke,
      riposte_window_until: null, // pas de riposte hors parade pure
      rolls,
    },
    attackerUpdates,
    defenderUpdates,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers UI (inchangés en signature, enrichis pour V6)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Retourne l'épée équipée + son taux de toucher (V6).
 * Compat V5 : si durability absente, on l'expose comme EQUIPMENT_MAX_DURABILITY.
 */
export function getEquippedWeapon(profile) {
  const eq = getEquippedItem(profile, "weapon");
  if (!eq) return null;
  const effectiveDura = eq.durability == null ? EQUIPMENT_MAX_DURABILITY : eq.durability;
  return {
    item_key: eq.item_key,
    grade: eq.grade ?? 0,
    durability: effectiveDura,
    score: getCombatItemValue(eq.grade ?? 0),
    steal_pct: getCombatStealPct(eq.item_key, eq.grade ?? 0),
    hit_chance: durabilityChance(eq), // V6 : probabilité de toucher
  };
}

/**
 * Retourne le bouclier équipé + son taux d'absorption (V6).
 */
export function getEquippedShield(profile) {
  const eq = getEquippedItem(profile, "shield");
  if (!eq) return null;
  const effectiveDura = eq.durability == null ? EQUIPMENT_MAX_DURABILITY : eq.durability;
  return {
    item_key: eq.item_key,
    grade: eq.grade ?? 0,
    durability: effectiveDura,
    score: getCombatItemValue(eq.grade ?? 0),
    block_chance: durabilityChance(eq), // V6 : probabilité d'absorption
  };
}

/**
 * Liste les armures équipées du défenseur par zone, avec leur taux de
 * parade/blocage. Sert principalement à l'UI ChallengeDefenseForm.
 * Compat V5 : durability absente exposée comme EQUIPMENT_MAX_DURABILITY.
 */
export function getAvailableDefenseOptions(profile) {
  const options = [];
  for (const zone of COMBAT_ZONES) {
    const eq = getEquippedItem(profile, `${zone}_def`);
    const effectiveDura = !eq ? 0 : (eq.durability == null ? EQUIPMENT_MAX_DURABILITY : eq.durability);
    options.push({
      zone,
      item_key: eq?.item_key || null,
      grade: eq?.grade ?? 0,
      durability: effectiveDura,
      score: getDefenseScoreByZone(profile, zone),
      defense_chance: durabilityChance(eq), // V6 : taux parade/blocage
    });
  }
  return options;
}

// Export du helper interne pour tests / UI annexes
export { durabilityChance };
