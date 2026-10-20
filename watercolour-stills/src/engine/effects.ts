// Watercolour effects built from p5.brush fills. Each helper draws all its
// pieces in one colour, so p5.brush's colour cache merges them into a single
// blend pass.
import { concentrate } from "./color";
import type { Painter, WashOpts } from "./painter";
import { makeRng, type Noise, type Rng } from "./rng";
import { blob, ribbon, wander, type Pt } from "./shapes";

export type Fx = { painter: Painter; rng: Rng; noise: Noise };

/**
 * Cauliflower outline: rounded lobes with sharp inward cusps (|noise| makes
 * the cusps), several octaves so lobes carry smaller lobes.
 */
export const cauliflower = (
  { rng, noise }: Fx,
  cx: number,
  cy: number,
  r: number,
  { n = 160, lobes = 7, amp = 0.22, squash = 1, rot = rng.range(0, Math.PI * 2) } = {},
): Pt[] => {
  const o = rng.range(0, 400);
  const pts: Pt[] = [];
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    let k = 0.8 + 0.3 * noise.fbm(o + ca * 1.2, o + sa * 1.2, 2);
    let f = lobes / (Math.PI * 2);
    let w = amp;
    for (let oct = 0; oct < 3; oct++) {
      k += w * Math.abs(noise.n2(o * 3 + oct * 41 + ca * f, sa * f + oct * 13));
      f *= 2.3;
      w *= 0.45;
    }
    const x = ca * r * k;
    const y = sa * r * k * squash;
    pts.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
  }
  return pts;
};

/**
 * A backrun / bloom: water dropped into a drying wash pushes pigment
 * outwards. Painted as a pale tint of the wash with a cauliflower outline;
 * the compositor's rim term then darkens the wash just outside it.
 */
export const bloom = (fx: Fx, cx: number, cy: number, r: number, washColor: string, paleness = 0.3) =>
  blooms(fx, [{ x: cx, y: cy, r }], washColor, paleness);

/**
 * Several blooms in one wash colour, batched so that p5.brush needs only two
 * blend passes (collar colour, then pale core) however many there are.
 */
export const blooms = async (fx: Fx, items: { x: number; y: number; r: number }[], washColor: string, paleness = 0.3) => {
  const shapes = items.map((it) => {
    const rot = fx.rng.range(0, Math.PI * 2);
    const lobes = fx.rng.int(5, 10);
    const amp = fx.rng.range(0.15, 0.28);
    const salt = fx.rng.int(0, 1 << 30);
    return (scale: number) => cauliflower({ ...fx, rng: makeRng(salt) }, it.x, it.y, it.r * scale, { lobes, amp, rot });
  });
  // pigment pushed outwards collects in a darker collar just outside the
  // bloom: soft on its outer side, crisp where the pale interior cuts it
  for (const outline of shapes) {
    await fx.painter.wash(outline(1.07), concentrate(washColor, 1.3), { opacity: 60, bleed: 0.05, texture: 0.2, border: 0.6 });
  }
  for (const outline of shapes) {
    await fx.painter.wash(outline(1.0), concentrate(washColor, paleness), { opacity: 85, bleed: 0.04, texture: 0.25, border: 0.8, saturate: 0.45 });
  }
};

/** A drop of pigment charged into wet paper: soft, feathered spread. */
export const drop = async (fx: Fx, cx: number, cy: number, r: number, color: string, o: WashOpts = {}) => {
  const pts = blob(fx.rng, fx.noise, cx, cy, r, r * fx.rng.range(0.7, 1.1), {
    irregular: 0.35,
    freq: 1.8,
  });
  await fx.painter.wash(pts, color, { opacity: 70, bleed: 0.4, texture: 0.5, border: 0.3, ...o });
};

