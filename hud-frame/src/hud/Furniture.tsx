import React from "react";
import { interpolate } from "remotion";
import {
  DURATION_IN_FRAMES,
  FURNITURE_FADE,
  FURNITURE_GROUP_STAGGER,
  FURNITURE_START,
} from "./constants";
import { flickerAt } from "./flicker";
import type {
  DotPair,
  Element,
  HatchBlock,
  PlusMarker,
  Ring,
  SolidBar,
  TickRow,
  Trace,
  Triangle,
} from "./layout";
import type { Palette } from "./palette";

/** 0 -> 1 as the element's group fades in; 1 for the rest of the clip. */
export const revealOf = (group: number, frame: number): number =>
  interpolate(
    frame,
    [
      FURNITURE_START + group * FURNITURE_GROUP_STAGGER,
      FURNITURE_START + group * FURNITURE_GROUP_STAGGER + FURNITURE_FADE,
    ],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

const roleColor = (palette: Palette, role: Element["color"]): string => palette[role];

const path = (pts: [number, number][], close = true): string =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ") +
  (close ? " Z" : "");

type Ctx = {
  frame: number;
  palette: Palette;
  /** Base hairline width, in composition px. */
  hair: number;
  uid: string;
};

const Hatch: React.FC<{ el: HatchBlock; ctx: Ctx; reveal: number }> = ({ el, ctx, reveal }) => {
  const color = roleColor(ctx.palette, el.color);
  const outline: [number, number][] = [
    [el.x, el.y + el.h],
    [el.x + el.w, el.y + el.h],
    [el.x + el.w + el.lean, el.y],
    [el.x + el.lean, el.y],
  ];
  const pitch = el.w / el.bars;
  const barW = pitch * el.duty;
  const splitGap = pitch * 0.5;
  // Stripes drift by exactly one pitch per driftPeriod frames, so the pattern
  // is identical at the loop point.
  const drift = ((ctx.frame % el.driftPeriod) / el.driftPeriod) * pitch;
  const bars: React.ReactElement[] = [];
  for (let i = -2; i < el.bars + 2; i++) {
    const offset = i >= el.splitAfter ? splitGap : 0;
    const bx = el.x + i * pitch + offset + drift;
    bars.push(
      <path
        key={i}
        d={path([
          [bx, el.y + el.h],
          [bx + barW, el.y + el.h],
          [bx + barW + el.lean, el.y],
          [bx + el.lean, el.y],
        ])}
        fill={color}
        fillOpacity={0.22}
        stroke={color}
        strokeWidth={ctx.hair * 0.8}
        strokeOpacity={0.9}
      />,
    );
  }
  const clipId = `${ctx.uid}-clip-${el.id}`;
  return (
    <g opacity={reveal}>
      <defs>
        <clipPath id={clipId}>
          <path d={path(outline)} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>{bars}</g>
      <path d={path(outline)} fill="none" stroke={color} strokeWidth={ctx.hair} />
    </g>
  );
};

const Bar: React.FC<{ el: SolidBar; ctx: Ctx; reveal: number }> = ({ el, ctx, reveal }) => {
  const color = roleColor(ctx.palette, el.color);
  const outline = roleColor(ctx.palette, "line");
  // Whole cycles per 600 frames keeps the level identical at the loop point.
  const swing = 0.045 * Math.sin((2 * Math.PI * ctx.frame) / el.period);
  const to = Math.min(0.97, el.to + swing);
  const inset = ctx.hair;
  // A wipe from the left as the bar reveals, then the level animation takes over.
  const w = (to - el.from) * el.w * reveal;
  return (
    <g opacity={reveal}>
      <rect
        x={el.x}
        y={el.y}
        width={el.w}
        height={el.h}
        fill={outline}
        fillOpacity={0.1}
        stroke={outline}
        strokeWidth={ctx.hair}
      />
      <rect
        x={el.x + el.from * el.w + inset}
        y={el.y + inset}
        width={Math.max(0, w - inset * 2)}
        height={el.h - inset * 2}
        fill={color}
        fillOpacity={0.9}
      />
    </g>
  );
};

const Ticks: React.FC<{ el: TickRow; ctx: Ctx; reveal: number }> = ({ el, ctx, reveal }) => {
  const color = roleColor(ctx.palette, el.color);
  const bright = roleColor(ctx.palette, "bright");
  // A pulse travels the run; `passes` whole passes per 600 frames.
  const phase = ((ctx.frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES) * el.passes;
  const ticks: React.ReactElement[] = [];
  for (let i = 0; i < el.count; i++) {
    const t = i / (el.count - 1);
    // The run also wipes on, tick by tick, as the group reveals.
    if (t > reveal * 1.15) continue;
    let d = (t - phase) % 1;
    if (d < 0) d += 1;
    const dd = Math.min(d, 1 - d);
    const pulse = Math.exp(-((dd / 0.09) ** 2));
    const x1 = el.axis === "h" ? el.x + t * el.span : el.x;
    const y1 = el.axis === "h" ? el.y : el.y + t * el.span;
    const x2 = el.axis === "h" ? x1 : x1 + el.len;
    const y2 = el.axis === "h" ? y1 + el.len : y1;
    ticks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={pulse > 0.4 ? bright : color}
        strokeWidth={ctx.hair * (0.85 + pulse * 0.5)}
        opacity={0.4 + pulse * 0.6}
      />,
    );
  }
  return <g opacity={reveal}>{ticks}</g>;
};

const Plus: React.FC<{ el: PlusMarker; ctx: Ctx; reveal: number }> = ({ el, ctx, reveal }) => {
  const color = roleColor(ctx.palette, el.color);
  const s = (el.size / 2) * (0.75 + 0.25 * reveal);
  return (
    <g opacity={reveal} stroke={color} strokeWidth={ctx.hair}>
      <line x1={el.x - s} y1={el.y} x2={el.x + s} y2={el.y} />
      <line x1={el.x} y1={el.y - s} x2={el.x} y2={el.y + s} />
    </g>
  );
};

const RingEl: React.FC<{ el: Ring; ctx: Ctx; reveal: number }> = ({ el, ctx, reveal }) => {
  const color = roleColor(ctx.palette, el.color);
  const c = 2 * Math.PI * el.r;
  // Whole turns per 600 frames, so the ring is back where it started.
  const angle = ((ctx.frame % DURATION_IN_FRAMES) / DURATION_IN_FRAMES) * 360 * el.turns;
  return (
    <g opacity={reveal} transform={`rotate(${angle.toFixed(3)} ${el.cx} ${el.cy})`}>
      <circle
        cx={el.cx}
        cy={el.cy}
        r={el.r}
        fill="none"
        stroke={color}
        strokeWidth={ctx.hair}
        strokeDasharray={`${c * (1 - el.gap)} ${c * el.gap}`}
      />
    </g>
  );
};

const TraceEl: React.FC<{ el: Trace; ctx: Ctx; reveal: number }> = ({ el, ctx, reveal }) => {
  const color = roleColor(ctx.palette, el.color);
  const bright = roleColor(ctx.palette, "bright");
  return (
    <g opacity={reveal}>
      <path
        d={path(el.pts, false)}
        fill="none"
        stroke={color}
        strokeWidth={ctx.hair * 0.8}
        strokeDasharray={el.dash ? `${el.dash[0]} ${el.dash[1]}` : undefined}
      />
      {el.dots.map((i) => (
        <circle key={i} cx={el.pts[i][0]} cy={el.pts[i][1]} r={el.r} fill={bright} />
      ))}
    </g>
  );
};

const Dots: React.FC<{ el: DotPair; ctx: Ctx; reveal: number }> = ({ el, ctx, reveal }) => {
  const color = roleColor(ctx.palette, el.color);
  return (
    <g opacity={reveal}>
      {el.pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={el.r} fill={color} />
      ))}
    </g>
  );
};

