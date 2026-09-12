// Per-frame canvas renderer for the celestial flythrough.
//
// Draw order is back-to-front and almost everything is additive
// ("lighter") over a near-black sky, which is how light actually
// accumulates in a long-exposure space plate: overlapping cloud and
// stars brighten each other instead of occluding.

import {
  CAMERA_ROLL_DEG,
  CAMERA_TRAVEL,
  Palette,
  TWINKLE_PERIOD,
  VANISHING_X,
  VANISHING_Y,
} from "./constants";
import { Scene } from "./scene";
import { TextureSet } from "./textures";

export type DrawOptions = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  frame: number;
  durationInFrames: number;
  palette: Palette;
  textures: TextureSet;
  scene: Scene;
  /** 1 at 1080p, 2 at 4K. */
  resolutionScale: number;
};

type Camera = {
  camZ: number;
  roll: number;
  vpX: number;
  vpY: number;
};

const getCamera = (
  frame: number,
  durationInFrames: number,
  width: number,
  height: number,
): Camera => {
  const t = durationInFrames <= 1 ? 0 : frame / (durationInFrames - 1);
  return {
    camZ: CAMERA_TRAVEL * t,
    roll: (CAMERA_ROLL_DEG * t * Math.PI) / 180,
    // A few pixels of sway across the clip. Too small to read as a pan,
    // just enough that the push-in doesn't feel mechanically centred.
    vpX: width * VANISHING_X + Math.sin(t * Math.PI * 0.9) * width * 0.008,
    vpY: height * VANISHING_Y + Math.sin(t * Math.PI * 0.6 + 1.1) * height * 0.006,
  };
};

type Projected = { sx: number; sy: number; growth: number };

// Everything shares one projection: offset from the vanishing point and
// size both scale by z / (z - camZ), then the offset is rolled.
const project = (
  nx: number,
  ny: number,
  z: number,
  cam: Camera,
  width: number,
  height: number,
): Projected | null => {
  const zr = z - cam.camZ;
  if (zr < 0.6) return null;
  const growth = z / zr;

  const px = nx * width * growth;
  const py = ny * height * growth;
  const c = Math.cos(cam.roll);
  const s = Math.sin(cam.roll);

  return {
    sx: cam.vpX + px * c - py * s,
    sy: cam.vpY + px * s + py * c,
    growth,
  };
};

const drawBackground = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cam: Camera,
  palette: Palette,
) => {
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const radius = Math.hypot(width, height) * 0.72;
  const grad = ctx.createRadialGradient(
    cam.vpX,
    cam.vpY,
    0,
    cam.vpX,
    cam.vpY,
    radius,
  );
  grad.addColorStop(0, palette.backgroundInner);
  grad.addColorStop(1, palette.backgroundOuter);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
};

const drawPuffs = (o: DrawOptions, cam: Camera) => {
  const { ctx, width, height, textures, scene } = o;
  ctx.globalCompositeOperation = "lighter";

  for (const puff of scene.puffs) {
    const p = project(puff.nx, puff.ny, puff.z, cam, width, height);
    if (!p) continue;

    const size = puff.sizeNorm * width * p.growth;
    const half = size / 2;
    if (
      p.sx + half < 0 ||
      p.sx - half > width ||
      p.sy + half < 0 ||
      p.sy - half > height
    ) {
      continue;
    }

    const bank =
      puff.kind === "core"
        ? textures.corePuffs
        : puff.kind === "haze"
          ? textures.hazePuffs
          : textures.puffs;
    const tex = bank[puff.texIndex % bank.length];

    // Cloud that swells past the frame is material the camera has
    // effectively entered; easing it out avoids a flat wash of colour
    // filling the screen at the end of the push.
    const overscale = size / (width * 1.6);
    const fade = overscale > 1 ? Math.max(0, 1 - (overscale - 1) * 1.1) : 1;
    if (fade <= 0) continue;

    ctx.save();
    ctx.translate(p.sx, p.sy);
    ctx.rotate(puff.rotation + cam.roll);
    ctx.globalAlpha = Math.min(1, puff.alpha * fade);
    ctx.drawImage(tex, -half, -half, size, size);
    ctx.restore();
  }
};

const drawWarmKnots = (o: DrawOptions, cam: Camera) => {
  const { ctx, width, height, textures, scene } = o;
  ctx.globalCompositeOperation = "lighter";

  for (const knot of scene.warmKnots) {
    const p = project(knot.nx, knot.ny, knot.z, cam, width, height);
    if (!p) continue;
    const size = knot.sizeNorm * width * p.growth;
    const half = size / 2;
    if (
      p.sx + half < 0 ||
      p.sx - half > width ||
      p.sy + half < 0 ||
      p.sy - half > height
    ) {
      continue;
    }
    const tex = textures.warmGlows[knot.texIndex % textures.warmGlows.length];
    ctx.globalAlpha = knot.alpha;
    ctx.drawImage(tex, p.sx - half, p.sy - half, size, size);
  }
};

