import { mulberry32 } from "../lib/random";
import { ATLAS_CELLS } from "./puffTexture";

// A cumulus deck built from "mounds", each made of several overlapping puffs.
// The deck tiles along z so the camera can fly forward indefinitely.
export const TILE_LENGTH = 198;
const X_EXTENT = 170;
const SPACING = 11.0;

export type Puff = {
  x: number;
  y: number;
  z: number;
  size: number;
  cell: number;
  flip: number;
  shade: number;
  wraps: boolean;
};

const addMound = (
  puffs: Puff[],
  rand: () => number,
  mx: number,
  mz: number,
  radius: number,
  height: number,
  baseY: number,
  wraps: boolean,
) => {
  const cell = () => Math.floor(rand() * ATLAS_CELLS * ATLAS_CELLS);
  const flip = () => (rand() < 0.5 ? -1 : 1);
  // wide, dark base that closes gaps between mounds
  for (let i = 0; i < 2; i++) {
    const a = rand() * Math.PI * 2;
    puffs.push({
      x: mx + Math.cos(a) * radius * 0.5,
      y: baseY - 0.2 * radius,
      z: mz + Math.sin(a) * radius * 0.5,
      size: radius * (1.2 + 0.3 * rand()),
      cell: cell(),
      flip: flip(),
      shade: 0.22 + 0.1 * rand(),
      wraps,
    });
  }
  // core
  puffs.push({
    x: mx,
    y: baseY + height * 0.35,
    z: mz,
    size: radius * (0.95 + 0.15 * rand()),
    cell: cell(),
    flip: flip(),
    shade: 0.75 + 0.1 * rand(),
    wraps,
  });
  const count = 5 + Math.floor(radius * 2.2 + rand() * 3);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const rr = radius * 0.75 * Math.sqrt(rand());
    const hy = height * Math.pow(rand(), 0.8) * (1 - 0.45 * (rr / radius));
    puffs.push({
      x: mx + Math.cos(a) * rr,
      y: baseY + hy,
      z: mz + Math.sin(a) * rr,
      size: radius * (0.42 + 0.3 * rand()) * (1 - 0.25 * (hy / height)),
      cell: cell(),
      flip: flip(),
      shade: (0.45 + 0.65 * (hy / height)) * (0.85 + 0.3 * rand()),
      wraps,
    });
  }
};

export type HeroCloud = {
  x: number;
  z: number;
  radius: number;
  height: number;
  baseY: number;
  // moonlit clouds close to the moon's direction read brighter
  brightness?: number;
};

export const buildCloudField = (seed: number, heroes: HeroCloud[]) => {
  const rand = mulberry32(seed);
  const puffs: Puff[] = [];
  for (let z = 0; z < TILE_LENGTH; z += SPACING) {
    for (let x = -X_EXTENT; x < X_EXTENT; x += SPACING) {
      const radius = 4.4 + 3.6 * rand();
      addMound(
        puffs,
        rand,
        x + (rand() - 0.5) * SPACING * 0.9,
        z + (rand() - 0.5) * SPACING * 0.9,
        radius,
        radius * (0.7 + 0.45 * rand()),
        (rand() - 0.5) * 0.6,
        true,
      );
    }
  }
  for (const h of heroes) {
    const start = puffs.length;
    addMound(puffs, rand, h.x, h.z, h.radius, h.height, h.baseY, false);
    for (let i = start; i < puffs.length; i++) {
      puffs[i].shade *= h.brightness ?? 1;
    }
  }
  return puffs;
};
