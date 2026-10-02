import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import "../common/fonts";
import { Grain } from "../common/Grain";
import { GlowFilter } from "../common/GlowFilter";
import { clamp, loopPhase, mod, smoothstep, TAU } from "../common/math";
import { useUnit } from "../common/units";
import {
  BLOCK_DEPTH,
  BLOCKS,
  FAR,
  LOOP,
  NEAR,
  PERSPECTIVE,
  PLANES,
  RAYS,
  STREAKS,
  type PlaneSpec,
} from "./field";
import { FORMULA_HTML } from "./katex-cache";

export type EquationFlightProps = {
  variant: "black" | "navy";
  loopCheck?: boolean;
  /** Profiling only: comma list of features to switch off. */
  dbg?: string;
};

/**
 * Depth-of-field bands. Planes are grouped by distance into a handful of
 * layers and each layer is blurred once, instead of giving every plane its
 * own blur. A plane crossing a band edge cross-fades between the two layers
 * so its focus never jumps. Blur is in design px (4K).
 */
const BANDS = [
  { until: 900, blur: 40 }, // rushing past, very soft
  { until: 1750, blur: 14 },
  { until: 3900, blur: 0 }, // the sharp band
  { until: 5600, blur: 3 },
  { until: 7600, blur: 7.5 },
  { until: Infinity, blur: 13 },
];
const SHARP_BAND = 2;
const BAND_SOFTNESS = 0.09; // half-width of a cross-fade, in ln(distance)

const bandWeights = (dist: number): Array<[number, number]> => {
  const u = Math.log(dist);
  for (let i = 0; i < BANDS.length - 1; i++) {
    const edge = Math.log(BANDS[i].until);
    if (u < edge - BAND_SOFTNESS) return [[i, 1]];
    if (u < edge + BAND_SOFTNESS) {
      const t = smoothstep(edge - BAND_SOFTNESS, edge + BAND_SOFTNESS, u);
      return [
        [i, 1 - t],
        [i + 1, t],
      ];
    }
  }
  return [[BANDS.length - 1, 1]];
};


/** Same 1:4:12 glow built from CSS drop-shadows (profiling alternative). */
const glowCss = (u: (n: number) => number, color: string) => {
  const rgb = hexToRgb(color);
  return `drop-shadow(0 0 ${u(1.6)}px rgba(${rgb}, 0.6)) drop-shadow(0 0 ${u(6.4)}px rgba(${rgb}, 0.3)) drop-shadow(0 0 ${u(19)}px rgba(${rgb}, 0.18))`;
};

const hexToRgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");

/** Conic gradient with one soft wedge per ray; `turn` rotates the fan. */
const rayGradient = (color: string, turn: number, cx: number, cy: number) => {
  const rgb = hexToRgb(color);
  const stops: string[] = [];
  const sorted = [...RAYS].sort((a, b) => a.angle - b.angle);
  for (const r of sorted) {
    const soft = r.halfWidth * 1.6;
    stops.push(
      `rgba(${rgb}, 0) ${(r.angle - r.halfWidth - soft).toFixed(2)}deg`,
      `rgba(${rgb}, ${(0.55 * r.strength).toFixed(3)}) ${r.angle.toFixed(2)}deg`,
      `rgba(${rgb}, 0) ${(r.angle + r.halfWidth + soft).toFixed(2)}deg`,
    );
  }
  return (
    `radial-gradient(circle at ${cx}px ${cy}px, rgba(${rgb}, 0.45) 0px, rgba(${rgb}, 0) ${(cx * 0.2).toFixed(0)}px), ` +
    `conic-gradient(from ${turn.toFixed(3)}deg at ${cx}px ${cy}px, rgba(${rgb}, 0) 0deg, ${stops.join(", ")}, rgba(${rgb}, 0) 360deg)`
  );
};

/** Rays fade out with distance from their source; reach zero before the corners. */
const rayMask = (cx: number, cy: number, r: number) =>
  `radial-gradient(circle at ${cx}px ${cy}px, #000 0px, rgba(0,0,0,0.55) ${(r * 0.1).toFixed(0)}px, rgba(0,0,0,0.18) ${(r * 0.38).toFixed(0)}px, rgba(0,0,0,0.04) ${(r * 0.7).toFixed(0)}px, transparent ${r.toFixed(0)}px)`;

/** Soft blown-out light source: white-hot core, long smooth falloff. */
const bloomGradient = (color: string, cx: number, cy: number, w: number, h: number) => {
  const c = hexToRgb(color);
  return (
    `radial-gradient(ellipse ${w * 0.05}px ${h * 0.075}px at ${cx}px ${cy}px, rgba(${c}, 1) 0%, rgba(${c}, 0.85) 30%, rgba(${c}, 0.45) 60%, rgba(${c}, 0.15) 82%, rgba(${c}, 0) 100%), ` +
    `radial-gradient(ellipse ${w * 0.2}px ${h * 0.26}px at ${cx}px ${cy}px, rgba(${c}, 0.5) 0%, rgba(${c}, 0.3) 18%, rgba(${c}, 0.13) 42%, rgba(${c}, 0.04) 70%, rgba(${c}, 0) 100%)`
  );
};

