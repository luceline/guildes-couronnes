import { usePlayerData } from "../lib/usePlayerData";
import WorldMap from "./WorldMap";

export default function WorldPage() {
  const { profile, loading } = usePlayerData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return <WorldMap profile={profile} />;
}
