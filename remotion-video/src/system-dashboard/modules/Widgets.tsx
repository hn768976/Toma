import React from "react";
import { useCurrentFrame } from "remotion";
import { BORDER, FINE, HAIRLINE } from "../constants";
import { appear, blink, drift, ramp, tickingDigits, tickingHex } from "../anim";
import { pick, rand, randRange, stream } from "../random";
import { loremLines, numCode, shortCode, unitLabel } from "../text";
import { useTheme } from "../theme";
import { Barcode, Corners, Reveal, Svg, TickRow, Txt } from "../primitives";
import { Checkerboard, ReadoutColumn, StripMeter } from "./Common";

/** Header rail: segmented ticks, small brackets and a long dashed rule. */
export const HeaderRail: React.FC<{ w: number; h: number; start: number; seed: number }> = ({
  w,
  h,
  start,
  seed,
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = appear(frame, start, 60);
  const segs = 9;
  const segW = w / segs;
  return (
    <Reveal p={p}>
      <Svg w={w} h={h}>
        <path d={`M0 0H${w}`} stroke={theme.primary} strokeWidth={HAIRLINE} />
        <g transform={`translate(0 6)`}>
          <TickRow w={w} step={14} len={7} major={6} majorLen={16} color={theme.structure} />
        </g>
        {new Array(segs).fill(0).map((_, i) => (
          <g key={i} transform={`translate(${i * segW} ${h - 30})`}>
            <path
              d={`M0 0V12H${segW * 0.34}`}
              fill="none"
              stroke={theme.secondary}
              strokeWidth={FINE}
            />
            <rect
              x={segW * 0.45}
              y={2}
              width={segW * 0.36}
              height={10}
              fill={rand(seed + i) > 0.5 ? theme.bar : "none"}
              stroke={theme.structure}
              strokeWidth={FINE}
              opacity={0.85}
            />
          </g>
        ))}
        <path
          d={`M0 ${h}H${w}`}
          stroke={theme.secondary}
          strokeWidth={FINE}
          strokeDasharray="14 10"
          opacity={0.8}
        />
      </Svg>
      {new Array(segs).fill(0).map((_, i) => (
        <Txt
          key={i}
          x={i * segW}
          y={h - 68}
          size={17}
          mono
          color={theme.secondary}
          opacity={0.75}
        >
          {shortCode(seed * 3 + i)}-{numCode(seed + i * 9, 3)}
        </Txt>
      ))}
    </Reveal>
  );
};

/** Small square scanner: polygonal wireframe, crosshair and a rotating reticle. */
export const Scanner: React.FC<{
  size: number;
  seed: number;
  start: number;
  label?: string;
  speed?: number;
}> = ({ size, seed, start, label, speed = 0.22 }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = appear(frame, start, 34);
  const c = size / 2;
  const sides = 5 + Math.floor(rand(seed) * 3);
  const rOuter = size * 0.31;
  const poly = new Array(sides)
    .fill(0)
    .map((_, i) => {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const rr = rOuter * randRange(seed * 13 + i, 0.66, 1);
      return `${(c + Math.cos(a) * rr).toFixed(1)},${(c + Math.sin(a) * rr).toFixed(1)}`;
    })
    .join(" ");
  const inner = new Array(sides)
    .fill(0)
    .map((_, i) => {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2 + 0.3;
      const rr = rOuter * 0.52;
      return `${(c + Math.cos(a) * rr).toFixed(1)},${(c + Math.sin(a) * rr).toFixed(1)}`;
    })
    .join(" ");
  const rot = (frame - start) * speed * (rand(seed + 5) > 0.5 ? 1 : -1);
  const ringR = size * 0.4;
  const circ = 2 * Math.PI * ringR;
  return (
    <>
      <Svg w={size} h={size}>
        <Reveal p={p}>
          <g>
            <rect
              x={FINE}
              y={FINE}
              width={size - FINE * 2}
              height={size - FINE * 2}
              fill="none"
              stroke={theme.structure}
              strokeWidth={HAIRLINE}
            />
            <Corners w={size} h={size} len={16} color={theme.primary} sw={HAIRLINE} />
            <path
              d={`M${c} 6V${size - 6}M6 ${c}H${size - 6}`}
              stroke={theme.structure}
              strokeWidth={FINE}
              opacity={0.75}
            />
          </g>
        </Reveal>
        <g opacity={p}>
          <polygon points={poly} fill="none" stroke={theme.primary} strokeWidth={HAIRLINE} />
          <polygon points={inner} fill="none" stroke={theme.secondary} strokeWidth={FINE} opacity={0.8} />
        </g>
        <g transform={`rotate(${rot} ${c} ${c})`} opacity={p}>
          <circle
            cx={c}
            cy={c}
            r={ringR}
            fill="none"
            stroke={theme.secondary}
            strokeWidth={FINE}
            strokeDasharray={`${circ * 0.16} ${circ * 0.09}`}
            strokeDashoffset={circ * (1 - appear(frame, start + 8, 40))}
            opacity={0.9}
          />
          <path
            d={`M${c + ringR - 14} ${c}h20M${c - ringR - 6} ${c}h20`}
            stroke={theme.primary}
            strokeWidth={HAIRLINE}
          />
        </g>
      </Svg>
      {label ? (
        <Txt x={10} y={size - 30} size={16} mono color={theme.secondary} opacity={p * 0.85}>
          {label}
        </Txt>
      ) : null}
      <Txt
        x={0}
        y={size - 30}
        width={size - 10}
        align="right"
        size={16}
        mono
        color={theme.primary}
        opacity={p * 0.8}
      >
        {tickingHex(frame, seed * 7, 4)}
      </Txt>
    </>
  );
};

/** DATA ANALYSIS: hexagon node-link diagram with a column of readouts. */
export const DataAnalysis: React.FC<{ w: number; h: number; seed: number; start: number }> = ({
  w,
  h,
  seed,
  start,
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = appear(frame, start, 40);
  const diagW = w * 0.58;
  const hexR = Math.min(diagW, h) * 0.12;
  const nodes = new Array(7).fill(0).map((_, i) => {
    if (i === 0) return { x: diagW * 0.5, y: h * 0.52 };
    const a = ((i - 1) / 6) * Math.PI * 2;
    return { x: diagW * 0.5 + Math.cos(a) * diagW * 0.3, y: h * 0.52 + Math.sin(a) * h * 0.27 };
  });
  const hexPath = (cx: number, cy: number, r: number) =>
    new Array(6)
      .fill(0)
      .map((_, k) => {
        const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
        return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
      })
      .join(" ");
  return (
    <>
      <Txt x={0} y={0} size={26} weight={600} ls={4} glow opacity={ramp(frame, start, 18)}>
        DATA ANALYSIS
      </Txt>
      <Svg w={w} h={h} style={{ opacity: p }}>
        <path d={`M0 40H${w}`} stroke={theme.primary} strokeWidth={HAIRLINE} />
        <g transform="translate(0 50)">
          {nodes.slice(1).map((n, i) => (
            <path
              key={i}
              d={`M${nodes[0].x} ${nodes[0].y}L${n.x} ${n.y}`}
              stroke={theme.structure}
              strokeWidth={FINE}
              strokeDasharray="8 6"
              opacity={0.9}
            />
          ))}
          {nodes.map((n, i) => {
            const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin((frame + i * 21) * 0.09));
            return (
              <g key={i}>
                <polygon
                  points={hexPath(n.x, n.y, hexR * (i === 0 ? 1.35 : 1))}
                  fill="none"
                  stroke={i === 0 ? theme.primary : theme.secondary}
                  strokeWidth={i === 0 ? HAIRLINE : FINE}
                  opacity={pulse}
                />
                <circle cx={n.x} cy={n.y} r={3.5} fill={theme.primary} opacity={pulse} />
              </g>
            );
          })}
        </g>
      </Svg>
      <div style={{ position: "absolute", left: diagW + 16, top: 66 }}>
        <ReadoutColumn w={w - diagW - 16} rows={8} seed={seed * 5} start={start + 12} size={19} rowStep={30} />
      </div>
    </>
  );
};

/** Large display frame: checkerboard ground, POWER meter bar and GROUP label. */
export const DisplayFrame: React.FC<{ w: number; h: number; seed: number; start: number }> = ({
  w,
  h,
  seed,
  start,
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = appear(frame, start, 44);
  const barY = h - 132;
  const barH = 44;
  const power = drift(frame, seed * 3, 140, 0.3, 0.95);
  const wobble = frame * 0.012;
  const sweep = 40 + ((frame * 1.6) % (barY - 80));
  return (
    <>
      <Svg w={w} h={h} style={{ opacity: Math.max(0, p * 1.5 - 0.5) }}>
        <g clipPath="none" opacity={0.45}>
          <Checkerboard w={w} h={barY - 12} cell={24} opacity={0.32} />
        </g>
      </Svg>
      {/* Wireframe content sitting on the checkerboard ground. */}
      <Svg w={w} h={h} style={{ opacity: appear(frame, start + 22, 40) }}>
        <g>
          <path
            d={`M${w / 2} 40V${barY - 30}M40 ${(barY - 12) / 2}H${w - 40}`}
            stroke={theme.structure}
            strokeWidth={FINE}
            opacity={0.9}
          />
          {new Array(5).fill(0).map((_, i) => (
            <ellipse
              key={i}
              cx={w / 2}
              cy={(barY - 12) / 2}
              rx={(barY - 12) * 0.34}
              ry={(barY - 12) * 0.34 * Math.cos(((i + 1) / 6) * Math.PI)}
              fill="none"
              stroke={theme.secondary}
              strokeWidth={FINE}
              opacity={0.75}
            />
          ))}
          {new Array(6).fill(0).map((_, i) => (
            <ellipse
              key={i}
              cx={w / 2}
              cy={(barY - 12) / 2}
              rx={(barY - 12) * 0.34 * Math.abs(Math.cos((i / 6) * Math.PI + wobble))}
              ry={(barY - 12) * 0.34}
              fill="none"
              stroke={theme.structure}
              strokeWidth={FINE}
              opacity={0.7}
            />
          ))}
          <circle
            cx={w / 2}
            cy={(barY - 12) / 2}
            r={(barY - 12) * 0.34}
            fill="none"
            stroke={theme.primary}
            strokeWidth={HAIRLINE}
          />
          {/* Slow vertical scan sweep. */}
          <path
            d={`M30 ${sweep}H${w - 30}`}
            stroke={theme.primary}
            strokeWidth={HAIRLINE}
            opacity={0.5}
          />
          <g transform={`translate(30 ${barY - 90})`}>
            <rect x={0} y={0} width={190} height={62} fill="none" stroke={theme.structure} strokeWidth={FINE} />
            <g transform="translate(6 52)">
              <TickRow w={178} step={9} len={5} major={5} majorLen={11} up />
            </g>
          </g>
        </g>
      </Svg>
      <Txt x={36} y={barY - 84} size={17} mono color={theme.secondary} opacity={p * 0.85}>
        {tickingHex(frame, seed * 5, 6)}
      </Txt>
      <Txt x={36} y={barY - 62} size={17} mono color={theme.secondary} opacity={p * 0.7}>
        {shortCode(seed * 13)} {tickingDigits(frame, seed * 17, 4)}
      </Txt>
      <Txt x={0} y={64} width={w - 32} align="right" size={18} mono color={theme.secondary} opacity={p * 0.8}>
        {unitLabel(seed * 29)}
      </Txt>
      <Reveal p={p}>
        <Svg w={w} h={h}>
          <rect
            x={BORDER / 2}
            y={BORDER / 2}
            width={w - BORDER}
            height={h - BORDER}
            fill="none"
            stroke={theme.primary}
            strokeWidth={BORDER}
          />
          <path d={`M0 ${barY - 12}H${w}`} stroke={theme.secondary} strokeWidth={FINE} />
          <g transform={`translate(14 ${barY})`}>
            <rect
              x={0}
              y={0}
              width={w - 28}
              height={barH}
              fill="none"
              stroke={theme.primary}
              strokeWidth={HAIRLINE}
            />
            <rect
              x={2}
              y={2}
              width={(w - 32) * power * p}
              height={barH - 4}
              fill={theme.bar}
              opacity={0.8}
            />
            {new Array(18).fill(0).map((_, i) => (
              <path
                key={i}
                d={`M${((i + 1) * (w - 28)) / 19} 0V${barH}`}
                stroke="#000"
                strokeWidth={HAIRLINE}
                opacity={0.85}
              />
            ))}
          </g>
          <g transform={`translate(14 ${h - 68})`}>
            <TickRow w={w - 28} step={16} len={7} major={4} majorLen={14} />
          </g>
          <g transform="translate(20 24)">
            <TickRow w={w - 40} step={20} len={8} major={5} majorLen={17} />
          </g>
        </Svg>
        <Txt x={26} y={barY + 8} size={26} weight={600} ls={5} glow>
          POWER
        </Txt>
        <Txt
          x={0}
          y={barY + 10}
          width={w - 28}
          align="right"
          size={20}
          mono
          color={theme.primary}
        >
          {tickingDigits(frame, seed * 11, 4)}
        </Txt>
        <Txt x={26} y={h - 46} size={19} weight={600} ls={3} color={theme.secondary}>
          GROUP
        </Txt>
        <Txt
          x={0}
          y={h - 46}
          width={w - 28}
          align="right"
          size={17}
          mono
          color={theme.secondary}
          opacity={0.8}
        >
          {unitLabel(seed * 19)} / {tickingHex(frame, seed * 23, 6)}
        </Txt>
      </Reveal>
    </>
  );
};

/** ATTENTION! banner in a thin outlined box, blinking on its own cycle. */
export const AttentionBanner: React.FC<{ w: number; h: number; start: number }> = ({ w, h, start }) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = appear(frame, start, 22);
  const on = frame > start + 20 && blink(frame, 78, 12, 5);
  return (
    <Reveal p={p}>
      <Svg w={w} h={h}>
        <rect
          x={HAIRLINE}
          y={HAIRLINE}
          width={w - HAIRLINE * 2}
          height={h - HAIRLINE * 2}
          fill={on ? theme.primary : "none"}
          stroke={theme.primary}
          strokeWidth={HAIRLINE}
          opacity={on ? 0.9 : 1}
        />
        <path
          d={`M14 ${h - 12}H${w - 14}`}
          stroke={theme.secondary}
          strokeWidth={FINE}
          strokeDasharray="8 7"
          opacity={on ? 0 : 0.8}
        />
      </Svg>
      <Txt
        x={0}
        y={h * 0.5 - h * 0.26}
        width={w}
        align="center"
        size={h * 0.44}
        weight={600}
        ls={h * 0.1}
        color={on ? "#000000" : theme.primary}
        glow={!on}
      >
        ATTENTION!
      </Txt>
    </Reveal>
  );
};

/** Wide spectrum panel: two labelled halves with a column of digits between. */
export const SpectrumPanel: React.FC<{ w: number; h: number; seed: number; start: number }> = ({
  w,
  h,
  seed,
  start,
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = appear(frame, start, 40);
  const gutter = 96;
  const halfW = (w - gutter) / 2;
  const plotH = h - 74;
  const bars = 34;
  const half = (ox: number, hs: number) => (
    <g transform={`translate(${ox} 40)`}>
      <path
        d={`M0 ${plotH}H${halfW}M0 0V${plotH}`}
        stroke={theme.structure}
        strokeWidth={FINE}
      />
      {new Array(bars).fill(0).map((_, i) => {
        const bp = appear(frame, start + 10 + i * 1.6, 20);
        const v =
          drift(frame, hs * 31 + i, 60 + (i % 7) * 11, 0.05, 1, i * 13) *
          (0.35 + 0.65 * Math.exp(-Math.pow((i - bars * 0.32) / (bars * 0.45), 2)));
        const bh = plotH * v * bp;
        return (
          <rect
            key={i}
            x={(i * halfW) / bars + 2}
            y={plotH - bh}
            width={halfW / bars - 4}
            height={bh}
            fill={theme.bar}
            opacity={randRange(hs + i, 0.45, 0.95)}
          />
        );
      })}
      <g transform={`translate(0 ${plotH})`}>
        <TickRow w={halfW} step={halfW / bars} len={5} major={5} majorLen={11} />
      </g>
    </g>
  );
  return (
    <>
      <Svg w={w} h={h} style={{ opacity: p }}>
        <path d={`M0 24H${w}`} stroke={theme.primary} strokeWidth={HAIRLINE} />
        {half(0, seed)}
        {half(halfW + gutter, seed * 7 + 3)}
        <path
          d={`M${halfW + gutter / 2} 34V${h - 24}`}
          stroke={theme.structure}
          strokeWidth={FINE}
          strokeDasharray="6 6"
        />
      </Svg>
      <Txt x={0} y={0} size={20} weight={600} ls={3} opacity={p}>
        SPECTRUM A
      </Txt>
      <Txt x={halfW + gutter} y={0} size={20} weight={600} ls={3} opacity={p} color={theme.secondary}>
        SPECTRUM B
      </Txt>
      <Txt x={0} y={h - 26} size={17} mono color={theme.secondary} opacity={p * 0.85}>
        32 Hz {"  "} {unitLabel(seed * 3)} {"  "} {unitLabel(seed * 5)}
      </Txt>
      <Txt
        x={halfW + gutter}
        y={h - 26}
        size={17}
        mono
        color={theme.secondary}
        opacity={p * 0.85}
      >
        1230 {"  "} {unitLabel(seed * 11)} {"  "} {tickingHex(frame, seed * 2, 4)}
      </Txt>
      {new Array(9).fill(0).map((_, i) => (
        <Txt
          key={i}
          x={halfW + 8}
          y={54 + i * 30}
          width={gutter - 16}
          align="center"
          size={18}
          mono
          color={i % 3 === 0 ? theme.primary : theme.secondary}
          opacity={ramp(frame, start + 14 + i * 3, 16) * 0.9}
        >
          {tickingDigits(frame, seed * 13 + i, 3)}
        </Txt>
      ))}
    </>
  );
};

/** Flow diagram: dashed paths, small nodes and a circular origin marker. */
export const FlowDiagram: React.FC<{ w: number; h: number; seed: number; start: number }> = ({
  w,
  h,
  seed,
  start,
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = appear(frame, start, 46);
  const origin = { x: w * 0.16, y: h * 0.55 };
  const nodes = new Array(9).fill(0).map((_, i) => ({
    x: w * (0.34 + (i % 3) * 0.22) + randRange(seed + i, -20, 20),
    y: h * (0.2 + Math.floor(i / 3) * 0.26) + randRange(seed * 3 + i, -16, 16),
  }));
  return (
    <>
      <Svg w={w} h={h} style={{ opacity: p }}>
        <circle
          cx={origin.x}
          cy={origin.y}
          r={h * 0.19}
          fill="none"
          stroke={theme.primary}
          strokeWidth={HAIRLINE}
        />
        <circle
          cx={origin.x}
          cy={origin.y}
          r={h * 0.12}
          fill="none"
          stroke={theme.secondary}
          strokeWidth={FINE}
          strokeDasharray="7 6"
        />
        <circle cx={origin.x} cy={origin.y} r={5} fill={theme.primary} />
        {nodes.map((n, i) => {
          const midX = (origin.x + n.x) / 2;
          const dash = 300;
          return (
            <path
              key={i}
              d={`M${origin.x + h * 0.19} ${origin.y}H${midX}V${n.y}H${n.x - 9}`}
              fill="none"
              stroke={theme.structure}
              strokeWidth={FINE}
              strokeDasharray="9 7"
              strokeDashoffset={dash * (1 - appear(frame, start + 12 + i * 5, 30))}
              opacity={0.95}
            />
          );
        })}
        {nodes.map((n, i) => {
          const np = appear(frame, start + 20 + i * 5, 18);
          return (
            <rect
              key={i}
              x={n.x - 9}
              y={n.y - 9}
              width={18}
              height={18}
              fill={rand(seed * 9 + i) > 0.6 ? theme.bar : "none"}
              stroke={theme.primary}
              strokeWidth={FINE}
              opacity={np}
            />
          );
        })}
      </Svg>
      {nodes.map((n, i) => (
        <Txt
          key={i}
          x={n.x + 16}
          y={n.y - 11}
          size={16}
          mono
          color={theme.secondary}
          opacity={ramp(frame, start + 24 + i * 5, 16) * 0.8}
        >
          {shortCode(seed * 21 + i)}
        </Txt>
      ))}
      <Txt
        x={0}
        y={h - 26}
        size={22}
        color={theme.primary}
        opacity={ramp(frame, start + 34, 24) * 0.95}
        ls={1.5}
      >
        photographic display
      </Txt>
    </>
  );
};

/** Framed caption box: short lines of text plus an R17 badge and barcode. */
export const CaptionBox: React.FC<{ w: number; h: number; seed: number; start: number }> = ({
  w,
  h,
  seed,
  start,
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = appear(frame, start, 36);
  const badgeW = 210;
  const lines = loremLines(seed, 6, 46);
  return (
    <>
      <Reveal p={p}>
        <Svg w={w} h={h}>
          <rect
            x={HAIRLINE}
            y={HAIRLINE}
            width={w - HAIRLINE * 2}
            height={h - HAIRLINE * 2}
            fill="none"
            stroke={theme.secondary}
            strokeWidth={HAIRLINE}
          />
          <path d={`M${w - badgeW - 26} 14V${h - 14}`} stroke={theme.structure} strokeWidth={FINE} />
          <rect
            x={w - badgeW - 8}
            y={20}
            width={badgeW - 14}
            height={78}
            fill="none"
            stroke={theme.primary}
            strokeWidth={HAIRLINE}
          />
          <Barcode x={w - badgeW - 8} y={112} w={badgeW - 14} h={46} seed={seed * 3} opacity={0.85} />
        </Svg>
        <Txt
          x={w - badgeW - 8}
          y={34}
          width={badgeW - 14}
          align="center"
          size={48}
          weight={600}
          ls={6}
          glow
        >
          R17
        </Txt>
      </Reveal>
      {lines.map((l, i) => (
        <Txt
          key={i}
          x={22}
          y={22 + i * 30}
          size={20}
          color={i === 0 ? theme.primary : theme.secondary}
          opacity={ramp(frame, start + 16 + i * 5, 18) * (i === 0 ? 0.95 : 0.6)}
        >
          {i === 0 ? `${shortCode(seed + i)} / ${numCode(seed * 5, 6)} / ${l.slice(0, 30)}` : l}
        </Txt>
      ))}
      <Txt
        x={w - badgeW - 8}
        y={h - 34}
        width={badgeW - 14}
        align="center"
        size={16}
        mono
        color={theme.secondary}
        opacity={ramp(frame, start + 30, 20) * 0.8}
      >
        {tickingHex(frame, seed * 31, 8)}
      </Txt>
    </>
  );
};

/** Small framed ERROR button with a tiny readout beside it. */
export const ErrorButton: React.FC<{ w: number; h: number; start: number; seed: number }> = ({
  w,
  h,
  start,
  seed,
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = appear(frame, start, 24);
  // Deliberately out of phase with the ATTENTION! banner.
  const on = frame > start + 24 && blink(frame, 63, 41, 4);
  return (
    <>
      <Reveal p={p}>
        <Svg w={w} h={h}>
          <rect
            x={HAIRLINE}
            y={HAIRLINE}
            width={w - HAIRLINE * 2}
            height={h - HAIRLINE * 2}
            fill={on ? theme.primary : "none"}
            stroke={theme.primary}
            strokeWidth={HAIRLINE}
          />
          <Corners w={w} h={h} len={12} color={theme.secondary} sw={FINE} />
        </Svg>
        <Txt
          x={0}
          y={h * 0.5 - h * 0.23}
          width={w}
          align="center"
          size={h * 0.4}
          weight={600}
          ls={h * 0.09}
          color={on ? "#000000" : theme.primary}
        >
          ERROR
        </Txt>
      </Reveal>
      <Txt x={w + 26} y={4} size={18} mono color={theme.secondary} opacity={p * 0.85}>
        {tickingDigits(frame, seed, 6)}
      </Txt>
      <Txt x={w + 26} y={h - 26} size={16} mono color={theme.structure} opacity={p}>
        {unitLabel(seed * 7)} / {shortCode(seed * 3)}
      </Txt>
    </>
  );
};

/** Bracketed cluster of small controls along the bottom edge. */
export const ControlCluster: React.FC<{ w: number; h: number; seed: number; start: number }> = ({
  w,
  h,
  seed,
  start,
}) => {
  const frame = useCurrentFrame();
  const theme = useTheme();
  const p = appear(frame, start, 30);
  const cells = 6;
  const cw = w / cells;
  const states = stream(seed, cells);
  return (
    <>
      <Svg w={w} h={h} style={{ opacity: p }}>
        <path
          d={`M0 10V0H${w}V10M0 ${h - 10}V${h}H${w}V${h - 10}`}
          fill="none"
          stroke={theme.secondary}
          strokeWidth={FINE}
        />
        {new Array(cells).fill(0).map((_, i) => (
          <g key={i} transform={`translate(${i * cw + 10} 18)`}>
            <rect
              x={0}
              y={0}
              width={cw - 26}
              height={h - 36}
              fill="none"
              stroke={theme.structure}
              strokeWidth={FINE}
            />
            <rect
              x={4}
              y={4}
              width={(cw - 34) * (0.25 + states[i] * 0.7)}
              height={h - 44}
              fill={theme.bar}
              opacity={0.55}
            />
          </g>
        ))}
      </Svg>
      {new Array(cells).fill(0).map((_, i) => (
        <Txt
          key={i}
          x={i * cw + 14}
          y={h * 0.5 - 10}
          size={17}
          mono
          color={theme.primary}
          opacity={p * 0.9}
        >
          {pick(seed + i, ["ON", "OFF", "STBY", "RUN", "HOLD", "SYNC"])} {tickingDigits(frame, seed + i * 13, 2)}
        </Txt>
      ))}
    </>
  );
};

/** Vertical block meter - discrete blocks, wider than the thin scale meter. */
export const BlockMeter: React.FC<{ w: number; h: number; seed: number; start: number }> = ({
  w,
  h,
  seed,
  start,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const p = appear(frame, start, 30);
  return (
    <>
      <Svg w={w} h={h} style={{ opacity: p }}>
        <rect x={0} y={0} width={w} height={h} fill="none" stroke={theme.structure} strokeWidth={FINE} />
      </Svg>
      <div style={{ position: "absolute", left: 5, top: 5 }}>
        <StripMeter w={w - 10} h={h - 10} count={22} seed={seed} start={start + 6} vertical />
      </div>
    </>
  );
};
