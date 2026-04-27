import { useState } from "react";
import { usePlayerData } from "../lib/usePlayerData";
import Travel from "../pages/Travel";
import WorldMap from "../pages/WorldMap";

export default function TravelPage() {
  const { profile, city, homeCity, loading, refresh } = usePlayerData();
  const [view, setView] = useState("voyage");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
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

      {view === "voyage"
        ? <Travel profile={profile} city={city} homeCity={homeCity} onRefresh={refresh} />
        : <WorldMap profile={profile} />
      }
    </div>
  );
}
