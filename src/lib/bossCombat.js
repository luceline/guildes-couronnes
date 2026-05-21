/**
 * src/lib/bossCombat.js — Orchestrateur Boss communautaire (Dragon de Nuit)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  PHILOSOPHIE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ce fichier ORCHESTRE le combat boss tour-par-tour. La résolution mirror
 * est déléguée à combatEngine.js (moteur partagé).
 *
 * Spécificités boss gérées ici :
 *   - Grade arme/bouclier interpolé selon HP boss (G5→G10 quand enragé)
 *   - Plancher dura arme à 3 (boss reste menaçant)
 *   - Heal boss : +1 HP par hit reçu (cap hp_max)
 *   - Choix RNG des zones boss à chaque tour (parade, bouclier, attaque)
 *   - Cap 30 tours, timeout = retraite forcée
 *   - Seed RNG dérivé de `${bossId}_${playerId}_${spawnedAt}` (reproductibilité)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { hashString, seededRandom } from './combatPvE.js';
import {
  COMBAT_ZONES,
  ZONE_LABELS,
  DURA_MAX,
  DESTAB_THRESHOLD,
  createCombatant,
  resolveStrike,
  applyRegenStart,
  pickRandomDefenseZones,
  interpGradeByHp,
  clampDura,
  tickRoundEnd,
} from './combatEngine.js';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes spécifiques boss
// ─────────────────────────────────────────────────────────────────────────────

export const BOSS_ZONES = COMBAT_ZONES; // alias pour compat ancien code
export { ZONE_LABELS, DURA_MAX, DESTAB_THRESHOLD };

// 17/05/2026 — Plancher dura arme boss relevé de 3 à 5.
// (v2 du 17/05 : passé à 6, puis ajusté à 5 pour adoucir la difficulté.)
// L'arme du boss ne descend jamais sous 50% de chance de toucher,
// pour qu'il reste menaçant même en fin de combat.
export const BOSS_WEAPON_DURA_FLOOR = 5;
export const DESTAB_ROUNDS_BOSS = 5;
export const MAX_ROUNDS = 30;
export const HEAD_DAMAGE = 1;
export const OTHER_DAMAGE = 1;

// 17/05/2026 — Système d'armure progressive du boss (v2 : cap à G3).
// L'armure démarre à grade 0 dura 7 (vs G0 dura 10 avant) et monte en
// grade selon les paliers d'HP du boss. Chaque palier franchi POUR LA
// PREMIÈRE FOIS reset la dura à 7 (armure "fraîche"). Si le boss heal
// et retombe dans un palier déjà visité, pas de reset (anti-exploit
// oscillation au seuil 50% HP qui ferait se régénérer infiniment l'armure).
//
// Cap G3 (au lieu de G5 envisagé initialement) : permet à un joueur G3+ solo
// de finir le boss à 5% HP. La coopération reste utile mais pas obligatoire.
export const BOSS_ARMOR_STARTING_DURA = 7;

// Paliers triés DESCENDANT par hpPctMin. Le premier palier dont
// hpPctMin <= hpPct est sélectionné.
// Exemple : HP à 65% → bossArmorGradeForHpPct(0.65) === 1 (palier 51-70%)
export const BOSS_ARMOR_TIERS = [
  { hpPctMin: 0.71, grade: 0 }, // 71-100% HP
  { hpPctMin: 0.51, grade: 1 }, // 51-70%
  { hpPctMin: 0.26, grade: 2 }, // 26-50%
  { hpPctMin: 0.00, grade: 3 }, // 1-25% (cap G3)
];

// Compat ancien code (utilisé par UI)
export const EQUIPMENT_SLOTS = ['weapon', 'shield', 'head_def', 'torso_def', 'arms_def', 'legs_def'];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (compat)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Probabilité de réussite d'un jet selon dura (compat ancien code).
 */
export function durabilityChance(dura) {
  if (dura == null || dura <= 0) return 0;
  if (dura >= DURA_MAX) return 1;
  return dura / DURA_MAX;
}

