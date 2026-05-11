/**
 * MairieDrawer.jsx
 * Wrapper du contenu Mairie pour affichage en drawer depuis VillageView.
 *
 * Créé le 10/05/2026 (Phase 4 refacto) : permet d'ouvrir la mairie en
 * cliquant sur le sprite mairie de la VillageView, sans passer par CityView
 * et son système de tabs.
 *
 * Encapsule le hook useCityState pour fournir tout ce dont MairieContent a
 * besoin (cityPlayers, isMayor, handleBuild, etc.) à partir des 3 props
 * essentielles : profile, city, onRefresh.
 *
 * Usage côté VillageView :
 *   const DRAWER_TARGETS = {
 *     mairie: { title: "Mairie", Component: MairieDrawer },
 *     ...
 *   };
 */
import { useCityState } from "@/hooks/useCityState";
import MairieContent from "./city/MairieContent";
import ChallengeForm from "./ChallengeForm";

export default function MairieDrawer({ profile, city, onRefresh }) {
  const {
    cityPlayers, routes, allCitiesForMilitary,
    building, selectedAtelier, setSelectedAtelier,
    challengeTarget, setChallengeTarget,
    activeCategory, setActiveCategory,
    mayorActive, isMayor, isAdmin, isHomeCity,
    nbResidents, dailyMaintenance, buildingsByCategory,
    isPlayerOnline,
    handleSetRole, handleExpel, handleBuild,
  } = useCityState(profile, city, onRefresh);

  // homeCity : la ville d'origine du joueur (≠ city affichée si en visite).
  // Pour le drawer, on prend simplement city comme homeCity puisqu'on est dans
  // le contexte d'une mairie spécifique. MairieTab utilise homeCity pour le
  // contexte de gouvernance — si l'utilisateur n'est pas résident, MairieTab
  // gère ce cas (affichage du panneau d'accueil).
  const homeCity = city;

  if (!city || !profile) {
    return (
      <div className="text-center py-8 text-muted-foreground font-body">
        Chargement de la mairie...
      </div>
    );
  }

  return (
    <>
      <MairieContent
        city={city}
        profile={profile}
        homeCity={homeCity}
        cityPlayers={cityPlayers}
        isMayor={isMayor}
        mayorActive={mayorActive}
        isAdmin={isAdmin}
        isHomeCity={isHomeCity}
        routes={routes}
        allCitiesForMilitary={allCitiesForMilitary}
        cityRoles={city?.city_roles || {}}
        selectedAtelier={selectedAtelier}
        setSelectedAtelier={setSelectedAtelier}
        setChallengeTarget={setChallengeTarget}
        handleSetRole={handleSetRole}
        handleExpel={handleExpel}
        isPlayerOnline={isPlayerOnline}
        buildingsByCategory={buildingsByCategory}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        handleBuild={handleBuild}
        dailyMaintenance={dailyMaintenance}
        nbResidents={nbResidents}
        building={building}
        onRefresh={onRefresh}
      />

      {/* Modal défi PvP (déclenchée depuis HabitantsContent via setChallengeTarget) */}
      {challengeTarget && (
        <ChallengeForm
          attacker={profile}
          target={challengeTarget}
          city={city}
          onClose={() => setChallengeTarget(null)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}
