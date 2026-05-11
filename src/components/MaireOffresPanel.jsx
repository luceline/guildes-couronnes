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

const T2T3_ITEMS = [
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

export default function MaireOffresPanel({ city, onRefresh }) {
  const offers_t1 = city.rachat_t1_offers || {};
  const offers_t2t3 = city.rachat_t2t3_offers || {};

  return (
    <div className="space-y-3">
      {/* ── Offres d'achat T1 ── */}
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

      {/* ── Offres d'achat T2/T3 ── */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 space-y-2">
        <p className="text-xs font-body text-indigo-900 font-semibold">🏭 Offres d'achat T2/T3 :</p>
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
    </div>
  );
}