import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, Map, ShoppingBag, Building2, Route, User, Menu, X, Hammer, Settings, Beer, HelpCircle, Moon, Sun, Target, Package, MoreHorizontal, Trophy } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { ADMIN_EMAILS } from "@/lib/gameData";
import Tutorial from "@/components/Tutorial";
import { useTheme } from "@/lib/useTheme.jsx";

const BASE_NAV = [
  { path: "/", icon: Home, label: "Accueil" },
  { path: "/city", icon: Building2, label: "Localité" },
  { path: "/market", icon: ShoppingBag, label: "Marché" },
  { path: "/production", icon: Hammer, label: "Production" },
  { path: "/travel", icon: Route, label: "Voyage" },
  { path: "/ranking", icon: Trophy, label: "Classement" },
  { path: "/quetes", icon: Target, label: "Quêtes" },
  { path: "/inventaire", icon: Package, label: "Inventaire" },
  { path: "/profile", icon: User, label: "Profil" },
];

export default function GameLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [navItems, setNavItems] = useState(BASE_NAV);
  const [showTutorial, setShowTutorial] = useState(false);
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user?.email && ADMIN_EMAILS.includes(user.email)) {
        setNavItems([...BASE_NAV, { path: "/admin", icon: Settings, label: "Admin" }]);
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}

      {/* Top Bar */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">⚜️</span>
            <h1 className="font-heading text-lg font-semibold tracking-wide text-foreground">
              Guildes & Couronnes
            </h1>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <a href="https://fr.tipeee.com/guildes-couronnes/" target="_blank" rel="noopener noreferrer" title="Soutenir le créateur">
              <Button variant="ghost" size="sm" className="gap-2 font-body text-sm">
                💝 Tipeee
              </Button>
            </a>
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link key={path} to={path}>
                <Button
                  variant={location.pathname === path ? "default" : "ghost"}
                  size="sm"
                  className="gap-2 font-body text-sm"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              </Link>
            ))}
            {/* Theme toggle — desktop */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              title="Basculer le thème"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {/* Tutorial button — desktop */}
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
                  className="w-full justify-start gap-3 font-body"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              </Link>
            ))}
            <a href="https://fr.tipeee.com/guildes-couronnes/" target="_blank" rel="noopener noreferrer" className="block">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 font-body"
              >
                💝 Soutenir
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
              href="https://fr.tipeee.com/guildes-couronnes/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMoreOpen(false)}
              className="flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-xs text-muted-foreground"
            >
              <span style={{fontSize:"20px"}}>💝</span>
              <span className="font-body">Soutenir</span>
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