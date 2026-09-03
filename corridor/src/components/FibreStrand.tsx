/**
 * <FibreStrand> — v1's element: a light strand rising into a wall.
 *
 * Each strand is ONE continuous curve. Along the floor it runs toward the
 * horizon; as it approaches, it BENDS through roughly 90 degrees and continues
 * vertically upward, becoming part of a wall behind the corridor. That single
 * bend is the whole idea — strands that merely fan out from the vanishing
 * point read as a starburst, not as a room.
 *
 * The bend is produced by blending two extended curves — the floor run
 * continued past the bend, and the vertical rise continued back below it —
 * with a smoothstep. The width of that blend window is the bend's radius, and
 * it varies per strand so the wall's base is not a hard line.
 *
 * Data packets ride the same curve: they are evaluated at a parameter t on it,
 * never placed free-floating.
 */
import React, { useMemo } from "react";
import { mixRgba, rgba } from "../lib/color";
import { TAU, clamp, frac, smoothstep } from "../lib/math";
import { CorridorGeometry, projectPoint } from "../lib/perspective";
import { randInt, randRange } from "../lib/seededRandom";
import { TaperPoint, taperedStroke } from "../lib/taperedStroke";
import {
  CorridorApi,
  CorridorElement,
  ElementRenderer,
  useCorridorGroup,
} from "./PerspectiveCorridor";

/** Curve parameter at which the floor run hands over to the vertical rise. */
const TB = 0.52;
const SAMPLES = 48;

export interface PacketSpec {
  offset: number;
  cycles: number;
  size: number;
  warm: number;
}

export interface FibreElement extends CorridorElement {
  /** Depth at which the strand leaves the floor. Sets the wall's distance. */
  bendDepth: number;
  /** Half-width of the blend window, i.e. the bend's radius. */
  bendRadius: number;
  /** Rise height as a multiple of frame height, before depth scaling. */
  riseUnit: number;
  /** Sideways lean of the rise, as a fraction of frame width. */
  lean: number;
  /** Lateral wobble of the rise: amplitude (fraction of width) and cycles. */
  wobbleAmp: number;
  wobbleFreq: number;
  wobblePhase: number;
  /** Strand width in 4K pixels at d = 1. */
  widthBase: number;
  bright: number;
  /** 0 -> strandBlue, 1 -> strandPale. */
  tone: number;
  packets: PacketSpec[];
}

interface Sample {
  x: number;
  y: number;
  /** Local depth, used for width and brightness along the curve. */
  dEff: number;
  /** Progress up the wall, 0 on the floor. */
  rise: number;
}

/**
 * The strand's geometry at a given foot depth. Precomputes everything that is
 * constant along the curve so `at()` stays cheap enough to call ~45 times per
 * strand per frame.
 */
class StrandCurve {
  private readonly bendD: number;
  private readonly bendX: number;
  private readonly bendY: number;
  private readonly riseX: number;
  private readonly riseY: number;
  /** Unit tangent of the floor run at the bend, pointing toward the horizon. */
  private readonly tanX: number;
  private readonly tanY: number;
  private readonly extLen: number;
  private readonly r: number;

  constructor(
    private readonly geo: CorridorGeometry,
    private readonly el: FibreElement,
    private readonly dFoot: number,
  ) {
    // Clamped so a strand still near the horizon bends proportionally close
    // instead of inverting its floor run.
    this.bendD = Math.min(el.bendDepth, dFoot * 0.55);
    const b = projectPoint(geo, el.lane, this.bendD, "floor");
    this.bendX = b.x;
    this.bendY = b.y;
    this.riseX = el.lean * geo.width * this.bendD;
    this.riseY = -el.riseUnit * geo.height * this.bendD;
    // Past the bend the floor run is continued along its own tangent rather
    // than further in depth: blending two straight extensions gives a clean
    // arc, where continuing in depth curls the end into a hook.
    const back = projectPoint(
      geo,
      el.lane,
      this.bendD + (dFoot - this.bendD) * 0.08 + 1e-4,
      "floor",
    );
    const tx = this.bendX - back.x;
    const ty = this.bendY - back.y;
    const tl = Math.hypot(tx, ty) || 1;
    this.tanX = tx / tl;
    this.tanY = ty / tl;
    // Never longer than the floor run itself, or a strand that has only just
    // emerged from the horizon overshoots and folds back on itself.
    const foot = projectPoint(geo, el.lane, dFoot, "floor");
    const floorRun = Math.hypot(this.bendX - foot.x, this.bendY - foot.y);
    this.extLen = Math.min(Math.abs(this.riseY) * 0.55, floorRun * 0.85);
    this.r = el.bendRadius;
  }

