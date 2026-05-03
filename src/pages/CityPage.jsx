import { usePlayerData } from "../lib/usePlayerData";
import BiomeHub from "../components/BiomeHub";
import { BIOMES } from "../lib/biomes";
import { MAX_HUNGER } from "@/lib/gameData";
import { base44 } from "@/api/base44Client";
import CityView from "./CityView";

export default function CityPage() {
  const { profile, city, homeCity, loading, refresh } = usePlayerData();

  // Migration : initialiser la faim pour les anciens profils
  if (profile && (profile.hunger === undefined || profile.hunger === null)) {
    base44.entities.PlayerProfile.update(profile.id, { hunger: MAX_HUNGER }).catch(() => {});
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Si le joueur est dans un biome
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
            onRefresh={refresh}
          />
        </div>
      );
    }
  }

  return <CityView profile={profile} city={city} homeCity={homeCity} onRefresh={refresh} />;
}
