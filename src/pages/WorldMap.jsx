import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PlayerStatusBar from "../components/PlayerStatusBar";
import MapView from "../components/MapView";

export default function WorldMap({ profile }) {
  const [homeCity, setHomeCity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const allCities = await base44.entities.City.list();
      const hc = allCities.find(c => c.id === (profile?.home_city_id || profile?.city_id)) || null;
      setHomeCity(hc);
      setLoading(false);
    }
    load();
  }, [profile]);

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
        <h2 className="font-heading text-2xl font-bold">🗺️ Carte du monde</h2>
        <p className="text-muted-foreground font-body text-sm mt-1">
          Routes commerciales entre les villes. Clique sur une ville pour voir ses détails.
        </p>
      </div>

      <MapView profile={profile} />
    </div>
  );
}
