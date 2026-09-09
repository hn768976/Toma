import type { CompositionSpec, FocusSpec, SphereSpec } from "./types";

export type Vec3 = { x: number; y: number; z: number };

const DEG = Math.PI / 180;

/** tilt/azimuth (see types.ts) -> unit vector, +z toward the viewer, +y up. */
export const unitFromAngles = (tiltDeg: number, azimuthDeg: number): Vec3 => {
  const t = tiltDeg * DEG;
  const a = azimuthDeg * DEG;
  const s = Math.sin(t);
  return { x: s * Math.cos(a), y: s * Math.sin(a), z: Math.cos(t) };
};

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const normalise = (v: Vec3): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

/** Any orthonormal pair spanning the plane perpendicular to `o`. */
const basisFor = (o: Vec3): [Vec3, Vec3] => {
  const helper: Vec3 =
    Math.abs(o.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const u = normalise(cross(helper, o));
  const v = cross(o, u);
  return [u, v];
};

/**
 * The number of blur brackets. Every ring segment is bucketed into one of
 * these, each buffer is blurred exactly once, and the four are composited.
 */
export const BLUR_BUCKETS = 4;

/** Fractions of `focus.maxBlur` applied to each bucket. */
const BUCKET_BLUR = [0, 0.16, 0.45, 1];
/**
 * Segments heading into a heavily blurred bucket are drawn brighter, so the
 * blur spreads them into a bloom instead of thinning them to nothing.
 */
const BUCKET_GAIN = [1, 1.45, 2.1, 3.0];
/**
 * The glow pass is damped in the soft brackets. Blurring an already wide,
 * boosted glow makes dense ring fields fill in as flat haze; the bright cores
 * still get the full boost above, so soft regions bloom without fogging.
 */
const BUCKET_GLOW_GAIN = [1, 1.15, 1.4, 1.7];
const BUCKET_WIDTH = [1, 1.06, 1.18, 1.34];

export const bucketBlurPx = (focus: FocusSpec, scale: number) =>
  BUCKET_BLUR.map((f) => f * focus.maxBlur * scale);

/** Points per stroked segment. Short enough that blur and brightness can
 *  change along a single ring, long enough to keep the stroke count sane. */
const SEG_POINTS = 10;
/** Target spacing between sampled points on a ring, in px. */
const SAMPLE_STEP = 10;
const MIN_SAMPLES = 96;
const MAX_SAMPLES = 2200;

export type Segment = {
  /** Flat [x0,y0,x1,y1,...] screen coordinates. */
  pts: number[];
  /** 0..1 along-ring brightness from the light direction. */
  level: number;
  coreWidth: number;
  glowWidth: number;
  bucket: number;
  /**
   * Share of the segment that lands in this bucket. A segment sitting
   * between two brackets is emitted twice with complementary weights, which
   * ramps the blur smoothly instead of leaving a visible seam where the
   * bracket changes.
   */
  weight: number;
};

export type Glow = {
  x: number;
  y: number;
  radius: number;
  level: number;
  bucket: number;
};

export type Scene = {
  segments: Segment[];
  glows: Glow[];
  /** Per-bucket blur radius in px, index-aligned with Segment.bucket. */
  blurPx: number[];
};

/**
 * Perpendicular distance from the focus band, normalised to 0 (sharp) .. 1
 * (maximum blur).
 */
const focusNorm = (
  focus: FocusSpec,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const a = focus.angle * DEG;
  // Normal to the band direction.
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  const px = x - focus.x * width;
  const py = y - focus.y * height;
  const d = Math.abs(px * nx + py * ny);
  const core = focus.halfWidth * height;
  const fall = Math.max(1, focus.falloff * height);
  return Math.max(0, Math.min(1, (d - core) / fall));
};

/** Continuous position along the bracket ladder: 0 = sharp, 3 = max blur. */
const bucketPos = (norm: number) => {
  for (let i = 0; i < BUCKET_BLUR.length - 1; i++) {
    if (norm <= BUCKET_BLUR[i + 1]) {
      const span = BUCKET_BLUR[i + 1] - BUCKET_BLUR[i];
      return i + (span === 0 ? 0 : (norm - BUCKET_BLUR[i]) / span);
    }
  }
  return BUCKET_BLUR.length - 1;
};

const bucketFor = (norm: number) => Math.round(bucketPos(norm));

/** Splits a bracket position into one or two weighted bucket assignments. */
const bucketSplit = (pos: number): Array<[number, number]> => {
  const lo = Math.floor(pos);
  const frac = pos - lo;
  if (frac < 0.1 || lo + 1 >= BLUR_BUCKETS) return [[Math.round(pos), 1]];
  if (frac > 0.9) return [[lo + 1, 1]];
  return [
    [lo, 1 - frac],
    [lo + 1, frac],
  ];
};

/**
 * Builds every drawable ring segment for one sphere.
 *
 * A ring is the set of surface points at a constant geodesic angle from the
 * origin — a circle *on the sphere*. Each is sampled parametrically, each
 * sample projected orthographically, and samples whose surface normal points
 * away from the viewer are dropped. The compression toward the limb and the
 * truncation at the horizon both fall out of that projection; neither is
 * faked.
 */
const buildSphere = (
  sphere: SphereSpec,
  focus: FocusSpec,
  width: number,
  height: number,
  out: Scene,
) => {
  const scale = width / 3840;
  const cx = sphere.centre.x * width;
  const cy = sphere.centre.y * height;
  const R = sphere.radius * width;

  const origin = unitFromAngles(sphere.origin.tilt, sphere.origin.azimuth);
  const light = unitFromAngles(sphere.light.tilt, sphere.light.azimuth);
  const [ub, vb] = basisFor(origin);

  // Anything further than this from the frame is never worth sampling, but
  // keep a margin so strokes that only clip the edge still get drawn.
  const margin = focus.maxBlur * scale * 3 + 120;

  for (let i = 0; i < sphere.ringCount; i++) {
    const thetaDeg = sphere.firstRing + i * sphere.ringSpacing;
    const theta = thetaDeg * DEG;
    if (theta >= Math.PI) break;
    const st = Math.sin(theta);
    const ct = Math.cos(theta);

    // Innermost two or three rings read as the ripple's source: brightest
    // and a touch thicker. Every fifth ring gets a smaller lift, which gives
    // the field a secondary rhythm.
    const innerLift = i < 3 ? 1.55 - i * 0.16 : 1;
    const accent = i % 5 === 0 ? 1.18 : 1;
    const ringGain = innerLift * accent * sphere.intensity;
    const ringWidth = i < 3 ? 1.3 - i * 0.08 : 1;

    const circumference = 2 * Math.PI * R * Math.max(st, 0.02);
    const samples = Math.max(
      MIN_SAMPLES,
      Math.min(MAX_SAMPLES, Math.ceil(circumference / SAMPLE_STEP)),
    );

    // Walk the ring once, collecting runs of consecutive visible points.
    let run: number[] = [];
    let runNormals: Vec3[] = [];

    const flushRun = () => {
      if (run.length >= 4) emitRun(run, runNormals);
      run = [];
      runNormals = [];
    };

    const emitRun = (pts: number[], normals: Vec3[]) => {
      const count = pts.length / 2;
      for (let s = 0; s < count - 1; s += SEG_POINTS) {
        const end = Math.min(count - 1, s + SEG_POINTS);
        const slice = pts.slice(s * 2, (end + 1) * 2);
        if (slice.length < 4) continue;
        const midIdx = Math.floor((s + end) / 2);
        const n = normals[midIdx];
        const mx = pts[midIdx * 2];
        const my = pts[midIdx * 2 + 1];

        // Lambert against the notional light, lifted so the dark side is
        // dim rather than absent, then gamma'd for a little more sheen.
        const lam = dot(n, light);
        const lit = Math.pow(Math.max(0, (lam + 0.42) / 1.42), 1.7);
        const level = Math.max(0, Math.min(1, (0.04 + 0.96 * lit) * ringGain));

        // Rings foreshorten toward the limb, so the stroke narrows with them.
        const taper = 0.42 + 0.58 * Math.pow(Math.max(0, n.z), 0.55);

        const pos = bucketPos(focusNorm(focus, mx, my, width, height));
        for (const [bucket, weight] of bucketSplit(pos)) {
          const bw = BUCKET_WIDTH[bucket];
          out.segments.push({
            pts: slice,
            level,
            coreWidth: sphere.coreWidth * scale * taper * ringWidth * bw,
            glowWidth: sphere.glowWidth * scale * taper * ringWidth * bw,
            bucket,
            weight,
          });
        }
      }
    };

    for (let s = 0; s <= samples; s++) {
      const phi = (s / samples) * Math.PI * 2;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const n: Vec3 = {
        x: origin.x * ct + (ub.x * cp + vb.x * sp) * st,
        y: origin.y * ct + (ub.y * cp + vb.y * sp) * st,
        z: origin.z * ct + (ub.z * cp + vb.z * sp) * st,
      };
      // Only the near hemisphere exists as far as the viewer is concerned.
      if (n.z <= 0.004) {
        flushRun();
        continue;
      }
      const x = cx + R * n.x;
      const y = cy - R * n.y;
      if (
        x < -margin ||
        x > width + margin ||
        y < -margin ||
        y > height + margin
      ) {
        flushRun();
        continue;
      }
      run.push(x, y);
      runNormals.push(n);
    }
    flushRun();
  }

  // The origin itself carries a small soft glow.
  if (origin.z > 0) {
    const ox = cx + R * origin.x;
    const oy = cy - R * origin.y;
    if (
      ox > -margin &&
      ox < width + margin &&
      oy > -margin &&
      oy < height + margin
    ) {
      // The glow spot is a patch of surface, so it foreshortens toward the
      // limb along with the rings — without this an origin sitting on the
      // limb blooms into a round smudge that reads as a lens flare.
      const face = Math.pow(origin.z, 0.6);
      out.glows.push({
        x: ox,
        y: oy,
        radius:
          Math.max(60 * scale, sphere.ringSpacing * DEG * R * 1.5) *
          (0.35 + 0.65 * face),
        level: sphere.intensity * (0.2 + 0.8 * face),
        bucket: bucketFor(focusNorm(focus, ox, oy, width, height)),
      });
    }
  }
};

export const buildScene = (
  spec: CompositionSpec,
  width: number,
  height: number,
): Scene => {
  const scale = width / 3840;
  const scene: Scene = {
    segments: [],
    glows: [],
    blurPx: bucketBlurPx(spec.focus, scale),
  };
  for (const sphere of spec.spheres) {
    buildSphere(sphere, spec.focus, width, height, scene);
  }
  return scene;
};

export const bucketGain = (bucket: number) => BUCKET_GAIN[bucket];
export const bucketGlowGain = (bucket: number) => BUCKET_GLOW_GAIN[bucket];
