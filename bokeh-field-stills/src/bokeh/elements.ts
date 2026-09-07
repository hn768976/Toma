import { random } from "remotion";
import { CONFIG, DensityName, REFERENCE_WIDTH } from "./config";
import { PALETTES, PaletteName } from "./palettes";
import { hexToRgb, Rgb, sampleRamp } from "./color";
import { createRng, fromRange, Rng } from "./rng";

/** An axis-aligned rectangle in absolute canvas pixels. */
export type Part = { x: number; y: number; w: number; h: number };

export type BokehElement = {
  z: number;
  /** Blur radius in canvas px this element would ideally get. */
  blur: number;
  opacity: number;
  color: Rgb;
  parts: Part[];
};

/** One of five buckets, each blurred exactly once as a whole buffer. */
export type Band = {
  blur: number;
  elements: BokehElement[];
};

export type BackgroundBlob = {
  x: number;
  y: number;
  radius: number;
  lift: number;
};

export type Scene = {
  width: number;
  height: number;
  /** Multiplier taking reference-frame (4K) lengths to this frame. */
  scale: number;
  padding: number;
  background: Rgb;
  tones: Rgb[];
  /** Ordered most-defocused first. */
  bands: Band[];
  bloom: BokehElement[];
  blobs: BackgroundBlob[];
  /** Which corner the directional gradient lifts, as a unit position. */
  corner: { x: number; y: number };
  grainSeed: number;
};

