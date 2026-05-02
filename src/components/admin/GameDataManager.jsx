import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Edit2, Save, X, Plus, Trash2, RefreshCw } from "lucide-react";

// ── Éditeur inline d'une ligne ──
function EditableRow({ record, fields, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(record);

  const handleSave = async () => {
    await onSave(record.id, draft);
    setEditing(false);
    toast.success("Sauvegardé ✓");
  };

  if (!editing) {
    return (
      <tr className="border-b border-border hover:bg-muted/30 text-sm">
        {fields.map(f => (
          <td key={f.key} className="px-3 py-2 max-w-[200px] truncate" title={String(record[f.key] ?? "")}>
            {f.key === "is_active" ? (
              <Badge variant={record[f.key] ? "default" : "secondary"}>{record[f.key] ? "Actif" : "Inactif"}</Badge>
            ) : f.key === "tier" ? (
              <Badge variant="outline">T{record[f.key]}</Badge>
            ) : (
              <span>{record[f.key] !== undefined ? String(record[f.key]) : "-"}</span>
            )}
          </td>
        ))}
        <td className="px-2 py-2 flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => { setDraft({...record}); setEditing(true); }}><Edit2 className="w-3 h-3"/></Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(record.id)}><Trash2 className="w-3 h-3"/></Button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-primary/30 bg-primary/5 text-sm">
      {fields.map(f => (
        <td key={f.key} className="px-2 py-1">
          {f.key === "is_active" ? (
            <input type="checkbox" checked={!!draft[f.key]} onChange={e => setDraft({...draft, [f.key]: e.target.checked})} className="w-4 h-4"/>
          ) : f.type === "number" ? (
            <Input className="h-7 text-xs w-20" type="number" value={draft[f.key] ?? ""} onChange={e => setDraft({...draft, [f.key]: Number(e.target.value)})}/>
          ) : (
            <Input className="h-7 text-xs min-w-[80px]" value={draft[f.key] ?? ""} onChange={e => setDraft({...draft, [f.key]: e.target.value})}/>
          )}
        </td>
      ))}
      <td className="px-2 py-1 flex gap-1">
        <Button size="sm" onClick={handleSave}><Save className="w-3 h-3"/></Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="w-3 h-3"/></Button>
      </td>
    </tr>
  );
}

// ── Table générique avec filtre ──
function DataTable({ entity, fields, filter = "" }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState({});

  const load = async () => {
    setLoading(true);
    const res = await base44.entities[entity].list("-created_date", 200);
    setData(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, [entity]);

  const filtered = data.filter(r => {
    const s = (search || filter).toLowerCase();
    return !s || fields.some(f => String(r[f.key] ?? "").toLowerCase().includes(s));
  });

  const handleSave = async (id, draft) => {
    await base44.entities[entity].update(id, draft);
    setData(prev => prev.map(r => r.id === id ? { ...r, ...draft } : r));
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer ?")) return;
    await base44.entities[entity].delete(id);
    setData(prev => prev.filter(r => r.id !== id));
    toast.success("Supprimé");
  };

  const handleAdd = async () => {
    const created = await base44.entities[entity].create({ ...newRow, is_active: true });
    setData(prev => [created, ...prev]);
    setNewRow({});
    setShowAdd(false);
    toast.success("Créé ✓");
  };

  if (loading) return <div className="p-4 text-muted-foreground text-sm">Chargement...</div>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-muted-foreground"/>
          <Input className="pl-7 h-8 text-sm" placeholder="Filtrer..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <Badge variant="outline">{filtered.length} / {data.length}</Badge>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3 h-3"/></Button>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}><Plus className="w-3 h-3 mr-1"/>Nouveau</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60">
            <tr>
              {fields.map(f => <th key={f.key} className="px-3 py-2 text-left font-semibold text-muted-foreground">{f.label}</th>)}
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {showAdd && (
              <tr className="border-b border-primary/30 bg-primary/10">
                {fields.map(f => (
                  <td key={f.key} className="px-2 py-1">
                    {f.type === "number" ? (
                      <Input className="h-7 text-xs w-20" type="number" placeholder={f.label} value={newRow[f.key] ?? ""} onChange={e => setNewRow({...newRow, [f.key]: Number(e.target.value)})}/>
                    ) : (
                      <Input className="h-7 text-xs min-w-[80px]" placeholder={f.label} value={newRow[f.key] ?? ""} onChange={e => setNewRow({...newRow, [f.key]: e.target.value})}/>
                    )}
                  </td>
                ))}
                <td className="px-2 py-1 flex gap-1">
                  <Button size="sm" onClick={handleAdd}><Save className="w-3 h-3"/></Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}><X className="w-3 h-3"/></Button>
                </td>
              </tr>
            )}
            {filtered.map(r => (
              <EditableRow key={r.id} record={r} fields={fields} onSave={handleSave} onDelete={handleDelete}/>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Éditeur de recette spécialisé (ingrédients JSON) ──
function RecipeEditor({ recipe, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(recipe);

  const handleSave = async () => {
    await onSave(recipe.id, draft);
    setEditing(false);
    toast.success("Recette sauvegardée ✓");
  };

  const updateInput = (idx, field, val) => {
    const inputs = [...(draft.inputs || [])];
    inputs[idx] = { ...inputs[idx], [field]: field === "quantity" ? Number(val) : val };
    setDraft({ ...draft, inputs });
  };

  const addInput = () => setDraft({ ...draft, inputs: [...(draft.inputs || []), { key: "", quantity: 1 }] });
  const removeInput = (idx) => {
    const inputs = [...(draft.inputs || [])];
    inputs.splice(idx, 1);
    setDraft({ ...draft, inputs });
  };

  if (!editing) {
    return (
      <tr className="border-b border-border hover:bg-muted/30 text-sm">
        <td className="px-3 py-2">{recipe.icon} {recipe.name}</td>
        <td className="px-3 py-2"><Badge variant="outline">{recipe.profession}</Badge></td>
        <td className="px-3 py-2"><Badge variant="outline">T{recipe.tier}</Badge></td>
        <td className="px-3 py-2">{recipe.output_key} ×{recipe.output_quantity}</td>
        <td className="px-3 py-2 text-muted-foreground text-xs">
          {(recipe.inputs || []).map(i => `${i.key}×${i.quantity}`).join(", ")}
        </td>
        <td className="px-3 py-2">{recipe.cost_gold || 0} 💰</td>
        <td className="px-3 py-2">{recipe.requires_building || "-"}</td>
        <td className="px-3 py-2">
          <Badge variant={recipe.is_active ? "default" : "secondary"}>{recipe.is_active ? "Actif" : "Inactif"}</Badge>
        </td>
        <td className="px-2 py-2 flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => { setDraft({...recipe, inputs:[...(recipe.inputs||[])]}); setEditing(true); }}><Edit2 className="w-3 h-3"/></Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(recipe.id)}><Trash2 className="w-3 h-3"/></Button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-primary/30 bg-primary/5">
      <td colSpan={9} className="px-3 py-3">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Nom</label>
            <Input className="h-7 text-xs" value={draft.name||""} onChange={e=>setDraft({...draft,name:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Icône</label>
            <Input className="h-7 text-xs" value={draft.icon||""} onChange={e=>setDraft({...draft,icon:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Output (clé item)</label>
            <Input className="h-7 text-xs" value={draft.output_key||""} onChange={e=>setDraft({...draft,output_key:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Quantité produite</label>
            <Input className="h-7 text-xs" type="number" value={draft.output_quantity||1} onChange={e=>setDraft({...draft,output_quantity:Number(e.target.value)})}/>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Coût en or (💰)</label>
            <Input className="h-7 text-xs" type="number" value={draft.cost_gold||0} onChange={e=>setDraft({...draft,cost_gold:Number(e.target.value)})}/>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Bâtiment requis</label>
            <Input className="h-7 text-xs" placeholder="ex: fonderie" value={draft.requires_building||""} onChange={e=>setDraft({...draft,requires_building:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">Tier</label>
            <Input className="h-7 text-xs" type="number" min={2} max={5} value={draft.tier||2} onChange={e=>setDraft({...draft,tier:Number(e.target.value)})}/>
          </div>
          <div className="space-y-1 flex items-end gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Actif</label>
            <input type="checkbox" checked={!!draft.is_active} onChange={e=>setDraft({...draft,is_active:e.target.checked})} className="w-4 h-4"/>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Ingrédients</span>
            <Button size="sm" variant="outline" onClick={addInput} className="h-6 text-xs"><Plus className="w-3 h-3 mr-1"/>Ajouter</Button>
          </div>
          {(draft.inputs||[]).map((ing, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input className="h-6 text-xs flex-1" placeholder="clé item (ex: bois_brut)" value={ing.key||""} onChange={e=>updateInput(idx,"key",e.target.value)}/>
              <Input className="h-6 text-xs w-20" type="number" min={1} value={ing.quantity||1} onChange={e=>updateInput(idx,"quantity",e.target.value)}/>
              <Button size="sm" variant="ghost" className="text-destructive h-6" onClick={()=>removeInput(idx)}><X className="w-3 h-3"/></Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave}><Save className="w-3 h-3 mr-1"/>Sauvegarder</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="w-3 h-3 mr-1"/>Annuler</Button>
        </div>
      </td>
    </tr>
  );
}

function RecipesTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProf, setFilterProf] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await base44.entities.CraftingRecipe.list("-created_date", 200);
    setData(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = data.filter(r => {
    const s = search.toLowerCase();
    const matchSearch = !s || r.name?.toLowerCase().includes(s) || r.output_key?.toLowerCase().includes(s);
    const matchProf = !filterProf || r.profession === filterProf;
    return matchSearch && matchProf;
  });

  const handleSave = async (id, draft) => {
    await base44.entities.CraftingRecipe.update(id, draft);
    setData(prev => prev.map(r => r.id === id ? { ...r, ...draft } : r));
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer cette recette ?")) return;
    await base44.entities.CraftingRecipe.delete(id);
    setData(prev => prev.filter(r => r.id !== id));
    toast.success("Recette supprimée");
  };

  const professions = ["Bûcheron","Mineur","Fermier","Tisserand","Forgeron","Alchimiste","Orfèvre","Marchand"];

  if (loading) return <div className="p-4 text-muted-foreground text-sm">Chargement...</div>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative">
          <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-muted-foreground"/>
          <Input className="pl-7 h-8 text-sm w-48" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant={!filterProf?"default":"outline"} onClick={()=>setFilterProf("")} className="h-7 text-xs">Tous</Button>
          {professions.map(p => (
            <Button key={p} size="sm" variant={filterProf===p?"default":"outline"} onClick={()=>setFilterProf(p)} className="h-7 text-xs">{p}</Button>
          ))}
        </div>
        <Badge variant="outline">{filtered.length}</Badge>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3 h-3"/></Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-3 py-2 text-left">Craft</th>
              <th className="px-3 py-2 text-left">Profession</th>
              <th className="px-3 py-2 text-left">Tier</th>
              <th className="px-3 py-2 text-left">Output</th>
              <th className="px-3 py-2 text-left">Ingrédients</th>
              <th className="px-3 py-2 text-left">Or</th>
              <th className="px-3 py-2 text-left">Bâtiment</th>
              <th className="px-3 py-2 text-left">Statut</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <RecipeEditor key={r.id} recipe={r} onSave={handleSave} onDelete={handleDelete}/>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Éditeur de profession (production actions JSON) ──
function ProfessionEditor({ prof, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(prof);

  const handleSave = async () => {
    await onSave(prof.id, draft);
    setEditing(false);
    toast.success("Profession sauvegardée ✓");
  };

  const updateAction = (idx, field, val) => {
    const actions = [...(draft.production_actions || [])];
    actions[idx] = { ...actions[idx], [field]: ["quantity","cooldown","cost_gold"].includes(field) ? Number(val) : val };
    setDraft({ ...draft, production_actions: actions });
  };

  if (!editing) {
    return (
      <tr className="border-b border-border hover:bg-muted/30 text-sm">
        <td className="px-3 py-2 font-semibold">{prof.icon} {prof.name}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{prof.description}</td>
        <td className="px-3 py-2">{prof.start_gold || 100} 💰</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">
          {(prof.production_actions || []).map(a => `${a.name} (×${a.quantity})`).join(", ")}
        </td>
        <td className="px-3 py-2">
          <Badge variant={prof.is_active ? "default" : "secondary"}>{prof.is_active ? "Active" : "Inactive"}</Badge>
        </td>
        <td className="px-2 py-2 flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => { setDraft({...prof}); setEditing(true); }}><Edit2 className="w-3 h-3"/></Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(prof.id)}><Trash2 className="w-3 h-3"/></Button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-primary/30 bg-primary/5">
      <td colSpan={6} className="px-3 py-3">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div><label className="text-xs font-semibold text-muted-foreground block mb-1">Nom</label>
            <Input className="h-7 text-xs" value={draft.name||""} onChange={e=>setDraft({...draft,name:e.target.value})}/></div>
          <div><label className="text-xs font-semibold text-muted-foreground block mb-1">Icône</label>
            <Input className="h-7 text-xs" value={draft.icon||""} onChange={e=>setDraft({...draft,icon:e.target.value})}/></div>
          <div><label className="text-xs font-semibold text-muted-foreground block mb-1">Or départ</label>
            <Input className="h-7 text-xs" type="number" value={draft.start_gold||100} onChange={e=>setDraft({...draft,start_gold:Number(e.target.value)})}/></div>
        </div>
        <div className="mb-3">
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Description</label>
          <Input className="h-7 text-xs" value={draft.description||""} onChange={e=>setDraft({...draft,description:e.target.value})}/>
        </div>
        <div className="space-y-2 mb-3">
          <span className="text-xs font-semibold text-muted-foreground">Actions de production T1</span>
          {(draft.production_actions||[]).map((a, idx) => (
            <div key={idx} className="grid grid-cols-5 gap-2 p-2 border border-border rounded">
              <div><label className="text-xs text-muted-foreground">Nom action</label>
                <Input className="h-6 text-xs" value={a.name||""} onChange={e=>updateAction(idx,"name",e.target.value)}/></div>
              <div><label className="text-xs text-muted-foreground">Clé output</label>
                <Input className="h-6 text-xs" value={a.output_key||""} onChange={e=>updateAction(idx,"output_key",e.target.value)}/></div>
              <div><label className="text-xs text-muted-foreground">Quantité</label>
                <Input className="h-6 text-xs" type="number" value={a.quantity||1} onChange={e=>updateAction(idx,"quantity",e.target.value)}/></div>
              <div><label className="text-xs text-muted-foreground">Cooldown (min)</label>
                <Input className="h-6 text-xs" type="number" value={a.cooldown||60} onChange={e=>updateAction(idx,"cooldown",e.target.value)}/></div>
              <div className="flex items-end">
                <Button size="sm" variant="ghost" className="text-destructive h-6" onClick={()=>{
                  const acts = [...(draft.production_actions||[])]; acts.splice(idx,1); setDraft({...draft,production_actions:acts});
                }}><X className="w-3 h-3"/></Button>
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={()=>setDraft({...draft,production_actions:[...(draft.production_actions||[]),{id:`farm_new_${Date.now()}`,name:"",output_key:"",quantity:1,cooldown:60,cost_gold:0,icon:"⚡"}]})}>
            <Plus className="w-3 h-3 mr-1"/>Ajouter action
          </Button>
        </div>
        <div className="flex gap-2 items-center mb-2">
          <label className="text-xs font-semibold text-muted-foreground">Active</label>
          <input type="checkbox" checked={!!draft.is_active} onChange={e=>setDraft({...draft,is_active:e.target.checked})} className="w-4 h-4"/>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave}><Save className="w-3 h-3 mr-1"/>Sauvegarder</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="w-3 h-3 mr-1"/>Annuler</Button>
        </div>
      </td>
    </tr>
  );
}

function ProfessionsTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await base44.entities.ProfessionDef.list();
    setData(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (id, draft) => {
    await base44.entities.ProfessionDef.update(id, draft);
    setData(prev => prev.map(r => r.id === id ? { ...r, ...draft } : r));
  };

  const handleDelete = async (id) => {
    if (!confirm("Supprimer cette profession ?")) return;
    await base44.entities.ProfessionDef.delete(id);
    setData(prev => prev.filter(r => r.id !== id));
    toast.success("Profession supprimée");
  };

  if (loading) return <div className="p-4 text-muted-foreground text-sm">Chargement...</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-3 py-2 text-left">Profession</th>
            <th className="px-3 py-2 text-left">Description</th>
            <th className="px-3 py-2 text-left">Or départ</th>
            <th className="px-3 py-2 text-left">Actions T1</th>
            <th className="px-3 py-2 text-left">Statut</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map(p => <ProfessionEditor key={p.id} prof={p} onSave={handleSave} onDelete={handleDelete}/>)}
        </tbody>
      </table>
    </div>
  );
}

export default function GameDataManager() {
  const ITEM_FIELDS = [
    { key:"icon",   label:"🎨", type:"string" },
    { key:"key",    label:"Clé",    type:"string" },
    { key:"name",   label:"Nom",    type:"string" },
    { key:"category", label:"Catégorie", type:"string" },
    { key:"tier",   label:"Tier",   type:"number" },
    { key:"market_price_suggested", label:"Prix conseillé 💰", type:"number" },
    { key:"hunger_restore",  label:"+Faim", type:"number" },
    { key:"fatigue_restore", label:"+Énergie", type:"number" },
    { key:"use",    label:"Effet",  type:"string" },
    { key:"is_active", label:"Actif", type:"boolean" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-semibold">⚙️ Gestionnaire de données jeu</h2>
          <p className="text-sm text-muted-foreground">Modifiez les items, recettes et professions en temps réel.</p>
        </div>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">📦 Items ({ITEM_FIELDS.length > 0 ? "tous" : ""})</TabsTrigger>
          <TabsTrigger value="recipes">⚗️ Recettes de craft</TabsTrigger>
          <TabsTrigger value="professions">👤 Professions</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="pt-3">
          <p className="text-xs text-muted-foreground mb-3">
            Modifiez les stats de chaque item : prix conseillé marché, effets, tier, catégorie...
          </p>
          <DataTable entity="ItemDef" fields={ITEM_FIELDS}/>
        </TabsContent>

        <TabsContent value="recipes" className="pt-3">
          <p className="text-xs text-muted-foreground mb-3">
            Modifiez les recettes de craft : ingrédients, quantités, coûts en or, bâtiment requis...
          </p>
          <RecipesTab/>
        </TabsContent>

        <TabsContent value="professions" className="pt-3">
          <p className="text-xs text-muted-foreground mb-3">
            Modifiez les professions : actions de production T1, cooldowns, quantités, items de départ...
          </p>
          <ProfessionsTab/>
        </TabsContent>
      </Tabs>
    </div>
  );
}