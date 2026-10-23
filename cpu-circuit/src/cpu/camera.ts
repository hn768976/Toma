// Camera choreography. Each shot is a slow move between two poses; shots are
// joined by fast "whip" moves (the reference has no hard cuts: the camera
// rushes from one framing to the next in ~0.4 s, smeared by motion blur).

export type V3 = [number, number, number];
export type Pose = { pos: V3; target: V3; fov: number; aperture: number };
type Shot = { t0: number; t1: number; a: Pose; b: Pose };

export type CameraVariant = "reference" | "crane";

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp3 = (a: V3, b: V3, k: number): V3 => [
  lerp(a[0], b[0], k),
  lerp(a[1], b[1], k),
  lerp(a[2], b[2], k),
];
const lerpPose = (a: Pose, b: Pose, k: number): Pose => ({
  pos: lerp3(a.pos, b.pos, k),
  target: lerp3(a.target, b.target, k),
  fov: lerp(a.fov, b.fov, k),
  aperture: lerp(a.aperture, b.aperture, k),
});
const easeInOut = (k: number) =>
  k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const easeSine = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k);

// V1 — matches the reference: three framings joined by two whip moves.
const REFERENCE_SHOTS: Shot[] = [
  {
    // Elevated three-quarter view of the package corner, creeping in and up
    // the right-hand edge as the contacts light up.
    t0: 0,
    t1: 4.8,
    a: {
      pos: [-0.42, 5.81, 4.67],
      target: [0.41, 1.17, 0.29],
      fov: 34,
      aperture: 60,
    },
    b: {
      pos: [-0.2, 4.4, 2.6],
      target: [0.5, 0.9, -1.2],
      fov: 34,
      aperture: 66,
    },
  },
  {
    // Close, low view along the edge, sliding over the traces.
    t0: 5.2,
    t1: 8.2,
    a: {
      pos: [0.06, 2.03, -1.58],
      target: [1.36, -0.94, -4.97],
      fov: 38,
      aperture: 110,
    },
    b: {
      pos: [0.1, 1.95, -2.5],
      target: [1.4, -0.94, -5.9],
      fov: 38,
      aperture: 110,
    },
  },
  {
    // Higher, rotated view over the back corner and the trace maze, drifting.
    t0: 8.6,
    t1: 12.04,
    a: {
      pos: [-0.59, 6.9, -0.34],
      target: [0.34, 1.28, -3.8],
      fov: 34,
      aperture: 75,
    },
    b: {
      pos: [-0.4, 6.6, -0.7],
      target: [0.45, 1.2, -4.05],
      fov: 34,
      aperture: 75,
    },
  },
];

// V2 — alternative camera: one continuous overhead crane move. It starts
// almost top-down above the trace field, then cranes down and orbits round
// the package corner into a low, grazing glide along the lit edge.
const CRANE_KEYS: { t: number; p: Pose }[] = [
  {
    t: 0,
    p: { pos: [2.2, 7.2, -2.2], target: [1.6, 0, -3.4], fov: 40, aperture: 22 },
  },
  {
    t: 4.5,
    p: { pos: [4.6, 4.2, -0.6], target: [1.2, 0, -3.0], fov: 38, aperture: 34 },
  },
  {
    t: 8.5,
    p: { pos: [4.2, 1.5, -6.8], target: [0.6, 0, -2.8], fov: 36, aperture: 60 },
  },
  {
    t: 12.04,
    p: {
      pos: [2.6, 0.75, -8.6],
      target: [0.45, 0, -3.6],
      fov: 34,
      aperture: 80,
    },
  },
];

// Catmull-Rom through the crane keys keeps the move continuous.
const crPose = (t: number): Pose => {
  const keys = CRANE_KEYS;
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const k = Math.max(
    0,
    Math.min(1, (t - keys[i].t) / (keys[i + 1].t - keys[i].t)),
  );
  const p0 = keys[Math.max(0, i - 1)].p;
  const p1 = keys[i].p;
  const p2 = keys[i + 1].p;
  const p3 = keys[Math.min(keys.length - 1, i + 2)].p;
  const cr = (a: number, b: number, c: number, d: number) => {
    const k2 = k * k;
    const k3 = k2 * k;
    return (
      0.5 *
      (2 * b +
        (-a + c) * k +
        (2 * a - 5 * b + 4 * c - d) * k2 +
        (-a + 3 * b - 3 * c + d) * k3)
    );
  };
  const cr3 = (a: V3, b: V3, c: V3, d: V3): V3 => [
    cr(a[0], b[0], c[0], d[0]),
    cr(a[1], b[1], c[1], d[1]),
    cr(a[2], b[2], c[2], d[2]),
  ];
  return {
    pos: cr3(p0.pos, p1.pos, p2.pos, p3.pos),
    target: cr3(p0.target, p1.target, p2.target, p3.target),
    fov: cr(p0.fov, p1.fov, p2.fov, p3.fov),
    aperture: cr(p0.aperture, p1.aperture, p2.aperture, p3.aperture),
  };
};

export const poseAt = (variant: CameraVariant, t: number): Pose => {
  if (variant === "crane") return crPose(t);
  const shots = REFERENCE_SHOTS;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    if (t <= s.t1 || i === shots.length - 1) {
      if (t >= s.t0) {
        return lerpPose(
          s.a,
          s.b,
          easeSine(Math.min(1, (t - s.t0) / (s.t1 - s.t0))),
        );
      }
      // Whip from the previous shot's end pose into this one.
      const prev = shots[i - 1];
      const k = (t - prev.t1) / (s.t0 - prev.t1);
      return lerpPose(prev.b, s.a, easeInOut(k));
    }
  }
  return shots[shots.length - 1].b;
};