type Cluster = {
  x: number;
  y: number;
  radius: number;
  weight: number;
  falloff: number;
  baseZ: number;
  depthSpread: number;
  pitch: number;
  gridStrength: number;
  jitter: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * Loosely pulls a coordinate toward a grid line, then jitters it again. The
 * result tends toward rows and columns without ever snapping, which is what
 * suggests circuitry without drawing any.
 */
const alignToGrid = (value: number, cluster: Cluster, rng: Rng) => {
  const snapped = Math.round(value / cluster.pitch) * cluster.pitch;
  const pulled = value + (snapped - value) * cluster.gridStrength;
  return pulled + rng.gauss() * cluster.jitter * cluster.pitch;
};

/**
 * Cluster centres, one per cell of a shuffled coarse grid. Placing them
 * uniformly at random leaves a dead third of the frame often enough to spoil
 * a batch; this keeps the scatter irregular but spreads it over the frame.
 */
const placeCentres = (rng: Rng, count: number, width: number, height: number) => {
  const columns = Math.max(1, Math.ceil(Math.sqrt((count * width) / height)));
  const rows = Math.max(1, Math.ceil(count / columns));

  const cells: number[] = [];
  for (let i = 0; i < columns * rows; i++) cells.push(i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const marginX = width * CONFIG.overscan;
  const marginY = height * CONFIG.overscan;
  const spanX = width + marginX * 2;
  const spanY = height + marginY * 2;
  const pull = CONFIG.cluster.stratification;

  return cells.slice(0, count).map((cell) => {
    const column = cell % columns;
    const row = Math.floor(cell / columns);
    const cellX = -marginX + ((column + rng.next()) / columns) * spanX;
    const cellY = -marginY + ((row + rng.next()) / rows) * spanY;
    const freeX = rng.range(-marginX, width + marginX);
    const freeY = rng.range(-marginY, height + marginY);
    return { x: freeX + (cellX - freeX) * pull, y: freeY + (cellY - freeY) * pull };
  });
};

const buildClusters = (rng: Rng, count: number, scene: { width: number; height: number; scale: number }, focusBand: number): Cluster[] => {
  const clusters: Cluster[] = [];
  const centres = placeCentres(rng, count, scene.width, scene.height);

  for (let i = 0; i < count; i++) {
    const nearFocus = rng.bool(CONFIG.cluster.focusAffinity);
    const baseZ = nearFocus
      ? clamp01(focusBand + rng.gauss() * CONFIG.cluster.focusAffinityJitter)
      : rng.next();

    clusters.push({
      x: centres[i].x,
      y: centres[i].y,
      radius:
        rng.biased(CONFIG.cluster.radius.min, CONFIG.cluster.radius.max, CONFIG.cluster.radiusBias) *
        scene.width,
      weight: fromRange(rng, [CONFIG.cluster.weight.min, CONFIG.cluster.weight.max]),
      falloff: fromRange(rng, [CONFIG.cluster.falloff.min, CONFIG.cluster.falloff.max]),
      baseZ,
      depthSpread: fromRange(rng, [CONFIG.cluster.depthSpread.min, CONFIG.cluster.depthSpread.max]),
      pitch: fromRange(rng, [CONFIG.grid.pitch.min, CONFIG.grid.pitch.max]) * scene.scale,
      gridStrength: fromRange(rng, [CONFIG.grid.strength.min, CONFIG.grid.strength.max]),
      jitter: fromRange(rng, [CONFIG.grid.jitter.min, CONFIG.grid.jitter.max]),
    });
  }

  return clusters;
};

const pickCluster = (rng: Rng, clusters: Cluster[]) => {
  let total = 0;
  for (const cluster of clusters) total += cluster.weight;
  let ticket = rng.next() * total;
  for (const cluster of clusters) {
    ticket -= cluster.weight;
    if (ticket <= 0) return cluster;
  }
  return clusters[clusters.length - 1];
};

/**
 * Builds the rectangles for one element. `size` already folds in the depth
 * scale, the frame scale and per-element jitter, so every length here is in
 * final canvas pixels.
 */
const buildParts = (rng: Rng, x: number, y: number, size: number): Part[] => {
  const shape = rng.weighted(CONFIG.shapes.weights);
  const S = CONFIG.shapes;

  if (shape === "shortDash") {
    const length = fromRange(rng, S.shortDash.length) * size;
    const thickness = length / fromRange(rng, S.shortDash.aspect);
    return [{ x: x - length / 2, y: y - thickness / 2, w: length, h: thickness }];
  }

  if (shape === "tallBar") {
    const height = fromRange(rng, S.tallBar.height) * size;
    const width = height / fromRange(rng, S.tallBar.aspect);
    return [{ x: x - width / 2, y: y - height / 2, w: width, h: height }];
  }

  if (shape === "squareBlock") {
    const side = fromRange(rng, S.squareBlock.side) * size;
    return [{ x: x - side / 2, y: y - side / 2, w: side, h: side }];
  }

  if (shape === "fineLine") {
    const length = fromRange(rng, S.fineLine.length) * size;
    const thickness = fromRange(rng, S.fineLine.thickness) * size;
    return [{ x: x - length / 2, y: y - thickness / 2, w: length, h: thickness }];
  }

  if (shape === "dashStack") {
    // Dashes of varying length sharing a left edge: this is what reads as a
    // row of data rather than as noise.
    const count = rng.int(S.dashStack.count[0], S.dashStack.count[1]);
    const length = fromRange(rng, S.dashStack.length) * size;
    const thickness = length / fromRange(rng, S.dashStack.aspect);
    const gap = thickness * fromRange(rng, S.dashStack.gap);
    const total = count * thickness + (count - 1) * gap;
    const left = x - length / 2;
    const top = y - total / 2;
    const parts: Part[] = [];
    for (let i = 0; i < count; i++) {
      parts.push({
        x: left,
        y: top + i * (thickness + gap),
        w: length * rng.range(0.55, 1),
        h: thickness,
      });
    }
    return parts;
  }

  // dashRow
  const count = rng.int(S.dashRow.count[0], S.dashRow.count[1]);
  const length = fromRange(rng, S.dashRow.length) * size;
  const thickness = length / fromRange(rng, S.dashRow.aspect);
  const gap = length * fromRange(rng, S.dashRow.gap);
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const dash = length * rng.range(0.6, 1);
    lengths.push(dash);
    total += dash + (i > 0 ? gap : 0);
  }
  let cursor = x - total / 2;
  const parts: Part[] = [];
  for (const dash of lengths) {
    parts.push({ x: cursor, y: y - thickness / 2, w: dash, h: thickness });
    cursor += dash + gap;
  }
  return parts;
};

/** Centre of a multi-part element, so a dash stack is looked up at its middle
 *  rather than at its top dash. */
const centroid = (parts: Part[]): [number, number] => {
  let x = 0;
  let y = 0;
  for (const part of parts) {
    x += part.x + part.w / 2;
    y += part.y + part.h / 2;
  }
  return [x / parts.length, y / parts.length];
};

/**
 * Bins alpha-weighted coverage into a coarse map and dims the marks standing
 * in over-inked cells. Blurred marks are discounted: their light is spread
 * over a wide area, so they contribute far less to local clipping than a
 * sharp mark of the same size.
 */
const moderateCrowding = (
  elements: BokehElement[],
  width: number,
  height: number,
  marginX: number,
  marginY: number,
  scale: number,
) => {
  const cell = CONFIG.crowding.cell * scale;
  const columns = Math.ceil((width + marginX * 2) / cell) + 1;
  const rows = Math.ceil((height + marginY * 2) / cell) + 1;
  const ink = new Float64Array(columns * rows);
  const cellArea = cell * cell;

  const cellOf = (x: number, y: number) => {
    const column = Math.floor((x + marginX) / cell);
    const row = Math.floor((y + marginY) / cell);
    if (column < 0 || row < 0 || column >= columns || row >= rows) return -1;
    return row * columns + column;
  };

  const localWeight = (blur: number) => cell / (cell + blur * 2);

  for (const element of elements) {
    const weight = localWeight(element.blur);
    for (const part of element.parts) {
      const index = cellOf(part.x + part.w / 2, part.y + part.h / 2);
      if (index < 0) continue;
      ink[index] += (part.w * part.h * element.opacity * weight) / cellArea;
    }
  }

  // A 3x3 box pass so the correction varies smoothly instead of showing the
  // bin edges as a visible grid.
  const smoothed = new Float64Array(ink.length);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let total = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = row + dy;
          const nx = column + dx;
          if (ny < 0 || nx < 0 || ny >= rows || nx >= columns) continue;
          total += ink[ny * columns + nx];
          count++;
        }
      }
      smoothed[row * columns + column] = total / count;
    }
  }

  for (const element of elements) {
    const index = cellOf(...centroid(element.parts));
    if (index < 0) continue;
    const local = smoothed[index];
    if (local <= CONFIG.crowding.ceiling) continue;
    element.opacity *= Math.max(CONFIG.crowding.floor, CONFIG.crowding.ceiling / local);
  }
};

