/**
 * TodayCheckup.jsx
 *
 * Tableau de bord "Check-up du jour" : grille de tuiles qui résument
 * l'état du joueur (faim/énergie, quêtes, épopée, récolte AFK, production,
 * marché, entrepôt, streak).
 *
 * Extrait du Dashboard.jsx (10/05/2026) pour être réutilisable depuis
 * la bibliothèque (mobile) ou n'importe où.
 *
 * Charge ses propres données : profile, city, homeCity, quêtes, market.
 * Ne nécessite aucune prop.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  PROFESSIONS, getMaxFatigue, MAX_HUNGER, getMaxHunger,
  getCityHungerBonus, HUNGER_WARNING_THRESHOLD,
} from "@/lib/gameData";
import { computeFatigueWithDailyReset } from "@/lib/craftingData";
import { getBiomeName } from "@/lib/biomes";

const stateStyles = {
  done:    "bg-green-50 border-green-200",
  warn:    "bg-amber-50 border-amber-200",
  alert:   "bg-red-50 border-red-200",
  neutral: "bg-muted/30 border-border",
};
const statusIcon = { done: "✓", warn: "→", alert: "!", neutral: "→" };
const statusColor = {
  done: "text-green-700",
  warn: "text-amber-700",
  alert: "text-red-700",
  neutral: "text-muted-foreground",
};

export default function TodayCheckup() {
  const [profile, setProfile] = useState(null);
  const [city, setCity] = useState(null);
  const [homeCity, setHomeCity] = useState(null);
  const [quests, setQuests] = useState([]);
  const [marketListings, setMarketListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await base44.auth.me();
        if (!user?.email) return;
        const profiles = await base44.entities.PlayerProfile.filter({ user_email: user.email });
        if (cancelled || profiles.length === 0) return;
        const p = profiles[0];
        setProfile(p);

        if (p.city_id) {
          const c = await base44.entities.City.get(p.city_id).catch(() => null);
          if (!cancelled) setCity(c);
        }
        if (p.home_city_id) {
          const hc = p.home_city_id === p.city_id
            ? null  // sera réutilisé via city ci-dessus
            : await base44.entities.City.get(p.home_city_id).catch(() => null);
          if (!cancelled) setHomeCity(hc);
        }

        // Quêtes du jour
        const todayStr = new Date().toISOString().split("T")[0];
        const allObjs = await base44.entities.PlayerObjective.filter({ player_email: p.user_email });
        const todayQuests = allObjs.filter(q => (q.created_date || q.quest_date || "").startsWith(todayStr) && !q.parchemin_type);
        if (!cancelled) setQuests(todayQuests);

        // Annonces marché actives
        const listings = await base44.entities.MarketListing.filter({ seller_email: p.user_email, status: "active" });
        if (!cancelled) setMarketListings(listings);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="text-center text-sm text-muted-foreground py-6">
        Chargement du tableau de bord...
      </div>
    );
  }
  if (!profile) return null;

  // Si home_city n'a pas été fetché séparément (parce que home_city_id === city_id),
  // on réutilise city
  const effectiveHomeCity = homeCity || (profile.home_city_id === profile.city_id ? city : null);

  const todayStr = new Date().toISOString().split("T")[0];
  const maxFatigue = getMaxFatigue(profile);
  const { fatigue } = computeFatigueWithDailyReset(profile, maxFatigue);
  const hunger = profile.hunger ?? MAX_HUNGER;
  const maxHunger = getMaxHunger(profile, getCityHungerBonus(effectiveHomeCity?.buildings || []));

  // Épopée du jour
  const MAX_WAVES_PER_DAY = 5;
  const epicStartedToday = profile.combat_last_date === todayStr;
  const epicDoneToday = epicStartedToday
    && profile.combat_active_biome
    && (profile.combat_wave_index ?? 0) >= MAX_WAVES_PER_DAY;
  const epicInProgress = epicStartedToday && !epicDoneToday;
  const epicBiomeName = profile.combat_active_biome
    ? ({ foret: "Forêt", champs: "Champs", mine: "Mine", atelier: "Atelier", forge: "Forge", guilde: "Guilde" }[profile.combat_active_biome] || profile.combat_active_biome)
    : null;

  // Récolte AFK
  const HARVEST_RATE_MS = 7200000;  // 2h
  const HARVEST_MAX = 4;
  let harvestActive = false;
  let harvestCount = 0;
  let harvestBiomeName = null;
  if (profile.harvest_started_at && profile.harvest_biome_key) {
    harvestActive = true;
    harvestBiomeName = getBiomeName(profile.harvest_biome_key, true);
    const elapsed = Date.now() - new Date(profile.harvest_started_at).getTime();
    const hoursRaw = Math.max(0, Math.floor(elapsed / HARVEST_RATE_MS));
    harvestCount = Math.min(hoursRaw, HARVEST_MAX);
  }
  const harvestReady = harvestActive && harvestCount >= HARVEST_MAX;

  // Quêtes
  const questsDone = quests.filter(q => q.status === "completed").length;
  const questsTotal = quests.length;
  const allQuestsDone = questsTotal > 0 && questsDone === questsTotal;

  // Production cooldown
  const cooldowns = profile.production_cooldowns || {};
  const now = Date.now();
  const hasCooldownReady = Object.values(cooldowns).some(cd => {
    if (!cd?.available_at) return true;
    return new Date(cd.available_at).getTime() <= now;
  });

  // Entrepôt ville
  const warehouse = city?.warehouse || {};
  const maintenance = city?.maintenance_daily || {};
  const warehouseAlert = Object.entries(maintenance).some(([k, v]) => v > 0 && (warehouse[k] || 0) < v * 2);

  // Streak
  const streakDone = profile.last_login_date === todayStr;

  const cards = [
    // Faim
    hunger <= 0
      ? { to: "/production", icon: "🍽️", title: "Faim critique !", sub: "Vous ne pouvez plus voyager", state: "alert" }
      : hunger <= HUNGER_WARNING_THRESHOLD
      ? { to: "/production", icon: "🍽️", title: "Faim basse", sub: `${hunger}/${maxHunger} : mangez bientôt`, state: "warn" }
      : null,

    // Énergie
    fatigue <= 0
      ? { to: "/profile", icon: "⚡", title: "Épuisé !", sub: "Plus d'énergie pour produire", state: "alert" }
      : fatigue <= Math.floor(maxFatigue * 0.2)
      ? { to: "/profile", icon: "⚡", title: "Bientôt à court d'énergie", sub: `${fatigue}/${maxFatigue} restants`, state: "warn" }
      : null,

    // Quêtes
    questsTotal === 0
      ? { to: "/quetes", icon: "🎯", title: "Quêtes du jour", sub: "Générez vos quêtes !", state: "warn" }
      : allQuestsDone
      ? { to: "/quetes", icon: "🎯", title: "Quêtes du jour", sub: "Toutes accomplies !", state: "done" }
      : { to: "/quetes", icon: "🎯", title: "Quêtes du jour", sub: `${questsDone}/${questsTotal} accomplies`, state: "neutral" },

    // Épopée
    epicDoneToday
      ? { to: "/travel", icon: "🗡️", title: "Épopée du jour", sub: "Accomplie", state: "done", strikethrough: true }
      : epicInProgress
      ? { to: "/travel", icon: "🗡️", title: "Épopée du jour", sub: `En cours en ${epicBiomeName}`, state: "warn" }
      : { to: "/travel", icon: "🗡️", title: "Épopée du jour", sub: "Disponible", state: "warn" },

    // Récolte AFK
    harvestReady
      ? { to: "/travel", icon: "🌿", title: "Récolte prête", sub: `${HARVEST_MAX} ressources en ${harvestBiomeName}`, state: "warn" }
      : harvestActive
      ? { to: "/travel", icon: "🌿", title: "Récolte en cours", sub: `${harvestCount}/${HARVEST_MAX} en ${harvestBiomeName}`, state: "neutral" }
      : { to: "/travel", icon: "🌿", title: "Récolte", sub: "Aucune lancée", state: "neutral" },

    // Production
    hasCooldownReady
      ? { to: "/production", icon: "⚒️", title: "Production", sub: "Un cooldown est terminé !", state: "warn" }
      : { to: "/production", icon: "⚒️", title: "Production", sub: "Tout en cooldown", state: "neutral" },

    // Marché
    marketListings.length > 0
      ? { to: "/market", icon: "🛒", title: "Marché", sub: `${marketListings.length} annonce${marketListings.length > 1 ? "s" : ""} active${marketListings.length > 1 ? "s" : ""}`, state: "done" }
      : { to: "/market", icon: "🛒", title: "Marché", sub: "Aucune annonce : vendez !", state: "neutral" },

    // Entrepôt ville
    warehouseAlert
      ? { to: "/city", icon: "📦", title: "Entrepôt ville", sub: "Ressources insuffisantes !", state: "alert" }
      : { to: "/city", icon: "📦", title: "Entrepôt ville", sub: "Stocks suffisants", state: "done" },

    // Streak
    streakDone
      ? { to: "/", icon: "🔥", title: "Streak connexion", sub: `${profile.login_streak || 1} jours consécutifs`, state: "done" }
      : { to: "/", icon: "🔥", title: "Streak connexion", sub: "Connectez-vous chaque jour !", state: "warn" },
  ].filter(Boolean);

  return (
    <div>
      <h3 className="font-heading font-semibold text-sm mb-3">📋 Check-up du jour</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        {cards.map((card, i) => (
          <Link key={i} to={card.to}>
            <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:opacity-80 ${stateStyles[card.state]}`}>
              <span className="text-xl w-7 text-center shrink-0">{card.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-heading font-semibold text-foreground leading-tight ${card.strikethrough ? "line-through opacity-60" : ""}`}>{card.title}</p>
                <p className="text-xs font-body text-muted-foreground leading-tight mt-0.5">{card.sub}</p>
              </div>
              <span className={`text-xs font-bold shrink-0 ${statusColor[card.state]}`}>{statusIcon[card.state]}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
