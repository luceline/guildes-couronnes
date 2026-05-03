/**
 * TavernLotteryPanel.jsx : Loterie hebdomadaire mutualisée du royaume.
 *
 * Concept : une seule cagnotte commune à toutes les villes, accessible
 * uniquement depuis une ville disposant d'une taverne. Tirage automatique
 * chaque lundi à 06:00 UTC via le cron de reset quotidien.
 *
 * Mécaniques :
 *   - 5 or par ticket
 *   - Maximum 20 tickets par joueur par cycle
 *   - Sélection pondérée du gagnant (plus tu as de tickets, plus tes chances montent)
 *   - 95% de la cagnotte au gagnant, 5% détruits (sink économique)
 *   - Achat fermé 10 minutes avant tirage (anti-race condition)
 *
 * Anti-cheat : le pot est calculé dynamiquement à partir des records
 *   `lottery_tickets` côté serveur lors du tirage, pas depuis le champ
 *   pot_value qui pourrait être manipulé.
 */
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logGold } from "@/lib/goldLog";
import { toast } from "sonner";

// ─── Constantes ─────────────────────────────────────────────────────────
const TICKET_PRICE = 5;
const MAX_TICKETS_PER_CYCLE = 20;
const DESTRUCTION_RATE = 0.05; // 5% détruit, 95% au gagnant
const FREEZE_BEFORE_DRAW_MIN = 10; // pas d'achat dans les 10 min avant tirage

// ─── Helpers temps ──────────────────────────────────────────────────────
function getNextMondayDraw() {
  // Retourne la date/heure du prochain lundi 06:00 UTC
  const now = new Date();
  const nextMonday = new Date(now);
  const daysUntilMonday = (1 - now.getUTCDay() + 7) % 7 || 7;
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(6, 0, 0, 0);
  // Si on EST lundi mais avant 6h UTC, c'est aujourd'hui
  if (now.getUTCDay() === 1 && now.getUTCHours() < 6) {
    nextMonday.setUTCDate(now.getUTCDate());
  }
  return nextMonday;
}

function formatTimeRemaining(targetDate) {
  const ms = targetDate.getTime() - Date.now();
  if (ms <= 0) return "Tirage imminent…";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}j ${h % 24}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function isFrozen(drawDate) {
  return drawDate.getTime() - Date.now() < FREEZE_BEFORE_DRAW_MIN * 60 * 1000;
}

