import { applyHungerRegen } from "../lib/hungerRegen";
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import CharacterCreation from "./CharacterCreation";
import Dashboard from "./Dashboard";
import Tutorial from "../components/Tutorial";
import PatchnoteModal from "../components/PatchnoteModal";
import { MAX_HUNGER, getFatigueRegenInterval } from "../lib/gameData";
import { getMaxFatigue } from "../lib/gameData";
import { updateLastActive, runInactivityCheck } from "../lib/inactivityCheck";
import { toast } from "sonner";

// ── Migration Producteur → nouveau métier ──
const PROFESSIONS_LIST = ["Bûcheron","Mineur","Fermier","Tisserand","Forgeron","Alchimiste","Orfèvre","Marchand"];

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
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="text-5xl mb-2">⚒️</div>
        <h2 className="text-2xl font-bold font-heading">Réorientation professionnelle</h2>
        <p className="text-muted-foreground font-body">
          Le métier de <strong>Producteur</strong> a été fusionné dans d'autres professions.
          Choisissez votre nouveau métier — vos items existants sont conservés.
        </p>
        <select value={choice} onChange={e => setChoice(e.target.value)}
          className="w-full border border-border rounded-lg px-4 py-3 font-body bg-background text-base">
          <option value="">— Choisir un métier —</option>
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
  const [showTutorial, setShowTutorial] = useState(false);

  const loadProfile = useCallback(async () => {
    const user = await base44.auth.me();
    if (!user?.email) { setLoading(false); return; }

    const profiles = await base44.entities.PlayerProfile.filter({ user_email: user.email });
    if (profiles.length > 0) {
      let p = profiles[0];
      
      // Regen faim + énergie (centralisé)
      p = await applyHungerRegen(p);

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
    return <CharacterCreation onComplete={() => { loadProfile(); setShowTutorial(true); }} />;
  }

  // Migration Producteur → nouveau métier au choix
  if (profile?.profession === "Producteur") {
    return <ProfessionMigration profile={profile} onComplete={loadProfile} />;
  }

  return (
    <>
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
      <PatchnoteModal />
      <Dashboard profile={profile} city={city} homeCity={homeCity} onShowTutorial={() => setShowTutorial(true)} />
    </>
  );
}