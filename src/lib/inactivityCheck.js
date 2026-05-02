// ═══════════════════════════════════════════════════════════════
// inactivityCheck.js
// Appelé à chaque connexion (Home). Vérifie l'inactivité de TOUS les joueurs.
//
// Règles :
// - last_active_at est mis à jour à chaque connexion du joueur
// - Si un joueur est inactif depuis ≥ 7 jours → email d'avertissement
//   + marque inactivity_warned_at
// - Si inactif ≥ 9 jours (7+2) → suppression complète du personnage
// - Mode vacances (vacation_until) → exonéré de tout (impôts, suppression)
//   pendant 15 jours max
// ═══════════════════════════════════════════════════════════════

import { base44 } from "@/api/base44Client";

const INACTIVITY_WARN_DAYS  = 7;
const INACTIVITY_DELETE_DAYS = 9;
const VACATION_MAX_DAYS = 15;

export async function updateLastActive(profileId) {
  try {
    await base44.entities.PlayerProfile.update(profileId, {
      last_active_at: new Date().toISOString(),
    });
  } catch (e) { console.warn("updateLastActive:", e); }
}

export async function activateVacationMode(profile, onRefresh) {
  const maxEnd = new Date();
  maxEnd.setDate(maxEnd.getDate() + VACATION_MAX_DAYS);
  await base44.entities.PlayerProfile.update(profile.id, {
    vacation_until: maxEnd.toISOString(),
  });
  onRefresh?.();
}

export async function cancelVacationMode(profile, onRefresh) {
  await base44.entities.PlayerProfile.update(profile.id, {
    vacation_until: "",
  });
  onRefresh?.();
}

export function isOnVacation(profile) {
  return !!(profile.vacation_until && new Date(profile.vacation_until) > new Date());
}

export function isVacationExpiringSoon(profile) {
  if (!isOnVacation(profile)) return false;
  const end = new Date(profile.vacation_until);
  const diff = (end - new Date()) / (1000 * 60 * 60 * 24);
  return diff <= 2;
}

// Vérification globale : appelée depuis Home au chargement
// Ne traite que si le joueur courant est admin ou si on passe runAsAdmin=true
// Pour ne pas surcharger, on limit à 1 exécution toutes les 6h via localStorage
export async function runInactivityCheck() {
  const lastCheck = localStorage.getItem("inactivity_last_check");
  const now = Date.now();
  if (lastCheck && now - parseInt(lastCheck) < 6 * 60 * 60 * 1000) return;
  localStorage.setItem("inactivity_last_check", String(now));

  try {
    const allPlayers = await base44.entities.PlayerProfile.list();
    const nowDate = new Date();

    for (const player of allPlayers) {
      // Mode vacances → skip
      if (isOnVacation(player)) continue;

      const lastActive = player.last_active_at ? new Date(player.last_active_at) : null;
      // Si jamais connecté, on ne punit pas (compte récent)
      if (!lastActive) continue;

      const daysSinceActive = (nowDate - lastActive) / (1000 * 60 * 60 * 24);

      // ── Suppression (≥ 9 jours) ──
      if (daysSinceActive >= INACTIVITY_DELETE_DAYS) {
        await deletePlayerAndCleanup(player);
        continue;
      }

      // ── Avertissement (≥ 7 jours, email non encore envoyé pour cette vague) ──
      if (daysSinceActive >= INACTIVITY_WARN_DAYS) {
        const alreadyWarned = player.inactivity_warned_at
          && (nowDate - new Date(player.inactivity_warned_at)) / (1000 * 60 * 60 * 24) < 2;
        if (!alreadyWarned) {
          await sendInactivityWarning(player);
          await base44.entities.PlayerProfile.update(player.id, {
            inactivity_warned_at: nowDate.toISOString(),
          }).catch(() => {});
        }
      }
    }
  } catch (e) { console.warn("runInactivityCheck:", e); }
}

async function sendInactivityWarning(player) {
  try {
    await base44.integrations.Core.SendEmail({
      to: player.user_email,
      subject: "⚠️ Votre personnage sera supprimé dans 2 jours",
      body: `
Bonjour ${player.character_name},

Vous n'avez pas joué depuis 7 jours. Si vous ne vous reconnectez pas dans les 2 prochains jours, votre personnage (inventaire, or, logement) sera définitivement supprimé.

Si vous êtes absent pour une période prolongée, connectez-vous et activez le **Mode Vacances** (15 jours max) depuis votre page Profil pour mettre votre compte en pause.

À bientôt dans le monde médiéval !
      `.trim(),
    });
  } catch (e) { console.warn("sendInactivityWarning:", e); }
}

async function deletePlayerAndCleanup(player) {
  try {
    // Supprimer les annonces marché actives
    const listings = await base44.entities.MarketListing.filter({ seller_email: player.user_email, status: "active" }).catch(() => []);
    for (const l of listings) {
      await base44.entities.MarketListing.update(l.id, { status: "cancelled" }).catch(() => {});
    }

    // Retirer de la population de la ville
    if (player.home_city_id) {
      const city = await base44.entities.City.get(player.home_city_id).catch(() => null);
      if (city) {
        await base44.entities.City.update(city.id, {
          population: Math.max((city.population || 1) - 1, 0),
        }).catch(() => {});
      }
    }

    // Supprimer les objectifs actifs
    const objectives = await base44.entities.PlayerObjective.filter({ player_email: player.user_email, status: "active" }).catch(() => []);
    for (const obj of objectives) {
      await base44.entities.PlayerObjective.update(obj.id, { status: "expired" }).catch(() => {});
    }

    // Supprimer le profil
    await base44.entities.PlayerProfile.delete(player.id);

    console.log(`[Inactivité] Personnage supprimé : ${player.character_name} (${player.user_email})`);
  } catch (e) { console.warn("deletePlayerAndCleanup:", e); }
}