/**
 * src/components/combat/DragonSprite.jsx
 *
 * Sprite SVG paramétrique du Boss "Dragon de Nuit".
 * Style cohérent avec KnightSprite.jsx (paramétrique, couches indépendantes).
 *
 * Props :
 *   - hp, hpMax        : pour ajuster apparence (rage si HP < 33%, yeux rouges si < 40%)
 *   - weaponGrade      : grade actuel arme boss (0-10), couleur épée
 *   - shieldGrade      : grade actuel bouclier boss (0-10), couleur bouclier
 *   - destabilized     : si true → bouclier remplacé par étoile rouge
 *   - size             : largeur cible en px (défaut 160)
 *   - className        : classes CSS additionnelles
 *
 * Animations CSS recommandées (cs-idle, cs-shaking, etc.) :
 *   - Le wrapper SVG hérite des classes via className
 *   - Compatible avec .cs-monster-slot et .cs-fighter de CombatScreen.css
 */

// Couleurs grade étendues 0-10 (KnightSprite va jusqu'à 5)
// Pour boss : G6-G10 = teintes plus saturées et menaçantes
const BOSS_GRADE_COLORS = [
  { fill: '#9b9994', stroke: '#5f5e5a', glow: 0 },       // G0 gris terne
  { fill: '#a87148', stroke: '#6f4628', glow: 0 },       // G1 bronze
  { fill: '#c89a5d', stroke: '#7c5e36', glow: 0 },       // G2 cuivre
  { fill: '#c0c4cc', stroke: '#7a7e85', glow: 0.3 },     // G3 argent
  { fill: '#d8b760', stroke: '#8b7430', glow: 0.5 },     // G4 or pâle
  { fill: '#f0c640', stroke: '#a08018', glow: 0.9 },     // G5 or éclatant
  { fill: '#ff8855', stroke: '#993c1d', glow: 0.9 },     // G6 orange brûlant
  { fill: '#ff5a3a', stroke: '#7a1f0a', glow: 1 },       // G7 rouge incandescent
  { fill: '#d4537e', stroke: '#72243e', glow: 1 },       // G8 magenta démoniaque
  { fill: '#7f77dd', stroke: '#3c3489', glow: 1 },       // G9 violet sombre
  { fill: '#e8d4a0', stroke: '#9a3412', glow: 1 },       // G10 or noir (boss enragé)
];

function getGradeColor(grade) {
  const g = Math.max(0, Math.min(10, Math.round(grade || 0)));
  return BOSS_GRADE_COLORS[g];
}

function getBodyColor(hpRatio) {
  // Couleurs éclaircies pour visibilité sur fond foncé (dragon de nuit)
  if (hpRatio > 0.66) return { body: '#7a3a28', belly: '#a55540', acc: '#3a1810' };  // marron rouille
  if (hpRatio > 0.33) return { body: '#8a3a20', belly: '#b85a30', acc: '#4a1808' };  // marron-orange
  return { body: '#a04018', belly: '#d05030', acc: '#5a1808' };                       // mode rage : rouge feu
}

