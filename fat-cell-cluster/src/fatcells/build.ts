/**
 * Build-time scene generation.
 *
 * Remotion renders frames out of order across several threads, so nothing here
 * may run per frame. Every cluster, mesh, strand and speck in the project is
 * produced once when this module is evaluated, from a generator seeded by the
 * composition id, and is then only ever read. The meshes in particular are
 * expensive and would not agree between threads if they were rebuilt.
 */

import * as THREE from "three";
import { Cell } from "./field";
import { buildCellSurface, buildIsosurface } from "./isosurface";
import { toBufferGeometry } from "./geometry";
import { clusterRadius, packCluster } from "./cluster";
import {
  DeflationSpec, DriftSpec, SpinSpec, makeDeflation, makeDrift, makeSpin,
} from "./motion";
import { mulberry32, onSphere, range, rangeInt, Rng, seedFrom } from "./random";
import { LookRow } from "./looks";

/** Every composition is 16:9. */
const ASPECT = 16 / 9;

export type ClusterInstance = {
  geometry: THREE.BufferGeometry;
  cells: Cell[];
  radius: number;
  position: [number, number, number];
  scale: number;
  spin: SpinSpec;
  drift: DriftSpec;
  /**
   * The shrinking look only. Each cell is its own closed mesh, so it can empty
   * and come away from its neighbours as a rigid body — a merged mesh would
   * stretch the creases between separating cells into flat strips.
   */
  cellMeshes?: CellMesh[];
  /** True for the hero cluster or the front tissue mass. */
  hero: boolean;
};

export type CellMesh = {
  geometry: THREE.BufferGeometry;
  cell: Cell;
  deflation: DeflationSpec;
  /** Radius the cell keeps once emptied; a few survive larger than the rest. */
  residual: number;
  /** Where the fragment drifts once it has finished emptying. */
  drift: DriftSpec;
  /** Tumble axis and rate for the drifting fragment. */
  tumbleAxis: [number, number, number];
  tumbleRate: number;
};

export type FibreInstance = {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  drift: DriftSpec;
  opacity: number;
};

export type SpeckField = {
  positions: Float32Array;
  drift: Float32Array; // amp.xyz + integer freq.xyz + phase.xyz, 9 per speck
  sizes: Float32Array;
  count: number;
};

export type BuiltScene = {
  clusters: ClusterInstance[];
  membrane?: { geometry: THREE.BufferGeometry; cells: Cell[] };
  fibres: FibreInstance[];
  specks?: SpeckField;
  /** Largest cell count across the meshes, so the shader arrays are sized once. */
  maxCells: number;
  /** Derived from the hero's built radius and the row's requested fill. */
  cameraDistance: number;
};

/** Tapered tube swept along a Catmull-Rom path. */
const buildFibre = (rng: Rng, length: number, radius: number): THREE.BufferGeometry => {
  const pts: THREE.Vector3[] = [];
  const dir = new THREE.Vector3(...onSphere(rng));
  dir.z *= 0.25;
  dir.normalize();
  const start = new THREE.Vector3(
    range(rng, -1, 1), range(rng, -1, 1), range(rng, -1, 1),
  ).multiplyScalar(length * 0.2);
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push(new THREE.Vector3(
      start.x + dir.x * (t - 0.5) * length + range(rng, -1, 1) * length * 0.07,
      start.y + dir.y * (t - 0.5) * length + range(rng, -1, 1) * length * 0.07,
      start.z + dir.z * (t - 0.5) * length + range(rng, -1, 1) * length * 0.05,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const segments = 90;
  const radial = 5;
  const positions: number[] = [];
  const normals: number[] = [];
  const index: number[] = [];
  const frames = curve.computeFrenetFrames(segments, false);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    // Taper slightly toward both ends so strands fade out rather than stop.
    const r = radius * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, Math.max(0, t))));
    const N = frames.normals[Math.min(i, segments - 1)];
    const B = frames.binormals[Math.min(i, segments - 1)];
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const nx = Math.cos(a) * N.x + Math.sin(a) * B.x;
      const ny = Math.cos(a) * N.y + Math.sin(a) * B.y;
      const nz = Math.cos(a) * N.z + Math.sin(a) * B.z;
      positions.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
      normals.push(nx, ny, nz);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      index.push(a, b, a + radial, b, b + radial, a + radial);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setIndex(index);
  return g;
};

