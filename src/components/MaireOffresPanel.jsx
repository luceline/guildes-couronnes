import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const T1_ITEMS = [
  { key: "bois_brut",   name: "Bois brut",      icon: "🪵" },
  { key: "pierre",      name: "Pierre",         icon: "🪨" },
  { key: "minerai_fer", name: "Minerai de fer", icon: "⚙️" },
  { key: "ble",         name: "Blé",            icon: "🌾" },
  { key: "laine_brute", name: "Laine brute",    icon: "🧶" },
  { key: "herbes",      name: "Herbes",         icon: "🌿" },
  { key: "quartz_brut", name: "Quartz brut",    icon: "🔮" },
];

// 14/05/2026 — Items T3 (meuble, lingots_fer, tissu, pain, potion_soin) masqués
// temporairement dans le panneau mairie. Le rachat T3 est désactivé côté UI.
// Les items restent dans le code et peuvent être réactivés en retirant le `.filter`
// ci-dessous ; en attendant, les offres T3 déjà posées en BDD sont inertes
// (inaccessibles via l'UI mais ne plantent rien).
const T2T3_ITEMS_ALL = [
  { key: "planches",    name: "Planches",       icon: "🪵", tier: 2 },
  { key: "pierre_brute",name: "Pierre taillée",   icon: "🗿", tier: 2 },
  { key: "fil",         name: "Fil",            icon: "🧵", tier: 2 },
  { key: "charbon",     name: "Charbon",        icon: "⚫", tier: 2 },
  { key: "extrait",     name: "Extrait",        icon: "🫗", tier: 2 },
  { key: "quartz_poli", name: "Quartz poli",    icon: "💠", tier: 2 },
  { key: "encre",       name: "Encre",          icon: "🖋️", tier: 2 },
  { key: "farine",      name: "Farine",         icon: "🧺", tier: 2 },
  { key: "meuble",      name: "Meuble",         icon: "🪑", tier: 3 },
  { key: "lingots_fer", name: "Lingots de fer", icon: "🔩", tier: 3 },
  { key: "tissu",       name: "Tissu",          icon: "🧶", tier: 3 },
  { key: "pain",        name: "Pain",           icon: "🍞", tier: 3 },
  { key: "potion_soin", name: "Potion soin",    icon: "🧪", tier: 3 },
];
const T2T3_ITEMS = T2T3_ITEMS_ALL.filter(it => it.tier !== 3);

