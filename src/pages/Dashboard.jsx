import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PlayerStatusBar from "../components/PlayerStatusBar";
import { PROFESSIONS, getMaxFatigue, MAX_HUNGER, getMaxHunger, getCityHungerBonus, HUNGER_WARNING_THRESHOLD } from "../lib/gameData";
import { computeFatigueWithDailyReset } from "../lib/craftingData";
import LoginStreakWidget from "../components/LoginStreakWidget";
import AldebertGreeting from "../components/AldebertGreeting";
import { getTxLabel } from "../lib/transactionTypes";
import { getBiomeName } from "../lib/biomes";




export default function Dashboard({ profile, city, homeCity, onShowTutorial, onProfileUpdate }) {
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [liveProfile, setLiveProfile] = useState(profile);

  useEffect(() => { setLiveProfile(profile); }, [profile]);

  const [quests, setQuests] = useState([]);
  const [marketListings, setMarketListings] = useState([]);
  const [period, setPeriod] = useState("24h"); // "24h" | "48h" | "7j"

  const loadTransactions = useCallback(async () => {
    if (!liveProfile) return;
    try {
      const hours = period === "24h" ? 24 : period === "48h" ? 48 : 168;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const txs = await base44.entities.GoldTransaction.filter(
        { player_email: liveProfile.user_email },
        "-created", 200
      );
      setTransactions(txs.filter(t => new Date(t.created || t.created_date || t.created_at || 0) >= since));
    } catch (e) {
      console.warn("GoldTransaction load:", e);
    } finally {
      setLoadingTx(false);
    }
  }, [liveProfile?.id, liveProfile?.user_email, period]);

  // Recharger au focus (retour sur le dashboard) + polling 60s
  useEffect(() => {
    loadTransactions();
    const interval = setInterval(loadTransactions, 60 * 1000);
    const onFocus = () => loadTransactions();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [loadTransactions]);

  useEffect(() => {
    async function load() {
      if (!liveProfile) return;
      try {
        await loadTransactions();
      } catch (e) {
        console.warn("GoldTransaction load:", e);
      }
      // Quêtes du jour
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const allObjs = await base44.entities.PlayerObjective.filter({ player_email: liveProfile.user_email });
        const todayQuests = allObjs.filter(q => (q.created_date || q.quest_date || "").startsWith(todayStr) && !q.parchemin_type);
        setQuests(todayQuests);
      } catch(e) {}
      // Annonces marché actives
      try {
        const listings = await base44.entities.MarketListing.filter({ seller_email: liveProfile.user_email, status: "active" });
        setMarketListings(listings);
      } catch(e) {}
      setLoadingTx(false);
    }
    load();
  }, [liveProfile?.id]);
  if (!liveProfile) return null;

  const prof = PROFESSIONS[liveProfile.profession];
  const netBalance = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalIn    = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut   = transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <PlayerStatusBar profile={liveProfile} homeCity={homeCity} city={city} onRefresh={onProfileUpdate} />

      {/* Welcome */}
      <div className="card-royal card-gold-border rounded-xl p-6 relative">
        <div className="relative z-10">
          <h2 className="font-display text-3xl mb-1 text-primary">
            Bienvenue, {liveProfile.character_name}
          </h2>
          <p className="text-muted-foreground font-body italic">
            {prof?.icon} {liveProfile.profession}{city ? ` à ${city.name} : Gouvernée par ${city.mayor_name || "personne"}` : ""}
          </p>
        </div>
      </div>

      {/* ── Check-up du jour ── */}
      {(() => {
        const todayStr = new Date().toISOString().split("T")[0];
        const maxFatigue = getMaxFatigue(liveProfile);
        const { fatigue } = computeFatigueWithDailyReset(liveProfile, maxFatigue);
        const hunger = liveProfile.hunger ?? MAX_HUNGER;
        const maxHunger = getMaxHunger(liveProfile, getCityHungerBonus(homeCity?.buildings || []));

        // V6.1.8 — Épopée du jour (remplace l'ancien système de 5 combats biome)
        // L'épopée est terminée quand : combat_last_date === aujourd'hui ET
        // l'index de vague atteint le maximum (5 vagues, le joueur a fait toutes).
        // Si combat_last_date === aujourd'hui mais l'index < max, l'épopée est
        // en cours (commencée mais pas finie).
        const MAX_WAVES_PER_DAY_DASH = 5;
        const epicStartedToday = liveProfile.combat_last_date === todayStr;
        const epicDoneToday = epicStartedToday
          && liveProfile.combat_active_biome
          && (liveProfile.combat_wave_index ?? 0) >= MAX_WAVES_PER_DAY_DASH;
        const epicInProgress = epicStartedToday && !epicDoneToday;
        const epicBiomeName = liveProfile.combat_active_biome
          ? ({ foret: "Forêt", champs: "Champs", mine: "Mine", atelier: "Atelier", forge: "Forge", guilde: "Guilde" }[liveProfile.combat_active_biome] || liveProfile.combat_active_biome)
          : null;

        // V6.1.8 — État de la récolte AFK (4 ressources max, 1 toutes les 2h)
        // On affiche une tuile dédiée pour prévenir le joueur quand sa récolte
        // est arrivée au plafond.
        const HARVEST_RATE_MS_DASH = 7200000;       // 2h
        const HARVEST_MAX_DASH = 4;                 // plafond
        let harvestActive = false;
        let harvestCount = 0;
        let harvestBiomeName = null;
        if (liveProfile.harvest_started_at && liveProfile.harvest_biome_key) {
          harvestActive = true;
          harvestBiomeName = getBiomeName(liveProfile.harvest_biome_key, true); // true = nom court
          const elapsed = Date.now() - new Date(liveProfile.harvest_started_at).getTime();
          const hoursRaw = Math.max(0, Math.floor(elapsed / HARVEST_RATE_MS_DASH));
          harvestCount = Math.min(hoursRaw, HARVEST_MAX_DASH);
        }
        const harvestReady = harvestActive && harvestCount >= HARVEST_MAX_DASH;

        // Quêtes
        const questsDone = quests.filter(q => q.status === "completed").length;
        const questsTotal = quests.length;
        const allQuestsDone = questsTotal > 0 && questsDone === questsTotal;

        // Production cooldown
        const cooldowns = liveProfile.production_cooldowns || {};
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
        const streakDone = liveProfile.last_login_date === todayStr;

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

          // Biome — Épopée quotidienne (remplace l'ancien système 5 combats)
          epicDoneToday
            ? { to: "/travel", icon: "🗡️", title: "Épopée du jour", sub: "Accomplie", state: "done", strikethrough: true }
            : epicInProgress
            ? { to: "/travel", icon: "🗡️", title: "Épopée du jour", sub: `En cours en ${epicBiomeName}`, state: "warn" }
            : { to: "/travel", icon: "🗡️", title: "Épopée du jour", sub: "Disponible", state: "warn" },

          // Récolte AFK
          harvestReady
            ? { to: "/travel", icon: "🌿", title: "Récolte prête", sub: `${HARVEST_MAX_DASH} ressources en ${harvestBiomeName}`, state: "warn" }
            : harvestActive
            ? { to: "/travel", icon: "🌿", title: "Récolte en cours", sub: `${harvestCount}/${HARVEST_MAX_DASH} en ${harvestBiomeName}`, state: "neutral" }
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
            ? { to: "/", icon: "🔥", title: "Streak connexion", sub: `${liveProfile.login_streak || 1} jours consécutifs`, state: "done" }
            : { to: "/", icon: "🔥", title: "Streak connexion", sub: "Connectez-vous chaque jour !", state: "warn" },
        ].filter(Boolean);

        const stateStyles = {
          done:    "bg-green-50 border-green-200",
          warn:    "bg-amber-50 border-amber-200",
          alert:   "bg-red-50 border-red-200",
          neutral: "bg-muted/30 border-border",
        };
        const statusIcon = { done: "✓", warn: "→", alert: "!", neutral: "→" };
        const statusColor = {
          done: "text-green-700", warn: "text-amber-700",
          alert: "text-red-700", neutral: "text-muted-foreground"
        };

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
      })()}

      {/* Login Streak */}
      <AldebertGreeting profile={liveProfile} />
      <LoginStreakWidget profile={liveProfile} onProfileUpdate={p => setLiveProfile(p)} />

      {onShowTutorial && (
        <button onClick={onShowTutorial} className="text-xs text-muted-foreground font-body underline underline-offset-2 hover:text-foreground transition-colors">
          ❓ Revoir le tutoriel
        </button>
      )}

      {/* Journal des transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-2">📋 Journal des transactions ({period})</span>
            <div className="flex gap-1">
              {["24h", "48h", "7j"].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`text-xs font-heading px-3 py-1 rounded-full border transition-colors ${
                    period === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">

          {transactions.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                <div className="text-xs text-muted-foreground font-body">Entrées</div>
                <div className="font-heading font-bold text-green-700">+{totalIn} 💰</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                <div className="text-xs text-muted-foreground font-body">Sorties</div>
                <div className="font-heading font-bold text-red-700">{totalOut} 💰</div>
              </div>
              <div className={`border rounded-lg p-2 text-center ${netBalance >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <div className="text-xs text-muted-foreground font-body">Bilan net</div>
                <div className={`font-heading font-bold ${netBalance >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {netBalance >= 0 ? "+" : ""}{netBalance} 💰
                </div>
              </div>
            </div>
          )}

          {/* Résumé vols : retiré (Phase 3 - le vol PvP est désormais intégré
              au système de combat zoné, plus de bloc dédié dans le dashboard) */}

          {loadingTx ? (
            <p className="text-xs text-muted-foreground font-body text-center py-4">Chargement...</p>
          ) : transactions.length === 0 ? (
            <p className="text-xs text-muted-foreground font-body text-center py-4">
              Aucune transaction sur cette période.
            </p>
          ) : (
            <div className="space-y-1.5">
              {transactions.map((tx, idx) => {
                const meta = getTxLabel(tx.type);
                const isPositive = tx.amount > 0;
                const txDate = new Date(tx.created_at || tx.created || tx.created_date || 0);
                const now = new Date();
                const isYesterday = txDate.getDate() !== now.getDate();
                const time = (tx.created_at || tx.created || tx.created_date)
                  ? (isYesterday ? "Hier " : "") + txDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                  : "";
                return (
                  <div key={idx} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2 text-sm font-body">
                    <span className="text-base w-6 text-center shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs">{meta.label}</div>
                      <div className="text-muted-foreground text-xs truncate">{tx.description}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-heading font-bold text-sm ${isPositive ? "text-green-600" : "text-red-600"}`}>
                        {isPositive ? "+" : ""}{tx.amount} 💰
                      </div>
                      {time && <div className="text-xs text-muted-foreground">{time}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
