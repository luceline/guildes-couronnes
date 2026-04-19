import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getCityTier, getTodayDateStr, BUILDING_TYPES } from "../lib/gameData";
import { Badge } from "@/components/ui/badge";

// ── Palette médiévale ──────────────────────────────────────────────────────
const DANGER_COLORS = {
  sûr:       { stroke: "#6dbf5a", glow: "#a8e89c", label: "vert" },
  modéré:    { stroke: "#e8a83a", glow: "#f5d080", label: "orange" },
  dangereux: { stroke: "#e05252", glow: "#f59090", label: "rouge" },
};

const TIER_ICONS = { 1: "🏕️", 2: "🏘️", 3: "🏙️", 4: "🏛️", 5: "👑", 6: "🌟" };

// ── Seed déterministe par jour ──────────────────────────────────────────────
function seededRng(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b);
    h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b);
    h ^= h >>> 16;
    return ((h >>> 0) / 0xFFFFFFFF);
  };
}

// ── Positions déterministes des villes (changent chaque jour) ──────────────
function getCityPositions(cities, today) {
  const W = 900, H = 520;
  const margin = 90;
  const positions = {};
  const placed = [];

  cities.forEach((city, i) => {
    const rng = seededRng(city.id + today + i);
    let x, y, attempts = 0;
    do {
      x = margin + rng() * (W - margin * 2);
      y = margin + rng() * (H - margin * 2);
      attempts++;
    } while (
      attempts < 60 &&
      placed.some(p => Math.hypot(p.x - x, p.y - y) < 120)
    );
    placed.push({ x, y });
    positions[city.id] = { x, y };
  });
  return positions;
}

// ── Midpoint avec courbure pour les routes ──────────────────────────────────
function curvedPath(x1, y1, x2, y2, curvature = 0.18) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const cx = mx - dy * curvature;
  const cy = my + dx * curvature;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

