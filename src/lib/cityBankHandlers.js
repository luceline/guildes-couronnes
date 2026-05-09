/**
 * cityBankHandlers.js — Helpers pour les actions bancaires d'une ville.
 *
 * Toutes les fonctions de ce module sont des handlers asynchrones qui :
 *   - Effectuent les vérifications métier (ville d'origine, maire actif, taux non nul, fonds suffisants...)
 *   - Mettent à jour le profil joueur et la trésorerie ville via base44
 *   - Loggent les transactions or via logGold
 *   - Affichent les toasts utilisateur
 *   - Appellent onRefresh en fin de succès
 *
 * Extraits de CityView.jsx le 09/05/2026 (refacto Phase 1) — comportement identique.
 *
 * Convention : chaque handler reçoit un objet "context" avec les données et callbacks
 * dont il a besoin, plus les paramètres spécifiques à l'action.
 *
 *   Exemple : await handleSaveBankRates({ city, onRefresh, loanRate, depositRate })
 */
import { base44 } from "@/api/base44Client";
import { logGold } from "@/lib/goldLog";
import { toast } from "sonner";

/**
 * Met à jour les taux de prêt et de dépôt d'une ville (action maire uniquement).
 * Cap : prêt 0-50%, dépôt 0-30%.
 */
export async function handleSaveBankRates({ city, onRefresh, loanRate, depositRate }) {
  await base44.entities.City.update(city.id, {
    loan_rate: Math.max(0, Math.min(50, loanRate)),
    deposit_rate: Math.max(0, Math.min(30, depositRate)),
  });
  toast.success("🏦 Taux bancaires mis à jour !");
  onRefresh?.();
}

/**
 * Effectue une demande de prêt à la trésorerie de la ville.
 * Conditions : comptoir construit, ville d'origine, maire actif, taux > 0,
 * pas de prêt actif existant, trésorerie suffisante.
 */
export async function handleRequestLoan({ profile, city, hasComptoir, mayorActive, onRefresh, amount }) {
  if (!hasComptoir) return;
  if (profile.home_city_id !== city.id) {
    toast.error("Vous ne pouvez emprunter que dans votre ville d'origine."); return;
  }
  if (!mayorActive) {
    toast.error("Sans maire en exercice, nul ne peut autoriser un prêt : attendez l'élection d'un gouverneur."); return;
  }
  const rate = city.loan_rate || 0;
  if (rate === 0) {
    toast.error("Le maire n'a point ouvert le livre des prêts : attendez qu'il active cette faveur."); return;
  }
  const existing = (profile.active_loans || []).filter(l => l.city_id === city.id && l.status === "active");
  if (existing.length > 0) {
    toast.error("Vous portez déjà une dette envers cette cité : remboursez-la avant d'en contracter une nouvelle."); return;
  }
  if ((city.gold_treasury || 0) < amount) {
    toast.error(`Les coffres de ${city.name} sont trop maigres pour ce prêt : il ne reste que ${city.gold_treasury || 0} 💰 en trésorerie.`); return;
  }

  const interest = Math.floor(amount * (rate / 100));
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  const loan = {
    city_id: city.id,
    city_name: city.name,
    amount,
    interest,
    rate,
    borrowed_at: new Date().toISOString(),
    due_at: dueDate.toISOString().split("T")[0],
    status: "active",
  };
  const newLoans = [...(profile.active_loans || []), loan];

  await base44.entities.PlayerProfile.update(profile.id, {
    gold: (profile.gold || 0) + amount,
    active_loans: newLoans,
  });
  await base44.entities.City.update(city.id, {
    gold_treasury: Math.max(0, (city.gold_treasury || 0) - amount),
  });
  await logGold(
    profile.user_email, profile.character_name, city.id, city.name,
    amount, "pret", `Prêt bancaire de ${city.name} (→ rembourser ${amount + interest} 💰)`
  );
  toast.success(`🏦 Le comptoir vous accorde sa confiance ! ${amount} 💰 dans votre bourse : remboursez ${amount + interest} 💰 avant le ${dueDate.toISOString().split("T")[0]}.`);
  onRefresh?.();
}

/**
 * Rembourse un prêt actif. Vérifie que le joueur a assez d'or pour solder la dette.
 * Restitue intégralement (capital + intérêts) à la trésorerie ville.
 */
