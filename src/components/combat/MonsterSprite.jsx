/**
 * src/components/combat/MonsterSprite.jsx
 *
 * Rend un monstre en SVG selon son nom (clé). 12 monstres disponibles,
 * mappés sur la liste MONSTERS_DATA de combatPvE.js.
 *
 * Props :
 *   - name : nom du monstre (ex. "Gobelin", "Loup", "Dragon mineur"…)
 *   - size : largeur cible en px (défaut 110)
 *   - className : classes CSS additionnelles (anim "attacking", "hit", "dying")
 *
 * Si le nom n'est pas reconnu, on rend le monstre par défaut (Gobelin).
 */

// Helper : rend un SVG avec une viewBox standard et les enfants donnés
function MonsterFrame({ size, viewW, viewH, children, className = "", ariaLabel }) {
  const height = Math.round(size * (viewH / viewW));
  return (
    <svg
      width={size}
      height={height}
      viewBox={`0 0 ${viewW} ${viewH}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {children}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Renderers individuels
// ─────────────────────────────────────────────────────────────

function Gobelin(props) {
  return (
    <MonsterFrame {...props} viewW={100} viewH={130} ariaLabel="Gobelin">
      <ellipse cx="50" cy="125" rx="22" ry="3" fill="rgba(0,0,0,0.18)" />
      <rect x="38" y="92" width="9" height="22" fill="#4a7028" rx="2" />
      <rect x="53" y="92" width="9" height="22" fill="#4a7028" rx="2" />
      <ellipse cx="42" cy="116" rx="6" ry="3" fill="#2a1a10" />
      <ellipse cx="58" cy="116" rx="6" ry="3" fill="#2a1a10" />
      <ellipse cx="50" cy="76" rx="20" ry="22" fill="#6ba032" />
      <ellipse cx="50" cy="76" rx="14" ry="14" fill="#7eb83d" opacity="0.6" />
      <ellipse cx="28" cy="72" rx="6" ry="14" fill="#6ba032" transform="rotate(-15 28 72)" />
      <ellipse cx="72" cy="72" rx="6" ry="14" fill="#6ba032" transform="rotate(15 72 72)" />
      <circle cx="24" cy="86" r="5" fill="#6ba032" />
      <circle cx="76" cy="86" r="5" fill="#6ba032" />
      <rect x="73" y="76" width="3.5" height="22" fill="#6f4628" rx="1" transform="rotate(20 75 87)" />
      <ellipse cx="82" cy="73" rx="5" ry="6" fill="#8a5e3c" />
      <ellipse cx="50" cy="42" rx="18" ry="20" fill="#6ba032" />
      <ellipse cx="50" cy="46" rx="14" ry="13" fill="#7eb83d" opacity="0.5" />
      <path d="M32 38 L24 24 L34 32 Z" fill="#6ba032" />
      <path d="M68 38 L76 24 L66 32 Z" fill="#6ba032" />
      <ellipse cx="42" cy="42" rx="3" ry="2.5" fill="#ffe066" />
      <ellipse cx="58" cy="42" rx="3" ry="2.5" fill="#ffe066" />
      <circle cx="42" cy="42" r="1.2" fill="#1a1408" />
      <circle cx="58" cy="42" r="1.2" fill="#1a1408" />
      <path d="M48 48 L50 53 L52 48 Z" fill="#558020" />
      <path d="M40 56 Q50 62 60 56" stroke="#2a1a10" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M44 56 L43 60 L46 58 Z" fill="#fff" />
      <path d="M56 56 L57 60 L54 58 Z" fill="#fff" />
    </MonsterFrame>
  );
}

function Loup(props) {
  return (
    <MonsterFrame {...props} viewW={130} viewH={100} ariaLabel="Loup">
      <ellipse cx="65" cy="92" rx="30" ry="3" fill="rgba(0,0,0,0.18)" />
      <path d="M105 60 Q120 50 118 38 Q116 50 108 65 Z" fill="#5a5550" stroke="#3a3530" strokeWidth="0.5" />
      <ellipse cx="68" cy="62" rx="32" ry="18" fill="#6e6862" />
      <ellipse cx="68" cy="58" rx="28" ry="13" fill="#827b74" opacity="0.5" />
      <rect x="86" y="68" width="7" height="20" fill="#5a5550" rx="2" />
      <rect x="92" y="72" width="6" height="16" fill="#5a5550" rx="2" />
      <ellipse cx="89" cy="89" rx="6" ry="2.5" fill="#2a1a10" />
      <ellipse cx="95" cy="89" rx="5" ry="2.5" fill="#2a1a10" />
      <rect x="42" y="68" width="7" height="20" fill="#5a5550" rx="2" />
      <rect x="48" y="72" width="6" height="16" fill="#5a5550" rx="2" />
      <ellipse cx="45" cy="89" rx="6" ry="2.5" fill="#2a1a10" />
      <ellipse cx="51" cy="89" rx="5" ry="2.5" fill="#2a1a10" />
      <ellipse cx="38" cy="50" rx="18" ry="14" fill="#6e6862" />
      <ellipse cx="22" cy="54" rx="10" ry="6" fill="#5a5550" />
      <circle cx="14" cy="54" r="2.5" fill="#1a1408" />
      <path d="M30 38 L26 26 L36 36 Z" fill="#5a5550" />
      <path d="M42 36 L46 24 L48 36 Z" fill="#5a5550" />
      <path d="M31 36 L29 30 L34 34 Z" fill="#3a3530" />
      <path d="M44 34 L46 28 L47 34 Z" fill="#3a3530" />
      <ellipse cx="38" cy="46" rx="2.5" ry="2" fill="#ffe066" />
      <circle cx="38" cy="46" r="1" fill="#1a1408" />
      <path d="M14 56 Q20 60 28 58" stroke="#2a1a10" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M18 56 L17 60 L20 59 Z" fill="#fff" />
      <path d="M24 56 L25 60 L22 59 Z" fill="#fff" />
    </MonsterFrame>
  );
}

function DragonMineur(props) {
  return (
    <MonsterFrame {...props} viewW={130} viewH={130} ariaLabel="Dragon mineur">
      <ellipse cx="65" cy="125" rx="32" ry="3" fill="rgba(0,0,0,0.18)" />
      <path d="M30 60 Q10 30 8 50 Q12 70 30 78 Z" fill="#7c2d2d" stroke="#4a1717" strokeWidth="1" />
      <path d="M30 60 Q15 45 12 55" stroke="#4a1717" strokeWidth="0.8" fill="none" />
      <path d="M30 70 Q18 65 14 70" stroke="#4a1717" strokeWidth="0.8" fill="none" />
      <path d="M100 60 Q120 30 122 50 Q118 70 100 78 Z" fill="#7c2d2d" stroke="#4a1717" strokeWidth="1" />
      <path d="M100 60 Q115 45 118 55" stroke="#4a1717" strokeWidth="0.8" fill="none" />
      <path d="M100 70 Q112 65 116 70" stroke="#4a1717" strokeWidth="0.8" fill="none" />
      <path d="M65 110 Q90 115 105 100 Q95 105 80 105" fill="#a83838" stroke="#6a1d1d" strokeWidth="1" />
      <path d="M104 99 L114 92 L107 102 Z" fill="#6a1d1d" />
      <ellipse cx="65" cy="80" rx="32" ry="26" fill="#a83838" />
      <ellipse cx="65" cy="74" rx="22" ry="16" fill="#c44a4a" opacity="0.6" />
      <ellipse cx="65" cy="92" rx="22" ry="14" fill="#d68a40" opacity="0.7" />
      <rect x="42" y="92" width="10" height="18" fill="#a83838" rx="2" />
      <rect x="78" y="92" width="10" height="18" fill="#a83838" rx="2" />
      <path d="M40 110 L44 114 L46 110 M48 110 L52 114 L54 110" stroke="#1a1408" strokeWidth="1" fill="none" />
      <path d="M76 110 L80 114 L82 110 M84 110 L88 114 L90 110" stroke="#1a1408" strokeWidth="1" fill="none" />
      <ellipse cx="65" cy="42" rx="22" ry="20" fill="#a83838" />
      <ellipse cx="65" cy="38" rx="16" ry="12" fill="#c44a4a" opacity="0.5" />
      <path d="M50 28 L46 14 L54 24 Z" fill="#3a3530" stroke="#1a1408" strokeWidth="0.5" />
      <path d="M80 28 L84 14 L76 24 Z" fill="#3a3530" stroke="#1a1408" strokeWidth="0.5" />
      <ellipse cx="65" cy="52" rx="14" ry="8" fill="#8a2828" />
      <ellipse cx="60" cy="52" rx="1.2" ry="2" fill="#1a1408" />
      <ellipse cx="70" cy="52" rx="1.2" ry="2" fill="#1a1408" />
      <ellipse cx="56" cy="40" rx="4" ry="3" fill="#ffe066" />
      <ellipse cx="74" cy="40" rx="4" ry="3" fill="#ffe066" />
      <ellipse cx="56" cy="40" rx="1.5" ry="2.5" fill="#7c0c0c" />
      <ellipse cx="74" cy="40" rx="1.5" ry="2.5" fill="#7c0c0c" />
      <path d="M50 56 Q65 64 80 56" stroke="#1a1408" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M55 56 L54 62 L58 60 Z" fill="#fff" />
      <path d="M75 56 L76 62 L72 60 Z" fill="#fff" />
      <path d="M64 58 L64 64 L66 64 L66 58 Z" fill="#fff" />
    </MonsterFrame>
  );
}

function Corbeau(props) {
  return (
    <MonsterFrame {...props} viewW={130} viewH={110} ariaLabel="Corbeau">
      <ellipse cx="65" cy="105" rx="22" ry="3" fill="rgba(0,0,0,0.18)" />
      <path d="M50 50 Q20 45 8 60 Q15 60 30 56 Q40 52 50 56 Z" fill="#1a1a1a" stroke="#000" strokeWidth="0.5" />
      <path d="M48 54 Q30 56 18 62" stroke="#000" strokeWidth="0.5" fill="none" />
      <path d="M80 50 Q110 45 122 60 Q115 60 100 56 Q90 52 80 56 Z" fill="#1a1a1a" stroke="#000" strokeWidth="0.5" />
      <path d="M82 54 Q100 56 112 62" stroke="#000" strokeWidth="0.5" fill="none" />
      <ellipse cx="65" cy="62" rx="16" ry="20" fill="#1a1a1a" />
      <ellipse cx="65" cy="68" rx="10" ry="12" fill="#2a2a2a" opacity="0.5" />
      <line x1="60" y1="80" x2="58" y2="98" stroke="#5a3818" strokeWidth="2" />
      <line x1="70" y1="80" x2="72" y2="98" stroke="#5a3818" strokeWidth="2" />
      <path d="M55 98 L58 98 L60 100 M58 98 L60 102" stroke="#5a3818" strokeWidth="1.5" fill="none" />
      <path d="M70 98 L72 100 L74 98 M72 98 L74 102" stroke="#5a3818" strokeWidth="1.5" fill="none" />
      <circle cx="65" cy="40" r="14" fill="#1a1a1a" />
      <path d="M50 40 L36 38 L50 44 Z" fill="#3a2818" stroke="#1a1408" strokeWidth="0.5" />
      <circle cx="60" cy="38" r="2.5" fill="#ffe066" />
      <circle cx="60" cy="38" r="1.2" fill="#1a1408" />
      <ellipse cx="68" cy="34" rx="2" ry="3" fill="#3a3a3a" opacity="0.5" />
    </MonsterFrame>
  );
}

function Ombre(props) {
  return (
    <MonsterFrame {...props} viewW={100} viewH={130} ariaLabel="Ombre">
      <ellipse cx="50" cy="125" rx="24" ry="3" fill="rgba(0,0,0,0.25)" />
      <path d="M22 110 Q18 95 24 88 Q30 100 38 95 Q42 110 35 122 Q26 124 22 110 Z" fill="#3a2a55" opacity="0.7" />
      <path d="M78 110 Q82 95 76 88 Q70 100 62 95 Q58 110 65 122 Q74 124 78 110 Z" fill="#3a2a55" opacity="0.7" />
      <path d="M30 100 Q22 70 28 50 Q32 35 42 28 Q50 22 58 28 Q68 35 72 50 Q78 70 70 100 Q60 110 50 108 Q40 110 30 100 Z" fill="#2a1f3d" />
      <path d="M30 100 Q22 70 28 50 Q32 35 42 28 Q50 22 58 28 Q68 35 72 50 Q78 70 70 100 Q60 110 50 108 Q40 110 30 100 Z" fill="#5a4880" opacity="0.4" />
      <path d="M28 60 Q15 65 12 78 Q20 72 30 75 Z" fill="#3a2a55" opacity="0.6" />
      <path d="M72 60 Q85 65 88 78 Q80 72 70 75 Z" fill="#3a2a55" opacity="0.6" />
      <ellipse cx="42" cy="50" rx="4" ry="6" fill="#fff" opacity="0.95" />
      <ellipse cx="58" cy="50" rx="4" ry="6" fill="#fff" opacity="0.95" />
      <ellipse cx="42" cy="52" rx="2" ry="3" fill="#1a1a1a" />
      <ellipse cx="58" cy="52" rx="2" ry="3" fill="#1a1a1a" />
      <ellipse cx="50" cy="68" rx="6" ry="8" fill="#1a1a1a" />
      <ellipse cx="50" cy="68" rx="3" ry="5" fill="#000" />
    </MonsterFrame>
  );
}

function Brigand(props) {
  return (
    <MonsterFrame {...props} viewW={100} viewH={130} ariaLabel="Brigand">
      <ellipse cx="50" cy="125" rx="22" ry="3" fill="rgba(0,0,0,0.18)" />
      <rect x="38" y="90" width="9" height="22" fill="#3a2818" rx="2" />
      <rect x="53" y="90" width="9" height="22" fill="#3a2818" rx="2" />
      <ellipse cx="42" cy="115" rx="6" ry="3" fill="#1a1408" />
      <ellipse cx="58" cy="115" rx="6" ry="3" fill="#1a1408" />
      <path d="M22 50 Q18 90 32 95 L68 95 Q82 90 78 50 Z" fill="#5a3818" stroke="#3a2818" strokeWidth="0.5" />
      <path d="M30 60 Q26 80 32 92" stroke="#3a2818" strokeWidth="0.5" fill="none" />
      <path d="M70 60 Q74 80 68 92" stroke="#3a2818" strokeWidth="0.5" fill="none" />
      <rect x="32" y="50" width="36" height="42" fill="#3a2818" rx="3" />
      <rect x="22" y="55" width="8" height="22" fill="#3a2818" rx="3" />
      <circle cx="26" cy="80" r="4" fill="#c9a07b" />
      <line x1="26" y1="82" x2="22" y2="98" stroke="#888" strokeWidth="2.5" />
      <line x1="22" y1="98" x2="20" y2="102" stroke="#666" strokeWidth="2" />
      <rect x="22" y="79" width="8" height="2" fill="#5a3818" />
      <rect x="70" y="55" width="8" height="22" fill="#3a2818" rx="3" />
      <circle cx="74" cy="80" r="4" fill="#c9a07b" />
      <rect x="32" y="78" width="36" height="4" fill="#1a1408" />
      <rect x="48" y="76" width="4" height="8" fill="#c9a07b" />
      <path d="M30 38 Q28 18 50 16 Q72 18 70 38 L70 50 L30 50 Z" fill="#5a3818" stroke="#3a2818" strokeWidth="0.5" />
      <ellipse cx="50" cy="35" rx="13" ry="14" fill="#1a1408" opacity="0.85" />
      <circle cx="44" cy="34" r="1.5" fill="#ffe066" />
      <circle cx="56" cy="34" r="1.5" fill="#ffe066" />
      <path d="M38 42 Q50 46 62 42 L62 48 L38 48 Z" fill="#7c1f1f" />
    </MonsterFrame>
  );
}

function Elemental(props) {
  return (
    <MonsterFrame {...props} viewW={100} viewH={130} ariaLabel="Élémental">
      <ellipse cx="50" cy="125" rx="22" ry="3" fill="rgba(220,80,30,0.25)" />
      <path d="M22 105 Q18 90 28 80 Q30 95 38 92 Q40 100 30 110 Q24 112 22 105 Z" fill="#ef9f27" />
      <path d="M78 105 Q82 90 72 80 Q70 95 62 92 Q60 100 70 110 Q76 112 78 105 Z" fill="#ef9f27" />
      <path d="M30 100 Q22 75 30 55 Q35 35 50 28 Q65 35 70 55 Q78 75 70 100 Q60 110 50 108 Q40 110 30 100 Z" fill="#d85a30" />
      <path d="M36 95 Q30 75 36 58 Q40 40 50 35 Q60 40 64 58 Q70 75 64 95 Q57 102 50 100 Q43 102 36 95 Z" fill="#fac775" />
      <ellipse cx="50" cy="65" rx="10" ry="20" fill="#ffe9a8" opacity="0.8" />
      <path d="M44 35 Q42 18 50 10 Q58 18 56 35 Z" fill="#ef9f27" />
      <path d="M48 30 Q46 14 50 6 Q54 14 52 30 Z" fill="#fac775" />
      <ellipse cx="42" cy="60" rx="3" ry="4" fill="#1a1408" />
      <ellipse cx="58" cy="60" rx="3" ry="4" fill="#1a1408" />
      <ellipse cx="50" cy="78" rx="5" ry="3" fill="#1a1408" />
      <path d="M28 65 Q15 60 14 75 Q22 70 30 72 Z" fill="#d85a30" />
      <path d="M72 65 Q85 60 86 75 Q78 70 70 72 Z" fill="#d85a30" />
    </MonsterFrame>
  );
}

function Vampire(props) {
  return (
    <MonsterFrame {...props} viewW={100} viewH={130} ariaLabel="Vampire">
      <ellipse cx="50" cy="125" rx="22" ry="3" fill="rgba(0,0,0,0.18)" />
      <rect x="38" y="92" width="9" height="22" fill="#1a1a1a" rx="2" />
      <rect x="53" y="92" width="9" height="22" fill="#1a1a1a" rx="2" />
      <ellipse cx="42" cy="116" rx="6" ry="3" fill="#000" />
      <ellipse cx="58" cy="116" rx="6" ry="3" fill="#000" />
      <path d="M20 50 Q14 90 32 95 L68 95 Q86 90 80 50 L78 30 Q60 35 50 30 Q40 35 22 30 Z" fill="#7c0c0c" />
      <path d="M22 50 Q18 80 30 92" stroke="#4a0606" strokeWidth="0.6" fill="none" />
      <path d="M78 50 Q82 80 70 92" stroke="#4a0606" strokeWidth="0.6" fill="none" />
      <rect x="32" y="48" width="36" height="46" fill="#1a1a1a" rx="3" />
      <line x1="50" y1="50" x2="50" y2="58" stroke="#a08018" strokeWidth="0.8" />
      <ellipse cx="50" cy="60" rx="3" ry="4" fill="#a32d2d" stroke="#7c0c0c" strokeWidth="0.5" />
      <rect x="22" y="52" width="8" height="26" fill="#1a1a1a" rx="3" />
      <rect x="70" y="52" width="8" height="26" fill="#1a1a1a" rx="3" />
      <circle cx="26" cy="82" r="4.5" fill="#e8d8d0" />
      <circle cx="74" cy="82" r="4.5" fill="#e8d8d0" />
      <path d="M30 30 Q30 20 40 22 L40 38 Z" fill="#7c0c0c" />
      <path d="M70 30 Q70 20 60 22 L60 38 Z" fill="#7c0c0c" />
      <ellipse cx="50" cy="34" rx="14" ry="16" fill="#e8d8d0" />
      <path d="M36 26 Q34 14 50 14 Q66 14 64 26 L60 28 Q55 20 50 22 Q45 20 40 28 Z" fill="#1a1a1a" />
      <ellipse cx="44" cy="34" rx="2.5" ry="2" fill="#a32d2d" />
      <ellipse cx="56" cy="34" rx="2.5" ry="2" fill="#a32d2d" />
      <circle cx="44" cy="34" r="1" fill="#1a1408" />
      <circle cx="56" cy="34" r="1" fill="#1a1408" />
      <path d="M44 42 Q50 46 56 42" stroke="#5a0606" strokeWidth="1" fill="none" />
      <path d="M46 42 L45 47 L48 45 Z" fill="#fff" />
      <path d="M54 42 L55 47 L52 45 Z" fill="#fff" />
    </MonsterFrame>
  );
}

function Squelette(props) {
  return (
    <MonsterFrame {...props} viewW={100} viewH={130} ariaLabel="Squelette">
      <ellipse cx="50" cy="125" rx="22" ry="3" fill="rgba(0,0,0,0.18)" />
      <rect x="40" y="88" width="6" height="26" fill="#e8e0c8" rx="1" stroke="#888" strokeWidth="0.5" />
      <rect x="54" y="88" width="6" height="26" fill="#e8e0c8" rx="1" stroke="#888" strokeWidth="0.5" />
      <ellipse cx="43" cy="115" rx="6" ry="2.5" fill="#e8e0c8" stroke="#888" strokeWidth="0.5" />
      <ellipse cx="57" cy="115" rx="6" ry="2.5" fill="#e8e0c8" stroke="#888" strokeWidth="0.5" />
      <rect x="36" y="50" width="28" height="38" fill="#e8e0c8" rx="3" stroke="#888" strokeWidth="0.5" />
      <line x1="36" y1="58" x2="64" y2="58" stroke="#888" strokeWidth="1" />
      <line x1="36" y1="66" x2="64" y2="66" stroke="#888" strokeWidth="1" />
      <line x1="36" y1="74" x2="64" y2="74" stroke="#888" strokeWidth="1" />
      <line x1="36" y1="82" x2="64" y2="82" stroke="#888" strokeWidth="1" />
      <line x1="50" y1="50" x2="50" y2="88" stroke="#888" strokeWidth="1.5" />
      <rect x="26" y="54" width="6" height="22" fill="#e8e0c8" rx="2" stroke="#888" strokeWidth="0.5" />
      <rect x="68" y="54" width="6" height="22" fill="#e8e0c8" rx="2" stroke="#888" strokeWidth="0.5" />
      <circle cx="29" cy="80" r="4" fill="#e8e0c8" stroke="#888" strokeWidth="0.5" />
      <line x1="29" y1="80" x2="14" y2="50" stroke="#7a6a40" strokeWidth="3" strokeLinecap="round" />
      <line x1="29" y1="80" x2="14" y2="50" stroke="#a08020" strokeWidth="1" strokeLinecap="round" />
      <rect x="22" y="76" width="14" height="2.5" fill="#5a4818" rx="0.5" transform="rotate(-65 28 78)" />
      <circle cx="71" cy="80" r="4" fill="#e8e0c8" stroke="#888" strokeWidth="0.5" />
      <ellipse cx="50" cy="32" rx="15" ry="17" fill="#e8e0c8" stroke="#888" strokeWidth="0.5" />
      <ellipse cx="44" cy="30" rx="3.5" ry="4.5" fill="#1a1a1a" />
      <ellipse cx="56" cy="30" rx="3.5" ry="4.5" fill="#1a1a1a" />
      <circle cx="44" cy="30" r="0.8" fill="#ffe066" />
      <circle cx="56" cy="30" r="0.8" fill="#ffe066" />
      <path d="M48 38 L50 42 L52 38 Z" fill="#1a1a1a" />
      <rect x="42" y="44" width="16" height="3" fill="#fff" />
      <line x1="46" y1="44" x2="46" y2="47" stroke="#888" strokeWidth="0.5" />
      <line x1="50" y1="44" x2="50" y2="47" stroke="#888" strokeWidth="0.5" />
      <line x1="54" y1="44" x2="54" y2="47" stroke="#888" strokeWidth="0.5" />
    </MonsterFrame>
  );
}

function Golem(props) {
  return (
    <MonsterFrame {...props} viewW={110} viewH={130} ariaLabel="Golem">
      <ellipse cx="55" cy="125" rx="28" ry="3" fill="rgba(0,0,0,0.22)" />
      <rect x="32" y="88" width="14" height="26" fill="#7a7065" rx="2" stroke="#4a443a" strokeWidth="0.5" />
      <rect x="64" y="88" width="14" height="26" fill="#7a7065" rx="2" stroke="#4a443a" strokeWidth="0.5" />
      <line x1="33" y1="98" x2="46" y2="98" stroke="#4a443a" strokeWidth="0.5" />
      <line x1="65" y1="98" x2="78" y2="98" stroke="#4a443a" strokeWidth="0.5" />
      <rect x="22" y="44" width="66" height="50" fill="#9a9085" rx="4" stroke="#4a443a" strokeWidth="0.5" />
      <path d="M28 50 L34 60 L30 70" stroke="#ef9f27" strokeWidth="1.5" fill="none" />
      <path d="M58 56 L62 66 L56 76" stroke="#ef9f27" strokeWidth="1.5" fill="none" />
      <path d="M76 62 L80 72" stroke="#ef9f27" strokeWidth="1.5" fill="none" />
      <line x1="22" y1="62" x2="88" y2="62" stroke="#4a443a" strokeWidth="0.6" />
      <line x1="22" y1="78" x2="88" y2="78" stroke="#4a443a" strokeWidth="0.6" />
      <rect x="6" y="50" width="14" height="36" fill="#7a7065" rx="3" stroke="#4a443a" strokeWidth="0.5" />
      <rect x="90" y="50" width="14" height="36" fill="#7a7065" rx="3" stroke="#4a443a" strokeWidth="0.5" />
      <rect x="4" y="80" width="18" height="14" fill="#7a7065" rx="2" stroke="#4a443a" strokeWidth="0.5" />
      <rect x="88" y="80" width="18" height="14" fill="#7a7065" rx="2" stroke="#4a443a" strokeWidth="0.5" />
      <rect x="32" y="14" width="46" height="32" fill="#9a9085" rx="3" stroke="#4a443a" strokeWidth="0.5" />
      <line x1="32" y1="28" x2="78" y2="28" stroke="#4a443a" strokeWidth="0.5" />
      <rect x="40" y="22" width="8" height="6" fill="#ef9f27" rx="1" />
      <rect x="62" y="22" width="8" height="6" fill="#ef9f27" rx="1" />
      <rect x="42" y="24" width="4" height="2" fill="#ffe066" />
      <rect x="64" y="24" width="4" height="2" fill="#ffe066" />
      <rect x="46" y="36" width="18" height="3" fill="#1a1408" />
    </MonsterFrame>
  );
}

function Sorciere(props) {
  return (
    <MonsterFrame {...props} viewW={100} viewH={130} ariaLabel="Sorcière">
      <ellipse cx="50" cy="125" rx="22" ry="3" fill="rgba(0,0,0,0.18)" />
      <path d="M30 60 Q22 100 28 115 L72 115 Q78 100 70 60 Z" fill="#534ab7" stroke="#3c3489" strokeWidth="0.5" />
      <path d="M36 70 Q34 95 32 112" stroke="#3c3489" strokeWidth="0.5" fill="none" />
      <path d="M64 70 Q66 95 68 112" stroke="#3c3489" strokeWidth="0.5" fill="none" />
      <rect x="30" y="74" width="40" height="3" fill="#26215c" />
      <rect x="22" y="56" width="8" height="26" fill="#534ab7" rx="3" />
      <rect x="70" y="56" width="8" height="26" fill="#534ab7" rx="3" />
      <circle cx="26" cy="84" r="4" fill="#a8d0a8" />
      <circle cx="74" cy="84" r="4" fill="#a8d0a8" />
      <line x1="74" y1="86" x2="86" y2="20" stroke="#3a2818" strokeWidth="2.5" />
      <line x1="80" y1="50" x2="84" y2="48" stroke="#3a2818" strokeWidth="1.2" />
      <line x1="78" y1="38" x2="82" y2="35" stroke="#3a2818" strokeWidth="1" />
      <path d="M86 20 L82 14 L86 8 L90 14 Z" fill="#7eb83d" stroke="#3b6d11" strokeWidth="0.5" />
      <ellipse cx="86" cy="14" rx="2" ry="3" fill="#c0dd97" opacity="0.6" />
      <ellipse cx="50" cy="38" rx="13" ry="15" fill="#a8d0a8" />
      <path d="M50 38 Q46 44 50 48 L52 46" fill="#7eb83d" />
      <ellipse cx="44" cy="36" rx="2" ry="1.5" fill="#3b6d11" />
      <ellipse cx="56" cy="36" rx="2" ry="1.5" fill="#3b6d11" />
      <circle cx="44" cy="36" r="0.8" fill="#1a1408" />
      <circle cx="56" cy="36" r="0.8" fill="#1a1408" />
      <path d="M44 46 Q50 50 56 46" stroke="#5a4030" strokeWidth="0.8" fill="none" strokeLinecap="round" />
      <path d="M30 28 L70 28 L50 -2 Z" fill="#26215c" />
      <ellipse cx="50" cy="28" rx="22" ry="4" fill="#26215c" />
      <ellipse cx="50" cy="26" rx="22" ry="2.5" fill="#3c3489" />
      <rect x="46" y="24" width="8" height="6" fill="#a08018" />
      <rect x="48" y="26" width="4" height="2" fill="#26215c" />
    </MonsterFrame>
  );
}

function Troll(props) {
  return (
    <MonsterFrame {...props} viewW={120} viewH={130} ariaLabel="Troll">
      <ellipse cx="60" cy="125" rx="34" ry="3" fill="rgba(0,0,0,0.22)" />
      <rect x="38" y="90" width="14" height="22" fill="#5a6638" rx="2" />
      <rect x="68" y="90" width="14" height="22" fill="#5a6638" rx="2" />
      <ellipse cx="45" cy="115" rx="9" ry="3" fill="#2a1a10" />
      <ellipse cx="75" cy="115" rx="9" ry="3" fill="#2a1a10" />
      <ellipse cx="60" cy="68" rx="32" ry="28" fill="#7a8a45" />
      <ellipse cx="60" cy="58" rx="22" ry="16" fill="#94a85c" opacity="0.6" />
      <ellipse cx="60" cy="80" rx="20" ry="14" fill="#94a85c" opacity="0.5" />
      <ellipse cx="22" cy="74" rx="11" ry="22" fill="#7a8a45" />
      <ellipse cx="98" cy="74" rx="11" ry="22" fill="#7a8a45" />
      <circle cx="22" cy="94" r="9" fill="#5a6638" />
      <circle cx="98" cy="94" r="9" fill="#5a6638" />
      <rect x="98" y="60" width="6" height="44" fill="#5a3818" rx="1.5" transform="rotate(15 101 82)" />
      <ellipse cx="114" cy="56" rx="9" ry="12" fill="#7a4828" stroke="#3a2818" strokeWidth="0.5" />
      <circle cx="111" cy="52" r="1.5" fill="#3a2818" />
      <circle cx="116" cy="58" r="1.5" fill="#3a2818" />
      <circle cx="113" cy="62" r="1.5" fill="#3a2818" />
      <ellipse cx="60" cy="32" rx="20" ry="18" fill="#7a8a45" />
      <ellipse cx="60" cy="30" rx="14" ry="11" fill="#94a85c" opacity="0.5" />
      <ellipse cx="40" cy="32" rx="5" ry="7" fill="#5a6638" />
      <ellipse cx="80" cy="32" rx="5" ry="7" fill="#5a6638" />
      <ellipse cx="52" cy="30" rx="4" ry="3" fill="#ffe066" />
      <ellipse cx="68" cy="30" rx="4" ry="3" fill="#ffe066" />
      <ellipse cx="52" cy="30" rx="1.8" ry="2" fill="#1a1408" />
      <ellipse cx="68" cy="30" rx="1.8" ry="2" fill="#1a1408" />
      <ellipse cx="60" cy="38" rx="4" ry="3" fill="#5a6638" />
      <ellipse cx="58" cy="38" rx="0.8" ry="1.2" fill="#1a1408" />
      <ellipse cx="62" cy="38" rx="0.8" ry="1.2" fill="#1a1408" />
      <path d="M48 44 Q60 48 72 44" stroke="#3a2818" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M52 44 L51 50 L54 48 Z" fill="#fff" />
      <path d="M68 44 L69 50 L66 48 Z" fill="#fff" />
    </MonsterFrame>
  );
}

// ─────────────────────────────────────────────────────────────
// Mapping nom → renderer
// ─────────────────────────────────────────────────────────────

const RENDERERS = {
  "Gobelin": Gobelin,
  "Loup": Loup,
  "Dragon mineur": DragonMineur,
  "Corbeau": Corbeau,
  "Ombre": Ombre,
  "Brigand": Brigand,
  "Élémental": Elemental,
  "Vampire": Vampire,
  "Squelette": Squelette,
  "Golem": Golem,
  "Sorcière": Sorciere,
  "Troll": Troll,
};

export default function MonsterSprite({ name, size = 110, className = "" }) {
  const Renderer = RENDERERS[name] || Gobelin;
  return <Renderer size={size} className={className} />;
}

// Export aussi la liste des noms supportés (utile pour les tests)
export const SUPPORTED_MONSTERS = Object.keys(RENDERERS);
