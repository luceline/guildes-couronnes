import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import InventoryPanel from "../components/InventoryPanel";

export default function InventairePage() {
  const [profile, setProfile] = useState(null);
  const [city, setCity]       = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const user = await base44.auth.me();
    if (!user?.email) { setLoading(false); return; }
    const profiles = await base44.entities.PlayerProfile.filter({ user_email: user.email });
    if (!profiles.length) { setLoading(false); return; }
    const p = profiles[0];
    setProfile(p);
    if (p.city_id) {
      const c = await base44.entities.City.get(p.city_id).catch(() => null);
      setCity(c);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-center text-muted-foreground font-body py-12">Chargement...</p>;
  if (!profile) return null;

  return (
    <div className="space-y-6 pb-20 md:pb-0 max-w-2xl mx-auto">
      <h2 className="font-heading text-2xl font-semibold">📦 Inventaire</h2>
      <InventoryPanel profile={profile} city={city} onRefresh={load} />
    </div>
  );
}