// src/pages/EntrepotPage.jsx
//
// Page Entrepot : 2 sous-onglets
//   - Approvisionnement : depots et offres de rachat (WarehouseUnified)
//   - Urgence           : achat d'urgence d'items rares (MairieShop)
//
// Concue pour etre affichee dans un drawer (clic sur l'entrepot dans VillageView).
// Reproduit la logique de fetch des objectives qui etait dans CityView.

import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { usePlayerData } from "../lib/usePlayerData";
import { logGold } from "@/lib/goldLog";
import WarehouseUnified from "@/components/WarehouseUnified";
import MairieShop from "@/components/MairieShop";

export default function EntrepotPage() {
  const { profile, city, loading, refresh } = usePlayerData();

  const [subTab, setSubTab] = useState("appro");
  const [contributing, setContributing] = useState(false);
  const [depositObjectives, setDepositObjectives] = useState([]);
  const [depositT1Objectives, setDepositT1Objectives] = useState([]);

  // Reproduit la logique de CityView : charger les quetes de depot actives
  useEffect(() => {
    if (!profile?.user_email) return;
    const todayStr = new Date().toISOString().split("T")[0];
    base44.entities.PlayerObjective.filter({
      player_email: profile.user_email,
      status: "active",
    }).then(objs => {
      const isToday = (o) => (o.created_date || o.quest_date || "").startsWith(todayStr);
      setDepositObjectives((objs || []).filter(o => o.type === "deposit" && isToday(o)));
      setDepositT1Objectives((objs || []).filter(o => o.type === "deposit_t1" && isToday(o)));
    }).catch(() => {});
  }, [profile?.user_email]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile || !city) return null;

  const isHomeCity = profile.home_city_id === city.id;

  return (
    <div className="space-y-3 pb-20 md:pb-0 max-w-5xl mx-auto">
      {/* 11/05/2026 : h2 "🏪 Entrepôt" retiré (déjà dans drawer header).
          Card wrapper "📦 Approvisionnement" retiré (redondant avec le sous-onglet). */}

      {/* Sous-onglets : Approvisionnement / Urgence */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "appro",   label: "📦 Approvisionnement" },
          { key: "urgence", label: "🏛️ Urgence" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-heading transition-colors border ${
              subTab === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === "appro" && (
        <WarehouseUnified
          city={city}
          profile={profile}
          isHomeCity={isHomeCity}
          contributing={contributing}
          setContributing={setContributing}
          depositObjectives={depositObjectives}
          depositT1Objectives={depositT1Objectives}
          logGold={logGold}
          onRefresh={refresh}
        />
      )}

      {subTab === "urgence" && (
        <MairieShop profile={profile} city={city} onRefresh={refresh} />
      )}
    </div>
  );
}
