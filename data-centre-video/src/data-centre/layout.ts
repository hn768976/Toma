/**
 * Seeded facility layout.
 *
 * Everything structural — rack rows, heights, which racks are left open,
 * unit counts, LED placement and blink schedules, cable runs, props — is
 * generated once from a seeded PRNG and memoised. Nothing here depends on
 * the frame; the animation modules read this and animate it.
 */

import {
  GRID_HALF,
  RACK_D,
  RACK_H,
  RACK_PITCH,
  RACK_W,
  ROWS,
  ROW_PITCH,
  T,
  TILE,
  TRAY_Y,
} from "./constants";
import { chance, intRange, mulberry32, range, type Rng } from "./random";

export type Tile = {
  x: number;
  z: number;
  /** 0..1 tone mix between floorBase and floorAlt. */
  tone: number;
  delay: number;
  vent: boolean;
};

export type Led = {
  rack: number;
  /** Offset from the rack centre, in the rack's local front plane. */
  ox: number;
  oy: number;
  color: 0 | 1 | 2;
  /** 0 = steady, 1 = slow blink, 2 = fast blink, 3 = soft pulse. */
  mode: 0 | 1 | 2 | 3;
  period: number;
  phase: number;
  duty: number;
  delay: number;
};

export type Rack = {
  index: number;
  row: number;
  col: number;
  x: number;
  z: number;
  h: number;
  units: number;
  open: boolean;
  /** Build order position, used for every staggered reveal. */
  order: number;
  delay: number;
  detailDelay: number;
  ledDelay: number;
};

export type UnitLine = {
  rack: number;
  oy: number;
  delay: number;
};

export type Row = {
  index: number;
  z: number;
  x0: number;
  x1: number;
  order: number;
};

export type CableRun = {
  row: number;
  /** Local-space curve points: x along the row, y sags below 0, z lateral. */
  points: [number, number, number][];
  radius: number;
  color: string;
  originX: number;
  y: number;
  z: number;
  length: number;
  delay: number;
  pulse: boolean;
};

export type Drop = {
  from: [number, number, number];
  to: [number, number, number];
  bend: number;
  radius: number;
  color: string;
  delay: number;
};

export type Prop = {
  kind: "unit" | "wall" | "spool";
  x: number;
  z: number;
  rotY: number;
  w: number;
  h: number;
  d: number;
  delay: number;
};

export type Layout = {
  tiles: Tile[];
  racks: Rack[];
  unitLines: UnitLine[];
  leds: Led[];
  rows: Row[];
  cables: CableRun[];
  drops: Drop[];
  props: Prop[];
  hangers: { x: number; z: number; delay: number }[];
  ceilingStrips: { z: number; x0: number; x1: number; delay: number }[];
};

const buildTiles = (rng: Rng): Tile[] => {
  const tiles: Tile[] = [];
  // The wave runs from the front of the frame (large x + z) backwards.
  const maxSum = 2 * GRID_HALF * TILE;
  for (let i = -GRID_HALF; i <= GRID_HALF; i++) {
    for (let j = -GRID_HALF; j <= GRID_HALF; j++) {
      const x = i * TILE;
      const z = j * TILE;
      const front = (maxSum - (x + z)) / (2 * maxSum);
      tiles.push({
        x,
        z,
        tone: rng(),
        delay: T.floorStart + front * T.floorWave + rng() * 3,
        // Perforated vent tiles cluster in the aisles rather than under racks.
        vent: chance(rng, 0.035),
      });
    }
  }
  return tiles;
};

const buildRacks = (rng: Rng) => {
  const racks: Rack[] = [];
  const rows: Row[] = [];

  const rowCounts: number[] = [];
  for (let r = 0; r < ROWS; r++) rowCounts.push(intRange(rng, 7, 10));

  const z0 = -((ROWS - 1) * ROW_PITCH) / 2;

  // Front rows (nearest the camera, i.e. largest z) build first.
  const rowBuildOrder = [...Array(ROWS).keys()].sort((a, b) => b - a);

  for (let r = 0; r < ROWS; r++) {
    const count = rowCounts[r];
    const z = z0 + r * ROW_PITCH;
    const width = count * RACK_PITCH;
    const xOffset = range(rng, -0.4, 0.4);
    const x0 = -width / 2 + xOffset;
    rows.push({
      index: r,
      z,
      x0,
      x1: x0 + width,
      order: rowBuildOrder.indexOf(r),
    });
  }

  let order = 0;
  for (const r of rowBuildOrder) {
    const row = rows[r];
    const count = rowCounts[r];
    // Along the row, build from the near end (largest x) towards the far end.
    for (let c = count - 1; c >= 0; c--) {
      const x = row.x0 + (c + 0.5) * RACK_PITCH;
      const open = chance(rng, 0.09);
      racks.push({
        index: racks.length,
        row: r,
        col: c,
        x,
        z: row.z,
        h: RACK_H + range(rng, -0.05, 0.05),
        units: intRange(rng, 20, 40),
        open,
        order,
        delay:
          T.rackStart +
          row.order * T.rackRowStagger +
          (count - 1 - c) * T.rackColStagger +
          range(rng, 0, 2.5),
        detailDelay: 0,
        ledDelay: 0,
      });
      order++;
    }
  }

  racks.sort((a, b) => a.index - b.index);
  for (const rack of racks) {
    rack.detailDelay =
      T.unitStart + rack.order * T.unitRackStagger + rng() * 3;
    rack.ledDelay = T.ledStart + rack.order * T.ledRackStagger + rng() * 4;
  }

  return { racks, rows, rowCounts };
};

