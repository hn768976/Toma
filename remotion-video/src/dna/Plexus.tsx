import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { mulberry32 } from "./random";

export type PlexusProps = {
  frame: number;
  fps: number;
  seed: number;
  nodes: number;
  /** Fraction of frame width within which two nodes are linked. */
  linkDistance: number;
  color: string;
  lineOpacity?: number;
  dotOpacity?: number;
  dotRadius?: number;
  strokeWidth?: number;
  speed?: number;
  scale: number;
};

/**
 * A drifting point network drawn in SVG rather than in three, so it costs
 * almost nothing per frame and stays crisp at 4K. Node motion is a closed loop
 * of sines, which keeps the field lively without any state between frames.
 */
export const Plexus: React.FC<PlexusProps> = ({
  frame,
  fps,
  seed,
  nodes,
  linkDistance,
  color,
  lineOpacity = 0.3,
  dotOpacity = 0.8,
  dotRadius = 2,
  strokeWidth = 1,
  speed = 1,
  scale,
}) => {
  const t = (frame / fps) * speed;

  const seeds = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: nodes }, () => ({
      x: rand(),
      y: rand(),
      ax: 0.02 + rand() * 0.05,
      ay: 0.02 + rand() * 0.05,
      px: rand() * Math.PI * 2,
      py: rand() * Math.PI * 2,
      fx: 0.1 + rand() * 0.22,
      fy: 0.1 + rand() * 0.22,
      r: 0.5 + rand(),
    }));
  }, [seed, nodes]);

  const points = seeds.map((s) => ({
    x: s.x + Math.sin(t * s.fx + s.px) * s.ax,
    y: s.y + Math.cos(t * s.fy + s.py) * s.ay,
    r: s.r,
  }));

  const links: { a: number; b: number; strength: number }[] = [];
  // 16:9 aspect correction so links look round rather than stretched.
  const aspect = 16 / 9;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = (points[i].x - points[j].x) * aspect;
      const dy = points[i].y - points[j].y;
      const d = Math.hypot(dx, dy);
      if (d < linkDistance) {
        links.push({ a: i, b: j, strength: 1 - d / linkDistance });
      }
    }
  }

  return (
    <AbsoluteFill>
      <svg
        viewBox="0 0 1000 562.5"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%" }}
      >
        <g stroke={color} strokeWidth={strokeWidth * scale} fill="none">
          {links.map((l, i) => (
            <line
              key={i}
              x1={points[l.a].x * 1000}
              y1={points[l.a].y * 562.5}
              x2={points[l.b].x * 1000}
              y2={points[l.b].y * 562.5}
              opacity={l.strength * lineOpacity}
            />
          ))}
        </g>
        <g fill={color}>
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x * 1000}
              cy={p.y * 562.5}
              r={dotRadius * p.r * scale}
              opacity={dotOpacity}
            />
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export type MoleculeGlyphsProps = {
  frame: number;
  fps: number;
  seed: number;
  count: number;
  color: string;
  opacity?: number;
  scale: number;
};

/**
 * Real skeletal formulae, drawn on a 100x60 grid.
 *
 * Each entry is a genuine structure rather than decorative ring shapes: bonds
 * are drawn as line segments, `double` marks a parallel inner line, and
 * `labels` places heteroatom symbols where chemistry would show them. Vertices
 * that carry no label are implicit carbons, as in standard notation.
 */
type Formula = {
  name: string;
  bonds: [number, number, number, number][];
  double?: [number, number, number, number][];
  labels?: { x: number; y: number; t: string }[];
};

const ring = (
  cx: number,
  cy: number,
  r: number,
  rot = 0,
): [number, number][] =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + rot;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as [number, number];
  });

const ringBonds = (
  pts: [number, number][],
): [number, number, number, number][] =>
  pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return [p[0], p[1], q[0], q[1]] as [number, number, number, number];
  });

/** Alternating double bonds inside an aromatic ring. */
const aromatic = (
  pts: [number, number][],
  inset = 0.78,
): [number, number, number, number][] => {
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < pts.length; i += 2) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    out.push([
      cx + (p[0] - cx) * inset,
      cy + (p[1] - cy) * inset,
      cx + (q[0] - cx) * inset,
      cy + (q[1] - cy) * inset,
    ]);
  }
  return out;
};

const benzene = ring(30, 30, 13);
const phenol = ring(28, 30, 13);
const pyrimidine = ring(30, 30, 13);
const imidazole: [number, number][] = [
  [52, 22],
  [64, 26],
  [64, 38],
  [52, 42],
  [45, 32],
];

