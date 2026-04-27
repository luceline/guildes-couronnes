/**
 * OrnateFrame — Cadre orné avec coins décoratifs dorés (fleur de lys / volutes).
 *
 * Wrappe n'importe quel contenu dans un cadre médiéval avec 4 coins ornés
 * en SVG. Léger, pas de dépendance à une image.
 *
 * Utilisation :
 *   <OrnateFrame>
 *     <Card>...</Card>
 *   </OrnateFrame>
 *
 * Variants :
 *   - "default" : 4 coins ornés discrets
 *   - "royal"   : 4 coins ornés + bordure dorée plus visible
 *   - "subtle"  : juste des petits triangles (très discret)
 */

const CornerOrnament = ({ position, variant = "default" }) => {
  // SVG d'un coin orné : volute + petite fleur de lys stylisée
  const baseColor = variant === "royal" ? "#c89a3e" : "#a8842c";
  const accentColor = "#daa844";
  const transforms = {
    "tl": "rotate(0)",            // top-left, base
    "tr": "rotate(90 12 12)",     // top-right
    "br": "rotate(180 12 12)",    // bottom-right
    "bl": "rotate(270 12 12)",    // bottom-left
  };
  const positionClass = {
    "tl": "top-0 left-0",
    "tr": "top-0 right-0",
    "br": "bottom-0 right-0",
    "bl": "bottom-0 left-0",
  };

  if (variant === "subtle") {
    // Petits triangles dorés simples
    return (
      <span
        className={`absolute ${positionClass[position]} pointer-events-none`}
        style={{ width: 14, height: 14 }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 14 14" width="14" height="14">
          <g transform={transforms[position]}>
            <path d="M 0 0 L 12 0 L 12 2 L 2 2 L 2 12 L 0 12 Z" fill={accentColor} opacity="0.85" />
          </g>
        </svg>
      </span>
    );
  }

  // Coin orné par défaut : volute avec petit losange
  return (
    <span
      className={`absolute ${positionClass[position]} pointer-events-none`}
      style={{ width: 24, height: 24 }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="24" height="24">
        <g transform={transforms[position]}>
          {/* Ligne en L de base */}
          <path d="M 2 2 L 18 2 M 2 2 L 2 18" stroke={baseColor} strokeWidth="1.6" strokeLinecap="round" fill="none" />
          {/* Petite volute (courbe) */}
          <path d="M 18 2 Q 22 2 22 6" stroke={baseColor} strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d="M 2 18 Q 2 22 6 22" stroke={baseColor} strokeWidth="1.4" fill="none" strokeLinecap="round" />
          {/* Petit losange décoratif au coin */}
          <path d="M 5 5 L 7 3 L 9 5 L 7 7 Z" fill={accentColor} opacity="0.9" />
          {/* Petit point doré */}
          <circle cx="7" cy="5" r="0.8" fill="#fff5d6" opacity="0.9" />
        </g>
      </svg>
    </span>
  );
};

export default function OrnateFrame({ children, variant = "default", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <CornerOrnament position="tl" variant={variant} />
      <CornerOrnament position="tr" variant={variant} />
      <CornerOrnament position="bl" variant={variant} />
      <CornerOrnament position="br" variant={variant} />
      {children}
    </div>
  );
}

/**
 * SectionDivider — Séparateur orné horizontal type filigrane.
 * À utiliser entre des grosses sections d'une page.
 */
export function SectionDivider({ icon = "⚜️" }) {
  return (
    <div className="flex items-center gap-3 my-6 select-none" aria-hidden="true">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-600/50 to-amber-600/30" />
      <span
        className="text-amber-600 text-base"
        style={{ textShadow: "0 0 6px rgba(218, 168, 68, 0.4)" }}
      >
        {icon}
      </span>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-600/50 to-amber-600/30" />
    </div>
  );
}

/**
 * SectionHeader — Titre de section avec ornements décoratifs gauche/droite.
 */
export function SectionHeader({ children, icon = null, level = 2 }) {
  const Tag = `h${level}`;
  return (
    <div className="flex items-center gap-3 my-3">
      {/* Filigrane gauche */}
      <span className="hidden sm:block flex-1 max-w-[80px] h-px bg-gradient-to-r from-transparent to-amber-600/40" />
      {icon && <span className="text-base text-amber-700">{icon}</span>}
      <Tag className="font-heading font-bold text-foreground tracking-wider px-2">
        {children}
      </Tag>
      {icon && <span className="text-base text-amber-700">{icon}</span>}
      <span className="hidden sm:block flex-1 max-w-[80px] h-px bg-gradient-to-l from-transparent to-amber-600/40" />
    </div>
  );
}

/**
 * RoyalSeal — Élément circulaire type sceau de cire à utiliser
 * pour des boutons importants ou des badges spéciaux.
 */
export function RoyalSeal({ children, color = "gold", size = 40 }) {
  const colorMap = {
    gold:   { bg: "linear-gradient(135deg, #f4c557 0%, #b8862e 100%)", ring: "#7a5c1f" },
    red:    { bg: "linear-gradient(135deg, #dc4a3e 0%, #7a1e15 100%)", ring: "#5a1410" },
    silver: { bg: "linear-gradient(135deg, #e0e0e0 0%, #888 100%)", ring: "#555" },
  };
  const c = colorMap[color] || colorMap.gold;

  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-heading font-bold relative"
      style={{
        width: size, height: size,
        background: c.bg,
        boxShadow: `0 0 0 2px ${c.ring}, inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.3)`,
        color: color === "gold" ? "#3d2810" : "#fff",
      }}
    >
      {children}
    </span>
  );
}
