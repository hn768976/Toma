// Snowflake glyphs and snowfall. A flake is six primary arms at 60
// degrees, each carrying 2-3 pairs of side branches and a small hexagon or
// star at the centre. Arm and branch proportions vary per shape, but every
// flake is exactly six-fold symmetric within itself — break that and it
// stops reading as a snowflake.
//
// Stroking six arms and ~18 branches for 55 flakes at 4K every frame is
// the expensive mistake here, so each shape is stroked once into an
// offscreen sprite (blur baked in) and blitted with a rotation transform.

import {
  DURATION_IN_FRAMES,
  SNOW_BLUR_RANGE,
  SNOW_DRIFT_RANGE,
  SNOW_OPACITY_RANGE,
  SNOW_SHAPE_VARIANTS,
  SNOW_SIZE_BRACKETS,
  SNOW_SIZE_RANGE,
  SNOW_SPIN_TURNS,
  SNOW_TRAVERSALS,
  SNOWFLAKE_COUNT,
  SNOW_WRAP_MARGIN,
} from "./config";
import { createCanvas, TAU } from "./canvas";
import { rand, randInt, randRange, randSign } from "./rand";
import { rgba, type Theme } from "./theme";

type Branch = {
  /** Position along the arm, 0 at centre, 1 at the tip. */
  t: number;
  /** Length as a fraction of the arm. */
  length: number;
  /** Angle away from the arm, radians (~45 degrees). */
  angle: number;
};

export type FlakeShape = {
  variant: number;
  /** Arm length as a fraction of the glyph radius. */
  armLength: number;
  branches: Branch[];
  coreRadius: number;
  coreIsStar: boolean;
  /** Length of the little fork at each arm tip; 0 for none. */
  tipFork: number;
  strokeScale: number;
};

export const buildFlakeShape = (variant: number): FlakeShape => {
  const branchCount = randInt(`flake-branches-${variant}`, 2, 3);
  const branches: Branch[] = [];
  for (let b = 0; b < branchCount; b++) {
    // Branches march outward along the arm; the outer ones are shorter.
    const span = 0.56 / branchCount;
    const t =
      0.3 + b * span + randRange(`flake-bt-${variant}-${b}`, 0, span * 0.5);
    branches.push({
      t,
      length: randRange(`flake-bl-${variant}-${b}`, 0.3, 0.42) * (1 - t * 0.55),
      angle: randRange(
        `flake-ba-${variant}-${b}`,
        Math.PI / 4.6,
        Math.PI / 3.6,
      ),
    });
  }

  return {
    variant,
    armLength: randRange(`flake-arm-${variant}`, 0.86, 1),
    branches,
    coreRadius: randRange(`flake-core-${variant}`, 0.11, 0.19),
    coreIsStar: rand(`flake-corestar-${variant}`) < 0.45,
    tipFork:
      rand(`flake-tip-${variant}`) < 0.6
        ? randRange(`flake-tiplen-${variant}`, 0.1, 0.17)
        : 0,
    strokeScale: randRange(`flake-stroke-${variant}`, 0.8, 1.2),
  };
};

