/**
 * The two looks share all scene code; everything that differs lives here.
 * Colours are sRGB hex. Backdrop colours are the *displayed* colours we want
 * after tonemapping (they are inverted through ACES before rendering).
 */
export type Finish = {
  name: string;
  /** Metal reflectance colour (sRGB hex). */
  color: string;
  /** Per-object roughness range. */
  roughness: [number, number];
  /** +/- jitter applied to HSL lightness / hue per object. */
  lightJitter: number;
  hueJitter: number;
};

export type Look = {
  id: "gold" | "rose";
  seed: number;
  coins: {
    total: number;
    near: number; // very close to the lens: large, heavily blurred
    front: number; // pass in front of the card, partly covering it
    far: number; // far behind: small, soft
    finishes: Finish[];
  };
  bars: { near: number; mid: number; far: number } | null;
  backdrop: {
    center: string; // brightest, behind the card
    edge: string;
    corner: string;
  };
  card: {
    front: "goldFoil" | "roseSatin";
    text: boolean;
  };
  /** HDRI grade: tint, gain, and a lift toward the set colour. */
  /** peak: soft white point for HDRI highlights (0 = off). */
  env: { tint: string; gain: number; peak: number; ambient: string; ambientAmount: number };
  light: {
    key: number;
    keySize: number;
    fill: number;
    rim: number;
    front: number;
    env: number;
    exposure: number;
  };
  dof: {
    /** Max blur radius in px at 1080p for CoC = 1. */
    bokehPx1080: number;
    nearGain: number;
    farGain: number;
    farMax: number;
  };
  grain: number;
};

export const GOLD: Look = {
  id: "gold",
  seed: 0x601d,
  coins: {
    total: 45,
    near: 5,
    front: 5,
    far: 14,
    finishes: [
      { name: "gold", color: "#E8B84A", roughness: [0.25, 0.38], lightJitter: 0.04, hueJitter: 0.01 },
      { name: "gold-bright", color: "#F2C95A", roughness: [0.25, 0.33], lightJitter: 0.03, hueJitter: 0.01 },
      { name: "gold-deep", color: "#D99E3C", roughness: [0.32, 0.45], lightJitter: 0.04, hueJitter: 0.01 },
    ],
  },
  bars: { near: 2, mid: 3, far: 1 },
  backdrop: { center: "#E9DCC4", edge: "#CDBB9C", corner: "#9F8D70" },
  card: { front: "goldFoil", text: false },
  env: { tint: "#FFF1DC", gain: 1.0, peak: 8, ambient: "#D8C6A6", ambientAmount: 0.5 },
  light: { key: 3, keySize: 32, fill: 1.2, rim: 6, front: 1.8, env: 1.0, exposure: 1 },
  dof: { bokehPx1080: 34, nearGain: 1.05, farGain: 1.1, farMax: 0.42 },
  grain: 0.02,
};

export const ROSE: Look = {
  id: "rose",
  seed: 0x2053,
  coins: {
    total: 55,
    near: 6,
    front: 7,
    far: 16,
    finishes: [
      { name: "rose-gold", color: "#EBB09A", roughness: [0.26, 0.4], lightJitter: 0.03, hueJitter: 0.008 },
      { name: "copper", color: "#DE916C", roughness: [0.28, 0.42], lightJitter: 0.03, hueJitter: 0.008 },
      { name: "silver", color: "#CCC7C3", roughness: [0.22, 0.36], lightJitter: 0.02, hueJitter: 0.004 },
    ],
  },
  bars: null,
  backdrop: { center: "#E9BAB4", edge: "#D9A3A0", corner: "#BE8783" },
  card: { front: "roseSatin", text: true },
  env: { tint: "#FFE6E0", gain: 1.0, peak: 6, ambient: "#E2AEA8", ambientAmount: 0.4 },
  light: { key: 3.6, keySize: 30, fill: 1.3, rim: 5, front: 2.0, env: 1.0, exposure: 1 },
  dof: { bokehPx1080: 34, nearGain: 1.05, farGain: 1.1, farMax: 0.42 },
  grain: 0.02,
};

export const LOOKS = { gold: GOLD, rose: ROSE } as const;
