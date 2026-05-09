/**
 * RepairGearModal.jsx — Modale de répartition des points de réparation.
 *
 * Affichée quand le joueur consomme un Marteau d'armurier (ou tout item avec
 * effect: "repair_combat_gear"). Le joueur répartit `value` points (10 par
 * défaut) entre ses 6 slots d'équipement (weapon, shield, head_def, torso_def,
 * arms_def, legs_def).
 *
 * Règles :
 *   - 1 point = +1 durabilité sur le slot choisi
 *   - Impossible de dépasser EQUIPMENT_MAX_DURABILITY (10) sur un slot
 *   - Impossible de dépasser le total `value` (10) de points distribués
 *   - Slots vides (pas d'item équipé) : grisés, non utilisables
 *   - Slots à durabilité max : grisés, non utilisables
 *
 * Props :
 *   - itemDef : { name, icon, value, ... } définition du marteau
 *   - profile : PlayerProfile (pour lire equipment)
 *   - onClose : callback annulation (ne consomme pas)
 *   - onConfirm : async callback (distribution) => void, consomme l'item
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ITEMS } from "../lib/craftingData";
import { EQUIPMENT_MAX_DURABILITY } from "../lib/gameData";

const SLOTS = [
  { key: "weapon",    label: "Arme" },
  { key: "shield",    label: "Bouclier" },
  { key: "head_def",  label: "Heaume" },
  { key: "torso_def", label: "Cuirasse" },
  { key: "arms_def",  label: "Brassard" },
  { key: "legs_def",  label: "Jambière" },
];

export default function RepairGearModal({ itemDef, profile, onClose, onConfirm }) {
  const totalPoints = itemDef?.value || 10;
  const [distribution, setDistribution] = useState(
    SLOTS.reduce((acc, s) => ({ ...acc, [s.key]: 0 }), {})
  );
  const [busy, setBusy] = useState(false);

  const equipment = profile?.equipment || {};
  const pointsUsed = Object.values(distribution).reduce((a, b) => a + b, 0);
  const pointsLeft = totalPoints - pointsUsed;

  /** Renvoie la durabilité courante d'un slot (10 si vide). */
  const getCurrentDura = (slotKey) => {
    const eq = equipment[slotKey];
    if (!eq) return null;
    return eq.durability ?? EQUIPMENT_MAX_DURABILITY;
  };

  /** Renvoie la durabilité projetée après répartition. */
  const getProjectedDura = (slotKey) => {
    const cur = getCurrentDura(slotKey);
    if (cur === null) return null;
    return Math.min(EQUIPMENT_MAX_DURABILITY, cur + (distribution[slotKey] || 0));
  };

  /** +1 point sur un slot (si possible). */
  const handleIncrement = (slotKey) => {
    const cur = getCurrentDura(slotKey);
    if (cur === null) return;
    const projected = getProjectedDura(slotKey);
    if (projected >= EQUIPMENT_MAX_DURABILITY) return;
    if (pointsLeft <= 0) return;
    setDistribution(d => ({ ...d, [slotKey]: (d[slotKey] || 0) + 1 }));
  };

  /** -1 point sur un slot. */
  const handleDecrement = (slotKey) => {
    if ((distribution[slotKey] || 0) <= 0) return;
    setDistribution(d => ({ ...d, [slotKey]: d[slotKey] - 1 }));
  };

  /** Réinitialise toute la distribution. */
  const handleReset = () => {
    setDistribution(SLOTS.reduce((acc, s) => ({ ...acc, [s.key]: 0 }), {}));
  };

  /** Confirme : applique la distribution et consomme l'item. */
  const handleConfirm = async () => {
    if (pointsUsed === 0) return;
    setBusy(true);
    try {
      await onConfirm(distribution);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{itemDef?.icon || "🔨"}</span>
            <span>{itemDef?.name || "Marteau d'armurier"}</span>
          </DialogTitle>
          <DialogDescription>
            Répartissez {totalPoints} points de réparation entre vos pièces équipées.
            Chaque point ajoute +1 de durabilité.
          </DialogDescription>
        </DialogHeader>

        {/* Compteur de points */}
        <div className={`px-3 py-2 rounded text-sm font-semibold flex items-center justify-between ${
          pointsLeft === 0
            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
            : pointsLeft < totalPoints
              ? "bg-amber-50 border border-amber-200 text-amber-800"
              : "bg-slate-50 border border-slate-200 text-slate-700"
        }`}>
          <span>🔧 Points restants</span>
          <span className="text-lg">{pointsLeft} / {totalPoints}</span>
        </div>

        {/* Liste des 6 slots */}
        <div className="space-y-2 mt-2">
          {SLOTS.map(slot => {
            const eq = equipment[slot.key];
            const cur = getCurrentDura(slot.key);
            const projected = getProjectedDura(slot.key);
            const points = distribution[slot.key] || 0;
            const isEmpty = !eq;
            const isMaxed = !isEmpty && cur >= EQUIPMENT_MAX_DURABILITY && points === 0;
            const isProjectedMax = !isEmpty && projected >= EQUIPMENT_MAX_DURABILITY;

            const itemDef2 = eq ? ITEMS[eq.item_key] : null;
            const itemName = itemDef2?.name || slot.label;
            const itemIcon = itemDef2?.icon || "—";

            return (
              <div
                key={slot.key}
                className={`flex items-center gap-2 px-3 py-2 rounded border ${
                  isEmpty
                    ? "bg-slate-50 border-slate-200 opacity-50"
                    : isMaxed
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-white border-slate-300"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span>{itemIcon}</span>
                    <span className="font-medium text-sm truncate">{itemName}</span>
                  </div>
                  {!isEmpty && (
                    <div className="text-xs text-muted-foreground">
                      {slot.label} :
                      <span className={`ml-1 ${points > 0 ? "font-semibold text-amber-700" : ""}`}>
                        {cur}/{EQUIPMENT_MAX_DURABILITY}
                      </span>
                      {points > 0 && (
                        <span className="text-emerald-700 font-semibold">
                          {" "}→ {projected}/{EQUIPMENT_MAX_DURABILITY}
                        </span>
                      )}
                    </div>
                  )}
                  {isEmpty && (
                    <div className="text-xs text-muted-foreground italic">Aucun équipement</div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    disabled={isEmpty || points === 0 || busy}
                    onClick={() => handleDecrement(slot.key)}
                  >
                    −
                  </Button>
                  <span className="w-8 text-center font-mono text-sm">{points}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    disabled={isEmpty || isProjectedMax || pointsLeft <= 0 || busy}
                    onClick={() => handleIncrement(slot.key)}
                  >
                    +
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Boutons d'action */}
        <div className="flex justify-between gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={pointsUsed === 0 || busy}>
            Réinitialiser
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Annuler
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={pointsUsed === 0 || busy}
              className="bg-amber-700 hover:bg-amber-800 text-white"
            >
              {busy ? "Application..." : `Réparer (${pointsUsed} pt${pointsUsed > 1 ? "s" : ""})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
