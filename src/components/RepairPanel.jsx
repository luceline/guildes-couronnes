/**
 * RepairPanel : Panneau de réparation des armes/armures équipées.
 *
 * REFONTE V6 — QUOTA DE RÉPARATION JOURNALIER
 *   - Le joueur dispose de DAILY_REPAIR_POINTS_BASE points par jour (défaut 5).
 *   - Chaque +1 dura consomme 1 point + 1 ressource (pierre pour arme, laine pour armure).
 *   - Compteur stocké dans profile.repair_points_used_today, reset par DailyResetManager.
 *   - Le bouton "Max" est automatiquement plafonné par le quota restant.
 *   - Le quota restant est affiché en permanence dans l'en-tête.
 *
 * Conservé depuis V4 :
 *   - 1 pierre = +1 dura arme, 1 laine_brute = +1 dura armure.
 *   - Réparation depuis l'inventaire personnel, pas de coût en or, pas de cooldown.
 *   - Boutons "+1" et "Max".
 *
 * Affiché en haut de l'InventoryPanel quand le joueur a au moins un item combat équipé.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import {
  EQUIPMENT_MAX_DURABILITY,
  REPAIR_RESOURCES,
  getDailyRepairPoints,
  getRepairPointsUsedToday,
  canAffordRepair,
  buildRepairQuotaUpdate,
} from "../lib/gameData";
import { ITEMS } from "../lib/craftingData";

const COMBAT_SLOTS = [
  { slot: "weapon",   type: "weapon", label: "Arme",      zoneLabel: null },
  { slot: "head_def", type: "armor",  label: "Heaume",    zoneLabel: "tête" },
  { slot: "torso_def",type: "armor",  label: "Cuirasse",  zoneLabel: "torse" },
  { slot: "arms_def", type: "armor",  label: "Brassard",  zoneLabel: "bras" },
  { slot: "legs_def", type: "armor",  label: "Jambière",  zoneLabel: "jambes" },
];

export default function RepairPanel({ profile, onRefresh }) {
  const [busy, setBusy] = useState(false);
  if (!profile) return null;

  const equipment = profile.equipment || {};
  const inventory = profile.inventory || [];

  // Stock des matériaux de réparation
  const stoneStock = inventory.find(i => i.item_key === REPAIR_RESOURCES.weapon)?.quantity || 0;
  const woolStock  = inventory.find(i => i.item_key === REPAIR_RESOURCES.armor)?.quantity || 0;

  // V6 — Quota journalier (pattern date-based, rollover automatique)
  const repairPointsMax  = getDailyRepairPoints(profile);
  const repairPointsUsed = getRepairPointsUsedToday(profile);
  const repairPointsLeft = Math.max(0, repairPointsMax - repairPointsUsed);

  // Filtrer les slots qui ont un item équipé
  const slotsWithItems = COMBAT_SLOTS.filter(s => !!equipment[s.slot]);
  if (slotsWithItems.length === 0) return null; // pas d'équipement → on n'affiche pas le panel

  // Y a-t-il au moins un item à réparer ?
  const hasAnyToRepair = slotsWithItems.some(s => {
    const eq = equipment[s.slot];
    const dura = eq?.durability ?? EQUIPMENT_MAX_DURABILITY;
    return dura < EQUIPMENT_MAX_DURABILITY;
  });

  // ─────────────────────────────────────────────
  // Réparation : consomme N matériaux + N points de quota, +N dura
  // ─────────────────────────────────────────────
  const handleRepair = async (slot, type, units) => {
    const eq = equipment[slot];
    if (!eq) return;
    const currentDura = eq.durability ?? EQUIPMENT_MAX_DURABILITY;
    const missing = EQUIPMENT_MAX_DURABILITY - currentDura;
    if (missing <= 0) {
      toast.error("Cet item est déjà à durabilité maximale.");
      return;
    }
    const resKey = type === "weapon" ? REPAIR_RESOURCES.weapon : REPAIR_RESOURCES.armor;
    const stock  = inventory.find(i => i.item_key === resKey)?.quantity || 0;
    // V6 : on plafonne aussi par le quota restant
    const toUse  = Math.min(units, missing, stock, repairPointsLeft);
    if (toUse <= 0) {
      const def = ITEMS[resKey];
      // Distinguer la cause exacte du blocage pour un message précis
      if (repairPointsLeft <= 0) {
        toast.error(`Quota de réparation atteint (${repairPointsUsed}/${repairPointsMax}). Revenez demain.`);
      } else if (stock <= 0) {
        toast.error(`Stock insuffisant : besoin de ${def?.icon || ""} ${def?.name || resKey}.`);
      } else {
        toast.error("Réparation impossible.");
      }
      return;
    }

    // V6 — Vérification quota explicite (sécurité supplémentaire)
    const quotaCheck = canAffordRepair(profile, toUse);
    if (!quotaCheck.ok) {
      toast.error(quotaCheck.reason);
      return;
    }

    setBusy(true);
    try {
      // Décrémenter l'inventaire
      let newInv = inventory.map(i => ({ ...i }));
      const idx = newInv.findIndex(i => i.item_key === resKey);
      if (idx >= 0) {
        newInv[idx].quantity = (newInv[idx].quantity || 0) - toUse;
      }
      newInv = newInv.filter(i => (i.quantity || 0) > 0);
      // Mise à jour equipment
      const newEquipment = {
        ...equipment,
        [slot]: { ...eq, durability: currentDura + toUse },
      };
      // V6 — Incrément du compteur de quota (avec gestion de la date)
      const quotaUpdate = buildRepairQuotaUpdate(profile, toUse);

      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: newInv,
        equipment: newEquipment,
        ...quotaUpdate,
      });
      const itemDef = ITEMS[eq.item_key];
      const resDef  = ITEMS[resKey];
      toast.success(
        `${itemDef?.icon || "⚔️"} ${itemDef?.name || eq.item_key} réparé +${toUse} ` +
        `(−${toUse} ${resDef?.icon || ""} · ${repairPointsMax - quotaUpdate.repair_points_used_today}/${repairPointsMax} points restants).`
      );
      onRefresh?.();
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la réparation.");
    } finally {
      setBusy(false);
    }
  };

  // Couleur du badge quota selon l'état
  const quotaColor =
    repairPointsLeft === 0 ? "text-red-700 font-semibold"
    : repairPointsLeft <= 1 ? "text-orange-700 font-semibold"
    : "text-emerald-700";

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-sm flex items-center gap-2">
          🛠️ Réparation équipement
        </CardTitle>
        <div className="flex items-center gap-3 text-xs font-body text-slate-700 mt-1 flex-wrap">
          <span>Stock : 🧱 {stoneStock} pierre{stoneStock > 1 ? "s" : ""}</span>
          <span>•</span>
          <span>🧶 {woolStock} laine{woolStock > 1 ? "s" : ""}</span>
          <span>•</span>
          <span className={quotaColor}>
            🔧 {repairPointsLeft}/{repairPointsMax} point{repairPointsMax > 1 ? "s" : ""} de réparation
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-1 space-y-2">
        {!hasAnyToRepair && (
          <p className="text-xs text-emerald-700 font-body">
            ✨ Tous vos équipements sont à durabilité maximale.
          </p>
        )}
        {repairPointsLeft === 0 && hasAnyToRepair && (
          <p className="text-xs font-body text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5">
            ⚠️ Quota de réparation épuisé pour aujourd'hui ({repairPointsUsed}/{repairPointsMax}).
            Vos points seront restaurés au prochain reset journalier.
          </p>
        )}
        {slotsWithItems.map(({ slot, type, label }) => {
          const eq = equipment[slot];
          const itemDef = ITEMS[eq.item_key];
          const dura = eq.durability ?? EQUIPMENT_MAX_DURABILITY;
          const missing = EQUIPMENT_MAX_DURABILITY - dura;
          const stock = type === "weapon" ? stoneStock : woolStock;
          const resKey = type === "weapon" ? REPAIR_RESOURCES.weapon : REPAIR_RESOURCES.armor;
          const resDef = ITEMS[resKey];
          const isDisabled = dura <= 0;
          const atMax = dura >= EQUIPMENT_MAX_DURABILITY;
          // V6 : conditions enrichies — il faut stock ET quota restant
          const canRepair1   = !atMax && stock >= 1 && repairPointsLeft >= 1;
          const canRepairMax = !atMax && stock >= 1 && repairPointsLeft >= 1;
          // V6 : Max plafonné par stock ET quota restant
          const maxRepair = Math.min(missing, stock, repairPointsLeft);

          return (
            <div key={slot} className="flex flex-wrap items-center gap-2 bg-white/60 border border-amber-100 rounded p-2 text-xs">
              <span className="text-base">{itemDef?.icon || "📦"}</span>
              <span className="font-body font-semibold">{itemDef?.name || label}</span>
              <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-body">G{eq.grade ?? 0}</Badge>
              <span className={`font-body ${isDisabled ? "text-red-700 font-semibold" : atMax ? "text-emerald-700" : "text-slate-700"}`}>
                {dura}/{EQUIPMENT_MAX_DURABILITY}
              </span>
              <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden min-w-[60px] max-w-[120px]">
                <div
                  className={`h-full transition-all ${isDisabled ? "bg-red-500" : dura <= 3 ? "bg-orange-400" : "bg-emerald-500"}`}
                  style={{ width: `${(dura / EQUIPMENT_MAX_DURABILITY) * 100}%` }}
                />
              </div>
              {isDisabled && <Badge variant="destructive" className="text-[10px] h-4 px-1">DÉSACTIVÉ</Badge>}
              {!atMax && (
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    size="sm"
                    variant={canRepair1 ? "default" : "outline"}
                    className="h-6 text-xs px-2 font-body"
                    disabled={busy || !canRepair1}
                    onClick={() => handleRepair(slot, type, 1)}
                  >
                    +1 ({resDef?.icon} 1)
                  </Button>
                  {missing > 1 && maxRepair > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2 font-body"
                      disabled={busy || !canRepairMax}
                      onClick={() => handleRepair(slot, type, maxRepair)}
                    >
                      Max ({resDef?.icon} {maxRepair})
                    </Button>
                  )}
                </div>
              )}
              {atMax && <span className="ml-auto text-emerald-700 font-body">✨ Max</span>}
            </div>
          );
        })}
        <p className="text-[11px] text-slate-500 font-body italic">
          1 🧱 Pierre = +1 dura sur l'arme · 1 🧶 Laine brute = +1 dura sur une armure · {" "}
          1 réparation = 1 point de quota journalier (réinitialisé au reset). {" "}
          L'usure provient des combats PvP.
        </p>
      </CardContent>
    </Card>
  );
}
