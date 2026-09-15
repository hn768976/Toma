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

/** Small 2D skeletal-formula marks scattered behind the strand in ref 11. */
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
      size: 26 + rand() * 42,
      rot: rand() * 360,
      drift: 0.01 + rand() * 0.02,
      phase: rand() * Math.PI * 2,
      rings: 1 + Math.floor(rand() * 3),
      tails: 1 + Math.floor(rand() * 3),
    }));
  }, [seed, count]);

  const hexPath = (cx: number, cy: number, r: number) => {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      return `${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`;
    });
    return `M${pts.join("L")}Z`;
  };

  return (
    <AbsoluteFill>
      {glyphs.map((g, i) => {
        const size = g.size * scale;
        return (
          <svg
            key={i}
            width={size * 3}
            height={size * 2}
            viewBox="0 0 90 60"
            style={{
              position: "absolute",
              left: `${g.x * 100}%`,
              top: `${(g.y + Math.sin(t * g.drift * 6 + g.phase) * 0.012) * 100}%`,
              transform: `rotate(${g.rot + Math.sin(t * 0.2 + g.phase) * 6}deg)`,
              opacity,
              overflow: "visible",
            }}
          >
            <g stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round">
              {Array.from({ length: g.rings }, (_, r) => (
                <React.Fragment key={r}>
                  <path d={hexPath(20 + r * 24, 30, 12)} />
                  <path d={hexPath(20 + r * 24, 30, 8)} opacity={0.5} />
                </React.Fragment>
              ))}
              {Array.from({ length: g.tails }, (_, k) => (
                <path
                  key={k}
                  d={`M${20 + g.rings * 24 - 12},${30 + k * 6 - 6} l14,${k % 2 ? 8 : -8} l14,0`}
                />
              ))}
            </g>
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};
