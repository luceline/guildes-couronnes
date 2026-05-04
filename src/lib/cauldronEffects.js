/**
 * cauldronEffects.js : application centralisée des effets des items du chaudron.
 *
 * Permet de réutiliser la même logique depuis Production.jsx et InventoryPanel.jsx
 * sans dupliquer le code (risque de divergence sinon).
 *
 * Usage :
 *   const result = applyCauldronEffect(itemDef, profile, city, opts);
 *   if (result === null) return null; // pas un item du chaudron
 *   if (result.error) { toast.error(result.error); return; }
 *   if (result.handled) {
 *     // Mettre à jour profile avec result.updates
 *     // Afficher result.toast si présent
 *   }
 *
 * Pour les items à cible (Parchemin marchand, Étoile filante, Hibou),
 * on retourne { needsTarget: true } pour que l'UI ouvre la modale appropriée.
 */
import { base44 } from "@/api/base44Client";

/**
 * Tente d'appliquer l'effet d'un item du chaudron.
 *
 * @param {Object} itemDef - définition de l'item (ITEMS[key])
 * @param {Object} profile - profil joueur
 * @param {Object} city - ville actuelle (pour talisman/log)
 * @param {Object} opts - { cityHungerBonus, getMaxHunger, getMaxFatigue }
 * @returns {Object|null}
 *   null si pas un item du chaudron (ne pas traiter)
 *   { handled: true, updates, toastMessage } si effet appliqué localement
 *   { needsTarget: 'steal_treasury' | 'spy_city' } si demande une cible
 *   { error: "..." } si erreur métier
 */
export function applyCauldronEffect(itemDef, profile, city, opts = {}) {
  // Items chaudron : catégorie "chaudron"
  if (itemDef.category !== "chaudron") return null;

  const { cityHungerBonus = 0, getMaxHunger, getMaxFatigue } = opts;
  const updates = {};
  let toastMessage = null;

  // ── Effets simples ──
  if (itemDef.effect === "fatigue_restore") {
    // Tisane revigorante : +5 énergie
    const maxF = getMaxFatigue ? getMaxFatigue(profile, 0) : 20;
    updates.fatigue = Math.min(maxF, (profile.fatigue ?? 0) + (itemDef.value || 5));
    return { handled: true, updates };
  }

  if (itemDef.effect === "hunger_restore") {
    // Botte de paille : +5 faim
    const maxH = getMaxHunger ? getMaxHunger(profile, cityHungerBonus) : 20;
    updates.hunger = Math.min(maxH, (profile.hunger ?? 0) + (itemDef.value || 5));
    return { handled: true, updates };
  }

  if (itemDef.effect === "hunger_and_fatigue") {
    // Miel des fées : +10 faim ET +10 énergie
    const maxH = getMaxHunger ? getMaxHunger(profile, cityHungerBonus) : 20;
    const maxF = getMaxFatigue ? getMaxFatigue(profile, 0) : 20;
    const value = itemDef.value || 10;
    updates.hunger = Math.min(maxH, (profile.hunger ?? maxH) + value);
    updates.fatigue = Math.min(maxF, (profile.fatigue ?? maxF) + value);
    return { handled: true, updates };
  }

  if (itemDef.effect === "next_epopee_drop_bonus") {
    // Trèfle de chance
    updates.next_epopee_drop_bonus = itemDef.value || 0.05;
    return { handled: true, updates };
  }

  if (itemDef.effect === "next_epopee_gold_bonus") {
    // Pièce porte-bonheur
    updates.next_epopee_gold_bonus = itemDef.value || 0.20;
    return { handled: true, updates };
  }

  if (itemDef.effect === "next_travel_free") {
    // Plume de vent
    updates.next_travel_free = true;
    return { handled: true, updates };
  }

  if (itemDef.effect === "craft_speed_buff") {
    // Pierre de feu : -30% durée crafts pendant 4h
    const expiresAt = new Date(Date.now() + (itemDef.duration_h || 4) * 3600000).toISOString();
    updates.craft_speed_buff_until = expiresAt;
    updates.craft_speed_buff_value = itemDef.value || 0.30;
    return { handled: true, updates };
  }

  if (itemDef.effect === "energy_max_or_gold") {
    // Pierre énergétique : +30 or fixe (simplification : on ne donne plus +1 énergie max permanente)
    updates.gold = (profile.gold || 0) + (itemDef.alt_value || 30);
    toastMessage = `⚡ +${itemDef.alt_value || 30}💰 ! La Pierre énergétique vous récompense.`;
    return { handled: true, updates, toastMessage };
  }

  if (itemDef.effect === "reset_all_cooldowns") {
    // Sablier des âges : reset tous les cooldowns de production (record JSON)
    updates.production_cooldowns = {};
    return { handled: true, updates };
  }

  if (itemDef.effect === "next_t4_no_tool") {
    // Parchemin de craft
    updates.next_t4_no_tool = true;
    return { handled: true, updates };
  }

  if (itemDef.effect === "reset_epopee") {
    // Trèfle de chance / Œil d'archer : reset complet de l'épopée du jour pour permettre d'en relancer une
    updates.combat_last_date = "";
    updates.combat_active_biome = "";
    updates.combat_wave_index = 0;
    updates.combat_total_gold = 0;
    updates.combat_total_drops = 0;
    return { handled: true, updates };
  }

  if (itemDef.effect === "city_protect") {
    // Talisman de protection : nécessite un appel async (création record dôme)
    // On retourne "needsAsync" pour que l'appelant gère
    return { needsAsync: "city_protect", duration_h: itemDef.duration_h || 2 };
  }

  // ── Items à cible ──
  if (itemDef.effect === "steal_treasury") {
    return { needsTarget: "steal_treasury", value: itemDef.value || 20 };
  }

  if (itemDef.effect === "spy_city") {
    return { needsTarget: "spy_city" };
  }

  return null;
}

