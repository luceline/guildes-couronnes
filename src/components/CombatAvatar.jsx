/**
 * CombatAvatar.jsx — Silhouette SVG du combattant.
 *
 * Représente le joueur de face avec 5 zones d'équipement qui s'illuminent quand un item
 * est porté. Style "papier médiéval" : contours sombres, fond crème, couleurs sobres.
 *
 * Props:
 *   - equipment : { weapon?, head_def?, torso_def?, arms_def?, legs_def? }
 *                 Chaque slot = { item_key, grade } ou absent
 *   - hp        : points de vie actuels (1..10)
 *   - maxHp     : points de vie max (10)
 *   - ko        : booléen, perso KO
 *   - onSlotClick : (slot) => void  optionnel, pour cliquer une zone
 *   - highlightSlot : slot à mettre en surbrillance (ex: hover)
 */

const GRADE_COLORS = [
  "#a8a29e", // G0 — gris (commun)
  "#84cc16", // G1 — vert
  "#0ea5e9", // G2 — bleu
  "#a855f7", // G3 — violet
  "#f59e0b", // G4 — or
  "#ef4444", // G5 — rouge écarlate
];

function gradeColor(grade) {
  return GRADE_COLORS[Math.max(0, Math.min(5, grade ?? 0))];
}

export default function CombatAvatar({
  equipment = {},
  hp = 10,
  maxHp = 10,
  ko = false,
  onSlotClick,
  highlightSlot,
}) {
  const hasWeapon = !!equipment.weapon;
  const hasHead   = !!equipment.head_def;
  const hasTorso  = !!equipment.torso_def;
  const hasArms   = !!equipment.arms_def;
  const hasLegs   = !!equipment.legs_def;

  const colWeapon = hasWeapon ? gradeColor(equipment.weapon.grade) : "#e7e5e4";
  const colHead   = hasHead   ? gradeColor(equipment.head_def.grade)   : "#e7e5e4";
  const colTorso  = hasTorso  ? gradeColor(equipment.torso_def.grade)  : "#e7e5e4";
  const colArms   = hasArms   ? gradeColor(equipment.arms_def.grade)   : "#e7e5e4";
  const colLegs   = hasLegs   ? gradeColor(equipment.legs_def.grade)   : "#e7e5e4";

  const skinColor   = "#fde7c8";   // teinte peau neutre
  const outlineCol  = "#3f2a14";   // brun foncé pour les contours
  const clothCol    = "#7a6450";   // tunique de base (sous l'armure)

  // Style commun pour les zones cliquables
  const slotStyle = (slot) => ({
    cursor: onSlotClick ? "pointer" : "default",
    filter: highlightSlot === slot ? "brightness(1.15) drop-shadow(0 0 4px #f59e0b)" : "none",
    transition: "filter 0.15s ease",
  });

  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const hpColor = hpPercent > 60 ? "#22c55e" : hpPercent > 30 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center w-full">
      {/* Barre de PV au-dessus */}
      <div className="w-full max-w-[260px] mb-2">
        <div className="flex items-center justify-between text-xs font-body mb-1">
          <span className="font-heading">❤️ PV</span>
          <span className="font-mono">{hp} / {maxHp} {ko && <span className="text-red-600 font-bold ml-1">KO</span>}</span>
        </div>
        <div className="w-full h-2 bg-stone-200 rounded-full overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${hpPercent}%`, backgroundColor: hpColor }} />
        </div>
      </div>

      <svg
        viewBox="0 0 240 380"
        className="w-full max-w-[260px]"
        style={{ background: "#fef9ed", border: "2px solid #d4b483", borderRadius: "0.5rem" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Filtre KO : grisaille si KO */}
        <defs>
          <filter id="ko-filter">
            <feColorMatrix type="saturate" values="0.2" />
          </filter>
        </defs>

        <g filter={ko ? "url(#ko-filter)" : ""}>
          {/* ── Tunique sous-armure (corps de base) ── */}
          {/* Cou */}
          <rect x="108" y="78" width="24" height="14" fill={skinColor} stroke={outlineCol} strokeWidth="1.5" />
          {/* Torse (tunique) */}
          <path d="M 80 92 L 160 92 L 168 192 L 72 192 Z" fill={clothCol} stroke={outlineCol} strokeWidth="2" />
          {/* Bras gauches (tunique) */}
          <path d="M 80 96 L 56 100 L 50 168 L 70 168 L 76 110 Z" fill={clothCol} stroke={outlineCol} strokeWidth="2" />
          {/* Bras droit (tunique) */}
          <path d="M 160 96 L 184 100 L 190 168 L 170 168 L 164 110 Z" fill={clothCol} stroke={outlineCol} strokeWidth="2" />
          {/* Mains */}
          <circle cx="60" cy="178" r="11" fill={skinColor} stroke={outlineCol} strokeWidth="1.5" />
          <circle cx="180" cy="178" r="11" fill={skinColor} stroke={outlineCol} strokeWidth="1.5" />
          {/* Jambes (pantalon) */}
          <path d="M 80 192 L 116 192 L 112 320 L 88 320 Z" fill={clothCol} stroke={outlineCol} strokeWidth="2" />
          <path d="M 124 192 L 160 192 L 152 320 L 128 320 Z" fill={clothCol} stroke={outlineCol} strokeWidth="2" />
          {/* Pieds */}
          <ellipse cx="100" cy="328" rx="16" ry="6" fill="#3f2a14" stroke={outlineCol} strokeWidth="1.5" />
          <ellipse cx="140" cy="328" rx="16" ry="6" fill="#3f2a14" stroke={outlineCol} strokeWidth="1.5" />

          {/* ── Tête ── */}
          <g
            onClick={() => onSlotClick?.("head_def")}
            style={slotStyle("head_def")}
          >
            {/* Visage */}
            <ellipse cx="120" cy="56" rx="26" ry="30" fill={skinColor} stroke={outlineCol} strokeWidth="2" />
            {/* Yeux */}
            <circle cx="111" cy="54" r="2" fill={outlineCol} />
            <circle cx="129" cy="54" r="2" fill={outlineCol} />
            {/* Bouche */}
            <path d="M 113 68 Q 120 72 127 68" fill="none" stroke={outlineCol} strokeWidth="1.5" strokeLinecap="round" />
            {/* Cheveux (toujours présents — bruns) */}
            <path d="M 96 42 Q 120 22 144 42 L 144 56 Q 132 38 120 38 Q 108 38 96 56 Z" fill="#5a3920" stroke={outlineCol} strokeWidth="1.5" />

            {/* Heaume si équipé */}
            {hasHead && (
              <>
                {/* Casque */}
                <path d="M 92 50 Q 120 18 148 50 L 148 64 Q 138 56 120 56 Q 102 56 92 64 Z"
                      fill={colHead} stroke={outlineCol} strokeWidth="2" />
                {/* Visière */}
                <rect x="100" y="58" width="40" height="6" fill={colHead} stroke={outlineCol} strokeWidth="1.5" />
                {/* Plume / décoration */}
                <path d="M 120 18 Q 116 8 124 6 Q 122 14 120 18 Z"
                      fill={colHead} stroke={outlineCol} strokeWidth="1" />
                {/* Badge grade */}
                <circle cx="155" cy="36" r="9" fill="white" stroke={outlineCol} strokeWidth="1.5" />
                <text x="155" y="40" textAnchor="middle" fontSize="11" fontWeight="bold" fill={outlineCol}>
                  {equipment.head_def.grade}
                </text>
              </>
            )}
          </g>

          {/* ── Torse (cuirasse) ── */}
          <g
            onClick={() => onSlotClick?.("torso_def")}
            style={slotStyle("torso_def")}
          >
            {hasTorso && (
              <>
                <path d="M 76 96 L 164 96 L 170 188 L 70 188 Z"
                      fill={colTorso} stroke={outlineCol} strokeWidth="2" />
                {/* Détails plastron — ligne centrale + boutons */}
                <line x1="120" y1="100" x2="120" y2="184" stroke={outlineCol} strokeWidth="1.5" />
                <circle cx="120" cy="115" r="3" fill={outlineCol} />
                <circle cx="120" cy="140" r="3" fill={outlineCol} />
                <circle cx="120" cy="165" r="3" fill={outlineCol} />
                {/* Badge grade */}
                <circle cx="160" cy="110" r="9" fill="white" stroke={outlineCol} strokeWidth="1.5" />
                <text x="160" y="114" textAnchor="middle" fontSize="11" fontWeight="bold" fill={outlineCol}>
                  {equipment.torso_def.grade}
                </text>
              </>
            )}
          </g>

          {/* ── Bras (brassards) ── */}
          <g
            onClick={() => onSlotClick?.("arms_def")}
            style={slotStyle("arms_def")}
          >
            {hasArms && (
              <>
                {/* Brassard gauche */}
                <path d="M 50 130 L 76 130 L 72 168 L 50 168 Z"
                      fill={colArms} stroke={outlineCol} strokeWidth="2" />
                {/* Brassard droit */}
                <path d="M 164 130 L 190 130 L 190 168 L 168 168 Z"
                      fill={colArms} stroke={outlineCol} strokeWidth="2" />
                {/* Rivets */}
                <circle cx="56" cy="138" r="1.5" fill={outlineCol} />
                <circle cx="68" cy="138" r="1.5" fill={outlineCol} />
                <circle cx="56" cy="160" r="1.5" fill={outlineCol} />
                <circle cx="68" cy="160" r="1.5" fill={outlineCol} />
                <circle cx="172" cy="138" r="1.5" fill={outlineCol} />
                <circle cx="184" cy="138" r="1.5" fill={outlineCol} />
                <circle cx="172" cy="160" r="1.5" fill={outlineCol} />
                <circle cx="184" cy="160" r="1.5" fill={outlineCol} />
                {/* Badge grade (côté gauche) */}
                <circle cx="38" cy="148" r="9" fill="white" stroke={outlineCol} strokeWidth="1.5" />
                <text x="38" y="152" textAnchor="middle" fontSize="11" fontWeight="bold" fill={outlineCol}>
                  {equipment.arms_def.grade}
                </text>
              </>
            )}
          </g>

          {/* ── Jambes (jambières) ── */}
          <g
            onClick={() => onSlotClick?.("legs_def")}
            style={slotStyle("legs_def")}
          >
            {hasLegs && (
              <>
                <path d="M 84 196 L 116 196 L 112 280 L 88 280 Z"
                      fill={colLegs} stroke={outlineCol} strokeWidth="2" />
                <path d="M 124 196 L 156 196 L 152 280 L 128 280 Z"
                      fill={colLegs} stroke={outlineCol} strokeWidth="2" />
                {/* Genouillères */}
                <circle cx="100" cy="240" r="6" fill={colLegs} stroke={outlineCol} strokeWidth="1.5" />
                <circle cx="140" cy="240" r="6" fill={colLegs} stroke={outlineCol} strokeWidth="1.5" />
                {/* Badge grade */}
                <circle cx="170" cy="232" r="9" fill="white" stroke={outlineCol} strokeWidth="1.5" />
                <text x="170" y="236" textAnchor="middle" fontSize="11" fontWeight="bold" fill={outlineCol}>
                  {equipment.legs_def.grade}
                </text>
              </>
            )}
          </g>

          {/* ── Arme (épée à la main droite) ── */}
          <g
            onClick={() => onSlotClick?.("weapon")}
            style={slotStyle("weapon")}
          >
            {hasWeapon && (
              <>
                {/* Pommeau */}
                <circle cx="194" cy="186" r="5" fill={colWeapon} stroke={outlineCol} strokeWidth="1.5" />
                {/* Poignée */}
                <rect x="191" y="190" width="6" height="14" fill="#5a3920" stroke={outlineCol} strokeWidth="1.5" />
                {/* Garde */}
                <rect x="180" y="204" width="28" height="4" fill={colWeapon} stroke={outlineCol} strokeWidth="1.5" />
                {/* Lame */}
                <path d="M 192 208 L 200 208 L 198 308 L 194 308 Z"
                      fill={colWeapon} stroke={outlineCol} strokeWidth="1.5" />
                {/* Badge grade */}
                <circle cx="220" cy="220" r="9" fill="white" stroke={outlineCol} strokeWidth="1.5" />
                <text x="220" y="224" textAnchor="middle" fontSize="11" fontWeight="bold" fill={outlineCol}>
                  {equipment.weapon.grade}
                </text>
              </>
            )}
          </g>

          {/* ── Indicateurs de slots vides (cercles pointillés discrets) ── */}
          {!hasHead && (
            <g style={slotStyle("head_def")} onClick={() => onSlotClick?.("head_def")}>
              <circle cx="120" cy="38" r="14" fill="none" stroke="#bdb5a3" strokeWidth="1.5" strokeDasharray="3,3" />
              <text x="120" y="34" textAnchor="middle" fontSize="14" opacity="0.5">🪖</text>
            </g>
          )}
          {!hasTorso && (
            <g style={slotStyle("torso_def")} onClick={() => onSlotClick?.("torso_def")}>
              <rect x="100" y="120" width="40" height="40" fill="none" stroke="#bdb5a3" strokeWidth="1.5" strokeDasharray="3,3" />
              <text x="120" y="148" textAnchor="middle" fontSize="20" opacity="0.5">🛡️</text>
            </g>
          )}
          {!hasArms && (
            <g style={slotStyle("arms_def")} onClick={() => onSlotClick?.("arms_def")}>
              <circle cx="60" cy="148" r="14" fill="none" stroke="#bdb5a3" strokeWidth="1.5" strokeDasharray="3,3" />
              <text x="60" y="154" textAnchor="middle" fontSize="16" opacity="0.5">🤜</text>
            </g>
          )}
          {!hasLegs && (
            <g style={slotStyle("legs_def")} onClick={() => onSlotClick?.("legs_def")}>
              <rect x="100" y="220" width="40" height="40" fill="none" stroke="#bdb5a3" strokeWidth="1.5" strokeDasharray="3,3" />
              <text x="120" y="248" textAnchor="middle" fontSize="20" opacity="0.5">🦵</text>
            </g>
          )}
          {!hasWeapon && (
            <g style={slotStyle("weapon")} onClick={() => onSlotClick?.("weapon")}>
              <circle cx="200" cy="240" r="14" fill="none" stroke="#bdb5a3" strokeWidth="1.5" strokeDasharray="3,3" />
              <text x="200" y="246" textAnchor="middle" fontSize="16" opacity="0.5">⚔️</text>
            </g>
          )}
        </g>

        {/* Étiquette KO */}
        {ko && (
          <g>
            <rect x="60" y="170" width="120" height="40" fill="rgba(220,38,38,0.9)" rx="6" />
            <text x="120" y="196" textAnchor="middle" fontSize="22" fontWeight="bold" fill="white">
              KO
            </text>
          </g>
        )}
      </svg>

      {/* Légende des grades */}
      <div className="mt-2 flex flex-wrap gap-1.5 justify-center text-[10px] font-body">
        {GRADE_COLORS.map((c, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm border border-stone-400" style={{ backgroundColor: c }} />
            <span className="text-muted-foreground">G{i}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
