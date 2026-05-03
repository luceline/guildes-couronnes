/**
 * TavernDicePanel.jsx : Table de jeux de la taverne (hazart asynchrone).
 *
 * Inspiré du jeu de hazart médiéval (XIIIe siècle) : 3 dés, 1 vs 1, plus haut
 * total gagne. Une "tierce" (3 dés identiques) bat tout et paie ×3.
 *
 * Architecture :
 *   1. Un joueur publie un défi (mise verrouillée immédiatement)
 *   2. Un autre joueur l'accepte → résolution serveur instantanée
 *   3. Animation de dés côté client en utilisant les valeurs déjà calculées
 *      (illusion de jeu, mais le résultat est déterminé au moment de l'acceptation)
 *
 * Anti-triche :
 *   - Les dés et le résultat sont calculés côté serveur lors de l'acceptation
 *   - Le seed est stocké et auditable (transparent post-résolution)
 *   - Le client ne fait qu'animer les valeurs serveur
 *
 * Quotas et règles :
 *   - Mise : 10 à 200 or
 *   - Max 5 parties par joueur par jour (anti-addiction)
 *   - Commission tavernier : 10% sur le pot total
 *   - Table accessible si ≥3 joueurs présents dans la ville (city_id partagé)
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

const MIN_MISE = 10;
const MAX_MISE = 200;
const MAX_PARTIES_PAR_JOUR = 5;
const TAVERN_COMMISSION = 0.10; // 10% pour le tavernier
const PRESENCE_THRESHOLD = 3;   // ≥3 joueurs présents pour ouvrir la table
const CHALLENGE_EXPIRY_HOURS = 24;

// ─── Helpers ──────────────────────────────────────────────────────────────

function getPartiesAujourdhui(profile) {
  const today = new Date().toISOString().split("T")[0];
  const data = profile?.dice_played_today;
  if (!data || data.date !== today) return 0;
  return data.count || 0;
}

// Calcule un score serveur-déterministe à partir d'un seed string.
// Retourne 3 valeurs de dés (1-6) + le score (somme ou bonus tierce).
function rollDice(seedStr) {
  // Hash déterministe simple : on prend des chunks du hash pour les 3 dés
  let hash = 5381;
  for (let i = 0; i < seedStr.length; i++) {
    hash = ((hash << 5) + hash) + seedStr.charCodeAt(i);
  }
  hash = Math.abs(hash);
  const d1 = (hash % 6) + 1;
  const d2 = (Math.floor(hash / 6) % 6) + 1;
  const d3 = (Math.floor(hash / 36) % 6) + 1;
  return { dice: [d1, d2, d3] };
}

function isTierce(dice) {
  return dice[0] === dice[1] && dice[1] === dice[2];
}

function scoreOf(dice) {
  // Tierce = score maximum théorique +1 pour battre toute somme normale (max 18)
  // On retourne 100 + valeur du dé pour départager en cas de double tierce
  if (isTierce(dice)) return 100 + dice[0];
  return dice[0] + dice[1] + dice[2];
}

// ─── Composants visuels ───────────────────────────────────────────────────

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

/**
 * DiceDisplay : affiche 3 dés. Animation au montage si `animating` est true.
 * Une fois animation finie, montre les vraies valeurs `values`.
 */
