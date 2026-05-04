/**
 * src/lib/combatPvE.js : Logique pure du combat de biome tactique (V2 design, mécanique B).
 *
 * Mécanique parade-only :
 *   - 3 mobs simultanés par vague
 *   - Le joueur ne tape jamais directement, il PARE
 *   - Le joueur fait UN choix de défense PAR mob (mécanique B)
 *   - Une parade = bonne zone devinée → 0 dégât + contre-attaque (peu importe l'armure)
 *   - L'armure ne sert que sur les zones NON défendues (absorbe si grade armure ≥ grade mob)
 *   - Avec un bouclier équipé, le joueur peut désigner une 2e zone par mob
 *     → si le mob frappe cette 2e zone : armure + bouclier (pas de contre, juste absorption)
 *   - Confiance d'indice variable selon % HP du mob
 *   - Enragement : grade +1 si mob ≤ 60% PV (plafond G6)
 *   - Plancher 1 PV joueur (jamais de mort PvE)
 *
 * Conventions :
 *   - "state" = objet immuable représentant l'état d'une vague en cours
 *   - Les fonctions qui modifient l'état renvoient un NOUVEAU state
 *
 * NOTE : module AUTO-SUFFISANT (pas d'import gameData) pour testabilité Node.
 */

// ─────────────────────────────────────────────────────────────
// Constantes dupliquées de gameData.js (sync requis si modifié)
// ─────────────────────────────────────────────────────────────

export const COMBAT_ZONES = ["head", "torso", "arms", "legs"];
export const COMBAT_MAX_HP = 10;

/** Effet d'un item équipé : grade 0 → +1, grade 5 → +6 (1 + grade). */
export function getCombatItemValue(grade) {
  return 1 + (grade ?? 0);
}

// ─────────────────────────────────────────────────────────────
// Constantes de combat
// ─────────────────────────────────────────────────────────────

export const MONSTERS_PER_WAVE = 3;
export const MAX_WAVES_PER_DAY = 5;
export const PVE_HP_FLOOR = 1;
/** Limite de tours par vague (au-delà, le joueur est forcé de fuir avec ce qu'il a tué). */
export const MAX_TURNS_PER_WAVE = 5;

export const WAVE_START_HUNGER_COST = 1;
export const WAVE_START_ENERGY_COST = 1;
export const POTION_HEAL_HP = 5;

/** Grade max d'un item (G5). */
export const MAX_ITEM_GRADE = 5;
/** Grade max d'un mob enragé (G6 = au-delà de tout équipement). */
export const MAX_RAGE_GRADE = 6;

/** Seuil d'enragement : si mob.hp / mob.hpMax ≤ 0.60, grade +1. */
export const RAGE_HP_THRESHOLD = 0.60;

/**
 * Stats par vague (1-indexé : WAVE_STATS[0] = vague 1).
 * Vague N → 2N PV par mob, grade N (V5 = 10 PV, G5).
 */
export const WAVE_STATS = [
  { wave: 1, hp: 2,  grade: 1 },
  { wave: 2, hp: 4,  grade: 2 },
  { wave: 3, hp: 6,  grade: 3 },
  { wave: 4, hp: 8,  grade: 4 },
  { wave: 5, hp: 10, grade: 5 },
];

/**
 * Monstres + leur pattern spécial. Le pattern est un identifiant qui détermine
 * le comportement spécial du mob en plus de l'attaque normale.
 *
 * Patterns :
 *   - "normal"   : attaque standard, rien de plus
 *   - "weak"     : grade effectif -1 (corbeau, faible)
 *   - "blurry"   : son intent est toujours en mode "double" (jamais 100% sûr)
 *   - "thief"    : si le mob blesse le joueur, vole 5 or en plus
 *   - "elusive"  : 50% de chance d'ignorer la contre-attaque (esquive)
 *   - "drain"    : si le mob blesse le joueur, le mob soigne +1 PV à lui-même
 *   - "feint"    : 50% de chance que sa zone réelle ≠ zone annoncée (feinte)
 *   - "revive"   : à sa mort, revient à 1 PV une seule fois dans le combat
 *   - "heavy"    : grade effectif +1, mais HP +2 (plus dur, plus tanky)
 *   - "healer"   : à chaque tour, soigne +1 PV à TOUS les mobs vivants (et frappe normalement)
 *   - "regen"    : à chaque tour, +1 PV à lui-même (max HP)
 */
