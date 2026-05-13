/**
 * CityPage : page-passerelle qui affiche soit la VillageView (en ville),
 * soit la BiomeView (dans un biome).
 *
 * Comportement (10/05/2026) :
 * - Si le joueur est physiquement dans un biome (travel_destination_id
 *   startsWith "biome:" + pas en voyage) → BiomeView (map immersive)
 * - Sinon → CityView (map ville classique)
 *
 * Note : c'est ici (et pas dans TravelPage) que la bascule biome se fait,
 * car la route /city est la route "localisation" du joueur (le bouton
 * dans le header affiche le nom de la localisation : ville ou biome).
 */
import { usePlayerData } from "../lib/usePlayerData";
import { BIOMES } from "../lib/biomes";
import { MAX_HUNGER } from "@/lib/gameData";
import { base44 } from "@/api/base44Client";
import { isInRepos } from "@/lib/repos";
import CityView from "./CityView";
import BiomeView from "../components/BiomeView";
import ReposView from "../components/ReposView";

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

  // 13/05/2026 — Mode repos : si le joueur séjourne à Repos-sur-Mer (ou toute
  // autre bot_city future), afficher la vue simplifiée sans aucun panneau
  // d'action. Cette bascule prime sur la bascule biome ci-dessous : un joueur
  // en bot_city n'est jamais dans un biome simultanément.
  if (profile && !profile.is_traveling && isInRepos(profile)) {
    return <ReposView profile={profile} onRefresh={refresh} />;
  }

  // Si le joueur est dans un biome : afficher la BiomeView (map immersive
  // 10/05/2026). On accepte 2 conditions :
  // 1. current_biome est set (mode "vrai voyage arrivé")
  // 2. travel_destination_id.startsWith("biome:") (mode "exploration directe")
  const biomeKey = profile?.current_biome
    || (profile?.travel_destination_id?.startsWith("biome:")
        ? profile.travel_destination_id.replace("biome:", "")
        : null);

  if (profile && !profile.is_traveling && biomeKey && BIOMES[biomeKey]) {
    return (
      <BiomeView
        profile={profile}
        city={city || homeCity}
        onRefresh={refresh}
        biomeKey={biomeKey}
      />
    );
  }

  return <CityView profile={profile} city={city} homeCity={homeCity} onRefresh={refresh} />;
}
