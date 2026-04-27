/**
 * ChallengeForm — Modal pour défier un autre joueur en combat zoné PvP.
 *
 * Phase 3 Option B : un seul slot d'arme (épée), 4 zones de défense possibles.
 * L'attaquant choisit juste la zone du corps à viser ; l'épée équipée est utilisée
 * automatiquement (peu importe la zone). Sans épée équipée, attaque "à mains nues"
 * avec un score d'attaque de 0.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sword, X, ChevronRight } from "lucide-react";
import {
  COMBAT_ZONES,
  COMBAT_PARRY_TIMER_HOURS,
  COMBAT_STEAL_MAX_GOLD,
  isPlayerKO,
  getPlayerHP,
} from "@/lib/gameData";
import { canChallenge, getEquippedWeapon } from "@/lib/combatPvP";
import { ITEMS } from "@/lib/craftingData";

const ZONE_LABELS = { head: "Tête", torso: "Torse", arms: "Bras", legs: "Jambes" };
const ZONE_ICONS  = { head: "🪖",   torso: "🛡️",   arms: "💪",   legs: "🦵" };

export default function ChallengeForm({ attacker, target, city, onClose, onCreated, isRiposte = false, parentChallengeId = "" }) {
  const [selectedZone, setSelectedZone] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [validation, setValidation] = useState({ ok: true });

  // Charge les défis du jour pour vérifier la limite 1/jour
  // Note : la riposte bypass cette limite (elle est autorisée même si on a déjà attaqué cette cible)
  useEffect(() => {
    let active = true;
    async function load() {
      if (isRiposte) {
        // Riposte : on saute la validation
        if (active) setValidation({ ok: true });
        return;
      }
      const today = new Date().toISOString().split("T")[0];
      try {
        const mine = await base44.entities.CombatChallenge.filter({
          attacker_email: attacker.user_email,
          challenge_date: today,
        }, "-created", 50);
        if (!active) return;
        const ctx = { city_id: city?.id || attacker.city_id, biome: null };
        setValidation(canChallenge(attacker, target, mine, ctx));
      } catch (e) { console.warn("Load today challenges:", e); }
    }
    load();
    return () => { active = false; };
  }, [attacker?.id, target?.id, city?.id, isRiposte]);

  if (!attacker || !target) return null;

  // L'épée équipée par l'attaquant (ou null si aucune)
  const weapon = getEquippedWeapon(attacker);
  const weaponDef = weapon ? ITEMS[weapon.item_key] : null;

  const handleSubmit = async () => {
    if (!selectedZone) { toast.error("Choisissez une zone à attaquer."); return; }
    if (!validation.ok) { toast.error(validation.reason); return; }

    setSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const expiresAt = new Date(Date.now() + COMBAT_PARRY_TIMER_HOURS * 3600 * 1000).toISOString();

      await base44.entities.CombatChallenge.create({
        attacker_email: attacker.user_email,
        attacker_name:  attacker.character_name || "",
        defender_email: target.user_email,
        defender_name:  target.character_name || "",
        city_id:   city?.id || attacker.city_id || "",
        city_name: city?.name || "",
        biome:     "",
        context:   "city",
        attack_zone: selectedZone,
        attack_weapon_key: weapon ? weapon.item_key : "",
        defense_zone: "",
        status: "pending_defense",
        result: "",
        attack_score: 0,
        defense_score: 0,
        damage_dealt: 0,
        gold_stolen: 0,
        attacker_break_item: "",
        defender_break_item: "",
        bourse_broke: false,
        riposte_window_until: null,
        resolved_at: null,
        expires_at: expiresAt,
        challenge_date: today,
        parent_challenge_id: parentChallengeId || "",
      });

      try {
        await base44.entities.TavernMessage.create({
          author_email: attacker.user_email,
          author_name:  attacker.character_name || "",
          city_id:      city?.id || "",
          message:      `⚔️ ${attacker.character_name || "Un combattant"} a défié ${target.character_name || "un adversaire"} ${city?.name ? `à ${city.name}` : ""}. Que la lame trouve sa cible !`,
          type:         "combat",
        });
      } catch (e) { /* silent */ }

      toast.success(`⚔️ Défi lancé contre ${target.character_name || "cette cible"} !`);
      onCreated?.();
      onClose?.();
    } catch (e) {
      console.error("Create challenge:", e);
      toast.error("Erreur lors de la création du défi.");
    } finally {
      setSubmitting(false);
    }
  };

  const targetHP = getPlayerHP(target);
  const targetKO = isPlayerKO(target);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-2 border-red-300 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="relative p-4 pb-3 border-b">
          <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-muted-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <h2 className="font-heading text-lg flex items-center gap-2">
            <Sword className="h-5 w-5 text-red-600" /> Défier {target.character_name || target.user_email}
          </h2>
          <p className="text-xs font-body text-muted-foreground mt-1">
            Combat zoné PvP {city?.name ? `à ${city.name}` : ""}
          </p>
        </div>

        <CardContent className="p-4 space-y-4">
          {/* ── Cible ── */}
          <div className="bg-muted/40 rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-heading font-semibold text-sm">🎯 {target.character_name}</span>
              {targetKO ? (
                <Badge className="bg-red-100 text-red-800 border-red-300 font-heading">💀 Blessé</Badge>
              ) : (
                <Badge variant="outline" className="font-heading">❤️ {targetHP} PV</Badge>
              )}
            </div>
            <p className="text-xs font-body text-muted-foreground italic">
              L'équipement et la richesse de votre adversaire vous sont inconnus. Frappez à l'aveugle.
            </p>
          </div>

          {/* ── Validation ── */}
          {!validation.ok && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs font-body text-red-800">
              ⚠️ {validation.reason}
            </div>
          )}

          {/* ── Mon arme équipée ── */}
          <div className="bg-card border rounded-lg p-3">
            <p className="text-xs font-heading font-semibold mb-1.5">⚔️ Votre arme</p>
            {weapon && weaponDef ? (
              <div className="flex items-center gap-2 text-sm font-body">
                <span>{weaponDef.icon}</span>
                <span className="font-heading">{weaponDef.name}</span>
                <Badge variant="outline" className="text-xs h-5 font-body">G{weapon.grade}</Badge>
                <Badge variant="secondary" className="text-xs h-5 font-body">+{weapon.score} atk</Badge>
                <Badge variant="outline" className="text-xs h-5 font-body text-amber-700">
                  {Math.round(weapon.steal_pct * 100)}% vol
                </Badge>
              </div>
            ) : (
              <p className="text-xs font-body text-amber-700 italic">
                Aucune arme équipée. Vous attaquerez à mains nues (score 0).
              </p>
            )}
          </div>

          {/* ── Choix de la zone du corps adverse ── */}
          <div className="space-y-2">
            <p className="text-xs font-heading font-semibold">🎯 Quelle zone du corps voulez-vous viser ?</p>
            <div className="grid grid-cols-2 gap-2">
              {COMBAT_ZONES.map(zone => {
                const isSelected = selectedZone === zone;
                return (
                  <button
                    key={zone}
                    type="button"
                    onClick={() => setSelectedZone(zone)}
                    className={`text-left rounded-lg border-2 p-3 transition-colors ${
                      isSelected
                        ? "border-red-500 bg-red-50 shadow-sm"
                        : "border-border bg-card hover:border-red-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-heading">
                      <span className="text-lg">{ZONE_ICONS[zone]}</span>
                      <span>{ZONE_LABELS[zone]}</span>
                      {isSelected && <ChevronRight className="h-4 w-4 ml-auto text-red-600" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Récap final ── */}
          {selectedZone && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-heading font-semibold text-amber-900">📜 Récapitulatif</p>
              <p className="text-xs font-body text-amber-900">
                Vous visez <strong>{ZONE_LABELS[selectedZone]}</strong>
                {weapon
                  ? <> avec votre <strong>{weaponDef.icon} {weaponDef.name}</strong> (score {weapon.score}).</>
                  : <> à <strong>mains nues</strong> (score 0).</>}
              </p>
              <p className="text-xs font-body text-amber-900">
                La cible aura {COMBAT_PARRY_TIMER_HOURS}h pour choisir sa zone de défense. Si elle pare correctement, le coup est annulé et elle pourra riposter.
              </p>
              {weapon ? (
                <p className="text-xs font-body text-amber-900">
                  Si le coup passe : -1 PV à la cible et jusqu'à <strong>{Math.round(weapon.steal_pct * 100)}%</strong> de son or volé (capé à {COMBAT_STEAL_MAX_GOLD}💰).
                </p>
              ) : (
                <p className="text-xs font-body text-amber-900">
                  ⚠️ Sans arme, vous gagnerez seulement si la cible n'a aucune armure sur cette zone (égalité 0=0). Aucun or volé même en cas de victoire.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="font-heading">Annuler</Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedZone || !validation.ok || submitting}
              className="font-heading bg-red-600 hover:bg-red-700"
            >
              {submitting ? "..." : "⚔️ Lancer le défi"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
