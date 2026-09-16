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

  /** Longitudinal drift of the cloud deck, in UV units. */
  cloudDrift: uniform(0),
  /** Advances the noise field that breaks up the cloud texture. */
  cloudEvolve: uniform(0),
  cloudOpacity: uniform(0.92),

  reliefStrength: uniform(3.5),
  grainAmount: uniform(0.07),
  microStrength: uniform(0.05),

  /** Moves the grain pattern on every frame. */
  grainSeed: uniform(0),

  rayleigh: uniform(1),
  mie: uniform(1),
  atmosphereDensity: uniform(1),
  extinction: uniform(1),
});

export type EarthUniforms = ReturnType<typeof createUniforms>;
