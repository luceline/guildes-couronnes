// src/lib/tombolaClient.js
//
// Helpers client pour la tombola du Marchand.
// Le tirage est normalement fait par le cron VPS (server_reset_v2.js) à 06:00 UTC
// tous les 3 jours. Ce module fournit un "filet de sécurité" frontend : si le
// cycle est expiré et que le cron a planté/n'est pas passé, le 1er joueur qui
// ouvre le drawer Pavillon déclenche le tirage côté client.
//
// Anti-race : on s'appuie sur tombola_state.last_tirage_date (string YYYY-MM-DD).
// Si elle est == cycle_id du cycle qu'on essaie de tirer, c'est déjà fait.
// Sinon on tire et on update last_tirage_date dans le state.
//
// Bricolage acceptable : avec ~14 joueurs, la probabilité de race est faible.
// Un PocketBase optimistic-locking résoudrait ça mieux mais on reste simple.

import { base44 } from "@/api/base44Client";

const CYCLE_DAYS = 3;

// 17/05/2026 — Plafond journalier d'achat de billets par joueur.
// Passé de 5 à 20 en parallèle de l'introduction du boost cagnotte
// quotidien (1% trésorerie de chaque ville → tombola). Anti-monopole
// conservé (un riche ne peut pas acheter 500 billets et truquer le tirage)
// mais plus permissif pour soutenir les nouveaux flux d'or.
export const MAX_BILLETS_PER_DAY = 20;

/**
 * Génère cycle_id (string YYYY-MM-DD) à partir d'un cycle_debut ISO.
 */
function getCycleIdFromState(state) {
  return state?.cycle_debut?.split("T")[0] || "";
}

/**
 * Calcule le datetime ISO du prochain cycle_debut (= ancien cycle_fin_prevue).
 * Le prochain cycle_fin_prevue = prochain cycle_debut + 3 jours, à 06:00 UTC.
 */
function computeNextCycleBoundaries(prevFinPrevue) {
  const start = new Date(prevFinPrevue);
  // Caler au 06:00 UTC du jour de start
  start.setUTCHours(6, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + CYCLE_DAYS);
  return {
    cycle_debut: start.toISOString(),
    cycle_fin_prevue: end.toISOString(),
  };
}

/**
 * Tirage : sélectionne 3 gagnants distincts pondérés par billets_count.
 * Edge cases :
 *   - 0 participant : null (cagnotte reportée)
 *   - 1 participant : 100% à lui
 *   - 2 participants : 75% / 25%
 *   - 3+ participants : 60% / 25% / 15%
 *
 * @param {Array} participations - liste des participations du cycle
 * @param {number} cagnotte - or à distribuer
 * @returns {Array<{email, name, montant}>} 0 à 3 gagnants
 */
export function drawWinners(participations, cagnotte) {
  if (!participations || participations.length === 0) return [];

  // Construire l'urne pondérée : 1 entrée par billet
  const urn = [];
  for (const p of participations) {
    const count = p.billets_count || 0;
    for (let i = 0; i < count; i++) {
      urn.push({ email: p.player_email, name: p.player_name || p.player_email });
    }
  }
  if (urn.length === 0) return [];

  const distribution = participations.length === 1
    ? [1.0]
    : participations.length === 2
    ? [0.75, 0.25]
    : [0.60, 0.25, 0.15];

  const winners = [];
  const usedEmails = new Set();
  let attempts = 0;
  const maxAttempts = urn.length * 5;

  while (winners.length < distribution.length && attempts < maxAttempts) {
    attempts++;
    const idx = Math.floor(Math.random() * urn.length);
    const candidate = urn[idx];
    if (usedEmails.has(candidate.email)) continue;
    usedEmails.add(candidate.email);
    winners.push({
      email: candidate.email,
      name: candidate.name,
      montant: Math.floor(cagnotte * distribution[winners.length]),
    });
  }

  // Edge case : moins de gagnants distincts disponibles que de rangs (ex: 1 joueur
  // avec plusieurs billets sur un format prévu pour 3). distribution déjà adaptée.
  return winners;
}

