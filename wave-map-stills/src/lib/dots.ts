import type {LandMask} from "./map";
import {sampleMask} from "./map";
import type {Rng} from "./rng";

export const KIND_OCEAN = 0;
export const KIND_LAND = 1;
export const KIND_COAST = 2;
export const KIND_ACCENT = 3;

export type DotSet = {
  n: number;
  cols: number;
  rows: number;
  pitch: number;
  /** Base field-space positions, before the wave displaces them. */
  bx: Float32Array;
  by: Float32Array;
  /** Final screen positions, written by the wave pass. */
  sx: Float32Array;
  sy: Float32Array;
  /** Normalised wave height at the dot, -1..1. */
  hn: Float32Array;
  land: Uint8Array;
  /** Per-dot class; the accent pass promotes a few dots to KIND_ACCENT. */
  kind: Uint8Array;
  /** Class before the accent pass ran, so the pass is idempotent. */
  baseKind: Uint8Array;
  /** Seeded per-dot brightness: most mid, a scattering bright, some dim. */
  bright: Float32Array;
  /** Final brightness after wave and light, written by later passes. */
  lit: Float32Array;
  /** Dot edge length in px. */
  size: Float32Array;
  /** Which of the four blur buffers the dot belongs to. */
  bracket: Uint8Array;
};

/**
 * The base dot set: a regular grid over the padded field, each node tagged as
 * ocean or land, with land nodes touching fewer than 6 land neighbours marked
 * as coastal. Built once per composition.
 */
export const buildBaseDots = (
  mask: LandMask,
  pitch: number,
  rng: Rng,
): DotSet => {
  const cols = Math.max(2, Math.floor(mask.w / pitch) + 1);
  const rows = Math.max(2, Math.floor(mask.h / pitch) + 1);
  const n = cols * rows;

  const bx = new Float32Array(n);
  const by = new Float32Array(n);
  const land = new Uint8Array(n);

  for (let r = 0; r < rows; r++) {
    const y = mask.y0 + r * pitch;
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const x = mask.x0 + c * pitch;
      bx[i] = x;
      by[i] = y;
      land[i] = sampleMask(mask, x, y);
    }
  }

  const baseKind = new Uint8Array(n);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!land[i]) {
        baseKind[i] = KIND_OCEAN;
        continue;
      }
      let neighbours = 0;
      for (let dr = -1; dr <= 1; dr++) {
        const rr = r + dr;
        if (rr < 0 || rr >= rows) {
          continue;
        }
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) {
            continue;
          }
          const cc = c + dc;
          if (cc < 0 || cc >= cols) {
            continue;
          }
          neighbours += land[rr * cols + cc];
        }
      }
      // Coastal dots — the ones that make the continents legible.
      baseKind[i] = neighbours < 6 ? KIND_COAST : KIND_LAND;
    }
  }

  const bright = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = rng("dot", i, "b");
    // Most dots sit mid; a scattering run bright, a tail run dim.
    let v: number;
    if (u > 0.94) {
      v = 1.0 + (u - 0.94) * 5.5;
    } else if (u < 0.16) {
      v = 0.42 + u * 1.9;
    } else {
      v = 0.72 + (u - 0.16) * 0.42;
    }
    bright[i] = v;
  }

  return {
    n,
    cols,
    rows,
    pitch,
    bx,
    by,
    sx: new Float32Array(n),
    sy: new Float32Array(n),
    hn: new Float32Array(n),
    land,
    kind: new Uint8Array(baseKind),
    baseKind,
    bright,
    lit: new Float32Array(n),
    size: new Float32Array(n),
    bracket: new Uint8Array(n),
  };
};
