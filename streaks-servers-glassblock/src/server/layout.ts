import { LOOP } from "../common/constants";
import { mulberry32, pick, range } from "../common/rng";

// =============================================================================
// Rack layout. Everything is seeded at module level.
//
// The wall is a row of rack cabinets along x. The pattern repeats every
// PATTERN racks (spacing S = PATTERN * RACK_W); the camera drifts exactly
// DRIFT_PATTERNS * S over the 600-frame loop, so frame 600 == frame 0.
// =============================================================================
export const RACK_W = 0.6; // m, cabinet width including rails
export const RACK_H = 2.6; // m
export const RACK_BOTTOM = -1.35; // world y of rack bottom
export const U = 0.0445; // 1 rack unit
export const SLOTS = Math.floor(RACK_H / U); // 58
export const RAIL_W = 0.045;

/** Rack types in the repeating pattern, with their front-plane depth (z): three
 * fronts at different depths. */
export const PATTERN_Z = [0.0, 0.07, -0.05]; // A flush, B proud, C recessed
export const PATTERN = PATTERN_Z.length;
export const S = PATTERN * RACK_W; // pattern spacing
export const DRIFT_PATTERNS = 1; // camera moves exactly N * S per loop

export const RACK_FIRST = -24; // rack indices instanced (covers the view for the whole drift)
export const RACK_LAST = 4;

export enum UnitType {
  Blank = 0,
  Switch = 1,
  Server2U = 2,
  Cable2U = 3,
  Server1U = 4,
}

export type Slot = { type: UnitType; part: number; height: number; seed: number };

/** LED blink periods (frames) — every one divides 600. */
const PERIODS = [4, 5, 6, 8, 10, 12, 15, 20, 24, 25, 30, 40, 50, 60, 75, 100, 120, 150, 200, 300, 600];
for (const p of PERIODS) if (LOOP % p !== 0) throw new Error(`blink period ${p} does not divide ${LOOP}`);

export type Led = {
  // rack-local position (m), u from the rack's left edge, v from rack bottom
  u: number;
  v: number;
  radius: number; // m
  color: number; // 0 = LED colour (lime/amber), 1 = white-ish alt, 2 = blue
  period: number;
  phase: number;
  duty: number;
  power: number;
};

export type RackType = { slots: Slot[]; leds: Led[] };

const blink = (rng: () => number, kind: "steady" | "activity" | "slow") => {
  if (kind === "steady") return { period: 600, phase: 0, duty: 1 };
  if (kind === "activity") {
    const period = pick(rng, [4, 5, 6, 8, 10, 12]);
    return { period, phase: Math.floor(rng() * period), duty: range(rng, 0.3, 0.7) };
  }
  const period = pick(rng, [24, 30, 40, 50, 60, 75, 100, 120, 150, 200, 300]);
  return { period, phase: Math.floor(rng() * period), duty: range(rng, 0.2, 0.85) };
};

const buildRackType = (seed: number): RackType => {
  const rng = mulberry32(seed);
  const slots: Slot[] = [];
  const leds: Led[] = [];
  let k = 0;
  while (k < SLOTS) {
    const r = rng();
    let type: UnitType;
    if (r < 0.38) type = UnitType.Switch;
    else if (r < 0.58) type = UnitType.Server2U;
    else if (r < 0.72) type = UnitType.Cable2U;
    else if (r < 0.84) type = UnitType.Server1U;
    else type = UnitType.Blank;
    let height = type === UnitType.Server2U || type === UnitType.Cable2U ? 2 : 1;
    if (k + height > SLOTS) {
      type = UnitType.Blank;
      height = 1;
    }
    const s = rng();
    for (let p = 0; p < height; p++) slots.push({ type, part: p, height, seed: s });

    const v0 = k * U;
    const inner0 = RAIL_W + 0.012;
    if (type === UnitType.Switch) {
      // Two rows of 16 port LEDs — mostly lit, mixed blink behaviour.
      const cols = 16;
      const pitch = 0.0118;
      const u0 = inner0 + 0.115;
      for (let row = 0; row < 2; row++) {
        for (let c = 0; c < cols; c++) {
          const lit = rng();
          if (lit < 0.22) continue; // unlit port (drawn as a dim ring in the panel shader)
          const kind = lit < 0.55 ? "steady" : lit < 0.85 ? "activity" : "slow";
          leds.push({
            u: u0 + c * pitch + (c >= 8 ? 0.006 : 0),
            v: v0 + U * (row === 0 ? 0.62 : 0.3),
            radius: 0.0011,
            color: rng() < 0.05 ? 1 : 0,
            power: range(rng, 0.7, 1.2),
            ...blink(rng, kind),
          });
        }
      }
      // Status LED at the left.
      leds.push({
        u: inner0 + 0.03,
        v: v0 + U * 0.5,
        radius: 0.0018,
        color: rng() < 0.15 ? 1 : 2,
        power: 1.0,
        ...blink(rng, "steady"),
      });
    } else if (type === UnitType.Server2U) {
      const bays = 8;
      for (let b = 0; b < bays; b++) {
        if (rng() < 0.25) continue;
        leds.push({
          u: inner0 + 0.025 + b * 0.058,
          v: v0 + U * 0.35,
          radius: 0.0013,
          color: rng() < 0.85 ? 0 : 1,
          power: range(rng, 0.5, 1.0),
          ...blink(rng, rng() < 0.6 ? "activity" : "steady"),
        });
      }
      leds.push({
        u: RACK_W - RAIL_W - 0.04,
        v: v0 + U * 1.4,
        radius: 0.002,
        color: 2,
        power: 1.2,
        ...blink(rng, "steady"),
      });
    } else if (type === UnitType.Server1U) {
      for (let b = 0; b < 3; b++) {
        leds.push({
          u: inner0 + 0.32 + b * 0.016,
          v: v0 + U * 0.5,
          radius: 0.0014,
          color: b === 0 ? 2 : 0,
          power: range(rng, 0.6, 1.0),
          ...blink(rng, b === 2 ? "activity" : "slow"),
        });
      }
    }
    k += height;
  }
  return { slots, leds };
};

export const RACK_TYPES: RackType[] = PATTERN_Z.map((_, i) => buildRackType(0xa11ce + i * 7919));
