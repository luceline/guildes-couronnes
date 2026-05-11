// src/pages/ChaudronPage.jsx
//
// Wrapper page autour de CauldronPanel.
// Affiche le chaudron magique en standalone (utilise par le drawer de la
// vue village et eventuellement par une route directe /chaudron).

import { usePlayerData } from "../lib/usePlayerData";
import CauldronPanel from "@/components/CauldronPanel";

export default function ChaudronPage() {
  const { profile, city, loading, refresh } = usePlayerData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-4 pb-20 md:pb-0 max-w-4xl mx-auto">
      <h2 className="font-heading text-2xl font-semibold heading-medieval">
        🔮 Chaudron magique
      </h2>
      <CauldronPanel profile={profile} city={city} onRefresh={refresh} />
    </div>
  );
}
