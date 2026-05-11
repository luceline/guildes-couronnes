import { applyHungerRegen } from "../lib/hungerRegen";
import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import CharacterCreation from "./CharacterCreation";
import Dashboard from "./Dashboard";
import { MAX_HUNGER, getFatigueRegenInterval } from "../lib/gameData";
import { getMaxFatigue } from "../lib/gameData";
import { updateLastActive, runInactivityCheck } from "../lib/inactivityCheck";
import { getProfessionsList } from "../lib/professions";
import { toast } from "sonner";

// Détection mobile : sur mobile on redirige vers /city (full-screen map),
// sur desktop on affiche le Dashboard (page d'accueil classique).
// Note : window.matchMedia est lu une fois au mount, pas réactif au resize
// (rare changement entre mobile/desktop pendant une session).
function isMobileScreen() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(max-width: 767px)").matches;
}

// ── Migration Producteur → nouveau métier ──
// Liste centralisée — voir @/lib/professions. Évite que d'anciens métiers
// supprimés (ex: "Producteur") apparaissent ici.
const PROFESSIONS_LIST = getProfessionsList();

function ProfessionMigration({ profile, onComplete }) {
  const [choice, setChoice] = useState("");
  const [saving, setSaving] = useState(false);

  const handleMigrate = async () => {
    if (!choice) { alert("Choisissez un métier."); return; }
    setSaving(true);
    await base44.entities.PlayerProfile.update(profile.id, { profession: choice });
    toast.success(`✅ Bienvenue dans le métier de ${choice} !`);
    setSaving(false);
    onComplete?.();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="text-5xl mb-2">⚒️</div>
        <h2 className="text-2xl font-bold font-heading">Réorientation professionnelle</h2>
        <p className="text-muted-foreground font-body">
          Le métier de <strong>Producteur</strong> a été fusionné dans d'autres professions.
          Choisissez votre nouveau métier : vos items existants sont conservés.
        </p>
        <select value={choice} onChange={e => setChoice(e.target.value)}
          className="w-full border border-border rounded-lg px-4 py-3 font-body bg-background text-base">
          <option value="">Choisir un métier</option>
          {PROFESSIONS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button disabled={!choice || saving} onClick={handleMigrate}
          className="w-full bg-primary text-primary-foreground font-heading rounded-lg px-6 py-3 disabled:opacity-50">
          {saving ? "Enregistrement..." : "Confirmer mon nouveau métier"}
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [profile, setProfile] = useState(null);
  const [city, setCity] = useState(null);
  const [homeCity, setHomeCity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  const loadProfile = useCallback(async () => {
    const user = await base44.auth.me();
    if (!user?.email) { setLoading(false); return; }

    const profiles = await base44.entities.PlayerProfile.filter({ user_email: user.email });
    if (profiles.length > 0) {
      let p = profiles[0];

      // Regen faim + énergie (centralisé) : on charge la ville pour bénéficier de Fontaine/Hospice
      let homeCity = null;
      if (p.home_city_id) {
        homeCity = await base44.entities.City.get(p.home_city_id).catch(() => null);
      }
      p = await applyHungerRegen(p, homeCity);

      // Mettre à jour last_active_at
      updateLastActive(p.id);
      // Vérification globale d'inactivité (throttle 6h)
      runInactivityCheck();

      setProfile(p);
      setHasProfile(true);
      if (p.city_id) {
        const cities = await base44.entities.City.list();
        const c = cities.find(ct => ct.id === p.city_id);
        setCity(c || null);
        const homeCityId = p.home_city_id || p.city_id;
        setHomeCity(cities.find(ct => ct.id === homeCityId) || null);
      }
    } else {
      setHasProfile(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">⚜️</div>
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="mt-3 font-heading text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!hasProfile) {
    // Après character creation, on déclenche le tuto via localStorage
    // (le GameLayout le lira et l'affichera au prochain render).
    return <CharacterCreation onComplete={() => {
      try { localStorage.setItem("show-tutorial-once", "1"); } catch(_) {}
      loadProfile();
    }} />;
  }

  // Migration Producteur → nouveau métier au choix
  if (profile?.profession === "Producteur") {
    return <ProfessionMigration profile={profile} onComplete={loadProfile} />;
  }

  // ── Render conditionnel mobile/desktop (10/05/2026) ─────────────────
  // - Mobile : redirige vers /city (full-screen map, immersion gameplay).
  //   Le Dashboard reste accessible via les drawers attachés aux bâtiments
  //   de la map (Comptoir = transactions, Tableau de quêtes = checklist).
  // - Desktop : affiche le Dashboard classique (productivité, vue d'ensemble).
  // ────────────────────────────────────────────────────────────────────
  if (isMobileScreen()) {
    return <Navigate to="/city" replace />;
  }

  return (
    <Dashboard
      profile={profile}
      city={city}
      homeCity={homeCity}
      onShowTutorial={() => {
        // Le tuto est désormais déclenché depuis le bouton "Aide" du header
        // (GameLayout). Si Dashboard appelle ce callback, on déclenche via
        // localStorage : GameLayout lit ce flag au prochain render.
        try { localStorage.setItem("show-tutorial-once", "1"); } catch (_) {}
        // Force un re-render léger en triggant un storage event
        window.dispatchEvent(new Event("storage"));
      }}
      onProfileUpdate={loadProfile}
    />
  );
}