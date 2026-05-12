import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { logGold } from "@/lib/goldLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BUILDING_TYPES, getTodayDateStr, MAYOR_DAYS, SCEAU_PRICE, SCEAU_VALUE } from "@/lib/gameData";
import { toast } from "sonner";
import HelpTooltip from "./HelpTooltip";
import ElectionPanel from "./ElectionPanel";
import MairieShop from "./MairieShop";
import MaireOffresPanel from "./MaireOffresPanel";
import MaireDashboard from "./MaireDashboard";
import ProfessionChangePanel from "./ProfessionChangePanel";
import DecreePanel from "./DecreePanel";
// 12/05/2026 : imports militaires (CityArmyPanel, ArmySupplyPanel,
// MilitaryCampaignPanel) retirés définitivement après archivage de
// MilitaryCampaignPanel et militaryData dans _attic/. Le système militaire
// inter-villes est remplacé par la mécanique "brûler trésorerie pour tier".

export default function MairieTab({ city, profile, homeCity, isMayor, mayorActive, isAdmin, onRefresh, routes = [], cities = [], cityPlayers = [] }) {
  // ── Rôles nommés par le maire ──
  const cityRoles = city?.city_roles || {};
  const isPercepteur = !isMayor && cityRoles.percepteur_id === profile?.id;
  const isChefGuerre  = !isMayor && cityRoles.chef_guerre_id === profile?.id;
  const isAcheteur    = !isMayor && cityRoles.acheteur_id === profile?.id;
  const [taxInput, setTaxInput] = useState(null);
  const [taxRateInput, setTaxRateInput] = useState(null);
  // 11/05/2026 : state lingotPriceInput retiré (section "Prix du lingot royal" supprimée).
  const [salaryInput, setSalaryInput] = useState(null);
  const [salaryEnabledLocal, setSalaryEnabledLocal] = useState(!!city.resident_salary_enabled);
  // Synchroniser avec city quand onRefresh recharge les données
  useEffect(() => { setSalaryEnabledLocal(!!city.resident_salary_enabled); }, [city.resident_salary_enabled]);
  const [buyingSceau, setBuyingSceau] = useState(false);
  const salaryRef = useRef(null);

  const isHomeCity = profile.home_city_id === city.id;

  const handleBecomeMayor = async () => {
    if (!profile?.home_city_id || profile.home_city_id !== city.id) {
      toast.error("👑 Seul un enfant du pays peut prétendre à la mairie : votre cité natale vous attend.");
      return;
    }
    if (mayorActive) {
      toast.error(`${city.mayor_name} tient déjà les rênes de la cité jusqu'au ${city.mayor_until} : attendez la fin de son mandat.`);
      return;
    }
    const effectiveMayorCost = 20;
    if ((profile.gold || 0) < effectiveMayorCost) {
      toast.error(`Il vous faut ${effectiveMayorCost} 💰 pour briguer la mairie : votre bourse ne contient que ${profile.gold || 0} 💰.`);
      return;
    }
    const until = new Date();
    until.setDate(until.getDate() + MAYOR_DAYS);
    const untilStr = until.toISOString().split("T")[0];

    await base44.entities.City.update(city.id, {
      mayor_id: profile.id,
      mayor_name: profile.character_name,
      mayor_until: untilStr,
      gold_treasury: (city.gold_treasury || 0) + effectiveMayorCost,
      treasury_cumulative: (city.treasury_cumulative || 0) + effectiveMayorCost,
      election_candidates: [],
      election_votes: {},
    });
    await base44.entities.PlayerProfile.update(profile.id, {
      gold: (profile.gold || 0) - effectiveMayorCost,
    });

    // V6.1.7 — Trace dans le journal d'or (or va vers la trésorerie ville)
    if (effectiveMayorCost > 0) {
      await logGold(
        profile.user_email, profile.character_name,
        city.id, city.name,
        -effectiveMayorCost, "maire",
        `Investiture maire de ${city.name}`
      );
    }
    toast.success(`👑 Les clés de la cité sont vôtres ! Vous gouvernez ${city.name} jusqu'au ${untilStr} : que votre mandat soit juste et prospère.`);
    onRefresh?.();
  };

  const handleBuySceau = async () => {
    const stock = city.sceaux_en_vente || 0;
    if (stock <= 0) { toast.error("Il n'y a plus de Sceaux royaux disponibles !"); return; }
    if ((profile.gold || 0) < SCEAU_PRICE) {
      toast.error(`Il vous faut ${SCEAU_PRICE}💰 pour acheter un Sceau royal (vous avez ${profile.gold || 0}💰).`);
      return;
    }
    setBuyingSceau(true);
    await base44.entities.PlayerProfile.update(profile.id, {
      gold: (profile.gold || 0) - SCEAU_PRICE,
      sceau_balance: (profile.sceau_balance || 0) + SCEAU_VALUE,
    });
    await base44.entities.City.update(city.id, {
      sceaux_en_vente: Math.max(0, stock - 1),
    });

    // V6.1.7 — Trace dans le journal d'or (or va vers la trésorerie ville)
    await logGold(
      profile.user_email, profile.character_name,
      city.id, city.name,
      -SCEAU_PRICE, "sceau",
      `Achat sceau royal (${SCEAU_VALUE}💰 de couverture)`
    );
    toast.success(`🏵️ Sceau royal acquis ! Solde : ${(profile.sceau_balance || 0) + SCEAU_VALUE}💰 (absorbe taxes et impôts).`);
    setBuyingSceau(false);
    onRefresh?.();
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="mairie">
        <TabsList className="font-heading flex-wrap h-auto gap-1">
          <TabsTrigger value="mairie">🏛️ Mairie</TabsTrigger>
          {/* 11/05/2026 : onglets "⚔️ Armée" et "🗺️ Guerre" retirés (système militaire supprimé). */}
          {(isMayor || isAcheteur) && <TabsTrigger value="offres">🛒 Offres d'achat</TabsTrigger>}
          {(isMayor || isPercepteur || isChefGuerre) && <TabsTrigger value="dashboard">📊 Tableau de bord</TabsTrigger>}
        </TabsList>

        {/* ── MAIRIE ── */}
        <TabsContent value="mairie" className="mt-4">
      <ElectionPanel city={city} profile={profile} mayorActive={mayorActive} onRefresh={onRefresh} />

      {mayorActive ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-body">
              👑 Maire : <strong>{city.mayor_name}</strong>
              <span className="text-muted-foreground ml-1 text-xs">· mandat jusqu'au {city.mayor_until}</span>
            </span>
            {isMayor && (
              <Badge className="font-body bg-amber-500 text-white">✨ Vous êtes maire</Badge>
            )}
          </div>
          {(isMayor || isPercepteur) && (() => {
            const todayStr = getTodayDateStr();
            const likes = city.building_likes || {};
            const votesToday = {};
            Object.keys(likes).forEach(k => {
              if (k.endsWith(`_${todayStr}`)) {
                const bKey = k.split('_')[0];
                votesToday[bKey] = (votesToday[bKey] || 0) + 1;
              }
            });
            const topVotes = Object.entries(votesToday).sort((a,b) => b[1]-a[1]).slice(0, 5);
            return topVotes.length > 0 ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-2">
                <p className="text-xs font-heading font-semibold text-blue-900 mb-1">📊 Votes des habitants aujourd'hui :</p>
                <div className="flex flex-wrap gap-1.5">
                  {topVotes.map(([bKey, count]) => {
                    const bt = BUILDING_TYPES[bKey];
                    return <span key={bKey} className="text-xs bg-white border border-blue-200 rounded px-2 py-0.5 font-body">{bt?.icon} {bt?.name || bKey} · {count} vote{count > 1 ? "s" : ""}</span>;
                  })}
                </div>
              </div>
            ) : null;
          })()}
          {(isMayor || isPercepteur) && (
            <div className="space-y-2">
              <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-xs font-body text-amber-800 space-y-1">
                <p className="font-semibold">👑 Guide du maire</p>
                <p>💸 <strong>Impôt</strong> : couvre l'entretien des bâtiments (T2/T3 achetés) et finance les lingots pour progresser.</p>
                <p>💰 <strong>Salaire</strong> : reversez une partie de la trésorerie à vos habitants pour les fidéliser. S'arrête si trésorerie &lt; 200💰.</p>
                <p>🏪 <strong>Taxes</strong> : prélevées sur les achats au marché. Trop élevées = marché déserté. Trop basses = trésorerie vide.</p>
                <p>📦 <strong>Offres d'achat</strong> : manque d'une ressource ? Faites des offres aux joueurs (T1, T2, T3).</p>
                <p>⚠️ Trop d'impôts = vos habitants risquent de déménager. Discutez à la taverne pour convaincre de nouveaux résidents !</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="text-xs font-body text-amber-900">💸 Impôt journalier :</span>
                <Input
                   type="number"
                       inputMode="numeric"
                       pattern="[0-9]*"
                   min={0}
                   max={100}
                   step={5}
                   value={taxInput ?? (city.daily_tax_per_player || 0)}
                   onChange={e => setTaxInput(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                   className="w-20 h-7 text-xs text-center text-foreground"
                   onFocus={e => e.target.select()}
                 />
                <Button size="sm" className="h-7 text-xs font-heading"
                  onClick={async () => {
                    const val = taxInput ?? (city.daily_tax_per_player || 0);
                    await base44.entities.City.update(city.id, { daily_tax_per_player: val });
                    toast.success(`💸 Impôt journalier fixé à ${val} 💰/joueur/jour.`);
                    setTaxInput(null);
                    onRefresh?.();
                  }}>
                  Valider
                </Button>
                <span className="text-xs text-amber-700 font-body">💰 / joueur / jour (max 100)</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <span className="text-xs font-body text-red-900">🏪 Taxes marché :</span>
                <span className="text-xs text-red-700 font-body">
                  Actuel : <strong>{city.tax_rate || 0}%</strong>
                  {city.tax_rate_next !== undefined && city.tax_rate_next !== null && city.tax_rate_next !== city.tax_rate && (
                    <span className="ml-1.5 text-amber-700">→ J+1 : <strong>{city.tax_rate_next}%</strong></span>
                  )}
                </span>
                <Input
                   type="number"
                       inputMode="numeric"
                       pattern="[0-9]*"
                   min={0}
                   max={100}
                   step={5}
                   value={taxRateInput ?? (city.tax_rate_next ?? city.tax_rate ?? 0)}
                   onChange={e => setTaxRateInput(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                   className="w-20 h-7 text-xs text-center text-foreground"
                   onFocus={e => e.target.select()}
                 />
                <Button size="sm" className="h-7 text-xs font-heading"
                  onClick={async () => {
                    const val = taxRateInput ?? (city.tax_rate || 0);
                    // J+1 : on écrit dans tax_rate_next, le reset l'applique le lendemain
                    await base44.entities.City.update(city.id, { tax_rate_next: val });
                    toast.success(`🏪 Taxes marché : ${val}% (appliquées au reset de demain 6h UTC).`);
                    setTaxRateInput(null);
                    onRefresh?.();
                  }}>
                  Valider
                </Button>
                <span className="text-xs text-red-700 font-body">(appliqué au reset J+1 : max 100%)</span>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-body text-green-900 font-semibold">🪙 Salaire résidents :</span>
                  <input type="checkbox" checked={salaryEnabledLocal} className="w-4 h-4 cursor-pointer" 
                    onChange={async () => {
                      const newVal = !salaryEnabledLocal;
                      setSalaryEnabledLocal(newVal);
                      await base44.entities.City.update(city.id, { resident_salary_enabled: newVal });
                      toast.success(newVal ? "🪙 La mairie versera désormais un salaire à ses résidents : que règne la prospérité !" : "Le salaire a été suspendu : les résidents devront compter sur leurs propres récoltes.");
                      onRefresh?.();
                    }}/>
                  <span className="text-xs font-body text-green-800 ml-1">{salaryEnabledLocal ? "Activé" : "Désactivé"}</span>
                  {salaryEnabledLocal && (
                    <>
                      <Input type="number"
                       inputMode="numeric"
                       pattern="[0-9]*" min={1} max={50} step={1}
                        value={salaryInput ?? (city.resident_salary || 5)}
                        onChange={e => setSalaryInput(Math.max(1, Math.min(50, parseInt(e.target.value) || 0)))}
                        className="w-16 h-7 text-xs text-center text-foreground"
                        onFocus={e => e.target.select()} />
                      <span className="text-xs text-green-700 font-body">💰/résident/jour</span>
                      <Button size="sm" className="h-7 text-xs font-heading"
                        onClick={async () => {
                          const val = salaryInput ?? (city.resident_salary || 5);
                          await base44.entities.City.update(city.id, { resident_salary: val });
                          toast.success(`Salaire fixé à ${val}💰/résident/jour.`);
                          setSalaryInput(null);
                          onRefresh?.();
                        }}>
                        Valider
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* 11/05/2026 : sections "👑 Lingots royaux" et "🏛️ Prix de rachat
                  du lingot royal" retirées. L'item lingot_royal (T5) a été
                  supprimé du jeu. Le système de tier de ville sera remplacé par
                  une mécanique "brûler trésorerie" dans un patch futur (1 or = 1
                  point de prestige). En attendant, les tiers restent figés au
                  niveau atteint. */}

              {/* REFACTO 09/05/2026 - MaireOffresPanel retire ici (doublon avec onglet "offres" plus bas) */}
            </div>
          )}
          {!isMayor && !isPercepteur && (city.daily_tax_per_player || 0) > 0 && (
            <div className="text-xs text-amber-700 font-body">
              💸 Impôt journalier : <strong>{city.daily_tax_per_player} 💰</strong> / joueur
            </div>
          )}
          {!isMayor && !isPercepteur && isHomeCity && city.resident_salary_enabled && (city.gold_treasury || 0) >= 200 && (
            <div className="text-xs text-green-700 font-body">
              🪙 Salaire journalier : <strong>{city.resident_salary || 5}💰</strong> versé à chaque résident au reset
            </div>
          )}

        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground font-body">👑 Aucun maire en exercice</span>
          {profile.home_city_id === city.id ? (
            <Button size="sm" variant="outline" className="font-heading h-8 gap-1.5" onClick={handleBecomeMayor}>
              💰 Devenir maire : 20💰 / {MAYOR_DAYS} jours
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground font-body italic">
              (Réservé aux habitants d'origine de cette ville)
            </span>
          )}
        </div>
      )}

      {(city.sceaux_en_vente || 0) > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-heading font-semibold text-sm text-amber-900">🏵️ Sceau royal disponible</p>
              <p className="text-xs font-body text-amber-700">
                Absorbe automatiquement taxes marché et impôt jusqu'à épuisement.
                Achat : <strong>{SCEAU_PRICE}💰</strong> → valeur <strong>{SCEAU_VALUE}💰</strong>.
                {(city.sceaux_en_vente || 0)} restant(s).
              </p>
            </div>
            <Button size="sm" className="font-heading bg-amber-500 hover:bg-amber-600 text-white"
              disabled={buyingSceau || (profile.gold || 0) < SCEAU_PRICE}
              onClick={handleBuySceau}>
              {buyingSceau ? "Achat..." : `🏵️ Acheter (${SCEAU_PRICE}💰)`}
            </Button>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="mt-2 border-t border-amber-200 pt-2 space-y-2">
          <p className="text-xs font-heading font-semibold text-amber-900">🏵️ Événement Sceau royal (admin)</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-body text-amber-800">En vente : <strong>{city.sceaux_en_vente || 0}</strong></span>
            <input type="number"
                       inputMode="numeric"
                       pattern="[0-9]*" min={0} max={100} defaultValue={city.sceaux_en_vente || 0}
              className="w-16 h-7 text-xs text-center border border-amber-300 rounded font-body text-foreground"
              onBlur={async (e) => {
                const val = Math.max(0, parseInt(e.target.value) || 0);
                await base44.entities.City.update(city.id, { sceaux_en_vente: val });
                toast.success(`🏵️ ${val} Sceau(x) royal/aux mis en vente.`);
                onRefresh?.();
              }}
              onFocus={e => e.target.select()}
            />
          </div>
        </div>
      )}



        </TabsContent>

        {/* ── ARMÉE et GUERRE (11/05/2026) ──
            Onglets retirés, système militaire supprimé. Les combats inter-villes
            via lingots/armée sont remplacés par une mécanique économique ("brûler
            de la trésorerie pour monter les tiers") prévue dans un patch futur.
            Les défis PvP joueur-vs-joueur (combat_challenges) restent actifs. */}

        {(isMayor || isAcheteur) && (
          <TabsContent value="offres" className="mt-4">
            <MaireOffresPanel city={city} onRefresh={onRefresh} />
          </TabsContent>
        )}

        {(isMayor || isPercepteur || isChefGuerre) && (
          <TabsContent value="dashboard" className="mt-4">
            <MaireDashboard city={city} profile={profile} players={cityPlayers} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}