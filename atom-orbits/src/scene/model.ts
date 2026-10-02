/**
 * Build-time scene data. Everything here is generated ONCE per look at module
 * level from a seeded mulberry32, then the per-frame helpers below turn a frame
 * number into positions/angles. No state is carried between frames.
 */
import { Euler, Quaternion, Vector3 } from "three";
import { assertWhole, cycleFrac, loopSin } from "../lib/loop";
import { int, mulberry32, range, sign, type Rng } from "../lib/random";
import type { LookConfig } from "../looks/types";

export type StrandModel = {
  /** constant radial / normal offset from the ideal ellipse */
  baseOff: [number, number];
  /** 3 radial harmonics, flattened vec4s: amp, k (cycles round the orbit), m (cycles per loop), phase */
  wr: number[];
  /** 3 out-of-plane harmonics, same layout */
  wn: number[];
  /** how far (orbit fraction) this strand's head lags the electron */
  lag: number;
  trailScale: number;
  /** brightness ripple along the strand: amp, k, m, phase */
  flick: [number, number, number, number];
  gain: number;
};

export type OrbitModel = {
  a: number;
  b: number;
  quaternion: [number, number, number, number];
  laps: number;
  phase0: number;
  strands: StrandModel[];
};

export type Star = { x: number; y: number; size: number; bright: number; cycles: number; phase: number };
export type Bokeh = {
  x: number; y: number; r: number; color: 0 | 1 | 2; intensity: number;
  ax: number; ay: number; cx: number; cy: number; px: number; py: number;
};
export type Sphere = [number, number, number, number];

export type AtomModel = {
  look: LookConfig;
  orbits: OrbitModel[];
  nucleusSpheres: Sphere[];
  stars: Star[];
  bokeh: Bokeh[];
  bgDrift: [number, number];
};

const harmonic = (rng: Rng, amp: number, kMin: number, kMax: number, mMax: number) => [
  amp,
  int(rng, kMin, kMax),
  // whole cycles per loop so the wisp shape loops; 0 = static
  int(rng, -mMax, mMax),
  range(rng, 0, Math.PI * 2),
];

export const buildModel = (look: LookConfig): AtomModel => {
  const rng = mulberry32(look.seed);
  const orbits: OrbitModel[] = [];
  let globalIndex = 0;

  for (const group of look.orbitGroups) {
    for (let i = 0; i < group.count; i++, globalIndex++) {
      const laps = group.laps[i % group.laps.length];
      assertWhole(laps, `${look.id} orbit ${globalIndex} laps`);
      const a = range(rng, group.radius[0], group.radius[1]);
      const b = a * range(rng, group.flatness[0], group.flatness[1]);

      const q = new Quaternion();
      if (group.tilt === "classic") {
        // atom-symbol fan: each ring tilted ~72° away from the viewer,
        // then fanned evenly around the view axis.
        const tilt = 1.25 + range(rng, -0.06, 0.06);
        const fan = (i * Math.PI) / group.count + range(rng, -0.05, 0.05);
        q.setFromEuler(new Euler(tilt, 0, fan, "ZXY"));
      } else {
        // normals spread over the sphere (fibonacci + jitter), random in-plane spin
        const k = i + 0.5;
        const y = 1 - (2 * k) / group.count;
        const rad = Math.sqrt(Math.max(0, 1 - y * y));
        const phi = k * 2.399963 + range(rng, -0.35, 0.35) + globalIndex;
        const normal = new Vector3(Math.cos(phi) * rad, y, Math.sin(phi) * rad).normalize();
        const toNormal = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal);
        const spin = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), range(rng, 0, Math.PI * 2));
        q.multiplyQuaternions(toNormal, spin);
      }

      const strands: StrandModel[] = [];
      for (let s = 0; s < look.strands; s++) {
        const w = look.wispAmount;
        const centred = look.strands === 1 ? 0 : s / (look.strands - 1) - 0.5;
        strands.push({
          baseOff: look.strands === 1 ? [0, 0] : [centred * w * 0.9 + range(rng, -0.2, 0.2) * w, range(rng, -0.6, 0.6) * w],
          wr: look.strands === 1 ? [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]
            : [...harmonic(rng, w * range(rng, 0.5, 1.0), 2, 5, 2), ...harmonic(rng, w * range(rng, 0.25, 0.5), 5, 11, 3), ...harmonic(rng, w * range(rng, 0.1, 0.25), 9, 19, 4)],
          wn: look.strands === 1 ? [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]
            : [...harmonic(rng, w * range(rng, 0.5, 1.0), 2, 5, 2), ...harmonic(rng, w * range(rng, 0.25, 0.5), 5, 11, 3), ...harmonic(rng, w * range(rng, 0.1, 0.25), 9, 19, 4)],
          lag: s === 0 ? 0 : range(rng, 0.002, 0.02),
          trailScale: s === 0 ? 1 : range(rng, 0.75, 1.15),
          flick: look.strands === 1 ? [0, 1, 0, 0] : [range(rng, 0.15, 0.35), int(rng, 3, 11), sign(rng) * int(rng, 1, 4), range(rng, 0, Math.PI * 2)],
          gain: s === 0 ? 1 : range(rng, 0.55, 0.95),
        });
      }

      orbits.push({
        a,
        b,
        quaternion: [q.x, q.y, q.z, q.w],
        laps,
        // golden-ratio spread so electrons start well apart
        phase0: (globalIndex * 0.618034 + range(rng, -0.05, 0.05) + 1) % 1,
        strands,
      });
    }
  }

  // Nucleus cluster: fibonacci shell + jitter + a couple of inner spheres.
  const nucleusSpheres: Sphere[] = [];
  if (look.nucleus === "cluster") {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const k = i + 0.5;
      const y = 1 - (2 * k) / n;
      const rad = Math.sqrt(1 - y * y);
      const phi = k * 2.399963;
      const shell = 0.105 + range(rng, -0.012, 0.012);
      nucleusSpheres.push([
        Math.cos(phi) * rad * shell + range(rng, -0.01, 0.01),
        y * shell + range(rng, -0.01, 0.01),
        Math.sin(phi) * rad * shell + range(rng, -0.01, 0.01),
        range(rng, 0.066, 0.078),
      ]);
    }
    nucleusSpheres.push([0.02, 0.01, 0.03, 0.07], [-0.02, -0.015, -0.02, 0.07]);
  }

  const stars: Star[] = [];
  for (let i = 0; i < look.stars.count; i++) {
    const big = rng();
    stars.push({
      x: range(rng, -1, 1),
      y: range(rng, -1, 1),
      size: 0.9 + 2.4 * big * big * big,
      bright: look.stars.brightness * (0.25 + 0.75 * rng() * rng()),
      cycles: int(rng, 1, 5),
      phase: range(rng, 0, Math.PI * 2),
    });
  }

  const bokeh: Bokeh[] = [];
  if (look.bokeh) {
    for (let i = 0; i < look.bokeh.count; i++) {
      // keep discs out of the very centre so they read as background
      let x = 0;
      let y = 0;
      do {
        x = range(rng, -0.85, 0.85);
        y = range(rng, -0.48, 0.48);
      } while (Math.hypot(x * 0.8, y) < 0.22);
      bokeh.push({
        x, y,
        r: range(rng, 0.008, 0.028),
        color: (i % 3) as 0 | 1 | 2,
        intensity: range(rng, 0.5, 1),
        ax: range(rng, 0.015, 0.05),
        ay: range(rng, 0.01, 0.035),
        cx: sign(rng) * int(rng, 1, 2),
        cy: sign(rng) * int(rng, 1, 2),
        px: range(rng, 0, Math.PI * 2),
        py: range(rng, 0, Math.PI * 2),
      });
    }
  }

  return { look, orbits, nucleusSpheres, stars, bokeh, bgDrift: [range(rng, 0, 6.28), range(rng, 0, 6.28)] };
};

