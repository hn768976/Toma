/**
 * Deterministic lattice noise (no PRNG state): integer hash -> value noise.
 * Used to bake normal / roughness textures once at load.
 */
const hash2 = (x: number, y: number, seed: number) => {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Value noise in [0,1], optionally periodic in x and/or y (period in lattice cells). */
export const vnoise = (x: number, y: number, seed: number, px = 0, py = 0) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const wx = (i: number) => (px ? ((i % px) + px) % px : i);
  const wy = (i: number) => (py ? ((i % py) + py) % py : i);
  const a = hash2(wx(xi), wy(yi), seed);
  const b = hash2(wx(xi + 1), wy(yi), seed);
  const c = hash2(wx(xi), wy(yi + 1), seed);
  const d = hash2(wx(xi + 1), wy(yi + 1), seed);
  const u = smooth(xf);
  const v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

export const fbm = (x: number, y: number, seed: number, octaves = 4, px = 0, py = 0) => {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * vnoise(x * f, y * f, seed + o * 101, px * f, py * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
};

/** Worley F1 distance (cell size 1), periodic if p > 0. */
export const worley = (x: number, y: number, seed: number, p = 0) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let best = 9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i;
      const cy = yi + j;
      const hx = p ? ((cx % p) + p) % p : cx;
      const hy = p ? ((cy % p) + p) % p : cy;
      const fx = cx + hash2(hx, hy, seed);
      const fy = cy + hash2(hx, hy, seed + 7);
      const d = (fx - x) * (fx - x) + (fy - y) * (fy - y);
      if (d < best) best = d;
    }
  }
  return Math.sqrt(best);
};

/**
 * Height field -> tangent-space normal map (RGBA8). `strength` scales slopes.
 * Heights are sampled with wrap-around so periodic fields stay seamless.
 */
export const heightToNormal = (h: Float32Array, w: number, hgt: number, strength: number) => {
  const out = new Uint8Array(w * hgt * 4);
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w;
      const xr = (x + 1) % w;
      const yd = (y - 1 + hgt) % hgt;
      const yu = (y + 1) % hgt;
      const dx = (h[y * w + xr] - h[y * w + xl]) * 0.5 * strength;
      const dy = (h[yu * w + x] - h[yd * w + x]) * 0.5 * strength;
      // Texture row 0 is v=0 (flipY=false on DataTexture), +y = +v.
      let nx = -dx;
      let ny = -dy;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const o = (y * w + x) * 4;
      out[o] = Math.round((nx * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[o + 3] = 255;
    }
  }
  return out;
};

/**
 * fbm with every octave rotated (~37 deg steps) and offset: hides the
 * axis-aligned lattice that plain value noise shows in its finer octaves.
 */
export const fbmRot = (x: number, y: number, seed: number, octaves = 4) => {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let px = x;
  let py = y;
  const c = Math.cos(0.65);
  const s = Math.sin(0.65);
  for (let o = 0; o < octaves; o++) {
    sum += amp * vnoise(px, py, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    const nx = (c * px - s * py) * 2 + 17.3;
    const ny = (s * px + c * py) * 2 + 9.1;
    px = nx;
    py = ny;
  }
  return sum / norm;
};
