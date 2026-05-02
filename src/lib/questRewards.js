/**
 * questRewards.js : Fonction centrale pour valider et récompenser les quêtes
 *
 * Usage :
 *   import { checkAndAwardObjective, isTodayQuest } from '@/lib/questRewards';
 *
 *   const result = await checkAndAwardObjective({
 *     obj,           // l'objet PlayerObjective
 *     addedQty,      // quantité ajoutée par l'action
 *     profile,       // profil du joueur
 *     city,          // ville courante (optionnel, pour le log)
 *   });
 *
 *   result.completed  → boolean
 *   result.reward     → nombre d'or versé
 */

import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { getQuestNarration } from './questNarration';

const todayStr = () => new Date().toISOString().split('T')[0];

/**
 * Vérifie si une quête appartient à aujourd'hui.
 * Compatible avec created_date (PocketBase) et quest_date (champ custom).
 */
export function isTodayQuest(obj) {
  const d = obj?.quest_date || obj?.created_date || '';
  return d.startsWith(todayStr());
}

/**
 * Met à jour la progression d'une quête et verse la récompense si complète.
 * Fait un GET frais du profil avant de modifier l'or pour éviter les race conditions.
 *
 * @param {object} params
 * @param {object} params.obj       - Enregistrement PlayerObjective
 * @param {number} params.addedQty  - Quantité ajoutée
 * @param {object} params.profile   - Profil joueur (pour l'id et l'email)
 * @param {object} [params.city]    - Ville courante (pour le log GoldTransaction)
 * @returns {{ completed: boolean, reward: number }}
 */
export async function checkAndAwardObjective({ obj, addedQty, profile, city = null }) {
  // ── Sécurité : vérifications avant toute écriture ──
  if (!obj?.id) return { completed: false, reward: 0 };
  // La quête doit appartenir au joueur connecté
  if (obj.player_email !== profile.user_email) {
    console.warn('checkAndAwardObjective: quête non autorisée', obj.id);
    return { completed: false, reward: 0 };
  }
  // La quête doit être d'aujourd'hui
  if (!isTodayQuest(obj)) {
    console.warn('checkAndAwardObjective: quête périmée', obj.id);
    return { completed: false, reward: 0 };
  }
  // La quête ne doit pas être déjà complétée
  if (obj.status === 'completed') return { completed: true, reward: 0 };

  // GET frais de la quête pour éviter les race conditions (clics rapides)
  const freshObj = await base44.entities.PlayerObjective.get(obj.id).catch(() => null);
  if (!freshObj) return { completed: false, reward: 0 };
  if (freshObj.status === 'completed') return { completed: true, reward: 0 };

  const newQty = (freshObj.current_quantity || 0) + addedQty;
  const completed = newQty >= (freshObj.target_quantity || obj.target_quantity || 1);

  await base44.entities.PlayerObjective.update(obj.id, {
    current_quantity: newQty,
    status: completed ? 'completed' : 'active',
  });

  if (!completed) return { completed: false, reward: 0 };

  const reward = obj.reward_gold || 0;
  if (reward > 0) {
    // GET frais pour éviter les race conditions sur l'or
    const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
    const currentGold = freshP ? (freshP.gold || 0) : (profile.gold || 0);
    await base44.entities.PlayerProfile.update(profile.id, {
      gold: currentGold + reward,
    });

    // Log transaction
    try {
      await base44.entities.GoldTransaction.create({
        player_email: profile.user_email,
        player_name:  profile.character_name || '',
        city_id:      city?.id   || '',
        city_name:    city?.name || '',
        amount:       reward,
        type:         'objectif',
        description:  `Quête accomplie : ${obj.title || obj.target_item || obj.type}`,
      });
    } catch (_) {}

    toast.success(getQuestNarration(obj.type, reward, obj.id), { duration: 8000 });
  } else {
    toast.success(`🎉 Quête accomplie : ${obj.title || ''} !`);
  }

  return { completed: true, reward };
}

/**
 * Filtre une liste d'objectifs pour ne garder que ceux d'aujourd'hui, actifs, non-contrats.
 */
export function filterTodayActiveObjectives(objectives, type = null) {
  return objectives.filter(o => {
    if (o.status !== 'active') return false;
    if (o.parchemin_type) return false;
    if (!isTodayQuest(o)) return false;
    if (type && o.type !== type) return false;
    return true;
  });
}
