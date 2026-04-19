import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ECONOMY_ZONES = ["saine", "prospere", "recession", "crise"];

export default function EconomySettingsManager() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const list = await base44.entities.EconomySettings.filter({ setting_key: "global" });
    if (list.length > 0) {
      setSettings(list[0]);
      setForm(list[0]);
    } else {
      const defaults = { setting_key: "global", economy_zone: "saine", travel_cost_multiplier: 1, tax_bonus: 0, objective_reward_multiplier: 1, mayor_cost_multiplier: 1 };
      setForm(defaults);
    }
  }

  async function save() {
    setSaving(true);
    const data = { ...form, last_updated: new Date().toISOString().split("T")[0] };
    if (settings?.id) {
      await base44.entities.EconomySettings.update(settings.id, data);
    } else {
      const created = await base44.entities.EconomySettings.create(data);
      setSettings(created);
    }
    toast.success("Paramètres économiques sauvegardés !");
    setSaving(false);
    load();
  }

  const field = (key, label, type = "number", min, max, step) => (
    <div className="space-y-1">
      <Label className="font-body">{label}</Label>
      <Input type={type} min={min} max={max} step={step || 0.1}
        value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: type === "number" ? Number(e.target.value) : e.target.value })} />
    </div>
  );

  return (
    <Card>
      <CardHeader><CardTitle className="font-heading text-lg">💹 Paramètres économiques globaux</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label className="font-body">Zone économique</Label>
          <Select value={form.economy_zone || "saine"} onValueChange={v => setForm({ ...form, economy_zone: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ECONOMY_ZONES.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {field("travel_cost_multiplier", "Multiplicateur frais voyage", "number", 0, 10, 0.1)}
          {field("tax_bonus", "Bonus impôt journalier (💰)", "number", -100, 1000, 1)}
          {field("objective_reward_multiplier", "Multiplicateur récompenses objectifs", "number", 0, 10, 0.1)}
          {field("mayor_cost_multiplier", "Multiplicateur coût maire", "number", 0, 10, 0.1)}
          {field("or_moyen_par_joueur", "Or moyen par joueur (info)", "number", 0, 999999, 1)}
        </div>
        {form.last_updated && <p className="text-xs text-muted-foreground font-body">Dernière MAJ : {form.last_updated}</p>}
        <Button onClick={save} disabled={saving} className="font-heading">
          {saving ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </CardContent>
    </Card>
  );
}