/**
 * Tests unitaires combatEngine.js
 *
 * Lancement : node combatEngine.test.js
 */

// Comme ESM avec import : on simule en CJS pour tests rapides
// (en prod, c'est importé via Vite)
const enginePath = './combatEngine.js';
let engine;

async function loadEngine() {
  engine = await import(enginePath);
}

let tests = 0;
let passed = 0;
const failures = [];

function assert(cond, msg) {
  tests++;
  if (cond) {
    passed++;
  } else {
    failures.push(msg);
    console.log('❌', msg);
  }
}

function assertEq(actual, expected, msg) {
  tests++;
  if (actual === expected) {
    passed++;
  } else {
    failures.push(`${msg} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
    console.log('❌', msg, '→ got', actual, 'expected', expected);
  }
}

// RNG seedé déterministe pour reproductibilité
function makeSeededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function rngAlways(value) {
  return () => value;
}

async function main() {
  await loadEngine();
  const {
    durabilityChance, clampDura, interpGradeByHp,
    pickRandomDefenseZones, applyRegenStart, resolveStrike,
    createCombatant, tickRoundEnd,
    COMBAT_ZONES, DURA_MAX, DAMAGE_PER_HIT, DESTAB_THRESHOLD,
  } = engine;

  console.log('\n=== combatEngine.test.js ===\n');

  // ─── HELPERS ────────────────────────────────────────────────────────────

  console.log('— helpers —');
  assertEq(durabilityChance(0), 0, 'dura=0 → chance 0');
  assertEq(durabilityChance(5), 0.5, 'dura=5 → chance 0.5');
  assertEq(durabilityChance(10), 1, 'dura=10 → chance 1');
  assertEq(durabilityChance(null), 0, 'dura=null → 0');
  assertEq(durabilityChance(-1), 0, 'dura négative → 0');

  assertEq(clampDura(15), 10, 'clamp 15 → 10');
  assertEq(clampDura(-2), 0, 'clamp -2 → 0');
  assertEq(clampDura(5), 5, 'clamp 5 → 5');
  assertEq(clampDura(2, 3), 3, 'clamp 2 floor=3 → 3');
  assertEq(clampDura(5, 3), 5, 'clamp 5 floor=3 → 5');

  // ─── INTERPOLATION GRADE ────────────────────────────────────────────────

  console.log('\n— interpGradeByHp —');
  assertEq(interpGradeByHp(80, 80, 5, 10), 5, 'hp full → gMin');
  assertEq(interpGradeByHp(1, 80, 5, 10), 10, 'hp=1 → gMax');
  assertEq(interpGradeByHp(40, 80, 5, 10), 8, 'hp=40/80 → 8');
  assertEq(interpGradeByHp(5, 10, 0, 0), 0, 'gMin==gMax=0');

  // ─── REGEN ──────────────────────────────────────────────────────────────

  console.log('\n— applyRegenStart —');

  const c1 = createCombatant({
    id: 'p1', hp: 10,
    weapon: { grade: 1, dura: 5, regenPct: 100 }, // 100% chance
    armor: { head: { grade: 1, dura: 5, regenPct: 0 } },
  });
  const evs = applyRegenStart(c1, rngAlways(0.5)); // 0.5 < 1 → trigger
  assertEq(c1.weapon.dura, 6, 'arme regen +1');
  assertEq(c1.armor.head.dura, 5, 'head pas de regen (regenPct=0)');
  assertEq(evs.length, 1, '1 event regen');

  const c2 = createCombatant({
    id: 'p2', hp: 10,
    weapon: { grade: 1, dura: 10, regenPct: 100 }, // déjà max
  });
  applyRegenStart(c2, rngAlways(0.5));
  assertEq(c2.weapon.dura, 10, 'arme déjà max, pas de regen');

  // ─── STRIKE : PARADE RÉUSSIE ────────────────────────────────────────────

  console.log('\n— resolveStrike : parade réussie —');

  const att = createCombatant({
    id: 'a', hp: 10, weapon: { grade: 1, dura: 5 }, armor: { head: { grade: 0, dura: 0 } },
  });
  const def = createCombatant({
    id: 'd', hp: 10, weapon: { grade: 1, dura: 10 }, // dura max → parade chance 100%
    armor: { head: { grade: 0, dura: 0 } },
  });
  let r = resolveStrike(att, def, { attZone: 'head', defParry: 'head' }, rngAlways(0));
  assert(r.parried, 'parade réussie');
  assertEq(r.dmg, 0, '0 dégât sur parade');
  assertEq(def.weapon.dura, 10, 'arme def reste à 10 (max) après parade réussie');
  // arme attacker pas touchée car phase 2 jamais atteinte
  assertEq(att.weapon.dura, 5, 'arme att intacte');

  // ─── STRIKE : PARADE RATÉE (pas de perte dura) ──────────────────────────

  console.log('\n— resolveStrike : parade ratée, pas de perte dura —');

  const att2 = createCombatant({
    id: 'a', hp: 10, weapon: { grade: 1, dura: 5 },
  });
  const def2 = createCombatant({
    id: 'd', hp: 10, weapon: { grade: 1, dura: 1 }, // dura 1 → chance 10%
    armor: { head: { grade: 0, dura: 0 } },
  });
  // RNG: 1er appel parade=0.99 (rate). 2e appel attaque=0 (touche).
  let seq = [0.99, 0, 0.99]; // parade rate, attaque touche, défense rate
  let i = 0;
  r = resolveStrike(att2, def2, { attZone: 'head', defParry: 'head' }, () => seq[i++]);
  assertEq(def2.weapon.dura, 1, 'arme def intacte après parade ratée');
  assertEq(att2.weapon.dura, 4, 'arme att -1 dura après attaque');

  // ─── STRIKE : ATTAQUE RATE ──────────────────────────────────────────────

  console.log('\n— resolveStrike : attaque ratée —');

  const att3 = createCombatant({ id: 'a', hp: 10, weapon: { grade: 1, dura: 1 } });
  const def3 = createCombatant({ id: 'd', hp: 10, armor: { head: { grade: 0, dura: 0 } } });
  r = resolveStrike(att3, def3, { attZone: 'head', defParry: 'torso' }, rngAlways(0.99));
  assert(r.missed, 'attaque ratée');
  assertEq(r.dmg, 0, '0 dégât');
  assertEq(att3.weapon.dura, 0, 'arme att -1 dura quand même');

  // ─── STRIKE : BLOCAGE PAR ARMURE ────────────────────────────────────────

  console.log('\n— resolveStrike : armure bloque (grade ≥) —');

  const att4 = createCombatant({ id: 'a', hp: 10, weapon: { grade: 1, dura: 10 } });
  const def4 = createCombatant({
    id: 'd', hp: 10,
    armor: { head: { grade: 2, dura: 10 } }, // armure G2 > arme G1 + dura max
  });
  // 1er appel attaque=0 (touche), 2e armure=0 (réussit)
  seq = [0, 0]; i = 0;
  r = resolveStrike(att4, def4, { attZone: 'head', defParry: 'torso' }, () => seq[i++]);
  assert(r.blocked, 'coup bloqué');
  assertEq(r.dmg, 0, '0 dégât');
  assertEq(def4.armor.head.dura, 9, 'armure -1 dura sur blocage');
  assertEq(def4.hp, 10, 'hp def intact');

  // ─── STRIKE : BOUCLIER BLOQUE (armure intacte) ──────────────────────────

  console.log('\n— resolveStrike : bouclier bloque, armure intacte —');

  const att5 = createCombatant({ id: 'a', hp: 10, weapon: { grade: 3, dura: 10 } });
  const def5 = createCombatant({
    id: 'd', hp: 10,
    shield: { grade: 3, dura: 10 },
    armor: { head: { grade: 1, dura: 10 } }, // armure G1 < arme G3, MAIS bouclier G3 renforce
  });
  // attaque=0 (touche), armure=0 (réussit), bouclier=0 (réussit) → G1+G3=4 vs G3 → block
  seq = [0, 0, 0]; i = 0;
  r = resolveStrike(att5, def5, { attZone: 'head', defParry: 'torso', defShield: 'head' }, () => seq[i++]);
  assert(r.blocked, 'bouclier bloque');
  assertEq(def5.armor.head.dura, 10, 'armure intacte (bouclier a pris)');
  assertEq(def5.shield.dura, 9, 'bouclier -1 dura');

  // ─── STRIKE : COUP PORTÉ (armure cède) ──────────────────────────────────

  console.log('\n— resolveStrike : armure cède, coup passe —');

  const att6 = createCombatant({ id: 'a', hp: 10, weapon: { grade: 5, dura: 10 } });
  const def6 = createCombatant({
    id: 'd', hp: 10,
    armor: { head: { grade: 1, dura: 10 } }, // armure G1 < arme G5
  });
  seq = [0, 0]; i = 0; // attaque touche, armure réussit son jet mais grade insuffisant
  r = resolveStrike(att6, def6, { attZone: 'head', defParry: 'torso' }, () => seq[i++]);
  assertEq(r.dmg, 1, '1 dégât appliqué');
  assertEq(def6.hp, 9, 'hp def 10→9');
  assertEq(def6.armor.head.dura, 9, 'armure -1 dura (a servi)');

  // ─── STRIKE : ARMURE RATE SON JET (pas d'usure, coup direct) ────────────

  console.log('\n— resolveStrike : armure rate, coup direct —');

  const att7 = createCombatant({ id: 'a', hp: 10, weapon: { grade: 1, dura: 10 } });
  const def7 = createCombatant({
    id: 'd', hp: 10,
    armor: { head: { grade: 5, dura: 1 } }, // dura 1 → chance 10%
  });
  seq = [0, 0.99]; i = 0; // attaque touche, armure rate
  r = resolveStrike(att7, def7, { attZone: 'head', defParry: 'torso' }, () => seq[i++]);
  assertEq(r.dmg, 1, '1 dégât');
  assertEq(def7.armor.head.dura, 1, 'armure intacte (n a pas servi)');

  // ─── STRIKE : DRAIN ─────────────────────────────────────────────────────

  console.log('\n— resolveStrike : drain de vie —');

  const att8 = createCombatant({
    id: 'a', hp: 5, hpMax: 10,
    weapon: { grade: 1, dura: 10, drain: 2 },
  });
  const def8 = createCombatant({ id: 'd', hp: 10, armor: { head: { grade: 0, dura: 0 } } });
  r = resolveStrike(att8, def8, { attZone: 'head', defParry: 'torso' }, rngAlways(0));
  assertEq(r.drained, 2, 'drain +2 HP');
  assertEq(att8.hp, 7, 'hp att 5→7');

  // ─── STRIKE : DESTABILISATION ───────────────────────────────────────────

  console.log('\n— resolveStrike : destab après N hits —');

  const att9 = createCombatant({ id: 'a', hp: 10, weapon: { grade: 1, dura: 10 } });
  const def9 = createCombatant({
    id: 'd', hp: 10,
    armor: { head: { grade: 0, dura: 0 } }, // dura 0 = pas de jet, coup direct
  });
  // 2 hits d'affilée = destab
  resolveStrike(att9, def9, { attZone: 'head', defParry: 'torso' }, rngAlways(0));
  r = resolveStrike(att9, def9, { attZone: 'head', defParry: 'torso' }, rngAlways(0));
  assert(r.destabilized, 'destab après 2 hits');
  assert(def9.destabRoundsLeft > 0, 'destabRoundsLeft > 0');

  // ─── WEAPONFLOOR (plancher dura arme boss) ──────────────────────────────

  console.log('\n— weaponFloor (boss) —');

  const boss = createCombatant({
    id: 'boss', hp: 80, hpMax: 80,
    weapon: { grade: 5, dura: 4 },
    weaponFloor: 3,
  });
  const player = createCombatant({ id: 'p', hp: 10, armor: { head: { grade: 0, dura: 0 } } });
  // Forcer plusieurs attaques boss → dura ne doit pas descendre sous 3
  for (let k = 0; k < 5; k++) {
    resolveStrike(boss, player, { attZone: 'head', defParry: 'torso' }, rngAlways(0));
  }
  assert(boss.weapon.dura >= 3, `weapon dura ${boss.weapon.dura} ≥ 3 (floor)`);

  // ─── tickRoundEnd ───────────────────────────────────────────────────────

  console.log('\n— tickRoundEnd —');

  const cTick = createCombatant({ id: 't', hp: 10 });
  cTick.destabRoundsLeft = 3;
  tickRoundEnd(cTick);
  assertEq(cTick.destabRoundsLeft, 2, 'destab décrémenté 3→2');
  tickRoundEnd(cTick); tickRoundEnd(cTick);
  assertEq(cTick.destabRoundsLeft, 0, 'destab à 0');
  tickRoundEnd(cTick);
  assertEq(cTick.destabRoundsLeft, 0, 'destab reste à 0 (pas négatif)');

  // ─── FINAL ─────────────────────────────────────────────────────────────

  console.log(`\n=== ${passed}/${tests} tests OK ===`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  -', f));
    process.exit(1);
  }
}

main().catch(e => {
  console.error('ERROR:', e);
  process.exit(1);
});
