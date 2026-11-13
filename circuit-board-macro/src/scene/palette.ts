import * as THREE from "three";

export type Mat = {
  color: THREE.ColorRepresentation;
  roughness: number;
  metalness: number;
  env?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
};

export type MatKey =
  | "board"
  | "trace"
  | "pad"
  | "plate"
  | "plateDetail"
  | "plateDark"
  | "chipBody"
  | "pin"
  | "die"
  | "dieTop"
  | "block"
  | "blockLid"
  | "blockFrame"
  | "blockSlot"
  | "cap"
  | "capTop"
  | "smd"
  | "metal";

export type Palette = {
  name: string;
  mats: Record<MatKey, Mat>;
  /** Environment softboxes (HDR colours). */
  envBase: THREE.ColorRepresentation;
  envBack: THREE.Color; // low, behind-left: gives the blown-out glare on the board
  envTop: THREE.Color; // overhead: lights the tops of the parts
  envRim: THREE.Color; // right/back rim
  envFill: THREE.Color; // behind the camera
  keyColor: THREE.ColorRepresentation;
  keyIntensity: number;
  backColor: THREE.ColorRepresentation;
  backIntensity: number;
  fog: THREE.ColorRepresentation;
  dust: THREE.Color;
  post: {
    saturation: number;
    contrast: number;
    exposure: number;
    tint: THREE.ColorRepresentation;
    lift: THREE.ColorRepresentation;
  };
};

const g = (v: number) => new THREE.Color(v, v, v);

/** V1 – monochrome, matches the reference. */
export const MONO: Palette = {
  name: "mono",
  mats: {
    board: { color: g(0.03), roughness: 0.5, metalness: 0.0, env: 0.5 },
    trace: { color: g(0.13), roughness: 0.55, metalness: 0.1, env: 0.6 },
    pad: { color: g(0.42), roughness: 0.35, metalness: 0.6 },
    plate: { color: g(0.085), roughness: 0.7, metalness: 0.25 },
    plateDetail: { color: g(0.42), roughness: 0.45, metalness: 0.6 },
    plateDark: { color: g(0.035), roughness: 0.5, metalness: 0.3 },
    chipBody: { color: g(0.035), roughness: 0.55, metalness: 0.1 },
    pin: { color: g(0.5), roughness: 0.38, metalness: 0.8 },
    die: { color: g(0.02), roughness: 0.4, metalness: 0.2 },
    dieTop: { color: g(0.22), roughness: 0.35, metalness: 0.6 },
    block: { color: g(0.1), roughness: 0.5, metalness: 0.3 },
    blockLid: { color: g(0.075), roughness: 0.8, metalness: 0.2 },
    blockFrame: { color: g(0.38), roughness: 0.45, metalness: 0.4 },
    blockSlot: { color: g(0.012), roughness: 0.7, metalness: 0.0 },
    cap: { color: g(0.015), roughness: 0.4, metalness: 0.1 },
    capTop: { color: g(0.5), roughness: 0.35, metalness: 0.8 },
    smd: { color: g(0.05), roughness: 0.5, metalness: 0.1 },
    metal: { color: g(0.4), roughness: 0.35, metalness: 0.85 },
  },
  envBase: g(0.035),
  envBack: g(10),
  envTop: g(1.8),
  envRim: g(1.2),
  envFill: g(1.7),
  keyColor: 0xffffff,
  keyIntensity: 1.0,
  backColor: 0xffffff,
  backIntensity: 8.5,
  fog: g(0.2),
  dust: g(3.5),
  post: {
    saturation: 0,
    contrast: 1.06,
    exposure: 0.9,
    tint: 0xffffff,
    lift: 0x000000,
  },
};

/** V2 – midnight teal board, gold/copper metal, warm key with cool rim. */
export const COLOR: Palette = {
  name: "color",
  mats: {
    board: {
      color: new THREE.Color(0.004, 0.03, 0.05),
      roughness: 0.4,
      metalness: 0.0,
      env: 1.0,
    },
    trace: {
      color: new THREE.Color(0.62, 0.34, 0.08),
      roughness: 0.4,
      metalness: 0.85,
    },
    pad: {
      color: new THREE.Color(0.95, 0.62, 0.2),
      roughness: 0.3,
      metalness: 1.0,
    },
    plate: {
      color: new THREE.Color(0.06, 0.15, 0.2),
      roughness: 0.45,
      metalness: 0.7,
    },
    plateDetail: {
      color: new THREE.Color(0.95, 0.6, 0.18),
      roughness: 0.32,
      metalness: 1.0,
    },
    plateDark: {
      color: new THREE.Color(0.01, 0.03, 0.045),
      roughness: 0.5,
      metalness: 0.3,
    },
    chipBody: {
      color: new THREE.Color(0.01, 0.025, 0.04),
      roughness: 0.55,
      metalness: 0.1,
    },
    pin: {
      color: new THREE.Color(0.9, 0.58, 0.2),
      roughness: 0.32,
      metalness: 1.0,
    },
    die: {
      color: new THREE.Color(0.01, 0.02, 0.03),
      roughness: 0.35,
      metalness: 0.3,
    },
    dieTop: {
      color: new THREE.Color(0.1, 0.5, 0.55),
      roughness: 0.25,
      metalness: 0.8,
      emissive: new THREE.Color(0.0, 0.5, 0.6),
      emissiveIntensity: 0.6,
    },
    block: {
      color: new THREE.Color(0.008, 0.028, 0.05),
      roughness: 0.5,
      metalness: 0.1,
    },
    blockLid: {
      color: new THREE.Color(0.05, 0.13, 0.19),
      roughness: 0.42,
      metalness: 0.6,
    },
    blockFrame: {
      color: new THREE.Color(0.75, 0.46, 0.14),
      roughness: 0.38,
      metalness: 0.9,
    },
    blockSlot: {
      color: new THREE.Color(0.003, 0.01, 0.018),
      roughness: 0.7,
      metalness: 0.0,
    },
    cap: {
      color: new THREE.Color(0.006, 0.02, 0.04),
      roughness: 0.38,
      metalness: 0.1,
    },
    capTop: {
      color: new THREE.Color(0.75, 0.75, 0.78),
      roughness: 0.3,
      metalness: 0.9,
    },
    smd: {
      color: new THREE.Color(0.012, 0.035, 0.055),
      roughness: 0.5,
      metalness: 0.1,
    },
    metal: {
      color: new THREE.Color(0.9, 0.6, 0.22),
      roughness: 0.32,
      metalness: 1.0,
    },
  },
  envBase: new THREE.Color(0.012, 0.03, 0.05),
  envBack: new THREE.Color(11, 5.6, 1.9),
  envTop: new THREE.Color(1.9, 2.2, 2.6),
  envRim: new THREE.Color(0.4, 1.5, 2.2),
  envFill: new THREE.Color(1.3, 1.5, 1.8),
  keyColor: new THREE.Color(1.0, 0.72, 0.42),
  keyIntensity: 1.1,
  backColor: new THREE.Color(1.0, 0.62, 0.3),
  backIntensity: 8,
  fog: new THREE.Color(0.22, 0.14, 0.08),
  dust: new THREE.Color(6, 4.2, 2.2),
  post: {
    saturation: 1.12,
    contrast: 1.06,
    exposure: 1.0,
    tint: 0xffffff,
    lift: new THREE.Color(0.0, 0.012, 0.03),
  },
};
