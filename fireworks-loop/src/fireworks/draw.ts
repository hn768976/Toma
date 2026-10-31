import { hash2 } from "./random";
import { PALETTES, type PaletteName, type RGB } from "./palettes";
import { REF_W, type Burst } from "./show";

/** Time (s) for a star to coast to its final radius (constant deceleration). */
const COAST = 1.75;
/** Constant light wind drifting the smoke/stars to the right (ref px / s). */
const WIND = 2.5;

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const rgba = (c: RGB, a: number) =>
  `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a)).toFixed(4)})`;

/** Radial distance travelled by a star after `age` seconds (0..1 of radius). */
const travel = (age: number) => {
  const u = Math.min(1, Math.max(0, age) / COAST);
  // stars leave the break at ~8% radius, then decelerate to a stop
  return 0.08 + 0.92 * (1 - (1 - u) * (1 - u));
};

type Glow = { small: HTMLCanvasElement; tiny: HTMLCanvasElement };

export const createGlowBuffers = (w: number, h: number): Glow => {
  const small = document.createElement("canvas");
  small.width = Math.ceil(w / 4);
  small.height = Math.ceil(h / 4);
  const tiny = document.createElement("canvas");
  tiny.width = Math.ceil(w / 16);
  tiny.height = Math.ceil(h / 16);
  return { small, tiny };
};

/**
 * Draws one frame of the show. Pure function of `time`, so any frame can be
 * rendered independently (required for Remotion's parallel rendering).
 */
export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  glow: Glow,
  bursts: Burst[],
  time: number,
  frame: number,
  palette: PaletteName,
) => {
  const { width: W, height: H } = ctx.canvas;
  const s = W / REF_W; // reference px -> canvas px
  const colors = PALETTES[palette];

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (const b of bursts) {
    const age = time - b.t0;
    if (age < 0 || age > b.life) continue;

    const col = colors[b.color];
    // colour: white-hot at the break -> shell colour -> burned-out ember
    const heat = smoothstep(0, 0.22, age);
    const burn = smoothstep(b.life * 0.4, b.life, age);
    const base = mix(mix(col.hot, col.main, heat), col.end, burn);

    // brightness envelope: quick ignition, exponential decay, soft burn-out
    const ignite = smoothstep(0, 0.05, age);
    const fade = 1 - smoothstep(b.life * 0.55, b.life, age);
    const dim = 1 - 0.4 * b.decay * smoothstep(0.25, b.life * 0.8, age);
    const env = ignite * dim * fade * b.intensity;
    if (env < 0.004) continue;

    const R = b.radius * s;
    const g = b.gravity * s;
    const cx = b.x * s + WIND * s * age;
    const cy = b.y * s;
    const { dx, dy, speed, bright, seed } = b.stars;
    const n = dx.length;

    // three trail segments per star: tail (faint) -> mid -> head (bright).
    // Trails are spatial (a fraction of the travelled distance) because the
    // burning sparks hang in the air behind each star.
    const head = travel(age);
    const L = Math.min(0.58, b.trail * 0.75);
    const d = [head * (1 - L), head * (1 - 0.55 * L), head * (1 - 0.22 * L), head];
    const fall = 0.5 * g * age * age;
    const drop = [fall * 0.55, fall * 0.75, fall * 0.9, fall];
    // very compact young shells would saturate to white under additive
    // blending; compensate for the star density so they stay coloured
    const density = 0.2 + 0.8 * smoothstep(0.12, 0.8, head);
    const segAlpha = [0.3, 0.6, 0.85];
    const segWidth = [0.75, 0.9, 1.05].map((v) => v * s);

    for (let group = 0; group < 2; group++) {
      const gAlpha = group === 1 ? 1 : 0.6;
      for (let seg = 0; seg < 3; seg++) {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          if (bright[i] !== group) continue;
          const sx = dx[i] * speed[i] * R;
          const sy = dy[i] * speed[i] * R;
          ctx.moveTo(cx + sx * d[seg], cy + sy * d[seg] + drop[seg]);
          ctx.lineTo(cx + sx * d[seg + 1], cy + sy * d[seg + 1] + drop[seg + 1]);
        }
        ctx.strokeStyle = rgba(base, env * density * segAlpha[seg] * gAlpha);
        ctx.lineWidth = segWidth[seg];
        ctx.stroke();
      }
    }

    // star heads: small bright dots that start to glitter as the shell burns out
    const headColor = mix(base, col.hot, 0.35 * (1 - burn));
    ctx.fillStyle = rgba(headColor, Math.min(1, env * density * 1.15));
    const glitter = smoothstep(b.life * 0.35, b.life * 0.6, age);
    const dot = 0.85 * s;
    for (let i = 0; i < n; i++) {
      if (glitter > 0) {
        // deterministic twinkle; only a minority of stars blink at once
        const h = hash2(seed[i], frame >> 1);
        if (h < glitter * 0.6) continue;
      }
      const x = cx + dx[i] * speed[i] * R * d[3];
      const y = cy + dy[i] * speed[i] * R * d[3] + drop[3];
      ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
    }

    // the break flash: a soft bright core during the first ~0.3 s
    if (age < 0.35) {
      const f = (1 - smoothstep(0, 0.35, age)) * ignite * b.intensity;
      const fr = Math.max(4 * s, R * (0.1 + 0.45 * d[3]));
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, fr);
      grad.addColorStop(0, rgba(mix(col.hot, col.main, 0.6), 0.26 * f));
      grad.addColorStop(0.5, rgba(col.main, 0.14 * f));
      grad.addColorStop(1, rgba(col.main, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(cx - fr, cy - fr, fr * 2, fr * 2);
    }
  }

  // Bloom: downsample + blur twice and add back on top (cheap at 4K).
  const sctx = glow.small.getContext("2d", { willReadFrequently: true })!;
  sctx.globalCompositeOperation = "copy";
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.filter = `blur(${(2.0 * s) / 4}px)`;
  sctx.drawImage(ctx.canvas, 0, 0, glow.small.width, glow.small.height);
  sctx.filter = "none";

  const tctx = glow.tiny.getContext("2d", { willReadFrequently: true })!;
  tctx.globalCompositeOperation = "copy";
  tctx.imageSmoothingEnabled = true;
  tctx.imageSmoothingQuality = "high";
  tctx.filter = `blur(${(9 * s) / 16}px)`;
  tctx.drawImage(glow.small, 0, 0, glow.tiny.width, glow.tiny.height);
  tctx.filter = "none";

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // (globalAlpha can't exceed 1, so a 1.3x bloom gain is two passes)
  ctx.globalAlpha = 1;
  ctx.drawImage(glow.small, 0, 0, W, H);
  ctx.globalAlpha = 0.3;
  ctx.drawImage(glow.small, 0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.drawImage(glow.tiny, 0, 0, W, H);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(glow.tiny, 0, 0, W, H);
  ctx.restore();
};
