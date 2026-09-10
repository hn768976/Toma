import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import {
  DURATION_IN_FRAMES,
  HUB_DISC_RADIUS,
  HUB_INNER_RADIUS,
  HUB_INNER_STROKE,
  HUB_OUTER_RADIUS,
  HUB_OUTER_STROKE,
  HUB_TICK_COUNT,
  HUB_TICK_INNER,
  HUB_TICK_OUTER,
  INNER_DASH_TURNS,
  MARK_SCALE,
  OUTER_ARC_TURNS,
  PULSE_TRAVEL,
  SWAY_DEGREES,
  THEMES,
  TICK_BAND_TURNS,
} from "./constants";
import { NETWORK } from "./network";
import { DOT_GROUPS, DRIFT_DOTS, SHIMMER_CYCLES } from "./halftone";
import { ICONS, ICON_STROKE_WIDTH } from "./icons";
import { MARK_CENTER_X, MARK_CENTER_Y, MARK_PATH } from "./ai-mark";
import { Grain } from "./Grain";

const TAU = Math.PI * 2;

export const aiHubSchema = z.object({
  variant: z.enum(["blue", "teal"]),
});

export type AIHubProps = z.infer<typeof aiHubSchema>;

// --- static geometry, built once ------------------------------------

const TICKS = (() => {
  const parts: string[] = [];
  for (let i = 0; i < HUB_TICK_COUNT; i++) {
    const a = (i / HUB_TICK_COUNT) * TAU;
    const long = i % 7 === 0;
    const r1 = long ? HUB_TICK_INNER - 0.0045 : HUB_TICK_INNER;
    const c = Math.cos(a);
    const s = Math.sin(a);
    parts.push(
      `M ${(c * r1).toFixed(4)} ${(s * r1).toFixed(4)} L ${(c * HUB_TICK_OUTER).toFixed(4)} ${(s * HUB_TICK_OUTER).toFixed(4)}`,
    );
  }
  return parts.join(" ");
})();