export const MONSTERS_DATA = [
  { name: "Gobelin",       icon: "👹", pattern: "normal" },
  { name: "Loup",          icon: "🐺", pattern: "normal" },
  { name: "Corbeau",       icon: "🐦", pattern: "weak" },
  { name: "Ombre",         icon: "👻", pattern: "blurry" },
  { name: "Brigand",       icon: "🗡️", pattern: "thief" },
  { name: "Élémental",     icon: "🔥", pattern: "elusive" },
  { name: "Vampire",       icon: "🧛", pattern: "drain" },
  { name: "Dragon mineur", icon: "🐉", pattern: "feint" },
  { name: "Squelette",     icon: "💀", pattern: "revive" },
  { name: "Golem",         icon: "🗿", pattern: "heavy" },
  { name: "Sorcière",      icon: "🧙", pattern: "healer" },
  { name: "Troll",         icon: "👺", pattern: "regen" },
];

/**
 * Pool de monstres autorisés par vague (difficulté progressive).
 * V1-V2 = patterns simples / faibles. V4-V5 = patterns complexes / dangereux.
 *
 * Chaque entrée est un index dans MONSTERS_DATA. La génération de vague
 * tire 3 mobs distincts dans le pool de la vague.
 */
export const WAVE_MONSTER_POOLS = [
  // V1 (index 0) : 4 mobs basiques + faible
  [0, 1, 2, 9],            // Gobelin, Loup, Corbeau, Golem (heavy mais lent à V1)
  // V2 (index 1) : ajout du voleur et indice flou
  [0, 1, 2, 4, 9, 11],     // + Brigand (thief), + Troll (regen léger)
  // V3 (index 2) : ajout des patterns moyens
  [0, 1, 3, 4, 5, 8, 11],  // Ombre (blurry), Élémental (elusive), Squelette (revive)
  // V4 (index 3) : patterns durs
  [3, 4, 5, 6, 7, 8, 9, 11], // Vampire (drain), Dragon (feint)
  // V5 (index 4) : tout est possible, y compris la sorcière
  [3, 4, 5, 6, 7, 8, 9, 10, 11], // + Sorcière (healer boss-mode)
];

/**
 * Récompenses par MOB tué (mécanique cumulative).
 *
 * Chaque mob d'une vague (3 par vague) rapporte une récompense propre selon :
 *   - sa POSITION dans la vague (1er, 2e, 3e) : tarif progressif
 *   - son GRADE (G1 à G5) : multiplicateur par grade
 *
 * L'or et le drop d'une vague = somme/cumul des récompenses des mobs tués.
 * Si la vague est partielle (joueur fuit/meurt), il garde l'or des mobs déjà tués
 * et chaque mob a déjà fait son propre roll de drop indépendant.
 *
 * Tableaux de base (G1) :
 *   - 1er mob tué  → 0 or, 0% drop
 *   - 2e mob tué   → 1 or, 2% drop
 *   - 3e mob tué   → 2 or, 5% drop
 * Chaque grade au-dessus de G1 ajoute :
 *   - +3 or par mob
 *   - +2% drop par mob
 *
 * Ainsi vague G5 complète = 12 + 13 + 14 = 39 or, drops à 8% + 10% + 13%.
 */

/** Or de base d'un mob (G1) selon sa position dans la vague (0=1er, 1=2e, 2=3e). */
export const MOB_GOLD_BASE = [0, 1, 2];
/** Drop de base d'un mob (G1) selon sa position.
 *  Réajusté en mai 2026 pour rendre la progression XP via ressources rares
 *  visible (avant : 0/2/5%, désormais 5/10/15%). À grade 5, le 1er mob passe
 *  de 8% à 13%, le 2e de 10% à 18%, le 3e de 13% à 23%. */
export const MOB_DROP_BASE = [0.05, 0.10, 0.15];
/** Bonus or par grade au-dessus de G1. */
export const GOLD_PER_GRADE = 3;
/** Bonus drop par grade au-dessus de G1. */
export const DROP_PCT_PER_GRADE = 0.02;

/**
 * Calcule la récompense d'un mob tué selon sa position et son grade.
 * @param {number} position - 0, 1 ou 2 (1er, 2e, 3e mob tué dans la vague)
 * @param {number} grade    - grade DE BASE du mob (1-5), pas le grade enragé
 * @param {number} bonusDropFlat - bonus drop additif (ex: 0.05 = +5%) — utilisé par Sprint 2C palier 3 statue
 * @returns {{ gold: number, dropChance: number }}
 */
export function getMobReward(position, grade, bonusDropFlat = 0) {
  const safePos = Math.max(0, Math.min(2, position));
  const safeGrade = Math.max(1, Math.min(5, grade));
  const gradeBonus = safeGrade - 1;
  return {
    gold: MOB_GOLD_BASE[safePos] + gradeBonus * GOLD_PER_GRADE,
    dropChance: Math.min(1, MOB_DROP_BASE[safePos] + gradeBonus * DROP_PCT_PER_GRADE + bonusDropFlat),
  };
}

