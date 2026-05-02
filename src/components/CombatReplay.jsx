/**
 * CombatReplay : rejoue les jets de dé d'un défi V6 résolu en animation.
 *
 * Branché sur les champs présents dans la collection combat_challenges :
 *  - attack_zone, defense_zone, shield_zone
 *  - parry_attempted, parry_succeeded
 *  - attack_roll_succeeded
 *  - defense_roll_succeeded
 *  - shield_attempted, shield_succeeded
 *  - result (parried / attack_missed / attacker_won / defender_won)
 *  - damage_dealt, gold_stolen
 *
 * Le composant est purement cosmétique : il rejoue ce qui s'est passé côté
 * serveur sans aucune décision propre. Le résultat affiché est celui stocké
 * en base.
 *
 * Trois phases narrées séquentiellement, séparées par des pauses dramatiques :
 *  1. Phase parade (si parry_attempted)
 *  2. Phase attaque (jet d'épée de l'attaquant)
 *  3. Phase défense (blocage par armure + bouclier optionnel)
 *
 * Mode auto-show : on retient dans localStorage les défis déjà visionnés,
 * pour ne pas rejouer l'animation deux fois au même joueur.
 */

import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sword, Shield } from "lucide-react";

const ZONE_LABEL = { head: "Tête", torso: "Torse", arms: "Bras", legs: "Jambes" };

// Helpers locaux pour l'animation des dés.

/** Hash déterministe simple d'une chaîne, retourne un entier 0..2^32. */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

/** Convertit une graine en valeur de dé cohérente avec le succès.
 *  Si success → tire entre 1 et 80 (jets bas = bons jets sous le seuil).
 *  Si échec → tire entre 21 et 100 (jets hauts = mauvais jets au-dessus).
 *  Note : ce ne sont pas les vrais jets serveur (qu'on ne stocke pas en clair),
 *  c'est juste pour rendre l'animation crédible. Mais c'est DÉTERMINISTE :
 *  pour un même défi et une même phase, on retombe toujours sur la même valeur. */
function rollFinalValue(success, seed) {
  const h = hashString(seed || "default");
  if (success) return 1 + (h % 80);
  return 21 + (h % 80);
}

/** Composant Dé : affiche un cube qui roule pendant rollMs millisecondes,
 *  puis se fige sur finalValue. La couleur reflète le succès.
 *
 *  V6.1.3 — Mode interactif : si waitForClick=true, le dé reste figé sur "?"
 *  et attend que l'utilisateur clique dessus pour rouler. Sert à donner
 *  un moment d'agentivité au joueur pour ses propres jets (en live, pas
 *  en rediffusion). */
