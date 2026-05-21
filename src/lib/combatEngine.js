/**
 * src/lib/combatEngine.js — Moteur de combat unifié (PUR, sans I/O)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  PHILOSOPHIE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Moteur de résolution de combat mirror entre 2 combattants génériques.
 * Utilisé par :
 *   - Combat Boss communautaire (orchestré par bossCombat.js)
 *   - Combat PvE biome (orchestré par combatPvE.js)
 *   - Futur tournoi PvP (orchestré par tournamentCombat.js)
 *
 * ─── MÉCANIQUE MIROIR (3 phases) ─────────────────────────────────────────
 *
 *   1. PARADE : si attZone == defParry → jet sur ARME défenseur
 *      - Réussite : coup annulé, arme défenseur +1 dura
 *      - Échec : pas de perte dura, on continue
 *
 *   2. ATTAQUE : jet sur ARME attaquant
 *      - L'arme perd -1 dura (sauf plancher)
 *      - Si rate : fin du tour, 0 dégât
 *      - Si touche : on passe en phase 3
 *
 *   3. DÉFENSE : jet sur ARMURE de la zone touchée
 *      - Si attZone == defShield ET bouclier actif : jet dura bouclier
 *        renforce le grade armure pour le tie-break
 *      - Si grade_def >= grade_atk : blocage, dura -1 (bouclier ou armure
 *        selon priorité)
 *      - Sinon : coup porté (1 dégât uniforme)
 *
 * ─── COMBATTANT UNIFIÉ ────────────────────────────────────────────────────
 *
 * Format générique manipulé par le moteur :
 *
 *   {
 *     id, name,
 *     hp, hpMax,
 *     weapon:  { grade, dura, drain, regenPct },
 *     shield:  { grade, dura, drain, regenPct, durabFloor? },  // durabFloor optionnel
 *     armor: {
 *       head:  { grade, dura, regenPct },
 *       torso: { grade, dura, regenPct },
 *       arms:  { grade, dura, regenPct },
 *       legs:  { grade, dura, regenPct },
 *     },
 *     // Compteurs runtime :
 *     hitStreak, destabRoundsLeft,
 *     // Plancher dura arme (utilisé pour boss & mobs PvE) :
 *     weaponFloor,
 *     // Hooks de patterns (PvE) optionnels :
 *     pattern,            // 'thief', 'drain', 'regen', 'revive', etc.
 *     hasRevived,         // true si revive déjà déclenché
 *   }
 *
 * ─── INVARIANTS ───────────────────────────────────────────────────────────
 *
 *   - Aucune I/O (pas de localStorage, pas de fetch)
 *   - Fonctions déterministes : reproductibles avec le même RNG seedé
 *   - Aucun "log" UI : juste un tableau d'events typés (le caller formate)
 *   - Pas de side-effect sur les objets sources (les orchestrateurs clonent)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

export const COMBAT_ZONES = ['head', 'torso', 'arms', 'legs'];
export const ZONE_LABELS = {
  head: 'Tête',
  torso: 'Torse',
  arms: 'Bras',
  legs: 'Jambes',
};

export const DURA_MAX = 10;
export const DAMAGE_PER_HIT = 1;       // dégât uniforme par coup
export const DESTAB_THRESHOLD = 2;     // 2 hits d'affilée → destab adversaire

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (exportés pour tests)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Probabilité de réussite d'un jet de durabilité.
 * Linéaire entre 0 et 1, basée sur la dura courante / DURA_MAX.
 */
export function durabilityChance(dura) {
  if (dura == null || dura <= 0) return 0;
  if (dura >= DURA_MAX) return 1;
  return dura / DURA_MAX;
}

/**
 * Clamp une dura entre [floor, DURA_MAX].
 */
export function clampDura(d, floor = 0) {
  return Math.max(floor, Math.min(DURA_MAX, d));
}