export default function DragonSprite({
  hp = 80,
  hpMax = 80,
  weaponGrade = 5,
  shieldGrade = 0,
  destabilized = false,
  size = 160,
  className = '',
}) {
  const ratio = Math.max(0.01, hp / hpMax);
  const body = getBodyColor(ratio);
  const wC = getGradeColor(weaponGrade);
  const sC = getGradeColor(shieldGrade);
  const rageEye = ratio < 0.4 ? '#ff3a1a' : '#f5a623';
  const fireGlow = ratio < 0.5 ? 0.9 : 0.6;
  const showFire = ratio < 0.5;
  const showRageEyeGlow = ratio < 0.4;
  const height = Math.round(size * (240 / 200));
  const filterId = `dragon-glow-${size}`;

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 200 240"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Dragon de Nuit"
    >
      <defs>
        <filter id={filterId}><feGaussianBlur stdDeviation="1.5" /></filter>
      </defs>

      {/* ombre au sol */}
      <ellipse cx="100" cy="225" rx="50" ry="6" fill="rgba(0,0,0,0.3)" />

      {/* aile gauche */}
      <path
        d="M40 130 Q15 100 25 70 Q50 90 70 125 L75 155 Q60 145 40 130 Z"
        fill={body.body}
      />
      <path
        d="M50 120 Q40 105 50 90 L65 110 L60 130 Z"
        fill={body.acc}
        opacity="0.7"
      />
      <path
        d="M30 95 L42 105 M35 80 L48 100 M48 75 L60 95"
        stroke={body.acc}
        strokeWidth="0.8"
        opacity="0.6"
      />

      {/* aile droite */}
      <path
        d="M160 130 Q185 100 175 70 Q150 90 130 125 L125 155 Q140 145 160 130 Z"
        fill={body.body}
      />
      <path
        d="M150 120 Q160 105 150 90 L135 110 L140 130 Z"
        fill={body.acc}
        opacity="0.7"
      />
      <path
        d="M170 95 L158 105 M165 80 L152 100 M152 75 L140 95"
        stroke={body.acc}
        strokeWidth="0.8"
        opacity="0.6"
      />

      {/* corps central */}
      <path
        d="M70 185 Q70 145 90 130 L110 130 Q130 145 130 185 L125 200 L75 200 Z"
        fill={body.body}
      />

      {/* ventre clair */}
      <path
        d="M85 195 Q100 192 115 195 L113 215 Q100 218 87 215 Z"
        fill={body.belly}
      />
      <line x1="100" y1="195" x2="100" y2="215" stroke={body.acc} strokeWidth="0.4" opacity="0.5" />

      {/* cou */}
      <path
        d="M80 135 Q75 115 90 105 Q100 100 110 105 Q125 115 120 135 L120 155 Q110 165 100 165 Q90 165 80 155 Z"
        fill={body.body}
      />

      {/* tête */}
      <path
        d="M85 102 Q95 78 100 75 Q105 78 115 102 Q115 115 110 122 L100 125 L90 122 Q85 115 85 102 Z"
        fill={body.body}
      />

      {/* mâchoire */}
      <path d="M88 108 Q85 96 95 88 L100 102 Z" fill={body.acc} opacity="0.8" />
      <path d="M112 108 Q115 96 105 88 L100 102 Z" fill={body.acc} opacity="0.8" />

      {/* yeux */}
      <ellipse cx="93" cy="105" rx="3.5" ry="5" fill={rageEye} />
      <ellipse cx="107" cy="105" rx="3.5" ry="5" fill={rageEye} />
      <ellipse cx="93" cy="106" rx="1.2" ry="3" fill="#000" />
      <ellipse cx="107" cy="106" rx="1.2" ry="3" fill="#000" />
      {showRageEyeGlow && (
        <>
          <ellipse cx="93" cy="105" rx="5" ry="7" fill={rageEye} filter={`url(#${filterId})`} opacity="0.5" />
          <ellipse cx="107" cy="105" rx="5" ry="7" fill={rageEye} filter={`url(#${filterId})`} opacity="0.5" />
        </>
      )}

      {/* dents */}
      <path
        d="M86 118 L88 122 M91 120 L93 124 M97 121 L98 126 M103 121 L102 126 M109 120 L107 124 M114 118 L112 122"
        stroke="#fff3c4"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.9"
      />

      {/* gueule entrouverte avec souffle */}
      <path d="M100 130 Q95 138 105 142 Q115 138 110 130" fill={body.acc} />
      <path
        d="M100 138 Q100 155 95 170"
        stroke="#ff6b1a"
        strokeWidth="2.5"
        fill="none"
        opacity={fireGlow}
      />
      <path
        d="M105 142 Q108 158 100 175"
        stroke="#ff6b1a"
        strokeWidth="2"
        fill="none"
        opacity={fireGlow * 0.7}
      />
      {showFire && (
        <>
          <ellipse cx="100" cy="170" rx="6" ry="4" fill="#f5a623" opacity={fireGlow} />
          <ellipse cx="100" cy="175" rx="4" ry="3" fill="#fff3c4" opacity="0.6" />
        </>
      )}

      {/* cornes */}
      <polygon points="88,80 92,68 96,80" fill={body.body} />
      <polygon points="104,80 108,68 112,80" fill={body.body} />
      <polygon points="93,72 97,60 101,72" fill={body.body} />
      <polygon points="99,72 103,60 107,72" fill={body.body} />

      {/* queue */}
      <path
        d="M120 130 Q110 175 130 210"
        stroke={body.acc}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M125 165 Q140 175 145 200"
        stroke={body.body}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />

      {/* pattes */}
      <path d="M75 165 Q72 180 75 195 Q85 200 90 198 Q90 185 85 175 Z" fill={body.body} />
      <path d="M82 188 Q78 193 84 198 Z" fill={body.acc} />
      <path d="M125 165 Q128 180 125 195 Q115 200 110 198 Q110 185 115 175 Z" fill={body.body} />
      <path d="M118 188 Q122 193 116 198 Z" fill={body.acc} />

      {/* arme (épée enflammée, à droite du boss) */}
      {weaponGrade > 0 && (
        <g transform="translate(135, 170) rotate(25)">
          <line x1="0" y1="0" x2="0" y2="-45" stroke={wC.stroke} strokeWidth="4" strokeLinecap="round" />
          <line x1="0" y1="0" x2="0" y2="-45" stroke={wC.fill} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="-7" y="-2" width="14" height="4" fill={wC.stroke} rx="1" />
          <circle cx="0" cy="6" r="3" fill={wC.fill} stroke={wC.stroke} strokeWidth="0.5" />
          {wC.glow > 0.6 && (
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="-45"
              stroke={wC.fill}
              strokeWidth="3.5"
              strokeLinecap="round"
              filter={`url(#${filterId})`}
              opacity={wC.glow}
            />
          )}
        </g>
      )}

      {/* bouclier (à gauche du boss) ou état déstabilisé */}
      {shieldGrade > 0 && !destabilized && (
        <g transform="translate(55, 175)">
          <path
            d="M0 0 Q-12 -5 -14 -18 L-14 8 Q-7 14 0 14 Q7 14 14 8 L14 -18 Q12 -5 0 0 Z"
            fill={sC.fill}
            stroke={sC.stroke}
            strokeWidth="1.5"
            transform="translate(0, 5)"
          />
          <circle cx="0" cy="0" r="3" fill={sC.stroke} />
          <line x1="-14" y1="-5" x2="14" y2="-5" stroke={sC.stroke} strokeWidth="0.8" opacity="0.5" />
          <line x1="0" y1="-15" x2="0" y2="15" stroke={sC.stroke} strokeWidth="0.8" opacity="0.5" />
          {sC.glow > 0.6 && (
            <path
              d="M0 0 Q-12 -5 -14 -18 L-14 8 Q-7 14 0 14 Q7 14 14 8 L14 -18 Q12 -5 0 0 Z"
              fill={sC.fill}
              filter={`url(#${filterId})`}
              opacity={sC.glow}
              transform="translate(0, 5)"
            />
          )}
        </g>
      )}

      {destabilized && (
        <g transform="translate(55, 175)">
          <text x="0" y="0" textAnchor="middle" fontFamily="serif" fontSize="22" fill="#ff3a1a" opacity="0.9">
            ✦
          </text>
          <circle
            cx="0"
            cy="0"
            r="14"
            fill="none"
            stroke="#ff3a1a"
            strokeWidth="1"
            strokeDasharray="3 2"
            opacity="0.6"
          />
        </g>
      )}
    </svg>
  );
}
