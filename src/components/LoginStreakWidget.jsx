import { STREAK_REWARDS } from "../lib/gameData";
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

// Récompenses par palier de streak
// STREAK_REWARDS importé depuis gameData.js

function getRewardForStreak(streak) {
  let reward = STREAK_REWARDS[0];
  for (const r of STREAK_REWARDS) {
    if (streak >= r.days) reward = r;
    else break;
  }
  return reward;
}

function getNextMilestone(streak) {
  return STREAK_REWARDS.find(r => r.days > streak) || null;
}

// Affiche 7 cases jour (la semaine en cours)
function StreakDots({ streak = 0 }) {
  if (typeof streak !== "number" || streak < 0) return null;
  
  return (
    <div className="flex gap-1.5 justify-center my-2">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const dayNum = i + 1;
        const filled = streak >= dayNum;
        const isToday = streak === dayNum;
        return (
          <div
            key={`day-${i}`}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-heading transition-all ${
              filled
                ? isToday
                  ? "bg-amber-500 text-white shadow-md shadow-amber-200 scale-110"
                  : "bg-amber-400/80 text-white"
                : "bg-muted border border-border text-muted-foreground"
            }`}
          >
            {filled ? "✓" : dayNum}
          </div>
        );
      })}
    </div>
  );
}

export default function LoginStreakWidget({ profile, onProfileUpdate }) {
  const [claimed, setClaimed] = useState(false);
  const [reward, setReward] = useState(null);

  useEffect(() => {
    if (!profile) return;
    checkAndUpdateStreak();
  }, [profile?.id]);

  const checkAndUpdateStreak = async () => {
    const today = new Date().toISOString().split("T")[0];
    const lastLogin = profile.last_login_date;
    const streak = profile.login_streak || 0;

    // Déjà récompensé aujourd'hui → rien à faire
    if (profile.streak_rewarded_today && lastLogin === today) return;

    let newStreak = streak;
    let isNewDay = false;

    if (!lastLogin) {
      newStreak = 1;
      isNewDay = true;
    } else if (lastLogin === today) {
      // Même jour, déjà compté
      return;
    } else {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      if (lastLogin === yesterday) {
        newStreak = streak + 1;
      } else {
        // Streak cassé
        newStreak = 1;
      }
      isNewDay = true;
    }

    if (!isNewDay) return;

    const streakReward = getRewardForStreak(newStreak);
    const goldEarned = streakReward.gold;

    // Enregistrer la mise à jour
    const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
    const currentGold = freshP ? (freshP.gold || 0) : (profile.gold || 0);
    const updates = {
      login_streak: newStreak,
      last_login_date: today,
      streak_rewarded_today: true,
      gold: currentGold + goldEarned,
    };

    await base44.entities.PlayerProfile.update(profile.id, updates);
    await base44.entities.GoldTransaction.create({
      player_email: profile.user_email,
      player_name: profile.character_name,
      city_id: profile.city_id,
      amount: goldEarned,
      type: "objectif",
      description: `🔥 Connexion jour ${newStreak} — Récompense streak +${goldEarned}💰`,
    });

    setReward({ streak: newStreak, gold: goldEarned, icon: streakReward.icon });
    setClaimed(true);
    onProfileUpdate?.({ ...profile, ...updates });

    toast.success(`🔥 Streak jour ${newStreak} ! +${goldEarned}💰 reçus !`);
  };

  const streak = profile?.login_streak || 0;
  const nextMilestone = getNextMilestone(streak);
  const todayRewarded = profile?.streak_rewarded_today && profile?.last_login_date === new Date().toISOString().split("T")[0];

  if (!profile) return null;

  return (
    <Card className={streak >= 7 ? "border-amber-400 shadow shadow-amber-100" : ""}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">{streak >= 7 ? "🔥" : streak >= 3 ? "⭐" : "🌱"}</span>
            <div>
              <p className="font-heading font-semibold text-sm leading-tight">
                Série de connexions
              </p>
              <p className="text-xs text-muted-foreground font-body">
                {streak === 0
                  ? "Commencez votre série aujourd'hui !"
                  : `${streak} jour${streak > 1 ? "s" : ""} consécutif${streak > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            {todayRewarded && reward && (
              <span className="text-xs font-heading font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                +{reward.gold}💰 reçus !
              </span>
            )}
          </div>
        </div>

        <StreakDots streak={streak > 7 ? 7 : streak} />

        {nextMilestone && (
          <p className="text-xs text-center text-muted-foreground font-body mt-1">
            Encore <strong className="text-foreground">{nextMilestone.days - streak}</strong> jour{nextMilestone.days - streak > 1 ? "s" : ""} pour atteindre{" "}
            <strong className="text-amber-600">{nextMilestone.icon} {nextMilestone.label} (+{nextMilestone.gold}💰)</strong>
          </p>
        )}
        {!nextMilestone && streak >= 30 && (
          <p className="text-xs text-center text-amber-600 font-heading mt-1">
            👑 Série maximale atteinte ! +150💰 chaque jour !
          </p>
        )}
      </CardContent>
    </Card>
  );
}