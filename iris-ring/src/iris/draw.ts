import { DotBatcher } from "./batcher";
import { clamp01, noise4, smoothstep } from "./noise";
import { Palette, sampleRamp } from "./palette";
import { mulberry32 } from "./random";
import {
  CENTER_X_FRAC,
  CENTER_Y_FRAC,
  DOT_SPACING_FRAC,
  IrisField,
  OUTER_RADIUS_FRAC,
  TWO_PI,
  buildLut,
  fieldRotation,
  loopTime,
  outerEdgeLut,
  pupilDiameterFrac,
  pupilEdgeLut,
  rimHotLut,
  sampleLut,
} from "./field";

// --- Tuning --------------------------------------------------------------
const FILAMENT_GAIN = 1.15;
const RIM_GAIN = 0.95;
const SPIKE_GAIN = 1.0;
const MEMBRANE_GAIN = 0.13;

const BLOOM_DIV = 5;
const BLOOM_THRESHOLD = 120; // premultiplied luminance a dot must beat to bloom
const BLOOM_TIGHT_PX = 26; // halo radius, in composition pixels
const BLOOM_WIDE_PX = 84;
const BLOOM_TIGHT_ALPHA = 0.5;
const BLOOM_WIDE_ALPHA = 0.34;

const GRAIN_TILE = 512;
const GRAIN_AMPLITUDE = 6; // ~1.5% of full scale, dithers the black surround

// Brightness as a function of normalised radius (0 at the pupil edge, 1 at
// the outer boundary). Kept as two separate terms so the caller can gate the
// inner-rim spike on the hotspot field — that gating is what breaks the rim
// into uneven arcs instead of one continuous blown-out ring.
const innerSpike = (q: number) => Math.exp(-((q / 0.1) * (q / 0.1)));

const bodyFalloff = (q: number) => {
  const membraneT = (q - 0.93) / 0.075;
  // Every strand root lands on the same small circumference, so without
  // this dip their additive pile-up fuses the rim into one even white band.
  const rootRelief = 0.34 + 0.56 * smoothstep(q / 0.13);
  return (
    rootRelief * Math.exp(-q * 0.55) + 0.12 * Math.exp(-membraneT * membraneT)
  );
};

export type DrawArgs = {
  ctx: CanvasRenderingContext2D;
  bloomSrc: CanvasRenderingContext2D;
  bloomBlur: CanvasRenderingContext2D;
  width: number;
  height: number;
  frame: number;
  durationInFrames: number;
  palette: Palette;
  field: IrisField;
};

