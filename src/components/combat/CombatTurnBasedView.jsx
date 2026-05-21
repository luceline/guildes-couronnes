/**
 * src/components/combat/CombatTurnBasedView.jsx
 *
 * Composant générique pour combat tour-par-tour mirror (boss + PvE biome).
 *
 * Affiche :
 *   - HP bar adversaire + dura badges arme/bouclier
 *   - Arène (sprite joueur vs sprite adversaire)
 *   - HP bar joueur + dura badges (6 zones)
 *   - Controls : 3 selects (Attaque/Parade/Bouclier) + boutons Continuer/Abandonner
 *   - Log de combat scrollable
 *
 * Props :
 *   - state : objet combat avec { player, round, done, log }
 *   - opponent : { name, hp, hpMax, weaponDura, shieldDura, weaponGrade, shieldGrade, destabRoundsLeft }
 *   - opponentSprite : Composant React du sprite adverse (DragonSprite, MonsterSprite, etc.)
 *   - opponentSpriteProps : props additionnelles à passer au sprite
 *   - profile : profil joueur (pour KnightSprite)
 *   - maxRounds : nombre max de tours (affichage "Tour X / N")
 *   - submitting : booleen disable boutons
 *   - onPlayRound(choices) : callback validation 3 zones
 *   - onFlee : callback abandon
 *   - zones : array des zones ['head', 'torso', 'arms', 'legs']
 *   - zoneLabels : map des labels { head: 'Tête', ... }
 *
 * Ce composant est PURE UI, il ne fait pas d'appel API ni de calcul de combat.
 * Le parent (BossArenaPage ou WaveCombatPage) gère la logique.
 */

import { useState, useEffect, useRef } from 'react';
import KnightSprite from './KnightSprite';
import './CombatScreen.css';

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants UI
// ─────────────────────────────────────────────────────────────────────────────

