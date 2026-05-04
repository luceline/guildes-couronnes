/**
 * cityEventsHelpers.js : helpers pour les événements de mairie.
 *
 * Définit :
 *   - Le catalogue des 7 événements (CITY_EVENTS_CATALOG)
 *   - Les coûts (fixes ou variables selon résidents)
 *   - Les helpers de check : a-t-on un événement actif aujourd'hui ?
 *   - L'expiration des événements (jusqu'au prochain cron 06:00 UTC)
 */
import { base44 } from "@/api/base44Client";

// ─── Catalogue des événements ────────────────────────────────────────────
export const CITY_EVENTS_CATALOG = {
  treasure_hunt: {
    key: "treasure_hunt",
    name: "Course aux trésors",
    icon: "🎯",
    description: "+1 épopée aujourd'hui pour tous les résidents.",
    cost_type: "fixed",
    cost_value: 100, // 100 T1 mixtes
    effect_buff: true,
  },
  work_festival: {
    key: "work_festival",
    name: "Fête du travail",
    icon: "🛠️",
    description: "−50% durée des crafts pour tous les résidents (cumul multiplicatif avec items chaudron).",
    cost_type: "fixed",
    cost_value: 70,
    effect_buff: true,
  },
  road_procession: {
    key: "road_procession",
    name: "Procession des routes",
    icon: "🛣️",
    description: "−50% temps de voyage pour tous les résidents (cumul multiplicatif).",
    cost_type: "fixed",
    cost_value: 50,
    effect_buff: true,
  },
  royal_feast: {
    key: "royal_feast",
    name: "Festin royal",
    icon: "🍖",
    description: "+10 énergie et +10 faim instantané à chaque résident de la ville.",
    cost_type: "per_resident",
    cost_value: 20, // 20 T1 par résident
    effect_buff: false, // effet instantané, pas un buff durable
  },
  abundance_blessing: {
    key: "abundance_blessing",
    name: "Bénédiction de l'abondance",
    icon: "💰",
    description: "+5% double production pour tous les résidents (cumul multiplicatif).",
    cost_type: "fixed",
    cost_value: 100,
    effect_buff: true,
  },
  forge_collective: {
    key: "forge_collective",
    name: "Forge collective",
    icon: "🔧",
    description: "Réinitialise les 5/5 réparations du jour pour tous les résidents.",
    cost_type: "per_resident",
    cost_value: 20,
    effect_buff: false, // effet instantané
  },
  razzia: {
    key: "razzia",
    name: "Razzia",
    icon: "🗡️",
    description: "Vole l'or de la trésorerie d'une ville cible. 1 T1 dépensé = 2 or volés.",
    cost_type: "free", // le maire choisit
    cost_value: null,
    effect_buff: false,
    is_pvp: true,
    cooldown_days: 7,
  },
};

// ─── T1 acceptés pour les événements ────────────────────────────────────
// Les 8 ressources T1 récoltables (incluant autorisation_marche pour cohérence
// avec le reste du jeu, mais le maire peut choisir de l'exclure)
export const ACCEPTED_T1_KEYS = [
  "bois_brut",
  "minerai_fer",
  "ble",
  "laine_brute",
  "herbes",
  "quartz_brut",
  "pierre",
  "autorisation_marche",
];

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Calcule le coût total en T1 d'un événement pour une ville donnée.
 */
export function getEventCost(eventKey, city) {
  const def = CITY_EVENTS_CATALOG[eventKey];
  if (!def) return 0;
  if (def.cost_type === "fixed") return def.cost_value;
  if (def.cost_type === "per_resident") {
    const residents = (city?.residents || []).length;
    return def.cost_value * Math.max(1, residents);
  }
  if (def.cost_type === "free") return 0; // libre
  return 0;
}

/**
 * Renvoie l'expiration d'un événement (06:00 UTC du lendemain ou aujourd'hui
 * si on lance avant 06:00 UTC).
 */