// ─── Composant principal ────────────────────────────────────────────────
export default function TavernLotteryPanel({ profile, city, onRefresh }) {
  const [currentLottery, setCurrentLottery] = useState(null);
  const [myTicket, setMyTicket] = useState(null);
  const [allTickets, setAllTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchaseQty, setPurchaseQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);

  const drawDate = getNextMondayDraw();
  const frozen = isFrozen(drawDate);

  // ─── Chargement des données ───
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Récupère le cycle ouvert (un seul à la fois)
      const lotteries = await base44.entities.WeeklyLottery.filter({ status: "open" });
      const lottery = lotteries[0] || null;
      setCurrentLottery(lottery);

      if (lottery) {
        // Tickets de tous les joueurs ce cycle (pour calcul du pot et probabilités)
        const tickets = await base44.entities.LotteryTicket.filter({ cycle_number: lottery.cycle_number });
        setAllTickets(tickets);

        // Mon ticket éventuel
        const mine = tickets.find(t => t.player_email === profile.user_email);
        setMyTicket(mine || null);
      } else {
        setAllTickets([]);
        setMyTicket(null);
      }
    } catch (e) {
      console.error("[TavernLottery] load error:", e);
    } finally {
      setLoading(false);
    }
  }, [profile.user_email]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // refresh toutes les 30s
    return () => clearInterval(interval);
  }, [loadData]);

  // ─── Calculs dérivés ───
  const totalTickets = allTickets.reduce((sum, t) => sum + (t.tickets_count || 0), 0);
  const potValue = totalTickets * TICKET_PRICE;
  const myTicketCount = myTicket?.tickets_count || 0;
  const myWinChance = totalTickets > 0 ? (myTicketCount / totalTickets) : 0;
  const ticketsRemaining = MAX_TICKETS_PER_CYCLE - myTicketCount;
  const expectedWinnerPayout = Math.floor(potValue * (1 - DESTRUCTION_RATE));

  // ─── Achat de tickets ───
  const handleBuyTickets = async () => {
    if (!currentLottery) {
      toast.error("Aucune loterie en cours pour le moment.");
      return;
    }
    if (frozen) {
      toast.error("🔒 Le tirage est imminent, les ventes sont fermées.");
      return;
    }
    const qty = parseInt(purchaseQty, 10);
    if (isNaN(qty) || qty < 1 || qty > ticketsRemaining) {
      toast.error(`Quantité invalide (1 à ${ticketsRemaining}).`);
      return;
    }
    const totalCost = qty * TICKET_PRICE;
    if ((profile.gold || 0) < totalCost) {
      toast.error(`Pas assez d'or (${totalCost}💰 nécessaires).`);
      return;
    }

    setSubmitting(true);
    try {
      // Débit immédiat de l'or (verrouillé jusqu'au tirage)
      await base44.entities.PlayerProfile.update(profile.id, {
        gold: (profile.gold || 0) - totalCost,
      });
      await logGold({
        profile, city,
        amount: -totalCost, type: "loterie",
        description: `Achat de ${qty} ticket${qty > 1 ? "s" : ""} de loterie`,
      });

      // Mise à jour ou création du record de tickets
      if (myTicket) {
        await base44.entities.LotteryTicket.update(myTicket.id, {
          tickets_count: myTicketCount + qty,
          last_purchase_at: new Date().toISOString(),
        });
      } else {
        await base44.entities.LotteryTicket.create({
          cycle_number: currentLottery.cycle_number,
          player_email: profile.user_email,
          player_name: profile.character_name || "",
          tickets_count: qty,
          last_purchase_at: new Date().toISOString(),
        });
      }

      toast.success(`🎰 ${qty} ticket${qty > 1 ? "s acquis" : " acquis"} ! Bonne chance.`);
      onRefresh?.();
      loadData();
      setPurchaseQty(1);
    } catch (e) {
      console.error("[TavernLottery] purchase error:", e);
      toast.error("L'achat a échoué. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Historique ───
  const loadHistory = async () => {
    try {
      const past = await base44.entities.WeeklyLottery.filter({ status: "resolved" });
      // Trier par cycle décroissant, prendre les 10 derniers
      past.sort((a, b) => (b.cycle_number || 0) - (a.cycle_number || 0));
      setHistory(past.slice(0, 10));
      setShowHistory(true);
    } catch (e) {
      toast.error("Impossible de charger l'historique.");
    }
  };

  // ─── Rendu ───
  return (
    <Card className="flex flex-col">
      <CardContent className="pt-4 space-y-3">
        {/* En-tête */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-heading text-base">🎰 Loterie hebdomadaire</h3>
            <p className="text-xs text-muted-foreground font-body italic">
              Une seule cagnotte pour tout le royaume. Tirage chaque lundi à l'aube.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="font-body text-xs h-7 px-2 shrink-0"
            onClick={loadHistory}
          >
            📜 Historique
          </Button>
        </div>

        {loading && (
          <div className="text-xs text-muted-foreground font-body italic">Chargement…</div>
        )}

        {!loading && !currentLottery && (
          <div className="bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs font-body text-muted-foreground italic">
            Aucune loterie en cours. Un nouveau cycle démarrera bientôt.
          </div>
        )}

        {!loading && currentLottery && (
          <>
            {/* Cagnotte */}
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-lg p-3 text-center">
              <div className="text-xs font-body text-amber-700 uppercase tracking-wide">Cagnotte actuelle</div>
              <div className="text-3xl font-heading text-amber-900 my-1">{potValue} 💰</div>
              <div className="text-xs font-body text-amber-700">
                Le gagnant emporte <span className="font-semibold">{expectedWinnerPayout}💰</span>
                <span className="italic"> ({Math.round(DESTRUCTION_RATE * 100)}% détruits)</span>
              </div>
            </div>

            {/* Compte à rebours */}
            <div className="bg-card border border-border rounded-lg px-3 py-2 text-center">
              <div className="text-xs font-body text-muted-foreground">⏳ Tirage dans</div>
              <div className="font-heading text-sm">{formatTimeRemaining(drawDate)}</div>
              {frozen && (
                <div className="text-xs italic text-red-600 mt-1">
                  🔒 Ventes fermées, tirage imminent
                </div>
              )}
            </div>

            {/* Mes tickets */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between text-xs font-body">
                <span>Mes tickets ce cycle :</span>
                <Badge variant="secondary" className="font-semibold">
                  {myTicketCount} / {MAX_TICKETS_PER_CYCLE}
                </Badge>
              </div>
              {myTicketCount > 0 && totalTickets > 0 && (
                <div className="text-xs font-body text-muted-foreground italic">
                  Probabilité de gagner : <span className="font-semibold">{(myWinChance * 100).toFixed(1)}%</span>
                </div>
              )}
            </div>

            {/* Achat */}
            {ticketsRemaining > 0 && !frozen && (
              <div className="bg-card border border-border rounded-lg p-3 space-y-2">
                <div className="text-xs font-body font-semibold">Acheter des tickets</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={ticketsRemaining}
                    value={purchaseQty}
                    onChange={e => setPurchaseQty(e.target.value)}
                    disabled={submitting}
                    className="font-body text-sm w-20"
                  />
                  <span className="text-xs font-body text-muted-foreground">
                    × {TICKET_PRICE}💰 = <span className="font-semibold">{(parseInt(purchaseQty, 10) || 0) * TICKET_PRICE}💰</span>
                  </span>
                  <Button
                    size="sm"
                    className="font-heading text-xs ml-auto"
                    onClick={handleBuyTickets}
                    disabled={submitting || (parseInt(purchaseQty, 10) || 0) < 1}
                  >
                    {submitting ? "..." : "🎟️ Acheter"}
                  </Button>
                </div>
                <div className="text-[10px] text-muted-foreground font-body italic">
                  Maximum {MAX_TICKETS_PER_CYCLE} tickets par cycle. Or débité immédiatement.
                </div>
              </div>
            )}

            {ticketsRemaining === 0 && (
              <div className="text-xs italic text-amber-700 text-center py-2">
                Vous avez atteint la limite de tickets pour ce cycle.
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Modal historique */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">📜 Derniers tirages</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Aucun tirage passé.</p>
            )}
            {history.map(h => (
              <div key={h.id} className="border border-border rounded-lg p-2 text-sm font-body">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Cycle #{h.cycle_number}</span>
                  <span className="text-xs text-muted-foreground">
                    {h.cycle_end ? new Date(h.cycle_end).toLocaleDateString("fr-FR") : ""}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Cagnotte : <span className="font-semibold">{h.pot_value || 0}💰</span>
                  {" · "}
                  Gagnant : <span className="font-semibold">{h.winner_name || h.winner_email || "(aucun)"}</span>
                  {" · "}
                  Empoche : <span className="font-semibold text-amber-700">{h.winner_payout || 0}💰</span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