const FORMULAS: Formula[] = [
  {
    // Ethanol
    name: "ethanol",
    bonds: [
      [14, 40, 30, 30],
      [30, 30, 46, 40],
    ],
    labels: [{ x: 50, y: 44, t: "OH" }],
  },
  {
    // Acetic acid
    name: "acetic acid",
    bonds: [
      [12, 40, 28, 30],
      [28, 30, 44, 40],
      [28, 30, 28, 14],
    ],
    double: [[31, 30, 31, 15]],
    labels: [
      { x: 25, y: 12, t: "O" },
      { x: 48, y: 44, t: "OH" },
    ],
  },
  {
    // Benzene
    name: "benzene",
    bonds: ringBonds(benzene),
    double: aromatic(benzene),
  },
  {
    // Phenol
    name: "phenol",
    bonds: [...ringBonds(phenol), [41, 23, 55, 15]],
    double: aromatic(phenol),
    labels: [{ x: 58, y: 14, t: "OH" }],
  },
  {
    // Pyrimidine — the ring the DNA bases are built on
    name: "pyrimidine",
    bonds: ringBonds(pyrimidine),
    double: aromatic(pyrimidine),
    labels: [
      { x: 40, y: 20, t: "N" },
      { x: 40, y: 46, t: "N" },
    ],
  },
  {
    // Purine — fused pyrimidine + imidazole, the adenine/guanine skeleton
    name: "purine",
    bonds: [...ringBonds(ring(30, 32, 13)), ...ringBonds(imidazole)],
    double: aromatic(ring(30, 32, 13)),
    labels: [
      { x: 40, y: 22, t: "N" },
      { x: 40, y: 48, t: "N" },
      { x: 66, y: 24, t: "N" },
      { x: 66, y: 42, t: "N" },
    ],
  },
  {
    // Glycine
    name: "glycine",
    bonds: [
      [12, 32, 28, 40],
      [28, 40, 44, 32],
      [44, 32, 44, 16],
    ],
    double: [[47, 32, 47, 17]],
    labels: [
      { x: 4, y: 30, t: "H2N" },
      { x: 41, y: 14, t: "O" },
      { x: 48, y: 46, t: "OH" },
    ],
  },
  {
    // Isopropyl alcohol
    name: "propan-2-ol",
    bonds: [
      [10, 40, 26, 30],
      [26, 30, 42, 40],
      [26, 30, 26, 14],
    ],
    labels: [{ x: 22, y: 12, t: "OH" }],
  },
];

/** Real skeletal-formula marks drifting behind the strand in ref 11. */
export const MoleculeGlyphs: React.FC<MoleculeGlyphsProps> = ({
  frame,
  fps,
  seed,
  count,
  color,
  opacity = 0.3,
  scale,
}) => {
  const t = frame / fps;
  const glyphs = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      x: rand(),
      y: rand(),
      size: 44 + rand() * 46,
      rot: (rand() - 0.5) * 40,
      drift: 0.01 + rand() * 0.02,
      phase: rand() * Math.PI * 2,
      formula: FORMULAS[Math.floor(rand() * FORMULAS.length)],
    }));
  }, [seed, count]);

  return (
    <AbsoluteFill>
      {glyphs.map((g, i) => {
        const f = g.formula;
        const size = g.size * scale;
        return (
          <svg
            key={i}
            width={size * 1.7}
            height={size}
            viewBox="0 0 100 60"
            style={{
              position: "absolute",
              left: `${g.x * 100}%`,
              top: `${(g.y + Math.sin(t * g.drift * 6 + g.phase) * 0.012) * 100}%`,
              transform: `rotate(${g.rot + Math.sin(t * 0.2 + g.phase) * 4}deg)`,
              opacity,
              overflow: "visible",
            }}
          >
            <g
              stroke={color}
              strokeWidth={1.9}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {f.bonds.map((b, k) => (
                <line key={`b${k}`} x1={b[0]} y1={b[1]} x2={b[2]} y2={b[3]} />
              ))}
              {(f.double ?? []).map((b, k) => (
                <line
                  key={`d${k}`}
                  x1={b[0]}
                  y1={b[1]}
                  x2={b[2]}
                  y2={b[3]}
                  strokeWidth={1.3}
                />
              ))}
            </g>
            {(f.labels ?? []).map((l, k) => (
              <text
                key={`l${k}`}
                x={l.x}
                y={l.y}
                fill={color}
                fontSize={12}
                fontFamily="DnaHudSans, sans-serif"
                dominantBaseline="middle"
              >
                {l.t}
              </text>
            ))}
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};
