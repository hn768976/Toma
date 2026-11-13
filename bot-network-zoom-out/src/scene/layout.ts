import { mulberry32 } from "./util";

// World layout: tiles sit on a square lattice of 2x2 blocks (two tiles close
// together, then a wider gap) with some positions left empty, so that from
// far away the floor reads as the grid of dot clusters seen in the reference.

export const BLOCK = 9.0; // lattice period (world units)
export const PAIR = 3.6; // spacing of the two tiles inside a period
export const HALF_CELLS = 92; // lattice index range: -HALF..HALF (2 per period)
export const NEAR_RADIUS = 92; // tiles inside get detailed geometry

/** World coordinate of lattice index k: tiles come in pairs (2x2 blocks). */
export const latticePos = (k: number) =>
  BLOCK * Math.floor(k / 2) + PAIR * (((k % 2) + 2) % 2);

export type Tile = {
  x: number;
  z: number;
  r: number; // distance from origin
  near: boolean;
  icon: number;
  seed: number;
  // agent timeline in seconds (Infinity when the tile never gets an agent)
  spawn: number; // robot materialises next to the tile
  land: number; // robot lands on tile => tile done, check mark pops
  leave: number; // robot dematerialises
  sx: number; // spawn position
  sz: number;
  yaw: number;
};

export type Layout = {
  tiles: Tile[];
  robots: Tile[]; // subset with an agent
  links: [number, number][]; // tile index pairs
};

export const buildLayout = (): Layout => {
  const rand = mulberry32(20241);
  const tiles: Tile[] = [];
  const index = new Map<number, number>();
  const key = (i: number, j: number) => (i + 500) * 1000 + (j + 500);

  // Hand-placed hero column in front of the opening camera.
  const forced = new Map<number, "idle" | "agent" | "empty">([
    [key(0, 1), "idle"],
    [key(0, 0), "agent"],
    [key(0, -1), "idle"],
    [key(0, -2), "idle"],
    [key(0, -3), "idle"],
    [key(1, 0), "empty"],
    [key(1, 1), "empty"],
    [key(-1, 1), "empty"],
    [key(-1, 0), "idle"],
    [key(1, -1), "idle"],
  ]);

  for (let j = -HALF_CELLS; j <= HALF_CELLS; j++) {
    for (let i = -HALF_CELLS; i <= HALF_CELLS; i++) {
      const f = forced.get(key(i, j));
      let occupied = rand() < 0.78;
      let agent = rand() < 0.5;
      if (f === "empty") occupied = false;
      if (f === "idle") {
        occupied = true;
        agent = false;
      }
      if (f === "agent") {
        occupied = true;
        agent = true;
      }
      const r1 = rand();
      const r2 = rand();
      const r3 = rand();
      const r4 = rand();
      const r5 = rand();
      if (!occupied) continue;
      const x = latticePos(i);
      const z = latticePos(j);
      const r = Math.hypot(x, z);
      let spawn = Infinity;
      let land = Infinity;
      let leave = Infinity;
      let sx = x;
      let sz = z;
      if (agent) {
        // Agents near the opening shot are already at work; the rest keep
        // arriving so that the far field is still busy during the pull-back.
        const near = r < 30;
        spawn = near ? -5 + r1 * 8.5 : -4 + r1 * 14.0;
        if (f === "agent") spawn = -6;
        const dwell = 0.75 + r2 * 0.5;
        land = spawn + dwell + 0.8;
        leave = Math.min(land + 2.8 + r3 * 4.5, 12.4 + r3 * 1.6);
        if (f === "agent") leave = 9;
        // spawn point: on the open floor next to the tile
        const ang = Math.floor(r4 * 8) * (Math.PI / 4);
        sx = x + Math.cos(ang) * 2.3;
        sz = z + Math.sin(ang) * 2.3;
      }
      index.set(key(i, j), tiles.length);
      tiles.push({
        x,
        z,
        r,
        near: r < NEAR_RADIUS,
        icon: Math.floor(r5 * 8) % 8,
        seed: r4 * 0.5 + r5 * 0.5,
        spawn,
        land,
        leave,
        sx,
        sz,
        yaw: (r2 - 0.5) * 0.7,
      });
    }
  }

  // Irregular network: every tile links to a couple of random neighbours.
  const links: [number, number][] = [];
  const seen = new Set<number>();
  const lr = mulberry32(977);
  for (let j = -HALF_CELLS; j <= HALF_CELLS; j++) {
    for (let i = -HALF_CELLS; i <= HALF_CELLS; i++) {
      const a = index.get(key(i, j));
      if (a === undefined) continue;
      if (tiles[a].r > 240) continue;
      let made = 0;
      for (let attempt = 0; attempt < 9 && made < 2; attempt++) {
        const di = Math.floor(lr() * 5) - 2;
        const dj = Math.floor(lr() * 5) - 2;
        if (di === 0 && dj === 0) continue;
        const b = index.get(key(i + di, j + dj));
        if (b === undefined) continue;
        const k = Math.min(a, b) * 100000 + Math.max(a, b);
        if (seen.has(k)) continue;
        seen.add(k);
        links.push([a, b]);
        made++;
      }
    }
  }
  // hero links so the opening shot has the long converging lines
  const hero = (i1: number, j1: number, i2: number, j2: number) => {
    const a = index.get(key(i1, j1));
    const b = index.get(key(i2, j2));
    if (a !== undefined && b !== undefined) links.push([a, b]);
  };
  hero(0, 1, 0, 0);
  hero(0, 0, 0, -1);
  hero(0, -1, 0, -2);

  return { tiles, robots: tiles.filter((t) => isFinite(t.spawn)), links };
};
