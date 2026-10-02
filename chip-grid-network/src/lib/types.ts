import type { SpreadConfig } from "./spread";

export type Vec3 = [number, number, number];

export type CameraShot = {
  position: Vec3;
  target: Vec3;
  /** Camera up vector (needed for the straight-down shots). */
  up: Vec3;
  /** Vertical field of view, degrees. */
  fov: number;
};

export type ShieldMode = "none" | "top" | "float";

export type CompDef = {
  id: string;
  spread: SpreadConfig;
  /** Network colour at frame 0 and the colour that spreads. */
  from: "safe" | "compromised";
  to: "safe" | "compromised";
  shield: ShieldMode;
  /**
   * Depth of field. The in-focus range is `rangeFactor` x the camera's focus
   * distance, so it scales as the camera moves; bokeh scale is at 1080p.
   */
  dof: { rangeFactor: number; bokehScale: number };
  camera: (frame: number) => CameraShot;
  /** Screen-up direction on the floor for flat shields (comp 1). */
  shieldUpXZ?: [number, number];
};
