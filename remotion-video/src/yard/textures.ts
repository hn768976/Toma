import * as THREE from "three";

/**
 * Procedural textures for the container surfaces.
 *
 * Everything here is generated in-page and deterministically seeded, so a
 * render needs no image assets and every frame of a composition -- and every
 * re-render of it -- gets byte-identical maps. Remotion renders frames in
 * parallel across several browser instances, so anything non-deterministic
 * would show up as flicker between frames.
 */

/** Small, fast, deterministic PRNG (mulberry32). */
export const makeRandom = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * Value noise on a periodic lattice, so the resulting texture tiles cleanly.
 * `freq` is the lattice size in cells across the full 0..1 domain.
 */
const makeLattice = (freq: number, rand: () => number) => {
  const v = new Float32Array(freq * freq);
  for (let i = 0; i < v.length; i++) v[i] = rand();
  return v;
};

const sampleLattice = (
  lattice: Float32Array,
  freq: number,
  x: number,
  y: number,
) => {
  const fx = x * freq;
  const fy = y * freq;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smoothstep(fx - x0);
  const ty = smoothstep(fy - y0);
  const i0 = ((x0 % freq) + freq) % freq;
  const j0 = ((y0 % freq) + freq) % freq;
  const i1 = (i0 + 1) % freq;
  const j1 = (j0 + 1) % freq;
  const a = lattice[j0 * freq + i0];
  const b = lattice[j0 * freq + i1];
  const c = lattice[j1 * freq + i0];
  const d = lattice[j1 * freq + i1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
};

/** Anisotropic fbm: separate frequencies per axis, for vertical streaking. */
const fbm = (
  layers: { lattice: Float32Array; freq: number; amp: number }[],
  x: number,
  y: number,
  scaleY = 1,
) => {
  let sum = 0;
  let norm = 0;
  for (const l of layers) {
    sum += sampleLattice(l.lattice, l.freq, x, y * scaleY) * l.amp;
    norm += l.amp;
  }
  return sum / norm;
};

let weatherCache: THREE.DataTexture | null = null;

/**
 * Four weathering channels packed into one RGBA map, all tiling:
 *   R broad blotches  -> where rust and paint loss take hold
 *   G fine grain      -> surface tooth, breaks up flat paint
 *   B vertical streak -> run-off staining below seams and fittings
 *   A patch mask      -> hard-edged repaint panels in a different shade
 */
export const getWeatherTexture = (): THREE.DataTexture => {
  if (weatherCache) return weatherCache;

  const SIZE = 512;
  const rand = makeRandom(0x5eed01);

  const broad = [8, 16, 32].map((freq, i) => ({
    lattice: makeLattice(freq, rand),
    freq,
    amp: 1 / (i + 1),
  }));
  const fine = [32, 64, 128].map((freq, i) => ({
    lattice: makeLattice(freq, rand),
    freq,
    amp: 1 / (i + 1),
  }));
  const streak = [64, 128].map((freq, i) => ({
    lattice: makeLattice(freq, rand),
    freq,
    amp: 1 / (i + 1),
  }));
  const patch = [4, 8].map((freq, i) => ({
    lattice: makeLattice(freq, rand),
    freq,
    amp: 1 / (i + 1),
  }));

  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const o = (y * SIZE + x) * 4;

      data[o] = Math.round(255 * fbm(broad, u, v));
      data[o + 1] = Math.round(255 * fbm(fine, u, v));
      // Streaks: high frequency across, very low frequency down, which is what
      // makes run-off read as vertical rather than as blobs.
      data[o + 2] = Math.round(255 * fbm(streak, u, v, 0.08));
      // Patches get a hard edge so repaints look like panels, not stains.
      const p = fbm(patch, u, v);
      data[o + 3] = Math.round(255 * smoothstep(Math.min(1, Math.max(0, (p - 0.52) * 9))));
    }
  }

  const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  weatherCache = tex;
  return tex;
};

let corrugationCache: THREE.DataTexture | null = null;

/**
 * Corrugation as a tangent-space normal map, one period across U.
 *
 * Used only by the distant LODs, whose geometry is a plain box. Up close the
 * mesh carries real modelled corrugation and this map would double it.
 */
