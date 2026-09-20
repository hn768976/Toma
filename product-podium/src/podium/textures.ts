/**
 * Procedural textures.
 *
 * Nothing here is a photographic plate: the foliage masks, the wood grain and
 * the plaster tooth are all generated from a seeded PRNG at module use time
 * and memoised, so they are identical on every frame and every render thread
 * and carry no third-party licence.
 */
import * as THREE from "three";
import { mulberry32, fbm3 } from "./random";

const makeCanvas = (size: number, height = size) => {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = height;
  return c;
};

const cache = new Map<string, THREE.Texture>();
const memo = <T extends THREE.Texture>(key: string, make: () => T): T => {
  const hit = cache.get(key);
  if (hit) return hit as T;
  const tex = make();
  cache.set(key, tex);
  return tex;
};

/* ------------------------------------------------------------------ */
/* Foliage                                                             */
/* ------------------------------------------------------------------ */

export type FoliageOptions = {
  seed: number;
  /** Number of branches radiating into frame. */
  branches: number;
  /** Leaves per branch. */
  leavesPerBranch: number;
  /** Leaf length as a fraction of the canvas. */
  leafScale: number;
  /** Branch segment length as a fraction of the canvas. */
  branchScale: number;
  /** Softening applied to the mask itself, on top of the shadow penumbra. */
  blur: number;
  /** 0 = sparse, 1 = dense canopy. */
  density: number;
  /**
   * How much the foliage clumps. A canopy is masses of leaves with open sky
   * between them; scattering leaves evenly over the whole mask gives a
   * uniform speckle that reads as camouflage rather than as a tree.
   */
  clumping: number;
  size?: number;
};

/**
 * The leaf mask used as the occluder's `alphaMap`.
 *
 * White where a leaf is, black elsewhere — three samples `alphaMap` from the
 * GREEN channel, not from alpha, so a black-on-transparent mask reads as
 * zero coverage everywhere and nothing casts a shadow at all.
 */
export const foliageAlpha = (o: FoliageOptions) => {
  const key = `foliage:${JSON.stringify(o)}`;
  return memo(key, () => {
    const size = o.size ?? 1024;
    const c = makeCanvas(size);
    const ctx = c.getContext("2d")!;
    const rnd = mulberry32(o.seed);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#fff";

    // Large-scale density field: where the canopy is thick and where the
    // sky shows through.
    const clump = (x: number, y: number) => {
      if (o.clumping <= 0) return 1;
      const n = fbm3((x / size) * 2.3, (y / size) * 2.3, 0.7, 3, o.seed + 5);
      const t = Math.min(1, Math.max(0, (n + 0.3) / 0.75));
      return 1 - o.clumping + o.clumping * t * t * (3 - 2 * t);
    };

    const leaf = (x: number, y: number, len: number, ang: number, w: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.45, -len * w, len, 0);
      ctx.quadraticCurveTo(len * 0.45, len * w, 0, 0);
      ctx.fill();
      ctx.restore();
    };

    // Branches enter from the top-left quadrant and sweep across, which is
    // how a canopy actually reads when the sun is high and off to one side.
    for (let b = 0; b < o.branches; b++) {
      const startX = (rnd() * 1.35 - 0.45) * size;
      const startY = (rnd() * 1.15 - 0.4) * size;
      let ang = 0.15 + rnd() * 0.9; // down-and-right
      let x = startX;
      let y = startY;
      const segLen = size * o.branchScale * (0.8 + rnd() * 0.5);
      const thick = size * o.branchScale * (0.08 + rnd() * 0.1);

      ctx.lineCap = "round";
      const segments = 8 + Math.floor(rnd() * 8);
      const pts: [number, number][] = [[x, y]];
      for (let s = 0; s < segments; s++) {
        ang += (rnd() - 0.5) * 0.35;
        x += Math.cos(ang) * segLen;
        y += Math.sin(ang) * segLen;
        pts.push([x, y]);
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.lineWidth = thick;
      ctx.stroke();

      for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i];
        const dir = Math.atan2(py - pts[i - 1][1], px - pts[i - 1][0]);
        const n = Math.round(o.leavesPerBranch * (0.6 + rnd() * 0.8));
        for (let l = 0; l < n; l++) {
          if (rnd() > o.density * clump(px, py)) continue;
          const side = l % 2 === 0 ? 1 : -1;
          const spread = (0.5 + rnd() * 0.7) * side;
          const len = size * o.leafScale * (0.65 + rnd() * 0.7);
          const jitterX = (rnd() - 0.5) * segLen * 1.1;
          const jitterY = (rnd() - 0.5) * segLen * 1.1;
          leaf(px + jitterX, py + jitterY, len, dir + spread, 0.3 + rnd() * 0.16);
        }
      }
    }

    // A handful of detached leaves so the canopy does not read as pure radial
    // branches, which is the tell of a generated pattern.
    const strays = Math.round(o.branches * 4 * o.density);
    for (let i = 0; i < strays; i++) {
      const sx = rnd() * size;
      const sy = rnd() * size;
      if (rnd() > clump(sx, sy)) continue;
      leaf(
        sx,
        sy,
        size * o.leafScale * (0.55 + rnd() * 0.7),
        rnd() * Math.PI * 2,
        0.28 + rnd() * 0.18,
      );
    }

    let out = c;
    if (o.blur > 0) {
      const b = makeCanvas(size);
      const bctx = b.getContext("2d")!;
      bctx.filter = `blur(${o.blur * size}px)`;
      bctx.drawImage(c, 0, 0);
      out = b;
    }

    const tex = new THREE.CanvasTexture(out);
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  });
};

