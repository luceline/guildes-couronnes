/**
 * src/pages/BossArenaPage.jsx
 *
 * Page de combat contre le Boss communautaire (Dragon de Nuit).
 *
 * État du composant en 3 phases :
 *   - 'idle'     : pré-combat, on affiche le boss + bouton "Combattre"
 *   - 'fighting' : combat actif, on affiche l'arène avec controls
 *   - 'ended'    : combat fini, résumé + bouton "Retour"
 *
 * Communication avec le serveur (B Strict) :
 *   1. POST /api/boss/start-combat → pose lock + retourne état initial
 *   2. Combat round par round CALCULÉ EN LOCAL avec rngSeed (déterministe)
 *   3. POST /api/boss/end-combat → envoie l'historique, serveur rejoue et valide
 *
 * Polling :
 *   - En phase 'idle' : GET /api/boss/current toutes les 15s (pour voir l'état)
 *   - En phase 'fighting' : pas de polling (combat local)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerData } from '@/lib/usePlayerData';
import { pb } from '@/api/base44Client';
import KnightSprite from '@/components/combat/KnightSprite';
import DragonSprite from '@/components/combat/DragonSprite';
import {
  createInitialCombatState,
  resolveBossRound,
  fleeCombat,
  buildFinalCombatResult,
  bossInterpGrade,
  ZONE_LABELS,
  BOSS_ZONES,
  MAX_ROUNDS,
} from '@/lib/bossCombat';
import '@/components/combat/CombatScreen.css';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────────────────────────────────────

function HpBar({ current, max, label, color = '#c1473a' }) {
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

function DuraBadge({ label, value, max = 10 }) {
  const pct = max > 0 ? value / max : 0;
  const color = pct > 0.6 ? '#5dcaa5' : pct > 0.3 ? '#ef9f27' : '#e24b4a';
  return (
    <div style={{ background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: 4, fontSize: 10, textAlign: 'center', minWidth: 60, border: '1px solid #5a4530' }}>
      <div style={{ color: '#e8d4a0' }}>{label}</div>
      <div style={{ fontWeight: 500, color }}>{value}/{max}</div>
    </div>
  );
}

function CombatLogLine({ entry }) {
  const colorMap = {
    round_start: '#fff',
    player_hit: '#5dcaa5',
    player_parry: '#378add',
    player_block: '#378add',
    player_partial_block: '#ef9f27',
    player_shield: '#378add',
    player_miss: '#a08868',
    player_armor_fail: '#888',
    player_parry_fail: '#888',
    player_shield_fail: '#888',
    boss_hit: '#e24b4a',
    boss_parry: '#ef9f27',
    boss_block: '#ef9f27',
    boss_partial_block: '#ef9f27',
    boss_shield: '#ef9f27',
    boss_miss: '#a08868',
    boss_shield_off: '#7f77dd',
    boss_shield_fail: '#888',
    boss_parry_fail: '#888',
    boss_heal: '#d4537e',
    destab: '#7f77dd',
    destab_end: '#a08868',
    drain: '#d4537e',
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
// Page principale
// ─────────────────────────────────────────────────────────────────────────────

export default function BossArenaPage({ embedded = false }) {
  const navigate = useNavigate();
  const { profile, refresh, refreshOptimistic } = usePlayerData();

  // Phase : 'idle' | 'fighting' | 'ended' | 'loading'
  const [phase, setPhase] = useState('loading');
  const [bossData, setBossData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [combatState, setCombatState] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [finalSummary, setFinalSummary] = useState(null);

  // Choix joueur pour le tour à venir
  const [attackZone, setAttackZone] = useState('torso');
  const [parryZone, setParryZone] = useState('head');
  const [shieldZone, setShieldZone] = useState('arms');

  // Ref pour scroll auto du log
  const logRef = useRef(null);

  // ─── Fetch état boss + leaderboard ────────────────────────────────────────
  const fetchBossState = useCallback(async () => {
    try {
      const res = await pb.send('/api/boss/current', { method: 'GET' });
      setBossData(res.boss);
      setLeaderboard(res.leaderboard || []);
      setErrorMsg(null);
    } catch (err) {
      console.warn('fetch boss state error:', err);
      setErrorMsg('Impossible de charger le boss');
    }
  }, []);

  useEffect(() => {
    fetchBossState().then(() => setPhase('idle'));
  }, [fetchBossState]);

  // Polling toutes les 15s en phase idle
  useEffect(() => {
    if (phase !== 'idle') return;
    const interval = setInterval(fetchBossState, 15000);
    return () => clearInterval(interval);
  }, [phase, fetchBossState]);

  // Scroll log auto
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [combatState?.log?.length]);

  // ─── Démarrer un combat ───────────────────────────────────────────────────
  const handleStartCombat = async () => {
    if (!profile) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await pb.send('/api/boss/start-combat', { method: 'POST' });
      const initial = createInitialCombatState(res.boss, res.player, { rngSeed: res.rngSeed });
      setCombatState(initial);
      setPhase('fighting');
    } catch (err) {
      let msg = 'Erreur inconnue';
      if (err.response?.error) msg = err.response.error;
      else if (err.message) msg = err.message;
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Jouer un tour ────────────────────────────────────────────────────────
  const handlePlayRound = () => {
    if (!combatState || combatState.done) return;
    if (parryZone === shieldZone) {
      setErrorMsg('La parade et le bouclier doivent être sur des zones différentes.');
      return;
    }
    setErrorMsg(null);

    // Clone state pour immutabilité (resolveBossRound mute)
    const newState = JSON.parse(JSON.stringify(combatState));
    try {
      resolveBossRound(newState, {
        attack: attackZone,
        parry: parryZone,
        shield: shieldZone,
      });
    } catch (err) {
      setErrorMsg(err.message);
      return;
    }
    setCombatState(newState);

    if (newState.done) {
      // Fin auto (KO ou kill ou timeout)
      submitFinalResult(newState);
    }
  };

  // ─── Abandonner ───────────────────────────────────────────────────────────
  const handleFlee = () => {
    if (!combatState || combatState.done) return;
    const newState = JSON.parse(JSON.stringify(combatState));
    fleeCombat(newState);
    setCombatState(newState);
    submitFinalResult(newState);
  };

  // ─── Envoie le résultat final au serveur ──────────────────────────────────
  const submitFinalResult = async (state) => {
    setSubmitting(true);
    try {
      const payload = buildFinalCombatResult(state);
      const res = await pb.send('/api/boss/end-combat', {
        method: 'POST',
        body: payload,
      });
      // Update HP joueur côté client (optimiste)
      if (refreshOptimistic) {
        refreshOptimistic({ hp: state.player.hp });
      }
      setFinalSummary({
        result: res.result,
        damageDealt: res.damageDealt,
        roundsPlayed: res.roundsPlayed,
        goldEarned: res.goldEarned,
        bossKilled: res.bossKilled,
      });
      setPhase('ended');
      // Refresh du profil complet en arrière-plan
      if (refresh) refresh();
    } catch (err) {
      let msg = 'Erreur validation serveur';
      if (err.response?.error) msg = err.response.error;
      else if (err.message) msg = err.message;
      setErrorMsg(msg + ' — combat non validé.');
      // On reste en phase 'fighting' pour permettre retry
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = () => {
    if (embedded) {
      // Mode intégré dans onglets : reset l'état interne pour revenir à idle
      setPhase('idle');
      setCombatState(null);
      setFinalSummary(null);
      setErrorMsg(null);
      fetchBossState();
    } else {
      navigate('/arene');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#a08868' }}>
        <div>Chargement du Dragon de Nuit…</div>
      </div>
    );
  }

  if (!bossData) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#a08868' }}>
        <div>Aucun boss disponible actuellement.</div>
        <button onClick={handleReturn} style={{ marginTop: 16 }}>Retour</button>
      </div>
    );
  }

  // ─── Phase IDLE ───────────────────────────────────────────────────────────
  if (phase === 'idle') {
    const alreadyAttempted = profile && (bossData.attempts_today || []).indexOf(profile.id) !== -1;
    const bossBusy = bossData.current_fighter_name && bossData.current_fighter_name !== profile?.character_name;
    const bossDead = bossData.hp_current <= 0;
    const bossWG = bossInterpGrade(bossData.hp_current, bossData.hp_max, bossData.weapon_grade_min, bossData.weapon_grade_max);
    const bossSG = bossInterpGrade(bossData.hp_current, bossData.hp_max, bossData.shield_grade_min, bossData.shield_grade_max);

    return (
      <div style={{ padding: '1rem', maxWidth: 720, margin: '0 auto' }}>
        {!embedded && (
          <h1 style={{ fontSize: 22, textAlign: 'center', marginBottom: 8, color: '#e8d4a0', fontFamily: 'serif' }}>
            ⚔️ L'arène du Dragon
          </h1>
        )}

        {/* Carte boss */}
        <div style={{
          background: 'linear-gradient(180deg, #1a0f1a 0%, #3d1818 100%)',
          borderRadius: 12,
          padding: '1.5rem 1rem',
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}>
          <DragonSprite
            hp={bossData.hp_current}
            hpMax={bossData.hp_max}
            weaponGrade={bossWG}
            shieldGrade={bossSG}
            destabilized={false}
            size={180}
          />
          <div style={{ width: '100%', maxWidth: 400 }}>
            <h2 style={{ fontFamily: 'serif', textAlign: 'center', color: '#e8d4a0', fontSize: 20, margin: '0 0 12px 0', letterSpacing: 1 }}>
              {bossData.name}
            </h2>
            <HpBar current={bossData.hp_current} max={bossData.hp_max} label="HP" color="#c1473a" />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <DuraBadge label={`Arme G${bossWG}`} value={bossData.weapon_dura} />
              <DuraBadge label={`Bouclier G${bossSG}`} value={bossData.shield_dura} />
            </div>
            {/* 17/05/2026 — Armures du boss (grade progressif selon HP) */}
            {(() => {
              // Calcul du grade armure actuel selon le palier d'HP du boss.
              // Source de vérité : BOSS_ARMOR_TIERS de bossCombat.js
              //   71-100% → G0 / 51-70% → G1 / 26-50% → G2 / 1-25% → G3
              const hpPct = bossData.hp_max > 0 ? bossData.hp_current / bossData.hp_max : 1;
              const armorG =
                hpPct >= 0.71 ? 0 :
                hpPct >= 0.51 ? 1 :
                hpPct >= 0.26 ? 2 : 3;
              return (
                <div style={{
                  display: 'flex',
                  gap: 6,
                  marginTop: 8,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}>
                  <DuraBadge label={`Tête G${armorG}`} value={bossData.armor_dura_head ?? 7} />
                  <DuraBadge label={`Torse G${armorG}`} value={bossData.armor_dura_torso ?? 7} />
                  <DuraBadge label={`Bras G${armorG}`} value={bossData.armor_dura_arms ?? 7} />
                  <DuraBadge label={`Jambes G${armorG}`} value={bossData.armor_dura_legs ?? 7} />
                </div>
              );
            })()}
          </div>
        </div>

        {/* 17/05/2026 — Panel récompenses (motivation entrée combat) */}
        <div style={{
          background: 'linear-gradient(180deg, #1a1a0f 0%, #3d3818 100%)',
          borderRadius: 8,
          padding: '12px 14px',
          marginBottom: 16,
          border: '1px solid rgba(240, 198, 64, 0.3)',
        }}>
          <h3 style={{ fontSize: 14, color: '#f0c640', margin: '0 0 10px 0', fontFamily: 'serif', textAlign: 'center', letterSpacing: 1 }}>
            🏆 Récompenses du combat
          </h3>
          <div style={{ fontSize: 12.5, color: '#e8d4a0', lineHeight: 1.7 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 16 }}>💰</span>
              <span><strong>+1 or</strong> par point de dégât infligé au boss.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 16 }}>🎁</span>
              <span><strong>+200 or bonus</strong> à <em>chaque contributeur</em> si le boss meurt aujourd'hui (peu importe le rang).</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 16 }}>⚔️</span>
              <span>1 tentative par jour, 30 tours maximum. Vous pouvez fuir à tout moment et conserver votre or.</span>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div style={{ background: '#2a1818', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, color: '#e8d4a0', margin: '0 0 8px 0', fontFamily: 'serif' }}>
              🏆 Contributeurs du jour
            </h3>
            <div style={{ fontSize: 12 }}>
              {leaderboard.slice(0, 5).map((entry, i) => (
                <div key={entry.player_id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  background: i === 0 ? 'rgba(240, 198, 64, 0.1)' : 'transparent',
                  borderRadius: 4,
                  color: i === 0 ? '#f0c640' : '#e8d4a0',
                }}>
                  <span>{i + 1}. {entry.player_name}</span>
                  <span>{entry.damage} dmg</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bouton combat ou état */}
        {bossDead ? (
          <div style={{ textAlign: 'center', padding: 16, color: '#a08868' }}>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Le boss est mort.</div>
            <div style={{ fontSize: 12, color: '#a08868' }}>
              Dernier vainqueur : <span style={{ color: '#f0c640' }}>{bossData.last_winner_name || 'inconnu'}</span>
              {bossData.last_killed_date && <span> ({bossData.last_killed_date})</span>}
            </div>
            <div style={{ fontSize: 11, color: '#a08868', marginTop: 8 }}>Un nouveau dragon apparaîtra demain matin.</div>
          </div>
        ) : alreadyAttempted ? (
          <div style={{ textAlign: 'center', padding: 16, color: '#ef9f27' }}>
            Vous avez déjà tenté le boss aujourd'hui. Revenez demain.
          </div>
        ) : bossBusy ? (
          <div style={{ textAlign: 'center', padding: 16, color: '#ef9f27' }}>
            Le boss est actuellement engagé par <strong>{bossData.current_fighter_name}</strong>.
            <div style={{ fontSize: 11, color: '#a08868', marginTop: 4 }}>Réessayez dans quelques minutes.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleStartCombat}
              disabled={submitting}
              style={{
                background: '#c1473a',
                color: '#fff3c4',
                border: 'none',
                padding: '12px 32px',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 500,
                cursor: submitting ? 'wait' : 'pointer',
                fontFamily: 'serif',
              }}
            >
              {submitting ? 'Préparation…' : '⚔️ Combattre le dragon'}
            </button>
            {!embedded && (
              <button
                onClick={handleReturn}
                style={{
                  background: 'transparent',
                  color: '#a08868',
                  border: '1px solid #5a4530',
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Retour à l'Arène
              </button>
            )}
          </div>
        )}

        {errorMsg && (
          <div style={{ marginTop: 12, color: '#e24b4a', textAlign: 'center', fontSize: 12 }}>{errorMsg}</div>
        )}
      </div>
    );
  }

  // ─── Phase FIGHTING ───────────────────────────────────────────────────────
  if (phase === 'fighting' && combatState) {
    const p = combatState.player;
    const b = combatState.boss;
    const bossWG = bossInterpGrade(b.hp, b.hpMax, b.weaponGradeMin, b.weaponGradeMax);
    const bossSG = bossInterpGrade(b.hp, b.hpMax, b.shieldGradeMin, b.shieldGradeMax);

    return (
      <div style={{ padding: '0.5rem', maxWidth: 720, margin: '0 auto' }}>
        {/* Header : HP boss */}
        <div style={{
          background: 'linear-gradient(180deg, #1a0f1a 0%, #3d1818 100%)',
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ color: '#e8d4a0', fontFamily: 'serif', fontWeight: 500 }}>
              {b.name}
              {b.destabRoundsLeft > 0 && <span style={{ color: '#ff3a1a', fontSize: 11, marginLeft: 8 }}>(déstabilisé {b.destabRoundsLeft}t)</span>}
            </span>
            <span style={{ fontSize: 11, color: '#a08868' }}>Tour {combatState.round + 1} / {MAX_ROUNDS}</span>
          </div>
          <HpBar current={b.hp} max={b.hpMax} label="HP boss" color="#c1473a" />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'center' }}>
            <DuraBadge label={`Arme G${bossWG}`} value={b.weaponDura} />
            <DuraBadge label={`Bouclier G${bossSG}`} value={b.shieldDura} />
          </div>
        </div>

        {/* Arène */}
        <div className="cs-arena" style={{ background: 'rgba(0,0,0,0.04)', marginBottom: 8 }}>
          <div className="cs-fighter">
            <KnightSprite profile={profile} size={80} />
          </div>
          <div className="cs-monsters-row">
            <div className="cs-monster-slot">
              <DragonSprite
                hp={b.hp}
                hpMax={b.hpMax}
                weaponGrade={bossWG}
                shieldGrade={bossSG}
                destabilized={b.destabRoundsLeft > 0}
                size={140}
              />
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
        {!combatState.done && (
          <div style={{ background: '#1a0808', borderRadius: 6, padding: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: '#a08868', marginBottom: 6 }}>Choisissez votre tactique :</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: '#a08868', display: 'block', marginBottom: 2 }}>Attaque</label>
                <select value={attackZone} onChange={(e) => setAttackZone(e.target.value)} style={{ width: '100%', padding: 4, background: '#2a1818', color: '#e8d4a0', border: '1px solid #5a4530', borderRadius: 4 }}>
                  {BOSS_ZONES.map(z => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#a08868', display: 'block', marginBottom: 2 }}>Parade</label>
                <select value={parryZone} onChange={(e) => setParryZone(e.target.value)} style={{ width: '100%', padding: 4, background: '#2a1818', color: '#e8d4a0', border: '1px solid #5a4530', borderRadius: 4 }}>
                  {BOSS_ZONES.map(z => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#a08868', display: 'block', marginBottom: 2 }}>Bouclier</label>
                <select value={shieldZone} onChange={(e) => setShieldZone(e.target.value)} style={{ width: '100%', padding: 4, background: '#2a1818', color: '#e8d4a0', border: '1px solid #5a4530', borderRadius: 4 }}>
                  {BOSS_ZONES.map(z => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}
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
                onClick={handleFlee}
                disabled={submitting}
                style={{ flex: 1, background: 'transparent', color: '#a08868', border: '1px solid #5a4530', padding: '8px 12px', borderRadius: 6, cursor: 'pointer' }}
              >
                🏃 Abandonner et valider mes dégâts
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
          {combatState.log.map((entry, i) => (
            <CombatLogLine key={i} entry={entry} />
          ))}
        </div>

        {errorMsg && (
          <div style={{ marginTop: 8, color: '#e24b4a', textAlign: 'center', fontSize: 12 }}>{errorMsg}</div>
        )}
      </div>
    );
  }

  // ─── Phase ENDED ──────────────────────────────────────────────────────────
  if (phase === 'ended' && finalSummary) {
    const isVictory = finalSummary.bossKilled;
    return (
      <div style={{ padding: '2rem', maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          background: isVictory ? 'linear-gradient(180deg, #3d3318 0%, #1a1208 100%)' : '#2a1818',
          borderRadius: 12,
          padding: '2rem 1rem',
        }}>
          <h2 style={{ fontFamily: 'serif', color: isVictory ? '#f0c640' : '#e24b4a', fontSize: 24, marginBottom: 16 }}>
            {isVictory ? '🏆 Victoire !' : finalSummary.result === 'ko' ? '☠️ Vous êtes vaincu' : finalSummary.result === 'flee' ? '🏃 Retraite' : '⏰ Combat trop long'}
          </h2>
          <div style={{ color: '#e8d4a0', fontSize: 14, lineHeight: 1.7 }}>
            <div>Dégâts infligés : <strong>{finalSummary.damageDealt}</strong></div>
            <div>Tours combattus : <strong>{finalSummary.roundsPlayed}</strong></div>
            <div>Or gagné : <strong>{finalSummary.goldEarned} 💰</strong></div>
            {isVictory && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#f0c640' }}>
                <div>+ 300 XP</div>
                <div>+ 50 or bonus</div>
                <div>+ 10 jetons de guilde</div>
              </div>
            )}
          </div>
          <button
            onClick={handleReturn}
            style={{
              marginTop: 20,
              background: '#5a4530',
              color: '#fff3c4',
              border: 'none',
              padding: '8px 24px',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {embedded ? 'Voir le boss' : 'Retour à l\'Arène'}
          </button>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <button onClick={handleReturn}>Retour</button>
    </div>
  );
}
