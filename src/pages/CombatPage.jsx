/**
 * src/pages/CombatPage.jsx
 *
 * Page "Arène" du jeu (chargée via target: "arene" dans VillageMenuView).
 *
 * Refonte 15/05/2026 :
 *   - Anciennement : wrapper simple qui montrait Combat.jsx (PvP zoné)
 *   - Maintenant : 3 onglets top-level
 *     - Combat  : fiche du joueur (sprite + équipement + HP)
 *     - Boss    : combat contre le Dragon de Nuit (BossArenaPage embed)
 *     - Tournoi : placeholder (à venir)
 *
 *   Le code PvP zoné (Combat.jsx) a été déplacé vers
 *   Combat.jsx.future-tournoi-15052026 pour réutilisation lors du tournoi.
 *
 * Deep link supporté : /combat?tab=boss ouvre direct l'onglet Boss.
 */

import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { usePlayerData } from "../lib/usePlayerData";
import AreneCombatTab from "@/components/arene/AreneCombatTab";
import BossArenaPage from "./BossArenaPage";
import AreneTournoiTab from "@/components/arene/AreneTournoiTab";

const VALID_TABS = ["combat", "boss", "tournoi"];

export default function CombatPage() {
  const { profile, loading } = usePlayerData();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const tab = VALID_TABS.includes(rawTab) ? rawTab : "combat";

  const handleTabChange = (value) => {
    setParams({ tab: value }, { replace: true });
  };

  if (loading) {
    return <p className="text-center text-muted-foreground font-body py-12">Chargement...</p>;
  }
  if (!profile) return null;

  return (
    <div style={{ padding: "0.75rem", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{
        fontSize: 22,
        textAlign: "center",
        marginBottom: 12,
        fontFamily: "serif",
      }}>
        ⚔️ L'Arène
      </h1>

      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="combat">⚔️ Combat</TabsTrigger>
          <TabsTrigger value="boss">🐉 Boss</TabsTrigger>
          <TabsTrigger value="tournoi">🏆 Tournoi</TabsTrigger>
        </TabsList>

        <TabsContent value="combat">
          <AreneCombatTab />
        </TabsContent>

        <TabsContent value="boss">
          <BossArenaPage embedded />
        </TabsContent>

        <TabsContent value="tournoi">
          <AreneTournoiTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
