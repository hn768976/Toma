import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { useTheme } from "./context";
import { HudText, useMirrored } from "./primitives";
import { makeRandom } from "./rng";

/**
 * Continents as overlapping lat/lon ellipses. This is deliberately coarse: at
 * the size the globe occupies on screen the silhouette is all that reads, and
 * a blob model costs nothing compared to shipping real vector coastlines.
 */
type Blob = { lon: number; lat: number; rLon: number; rLat: number };

/**
 * More blobs than strictly necessary, because the silhouette is the whole job:
 * a viewer recognises Earth from the taper of South America, the horn of
 * Africa and the Eurasian mass running off to the east, and gets none of that
 * from three fat ellipses. Coverage lands at 29% of the sphere, which is
 * Earth's actual land fraction.
 */
const LANDMASS: Blob[] = [
  // North America
  { lon: -125, lat: 60, rLon: 26, rLat: 12 }, // Alaska / Yukon
  { lon: -100, lat: 58, rLon: 34, rLat: 14 }, // Canadian shield
  { lon: -98, lat: 42, rLon: 26, rLat: 13 }, // continental US
  { lon: -80, lat: 34, rLon: 14, rLat: 11 }, // eastern seaboard
  { lon: -103, lat: 25, rLon: 12, rLat: 10 }, // Mexico
  { lon: -86, lat: 14, rLon: 10, rLat: 5 }, // Central America
  { lon: -45, lat: 73, rLon: 16, rLat: 9 }, // Greenland
  // South America
  { lon: -66, lat: -6, rLon: 16, rLat: 12 }, // Amazon basin
  { lon: -44, lat: -12, rLon: 10, rLat: 12 }, // Brazilian highlands
  { lon: -66, lat: -28, rLon: 9, rLat: 12 }, // the cone
  { lon: -70, lat: -44, rLon: 5, rLat: 11 }, // Patagonia
  // Africa
  { lon: 5, lat: 18, rLon: 22, rLat: 14 }, // Sahara west
  { lon: 30, lat: 17, rLon: 15, rLat: 14 }, // Sahara east
  { lon: 22, lat: 2, rLon: 18, rLat: 12 }, // equatorial belt
  { lon: 26, lat: -18, rLon: 13, rLat: 14 }, // southern Africa
  { lon: 45, lat: 8, rLon: 8, rLat: 7 }, // Horn of Africa
  { lon: 47, lat: -19, rLon: 4, rLat: 7 }, // Madagascar
  // Europe
  { lon: 10, lat: 48, rLon: 18, rLat: 10 }, // western Europe
  { lon: 28, lat: 54, rLon: 18, rLat: 11 }, // eastern Europe
  { lon: 22, lat: 65, rLon: 14, rLat: 8 }, // Scandinavia
  { lon: -3, lat: 53, rLon: 6, rLat: 5 }, // British Isles
  // Asia
  { lon: 60, lat: 60, rLon: 30, rLat: 12 }, // west Siberia
  { lon: 105, lat: 64, rLon: 32, rLat: 11 }, // east Siberia
  { lon: 145, lat: 64, rLon: 16, rLat: 9 }, // Kamchatka / far east
  { lon: 70, lat: 45, rLon: 22, rLat: 12 }, // central Asia
  { lon: 100, lat: 40, rLon: 22, rLat: 12 }, // Mongolia / north China
  { lon: 112, lat: 28, rLon: 15, rLat: 11 }, // south China
  { lon: 45, lat: 32, rLon: 15, rLat: 10 }, // Middle East
  { lon: 78, lat: 22, rLon: 11, rLat: 11 }, // India
  { lon: 102, lat: 14, rLon: 9, rLat: 9 }, // Indochina
  { lon: 112, lat: -2, rLon: 14, rLat: 5 }, // Indonesia
  { lon: 138, lat: 37, rLon: 6, rLat: 8 }, // Japan
  // Oceania
  { lon: 133, lat: -24, rLon: 19, rLat: 11 }, // Australia
  { lon: 172, lat: -42, rLon: 5, rLat: 7 }, // New Zealand
  { lon: 142, lat: -6, rLon: 9, rLat: 4 }, // New Guinea
];

