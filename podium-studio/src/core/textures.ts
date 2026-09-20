import * as THREE from 'three/webgpu';

const make2d = (size: number) => {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return {c, ctx: c.getContext('2d') as CanvasRenderingContext2D};
};

const finish = (c: HTMLCanvasElement, srgb = false) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
};

/**
 * Soft radial falloff, used for contact shadows and floor light pools.
 * `stops` are [offset, alpha] pairs so each caller can shape its own curve.
 */
export const radialAlpha = (
  stops: [number, number][],
  size = 512,
  color = '255,255,255',
) => {
  const {c, ctx} = make2d(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, a] of stops) g.addColorStop(o, `rgba(${color},${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finish(c);
};

/**
 * Vertical wall gradient with a centred hot-spot - this is what sells the
 * "seamless dark studio cyclorama" look in refs A, B, D and E.
 */
export const wallGradient = (
  opts: {
    top: string;
    mid: string;
    bottom: string;
    hotspot?: string;
    /** Hot-spot centre, as a fraction down the texture. */
    hotY?: number;
    /** Hot-spot radius, as a fraction of texture size. */
    hotR?: number;
  },
  size = 1024,
) => {
  const {c, ctx} = make2d(size);
  const v = ctx.createLinearGradient(0, 0, 0, size);
  v.addColorStop(0, opts.top);
  v.addColorStop(0.55, opts.mid);
  v.addColorStop(1, opts.bottom);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, size, size);

  if (opts.hotspot) {
    const cy = (opts.hotY ?? 0.42) * size;
    const r = ctx.createRadialGradient(size / 2, cy, 0, size / 2, cy, size * (opts.hotR ?? 0.62));
    r.addColorStop(0, opts.hotspot);
    r.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }
  return finish(c, true);
};

/**
 * Fine monochrome dither, drawn additively.
 *
 * Smooth dark gradients are exactly what h264 bands worst, and these plates are
 * almost nothing but smooth dark gradients - so a little noise genuinely helps.
 * It has to be cheap though: the naive "mid-grey plane at low opacity" approach
 * lifts pure black by ~18 levels, which destroys the deep blacks the references
 * depend on (refs C and E sit at 0-4).
 *
 * So the texture is generated directly in output levels, spanning [0, 2*levels]
 * with a mean of `levels`, tagged sRGB so a texel value survives the pipeline
 * unchanged, and composited additively. Black lifts by `levels`, and the dither
 * amplitude is +/- `levels` - a 1:1 ratio instead of ~5:1.
 */
export const grain = (levels = 3, size = 256, seed = 1) => {
  const {c, ctx} = make2d(size);
  const img = ctx.createImageData(size, size);
  let a = seed >>> 0;
  const span = levels * 2;
  for (let i = 0; i < size * size; i++) {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const v = Math.round((((t ^ (t >>> 14)) >>> 0) / 4294967296) * span);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = finish(c, true);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // Nearest keeps the noise as noise; mipmapping would average it to flat grey.
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
};

/**
 * Soft light shaft for V4's visible spotlight.
 *
 * A real cone mesh reads as a hard-edged solid once you make it bright enough
 * to see - the far wall of the cone shows through the near one and produces a
 * distinct arch. A camera-facing billboard with a gaussian falloff across its
 * width behaves like the scattering it is standing in for.
 */
export const beamTexture = (size = 512) => {
  const {c, ctx} = make2d(size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    const fy = y / (size - 1);
    const halfWidth = 0.035 + fy * 0.40;
    // Bright at the emitter, gone well before the floor.
    const vertical = Math.pow(1 - fy, 1.5) * (1 - Math.pow(fy, 6));
    for (let x = 0; x < size; x++) {
      const d = Math.abs(x / (size - 1) - 0.5) / halfWidth;
      const across = Math.exp(-(d * d) * 2.0);
      const v = Math.max(0, Math.min(1, across * vertical));
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(v * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c);
};

/** Concentric rings on the podium top face (ref E's machined-groove detail). */
export const concentricRings = (
  count: number,
  color: string,
  lineWidth = 1.2,
  /** Base tone. This texture is used as a `map`, which MULTIPLIES the material
   *  colour - a black base would render the whole face black. */
  base = '#9aa3ad',
  size = 1024,
) => {
  const {c, ctx} = make2d(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  for (let i = 1; i <= count; i++) {
    ctx.globalAlpha = 0.25 + 0.55 * (i / count);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, (size / 2) * (i / (count + 0.6)), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return finish(c, true);
};

/**
 * A single soft-edged ring in alpha, for the radiating floor rings in V5.
 * `pos` is the ring centre as a fraction of the radius, `width` its thickness.
 */
export const ringAlpha = (pos: number, width: number, size = 512) => {
  const {c, ctx} = make2d(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const a = Math.max(0, pos - width);
  const b = Math.min(1, pos + width);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  if (a > 0) g.addColorStop(a, 'rgba(255,255,255,0)');
  g.addColorStop(Math.min(0.999, pos), 'rgba(255,255,255,1)');
  if (b < 1) g.addColorStop(b, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finish(c);
};
