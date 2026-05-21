// src/components/VillageMenuView.jsx (11/05/2026, v2 enrichi)
//
// Vue alternative du village en mode "liste de menus / tableau de bord".
// Le toggle est dans le drawer Paramètres (bouton flottant en haut à droite).
// Mode persisté en localStorage via useVillageViewMode.
//
// v2 (11/05/2026) : enrichi avec des infos status par card pour faire
// un vrai tableau de bord. Reprend la logique de TodayCheckup pour les
// calculs (faim/fatigue/cooldowns/quêtes/épopée/récolte AFK).
//
// Reçoit profile/city/onRefresh en props depuis CityView (pas de
// usePlayerData() interne).

import { useState, useEffect } from "react";
import { base44, pb } from "@/api/base44Client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

import QuestesPage from "@/pages/QuestesPage";
import ChaudronPage from "@/pages/ChaudronPage";
import InventairePage from "@/pages/InventairePage";
import ProductionPage from "@/pages/ProductionPage";
import MarketPage from "@/pages/MarketPage";
import EntrepotPage from "@/pages/EntrepotPage";
import CombatPage from "@/pages/CombatPage";
import PavillonPage from "@/pages/PavillonPage";
import TravelPage from "@/pages/TravelPage";
import TavernPage from "@/pages/TavernPage";
import MairieDrawer from "@/components/MairieDrawer";
import SavoirHubPage from "@/pages/SavoirHubPage";
import ComptoirDrawer from "@/components/ComptoirDrawer";
import RankingPageWrapper from "@/pages/RankingPageWrapper";
import BiomeHub from "@/components/BiomeHub";
import BiomeReturnPanel from "@/components/BiomeReturnPanel";
import TodoNextPanel from "@/components/TodoNextPanel";

import {
  getMaxFatigue, MAX_HUNGER, getMaxHunger,
  getCityHungerBonus, HUNGER_WARNING_THRESHOLD,
} from "@/lib/gameData";
import { computeFatigueWithDailyReset } from "@/lib/craftingData";
import { BIOMES, getBiomeName, getBiomeIcon } from "@/lib/biomes";
import { generateTodoCards } from "@/lib/todoNext";
import { hasUsedCauldronToday } from "@/lib/cauldronHelpers";

// 16/05/2026 — Détermine le biome courant du joueur.
// `current_biome` (champ texte) peut ne pas être alimenté en BDD pour les
// "explorations directes" : dans ce cas, on regarde travel_destination_id
// qui contient "biome:foret" (ou autre). Si le joueur est en voyage, il
// n'est PAS dans un biome (il y voyage).
function getActiveBiomeKey(profile) {
  if (!profile) return null;
  if (profile.is_traveling) return null;
  if (profile.current_biome) return profile.current_biome;
  const td = profile.travel_destination_id;
  if (td && typeof td === "string" && td.startsWith("biome:")) {
    return td.replace("biome:", "");
  }
  return null;
}

// Mapping identique à VillageView (cohérence)
const DRAWER_TARGETS = {
  quetes: { title: "Quêtes du jour", Component: QuestesPage },
  chaudron: { title: "Chaudron magique", Component: ChaudronPage },
  logement: { title: "Inventaire", Component: InventairePage },
  atelier: { title: "Atelier", Component: ProductionPage },
  marche: { title: "Marché", Component: MarketPage },
  arene: { title: "Arène", Component: CombatPage },
  entrepot: { title: "Entrepôt", Component: EntrepotPage },
  ecurie: { title: "Écurie", Component: TravelPage },
  taverne: { title: "Taverne", Component: TavernPage },
  pavillon: { title: "Pavillon de la Fortune", Component: PavillonPage },
  mairie: { title: "Mairie", Component: MairieDrawer, needsProps: true },
  biome: { title: "Biome", Component: BiomeHub, needsProps: true },
  bibliotheque: { title: "Bibliothèque", Component: SavoirHubPage },
  comptoir: { title: "Comptoir bancaire", Component: ComptoirDrawer, needsProps: true },
  classement: { title: "Classement", Component: RankingPageWrapper },
  aujourdhui: { title: "📅 Aujourd'hui", Component: TodoNextPanel, needsProps: true },
};

