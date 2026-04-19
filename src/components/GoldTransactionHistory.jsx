import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TYPE_ICONS = {
  vente: "📤",
  achat: "📥",
  taxe_marche: "🏪",
  impot: "👑",
  peage: "🚪",
  frais_voyage: "🛣️",
  rachat_entrepot: "📦",
  pret: "🏦",
  remboursement: "✅",
  depot: "💾",
  retrait_depot: "💸",
  vol_recu: "💰",
  vol_subi: "😱",
  cout_production: "⚒️",
  logement: "🏠",
  maire: "🏛️",
  demenagement: "🚚",
  objectif: "🎯",
};

const TYPE_COLORS = {
  vente: "bg-emerald-100 text-emerald-800",
  achat: "bg-red-100 text-red-800",
  taxe_marche: "bg-orange-100 text-orange-800",
  impot: "bg-purple-100 text-purple-800",
  peage: "bg-blue-100 text-blue-800",
  frais_voyage: "bg-cyan-100 text-cyan-800",
  rachat_entrepot: "bg-amber-100 text-amber-800",
  pret: "bg-indigo-100 text-indigo-800",
  remboursement: "bg-lime-100 text-lime-800",
  depot: "bg-gray-100 text-gray-800",
  retrait_depot: "bg-gray-100 text-gray-800",
  vol_recu: "bg-green-100 text-green-800",
  vol_subi: "bg-red-100 text-red-800",
  cout_production: "bg-slate-100 text-slate-800",
  logement: "bg-yellow-100 text-yellow-800",
  maire: "bg-purple-100 text-purple-800",
  demenagement: "bg-pink-100 text-pink-800",
  objectif: "bg-green-100 text-green-800",
};

export default function GoldTransactionHistory({ playerEmail }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTransactions() {
      try {
        const txns = await base44.entities.GoldTransaction.filter(
          { player_email: playerEmail },
          "-created_date",
          100
        );
        setTransactions(txns);
      } catch (e) {
        console.warn("GoldTransactionHistory:", e);
      } finally {
        setLoading(false);
      }
    }
    loadTransactions();
  }, [playerEmail]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>💰 Historique des transactions</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>💰 Historique des transactions</CardTitle>
          <CardDescription>Aucune transaction enregistrée</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalIn = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>💰 Historique des transactions</CardTitle>
        <CardDescription>
          Entrées: +{totalIn} | Sorties: -{totalOut} | Solde: {totalIn - totalOut}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50"
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-lg">{TYPE_ICONS[tx.type] || "💳"}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{tx.description || tx.type}</div>
                  {tx.city_name && (
                    <div className="text-xs text-muted-foreground">{tx.city_name}</div>
                  )}
                  {tx.created_date && (
                    <div className="text-xs text-muted-foreground">
                      {new Date(tx.created_date).toLocaleDateString("fr-FR", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${TYPE_COLORS[tx.type] || "bg-gray-100 text-gray-800"} font-mono`}>
                  {tx.amount > 0 ? "+" : ""}{tx.amount} 💰
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}