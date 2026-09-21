/**
 * The template's data model.
 *
 * Camera, lighting rig, motion system and post chain are fixed. Each of the
 * twelve compositions is one `LookRow` selecting a geometry mode, material
 * parameters, a palette, a background and a blur strength. Adding a colourway
 * is one more row -- see README, "Adding a colourway".
 */

export type GeometryMode =
  | 'molecule' // clusters joined by bonds
  | 'giant' // very large spheres cropped by the frame
  | 'blob' // dense spheres, some fused into smooth blobs
  | 'field' // many small bubbles, even scatter
  | 'iridescent' // small thin-film bubbles drifting upward (not a loop)
  | 'oil'; // large spheres packed in contact, no background visible

export type BackgroundMode = 'vertical' | 'radial' | 'edgeCool' | 'flat' | 'none';

export type BackgroundSpec = {
  mode: BackgroundMode;
  /** Linear-space RGB. These are pre-tonemap values; ACES pulls them down. */
  top: [number, number, number];
  bottom: [number, number, number];
  /** Strength of the secondary tint (edge cooling or radial lift), 0-1. */
  accent: number;
  accentColor: [number, number, number];
};

export type MaterialSpec = {
  transmission: number;
  thickness: number;
  ior: number;
  roughness: number;
  /** Hex. Colour comes from absorption through thickness, not from diffuse. */
  attenuationColor: string;
  /** Shorter distance = more absorption = denser, more saturated read. */
  attenuationDistance: number;
  color: string;
  clearcoat: number;
  clearcoatRoughness: number;
  chromaticAberration: number;
  envMapIntensity: number;
  iridescence: number;
  iridescenceIOR: number;
  /** Nanometres; varied slightly per bubble from the seeded PRNG. */
  iridescenceThicknessRange: [number, number];
  /**
   * Alpha for the hero layer. Below 1 the layer is blended and depth-sorted,
   * which is what lets overlapping spheres show through one another; three's
   * transmission on its own cannot, because transmissive objects are left out
   * of each other's backdrop.
   */
  heroOpacity: number;
};

export type LightingSpec = {
  /** Large soft key, upper-left front. */
  keyIntensity: number;
  keyColor: string;
  keyPosition: [number, number, number];
  /** Opposite the key, 30-40% of it. */
  fillIntensity: number;
  fillColor: string;
  /** Tight rim -- look 3 needs this for its hard bright edge. */
  rimIntensity: number;
  rimColor: string;
  ambientIntensity: number;
  ambientColor: string;
  /**
   * Look 6 inverts the rig: a large emissive panel behind the cluster drives
   * light forward through the spheres. When this is set the panel is built,
   * and it is also what the transmission backdrop pass sees.
   */
  backPanel: { color: string; intensity: number } | null;
};

export type DofSpec = {
  /** World distance from the camera to the focus plane. */
  worldFocusDistance: number;
  /** Depth of the in-focus slab, in world units. */
  worldFocusRange: number;
  /** Blur radius in pixels AT 4K; scaled down for lower-resolution renders.
   *  Look 1 is extreme, look 3 the mildest. */
  bokehScale: number;
};

export type LookRow = {
  /** Remotion composition id. */
  id: string;
  /** Output filename stem, e.g. Molecule_Lavender. */
  name: string;
  mode: GeometryMode;
  /** Every per-element value is drawn from this seed at build time. */
  seed: number;
  durationInFrames: number;
  /** Colourways of one look share geometrySeed so only colour differs. */
  geometrySeed: number;
  material: MaterialSpec;
  /** Applied to the cheap approximated back layer. */
  backTint: string;
  /**
   * Look 6 only: the approximated mass behind the hero glows, so light reads
   * as coming THROUGH the front spheres rather than bouncing off them.
   */
  backEmissive?: string;
  backEmissiveIntensity?: number;
  /** Internal-bubble rim/core colours and rim strength. */
  bubble: { rim: string; core: string; strength: number; opaque?: boolean };
  /**
   * Use three's own transmission on a MeshPhysicalMaterial instead of drei's
   * MeshTransmissionMaterial. drei's shader overrides enough of the lighting
   * output that iridescence does not survive it, and look 5 is built on
   * MeshPhysicalMaterial's iridescence props. three's transmission pass is
   * rebuilt from opaque objects every frame, so it carries no state between
   * frames and stays deterministic.
   */
  useNativeTransmission?: boolean;
  /**
   * Scene environment intensity, kept separate from the material's own
   * envMapIntensity. Look 6 drives this near zero: a studio HDRI has a very
   * bright softbox in it, and on a smooth sphere that lands as a hard specular
   * star on the front surface -- the "lit the wrong way round" failure.
   */
  envIntensity?: number;
  /**
   * Which depth layers get true transmission. Everything else falls back to
   * the cheap approximation. Reserving transmission for the spheres large and
   * sharp enough to show it is the main cost lever: a foreground cluster
   * blurred to near-shapelessness looks the same either way and costs a
   * fraction as much. Defaults to ['mid', 'front'].
   */
  heroLayers?: ('front' | 'mid')[];
  background: BackgroundSpec;
  lighting: LightingSpec;
  dof: DofSpec;
  /** Peak-to-peak grain amplitude, 0-1. 0.015-0.025 is the useful range. */
  grain: number;
  /** Frame chosen for the headline still; see README stills harvest. */
  stillFrame: number;
  /** Three frames per look-variant for the stills harvest. */
  stillFrames: [number, number, number];
  /** True for every look except 5. */
  isLoop: boolean;
};
