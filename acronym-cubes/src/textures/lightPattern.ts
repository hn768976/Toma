// What the key light shines through, modelled on the reference: window light
// with soft diagonal lattice shadows, a perforated screen throwing rows of
// soft rounded spots on parts of the sheet, and open sun over the cube row
// (so the cubes are evenly sunlit and cast clean shadows).
//
// The pattern is DESIGNED in frame fractions (where it should land in the
// shot) and then projected back through the key light's own camera into the
// SpotLight.map texture. Because it is a real projected light, it also falls
// on the cubes and bends over their edges. Values are linear transmission
// (0 = blocked, 1 = full sun). Generated once, at module level.

import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import { makeNoise2D, seeded } from "../lib/prng";
import { makePaperToScreen } from "../lib/screen";
import { KEY_POS, KEY_TARGET } from "../lib/world";

export const KEY_ANGLE = 0.64; // spot cone half-angle (rad); covers the sheet
const S = 2048;
const varNoise = makeNoise2D(seeded("light-pattern", 5));
const ASPECT = 16 / 9;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// Soft periodic stripe: 1 on the stripe, 0 between, `soft` = edge width.
const stripe = (p: number, period: number, width: number, soft: number) => {
  const f = Math.abs(p / period - Math.round(p / period)) * period;
  return 1 - smoothstep(width / 2 - soft / 2, width / 2 + soft / 2, f);
};

// Sun transmission at a point of the frame (fx across, fy down, 0..1).
// As in the reference, most of the sheet sits in cool skylight; the warm sun
// arrives (a) as rows of soft spots through a perforated screen, in patches
// on the left and upper right, (b) as soft diagonal bands of light through
// gaps in a lattice, and (c) as a broad open patch over the cube row, so the
// cubes are sunlit and cast clear shadows.
export const sunAt = (fx: number, fy: number) => {
  const X = fx * ASPECT; // frame-height units
  const Y = fy;

  // (c) open sun over the cube row.
  const open = Math.exp(-(((fx - 0.5) / 0.22) ** 2) - ((fy - 0.55) / 0.2) ** 2);

  // (b) diagonal bands of light through lattice gaps.
  const pA = X * 0.88 - Y * 0.47 + 0.05 * Math.sin(Y * 3.1);
  const pB = X * 0.8 + Y * 0.6 + 0.04 * Math.sin(X * 2.4);
  const bands = Math.max(
    stripe(pA - 0.18, 0.62, 0.1, 0.16),
    0.45 * stripe(pB - 0.05, 0.92, 0.07, 0.14),
  );

  // (a) perforated screen: soft rounded spots in slanted, gently curved rows.
  const rowPitch = 0.043;
  const colPitch = 0.052;
  const Yr = Y - 0.12 * X + 0.03 * Math.sin(X * 2.2);
  const row = Math.floor(Yr / rowPitch);
  const fr = Yr / rowPitch - row;
  const Xr = X + ((row & 1) * colPitch) / 2 + 0.004 * Math.sin(row * 1.7);
  const fc = Xr / colPitch - Math.floor(Xr / colPitch);
  const dx = Math.abs((fc - 0.5) * colPitch);
  const dy = Math.abs((fr - 0.5) * rowPitch);
  const hw = 0.0135;
  const hh = 0.0092;
  const r = 0.008;
  const qx = Math.max(dx - hw + r, 0);
  const qy = Math.max(dy - hh + r, 0);
  const d = Math.hypot(qx, qy) - r;
  const spot = 1 - smoothstep(-0.008, 0.007, d);
  const right = smoothstep(0.58, 0.74, fx) * (1 - 0.7 * smoothstep(0.72, 0.98, fy));
  const left = smoothstep(0.36, 0.18, fx) * smoothstep(0.98, 0.72, fy);
  // Patchy: parts of the screen are shaded by foliage.
  const patch = smoothstep(0.28, 0.62, varNoise(X * 3.2, Y * 3.2));
  const dots = Math.max(right, left) * (0.25 + 0.75 * patch) * spot;

  const sun = Math.max(0.92 * open, 0.5 * bands * (1 - 0.5 * open), 0.95 * dots);
  // The screen and leaves still pass some diffuse sun everywhere.
  return Math.min(Math.max(sun, 0.2), 1);
};

let cached: HTMLCanvasElement | null = null;

export const lightPatternCanvas = (): HTMLCanvasElement => {
  if (cached) return cached;
  // The key light's projection, exactly as three's SpotLightShadow sets it up.
  const cam = new PerspectiveCamera(MathUtils.RAD2DEG * 2 * KEY_ANGLE, 1, 1, 100);
  cam.position.set(...KEY_POS);
  cam.lookAt(...KEY_TARGET);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const toScreen = makePaperToScreen(0);

  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const p = new Vector3();
  const o = cam.position;
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      // Canvas row 0 is the top of the texture (v = 1 after flipY).
      const u = (px + 0.5) / S;
      const v = 1 - (py + 0.5) / S;
      p.set(2 * u - 1, 2 * v - 1, 0.5).unproject(cam);
      const dyr = p.y - o.y;
      let val = 0;
      if (dyr < 0) {
        const t = -o.y / dyr;
        const [fx, fy] = toScreen(o.x + (p.x - o.x) * t, o.z + (p.z - o.z) * t);
        val = sunAt(fx, fy);
      }
      const i = (py * S + px) * 4;
      const b = Math.round(val * 255);
      img.data[i] = b;
      img.data[i + 1] = b;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cached = c;
  return c;
};
