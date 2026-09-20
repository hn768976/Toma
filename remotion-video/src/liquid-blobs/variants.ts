import { z } from "zod";

/**
 * Colour + lighting presets, one per reference clip. Every backdrop and blob
 * hex below was sampled out of the corresponding reference frame, so the
 * palettes are matched rather than eyeballed.
 *
 * The lighting numbers are deliberately low-contrast. These references read
 * like a photographed clay maquette under one very large soft source: the
 * body of each blob sits close to its own albedo and nearly all of the form
 * is carried by a bright lip at grazing angles.
 */
export const variantIds = ["v1-blue", "v2-white", "v3-red", "v4-beige"] as const;

export type VariantId = (typeof variantIds)[number];

export const variantIdSchema = z.enum(variantIds);

export type Variant = {
  id: VariantId;
  label: string;
  /** Flat backdrop, top and bottom of a very gentle vertical ramp. */
  backgroundTop: string;
  backgroundBottom: string;
  /** Soft off-centre glow that sits behind the blobs. */
  glowColor: string;
  glowOpacity: number;
  glowX: number;
  glowY: number;
  /**
   * Where the highlight rolloff starts, in linear light. Below this the
   * surface responds linearly; above it the response compresses.
   */
  shoulderKnee: number;
  /** Albedo of the liquid. */
  blobColor: string;
  /** Colour of the key source. */
  keyColor: string;
  /**
   * How far the key is allowed to pull the body away from flat albedo.
   * Stays well under 1 — at 1 this becomes an ordinary hard-terminator
   * Lambert surface, which is not what any of the references look like.
   */
  keyIntensity: number;
  /** Bounce light standing in for the backdrop. */
  fillColor: string;
  fillIntensity: number;
  ambientIntensity: number;
  /** Half-Lambert wrap — higher is softer, more matte, more "clay". */
  wrap: number;
  specularIntensity: number;
  specularPower: number;
  fresnelIntensity: number;
  fresnelPower: number;
  fresnelColor: string;
  /** Fake subsurface: light bleeding through the thin parts of the blob. */
  subsurfaceIntensity: number;
  subsurfaceColor: string;
  occlusionStrength: number;
};

export const variants: Record<VariantId, Variant> = {
  "v1-blue": {
    id: "v1-blue",
    label: "V1 · Electric blue on cyan",
    // Backdrop measured dead flat across the whole reference frame.
    backgroundTop: "#2fb5ee",
    backgroundBottom: "#2fb5ee",
    glowColor: "#7fd0f5",
    glowOpacity: 0.04,
    glowX: 0.26,
    glowY: 0.16,
    shoulderKnee: 0.72,
    // Reference blob runs #0077e8 in shadow to #0082eb in light — a range of
    // barely five code values, so the key is kept very gentle.
    blobColor: "#0081f2",
    keyColor: "#ffffff",
    keyIntensity: 0.3,
    fillColor: "#2fb5ee",
    fillIntensity: 0.1,
    ambientIntensity: 0.0,
    wrap: 0.5,
    specularIntensity: 0.05,
    specularPower: 120,
    // No red at all: the reference blob holds #00 red from shadow to
    // highlight, so nothing additive is allowed to introduce any.
    fresnelIntensity: 0.12,
    fresnelPower: 3.8,
    fresnelColor: "#00a8ff",
    subsurfaceIntensity: 0.06,
    subsurfaceColor: "#0096ff",
    occlusionStrength: 0.4,
  },
  "v2-white": {
    id: "v2-white",
    label: "V2 · White on dusty rose",
    backgroundTop: "#dd9399",
    backgroundBottom: "#dd9399",
    glowColor: "#f0bcb9",
    glowOpacity: 0.05,
    glowX: 0.22,
    glowY: 0.14,
    shoulderKnee: 0.66,
    // Shadow side picks up the rose backdrop (#cccace) while the lit side
    // goes cool (#cfdbdf), so the fill is the backdrop and the key is cold.
    blobColor: "#e8e8e4",
    keyColor: "#eaf4ff",
    keyIntensity: 0.22,
    fillColor: "#dd9399",
    fillIntensity: 0.1,
    ambientIntensity: 0.0,
    wrap: 0.58,
    specularIntensity: 0.03,
    specularPower: 100,
    fresnelIntensity: 0.07,
    fresnelPower: 4.2,
    fresnelColor: "#dff0ff",
    subsurfaceIntensity: 0.06,
    subsurfaceColor: "#f6dedc",
    occlusionStrength: 0.38,
  },
  "v3-red": {
    id: "v3-red",
    label: "V3 · Cherry red on pastel pink",
    backgroundTop: "#f28f9b",
    backgroundBottom: "#f28f9b",
    glowColor: "#fbc6c4",
    glowOpacity: 0.04,
    glowX: 0.24,
    glowY: 0.16,
    shoulderKnee: 0.6,
    // Red holds near constant while green and blue climb — the highlight
    // desaturates rather than brightening, which the shoulder produces.
    blobColor: "#f5333e",
    keyColor: "#ffffff",
    keyIntensity: 0.34,
    fillColor: "#f28f9b",
    fillIntensity: 0.1,
    ambientIntensity: 0.0,
    wrap: 0.48,
    specularIntensity: 0.06,
    specularPower: 110,
    fresnelIntensity: 0.46,
    fresnelPower: 2.4,
    fresnelColor: "#ffc0a6",
    subsurfaceIntensity: 0.07,
    subsurfaceColor: "#ff6a58",
    occlusionStrength: 0.42,
  },
  "v4-beige": {
    id: "v4-beige",
    label: "V4 · Nude beige on pale sage",
    backgroundTop: "#dce6dd",
    backgroundBottom: "#dce6dd",
    // The one reference with a visible source in frame: a broad soft bloom
    // off the top right of the backdrop.
    glowColor: "#ffffff",
    glowOpacity: 0.26,
    glowX: 0.82,
    glowY: 0.08,
    shoulderKnee: 0.6,
    blobColor: "#ab8b72",
    keyColor: "#fff4e6",
    keyIntensity: 0.34,
    fillColor: "#dce6dd",
    fillIntensity: 0.12,
    ambientIntensity: 0.0,
    wrap: 0.6,
    specularIntensity: 0.03,
    specularPower: 90,
    fresnelIntensity: 0.42,
    fresnelPower: 2.3,
    fresnelColor: "#fff0dc",
    subsurfaceIntensity: 0.34,
    subsurfaceColor: "#ffc79c",
    occlusionStrength: 0.34,
  },
};

export const variantList = variantIds.map((id) => variants[id]);
