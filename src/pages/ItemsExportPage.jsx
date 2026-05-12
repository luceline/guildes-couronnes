import { Button } from "@/components/ui/button";
import { ITEMS, CRAFTING_RECIPES, PROFESSION_PRODUCTION } from "@/lib/craftingData";
import { COMPETITIVE_ITEMS } from "@/lib/gameData";

// Récupère les inputs d'un item depuis les recettes
function getInputs(itemKey) {
  const recipe = CRAFTING_RECIPES.find(r => r.output?.key === itemKey);
  if (!recipe) return "";
  return recipe.inputs.map(i => {
    const item = ITEMS[i.key];
    return `${item?.icon || ""} ${item?.name || i.key} ×${i.quantity}`;
  }).join(" + ");
}

function getCraftedBy(itemKey) {
  const recipe = CRAFTING_RECIPES.find(r => r.output?.key === itemKey);
  return recipe?.profession || "";
}

function getCooldown(itemKey) {
  const recipe = CRAFTING_RECIPES.find(r => r.output?.key === itemKey);
  if (!recipe) return "";
  // 11/05/2026 : recipe.cooldown est en SECONDES (pas en minutes).
  // Avant : Math.floor(recipe.cooldown / 60) traitait la valeur comme des
  // minutes et la convertissait en heures → affichage 60× trop grand.
  const sec = recipe.cooldown;
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return mm === 0 ? `${h}h` : `${h}h${String(mm).padStart(2, "0")}`;
  return s === 0 ? `${m}min` : `${m}min${String(s).padStart(2, "0")}`;
}

function getCostGold(itemKey) {
  const recipe = CRAFTING_RECIPES.find(r => r.output?.key === itemKey);
  return recipe?.costGold > 0 ? `${recipe.costGold} 💰` : "";
}

function getRequiresBuilding(itemKey) {
  const recipe = CRAFTING_RECIPES.find(r => r.output?.key === itemKey);
  return recipe?.requiresBuilding || "";
}

function getT1Inputs(outputKey) {
  // T1 harvest
  for (const [prof, actions] of Object.entries(PROFESSION_PRODUCTION)) {
    for (const action of actions) {
      if (action.outputKey === outputKey) return `Action ${prof} (cooldown ${action.cooldown}min, ×${action.quantity})`;
    }
  }
  return "";
}

function escapeCsv(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export default function ItemsExportPage() {

  function buildRows() {
    const rows = [];

    for (const [key, item] of Object.entries(ITEMS)) {
      const competitive = COMPETITIVE_ITEMS[key];
      const effectInGame = competitive
        ? competitive.description
        : (item.use || "");

      const inputs = item.tier === 1
        ? getT1Inputs(key)
        : getInputs(key);

      const craftedBy = item.tier === 1
        ? (() => {
            for (const [prof, actions] of Object.entries(PROFESSION_PRODUCTION)) {
              if (actions.some(a => a.outputKey === key)) return prof;
            }
            return "";
          })()
        : getCraftedBy(key);

      rows.push({
        "Clé (item_key)": key,
        "Nom": `${item.icon} ${item.name}`,
        "Tier": item.tier,
        "Catégorie": item.category,
        "Crafteur": craftedBy,
        "Ingrédients / Production": inputs,
        "Cooldown craft": getCooldown(key),
        "Coût or": getCostGold(key),
        "Bâtiment requis": getRequiresBuilding(key),
        "Description / Use": item.use,
        "Effet en jeu": effectInGame,
        "Expire (jours)": item.expires_days || "",
      });
    }

    // Trier par tier puis par nom
    rows.sort((a, b) => {
      if (a["Tier"] !== b["Tier"]) return a["Tier"] - b["Tier"];
      return a["Nom"].localeCompare(b["Nom"]);
    });

    return rows;
  }

  function downloadCsv() {
    const rows = buildRows();
    if (rows.length === 0) return;

    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.map(escapeCsv).join(","),
      ...rows.map(row => headers.map(h => escapeCsv(row[h])).join(",")),
    ];

    const bom = "\uFEFF"; // UTF-8 BOM pour Excel
    const blob = new Blob([bom + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "items_jeu.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const rows = buildRows();

  return (
    <div className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold">📊 Export des objets</h1>
          <p className="text-muted-foreground mt-1">{rows.length} objets : ouvrir dans Excel avec l'option "UTF-8"</p>
        </div>
        <Button onClick={downloadCsv} className="text-base px-6">
          ⬇️ Télécharger CSV (Excel)
        </Button>
      </div>

      {/* Aperçu tableau */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="text-xs w-full">
          <thead className="bg-muted">
            <tr>
              {Object.keys(rows[0] || {}).map(h => (
                <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap border-b border-border">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                {Object.values(row).map((val, j) => (
                  <td key={j} className="px-3 py-1.5 border-b border-border/50 max-w-[240px] truncate" title={String(val)}>
                    {String(val)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}