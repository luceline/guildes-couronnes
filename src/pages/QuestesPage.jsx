import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import DailyQuestsWidget from "../components/DailyQuestsWidget";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function QuestesPage() {
  const [profile, setProfile] = useState(null);
  const [city, setCity] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const user = await base44.auth.me();
      if (!user?.email) { setLoading(false); return; }
      const profiles = await base44.entities.PlayerProfile.filter({ user_email: user.email });
      if (!profiles.length) { setLoading(false); return; }
      const p = profiles[0];
      setProfile(p);
      if (p.city_id) {
        const cities = await base44.entities.City.list();
        setCity(cities.find(c => c.id === p.city_id) || null);
      }
      // Contrats actifs (avec parchemin_type)
      const objs = await base44.entities.PlayerObjective.filter({ player_email: p.user_email });
      setContracts(objs.filter(o => o.parchemin_type && o.status === "active"));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="text-center text-muted-foreground font-body py-12">Chargement...</p>;
  if (!profile) return null;

  return (
    <div className="space-y-6 pb-20 md:pb-0 max-w-2xl mx-auto">
      <h2 className="font-heading text-2xl font-semibold">🎯 Quêtes</h2>

      <DailyQuestsWidget profile={profile} city={city} />

      {contracts.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              📜 Contrats actifs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contracts.map(obj => {
              const pct = Math.min(((obj.current_quantity || 0) / obj.target_quantity) * 100, 100);
              return (
                <div key={obj.id} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-semibold font-body text-sm">{obj.title}</div>
                      <div className="text-xs text-amber-700 font-body">{obj.description}</div>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-body text-xs">+{obj.reward_gold}💰</Badge>
                  </div>
                  <div className="flex justify-between text-xs font-body mb-1">
                    <span>Progression</span><span>{obj.current_quantity || 0}/{obj.target_quantity}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
