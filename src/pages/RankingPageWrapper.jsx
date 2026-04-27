import { usePlayerData } from "../lib/usePlayerData";
import RankingPage from "./RankingPage";

export default function RankingPageWrapper() {
  const { profile, loading } = usePlayerData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return <RankingPage profile={profile} />;
}