/**
 * Grade boss interpolé selon HP. À hp_max → gMin, à 1 HP → gMax.
 */
export function bossInterpGrade(hpCurrent, hpMax, gMin, gMax) {
  return interpGradeByHp(hpCurrent, hpMax, gMin, gMax);
}

/**
 * 17/05/2026 — Renvoie le grade d'armure du boss selon son pourcentage d'HP.
 *
 * Paliers (cf. BOSS_ARMOR_TIERS) :
 *   71-100% HP → G0
 *   51-70%    → G1
 *   21-50%    → G2
 *   11-20%    → G3
 *   6-10%     → G4
 *   1-5%      → G5
 *
 * Le boss devient progressivement plus blindé en agonisant.
 * Conséquence : à grade armure égal à grade arme du joueur, le coup passe
 * (tie-break strict >). Donc plus le boss perd HP, plus le joueur a besoin
 * d'une arme de meilleur grade pour percer.
 */
export function bossArmorGradeForHpPct(hpPct) {
  for (const tier of BOSS_ARMOR_TIERS) {
    if (hpPct >= tier.hpPctMin) return tier.grade;
  }
  // Sécurité : ne devrait jamais arriver (le dernier palier a hpPctMin=0)
  return BOSS_ARMOR_TIERS[BOSS_ARMOR_TIERS.length - 1].grade;
}

/**
 * Tire 2 zones distinctes pour le boss (parade + bouclier).
 */
export function pickBossRandomZones(rng) {
  return pickRandomDefenseZones(rng);
}

/**
 * Génère le seed RNG d'un combat unique.
 */
export function makeCombatSeed(bossId, playerId, spawnedAt) {
  return `${bossId}_${playerId}_${spawnedAt}`;
}

/**
 * 17/05/2026 — Met à jour le palier d'armure du boss selon son HP courant.
 *
 * Si le palier change ET le nouveau grade n'a jamais été visité,
 * reset la dura des 4 armures à BOSS_ARMOR_STARTING_DURA et marque le grade
 * comme visité. Si le grade a déjà été visité (boss qui heal et redescend
 * par exemple), pas de reset (anti-exploit oscillation).
 *
 * Retourne true si un reset a eu lieu (pour log).
 *
 * @param {object} bossState - state.boss (mute en place)
 * @returns {boolean}
 */
