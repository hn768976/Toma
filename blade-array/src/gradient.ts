import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  NoColorSpace,
  RGBAFormat,
  RepeatWrapping,
  UnsignedByteType,
} from "three";
import type { GradientStop } from "./types";

const LUT_SIZE = 2048;

/**
 * The environment is a coloured gradient wrapped around a light cylinder. The
 * blades are a neutral near-white; every colour on screen is this gradient seen
 * in them. Scrolling it horizontally is what moves the colour.
 *
 * It is baked to a 2-row lookup table:
 *   row 0 (v = 0.25) - blurred for the glossy reflection
 *   row 1 (v = 0.75) - blurred much wider, standing in for diffuse irradiance
 *
 * Roughness is pre-baked as that blur, so the fragment shader needs one texture
 * fetch per term instead of a multi-tap loop. Values are stored gamma-encoded
 * and normalised by the gradient's peak, which keeps ~12 bits of precision in
 * the dark end - this matters because look 3 is mostly dark ramp.
 */

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Sample the stop list at u (wrapping), returning premultiplied linear RGB. */
function sampleStops(stops: GradientStop[], u: number): [number, number, number] {
  const n = stops.length;
  const x = ((u % 1) + 1) % 1;
  let lo = n - 1;
  for (let k = 0; k < n; k++) {
    if (stops[k].p <= x) lo = k;
    else break;
  }
  const hi = (lo + 1) % n;
  const a = stops[lo];
  const b = stops[hi];
  let span = b.p - a.p;
  if (span <= 0) span += 1;
  let d = x - a.p;
  if (d < 0) d += 1;
  const t = smoothstep(span === 0 ? 0 : Math.min(1, Math.max(0, d / span)));
  const i = a.i + (b.i - a.i) * t;
  return [
    (a.c[0] + (b.c[0] - a.c[0]) * t) * i,
    (a.c[1] + (b.c[1] - a.c[1]) * t) * i,
    (a.c[2] + (b.c[2] - a.c[2]) * t) * i,
  ];
}

/** Circular Gaussian blur of one RGB ramp. sigma is in LUT widths. */
function blurRing(src: Float32Array, sigma: number): Float32Array {
  const n = src.length / 3;
  const s = Math.max(sigma * n, 0.5);
  const radius = Math.min(Math.ceil(s * 3), Math.floor(n / 2));
  const kernel: number[] = [];
  let sum = 0;
  for (let k = -radius; k <= radius; k++) {
    const w = Math.exp((-k * k) / (2 * s * s));
    kernel.push(w);
    sum += w;
  }
  const out = new Float32Array(src.length);
  for (let i = 0; i < n; i++) {
    let r = 0, g = 0, b = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = (((i + k) % n) + n) % n;
      const w = kernel[k + radius];
      r += src[j * 3] * w;
      g += src[j * 3 + 1] * w;
      b += src[j * 3 + 2] * w;
    }
    out[i * 3] = r / sum;
    out[i * 3 + 1] = g / sum;
    out[i * 3 + 2] = b / sum;
  }
  return out;
}

export type EnvLut = { texture: DataTexture; max: number };

const cache = new Map<string, EnvLut>();

export function buildEnvLut(
  key: string,
  stops: GradientStop[],
  specBlur: number,
  diffBlur: number,
): EnvLut {
  const hit = cache.get(key);
  if (hit) return hit;

  const raw = new Float32Array(LUT_SIZE * 3);
  for (let i = 0; i < LUT_SIZE; i++) {
    const [r, g, b] = sampleStops(stops, (i + 0.5) / LUT_SIZE);
    raw[i * 3] = r;
    raw[i * 3 + 1] = g;
    raw[i * 3 + 2] = b;
  }

  const rows = [blurRing(raw, specBlur), blurRing(raw, diffBlur)];
  let max = 1e-6;
  for (const row of rows) for (let i = 0; i < row.length; i++) max = Math.max(max, row[i]);

  const data = new Uint8Array(LUT_SIZE * 2 * 4);
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < LUT_SIZE; i++) {
      const o = (r * LUT_SIZE + i) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const v = Math.max(0, rows[r][i * 3 + ch]) / max;
        data[o + ch] = Math.round(255 * Math.sqrt(v));
      }
      data[o + 3] = 255;
    }
  }

  const texture = new DataTexture(data, LUT_SIZE, 2, RGBAFormat, UnsignedByteType);
  texture.colorSpace = NoColorSpace; // decoded in the shader
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const lut: EnvLut = { texture, max };
  cache.set(key, lut);
  return lut;
}