/**
 * Tire 2 zones distinctes (parade + bouclier) parmi COMBAT_ZONES.
 * Utilisé par le moteur pour les choix automatiques (boss/mob).
 */
export function pickRandomDefenseZones(rng) {
  const parry = COMBAT_ZONES[Math.floor(rng() * 4)];
  let shield;
  do {
    shield = COMBAT_ZONES[Math.floor(rng() * 4)];
  } while (shield === parry);
  return { parry, shield };
}

/**
 * Interpolation linéaire d'un grade selon HP.
 * À hp_max → gMin (tranquille). À 1 HP → gMax (enragé).
 * Si gMin == gMax, retourne ce grade.
 */
export function interpGradeByHp(hpCurrent, hpMax, gMin, gMax) {
  if (gMin === gMax) return gMin;
  if (hpCurrent >= hpMax) return gMin;
  if (hpCurrent <= 1) return gMax;
  const t = (hpMax - hpCurrent) / (hpMax - 1);
  return Math.round(gMin + t * (gMax - gMin));
}

// ─────────────────────────────────────────────────────────────────────────────
// Regen début de tour (gemmes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applique la regen de durabilité au début du tour d'un combattant.
 * Pour chaque pièce avec regenPct > 0, chance regenPct/100 de gagner +1 dura.
 * Modifie le combattant en place.
 *
 * @param {Object} c - combattant
 * @param {Function} rng - générateur aléatoire [0, 1)
 * @returns {Array} liste d'events { type, slot } pour les regens déclenchées
 */
