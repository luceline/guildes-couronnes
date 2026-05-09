import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import VillageView from "../components/VillageView";
import BuildingInfoModal from "../components/BuildingInfoModal";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlayerStatusBar from "../components/PlayerStatusBar";
import DecreePanel from "../components/DecreePanel";
import {
  BUILDING_TYPES, BUILDING_CATEGORIES, ITEM_CATEGORIES,
  getBuildingCost, getBuildingLevel, getBuildingCount, canBuildMore,
  getCityDailyMaintenance, getTodayDateStr,
  MAYOR_COST_MAX, MAYOR_COST_MAX_PALAIS, MAYOR_DAYS, getCityTier, getCityBonuses, CITY_LEVELS,
  SCEAU_PRICE, SCEAU_VALUE, ADMIN_EMAILS,
  EQUIPMENT_KEYS, EQUIPMENT_MAX_DURABILITY, EQUIPMENT_DURABILITY, getCombatScore,
  COMPETITIVE_ITEMS, MAX_HUNGER,
} from "../lib/gameData";
import { logGold } from '@/lib/goldLog';
import { removeFromInventory } from '@/lib/inventoryHelpers';
import { checkAndProclamWinner } from "../lib/electionLogic";
import MairieShop from "../components/MairieShop";
// SUSPENDU le 01/05/2026 : système T5 en refonte. Import désactivé.
// import T5AttackPanel from "../components/T5AttackPanel";
import HelpTooltip from "../components/HelpTooltip";
import ElectionPanel from "../components/ElectionPanel";
import WarehouseUnified from "../components/WarehouseUnified";
import ChallengeForm from "../components/ChallengeForm";
import MairieTab from "../components/MairieTab";
import MaireDashboard from "../components/MaireDashboard";
import ProfessionChangePanel from "../components/ProfessionChangePanel";
import RoyalStatuePanel from "../components/RoyalStatuePanel";
import MayorEventsPanel from "../components/MayorEventsPanel";
import { loadActiveStatue, isStatueInCity } from "@/lib/royalStatueHelpers";
import { checkCityDome } from "@/lib/cauldronEffects";
import { notifyTavern } from "@/lib/tavernNotifier";
import { ITEMS as GAME_ITEMS } from "../lib/craftingData";
import { toast } from "sonner";
// REFACTO Phase 1 (09/05/2026) - Banque extraite dans son propre composant + handlers
import BankPanel from "../components/city/BankPanel";
// REFACTO Phase 2 (09/05/2026) - Onglet Habitants extrait
import HabitantsContent from "../components/city/HabitantsContent";
import {
  handleSaveBankRates as bankSaveRates,
  handleRequestLoan as bankRequestLoan,
  handleRepayLoan as bankRepayLoan,
  handleBankDeposit as bankDeposit,
  handleClaimDeposit as bankClaimDeposit,
} from "@/lib/cityBankHandlers";

// T1 items de l'entrepôt : indexés directement par item_key
const WAREHOUSE_T1 = [
  { key: "bois_brut",   name: "Bois brut",      icon: "🪵" },
  { key: "pierre",      name: "Pierre",          icon: "🪨" },
  { key: "minerai_fer", name: "Minerai de fer",  icon: "⚙️" },
  { key: "ble",         name: "Blé",             icon: "🌾" },
  { key: "laine_brute", name: "Laine brute",     icon: "🧶" },
  { key: "herbes",      name: "Herbes",          icon: "🌿" },
  { key: "quartz_brut", name: "Quartz brut",     icon: "🔮" },
];

// Noms affichés pour les clés entrepôt (T1 + or)
const WAREHOUSE_LABELS = {
  bois_brut:   "Bois brut",
  pierre:      "Pierre",
  minerai_fer: "Minerai de fer",
  ble:         "Blé",
  laine_brute: "Laine brute",
  herbes:      "Herbes",
  quartz_brut: "Quartz brut",
  or:          "Or",
  // T2/T3 : repris depuis GAME_ITEMS si absent
};

// Helper pour trouver un item d'inventaire par item_key
function findT1ItemInInventory(inventory, itemKey) {
  return (inventory || []).find(i => i.item_key === itemKey && i.quantity > 0);
}