/**
 * Dust specks live in a shallow band around the focal plane. A speck placed
 * deep in the blurred field is spread over so many pixels that it disappears
 * entirely, so the band is kept tight and the sizes small.
 */
const buildSpecks = (rng: Rng, count: number, spread: number): SpeckField => {
  const positions = new Float32Array(count * 3);
  const drift = new Float32Array(count * 9);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = range(rng, -1, 1) * spread;
    positions[i * 3 + 1] = range(rng, -1, 1) * spread * 0.6;
    positions[i * 3 + 2] = range(rng, -0.3, 0.26) * spread;
    // Closed path: integer frequencies, so every speck returns to its start.
    drift[i * 9] = range(rng, 0.2, 0.9);
    drift[i * 9 + 1] = range(rng, 0.2, 0.9);
    drift[i * 9 + 2] = range(rng, 0.1, 0.5);
    drift[i * 9 + 3] = rangeInt(rng, 1, 2);
    drift[i * 9 + 4] = rangeInt(rng, 1, 2);
    drift[i * 9 + 5] = rangeInt(rng, 1, 2);
    drift[i * 9 + 6] = range(rng, 0, Math.PI * 2);
    drift[i * 9 + 7] = range(rng, 0, Math.PI * 2);
    drift[i * 9 + 8] = range(rng, 0, Math.PI * 2);
    sizes[i] = range(rng, 3.0, 8.5);
  }
  return { positions, drift, sizes, count };
};


/**
 * Where a background cluster can sit without covering the hero.
 *
 * Positions are drawn and tested in screen space — a cluster nearer the camera
 * than the hero projects much larger, so a depth-blind scatter puts blurred
 * masses straight over the subject. Candidates are rejected until one clears
 * the hero's projected circle, which is what keeps the hero readable while
 * still letting clusters crop the frame edges.
 */
const placeBackdrop = (
  rng: Rng,
  row: LookRow,
  cameraDistance: number,
  heroScreenRadius: number,
  clusterRadiusWorld: number,
  aspect: number,
  /** Which depth band this cluster belongs to, and how many bands there are. */
  band: number,
  bands: number,
): { position: [number, number, number]; scale: number } => {
  const halfAngle = Math.tan((row.camera.fov * Math.PI) / 360);
  // Depth is stratified rather than scattered: one cluster per band gives a
  // real gradient of sharpness across the frame instead of several clusters
  // that happen to land at similar blur.
  const lo = row.backdropDepth[0] +
    ((row.backdropDepth[1] - row.backdropDepth[0]) * band) / bands;
  const hi = row.backdropDepth[0] +
    ((row.backdropDepth[1] - row.backdropDepth[0]) * (band + 1)) / bands;
  let last: { position: [number, number, number]; scale: number } | null = null;
  for (let attempt = 0; attempt < 48; attempt++) {
    const z = range(rng, lo, hi);
    const depth = (cameraDistance - z) / cameraDistance;
    const scale = range(rng, 0.5, 1.2) * Math.min(1.8, Math.sqrt(depth));
    const halfH = (cameraDistance - z) * halfAngle;
    const rs = (clusterRadiusWorld * scale) / halfH;
    // Aim at the ring just outside the hero, out to where the cluster only
    // partly crops into frame.
    // Screen position in half-height units on both axes, so the exclusion
    // zone around the hero is round. Measuring x in half-WIDTH units instead
    // stretches it by the aspect ratio and pushes every background cluster off
    // the sides of the frame.
    const angle = range(rng, 0, Math.PI * 2);
    const reach = range(rng, heroScreenRadius * 0.95 + rs * 0.6, 1.55 + rs);
    const sx = Math.cos(angle) * reach;
    const sy = Math.sin(angle) * reach;
    const candidate = {
      position: [sx * halfH, sy * halfH, z] as [number, number, number],
      scale,
    };
    last = candidate;
    const screenGap = Math.hypot(sx, sy);
    if (screenGap < heroScreenRadius + rs) continue;
    // And it has to be at least partly on screen to be worth building.
    if (Math.abs(sx) > aspect + rs || Math.abs(sy) > 1 + rs) continue;
    return candidate;
  }
  return last as { position: [number, number, number]; scale: number };
};

