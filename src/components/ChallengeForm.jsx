/**
 * ChallengeForm : Modal pour défier un autre joueur en combat zoné PvP.
 *
 * REFONTE V6 :
 *   - Affiche le taux de toucher de l'épée selon sa durabilité (hit_chance).
 *   - Affiche un avertissement si l'épée est dura 0 (inopérante → attaque ratée garantie).
 *   - Ajoute une mention sur les dégâts à la tête (+1 dmg si zone "head" sélectionnée).
 *
 * Conservé V5 :
 *   - Un seul slot d'arme (épée), 4 zones de défense possibles.
 *   - L'attaquant choisit la zone du corps à viser ; l'épée équipée est utilisée
 *     automatiquement (peu importe la zone).
 *   - Sans épée équipée, attaque "à mains nues" avec un score d'attaque de 0.
 */
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sword, X, ChevronRight, AlertTriangle } from "lucide-react";
import {
  COMBAT_ZONES,
  COMBAT_PARRY_TIMER_HOURS,
  COMBAT_STEAL_MAX_GOLD,
  EQUIPMENT_MAX_DURABILITY,
  isPlayerKO,
  getPlayerHP,
} from "@/lib/gameData";
import { canChallenge, getEquippedWeapon } from "@/lib/combatPvP";
import { ITEMS } from "@/lib/craftingData";
import { checkAndAwardObjective, filterTodayActiveObjectives } from "@/lib/questRewards";
import { notifyTavern } from "@/lib/tavernNotifier";

const ZONE_LABELS = { head: "Tête", torso: "Torse", arms: "Bras", legs: "Jambes" };
const ZONE_ICONS  = { head: "🪖",   torso: "🛡️",   arms: "💪",   legs: "🦵" };