/**
 * Filet frontend : si le cycle est expiré et qu'aucun tirage n'a été enregistré,
 * exécute le tirage côté client. Pas d'effet si déjà tiré ou cycle non terminé.
 *
 * @param {Object} state - entrée tombola_state
 * @param {Object} profile - profil du joueur courant (pour notif)
 * @returns {Promise<boolean>} true si un tirage a été déclenché
 */
export async function runTombolaTirageIfDue(state, profile) {
  if (!state) return false;
  const now = Date.now();
  const finPrevue = state.cycle_fin_prevue ? new Date(state.cycle_fin_prevue).getTime() : 0;
  if (now < finPrevue) return false; // cycle pas encore terminé

  const cycleId = getCycleIdFromState(state);
  if (state.last_tirage_date === cycleId) return false; // déjà tiré

  // Re-lock check : refetch le state pour limiter race conditions
  try {
    const states = await base44.entities.TombolaState.list().catch(() => []);
    const fresh = states[0];
    if (!fresh) return false;
    if (fresh.last_tirage_date === cycleId) return false; // un autre joueur a tiré entre-temps

    // ── Récupérer les participations du cycle ──
    const participations = await base44.entities.TombolaParticipations.filter({
      cycle_id: cycleId,
    }).catch(() => []);

    const cagnotte = fresh.cagnotte_actuelle || 0;
    const billetsVendus = fresh.billets_vendus_total || 0;

    // ── Tirage ──
    const winners = drawWinners(participations, cagnotte);

    // ── Cas 0 participant : reporter la cagnotte ──
    if (winners.length === 0) {
      const next = computeNextCycleBoundaries(fresh.cycle_fin_prevue);
      await base44.entities.TombolaState.update(fresh.id, {
        // cagnotte reste, billets_vendus_total reset
        billets_vendus_total: 0,
        last_tirage_date: cycleId,
        ...next,
      });
      // History entry pour traçabilité (cycle vide)
      await base44.entities.TombolaHistory.create({
        date_tirage: new Date().toISOString(),
        cycle_id: cycleId,
        cagnotte_totale: 0,
        billets_vendus: billetsVendus,
        participants_count: 0,
      }).catch(() => {});
      return true;
    }

    // ── Créditer les gagnants ──
    for (const w of winners) {
      try {
        const profiles = await base44.entities.PlayerProfile.filter({ user_email: w.email });
        if (profiles[0]) {
          await base44.entities.PlayerProfile.update(profiles[0].id, {
            gold: (profiles[0].gold || 0) + w.montant,
          });
          // Log gold (utilise la nouvelle API à objet)
          await base44.entities.GoldTransaction.create({
            player_email: w.email,
            player_name: w.name,
            city_id: "",
            city_name: "",
            amount: w.montant,
            type: "objectif",
            description: `🎰 Gain Tombola : ${w.montant}💰 (rang ${winners.indexOf(w) + 1})`,
          }).catch(() => {});
        }
      } catch (e) {
        console.warn(`[tombola] crédit gagnant ${w.email} échoué`, e);
      }
    }

    // ── Créer l'entrée d'historique ──
    const historyEntry = {
      date_tirage: new Date().toISOString(),
      cycle_id: cycleId,
      cagnotte_totale: cagnotte,
      billets_vendus: billetsVendus,
      participants_count: participations.length,
    };
    if (winners[0]) {
      historyEntry.gagnant_1_email = winners[0].email;
      historyEntry.gagnant_1_name = winners[0].name;
      historyEntry.montant_1 = winners[0].montant;
    }
    if (winners[1]) {
      historyEntry.gagnant_2_email = winners[1].email;
      historyEntry.gagnant_2_name = winners[1].name;
      historyEntry.montant_2 = winners[1].montant;
    }
    if (winners[2]) {
      historyEntry.gagnant_3_email = winners[2].email;
      historyEntry.gagnant_3_name = winners[2].name;
      historyEntry.montant_3 = winners[2].montant;
    }
    await base44.entities.TombolaHistory.create(historyEntry);

    // ── Reset state pour le nouveau cycle ──
    const next = computeNextCycleBoundaries(fresh.cycle_fin_prevue);
    await base44.entities.TombolaState.update(fresh.id, {
      cagnotte_actuelle: 0,
      billets_vendus_total: 0,
      last_tirage_date: cycleId,
      ...next,
    });

    // ── Reset des participations (suppression des entrées de l'ancien cycle) ──
    for (const p of participations) {
      try { await base44.entities.TombolaParticipations.delete(p.id); } catch {}
    }

    return true;
  } catch (e) {
    console.error("[tombola] tirage frontend échoué :", e);
    return false;
  }
}