/**
 * The blobs above are drawn generously so neighbours overlap into continuous
 * coastlines instead of a string of beads; this trims them back so total land
 * coverage lands on Earth's ~29%.
 */
const LAND_SCALE = 0.86;

const isLand = (lon: number, lat: number): boolean => {
  if (lat < -72) return true; // Antarctic cap - 2.4% of the sphere, as on Earth
  for (const blob of LANDMASS) {
    let dLon = lon - blob.lon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    // Meridians converge towards the poles, so scale longitude by cos(lat).
    const nx = (dLon * Math.cos((lat * Math.PI) / 180)) / (blob.rLon * LAND_SCALE);
    const ny = (lat - blob.lat) / (blob.rLat * LAND_SCALE);
    if (nx * nx + ny * ny < 1) return true;
  }
  return false;
};

type SpherePoint = { x: number; y: number; z: number; land: boolean };

/** Fibonacci sphere - even coverage without the pole clustering of a lat/lon grid. */
const buildPoints = (count: number): SpherePoint[] => {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const points: SpherePoint[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lon = (Math.atan2(z, x) * 180) / Math.PI;
    points.push({ x, y, z, land: isLand(lon, lat) });
  }
  return points;
};

/** One dot as a closed arc pair, so a whole hemisphere is a single <path>. */
const dot = (cx: number, cy: number, r: number): string =>
  `M${(cx - r).toFixed(1)} ${cy.toFixed(1)}a${r} ${r} 0 1 0 ${(r * 2).toFixed(1)} 0a${r} ${r} 0 1 0 ${(-r * 2).toFixed(1)} 0`;

/**
 * The dotted globe at the centre of the console: a point cloud spun about its
 * axis, with the front hemisphere drawn and the back culled.
 */
export const Globe: React.FC<{
  cx: number;
  cy: number;
  r: number;
  /** Degrees of spin per second. */
  spin?: number;
  /**
   * Starting rotation in degrees. The longitude facing the camera is this plus
   * 90, so -170 opens on the Americas; at the default spin the take ends over
   * Africa, keeping land in view throughout instead of drifting into an empty
   * Pacific hemisphere.
   */
  phase?: number;
  density?: number;
}> = ({ cx, cy, r, spin = 4.5, phase = -170, density = 20000 }) => {
  const theme = useTheme();
  const mirrored = useMirrored();
  const frame = useCurrentFrame();
  const points = useMemo(() => buildPoints(density), [density]);

  const angle = (((frame / 30) * spin + phase) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Axial tilt towards the camera: it keeps the sphere from reading as a flat
  // disc, favours the land-heavy northern hemisphere, and pushes the Antarctic
  // cap round to the far limb where it belongs rather than banding the bottom.
  const tilt = (16 * Math.PI) / 180;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);

  // One dot per ~1.6% of the radius keeps density constant across sizes.
  const unit = r / 190;
  let landPath = "";
  let oceanPath = "";
  for (const p of points) {
    const rx = p.x * cos + p.z * sin;
    const rz = -p.x * sin + p.z * cos;
    const ry = p.y * cosT - rz * sinT;
    const depth = p.y * sinT + rz * cosT;
    if (depth < 0.02) continue; // back hemisphere
    const px = cx + rx * r;
    const py = cy - ry * r;
    // Dot size tracks the sphere's radius, and shrinks towards the limb so
    // the surface reads as curved rather than as a flat disc of confetti.
    const size = unit * (0.6 + depth * 0.5);
    if (p.land) {
      // Sized so neighbouring dots just overlap at this density: any smaller
      // and the continents break up into confetti.
      landPath += dot(px, py, size * 2.45);
    } else {
      oceanPath += dot(px, py, size * 0.8);
    }
  }

  return (
    <g>
      <defs>
        {/* Limb darkening: bright at the sub-camera point, falling off towards
            the edge, so the dot field reads as a sphere and not a disc. */}
        <radialGradient id={`globe-core-${Math.round(cx)}`} cx="42%" cy="38%">
          <stop offset="0%" stopColor={theme.glow} stopOpacity={0.42} />
          <stop offset="60%" stopColor={theme.glow} stopOpacity={0.14} />
          <stop offset="100%" stopColor={theme.void} stopOpacity={0.5} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r * 1.02} fill={theme.void} opacity={0.7} />
      {/* The sphere counter-flips inside a mirrored console for the same
          reason type does: a backwards Earth reads as a mistake. */}
      <g transform={mirrored ? `translate(${cx * 2} 0) scale(-1 1)` : undefined}>
        <circle cx={cx} cy={cy} r={r} fill={`url(#globe-core-${Math.round(cx)})`} />
        <path d={oceanPath} fill={theme.line} opacity={0.55} />
        <path d={landPath} fill={theme.hot} opacity={1} />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.bright} strokeWidth={1.4} opacity={0.7} />
      <circle
        cx={cx}
        cy={cy}
        r={r * 1.09}
        fill="none"
        stroke={theme.line}
        strokeWidth={1}
        strokeDasharray="3 7"
        opacity={0.8}
      />
    </g>
  );
};

