// Looks 1-2 · Scribble Eyes: two flat almond eyes with slit irises inside a
// restless, slowly swirling field of scratchy strokes (Rough.js).
import type { DrawFn } from "../lib/CanvasHost";
import { buildActing } from "../lib/acting";
import { lidPath, lids, makeJitter, type AlmondJitter, type AlmondSpec } from "../lib/eye";
import { freehand, outlineToPath } from "../lib/freehand";
import { lerp, mod, smoothstep, type Pt } from "../lib/math";
import { roughCurve } from "../lib/rough";
import { makeRng, seedFor } from "../lib/rng";

export type ScribbleCfg = {
  id: string;
  background: string;
  ink: string; // scratch strokes
  eyeFill: string;
  iris: string;
  pupil: string; // the slit inside the iris
};

// ---- data (one place to tune) ----------------------------------------------
export const SCRIBBLE = {
  eyeW: 0.16, // fraction of frame width per eye
  eyeAspect: 0.3,
  eyeY: 0.46, // fraction of frame height
  eyeSpacing: 0.33, // centre-to-centre, fraction of frame width
  scratchCount: 2000,
  boilHold: 3, // frames each eye variant is held
  boilVariants: 4,
  fieldHold: 2, // the scratch field is redrawn every 2 frames...
  fieldVariants: 6, // ...from 6 variants
};

const W = 3840;
const H = 2160;
const LOOP = 300;

type Stroke = {
  rho: number; // elliptical radius (1 = edge of the clear zone)
  theta0: number;
  dev: number; // deviation from the tangent
  period: number;
  phase: number;
  life: number; // visible fraction of the period
  omega: number; // swirl speed, rad/frame
  width: number;
  alpha: number;
  paths: Path2D[]; // one per field variant
  jit: { dx: number; dy: number; da: number }[];
};

