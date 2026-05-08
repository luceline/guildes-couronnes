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
  SCEAU_PRICE, SCEAU_VALUE, ADMIN_EMAILS, getVendeurRank, getContributeurRank, getPvpRank,
  EQUIPMENT_KEYS, EQUIPMENT_MAX_DURABILITY, EQUIPMENT_DURABILITY, getCombatScore, getAttackScore, getDefenseScore,
  COMPETITIVE_ITEMS, MAX_HUNGER,
  isPlayerKO,
} from "../lib/gameData";
import { logGold } from '@/lib/goldLog';
import { removeFromInventory } from '@/lib/inventoryHelpers';
import { checkAndProclamWinner } from "../lib/electionLogic";
import MairieShop from "../components/MairieShop";
// SUSPENDU le 01/05/2026 : système T5 en refonte. Import désactivé.
// import T5AttackPanel from "../components/T5AttackPanel";
import HelpTooltip from "../components/HelpTooltip";
import ElectionPanel from "../components/ElectionPanel";
import MaireOffresPanel from "../components/MaireOffresPanel";
import WarehouseUnified from "../components/WarehouseUnified";
import AtelierCommande from "../components/AtelierCommande";
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


// ── Composant Banque de la ville ──
function BankPanel({ city, profile, isMayor, onSaveRates, onRequestLoan, onRepayLoan, onDeposit, onClaimDeposit }) {
  const [loanRate, setLoanRate] = useState(city.loan_rate || 0);
  const [depositRate, setDepositRate] = useState(city.deposit_rate || 0);
  const [loanAmount, setLoanAmount] = useState(100);
  const [depositAmount, setDepositAmount] = useState(50);
  const [saving, setSaving] = useState(false);

  const now = new Date().toISOString().split("T")[0];
  const activeLoans = (profile.active_loans || []).filter(l => l.city_id === city.id && l.status === "active");
  const activeDeposits = (profile.active_deposits || []).filter(d => d.city_id === city.id && d.status === "active");
  const mayorActive = !!(city.mayor_id && city.mayor_until && city.mayor_until >= now);

  return (
    <div className="rounded-xl border border-yellow-200 bg-yellow-50/20 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🏦</span>
        <h3 className="font-heading font-semibold text-base">Banque de {city.name}</h3>
        <span className="text-xs text-muted-foreground font-body">· Trésorerie : {city.gold_treasury || 0} 💰</span>
      </div>

      {/* ── Panneau maire : fixer les taux ── */}
      {isMayor && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
          <p className="text-xs font-body font-semibold text-amber-900">👑 Paramètres bancaires (maire)</p>
          <p className="text-xs text-muted-foreground font-body italic">
            La taxe marché se fixe depuis l'onglet <strong>Mairie → Gouvernance</strong>.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-body text-muted-foreground">Taux prêt (%) : 0 = désactivé</label>
              <div className="flex items-center gap-1">
                <input type="number" min={0} max={50} value={loanRate}
                  onChange={e => setLoanRate(Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
                  className="w-16 h-7 text-xs text-center border border-input rounded-md bg-background px-2"
                  onFocus={e => e.target.select()} />
                <span className="text-xs text-muted-foreground">% / 7j</span>
              </div>
              <p className="text-xs text-muted-foreground font-body">Ex: 100 or → remb. {100 + Math.floor(100 * loanRate / 100)} or</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-body text-muted-foreground">Taux dépôt (%) : 0 = désactivé</label>
              <div className="flex items-center gap-1">
                <input type="number" min={0} max={30} value={depositRate}
                  onChange={e => setDepositRate(Math.max(0, Math.min(30, parseInt(e.target.value) || 0)))}
                  className="w-16 h-7 text-xs text-center border border-input rounded-md bg-background px-2"
                  onFocus={e => e.target.select()} />
                <span className="text-xs text-muted-foreground">% / 7j</span>
              </div>
              <p className="text-xs text-muted-foreground font-body">Ex: 100 or → récup. {100 + Math.floor(100 * depositRate / 100)} or</p>
            </div>
          </div>
          <button
            disabled={saving}
            onClick={async () => { setSaving(true); await onSaveRates(loanRate, depositRate); setSaving(false); }}
            className="text-xs font-heading bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
          >
            {saving ? "Sauvegarde..." : "💾 Enregistrer les taux"}
          </button>
        </div>
      )}

      {/* ── Infos taux pour les joueurs ── */}
      {!isMayor && mayorActive && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground font-body mb-1">Taux prêt</p>
            {(city.loan_rate || 0) > 0
              ? <p className="font-heading font-bold text-blue-700">{city.loan_rate}% <span className="text-xs font-normal">/ 7j</span></p>
              : <p className="text-xs text-muted-foreground font-body">Non disponible</p>}
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground font-body mb-1">Taux dépôt</p>
            {(city.deposit_rate || 0) > 0
              ? <p className="font-heading font-bold text-green-700">{city.deposit_rate}% <span className="text-xs font-normal">/ 7j</span></p>
              : <p className="text-xs text-muted-foreground font-body">Non disponible</p>}
          </div>
        </div>
      )}
      {!mayorActive && (
        <p className="text-xs text-muted-foreground font-body italic">Le siège de la mairie est vide : sans gouverneur, le comptoir sommeille.</p>
      )}

      {/* ── Prêts ── */}
      {mayorActive && (city.loan_rate || 0) > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-body font-semibold">💳 Emprunter à la ville</p>
          {activeLoans.length > 0 ? (
            activeLoans.map((loan, idx) => (
              <div key={idx} className="bg-white border border-border rounded-lg p-3 flex justify-between items-center text-sm font-body">
                <div>
                  <span className="font-semibold">{loan.amount} 💰</span>
                  <span className="text-muted-foreground ml-2 text-xs">à rembourser {loan.amount + loan.interest} 💰 avant le {loan.due_at}</span>
                  {now > loan.due_at && <span className="text-red-600 text-xs ml-2 font-semibold">⚠️ En retard</span>}
                </div>
                <button onClick={() => onRepayLoan(loan, idx)}
                  className="text-xs font-heading bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1">
                  Rembourser {loan.amount + loan.interest} 💰
                </button>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input type="number" min={50} max={Math.min(500, city.gold_treasury || 0)} step={50} value={loanAmount}
                  onChange={e => setLoanAmount(Math.max(50, parseInt(e.target.value) || 50))}
                  className="w-20 h-7 text-xs text-center border border-input rounded-md bg-background px-2"
                  onFocus={e => e.target.select()} />
                <span className="text-xs text-muted-foreground">or</span>
              </div>
              <button onClick={() => onRequestLoan(loanAmount)}
                className="text-xs font-heading bg-blue-500 hover:bg-blue-600 text-white rounded-md px-3 py-1.5">
                Emprunter → rembourser {loanAmount + Math.floor(loanAmount * (city.loan_rate || 0) / 100)} 💰 / 7j
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Dépôts ── */}
      {mayorActive && (city.deposit_rate || 0) > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-body font-semibold">🏦 Déposer de l'or à la ville</p>
          {activeDeposits.map((dep, idx) => {
            const matured = now >= dep.due_at;
            return (
              <div key={idx} className={`bg-white border rounded-lg p-3 flex justify-between items-center text-sm font-body ${matured ? "border-green-300" : "border-border"}`}>
                <div>
                  <span className="font-semibold">{dep.amount} 💰 déposés</span>
                  <span className="text-muted-foreground ml-2 text-xs">→ {dep.amount + dep.interest} 💰 le {dep.due_at}</span>
                </div>
                {matured ? (
                  <button onClick={() => onClaimDeposit(dep, idx)}
                    className="text-xs font-heading bg-green-500 hover:bg-green-600 text-white rounded-md px-2 py-1">
                    Récupérer {dep.amount + dep.interest} 💰
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground font-body">⏳ {dep.due_at}</span>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <input type="number" min={50} max={profile.gold || 0} step={50} value={depositAmount}
                onChange={e => setDepositAmount(Math.max(50, parseInt(e.target.value) || 50))}
                className="w-20 h-7 text-xs text-center border border-input rounded-md bg-background px-2"
                onFocus={e => e.target.select()} />
              <span className="text-xs text-muted-foreground">or</span>
            </div>
            <button onClick={() => onDeposit(depositAmount)}
              className="text-xs font-heading bg-green-500 hover:bg-green-600 text-white rounded-md px-3 py-1.5">
              Déposer → récupérer {depositAmount + Math.floor(depositAmount * (city.deposit_rate || 0) / 100)} 💰 / 7j
            </button>
          </div>
        </div>
      )}
    </div>
  );
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




  // ── Banque de la ville ──
  const handleSaveBankRates = async (loanRate, depositRate) => {
    await base44.entities.City.update(city.id, {
      loan_rate: Math.max(0, Math.min(50, loanRate)),
      deposit_rate: Math.max(0, Math.min(30, depositRate)),
    });
    toast.success("🏦 Taux bancaires mis à jour !");
    onRefresh?.();
  };

  const handleRequestLoan = async (amount) => {
    if (!hasComptoir) return;
    if (profile.home_city_id !== city.id) { toast.error("Vous ne pouvez emprunter que dans votre ville d'origine."); return; }
    if (!mayorActive) { toast.error("Sans maire en exercice, nul ne peut autoriser un prêt : attendez l'élection d'un gouverneur."); return; }
    const rate = city.loan_rate || 0;
    if (rate === 0) { toast.error("Le maire n'a point ouvert le livre des prêts : attendez qu'il active cette faveur."); return; }
    const existing = (profile.active_loans || []).filter(l => l.city_id === city.id && l.status === "active");
    if (existing.length > 0) { toast.error("Vous portez déjà une dette envers cette cité : remboursez-la avant d'en contracter une nouvelle."); return; }
    if ((city.gold_treasury || 0) < amount) { toast.error(`Les coffres de ${city.name} sont trop maigres pour ce prêt : il ne reste que ${city.gold_treasury || 0} 💰 en trésorerie.`); return; }
    const interest = Math.floor(amount * (rate / 100));
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const loan = { city_id: city.id, city_name: city.name, amount, interest, rate, borrowed_at: new Date().toISOString(), due_at: dueDate.toISOString().split("T")[0], status: "active" };
    const newLoans = [...(profile.active_loans || []), loan];
    await base44.entities.PlayerProfile.update(profile.id, {
      gold: (profile.gold || 0) + amount,
      active_loans: newLoans,
    });
    await base44.entities.City.update(city.id, {
      gold_treasury: Math.max(0, (city.gold_treasury || 0) - amount),
    });
    await logGold(profile.user_email, profile.character_name, city.id, city.name,
      amount, "pret", `Prêt bancaire de ${city.name} (→ rembourser ${amount + interest} 💰)`);
    toast.success(`🏦 Le comptoir vous accorde sa confiance ! ${amount} 💰 dans votre bourse : remboursez ${amount + interest} 💰 avant le ${dueDate.toISOString().split("T")[0]}.`);
    onRefresh?.();
  };

  const handleRepayLoan = async (loan, idx) => {
    const total = loan.amount + loan.interest;
    if ((profile.gold || 0) < total) { toast.error(`Votre bourse est trop légère : il vous faut ${total} 💰 pour solder cette dette.`); return; }
    const newLoans = (profile.active_loans || []).map((l, i) => i === idx ? { ...l, status: "repaid" } : l);
    await base44.entities.PlayerProfile.update(profile.id, {
      gold: (profile.gold || 0) - total,
      active_loans: newLoans,
    });
    await base44.entities.City.update(city.id, {
      gold_treasury: (city.gold_treasury || 0) + total,
    });
    await logGold(profile.user_email, profile.character_name, city.id, city.name,
      -total, "remboursement", `Remboursement prêt à ${city.name}`);
    toast.success(`🤝 Votre dette est soldée ! ${total} 💰 rendus à la trésorerie de ${city.name} : votre honneur est sauf.`);
    onRefresh?.();
  };

  const handleBankDeposit = async (amount) => {
    if (!hasComptoir) return;
    if (profile.home_city_id !== city.id) { toast.error("Vous ne pouvez déposer que dans votre ville d'origine."); return; }
    if (!mayorActive) { toast.error("Le siège de la mairie est vide : un maire doit d'abord être élu pour gérer les dépôts."); return; }
    const rate = city.deposit_rate || 0;
    if (rate === 0) { toast.error("Le comptoir est fermé : le maire n'a pas encore ouvert le livre des dépôts."); return; }
    if ((profile.gold || 0) < amount) { toast.error("Pas assez d'or."); return; }
    const interest = Math.floor(amount * (rate / 100));
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const deposit = { city_id: city.id, city_name: city.name, amount, interest, rate, deposited_at: new Date().toISOString(), due_at: dueDate.toISOString().split("T")[0], status: "active" };
    const newDeposits = [...(profile.active_deposits || []), deposit];
    await base44.entities.PlayerProfile.update(profile.id, {
      gold: (profile.gold || 0) - amount,
      active_deposits: newDeposits,
    });
    await base44.entities.City.update(city.id, {
      gold_treasury: (city.gold_treasury || 0) + amount,
    });
    await logGold(profile.user_email, profile.character_name, city.id, city.name,
      -amount, "depot", `Dépôt bancaire à ${city.name} (→ ${amount + interest} 💰 dans 7j)`);
    toast.success(`🏦 Dépôt de ${amount} 💰 effectué ! Récupérez ${amount + interest} 💰 dans 7 jours.`);
    onRefresh?.();
  };

  const handleClaimDeposit = async (deposit, idx) => {
    const total = deposit.amount + deposit.interest;
    const now = new Date().toISOString().split("T")[0];
    if (now < deposit.due_at) { toast.error(`Votre dépôt est encore à terme jusqu'au ${deposit.due_at} : patience, les intérêts courent !`); return; }
    if ((city.gold_treasury || 0) < total) {
      // Trésorerie vide : rembourser uniquement la mise
      const newDeposits = (profile.active_deposits || []).map((d, i) => i === idx ? { ...d, status: "matured" } : d);
      await base44.entities.PlayerProfile.update(profile.id, {
        gold: (profile.gold || 0) + deposit.amount,
        active_deposits: newDeposits,
      });
      await base44.entities.City.update(city.id, {
        gold_treasury: Math.max(0, (city.gold_treasury || 0) - deposit.amount),
      });
      toast.error(`⚠️ La trésorerie manque de fonds pour les intérêts : seule votre mise initiale (${deposit.amount} 💰) vous est rendue.`);
    } else {
      const newDeposits = (profile.active_deposits || []).map((d, i) => i === idx ? { ...d, status: "matured" } : d);
      await base44.entities.PlayerProfile.update(profile.id, {
        gold: (profile.gold || 0) + total,
        active_deposits: newDeposits,
      });
      await base44.entities.City.update(city.id, {
        gold_treasury: Math.max(0, (city.gold_treasury || 0) - total),
      });
      await logGold(profile.user_email, profile.character_name, city.id, city.name,
        total, "retrait_depot", `Retrait dépôt ${city.name} (+${deposit.interest} 💰 intérêts)`);
      toast.success(`💰 Votre dépôt fructifié vous est restitué ! +${total} 💰 dont ${deposit.interest} 💰 d'intérêts bien mérités.`);
    }
    onRefresh?.();
  };


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

  // Handler appel� quand un b�timent "sp�cifique � la ville" est cliqu�.
  // On bascule sur l'onglet correspondant dans CityView.
  const handleOpenTab = (tabValue) => {
    setActiveTab(tabValue);
    setShowVillageView(false);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 50);
  };

  // Handler appel� quand un b�timent construit (mine, fonderie...) est cliqu�.
  const handleShowBuildingInfo = (buildingType) => {
    setBuildingInfoTarget(buildingType);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Vue Village (toggle en haut, affichage par d�faut) */}
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
              ?? Vue d�taill�e
            </Button>
          </div>

          <VillageView
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
          onSaveRates={handleSaveBankRates}
          onRequestLoan={handleRequestLoan}
          onRepayLoan={handleRepayLoan}
          onDeposit={handleBankDeposit}
          onClaimDeposit={handleClaimDeposit}
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

          {/* ── Résidents ── */}
          {(() => {
            const residents = cityPlayers.filter(p => p.home_city_id === city.id);
            const visitors = cityPlayers.filter(p => p.home_city_id !== city.id && !p.is_traveling);
            return (
              <div className="space-y-3">
                {/* ── Panel nomination rôles (maire uniquement) ── */}
                {isMayor && residents.length > 0 && (() => {
                  const ROLES = [
                    { key: "percepteur", label: "Percepteur", icon: "💰", desc: "Accès impôts & taxes" },
                    { key: "chef_guerre", label: "Chef de guerre", icon: "⚔️", desc: "Accès onglet Guerre" },
                    { key: "acheteur", label: "Acheteur", icon: "🛒", desc: "Accès offres d'achat" },
                  ];
                  return (
                    <Card className="border-amber-200 bg-amber-50/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="font-heading text-sm flex items-center gap-2">👑 Nommer des officiers <HelpTooltip text="Le maire peut déléguer trois rôles à ses résidents. Le Percepteur accède aux réglages d'impôts et taxes. Le Chef de guerre gère l'armée et les campagnes. L'Acheteur configure les offres de rachat de l'entrepôt. Les rôles s'affichent en badge dans la liste des habitants." /></CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {ROLES.map(({ key, label, icon, desc }) => {
                          const currentId   = cityRoles[`${key}_id`];
                          const currentName = cityRoles[`${key}_name`];
                          return (
                            <div key={key} className="flex items-center gap-2 flex-wrap">
                              <span className="text-base w-6 text-center">{icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-heading font-semibold">{label}</div>
                                <div className="text-xs font-body text-muted-foreground">{desc}</div>
                              </div>
                              {currentId ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-body font-semibold text-amber-800">{currentName}</span>
                                  <button
                                    onClick={() => handleSetRole(key, null)}
                                    className="text-xs text-red-500 hover:text-red-700 font-body underline underline-offset-2">
                                    Retirer
                                  </button>
                                </div>
                              ) : (
                                <select
                                  className="text-xs font-body border border-amber-300 rounded px-2 py-1 bg-white"
                                  defaultValue=""
                                  onChange={e => {
                                    const p = residents.find(r => r.id === e.target.value);
                                    if (p) handleSetRole(key, p);
                                    e.target.value = "";
                                  }}>
                                  <option value="">Nommer</option>
                                  {residents.filter(r => r.id !== profile.id).map(r => (
                                    <option key={r.id} value={r.id}>{r.character_name}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })()}

                {residents.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="font-heading text-sm flex items-center gap-2">
                        🏠 Résidents ({residents.length})
                        <HelpTooltip
                          side="bottom"
                          text={
                            "Légende des icônes :\n\n" +
                            "👑 Maire de la cité\n" +
                            "💰 Percepteur (gère les taxes)\n" +
                            "⚔️ Chef de guerre (commande l'armée)\n" +
                            "🛒 Acheteur (achète au marché pour la cité)\n" +
                            "🟢 Joueur en ligne\n\n" +
                            "Sous le nom :\n" +
                            "🏆 Rang vendeur · 🏗️ Rang contributeur entrepôt · ⚔️ Rang PvP\n" +
                            "⚔️X Score d'attaque · 🛡️X Score de défense\n\n" +
                            "Boutons :\n" +
                            "🏪 Atelier : Commander à un artisan ou améliorer ton équipement\n" +
                            "⚔️ Défier : Lancer un défi PvP\n" +
                            "🚫 Expulser : Réservé au maire\n" +
                            "⚒️ M'améliorer : Self-service Bûcheron/Mineur"
                          }
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                        {residents.map(p => {
                          const isMe = p.id === profile.id;
                          const online = isPlayerOnline(p);
                          return (
                          <div key={p.id} className={`rounded-lg p-3 text-sm font-body ${
                            online ? "bg-green-50 border border-green-200" : "bg-muted/50"
                          }`}>
                            {/* En-tête : avatar + nom + badge online */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-2xl shrink-0">{p.is_traveling ? "🐴" : "👤"}</span>
                              <div className="font-semibold text-base flex-1 truncate">{p.character_name}</div>
                              {online && (
                                <span className="text-xs text-green-700 bg-green-100 border border-green-300 rounded px-2 py-0.5 font-body shrink-0">
                                  🟢 En ligne
                                </span>
                              )}
                            </div>

                            {/* Badges de rôle (sous le nom, sur leur propre ligne) */}
                            {(city?.mayor_id === p.id || cityRoles?.percepteur_id === p.id || cityRoles?.chef_guerre_id === p.id || cityRoles?.acheteur_id === p.id) && (
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {city?.mayor_id === p.id && <Badge className="bg-amber-500 text-white text-xs font-heading">👑 Maire</Badge>}
                                {cityRoles?.percepteur_id === p.id && <Badge variant="outline" className="text-blue-700 border-blue-300 text-xs">💰 Percepteur</Badge>}
                                {cityRoles?.chef_guerre_id === p.id && <Badge variant="outline" className="text-red-700 border-red-300 text-xs">⚔️ Chef de guerre</Badge>}
                                {cityRoles?.acheteur_id === p.id && <Badge variant="outline" className="text-purple-700 border-purple-300 text-xs">🛒 Acheteur</Badge>}
                              </div>
                            )}

                            {/* Métier + rangs + scores (compact, une seule ligne) */}
                            <div className="text-muted-foreground text-xs flex items-center gap-2 flex-wrap mb-2">
                              <span className="font-semibold">{p.profession}{p.is_traveling ? " · En voyage" : ""}</span>
                              <span title={`Ventes: ${p.cumul_ventes_or||0}💰`}>{getVendeurRank(p.cumul_ventes_or||0).icon}</span>
                              <span title={`Entrepôt: ${p.cumul_contributions_warehouse||0}`}>{getContributeurRank(p.cumul_contributions_warehouse||0).icon}</span>
                              {(p.cumul_t5_envoyes||0) > 0 && <span title={`T5: ${p.cumul_t5_envoyes}`}>{getPvpRank(p.cumul_t5_envoyes||0).icon}</span>}
                              {getAttackScore(p) > 0 && <span title="Score d'attaque">⚔️{getAttackScore(p)}</span>}
                              {getDefenseScore(p) > 0 && <span title="Score de défense">🛡️{getDefenseScore(p)}</span>}
                              {!isMe && !isHomeCity && (() => {
                                const hasBourse = (profile.inventory || []).some(i => i.item_key === "bourse_protection" && (i.quantity || 0) > 0);
                                if (!hasBourse) return null;
                                return <span className="text-yellow-700 border border-yellow-300 bg-yellow-50 rounded px-1.5 py-0.5 font-body">👜 Bourse active</span>;
                              })()}
                            </div>

                            {/* Boutons d'action : flex-wrap propre, en bas */}
                            {(() => {
                              const showExpel = !isMe && isMayor;
                              const showAtelier = !isMe && (p.atelier_vitrine?.active || p.profession === "Bûcheron" || p.profession === "Mineur");
                              const showDefier = !isMe && !isPlayerKO(profile) && !isPlayerKO(p);
                              const showSelfImprove = isMe && (p.profession === "Bûcheron" || p.profession === "Mineur");
                              if (!showExpel && !showAtelier && !showDefier && !showSelfImprove) return null;
                              return (
                                <div className="flex items-center gap-2 flex-wrap">
                                  {showExpel && (
                                    <Button size="sm" variant="outline"
                                      className="h-9 text-sm font-heading text-orange-600 border-orange-200 hover:bg-orange-50"
                                      onClick={() => handleExpel(p)}>
                                      🚫 Expulser
                                    </Button>
                                  )}
                                  {showAtelier && (
                                    <Button size="sm" variant="outline"
                                      className="h-9 text-sm font-heading text-amber-700 border-amber-300 hover:bg-amber-50"
                                      onClick={() => setSelectedAtelier(selectedAtelier === p.id ? null : p.id)}>
                                      🏪 Atelier
                                    </Button>
                                  )}
                                  {showDefier && (
                                    <Button size="sm" variant="outline"
                                      className="h-9 text-sm font-heading text-red-700 border-red-300 hover:bg-red-50"
                                      onClick={() => setChallengeTarget(p)}
                                      title={`Défier ${p.character_name}`}>
                                      ⚔️ Défier
                                    </Button>
                                  )}
                                  {showSelfImprove && (
                                    <Button size="sm" variant="outline"
                                      className="h-9 text-sm font-heading text-green-700 border-green-300 hover:bg-green-50"
                                      onClick={() => setSelectedAtelier(selectedAtelier === p.id ? null : p.id)}>
                                      ⚒️ M'améliorer
                                    </Button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          );
                        })}
                      </div>
                      {/* ── Atelier commande (REFONTE v4 : UpgradeServicePanel retiré) ── */}
                      {selectedAtelier && (() => {
                        const prod = residents.find(p => p.id === selectedAtelier);
                        if (!prod) return null;
                        return (
                          <AtelierCommande
                            producer={prod}
                            clientProfile={profile}
                            onClose={() => setSelectedAtelier(null)}
                            onRefresh={onRefresh}
                          />
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}

                {visitors.length > 0 && (
                  <Card className="border-orange-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="font-heading text-sm flex items-center gap-2">
                        🧳 Visiteurs ({visitors.length})
                        <HelpTooltip
                          side="bottom"
                          text={
                            "Voyageurs de passage dans la cité.\n\n" +
                            "🟢 En ligne · 🛡️X Score de défense\n\n" +
                            "⚔️ Défier : Lancer un défi PvP contre ce visiteur"
                          }
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                        {visitors.map(p => {
                          const isMe = p.id === profile.id;
                          const defenderScore = getDefenseScore(p);
                          const online = isPlayerOnline(p);
                          return (
                            <div key={p.id} className={`rounded-lg p-3 text-sm font-body ${
                              online ? "bg-green-50/50 border border-green-200" : "bg-orange-50/50 border border-orange-100"
                            }`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl shrink-0">🧳</span>
                                <div className="font-semibold text-base flex-1 truncate">{p.character_name}</div>
                                {online && (
                                  <span className="text-xs text-green-700 bg-green-100 border border-green-300 rounded px-2 py-0.5 font-body shrink-0">
                                    🟢 En ligne
                                  </span>
                                )}
                              </div>
                              <div className="text-muted-foreground text-xs flex items-center gap-2 flex-wrap mb-2">
                                <span className="font-semibold">{p.profession} · de {p.home_city_id ? "ailleurs" : "?"}</span>
                                {defenderScore > 0 && <span title="Score de défense">🛡️{defenderScore}</span>}
                              </div>
                              {!isMe && !isPlayerKO(profile) && !isPlayerKO(p) && (
                                <div className="flex">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 text-sm font-heading text-red-700 border-red-300 hover:bg-red-50"
                                    onClick={() => setChallengeTarget(p)}
                                    title={`Défier ${p.character_name}`}
                                  >
                                    ⚔️ Défier
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {residents.length === 0 && visitors.length === 0 && (
                  <p className="text-sm text-muted-foreground font-body text-center py-4 italic">Les rues sont silencieuses… Nul voyageur ne foule les pavés pour l'heure.</p>
                )}
                {isMayor && residents.length > 0 && (
                  <p className="text-xs text-muted-foreground font-body mt-2 italic">
                    💡 Les joueurs inactifs restent comptabilisés comme résidents tant qu'ils n'ont pas déménagé.
                  </p>
                )}

              </div>
            );
          })()}
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
