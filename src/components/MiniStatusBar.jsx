/**
 * MiniStatusBar.jsx
 *
 * Status bar compacte toujours visible en haut de l'app (paysage mobile-first).
 * Affiche : Or + jauges Faim/Énergie/HP (sans valeurs numériques, juste les barres).
 *
 * Au tap : ouvre un drawer du HAUT contenant le PlayerStatusBar complet
 * (avec valeurs détaillées, actions de consommation, etc.).
 *
 * Créé le 10/05/2026 dans le cadre de la refonte full-screen paysage mobile.
 */
import { useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { PROFESSIONS, MAX_HUNGER, getMaxFatigue, getMaxHunger, getCityFatigueBonus, getCityHungerBonus } from "@/lib/gameData";
import { computeFatigueWithDailyReset } from "@/lib/craftingData";
import PlayerStatusBar from "@/components/PlayerStatusBar";

// Couleur unifiée pour les jauges selon le %
function gaugeColor(pct) {
  if (pct >= 60) return "bg-green-500";
  if (pct >= 30) return "bg-amber-400";
  return "bg-red-500";
}

// Mini jauge horizontale : icone + barre, pas de chiffres
function MiniGauge({ icon, value, max }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <span className="text-base leading-none">{icon}</span>
      <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${gaugeColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Drawer du HAUT (custom, vaul direction="top") ───────────────────────
// Le DrawerContent par défaut de shadcn/vaul est positionné en bottom.
// Pour un drawer du haut, on utilise DrawerPrimitive directement.
function TopDrawer({ open, onOpenChange, children }) {
  return (
    <DrawerPrimitive.Root
      direction="top"
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <DrawerPrimitive.Content
          className={cn(
            "fixed inset-x-0 top-0 z-50 mb-24 flex h-auto max-h-[90vh] flex-col rounded-b-[10px] border bg-background",
            "overflow-y-auto"
          )}
        >
          <DrawerPrimitive.Title className="sr-only">Détails du joueur</DrawerPrimitive.Title>
          <div className="px-4 py-4">{children}</div>
          {/* Zone de poignée pour swipe-to-close (10/05/2026) :
           * - Zone tactile élargie (py-3) pour faciliter le grip au doigt
           * - Poignée visible plus grande (h-1.5 w-[120px])
           * - Background subtil en hover/active pour feedback */}
          <div
            className="cursor-grab active:cursor-grabbing flex items-center justify-center py-3 hover:bg-muted/30 transition-colors"
            aria-label="Tirer pour fermer"
          >
            <div className="h-1.5 w-[120px] rounded-full bg-muted-foreground/40" />
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

export default function MiniStatusBar({ profile, homeCity, city, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  if (!profile) return null;

  // Calculs minimaux pour les jauges (sans afficher les chiffres)
  // Fix 10/05/2026 : utiliser les helpers buildings → bonus (pas l'objet city)
  const homeBuildings = homeCity?.buildings || [];
  const maxHungerVal = getMaxHunger(profile, getCityHungerBonus(homeBuildings)) || MAX_HUNGER;
  const maxFatigue = getMaxFatigue(profile, getCityFatigueBonus(homeBuildings));
  const { fatigue } = computeFatigueWithDailyReset(profile, maxFatigue);
  const hunger = profile.hunger ?? MAX_HUNGER;
  const hp = profile.hp ?? 0;
  const maxHp = 10;

  return (
    <>
      {/* ── Mini bar : 1 ligne compacte, cliquable ──
       * - Desktop (sticky en haut) : barre pleine largeur avec or + 3 jauges
       * - Mobile (bouton flottant) : juste l'or + un cœur ❤️ pour cliquer
       *   (les jauges sont dans le drawer pour ne pas encombrer la map)
       * ──────────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden md:flex w-full items-center gap-2 px-3 py-1.5 bg-card/70 border-b border-border hover:bg-card/90 transition-colors text-left"
        aria-label="Voir les détails du joueur"
      >
        {/* Or */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-base leading-none">💰</span>
          <span className="font-mono font-semibold text-sm tabular-nums text-accent">
            {profile.gold || 0}
          </span>
        </div>

        {/* 3 jauges côte à côte */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <MiniGauge icon="🍞" value={hunger} max={maxHungerVal} />
          <MiniGauge icon="⚡" value={fatigue} max={maxFatigue} />
          <MiniGauge icon="❤️" value={hp} max={maxHp} />
        </div>

        {/* Indicateur swipe / chevron */}
        <span className="text-xs text-muted-foreground shrink-0 ml-1">▼</span>
      </button>

      {/* ── Mobile : bar compacte sur 2 LIGNES (11/05/2026) ──
       * Ligne 1 : 💰 Or · ⚡ Énergie
       * Ligne 2 : 🍞 Faim · ❤️ HP
       * 2 lignes au lieu d'1 pour ne pas déborder sur le nom de ville en
       * mode menu (rendre la status bar plus compacte en largeur).
       * Tap → ouvre le drawer du haut avec les détails et actions.
       * ────────────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden flex flex-col items-center gap-0.5 px-2.5 py-1 bg-card/90 backdrop-blur-sm border border-border rounded-xl shadow-lg hover:bg-card transition-colors"
        aria-label="Voir les détails du joueur"
      >
        {/* Ligne 1 : Or · Énergie */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 shrink-0">
            <span className="text-sm leading-none">💰</span>
            <span className="font-mono font-semibold text-xs tabular-nums text-accent">
              {profile.gold || 0}
            </span>
          </div>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <div className="flex items-center gap-0.5 shrink-0">
            <span className="text-sm leading-none">⚡</span>
            <span className={`font-mono font-semibold text-xs tabular-nums ${fatigue <= 3 ? "text-red-500" : "text-foreground"}`}>
              {fatigue}/{maxFatigue}
            </span>
          </div>
        </div>

        {/* Ligne 2 : Faim · HP */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 shrink-0">
            <span className="text-sm leading-none">🍞</span>
            <span className={`font-mono font-semibold text-xs tabular-nums ${hunger <= 3 ? "text-red-500" : "text-foreground"}`}>
              {hunger}/{maxHungerVal}
            </span>
          </div>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <div className="flex items-center gap-0.5 shrink-0">
            <span className="text-sm leading-none">{hp <= 3 ? "💔" : "❤️"}</span>
            <span className={`font-mono font-semibold text-xs tabular-nums ${hp <= 3 ? "text-red-500" : "text-foreground"}`}>
              {hp}/{maxHp}
            </span>
          </div>
        </div>
      </button>

      {/* ── Drawer du haut : contenu complet ── */}
      <TopDrawer open={open} onOpenChange={setOpen}>
        <PlayerStatusBar
          profile={profile}
          homeCity={homeCity}
          city={city}
          onRefresh={onRefresh}
        />
        {/* Bouton déconnexion (10/05/2026) ── confirmation à 2 clics pour
         * éviter les déco accidentelles. */}
        <div className="border-t border-border mt-4 pt-4 flex justify-center">
          {confirmLogout ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-body text-muted-foreground">
                Confirmer ?
              </span>
              <button
                type="button"
                onClick={() => base44.auth.logout()}
                className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md font-heading text-sm hover:opacity-90"
              >
                Oui, déconnecter
              </button>
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="px-3 py-1.5 bg-muted text-foreground rounded-md font-heading text-sm hover:opacity-90"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-body text-muted-foreground border border-border rounded-md hover:bg-muted/50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </button>
          )}
        </div>
      </TopDrawer>
    </>
  );
}