export type SceneInput = {
  seed: string;
  palette: PaletteName;
  density: DensityName;
  focusBand: number;
  width: number;
  height: number;
};

export const buildScene = ({ seed, palette, density, focusBand, width, height }: SceneInput): Scene => {
  const rng = createRng(seed);
  const scale = width / REFERENCE_WIDTH;
  const densityConfig = CONFIG.density[density];
  const paletteConfig = PALETTES[palette];
  const tones = paletteConfig.tones.map(hexToRgb);
  const focus = clamp01(focusBand);

  // Normalising by the further of the two extremes means both ends of the
  // depth range reach full blur wherever the focus band happens to sit.
  const maxDistance = Math.max(focus, 1 - focus, 1e-6);
  const blurMax = CONFIG.depth.blurMax * scale;

  const clusters = buildClusters(
    rng,
    rng.int(densityConfig.clusters[0], densityConfig.clusters[1]),
    { width, height, scale },
    focus,
  );

  const marginX = width * CONFIG.overscan;
  const marginY = height * CONFIG.overscan;
  const elements: BokehElement[] = [];

  for (let i = 0; i < densityConfig.elements; i++) {
    const inCluster = rng.bool(CONFIG.cluster.memberFraction);

    let x: number;
    let y: number;
    let z: number;

    if (inCluster) {
      const cluster = pickCluster(rng, clusters);
      // Pushing the uniform radius through a power crowds members toward the
      // centre, so clusters have dense cores and thin edges.
      const radius = cluster.radius * Math.pow(rng.next(), cluster.falloff);
      const angle = rng.next() * Math.PI * 2;
      x = alignToGrid(cluster.x + Math.cos(angle) * radius, cluster, rng);
      y = alignToGrid(cluster.y + Math.sin(angle) * radius, cluster, rng);
      z = clamp01(cluster.baseZ + rng.gauss() * cluster.depthSpread);
    } else {
      x = rng.range(-marginX, width + marginX);
      y = rng.range(-marginY, height + marginY);
      z = rng.next();
    }

    const depthScale = CONFIG.depth.scale.far + (CONFIG.depth.scale.near - CONFIG.depth.scale.far) * z;
    const size = depthScale * scale * fromRange(rng, CONFIG.shapes.sizeJitter);

    const distance = Math.abs(z - focus) / maxDistance;
    const blur = blurMax * distance * distance;

    const nearFade =
      1 -
      CONFIG.depth.nearFade.amount * smoothstep(CONFIG.depth.nearFade.start, 1, z);
    // `distance * distance` is the same curve the blur uses, so the lift
    // tracks exactly how much a mark has been spread out.
    const blurLift = 1 + (CONFIG.depth.blurCompensation - 1) * distance * distance;
    // Deliberately not clamped to 1: additive compositing lets a mark be
    // "brighter than opaque", which is how a defocused highlight survives
    // being spread over a few hundred pixels. paintElements() realises
    // anything above 1 as repeated passes.
    const opacity =
      Math.max(
        0,
        (CONFIG.depth.opacity.far + (CONFIG.depth.opacity.near - CONFIG.depth.opacity.far) * z) *
          nearFade *
          blurLift,
      ) * densityConfig.opacityScale;

    const toneT = z * (1 - CONFIG.depth.defocusTonePull * distance * distance);
    const color = sampleRamp(tones, toneT + rng.gauss() * CONFIG.depth.toneJitter);

    elements.push({ z, blur, opacity, color, parts: buildParts(rng, x, y, size) });
  }

  moderateCrowding(elements, width, height, marginX, marginY, scale);

  // Bucket by blur rather than by raw depth: blur is what the buffer trick
  // quantises, and with additive compositing the draw order between buckets
  // does not change the result, so nothing is lost by regrouping.
  const edges = CONFIG.depth.bandEdges;
  const bands: Band[] = [];
  for (let b = 0; b < edges.length - 1; b++) {
    const members = elements.filter((element) => {
      const normalised = element.blur / Math.max(blurMax, 1e-6);
      return normalised >= edges[b] && normalised < edges[b + 1];
    });
    if (members.length === 0) continue;
    // The band's one blur radius is the mean of its members', which tracks the
    // actual distribution better than the bucket midpoint would.
    const meanBlur = members.reduce((sum, element) => sum + element.blur, 0) / members.length;
    bands.push({ blur: meanBlur, elements: members });
  }
  bands.sort((a, b) => b.blur - a.blur);

  const bloomCutoff = CONFIG.bloom.blurCutoff * scale;
  const bloom = elements.filter(
    (element) => element.blur <= bloomCutoff && element.opacity >= CONFIG.bloom.minOpacity,
  );

  const blobs: BackgroundBlob[] = [];
  const blobCount = rng.int(CONFIG.background.blobs.count[0], CONFIG.background.blobs.count[1]);
  for (let i = 0; i < blobCount; i++) {
    blobs.push({
      x: rng.range(-0.15, 1.15),
      y: rng.range(-0.15, 1.15),
      radius: fromRange(rng, CONFIG.background.blobs.radius),
      lift: fromRange(rng, CONFIG.background.blobs.lift),
    });
  }

  const corner = rng.pick([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ]);

  return {
    width,
    height,
    scale,
    padding: CONFIG.bufferPadding * scale,
    background: hexToRgb(paletteConfig.background),
    tones,
    bands,
    bloom,
    blobs,
    corner,
    grainSeed: Math.floor(random(`${seed}::grain`) * 1e6),
  };
};