const buildRackDetail = (rng: Rng, racks: Rack[]) => {
  const unitLines: UnitLine[] = [];
  const leds: Led[] = [];

  for (const rack of racks) {
    if (rack.open) continue;
    const inner = rack.h - 0.14;
    const slot = inner / rack.units;
    for (let u = 1; u < rack.units; u++) {
      unitLines.push({
        rack: rack.index,
        oy: -inner / 2 + u * slot,
        delay: rack.detailDelay + u * T.unitLineStagger,
      });
    }

    let ledIndex = 0;
    for (let u = 0; u < rack.units; u++) {
      if (!chance(rng, 0.42)) continue;
      const cy = -inner / 2 + (u + 0.5) * slot;
      const pair = chance(rng, 0.35);
      const n = pair ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const roll = rng();
        const color: 0 | 1 | 2 = roll < 0.58 ? 0 : roll < 0.88 ? 1 : 2;
        const modeRoll = rng();
        const mode: 0 | 1 | 2 | 3 =
          modeRoll < 0.6 ? 0 : modeRoll < 0.78 ? 1 : modeRoll < 0.9 ? 2 : 3;
        leds.push({
          rack: rack.index,
          ox: -RACK_W / 2 + 0.085 + k * 0.05 + range(rng, -0.006, 0.006),
          oy: cy,
          color,
          mode,
          period:
            mode === 2
              ? range(rng, 4, 9)
              : mode === 3
                ? range(rng, 34, 70)
                : range(rng, 16, 44),
          phase: rng(),
          duty: range(rng, 0.3, 0.7),
          delay: rack.ledDelay + ledIndex * T.ledStagger + rng() * 2,
        });
        ledIndex++;
      }
    }
  }

  return { unitLines, leds };
};

/**
 * A cable that hangs between supports every `span` units. Sag is a simple
 * quadratic, which is visually indistinguishable from a catenary at this
 * scale, and the endpoints all sit at local y = 0 so the whole run can be
 * "settled" into its sag by animating scale.y of the parent group.
 */
const cablePoints = (
  length: number,
  span: number,
  sag: number,
  lateral: number,
  rng: Rng,
): [number, number, number][] => {
  const spans = Math.max(1, Math.round(length / span));
  const spanLen = length / spans;
  const per = 8;
  const points: [number, number, number][] = [];
  for (let s = 0; s < spans; s++) {
    const localSag = sag * range(rng, 0.82, 1.18);
    for (let k = 0; k < per; k++) {
      const t = k / per;
      points.push([
        s * spanLen + t * spanLen,
        -4 * localSag * t * (1 - t),
        lateral,
      ]);
    }
  }
  points.push([length, 0, lateral]);
  return points;
};

const buildCables = (rng: Rng, rows: Row[], theme: { greys: string[]; accents: string[] }) => {
  const cables: CableRun[] = [];
  for (const row of rows) {
    const length = row.x1 - row.x0 + 0.2;
    const count = intRange(rng, 4, 6);
    const delay = T.cableStart + row.order * T.cableRowStagger;
    for (let c = 0; c < count; c++) {
      const accent = chance(rng, 0.13);
      const lateral = -0.13 + (c / Math.max(count - 1, 1)) * 0.26;
      cables.push({
        row: row.index,
        points: cablePoints(length, range(rng, 1.35, 1.8), range(rng, 0.07, 0.15), lateral, rng),
        radius: range(rng, 0.012, 0.019),
        color: accent
          ? theme.accents[Math.floor(rng() * theme.accents.length)]
          : theme.greys[Math.floor(rng() * theme.greys.length)],
        originX: row.x0 - 0.1,
        y: TRAY_Y + 0.09,
        z: row.z + RACK_D / 2 - 0.18,
        length,
        delay: delay + c * 2.4,
        pulse: false,
      });
    }
  }
  // Two runs carry a travelling data pulse.
  if (cables.length > 2) {
    cables[Math.floor(rng() * cables.length)].pulse = true;
    cables[Math.floor(rng() * cables.length)].pulse = true;
  }
  return cables;
};