export function getNextResetExpiry() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(6, 0, 0, 0);
  if (next <= now) {
    // 06:00 UTC d'aujourd'hui est passé, on prend 06:00 UTC de demain
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString();
}

/**
 * Charge les événements actifs d'une ville (effet pas encore expiré).
 */
export async function loadActiveEventsForCity(cityId) {
  if (!cityId) return [];
  try {
    const nowIso = new Date().toISOString();
    const all = await base44.entities.CityEvent.filter({ city_id: cityId });
    return (all || []).filter(e => !e.effect_until || e.effect_until > nowIso);
  } catch (e) {
    console.warn("[CityEvents] load active failed:", e);
    return [];
  }
}

/**
 * Vérifie si la mairie a déjà lancé un événement aujourd'hui (limite 1/jour).
 * "Aujourd'hui" = depuis le dernier reset 06:00 UTC.
 */
export async function hasMayorLaunchedToday(cityId) {
  if (!cityId) return false;
  try {
    // Borne basse = dernier 06:00 UTC
    const now = new Date();
    const lastReset = new Date(now);
    lastReset.setUTCHours(6, 0, 0, 0);
    if (lastReset > now) lastReset.setUTCDate(lastReset.getUTCDate() - 1);
    const lastResetIso = lastReset.toISOString();

    const all = await base44.entities.CityEvent.filter({ city_id: cityId });
    return (all || []).some(e => e.created_at >= lastResetIso);
  } catch (e) {
    console.warn("[CityEvents] launched today check failed:", e);
    return false;
  }
}

/**
 * Vérifie le cooldown Razzia : depuis quand la cible n'a pas été razziée par cette ville.
 * Renvoie { onCooldown: bool, daysRemaining: number }
 */
export async function checkRazziaCooldown(sourceCityId, targetCityId) {
  if (!sourceCityId || !targetCityId) return { onCooldown: false, daysRemaining: 0 };
  try {
    const cooldownDays = CITY_EVENTS_CATALOG.razzia.cooldown_days || 7;
    const limit = new Date(Date.now() - cooldownDays * 86400 * 1000).toISOString();

    const all = await base44.entities.CityEvent.filter({
      city_id: sourceCityId,
      event_type: "razzia",
      target_city_id: targetCityId,
    });

    const recent = (all || []).filter(e => e.created_at >= limit);
    if (recent.length === 0) return { onCooldown: false, daysRemaining: 0 };

    // Plus récent
    const mostRecent = recent.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const elapsedMs = Date.now() - new Date(mostRecent.created_at).getTime();
    const remainingMs = cooldownDays * 86400 * 1000 - elapsedMs;
    return {
      onCooldown: true,
      daysRemaining: Math.ceil(remainingMs / (86400 * 1000)),
    };
  } catch (e) {
    console.warn("[CityEvents] razzia cooldown check failed:", e);
    return { onCooldown: false, daysRemaining: 0 };
  }
}

/**
 * Renvoie le buff actif d'un type donné sur une ville (ou null).
 * eventType : "treasure_hunt" | "work_festival" | "road_procession" | "abundance_blessing"
 */
export function findActiveBuff(activeEvents, eventType) {
  if (!Array.isArray(activeEvents)) return null;
  const nowIso = new Date().toISOString();
  return activeEvents.find(e =>
    e.event_type === eventType && e.effect_until && e.effect_until > nowIso
  ) || null;
}

/**
 * Helper synchrone : cherche un buff actif sur une ville en chargeant via fetch.
 * À utiliser dans les hooks (Production, Travel, Combat).
 *
 * Renvoie { hasBuff: bool, expiresAt: Date | null }
 */
export async function getCityBuff(cityId, eventType) {
  if (!cityId || !eventType) return { hasBuff: false, expiresAt: null };
  try {
    const events = await loadActiveEventsForCity(cityId);
    const buff = findActiveBuff(events, eventType);
    if (!buff) return { hasBuff: false, expiresAt: null };
    return { hasBuff: true, expiresAt: new Date(buff.effect_until) };
  } catch (e) {
    return { hasBuff: false, expiresAt: null };
  }
}
