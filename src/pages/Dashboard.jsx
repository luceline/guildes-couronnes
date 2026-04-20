import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PlayerStatusBar from "../components/PlayerStatusBar";
import { PROFESSIONS, getMaxFatigue, MAX_HUNGER, HUNGER_WARNING_THRESHOLD } from "../lib/gameData";
import { computeFatigueWithDailyReset } from "../lib/craftingData";
import LoginStreakWidget from "../components/LoginStreakWidget";

const TRANSACTION_LABELS = {
  vente:           { icon: "🏪", label: "Vente marché" },
  achat:           { icon: "🛒", label: "Achat marché" },
  taxe_marche:     { icon: "📊", label: "Taxe marché" },
  impot:           { icon: "💸", label: "Impôt journalier" },
  peage:           { icon: "🏰", label: "Péage" },
  frais_voyage:    { icon: "🛤️", label: "Frais de voyage" },
  rachat_entrepot: { icon: "📦", label: "Rachat entrepôt" },
  pret:            { icon: "🏦", label: "Prêt bancaire" },
  remboursement:   { icon: "💳", label: "Remboursement" },
  depot:           { icon: "🏦", label: "Dépôt bancaire" },
  retrait_depot:   { icon: "💰", label: "Retrait dépôt" },
  vol_recu:        { icon: "🦹", label: "Vol reçu" },
  vol_subi:        { icon: "😤", label: "Vol subi" },
  cout_production: { icon: "⚒️", label: "Coût production" },
  logement:        { icon: "🏠", label: "Logement" },
  maire:           { icon: "👑", label: "Investiture maire" },
  demenagement:    { icon: "🚚", label: "Déménagement" },
  objectif:         { icon: "🎯", label: "Objectif accompli" },
  service_atelier:  { icon: "🏪", label: "Service d'atelier" },
  rachat_t2t3:      { icon: "📦", label: "Rachat entrepôt T2/T3" },
};