const makeCluster = (
  rng: Rng,
  row: LookRow,
  opts: {
    count: number;
    radius: number;
    resolution: number;
    position: [number, number, number];
    scale: number;
    turns: number;
    driftFraction: number;
    extent: [number, number, number];
    hero: boolean;
    deflating?: boolean;
  },
): ClusterInstance => {
  const cells = packCluster(rng, {
    count: opts.count,
    radius: opts.radius,
    extent: opts.extent,
    overlap: row.overlap,
    density: row.density,
    lumpiness: row.kind === "tissue" ? 0.06 : opts.hero ? 0.14 : 0.28,
  });
  const iso = buildIsosurface(cells, {
    blend: row.blend * opts.radius,
    resolution: opts.resolution,
    aoStrength: 1,
    // A packed mass occludes over a wider radius than a loose cluster: the
    // deep amber in the gaps is occlusion from several cells away, not just
    // from the two forming the crease.
    aoRadius: row.kind === "tissue" ? 1.9 : 0.95,
  });
  const radius = clusterRadius(cells);
  const instance: ClusterInstance = {
    geometry: toBufferGeometry(iso, cells),
    cells,
    radius,
    position: opts.position,
    scale: opts.scale,
    spin: makeSpin(rng, opts.turns),
    drift: makeDrift(rng, radius * 2 * opts.driftFraction),
    hero: opts.hero,
  };
  return instance;
};

/**
 * Camera distance that puts the hero at the fill the row asks for. Framing is
 * expressed as a fraction of the frame rather than as a hard-coded distance,
 * so changing the cell count does not silently change the shot.
 */
const heroDistance = (row: LookRow, heroRadius: number): number =>
  heroRadius / (row.camera.fill * Math.tan((row.camera.fov * Math.PI) / 360));