// ── Icône selon le tier de la ville ────────────────────────────────────────
function getCitySize(lingotsCumul = 0) {
  const tier = getCityTier(lingotsCumul);
  const sizes = { 1: 22, 2: 26, 3: 30, 4: 34, 5: 38, 6: 44 };
  return sizes[tier.level] ?? 22;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function MapView({ profile }) {
  const [cities, setCities]       = useState([]);
  const [routes, setRoutes]       = useState([]);
  const [players, setPlayers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null); // city id
  const [positions, setPositions] = useState({});
  const [today, setToday]         = useState(getTodayDateStr());
  const svgRef                    = useRef(null);
  const refreshRef                = useRef(null);

  // ── Chargement initial et rafraîchissement périodique ──────────────────
  const load = useCallback(async () => {
    const newToday = getTodayDateStr();
    const [allCities, allRoutes, allPlayers] = await Promise.all([
      base44.entities.City.list(),
      base44.entities.TravelRoute.list(),
      base44.entities.PlayerProfile.list(),
    ]);
    const realCities = allCities.filter(c => !c.is_bot_city);
    setCities(realCities);
    setRoutes(allRoutes);
    setPlayers(allPlayers);
    if (newToday !== today) {
      setToday(newToday);
      setPositions(getCityPositions(realCities, newToday));
    } else if (Object.keys(positions).length === 0) {
      setPositions(getCityPositions(realCities, newToday));
    }
    setLoading(false);
  }, [today, positions]);

  useEffect(() => {
    load();
    // Rafraîchit les voyageurs toutes les 30s
    refreshRef.current = setInterval(load, 30000);
    return () => clearInterval(refreshRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recalcul des positions quand le jour change
  useEffect(() => {
    if (cities.length > 0) {
      setPositions(getCityPositions(cities, today));
    }
  }, [today, cities]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const getCityName = (id) => cities.find(c => c.id === id)?.name || "?";

  // ── Voyageurs en route (is_traveling = true, destination = city) ───────
  const travelers = players.filter(
    p => p.is_traveling && p.travel_destination_id && !p.travel_destination_id.startsWith("biome:")
  );

  // Nb voyageurs par route (approximatif : on regarde destination only)
  function travelersOnRoute(route) {
    return travelers.filter(
      p => p.travel_destination_id === route.city_to_id ||
           p.travel_destination_id === route.city_from_id
    ).length;
  }

  const selectedCity = selected ? cities.find(c => c.id === selected) : null;
  const selectedRoutes = selected
    ? routes.filter(r => r.city_from_id === selected || r.city_to_id === selected)
    : [];
  const cityTravelers = selected
    ? travelers.filter(
        p => p.travel_destination_id === selected || p.city_id === selected
      )
    : [];

  // ── Tooltip position relative au SVG ─────────────────────────────────
  const selPos = selected ? positions[selected] : null;

  // ── Couleurs de fond du terrain (déterministe par position) ──────────
  function terrainPatches() {
    const rng = seededRng("terrain" + today);
    const patches = [];
    for (let i = 0; i < 18; i++) {
      const x = rng() * 900, y = rng() * 520;
      const r = 30 + rng() * 60;
      const type = Math.floor(rng() * 4);
      const fills = ["#6b8f5e22", "#a0895022", "#5f7a4422", "#8a724022"];
      patches.push(<ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.6} fill={fills[type]} />);
    }
    return patches;
  }

  return (
    <div className="space-y-3">
      {/* Légende */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-body text-muted-foreground px-1">
        <span className="font-semibold text-foreground">Légende :</span>
        {Object.entries(DANGER_COLORS).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span style={{ display: "inline-block", width: 24, height: 3, background: v.stroke, borderRadius: 2 }} />
            {k}
          </span>
        ))}
        <span className="flex items-center gap-1 ml-2">🐴 voyageur en route</span>
        <span className="flex items-center gap-1">📍 ta ville actuelle</span>
        <span className="ml-auto text-xs text-muted-foreground/60">Carte du {today} · MAJ auto toutes les 30s</span>
      </div>

      {/* SVG Map */}
      <div className="relative rounded-xl overflow-hidden border border-border shadow-md bg-[#2a3320]">
        <svg
          ref={svgRef}
          viewBox="0 0 900 520"
          className="w-full"
          style={{ maxHeight: 520 }}
        >
          <defs>
            {/* Texture terrain */}
            <filter id="grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
              <feBlend in="SourceGraphic" mode="multiply" result="blend" />
              <feComposite in="blend" in2="SourceGraphic" operator="in" />
            </filter>
            <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor="#00000066" />
            </radialGradient>
            {/* Glow filters par danger */}
            {Object.entries(DANGER_COLORS).map(([k, v]) => (
              <filter key={k} id={`glow-${k}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feFlood floodColor={v.glow} floodOpacity="0.7" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            ))}
            <filter id="city-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
              <feFlood floodColor="#ffe066" floodOpacity="0.6" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="sel-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
              <feFlood floodColor="#fff8b0" floodOpacity="0.9" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* Marqueur flèche pour routes */}
            {Object.entries(DANGER_COLORS).map(([k, v]) => (
              <marker key={k} id={`arrow-${k}`} markerWidth="6" markerHeight="6"
                refX="5" refY="3" orient="auto">
                <path d="M 0 0 L 6 3 L 0 6 z" fill={v.stroke} opacity="0.7" />
              </marker>
            ))}
          </defs>

          {/* Fond */}
          <rect width="900" height="520" fill="#3a4a2a" />
          <rect width="900" height="520" fill="url(#vignette)" />

          {/* Patches terrain */}
          {terrainPatches()}

          {/* Grille légère style carte médiévale */}
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`v${i}`} x1={100 * (i + 1)} y1={0} x2={100 * (i + 1)} y2={520}
              stroke="#ffffff08" strokeWidth="1" />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={100 * (i + 1)} x2={900} y2={100 * (i + 1)}
              stroke="#ffffff08" strokeWidth="1" />
          ))}

          {/* ── Routes ── */}
          {routes.map((route, i) => {
            const from = positions[route.city_from_id];
            const to   = positions[route.city_to_id];
            if (!from || !to) return null;
            const dc      = DANGER_COLORS[route.danger_level] || DANGER_COLORS["sûr"];
            const path    = curvedPath(from.x, from.y, to.x, to.y, 0.12 * (i % 2 === 0 ? 1 : -1));
            const nTrav   = travelersOnRoute(route);
            const isSelRoute = selected &&
              (route.city_from_id === selected || route.city_to_id === selected);

            return (
              <g key={route.id}>
                {/* Ombre de route */}
                <path d={path} fill="none" stroke="#00000033" strokeWidth={isSelRoute ? 8 : 5}
                  strokeLinecap="round" />
                {/* Route principale */}
                <path
                  d={path}
                  fill="none"
                  stroke={dc.stroke}
                  strokeWidth={isSelRoute ? 4 : 2.5}
                  strokeLinecap="round"
                  strokeDasharray={route.danger_level === "dangereux" ? "8 5" :
                                   route.danger_level === "modéré"    ? "14 4" : "none"}
                  opacity={selected && !isSelRoute ? 0.25 : 0.9}
                  filter={isSelRoute ? `url(#glow-${route.danger_level})` : undefined}
                  markerEnd={`url(#arrow-${route.danger_level})`}
                />
                {/* Voyageurs animés sur la route */}
                {nTrav > 0 && (
                  <>
                    <circle r="5" fill="#ffe066" opacity="0.9">
                      <animateMotion dur={`${3 + i * 0.4}s`} repeatCount="indefinite" path={path} />
                    </circle>
                    {nTrav > 1 && (
                      <circle r="4" fill="#ffc533" opacity="0.7">
                        <animateMotion dur={`${4.5 + i * 0.3}s`} repeatCount="indefinite" path={path} begin="1s" />
                      </circle>
                    )}
                  </>
                )}
                {/* Label temps de trajet au milieu */}
                {isSelRoute && (() => {
                  const mx = (from.x + to.x) / 2;
                  const my = (from.y + to.y) / 2 - 10;
                  return (
                    <g>
                      <rect x={mx - 22} y={my - 10} width={44} height={16} rx={4}
                        fill="#1a2210cc" />
                      <text x={mx} y={my + 2} textAnchor="middle" fill={dc.stroke}
                        fontSize="10" fontFamily="monospace" fontWeight="bold">
                        {route.travel_time_minutes}min
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })}

          {/* ── Villes ── */}
          {cities.map(city => {
            const pos = positions[city.id];
            if (!pos) return null;
            const isCurrent  = profile?.city_id === city.id;
            const isHome     = profile?.home_city_id === city.id;
            const isSelected = selected === city.id;
            const size       = getCitySize(city.lingots_cumul || city.treasury_cumulative || 0);
            const tier       = getCityTier(city.lingots_cumul || city.treasury_cumulative || 0);
            const nTravHere  = travelers.filter(p => p.travel_destination_id === city.id).length;

            return (
              <g key={city.id}
                style={{ cursor: "pointer" }}
                onClick={() => setSelected(selected === city.id ? null : city.id)}>

                {/* Halo sélection */}
                {isSelected && (
                  <circle cx={pos.x} cy={pos.y} r={size + 16} fill="#ffe06618"
                    stroke="#ffe066" strokeWidth="1.5" strokeDasharray="4 3">
                    <animateTransform attributeName="transform" type="rotate"
                      from={`0 ${pos.x} ${pos.y}`} to={`360 ${pos.x} ${pos.y}`}
                      dur="8s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Halo ville courante (joueur ici) */}
                {isCurrent && (
                  <circle cx={pos.x} cy={pos.y} r={size + 10} fill="#3b82f622"
                    stroke="#60a5fa" strokeWidth="1.5" opacity="0.7">
                    <animate attributeName="r" values={`${size + 8};${size + 14};${size + 8}`}
                      dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.7;0.3;0.7" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Socle de la ville */}
                <circle cx={pos.x} cy={pos.y} r={size + 4}
                  fill="#1a2210cc" stroke={isSelected ? "#ffe066" : isCurrent ? "#60a5fa" : "#8a7a5088"}
                  strokeWidth={isSelected ? 2 : 1}
                  filter={isSelected ? "url(#sel-glow)" : "url(#city-glow)"} />

                {/* Icône ville */}
                <text x={pos.x} y={pos.y + size * 0.35}
                  textAnchor="middle" fontSize={size * 0.9}
                  style={{ userSelect: "none", pointerEvents: "none" }}>
                  {TIER_ICONS[tier.level] || "🏕️"}
                </text>

                {/* Indicateur voyageurs arrivants */}
                {nTravHere > 0 && (
                  <g>
                    <circle cx={pos.x + size - 2} cy={pos.y - size + 2} r={8}
                      fill="#ffe066" stroke="#1a2210" strokeWidth="1.5" />
                    <text x={pos.x + size - 2} y={pos.y - size + 6}
                      textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1a2210">
                      {nTravHere}
                    </text>
                  </g>
                )}

                {/* Badge joueur ici */}
                {isCurrent && (
                  <text x={pos.x} y={pos.y - size - 6}
                    textAnchor="middle" fontSize="11"
                    style={{ userSelect: "none" }}>
                    📍
                  </text>
                )}

                {/* Nom de la ville */}
                <text x={pos.x} y={pos.y + size + 16}
                  textAnchor="middle" fontSize="11" fontWeight="bold"
                  fill={isSelected ? "#ffe066" : isCurrent ? "#93c5fd" : "#e8dcc8"}
                  stroke="#1a221099" strokeWidth="3" paintOrder="stroke"
                  style={{ userSelect: "none", pointerEvents: "none" }}>
                  {city.name}
                </text>

                {/* Tier label */}
                <text x={pos.x} y={pos.y + size + 28}
                  textAnchor="middle" fontSize="9"
                  fill={isSelected ? "#ffe06699" : "#8a7a5099"}
                  style={{ userSelect: "none", pointerEvents: "none" }}>
                  {tier.label}
                </text>
              </g>
            );
          })}

          {/* Vignette finale */}
          <rect width="900" height="520" fill="url(#vignette)" style={{ pointerEvents: "none" }} />
        </svg>

        {/* ── Tooltip ville sélectionnée ── */}
        {selectedCity && selPos && (() => {
          const tier = getCityTier(selectedCity.lingots_cumul || selectedCity.treasury_cumulative || 0);
          const svgW = 900, svgH = 520;
          // Positionnement relatif (% du SVG)
          const pxPct = (selPos.x / svgW) * 100;
          const pyPct = (selPos.y / svgH) * 100;
          const onRight = pxPct < 65;
          const onBottom = pyPct < 55;

          return (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                left: `calc(${pxPct}% + ${onRight ? 12 : -12}px)`,
                top:  `calc(${pyPct}% + ${onBottom ? 8 : -8}px)`,
                transform: `translate(${onRight ? "0%" : "-100%"}, ${onBottom ? "0%" : "-100%"})`,
                maxWidth: 220,
              }}
            >
              <div className="bg-[#1a2210ee] border border-[#8a7a5055] rounded-xl p-3 shadow-2xl text-[#e8dcc8] font-body text-xs space-y-2"
                style={{ backdropFilter: "blur(8px)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{TIER_ICONS[tier.level]}</span>
                  <div>
                    <div className="font-bold text-[#ffe066] text-sm">{selectedCity.name}</div>
                    <div className="text-[#8a9a78] text-xs">{tier.icon} {tier.label}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <div className="bg-[#ffffff08] rounded p-1.5">
                    <div className="text-[#8a9a78]">Population</div>
                    <div className="font-bold">
                      {selectedCity.population || 0}/{selectedCity.max_population || 5}
                    </div>
                  </div>
                  <div className="bg-[#ffffff08] rounded p-1.5">
                    <div className="text-[#8a9a78]">Prestige</div>
                    <div className="font-bold">
                      {(selectedCity.treasury_cumulative || 0).toLocaleString()}💰
                    </div>
                  </div>
                  <div className="bg-[#ffffff08] rounded p-1.5">
                    <div className="text-[#8a9a78]">Maire</div>
                    <div className="font-bold truncate">{selectedCity.mayor_name || "—"}</div>
                  </div>
                  <div className="bg-[#ffffff08] rounded p-1.5">
                    <div className="text-[#8a9a78]">Voyageurs</div>
                    <div className="font-bold">
                      {cityTravelers.length > 0 ? `🐴 ${cityTravelers.length}` : "—"}
                    </div>
                  </div>
                </div>

                {(selectedCity.buildings || []).length > 0 && (
                  <div>
                    <div className="text-[#8a9a78] mb-1">Bâtiments</div>
                    <div className="flex flex-wrap gap-1">
                      {(selectedCity.buildings || []).map((b, i) => (
                        <span key={i} title={b.name || b.building_type} className="text-base">
                          {BUILDING_TYPES[b.building_type]?.icon || "🏠"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRoutes.length > 0 && (
                  <div>
                    <div className="text-[#8a9a78] mb-1">Routes ({selectedRoutes.length})</div>
                    <div className="space-y-1">
                      {selectedRoutes.map(r => {
                        const otherName = getCityName(
                          r.city_from_id === selectedCity.id ? r.city_to_id : r.city_from_id
                        );
                        const dc = DANGER_COLORS[r.danger_level] || DANGER_COLORS["sûr"];
                        return (
                          <div key={r.id} className="flex items-center justify-between gap-2">
                            <span className="truncate">→ {otherName}</span>
                            <span className="flex items-center gap-1 shrink-0">
                              <span style={{ color: dc.stroke }}>●</span>
                              <span className="text-[#8a9a78]">{r.travel_time_minutes}min</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="text-[#8a9a7866] text-center">clic pour fermer</div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Stats globales sous la carte ── */}
      <div className="flex flex-wrap gap-3 text-xs font-body text-muted-foreground px-1">
        <span>🏙️ <strong className="text-foreground">{cities.length}</strong> villes</span>
        <span>🛤️ <strong className="text-foreground">{routes.length}</strong> routes</span>
        <span>🐴 <strong className="text-foreground">{travelers.length}</strong> voyageur{travelers.length > 1 ? "s" : ""} en route</span>
        <span className="text-[#ffe066]">●</span>
        <span>Sûr &nbsp;</span>
        <span className="text-[#e8a83a]">●</span>
        <span>Modéré &nbsp;</span>
        <span className="text-[#e05252]">●</span>
        <span>Dangereux</span>
      </div>
    </div>
  );
}
