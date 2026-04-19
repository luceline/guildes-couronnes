import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import WorldMap from "./WorldMap";

export default function WorldPage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const user = await base44.auth.me();
    const profiles = await base44.entities.PlayerProfile.filter({ user_email: user.email });
    if (profiles.length > 0) {
      setProfile(profiles[0]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return <WorldMap profile={profile} />;
}