/**
 * ComptoirDrawer.jsx
 *
 * Drawer "Comptoir bancaire" — accessible depuis le sprite de la map.
 *
 * Affichage :
 *   - Onglet "Mon journal" (TOUJOURS dispo) : liste des transactions
 *     personnelles du joueur (gold_transactions filtrées par user_email).
 *   - Onglet "Banque" (UNIQUEMENT si la ville a construit le comptoir) :
 *     prêts, dépôts, taux. Réutilise BankPanel + cityBankHandlers.
 *
 * Si la ville n'a pas de comptoir, le 2e onglet est masqué et un message
 * informatif explique que le maire peut le construire pour activer les
 * services bancaires de la ville.
 *
 * Créé le 10/05/2026 dans le cadre de la refonte full-screen mobile +
 * unification de l'accès aux fonctions économiques perso.
 */
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import GoldTransactionHistory from "@/components/GoldTransactionHistory";
import BankPanel from "@/components/city/BankPanel";
import {
  handleSaveBankRates as bankSaveRates,
  handleRequestLoan as bankRequestLoan,
  handleRepayLoan as bankRepayLoan,
  handleBankDeposit as bankDeposit,
  handleClaimDeposit as bankClaimDeposit,
} from "@/lib/cityBankHandlers";

export default function ComptoirDrawer({ profile: profileProp, city: cityProp, onRefresh }) {
  // Quand le drawer est ouvert depuis VillageView, profile/city peuvent ne pas
  // être passés en prop (le wrapper de drawer ne les fournit pas systématiquement).
  // On les charge à la volée via base44.auth.me() pour être autonomes.
  const [profile, setProfile] = useState(profileProp || null);
  const [city, setCity] = useState(cityProp || null);
  const [homeCity, setHomeCity] = useState(null);
  const [loading, setLoading] = useState(!profileProp || !cityProp);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const user = await base44.auth.me();
        if (!user?.email) return;
        let p = profileProp;
        if (!p) {
          const profiles = await base44.entities.PlayerProfile.filter({ user_email: user.email });
          if (profiles.length > 0) p = profiles[0];
        }
        if (cancelled || !p) return;
        setProfile(p);

        // Ville actuelle (où le joueur est physiquement)
        let c = cityProp;
        if (!c && p.city_id) {
          c = await base44.entities.City.get(p.city_id).catch(() => null);
        }
        if (cancelled) return;
        setCity(c);

        // Ville d'origine (pour les opérations de banque qui sont liées à isHomeCity)
        if (p.home_city_id) {
          const hc = p.home_city_id === p.city_id
            ? c
            : await base44.entities.City.get(p.home_city_id).catch(() => null);
          if (!cancelled) setHomeCity(hc);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [profileProp, cityProp]);

  // Refresh local : recharge profile + city (et propage au parent si fourni)
  const refreshAll = async () => {
    const user = await base44.auth.me().catch(() => null);
    if (!user?.email) return;
    const profiles = await base44.entities.PlayerProfile.filter({ user_email: user.email });
    if (profiles.length > 0) {
      setProfile(profiles[0]);
      if (profiles[0].city_id) {
        const c = await base44.entities.City.get(profiles[0].city_id).catch(() => null);
        if (c) setCity(c);
      }
      if (profiles[0].home_city_id) {
        const hc = await base44.entities.City.get(profiles[0].home_city_id).catch(() => null);
        if (hc) setHomeCity(hc);
      }
    }
    if (typeof onRefresh === "function") onRefresh();
  };

  if (loading || !profile) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        Chargement du comptoir bancaire...
      </div>
    );
  }

  // Détections basées sur la ville où le joueur se trouve actuellement
  const hasComptoir = (city?.buildings || []).some(b => b.building_type === "comptoir");
  const isHomeCity = profile.home_city_id === city?.id;
  const isMayor = !!city && city.mayor_email === profile.user_email;
  // mayorActive : on ne fait pas la vérification stricte de la durée du mandat
  // ici (ce serait redondant avec ce que les handlers font déjà). On passe juste
  // isMayor — les handlers vérifient eux-mêmes mayor_term_end côté serveur.
  const mayorActive = isMayor;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="journal" className="w-full">
        <TabsList className="grid w-full grid-cols-2 font-heading">
          <TabsTrigger value="journal">📜 Mon journal</TabsTrigger>
          {/* Onglet Banque : visible uniquement si comptoir construit dans la ville */}
          {hasComptoir ? (
            <TabsTrigger value="banque">🏦 Banque de la ville</TabsTrigger>
          ) : (
            <TabsTrigger value="banque" disabled className="opacity-50">
              🔒 Banque (non construite)
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Mon journal : transactions perso (toujours dispo) ── */}
        <TabsContent value="journal" className="mt-4">
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-heading uppercase tracking-wider text-muted-foreground">
                  Solde actuel
                </span>
                <span className="font-mono text-2xl font-bold text-accent tabular-nums">
                  {profile.gold || 0}<span className="text-sm ml-1">💰</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-body">
                Toutes vos entrées et sorties d'or apparaissent ci-dessous.
              </p>
            </div>
            <GoldTransactionHistory playerEmail={profile.user_email} />
          </div>
        </TabsContent>

        {/* ── Banque : prêts/dépôts (uniquement si comptoir + isHomeCity) ── */}
        <TabsContent value="banque" className="mt-4">
          {!hasComptoir ? (
            <div className="bg-muted/30 border border-border rounded-xl px-4 py-6 text-center">
              <div className="text-3xl mb-2">🏦</div>
              <p className="font-heading text-base mb-1">Pas de comptoir dans cette ville</p>
              <p className="text-sm text-muted-foreground font-body">
                Demandez à votre maire de construire le <strong>comptoir bancaire</strong> pour
                activer les services de prêt et de dépôt à terme dans cette ville.
              </p>
            </div>
          ) : !isHomeCity ? (
            <div className="bg-muted/30 border border-border rounded-xl px-4 py-6 text-center">
              <div className="text-3xl mb-2">🏦</div>
              <p className="font-heading text-base mb-1">Comptoir réservé aux résidents</p>
              <p className="text-sm text-muted-foreground font-body">
                Cette ville possède un comptoir bancaire, mais vous devez y résider pour en profiter.
                Retournez dans votre ville d'origine pour gérer vos prêts et dépôts.
              </p>
            </div>
          ) : (
            <BankPanel
              city={city}
              profile={profile}
              isMayor={isMayor}
              onSaveRates={(loanRate, depositRate) => bankSaveRates({ city, onRefresh: refreshAll, loanRate, depositRate })}
              onRequestLoan={(amount) => bankRequestLoan({ profile, city, hasComptoir, mayorActive, onRefresh: refreshAll, amount })}
              onRepayLoan={(loan, idx) => bankRepayLoan({ profile, city, onRefresh: refreshAll, loan, idx })}
              onDeposit={(amount) => bankDeposit({ profile, city, hasComptoir, mayorActive, onRefresh: refreshAll, amount })}
              onClaimDeposit={(deposit, idx) => bankClaimDeposit({ profile, city, onRefresh: refreshAll, deposit, idx })}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
