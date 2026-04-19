// ── Remboursement automatique de dette par ville ──
// À appeler chaque fois qu'un joueur reçoit de l'or (vente, quête).
// 50% du revenu brut est prélevé pour rembourser les dettes, ville par ville (ordre FIFO des clés).
//
// Retourne :
//   repaid        : montant total remboursé
//   debtByCity    : nouvel objet debt_by_city mis à jour
//   goldAfterDebt : or net reçu par le joueur
//   cityPayments  : { [city_id]: montant } — versements à faire aux trésoreries

export function computeDebtRepayment(debtByCity, goldEarned) {
  const debt = debtByCity || {};
  const totalDebt = Object.values(debt).reduce((s, v) => s + v, 0);

  if (!totalDebt || totalDebt <= 0) {
    return { repaid: 0, debtByCity: {}, goldAfterDebt: goldEarned, cityPayments: {} };
  }

  let toRepay = Math.min(totalDebt, Math.floor(goldEarned * 0.5));
  const cityPayments = {};
  const newDebtByCity = { ...debt };

  // Rembourser ville par ville dans l'ordre des clés
  for (const cityId of Object.keys(newDebtByCity)) {
    if (toRepay <= 0) break;
    const owed = newDebtByCity[cityId] || 0;
    if (owed <= 0) continue;
    const pay = Math.min(owed, toRepay);
    cityPayments[cityId] = (cityPayments[cityId] || 0) + pay;
    newDebtByCity[cityId] = owed - pay;
    toRepay -= pay;
  }

  // Nettoyer les entrées à 0
  for (const k of Object.keys(newDebtByCity)) {
    if (newDebtByCity[k] <= 0) delete newDebtByCity[k];
  }

  const repaid = Object.values(cityPayments).reduce((s, v) => s + v, 0);
  return {
    repaid,
    debtByCity: newDebtByCity,
    goldAfterDebt: goldEarned - repaid,
    cityPayments,
  };
}

// ── Helper : total de toutes les dettes ──
export function getTotalDebt(debtByCity) {
  return Object.values(debtByCity || {}).reduce((s, v) => s + v, 0);
}