/**
 * Applique l'effet city_protect (création du dôme PB).
 * Appelé depuis l'UI après que applyCauldronEffect retourne needsAsync = "city_protect".
 */
export async function applyCityProtect(profile, city, durationH = 2) {
  if (!profile.home_city_id) {
    return { error: "🛡️ Vous devez avoir une ville d'origine pour invoquer un dôme." };
  }
  const placedAt = new Date();
  const expiresAt = new Date(placedAt.getTime() + durationH * 3600 * 1000).toISOString();
  try {
    await base44.entities.ProtectionDome.create({
      city_id: profile.home_city_id,
      placed_by_email: profile.user_email,
      placed_by_name: profile.character_name || "",
      expires_at: expiresAt,
      status: "active",
    });
    return {
      success: true,
      toastMessage: `🛡️ Un dôme de protection enveloppe ${city?.name || "votre ville"} pour ${durationH}h.`,
    };
  } catch (e) {
    console.error("[Cauldron] dome create failed:", e);
    return { error: "Le talisman s'effrite : le dôme n'a pas pu être posé." };
  }
}

/**
 * Vérifie si une ville a un dôme de protection actif.
 * Renvoie { protected: bool, expiresAt: Date | null }
 */
export async function checkCityDome(cityId) {
  if (!cityId) return { protected: false, expiresAt: null };
  try {
    const list = await base44.entities.ProtectionDome.filter({
      city_id: cityId,
      status: "active",
    });
    const now = new Date();
    for (const d of list) {
      const exp = new Date(d.expires_at);
      if (exp > now) return { protected: true, expiresAt: exp };
    }
    return { protected: false, expiresAt: null };
  } catch (e) {
    console.warn("[Cauldron] dome check failed:", e);
    return { protected: false, expiresAt: null };
  }
}

/**
 * Exécute l'effet "steal_treasury" sur une ville cible.
 * Vérifie le dôme et exécute le vol si possible.
 *
 * @returns { success, blocked, toastMessage, updates (player) }
 */
export async function executeStealTreasury(profile, targetCity, value, itemName) {
  if (!targetCity) {
    return { error: "Aucune ville sélectionnée." };
  }
  if (targetCity.id === profile.city_id || targetCity.id === profile.home_city_id) {
    return { error: "Vous ne pouvez pas vous voler vous-même." };
  }

  // Vérification du dôme
  const dome = await checkCityDome(targetCity.id);
  if (dome.protected) {
    // Item consommé, pas d'effet
    return {
      blocked: true,
      toastMessage: `❌ ${targetCity.name} est protégée par un Talisman ! Votre ${itemName} se consume sans effet.`,
    };
  }

  // Vol effectif
  const stolenAmount = Math.min(value, targetCity.gold_treasury || 0);
  if (stolenAmount <= 0) {
    return {
      success: true,
      stolenAmount: 0,
      toastMessage: `💸 La trésorerie de ${targetCity.name} est vide. Votre ${itemName} ne rapporte rien.`,
    };
  }

  // Mettre à jour la ville cible
  try {
    await base44.entities.City.update(targetCity.id, {
      gold_treasury: (targetCity.gold_treasury || 0) - stolenAmount,
    });
    // Le profile est mis à jour côté appelant (pour cohérence avec l'inventaire)
    return {
      success: true,
      stolenAmount,
      goldUpdate: stolenAmount,
      toastMessage: `💸 Vous dérobez ${stolenAmount}💰 à la trésorerie de ${targetCity.name} !`,
      logDescription: `🗡️ Vol via ${itemName} sur ${targetCity.name} : +${stolenAmount}💰`,
    };
  } catch (e) {
    console.error("[Cauldron] steal failed:", e);
    return { error: "Le vol a échoué : la mairie est trop bien gardée." };
  }
}

/**
 * Exécute l'effet "spy_city" : récupère les infos de la ville cible.
 * Crée aussi un message anonyme dans la taverne ciblée.
 */
export async function executeSpyCity(profile, targetCity) {
  if (!targetCity) {
    return { error: "Aucune ville sélectionnée." };
  }
  if (targetCity.id === profile.city_id || targetCity.id === profile.home_city_id) {
    return { error: "Inutile d'espionner votre propre ville." };
  }

  try {
    // Recharge fraîchement la ville cible (données peuvent avoir changé)
    const fresh = await base44.entities.City.get(targetCity.id).catch(() => null);
    const cityToSpy = fresh || targetCity;

    // Vérifie le dôme actif (info incluse dans le rapport mais ne bloque pas)
    const dome = await checkCityDome(cityToSpy.id);

    // Inventaire entrepôt
    const warehouse = cityToSpy.warehouse || {};

    // Message anonyme dans la taverne ciblée
    try {
      await base44.entities.TavernMessage.create({
        city_id: cityToSpy.id,
        author_name: "🦉 Mystère",
        author_email: "system",
        message: "🦉 Votre ville a été espionnée. Quelqu'un a vu vos coffres...",
        category: "system",
      });
    } catch (e) {
      console.warn("[Cauldron] tavern msg failed:", e);
    }

    return {
      success: true,
      report: {
        cityName: cityToSpy.name,
        gold_treasury: cityToSpy.gold_treasury || 0,
        warehouse,
        domeActive: dome.protected,
      },
    };
  } catch (e) {
    console.error("[Cauldron] spy failed:", e);
    return { error: "Le hibou s'est perdu dans la nuit." };
  }
}
