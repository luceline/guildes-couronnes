/**
 * WealthTaxPanel : panneau permettant au maire de lever un impôt sur la fortune
 * de ses citoyens les plus riches (≥ 1500 or).
 *
 * 13/05/2026 — Nouveau levier politique pour alimenter la trésorerie de ville
 * (qui sert ensuite à investir dans le palier via CityInvestmentPanel).
 *
 * Spec :
 *   - Seuil de "riche" : 1500 or (constante, anti-abus politique)
 *   - Taux : slider 1-5% choisi par le maire, défaut 2%
 *   - Cible : tous les joueurs avec home_city_id === city.id ET gold >= 1500
 *   - Cooldown : 1× par jour calendaire UTC (champ city.wealth_tax_last_date)
 *   - Effet : floor(gold * taux/100) prélevé de chaque cible, ajouté à
 *     city.gold_treasury en un seul update final
 *   - Log : transaction "impot_fortune" par joueur prélevé
 *
 * Visible par tous (transparence civique), fonctionnel maire seul.
 */
import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { logGold } from "@/lib/goldLog";

const WEALTH_THRESHOLD = 1500;
const MIN_RATE = 1;
const MAX_RATE = 5;
const DEFAULT_RATE = 2;

export default function WealthTaxPanel({ city, profile, isMayor, onRefresh }) {
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [levying, setLevying] = useState(false);
  // Habitants chargés en lazy depuis le serveur pour l'estimation préalable.
  const [citizens, setCitizens] = useState([]);
  const [loadingCitizens, setLoadingCitizens] = useState(true);

  // Charger une fois les citoyens de la ville (home_city_id = city.id) au montage.
  // Pas de subscribe : l'estimation peut être un peu décalée, c'est OK pour un
  // simple aperçu. Le fetch frais sera refait au moment du clic "Lever".
  useEffect(() => {
    let active = true;
    setLoadingCitizens(true);
    base44.entities.PlayerProfile.filter({ home_city_id: city.id })
      .then(list => {
        if (!active) return;
        setCitizens(list || []);
        setLoadingCitizens(false);
      })
      .catch(() => {
        if (!active) return;
        setCitizens([]);
        setLoadingCitizens(false);
      });
    return () => { active = false; };
  }, [city.id]);

  // Cooldown : déjà utilisé aujourd'hui ?
  const today = new Date().toISOString().split("T")[0];
  const alreadyUsedToday = city.wealth_tax_last_date === today;

  // Estimation : nombre de citoyens éligibles + total estimé prélevé.
  // Utilise le state local (chargé lazy), donc peut être stale de qq secondes,
  // mais largement suffisant pour donner une idée au maire avant le clic.
  const estimate = useMemo(() => {
    const eligible = citizens.filter(p => (p.gold || 0) >= WEALTH_THRESHOLD);
    const totalTake = eligible.reduce((sum, p) => sum + Math.floor((p.gold || 0) * rate / 100), 0);
    return { count: eligible.length, total: totalTake };
  }, [citizens, rate]);

  async function handleLevy() {
    if (levying) return;
    if (!isMayor) {
      toast.error("Seul le maire peut lever l'impôt sur la fortune.");
      return;
    }
    if (alreadyUsedToday) {
      toast.error("L'impôt sur la fortune a déjà été levé aujourd'hui. Réessayez demain.");
      return;
    }

    setLevying(true);
    try {
      // Re-fetch la ville pour vérifier le cooldown à jour (anti race condition
      // entre deux maires si jamais la ville changeait pendant le slider).
      const freshCity = await base44.entities.City.get(city.id).catch(() => null);
      if (freshCity?.wealth_tax_last_date === today) {
        toast.error("L'impôt a déjà été levé aujourd'hui (mise à jour reçue entre temps).");
        setLevying(false);
        return;
      }

      // Re-fetch les habitants frais à l'instant du clic. L'estimation pré-clic
      // peut être obsolète (un joueur a pu dépenser ou gagner de l'or).
      const fresh = await base44.entities.PlayerProfile.filter({ home_city_id: city.id });
      const eligible = (fresh || []).filter(p => (p.gold || 0) >= WEALTH_THRESHOLD);

      if (eligible.length === 0) {
        toast.warning("Aucun citoyen riche à imposer aujourd'hui.");
        // On enregistre quand même le cooldown : éviter le spam de re-checks.
        await base44.entities.City.update(city.id, { wealth_tax_last_date: today });
        setLevying(false);
        if (onRefresh) await onRefresh();
        return;
      }

      // Prélever sur chaque joueur en parallèle. En cas d'échec partiel, on
      // logue et on continue : mieux vaut un prélèvement partiel qu'aucun.
      let totalCollected = 0;
      const updates = eligible.map(async (p) => {
        const amount = Math.floor((p.gold || 0) * rate / 100);
        if (amount <= 0) return 0;
        try {
          await base44.entities.PlayerProfile.update(p.id, {
            gold: (p.gold || 0) - amount,
          });
          await logGold({
            profile: p,
            city,
            amount: -amount,
            type: "impot_fortune",
            description: `Impôt sur la fortune ${rate}% (${city.name})`,
          });
          return amount;
        } catch (e) {
          console.warn(`Wealth tax failed for ${p.user_email}:`, e);
          return 0;
        }
      });
      const collected = await Promise.all(updates);
      totalCollected = collected.reduce((s, n) => s + n, 0);

      // Créditer la trésorerie de la ville + enregistrer le cooldown.
      await base44.entities.City.update(city.id, {
        gold_treasury: (freshCity?.gold_treasury ?? city.gold_treasury ?? 0) + totalCollected,
        wealth_tax_last_date: today,
      });

      toast.success(`💸 Impôt levé : ${totalCollected.toLocaleString()} or prélevé sur ${eligible.length} citoyen(s).`, { duration: 6000 });
      if (onRefresh) await onRefresh();
    } catch (e) {
      console.error("WealthTaxPanel.handleLevy:", e);
      toast.error("Le prélèvement a échoué. Réessayez.");
    } finally {
      setLevying(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          💸 Impôt sur la fortune
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">

        <p className="text-xs font-body text-muted-foreground">
          Le maire peut prélever <strong>une fois par jour</strong> un pourcentage de l'or
          des citoyens dont la fortune dépasse <strong>{WEALTH_THRESHOLD.toLocaleString()} or</strong>.
          L'or prélevé alimente la trésorerie de la ville.
        </p>

        {!isMayor ? (
          <p className="text-xs text-muted-foreground italic font-body border-t pt-3">
            Seul le maire peut décider de lever l'impôt sur la fortune.
          </p>
        ) : (
          <>
            <div className="border-t pt-3 space-y-3">
              {/* Slider de taux */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-body">
                  <span>Taux de prélèvement</span>
                  <strong className="font-heading text-base">{rate}%</strong>
                </div>
                <Slider
                  min={MIN_RATE}
                  max={MAX_RATE}
                  step={1}
                  value={[rate]}
                  onValueChange={(v) => setRate(v[0])}
                  disabled={levying || alreadyUsedToday}
                />
                <div className="flex justify-between text-xs text-muted-foreground font-body">
                  <span>{MIN_RATE}% (doux)</span>
                  <span>{MAX_RATE}% (brutal)</span>
                </div>
              </div>

              {/* Estimation */}
              <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-xs font-body">
                {loadingCitizens ? (
                  <span className="text-muted-foreground italic">Chargement des citoyens...</span>
                ) : estimate.count === 0 ? (
                  <span className="text-muted-foreground">Aucun citoyen avec plus de {WEALTH_THRESHOLD.toLocaleString()} or actuellement.</span>
                ) : (
                  <>
                    <strong>{estimate.count}</strong> citoyen(s) concerné(s) · Total estimé :
                    <strong className="text-amber-900"> {estimate.total.toLocaleString()} 💰</strong>
                  </>
                )}
              </div>

              {/* État du cooldown */}
              {alreadyUsedToday && (
                <div className="text-xs text-orange-700 font-body italic">
                  ⏰ Vous avez déjà levé l'impôt aujourd'hui. Prochain prélèvement possible demain (UTC).
                </div>
              )}

              {/* Bouton */}
              <Button
                onClick={handleLevy}
                disabled={levying || alreadyUsedToday || estimate.count === 0}
                variant={alreadyUsedToday ? "outline" : "default"}
                className="w-full font-heading"
              >
                {levying ? "Prélèvement en cours..."
                  : alreadyUsedToday ? "Déjà levé aujourd'hui"
                  : estimate.count === 0 ? "Aucune cible"
                  : `💸 Lever l'impôt (${rate}%)`}
              </Button>

              <p className="text-xs text-muted-foreground italic font-body">
                ⚠️ Action visible et conséquente : annoncez-le à vos citoyens. Une décision politique impopulaire peut entraîner des départs.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