export function updateBossArmorTier(bossState) {
  const hpPct = (bossState.hp || 0) / (bossState.hpMax || 1);
  const newGrade = bossArmorGradeForHpPct(hpPct);
  const oldGrade = bossState.currentArmorGrade;

  if (newGrade === oldGrade) return false; // pas de changement

  bossState.currentArmorGrade = newGrade;

  // Reset uniquement si le grade n'a jamais été visité.
  // Utilise Array.includes (le state est en Array pour sérialisation JSON).
  if (!Array.isArray(bossState.armorTiersVisited)) {
    bossState.armorTiersVisited = [];
  }
  if (!bossState.armorTiersVisited.includes(newGrade)) {
    bossState.armorTiersVisited.push(newGrade);
    bossState.armorDura = {
      head:  BOSS_ARMOR_STARTING_DURA,
      torso: BOSS_ARMOR_STARTING_DURA,
      arms:  BOSS_ARMOR_STARTING_DURA,
      legs:  BOSS_ARMOR_STARTING_DURA,
    };
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construit l'état initial du combat boss.
 */
export function createInitialCombatState(boss, player, opts = {}) {
  if (!boss || !player) {
    throw new Error('createInitialCombatState: boss et player requis');
  }
  const seed = opts.rngSeed || makeCombatSeed(boss.id, player.id, boss.spawned_at);
  const gems = opts.gems || {};
  const eq = player.equipment || {};

  // Construit le combattant joueur via la factory
  const playerCombatant = createCombatant({
    id: player.id,
    name: player.character_name || 'Aventurier',
    hp: player.hp ?? 10,
    hpMax: player.hp ?? 10,
    weapon: {
      grade: eq.weapon?.grade ?? 0,
      dura: eq.weapon?.durability ?? DURA_MAX,
      drain: gems.weapon_drain || 0,
      regenPct: gems.weapon_regen || 0,
    },
    shield: {
      grade: eq.shield?.grade ?? 0,
      dura: eq.shield?.durability ?? DURA_MAX,
      drain: gems.shield_drain || 0,
      regenPct: gems.shield_regen || 0,
    },
    armor: {
      head:  { grade: eq.head_def?.grade ?? 0,  dura: eq.head_def?.durability ?? DURA_MAX,  regenPct: gems.head_regen  || 0 },
      torso: { grade: eq.torso_def?.grade ?? 0, dura: eq.torso_def?.durability ?? DURA_MAX, regenPct: gems.torso_regen || 0 },
      arms:  { grade: eq.arms_def?.grade ?? 0,  dura: eq.arms_def?.durability ?? DURA_MAX,  regenPct: gems.arms_regen  || 0 },
      legs:  { grade: eq.legs_def?.grade ?? 0,  dura: eq.legs_def?.durability ?? DURA_MAX,  regenPct: gems.legs_regen  || 0 },
    },
  });

  // 17/05/2026 — Calcul du palier initial d'armure (selon HP boss au spawn)
  const initialHpPct = (boss.hp_current || boss.hp_max) / (boss.hp_max || 1);
  const initialArmorGrade = bossArmorGradeForHpPct(initialHpPct);

  return {
    rngSeed: seed,
    round: 0,
    log: [],
    done: false,
    result: null,
    choicesHistory: [],
    damageDealt: 0,
    goldEarned: 0,
    player: playerCombatant,
    boss: {
      id: boss.id,
      name: boss.name || 'Dragon de Nuit',
      hp: boss.hp_current,
      hpMax: boss.hp_max,
      hitStreak: 0,
      destabRoundsLeft: 0,
      destabDuration: DESTAB_ROUNDS_BOSS,
      weaponDura: boss.weapon_dura,
      shieldDura: boss.shield_dura,
      // 17/05/2026 — Dura armure boss démarre à 7 (vs 10 avant).
      // La BDD peut avoir des valeurs persistées d'un combat précédent.
      armorDura: {
        head:  boss.armor_dura_head  ?? BOSS_ARMOR_STARTING_DURA,
        torso: boss.armor_dura_torso ?? BOSS_ARMOR_STARTING_DURA,
        arms:  boss.armor_dura_arms  ?? BOSS_ARMOR_STARTING_DURA,
        legs:  boss.armor_dura_legs  ?? BOSS_ARMOR_STARTING_DURA,
      },
      weaponGradeMin: boss.weapon_grade_min,
      weaponGradeMax: boss.weapon_grade_max,
      shieldGradeMin: boss.shield_grade_min,
      shieldGradeMax: boss.shield_grade_max,
      weaponFloor: BOSS_WEAPON_DURA_FLOOR,
      // 17/05/2026 — Système paliers armure progressive
      // armorTiersVisited : Array des grades déjà visités (anti-exploit oscillation)
      // Utilisé comme Set logique mais stocké en Array pour sérialisation JSON.
      // currentArmorGrade : grade actuel des 4 armures (recalculé chaque round)
      armorTiersVisited: [initialArmorGrade],
      currentArmorGrade: initialArmorGrade,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter : convertit state.boss en "combattant standard" pour combatEngine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le boss n'a pas de structure armor/shield comme le joueur (il a juste weaponDura
 * et shieldDura). On crée un combattant virtuel pour combatEngine.
 *
 * Note : on partage les références primitives (number) qu'on sync après strike.
 */
function bossToCombatant(b) {
  // 17/05/2026 — L'armure boss a maintenant un grade dynamique (G0 à G5)
  // qui dépend du palier d'HP courant (cf. BOSS_ARMOR_TIERS).
  // Le grade vient de b.currentArmorGrade, mis à jour avant chaque strike.
  // La dura armure boss est stockée dans state.boss.armorDura[zone].
  const armorGrade = b.currentArmorGrade ?? 0;
  return {
    id: b.id,
    name: b.name,
    hp: b.hp,
    hpMax: b.hpMax,
    hitStreak: b.hitStreak,
    destabRoundsLeft: b.destabRoundsLeft,
    destabDuration: b.destabDuration,
    weaponFloor: b.weaponFloor,
    weapon: { grade: 0, dura: b.weaponDura, drain: 0, regenPct: 0 }, // grade interpolé via opts
    shield: { grade: 0, dura: b.shieldDura, drain: 0, regenPct: 0 },
    armor: {
      head:  { grade: armorGrade, dura: b.armorDura?.head  ?? BOSS_ARMOR_STARTING_DURA, regenPct: 0 },
      torso: { grade: armorGrade, dura: b.armorDura?.torso ?? BOSS_ARMOR_STARTING_DURA, regenPct: 0 },
      arms:  { grade: armorGrade, dura: b.armorDura?.arms  ?? BOSS_ARMOR_STARTING_DURA, regenPct: 0 },
      legs:  { grade: armorGrade, dura: b.armorDura?.legs  ?? BOSS_ARMOR_STARTING_DURA, regenPct: 0 },
    },
  };
}

/**
 * Resync le boss state depuis le combattant après strike.
 */
function syncBossFromCombatant(b, c) {
  b.hp = c.hp;
  b.weaponDura = c.weapon.dura;
  b.shieldDura = c.shield.dura;
  b.hitStreak = c.hitStreak;
  b.destabRoundsLeft = c.destabRoundsLeft;
  // Sync armure boss (4 zones)
  if (!b.armorDura) b.armorDura = { head: DURA_MAX, torso: DURA_MAX, arms: DURA_MAX, legs: DURA_MAX };
  b.armorDura.head  = c.armor.head.dura;
  b.armorDura.torso = c.armor.torso.dura;
  b.armorDura.arms  = c.armor.arms.dura;
  b.armorDura.legs  = c.armor.legs.dura;
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversion events combatEngine → log boss (UI)
// ─────────────────────────────────────────────────────────────────────────────

function formatEventForLog(ev, attackerName, attZone) {
  const zLabel = ZONE_LABELS[attZone] || attZone;
  switch (ev.type) {
    case 'parry_success':
      return { type: attackerName === 'player' ? 'boss_parry' : 'player_parry', zone: ev.zone,
               msg: attackerName === 'player'
                 ? `Le boss pare votre attaque (${ZONE_LABELS[ev.zone]}).`
                 : `Vous parez l'attaque du boss (${ZONE_LABELS[ev.zone]}).` };
    case 'parry_fail':
      return { type: attackerName === 'player' ? 'boss_parry_fail' : 'player_parry_fail',
               msg: attackerName === 'player' ? `Le boss tente une parade ratée.` : `Votre parade rate.` };
    case 'attack_miss':
      return { type: attackerName === 'player' ? 'player_miss' : 'boss_miss',
               msg: attackerName === 'player' ? `Votre attaque rate sa cible.` : `L'attaque du boss rate.` };
    case 'shield_active':
      return { type: attackerName === 'player' ? 'boss_block' : 'player_shield',
               msg: attackerName === 'player'
                 ? `Le bouclier du boss (G${ev.shieldGrade}) intercepte votre attaque.`
                 : `Bouclier renforce ${zLabel} (+G${ev.shieldGrade}).` };
    case 'shield_fail':
      return { type: attackerName === 'player' ? 'boss_shield_fail' : 'player_shield_fail',
               msg: attackerName === 'player' ? `Le bouclier du boss rate son jet.` : `Bouclier rate son jet.` };
    case 'shield_off':
      return { type: 'boss_shield_off',
               msg: `Le bouclier du boss est désactivé (${ev.roundsLeft}t restants).` };
    case 'block':
      // Si shieldActiveAndBlocking → c'est le bouclier qui bloque (label "bouclier")
      // Sinon → c'est l'armure de zone qui bloque (label "armure XX")
      // L'event ne donne pas l'info, mais on peut déduire : si defGrade > shield max possible
      // (G10 boss / G5 joueur) → c'est armure + bouclier combiné.
      // Plus simple : on garde le wording générique selon attaquant.
      return { type: attackerName === 'player' ? 'boss_block' : 'player_block',
               msg: attackerName === 'player'
                 ? `Le boss (défense G${ev.defGrade}) bloque votre attaque ${ZONE_LABELS[ev.zone]} (G${ev.attGrade}).`
                 : `Votre défense ${ZONE_LABELS[ev.zone]} G${ev.defGrade} bloque (G${ev.attGrade}).` };
    case 'partial_block':
      return { type: attackerName === 'player' ? 'boss_partial_block' : 'player_partial_block',
               msg: attackerName === 'player'
                 ? `La défense du boss (G${ev.defGrade}) cède sous votre G${ev.attGrade} (${ZONE_LABELS[ev.zone]}).`
                 : `Votre défense ${ZONE_LABELS[ev.zone]} G${ev.defGrade} cède sous G${ev.attGrade}.` };
    case 'armor_fail':
      return { type: attackerName === 'player' ? 'boss_armor_fail' : 'player_armor_fail',
               msg: attackerName === 'player'
                 ? `L'armure du boss (${ZONE_LABELS[ev.zone]}) rate son jet.`
                 : `Votre armure ${ZONE_LABELS[ev.zone]} rate son jet.` };
    case 'hit':
      return { type: attackerName === 'player' ? 'player_hit' : 'boss_hit',
               zone: ev.zone, dmg: ev.dmg,
               msg: attackerName === 'player'
                 ? `Vous touchez ${ZONE_LABELS[ev.zone]} : -${ev.dmg} HP boss, +${ev.dmg}💰.`
                 : `Le boss vous touche ${ZONE_LABELS[ev.zone]} : -${ev.dmg} HP.` };
    case 'drain':
      return { type: 'drain', msg: `Drain de vie : +${ev.amount} HP.` };
    case 'destabilize':
      return { type: 'destab',
               msg: `Le boss est déstabilisé ! Bouclier OFF ${ev.roundsLeft} tours.` };
    case 'regen':
      return { type: 'regen', msg: `Regen de ${ev.slot} : +1 dura.` };
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Résolution d'un round complet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Résout un round complet (player attack puis boss attack).
 *
 * @param {Object} state - état courant (sera muté → caller doit clone si besoin)
 * @param {Object} playerChoices - { attack, parry, shield } zones du joueur
 * @returns {Object} l'état mis à jour. state.done = true si combat fini.
 */
export function resolveBossRound(state, playerChoices) {
  if (state.done) return state;
  if (state.round >= MAX_ROUNDS) {
    state.done = true;
    state.result = 'timeout';
    state.log.push({ type: 'timeout', msg: `Combat trop long (${MAX_ROUNDS} tours). Vous battez en retraite.` });
    return state;
  }

  // Validation choix joueur
  const { attack, parry, shield } = playerChoices;
  if (!BOSS_ZONES.includes(attack) || !BOSS_ZONES.includes(parry) || !BOSS_ZONES.includes(shield)) {
    throw new Error('resolveBossRound: zones invalides dans playerChoices');
  }
  if (parry === shield) {
    throw new Error('resolveBossRound: parade et bouclier doivent être sur zones différentes');
  }

  state.round++;
  state.choicesHistory.push({ round: state.round, ...playerChoices });

  // RNG seedé pour ce round
  const rng = seededRandom(`${state.rngSeed}_r${state.round}`);

  // Regen début de tour (player uniquement)
  const regenEvents = applyRegenStart(state.player, rng);
  regenEvents.forEach(ev => {
    const formatted = formatEventForLog(ev);
    if (formatted) state.log.push(formatted);
  });

  // Regen bouclier boss : 40% chance +1 dura par tour
  if (state.boss.shieldDura > 0 && state.boss.shieldDura < DURA_MAX && rng() < 0.4) {
    state.boss.shieldDura = clampDura(state.boss.shieldDura + 1);
    state.log.push({ type: 'boss_shield_regen', msg: `Le bouclier du boss se renforce (+1 dura, ${state.boss.shieldDura}/${DURA_MAX}).` });
  }

  // Regen armure boss : 40% chance +1 dura par tour, sur chacune des 4 zones
  if (!state.boss.armorDura) {
    state.boss.armorDura = { head: DURA_MAX, torso: DURA_MAX, arms: DURA_MAX, legs: DURA_MAX };
  }
  for (const zone of BOSS_ZONES) {
    const cur = state.boss.armorDura[zone];
    if (cur > 0 && cur < DURA_MAX && rng() < 0.4) {
      state.boss.armorDura[zone] = clampDura(cur + 1);
      state.log.push({
        type: 'boss_armor_regen',
        msg: `L'armure ${ZONE_LABELS[zone]} du boss se renforce (+1 dura, ${state.boss.armorDura[zone]}/${DURA_MAX}).`,
      });
    }
  }

  // Tick destab boss (décrément en début de tour)
  if (state.boss.destabRoundsLeft > 0) {
    state.boss.destabRoundsLeft--;
    if (state.boss.destabRoundsLeft === 0) {
      state.player.hitStreak = 0;
      state.log.push({ type: 'destab_end', msg: `Le boss reprend son bouclier.` });
    }
  }

  state.log.push({ type: 'round_start', msg: `── Tour ${state.round} ──` });

  // Tirages aléatoires des choix boss pour ce round
  const bossDef = pickBossRandomZones(rng);
  const bossAttZone = BOSS_ZONES[Math.floor(rng() * 4)];

  // ─── Joueur attaque le boss ─────────────────────────────────────────
  // 17/05/2026 : recalcul du palier armure du boss avant le strike.
  // Si le HP% est passé sous un nouveau seuil pour la 1ère fois, reset dura à 7.
  if (updateBossArmorTier(state.boss)) {
    state.log.push({
      type: 'boss_armor_tier_change',
      msg: `Le boss enrage ! Armure G${state.boss.currentArmorGrade}, dura ${BOSS_ARMOR_STARTING_DURA}/${DURA_MAX}.`,
    });
  }
  const bossCombatant = bossToCombatant(state.boss);
  const playerStrike = resolveStrike(
    state.player,
    bossCombatant,
    { attZone: attack, defParry: bossDef.parry, defShield: bossDef.shield },
    rng,
    {
      defenderShieldGrade: bossInterpGrade(
        state.boss.hp, state.boss.hpMax,
        state.boss.shieldGradeMin, state.boss.shieldGradeMax
      ),
    },
  );
  // Resync boss state depuis combatant
  syncBossFromCombatant(state.boss, bossCombatant);
  // Log events
  playerStrike.events.forEach(ev => {
    const formatted = formatEventForLog(ev, 'player', attack);
    if (formatted) state.log.push(formatted);
  });

  // Comptabilité dégâts joueur (or = +1 par dégât)
  if (playerStrike.dmg > 0) {
    state.damageDealt += playerStrike.dmg;
    state.goldEarned += playerStrike.dmg;
  }

  if (state.boss.hp <= 0) {
    state.done = true;
    state.result = 'kill';
    state.log.push({
      type: 'boss_killed',
      msg: `Le boss tombe ! Victoire au tour ${state.round}. Dégâts cumulés : ${state.damageDealt}, +${state.goldEarned}💰.`,
    });
    return state;
  }

  // ─── Boss attaque le joueur ─────────────────────────────────────────
  // 17/05/2026 : on re-check le palier armure ici aussi car le boss a
  // pu encaisser des dégâts et passer un palier entre les 2 strikes.
  // (Évite que le boss ait un grade obsolète en défendant après son propre dmg.)
  if (updateBossArmorTier(state.boss)) {
    state.log.push({
      type: 'boss_armor_tier_change',
      msg: `Le boss enrage ! Armure G${state.boss.currentArmorGrade}, dura ${BOSS_ARMOR_STARTING_DURA}/${DURA_MAX}.`,
    });
  }
  const bossCombatant2 = bossToCombatant(state.boss);
  const bossStrike = resolveStrike(
    bossCombatant2,
    state.player,
    { attZone: bossAttZone, defParry: parry, defShield: shield },
    rng,
    {
      attackerWeaponGrade: bossInterpGrade(
        state.boss.hp, state.boss.hpMax,
        state.boss.weaponGradeMin, state.boss.weaponGradeMax
      ),
    },
  );
  syncBossFromCombatant(state.boss, bossCombatant2);
  bossStrike.events.forEach(ev => {
    const formatted = formatEventForLog(ev, 'boss', bossAttZone);
    if (formatted) state.log.push(formatted);
  });

  // Heal boss : +1 HP par hit qu'IL inflige au joueur (cap hp_max)
  if (bossStrike.dmg > 0) {
    const beforeHeal = state.boss.hp;
    state.boss.hp = Math.min(state.boss.hpMax, state.boss.hp + 1);
    if (state.boss.hp > beforeHeal) {
      state.log.push({ type: 'boss_heal', msg: `Le boss se régénère (+1 HP, ${state.boss.hp}/${state.boss.hpMax}).` });
    }
  }

  if (state.player.hp <= 0) {
    state.done = true;
    state.result = 'ko';
    state.log.push({
      type: 'player_ko',
      msg: `Vous êtes KO. Dégâts cumulés sur le boss : ${state.damageDealt}.`,
    });
    return state;
  }

  return state;
}

// ─────────────────────────────────────────────────────────────────────────────
// Final result (payload serveur)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construit le payload à envoyer au serveur après combat.
 */
export function buildFinalCombatResult(state, manualResult = null) {
  const result = manualResult || state.result;
  if (!result) {
    throw new Error('buildFinalCombatResult: combat pas terminé et pas de result fourni');
  }

  return {
    bossId: state.boss.id,
    playerId: state.player.id,
    rngSeed: state.rngSeed,
    rounds: state.choicesHistory,
    finalResult: {
      result,
      damageDealt: state.damageDealt,
      roundsPlayed: state.round,
      goldEarned: state.goldEarned,
      bossHpAfter: state.boss.hp,
      bossWeaponDuraAfter: state.boss.weaponDura,
      bossShieldDuraAfter: state.boss.shieldDura,
      playerHpAfter: state.player.hp,
    },
    playerEquipment: {
      weapon:    { grade: state.player.weapon.grade,      durability: state.player.weapon.dura },
      shield:    { grade: state.player.shield.grade,      durability: state.player.shield.dura },
      head_def:  { grade: state.player.armor.head.grade,  durability: state.player.armor.head.dura },
      torso_def: { grade: state.player.armor.torso.grade, durability: state.player.armor.torso.dura },
      arms_def:  { grade: state.player.armor.arms.grade,  durability: state.player.armor.arms.dura },
      legs_def:  { grade: state.player.armor.legs.grade,  durability: state.player.armor.legs.dura },
    },
  };
}

/**
 * Marque le combat comme abandonné (flee) sans jouer de round.
 */
export function fleeCombat(state) {
  if (state.done) return state;
  state.done = true;
  state.result = 'flee';
  state.log.push({ type: 'flee', msg: `Vous battez en retraite. Le boss conserve sa blessure.` });
  return state;
}