function RollingDie({ finalValue, success, label, rollMs = 2000, waitForClick = false, onRollComplete }) {
  const [displayValue, setDisplayValue] = useState(waitForClick ? "?" : 0);
  const [phase, setPhase] = useState(waitForClick ? "waiting" : "rolling"); // "waiting" | "rolling" | "done"

  // Lance l'animation de roulement
  const startRoll = () => {
    if (phase !== "waiting") return;
    setPhase("rolling");
  };

  // Effet d'animation : tourne pendant rollMs, puis se fige sur finalValue
  useEffect(() => {
    if (phase !== "rolling") return;
    const tickInterval = 80;
    const interval = setInterval(() => {
      setDisplayValue(1 + Math.floor(Math.random() * 100));
    }, tickInterval);
    const t = setTimeout(() => {
      clearInterval(interval);
      setDisplayValue(finalValue);
      setPhase("done");
      onRollComplete?.();
    }, rollMs);
    return () => { clearInterval(interval); clearTimeout(t); };
  }, [phase, finalValue, rollMs, onRollComplete]);

  const isRolling = phase === "rolling";
  const isWaiting = phase === "waiting";
  const isDone = phase === "done";

  const colorClass = isWaiting
    ? "bg-amber-50 text-amber-800 border-amber-400 cursor-pointer hover:bg-amber-100"
    : isRolling
      ? "bg-slate-100 text-slate-700 border-slate-300"
      : success
        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
        : "bg-red-50 text-red-800 border-red-300";

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        onClick={isWaiting ? startRoll : undefined}
        role={isWaiting ? "button" : undefined}
        tabIndex={isWaiting ? 0 : undefined}
        onKeyDown={isWaiting ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startRoll(); } } : undefined}
        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-lg border-2 flex items-center justify-center font-heading text-3xl sm:text-4xl font-bold transition-colors ${colorClass} ${
          isRolling ? "animate-pulse" : ""
        } ${isWaiting ? "ring-2 ring-amber-400/40 animate-pulse" : ""}`}
        style={{
          transform: isRolling ? "rotate(-5deg)" : "rotate(0deg)",
          transition: isRolling ? "none" : "transform 0.3s ease-out",
        }}
        aria-label={isWaiting ? "Cliquez pour lancer le dé" : undefined}
      >
        {String(displayValue).padStart(2, "0")}
      </div>
      <span className="text-xs font-body text-slate-600">
        {isWaiting ? "👆 Cliquez pour lancer" : label}
      </span>
    </div>
  );
}

/** Une phase = un titre + une narration + un dé qui roule + un verdict.
 *  Cas particulier : si isSetup=true, c'est une phase d'introduction qui montre
 *  les choix tactiques avant les jets, sans dé, et plus courte.
 *
 *  V6.1.3 — Mode interactif (waitForClick=true) : le dé attend un clic. Le
 *  verdict ne s'affiche qu'après le roulement, et la transition vers la
 *  phase suivante n'arrive qu'après. */
function Phase({ icon, title, narration, dieValue, dieLabel, dieSuccess, verdict, verdictType, onDone, isSetup = false, waitForClick = false, durationMs }) {
  // Délais standardisés (V6.1.4) :
  //  - Phase setup (pas de dé, juste contexte) : 200ms d'attente, fin à 3.2s
  //    (3s pour lire le verdict "Que le combat commence !")
  //  - Phase normale auto (dé qui roule) : verdict à 2.3s, fin à 5.3s
  //    (3s pour lire le verdict du dé)
  //  - Phase interactive : pas de timer, verdict au clic + 3s avant transition
  const isAutoTimed = !waitForClick;
  const totalDuration = durationMs ?? (isSetup ? 3200 : 5300);
  const verdictDelay = isSetup ? 200 : 2300;

  const [showVerdict, setShowVerdict] = useState(false);

  // Mode automatique : timers classiques
  useEffect(() => {
    if (!isAutoTimed) return;
    const t1 = setTimeout(() => setShowVerdict(true), verdictDelay);
    const t2 = setTimeout(() => onDone?.(), totalDuration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone, totalDuration, verdictDelay, isAutoTimed]);

  // Mode interactif : le verdict s'affiche après le roulement, la transition
  // s'enchaîne 3s plus tard pour laisser le temps de lire.
  const handleRollComplete = () => {
    setShowVerdict(true);
    setTimeout(() => onDone?.(), 3000);
  };

  return (
    <div className="flex flex-col items-center gap-3 py-3 sm:py-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-2 text-slate-700 text-center px-2">
        <span className="text-2xl shrink-0">{icon}</span>
        <h3 className="font-heading font-semibold text-base sm:text-lg leading-tight">{title}</h3>
      </div>
      <p className="text-sm font-body text-slate-600 text-center max-w-md italic px-2">
        {narration}
      </p>
      {/* Le dé n'est affiché que pour les phases avec jet (pas la phase setup) */}
      {!isSetup && (
        <RollingDie
          finalValue={dieValue}
          success={dieSuccess}
          label={dieLabel}
          waitForClick={waitForClick}
          onRollComplete={waitForClick ? handleRollComplete : undefined}
        />
      )}
      {showVerdict && (
        <div
          className={`mt-1 px-4 py-1.5 rounded-full text-base font-heading font-semibold animate-in fade-in slide-in-from-bottom-2 duration-300 ${
            verdictType === "success"
              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
              : verdictType === "fail"
                ? "bg-red-100 text-red-800 border border-red-300"
                : "bg-slate-100 text-slate-700 border border-slate-300"
          }`}
        >
          {verdict}
        </div>
      )}
    </div>
  );
}

/** Conclusion finale : qui a gagné, dégâts, or volé. */
function Conclusion({ challenge, perspective }) {
  const result = challenge.result;
  const isAttacker = perspective === "attacker";

  let headline = "";
  let toneClass = "";

  if (result === "parried") {
    headline = isAttacker
      ? "Votre attaque a été parée !"
      : "Vous avez paré l'attaque !";
    toneClass = "bg-blue-50 text-blue-900 border-blue-300";
  } else if (result === "attack_missed") {
    headline = isAttacker
      ? "Votre lame s'est dérobée..."
      : "Sa lame s'est dérobée !";
    toneClass = "bg-amber-50 text-amber-900 border-amber-300";
  } else if (result === "attacker_won") {
    headline = isAttacker
      ? "Vous portez le coup !"
      : "Vous prenez le coup...";
    toneClass = isAttacker
      ? "bg-emerald-50 text-emerald-900 border-emerald-300"
      : "bg-red-50 text-red-900 border-red-300";
  } else if (result === "defender_won") {
    headline = isAttacker
      ? "Votre coup est repoussé !"
      : "Vous repoussez le coup !";
    toneClass = isAttacker
      ? "bg-red-50 text-red-900 border-red-300"
      : "bg-emerald-50 text-emerald-900 border-emerald-300";
  }

  return (
    <div className={`mt-3 w-full px-4 py-3 rounded-lg border-2 ${toneClass} animate-in fade-in zoom-in-95 duration-500`}>
      <div className="font-heading font-bold text-center text-base sm:text-lg mb-1 leading-tight">{headline}</div>
      {(challenge.damage_dealt > 0 || challenge.gold_stolen > 0) && (
        <div className="flex items-center justify-center gap-4 text-sm font-body mt-2 flex-wrap">
          {challenge.damage_dealt > 0 && (
            <span>💔 {challenge.damage_dealt} PV</span>
          )}
          {challenge.gold_stolen > 0 && (
            <span>💰 {challenge.gold_stolen} or</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Construit la liste ordonnée des phases à jouer pour un défi donné.
 *
 *  V6.1.2 — Réordonnancement narratif des phases.
 *  Côté moteur, la parade est résolue AVANT l'attaque (pour des raisons
 *  d'optimisation : si la parade réussit, pas besoin de calculer l'attaque
 *  ni l'usure d'épée). Mais narrativement, c'est incohérent : on parerait
 *  un coup qui n'a pas été lancé ?
 *
 *  Le replay raconte donc l'histoire dans l'ordre fiction :
 *    1. Préparation (choix tactiques)
 *    2. L'attaquant lance son épée (jet d'attaque)
 *    3. Si l'épée touche : parade ou défense selon les zones
 *    4. Bouclier puis sauvegarde si applicables
 *    5. Conclusion
 *
 *  Si l'épée rate (attack_missed), pas de parade montrée même si elle
 *  aurait été tentée : il n'y a rien à parer.
 */
function buildPhases(challenge) {
  const phases = [];
  const attackZone = challenge.attack_zone;
  const defenseZone = challenge.defense_zone;
  const shieldZone = challenge.shield_zone;

  // ──────────────────────────────────────────────────────────────────
  // Phase 0 — Préparation : on montre les choix tactiques en premier
  // ──────────────────────────────────────────────────────────────────
  const setupParts = [];
  if (attackZone) {
    setupParts.push(`L'attaquant vise la zone ${ZONE_LABEL[attackZone] || attackZone}.`);
  }
  if (defenseZone) {
    if (defenseZone === attackZone) {
      setupParts.push(`Le défenseur garde la même zone !`);
    } else {
      setupParts.push(`Le défenseur garde la zone ${ZONE_LABEL[defenseZone] || defenseZone}.`);
    }
  }
  if (shieldZone) {
    setupParts.push(`Le bouclier protège la zone ${ZONE_LABEL[shieldZone] || shieldZone}.`);
  }
  if (setupParts.length > 0) {
    phases.push({
      key: "setup",
      ownerRole: null,
      icon: "⚔️",
      title: "Préparation du duel",
      narration: setupParts.join(" "),
      dieValue: 0,
      dieLabel: "",
      dieSuccess: true,
      verdict: "Que le combat commence !",
      verdictType: "neutral",
      isSetup: true,
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Phase 1 — Jet d'attaque (l'épée s'élance EN PREMIER, narrativement)
  // ──────────────────────────────────────────────────────────────────
  // Détermine si l'épée a touché. Trois cas :
  //  - challenge.attack_roll_succeeded présent → on l'utilise
  //  - sinon, fallback depuis le result :
  //    * "attack_missed" → l'épée a raté
  //    * "parried" → on considère que l'épée allait toucher
  //      (la parade pré-empte l'attaque dans le moteur, mais narrativement
  //      l'épée est bien lancée et c'est la parade qui l'arrête)
  //    * tout autre result → l'épée a touché
  let attackSucceeded;
  if (challenge.attack_roll_succeeded === true || challenge.attack_roll_succeeded === false) {
    attackSucceeded = challenge.attack_roll_succeeded;
  } else {
    attackSucceeded = challenge.result !== "attack_missed";
  }

  phases.push({
    key: "attack",
    ownerRole: "attacker",
    icon: "⚔️",
    title: `Jet d'attaque — ${ZONE_LABEL[attackZone] || attackZone}`,
    narration: attackSucceeded
      ? `La lame fend l'air vers la zone ${ZONE_LABEL[attackZone] || attackZone}.`
      : `L'épée s'élance vers la zone ${ZONE_LABEL[attackZone] || attackZone}...`,
    dieValue: rollFinalValue(attackSucceeded, `${challenge.id}:attack`),
    dieLabel: "Jet d'épée",
    dieSuccess: attackSucceeded,
    verdict: attackSucceeded ? "L'épée touche !" : "L'épée se dérobe",
    verdictType: attackSucceeded ? "success" : "fail",
  });

  // Si l'attaque a raté, fin de la séquence narrative : pas de parade ni
  // de défense à montrer puisqu'il n'y a rien à arrêter.
  if (!attackSucceeded) return phases;

  // ──────────────────────────────────────────────────────────────────
  // Phase 2 — Parade (uniquement si défenseur sur la même zone)
  // ──────────────────────────────────────────────────────────────────
  // Construite seulement si une parade a réellement été tentée par le moteur,
  // ce qui correspond exactement au cas defense_zone === attack_zone.
  const parryWasAttempted =
    challenge.parry_attempted === true ||
    (challenge.parry_attempted === undefined && challenge.result === "parried" && defenseZone === attackZone);

  if (parryWasAttempted) {
    let parrySuccess;
    if (challenge.parry_succeeded === true || challenge.parry_succeeded === false) {
      parrySuccess = challenge.parry_succeeded;
    } else {
      parrySuccess = challenge.result === "parried";
    }
    phases.push({
      key: "parry",
      ownerRole: "defender",
      icon: "🛡️",
      title: `Tentative de parade — ${ZONE_LABEL[defenseZone] || defenseZone}`,
      narration: `Le défenseur lève sa garde au dernier instant.`,
      dieValue: rollFinalValue(parrySuccess, `${challenge.id}:parry`),
      dieLabel: "Jet de parade",
      dieSuccess: parrySuccess,
      verdict: parrySuccess ? "Parade réussie !" : "Parade ratée",
      verdictType: parrySuccess ? "success" : "fail",
    });
    // Si la parade a réussi, fin de la séquence : le coup est annulé.
    if (parrySuccess) return phases;
  }

  // ──────────────────────────────────────────────────────────────────
  // Phase 3 — Jet de défense (blocage par armure de la zone touchée)
  // ──────────────────────────────────────────────────────────────────
  // Fallback : si defense_roll_succeeded manque (legacy), on déduit du result.
  // Si attacker_won → le coup est passé (defense ratée).
  // Si defender_won → l'armure a tenu (defense réussie).
  let blockSucceeded;
  if (challenge.defense_roll_succeeded === true || challenge.defense_roll_succeeded === false) {
    blockSucceeded = challenge.defense_roll_succeeded;
  } else if (challenge.result === "defender_won") {
    blockSucceeded = true;
  } else if (challenge.result === "attacker_won") {
    blockSucceeded = false;
  } else {
    blockSucceeded = null; // pas de phase défense à montrer
  }
  if (blockSucceeded !== null) {
    phases.push({
      key: "defense",
      ownerRole: "defender",
      icon: "🛡️",
      title: `Jet de blocage — ${ZONE_LABEL[attackZone] || attackZone}`,
      narration: blockSucceeded
        ? `L'armure de la zone ${ZONE_LABEL[attackZone] || attackZone} encaisse le choc.`
        : `Aucune protection sur la zone ${ZONE_LABEL[attackZone] || attackZone}...`,
      dieValue: rollFinalValue(blockSucceeded, `${challenge.id}:defense`),
      dieLabel: "Jet d'armure",
      dieSuccess: blockSucceeded,
      verdict: blockSucceeded ? "Coup bloqué !" : "L'armure cède !",
      verdictType: blockSucceeded ? "success" : "fail",
    });
  }

  // Phase 3bis : bouclier (uniquement si tenté, c'est-à-dire si le bouclier
  // est posé exactement sur la zone visée par l'attaquant)
  if (challenge.shield_attempted) {
    const shieldSucceeded = !!challenge.shield_succeeded;
    phases.push({
      key: "shield",
      ownerRole: "defender",
      icon: "🛡️",
      title: `Bouclier — ${ZONE_LABEL[shieldZone] || shieldZone}`,
      narration: shieldSucceeded
        ? `Le défenseur dégaine son bouclier au bon moment, l'écu se dresse face à la lame.`
        : `Le défenseur tente de lever son bouclier vers la zone ${ZONE_LABEL[shieldZone] || shieldZone}, mais le geste manque de timing...`,
      dieValue: rollFinalValue(shieldSucceeded, `${challenge.id}:shield`),
      dieLabel: "Jet de bouclier",
      dieSuccess: shieldSucceeded,
      verdict: shieldSucceeded ? "Le bouclier protège !" : "Le bouclier ne protège pas",
      verdictType: shieldSucceeded ? "success" : "fail",
    });
  }

  // Phase 4 — V6.1 : jet de sauvegarde (basé sur le niveau du défenseur)
  // Apparaît uniquement si le coup allait porter (attaquant gagne le tie-break).
  // En cas de succès, retire 1 dégât (le coup est encaissé "à moitié").
  if (challenge.save_attempted) {
    const saveSucceeded = !!challenge.save_succeeded;
    phases.push({
      key: "save",
      ownerRole: "defender",
      icon: "✨",
      title: "Jet de sauvegarde",
      narration: saveSucceeded
        ? "Un dernier sursaut, l'expérience parle..."
        : "Le coup arrive sans détour...",
      dieValue: rollFinalValue(saveSucceeded, `${challenge.id}:save`),
      dieLabel: "Jet d'expérience",
      dieSuccess: saveSucceeded,
      verdict: saveSucceeded ? "Coup amorti !" : "Sauvegarde ratée",
      verdictType: saveSucceeded ? "success" : "fail",
    });
  }

  return phases;
}

/** Composant principal exporté. */
export default function CombatReplay({ challenge, perspective = "attacker", open, onClose, interactive = false }) {
  // V6.1.1 — phases calculées synchroniquement avec useMemo plutôt que useRef + useEffect.
  // L'ancienne approche initialisait phases.current dans un useEffect, ce qui n'arrive
  // qu'APRÈS le premier render avec open=true. Du coup au premier clic "Revoir", le
  // composant rendait avec phases=null et n'affichait rien. Il fallait fermer/rouvrir
  // pour que ça marche. Avec useMemo, les phases sont disponibles dès le premier render.
  const phases = useMemo(
    () => (open && challenge ? buildPhases(challenge) : null),
    [open, challenge]
  );

  const [currentIdx, setCurrentIdx] = useState(0);
  const [showConclusion, setShowConclusion] = useState(false);

  // À chaque changement de défi, on remet les compteurs à zéro
  useEffect(() => {
    if (open && challenge) {
      setCurrentIdx(0);
      setShowConclusion(false);
    }
  }, [open, challenge?.id]);

  if (!open || !challenge || !phases) return null;

  const handlePhaseDone = () => {
    if (currentIdx + 1 < phases.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setShowConclusion(true);
    }
  };

  const handleSkip = () => {
    setCurrentIdx(phases.length - 1);
    setShowConclusion(true);
  };

  const isAttacker = perspective === "attacker";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-md w-[calc(100vw-1rem)] sm:w-full p-4 sm:p-6">
        <div className="flex flex-col items-center">
          {/* En-tête : qui contre qui */}
          <div className="flex items-center justify-between w-full mb-2 text-sm font-body">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sword className="w-4 h-4 text-red-600 shrink-0" />
              <span className={`truncate ${isAttacker ? "font-bold" : ""}`}>
                {isAttacker ? "Vous" : challenge.attacker_name}
              </span>
            </div>
            <span className="text-slate-400 shrink-0 px-2">vs</span>
            <div className="flex items-center gap-1.5 min-w-0 justify-end">
              <span className={`truncate ${!isAttacker ? "font-bold" : ""}`}>
                {!isAttacker ? "Vous" : challenge.defender_name}
              </span>
              <Shield className="w-4 h-4 text-blue-600 shrink-0" />
            </div>
          </div>

          {/* Phase courante */}
          {!showConclusion && phases[currentIdx] && (
            <Phase
              key={phases[currentIdx].key}
              icon={phases[currentIdx].icon}
              title={phases[currentIdx].title}
              narration={phases[currentIdx].narration}
              dieValue={phases[currentIdx].dieValue}
              dieLabel={phases[currentIdx].dieLabel}
              dieSuccess={phases[currentIdx].dieSuccess}
              verdict={phases[currentIdx].verdict}
              verdictType={phases[currentIdx].verdictType}
              isSetup={phases[currentIdx].isSetup}
              waitForClick={interactive && phases[currentIdx].ownerRole === perspective}
              onDone={handlePhaseDone}
            />
          )}

          {/* Conclusion */}
          {showConclusion && (
            <Conclusion challenge={challenge} perspective={perspective} />
          )}

          {/* Boutons de contrôle */}
          <div className="mt-4 w-full flex items-center justify-between gap-2">
            {!showConclusion && (
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                Passer
              </Button>
            )}
            {showConclusion && (
              <Button onClick={onClose} className="ml-auto">
                Fermer
              </Button>
            )}
            {!showConclusion && (
              <span className="text-xs text-slate-400 ml-auto">
                Phase {currentIdx + 1} / {phases.length}
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Hook utilitaire : détecte les défis nouvellement résolus pour un joueur
 *  et permet d'auto-déclencher l'animation une seule fois.
 *
 *  Usage dans une page :
 *    const replay = useCombatReplay(myEmail, challenges);
 *    return (
 *      <>
 *        ... contenu de la page ...
 *        {replay.modal}
 *      </>
 *    );
 *
 *  Persistance : localStorage clé "gc_replay_seen" → set d'IDs.
 */
export function useCombatReplay(myEmail, challenges) {
  const [active, setActive] = useState(null); // { challenge, perspective, interactive }

  useEffect(() => {
    if (!myEmail || !Array.isArray(challenges)) return;

    let seen;
    try {
      seen = new Set(JSON.parse(localStorage.getItem("gc_replay_seen") || "[]"));
    } catch {
      seen = new Set();
    }

    // Cherche le défi le plus récent, résolu, où le joueur est impliqué, et non vu.
    const candidates = challenges
      .filter(c => c.status === "resolved")
      .filter(c => c.attacker_email === myEmail || c.defender_email === myEmail)
      .filter(c => !seen.has(c.id))
      .sort((a, b) => new Date(b.resolved_at || b.updated || 0) - new Date(a.resolved_at || a.updated || 0));

    if (candidates.length > 0) {
      const c = candidates[0];
      const perspective = c.attacker_email === myEmail ? "attacker" : "defender";

      // V6.1.3 — Mode interactif (clic sur le dé) UNIQUEMENT si le défi a été
      // résolu dans les 24 dernières heures. Au-delà, c'est une rediffusion
      // automatique : le joueur consulte un vieux combat, on ne lui demande
      // pas de cliquer pour rien. 24h couvre largement le cycle d'usage
      // (un défi lancé le matin et résolu le soir, l'attaquant qui revient
      // le lendemain matin verra encore le mode interactif).
      const resolvedAt = c.resolved_at || c.updated;
      const isRecent = resolvedAt
        ? (Date.now() - new Date(resolvedAt).getTime()) < 24 * 60 * 60 * 1000
        : false;

      setActive({ challenge: c, perspective, interactive: isRecent });

      // V6.1.5 — Marque TOUS les défis non vus comme vus, pas seulement celui
      // qu'on affiche. Sinon un joueur attaqué 10 fois pendant la nuit verrait
      // 10 modales d'auto-show successives à chaque rechargement, ce qui est
      // insupportable. On en montre un (le plus récent), et on classe les
      // autres comme "déjà signalés". Ils restent consultables via le bouton
      // "Revoir" dans l'historique.
      for (const candidate of candidates) {
        seen.add(candidate.id);
      }
      try {
        localStorage.setItem("gc_replay_seen", JSON.stringify([...seen].slice(-200)));
      } catch { /* localStorage plein, pas grave */ }
    }
  }, [myEmail, challenges]);

  return {
    modal: active && (
      <CombatReplay
        challenge={active.challenge}
        perspective={active.perspective}
        interactive={active.interactive}
        open={!!active}
        onClose={() => setActive(null)}
      />
    ),
  };
}

/** Composant bouton "Revoir le combat" : affiche le replay à la demande.
 *  À placer dans la liste des défis résolus, à côté du badge de résultat. */
export function CombatReplayButton({ challenge, perspective }) {
  const [open, setOpen] = useState(false);
  if (challenge.status !== "resolved") return null;
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-xs h-7"
      >
        ▶ Revoir
      </Button>
      <CombatReplay
        challenge={challenge}
        perspective={perspective}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
