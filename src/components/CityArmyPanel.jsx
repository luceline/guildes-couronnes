import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { logGold } from "@/lib/goldLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  UNIT_TYPES, UNIT_ORDER_BY_STRENGTH,
  getRecruitCost, canAffordRecruitment, unitAvailableForCity,
  totalUnits, armyPower, computeDefenseScore,
} from "../lib/militaryData";
import { getCityTier } from "../lib/gameData";

export default function CityArmyPanel({ city, profile, isMayor, onRefresh }) {
  const [army, setArmy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recruiting, setRecruiting] = useState(null);
  const [qty, setQty] = useState({});

  useEffect(() => {
    async function load() {
      const armies = await base44.entities.CityArmy.filter({ city_id: city.id });
      setArmy(armies[0] || null);
      setLoading(false);
    }
    load();
  }, [city.id]);

  const isHomeCity = profile.home_city_id === city.id;
  const lingotsCumul = city.lingots_cumul || 0;
  const units = army?.units || {};
  const defScore = computeDefenseScore(units, city);
  const totalArmy = totalUnits(units);
  const power = armyPower(units);

  const handleRecruit = async (unitType) => {
    const quantity = qty[unitType] || 1;
    if (quantity < 1) return;

    const { resources, gold: goldNeeded } = getRecruitCost(unitType, quantity);

    if (!canAffordRecruitment(profile.inventory || [], profile.gold || 0, unitType, quantity)) {
      if ((profile.gold || 0) < goldNeeded) {
        toast.error(`Pas assez d'or ! Il vous faut ${goldNeeded}💰 (vous avez ${profile.gold || 0}💰).`);
      } else {
        toast.error("Ressources insuffisantes !");
      }
      return;
    }

    setRecruiting(unitType);
    try {
      // Déduire les ressources du joueur
      const newInventory = [...(profile.inventory || [])];
      for (const [res, resQty] of Object.entries(resources)) {
        const idx = newInventory.findIndex(i => i.item_key === res);
        if (idx >= 0) newInventory[idx] = { ...newInventory[idx], quantity: newInventory[idx].quantity - resQty };
      }
      const filteredInventory = newInventory.filter(i => (i.quantity || 0) > 0);
      // Déduire l'or du joueur (détruit)
      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: filteredInventory,
        gold: (profile.gold || 0) - goldNeeded,
      });

      // V6.1.7 — Trace dans le journal d'or (or détruit, side: none)
      if (goldNeeded > 0) {
        await logGold(
          profile.user_email, profile.character_name,
          city.id, city.name,
          -goldNeeded, "recrutement",
          `Recrutement de ${quantity} ${UNIT_TYPES[unitType]?.name || unitType}`
        );
      }

      // Ajouter les unités à l'armée de la ville
      const currentUnits = army?.units || {};
      const newUnits = {
        ...currentUnits,
        [unitType]: (currentUnits[unitType] || 0) + quantity,
      };

      if (army) {
        await base44.entities.CityArmy.update(army.id, {
          units: newUnits,
          last_updated: new Date().toISOString(),
        });
      } else {
        const newArmy = await base44.entities.CityArmy.create({
          city_id: city.id,
          units: newUnits,
          last_updated: new Date().toISOString(),
        });
        setArmy(newArmy);
      }

      toast.success(`✅ ${quantity} ${UNIT_TYPES[unitType].icon} ${UNIT_TYPES[unitType].name} recrutés ! (−${goldNeeded}💰)`);
      const armies = await base44.entities.CityArmy.filter({ city_id: city.id });
      setArmy(armies[0] || null);
      onRefresh?.();
    } catch (e) {
      toast.error("Erreur lors du recrutement.");
      console.error(e);
    } finally {
      setRecruiting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Garnison actuelle ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base flex items-center justify-between">
            <span>🏰 Garnison de {city.name}</span>
            <div className="flex gap-2">
              <Badge variant="outline" className="font-body text-xs">⚔️ {totalArmy} unités</Badge>
              <Badge variant="secondary" className="font-body text-xs">🛡️ DEF {defScore}</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalArmy === 0 ? (
            <p className="text-sm text-muted-foreground font-body text-center py-4">
              Aucune unité en garnison. Recrutez des soldats pour défendre votre ville.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {UNIT_ORDER_BY_STRENGTH.map(type => {
                const count = units[type] || 0;
                if (count === 0) return null;
                const u = UNIT_TYPES[type];
                return (
                  <div key={type} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2 text-sm font-body">
                    <span className="text-2xl">{u.icon}</span>
                    <div>
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-muted-foreground text-xs">×{count} · ATK {u.atk * count} / DEF {u.def * count}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {totalArmy > 0 && (
            <div className="mt-3 pt-3 border-t border-border text-xs font-body text-muted-foreground flex gap-4">
              <span>⚡ Puissance totale : <strong>{power}</strong></span>
              <span>🛡️ Score défensif : <strong>{defScore}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recrutement ── */}
      {isHomeCity && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base">⚒️ Recrutement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground font-body">
              Recrutez des unités en dépensant vos ressources. Elles rejoignent la garnison commune de la ville.
            </p>
            {Object.entries(UNIT_TYPES).map(([type, u]) => {
              const available = unitAvailableForCity(type, lingotsCumul);
              const costEntries = Object.entries(u.cost);
              const currentQty = qty[type] || 1;
              const { resources: costRes, gold: goldCost } = getRecruitCost(type, currentQty);
              const canAfford = canAffordRecruitment(profile.inventory || [], profile.gold || 0, type, currentQty);
              const tier = getCityTier(lingotsCumul);

              return (
                <div
                  key={type}
                  className={`rounded-lg border p-3 space-y-2 ${available ? "border-border" : "border-border/30 opacity-50"}`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{u.icon}</span>
                      <div>
                        <div className="font-heading font-semibold text-sm">{u.name}</div>
                        <div className="text-xs text-muted-foreground font-body">{u.description}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="outline">⚔️ ATK {u.atk}</Badge>
                      <Badge variant="outline">🛡️ DEF {u.def}</Badge>
                      {u.special === "anti_cavalier" && <Badge variant="secondary">×1.5 🐴</Badge>}
                      {u.special === "siege" && <Badge variant="secondary">-30% DEF</Badge>}
                    </div>
                  </div>

                  {!available ? (
                    <p className="text-xs text-muted-foreground font-body">
                      🔒 Nécessite palier {["", "Hameau", "Village", "Bourg", "Cité", "Capitale", "Empire"][u.palierRequired]} : ville actuelle : {tier.label}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-xs font-body text-muted-foreground">
                        Coût :{" "}
                        {costEntries.map(([res, resQty], i) => (
                          <span key={res}>
                            {i > 0 && " + "}{resQty * currentQty} {res.replace(/_/g, " ")}
                          </span>
                        ))}
                        {" + "}
                        <span className={`font-semibold ${(profile.gold || 0) < goldCost ? "text-red-500" : "text-amber-600"}`}>
                          {goldCost}💰 (détruit)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <Button
                          variant="outline" size="sm"
                          className="h-7 w-7 p-0 font-heading"
                          onClick={() => setQty(q => ({ ...q, [type]: Math.max(1, (q[type] || 1) - 1) }))}
                        >−</Button>
                        <span className="w-8 text-center text-sm font-heading font-semibold">{currentQty}</span>
                        <Button
                          variant="outline" size="sm"
                          className="h-7 w-7 p-0 font-heading"
                          onClick={() => setQty(q => ({ ...q, [type]: (q[type] || 1) + 1 }))}
                        >+</Button>
                        <Button
                          size="sm"
                          className="font-heading ml-1"
                          disabled={!canAfford || recruiting === type}
                          onClick={() => handleRecruit(type)}
                        >
                          {recruiting === type ? "..." : `Recruter`}
                        </Button>
                      </div>
                    </div>
                  )}

                  {available && (
                    <div className="text-xs text-muted-foreground font-body">
                      🔧 Entretien mairie : {u.entretien * currentQty}💰/jour (trésorerie de la ville)
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {!isHomeCity && (
        <div className="bg-muted/30 border border-border rounded-lg p-4 text-center text-sm font-body text-muted-foreground">
          🏠 Seuls les résidents de {city.name} peuvent recruter des unités.
        </div>
      )}
    </div>
  );
}