export const MASTERY_TIERS = [
  { points: 50,  level: 1, hpBonus: 1, goldBonus: 0.05, partialDropBonus: 0.05 },
  { points: 150, level: 2, hpBonus: 2, goldBonus: 0.10, partialDropBonus: 0.10 },
  { points: 300, level: 3, hpBonus: 3, goldBonus: 0.15, partialDropBonus: 0.15 },
  { points: 600, level: 4, hpBonus: 4, goldBonus: 0.20, partialDropBonus: 0.20 },
];

/**
 * Paliers d'incertitude de l'indice selon % HP du mob.
 *   - mode = "single"  → annonce 1 zone, fiable à confidence
 *   - mode = "double"  → annonce 2 zones probables (50/50)
 *   - mode = "random"  → "frappe au hasard" (25% par zone)
 */
/**
 * Calcule la confiance et le mode d'indice selon le % HP du mob.
 *
 * REFONTE V2 : indice "single" max 70% (jamais 100% sûr) : il y a toujours un risque.
 * Le mob peut frapper une autre zone que celle annoncée 30% du temps même à full HP.
 */
export function getHintInfo(currentHP, maxHP) {
  const ratio = maxHP > 0 ? currentHP / maxHP : 0;
  if (ratio >= 1.0) return { confidence: 0.7, mode: "single", label: "probable" };
  if (ratio >= 0.6) return { confidence: 0.6, mode: "single", label: "possible" };
  if (ratio >= 0.3) return { confidence: 0.5, mode: "double", label: "hésite" };
  return { confidence: 0.25, mode: "random", label: "aléatoire" };
}

// ─────────────────────────────────────────────────────────────
// Helpers déterministes
// ─────────────────────────────────────────────────────────────

