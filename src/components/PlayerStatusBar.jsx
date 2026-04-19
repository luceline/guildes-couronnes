import { useState, useEffect } from "react";
import { PROFESSIONS, HOUSING, getInventoryWeight, getMaxWeight, getMaxFatigue, MAX_HUNGER, getFatigueRegenInterval, getVendeurRank, getContributeurRank, getPvpRank } from "../lib/gameData";
import { computeFatigueWithDailyReset } from "../lib/craftingData";
import HelpTooltip from "./HelpTooltip";
import { getTotalDebt } from "../lib/debtRepayment";
import PlayerLevelBadge from "./PlayerLevelBadge";
import { getPlayerLevelInfo, getPlayerLevelBonuses } from "../lib/playerLevelSystem";

export default function PlayerStatusBar({ profile, homeCity }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  if (!profile) return null;

  const prof = PROFESSIONS[profile.profession];
  const housing = HOUSING[profile.housing_level || "tente"];
  const homeCityBuildings = homeCity?.buildings || [];
  const cathedraleFatigueBonus = homeCityBuildings.some(b => b.building_type === "cathedrale") ? 10 : 0;
  const grandePlaceBonus      = homeCityBuildings.some(b => b.building_type === "grande_place") ? 20 : 0;
  const bibliothequeBonus     = homeCityBuildings.some(b => b.building_type === "bibliotheque") ? 30 : 0;
  const maxFatigue = getMaxFatigue(profile, cathedraleFatigueBonus);
  const { fatigue } = computeFatigueWithDailyReset(profile, maxFatigue);
  const fatiguePct = Math.max(0, Math.min(100, (fatigue / maxFatigue) * 100));
  const fatigueColor = fatiguePct > 60 ? "bg-green-500" : fatiguePct > 30 ? "bg-yellow-500" : "bg-red-500";

  const currentWeight = getInventoryWeight(profile);
  const maxWeight = getMaxWeight(profile) + grandePlaceBonus + bibliothequeBonus;
  const weightPct = Math.min(100, (currentWeight / maxWeight) * 100);
  const weightFull = currentWeight >= maxWeight;
  const weightColor = weightFull ? "bg-red-500" : weightPct >= 80 ? "bg-orange-400" : "bg-blue-400";

  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-4 text-sm font-body">
      {/* Nom + métier */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{prof?.icon}</span>
        <span className="font-semibold text-foreground">{profile.character_name}</span>
      </div>

      {/* Or */}
      <div className="flex items-center gap-1.5">
        <span>💰</span>
        <span className="font-semibold text-accent">{profile.gold || 0} or</span>
        {(() => {
          const pendingTax = profile.pending_market_tax || {};
          const total = Object.values(pendingTax).reduce((s, v) => s + v, 0);
          if (total <= 0) return null;
          return (
            <HelpTooltip
              text={`Taxes de marché accumulées aujourd'hui, déduites de votre or au reset (6h). Si vous n'avez pas assez d'or, la différence sera mise en dette.\n\nDétail par ville :\n${Object.entries(pendingTax).filter(([,v]) => v > 0).map(([,v]) => `  · ${v}💰`).join("\n")}`}
              side="bottom"
            >
              <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 cursor-help">
                −{total}💰 taxes
              </span>
            </HelpTooltip>
          );
        })()}
        {getTotalDebt(profile.debt_by_city) > 0 && (
          <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
            ⚠️ Dette : {getTotalDebt(profile.debt_by_city)} 💰
          </span>
        )}
      </div>

      {/* Logement */}
      <div className="flex items-center gap-1.5">
        <span>{housing.icon}</span>
        <span className="text-muted-foreground">{housing.name}</span>
      </div>

      {/* Faim */}
      {(() => {
        const hunger = profile.hunger ?? MAX_HUNGER;
        const maxH = 10 + (profile.hunger_max_bonus || 0);
        const hungerColor = hunger <= 0 ? "text-red-600" : hunger <= 3 ? "text-orange-500" : "text-green-600";
        const hungerPct = Math.max(0, Math.min(100, (hunger / maxH) * 100));
        const hungerBarColor = hunger <= 0 ? "bg-red-500" : hunger <= 3 ? "bg-orange-400" : "bg-green-500";
        // Countdown vers prochain +1 faim
        let regenLabel = null;
        if (hunger < maxH) {
          const lastRegen = profile.hunger_regen_at
            ? new Date(profile.hunger_regen_at).getTime()
            : Date.now();
          const nextRegen = lastRegen + 3600000;
          const msLeft = nextRegen - now;
          if (msLeft > 0) {
            const minLeft = Math.ceil(msLeft / 60000);
            const h = Math.floor(minLeft / 60);
            const m = minLeft % 60;
            regenLabel = h > 0
              ? `+1🍞 ${h}h${m > 0 ? String(m).padStart(2,"0") + "m" : ""}`
              : `+1🍞 ${minLeft}min`;
          } else {
            regenLabel = "+1🍞 bientôt";
          }
        }
        return (
          <div className="flex items-center gap-2 min-w-[120px]">
            <span title="Faim">🍞</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[50px]">
              <div className={`h-full rounded-full transition-all duration-500 ${hungerBarColor}`}
                style={{ width: `${hungerPct}%` }} />
            </div>
            <span className={`text-xs whitespace-nowrap ${hungerColor}`}>{hunger}/{maxH}</span>
            {hunger <= 0 && <span className="text-xs font-semibold text-red-600">Affamé!</span>}
            {regenLabel && hunger < maxH && <span className="text-xs text-muted-foreground whitespace-nowrap">{regenLabel}</span>}
          </div>
        );
      })()}

      {/* Énergie */}
      {(() => {
        const fatigueRegenLabel = (() => {
          if (fatigue >= maxFatigue) return null;
          const regenInterval = getFatigueRegenInterval(profile.housing_level || "tente");
          const lastRegen = profile.fatigue_regen_at
            ? new Date(profile.fatigue_regen_at).getTime()
            : Date.now();
          const nextRegen = lastRegen + regenInterval;
          const msLeft = nextRegen - now;
          if (msLeft > 0) {
            const minLeft = Math.ceil(msLeft / 60000);
            const h = Math.floor(minLeft / 60);
            const m = minLeft % 60;
            return h > 0
              ? `+1⚡ ${h}h${m > 0 ? String(m).padStart(2,"0") + "m" : ""}`
              : `+1⚡ ${minLeft}min`;
          }
          return "+1⚡ bientôt";
        })();
        return (
          <div className="flex items-center gap-2 min-w-[120px]">
            <span title="Énergie">⚡</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[60px]">
              <div className={`h-full rounded-full transition-all duration-500 ${fatigueColor}`}
                style={{ width: `${fatiguePct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{fatigue}/{maxFatigue}</span>
            {fatigueRegenLabel && <span className="text-xs text-muted-foreground whitespace-nowrap">{fatigueRegenLabel}</span>}
          </div>
        );
      })()}

      {/* Poids inventaire */}
      <div className="flex items-center gap-2 min-w-[120px]">
        <span title="Inventaire">📦</span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[60px]">
          <div className={`h-full rounded-full transition-all duration-500 ${weightColor}`}
            style={{ width: `${weightPct}%` }} />
        </div>
        <span className={`text-xs whitespace-nowrap ${weightFull ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
          {currentWeight}/{maxWeight}
        </span>
        {weightFull && <span className="text-xs text-red-500 font-semibold">PLEIN</span>}
      </div>

      {/* Outils */}
      <div className={`flex items-center gap-1.5 text-xs ${(profile.tool_charges || 0) === 0 ? "text-orange-500" : "text-muted-foreground"}`}>
        <span>🔧</span>
        <span>{profile.tool_charges || 0}</span>
        {(profile.tool_charges || 0) === 0 && <span className="font-semibold">×2 CD</span>}
      </div>

      {/* Buff biome actif */}
      {profile.biome_cooldown_bonus_expires_at && new Date(profile.biome_cooldown_bonus_expires_at) > new Date(now) && (() => {
        const msLeft = new Date(profile.biome_cooldown_bonus_expires_at).getTime() - now;
        const minLeft = Math.ceil(msLeft / 60000);
        const h = Math.floor(minLeft / 60);
        const m = minLeft % 60;
        const timeStr = h > 0 ? `${h}h${m > 0 ? String(m).padStart(2,"0") + "m" : ""}` : `${minLeft}min`;
        return (
          <div className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">
            <span>⚡</span>
            <span>-10% CD · 10% dbl prod</span>
            <span className="text-green-500 font-normal">({timeStr})</span>
          </div>
        );
      })()}

      {/* Bonus actifs (niveau + buff biome) */}
      {(() => {
        const levelInfo = getPlayerLevelInfo(profile.player_xp_total || 0);
        const hasLevelCooldown = levelInfo.bonuses?.cooldownBonus > 0;
        const hasLevelDouble = levelInfo.bonuses?.doubleProductionBonus > 0;
        const hasBiomeBuff = profile.biome_cooldown_bonus_expires_at && new Date(profile.biome_cooldown_bonus_expires_at) > new Date(now);
        if (!hasLevelCooldown && !hasLevelDouble && !hasBiomeBuff) return null;
        return (
          <div className="flex items-center gap-1 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-0.5">
            <span>✨</span>
            <span className="font-semibold">Bonus actifs :</span>
            {hasLevelCooldown && (
              <span>⭐ −{levelInfo.bonuses.cooldownBonus}% CD</span>
            )}
            {hasLevelDouble && (
              <span>⭐ {levelInfo.bonuses.doubleProductionBonus}% dbl prod</span>
            )}
            {hasBiomeBuff && (
              <span>🌿 −10% CD · 10% dbl prod</span>
            )}
            <HelpTooltip text={`Vos grâces accumulées :\n⭐ Votre rang : −${levelInfo.bonuses?.cooldownBonus || 0}% délai de labeur + ${levelInfo.bonuses?.doubleProductionBonus || 0}% chance de doubler votre récolte (1% par rang dès le rang 2)\n🌿 Bénédiction biome : −10% délai + 10% chance double récolte (1h après victoire dans votre biome de métier)\n🏙️ Cité Village+ : −10% délai supplémentaire\n\nCes faveurs s'additionnent et couvrent toutes vos productions T1, T2 et T3.`} side="bottom" />
          </div>
        );
      })()}

      {/* Voyage */}
      {profile.is_traveling && (
        <div className="flex items-center gap-1.5 text-accent animate-pulse">
          <span>🐴</span>
          <span>En voyage...</span>
        </div>
      )}

      {/* Niveau */}
      <PlayerLevelBadge profile={profile} variant="compact" />

      {/* Prestige */}
      {(() => {
        const vRank = getVendeurRank(profile.cumul_ventes_or || 0);
        const cRank = getContributeurRank(profile.cumul_contributions_warehouse || 0);
        const pRank = getPvpRank(profile.cumul_t5_envoyes || 0);
        const vCumul = profile.cumul_ventes_or || 0;
        const cCumul = profile.cumul_contributions_warehouse || 0;
        const pCumul = profile.cumul_t5_envoyes || 0;
        return (
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-body">
              {vRank.icon} {vRank.label}
              <HelpTooltip
                text={`🛒 Rang vendeur\n\nVentes cumulées : ${vCumul}💰${vRank.next ? `\nProchain rang "${vRank.next}" : ${vRank.nextAt}💰 (+${vRank.nextAt - vCumul}💰)` : "\n🏆 Rang maximum atteint !"}\n\nClassement : Apprenti → Débutant → Intermédiaire → Confirmé → Expert`}
                side="bottom"
              />
            </span>
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-body">
              {cRank.icon} {cRank.label}
              <HelpTooltip
                text={`📦 Rang contributeur entrepôt\n\nContributions cumulées : ${cCumul} ressources${cRank.next ? `\nProchain rang "${cRank.next}" : ${cRank.nextAt} (+${cRank.nextAt - cCumul})` : "\n👑 Rang maximum atteint !"}\n\nClassement : Radin → Donateur simple → Bon donateur → Super donateur → Donateur premium`}
                side="bottom"
              />
            </span>
            {pCumul > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground font-body">
                {pRank.icon} {pRank.label}
                <HelpTooltip
                  text={`⚔️ Rang militaire\n\nAttaques T5 lancées : ${pCumul}${pRank.next ? `\nProchain rang "${pRank.next}" : ${pRank.nextAt} attaques (+${pRank.nextAt - pCumul})` : "\n⚔️ Rang maximum atteint !"}\n\nClassement : Manant → Écuyer → Chevalier → Sire → Baron → Seigneur de Guerre`}
                  side="bottom"
                />
              </span>
            )}
          </div>
        );
      })()}
    </div>
  );
}