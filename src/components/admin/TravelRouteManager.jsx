import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ROAD_TYPES = ["royale", "forestier", "montagneux", "maritime"];

const empty = { city_from_id: "", city_to_id: "", travel_time_minutes: 30, road_type: "royale", is_maritime: false };

export default function TravelRouteManager() {
  const [routes, setRoutes] = useState([]);
  const [cities, setCities] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [r, c] = await Promise.all([
      base44.entities.TravelRoute.list(),
      base44.entities.City.list(),
    ]);
    setRoutes(r);
    setCities(c);
  }

  const cityName = (id) => cities.find(c => c.id === id)?.name || id;

  async function save() {
    if (!form.city_from_id || !form.city_to_id) { toast.error("Choisissez les deux villes."); return; }
    setSaving(true);
    if (editId) {
      await base44.entities.TravelRoute.update(editId, form);
      toast.success("Route mise à jour !");
      setEditId(null);
    } else {
      await base44.entities.TravelRoute.create(form);
      toast.success("Route créée !");
    }
    setForm(empty);
    setSaving(false);
    load();
  }

  async function del(id) {
    if (!window.confirm("Supprimer cette route ?")) return;
    await base44.entities.TravelRoute.delete(id);
    toast.success("Route supprimée.");
    load();
  }

  function startEdit(r) {
    setEditId(r.id);
    setForm({ city_from_id: r.city_from_id, city_to_id: r.city_to_id, travel_time_minutes: r.travel_time_minutes, road_type: r.road_type || "royale", is_maritime: r.is_maritime || false });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="font-heading text-lg">{editId ? "✏️ Modifier une route" : "➕ Nouvelle route"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="font-body">Ville départ</Label>
              <Select value={form.city_from_id} onValueChange={v => setForm({ ...form, city_from_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="font-body">Ville arrivée</Label>
              <Select value={form.city_to_id} onValueChange={v => setForm({ ...form, city_to_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="font-body">Temps (minutes)</Label>
              <Input type="number" min={1} value={form.travel_time_minutes} onChange={e => setForm({ ...form, travel_time_minutes: Number(e.target.value) })} />
            </div>
            <div className="space-y-1">
              <Label className="font-body">Type de route</Label>
              <Select value={form.road_type} onValueChange={v => setForm({ ...form, road_type: v, is_maritime: v === "maritime" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROAD_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="font-heading">{saving ? "..." : editId ? "Mettre à jour" : "Créer la route"}</Button>
            {editId && <Button variant="outline" onClick={() => { setEditId(null); setForm(empty); }}>Annuler</Button>}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {routes.map(r => (
          <Card key={r.id}>
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div className="font-body text-sm">
                <span className="font-semibold">{cityName(r.city_from_id)}</span>
                <span className="text-muted-foreground mx-2">→</span>
                <span className="font-semibold">{cityName(r.city_to_id)}</span>
                <Badge variant="outline" className="ml-2 text-xs">{r.road_type || "royale"}</Badge>
                {r.is_maritime && <Badge variant="secondary" className="ml-1 text-xs">⛵ maritime</Badge>}
                <span className="text-muted-foreground ml-2 text-xs">⏱️ {r.travel_time_minutes} min</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" className="text-xs" onClick={() => startEdit(r)}>Modifier</Button>
                <Button size="sm" variant="destructive" className="text-xs" onClick={() => del(r.id)}>Supprimer</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {routes.length === 0 && <p className="text-muted-foreground font-body text-sm text-center py-4">Aucune route définie.</p>}
      </div>
    </div>
  );
}