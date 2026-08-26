/**
 * Every tunable number in the piece. Reach for this file first when the look
 * needs adjusting; the drawing code should read parameters, never invent them.
 */
export const CONFIG = {
  /** Composition — must match the <Composition> registration in Root.tsx. */
  width: 3840,
  height: 2160,
  fps: 30,
  durationInFrames: 360,

  /** The slow camera push. One ease-in-out across the whole duration. */
  push: {
    from: 1.0,
    to: 1.22,
    /** Parallax: near cards get this much of the push, far cards get `farMultiplier`. */
    nearMultiplier: 2.0,
    farMultiplier: 0.35,
    /** The hero sits at the pivot of the parallax — it grows at the base rate. */
    heroMultiplier: 1.0,
  },

  /** The faked-perspective plane. Affine only: parallel lines stay parallel. */
  plane: {
    tiltDegrees: -18,
    /** Horizontal compression of the plane's x axis (right side reads ~10% tighter). */
    horizontalCompression: 0.9,
    /** Horizontal shear coefficient (x' = compression*x + shear*y). */
    shear: 0.18,
    /** Scene is laid out over the frame plus this much overscan, so cards can
     * sit partly outside it and drift in and out. */
    overscan: 1.14,
  },

  /** The surrounding message cards. */
  cards: {
    /** 7 x 4 jittered cells across the frame = 28 overlapping cards. */
    columns: 7,
    rows: 4,
    /** Red cards. Counterweight, not a second theme — keep this tiny. */
    redCount: 3,
    /** Red is banned outside this depth window, and near the hero. */
    redDepthRange: [0.4, 0.75] as const,
    /** Red must land inside this inset of the frame, or it reads as an edge artefact. */
    redFrameInset: 0.1,
    /** ...and no closer to the badge than this multiple of the hero clearing. */
    redMinHeroDistance: 2.4,
    /** Plane-space card size before the depth scale is applied. */
    minWidth: 360,
    maxWidth: 760,
    minAspect: 0.42,
    maxAspect: 0.78,
    /** Depth 0 (near) and depth 1 (far) size multipliers. */
    nearScale: 1.55,
    farScale: 0.42,
    /** Cards drift down-left; near cards move fastest. */
    driftNear: 1.35,
    driftFar: 0.22,
    /** Radius of the tiny closed bob path, in plane units. */
    bobRadius: 10,
    /** Fraction of cards carrying the hero's cyan bar-cluster motif. */
    barMotifChance: 0.18,
    /** Cards whose text lines re-render as if a message arrived. */
    liveCount: 6,
    /** Frames between message events (30 / 12 = 2.5 events per second). */
    liveEventInterval: 12,
    /** Pre-baked line-length variants per live card. */
    liveVariants: 3,
    /** Cards must not obscure the hero: nothing sharp inside this plane radius. */
    heroExclusionRadius: 620,
  },

  /** Floating code. Texture, not content. */
  code: {
    blocks: 8,
    minOpacity: 0.3,
    maxOpacity: 0.55,
    fontSize: 32,
    lineHeight: 42,
    minLines: 4,
    maxLines: 8,
    /** Code clusters upper-left, where the cards are sparsest: the fraction of
     * the frame, from the top-left corner, that blocks are placed within. */
    regionWidth: 0.52,
    regionHeight: 0.64,
    /** 4 x 2 cells across that region = 8 blocks, spread rather than piled. */
    columns: 4,
    rows: 2,
  },

  /** Depth of field. Three buffers, blurred once each — never per element. */
  dof: {
    /** Blur ceiling at 4K, in px. */
    maxBlur: 30,
    /** Depth that sits in the focal band. */
    focalDepth: 0.5,
    /** Blur applied to each of the three buckets when compositing. */
    sharpBlur: 0,
    midBlur: 11,
    farBlur: 30,
    /** A card lands in `sharp` below this blur estimate, `mid` below the next. */
    sharpThreshold: 5,
    midThreshold: 17,
    /** Focus also falls off toward the frame edges, starting at this radius. */
    radialFalloffStart: 0.3,
    radialFalloffEnd: 1.0,
    /** Blurred white cards bloom — they catch the badge's glow. */
    bloomStrength: 0.26,
  },

  /** Near cards strobe during the push without this. */
  motionBlur: {
    samples: 3,
    /** Only cards nearer than this get smeared. */
    depthCutoff: 0.3,
    /** Span of the smear, in frames of travel. */
    frameSpan: 1,
  },

  /** The hero. */
  hero: {
    /** Bubble height as a fraction of frame height. */
    bubbleHeightFraction: 0.3,
    bubbleAspect: 1.42,
    bubbleAlpha: 0.85,
    /** Badge height as a fraction of the bubble's. */
    badgeHeightFraction: 0.45,
    glyph: 'AI',
    /** Base halo intensity. */
    glowIntensity: 1.0,
    /** The halo pulses this much either side of the base. */
    glowPulse: 0.12,
    /** Pulse period, in frames. */
    glowPeriodFrames: 90,
    /** How far the halo reaches, as a multiple of badge size. */
    glowReach: 6.0,
    /** Bars in the waveform cluster beside the badge. */
    barCount: 6,
    /** The only fast motion in the piece. */
    barMinHz: 1.1,
    barMaxHz: 2.7,
    /** Short text-preview lines below the bubble. */
    previewLines: 3,
  },

  /** Finish. */
  finish: {
    vignette: 0.2,
    grainAlpha: 0.04,
    /** Grain tile is generated once and tiled — regenerating at 4K is far too slow. */
    grainTileSize: 256,
    grainTileCount: 8,
    bloomStrength: 0.34,
  },

  /** Sprite baking. Cards and code blocks are drawn once, then blitted. */
  sprites: {
    /** Longest side of any baked card sprite, in px. */
    maxSide: 1100,
    /** Code blocks get more room — their text has to survive being read at 4K. */
    maxCodeSide: 1700,
    /** Extra resolution so sharp-band cards survive the push. */
    supersample: 1.25,
  },
} as const;
