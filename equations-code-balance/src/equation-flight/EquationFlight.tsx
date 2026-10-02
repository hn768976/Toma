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
};

/**
 * Depth-of-field bands. Planes are grouped by distance into a handful of
 * layers and each layer is blurred once, instead of giving every plane its
 * own blur. A plane crossing a band edge cross-fades between the two layers
 * so its focus never jumps. Blur is in design px (4K).
 */
const BANDS = [
  { until: 560, blur: 34 }, // rushing past, very soft
  { until: 1250, blur: 11 },
  { until: 3500, blur: 0 }, // the sharp band
  { until: 5600, blur: 2.6 },
  { until: 8200, blur: 5.5 },
  { until: Infinity, blur: 10 },
];
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
  wobble: boolean;
}> = ({ p, camX, camY, u, opacity, wobble }) => {
  const { plane } = p;
  const tz = PERSPECTIVE - p.dist;
  const content =
    plane.kind === "formula" ? (
      <div
        style={{ fontSize: u(plane.fontSize), whiteSpace: "nowrap", lineHeight: 1 }}
        dangerouslySetInnerHTML={{ __html: FORMULA_HTML[plane.formula] }}
      />
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
        filter: wobble ? "url(#ef-wobble)" : undefined,
        padding: u(10),
      }}
    >
      {content}
    </div>
  );
};

export const EquationFlight: React.FC<EquationFlightProps> = ({ variant }) => {
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
      const fog = 1 - 0.5 * smoothstep(3500, FAR, dist);
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

  const rayCx = width * 0.53;
  const rayCy = height * 0.46;
  const rayR = width * 0.78;

  return (
    <AbsoluteFill style={{ background: pal.background, overflow: "hidden" }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          {/* Subtle hand-drawn wobble with a fixed seed. Applied per plane in
              the plane's own space, so it travels with the chalk. */}
          <filter id="ef-wobble" x="-5%" y="-10%" width="110%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency={0.035 / u(1)} numOctaves={2} seed={11} />
            <feDisplacementMap in="SourceGraphic" scale={u(3.2)} xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <GlowFilter id="ef-glow" base={u(1.6)} strength={[0.75, 0.42, 0.22]} />
          <GlowFilter id="ef-ray-glow" base={u(4)} strength={[0.5, 0.4, 0.35]} />
          <filter id="ef-ray-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={u(9)} />
          </filter>
        </defs>
      </svg>

      <AbsoluteFill style={{ transform: `rotate(${roll}deg) scale(1.04)`, color: pal.ink }}>
        {/* Speed streaks, drawn behind the planes. */}
        <svg width={width} height={height} style={{ position: "absolute", filter: `blur(${u(1.2)}px)` }}>
          {STREAKS.flatMap((s, i) => {
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
                  strokeOpacity={0.32 * o}
                  strokeWidth={u(s.w * clamp(PERSPECTIVE / dist, 0.4, 3))}
                  strokeLinecap="round"
                />
              );
            });
          })}
        </svg>

        {/* One layer per depth band, far to near. */}
        {layers
          .map((items, band) => ({ items, band }))
          .reverse()
          .map(({ items, band }) => {
            const blur = BANDS[band].blur;
            const filters: string[] = [];
            if (blur > 0) filters.push(`blur(${u(blur)}px)`);
            if (variant === "navy" && band >= 1 && band <= 4) filters.push("url(#ef-glow)");
            return (
              <AbsoluteFill
                key={band}
                style={{
                  perspective: u(PERSPECTIVE),
                  perspectiveOrigin: "50% 50%",
                  filter: filters.length ? filters.join(" ") : undefined,
                }}
              >
                {items.map(({ p, w }) => (
                  <Plane
                    key={p.key}
                    p={p}
                    camX={camX}
                    camY={camY}
                    u={u}
                    opacity={p.opacity * w}
                    wobble={band >= 1 && band <= 3}
                  />
                ))}
              </AbsoluteFill>
            );
          })}
      </AbsoluteFill>

      {/* Light rays: a flat overlay fanning from near the centre, one full
          turn per loop. Screen-blended so empty black stays black. */}
      <AbsoluteFill style={{ mixBlendMode: "screen", opacity: variant === "black" ? 0.34 : 0.4 }}>
        <svg width={width} height={height}>
          <defs>
            <radialGradient id="ef-ray-fade" cx={rayCx} cy={rayCy} r={rayR} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={pal.ray} stopOpacity={0.55} />
              <stop offset="0.08" stopColor={pal.ray} stopOpacity={0.32} />
              <stop offset="0.35" stopColor={pal.ray} stopOpacity={0.1} />
              <stop offset="0.7" stopColor={pal.ray} stopOpacity={0.025} />
              <stop offset="1" stopColor={pal.ray} stopOpacity={0} />
            </radialGradient>
            <radialGradient id="ef-core" cx={rayCx} cy={rayCy} r={width * 0.1} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={pal.ray} stopOpacity={0.35} />
              <stop offset="1" stopColor={pal.ray} stopOpacity={0} />
            </radialGradient>
          </defs>
          <g filter="url(#ef-ray-glow)">
          <g filter="url(#ef-ray-soft)" transform={`rotate(${phase * 360} ${rayCx} ${rayCy})`}>
            {RAYS.map((r, i) => {
              const a0 = ((r.angle - r.halfWidth) * Math.PI) / 180;
              const a1 = ((r.angle + r.halfWidth) * Math.PI) / 180;
              const len = rayR * r.length;
              return (
                <path
                  key={i}
                  d={`M${rayCx},${rayCy} L${rayCx + Math.cos(a0) * len},${rayCy + Math.sin(a0) * len} L${rayCx + Math.cos(a1) * len},${rayCy + Math.sin(a1) * len} Z`}
                  fill="url(#ef-ray-fade)"
                  fillOpacity={r.strength}
                />
              );
            })}
          </g>
          </g>
          <circle cx={rayCx} cy={rayCy} r={width * 0.1} fill="url(#ef-core)" />
        </svg>
      </AbsoluteFill>

      {variant === "navy" ? <Grain id="ef" seed={mod(frame, LOOP)} amount={0.02} /> : null}
    </AbsoluteFill>
  );
};