export const drawIris = ({
  ctx,
  bloomSrc,
  bloomBlur,
  width,
  height,
  frame,
  durationInFrames,
  palette,
  field,
}: DrawArgs) => {
  const t = (((frame % durationInFrames) + durationInFrames) %
    durationInFrames) /
    durationInFrames;
  const lt = loopTime(t);
  const rot = fieldRotation(t);

  const cx = width * CENTER_X_FRAC;
  const cy = height * CENTER_Y_FRAC;
  const R = height * OUTER_RADIUS_FRAC;
  const pupilBase = R * pupilDiameterFrac(t);
  const dotSpacing = height * DOT_SPACING_FRAC;
  const baseDot = height * 0.00092;

  // --- Per-angle fields, evaluated once and interpolated ------------------
  const pupilLut = pupilEdgeLut(lt, rot);
  const outerLut = outerEdgeLut(lt, rot);
  const rimLut = rimHotLut(lt, rot);

  // Where the secondary colour bleeds through: two opposite lobes on the
  // palette's axis, broken up by looping noise so it reads as a cast under
  // the main ramp rather than a second ring.
  const undertoneLut = buildLut(512, (theta) => {
    const a = theta - rot;
    const lobe = Math.pow(Math.abs(Math.cos(a - palette.undertoneAxis)), 2.1);
    const patch = Math.pow(
      clamp01(
        0.5 +
          0.95 *
            noise4(
              Math.cos(a) * 3.1,
              Math.sin(a) * 3.1,
              lt.cos * 0.5,
              lt.sin * 0.5,
              211,
            ),
      ),
      1.5,
    );
    return lobe * patch;
  });

  // Slow angular brightness variation: whole sectors of the iris run dim
  // while others carry most of the light, as in the reference.
  const sectorLut = buildLut(360, (theta) => {
    const a = theta - rot;
    const n = noise4(
      Math.cos(a) * 1.6,
      Math.sin(a) * 1.6,
      lt.cos * 0.6,
      lt.sin * 0.6,
      523,
    );
    return 0.34 + 1.0 * clamp01(0.5 + 0.62 * n);
  });

  const pupilAt = (theta: number) => pupilBase * sampleLut(pupilLut, theta);
  const outerAt = (theta: number) => R * sampleLut(outerLut, theta);

  // --- Colour ramp lookup, precomputed ------------------------------------
  const RAMP_N = 192;
  const rampR = new Float64Array(RAMP_N);
  const rampG = new Float64Array(RAMP_N);
  const rampB = new Float64Array(RAMP_N);
  for (let i = 0; i < RAMP_N; i++) {
    const c = sampleRamp(palette.stops, i / (RAMP_N - 1));
    rampR[i] = c.r;
    rampG[i] = c.g;
    rampB[i] = c.b;
  }

  // --- Canvas setup -------------------------------------------------------
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  const bw = bloomSrc.canvas.width;
  const bh = bloomSrc.canvas.height;
  bloomSrc.setTransform(1, 0, 0, 1, 0, 0);
  bloomSrc.globalCompositeOperation = "source-over";
  bloomSrc.filter = "none";
  bloomSrc.clearRect(0, 0, bw, bh);
  bloomSrc.globalCompositeOperation = "lighter";

  ctx.globalCompositeOperation = "lighter";

  const main = new DotBatcher();
  const bloom = new DotBatcher();

  const emit = (
    x: number,
    y: number,
    rad: number,
    r: number,
    g: number,
    b: number,
  ) => {
    main.add(x, y, rad, r, g, b);
    // Bloom is sourced only from what is actually hot: the inner rim and the
    // brightest filament peaks. Blooming the whole field would smear the
    // fibrous texture into a glowing donut.
    const lum = 0.3 * r + 0.6 * g + 0.11 * b;
    if (lum > BLOOM_THRESHOLD) {
      const w = clamp01((lum - BLOOM_THRESHOLD) / 110);
      bloom.add(
        x / BLOOM_DIV,
        y / BLOOM_DIV,
        Math.max(0.62, rad / BLOOM_DIV),
        r * w,
        g * w,
        b * w,
      );
    }
  };

  // --- 1. Filament field --------------------------------------------------
  for (let fi = 0; fi < field.filaments.length; fi++) {
    const f = field.filaments[fi];
    const ang0 = f.angle + rot;
    const pR = pupilAt(ang0);
    const oR = outerAt(ang0);
    const span = oR - pR;
    if (span <= 0) continue;

    // Staggered per-strand shimmer. Integer cycle counts keep every strand
    // exactly periodic over the loop; the exponent makes peaks brief so the
    // field twinkles instead of pulsing as a block.
    const wave = 0.5 + 0.5 * Math.sin(t * TWO_PI * f.shimmerCycles + f.shimmerPhase);
    const shimmer =
      1 - f.shimmerDepth + f.shimmerDepth * Math.pow(wave, 1.7) * 1.35;

    const len = span * f.lengthFrac;
    const steps = Math.max(10, Math.round(len / dotSpacing));
    const undertoneBase = sampleLut(undertoneLut, ang0);
    // Roots only blow out to white where the hotspot field says so.
    const rimGate = 0.06 + 1.55 * sampleLut(rimLut, ang0);
    const sector = sampleLut(sectorLut, ang0);

    for (let i = 0; i <= steps; i++) {
      const s = i / steps;
      const r = pR + len * s;
      const ang =
        ang0 +
        f.curve * Math.pow(s, 1.45) +
        f.wobbleAmp * Math.sin(s * f.wobbleFreq + f.wobblePhase);
      const q = (r - pR) / span;

      const rootFade = smoothstep(s / 0.05);
      const tipFade = 1 - smoothstep((s - (1 - f.tipSharp)) / f.tipSharp);
      let overshoot = 1;
      if (q > 1) {
        const o = (q - 1) / 0.085;
        overshoot = Math.exp(-o * o);
      }

      const intensity =
        (0.62 * innerSpike(q) * rimGate + 0.88 * bodyFalloff(q)) *
        f.brightness *
        sector *
        shimmer *
        rootFade *
        tipFade *
        overshoot *
        FILAMENT_GAIN;
      if (intensity < 0.004) continue;

      const ri = Math.min(RAMP_N - 1, Math.max(0, (q * (RAMP_N - 1)) | 0));
      let cr = rampR[ri];
      let cg = rampG[ri];
      let cb = rampB[ri];

      // Undertone: absent at the white-hot rim, strongest through the body,
      // easing off before the edge.
      const gate =
        smoothstep((q - 0.05) / 0.16) * (1 - smoothstep((q - 0.8) / 0.32));
      const mix = palette.undertoneStrength * undertoneBase * gate;
      if (mix > 0.001) {
        cr += (palette.undertone.r - cr) * mix;
        cg += (palette.undertone.g - cg) * mix;
        cb += (palette.undertone.b - cb) * mix;
      }

      const rad = baseDot * f.width * (1.3 - 0.65 * s);
      emit(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, rad, cr * intensity, cg * intensity, cb * intensity);
    }
  }

  // --- 2. Inner rim: 3-5 uneven hot arcs hugging the pupil ----------------
  const RIM_STEPS = 2000;
  const RIM_LAYERS = 5;
  const rimDot = baseDot * 1.5;
  for (let i = 0; i < RIM_STEPS; i++) {
    const theta = (i / RIM_STEPS) * TWO_PI;
    const hot = sampleLut(rimLut, theta);
    if (hot < 0.02) continue;
    const pR = pupilAt(theta);
    const oR = outerAt(theta);
    const band = (oR - pR) * 0.085;
    for (let l = 0; l < RIM_LAYERS; l++) {
      const s = l / (RIM_LAYERS - 1);
      const r = pR + band * s;
      const profile = Math.exp(-((s / 0.42) * (s / 0.42)));
      const intensity = hot * profile * RIM_GAIN;
      // The hottest points blow out past the rim colour to pure white.
      const white = clamp01((hot - 0.45) / 0.5);
      const cr = palette.rim.r + (255 - palette.rim.r) * white;
      const cg = palette.rim.g + (255 - palette.rim.g) * white;
      const cb = palette.rim.b + (255 - palette.rim.b) * white;
      emit(
        cx + Math.cos(theta) * r,
        cy + Math.sin(theta) * r,
        rimDot,
        cr * intensity,
        cg * intensity,
        cb * intensity,
      );
    }
  }

  // --- 3. Radial spikes punching past the outer edge ----------------------
  for (const sp of field.spikes) {
    const ang = sp.angle + rot;
    const pR = pupilAt(ang);
    const oR = outerAt(ang);
    const start = pR + (oR - pR) * 0.45;
    const end = oR * sp.reach;
    const steps = Math.max(20, Math.round((end - start) / dotSpacing));
    const pulse =
      0.55 + 0.45 * Math.sin(t * TWO_PI * sp.cycles + sp.phase);
    for (let i = 0; i <= steps; i++) {
      const s = i / steps;
      const r = start + (end - start) * s;
      const q = (r - pR) / (oR - pR);
      // Faint through the body, brightest as it crosses the outer edge,
      // dying off into black beyond it.
      const env = Math.exp(-Math.pow((q - 0.88) / 0.42, 2));
      const fade = env * smoothstep(s / 0.12) * (1 - smoothstep((s - 0.45) / 0.55));
      const intensity = fade * sp.brightness * pulse * SPIKE_GAIN;
      if (intensity < 0.004) continue;
      const ri = Math.min(RAMP_N - 1, Math.max(0, (q * 0.7 * (RAMP_N - 1)) | 0));
      emit(
        cx + Math.cos(ang) * r,
        cy + Math.sin(ang) * r,
        baseDot * sp.width,
        rampR[ri] * intensity,
        rampG[ri] * intensity,
        rampB[ri] * intensity,
      );
    }
  }

  // --- 4. Outer membrane: a faint rim just beyond the filament tips -------
  const MEM_STEPS = 2400;
  const memColor = sampleRamp(palette.stops, 0.86);
  for (let i = 0; i < MEM_STEPS; i++) {
    const theta = (i / MEM_STEPS) * TWO_PI;
    const oR = outerAt(theta);
    const a = theta - rot;
    const varyRaw = noise4(
      Math.cos(a) * 5.5,
      Math.sin(a) * 5.5,
      lt.cos * 0.6,
      lt.sin * 0.6,
      307,
    );
    const vary = Math.pow(clamp01(0.5 + 0.85 * varyRaw), 2.4);
    const intensity = vary * MEMBRANE_GAIN;
    const r = oR * (1.012 + 0.016 * varyRaw);
    emit(
      cx + Math.cos(theta) * r,
      cy + Math.sin(theta) * r,
      baseDot * 1.15,
      memColor.r * intensity,
      memColor.g * intensity,
      memColor.b * intensity,
    );
  }

  main.flush(ctx);
  bloom.flush(bloomSrc);

  // --- 5. Bloom -----------------------------------------------------------
  bloomBlur.setTransform(1, 0, 0, 1, 0, 0);
  bloomBlur.globalCompositeOperation = "source-over";
  bloomBlur.globalAlpha = 1;

  // Blurring in the small buffer and upscaling is far cheaper than a
  // 4K-wide blur, and at these radii the result is identical.
  const composite = (radiusPx: number, alpha: number) => {
    bloomBlur.filter = "none";
    bloomBlur.clearRect(0, 0, bw, bh);
    bloomBlur.filter = `blur(${radiusPx / BLOOM_DIV}px)`;
    bloomBlur.drawImage(bloomSrc.canvas, 0, 0);
    bloomBlur.filter = "none";
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bloomBlur.canvas, 0, 0, width, height);
  };
  composite(BLOOM_TIGHT_PX, BLOOM_TIGHT_ALPHA);
  composite(BLOOM_WIDE_PX, BLOOM_WIDE_ALPHA);
  ctx.globalAlpha = 1;

  // --- 6. Punch the pupil ------------------------------------------------
  // Done after the bloom so the pupil boundary stays hard-edged and the
  // centre stays absolutely black, as in the reference.
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  const PUPIL_STEPS = 360;
  for (let i = 0; i <= PUPIL_STEPS; i++) {
    const theta = (i / PUPIL_STEPS) * TWO_PI;
    const r = pupilAt(theta);
    const x = cx + Math.cos(theta) * r;
    const y = cy + Math.sin(theta) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // --- 7. Grain -----------------------------------------------------------
  // Large pure-black areas next to a bright object band badly in H.264;
  // a low-amplitude noise floor dithers them.
  drawGrain(ctx, width, height, frame);
};

const drawGrain = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
) => {
  const tile = document.createElement("canvas");
  tile.width = GRAIN_TILE;
  tile.height = GRAIN_TILE;
  const tctx = tile.getContext("2d");
  if (!tctx) return;
  const img = tctx.createImageData(GRAIN_TILE, GRAIN_TILE);
  const data = img.data;
  const rand = mulberry32(frame * 2654435761 + 12345);
  for (let i = 0; i < data.length; i += 4) {
    const v = (rand() * GRAIN_AMPLITUDE) | 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);

  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  const off = mulberry32(frame * 7919 + 31);
  const dx = Math.floor(off() * GRAIN_TILE);
  const dy = Math.floor(off() * GRAIN_TILE);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1;
  ctx.translate(-dx, -dy);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width + GRAIN_TILE, height + GRAIN_TILE);
  ctx.restore();
};
