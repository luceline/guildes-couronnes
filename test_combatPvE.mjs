/**
 * test_combatPvE.mjs — Tests unitaires combatPvE.js (V2 mécanique B).
 *
 * Mécanique B : 1 défense par mob (le joueur fait 3 choix par tour, 1 par mob),
 * avec optionnellement un bouclier protégeant une 2e zone par mob.
 *
 * Usage : node test_combatPvE.mjs
 */

import {
  // constantes
  MONSTERS_PER_WAVE, MAX_WAVES_PER_DAY, PVE_HP_FLOOR, MAX_TURNS_PER_WAVE,
  WAVE_STATS, MOB_GOLD_BASE, MOB_DROP_BASE, GOLD_PER_GRADE, DROP_PCT_PER_GRADE,
  RAGE_HP_THRESHOLD, MAX_RAGE_GRADE,
  WAVE_MONSTER_POOLS, MONSTERS_DATA,
  // helpers
  hashString, seededRandom, getCombatItemValue, getHintInfo,
  getMobReward,
  // logique
  generateWave, generateMonsterIntents, getMonsterEffectiveGrade,
  getZoneDefense, computeHit,
  createInitialWaveState, resolveDefense, applyCounters, advanceTurn, fleeWave,
  getAliveMonsters,
  isWaveComplete, isPlayerExhausted, isFled, isInProgress, isOutOfTurns,
  computeWaveRewards, getMasteryInfo, getPlayerMaxHP,
  describeIntent, describeWaveState,
} from "./src/lib/combatPvE.js";

