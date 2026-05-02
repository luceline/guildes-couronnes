/**
 * src/components/combat/KnightSprite.jsx
 *
 * Personnage joueur en SVG, équipé dynamiquement selon profile.equipment.
 * Couches indépendantes : épée, heaume, cuirasse, brassards, jambières.
 * Couleur de chaque pièce dépend de son grade (G0=gris terne → G5=or éclatant).
 *
 * Props :
 *   - profile : objet PlayerProfile (lecture de profile.equipment.{slot}.grade)
 *   - size    : largeur cible en px (défaut 80)
 *   - className : classes CSS additionnelles (utilisé pour anim "attacking")
 */

const GRADE_COLORS = [
  { fill: "#9b9994", stroke: "#5f5e5a", glow: 0 },     // G0 gris terne
  { fill: "#a87148", stroke: "#6f4628", glow: 0 },     // G1 bronze
  { fill: "#c89a5d", stroke: "#7c5e36", glow: 0 },     // G2 cuivre
  { fill: "#c0c4cc", stroke: "#7a7e85", glow: 0.3 },   // G3 argent
  { fill: "#d8b760", stroke: "#8b7430", glow: 0.5 },   // G4 or pâle
  { fill: "#f0c640", stroke: "#a08018", glow: 0.9 },   // G5 or éclatant
];

const SKIN = "#e8b894";
const SKIN_DARK = "#b48870";
const TUNIC = "#6a4f3a";

// Récupère un grade depuis profile.equipment[slot] ou null si pas équipé
function getGrade(profile, slot) {
  const item = profile?.equipment?.[slot];
  if (!item) return null;
  return item.grade ?? 0;
}

