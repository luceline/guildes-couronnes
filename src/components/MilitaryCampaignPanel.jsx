import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { logGold } from "@/lib/goldLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  UNIT_TYPES, UNIT_ORDER_BY_STRENGTH,
  computeAttackScore, computeDefenseScore,
  resolveCampaign, totalUnits,
  WAR_DECLARATION_COST,
} from "../lib/militaryData";
import MilitaryHelpModal from "./MilitaryHelpModal";
import HelpTooltip from "./HelpTooltip";

const STATUS_LABELS = {
  contributing: { label: "Levée en cours", icon: "⚒️", color: "bg-yellow-50 border-yellow-300" },
  traveling:    { label: "En marche vers l'ennemi",               icon: "🐴", color: "bg-blue-50 border-blue-300" },
  resolved:     { label: "Chroniques scellées",               icon: "✅", color: "bg-green-50 border-green-300" },
};

export default function MilitaryCampaignPanel({ city, profile, isMayor, cities, routes, onRefresh }) {
  const [campaigns, setCampaigns] = useState([]);
  const [army, setArmy] = useState(null);
  const [allArmies, setAllArmies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [declaring, setDeclaring] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [contributing, setContributing] = useState(null);
  const [contributeUnits, setContributeUnits] = useState({});
  const [now, setNow] = useState(Date.now());
  const [helpOpen, setHelpOpen] = useState(false);
  const resolving = useRef(new Set());

  // Tick toutes les 5s pour les timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { load(); }, [city.id]);

  // ── Auto-check statuts à chaque tick ──────────────────────────────────
  useEffect(() => {
    if (campaigns.length === 0) return;
    autoAdvanceCampaigns();
  }, [now, campaigns.length]);

  async function load() {
    const [allCampaigns, armies] = await Promise.all([
      base44.entities.MilitaryCampaign.list(),
      base44.entities.CityArmy.list(),
    ]);
    setCampaigns(allCampaigns);
    setAllArmies(armies);
    setArmy(armies.find(a => a.city_id === city.id) || null);
    setLoading(false);
  }

  // ── Avancement automatique des statuts ───────────────────────────────
  async function autoAdvanceCampaigns() {
    const nowMs = Date.now();
    let needsReload = false;

    for (const campaign of campaigns) {
      if (campaign.status === "resolved") continue;

      // contributing → traveling si departure_at dépassé
      if (campaign.status === "contributing" && new Date(campaign.departure_at).getTime() <= nowMs) {
        try {
          await base44.entities.MilitaryCampaign.update(campaign.id, { status: "traveling" });
          // Notification taverne ville défenderesse
          const defCity = cities.find(c => c.id === campaign.defender_city_id);
          const atkCity = cities.find(c => c.id === campaign.attacker_city_id);
          const route = routes.find(r =>
            (r.city_from_id === campaign.attacker_city_id && r.city_to_id === campaign.defender_city_id) ||
            (r.city_to_id === campaign.attacker_city_id && r.city_from_id === campaign.defender_city_id)
          );
          const arrivalMin = route?.travel_time_minutes || "?";
          await base44.entities.TavernMessage.create({
            city_id: campaign.defender_city_id,
            author_email: "system",
            author_name: "⚠️ Éclaireur",
            profession: "",
            message: `⚠️ Une armée de ${atkCity?.name || "?"} marche vers ${defCity?.name || "votre ville"} ! Arrivée dans ${arrivalMin} minutes. Renforcez la garnison !`,
          }).catch(() => {});
          needsReload = true;
        } catch (e) { console.warn("autoAdvance contributing→traveling:", e); }
      }

      // traveling → résolution si arrival_at dépassé
      if (campaign.status === "traveling" && new Date(campaign.arrival_at).getTime() <= nowMs) {
        if (!resolving.current.has(campaign.id)) {
          resolving.current.add(campaign.id);
          try {
            await handleResolve(campaign);
            needsReload = true;
          } catch (e) {
            console.warn("autoAdvance resolve:", e);
          } finally {
            resolving.current.delete(campaign.id);
          }
        }
      }
    }

    if (needsReload) await load();
  }

  // ── Getters ───────────────────────────────────────────────────────────
  const activeCampaigns = campaigns.filter(c =>
    (c.attacker_city_id === city.id || c.defender_city_id === city.id) &&
    c.status !== "resolved"
  );
  const resolvedCampaigns = campaigns.filter(c =>
    (c.attacker_city_id === city.id || c.defender_city_id === city.id) &&
    c.status === "resolved"
  ).slice(0, 5);

  // Villes attaquables : connectées par route, pas déjà sous attaque par cette ville, pas bot
  const connectedCityIds = routes
    .filter(r => r.city_from_id === city.id || r.city_to_id === city.id)
    .map(r => r.city_from_id === city.id ? r.city_to_id : r.city_from_id);

  // Villes déjà sous attaque active (par n'importe qui)
  const citiesUnderAttack = new Set(
    campaigns.filter(c => c.status !== "resolved").map(c => c.defender_city_id)
  );
  // Cette ville attaque déjà quelqu'un ?
  const alreadyAttacking = campaigns.some(
    c => c.attacker_city_id === city.id && c.status !== "resolved"
  );

  const attackableCities = cities.filter(c =>
    connectedCityIds.includes(c.id) &&
    c.id !== city.id &&
    !c.is_bot_city &&
    !citiesUnderAttack.has(c.id) // pas déjà sous attaque
  );

  function getRoute(targetCityId) {
    return routes.find(r =>
      (r.city_from_id === city.id && r.city_to_id === targetCityId) ||
      (r.city_to_id === city.id && r.city_from_id === targetCityId)
    );
  }

  function getCityName(id) {
    return cities.find(c => c.id === id)?.name || "?";
  }

  function formatTimeLeft(isoDate) {
    const ms = new Date(isoDate).getTime() - now;
    if (ms <= 0) return "Imminent...";
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  }

  // ── Déclarer une attaque ──────────────────────────────────────────────


  const handleDeclare = async () => {
    if (!selectedTarget) return;
    if (!isMayor) { toast.error("Seul le maire en exercice peut sonner le tocsin de guerre."); return; }
    if (alreadyAttacking) { toast.error("Vos armées sont déjà en marche : attendez leur retour avant de déclarer une nouvelle guerre."); return; }
    if (citiesUnderAttack.has(selectedTarget)) { toast.error("Cette cité est déjà assaillie par d'autres : patientez que la poussière retombe."); return; }

    const route = getRoute(selectedTarget);
    if (!route) { toast.error("Aucun chemin ne relie vos cités : vos soldats ne peuvent marcher vers l'inconnu."); return; }

    // Vérifier la trésorerie
    if ((city.gold_treasury || 0) < WAR_DECLARATION_COST) {
      toast.error(`Trésorerie insuffisante ! Déclarer une guerre coûte ${WAR_DECLARATION_COST}💰 (trésorerie actuelle : ${city.gold_treasury || 0}💰).`);
      return;
    }

    setDeclaring(true);
    try {
      const nowDate = new Date();
      const departureAt = new Date(nowDate.getTime() + 30 * 60 * 1000);
      const arrivalAt = new Date(departureAt.getTime() + route.travel_time_minutes * 60 * 1000);
      const returnAt = new Date(arrivalAt.getTime() + route.travel_time_minutes * 60 * 1000);

      // Prélever la taxe de guerre sur la trésorerie (or détruit)
      await base44.entities.City.update(city.id, {
        gold_treasury: (city.gold_treasury || 0) - WAR_DECLARATION_COST,
      });

      await base44.entities.MilitaryCampaign.create({
        attacker_city_id: city.id,
        defender_city_id: selectedTarget,
        status: "contributing",
        declared_at: nowDate.toISOString(),
        departure_at: departureAt.toISOString(),
        arrival_at: arrivalAt.toISOString(),
        return_at: returnAt.toISOString(),
        units_committed: {},
        contributors: [],
        result: {},
        loot: {},
      });

      // Notification dans la taverne de la ville attaquante
      await base44.entities.TavernMessage.create({
        city_id: city.id,
        author_email: "system",
        author_name: "👑 Maire",
        profession: "",
        message: `⚔️ Le maire a déclaré une attaque contre ${getCityName(selectedTarget)} (−${WAR_DECLARATION_COST}💰 trésorerie) ! Résidents, contribuez vos unités dans la Mairie → Guerre. Départ dans 30 minutes.`,
      }).catch(() => {});

      toast.success(`🥁 Le tocsin résonne ! Les portes s'ouvrent : 30 minutes pour rejoindre l'armée. (−${WAR_DECLARATION_COST}💰 trésorerie)`);
      setSelectedTarget(null);
      await load();
      onRefresh?.();
    } catch (e) {
      toast.error("Erreur lors de la déclaration.");
    } finally {
      setDeclaring(false);
    }
  };

  // ── Contribuer des unités ─────────────────────────────────────────────
  const handleContribute = async (campaign) => {
    const armyUnits = army?.units || {};
    const toContribute = {};
    let hasUnits = false;

    for (const [type, qty] of Object.entries(contributeUnits)) {
      const n = parseInt(qty) || 0;
      if (n > 0 && (armyUnits[type] || 0) >= n) {
        toContribute[type] = n;
        hasUnits = true;
      }
    }

    if (!hasUnits) { toast.error("Désignez vos guerriers avant de les envoyer au combat !"); return; }
    if (campaign.status !== "contributing") { toast.error("L'armée a déjà levé le camp : trop tard pour rejoindre les rangs."); return; }

    setContributing(campaign.id);
    try {
      // Retirer les unités de la garnison IMMÉDIATEMENT
      // (option 2 : elles sont absentes de la défense pendant la campagne)
      const newArmyUnits = { ...armyUnits };
      for (const [type, qty] of Object.entries(toContribute)) {
        newArmyUnits[type] = Math.max(0, (newArmyUnits[type] || 0) - qty);
      }
      if (army) {
        await base44.entities.CityArmy.update(army.id, { units: newArmyUnits });
      }

      // Ajouter au total engagé
      const current = campaign.units_committed || {};
      const newCommitted = { ...current };
      for (const [type, qty] of Object.entries(toContribute)) {
        newCommitted[type] = (newCommitted[type] || 0) + qty;
      }

      // Enregistrer le contributeur
      const contributors = [...(campaign.contributors || [])];
      const existingIdx = contributors.findIndex(c => c.player_email === profile.user_email);
      if (existingIdx >= 0) {
        const existing = contributors[existingIdx];
        const mergedUnits = { ...existing.units };
        for (const [type, qty] of Object.entries(toContribute)) {
          mergedUnits[type] = (mergedUnits[type] || 0) + qty;
        }
        contributors[existingIdx] = { ...existing, units: mergedUnits };
      } else {
        contributors.push({
          player_email: profile.user_email,
          player_name: profile.character_name,
          units: toContribute,
        });
      }

      await base44.entities.MilitaryCampaign.update(campaign.id, {
        units_committed: newCommitted,
        contributors,
      });

      toast.success(`⚔️ Vos guerriers ont quitté la garnison : qu'ils reviennent victorieux !`);
      setContributing(null);
      setContributeUnits({});
      await load();
    } catch (e) {
      toast.error("Erreur lors de la contribution.");
    } finally {
      setContributing(null);
    }
  };

  // ── Résoudre un combat ────────────────────────────────────────────────
  async function handleResolve(campaign) {
    const attackerCity = cities.find(c => c.id === campaign.attacker_city_id);
    const defenderCity = cities.find(c => c.id === campaign.defender_city_id);

    // Charger l'armée défenderesse en temps réel (option 2 : reflète les unités parties attaquer)
    const defenderArmies = await base44.entities.CityArmy.filter({ city_id: campaign.defender_city_id });
    const defenderArmy = defenderArmies[0] || null;

    const result = resolveCampaign(campaign, attackerCity, defenderCity, defenderArmy);
    const isVictory = ["short_victory", "victory", "net_victory", "crushing_victory"].includes(result.outcome);

    try {
      // Mettre à jour l'armée défenderesse
      if (defenderArmy) {
        await base44.entities.CityArmy.update(defenderArmy.id, { units: result.survivingDefenders });
      }

      // Retourner les survivants attaquants dans la garnison
      const attackerArmies = await base44.entities.CityArmy.filter({ city_id: campaign.attacker_city_id });
      const attackerArmy = attackerArmies[0] || null;
      if (attackerArmy) {
        const newUnits = { ...attackerArmy.units };
        for (const [type, qty] of Object.entries(result.survivingAttackers)) {
          newUnits[type] = (newUnits[type] || 0) + qty;
        }
        await base44.entities.CityArmy.update(attackerArmy.id, { units: newUnits });
      } else if (totalUnits(result.survivingAttackers) > 0) {
        // Créer la garnison si elle n'existait pas
        await base44.entities.CityArmy.create({
          city_id: campaign.attacker_city_id,
          units: result.survivingAttackers,
          last_updated: new Date().toISOString(),
        });
      }

      // Butin sur l'entrepôt défenseur
      if (isVictory && defenderCity && Object.keys(result.loot).length > 0) {
        const defWarehouse = { ...(defenderCity.warehouse || {}) };
        const atkWarehouse = { ...(attackerCity?.warehouse || {}) };
        for (const [res, qty] of Object.entries(result.loot)) {
          defWarehouse[res] = Math.max(0, (defWarehouse[res] || 0) - qty);
          atkWarehouse[res] = (atkWarehouse[res] || 0) + qty;
        }
        await base44.entities.City.update(campaign.defender_city_id, { warehouse: defWarehouse });
        if (attackerCity) {
          await base44.entities.City.update(campaign.attacker_city_id, { warehouse: atkWarehouse });
        }
      }

      // Lingots volés (option 2 : si la ville attaquante a aussi été attaquée entre-temps,
      // ses lingots ont peut-être déjà été réduits : on prend ce qui reste)
      if (isVictory && result.lingotsStolen > 0 && defenderCity) {
        const freshDefender = await base44.entities.City.filter({ id: campaign.defender_city_id }).catch(() => [defenderCity]);
        const currentLingots = (freshDefender[0] || defenderCity).lingots_cumul || 0;
        const actualStolen = Math.min(result.lingotsStolen, currentLingots);
        if (actualStolen > 0) {
          await base44.entities.City.update(campaign.defender_city_id, {
            lingots_cumul: currentLingots - actualStolen,
          });
          if (attackerCity) {
            const freshAttacker = await base44.entities.City.filter({ id: campaign.attacker_city_id }).catch(() => [attackerCity]);
            const atkLingots = (freshAttacker[0] || attackerCity).lingots_cumul || 0;
            await base44.entities.City.update(campaign.attacker_city_id, {
              lingots_cumul: atkLingots + actualStolen,
            });
          }
        }
      }

      // Récompenses contributeurs
      for (const contributor of (campaign.contributors || [])) {
        const xpGain = isVictory ? 150 : 50;
        const goldGain = isVictory ? 15 : 5;
        try {
          const players = await base44.entities.PlayerProfile.filter({ user_email: contributor.player_email });
          if (players.length > 0) {
            const p = players[0];
            await base44.entities.PlayerProfile.update(p.id, {
              player_xp_total: (p.player_xp_total || 0) + xpGain,
              gold: (p.gold || 0) + goldGain,
              cumul_t5_envoyes: (p.cumul_t5_envoyes || 0) + 1,
            });
            // V6.1.7 — Trace dans le journal d'or (récompense de la cité)
            if (goldGain > 0) {
              await logGold(
                p.user_email, p.character_name,
                campaign.attacker_city_id, getCityName(campaign.attacker_city_id),
                goldGain, "recompense_campagne",
                `Récompense campagne ${isVictory ? "victorieuse" : "perdue"}`
              );
            }
          }
        } catch (e) { console.warn("reward contributor:", e); }
      }

      // Messages taverne dans les deux villes
      const atkName = getCityName(campaign.attacker_city_id);
      const defName = getCityName(campaign.defender_city_id);
      const tavernMsg = isVictory
        ? `⚔️ ${atkName} a attaqué ${defName} : ${result.label} ! ${result.lingotsStolen > 0 ? `${result.lingotsStolen} lingot(s) pillé(s).` : ""}`
        : `🛡️ ${defName} a repoussé l'attaque de ${atkName} : ${result.label}.`;

      for (const cityId of [campaign.attacker_city_id, campaign.defender_city_id]) {
        await base44.entities.TavernMessage.create({
          city_id: cityId,
          author_email: "system",
          author_name: "⚔️ Chroniqueur de guerre",
          profession: "",
          message: tavernMsg,
        }).catch(() => {});
      }

      // Marquer comme résolu
      await base44.entities.MilitaryCampaign.update(campaign.id, {
        status: "resolved",
        result: {
          outcome: result.outcome,
          label: result.label,
          atkScore: result.atkScore,
          defScore: result.defScore,
          ratio: Math.round(result.ratio * 100) / 100,
          lingotsStolen: result.lingotsStolen,
        },
        loot: result.loot,
      });

      if (campaign.attacker_city_id === city.id || campaign.defender_city_id === city.id) {
        toast.success(`📯 Les clairons annoncent : ${result.label} !`);
      }
    } catch (e) {
      console.error("handleResolve error:", e);
      throw e;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const armyUnits = army?.units || {};

  return (
    <div className="space-y-4">

      {/* ── Header avec bouton Aide ── */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold">⚔️ Campagnes militaires</h2>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setHelpOpen(true)}>
          📖 Comprendre les combats
        </Button>
      </div>

      {helpOpen && <MilitaryHelpModal onClose={() => setHelpOpen(false)} />}

      {/* ── Campagnes actives ── */}
      {activeCampaigns.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading font-semibold text-sm">⚔️ Campagnes en cours</h3>
          {activeCampaigns.map(campaign => {
            const isAttacker = campaign.attacker_city_id === city.id;
            const otherCity = getCityName(isAttacker ? campaign.defender_city_id : campaign.attacker_city_id);
            const statusInfo = STATUS_LABELS[campaign.status] || STATUS_LABELS.contributing;
            const departureMs = new Date(campaign.departure_at).getTime() - now;
            const arrivalMs = new Date(campaign.arrival_at).getTime() - now;
            const totalTravelMs = new Date(campaign.arrival_at).getTime() - new Date(campaign.departure_at).getTime();
            const progressPct = campaign.status === "traveling"
              ? Math.min(100, Math.max(0, ((totalTravelMs - Math.max(0, arrivalMs)) / totalTravelMs) * 100))
              : 0;
            const canContributeHere = campaign.status === "contributing" && isAttacker && departureMs > 0;
            const myContrib = (campaign.contributors || []).find(c => c.player_email === profile.user_email);

            return (
              <Card key={campaign.id} className={`border-2 ${statusInfo.color}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{statusInfo.icon}</span>
                      <div>
                        <div className="font-heading font-semibold text-sm">
                          {isAttacker ? `⚔️ Attaque → ${otherCity}` : `🛡️ Défense ← ${otherCity}`}
                        </div>
                        <div className="text-xs text-muted-foreground font-body">{statusInfo.label}</div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="font-body text-xs">
                        {totalUnits(campaign.units_committed || {})} unités engagées
                      </Badge>
                      <Badge variant="outline" className="font-body text-xs">
                        {(campaign.contributors || []).length} contributeur(s)
                      </Badge>
                    </div>
                  </div>

                  {campaign.status === "contributing" && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs font-body text-yellow-800">
                      ⏳ Départ dans <strong>{formatTimeLeft(campaign.departure_at)}</strong>
                      {isAttacker && " : contribuez vos unités ci-dessous."}
                      {!isAttacker && " : renforcez la garnison via l'onglet Armée."}
                    </div>
                  )}

                  {campaign.status === "traveling" && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-body text-muted-foreground">
                        <span>{isAttacker ? `🐴 En route vers ${otherCity}` : `⚠️ Armée ennemie en approche`}</span>
                        <span>Arrivée : {formatTimeLeft(campaign.arrival_at)}</span>
                      </div>
                      <Progress value={progressPct} className="h-2" />
                    </div>
                  )}

                  {myContrib && (
                    <div className="text-xs font-body text-green-700 bg-green-50 rounded p-1.5">
                      ✅ Votre contribution : {Object.entries(myContrib.units).map(([t, q]) => `${q}× ${UNIT_TYPES[t]?.icon}`).join(" ")}
                    </div>
                  )}

                  {/* Contribution d'unités */}
                  {canContributeHere && totalUnits(armyUnits) > 0 && (
                    <div className="space-y-2 border-t border-border pt-2">
                      <p className="text-xs font-body text-muted-foreground font-semibold">
                        Envoyer des unités (retirées de la garnison immédiatement) :
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {UNIT_ORDER_BY_STRENGTH.map(type => {
                          const available = armyUnits[type] || 0;
                          if (available === 0) return null;
                          const u = UNIT_TYPES[type];
                          const current = contributeUnits[type] || 0;
                          return (
                            <div key={type} className="flex items-center gap-1 text-xs font-body bg-muted/40 rounded p-1.5">
                              <span>{u.icon}</span>
                              <span className="flex-1 truncate">{u.name} ({available})</span>
                              <div className="flex items-center gap-0.5">
                                <button className="w-5 h-5 rounded border bg-white text-center"
                                  onClick={() => setContributeUnits(q => ({ ...q, [type]: Math.max(0, (q[type] || 0) - 1) }))}>−</button>
                                <span className="w-5 text-center">{current}</span>
                                <button className="w-5 h-5 rounded border bg-white text-center"
                                  onClick={() => setContributeUnits(q => ({ ...q, [type]: Math.min(available, (q[type] || 0) + 1) }))}>+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <Button size="sm" className="w-full font-heading"
                        disabled={contributing === campaign.id}
                        onClick={() => handleContribute(campaign)}>
                        {contributing === campaign.id ? "Envoi..." : "⚔️ Envoyer les unités"}
                      </Button>
                    </div>
                  )}

                  {canContributeHere && totalUnits(armyUnits) === 0 && (
                    <div className="text-xs text-muted-foreground font-body bg-muted/30 rounded p-2 text-center">
                      Aucune unité en garnison. Recrutez dans l'onglet Armée.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Déclarer une attaque ── */}
      {isMayor && !alreadyAttacking && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base">⚔️ Déclarer une attaque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground font-body">
              Choisissez une ville cible connectée par une route. Les résidents auront 30 minutes pour contribuer des unités. Attention : les unités envoyées quittent la garnison et ne défendront pas votre ville pendant la campagne.
            </p>

            {attackableCities.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body text-center py-2">
                Aucune ville attaquable disponible (toutes sous attaque ou pas de route).
              </p>
            ) : (
              <div className="space-y-2">
                {attackableCities.map(targetCity => {
                  const route = getRoute(targetCity.id);
                  const targetArmy = allArmies.find(a => a.city_id === targetCity.id);
                  const freshTargetCity = cities.find(c => c.id === targetCity.id) || targetCity;
                  const targetDef = computeDefenseScore(targetArmy?.units || {}, freshTargetCity);
                  const myAtk = computeAttackScore(
                    army?.units || {},
                    city.lingots_cumul || 0,
                    isMayor
                  );
                  const isSelected = selectedTarget === targetCity.id;
                  const favorable = myAtk > targetDef;

                  return (
                    <div key={targetCity.id}
                      className={`rounded-lg border p-3 cursor-pointer transition-all ${isSelected ? "border-red-400 bg-red-50" : "border-border hover:border-red-200"}`}
                      onClick={() => setSelectedTarget(isSelected ? null : targetCity.id)}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <div className="font-heading font-semibold text-sm">🏰 {targetCity.name}</div>
                          <div className="text-xs text-muted-foreground font-body flex items-center gap-1.5 flex-wrap">
                            <span>⏱️ {route?.travel_time_minutes}min</span>
                            <span className="flex items-center gap-0.5">
                              🛡️ DEF : <strong>{targetDef}</strong>
                              <HelpTooltip
                                side="bottom"
                                text={`🛡️ Défense de ${targetCity.name} = ${targetDef}\n\nCalculée à partir des unités défensives, des Remparts (+20 chacun), du Palais (+15) et du palier de la ville (bonus %).\n\nSi votre armée embarque une Catapulte : DEF × 0.70.\nSi vous avez un Cavalier : la def des Archers ennemis ×1.5.\n\nCliquez sur "📖 Comprendre les combats" pour le détail complet.`}
                              />
                            </span>
                            <span className="flex items-center gap-0.5">
                              ⚔️ Mon ATK : <strong>{myAtk}</strong>
                              <HelpTooltip
                                side="bottom"
                                text={`⚔️ Attaque de votre armée = ${myAtk}\n\nCalculée à partir de la somme (atk × quantité) de chaque unité × bonus de palier de ville${isMayor ? " + 10% (vous êtes maire)" : ""}.\n\nRatio ATK/DEF = ${(myAtk / Math.max(1, targetDef)).toFixed(2)}\n${myAtk / Math.max(1, targetDef) >= 1.5 ? "✅ Issue probable : victoire nette ou écrasante." : myAtk / Math.max(1, targetDef) >= 1 ? "🟡 Issue probable : victoire courte ou défaite." : "⚠️ Issue probable : défaite probable, fortes pertes."}\n\nCliquez sur "📖 Comprendre les combats" pour le détail.`}
                              />
                            </span>
                          </div>
                        </div>
                        <Badge variant={favorable ? "default" : "destructive"} className="text-xs font-body">
                          {favorable ? "✅ Favorable" : "⚠️ Risqué"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedTarget && (
              <div className="space-y-2">
                <div className={`text-xs font-body rounded p-2 flex items-center justify-between ${(city.gold_treasury || 0) >= WAR_DECLARATION_COST ? "bg-amber-50 border border-amber-200 text-amber-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
                  <span>⚔️ Taxe de déclaration de guerre (or détruit) :</span>
                  <span className="font-bold">{WAR_DECLARATION_COST}💰 / trésorerie : {city.gold_treasury || 0}💰</span>
                </div>
                <Button className="w-full font-heading bg-red-600 hover:bg-red-700"
                  disabled={declaring || (city.gold_treasury || 0) < WAR_DECLARATION_COST}
                  onClick={handleDeclare}>
                  {declaring ? "Déclaration..." : `⚔️ Attaquer ${getCityName(selectedTarget)}`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isMayor && alreadyAttacking && (
        <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs font-body text-muted-foreground text-center">
          Vos armées sont déjà en marche : attendez leur retour avant de déclarer une nouvelle guerre. Attendez la résolution pour en lancer une nouvelle.
        </div>
      )}

      {!isMayor && activeCampaigns.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground font-body">
          Aucune campagne militaire en cours.<br />
          <span className="text-xs">Seul le maire en exercice peut sonner le tocsin de guerre.</span>
        </div>
      )}

      {/* ── Historique ── */}
      {resolvedCampaigns.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-heading font-semibold text-sm">📜 Historique récent</h3>
          {resolvedCampaigns.map(campaign => {
            const isAttacker = campaign.attacker_city_id === city.id;
            const outcome = campaign.result?.outcome || "";
            const isVictory = ["short_victory", "victory", "net_victory", "crushing_victory"].includes(outcome);
            const label = campaign.result?.label || "Résolu";
            const lingotsStolen = campaign.result?.lingotsStolen || 0;
            const won = (isAttacker && isVictory) || (!isAttacker && !isVictory);

            return (
              <div key={campaign.id}
                className={`rounded-lg border p-3 text-sm font-body ${won ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span>
                    {isAttacker ? "⚔️ →" : "🛡️ ←"}{" "}
                    <strong>{getCityName(isAttacker ? campaign.defender_city_id : campaign.attacker_city_id)}</strong>
                  </span>
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">{label}</Badge>
                    {lingotsStolen > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {isAttacker ? `+${lingotsStolen}` : `-${lingotsStolen}`} 🪙
                      </Badge>
                    )}
                    {campaign.result?.atkScore !== undefined && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        ATK {campaign.result.atkScore} vs DEF {campaign.result.defScore}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}