type Placed = { plane: PlaneSpec; dist: number; key: string; opacity: number };

const PALETTE = {
  black: {
    ink: "#ffffff",
    background: "#000000",
    ray: "#ffffff",
  },
  navy: {
    ink: "#c4f3ff",
    background:
      "radial-gradient(ellipse 75% 80% at 53% 47%, #0d2a5c 0%, #081c44 38%, #04102b 72%, #020818 100%)",
    ray: "#9fe9ff",
  },
};

const Plane: React.FC<{
  p: Placed;
  camX: number;
  camY: number;
  u: (n: number) => number;
  opacity: number;
}> = ({ p, camX, camY, u, opacity }) => {
  const { plane } = p;
  const tz = PERSPECTIVE - p.dist;
  const content =
    plane.kind === "formula" ? (
      <div style={{ fontSize: u(plane.fontSize), WebkitTextStroke: `${u(plane.fontSize * 0.022)}px currentColor`, whiteSpace: "nowrap", lineHeight: 1, display: "flex", alignItems: "center", gap: u(plane.fontSize * 1.4) }}>
        {plane.formulas.map((f, i) => (
          <span key={i} dangerouslySetInnerHTML={{ __html: FORMULA_HTML[f] }} />
        ))}
        {plane.underline > 0 ? (
          <div
            style={{
              position: "absolute",
              left: `${-10 * plane.underline}%`,
              width: `${100 * plane.underline + 20}%`,
              bottom: u(-plane.fontSize * 0.35),
              height: u(Math.max(3, plane.fontSize * 0.07)),
              borderRadius: u(4),
              background: "currentColor",
              opacity: 0.85,
            }}
          />
        ) : null}
      </div>
    ) : (
      <svg
        width={u(plane.graph.w + 24)}
        height={u(plane.graph.h + 24)}
        viewBox={`-12 -12 ${plane.graph.w + 24} ${plane.graph.h + 24}`}
        style={{ overflow: "visible", display: "block" }}
      >
        {plane.graph.paths.map((g, i) => (
          <path
            key={i}
            d={g.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={g.width}
            strokeOpacity={g.opacity}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    );
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        opacity,
        transform:
          `translate3d(${u(plane.x - camX)}px, ${u(plane.y - camY)}px, ${u(tz)}px) ` +
          `rotateX(${plane.rotX}deg) rotateY(${plane.rotY}deg) rotateZ(${plane.rotZ}deg) ` +
          `translate(-50%, -50%)`,
        padding: u(10),
      }}
    >
      {content}
    </div>
  );
};

export const EquationFlight: React.FC<EquationFlightProps> = ({ variant, dbg = "" }) => {
  const off = (k: string) => dbg.split(",").includes(k);
  const frame = useCurrentFrame();
  const { u, width, height } = useUnit();
  const pal = PALETTE[variant];
  const phase = loopPhase(frame, LOOP);

  // Camera: travels exactly one block per loop; sway and roll are whole
  // sine cycles over the loop.
  const travel = phase * BLOCK_DEPTH;
  const camX = 150 * Math.sin(TAU * phase);
  const camY = 85 * Math.sin(TAU * 2 * phase + 0.7);
  const roll = 2.2 * Math.sin(TAU * phase + 1.3);

  // Place every copy of every plane along the view axis.
  const placed: Placed[] = [];
  for (const plane of PLANES) {
    const base = mod(plane.z - travel, BLOCK_DEPTH);
    for (let k = 0; k < BLOCKS; k++) {
      const dist = NEAR + base + k * BLOCK_DEPTH;
      // Fade in out of the darkness at the far end, fade out right before
      // the lens at the near end: nothing pops in or out.
      const farFade = smoothstep(FAR, FAR - 3200, dist);
      const nearFade = smoothstep(NEAR + 60, NEAR + 700, dist);
      // Atmospheric falloff: distant planes are dimmer.
      const fog = 1 - 0.3 * smoothstep(3300, FAR, dist);
      const opacity = farFade * nearFade * fog;
      if (opacity < 0.004) continue;
      placed.push({ plane, dist, key: `${plane.id}-${k}`, opacity });
    }
  }
  // Painter's order: far to near.
  placed.sort((a, b) => b.dist - a.dist);

  const layers: Array<Array<{ p: Placed; w: number }>> = BANDS.map(() => []);
  for (const p of placed) {
    for (const [band, w] of bandWeights(p.dist)) {
      if (w > 0.002) layers[band].push({ p, w });
    }
  }

  // Projection used for 2D overlays (streaks), identical to the CSS one.
  const cx = width / 2;
  const cy = height / 2;
  const project = (x: number, y: number, dist: number) => [
    cx + u((x - camX) * (PERSPECTIVE / dist)),
    cy + u((y - camY) * (PERSPECTIVE / dist)),
  ];

  const rayCx = width * 0.8;
  const rayCy = height * 0.48;
  const rayR = width * 0.9;

  return (
    <AbsoluteFill style={{ background: pal.background, overflow: "hidden" }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          {/* Subtle hand-drawn wobble with a fixed seed, one pass over the
              sharp band. Static in frame space, so lines shimmer very slightly
              as they travel, like chalk under moving light. */}
          <filter id="ef-wobble" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency={0.035 / u(1)} numOctaves={2} seed={11} />
            <feDisplacementMap in="SourceGraphic" scale={u(3.2)} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <GlowFilter id="ef-glow" base={u(1.6)} strength={[0.75, 0.42, 0.22]} margin={0} />
        </defs>
      </svg>

      <AbsoluteFill style={{ transform: `rotate(${roll}deg) scale(1.04)`, color: pal.ink }}>
        {/* Speed streaks, drawn behind the planes. */}
        <svg width={width} height={height} style={{ position: "absolute", filter: `blur(${u(1.2)}px)` }}>
          {off("streaks") ? null : STREAKS.flatMap((s, i) => {
            const base = mod(s.z - travel, BLOCK_DEPTH);
            return Array.from({ length: BLOCKS }, (_, k) => {
              const dist = NEAR + base + k * BLOCK_DEPTH;
              const tail = dist + s.len;
              const o = smoothstep(FAR, FAR - 3500, tail) * smoothstep(NEAR + 80, NEAR + 900, dist);
              if (o < 0.01) return null;
              const [x0, y0] = project(s.x, s.y, dist);
              const [x1, y1] = project(s.x, s.y, tail);
              return (
                <line
                  key={`${i}-${k}`}
                  x1={x0}
                  y1={y0}
                  x2={x1}
                  y2={y1}
                  stroke={pal.ink}
                  strokeOpacity={0.2 * o}
                  strokeWidth={u(s.w * clamp(PERSPECTIVE / dist, 0.4, 3))}
                  strokeLinecap="round"
                />
              );
            });
          })}
        </svg>

        {/* One layer per depth band, far to near. Each band is blurred once
            as a whole. The sharp band gets the hand-drawn wobble, and in the
            navy version the middle bands share a single glow pass. */}
        {(() => {
          const renderBand = (band: number) => {
            const blur = BANDS[band].blur;
            const filters: string[] = [];
            if (blur > 0 && !off("blur")) filters.push(`blur(${u(blur)}px)`);
            if (band === SHARP_BAND && !off("wobble")) filters.push("url(#ef-wobble)");
            return (
              <AbsoluteFill
                key={band}
                style={{
                  perspective: u(PERSPECTIVE),
                  perspectiveOrigin: "50% 50%",
                  filter: filters.length ? filters.join(" ") : undefined,
                }}
              >
                {layers[band].map(({ p, w }) => (
                  <Plane key={p.key} p={p} camX={camX} camY={camY} u={u} opacity={p.opacity * w} />
                ))}
              </AbsoluteFill>
            );
          };
          const far = [5];
          const glowing = [4, 3, 2, 1];
          const near = [0];
          return (
            <>
              {far.map(renderBand)}
              <AbsoluteFill style={{ filter: variant === "navy" && !off("glow") ? (off("svgglow") ? glowCss(u, pal.ink) : "url(#ef-glow)") : undefined }}>
                {glowing.map(renderBand)}
              </AbsoluteFill>
              {near.map(renderBand)}
            </>
          );
        })()}
      </AbsoluteFill>

      {/* Light rays: a flat overlay fanning from near the centre, one full
          turn per loop. Each ray is a soft-edged wedge of a conic gradient
          (no blur filter needed), faded with distance by a radial mask.
          Screen-blended so empty black stays black. */}
      {/* The light source the rays fan from: a large blown-out bloom, right of
          centre. A radial gradient that reaches zero well inside the frame. */}
      <AbsoluteFill
        style={{
          mixBlendMode: "screen",
          background: bloomGradient(pal.ray, rayCx, rayCy, width, height),
        }}
      />
      {off("rays") ? null : (
        <AbsoluteFill
          style={{
            mixBlendMode: "screen",
            opacity: variant === "black" ? 0.42 : 0.46,
            background: rayGradient(pal.ray, phase * 360, rayCx, rayCy),
            WebkitMaskImage: rayMask(rayCx, rayCy, rayR),
            maskImage: rayMask(rayCx, rayCy, rayR),
          }}
        />
      )}

      {variant === "navy" && !off("grain") ? <Grain id="ef" seed={mod(frame, LOOP)} amount={0.02} /> : null}
    </AbsoluteFill>
  );
};
