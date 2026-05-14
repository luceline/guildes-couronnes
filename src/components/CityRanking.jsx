import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CITY_LEVELS, getCityTier, getCityBonuses } from "@/lib/gameData";

const RANK_MEDALS = ["🥇", "🥈", "🥉"];
const MAX_THRESHOLD = CITY_LEVELS[CITY_LEVELS.length - 1].threshold;

export default function CityRanking({ profile }) {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.City.list().then(all => {
      setCities(all.filter(c => !c.is_bot_city));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // 13/05/2026 — Tri et affichage des paliers basés sur lingots_cumul
  // (l'or investi par le maire via CityInvestmentPanel), source de vérité
  // unique. Avant : treasury_cumulative (historique de l'or qui a transité),
  // ce qui désynchronisait l'affichage du palier avec la Mairie.
  const ranked = [...cities].sort((a, b) => (b.lingots_cumul || 0) - (a.lingots_cumul || 0));

  return (
    <div className="space-y-3">
      {/* Légende niveaux */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-heading font-semibold text-sm mb-3">📊 Paliers de développement</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {CITY_LEVELS.map(lvl => (
              <div key={lvl.level} className="text-center bg-muted/40 rounded-lg p-2">
                <div className="text-xl">{lvl.icon}</div>
                <div className="font-heading font-semibold text-xs mt-1">{lvl.label}</div>
                <div className="text-xs text-muted-foreground font-body">{lvl.threshold === 0 ? "Départ" : `${lvl.threshold.toLocaleString()} 💰`}</div>
                <div className="text-xs text-primary font-body mt-1">
                  {lvl.productionBonus > 0 && `+${lvl.productionBonus}% prod`}
                  {lvl.marketDiscount > 0 && ` · -${lvl.marketDiscount}% taxe`}
                  {lvl.fatigueBonus > 0 && ` · +${lvl.fatigueBonus}⚡`}
                  {lvl.productionBonus === 0 && lvl.marketDiscount === 0 && lvl.fatigueBonus === 0 && "Aucun bonus"}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {ranked.length === 0 ? (
        <p className="text-muted-foreground font-body text-sm text-center py-8">Aucune ville pour l'instant.</p>
      ) : (
        ranked.map((city, idx) => {
          const cum = city.lingots_cumul || 0;
          const tier = getCityTier(cum);
          const bonuses = getCityBonuses(cum);
          const nextTier = CITY_LEVELS.find(l => l.threshold > cum);
          const prevThreshold = tier.threshold;
          const nextThreshold = nextTier?.threshold ?? MAX_THRESHOLD;
          const progress = nextTier
            ? Math.round(((cum - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
            : 100;
          const isPlayerCity = profile?.city_id === city.id;
          const isHomeCity = profile?.home_city_id === city.id;
          const mayorActive = !!(city.mayor_id && city.mayor_until && city.mayor_until >= new Date().toISOString().split("T")[0]);

          return (
            <Card
              key={city.id}
              className={`transition-all ${isPlayerCity ? "border-primary border-2 shadow-md" : "hover:border-primary/20"}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl w-8 text-center shrink-0 mt-0.5">
                    {RANK_MEDALS[idx] || <span className="text-base font-bold text-muted-foreground">#{idx + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-heading font-bold text-base">{city.name}</span>
                      <Badge variant="outline" className="font-body text-xs">{tier.icon} {tier.label}</Badge>
                      {isPlayerCity && <Badge className="font-body text-xs">📍 Ici</Badge>}
                      {isHomeCity && <Badge variant="secondary" className="font-body text-xs">🏠</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground font-body mb-2">
                      {mayorActive ? `👑 ${city.mayor_name} · mandat jusqu'au ${city.mayor_until}` : "👑 Aucun maire"}
                    </div>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs font-body text-muted-foreground mb-1">
                        <span>{cum.toLocaleString()} 💰 collectés</span>
                        {nextTier
                          ? <span>→ {nextTier.icon} {nextTier.label} dans {(nextThreshold - cum).toLocaleString()} 💰</span>
                          : <span className="text-amber-600 font-semibold">✨ Niveau max !</span>
                        }
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs font-body text-muted-foreground">👥 {city.population || 0}/{city.max_population || 3}</span>
                      <span className="text-xs font-body text-muted-foreground">🏗️ {(city.buildings || []).length} bâtiments</span>
                      {(profile?.visited_cities || [profile?.city_id, profile?.home_city_id].filter(Boolean)).includes(city.id) && (
                        <span className="text-xs font-body text-muted-foreground">💰 taxe {city.tax_rate || 10}%</span>
                      )}
                      {bonuses.productionBonus > 0 && <Badge variant="secondary" className="text-xs font-body">⚒️ +{bonuses.productionBonus}% prod</Badge>}
                      {bonuses.marketDiscount > 0 && <Badge variant="secondary" className="text-xs font-body">🏪 -{bonuses.marketDiscount}% taxe</Badge>}
                      {bonuses.fatigueBonus > 0 && <Badge variant="secondary" className="text-xs font-body">⚡ +{bonuses.fatigueBonus}/j</Badge>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}