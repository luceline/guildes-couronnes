import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import HelpTooltip from "./HelpTooltip";
import CombatAvatar from "./CombatAvatar";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useState } from "react";
import {
  COMBAT_ZONE_LABELS,
  COMBAT_MAX_GRADE,
  COMBAT_UPGRADE_COOLDOWN_SEC,
  EQUIPMENT_MAX_DURABILITY,
  getRepairResource,
  getCombatItemValue,
  getCombatStealPct,
  getCombatUpgradeCost,
  canUpgradeCombatItem,
  getMissingUpgradeResources,
  getPlayerHP,
  COMBAT_MAX_HP,
  isPlayerKO,
  // V6 — quota journalier de réparation
  DAILY_REPAIR_POINTS_BASE,
  getDailyRepairPoints,
  getRepairPointsUsedToday,
  canAffordRepair,
  buildRepairQuotaUpdate,
} from "../lib/gameData";
import { ITEMS } from "../lib/craftingData";

/**
 * Affiche une ressource du coût d'upgrade comme une "chip" cliquable.
 * Au hover (desktop) ou clic (mobile), un popover affiche le détail :
 * nom complet, quantité requise, stock actuel, statut, et où la récolter.
 */
function ResourceChip({ resKey, qtyRequired, stock, compact = false }) {
  const def = ITEMS[resKey];
  const ok = stock >= qtyRequired;
  const missing = Math.max(0, qtyRequired - stock);
  const profession = def?.biome_profession;
  const biomeKey = def?.biome_key;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <span
          className={`inline-flex items-center gap-0.5 cursor-help select-none rounded px-1 py-0.5 transition-colors ${
            ok ? "text-slate-700 hover:bg-slate-100" : "text-red-600 font-semibold hover:bg-red-50"
          }`}
        >
          <span>{def?.icon || "?"}</span>
          <span>{compact ? qtyRequired : `${qtyRequired} (${stock})`}</span>
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-64 text-xs font-body p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{def?.icon || "📦"}</span>
          <span className="font-heading font-semibold text-sm">{def?.name || resKey}</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-600">Quantité requise :</span>
            <span className="font-semibold">{qtyRequired}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Stock actuel :</span>
            <span className={ok ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"}>
              {stock}
            </span>
          </div>
          {!ok && (
            <div className="flex justify-between border-t border-border pt-1 mt-1">
              <span className="text-red-700">Manque :</span>
              <span className="text-red-700 font-bold">{missing}</span>
            </div>
          )}
          {ok && (
            <div className="text-emerald-700 italic pt-1 border-t border-border mt-1">
              ✓ Ressource suffisante
            </div>
          )}
        </div>
        {profession && (
          <div className="mt-2 pt-2 border-t border-border text-slate-600 italic">
            🎯 Récoltée par : <strong className="text-slate-800 not-italic">{profession}</strong>
            {biomeKey && <span> (biome <em>{biomeKey}</em>)</span>}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Bouton de réparation d'une pièce d'équipement.
 *
 * Factorise la logique commune aux 3 zones de réparation (arme, bouclier,
 * armures par zone) qui était auparavant dupliquée dans 3 blocs IIFE quasi
 * identiques.
 *
 * Props :
 *   - slot       : "weapon" | "shield" | "head_def" | "torso_def" | "arms_def" | "legs_def"
 *   - dura       : durabilité courante de la pièce (0 à EQUIPMENT_MAX_DURABILITY)
 *   - profile    : PlayerProfile (utilisé pour le stock d'inventaire)
 *   - busy       : true si une mutation est en cours (désactive le bouton)
 *   - onRepair   : callback appelé avec (slot) au clic
 *   - compact    : mode compact pour l'affichage des armures par zone
 *                  (bouton plus petit + ResourceChip compact + sans label "Coût :")
 */
function RepairButton({ slot, dura, profile, busy, onRepair, compact = false }) {
  const repairKey   = getRepairResource(slot);
  const repairDef   = ITEMS[repairKey];
  const repairStock = (profile.inventory || []).find(i => i.item_key === repairKey)?.quantity || 0;
  const atMax       = dura >= EQUIPMENT_MAX_DURABILITY;
  const noStock     = repairStock < 1;
  const repairTitle = atMax
    ? "Durabilité au maximum"
    : noStock
      ? `Manque 1 ${repairDef?.name || repairKey}`
      : `Restaure +1 dura (consomme 1 ${repairDef?.name || repairKey})`;

  return (
    <div className={`flex items-center ${compact ? "gap-1" : "gap-2"} flex-wrap`}>
      <Button
        size="sm"
        variant={!atMax && !noStock ? "default" : "outline"}
        className={`${compact ? "h-6" : "h-7"} text-xs px-2 font-body`}
        disabled={busy || atMax || noStock}
        onClick={() => onRepair(slot)}
        title={repairTitle}
      >
        🔧 Réparer
      </Button>
      <span className={`${compact ? "text-[11px]" : "text-xs"} text-muted-foreground font-body inline-flex items-center ${compact ? "gap-0.5" : "gap-1"}`}>
        {!compact && <span>Coût :</span>}
        <ResourceChip resKey={repairKey} qtyRequired={1} stock={repairStock} compact={compact} />
      </span>
    </div>
  );
}

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

  // ─────────────────────────────────────────────
  // REFONTE v4 — Upgrade en libre-service
  // L'utilisateur consomme ses ressources T1 (Bois, Fer, Quartz) pour passer son
  // item équipé du grade G au grade G+1. Pas d'artisan, pas d'or.
  // Cooldown stocké par item dans equipment[slot].upgrade_cooldown_until.
  // ─────────────────────────────────────────────
  const handleUpgrade = async (slot) => {
    const equipped = profile.equipment?.[slot];
    if (!equipped) {
      toast.error("Aucun équipement sur ce slot.");
      return;
    }
    const grade = equipped.grade ?? 0;
    if (grade >= COMBAT_MAX_GRADE) {
      toast.error("Cet item est déjà au grade maximum.");
      return;
    }
    // Cooldown actif ?
    if (equipped.upgrade_cooldown_until && new Date(equipped.upgrade_cooldown_until) > new Date()) {
      toast.error("Amélioration en cooldown — patientez.");
      return;
    }
    // Détection du type (atk pour weapon, shield pour bouclier, def pour armures)
    const type = slot === "weapon" ? "atk" : slot === "shield" ? "shield" : "def";
    const cost = getCombatUpgradeCost(type, grade);
    if (!cost) {
      toast.error("Coût d'amélioration introuvable.");
      return;
    }
    // Vérification ressources
    if (!canUpgradeCombatItem(profile.inventory || [], type, grade)) {
      const missing = getMissingUpgradeResources(profile.inventory || [], type, grade);
      const labels = Object.entries(missing).map(([k, q]) => {
        const def = ITEMS[k];
        return `${q} ${def?.icon || ""} ${def?.name || k}`;
      }).join(", ");
      toast.error(`Manque : ${labels}`);
      return;
    }
    setBusy(true);
    try {
      // Décrémenter les ressources
      let newInv = (profile.inventory || []).map(i => ({ ...i }));
      for (const [resKey, qty] of Object.entries(cost)) {
        const idx = newInv.findIndex(i => i.item_key === resKey);
        if (idx >= 0) {
          newInv[idx].quantity = (newInv[idx].quantity || 0) - qty;
        }
      }
      newInv = newInv.filter(i => (i.quantity || 0) > 0);
      // Mise à jour equipment : nouveau grade + cooldown
      const cdSeconds = COMBAT_UPGRADE_COOLDOWN_SEC[grade] || 60;
      const newEquipment = {
        ...(profile.equipment || {}),
        [slot]: {
          ...equipped,
          grade: grade + 1,
          upgrade_cooldown_until: new Date(Date.now() + cdSeconds * 1000).toISOString(),
        },
      };
      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: newInv,
        equipment: newEquipment,
      });
      const itemDef = ITEMS[equipped.item_key];
      toast.success(`${itemDef?.icon || "⚔️"} ${itemDef?.name || equipped.item_key} amélioré au grade ${grade + 1} !`);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'amélioration.");
    } finally {
      setBusy(false);
    }
  };

  // ─────────────────────────────────────────────
  // REFONTE ITEMS v5 — Réparation manuelle (pierre / laine brute)
  // L'utilisateur consomme 1 ressource pour restaurer +1 durabilité à un item équipé.
  //   - épée (slot weapon)            ← 1 Pierre
  //   - armure (head/torso/arms/legs) ← 1 Laine brute
  // Pas de cooldown, pas de coût en faim/énergie. Réparation autorisée même à dura=0.
  // ─────────────────────────────────────────────
  const handleRepair = async (slot) => {
    const equipped = profile.equipment?.[slot];
    if (!equipped) {
      toast.error("Aucun équipement sur ce slot.");
      return;
    }
    const dura = equipped.durability ?? EQUIPMENT_MAX_DURABILITY;
    if (dura >= EQUIPMENT_MAX_DURABILITY) {
      toast.error("Durabilité au maximum.");
      return;
    }
    // V6 — Vérification du quota journalier de réparation (5 points/jour de base).
    if (!canAffordRepair(profile, 1)) {
      const used = getRepairPointsUsedToday(profile);
      const total = getDailyRepairPoints(profile);
      toast.error(`Quota de réparation épuisé (${used}/${total} aujourd'hui). Réessayez demain.`);
      return;
    }
    // Choix de la ressource selon le slot, via le helper centralisé.
    const resKey = getRepairResource(slot);
    const resDef = ITEMS[resKey];

    // Vérification stock
    const inv = profile.inventory || [];
    const resItem = inv.find(i => i.item_key === resKey);
    if (!resItem || (resItem.quantity || 0) < 1) {
      toast.error(`Manque : 1 ${resDef?.icon || ""} ${resDef?.name || resKey}`);
      return;
    }
    setBusy(true);
    try {
      // Décrémenter la ressource
      const newInv = inv.map(i =>
        i.item_key === resKey ? { ...i, quantity: (i.quantity || 0) - 1 } : i
      ).filter(i => (i.quantity || 0) > 0);

      // Restaurer +1 durabilité (cap à EQUIPMENT_MAX_DURABILITY)
      const newDura = Math.min(EQUIPMENT_MAX_DURABILITY, dura + 1);
      const newEquipment = {
        ...(profile.equipment || {}),
        [slot]: {
          ...equipped,
          durability: newDura,
        },
      };
      // V6 — Construction du patch quota (incrémente compteur + écrit date du jour)
      const quotaUpdate = buildRepairQuotaUpdate(profile, 1);
      await base44.entities.PlayerProfile.update(profile.id, {
        inventory: newInv,
        equipment: newEquipment,
        ...quotaUpdate,
      });
      const itemDef = ITEMS[equipped.item_key];
      const remaining = getDailyRepairPoints(profile) - (getRepairPointsUsedToday(profile) + 1);
      toast.success(`🔧 ${itemDef?.icon || ""} ${itemDef?.name || equipped.item_key} réparé : durabilité ${dura} → ${newDura} (${remaining} pts restants)`);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la réparation.");
    } finally {
      setBusy(false);
    }
  };

  const formatCooldown = (untilIso) => {
    if (!untilIso) return null;
    const ms = new Date(untilIso).getTime() - Date.now();
    if (ms <= 0) return null;
    const sec = Math.ceil(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
  };

  // Indicateur global "occupé" pour griser tous les boutons pendant une action
  const [busy, setBusy] = useState(false);

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
        {/* V6 — Bandeau quota de réparation journalier */}
        {(() => {
          const used = getRepairPointsUsedToday(profile);
          const total = getDailyRepairPoints(profile);
          const remaining = total - used;
          const exhausted = remaining <= 0;
          return (
            <div className={`mb-3 px-3 py-2 rounded text-sm flex items-center justify-between ${
              exhausted
                ? "bg-red-50 border border-red-200 text-red-800"
                : remaining <= 1
                  ? "bg-orange-50 border border-orange-200 text-orange-800"
                  : "bg-slate-50 border border-slate-200 text-slate-700"
            }`}>
              <span className="flex items-center gap-1.5">
                🔧 <span className="font-semibold">Quota de réparation aujourd'hui :</span>
                <span>{remaining} / {total} points restants</span>
              </span>
              {exhausted && (
                <span className="text-xs italic">Réinitialisé chaque jour</span>
              )}
            </div>
          );
        })()}
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
          <p className="text-xs font-body text-red-700 mt-1.5">Régénération : utilisez un cataplasme (+5 PV).</p>
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
              const dura = equipped.durability ?? EQUIPMENT_MAX_DURABILITY;
              const grade = equipped.grade ?? 0;
              const canUp = grade < COMBAT_MAX_GRADE;
              const cd = formatCooldown(equipped.upgrade_cooldown_until);
              const cost = canUp ? getCombatUpgradeCost("atk", grade) : null;
              const enoughRes = canUp && canUpgradeCombatItem(profile.inventory || [], "atk", grade);
              const isDisabled = dura <= 0;
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{equippedDef.icon}</span>
                    <span className="text-sm font-body">{equippedDef.name}</span>
                    <Badge variant="outline" className="text-xs h-5 font-body">Grade {grade}</Badge>
                    <Badge variant="secondary" className="text-xs h-5 font-body">+{getCombatItemValue(grade)} atk</Badge>
                    <Badge variant="outline" className="text-xs h-5 font-body text-amber-700">
                      {Math.round(getCombatStealPct(equipped.item_key, grade) * 100)}% vol
                    </Badge>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2 font-body ml-auto"
                      onClick={() => handleUnequip(slot)}>
                      Retirer
                    </Button>
                  </div>
                  {/* Barre de durabilité */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-body ${isDisabled ? "text-red-700 font-semibold" : "text-slate-600"}`}>
                      🛡️ Durabilité : {dura}/{EQUIPMENT_MAX_DURABILITY}
                    </span>
                    <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden max-w-[120px]">
                      <div
                        className={`h-full transition-all ${isDisabled ? "bg-red-500" : dura <= 3 ? "bg-orange-400" : "bg-emerald-500"}`}
                        style={{ width: `${(dura / EQUIPMENT_MAX_DURABILITY) * 100}%` }}
                      />
                    </div>
                    {isDisabled && <Badge variant="destructive" className="text-xs h-4 px-1.5">DÉSACTIVÉ</Badge>}
                  </div>
                  {/* Bouton upgrade */}
                  {canUp && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant={enoughRes && !cd ? "default" : "outline"}
                        className="h-7 text-xs px-2 font-body"
                        disabled={busy || !enoughRes || !!cd}
                        onClick={() => handleUpgrade(slot)}
                      >
                        ⬆️ Améliorer G{grade} → G{grade + 1}
                        {cd && <span className="ml-1.5 text-amber-600">({cd})</span>}
                      </Button>
                      {cost && (
                        <span className="text-xs text-muted-foreground font-body inline-flex items-center gap-1 flex-wrap">
                          <span>Coût :</span>
                          {Object.entries(cost).map(([k, q]) => {
                            const stock = (profile.inventory || []).find(i => i.item_key === k)?.quantity || 0;
                            return <ResourceChip key={k} resKey={k} qtyRequired={q} stock={stock} />;
                          })}
                        </span>
                      )}
                    </div>
                  )}
                  {!canUp && <p className="text-xs text-emerald-700 font-body">✨ Grade maximum atteint</p>}

                  {/* Bouton réparer arme */}
                  <RepairButton
                    slot={slot}
                    dura={dura}
                    profile={profile}
                    busy={busy}
                    onRepair={handleRepair}
                  />
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

        {/* Slot bouclier — défense additionnelle utilisée en combat PvE (biome) ET PvP zoné */}
        <div
          id="combat-slot-shield"
          className="border border-sky-300 bg-sky-50/40 rounded-lg p-2.5 transition-all"
          style={{ boxShadow: hoverSlot === "shield" ? "0 0 0 2px #f59e0b" : "none" }}
          onMouseEnter={() => setHoverSlot("shield")}
          onMouseLeave={() => setHoverSlot(null)}
        >
          <p className="text-xs font-heading font-semibold mb-1.5 flex items-center gap-1.5">
            🛡️ <span>Bouclier</span>
            <span className="text-xs text-muted-foreground font-body">(2e zone défendue en combat PvE et PvP)</span>
          </p>
          {(() => {
            const slot = "shield";
            const equipped = profile.equipment?.[slot];
            const equippedDef = equipped ? ITEMS[equipped.item_key] : null;
            const availableItems = getInventoryItemsForSlot(slot);
            if (equipped && equippedDef) {
              const dura = equipped.durability ?? EQUIPMENT_MAX_DURABILITY;
              const grade = equipped.grade ?? 0;
              const canUp = grade < COMBAT_MAX_GRADE;
              const cd = formatCooldown(equipped.upgrade_cooldown_until);
              const cost = canUp ? getCombatUpgradeCost("shield", grade) : null;
              const enoughRes = canUp && canUpgradeCombatItem(profile.inventory || [], "shield", grade);
              const isDisabled = dura <= 0;
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{equippedDef.icon}</span>
                    <span className="text-sm font-body">{equippedDef.name}</span>
                    <Badge variant="outline" className="text-xs h-5 font-body">Grade {grade}</Badge>
                    <Badge variant="secondary" className="text-xs h-5 font-body">+{getCombatItemValue(grade)} def bonus</Badge>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2 font-body ml-auto"
                      onClick={() => handleUnequip(slot)}>
                      Retirer
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-body ${isDisabled ? "text-red-700 font-semibold" : "text-slate-600"}`}>
                      🛡️ Durabilité : {dura}/{EQUIPMENT_MAX_DURABILITY}
                    </span>
                    <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden max-w-[120px]">
                      <div
                        className={`h-full transition-all ${isDisabled ? "bg-red-500" : dura <= 3 ? "bg-orange-400" : "bg-emerald-500"}`}
                        style={{ width: `${(dura / EQUIPMENT_MAX_DURABILITY) * 100}%` }}
                      />
                    </div>
                    {isDisabled && <Badge variant="destructive" className="text-xs h-4 px-1.5">DÉSACTIVÉ</Badge>}
                  </div>
                  {canUp && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant={enoughRes && !cd ? "default" : "outline"}
                        className="h-7 text-xs px-2 font-body"
                        disabled={busy || !enoughRes || !!cd}
                        onClick={() => handleUpgrade(slot)}
                      >
                        ⬆️ Améliorer G{grade} → G{grade + 1}
                        {cd && <span className="ml-1.5 text-amber-600">({cd})</span>}
                      </Button>
                      {cost && (
                        <span className="text-xs text-muted-foreground font-body inline-flex items-center gap-1 flex-wrap">
                          <span>Coût :</span>
                          {Object.entries(cost).map(([k, q]) => {
                            const stock = (profile.inventory || []).find(i => i.item_key === k)?.quantity || 0;
                            return <ResourceChip key={k} resKey={k} qtyRequired={q} stock={stock} />;
                          })}
                        </span>
                      )}
                    </div>
                  )}
                  {!canUp && <p className="text-xs text-emerald-700 font-body">✨ Grade maximum atteint</p>}
                  {/* Bouton réparer bouclier */}
                  <RepairButton
                    slot={slot}
                    dura={dura}
                    profile={profile}
                    busy={busy}
                    onRepair={handleRepair}
                  />
                </div>
              );
            }
            return (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground italic font-body">Aucun bouclier équipé — vous ne défendez qu'une seule zone en combat (PvE biome et PvP zoné).</p>
                {availableItems.length > 0 ? (
                  <select
                    className="w-full text-xs font-body border border-border rounded px-1.5 py-1 bg-white"
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) handleEquip("shield", e.target.value); }}
                  >
                    <option value="" disabled>Équiper…</option>
                    {availableItems.map(invItem => {
                      const def = ITEMS[invItem.item_key];
                      return (
                        <option key={invItem.item_key} value={invItem.item_key}>
                          {def?.icon || ""} {def?.name || invItem.item_key} (×{invItem.quantity})
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <p className="text-xs text-muted-foreground italic font-body">Aucun bouclier dans l'inventaire — craftez-en un chez le Forgeron.</p>
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
                {equipped && equippedDef ? (() => {
                  const dura = equipped.durability ?? EQUIPMENT_MAX_DURABILITY;
                  const grade = equipped.grade ?? 0;
                  const canUp = grade < COMBAT_MAX_GRADE;
                  const cd = formatCooldown(equipped.upgrade_cooldown_until);
                  const cost = canUp ? getCombatUpgradeCost("def", grade) : null;
                  const enoughRes = canUp && canUpgradeCombatItem(profile.inventory || [], "def", grade);
                  const isDisabled = dura <= 0;
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span>{equippedDef.icon}</span>
                        <span className="font-body">{equippedDef.name}</span>
                        <Badge variant="outline" className="text-xs h-4 px-1.5 font-body">G{grade}</Badge>
                        <span className="text-muted-foreground">+{getCombatItemValue(grade)} def</span>
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2 font-body ml-auto"
                          onClick={() => handleUnequip(slot)}>
                          Retirer
                        </Button>
                      </div>
                      {/* Durabilité armure */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`font-body ${isDisabled ? "text-red-700 font-semibold" : "text-slate-600"}`}>
                          🛡️ {dura}/{EQUIPMENT_MAX_DURABILITY}
                        </span>
                        <div className="flex-1 bg-slate-200 rounded-full h-1 overflow-hidden max-w-[100px]">
                          <div
                            className={`h-full transition-all ${isDisabled ? "bg-red-500" : dura <= 3 ? "bg-orange-400" : "bg-emerald-500"}`}
                            style={{ width: `${(dura / EQUIPMENT_MAX_DURABILITY) * 100}%` }}
                          />
                        </div>
                        {isDisabled && <Badge variant="destructive" className="text-[10px] h-4 px-1">OFF</Badge>}
                      </div>
                      {/* Bouton upgrade armure */}
                      {canUp && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant={enoughRes && !cd ? "default" : "outline"}
                            className="h-6 text-xs px-2 font-body"
                            disabled={busy || !enoughRes || !!cd}
                            onClick={() => handleUpgrade(slot)}
                          >
                            ⬆️ G{grade}→G{grade + 1}
                            {cd && <span className="ml-1 text-amber-600">({cd})</span>}
                          </Button>
                          {cost && (
                            <span className="text-[11px] text-muted-foreground font-body inline-flex items-center gap-0.5 flex-wrap">
                              {Object.entries(cost).map(([k, q]) => {
                                const stock = (profile.inventory || []).find(i => i.item_key === k)?.quantity || 0;
                                return <ResourceChip key={k} resKey={k} qtyRequired={q} stock={stock} compact />;
                              })}
                            </span>
                          )}
                        </div>
                      )}
                      {!canUp && <p className="text-[11px] text-emerald-700 font-body">✨ G5</p>}

                      {/* Bouton réparer armure (compact) */}
                      <RepairButton
                        slot={slot}
                        dura={dura}
                        profile={profile}
                        busy={busy}
                        onRepair={handleRepair}
                        compact
                      />
                    </div>
                  );
                })() : (
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
