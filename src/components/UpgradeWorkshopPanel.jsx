/**
 * UpgradeWorkshopPanel — Affichage de la config tarif côté artisan
 * (Bûcheron / Mineur). Affiché dans Production "Mon atelier".
 *
 * La vue client (services d'amélioration ciblés sur un artisan précis)
 * est dans UpgradeServicePanel — affichée dans CityView "Habitants".
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  COMBAT_UPGRADE_ATK_ITEMS,
  COMBAT_UPGRADE_DEF_ITEMS,
  COMBAT_UPGRADE_PRICE_MIN,
  COMBAT_UPGRADE_PRICE_MAX,
  COMBAT_UPGRADE_ARTISAN_SHARE,
} from "../lib/gameData";
import { ITEMS } from "../lib/craftingData";

const DEFAULT_UPGRADE_PRICE = 5;

export default function UpgradeWorkshopPanel({ profile, onRefresh }) {
  const isBucheron = profile?.profession === "Bûcheron";
  const isMineur   = profile?.profession === "Mineur";
  if (!isBucheron && !isMineur) return null;

  const initialPrice = (profile.upgrade_price === undefined || profile.upgrade_price === null)
    ? DEFAULT_UPGRADE_PRICE
    : profile.upgrade_price;
  const [price, setPrice] = useState(initialPrice);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const clamped = Math.max(COMBAT_UPGRADE_PRICE_MIN, Math.min(COMBAT_UPGRADE_PRICE_MAX, parseInt(price) || 0));
    setSaving(true);
    try {
      await base44.entities.PlayerProfile.update(profile.id, { upgrade_price: clamped });
      toast.success(`Tarif d'amélioration mis à jour : ${clamped}💰`);
      setPrice(clamped);
      onRefresh?.();
    } catch {
      toast.error("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  const speciality = isBucheron ? "🪓 atk" : "⛏️ def";
  const items = isBucheron ? COMBAT_UPGRADE_ATK_ITEMS : COMBAT_UPGRADE_DEF_ITEMS;
  const itemsList = items.map(k => ITEMS[k]?.name).filter(Boolean).join(", ");
  const currentPrice = (profile.upgrade_price === undefined || profile.upgrade_price === null)
    ? DEFAULT_UPGRADE_PRICE
    : profile.upgrade_price;

  return (
    <Card className="border-amber-300 bg-amber-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-base">⚒️ Mon atelier d'amélioration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs font-body text-muted-foreground">
          En tant que <strong>{profile.profession}</strong>, votre atelier est <strong>toujours ouvert</strong> aux habitants
          de votre ville (et aux voyageurs qui s'y trouvent). Vous pouvez améliorer leurs items {speciality} : <em>{itemsList}</em>.
        </p>
        <p className="text-xs font-body text-muted-foreground">
          Les clients vous trouvent depuis l'onglet <strong>Habitants</strong> de la ville. Vous recevez <strong>{Math.round(COMBAT_UPGRADE_ARTISAN_SHARE * 100)}%</strong> du tarif,
          le reste va au trésor de la ville. Vous n'avez rien à confirmer — le service est rendu automatiquement.
        </p>
        <p className="text-xs font-body text-green-700">
          ⚒️ <strong>Pour vous-même</strong> : vos améliorations personnelles sont <strong>gratuites</strong> (vous payez juste les ressources). Cliquez sur votre propre fiche dans Habitants pour vous servir.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-body text-muted-foreground">Tarif par amélioration :</span>
          <Input
            type="number"
            min={COMBAT_UPGRADE_PRICE_MIN}
            max={COMBAT_UPGRADE_PRICE_MAX}
            value={price}
            onChange={e => setPrice(parseInt(e.target.value) || 0)}
            className="w-20 h-7 text-xs text-center"
          />
          <span className="text-xs text-muted-foreground">💰</span>
          <Button size="sm" variant="outline" className="h-7 text-xs font-heading" onClick={save} disabled={saving}>
            {saving ? "..." : "Sauvegarder"}
          </Button>
          <span className="text-xs font-body text-muted-foreground">
            (entre {COMBAT_UPGRADE_PRICE_MIN} et {COMBAT_UPGRADE_PRICE_MAX}💰)
          </span>
        </div>
        <p className="text-xs font-body text-green-700">
          ✅ Tarif actuel : <strong>{currentPrice}💰</strong> par amélioration
          {(profile.upgrade_price === undefined || profile.upgrade_price === null) && " (par défaut, à ajuster si vous le souhaitez)"}
          .
        </p>
      </CardContent>
    </Card>
  );
}
