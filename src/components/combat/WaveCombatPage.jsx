/**
 * src/components/combat/WaveCombatPage.jsx
 *
 * Composant qui orchestre 1 vague PvE biome (1 mob contre 1 joueur).
 * Utilise CombatTurnBasedView pour l'UI.
 *
 * Props :
 *   - profile : profil joueur (avec equipment, hp, etc.)
 *   - biomeKey : "foret", "mine", etc.
 *   - waveIndex : 0..4
 *   - dayStr : "2026-05-16"
 *   - startingHP : HP du joueur au début de la vague (peut être < max si vague suivante)
 *   - onComplete(result) : callback quand la vague est finie
 *                          result : { status, killRewards, goldStolenInWave, finalHP, finalEquipment }
 *
 * Phase interne :
 *   - 'fighting' : combat actif
 *   - 'summary' : vague finie, affichage résumé + bouton "Vague suivante" ou "Quitter"
 */

import { useState, useCallback } from 'react';
import MonsterSprite from './MonsterSprite';
import CombatTurnBasedView from './CombatTurnBasedView';
import {
  createInitialWaveState,
  resolveWaveRound,
  fleeWave,
  COMBAT_ZONES,
  MAX_TURNS_PER_MOB,
  isWaveComplete,
  isOutOfTurns,
  isFled,
  isInProgress,
} from '@/lib/combatPvE';

const ZONE_LABELS = {
  head: 'Tête',
  torso: 'Torse',
  arms: 'Bras',
  legs: 'Jambes',
};

export default function WaveCombatPage({
  profile,
  biomeKey,
  waveIndex,
  dayStr,
  startingHP,
  onComplete,
}) {
  // Init state lazily (on first render)
  const [state, setState] = useState(() => createInitialWaveState({
    profile,
    biomeKey,
    waveIndex,
    dayStr,
    startingHP,
    epicMode: true,
  }));
  const [submitting, setSubmitting] = useState(false);

  // Joue 1 round
  const handlePlayRound = useCallback((choices) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Clone le state pour ne pas muter directement
      const newState = JSON.parse(JSON.stringify(state));
      resolveWaveRound(newState, choices);
      setState(newState);

      // Si vague terminée → callback parent IMMÉDIATEMENT
      // (pas de setTimeout pour éviter le bug : si le composant est démonté
      // entre setState et le setTimeout, le onComplete ne se déclenche jamais
      // et la BDD n'est pas mise à jour → le joueur peut relancer).
      if (!isInProgress(newState) && onComplete) {
        onComplete({
          status: newState.status,
          killRewards: newState.killRewards,
          goldStolenInWave: newState.goldStolenInWave,
          finalHP: newState.player.hp,
          finalEquipment: extractEquipment(newState.player),
          roundsPlayed: newState.round,
        });
      }
    } catch (err) {
      console.error('WaveCombatPage error:', err);
    } finally {
      setSubmitting(false);
    }
  }, [state, submitting, onComplete]);

  // Abandonne
  const handleFlee = useCallback(() => {
    if (submitting) return;
    setSubmitting(true);
    const newState = JSON.parse(JSON.stringify(state));
    fleeWave(newState);
    setState(newState);
    // Appel onComplete IMMÉDIAT (voir commentaire ci-dessus)
    if (onComplete) {
      onComplete({
        status: newState.status,
        killRewards: newState.killRewards,
        goldStolenInWave: newState.goldStolenInWave,
        finalHP: newState.player.hp,
        finalEquipment: extractEquipment(newState.player),
        roundsPlayed: newState.round,
      });
    }
    setSubmitting(false);
  }, [state, submitting, onComplete]);

  // Construction du "opponent" depuis state.mob pour CombatTurnBasedView
  const mob = state.mob;
  const opponent = {
    name: `${state.mobSpec.icon} ${mob.name}`,
    hp: mob.hp,
    hpMax: mob.hpMax,
    weaponGrade: mob.weapon?.grade ?? 0,
    weaponDura: mob.weapon?.dura ?? 0,
    shieldGrade: mob.shield?.grade ?? 0,
    shieldDura: mob.shield?.dura ?? 0,
    destabRoundsLeft: mob.destabRoundsLeft ?? 0,
  };

  return (
    <CombatTurnBasedView
      state={state}
      opponent={opponent}
      opponentSprite={MonsterSprite}
      opponentSpriteProps={{ name: mob.name, size: 140 }}
      profile={profile}
      maxRounds={MAX_TURNS_PER_MOB}
      submitting={submitting}
      onPlayRound={handlePlayRound}
      onFlee={handleFlee}
      zones={COMBAT_ZONES}
      zoneLabels={ZONE_LABELS}
      opponentLabel={`HP ${mob.name}`}
    />
  );
}

/**
 * Extrait l'équipement du combattant joueur en format BDD (item_key + grade + durability).
 * Préserve l'item_key et la durabilité actuelle pour persistance.
 */
function extractEquipment(playerCombatant) {
  return {
    weapon:    { grade: playerCombatant.weapon.grade,      durability: playerCombatant.weapon.dura },
    shield:    { grade: playerCombatant.shield.grade,      durability: playerCombatant.shield.dura },
    head_def:  { grade: playerCombatant.armor.head.grade,  durability: playerCombatant.armor.head.dura },
    torso_def: { grade: playerCombatant.armor.torso.grade, durability: playerCombatant.armor.torso.dura },
    arms_def:  { grade: playerCombatant.armor.arms.grade,  durability: playerCombatant.armor.arms.dura },
    legs_def:  { grade: playerCombatant.armor.legs.grade,  durability: playerCombatant.armor.legs.dura },
  };
}
