/**
 * goldLog.js : helper centralisé pour logger les transactions or.
 *
 * Avant la refonte, 25+ endroits dans le code écrivaient à la main :
 *   await base44.entities.GoldTransaction.create({
 *     player_email: profile.user_email,
 *     player_name: profile.character_name || "",
 *     city_id: city?.id || "",
 *     city_name: city?.name || "",
 *     amount, type, description,
 *   });
 *
 * Avec un try/catch souvent oublié et des risques d'oubli de champ.
 * Désormais l'helper extrait tout depuis profile + city :
 *
 *   await logGold({ profile, city, amount: -50, type: "achat",
 *                   description: "Achat de potion T2" });
 *
 * Une ancienne API positionnelle est conservée en deprecated pour la
 * compatibilité avec les ~20 fichiers qui l'utilisent déjà. À migrer en
 * boy scout vers la nouvelle API.
 */

import { base44 } from '@/api/base44Client';

/**
 * Logue une transaction d'or.
 *
 * @param {object} params - Tous les paramètres en objet (recommandé)
 * @param {object} [params.profile] - Le profil joueur (extrait email + nom)
 * @param {object} [params.city] - La ville pertinente, si applicable (extrait id + nom)
 * @param {number} params.amount - Le montant signé (négatif = perte, positif = gain)
 * @param {string} params.type - Type métier ("achat", "vente", "objectif", etc.)
 * @param {string} params.description - Phrase descriptive lisible par un humain
 * @returns {Promise<void>}
 *
 * Exemples :
 *   await logGold({ profile, city, amount: -10, type: "achat",
 *                   description: "Achat de blé" });
 *   await logGold({ profile, amount: 25, type: "objectif",
 *                   description: "Combat épique terminé" });
 *
 * Usage signature legacy (à migrer) :
 *   await logGold(playerEmail, playerName, cityId, cityName, amount, type, description);
 */
export async function logGold(...args) {
  let payload;

  if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
    // Nouvelle API à objet
    const { profile, city, amount, type, description } = args[0];
    payload = {
      player_email: profile?.user_email || "",
      player_name: profile?.character_name || "",
      city_id: city?.id || "",
      city_name: city?.name || "",
      amount,
      type,
      description,
    };
  } else {
    // Ancienne API positionnelle (deprecated, à retirer une fois la migration finie)
    const [playerEmail, playerName, cityId, cityName, amount, type, description] = args;
    payload = {
      player_email: playerEmail,
      player_name: playerName || "",
      city_id: cityId || "",
      city_name: cityName || "",
      amount,
      type,
      description,
    };
  }

  try {
    await base44.entities.GoldTransaction.create(payload);
  } catch (e) {
    console.warn("logGold:", e);
  }
}
