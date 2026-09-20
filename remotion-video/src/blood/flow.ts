import * as THREE from "three";
import { mulberry32, range, type Rng } from "./rng";

/**
 * The drift model.
 *
 * Cells sit in a box and the whole population translates along one direction at
 * one speed, wrapping on each axis. That is a rigid motion on a 3-torus, and a
 * rigid motion is an isometry: whatever separation the cells are given at
 * placement time, they keep for every frame of every version, forever.
 *
 * This is why the obvious embellishments are absent. Per-cell speed jitter lets
 * a fast cell overtake and pass through a slow one. Per-cell wobble changes the
 * distances between neighbours. Scaling positions to the camera frustum — which
 * is how an earlier version kept screen density even with depth — *converges*
 * cells as they approach the lens, squeezing them into each other. Each of
 * those is a collision the moment two cells are close, so none of them are
 * here; the depth cue comes from perspective and fog instead.
 */

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export const normalizeDirection = ([x, y, z]: [number, number, number]) =>
  new THREE.Vector3(x, y, z).normalize();

/** The periodic box the population lives in. */
export type Volume = {
  halfWidth: number;
  halfHeight: number;
  /** Closest Z — slightly behind the lens, so cells leave frame before wrapping. */
  zNear: number;
  /** Farthest Z, deep enough that fog has swallowed the wrap. */
  zFar: number;
};

export type Cell = {
  x: number;
  y: number;
  z: number;
  /** World radius. The geometry is normalised to radius 1, so this is also its scale. */
  size: number;
  /** Euler angles at t = 0, and their angular velocities. */
  rot: [number, number, number];
  spin: [number, number, number];
  tint: THREE.Color;
};

/**
 * Sizes the box from the camera.
 *
 * Width and height come from the frustum at the far plane — the widest the
 * frame ever is — times `fill`. That margin is what puts every wrap-around off
 * screen: a cell re-entering the far side of the box is always outside the
 * frame when it does so.
 */
export const computeVolume = (
  depth: number,
  fov: number,
  aspect: number,
  fill: number,
  nearZ: number,
): Volume => {
  const halfHeight = depth * Math.tan((fov * Math.PI) / 360) * fill;
  return {
    halfWidth: halfHeight * aspect,
    halfHeight,
    zNear: nearZ,
    zFar: -depth,
  };
};

const wrapInto = (value: number, min: number, max: number) => {
  const span = max - min;
  return min + (((value - min) % span) + span) % span;
};

/** Separation along one periodic axis: the shorter way round. */
const torusDelta = (delta: number, span: number) => {
  const d = Math.abs(delta) % span;
  return Math.min(d, span - d);
};

export type SampleOptions = {
  count: number;
  seed: number;
  volume: Volume;
  size: [number, number];
  /** Clear space to leave between two cell surfaces, in world units. */
  margin: number;
  tumble: number;
  color: string;
  colorSpread: number;
  /** Motes are specks of light, not bodies; they may overlap. */
  enforceSpacing?: boolean;
  attempts?: number;
  /** Keep-out radius around the lens, on top of the cell's own. 0 disables. */
  cameraClearance?: number;
  /** Seconds of travel the clearance must hold for — the clip's own length. */
  duration?: number;
  flowDirection?: [number, number, number];
  flowSpeed?: number;
};

/**
 * True when a cell's whole path stays clear of the lens.
 *
 * A cell that drifts through the camera position is not a collision with
 * another cell, but it looks like a defect: the near clip plane slices it and
 * it renders as a hard-edged slab across the frame. Cells are made to pass
 * beside the lens instead, which is what they appear to do in the references.
 *
 * The path is sampled rather than solved because wrapping turns it into a
 * series of segments, not one line. At 30 samples a second a cell moves a
 * fraction of the keep-out radius between samples, so it cannot step over it.
 */
const clearsCamera = (
  x: number,
  y: number,
  z: number,
  size: number,
  clearance: number,
  direction: THREE.Vector3,
  speed: number,
  volume: Volume,
  duration: number,
) => {
  const need = size + clearance;
  const needSq = need * need;
  const steps = Math.ceil(duration * 30);
  const probe = { x, y, z, size, rot: [0, 0, 0], spin: [0, 0, 0], tint: BLACK } as Cell;
  const out = new THREE.Vector3();

  for (let step = 0; step <= steps; step++) {
    cellPosition(probe, step / 30, direction, speed, volume, out);
    if (out.lengthSq() < needSq) {
      return false;
    }
  }
  return true;
};

