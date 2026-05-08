import { usePlayerData } from "../lib/usePlayerData";
import { useGameData } from "../lib/useGameData";
import Production from "./Production";

export default function ProductionPage({ defaultTab = "farm" } = {}) {
  const { profile, city, homeCity, loading, refresh } = usePlayerData();
  const { gameData, loading: gameDataLoading } = useGameData();

  if (loading || gameDataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return <Production profile={profile} city={city} homeCity={homeCity} onRefresh={refresh} gameData={gameData} defaultTab={defaultTab} />;
}