/** Flicked splatter: crisp droplets, most tiny, a few large, some elongated. */
export const splatter = async (
  fx: Fx,
  cx: number,
  cy: number,
  spread: number,
  count: number,
  color: string,
  { angle = fx.rng.range(0, Math.PI * 2), flick = 0.6, rMin = 1.6, rMax = 26, opacity = 120 } = {},
) => {
  const { rng, noise, painter } = fx;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  for (let i = 0; i < count; i++) {
    // spread is stretched along the flick direction
    const u = rng.gauss(0, spread * (1 + flick));
    const v = rng.gauss(0, spread * (1 - flick * 0.5));
    const x = cx + u * ca - v * sa;
    const y = cy + u * sa + v * ca;
    const r = rMin * Math.pow(rMax / rMin, Math.pow(rng(), 3.2));
    const stretch = 1 + flick * Math.pow(rng(), 2) * 1.8 * Math.min(1, Math.abs(u) / spread);
    const pts = blob(rng, noise, x, y, r * stretch, r, {
      n: Math.max(16, Math.min(60, Math.round(r * 2.2))),
      irregular: 0.1 + rng.range(0, 0.1),
      freq: 1.1,
      rot: angle + rng.gauss(0, 0.15),
    });
    await painter.wash(pts, color, {
      opacity: opacity * rng.range(0.8, 1.1),
      bleed: rng.range(0.04, 0.09),
      texture: 0,
      border: 0.7,
    });
    // a bigger drop throws a few satellites further along the flick
    if (r > rMax * 0.35 && rng.chance(0.6)) {
      for (let s = 0; s < rng.int(1, 4); s++) {
        const sign = u >= 0 ? 1 : -1;
        const d = r * stretch * rng.range(1.6, 4.5);
        const sr = r * rng.range(0.08, 0.22);
        const side = rng.gauss(0, r * 0.35);
        const sx = x + sign * ca * d - sa * side;
        const sy = y + sign * sa * d + ca * side;
        await painter.wash(blob(rng, noise, sx, sy, sr, sr, { n: 16, irregular: 0.1 }), color, {
          opacity,
          bleed: 0.04,
          texture: 0,
          border: 0.7,
        });
      }
    }
  }
};

/**
 * A run of pigment down a tilted sheet: a heavy drop slid, leaving a trail
 * a little narrower than itself that thins out, ending in a small bead.
 */
export const drip = async (
  fx: Fx,
  x: number,
  y: number,
  length: number,
  width: number,
  color: string,
  { opacity = 110, pool = true } = {},
) => {
  const { rng, noise, painter } = fx;
  const pr = width * rng.range(0.62, 0.78);
  const startY = pool ? y + pr * 0.3 : y;
  const path = wander(rng, noise, x, startY, Math.PI / 2 + rng.gauss(0, 0.04), length, Math.max(16, Math.round(length / 8)), 0.12);
  const o = rng.range(0, 100);
  const body = ribbon(path, (t) => {
    // wide where it leaves the drop, thinning, with a slight swell before the bead
    const taper = 1 - 0.55 * Math.pow(t, 0.8) + 0.15 * Math.exp(-Math.pow((t - 0.93) / 0.05, 2));
    const neck = 0.82 + 0.18 * noise.n2(o + t * 6, 0.3);
    return width * 0.5 * taper * neck;
  });
  await painter.wash(body, color, { opacity, bleed: 0.04, texture: 0.15, border: 0.6 });
  const end = path[path.length - 1];
  const br = width * rng.range(0.24, 0.32);
  await painter.wash(blob(rng, noise, end[0], end[1], br, br * rng.range(1.25, 1.5), { n: 36, irregular: 0.08, rot: Math.PI / 2 }), color, {
    opacity: opacity * 1.05,
    bleed: 0.04,
    texture: 0,
    border: 0.8,
  });
  if (pool) {
    await painter.wash(blob(rng, noise, x, y, pr * rng.range(1.0, 1.15), pr, { n: 60, irregular: 0.08, freq: 1.1, rot: rng.range(-0.3, 0.3) }), color, {
      opacity,
      bleed: 0.05,
      texture: 0.2,
      border: 0.7,
    });
  }
};

/**
 * Salt crystals soak up water from a damp wash and leave pale marks: a soft
 * pale core with a fine feathery, crystalline edge; a few larger ones.
 */
export const salt = async (
  fx: Fx,
  cx: number,
  cy: number,
  spread: number,
  count: number,
  washColor: string,
  { rMin = 4, rMax = 28, paleness = 0.3, inside = (_x: number, _y: number): boolean => true } = {},
) => {
  const { rng, noise, painter } = fx;
  // two tint levels only: every distinct colour costs p5.brush a blend pass
  const tints = [concentrate(washColor, paleness), concentrate(washColor, paleness * 1.5)];
  const marks: { pts: Pt[]; tint: number }[] = [];
  for (let i = 0; i < count; i++) {
    const x = cx + rng.gauss(0, spread);
    const y = cy + rng.gauss(0, spread * 0.8);
    const s = rMin * Math.pow(rMax / rMin, Math.pow(rng(), 2.4));
    if (!inside(x, y)) continue;
    const n = Math.max(28, Math.min(96, Math.round(s * 4)));
    const o = rng.range(0, 500);
    const spikes = rng.range(9, 16);
    const pts: Pt[] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      // fine crystalline fringe: spiky noise on top of a lumpy round core
      const spike = Math.pow(Math.abs(noise.n2(o + Math.cos(a) * spikes * 0.3, o + Math.sin(a) * spikes * 0.3)), 0.6);
      const lump = noise.fbm(o + Math.cos(a) * 1.3, Math.sin(a) * 1.3, 2);
      const rr = s * (0.62 + 0.35 * lump + 0.5 * spike * rng.range(0.5, 1));
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    marks.push({ pts, tint: rng.chance(0.65) ? 0 : 1 });
  }
  for (let t = 0; t < tints.length; t++) {
    for (const m of marks.filter((q) => q.tint === t)) {
      await painter.wash(m.pts, tints[t], { opacity: rng.range(60, 95), bleed: 0.14, texture: 0, border: 0.15, saturate: 0.45 });
    }
  }
};