// ---------------------------------------------------------------- per frame

/** Electron position along its orbit, [0, 1). Whole laps → loops exactly. */
export const electronPhase = (o: OrbitModel, frame: number) =>
  (o.phase0 + cycleFrac(o.laps, frame)) % 1;

export const electronLocal = (o: OrbitModel, frame: number): [number, number, number] => {
  const th = 2 * Math.PI * electronPhase(o, frame);
  return [o.a * Math.cos(th), o.b * Math.sin(th), 0];
};

/** Whole-atom orientation for a frame: whole spin turns + closed sine sway. */
export const atomQuaternion = (look: LookConfig, frame: number, enabled = true): Quaternion => {
  const m = look.motion;
  if (!enabled) return new Quaternion();
  const axis = new Vector3(...m.spinAxis).normalize();
  const spin = new Quaternion().setFromAxisAngle(axis, 2 * Math.PI * cycleFrac(m.spinTurns, frame));
  const sx = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), m.swayX[0] * loopSin(m.swayX[1], frame));
  const sy = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), m.swayY[0] * loopSin(m.swayY[1], frame, 1.3));
  return sx.multiply(sy).multiply(spin);
};

/** Distance from camera to atom centre so the atom fills `atomHeightFraction` of the frame height. */
export const cameraDistance = (look: LookConfig) => {
  const visibleHeight = 2 / look.atomHeightFraction; // outermost orbit ≈ radius 1
  return visibleHeight / 2 / Math.tan(((look.fov / 2) * Math.PI) / 180);
};

export const cameraPosition = (look: LookConfig, frame: number, enabled = true): [number, number, number] => {
  const d = cameraDistance(look);
  if (!enabled) return [0, 0, d];
  const m = look.motion;
  return [
    m.cameraDrift[0] * loopSin(m.cameraDriftCycles[0], frame),
    m.cameraDrift[1] * loopSin(m.cameraDriftCycles[1], frame, 0.7),
    d + 0.5 * m.cameraDrift[0] * loopSin(m.cameraDriftCycles[0], frame, 2.1),
  ];
};

export const bokehAt = (b: Bokeh, frame: number): [number, number] => [
  b.x + b.ax * loopSin(b.cx, frame, b.px),
  b.y + b.ay * loopSin(b.cy, frame, b.py),
];
