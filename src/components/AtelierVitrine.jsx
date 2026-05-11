/**
 * AtelierVitrine : Permet à un joueur d'activer sa vitrine de production
 * et de fixer ses tarifs (prix par tier).
 * Affiché dans Production.jsx pour le joueur lui-même.
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AtelierVitrine({ profile, onRefresh }) {
  const vitrine = profile.atelier_vitrine || { active: false, price_t1: 2, price_t2plus: 5 };
  const [priceT1, setPriceT1]       = useState(vitrine.price_t1 ?? 2);
  const [priceT2, setPriceT2]       = useState(vitrine.price_t2plus ?? 5);
  const [saving, setSaving]         = useState(false);

  // Décomposition prix → artisan + ville (même formule que côté serveur dans
  // AtelierCommande.jsx). La ville touche min 1 or par transaction.
  const splitPrice = (price) => {
    const ville = Math.min(price, Math.max(1, Math.round(price * 0.20)));
    return { artisan: price - ville, ville };
  };
  const splitT1 = splitPrice(priceT1);
  const splitT2 = splitPrice(priceT2);

  const toggle = async () => {
    setSaving(true);
    try {
      const newVitrine = { ...vitrine, active: !vitrine.active, price_t1: priceT1, price_t2plus: priceT2 };
      await base44.entities.PlayerProfile.update(profile.id, { atelier_vitrine: newVitrine });
      toast.success(newVitrine.active
        ? "🏪 Votre atelier est ouvert : les habitants peuvent commander vos services !"
        : "Votre atelier est fermé.");
      onRefresh?.();
    } finally { setSaving(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const newVitrine = { ...vitrine, price_t1: priceT1, price_t2plus: priceT2 };
      await base44.entities.PlayerProfile.update(profile.id, { atelier_vitrine: newVitrine });
      toast.success("Tarifs mis à jour !");
      onRefresh?.();
    } finally { setSaving(false); }
  };

  return (
    <Card className={vitrine.active ? "border-amber-300 bg-amber-50/30" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-base flex items-center gap-2">
          🏪 Mon atelier
          <span className={`text-xs font-body px-2 py-0.5 rounded-full ${vitrine.active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
            {vitrine.active ? "Ouvert" : "Fermé"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground font-body">
          Ouvrez votre atelier pour que les habitants de votre ville puissent vous commander des productions.
          Ils fournissent leurs propres ingrédients, paient le service, et reçoivent les items : sans que vous soyez connecté.
          Leurs bonus de rang et buff biome s'appliquent. Vous recevez l'or directement.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-body text-muted-foreground">T1 :</span>
            <Input
              type="number"
                       inputMode="numeric"
                       pattern="[0-9]*" min={1} max={50} value={priceT1}
              onChange={e => setPriceT1(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 h-7 text-xs text-center"
              onFocus={e => e.target.select()}
            />
            <span className="text-xs text-muted-foreground">💰/action</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-body text-muted-foreground">T2+ :</span>
            <Input
              type="number"
                       inputMode="numeric"
                       pattern="[0-9]*" min={1} max={100} value={priceT2}
              onChange={e => setPriceT2(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 h-7 text-xs text-center"
              onFocus={e => e.target.select()}
            />
            <span className="text-xs text-muted-foreground">💰/action</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs font-heading" onClick={save} disabled={saving}>
            Sauvegarder
          </Button>
        </div>

        {/* ── Décomposition de chaque transaction ── */}
        <div className="bg-muted/40 border border-border rounded-md p-2.5 text-xs font-body space-y-1.5">
          <p className="font-heading font-semibold text-muted-foreground text-[11px] uppercase tracking-wide">
            Sur chaque service rendu
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-muted-foreground">T1 ({priceT1}💰) :</span>
            <span className="font-mono">vous recevez <strong className="text-emerald-700">{splitT1.artisan}💰</strong></span>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono">commission ville <strong className="text-amber-700">{splitT1.ville}💰</strong></span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-muted-foreground">T2+ ({priceT2}💰) :</span>
            <span className="font-mono">vous recevez <strong className="text-emerald-700">{splitT2.artisan}💰</strong></span>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono">commission ville <strong className="text-amber-700">{splitT2.ville}💰</strong></span>
          </div>
          <p className="text-[10px] text-muted-foreground italic pt-0.5">
            La commission ville est de 20% du prix, avec un minimum de 1 or par transaction. Elle revient à la mairie de la ville où se trouve le client.
          </p>
        </div>
        <Button
          size="sm"
          className={`font-heading ${vitrine.active ? "bg-red-500 hover:bg-red-600 text-white" : ""}`}
          variant={vitrine.active ? "default" : "outline"}
          onClick={toggle}
          disabled={saving}
        >
          {vitrine.active ? "Fermer l'atelier" : "🏪 Ouvrir l'atelier"}
        </Button>
      </CardContent>
    </Card>
  );
}