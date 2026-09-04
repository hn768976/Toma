import {clamp, sfbm3, smoothstep, TAU, waveSum} from '../lib/noise';
import type {CurtainSpec, Palette, Variant} from './config';

/**
 * A curtain is drawn as a dense row of vertical strips. Each strip is one
 * `drawImage` of a pre-baked 1D colour ramp (hot green at the lower lip,
 * cooling up through teal to violet-pink as it dissolves), scaled to that
 * column's height. Column-to-column brightness variation *is* the striation —
 * the detail that separates an aurora from a green smear.
 *
 * Two motions are decoupled on purpose:
 *   1. the base path undulates like fabric (looping 3D noise on a time circle);
 *   2. the striations travel along the curtain at their own speed and
 *      direction (sine trains whose phase advances a whole number of cycles).
 */

const rampCache = new Map<string, HTMLCanvasElement>();

/**
 * `lip` is how much of the curtain's height the bright lower edge takes to
 * come up to full strength. A hard 0 makes the lip read as a drawn line
 * rather than as light, so even the crispest curtain gets a thin ramp; broad
 * diffuse sheets get a much wider one.
 */
const getRamp = (palette: Palette, h: number, lip: number) => {
  const key = `${palette.key}-${h}-${lip}`;
  const hit = rampCache.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = 4;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  // Bottom of the canvas is the bottom of the curtain.
  const g = ctx.createLinearGradient(0, h, 0, 0);
  const first = palette.stops[0];
  const [fr, fg, fb] = hexToRgb(first.color);
  g.addColorStop(0, `rgba(${fr},${fg},${fb},0)`);
  g.addColorStop(lip * 0.42, `rgba(${fr},${fg},${fb},${first.alpha * 0.6})`);
  for (const s of palette.stops) {
    const [r, gr, b] = hexToRgb(s.color);
    const at = lip + clamp(s.at, 0, 1) * (1 - lip);
    g.addColorStop(clamp(at, 0, 1), `rgba(${r},${gr},${b},${s.alpha})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, h);
  rampCache.set(key, c);
  return c;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/** Long, staggered swell so the whole display breathes over the 30 seconds. */
const swell = (c: CurtainSpec, t: number) => {
  const a = Math.sin(TAU * (c.swellA * t + c.swellPhA));
  const b = Math.sin(TAU * (c.swellB * t + c.swellPhB));
  return 0.26 + 0.74 * clamp(0.5 + 0.5 * (0.68 * a + 0.32 * b), 0, 1);
};

const striation = (c: CurtainSpec, nx: number, t: number, soften: number) => {
  const v = waveSum(c.striations, nx, t);
  const e = waveSum(c.envelope, nx, t);
  // The wave amplitudes sum to 1 but rarely land near the extremes, so the
  // sum is stretched before it is folded into a 0..1 band value.
  const bands = Math.pow(clamp(0.5 + 1.15 * v, 0, 1), 1.35);
  const env = 0.34 + 0.66 * clamp(0.5 + 1.0 * e, 0, 1);
  const s = 0.22 + 1.15 * bands * env;
  // Broad faint sheets carry much flatter striations than the bright curtains.
  return s + (0.85 - s) * soften;
};

export type CurtainTargets = {
  aurora: CanvasRenderingContext2D;
  bloom: CanvasRenderingContext2D;
  bloomScale: number;
};

const drawCurtain = (
  tg: CurtainTargets,
  c: CurtainSpec,
  palette: Palette,
  gain: number,
  w: number,
  h: number,
  t: number,
) => {
  const ctx = tg.aurora;
  // Two buckets keeps the ramp cache tiny while still separating the crisp
  // dominant curtains from the broad, diffuse sheets.
  const ramp = getRamp(palette, 512, c.soft > 0.35 ? 0.1 : 0.022);
  const ct = Math.cos(TAU * t);
  const st = Math.sin(TAU * t);

  // Resolution-independent column pitch: ~7px at 4K, ~3.5px at 1080p.
  const step = w * 0.0018;
  // Softness is bought with column overlap and flatter striations rather than
  // a per-strip blur, which would cost a full gaussian on every column.
  const colW = step * (1.55 + c.soft * 4.5);
  const span = c.x1 - c.x0;
  const sw = swell(c, t);
  const baseAlpha = c.opacity * sw * gain;
  if (baseAlpha < 0.006) return;

  ctx.save();
  // Strips cross over one another once the shear grows faster than the frame
  // itself — d(x_top)/dx = 1 - spread * height / w. Past that the tops fold
  // back and the overlap piles up additively into a hard-edged bright patch,
  // so the fan-out is capped against this curtain's tallest possible column.
  const maxHeightPx = c.height * h * 1.29 * (1 + 0.45 * Math.abs(c.taper));
  const spread = Math.min(c.spread, (0.72 * w) / maxHeightPx);

  const bs = tg.bloomScale;
  const bctx = tg.bloom;
  bctx.save();
  bctx.fillStyle = palette.hot;

  for (let x = c.x0 * w; x <= c.x1 * w; x += step) {
    const nx = x / w;
    const u = (nx - c.x0) / span; // 0..1 along the curtain

    // 1. Base path — the bottom edge, undulating like fabric.
    const wave =
      sfbm3(
        nx * c.pathFreq,
        ct * c.pathSpeed,
        st * c.pathSpeed,
        c.seed,
        3,
      ) *
        0.78 +
      sfbm3(
        nx * c.pathFreq * 2.7 + 11.3,
        ct * c.pathSpeed * 1.6,
        st * c.pathSpeed * 1.6,
        c.seed + 5,
        2,
      ) *
        0.22;
    // Curtains seen from underneath bow away toward their ends.
    const dv = nx - c.vanishX;
    const yBase =
      c.baseY * h +
      wave * c.amp * h +
      c.arc * h * dv * dv +
      c.slope * h * (nx - 0.5);

    // 2. Uneven top edge.
    const hv = sfbm3(
      nx * c.heightFreq + 31.7,
      ct * c.heightSpeed,
      st * c.heightSpeed,
      c.seed + 13,
      3,
    );
    // Perspective taper: one end of the curtain is further away.
    const taperF = 1 + c.taper * 0.45 * (u - 0.5) * 2;
    // Skewed so stretches of the curtain thin out almost to nothing, which is
    // what breaks a continuous band into separate hanging folds.
    const hn = Math.pow(clamp(0.5 + 0.5 * hv, 0, 1), 1.7);
    const height = c.height * h * (0.14 + 1.15 * hn) * taperF;
    if (height < h * 0.01) continue;
    // A collapsing fold must dim as it thins, otherwise the bright lower lip
    // survives on its own as a hard hairline across the sky.
    const thin = smoothstep(0, 0.3, hn);

    // 3. Striations travelling along the curtain, plus end fades.
    // Wide end fades: a short one leaves the sheared leading edge reading as
    // a straight-sided parallelogram.
    const edge = smoothstep(0, 0.24, u) * (1 - smoothstep(0.76, 1, u));
    const alpha = baseAlpha * striation(c, nx, t, c.soft) * edge * thin;
    if (alpha < 0.005) continue;

    // 4. Fan-out from near the zenith: columns lean away from the vanishing x.
    const skew = c.tilt + spread * dv;
    ctx.setTransform(1, 0, skew, 1, -skew * yBase, 0);
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(ramp, x - (colW - step) * 0.5, yBase - height, colW, height);

    // 5. Bloom source: only the bright lower lip, so bloom never washes out
    //    the striations higher up the curtain. The ramp in must be continuous
    //    — a hard alpha threshold stamps blurred rectangular blocks into the
    //    sky wherever the curtain crosses it.
    const bl = smoothstep(0.14, 0.5, alpha);
    if (bl > 0.01) {
      const lip = height * 0.085;
      bctx.globalAlpha = bl;
      bctx.setTransform(1, 0, skew, 1, -skew * yBase * bs, 0);
      bctx.fillRect(
        (x - (colW - step) * 0.5) * bs,
        (yBase - lip) * bs,
        colW * bs,
        lip * bs,
      );
    }
  }

  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.restore();
};

export const drawAurora = (
  tg: CurtainTargets,
  v: Variant,
  w: number,
  h: number,
  t: number,
) => {
  tg.aurora.save();
  tg.aurora.globalCompositeOperation = 'lighter';
  for (const c of v.curtains) {
    drawCurtain(tg, c, v.palette, v.gain, w, h, t);
  }
  tg.aurora.restore();
};
