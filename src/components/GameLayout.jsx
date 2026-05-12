import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, Building2, Hammer, Sword, BookOpen, Menu, X, Settings, HelpCircle, Moon, Sun, MoreHorizontal, MessageCircle, Bug, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DISCORD_INVITE_URL } from "@/lib/links";
import { base44 } from "@/api/base44Client";
import { updateLastActive } from "@/lib/inactivityCheck";
import { ADMIN_EMAILS } from "@/lib/gameData";
import { BIOMES } from "@/lib/biomes";
import Tutorial from "@/components/Tutorial";
import BugReportModal from "@/components/BugReportModal";
import PatchnoteModal from "@/components/PatchnoteModal";
import MiniStatusBar from "@/components/MiniStatusBar";
import LoginStreakPopup from "@/components/LoginStreakPopup";
import { useTheme } from "@/lib/useTheme.jsx";
import { usePlayerData } from "@/lib/usePlayerData";
import { useIsMobile } from "@/lib/useIsMobile";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import SettingsPanel from "@/components/SettingsPanel";

// ─────────────────────────────────────────────────────────────────────────────
// Menu principal : 5 items au lieu de 11
//   - Accueil  : page directe (dashboard "check-up du jour")
//   - Cité     : label dynamique selon le lieu actuel du joueur (voir resolveCityLabel)
//   - Labeur   : hub /labeur → Production, Marché, Inventaire
//   - Aventure : hub /aventure → Voyage, Combat, Quêtes (avec badge défis PvP)
//   - Savoir   : hub /savoir → Codex, Classement, Profil
// L'admin (si applicable) s'ajoute en bout de menu desktop.
// ─────────────────────────────────────────────────────────────────────────────
const BASE_NAV = [
  { path: "/",         icon: Home,       label: "Accueil",  group: "home" },
  { path: "/city",     icon: Building2,  label: "Cité",     group: "city",     dynamic: true },
  { path: "/labeur",   icon: Hammer,     label: "Labeur",   group: "labeur" },
  { path: "/aventure", icon: Sword,      label: "Aventure", group: "aventure", showPendingBadge: true },
  { path: "/savoir",   icon: BookOpen,   label: "Savoir",   group: "savoir" },
];

/**
 * Détermine le label à afficher pour le bouton "Cité" selon l'état du joueur.
 *  - En biome (travel_destination_id commence par "biome:") → nom court du biome
 *  - En voyage actif vers une ville → "En voyage"
 *  - Dans une ville (n'importe laquelle) → nom de cette ville
 *  - Sinon → "Cité" par défaut
 */
function resolveCityLabel(profile, city) {
  if (!profile) return "Cité";
  if (profile.is_traveling) return "En voyage";
  const dest = profile.travel_destination_id || "";
  if (dest.startsWith("biome:")) {
    const key = dest.replace("biome:", "");
    return BIOMES[key]?.short || "Biome";
  }
  return city?.name || "Cité";
}

// Liste des chemins "appartenant" à chaque hub. Permet de garder le bouton
// du hub en surbrillance même quand on est sur une de ses sous-pages.
const PATHS_BY_GROUP = {
  home:     ["/"],
  city:     ["/city", "/taverne"],
  // 11/05/2026 : /profile déplacé de "savoir" vers "labeur". Le profil est
  // désormais accessible via le drawer logement (InventairePage) qui groupe
  // inventaire + profil. Le lien direct /profile reste valide pour les
  // deep-links (TodayCheckup épuisé, etc.) et est groupé avec labeur car
  // le logement est dans le groupe labeur (via /inventaire).
  labeur:   ["/labeur", "/production", "/market", "/inventaire", "/profile"],
  aventure: ["/aventure", "/travel", "/combat", "/quetes"],
  savoir:   ["/savoir", "/codex", "/ranking"],
};

function isPathInGroup(currentPath, group) {
  const paths = PATHS_BY_GROUP[group] || [];
  return paths.includes(currentPath);
}

