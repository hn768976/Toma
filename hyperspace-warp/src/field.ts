import { clamp, smoothstep } from "./math";
import { hash01, mulberry32 } from "./random";
import { Palette, sampleRamp } from "./palette";
import { WarpMode, fieldRotation, speedNorm, travelled } from "./speed";

export const PARTICLE_COUNT = 4500;
/** Visible during the calm phases; the rest stagger in as the speed rises. */
export const CALM_PARTICLE_COUNT = 1200;

/**
 * A particle's respawn angle is a function of (index, cycle mod this).
 * 12 divides the loop's 60 cycles, so after a full loop every particle is back
 * on the angle it started with. Twelve variants is more than enough that the
 * repetition is invisible.
 */
export const ANGLE_CYCLE_SLOTS = 12;
/** Frequency of the calm twinkle, in whole cycles per LOOP_PERIOD frames. */
export const LOOP_PERIOD = 600;

/** Geometry, as fractions of the composition width. */
export const R0_FRAC = 0.01; // birth radius
export const HOLE_FRAC = 0.018; // dark vanishing-point hole (3.6% of width across)
export const RMAX_FRAC = 0.63; // > half-diagonal (0.5734 * width at 16:9)

/** ln(RMAX / R0): the log-radius span of one full traversal. */
const K = Math.log(RMAX_FRAC / R0_FRAC);

export type Particle = {
  /** Phase offset u in [0, 1) — where the particle sits along its traversal. */
  phase: number;
  /** Base brightness, 0..1. */
  bright: number;
  /** Top ~8% get a fatter line. */
  fat: boolean;
  /** Twinkle: whole cycles per LOOP_PERIOD frames, so it loops exactly. */
  twinkleCycles: number;
  twinklePhase: number;
  /** Speed at which this particle fades in; -1 for the always-on calm set. */
  gate: number;
  /** Per-cycle angles, ANGLE_CYCLE_SLOTS of them. */
  angles: Float64Array;
};

export const buildParticles = (seed: number): Particle[] => {
  const rand = mulberry32(seed);
  const list: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angles = new Float64Array(ANGLE_CYCLE_SLOTS);
    for (let c = 0; c < ANGLE_CYCLE_SLOTS; c++) {
      angles[c] = hash01(i * 131 + 17, c * 7919 + seed) * Math.PI * 2;
    }
    const b = rand();
    list.push({
      angles,
      phase: rand(),
      // Skew brightness so most particles are mid and a few are hot.
      bright: 0.35 + Math.pow(b, 1.7) * 0.65,
      fat: rand() < 0.08,
      twinkleCycles: 2 + Math.floor(rand() * 7), // 2..8 cycles per 20s
      twinklePhase: rand(),
      gate:
        i < CALM_PARTICLE_COUNT
          ? -1
          : 0.04 +
            ((i - CALM_PARTICLE_COUNT) / (PARTICLE_COUNT - CALM_PARTICLE_COUNT)) * 0.68,
    });
  }
  return list;
};

export type FieldOptions = {
  frame: number;
  width: number;
  height: number;
  fps: number;
  mode: WarpMode;
  palette: Palette;
  particles: Particle[];
};

const headRgb: [number, number, number] = [0, 0, 0];
const bodyRgb: [number, number, number] = [0, 0, 0];
const tailRgb: [number, number, number] = [0, 0, 0];

/**
 * Draws one frame of the star field onto `ctx`, additively, on an already
 * black canvas.
 *
 * Each particle lives in polar coordinates around the frame centre:
 *   r(t) = R0 * exp(K * frac(u + D(t)))
 * where D(t) is the closed-form travelled distance from speed.ts. The integer
 * part of (u + D) is the cycle count, which picks the respawn angle. The
 * segment drawn from r(t-1) to r(t) *is* the motion blur — a dot when calm,
 * a long streak at peak warp.
 */
