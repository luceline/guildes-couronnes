import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const T2_ITEMS = [
  { key: "planches",    name: "Planches",     icon: "🪵", tier: 2, usedBy: "Construction" },
  { key: "pierre_brute",name: "Pierre brute", icon: "🗿", tier: 2, usedBy: "Construction" },
  { key: "fil",         name: "Fil",          icon: "🧵", tier: 2, usedBy: "Bergerie" },
  { key: "charbon",     name: "Charbon",      icon: "⬛", tier: 2, usedBy: "Mine / Forge" },
  { key: "extrait",     name: "Extrait",      icon: "🫗", tier: 2, usedBy: "Laboratoire" },
  { key: "quartz_poli", name: "Quartz poli",  icon: "💠", tier: 2, usedBy: "Fonderie" },
  { key: "encre",       name: "Encre",        icon: "🖋️", tier: 2, usedBy: "Scriptorium" },
  { key: "farine",      name: "Farine",       icon: "🧺", tier: 2, usedBy: "Moulin" },
];

const T3_ITEMS = [
  { key: "meuble",         name: "Meuble",          icon: "🪑", tier: 3, usedBy: "Logement" },
  { key: "lingots_fer",    name: "Lingots de fer",  icon: "⬜", tier: 3, usedBy: "Production" },
  { key: "tissu",          name: "Tissu",           icon: "🧶", tier: 3, usedBy: "Bâtiments" },
  { key: "epee_courte",    name: "Épée courte",     icon: "🗡️", tier: 3, usedBy: "Caserne" },
  { key: "potion_soin",    name: "Potion de soin",  icon: "🧪", tier: 3, usedBy: "Hospice" },
  { key: "lingots_or",     name: "Lingot d'or",     icon: "🥇", tier: 3, usedBy: "Mairie" },
  { key: "parchemin",      name: "Parchemin",       icon: "📜", tier: 3, usedBy: "Bibliothèque" },
  { key: "contrat_artisan",name: "Contrat artisan", icon: "📋", tier: 3, usedBy: "Commerce" },
  { key: "pain",           name: "Pain",            icon: "🍞", tier: 3, usedBy: "Taverne" },
];

const ALL_CRAFTED = [...T2_ITEMS, ...T3_ITEMS];

