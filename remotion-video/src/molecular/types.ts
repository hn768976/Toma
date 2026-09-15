import type { EnvSpec } from "./environment";

export type Vec3 = [number, number, number];

export type BackgroundSpec = {
  top: string;
  mid: string;
  bottom: string;
  /** Direction the soft key glow sits in, in world space. */
  glowDir: Vec3;
  glowColor: string;
  /** Higher = tighter pool of light. */
  glowSize: number;
  glowStrength: number;
};

export type GlassSpec = {
  color: string;
  transmission: number;
  thickness: number;
  roughness: number;
  ior: number;
  /** Interior absorption — what gives thick glass its colour. */
  attenuationColor: string;
  attenuationDistance: number;
  clearcoat: number;
  clearcoatRoughness: number;
  /** Thin-film interference: the magenta/gold edge fringe in the macro refs. */
  iridescence: number;
  iridescenceIOR: number;
  iridescenceThickness: number;
  envMapIntensity: number;
  /** Optional darker/lighter tint for the far-field instances. */
  backdropColor?: string;
};

export type LayoutSpec = {
  seed: number;
  /** Instances excluding the hero. */
  count: number;
  /** Half-extents the cloud is scattered through, in world units. */
  spread: Vec3;
  /** Min/max z the scattered instances occupy (negative = behind hero). */
  depth: [number, number];
  scale: [number, number];
  heroScale: number;
  heroPosition: Vec3;
  /** Radians/sec, applied per instance with a random sign. */
  spin: [number, number];
  /** World units/sec of lazy convection drift. */
  drift: number;
  /** Adds a large clear sphere around the hero (refs r5 / r6). */
  shell?: { radius: number; opacity: number; color: string };
};

export type DustSpec = {
  seed: number;
  count: number;
  spread: Vec3;
  size: [number, number];
  color: string;
  opacity: number;
  rise: number;
};

export type PostSpec = {
  /** World-space distance from camera that stays sharp. */
  focusDistance: number;
  /** Depth of the sharp zone, in world units. Smaller = shallower. */
  focusRange: number;
  bokehScale: number;
  bloomIntensity: number;
  bloomThreshold: number;
  vignette: number;
  grain: number;
};

export type CameraState = {
  position: Vec3;
  lookAt: Vec3;
  fov: number;
};

export type VersionPreset = {
  id: string;
  label: string;
  /** Which supplied reference this version is modelled on. */
  reference: string;
  durationSeconds: number;
  background: BackgroundSpec;
  env: EnvSpec;
  glass: GlassSpec;
  layout: LayoutSpec;
  dust: DustSpec;
  post: PostSpec;
  exposure: number;
  /** Camera rig as a pure function of elapsed seconds. */
  camera: (t: number) => CameraState;
};
