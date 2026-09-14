import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { useTheme } from "./context";
import { MONO } from "./primitives";
import { makeRandom } from "./rng";

/**
 * Continents as overlapping lat/lon ellipses. This is deliberately coarse: at
 * the size the globe occupies on screen the silhouette is all that reads, and
 * a blob model costs nothing compared to shipping real vector coastlines.
 */
type Blob = { lon: number; lat: number; rLon: number; rLat: number };

const LANDMASS: Blob[] = [
  { lon: -103, lat: 48, rLon: 34, rLat: 20 }, // North America
  { lon: -92, lat: 26, rLon: 16, rLat: 13 }, // Mexico / Central America
  { lon: -42, lat: 72, rLon: 15, rLat: 9 }, // Greenland
  { lon: -62, lat: -12, rLon: 15, rLat: 16 }, // northern South America
  { lon: -66, lat: -33, rLon: 9, rLat: 18 }, // southern South America
  { lon: 17, lat: 12, rLon: 20, rLat: 19 }, // north Africa
  { lon: 24, lat: -14, rLon: 15, rLat: 20 }, // south Africa
  { lon: 14, lat: 50, rLon: 20, rLat: 11 }, // Europe
  { lon: 60, lat: 56, rLon: 38, rLat: 16 }, // Siberia / central Asia
  { lon: 108, lat: 46, rLon: 28, rLat: 16 }, // east Asia
  { lon: 78, lat: 22, rLon: 12, rLat: 13 }, // India
  { lon: 112, lat: 4, rLon: 16, rLat: 10 }, // south-east Asia
  { lon: 134, lat: -25, rLon: 17, rLat: 11 }, // Australia
];

const isLand = (lon: number, lat: number): boolean => {
  if (lat < -74) return true; // Antarctic cap
  for (const blob of LANDMASS) {
    let dLon = lon - blob.lon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    // Meridians converge towards the poles, so scale longitude by cos(lat).
    const nx = (dLon * Math.cos((lat * Math.PI) / 180)) / blob.rLon;
    const ny = (lat - blob.lat) / blob.rLat;
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
  density?: number;
}> = ({ cx, cy, r, spin = 9, density = 2600 }) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const points = useMemo(() => buildPoints(density), [density]);

  const angle = ((frame / 30) * spin * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // A slight axial tilt keeps the sphere from reading as a flat disc.
  const tilt = (-16 * Math.PI) / 180;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);

  // One dot per ~1.6% of the radius keeps density constant across sizes.
  const unit = r / 145;
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
    const size = unit * (0.55 + depth * 0.55);
    if (p.land) {
      landPath += dot(px, py, size * 1.45);
    } else {
      oceanPath += dot(px, py, size * 0.8);
    }
  }

  return (
    <g>
      <defs>
        <radialGradient id={`globe-core-${Math.round(cx)}`}>
          <stop offset="0%" stopColor={theme.glow} stopOpacity={0.55} />
          <stop offset="70%" stopColor={theme.glow} stopOpacity={0.22} />
          <stop offset="100%" stopColor={theme.glow} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r * 1.02} fill={theme.void} opacity={0.7} />
      <circle cx={cx} cy={cy} r={r} fill={`url(#globe-core-${Math.round(cx)})`} />
      <path d={oceanPath} fill={theme.mid} opacity={0.45} />
      <path d={landPath} fill={theme.hot} opacity={1} />
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
            <text
              x={x}
              y={y + 4.5}
              fill={isActive ? theme.hot : theme.bright}
              fontSize={12}
              fontFamily={MONO}
              textAnchor="middle"
              opacity={0.95}
            >
              {glyph}
            </text>
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
        <text
          key={line}
          x={dx < 0 ? tailX : endX + 6}
          y={endY - 6 + i * 12}
          fill={theme.bright}
          fontSize={9}
          fontFamily={MONO}
          letterSpacing={1.4}
          textAnchor={dx < 0 ? "start" : "start"}
        >
          {line}
        </text>
      ))}
    </g>
  );
};
