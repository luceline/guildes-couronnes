import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import HelpTooltip from "./HelpTooltip";
import CombatAvatar from "./CombatAvatar";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useState } from "react";
import {
  COMBAT_ZONE_LABELS,
  getCombatItemValue,
  getCombatStealPct,
  getPlayerHP,
  COMBAT_MAX_HP,
  isPlayerKO,
} from "../lib/gameData";
import { ITEMS } from "../lib/craftingData";

/**
 * Panneau "Équipement de combat" — affiche PV, scores, slot arme, 4 slots armures.
 * Auparavant intégré à Profile.jsx, déplacé dans la page Combat (Phase 3).
 *
 * Props:
 *   - profile : PlayerProfile (avec equipment, inventory, hp, etc.)
 *   - onRefresh : callback à appeler après équipement / déséquipement
 */
export default function CombatEquipmentPanel({ profile, onRefresh }) {
  if (!profile) return null;

  // ── handleEquip — accepte un JSON {item_key, grade} ou un item_key brut ──
  const handleEquip = async (slot, payloadOrKey) => {
    let itemKey, gradeRequested = null;
    try {
      const parsed = JSON.parse(payloadOrKey);
      if (parsed && typeof parsed === "object" && parsed.item_key) {
        itemKey = parsed.item_key;
        gradeRequested = parsed.grade ?? 0;
      } else {
        itemKey = payloadOrKey;
      }
    } catch {
      itemKey = payloadOrKey;
    }

    const inv = profile.inventory || [];
    const invItem = inv.find(i =>
      i.item_key === itemKey
      && (i.quantity || 0) > 0
      && (gradeRequested === null || (i.grade ?? 0) === gradeRequested)
    ) || inv.find(i => i.item_key === itemKey && (i.quantity || 0) > 0);
    if (!invItem) {
      toast.error("Cet objet n'est plus dans votre inventaire.");
      return;
    }
    const itemDef = ITEMS[itemKey];
    if (!itemDef || itemDef.combat_slot !== slot) {
      toast.error("Cet objet ne correspond pas à ce slot.");
      return;
    }
    const grade = invItem.grade ?? 0;
    const newInv = inv.map(i =>
      (i.item_key === itemKey && (i.grade ?? 0) === grade)
        ? { ...i, quantity: (i.quantity || 1) - 1 }
        : i
    ).filter(i => (i.quantity || 0) > 0);

    // Si un item était déjà équipé sur ce slot, on le remet dans l'inventaire
    const previouslyEquipped = profile.equipment?.[slot];
    if (previouslyEquipped) {
      const oldGrade = previouslyEquipped.grade ?? 0;
      const existing = newInv.find(i =>
        i.item_key === previouslyEquipped.item_key && (i.grade ?? 0) === oldGrade
      );
      if (existing) {
        existing.quantity = (existing.quantity || 0) + 1;
      } else {
        const oldDef = ITEMS[previouslyEquipped.item_key];
        newInv.push({
          item_key: previouslyEquipped.item_key,
          item_name: oldDef?.name || previouslyEquipped.item_key,
          item_category: oldDef?.category || "",
          quantity: 1,
          grade: oldGrade,
        });
      }
    }

    const newEquipment = {
      ...(profile.equipment || {}),
      [slot]: { item_key: itemKey, grade },
    };

    await base44.entities.PlayerProfile.update(profile.id, {
      inventory: newInv,
      equipment: newEquipment,
    });
    toast.success(`${itemDef.icon || "🎯"} ${itemDef.name} (G${grade}) équipé.`);
    onRefresh?.();
  };

  const handleUnequip = async (slot) => {
    const equipped = profile.equipment?.[slot];
    if (!equipped) return;
    const itemDef = ITEMS[equipped.item_key];
    const inv = profile.inventory || [];
    const existing = inv.find(i => i.item_key === equipped.item_key);
    let newInv;
    if (existing) {
      newInv = inv.map(i =>
        i.item_key === equipped.item_key ? { ...i, quantity: (i.quantity || 0) + 1 } : i
      );
    } else {
      newInv = [...inv, {
        item_key: equipped.item_key,
        item_name: itemDef?.name || equipped.item_key,
        item_category: itemDef?.category || "",
        quantity: 1,
        grade: equipped.grade,
      }];
    }
    const newEquipment = { ...(profile.equipment || {}) };
    delete newEquipment[slot];
    await base44.entities.PlayerProfile.update(profile.id, {
      inventory: newInv,
      equipment: newEquipment,
    });
    toast(`${itemDef?.icon || "📦"} ${itemDef?.name || equipped.item_key} retiré.`);
    onRefresh?.();
  };

  // Récupère les items de l'inventaire compatibles avec un slot donné
  const getInventoryItemsForSlot = (slot) => {
    const inv = profile.inventory || [];
    return inv.filter(invItem => {
      const def = ITEMS[invItem.item_key];
      return def?.combat_slot === slot && (invItem.quantity || 0) > 0;
    });
  };

  // État pour highlight de la zone au hover sur la liste
  const [hoverSlot, setHoverSlot] = useState(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg flex items-center gap-2">
          🛡️ Équipement de combat
          <HelpTooltip text="Une arme universelle (épée) + 4 armures, une par zone défendue (tête, torse, bras, jambes). L'attaquant choisit où viser, le défenseur choisit où parer. Si zones identiques, coup paré. Sinon, comparaison du score d'attaque (épée) vs score de défense (armure de la zone visée). Items utilisés uniquement en PvP, pas contre les monstres." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4">
          {/* ── Avatar SVG (gauche sur desktop, haut sur mobile) ── */}
          <div className="md:w-[280px] shrink-0 flex flex-col items-center">
            <CombatAvatar
              equipment={profile.equipment || {}}
              hp={getPlayerHP(profile)}
              maxHp={COMBAT_MAX_HP}
              ko={isPlayerKO(profile)}
              highlightSlot={hoverSlot}
              onSlotClick={(slot) => {
                // Scroll vers le slot dans la liste (mobile-friendly)
                const el = document.getElementById(`combat-slot-${slot}`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                setHoverSlot(slot);
                setTimeout(() => setHoverSlot(null), 1500);
              }}
            />
          </div>

          {/* ── Détails et sélecteurs (droite sur desktop, bas sur mobile) ── */}
          <div className="flex-1 space-y-3">
        {/* Barre de PV */}
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-heading font-semibold text-red-900">❤️ Points de vie :</span>
            <span className="text-sm font-body">{getPlayerHP(profile)} / {COMBAT_MAX_HP}</span>
            {isPlayerKO(profile) && <Badge variant="destructive" className="text-xs">KO — pas de contribution armée 48h</Badge>}
          </div>
          <div className="w-full bg-red-200 rounded-full h-2 mt-1.5 overflow-hidden">
            <div className="bg-red-500 h-full transition-all" style={{ width: `${(getPlayerHP(profile) / COMBAT_MAX_HP) * 100}%` }} />
          </div>
          <p className="text-xs font-body text-red-700 mt-1.5">Régénération : potions de soin (+5 PV) ou d'endurance (+10 PV).</p>
        </div>

        {/* Score total */}
        <div className="grid grid-cols-2 gap-2 text-xs font-body">
          <div className="bg-orange-50 border border-orange-200 rounded px-2 py-1">
            ⚔️ Score d'attaque : <strong>{(() => {
              const eq = profile.equipment?.weapon;
              return eq ? getCombatItemValue(eq.grade) : 0;
            })()}</strong>
          </div>
          <div className="bg-sky-50 border border-sky-200 rounded px-2 py-1">
            🛡️ Score de défense total : <strong>{
              ["head","torso","arms","legs"].reduce((sum, z) => {
                const eq = profile.equipment?.[`${z}_def`];
                return sum + (eq ? getCombatItemValue(eq.grade) : 0);
              }, 0)
            }</strong>
          </div>
        </div>

        {/* Slot arme universel */}
        <div
          id="combat-slot-weapon"
          className="border border-orange-200 bg-orange-50/40 rounded-lg p-2.5 transition-all"
          style={{ boxShadow: hoverSlot === "weapon" ? "0 0 0 2px #f59e0b" : "none" }}
          onMouseEnter={() => setHoverSlot("weapon")}
          onMouseLeave={() => setHoverSlot(null)}
        >
          <p className="text-xs font-heading font-semibold mb-1.5 flex items-center gap-1.5">
            ⚔️ <span>Arme principale</span>
            <span className="text-xs text-muted-foreground font-body">(toutes zones d'attaque)</span>
          </p>
          {(() => {
            const slot = "weapon";
            const equipped = profile.equipment?.[slot];
            const equippedDef = equipped ? ITEMS[equipped.item_key] : null;
            const availableItems = getInventoryItemsForSlot(slot);
            if (equipped && equippedDef) {
              return (
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{equippedDef.icon}</span>
                  <span className="text-sm font-body">{equippedDef.name}</span>
                  <Badge variant="outline" className="text-xs h-5 font-body">Grade {equipped.grade}</Badge>
                  <Badge variant="secondary" className="text-xs h-5 font-body">+{getCombatItemValue(equipped.grade)} atk</Badge>
                  <Badge variant="outline" className="text-xs h-5 font-body text-amber-700">
                    {Math.round(getCombatStealPct(equipped.item_key, equipped.grade) * 100)}% vol
                  </Badge>
                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2 font-body ml-auto"
                    onClick={() => handleUnequip(slot)}>
                    Retirer
                  </Button>
                </div>
              );
            }
            return (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground italic font-body">Aucune arme équipée — vous attaquerez à mains nues (score 0).</p>
                {availableItems.length > 0 ? (
                  <select
                    className="w-full text-xs font-body border border-border rounded px-1.5 py-1 bg-white"
                    defaultValue=""
                    onChange={e => {
                      if (e.target.value) handleEquip(slot, e.target.value);
                      e.target.value = "";
                    }}>
                    <option value="">— Équiper une arme —</option>
                    {availableItems.map(invItem => {
                      const def = ITEMS[invItem.item_key];
                      return (
                        <option key={`${invItem.item_key}-${invItem.grade ?? 0}`} value={JSON.stringify({ item_key: invItem.item_key, grade: invItem.grade ?? 0 })}>
                          {def?.icon} {def?.name} (g.{invItem.grade ?? 0}) ×{invItem.quantity}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <p className="text-xs text-muted-foreground/70 italic">Fabriquez une épée chez le Forgeron.</p>
                )}
              </div>
            );
          })()}
        </div>

        {/* 4 zones de défense (armures) */}
        <div className="space-y-2">
          <p className="text-xs font-heading font-semibold">🛡️ Armures par zone</p>
          {["head","torso","arms","legs"].map(zone => {
            const zoneInfo = COMBAT_ZONE_LABELS[zone];
            const slot = `${zone}_def`;
            const equipped = profile.equipment?.[slot];
            const equippedDef = equipped ? ITEMS[equipped.item_key] : null;
            const availableItems = getInventoryItemsForSlot(slot);
            return (
              <div
                key={zone}
                id={`combat-slot-${slot}`}
                className="border border-sky-200 bg-sky-50/30 rounded p-2 transition-all"
                style={{ boxShadow: hoverSlot === slot ? "0 0 0 2px #f59e0b" : "none" }}
                onMouseEnter={() => setHoverSlot(slot)}
                onMouseLeave={() => setHoverSlot(null)}
              >
                <p className="text-xs font-heading font-semibold mb-1.5 flex items-center gap-1.5">
                  {zoneInfo.icon} <span>{zoneInfo.label}</span>
                </p>
                {equipped && equippedDef ? (
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span>{equippedDef.icon}</span>
                    <span className="font-body">{equippedDef.name}</span>
                    <Badge variant="outline" className="text-xs h-4 px-1.5 font-body">G{equipped.grade}</Badge>
                    <span className="text-muted-foreground">+{getCombatItemValue(equipped.grade)} def</span>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2 font-body ml-auto"
                      onClick={() => handleUnequip(slot)}>
                      Retirer
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground italic font-body">Aucune armure</p>
                    {availableItems.length > 0 ? (
                      <select
                        className="w-full text-xs font-body border border-border rounded px-1.5 py-1 bg-white"
                        defaultValue=""
                        onChange={e => {
                          if (e.target.value) handleEquip(slot, e.target.value);
                          e.target.value = "";
                        }}>
                        <option value="">— Équiper —</option>
                        {availableItems.map(invItem => {
                          const def = ITEMS[invItem.item_key];
                          return (
                            <option key={`${invItem.item_key}-${invItem.grade ?? 0}`} value={JSON.stringify({ item_key: invItem.item_key, grade: invItem.grade ?? 0 })}>
                              {def?.icon} {def?.name} (g.{invItem.grade ?? 0}) ×{invItem.quantity}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <p className="text-xs text-muted-foreground/70 italic">À fabriquer chez le Tisserand.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
