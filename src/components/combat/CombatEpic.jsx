/**
 * src/components/combat/CombatEpic.jsx : Épopée quotidienne (V2 refonte)
 *
 * Orchestre l'enchaînement automatique des 5 vagues du combat de biome.
 *
 * Règles :
 *   - 1 seul lancement par jour, par joueur (pas par biome)
 *   - Les vagues s'enchaînent automatiquement V1 → V5
 *   - Les PV sont partagés entre les vagues ET avec le PvP (profile.hp en BDD)
 *   - Mort à 0 PV = combat fini, PV reset à 1 en sortant
 *   - Cataplasme utilisable entre 2 vagues (modal "Voulez-vous vous soigner ?")
 *   - Récompenses encaissées vague par vague (sauvegarde en BDD)
 *   - Si le joueur change de biome, il ne peut pas recommencer aujourd'hui
 *
 * Persistance BDD (PlayerProfile) :
 *   - combat_last_date     : "2026-04-29" : empêche de relancer le même jour
 *   - combat_active_biome  : "foret" : biome verrouillé pour cette épopée
 *   - combat_wave_index    : 0..4 : vague en cours
 *   - combat_total_gold    : or net cumulé
 *   - combat_total_drops   : nb de drops obtenus
 *
 * À la reprise après déconnexion : on reprend au début de la vague en cours
 * (pas de mid-tour resume).
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import CombatScreen from "./CombatScreen";
import {
  COMBAT_MAX_HP,
  isPlayerKO,
} from "@/lib/gameData";
import { ITEMS } from "@/lib/craftingData";
import { MAX_WAVES_PER_DAY, getPlayerMaxHP } from "@/lib/combatPvE";
import { BIOMES } from "@/lib/biomes";
import { getRareResourceFromBiome } from "@/lib/rareResources";
import { grantXP, XP_REWARDS } from "@/lib/playerLevelSystem";
import { logGold } from "@/lib/goldLog";
import { showXPToast } from "@/lib/xpToasts";
import { isBiomeBuffActive, activateBiomeBuff, getBiomeBuffRemainingMs } from "@/lib/playerBuffs";

// BIOME_NAMES retiré : utiliser BIOMES depuis @/lib/biomes (source de vérité unique).

// BIOME_RARES retiré : utiliser getRareResourceFromBiome() depuis @/lib/rareResources
// (source de vérité unique, partagée avec InventoryPanel et RareResourceActivator).

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function CombatEpic({ profile, biomeKey, onExit }) {
  const today = useMemo(() => getTodayStr(), []);
  const isResuming = profile?.combat_last_date === today
                  && profile?.combat_active_biome === biomeKey
                  && (profile?.combat_wave_index ?? 0) < MAX_WAVES_PER_DAY;
  // Phases internes :
  // - "intro"      : écran d'accueil avec bouton "Lancer le combat" (ou "Reprendre")
  // - "fighting"   : CombatScreen actif sur la vague courante
  // - "interlude"  : entre 2 vagues, propose le cataplasme
  // - "summary"    : récap final (épopée terminée)
  const [phase, setPhase] = useState("intro");

  // État local de l'épopée (synchronisé avec BDD quand on transitionne)
  const [waveIndex, setWaveIndex] = useState(profile?.combat_wave_index ?? 0);
  const [totalGold, setTotalGold] = useState(profile?.combat_total_gold ?? 0);
  const [totalDrops, setTotalDrops] = useState(profile?.combat_total_drops ?? 0);
  const [interludeData, setInterludeData] = useState(null); // rewards de la vague qui vient de finir
  const [busy, setBusy] = useState(false);
  // Local profile pour refléter les soins entre vagues (PV à jour)
  const [localProfile, setLocalProfile] = useState(profile);

  // Synchroniser localProfile avec les changements externes
  useEffect(() => {
    setLocalProfile(profile);
  }, [profile?.id, profile?.hp, profile?.inventory]);

  const biomeInfo = BIOMES[biomeKey] || { name: biomeKey, icon: "🗺️" };
  const biomeRare = getRareResourceFromBiome(biomeKey);

  // Conditions de blocage
  const isCombatDoneToday = profile?.combat_last_date === today
                          && profile?.combat_active_biome
                          && (profile?.combat_wave_index ?? 0) >= MAX_WAVES_PER_DAY;
  const isLockedAnotherBiome = profile?.combat_last_date === today
                            && profile?.combat_active_biome
                            && profile?.combat_active_biome !== biomeKey;

  // ── Démarrage / reprise ──
  const handleStart = async () => {
    if (busy) return;
    if (isPlayerKO(profile)) {
      toast.error("Vous êtes KO, impossible de lancer un combat.");
      return;
    }
    if (isCombatDoneToday) {
      toast.error("Vous avez déjà fait votre combat aujourd'hui.");
      return;
    }
    if (isLockedAnotherBiome) {
      toast.error(`Combat verrouillé : votre épopée du jour est en ${BIOMES[profile.combat_active_biome]?.name || profile.combat_active_biome}.`);
      return;
    }
    setBusy(true);
    try {
      // Démarrage initial : enregistre la date + le biome (premier lock)
      if (!isResuming) {
        await base44.entities.PlayerProfile.update(profile.id, {
          combat_last_date: today,
          combat_active_biome: biomeKey,
          combat_wave_index: 0,
          combat_total_gold: 0,
          combat_total_drops: 0,
        });
        setWaveIndex(0);
        setTotalGold(0);
        setTotalDrops(0);
      }
      setPhase("fighting");
    } catch (e) {
      console.error("Start epic error:", e);
      toast.error("Impossible de démarrer le combat.");
    } finally {
      setBusy(false);
    }
  };

  // ── Fin d'une vague (callback du CombatScreen) ──
  // finalState contient le state de fin, rewards = computeWaveRewards
  const handleWaveComplete = async (rewards, finalState) => {
    setBusy(true);
    try {
      const playerEndHp = finalState?.playerHP ?? localProfile.hp ?? COMBAT_MAX_HP;
      const isDead = finalState?.status === "dead";
      const isWaveCompleted = finalState?.status === "wave_complete";

      // CHOIX A (refonte v5) : le bonus PV de maîtrise est combat-only.
      // En BDD, on ne stocke jamais hp > COMBAT_MAX_HP (10) pour éviter que
      // les PV bonus "fuitent" hors du contexte de l'épopée (PvP, ville, etc.).
      // Mort = reset à 1 PV. Sinon, clamp à 10.
      const hpToStore = isDead ? 1 : Math.min(COMBAT_MAX_HP, playerEndHp);

      // Cumul des récompenses
      const newTotalGold = totalGold + (rewards?.gold || 0);
      const newDropsCount = totalDrops + (rewards?.dropCount || 0);
      // Drops à ajouter dans l'inventaire
      const dropsToAdd = (rewards?.drops || []).filter(d => d.key);

      // Construction des updates BDD
      const updates = {
        gold: (localProfile.gold || 0) + (rewards?.gold || 0),
        hp: hpToStore,
        combat_total_gold: newTotalGold,
        combat_total_drops: newDropsCount,
      };

      // Crédit de maîtrise biome : +1 point par mob tué (rewards.masteryGain = killCount)
      const masteryGain = rewards?.masteryGain || 0;
      if (masteryGain > 0) {
        const currentMastery = localProfile.biome_mastery || {};
        updates.biome_mastery = {
          ...currentMastery,
          [biomeKey]: (currentMastery[biomeKey] || 0) + masteryGain,
        };
      }

      // Bonus biome (+10% double prod / -10% cooldown pendant 1h) :
      // Attribué dès la 1ère vague complétée, pas de re-attribution si déjà actif.
      // Donné à tout le monde (peu importe la profession).
      if (isWaveCompleted) {
        if (!isBiomeBuffActive(localProfile)) {
          updates.biome_cooldown_bonus_value = 0.10;
          activateBiomeBuff(updates, { value: 0.10 });
        }
      }

      // Mise à jour inventaire si drops
      if (dropsToAdd.length > 0) {
        const newInventory = [...(localProfile.inventory || [])];
        for (const drop of dropsToAdd) {
          const existing = newInventory.find(i => i.item_key === drop.key);
          if (existing) {
            existing.quantity = (existing.quantity || 0) + 1;
          } else {
            newInventory.push({
              item_key: drop.key,
              item_name: biomeRare?.name || drop.key,
              item_category: "ressources_rares",
              quantity: 1,
            });
          }
        }
        updates.inventory = newInventory;
      }

      // Si la vague est complétée et qu'il en reste, on incrémente
      // Sinon (mort, fuite, hors-temps), l'épopée est finie
      const isLastWave = waveIndex >= MAX_WAVES_PER_DAY - 1;
      const continueEpic = isWaveCompleted && !isLastWave && !isDead;

      if (continueEpic) {
        updates.combat_wave_index = waveIndex + 1;
      } else {
        // Épopée terminée : on marque combat_wave_index au max pour bloquer
        updates.combat_wave_index = MAX_WAVES_PER_DAY;
      }

      // ── Gain XP combat : +1 par mob tué, +2 si vague complète, +10 si épopée finie ──
      const killCount = rewards?.killCount || 0;
      const isEpicEnd = !continueEpic && isLastWave && isWaveCompleted; // toutes vagues réussies
      let totalXP = killCount * XP_REWARDS.COMBAT_KILL;
      if (isWaveCompleted) totalXP += XP_REWARDS.COMBAT_WAVE_DONE;
      if (isEpicEnd)       totalXP += XP_REWARDS.COMBAT_EPIC_DONE;
      const xpGain = totalXP > 0 ? grantXP(localProfile, totalXP) : null;
      if (xpGain) Object.assign(updates, xpGain.updates);

      await base44.entities.PlayerProfile.update(profile.id, updates);

      // Toasts XP séparés (après l'update pour ne pas bloquer)
      if (xpGain) {
        showXPToast(totalXP, xpGain, { context: "combat épique" });
      }

      // Tx d'or
      if ((rewards?.gold || 0) > 0) {
        await logGold({
          profile,
          city: { id: profile.city_id, name: "" },  // CombatEpic n'a pas l'objet city, juste l'id
          amount: rewards.gold,
          type: "objectif",
          description: `Combat épique ${biomeInfo.name} V${waveIndex + 1} : +${rewards.gold}💰 (${rewards.killCount}/${3} mobs)`,
        });
      }

      setLocalProfile(prev => ({
        ...prev,
        gold: updates.gold,
        // En mémoire React on garde le HP réel (peut être > 10 avec maîtrise)
        // pour que les vagues suivantes héritent du bon HP de départ.
        // En BDD on stocke toujours min(hp, 10) : voir hpToStore plus haut.
        hp: isDead ? 1 : playerEndHp,
        inventory: updates.inventory || prev.inventory,
        biome_mastery: updates.biome_mastery || prev.biome_mastery,
        biome_cooldown_bonus_value: updates.biome_cooldown_bonus_value ?? prev.biome_cooldown_bonus_value,
        biome_double_prod_bonus: updates.biome_double_prod_bonus ?? prev.biome_double_prod_bonus,
        biome_cooldown_bonus_expires_at: updates.biome_cooldown_bonus_expires_at ?? prev.biome_cooldown_bonus_expires_at,
      }));
      setTotalGold(newTotalGold);
      setTotalDrops(newDropsCount);

      // Décision suivante
      if (continueEpic) {
        setWaveIndex(waveIndex + 1);
        setInterludeData({ rewards, finalState, nextWave: waveIndex + 1 });
        setPhase("interlude");
      } else {
        // Fin d'épopée
        setInterludeData({ rewards, finalState, ended: true, isDead, isLastWave: isWaveCompleted && isLastWave });
        setPhase("summary");
      }
    } catch (e) {
      console.error("Wave complete error:", e);
      toast.error("Erreur lors de la sauvegarde de la vague.");
    } finally {
      setBusy(false);
    }
  };

  // ── Cataplasme entre vagues ──
  const cataInInventory = (localProfile.inventory || []).find(i => i.item_key === "cataplasme" && (i.quantity || 0) > 0);
  // playerMaxHP = COMBAT_MAX_HP + bonus maîtrise pour ce biome (combat-only, jamais en BDD)
  const playerMaxHP = getPlayerMaxHP(localProfile, biomeKey);
  // currentHp en mémoire React peut dépasser COMBAT_MAX_HP grâce au bonus maîtrise.
  // On utilise localProfile.hp directement (sans passer par getPlayerHP qui clamp à 10)
  // mais on s'assure d'un fallback raisonnable et d'un clamp dans [0, playerMaxHP].
  const rawHp = (localProfile.hp === undefined || localProfile.hp === null) ? playerMaxHP : localProfile.hp;
  const currentHp = Math.max(0, Math.min(playerMaxHP, rawHp));
  const canHeal = cataInInventory && currentHp < playerMaxHP && currentHp > 0;

  const handleUseCataplasme = async () => {
    if (busy) return;
    if (!canHeal) return;
    setBusy(true);
    try {
      const cataDef = ITEMS["cataplasme"];
      // Le cataplasme peut soigner jusqu'à playerMaxHP (avec bonus maîtrise)
      const newHp = Math.min(playerMaxHP, currentHp + (cataDef?.value || 5));
      const inv = localProfile.inventory || [];
      const newInventory = inv.map(i => {
        if (i.item_key !== "cataplasme") return i;
        return { ...i, quantity: (i.quantity || 0) - 1 };
      }).filter(i => (i.quantity || 0) > 0);
      // En BDD on clamp toujours à COMBAT_MAX_HP (10) pour éviter fuite hors épopée
      await base44.entities.PlayerProfile.update(profile.id, {
        hp: Math.min(COMBAT_MAX_HP, newHp),
        inventory: newInventory,
      });
      // En mémoire React on garde le HP réel (peut être > 10)
      setLocalProfile(prev => ({ ...prev, hp: newHp, inventory: newInventory }));
      toast.success(`🩹 +${newHp - currentHp}❤️ (${newHp}/${playerMaxHP})`);
    } catch (e) {
      console.error("Cataplasme epic error:", e);
      toast.error("Erreur lors de l'application du cataplasme.");
    } finally {
      setBusy(false);
    }
  };

  const handleNextWave = () => {
    setInterludeData(null);
    setPhase("fighting");
  };

  const handleAbandon = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await base44.entities.PlayerProfile.update(profile.id, {
        combat_wave_index: MAX_WAVES_PER_DAY, // bloque pour aujourd'hui
      });
      setInterludeData({ rewards: null, finalState: null, ended: true, abandoned: true });
      setPhase("summary");
    } catch (e) {
      console.error("Abandon error:", e);
    } finally {
      setBusy(false);
    }
  };

  // Quitter le biome : lance le voyage retour vers la ville (2 minutes).
  // Cohérent avec le bouton "🏠 Quitter le biome" du BiomeHub.
  const handleExitBiome = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await base44.entities.PlayerProfile.update(profile.id, {
        is_traveling: true,
        travel_destination_id: profile.city_id,
        travel_arrival_time: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      });
      toast.success("🐴 Vous prenez le chemin du retour : la ville n'est plus qu'à quelques lieues.");
      onExit?.();
    } catch (e) {
      console.error("Exit biome error:", e);
      toast.error("Impossible de quitter le biome.");
    } finally {
      setBusy(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────

  // ── Phase intro ──
  if (phase === "intro") {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-xl font-heading text-center">
            {biomeInfo.icon} {biomeInfo.name}
          </h2>
          <p className="text-sm font-body text-center text-muted-foreground">
            Combat épique du jour : 5 vagues à enchaîner
          </p>

          {isLockedAnotherBiome && (
            <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 text-sm font-body text-orange-900">
              ⚠️ Vous avez démarré votre épopée du jour en{" "}
              <strong>{BIOMES[profile.combat_active_biome]?.name || profile.combat_active_biome}</strong>.
              Retournez-y pour la continuer.
            </div>
          )}

          {isCombatDoneToday && (
            <div className="bg-stone-100 border border-stone-300 rounded-lg p-3 text-sm font-body text-stone-700">
              ✅ Vous avez terminé votre combat du jour en {BIOMES[profile.combat_active_biome]?.name}.
              Revenez demain.
            </div>
          )}

          {!isLockedAnotherBiome && !isCombatDoneToday && (
            <>
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs font-body text-amber-900 space-y-1">
                <p>• 5 vagues qui s'enchaînent automatiquement</p>
                <p>• PV partagés avec le PvP : soyez prudent</p>
                <p>• <strong>Mort possible</strong> à 0 PV (PV remontent à 1 en sortant)</p>
                <p>• Cataplasme utilisable entre les vagues uniquement</p>
                <p>• Récompenses encaissées à chaque vague</p>
                <p>• Une fois lancé : pas de retour, pas d'autre biome</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-body space-y-1">
                <p>❤️ Vos PV : <strong>{currentHp}/{playerMaxHP}</strong>{playerMaxHP > COMBAT_MAX_HP && <span className="text-purple-700 text-xs ml-1">(+{playerMaxHP - COMBAT_MAX_HP} maîtrise)</span>}</p>
                {isResuming && (
                  <p className="text-purple-700">
                    🔄 Reprise possible : vague <strong>{waveIndex + 1}</strong>/5,
                    or accumulé : <strong>{totalGold}💰</strong>
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleStart}
                  disabled={busy || isPlayerKO(localProfile)}
                  className="flex-1 font-heading"
                >
                  {isResuming ? `🔄 Reprendre vague ${waveIndex + 1}/5` : "⚔️ Lancer le combat épique"}
                </Button>
                <Button onClick={handleExitBiome} variant="outline" className="font-body" disabled={busy}>
                  Quitter le biome
                </Button>
              </div>

              {isPlayerKO(localProfile) && (
                <p className="text-xs font-body text-red-700 text-center">
                  ❌ Vous êtes KO. Reposez-vous d'abord.
                </p>
              )}
            </>
          )}

          {(isLockedAnotherBiome || isCombatDoneToday) && (
            <Button onClick={handleExitBiome} variant="outline" className="w-full font-body" disabled={busy}>
              🏠 Quitter le biome
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Phase fighting : CombatScreen avec epicMode + skipIntro ──
  if (phase === "fighting") {
    return (
      <CombatScreen
        key={`epic-wave-${waveIndex}`} // force remount entre les vagues
        profile={localProfile}
        biomeKey={biomeKey}
        waveIndex={waveIndex}
        dayStr={today}
        biomeRareKey={biomeRare?.key}
        epicMode={true}
        skipIntro={true}
        startingHP={currentHp}
        onComplete={handleWaveComplete}
        onCancel={() => {/* en epicMode pas de cancel possible */}}
      />
    );
  }

  // ── Phase interlude (entre 2 vagues) ──
  if (phase === "interlude" && interludeData) {
    const r = interludeData.rewards;
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-4 text-center">
          <h2 className="text-xl font-heading">
            ✅ Vague {waveIndex} terminée !
          </h2>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm font-body text-emerald-900 space-y-1 text-left">
            <p>💰 +{r.gold} or {r.goldStolen > 0 && <span className="text-amber-800 text-xs">(volé : {r.goldStolen})</span>}</p>
            {r.dropCount > 0 && <p>✨ +{r.dropCount} {biomeRare?.name || "ressource"}</p>}
            <p>⭐ +{r.masteryGain} maîtrise</p>
          </div>

          {/* Bonus biome actif (1h) : affiché à toutes les vagues tant qu'il est encore actif */}
          {(() => {
            if (!isBiomeBuffActive(localProfile)) return null;
            const minsLeft = Math.max(0, Math.ceil(getBiomeBuffRemainingMs(localProfile) / 60000));
            return (
              <div className="bg-purple-50 border border-purple-300 rounded-lg p-2 text-xs font-body text-purple-900">
                ⚡ <strong>Bonus biome actif</strong> : +10% double prod / -10% cooldown · encore {minsLeft} min
              </div>
            );
          })()}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-body space-y-1">
            <p>❤️ PV : <strong>{currentHp}/{playerMaxHP}</strong>{playerMaxHP > COMBAT_MAX_HP && <span className="text-purple-700 text-xs ml-1">(+{playerMaxHP - COMBAT_MAX_HP} maîtrise)</span>}</p>
            <p className="text-xs text-muted-foreground">
              Cumul épopée : {totalGold}💰 · {totalDrops} drops
            </p>
          </div>

          {/* Modal cataplasme : visible si on a un cataplasme et qu'on n'est pas full HP */}
          {canHeal && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-lg p-3 space-y-2">
              <p className="text-sm font-body text-rose-900">
                🩹 Voulez-vous vous soigner avant la vague {waveIndex + 1} ?
              </p>
              <p className="text-xs font-body text-rose-800">
                Cataplasme disponible (×{cataInInventory.quantity}) : soigne +{ITEMS["cataplasme"]?.value || 5}❤️
              </p>
              <Button
                onClick={handleUseCataplasme}
                disabled={busy}
                size="sm"
                variant="outline"
                className="w-full bg-white"
              >
                Utiliser 1 cataplasme (PV : {currentHp} → {Math.min(playerMaxHP, currentHp + (ITEMS["cataplasme"]?.value || 5))})
              </Button>
            </div>
          )}
          {!canHeal && cataInInventory && currentHp >= playerMaxHP && (
            <p className="text-xs text-muted-foreground italic">PV au maximum, cataplasme inutile.</p>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleNextWave} disabled={busy} className="flex-1 font-heading">
              ⚔️ Affronter la vague {waveIndex + 1}/5
            </Button>
            <Button onClick={handleAbandon} disabled={busy} variant="outline" className="font-body">
              Abandonner
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Phase summary (fin d'épopée) ──
  if (phase === "summary" && interludeData) {
    const success = interludeData.isLastWave;
    const dead = interludeData.isDead;
    const abandoned = interludeData.abandoned;
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 space-y-4 text-center">
          <h2 className="text-2xl font-heading">
            {success ? "🏆 Épopée victorieuse !" :
             dead ? "💀 Mort au combat" :
             abandoned ? "🏳️ Combat abandonné" :
             "⏱️ Épopée interrompue"}
          </h2>

          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm font-body text-amber-900 text-left space-y-1">
            <p className="font-semibold mb-1">Récompenses totales :</p>
            <p>💰 <strong>{totalGold} or</strong> accumulés</p>
            <p>✨ <strong>{totalDrops}</strong> ressource{totalDrops > 1 ? "s" : ""} rare{totalDrops > 1 ? "s" : ""}</p>
          </div>

          {/* Bonus biome actif rappelé en fin d'épopée */}
          {(() => {
            if (!isBiomeBuffActive(localProfile)) return null;
            const minsLeft = Math.max(0, Math.ceil(getBiomeBuffRemainingMs(localProfile) / 60000));
            return (
              <div className="bg-purple-50 border border-purple-300 rounded-lg p-3 text-sm font-body text-purple-900">
                ⚡ <strong>Bonus biome actif</strong> : +10% double prod / -10% cooldown<br />
                <span className="text-xs">Encore actif pendant {minsLeft} min</span>
              </div>
            );
          })()}

          <p className="text-xs font-body text-muted-foreground italic">
            Revenez demain pour une nouvelle épopée.
          </p>

          <Button onClick={handleExitBiome} className="w-full font-heading" disabled={busy}>
            🏠 Quitter le biome
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 text-center text-muted-foreground">Chargement...</CardContent>
    </Card>
  );
}
