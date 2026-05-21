/**
 * src/lib/combatPvE.js — Orchestrateur PvE biome (5 vagues, 1 mob/vague)
 *
 * Refonte mai 2026 : passage de 3 mobs simultanés à 1 mob par vague,
 * combat tour-par-tour aligné sur la mécanique boss (combatEngine.js).
 *
 * Une épopée = 5 vagues, 1 mob distinct par vague. Le joueur conserve son
 * HP et sa durabilité entre les vagues. Il peut utiliser cataplasme/marteau
 * entre les vagues pour se soigner ou réparer.
 *
 * Patterns monstres :
 *   - normal  : aucun effet
 *   - weak    : grade -1
 *   - heavy   : grade +1
 *   - thief   : vole 5 or au joueur quand il touche
 *   - drain   : +1 HP au mob ET -1 HP au joueur (cumul) quand touche
 *   - regen   : 20% chance +1 HP au mob en début de tour
 *   - revive  : ressuscite UNE fois avec hp = floor(hpMax/2) quand meurt
 *
 *   Rage : si HP ≤ 60% → grade +1
 */

import {
  COMBAT_ZONES,
  ZONE_LABELS,
  DURA_MAX,
  createCombatant,
  resolveStrike,
  applyRegenStart,
  pickRandomDefenseZones,
  clampDura,
} from './combatEngine.js';

export { COMBAT_ZONES };

// ─────────────────────────────────────────────────────────────
// Constantes PvE
// ─────────────────────────────────────────────────────────────

export const COMBAT_MAX_HP = 10;

export function getCombatItemValue(grade) {
  return 1 + (grade ?? 0);
}

export const MONSTERS_PER_WAVE = 1;
export const MAX_WAVES_PER_DAY = 5;
// 17/05/2026 — Plancher HP passé de 1 à 0 : la mort en PvE biome est désormais
// possible. Le joueur conserve les récompenses des vagues précédemment réussies
// (par vague, pas par épopée). Force à mieux gérer cataplasme/marteau et à
// fuir quand nécessaire au lieu de farmer sans risque.
export const PVE_HP_FLOOR = 0;

export const MAX_TURNS_PER_MOB = 15;
export const MAX_TURNS_PER_WAVE = MAX_TURNS_PER_MOB;

export const WAVE_START_HUNGER_COST = 1;
export const WAVE_START_ENERGY_COST = 1;
export const POTION_HEAL_HP = 5;

export const MAX_ITEM_GRADE = 5;
export const MAX_RAGE_GRADE = 6;
export const RAGE_HP_THRESHOLD = 0.60;

export const MOB_HP_PER_WAVE = 4;
/** Durabilité de départ des items mob (arme, bouclier, armures). Plus bas que joueur pour équilibre. */
export const MOB_STARTING_DURA = 5;

// 17/05/2026 — Rééquilibrage PvE biome : difficulté progressive.
// AVANT : toutes les vagues avaient HP=4, dmg=1, armure G0. Un joueur G1 pouvait
//         finir les 5 vagues sans difficulté (HP joueur ne descendant jamais < 1).
// APRÈS : HP, grade et dmgMult croissent avec la vague. Combiné au plancher HP=0
//         (mort possible), le PvE devient un vrai challenge à partir de la vague 3.
//
// dmgMult multiplie les dégâts du mob avant application au joueur :
//   vagues 1-2 : dmg de base (1)
//   vagues 3-4 : dégâts doublés (2)
//   vague 5    : dégâts triplés (3)
//
// armorGrade : la zone touchée du mob a ce grade d'armure (au lieu de G0 partout).
// Force le joueur à monter en grade d'arme à mesure des vagues.
export const WAVE_STATS = [
  { wave: 1, hp: 4,  grade: 1, dmgMult: 1, armorGrade: 0 },
  { wave: 2, hp: 6,  grade: 2, dmgMult: 1, armorGrade: 1 },
  { wave: 3, hp: 8,  grade: 3, dmgMult: 2, armorGrade: 2 },
  { wave: 4, hp: 10, grade: 4, dmgMult: 2, armorGrade: 3 },
  { wave: 5, hp: 12, grade: 5, dmgMult: 3, armorGrade: 4 },
];

