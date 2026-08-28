import { buildSpriteCache, type SpriteCache } from "./icons";
import { generateLayout, type GlitchEvent, type Layout } from "./layout";
import {
  BLOCK,
  CANVAS_H,
  CANVAS_W,
  LOOP_FRAMES,
  planeGeom,
  screenDeltaToLocal,
  type PlaneGeom,
} from "./plane";
import { rand } from "./rng";
import type { VariantConfig, VariantKey } from "./variants";

/**
 * Heavy resources created once per variant mount and reused every frame:
 * the three depth buffers, bloom + scratch buffers, sprite cache, layout,
 * and the pre-generated grain tile.
 */
export interface RenderEnv {
  key: VariantKey;
  cfg: VariantConfig;
  layout: Layout;
  sprites: SpriteCache;
  buffers: {
    near: HTMLCanvasElement;
    mid: HTMLCanvasElement;
    far: HTMLCanvasElement;
    bloom: HTMLCanvasElement;
    scratch: HTMLCanvasElement;
  };
  ctx: {
    near: CanvasRenderingContext2D;
    mid: CanvasRenderingContext2D;
    far: CanvasRenderingContext2D;
    bloom: CanvasRenderingContext2D;
    scratch: CanvasRenderingContext2D;
  };
  grainTile: HTMLCanvasElement;
}

const GRAIN_SIZE = 512;

const makeBuffer = (): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = CANVAS_W;
  c.height = CANVAS_H;
  return c;
};

const makeGrainTile = (): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = GRAIN_SIZE;
  c.height = GRAIN_SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const img = ctx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  for (let i = 0; i < GRAIN_SIZE * GRAIN_SIZE; i++) {
    // Mid-gray-centred noise: draws as a near-no-op under "overlay".
    const g = Math.round(128 + (rand(`grain-${i}`) - 0.5) * 220);
    img.data[i * 4] = g;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

export const createEnv = (key: VariantKey, cfg: VariantConfig): RenderEnv => {
  const iconNames = cfg.iconSet.filter((i) => i.weight > 0).map((i) => i.name);
  const buffers = {
    near: makeBuffer(),
    mid: makeBuffer(),
    far: makeBuffer(),
    bloom: makeBuffer(),
    scratch: makeBuffer(),
  };
  const ctx = Object.fromEntries(
    Object.entries(buffers).map(([k, c]) => [k, c.getContext("2d")]),
  ) as RenderEnv["ctx"];
  return {
    key,
    cfg,
    layout: generateLayout(key, cfg),
    sprites: buildSpriteCache(iconNames, cfg.iconState, cfg.palette),
    buffers,
    ctx,
    grainTile: makeGrainTile(),
  };
};

/**
 * Everything about the current frame that draw calls need, computed once per
 * frame as a pure function of the frame number.
 */
export interface FrameState {
  frame: number; // already wrapped modulo LOOP_FRAMES
  geom: PlaneGeom;
  /** Sheet translation along the drift axis, in local units. */
  driftY: number;
  /** Block copy indices to draw so the visible range is covered. */
  kMin: number;
  kMax: number;
  /** 0..1 envelope of the "separating" drift mode (0 at the loop seam). */
  sepEnv: number;
  /** Max outward creep in screen px for the farthest-out tiles. */
  sepMax: number;
  glitch: GlitchEvent | null;
  glitchFlash: Set<number>;
}

export const computeFrameState = (
  cfg: VariantConfig,
  layout: Layout,
  rawFrame: number,
): FrameState => {
  const frame = ((rawFrame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  const t = frame / LOOP_FRAMES;
  // Ambient camera drift: ±10px on a closed path, no zoom.
  const camX = 10 * Math.sin(2 * Math.PI * t);
  const camY = 7 * Math.sin(4 * Math.PI * t + 1.3);
  const geom = planeGeom(cfg, camX, camY);
  // The sheet moves exactly one BLOCK along local -y per loop.
  const driftY = t * BLOCK;

  // Which block copies cover the (expanded) screen? Map the four corners of
  // the padded screen rect into local space and take the y range.
  const pad = 620;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const [sx, sy] of [
    [-pad, -pad],
    [CANVAS_W + pad, -pad],
    [-pad, CANVAS_H + pad],
    [CANVAS_W + pad, CANVAS_H + pad],
  ]) {
    const [, ly] = screenDeltaToLocal(geom, sx - geom.tx, sy - geom.ty);
    yMin = Math.min(yMin, ly);
    yMax = Math.max(yMax, ly);
  }
  // Element drawn at yDraw = y + k*BLOCK - driftY with y ∈ [0, BLOCK).
  const kMin = Math.floor((yMin + driftY) / BLOCK) - 1;
  const kMax = Math.floor((yMax + driftY) / BLOCK) + 1;

  const sepEnv =
    cfg.driftMode === "separating" ? 0.5 * (1 - Math.cos(2 * Math.PI * t)) : 0;

  let glitch: GlitchEvent | null = null;
  const glitchFlash = new Set<number>();
  for (const ev of layout.glitches) {
    const dt = (frame - ev.start + LOOP_FRAMES) % LOOP_FRAMES;
    if (dt < ev.dur) {
      glitch = ev;
      for (const i of ev.flash) glitchFlash.add(i);
      break;
    }
  }

  return {
    frame,
    geom,
    driftY,
    kMin,
    kMax,
    sepEnv,
    sepMax: 320,
    glitch,
    glitchFlash,
  };
};

/**
 * "Separating" drift: outward creep away from the frame centre, amplitude
 * scaled by distance from centre, on a closed envelope so the field
 * reassembles by frame 450. Returns a plane-LOCAL offset to add before
 * drawing, derived from the element's screen position.
 */
export const separationOffset = (
  fs: FrameState,
  sx: number,
  sy: number,
  amp: number,
  angleJitter: number,
): [number, number] => {
  if (fs.sepEnv === 0) return [0, 0];
  const dx = sx - CANVAS_W / 2;
  const dy = sy - CANVAS_H / 2;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return [0, 0];
  const ang = Math.atan2(dy, dx) + angleJitter;
  const mag =
    fs.sepMax * fs.sepEnv * amp * Math.min(1, (dist / 1650) ** 1.3);
  return screenDeltaToLocal(
    fs.geom,
    Math.cos(ang) * mag,
    Math.sin(ang) * mag,
  );
};
