import { base44 } from "@/api/base44Client";
import { getTodayDateStr, MAYOR_DAYS } from "@/lib/gameData";

export async function checkAndProclamWinner(city, onRefresh) {
  if (!city?.mayor_until) return;
  
  const todayStr = getTodayDateStr();
  if (city.mayor_until >= todayStr) return; // Mandat pas expiré
  
  // Mandat expiré → proclamer le gagnant
  const candidates = city.election_candidates || [];
  const votes = city.election_votes || {};
  
  if (candidates.length === 0) {
    // Pas de candidat → réinitialiser
    await base44.entities.City.update(city.id, {
      election_candidates: [],
      election_votes: {},
    });
    onRefresh?.();
    return;
  }
  
  // Compter les votes
  const voteCounts = {};
  candidates.forEach(c => {
    voteCounts[c.player_email] = Object.values(votes).filter(v => v === c.player_email).length;
  });
  
  // Déterminer le gagnant (plus de votes, en cas égalité = premier déclaré)
  let winner = candidates[0];
  for (const c of candidates) {
    if ((voteCounts[c.player_email] || 0) > (voteCounts[winner.player_email] || 0)) {
      winner = c;
    }
  }
  
  // Mettre à jour le maire
  const newMayorUntil = new Date();
  newMayorUntil.setDate(newMayorUntil.getDate() + MAYOR_DAYS);
  await base44.entities.City.update(city.id, {
    mayor_id: winner.player_id || winner.player_email,
    mayor_name: winner.player_name,
    mayor_until: newMayorUntil.toISOString().split("T")[0],
    election_candidates: [],
    election_votes: {},
  });
  onRefresh?.();
}