/** Strokes one flake, centred at (cx, cy), at radius `r`. */
const strokeFlake = (
  ctx: CanvasRenderingContext2D,
  shape: FlakeShape,
  cx: number,
  cy: number,
  r: number,
) => {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.1, r * 0.052 * shape.strokeScale);

  const armEnd = shape.armLength * r;

  ctx.beginPath();
  for (let arm = 0; arm < 6; arm++) {
    const a = (arm * Math.PI) / 3;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // Rotate a point given in arm-local space (x along the arm) into
    // canvas space. Doing the maths here rather than with save/rotate
    // keeps the whole glyph in a single path.
    const px = (x: number, y: number) => cx + x * ca - y * sa;
    const py = (x: number, y: number) => cy + x * sa + y * ca;

    ctx.moveTo(px(0, 0), py(0, 0));
    ctx.lineTo(px(armEnd, 0), py(armEnd, 0));

    for (const branch of shape.branches) {
      const bx = branch.t * armEnd;
      const bl = branch.length * r;
      for (const side of [-1, 1]) {
        ctx.moveTo(px(bx, 0), py(bx, 0));
        ctx.lineTo(
          px(
            bx + Math.cos(branch.angle) * bl,
            side * Math.sin(branch.angle) * bl,
          ),
          py(
            bx + Math.cos(branch.angle) * bl,
            side * Math.sin(branch.angle) * bl,
          ),
        );
      }
    }

    if (shape.tipFork > 0) {
      const fl = shape.tipFork * r;
      for (const side of [-1, 1]) {
        ctx.moveTo(px(armEnd, 0), py(armEnd, 0));
        ctx.lineTo(
          px(
            armEnd + Math.cos(Math.PI / 3) * fl,
            side * Math.sin(Math.PI / 3) * fl,
          ),
          py(
            armEnd + Math.cos(Math.PI / 3) * fl,
            side * Math.sin(Math.PI / 3) * fl,
          ),
        );
      }
    }
  }

  // Centre motif: a hexagon, or a six-point star sharing the arm axes.
  const core = shape.coreRadius * r;
  if (shape.coreIsStar) {
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.moveTo(cx - Math.cos(a) * core, cy - Math.sin(a) * core);
      ctx.lineTo(cx + Math.cos(a) * core, cy + Math.sin(a) * core);
    }
  } else {
    for (let i = 0; i <= 6; i++) {
      const a = (i * Math.PI) / 3 + Math.PI / 6;
      const x = cx + Math.cos(a) * core;
      const y = cy + Math.sin(a) * core;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
};

export type FlakeSprite = {
  canvas: HTMLCanvasElement;
  /** Sprite is square; half its side, i.e. the rotation centre. */
  half: number;
};

/**
 * Renders a shape at a size bracket once. Sprites are keyed on
 * shape+bracket so the 55 flakes share a much smaller set of canvases.
 */
export const buildFlakeSprite = (
  shape: FlakeShape,
  size: number,
  blur: number,
  theme: Theme,
): FlakeSprite | null => {
  const r = size / 2;
  const strokeWidth = Math.max(1.1, r * 0.052 * shape.strokeScale);
  // Tip forks and outer branches reach a little past the arm end.
  const reach =
    r * (shape.armLength + Math.max(shape.tipFork, 0.12)) + strokeWidth;
  const half = Math.ceil(reach + blur * 3 + 2);

  const sharp = createCanvas(half * 2, half * 2);
  const sharpCtx = sharp?.getContext("2d");
  if (!sharp || !sharpCtx) return null;
  sharpCtx.strokeStyle = rgba(theme.snow, 1);
  strokeFlake(sharpCtx, shape, half, half, r);

  if (blur <= 0.05) return { canvas: sharp, half };

  // Blur as a single pass over the finished glyph. Blurring each stroke
  // instead would pile the overlaps up into bright knots at the joins.
  const soft = createCanvas(half * 2, half * 2);
  const softCtx = soft?.getContext("2d");
  if (!soft || !softCtx) return { canvas: sharp, half };
  softCtx.filter = `blur(${blur.toFixed(2)}px)`;
  softCtx.drawImage(sharp, 0, 0);
  softCtx.filter = "none";
  return { canvas: soft, half };
};

export type Flake = {
  id: number;
  size: number;
  /** 0 = smallest and most distant, 1 = largest and nearest. */
  depth: number;
  opacity: number;
  shapeVariant: number;
  /** Bracketed size the sprite is actually rendered at. */
  bracketSize: number;
  bracketBlur: number;
  spriteKey: string;
  /** Whole traversals of the fall path completed in 240 frames. */
  traversals: number;
  /** Total vertical distance of one traversal, in px. */
  travel: number;
  topMargin: number;
  /** Fraction of a traversal already completed at frame 0. */
  phase: number;
  driftAmplitude: number;
  driftCycles: number;
  driftPhase: number;
  /** Signed whole turns over 240 frames. */
  spinTurns: number;
  spinPhase: number;
};

const bracket = (depth: number) => {
  const index = Math.min(
    SNOW_SIZE_BRACKETS - 1,
    Math.floor(depth * SNOW_SIZE_BRACKETS),
  );
  return index / (SNOW_SIZE_BRACKETS - 1);
};

/** `scale` converts the 4K-quoted lengths in config.ts to composition px. */
export const generateFlakes = (
  width: number,
  height: number,
  scale: number,
): Flake[] => {
  const flakes: Flake[] = [];

  for (let id = 0; id < SNOWFLAKE_COUNT; id++) {
    // Biased toward the small end so the near, heavily blurred flakes stay
    // occasional rather than dominating the frame.
    const depth = Math.pow(rand(`flake-depth-${id}`), 1.25);
    const size =
      (SNOW_SIZE_RANGE[0] + depth * (SNOW_SIZE_RANGE[1] - SNOW_SIZE_RANGE[0])) *
      scale;
    const bracketDepth = bracket(depth);
    const bracketSize =
      (SNOW_SIZE_RANGE[0] +
        bracketDepth * (SNOW_SIZE_RANGE[1] - SNOW_SIZE_RANGE[0])) *
      scale;
    const bracketBlur =
      (SNOW_BLUR_RANGE[0] +
        bracketDepth * (SNOW_BLUR_RANGE[1] - SNOW_BLUR_RANGE[0])) *
      scale;

    // Nearer flakes fall faster, and a whole number of traversals per loop
    // is what lets the fall close seamlessly at frame 240.
    const traversals =
      depth < 0.4
        ? SNOW_TRAVERSALS[0]
        : depth < 0.78
          ? SNOW_TRAVERSALS[1]
          : SNOW_TRAVERSALS[2];

    const topMargin =
      randRange(`flake-top-${id}`, SNOW_WRAP_MARGIN[0], SNOW_WRAP_MARGIN[1]) *
      scale;
    const bottomMargin =
      randRange(
        `flake-bottom-${id}`,
        SNOW_WRAP_MARGIN[0],
        SNOW_WRAP_MARGIN[1],
      ) * scale;

    const shapeVariant = randInt(
      `flake-variant-${id}`,
      0,
      SNOW_SHAPE_VARIANTS - 1,
    );

    flakes.push({
      id,
      size,
      depth,
      opacity:
        SNOW_OPACITY_RANGE[0] +
        rand(`flake-opacity-${id}`) *
          (SNOW_OPACITY_RANGE[1] - SNOW_OPACITY_RANGE[0]),
      shapeVariant,
      bracketSize,
      bracketBlur,
      spriteKey: `${shapeVariant}@${bracketSize.toFixed(2)}`,
      traversals,
      travel: height + topMargin + bottomMargin,
      topMargin,
      phase: rand(`flake-phase-${id}`),
      driftAmplitude:
        randRange(
          `flake-drift-${id}`,
          SNOW_DRIFT_RANGE[0],
          SNOW_DRIFT_RANGE[1],
        ) * scale,
      driftCycles: randInt(`flake-driftcycles-${id}`, 1, 2),
      driftPhase: randRange(`flake-driftphase-${id}`, 0, TAU),
      spinTurns:
        randSign(`flake-spinsign-${id}`) *
        randInt(`flake-spin-${id}`, SNOW_SPIN_TURNS[0], SNOW_SPIN_TURNS[1]),
      spinPhase: randRange(`flake-spinphase-${id}`, 0, TAU),
    });
  }

  return flakes;
};

/**
 * Where a flake is, and how it is turned, at `frame`. Progress advances by
 * exactly `traversals` over 240 frames, so at frame 240 the flake is back
 * where it started and on the same wrap cycle.
 */
export const flakeTransform = (flake: Flake, frame: number, width: number) => {
  const progress =
    flake.phase + (flake.traversals * frame) / DURATION_IN_FRAMES;
  const cycle = Math.floor(progress);
  const within = progress - cycle;

  // Each time it wraps above the top it comes back at a new seeded
  // horizontal position. Cycling that seed modulo `traversals` keeps the
  // sequence of positions periodic over the loop.
  const slot =
    ((cycle % flake.traversals) + flake.traversals) % flake.traversals;
  const baseX = randRange(`flake-x-${flake.id}-${slot}`, -0.05, 1.05) * width;

  return {
    x:
      baseX +
      flake.driftAmplitude *
        Math.sin(
          (TAU * flake.driftCycles * frame) / DURATION_IN_FRAMES +
            flake.driftPhase,
        ),
    y: -flake.topMargin + within * flake.travel,
    rotation:
      flake.spinPhase + (TAU * flake.spinTurns * frame) / DURATION_IN_FRAMES,
  };
};