const arc = (r: number, fromDeg: number, toDeg: number) => {
  const a0 = (fromDeg * Math.PI) / 180;
  const a1 = (toDeg * Math.PI) / 180;
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${(Math.cos(a0) * r).toFixed(4)} ${(Math.sin(a0) * r).toFixed(4)} A ${r} ${r} 0 ${large} 1 ${(Math.cos(a1) * r).toFixed(4)} ${(Math.sin(a1) * r).toFixed(4)}`;
};

// Three bright segments riding the thin outer ring; they are what makes
// its rotation readable, since a plain circle turning looks static.
const OUTER_ARCS = [0, 120, 240]
  .map((d) => arc(HUB_OUTER_RADIUS, d - 13, d + 13))
  .join(" ");

const INNER_CIRCUMFERENCE = TAU * HUB_INNER_RADIUS;
const INNER_DASH = `${(INNER_CIRCUMFERENCE / 60) * 0.62} ${(INNER_CIRCUMFERENCE / 60) * 0.38}`;

// --- helpers ---------------------------------------------------------

const easeInOut = (x: number) => x * x * (3 - 2 * x);

/** Pulse phase for a node at `t` (loop position, 0..1). */
const pulsePhase = (trips: number, offset: number, t: number) => {
  const p = (t * trips + offset) % 1;
  return p < 0 ? p + 1 : p;
};

// --- component -------------------------------------------------------

export const AIHubNetwork: React.FC<AIHubProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const theme = THEMES[variant];

  const aspect = width / height;
  const halfW = aspect / 2;
  const t = frame / DURATION_IN_FRAMES;

  // Felt, not watched: one slow there-and-back sway across the loop.
  const sway = SWAY_DEGREES * Math.sin(TAU * t);
  // Scale breath stays at or above 1 so shrinking never exposes an edge.
  const breath = 1.01 + 0.01 * Math.sin(TAU * t + Math.PI / 3);

  const markShift = 9 * Math.sin(TAU * t);
  const markScale = MARK_SCALE;

  const tierNodes: [typeof NETWORK, typeof NETWORK, typeof NETWORK] = [
    [],
    [],
    [],
  ];
  for (const node of NETWORK) tierNodes[node.blurTier].push(node);

  const renderNode = (node: (typeof NETWORK)[number]) => {
    const p = pulsePhase(node.pulseTrips, node.pulsePhase, t);
    // Arrival flash: rises over the last sliver of the travel window and
    // decays fast enough to be back near zero before the pulse re-fires.
    const attack = easeInOut(
      Math.max(0, Math.min(1, (p - (PULSE_TRAVEL - 0.03)) / 0.03)),
    );
    const decay = p >= PULSE_TRAVEL ? Math.exp(-14 * (p - PULSE_TRAVEL)) : 1;
    const flash = p < PULSE_TRAVEL - 0.03 ? 0 : attack * decay;

    const cx = Math.cos(node.angle) * node.radius;
    const cy = Math.sin(node.angle) * node.radius;
    const icon = ICONS[node.iconIndex];
    const iconColor =
      node.colorSlot === 0
        ? theme.iconPrimary
        : node.colorSlot === 1
          ? theme.iconAccent
          : theme.iconAlt;
    const s = (node.size * 1.42) / 24;

    return (
      <g
        key={node.index}
        transform={`translate(${cx.toFixed(5)} ${cy.toFixed(5)})`}
      >
        <circle r={node.size} fill={theme.field} opacity={0.82} />
        <circle
          r={node.size}
          fill="none"
          stroke={theme.line}
          strokeWidth={0.0026 + flash * 0.0014}
          opacity={0.62 + flash * 0.38}
        />
        <g
          transform={`translate(${(-12 * s).toFixed(6)} ${(-12 * s).toFixed(6)}) scale(${s.toFixed(6)})`}
          opacity={0.88 + flash * 0.12}
        >
          {icon.stroke.map((d, i) => (
            <path
              key={`s${i}`}
              d={d}
              fill="none"
              stroke={iconColor}
              strokeWidth={ICON_STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {icon.solid?.map((d, i) => (
            <path
              key={`f${i}`}
              d={d}
              fill={iconColor}
              fillRule={icon.solidRule ?? "nonzero"}
            />
          ))}
        </g>
      </g>
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: theme.field, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${breath})` }}>
        <svg
          width={width}
          height={height}
          viewBox={`${-halfW} -0.5 ${aspect} 1`}
          style={{ display: "block" }}
        >
          <defs>
            <radialGradient id="fieldGlow">
              <stop
                offset="0%"
                stopColor={theme.fieldGlow}
                stopOpacity="0.55"
              />
              <stop
                offset="45%"
                stopColor={theme.fieldGlow}
                stopOpacity="0.22"
              />
              <stop offset="100%" stopColor={theme.fieldGlow} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="discFill">
              <stop
                offset="0%"
                stopColor={theme.fieldGlow}
                stopOpacity="0.72"
              />
              <stop offset="70%" stopColor={theme.field} stopOpacity="0.96" />
              <stop offset="100%" stopColor={theme.field} stopOpacity="0.99" />
            </radialGradient>
            <linearGradient
              id="markGradient"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="2"
              x2="0"
              y2="88"
              gradientTransform={`translate(0 ${markShift.toFixed(3)})`}
            >
              <stop offset="0%" stopColor={theme.markStops[0]} />
              <stop offset="52%" stopColor={theme.markStops[1]} />
              <stop offset="100%" stopColor={theme.markStops[2]} />
            </linearGradient>

            {NETWORK.map((node) => {
              const c = Math.cos(node.angle);
              const s = Math.sin(node.angle);
              return (
                <linearGradient
                  key={node.index}
                  id={`spoke${node.index}`}
                  gradientUnits="userSpaceOnUse"
                  x1={(c * node.spokeStart).toFixed(5)}
                  y1={(s * node.spokeStart).toFixed(5)}
                  x2={(c * node.spokeEnd).toFixed(5)}
                  y2={(s * node.spokeEnd).toFixed(5)}
                >
                  <stop offset="0%" stopColor={theme.line} stopOpacity="0.95" />
                  <stop offset="55%" stopColor={theme.line} stopOpacity="0.5" />
                  <stop
                    offset="100%"
                    stopColor={theme.line}
                    stopOpacity="0.16"
                  />
                </linearGradient>
              );
            })}

            {/* Bloom is deliberately limited to the hub, the mark and the
                pulse heads - letting it onto the spokes or the icons
                would fog exactly the detail the clip is sold on. */}
            <filter
              id="bloomHub"
              x="-120%"
              y="-120%"
              width="340%"
              height="340%"
            >
              <feGaussianBlur stdDeviation="0.014" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter
              id="bloomMark"
              x="-140%"
              y="-140%"
              width="380%"
              height="380%"
            >
              <feGaussianBlur stdDeviation="0.0072" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter
              id="bloomPulse"
              x="-200%"
              y="-200%"
              width="500%"
              height="500%"
            >
              <feGaussianBlur stdDeviation="0.005" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="lineGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="0.0035" />
            </filter>
            {/* Mild depth only: the outermost nodes go slightly soft.
                This is a flat graphic, not a photographic scene. */}
            <filter id="dof1" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.0006" />
            </filter>
            <filter id="dof2" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.0013" />
            </filter>
            <filter id="dotBlur" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="0.008" />
            </filter>
          </defs>

          {/* Background: broad lift behind the hub, then the halftone. */}
          <rect
            x={-halfW}
            y={-0.5}
            width={aspect}
            height={1}
            fill={theme.field}
          />
          <ellipse
            cx={0}
            cy={0}
            rx={halfW * 1.05}
            ry={0.62}
            fill="url(#fieldGlow)"
          />

          {DOT_GROUPS.map((d, i) => {
            const shimmer =
              0.72 +
              0.28 *
                Math.sin(TAU * (t * SHIMMER_CYCLES[i] + i / DOT_GROUPS.length));
            return (
              <path
                key={i}
                d={d}
                fill={theme.halftone}
                opacity={0.88 * shimmer}
              />
            );
          })}

          <g filter="url(#dotBlur)">
            {DRIFT_DOTS.map((dot, i) => (
              <circle
                key={i}
                cx={
                  dot.x + dot.ax * Math.sin(TAU * (t * dot.cyclesX + dot.phase))
                }
                cy={
                  dot.y + dot.ay * Math.cos(TAU * (t * dot.cyclesY + dot.phase))
                }
                r={dot.r}
                fill={theme.line}
                opacity={dot.opacity}
              />
            ))}
          </g>

          {/* Everything below sways together as one assembly. */}
          <g transform={`rotate(${sway.toFixed(4)})`}>
            {/* Spokes: a soft glow pass under a crisp line pass, so the
                lines still read as lines. */}
            <g filter="url(#lineGlow)" opacity={0.55}>
              {NETWORK.map((node) => (
                <line
                  key={node.index}
                  x1={Math.cos(node.angle) * node.spokeStart}
                  y1={Math.sin(node.angle) * node.spokeStart}
                  x2={Math.cos(node.angle) * node.spokeEnd}
                  y2={Math.sin(node.angle) * node.spokeEnd}
                  stroke={`url(#spoke${node.index})`}
                  strokeWidth={0.005}
                />
              ))}
            </g>
            {NETWORK.map((node) => (
              <line
                key={node.index}
                x1={Math.cos(node.angle) * node.spokeStart}
                y1={Math.sin(node.angle) * node.spokeStart}
                x2={Math.cos(node.angle) * node.spokeEnd}
                y2={Math.sin(node.angle) * node.spokeEnd}
                stroke={`url(#spoke${node.index})`}
                strokeWidth={0.0022}
              />
            ))}

            {/* Pulse heads travelling hub -> node, each an integer number
                of trips per loop. */}
            <g filter="url(#bloomPulse)">
              {NETWORK.map((node) => {
                const p = pulsePhase(node.pulseTrips, node.pulsePhase, t);
                if (p >= PULSE_TRAVEL) return null;
                const travel = easeInOut(p / PULSE_TRAVEL);
                const fade = Math.min(
                  1,
                  (1 - p / PULSE_TRAVEL) * 8,
                  (p / PULSE_TRAVEL) * 14,
                );
                const c = Math.cos(node.angle);
                const s = Math.sin(node.angle);
                const span = node.spokeEnd - node.spokeStart;
                return (
                  <g key={node.index}>
                    {[0, 1, 2, 3, 4].map((k) => {
                      const r = Math.max(
                        node.spokeStart,
                        node.spokeStart + span * travel - k * 0.011,
                      );
                      return (
                        <circle
                          key={k}
                          cx={c * r}
                          cy={s * r}
                          r={0.0044 - k * 0.0007}
                          fill={k === 0 ? "#ffffff" : theme.line}
                          opacity={fade * (k === 0 ? 0.95 : 0.5 - k * 0.1)}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>

            {/* Icon nodes, in three softness tiers. */}
            <g>{tierNodes[0].map(renderNode)}</g>
            <g filter="url(#dof1)">{tierNodes[1].map(renderNode)}</g>
            <g filter="url(#dof2)">{tierNodes[2].map(renderNode)}</g>

            {/* The hub, drawn last so it stays the dominant centre. */}
            <g filter="url(#bloomHub)">
              <circle r={HUB_DISC_RADIUS} fill="url(#discFill)" />
              <circle
                r={HUB_OUTER_RADIUS}
                fill="none"
                stroke={theme.line}
                strokeWidth={HUB_OUTER_STROKE}
                opacity={0.72}
              />
              <g
                transform={`rotate(${(OUTER_ARC_TURNS * t * 360).toFixed(3)})`}
              >
                <path
                  d={OUTER_ARCS}
                  fill="none"
                  stroke={theme.line}
                  strokeWidth={HUB_OUTER_STROKE * 2.1}
                  strokeLinecap="round"
                  opacity={0.95}
                />
              </g>
              <g
                transform={`rotate(${(TICK_BAND_TURNS * t * 360).toFixed(3)})`}
              >
                <path
                  d={TICKS}
                  fill="none"
                  stroke={theme.line}
                  strokeWidth={0.0014}
                  opacity={0.5}
                />
              </g>
              <circle
                r={HUB_INNER_RADIUS}
                fill="none"
                stroke={theme.line}
                strokeWidth={HUB_INNER_STROKE}
                opacity={0.5}
              />
              <g
                transform={`rotate(${(INNER_DASH_TURNS * t * 360).toFixed(3)})`}
              >
                <circle
                  r={HUB_INNER_RADIUS}
                  fill="none"
                  stroke={theme.line}
                  strokeWidth={HUB_INNER_STROKE}
                  strokeDasharray={INNER_DASH}
                  opacity={0.9}
                />
              </g>
            </g>

            <g filter="url(#bloomMark)">
              <g
                transform={`scale(${markScale}) translate(${-MARK_CENTER_X} ${-MARK_CENTER_Y})`}
              >
                <path
                  d={MARK_PATH}
                  fill="url(#markGradient)"
                  fillRule="nonzero"
                />
              </g>
            </g>
          </g>
        </svg>
      </AbsoluteFill>
      <Grain />
    </AbsoluteFill>
  );
};

export const aiHubBlueDefaults: AIHubProps = { variant: "blue" };
export const aiHubTealDefaults: AIHubProps = { variant: "teal" };
