// src/components/CommandBoardPanel.jsx
//
// Bourse aux contrats (CommandBoard) — UI Phase 1.
// Intégré comme onglet "Contrats" dans la page Marché.
//
// CONCEPT JOUEUR :
//   - Voir : liste des contrats du royaume (avec toggle "Mes contrats")
//   - Poser : formulaire (item, qty, reward) avec prix de référence marché 7j
//   - Livrer : bouton sur chaque contrat livrable (pas le sien, items en stock)
//
// SÉCURITÉ : aucune mutation client. Tout passe par /api/commandboard/post|deliver.

import { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "sonner";

import {
  TRADABLE_ITEMS,
  CMD_LIMITS,
  computeContractTax,
  computeContractTotalCost,
  fetchActiveContracts,
  fetchMyContracts,
  fetchMarketAverages7d,
  postContract,
  deliverContract,
  invalidateAveragesCache,
  formatTimeLeft,
  scoreContractForPlayer,
} from "@/lib/commandBoard";


// ────────────────────────────────────────────────────────────
// Sub-component : carte contrat
// ────────────────────────────────────────────────────────────
function ContractCard({ contract, profile, onDeliver, isDelivering }) {
  const isMine = contract.poster_email === profile.user_email;
  const itemDef = TRADABLE_ITEMS[contract.item_key];

  // Quantité que le joueur a en inventaire de cet item
  const inventoryQty = useMemo(() => {
    const inv = Array.isArray(profile.inventory) ? profile.inventory : [];
    const found = inv.find(i => i.item_key === contract.item_key);
    return found ? Math.floor(Number(found.quantity) || 0) : 0;
  }, [profile.inventory, contract.item_key]);

  const canDeliver = !isMine
    && contract.status === 'active'
    && inventoryQty >= contract.quantity;

  const statusBadge = (() => {
    if (contract.status === 'delivered') {
      return <Badge className="bg-green-100 text-green-800 border-green-200 font-body text-[10px]">Livré</Badge>;
    }
    if (contract.status === 'expired') {
      return <Badge className="bg-gray-100 text-gray-700 border-gray-200 font-body text-[10px]">Expiré</Badge>;
    }
    return null;
  })();

  return (
    <div className={`border rounded-lg p-3 space-y-1.5 ${isMine ? 'bg-amber-50 border-amber-200' : 'bg-card border-border'}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-lg shrink-0">{contract.item_icon || itemDef?.icon || '📦'}</span>
            <span className="font-heading font-semibold text-sm truncate">
              {contract.item_name || itemDef?.name || contract.item_key} × {contract.quantity}
            </span>
            {statusBadge}
            {isMine && (
              <Badge variant="outline" className="text-[10px] font-body">Vous</Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground font-body mt-0.5">
            Posé par <strong>{contract.poster_name}</strong> à {contract.poster_city_name}
          </p>
          {contract.note && (
            <p className="text-[11px] italic text-muted-foreground font-body mt-0.5">
              « {contract.note} »
            </p>
          )}
          {contract.status === 'active' && (
            <p className="text-[10px] text-muted-foreground font-body mt-0.5">
              ⏱️ {formatTimeLeft(contract.expires_at)}
            </p>
          )}
          {contract.status === 'delivered' && contract.deliverer_name && (
            <p className="text-[10px] text-green-700 font-body mt-0.5">
              📦 Livré par {contract.deliverer_name}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-heading font-bold text-amber-700 text-sm">
            +{contract.reward_gold} 💰
          </div>
          {contract.status === 'active' && !isMine && (
            <>
              {canDeliver ? (
                <Button
                  size="sm"
                  onClick={() => onDeliver(contract)}
                  disabled={isDelivering}
                  className="h-7 px-2 text-xs font-heading mt-1"
                >
                  {isDelivering ? '...' : 'Livrer'}
                </Button>
              ) : (
                <p className="text-[10px] text-muted-foreground font-body mt-1">
                  Stock : {inventoryQty}/{contract.quantity}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ────────────────────────────────────────────────────────────
// Sub-component : formulaire de pose
// ────────────────────────────────────────────────────────────
function PostContractForm({ profile, marketAverages, cityTaxPct, onPosted, onClose }) {
  const [itemKey, setItemKey] = useState('');
  const [quantity, setQuantity] = useState(5);
  const [rewardGold, setRewardGold] = useState(50);
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);

  const itemDef = itemKey ? TRADABLE_ITEMS[itemKey] : null;
  const tax = computeContractTax(rewardGold, cityTaxPct);
  const totalCost = computeContractTotalCost(rewardGold, cityTaxPct);
  const playerGold = Number(profile.gold) || 0;
  const canAfford = playerGold >= totalCost;

  const validQty = quantity >= CMD_LIMITS.MIN_QUANTITY && quantity <= CMD_LIMITS.MAX_QUANTITY;
  const validReward = rewardGold >= CMD_LIMITS.MIN_REWARD_GOLD && rewardGold <= CMD_LIMITS.MAX_REWARD_GOLD;

  // Hint prix marché
  const marketHint = useMemo(() => {
    if (!itemKey) return null;
    const data = marketAverages[itemKey];
    if (!data || data.count === 0) {
      return { text: 'Aucune vente récente — vous fixez le prix.', color: 'text-muted-foreground' };
    }
    const perUnit = quantity > 0 ? Math.round(rewardGold / quantity) : 0;
    const avg = data.avg;
    if (perUnit < avg * 0.7) {
      return {
        text: `Prix marché 7j : ${avg} 💰/u. Votre offre (${perUnit}/u) est faible — risque de non-livraison.`,
        color: 'text-orange-600'
      };
    }
    if (perUnit > avg * 1.5) {
      return {
        text: `Prix marché 7j : ${avg} 💰/u. Votre offre (${perUnit}/u) est généreuse, livraison probable.`,
        color: 'text-green-700'
      };
    }
    return {
      text: `Prix marché 7j : ${avg} 💰/u (${data.count} ventes). Votre offre : ${perUnit}/u.`,
      color: 'text-muted-foreground'
    };
  }, [itemKey, marketAverages, rewardGold, quantity]);

  // Items groupés par tier pour le select
  const groupedItems = useMemo(() => {
    const t1 = [], t2 = [], t3 = [];
    for (const [k, v] of Object.entries(TRADABLE_ITEMS)) {
      if (v.tier === 1) t1.push([k, v]);
      else if (v.tier === 2) t2.push([k, v]);
      else if (v.tier === 3) t3.push([k, v]);
    }
    return { t1, t2, t3 };
  }, []);

  const handlePost = async () => {
    if (!itemKey) { toast.error("Choisissez un item."); return; }
    if (!validQty) { toast.error(`Quantité : ${CMD_LIMITS.MIN_QUANTITY}-${CMD_LIMITS.MAX_QUANTITY}.`); return; }
    if (!validReward) { toast.error(`Récompense : ${CMD_LIMITS.MIN_REWARD_GOLD}-${CMD_LIMITS.MAX_REWARD_GOLD} 💰.`); return; }
    if (!canAfford) { toast.error(`Il vous faut ${totalCost} 💰 (vous avez ${playerGold}).`); return; }

    setPosting(true);
    try {
      const res = await postContract({
        itemKey,
        quantity: Math.floor(quantity),
        rewardGold: Math.floor(rewardGold),
        note: note.trim(),
      });
      toast.success(`📜 Contrat posé : ${quantity}× ${itemDef?.icon || ''} ${itemDef?.name || itemKey} (-${res.gold_spent} 💰)`);
      invalidateAveragesCache();  // au cas où on relistait
      onPosted();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Erreur à la pose du contrat.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-body">
        Postez une commande publique : un autre joueur la livrera contre votre récompense.
        Une <strong>taxe de {cityTaxPct}%</strong> est versée à la mairie de votre ville (non remboursable).
        Si personne ne livre en {CMD_LIMITS.DURATION_DAYS} jours, l'or principal vous revient.
      </p>

      {/* Item */}
      <div className="space-y-1">
        <label className="text-xs font-body text-muted-foreground">Item recherché</label>
        <select
          value={itemKey}
          onChange={e => setItemKey(e.target.value)}
          className="w-full border border-border rounded-md px-2 py-1.5 text-sm font-body bg-background"
        >
          <option value="">— Choisir un item —</option>
          <optgroup label="T1 — Ressources brutes">
            {groupedItems.t1.map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.name}</option>
            ))}
          </optgroup>
          <optgroup label="T2 — Transformations">
            {groupedItems.t2.map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.name}</option>
            ))}
          </optgroup>
          <optgroup label="T3 — Objets utiles">
            {groupedItems.t3.map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.name}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Quantité */}
      <div className="space-y-1">
        <label className="text-xs font-body text-muted-foreground">
          Quantité ({CMD_LIMITS.MIN_QUANTITY}-{CMD_LIMITS.MAX_QUANTITY})
        </label>
        <Input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min={CMD_LIMITS.MIN_QUANTITY}
          max={CMD_LIMITS.MAX_QUANTITY}
          value={quantity}
          onChange={e => setQuantity(parseInt(e.target.value) || 0)}
          onFocus={e => e.target.select()}
          className="text-sm"
        />
      </div>

      {/* Récompense */}
      <div className="space-y-1">
        <label className="text-xs font-body text-muted-foreground">
          Récompense au livreur (💰, {CMD_LIMITS.MIN_REWARD_GOLD}-{CMD_LIMITS.MAX_REWARD_GOLD})
        </label>
        <Input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min={CMD_LIMITS.MIN_REWARD_GOLD}
          max={CMD_LIMITS.MAX_REWARD_GOLD}
          value={rewardGold}
          onChange={e => setRewardGold(parseInt(e.target.value) || 0)}
          onFocus={e => e.target.select()}
          className="text-sm"
        />
        {marketHint && (
          <p className={`text-[11px] font-body ${marketHint.color}`}>
            💡 {marketHint.text}
          </p>
        )}
      </div>

      {/* Note */}
      <div className="space-y-1">
        <label className="text-xs font-body text-muted-foreground">Note (optionnelle)</label>
        <Input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Ex: Urgent pour craft T4..."
          maxLength={CMD_LIMITS.MAX_NOTE_LENGTH}
          className="text-sm font-body"
        />
      </div>

      {/* Récap coût */}
      <div className="bg-muted/50 rounded-md p-2.5 space-y-0.5 text-xs font-body">
        <div className="flex justify-between">
          <span>Récompense au livreur</span>
          <span className="font-heading">{rewardGold} 💰</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Taxe mairie ({cityTaxPct}%)</span>
          <span className="font-heading">{tax} 💰</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1 mt-1 font-heading font-bold">
          <span>Total à débourser</span>
          <span className={canAfford ? 'text-amber-700' : 'text-red-600'}>{totalCost} 💰</span>
        </div>
        <p className="text-[10px] text-muted-foreground italic mt-1">
          Votre or : {playerGold} 💰
        </p>
      </div>

      {/* Bouton */}
      <Button
        onClick={handlePost}
        disabled={posting || !itemKey || !validQty || !validReward || !canAfford}
        className="w-full font-heading"
      >
        {posting ? 'Publication...' : `📜 Poster le contrat (${totalCost} 💰)`}
      </Button>
    </div>
  );
}


// ────────────────────────────────────────────────────────────
// Composant principal
// ────────────────────────────────────────────────────────────
export default function CommandBoardPanel({ profile, onProfileUpdate }) {
  const [contracts, setContracts] = useState([]);
  const [myContracts, setMyContracts] = useState([]);
  const [marketAverages, setMarketAverages] = useState({});
  const [loading, setLoading] = useState(true);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const [postDrawerOpen, setPostDrawerOpen] = useState(false);
  const [deliveringId, setDeliveringId] = useState(null);
  // 19/05/2026 — Taxe contrat = city.tax_rate (source de vérité maire).
  // On lit la ville actuelle du joueur ; si indispo, fallback DEFAULT_TAX_PCT.
  const [cityTaxPct, setCityTaxPct] = useState(CMD_LIMITS.DEFAULT_TAX_PCT);

  const playerEmail = profile?.user_email || '';
  const playerProfession = profile?.profession || '';
  const playerCityId = profile?.city_id || '';

  // Charger le tax_rate de la ville actuelle
  useEffect(() => {
    if (!playerCityId) {
      setCityTaxPct(CMD_LIMITS.DEFAULT_TAX_PCT);
      return;
    }
    let cancelled = false;
    base44.entities.City.get(playerCityId)
      .then(city => {
        if (cancelled) return;
        // 19/05/2026 — Mirror serveur : on respecte tax_rate=0 (volonté maire).
        // Le fallback DEFAULT_TAX_PCT n'est appliqué QUE si tax_rate est absent.
        const raw = city?.tax_rate;
        const isUndef = raw === null || raw === undefined || raw === '';
        const pct = Number(raw);
        setCityTaxPct(isUndef || !isFinite(pct) ? CMD_LIMITS.DEFAULT_TAX_PCT : pct);
      })
      .catch(() => {
        if (!cancelled) setCityTaxPct(CMD_LIMITS.DEFAULT_TAX_PCT);
      });
    return () => { cancelled = true; };
  }, [playerCityId]);

  const load = useCallback(async () => {
    if (!playerEmail) return;
    setLoading(true);
    try {
      const [active, mine, avgs] = await Promise.all([
        fetchActiveContracts(),
        fetchMyContracts(playerEmail),
        fetchMarketAverages7d(),
      ]);
      setContracts(active);
      setMyContracts(mine);
      setMarketAverages(avgs);
    } catch (err) {
      console.warn('[CommandBoard] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [playerEmail]);

  useEffect(() => { load(); }, [load]);

  // Compteur de contrats actifs du joueur (pour la limite)
  const myActiveCount = useMemo(
    () => myContracts.filter(c => c.status === 'active').length,
    [myContracts]
  );
  const atLimit = myActiveCount >= CMD_LIMITS.MAX_ACTIVE_PER_PLAYER;

  // Liste affichée
  const displayList = useMemo(() => {
    let list;
    if (showMineOnly) {
      list = myContracts;
    } else {
      // Tous les actifs, triés par pertinence pour la profession du joueur
      list = [...contracts].sort((a, b) =>
        scoreContractForPlayer(b, playerProfession) - scoreContractForPlayer(a, playerProfession)
      );
    }
    return list;
  }, [contracts, myContracts, showMineOnly, playerProfession]);

  const handleDeliver = async (contract) => {
    if (deliveringId) return;
    setDeliveringId(contract.id);
    try {
      const res = await deliverContract(contract.id);
      toast.success(`📦 Livraison réussie ! +${res.gold_received} 💰`);
      // Refresh profile (or + inventaire ont changé côté serveur)
      if (typeof onProfileUpdate === 'function') {
        await onProfileUpdate();
      }
      await load();
    } catch (err) {
      toast.error(err.message || 'Erreur à la livraison.');
      // En cas d'erreur, on recharge quand même (peut-être stale)
      await load();
    } finally {
      setDeliveringId(null);
    }
  };

  const handlePosted = async () => {
    if (typeof onProfileUpdate === 'function') {
      await onProfileUpdate();
    }
    await load();
  };

  return (
    <div className="space-y-3">
      {/* Header + actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-body cursor-pointer">
            <input
              type="checkbox"
              checked={showMineOnly}
              onChange={e => setShowMineOnly(e.target.checked)}
              className="rounded"
            />
            <span>Mes contrats ({myContracts.length})</span>
          </label>
        </div>
        <Button
          size="sm"
          onClick={() => setPostDrawerOpen(true)}
          disabled={atLimit}
          className="h-8 px-3 text-xs font-heading"
        >
          📜 Poser un contrat
        </Button>
      </div>

      {atLimit && !showMineOnly && (
        <p className="text-[11px] text-orange-600 font-body italic">
          ⚠️ Limite atteinte : {CMD_LIMITS.MAX_ACTIVE_PER_PLAYER} contrats actifs maximum. Attendez livraison ou expiration.
        </p>
      )}

      {/* Liste */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base flex items-center justify-between">
            <span>
              {showMineOnly ? '📜 Mes contrats' : '🤝 Contrats du royaume'}
            </span>
            {!loading && (
              <Badge variant="outline" className="font-body text-[10px]">
                {displayList.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : displayList.length === 0 ? (
            <p className="text-sm text-muted-foreground font-body text-center py-6">
              {showMineOnly
                ? "Vous n'avez aucun contrat. Posez-en un pour faire travailler le royaume."
                : "Aucun contrat actif dans le royaume. Soyez le premier !"}
            </p>
          ) : (
            <div className="space-y-2">
              {displayList.map(c => (
                <ContractCard
                  key={c.id}
                  contract={c}
                  profile={profile}
                  onDeliver={handleDeliver}
                  isDelivering={deliveringId === c.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer formulaire de pose */}
      <Drawer open={postDrawerOpen} onOpenChange={setPostDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="font-heading text-base">
              📜 Poser un contrat
              <span className="text-xs text-muted-foreground font-body ml-2">
                ({myActiveCount}/{CMD_LIMITS.MAX_ACTIVE_PER_PLAYER} actifs)
              </span>
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            <PostContractForm
              profile={profile}
              marketAverages={marketAverages}
              cityTaxPct={cityTaxPct}
              onPosted={handlePosted}
              onClose={() => setPostDrawerOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
