// Data Block City — one periodic city tile, generated once at module level.
//
// The world is tiled by two lattice vectors (x, z): A = (LX, 0) across and
// B = (-SHIFT, LZ) along the glide; copy (m, k) of the tile sits at
// m*A + k*B. Over 600 frames the camera moves by exactly -B = (SHIFT, -LZ):
// one lattice step forward and slightly sideways, so frame 600 sees exactly
// the city that frame 0 sees.
import { mulberry32 } from "../lib/random";

export const LX = 36; // tile width (cells)
export const LZ = 26; // tile depth along the glide (cells)
export const SHIFT = 10; // sideways drift per loop (cells)
export const LOOP_FRAMES = 600;

export type Block = {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  h: number; // top height
  shade: number;
};

export type Tile = {
  x: number;
  z: number;
  y: number;
  size: number;
  color: number; // 0 cyan, 1 white, 2 pink, 3 red
  intensity: number;
  blinkCycles: number; // 0 = steady
  blinkPhase: number;
};

export type Line = {
  x: number;
  z: number;
  y: number;
  height: number;
  color: number;
  intensity: number;
  pulseCycles: number; // 0 = no pulse
  pulsePhase: number;
};

export type Spark = { x: number; y: number; z: number; color: number; size: number; phase: number; cycles: number };

const pick = <T,>(rnd: () => number, arr: T[]) => arr[Math.floor(rnd() * arr.length)];

const splitAxis = (rnd: () => number, length: number, sizes: number[]) => {
  const cuts = [0];
  let p = 0;
  while (p < length) {
    let w = pick(rnd, sizes);
    if (p + w > length - 2) w = length - p;
    p += w;
    cuts.push(p);
  }
  return cuts;
};

const build = () => {
  const rnd = mulberry32(0xc17ab1);
  const blocks: Block[] = [];
  const xs = splitAxis(rnd, LX, [3, 4, 4, 5, 6, 7, 8]);
  const zs = splitAxis(rnd, LZ, [2, 3, 3, 4, 5, 6]);
  const GAP = 0.12;
  for (let a = 0; a < xs.length - 1; a++) {
    for (let b = 0; b < zs.length - 1; b++) {
      const rects: [number, number, number, number][] = [];
      const x0 = xs[a];
      const x1 = xs[a + 1];
      const z0 = zs[b];
      const z1 = zs[b + 1];
      // sometimes split a plot in two along its longer side
      if (rnd() < 0.45 && Math.max(x1 - x0, z1 - z0) >= 4) {
        if (x1 - x0 >= z1 - z0) {
          const m = x0 + 1 + Math.floor(rnd() * (x1 - x0 - 1));
          rects.push([x0, m, z0, z1], [m, x1, z0, z1]);
        } else {
          const m = z0 + 1 + Math.floor(rnd() * (z1 - z0 - 1));
          rects.push([x0, x1, z0, m], [x0, x1, m, z1]);
        }
      } else rects.push([x0, x1, z0, z1]);
      for (const [rx0, rx1, rz0, rz1] of rects) {
        const r = rnd();
        // wells: a sunken dark plot (sparkles live down there)
        // a near-flat board: slight height steps, a few recessed dark cells
        const h = r < 0.12 ? -0.4 : pick(rnd, [0, 0, 0.06, 0.12, 0.18, 0.26, 0.36]);
        blocks.push({
          x0: rx0 + GAP,
          x1: rx1 - GAP,
          z0: rz0 + GAP,
          z1: rz1 - GAP,
          h,
          shade: 0.75 + rnd() * 0.5,
        });
      }
    }
  }

  const tiles: Tile[] = [];
  const lines: Line[] = [];
  for (const bl of blocks) {
    if (bl.h < -0.3) continue;
    for (let cx = Math.floor(bl.x0); cx < bl.x1; cx++) {
      for (let cz = Math.floor(bl.z0); cz < bl.z1; cz++) {
        if (cx + 0.5 < bl.x0 || cx + 0.5 > bl.x1 || cz + 0.5 < bl.z0 || cz + 0.5 > bl.z1) continue;
        if (rnd() > 0.34) {
          // no tile here: sometimes a bare light line rising from a small dot
          if (rnd() < 0.55) {
            lines.push({
              x: cx + 0.2 + rnd() * 0.6,
              z: cz + 0.2 + rnd() * 0.6,
              y: bl.h,
              height: 0.6 + Math.pow(rnd(), 1.4) * 1.5,
              color: rnd() < 0.85 ? 0 : 1,
              intensity: 0.35 + rnd() * 0.7,
              pulseCycles: rnd() < 0.4 ? 1 + Math.floor(rnd() * 5) : 0,
              pulsePhase: rnd(),
            });
          }
          continue;
        }
        const cr = rnd();
        // 0 cyan, 4 sky blue, 1 white, 2 pink, 3 red
        const color = cr < 0.46 ? 0 : cr < 0.83 ? 4 : cr < 0.93 ? 1 : cr < 0.975 ? 2 : 3;
        const blink = rnd() < 0.22;
        const t: Tile = {
          x: cx + 0.5,
          z: cz + 0.5,
          y: bl.h,
          size: 0.3 + rnd() * 0.2,
          color,
          intensity: 0.45 + Math.pow(rnd(), 1.5) * 1.6,
          blinkCycles: blink ? 3 + Math.floor(rnd() * 14) : 0,
          blinkPhase: rnd(),
        };
        tiles.push(t);
        if ((color <= 1 || color === 4) && rnd() < 0.75) {
          const pulse = rnd() < 0.45;
          lines.push({
            x: t.x + (rnd() - 0.5) * 0.25,
            z: t.z + (rnd() - 0.5) * 0.25,
            y: t.y,
            height: 0.6 + Math.pow(rnd(), 1.4) * 1.6,
            color: rnd() < 0.85 ? 0 : 1,
            intensity: 0.5 + rnd() * 0.9,
            pulseCycles: pulse ? 1 + Math.floor(rnd() * 5) : 0,
            pulsePhase: rnd(),
          });
        }
      }
    }
  }

  // tiny sparkles: on block tops, in the gaps and down in the wells
  const sparks: Spark[] = [];
  const topAt = (x: number, z: number) => {
    for (const b of blocks) if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return b.h;
    return -0.4; // in a gap
  };
  const wells = blocks.filter((b) => b.h < -0.3);
  for (let i = 0; i < 4200; i++) {
    // pinpoints mostly at panel corners / in the seams
    let x = Math.floor(rnd() * LX) + (rnd() < 0.7 ? 0 : rnd());
    let z = Math.floor(rnd() * LZ) + (rnd() < 0.7 ? 0 : rnd());
    if (wells.length && rnd() < 0.12) {
      const w = wells[Math.floor(rnd() * wells.length)];
      x = w.x0 + rnd() * (w.x1 - w.x0);
      z = w.z0 + rnd() * (w.z1 - w.z0);
    }
    const top = topAt(x, z);
    const cr = rnd();
    sparks.push({
      x,
      z,
      y: top + 0.02,
      color: cr < 0.5 ? 1 : cr < 0.9 ? 0 : 2,
      size: 0.012 + rnd() * 0.018,
      phase: rnd(),
      cycles: 2 + Math.floor(rnd() * 10),
    });
  }
  return { blocks, tiles, lines, sparks };
};

export const CITY = build();
