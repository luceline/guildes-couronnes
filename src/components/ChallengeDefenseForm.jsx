/**
 * ChallengeDefenseForm — Modal pour défendre contre un défi PvP reçu.
 *
 * Le défenseur choisit sa zone de défense (head/torso/arms/legs).
 * Si la zone choisie correspond à celle attaquée → parade réussie, riposte ouverte 12h.
 * Sinon → combat normal (résolution score atk vs score def sur la zone visée).
 *
 * Phase 3 Option B : la zone défendue est purement tactique (pas besoin d'armure).
 * Si une armure est équipée sur la zone visée par l'attaquant, elle compte dans
 * le score de défense (sauf en cas de parade où le coup est annulé).
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, X, ChevronRight } from "lucide-react";
import {
  COMBAT_ZONES,
  COMBAT_PARRY_TIMER_HOURS,
  getDefenseScoreByZone,
  getEquippedItem,
} from "@/lib/gameData";
import { resolveCombat } from "@/lib/combatPvP";
import { ITEMS } from "@/lib/craftingData";

const ZONE_LABELS = { head: "Tête", torso: "Torse", arms: "Bras", legs: "Jambes" };
const ZONE_ICONS  = { head: "🪖",   torso: "🛡️",   arms: "💪",   legs: "🦵" };

export default function ChallengeDefenseForm({ challenge, defender, onClose, onResolved }) {
  const [selectedZone, setSelectedZone] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!challenge || !defender) return null;

  const handleSubmit = async () => {
    if (!selectedZone) { toast.error("Choisissez une zone de défense."); return; }
    setSubmitting(true);

    try {
      // Récupère les profils frais des deux côtés (l'attaquant a pu changer entre-temps)
      const freshAttacker = await base44.entities.PlayerProfile.filter({
        user_email: challenge.attacker_email
      }).then(r => r[0]);
      if (!freshAttacker) {
        toast.error("Attaquant introuvable.");
        return;
      }
      const freshDefender = await base44.entities.PlayerProfile.get(defender.id);

      // Résolution
      const { resolution, attackerUpdates, defenderUpdates } = resolveCombat(
        freshAttacker,
        freshDefender,
        {
          attack_zone: challenge.attack_zone,
          attack_weapon_key: challenge.attack_weapon_key,
          defense_zone: selectedZone,
        }
      );

      // Applique les updates atomiques
      const ops = [];
      if (Object.keys(attackerUpdates).length > 0) {
        ops.push(base44.entities.PlayerProfile.update(freshAttacker.id, attackerUpdates));
      }
      if (Object.keys(defenderUpdates).length > 0) {
        ops.push(base44.entities.PlayerProfile.update(freshDefender.id, defenderUpdates));
      }

      // Met à jour le défi
      // Si ce défi est LUI-MÊME une riposte (parent_challenge_id présent), on n'ouvre
      // pas de nouvelle fenêtre de riposte même en cas de parade : le cycle de
      // riposte s'arrête après la 1re passe d'arme. (Pas de boucle infinie.)
      const isRiposte = !!(challenge.parent_challenge_id && challenge.parent_challenge_id !== "");
      const ripostWindow = isRiposte ? null : resolution.riposte_window_until;

      ops.push(base44.entities.CombatChallenge.update(challenge.id, {
        defense_zone: selectedZone,
        status: "resolved",
        result: resolution.result,
        attack_score: resolution.attack_score,
        defense_score: resolution.defense_score,
        damage_dealt: resolution.damage_dealt,
        gold_stolen: resolution.gold_stolen,
        attacker_break_item: resolution.attacker_break_item || "",
        defender_break_item: resolution.defender_break_item || "",
        bourse_broke: !!resolution.bourse_broke,
        riposte_window_until: ripostWindow,
        resolved_at: new Date().toISOString(),
      }));

      // Log gold transaction si vol effectif
      if (resolution.gold_stolen > 0) {
        ops.push(
          base44.entities.GoldTransaction.create({
            player_email: freshAttacker.user_email,
            player_name: freshAttacker.character_name || "",
            city_id: challenge.city_id || "",
            city_name: challenge.city_name || "",
            amount: resolution.gold_stolen,
            type: "combat_pvp_gain",
            description: `Vol PvP : ${freshDefender.character_name || ""} (${ZONE_LABELS[challenge.attack_zone]})`,
          }).catch(() => {}),
          base44.entities.GoldTransaction.create({
            player_email: freshDefender.user_email,
            player_name: freshDefender.character_name || "",
            city_id: challenge.city_id || "",
            city_name: challenge.city_name || "",
            amount: -resolution.gold_stolen,
            type: "combat_pvp_loss",
            description: `Or volé par ${freshAttacker.character_name || ""}`,
          }).catch(() => {}),
        );
      }

      await Promise.all(ops);

      // Annonce taverne
      try {
        let msg;
        if (resolution.result === "parried") {
          msg = `🛡️ ${freshDefender.character_name || "Le défenseur"} a paré l'attaque de ${freshAttacker.character_name || "l'attaquant"} ! Riposte possible.`;
        } else if (resolution.result === "attacker_won") {
          msg = `⚔️ ${freshAttacker.character_name || "L'attaquant"} l'emporte sur ${freshDefender.character_name || "sa cible"} ${resolution.gold_stolen > 0 ? `et lui dérobe ${resolution.gold_stolen}💰` : ""}.`;
        } else {
          msg = `🛡️ ${freshDefender.character_name || "Le défenseur"} a repoussé l'attaque de ${freshAttacker.character_name || "son agresseur"} !`;
        }
        await base44.entities.TavernMessage.create({
          author_email: freshDefender.user_email,
          author_name: freshDefender.character_name || "",
          city_id: challenge.city_id || "",
          message: msg,
          type: "combat",
        });
      } catch (e) { /* silent */ }

      // Toast adapté
      if (resolution.result === "parried") {
        toast.success(`🛡️ Parade réussie ! Vous avez ${COMBAT_PARRY_TIMER_HOURS}h pour riposter.`);
      } else if (resolution.result === "defender_won") {
        toast.success(`🛡️ Vous avez repoussé l'attaque !`);
      } else {
        toast.error(`💔 Vous avez subi le coup. -${resolution.damage_dealt} PV${resolution.gold_stolen > 0 ? `, -${resolution.gold_stolen}💰` : ""}.`);
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

  // Affiche les armures équipées du défenseur (visible côté défenseur, normal)
  const armorByZone = {};
  for (const zone of COMBAT_ZONES) {
    const eq = getEquippedItem(defender, `${zone}_def`);
    armorByZone[zone] = {
      hasArmor: !!eq,
      itemKey: eq?.item_key || null,
      grade: eq?.grade ?? null,
      score: getDefenseScoreByZone(defender, zone),
    };
  }

  const selectedArmor = selectedZone ? armorByZone[selectedZone] : null;

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
              Choisissez la zone que vous défendez. Si vous devinez juste, le coup est paré (zéro dégât) et vous pourrez riposter dans les {COMBAT_PARRY_TIMER_HOURS}h. Sinon, l'attaquant frappera la zone qu'il a visée et votre score de défense sur CETTE zone sera comparé à son score d'attaque.
            </p>
          </div>

          {/* Choix de la zone */}
          <div className="space-y-2">
            <p className="text-xs font-heading font-semibold">🛡️ Quelle zone défendez-vous ?</p>
            <div className="grid grid-cols-2 gap-2">
              {COMBAT_ZONES.map(zone => {
                const isSelected = selectedZone === zone;
                const armor = armorByZone[zone];
                const armorDef = armor.itemKey ? ITEMS[armor.itemKey] : null;
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
                    {armor.hasArmor && armorDef ? (
                      <div className="text-xs font-body text-muted-foreground mt-1.5 flex flex-wrap items-center gap-1">
                        <span>{armorDef.icon}</span>
                        <span>{armorDef.name}</span>
                        <Badge variant="outline" className="text-xs h-4 px-1 font-body">G{armor.grade}</Badge>
                        <Badge variant="secondary" className="text-xs h-4 px-1 font-body">+{armor.score} def</Badge>
                      </div>
                    ) : (
                      <p className="text-xs font-body text-muted-foreground/70 italic mt-1.5">Aucune armure</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Récap */}
          {selectedZone && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-heading font-semibold text-blue-900">📜 Récapitulatif</p>
              <p className="text-xs font-body text-blue-900">
                Vous défendez <strong>{ZONE_LABELS[selectedZone]}</strong>.
              </p>
              <p className="text-xs font-body text-blue-900">
                Si l'attaquant vise la même zone, le coup est paré et vous pourrez riposter sous {COMBAT_PARRY_TIMER_HOURS}h.
              </p>
              <p className="text-xs font-body text-blue-900">
                Sinon, votre score de défense sur la zone qu'il vise sera comparé à son score d'attaque.
                {selectedArmor && !selectedArmor.hasArmor && " Sur cette zone vous n'avez aucune armure."}
              </p>
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
