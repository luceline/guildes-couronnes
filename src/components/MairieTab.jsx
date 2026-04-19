import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
import ProfessionChangePanel from "./ProfessionChangePanel";
import DecreePanel from "./DecreePanel";
import CityArmyPanel from "./CityArmyPanel";
import ArmySupplyPanel from "./ArmySupplyPanel";
import MilitaryCampaignPanel from "./MilitaryCampaignPanel";

export default function MairieTab({ city, profile, homeCity, isMayor, mayorActive, isAdmin, onRefresh, routes = [], cities = [] }) {
  const [taxInput, setTaxInput] = useState(null);
  const [taxRateInput, setTaxRateInput] = useState(null);
  const [lingotPriceInput, setLingotPriceInput] = useState(null);
  const [salaryInput, setSalaryInput] = useState(null);
  const [salaryEnabledLocal, setSalaryEnabledLocal] = useState(!!city.resident_salary_enabled);
  // Synchroniser avec city quand onRefresh recharge les données
  useEffect(() => { setSalaryEnabledLocal(!!city.resident_salary_enabled); }, [city.resident_salary_enabled]);
  const [buyingSceau, setBuyingSceau] = useState(false);
  const salaryRef = useRef(null);

  const isHomeCity = profile.home_city_id === city.id;

  const handleBecomeMayor = async () => {
    if (!profile?.home_city_id || profile.home_city_id !== city.id) {
      toast.error("👑 Seul un enfant du pays peut prétendre à la mairie — votre cité natale vous attend.");
      return;
    }
    if (mayorActive) {
      toast.error(`${city.mayor_name} tient déjà les rênes de la cité jusqu'au ${city.mayor_until} — attendez la fin de son mandat.`);
      return;
    }
    const effectiveMayorCost = 20;
    if ((profile.gold || 0) < effectiveMayorCost) {
      toast.error(`Il vous faut ${effectiveMayorCost} 💰 pour briguer la mairie — votre bourse ne contient que ${profile.gold || 0} 💰.`);
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
    toast.success(`👑 Les clés de la cité sont vôtres ! Vous gouvernez ${city.name} jusqu'au ${untilStr} — que votre mandat soit juste et prospère.`);
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
    toast.success(`🏵️ Sceau royal acquis ! Solde : ${(profile.sceau_balance || 0) + SCEAU_VALUE}💰 (absorbe taxes et impôts).`);
    setBuyingSceau(false);
    onRefresh?.();
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="mairie">
        <TabsList className="font-heading">
          <TabsTrigger value="mairie">🏛️ Mairie</TabsTrigger>
          <TabsTrigger value="armee">⚔️ Armée</TabsTrigger>
          <TabsTrigger value="guerre">🗺️ Guerre</TabsTrigger>
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
          {isMayor && (() => {
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
          {isMayor && (
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
                   min={0}
                   max={100}
                   step={5}
                   value={taxInput ?? (city.daily_tax_per_player || 0)}
                   onChange={e => setTaxInput(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                   className="w-20 h-7 text-xs text-center text-foreground"
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
                <span className="text-xs text-red-700 font-body">Actuel : <strong>{city.tax_rate || 0}%</strong></span>
                <Input
                   type="number"
                   min={0}
                   max={100}
                   step={5}
                   value={taxRateInput ?? (city.tax_rate || 0)}
                   onChange={e => setTaxRateInput(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                   className="w-20 h-7 text-xs text-center text-foreground"
                 />
                <Button size="sm" className="h-7 text-xs font-heading"
                  onClick={async () => {
                    const val = taxRateInput ?? (city.tax_rate || 0);
                                         await base44.entities.City.update(city.id, { tax_rate: val });
                    toast.success(`🏪 Taxes marché changées à ${val}% (appliquées au reset).`);
                    setTaxRateInput(null);
                    onRefresh?.();
                  }}>
                  Valider
                </Button>
                <span className="text-xs text-red-700 font-body">(appliqué au reset — max 100%)</span>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-body text-green-900 font-semibold">🪙 Salaire résidents :</span>
                  <input type="checkbox" checked={salaryEnabledLocal} className="w-4 h-4 cursor-pointer" 
                    onChange={async () => {
                      const newVal = !salaryEnabledLocal;
                      setSalaryEnabledLocal(newVal);
                      await base44.entities.City.update(city.id, { resident_salary_enabled: newVal });
                      toast.success(newVal ? "🪙 La mairie versera désormais un salaire à ses résidents — que règne la prospérité !" : "Le salaire a été suspendu — les résidents devront compter sur leurs propres récoltes.");
                      onRefresh?.();
                    }}/>
                  <span className="text-xs font-body text-green-800 ml-1">{salaryEnabledLocal ? "Activé" : "Désactivé"}</span>
                  {salaryEnabledLocal && (
                    <>
                      <Input type="number" min={1} max={50} step={1}
                        value={salaryInput ?? (city.resident_salary || 5)}
                        onChange={e => setSalaryInput(Math.max(1, Math.min(50, parseInt(e.target.value) || 0)))}
                        className="w-16 h-7 text-xs text-center text-foreground" />
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

              <div className="flex items-center gap-2 flex-wrap bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2">
                <span className="text-xs font-body text-yellow-900 font-semibold">👑 Lingots royaux :</span>
                <span className="text-xs font-body text-yellow-800">
                  Entrepôt : <strong>{(city.warehouse || {}).lingot_royal || 0}</strong>
                  {" · "}Cumulatif prestige : <strong>{city.lingots_cumul || 0}</strong>
                </span>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 space-y-2">
                <span className="text-xs font-body text-yellow-900 font-semibold">🏛️ Prix de rachat du lingot royal :</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-body text-yellow-800 w-32">Lingot royal</span>
                  <span className="text-xs text-muted-foreground font-body">Référence : 156💰</span>
                  <Input type="number" min={1} max={500} step={1}
                    value={lingotPriceInput ?? ((city.lingot_buy_prices || {}).lingot_royal || 156)}
                    onChange={e => setLingotPriceInput(parseInt(e.target.value) || 156)}
                    className="w-20 h-7 text-xs text-center text-foreground bg-white"
                  />
                  <span className="text-xs text-muted-foreground font-body">💰</span>
                  <Button size="sm" className="h-7 text-xs font-heading"
                    onClick={async () => {
                      const val = lingotPriceInput ?? ((city.lingot_buy_prices || {}).lingot_royal || 156);
                      const newPrices = { ...(city.lingot_buy_prices || {}), lingot_royal: val };
                      await base44.entities.City.update(city.id, { lingot_buy_prices: newPrices });
                      toast.success(`Prix du lingot royal mis à jour : ${val}💰`);
                      setLingotPriceInput(null);
                      onRefresh?.();
                      }}>
                      Valider
                      </Button>
                </div>
              </div>

              <MaireOffresPanel city={city} onRefresh={onRefresh} />
            </div>
          )}
          {!isMayor && (city.daily_tax_per_player || 0) > 0 && (
            <div className="text-xs text-amber-700 font-body">
              💸 Impôt journalier : <strong>{city.daily_tax_per_player} 💰</strong> / joueur
            </div>
          )}
          {!isMayor && isHomeCity && city.resident_salary_enabled && (city.gold_treasury || 0) >= 200 && (
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
              💰 Devenir maire — 20💰 / {MAYOR_DAYS} jours
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
            <input type="number" min={0} max={100} defaultValue={city.sceaux_en_vente || 0}
              className="w-16 h-7 text-xs text-center border border-amber-300 rounded font-body text-foreground"
              onBlur={async (e) => {
                const val = Math.max(0, parseInt(e.target.value) || 0);
                await base44.entities.City.update(city.id, { sceaux_en_vente: val });
                toast.success(`🏵️ ${val} Sceau(x) royal/aux mis en vente.`);
                onRefresh?.();
              }}
            />
          </div>
        </div>
      )}



        </TabsContent>

        {/* ── ARMÉE ── */}
        <TabsContent value="armee" className="mt-4">
          <CityArmyPanel
            city={city}
            profile={profile}
            isMayor={isMayor}
            onRefresh={onRefresh}
          />
          {isMayor && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-sm font-heading font-semibold mb-3">🏰 Ravitaillement de l'armée</p>
              <ArmySupplyPanel city={city} isMayor={isMayor} onRefresh={onRefresh} />
            </div>
          )}
        </TabsContent>

        {/* ── GUERRE ── */}
        <TabsContent value="guerre" className="mt-4">
          <MilitaryCampaignPanel
            city={city}
            profile={profile}
            isMayor={isMayor}
            cities={cities}
            routes={routes}
            onRefresh={onRefresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}