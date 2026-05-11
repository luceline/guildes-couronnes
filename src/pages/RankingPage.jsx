import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlayerStatusBar from "../components/PlayerStatusBar";
import PlayerRanking from "../components/PlayerRanking";
import { BUILDING_TYPES, getCityTier, CITY_LEVELS } from "../lib/gameData";

export default function RankingPage({ profile }) {
  const [cities, setCities] = useState([]);
  const [realPop, setRealPop] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [allCities, allPlayers] = await Promise.all([
        base44.entities.City.list(),
        base44.entities.PlayerProfile.list("-created_date", 1000),
      ]);
      const filtered = allCities.filter(c => !c.is_bot_city);
      setCities(filtered);
      // Compter la vraie population par home_city_id
      const counts = {};
      filtered.forEach(c => counts[c.id] = 0);
      allPlayers.forEach(p => {
        if (counts.hasOwnProperty(p.home_city_id)) counts[p.home_city_id]++;
      });
      setRealPop(counts);
      setLoading(false);
    }
    load();
  }, []);

  const homeCity = cities.find(c => c.id === (profile?.home_city_id || profile?.city_id)) || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* PlayerStatusBar retiré (10/05/2026) — globale dans GameLayout */}
      {/* {profile && <PlayerStatusBar profile={profile} homeCity={homeCity} />} */}

      <div>
        <h2 className="font-heading text-2xl font-bold heading-medieval">🏆 Classements</h2>
        <p className="text-muted-foreground font-body text-sm mt-1">
          Villes les plus prospères et joueurs les plus actifs du royaume.
        </p>
      </div>

      <Tabs defaultValue="villes">
        <TabsList className="font-heading flex-wrap h-auto gap-1">
          <TabsTrigger value="villes">🏙️ Villes</TabsTrigger>
          <TabsTrigger value="joueurs">👤 Joueurs</TabsTrigger>
        </TabsList>

        {/* ── VILLES ── */}
        <TabsContent value="villes" className="mt-4 space-y-4">

          {/* Paliers de développement */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-heading font-semibold text-sm mb-3">📊 Paliers de développement</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {CITY_LEVELS.map(lvl => (
                  <div key={lvl.level} className="text-center bg-muted/40 rounded-lg p-2">
                    <div className="text-xl">{lvl.icon}</div>
                    <div className="font-heading font-semibold text-xs mt-1">{lvl.label}</div>
                    <div className="text-xs text-muted-foreground font-body">{lvl.threshold === 0 ? "Départ" : `${lvl.threshold.toLocaleString()} 🪙`}</div>
                    <div className="text-xs text-primary font-body mt-1">
                      {lvl.description || "Aucun bonus"}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Liste simple des villes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cities.map(city => {
              const isCurrentCity = profile?.city_id === city.id;
              const isHomeCity = profile?.home_city_id === city.id;
              const tier = getCityTier(city.lingots_cumul || 0);
              return (
                <Card
                  key={city.id}
                  className={`transition-all ${isCurrentCity ? "border-primary border-2 shadow-lg" : "hover:border-primary/30"}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-heading font-bold text-base">{city.name}</h3>
                        <p className="text-xs text-muted-foreground font-body">
                          {tier.icon} {tier.label} · 👑 {city.mayor_name || "Aucun"}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {isCurrentCity && <Badge>📍 Ici</Badge>}
                        {isHomeCity && <Badge variant="secondary">🏠</Badge>}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground font-body mb-3">{city.description}</p>

                    <div className="grid grid-cols-2 gap-2 text-sm font-body">
                      <div className="bg-muted/50 rounded p-2">
                        <div className="text-muted-foreground text-xs">Population</div>
                        <div className="font-semibold">{realPop[city.id] ?? city.population ?? 0}/{city.max_population || 5}</div>
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <div className="text-muted-foreground text-xs">Lingots</div>
                        <div className="font-semibold">{(city.lingots_cumul || 0).toLocaleString()} 🪙</div>
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <div className="text-muted-foreground text-xs">Taxe</div>
                        <div className="font-semibold">{isCurrentCity ? `${city.tax_rate}%` : "❓"}</div>
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <div className="text-muted-foreground text-xs">Bâtiments</div>
                        <div className="font-semibold">{(city.buildings || []).length}</div>
                      </div>
                    </div>

                    {(city.buildings || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {(city.buildings || []).map((b, i) => (
                          <span key={i} className="text-lg" title={b.name}>
                            {BUILDING_TYPES[b.building_type]?.icon || "🏠"}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── CLASSEMENT JOUEURS ── */}
        <TabsContent value="joueurs" className="mt-4">
          <PlayerRanking />
        </TabsContent>
      </Tabs>
    </div>
  );
}