function StockGrid({ items, warehouse, dailyMaintenance }) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
      {items.map(item => {
        const stock = warehouse[item.key] || 0;
        const dailyUse = dailyMaintenance[item.key] || 0;
        const daysLeft = dailyUse > 0 ? Math.floor(stock / dailyUse) : null;
        return (
          <div key={item.key} className={`rounded-lg border p-2 text-center ${dailyUse > 0 && stock < dailyUse * 3 ? "border-orange-300 bg-orange-50" : "border-indigo-200 bg-white"}`}>
            <div className="text-lg">{item.icon}</div>
            <div className="font-semibold font-body text-sm">{stock}</div>
            <div className="text-xs text-muted-foreground font-body">{item.name}</div>
            {dailyUse > 0 && (
              <div className={`text-xs font-body ${daysLeft !== null && daysLeft < 3 ? "text-orange-600 font-semibold" : "text-muted-foreground"}`}>
                {dailyUse}/j · {daysLeft !== null ? `${daysLeft}j` : "∞"}
              </div>
            )}
            <div className="text-xs text-indigo-500 font-body italic">{item.usedBy}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function WarehouseCraftedPanel({
  city, profile, warehouse, dailyMaintenance,
  depositAmounts, setDepositAmounts,
  contributing, setContributing,
  depositObjectives, logGold, onRefresh
}) {
  const handleDeposit = async (item, qty) => {
    if (qty <= 0) return;
    setContributing(true);
    const newWarehouse = { ...warehouse, [item.key]: (warehouse[item.key] || 0) + qty };
    const newInv = (profile.inventory || [])
      .map(i => i.item_key === item.key ? { ...i, quantity: i.quantity - qty } : i)
      .filter(i => i.quantity > 0);
    await Promise.all([
      base44.entities.City.update(city.id, { warehouse: newWarehouse }),
      base44.entities.PlayerProfile.update(profile.id, {
        inventory: newInv,
        cumul_contributions_warehouse: (profile.cumul_contributions_warehouse || 0) + qty,
      }),
    ]);

    // Validation quêtes "deposit"
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const rawDepositObjs = await base44.entities.PlayerObjective.filter({
        player_email: profile.user_email, status: "active", type: "deposit",
      });
      const activeObjs = rawDepositObjs.filter(o => o.created_date && o.created_date.startsWith(todayStr));
      for (const obj of activeObjs) {
        // Correspondance exacte sur la clé item (les quêtes deposit ont maintenant un item_key précis)
        const matches = obj.target_item === item.key || obj.target_item === "any_t2" || obj.target_item === "any_t3";
        if (!matches) continue;
        if (obj.target_city_id && obj.target_city_id !== city.id) continue;
        const newQty = (obj.current_quantity || 0) + qty;
        const done = newQty >= obj.target_quantity;
        await base44.entities.PlayerObjective.update(obj.id, {
          current_quantity: newQty, status: done ? "completed" : "active",
        });
        if (done) {
          const freshP = await base44.entities.PlayerProfile.get(profile.id).catch(() => null);
          const currentGold = freshP ? (freshP.gold || 0) : (profile.gold || 0);
          const wcpReward = obj.reward_gold || 5;
          await base44.entities.PlayerProfile.update(profile.id, { gold: currentGold + wcpReward });
          await logGold(profile.user_email, profile.character_name || "", city.id, city.name || "",
            wcpReward, "objectif", `Quête accomplie : ${obj.title}`);
          toast.success(`🎉 Quête accomplie : "${obj.title}" ! +${wcpReward}💰`);
        }
      }
    } catch(e) { console.warn("deposit quest check:", e); }

    toast.success(`📦 ${qty}× ${item.name} déposé(s) dans l'entrepôt artisanal !`);
    setContributing(false);
    onRefresh?.();
  };

  return (
    <div className="border border-indigo-200 rounded-lg p-3 space-y-3 bg-indigo-50/50">
      <h4 className="font-heading font-semibold text-sm text-indigo-900">🏭 Entrepôt artisanal (T2/T3)</h4>
      <p className="text-xs text-muted-foreground font-body">Ces ressources craftées sont consommées pour l'entretien des bâtiments.</p>

      {depositObjectives.filter(obj => !obj.target_city_id || obj.target_city_id === city.id).length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-2 space-y-1">
          <p className="text-xs font-heading font-semibold text-amber-900">🎯 Quêtes en cours :</p>
          {depositObjectives.filter(obj => !obj.target_city_id || obj.target_city_id === city.id).map(obj => (
            <div key={obj.id} className="flex items-center justify-between text-xs font-body text-amber-800">
              <span>{obj.title} — {obj.target_item} ({obj.current_quantity || 0}/{obj.target_quantity})</span>
              <span className="font-semibold">+{obj.reward_gold}💰</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-body font-semibold text-indigo-700">T2 — Entretien courant</p>
        <StockGrid items={T2_ITEMS} warehouse={warehouse} dailyMaintenance={dailyMaintenance} />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-body font-semibold text-indigo-700">T3 — Entretien palier 5</p>
        <StockGrid items={T3_ITEMS} warehouse={warehouse} dailyMaintenance={dailyMaintenance} />
      </div>

      <div className="border-t border-indigo-200 pt-2 space-y-2">
        <p className="text-xs font-heading font-semibold text-indigo-800">Déposer des crafts</p>
        {ALL_CRAFTED.map(item => {
          const playerQty = (profile.inventory || []).find(i => i.item_key === item.key)?.quantity || 0;
          if (playerQty === 0) return null;
          const amount = depositAmounts[item.key] ?? 1;
          const matchingQuest = depositObjectives.find(obj =>
            obj.target_item === item.key && (!obj.target_city_id || obj.target_city_id === city.id)
          );
          return (
            <div key={item.key} className={`flex items-center gap-3 rounded-lg px-3 py-1.5 ${matchingQuest ? "bg-amber-50 border border-amber-200" : "bg-white"}`}>
              <button 
                type="button"
                className="text-base w-8 h-8 flex items-center justify-center cursor-pointer hover:opacity-70 active:scale-90 transition-opacity rounded"
                onClick={() => setDepositAmounts(prev => ({ ...prev, [item.key]: Math.min(playerQty, (prev[item.key] ?? 1) + 1) }))}
                title="Cliquer pour ajouter +1"
              >
                {item.icon}
              </button>
              <div className="flex flex-col w-28">
                <span className="text-sm font-body font-semibold">{item.name}</span>
                {matchingQuest && (
                  <span className="text-xs text-amber-700 font-body">
                    🎯 {matchingQuest.current_quantity || 0}/{matchingQuest.target_quantity}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground font-body w-16">Inv: {playerQty}</span>
              <input type="number" min={1} max={playerQty} value={Math.min(amount, playerQty)}
                onChange={e => setDepositAmounts(prev => ({ ...prev, [item.key]: Math.max(1, Math.min(playerQty, Number(e.target.value))) }))}
                className="w-16 h-7 text-xs text-center border border-indigo-200 rounded font-body" />
              <button
                disabled={contributing || playerQty <= 0}
                onClick={() => handleDeposit(item, Math.min(amount, playerQty))}
                className={`text-xs font-body px-2 py-1 rounded transition-colors disabled:opacity-50 ${matchingQuest ? "bg-amber-400 hover:bg-amber-500 border border-amber-500 text-amber-900 font-semibold" : "bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 text-indigo-800"}`}
              >{matchingQuest ? "🎯 Déposer" : "Déposer"}</button>
            </div>
          );
        })}
        {ALL_CRAFTED.every(item => !(profile.inventory || []).find(i => i.item_key === item.key)?.quantity) && (
          <p className="text-xs text-muted-foreground font-body italic">Craftez des T2/T3 pour les déposer ici.</p>
        )}
      </div>
    </div>
  );
}