import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, Map, ShoppingBag, Building2, Route, User, Menu, X, Hammer, Settings, Beer, HelpCircle, Moon, Sun, Target, Package, MoreHorizontal, Trophy, Sword, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { updateLastActive } from "@/lib/inactivityCheck";
import { ADMIN_EMAILS } from "@/lib/gameData";
import Tutorial from "@/components/Tutorial";
import { useTheme } from "@/lib/useTheme.jsx";

const BASE_NAV = [
  { path: "/", icon: Home, label: "Accueil" },
  { path: "/city", icon: Building2, label: "Localité" },
  { path: "/market", icon: ShoppingBag, label: "Marché" },
  { path: "/production", icon: Hammer, label: "Production" },
  { path: "/travel", icon: Route, label: "Voyage" },
  { path: "/combat", icon: Sword, label: "Combat" },
  { path: "/quetes", icon: Target, label: "Quêtes" },
  { path: "/inventaire", icon: Package, label: "Inventaire" },
  { path: "/ranking", icon: Trophy, label: "Classement" },
  { path: "/profile", icon: User, label: "Profil" },
];

export default function GameLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [navItems, setNavItems] = useState(BASE_NAV);
  const [showTutorial, setShowTutorial] = useState(false);
  const [pendingDefenses, setPendingDefenses] = useState(0); // défis PvP à défendre
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user?.email && ADMIN_EMAILS.includes(user.email)) {
        setNavItems([...BASE_NAV, { path: "/admin", icon: Settings, label: "Admin" }]);
      }
    }).catch(() => {});
  }, []);

  // ── Mise à jour last_active_at toutes les 2 minutes (toutes pages) ──
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
    pingActive(); // immédiatement au montage
    const interval = setInterval(pingActive, 2 * 60 * 1000); // toutes les 2 minutes
    return () => clearInterval(interval);
  }, []);

  // ── Compteur défis PvP à défendre (Phase 3) ──
  // Ping toutes les 60 secondes pour mettre à jour le badge sur l'onglet Combat.
  // Toast au premier détection après le login (pour ne pas rater un défi).
  useEffect(() => {
    let firstCheck = true;
    let lastCount = 0;
    const pollPendingDefenses = async () => {
      try {
        const user = await base44.auth.me();
        if (!user?.email) return;
        const challenges = await base44.entities.CombatChallenge.filter(
          { defender_email: user.email, status: "pending_defense" },
          "",
          50
        ).catch(() => []);
        const now = Date.now();
        const active = challenges.filter(c =>
          !c.expires_at || new Date(c.expires_at).getTime() > now
        );
        const count = active.length;
        setPendingDefenses(count);

        // Toast à la première détection (login) ou si nouveau défi reçu
        if (firstCheck && count > 0) {
          toast.warning(`⚔️ ${count} défi${count > 1 ? "s" : ""} en attente de votre défense !`, {
            duration: 8000,
            action: {
              label: "Voir",
              onClick: () => { window.location.href = "/combat"; },
            },
          });
        } else if (!firstCheck && count > lastCount) {
          // Nouveau défi détecté en cours de session
          toast.warning(`⚔️ Nouveau défi reçu ! ${count} en attente.`, {
            duration: 6000,
            action: {
              label: "Voir",
              onClick: () => { window.location.href = "/combat"; },
            },
          });
        }
        lastCount = count;
        firstCheck = false;
      } catch (e) { /* silencieux */ }
    };
    pollPendingDefenses();
    const interval = setInterval(pollPendingDefenses, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}

      {/* Top Bar */}
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
            <a href="https://discord.com/channels/1496627736553193782/1496627739594330143" target="_blank" rel="noopener noreferrer" title="Rejoindre le Discord">
              <Button variant="ghost" size="sm" className="gap-2 font-body text-sm">
                <MessageCircle className="h-4 w-4" />
                Discord
              </Button>
            </a>
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link key={path} to={path}>
                <Button
                  variant={location.pathname === path ? "default" : "ghost"}
                  size="sm"
                  className="gap-2 font-body text-sm relative"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {path === "/combat" && pendingDefenses > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-heading rounded-full h-4 min-w-4 px-1 flex items-center justify-center animate-pulse">
                      {pendingDefenses}
                    </span>
                  )}
                </Button>
              </Link>
            ))}
            {/* Theme toggle : desktop */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              title="Basculer le thème"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {/* Tutorial button : desktop */}
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
          </nav>

          {/* Mobile right side: theme + help + menu toggle */}
          <div className="md:hidden flex items-center gap-1">
           <Button
             variant="ghost"
             size="icon"
             onClick={toggleTheme}
             title="Basculer le thème"
           >
             {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
           </Button>
           <Button
             variant="ghost"
             size="icon"
             onClick={() => setShowTutorial(true)}
             title="Aide"
           >
             <HelpCircle className="h-5 w-5 text-muted-foreground" />
           </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-border bg-card p-2 space-y-1">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link key={path} to={path} onClick={() => setMobileOpen(false)}>
                <Button
                  variant={location.pathname === path ? "default" : "ghost"}
                  className="w-full justify-start gap-3 font-body relative"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {path === "/combat" && pendingDefenses > 0 && (
                    <span className="ml-auto bg-red-600 text-white text-xs font-heading rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center animate-pulse">
                      {pendingDefenses}
                    </span>
                  )}
                </Button>
              </Link>
            ))}
            <a href="https://discord.com/channels/1496627736553193782/1496627739594330143" target="_blank" rel="noopener noreferrer" className="block">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 font-body"
              >
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
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-pb">
        {moreOpen && (
          <div className="border-t border-border bg-card px-3 py-2 grid grid-cols-3 gap-1">
            {navItems.slice(4).map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMoreOpen(false)}
                className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-xs transition-colors ${
                  location.pathname === path ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-body">{label}</span>
              </Link>
            ))}
            <a
              href="https://discord.com/channels/1496627736553193782/1496627739594330143"
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
          </div>
        )}
        <div className="flex justify-around py-2">
          {navItems.slice(0, 4).map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              onClick={() => setMoreOpen(false)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs transition-colors ${
                location.pathname === path ? "text-primary font-semibold" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="font-body">{label}</span>
            </Link>
          ))}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-xs transition-colors ${moreOpen ? "text-primary font-semibold" : "text-muted-foreground"}`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="font-body">Plus</span>
          </button>
        </div>
      </nav>
    </div>
  );
}