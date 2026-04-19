const WAREHOUSE_T1 = [
  { key: "bois_brut",   name: "Bois brut",      icon: "🪵" },
  { key: "pierre",      name: "Pierre",          icon: "🪨" },
  { key: "minerai_fer", name: "Minerai de fer",  icon: "⚙️" },
  { key: "ble",         name: "Blé",             icon: "🌾" },
  { key: "laine_brute", name: "Laine brute",     icon: "🐑" },
  { key: "herbes",      name: "Herbes",          icon: "🌿" },
  { key: "quartz_brut", name: "Quartz brut",     icon: "🔮" },
];

export default function WarehouseDepositPanel({ 
  profile, 
  isHomeCity, 
  contributing, 
  onDeposit 
}) {
  if (!isHomeCity) {
    return (
      <p className="text-xs text-amber-600 font-body bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        🏠 Vous ne pouvez déposer que dans l'entrepôt de votre ville d'origine.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {[...WAREHOUSE_T1, { key: "or", name: "Or", icon: "💰" }].map(item => {
        const isGold = item.key === "or";
        const playerStock = isGold
          ? (profile.gold || 0)
          : ((profile.inventory || []).find(i => i.item_key === item.key)?.quantity || 0);

        return (
          <button
            key={item.key}
            onClick={() => onDeposit(item.key)}
            disabled={contributing || playerStock <= 0}
            className="flex flex-col items-center gap-1 p-2 rounded-lg border border-border bg-card hover:bg-muted/50 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            <span className="text-3xl">{item.icon}</span>
            <span className="text-xs font-body font-semibold">{playerStock}</span>
            <span className="text-xs text-muted-foreground font-body text-center">{item.name}</span>
          </button>
        );
      })}
    </div>
  );
}