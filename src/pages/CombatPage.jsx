import { usePlayerData } from "../lib/usePlayerData";
import Combat from "./Combat";

export default function CombatPage() {
  const { profile, loading, refresh } = usePlayerData();

  if (loading) return <p className="text-center text-muted-foreground font-body py-12">Chargement...</p>;
  if (!profile) return null;

  return <Combat profile={profile} onRefresh={refresh} />;
}