/* ------------------------------------------------------------------ */
/* Wood                                                                */
/* ------------------------------------------------------------------ */

export type WoodOptions = {
  seed: number;
  /** Lightest grain colour, sRGB hex. */
  light: string;
  /** Darkest grain colour, sRGB hex. */
  dark: string;
  /** Growth rings across the face. Must be an integer so the map tiles. */
  rings: number;
  /** How much the rings wander. */
  turbulence: number;
  size?: number;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Base colour map plus a matching roughness map, so the grain also breaks up the sheen. */
export const woodMaps = (o: WoodOptions) => {
  const key = `wood:${JSON.stringify(o)}`;
  const colorKey = `${key}:color`;
  const roughKey = `${key}:rough`;
  const size = o.size ?? 1024;

  const build = () => {
    const c = makeCanvas(size);
    const r = makeCanvas(size);
    const ctx = c.getContext("2d")!;
    const rctx = r.getContext("2d")!;
    const img = ctx.createImageData(size, size);
    const rimg = rctx.createImageData(size, size);
    const lo = hexToRgb(o.dark);
    const hi = hexToRgb(o.light);

    // The rim of a disc wraps this texture right round, so every term has
    // to be periodic in u or there is a hard vertical seam where the UVs
    // meet. Noise is therefore sampled on a circle in u, and the ring count
    // is an integer, which makes abs(sin(PI * ring)) periodic too.
    const rings = Math.max(1, Math.round(o.rings));
    const ring3 = (radius: number, x: number, y: number, oct: number, seed: number) =>
      fbm3(
        radius * Math.cos(2 * Math.PI * x),
        radius * Math.sin(2 * Math.PI * x),
        y,
        oct,
        seed,
      );

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        // Cathedral figure: a slow wander in where the rings fall.
        const warp = ring3(3.1, u, v * 1.1, 4, o.seed) * o.turbulence;
        const fine = ring3(21, u, v * 7, 3, o.seed + 77) * 0.05;
        const ringValue = (u * rings + warp + fine);
        let t = Math.abs(Math.sin(Math.PI * ringValue));
        t = Math.pow(t, 0.5);
        // Long open pores running along the grain.
        const pore = Math.max(0, ring3(90, u, v * 3.5, 2, o.seed + 991)) * 0.55;
        const shade = Math.min(1, Math.max(0, t * 0.7 + 0.3 - pore * 0.45));
        const i = (y * size + x) * 4;
        img.data[i] = lo[0] + (hi[0] - lo[0]) * shade;
        img.data[i + 1] = lo[1] + (hi[1] - lo[1]) * shade;
        img.data[i + 2] = lo[2] + (hi[2] - lo[2]) * shade;
        img.data[i + 3] = 255;
        // Darker grain is more open, so slightly rougher.
        const rough = Math.round(255 * (0.78 - shade * 0.2 + pore * 0.2));
        rimg.data[i] = rough;
        rimg.data[i + 1] = rough;
        rimg.data[i + 2] = rough;
        rimg.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    rctx.putImageData(rimg, 0, 0);

    const color = new THREE.CanvasTexture(c);
    color.colorSpace = THREE.SRGBColorSpace;
    color.anisotropy = 8;
    color.wrapS = THREE.RepeatWrapping;
    color.wrapT = THREE.RepeatWrapping;
    const roughness = new THREE.CanvasTexture(r);
    roughness.colorSpace = THREE.NoColorSpace;
    roughness.anisotropy = 8;
    roughness.wrapS = THREE.RepeatWrapping;
    roughness.wrapT = THREE.RepeatWrapping;
    cache.set(colorKey, color);
    cache.set(roughKey, roughness);
  };

  if (!cache.has(colorKey)) build();
  return {
    color: cache.get(colorKey) as THREE.CanvasTexture,
    roughness: cache.get(roughKey) as THREE.CanvasTexture,
  };
};

/* ------------------------------------------------------------------ */
/* Plaster                                                             */
/* ------------------------------------------------------------------ */

/**
 * A faint tooth for the plaster. Returned as a normal map so it survives the
 * near-white exposure of look 3, where a colour-map variation would simply
 * clip away.
 */
export const plasterNormal = (seed: number, strength = 1, size = 512) =>
  memo(`plaster:${seed}:${strength}:${size}`, () => {
    const c = makeCanvas(size);
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(size, size);
    // Cross-faded copies, so the tooth tiles across a wall that repeats it
    // several times over without showing a grid of seams.
    const base = (x: number, y: number) =>
      fbm3(x * 26, y * 26, 0.3, 4, seed) * 0.5 +
      fbm3(x * 110, y * 110, 1.7, 2, seed + 41) * 0.5;
    const h = (px: number, py: number) => {
      const x = px / size;
      const y = py / size;
      const fx = x - Math.floor(x);
      const fy = y - Math.floor(y);
      return (
        base(fx, fy) * (1 - fx) * (1 - fy) +
        base(fx - 1, fy) * fx * (1 - fy) +
        base(fx, fy - 1) * (1 - fx) * fy +
        base(fx - 1, fy - 1) * fx * fy
      );
    };

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
        const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
        const nx = -dx;
        const ny = -dy;
        const nz = 1;
        const len = Math.hypot(nx, ny, nz);
        const i = (y * size + x) * 4;
        img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
        img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
        img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  });

/* ------------------------------------------------------------------ */
/* Gradients                                                           */
/* ------------------------------------------------------------------ */

/** A soft radial falloff, used for the light pools and the ring glow. */
export const radialFalloff = (power = 2, size = 256) =>
  memo(`radial:${power}:${size}`, () => {
    const c = makeCanvas(size);
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(size, size);
    const half = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.min(1, Math.hypot(x - half, y - half) / half);
        const a = Math.pow(1 - d, power);
        const i = (y * size + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
  });

/** A vertical two-stop gradient, for backdrops that fall off towards the top of frame. */
export const verticalGradient = (top: string, bottom: string, size = 256) =>
  memo(`vgrad:${top}:${bottom}:${size}`, () => {
    const c = makeCanvas(8, size);
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  });

/**
 * A radial ramp as an RGB map (not an alpha map), for emissive and
 * roughness slots. `inner` is the value at the centre, `outer` at the rim.
 */
export const radialRamp = (
  inner: number,
  outer: number,
  power = 2,
  size = 256,
) =>
  memo(`ramp:${inner}:${outer}:${power}:${size}`, () => {
    const c = makeCanvas(size);
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(size, size);
    const half = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.min(1, Math.hypot(x - half, y - half) / half);
        const v = Math.round(255 * (inner + (outer - inner) * Math.pow(d, power)));
        const i = (y * size + x) * 4;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
  });