const Tri: React.FC<{ el: Triangle; ctx: Ctx; reveal: number }> = ({ el, ctx, reveal }) => {
  const color = roleColor(ctx.palette, el.color);
  return <path d={path(el.pts)} fill={color} fillOpacity={0.8 * reveal} />;
};

export const Furniture: React.FC<{ elements: Element[]; ctx: Ctx }> = ({ elements, ctx }) => (
  <>
    {elements.map((el) => {
      const reveal = revealOf(el.group, ctx.frame);
      if (reveal <= 0) return null;
      const dim = flickerAt(el.id, ctx.frame);
      const inner = (() => {
        switch (el.kind) {
          case "hatch":
            return <Hatch el={el} ctx={ctx} reveal={reveal} />;
          case "bar":
            return <Bar el={el} ctx={ctx} reveal={reveal} />;
          case "ticks":
            return <Ticks el={el} ctx={ctx} reveal={reveal} />;
          case "plus":
            return <Plus el={el} ctx={ctx} reveal={reveal} />;
          case "ring":
            return <RingEl el={el} ctx={ctx} reveal={reveal} />;
          case "trace":
            return <TraceEl el={el} ctx={ctx} reveal={reveal} />;
          case "dots":
            return <Dots el={el} ctx={ctx} reveal={reveal} />;
          case "tri":
            return <Tri el={el} ctx={ctx} reveal={reveal} />;
        }
      })();
      return (
        <g key={el.id} opacity={dim}>
          {inner}
        </g>
      );
    })}
  </>
);
