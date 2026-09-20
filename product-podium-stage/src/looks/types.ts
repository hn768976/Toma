/**
 * The template's data contract.
 *
 * A "look" is one stage: geometry, lighting behaviour and post chain. A
 * "palette" is a colour set for that stage. Every look ships two palettes, so
 * the four looks in this project produce eight compositions.
 *
 * Adding a look means adding a LookDefinition row and, if its scene is
 * structurally new, one scene component. Adding a palette to an existing look
 * means adding one entry to its `palettes` array and nothing else.
 * See README.md, "Adding a new look", for what each field controls.
 */

/** Which scene component renders this look. */
export type SceneKind = "blindShadow" | "haloRing" | "neonTier" | "bubbleDrift";

/**
 * Colour slots. Each look reads the subset it needs - a slot left undefined is
 * simply unused by that scene, which keeps one palette shape across all looks.
 * All values are CSS hex strings, interpreted in sRGB.
 */
export interface StagePalette {
  /** Composition id suffix, e.g. "A" -> BlindShadow_PodiumA. */
  suffix: string;
  /** Human label for the README checklist and the studio sidebar. */
  name: string;
  /** Primary backdrop colour (wall, void, gradient base). */
  backdrop: string;
  /** Secondary backdrop colour - mottle, gradient top, or distant falloff. */
  backdropAlt: string;
  /** Plinth body colour. */
  plinth: string;
  /** Neon / ring / emissive accent. Unused by look 1. */
  accent?: string;
  /** Ambient fill tint. */
  ambient: string;
  /** Key light tint. */
  key: string;
  /** Atmosphere tint - fog, haze, volumetric scattering. */
  fog?: string;
  /** Drifting prop colour (look 4's spheres). */
  props?: string;
}

/** Parametric plinth. Geometry is generated from these, never hand-modelled. */
export interface PlinthSpec {
  /** Radius of the widest (bottom) tier, in world units. */
  radius: number;
  /** Height of a single tier. */
  tierHeight: number;
  /** 1 = a plain disc, 2 = the stepped stack in look 3. */
  tiers: number;
  /** How much narrower each tier above the first is, as a fraction of radius. */
  tierInset: number;
  /** Rounded bevel radius on the top edge. Reads as a machined edge. */
  bevel: number;
  /** Radial subdivision. High enough that 4K shows no faceting on the curve. */
  radialSegments: number;
  /** Subdivision across the bevel fillet. */
  bevelSegments: number;
}

/** Post chain. Bloom is deliberately absent from the photographic looks. */
export interface PostSpec {
  /** Bloom settings, or null for no bloom at all. */
  bloom: { intensity: number; threshold: number; smoothing: number } | null;
  /** Vignette darkness, 0 for none. */
  vignette: number;
  /**
   * Mild depth of field. Focus is locked to the plinth top, so the surface the
   * buyer composites onto is always the sharp plane.
   *
   * `focusRange` is the normalised depth either side of focus that stays sharp
   * - larger keeps more of the plinth crisp. `bokehScale` sets how far the
   * backdrop softens. Enough to read as photographed, never so much that the
   * plinth silhouette goes soft.
   */
  dof: { focusRange: number; bokehScale: number };
  /** Film grain amount. ~0.015 keeps large gradients from banding in H.264. */
  grain: number;
  /** Ordered-dither amount, in 8-bit steps, applied before the encode. */
  dither: number;
  /**
   * "neutral" (Khronos PBR Neutral) holds pastel and skin-adjacent hues
   * without desaturating them, which the two photographic looks need.
   * "aces" gives neon highlights a filmic rolloff instead of clipping them.
   */
  toneMapping: "neutral" | "aces";
  /** Renderer exposure. */
  exposure: number;
  /** Strength of the image-based lighting contribution. */
  envIntensity: number;
}

export interface LookDefinition {
  /** Stable id. Seeds the PRNG, so it fixes the arrangement for both palettes. */
  id: string;
  /** PascalCase name, used as the composition id prefix. */
  name: string;
  /** One-line description shown in the README checklist. */
  description: string;
  scene: SceneKind;
  plinth: PlinthSpec;
  /**
   * Vertical shift applied to the whole stage, in world units.
   *
   * The camera is identical across all eight compositions. This is what keeps
   * the podium's top surface at ~45% of frame height when a look uses a taller
   * plinth, instead of moving the camera to compensate.
   */
  stageOffsetY: number;
  post: PostSpec;
  /**
   * Raymarch step count for look 2's light cone. Ignored by other scenes.
   * Lower this first if the render cost is unworkable - see README.
   */
  volumetricSteps?: number;
  /** Frame exported by `npx remotion still`, chosen per look. */
  stillFrame: number;
  /**
   * Linear push-in over the clip, as a fraction of frame size. 0 is locked.
   *
   * Shipped at 0 on all eight: a push does not return to its start, so it
   * cannot loop. Set to 0.04 for a non-looping hero cut. Implemented as an
   * FOV zoom, which is a pure image scale with no parallax, so a buyer matches
   * it with a single linear scale keyframe.
   */
  pushIn: number;
  /** Exactly two entries: palette A then palette B. */
  palettes: [StagePalette, StagePalette];
}