export default function CityView({ profile, city, homeCity, onRefresh }) {
  const [cityPlayers, setCityPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contributing, setContributing] = useState(false);
  const [building, setBuilding] = useState(false);
  const [depositObjectives, setDepositObjectives] = useState([]);
  const [depositT1Objectives, setDepositT1Objectives] = useState([]);
  const [sellToWarehouseAmounts, setSellToWarehouseAmounts] = useState({});
  const [mayorSatisfactionVote, setMayorSatisfactionVote] = useState(null);
  const [activeCategory, setActiveCategory] = useState("logement");
  const [villeSubTab, setVilleSubTab] = useState("panneau");
  const [selectedAtelier, setSelectedAtelier] = useState(null); // id du producteur sélectionné
  const [challengeTarget, setChallengeTarget] = useState(null); // joueur à défier (ChallengeForm)
  const [routes, setRoutes] = useState([]);
  const [allCitiesForMilitary, setAllCitiesForMilitary] = useState([]);
  // États locaux inputs maire
   const [taxInput, setTaxInput] = useState(null);
   const [lingotPriceInput, setLingotPriceInput] = useState(null);
   const [salaryInput, setSalaryInput] = useState(null);
   const [activeStatue, setActiveStatue] = useState(null);
   const [activeDome, setActiveDome] = useState(null); // { protected: bool, expiresAt }

  useEffect(() => {
    let cancelled = false;
    loadActiveStatue().then(s => { if (!cancelled) setActiveStatue(s); });
    return () => { cancelled = true; };
  }, [city?.id]);

  // Charge l'état du dôme de la ville + rafraîchissement automatique toutes les 60s
  useEffect(() => {
    if (!city?.id) return;
    let cancelled = false;
    const reload = () => {
      checkCityDome(city.id).then(d => { if (!cancelled) setActiveDome(d); }).catch(() => {});
    };
    reload();
    const timer = setInterval(reload, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [city?.id]);

  // Le dôme est-il actif ET pas expiré ? (vérifie aussi expiresAt côté frontend pour réagir vite)
  const domeActive = activeDome?.protected && activeDome?.expiresAt && new Date(activeDome.expiresAt) > new Date();

  useEffect(() => {
    if (!city) return;
    async function load() {
      // Charger les joueurs présents (city_id) ET les résidents (home_city_id)
      const [presentPlayers, residentPlayers, allRoutes, allCities] = await Promise.all([
        base44.entities.PlayerProfile.filter({ city_id: city.id }, "character_name", 50),
        base44.entities.PlayerProfile.filter({ home_city_id: city.id }, "character_name", 50),
        base44.entities.TravelRoute.list(),
        base44.entities.City.list(),
      ]);
      // Mai 2026 : exclure les joueurs actuellement dans un biome ou en voyage.
      // Ils ne sont plus considérés comme "physiquement" dans la ville.
      // Cela rend impossible de les défier depuis la ville et permet le "se cacher".
      const isPhysicallyInCity = (p) => !p.is_traveling && !p.current_biome;
      const filteredPresent = (presentPlayers || []).filter(isPhysicallyInCity);
      const filteredResidents = (residentPlayers || []).filter(isPhysicallyInCity);
      // Fusionner sans doublons
      const allIds = new Set(filteredPresent.map(p => p.id));
      const merged = [...filteredPresent, ...filteredResidents.filter(p => !allIds.has(p.id))];
      setCityPlayers(merged);
      setRoutes(allRoutes);
      setAllCitiesForMilitary(allCities.filter(c => !c.is_bot_city));
      setLoading(false);
    }
    load();
  }, [city?.id]);

  // Charger les quêtes de dépôt actives du joueur
  useEffect(() => {
    if (!profile?.user_email) return;
    const todayStr = new Date().toISOString().split("T")[0];
    base44.entities.PlayerObjective.filter({
      player_email: profile.user_email,
      status: "active",
    }).then(objs => {
      const isToday = (o) => (o.created_date || o.quest_date || "").startsWith(todayStr);
      // Quêtes deposit (T2 profession, ville d'origine) : comportement existant
      setDepositObjectives((objs || []).filter(o => o.type === "deposit" && isToday(o)));
      // Quêtes deposit_t1 (n'importe quel T1 dans n'importe quel entrepôt) : nouveau
      setDepositT1Objectives((objs || []).filter(o => o.type === "deposit_t1" && isToday(o)));
    }).catch(() => {});
  }, [profile?.user_email]);

  // Recharger le vote depuis la BDD à chaque affichage de la page
  useEffect(() => {
    if (!profile?.id || !city?.id) return;
    base44.entities.City.get(city.id).then(freshCity => {
      const sat = freshCity?.mayor_satisfaction || {};
      const myVote = sat[profile.id] ?? null;
      setMayorSatisfactionVote(myVote);
    }).catch(() => {
      const sat = city?.mayor_satisfaction || {};
      const myVote = sat[profile.id] ?? null;
      setMayorSatisfactionVote(myVote);
    });
  }, [profile?.id, city?.id]);

  useEffect(() => {
    if (!city || !profile) return;
    let cancelled = false;
    checkAndProclamWinner(city, () => { if (!cancelled) onRefresh?.(); });
    return () => { cancelled = true; };
  }, [city?.id, profile?.id]);





  // ── Statut maire ──
  const todayStr = getTodayDateStr();
  const mayorActive = !!(
    city?.mayor_id &&
    city?.mayor_until &&
    city.mayor_until.length === 10 &&  // format YYYY-MM-DD
    city.mayor_until >= todayStr
  );
  const isMayor = mayorActive && city.mayor_id === profile?.id;
  // ── Rôles nommés par le maire ──
  const cityRoles = city?.city_roles || {};
  const isPercepteur = !isMayor && cityRoles.percepteur_id === profile?.id;
  const isChefGuerre  = !isMayor && cityRoles.chef_guerre_id === profile?.id;
  const isAcheteur    = !isMayor && cityRoles.acheteur_id === profile?.id;

  // ── Nommer un rôle (maire uniquement) ──
  const handleSetRole = async (role, player) => {
    const roles = { ...(city.city_roles || {}) };
    if (player) {
      roles[`${role}_id`]   = player.id;
      roles[`${role}_name`] = player.character_name;
    } else {
      delete roles[`${role}_id`];
      delete roles[`${role}_name`];
    }
    await base44.entities.City.update(city.id, { city_roles: roles });
    toast.success(player
      ? `👑 ${player.character_name} nommé(e) comme ${role === "percepteur" ? "Percepteur" : role === "chef_guerre" ? "Chef de guerre" : "Acheteur"} !`
      : `Rôle retiré.`);
    onRefresh?.();
  };
  const isAdmin = ADMIN_EMAILS.includes(profile?.user_email);

  const isResident = profile?.home_city_id === city?.id;

  // ── Expulsion d'un résident (maire uniquement) ──
  const handleExpel = async (targetPlayer) => {
    if (!isMayor) return;
    if (targetPlayer.id === profile.id) { toast.error("Vous ne pouvez pas vous expulser vous-même."); return; }
    const confirmed = window.confirm(`Expulser ${targetPlayer.character_name} de ${city.name} ? Il sera téléporté dans une ville aléatoire.`);
    if (!confirmed) return;
    const allCities = await base44.entities.City.list();
    const otherCities = allCities.filter(c => c.id !== city.id && !c.is_bot_city);
    const dest = otherCities[Math.floor(Math.random() * otherCities.length)];
    if (!dest) { toast.error("Aucune ville disponible pour l'expulsion."); return; }
    await base44.entities.PlayerProfile.update(targetPlayer.id, {
      city_id: dest.id,
      home_city_id: dest.id,
    });
    await notifyTavern({
      cityId: city.id,
      audience: "residents",
      authorName: "Garde royal",
      message: `🚫 ${targetPlayer.character_name} a été expulsé(e) de ${city.name} par ordre du maire.`,
    });
    toast.success(`${targetPlayer.character_name} a été expulsé(e) !`);
    onRefresh?.();
  };

  // ── Achat Sceau royal ──
  const [buyingSceau, setBuyingSceau] = useState(false);
  const handleBuySceau = async () => {
    const stock = city.sceaux_en_vente || 0;
    if (stock <= 0) { toast.error("Il n'y a plus de Sceaux royaux disponibles !"); return; }
    if ((profile.gold || 0) < SCEAU_PRICE) {
      toast.error(`Il vous faut ${SCEAU_PRICE}💰 pour acheter un Sceau royal (vous avez ${profile.gold || 0}💰).`);
      return;
    }
    setBuyingSceau(true);
    // L'or est détruit : ne va pas en trésorerie
    await base44.entities.PlayerProfile.update(profile.id, {
      gold: (profile.gold || 0) - SCEAU_PRICE,
      sceau_balance: (profile.sceau_balance || 0) + SCEAU_VALUE,
    });
    await base44.entities.City.update(city.id, {
      sceaux_en_vente: Math.max(0, stock - 1),
    });
    await logGold({
      profile, city,
      amount: -SCEAU_PRICE, type: "sceau_royal",
      description: `Achat Sceau royal : ${SCEAU_PRICE}💰 détruits, solde Sceau : ${(profile.sceau_balance || 0) + SCEAU_VALUE}💰`,
    });
    toast.success(`🏵️ Sceau royal acquis ! Solde : ${(profile.sceau_balance || 0) + SCEAU_VALUE}💰 (absorbe taxes et impôts).`);
    setBuyingSceau(false);
    onRefresh?.();
  };

  const handleBecomeMayor = async () => {
    if (!profile?.home_city_id || profile.home_city_id !== city.id) {
      toast.error("👑 Vous ne pouvez devenir maire que de votre ville d'origine.");
      return;
    }
    if (mayorActive) {
      toast.error(`${city.mayor_name} est déjà maire jusqu'au ${city.mayor_until}.`);
      return;
    }
    const hasPalais = (city.buildings || []).some(b => b.building_type === "palais");
    const effectiveMayorCost = MAYOR_COST_MAX;
    if ((profile.gold || 0) < effectiveMayorCost) {
      toast.error(`Il faut ${effectiveMayorCost} 💰 pour devenir maire (vous avez ${profile.gold || 0} 💰).`);
      return;
    }
    const until = new Date();
    until.setDate(until.getDate() + MAYOR_DAYS);
    const untilStr = until.toISOString().split("T")[0];

    await base44.entities.City.update(city.id, {
      mayor_id:            profile.id,
      mayor_name:          profile.character_name,
      mayor_until:         untilStr,
      gold_treasury:       (city.gold_treasury || 0) + effectiveMayorCost,
      treasury_cumulative: (city.treasury_cumulative || 0) + effectiveMayorCost,
      election_candidates: [],
      election_votes:      {},
    });
    await base44.entities.PlayerProfile.update(profile.id, {
      gold: (profile.gold || 0) - effectiveMayorCost,
    });
    await logGold(profile.user_email, profile.character_name, city.id, city.name,
      -effectiveMayorCost, "maire", `Investiture maire de ${city.name}`);
    toast.success(`👑 Vous êtes maire de ${city.name} pour ${MAYOR_DAYS} jours (jusqu'au ${untilStr}) !`);
    onRefresh?.();
  };

  const handleBuild = async (buildingKey) => {
    if (!isMayor) {
      toast.error("⚔️ Seul le maire en exercice peut construire des bâtiments.");
      return;
    }
    const bType = BUILDING_TYPES[buildingKey];
    if (!bType) return;
    if (!canBuildMore(city, buildingKey)) {
      const currentLevel = getBuildingLevel(city, buildingKey);
      if (currentLevel >= 5) {
        toast.error(`${bType.name} est déjà au niveau maximum (5).`);
      } else {
        toast.error(`Impossible de construire ${bType.name} ici.`);
      }
      return;
    }

    const currentLevel = getBuildingLevel(city, buildingKey);
    const isUpgrade = currentLevel > 0 && !bType.stackable;
    const cost = getBuildingCost(buildingKey, currentLevel);
    const warehouse = city.warehouse || {};

    for (const [res, qty] of Object.entries(cost)) {
      if ((warehouse[res] || 0) < qty) {
        toast.error(`L'entrepôt manque de ${WAREHOUSE_LABELS[res] || GAME_ITEMS[res]?.name || res} (${warehouse[res] || 0}/${qty}).`);
        return;
      }
    }

    setBuilding(true);
    const newWarehouse = { ...warehouse };
    for (const [res, qty] of Object.entries(cost)) {
      newWarehouse[res] = (newWarehouse[res] || 0) - qty;
    }

    let newBuildings;
    let newMaxPop = city.max_population || 3;

    if (isUpgrade) {
      // UPGRADE : on augmente le level du bâtiment existant (1 seul exemplaire pour les uniques)
      newBuildings = (city.buildings || []).map(b =>
        b.building_type === buildingKey
          ? { ...b, level: (b.level || 1) + 1 }
          : b
      );
      // Pas de nouveau popBonus (le bonus est déjà appliqué à la construction initiale)
    } else {
      // CONSTRUCTION : on ajoute une nouvelle entrée au tableau (niveau 1)
      newBuildings = [...(city.buildings || []), {
        building_type: buildingKey,
        name: bType.name,
        level: 1,
        built_date: getTodayDateStr(),
      }];
      // Le popBonus s'applique uniquement à la construction initiale
      if (bType.popBonus > 0) {
        newMaxPop = (city.max_population || 3) + bType.popBonus;
      }
    }

    await base44.entities.City.update(city.id, {
      warehouse: newWarehouse,
      buildings: newBuildings,
      max_population: newMaxPop,
    });

    if (isUpgrade) {
      toast.success(`🔧 ${bType.name} améliorée au niveau ${currentLevel + 1} !`);
    } else {
      toast.success(`🏗️ ${bType.name} construite ! Ressources prélevées de l'entrepôt.`);
    }
    setBuilding(false);
    onRefresh?.();
  };

  // ── Vendre des ressources à l'entrepôt (rachat par la trésorerie) ──
  // Résidents : toujours autorisés si rachat activé
  // Visiteurs : autorisés si le maire a activé le rachat (warehouse_rachat_enabled)
  const handleSellT2T3ToWarehouse = async (itemKey, qty) => {
    const offers = city.rachat_t2t3_offers || {};
    const offer = offers[itemKey];
    if (!offer || !offer.price || !offer.qty_max) {
      toast.error("La ville ne cherche pas cet item pour l'instant : revenez quand le maire aura posté une offre."); return;
    }
    const pricePerUnit = offer.price;
    const totalGold = qty * pricePerUnit;
    if ((city.gold_treasury || 0) < totalGold) {
      toast.error("🏦 La trésorerie est insuffisante."); return;
    }
    // Vérifier stock joueur
    const invItem = (profile.inventory || []).find(i => i.item_key === itemKey);
    if (!invItem || invItem.quantity < qty) {
      toast.error(`Vous n'avez pas assez de ${itemKey}.`); return;
    }
    // Vérifier quantité déjà achetée aujourd'hui
    const boughtToday = city.rachat_t2t3_bought_today || {};
    const alreadyBought = boughtToday[itemKey] || 0;
    if (alreadyBought >= offer.qty_max) {
      toast.error(`📦 La ville a déjà acheté le maximum de ${itemKey} aujourd'hui.`); return;
    }
    const actualQty = Math.min(qty, offer.qty_max - alreadyBought);
    const actualGold = actualQty * pricePerUnit;

    const newInv = removeFromInventory(profile.inventory, itemKey, actualQty);
    const newWarehouse = { ...(city.warehouse || {}), [itemKey]: ((city.warehouse?.[itemKey]) || 0) + actualQty };
    const newBought = { ...boughtToday, [itemKey]: alreadyBought + actualQty };

    await Promise.all([
      base44.entities.City.update(city.id, {
        warehouse: newWarehouse,
        gold_treasury: (city.gold_treasury || 0) - actualGold,
        rachat_t2t3_bought_today: newBought,
      }),
      base44.entities.PlayerProfile.update(profile.id, {
        gold: (profile.gold || 0) + actualGold,
        inventory: newInv,
        cumul_ventes_or: (profile.cumul_ventes_or || 0) + actualGold,
      }),
    ]);
    await logGold(profile.user_email, profile.character_name, city.id, city.name,
      actualGold, "rachat_t2t3", `Vente entrepôt T2/T3 : ${actualQty}× ${itemKey}`);
    toast.success(`✅ ${actualQty}× ${itemKey} vendus à la ville pour ${actualGold}💰 !`);
    onRefresh?.();
  };

  const handleSellToWarehouse = async (itemKey, qty) => {
    if (!mayorActive || !city.warehouse_rachat_enabled) {
      toast.error("📦 Le rachat est désactivé : le maire doit l'activer via la Mairie.");
      return;
    }
    const offers = city.rachat_t1_offers || {};
    const offer = offers[itemKey];
    if (!offer || !offer.price || !offer.qty_max) {
      toast.error("La ville ne cherche pas cet item pour l'instant : revenez quand le maire aura posté une offre."); return;
    }
    const pricePerUnit = offer.price;
    const totalGold = qty * pricePerUnit;
    if ((city.gold_treasury || 0) < totalGold) {
      toast.error("🏦 La trésorerie est insuffisante."); return;
    }
    const boughtToday = (city.rachat_t1_bought_today || {})[itemKey] || 0;
    if (boughtToday >= offer.qty_max) {
      toast.error(`📦 Quota atteint pour cet item aujourd'hui (${offer.qty_max}).`); return;
    }
    const actualQty = Math.min(qty, offer.qty_max - boughtToday);
    const actualGold = actualQty * pricePerUnit;

    // Trouver la clé d'inventaire (le itemKey ici est déjà la clé item directe)
    const invItem = (profile.inventory || []).find(i => i.item_key === itemKey);
    if (!invItem || invItem.quantity < actualQty) {
      toast.error(`Vous n'avez pas assez de ${itemKey}.`); return;
    }
    const newInv = removeFromInventory(profile.inventory, itemKey, actualQty);

    // Stocker dans l'entrepôt sous le nom de ressource correspondant
    // On utilise directement itemKey comme clé warehouse
    const newWarehouse = { ...(city.warehouse || {}), [itemKey]: ((city.warehouse?.[itemKey]) || 0) + actualQty };
    const newBoughtToday = { ...(city.rachat_t1_bought_today || {}), [itemKey]: boughtToday + actualQty };

    await Promise.all([
      base44.entities.City.update(city.id, {
        warehouse: newWarehouse,
        gold_treasury: (city.gold_treasury || 0) - actualGold,
        rachat_t1_bought_today: newBoughtToday,
      }),
      base44.entities.PlayerProfile.update(profile.id, {
        gold: (profile.gold || 0) + actualGold,
        inventory: newInv,
        cumul_ventes_or: (profile.cumul_ventes_or || 0) + actualGold,
      }),
    ]);
    await logGold(profile.user_email, profile.character_name, city.id, city.name,
      actualGold, "rachat_entrepot", `Rachat T1 : ${actualQty}× ${itemKey}`);
    toast.success(`📦 ${actualQty}× ${itemKey} vendus à la ville pour ${actualGold}💰 !`);
    if (actualQty < qty) toast(`⚠️ Quota atteint, seulement ${actualQty} vendus.`);
    onRefresh?.();
  };

  if (!profile || !city) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  const isHomeCity = profile.home_city_id === city.id;

  // Déterminer si un joueur est "en ligne" (dernier accès < 5 minutes)
  const isPlayerOnline = (player) => {
    if (!player.last_active_at) return false;
    const lastActive = new Date(player.last_active_at);
    const now = new Date();
    const minsSinceActive = (now - lastActive) / (1000 * 60);
    return minsSinceActive < 5;
  };

  const hasTavern = (city.buildings || []).some(b => b.building_type === "taverne");
  const hasComptoir = (city.buildings || []).some(b => b.building_type === "comptoir");
  const warehouse = city.warehouse || {};
  const nbResidents = cityPlayers.filter(p => p.home_city_id === city.id).length;
  const dailyMaintenance = getCityDailyMaintenance(city, nbResidents);
  const cityTier = getCityTier(city.lingots_cumul || 0);
  const bonuses = getCityBonuses(city.lingots_cumul || 0);
  const nextTier = CITY_LEVELS.find(l => l.threshold > (city.lingots_cumul || 0));

  const buildingsByCategory = {};
  for (const [key, bType] of Object.entries(BUILDING_TYPES)) {
    const cat = bType.category || "autre";
    if (!buildingsByCategory[cat]) buildingsByCategory[cat] = [];
    buildingsByCategory[cat].push({ key, ...bType });
  }

  // --- State pour la VillageView -----------------------------------------
  const [activeTab, setActiveTab] = useState("mairie");
  const [showVillageView, setShowVillageView] = useState(true);
  const [buildingInfoTarget, setBuildingInfoTarget] = useState(null);

  // Handler appelé quand un bâtiment "spécifique à la ville" est cliqué.
  // On bascule sur l'onglet correspondant dans CityView.
  const handleOpenTab = (tabValue) => {
    setActiveTab(tabValue);
    setShowVillageView(false);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  };

  // Handler appelé quand un bâtiment construit (mine, fonderie...) est cliqué.
  const handleShowBuildingInfo = (buildingType) => {
    setBuildingInfoTarget(buildingType);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Vue Village (toggle en haut, affichage par défaut) */}
      {showVillageView && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
              <span>???</span>
              <span>{city.name}</span>
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVillageView(false)}
            >
              ?? Vue détaillée
            </Button>
          </div>

          <VillageView
            profile={profile}
            city={city}
            onOpenModal={handleOpenTab}
            onShowBuildingInfo={handleShowBuildingInfo}
          />
        </div>
      )}

      {!showVillageView && (
        <div className="flex justify-end px-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVillageView(true)}
          >
            ??? Vue village
          </Button>
        </div>
      )}

      <BuildingInfoModal
        buildingType={buildingInfoTarget}
        city={city}
        open={!!buildingInfoTarget}
        onOpenChange={(o) => { if (!o) setBuildingInfoTarget(null); }}
        onManageClick={() => {
          setBuildingInfoTarget(null);
          handleOpenTab("batiments");
        }}
      />

      {/* Onglets en haut */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="sticky top-0 z-20 bg-background border-b">
        <TabsList className="font-heading flex-wrap h-auto gap-1 w-full justify-center rounded-none border-b-0">
          <TabsTrigger
            value="mairie"
            className={domeActive ? "shadow-lg shadow-cyan-400/60 ring-1 ring-cyan-300" : ""}
          >
            🏛️ Mairie{domeActive && <span className="ml-1">🛡️</span>}
          </TabsTrigger>
          <TabsTrigger
            value="gouvernance"
            className={domeActive ? "shadow-lg shadow-cyan-400/60 ring-1 ring-cyan-300" : ""}
          >
            👑 Gouvernance{domeActive && <span className="ml-1">🛡️</span>}
          </TabsTrigger>
          <TabsTrigger value="evenements">🎉 Événements</TabsTrigger>
          <TabsTrigger value="competitif">🛠️ T5 (refonte)</TabsTrigger>
          <TabsTrigger value="habitants">👥 Habitants</TabsTrigger>
          <TabsTrigger value="batiments">🏗️ Bâtiments</TabsTrigger>
{hasTavern && <TabsTrigger value="taverne">🍺 Taverne</TabsTrigger>}
{isStatueInCity(activeStatue, city?.id) && <TabsTrigger value="statue">🗿 Statue royale</TabsTrigger>}
        </TabsList>

        {/* ── MAIRIE ── */}
        <TabsContent value="mairie" className="space-y-4 mt-4">
          {/* City Header */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 via-card to-accent/10 border border-border p-6">
        <div className="relative z-10 space-y-3">

          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-heading text-2xl font-bold heading-medieval">{city.name}</h2>
            <Badge variant="outline" className="font-body">{cityTier.icon} {cityTier.label}</Badge>
            {isHomeCity && <Badge variant="secondary" className="font-body">🏠 Votre ville</Badge>}
          </div>

          <p className="text-muted-foreground font-body text-sm">{city.description}</p>

          <div className="flex flex-wrap gap-4 text-sm font-body">
            <span>💰 Taxe : <strong>{city.tax_rate}%</strong> <HelpTooltip text="Taxe payée par l'acheteur sur chaque achat au marché. Le maire peut fixer le taux du lendemain (J+1). Les taxes collectées dans la journée sont versées à la trésorerie au reset de minuit." side="bottom" /></span>
            <span>👥 {cityPlayers.filter(p => p.home_city_id === city.id).length}/{city.max_population || 3} résidents
              {cityPlayers.filter(p => p.home_city_id !== city.id).length > 0 &&
                ` · ${cityPlayers.filter(p => p.home_city_id !== city.id).length} visiteur${cityPlayers.filter(p => p.home_city_id !== city.id).length > 1 ? "s" : ""}`}
            </span>
            <span>🏗️ {(city.buildings || []).length} bâtiments</span>
            {isHomeCity && <span>🏦 Trésorerie : <strong>{city.gold_treasury || 0} 💰</strong> <HelpTooltip text="L'or accumulé dans la trésorerie sert à racheter les lingots de l'orfèvre et financer les constructions." side="bottom" /></span>}
            {isHomeCity && ((city.warehouse || {}).lingot_royal || 0) > 0 && <span>👑 Lingots royaux : <strong>{(city.warehouse || {}).lingot_royal || 0}</strong> en entrepôt (cumulatif prestige : {city.lingots_cumul || 0}) <HelpTooltip text="Les lingots royaux vendus par l'Orfèvre sont stockés dans l'entrepôt. Ils alimentent les paliers de développement et peuvent être volés par la Clé forgée ennemie." side="bottom" /></span>}
            {isHomeCity && city.contrat_noble_active && (
              <span className="text-emerald-700 font-semibold text-sm">📜 Bouclier actif <HelpTooltip text="Un Contrat Noble protège la ville : la prochaine attaque T5 ennemie sera annulée automatiquement." side="bottom" /></span>
            )}
            {!isHomeCity && <span>🏦 Trésorerie : <em className="text-muted-foreground">visible aux habitants</em></span>}
          </div>

          {(bonuses.cooldownReduction > 0 || cityTier.extraBiomeCombat > 0) && (
            <div className="flex flex-wrap gap-2">
              {bonuses.cooldownReduction > 0 && (
                <Badge variant="secondary" className="font-body text-xs">⏱️ −{bonuses.cooldownReduction}% cooldowns craft</Badge>
              )}
              {cityTier.extraBiomeCombat > 0 && (
                <Badge variant="secondary" className="font-body text-xs">⚔️ +{cityTier.extraBiomeCombat} combat biome/jour</Badge>
              )}
            </div>
          )}
          {/* ── Bonus bâtiments actifs ── */}
          {(city.buildings || []).length > 0 && (() => {
            const blds = city.buildings || [];
            const badges = [];
            if (blds.some(b => b.building_type === "hospice"))      badges.push("🏥 Plafond regen +1/niv");
            if (blds.some(b => b.building_type === "cathedrale"))   badges.push("🌟 +2 faim · +2 énergie max");
            if (blds.some(b => b.building_type === "fontaine"))     badges.push("💧 Regen ×2");
            if (blds.some(b => b.building_type === "universite"))   badges.push("🎓 +2 faim max");
            if (blds.some(b => b.building_type === "eglise"))       badges.push("⛪ 10% chance action gratuite");
            const biblio = blds.find(b => b.building_type === "bibliotheque");
            if (biblio) badges.push(`📚 +${20 + 10 * (biblio.level || 1)} capacité inv.`);
            if (blds.some(b => b.building_type === "grande_place")) badges.push("🏟️ +20 capacité inv.");
            if (blds.some(b => b.building_type === "palais"))       badges.push("👑 +1 or/j par résident");
            if (badges.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {badges.map(b => <Badge key={b} variant="outline" className="font-body text-xs text-green-700 border-green-300">{b}</Badge>)}
              </div>
            );
          })()}

          {nextTier && (
            <div className="text-xs text-muted-foreground font-body">
              Prochain niveau <strong>{nextTier.icon} {nextTier.label}</strong> dans{" "}
              <strong>{nextTier.threshold - (city.lingots_cumul || 0)} lingot{nextTier.threshold - (city.lingots_cumul || 0) > 1 ? "s" : ''}</strong> à livrer à la mairie
            </div>
          )}


        </div>

        {hasTavern && (
          <Link to="/taverne" className="absolute top-4 right-4">
            <Button size="sm" variant="secondary" className="font-heading gap-1.5">🍺 Taverne</Button>
          </Link>
        )}
      </div>

      {/* ── BANQUE DE LA VILLE ── */}
      {hasComptoir && isHomeCity && (
        <BankPanel
          city={city}
          profile={profile}
          isMayor={isMayor}
          onSaveRates={(loanRate, depositRate) => bankSaveRates({ city, onRefresh, loanRate, depositRate })}
          onRequestLoan={(amount) => bankRequestLoan({ profile, city, hasComptoir, mayorActive, onRefresh, amount })}
          onRepayLoan={(loan, idx) => bankRepayLoan({ profile, city, onRefresh, loan, idx })}
          onDeposit={(amount) => bankDeposit({ profile, city, hasComptoir, mayorActive, onRefresh, amount })}
          onClaimDeposit={(deposit, idx) => bankClaimDeposit({ profile, city, onRefresh, deposit, idx })}
        />
      )}
      {hasComptoir && !isHomeCity && (
        <div className="bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground font-body">
          🏦 Cette ville possède une banque, mais vous devez y résider pour en profiter.
        </div>
      )}

      {/* ── Sous-menu Ville ── */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "panneau",  label: "📋 Panneau" },
          { key: "appro",    label: "📦 Approvisionnement" },
          { key: "urgence",  label: "🏛️ Urgence" },
          { key: "metier",   label: "⚒️ Changer de métier" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setVilleSubTab(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-heading transition-colors border ${
              villeSubTab === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {villeSubTab === "panneau" && (
        <DecreePanel city={city} isMayor={isMayor} onRefresh={onRefresh} />
      )}

      {villeSubTab === "appro" && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              📦 Approvisionnement
              <HelpTooltip text="Déposez ou vendez des ressources à l'entrepôt communautaire. Le maire peut créer des offres de rachat depuis l'onglet Gouvernance." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WarehouseUnified
              city={city}
              profile={profile}
              isHomeCity={isHomeCity}
              contributing={contributing}
              setContributing={setContributing}
              depositObjectives={depositObjectives}
              depositT1Objectives={depositT1Objectives}
              logGold={logGold}
              onRefresh={onRefresh}
            />
          </CardContent>
        </Card>
      )}

      {villeSubTab === "urgence" && (
        <MairieShop profile={profile} city={city} onRefresh={onRefresh} />
      )}

      {villeSubTab === "metier" && isHomeCity && (
        <ProfessionChangePanel profile={profile} city={city} onRefresh={onRefresh} />
      )}
      {villeSubTab === "metier" && !isHomeCity && (
        <div className="bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground font-body">
          ⚒️ Le changement de métier est réservé aux résidents de cette ville.
        </div>
      )}

        </TabsContent>

        <TabsContent value="gouvernance" className="space-y-4 mt-4">
          <MairieTab city={city} profile={profile} homeCity={homeCity} isMayor={isMayor} mayorActive={mayorActive} isAdmin={isAdmin} onRefresh={onRefresh} routes={routes} cities={allCitiesForMilitary} cityPlayers={cityPlayers} />
        </TabsContent>

        {/* ── ÉVÉNEMENTS DE MAIRIE (Sprint 5) ── */}
        <TabsContent value="evenements" className="space-y-4 mt-4">
          <MayorEventsPanel city={city} profile={profile} isMayor={isMayor} onRefresh={onRefresh} />
        </TabsContent>

        {/* ── BÂTIMENTS ── */}
        <TabsContent value="batiments" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs text-muted-foreground font-body">Les bâtiments améliorent la vie en ville et débloquent des fonctions.</p>
            <HelpTooltip text="Seul le maire peut construire. Chaque bâtiment consomme des ressources de l'entrepôt à la construction ET chaque nuit pour son entretien. Bâtiments de production : entretien en T2 (paliers 1-4) ou T3 (palier 5). Taverne : pain T3. Sans ressources → destruction aléatoire." />
          </div>

          {(city.buildings || []).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="font-heading text-base">🏛️ Bâtiments existants</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {(city.buildings || []).map((b, idx) => {
                    const bType = BUILDING_TYPES[b.building_type];
                    const lvl = b.level || 1;
                    const isMaxLevel = lvl >= 5;
                    const canUpgrade = isMayor && !bType?.stackable && !isMaxLevel;
                    const upgradeCost = canUpgrade ? getBuildingCost(b.building_type, lvl) : null;
                    const warehouseObj = city.warehouse || {};
                    const canAfford = upgradeCost
                      ? Object.entries(upgradeCost).every(([res, qty]) => (warehouseObj[res] || 0) >= qty)
                      : false;
                    return (
                      <div key={idx} className="bg-muted/50 rounded-lg p-2.5 text-center border border-border">
                        <span className="text-xl">{bType?.icon || "🏠"}</span>
                        <div className="font-body text-xs font-semibold mt-1">{b.name}</div>
                        <div className="text-xs text-muted-foreground font-body">
                          Niv. {lvl}{isMaxLevel ? " (MAX)" : ""}
                        </div>
                        {bType?.effect && <div className="text-xs text-primary font-body mt-1">{bType.effect}</div>}
                        {canUpgrade && (
                          <div className="mt-2 space-y-1">
                            <div className="text-[10px] font-body text-muted-foreground">
                              Niv. {lvl + 1} : {Object.entries(upgradeCost).map(([res, qty]) => `${qty} ${WAREHOUSE_LABELS[res] || GAME_ITEMS[res]?.name || res}`).join(" · ")}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="font-heading text-xs h-7 w-full"
                              onClick={() => handleBuild(b.building_type)}
                              disabled={building || !canAfford}
                              title={!canAfford ? "Ressources insuffisantes dans l'entrepôt" : `Améliorer au niveau ${lvl + 1}`}
                            >
                              🔧 Améliorer
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {Object.keys(dailyMaintenance).length > 0 && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-body text-amber-800">
                    🔧 Entretien quotidien : {Object.entries(dailyMaintenance).map(([r, q]) => `${q} ${WAREHOUSE_LABELS[r] || GAME_ITEMS[r]?.name || r}`).join(" · ")}
                    <span className="ml-2 text-amber-600">({nbResidents} résident{nbResidents > 1 ? "s" : ""} : ×{(1 + 0.2 * Math.max(0, nbResidents - 1)).toFixed(1)} multiplicateur)</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(BUILDING_CATEGORIES).map(([catKey, cat]) => (
              <button
                key={catKey}
                onClick={() => setActiveCategory(catKey)}
                className={`text-xs px-3 py-1.5 rounded-full font-body border transition-colors ${
                  activeCategory === catKey
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground font-body">{BUILDING_CATEGORIES[activeCategory]?.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(buildingsByCategory[activeCategory] || []).map(bType => {
              const count = getBuildingCount(city, bType.key);
              const currentLevel = getBuildingLevel(city, bType.key);
              const cost = getBuildingCost(bType.key, currentLevel);
              const canBuild = canBuildMore(city, bType.key);
              const warehouseOk = Object.entries(cost).every(([res, qty]) => (warehouse[res] || 0) >= qty);

              return (
                <Card key={bType.key} className={`${!canBuild ? "opacity-60" : warehouseOk ? "border-green-200" : "border-border"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{bType.icon}</span>
                        <div>
                          <div className="font-heading font-semibold text-sm">{bType.name}</div>
                          {count > 0 && (
                            <Badge variant="secondary" className="text-xs font-body">
                              {count} construit{count > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {bType.unique && <Badge variant="outline" className="text-xs font-body">Unique</Badge>}
                    </div>

                    <p className="text-xs text-muted-foreground font-body mb-3">{bType.effect}</p>

                    <div className="mb-3">
                       <p className="text-xs font-body text-muted-foreground mb-1">
                         {bType.category === "production" ? (
                           <>
                             Coût {currentLevel > 0 ? `(T${currentLevel + 1}/${currentLevel >= 5 ? 5 : currentLevel + 1})` : "(T1/5)"}
                             {currentLevel >= 5 && <span className="text-green-600 font-semibold"> ✅ MAX</span>}
                           </>
                         ) : (
                           `Coût ${currentLevel > 0 ? `(Niv.${currentLevel + 1})` : ""}`
                         )}
                       </p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(cost).map(([res, qty]) => {
                          const has = warehouse[res] || 0;
                          const ok = has >= qty;
                          return (
                            <span key={res} className={`text-xs px-2 py-0.5 rounded-full border font-body ${
                              ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
                            }`}>
                              {ITEM_CATEGORIES[res]?.icon} {WAREHOUSE_LABELS[res] || GAME_ITEMS[res]?.name || res} {has}/{qty}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {Object.keys(bType.maintenance || {}).length > 0 && (
                       <p className="text-xs text-amber-700 font-body mb-3">
                         🔧 Entretien/j : {bType.category === "production" && currentLevel > 0 ? (
                           <span>
                             {Object.entries(bType.maintenance).map(([r, q]) => {
                               const mult = Math.pow(2, currentLevel - 1);
                               const label = WAREHOUSE_LABELS[r] || GAME_ITEMS[r]?.name || r;
                               return `${Math.ceil(q * mult)} ${label}`;
                             }).join(", ")} (T{currentLevel})
                           </span>
                         ) : (
                           Object.entries(bType.maintenance).map(([r, q]) =>
                             `${q} ${WAREHOUSE_LABELS[r] || GAME_ITEMS[r]?.name || r}`
                           ).join(", ")
                         )}
                       </p>
                     )}

                    {/* J'aime pour signaler l'intérêt au maire */}
                    {isHomeCity && !isMayor && canBuild && (() => {
                      const todayStr = getTodayDateStr();
                      const likes = city.building_likes || {};
                      const myLikeKey = `${bType.key}_${profile.id}_${todayStr}`;
                      const alreadyLiked = !!likes[myLikeKey];
                      const likeCount = Object.keys(likes).filter(k => k.startsWith(`${bType.key}_`) && k.endsWith(`_${todayStr}`)).length;
                      return (
                        <button
                          onClick={async () => {
                            if (alreadyLiked) return;
                            const newLikes = { ...likes, [myLikeKey]: true };
                            await base44.entities.City.update(city.id, { building_likes: newLikes });
                            toast.success(`👍 Vote enregistré pour ${bType.name} !`);
                            onRefresh?.();
                          }}
                          className={`w-full text-xs font-body rounded-md py-1 border transition-colors ${alreadyLiked ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-muted border-border hover:border-blue-300 hover:text-blue-600"}`}
                        >
                          👍 {alreadyLiked ? "Voté" : "Je veux ce bâtiment"} {likeCount > 0 ? `· ${likeCount} vote${likeCount > 1 ? "s" : ""} aujourd'hui` : ""}
                        </button>
                      );
                    })()}
                    {isMayor && (
                    <Button
                      size="sm"
                      className="w-full font-heading"
                      onClick={() => handleBuild(bType.key)}
                      disabled={building || !canBuild || !warehouseOk}
                      variant={warehouseOk && canBuild ? "default" : "outline"}
                    >
                      {!canBuild
                        ? "✅ Déjà construit (unique)"
                        : !warehouseOk
                          ? "⚠️ Entrepôt insuffisant"
                          : building ? "Construction..." : `🏗️ Construire`}
                    </Button>
                    )}
                    {!isMayor && canBuild && (
                      <p className="text-xs text-muted-foreground font-body text-center">Seul le maire peut construire</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
{hasTavern && (
  <TabsContent value="taverne" className="space-y-4 mt-4">
    <div className="text-center py-8 space-y-3">
      <div className="text-5xl">🍺</div>
      <h2 className="font-heading text-xl">La Taverne</h2>
      <p className="text-sm text-muted-foreground font-body">Retrouvez vos compagnons, échangez des nouvelles du royaume.</p>
      <Link to="/taverne">
        <Button className="font-heading gap-2">🍺 Accéder à la Taverne</Button>
      </Link>
    </div>
  </TabsContent>
)}
{/* Statue royale itinérante : visible uniquement si la statue est dans cette ville */}
{isStatueInCity(activeStatue, city?.id) && (
  <TabsContent value="statue" className="space-y-4 mt-4">
    <RoyalStatuePanel profile={profile} city={city} onRefresh={onRefresh} />
  </TabsContent>
)}
        {/* ── ITEMS COMPÉTITIFS ── */}
        {/* SUSPENDU le 01/05/2026 : système T5 en cours de refonte (équilibrage). */}
        {/* À ne pas réactiver sans avoir validé le nouveau design (effets, coûts, défenses). */}
        <TabsContent value="competitif" className="space-y-4 mt-4">
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-6 text-center space-y-3">
            <div className="text-5xl">🛠️</div>
            <h2 className="font-heading text-xl text-amber-900">Système d'attaques T5 en refonte</h2>
            <p className="text-sm font-body text-amber-800 max-w-md mx-auto">
              Les attaques inter-villes sont temporairement suspendues le temps de revoir leur équilibrage.
              Vos items T5 déjà craftés restent dans votre inventaire et seront utilisables dès le retour du système.
            </p>
            <p className="text-xs font-body text-amber-700 italic">
              Les bâtiments défensifs (Tour de guet, Caserne, Coffre-fort, Scriptorium, Entrepôt fortifié, Guilde des marchands)
              seront repensés en cohérence avec la nouvelle version.
            </p>
          </div>
        </TabsContent>

        {/* ── HABITANTS ── */}
        <TabsContent value="habitants" className="mt-4 space-y-4">
          <HabitantsContent
            cityPlayers={cityPlayers}
            city={city}
            profile={profile}
            isMayor={isMayor}
            isHomeCity={isHomeCity}
            cityRoles={cityRoles}
            selectedAtelier={selectedAtelier}
            setSelectedAtelier={setSelectedAtelier}
            setChallengeTarget={setChallengeTarget}
            onSetRole={handleSetRole}
            onExpel={handleExpel}
            onRefresh={onRefresh}
            isPlayerOnline={isPlayerOnline}
          />
        </TabsContent>
      </Tabs>

      {/* ── Modal défi PvP ── */}
      {challengeTarget && (
        <ChallengeForm
          attacker={profile}
          target={challengeTarget}
          city={city}
          onClose={() => setChallengeTarget(null)}
          onCreated={onRefresh}
        />
      )}
    </div>
  );
}
