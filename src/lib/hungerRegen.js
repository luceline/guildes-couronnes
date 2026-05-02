import { base44 } from "@/api/base44Client";
import { getMaxFatigue, getMaxHunger, getRegenCap, getRegenInterval, REGEN_AUTO_CAP } from "./gameData";

// Régénération passive unifiée : à chaque "tick" (intervalle déterminé par le logement
// et la Fontaine de la ville), on gagne 1 point aléatoirement sur faim ou énergie.
// Si la jauge tirée est déjà au plafond, on bascule sur l'autre. Si les deux sont au
// plafond, le tick est consommé sans effet.
//
// Intervalles de base : tente=1h, cabane=50min, maison=40min, manoir=30min.
// Avec Fontaine : tous divisés par 2.
//
// Plafond : 5 par défaut, +1 par niveau d'Hospice (max 10).
//
// Rattrapage offline : on accumule les ticks écoulés depuis la dernière exécution.
//
// Un seul timestamp est utilisé (`fatigue_regen_at`) pour piloter les deux jauges,
// puisque la régen est désormais commune. `hunger_regen_at` est conservé pour la
// régen Fontaine spéciale (cf. Production.jsx, désormais retirée : historique).
//
// @param p     PlayerProfile
// @param city  City (optionnel : sert pour Hospice et Fontaine)
export async function applyHungerRegen(p, city = null) {
  const updates = {};
  const buildings = city?.buildings || [];

  const interval = getRegenInterval(p.housing_level || "tente", buildings);
  if (!interval) return p;

  // Première fois : on pose juste le timestamp, le rattrapage commencera au prochain appel.
  if (!p.fatigue_regen_at) {
    updates.fatigue_regen_at = new Date().toISOString();
    await base44.entities.PlayerProfile.update(p.id, updates).catch(() => {});
    return { ...p, ...updates };
  }

  const lastRegen = new Date(p.fatigue_regen_at).getTime();
  const ticks = Math.floor((Date.now() - lastRegen) / interval);
  if (ticks < 1) return p;

  const cap = getRegenCap(buildings);

  // On part de l'état courant. Si une jauge est déjà au-dessus du cap (consommables, items),
  // on n'y touche pas : la régen ne descend jamais une jauge.
  const startHunger  = p.hunger  ?? getMaxHunger(p);
  const startFatigue = p.fatigue ?? getMaxFatigue(p);
  let hunger  = startHunger;
  let fatigue = startFatigue;

  // Tirage aléatoire pour chaque tick, en respectant le cap sur chaque jauge individuellement.
  for (let i = 0; i < ticks; i++) {
    const hungerCanGain  = hunger  < cap;
    const fatigueCanGain = fatigue < cap;
    if (!hungerCanGain && !fatigueCanGain) break;

    const tryHunger = Math.random() < 0.5;
    if (tryHunger && hungerCanGain) {
      hunger++;
    } else if (!tryHunger && fatigueCanGain) {
      fatigue++;
    } else if (hungerCanGain) {
      hunger++;
    } else if (fatigueCanGain) {
      fatigue++;
    }
  }

  if (hunger  > startHunger)  updates.hunger  = hunger;
  if (fatigue > startFatigue) updates.fatigue = fatigue;
  updates.fatigue_regen_at = new Date().toISOString();

  if (Object.keys(updates).length === 1 && updates.fatigue_regen_at) {
    // Aucune jauge n'a changé, mais on a pas mal traîné : on rafraîchit le timestamp quand même
    // pour ne pas accumuler indéfiniment de ticks lors de la prochaine connexion.
  }

  await base44.entities.PlayerProfile.update(p.id, updates).catch(() => {});
  return { ...p, ...updates };
}