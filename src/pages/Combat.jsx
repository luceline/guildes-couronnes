/**
 * pages/Combat.jsx — Page principale du combat zoné PvP (Phase 3.1).
 *
 * Phase 3.1 (lecture seule) :
 *   - 4 onglets : Mes défis, Historique, Combats publics, À propos
 *   - Pas encore de bouton "Défier" ni de défense interactive
 *   - On valide d'abord la fondation (DB + helpers + UI lecture)
 *
 * Phase 3.2 ajoutera : bouton défier (CityView, biome) + formulaire défi
 * Phase 3.3 ajoutera : formulaire défense + résolution complète + riposte
 */
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { logGold } from "@/lib/goldLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ChallengeDefenseForm from "@/components/ChallengeDefenseForm";
import ChallengeForm from "@/components/ChallengeForm";
import CombatEquipmentPanel from "@/components/CombatEquipmentPanel";
import { CombatReplayButton, useCombatReplay } from "@/components/CombatReplay";
import { resolveCombat } from "@/lib/combatPvP";
import { claimBountiesIfApplicable } from "@/lib/bountyResolver";
import {
  COMBAT_PARRY_TIMER_HOURS,
  COMBAT_KO_DURATION_HOURS,
  COMBAT_STEAL_MAX_GOLD,
  COMBAT_MAX_HP,
  COMBAT_SLOT_INFO,
  EQUIPMENT_MAX_DURABILITY,
  isPlayerKO,
  getPlayerHP,
} from "@/lib/gameData";
import { ITEMS } from "@/lib/craftingData";
import { Sword, Shield, Trophy, Skull, Clock } from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────
// Helpers d'affichage
// ──────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────
// Auto-résolution d'un défi expiré (best-effort, côté client)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Résout un défi en pending_defense dont expires_at est dépassé.
 * Le défenseur n'a pas répondu : on résout comme un combat normal sans parade
 * (defense_zone = ""). L'armure de la zone visée joue son rôle, mais aucune
 * parade tactique n'est possible.
 *
 * Fait par best-effort : si l'API plante (concurrence, autre client a déjà
 * résolu), on ignore silencieusement. La cohérence finale est garantie par
 * le cron serveur (server_reset_v2).
 */
