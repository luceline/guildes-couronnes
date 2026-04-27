import { usePlayerData } from "../lib/usePlayerData";
import InventoryPanel from "../components/InventoryPanel";

export default function InventairePage() {
  const { profile, city, homeCity, loading, refresh } = usePlayerData();

  if (loading) return <p className="text-center text-muted-foreground font-body py-12">Chargement...</p>;
  if (!profile) return null;

  return (
    <div className="space-y-6 pb-20 md:pb-0 max-w-2xl mx-auto">
      <h2 className="font-heading text-2xl font-semibold heading-medieval">📦 Inventaire</h2>
      <InventoryPanel profile={profile} city={city} homeCity={homeCity} onRefresh={refresh} />
    </div>
  );
}
