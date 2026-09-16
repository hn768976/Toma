import { uniform } from "three/tsl";
import { Vector3 } from "three/webgpu";

/**
 * Every value the Earth shaders animate. Kept in one place so the scene can
 * push a frame's worth of state in a single pass.
 */
export const createUniforms = () => ({
  sunDirection: uniform(new Vector3(1, 0, 0)),
  sunIntensity: uniform(1),
  nightIntensity: uniform(1.5),
  /** Level subtracted off the night map before the lights are amplified. */
  nightFloor: uniform(0.075),

  /**
   * Rotation of the planet, in UV units. Offsetting the lookup is exactly
   * what spinning the planet does — the surface moves, the terminator does
   * not — and it keeps every mesh at identity.
   */
  surfaceSpin: uniform(0),

  /** Longitudinal drift of the cloud deck, in UV units. */
  cloudDrift: uniform(0),
  /** Advances the noise field that breaks up the cloud texture. */
  cloudEvolve: uniform(0),
  cloudOpacity: uniform(0.92),

  /** Ocean glint: tighter and weaker the further out the camera sits. */
  glintPower: uniform(110),
  glintGain: uniform(0.85),
  /** Baseline lift on the surface. Near zero for the pure night passes. */
  ambient: uniform(0.03),

  reliefStrength: uniform(3.5),
  grainAmount: uniform(0.07),
  /** Scales all procedural detail; zero where the surface is smeared away. */
  procedural: uniform(1),
  microStrength: uniform(0.05),

  /** Moves the grain pattern on every frame. */
  grainSeed: uniform(0),

  haloStrength: uniform(1),
  /** In-scattered air laid over the disc, strongest towards the limb. */
  surfaceHaze: uniform(0.34),

  /** Fades the sun flare as the disc clears the limb. */
  flareIntensity: uniform(0),

  /** Fades the meteor in and out across its pass. */
  meteorIntensity: uniform(0),

  /** Deep-space background: nebula wash and the near-field dust motes. */
  nebula: uniform(0),
  dust: uniform(0),
  dustDrift: uniform(0),

  /** UV span the surface smears over, for the timelapse pass. */
  motionBlur: uniform(0),

  rayleigh: uniform(1),
  mie: uniform(1),
  atmosphereDensity: uniform(1),
  extinction: uniform(1),
});

export type EarthUniforms = ReturnType<typeof createUniforms>;
