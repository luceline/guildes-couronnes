import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function BountyBoard({ profile, cityId, cityName }) {
  const [bounties, setBounties] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  // Formulaire
  const [targetEmail, setTargetEmail] = useState("");
  const [rewardGold, setRewardGold] = useState(50);
  const [note, setNote] = useState("");

  useEffect(() => {
    load();
  }, [cityId]);

  async function load() {
    setLoading(true);
    // REFONTE v5 : les primes sont globales (suivent la cible), on charge toutes les primes actives
    const [bList, pList] = await Promise.all([
      base44.entities.Bounty.filter({ status: "active" }, "-created_date", 100),
      base44.entities.PlayerProfile.list("character_name", 100),
    ]);
    setBounties(bList);
    setPlayers(pList.filter(p => p.user_email !== profile.user_email));
    setLoading(false);
  }

  const handlePost = async () => {
    if (!targetEmail) { toast.error("Choisissez une cible."); return; }
    if (rewardGold <= 0) { toast.error("La récompense doit être supérieure à 0."); return; }
    if ((profile.gold || 0) < rewardGold) { toast.error(`Pas assez d'or (vous avez ${profile.gold || 0} 💰).`); return; }
    if (targetEmail === profile.user_email) { toast.error("Vous ne pouvez pas vous cibler vous-même."); return; }

    const target = players.find(p => p.user_email === targetEmail);
    if (!target) { toast.error("Joueur introuvable."); return; }

    setPosting(true);
    // Prélever l'or immédiatement
    await base44.entities.PlayerProfile.update(profile.id, {
      gold: (profile.gold || 0) - rewardGold,
    });
    await base44.entities.GoldTransaction.create({
      player_email: profile.user_email,
      player_name: profile.character_name,
      city_id: cityId,
      city_name: cityName,
      amount: -rewardGold,
      type: "peage",
      description: `Prime posée sur ${target.character_name} (${rewardGold} 💰 bloqués)`,
    }).catch(() => {});
    await base44.entities.Bounty.create({
      poster_email: profile.user_email,
      poster_name: profile.character_name,
      target_email: target.user_email,
      target_name: target.character_name,
      reward_gold: rewardGold,
      city_id: cityId,
      city_name: cityName,
      note: note.trim() || "",
      status: "active",
    });
    toast.success(`🏴‍☠️ Prime de ${rewardGold} 💰 posée sur ${target.character_name} !`);
    setTargetEmail("");
    setRewardGold(50);
    setNote("");
    setPosting(false);
    load();
  };

  return (
    <div className="space-y-4">
      {/* ── Formulaire poster une prime ── */}
      <Card className="border-red-200">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base">🏴‍☠️ Poster une prime</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground font-body">
            Désignez un joueur. L'or est prélevé immédiatement et sera versé au premier qui le défaira en combat zoné PvP, n'importe où dans le royaume. Une fois posée, la prime ne peut plus être annulée.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-body text-muted-foreground">Cible</label>
            <select
              value={targetEmail}
              onChange={e => setTargetEmail(e.target.value)}
              className="w-full border border-border rounded-md px-2 py-1.5 text-sm font-body bg-background"
            >
              <option value="">Choisir un joueur</option>
              {players.map(p => (
                <option key={p.user_email} value={p.user_email}>
                  {p.character_name} ({p.profession})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-body text-muted-foreground shrink-0">Récompense (💰)</label>
            <Input
              type="number"
              min={1}
              max={profile.gold || 0}
              value={rewardGold}
              onChange={e => setRewardGold(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-28 text-sm"
              onFocus={e => e.target.select()}
            />
            <span className="text-xs text-muted-foreground font-body">Votre or : {profile.gold || 0} 💰</span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-body text-muted-foreground">Message / raison (optionnel)</label>
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ex: Il m'a volé la semaine dernière..."
              className="font-body text-sm"
              maxLength={120}
            />
          </div>

          <Button
            onClick={handlePost}
            disabled={posting || !targetEmail || rewardGold <= 0 || (profile.gold || 0) < rewardGold}
            className="w-full font-heading"
            variant="destructive"
          >
            {posting ? "Publication..." : `🏴‍☠️ Poster la prime : ${rewardGold} 💰`}
          </Button>
        </CardContent>
      </Card>

      {/* ── Liste des primes actives ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base">
            📋 Avis de recherche du royaume
            {bounties.length > 0 && <Badge className="ml-2 bg-red-100 text-red-800 border-red-200 font-body">{bounties.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : bounties.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body text-center py-6">
              Aucune prime active dans tout le royaume. La paix règne... pour l'instant.
            </p>
          ) : (
            <div className="space-y-3">
              {bounties.map(b => (
                <div key={b.id} className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="font-heading font-semibold text-sm">🎯 {b.target_name}</span>
                      <span className="text-xs text-muted-foreground font-body ml-2">· prime posée par {b.poster_name}</span>
                    </div>
                    <Badge className="bg-amber-400 text-amber-900 border-amber-300 font-heading text-sm">
                      +{b.reward_gold} 💰
                    </Badge>
                  </div>
                  {b.note && (
                    <p className="text-xs text-red-800 font-body italic">« {b.note} »</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}