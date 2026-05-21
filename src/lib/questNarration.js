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

  // Dépôt T1 quelconque (réserves communales)
  deposit_t1: [
    "Aldebert tapote le coffre des réserves. \"Du brut, du cru, du nécessaire. Voilà ce qui fait tourner une cité. {reward} pièces pour ton bon sens.\"",
    "Le vieux conteur range la pelle qu'il tenait. \"Ce ne sont pas les lingots qui sauvent un hiver, c'est le bois et le blé. {reward} pièces, voyageur.\"",
    "Aldebert hoche la tête. \"Du T1 dans l'entrepôt, voilà la base de tout. {reward} pièces, et un sourire en prime.\"",
  ],

  // Achats au marché
  buy: [
    "Aldebert range sa balance. \"L'or qui circule vaut mieux que l'or qui dort. {reward} pièces pour avoir fait vivre les étals.\"",
    "L'aubergiste compte sur ses doigts. \"Tu as nourri le commerce, pas qu'un seul marchand. La cité te remercie de {reward} pièces.\"",
    "Aldebert sourit, malicieux. \"Acheteur compulsif, dis-tu ? Je dirais plutôt mécène involontaire. {reward} pièces pour la bonne cause.\"",
  ],

  // Combat PvP initié
  pvp: [
    "Aldebert range son épée d'apparat. \"Tu as croisé le fer, voilà ce qui distingue un guerrier d'un paysan armé. {reward} pièces pour le panache.\"",
    "Le vieux conteur te jauge du regard. \"Lancer le défi, c'est déjà la moitié du combat. {reward} pièces pour ton audace.\"",
    "Aldebert lève un sourcil approbateur. \"Mieux vaut un duelliste vivant qu'un héros mort. Tu sais quand frapper. {reward} pièces.\"",
  ],

  // Utilisation du chaudron
  cauldron: [
    "Aldebert renifle l'air. \"Une vapeur douceâtre flotte sur ton manteau. Le chaudron a parlé. {reward} pièces pour l'alchimiste d'un soir.\"",
    "Le vieux conteur ferme un grimoire. \"Les arts magiques ne s'apprennent pas, ils se cuisinent. Bien joué. {reward} pièces.\"",
    "Aldebert te tend une cuillère propre. \"Pour la prochaine fois. Et {reward} pièces pour celle-ci.\"",
  ],

  // Défi à la table de hazart
  dice: [
    "Aldebert range trois dés dans sa poche. \"Tu as posé ton défi. Le reste appartient au sort. {reward} pièces, peu importe le résultat.\"",
    "L'aubergiste te tape sur l'épaule. \"À la table de hazart, le courage de jouer compte autant que la victoire. {reward} pièces.\"",
    "Aldebert sourit en faisant tinter une bourse. \"Que les dés roulent, que les or tournent. {reward} pièces pour avoir animé la taverne.\"",
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
