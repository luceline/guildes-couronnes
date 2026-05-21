import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import VillageView from "../components/VillageView";
import VillageMenuView from "../components/VillageMenuView";
import BuildingInfoModal from "../components/BuildingInfoModal";
import BatimentsContent from "../components/city/BatimentsContent";
import ModesIntroModal from "../components/ModesIntroModal";
import { useVillageViewMode } from "@/lib/useVillageViewMode";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { base44 } from "@/api/base44Client";
import { awardSales } from "@/lib/playerCumulators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlayerStatusBar from "../components/PlayerStatusBar";
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
// MairieShop, DecreePanel, MairieTab, MayorEventsPanel, HabitantsContent,
// ProfessionChangePanel : déplacés dans MairieContent (10/05/2026).
import HelpTooltip from "../components/HelpTooltip";
import ElectionPanel from "../components/ElectionPanel";
import WarehouseUnified from "../components/WarehouseUnified";
import ChallengeForm from "../components/ChallengeForm";
import MaireDashboard from "../components/MaireDashboard";
import MairieContent from "../components/city/MairieContent";
import { checkCityDome } from "@/lib/cauldronEffects";
import { notifyTavern } from "@/lib/tavernNotifier";
import { ITEMS as GAME_ITEMS } from "../lib/craftingData";
import { toast } from "sonner";
// REFACTO Phase 1 (09/05/2026) - Banque extraite dans son propre composant + handlers
import BankPanel from "../components/city/BankPanel";
// HabitantsContent : import retiré (10/05/2026), désormais utilisé via MairieContent.
import {
  handleSaveBankRates as bankSaveRates,
  handleRequestLoan as bankRequestLoan,
  handleRepayLoan as bankRepayLoan,
  handleBankDeposit as bankDeposit,
  handleClaimDeposit as bankClaimDeposit,
} from "@/lib/cityBankHandlers";
// REFACTO Phase 4 (10/05/2026) : extraction des states/handlers/calculs ville
// dans un hook réutilisable, en vue de drawerifier la mairie depuis VillageView.
import { useCityState } from "@/hooks/useCityState";

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
  // 11/05/2026 : préférence affichage village (carte vs menu portrait)
  const { mode: villageMode } = useVillageViewMode();

  // ─── States locaux à CityView (banque, dépôts, dôme) ───
  const [contributing, setContributing] = useState(false);
  const [depositObjectives, setDepositObjectives] = useState([]);
  const [depositT1Objectives, setDepositT1Objectives] = useState([]);
  const [sellToWarehouseAmounts, setSellToWarehouseAmounts] = useState({});
  const [mayorSatisfactionVote, setMayorSatisfactionVote] = useState(null);

  // ─── States de la mairie : déplacés dans useCityState ───
  // (cityPlayers, building, selectedAtelier, challengeTarget, routes,
  //  allCitiesForMilitary, activeCategory) — voir le hook ci-dessous

   const [taxInput, setTaxInput] = useState(null);
   const [lingotPriceInput, setLingotPriceInput] = useState(null);
   const [salaryInput, setSalaryInput] = useState(null);
   const [activeDome, setActiveDome] = useState(null); // { protected: bool, expiresAt }

  // ─── Hook ville : tous les calculs et handlers de la mairie ───
  const cityState = useCityState(profile, city, onRefresh);
  const {
    cityPlayers, routes, allCitiesForMilitary, loading,
    building, selectedAtelier, setSelectedAtelier,
    challengeTarget, setChallengeTarget,
    activeCategory, setActiveCategory,
    mayorActive, isMayor, isAdmin, isHomeCity, cityRoles,
    nbResidents, dailyMaintenance, buildingsByCategory,
    isPlayerOnline, todayStr,
    handleSetRole, handleExpel, handleBuild,
  } = cityState;
  // [villeSubTab] state retiré le 10/05/2026 (refacto MairieContent) :
  // les sous-onglets panneau/appro/urgence/metier sont désormais gérés
  // soit dans MairieContent (panneau, métier), soit dans le drawer Entrepôt
  // (appro, urgence).
  // selectedAtelier, challengeTarget, routes, allCitiesForMilitary :
  // déplacés dans useCityState (hook ci-dessus).

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

  // Note : le chargement de cityPlayers/routes/allCitiesForMilitary se fait
  // désormais dans useCityState (hook). Aucun useEffect ici.

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





  // ── Statut maire et rôles dérivés ──
  // todayStr, mayorActive, isMayor, cityRoles, isAdmin, handleSetRole :
  // déstructurés depuis useCityState (ci-dessus).
  const isPercepteur = !isMayor && cityRoles.percepteur_id === profile?.id;
  const isChefGuerre  = !isMayor && cityRoles.chef_guerre_id === profile?.id;
  const isAcheteur    = !isMayor && cityRoles.acheteur_id === profile?.id;

  const isResident = profile?.home_city_id === city?.id;

  // handleExpel : déstructuré depuis useCityState (ci-dessus).

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

  // handleBuild : déstructuré depuis useCityState (ci-dessus).

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
        ...awardSales(profile, actualGold),
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
        ...awardSales(profile, actualGold),
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

  // isHomeCity, isPlayerOnline, nbResidents, dailyMaintenance,
  // buildingsByCategory : déstructurés depuis useCityState (ci-dessus).
  const hasTavern = (city.buildings || []).some(b => b.building_type === "taverne");
  const hasComptoir = (city.buildings || []).some(b => b.building_type === "comptoir");
  const warehouse = city.warehouse || {};
  const cityTier = getCityTier(city.lingots_cumul || 0);
  const bonuses = getCityBonuses(city.lingots_cumul || 0);
  const nextTier = CITY_LEVELS.find(l => l.threshold > (city.lingots_cumul || 0));

  // --- State pour la VillageView -----------------------------------------
  const [activeTab, setActiveTab] = useState("mairie");
  const [showVillageView, setShowVillageView] = useState(true);
  const [buildingInfoTarget, setBuildingInfoTarget] = useState(null);
  // 11/05/2026 : drawer dédié pour "Gérer / Améliorer" un bâtiment depuis
  // BuildingInfoModal. Sur mobile (header masqué, pas de tabs visibles), le
  // bouton "Gérer / Améliorer" ouvre ce drawer au lieu d'essayer de basculer
  // sur un onglet inaccessible. Sur desktop, comportement inchangé.
  const [batimentsDrawerOpen, setBatimentsDrawerOpen] = useState(false);

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
    <div className="flex flex-col h-full md:h-auto md:space-y-6 pb-0 md:pb-0">
      {/* 11/05/2026 : Modale d'intro première ouverture expliquant le système
          d'auto-switch carte/menu selon orientation. S'affiche une seule fois
          par device puis disparait définitivement. */}
      <ModesIntroModal />

      {/* Vue Village (toggle en haut, affichage par défaut) */}
      {showVillageView && (
        <div className="flex flex-col flex-1 min-h-0 md:flex-none md:space-y-2">
          {/* Header titre + bouton "Vue détaillée" :
           * - Visible sur desktop : permet de basculer vers les onglets banque/sceau
           * - Caché sur mobile (10/05/2026) : le nom de ville est déjà dans la map,
           *   et la vue détaillée n'a plus de sens en mobile (tout via drawers)
           */}
          <div className="hidden md:flex items-center justify-between px-1">
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

          {villageMode === "menu" ? (
            <VillageMenuView
              profile={profile}
              city={city}
              onRefresh={onRefresh}
            />
          ) : (
            <VillageView
              profile={profile}
              city={city}
              onOpenModal={handleOpenTab}
              onShowBuildingInfo={handleShowBuildingInfo}
              onRefresh={onRefresh}
            />
          )}
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
          // 11/05/2026 : sur mobile (max-width 767px), ouvrir le drawer dédié
          // au lieu de basculer sur l'onglet "batiments" (qui n'est pas visible
          // sans header). Sur desktop, comportement classique.
          const isMobile = typeof window !== "undefined"
            && window.matchMedia("(max-width: 767px)").matches;
          if (isMobile) {
            setBatimentsDrawerOpen(true);
          } else {
            handleOpenTab("batiments");
          }
        }}
      />

      {/* Drawer "Gérer / Améliorer" pour mobile (11/05/2026) — permet d'accéder
       * à BatimentsContent sans passer par les onglets desktop. Sur mobile, ce
       * drawer s'ouvre depuis le bouton "Gérer / Améliorer" de BuildingInfoModal.
       * Si le joueur est maire, il peut construire/améliorer ici. Sinon, il
       * voit juste l'état des bâtiments (mode consultation).
       */}
      <Drawer open={batimentsDrawerOpen} onOpenChange={setBatimentsDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="font-heading">🏛️ Bâtiments — {city?.name}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 overflow-y-auto">
            <BatimentsContent
              city={city}
              profile={profile}
              isMayor={isMayor}
              isHomeCity={isHomeCity}
              buildingsByCategory={buildingsByCategory}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              handleBuild={handleBuild}
              dailyMaintenance={dailyMaintenance}
              nbResidents={nbResidents}
              building={building}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Onglets en haut — visibles uniquement quand on a basculé sur la "Vue détaillée" */}
      {!showVillageView && (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="sticky top-0 z-20 bg-background border-b">
        <TabsList className="font-heading flex-wrap h-auto gap-1 w-full justify-center rounded-none border-b-0">
          <TabsTrigger
            value="mairie"
            className={domeActive ? "shadow-lg shadow-cyan-400/60 ring-1 ring-cyan-300" : ""}
          >
            🏛️ Mairie{domeActive && <span className="ml-1">🛡️</span>}
          </TabsTrigger>
          {/* Onglets T5/Taverne retirés (10/05/2026) :
              - T5 : en refonte, plus rien à afficher
              - Taverne : drawer accessible depuis VillageView
          */}
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

        {/* Bouton raccourci Taverne retiré (10/05/2026) :
            la taverne est désormais accessible via son sprite dans VillageView */}
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

      <MairieContent
        city={city}
        profile={profile}
        homeCity={homeCity}
        cityPlayers={cityPlayers}
        isMayor={isMayor}
        mayorActive={mayorActive}
        isAdmin={isAdmin}
        isHomeCity={isHomeCity}
        routes={routes}
        allCitiesForMilitary={allCitiesForMilitary}
        cityRoles={cityRoles}
        selectedAtelier={selectedAtelier}
        setSelectedAtelier={setSelectedAtelier}
        setChallengeTarget={setChallengeTarget}
        handleSetRole={handleSetRole}
        handleExpel={handleExpel}
        isPlayerOnline={isPlayerOnline}
        buildingsByCategory={buildingsByCategory}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        handleBuild={handleBuild}
        dailyMaintenance={dailyMaintenance}
        nbResidents={nbResidents}
        building={building}
        onRefresh={onRefresh}
      />

        </TabsContent>



        {/* TabsContent T5/Taverne retirés (10/05/2026) — drawerifiés ailleurs */}

        {/* ── HABITANTS ── */}
      </Tabs>
      )}

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
