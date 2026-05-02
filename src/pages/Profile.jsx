import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import PatchnoteModal from "../components/PatchnoteModal";
import { Badge } from "@/components/ui/badge";
import PlayerStatusBar from "../components/PlayerStatusBar";
import HelpTooltip from "../components/HelpTooltip";
import { PROFESSIONS, HOUSING, HOUSING_MAINTENANCE, getFatigueRegenInterval } from "../lib/gameData";
import { activateVacationMode, cancelVacationMode, isOnVacation, isVacationExpiringSoon } from "../lib/inactivityCheck";
import MusicPlayer from "../components/MusicPlayer";
import PlayerLevelBadge from "../components/PlayerLevelBadge";
import { toast } from "sonner";
import { logGold } from '@/lib/goldLog';



export default function Profile({ profile, city, homeCity, cities = [], onRefresh }) {
  const [upgrading, setUpgrading] = useState(false);
  const [liveCities, setLiveCities] = useState(cities);
  const [residentsPerCity, setResidentsPerCity] = useState({});
  const [liveProfile, setLiveProfile] = useState(profile);
  const [moveConfirm, setMoveConfirm] = useState(null);
  const [showPatchnote, setShowPatchnote] = useState(false); // city id en attente de confirmation

  useEffect(() => {
    setLiveCities(cities);
    const loadResidents = async () => {
      const allPlayers = await base44.entities.PlayerProfile.list("-created_date", 1000);
      const counts = {};
      cities.forEach(c => counts[c.id] = 0);
      allPlayers.forEach(p => {
        if (counts.hasOwnProperty(p.home_city_id)) counts[p.home_city_id]++;
      });
      setResidentsPerCity(counts);
    };
    loadResidents();

    const unsubscribe = base44.entities.City.subscribe((event) => {
      setLiveCities(prev => {
        if (event.type === "update") {
          return prev.map(c => c.id === event.id ? event.data : c);
        }
        return prev;
      });
    });

    const unsubscribe2 = base44.entities.PlayerProfile.subscribe((event) => {
      if (event.type === "update") {
        loadResidents();
      }
    });

    return () => {
      unsubscribe?.();
      unsubscribe2?.();
    };
  }, [cities]);

  useEffect(() => {
    setLiveProfile(profile);
  }, [profile]);

  const handleUpgradeHousing = async (level) => {
    const cost = HOUSING[level].cost;
    if ((profile.gold || 0) < cost) {
      toast.error(`Pas assez d'or ! Il vous faut ${cost} pièces.`);
      return;
    }
    setUpgrading(true);
    const updates = { housing_level: level, gold: (profile.gold || 0) - cost };
    await base44.entities.PlayerProfile.update(profile.id, updates);
    if (cost > 0) {
      await logGold(profile.user_email, profile.character_name, null, null,
        -cost, "logement", `Upgrade logement → ${HOUSING[level].name}`);
    }
    toast.success(`Logement amélioré en ${HOUSING[level].name} !`);
    setUpgrading(false);
    onRefresh?.();
  };

  const handleMove = async (newCityId) => {
    const currentHousingCost = HOUSING[profile.housing_level || "tente"].cost;
    const sellPrice = Math.floor(currentHousingCost * 0.6);

    const wasMayor = city && city.mayor_id === profile.id;
    if (wasMayor) {
      await base44.entities.City.update(city.id, {
        mayor_id: "", mayor_name: "Aucun", mayor_until: "",
      });
    }

    await base44.entities.PlayerProfile.update(profile.id, {
      city_id: newCityId,
      home_city_id: newCityId,
      housing_level: "tente",
      gold: (profile.gold || 0) + sellPrice,
      daily_tax_paid: "",
    });

    if (city) {
      await base44.entities.City.update(city.id, {
        population: Math.max((city.population || 1) - 1, 0),
      });
    }
    const newCity = cities.find(c => c.id === newCityId);
    if (newCity) {
      await base44.entities.City.update(newCity.id, {
        population: (newCity.population || 0) + 1,
      });
    }

    if (sellPrice > 0) {
      await logGold(profile.user_email, profile.character_name, null, null,
        sellPrice, "demenagement", `Vente logement (déménagement)`);
    }
    toast.success(`Déménagé ! Vous avez vendu votre logement pour ${sellPrice} or.`);
    setMoveConfirm(null);
    onRefresh?.();
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  const handleVacation = async () => {
    if (isOnVacation(profile)) {
      await cancelVacationMode(profile, onRefresh);
      toast.success("Mode vacances désactivé.");
    } else {
      await activateVacationMode(profile, onRefresh);
      toast.success("🏖️ Mode vacances activé pour 15 jours. Votre compte est protégé.");
    }
  };

  if (!profile) return null;
  const housingOrder = ["tente", "cabane", "maison", "manoir"];
  const currentIdx = housingOrder.indexOf(profile.housing_level || "tente");
  const moveTargetCity = moveConfirm ? liveCities.find(c => c.id === moveConfirm) : null;
  const sellPrice = Math.floor((HOUSING[profile.housing_level || "tente"].cost || 0) * 0.6);

  // Affichage textuel de l'intervalle de régen pour un logement
  const formatRegenInterval = (lvl) => {
    const ms = getFatigueRegenInterval(lvl);
    if (ms === 3600000) return "1h";
    if (ms === 3000000) return "50min";
    if (ms === 2400000) return "40min";
    if (ms === 1800000) return "30min";
    return `${Math.round(ms / 60000)}min`;
  };

  // Texte d'infobulle complet pour un logement
  const housingTooltip = (lvl) => {
    const h = HOUSING[lvl];
    const maint = HOUSING_MAINTENANCE[lvl] || 0;
    const interval = formatRegenInterval(lvl);
    const lines = [
      `${h.icon} ${h.name}`,
      `📦 Capacité d'inventaire : ${h.capacity} unités`,
      `🍽️ Bonus faim max : +${h.hungerBonus}`,
      `⚡ Bonus énergie max : +${h.fatigueBonus}`,
      `⏰ Régénération auto : +1 faim ou énergie aléatoire toutes les ${interval} (plafond 5/15)`,
      maint > 0
        ? `🔧 Entretien quotidien : ${maint} 💰${lvl === "manoir" ? " (-30% avec un meuble)" : ""}`
        : `🔧 Entretien : gratuit`,
    ];
    if (h.cost > 0) lines.push(`💰 Coût d'achat : ${h.cost} or (détruit, anti-inflation)`);
    return lines.join("\n\n");
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <PlayerStatusBar profile={profile} homeCity={homeCity} city={city} onRefresh={onRefresh} />

      {/* Niveau du joueur */}
      <PlayerLevelBadge profile={liveProfile} variant="full" />

      {/* Logement */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">🏠 Logement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {housingOrder.map((key, idx) => {
              const h = HOUSING[key];
              const maint = HOUSING_MAINTENANCE[key] || 0;
              const isCurrent = key === (profile.housing_level || "tente");
              const canUpgrade = idx === currentIdx + 1;
              return (
                <div
                  key={key}
                  className={`rounded-lg p-3 text-center border transition-all ${
                    isCurrent ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-3xl">{h.icon}</span>
                    <HelpTooltip text={housingTooltip(key)} side="bottom" />
                  </div>
                  <div className="font-heading text-sm font-semibold mt-1">{h.name}</div>
                  <div className="text-xs text-muted-foreground font-body space-y-0.5 mt-1">
                    <div>🍽️ +{h.hungerBonus} faim · ⚡ +{h.fatigueBonus} énergie</div>
                    <div>⏰ Régen toutes les {formatRegenInterval(key)}</div>
                    {maint > 0 && <div>🔧 Entretien : {maint} 💰/jour{key === "manoir" ? " (-30% meuble)" : ""}</div>}
                  </div>
                  {h.cost > 0 && <div className="text-xs text-amber-600 font-body mt-1 font-semibold">{h.cost} 💰 à l'achat</div>}
                  {isCurrent && <Badge className="mt-1">Actuel</Badge>}
                  {canUpgrade && !upgrading && (
                    <>
                      <Button size="sm" className="mt-2 text-xs" onClick={() => handleUpgradeHousing(key)}>
                        {`Améliorer : ${h.cost} 💰`}
                      </Button>
                      {h.cost > 0 && (
                        <p className="text-xs text-orange-600 font-body mt-1">⚠️ Ces {h.cost} 💰 sont définitivement détruits</p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>


      {/* Déménager */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">🚚 Déménager</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground font-body mb-3">
            Déménager vend votre logement actuel à 60% de sa valeur et vous installe dans une tente dans la nouvelle ville.
          </p>

          {/* Confirmation */}
          {moveConfirm && moveTargetCity && (
            <div className="mb-4 p-4 rounded-lg border-2 border-orange-300 bg-orange-50 space-y-3">
              <p className="font-heading font-semibold text-orange-900">
                ⚠️ Confirmer le déménagement vers <strong>{moveTargetCity.name}</strong> ?
              </p>
              <ul className="text-sm font-body text-orange-800 space-y-1 list-disc list-inside">
                <li>Votre logement actuel sera vendu pour <strong>{sellPrice} 💰</strong></li>
                <li>Vous repartez avec une <strong>tente</strong> dans la nouvelle ville</li>
                {city?.mayor_id === profile.id && (
                  <li className="text-red-700 font-semibold">Vous perdrez votre mandat de maire !</li>
                )}
              </ul>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-orange-600 hover:bg-orange-700 font-heading"
                  onClick={() => handleMove(moveConfirm)}
                >
                  ✅ Confirmer
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 font-heading"
                  onClick={() => setMoveConfirm(null)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {liveCities
              .filter(c => {
                const actualPop = residentsPerCity[c.id] || 0;
                const isFull = actualPop >= (c.max_population || 5);
                return c.id !== profile.home_city_id && !c.is_bot_city && !isFull;
              })
              .map(c => {
                const actualPop = residentsPerCity[c.id] || 0;
                const isSelected = moveConfirm === c.id;
                return (
                  <Button
                    key={c.id}
                    variant={isSelected ? "default" : "outline"}
                    className="justify-start font-body"
                    onClick={() => setMoveConfirm(isSelected ? null : c.id)}
                  >
                    🏘️ {c.name} ({actualPop}/{c.max_population || 5})
                  </Button>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Musique de fond */}
      <MusicPlayer />

      {/* Mode Vacances */}
      <Card className={isOnVacation(profile) ? "border-blue-300 bg-blue-50" : ""}>
        <CardHeader>
          <CardTitle className="font-heading text-lg">🏖️ Mode Vacances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isOnVacation(profile) ? (
            <>
              <div className="text-sm font-body text-blue-800">
                <p className="font-semibold">✅ Mode vacances actif</p>
                <p className="text-xs mt-1 text-blue-700">
                  Votre compte est protégé jusqu'au <strong>{new Date(profile.vacation_until).toLocaleDateString("fr-FR")}</strong>.
                  Les impôts et la suppression pour inactivité sont suspendus.
                </p>
                {isVacationExpiringSoon(profile) && (
                  <p className="text-xs mt-1 text-orange-600 font-semibold">⚠️ Votre mode vacances expire dans moins de 2 jours !</p>
                )}
              </div>
              <Button variant="outline" className="w-full font-body text-blue-700 border-blue-300" onClick={handleVacation}>
                Annuler le mode vacances
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground font-body">
                Partez l'esprit tranquille : votre personnage est mis en pause pendant <strong>15 jours maximum</strong>.
                Les impôts journaliers et la suppression pour inactivité sont suspendus.
              </p>
              <Button variant="outline" className="w-full font-body" onClick={handleVacation}>
                🏖️ Activer le mode vacances (15 jours)
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full font-body" onClick={() => setShowPatchnote(true)}>
        📜 Chroniques du royaume
      </Button>

      <Button variant="outline" className="w-full font-body" onClick={handleLogout}>
        Se déconnecter
      </Button>

      <PatchnoteModal forceOpen={showPatchnote} onClose={() => setShowPatchnote(false)} />
    </div>
  );
}
