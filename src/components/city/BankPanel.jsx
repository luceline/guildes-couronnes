/**
 * BankPanel — Panneau de gestion bancaire d'une ville.
 *
 * Affiche :
 *   - Si l'utilisateur est maire : panneau pour fixer les taux de prêt et de dépôt
 *   - Sinon : taux courants (info)
 *   - Liste des prêts actifs (avec bouton de remboursement)
 *   - Liste des dépôts actifs (avec bouton de récupération si terme atteint)
 *   - Formulaire de nouveau prêt / dépôt
 *
 * Extrait de CityView.jsx le 09/05/2026 (refacto Phase 1) — comportement identique.
 *
 * Props :
 *   - city : objet City
 *   - profile : PlayerProfile courant
 *   - isMayor : booleen, true si profile.id === city.mayor_id (et mandat actif)
 *   - onSaveRates(loanRate, depositRate) : callback save taux (maire)
 *   - onRequestLoan(amount) : callback demande de prêt
 *   - onRepayLoan(loan, idx) : callback remboursement
 *   - onDeposit(amount) : callback nouveau dépôt
 *   - onClaimDeposit(deposit, idx) : callback retrait dépôt
 */
import { useState } from "react";

export default function BankPanel({
  city,
  profile,
  isMayor,
  onSaveRates,
  onRequestLoan,
  onRepayLoan,
  onDeposit,
  onClaimDeposit,
}) {
  const [loanRate, setLoanRate] = useState(city.loan_rate || 0);
  const [depositRate, setDepositRate] = useState(city.deposit_rate || 0);
  const [loanAmount, setLoanAmount] = useState(100);
  const [depositAmount, setDepositAmount] = useState(50);
  const [saving, setSaving] = useState(false);

  const now = new Date().toISOString().split("T")[0];
  const activeLoans = (profile.active_loans || []).filter(l => l.city_id === city.id && l.status === "active");
  const activeDeposits = (profile.active_deposits || []).filter(d => d.city_id === city.id && d.status === "active");
  const mayorActive = !!(city.mayor_id && city.mayor_until && city.mayor_until >= now);

  return (
    <div className="rounded-xl border border-yellow-200 bg-yellow-50/20 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🏦</span>
        <h3 className="font-heading font-semibold text-base">Banque de {city.name}</h3>
        <span className="text-xs text-muted-foreground font-body">· Trésorerie : {city.gold_treasury || 0} 💰</span>
      </div>

      {/* ── Panneau maire : fixer les taux ── */}
      {isMayor && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-3">
          <p className="text-xs font-body font-semibold text-amber-900">👑 Paramètres bancaires (maire)</p>
          <p className="text-xs text-muted-foreground font-body italic">
            La taxe marché se fixe depuis l'onglet <strong>Mairie → Gouvernance</strong>.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-body text-muted-foreground">Taux prêt (%) : 0 = désactivé</label>
              <div className="flex items-center gap-1">
                <input type="number"
                       inputMode="numeric"
                       pattern="[0-9]*" min={0} max={50} value={loanRate}
                  onChange={e => setLoanRate(Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
                  className="w-16 h-7 text-xs text-center border border-input rounded-md bg-background px-2"
                  onFocus={e => e.target.select()} />
                <span className="text-xs text-muted-foreground">% / 7j</span>
              </div>
              <p className="text-xs text-muted-foreground font-body">Ex: 100 or → remb. {100 + Math.floor(100 * loanRate / 100)} or</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-body text-muted-foreground">Taux dépôt (%) : 0 = désactivé</label>
              <div className="flex items-center gap-1">
                <input type="number"
                       inputMode="numeric"
                       pattern="[0-9]*" min={0} max={30} value={depositRate}
                  onChange={e => setDepositRate(Math.max(0, Math.min(30, parseInt(e.target.value) || 0)))}
                  className="w-16 h-7 text-xs text-center border border-input rounded-md bg-background px-2"
                  onFocus={e => e.target.select()} />
                <span className="text-xs text-muted-foreground">% / 7j</span>
              </div>
              <p className="text-xs text-muted-foreground font-body">Ex: 100 or → récup. {100 + Math.floor(100 * depositRate / 100)} or</p>
            </div>
          </div>
          <button
            disabled={saving}
            onClick={async () => { setSaving(true); await onSaveRates(loanRate, depositRate); setSaving(false); }}
            className="text-xs font-heading bg-amber-500 hover:bg-amber-600 text-white rounded-md px-3 py-1.5 disabled:opacity-50"
          >
            {saving ? "Sauvegarde..." : "💾 Enregistrer les taux"}
          </button>
        </div>
      )}

      {/* ── Infos taux pour les joueurs ── */}
      {!isMayor && mayorActive && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground font-body mb-1">Taux prêt</p>
            {(city.loan_rate || 0) > 0
              ? <p className="font-heading font-bold text-blue-700">{city.loan_rate}% <span className="text-xs font-normal">/ 7j</span></p>
              : <p className="text-xs text-muted-foreground font-body">Non disponible</p>}
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground font-body mb-1">Taux dépôt</p>
            {(city.deposit_rate || 0) > 0
              ? <p className="font-heading font-bold text-green-700">{city.deposit_rate}% <span className="text-xs font-normal">/ 7j</span></p>
              : <p className="text-xs text-muted-foreground font-body">Non disponible</p>}
          </div>
        </div>
      )}
      {!mayorActive && (
        <p className="text-xs text-muted-foreground font-body italic">Le siège de la mairie est vide : sans gouverneur, le comptoir sommeille.</p>
      )}

      {/* ── Prêts ── */}
      {mayorActive && (city.loan_rate || 0) > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-body font-semibold">💳 Emprunter à la ville</p>
          {activeLoans.length > 0 ? (
            activeLoans.map((loan, idx) => (
              <div key={idx} className="bg-white border border-border rounded-lg p-3 flex justify-between items-center text-sm font-body">
                <div>
                  <span className="font-semibold">{loan.amount} 💰</span>
                  <span className="text-muted-foreground ml-2 text-xs">à rembourser {loan.amount + loan.interest} 💰 avant le {loan.due_at}</span>
                  {now > loan.due_at && <span className="text-red-600 text-xs ml-2 font-semibold">⚠️ En retard</span>}
                </div>
                <button onClick={() => onRepayLoan(loan, idx)}
                  className="text-xs font-heading bg-red-500 hover:bg-red-600 text-white rounded-md px-2 py-1">
                  Rembourser {loan.amount + loan.interest} 💰
                </button>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <input type="number"
                       inputMode="numeric"
                       pattern="[0-9]*" min={50} max={Math.min(500, city.gold_treasury || 0)} step={50} value={loanAmount}
                  onChange={e => setLoanAmount(Math.max(50, parseInt(e.target.value) || 50))}
                  className="w-20 h-7 text-xs text-center border border-input rounded-md bg-background px-2"
                  onFocus={e => e.target.select()} />
                <span className="text-xs text-muted-foreground">or</span>
              </div>
              <button onClick={() => onRequestLoan(loanAmount)}
                className="text-xs font-heading bg-blue-500 hover:bg-blue-600 text-white rounded-md px-3 py-1.5">
                Emprunter → rembourser {loanAmount + Math.floor(loanAmount * (city.loan_rate || 0) / 100)} 💰 / 7j
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Dépôts ── */}
      {mayorActive && (city.deposit_rate || 0) > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-body font-semibold">🏦 Déposer de l'or à la ville</p>
          {activeDeposits.map((dep, idx) => {
            const matured = now >= dep.due_at;
            return (
              <div key={idx} className={`bg-white border rounded-lg p-3 flex justify-between items-center text-sm font-body ${matured ? "border-green-300" : "border-border"}`}>
                <div>
                  <span className="font-semibold">{dep.amount} 💰 déposés</span>
                  <span className="text-muted-foreground ml-2 text-xs">→ {dep.amount + dep.interest} 💰 le {dep.due_at}</span>
                </div>
                {matured ? (
                  <button onClick={() => onClaimDeposit(dep, idx)}
                    className="text-xs font-heading bg-green-500 hover:bg-green-600 text-white rounded-md px-2 py-1">
                    Récupérer {dep.amount + dep.interest} 💰
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground font-body">⏳ {dep.due_at}</span>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <input type="number"
                       inputMode="numeric"
                       pattern="[0-9]*" min={50} max={profile.gold || 0} step={50} value={depositAmount}
                onChange={e => setDepositAmount(Math.max(50, parseInt(e.target.value) || 50))}
                className="w-20 h-7 text-xs text-center border border-input rounded-md bg-background px-2"
                onFocus={e => e.target.select()} />
              <span className="text-xs text-muted-foreground">or</span>
            </div>
            <button onClick={() => onDeposit(depositAmount)}
              className="text-xs font-heading bg-green-500 hover:bg-green-600 text-white rounded-md px-3 py-1.5">
              Déposer → récupérer {depositAmount + Math.floor(depositAmount * (city.deposit_rate || 0) / 100)} 💰 / 7j
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
