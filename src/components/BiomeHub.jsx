import { BIOMES } from "../lib/biomes";
import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getTodayDateStr, getCityTier, getMaxWeight, getInventoryWeight, applyRandomActionCost } from "../lib/gameData";
import { addToInventory } from "../lib/inventoryHelpers";
import CombatEpic from "./combat/CombatEpic";
import HelpTooltip from "./HelpTooltip";

// ──────────────────────────────────────────────
// RÉCOLTE AFK : config par biome
// Chaque biome rapporte la ressource T1 principale du métier associé
// ──────────────────────────────────────────────
const BIOME_HARVEST = {
  foret:   { item_key: "bois_brut",    item_name: "Bois brut",      item_category: "bois",      icon: "🪵" },
  champs:  { item_key: "ble",          item_name: "Blé",             item_category: "nourriture", icon: "🌾" },
  mine:    { item_key: "pierre",       item_name: "Pierre",          item_category: "pierre",    icon: "🧱" },
  atelier: { item_key: "laine_brute",  item_name: "Laine brute",     item_category: "tissu",     icon: "🧶" },
  forge:   { item_key: "minerai_fer",  item_name: "Minerai de fer",  item_category: "fer",       icon: "⚙️" },
  guilde:  { item_key: "tissu",        item_name: "Tissu",           item_category: "tissu",     icon: "🧵" },
};

const HARVEST_COST_PER_UNIT = 3;   // or détruit par unité récoltée
const HARVEST_RATE_MS = 7200000;   // 1 ressource toutes les 2h (en ms)

/** Calcule les ressources récoltées depuis harvest_started_at, limitées par l'inventaire et l'or */
function computeHarvestAccumulated(profile, biomeKey) {
  if (!profile.harvest_started_at || profile.harvest_biome_key !== biomeKey) return 0;
  const elapsed = Date.now() - new Date(profile.harvest_started_at).getTime();
  const hoursRaw = Math.floor(elapsed / HARVEST_RATE_MS);
  if (hoursRaw <= 0) return 0;

  // Limité par l'or disponible
  const maxByGold = Math.floor((profile.gold || 0) / HARVEST_COST_PER_UNIT);

  // Limité par la place dans l'inventaire
  const currentWeight = getInventoryWeight(profile);
  const maxWeight = getMaxWeight(profile);
  const freeSlots = Math.max(0, maxWeight - currentWeight);

  const HARVEST_MAX = 4; // plafond session AFK
  return Math.min(hoursRaw, maxByGold, freeSlots, HARVEST_MAX);
}

/** Retourne les heures effectivement facturables (or suffisant) */
function computeHarvestHours(profile, biomeKey) {
  if (!profile.harvest_started_at || profile.harvest_biome_key !== biomeKey) return 0;
  const elapsed = Date.now() - new Date(profile.harvest_started_at).getTime();
  return Math.floor(elapsed / HARVEST_RATE_MS);
}

// 12 monstres génériques
const MONSTERS_DATA = [
  { name: "Gobelin", icon: "👹" },
  { name: "Loup", icon: "🐺" },
  { name: "Corbeau", icon: "🐦" },
  { name: "Ombre", icon: "👻" },
  { name: "Brigand", icon: "🗡️" },
  { name: "Élémental", icon: "🔥" },
  { name: "Vampire", icon: "🧛" },
  { name: "Dragon mineur", icon: "🐉" },
  { name: "Squelette", icon: "💀" },
  { name: "Golem", icon: "🗿" },
  { name: "Sorcière", icon: "🧙" },
  { name: "Troll", icon: "👺" },
];

// Ressources rares par biome avec métiers associés
const BIOME_RARES = {
  foret:   { key: "essence_foret",      name: "Essence forestière",  icon: "🌿", professions: ["Bûcheron", "Alchimiste"] },
  champs:  { key: "poussiere_moisson",  name: "Poussière de récolte",icon: "🌾", professions: ["Fermier"] },
  mine:    { key: "fragment_cristal",   name: "Fragment cristallin", icon: "💎", professions: ["Mineur"] },
  atelier: { key: "fil_enchante",       name: "Fil enchanté",        icon: "✨", professions: ["Tisserand"] },
  forge:   { key: "cendre_forge",       name: "Cendre de forge",     icon: "🔥", professions: ["Forgeron", "Orfèvre"] },
  guilde:  { key: "piece_ancienne",     name: "Pièce d'or ancienne", icon: "🪙", professions: ["Marchand"] },
};

function generateMonstresForDay(biomeKey) {
  const today = getTodayDateStr();
  const seed = today + biomeKey;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const monstres = [];
  const rng = Math.abs(hash);
  for (let i = 0; i < 5; i++) {
    const monsterIdx = (rng + i) % MONSTERS_DATA.length;
    const monster = MONSTERS_DATA[monsterIdx];
    const score = ((rng + i) % 3) + 1;
    monstres.push({
      id: `${biomeKey}_${i}_${today}`,
      name: monster.name,
      icon: monster.icon,
      score,
      combattu: false,
    });
  }
  return monstres;
}