const buildLook = (row: LookRow): BuiltScene => {
  const rng = mulberry32(seedFrom(row.seed));
  let cameraDistance = 15;
  const clusters: ClusterInstance[] = [];
  const fibres: FibreInstance[] = [];
  let membrane: BuiltScene["membrane"];

  if (row.kind === "floating" || row.kind === "fibre") {
    clusters.push(makeCluster(rng, row, {
      count: row.heroCells, radius: 1, resolution: row.heroResolution,
      position: [0, 0, 0], scale: 1, turns: 1, driftFraction: row.drift,
      extent: row.extent, hero: true,
    }));
    // Smaller clusters at several depths, most of them heavily blurred.
    const hero = clusters[0];
    cameraDistance = heroDistance(row, hero.radius);
    const heroScreenRadius = row.camera.fill;
    for (let i = 0; i < row.backdropCount; i++) {
      const spot = placeBackdrop(
        rng, row, cameraDistance, heroScreenRadius, hero.radius * 0.8, ASPECT,
        i, row.backdropCount,
      );
      clusters.push(makeCluster(rng, row, {
        count: rangeInt(rng, 22, 44), radius: 1,
        resolution: spot.position[2] > 2 ? 54 : 70,
        position: spot.position,
        scale: spot.scale,
        turns: rangeInt(rng, 1, 2),
        driftFraction: row.drift,
        extent: [range(rng, 0.85, 1.2), range(rng, 0.85, 1.2), 0.95],
        hero: false,
      }));
    }
  }

  if (row.kind === "tissue") {
    if (row.tissue === "full") {
      // One continuous slab, wide and shallow, plus two more behind it. The
      // front slab overfills the frame on purpose: no pixel of the sharp layer
      // may land on background.
      const layers = [
        { z: 0, count: row.heroCells, res: row.heroResolution, scale: 1, turns: 0 },
        { z: -11, count: 150, res: 170, scale: 1.55, turns: 0 },
        { z: -24, count: 90, res: 120, scale: 2.3, turns: 1 },
      ];
      layers.forEach((layer, i) => {
        clusters.push(makeCluster(rng, row, {
          count: layer.count, radius: 1, resolution: layer.res,
          position: [range(rng, -1, 1), range(rng, -1, 1), layer.z],
          scale: layer.scale,
          // The front mass holds still apart from its drift; a whole turn at
          // this framing would read as a spinning wheel rather than tissue.
          turns: layer.turns,
          driftFraction: row.drift,
          // Same slab shape all the way back, scaled up with depth so the
          // layers behind still cover the frame.
          extent: row.extent,
          hero: i === 0,
        }));
      });
    } else {
      // Several separate masses with the field showing between them.
      // Separate masses with the field showing between them; offsets are in
      // units of the front mass's own width so they scale with it.
      const spots: [number, number, number, number][] = [
        [-0.35, 0.28, 1.0, 1.0],
        [0.62, -0.30, -3.5, 0.8],
        [-0.30, -0.70, -8.0, 0.85],
        [0.85, 0.72, -13.0, 0.75],
        [-1.05, -0.15, -18.0, 0.95],
      ];
      let frontWidth = 14;
      spots.forEach((spot, i) => {
        clusters.push(makeCluster(rng, row, {
          count: i === 0 ? row.heroCells : rangeInt(rng, 26, 46),
          radius: 1,
          resolution: i === 0 ? row.heroResolution : 120,
          position: [spot[0] * frontWidth, spot[1] * frontWidth, spot[2]],
          scale: spot[3],
          turns: i === 0 ? 0 : 1,
          driftFraction: row.drift,
          extent: i === 0
            ? row.extent
            : [range(rng, 8, 14), range(rng, 4, 8), 3],
          hero: i === 0,
        }));
        if (i === 0) {
          let w = 0;
          for (const c of clusters[0].cells) w = Math.max(w, Math.abs(c.cx) + c.r);
          frontWidth = w;
        }
      });
    }
    // Layer 0 is the front mass and is pushed first, so it frames the shot.
    cameraDistance = heroDistance(row, clusters[0].radius);
    for (let i = 0; i < row.backdropCount; i++) {
      const a = range(rng, 0, Math.PI * 2);
      const spread = range(rng, 7, 15);
      clusters.push(makeCluster(rng, row, {
        count: rangeInt(rng, 16, 30), radius: 1, resolution: 66,
        position: [Math.cos(a) * spread, Math.sin(a) * spread * 0.7,
          range(rng, row.backdropDepth[0], row.backdropDepth[1])],
        scale: range(rng, 0.9, 1.6),
        turns: 1, driftFraction: row.drift,
        extent: [1.6, 1.2, 0.8], hero: false,
      }));
    }
  }

  if (row.kind === "shrinking") {
    const makeShrinking = (
      count: number,
      extent: [number, number, number],
      resolution: number,
      position: [number, number, number],
      scale: number,
      hero: boolean,
    ): ClusterInstance => {
      const cells = packCluster(rng, {
        count, radius: 1, extent,
        overlap: row.overlap, density: row.density,
        lumpiness: hero ? 0.24 : 0.3,
      });
      const deflation = makeDeflation(rng, cells.length);
      // Most cells empty almost completely; a few keep enough volume to read
      // as the fragments still drifting at the end.
      const survivors = new Set<number>();
      const keep = Math.max(2, Math.round(cells.length * 0.16));
      while (survivors.size < keep) survivors.add(rangeInt(rng, 0, cells.length - 1));
      const cellMeshes: CellMesh[] = cells.map((cell, i) => {
        const iso = buildCellSurface(cell, cells, {
          soften: row.blend * 1.6,
          resolution,
          aoStrength: 1.35,
        });
        return {
          geometry: toBufferGeometry(iso, [cell]),
          cell,
          deflation: deflation[i],
          residual: survivors.has(i) ? range(rng, 0.42, 0.56) : range(rng, 0.2, 0.3),
          drift: makeDrift(rng, range(rng, 1.0, 2.4), 1),
          tumbleAxis: onSphere(rng),
          tumbleRate: range(rng, -2.4, 2.4),
        };
      });
      return {
        geometry: new THREE.BufferGeometry(),
        cells,
        radius: clusterRadius(cells),
        position, scale,
        spin: makeSpin(rng, 0),
        drift: makeDrift(rng, clusterRadius(cells) * 2 * row.drift),
        cellMeshes,
        hero,
      };
    };

    clusters.push(makeShrinking(
      row.heroCells, row.extent, row.heroResolution, [0, 0, 0], 1, true,
    ));
    cameraDistance = heroDistance(row, clusters[0].radius);
    if (row.tissue === "full") {
      // Two fields behind the first, so the frame reads as packed tissue
      // while the front cells are still at full size. The hero count is kept
      // low so the fragments stay large once it collapses, which leaves the
      // covering to these.
      clusters.push(makeShrinking(
        Math.round(row.heroCells * 1.1), row.extent,
        Math.round(row.heroResolution * 0.85), [0, 0, -7], 1.7, false,
      ));
      clusters.push(makeShrinking(
        Math.round(row.heroCells * 0.9), row.extent,
        Math.round(row.heroResolution * 0.7), [0, 0, -15], 2.3, false,
      ));
    }
    for (let i = 0; i < row.backdropCount; i++) {
      const a = range(rng, 0, Math.PI * 2);
      const spread = range(rng, 7, 15);
      clusters.push(makeShrinking(
        rangeInt(rng, 5, 10), [1.1, 1.0, 0.9], 30,
        [Math.cos(a) * spread, Math.sin(a) * spread * 0.7,
          range(rng, row.backdropDepth[0], row.backdropDepth[1])],
        range(rng, 0.6, 1.1), false,
      ));
    }
  }

  if (row.membrane > 0) {
    // The same field at a slightly larger isosurface: a film over the whole
    // mass, not a second layer of cells. Prominent on the packed tissue,
    // barely there on the dark look, absent elsewhere.
    const host = clusters[0];
    const iso = buildIsosurface(host.cells, {
      // Hugs the cells rather than enveloping them — a much larger smoothing
      // constant at barely any offset, so the film crosses over several cells
      // and softens the creases beneath instead of outlining each one.
      blend: row.blend * 3.2,
      resolution: Math.round(row.heroResolution * 0.5),
      iso: 0.07,
      aoStrength: 0,
      aoRadius: 1.6,
    });
    membrane = { geometry: toBufferGeometry(iso, host.cells), cells: host.cells };
  }

  if (row.fibres > 0) {
    for (let i = 0; i < row.fibres; i++) {
      // Spread across depth: some in front of the cluster and blurred, some
      // behind it and sharper. Mostly diagonal, never parallel.
      const z = range(rng, -14, 9);
      fibres.push({
        geometry: buildFibre(rng, range(rng, 40, 70), range(rng, 0.012, 0.05)),
        position: [range(rng, -6, 6), range(rng, -5, 5), z],
        drift: makeDrift(rng, range(rng, 0.25, 0.8), 1),
        opacity: z > 1 ? range(rng, 0.07, 0.15) : range(rng, 0.1, 0.22),
      });
    }
  }

  const specks =
    row.specks > 0 ? buildSpecks(rng, row.specks, cameraDistance * 0.95) : undefined;
  const maxCells = clusters.reduce((m, c) => Math.max(m, c.cells.length), 1);
  return { clusters, membrane, fibres, specks, maxCells, cameraDistance };
};

const cache = new Map<string, BuiltScene>();

/** Built once per composition, at module scope, and shared by every frame. */
export const getScene = (row: LookRow): BuiltScene => {
  let built = cache.get(row.id);
  if (!built) {
    built = buildLook(row);
    cache.set(row.id, built);
  }
  return built;
};