export async function handleRepayLoan({ profile, city, onRefresh, loan, idx }) {
  const total = loan.amount + loan.interest;
  if ((profile.gold || 0) < total) {
    toast.error(`Votre bourse est trop légère : il vous faut ${total} 💰 pour solder cette dette.`); return;
  }
  const newLoans = (profile.active_loans || []).map((l, i) =>
    i === idx ? { ...l, status: "repaid" } : l
  );
  await base44.entities.PlayerProfile.update(profile.id, {
    gold: (profile.gold || 0) - total,
    active_loans: newLoans,
  });
  await base44.entities.City.update(city.id, {
    gold_treasury: (city.gold_treasury || 0) + total,
  });
  await logGold(
    profile.user_email, profile.character_name, city.id, city.name,
    -total, "remboursement", `Remboursement prêt à ${city.name}`
  );
  toast.success(`🤝 Votre dette est soldée ! ${total} 💰 rendus à la trésorerie de ${city.name} : votre honneur est sauf.`);
  onRefresh?.();
}

/**
 * Effectue un dépôt à la trésorerie de la ville.
 * Conditions : comptoir construit, ville d'origine, maire actif, taux > 0, fonds suffisants.
 */
export async function handleBankDeposit({ profile, city, hasComptoir, mayorActive, onRefresh, amount }) {
  if (!hasComptoir) return;
  if (profile.home_city_id !== city.id) {
    toast.error("Vous ne pouvez déposer que dans votre ville d'origine."); return;
  }
  if (!mayorActive) {
    toast.error("Le siège de la mairie est vide : un maire doit d'abord être élu pour gérer les dépôts."); return;
  }
  const rate = city.deposit_rate || 0;
  if (rate === 0) {
    toast.error("Le comptoir est fermé : le maire n'a pas encore ouvert le livre des dépôts."); return;
  }
  if ((profile.gold || 0) < amount) {
    toast.error("Pas assez d'or."); return;
  }

  const interest = Math.floor(amount * (rate / 100));
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  const deposit = {
    city_id: city.id,
    city_name: city.name,
    amount,
    interest,
    rate,
    deposited_at: new Date().toISOString(),
    due_at: dueDate.toISOString().split("T")[0],
    status: "active",
  };
  const newDeposits = [...(profile.active_deposits || []), deposit];

  await base44.entities.PlayerProfile.update(profile.id, {
    gold: (profile.gold || 0) - amount,
    active_deposits: newDeposits,
  });
  await base44.entities.City.update(city.id, {
    gold_treasury: (city.gold_treasury || 0) + amount,
  });
  await logGold(
    profile.user_email, profile.character_name, city.id, city.name,
    -amount, "depot", `Dépôt bancaire à ${city.name} (→ ${amount + interest} 💰 dans 7j)`
  );
  toast.success(`🏦 Dépôt de ${amount} 💰 effectué ! Récupérez ${amount + interest} 💰 dans 7 jours.`);
  onRefresh?.();
}

/**
 * Récupère un dépôt arrivé à terme.
 * Si la trésorerie ville est insuffisante pour les intérêts, on rembourse seulement la mise.
 */
export async function handleClaimDeposit({ profile, city, onRefresh, deposit, idx }) {
  const total = deposit.amount + deposit.interest;
  const now = new Date().toISOString().split("T")[0];

  if (now < deposit.due_at) {
    toast.error(`Votre dépôt est encore à terme jusqu'au ${deposit.due_at} : patience, les intérêts courent !`); return;
  }

  if ((city.gold_treasury || 0) < total) {
    // Trésorerie vide : rembourser uniquement la mise
    const newDeposits = (profile.active_deposits || []).map((d, i) =>
      i === idx ? { ...d, status: "matured" } : d
    );
    await base44.entities.PlayerProfile.update(profile.id, {
      gold: (profile.gold || 0) + deposit.amount,
      active_deposits: newDeposits,
    });
    await base44.entities.City.update(city.id, {
      gold_treasury: Math.max(0, (city.gold_treasury || 0) - deposit.amount),
    });
    toast.error(`⚠️ La trésorerie manque de fonds pour les intérêts : seule votre mise initiale (${deposit.amount} 💰) vous est rendue.`);
  } else {
    const newDeposits = (profile.active_deposits || []).map((d, i) =>
      i === idx ? { ...d, status: "matured" } : d
    );
    await base44.entities.PlayerProfile.update(profile.id, {
      gold: (profile.gold || 0) + total,
      active_deposits: newDeposits,
    });
    await base44.entities.City.update(city.id, {
      gold_treasury: Math.max(0, (city.gold_treasury || 0) - total),
    });
    await logGold(
      profile.user_email, profile.character_name, city.id, city.name,
      total, "retrait_depot", `Retrait dépôt ${city.name} (+${deposit.interest} 💰 intérêts)`
    );
    toast.success(`💰 Votre dépôt fructifié vous est restitué ! +${total} 💰 dont ${deposit.interest} 💰 d'intérêts bien mérités.`);
  }
  onRefresh?.();
}
