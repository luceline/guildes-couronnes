import { PROFESSION_CHANGE_COST } from "../lib/gameData";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { logGold } from '@/lib/goldLog';

const PROFESSIONS = ["Marchand","Producteur","Forgeron","Tisserand","Alchimiste","Bûcheron","Mineur","Fermier","Orfèvre"];



export default function ProfessionChangePanel({ profile, city, onRefresh }) {
  const [changing, setChanging] = useState(false);
  const [chosen, setChosen] = useState("");

  const handleChange = async () => {
    if (!chosen || chosen === profile.profession) {
      toast.error("Choisissez un métier différent du vôtre.");
      return;
    }
    if ((profile.gold || 0) < PROFESSION_CHANGE_COST) {
      toast.error(`Il faut ${PROFESSION_CHANGE_COST} 💰 pour changer de métier.`);
      return;
    }
    setChanging(true);
    await base44.entities.PlayerProfile.update(profile.id, {
      profession: chosen,
      gold: (profile.gold || 0) - PROFESSION_CHANGE_COST,
    });
    const fresh = await base44.entities.City.get(city.id).catch(() => city);
    await base44.entities.City.update(city.id, {
      gold_treasury: (fresh.gold_treasury || 0) + PROFESSION_CHANGE_COST,
      treasury_cumulative: (fresh.treasury_cumulative || 0) + PROFESSION_CHANGE_COST,
    });
    try {
      await base44.entities.GoldTransaction.create({
        player_email: profile.user_email, player_name: profile.character_name || "",
        city_id: city.id, city_name: city.name || "",
        amount: -PROFESSION_CHANGE_COST, type: "changement_metier",
        description: `Changement de métier : ${profile.profession} → ${chosen}`,
      });
    } catch(e) {}
    toast.success(`✅ Métier changé ! Vous êtes maintenant ${chosen}.`);
    setChanging(false);
    setChosen("");
    onRefresh?.();
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-body text-muted-foreground">
        🏛️ <strong>Changer de métier</strong> — {PROFESSION_CHANGE_COST} 💰 versés à la mairie
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <select value={chosen} onChange={e => setChosen(e.target.value)}
          className="flex-1 border border-border rounded-md px-2 py-1 text-xs font-body bg-background">
          <option value="">— Choisir un nouveau métier —</option>
          {PROFESSIONS.filter(p => p !== profile.profession).map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <Button size="sm" className="h-7 text-xs font-heading shrink-0"
          disabled={!chosen || changing || (profile.gold || 0) < PROFESSION_CHANGE_COST}
          onClick={handleChange}>
          {changing ? "..." : `Changer — ${PROFESSION_CHANGE_COST} 💰`}
        </Button>
      </div>
      <p className="text-xs text-orange-600 font-body">
        ⚠️ Votre progression et vos recettes actuelles seront liées au nouveau métier.
      </p>
    </div>
  );
}