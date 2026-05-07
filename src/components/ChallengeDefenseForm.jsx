/**
 * ChallengeDefenseForm : Modal pour défendre contre un défi PvP reçu.
 *
 * REFONTE V6 :
 *   - Affiche pour chaque zone : armure équipée, durabilité, et taux de
 *     parade/blocage (basé sur la dura).
 *   - Affiche le taux d'absorption du bouclier (basé sur sa dura).
 *   - Gère le nouveau résultat "attack_missed" (l'épée de l'attaquant a raté son jet).
 *   - Messages taverne et toasts adaptés à chaque issue (parry réussi/raté, blocage,
 *     attaque ratée).
 *
 * Conservé V5 :
 *   - Le défenseur choisit sa zone de parade (head/torso/arms/legs).
 *   - Si la zone parée correspond à celle attaquée → tentative de parade.
 *   - Le bouclier optionnel se place sur une zone DIFFÉRENTE de la parade.
 *   - Si ce défi est lui-même une riposte, pas de nouvelle fenêtre de riposte ouverte.
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { logGold } from "@/lib/goldLog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, X, ChevronRight } from "lucide-react";
import {
  COMBAT_ZONES,
  COMBAT_PARRY_TIMER_HOURS,
  EQUIPMENT_MAX_DURABILITY,
  getEquippedItem,
} from "@/lib/gameData";
import { resolveCombat, getEquippedShield, getAvailableDefenseOptions } from "@/lib/combatPvP";
import { claimBountiesIfApplicable } from "@/lib/bountyResolver";
import { ITEMS } from "@/lib/craftingData";
import { notifyTavern } from "@/lib/tavernNotifier";

const ZONE_LABELS = { head: "Tête", torso: "Torse", arms: "Bras", legs: "Jambes" };
const ZONE_ICONS  = { head: "🪖",   torso: "🛡️",   arms: "💪",   legs: "🦵" };

// Couleur selon le taux (0-100)
function pctColor(pct) {
  if (pct === 0) return "text-red-700 font-semibold";
  if (pct <= 30) return "text-orange-700";
  if (pct <= 60) return "text-amber-700";
  return "text-emerald-700";
}

export default function ChallengeDefenseForm({ challenge, defender, onClose, onResolved }) {
  const [selectedZone, setSelectedZone] = useState(null);
  const [shieldZone, setShieldZone] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!challenge || !defender) return null;

  // V6 — bouclier équipé enrichi avec block_chance
  const equippedShield = getEquippedShield(defender);
  const hasShield = !!equippedShield;
  const shieldBroken = hasShield && (equippedShield.durability ?? 0) <= 0;
  const shieldPct = hasShield ? Math.round(equippedShield.block_chance * 100) : 0;

  // V6 — options de défense par zone (incluent defense_chance basé sur dura)
  const defenseOptions = getAvailableDefenseOptions(defender);
  const optionsByZone = {};
  for (const opt of defenseOptions) optionsByZone[opt.zone] = opt;

  const handleSubmit = async () => {
    if (!selectedZone) { toast.error("Choisissez une zone de défense."); return; }
    if (shieldZone && shieldZone === selectedZone) {
      toast.error("Le bouclier doit être placé sur une zone différente de votre parade.");
      return;
    }
    setSubmitting(true);

    try {
      const freshAttacker = await base44.entities.PlayerProfile.filter({
        user_email: challenge.attacker_email
      }).then(r => r[0]);
      if (!freshAttacker) {
        toast.error("Attaquant introuvable.");
        return;
      }
      const freshDefender = await base44.entities.PlayerProfile.get(defender.id);

      const { resolution, attackerUpdates, defenderUpdates } = resolveCombat(
        freshAttacker,
        freshDefender,
        {
          attack_zone: challenge.attack_zone,
          attack_weapon_key: challenge.attack_weapon_key,
          defense_zone: selectedZone,
          shield_zone: shieldZone,
        }
      );

      const ops = [];
      if (Object.keys(attackerUpdates).length > 0) {
        ops.push(base44.entities.PlayerProfile.update(freshAttacker.id, attackerUpdates));
      }
      if (Object.keys(defenderUpdates).length > 0) {
        ops.push(base44.entities.PlayerProfile.update(freshDefender.id, defenderUpdates));
      }

      const isRiposte = !!(challenge.parent_challenge_id && challenge.parent_challenge_id !== "");
      const ripostWindow = isRiposte ? null : resolution.riposte_window_until;

      ops.push(base44.entities.CombatChallenge.update(challenge.id, {
        defense_zone: selectedZone,
        shield_zone: shieldZone || "",
        shield_used: !!resolution.shield_used,
        status: "resolved",
        result: resolution.result,
        attack_score: resolution.attack_score,
        defense_score: resolution.defense_score,
        damage_dealt: resolution.damage_dealt,
        gold_stolen: resolution.gold_stolen,
        attacker_break_item: resolution.attacker_break_item || "",
        defender_break_item: resolution.defender_break_item || "",
        bourse_broke: !!resolution.bourse_broke,
        // V6 — on log les détails de jets pour debug / analytics
        parry_attempted: !!resolution.parry_attempted,
        parry_succeeded: !!resolution.parry_succeeded,
        attack_roll_succeeded: resolution.attack_roll_succeeded,
        defense_roll_succeeded: resolution.defense_roll_succeeded,
        shield_attempted: !!resolution.shield_attempted,
        shield_succeeded: !!resolution.shield_succeeded,
        // V6.1 — jet de sauvegarde basé sur le niveau du défenseur
        save_attempted: !!resolution.save_attempted,
        save_succeeded: !!resolution.save_succeeded,
        riposte_window_until: ripostWindow,
        resolved_at: new Date().toISOString(),
      }));

      if (resolution.gold_stolen > 0) {
        ops.push(
          logGold({
            profile: freshAttacker,
            city: { id: challenge.city_id, name: challenge.city_name },
            amount: resolution.gold_stolen,
            type: "combat_pvp_gain",
            description: `Vol PvP : ${freshDefender.character_name || ""} (${ZONE_LABELS[challenge.attack_zone]})`,
          }),
          logGold({
            profile: freshDefender,
            city: { id: challenge.city_id, name: challenge.city_name },
            amount: -resolution.gold_stolen,
            type: "combat_pvp_loss",
            description: `Or volé par ${freshAttacker.character_name || ""}`,
          }),
        );
      }

      await Promise.all(ops);

      let bountyResult = { claimed: 0, totalGold: 0 };
      if (resolution.result === "attacker_won") {
        try {
          bountyResult = await claimBountiesIfApplicable(base44, {
            attacker: freshAttacker,
            defender: freshDefender,
            combatResult: resolution.result,
            cityId: challenge.city_id || "",
            cityName: challenge.city_name || "",
          });
        } catch (e) {
          console.error("Bounty claim error:", e);
        }
      }

      // ── V6 — Annonce taverne adaptée à chaque issue ──
      try {
        let msg;
        const attackerName = freshAttacker.character_name || "L'attaquant";
        const defenderName = freshDefender.character_name || "Le défenseur";

        if (resolution.result === "parried") {
          msg = `🛡️ ${defenderName} a paré l'attaque de ${attackerName} ! Riposte possible.`;
        } else if (resolution.result === "attack_missed") {
          msg = `💨 La lame de ${attackerName} s'est dérobée — l'attaque contre ${defenderName} n'a pas porté.`;
        } else if (resolution.result === "attacker_won") {
          msg = `⚔️ ${attackerName} l'emporte sur ${defenderName} ${resolution.gold_stolen > 0 ? `et lui dérobe ${resolution.gold_stolen}💰` : ""}.`;
        } else if (resolution.shield_used) {
          msg = `🛡️ Le bouclier de ${defenderName} a absorbé l'attaque de ${attackerName} !`;
        } else {
          msg = `🛡️ ${defenderName} a repoussé l'attaque de ${attackerName} !`;
        }
        if (challenge.city_id) {
          await notifyTavern({
            cityId: challenge.city_id,
            audience: "public",
            authorEmail: freshDefender.user_email,
            authorName: freshDefender.character_name || "",
            message: msg,
          });
        }
      } catch (e) { /* silent */ }

      // ── V6 — Toast adapté ──
      if (resolution.result === "parried") {
        toast.success(`🛡️ Parade réussie ! Vous avez ${COMBAT_PARRY_TIMER_HOURS}h pour riposter.`);
      } else if (resolution.result === "attack_missed") {
        toast.success(`💨 La lame adverse s'est dérobée ! Aucun dégât.`);
      } else if (resolution.result === "defender_won") {
        if (resolution.shield_used) {
          toast.success(`🛡️ Votre bouclier a absorbé l'attaque ! (Pas de riposte)`);
        } else {
          toast.success(`🛡️ Vous avez repoussé l'attaque !`);
        }
      } else {
        // attacker_won
        const bountyMsg = bountyResult.totalGold > 0
          ? ` (mais l'attaquant a touché ${bountyResult.totalGold}💰 de prime sur votre tête !)`
          : "";
        toast.error(`💔 Vous avez subi le coup. -${resolution.damage_dealt} PV${resolution.gold_stolen > 0 ? `, -${resolution.gold_stolen}💰` : ""}${bountyMsg}.`);
      }

      onResolved?.();
      onClose?.();
    } catch (e) {
      console.error("Resolve combat:", e);
      toast.error("Erreur lors de la résolution du combat.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOption = selectedZone ? optionsByZone[selectedZone] : null;
  const selectedParryPct = selectedOption ? Math.round(selectedOption.defense_chance * 100) : 0;
  const selectedBlockPct = selectedZone === challenge.attack_zone ? null : selectedParryPct;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-2 border-blue-300 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="relative p-4 pb-3 border-b">
          <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-muted-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <h2 className="font-heading text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" /> Défendre contre {challenge.attacker_name}
          </h2>
          <p className="text-xs font-body text-muted-foreground mt-1">
            Combat zoné PvP {challenge.city_name ? `à ${challenge.city_name}` : ""}
          </p>
        </div>

        <CardContent className="p-4 space-y-4">
          {/* Info attaque */}
          <div className="bg-amber-50/40 border border-amber-200 rounded-lg p-3 space-y-1">
            <p className="text-xs font-body">
              <strong>{challenge.attacker_name}</strong> vous a défié en combat zoné. Vous ne savez pas quelle zone il vise.
            </p>
            <p className="text-xs font-body text-muted-foreground italic">
              Choisissez la zone que vous défendez. Si vous devinez juste, votre armure tente une <strong>parade</strong> (taux selon sa durabilité). Sinon, l'attaquant frappe la zone qu'il vise et c'est votre armure de cette zone qui tente de <strong>bloquer</strong>.
            </p>
            <p className="text-[11px] font-body text-muted-foreground italic pt-1 border-t border-amber-200/60">
              ✨ Si tout échoue, votre expérience vous offre une <strong>dernière sauvegarde</strong> qui peut amortir le coup d'un point de vie (10% à 50% selon votre écart de niveau).
            </p>
          </div>

          {/* V6 — Choix de la zone avec armure + dura + % */}
          <div className="space-y-2">
            <p className="text-xs font-heading font-semibold">🛡️ Quelle zone défendez-vous ?</p>
            <div className="grid grid-cols-2 gap-2">
              {COMBAT_ZONES.map(zone => {
                const isSelected = selectedZone === zone;
                const opt = optionsByZone[zone];
                const armorDef = opt.item_key ? ITEMS[opt.item_key] : null;
                const pct = Math.round(opt.defense_chance * 100);
                const dura = opt.durability ?? 0;
                const broken = !!opt.item_key && dura <= 0;

                return (
                  <button
                    key={zone}
                    type="button"
                    onClick={() => setSelectedZone(zone)}
                    className={`text-left rounded-lg border-2 p-2.5 transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 shadow-sm"
                        : "border-border bg-card hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-heading">
                      <span className="text-lg">{ZONE_ICONS[zone]}</span>
                      <span>{ZONE_LABELS[zone]}</span>
                      {isSelected && <ChevronRight className="h-4 w-4 ml-auto text-blue-600" />}
                    </div>
                    {armorDef ? (
                      <div className="mt-1.5 space-y-1">
                        <div className="text-xs font-body text-muted-foreground flex flex-wrap items-center gap-1">
                          <span>{armorDef.icon}</span>
                          <span>{armorDef.name}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1 font-body">G{opt.grade}</Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-body">
                          <span className={broken ? "text-red-700 font-semibold" : "text-slate-600"}>
                            dura {dura}/{EQUIPMENT_MAX_DURABILITY}
                          </span>
                          <div className="flex-1 bg-slate-200 rounded-full h-1 overflow-hidden max-w-[60px]">
                            <div
                              className={`h-full ${broken ? "bg-red-500" : dura <= 3 ? "bg-orange-400" : "bg-emerald-500"}`}
                              style={{ width: `${(dura / EQUIPMENT_MAX_DURABILITY) * 100}%` }}
                            />
                          </div>
                          <span className={`ml-auto ${pctColor(pct)}`}>
                            🎲 {pct}%
                          </span>
                        </div>
                        {broken && (
                          <p className="text-[10px] font-body text-red-700 italic">⚠️ Armure cassée (inopérante)</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs font-body text-muted-foreground/70 italic mt-1.5">
                        Aucune armure (0% de défense sur cette zone)
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* V6 BOUCLIER : sélecteur de zone bouclier (avec taux d'absorption) */}
          {hasShield && (
            <div className="space-y-2 border-2 border-sky-300 bg-sky-50/50 rounded-lg p-3">
              <p className="text-xs font-heading font-semibold flex items-center gap-1.5 text-sky-900">
                🛡️ Placer votre bouclier
                <span className="text-sky-700 font-body">
                  G{equippedShield.grade} (+{equippedShield.score} def · dura {equippedShield.durability}/{EQUIPMENT_MAX_DURABILITY})
                </span>
                <span className={`ml-auto ${pctColor(shieldPct)}`}>
                  🎲 {shieldPct}% absorption
                </span>
              </p>
              {shieldBroken ? (
                <p className="text-xs font-body text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                  ⚠️ Bouclier cassé (dura 0). Il ne pourra pas absorber l'attaque tant qu'il n'est pas réparé.
                </p>
              ) : (
                <p className="text-xs font-body text-sky-800 italic">
                  Optionnel : votre bouclier renforce une autre zone (différente de votre parade). Si l'attaquant frappe la zone bouclier <em>et</em> que le bouclier réussit son jet, son grade s'ajoute au tie-break défensif.
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {COMBAT_ZONES.map(zone => {
                  const disabled = zone === selectedZone || shieldBroken;
                  const isSelected = shieldZone === zone;
                  return (
                    <button
                      key={`shield-${zone}`}
                      type="button"
                      onClick={() => setShieldZone(isSelected ? null : zone)}
                      disabled={disabled}
                      className={`text-left rounded border-2 p-1.5 text-xs transition-colors ${
                        disabled
                          ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                          : isSelected
                            ? "border-sky-500 bg-sky-100"
                            : "border-border bg-card hover:border-sky-300"
                      }`}
                    >
                      <div className="flex items-center gap-1 font-heading">
                        <span>{ZONE_ICONS[zone]}</span>
                        <span>{ZONE_LABELS[zone]}</span>
                      </div>
                      {disabled && zone === selectedZone && (
                        <p className="text-[10px] font-body text-muted-foreground mt-0.5">(votre parade)</p>
                      )}
                    </button>
                  );
                })}
              </div>
              {shieldZone && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShieldZone(null)}
                  className="text-xs h-7 px-2 text-sky-700"
                >
                  ✕ Ne pas utiliser le bouclier
                </Button>
              )}
            </div>
          )}

          {/* V6 — Récap final */}
          {selectedZone && selectedOption && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-heading font-semibold text-blue-900">📜 Récapitulatif</p>
              <p className="text-xs font-body text-blue-900">
                Vous défendez <strong>{ZONE_LABELS[selectedZone]}</strong>
                {selectedOption.item_key ? (
                  <> avec votre <strong>{ITEMS[selectedOption.item_key]?.icon} {ITEMS[selectedOption.item_key]?.name}</strong> (G{selectedOption.grade}).</>
                ) : (
                  <> à mains nues (aucune armure).</>
                )}
              </p>
              {shieldZone && (
                <p className="text-xs font-body text-sky-800">
                  Votre bouclier protège <strong>{ZONE_LABELS[shieldZone]}</strong> ({shieldPct}% d'absorption).
                </p>
              )}
              <div className="text-xs font-body text-blue-900 bg-blue-100/50 rounded px-2 py-1.5 space-y-0.5">
                <p>
                  <strong>Si l'attaquant vise {ZONE_LABELS[selectedZone]}</strong> → tentative de parade : <strong className={pctColor(selectedParryPct)}>{selectedParryPct}%</strong>. Si réussie, riposte ouverte {COMBAT_PARRY_TIMER_HOURS}h.
                </p>
                {shieldZone && (
                  <p>
                    <strong>Si l'attaquant vise {ZONE_LABELS[shieldZone]}</strong> → blocage par votre {ITEMS[optionsByZone[shieldZone].item_key]?.name || "armure (manquante)"} ({Math.round(optionsByZone[shieldZone].defense_chance * 100)}%) renforcé par bouclier ({shieldPct}%).
                  </p>
                )}
                <p>
                  <strong>Sur les autres zones</strong> → comparaison classique armure (taux selon dura) vs épée adverse (taux selon dura).
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="font-heading">Annuler</Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedZone || submitting}
              className="font-heading bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? "..." : "🛡️ Valider la défense"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
