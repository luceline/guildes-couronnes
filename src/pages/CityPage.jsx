/**
 * CityPage : page-passerelle qui affiche soit la VillageView (en ville),
 * soit la BiomeView (dans un biome).
 *
 * Comportement :
 * - Mode repos (bot_city) → ReposView (prime sur tout)
 * - Si dans un biome :
 *   - Mode menu (portrait) → VillageMenuView (avec tuile biome dynamique)
 *   - Mode map (paysage) → BiomeView (map immersive)
 * - Sinon → CityView (qui gère lui-même menu vs map)
 *
 * Maj 16/05/2026 : la bascule biome respecte désormais le mode d'affichage
 * (menu/map) pour permettre le jeu portrait-only quand l'onglet "Mairie"
 * remplace par "Biome".
 */
import { usePlayerData } from "../lib/usePlayerData";
import { BIOMES } from "../lib/biomes";
import { MAX_HUNGER } from "@/lib/gameData";
import { base44 } from "@/api/base44Client";
import { isInRepos } from "@/lib/repos";
import { useVillageViewMode } from "@/lib/useVillageViewMode";
import CityView from "./CityView";
import VillageMenuView from "../components/VillageMenuView";
import BiomeView from "../components/BiomeView";
import ReposView from "../components/ReposView";

export default function CityPage() {
  const { profile, city, homeCity, loading, refresh } = usePlayerData();
  const { mode } = useVillageViewMode();

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

  // Si le joueur est dans un biome : afficher BiomeView (map paysage)
  // OU VillageMenuView (menu portrait), selon le mode d'affichage actif.
  // 16/05/2026 : la VillageMenuView affiche désormais une tuile "Biome"
  // dynamique en lieu et place de la tuile "Mairie", qui ouvre BiomeHub.
  const biomeKey = profile?.current_biome
    || (profile?.travel_destination_id?.startsWith("biome:")
        ? profile.travel_destination_id.replace("biome:", "")
        : null);

  if (profile && !profile.is_traveling && biomeKey && BIOMES[biomeKey]) {
    if (mode === "menu") {
      // Mode portrait : VillageMenuView (la tuile biome est ajoutée automatiquement)
      return (
        <VillageMenuView
          profile={profile}
          city={city || homeCity}
          onRefresh={refresh}
        />
      );
    }
    // Mode paysage : BiomeView immersive
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
