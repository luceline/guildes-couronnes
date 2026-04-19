import { useState, useEffect, useCallback } from "react";
import BiomeHub from "../components/BiomeHub";
import { BIOMES } from "../lib/biomeData";
import { applyHungerRegen } from "../lib/hungerRegen";
import { base44 } from "@/api/base44Client";
import CityView from "./CityView";
import { MAX_HUNGER } from "@/lib/gameData";

export default function CityPage() {
  const [profile, setProfile] = useState(null);
  const [city, setCity] = useState(null);
  const [homeCity, setHomeCity] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const user = await base44.auth.me();
    const profiles = await base44.entities.PlayerProfile.filter({ user_email: user.email });
    if (profiles.length > 0) {
      let p = profiles[0];
      p = await applyHungerRegen(p);
      // ── Migration : initialiser la faim pour les anciens profils qui n'ont pas ce champ ──
      if (p.hunger === undefined || p.hunger === null) {
        await base44.entities.PlayerProfile.update(p.id, { hunger: MAX_HUNGER });
        p = { ...p, hunger: MAX_HUNGER };
      }

    // ── Arrivée automatique si le voyage est terminé ──
    if (p.is_traveling && p.travel_arrival_time && new Date(p.travel_arrival_time) <= new Date()) {
      // Arrivée biome : juste mettre is_traveling=false, garder travel_destination_id pour savoir où on est
      if (p.travel_destination_id && p.travel_destination_id.startsWith("biome:")) {
        await base44.entities.PlayerProfile.update(p.id, {
          is_traveling: false,
          travel_arrival_time: "",
          // travel_destination_id conservé → permet d'afficher le biome
        });
        p = { ...p, is_traveling: false, travel_arrival_time: "" };
        // On garde travel_destination_id = "biome:xxx" pour que CityPage affiche BiomeHub
      } else {
      const allCities = await base44.entities.City.list();
      const destId = p.travel_destination_id;
      const arrivalCity = allCities.find(c => c.id === destId);
      const visited = [...new Set([...(p.visited_cities || []), destId])];
      const profileUpdates = {
        city_id: destId,
        is_traveling: false,
        travel_destination_id: "",
        travel_arrival_time: "",
        visited_cities: visited,
      };
      if (arrivalCity) {
        const wallCount = (arrivalCity.buildings || []).filter(b => b.building_type === "remparts").length;
        const isResident = p.home_city_id === destId || p.city_id === destId;
        const toll = (!isResident && wallCount > 0) ? wallCount : 0;
        if (toll > 0) {
          const actualToll = Math.min(toll, p.gold || 0);
          profileUpdates.gold = (p.gold || 0) - actualToll;
          await base44.entities.City.update(arrivalCity.id, {
            gold_treasury: (arrivalCity.gold_treasury || 0) + actualToll,
            treasury_cumulative: (arrivalCity.treasury_cumulative || 0) + actualToll,
          });
        }
      }
      await base44.entities.PlayerProfile.update(p.id, profileUpdates);
      p = { ...p, ...profileUpdates };
      } // fin else biome
    }
      setProfile(p);
      if (p.city_id) {
        // City.get() direct pour éviter le cache de City.list()
        const [currentCity, allCities] = await Promise.all([
          base44.entities.City.get(p.city_id).catch(() => null),
          base44.entities.City.list(),
        ]);
        setCity(currentCity || allCities.find(c => c.id === p.city_id) || null);
        const homeCityId = p.home_city_id || p.city_id;
        setHomeCity(allCities.find(c => c.id === homeCityId) || null);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Si le joueur est dans un biome (arrivé, pas en voyage)
  if (profile && !profile.is_traveling && profile.travel_destination_id?.startsWith("biome:")) {
    const biomeKey = profile.travel_destination_id.replace("biome:", "");
    const biomeInfo = BIOMES[biomeKey];
    if (biomeInfo) {
      return (
        <div className="space-y-4 pb-20 md:pb-0">
          <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2">
            <span className="text-lg">{biomeInfo.icon}</span>
            <span className="text-sm font-heading font-semibold">{biomeInfo.name}</span>
            <span className="text-xs text-muted-foreground font-body ml-auto">📍 Vous êtes dans ce biome</span>
          </div>
          <BiomeHub
            profile={profile}
            biomeKey={biomeKey}
            biomeInfo={biomeInfo}
            city={city}
            onRefresh={loadData}
          />
        </div>
      );
    }
  }

  return <CityView profile={profile} city={city} homeCity={homeCity} onRefresh={loadData} />;
}