export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function seededRandom(seedStr) {
  let state = hashString(seedStr) || 1;
  return function () {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// ─────────────────────────────────────────────────────────────
// Maîtrise
// ─────────────────────────────────────────────────────────────

export function getMasteryInfo(profile, biomeKey) {
  const points = (profile?.biome_mastery || {})[biomeKey] || 0;
  let info = { points, level: 0, hpBonus: 0, goldBonus: 0, partialDropBonus: 0 };
  for (const tier of MASTERY_TIERS) {
    if (points >= tier.points) {
      info = {
        points,
        level: tier.level,
        hpBonus: tier.hpBonus,
        goldBonus: tier.goldBonus,
        partialDropBonus: tier.partialDropBonus,
      };
    }
  }
  return info;
}

export function getPlayerMaxHP(profile, biomeKey) {
  const mastery = getMasteryInfo(profile, biomeKey);
  return COMBAT_MAX_HP + mastery.hpBonus;
}

// ─────────────────────────────────────────────────────────────
// Génération de la vague (déterministe)
// ─────────────────────────────────────────────────────────────

export function generateWave(biomeKey, dayStr, waveIndex) {
  const stats = WAVE_STATS[waveIndex] || WAVE_STATS[WAVE_STATS.length - 1];
  const rand = seededRandom(`${dayStr}|${biomeKey}|wave${waveIndex}`);

  // Pool de monstres autorisés pour cette vague (difficulté progressive)
  const pool = WAVE_MONSTER_POOLS[waveIndex] || WAVE_MONSTER_POOLS[WAVE_MONSTER_POOLS.length - 1];

  const usedIndices = new Set();
  const monsters = [];
  for (let i = 0; i < MONSTERS_PER_WAVE; i++) {
    let poolIdx;
    let safety = 0;
    do {
      poolIdx = Math.floor(rand() * pool.length);
      safety++;
    } while (usedIndices.has(poolIdx) && safety < 50);
    usedIndices.add(poolIdx);
    const dataIdx = pool[poolIdx];
    const m = MONSTERS_DATA[dataIdx];

    // Pattern "heavy" : HP de base +2
    const isHeavy = m.pattern === "heavy";
    // Pattern "weak" : grade de base ne sera pas augmenté en effectif (cf getMonsterEffectiveGrade)

    monsters.push({
      position: i,
      name: m.name,
      icon: m.icon,
      pattern: m.pattern || "normal",
      hp: stats.hp + (isHeavy ? 2 : 0),
      hpMax: stats.hp + (isHeavy ? 2 : 0),
      grade: stats.grade,
      alive: true,
      // Champs spécifiques à certains patterns (initialisés ici pour cohérence)
      reviveUsed: false,  // Pour squelette : true après résurrection
    });
  }
  return monsters;
}

/**
 * Calcule le grade effectif d'un mob (avec enragement et modifs de pattern).
 * Plafond G6, plancher G1.
 *   - "weak" (corbeau) : grade -1 (peut tomber à G0)
 *   - "heavy" (golem)  : grade +1
 *   - enragé (≤60% HP): grade +1
 */
export function getMonsterEffectiveGrade(monster) {
  let grade = monster.grade;
  if (monster.pattern === "weak") grade = Math.max(0, grade - 1);
  else if (monster.pattern === "heavy") grade = Math.min(MAX_RAGE_GRADE, grade + 1);

  const ratio = monster.hpMax > 0 ? monster.hp / monster.hpMax : 0;
  if (ratio <= RAGE_HP_THRESHOLD && monster.hp > 0) {
    return { grade: Math.min(grade + 1, MAX_RAGE_GRADE), enraged: true };
  }
  return { grade, enraged: false };
}

// ─────────────────────────────────────────────────────────────
// Génération des intentions par tour
// ─────────────────────────────────────────────────────────────

/**
 * Pour chaque mob vivant, génère une intention (zone visée + indice).
 * Retourne null pour les mobs morts (alignement avec monsters).
 */
export function generateMonsterIntents(monsters, seedStr) {
  const rand = seededRandom(seedStr);
  return monsters.map((m, idx) => {
    if (!m.alive || m.hp <= 0) return null;

    // Pattern "blurry" (Ombre) : force toujours le mode "double" minimum.
    let hint = getHintInfo(m.hp, m.hpMax);
    if (m.pattern === "blurry" && hint.mode === "single") {
      hint = { confidence: 0.5, mode: "double", label: "trouble" };
    }

    const actualZoneIdx = Math.floor(rand() * COMBAT_ZONES.length);
    let actualZone = COMBAT_ZONES[actualZoneIdx];

    // Pattern "feint" (Dragon) : 50% de chance que zone réelle ≠ zone annoncée.
    // On gère ça en single mode : si on tire le feint, on inverse zone réelle/annoncée.
    const isFeint = m.pattern === "feint";

    if (hint.mode === "single") {
      const r = rand();
      const honest = r < hint.confidence;
      let announced = honest ? actualZone : null;
      if (!honest) {
        const otherZones = COMBAT_ZONES.filter(z => z !== actualZone);
        announced = otherZones[Math.floor(rand() * otherZones.length)];
      }
      // Feint : 50% chance d'inverser actual/announced si pas déjà en mode "menteur"
      if (isFeint && rand() < 0.5) {
        const swap = announced;
        announced = actualZone;
        actualZone = swap;
      }
      return {
        monsterIdx: idx,
        actualZone,
        announcedZone: announced,
        mode: "single",
        confidence: hint.confidence,
        hintLabel: hint.label,
      };
    }

    if (hint.mode === "double") {
      const otherZones = COMBAT_ZONES.filter(z => z !== actualZone);
      const altIdx = Math.floor(rand() * otherZones.length);
      let altZone = otherZones[altIdx];
      // Feint en mode double : possibilité que la vraie zone soit l'alternative
      if (isFeint && rand() < 0.5) {
        const swap = altZone;
        altZone = actualZone;
        actualZone = swap;
      }
      return {
        monsterIdx: idx,
        actualZone,
        announcedZone: actualZone,
        alternativeZone: altZone,
        mode: "double",
        confidence: hint.confidence,
        hintLabel: hint.label,
      };
    }

    // mode "random"
    return {
      monsterIdx: idx,
      actualZone,
      announcedZone: null,
      mode: "random",
      confidence: hint.confidence,
      hintLabel: hint.label,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Calcul de défense (avec bouclier)
// ─────────────────────────────────────────────────────────────

/**
 * Défense effective sur une zone donnée.
 * - armure équipée (slot {zone}_def) : +(1+grade) si présente
 * - bouclier (slot shield) si shieldOnThisZone : +(1+grade_bouclier)
 */
export function getZoneDefense(profile, zone, shieldOnThisZone = false) {
  const armorSlot = `${zone}_def`;
  const armor = profile?.equipment?.[armorSlot];
  const armorVal = armor ? getCombatItemValue(armor.grade) : 0;

  let shieldVal = 0;
  if (shieldOnThisZone) {
    const shield = profile?.equipment?.shield;
    if (shield) shieldVal = getCombatItemValue(shield.grade);
  }
  return armorVal + shieldVal;
}

/**
 * Détermine si un coup passe : 1 PV perdu si défense < (1+grade mob).
 * Mécanique miroir du PvP zoné.
 */
export function computeHit(monsterGrade, zoneDefense) {
  return zoneDefense < (1 + monsterGrade) ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────
// État et résolution
// ─────────────────────────────────────────────────────────────

export function createInitialWaveState({ profile, biomeKey, waveIndex, dayStr, startingHP, epicMode = false }) {
  const monsters = generateWave(biomeKey, dayStr, waveIndex);
  const maxHP = getPlayerMaxHP(profile, biomeKey);
  // En mode épopée, on autorise startingHP=0 (mort). En classique, plancher 1 PV.
  const minHP = epicMode ? 0 : PVE_HP_FLOOR;
  const initialHP = startingHP != null
    ? Math.max(minHP, Math.min(maxHP, startingHP))
    : maxHP;

  const intents = generateMonsterIntents(
    monsters,
    `${dayStr}|${biomeKey}|wave${waveIndex}|turn0`
  );

  return {
    biomeKey,
    waveIndex,
    dayStr,
    monsters,
    playerHP: initialHP,
    playerMaxHP: maxHP,
    turnIndex: 0,
    intents,
    monstersKilled: 0,
    killRewards: [],
    goldStolenInWave: 0,
    epicMode,           // Si true, le joueur peut tomber à 0 PV (status "dead")
    log: [],
    status: "in_progress",
    pendingCounter: null,
  };
}

export function getAliveMonsters(state) {
  return state.monsters
    .map((m, i) => (m.alive && m.hp > 0 ? i : -1))
    .filter(i => i >= 0);
}

/**
 * Phase 1 d'un tour : applique les défenses du joueur (mécanique B + Vision B parade pure).
 *
 * action = {
 *   type: "defend",
 *   defenses: {
 *     [monsterIdx]: { primaryZone, shieldZone }
 *     // primaryZone = zone "épée" (parade pure : annule le coup si bonne zone)
 *     // shieldZone  = zone "bouclier" (armure + bouclier additif, optionnel)
 *   }
 * }
 *
 * Le joueur fait UN choix de défense PAR mob vivant. Pour chaque mob :
 *   - Si la zone que ce mob frappe == primaryZone[mob] → PARADE PURE (0 dégât + contre,
 *     peu importe l'armure ou le grade du mob)
 *   - Sinon si la zone == shieldZone[mob] → tentative absorption armure+bouclier
 *     (si def ≥ 1+grade_mob → 0 dégât, sinon 1 PV perdu, jamais de contre)
 *   - Sinon → armure seule de la zone (idem, sans contre)
 *
 * Retourne un nouveau state. Si parries.length > 0, state.pendingCounter est posé.
 * Sinon, on enchaîne sur advanceTurn() automatiquement.
 */
export function resolveDefense(state, profile, action) {
  if (state.status !== "in_progress") return state;
  if (action.type !== "defend") return state;

  const aliveIdx = getAliveMonsters(state);
  if (aliveIdx.length === 0) {
    return { ...state, status: "wave_complete" };
  }

  const defenses = action.defenses || {};
  const hasShield = !!profile?.equipment?.shield;

  const parries = [];
  const hits = [];
  let newHP = state.playerHP;
  let goldStolenByThieves = 0;
  // Modifs HP des mobs accumulées pendant cette phase (drain, healer, regen)
  // map : monsterIdx → delta HP
  const monsterHPDelta = {};
  const addMonsterHp = (mobIdx, delta) => {
    monsterHPDelta[mobIdx] = (monsterHPDelta[mobIdx] || 0) + delta;
  };

  for (const idx of aliveIdx) {
    const intent = state.intents[idx];
    if (!intent) continue;

    const mob = state.monsters[idx];
    const eff = getMonsterEffectiveGrade(mob);
    const zoneAttacked = intent.actualZone;

    // Récupère les choix de défense pour CE mob spécifiquement
    const mobDef = defenses[idx] || {};
    const primaryZone = mobDef.primaryZone || null;
    const shieldZone =
      hasShield && mobDef.shieldZone && mobDef.shieldZone !== primaryZone
        ? mobDef.shieldZone
        : null;

    const isPrimary = primaryZone && zoneAttacked === primaryZone;
    const isShielded = !isPrimary && shieldZone && zoneAttacked === shieldZone;

    // Helper : appliquer le coup d'un mob (avec activation des patterns thief/drain)
    const onHitInflicted = (dmg) => {
      newHP -= dmg;
      // Pattern "thief" : vole 5 or si blesse le joueur
      if (mob.pattern === "thief") {
        goldStolenByThieves += 5;
      }
      // Pattern "drain" : soigne +1 PV à lui-même quand il blesse
      if (mob.pattern === "drain") {
        addMonsterHp(idx, 1);
      }
    };

    if (isPrimary) {
      // Vision B : parade pure. Bonne zone = 0 dégât + contre, peu importe l'armure.
      parries.push({
        monsterIdx: idx,
        zone: zoneAttacked,
        monsterGradeUsed: eff.grade,
        enraged: eff.enraged,
      });
      continue;
    }

    if (isShielded) {
      // Défense bouclier : armure + bouclier sur la zone
      const def = getZoneDefense(profile, zoneAttacked, true);
      const required = 1 + eff.grade;
      if (def >= required) {
        // Coup absorbé, pas de parade (donc pas de contre)
        hits.push({
          monsterIdx: idx,
          zone: zoneAttacked,
          monsterGradeUsed: eff.grade,
          enraged: eff.enraged,
          dmg: 0,
          defenseTried: true,
          defenseType: "shielded",
        });
        continue;
      }
      // Bouclier insuffisant : 1 PV perdu
      onHitInflicted(1);
      hits.push({
        monsterIdx: idx,
        zone: zoneAttacked,
        monsterGradeUsed: eff.grade,
        enraged: eff.enraged,
        dmg: 1,
        defenseTried: true,
        defenseType: "shield_failed",
      });
      continue;
    }

    // Zone non défendue (ni épée ni bouclier sur cette zone) → armure seule
    const def = getZoneDefense(profile, zoneAttacked, false);
    const required = 1 + eff.grade;
    if (def >= required) {
      hits.push({
        monsterIdx: idx,
        zone: zoneAttacked,
        monsterGradeUsed: eff.grade,
        enraged: eff.enraged,
        dmg: 0,
        defenseTried: false,
        defenseType: "armor_absorbed",
      });
      continue;
    }
    onHitInflicted(1);
    hits.push({
      monsterIdx: idx,
      zone: zoneAttacked,
      monsterGradeUsed: eff.grade,
      enraged: eff.enraged,
      dmg: 1,
      defenseTried: false,
      defenseType: "uncovered",
    });
  }

  // ── Patterns post-attaque : healer + regen ──
  // Healer (Sorcière) : à chaque tour, soigne +1 PV à TOUS les mobs vivants.
  // Note : la sorcière elle-même est incluse (auto-heal possible mais cap par hpMax).
  // Regen (Troll) : à chaque tour, +1 PV à lui-même (cap par hpMax).
  for (const idx of aliveIdx) {
    const m = state.monsters[idx];
    if (m.pattern === "healer") {
      for (const otherIdx of aliveIdx) {
        addMonsterHp(otherIdx, 1);
      }
    }
    if (m.pattern === "regen") {
      addMonsterHp(idx, 1);
    }
  }

  // Application des deltas HP sur les mobs (cap par hpMax)
  let monsters = state.monsters;
  if (Object.keys(monsterHPDelta).length > 0) {
    monsters = state.monsters.map((m, i) => {
      const delta = monsterHPDelta[i] || 0;
      if (delta === 0 || !m.alive) return m;
      const newMobHp = Math.min(m.hpMax, Math.max(0, m.hp + delta));
      return { ...m, hp: newMobHp };
    });
  }

  // Vol d'or par les voleurs
  let newGoldStolen = state.goldStolenInWave || 0;
  if (goldStolenByThieves > 0) {
    newGoldStolen += goldStolenByThieves;
  }

  let nextStatus = state.status;
  // Mode épopée (partagé biome ↔ PvP) : peut tomber à 0 PV (= mort).
  // Mode classique (mode test V2) : plancher 1 PV maintenu (status "exhausted").
  if (state.epicMode) {
    if (newHP <= 0) {
      newHP = 0;
      nextStatus = "dead";
    }
  } else {
    if (newHP < PVE_HP_FLOOR) {
      newHP = PVE_HP_FLOOR;
      nextStatus = "exhausted";
    }
  }

  const newState = {
    ...state,
    monsters,
    playerHP: newHP,
    goldStolenInWave: newGoldStolen,
    status: nextStatus,
    log: [...state.log, {
      turnIndex: state.turnIndex,
      action: "defend",
      defenses,
      parries,
      hits,
      goldStolenByThieves,
      monsterHPDelta,
    }],
  };

  if (parries.length > 0 && nextStatus === "in_progress") {
    newState.pendingCounter = {
      availableCounters: parries.length,
      parries,
    };
  } else if (nextStatus === "in_progress") {
    return advanceTurn(newState);
  }

  return newState;
}

/**
 * Phase 2 d'un tour : applique les contre-attaques.
 * targetIndices : tableau d'indices de mobs (1 par contre disponible),
 * peut contenir des doublons (focus possible).
 *
 * À chaque mob tué, on calcule immédiatement sa récompense (or + roll drop)
 * selon sa position dans la séquence de morts (1er=palier 1, 2e=palier 2, 3e=palier 3).
 * Les récompenses sont accumulées dans state.killRewards (un tableau par ordre de mort).
 */
export function applyCounters(state, profile, targetIndices, options = {}) {
  if (state.status !== "in_progress" || !state.pendingCounter) return state;

  const rng = options.rng || Math.random;
  const weapon = profile?.equipment?.weapon;
  const dmgPerCounter = weapon ? getCombatItemValue(weapon.grade) : 1;

  const monsters = state.monsters.map(m => ({ ...m }));
  const counterApplied = [];
  // Compteur de mobs déjà morts AVANT cette vague de contres (pour position de récompense)
  let alreadyKilled = monsters.filter(m => !m.alive).length;
  // Cumul des récompenses gagnées dans cette résolution
  const killRewards = state.killRewards ? [...state.killRewards] : [];

  for (const targetIdx of targetIndices) {
    const m = monsters[targetIdx];
    if (!m || !m.alive || m.hp <= 0) continue;

    // Pattern "elusive" (Élémental) : 50% de chance d'esquiver le contre
    if (m.pattern === "elusive" && rng() < 0.5) {
      counterApplied.push({ monsterIdx: targetIdx, dmg: 0, dodged: true });
      continue;
    }

    m.hp = Math.max(0, m.hp - dmgPerCounter);
    counterApplied.push({ monsterIdx: targetIdx, dmg: dmgPerCounter });

    if (m.hp <= 0) {
      // Pattern "revive" (Squelette) : revient à 1 PV une seule fois
      if (m.pattern === "revive" && !m.reviveUsed) {
        m.hp = 1;
        m.reviveUsed = true;
        counterApplied[counterApplied.length - 1].revived = true;
        continue;
      }

      m.alive = false;
      // Calcul de la récompense pour ce mob, à sa position de kill
      // Sprint 2C : palier 3 statue royale ajoute +5% drop (bonusDropFlat)
      const reward = getMobReward(alreadyKilled, m.grade, options.bonusDropFlat || 0);
      const dropped = rng() < reward.dropChance;
      killRewards.push({
        monsterIdx: targetIdx,
        position: alreadyKilled,    // 0 = 1er, 1 = 2e, 2 = 3e
        grade: m.grade,
        gold: reward.gold,
        dropChance: reward.dropChance,
        dropped,
      });
      alreadyKilled += 1;
    }
  }

  const monstersKilled = monsters.filter(m => !m.alive).length;
  let nextStatus = state.status;
  if (monstersKilled >= MONSTERS_PER_WAVE) {
    nextStatus = "wave_complete";
  }

  const newState = {
    ...state,
    monsters,
    monstersKilled,
    killRewards,
    pendingCounter: null,
    log: [...state.log, { turnIndex: state.turnIndex, action: "counter", counters: counterApplied }],
    status: nextStatus,
  };

  if (nextStatus === "in_progress") {
    return advanceTurn(newState);
  }
  return newState;
}

/**
 * Avance au tour suivant : régénère les intentions des mobs vivants.
 */
export function advanceTurn(state) {
  if (state.status !== "in_progress") return state;
  const newTurn = state.turnIndex + 1;

  // Limite de tours par vague atteinte → vague échouée
  // Le joueur garde l'or des mobs déjà tués (status "out_of_turns" pour distinguer du "fled").
  if (newTurn >= MAX_TURNS_PER_WAVE) {
    return {
      ...state,
      turnIndex: newTurn,
      status: "out_of_turns",
      pendingCounter: null,
      log: [...state.log, { turnIndex: newTurn, action: "out_of_turns" }],
    };
  }

  const intents = generateMonsterIntents(
    state.monsters,
    `${state.dayStr}|${state.biomeKey}|wave${state.waveIndex}|turn${newTurn}`
  );
  return {
    ...state,
    turnIndex: newTurn,
    intents,
    pendingCounter: null,
  };
}

export function fleeWave(state) {
  if (state.status !== "in_progress") return state;
  return {
    ...state,
    status: "fled",
    pendingCounter: null,
    log: [...state.log, { turnIndex: state.turnIndex, action: "flee" }],
  };
}

// ─────────────────────────────────────────────────────────────
// État booléens
// ─────────────────────────────────────────────────────────────

export function isWaveComplete(state) { return state.status === "wave_complete"; }
export function isPlayerExhausted(state) { return state.status === "exhausted"; }
export function isFled(state) { return state.status === "fled"; }
export function isOutOfTurns(state) { return state.status === "out_of_turns"; }
export function isDead(state) { return state.status === "dead"; }
export function isInProgress(state) { return state.status === "in_progress"; }

// ─────────────────────────────────────────────────────────────
// Récompenses
// ─────────────────────────────────────────────────────────────

/**
 * Récompenses cumulatives basées sur les mobs tués (state.killRewards).
 * Chaque mob tué a déjà fait son propre roll de drop au moment du kill.
 * On totalise ici l'or et on liste les drops.
 *
 * Bonus de maîtrise :
 *   - Or : multiplicateur (×1.05 à ×1.20 selon level)
 *   - Drop partiel : pas applicable ici (chaque drop est déjà rollé individuellement)
 *     → le bonus ne s'applique plus aux drops puisqu'on roll par mob.
 *     → Pour compenser, on conserve le bonus or comme seul effet ×% des récompenses.
 *
 * @returns {{
 *   gold, masteryGain, drops (array), label, killCount
 * }}
 */
export function computeWaveRewards(state, profile, biomeKey, biomeRareKey, options = {}) {
  const mastery = getMasteryInfo(profile, biomeKey);
  const kills = state.killRewards || [];
  const killCount = kills.length;
  const goldStolen = state.goldStolenInWave || 0;

  if (killCount === 0) {
    return {
      gold: 0,
      goldGross: 0,
      goldStolen,
      masteryGain: 0,
      drops: [],
      label: "no_kill",
      killCount: 0,
    };
  }

  // Or cumulé sur tous les mobs tués
  const goldRaw = kills.reduce((sum, k) => sum + k.gold, 0);
  const goldGross = Math.round(goldRaw * (1 + mastery.goldBonus));
  // Net après vol par les voleurs (Brigand)
  const gold = Math.max(0, goldGross - goldStolen);

  // Drops cumulés (1 entrée par mob qui a drop)
  const drops = kills
    .filter(k => k.dropped)
    .map(k => ({ key: biomeRareKey, fromMonsterIdx: k.monsterIdx, position: k.position }));

  const masteryGain = killCount;

  let label;
  if (killCount >= MONSTERS_PER_WAVE) label = "full";
  else if (killCount === 2) label = "partial2";
  else label = "partial1";

  return {
    gold,                  // or net (après vol)
    goldGross,             // or brut (avant vol)
    goldStolen,            // or volé par les voleurs
    masteryGain,
    drops,                 // tableau de drops obtenus
    dropped: drops.length > 0,
    dropKey: drops.length > 0 ? biomeRareKey : null,
    dropCount: drops.length,
    label,
    killCount,
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers description (UI)
// ─────────────────────────────────────────────────────────────

export const ZONE_LABELS_FR = {
  head: "tête",
  torso: "torse",
  arms: "bras",
  legs: "jambes",
};

// Article défini avec apostrophe/élision quand le mot commence par voyelle.
// Permet de générer correctement "la tête", "le torse", "les bras", "les jambes".
const ZONE_ARTICLE_FR = {
  head: "la",
  torso: "le",
  arms: "les",
  legs: "les",
};

function zoneWithArticle(zoneKey) {
  return `${ZONE_ARTICLE_FR[zoneKey]} ${ZONE_LABELS_FR[zoneKey]}`;
}

export function describeIntent(monster, intent) {
  if (!intent) return "";
  if (intent.mode === "single" && intent.confidence === 1.0) {
    return `${monster.name} va frapper ${zoneWithArticle(intent.announcedZone)}`;
  }
  if (intent.mode === "single") {
    return `${monster.name} vise probablement ${zoneWithArticle(intent.announcedZone)}`;
  }
  if (intent.mode === "double") {
    return `${monster.name} hésite entre ${zoneWithArticle(intent.announcedZone)} et ${zoneWithArticle(intent.alternativeZone)}`;
  }
  return `${monster.name} frappe au hasard`;
}

/**
 * Description courte du pattern d'un mob, pour affichage en UI.
 * Retourne null si le mob n'a pas de pattern spécial à signaler.
 */
export function describePattern(pattern) {
  switch (pattern) {
    case "weak":    return { icon: "🪶", label: "Frêle", desc: "Grade -1 (plus facile)" };
    case "blurry":  return { icon: "👻", label: "Flou", desc: "Indice toujours imprécis" };
    case "thief":   return { icon: "💰", label: "Voleur", desc: "Vole 5 or s'il vous blesse" };
    case "elusive": return { icon: "💨", label: "Insaisissable", desc: "50% chance d'esquiver les contres" };
    case "drain":   return { icon: "🩸", label: "Vampirique", desc: "+1 PV à lui-même s'il vous blesse" };
    case "feint":   return { icon: "🌀", label: "Trompeur", desc: "Peut feinter (zone réelle ≠ annoncée)" };
    case "revive":  return { icon: "💀", label: "Persistant", desc: "Revient à 1 PV une fois après mort" };
    case "heavy":   return { icon: "🪨", label: "Massif", desc: "Grade +1, +2 PV (plus tanky)" };
    case "healer":  return { icon: "✨", label: "Guérisseur", desc: "Soigne +1 PV à TOUS les mobs vivants à chaque tour" };
    case "regen":   return { icon: "🌿", label: "Régénération", desc: "+1 PV à lui-même chaque tour" };
    default: return null;
  }
}

export function describeWaveState(state) {
  if (state.status === "wave_complete") return `Vague terminée : ${state.monstersKilled}/${MONSTERS_PER_WAVE} mobs tués`;
  if (state.status === "fled") return `Repli : ${state.monstersKilled} mob(s) tué(s)`;
  if (state.status === "exhausted") return `Épuisement : ${state.monstersKilled} mob(s) tué(s)`;
  if (state.status === "out_of_turns") return `Trop long ! Hors temps : ${state.monstersKilled} mob(s) tué(s)`;
  if (state.status === "dead") return `💀 Mort au combat : ${state.monstersKilled} mob(s) tué(s)`;
  const alive = getAliveMonsters(state).length;
  return `Tour ${state.turnIndex + 1} : ${alive} mob(s) en vie, joueur ${state.playerHP}/${state.playerMaxHP} PV`;
}