const drawStars = (o: DrawOptions, cam: Camera) => {
  const { ctx, width, height, textures, scene, frame } = o;
  ctx.globalCompositeOperation = "lighter";

  const twinkleT = (2 * Math.PI * frame) / TWINKLE_PERIOD;

  for (const star of scene.stars) {
    const p = project(star.nx, star.ny, star.z, cam, width, height);
    if (!p) continue;

    const size = star.sizeNorm * width * p.growth;
    const half = size / 2;
    if (
      p.sx + half < 0 ||
      p.sx - half > width ||
      p.sy + half < 0 ||
      p.sy - half > height
    ) {
      continue;
    }

    const twinkle = 1 + star.twinkleAmount * Math.sin(twinkleT + star.twinklePhase);
    ctx.globalAlpha = Math.min(1, star.alpha * twinkle);
    const tex = textures.stars[star.texIndex % textures.stars.length];
    ctx.drawImage(tex, p.sx - half, p.sy - half, size, size);
  }
};

const drawHeroStars = (o: DrawOptions, cam: Camera) => {
  const { ctx, width, height, textures, scene, frame } = o;
  ctx.globalCompositeOperation = "lighter";
  const twinkleT = (2 * Math.PI * frame) / TWINKLE_PERIOD;

  for (const star of scene.heroStars) {
    const p = project(star.nx, star.ny, star.z, cam, width, height);
    if (!p) continue;

    const size = star.sizeNorm * width * p.growth;
    const half = size / 2;
    if (
      p.sx + half < -size ||
      p.sx - half > width + size ||
      p.sy + half < -size ||
      p.sy - half > height + size
    ) {
      continue;
    }

    const twinkle = 1 + star.twinkleAmount * Math.sin(twinkleT + star.twinklePhase);

    // Wide halo underneath, then the star itself on top.
    const glowSize = size * 3.2;
    ctx.globalAlpha = Math.min(1, star.alpha * 0.34 * twinkle);
    ctx.drawImage(
      textures.whiteGlow,
      p.sx - glowSize / 2,
      p.sy - glowSize / 2,
      glowSize,
      glowSize,
    );

    ctx.globalAlpha = Math.min(1, star.alpha * twinkle);
    const tex = textures.stars[star.texIndex % textures.stars.length];
    ctx.drawImage(tex, p.sx - half, p.sy - half, size, size);

  }
};

// Cheap bloom: downscale the frame hard, then add it back magnified. The
// bilinear filtering on the way back up is the blur, and because the sky
// is almost black only genuinely bright pixels survive the round trip
// with enough energy to show. Far cheaper than ctx.filter = blur() at 4K.
let bloomCanvas: HTMLCanvasElement | null = null;

const applyBloom = (o: DrawOptions) => {
  const { ctx, width, height } = o;
  const bw = Math.max(2, Math.round(width / 10));
  const bh = Math.max(2, Math.round(height / 10));

  if (!bloomCanvas) {
    bloomCanvas = document.createElement("canvas");
  }
  if (bloomCanvas.width !== bw || bloomCanvas.height !== bh) {
    bloomCanvas.width = bw;
    bloomCanvas.height = bh;
  }
  const bctx = bloomCanvas.getContext("2d");
  if (!bctx) return;

  bctx.globalCompositeOperation = "copy";
  bctx.globalAlpha = 1;
  bctx.drawImage(ctx.canvas, 0, 0, bw, bh);

  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.22;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bloomCanvas, 0, 0, width, height);
};

const drawVignette = (o: DrawOptions, cam: Camera) => {
  const { ctx, width, height } = o;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const radius = Math.hypot(width, height) * 0.62;
  const grad = ctx.createRadialGradient(
    cam.vpX,
    cam.vpY,
    radius * 0.32,
    cam.vpX,
    cam.vpY,
    radius,
  );
  grad.addColorStop(0, "rgba(0, 0, 0, 0)");
  grad.addColorStop(0.62, "rgba(0, 0, 0, 0.2)");
  grad.addColorStop(1, "rgba(1, 2, 6, 0.72)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
};

export const drawFrame = (o: DrawOptions) => {
  const { ctx, width, height, frame, durationInFrames, palette } = o;
  const cam = getCamera(frame, durationInFrames, width, height);

  drawBackground(ctx, width, height, cam, palette);
  drawPuffs(o, cam);
  drawWarmKnots(o, cam);
  drawStars(o, cam);
  drawHeroStars(o, cam);
  applyBloom(o);
  drawVignette(o, cam);

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
};
