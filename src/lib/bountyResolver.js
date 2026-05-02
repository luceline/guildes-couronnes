/**
 * bountyResolver.js
 *
 * Résolution des primes (bounties) après un combat PvP.
 * REFONTE v5 : la prime se déclenche quand l'attaquant gagne le combat zoné
 * (result === "attacker_won"), n'importe où dans le royaume. Premier gagnant
 * touche TOUTE la prime, le bounty passe à status="claimed".
 *
 * Usage côté Combat.jsx et ChallengeDefenseForm.jsx :
 *   await claimBountiesIfApplicable(base44, {
 *     attacker, defender, combatResult: resolution.result, cityId, cityName,
 *   });
 */

export async function claimBountiesIfApplicable(base44, params) {
  const { attacker, defender, combatResult, cityId = "", cityName = "" } = params;

  // Seul le cas "attaquant a gagné" déclenche le claim
  if (combatResult !== "attacker_won") return { claimed: 0, totalGold: 0 };

  // Récupère toutes les primes actives sur ce défenseur (peu importe la ville)
  let activeBounties = [];
  try {
    activeBounties = await base44.entities.Bounty.filter({
      target_email: defender.user_email,
      status: "active",
    }, "-created_date", 50);
  } catch (e) {
    return { claimed: 0, totalGold: 0 };
  }

  if (!activeBounties || activeBounties.length === 0) {
    return { claimed: 0, totalGold: 0 };
  }

  // Exclut les primes posées par l'attaquant lui-même (pas de claim sur ses propres primes)
  const eligibleBounties = activeBounties.filter(b => b.poster_email !== attacker.user_email);
  if (eligibleBounties.length === 0) return { claimed: 0, totalGold: 0 };

  // Cumule les primes éligibles (toutes versées au gagnant)
  let totalGold = 0;
  const claimedBounties = [];
  for (const b of eligibleBounties) {
    totalGold += (b.reward_gold || 0);
    claimedBounties.push(b);
  }

  if (totalGold <= 0) return { claimed: 0, totalGold: 0 };

  // Verse l'or à l'attaquant (récupère son or actuel pour éviter race condition)
  let freshAttacker = attacker;
  try {
    freshAttacker = await base44.entities.PlayerProfile.get(attacker.id);
  } catch (e) {
    // Si fail, on utilise l'attacker passé en paramètre
  }
  await base44.entities.PlayerProfile.update(attacker.id, {
    gold: (freshAttacker.gold || 0) + totalGold,
  });

  // Marque les bounties comme claimed
  const today = new Date().toISOString();
  for (const b of claimedBounties) {
    try {
      await base44.entities.Bounty.update(b.id, {
        status: "claimed",
        claimer_email: attacker.user_email,
        claimer_name: attacker.character_name || "",
        claimed_at: today,
      });
    } catch (e) {
      // Si l'update échoue, on continue avec les autres
      console.error("Bounty claim error:", e);
    }
  }

  // Log gold transactions et messages taverne (1 entrée par bounty)
  for (const b of claimedBounties) {
    try {
      await base44.entities.GoldTransaction.create({
        player_email: attacker.user_email,
        player_name: attacker.character_name || "",
        city_id: cityId,
        city_name: cityName,
        amount: b.reward_gold || 0,
        type: "combat_pvp_gain",
        description: `Prime touchée sur ${defender.character_name || ""} (posée par ${b.poster_name || "inconnu"})`,
      });
    } catch (e) { /* silent */ }

    try {
      await base44.entities.TavernMessage.create({
        author_email: "system",
        author_name: "Système",
        city_id: cityId,
        message: `🏴‍☠️ ${attacker.character_name || "Un chasseur"} a touché la prime de ${b.reward_gold || 0}💰 sur ${defender.character_name || "la cible"} (posée par ${b.poster_name || "inconnu"}).`,
        type: "combat",
      });
    } catch (e) { /* silent */ }
  }

  return { claimed: claimedBounties.length, totalGold };
}
