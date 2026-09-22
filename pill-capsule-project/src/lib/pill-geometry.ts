import * as THREE from "three";
import { arcPoints, revolve, type ProfilePoint } from "./revolve";

/**
 * All pill geometry is authored in "pill units": the capsule body has
 * diameter 1 and the whole capsule is 3 long, centred on the origin, axis +Y.
 * Compositions scale instances from there.
 */

/** Radial tessellation. 64 is the floor: a smooth white silhouette against a
 *  clean backdrop shows faceting immediately below that, and these renders are
 *  authored at 4K. It is also the ceiling worth paying for here — a field of
 *  ~200 instanced capsules is several million triangles a frame. */
export const RADIAL_SEGMENTS = 64;

const BODY_R = 0.5;
// Length is ~2.75x diameter. The brief says "roughly 3x"; the reference clips
// sit nearer 2.2x, and a slightly fatter capsule also puts more pixels across
// the cap's join step, which is the detail that decides whether these read as
// pills at all.
const HALF_L = 1.375;
/** Centre of each hemispherical end. */
const DOME_Y = HALF_L - BODY_R;

/**
 * The cap is a separate shell that slips OVER the body, so it is wider. This
 * 6% step is most of what separates a convincing capsule from a rounded
 * cylinder, and it is deliberately larger than a real gelatin capsule's: at
 * 1080p a physically exact 2-3% step is barely one pixel and the join reads as
 * a flat painted line. Do not "clean it up".
 */
const CAP_SCALE = 1.06;
const CAP_R = BODY_R * CAP_SCALE;
/** Where the cap rim sits: a little past the midpoint, toward the body end. */
const RIM_Y = -0.055 * (HALF_L * 2);

/**
 * Body: a plain capsule (cylinder + two hemispheres). Its upper half is hidden
 * inside the cap, but it is modelled in full so the silhouette is closed for
 * the luma matte.
 */
export const buildCapsuleBody = (): THREE.BufferGeometry => {
  const pts: ProfilePoint[] = [
    ...arcPoints(0, -DOME_Y, BODY_R, -90, 0, 26),
    ...arcPoints(0, DOME_Y, BODY_R, 0, 90, 26),
  ];
  return revolve(dedupe(pts), RADIAL_SEGMENTS);
};

/**
 * Cap: an open-ended shell. From the bottom it is the rim roll (which reads as
 * the step), then a straight skirt, then the dome.
 */
export const buildCapsuleCap = (): THREE.BufferGeometry => {
  const bevel = 0.014;
  const pts: ProfilePoint[] = [
    // The rim is an annulus facing straight DOWN, from the body's surface out
    // to the cap's full diameter. Facing away from every light in the rig, it
    // renders as the fine dark line under the lip — the second half of the
    // join cue, after the diameter step itself. A rounded-over rim catches
    // light instead and the line disappears.
    { x: BODY_R * 1.004, y: RIM_Y, crease: true },
    { x: CAP_R - bevel, y: RIM_Y, crease: true },
    { x: CAP_R, y: RIM_Y + bevel, crease: true },
    { x: CAP_R, y: DOME_Y },
    ...arcPoints(0, DOME_Y, CAP_R, 0, 90, 30),
  ];
  return revolve(dedupe(pts), RADIAL_SEGMENTS, 28);
};

/**
 * Round tablet: diameter 3x the thickness, domed faces, generously rounded
 * edge. Built as a superellipse of revolution — a plain ellipsoid is too
 * lens-like and a rounded cylinder too industrial.
 *
 * Authored with diameter 1 (radius 0.5) so it shares the capsule's unit scale.
 */
export const buildTablet = (score: boolean): THREE.BufferGeometry => {
  const R = 0.5;
  const H = R / 3; // half-thickness; diameter 2R = 3 * thickness 2H
  const e = 3.6; // superellipse exponent: flat-ish face, round edge
  const steps = 104;
  const pts: ProfilePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / steps;
    const c = Math.max(0, Math.cos(t));
    const s = Math.sin(t);
    pts.push({
      x: R * Math.pow(c, 2 / e),
      y: H * Math.sign(s) * Math.pow(Math.abs(s), 2 / e),
    });
  }
  const geom = revolve(dedupe(pts), RADIAL_SEGMENTS);
  if (score) applyScoreLine(geom, R, H);
  return geom;
};

/**
 * A shallow score groove across the upper face. A plain groove only — no
 * lettering, no numerals, no logo: see the blank-pill constraint in the README.
 */
const applyScoreLine = (geom: THREE.BufferGeometry, R: number, H: number) => {
  const halfWidth = R * 0.062;
  const depth = H * 0.30;
  const pos = geom.getAttribute("position") as THREE.BufferAttribute;
  const nrm = geom.getAttribute("normal") as THREE.BufferAttribute;

  /** Groove depth at signed cross-axis distance x and planar radius r. */
  const g = (x: number, r: number) => {
    const u = Math.abs(x) / halfWidth;
    if (u >= 1) return 0;
    const profile = Math.cos((u * Math.PI) / 2) ** 2;
    // Ease the groove out before the silhouette so it never notches the rim.
    const taper = 1 - smoothstep(R * 0.72, R * 0.995, r) * 0.72;
    return depth * profile * taper;
  };

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (y <= 0) continue;
    const r = Math.hypot(x, z);
    const d = g(x, r);
    if (d === 0) continue;
    // Face weight: full on the flat of the face, nothing on the lower half.
    const w = smoothstep(0, H * 0.55, y);
    pos.setY(i, y - d * w);
    // Tilt the normal by the groove's slope instead of recomputing vertex
    // normals, which would seam at U=0/1 and flatten the analytic dome.
    const h = halfWidth * 1e-3;
    const slope = ((g(x + h, r) - g(x - h, r)) / (2 * h)) * w;
    const nx = nrm.getX(i) + slope;
    const ny = nrm.getY(i);
    const nz = nrm.getZ(i);
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(i, nx / l, ny / l, nz / l);
  }
  pos.needsUpdate = true;
  nrm.needsUpdate = true;
  geom.computeBoundingSphere();
  geom.computeBoundingBox();
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Drop profile points that coincide with their predecessor. */
const dedupe = (pts: ProfilePoint[]): ProfilePoint[] => {
  const out: ProfilePoint[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (q && Math.abs(q.x - p.x) < 1e-7 && Math.abs(q.y - p.y) < 1e-7) {
      if (p.crease) q.crease = true;
      continue;
    }
    out.push({ ...p });
  }
  return out;
};

/**
 * Shared geometry singletons. Built once at module load — no randomness, no
 * per-frame allocation.
 */
export const GEOM = {
  capsuleBody: buildCapsuleBody(),
  capsuleCap: buildCapsuleCap(),
  tabletPlain: buildTablet(false),
  tabletScored: buildTablet(true),
};

/**
 * The caplet is the capsule flattened to 70% depth, so it reads as pressed
 * rather than filled. It is the same geometry with a non-uniform instance
 * scale — see CAPLET_DEPTH.
 */
export const CAPLET_DEPTH = 0.7;

/** Full capsule length in pill units, including the cap's 3.4% overhang. */
export const CAPSULE_LENGTH = HALF_L + DOME_Y + CAP_R;
