/**
 * MairieContent.jsx
 * Refacto Mairie en drawer (10/05/2026) : extraction du contenu de l'ancien
 * onglet "Mairie" de CityView, désormais accessible en cliquant sur le sprite
 * mairie de la VillageView.
 *
 * Layout : 6 sous-onglets latéraux/horizontaux
 *   🏛️ Gouvernance · 👥 Habitants · ⚒️ Métier · 📋 Panneau · 🎉 Événements · 🏗️ Bâtiments
 *
 * NOTE : le header ville (nom, taxe, résidents, trésorerie, bonus bâtiments)
 * a été déplacé en overlay sticky sur la VillageView (toujours visible).
 *
 * Approvisionnement et Urgence ont été retirés : ils sont accessibles via
 * le drawer Entrepôt (sprite entrepôt) pour éviter le doublon.
 */
import { useState } from "react";
import DecreePanel from "../DecreePanel";
import MairieTab from "../MairieTab";
import HabitantsContent from "../city/HabitantsContent";
import ProfessionChangePanel from "../ProfessionChangePanel";
import MayorEventsPanel from "../MayorEventsPanel";
import BatimentsContent from "../city/BatimentsContent";

const SUBTABS = [
  { key: "gouvernance", label: "🏛️ Gouvernance" },
  { key: "habitants",   label: "👥 Habitants"   },
  { key: "metier",      label: "⚒️ Métier"      },
  { key: "panneau",     label: "📋 Panneau"     },
  { key: "evenements",  label: "🎉 Événements"  },
  { key: "batiments",   label: "🏗️ Bâtiments"   },
];

export default function MairieContent(props) {
  const {
    // Refs ville et joueur
    city, profile, homeCity, cityPlayers,
    // Rôles
    isMayor, mayorActive, isAdmin, isHomeCity,
    // Pour MairieTab (gouvernance)
    routes, allCitiesForMilitary,
    // Pour HabitantsContent
    cityRoles, selectedAtelier, setSelectedAtelier,
    setChallengeTarget, handleSetRole, handleExpel, isPlayerOnline,
    // Pour BatimentsContent
    buildingsByCategory, activeCategory, setActiveCategory, handleBuild,
    dailyMaintenance, nbResidents, building,
    // Refresh global
    onRefresh,
  } = props;

  const [activeSubTab, setActiveSubTab] = useState("gouvernance");

  return (
    <div className="space-y-4">
      {/* ── Sous-menu Mairie ── */}
      <div className="flex gap-2 flex-wrap sticky top-0 bg-background pt-1 pb-2 z-10 border-b border-border">
        {SUBTABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveSubTab(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-heading transition-colors border ${
              activeSubTab === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Contenu du sous-onglet actif ── */}

      {activeSubTab === "gouvernance" && (
        <MairieTab
          city={city}
          profile={profile}
          homeCity={homeCity}
          isMayor={isMayor}
          mayorActive={mayorActive}
          isAdmin={isAdmin}
          onRefresh={onRefresh}
          routes={routes}
          cities={allCitiesForMilitary}
          cityPlayers={cityPlayers}
        />
      )}

      {activeSubTab === "habitants" && (
        <HabitantsContent
          cityPlayers={cityPlayers}
          city={city}
          profile={profile}
          isMayor={isMayor}
          isHomeCity={isHomeCity}
          cityRoles={cityRoles}
          selectedAtelier={selectedAtelier}
          setSelectedAtelier={setSelectedAtelier}
          setChallengeTarget={setChallengeTarget}
          onSetRole={handleSetRole}
          onExpel={handleExpel}
          onRefresh={onRefresh}
          isPlayerOnline={isPlayerOnline}
        />
      )}

      {activeSubTab === "metier" && isHomeCity && (
        <ProfessionChangePanel profile={profile} city={city} onRefresh={onRefresh} />
      )}
      {activeSubTab === "metier" && !isHomeCity && (
        <div className="bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground font-body">
          ⚒️ Le changement de métier est réservé aux résidents de cette ville.
        </div>
      )}

      {activeSubTab === "panneau" && (
        <DecreePanel city={city} isMayor={isMayor} onRefresh={onRefresh} />
      )}

      {activeSubTab === "evenements" && (
        <MayorEventsPanel city={city} profile={profile} isMayor={isMayor} onRefresh={onRefresh} />
      )}

      {activeSubTab === "batiments" && (
        <BatimentsContent
          city={city}
          profile={profile}
          isMayor={isMayor}
          isHomeCity={isHomeCity}
          buildingsByCategory={buildingsByCategory}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          handleBuild={handleBuild}
          dailyMaintenance={dailyMaintenance}
          nbResidents={nbResidents}
          building={building}
        />
      )}
    </div>
  );
}
