import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BUILDING_TYPES } from "../../lib/gameData";
import { toast } from "sonner";

const FUNCTION_TYPES = [
  { key: "chat", label: "💬 Tchat taverne", desc: "Donne accès au tchat de la taverne" },
  { key: "production_bonus", label: "🌾 Bonus production", desc: "+X% de ressources récoltées" },
  { key: "crafting_bonus", label: "⚒️ Bonus fabrication", desc: "+X% de quantité fabriquée" },
  { key: "market_discount", label: "🏪 Réduction taxe marché", desc: "-X% de taxes sur les achats" },
  { key: "storage_bonus", label: "📦 Bonus stockage", desc: "+X% capacité d'inventaire" },
  { key: "travel_speed", label: "🐴 Vitesse de voyage", desc: "-X% de temps de voyage" },
  { key: "tax_reduction", label: "💰 Réduction taxes ville", desc: "-X% sur les taxes prélevées par le maire" },
];

const EMPTY = {
  key: "", name: "", icon: "🏠", description: "",
  pop_bonus: 2, cost_or: 200, cost_bois: 0, cost_pierre: 0, cost_fer: 0,
  function_type: "production_bonus", function_description: "", function_value: 10,
  is_active: true,
};

export default function BuildingTypeManager() {
  const [customBuildings, setCustomBuildings] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const buildings = await base44.entities.BuildingTypeDef.list();
    setCustomBuildings(buildings);
  }

  const handleSave = async () => {
    if (!form.key || !form.name) { toast.error("Clé et nom requis"); return; }
    setSaving(true);
    // Auto-fill function_description if empty
    const funcType = FUNCTION_TYPES.find(f => f.key === form.function_type);
    const desc = form.function_description || `${funcType?.label}: ${funcType?.desc} (×${form.function_value})`;

    if (editing) {
      await base44.entities.BuildingTypeDef.update(editing, { ...form, function_description: desc });
      toast.success("Bâtiment mis à jour !");
      setEditing(null);
    } else {
      await base44.entities.BuildingTypeDef.create({ ...form, function_description: desc });
      toast.success(`Bâtiment "${form.name}" créé !`);
    }
    setForm(EMPTY);
    await load();
    setSaving(false);
  };

  const handleEdit = (b) => {
    setEditing(b.id);
    setForm({ key: b.key, name: b.name, icon: b.icon, description: b.description || "", pop_bonus: b.pop_bonus || 2, cost_or: b.cost_or || 0, cost_bois: b.cost_bois || 0, cost_pierre: b.cost_pierre || 0, cost_fer: b.cost_fer || 0, function_type: b.function_type, function_description: b.function_description || "", function_value: b.function_value || 10, is_active: b.is_active !== false });
  };

  const handleToggle = async (b) => {
    await base44.entities.BuildingTypeDef.update(b.id, { is_active: !b.is_active });
    toast.success("Bâtiment " + (b.is_active ? "désactivé" : "activé"));
    load();
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Supprimer "${b.name}" ?`)) return;
    await base44.entities.BuildingTypeDef.delete(b.id);
    toast.success("Bâtiment supprimé.");
    load();
  };

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }));
  const funcInfo = FUNCTION_TYPES.find(ft => ft.key === form.function_type);

  return (
    <div className="space-y-6">
      {/* Static building types */}
      <Card className="bg-muted/30">
        <CardHeader><CardTitle className="font-heading text-base">🏛️ Bâtiments intégrés (lecture seule)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(BUILDING_TYPES).map(([k, b]) => (
              <div key={k} className="bg-card border border-border rounded-lg p-2 text-center">
                <div className="text-xl">{b.icon}</div>
                <div className="font-body text-xs font-semibold mt-0.5">{b.name}</div>
                <div className="text-xs text-muted-foreground">+{b.popBonus} pop</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit form */}
      <Card className="border-primary/20">
        <CardHeader><CardTitle className="font-heading text-lg">{editing ? "✏️ Modifier le bâtiment" : "➕ Créer un bâtiment personnalisé"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="font-body">Clé unique *</Label>
              <Input value={form.key} onChange={e => f("key", e.target.value)} placeholder="ex: moulin" disabled={!!editing} />
            </div>
            <div className="space-y-1">
              <Label className="font-body">Nom *</Label>
              <Input value={form.name} onChange={e => f("name", e.target.value)} placeholder="ex: Moulin à eau" />
            </div>
            <div className="space-y-1">
              <Label className="font-body">Icône (emoji)</Label>
              <Input value={form.icon} onChange={e => f("icon", e.target.value)} placeholder="⚙️" />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label className="font-body">Description</Label>
              <Textarea value={form.description} onChange={e => f("description", e.target.value)} placeholder="Description pour les joueurs..." rows={2} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="font-body">Bonus population</Label>
              <Input type="number" value={form.pop_bonus} onChange={e => f("pop_bonus", +e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="font-body">Coût en or</Label>
              <Input type="number" value={form.cost_or} onChange={e => f("cost_or", +e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="font-body">Coût en bois</Label>
              <Input type="number" value={form.cost_bois} onChange={e => f("cost_bois", +e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="font-body">Coût en pierre</Label>
              <Input type="number" value={form.cost_pierre} onChange={e => f("cost_pierre", +e.target.value)} />
            </div>
          </div>

          {/* Function */}
          <div className="bg-muted/40 rounded-lg p-4 space-y-3">
            <h4 className="font-heading font-semibold text-sm">⚙️ Fonction du bâtiment</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-body">Type de fonction</Label>
                <Select value={form.function_type} onValueChange={v => f("function_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FUNCTION_TYPES.map(ft => (
                      <SelectItem key={ft.key} value={ft.key}>{ft.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {funcInfo && <p className="text-xs text-muted-foreground font-body">{funcInfo.desc}</p>}
              </div>
              <div className="space-y-1">
                <Label className="font-body">Valeur de l'effet (%)</Label>
                <Input type="number" value={form.function_value} onChange={e => f("function_value", +e.target.value)} placeholder="10" />
                <p className="text-xs text-muted-foreground font-body">Ex: 20 = 20% de bonus/réduction</p>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="font-body">Description de l'effet (affiché aux joueurs)</Label>
                <Input value={form.function_description} onChange={e => f("function_description", e.target.value)} placeholder={`Auto: "${funcInfo?.label}: ${funcInfo?.desc}"`} />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="font-heading">
              {editing ? "Sauvegarder" : "Créer le bâtiment"}
            </Button>
            {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(EMPTY); }} className="font-body">Annuler</Button>}
          </div>
        </CardContent>
      </Card>

      {/* Custom buildings list */}
      {customBuildings.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-heading font-semibold">Bâtiments personnalisés ({customBuildings.length})</h3>
          {customBuildings.map(b => (
            <Card key={b.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{b.icon}</span>
                  <div>
                    <div className="font-body font-semibold">{b.name}</div>
                    <div className="text-xs text-muted-foreground font-body">{b.function_description || b.function_type} · +{b.pop_bonus} pop · {b.cost_or}or</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? "Actif" : "Inactif"}</Badge>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(b)} className="font-body text-xs">Modifier</Button>
                  <Button size="sm" variant="secondary" onClick={() => handleToggle(b)} className="font-body text-xs">{b.is_active ? "Désactiver" : "Activer"}</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(b)} className="font-body text-xs">Suppr.</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}