/**
 * A broad flat-brush stroke. The body is laid as overlapping bristle lanes
 * that run out of paint at different points: full and wet for most of the
 * stroke, then breaking into a dry-brush end with paper showing through.
 */
export const swatch = async (
  fx: Fx,
  x: number,
  y: number,
  length: number,
  width: number,
  angle: number,
  color: string,
  { opacity = 95, dry = 0.6 } = {},
) => {
  const { rng, noise, painter } = fx;
  const spine = wander(rng, noise, x, y, angle, length, 40, 0.04);
  const o = rng.range(0, 100);
  // the loaded body
  const bodyEnd = 1 - dry * rng.range(0.28, 0.4);
  const body = ribbon(spine.slice(0, Math.round(spine.length * bodyEnd)), (t) => {
    const start = t < 0.05 ? 0.82 + 3.6 * t : 1;
    return width * 0.5 * start * (0.96 + 0.04 * noise.n2(o + t * 6, 2));
  });
  await painter.wash(body, color, { opacity, bleed: 0.05, texture: 0.35, border: 0.6 });
  // bristle lanes carrying on past the body, each running dry at its own
  // point; their width pinches to nothing here and there, so the paper
  // shows through in streaks
  const lanes = rng.int(10, 16);
  for (let l = 0; l < lanes; l++) {
    const off = ((l + rng.range(0.2, 0.8)) / lanes - 0.5) * width * 0.94;
    const lw = (width / lanes) * rng.range(0.6, 1.25);
    const from = bodyEnd - rng.range(0.06, 0.14);
    const to = Math.min(1, bodyEnd + (1 - bodyEnd) * rng.range(0.25, 1.0));
    const i0 = Math.round(from * (spine.length - 1));
    const i1 = Math.round(to * (spine.length - 1));
    const lane = spine.slice(i0, i1 + 1).map(([sx, sy], k, arr) => {
      const [ax, ay] = arr[Math.max(0, k - 1)];
      const [bx, by] = arr[Math.min(arr.length - 1, k + 1)];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const wob = off + lw * 0.3 * noise.n2(o + l * 3.1, k * 0.4);
      return [sx - ((by - ay) / len) * wob, sy + ((bx - ax) / len) * wob] as Pt;
    });
    if (lane.length < 3) continue;
    const ph = rng.range(0, 100);
    const strip = ribbon(lane, (t) => {
      const pinch = Math.max(0, Math.abs(noise.n2(ph + t * 9, 5)) * 1.6 - 0.15);
      return lw * 0.5 * Math.min(1, pinch) * Math.pow(1 - t, 0.6);
    });
    await painter.wash(strip, color, { opacity: opacity * 0.9, bleed: 0.03, texture: 0.1, border: 0.4 });
  }
};

/**
 * A splat: a heavy drop that hit the paper, with a few short crown spikes.
 * Runs start from splats rather than from isolated round heads.
 */
export const splat = (fx: Fx, cx: number, cy: number, r: number): Pt[] => {
  const { rng, noise } = fx;
  const n = 90;
  const o = rng.range(0, 300);
  const spikes = Array.from({ length: rng.int(3, 8) }, () => ({ a: rng.range(0, Math.PI * 2), l: rng.range(0.15, 0.6), w: rng.range(0.05, 0.12) }));
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let k = 1 + 0.18 * noise.fbm(o + Math.cos(a) * 1.4, o + Math.sin(a) * 1.4, 3) * 2;
    for (const sp of spikes) {
      let d = Math.abs(a - sp.a);
      d = Math.min(d, Math.PI * 2 - d);
      k += sp.l * Math.exp(-(d * d) / (sp.w * sp.w));
    }
    pts.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.9]);
  }
  return pts;
};

/** Long soft streaks, as left by a loaded brush dragged through a wet wash. */
export const streak = async (
  fx: Fx,
  x: number,
  y: number,
  length: number,
  width: number,
  angle: number,
  color: string,
  o: WashOpts = {},
) => {
  const { rng, noise, painter } = fx;
  const path = wander(rng, noise, x, y, angle, length, 20, 0.06);
  const off = rng.range(0, 100);
  const body = ribbon(path, (t) => width * 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.02)) * (0.8 + 0.2 * noise.n2(off + t * 5, 1)));
  await painter.wash(body, color, { opacity: 45, bleed: 0.3, texture: 0.3, border: 0.2, ...o });
};