export default function KnightSprite({ profile, size = 80, className = "" }) {
  const wG = getGrade(profile, "weapon");
  const hG = getGrade(profile, "head_def");
  const tG = getGrade(profile, "torso_def");
  const aG = getGrade(profile, "arms_def");
  const lG = getGrade(profile, "legs_def");
  const sG = getGrade(profile, "shield");

  const wC = wG !== null ? GRADE_COLORS[wG] : null;
  const hC = hG !== null ? GRADE_COLORS[hG] : null;
  const tC = tG !== null ? GRADE_COLORS[tG] : null;
  const aC = aG !== null ? GRADE_COLORS[aG] : null;
  const lC = lG !== null ? GRADE_COLORS[lG] : null;
  const sC = sG !== null ? GRADE_COLORS[sG] : null;

  // Hauteur calculée depuis le ratio 80×120
  const height = Math.round(size * (120 / 80));

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 80 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Chevalier"
    >
      <defs>
        <filter id="knight-glow"><feGaussianBlur stdDeviation="1.2" /></filter>
      </defs>

      {/* ombre au sol */}
      <ellipse cx="40" cy="115" rx="18" ry="3" fill="rgba(0,0,0,0.18)" />

      {/* jambes */}
      <rect x="32" y="78" width="6" height="28" fill={TUNIC} rx="1" />
      <rect x="42" y="78" width="6" height="28" fill={TUNIC} rx="1" />
      {lC && (
        <>
          <rect x="30" y="80" width="10" height="22" fill={lC.fill} stroke={lC.stroke} strokeWidth="1" rx="2" />
          <rect x="40" y="80" width="10" height="22" fill={lC.fill} stroke={lC.stroke} strokeWidth="1" rx="2" />
          {lC.glow > 0.5 && (
            <rect x="30" y="80" width="20" height="22" fill={lC.fill} rx="2" filter="url(#knight-glow)" opacity={lC.glow} />
          )}
        </>
      )}
      {/* bottes */}
      <rect x="29" y="100" width="12" height="8" fill="#3a2818" rx="1" />
      <rect x="39" y="100" width="12" height="8" fill="#3a2818" rx="1" />

      {/* corps + cuirasse */}
      <rect x="26" y="46" width="28" height="36" fill={TUNIC} rx="3" />
      {tC && (
        <>
          <rect x="24" y="44" width="32" height="38" fill={tC.fill} stroke={tC.stroke} strokeWidth="1" rx="3" />
          <line x1="40" y1="46" x2="40" y2="80" stroke={tC.stroke} strokeWidth="0.5" opacity="0.5" />
          <circle cx="32" cy="55" r="1.5" fill={tC.stroke} />
          <circle cx="48" cy="55" r="1.5" fill={tC.stroke} />
          {tC.glow > 0.5 && (
            <rect x="24" y="44" width="32" height="38" fill={tC.fill} rx="3" filter="url(#knight-glow)" opacity={tC.glow} />
          )}
        </>
      )}

      {/* bras gauche (arrière, tient le bouclier si équipé) */}
      <rect x="18" y="48" width="8" height="28" fill={SKIN} rx="3" />
      {aC && (
        <rect x="16" y="48" width="11" height="22" fill={aC.fill} stroke={aC.stroke} strokeWidth="1" rx="3" />
      )}
      <circle cx="22" cy="78" r="4" fill={SKIN} />

      {/* bouclier (main gauche) */}
      {sC && (
        <>
          {/* corps du bouclier : forme oval/rond, devant l'épaule */}
          <ellipse cx="14" cy="62" rx="9" ry="13" fill={sC.fill} stroke={sC.stroke} strokeWidth="1.2" />
          {/* renforts métalliques (croix) */}
          <line x1="14" y1="50" x2="14" y2="74" stroke={sC.stroke} strokeWidth="0.8" opacity="0.6" />
          <line x1="6" y1="62" x2="22" y2="62" stroke={sC.stroke} strokeWidth="0.8" opacity="0.6" />
          {/* boss central */}
          <circle cx="14" cy="62" r="2.5" fill={sC.stroke} />
          {sC.glow > 0.5 && (
            <ellipse cx="14" cy="62" rx="9" ry="13" fill={sC.fill} filter="url(#knight-glow)" opacity={sC.glow} />
          )}
        </>
      )}

      {/* bras droit (épée) */}
      <rect x="54" y="48" width="8" height="28" fill={SKIN} rx="3" />
      {aC && (
        <rect x="53" y="48" width="11" height="22" fill={aC.fill} stroke={aC.stroke} strokeWidth="1" rx="3" />
      )}
      <circle cx="58" cy="78" r="4" fill={SKIN} />

      {/* épée */}
      {wC && (
        <>
          <line x1="58" y1="78" x2="74" y2="40" stroke={wC.stroke} strokeWidth="3.5" strokeLinecap="round" />
          <line x1="58" y1="78" x2="74" y2="40" stroke={wC.fill} strokeWidth="2" strokeLinecap="round" />
          <rect x="54" y="74" width="12" height="2.5" fill={wC.stroke} rx="0.5" transform="rotate(-65 60 75)" />
          <circle cx="56" cy="80" r="2" fill={wC.fill} stroke={wC.stroke} strokeWidth="0.5" />
          {wC.glow > 0.5 && (
            <line x1="58" y1="78" x2="74" y2="40" stroke={wC.fill} strokeWidth="3" strokeLinecap="round" filter="url(#knight-glow)" opacity={wC.glow} />
          )}
        </>
      )}

      {/* tête */}
      <circle cx="40" cy="32" r="11" fill={SKIN} />
      <circle cx="36" cy="31" r="1.2" fill="#2a1a10" />
      <circle cx="44" cy="31" r="1.2" fill="#2a1a10" />
      <path d="M37 37 Q40 39 43 37" stroke={SKIN_DARK} strokeWidth="0.8" fill="none" strokeLinecap="round" />

      {/* heaume */}
      {hC && (
        <>
          <path d="M27 30 Q27 18 40 18 Q53 18 53 30 L53 38 L27 38 Z" fill={hC.fill} stroke={hC.stroke} strokeWidth="1" />
          <rect x="30" y="28" width="20" height="3" fill={hC.stroke} opacity="0.6" />
          <line x1="34" y1="28" x2="34" y2="31" stroke={hC.fill} strokeWidth="0.5" />
          <line x1="40" y1="28" x2="40" y2="31" stroke={hC.fill} strokeWidth="0.5" />
          <line x1="46" y1="28" x2="46" y2="31" stroke={hC.fill} strokeWidth="0.5" />
          {hG >= 3 && (
            <path d="M40 18 Q42 8 48 6 Q44 14 42 18 Z" fill={hC.glow > 0.5 ? "#e24b4a" : "#993556"} />
          )}
          {hC.glow > 0.5 && (
            <path d="M27 30 Q27 18 40 18 Q53 18 53 30 L53 38 L27 38 Z" fill={hC.fill} filter="url(#knight-glow)" opacity={hC.glow} />
          )}
        </>
      )}
    </svg>
  );
}