export function HpBar({ current, max, label, color = '#c1473a' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
        <span style={{ color: '#e8d4a0', fontWeight: 500 }}>{label}</span>
        <span style={{ fontWeight: 500, color: '#f0e0b8' }}>{current} / {max}</span>
      </div>
      <div style={{ height: 12, background: '#1a0808', borderRadius: 3, overflow: 'hidden', border: '1px solid #5a4530' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

export function DuraBadge({ label, value, max = 10 }) {
  const pct = max > 0 ? value / max : 0;
  const color = pct > 0.6 ? '#5dcaa5' : pct > 0.3 ? '#ef9f27' : '#e24b4a';
  return (
    <div style={{ background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: 4, fontSize: 10, textAlign: 'center', minWidth: 60, border: '1px solid #5a4530' }}>
      <div style={{ color: '#e8d4a0' }}>{label}</div>
      <div style={{ fontWeight: 500, color }}>{value}/{max}</div>
    </div>
  );
}

export function CombatLogLine({ entry }) {
  const colorMap = {
    round_start: '#fff',
    player_hit: '#5dcaa5',
    player_parry: '#378add',
    player_block: '#378add',
    player_partial_block: '#ef9f27',
    player_shield: '#378add',
    player_miss: '#a08868',
    player_armor_fail: '#a08868',
    player_parry_fail: '#a08868',
    player_shield_fail: '#a08868',
    boss_hit: '#e24b4a',
    boss_parry: '#ef9f27',
    boss_block: '#ef9f27',
    boss_partial_block: '#ef9f27',
    boss_shield: '#ef9f27',
    boss_miss: '#a08868',
    boss_shield_off: '#7f77dd',
    boss_shield_fail: '#a08868',
    boss_parry_fail: '#a08868',
    boss_heal: '#d4537e',
    boss_shield_regen: '#d4537e',
    // PvE mob (alias visuel sur même couleur que boss)
    mob_hit: '#e24b4a',
    mob_parry: '#ef9f27',
    mob_block: '#ef9f27',
    mob_partial_block: '#ef9f27',
    mob_miss: '#a08868',
    mob_shield_off: '#7f77dd',
    mob_shield_fail: '#a08868',
    mob_parry_fail: '#a08868',
    mob_regen: '#d4537e',
    mob_thief: '#f0c640',
    mob_drain: '#d4537e',
    mob_revive: '#7f77dd',
    mob_killed: '#f0c640',
    destab: '#7f77dd',
    destab_end: '#a08868',
    drain: '#d4537e',
    gem_drain: '#d4537e',
    regen: '#7fdb8f',
    boss_killed: '#f0c640',
    player_ko: '#e24b4a',
    flee: '#a08868',
    timeout: '#a08868',
  };
  const color = colorMap[entry.type] || '#a08868';
  const isHeader = entry.type === 'round_start';
  return (
    <div
      style={{
        color,
        fontWeight: isHeader ? 500 : 400,
        marginTop: isHeader ? 6 : 0,
        fontSize: 11,
        lineHeight: 1.5,
      }}
    >
      {entry.msg || entry.type}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function CombatTurnBasedView({
  state,
  opponent,
  opponentSprite: OpponentSprite,
  opponentSpriteProps = {},
  profile,
  maxRounds,
  submitting = false,
  onPlayRound,
  onFlee,
  zones,
  zoneLabels,
  defaultAttack = 'torso',
  defaultParry = 'head',
  defaultShield = 'arms',
  opponentLabel = 'HP boss',
}) {
  const [attackZone, setAttackZone] = useState(defaultAttack);
  const [parryZone, setParryZone] = useState(defaultParry);
  const [shieldZone, setShieldZone] = useState(defaultShield);
  const logRef = useRef(null);

  // Scroll auto du log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state?.log?.length]);

  const handlePlayRound = () => {
    if (!onPlayRound) return;
    if (parryZone === shieldZone) {
      // Validation : parade et bouclier doivent être différentes
      // On force le bouclier sur une zone libre
      const alt = zones.find(z => z !== parryZone && z !== attackZone) || zones[0];
      setShieldZone(alt);
      onPlayRound({ attack: attackZone, parry: parryZone, shield: alt });
    } else {
      onPlayRound({ attack: attackZone, parry: parryZone, shield: shieldZone });
    }
  };

  if (!state) return null;
  const p = state.player;

  return (
    <div>
      {/* Header : HP adversaire */}
      <div style={{
        background: 'linear-gradient(180deg, #1a0f1a 0%, #3d1818 100%)',
        borderRadius: 8,
        padding: '8px 12px',
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ color: '#e8d4a0', fontFamily: 'serif', fontWeight: 500 }}>
            {opponent.name}
            {opponent.destabRoundsLeft > 0 && (
              <span style={{ color: '#ff3a1a', fontSize: 11, marginLeft: 8 }}>
                (déstabilisé {opponent.destabRoundsLeft}t)
              </span>
            )}
          </span>
          <span style={{ fontSize: 11, color: '#a08868' }}>
            Tour {state.round + 1} / {maxRounds}
          </span>
        </div>
        <HpBar current={opponent.hp} max={opponent.hpMax} label={opponentLabel} color="#c1473a" />
        <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'center' }}>
          <DuraBadge label={`Arme G${opponent.weaponGrade ?? 0}`} value={opponent.weaponDura ?? 0} />
          <DuraBadge label={`Bouclier G${opponent.shieldGrade ?? 0}`} value={opponent.shieldDura ?? 0} />
        </div>
      </div>

      {/* Arène */}
      <div className="cs-arena" style={{ background: 'rgba(0,0,0,0.04)', marginBottom: 8 }}>
        <div className="cs-fighter">
          <KnightSprite profile={profile} size={80} />
        </div>
        <div className="cs-monsters-row">
          <div className="cs-monster-slot">
            <OpponentSprite {...opponentSpriteProps} />
          </div>
        </div>
      </div>

      {/* HUD joueur */}
      <div style={{ background: '#2a1818', borderRadius: 6, padding: 8, marginBottom: 8 }}>
        <HpBar current={p.hp} max={p.hpMax} label="Vos HP" color="#5dcaa5" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginTop: 8 }}>
          <DuraBadge label={`Arme G${p.weapon.grade}`} value={p.weapon.dura} />
          <DuraBadge label={`Bouc G${p.shield.grade}`} value={p.shield.dura} />
          <DuraBadge label="Tête" value={p.armor.head.dura} />
          <DuraBadge label="Torse" value={p.armor.torso.dura} />
          <DuraBadge label="Bras" value={p.armor.arms.dura} />
          <DuraBadge label="Jambes" value={p.armor.legs.dura} />
        </div>
      </div>

      {/* Controls */}
      {!state.done && state.status !== 'wave_complete' && state.status !== 'out_of_turns' && state.status !== 'fled' && state.status !== 'dead' && (
        <div style={{ background: '#1a0808', borderRadius: 6, padding: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#a08868', marginBottom: 6 }}>Choisissez votre tactique :</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: '#a08868', display: 'block', marginBottom: 2 }}>Attaque</label>
              <select
                value={attackZone}
                onChange={(e) => setAttackZone(e.target.value)}
                style={{ width: '100%', padding: 4, background: '#2a1818', color: '#e8d4a0', border: '1px solid #5a4530', borderRadius: 4, colorScheme: 'dark' }}
              >
                {zones.map(z => <option key={z} value={z} style={{ background: '#2a1818', color: '#e8d4a0' }}>{zoneLabels[z]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#a08868', display: 'block', marginBottom: 2 }}>Parade</label>
              <select
                value={parryZone}
                onChange={(e) => setParryZone(e.target.value)}
                style={{ width: '100%', padding: 4, background: '#2a1818', color: '#e8d4a0', border: '1px solid #5a4530', borderRadius: 4, colorScheme: 'dark' }}
              >
                {zones.map(z => <option key={z} value={z} style={{ background: '#2a1818', color: '#e8d4a0' }}>{zoneLabels[z]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#a08868', display: 'block', marginBottom: 2 }}>Bouclier</label>
              <select
                value={shieldZone}
                onChange={(e) => setShieldZone(e.target.value)}
                style={{ width: '100%', padding: 4, background: '#2a1818', color: '#e8d4a0', border: '1px solid #5a4530', borderRadius: 4, colorScheme: 'dark' }}
              >
                {zones.map(z => <option key={z} value={z} style={{ background: '#2a1818', color: '#e8d4a0' }}>{zoneLabels[z]}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handlePlayRound}
              disabled={submitting}
              style={{ flex: 1, background: '#c1473a', color: '#fff3c4', border: 'none', padding: '8px 12px', borderRadius: 6, fontWeight: 500, cursor: 'pointer' }}
            >
              ⚔️ Continuer
            </button>
            <button
              onClick={onFlee}
              disabled={submitting}
              style={{ flex: 1, background: 'transparent', color: '#a08868', border: '1px solid #5a4530', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}
            >
              🏃 Abandonner
            </button>
          </div>
        </div>
      )}

      {/* Log */}
      <div
        ref={logRef}
        style={{
          background: '#0a0606',
          border: '1px solid #2a1818',
          borderRadius: 6,
          padding: 10,
          maxHeight: 200,
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: 11,
        }}
      >
        {state.log.map((entry, i) => (
          <CombatLogLine key={i} entry={entry} />
        ))}
      </div>
    </div>
  );
}