  get bendDepth(): number {
    return this.bendD;
  }

  at(t: number): Sample {
    // Floor branch. Up to the bend this is the real depth curve; past it the
    // branch continues straight along the tangent so the blend stays clean.
    const dA = this.dFoot + (this.bendD - this.dFoot) * (t / TB);
    let ax: number;
    let ay: number;
    if (t <= TB) {
      ax = this.geo.vanishX + this.el.lane * this.geo.spread * dA;
      ay =
        this.geo.horizonY + (this.geo.floorEdgeY - this.geo.horizonY) * dA * dA;
    } else {
      const e = ((t - TB) / (1 - TB)) * this.extLen;
      ax = this.bendX + this.tanX * e;
      ay = this.bendY + this.tanY * e;
    }

    // Vertical branch, extended back below the bend.
    const u = (t - TB) / (1 - TB);
    const wob =
      Math.sin((u * this.el.wobbleFreq + this.el.wobblePhase) * TAU) *
      this.el.wobbleAmp *
      this.geo.width *
      this.bendD *
      u;
    const bx = this.bendX + this.riseX * u + wob;
    const by = this.bendY + this.riseY * u;

    // Blending the two extended branches rounds the corner; the width of the
    // blend window is the bend radius.
    const w = smoothstep(TB - this.r, TB + this.r, t);
    return {
      x: ax + (bx - ax) * w,
      y: ay + (by - ay) * w,
      dEff: Math.max(t <= TB ? dA : this.bendD, this.bendD),
      rise: u < 0 ? 0 : u,
    };
  }
}

export const renderFibreStrand: ElementRenderer<FibreElement> = (
  ctx,
  el,
  p,
  api,
) => {
  const { geo, palette } = api;
  const k = geo.width / 3840;
  const curve = new StrandCurve(geo, el, p.d);

  const pts: TaperPoint[] = new Array(SAMPLES);
  let anyVisible = false;
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    const s = curve.at(t);
    // Fades: soft at the foot, and dimming as the wall rises out of the light.
    const foot = 0.6 + 0.4 * smoothstep(0, 0.07, t);
    const top = 1 - 0.55 * Math.pow(s.rise, 1.6);
    const a = p.fade * api.band(s.y) * foot * top * el.bright;
    if (a > 0.01 && s.x > -geo.width * 0.35 && s.x < geo.width * 1.35) {
      anyVisible = true;
    }
    pts[i] = { x: s.x, y: s.y, w: el.widthBase * k * s.dEff, a };
  }
  if (!anyVisible) return;

  // Pass 1 — a wide soft glow, built as three nested ribbons so it falls off
  // like a glow instead of reading as one flat wide band.
  const GLOW = [
    { w: 6.2, a: 0.055 },
    { w: 3.3, a: 0.085 },
    { w: 1.75, a: 0.13 },
  ];
  for (const g of GLOW) {
    const glow: TaperPoint[] = pts.map((q) => ({
      x: q.x,
      y: q.y,
      w: q.w * g.w,
      a: q.a * g.a,
    }));
    taperedStroke(ctx, glow, {
      stops: 12,
      colorAt: (alpha) =>
        mixRgba(palette.strandBlue, palette.strandPale, el.tone, alpha),
    });
  }

  // Pass 2 — a thin bright core.
  const core: TaperPoint[] = pts.map((q) => ({
    x: q.x,
    y: q.y,
    w: Math.max(0.8 * k, q.w * 0.82),
    a: q.a * 0.9,
  }));
  taperedStroke(ctx, core, {
    stops: 20,
    colorAt: (alpha) => mixRgba(palette.strandPale, palette.strandWhite, el.tone * 0.7 + 0.15, alpha),
  });

  // Data packets, riding the curve.
  const tNorm = api.frame / api.loop;
  for (const pk of el.packets) {
    const tp = frac(pk.offset + pk.cycles * tNorm);
    for (let trail = 0; trail < 3; trail++) {
      const tt = tp - trail * 0.015;
      if (tt < 0) continue;
      const s = curve.at(tt);
      const a =
        p.fade *
        api.band(s.y) *
        el.bright *
        (trail === 0 ? 1 : trail === 1 ? 0.45 : 0.2);
      if (a < 0.012) continue;
      const r = Math.max(1.2 * k, pk.size * s.dEff * 22 * k * (1 - trail * 0.22));
      const colour = trail === 0 ? palette.packetWhite : palette.packetCyan;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 3.2);
      g.addColorStop(0, rgba(colour, Math.min(1, a * 1.05)));
      g.addColorStop(0.22, rgba(palette.packetCyan, a * 0.6));
      g.addColorStop(0.6, rgba(palette.packetCyan, a * 0.16));
      g.addColorStop(1, rgba(palette.packetCyan, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 3.2, 0, TAU);
      ctx.fill();
    }
  }
};

