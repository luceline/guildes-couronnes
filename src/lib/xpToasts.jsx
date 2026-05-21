/**
 * xpToasts.js : helper centralisé pour les toasts de gain d'XP.
 *
 * Avant : 10+ endroits dupliquaient le pattern :
 *   toast.success(`✨ +${amount} XP`);
 *   if (xpGain.leveledUp) toast.success(`🌟 Niveau ${xpGain.newLevel} atteint !`);
 *
 * Maintenant un seul appel : `showXPToast(amount, xpGain)`.
 *
 * Bonus : toasts plus dopaminergiques que des `toast.success` standards :
 *   - Gain XP simple : gradient doré, emoji animé
 *   - Level-up : toast plus voyant, durée plus longue, effet "burst"
 */
import { toast } from "sonner";

// ID du dernier toast XP affiché. On le ferme à chaque nouveau gain pour éviter
// l'empilement quand le joueur enchaîne plusieurs actions XP rapidement (ex: 5
// récoltes d'affilée). Le résultat : un seul toast XP visible à un instant
// donné, qui s'actualise au lieu de se superposer.
let _lastXPToastId = null;

/**
 * Affiche le ou les toasts d'un gain d'XP.
 *
 * @param {number} amount - Le montant d'XP gagné (sera affiché tel quel)
 * @param {object} xpGain - Le résultat de grantXP() : { leveledUp, newLevel, ... }
 * @param {object} [options]
 * @param {string} [options.icon] - Icône à préfixer (ex: "📜" pour parchemin). Défaut "✨"
 * @param {string} [options.context] - Contexte court ("récolte", "craft", "combat") affiché en sous-ligne
 */
export function showXPToast(amount, xpGain, options = {}) {
  if (!amount || amount <= 0) return;
  const { icon = "✨", context = null } = options;

  // Ferme le toast XP précédent s'il est encore affiché (anti-empilement)
  if (_lastXPToastId !== null) {
    toast.dismiss(_lastXPToastId);
  }

  // Toast principal : gain XP avec style or scintillant (en HAUT-DROITE
  // pour ne pas se superposer aux toasts d'action en bas-droite).
  // 17/05/2026 : zIndex 100000 explicite pour passer au-dessus des drawers
  // Vaul (z-50) et autres overlays. Sans ça, le toast peut apparaître
  // assombri/illisible derrière le scrim d'un drawer ouvert.
  _lastXPToastId = toast.custom(
    (t) => (
      <div
        className="bg-gradient-to-r from-amber-500/95 to-yellow-400/95 text-amber-950 rounded-lg shadow-lg px-4 py-2.5 flex items-center gap-3 border border-amber-300 backdrop-blur-sm"
        style={{ minWidth: "240px", zIndex: 100000, position: "relative" }}
      >
        <span className="text-2xl animate-pulse" style={{ animationDuration: "1.2s" }}>{icon}</span>
        <div className="flex-1">
          <div className="font-bold text-base leading-tight">+{amount} XP</div>
          {context && <div className="text-xs opacity-80 leading-tight">{context}</div>}
        </div>
      </div>
    ),
    { duration: 1800, position: "top-center" }
  );

  // Toast level-up : plus gros, plus long, effet "burst" or — en HAUT-CENTRE
  // pour un impact maximal (c'est un événement rare et important)
  if (xpGain?.leveledUp) {
    setTimeout(() => {
      toast.custom(
        (t) => (
          <div
            className="bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 text-amber-950 rounded-xl shadow-2xl px-5 py-3.5 flex items-center gap-3 border-2 border-yellow-200"
            style={{ minWidth: "260px", boxShadow: "0 0 30px rgba(251, 191, 36, 0.5)", zIndex: 100000, position: "relative" }}
          >
            <span className="text-3xl animate-bounce" style={{ animationDuration: "0.6s" }}>🌟</span>
            <div className="flex-1">
              <div className="font-bold text-lg leading-tight tracking-wide">NIVEAU {xpGain.newLevel} !</div>
              <div className="text-xs opacity-90 leading-tight font-medium">Vos compétences s'épanouissent</div>
            </div>
          </div>
        ),
        { duration: 4000, position: "top-center" }
      );
    }, 400); // léger délai pour que l'enchaînement XP → level se ressente
  }
}