async function autoResolveTimeoutChallenge(challenge) {
  if (challenge.status !== "pending_defense") return;
  if (!challenge.expires_at || new Date(challenge.expires_at).getTime() >= Date.now()) return;

  // Récupère les profils frais
  const [attackerArr, defenderArr] = await Promise.all([
    base44.entities.PlayerProfile.filter({ user_email: challenge.attacker_email }).catch(() => []),
    base44.entities.PlayerProfile.filter({ user_email: challenge.defender_email }).catch(() => []),
  ]);
  const attacker = attackerArr[0];
  const defender = defenderArr[0];
  if (!attacker || !defender) return;

  // Résout le combat sans défense choisie
  const { resolution, attackerUpdates, defenderUpdates } = resolveCombat(attacker, defender, {
    attack_zone: challenge.attack_zone,
    attack_weapon_key: challenge.attack_weapon_key,
    defense_zone: "", // pas de parade possible
  });

  // Si ce défi est lui-même une riposte, pas de nouvelle fenêtre de riposte
  const isRiposte = !!(challenge.parent_challenge_id && challenge.parent_challenge_id !== "");
  const ripostWindow = isRiposte ? null : resolution.riposte_window_until;

  const ops = [];
  if (Object.keys(attackerUpdates).length > 0) {
    ops.push(base44.entities.PlayerProfile.update(attacker.id, attackerUpdates));
  }
  if (Object.keys(defenderUpdates).length > 0) {
    ops.push(base44.entities.PlayerProfile.update(defender.id, defenderUpdates));
  }

  ops.push(base44.entities.CombatChallenge.update(challenge.id, {
    defense_zone: "",
    shield_zone: "",       // V2 : pas de défense → pas de bouclier placé
    shield_used: false,    // V2
    status: "resolved",
    result: resolution.result,
    attack_score: resolution.attack_score,
    defense_score: resolution.defense_score,
    damage_dealt: resolution.damage_dealt,
    gold_stolen: resolution.gold_stolen,
    attacker_break_item: resolution.attacker_break_item || "",
    defender_break_item: resolution.defender_break_item || "",
    bourse_broke: !!resolution.bourse_broke,
    tie_breaker_used: !!resolution.tie_breaker_used,
    tie_breaker_details: resolution.tie_breaker_details || null,
    riposte_window_until: ripostWindow,
    resolved_at: new Date().toISOString(),
  }));

  // Log gold transactions si vol
  if (resolution.gold_stolen > 0) {
    const ZONE_LABELS_LOCAL = { head: "Tête", torso: "Torse", arms: "Bras", legs: "Jambes" };
    ops.push(
      logGold({
        profile: attacker,
        city: { id: challenge.city_id, name: challenge.city_name },
        amount: resolution.gold_stolen,
        type: "combat_pvp_gain",
        description: `Vol PvP (timeout) : ${defender.character_name || ""} (${ZONE_LABELS_LOCAL[challenge.attack_zone] || challenge.attack_zone})`,
      }),
      logGold({
        profile: defender,
        city: { id: challenge.city_id, name: challenge.city_name },
        amount: -resolution.gold_stolen,
        type: "combat_pvp_loss",
        description: `Or volé par ${attacker.character_name || ""} (timeout)`,
      }),
    );
  }

  // Annonce taverne (timeout)
  try {
    let msg;
    if (resolution.result === "attacker_won") {
      msg = `⏱️ ${defender.character_name || "La cible"} n'a pas répondu à temps : ${attacker.character_name || "l'attaquant"} l'emporte${resolution.gold_stolen > 0 ? ` et lui dérobe ${resolution.gold_stolen}💰` : ""}.`;
    } else {
      msg = `⏱️ ${defender.character_name || "La cible"} n'a pas répondu à temps, mais l'attaque de ${attacker.character_name || "l'attaquant"} a été repoussée par son armure.`;
    }
    ops.push(base44.entities.TavernMessage.create({
      author_email: "system",
      author_name: "Système",
      city_id: challenge.city_id || "",
      message: msg,
      type: "combat",
    }).catch(() => {}));
  } catch (e) { /* silent */ }

  await Promise.all(ops);

  // ── REFONTE v5 : claim des bounties si l'attaquant a gagné par timeout ──
  if (resolution.result === "attacker_won") {
    try {
      await claimBountiesIfApplicable(base44, {
        attacker,
        defender,
        combatResult: resolution.result,
        cityId: challenge.city_id || "",
        cityName: challenge.city_name || "",
      });
    } catch (e) {
      console.error("Bounty claim error (timeout):", e);
    }
  }
}

function ZoneBadge({ zone }) {
  const labels = { head: "Tête", torso: "Torse", arms: "Bras", legs: "Jambes" };
  const icons = { head: "🪖", torso: "🛡️", arms: "💪", legs: "🦵" };
  if (!zone) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className="text-xs font-body">
      {icons[zone]} {labels[zone] || zone}
    </Badge>
  );
}

function ResultBadge({ result, perspective }) {
  // perspective = "attacker" | "defender" | "spectator"
  if (result === "parried") {
    return <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-heading">🛡️ Paré</Badge>;
  }
  if (result === "attacker_won") {
    if (perspective === "attacker") return <Badge className="bg-green-100 text-green-800 border-green-300 font-heading">⚔️ Victoire</Badge>;
    if (perspective === "defender") return <Badge className="bg-red-100 text-red-800 border-red-300 font-heading">💀 Défaite</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-heading">⚔️ Attaquant gagne</Badge>;
  }
  if (result === "defender_won") {
    if (perspective === "attacker") return <Badge className="bg-red-100 text-red-800 border-red-300 font-heading">💀 Défaite</Badge>;
    if (perspective === "defender") return <Badge className="bg-green-100 text-green-800 border-green-300 font-heading">⚔️ Victoire</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-heading">🛡️ Défenseur gagne</Badge>;
  }
  if (result === "timeout") {
    return <Badge variant="secondary" className="font-heading">⏱️ Expiré</Badge>;
  }
  return null;
}

