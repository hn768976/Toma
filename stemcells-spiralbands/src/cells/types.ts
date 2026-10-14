import type * as THREE from "three";
import type { ProfileParams } from "./lathe";
import type { NucleusStyle } from "./nucleusGeometry";

export type RGBHex = string;

/** Colours and material constants of one cell colourway (one data row). */
export type CellColors = {
  nucleus: {
    base: RGBHex;
    deep: RGBHex;
    hi: RGBHex;
    spec: RGBHex;
    glow: number;
    shine: number;
    style: NucleusStyle;
    /** Nucleus radius as a fraction of the cell radius. */
    size: number;
    /** Strength of the glow around the nucleus. */
    halo: number;
  };
  backdrop: {
    edge: RGBHex;
    mid: RGBHex;
    core: RGBHex;
    coreGain: number;
    glowPos: [number, number];
    glowWide: number;
    glowCore: number;
    stretch: number;
    vignette: number;
    cloud: number;
  };
  membrane: {
    lineTint: RGBHex;
    lineBright: number;
    thickness: number;
    refr: number;
    refrMix: number;
    haze: number;
    hazeColor: RGBHex;
    cloudAmt: number;
    refl: number;
    window: number;
    wobAmp: number;
    wobFreq: number;
    body: number;
    bodyTint: RGBHex;
    darkBand: number;
    bodyLift: number;
    crescent: number;
  };
  particles: { color: RGBHex; alpha: number; size: number };
  /** Near-lens blur at infinity, in px at 1080p. */
  aperturePx: number;
  /** Far cells fade into the backdrop between these distances. */
  fade: [number, number];
  grain: number;
};

export type NucleusState = {
  /** Offset in cell-local units (cell radius = 1), local x = division axis. */
  offset: THREE.Vector3;
  scale: number;
  stretch: number;
  quat: THREE.Quaternion;
  visible: boolean;
};

export type FragmentState = {
  offset: THREE.Vector3;
  scale: THREE.Vector3;
  quat: THREE.Quaternion;
};

export type CellState = {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  radius: number;
  profile: ProfileParams;
  nuclei: [NucleusState, NucleusState];
  fragments: FragmentState[];
  /** Periodic wobble phase in [0, 1). */
  wobPhase: number;
  visible: boolean;
};

export type CameraState = {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  focus: number;
};

export type SceneFrame = {
  camera: CameraState;
  cells: CellState[];
  /** 0..1 over the loop (or the story), drives particle drift. */
  phase: number;
  /** Multiplier on the palette aperture. */
  apertureScale: number;
};

/** A cell composition: fixed population, per-frame state from the frame. */
export type CellSceneDef = {
  cellCount: number;
  /** Per cell: seed for the wobble field and nucleus variant index. */
  cellSeeds: number[];
  nucleusVariant: number[];
  /** Per cell: use the high-detail nucleus mesh. */
  hiDetail: boolean[];
  fragmentCount: number[];
  particles: { positions: Float32Array; seeds: Float32Array };
  frameState: (frame: number) => SceneFrame;
};