// ─────────────────────────────────────────────────────────────
// Monstres
// ─────────────────────────────────────────────────────────────

export const MONSTERS_DATA = [
  { name: "Gobelin",       icon: "👹", pattern: "normal" },
  { name: "Loup",          icon: "🐺", pattern: "normal" },
  { name: "Corbeau",       icon: "🐦", pattern: "weak" },
  { name: "Brigand",       icon: "🗡️", pattern: "thief" },
  { name: "Vampire",       icon: "🧛", pattern: "drain" },
  { name: "Squelette",     icon: "💀", pattern: "revive" },
  { name: "Golem",         icon: "🗿", pattern: "heavy" },
  { name: "Troll",         icon: "👺", pattern: "regen" },
  { name: "Dragon mineur", icon: "🐉", pattern: "heavy" },
  { name: "Ombre",         icon: "👻", pattern: "normal" },
  { name: "Élémental",     icon: "🔥", pattern: "weak" },
  { name: "Sorcière",      icon: "🧙", pattern: "regen" },
];

export const WAVE_MONSTER_POOLS = [
  [0, 1, 2, 6],
  [0, 1, 2, 3, 6, 7],
  [0, 1, 3, 5, 6, 7, 9],
  [3, 4, 5, 6, 7, 8, 9],
  [3, 4, 5, 6, 7, 8, 9, 10, 11],
];

// ─────────────────────────────────────────────────────────────
// Récompenses mob
// ─────────────────────────────────────────────────────────────

export const MOB_GOLD_BASE = [1, 2, 3, 4, 5];
export const MOB_DROP_BASE = [0.05, 0.10, 0.15, 0.20, 0.25];
export const GOLD_PER_GRADE = 3;
export const DROP_PCT_PER_GRADE = 0.02;

export function getMobReward(waveIdx, grade, bonusDropFlat = 0) {
  const gradeBonus = Math.max(0, (grade || 1) - 1);
  return {
    gold: (MOB_GOLD_BASE[waveIdx] || 0) + gradeBonus * GOLD_PER_GRADE,
    dropPct: Math.min(1, (MOB_DROP_BASE[waveIdx] || 0) + gradeBonus * DROP_PCT_PER_GRADE + bonusDropFlat),
  };
}

// ─────────────────────────────────────────────────────────────
// Maîtrise biome (LORE seulement)
// ─────────────────────────────────────────────────────────────

export const MASTERY_TIERS = [
  { level: 0, threshold: 0,    label: "Apprenti", goldBonus: 0, hpBonus: 0 },
  { level: 1, threshold: 10,   label: "Novice",   goldBonus: 0, hpBonus: 0 },
  { level: 2, threshold: 30,   label: "Adepte",   goldBonus: 0, hpBonus: 0 },
  { level: 3, threshold: 75,   label: "Expert",   goldBonus: 0, hpBonus: 0 },
  { level: 4, threshold: 150,  label: "Maître",   goldBonus: 0, hpBonus: 0 },
  { level: 5, threshold: 300,  label: "Légende",  goldBonus: 0, hpBonus: 0 },
];

export function getHintInfo(currentHP, maxHP) {
  if (maxHP === 0) return { label: "?", color: "#666" };
  const pct = currentHP / maxHP;
  if (pct > 0.66) return { label: "Sain", color: "#5dcaa5" };
  if (pct > 0.33) return { label: "Blessé", color: "#ef9f27" };
  return { label: "Mourant", color: "#e24b4a" };
}

// ─────────────────────────────────────────────────────────────
// RNG seedé (utilisé aussi par bossCombat.js)
// ─────────────────────────────────────────────────────────────

export function hashString(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h;
}