export function applyRegenStart(c, rng) {
  const events = [];
  const tryRegen = (slot, item) => {
    if (item && item.regenPct > 0 && rng() < item.regenPct / 100) {
      const before = item.dura;
      item.dura = clampDura(item.dura + 1);
      if (item.dura > before) events.push({ type: 'regen', slot });
    }
  };
  if (c.weapon) tryRegen('weapon', c.weapon);
  if (c.shield) tryRegen('shield', c.shield);
  if (c.armor) {
    for (const z of COMBAT_ZONES) {
      if (c.armor[z]) tryRegen(z, c.armor[z]);
    }
  }
  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// Résolution d'un échange unidirectionnel (attacker frappe defender)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Résout 1 strike : attacker → defender, selon les zones choisies.
 *
 * @param {Object} attacker - combattant attaquant
 * @param {Object} defender - combattant défenseur
 * @param {Object} choices - { attZone, defParry, defShield }
 * @param {Function} rng - générateur aléatoire [0, 1)
 * @param {Object} [opts] - { attackerWeaponGrade?, defenderShieldGrade? }
 *                          permet override pour boss avec grade dynamique
 * @returns {Object} {
 *   dmg,              // dégâts effectivement appliqués au defender
 *   parried, missed, blocked,
 *   events,           // liste d'events typés pour log
 *   drained,          // HP regagnés par attacker via drain
 *   destabilized,     // true si defender vient de se faire déstabiliser
 * }
 */
export function resolveStrike(attacker, defender, choices, rng, opts = {}) {
  const { attZone, defParry, defShield } = choices;
  const events = [];

  // Grade arme attacker (peut être override par opts pour boss dynamique)
  const attWG = opts.attackerWeaponGrade != null
    ? opts.attackerWeaponGrade
    : (attacker.weapon?.grade ?? 0);

  // Grade bouclier defender (override possible)
  const defSG = opts.defenderShieldGrade != null
    ? opts.defenderShieldGrade
    : (defender.shield?.grade ?? 0);

  // ── PHASE 1 : Parade défenseur (basée sur arme défenseur) ─────────────
  if (defParry && attZone === defParry && defender.weapon) {
    const chance = durabilityChance(defender.weapon.dura);
    if (rng() < chance) {
      // Parade réussie : arme défenseur +1 dura (récompense), coup annulé
      const weaponFloor = defender.weaponFloor || 0;
      defender.weapon.dura = clampDura(defender.weapon.dura + 1, weaponFloor);
      events.push({ type: 'parry_success', zone: attZone });
      attacker.hitStreak = 0;
      return { dmg: 0, parried: true, events, drained: 0, destabilized: false };
    }
    // Parade ratée : aucune pénalité (la pénalité est de prendre le coup)
    events.push({ type: 'parry_fail', zone: attZone });
  }

  // ── PHASE 2 : Jet d'attaque attacker (arme -1 dura systématique) ──────
  if (attacker.weapon) {
    const weaponFloor = attacker.weaponFloor || 0;
    const attChance = durabilityChance(attacker.weapon.dura);
    attacker.weapon.dura = clampDura(attacker.weapon.dura - 1, weaponFloor);
    if (rng() >= attChance) {
      events.push({ type: 'attack_miss', zone: attZone });
      attacker.hitStreak = 0;
      return { dmg: 0, missed: true, events, drained: 0, destabilized: false };
    }
  }

  // ── PHASE 3 : Défense défenseur (armure + bouclier si même zone) ──────
  let shieldActiveAndBlocking = false;
  let totalDefGrade = defender.armor?.[attZone]?.grade ?? 0;
  const armorZone = defender.armor?.[attZone];

  if (armorZone) {
    const aChance = durabilityChance(armorZone.dura);
    if (rng() < aChance) {
      // Armure réussit son jet : elle "tient", -1 dura par défaut
      let armorUsed = true;

      // Bouclier renforce si zone == defShield
      if (defShield && attZone === defShield && defender.shield && defender.destabRoundsLeft === 0) {
        const sChance = durabilityChance(defender.shield.dura);
        if (rng() < sChance) {
          totalDefGrade += defSG;
          shieldActiveAndBlocking = true;
          events.push({ type: 'shield_active', shieldGrade: defSG });
        } else {
          events.push({ type: 'shield_fail' });
        }
      } else if (defShield && attZone === defShield && defender.destabRoundsLeft > 0) {
        events.push({ type: 'shield_off', roundsLeft: defender.destabRoundsLeft });
      }

      // Tie-break grades : armure doit être STRICTEMENT supérieure à l'arme
      // pour bloquer. À grade égal, le coup passe (partial_block).
      // Ainsi un joueur G0 contre un boss armure G0 peut quand même taper.
      if (totalDefGrade > attWG) {
        // Blocage total
        // Règle : si bouclier a bloqué, c'est LUI qui prend l'usure (armure intacte)
        if (shieldActiveAndBlocking) {
          defender.shield.dura = clampDura(defender.shield.dura - 1);
          armorUsed = false;
        } else {
          armorZone.dura = clampDura(armorZone.dura - 1);
        }
        events.push({ type: 'block', zone: attZone, defGrade: totalDefGrade, attGrade: attWG });
        attacker.hitStreak = 0;
        return { dmg: 0, blocked: true, events, drained: 0, destabilized: false };
      } else {
        // Armure réussit mais grade égal ou insuffisant : usure quand même, coup passe
        if (shieldActiveAndBlocking) {
          defender.shield.dura = clampDura(defender.shield.dura - 1);
          armorUsed = false;
        }
        if (armorUsed) {
          armorZone.dura = clampDura(armorZone.dura - 1);
        }
        events.push({ type: 'partial_block', zone: attZone, defGrade: totalDefGrade, attGrade: attWG });
      }
    } else {
      // Armure rate son jet : pas d'usure, coup passe directement
      events.push({ type: 'armor_fail', zone: attZone });
    }
  }

  // ── COUP PORTÉ ────────────────────────────────────────────────────────
  // 17/05/2026 — Support d'un damageMultiplier via opts (utilisé par PvE biome
  // pour buffer les dégâts mobs des vagues 3 à 5). Ne modifie pas le PvP ni le
  // combat boss (qui ne passent pas cet opt).
  const dmgMult = opts.damageMultiplier ?? 1;
  const dmg = DAMAGE_PER_HIT * dmgMult;
  defender.hp = Math.max(0, defender.hp - dmg);
  attacker.hitStreak++;

  events.push({ type: 'hit', zone: attZone, dmg });

  // Arme attaquant : +1 dura sur touche réussie (récompense)
  // Net sur le tour : -1 en phase 2 + 1 ici = 0 dura usée sur touche
  // L'arme ne s'use donc que sur les attaques ratées.
  if (attacker.weapon) {
    const aFloor = attacker.weaponFloor || 0;
    attacker.weapon.dura = clampDura(attacker.weapon.dura + 1, aFloor);
  }

  // ── Drain de vie (gemmes attaquant) ───────────────────────────────────
  let drained = 0;
  const drainTotal = (attacker.weapon?.drain || 0) + (shieldActiveAndBlocking ? 0 : (attacker.shield?.drain || 0));
  if (drainTotal > 0) {
    const before = attacker.hp;
    attacker.hp = Math.min(attacker.hpMax, attacker.hp + drainTotal);
    drained = attacker.hp - before;
    if (drained > 0) {
      events.push({ type: 'drain', amount: drained });
    }
  }

  // ── Déstabilisation : N hits d'affilée → defender shield OFF ──────────
  let destabilized = false;
  if (defender.destabRoundsLeft === 0 && attacker.hitStreak >= DESTAB_THRESHOLD) {
    defender.destabRoundsLeft = defender.destabDuration || 5;
    destabilized = true;
    events.push({ type: 'destabilize', roundsLeft: defender.destabRoundsLeft });
    attacker.hitStreak = 0;
  }

  return { dmg, blocked: false, events, drained, destabilized };
}

// ─────────────────────────────────────────────────────────────────────────────
// Décrément des compteurs de tour (destab, etc.)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Décrémente les compteurs de tour d'un combattant à la fin du round.
 */
export function tickRoundEnd(c) {
  if (c.destabRoundsLeft > 0) {
    c.destabRoundsLeft--;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : factory pour construire un combattant standardisé
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construit un combattant à partir d'une description simplifiée.
 *
 * @param {Object} spec - {
 *   id, name, hp, hpMax,
 *   weapon: { grade, dura, drain?, regenPct? },
 *   shield: { grade, dura, drain?, regenPct? },
 *   armor: { head, torso, arms, legs : { grade, dura, regenPct? } },
 *   weaponFloor?: 0,        // plancher dura arme (boss = 3, mob/joueur = 0)
 *   destabDuration?: 5,     // durée déstabilisation
 *   pattern?: null,         // 'thief', 'drain', 'regen', 'revive', etc.
 * }
 */
export function createCombatant(spec) {
  const safeItem = (item) => item ? {
    grade: item.grade ?? 0,
    dura: item.dura ?? DURA_MAX,
    drain: item.drain || 0,
    regenPct: item.regenPct || 0,
  } : null;

  const safeArmorZone = (item) => item ? {
    grade: item.grade ?? 0,
    dura: item.dura ?? DURA_MAX,
    regenPct: item.regenPct || 0,
  } : { grade: 0, dura: 0, regenPct: 0 };

  return {
    id: spec.id || '',
    name: spec.name || 'Combattant',
    hp: spec.hp ?? 10,
    hpMax: spec.hpMax ?? spec.hp ?? 10,
    weapon: safeItem(spec.weapon),
    shield: safeItem(spec.shield),
    armor: {
      head: safeArmorZone(spec.armor?.head),
      torso: safeArmorZone(spec.armor?.torso),
      arms: safeArmorZone(spec.armor?.arms),
      legs: safeArmorZone(spec.armor?.legs),
    },
    hitStreak: 0,
    destabRoundsLeft: 0,
    weaponFloor: spec.weaponFloor || 0,
    destabDuration: spec.destabDuration || 5,
    pattern: spec.pattern || null,
    hasRevived: false,
  };
}
