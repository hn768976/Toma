import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import {
  BLOCK_DY,
  BLOCK_W,
  CAMERA_DRIFT,
  COPY_RANGE,
  DURATION_IN_FRAMES,
  GRAIN_ALPHA,
  GRAIN_TILE,
  GRAIN_TILE_COUNT,
  HEIGHT,
  LEAD_SCALE,
  VIGNETTE_STRENGTH,
  WALL_BLOCK_BLEED,
  WALL_BLOCK_DY,
  WALL_BLOCK_W,
  WIDTH,
} from "./constants";
import { bakeClipping, type BakedClipping } from "./Clipping";
import { bakeGrainTiles, paintGrain, paintVignette } from "../lib/filmFinish";
import { BODY_FAMILY, HEADLINE_FAMILY, fontsReady } from "./fonts";
import { buildLayout } from "./layout";
import { bakeWall, paintLightGradient, WALL_BLOCK_H } from "./WallTexture";
import { VARIANTS, type VariantName } from "./variants";

export type ClippingsProps = {
  variant: VariantName;
};

type Baked = {
  wall: HTMLCanvasElement;
  clippings: BakedClipping[];
  grain: HTMLCanvasElement[];
};

export const Clippings: React.FC<ClippingsProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ready = fontsReady();

  const variantDef = VARIANTS[variant];

  // Everything expensive happens exactly once per variant: the wall block,
  // fourteen clipping bitmaps and the grain tiles. `ready` is in the
  // dependency list so nothing is baked with fallback font metrics; because
  // fonts.ts holds a delayRender handle until the faces load, every frame that
  // reaches the encoder is drawn from a bake made with the real fonts.
  const baked = useMemo<Baked | null>(() => {
    if (!ready) return null;
    const specs = buildLayout(variantDef, variant);
    return {
      wall: bakeWall(variantDef.palette, variant),
      clippings: specs.map((spec) =>
        bakeClipping(spec, variantDef.palette, {
          headlineFamily: HEADLINE_FAMILY,
          bodyFamily: BODY_FAMILY,
        }),
      ),
      grain: bakeGrainTiles(variant, { tileSize: GRAIN_TILE, tileCount: GRAIN_TILE_COUNT }),
    };
  }, [ready, variant, variantDef]);

  // Drawing happens once per React render, synchronously, before the browser
  // paints, and is driven only by the frame number. No requestAnimationFrame,
  // no Date.now(), no component state: frame N always produces frame N.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baked) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx, frame, baked, variant);
  });

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      style={{ width: WIDTH, height: HEIGHT, display: "block" }}
    />
  );
};

const drawFrame = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  baked: Baked,
  variant: VariantName,
): void => {
  const { palette, drift } = VARIANTS[variant];
  const sign = drift.sign;

  // t runs 0 -> 1 across the loop. At t = 1 every layer has advanced by
  // exactly one of its own lattice vectors and every oscillator has completed
  // a whole number of cycles, so frame 420 is pixel-identical to frame 0.
  // t is deliberately NOT taken modulo the duration: that would make the
  // identity trivially true and hide a layout that does not really tile.
  const t = frame / DURATION_IN_FRAMES;
  // The grain is the one term indexed by whole frames rather than by t, so it
  // is the one term that needs the modulo to come back round.
  const grainFrame = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;

  // Ambient camera drift on a closed lissajous, well under the ±10px cap.
  const camX = Math.sin(t * Math.PI * 2) * CAMERA_DRIFT;
  const camY = Math.sin(t * Math.PI * 4) * CAMERA_DRIFT * 0.6;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = palette.wallDeep;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ---- wall -------------------------------------------------------------
  const wallTx = sign * t * WALL_BLOCK_W;
  const wallTy = sign * t * WALL_BLOCK_DY;
  ctx.save();
  ctx.translate(camX * 0.45, camY * 0.45);
  for (let k = -COPY_RANGE; k <= COPY_RANGE; k++) {
    const x = k * WALL_BLOCK_W + wallTx;
    if (x > WIDTH || x + WALL_BLOCK_W < 0) continue;
    const y = k * WALL_BLOCK_DY + wallTy - WALL_BLOCK_BLEED;
    ctx.drawImage(baked.wall, x, y, WALL_BLOCK_W, WALL_BLOCK_H);
  }
  ctx.restore();

  paintLightGradient(ctx, { t, width: WIDTH, height: HEIGHT, palette, strength: 0.5 });

  // ---- clippings --------------------------------------------------------
  const tx = sign * t * BLOCK_W;
  const ty = sign * t * BLOCK_DY;

  ctx.save();
  ctx.translate(camX, camY);
  for (let k = -COPY_RANGE; k <= COPY_RANGE; k++) {
    const blockX = k * BLOCK_W + tx;
    const blockY = k * BLOCK_DY + ty;
    for (let i = 0; i < baked.clippings.length; i++) {
      drawClipping(ctx, baked.clippings[i], blockX, blockY, frame, sign);
    }
  }
  ctx.restore();

  // ---- finish -----------------------------------------------------------
  // A faint global pass of the same travelling light, so the clippings are lit
  // by it too rather than sitting on a wall that is lit alone.
  paintLightGradient(ctx, { t, width: WIDTH, height: HEIGHT, palette, strength: 0.14 });
  paintVignette(ctx, WIDTH, HEIGHT, palette.wallDark, VIGNETTE_STRENGTH);
  paintGrain(ctx, baked.grain, grainFrame, WIDTH, HEIGHT, GRAIN_ALPHA);
};

const drawClipping = (
  ctx: CanvasRenderingContext2D,
  baked: BakedClipping,
  blockX: number,
  blockY: number,
  frame: number,
  sign: number,
): void => {
  const { spec, canvas, pad } = baked;

  // Bob periods are exact divisors of 420, so the raw frame index can be used
  // directly: every sheet is back at its starting offset on frame 420.
  const bob =
    Math.sin((frame / spec.bobPeriod) * Math.PI * 2 + spec.bobPhase) * spec.bobAmp;

  const cx = blockX + spec.x;
  const cy = blockY + spec.y + bob;

  // Sheets nearer the leading edge of the drift sit marginally closer to
  // camera. Clamped so off-screen sheets do not run away in scale; total
  // spread is 7%, under the 8% ceiling.
  const lead = Math.max(-1, Math.min(1, (cx / WIDTH - 0.5) * 2));
  const scale = 1 + LEAD_SCALE * lead * sign;

  // Cull anything that cannot touch the frame. Half the sheets in any block
  // are off-screen at a given moment, and skipping them is most of the reason
  // this renders at 4K at all.
  const reach = (Math.max(spec.w, spec.h) / 2 + pad) * scale * 1.05;
  if (cx + reach < 0 || cx - reach > WIDTH || cy + reach < 0 || cy - reach > HEIGHT) {
    return;
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spec.rotation);
  ctx.scale(scale, scale);
  ctx.drawImage(canvas, -(spec.w / 2 + pad), -(spec.h / 2 + pad));
  ctx.restore();
};
