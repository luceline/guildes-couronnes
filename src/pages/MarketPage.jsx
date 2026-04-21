import { useState, useEffect, useCallback } from "react";
import { applyHungerRegen } from "../lib/hungerRegen";
import { base44 } from "@/api/base44Client";
import Market from "./Market";
import { toast } from "sonner";

export default function MarketPage() {
  const [profile, setProfile] = useState(null);
  const [city, setCity] = useState(null);
  const [homeCity, setHomeCity] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const user = await base44.auth.me();
    const profiles = await base44.entities.PlayerProfile.filter({ user_email: user.email });
    if (profiles.length > 0) {
      let p = profiles[0];
      p = await applyHungerRegen(p);

    // ── Arrivée automatique si le voyage est terminé ──
    if (p.is_traveling && p.travel_arrival_time && new Date(p.travel_arrival_time) <= new Date()) {
      // Arrivée biome : juste mettre is_traveling=false, garder travel_destination_id pour savoir où on est
      if (p.travel_destination_id && p.travel_destination_id.startsWith("biome:")) {
        await base44.entities.PlayerProfile.update(p.id, {
          is_traveling: false,
          travel_arrival_time: "",
        });
        p = { ...p, is_traveling: false, travel_arrival_time: "" };
      } else {
      const allCities = await base44.entities.City.list();
      const destId = p.travel_destination_id;
      const arrivalCity = allCities.find(c => c.id === destId);
      const visited = [...new Set([...(p.visited_cities || []), destId])];
      const profileUpdates = {
        city_id: destId,
        is_traveling: false,
        travel_destination_id: "",
        travel_arrival_time: "",
        visited_cities: visited,
      };
      if (arrivalCity) {
        const wallCount = (arrivalCity.buildings || []).filter(b => b.building_type === "remparts").length;
        const isResident = p.home_city_id === destId || p.city_id === destId;
        const toll = (!isResident && wallCount > 0) ? wallCount : 0;
        if (toll > 0) {
          const actualToll = Math.min(toll, p.gold || 0);
          profileUpdates.gold = (p.gold || 0) - actualToll;
          await base44.entities.City.update(arrivalCity.id, {
            gold_treasury: (arrivalCity.gold_treasury || 0) + actualToll,
            treasury_cumulative: (arrivalCity.treasury_cumulative || 0) + actualToll,
          });
        }
      }
      await base44.entities.PlayerProfile.update(p.id, profileUpdates);
      p = { ...p, ...profileUpdates };
      } // fin else biome

      // ── Valider les quêtes "travel" ──
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const allTravelMkt = await base44.entities.PlayerObjective.filter({
          player_email: p.user_email,
          status: "active",
          type: "travel",
        });
        const travelObjs = allTravelMkt.filter(o => (o.created_date || o.quest_date || "").startsWith(todayStr)).slice(-6);
        for (const obj of travelObjs) {
          const newQty = (obj.current_quantity || 0) + 1;
          const completed = newQty >= (obj.target_quantity || 1);
          await base44.entities.PlayerObjective.update(obj.id, {
            current_quantity: newQty,
            status: completed ? "completed" : "active",
          });
          const mpReward = obj.reward_gold || 5;
          if (completed && mpReward > 0) {
            const freshP = await base44.entities.PlayerProfile.get(p.id).catch(() => null);
            const currentGold = freshP ? (freshP.gold || 0) : (p.gold || 0);
            await base44.entities.PlayerProfile.update(p.id, { gold: currentGold + mpReward });
            await base44.entities.GoldTransaction.create({
              player_email: p.user_email, player_name: p.character_name || "",
              city_id: p.city_id || "",
              city_name: "",
              amount: mpReward, type: "objectif",
              description: `Quête accomplie : ${obj.title}`,
            }).catch(() => {});
            toast?.success(`🎉 Quête accomplie : "${obj.title}" ! +${mpReward} 💰 !`);
          }
        }
      } catch(e) { console.warn("travelObjective:", e); }
    }
      setProfile(p);
      if (p.city_id) {
        const cities = await base44.entities.City.list();
        setCity(cities.find(c => c.id === p.city_id) || null);
        const homeCityId = p.home_city_id || p.city_id;
        setHomeCity(cities.find(c => c.id === homeCityId) || null);
      }
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

  // Bloquer si joueur en biome
  if (profile && !profile.is_traveling && profile.travel_destination_id?.startsWith("biome:")) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <span className="text-5xl">🌿</span>
        <h2 className="font-heading text-xl font-semibold">Vous êtes dans un biome</h2>
        <p className="text-muted-foreground font-body text-sm max-w-xs">
          Le marché n'est pas accessible depuis un biome. Retournez en ville d'abord.
        </p>
      </div>
    );
  }

  return <Market profile={profile} city={city} homeCity={homeCity} onRefresh={loadData} />;
}