const ICON_GLYPHS = ["⚡", "☀", "☁", "♻", "⚑", "◉", "⚙", "▲"];

/**
 * The badge ring that orbits the globe: dashed track, evenly spaced nodes, and
 * a single node highlighted as the ring rotates past it.
 */
export const OrbitRing: React.FC<{
  cx: number;
  cy: number;
  r: number;
  nodes?: number;
  /** Degrees per second. */
  speed?: number;
}> = ({ cx, cy, r, nodes = 10, speed = -6 }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const rotation = ((frame / 30) * speed * Math.PI) / 180;
  const random = makeRandom("orbit-nodes");
  const active = Math.floor((frame / 22) % nodes);

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={theme.line}
        strokeWidth={1.1}
        strokeDasharray="2 6"
        opacity={0.9}
      />
      {Array.from({ length: nodes }, (_, i) => {
        const a = rotation + (i / nodes) * Math.PI * 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const glyph = ICON_GLYPHS[Math.floor(random() * ICON_GLYPHS.length)];
        const isActive = i === active;
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={13}
              fill={theme.surface}
              stroke={isActive ? theme.hot : theme.mid}
              strokeWidth={isActive ? 1.8 : 1.1}
              opacity={0.95}
            />
            <HudText
              x={x}
              y={y + 4.5}
              fill={isActive ? theme.hot : theme.bright}
              fontSize={12}
              textAnchor="middle"
              opacity={0.95}
            >
              {glyph}
            </HudText>
          </g>
        );
      })}
    </g>
  );
};

/**
 * A leader line from the globe out to a small caption, the way callouts are
 * pinned to a target on a survey display.
 */
export const Callout: React.FC<{
  x: number;
  y: number;
  dx: number;
  dy: number;
  lines: string[];
}> = ({ x, y, dx, dy, lines }) => {
  const theme = useTheme();
  const endX = x + dx;
  const endY = y + dy;
  const tailX = endX + Math.sign(dx) * 64;

  return (
    <g opacity={0.85}>
      <circle cx={x} cy={y} r={2.6} fill={theme.hot} />
      <path
        d={`M ${x} ${y} L ${endX} ${endY} L ${tailX} ${endY}`}
        fill="none"
        stroke={theme.mid}
        strokeWidth={1}
      />
      {lines.map((line, i) => (
        <HudText
          key={line}
          x={dx < 0 ? tailX : endX + 6}
          y={endY - 6 + i * 12}
          fill={theme.bright}
          fontSize={9}
          letterSpacing={1.4}
          textAnchor="start"
        >
          {line}
        </HudText>
      ))}
    </g>
  );
};