function getWinProbability(playerScore, monsterScore) {
  const diff = playerScore - monsterScore;
  if (diff === 0) return 0.80;
  if (diff === 1) return 0.85;
  if (diff === 2) return 0.90;
  if (diff === 3) return 0.95;
  if (diff >= 4) return 1.00;
  if (diff === -1) return 0.70;
  if (diff === -2) return 0.40;
  if (diff === -3) return 0.20;
  return 0.05;
}

function getRareDropRate(monsterScore, hasMetierBonus = false) {
  const base = monsterScore === 1 ? 0.10 : monsterScore === 2 ? 0.12 : 0.15;
  return hasMetierBonus ? base + 0.05 : base;
}

const BIOME_TRAVEL_TIMES = {
  foret: 5, champs: 5, mine: 8, atelier: 10, forge: 10, guilde: 12,
};

const MASTERY_TIERS = [
  { points: 50, level: 1, bonusDropPercent: 5 },
  { points: 150, level: 2, bonusDropPercent: 10 },
  { points: 300, level: 3, bonusDropPercent: 15 },
  { points: 600, level: 4, bonusDropPercent: 20 },
];

function getMasteryInfo(biomeKey, masteryData) {
  const points = (masteryData || {})[biomeKey] || 0;
  let level = 0, bonusPercent = 0, nextTier = MASTERY_TIERS[0];
  for (const tier of MASTERY_TIERS) {
    if (points >= tier.points) { level = tier.level; bonusPercent = tier.bonusDropPercent; nextTier = null; }
  }
  if (!nextTier) nextTier = MASTERY_TIERS[MASTERY_TIERS.length - 1];
  return { points, level, bonusPercent, nextTier };
}

/**
 * Résoudre un combat : déterministe via le timestamp de début.
 * Écrit le résultat en BDD et retourne { victory, goldReward, rareDropped, rareKey, monsterName, monsterIcon }.
 */
async function resolveCombat(profile, biomeKey, biomeData, monsterId) {
  const hasMetierBonus = BIOME_RARES[biomeKey].professions.includes(profile.profession);
  // Refonte avril 2026 : retrait de l'apport des items combat sur les monstres.
  // Le score joueur est désormais basé uniquement sur la maîtrise du biome.
  // (système combat zoné réservé au PvP)
  const masteryInfo = getMasteryInfo(biomeKey, profile.biome_mastery);
  const playerScore = masteryInfo?.level || 0;

  const monster = (biomeData?.monstres_du_jour || []).find(m => m.id === monsterId);
  if (!monster) return null;

  const winProb = getWinProbability(playerScore, monster.score);

  // Seed déterministe : timestamp de début + id monstre
  const seed = (profile.biome_combat_started_at || "") + monsterId;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const rng1 = (Math.abs(hash) % 10000) / 10000;
  const rng2 = (Math.abs(hash * 31 + 7) % 10000) / 10000;

  const victory = rng1 < winProb;
  let goldReward = 0, rareDropped = false, rareKey = null;
  let newInventory = [...(profile.inventory || [])];

  // Note (avril 2026) : la consommation faim/énergie a été déplacée au lancement
  // du combat (handleCombat) pour éviter que la résolution plante si le joueur
  // est à 0 entre-temps. Plus aucune logique de durabilité ici (système combat
  // zoné : les items combat ne servent plus contre les monstres).

  if (victory) {
    goldReward = monster.score === 1 ? 5 : monster.score === 2 ? 7 : 10;
    const masteryInfo = getMasteryInfo(biomeKey, profile.biome_mastery);
    let rareRate = getRareDropRate(monster.score, hasMetierBonus) + (masteryInfo.bonusPercent / 100);
    if (rng2 < rareRate) {
      rareKey = BIOME_RARES[biomeKey].key;
      const existing = newInventory.find(i => i.item_key === rareKey);
      if (existing) { existing.quantity += 1; }
      else {
        newInventory.push({
          item_key: rareKey,
          item_name: BIOME_RARES[biomeKey].name,
          item_category: "ressources_rares",
          quantity: 1,
        });
      }
      rareDropped = true;
    }
  }

  const today = getTodayDateStr();
  const freshProfile = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
  const currentGold = freshProfile ? (freshProfile.gold || 0) : (profile.gold || 0);
  const profileUpdates = {
    gold: currentGold + goldReward,
    inventory: newInventory,
    biome_combat_resolved: true,
    biome_combat_result: { victory, goldReward, rareDropped, rareKey, monsterName: monster.name, monsterIcon: monster.icon },
    daily_combats_count: (profile.daily_combats_date === today ? (profile.daily_combats_count || 0) : 0) + 1,
    daily_combats_date: today,
  };

  if (victory) {
    const currentMastery = profile.biome_mastery || {};
    profileUpdates.biome_mastery = { ...currentMastery, [biomeKey]: (currentMastery[biomeKey] || 0) + 1 };
    const bonusActive = profile?.biome_cooldown_bonus_expires_at && new Date(profile.biome_cooldown_bonus_expires_at) > new Date();
    if (hasMetierBonus && !bonusActive) {
      profileUpdates.biome_cooldown_bonus_value = 0.10;
      profileUpdates.biome_double_prod_bonus = 0.10;
      profileUpdates.biome_cooldown_bonus_expires_at = new Date(Date.now() + 3600000).toISOString();
    }
  }

  await base44.entities.PlayerProfile.update(profile.id, profileUpdates);

  if (goldReward > 0) {
    await base44.entities.GoldTransaction.create({
      player_email: profile.user_email,
      player_name: profile.character_name || "",
      city_id: "", city_name: "",
      amount: goldReward,
      type: "objectif",
      description: `Combat biome : victoire contre ${monster.name} (${biomeKey})`,
    }).catch(() => {});
  }

  const newMonstres = (biomeData.monstres_du_jour || []).map(m =>
    m.id === monsterId ? { ...m, combattu: true } : m
  );
  await base44.entities.Biome.update(biomeData.id, {
    combats_restants: Math.max(0, (biomeData.combats_restants || 5) - 1),
    monstres_du_jour: newMonstres,
  });

  return { victory, goldReward, rareDropped, rareKey, monsterName: monster.name, monsterIcon: monster.icon };
}