/**
 * Strands are generated as mirrored left/right pairs sharing bend radius, rise
 * and timing, so the arrangement is symmetric about the vertical centre.
 */
export const makeFibreElements = (
  count: number,
  seed: string,
): FibreElement[] => {
  const pairs = Math.ceil(count / 2);
  const out: FibreElement[] = [];
  for (let i = 0; i < pairs; i++) {
    const s = `${seed}-strand-${i}`;
    const spanT = (i + 0.5) / pairs;
    const laneMag = clamp(
      Math.pow(spanT, 0.95) * randRange(`${s}-lj`, 0.84, 1.14) + 0.03,
      0.03,
      1,
    );
    const bendDepth = randRange(`${s}-bd`, 0.14, 0.34);
    const bendRadius = randRange(`${s}-br`, 0.13, 0.3);
    const riseUnit = randRange(`${s}-ru`, 1.1, 2.9);
    // The rise leans inward, the same lateral direction the floor run is
    // already travelling. Leaning outward turns the bend into a >90 degree
    // reversal, which reads as a kink rather than a curve.
    const lean = randRange(`${s}-ln`, 0.004, 0.045);
    const wobbleAmp = randRange(`${s}-wa`, 0.004, 0.05);
    const wobbleFreq = randRange(`${s}-wf`, 0.35, 1.1);
    const wobblePhase = randRange(`${s}-wp`, 0, 1);
    const widthBase = randRange(`${s}-wb`, 14, 34);
    const bright = randRange(`${s}-bt`, 0.5, 1);
    const tone = randRange(`${s}-tn`, 0, 1);
    const cycles = randInt(`${s}-cy`, 1, 2);
    const packetCount = randInt(`${s}-pc`, 2, 4);

    for (let side = 0; side < 2; side++) {
      if (out.length >= count) break;
      const sign = side === 0 ? -1 : 1;
      const ss = `${s}-${side}`;
      const packets: PacketSpec[] = [];
      for (let j = 0; j < packetCount; j++) {
        packets.push({
          offset: randRange(`${ss}-po-${j}`, 0, 1),
          // Integer cycles: every packet closes its loop in LOOP_FRAMES.
          cycles: randInt(`${ss}-pcy-${j}`, 1, 3),
          size: randRange(`${ss}-ps-${j}`, 0.6, 1.5),
          warm: 0,
        });
      }
      out.push({
        seed: ss,
        lane: laneMag * sign,
        plane: "floor",
        d0: randRange(`${ss}-d0`, 0, 1),
        cycles,
        bendDepth,
        bendRadius,
        riseUnit,
        lean: -lean * sign,
        wobbleAmp: wobbleAmp * sign,
        wobbleFreq,
        wobblePhase,
        widthBase,
        bright,
        tone,
        packets,
      });
    }
  }
  return out;
};

export interface FibreStrandProps {
  order: number;
  count: number;
  seed: string;
}

export const FibreStrand: React.FC<FibreStrandProps> = ({ order, count, seed }) => {
  const elements = useMemo(() => makeFibreElements(count, seed), [count, seed]);
  useCorridorGroup<FibreElement>({
    id: "fibre-strands",
    order,
    elements,
    render: renderFibreStrand,
    blend: "lighter",
    fadeIn: 0.2,
  });
  return null;
};

export type { CorridorApi };