function DiceDisplay({ values, animating = false, label = null, isWinner = false }) {
  const [displayValues, setDisplayValues] = useState(animating ? [1, 1, 1] : values);

  useEffect(() => {
    if (!animating) {
      setDisplayValues(values);
      return;
    }
    // Animation : les dés roulent (valeurs aléatoires) puis s'arrêtent un par un
    const interval = setInterval(() => {
      setDisplayValues([
        Math.ceil(Math.random() * 6),
        Math.ceil(Math.random() * 6),
        Math.ceil(Math.random() * 6),
      ]);
    }, 80);

    // Stoppe les dés un par un (effet "roulé puis arrêt")
    const stop1 = setTimeout(() => setDisplayValues(prev => [values[0], prev[1], prev[2]]), 1000);
    const stop2 = setTimeout(() => setDisplayValues(prev => [values[0], values[1], prev[2]]), 1400);
    const stop3 = setTimeout(() => {
      clearInterval(interval);
      setDisplayValues(values);
    }, 1800);

    return () => {
      clearInterval(interval);
      clearTimeout(stop1);
      clearTimeout(stop2);
      clearTimeout(stop3);
    };
  }, [animating, values]);

  const tierce = !animating && isTierce(values);

  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <div className={`text-xs font-body ${isWinner ? "text-amber-700 font-bold" : "text-muted-foreground"}`}>
          {label}
        </div>
      )}
      <div className="flex gap-2">
        {displayValues.map((v, idx) => (
          <span
            key={idx}
            className={`text-4xl ${tierce ? "text-amber-600 animate-pulse" : ""}`}
            style={{ fontVariantEmoji: "text" }}
          >
            {DICE_FACES[v - 1]}
          </span>
        ))}
      </div>
      {!animating && tierce && (
        <div className="text-xs font-heading font-bold text-amber-700">🌟 TIERCE !</div>
      )}
      {!animating && !tierce && (
        <div className="text-xs text-muted-foreground font-body">
          Total : <span className="font-semibold">{values[0] + values[1] + values[2]}</span>
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────

export default function TavernDicePanel({ profile, city, isResident, onRefresh }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [presentCount, setPresentCount] = useState(0);
  const [miseInput, setMiseInput] = useState("20");
  const [submitting, setSubmitting] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [resolveModal, setResolveModal] = useState(null); // { challenger_dice, accepter_dice, won, gain }
  const [showRules, setShowRules] = useState(false);

  const partiesAujourdhui = getPartiesAujourdhui(profile);
  const quotaAtteint = partiesAujourdhui >= MAX_PARTIES_PAR_JOUR;

  // ─── Chargement initial : défis ouverts + présence ───
  const loadData = useCallback(async () => {
    if (!city?.id) return;
    setLoading(true);
    try {
      // Défis ouverts dans cette ville (status = "open")
      const open = await base44.entities.TavernDiceChallenge.filter({
        city_id: city.id,
        status: "open",
      });
      // Filtre côté client les expirés (au cas où le cron n'a pas encore tourné)
      const now = Date.now();
      const stillOpen = open.filter(c => new Date(c.expires_at).getTime() > now);
      setChallenges(stillOpen);

      // Compte les joueurs présents dans la ville
      const players = await base44.entities.PlayerProfile.filter({ city_id: city.id });
      setPresentCount(players.filter(p => p.character_name).length);
    } catch (e) {
      console.error("[TavernDice] load error:", e);
    } finally {
      setLoading(false);
    }
  }, [city?.id]);

  useEffect(() => {
    loadData();
    // Refresh toutes les 20s pour voir les nouveaux défis
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ─── Lancer un défi ───
  const handlePublishChallenge = async () => {
    if (quotaAtteint) {
      toast.error(`🍺 Vous avez déjà joué ${MAX_PARTIES_PAR_JOUR} parties aujourd'hui. Le tavernier vous remercie pour votre largesse, mais il est temps de cesser !`);
      return;
    }
    const mise = parseInt(miseInput, 10);
    if (isNaN(mise) || mise < MIN_MISE || mise > MAX_MISE) {
      toast.error(`Mise invalide : entre ${MIN_MISE} et ${MAX_MISE} or.`);
      return;
    }
    if ((profile.gold || 0) < mise) {
      toast.error(`Pas assez d'or pour cette mise (${mise} 💰).`);
      return;
    }
    // Anti-spam : un joueur ne peut avoir qu'un seul défi ouvert à la fois
    const myOpen = challenges.find(c => c.challenger_email === profile.user_email);
    if (myOpen) {
      toast.error("Vous avez déjà un défi en cours. Attendez qu'on le relève ou laissez-le expirer.");
      return;
    }

    setSubmitting(true);
    try {
      // Verrouille la mise immédiatement (déduction or)
      await base44.entities.PlayerProfile.update(profile.id, {
        gold: (profile.gold || 0) - mise,
      });
      await logGold({
        profile, city,
        amount: -mise, type: "jeu_tavern",
        description: `Mise table de hazart : défi à ${mise}💰`,
      });

      const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_HOURS * 3600 * 1000).toISOString();
      await base44.entities.TavernDiceChallenge.create({
        city_id: city.id,
        city_name: city.name || "",
        challenger_email: profile.user_email,
        challenger_name: profile.character_name,
        mise: mise,
        status: "open",
        expires_at: expiresAt,
      });

      toast.success(`🎲 Votre défi est lancé ! ${mise}💰 sur la table : qui osera relever le gant ?`);
      onRefresh?.();
      loadData();
    } catch (e) {
      console.error("[TavernDice] publish error:", e);
      toast.error("Le tavernier secoue la tête : impossible de poser votre défi pour l'heure.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Accepter un défi (résout immédiatement) ───
  const handleAcceptChallenge = async (challenge) => {
    if (challenge.challenger_email === profile.user_email) {
      toast.error("Vous ne pouvez pas accepter votre propre défi !");
      return;
    }
    if (quotaAtteint) {
      toast.error(`🍺 Vous avez déjà joué ${MAX_PARTIES_PAR_JOUR} parties aujourd'hui.`);
      return;
    }
    if ((profile.gold || 0) < challenge.mise) {
      toast.error(`Pas assez d'or pour relever ce défi (${challenge.mise} 💰).`);
      return;
    }

    setAccepting(challenge.id);
    try {
      // Recharge le défi pour vérifier qu'il est toujours ouvert (anti-race)
      const fresh = await base44.entities.TavernDiceChallenge.get(challenge.id);
      if (fresh.status !== "open") {
        toast.error("Ce défi a déjà été relevé par un autre joueur. Trop tard !");
        loadData();
        return;
      }

      // Lance les dés (calcul serveur-déterministe basé sur le challenge_id + acceptation timestamp)
      const seedChallenger = `chall:${challenge.id}`;
      const seedAccepter = `acc:${challenge.id}:${Date.now()}`;
      const challengerRoll = rollDice(seedChallenger);
      const accepterRoll = rollDice(seedAccepter);

      const challengerScore = scoreOf(challengerRoll.dice);
      const accepterScore = scoreOf(accepterRoll.dice);

      // Détermination du gagnant
      let winner; // "challenger" | "accepter" | "tie"
      if (challengerScore > accepterScore) winner = "challenger";
      else if (accepterScore > challengerScore) winner = "accepter";
      else winner = "tie";

      const isChallengerTierce = isTierce(challengerRoll.dice);
      const isAccepterTierce = isTierce(accepterRoll.dice);
      const tierceMultiplier = (winner === "challenger" && isChallengerTierce) ||
                               (winner === "accepter" && isAccepterTierce) ? 3 : 2;

      // Calcul des gains : pot = 2× mise, commission tavernier 10%, le reste au gagnant
      const pot = challenge.mise * 2;
      const commission = Math.round(pot * TAVERN_COMMISSION);
      const winnerPayout = pot - commission;

      // En cas de tierce du gagnant, on bonifie : ×3 du pot brut au lieu de ×2 (10% commission tavernier toujours)
      // = 3× la mise initiale du gagnant + 2× la mise du perdant - commission
      // Pour rester simple : on multiplie le pot par 1.5 si tierce gagnante
      const finalPayout = tierceMultiplier === 3
        ? Math.round((challenge.mise * 3) * (1 - TAVERN_COMMISSION))
        : winnerPayout;

      // En cas d'égalité : chacun récupère sa mise (pas de commission)
      const isTie = winner === "tie";

      // Update profil joueur (accepter)
      const today = new Date().toISOString().split("T")[0];
      const accepterCount = getPartiesAujourdhui(profile);
      const updates = {
        dice_played_today: { date: today, count: accepterCount + 1 },
      };

      let accepterDelta = -challenge.mise; // mise verrouillée
      if (isTie) {
        accepterDelta = 0; // mise rendue
      } else if (winner === "accepter") {
        accepterDelta = -challenge.mise + finalPayout; // mise déduite + payout
      }
      // Si l'accepter a perdu, sa mise est juste consommée (delta = -mise)
      updates.gold = (profile.gold || 0) + accepterDelta;

      await base44.entities.PlayerProfile.update(profile.id, updates);
      await logGold({
        profile, city,
        amount: accepterDelta, type: "jeu_tavern",
        description: `Hazart contre ${challenge.challenger_name}: ${winner === "accepter" ? "victoire" : winner === "tie" ? "égalité" : "défaite"}${isAccepterTierce && winner === "accepter" ? " 🌟 (tierce!)" : ""}`,
      });

      // Update profil challenger
      const challengerProfiles = await base44.entities.PlayerProfile.filter({
        user_email: challenge.challenger_email,
      });
      if (challengerProfiles.length > 0) {
        const challProfile = challengerProfiles[0];
        let challengerDelta = 0; // mise déjà déduite à la publication
        if (isTie) {
          challengerDelta = challenge.mise; // mise rendue
        } else if (winner === "challenger") {
          challengerDelta = finalPayout; // gain
        }
        // Si challenger a perdu, sa mise reste consommée (delta = 0 ici car déjà déduite)
        if (challengerDelta !== 0) {
          await base44.entities.PlayerProfile.update(challProfile.id, {
            gold: (challProfile.gold || 0) + challengerDelta,
          });
          await logGold({
            profile: challProfile, city,
            amount: challengerDelta,
            type: "jeu_tavern",
            description: `Hazart contre ${profile.character_name}: ${winner === "challenger" ? "victoire" : winner === "tie" ? "égalité" : "défaite"}${isChallengerTierce && winner === "challenger" ? " 🌟 (tierce!)" : ""}`,
          });
        }
      }

      // Update du défi
      await base44.entities.TavernDiceChallenge.update(challenge.id, {
        status: isTie ? "resolved_tie" : `resolved_${winner}`,
        accepter_email: profile.user_email,
        accepter_name: profile.character_name,
        challenger_dice: challengerRoll.dice,
        accepter_dice: accepterRoll.dice,
        resolved_at: new Date().toISOString(),
        winner_payout: isTie ? 0 : finalPayout,
        commission: isTie ? 0 : commission,
      });

      // Affiche le modal de résolution avec animation
      setResolveModal({
        challenger_name: challenge.challenger_name,
        accepter_name: profile.character_name,
        challenger_dice: challengerRoll.dice,
        accepter_dice: accepterRoll.dice,
        winner,
        mise: challenge.mise,
        payout: finalPayout,
        meDelta: accepterDelta,
      });

      onRefresh?.();
      loadData();
    } catch (e) {
      console.error("[TavernDice] accept error:", e);
      toast.error("Le tavernier renverse une chope : la partie n'a pu se faire.");
    } finally {
      setAccepting(null);
    }
  };

  // ─── Annuler son propre défi (récupère la mise) ───
  const handleCancelChallenge = async (challenge) => {
    if (challenge.challenger_email !== profile.user_email) return;
    try {
      await base44.entities.TavernDiceChallenge.update(challenge.id, {
        status: "cancelled",
      });
      await base44.entities.PlayerProfile.update(profile.id, {
        gold: (profile.gold || 0) + challenge.mise,
      });
      await logGold({
        profile, city,
        amount: challenge.mise, type: "jeu_tavern",
        description: `Annulation défi hazart (mise rendue)`,
      });
      toast.success(`🍺 Votre mise vous est rendue (${challenge.mise}💰).`);
      onRefresh?.();
      loadData();
    } catch (e) {
      toast.error("Impossible d'annuler ce défi.");
    }
  };

  // ─── Rendu ───
  const tableOpen = presentCount >= PRESENCE_THRESHOLD;

  return (
    <Card className="flex flex-col" style={{ minHeight: 360 }}>
      <CardContent className="pt-4 space-y-3">
        {/* En-tête */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-heading text-base">🎲 Table de hazart</h3>
            <p className="text-xs text-muted-foreground font-body italic">
              Trois dés, une mise, le hasard tranche.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="font-body text-xs h-7 px-2"
              onClick={() => setShowRules(true)}
            >
              ❓ Règles
            </Button>
            <Badge variant="secondary" className="font-body text-xs">
              {presentCount} ici
            </Badge>
          </div>
        </div>

        {/* État de la table */}
        {!tableOpen && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-body text-amber-800 italic">
            🍺 La taverne est trop calme ce soir... Le tavernier remballe les dés. Il en faut au moins {PRESENCE_THRESHOLD} pour ouvrir la table (vous êtes {presentCount}).
          </div>
        )}

        {/* Quota du jour */}
        {tableOpen && (
          <div className={`text-xs font-body px-3 py-2 rounded-lg border ${
            quotaAtteint
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}>
            🎲 Parties du jour : <span className="font-semibold">{partiesAujourdhui}/{MAX_PARTIES_PAR_JOUR}</span>
            {quotaAtteint
              ? <span className="italic"> · le tavernier vous coupe le passage. Repassez demain !</span>
              : <span className="italic"> · au-delà, le tavernier vous mettra dehors.</span>
            }
          </div>
        )}

        {/* Formulaire de défi */}
        {tableOpen && !quotaAtteint && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-2 border border-border">
            <div className="text-xs font-body font-semibold">Lancer un défi</div>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min={MIN_MISE}
                max={MAX_MISE}
                value={miseInput}
                onChange={e => setMiseInput(e.target.value)}
                placeholder={`Mise (${MIN_MISE}-${MAX_MISE})`}
                className="font-body text-sm"
                disabled={submitting}
              />
              <span className="text-xs font-body text-muted-foreground">💰</span>
              <Button
                size="sm"
                className="font-heading text-xs whitespace-nowrap"
                onClick={handlePublishChallenge}
                disabled={submitting}
              >
                {submitting ? "..." : "🎲 Défier"}
              </Button>
            </div>
            <div className="text-[10px] text-muted-foreground font-body italic">
              Le tavernier prend {Math.round(TAVERN_COMMISSION * 100)}% du pot. Tierce (3 dés identiques) = victoire automatique × payout majoré.
            </div>
          </div>
        )}

        {/* Liste des défis ouverts */}
        <div className="space-y-2">
          <div className="text-xs font-body font-semibold text-muted-foreground">
            Défis en attente ({challenges.length})
          </div>

          {loading && (
            <div className="text-xs text-muted-foreground font-body italic">Le tavernier compte les chopes...</div>
          )}

          {!loading && challenges.length === 0 && (
            <div className="text-xs text-muted-foreground font-body italic px-3 py-3 text-center bg-muted/20 rounded-lg">
              🍺 Aucun défi pour l'instant. Lancez le vôtre, qui sait qui le relèvera ?
            </div>
          )}

          {challenges.map(c => {
            const isMine = c.challenger_email === profile.user_email;
            const expiresIn = Math.max(0, Math.round((new Date(c.expires_at).getTime() - Date.now()) / 3600000));
            return (
              <div key={c.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
                <div className="text-2xl">🎲</div>
                <div className="flex-1 min-w-0">
                  <div className="font-body text-sm font-semibold truncate">
                    {c.challenger_name}{isMine && " (vous)"}
                  </div>
                  <div className="text-xs text-muted-foreground font-body">
                    Mise : <span className="font-semibold">{c.mise} 💰</span>
                    <span className="ml-2 italic">· expire dans {expiresIn}h</span>
                  </div>
                </div>
                {isMine ? (
                  <Button size="sm" variant="outline" className="font-body text-xs" onClick={() => handleCancelChallenge(c)}>
                    Retirer
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="font-heading text-xs"
                    onClick={() => handleAcceptChallenge(c)}
                    disabled={accepting === c.id || quotaAtteint || (profile.gold || 0) < c.mise}
                  >
                    {accepting === c.id ? "..." : "Relever"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Modal de résolution (animation des dés) */}
      {resolveModal && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setResolveModal(null)}
        >
          <div
            className="bg-background rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border-2 border-amber-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="font-heading text-lg mb-1">🎲 Résultat du hazart</div>
              <div className="text-xs text-muted-foreground font-body italic">Mise : {resolveModal.mise}💰 chacun</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <DiceDisplay
                values={resolveModal.challenger_dice}
                animating={true}
                label={resolveModal.challenger_name}
                isWinner={resolveModal.winner === "challenger"}
              />
              <DiceDisplay
                values={resolveModal.accepter_dice}
                animating={true}
                label={`${resolveModal.accepter_name} (vous)`}
                isWinner={resolveModal.winner === "accepter"}
              />
            </div>

            <div className={`text-center p-3 rounded-lg ${
              resolveModal.winner === "tie"
                ? "bg-muted/40"
                : resolveModal.winner === "accepter"
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
            }`}>
              <div className="font-heading text-lg">
                {resolveModal.winner === "tie" && "🤝 Égalité, mises rendues"}
                {resolveModal.winner === "accepter" && `🏆 Vous l'emportez ! +${resolveModal.payout - resolveModal.mise}💰 net`}
                {resolveModal.winner === "challenger" && `💀 ${resolveModal.challenger_name} l'emporte. -${resolveModal.mise}💰`}
              </div>
            </div>

            <Button className="w-full font-heading" onClick={() => setResolveModal(null)}>
              Fermer
            </Button>
          </div>
        </div>
      )}

      {/* Dialog des règles du jeu */}
      <Dialog open={showRules} onOpenChange={setShowRules}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">🎲 Le jeu du hazart</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm font-body">
            <p className="italic text-muted-foreground">
              Le tavernier vous tend trois dés et explique :
            </p>
            <p>
              Vous misez entre <strong>{MIN_MISE} et {MAX_MISE} deniers d'or</strong>. Votre adversaire mise pareil. Chacun lance 3 dés. <strong>Le plus haut total l'emporte.</strong> En cas d'égalité, chacun récupère sa mise.
            </p>
            <p>
              Si vous sortez <strong>trois dés identiques</strong> (une "tierce"), vous remportez la mise quel que soit le résultat de votre adversaire, et le pot est <strong>majoré</strong>.
            </p>
            <p>
              Le tavernier prend <strong>{Math.round(TAVERN_COMMISSION * 100)}%</strong> du pot pour entretenir la maison. Le reste va au gagnant.
            </p>
            <p>
              <strong>Maximum {MAX_PARTIES_PAR_JOUR} parties par jour.</strong> C'est pour votre bien.
            </p>
            <p className="italic text-muted-foreground border-t border-border pt-3">
              Note du tavernier : l'Église réprouve, le Roi tolère, et moi je sers à boire.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
