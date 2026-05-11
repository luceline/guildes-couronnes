/**
 * SettingsPanel.jsx (11/05/2026, v3)
 *
 * Drawer / panneau de paramètres utilisateur, accessible depuis le bouton
 * flottant ⚙️ en haut à droite de l'écran.
 *
 * Sections :
 *   - Affichage : vue village (Auto/Carte/Menu), thème clair/sombre
 *   - Audio (placeholder)
 *   - Notifications (placeholder)
 *   - Compte : bouton admin (si admin), déconnexion
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/lib/useTheme.jsx";
import { useVillageViewMode } from "@/lib/useVillageViewMode";
import { useAuth } from "@/lib/AuthContext";
import { ADMIN_EMAILS } from "@/lib/gameData";

export default function SettingsPanel() {
  const { isDark, toggleTheme } = useTheme();
  const { override, setOverride, mode, orientation } = useVillageViewMode();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // Modale de confirmation déconnexion
  const [confirmLogout, setConfirmLogout] = useState(false);

  // 11/05/2026 : check admin via ADMIN_EMAILS (pattern utilisé dans GameLayout)
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  return (
    <div className="space-y-5 pb-4">
      {/* ─── Affichage ─── */}
      <section>
        <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Affichage
        </h3>

        {/* Vue du village : 3 modes */}
        <div className="space-y-2">
          <div className="text-sm font-body font-semibold">Vue du village</div>
          <div className="text-[11px] font-body text-muted-foreground leading-tight mb-2">
            En mode Auto, la vue suit l'orientation de votre téléphone : carte en paysage, menu en portrait.
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setOverride("auto")}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                override === "auto"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <span className="text-xl">🔄</span>
              <span className="text-xs font-heading font-semibold">Auto</span>
              <span className="text-[10px] font-body text-muted-foreground text-center leading-tight">
                Selon orientation
              </span>
            </button>
            <button
              onClick={() => setOverride("map")}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                override === "map"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <span className="text-xl">🏰</span>
              <span className="text-xs font-heading font-semibold">Carte</span>
              <span className="text-[10px] font-body text-muted-foreground text-center leading-tight">
                Toujours la carte
              </span>
            </button>
            <button
              onClick={() => setOverride("menu")}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                override === "menu"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <span className="text-xl">📋</span>
              <span className="text-xs font-heading font-semibold">Menu</span>
              <span className="text-[10px] font-body text-muted-foreground text-center leading-tight">
                Toujours le menu
              </span>
            </button>
          </div>

          {/* Indicateur état actuel */}
          {override === "auto" && (
            <div className="mt-2 px-2 py-1 rounded bg-muted/50 text-[11px] font-body text-muted-foreground">
              Actuellement : <span className="font-semibold">{mode === "map" ? "🏰 Carte" : "📋 Menu"}</span>
              {" "}({orientation === "portrait" ? "portrait" : "paysage"})
            </div>
          )}
        </div>

        {/* Thème clair / sombre */}
        <div className="mt-4 flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{isDark ? "🌙" : "☀️"}</span>
            <div className="min-w-0">
              <div className="text-sm font-body font-semibold">Thème</div>
              <div className="text-[11px] font-body text-muted-foreground">
                {isDark ? "Sombre" : "Clair"}
              </div>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            role="switch"
            aria-checked={isDark}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors ${
              isDark ? "bg-primary border-primary" : "bg-muted border-border"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                isDark ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </section>

      {/* ─── Audio (placeholder) ─── */}
      <section>
        <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Audio
        </h3>
        <div className="p-3 rounded-lg border border-dashed border-border bg-muted/30 text-xs font-body italic text-muted-foreground">
          🔊 Bientôt : volume et son du jeu
        </div>
      </section>

      {/* ─── Notifications (placeholder) ─── */}
      <section>
        <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Notifications
        </h3>
        <div className="p-3 rounded-lg border border-dashed border-border bg-muted/30 text-xs font-body italic text-muted-foreground">
          🔔 Bientôt : notifications push (cooldowns, combats, marché…)
        </div>
      </section>

      {/* ─── Compte (11/05/2026) ─── */}
      <section>
        <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Compte
        </h3>
        <div className="space-y-2">
          {/* Email (lecture seule, info) */}
          {user?.email && (
            <div className="px-3 py-2 rounded-lg bg-muted/30 text-xs font-body text-muted-foreground truncate">
              {user.email}
            </div>
          )}

          {/* Bouton admin (visible uniquement si admin) */}
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 text-sm font-body font-semibold transition-colors"
            >
              🛠️ Administration
            </button>
          )}

          {/* Bouton déconnexion */}
          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-300 text-red-700 text-sm font-body font-semibold transition-colors"
          >
            🚪 Se déconnecter
          </button>
        </div>
      </section>

      {/* Modale confirmation déconnexion */}
      {confirmLogout && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirmLogout(false)}
        >
          <div
            className="bg-card rounded-lg shadow-xl border border-border p-4 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-base font-bold mb-2">Se déconnecter ?</h3>
            <p className="text-sm font-body text-muted-foreground mb-4">
              Vous serez redirigé vers la page de connexion. Vos données et votre progression restent sauvegardées.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmLogout(false)}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm font-body"
              >
                Annuler
              </button>
              <button
                onClick={() => { logout(); }}
                className="flex-1 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-body font-semibold"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
