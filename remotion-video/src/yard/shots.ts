import * as THREE from "three";
import type { VersionId } from "./constants";
import { buildBlock, type Placement } from "./layout";
import type { ShotSpec } from "./scene";

/**
 * The six shots, one per supplied reference clip.
 *
 * Each is described by a yard layout, a camera path over normalised progress,
 * and a lighting rig. Distances, lens angles and stack heights were read off
 * the reference frames: the aim is a shot that could stand in for the original
 * plate, not a new interpretation of it.
 *
 * No shot uses a cloud layer. Where sky is in frame it is a clean vertical
 * gradient, per the brief.
 */

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Near-constant velocity with the ends eased off.
 *
 * A linear ramp starts and stops dead, which reads as a machine; a full
 * ease-in-out sags in the middle and reads as an animation. Stock plates are
 * shot on a dolly or slider that is already moving, so only the outer eighth
 * of the move is shaped.
 */
const glide = (t: number, ease = 0.12) => {
  if (t < ease) {
    const k = t / ease;
    return (ease * k * k) / 2 / (1 - ease);
  }
  if (t > 1 - ease) {
    const k = (1 - t) / ease;
    return 1 - (ease * k * k) / 2 / (1 - ease);
  }
  return (t - ease / 2) / (1 - ease);
};

/** Slow sinusoidal wander, for handheld-free but not perfectly rigid moves. */
const drift = (t: number, cycles: number, phase = 0) =>
  Math.sin(t * Math.PI * 2 * cycles + phase);

// ---------------------------------------------------------------------------
// v1 -- low lateral dolly along a wall of doors, sky above. (20.0s)
// ---------------------------------------------------------------------------
const v1: ShotSpec = {
  palette: "saturated",
  weathering: 0.85,
  sunTarget: v3(0, 6, 0),
  environment: {
    sky: { horizon: "#8fb6da", zenith: "#2f6ab6", haze: "#b9d2e6", hazeHeight: 0.1 },
    sun: {
      color: "#fff3df",
      intensity: 4.4,
      azimuth: 3.99,
      elevation: 0.72,
      castShadow: true,
      shadowRadius: 62,
      shadowMapSize: 2048,
    },
    hemi: { sky: "#a6c6ec", ground: "#6d635a", intensity: 1.5 },
    ambient: { color: "#dfe8f3", intensity: 0.35 },
    ground: { color: "#6f6b66", roughness: 0.95, visible: true },
    exposure: 1.0,
  },
  buildPlacements: () => {
    const out: Placement[] = [];
    // A long front rank of doors, with a second and third rank behind so the
    // gaps between stacks are filled rather than showing sky.
    out.push(
      ...buildBlock({
        originX: -58,
        originZ: 0,
        rows: 44,
        bays: 2,
        tiers: 5,
        minTiers: 3,
        seed: 1001,
      }),
    );
    out.push(
      ...buildBlock({
        originX: -56,
        originZ: 16,
        rows: 44,
        bays: 2,
        tiers: 5,
        minTiers: 2,
        gapChance: 0.12,
        seed: 1002,
      }),
    );
    out.push(
      ...buildBlock({
        originX: -60,
        originZ: 33,
        rows: 44,
        bays: 1,
        tiers: 4,
        minTiers: 2,
        gapChance: 0.2,
        seed: 1003,
      }),
    );
    return out;
  },
  camera: (p) => {
    const t = glide(p);
    const x = lerp(-26, 24, t);
    return {
      position: v3(x, 4.1 + drift(t, 0.5) * 0.25, -25.5),
      // Leading the move slightly keeps the wall raking away to the right,
      // which is the perspective the reference holds throughout.
      target: v3(x + 3.4, 5.4, 0),
      fov: 34,
    };
  },
};

// ---------------------------------------------------------------------------
// v2 -- tight golden-hour truck, frame filled edge to edge. (10.0s)
// ---------------------------------------------------------------------------
const v2: ShotSpec = {
  palette: "weathered",
  weathering: 0.95,
  sunTarget: v3(0, 7, 0),
  environment: {
    sky: { horizon: "#edc891", zenith: "#7788b0", haze: "#f2d7a8", hazeHeight: 0.35 },
    sun: {
      color: "#ffd49c",
      intensity: 5.2,
      azimuth: 2.12,
      elevation: 0.24,
      castShadow: true,
      shadowRadius: 46,
      shadowMapSize: 2048,
    },
    hemi: { sky: "#bcd2ec", ground: "#6d5a42", intensity: 0.95 },
    ambient: { color: "#f0d9bb", intensity: 0.3 },
    ground: { color: "#6b6258", roughness: 0.95, visible: true },
    fog: { color: "#e0c39a", near: 70, far: 240 },
    exposure: 1.06,
  },
  buildPlacements: () => {
    const out: Placement[] = [];
    // Tall ranks, close together: the reference never shows sky or ground.
    out.push(
      ...buildBlock({
        originX: -44,
        originZ: 0,
        rows: 38,
        bays: 2,
        tiers: 7,
        minTiers: 5,
        weatherBias: 0.15,
        seed: 2001,
      }),
    );
    out.push(
      ...buildBlock({
        originX: -42,
        originZ: 15,
        rows: 38,
        bays: 2,
        tiers: 8,
        minTiers: 6,
        gapChance: 0.06,
        weatherBias: 0.2,
        seed: 2002,
      }),
    );
    return out;
  },
  camera: (p) => {
    const t = glide(p);
    const x = lerp(-13, 11, t);
    return {
      position: v3(x, 7.6, -15.5),
      // A stronger lead than v1: the reference reads across the boxes at an
      // angle, showing the long sides receding as well as the door ends.
      target: v3(x + 6.5, 8.0, 2),
      fov: 31,
    };
  },
};