export default function Dashboard({ profile, city, homeCity, onShowTutorial, onProfileUpdate }) {
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [liveProfile, setLiveProfile] = useState(profile);

  useEffect(() => { setLiveProfile(profile); }, [profile]);

  const [quests, setQuests] = useState([]);
  const [marketListings, setMarketListings] = useState([]);

  useEffect(() => {
    async function load() {
      if (!profile) return;
      try {
        const txs = await base44.entities.GoldTransaction.filter(
          { player_email: profile.user_email },
          "-created_date", 50
        );
        const since = Date.now() - 24 * 3600 * 1000;
        const recent = txs.filter(t =>
          t.created_date && new Date(t.created_date).getTime() >= since
        );
        setTransactions(recent);
      } catch (e) {
        console.warn("GoldTransaction load:", e);
      }
      // Quêtes du jour
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const allObjs = await base44.entities.PlayerObjective.filter({ player_email: profile.user_email });
        const todayQuests = allObjs.filter(q => (q.created_date || q.quest_date || "").startsWith(todayStr) && !q.parchemin_type);
        setQuests(todayQuests);
      } catch(e) {}
      // Annonces marché actives
      try {
        const listings = await base44.entities.MarketListing.filter({ seller_email: profile.user_email, status: "active" });
        setMarketListings(listings);
      } catch(e) {}
      setLoadingTx(false);
    }
    load();
  }, [profile?.id]);

  if (!liveProfile || !city) return null;

  const prof = PROFESSIONS[liveProfile.profession];
  const netBalance = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalIn    = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut   = transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <PlayerStatusBar profile={liveProfile} homeCity={homeCity} />

      {/* Welcome */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-card to-accent/10 border border-border p-6">
        <div className="relative z-10">
          <h2 className="font-heading text-2xl font-semibold mb-1">Bienvenue, {liveProfile.character_name}</h2>
          <p className="text-muted-foreground font-body">
            {prof?.icon} {liveProfile.profession} à {city.name} — Gouvernée par {city.mayor_name || "personne"}
          </p>
        </div>
        <div className="absolute top-2 right-4 text-6xl opacity-10">⚜️</div>
      </div>

      {/* ── Check-up du jour ── */}
      {(() => {
        const todayStr = new Date().toISOString().split("T")[0];
        const maxFatigue = getMaxFatigue(liveProfile);
        const { fatigue } = computeFatigueWithDailyReset(liveProfile, maxFatigue);
        const hunger = liveProfile.hunger ?? MAX_HUNGER;
        const maxHunger = MAX_HUNGER + (liveProfile.hunger_max_bonus || 0);
        const dailyCombatsDate = liveProfile.daily_combats_date;
        const dailyCombatsCount = dailyCombatsDate === todayStr ? (liveProfile.daily_combats_count || 0) : 0;
        const biomeCombatsLeft = Math.max(0, 5 - dailyCombatsCount);

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
            ? { to: "/production", icon: "🍽️", title: "Faim basse", sub: `${hunger}/${maxHunger} — mangez bientôt`, state: "warn" }
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

          // Biome
          biomeCombatsLeft > 0
            ? { to: "/travel", icon: "🌿", title: "Biome", sub: `${biomeCombatsLeft} combat${biomeCombatsLeft > 1 ? "s" : ""} disponible${biomeCombatsLeft > 1 ? "s" : ""}`, state: "warn" }
            : { to: "/travel", icon: "🌿", title: "Biome", sub: "Combats épuisés pour aujourd'hui", state: "done" },

          // Production
          hasCooldownReady
            ? { to: "/production", icon: "⚒️", title: "Production", sub: "Un cooldown est terminé !", state: "warn" }
            : { to: "/production", icon: "⚒️", title: "Production", sub: "Tout en cooldown", state: "neutral" },

          // Marché
          marketListings.length > 0
            ? { to: "/market", icon: "🛒", title: "Marché", sub: `${marketListings.length} annonce${marketListings.length > 1 ? "s" : ""} active${marketListings.length > 1 ? "s" : ""}`, state: "done" }
            : { to: "/market", icon: "🛒", title: "Marché", sub: "Aucune annonce — vendez !", state: "neutral" },

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
                      <p className="text-xs font-heading font-semibold text-foreground leading-tight">{card.title}</p>
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
      <LoginStreakWidget profile={liveProfile} onProfileUpdate={p => setLiveProfile(p)} />

      {onShowTutorial && (
        <button onClick={onShowTutorial} className="text-xs text-muted-foreground font-body underline underline-offset-2 hover:text-foreground transition-colors">
          ❓ Revoir le tutoriel
        </button>
      )}

      {/* Journal 24h */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            📋 Journal des 24 dernières heures
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

          {/* Résumé vols */}
          {transactions.filter(t => ['vol_recu','vol_subi','vol_echoue'].includes(t.type)).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
              <p className="text-xs font-heading font-semibold text-red-800 mb-1">⚔️ Activité de vol (24h)</p>
              {transactions.filter(t => ['vol_recu','vol_subi','vol_echoue'].includes(t.type)).map((tx, i) => {
                const meta = TRANSACTION_LABELS[tx.type] || { icon: "⚔️", label: tx.type };
                return (
                  <div key={i} className="flex items-center gap-2 text-xs font-body">
                    <span>{meta.icon}</span>
                    <span className="flex-1">{tx.description}</span>
                    {tx.amount !== 0 && <span className={tx.amount > 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>{tx.amount > 0 ? "+" : ""}{tx.amount} 💰</span>}
                  </div>
                );
              })}
            </div>
          )}

          {loadingTx ? (
            <p className="text-xs text-muted-foreground font-body text-center py-4">Chargement...</p>
          ) : transactions.length === 0 ? (
            <p className="text-xs text-muted-foreground font-body text-center py-4">
              Aucune transaction dans les dernières 24h.
            </p>
          ) : (
            <div className="space-y-1.5">
              {transactions.map((tx, idx) => {
                const meta = TRANSACTION_LABELS[tx.type] || { icon: "💱", label: tx.type };
                const isPositive = tx.amount > 0;
                const time = tx.created_date
                  ? new Date(tx.created_date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
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