export default function GameLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // 11/05/2026 : drawer paramètres (mode village, thème, audio, notifs)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navItems, setNavItems] = useState(BASE_NAV);
  const [showTutorial, setShowTutorial] = useState(() => {
    // Si CharacterCreation vient juste d'être complété, on déclenche le tuto
    // une fois (flag stocké en localStorage).
    try {
      if (localStorage.getItem("show-tutorial-once") === "1") {
        localStorage.removeItem("show-tutorial-once");
        return true;
      }
    } catch (_) {}
    return false;
  });
  const [showBugReport, setShowBugReport] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingDefenses, setPendingDefenses] = useState(0); // défis PvP à défendre
  // 12/05/2026 : profile, city, homeCity viennent désormais du même
  // PlayerDataContext (source unique de vérité, refresh global instantané).
  // Avant : 2 instances (useProfile pour profile, usePlayerData pour city),
  // ce qui causait un bug de désynchro après voyage où city de GameLayout
  // restait stale alors que TravelPage avait la nouvelle. Voir
  // PlayerDataContext.jsx pour le détail.
  const { profile, city, homeCity, refresh } = usePlayerData();

  // 11/05/2026 : détection mobile robuste (résout les bugs landscape sur
  // grands smartphones type Pixel 8 Pro où la largeur > 768px en landscape
  // déclenchait à tort le mode desktop. Combine pointer + hover + viewport).
  const isMobile = useIsMobile();
  // 11/05/2026 : détection orientation portrait + bloc "Tournez votre appareil"
  // supprimé. Le jeu est jouable en portrait (mode menu) et en landscape (mode
  // carte) avec auto-switch via useVillageViewMode. La rotation est désormais
  // un changement d'UI silencieux.
  const { isDark, toggleTheme } = useTheme();

  // Vérifie si l'utilisateur est admin et ajoute l'item admin en fin de menu
  useEffect(() => {
    base44.auth.me().then(user => {
      if (user?.email && ADMIN_EMAILS.includes(user.email)) {
        setNavItems([...BASE_NAV, { path: "/admin", icon: Settings, label: "Admin", group: "admin" }]);
      }
    }).catch(() => {});
  }, []);

  // Mise à jour last_active_at toutes les 2 minutes (toutes pages)
  useEffect(() => {
    const pingActive = async () => {
      try {
        const user = await base44.auth.me();
        if (!user?.email) return;
        const profiles = await base44.entities.PlayerProfile.filter({ user_email: user.email });
        if (profiles.length > 0) {
          await updateLastActive(profiles[0].id);
        }
      } catch(e) { /* silencieux */ }
    };
    pingActive();
    const interval = setInterval(pingActive, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 11/05/2026 : useEffect de fetch city retiré — usePlayerData fournit
  // déjà city/homeCity au mount initial et au refresh manuel. Les enfants
  // qui ont besoin de city fraîche appellent refreshProfile().

  // Polling des défis PvP en attente de défense
  useEffect(() => {
    let firstCheck = true;
    let lastSeenIds = new Set();

    const pollPendingDefenses = async () => {
      try {
        const user = await base44.auth.me();
        if (!user?.email) return;

        const challenges = await base44.entities.CombatChallenge.filter({
          target_email: user.email,
          status: "pending_defense",
        });

        const active = (challenges || []).filter(c => c.status === "pending_defense");
        const count = active.length;
        setPendingDefenses(count);

        if (firstCheck && count > 0) {
          toast.warning(`⚔️ ${count} défi${count > 1 ? "s" : ""} en attente de votre défense !`, {
            duration: 8000,
          });
        } else if (!firstCheck) {
          const newIds = new Set(active.map(c => c.id));
          for (const id of newIds) {
            if (!lastSeenIds.has(id)) {
              const ch = active.find(c => c.id === id);
              toast.warning(`⚔️ Nouveau défi de ${ch?.attacker_name || "un adversaire"} : à vous de défendre !`, { duration: 8000 });
            }
          }
          lastSeenIds = newIds;
        }

        if (firstCheck) {
          lastSeenIds = new Set(active.map(c => c.id));
          firstCheck = false;
        }
      } catch (e) { /* silencieux */ }
    };

    pollPendingDefenses();
    const interval = setInterval(pollPendingDefenses, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Helper pour résoudre le label affiché pour un item du menu
  const getItemLabel = (item) => {
    if (item.dynamic && item.group === "city") {
      return resolveCityLabel(profile, city);
    }
    return item.label;
  };

  // Helper : un item est-il actif (sa page ou une sous-page de son groupe) ?
  const isItemActive = (item) => isPathInGroup(location.pathname, item.group);

  return (
    <div
      className="min-h-screen md:min-h-screen flex flex-col h-screen md:h-auto overflow-hidden md:overflow-visible"
      style={{ overscrollBehavior: "none", touchAction: "manipulation" }}
    >
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}
      {showBugReport && <BugReportModal onClose={() => setShowBugReport(false)} />}
      {/* PatchnoteModal global (10/05/2026) : se déclenche tout seul si une
       * nouvelle version est dispo. Avant il était dans Home/, déplacé ici
       * pour qu'il se déclenche peu importe la route active. */}
      <PatchnoteModal />
      {/* Login streak en popup d'ouverture (10/05/2026) : se déclenche 1x par jour
       * au lancement de l'app. Même comportement sur mobile et desktop. */}
      {profile && (
        <LoginStreakPopup
          profile={profile}
          onProfileUpdate={() => {
            // 11/05/2026 : refresh via le context (source unique de vérité)
            refreshProfile();
          }}
        />
      )}

      {/* ── Modale de confirmation déconnexion ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚪</span>
              <h2 className="font-heading text-lg font-semibold">Se déconnecter ?</h2>
            </div>
            <p className="text-sm font-body text-muted-foreground">
              Vous reviendrez à l'écran de connexion. Votre progression est sauvegardée et vous pourrez vous reconnecter à tout moment.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="font-heading"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Annuler
              </Button>
              <Button
                variant="default"
                size="sm"
                className="font-heading bg-red-600 hover:bg-red-700"
                onClick={() => base44.auth.logout()}
              >
                <LogOut className="h-4 w-4 mr-1" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top Bar (cachée sur mobile : full-screen map, accès via drawers)
           11/05/2026 : utilise useIsMobile au lieu de md:hidden pour fixer
           les bugs landscape sur grands smartphones (Pixel 8 Pro, etc.) ── */}
      {!isMobile && (
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-2xl group-hover:rotate-12 transition-transform">⚜️</span>
            <h1 className="font-display text-xl tracking-wider text-primary">
              Guildes <span className="text-accent">&amp;</span> Couronnes
            </h1>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" title="Rejoindre le Discord">
              <Button variant="ghost" size="sm" className="gap-2 font-body text-sm">
                <MessageCircle className="h-4 w-4" />
                Discord
              </Button>
            </a>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item);
              const label = getItemLabel(item);
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={active ? "default" : "ghost"}
                    size="sm"
                    className="gap-2 font-body text-sm relative"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="max-w-[120px] truncate">{label}</span>
                    {item.showPendingBadge && pendingDefenses > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-heading rounded-full h-4 min-w-4 px-1 flex items-center justify-center animate-pulse">
                        {pendingDefenses}
                      </span>
                    )}
                  </Button>
                </Link>
              );
            })}
            {/* Theme toggle */}
            <Button variant="ghost" size="sm" onClick={toggleTheme} title="Basculer le thème">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {/* Bug report */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 font-body text-sm text-muted-foreground"
              onClick={() => setShowBugReport(true)}
              title="Signaler un bug"
            >
              <Bug className="h-4 w-4" />
              Bug
            </Button>
            {/* Tutorial */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 font-body text-sm text-muted-foreground"
              onClick={() => setShowTutorial(true)}
              title="Aide / Tutoriel"
            >
              <HelpCircle className="h-4 w-4" />
              Aide
            </Button>
            {/* Déconnexion */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 font-body text-sm text-muted-foreground hover:text-red-700"
              onClick={() => setShowLogoutConfirm(true)}
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          </nav>

          {/* Mobile right side: theme + bug + help + menu toggle */}
          <div className="md:hidden flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} title="Basculer le thème">
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowBugReport(true)} title="Signaler un bug">
              <Bug className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowTutorial(true)} title="Aide">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* ── Mobile Nav (menu hamburger déroulé) ── */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-border bg-card p-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item);
              const label = getItemLabel(item);
              return (
                <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}>
                  <Button
                    variant={active ? "default" : "ghost"}
                    className="w-full justify-start gap-3 font-body relative"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                    {item.showPendingBadge && pendingDefenses > 0 && (
                      <span className="ml-auto bg-red-600 text-white text-xs font-heading rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center animate-pulse">
                        {pendingDefenses}
                      </span>
                    )}
                  </Button>
                </Link>
              );
            })}
            <a href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="ghost" className="w-full justify-start gap-3 font-body">
                <MessageCircle className="h-4 w-4" />
                Discord
              </Button>
            </a>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 font-body text-muted-foreground"
              onClick={() => { setShowTutorial(true); setMobileOpen(false); }}
            >
              <HelpCircle className="h-4 w-4" />
              Aide / Tutoriel
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 font-body text-muted-foreground hover:text-red-700"
              onClick={() => { setShowLogoutConfirm(true); setMobileOpen(false); }}
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </Button>
          </nav>
        )}
      </header>
      )}

      {/* ── Mini status bar (10/05/2026) ─────────────────────────────────
       * - Desktop : visible en haut, sticky sous le header
       * - Mobile : cachée par défaut, accessible via le bouton flottant
       *   ❤️ en haut à droite (full-screen map oblige).
       * ────────────────────────────────────────────────────────────── */}
      {profile && !isMobile && (
        <div className="sticky top-14 z-30">
          <MiniStatusBar
            profile={profile}
            homeCity={homeCity}
            city={city}
            onRefresh={refresh}
          />
        </div>
      )}

      {/* ── Mobile : bouton flottant pour accéder à la status bar (drawer) ──
           11/05/2026 : utilise useIsMobile au lieu de md:hidden. */}
      {profile && isMobile && (
        <div className="fixed top-2 right-2 z-30 flex items-center gap-1.5">
          {/* 11/05/2026 : bouton Paramètres (remplace l'ancien toggle thème).
              Ouvre le drawer Settings qui regroupe : mode d'affichage village,
              thème, audio, notifications push. */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex items-center justify-center w-9 h-9 bg-card/90 backdrop-blur-sm border border-border rounded-full shadow-lg hover:bg-card transition-colors"
            aria-label="Paramètres"
            title="Paramètres"
          >
            <Settings className="h-4 w-4" />
          </button>
          {/* Mini status bar (or + HP) → ouvre drawer du haut au tap */}
          <MiniStatusBar
            profile={profile}
            homeCity={homeCity}
            city={city}
            onRefresh={refresh}
          />
        </div>
      )}

      {/* ── Main Content ──
       * - Desktop : max-w-7xl avec padding (centré, lisible)
       * - Mobile sur /city : flex-col + overflow-hidden → la map fit l'espace dispo
       *   via flex-1 (gère SystemMessageBanner et autres éléments qui prennent leur
       *   place naturelle au-dessus)
       * - Mobile sur autres pages : scroll interne possible
       * ───────────────────────────────────────────────── */}
      <main className={`flex-1 w-full flex flex-col min-h-0 ${location.pathname === "/city" ? "overflow-hidden" : "overflow-y-auto"} md:overflow-visible md:max-w-7xl md:mx-auto md:px-4 md:py-6 md:block`}>
        <Outlet />
      </main>

      {/* ── Mobile Bottom Nav SUPPRIMÉE (10/05/2026) ────────────────────
       * Décision : full-screen map sur mobile, navigation via les drawers
       * attachés aux bâtiments. Cette nav fixed bottom n'est plus rendue
       * sur mobile. Sur desktop, la nav est dans le header (déjà là).
       * Le bloc ci-dessous est désactivé via `hidden` partout.
       * ──────────────────────────────────────────────────────────────── */}
      <nav className="hidden bg-card border-t border-border z-50 safe-area-pb">
        {/* Tiroir "Plus" pour les éléments secondaires (Discord, Aide, Admin si applicable) */}
        {moreOpen && (
          <div className="border-t border-border bg-card px-3 py-2 grid grid-cols-3 gap-1">
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMoreOpen(false)}
              className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-xs text-muted-foreground"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="font-body">Discord</span>
            </a>
            <button
              onClick={() => { setShowTutorial(true); setMoreOpen(false); }}
              className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-xs text-muted-foreground"
            >
              <HelpCircle className="h-5 w-5" />
              <span className="font-body">Aide</span>
            </button>
            {/* Bouton admin uniquement si l'item admin est dans navItems */}
            {navItems.some(i => i.group === "admin") && (
              <Link
                to="/admin"
                onClick={() => setMoreOpen(false)}
                className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-xs ${
                  location.pathname.startsWith("/admin") ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                <Settings className="h-5 w-5" />
                <span className="font-body">Admin</span>
              </Link>
            )}
          </div>
        )}
        <div className="flex justify-around py-2">
          {/* Les 5 items principaux du menu : Accueil, Cité, Labeur, Aventure, Savoir */}
          {navItems.filter(i => i.group !== "admin").slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);
            const label = getItemLabel(item);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMoreOpen(false)}
                className={`flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg text-xs transition-colors relative ${
                  active ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-body max-w-[60px] truncate">{label}</span>
                {item.showPendingBadge && pendingDefenses > 0 && (
                  <span className="absolute top-0 right-1 bg-red-600 text-white text-[10px] font-heading rounded-full h-4 min-w-4 px-1 flex items-center justify-center animate-pulse">
                    {pendingDefenses}
                  </span>
                )}
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg text-xs transition-colors ${
              moreOpen ? "text-primary font-semibold" : "text-muted-foreground"
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="font-body">Plus</span>
          </button>
        </div>
      </nav>

      {/* 11/05/2026 : Drawer Paramètres (ouvert par le bouton flottant ⚙️) */}
      <Drawer open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Paramètres</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6 flex-1">
            <SettingsPanel />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
