import * as C from './constants';
import type {FieldElement} from './field';
import type {Sprite} from './sprites';

export interface Scratch {
  small: HTMLCanvasElement;
  bloomA: HTMLCanvasElement;
  bloomB: HTMLCanvasElement;
  vignette: HTMLCanvasElement;
}

const mod1 = (n: number) => ((n % 1) + 1) % 1;

/**
 * Handheld camera: a small drift perpendicular to the diagonal. Both sine
 * terms have periods that divide 540, so the move closes on the loop.
 */
export const cameraOffset = (f: number) =>
  C.CAM_A * Math.sin((2 * Math.PI * f) / C.DURATION) +
  C.CAM_B * Math.sin((4 * Math.PI * f) / C.DURATION + C.CAM_PHASE);

/**
 * Two-stop bloom.
 *
 * The frame is first downscaled unfiltered, and only then does the bright-pass
 * and blur run - on a surface an eighth the size. Filtering during the 4K
 * downscale instead would force a full-resolution filtered intermediate, which
 * dominates the frame budget in software rasterisation.
 */
const bloom = (
  g: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  s: Scratch,
  w: number,
  h: number,
) => {
  const gs = s.small.getContext('2d');
  const ga = s.bloomA.getContext('2d');
  const gb = s.bloomB.getContext('2d');
  if (!gs || !ga || !gb) return;

  gs.filter = 'none';
  gs.globalCompositeOperation = 'copy';
  gs.drawImage(source, 0, 0, s.small.width, s.small.height);
  gs.globalCompositeOperation = 'source-over';

  ga.filter = 'contrast(2.4) brightness(1.18) blur(3px)';
  ga.globalCompositeOperation = 'copy';
  ga.drawImage(s.small, 0, 0);
  ga.filter = 'none';
  ga.globalCompositeOperation = 'source-over';

  gb.filter = 'blur(2.5px)';
  gb.globalCompositeOperation = 'copy';
  gb.drawImage(s.bloomA, 0, 0, s.bloomB.width, s.bloomB.height);
  gb.filter = 'none';
  gb.globalCompositeOperation = 'source-over';

  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.22;
  g.drawImage(s.bloomA, 0, 0, w, h);
  g.globalAlpha = 0.15;
  g.drawImage(s.bloomB, 0, 0, w, h);
  g.restore();
};

const grainPass = (
  g: CanvasRenderingContext2D,
  tiles: HTMLCanvasElement[],
  f: number,
  w: number,
  h: number,
  rand: (seed: string) => number,
) => {
  if (tiles.length === 0) return;
  const tile = tiles[f % tiles.length] as HTMLCanvasElement;
  const pattern = g.createPattern(tile, 'repeat');
  if (!pattern) return;
  const ox = Math.floor(rand(`grain-ox-${f}`) * C.GRAIN_TILE_PX);
  const oy = Math.floor(rand(`grain-oy-${f}`) * C.GRAIN_TILE_PX);
  g.save();
  g.globalAlpha = C.GRAIN_ALPHA;
  g.translate(-ox, -oy);
  g.fillStyle = pattern;
  g.fillRect(0, 0, w + C.GRAIN_TILE_PX, h + C.GRAIN_TILE_PX);
  g.restore();
};

export interface DrawArgs {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  field: FieldElement[];
  sprites: Sprite[];
  order: number[];
  grain: HTMLCanvasElement[];
  scratch: Scratch;
  frame: number;
  width: number;
  height: number;
  rand: (seed: string) => number;
}

/**
 * Draws one frame. Pure in the frame number: given the same `frame` it emits
 * the same pixels, and frame 540 is identical to frame 0.
 *
 * Every element is a single blit. Its rotation, depth blur and motion smear
 * were all baked into its sprite when the field was built, so nothing here
 * lays out text, filters, or re-rasterises anything.
 */
export const drawFrame = ({
  ctx,
  canvas,
  field,
  sprites,
  order,
  grain,
  scratch,
  frame,
  width,
  height,
  rand,
}: DrawArgs) => {
  const f = ((frame % C.DURATION) + C.DURATION) % C.DURATION;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';

  ctx.fillStyle = C.COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  const cam = cameraOffset(f);
  const sx = width / C.WIDTH;
  const sy = height / C.HEIGHT;

  for (const idx of order) {
    const el = field[idx] as FieldElement;
    const sp = sprites[idx] as Sprite;

    const prog = mod1(el.phase - (el.speed * f) / el.travel);
    const u = (prog - 0.5) * el.travel;
    const perp = el.perp + cam;

    const x = (C.CX + C.AX * u + C.PX * perp) * sx;
    const y = (C.CY + C.AY * u + C.PY * perp) * sy;

    const dw = sp.w * sp.m * sx;
    const dh = sp.h * sp.m * sy;

    if (
      x + dw / 2 < 0 ||
      x - dw / 2 > width ||
      y + dh / 2 < 0 ||
      y - dh / 2 > height
    ) {
      continue;
    }

    ctx.globalAlpha = el.alpha;
    ctx.drawImage(sp.canvas, x - dw / 2, y - dh / 2, dw, dh);
  }

  ctx.globalAlpha = 1;

  bloom(ctx, canvas, scratch, width, height);
  ctx.drawImage(scratch.vignette, 0, 0, width, height);
  grainPass(ctx, grain, f, width, height, rand);

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};
