import { applyHungerRegen } from "../lib/hungerRegen";
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import Travel from "./Travel";
import WorldMap from "./WorldMap";

export default function TravelPage() {
  const [profile, setProfile] = useState(null);
  const [city, setCity] = useState(null);
  const [homeCity, setHomeCity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("voyage"); // "voyage" | "carte"

  const loadData = useCallback(async () => {
    const user = await base44.auth.me();
    const profiles = await base44.entities.PlayerProfile.filter({ user_email: user.email });
    if (profiles.length > 0) {
      let p = profiles[0];
      p = await applyHungerRegen(p);

      if (p.is_traveling && p.travel_arrival_time && new Date(p.travel_arrival_time) <= new Date()) {
        if (p.travel_destination_id && p.travel_destination_id.startsWith("biome:")) {
          await base44.entities.PlayerProfile.update(p.id, {
            is_traveling: false,
            travel_arrival_time: "",
            travel_destination_id: "",
          });
          p = { ...p, is_traveling: false, travel_arrival_time: "", travel_destination_id: "" };
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
        }
      }

      setProfile(p);
      if (p.city_id) {
        const cities = await base44.entities.City.list();
        setCity(cities.find(c => c.id === p.city_id) || null);
        const homeCityId = p.home_city_id || p.city_id;
        setHomeCity(cities.find(c => c.id === homeCityId) || null);
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

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      {/* Sélecteur Voyage / Carte */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        <button
          onClick={() => setView("voyage")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-heading transition-colors ${
            view === "voyage"
              ? "bg-card text-foreground shadow font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          🐴 Voyage
        </button>
        <button
          onClick={() => setView("carte")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-heading transition-colors ${
            view === "carte"
              ? "bg-card text-foreground shadow font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          🗺️ Carte
        </button>
      </div>

      {/* Contenu */}
      {view === "voyage"
        ? <Travel profile={profile} city={city} homeCity={homeCity} onRefresh={loadData} />
        : <WorldMap profile={profile} />
      }
    </div>
  );
}