export function seededRandom(seedStr) {
  let s = Math.abs(hashString(seedStr)) || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ─────────────────────────────────────────────────────────────
// Maîtrise & HP
// ─────────────────────────────────────────────────────────────

export function getMasteryInfo(profile, biomeKey) {
  const masteryData = profile?.biome_mastery || {};
  const score = masteryData[biomeKey]?.score || 0;
  let tier = MASTERY_TIERS[0];
  for (const t of MASTERY_TIERS) {
    if (score >= t.threshold) tier = t;
  }
  const nextTier = MASTERY_TIERS[tier.level + 1] || null;
  return {
    score, level: tier.level, label: tier.label,
    goldBonus: tier.goldBonus, hpBonus: tier.hpBonus,
    nextThreshold: nextTier?.threshold || null,
  };
}

export function getPlayerMaxHP(profile, biomeKey) {
  const mastery = getMasteryInfo(profile, biomeKey);
  return COMBAT_MAX_HP + (mastery.hpBonus || 0);
}

// ─────────────────────────────────────────────────────────────
// Génération de l'épopée (5 mobs distincts)
// ─────────────────────────────────────────────────────────────

/**
 * Génère les 5 mobs d'une épopée (1 mob par vague, tous distincts).
 */
export function generateEpicMobs(biomeKey, dayStr) {
  const rng = seededRandom(`${biomeKey}_${dayStr}_epic`);
  const usedIndices = new Set();
  const mobs = [];

  for (let w = 0; w < MAX_WAVES_PER_DAY; w++) {
    const pool = WAVE_MONSTER_POOLS[w] || [];
    const available = pool.filter(idx => !usedIndices.has(idx));
    const finalPool = available.length > 0 ? available : pool;
    const chosenIdx = finalPool[Math.floor(rng() * finalPool.length)];
    usedIndices.add(chosenIdx);

    const data = MONSTERS_DATA[chosenIdx];
    const stats = WAVE_STATS[w];
    mobs.push({
      waveIdx: w,
      monsterIdx: chosenIdx,
      name: data.name,
      icon: data.icon,
      pattern: data.pattern,
      hpMax: stats.hp,
      grade: stats.grade,
      // 17/05/2026 — Difficulté progressive
      dmgMult: stats.dmgMult || 1,
      armorGrade: stats.armorGrade || 0,
    });
  }

  return mobs;
}

/**
 * @deprecated Pour compat avec ancien code. Génère 1 seul mob pour la vague indiquée.
 */
export function generateWave(biomeKey, dayStr, waveIndex) {
  const mobs = generateEpicMobs(biomeKey, dayStr);
  return [mobs[waveIndex]];
}

// ─────────────────────────────────────────────────────────────
// Construction d'un combattant mob
// ─────────────────────────────────────────────────────────────

function buildMobCombatant(mobSpec) {
  let effGrade = mobSpec.grade;
  if (mobSpec.pattern === 'weak') effGrade = Math.max(0, effGrade - 1);
  else if (mobSpec.pattern === 'heavy') effGrade = Math.min(MAX_RAGE_GRADE, effGrade + 1);

  // 17/05/2026 — Armure mob progressive (G0 vague 1 → G4 vague 5).
  // Avant : armure G0 partout (peu protectrice, juste pour permettre le jet armure).
  // Maintenant : la zone touchée a un vrai grade qui force le joueur à monter en
  // grade d'arme. Tie-break strict (armure > arme) signifie que pour percer
  // un mob G3 il faut une arme G4+.
  const armorG = mobSpec.armorGrade ?? 0;
  return createCombatant({
    id: `mob_${mobSpec.waveIdx}`,
    name: mobSpec.name,
    hp: mobSpec.hpMax,
    hpMax: mobSpec.hpMax,
    weapon: { grade: effGrade, dura: MOB_STARTING_DURA },
    shield: { grade: effGrade, dura: MOB_STARTING_DURA },
    armor: {
      head:  { grade: armorG, dura: MOB_STARTING_DURA },
      torso: { grade: armorG, dura: MOB_STARTING_DURA },
      arms:  { grade: armorG, dura: MOB_STARTING_DURA },
      legs:  { grade: armorG, dura: MOB_STARTING_DURA },
    },
    pattern: mobSpec.pattern,
    weaponFloor: 0,
    destabDuration: 3,
  });
}

function buildPlayerCombatant(profile, currentHP, biomeKey) {
  const eq = profile?.equipment || {};
  const hpMax = getPlayerMaxHP(profile, biomeKey);
  return createCombatant({
    id: profile?.id || 'player',
    name: profile?.character_name || 'Aventurier',
    hp: currentHP,
    hpMax,
    weapon: {
      grade: eq.weapon?.grade ?? 0,
      dura: eq.weapon?.durability ?? DURA_MAX,
    },
    shield: {
      grade: eq.shield?.grade ?? 0,
      dura: eq.shield?.durability ?? DURA_MAX,
    },
    armor: {
      head:  { grade: eq.head_def?.grade ?? 0,  dura: eq.head_def?.durability ?? DURA_MAX },
      torso: { grade: eq.torso_def?.grade ?? 0, dura: eq.torso_def?.durability ?? DURA_MAX },
      arms:  { grade: eq.arms_def?.grade ?? 0,  dura: eq.arms_def?.durability ?? DURA_MAX },
      legs:  { grade: eq.legs_def?.grade ?? 0,  dura: eq.legs_def?.durability ?? DURA_MAX },
    },
    weaponFloor: 0,
    destabDuration: 3,
  });
}

// ─────────────────────────────────────────────────────────────
// Initialisation d'un combat de vague
// ─────────────────────────────────────────────────────────────

export function createInitialWaveState({ profile, biomeKey, waveIndex, dayStr, startingHP, epicMode = false }) {
  if (!profile) throw new Error('createInitialWaveState: profile requis');
  const mobs = generateEpicMobs(biomeKey, dayStr);
  const mobSpec = mobs[waveIndex];
  if (!mobSpec) throw new Error(`Pas de mob pour vague ${waveIndex}`);

  const rngSeed = `${biomeKey}_${dayStr}_w${waveIndex}_${profile.id}`;
  const mob = buildMobCombatant(mobSpec);
  const player = buildPlayerCombatant(profile, startingHP ?? COMBAT_MAX_HP, biomeKey);

  return {
    rngSeed,
    biomeKey,
    waveIndex,
    dayStr,
    epicMode,
    round: 0,
    log: [],
    status: 'in_progress',
    result: null,
    choicesHistory: [],
    player,
    mob,
    mobSpec,
    killRewards: [],
    goldStolenInWave: 0,
    goldEarned: 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Résolution d'un round PvE
// ─────────────────────────────────────────────────────────────

function getEffectiveMobGrade(mob) {
  let grade = mob.weapon?.grade ?? 0;
  if (mob.hp > 0 && mob.hp / mob.hpMax <= RAGE_HP_THRESHOLD) {
    grade = Math.min(MAX_RAGE_GRADE, grade + 1);
  }
  return grade;
}

function formatPveEvent(ev, attackerSide, mobName, attZone) {
  const zLabel = ZONE_LABELS[attZone] || attZone;
  switch (ev.type) {
    case 'parry_success':
      return attackerSide === 'player'
        ? { type: 'mob_parry', msg: `Le ${mobName} pare votre attaque (${ZONE_LABELS[ev.zone]}).` }
        : { type: 'player_parry', msg: `Vous parez l'attaque du ${mobName} (${ZONE_LABELS[ev.zone]}).` };
    case 'parry_fail':
      return attackerSide === 'player'
        ? { type: 'mob_parry_fail', msg: `Le ${mobName} tente une parade ratée.` }
        : { type: 'player_parry_fail', msg: `Votre parade rate.` };
    case 'attack_miss':
      return attackerSide === 'player'
        ? { type: 'player_miss', msg: `Votre attaque rate sa cible.` }
        : { type: 'mob_miss', msg: `L'attaque du ${mobName} rate.` };
    case 'shield_active':
      return attackerSide === 'player'
        ? { type: 'mob_block', msg: `Le bouclier du ${mobName} (G${ev.shieldGrade}) intercepte votre attaque.` }
        : { type: 'player_shield', msg: `Bouclier renforce ${zLabel} (+G${ev.shieldGrade}).` };
    case 'shield_fail':
      return attackerSide === 'player'
        ? { type: 'mob_shield_fail', msg: `Le bouclier du ${mobName} rate son jet.` }
        : { type: 'player_shield_fail', msg: `Bouclier rate son jet.` };
    case 'shield_off':
      return { type: 'mob_shield_off', msg: `Le bouclier du ${mobName} est désactivé (${ev.roundsLeft}t).` };
    case 'block':
      return attackerSide === 'player'
        ? { type: 'mob_block', msg: `La défense du ${mobName} (G${ev.defGrade}) bloque votre attaque ${ZONE_LABELS[ev.zone]} (G${ev.attGrade}).` }
        : { type: 'player_block', msg: `Votre défense ${ZONE_LABELS[ev.zone]} G${ev.defGrade} bloque (G${ev.attGrade}).` };
    case 'partial_block':
      return attackerSide === 'player'
        ? { type: 'mob_partial_block', msg: `La défense du ${mobName} (G${ev.defGrade}) cède sous votre G${ev.attGrade} (${ZONE_LABELS[ev.zone]}).` }
        : { type: 'player_partial_block', msg: `Votre défense ${ZONE_LABELS[ev.zone]} G${ev.defGrade} cède sous G${ev.attGrade}.` };
    case 'armor_fail':
      return attackerSide === 'player'
        ? { type: 'mob_armor_fail', msg: `L'armure du ${mobName} (${ZONE_LABELS[ev.zone]}) rate son jet.` }
        : { type: 'player_armor_fail', msg: `Votre armure ${ZONE_LABELS[ev.zone]} rate son jet.` };
    case 'hit':
      return attackerSide === 'player'
        ? { type: 'player_hit', zone: ev.zone, dmg: ev.dmg, msg: `Vous touchez ${ZONE_LABELS[ev.zone]} : -${ev.dmg} HP.` }
        : { type: 'mob_hit', zone: ev.zone, dmg: ev.dmg, msg: `Le ${mobName} vous touche ${ZONE_LABELS[ev.zone]} : -${ev.dmg} HP.` };
    case 'drain':
      return { type: 'gem_drain', msg: `Drain de vie (gemme) : +${ev.amount} HP.` };
    case 'destabilize':
      return { type: 'destab',
               msg: attackerSide === 'player'
                 ? `Le ${mobName} est déstabilisé !`
                 : `Vous êtes déstabilisé !` };
    default:
      return null;
  }
}

export function resolveWaveRound(state, playerChoices) {
  if (state.status !== 'in_progress') return state;

  if (state.round >= MAX_TURNS_PER_MOB) {
    state.status = 'out_of_turns';
    state.log.push({ type: 'timeout', msg: `Trop de tours (${MAX_TURNS_PER_MOB}). Le ${state.mob.name} s'enfuit.` });
    return state;
  }

  const { attack, parry, shield } = playerChoices;
  if (!COMBAT_ZONES.includes(attack) || !COMBAT_ZONES.includes(parry) || !COMBAT_ZONES.includes(shield)) {
    throw new Error('resolveWaveRound: zones invalides');
  }
  if (parry === shield) {
    throw new Error('resolveWaveRound: parade et bouclier doivent être sur zones différentes');
  }

  state.round++;
  state.choicesHistory.push({ round: state.round, ...playerChoices });

  const rng = seededRandom(`${state.rngSeed}_r${state.round}`);

  // Regen joueur (gemmes)
  const regenEvents = applyRegenStart(state.player, rng);
  regenEvents.forEach(ev => {
    state.log.push({ type: 'regen', msg: `Regen ${ev.slot} : +1 dura.` });
  });

  // Regen bouclier mob : 40% chance +1 dura par tour
  if (state.mob.shield && state.mob.shield.dura > 0 && state.mob.shield.dura < DURA_MAX && rng() < 0.4) {
    state.mob.shield.dura = clampDura(state.mob.shield.dura + 1);
    state.log.push({
      type: 'mob_shield_regen',
      msg: `Le bouclier du ${state.mob.name} se renforce (+1 dura, ${state.mob.shield.dura}/${DURA_MAX}).`,
    });
  }

  // Regen armure mob : 40% chance +1 dura par tour, sur chacune des 4 zones
  for (const zone of COMBAT_ZONES) {
    const armorZone = state.mob.armor?.[zone];
    if (armorZone && armorZone.dura > 0 && armorZone.dura < DURA_MAX && rng() < 0.4) {
      armorZone.dura = clampDura(armorZone.dura + 1);
      state.log.push({
        type: 'mob_armor_regen',
        msg: `L'armure ${ZONE_LABELS[zone]} du ${state.mob.name} se renforce (+1 dura).`,
      });
    }
  }

  // Pattern regen mob : 20% chance +1 HP
  if (state.mob.pattern === 'regen' && state.mob.hp > 0 && state.mob.hp < state.mob.hpMax && rng() < 0.20) {
    state.mob.hp = Math.min(state.mob.hpMax, state.mob.hp + 1);
    state.log.push({ type: 'mob_regen', msg: `Le ${state.mob.name} se régénère (+1 HP, ${state.mob.hp}/${state.mob.hpMax}).` });
  }

  // Tick destab mob
  if (state.mob.destabRoundsLeft > 0) {
    state.mob.destabRoundsLeft--;
    if (state.mob.destabRoundsLeft === 0) {
      state.player.hitStreak = 0;
      state.log.push({ type: 'destab_end', msg: `Le ${state.mob.name} reprend son bouclier.` });
    }
  }

  state.log.push({ type: 'round_start', msg: `── Tour ${state.round} ──` });

  const mobDef = pickRandomDefenseZones(rng);
  const mobAttZone = COMBAT_ZONES[Math.floor(rng() * 4)];

  // ─── Joueur attaque mob ─────────────────────────────────────────────
  const playerStrike = resolveStrike(
    state.player,
    state.mob,
    { attZone: attack, defParry: mobDef.parry, defShield: mobDef.shield },
    rng,
  );
  playerStrike.events.forEach(ev => {
    const formatted = formatPveEvent(ev, 'player', state.mob.name, attack);
    if (formatted) state.log.push(formatted);
  });

  // Mob mort ? (avec revive éventuel)
  if (state.mob.hp <= 0) {
    if (state.mob.pattern === 'revive' && !state.mob.hasRevived) {
      state.mob.hasRevived = true;
      state.mob.hp = Math.floor(state.mob.hpMax / 2);
      state.log.push({
        type: 'mob_revive',
        msg: `Le ${state.mob.name} se relève (${state.mob.hp}/${state.mob.hpMax} HP) !`,
      });
    } else {
      // Vraiment mort
      const reward = getMobReward(state.waveIndex, state.mobSpec.grade);
      const dropped = rng() < reward.dropPct;
      state.killRewards.push({
        gold: reward.gold,
        dropped,
        monsterIdx: state.mobSpec.monsterIdx,
        position: 0,
        waveIdx: state.waveIndex,
      });
      state.goldEarned += reward.gold;
      state.status = 'wave_complete';
      state.log.push({
        type: 'mob_killed',
        msg: `Le ${state.mob.name} tombe ! +${reward.gold}💰${dropped ? ' +1 drop' : ''}`,
      });
      return state;
    }
  }

  // ─── Mob attaque joueur ─────────────────────────────────────────────
  // 17/05/2026 — Dégâts mob multipliés selon la vague (1-2 dmg=1, 3-4 dmg=2, 5 dmg=3)
  const mobStrike = resolveStrike(
    state.mob,
    state.player,
    { attZone: mobAttZone, defParry: parry, defShield: shield },
    rng,
    {
      attackerWeaponGrade: getEffectiveMobGrade(state.mob),
      damageMultiplier: state.mobSpec?.dmgMult || 1,
    },
  );
  mobStrike.events.forEach(ev => {
    const formatted = formatPveEvent(ev, 'mob', state.mob.name, mobAttZone);
    if (formatted) state.log.push(formatted);
  });

  // Patterns spéciaux quand le mob touche
  if (mobStrike.dmg > 0) {
    if (state.mob.pattern === 'thief') {
      state.goldStolenInWave += 5;
      state.log.push({
        type: 'mob_thief',
        msg: `Le ${state.mob.name} vole 5 or dans votre bourse !`,
      });
    }
    if (state.mob.pattern === 'drain') {
      const before = state.mob.hp;
      state.mob.hp = Math.min(state.mob.hpMax, state.mob.hp + 1);
      const drainAmount = state.mob.hp - before;
      state.player.hp = Math.max(PVE_HP_FLOOR, state.player.hp - 1);
      if (drainAmount > 0) {
        state.log.push({
          type: 'mob_drain',
          msg: `Le ${state.mob.name} draine votre vie (-1 HP) et se soigne (+${drainAmount} HP).`,
        });
      }
    }
  }

  // 17/05/2026 — Plancher HP passé à 0 : la mort en PvE biome est désormais
  // possible. Si player.hp <= 0, on marque le combat comme perdu (status 'dead').
  // Le joueur conserve les récompenses des vagues précédentes (déjà persistées).
  if (state.player.hp <= 0) {
    state.player.hp = 0;
    state.status = 'dead';
    state.log.push({
      type: 'player_dead',
      msg: `Vous tombez face au ${state.mob.name}. La vague est perdue, mais vous gardez vos récompenses des vagues précédentes.`,
    });
    return state;
  }

  // Plancher HP joueur (ne peut pas être négatif)
  if (state.player.hp < PVE_HP_FLOOR) {
    state.player.hp = PVE_HP_FLOOR;
  }

  return state;
}

export function fleeWave(state) {
  if (state.status !== 'in_progress') return state;
  state.status = 'fled';
  state.log.push({ type: 'flee', msg: `Vous battez en retraite.` });
  return state;
}

// ─────────────────────────────────────────────────────────────
// Status helpers (compat)
// ─────────────────────────────────────────────────────────────

export function isWaveComplete(state) { return state.status === 'wave_complete'; }
export function isPlayerExhausted(state) { return state.status === 'exhausted'; }
export function isFled(state) { return state.status === 'fled'; }
export function isOutOfTurns(state) { return state.status === 'out_of_turns'; }
export function isDead(state) { return state.status === 'dead'; }
export function isInProgress(state) { return state.status === 'in_progress'; }

// ─────────────────────────────────────────────────────────────
// Récompenses de vague (compat avec computeWaveRewards de l'ancien code)
// ─────────────────────────────────────────────────────────────

export function computeWaveRewards(state, profile, biomeKey, biomeRareKey, options = {}) {
  const mastery = getMasteryInfo(profile, biomeKey);
  const kills = state.killRewards || [];
  const killCount = kills.length;
  const goldStolen = state.goldStolenInWave || 0;

  if (killCount === 0) {
    return {
      gold: 0, goldGross: 0, goldStolen, masteryGain: 0,
      drops: [], label: "no_kill", killCount: 0,
    };
  }

  const goldRaw = kills.reduce((sum, k) => sum + k.gold, 0);
  const goldGross = Math.round(goldRaw * (1 + mastery.goldBonus));
  const gold = Math.max(0, goldGross - goldStolen);

  const drops = kills
    .filter(k => k.dropped)
    .map(k => ({ key: biomeRareKey, fromMonsterIdx: k.monsterIdx, position: k.position }));

  return {
    gold, goldGross, goldStolen,
    masteryGain: killCount,
    drops,
    label: state.status === 'wave_complete' ? 'success' : state.status,
    killCount,
  };
}

// ─────────────────────────────────────────────────────────────
// Compat avec ancien CombatScreen.jsx (deprecated)
// ─────────────────────────────────────────────────────────────

/** @deprecated */
export function getZoneDefense(profile, zone, shieldOnThisZone = false) {
  const eq = profile?.equipment || {};
  const armor = eq[`${zone}_def`];
  const shield = eq.shield;
  let def = armor ? getCombatItemValue(armor.grade ?? 0) : 0;
  if (shieldOnThisZone && shield) def += getCombatItemValue(shield.grade ?? 0);
  return def;
}

/** @deprecated */
export function getMonsterEffectiveGrade(monster) {
  return { grade: monster?.grade ?? 0, enraged: false };
}

/** @deprecated */
export function computeHit(monsterGrade, zoneDefense) {
  return zoneDefense >= 1 + monsterGrade ? 0 : 1;
}

// ─────────────────────────────────────────────────────────────
// Legacy exports (deprecated, gardés pour compat build)
// ─────────────────────────────────────────────────────────────

/** @deprecated Plus utilisé (combat 3-mobs supprimé). Stub vide pour compat. */
export function getAliveMonsters(state) {
  // Avant : retournait la liste des mobs vivants dans state.monsters.
  // Maintenant 1 seul mob : on retourne [state.mob] s'il est en vie.
  if (state?.mob && state.mob.hp > 0) return [{ ...state.mob, idx: 0 }];
  return [];
}

/** @deprecated Plus utilisé. */
export function generateMonsterIntents(monsters, seedStr) {
  return [];
}

/** @deprecated Plus utilisé (combat 3-mobs). */
export function resolveDefense(state, profile, action) {
  return state;
}

/** @deprecated Plus utilisé. */
export function applyCounters(state, profile, targetIndices, options = {}) {
  return state;
}

/** @deprecated Plus utilisé. */
export function advanceTurn(state) {
  return state;
}

/** Labels FR des zones (compat ancien code). */
export const ZONE_LABELS_FR = {
  head: 'Tête',
  torso: 'Torse',
  arms: 'Bras',
  legs: 'Jambes',
};

/** @deprecated Plus d'intents (combat tour-par-tour). */
export function describeIntent(monster, intent) {
  return { icon: '⚔️', label: 'Attaque', desc: 'Combat tour-par-tour' };
}

/** @deprecated Stub compat. */
export function describeWaveState(state) {
  if (!state) return '';
  if (state.status === 'wave_complete') return 'Vague terminée';
  if (state.status === 'fled') return 'Repli';
  if (state.status === 'out_of_turns') return 'Trop long !';
  if (state.status === 'dead') return '💀 Mort au combat';
  return `Tour ${state.round + 1}`;
}

/**
 * Retourne une description lisible d'un pattern monstre.
 * Patterns supportés (post-refonte mai 2026) :
 *   normal, weak, heavy, thief, drain, regen, revive
 * Patterns dépréciés (compat affichage Codex) :
 *   feint, blurry, elusive, healer (ne sont plus appliqués en combat)
 */
export function describePattern(pattern) {
  switch (pattern) {
    case "normal":  return { icon: "⚔️", label: "Standard", desc: "Aucun effet spécial" };
    case "weak":    return { icon: "🪶", label: "Frêle", desc: "Grade -1 (plus facile)" };
    case "heavy":   return { icon: "🪨", label: "Massif", desc: "Grade +1 (plus dur)" };
    case "thief":   return { icon: "💰", label: "Voleur", desc: "Vole 5 or s'il vous blesse" };
    case "drain":   return { icon: "🩸", label: "Vampirique", desc: "+1 PV à lui-même ET -1 PV bonus quand il vous touche" };
    case "regen":   return { icon: "🌿", label: "Régénération", desc: "20% chance de regagner 1 PV par tour" };
    case "revive":  return { icon: "💀", label: "Persistant", desc: "Revient à la moitié de ses PV une fois après mort" };
    // Patterns dépréciés (legacy, ne sont plus dans le jeu mais peuvent apparaître dans Codex)
    case "blurry":  return { icon: "👻", label: "Flou", desc: "(déprécié)" };
    case "elusive": return { icon: "💨", label: "Insaisissable", desc: "(déprécié)" };
    case "feint":   return { icon: "🌀", label: "Trompeur", desc: "(déprécié)" };
    case "healer":  return { icon: "✨", label: "Guérisseur", desc: "(déprécié)" };
    default: return null;
  }
}