// ---------------------------------------------------------------------------
// v3 -- near-orthographic grid of doors, slow diagonal drift. (10.0s)
// ---------------------------------------------------------------------------
const v3Shot: ShotSpec = {
  palette: "weathered",
  weathering: 1.2,
  sunTarget: v3(0, 8, 0),
  environment: {
    sky: { horizon: "#cfd8e0", zenith: "#7f9cbc", haze: "#dde4ea", hazeHeight: 0.3 },
    sun: {
      color: "#fff2e0",
      intensity: 2.5,
      azimuth: 3.55,
      elevation: 0.62,
      castShadow: true,
      shadowRadius: 40,
      shadowMapSize: 2048,
    },
    hemi: { sky: "#c3d6ee", ground: "#6b625a", intensity: 0.95 },
    ambient: { color: "#e6ecf3", intensity: 0.3 },
    ground: { color: "#6e6a66", roughness: 0.95, visible: false },
    exposure: 1.0,
  },
  buildPlacements: () =>
    // One dense slab. The long lens sees only a few metres of depth, so a
    // single deep rank behind the face is enough to close the gaps.
    buildBlock({
      originX: -30,
      originZ: 0,
      rows: 24,
      bays: 2,
      tiers: 9,
      minTiers: 8,
      seed: 3001,
    }),
  camera: (p) => {
    const t = glide(p, 0.2);
    // Long lens from well back: the reference is almost orthographic, with
    // doors the same size from one edge of frame to the other.
    return {
      position: v3(lerp(-7.5, 4.5, t), lerp(9.5, 13.2, t), -56),
      target: v3(lerp(-7.5, 4.5, t), lerp(9.5, 13.2, t), 0),
      fov: 12,
    };
  },
};

// ---------------------------------------------------------------------------
// v4 -- high-angle push over yard rows with aisles. (10.0s)
// ---------------------------------------------------------------------------
const v4: ShotSpec = {
  palette: "weathered",
  weathering: 1.05,
  sunTarget: v3(0, 4, 40),
  environment: {
    sky: { horizon: "#c6d4e2", zenith: "#5a86bd", haze: "#d9e2ea", hazeHeight: 0.28 },
    sun: {
      color: "#fff1d8",
      intensity: 3.5,
      azimuth: 2.5,
      elevation: 0.95,
      castShadow: true,
      shadowRadius: 105,
      shadowMapSize: 2048,
    },
    hemi: { sky: "#adc8e8", ground: "#6a6158", intensity: 0.7 },
    ambient: { color: "#e2e9f2", intensity: 0.22 },
    ground: { color: "#6a6763", roughness: 0.96, visible: true },
    fog: { color: "#c9d6e2", near: 120, far: 420 },
    exposure: 1.0,
  },
  buildPlacements: () => {
    const out: Placement[] = [];
    // Blocks laid out with driving aisles between them -- the gaps are the
    // structure the aerial reference reads by.
    let seed = 4001;
    // Blocks four stacks wide with a straddle-carrier lane between them, laid
    // out far enough in every direction to fill a 50-degree downward look.
    for (let bx = 0; bx < 14; bx++) {
      for (let bz = 0; bz < 8; bz++) {
        out.push(
          ...buildBlock({
            originX: -104 + bx * 14,
            originZ: -40 + bz * 32,
            rows: 4,
            bays: 5,
            tiers: 6,
            minTiers: 3,
            gapChance: 0.06,
            seed: seed++,
          }),
        );
      }
    }
    return out;
  },
  camera: (p) => {
    const t = glide(p, 0.25);
    const z = lerp(-70, -44, t);
    const y = lerp(54, 47, t);
    return {
      position: v3(lerp(-8, 2, t), y, z),
      // Roughly a 55-degree downward look, held as the camera eases in, so
      // the frame stays full of yard rather than running out to the apron.
      target: v3(lerp(-2, 8, t), 5, z + 34),
      fov: 32,
    };
  },
};