export const getCorrugationNormal = (): THREE.DataTexture => {
  if (corrugationCache) return corrugationCache;

  const W = 256;
  const H = 8;
  const data = new Uint8Array(W * H * 4);

  // Trapezoidal profile: flat crest, ramp, flat trough, ramp back. Measured
  // off the supplied mesh, the ramps are steep -- close to 45 degrees.
  const encode = (nx: number) => {
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx));
    return [
      Math.round((nx * 0.5 + 0.5) * 255),
      128,
      Math.round((nz * 0.5 + 0.5) * 255),
    ];
  };

  for (let x = 0; x < W; x++) {
    const t = x / W;
    let nx = 0;
    if (t >= 0.34 && t < 0.5) nx = 0.7;
    else if (t >= 0.84 || t < 0.005) nx = -0.7;
    const [r, g, b] = encode(nx);
    for (let y = 0; y < H; y++) {
      const o = (y * W + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  corrugationCache = tex;
  return tex;
};

/**
 * Invented carrier marks. These are deliberately not real shipping lines --
 * the brief called for generic carriers, and the reference footage shows
 * markings that read as lettering without being legible branding.
 */
export const CARRIERS = [
  "NORVAK", "SEALINQ", "TRANSMAR", "PACIFIQ",
  "ORIENTEX", "BLUEKEEL", "ATLANVIA", "MERIDAN",
  "KESTRAL", "VANTEC", "HARBORA", "NORDSEA",
  "CALMARE", "TIDEWAY", "LONGHAUL", "SUNVELA",
] as const;

export const STENCIL_COLS = 4;
export const STENCIL_ROWS = 4;

let stencilCache: THREE.DataTexture | null = null;

/**
 * Atlas of carrier marks, one tile per carrier, drawn white on black so the
 * red channel can be used directly as a paint mask in the shader.
 */
export const getStencilAtlas = (): THREE.DataTexture => {
  if (stencilCache) return stencilCache;

  const TILE = 256;
  const canvas = document.createElement("canvas");
  canvas.width = TILE * STENCIL_COLS;
  canvas.height = TILE * STENCIL_ROWS;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const rand = makeRandom(0xc0ffee);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  CARRIERS.forEach((carrier, i) => {
    const cx = (i % STENCIL_COLS) * TILE;
    const cy = Math.floor(i / STENCIL_COLS) * TILE;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    // Carrier name, horizontally condensed the way real container marks are.
    ctx.save();
    ctx.translate(TILE / 2, TILE * 0.36);
    ctx.scale(0.72, 1);
    ctx.font = `bold ${Math.round(TILE * 0.2)}px "Liberation Sans", "DejaVu Sans", sans-serif`;
    ctx.fillText(carrier, 0, 0);
    ctx.restore();

    // BIC-style owner code + serial underneath, smaller and looser.
    const owner =
      carrier.slice(0, 3).toUpperCase() +
      letters[Math.floor(rand() * 26)] +
      "U";
    const serial = String(Math.floor(rand() * 900000) + 100000);
    ctx.save();
    ctx.translate(TILE / 2, TILE * 0.6);
    ctx.scale(0.8, 1);
    ctx.font = `${Math.round(TILE * 0.105)}px "Liberation Sans", "DejaVu Sans", sans-serif`;
    ctx.fillText(`${owner} ${serial} ${Math.floor(rand() * 9)}`, 0, 0);
    ctx.restore();

    // Size/type code, bottom right, as on a real door.
    ctx.textAlign = "right";
    ctx.font = `${Math.round(TILE * 0.085)}px "Liberation Sans", "DejaVu Sans", sans-serif`;
    ctx.fillText("22G1", TILE * 0.9, TILE * 0.78);

    ctx.restore();
  });

  // Read the canvas back into a DataTexture rather than handing over a
  // CanvasTexture. DataTexture is the upload path the weather map already
  // proves out here, and it carries flipY = false by default, which matches
  // the shader's top-down V -- a flipped atlas would stand every mark on its
  // head. The atlas is also then a plain typed array, so it is trivially
  // inspectable.
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const tex = new THREE.DataTexture(
    new Uint8Array(pixels.data.buffer.slice(0)),
    canvas.width,
    canvas.height,
    THREE.RGBAFormat,
  );
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  // No mipmaps. The mark is sparse white lettering on black, so a mip average
  // collapses it to near-black long before the text stops being readable --
  // which silently erases every carrier mark in the yard. Marks are only ever
  // drawn on the near LODs, where aliasing is not an issue.
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  stencilAtlasCanvas = canvas;
  stencilCache = tex;
  return tex;
};

/** The atlas as drawn, for the diagnostics overlay. */
export let stencilAtlasCanvas: HTMLCanvasElement | null = null;
