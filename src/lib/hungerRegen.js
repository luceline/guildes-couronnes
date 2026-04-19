import { base44 } from "@/api/base44Client";
import { getFatigueRegenInterval, getMaxFatigue } from "./gameData";

// Applique la regen faim (+1/h) et énergie (selon logement) avec rattrapage offline
export async function applyHungerRegen(p) {
  const updates = {};

  // ── Faim : +1 / heure ──
  const HUNGER_REGEN_INTERVAL = 3600000;
  const maxHunger = 10 + (p.hunger_max_bonus || 0);
  const hunger = p.hunger ?? maxHunger;
  if (hunger < maxHunger) {
    if (!p.hunger_regen_at) {
      updates.hunger_regen_at = new Date().toISOString();
    } else {
      const lastRegen = new Date(p.hunger_regen_at).getTime();
      const intervals = Math.floor((Date.now() - lastRegen) / HUNGER_REGEN_INTERVAL);
      if (intervals >= 1) {
        updates.hunger = Math.min(maxHunger, hunger + intervals);
        updates.hunger_regen_at = new Date().toISOString();
      }
    }
  }

  // ── Énergie : tente=1h, cabane=50min, maison=40min, manoir=30min ──
  const fatigueRegenInterval = getFatigueRegenInterval(p.housing_level || "tente");
  if (fatigueRegenInterval) {
    const maxFatigue = getMaxFatigue(p);
    const fatigue = p.fatigue ?? maxFatigue;
    if (fatigue < maxFatigue) {
      if (!p.fatigue_regen_at) {
        updates.fatigue_regen_at = new Date().toISOString();
      } else {
        const lastRegen = new Date(p.fatigue_regen_at).getTime();
        const intervals = Math.floor((Date.now() - lastRegen) / fatigueRegenInterval);
        if (intervals >= 1) {
          updates.fatigue = Math.min(maxFatigue, fatigue + intervals);
          updates.fatigue_regen_at = new Date().toISOString();
        }
      }
    }
  }

  if (Object.keys(updates).length === 0) return p;

  await base44.entities.PlayerProfile.update(p.id, updates).catch(() => {});
  return { ...p, ...updates };
}