// Style par état d'urgence (border + bg)
const STATE_STYLES = {
  alert:   "border-red-300 bg-red-50/50 hover:bg-red-50",
  warn:    "border-amber-300 bg-amber-50/50 hover:bg-amber-50",
  done:    "border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50",
  info:    "border-sky-300 bg-sky-50/50 hover:bg-sky-50",
  neutral: "border-border bg-card hover:bg-card/90",
};
const STATE_BADGE_STYLES = {
  alert:   "bg-red-100 text-red-800",
  warn:    "bg-amber-100 text-amber-800",
  done:    "bg-emerald-100 text-emerald-800",
  info:    "bg-sky-100 text-sky-800",
  neutral: "bg-muted text-muted-foreground",
};

export default function VillageMenuView({ profile, city, onRefresh }) {
  const [openDrawer, setOpenDrawer] = useState(null);
  const [quests, setQuests] = useState([]);
  const [listingsActiveCount, setListingsActiveCount] = useState(null);
  // 18/05/2026 — Données pour pré-calculer le badge "Aujourd'hui".
  // On charge boss + état chaudron ici (les quêtes sont déjà chargées plus haut).
  // Le drawer rechargera ces données à l'ouverture pour avoir l'état le + frais.
  const [bossData, setBossData] = useState(null);
  const [cauldronUsedToday, setCauldronUsedToday] = useState(false);
  const [todoCardsLoaded, setTodoCardsLoaded] = useState(false);

  // Biome actif : helper qui regarde current_biome OU travel_destination_id
  const activeBiomeKey = getActiveBiomeKey(profile);

  // Quêtes du jour (pour afficher 3/6 etc.)
  useEffect(() => {
    if (!profile?.user_email) return;
    let cancelled = false;
    const todayStr = new Date().toISOString().split("T")[0];
    (async () => {
      try {
        const [active, done] = await Promise.all([
          base44.entities.PlayerObjective.filter({ player_email: profile.user_email, status: "active" }),
          base44.entities.PlayerObjective.filter({ player_email: profile.user_email, status: "completed" }),
        ]);
        if (cancelled) return;
        // 14/05/2026 — Fix bug compteur quêtes (affichait 0/4 au lieu de 0/6) :
        // l'ancien filtre excluait `deposit` et `deposit_t1` du décompte alors
        // que ce sont bien des quêtes journalières. Retiré.
        const isQuestToday = (o) =>
          (o.created_date || o.quest_date || "").startsWith(todayStr);
        const today = [...(active || []), ...(done || [])].filter(isQuestToday);
        setQuests(today);
      } catch (e) { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [profile?.user_email]);

  // Marché : nombre de mes annonces actives (pour info)
  useEffect(() => {
    if (!profile?.user_email) return;
    let cancelled = false;
    base44.entities.MarketListing
      .filter({ seller_email: profile.user_email, status: "active" })
      .then(rows => {
        if (cancelled) return;
        setListingsActiveCount((rows || []).length);
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [profile?.user_email]);

  // 18/05/2026 — Pré-chargement boss + état chaudron pour le badge "Aujourd'hui".
  // Boss via /api/boss/current (endpoint existant qui gère locks + normalisation).
  // Erreurs silencieuses (le drawer affichera "Aucun boss" / "Pas utilisé" si fail).
  useEffect(() => {
    if (!profile?.user_email) { setTodoCardsLoaded(true); return; }
    let cancelled = false;
    Promise.all([
      pb.send('/api/boss/current', { method: 'GET' }).then(r => r?.boss || null).catch(() => null),
      hasUsedCauldronToday(profile.user_email).catch(() => ({})),
    ])
      .then(([bossRes, cauldronStatus]) => {
        if (cancelled) return;
        setBossData(bossRes);
        setCauldronUsedToday(Object.values(cauldronStatus || {}).some(Boolean));
      })
      .catch(() => { /* silent */ })
      .finally(() => {
        if (!cancelled) setTodoCardsLoaded(true);
      });
    return () => { cancelled = true; };
  }, [profile?.user_email]);

  if (!profile || !city) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Calcul des status par menu (logique reprise de TodayCheckup)
  // ─────────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().split("T")[0];
  const now = Date.now();

  // Faim / fatigue
  const maxFatigue = getMaxFatigue(profile);
  const { fatigue } = computeFatigueWithDailyReset(profile, maxFatigue);
  const hunger = profile.hunger ?? MAX_HUNGER;
  const maxHunger = getMaxHunger(profile, getCityHungerBonus(city?.buildings || []));

  // Production : cooldown prêt
  const cooldowns = profile.production_cooldowns || {};
  const hasCooldownReady = Object.values(cooldowns).some(cd => {
    if (!cd?.available_at) return true;
    return new Date(cd.available_at).getTime() <= now;
  });

  // Récolte AFK (biome)
  const HARVEST_RATE_MS = 7200000;
  const HARVEST_MAX = 4;
  let harvestActive = false;
  let harvestCount = 0;
  let harvestBiomeName = null;
  if (profile.harvest_started_at && profile.harvest_biome_key) {
    harvestActive = true;
    harvestBiomeName = getBiomeName(profile.harvest_biome_key, true);
    const elapsed = now - new Date(profile.harvest_started_at).getTime();
    harvestCount = Math.min(Math.max(0, Math.floor(elapsed / HARVEST_RATE_MS)), HARVEST_MAX);
  }
  const harvestReady = harvestActive && harvestCount >= HARVEST_MAX;

  // Voyage en cours
  const isTraveling = !!profile.is_traveling;
  let travelMsLeft = 0;
  if (isTraveling && profile.travel_arrival_time) {
    travelMsLeft = Math.max(0, new Date(profile.travel_arrival_time).getTime() - now);
  }

  // Combat / Épopée du jour
  const MAX_WAVES_PER_DAY = 5;
  const epicStartedToday = profile.combat_last_date === todayStr;
  const epicDoneToday = epicStartedToday
    && profile.combat_active_biome
    && (profile.combat_wave_index ?? 0) >= MAX_WAVES_PER_DAY;
  const epicInProgress = epicStartedToday && !epicDoneToday;

  // Quêtes
  const questsDone = quests.filter(q => q.status === "completed").length;
  const questsTotal = quests.length;

  // Entrepôt ville : alerte si maintenance > 2× stock
  const warehouse = city?.warehouse || {};
  const maintenance = city?.maintenance_daily || {};
  const warehouseAlert = Object.entries(maintenance).some(
    ([k, v]) => v > 0 && (warehouse[k] || 0) < v * 2
  );

  // 18/05/2026 — Compteur d'actions "à faire" pour le badge de la tuile
  // "Aujourd'hui". Mêmes données passées au panel : on est cohérent.
  const todoCards = generateTodoCards({
    profile,
    city,
    quests,
    boss: bossData,
    cauldronUsedToday,
  });
  const todoOpenCount = todoCards.filter(c => c.state !== 'done').length;

  // ─────────────────────────────────────────────────────────────
  // Définition des menus avec leur status calculé
  // ─────────────────────────────────────────────────────────────
  const buildMenus = () => {
    const menus = [
      {
        target: "quetes",
        icon: "🎯",
        label: "Quêtes du jour",
        hint: "Vos missions journalières",
        status: questsTotal === 0
          ? { text: "Générer les quêtes", state: "info" }
          : questsDone === questsTotal
          ? { text: "Toutes accomplies", state: "done" }
          : { text: `${questsDone}/${questsTotal} accomplies`, state: "neutral" },
      },
      {
        target: "atelier",
        icon: "⚒️",
        label: "Atelier",
        hint: "Production & fabrication",
        status: hasCooldownReady
          ? { text: "Cooldown prêt", state: "done" }
          : { text: "Production & craft", state: "neutral" },
      },
      {
        target: "logement",
        icon: "🏠",
        label: "Mon logement",
        hint: "Inventaire & équipement",
        status: null,
      },
      {
        target: "marche",
        icon: "🛒",
        label: "Marché",
        hint: "Acheter & vendre",
        status: listingsActiveCount !== null
          ? listingsActiveCount === 0
            ? { text: "Aucune annonce", state: "info" }
            : { text: `${listingsActiveCount} annonce${listingsActiveCount > 1 ? "s" : ""}`, state: "neutral" }
          : null,
      },
      {
        target: "entrepot",
        icon: "📦",
        label: "Entrepôt",
        hint: "Stocks de la ville",
        status: warehouseAlert
          ? { text: "Stocks bas", state: "warn" }
          : { text: "Stocks suffisants", state: "done" },
      },
      {
        target: "ecurie",
        icon: "🐴",
        label: "Écurie",
        hint: "Voyager dans le royaume",
        status: isTraveling
          ? travelMsLeft > 0
            ? { text: "En voyage", state: "info" }
            : { text: "Arrivée prête", state: "done" }
          : null,
      },
      {
        target: "arene",
        icon: "⚔️",
        label: "Arène",
        hint: "Combat PvP",
        status: epicInProgress
          ? { text: "Épopée en cours", state: "info" }
          : epicDoneToday
          ? { text: "Épopée terminée", state: "done" }
          : { text: "Épopée du jour", state: "neutral" },
      },
      {
        target: "taverne",
        icon: "🍞",
        label: "Taverne",
        hint: "Manger ici",
        status: hunger <= 0
          ? { text: "Faim critique !", state: "alert" }
          : hunger <= HUNGER_WARNING_THRESHOLD
          ? { text: `Faim ${hunger}/${maxHunger}`, state: "warn" }
          : null,
      },
      {
        target: "chaudron",
        icon: "🪄",
        label: "Chaudron magique",
        hint: "Loots magiques",
        status: null,
      },
      {
        target: "pavillon",
        icon: "🎲",
        label: "Pavillon",
        hint: "Loterie & paris",
        status: null,
      },
      {
        target: "comptoir",
        icon: "🏦",
        label: "Comptoir",
        hint: "Banque",
        status: null,
      },
      {
        // 16/05/2026 : tuile dynamique selon biome actif.
        // - Village (pas de biome) → tuile "Mairie" (gouvernance)
        // - Biome actif → tuile "Biome" avec icone et nom du biome courant
        ...(activeBiomeKey
          ? {
              target: "biome",
              icon: getBiomeIcon(activeBiomeKey),
              label: getBiomeName(activeBiomeKey, true),
              hint: "Hub du biome",
              status: null,
            }
          : {
              target: "mairie",
              icon: "🏛️",
              label: "Mairie",
              hint: "Gouvernance de la ville",
              status: null,
            }
        ),
      },
      {
        // 18/05/2026 — Tuile "Aujourd'hui" (remplace Bibliothèque, qui est
        // accessible depuis le drawer de cette tuile). Affiche un badge avec
        // le nombre d'actions ouvertes (priorité visible 1er coup d'œil).
        target: "aujourdhui",
        icon: "📅",
        label: "Aujourd'hui",
        hint: "Tes actions du jour",
        status: todoOpenCount > 0
          ? { text: `${todoOpenCount} action${todoOpenCount > 1 ? 's' : ''}`, state: "info" }
          : todoCardsLoaded
          ? { text: "Tout fait !", state: "done" }
          : null,
      },
      {
        target: "classement",
        icon: "🏆",
        label: "Classement",
        hint: "Royaume & joueurs",
        status: null,
      },
    ];

    // Récolte AFK en cours : on l'affiche dans l'Écurie (où on a démarré),
    // sauf si on est déjà en voyage (priorité au voyage).
    if (harvestActive && !isTraveling) {
      const ecurieIdx = menus.findIndex(m => m.target === "ecurie");
      if (ecurieIdx >= 0) {
        menus[ecurieIdx] = {
          ...menus[ecurieIdx],
          status: harvestReady
            ? { text: `Récolte prête (${harvestBiomeName})`, state: "done" }
            : { text: `Récolte ${harvestCount}/${HARVEST_MAX}`, state: "info" },
        };
      }
    }

    // Énergie épuisée : alerte sur Atelier (où on en a besoin)
    if (fatigue <= 0) {
      const atelierIdx = menus.findIndex(m => m.target === "atelier");
      if (atelierIdx >= 0) {
        menus[atelierIdx] = {
          ...menus[atelierIdx],
          status: { text: "Plus d'énergie", state: "alert" },
        };
      }
    }

    return menus;
  };

  const visibleMenus = buildMenus();

  // 16/05/2026 — Filtre en biome : ne garde que les tuiles utiles dans un biome
  // (le joueur n'a pas accès aux services de ville quand il est en biome).
  const BIOME_ALLOWED_TARGETS = new Set([
    "biome",     // hub biome (BiomeHub avec épopée)
    "arene",     // combat
    "logement",  // inventaire
    "ecurie",    // pour rentrer en voyage
    "quetes",    // quêtes du jour (peuvent concerner le biome)
  ]);
  const filteredMenus = activeBiomeKey
    ? visibleMenus.filter(m => BIOME_ALLOWED_TARGETS.has(m.target))
    : visibleMenus;

  return (
    <div className="px-3 py-3 max-w-md mx-auto">
      {/* Bandeau dynamique : ville ou biome selon contexte */}
      {activeBiomeKey ? (
        <div className="mb-3 px-3 py-2 rounded-lg bg-card/80 border border-border">
          <div className="font-heading text-base font-bold heading-medieval">
            {getBiomeIcon(activeBiomeKey)} {getBiomeName(activeBiomeKey)}
          </div>
          <div className="text-xs font-body text-muted-foreground">
            Exploration en cours
          </div>
        </div>
      ) : (
        <div className="mb-3 px-3 py-2 rounded-lg bg-card/80 border border-border">
          <div className="font-heading text-base font-bold heading-medieval">
            🏰 {city.name}
          </div>
          <div className="text-xs font-body text-muted-foreground">
            Gouvernée par {city.mayor_name || "personne"}
          </div>
        </div>
      )}

      {/* Grille de menus enrichis */}
      <div className="grid grid-cols-2 gap-2">
        {filteredMenus.map(item => {
          const state = item.status?.state || "neutral";
          // 18/05/2026 — Badge numérique sur la tuile "Aujourd'hui" pour
          // attirer l'œil quand il y a des actions ouvertes.
          const showBadge = item.target === "aujourdhui" && todoOpenCount > 0;
          return (
            <button
              key={item.target}
              onClick={() => setOpenDrawer(item.target)}
              className={`relative flex flex-col items-start gap-1 p-3 rounded-lg border-2 active:scale-[0.98] transition-all text-left min-h-[90px] ${STATE_STYLES[state]}`}
            >
              {showBadge && (
                <span className="absolute top-1 right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-heading font-bold flex items-center justify-center shadow-sm">
                  {todoOpenCount}
                </span>
              )}
              <div className="flex items-center gap-2 w-full">
                <span className="text-2xl shrink-0">{item.icon}</span>
                <span className="font-heading text-sm font-semibold leading-tight">
                  {item.label}
                </span>
              </div>
              <span className="text-[10px] font-body text-muted-foreground leading-tight">
                {item.hint}
              </span>
              {item.status && (
                <span className={`mt-auto self-start text-[10px] font-body px-1.5 py-0.5 rounded ${STATE_BADGE_STYLES[state]}`}>
                  {item.status.text}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Drawer commun à tous les menus.
          17/05/2026 — shouldScaleBackground=false : Vaul applique sinon un
          transform: scale(0.96) sur le body qui assombrit les toasts XP
          (Sonner les rend dans body, donc piégés dans le contexte de stacking
          du transform). Conséquence : on perd l'effet visuel "contenu qui
          rapetisse derrière", mais les toasts +1XP restent lisibles et brillants
          quand on récolte/craft dans l'Atelier. Trade-off accepté. */}
      <Drawer
        open={!!openDrawer}
        onOpenChange={(open) => !open && setOpenDrawer(null)}
        shouldScaleBackground={false}
      >
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>
              {openDrawer === "biome" && activeBiomeKey
                ? `${getBiomeIcon(activeBiomeKey)} ${getBiomeName(activeBiomeKey)}`
                : openDrawer === "ecurie" && activeBiomeKey
                ? "🐴 Écurie — Retour à la ville"
                : (openDrawer && DRAWER_TARGETS[openDrawer]?.title)}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6 flex-1">
            {openDrawer && DRAWER_TARGETS[openDrawer] && (() => {
              const target = DRAWER_TARGETS[openDrawer];
              const Comp = target.Component;
              // Drawer écurie en biome : panel de retour à la ville
              if (openDrawer === "ecurie" && activeBiomeKey) {
                return (
                  <BiomeReturnPanel
                    profile={profile}
                    city={city}
                    onRefresh={onRefresh}
                    biomeKey={activeBiomeKey}
                  />
                );
              }
              // Drawer biome : passe biomeKey + biomeInfo en plus
              if (openDrawer === "biome" && activeBiomeKey) {
                const biomeInfo = BIOMES[activeBiomeKey] || null;
                return (
                  <Comp
                    profile={profile}
                    biomeKey={activeBiomeKey}
                    biomeInfo={biomeInfo}
                    city={city}
                    onRefresh={onRefresh}
                  />
                );
              }
              // 18/05/2026 — Drawer Aujourd'hui : besoin de onNavigate pour
              // ouvrir une autre tuile au clic d'une card, et onOpenSavoir
              // pour rediriger vers la Bibliothèque (qui n'a plus de tuile).
              if (openDrawer === "aujourdhui") {
                return (
                  <TodoNextPanel
                    profile={profile}
                    city={city}
                    onNavigate={(targetKey /* , subTarget */) => {
                      // Cas spécial : si target est "marche" avec subTarget="contracts",
                      // on ouvre Marché. Le user trouve l'onglet Contrats depuis là.
                      // (Phase 1.5 : passer subTarget en deep-link via query param)
                      setOpenDrawer(targetKey);
                    }}
                    onOpenSavoir={() => setOpenDrawer("bibliotheque")}
                  />
                );
              }
              if (target.needsProps) {
                return <Comp profile={profile} city={city} onRefresh={onRefresh} />;
              }
              return <Comp />;
            })()}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
