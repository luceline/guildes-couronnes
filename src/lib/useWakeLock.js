/**
 * useWakeLock.js — Hook React pour empêcher l'écran de s'éteindre.
 *
 * Créé le 12/05/2026.
 *
 * API : navigator.wakeLock.request("screen") — standard W3C Screen Wake Lock API.
 * Supporté : Chrome 84+, Edge 84+, Safari 16.4+, Firefox 126+, Chrome Android,
 * Safari iOS 16.4+. Fallback silencieux pour navigateurs non supportés.
 *
 * Spécificités :
 *   - Le navigateur libère AUTOMATIQUEMENT le lock quand l'onglet passe en
 *     arrière-plan (visibilitychange → hidden). C'est par design : on ne
 *     bloque pas l'écran quand l'utilisateur quitte l'app. Du coup, il faut
 *     ré-acquérir le lock au retour (visible) si le hook est encore actif.
 *   - Sur iOS, le lock peut être refusé silencieusement (return null) si la
 *     page n'a pas reçu d'interaction utilisateur récente.
 *   - L'objet WakeLockSentinel a un event "release" qui nous notifie quand
 *     le lock est relâché (par nous ou par le système).
 *
 * Usage :
 *   useWakeLock(true);   // actif tant que le composant est monté
 *   useWakeLock(combatActif);  // actif conditionnellement
 *
 * Le hook gère :
 *   - acquisition au mount (si enabled=true)
 *   - libération au unmount
 *   - ré-acquisition automatique au retour de visibilité
 *   - réactivité à enabled (libère immédiatement si passe à false)
 */
import { useEffect, useRef } from "react";

export function useWakeLock(enabled = true) {
  // Ref pour stocker le sentinel actuel (utilisé par cleanup et listeners).
  // Pas un state car on ne veut pas re-render quand il change.
  const sentinelRef = useRef(null);

  useEffect(() => {
    // Si désactivé ou API non supportée : on ne fait rien.
    // navigator.wakeLock peut être undefined (vieux navigateur, contexte HTTP)
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.wakeLock) return;

    let cancelled = false;

    const acquire = async () => {
      try {
        // Si déjà acquis et pas libéré, ne rien faire
        if (sentinelRef.current && !sentinelRef.current.released) return;
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          // Hook démonté pendant la requête : libérer immédiatement
          sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        // Listener "release" : si le système libère (visibilitychange par ex),
        // on met juste à jour notre ref. La ré-acquisition se fera via
        // l'event handler visibilitychange ci-dessous.
        sentinel.addEventListener("release", () => {
          // Pas grand chose à faire ici, le sentinel se marquera released=true
          // automatiquement. On garde le handler pour debug éventuel.
        });
      } catch (e) {
        // Erreurs typiques : NotAllowedError (politique navigateur),
        // SecurityError (frame cross-origin). On reste silencieux pour ne
        // pas polluer la console des joueurs.
        // console.debug("[wakeLock] acquisition échouée:", e?.name);
      }
    };

    // Re-acquérir le lock quand l'onglet redevient visible
    // (le système a relâché en passant en hidden)
    const onVisibility = () => {
      if (document.visibilityState === "visible" && enabled) {
        acquire();
      }
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      // Libérer explicitement à la sortie. .release() est async mais on ne
      // l'attend pas (cleanup sync). Si le sentinel est déjà released, no-op.
      if (sentinelRef.current && !sentinelRef.current.released) {
        sentinelRef.current.release().catch(() => {});
      }
      sentinelRef.current = null;
    };
  }, [enabled]);
}