export default function ChallengeForm({ attacker, target, city, onClose, onCreated, isRiposte = false, parentChallengeId = "", context = null }) {
  const [selectedZone, setSelectedZone] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [validation, setValidation] = useState({ ok: true });

  // Détermine si on est en biome ou en ville (pour les libellés et le payload)
  const biomeKey = context?.biome || null;
  const isBiomeFight = !!biomeKey;

  useEffect(() => {
    let active = true;
    async function load() {
      if (isRiposte) {
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
        // Si on est en biome, le contexte est { biome: "foret" } ; sinon, ville classique
        const ctx = isBiomeFight
          ? { city_id: null, biome: biomeKey }
          : { city_id: city?.id || attacker.city_id, biome: null };
        setValidation(canChallenge(attacker, target, mine, ctx));
      } catch (e) { console.warn("Load today challenges:", e); }
    }
    load();
    return () => { active = false; };
  }, [attacker?.id, target?.id, city?.id, isRiposte]);

  if (!attacker || !target) return null;

  // V6 — l'épée équipée enrichie de hit_chance et durability
  const weapon = getEquippedWeapon(attacker);
  const weaponDef = weapon ? ITEMS[weapon.item_key] : null;
  const hitPct = weapon ? Math.round(weapon.hit_chance * 100) : 0;
  const weaponBroken = weapon && (weapon.durability ?? 0) <= 0;

  const handleSubmit = async () => {
    if (!selectedZone) { toast.error("Choisissez une zone à attaquer."); return; }
    if (!validation.ok) { toast.error(validation.reason); return; }
    if (submitting) return; // garde-fou supplémentaire contre les double-clics

    setSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      // V6 — La protection contre les doublons est assurée par l'index unique
      // partiel côté PocketBase (idx_unique_daily_challenge) qui rejette
      // atomiquement toute tentative de création d'un 2e défi non-riposte
      // sur la même paire (attacker, defender, date). En cas de violation,
      // le catch en bas détecte l'erreur "UNIQUE constraint" et affiche un
      // message clair au joueur.

      const expiresAt = new Date(Date.now() + COMBAT_PARRY_TIMER_HOURS * 3600 * 1000).toISOString();

      await base44.entities.CombatChallenge.create({
        attacker_email: attacker.user_email,
        attacker_name:  attacker.character_name || "",
        defender_email: target.user_email,
        defender_name:  target.character_name || "",
        city_id:   isBiomeFight ? "" : (city?.id || attacker.city_id || ""),
        city_name: isBiomeFight ? "" : (city?.name || ""),
        biome:     isBiomeFight ? biomeKey : "",
        context:   isBiomeFight ? "biome" : "city",
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
        const challengeMessage = isBiomeFight
          ? `⚔️ ${attacker.character_name || "Un combattant"} a défié ${target.character_name || "un adversaire"} dans le ${biomeKey}. Que la lame trouve sa cible !`
          : `⚔️ ${attacker.character_name || "Un combattant"} a défié ${target.character_name || "un adversaire"} ${city?.name ? `à ${city.name}` : ""}. Que la lame trouve sa cible !`;
        // Pas de salle taverne pour les combats en biome (pas de ville d'origine).
        // Pour les défis en ville, message public (grande salle) car c'est un duel ouvert.
        if (!isBiomeFight && city?.id) {
          await notifyTavern({
            cityId: city.id,
            audience: "public",
            authorEmail: attacker.user_email,
            authorName: attacker.character_name || "",
            message: challengeMessage,
          });
        }
      } catch (e) { /* silent */ }

      toast.success(`⚔️ Défi lancé contre ${target.character_name || "cette cible"} !`);

      // ── Tracking quête "pvp" : compte uniquement les attaques initiées (pas les ripostes) ──
      if (!isRiposte) {
        try {
          const allPvp = await base44.entities.PlayerObjective.filter({
            player_email: attacker.user_email,
            status: "active",
            type: "pvp",
          });
          const pvpObjs = filterTodayActiveObjectives(allPvp, "pvp");
          for (const obj of pvpObjs) {
            await checkAndAwardObjective({ obj, addedQty: 1, profile: attacker, city });
          }
        } catch (e) { console.warn("[pvp quest]:", e); }
      }

      onCreated?.();
      onClose?.();
    } catch (e) {
      console.error("Create challenge:", e);
      // Détection de la violation d'index unique (parade serveur contre les doublons).
      // PocketBase renvoie un statut 400 avec un message contenant "UNIQUE constraint"
      // quand l'index idx_unique_daily_challenge bloque l'insertion. On affiche alors
      // un message clair plutôt qu'une erreur générique.
      const errMsg = String(e?.message || e?.data?.message || "");
      const isDuplicate =
        e?.status === 400 &&
        (errMsg.includes("UNIQUE") || errMsg.includes("unique") || errMsg.includes("constraint"));
      if (isDuplicate) {
        toast.error("Vous avez déjà attaqué cette cible aujourd'hui.");
        setValidation({ ok: false, reason: "Vous avez déjà attaqué cette cible aujourd'hui." });
      } else {
        toast.error("Erreur lors de la création du défi.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const targetHP = getPlayerHP(target);
  const targetKO = isPlayerKO(target);

  // Couleur du badge taux de toucher selon l'état
  const hitColor =
    hitPct === 0       ? "text-red-700 font-semibold"
    : hitPct <= 30     ? "text-orange-700 font-semibold"
    : hitPct <= 60     ? "text-amber-700"
    :                    "text-emerald-700";

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
            Combat zoné PvP {isBiomeFight ? `dans le ${biomeKey}` : (city?.name ? `à ${city.name}` : "")}
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

          {/* ── Mon arme équipée (V6 : avec taux de toucher) ── */}
          <div className="bg-card border rounded-lg p-3">
            <p className="text-xs font-heading font-semibold mb-1.5">⚔️ Votre arme</p>
            {weapon && weaponDef ? (
              <>
                <div className="flex items-center gap-2 text-sm font-body flex-wrap">
                  <span>{weaponDef.icon}</span>
                  <span className="font-heading">{weaponDef.name}</span>
                  <Badge variant="outline" className="text-xs h-5 font-body">G{weapon.grade}</Badge>
                  <Badge variant="secondary" className="text-xs h-5 font-body">+{weapon.score} atk</Badge>
                  <Badge variant="outline" className="text-xs h-5 font-body text-amber-700">
                    {Math.round(weapon.steal_pct * 100)}% vol
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs font-body">
                  <span className="text-slate-700">Durabilité :</span>
                  <span className={weaponBroken ? "text-red-700 font-semibold" : "text-slate-700"}>
                    {weapon.durability}/{EQUIPMENT_MAX_DURABILITY}
                  </span>
                  <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden max-w-[100px]">
                    <div
                      className={`h-full ${weaponBroken ? "bg-red-500" : weapon.durability <= 3 ? "bg-orange-400" : "bg-emerald-500"}`}
                      style={{ width: `${(weapon.durability / EQUIPMENT_MAX_DURABILITY) * 100}%` }}
                    />
                  </div>
                  <span className={`ml-auto ${hitColor}`}>
                    🎯 {hitPct}% toucher
                  </span>
                </div>
                {weaponBroken && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs font-body text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      Votre arme est cassée (dura 0). L'attaque ratera automatiquement.
                      Réparez-la avant de défier.
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs font-body text-amber-700 italic">
                Aucune arme équipée. Vous attaquerez à mains nues : 0% de toucher, l'attaque ratera automatiquement.
              </p>
            )}
          </div>

          {/* ── Choix de la zone du corps adverse ── */}
          <div className="space-y-2">
            <p className="text-xs font-heading font-semibold">🎯 Quelle zone du corps voulez-vous viser ?</p>
            <div className="grid grid-cols-2 gap-2">
              {COMBAT_ZONES.map(zone => {
                const isSelected = selectedZone === zone;
                const isHead = zone === "head";
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
                      {isHead && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 font-body text-red-700 border-red-300">
                          +1 dmg
                        </Badge>
                      )}
                      {isSelected && <ChevronRight className="h-4 w-4 ml-auto text-red-600" />}
                    </div>
                    {isHead && (
                      <p className="text-[10px] font-body text-red-700/80 mt-1">
                        Coup décisif : 2 dégâts si touché
                      </p>
                    )}
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
                  ? <> avec votre <strong>{weaponDef.icon} {weaponDef.name}</strong> (G{weapon.grade}, {hitPct}% de toucher).</>
                  : <> à <strong>mains nues</strong> (attaque garantie ratée).</>}
              </p>
              <p className="text-xs font-body text-amber-900">
                La cible aura {COMBAT_PARRY_TIMER_HOURS}h pour choisir sa zone de défense. Si elle pare correctement <em>et</em> que sa parade réussit, le coup est annulé et elle pourra riposter.
              </p>
              {weapon && !weaponBroken ? (
                <p className="text-xs font-body text-amber-900">
                  Si le coup passe : <strong>−{selectedZone === "head" ? 2 : 1} PV</strong> à la cible{selectedZone === "head" ? " (coup à la tête)" : ""} et jusqu'à <strong>{Math.round(weapon.steal_pct * 100)}%</strong> de son or volé (capé à {COMBAT_STEAL_MAX_GOLD}💰).
                </p>
              ) : (
                <p className="text-xs font-body text-red-800">
                  ⚠️ {weaponBroken ? "Arme cassée" : "Sans arme"} : votre attaque ratera automatiquement (jet de toucher à 0%). Le défi sera consommé pour rien.
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