/**
 * Helper utilisé par Market.jsx et AtelierCommande.jsx pour incrémenter
 * la cagnotte + créer/mettre à jour la participation joueur lors d'un achat.
 *
 * @param {Object} buyer - profil de l'acheteur (au moins user_email + character_name)
 * @param {number} qty - nombre de billets achetés (1 par défaut)
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function recordBilletPurchase(buyer, qty = 1) {
  try {
    // 1. Charger state actuel
    const states = await base44.entities.TombolaState.list().catch(() => []);
    const state = states[0];
    if (!state) {
      return { ok: false, error: "Tombola non initialisée." };
    }
    const cycleId = getCycleIdFromState(state);

    // 2. Plafond /jour : check
    const todayStr = new Date().toISOString().split("T")[0];
    const existing = await base44.entities.TombolaParticipations.filter({
      cycle_id: cycleId,
      player_email: buyer.user_email,
    }).catch(() => []);
    const myPart = existing[0];
    const billetsToday = (myPart?.billets_today || {})[todayStr] || 0;
    if (billetsToday + qty > MAX_BILLETS_PER_DAY) {
      const remaining = Math.max(0, MAX_BILLETS_PER_DAY - billetsToday);
      return {
        ok: false,
        error: `Plafond journalier atteint : ${billetsToday}/${MAX_BILLETS_PER_DAY} billets aujourd'hui. ${
          remaining > 0 ? `Vous pouvez encore en acheter ${remaining}.` : "Revenez demain."
        }`,
      };
    }

    // 3. Update / create participation
    const newBilletsToday = { ...(myPart?.billets_today || {}), [todayStr]: billetsToday + qty };
    if (myPart) {
      await base44.entities.TombolaParticipations.update(myPart.id, {
        billets_count: (myPart.billets_count || 0) + qty,
        billets_today: newBilletsToday,
      });
    } else {
      await base44.entities.TombolaParticipations.create({
        player_email: buyer.user_email,
        player_name: buyer.character_name || buyer.user_email,
        cycle_id: cycleId,
        billets_count: qty,
        billets_today: newBilletsToday,
      });
    }

    // 4. Update state global (cagnotte + total)
    await base44.entities.TombolaState.update(state.id, {
      cagnotte_actuelle: (state.cagnotte_actuelle || 0) + qty,    // 1 or par billet → cagnotte
      billets_vendus_total: (state.billets_vendus_total || 0) + qty,
    });

    return { ok: true };
  } catch (e) {
    console.error("[tombola] recordBilletPurchase :", e);
    return { ok: false, error: "Erreur d'enregistrement de la participation." };
  }
}

/**
 * Vérifie côté client si l'acheteur peut encore acheter N billets aujourd'hui.
 * Lecture seule, pour l'UI (désactiver bouton avant achat).
 */
export async function canBuyBillets(buyer, qty = 1) {
  try {
    const states = await base44.entities.TombolaState.list().catch(() => []);
    const state = states[0];
    if (!state) return { ok: false, reason: "Tombola non initialisée." };
    const cycleId = getCycleIdFromState(state);
    const todayStr = new Date().toISOString().split("T")[0];
    const existing = await base44.entities.TombolaParticipations.filter({
      cycle_id: cycleId,
      player_email: buyer.user_email,
    }).catch(() => []);
    const myPart = existing[0];
    const billetsToday = (myPart?.billets_today || {})[todayStr] || 0;
    const remaining = Math.max(0, MAX_BILLETS_PER_DAY - billetsToday);
    if (qty > remaining) {
      return {
        ok: false,
        reason: `Plafond : ${billetsToday}/${MAX_BILLETS_PER_DAY} aujourd'hui. ${remaining > 0 ? `Encore ${remaining} possible(s).` : "Revenez demain."}`,
      };
    }
    return { ok: true, remaining };
  } catch (e) {
    console.error("[tombola] canBuyBillets :", e);
    return { ok: false, reason: "Erreur de vérification." };
  }
}
