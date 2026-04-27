import { usePlayerData } from "../lib/usePlayerData";
import Profile from "./Profile";

export default function ProfilePage() {
  const { profile, city, homeCity, cities, loading, refresh } = usePlayerData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return <Profile profile={profile} city={city} homeCity={homeCity} cities={cities} onRefresh={refresh} />;
}
