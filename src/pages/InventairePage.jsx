/**
 * InventairePage.jsx
 *
 * Drawer "Mon logement" : accessible via le sprite maison de la map ou
 * la card "Mon logement" de la vue menu.
 *
 * 11/05/2026 : ajout d'un système de 2 onglets (Inventaire / Profil).
 * Le Profil a été déplacé depuis la Bibliothèque vers ici car c'est plus
 * naturel : ton logement = ton espace personnel (objets + identité).
 */

import { useState } from "react";
import { usePlayerData } from "../lib/usePlayerData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InventoryPanel from "../components/InventoryPanel";
import Profile from "./Profile";

export default function InventairePage() {
  const { profile, city, homeCity, cities, loading, refresh } = usePlayerData();
  const [tab, setTab] = useState("inventaire");

  if (loading) return <p className="text-center text-muted-foreground font-body py-12">Chargement...</p>;
  if (!profile) return null;

  return (
    <div className="space-y-4 pb-20 md:pb-0 max-w-2xl mx-auto">
      <h2 className="font-heading text-2xl font-semibold heading-medieval">🏠 Mon logement</h2>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="font-heading">
          <TabsTrigger value="inventaire">📦 Inventaire</TabsTrigger>
          <TabsTrigger value="profil">👤 Profil</TabsTrigger>
        </TabsList>

        <TabsContent value="inventaire" className="mt-4">
          <InventoryPanel
            profile={profile}
            city={city}
            homeCity={homeCity}
            onRefresh={refresh}
          />
        </TabsContent>

        <TabsContent value="profil" className="mt-4">
          <Profile
            profile={profile}
            city={city}
            homeCity={homeCity}
            cities={cities}
            onRefresh={refresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
