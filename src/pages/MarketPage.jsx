import { usePlayerData } from "../lib/usePlayerData";
import Market from "./Market";

export default function MarketPage() {
  const { profile, city, homeCity, loading, refresh } = usePlayerData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Bloquer si joueur en biome
  if (profile && !profile.is_traveling && profile.travel_destination_id?.startsWith("biome:")) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <span className="text-5xl">🌿</span>
        <h2 className="font-heading text-xl font-semibold">Vous êtes dans un biome</h2>
        <p className="text-muted-foreground font-body text-sm max-w-xs">
          Le marché n'est pas accessible depuis un biome. Retournez en ville d'abord.
        </p>
      </div>
    );
  }

  return <Market profile={profile} city={city} homeCity={homeCity} onRefresh={refresh} />;
}
