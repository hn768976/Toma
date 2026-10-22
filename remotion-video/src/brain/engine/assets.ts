import { staticFile } from "remotion";

// Loads the baked brain (public/brain/*, produced by scripts/bake/bake.py)
// once per browser tab. The promise is cached at module level and consumed
// with React's `use()` inside the ThreeCanvas, whose Suspense boundary holds a
// delayRender() until it resolves.

type ArrayInfo = { offset: number; dtype: string; shape: number[] };
type FileInfo = { bytes: number; arrays: Record<string, ArrayInfo>; [k: string]: unknown };

export type Manifest = {
  qpos: number;
  files: Record<string, FileInfo>;
  [k: string]: unknown;
};

export type BrainAssets = {
  manifest: Manifest;
  mesh: {
    position: Float32Array;
    normal: Float32Array;
    curv: Float32Array;
    ao: Float32Array;
    depth: Float32Array;
    label: Uint8Array;
    index: Uint32Array;
  };
  inner: {
    position: Float32Array;
    normal: Float32Array;
    label: Uint8Array;
    index: Uint32Array;
  };
  points: {
    // Dequantised once here: positions/normals as Float32 for direct upload.
    position: Float32Array;
    normal: Float32Array;
    curv: Float32Array; // ~[-1.27, 1.27], >0 on gyral crests
    ao: Float32Array; // 0..1
    label: Uint8Array; // 0 cerebrum, 1 cerebellum, 2 brainstem, 3 ventricles, 4 callosum, 5 thalamus, 6 hippocampus
    cortex: number; // first `cortex` points are on the cortex, the rest on inner structures
    inner: number;
  };
  fibres: {
    position: Float32Array; // count * per * 3
    kind: Uint8Array; // 0 surface, 1 commissural, 2 association, 3 projection
    label: Uint8Array;
    length: Float32Array;
    count: number;
    per: number;
  };
  thoughts: { position: Float32Array; count: Uint8Array; lines: number; per: number };
  arcs: {
    main: Float32Array;
    forks: Float32Array;
    forkAt: Float32Array;
    centre: Float32Array;
    count: number;
    mainPts: number;
    forkPts: number;
    forkCount: number;
  };
  blueNoise: Uint8Array; // 64x64 ranks
};

export const LABEL = {
  cerebrum: 0,
  cerebellum: 1,
  brainstem: 2,
  ventricles: 3,
  callosum: 4,
  thalamus: 5,
  hippocampus: 6,
} as const;

const view = (buf: ArrayBuffer, a: ArrayInfo) => {
  const n = a.shape.reduce((x, y) => x * y, 1);
  switch (a.dtype) {
    case "float32":
      return new Float32Array(buf, a.offset, n);
    case "uint32":
      return new Uint32Array(buf, a.offset, n);
    case "int16":
      return new Int16Array(buf, a.offset, n);
    case "int8":
      return new Int8Array(buf, a.offset, n);
    case "uint8":
      return new Uint8Array(buf, a.offset, n);
    default:
      throw new Error(`Unsupported dtype ${a.dtype}`);
  }
};

const fetchBin = async (name: string) => {
  const res = await fetch(staticFile(`brain/${name}`));
  if (!res.ok) throw new Error(`Could not load brain/${name}: ${res.status}`);
  return res.arrayBuffer();
};

const deq16 = (src: Int16Array, scale: number) => {
  const out = new Float32Array(src.length);
  const k = 1 / scale;
  for (let i = 0; i < src.length; i++) out[i] = src[i] * k;
  return out;
};

const deq8 = (src: Int8Array, scale: number) => {
  const out = new Float32Array(src.length);
  const k = 1 / scale;
  for (let i = 0; i < src.length; i++) out[i] = src[i] * k;
  return out;
};

const load = async (): Promise<BrainAssets> => {
  const manifest = (await (await fetch(staticFile("brain/brain.json"))).json()) as Manifest;
  const [meshB, innerB, pointsB, fibresB, thoughtsB, arcsB, noiseB] = await Promise.all([
    fetchBin("mesh.bin"),
    fetchBin("inner.bin"),
    fetchBin("points.bin"),
    fetchBin("fibres.bin"),
    fetchBin("thoughts.bin"),
    fetchBin("arcs.bin"),
    fetchBin("bluenoise.bin"),
  ]);
  const F = manifest.files;
  const A = (f: string, buf: ArrayBuffer, k: string) => view(buf, F[f].arrays[k]);
  const q = manifest.qpos;
  return {
    manifest,
    mesh: {
      position: A("mesh", meshB, "position") as Float32Array,
      normal: A("mesh", meshB, "normal") as Float32Array,
      curv: A("mesh", meshB, "curv") as Float32Array,
      ao: A("mesh", meshB, "ao") as Float32Array,
      depth: A("mesh", meshB, "depth") as Float32Array,
      label: A("mesh", meshB, "label") as Uint8Array,
      index: A("mesh", meshB, "index") as Uint32Array,
    },
    inner: {
      position: A("inner", innerB, "position") as Float32Array,
      normal: A("inner", innerB, "normal") as Float32Array,
      label: A("inner", innerB, "label") as Uint8Array,
      index: A("inner", innerB, "index") as Uint32Array,
    },
    points: {
      position: deq16(A("points", pointsB, "position") as Int16Array, q),
      normal: deq8(A("points", pointsB, "normal") as Int8Array, 127),
      curv: deq8(A("points", pointsB, "curv") as Int8Array, 100),
      ao: Float32Array.from(A("points", pointsB, "ao") as Uint8Array, (v) => v / 255),
      label: A("points", pointsB, "label") as Uint8Array,
      cortex: F.points.cortex as number,
      inner: F.points.inner as number,
    },
    fibres: {
      position: deq16(A("fibres", fibresB, "position") as Int16Array, q),
      kind: A("fibres", fibresB, "kind") as Uint8Array,
      label: A("fibres", fibresB, "label") as Uint8Array,
      length: A("fibres", fibresB, "length") as Float32Array,
      count: F.fibres.count as number,
      per: F.fibres.pointsPerFibre as number,
    },
    thoughts: {
      position: A("thoughts", thoughtsB, "position") as Float32Array,
      count: A("thoughts", thoughtsB, "count") as Uint8Array,
      lines: F.thoughts.count as number,
      per: F.thoughts.pointsPerLine as number,
    },
    arcs: {
      main: A("arcs", arcsB, "main") as Float32Array,
      forks: A("arcs", arcsB, "forks") as Float32Array,
      forkAt: A("arcs", arcsB, "forkAt") as Float32Array,
      centre: A("arcs", arcsB, "centre") as Float32Array,
      count: F.arcs.count as number,
      mainPts: F.arcs.mainPts as number,
      forkPts: F.arcs.forkPts as number,
      forkCount: F.arcs.forks as number,
    },
    blueNoise: new Uint8Array(noiseB),
  };
};

let cached: Promise<BrainAssets> | null = null;
export const loadBrainAssets = () => {
  if (!cached) cached = load();
  return cached;
};
