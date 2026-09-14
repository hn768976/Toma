import React, { useMemo } from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import type { Look } from "../looks";

/** Everything here scales with resolution so 1080p and 4K match exactly. */
export const useScale = () => {
  const { width } = useVideoConfig();
  return width / 1920;
};

export const Backdrop: React.FC<{ look: Look }> = ({ look }) => (
  <AbsoluteFill style={{ background: look.bg.css }} />
);

/** Additive backlight behind the hero. */
export const Bloom: React.FC<{ look: Look }> = ({ look }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const b = look.bloom;
  const pulse = 1 + Math.sin(t * 0.6) * b.pulse;

  return (
    <AbsoluteFill
      style={{
        mixBlendMode: "screen",
        opacity: b.opacity * pulse,
        background: `radial-gradient(${b.size * pulse}% ${b.size * pulse * 1.1}% at ${b.x}% ${b.y}%, ${b.color} 0%, transparent 70%)`,
      }}
    />
  );
};

/** Foreground out-of-focus blobs. These are pure bokeh — CSS renders them
 *  better and far cheaper than a third WebGL context would. */
export const NearBokeh: React.FC<{ look: Look }> = ({ look }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = useScale();
  const t = frame / fps;
  const n = look.near;

  const blobs = useMemo(
    () =>
      new Array(n.count).fill(0).map((_, i) => {
        const r = (k: string) => random(`near-${look.id}-${i}-${k}`);
        return {
          x: r("x") * 110 - 5,
          y: r("y") * 110 - 5,
          size: n.size[0] + r("s") * (n.size[1] - n.size[0]),
          phase: r("p") * Math.PI * 2,
          speed: 0.12 + r("v") * 0.18,
        };
      }),
    [look.id, n.count, n.size],
  );

  return (
    <AbsoluteFill style={{ filter: `blur(${n.blur * s}px)`, opacity: n.opacity }}>
      {blobs.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${b.x + Math.sin(t * b.speed + b.phase) * n.drift * 6}%`,
            top: `${b.y + Math.cos(t * b.speed * 0.8 + b.phase) * n.drift * 5}%`,
            width: b.size * s,
            height: b.size * s,
            borderRadius: "50%",
            background: `radial-gradient(circle at 38% 34%, ${n.color} 0%, ${n.color} 55%, transparent 72%)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/** Floating specks / particulate in the medium. */
export const Dust: React.FC<{ look: Look }> = ({ look }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = useScale();
  const t = frame / fps;
  const d = look.dust;

  const specks = useMemo(
    () =>
      new Array(d.count).fill(0).map((_, i) => {
        const r = (k: string) => random(`dust-${look.id}-${i}-${k}`);
        return {
          x: r("x") * 100,
          y: r("y") * 100,
          size: d.size[0] + r("s") * (d.size[1] - d.size[0]),
          phase: r("p") * Math.PI * 2,
          speed: 0.2 + r("v") * 0.5,
          depth: 0.35 + r("d") * 0.65,
        };
      }),
    [look.id, d.count, d.size],
  );

  return (
    <AbsoluteFill style={{ opacity: d.opacity, mixBlendMode: "screen" }}>
      {specks.map((p, i) => {
        const tw =
          1 - d.twinkle * 0.5 + Math.sin(t * p.speed * 3 + p.phase) * d.twinkle * 0.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(p.x + Math.sin(t * p.speed * 0.4 + p.phase) * d.drift * 4) % 100}%`,
              top: `${(p.y + t * d.drift * p.depth * 1.6) % 100}%`,
              width: p.size * s * p.depth * 2,
              height: p.size * s * p.depth * 2,
              borderRadius: "50%",
              background: d.color,
              opacity: tw * p.depth,
              filter: `blur(${(1 - p.depth) * 3 * s}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Low-poly connection graph used by the two macro "data" looks. */
export const NetworkGraph: React.FC<{ look: Look }> = ({ look }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = useScale();
  const t = frame / fps;
  const net = look.network;

  const nodes = useMemo(
    () =>
      new Array(net.nodes).fill(0).map((_, i) => {
        const r = (k: string) => random(`net-${look.id}-${i}-${k}`);
        return {
          x: 30 + r("x") * 78,
          y: r("y") * 100,
          phase: r("p") * Math.PI * 2,
          speed: 0.05 + r("v") * 0.09,
        };
      }),
    [look.id, net.nodes],
  );

  const dashes = useMemo(
    () =>
      new Array(net.dashes).fill(0).map((_, i) => {
        const r = (k: string) => random(`dash-${look.id}-${i}-${k}`);
        return {
          x: 34 + r("x") * 62,
          y: r("y") * 100,
          w: 10 + r("w") * 26,
          phase: r("p") * Math.PI * 2,
          speed: 0.3 + r("v") * 0.6,
        };
      }),
    [look.id, net.dashes],
  );

  if (!net.enabled) return null;

  const pts = nodes.map((n) => ({
    x: ((n.x + Math.sin(t * n.speed + n.phase) * 1.4) / 100) * width,
    y: ((n.y + Math.cos(t * n.speed * 0.9 + n.phase) * 1.6) / 100) * height,
  }));

  const links: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x;
      const dy = pts[i].y - pts[j].y;
      if (Math.hypot(dx, dy) < width * 0.22) links.push([i, j]);
    }
  }

  return (
    <AbsoluteFill style={{ opacity: net.opacity }}>
      <svg width={width} height={height} style={{ position: "absolute" }}>
        {links.map(([a, b], i) => (
          <line
            key={i}
            x1={pts[a].x}
            y1={pts[a].y}
            x2={pts[b].x}
            y2={pts[b].y}
            stroke={net.color}
            strokeWidth={1 * s}
          />
        ))}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.2 * s} fill={net.color} />
        ))}
      </svg>
      {dashes.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: d.w * s,
            height: 2 * s,
            background: net.dashColor,
            opacity: 0.35 + 0.65 * Math.abs(Math.sin(t * d.speed + d.phase)),
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ look: Look }> = ({ look }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(115% 105% at 50% 50%, transparent 38%, ${look.bg.vignetteColor} 100%)`,
      opacity: look.bg.vignette,
    }}
  />
);

/** Frame-deterministic film grain. */
export const Grain: React.FC<{ look: Look }> = ({ look }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = useScale();
  if (look.bg.grain <= 0) return null;

  // A new seed per frame keeps the grain alive without any non-deterministic
  // source: the seed is a pure function of the frame number.
  const seed = Math.floor(random(`grain-${frame}`) * 1000);

  return (
    <AbsoluteFill style={{ opacity: look.bg.grain, mixBlendMode: "overlay" }}>
      <svg width={width} height={height}>
        <filter id={`grain-${frame}`}>
          <feTurbulence
            type="fractalNoise"
            // baseFrequency is in pixels, so it has to scale with the
            // composition or 4K would get half-size grain relative to frame.
            baseFrequency={0.8 / s}
            numOctaves={2}
            seed={seed}
          />
        </filter>
        <rect width={width} height={height} filter={`url(#grain-${frame})`} />
      </svg>
    </AbsoluteFill>
  );
};