// ---------------------------------------------------------------------------
// v5 -- wide two-block composition, open sky, slow crane. (10.0s)
// ---------------------------------------------------------------------------
const v5: ShotSpec = {
  palette: "saturated",
  weathering: 0.7,
  sunTarget: v3(6, 8, 6),
  environment: {
    sky: { horizon: "#aec8de", zenith: "#5f93c6", haze: "#cfe0ec", hazeHeight: 0.18 },
    sun: {
      color: "#fff6ea",
      intensity: 4.3,
      azimuth: 3.85,
      elevation: 0.78,
      castShadow: true,
      shadowRadius: 58,
      shadowMapSize: 2048,
    },
    hemi: { sky: "#d2e2f2", ground: "#6f675e", intensity: 1.7 },
    ambient: { color: "#e9eff5", intensity: 0.42 },
    ground: { color: "#75716c", roughness: 0.96, visible: true },
    exposure: 1.04,
  },
  buildPlacements: () => {
    const out: Placement[] = [];
    // The camera looks along +Z, so screen-right is -X. The tall near block
    // sits there, matching the reference; the lower angled block fills
    // screen-left.
    out.push(
      ...buildBlock({
        originX: -25,
        originZ: -4,
        rows: 5,
        bays: 4,
        tiers: 6,
        minTiers: 5,
        seed: 5002,
      }),
    );
    out.push(
      ...buildBlock({
        originX: 2,
        originZ: 2,
        rows: 4,
        bays: 9,
        tiers: 6,
        minTiers: 5,
        axis: "x",
        seed: 5001,
      }),
    );
    // A far rank so the horizon does not read as empty apron.
    out.push(
      ...buildBlock({
        originX: -80,
        originZ: 78,
        rows: 40,
        bays: 1,
        tiers: 4,
        minTiers: 2,
        gapChance: 0.2,
        seed: 5003,
      }),
    );
    return out;
  },
  camera: (p) => {
    const t = glide(p, 0.25);
    return {
      position: v3(lerp(-11, -6.5, t), lerp(5.6, 7.6, t), -26),
      target: v3(lerp(-10, -6, t), lerp(8.6, 9.4, t), 8),
      fov: 37,
    };
  },
};

// ---------------------------------------------------------------------------
// v6 -- very tight dusk push around a stack corner. (13.3s)
// ---------------------------------------------------------------------------
const v6: ShotSpec = {
  palette: "dusk",
  weathering: 0.8,
  sunTarget: v3(0, 6, 0),
  environment: {
    sky: { horizon: "#a9b3bf", zenith: "#28558f", haze: "#cdbca4", hazeHeight: 0.12 },
    sun: {
      color: "#ffcf9c",
      intensity: 3.0,
      azimuth: 4.2,
      elevation: 0.16,
      castShadow: true,
      shadowRadius: 32,
      shadowMapSize: 2048,
    },
    hemi: { sky: "#93abcb", ground: "#6b5d4c", intensity: 0.95 },
    ambient: { color: "#cdd6e4", intensity: 0.36 },
    ground: { color: "#746c62", roughness: 0.95, visible: true },
    exposure: 1.1,
  },
  buildPlacements: () => {
    const out: Placement[] = [];
    // The hero corner: a tall block whose near corner the camera rides past.
    out.push(
      ...buildBlock({
        originX: -2,
        originZ: 0,
        rows: 5,
        bays: 5,
        tiers: 6,
        minTiers: 5,
        seed: 6001,
      }),
    );
    // Fills the right background (screen-right is -X for this camera) so the
    // arc does not swing off the end of the set. Set well back in Z and a tier
    // lower than the hero block, so the near corner still reads as the
    // subject and still has sky behind it.
    out.push(
      ...buildBlock({
        originX: -24,
        originZ: 9,
        rows: 7,
        bays: 3,
        tiers: 5,
        minTiers: 4,
        gapChance: 0.08,
        seed: 6003,
      }),
    );
    // A further block behind, seen past the corner.
    out.push(
      ...buildBlock({
        originX: -46,
        originZ: 12,
        rows: 6,
        bays: 4,
        tiers: 5,
        minTiers: 4,
        gapChance: 0.1,
        seed: 6002,
      }),
    );
    return out;
  },
  camera: (p) => {
    const t = glide(p, 0.3);
    // A slow arc past the corner rather than a straight push, so the two
    // faces trade dominance the way they do in the reference.
    const angle = lerp(-0.62, -0.18, t);
    const radius = lerp(15.5, 11.8, t);
    return {
      position: v3(
        -3.2 + Math.sin(angle) * radius,
        lerp(6.2, 7.6, t),
        -Math.cos(angle) * radius,
      ),
      target: v3(lerp(-3.6, -2.2, t), lerp(7.4, 8.4, t), 1.5),
      fov: 36,
    };
  },
};

export const SHOTS: Record<VersionId, ShotSpec> = {
  v1,
  v2,
  v3: v3Shot,
  v4,
  v5,
  v6,
};