export default function BiomeHub({ profile, biomeKey, biomeInfo, city, onRefresh }) {
  const [biomeData, setBiomeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [departing, setDeparting] = useState(false);
  const [combatCountdown, setCombatCountdown] = useState(0);
  const [showResultPopup, setShowResultPopup] = useState(null);
  const [launching, setLaunching] = useState(false);
  const [activeTab, setActiveTab] = useState("combat"); // "combat" | "harvest"
  const [harvestAccumulated, setHarvestAccumulated] = useState(0); // compteur live
  const [harvestNextIn, setHarvestNextIn] = useState(0); // secondes avant prochaine ressource
  const [collectingHarvest, setCollectingHarvest] = useState(false);
  // ── Phase 2 (test) : combat tactique V2 ──
  const countdownRef = useRef(null);
  const harvestTimerRef = useRef(null);
  const profileRef = useRef(profile);
  const biomeDataRef = useRef(null);

  // Tenir les refs à jour pour accès dans les intervalles
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { biomeDataRef.current = biomeData; }, [biomeData]);

  // ── Timer récolte AFK ──
  useEffect(() => {
    clearInterval(harvestTimerRef.current);
    const isHarvesting = profile.harvest_started_at && profile.harvest_biome_key === biomeKey;
    if (!isHarvesting) {
      setHarvestAccumulated(0);
      setHarvestNextIn(0);
      return;
    }
    const tick = () => {
      const p = profileRef.current;
      setHarvestAccumulated(computeHarvestAccumulated(p, biomeKey));
      const elapsed = Date.now() - new Date(p.harvest_started_at).getTime();
      const msIntoSlot = elapsed % HARVEST_RATE_MS;
      setHarvestNextIn(Math.ceil((HARVEST_RATE_MS - msIntoSlot) / 1000));
    };
    tick();
    harvestTimerRef.current = setInterval(tick, 1000);
    return () => clearInterval(harvestTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.harvest_started_at, profile.harvest_biome_key, biomeKey]);

  function startCountdown(remaining) {
    clearInterval(countdownRef.current);
    let rem = remaining;
    setCombatCountdown(rem);
    countdownRef.current = setInterval(async () => {
      rem -= 1;
      setCombatCountdown(rem);
      if (rem <= 0) {
        clearInterval(countdownRef.current);
        setCombatCountdown(0);
        const p = profileRef.current;
        const b = biomeDataRef.current;
        if (p && b && p.biome_combat_monster_id) {
          const result = await resolveCombat(p, biomeKey, b, p.biome_combat_monster_id);
          if (result) setShowResultPopup(result);
          onRefresh?.();
        }
      }
    }, 1000);
  }

  useEffect(() => {
    async function loadBiome() {
      setLoading(true);
      const today = getTodayDateStr();
      const existing = await base44.entities.Biome.filter({
        player_email: profile.user_email,
        biome_key: biomeKey,
      });

      let biome = existing[0];
      if (!biome || biome.date !== today) {
        const newMonstres = generateMonstresForDay(biomeKey);
        const data = { player_email: profile.user_email, biome_key: biomeKey, date: today, combats_restants: 5, monstres_du_jour: newMonstres };
        if (biome) { await base44.entities.Biome.update(biome.id, data); biome = { ...biome, ...data }; }
        else { biome = await base44.entities.Biome.create(data); }
      }
      setBiomeData(biome);
      biomeDataRef.current = biome;

      // --- Résolution au montage ---
      const hasPendingCombat = profile.biome_combat_started_at && profile.biome_combat_resolved === false;
      if (hasPendingCombat) {
        const startedAt = new Date(profile.biome_combat_started_at).getTime();
        const duration = (profile.biome_combat_duration ?? 30) * 1000;
        const elapsed = Date.now() - startedAt;

        if (elapsed >= duration) {
          // Temps écoulé → résoudre immédiatement
          const result = await resolveCombat(profile, biomeKey, biome, profile.biome_combat_monster_id);
          if (result) setShowResultPopup(result);
          onRefresh?.();
        } else {
          // Encore en cours → reprendre le countdown
          const remaining = Math.ceil((duration - elapsed) / 1000);
          startCountdown(remaining);
        }
      }

      // Résultat résolu mais pas encore vu
      if (profile.biome_combat_resolved === true && profile.biome_combat_result) {
        setShowResultPopup(profile.biome_combat_result);
      }

      setLoading(false);
    }
    loadBiome();
    return () => clearInterval(countdownRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.user_email, biomeKey]);

  const handleStartTravel = async () => {
    if (departing) return;
    // Système unifié : 1 point aléatoire faim/énergie
    const costResult = applyRandomActionCost(profile, 1);
    if (!costResult.ok) { toast.error(costResult.errorMessage); return; }
    setDeparting(true);
    try {
      await base44.entities.PlayerProfile.update(profile.id, {
        is_traveling: true,
        travel_destination_id: `biome:${biomeKey}`,
        travel_arrival_time: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        hunger:  costResult.newHunger,
        fatigue: costResult.newFatigue,
      });
      toast.success(`🐴 Votre monture s'élance vers ${biomeInfo.name} : soyez prêt au combat dans 2 min.`);
      onRefresh?.();
    } catch { toast.error("Erreur lors du départ."); }
    finally { setDeparting(false); }
  };

  const handleCombat = async (monster) => {
    if (launching) return;

    // Bloquer si combat déjà en cours
    if (profile.biome_combat_started_at && profile.biome_combat_resolved === false) {
      toast.error("Vous êtes déjà en pleine mêlée : finissez ce combat avant d'en chercher un autre !");
      return;
    }

    const today = getTodayDateStr();
    const combatsToday = profile.daily_combats_date === today ? (profile.daily_combats_count || 0) : 0;
    if (combatsToday >= maxCombats) {
      toast.error(`Vos bras réclament le repos : vous avez déjà livré ${maxCombats} batailles aujourd'hui. Demain, la chasse reprend.`);
      return;
    }

    setLaunching(true);
    const COMBAT_DURATION = 30;
    try {
      // Système unifié : 1 point aléatoire faim/énergie consommé AU LANCEMENT
      // (la résolution ne consomme plus rien, pour éviter qu'elle reste bloquée
      // si le joueur est à 0 entre-temps)
      const costResult = applyRandomActionCost(profile, 1);
      if (!costResult.ok) {
        toast.error(costResult.errorMessage);
        setLaunching(false);
        return;
      }
      await base44.entities.PlayerProfile.update(profile.id, {
        biome_combat_started_at: new Date().toISOString(),
        biome_combat_monster_id: monster.id,
        biome_combat_duration: COMBAT_DURATION,
        biome_combat_resolved: false,
        biome_combat_result: null,
        hunger:  costResult.newHunger,
        fatigue: costResult.newFatigue,
      });
      onRefresh?.();
      startCountdown(COMBAT_DURATION);
      toast.success(`⚔️ Vous chargez ${monster.icon} ${monster.name} : que les dieux vous soient favorables !`);
    } catch { toast.error("Erreur au lancement du combat."); }
    finally { setLaunching(false); }
  };

  const handleDismissResult = async () => {
    await base44.entities.PlayerProfile.update(profile.id, {
      biome_combat_started_at: null,
      biome_combat_monster_id: null,
      biome_combat_duration: 30,
      biome_combat_resolved: false,
      biome_combat_result: null,
    });
    setShowResultPopup(null);
    onRefresh?.();
  };

  // ── Démarrer la récolte AFK ──
  const handleStartHarvest = async () => {
    if ((profile.gold || 0) < HARVEST_COST_PER_UNIT) {
      toast.error("Votre bourse est vide : il faut au moins 1 💰 pour envoyer vos serfs aux champs.");
      return;
    }
    const currentWeight = getInventoryWeight(profile);
    const maxWeight = getMaxWeight(profile);
    if (currentWeight >= maxWeight) {
      toast.error("Votre besace déborde : faites de la place avant d'envoyer vos serfs travailler.");
      return;
    }
    try {
      await base44.entities.PlayerProfile.update(profile.id, {
        harvest_started_at: new Date().toISOString(),
        harvest_biome_key: biomeKey,
        harvest_gold_spent: 0,
      });
      toast.success(`🌿 Vos serfs s'en vont au labeur : ils rapporteront ${BIOME_HARVEST[biomeKey]?.item_name} à votre retour. ${HARVEST_COST_PER_UNIT} 💰 par unité récoltée.`);
      onRefresh?.();
    } catch (e) {
      toast.error("Erreur au démarrage de la récolte.");
    }
  };

  // ── Collecter la récolte accumulée ──
  const handleCollectHarvest = async () => {
    if (collectingHarvest) return;
    setCollectingHarvest(true);
    try {
      const freshProfile = await base44.entities.PlayerProfile.get(profile.id);
      const qty = computeHarvestAccumulated(freshProfile, biomeKey);
      const hours = computeHarvestHours(freshProfile, biomeKey);
      const goldCost = Math.min(hours, Math.floor((freshProfile.gold || 0) / HARVEST_COST_PER_UNIT));
      const actualQty = Math.min(qty, goldCost);

      if (actualQty <= 0) {
        toast.info("Vos serfs peinent encore sous le soleil : revenez les voir dans quelques instants.");
        setCollectingHarvest(false);
        return;
      }

      const harvest = BIOME_HARVEST[biomeKey];
      const newInventory = addToInventory(
        freshProfile.inventory,
        harvest.item_key,
        actualQty,
        {
          item_name: harvest.item_name,
          item_category: harvest.item_category,
        }
      );

      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: newInventory,
        gold: Math.max(0, (freshProfile.gold || 0) - actualQty * HARVEST_COST_PER_UNIT),
        harvest_started_at: null,
        harvest_biome_key: null,
        harvest_gold_spent: 0,
      });

      await base44.entities.GoldTransaction.create({
        player_email: profile.user_email,
        player_name: profile.character_name || "",
        city_id: "", city_name: "",
        amount: -actualQty * HARVEST_COST_PER_UNIT,
        type: "objectif",
        description: `Récolte AFK biome ${biomeKey} : −${actualQty * HARVEST_COST_PER_UNIT} 💰 pour ${actualQty} ${harvest.item_name}`,
      }).catch(() => {});

      toast.success(`🎒 Vos serfs rentrent les bras chargés ! +${actualQty} ${harvest.icon} ${harvest.item_name} : −${actualQty * HARVEST_COST_PER_UNIT} 💰 de gages.`);
      onRefresh?.();
    } catch (e) {
      // Log complet en console pour le debug, et message plus parlant pour le joueur
      console.error("[BiomeHub] Erreur collecte serfs:", e);
      const detail = e?.data?.message || e?.message || "Erreur inconnue";
      toast.error(`Erreur lors de la collecte : ${detail}`);
    } finally {
      setCollectingHarvest(false);
    }
  };

  // ── Arrêter la récolte (sans collecter) ──
  const handleStopHarvest = async () => {
    // On collecte d'abord ce qui est accumulé, puis on stoppe
    await handleCollectHarvest();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const biomeDestKey = `biome:${biomeKey}`;
  const isInTravel = profile.is_traveling && profile.travel_destination_id === biomeDestKey;
  const isAtBiome = !profile.is_traveling && profile.travel_destination_id === biomeDestKey;

  let travelTimeRemaining = 0;
  if (isInTravel && profile.travel_arrival_time) {
    travelTimeRemaining = Math.max(0, Math.ceil((new Date(profile.travel_arrival_time).getTime() - Date.now()) / 1000));
  }

  const masteryInfoForDisplay = getMasteryInfo(biomeKey, profile.biome_mastery);
  const playerAttack = masteryInfoForDisplay?.level || 0;
  const monstresDisponibles = (biomeData?.monstres_du_jour || []).filter(m => !m.combattu);
  const hasMetierBonus = BIOME_RARES[biomeKey].professions.includes(profile.profession);
  const cityTier = getCityTier(city?.lingots_cumul || 0);
  const maxCombats = 5 + (cityTier.extraBiomeCombat || 0);

  const combatInProgress = profile.biome_combat_started_at && profile.biome_combat_resolved === false;
  const activeMonsterId = combatInProgress ? profile.biome_combat_monster_id : null;
  const activeMonster = activeMonsterId ? (biomeData?.monstres_du_jour || []).find(m => m.id === activeMonsterId) : null;

  // Voyage en cours
  if (isInTravel && travelTimeRemaining > 0) {
    const mins = Math.floor(travelTimeRemaining / 60);
    const secs = travelTimeRemaining % 60;
    return (
      <div className="space-y-6 pb-20 md:pb-0">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 via-card to-accent/10 border border-border p-6">
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-3">
              <span className="text-5xl">🐴</span>
              <h2 className="font-heading text-2xl font-bold">En voyage vers le {biomeInfo.name}</h2>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-lg text-blue-900 font-heading mb-2">Temps restant</p>
              <p className="text-3xl font-bold text-blue-700">{mins}m {secs}s</p>
            </div>
            <div className="bg-card rounded-lg p-4 border border-border">
              <p className="text-sm font-body text-muted-foreground">ℹ️ Pendant votre voyage, vous pouvez continuer vos activités en ville. Les combats commenceront une fois arrivé.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pas encore au biome
  if (!isAtBiome && !isInTravel) {
    return (
      <div className="space-y-6 pb-20 md:pb-0">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 via-card to-accent/10 border border-border p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{biomeInfo.icon}</span>
              <div>
                <h2 className="font-heading text-2xl font-bold">{biomeInfo.name}</h2>
                <p className="text-sm text-muted-foreground font-body">{biomeInfo.description}</p>
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="font-heading font-semibold text-orange-900 mb-2">⏳ Prêt à commencer votre aventure ?</p>
              <Button onClick={handleStartTravel} disabled={departing} className="w-full font-heading">
                {departing ? "Départ..." : `🐴 Partir vers le ${biomeInfo.name} (2 min)`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">

      {/* ══ Popup résultat de combat ══ */}
      {showResultPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className={`rounded-2xl border-2 p-6 max-w-sm w-full shadow-2xl space-y-4 ${
            showResultPopup.victory ? "bg-green-50 border-green-400" : "bg-red-50 border-red-400"
          }`}>
            <div className="text-center">
              <div className="text-5xl mb-2">{showResultPopup.victory ? "🏆" : "💀"}</div>
              <h3 className={`font-heading text-2xl font-bold ${showResultPopup.victory ? "text-green-800" : "text-red-800"}`}>
                {showResultPopup.victory ? "Victoire !" : "Défaite..."}
              </h3>
              <p className="text-sm font-body text-muted-foreground mt-1">
                Contre {showResultPopup.monsterIcon} {showResultPopup.monsterName}
              </p>
            </div>

            {showResultPopup.victory ? (
              <div className="space-y-2">
                <div className="bg-white rounded-lg p-3 border border-green-200 flex items-center gap-3">
                  <span className="text-2xl">💰</span>
                  <div>
                    <p className="font-heading font-semibold text-green-800">+{showResultPopup.goldReward} or</p>
                    <p className="text-xs font-body text-green-700">Récompense de victoire</p>
                  </div>
                </div>
                {showResultPopup.rareDropped ? (
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-300 flex items-center gap-3">
                    <span className="text-2xl">{BIOME_RARES[biomeKey]?.icon}</span>
                    <div>
                      <p className="font-heading font-semibold text-amber-800">🎁 {BIOME_RARES[biomeKey]?.name}</p>
                      <p className="text-xs font-body text-amber-700">Ressource rare obtenue !</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-body text-muted-foreground text-center">Pas de drop rare cette fois…</p>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg p-3 border border-red-200">
                <p className="text-sm font-body text-red-700 text-center">Pas de butin ce coup-ci. Tentez votre chance ailleurs ou plus tard.</p>
              </div>
            )}

            <Button
              className={`w-full font-heading ${showResultPopup.victory ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
              onClick={handleDismissResult}
            >
              Continuer
            </Button>
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 via-card to-accent/10 border border-border p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-4xl">{biomeInfo.icon}</span>
            <div>
              <h2 className="font-heading text-2xl font-bold">{biomeInfo.name}</h2>
              <p className="text-sm text-muted-foreground font-body">{biomeInfo.description}</p>
            </div>
          </div>

          {(() => {
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs font-body text-amber-800">
                  🎁 Ressource rare : <strong>{BIOME_RARES[biomeKey].name}</strong>
                </p>
              </div>
            );
          })()}

          <div className="flex flex-wrap gap-4 text-sm font-body">
            <span>💰 Or : <strong>{profile.gold || 0}</strong></span>
            <span>🎖️ Maîtrise : <strong>Niv. {playerAttack}</strong></span>
            {(() => {
              const today = getTodayDateStr();
              const combatsToday = profile.daily_combats_date === today ? (profile.daily_combats_count || 0) : 0;
              return <span>🎯 Combats du jour : <strong>{combatsToday}/{maxCombats}</strong></span>;
            })()}
            {profile.biome_cooldown_bonus_expires_at && new Date(profile.biome_cooldown_bonus_expires_at) > new Date() && (
              <span className="text-green-700 font-bold">⚡ -10% cooldown · 10% dbl prod actif</span>
            )}
          </div>

          {(() => {
            const masteryInfo = getMasteryInfo(biomeKey, profile.biome_mastery);
            const nextTier = MASTERY_TIERS.find(t => t.points > masteryInfo.points);
            const masteryTooltipText =
              "Gagnez 1 point de maîtrise par monstre tué dans ce biome lors de l'épopée quotidienne.\n\n" +
              "Paliers (bonus permanents) :\n" +
              "• Niv. 1 (50 pts) : +1 PV max · +5% or\n" +
              "• Niv. 2 (150 pts) : +2 PV max · +10% or\n" +
              "• Niv. 3 (300 pts) : +3 PV max · +15% or\n" +
              "• Niv. 4 (600 pts) : +4 PV max · +20% or\n\n" +
              "Les bonus sont permanents et spécifiques à ce biome.";
            return (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-heading font-semibold text-blue-900">🎖️ Maîtrise du biome</span>
                    <HelpTooltip text={masteryTooltipText} side="bottom" />
                  </div>
                  {masteryInfo.level > 0 && (
                    <Badge variant="secondary" className="font-heading text-blue-700 bg-blue-100">
                      Niv. {masteryInfo.level}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Progress value={Math.min(100, (masteryInfo.points / (nextTier?.points || 600)) * 100)} />
                  </div>
                  <span className="text-xs font-body text-blue-700 whitespace-nowrap">
                    {masteryInfo.points}{nextTier ? `/${nextTier.points}` : " MAX"}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Sélecteur Combat / Récolte ── */}
      <div className="flex gap-2 bg-muted/40 rounded-xl p-1">
        <button
          className={`flex-1 py-2 px-4 rounded-lg font-heading font-semibold text-sm transition-all ${
            activeTab === "combat"
              ? "bg-card shadow border border-border text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("combat")}
        >
          ⚔️ Combat
        </button>
        <button
          className={`flex-1 py-2 px-4 rounded-lg font-heading font-semibold text-sm transition-all ${
            activeTab === "harvest"
              ? "bg-card shadow border border-border text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("harvest")}
        >
          🌿 Récolte AFK
        </button>
      </div>

      {/* ══════════════════ ONGLET COMBAT ══════════════════ */}
      {activeTab === "combat" && (
        <CombatEpic
          profile={profile}
          biomeKey={biomeKey}
          onExit={() => {
            // Recharge les données depuis la BDD pour refléter l'état mis à jour
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* ══════════════════ ONGLET RÉCOLTE AFK ══════════════════ */}
      {activeTab === "harvest" && (() => {
        const harvest = BIOME_HARVEST[biomeKey];
        const isHarvesting = !!profile.harvest_started_at && profile.harvest_biome_key === biomeKey;
        const currentWeight = getInventoryWeight(profile);
        const maxWeight = getMaxWeight(profile);
        const freeSlots = Math.max(0, maxWeight - currentWeight);
        const maxUnitsGold = Math.floor((profile.gold || 0) / HARVEST_COST_PER_UNIT);
        const canAfford = (profile.gold || 0) >= HARVEST_COST_PER_UNIT;
        const inventoryFull = freeSlots <= 0;
        const formatCountdown = (s) => {
          const m = Math.floor(s / 60);
          const sec = s % 60;
          return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
        };

        return (
          <div className="space-y-4">
            {/* Info ressource */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-4">
              <span className="text-4xl">{harvest?.icon}</span>
              <div className="flex-1">
                <p className="font-heading font-semibold text-emerald-900">{harvest?.item_name}</p>
                <p className="text-xs font-body text-emerald-700">
                  Ressource T1 de ce biome · 1 unité / 2h · Hors ligne ou en ligne
                </p>
              </div>
            </div>

            {/* Règles */}
            <div className="bg-muted/40 rounded-lg px-4 py-3 space-y-1.5 text-sm font-body">
              <div className="flex justify-between">
                <span className="text-muted-foreground">⏱️ Cadence</span>
                <span className="font-semibold">1 {harvest?.item_name} / 2h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">💰 Coût</span>
                <span className="font-semibold text-amber-700">{HARVEST_COST_PER_UNIT} or / unité (détruit)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">🎒 Inventaire</span>
                <span className={`font-semibold ${inventoryFull ? "text-red-600" : "text-foreground"}`}>
                  {currentWeight}/{maxWeight} ({freeSlots} libre{freeSlots !== 1 ? "s" : ""})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">💰 Or disponible</span>
                <span className={`font-semibold ${!canAfford ? "text-red-600" : "text-foreground"}`}>
                  {profile.gold || 0} or (~{maxUnitsGold} unité{maxUnitsGold !== 1 ? "s" : ""} payable{maxUnitsGold !== 1 ? "s" : ""})
                </span>
              </div>
            </div>

            {/* Avertissements */}
            {!canAfford && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm font-body text-red-800">
                ⚠️ Votre bourse est vide : il faut au moins {HARVEST_COST_PER_UNIT} 💰 pour payer vos serfs.
              </div>
            )}
            {inventoryFull && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm font-body text-red-800">
                ⚠️ Votre besace déborde : faites de la place avant de renvoyer vos serfs.
              </div>
            )}

            {/* État : EN COURS */}
            {isHarvesting && (
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl animate-pulse">🌿</span>
                  <div>
                    <p className="font-heading font-semibold text-emerald-900">Vos serfs sont au labeur…</p>
                    <p className="text-xs font-body text-emerald-700">
                      En mission depuis le {new Date(profile.harvest_started_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>

                {/* Ce que vos serfs ont ramassé */}
                <div className="bg-white rounded-lg border border-emerald-200 p-4 text-center">
                  <p className="text-xs font-body text-muted-foreground mb-1">Ce que vos serfs ont ramassé</p>
                  <p className="text-4xl font-bold font-heading text-emerald-700">
                    {harvestAccumulated} <span className="text-2xl">{harvest?.icon}</span>
                  </p>
                  <p className="text-xs font-body text-muted-foreground mt-1">
                    Prochain retour dans : <strong>{harvestNextIn > 0 ? formatCountdown(harvestNextIn) : "-"}</strong>
                  </p>
                </div>

                {/* Limites actives */}
                <div className="text-xs font-body text-emerald-700 space-y-1">
                  {freeSlots <= 3 && freeSlots > 0 && (
                    <p>⚠️ La besace se remplit : encore {freeSlots} place{freeSlots > 1 ? "s" : ""} avant que vos serfs ne rentrent bredouilles.</p>
                  )}
                  {inventoryFull && (
                    <p className="text-red-700 font-semibold">🛑 Besace pleine : vos serfs ont posé leur charge et attendent !</p>
                  )}
                  {maxUnitsGold <= 2 && canAfford && (
                    <p>⚠️ Les gages s'amenuisent : encore {maxUnitsGold} unité{maxUnitsGold !== 1 ? "s" : ""} payable{maxUnitsGold !== 1 ? "s" : ""} avant la caisse vide.</p>
                  )}
                  {!canAfford && (
                    <p className="text-red-700 font-semibold">🛑 Plus un denier pour les payer : vos serfs ont posé les outils !</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 font-heading bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleCollectHarvest}
                    disabled={collectingHarvest || harvestAccumulated <= 0}
                  >
                    {collectingHarvest ? "Les serfs rentrent…" : `🎒 Ramasser (${harvestAccumulated} ${harvest?.icon})`}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-heading text-red-600 border-red-200 hover:bg-red-50"
                    onClick={handleStopHarvest}
                    disabled={collectingHarvest}
                  >
                    🔔 Rappeler
                  </Button>
                </div>
                <p className="text-xs text-center text-muted-foreground font-body">
                  "Rappeler" ramasse d'abord ce qui est prêt, puis renvoie vos serfs au village.
                </p>
              </div>
            )}

            {/* État : INACTIF */}
            {!isHarvesting && (
              <Button
                className="w-full font-heading py-6 text-base"
                onClick={handleStartHarvest}
                disabled={!canAfford || inventoryFull}
              >
                🌿 Envoyer les serfs au labeur
              </Button>
            )}

            {/* Note info offline */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs font-body text-blue-800">
              📜 Le ménestrel murmure : « Vos serfs travaillent même quand vous dormez. Revenez les chercher quand bon vous semble : 4 butins au plus, 1 tous les 2 heures. L'or ne leur est versé qu'à la collecte. »
            </div>
          </div>
        );
      })()}

      {/* Bouton quitter le biome : toujours visible */}
      {!combatInProgress && (
        <div className="bg-muted/40 border border-border rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm font-body text-muted-foreground">📍 Vous êtes dans ce biome</span>
          <Button
            variant="outline"
            size="sm"
            className="font-heading"
            onClick={async () => {
              await base44.entities.PlayerProfile.update(profile.id, {
                is_traveling: true,
                travel_destination_id: profile.city_id,
                travel_arrival_time: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
              });
              toast.success("🐴 Vous prenez le chemin du retour : la ville n'est plus qu'à quelques lieues.");
              onRefresh?.();
            }}
          >
            🏠 Quitter le biome
          </Button>
        </div>
      )}

      {/* Retour en ville si épuisé */}
      {(profile.fatigue || 0) === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-body text-sm mb-3">⚠️ Vous êtes épuisé ! Retournez vous reposer en ville.</p>
          <Button
            className="w-full font-heading bg-red-600 hover:bg-red-700"
            onClick={async () => {
              await base44.entities.PlayerProfile.update(profile.id, {
                is_traveling: true,
                travel_destination_id: profile.city_id,
                travel_arrival_time: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
              });
              toast.success("🐴 Vous prenez le chemin du retour : la ville n'est plus qu'à quelques lieues.");
              onRefresh?.();
            }}
          >
            🏠 Retourner en ville
          </Button>
        </div>
      )}
    </div>

  );
}