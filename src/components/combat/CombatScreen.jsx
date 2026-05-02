/**
 * src/components/combat/CombatScreen.jsx — V2 mécanique B (défense par mob)
 *
 * Le joueur défend chaque mob individuellement (wizard séquentiel) :
 *   1. Phase intro : présentation du combat
 *   2. Phase fighting : pour chaque mob (1, 2, 3) le jeu demande la zone à défendre
 *      (épée + bouclier optionnel). Le joueur enchaîne les choix mob par mob.
 *      Quand tous les mobs ont été traités, on résout le tour.
 *   3. Phase counter : ciblage des contre-attaques (1 par parade réussie)
 *   4. Phase ended : récap final (or, drop)
 *
 * Mobile-first : un seul mob actif à la fois, plein écran.
 *
 * Pas de PocketBase ici (Phase 3) — tout en mémoire React.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import KnightSprite from "./KnightSprite";
import MonsterSprite from "./MonsterSprite";
import {
  createInitialWaveState,
  resolveDefense,
  applyCounters,
  fleeWave,
  getMonsterEffectiveGrade,
  computeWaveRewards,
  getPlayerMaxHP,
  getAliveMonsters,
  isWaveComplete,
  isPlayerExhausted,
  isFled,
  isOutOfTurns,
  isDead,
  describeIntent,
  describePattern,
  getCombatItemValue,
  MONSTERS_PER_WAVE,
  MAX_TURNS_PER_WAVE,
} from "@/lib/combatPvE";
import { COMBAT_MAX_HP, getPlayerHP, isPlayerKO } from "@/lib/gameData";
import { ITEMS } from "@/lib/craftingData";
import "./CombatScreen.css";

const ZONE_META = {
  head:  { label: "Tête",   icon: "🪖" },
  torso: { label: "Torse",  icon: "🛡️" },
  arms:  { label: "Bras",   icon: "🤜" },
  legs:  { label: "Jambes", icon: "🦵" },
};

const BIOME_NAMES = {
  foret:   { name: "Forêt ancestrale", icon: "🌲" },
  champs:  { name: "Champs dorés",     icon: "🌾" },
  mine:    { name: "Mines profondes",  icon: "⛏️" },
  atelier: { name: "Atelier",          icon: "🧵" },
  forge:   { name: "Forge",            icon: "🔥" },
  guilde:  { name: "Guilde",           icon: "🏛️" },
};

const wait = (ms) => new Promise(r => setTimeout(r, ms));

export default function CombatScreen({
  profile,
  biomeKey,
  waveIndex = 0,
  dayStr,
  biomeRareKey,
  onComplete,
  onCancel,
  epicMode = false,        // Mode épopée : permet de tomber à 0 PV (status "dead")
  skipIntro = false,       // En mode épopée, l'orchestrateur gère son propre intro global
  startingHP = null,       // HP de départ (forcé) pour l'épopée — sinon = profile.hp
}) {
  const [phase, setPhase] = useState(skipIntro ? "fighting" : "intro");
  const [state, setState] = useState(null);
  const [logMsg, setLogMsg] = useState("Prêt au combat.");
  const [busy, setBusy] = useState(false);
  // Copie locale du profil pour refléter les soins pré-combat (cataplasme).
  // Sera utilisée pour HP affichés et pour createInitialWaveState.
  const [localProfile, setLocalProfile] = useState(profile);

  // Phase fighting : wizard séquentiel.
  // - mobChoiceIndex : index dans la liste des mobs vivants (0, 1, 2…)
  // - mobDefenses    : { [monsterIdx]: { primaryZone, shieldZone } } accumulé
  const [mobChoiceIndex, setMobChoiceIndex] = useState(0);
  const [mobDefenses, setMobDefenses] = useState({});

  // Phase counter
  const [counterTargets, setCounterTargets] = useState([]);

  const [confirmFlee, setConfirmFlee] = useState(false);
  const [rewards, setRewards] = useState(null);
  const [shake, setShake] = useState(false);
  const [popups, setPopups] = useState([]);

  const popupCounter = useRef(0);

  const hasShield = !!profile?.equipment?.shield;
  const shieldGrade = profile?.equipment?.shield?.grade ?? 0;

  // Init au montage
  useEffect(() => {
    const initState = createInitialWaveState({
      profile,
      biomeKey,
      waveIndex,
      dayStr,
      startingHP: startingHP != null ? startingHP : profile?.hp,
      epicMode,
    });
    setState(initState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helpers anim
  const showPopup = useCallback((side, value, type = "") => {
    const id = ++popupCounter.current;
    setPopups(prev => [...prev, { id, side, value, type }]);
    setTimeout(() => setPopups(prev => prev.filter(p => p.id !== id)), 900);
  }, []);

  // Démarrer le combat
  const handleStart = () => {
    // Recalcul du state avec les HP à jour (au cas où on aurait soigné en pré-combat)
    const freshState = createInitialWaveState({
      profile: localProfile,
      biomeKey,
      waveIndex,
      dayStr,
      startingHP: localProfile?.hp,
      epicMode,
    });
    setState(freshState);
    setPhase("fighting");
    setLogMsg("Que la valeur soit avec vous.");
    setMobChoiceIndex(0);
    setMobDefenses({});
  };

  // Pré-combat : consommer un cataplasme (+5 PV)
  const handleUseCataplasme = async () => {
    if (busy) return;
    if (isPlayerKO(localProfile)) {
      toast.error("Vous êtes KO, le cataplasme ne peut pas vous soigner.");
      return;
    }
    const currentHp = getPlayerHP(localProfile);
    if (currentHp >= COMBAT_MAX_HP) {
      toast.info("Vos PV sont déjà au maximum.");
      return;
    }
    const inv = localProfile.inventory || [];
    const cataItem = inv.find(i => i.item_key === "cataplasme" && (i.quantity || 0) > 0);
    if (!cataItem) {
      toast.error("Vous n'avez pas de cataplasme.");
      return;
    }
    setBusy(true);
    try {
      const cataDef = ITEMS["cataplasme"];
      const newHp = Math.min(COMBAT_MAX_HP, currentHp + (cataDef?.value || 5));
      // Décrémente l'inventaire
      const newInventory = inv.map(i => {
        if (i.item_key !== "cataplasme") return i;
        return { ...i, quantity: (i.quantity || 0) - 1 };
      }).filter(i => (i.quantity || 0) > 0);
      const updates = { hp: newHp, inventory: newInventory };
      await base44.entities.PlayerProfile.update(localProfile.id, updates);
      setLocalProfile(prev => ({ ...prev, ...updates }));
      toast.success(`🩹 +${newHp - currentHp}❤️ (${newHp}/${COMBAT_MAX_HP})`);
    } catch (e) {
      console.error("Cataplasme error:", e);
      toast.error("Erreur lors de l'application du cataplasme.");
    } finally {
      setBusy(false);
    }
  };

  // ── Phase fighting : gestion du wizard ──

  const aliveIdx = state ? getAliveMonsters(state) : [];
  const currentMobIdx = aliveIdx[mobChoiceIndex] ?? null;
  const currentMob = currentMobIdx != null ? state.monsters[currentMobIdx] : null;
  const currentIntent = currentMobIdx != null ? state.intents[currentMobIdx] : null;
  const currentChoice = currentMobIdx != null ? mobDefenses[currentMobIdx] || {} : {};

  const handlePickPrimary = (zone) => {
    if (busy || currentMobIdx == null) return;
    const prev = mobDefenses[currentMobIdx] || {};
    let newShield = prev.shieldZone;
    if (newShield === zone) newShield = null; // si on remplace shield par primary
    setMobDefenses({
      ...mobDefenses,
      [currentMobIdx]: { primaryZone: zone, shieldZone: newShield || null },
    });
  };

  const handlePickShield = (zone) => {
    if (busy || currentMobIdx == null || !hasShield) return;
    const prev = mobDefenses[currentMobIdx] || {};
    if (prev.primaryZone === zone) return; // ne peut pas être même que primary
    const newShield = prev.shieldZone === zone ? null : zone;
    setMobDefenses({
      ...mobDefenses,
      [currentMobIdx]: { primaryZone: prev.primaryZone || null, shieldZone: newShield },
    });
  };

  const handleNextMob = () => {
    if (busy || currentMobIdx == null) return;
    if (!currentChoice.primaryZone) return; // doit choisir au moins une zone épée
    if (mobChoiceIndex < aliveIdx.length - 1) {
      setMobChoiceIndex(mobChoiceIndex + 1);
    } else {
      // Tous les mobs traités → résoudre le tour
      handleValidateAllDefenses();
    }
  };

  const handlePrevMob = () => {
    if (busy || mobChoiceIndex === 0) return;
    setMobChoiceIndex(mobChoiceIndex - 1);
  };

  const handleValidateAllDefenses = async () => {
    if (busy || !state) return;
    setBusy(true);

    const action = { type: "defend", defenses: mobDefenses };
    const newState = resolveDefense(state, profile, action);

    // Animations
    const lastTurn = newState.log[newState.log.length - 1];
    if (lastTurn) {
      let totalDmg = 0;
      for (const hit of lastTurn.hits || []) {
        if (hit.dmg > 0) {
          totalDmg += hit.dmg;
          showPopup("left", `-${hit.dmg}`);
        } else if (hit.defenseType === "shielded") {
          showPopup("left", "🛡️", "shield");
        } else if (hit.defenseType === "armor_absorbed") {
          showPopup("left", "0", "zero");
        }
      }
      for (const _parry of lastTurn.parries || []) {
        showPopup("left", "PARÉ", "parry");
      }
      if (totalDmg > 0) {
        setShake(true);
        setTimeout(() => setShake(false), 300);
      }
    }

    await wait(500);
    setState(newState);

    // Reset wizard pour le prochain tour
    setMobChoiceIndex(0);
    setMobDefenses({});

    if (newState.pendingCounter && newState.status === "in_progress") {
      setPhase("counter");
      setCounterTargets([]);
      setLogMsg(`${newState.pendingCounter.availableCounters} parade(s) — choisissez vos cibles !`);
      setBusy(false);
      return;
    }

    if (isWaveComplete(newState)) {
      finishWave(newState);
      return;
    }
    if (isDead(newState)) {
      setLogMsg("💀 Vous êtes tombé au combat...");
      await wait(1200);
      finishWave(newState);
      return;
    }
    if (isPlayerExhausted(newState)) {
      setLogMsg("Vous êtes à bout de forces. Repli forcé.");
      await wait(800);
      finishWave(newState);
      return;
    }
    if (isOutOfTurns(newState)) {
      setLogMsg(`Vague trop longue ! Limite de ${MAX_TURNS_PER_WAVE} tours atteinte.`);
      await wait(1000);
      finishWave(newState);
      return;
    }

    setLogMsg(buildTurnLog(newState));
    setBusy(false);
  };

  // ── Phase counter ──

  const handleSelectCounter = (mobIdx) => {
    if (busy || !state || !state.pendingCounter) return;
    const remaining = state.pendingCounter.availableCounters - counterTargets.length;
    if (remaining <= 0) return;
    const m = state.monsters[mobIdx];
    if (!m || !m.alive) return;
    setCounterTargets(prev => [...prev, mobIdx]);
  };

  const handleResetCounter = () => {
    if (busy) return;
    setCounterTargets([]);
  };

  const handleValidateCounter = async () => {
    if (busy || !state || !state.pendingCounter) return;
    if (counterTargets.length !== state.pendingCounter.availableCounters) return;
    setBusy(true);

    const counterDmg = profile?.equipment?.weapon
      ? getCombatItemValue(profile.equipment.weapon.grade)
      : 1;
    for (const _idx of counterTargets) {
      showPopup("right", `-${counterDmg}`);
    }
    setShake(true);
    await wait(400);
    setShake(false);

    const newState = applyCounters(state, profile, counterTargets);
    setState(newState);
    setCounterTargets([]);

    if (isWaveComplete(newState)) {
      finishWave(newState);
      return;
    }
    if (isDead(newState)) {
      setLogMsg("💀 Vous êtes tombé au combat...");
      await wait(1200);
      finishWave(newState);
      return;
    }
    if (isPlayerExhausted(newState)) {
      finishWave(newState);
      return;
    }
    if (isOutOfTurns(newState)) {
      setLogMsg(`Vague trop longue ! Limite de ${MAX_TURNS_PER_WAVE} tours atteinte.`);
      await wait(1000);
      finishWave(newState);
      return;
    }

    setPhase("fighting");
    setMobChoiceIndex(0);
    setMobDefenses({});
    setLogMsg(buildTurnLog(newState));
    setBusy(false);
  };

  // ── Fuite ──

  const handleFleeRequest = () => { if (!busy) setConfirmFlee(true); };
  const handleFleeConfirm = () => {
    setConfirmFlee(false);
    if (!state) return;
    const newState = fleeWave(state);
    setState(newState);
    setLogMsg("🏃 Repli effectué.");
    finishWave(newState);
  };

  const finishWave = (finalState) => {
    const r = computeWaveRewards(finalState, profile, biomeKey, biomeRareKey);
    setRewards(r);
    setState(finalState);
    setBusy(false);
    if (epicMode) {
      // En mode épopée, on remonte immédiatement au parent (CombatEpic)
      // qui décide de la transition (vague suivante / soin / fin).
      if (onComplete) onComplete(r, finalState);
      return;
    }
    setPhase("ended");
  };

  const handleEnd = () => {
    if (onComplete) onComplete(rewards, state);
  };

  // ─────────────────────────────────────────────────────────
  // Rendu
  // ─────────────────────────────────────────────────────────

  if (!state) {
    return (
      <Card className="bg-card">
        <CardContent className="p-6 text-center text-muted-foreground font-body">
          Préparation du combat...
        </CardContent>
      </Card>
    );
  }

  const biomeInfo = BIOME_NAMES[biomeKey] || { name: biomeKey, icon: "🗺️" };
  const playerMaxHP = getPlayerMaxHP(profile, biomeKey);
  const counterDmg = profile?.equipment?.weapon
    ? getCombatItemValue(profile.equipment.weapon.grade)
    : 1;

  // ── PHASE INTRO ──
  if (phase === "intro") {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-heading">{biomeInfo.icon} {biomeInfo.name}</h2>
            <p className="text-sm text-muted-foreground font-body">
              Vague {waveIndex + 1} — 3 monstres vous attendent.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm font-body text-amber-900 space-y-2">
            <p className="font-semibold">⚔️ Mécanique du combat tactique</p>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li>Chaque tour, vous défendrez contre les 3 mobs <strong>un par un</strong>.</li>
              <li>Pour chaque mob : choisissez la zone à parer avec votre épée.</li>
              <li>Bonne zone + armure suffisante = <strong>parade + contre ({counterDmg} dégâts)</strong></li>
              {hasShield && <li>Avec votre bouclier (G{shieldGrade}) : protégez en plus une 2e zone par mob (+{1 + shieldGrade} def).</li>}
              <li>Indice fiable à 100% si mob full HP, devient flou ensuite.</li>
              <li>Mob ≤ 60% HP → <strong>enragé (+1 grade)</strong></li>
            </ul>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-body space-y-1">
            <p>❤️ Vos PV : <strong>{localProfile?.hp ?? playerMaxHP}/{playerMaxHP}</strong></p>
            <p>🗡️ Contre-attaque : <strong>{counterDmg} dégâts</strong> par parade</p>
            <p>🛡️ Bouclier : {hasShield
              ? <strong className="text-emerald-700">équipé G{shieldGrade}</strong>
              : <span className="text-muted-foreground">non équipé</span>}</p>
          </div>

          {/* Bouton cataplasme : visible uniquement si on en a un et qu'on n'est pas full HP */}
          {(() => {
            const cataItem = (localProfile?.inventory || []).find(i => i.item_key === "cataplasme" && (i.quantity || 0) > 0);
            const hpNow = getPlayerHP(localProfile);
            const canHeal = cataItem && hpNow < COMBAT_MAX_HP && !isPlayerKO(localProfile);
            if (!cataItem) return null;
            return (
              <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-lg">🩹</span>
                <span className="text-xs font-body text-rose-900 flex-1">
                  Cataplasme disponible (×{cataItem.quantity}) : soigne +5❤️
                </span>
                <Button
                  onClick={handleUseCataplasme}
                  disabled={!canHeal || busy}
                  size="sm"
                  variant="outline"
                  className="text-xs font-body bg-white"
                >
                  {hpNow >= COMBAT_MAX_HP ? "PV au max" : "Utiliser"}
                </Button>
              </div>
            );
          })()}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleStart} className="font-heading flex-1">⚔️ Entrer dans la mêlée</Button>
            {onCancel && (
              <Button onClick={onCancel} variant="outline" className="font-body">Annuler</Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── PHASE ENDED ──
  if (phase === "ended") {
    const isFull = rewards?.label === "full";
    const isNothing = rewards?.label === "no_kill";
    const isFleeOrExh = isFled(state) || isPlayerExhausted(state);

    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-4 text-center">
          <h2 className="text-2xl font-heading">
            {isFull ? "🏆 Vague terminée !"
              : isOutOfTurns(state) ? "⏱️ Trop long !"
              : isFleeOrExh ? (isPlayerExhausted(state) ? "⚡ Épuisement" : "🏃 Repli effectué")
              : "Combat fini"}
          </h2>
          <p className="text-sm font-body text-muted-foreground">
            {state.monstersKilled}/{MONSTERS_PER_WAVE} monstre{state.monstersKilled > 1 ? "s" : ""} vaincu{state.monstersKilled > 1 ? "s" : ""}
            {isOutOfTurns(state) && ` — limite de ${MAX_TURNS_PER_WAVE} tours atteinte`}
          </p>

          {!isNothing && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-left text-sm font-body space-y-2 text-emerald-900">
              <p className="font-semibold mb-2">Récompenses obtenues :</p>
              {rewards.goldStolen > 0 ? (
                <p>
                  💰 <strong>+{rewards.gold} or</strong>
                  <span className="text-amber-800 text-xs"> (brut {rewards.goldGross}, dérobé {rewards.goldStolen}💰 par les voleurs)</span>
                </p>
              ) : (
                <p>💰 <strong>+{rewards.gold} or</strong></p>
              )}
              {rewards.dropCount > 0 && (
                <p>✨ <strong>+{rewards.dropCount} ressource{rewards.dropCount > 1 ? "s" : ""} rare{rewards.dropCount > 1 ? "s" : ""}</strong> ({biomeRareKey})</p>
              )}
              <p>⭐ +{rewards.masteryGain} maîtrise</p>
              {rewards.dropCount === 0 && (
                <p className="text-emerald-700/70 text-xs italic">Pas de drop rare cette fois.</p>
              )}
            </div>
          )}

          {isNothing && (
            <div className="bg-muted/40 border border-border rounded-lg p-4 text-sm font-body text-muted-foreground">
              Aucun monstre vaincu — pas de récompense.
            </div>
          )}

          <Button onClick={handleEnd} className="w-full font-heading">Retour au biome</Button>
        </CardContent>
      </Card>
    );
  }

  // ── PHASE FIGHTING ou COUNTER ──
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Header */}
        <div className="flex justify-between items-center text-xs font-body text-muted-foreground">
          <span>{biomeInfo.icon} {biomeInfo.name} — Vague {waveIndex + 1}</span>
          <span>Tour {state.turnIndex + 1}/{MAX_TURNS_PER_WAVE}</span>
        </div>

        {/* Arène compacte */}
        <div className={`cs-arena ${shake ? "cs-shaking" : ""}`}>
          <div className="cs-fighter">
            <KnightSprite profile={profile} size={64} />
          </div>

          <div className="cs-monsters-row">
            {state.monsters.map((m, idx) => {
              const isAlive = m.alive && m.hp > 0;
              const eff = getMonsterEffectiveGrade(m);
              const counterCount = counterTargets.filter(t => t === idx).length;
              const isCurrent = phase === "fighting" && currentMobIdx === idx;
              return (
                <div
                  key={idx}
                  className={`cs-monster-slot ${isAlive ? "" : "cs-monster-dead"} ${
                    phase === "counter" && isAlive ? "cs-monster-clickable" : ""
                  } ${isCurrent ? "cs-monster-current" : ""}`}
                  onClick={() => phase === "counter" && handleSelectCounter(idx)}
                >
                  {isAlive && <MonsterSprite name={m.name} size={64} />}
                  {!isAlive && <span className="cs-mob-skull">💀</span>}
                  {isAlive && eff.enraged && (
                    <span className="cs-rage-badge">😡 G{eff.grade}</span>
                  )}
                  {isAlive && (
                    <div className="cs-mob-hp">
                      <div className="cs-mob-hp-bar">
                        <div
                          className={`cs-mob-hp-fill ${eff.enraged ? "cs-rage" : ""}`}
                          style={{ width: `${Math.max(0, (m.hp / m.hpMax) * 100)}%` }}
                        />
                      </div>
                      <span className="cs-mob-hp-text">{m.hp}/{m.hpMax}</span>
                    </div>
                  )}
                  {phase === "counter" && counterCount > 0 && (
                    <span className="cs-counter-badge">×{counterCount}</span>
                  )}
                </div>
              );
            })}
          </div>

          {popups.map(p => (
            <span
              key={p.id}
              className={`cs-damage-popup ${p.type ? `cs-${p.type}` : ""}`}
              style={{ left: p.side === "left" ? "20%" : "auto", right: p.side === "right" ? "20%" : "auto" }}
            >
              {p.value}
            </span>
          ))}
        </div>

        {/* PV joueur */}
        <div className="flex items-center gap-2 text-xs font-body bg-red-50 border border-red-200 rounded-lg px-2 py-1">
          <span className="text-muted-foreground">❤️</span>
          <div className="flex-1 bg-red-200 rounded-full h-2 overflow-hidden">
            <div className="bg-red-500 h-full transition-all"
              style={{ width: `${(state.playerHP / playerMaxHP) * 100}%` }} />
          </div>
          <span className="font-semibold text-red-900">{state.playerHP}/{playerMaxHP}</span>
        </div>

        {/* PHASE FIGHTING : wizard mob par mob */}
        {phase === "fighting" && currentMob && currentIntent && (
          <>
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 font-heading">
                <span className="text-2xl">{currentMob.icon}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">
                    Comment se protéger contre <strong>{currentMob.name}</strong> ?
                  </p>
                  <p className="text-xs font-body text-amber-900 italic">
                    {describeIntent(currentMob, currentIntent)}
                  </p>
                </div>
                <span className="text-xs font-body text-muted-foreground">
                  {mobChoiceIndex + 1}/{aliveIdx.length}
                </span>
              </div>

              {/* Pattern spécial du mob */}
              {(() => {
                const pat = describePattern(currentMob.pattern);
                if (!pat) return null;
                return (
                  <div className="bg-purple-50 border border-purple-300 rounded px-2 py-1 text-xs font-body">
                    <span className="text-base mr-1">{pat.icon}</span>
                    <strong className="text-purple-900">{pat.label}</strong>
                    <span className="text-purple-800"> — {pat.desc}</span>
                  </div>
                );
              })()}

              {/* Sélection zone épée */}
              <div className="space-y-1">
                <p className="text-xs font-body font-semibold text-blue-900">⚔️ Parade épée :</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {["head", "torso", "arms", "legs"].map(z => {
                    const isSelected = currentChoice.primaryZone === z;
                    return (
                      <Button
                        key={`p-${z}`}
                        onClick={() => handlePickPrimary(z)}
                        disabled={busy}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className={`flex flex-col h-auto py-2 text-xs font-body ${
                          isSelected ? "ring-2 ring-blue-500 bg-blue-600 text-white" : ""
                        }`}
                      >
                        <span className="text-base mb-0.5">{ZONE_META[z].icon}</span>
                        <span>{ZONE_META[z].label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Sélection zone bouclier (si bouclier équipé) */}
              {hasShield && (
                <div className="space-y-1">
                  <p className="text-xs font-body font-semibold text-sky-900">
                    🛡️ Bouclier (G{shieldGrade}, +{1 + shieldGrade} def — optionnel) :
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {["head", "torso", "arms", "legs"].map(z => {
                      const isSelected = currentChoice.shieldZone === z;
                      const isPrimary = currentChoice.primaryZone === z;
                      return (
                        <Button
                          key={`s-${z}`}
                          onClick={() => handlePickShield(z)}
                          disabled={busy || isPrimary}
                          variant={isSelected ? "secondary" : "outline"}
                          size="sm"
                          className={`flex flex-col h-auto py-2 text-xs font-body ${
                            isSelected ? "ring-2 ring-sky-500 bg-sky-100" : ""
                          } ${isPrimary ? "opacity-30 cursor-not-allowed" : ""}`}
                        >
                          <span className="text-base mb-0.5">{ZONE_META[z].icon}</span>
                          <span>{ZONE_META[z].label}</span>
                        </Button>
                      );
                    })}
                  </div>
                  {currentChoice.shieldZone && (
                    <Button onClick={() => handlePickShield(currentChoice.shieldZone)}
                      variant="ghost" size="sm" className="text-xs h-6 px-2 text-sky-700">
                      ✕ Retirer le bouclier de ce mob
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Navigation wizard */}
            <div className="flex gap-2">
              {mobChoiceIndex > 0 && (
                <Button onClick={handlePrevMob} disabled={busy} variant="outline" size="sm" className="font-body">
                  ← Mob précédent
                </Button>
              )}
              <Button
                onClick={handleNextMob}
                disabled={busy || !currentChoice.primaryZone}
                className="flex-1 font-heading bg-blue-600 hover:bg-blue-700 text-white"
              >
                {mobChoiceIndex < aliveIdx.length - 1
                  ? `Mob suivant →`
                  : `🛡️ Valider toutes les défenses`}
              </Button>
            </div>

            {/* Résumé compact des choix précédents */}
            {Object.keys(mobDefenses).length > 0 && (
              <div className="text-xs font-body text-muted-foreground bg-slate-50 rounded p-2 space-y-0.5">
                <p className="font-semibold">Choix actuels :</p>
                {aliveIdx.map((idx, i) => {
                  const def = mobDefenses[idx];
                  if (!def || !def.primaryZone) return null;
                  const m = state.monsters[idx];
                  return (
                    <p key={idx}>
                      {i === mobChoiceIndex ? "▶ " : "  "}
                      {m.icon} {m.name} : épée {ZONE_META[def.primaryZone].label}
                      {def.shieldZone && ` + bouclier ${ZONE_META[def.shieldZone].label}`}
                    </p>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* PHASE COUNTER */}
        {phase === "counter" && state.pendingCounter && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm font-body text-emerald-900">
              <p className="font-semibold">⚔️ Contre-attaques !</p>
              <p className="text-xs mt-1">
                {counterTargets.length}/{state.pendingCounter.availableCounters} cibles choisies — tapez sur les monstres ci-dessus pour cibler vos coups ({counterDmg} dégâts par contre).
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleResetCounter} disabled={busy || counterTargets.length === 0}
                variant="outline" size="sm" className="flex-1 font-body">
                ↺ Réinitialiser
              </Button>
              <Button onClick={handleValidateCounter}
                disabled={busy || counterTargets.length !== state.pendingCounter.availableCounters}
                className="flex-1 font-heading bg-emerald-600 hover:bg-emerald-700 text-white">
                ✓ Valider les contres
              </Button>
            </div>
          </>
        )}

        {/* Fuite */}
        {phase === "fighting" && (
          !confirmFlee ? (
            <Button onClick={handleFleeRequest} disabled={busy}
              variant="ghost" size="sm"
              className="w-full text-xs font-body text-muted-foreground border border-dashed border-border">
              🏃 Fuir le combat
            </Button>
          ) : (
            <div className="flex gap-2 bg-amber-50 border border-amber-300 rounded-lg p-2">
              <span className="text-xs font-body flex-1 text-amber-900 self-center">Vraiment fuir ?</span>
              <Button onClick={handleFleeConfirm} size="sm" variant="destructive" className="text-xs">Oui, fuir</Button>
              <Button onClick={() => setConfirmFlee(false)} size="sm" variant="outline" className="text-xs">Non</Button>
            </div>
          )
        )}

        <div className="text-xs font-body italic text-center text-muted-foreground min-h-5 pt-1">
          {logMsg}
        </div>
      </CardContent>
    </Card>
  );
}

// Helpers
function buildTurnLog(state) {
  const last = state.log[state.log.length - 1];
  if (!last) return `Tour ${state.turnIndex + 1}`;
  if (last.action === "counter") {
    const dmg = (last.counters || []).reduce((s, c) => s + c.dmg, 0);
    return `Contre porté pour ${dmg} dégâts.`;
  }
  if (last.action === "defend") {
    const parries = (last.parries || []).length;
    const hits = (last.hits || []).filter(h => h.dmg > 0).length;
    if (parries > 0 && hits > 0) return `${parries} parade(s) · ${hits} coup(s) encaissé(s)`;
    if (parries > 0) return `${parries} parade(s) réussie(s) !`;
    if (hits > 0) return `${hits} coup(s) encaissé(s)...`;
    return `Aucun dégât échangé`;
  }
  return `Tour ${state.turnIndex + 1}`;
}
