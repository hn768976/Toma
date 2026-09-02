// Vendored from remotion-lib (~/projects/remotion-lib/src).
// Do not edit here: change it in the library and re-run
// `node scripts/sync-lib.mjs`. Copied in so this project renders standalone.
import { hexToRgb, rgba, shade } from "./colorUtils";
import { noiseField } from "./noiseField";
import { seededStream } from "./seededRandom";

/**
 * Paper mottle — the fine irregular tonal variation that stops newsprint from
 * reading as a flat fill. Two layers at very low opacity:
 *
 *   · a soft mid-scale cloud, generated at 1/8 resolution and scaled up, which
 *     gives broad blotchiness;
 *   · a sparse per-pixel speckle for the fibrous tooth of cheap paper.
 *
 * Both stay around 4% opacity. Any more and it stops looking like paper and
 * starts looking like a texture overlay.
 */
export const paintPaperMottle = (
  ctx: CanvasRenderingContext2D,
  opts: {
    seed: string;
    x: number;
    y: number;
    w: number;
    h: number;
    inkHex: string;
    opacity?: number;
  },
): void => {
  const { seed, x, y, w, h, inkHex } = opts;
  const opacity = opts.opacity ?? 0.04;

  const lowW = Math.max(4, Math.round(w / 8));
  const lowH = Math.max(4, Math.round(h / 8));
  const cloud = document.createElement("canvas");
  cloud.width = lowW;
  cloud.height = lowH;
  const cctx = cloud.getContext("2d");
  if (!cctx) return;

  const field = noiseField({ seed: `${seed}:mottle`, octaves: 3, latticeW: 24, latticeH: 24 });
  const img = cctx.createImageData(lowW, lowH);
  const data = img.data;
  const ink = hexToRgb(inkHex);
  const ir = ink.r;
  const ig = ink.g;
  const ib = ink.b;

  for (let py = 0; py < lowH; py++) {
    for (let px = 0; px < lowW; px++) {
      const v = field.sample((px / lowW) * 6, (py / lowH) * 6);
      const i = (py * lowW + px) * 4;
      data[i] = ir;
      data[i + 1] = ig;
      data[i + 2] = ib;
      // Bias so the mottle is mostly light with occasional darker patches.
      data[i + 3] = Math.round(Math.max(0, v - 0.35) * 255);
    }
  }
  cctx.putImageData(img, 0, 0);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cloud, x, y, w, h);
  ctx.restore();

  // Fine speckle. Drawn at half resolution and scaled by 2 so a single dot
  // covers a couple of pixels — newsprint tooth, not video noise.
  const specW = Math.max(2, Math.round(w / 2));
  const specH = Math.max(2, Math.round(h / 2));
  const spec = document.createElement("canvas");
  spec.width = specW;
  spec.height = specH;
  const sctx = spec.getContext("2d");
  if (!sctx) return;
  const simg = sctx.createImageData(specW, specH);
  const sdata = simg.data;
  const rand = seededStream(`${seed}:speckle`);
  for (let i = 0; i < specW * specH; i++) {
    const r = rand();
    if (r > 0.955) {
      const o = i * 4;
      sdata[o] = ir;
      sdata[o + 1] = ig;
      sdata[o + 2] = ib;
      sdata[o + 3] = Math.round(60 + rand() * 160);
    }
  }
  sctx.putImageData(simg, 0, 0);

  ctx.save();
  ctx.globalAlpha = opacity * 0.85;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(spec, x, y, w, h);
  ctx.restore();
};

/**
 * A very soft uneven lightening across the sheet, as though the paper is not
 * quite flat against the wall. Keeps large clippings from looking like solid
 * colour.
 */
export const paintPaperSheen = (
  ctx: CanvasRenderingContext2D,
  opts: { x: number; y: number; w: number; h: number; paperHex: string; angle: number },
): void => {
  const { x, y, w, h, paperHex, angle } = opts;
  const cx = Math.cos(angle);
  const sy = Math.sin(angle);
  const grad = ctx.createLinearGradient(x, y, x + w * cx, y + h * sy);
  grad.addColorStop(0, shade(paperHex, 0.16, 0.55));
  grad.addColorStop(0.55, rgba(paperHex, 0));
  grad.addColorStop(1, shade(paperHex, -0.12, 0.4));
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
};
