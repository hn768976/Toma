import * as THREE from "three";
import { CELL } from "./constants";
import { hash2 } from "./random";
import { fbm4, noise2 } from "./noise";
import type { VariantConfig } from "./variants";

export type Field = {
  count: number;
  /** Lattice position of each bar. */
  x: Float32Array;
  z: Float32Array;
  /** Resting height in cells, before animation. */
  baseHeight: Float32Array;
  /** How far the animation swings this bar away from its resting height. */
  amp: Float32Array;
  /** 1 for the minority of bars that snap between levels instead of drifting. */
  snap: Float32Array;
  /** Offset into the noise field, so neighbours are not in lockstep. */
  phase: Float32Array;
  /** Linear-space RGB, three floats per bar. */
  color: Float32Array;
  /** 0..1 — how far this bar burns out toward white at the tip. */
  hot: Float32Array;
  /** Tip-dot radius in world units; 0 means this bar has no dot. */
  dotSize: Float32Array;
  /** Distance from the resting camera to the bar's base. */
  dist: Float32Array;
  /** Instance indices to draw in each depth band, including cross-fade overlap. */
  bandLists: Uint32Array[];
};

/** Camera state for a given frame. Shared by every layer so they stay locked. */
export type CameraState = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
};

export const cameraAt = (cfg: VariantConfig, t: number): CameraState => {
  const { camera } = cfg;
  const a = Math.PI * 2 * t;
  // Both terms are periodic over t in [0, 1): the drift returns exactly to its
  // starting point on the last frame of the loop.
  const dx = Math.sin(a) * camera.driftX;
  const dz = (Math.cos(a) - 1) * 0.5 * camera.driftZ;
  return {
    position: new THREE.Vector3(
      camera.position[0] + dx,
      camera.position[1],
      camera.position[2] + dz,
    ),
    target: new THREE.Vector3(
      camera.target[0] + dx,
      camera.target[1],
      camera.target[2] + dz,
    ),
    fov: camera.fov,
  };
};

const linear = (hex: string) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b] as const;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Places the bars.
 *
 * Only lattice cells that actually project inside the frame are considered, so
 * the bar budget is spent on pixels the viewer can see rather than on a square
 * grid whose corners are off-camera. Everything is derived from position
 * hashes, never from a stateful PRNG, so the field is identical no matter what
 * order cells are visited in.
 */