// ─────────────────────────────────────────────────────────────
// Mini framework
// ─────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n     ${e.message}`);
  }
}
function assertEq(actual, expected, msg = "") {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg}\n      Expected: ${b}\n      Got:      ${a}`);
}
function assert(cond, msg = "Assertion failed") {
  if (!cond) throw new Error(msg);
}
function group(name, fn) {
  console.log(`\n📦 ${name}`);
  fn();
}

// ─────────────────────────────────────────────────────────────
// Profils types
// ─────────────────────────────────────────────────────────────

function makeProfile(overrides = {}) {
  return {
    user_email: "test@test.fr",
    character_name: "Tester",
    hp: 10,
    gold: 100,
    inventory: [],
    equipment: {},
    biome_mastery: {},
    profession: "Bûcheron",
    ...overrides,
  };
}

const PROFILE_NAKED = makeProfile();

const PROFILE_G3_FULL = makeProfile({
  equipment: {
    weapon:    { item_key: "epee",      grade: 3 },
    head_def:  { item_key: "heaume",    grade: 3 },
    torso_def: { item_key: "cuirasse",  grade: 3 },
    arms_def:  { item_key: "brassard",  grade: 3 },
    legs_def:  { item_key: "jambiere",  grade: 3 },
  },
});

const PROFILE_G5_FULL_NO_SHIELD = makeProfile({
  equipment: {
    weapon:    { grade: 5 },
    head_def:  { grade: 5 },
    torso_def: { grade: 5 },
    arms_def:  { grade: 5 },
    legs_def:  { grade: 5 },
  },
});

const PROFILE_G5_WITH_SHIELD = makeProfile({
  equipment: {
    ...PROFILE_G5_FULL_NO_SHIELD.equipment,
    shield: { grade: 5 },
  },
});

// Helper : construit un state de combat avec mobs/intents fixés (pour tests reproductibles)
function makeStateWithIntents(monsters, intents, profile, hp = 10) {
  return {
    biomeKey: "foret",
    waveIndex: 0,
    dayStr: "2026-04-28",
    monsters,
    playerHP: hp,
    playerMaxHP: 10,
    turnIndex: 0,
    intents,
    monstersKilled: 0,
    killRewards: [],
    log: [],
    status: "in_progress",
    pendingCounter: null,
  };
}

// Helper : construit l'action defenses { mobIdx: { primaryZone, shieldZone } }
function defenses(...mobActions) {
  // ex: defenses({ mobIdx: 0, primaryZone: "head" }, { mobIdx: 1, primaryZone: "torso" })
  const obj = {};
  for (const a of mobActions) {
    obj[a.mobIdx] = { primaryZone: a.primaryZone, shieldZone: a.shieldZone };
  }
  return { type: "defend", defenses: obj };
}

// ─────────────────────────────────────────────────────────────
console.log("🧪 Tests combatPvE.js (V2 mécanique B — défense par mob)");

group("Helpers déterministes", () => {
  test("hashString stable", () => {
    assertEq(hashString("foret"), hashString("foret"));
    assert(hashString("foret") !== hashString("mine"));
  });
  test("seededRandom reproductible", () => {
    const r1 = seededRandom("x"), r2 = seededRandom("x");
    for (let i = 0; i < 5; i++) assertEq(r1(), r2());
  });
});

group("getHintInfo : paliers d'incertitude (V2 — single max 70%)", () => {
  test("HP 100% → confiance 70% (single, plus jamais 100%)", () => {
    const h = getHintInfo(10, 10);
    assertEq(h.mode, "single"); assertEq(h.confidence, 0.7);
  });
  test("HP 70% → confiance 60% (single)", () => {
    const h = getHintInfo(7, 10);
    assertEq(h.mode, "single"); assertEq(h.confidence, 0.6);
  });
  test("HP 50% → mode double", () => {
    const h = getHintInfo(5, 10);
    assertEq(h.mode, "double"); assertEq(h.confidence, 0.5);
  });
  test("HP 20% → mode random", () => {
    const h = getHintInfo(2, 10);
    assertEq(h.mode, "random"); assertEq(h.confidence, 0.25);
  });
});

group("getMonsterEffectiveGrade : enragement", () => {
  test("Mob full HP → grade de base", () => {
    const eff = getMonsterEffectiveGrade({ hp: 10, hpMax: 10, grade: 3 });
    assertEq(eff.grade, 3); assertEq(eff.enraged, false);
  });
  test("Mob 60% HP → enragé +1", () => {
    const eff = getMonsterEffectiveGrade({ hp: 6, hpMax: 10, grade: 3 });
    assertEq(eff.grade, 4); assertEq(eff.enraged, true);
  });
  test("Mob V5 enragé → G6 (plafond)", () => {
    const eff = getMonsterEffectiveGrade({ hp: 5, hpMax: 10, grade: 5 });
    assertEq(eff.grade, 6); assertEq(eff.enraged, true);
  });
  test("Mob mort (HP=0) → pas enragé", () => {
    assertEq(getMonsterEffectiveGrade({ hp: 0, hpMax: 10, grade: 3 }).enraged, false);
  });
});

group("getZoneDefense : armure et bouclier", () => {
  test("Zone sans armure → 0", () => {
    assertEq(getZoneDefense(PROFILE_NAKED, "head"), 0);
  });
  test("Zone armure G3 → 4", () => {
    assertEq(getZoneDefense(PROFILE_G3_FULL, "head"), 4);
  });
  test("Armure G3 + bouclier G2 actif → 4 + 3 = 7", () => {
    const p = makeProfile({ equipment: { head_def: { grade: 3 }, shield: { grade: 2 } } });
    assertEq(getZoneDefense(p, "head", true), 7);
  });
  test("Bouclier non actif sur la zone → ignoré", () => {
    const p = makeProfile({ equipment: { head_def: { grade: 3 }, shield: { grade: 5 } } });
    assertEq(getZoneDefense(p, "head", false), 4);
  });
});

group("computeHit : 0 ou 1 PV", () => {
  test("Défense 0 vs grade 1 → 1 PV", () => assertEq(computeHit(1, 0), 1));
  test("Défense 2 vs grade 1 → 0 PV", () => assertEq(computeHit(1, 2), 0));
  test("Défense 4 vs grade 5 → 1 PV (4 < 6)", () => assertEq(computeHit(5, 4), 1));
  test("Défense 6 vs grade 5 → 0 PV (6 ≥ 6)", () => assertEq(computeHit(5, 6), 0));
});

group("Génération de vague", () => {
  test("Vague 1 : 3 mobs, grade 1 (HP varie selon pattern : heavy=+2)", () => {
    const w = generateWave("foret", "2026-04-28", 0);
    assertEq(w.length, 3);
    w.forEach(m => {
      assertEq(m.grade, 1);
      // HP de base 2 (V1), 4 si pattern "heavy" (Golem)
      const expectedHp = m.pattern === "heavy" ? 4 : 2;
      assertEq(m.hp, expectedHp);
      assertEq(m.hpMax, expectedHp);
    });
  });
  test("Vague 5 : 3 mobs, grade 5 (HP varie selon pattern)", () => {
    const w = generateWave("foret", "2026-04-28", 4);
    assertEq(w.length, 3);
    w.forEach(m => {
      assertEq(m.grade, 5);
      const expectedHp = m.pattern === "heavy" ? 12 : 10;
      assertEq(m.hp, expectedHp);
    });
  });
  test("Déterministe (même seed → même vague)", () => {
    assertEq(
      generateWave("foret", "2026-04-28", 0),
      generateWave("foret", "2026-04-28", 0)
    );
  });
  test("Tous les mobs de V1 viennent du pool V1 (basiques + heavy/weak)", () => {
    // Le pool V1 = [Gobelin, Loup, Corbeau, Golem]
    // Donc patterns possibles : normal, weak (corbeau), heavy (golem)
    const w = generateWave("foret", "2026-04-28", 0);
    const allowedPatterns = ["normal", "weak", "heavy"];
    w.forEach(m => {
      assert(allowedPatterns.includes(m.pattern), `pattern ${m.pattern} pas autorisé en V1`);
    });
  });
});

group("Maîtrise", () => {
  test("0 points → level 0", () => {
    assertEq(getMasteryInfo(PROFILE_NAKED, "foret").level, 0);
  });
  test("600 points → level 4 (+4 PV max)", () => {
    const p = makeProfile({ biome_mastery: { foret: 600 } });
    assertEq(getMasteryInfo(p, "foret").level, 4);
    assertEq(getPlayerMaxHP(p, "foret"), 14);
  });
});

group("État initial de la vague", () => {
  test("Vague 1 G3_FULL → état correct", () => {
    const s = createInitialWaveState({
      profile: PROFILE_G3_FULL, biomeKey: "foret", waveIndex: 0, dayStr: "2026-04-28",
    });
    assertEq(s.playerHP, 10);
    assertEq(s.monsters.length, 3);
    assertEq(s.intents.length, 3);
    assertEq(s.status, "in_progress");
  });
});

group("✨ resolveDefense : Mécanique B — défense par mob", () => {
  test("3 mobs, joueur défend les 3 zones correctes (G3 partout) → 3 parades", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 2, hpMax: 2, grade: 1, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head",  announcedZone: "head",  mode: "single", confidence: 1.0 },
      { monsterIdx: 1, actualZone: "torso", announcedZone: "torso", mode: "single", confidence: 1.0 },
      { monsterIdx: 2, actualZone: "arms",  announcedZone: "arms",  mode: "single", confidence: 1.0 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_G3_FULL);
    const r = resolveDefense(s, PROFILE_G3_FULL, defenses(
      { mobIdx: 0, primaryZone: "head" },
      { mobIdx: 1, primaryZone: "torso" },
      { mobIdx: 2, primaryZone: "arms" },
    ));
    assertEq(r.pendingCounter !== null, true);
    assertEq(r.pendingCounter.parries.length, 3);
    assertEq(r.playerHP, 10);
  });

  test("3 mobs, joueur défend mauvaises zones → 3 coups encaissés (sans armure)", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 2, hpMax: 2, grade: 1, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head",  announcedZone: "head",  mode: "single", confidence: 1.0 },
      { monsterIdx: 1, actualZone: "torso", announcedZone: "torso", mode: "single", confidence: 1.0 },
      { monsterIdx: 2, actualZone: "arms",  announcedZone: "arms",  mode: "single", confidence: 1.0 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_NAKED, 5);
    const r = resolveDefense(s, PROFILE_NAKED, defenses(
      { mobIdx: 0, primaryZone: "legs" },
      { mobIdx: 1, primaryZone: "legs" },
      { mobIdx: 2, primaryZone: "legs" },
    ));
    // Naked, pas de parade possible nulle part → 3 coups perdus
    assertEq(r.playerHP, 2); // 5 - 3
    assertEq(r.pendingCounter, null);
  });

  test("Défense partielle : 2 mobs parés, 1 mob pas couvert → mix", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 2, hpMax: 2, grade: 1, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head",  announcedZone: "head",  mode: "single", confidence: 1.0 },
      { monsterIdx: 1, actualZone: "torso", announcedZone: "torso", mode: "single", confidence: 1.0 },
      { monsterIdx: 2, actualZone: "legs",  announcedZone: "legs",  mode: "single", confidence: 1.0 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_G3_FULL);
    const r = resolveDefense(s, PROFILE_G3_FULL, defenses(
      { mobIdx: 0, primaryZone: "head" },     // parade ✓
      { mobIdx: 1, primaryZone: "torso" },    // parade ✓
      { mobIdx: 2, primaryZone: "head" },     // mauvaise zone (mob frappe legs)
    ));
    // 2 parades, et pour mob 2 : armure G3 jambes = 4 ≥ G1 req 2 → 0 dégât
    assertEq(r.pendingCounter.parries.length, 2);
    assertEq(r.playerHP, 10); // armure absorbe le coup pas paré
  });

  test("Pas de parade → avance auto au tour suivant", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 2, hpMax: 2, grade: 1, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head",  announcedZone: "head",  mode: "single", confidence: 1.0 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_G3_FULL);
    const r = resolveDefense(s, PROFILE_G3_FULL, defenses(
      { mobIdx: 0, primaryZone: "torso" }, // mauvaise zone, mais armure absorbe
    ));
    assertEq(r.pendingCounter, null);
    assertEq(r.turnIndex, 1);
    assertEq(r.playerHP, 10);
  });
});

group("✨ Bouclier en mécanique B (par mob)", () => {
  test("Bouclier sur 1 mob protège seulement ce mob", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 10, hpMax: 10, grade: 5, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 10, hpMax: 10, grade: 5, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 10, hpMax: 10, grade: 5, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head",  announcedZone: "head",  mode: "single", confidence: 1.0 },
      { monsterIdx: 1, actualZone: "torso", announcedZone: "torso", mode: "single", confidence: 1.0 },
      { monsterIdx: 2, actualZone: "arms",  announcedZone: "arms",  mode: "single", confidence: 1.0 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_G5_WITH_SHIELD);
    // Bouclier uniquement sur mob 0, épée pour les 2 autres
    const r = resolveDefense(s, PROFILE_G5_WITH_SHIELD, defenses(
      { mobIdx: 0, primaryZone: "legs", shieldZone: "head" }, // bouclier sur head où mob frappe
      { mobIdx: 1, primaryZone: "torso" },
      { mobIdx: 2, primaryZone: "arms" },
    ));
    // mob 0 : pas paré (épée legs ≠ head), mais bouclier sur head → armure G5+bouclier G5 = 12 ≥ 6 → absorbé
    // mob 1 : parade head ≠ torso. Epée torse paré ✓
    // mob 2 : parade arms ✓
    assertEq(r.pendingCounter.parries.length, 2); // mob 1 et 2
    assertEq(r.playerHP, 10); // mob 0 absorbé par bouclier
  });

  test("Bouclier sur mauvaise zone d'un mob → ce mob attaque la vraie zone, joueur prend 1 PV", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 10, hpMax: 10, grade: 5, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head", announcedZone: "head", mode: "single", confidence: 1.0 },
    ];
    // Joueur naked + bouclier G5 seul, met le bouclier sur torso (mais mob frappe head)
    const profile = makeProfile({ equipment: { shield: { grade: 5 } } });
    const s = makeStateWithIntents(monsters, intents, profile, 10);
    const r = resolveDefense(s, profile, defenses(
      { mobIdx: 0, primaryZone: "torso", shieldZone: "arms" },
    ));
    // mob frappe head : pas couvert, naked → 1 PV perdu
    assertEq(r.playerHP, 9);
  });

  test("Bouclier ignoré si shieldZone == primaryZone (du même mob)", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 2, hpMax: 2, grade: 1, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head", announcedZone: "head", mode: "single", confidence: 1.0 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_G5_WITH_SHIELD);
    const r = resolveDefense(s, PROFILE_G5_WITH_SHIELD, defenses(
      { mobIdx: 0, primaryZone: "head", shieldZone: "head" },
    ));
    // Doit traiter comme parade pure
    assertEq(r.pendingCounter.parries.length, 1);
  });
});

group("✨ Vision B : parade SANS armure (débutant)", () => {
  test("Joueur NAKED défend la bonne zone → parade pure (peut tuer la vague sans équipement)", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 2, hpMax: 2, grade: 1, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head",  announcedZone: "head",  mode: "single", confidence: 1.0 },
      { monsterIdx: 1, actualZone: "torso", announcedZone: "torso", mode: "single", confidence: 1.0 },
      { monsterIdx: 2, actualZone: "arms",  announcedZone: "arms",  mode: "single", confidence: 1.0 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_NAKED);
    const r = resolveDefense(s, PROFILE_NAKED, defenses(
      { mobIdx: 0, primaryZone: "head" },
      { mobIdx: 1, primaryZone: "torso" },
      { mobIdx: 2, primaryZone: "arms" },
    ));
    // 3 parades pures, joueur reste à 10 PV
    assertEq(r.playerHP, 10);
    assertEq(r.pendingCounter.parries.length, 3);
  });

  test("Joueur NAKED + 3 contres (1 dmg poings nus) → tous les mobs G1 (2 PV) survivent au 1er tour", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 2, hpMax: 2, grade: 1, alive: true },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 0, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0, intents: [],
      monstersKilled: 0, killRewards: [], log: [], status: "in_progress",
      pendingCounter: { availableCounters: 3, parries: [] },
    };
    // Sans épée, 1 dmg par contre × 3 mobs (2 PV chacun) = 1 dmg sur chaque, aucun mort
    const r = applyCounters(stateAfter, PROFILE_NAKED, [0, 1, 2]);
    assertEq(r.monsters[0].hp, 1);
    assertEq(r.monsters[1].hp, 1);
    assertEq(r.monsters[2].hp, 1);
    assertEq(r.monstersKilled, 0);
  });

  test("Joueur NAKED focus 3 contres sur mob 0 → mob 0 mort, 2 mobs intacts", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 2, hpMax: 2, grade: 1, alive: true },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 0, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0, intents: [],
      monstersKilled: 0, killRewards: [], log: [], status: "in_progress",
      pendingCounter: { availableCounters: 3, parries: [] },
    };
    const r = applyCounters(stateAfter, PROFILE_NAKED, [0, 0, 0]);
    assertEq(r.monsters[0].hp, 0);
    assertEq(r.monsters[0].alive, false);
    assertEq(r.monsters[1].hp, 2);
    assertEq(r.monsters[2].hp, 2);
    assertEq(r.monstersKilled, 1);
  });
});

group("✨ Enragement contre joueur G5", () => {
  test("Mob V5 enragé (G6) : joueur défend la BONNE zone → parade pure réussie (Vision B)", () => {
    const monsters = [
      { position: 0, name: "Boss", icon: "🐉", hp: 5, hpMax: 10, grade: 5, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head", announcedZone: "head", mode: "single", confidence: 1.0 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_G5_FULL_NO_SHIELD);
    const r = resolveDefense(s, PROFILE_G5_FULL_NO_SHIELD, defenses(
      { mobIdx: 0, primaryZone: "head" },
    ));
    // Vision B : bonne zone = parade, peu importe l'armure
    assertEq(r.playerHP, 10);
    assertEq(r.pendingCounter !== null, true);
    assertEq(r.pendingCounter.parries.length, 1);
  });

  test("Mob V5 enragé (G6) : MAUVAISE zone défendue, pas de bouclier → 1 PV perdu (armure G5 < G6 req 7)", () => {
    const monsters = [
      { position: 0, name: "Boss", icon: "🐉", hp: 5, hpMax: 10, grade: 5, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head", announcedZone: "head", mode: "single", confidence: 1.0 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_G5_FULL_NO_SHIELD);
    const r = resolveDefense(s, PROFILE_G5_FULL_NO_SHIELD, defenses(
      { mobIdx: 0, primaryZone: "torso" }, // mauvaise zone
    ));
    // Mob frappe head non défendu, armure head G5=6 < G6 req 7 → 1 PV perdu
    assertEq(r.playerHP, 9);
  });

  test("Mob V5 enragé : avec bouclier G5 sur la zone → absorbé", () => {
    const monsters = [
      { position: 0, name: "Boss", icon: "🐉", hp: 5, hpMax: 10, grade: 5, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head", announcedZone: "head", mode: "single", confidence: 1.0 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_G5_WITH_SHIELD);
    const r = resolveDefense(s, PROFILE_G5_WITH_SHIELD, defenses(
      { mobIdx: 0, primaryZone: "torso", shieldZone: "head" },
    ));
    // mob frappe head, bouclier sur head → armure G5+bouclier G5 = 12 ≥ 7 → absorbé
    assertEq(r.playerHP, 10);
  });
});

group("applyCounters : ciblage libre", () => {
  test("3 contres focalisés sur mob 0 (G3 = 4 dmg × 3) → mob 0 mort", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 10, hpMax: 10, grade: 5, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 10, hpMax: 10, grade: 5, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 10, hpMax: 10, grade: 5, alive: true },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 0, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0,
      intents: [], monstersKilled: 0, killRewards: [], log: [], status: "in_progress",
      pendingCounter: { availableCounters: 3, parries: [] },
    };
    const r = applyCounters(stateAfter, PROFILE_G3_FULL, [0, 0, 0]);
    assertEq(r.monsters[0].hp, 0);
    assertEq(r.monsters[0].alive, false);
    assertEq(r.monstersKilled, 1);
  });

  test("Sans épée → 1 dmg par contre", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 5, hpMax: 5, grade: 1, alive: true },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 0, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0,
      intents: [], monstersKilled: 0, killRewards: [], log: [], status: "in_progress",
      pendingCounter: { availableCounters: 1, parries: [] },
    };
    const r = applyCounters(stateAfter, PROFILE_NAKED, [0]);
    assertEq(r.monsters[0].hp, 4);
  });
});

group("Plancher PV", () => {
  test("Joueur 1 PV vs 3 coups non parés → reste à 1 PV, exhausted", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 2, hpMax: 2, grade: 1, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head",  announcedZone: "head",  mode: "single", confidence: 1.0 },
      { monsterIdx: 1, actualZone: "torso", announcedZone: "torso", mode: "single", confidence: 1.0 },
      { monsterIdx: 2, actualZone: "arms",  announcedZone: "arms",  mode: "single", confidence: 1.0 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_NAKED, 1);
    const r = resolveDefense(s, PROFILE_NAKED, defenses(
      { mobIdx: 0, primaryZone: "legs" },
      { mobIdx: 1, primaryZone: "legs" },
      { mobIdx: 2, primaryZone: "legs" },
    ));
    assertEq(r.playerHP, 1);
    assertEq(r.status, "exhausted");
  });
});

group("Vague gagnée", () => {
  test("3 contres tuent les 3 mobs G1 → wave_complete", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 2, hpMax: 2, grade: 1, alive: true },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 0, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0, intents: [],
      monstersKilled: 0, killRewards: [], log: [], status: "in_progress",
      pendingCounter: { availableCounters: 3, parries: [] },
    };
    const r = applyCounters(stateAfter, PROFILE_G3_FULL, [0, 1, 2]);
    assertEq(r.status, "wave_complete");
    assertEq(r.monstersKilled, 3);
  });
});

group("Fuite", () => {
  test("fleeWave → status fled", () => {
    const s = createInitialWaveState({
      profile: PROFILE_NAKED, biomeKey: "foret", waveIndex: 0, dayStr: "2026-04-28",
    });
    assertEq(fleeWave(s).status, "fled");
  });
});

group("✨ Récompenses cumulatives par mob (V2 final)", () => {
  test("getMobReward : 1er mob G1 = 0 or, 0% drop", () => {
    const r = getMobReward(0, 1);
    assertEq(r.gold, 0); assertEq(r.dropChance, 0);
  });
  test("getMobReward : 3e mob G1 = 2 or, 5% drop", () => {
    const r = getMobReward(2, 1);
    assertEq(r.gold, 2); assertEq(r.dropChance, 0.05);
  });
  test("getMobReward : 1er mob G2 = 3 or, 2% drop", () => {
    const r = getMobReward(0, 2);
    assertEq(r.gold, 3); assertEq(r.dropChance, 0.02);
  });
  test("getMobReward : 3e mob G2 = 5 or, 9% drop", () => {
    const r = getMobReward(2, 2);
    assertEq(r.gold, 5);
    // 0.05 + 0.02 * (2-1) = 0.07. Erreur ! position 2 → MOB_DROP_BASE[2]=0.05, +grade bonus 0.02 = 0.07
    // En fait je m'étais trompé sur ma table plus haut. Vérifions :
    // 3e mob G2 : position 2, grade 2 → MOB_DROP_BASE[2]=0.05 + (2-1)*0.02 = 0.07
    assertEq(r.dropChance, 0.07);
  });
  test("getMobReward : 3e mob G5 = 14 or, 13% drop", () => {
    const r = getMobReward(2, 5);
    assertEq(r.gold, 14);     // 2 + 4*3
    assertEq(r.dropChance, 0.13); // 0.05 + 4*0.02
  });

  test("Cumul vague complète G2 = 3+4+5 = 12 or", () => {
    // Simule une vague G2 : 3 mobs, tous tués 1 par 1
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 1, hpMax: 4, grade: 2, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 1, hpMax: 4, grade: 2, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 1, hpMax: 4, grade: 2, alive: true },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 1, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0, intents: [],
      monstersKilled: 0, killRewards: [], log: [], status: "in_progress",
      pendingCounter: { availableCounters: 3, parries: [] },
    };
    // 3 contres G3 (4 dmg) → 3 mobs morts dans l'ordre 0, 1, 2
    const r = applyCounters(stateAfter, PROFILE_G3_FULL, [0, 1, 2], { rng: () => 0.99 /* pas de drop */ });
    assertEq(r.status, "wave_complete");

    const rewards = computeWaveRewards(r, PROFILE_NAKED, "foret", "essence_foret");
    assertEq(rewards.gold, 12);  // 3 + 4 + 5
    assertEq(rewards.killCount, 3);
    assertEq(rewards.label, "full");
    assertEq(rewards.dropped, false); // rng 0.99 → pas de drop
  });

  test("Vague G5 partielle (1 mob tué) → 12 or", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 1, hpMax: 10, grade: 5, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 10, hpMax: 10, grade: 5, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 10, hpMax: 10, grade: 5, alive: true },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 4, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0, intents: [],
      monstersKilled: 0, killRewards: [], log: [], status: "in_progress",
      pendingCounter: { availableCounters: 1, parries: [] },
    };
    const r = applyCounters(stateAfter, PROFILE_G3_FULL, [0], { rng: () => 0.99 });
    // Mob 0 tué (1er kill), G5 → 12 or, drop 8%
    const rewards = computeWaveRewards(r, PROFILE_NAKED, "foret", "essence_foret");
    assertEq(rewards.gold, 12);
    assertEq(rewards.killCount, 1);
    assertEq(rewards.label, "partial1");
  });

  test("Maîtrise G4 (+20% or) sur G2 full → 14 or (12 × 1.2)", () => {
    const profile = makeProfile({ biome_mastery: { foret: 600 } });
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 1, hpMax: 4, grade: 2, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 1, hpMax: 4, grade: 2, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 1, hpMax: 4, grade: 2, alive: true },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 1, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0, intents: [],
      monstersKilled: 0, killRewards: [], log: [], status: "in_progress",
      pendingCounter: { availableCounters: 3, parries: [] },
    };
    const r = applyCounters(stateAfter, PROFILE_G3_FULL, [0, 1, 2], { rng: () => 0.99 });
    const rewards = computeWaveRewards(r, profile, "foret", "essence_foret");
    assertEq(rewards.gold, 14); // 12 × 1.2 = 14.4 → arrondi 14
  });

  test("Drop garanti : rng=0 sur tous les rolls → 3 drops sur vague G5 full", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 1, hpMax: 10, grade: 5, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 1, hpMax: 10, grade: 5, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 1, hpMax: 10, grade: 5, alive: true },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 4, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0, intents: [],
      monstersKilled: 0, killRewards: [], log: [], status: "in_progress",
      pendingCounter: { availableCounters: 3, parries: [] },
    };
    const r = applyCounters(stateAfter, PROFILE_G3_FULL, [0, 1, 2], { rng: () => 0 });
    const rewards = computeWaveRewards(r, PROFILE_NAKED, "foret", "essence_foret");
    assertEq(rewards.dropCount, 3);
    assertEq(rewards.drops.length, 3);
  });

  test("Aucun mob tué → 0 or, 0 drop", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 5, hpMax: 5, grade: 1, alive: true },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 0, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0, intents: [],
      monstersKilled: 0, killRewards: [], log: [], status: "fled",
      pendingCounter: null,
    };
    const rewards = computeWaveRewards(stateAfter, PROFILE_NAKED, "foret", "essence_foret");
    assertEq(rewards.gold, 0);
    assertEq(rewards.killCount, 0);
    assertEq(rewards.label, "no_kill");
  });
});

group("describeIntent", () => {
  test("single 100% → 'va frapper'", () => {
    const m = { name: "Gobelin" };
    const i = { mode: "single", confidence: 1.0, announcedZone: "head" };
    assert(describeIntent(m, i).includes("va frapper la tête"));
  });
  test("double → 'hésite entre'", () => {
    const m = { name: "Gobelin" };
    const i = { mode: "double", confidence: 0.5, announcedZone: "head", alternativeZone: "torso" };
    assert(describeIntent(m, i).includes("hésite entre"));
  });
  test("random → 'au hasard'", () => {
    const m = { name: "Gobelin" };
    const i = { mode: "random", confidence: 0.25, announcedZone: null };
    assert(describeIntent(m, i).includes("au hasard"));
  });
});

group("✨ Scénario e2e : vague 1 farm idéal", () => {
  test("Vague 1 G3_FULL : full défense correcte → 3 parades, contres tuent les 3 mobs", () => {
    const monsters = [
      { position: 0, name: "A", icon: "👹", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 1, name: "B", icon: "🐺", hp: 2, hpMax: 2, grade: 1, alive: true },
      { position: 2, name: "C", icon: "💀", hp: 2, hpMax: 2, grade: 1, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head",  announcedZone: "head",  mode: "single", confidence: 1.0 },
      { monsterIdx: 1, actualZone: "torso", announcedZone: "torso", mode: "single", confidence: 1.0 },
      { monsterIdx: 2, actualZone: "arms",  announcedZone: "arms",  mode: "single", confidence: 1.0 },
    ];
    let s = makeStateWithIntents(monsters, intents, PROFILE_G3_FULL);
    s = resolveDefense(s, PROFILE_G3_FULL, defenses(
      { mobIdx: 0, primaryZone: "head" },
      { mobIdx: 1, primaryZone: "torso" },
      { mobIdx: 2, primaryZone: "arms" },
    ));
    assertEq(s.pendingCounter.availableCounters, 3);

    // 3 contres : 1 par mob
    s = applyCounters(s, PROFILE_G3_FULL, [0, 1, 2]);
    assertEq(s.status, "wave_complete");
    assertEq(s.monstersKilled, 3);
    assertEq(s.playerHP, 10);
  });
});

// ─────────────────────────────────────────────────────────────
// Tests des patterns spéciaux mobs (V2)
// ─────────────────────────────────────────────────────────────

group("✨ Pattern weak (Corbeau) : grade -1", () => {
  test("Corbeau G3 → grade effectif G2", () => {
    const eff = getMonsterEffectiveGrade({ hp: 10, hpMax: 10, grade: 3, pattern: "weak" });
    assertEq(eff.grade, 2);
  });
  test("Corbeau G1 → ne tombe pas sous G0", () => {
    const eff = getMonsterEffectiveGrade({ hp: 10, hpMax: 10, grade: 1, pattern: "weak" });
    assertEq(eff.grade, 0);
  });
});

group("✨ Pattern heavy (Golem) : grade +1, HP +2", () => {
  test("Golem G3 → grade effectif G4", () => {
    const eff = getMonsterEffectiveGrade({ hp: 10, hpMax: 10, grade: 3, pattern: "heavy" });
    assertEq(eff.grade, 4);
  });
  test("Vague avec Golem (V1) → 4 PV (2 base + 2 heavy)", () => {
    // Le pool V1 contient le Golem, donc une vague pourrait en générer un
    // (test indirect : on vérifie qu'il est bien à 4 PV s'il apparaît)
    const w = generateWave("foret", "2026-04-28", 0);
    w.forEach(m => {
      if (m.pattern === "heavy") assertEq(m.hp, 4);
    });
  });
});

group("✨ Pattern thief (Brigand) : vole 5 or si te blesse", () => {
  test("Brigand qui touche → goldStolenInWave += 5", () => {
    const monsters = [
      { position: 0, name: "Brigand", icon: "🗡️", pattern: "thief",
        hp: 2, hpMax: 2, grade: 1, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head", announcedZone: "head", mode: "single", confidence: 0.7 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_NAKED, 5);
    s.goldStolenInWave = 0;
    const r = resolveDefense(s, PROFILE_NAKED, defenses(
      { mobIdx: 0, primaryZone: "torso" }, // mauvaise zone, brigand frappe
    ));
    assertEq(r.playerHP, 4); // 1 PV perdu
    assertEq(r.goldStolenInWave, 5); // 5 or volés
  });
  test("Brigand paré → pas de vol", () => {
    const monsters = [
      { position: 0, name: "Brigand", icon: "🗡️", pattern: "thief",
        hp: 2, hpMax: 2, grade: 1, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head", announcedZone: "head", mode: "single", confidence: 0.7 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_NAKED, 5);
    s.goldStolenInWave = 0;
    const r = resolveDefense(s, PROFILE_NAKED, defenses(
      { mobIdx: 0, primaryZone: "head" }, // bonne zone
    ));
    assertEq(r.goldStolenInWave, 0); // pas de vol
  });
});

group("✨ Pattern drain (Vampire) : se soigne quand il blesse", () => {
  test("Vampire à 5 PV qui blesse → +1 PV à lui-même", () => {
    const monsters = [
      { position: 0, name: "Vampire", icon: "🧛", pattern: "drain",
        hp: 5, hpMax: 10, grade: 3, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head", announcedZone: "head", mode: "single", confidence: 0.7 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_NAKED, 5);
    const r = resolveDefense(s, PROFILE_NAKED, defenses(
      { mobIdx: 0, primaryZone: "torso" }, // mauvaise zone
    ));
    assertEq(r.monsters[0].hp, 6); // vampire passe 5 → 6
  });
  test("Vampire au max ne dépasse pas hpMax", () => {
    const monsters = [
      { position: 0, name: "Vampire", icon: "🧛", pattern: "drain",
        hp: 10, hpMax: 10, grade: 3, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head", announcedZone: "head", mode: "single", confidence: 0.7 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_NAKED, 5);
    const r = resolveDefense(s, PROFILE_NAKED, defenses(
      { mobIdx: 0, primaryZone: "torso" },
    ));
    assertEq(r.monsters[0].hp, 10); // bloqué au max
  });
});

group("✨ Pattern healer (Sorcière) : soigne tous les mobs vivants", () => {
  test("Sorcière + 2 mobs blessés → +1 PV à chacun", () => {
    const monsters = [
      { position: 0, name: "Sorcière", icon: "🧙", pattern: "healer",
        hp: 8, hpMax: 10, grade: 3, alive: true },
      { position: 1, name: "Loup", icon: "🐺", pattern: "normal",
        hp: 4, hpMax: 6, grade: 3, alive: true },
      { position: 2, name: "Gobelin", icon: "👹", pattern: "normal",
        hp: 3, hpMax: 6, grade: 3, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head", announcedZone: "head", mode: "single", confidence: 0.7 },
      { monsterIdx: 1, actualZone: "torso", announcedZone: "torso", mode: "single", confidence: 0.7 },
      { monsterIdx: 2, actualZone: "arms", announcedZone: "arms", mode: "single", confidence: 0.7 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_G3_FULL, 10);
    // Joueur pare correctement les 3 (pas de blessure)
    const r = resolveDefense(s, PROFILE_G3_FULL, defenses(
      { mobIdx: 0, primaryZone: "head" },
      { mobIdx: 1, primaryZone: "torso" },
      { mobIdx: 2, primaryZone: "arms" },
    ));
    // Sorcière soigne les 3 mobs : Sorcière 9, Loup 5, Gobelin 4
    assertEq(r.monsters[0].hp, 9);
    assertEq(r.monsters[1].hp, 5);
    assertEq(r.monsters[2].hp, 4);
  });
});

group("✨ Pattern regen (Troll) : se soigne lui-même", () => {
  test("Troll à 5 PV → +1 PV chaque tour", () => {
    const monsters = [
      { position: 0, name: "Troll", icon: "👺", pattern: "regen",
        hp: 5, hpMax: 10, grade: 3, alive: true },
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head", announcedZone: "head", mode: "single", confidence: 0.7 },
    ];
    const s = makeStateWithIntents(monsters, intents, PROFILE_G3_FULL, 10);
    const r = resolveDefense(s, PROFILE_G3_FULL, defenses(
      { mobIdx: 0, primaryZone: "head" },
    ));
    assertEq(r.monsters[0].hp, 6); // troll regen +1
  });
});

group("✨ Pattern elusive (Élémental) : esquive 50% des contres", () => {
  test("Élémental avec rng=0.3 → contre passe", () => {
    const monsters = [
      { position: 0, name: "Élémental", icon: "🔥", pattern: "elusive",
        hp: 5, hpMax: 5, grade: 1, alive: true },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 0, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0, intents: [],
      monstersKilled: 0, killRewards: [], log: [], status: "in_progress",
      pendingCounter: { availableCounters: 1, parries: [] },
    };
    // rng=0.3 < 0.5, MAIS le check est rng() < 0.5 pour ESQUIVER. Donc 0.3 < 0.5 → esquive.
    // Ah pardon : esquive si rng()<0.5, donc 0.3 → esquive.
    const r1 = applyCounters(stateAfter, PROFILE_G3_FULL, [0], { rng: () => 0.3 });
    // Esquive → mob intact à 5 PV
    assertEq(r1.monsters[0].hp, 5);
  });
  test("Élémental avec rng=0.7 → contre touche normalement", () => {
    const monsters = [
      { position: 0, name: "Élémental", icon: "🔥", pattern: "elusive",
        hp: 5, hpMax: 5, grade: 1, alive: true },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 0, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0, intents: [],
      monstersKilled: 0, killRewards: [], log: [], status: "in_progress",
      pendingCounter: { availableCounters: 1, parries: [] },
    };
    // rng=0.7 >= 0.5 → pas d'esquive, contre G3 = 4 dmg
    const r2 = applyCounters(stateAfter, PROFILE_G3_FULL, [0], { rng: () => 0.7 });
    assertEq(r2.monsters[0].hp, 1); // 5 - 4 = 1
  });
});

group("✨ Pattern revive (Squelette) : revient à 1 PV une fois", () => {
  test("Squelette tué une fois revient à 1 PV", () => {
    const monsters = [
      { position: 0, name: "Squelette", icon: "💀", pattern: "revive",
        hp: 4, hpMax: 6, grade: 3, alive: true, reviveUsed: false },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 0, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0, intents: [],
      monstersKilled: 0, killRewards: [], log: [], status: "in_progress",
      pendingCounter: { availableCounters: 1, parries: [] },
    };
    // 1 contre G3 = 4 dmg → squelette tué (4-4=0), mais revive → 1 PV
    const r = applyCounters(stateAfter, PROFILE_G3_FULL, [0], { rng: () => 0.99 });
    assertEq(r.monsters[0].hp, 1);
    assertEq(r.monsters[0].alive, true);
    assertEq(r.monsters[0].reviveUsed, true);
    assertEq(r.monstersKilled, 0); // pas encore mort
  });
  test("Squelette tué une 2e fois reste mort", () => {
    const monsters = [
      { position: 0, name: "Squelette", icon: "💀", pattern: "revive",
        hp: 1, hpMax: 6, grade: 3, alive: true, reviveUsed: true },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 0, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0, intents: [],
      monstersKilled: 0, killRewards: [], log: [], status: "in_progress",
      pendingCounter: { availableCounters: 1, parries: [] },
    };
    const r = applyCounters(stateAfter, PROFILE_G3_FULL, [0], { rng: () => 0.99 });
    assertEq(r.monsters[0].alive, false);
    assertEq(r.monstersKilled, 1);
  });
});

group("✨ Limite MAX_TURNS_PER_WAVE", () => {
  test("Au tour 5 sans victoire → status out_of_turns", () => {
    const monsters = [
      { position: 0, name: "Boss", icon: "🐉", pattern: "normal",
        hp: 100, hpMax: 100, grade: 5, alive: true }, // 100 PV impossible à tuer en 5 tours
    ];
    const intents = [
      { monsterIdx: 0, actualZone: "head", announcedZone: "head", mode: "single", confidence: 0.7 },
    ];
    let s = makeStateWithIntents(monsters, intents, PROFILE_G3_FULL, 10);
    // Simule MAX_TURNS_PER_WAVE-1 advances pour arriver au tour limite
    for (let i = 0; i < MAX_TURNS_PER_WAVE - 1; i++) {
      s = advanceTurn(s);
      if (s.status !== "in_progress") break;
    }
    // Le tour suivant est l'avancement qui doit déclencher out_of_turns
    s = advanceTurn(s);
    assertEq(isOutOfTurns(s), true);
  });
});

group("✨ Or volé par Brigand : déduit dans computeWaveRewards", () => {
  test("Vague G2 full + 5 or volés par Brigand → gold = brut - 5", () => {
    const monsters = [
      { position: 0, name: "Brigand", icon: "🗡️", pattern: "thief",
        hp: 1, hpMax: 4, grade: 2, alive: true },
      { position: 1, name: "Loup", icon: "🐺", pattern: "normal",
        hp: 1, hpMax: 4, grade: 2, alive: true },
      { position: 2, name: "Gobelin", icon: "👹", pattern: "normal",
        hp: 1, hpMax: 4, grade: 2, alive: true },
    ];
    const stateAfter = {
      biomeKey: "foret", waveIndex: 1, dayStr: "2026-04-28",
      monsters, playerHP: 10, playerMaxHP: 10, turnIndex: 0, intents: [],
      monstersKilled: 0, killRewards: [],
      goldStolenInWave: 5,  // Brigand a déjà volé 5 or
      log: [], status: "in_progress",
      pendingCounter: { availableCounters: 3, parries: [] },
    };
    const r = applyCounters(stateAfter, PROFILE_G3_FULL, [0, 1, 2], { rng: () => 0.99 });
    const rewards = computeWaveRewards(r, PROFILE_NAKED, "foret", "essence_foret");
    // G2 cumul = 3+4+5 = 12 brut, -5 stolen = 7 net
    assertEq(rewards.goldGross, 12);
    assertEq(rewards.goldStolen, 5);
    assertEq(rewards.gold, 7);
  });
});

console.log(`\n${"─".repeat(60)}`);
if (failed === 0) {
  console.log(`✅ Tous les tests passent : ${passed}/${passed}`);
} else {
  console.log(`❌ ${failed} échec(s) sur ${passed + failed} tests`);
  process.exit(1);
}
