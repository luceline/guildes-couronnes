import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FOOD_VALUES, ENERGY_VALUES, UNIT_TYPES } from "../lib/militaryData";

// Ressources nourriture affichées dans l'ordre
const FOOD_RESOURCES = [
  { key: "ble",     label: "Blé",     icon: "🌾", value: FOOD_VALUES.ble },
  { key: "farine",  label: "Farine",  icon: "🧺", value: FOOD_VALUES.farine },
  { key: "pain",    label: "Pain",    icon: "🍞", value: FOOD_VALUES.pain },
  { key: "ragout",  label: "Ragoût",  icon: "🍲", value: FOOD_VALUES.ragout },
];

const ENERGY_RESOURCES = [
  { key: "herbes",       label: "Herbes",          icon: "🌿", value: ENERGY_VALUES.herbes },
  { key: "extrait",      label: "Extrait",          icon: "🫗", value: ENERGY_VALUES.extrait },
  { key: "potion_soin",  label: "Potion de soin",   icon: "🧪", value: ENERGY_VALUES.potion_soin },
  { key: "potion_endur", label: "Potion d'endurance",icon: "💪", value: ENERGY_VALUES.potion_endur },
];

export default function ArmySupplyPanel({ city, isMayor, onRefresh }) {
  const [loading, setLoading] = useState(null);

  const warehouse = city?.warehouse || {};
  const armyFood   = city?.army_food   || 0;
  const armyEnergy = city?.army_energy || 0;

  // Calculer la conso quotidienne de l'armée (depuis CityArmy : passé en props ou estimé)
  // Affiché comme info au maire

  const handleDeposit = async (resourceKey, type) => {
    // Trouve le label affichable depuis les listes locales
    const allResources = [...FOOD_RESOURCES, ...ENERGY_RESOURCES];
    const resourceLabel = allResources.find(r => r.key === resourceKey)?.label || resourceKey;

    const available = warehouse[resourceKey] || 0;
    if (available <= 0) {
      toast.error(`Pas de ${resourceLabel} en entrepôt.`);
      return;
    }
    setLoading(resourceKey);
    try {
      const freshCity = await base44.entities.City.get(city.id);
      const freshWarehouse = freshCity.warehouse || {};
      const qty = freshWarehouse[resourceKey] || 0;
      if (qty <= 0) { toast.error("Plus de ressource disponible."); return; }

      const isFood = type === "food";
      const values = isFood ? FOOD_VALUES : ENERGY_VALUES;
      const points = (values[resourceKey] || 0) * qty;
      const jauge = isFood ? "army_food" : "army_energy";
      const current = freshCity[jauge] || 0;

      const newWarehouse = { ...freshWarehouse, [resourceKey]: 0 };
      await base44.entities.City.update(city.id, {
        warehouse: newWarehouse,
        [jauge]: current + points,
      });

      const label = isFood ? "nourriture" : "énergie";
      toast.success(`🏰 +${points} ${label} pour l'armée (${qty} ${resourceLabel} déposés)`);
      onRefresh?.();
    } catch {
      toast.error("Erreur lors du dépôt.");
    } finally {
      setLoading(null);
    }
  };

  if (!isMayor) return null;

  const ResourceRow = ({ res, type }) => {
    const qty = warehouse[res.key] || 0;
    const points = res.value * qty;
    return (
      <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">{res.icon}</span>
          <div>
            <p className="text-sm font-heading font-medium">{res.label}</p>
            <p className="text-xs text-muted-foreground font-body">1 unité = {res.value} pts · entrepôt : {qty}</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="font-heading text-xs"
          disabled={qty <= 0 || loading === res.key}
          onClick={() => handleDeposit(res.key, type)}
        >
          {loading === res.key ? "…" : `+${points > 0 ? points : 0} pts`}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Jauges actuelles */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-xs text-amber-700 font-body mb-1">🍞 Nourriture</p>
          <p className="text-2xl font-bold font-heading text-amber-800">{armyFood}</p>
          <p className="text-xs text-amber-600 font-body">points</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-xs text-blue-700 font-body mb-1">⚡ Énergie</p>
          <p className="text-2xl font-bold font-heading text-blue-800">{armyEnergy}</p>
          <p className="text-xs text-blue-600 font-body">points</p>
        </div>
      </div>

      {/* Consommation quotidienne estimée */}
      <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs font-body text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Consommation quotidienne par unité :</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          {Object.entries(UNIT_TYPES).map(([key, u]) => (
            <span key={key}>
              {u.icon} {u.name} : {u.food_cost > 0 ? `🍞${u.food_cost}` : ""}{u.energy_cost > 0 ? ` ⚡${u.energy_cost}` : ""}
            </span>
          ))}
        </div>
      </div>

      {/* Dépôt nourriture */}
      <div>
        <p className="text-sm font-heading font-semibold mb-2">🍞 Approvisionner nourriture</p>
        <div className="bg-card border border-border rounded-xl px-3">
          {FOOD_RESOURCES.map(res => (
            <ResourceRow key={res.key} res={res} type="food" />
          ))}
        </div>
      </div>

      {/* Dépôt énergie */}
      <div>
        <p className="text-sm font-heading font-semibold mb-2">⚡ Approvisionner énergie</p>
        <div className="bg-card border border-border rounded-xl px-3">
          {ENERGY_RESOURCES.map(res => (
            <ResourceRow key={res.key} res={res} type="energy" />
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-body text-center">
        Le ménestrel murmure : « Sans ravitaillement, les soldats désertent au petit matin. Gardez vos jauges pleines. »
      </p>
    </div>
  );
}
