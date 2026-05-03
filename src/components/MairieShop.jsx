import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { logGold } from "@/lib/goldLog";
import { toast } from "sonner";

function getPriceMultiplier(orMoyen) {
  if (!orMoyen || orMoyen < 200) return 0.8;
  if (orMoyen < 500)  return 1.0;
  if (orMoyen < 1000) return 1.2;
  if (orMoyen < 2000) return 1.5;
  return 2.0;
}

// Liste des T1 en dur avec leurs prix max conseillés : source de vérité indépendante de la DB
const T1_ITEMS_MAIRIE = [
  { key: "bois_brut",    name: "Bois brut",      icon: "🪵", category: "bois",       basePrice: 6 },
  { key: "pierre",       name: "Pierre",          icon: "🧱", category: "pierre",     basePrice: 6 },
  { key: "minerai_fer",  name: "Minerai de fer",  icon: "⚙️",  category: "fer",        basePrice: 6 },
  { key: "ble",          name: "Blé",             icon: "🌾", category: "nourriture", basePrice: 3 },
  { key: "laine_brute",  name: "Laine brute",     icon: "🧶", category: "tissu",      basePrice: 6 },
  { key: "herbes",       name: "Herbes",          icon: "🌿", category: "potions",    basePrice: 3 },
  { key: "quartz_brut",  name: "Quartz brut",     icon: "🔮", category: "bijoux",     basePrice: 6 },
  { key: "autorisation_marche", name: "Autorisation de marché", icon: "📜", category: "parchemins", basePrice: 5 },
];

export default function MairieShop({ profile, city, onRefresh }) {
  const [unavailableItems, setUnavailableItems] = useState([]);
  const [buying, setBuying] = useState(null);
  const [loading, setLoading] = useState(true);
  const [priceMultiplier, setPriceMultiplier] = useState(1.0);

  useEffect(() => {
    base44.entities.EconomySettings.filter({ setting_key: "global" }).then(res => {
      if (res.length > 0) setPriceMultiplier(getPriceMultiplier(res[0].or_moyen_par_joueur || 0));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    async function checkMarkets() {
      setLoading(true);
      const listings = await base44.entities.MarketListing.filter({ status: "active" });
      const unavailable = T1_ITEMS_MAIRIE.filter(item => {
        return !listings.some(l =>
          (l.quantity || 0) > 0 &&
          (l.item_key === item.key || l.item_name === item.name)
        );
      });
      setUnavailableItems(unavailable);
      setLoading(false);
    }
    checkMarkets();
    
    // Subscribe to real-time market changes
    const unsubscribe = base44.entities.MarketListing.subscribe(() => {
      checkMarkets();
    });
    
    return () => unsubscribe();
  }, [])


  const handleBuy = async (item) => {
    const finalPrice = Math.round(item.basePrice * priceMultiplier);
    if ((profile.gold || 0) < finalPrice) {
      toast.error(`Pas assez d'or ! Il vous faut ${finalPrice} 💰.`);
      return;
    }
    setBuying(item.key);

    const newInventory = [...(profile.inventory || [])];
    const existing = newInventory.find(i => i.item_key === item.key);
    if (existing) {
      existing.quantity += 1;
    } else {
      newInventory.push({ item_key: item.key, item_name: item.name, item_category: item.category, quantity: 1 });
    }

    await base44.entities.PlayerProfile.update(profile.id, {
      gold: (profile.gold || 0) - finalPrice,
      inventory: newInventory,
    });

    await base44.entities.City.update(city.id, {
      gold_treasury: (city.gold_treasury || 0) + finalPrice,
      treasury_cumulative: (city.treasury_cumulative || 0) + finalPrice,
    });

    await logGold({
      profile, city,
      amount: -finalPrice, type: "achat",
      description: `Achat mairie : 1× ${item.name} (indisponible sur le marché)`,
    });

    toast.success(`✅ Acheté 1× ${item.icon} ${item.name} pour ${finalPrice} 💰`);
    setBuying(null);
    onRefresh?.();
  };

  if (loading) return (
    <div className="text-xs text-muted-foreground font-body italic">Vérification des marchés...</div>
  );

  if (unavailableItems.length === 0) return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm font-body text-emerald-900 italic">
      🎶 Oyez, oyez ! Le ménestrel a parcouru chaque échoppe du royaume et n'a point trouvé marchandise en souffrance. Toutes les denrées circulent librement de ville en ville : la mairie referme ses coffres et repose ses charretiers. Revenez si la disette s'annonce !
    </div>
  );

  // Items disponibles sur le marché (non affichés dans l'urgence)
  const availableItems = T1_ITEMS_MAIRIE.filter(item => !unavailableItems.find(u => u.key === item.key));

  return (
    <div className="space-y-3">
      {availableItems.length > 0 && (
        <div className="bg-muted/40 border border-border rounded-lg px-4 py-3 text-xs font-body text-muted-foreground italic">
          🎶 <em>Le ménestrel chuchote :</em> «{availableItems.map(i => i.icon + " " + i.name).join(", ")} ont été aperçu{availableItems.length > 1 ? "s" : "e"} sur les marchés du royaume : la mairie n'en point besoin de les proposer. Si vous n'en trouvez pas, regardez mieux, un marchand les a peut-être cachés dans sa besace !»
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {unavailableItems.map(item => {
          const finalPrice = Math.round(item.basePrice * priceMultiplier);
          const canAfford = (profile.gold || 0) >= finalPrice;
          return (
            <div key={item.key} className="border border-border rounded-lg p-3 text-center space-y-2 bg-muted/20">
              <div className="text-2xl">{item.icon}</div>
              <div className="font-body text-xs font-semibold">{item.name}</div>
              <div className="text-xs text-muted-foreground font-body">{finalPrice} 💰</div>
              <Button
                size="sm"
                className="w-full h-7 text-xs font-heading"
                variant={canAfford ? "default" : "outline"}
                disabled={!canAfford || buying === item.key}
                onClick={() => handleBuy(item)}
              >
                {buying === item.key ? "..." : canAfford ? "Acheter ×1" : "Pas assez d'or"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}