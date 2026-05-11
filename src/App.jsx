import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import SystemMessageBanner from './components/SystemMessageBanner';
import { ThemeProvider } from './lib/useTheme.jsx';
import { MusicProvider } from './lib/MusicContext';
import { VillageViewModeProvider } from './lib/useVillageViewMode';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import GameLayout from './components/GameLayout';
import Home from './pages/Home';
import CityPage from './pages/CityPage';
import MarketPage from './pages/MarketPage';
import TravelPage from './pages/TravelPage';
import ProfilePage from './pages/ProfilePage';
import ProductionPage from './pages/ProductionPage';
import AdminPage from './pages/AdminPage';
import TavernPage from './pages/TavernPage';
import AdminRulesInspector from './pages/AdminRulesInspector';
import QuestesPage from './pages/QuestesPage';
import InventairePage from './pages/InventairePage';
import ItemsExportPage from './pages/ItemsExportPage';
import RankingPageWrapper from './pages/RankingPageWrapper';
import CombatPage from './pages/CombatPage';
import CodexPage from './pages/CodexPage';
import LabeurHubPage from './pages/LabeurHubPage';
import AventureHubPage from './pages/AventureHubPage';
import SavoirHubPage from './pages/SavoirHubPage';
import landscapeBg from './assets/landscape.jpg';

// Injection de l'image de fond paysage en variable CSS (utilisée dans index.css)
if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--landscape-bg', `url(${landscapeBg})`);
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, showLoginForm, setShowLoginForm } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // 11/05/2026 : sur mobile, on skip la landing et on va direct au login
      // (gain immédiat d'1 tap, expérience plus proche d'une vraie app).
      // La landing reste pour desktop comme page marketing/présentation.
      const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
      if (showLoginForm || isMobile) return <LoginPage />;
      return <LandingPage />;
    }
  }

  // Afficher LoginPage si demandé même sans authError
  if (showLoginForm) return <LoginPage />;

  // Render the main app
  return (
    <Routes>
      <Route element={<GameLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/city" element={<CityPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/travel" element={<TravelPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/production" element={<ProductionPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/taverne" element={<TavernPage />} />
        <Route path="/admin/rules" element={<AdminRulesInspector />} />
        <Route path="/admin/items-export" element={<ItemsExportPage />} />
        <Route path="/quetes" element={<QuestesPage />} />
        <Route path="/inventaire" element={<InventairePage />} />
        <Route path="/ranking" element={<RankingPageWrapper />} />
        <Route path="/combat" element={<CombatPage />} />
        <Route path="/codex" element={<CodexPage />} />
        {/* Hubs : pages-passerelles regroupant des sous-pages thématiques */}
        <Route path="/labeur" element={<LabeurHubPage />} />
        <Route path="/aventure" element={<AventureHubPage />} />
        <Route path="/savoir" element={<SavoirHubPage />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App() {

  return (
    <ThemeProvider>
      <VillageViewModeProvider>
      <MusicProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
          <SystemMessageBanner />
          <AuthenticatedApp />
          <Toaster />
          <SonnerToaster />
        </Router>
      </QueryClientProvider>
    </AuthProvider>
    </MusicProvider>
    </VillageViewModeProvider>
    </ThemeProvider>
  )
}

export default App