export const drawField = (ctx: CanvasRenderingContext2D, o: FieldOptions) => {
  const { frame, width, height, fps, mode, palette, particles } = o;
  const s = width / 3840; // everything is authored at 4K and scales down
  const cx = width / 2;
  const cy = height / 2;

  const r0 = R0_FRAC * width;
  const holeR = HOLE_FRAC * width;
  const rMax = RMAX_FRAC * width;

  const sn = speedNorm(frame, mode);
  const dNow = travelled(frame, mode);
  const dPrev = travelled(frame - 1, mode);
  const rotNow = fieldRotation(frame, mode, fps);
  const rotPrev = fieldRotation(frame - 1, mode, fps);

  // Below this segment length a particle is drawn as a point rather than a
  // streak — which is what the calm phases resolve to.
  const dotLimit = 3.5 * s;

  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // How much of this particle is switched on at the current speed. The
    // calm set (gate < 0) is always fully on; the rest stagger in across the
    // ramp so the population grows from ~1200 to 4500 as the warp builds.
    const gateA = p.gate < 0 ? 1 : smoothstep(p.gate, p.gate + 0.26, sn);
    if (gateA <= 0.001) continue;

    const uNow = p.phase + dNow;
    const uPrev = p.phase + dPrev;
    const cycNow = Math.floor(uNow);
    const cycPrev = Math.floor(uPrev);
    const fracNow = uNow - cycNow;

    const angNow = p.angles[((cycNow % ANGLE_CYCLE_SLOTS) + ANGLE_CYCLE_SLOTS) % ANGLE_CYCLE_SLOTS];
    const rNow = r0 * Math.exp(K * fracNow);

    // If the particle respawned during this frame, the segment starts at the
    // birth radius on the new angle instead of stretching across the frame.
    const respawned = cycNow !== cycPrev;
    const rPrev = respawned ? r0 : r0 * Math.exp(K * (uPrev - cycPrev));

    const aNow = angNow + rotNow;
    const aPrev = angNow + (respawned ? rotNow : rotPrev);

    const x1 = cx + Math.cos(aNow) * rNow;
    const y1 = cy + Math.sin(aNow) * rNow;
    const x0 = cx + Math.cos(aPrev) * rPrev;
    const y0 = cy + Math.sin(aPrev) * rPrev;

    const rn = rNow / rMax;

    // Alpha: dark hole at the centre, fade out just before leaving frame.
    // Particle density goes as 1/r (they are uniform in log-radius), so the
    // fade-in has to reach well past the hole or the centre packs into a
    // white blob instead of reading as a vanishing point.
    const holeFade = smoothstep(holeR * 0.85, holeR * 3.8, rNow);
    const edgeFade = 1 - smoothstep(0.86, 1.0, rn);

    // Slow independent twinkle, only readable while the field is calm.
    const tw =
      1 -
      0.55 *
        (1 - sn) *
        (0.5 +
          0.5 *
            Math.sin(
              Math.PI * 2 * (p.twinkleCycles * (frame / LOOP_PERIOD) + p.twinklePhase),
            ));

    let alpha = p.bright * gateA * holeFade * edgeFade * tw;
    // A flat ceiling. Streaks overlap heavily at peak and stack additively,
    // so this has to stay well under 1; calm dots barely overlap at all, so
    // the same value reads as a faint starfield rather than a blown-out one.
    alpha *= 0.85;
    if (alpha <= 0.004) continue;

    // Colour. The body of the field sits on the palette's mid stop and
    // deepens to the outer tail at the rim; only the brightest streaks, in
    // the middle third of the frame, get pushed far enough down the ramp to
    // blow out to white. Squaring `bright` is what keeps that a minority.
    const midBand = Math.exp(-Math.pow((rn - 0.48) / 0.38, 2));
    const heat = sn * midBand * p.bright * p.bright;
    const colourX = clamp(0.47 + rn * 0.5 - heat * 0.82 - (1 - sn) * 0.28);

    const len = Math.hypot(x1 - x0, y1 - y0);

    // 1.5 - 4 px at 4K: brightness carries most of it, the top ~8% get the
    // extra px, and speed nudges it. Clamped so the widest streak still
    // lands on 4 px rather than overshooting it.
    let w = (1.5 + p.bright * 1.5 + (p.fat ? 1 : 0)) * (0.82 + 0.35 * sn);
    w = clamp(w, 1.5, 4) * s;

    if (len < dotLimit) {
      // Calm starfield: a 1-2 px point at 4K. The radius is floored in device
      // pixels as well as in 4K-authored units, because a sub-pixel dot all
      // but vanishes once the frame is scaled down to 1080p.
      sampleRamp(palette, colourX, bodyRgb);
      const dotR = Math.max(1 * s, 0.8, w * 0.5);
      // Points cover a tiny fraction of the frame and barely overlap, so they
      // can carry more alpha than a streak without the field blowing out.
      const dotAlpha = Math.min(1, alpha * 1.7);
      ctx.fillStyle = `rgb(${bodyRgb[0] | 0},${bodyRgb[1] | 0},${bodyRgb[2] | 0})`;
      ctx.globalAlpha = dotAlpha;
      ctx.beginPath();
      ctx.arc(x1, y1, dotR, 0, Math.PI * 2);
      ctx.fill();
      // A soft halo on every star, wider on the brightest. Without it the
      // points read as dust; with it the calm field reads as a sky.
      ctx.globalAlpha = dotAlpha * 0.18;
      ctx.beginPath();
      ctx.arc(x1, y1, dotR * (p.fat ? 4.2 : 2.6), 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    // Streak: a gradient along the segment gives the comet ramp — transparent
    // deep tail, body, blown-out head — without a separate blur pass.
    // The head only runs hot in proportion to `heat`. A flat white head on
    // every streak is what turns an additive field grey instead of blue.
    sampleRamp(palette, clamp(colourX - (0.08 + 0.46 * heat)), headRgb);
    sampleRamp(palette, colourX, bodyRgb);
    sampleRamp(palette, clamp(colourX + 0.26), tailRgb);

    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, `rgba(${tailRgb[0] | 0},${tailRgb[1] | 0},${tailRgb[2] | 0},0)`);
    grad.addColorStop(
      0.42,
      `rgba(${bodyRgb[0] | 0},${bodyRgb[1] | 0},${bodyRgb[2] | 0},0.62)`,
    );
    grad.addColorStop(1, `rgba(${headRgb[0] | 0},${headRgb[1] | 0},${headRgb[2] | 0},0.92)`);

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = grad;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    // The brightest particles get a soft wide underlay so they read as glowing
    // rather than as a hard line.
    if (p.fat) {
      ctx.globalAlpha = alpha * 0.3;
      ctx.lineWidth = w * 3.2;
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
};