function timeAgo(date) {
  if (!date) return "—";
  const ms = Date.now() - new Date(date).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

function timeUntil(date) {
  if (!date) return "—";
  const ms = new Date(date).getTime() - Date.now();
  if (ms <= 0) return "expiré";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  return `${h}h${min % 60 > 0 ? ` ${min % 60}min` : ""}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Carte d'un combat
// ──────────────────────────────────────────────────────────────────────────

function ChallengeCard({ challenge, currentEmail, onDefend, onRiposte }) {
  const isAttacker = challenge.attacker_email === currentEmail;
  const isDefender = challenge.defender_email === currentEmail;
  const perspective = isAttacker ? "attacker" : isDefender ? "defender" : "spectator";

  const otherName = isAttacker ? challenge.defender_name : challenge.attacker_name;
  const myRole = isAttacker ? "Attaquant" : isDefender ? "Défenseur" : null;

  const weapon = ITEMS[challenge.attack_weapon_key];
  const breakerAtk = challenge.attacker_break_item ? ITEMS[challenge.attacker_break_item] : null;
  const breakerDef = challenge.defender_break_item ? ITEMS[challenge.defender_break_item] : null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm font-body">
            {isAttacker && <Sword className="h-4 w-4 text-red-600" />}
            {isDefender && <Shield className="h-4 w-4 text-blue-600" />}
            <span className="font-heading font-semibold">
              {isAttacker ? "Vous" : challenge.attacker_name}
              <span className="text-muted-foreground"> vs </span>
              {isDefender ? "Vous" : challenge.defender_name}
            </span>
            {myRole && <Badge variant="secondary" className="text-xs">{myRole}</Badge>}
          </div>
          {challenge.status === "resolved" && (
            <div className="flex items-center gap-2">
              <ResultBadge result={challenge.result} perspective={perspective} />
              <CombatReplayButton challenge={challenge} perspective={perspective} />
            </div>
          )}
          {challenge.status === "pending_defense" && (
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 font-heading">
              <Clock className="h-3 w-3 mr-1 inline" /> En attente de défense
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-xs font-body text-muted-foreground">
          {challenge.context === "city" && challenge.city_name && (
            <span>📍 {challenge.city_name}</span>
          )}
          {challenge.context === "biome" && challenge.biome && (
            <span>🌿 {challenge.biome}</span>
          )}
          {/* Phase 3.3 : on cache la zone visée au défenseur tant que le défi n'est pas résolu,
              sinon il choisit sa parade trivialement. L'attaquant et les spectateurs voient tout. */}
          {(challenge.status === "resolved" || !isDefender) && (
            <span className="flex items-center gap-1">
              <Sword className="h-3 w-3" /> Vise <ZoneBadge zone={challenge.attack_zone} />
              {weapon && <span>({weapon.icon} {weapon.name})</span>}
            </span>
          )}
          {isDefender && challenge.status === "pending_defense" && (
            <span className="flex items-center gap-1 italic text-muted-foreground/80">
              <Sword className="h-3 w-3" /> Zone visée inconnue
            </span>
          )}
          {challenge.defense_zone && (
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" /> Défend <ZoneBadge zone={challenge.defense_zone} />
            </span>
          )}
        </div>

        {challenge.status === "resolved" && (
          <div className="flex flex-wrap gap-3 text-xs font-body bg-muted/40 rounded-md px-2 py-1.5">
            {challenge.result !== "parried" && (
              <>
                <span>Atk: <strong>{challenge.attack_score}</strong></span>
                <span>Def: <strong>{challenge.defense_score}</strong></span>
              </>
            )}
            {challenge.tie_breaker_used && challenge.tie_breaker_details && (
              <span className="text-purple-700">
                ⚖️ Égalité résolue par la durabilité (épée {challenge.tie_breaker_details.attacker_weapon_durability} vs armure {challenge.tie_breaker_details.defender_armor_durability})
              </span>
            )}
            {challenge.damage_dealt > 0 && (
              <span className="text-red-600">💔 -{challenge.damage_dealt} PV</span>
            )}
            {challenge.gold_stolen > 0 && (
              <span className="text-amber-700">💰 {challenge.gold_stolen} or volé</span>
            )}
            {breakerAtk && (
              <span className="text-orange-700">⚒️ {breakerAtk.icon} {breakerAtk.name} brisé (atk)</span>
            )}
            {breakerDef && (
              <span className="text-orange-700">⚒️ {breakerDef.icon} {breakerDef.name} brisé (def)</span>
            )}
            {challenge.bourse_broke && (
              <span className="text-orange-700">👛 Bourse de protection brisée</span>
            )}
          </div>
        )}

        {challenge.status === "pending_defense" && challenge.expires_at && (
          <p className="text-xs font-body text-muted-foreground italic">
            Expire dans {timeUntil(challenge.expires_at)} (auto-résolution si défenseur ne répond pas)
          </p>
        )}
        {challenge.status === "resolved" && challenge.result === "parried" && challenge.riposte_window_until && (
          <p className="text-xs font-body text-blue-700 italic">
            Parade réussie. Riposte ouverte {timeUntil(challenge.riposte_window_until)}.
          </p>
        )}

        {/* ── Boutons d'action ── */}
        {challenge.status === "pending_defense" && isDefender && onDefend && (
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              onClick={() => onDefend(challenge)}
              className="h-7 text-xs font-heading bg-blue-600 hover:bg-blue-700"
            >
              <Shield className="h-3 w-3 mr-1" /> Défendre
            </Button>
          </div>
        )}
        {challenge.status === "resolved"
          && challenge.result === "parried"
          && isAttacker  /* Note : la riposte est lancée par celui qui a paré, donc le défenseur initial */
          && false       /* On gère la riposte côté défenseur via un autre flag, pas attaquant */ && null}
        {challenge.status === "resolved"
          && challenge.result === "parried"
          && isDefender
          && challenge.riposte_window_until
          && new Date(challenge.riposte_window_until) > new Date()
          && !challenge.riposte_used
          && onRiposte && (
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={() => onRiposte(challenge)}
                className="h-7 text-xs font-heading bg-red-600 hover:bg-red-700"
              >
                <Sword className="h-3 w-3 mr-1" /> Riposter
              </Button>
            </div>
          )}

        <p className="text-xs font-body text-muted-foreground/70 text-right">
          {challenge.status === "resolved" ? "Résolu" : "Créé"} il y a {timeAgo(challenge.resolved_at || challenge.created)}
        </p>
      </CardContent>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Page principale
// ──────────────────────────────────────────────────────────────────────────

export default function Combat({ profile, onRefresh }) {
  const [tab, setTab] = useState("mine");
  const [challenges, setChallenges] = useState([]);
  const [publicResolved, setPublicResolved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [defenseTarget, setDefenseTarget] = useState(null); // challenge en cours de défense
  const [riposteOf, setRiposteOf] = useState(null);          // challenge parié pour lequel on riposte

  const load = useCallback(async () => {
    if (!profile?.user_email) return;
    setLoading(true);
    try {
      // Mes défis (attaquant ou défenseur) — 2 filter, sans sort serveur
      // (PocketBase peut renvoyer 400 sur certains tris ; on trie côté client)
      const [asAttacker, asDefender, allResolved] = await Promise.all([
        base44.entities.CombatChallenge.filter({ attacker_email: profile.user_email }, "", 100).catch(() => []),
        base44.entities.CombatChallenge.filter({ defender_email: profile.user_email }, "", 100).catch(() => []),
        base44.entities.CombatChallenge.filter({ status: "resolved" }, "", 50).catch(() => []),
      ]);

      // Dédup mine
      const seen = new Set();
      let mine = [...asAttacker, ...asDefender].filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      // ── Auto-résolution best-effort des défis expirés où je suis impliqué ──
      // Si un défi est en pending_defense et que expires_at est passé, on le résout
      // automatiquement comme si le défenseur n'avait pas répondu (defense_zone vide).
      // C'est best-effort : si l'API plante, on continue à afficher la liste.
      const now = Date.now();
      const expiredPending = mine.filter(c =>
        c.status === "pending_defense"
        && c.expires_at
        && new Date(c.expires_at).getTime() < now
      );
      if (expiredPending.length > 0) {
        await Promise.all(expiredPending.map(c => autoResolveTimeoutChallenge(c).catch(() => {})));
        // Recharger après résolution(s)
        const [a2, d2] = await Promise.all([
          base44.entities.CombatChallenge.filter({ attacker_email: profile.user_email }, "", 100).catch(() => []),
          base44.entities.CombatChallenge.filter({ defender_email: profile.user_email }, "", 100).catch(() => []),
        ]);
        const seen2 = new Set();
        mine = [...a2, ...d2].filter(c => {
          if (seen2.has(c.id)) return false;
          seen2.add(c.id);
          return true;
        });
      }

      mine.sort((a, b) => (b.created || "").localeCompare(a.created || ""));
      setChallenges(mine);

      const sortedResolved = [...allResolved].sort((a, b) => (b.created || "").localeCompare(a.created || ""));
      setPublicResolved(sortedResolved);
    } catch (e) {
      console.warn("Combat load:", e);
    } finally {
      setLoading(false);
    }
  }, [profile?.user_email]);

  useEffect(() => { load(); }, [load]);

  // V6 — Replay animé : déclenché automatiquement pour les défis nouvellement
  // résolus (une seule fois par défi, mémorisé en localStorage).
  // Hook placé AVANT le early return pour respecter les rules of hooks.
  const replay = useCombatReplay(profile?.user_email, challenges);

  if (!profile) return null;

  const pendingDefense = challenges.filter(c => c.status === "pending_defense" && c.defender_email === profile.user_email);
  const pendingAttack = challenges.filter(c => c.status === "pending_defense" && c.attacker_email === profile.user_email);
  const myActive = [...pendingDefense, ...pendingAttack];
  const myHistory = challenges
    .filter(c => c.status === "resolved" || c.status === "expired")
    .sort((a, b) => {
      // V6.1.5 — Plus récent en premier (resolved_at, fallback updated puis created)
      const dateA = a.resolved_at || a.updated || a.created || "";
      const dateB = b.resolved_at || b.updated || b.created || "";
      return dateB.localeCompare(dateA);
    });

  const hp = getPlayerHP(profile);
  const ko = isPlayerKO(profile);

  // ── Blocage si épopée biome en cours ──
  // Quand le joueur a un combat de biome démarré aujourd'hui qui n'est pas terminé,
  // l'onglet PvP est bloqué pour éviter qu'un attaquant lui fasse perdre des PV
  // pendant qu'il enchaîne ses vagues (PV partagés biome ↔ PvP).
  const today = new Date().toISOString().split("T")[0];
  const epicInProgress = profile?.combat_last_date === today
                       && profile?.combat_active_biome
                       && (profile?.combat_wave_index ?? 0) < 5;
  if (epicInProgress) {
    const lockedBiomeName = {
      foret: "Forêt ancestrale", champs: "Champs dorés", mine: "Mines profondes",
      atelier: "Atelier", forge: "Forge", guilde: "Guilde",
    }[profile.combat_active_biome] || profile.combat_active_biome;
    return (
      <div className="space-y-3 max-w-3xl mx-auto p-3">
        <Card className="border-purple-300 bg-purple-50/40">
          <CardContent className="p-6 text-center space-y-3">
            <h2 className="text-xl font-heading">⚔️ Combat zoné PvP verrouillé</h2>
            <p className="text-sm font-body text-purple-900">
              Vous avez une <strong>épopée en cours</strong> dans le biome{" "}
              <strong>{lockedBiomeName}</strong> (vague {(profile.combat_wave_index ?? 0) + 1}/5).
            </p>
            <p className="text-xs font-body text-purple-800">
              Le PvP est bloqué tant que votre épopée n'est pas terminée pour éviter
              que vous perdiez des PV pendant votre combat de biome.
            </p>
            <p className="text-xs font-body text-muted-foreground italic">
              Retournez dans le biome pour continuer ou abandonner votre épopée.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-3xl mx-auto p-3">
      {/* V6 — Modal de replay animé du dernier combat résolu */}
      {replay.modal}
      {/* En-tête : statut combat du joueur */}
      <Card className={ko ? "border-red-300 bg-red-50/30" : "border-amber-300 bg-amber-50/30"}>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            ⚔️ Combat zoné
            {ko ? (
              <Badge className="bg-red-100 text-red-800 border-red-300 font-heading">
                <Skull className="h-3 w-3 mr-1 inline" /> Blessé
              </Badge>
            ) : (
              <Badge variant="outline" className="font-heading">
                ❤️ {hp} / {COMBAT_MAX_HP} PV
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {ko && profile.hp_ko_until ? (
            <p className="text-xs font-body text-red-800">
              Vous êtes blessé. Vous ne pouvez ni attaquer ni être attaqué pendant {timeUntil(profile.hp_ko_until)}.
              Votre cité ne reçoit plus vos unités armées tant que vous vous remettez.
            </p>
          ) : (
            <p className="text-xs font-body text-muted-foreground">
              Défiez les habitants de votre ville ou les voyageurs croisés dans un biome.
              {pendingDefense.length > 0 && (
                <span className="text-yellow-800 font-heading"> {pendingDefense.length} défi(s) à défendre !</span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Équipement de combat (PV, scores, arme, armures) — déplacé depuis Profile (Phase 3) */}
      <CombatEquipmentPanel profile={profile} onRefresh={onRefresh} />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="mine" className="font-heading text-xs">
            🎯 Mes défis
            {myActive.length > 0 && <Badge variant="secondary" className="ml-1.5 h-5 text-xs">{myActive.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history" className="font-heading text-xs">📜 Historique</TabsTrigger>
          <TabsTrigger value="public" className="font-heading text-xs">🌍 Combats publics</TabsTrigger>
        </TabsList>

        {/* ── Onglet : Mes défis en cours ── */}
        <TabsContent value="mine" className="space-y-2 mt-3">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-4 font-body">Chargement…</p>
          ) : myActive.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center font-body text-muted-foreground text-sm">
                Aucun défi en cours.
                <br />
                <span className="text-xs">
                  Pour défier un combattant, rendez-vous sur la page <strong>Localité</strong>,
                  trouvez un habitant ou un visiteur, et cliquez sur <strong>⚔️ Défier</strong>.
                </span>
              </CardContent>
            </Card>
          ) : (
            <>
              {pendingDefense.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-heading text-sm text-yellow-800">⚠️ Défis à défendre ({pendingDefense.length})</h3>
                  {pendingDefense.map(c => <ChallengeCard key={c.id} challenge={c} currentEmail={profile.user_email} onDefend={setDefenseTarget} onRiposte={setRiposteOf} />)}
                </div>
              )}
              {pendingAttack.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-heading text-sm text-amber-800">🗡️ Mes attaques en attente ({pendingAttack.length})</h3>
                  {pendingAttack.map(c => <ChallengeCard key={c.id} challenge={c} currentEmail={profile.user_email} onDefend={setDefenseTarget} onRiposte={setRiposteOf} />)}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Onglet : Historique ── */}
        <TabsContent value="history" className="space-y-2 mt-3">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-4 font-body">Chargement…</p>
          ) : myHistory.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center font-body text-muted-foreground text-sm">
                Aucun combat dans votre historique. Les premiers défis seront bientôt disponibles.
              </CardContent>
            </Card>
          ) : (
            myHistory.map(c => <ChallengeCard key={c.id} challenge={c} currentEmail={profile.user_email} onDefend={setDefenseTarget} onRiposte={setRiposteOf} />)
          )}
        </TabsContent>

        {/* ── Onglet : Combats publics ── */}
        <TabsContent value="public" className="space-y-2 mt-3">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-4 font-body">Chargement…</p>
          ) : publicResolved.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center font-body text-muted-foreground text-sm">
                Aucun combat résolu pour le moment. Soyez le premier à brandir l'épée !
              </CardContent>
            </Card>
          ) : (
            publicResolved.map(c => <ChallengeCard key={c.id} challenge={c} currentEmail={profile.user_email} onDefend={setDefenseTarget} onRiposte={setRiposteOf} />)
          )}
        </TabsContent>
      </Tabs>

      {/* Règles rappel */}
      <Card className="border-muted">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-sm">📜 Règles du combat zoné</CardTitle>
        </CardHeader>
        <CardContent className="text-xs font-body text-muted-foreground space-y-3">

          {/* ── Le duel ── */}
          <div>
            <p className="font-heading font-semibold text-foreground mb-1">⚔️ Le duel</p>
            <p>• L'attaquant choisit une zone (tête, torse, bras, jambes) à frapper.</p>
            <p>• Le défenseur a {COMBAT_PARRY_TIMER_HOURS}h pour deviner la zone et choisir sa défense.</p>
            <p>• Si les deux zones coïncident → coup paré (zéro dégât). Le défenseur peut riposter pendant {COMBAT_PARRY_TIMER_HOURS}h.</p>
            <p>• Sinon → on compare le score d'attaque et le score de défense sur la zone visée. Le plus fort l'emporte.</p>
            <p>• <strong>Égalité parfaite</strong> (ex : épée G5 vs armure G5) → on compare la <strong>durabilité</strong> de l'épée et de l'armure. Plus de dura = victoire. Si dura identique, le défenseur l'emporte.</p>
            <p>• Une seule attaque par jour vers une même cible (mais plusieurs attaquants peuvent se relayer).</p>
            <p>• Si le défenseur ne répond pas dans les {COMBAT_PARRY_TIMER_HOURS}h, le combat se résout sans parade possible.</p>
          </div>

          {/* ── Conséquences du coup porté ── */}
          <div>
            <p className="font-heading font-semibold text-foreground mb-1">💥 Conséquences d'un coup porté</p>
            <p>• −1 PV au défenseur. À 0 PV, il est blessé {COMBAT_KO_DURATION_HOURS}h (ne peut ni attaquer ni être attaqué).</p>
            <p>• Or volé selon le grade de l'épée : <strong>10% au G0 → 25% au G5</strong> (+3% par grade), capé à {COMBAT_STEAL_MAX_GOLD}💰 par coup.</p>
            <p>• La <strong>bourse de protection</strong> plafonne le vol subi à 10💰 et encaisse exactement 5 attaques avant de se briser (compteur déterministe).</p>
            <p>• Les PV se régénèrent uniquement via le cataplasme (+5 PV).</p>
          </div>

          {/* ── Durabilité & réparation ── */}
          <div>
            <p className="font-heading font-semibold text-foreground mb-1">🛡️ Durabilité & réparation</p>
            <p>• Chaque arme et armure équipée dispose de <strong>{EQUIPMENT_MAX_DURABILITY} points de durabilité</strong>.</p>
            <p>• <strong>Attaquant</strong> : votre épée perd <strong>−1 dura</strong> à chaque attaque PvP (peu importe le résultat).</p>
            <p>• <strong>Défenseur</strong> : si vous prenez un coup, l'objet qui défendait la zone touchée perd <strong>−1 dura</strong>. Le bouclier prime s'il était placé sur la zone visée.</p>
            <p>• Si vous parez parfaitement (zone identique à l'attaque) ou si vous absorbez sans dégâts, aucune usure.</p>
            <p>• À 0 dura, l'item reste équipé mais ne procure plus son bonus tant qu'il n'est pas réparé.</p>
            <p>• <strong>Réparation</strong> : 1 🧱 Pierre = +1 dura sur l'arme · 1 🧶 Laine brute = +1 dura sur une armure (panel dédié dans l'inventaire).</p>
          </div>

          {/* ── Amélioration des grades ── */}
          <div>
            <p className="font-heading font-semibold text-foreground mb-1">⚒️ Amélioration des grades (G0 → G5)</p>
            <p>• L'upgrade se fait <strong>en libre-service depuis l'onglet Combat</strong> (plus d'artisan intermédiaire).</p>
            <p>• Coût en 3 ressources T1 par palier : 🪵 Bois brut, 🪨 Minerai de fer, 🔮 Quartz brut.</p>
            <p>• Une armure coûte 96 bois + 96 fer + 30 quartz cumulés pour G0→G5. L'épée coûte 4× plus.</p>
            <p>• Cooldown par item : 1min (G0→G1), 2min, 4min, 8min, 16min (G4→G5). Parallélisable entre items différents.</p>
            <p>• Chaque grade donne +1 d'effet (G0=+1, G5=+6) et augmente le pourcentage de vol pour l'épée.</p>
          </div>

        </CardContent>
      </Card>

      {/* ── Modal défense ── */}
      {defenseTarget && (
        <ChallengeDefenseForm
          challenge={defenseTarget}
          defender={profile}
          onClose={() => setDefenseTarget(null)}
          onResolved={() => { setDefenseTarget(null); load(); }}
        />
      )}

      {/* ── Modal riposte (équivaut à un nouveau défi vers l'attaquant initial) ── */}
      {riposteOf && (() => {
        // Pour la riposte, on crée un nouveau ChallengeForm pré-paramétré.
        // L'attaquant de la riposte = défenseur initial (moi). La cible = attaquant initial.
        // On marque parent_challenge_id pour la traçabilité et on bypass la limite 1/jour.
        const ripostedTarget = {
          id: `riposte-${riposteOf.attacker_email}`,
          user_email: riposteOf.attacker_email,
          character_name: riposteOf.attacker_name,
          city_id: riposteOf.city_id,
          gold: 0, hp: 10,
          equipment: {}, inventory: [],
        };
        return (
          <ChallengeForm
            attacker={profile}
            target={ripostedTarget}
            city={{ id: riposteOf.city_id, name: riposteOf.city_name }}
            isRiposte={true}
            parentChallengeId={riposteOf.id}
            onClose={() => setRiposteOf(null)}
            onCreated={async () => {
              // Marquer le défi parent comme "riposte_used" pour empêcher une 2e riposte
              try {
                await base44.entities.CombatChallenge.update(riposteOf.id, { riposte_used: true });
              } catch (e) { /* silent */ }
              setRiposteOf(null);
              load();
            }}
          />
        );
      })()}
    </div>
  );
}