const BLACK = new THREE.Color("#000000");

/**
 * Places cells so that no two of them touch.
 *
 * Dart-throwing against the toroidal metric: a candidate is kept only if its
 * centre clears every already-placed centre by the sum of the two radii plus a
 * margin. Because the metric is toroidal, the guarantee survives wrapping.
 *
 * A cell is a disc of radius `size` and lesser thickness, so its bounding
 * sphere is `size` whatever its orientation — which is what lets the cells
 * tumble freely without ever being able to clip one another.
 *
 * Largest first: a big cell is the hardest to fit, and placing it while the box
 * is still empty is what keeps the requested count reachable.
 */
export const sampleCells = (options: SampleOptions): Cell[] => {
  const { volume, margin, tumble } = options;
  const rng: Rng = mulberry32(options.seed);
  const enforceSpacing = options.enforceSpacing ?? true;
  const attempts = options.attempts ?? 48;

  const spanX = volume.halfWidth * 2;
  const spanY = volume.halfHeight * 2;
  const spanZ = volume.zNear - volume.zFar;

  const sizes = Array.from({ length: options.count }, () =>
    range(rng, options.size[0], options.size[1]),
  ).sort((a, b) => b - a);

  const base = new THREE.Color(options.color);
  const cells: Cell[] = [];

  const clearance = options.cameraClearance ?? 0;
  const direction = options.flowDirection
    ? normalizeDirection(options.flowDirection)
    : new THREE.Vector3(0, 0, 1);
  const speed = options.flowSpeed ?? 0;
  const duration = options.duration ?? 0;

  const makeCell = (x: number, y: number, z: number, size: number): Cell => {
    const tint = base.clone();
    if (options.colorSpread > 0) {
      const hsl = { h: 0, s: 0, l: 0 };
      tint.getHSL(hsl);
      tint.setHSL(
        (hsl.h + range(rng, -0.012, 0.012) + 1) % 1,
        THREE.MathUtils.clamp(
          hsl.s + range(rng, -options.colorSpread * 0.5, options.colorSpread * 0.25),
          0,
          1,
        ),
        THREE.MathUtils.clamp(hsl.l * (1 + range(rng, -options.colorSpread, options.colorSpread)), 0.02, 0.85),
      );
    }
    return {
      x,
      y,
      z,
      size,
      rot: [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2],
      spin: [range(rng, -tumble, tumble), range(rng, -tumble, tumble), range(rng, -tumble, tumble)],
      tint,
    };
  };

  for (const size of sizes) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const x = range(rng, -volume.halfWidth, volume.halfWidth);
      const y = range(rng, -volume.halfHeight, volume.halfHeight);
      const z = range(rng, volume.zFar, volume.zNear);

      if (!enforceSpacing) {
        cells.push(makeCell(x, y, z, size));
        break;
      }

      if (clearance > 0 && !clearsCamera(x, y, z, size, clearance, direction, speed, volume, duration)) {
        continue;
      }

      let clear = true;
      for (let i = 0; i < cells.length; i++) {
        const other = cells[i];
        const need = size + other.size + margin;
        // Cheap per-axis rejects first: most candidates are nowhere near.
        const dx = torusDelta(x - other.x, spanX);
        if (dx >= need) {
          continue;
        }
        const dy = torusDelta(y - other.y, spanY);
        if (dy >= need) {
          continue;
        }
        const dz = torusDelta(z - other.z, spanZ);
        if (dz >= need) {
          continue;
        }
        if (dx * dx + dy * dy + dz * dz < need * need) {
          clear = false;
          break;
        }
      }

      if (clear) {
        cells.push(makeCell(x, y, z, size));
        break;
      }
      // Out of attempts: the cell is dropped rather than forced in. A slightly
      // thinner field is a fair price for the guarantee holding absolutely.
    }
  }

  return cells;
};

/** Position of a cell at time `t`, wrapped back into the box. */
export const cellPosition = (
  cell: Cell,
  time: number,
  direction: THREE.Vector3,
  speed: number,
  volume: Volume,
  out: THREE.Vector3,
) => {
  const travel = speed * time;
  out.set(
    wrapInto(cell.x + direction.x * travel, -volume.halfWidth, volume.halfWidth),
    wrapInto(cell.y + direction.y * travel, -volume.halfHeight, volume.halfHeight),
    wrapInto(cell.z + direction.z * travel, volume.zFar, volume.zNear),
  );
  return out;
};