export const makeScribbleEyes = (cfg: ScribbleCfg): DrawFn => {
  const cx = W / 2;
  const cy = H * SCRIBBLE.eyeY;
  const rx0 = 900; // clear zone around the eyes (ellipse)
  const ry0 = 330;

  const ew = W * SCRIBBLE.eyeW;
  const spec: AlmondSpec = {
    w: ew,
    h: ew * SCRIBBLE.eyeAspect,
    upperPow: 0.8,
    lowerPow: 0.95,
    upperSkew: -0.2,
    lowerSkew: 0.1,
    closeAt: 0.7,
  };

  let built: null | {
    strokes: Stroke[];
    jit: AlmondJitter[][]; // [eye][variant]
    irisJit: Pt[][][]; // [eye][variant] -> point offsets
  } = null;

  const build = () => {
    const rng = makeRng(cfg.id, "field");
    const strokes: Stroke[] = [];
    let guard = 0;
    while (strokes.length < SCRIBBLE.scratchCount && guard++ < 100000) {
      const x = rng.range(-200, W + 200);
      const y = rng.range(-200, H + 200);
      const ex = (x - cx) / rx0;
      const ey = (y - cy) / ry0;
      const rho = Math.hypot(ex, ey);
      if (rho < 0.75) continue;
      // Sparse flecks everywhere, a little denser towards the edges.
      if (rng.next() > 0.3 + 0.7 * smoothstep((rho - 1) / 2.6)) continue;
      const theta0 = Math.atan2(ey, ex);
      // Short, chunky slivers (like light showing between black scribbles).
      const len = rng.next() < 0.8 ? rng.range(12, 48) : rng.range(50, 130);
      const width = rng.range(4, 11);
      const nDash = len > 60 && rng.next() < 0.5 ? 2 : 1;
      const bend = rng.range(-0.18, 0.18) * len;
      const period = rng.pick([60, 75, 100, 150]);
      const s: Stroke = {
        rho,
        theta0,
        // Local eddies on top of the global swirl.
        dev: rng.range(-0.8, 0.8) + 0.9 * Math.sin(x / 520 + 1.3) * Math.cos(y / 430 - 0.7),
        period,
        phase: rng.int(0, period - 1),
        life: rng.range(0.55, 0.85),
        omega: 0.0026 / Math.sqrt(rho),
        width,
        alpha: rng.range(0.6, 1),
        paths: [],
        jit: [],
      };
      // Dash layout along the stroke (local x from -len/2 to len/2).
      const dashes: [number, number][] = [];
      let a = -len / 2;
      const seg = len / nDash;
      for (let d = 0; d < nDash; d++) {
        const gap = d === 0 ? 0 : rng.range(8, 26);
        const b = a + seg * rng.range(0.7, 1);
        dashes.push([a + gap, b]);
        a = b;
      }
      for (let v = 0; v < SCRIBBLE.fieldVariants; v++) {
        const vr = makeRng(cfg.id, "scr", strokes.length, v);
        const p = new Path2D();
        dashes.forEach(([d0, d1], di) => {
          const pts: Pt[] = [];
          const n = 4;
          for (let k = 0; k <= n; k++) {
            const lx = lerp(d0, d1, k / n);
            const tt = lx / (len / 2);
            pts.push([lx + vr.gauss() * 1.5, bend * 0.4 * (1 - tt * tt) + vr.gauss() * 1.2]);
          }
          p.addPath(
            roughCurve(pts, {
              roughness: 0.9,
              bowing: 0.6,
              strokeWidth: width,
              seed: seedFor(cfg.id, "scr", strokes.length, v, di),
              disableMultiStroke: vr.next() < 0.4,
            }),
          );
        });
        s.paths.push(p);
        s.jit.push({ dx: vr.gauss() * 5, dy: vr.gauss() * 5, da: vr.gauss() * 0.05 });
      }
      strokes.push(s);
    }
    const jit = [0, 1].map((e) =>
      Array.from({ length: SCRIBBLE.boilVariants }, (_, v) =>
        makeJitter(makeRng(cfg.id, "eye", e, v), ew * 0.012),
      ),
    );
    const irisJit = [0, 1].map((e) =>
      Array.from({ length: SCRIBBLE.boilVariants }, (_, v) => {
        const r = makeRng(cfg.id, "iris", e, v);
        return Array.from({ length: 9 }, () => [r.gauss() * 4, r.gauss() * 3] as Pt);
      }),
    );
    built = { strokes, jit, irisJit };
    return built;
  };

  const acting = buildActing(makeRng(cfg.id, "acting"), {
    duration: LOOP,
    glanceDur: [6, 9],
    holdRange: [22, 44],
    blinkLen: 6,
    blinks: 3,
    narrow: true,
    widen: true,
  });

  return (ctx, frame, { dpr }) => {
    const B = built ?? build();

    // ---- scratch field: redrawn every 2 frames from 6 variants ----
    const fq = frame - mod(frame, SCRIBBLE.fieldHold);
    const fv = mod(fq / SCRIBBLE.fieldHold, SCRIBBLE.fieldVariants);
    ctx.strokeStyle = cfg.ink;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    for (const s of B.strokes) {
      const age = mod(fq + s.phase, s.period);
      if (age > s.life * s.period) continue;
      const th = s.theta0 + s.omega * age;
      const rs = s.rho * (1 - 0.0009 * age);
      const j = s.jit[fv];
      const x = cx + Math.cos(th) * rs * rx0 + j.dx;
      const y = cy + Math.sin(th) * rs * ry0 + j.dy;
      const ang = Math.atan2(ry0 * Math.cos(th), -rx0 * Math.sin(th)) + s.dev + j.da;
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      ctx.setTransform(c * dpr, sn * dpr, -sn * dpr, c * dpr, x * dpr, y * dpr);
      ctx.globalAlpha = s.alpha;
      ctx.lineWidth = s.width;
      ctx.stroke(s.paths[fv]);
    }
    ctx.globalAlpha = 1;

    // ---- eyes: 4 variants held 3 frames each ----
    const v = mod(Math.floor(frame / SCRIBBLE.boilHold), SCRIBBLE.boilVariants);
    const pose = acting.poseAt(frame);
    const spacing = W * SCRIBBLE.eyeSpacing;
    for (let e = 0; e < 2; e++) {
      const mirror = e === 1 ? -1 : 1;
      const ex = cx + (e === 0 ? -spacing / 2 : spacing / 2);
      // Outer corners tilt up a little (cat eye).
      const tilt = 0.035;
      ctx.setTransform(dpr * mirror, 0, 0, dpr, ex * dpr, cy * dpr);
      ctx.rotate(tilt);
      const L = lids(spec, B.jit[e][v], pose.open);
      const path = lidPath(L);
      ctx.fillStyle = cfg.eyeFill;
      ctx.fill(path);

      // Round iris + vertical slit pupil (pressure strokes), clipped to the lids.
      ctx.save();
      ctx.clip(path);
      const gx = pose.gx * mirror;
      const ix = gx * spec.w * 0.17;
      const iy = pose.gy * spec.h * 0.1;
      const ij = B.irisJit[e][v];
      const ir = spec.h * 0.5;
      const ring: Pt[] = [];
      for (let k = 0; k <= 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const jj = ij[k % 9];
        ring.push([ix + Math.cos(a) * (ir + jj[0] * 0.7), iy + Math.sin(a) * (ir * 1.04 + jj[1] * 0.7)]);
      }
      ctx.fillStyle = cfg.iris;
      ctx.fill(outlineToPath(ring.slice(0, 9)));
      const pts: Pt[] = [];
      const pr: number[] = [];
      for (let k = 0; k < 9; k++) {
        const t = k / 8;
        const yy = lerp(-0.62, 0.62, t) * ir;
        pts.push([ix + Math.sin(t * Math.PI) * 2 + ij[k][0] * 0.4, iy + yy + ij[k][1] * 0.4]);
        pr.push(Math.sin(t * Math.PI) ** 1.1);
      }
      const slitW = ir * 0.36 * pose.slit;
      ctx.fillStyle = cfg.pupil;
      ctx.fill(freehand(pts, { size: slitW, thinning: 0.9, pressures: pr, smoothing: 0.6, streamline: 0.2 }));
      ctx.restore();

      // Lid lines: pressure strokes over the edge, overshooting the outer corner.
      ctx.fillStyle = cfg.eyeFill;
      const up = L.upper;
      ctx.fill(freehand(up, { size: 10, thinning: 0.55, smoothing: 0.6, streamline: 0.3 }));
      ctx.fill(freehand(L.lower, { size: 8, thinning: 0.6, smoothing: 0.6, streamline: 0.3 }));
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
};

export const drawScribbleEyesBlue = makeScribbleEyes({
  id: "ScribbleEyes_Blue",
  background: "#000000",
  ink: "#F2F2F2",
  eyeFill: "#F8F8F8",
  iris: "#3A6AE8",
  pupil: "#0A0A0A",
});

export const drawScribbleEyesOrange = makeScribbleEyes({
  id: "ScribbleEyes_OrangeOnWhite",
  background: "#FFFFFF",
  ink: "#141414",
  eyeFill: "#111111",
  iris: "#D8551A",
  pupil: "#FFFFFF",
});

