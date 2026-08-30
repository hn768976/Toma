import { random } from "remotion";
import { Vector3 } from "three";
import {
  BLOCK_COUNT,
  TIERS,
  codeTextureIndex,
} from "./textures";
import {
  DURATION_IN_FRAMES,
  FOV,
  HEIGHT,
  WIDTH,
  type CameraMode,
  type StreamAxis,
  type VariantConfig,
} from "./variants";

export const TAU = Math.PI * 2;
export const ASPECT = WIDTH / HEIGHT;
const HALF_FOV_TAN = Math.tan((FOV * Math.PI) / 180 / 2);

/**
 * Loop phase in [0, 1). Everything animated is derived from this, so frame 0
 * and frame 270 evaluate to bit-identical values and the loop closes exactly.
 */
export const loopPhase = (frame: number) =>
  (((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES) /
  DURATION_IN_FRAMES;

/**
 * Canonical positive travel vector per axis. `flowDirection` flips it:
 *   horizontal + 1  -> right to left
 *   vertical   + -1 -> straight down
 */
const CANONICAL: Record<StreamAxis, [number, number, number]> = {
  horizontal: [-1, 0, 0],
  vertical: [0, 1, 0],
};

export const travelVector = (
  axis: StreamAxis,
  flowDirection: 1 | -1,
): Vector3 => {
  const [x, y, z] = CANONICAL[axis];
  return new Vector3(x * flowDirection, y * flowDirection, z * flowDirection);
};

/** Half of the visible extent at distance `dist`, along travel and cross. */
export const halfExtents = (axis: StreamAxis, dist: number) => {
  const halfH = HALF_FOV_TAN * dist;
  const halfW = halfH * ASPECT;
  return axis === "horizontal"
    ? { travel: halfW, cross: halfH }
    : { travel: halfH, cross: halfW };
};

/**
 * Depth bands. Each band is keyed by its lap count — the number of complete
 * screen traversals the element makes in 270 frames. Because the lap count is
 * a whole number the element is back at its start on frame 270.
 *
 * Lap count and depth are deliberately tied together: a high lap count means a
 * fast screen crossing, which is what a near element must do. That is where
 * the parallax comes from.
 */
type Band = {
  laps: number;
  near: number;
  far: number;
  weight: number;
  tier: number;
  /** Extra size for the focal bands, so the legible blocks read clearly. */
  size: number;
  /**
   * Shutter multiplier for the band. Tuned so the streak is roughly this
   * many times the element's own width:
   *   near bands  ~3-6x  (unreadable)
   *   mid bands   ~1.5x  (partly legible)
   *   focal band  ~0.5x  (crisp)
   */
  shutter: number;
};

const BANDS: readonly Band[] = [
  { laps: 2, near: 84, far: 132, weight: 0.17, tier: 0, size: 1, shutter: 0.45 },
  { laps: 3, near: 62, far: 96, weight: 0.18, tier: 0, size: 1.1, shutter: 0.45 },
  { laps: 5, near: 42, far: 70, weight: 0.2, tier: 1, size: 1.4, shutter: 0.45 },
  { laps: 8, near: 27, far: 48, weight: 0.2, tier: 1, size: 1.15, shutter: 1 },
  { laps: 13, near: 15, far: 30, weight: 0.1, tier: 2, size: 1, shutter: 1.45 },
  { laps: 21, near: 8, far: 18, weight: 0.055, tier: 2, size: 1, shutter: 1.6 },
  { laps: 30, near: 4.5, far: 10, weight: 0.03, tier: 2, size: 1, shutter: 1.85 },
];

const CUMULATIVE = (() => {
  const out: number[] = [];
  let acc = 0;
  for (const b of BANDS) {
    acc += b.weight;
    out.push(acc);
  }
  return out.map((v) => v / acc);
})();

const bandFor = (seed: string): Band => {
  const r = random(seed);
  for (let i = 0; i < CUMULATIVE.length; i++) {
    if (r <= CUMULATIVE[i]) return BANDS[i];
  }
  return BANDS[BANDS.length - 1];
};

export type PlaneElement = {
  readonly id: number;
  /** Whole traversals in 270 frames. */
  readonly laps: number;
  readonly bandNear: number;
  readonly bandFar: number;
  /** Representative distance, used for size, blur pass count and tier. */
  readonly midDist: number;
  readonly scale: number;
  readonly textureIndex: number;
  /** Motion blur copies for this element. */
  readonly passes: number;
  /**
   * Per-element shutter multiplier. Near elements are smeared far past
   * legibility; the focal band is left almost intact.
   */
  readonly shutterScale: number;
  readonly brightness: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Nearest elements get the most motion blur copies. More than a conventional
 * blur uses, because the streaks have to be long rather than merely soft.
 */
const passesFor = (dist: number) => {
  const d01 = clamp((dist - 4.5) / (132 - 4.5), 0, 1);
  return clamp(Math.round(11 - 9 * Math.pow(d01, 0.45)), 2, 10);
};

export const buildPlaneElements = (
  config: VariantConfig,
): readonly PlaneElement[] => {
  const out: PlaneElement[] = [];
  for (let i = 0; i < config.planeCount; i++) {
    const seed = `plane-${config.streamAxis}-${i}`;
    const band = bandFor(`${seed}-band`);
    const midDist = (band.near + band.far) / 2;
    const scale =
      lerp(
        config.planeScale.min,
        config.planeScale.max,
        random(`${seed}-scale`),
      ) * band.size;
    const blockIndex = Math.floor(random(`${seed}-block`) * BLOCK_COUNT);
    const tier = clamp(band.tier, 0, TIERS.length - 1);
    out.push({
      id: i,
      laps: band.laps,
      bandNear: band.near,
      bandFar: band.far,
      midDist,
      scale,
      textureIndex: codeTextureIndex(tier, blockIndex),
      passes: passesFor(midDist),
      shutterScale: band.shutter,
      // A gentle falloff with depth, lifted where the depth of field is in
      // focus so the legible band is also the brightest thing in frame.
      brightness:
        lerp(1.0, 0.45, clamp((midDist - 4.5) / 128, 0, 1)) *
        (1 +
          1.1 *
            Math.exp(
              -Math.pow(
                (midDist - config.focusWorldDistance) /
                  (config.focusWorldRange * 1.3),
                2,
              ),
            )),
    });
  }
  return out;
};

export type CoinElement = {
  readonly id: number;
  readonly laps: number;
  readonly bandNear: number;
  readonly bandFar: number;
  readonly midDist: number;
  readonly scale: number;
  readonly markIndex: number;
  readonly passes: number;
  /** Whole tumble revolutions per loop, on two axes. */
  readonly spinA: number;
  readonly spinB: number;
  readonly phaseA: number;
  readonly phaseB: number;
};

export const buildCoinElements = (
  config: VariantConfig,
): readonly CoinElement[] => {
  const out: CoinElement[] = [];
  for (let i = 0; i < config.coinCount; i++) {
    const seed = `coin-${i}`;
    const band = bandFor(`${seed}-band`);
    const midDist = (band.near + band.far) / 2;
    out.push({
      id: i,
      laps: band.laps,
      bandNear: band.near,
      bandFar: band.far,
      midDist,
      scale: lerp(0.75, 1.5, random(`${seed}-scale`)),
      markIndex: Math.floor(random(`${seed}-mark`) * 3),
      passes: clamp(passesFor(midDist), 2, 3),
      // Whole numbers of revolutions per loop keep the tumble seamless.
      spinA: 2 + Math.floor(random(`${seed}-spinA`) * 5),
      spinB: 1 + Math.floor(random(`${seed}-spinB`) * 4),
      phaseA: random(`${seed}-phA`),
      phaseB: random(`${seed}-phB`),
    });
  }
  return out;
};

export type LapState = {
  /** 0..1 progress across the current traversal. */
  readonly p: number;
  /** Which traversal we are in, 0..laps-1. */
  readonly lapIndex: number;
  /** Frames spent in the current traversal. */
  readonly framesIntoLap: number;
  /** Frames one traversal takes. */
  readonly lapFrames: number;
};

/**
 * `phase` staggers elements that share a lap count so they do not travel in
 * lockstep. Because the lap count is a whole number, adding a constant phase
 * to `t` leaves both `lapIndex` and `p` unchanged between t = 0 and t = 1, so
 * the loop still closes exactly.
 */
export const lapState = (
  laps: number,
  t: number,
  phase: number,
): LapState => {
  const tt = (t + phase) * laps;
  const lapIndex = Math.floor(tt) % laps;
  const p = tt - Math.floor(tt);
  const lapFrames = DURATION_IN_FRAMES / laps;
  return { p, lapIndex, framesIntoLap: p * lapFrames, lapFrames };
};

export type Placement = {
  /** Position in the field's local frame. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Distance from the camera, positive. */
  readonly dist: number;
  /** World units the element moves along the travel axis per frame. */
  readonly speedPerFrame: number;
};

/**
 * Where an element sits on a given frame.
 *
 * The travel coordinate is normalised: an element sweeps from one side of its
 * own visible span to the other over exactly one lap, so screen speed is set
 * by the lap count (and therefore by depth). The cross coordinate is held in
 * world units for the length of a lap, so an approaching element drifts
 * outward from the centre of frame — the cue that reads as forward travel.
 *
 * Both the depth and the cross position are re-seeded at every lap boundary,
 * which is exactly the moment the element is off frame.
 */
export const placeElement = (
  seed: string,
  laps: number,
  bandNear: number,
  bandFar: number,
  halfSizeAlongTravel: number,
  axis: StreamAxis,
  flowDirection: 1 | -1,
  cameraMode: CameraMode,
  dollyRate: number,
  t: number,
): Placement => {
  const lap = lapState(laps, t, random(`${seed}-phase`));
  const lapSeed = `${seed}-lap-${lap.lapIndex}`;

  const startDist = lerp(bandNear, bandFar, random(`${lapSeed}-z`));
  // A forward camera is expressed as the field closing on the lens.
  const approach = cameraMode === "forward" ? dollyRate * lap.framesIntoLap : 0;
  const dist = Math.max(2.2, startDist - approach);

  const extentNow = halfExtents(axis, dist);
  const extentStart = halfExtents(axis, startDist);

  const travelHalfSpan = extentNow.travel * 1.45 + halfSizeAlongTravel;
  // Signed component of the travel vector along the stream axis.
  const dir =
    CANONICAL[axis][axis === "horizontal" ? 0 : 1] * flowDirection;
  const along = dir * (2 * lap.p - 1) * travelHalfSpan;

  const crossUnit = random(`${lapSeed}-cross`) * 2 - 1;
  const crossWorld = crossUnit * extentStart.cross * 1.7;

  const speedPerFrame = (2 * travelHalfSpan * laps) / DURATION_IN_FRAMES;

  return {
    x: axis === "horizontal" ? along : crossWorld,
    y: axis === "horizontal" ? crossWorld : along,
    z: -dist,
    dist,
    speedPerFrame,
  };
};

/** World size of a plane at a given distance. Partial depth compensation
 * keeps far blocks from collapsing to sub-pixel noise while still giving the
 * near field a clear size advantage. */
export const planeWorldSize = (
  dist: number,
  scale: number,
  aspect: number,
  base: number,
) => {
  const width = Math.pow(dist, 0.6) * base * scale;
  return { width, height: width / aspect };
};
