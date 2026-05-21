// src/lib/todoNext.js
//
// Liste des "essentiels du jour" : 5 actions qu'un joueur engagé doit faire
// chaque jour pour ne rien rater.
//
// PHILOSOPHIE :
//   - Liste FIXE et PRÉVISIBLE : épopée, boss, quêtes, chaudron, mairie
//   - Pas d'opportunités secondaires (contrats, récolte AFK) : ces signaux
//     sont déjà sur les autres tuiles via leur badge status
//   - Chaque card : "✓ fait" (vert), "○ en cours" (jaune), "○ à faire" (urgent)
//
// CARDS = TOUJOURS LES 5 MÊMES, dans le même ordre. Le joueur sait quoi
// regarder. Une card "fait" ne disparaît pas, elle se grise.
//
// Une card = { id, icon, title, subtitle, state, target }
//   - id : identifiant stable (clé React)
//   - icon : emoji
//   - title : libellé court
//   - subtitle : 1 ligne de contexte
//   - state : "done" | "progress" | "todo"
//   - target : clé drawer (DRAWER_TARGETS) ou null
//   - subTarget : éventuel deep-link interne (ex: onglet)

import { getBiomeName } from "@/lib/biomes";

const MAX_WAVES_PER_DAY = 5;


/**
 * Génère les 5 cards "essentiels du jour".
 *
 * @param {object} ctx
 * @param {object} ctx.profile          PlayerProfile
 * @param {object} ctx.city             City actuelle (rachat_t1_offers, etc.)
 * @param {Array}  [ctx.quests]         PlayerObjective du jour
 * @param {object} [ctx.boss]           Boss actif (avec attempts_today)
 * @param {boolean}[ctx.cauldronUsedToday] true si le joueur a utilisé le chaudron
 *                                         au moins 1× aujourd'hui (toute rank)
 */