const buildDrops = (rng: Rng, racks: Rack[], theme: { greys: string[]; accents: string[] }) => {
  const drops: Drop[] = [];
  const closed = racks.filter((r) => !r.open);
  const chosen: Rack[] = [];
  for (let i = 0; i < closed.length; i++) {
    if (chance(rng, 0.2) && chosen.length < 10) chosen.push(closed[i]);
  }
  chosen.forEach((rack, i) => {
    const strands = intRange(rng, 2, 4);
    for (let s = 0; s < strands; s++) {
      drops.push({
        from: [
          rack.x + range(rng, -0.06, 0.06),
          TRAY_Y + 0.02,
          rack.z + RACK_D / 2 - 0.18 + s * 0.035,
        ],
        to: [
          rack.x + range(rng, -0.14, 0.14),
          rack.h - 0.02,
          rack.z + RACK_D / 2 - 0.06 + s * 0.02,
        ],
        bend: range(rng, 0.1, 0.24),
        radius: range(rng, 0.011, 0.016),
        color: chance(rng, 0.14)
          ? theme.accents[Math.floor(rng() * theme.accents.length)]
          : theme.greys[Math.floor(rng() * theme.greys.length)],
        delay: T.dropStart + i * T.dropStagger + s * 1.6,
      });
    }
  });
  return drops;
};

const buildProps = (rng: Rng, rows: Row[]): Prop[] => {
  const props: Prop[] = [];
  let n = 0;

  // A floor-standing unit at the end of a couple of rows.
  for (const row of [rows[1], rows[3]]) {
    props.push({
      kind: "unit",
      x: row.x1 + 0.55,
      z: row.z,
      rotY: 0,
      w: 0.78,
      h: range(rng, 1.75, 1.95),
      d: 0.86,
      delay: T.propStart + n++ * T.propStagger,
    });
  }

  // A low wall panel behind the back row.
  const back = rows[0];
  props.push({
    kind: "wall",
    x: back.x0 + (back.x1 - back.x0) * 0.42,
    z: back.z - 1.55,
    rotY: 0,
    w: 3.4,
    h: 1.5,
    d: 0.12,
    delay: T.propStart + n++ * T.propStagger,
  });

  // A cable spool parked at the end of an aisle.
  props.push({
    kind: "spool",
    x: rows[2].x0 - 0.95,
    z: rows[2].z + ROW_PITCH / 2,
    rotY: range(rng, -0.5, 0.5),
    w: 0.52,
    h: 0.52,
    d: 0.42,
    delay: T.propStart + n++ * T.propStagger,
  });

  return props;
};

const buildHangers = (rng: Rng, rows: Row[]) => {
  const hangers: { x: number; z: number; delay: number }[] = [];
  for (const row of rows) {
    const length = row.x1 - row.x0;
    const n = Math.max(2, Math.round(length / 1.9));
    for (let i = 0; i <= n; i++) {
      hangers.push({
        x: row.x0 + (i / n) * length,
        z: row.z + RACK_D / 2 - 0.18,
        delay: T.trayStart + row.order * T.trayRowStagger + i * 1.4 + rng(),
      });
    }
  }
  return hangers;
};

const buildCeiling = (rows: Row[]) => {
  const strips: { z: number; x0: number; x1: number; delay: number }[] = [];
  // Two short strips per aisle rather than one continuous run, so the
  // ceiling stays sparse and never draws the eye off the racks.
  const aisles = [
    rows[1].z + ROW_PITCH * 0.5,
    rows[2].z + ROW_PITCH * 0.5,
    rows[3].z + ROW_PITCH * 0.5,
  ];
  let n = 0;
  for (const z of aisles) {
    const span = rows[0].x1 - rows[0].x0;
    const mid = (rows[0].x0 + rows[0].x1) / 2;
    for (const side of [-1, 1]) {
      const centre = mid + side * span * 0.24;
      strips.push({
        z,
        x0: centre - span * 0.13,
        x1: centre + span * 0.13,
        delay: T.ceilingStart + n * T.ceilingStagger,
      });
      n++;
    }
  }
  return strips;
};

const cache = new Map<string, Layout>();

export const buildLayout = (
  seed: number,
  cableGreys: string[],
  cableAccents: string[],
): Layout => {
  const key = `${seed}|${cableGreys.join()}|${cableAccents.join()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const rng = mulberry32(seed);
  const tiles = buildTiles(rng);
  const { racks, rows } = buildRacks(rng);
  const { unitLines, leds } = buildRackDetail(rng, racks);
  const palette = { greys: cableGreys, accents: cableAccents };
  const cables = buildCables(rng, rows, palette);
  const drops = buildDrops(rng, racks, palette);
  const props = buildProps(rng, rows);
  const hangers = buildHangers(rng, rows);
  const ceilingStrips = buildCeiling(rows);

  const layout: Layout = {
    tiles,
    racks,
    unitLines,
    leds,
    rows,
    cables,
    drops,
    props,
    hangers,
    ceilingStrips,
  };
  cache.set(key, layout);
  return layout;
};
