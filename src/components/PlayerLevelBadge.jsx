import React from "react";
import { getPlayerLevelInfo } from "@/lib/playerLevelSystem";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";

export default function PlayerLevelBadge({ profile, variant = "compact" }) {
  if (!profile) return null;

  const levelInfo = getPlayerLevelInfo(profile.player_xp_total || 0);

  if (variant === "compact") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 border border-primary/40 hover:bg-primary/20 transition-colors cursor-help">
            <span className="text-lg">⭐</span>
            <span className="font-semibold text-primary text-sm">{levelInfo.level}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-heading font-semibold">Niveau du joueur</h4>
              <span className="text-2xl">⭐ {levelInfo.level}</span>
            </div>

            {!levelInfo.isMaxLevel && (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progression</span>
                    <span>
                      {levelInfo.currentLevelXP} / {levelInfo.levelDuration} XP
                    </span>
                  </div>
                  <Progress value={levelInfo.progressPercent} className="h-2" />
                </div>
              </>
            )}

            {levelInfo.isMaxLevel && (
              <p className="text-sm text-accent font-semibold">🏆 Niveau maximum atteint!</p>
            )}

            {/* Afficher les bonus */}
            {levelInfo.bonuses && (
              <div className="pt-2 space-y-1 border-t border-border">
                <p className="text-xs font-semibold text-foreground">Bonus de niveau:</p>
                {levelInfo.bonuses.dropRareBonus > 0 && (
                  <p className="text-xs text-muted-foreground">
                    📈 +{levelInfo.bonuses.dropRareBonus}% drop ressources rares
                  </p>
                )}
                {levelInfo.bonuses.cooldownBonus > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ⚡ −{levelInfo.bonuses.cooldownBonus}% cooldown production
                  </p>
                )}
                {levelInfo.bonuses.doubleProductionBonus > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ✨ {levelInfo.bonuses.doubleProductionBonus}% chance double production (T1, T2, T3)
                  </p>
                )}
                {levelInfo.bonuses.dropRareBonus === 0 && levelInfo.bonuses.cooldownBonus === 0 && levelInfo.bonuses.doubleProductionBonus === 0 && (
                  <p className="text-xs text-muted-foreground">Accomplissez vos premières quêtes pour gravir les échelons : dès le rang 2, votre labeur s'accélère et votre chance de doubler votre récolte s'éveille.</p>
                )}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // variant = "full"
  return (
    <div className="space-y-4 p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold">Niveau du joueur</h3>
        <span className="text-3xl">⭐ {levelInfo.level}</span>
      </div>

      {!levelInfo.isMaxLevel && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>XP pour le prochain niveau</span>
            <span className="font-semibold">
              {levelInfo.currentLevelXP} / {levelInfo.levelDuration}
            </span>
          </div>
          <Progress value={levelInfo.progressPercent} className="h-3" />
        </div>
      )}

      {levelInfo.isMaxLevel && (
        <p className="text-lg text-accent font-semibold text-center">🏆 Niveau maximum atteint!</p>
      )}

      {/* Bonuses détaillés */}
      {levelInfo.bonuses && (
        <div className="pt-2 space-y-2 border-t border-border">
          <p className="text-sm font-semibold">Bonus de niveau:</p>
          {levelInfo.bonuses.dropRareBonus > 0 && (
            <p className="text-sm text-muted-foreground">
              📈 +{levelInfo.bonuses.dropRareBonus}% chance drop ressources rares
            </p>
          )}
          {levelInfo.bonuses.cooldownBonus > 0 && (
            <p className="text-sm text-muted-foreground">
              ⚡ −{levelInfo.bonuses.cooldownBonus}% cooldown production
            </p>
          )}
          {levelInfo.bonuses.doubleProductionBonus > 0 && (
            <p className="text-sm text-muted-foreground">
              ✨ {levelInfo.bonuses.doubleProductionBonus}% chance double production (T1, T2, T3)
            </p>
          )}
          {levelInfo.bonuses.dropRareBonus === 0 && levelInfo.bonuses.cooldownBonus === 0 && levelInfo.bonuses.doubleProductionBonus === 0 && (
            <p className="text-sm text-muted-foreground italic">
              Accomplissez vos premières quêtes pour gravir les échelons : dès le rang 2, votre labeur s'accélère et votre chance de doubler votre récolte s'éveille.
            </p>
          )}
        </div>
      )}
    </div>
  );
}