export function generateTodoCards({
  profile,
  city,
  quests = [],
  boss = null,
  cauldronUsedToday = false,
}) {
  if (!profile || !city) return [];

  const todayStr = new Date().toISOString().split('T')[0];

  // ═══ 1. ÉPOPÉE DU JOUR ═══
  const epicStartedToday = profile.combat_last_date === todayStr;
  const epicWaveIdx = profile.combat_wave_index ?? 0;
  const epicDone = epicStartedToday
    && profile.combat_active_biome
    && epicWaveIdx >= MAX_WAVES_PER_DAY;
  const epicInProgress = epicStartedToday && !epicDone;

  const epicBiomeName = profile.combat_active_biome
    ? getBiomeName(profile.combat_active_biome, true)
    : null;

  const epicCard = {
    id: 'epic',
    icon: '🗡️',
    target: 'ecurie',
    title: 'Épopée du jour',
    subtitle: epicDone
      ? `Terminée${epicBiomeName ? ` en ${epicBiomeName}` : ''}`
      : epicInProgress
      ? `Vague ${epicWaveIdx + 1}/${MAX_WAVES_PER_DAY}${epicBiomeName ? ` en ${epicBiomeName}` : ''}`
      : '5 vagues à affronter (or + drops rares)',
    state: epicDone ? 'done' : epicInProgress ? 'progress' : 'todo',
  };

  // ═══ 2. COMBAT BOSS ═══
  // Boss communautaire : on peut taper plusieurs fois, mais une fois suffit
  // pour cocher la todo. attempts_today contient les profile.id du jour.
  const bossAttemptsArr = Array.isArray(boss?.attempts_today)
    ? boss.attempts_today
    : [];
  const bossAttempted = bossAttemptsArr.indexOf(profile.id) !== -1;
  const bossAlive = boss && (Number(boss.hp_current) || 0) > 0;

  const bossCard = {
    id: 'boss',
    icon: '👹',
    target: 'arene',
    subTarget: 'boss',
    title: 'Combat du boss',
    subtitle: !boss
      ? 'Aucun boss aujourd\'hui'
      : !bossAlive
      ? 'Boss vaincu — bravo !'
      : bossAttempted
      ? `Coup porté (${boss.name || 'boss'})`
      : `${boss.name || 'Boss'} t'attend (${boss.hp_current}/${boss.hp_max} PV)`,
    state: !boss || !bossAlive
      ? 'done'
      : bossAttempted
      ? 'done'
      : 'todo',
  };

  // ═══ 3. QUÊTES DU JOUR ═══
  const todayQuests = quests.filter(q => {
    const d = q.created_date || q.quest_date || '';
    return d.startsWith(todayStr);
  });
  const questsDone = todayQuests.filter(q => q.status === 'completed').length;
  const questsTotal = todayQuests.length;
  const allQuestsDone = questsTotal > 0 && questsDone === questsTotal;

  const questCard = {
    id: 'quests',
    icon: '🎯',
    target: 'quetes',
    title: 'Quêtes du jour',
    subtitle: questsTotal === 0
      ? 'Génère tes quêtes (6 max)'
      : `${questsDone}/${questsTotal} accomplies`,
    state: questsTotal === 0
      ? 'todo'
      : allQuestsDone
      ? 'done'
      : 'progress',
  };

  // ═══ 4. CHAUDRON MAGIQUE ═══
  const cauldronCard = {
    id: 'cauldron',
    icon: '🪄',
    target: 'chaudron',
    title: 'Chaudron magique',
    subtitle: cauldronUsedToday
      ? 'Mijoté aujourd\'hui'
      : 'Mijote un objet magique',
    state: cauldronUsedToday ? 'done' : 'todo',
  };

  // ═══ 5. OFFRE D'ACHAT MAIRIE ═══
  // Info passive : on indique si l'offre du jour est encore disponible.
  // (rachat_t1_bought_today / rachat_t2t3_bought_today sont sur la city,
  // donc partagés par tous les joueurs ; pas de tracking par joueur sans
  // migration). Critère : il existe au moins une offre dont
  // boughtToday < maxToday (offre pas encore épuisée par la ville).
  const t1Offers = city.rachat_t1_offers || {};
  const t2t3Offers = city.rachat_t2t3_offers || {};
  const t1Bought = city.rachat_t1_bought_today || {};
  const t2t3Bought = city.rachat_t2t3_bought_today || {};

  function hasOpenOffer(offers, bought) {
    for (const [k, o] of Object.entries(offers || {})) {
      const max = Number(o?.max_per_day) || Number(o?.daily_max) || Number(o?.qty_max) || 0;
      const cur = Number(bought[k]) || 0;
      if (max > 0 && cur < max) return true;
      // Pas de max précisé : on considère l'offre dispo tant qu'elle est listée
      if (max === 0 && o) return true;
    }
    return false;
  }

  const t1Open = hasOpenOffer(t1Offers, t1Bought);
  const t2t3Open = hasOpenOffer(t2t3Offers, t2t3Bought);
  const anyOpen = t1Open || t2t3Open;

  // Compteur d'items distincts ouverts (pour subtitle plus parlant)
  const t1OpenCount = Object.entries(t1Offers).filter(([k, o]) => {
    const max = Number(o?.max_per_day) || Number(o?.daily_max) || Number(o?.qty_max) || 0;
    const cur = Number(t1Bought[k]) || 0;
    return (max > 0 && cur < max) || (max === 0 && o);
  }).length;
  const t2t3OpenCount = Object.entries(t2t3Offers).filter(([k, o]) => {
    const max = Number(o?.max_per_day) || Number(o?.daily_max) || Number(o?.qty_max) || 0;
    const cur = Number(t2t3Bought[k]) || 0;
    return (max > 0 && cur < max) || (max === 0 && o);
  }).length;
  const totalOpenCount = t1OpenCount + t2t3OpenCount;

  const mairieCard = {
    id: 'mairie-offers',
    icon: '🏛️',
    target: 'entrepot',
    title: 'Offres de la mairie',
    subtitle: !anyOpen
      ? 'Offres du jour épuisées'
      : totalOpenCount === 1
      ? '1 offre de rachat disponible'
      : `${totalOpenCount} offres de rachat disponibles`,
    state: anyOpen ? 'todo' : 'done',
  };

  // ═══ 6. CLASSEMENT (rappel mensuel) ═══
  // 18/05/2026 — Card de rappel : reste toujours en "todo" pour pousser le
  // joueur à consulter régulièrement son rang dans les 4 catégories du
  // concours mensuel. Pas de logique de complétion (rappel quotidien).
  const rankingCard = {
    id: 'ranking',
    icon: '🏆',
    target: 'classement',
    title: 'Pensez à votre classement !',
    subtitle: '100/50/20 💰 par catégorie pour le top 3 le 1er du mois',
    state: 'todo',
  };

  // ─── Ordre fixe (les 6 cards toujours dans le même ordre) ───
  return [epicCard, bossCard, questCard, cauldronCard, mairieCard, rankingCard];
}


/**
 * Compte les cards "à faire" (state != done) pour le badge sur la tuile.
 */
export function countOpenTodos(cards) {
  return cards.filter(c => c.state !== 'done').length;
}