export const buildField = (cfg: VariantConfig, aspect: number): Field => {
  const { plane, bars } = cfg;

  const cam = new THREE.PerspectiveCamera(cfg.camera.fov, aspect, 0.1, 4000);
  cam.position.set(...cfg.camera.position);
  cam.lookAt(new THREE.Vector3(...cfg.camera.target));
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  const viewProj = new THREE.Matrix4().multiplyMatrices(
    cam.projectionMatrix,
    cam.matrixWorldInverse,
  );

  const colA = linear(cfg.palette.a);
  const colB = linear(cfg.palette.b);
  const colHot = linear(cfg.palette.hot);

  const p = new THREE.Vector3();
  const camPos = cam.position;

  const xs: number[] = [];
  const zs: number[] = [];
  const heights: number[] = [];
  const amps: number[] = [];
  const snaps: number[] = [];
  const phases: number[] = [];
  const cols: number[] = [];
  const hots: number[] = [];
  const dots: number[] = [];
  const dists: number[] = [];

  // Bars just outside the frame still matter: their blur and bloom spill back
  // in, and the camera drifts laterally over the loop. The margin covers the
  // canvas overscan plus the widest blur radius and no more — every cell past
  // that is a bar nobody will ever see.
  const MARGIN = 1.12;

  for (let ix = Math.ceil(plane.minX / CELL); ix <= plane.maxX / CELL; ix++) {
    for (let iz = Math.ceil(plane.minZ / CELL); iz <= plane.maxZ / CELL; iz++) {
      const wx = ix * CELL;
      const wz = iz * CELL;

      // Cull against the frustum using the bar's base and its tallest reach.
      p.set(wx, 0, wz).applyMatrix4(viewProj);
      const baseInside =
        p.z > 0 && Math.abs(p.x) < MARGIN && Math.abs(p.y) < MARGIN;
      let inside = baseInside;
      if (!inside) {
        p.set(wx, bars.maxHeight, wz).applyMatrix4(viewProj);
        inside = p.z > 0 && Math.abs(p.x) < MARGIN && Math.abs(p.y) < MARGIN;
      }
      if (!inside) continue;

      // Past this point the distance fade has taken the bar to black, so
      // building it would cost fill rate for nothing.
      const d = Math.hypot(wx - camPos.x, camPos.y, wz - camPos.z);
      if (d > bars.maxDist) continue;

      if (hash2(ix, iz, 0x101) >= bars.occupancy) continue;

      // Height: a steep power curve keeps the field mostly low with rare spires.
      const hr = hash2(ix, iz, 0x202);
      const baseHeight =
        bars.minHeight + bars.maxHeight * Math.pow(hr, bars.heightPow);

      // Hue pools into regions: a low-frequency field with a mid-frequency
      // break-up, contrast-stretched so most cells commit to one colour.
      let t =
        noise2(wx * 0.045, wz * 0.045, 0x303) * 0.74 +
        noise2(wx * 0.135, wz * 0.135, 0x404) * 0.26;
      // Hard contrast stretch: the reference pools into magenta regions and
      // blue regions with few cells caught in the purple between them.
      t = clamp01((t - 0.5) * 3.4 + 0.5);
      t = t * t * (3 - 2 * t);
      t = t * t * (3 - 2 * t);

      let r = colA[0] + (colB[0] - colA[0]) * t;
      let g = colA[1] + (colB[1] - colA[1]) * t;
      let b = colA[2] + (colB[2] - colA[2]) * t;

      // The blue end of the palette reads hazier than the magenta end in the
      // reference; knock it back slightly rather than letting it compete.
      const dim = 1 - 0.12 * t;
      r *= dim;
      g *= dim;
      b *= dim;

      const isHot = hash2(ix, iz, 0x505) < bars.hotFraction;
      if (isHot) {
        const k = 0.75;
        r += (colHot[0] - r) * k;
        g += (colHot[1] - g) * k;
        b += (colHot[2] - b) * k;
      }

      const snap = hash2(ix, iz, 0x606) < bars.jumpFraction ? 1 : 0;

      xs.push(wx);
      zs.push(wz);
      heights.push(baseHeight);
      amps.push(snap ? 0.85 : 0.2 + hash2(ix, iz, 0x909) * 0.18);
      snaps.push(snap);
      phases.push(hash2(ix, iz, 0x707) * 97.13);
      cols.push(r, g, b);
      hots.push(isHot ? 1 : 0);

      const hasDot = hash2(ix, iz, 0x808) < bars.dotFraction;
      dots.push(
        hasDot ? bars.dotSize * (0.75 + hash2(ix, iz, 0xa0a) * 0.6) : 0,
      );
      dists.push(d);
    }
  }

  const count = xs.length;

  // Assign instances to depth bands. A bar is included in a band if any part of
  // it could fall inside the band's cross-fade window, so tall bars that span a
  // boundary are drawn (and faded) in both layers.
  const bandLists = cfg.bands.map((band) => {
    const list: number[] = [];
    const lo = band.near - band.fade - bars.maxHeight;
    const hi = band.far + band.fade + bars.maxHeight;
    for (let i = 0; i < count; i++) {
      if (dists[i] >= lo && dists[i] <= hi) list.push(i);
    }
    return Uint32Array.from(list);
  });

  console.log(`[data-city] ${cfg.id}: ${count} bars from ${cfg.bands.length} bands`);

  return {
    count,
    x: Float32Array.from(xs),
    z: Float32Array.from(zs),
    baseHeight: Float32Array.from(heights),
    amp: Float32Array.from(amps),
    snap: Float32Array.from(snaps),
    phase: Float32Array.from(phases),
    color: Float32Array.from(cols),
    hot: Float32Array.from(hots),
    dotSize: Float32Array.from(dots),
    dist: Float32Array.from(dists),
    bandLists,
  };
};

/**
 * Per-frame bar heights.
 *
 * Computed once for the whole scene and shared by every layer, so the bands can
 * never disagree about where a bar's tip is. `t` is `frame / durationInFrames`,
 * and the noise is sampled on a circle in its last two dimensions — that is the
 * whole trick behind the seamless loop.
 */
export const heightsAt = (
  field: Field,
  t: number,
  out: Float32Array,
): Float32Array => {
  const a = Math.PI * 2 * t;
  const ct = Math.cos(a) * 1.15;
  const st = Math.sin(a) * 1.15;

  for (let i = 0; i < field.count; i++) {
    const ph = field.phase[i];
    let n = fbm4(field.x[i] * 0.085 + ph, field.z[i] * 0.085 + ph, ct, st, 0x51);
    if (field.snap[i]) {
      // A minority of bars step between levels instead of breathing.
      n = n < 0.5 ? n * n * 2 : 1 - (1 - n) * (1 - n) * 2;
      n = n * n * (3 - 2 * n);
    }
    const h = field.baseHeight[i] * (1 + field.amp[i] * (n * 2 - 1));
    out[i] = h < 0.06 ? 0.06 : h;
  }
  return out;
};
