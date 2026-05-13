/**
 * CityInvestmentPanel : panneau d'investissement de la trésorerie de ville
 * pour faire monter le palier de la ville.
 *
 * 13/05/2026 — Refonte du système de paliers (cf. gameData.CITY_LEVELS).
 *
 * Visible par tous, mais le slider et le bouton ne sont fonctionnels que pour
 * le maire actuel de la ville. Les autres voient l'état actuel (progression
 * vers le prochain palier, palier actif, etc.) sans pouvoir interagir.
 *
 * Mécanique :
 *   - Slider de 100 (min) à city.gold_treasury (max)
 *   - Au clic : city.gold_treasury -= X, city.lingots_cumul += X
 *   - Si palier franchi : toast spécial + refresh
 *   - L'or investi est DÉTRUIT (sort de la trésorerie sans destination).
 *     Cohérent avec le concept "investir pour développer la ville".
 *
 * Le champ lingots_cumul (nom hérité du système précédent à base de lingot_royal)
 * stocke désormais l'or cumulatif investi. À renommer dans un refacto futur.
 */
import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { CITY_LEVELS, getCityTier, BUILDING_CATEGORIES } from "@/lib/gameData";
import { logGold } from "@/lib/goldLog";

const MIN_INVESTMENT = 100;

export default function CityInvestmentPanel({ city, profile, isMayor, onRefresh }) {
  const [investing, setInvesting] = useState(false);
  // Montant à investir, contrôlé par le slider. Initialement au minimum.
  const [amount, setAmount] = useState(MIN_INVESTMENT);

  // Calculs dérivés mémorisés pour éviter de recalculer à chaque render.
  const computed = useMemo(() => {
    const lingotsCumul = city?.lingots_cumul || 0;
    const treasury = city?.gold_treasury || 0;
    const currentTier = getCityTier(lingotsCumul);
    // Prochain palier strictement supérieur (null si on est déjà au max).
    const nextTier = CITY_LEVELS.find(l => l.threshold > lingotsCumul) || null;
    const maxInvest = Math.max(MIN_INVESTMENT, treasury);
    const canInvest = treasury >= MIN_INVESTMENT;
    // Pour la barre de progression : on affiche le pourcentage entre le
    // palier ACTUEL et le palier SUIVANT. Si max atteint : barre pleine.
    let progressPct = 100;
    let towardsLabel = "Palier maximal atteint";
    if (nextTier) {
      const span = nextTier.threshold - currentTier.threshold;
      const filled = lingotsCumul - currentTier.threshold;
      progressPct = span > 0 ? Math.min(100, Math.round((filled / span) * 100)) : 0;
      const remaining = nextTier.threshold - lingotsCumul;
      towardsLabel = `${remaining.toLocaleString()} or vers ${nextTier.icon} ${nextTier.label}`;
    }
    return { lingotsCumul, treasury, currentTier, nextTier, maxInvest, canInvest, progressPct, towardsLabel };
  }, [city?.lingots_cumul, city?.gold_treasury]);

  async function handleInvest() {
    if (investing) return;
    if (!isMayor) {
      toast.error("Seul le maire peut investir la trésorerie.");
      return;
    }
    const amt = Math.floor(amount);
    if (amt < MIN_INVESTMENT) {
      toast.error(`Investissement minimum : ${MIN_INVESTMENT} or.`);
      return;
    }
    if (amt > computed.treasury) {
      toast.error("La trésorerie n'a pas assez d'or pour cet investissement.");
      return;
    }

    setInvesting(true);
    try {
      // Re-fetch la ville pour avoir l'état frais (treasury a pu changer).
      const fresh = await base44.entities.City.get(city.id).catch(() => city);
      const freshTreasury = fresh?.gold_treasury || 0;
      const freshCumul = fresh?.lingots_cumul || 0;
      if (freshTreasury < amt) {
        toast.error("La trésorerie a changé entre temps. Réessayez avec un nouveau montant.");
        setInvesting(false);
        return;
      }

      const newTreasury = freshTreasury - amt;
      const newCumul = freshCumul + amt;

      // Détecter le franchissement d'un palier pour message spécial.
      const oldTier = getCityTier(freshCumul);
      const newTier = getCityTier(newCumul);
      const tierCrossed = newTier.level > oldTier.level;

      await base44.entities.City.update(city.id, {
        gold_treasury: newTreasury,
        lingots_cumul: newCumul,
      });

      // Log pour traçabilité économique. amount négatif côté trésorerie.
      try {
        await logGold({
          profile,
          city,
          amount: -amt,
          type: "investissement_palier",
          description: `Investissement palier de ville : ${amt} or → ${newTier.icon} ${newTier.label}`,
        });
      } catch (e) { console.warn("logGold investment:", e); }

      if (tierCrossed) {
        toast.success(`🎉 ${city.name} accède au palier ${newTier.icon} ${newTier.label} !`, { duration: 6000 });
      } else {
        toast.success(`💰 ${amt} or investi. Progression : ${newCumul.toLocaleString()} / ${computed.nextTier?.threshold.toLocaleString() || "max"}`);
      }

      // Reset du slider au minimum après l'investissement.
      setAmount(MIN_INVESTMENT);
      if (onRefresh) await onRefresh();
    } catch (e) {
      console.error("CityInvestmentPanel.handleInvest:", e);
      toast.error("Investissement échoué. Réessayez.");
    } finally {
      setInvesting(false);
    }
  }

  if (!city) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          🏛️ Développement de la ville
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Palier actuel + progression */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{computed.currentTier.icon}</span>
              <div>
                <p className="font-heading text-base">{computed.currentTier.label}</p>
                <p className="text-xs text-muted-foreground font-body">Palier actuel</p>
              </div>
            </div>
            <Badge variant="secondary" className="font-body">
              {computed.lingotsCumul.toLocaleString()} or investis
            </Badge>
          </div>

          {computed.nextTier ? (
            <>
              <Progress value={computed.progressPct} className="h-2" />
              <p className="text-xs text-center text-muted-foreground font-body">
                {computed.towardsLabel}
              </p>
            </>
          ) : (
            <p className="text-xs text-center text-amber-600 font-heading">
              ✨ Palier maximal atteint
            </p>
          )}
        </div>

        {/* Catégories débloquées au palier actuel */}
        <div className="border-t pt-3">
          <p className="text-xs font-semibold font-body mb-2">Bâtiments accessibles ({computed.currentTier.unlocksCategories?.length || 0}) :</p>
          <div className="flex flex-wrap gap-1">
            {(computed.currentTier.unlocksCategories || []).map(catKey => {
              const cat = BUILDING_CATEGORIES[catKey];
              if (!cat) return null;
              return (
                <Badge key={catKey} variant="outline" className="text-xs font-body">
                  {cat.label}
                </Badge>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground font-body mt-2">
            Niveau max atteignable : <strong>{computed.currentTier.maxBuildingLevel}</strong>
          </p>
        </div>

        {/* Annonce du déblocage du prochain palier */}
        {computed.nextTier && (
          <div className="border-t pt-3 text-xs font-body text-muted-foreground italic">
            <strong className="text-foreground not-italic">Au prochain palier ({computed.nextTier.icon} {computed.nextTier.label})</strong> : {computed.nextTier.description}
          </div>
        )}

        {/* Bloc investissement : visible par tous, fonctionnel maire seul */}
        {computed.nextTier && (
          <div className="border-t pt-3 space-y-3">
            <div className="flex items-center justify-between text-xs font-body">
              <span className="text-muted-foreground">Trésorerie disponible</span>
              <strong>{computed.treasury.toLocaleString()} 💰</strong>
            </div>

            {!isMayor ? (
              <p className="text-xs text-muted-foreground italic font-body">
                Seul le maire peut décider d'investir la trésorerie pour faire progresser la ville.
              </p>
            ) : !computed.canInvest ? (
              <p className="text-xs text-orange-600 font-body">
                ⚠️ La trésorerie n'a pas atteint le seuil minimum d'investissement ({MIN_INVESTMENT} or).
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-body">
                    <span>Montant à investir</span>
                    <strong className="font-heading text-base">{amount.toLocaleString()} 💰</strong>
                  </div>
                  <Slider
                    min={MIN_INVESTMENT}
                    max={computed.maxInvest}
                    step={Math.max(1, Math.floor(computed.maxInvest / 100))}
                    value={[amount]}
                    onValueChange={(v) => setAmount(Math.min(computed.maxInvest, Math.max(MIN_INVESTMENT, v[0])))}
                    disabled={investing}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground font-body">
                    <span>{MIN_INVESTMENT}</span>
                    <span>{computed.maxInvest.toLocaleString()}</span>
                  </div>
                </div>

                <Button
                  className="w-full font-heading"
                  onClick={handleInvest}
                  disabled={investing || !computed.canInvest}
                >
                  {investing ? "Investissement..." : `💰 Investir ${amount.toLocaleString()} or`}
                </Button>
                <p className="text-xs text-muted-foreground italic font-body text-center">
                  L'or investi est détruit (sort de l'économie). Cohérent avec le développement du palier.
                </p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
