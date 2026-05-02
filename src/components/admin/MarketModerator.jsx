import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function MarketModerator() {
  const [listings, setListings] = useState([]);
  const [cities, setCities] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const [l, c] = await Promise.all([
      base44.entities.MarketListing.filter({ status: "active" }),
      base44.entities.City.list(),
    ]);
    setListings(l);
    setCities(c);
    setLoading(false);
  }

  const cityName = (id) => cities.find(c => c.id === id)?.name || id;

  async function cancel(listing) {
    if (!window.confirm(`Annuler l'annonce de ${listing.seller_name} ?`)) return;
    await base44.entities.MarketListing.update(listing.id, { status: "cancelled" });
    toast.success("Annonce annulée.");
    load();
  }

  async function cancelAll() {
    if (!window.confirm("Annuler TOUTES les annonces actives ? Irréversible.")) return;
    for (const l of listings) {
      await base44.entities.MarketListing.update(l.id, { status: "cancelled" });
    }
    toast.success(`${listings.length} annonces annulées.`);
    load();
  }

  const filtered = listings.filter(l =>
    !search || l.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.seller_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = listings.reduce((s, l) => s + (l.price_per_unit * l.quantity), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">🛒 Marché : {listings.length} annonces actives</CardTitle>
            <div className="flex items-center gap-2 text-sm font-body text-muted-foreground">
              Valeur totale : <span className="font-semibold text-foreground">{totalValue.toLocaleString()} 💰</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Rechercher item ou vendeur..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
            <Button variant="destructive" onClick={cancelAll} disabled={listings.length === 0} className="font-heading text-xs">
              Tout annuler
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground font-body">Chargement...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(l => (
            <Card key={l.id}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="font-body text-sm flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{l.item_name}</span>
                    <Badge variant="outline" className="text-xs">{l.item_category}</Badge>
                    {l.item_tier > 0 && <Badge variant="secondary" className="text-xs">T{l.item_tier}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    👤 {l.seller_name} · 🏘️ {cityName(l.city_id)} · ×{l.quantity} à {l.price_per_unit}💰/u = {l.price_per_unit * l.quantity}💰
                  </div>
                </div>
                <Button size="sm" variant="destructive" className="text-xs shrink-0" onClick={() => cancel(l)}>
                  Annuler
                </Button>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-muted-foreground font-body text-sm text-center py-4">Aucune annonce trouvée.</p>}
        </div>
      )}
    </div>
  );
}