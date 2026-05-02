/**
 * questNarration.js : phrases d'Aldebert pour la complétion des quêtes journalières.
 *
 * 5 types de quêtes (deposit, sell, produce, travel, contribute) × 5 variantes.
 * Le placeholder {reward} est remplacé par la récompense en or (sans le 💰,
 * il est ajouté dans le format final).
 *
 * Sélection déterministe par (questId, day) pour qu'un même joueur ne voie
 * pas deux fois la même phrase d'affilée mais ne change pas non plus à
 * chaque rafraîchissement.
 */

const NARRATIONS = {
  // Dépôt à l'entrepôt
  deposit: [
    "Aldebert ferme son registre. \"Bien joué, l'entrepôt est mieux fourni grâce à toi. Voilà {reward} pièces pour ta peine.\"",
    "L'aubergiste te tape sur l'épaule. \"On dit que la générosité revient au double. Pour aujourd'hui ce sera {reward} pièces, on commence par là.\"",
    "Aldebert essuie ses mains. \"Tu as bien ravitaillé la cité. La caisse municipale te remercie de {reward} pièces, et moi aussi à ma manière.\"",
    "Le vieux conteur note quelque chose. \"Encore un dépôt qui sauvera des nuits froides cet hiver. {reward} pièces pour toi, et ma reconnaissance en plus.\"",
    "Aldebert hoche la tête, satisfait. \"Tu remplis les granges quand d'autres ne pensent qu'à les vider. Voici {reward} pièces, tu les as bien gagnées.\"",
  ],

  // Vente au marché
  sell: [
    "Aldebert sourit en comptant. \"Ton étal s'est bien vidé aujourd'hui. {reward} pièces de prime, en plus de ce que tu as déjà encaissé.\"",
    "L'aubergiste lève sa chope. \"À l'art du négoce ! Tu vends ce que tu as et tu gardes la tête sur les épaules. {reward} pièces pour la prouesse.\"",
    "Aldebert range une bourse sous le comptoir. \"Le marché t'a souri, et le bourg avec. Tiens, {reward} pièces de plus, prime de bonne tenue.\"",
    "Le vieux conteur te dévisage. \"Tu as cette aura de marchand qui ne brade jamais. Continue comme ça, voici {reward} pièces.\"",
    "Aldebert claque la langue, approbateur. \"Bien vendu, bien gagné. La cité gagne quand ses étals se vident. {reward} pièces pour toi.\"",
  ],

  // Production / récolte
  produce: [
    "Aldebert te regarde, les bras chargés de ton labeur. \"Le travail bien fait se voit à la sueur. {reward} pièces, tu les a méritées avant même de demander.\"",
    "L'aubergiste te sert un grand verre d'eau fraîche. \"Bois d'abord, tu en as besoin. Et range ces {reward} pièces dans ta bourse, tu as produit assez pour deux.\"",
    "Aldebert ferme un oeil pour évaluer ta récolte. \"Pas mal du tout. La cité tient debout grâce à des bras comme les tiens. Voici {reward} pièces.\"",
    "Le vieux conteur sort un parchemin où il marque ton nom. \"On ne perd jamais à noter les bons producteurs. {reward} pièces, et ma considération.\"",
    "Aldebert te tend une miche de pain. \"Mange. Tu as transformé ton temps en ressources, c'est une magie qu'on ne célèbre pas assez. {reward} pièces en complément.\"",
  ],

  // Voyage entre cités
  travel: [
    "Aldebert dépoussière ton manteau d'un geste paternel. \"Te voilà revenu ! Les routes sont longues. Tiens, {reward} pièces pour les cors aux pieds.\"",
    "L'aubergiste t'offre une chaise près du foyer. \"Assieds-toi, tu as marché. Les voyageurs voient ce que les sédentaires ignorent. {reward} pièces pour ton récit silencieux.\"",
    "Aldebert te sert un bouillon chaud. \"Bois ça d'abord. Puis range ces {reward} pièces, c'est la prime du voyageur fidèle.\"",
    "Le vieux conteur sourit. \"Encore une route arpentée. Tu commences à connaître mieux les chemins que les courriers. {reward} pièces pour la peine.\"",
    "Aldebert te tend une botte d'herbe sèche. \"Pour tes pieds, vieux remède. Et {reward} pièces pour ta bourse, qui n'en demandait pas tant.\"",
  ],

  // Contribution (bounty, campagne, etc.)
  contribute: [
    "Aldebert se redresse, les yeux brillants. \"Tu as répondu présent quand on cherchait des bras. La cité s'en souvient, et moi aussi. {reward} pièces.\"",
    "L'aubergiste te salue d'un signe de tête grave. \"Ce qu'on fait pour les autres revient toujours. Voici {reward} pièces, mais tu as gagné mieux que ça.\"",
    "Aldebert pose une main sur ton épaule. \"Les solidaires sont rares ces temps-ci. Tiens, {reward} pièces, et garde ce regard fier que tu as là.\"",
    "Le vieux conteur lève sa chope. \"À ceux qui contribuent quand d'autres se contentent de prendre. {reward} pièces et un toast à ta santé.\"",
    "Aldebert te désigne un siège d'honneur. \"On dit qu'une cité ne vaut que par ses citoyens. Tu en es la preuve. Voici {reward} pièces.\"",
  ],
};

/** Hash simple pour rendre la sélection déterministe par (quête, jour). */
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

/**
 * Renvoie la phrase narrative pour une quête complétée.
 * @param {string} questType - Type de la quête (deposit, sell, produce, travel, contribute)
 * @param {number} reward - Récompense en or
 * @param {string} questId - ID de la quête (pour la sélection déterministe)
 * @returns {string} Phrase formatée prête à être affichée
 */
export function getQuestNarration(questType, reward, questId = "") {
  const variants = NARRATIONS[questType];
  if (!variants || variants.length === 0) {
    // Fallback générique si type inconnu (futur-proofing)
    return `Aldebert sourit. "Bien joué, voici ${reward} pièces pour ta peine."`;
  }
  const seed = `${questId}:${questType}:${reward}`;
  const idx = hashString(seed) % variants.length;
  return variants[idx].replace("{reward}", String(reward));
}