export default function MaireOffresPanel({ city, onRefresh }) {
  const offers_t1 = city.rachat_t1_offers || {};
  const offers_t2t3 = city.rachat_t2t3_offers || {};

  // 14/05/2026 — Tabs T1 / T2 pour densifier le panneau mairie.
  // Avant : T1 et T2 s'affichaient l'un en dessous de l'autre, long à scroller.
  // Désormais 1 seul panneau visible à la fois, switch via les boutons en haut.
  // T3 reste masqué (cf. T2T3_ITEMS_ALL filtré plus haut) — pour le réactiver,
  // retirer le `.filter` ET ajouter un onglet `t3` à la liste TABS ci-dessous.
  const [activeTab, setActiveTab] = useState("t1");
  const TABS = [
    { value: "t1", label: "📦 T1 - Brutes" },
    { value: "t2", label: "🏭 T2 - Travaillées" },
  ];

  return (
    <div className="space-y-3">
      {/* ── Sélecteur d'onglet T1 / T2 ── */}
      <div className="flex gap-2">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`text-xs px-3 py-1.5 rounded-full font-body border transition-colors ${
              activeTab === tab.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted border-border hover:border-primary/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Offres d'achat T1 ── */}
      {activeTab === "t1" && (
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-body text-amber-900 font-semibold">📦 Offres d'achat T1 :</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={!!city.warehouse_rachat_enabled}
              onChange={async (e) => {
                await base44.entities.City.update(city.id, { warehouse_rachat_enabled: e.target.checked });
                toast.success(e.target.checked ? "📦 Rachat T1 activé !" : "📦 Rachat T1 désactivé.");
                onRefresh?.();
              }} className="w-4 h-4" />
            <span className="text-xs font-body text-amber-900">{city.warehouse_rachat_enabled ? "Activé" : "Désactivé"}</span>
          </label>
        </div>
        {city.warehouse_rachat_enabled && (
          <div className="space-y-1.5">
            <p className="text-xs font-body text-amber-700">Fixez le prix et la quantité max par item.</p>
            {T1_ITEMS.map(item => {
              const offer = offers_t1[item.key] || { price: 0, qty_max: 0 };
              const bought = (city.rachat_t1_bought_today || {})[item.key] || 0;
              return (
                <div key={item.key} className="flex items-center gap-2 text-xs font-body">
                  <span className="w-5 text-center">{item.icon}</span>
                  <span className="w-24 font-semibold text-amber-900">{item.name}</span>
                  <span className="text-amber-700">Prix:</span>
                  <Input type="number"
                       inputMode="numeric"
                       pattern="[0-9]*" min={0} max={99} step={1}
                    key={`t1-price-${item.key}-${city.id}`}
                    defaultValue={offer.price || 0}
                    className="w-14 h-6 text-xs text-center"
                    onBlur={async (e) => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      const fresh = await base44.entities.City.get(city.id).catch(() => city);
                      const current = fresh.rachat_t1_offers || {};
                      const newOffers = { ...current, [item.key]: { ...(current[item.key] || {}), price: val } };
                      await base44.entities.City.update(city.id, { rachat_t1_offers: newOffers });
                      onRefresh?.();
                    }}
                    onFocus={e => e.target.select()} />
                  <span className="text-amber-700">💰 · Qté:</span>
                  <Input type="number"
                       inputMode="numeric"
                       pattern="[0-9]*" min={0} max={9999} step={10}
                    key={`t1-qty-${item.key}-${city.id}`}
                    defaultValue={offer.qty_max || 0}
                    className="w-16 h-6 text-xs text-center"
                    onBlur={async (e) => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      const fresh = await base44.entities.City.get(city.id).catch(() => city);
                      const current = fresh.rachat_t1_offers || {};
                      const newOffers = { ...current, [item.key]: { ...(current[item.key] || {}), qty_max: val } };
                      await base44.entities.City.update(city.id, { rachat_t1_offers: newOffers });
                      onRefresh?.();
                    }}
                    onFocus={e => e.target.select()} />
                  {offer.qty_max > 0 && <span className="text-amber-500">{bought}/{offer.qty_max}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* ── Offres d'achat T2 ── */}
      {activeTab === "t2" && (
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 space-y-2">
        <p className="text-xs font-body text-indigo-900 font-semibold">🏭 Offres d'achat T2 :</p>
        <p className="text-xs font-body text-indigo-700">Fixez le prix et la quantité max que la ville veut acheter.</p>
        <div className="space-y-1.5">
          {T2T3_ITEMS.map(item => {
            const offer = offers_t2t3[item.key] || { price: 0, qty_max: 0 };
            const bought = (city.rachat_t2t3_bought_today || {})[item.key] || 0;
            return (
              <div key={item.key} className="flex items-center gap-2 text-xs font-body">
                <span className="w-5 text-center">{item.icon}</span>
                <span className="w-24 font-semibold text-indigo-900">{item.name}</span>
                <span className="text-indigo-500 w-8">T{item.tier}</span>
                <span className="text-indigo-700">Prix:</span>
                <Input type="number"
                       inputMode="numeric"
                       pattern="[0-9]*" min={0} max={999} step={1}
                  key={`t23-price-${item.key}-${city.id}`}
                  defaultValue={offer.price || 0}
                  className="w-16 h-6 text-xs text-center"
                  onBlur={async (e) => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    const fresh = await base44.entities.City.get(city.id).catch(() => city);
                    const current = fresh.rachat_t2t3_offers || {};
                    const newOffers = { ...current, [item.key]: { ...(current[item.key] || {}), price: val } };
                    await base44.entities.City.update(city.id, { rachat_t2t3_offers: newOffers });
                    onRefresh?.();
                  }}
                  onFocus={e => e.target.select()} />
                <span className="text-indigo-700">💰 · Qté:</span>
                <Input type="number"
                       inputMode="numeric"
                       pattern="[0-9]*" min={0} max={999} step={1}
                  key={`t23-qty-${item.key}-${city.id}`}
                  defaultValue={offer.qty_max || 0}
                  className="w-16 h-6 text-xs text-center"
                  onBlur={async (e) => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    const fresh = await base44.entities.City.get(city.id).catch(() => city);
                    const current = fresh.rachat_t2t3_offers || {};
                    const newOffers = { ...current, [item.key]: { ...(current[item.key] || {}), qty_max: val } };
                    await base44.entities.City.update(city.id, { rachat_t2t3_offers: newOffers });
                    onRefresh?.();
                  }}
                  onFocus={e => e.target.select()} />
                {offer.qty_max > 0 && <span className="text-indigo-500">{bought}/{offer.qty_max} achetés</span>}
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}