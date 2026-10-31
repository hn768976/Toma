import { mulberry32, smoothstep } from "./random";

/**
 * A "shot" is a sheet of parallel light lines lying on an animated 3D
 * surface. `build` writes `lines * points` xyz positions for time `t`
 * (seconds since the shot started).
 */
export type Shot = {
  lines: number;
  points: number;
  build: (t: number, out: Float32Array) => void;
  /** Positions of the floating sparkle particles. */
  sparkles: number;
  buildSparkles: (t: number, out: Float32Array) => void;
};

/** Uneven spacing across the sheet: lines bunch together and spread apart. */
const makeAcross = (lines: number, seed: number) => {
  const rnd = mulberry32(seed);
  const raw: number[] = [];
  let acc = 0;
  for (let i = 0; i < lines; i++) {
    acc += 0.35 + rnd() * 1.3;
    raw.push(acc);
  }
  return raw.map((x) => x / acc);
};

/* ------------------------------------------------------------------------ */
/* Shot A: a wall of lines that rises towards the camera on the left and    */
/* bends over a crest, sweeping away to the right into the distance.        */
/* ------------------------------------------------------------------------ */
export const makeCrestShot = (): Shot => {
  const lines = 300;
  const points = 220;
  const across = makeAcross(lines, 11);
  const length = 34;

  const sparkles = 700;
  const rnd = mulberry32(99);
  const sp = Array.from({ length: sparkles }, () => ({
    v: rnd(),
    u: rnd(),
    lift: (rnd() - 0.3) * 0.5,
    drift: 0.01 + rnd() * 0.02,
  }));

  // Each line runs away from the camera, then turns right. Lines on the
  // left run straight for longer and climb steeply first, so the left side
  // of the sheet rises into a tall wall while the right side sweeps away
  // towards the horizon.
  const z0 = 9; // near end of the sheet
  const W = 22; // sheet width at the near end
  const point = (v: number, u: number, t: number, o: number[]) => {
    const l = 1 - v; // 1 = far left
    const run = 2 + 15 * Math.pow(l, 1.1); // straight run before turning
    const r = 3 + 7 * l; // turn radius
    // left lines end soon after they start to turn (high above frame);
    // right lines continue all the way to the horizon
    const len = Math.min(length, run + r * (Math.PI / 2) * (0.3 + 0.7 * v) + 14 * Math.pow(v, 1.5));
    const s = u * len;
    const x0 = (v - 0.5) * W;
    let x: number;
    let z: number;
    if (s < run) {
      x = x0;
      z = z0 - s;
    } else {
      const phi = Math.min((s - run) / r, Math.PI * 0.5);
      const rest = Math.max(0, s - run - r * Math.PI * 0.5);
      x = x0 + r - r * Math.cos(phi) + rest;
      z = z0 - run - r * Math.sin(phi);
    }
    const climb = (1.2 + 15 * Math.pow(l, 1.9)) * smoothstep(1.0, run + r * 1.3, s);
    const swell =
      0.45 * Math.sin(0.3 * x + 0.22 * z - t * 0.9) +
      0.25 * Math.sin(0.55 * x - 0.35 * z + t * 0.6 + 1.3) +
      0.5 * l * Math.sin(0.3 * s - t * 0.8 + v * 3.0) * (1 - smoothstep(run - 4, run + 2, s));
    o[0] = x + 0.6 * l * Math.sin(0.25 * s + t * 0.5) * (1 - smoothstep(run - 4, run + 2, s));
    o[1] = climb + swell * smoothstep(0, 6, s) - 1.4;
    o[2] = z;
  };

  return {
    lines,
    points,
    sparkles,
    build: (t, out) => {
      const o = [0, 0, 0];
      for (let i = 0; i < lines; i++) {
        const v = across[i];
        for (let j = 0; j < points; j++) {
          point(v, j / (points - 1), t, o);
          const k = (i * points + j) * 3;
          out[k] = o[0];
          out[k + 1] = o[1];
          out[k + 2] = o[2];
        }
      }
    },
    buildSparkles: (t, out) => {
      const o = [0, 0, 0];
      sp.forEach((s, i) => {
        point(s.v, (s.u + t * s.drift) % 1, t, o);
        out[i * 3] = o[0];
        out[i * 3 + 1] = o[1] + 0.08 + s.lift;
        out[i * 3 + 2] = o[2];
      });
    },
  };
};

/* ------------------------------------------------------------------------ */
/* Shot B: a ribbon of lines folded into a hairpin on the "floor"; its far  */
/* branch curls up into a rising wall on the right.                          */
/* ------------------------------------------------------------------------ */
export const makeFoldShot = (): Shot => {
  const lines = 340;
  const points = 300;
  const across = makeAcross(lines, 23);
  const R = 4.3; // centre-line radius of the hairpin
  const W = 8.2; // ribbon width (inner radius = R - W/2)
  const nearLen = 18;
  const farLen = 12;
  const arcLen = Math.PI * R;
  const total = nearLen + arcLen + farLen;
  const wallStart = 3.0; // x where the far branch starts to curl up
  const wallR = 3.0;

  const sparkles = 700;
  const rnd = mulberry32(7);
  const sp = Array.from({ length: sparkles }, () => ({
    v: rnd(),
    u: rnd(),
    lift: (rnd() - 0.3) * 0.5,
    drift: 0.008 + rnd() * 0.015,
  }));

  const point = (u: number, v: number, t: number, o: number[]) => {
    const s = u * total - nearLen; // s<0 near branch, 0..arcLen arc, > far
    const w = (v - 0.5) * W; // + = outward
    let x: number;
    let z: number;
    if (s < 0) {
      x = -s;
      z = R + w;
    } else if (s < arcLen) {
      const phi = s / R;
      const r = R + w;
      x = -r * Math.sin(phi);
      z = r * Math.cos(phi);
    } else {
      x = s - arcLen;
      z = -(R + w);
    }
    let y = 0;
    if (s > arcLen && x > wallStart) {
      // curl up into a wall
      const d = x - wallStart;
      const maxA = Math.PI * 0.32;
      const alpha = Math.min(d / wallR, maxA);
      const rest = Math.max(0, d - wallR * maxA);
      x = wallStart + wallR * Math.sin(alpha) + rest * Math.sin(maxA);
      y = wallR * (1 - Math.cos(alpha)) + rest * Math.cos(maxA);
      // the wall leans back a little and ripples
      z -= y * 0.25;
      x += 0.25 * Math.sin(y * 0.8 + t * 0.8 + w * 0.6) * smoothstep(0, 1.5, y);
    }
    // gentle undulation of the whole sheet
    y +=
      0.18 * Math.sin(0.45 * x + 0.5 * z + t * 0.9) +
      0.1 * Math.sin(0.9 * z - 0.3 * x - t * 0.7);
    o[0] = x;
    o[1] = y;
    o[2] = z;
  };

  return {
    lines,
    points,
    sparkles,
    build: (t, out) => {
      const o = [0, 0, 0];
      for (let i = 0; i < lines; i++) {
        const v = across[i];
        for (let j = 0; j < points; j++) {
          point(j / (points - 1), v, t, o);
          const k = (i * points + j) * 3;
          out[k] = o[0];
          out[k + 1] = o[1];
          out[k + 2] = o[2];
        }
      }
    },
    buildSparkles: (t, out) => {
      const o = [0, 0, 0];
      sp.forEach((s, i) => {
        point((s.u + t * s.drift) % 1, s.v, t, o);
        out[i * 3] = o[0];
        out[i * 3 + 1] = o[1] + 0.08 + s.lift;
        out[i * 3 + 2] = o[2];
      });
    },
  };
};
