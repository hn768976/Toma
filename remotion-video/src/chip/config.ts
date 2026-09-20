// Shared configuration for the three "AI chip seats into a motherboard"
// variants. Everything that differs between them lives in a VariantConfig so
// the scene builder itself stays single-source.

export const FPS = 30;

export const HD = { width: 1920, height: 1080 } as const;
export const UHD = { width: 3840, height: 2160 } as const;

export type VariantId = "v1" | "v2" | "v3";

// Frame counts mirror the reference clips at 30fps.
export const DURATION: Record<VariantId, number> = {
  v1: 288, // 9.6s
  v2: 240, // 8.0s
  v3: 240, // 8.0s
};

/** Frame-based beats. All variants share the same named moments. */
export type Beats = {
  /** Chip starts dropping toward the socket. */
  descendStart: number;
  /** Chip makes contact — the impact frame everything else keys off. */
  seat: number;
  /** Energy wave finishes crossing the board. */
  waveEnd: number;
  /** Optional late-stage transition (V3's blue -> black flip). */
  transformStart?: number;
  transformEnd?: number;
};

export type Palette = {
  background: string;
  /** Solder-mask / substrate colour of the PCB. */
  board: number;
  boardRoughness: number;
  boardMetalness: number;
  /** Dim, unpowered trace colour baked into the albedo. */
  traceDark: number;
  /** Fully energised trace colour. */
  traceHot: number;
  /** Secondary energy colour, used for the leading edge of the wave. */
  traceEdge: number;
  /** Surface-mount component tints, cycled per instance. */
  components: number[];
  componentRoughness: number;
  componentMetalness: number;
  /** Height multiplier for surface-mount parts; V2's board is much flatter. */
  componentHeight: number;
  /** Socket frame metal. */
  socket: number;
  socketRoughness: number;
  /** Chip body. */
  chipBody: number;
  chipTop: number;
  chipEmissive: number;
  /** Lighting. */
  keyLight: number;
  fillLight: number;
  rimLight: number;
  ambient: number;
  ambientIntensity: number;
  /** Studio environment used for reflections (see scene/environment.ts). */
  env: {
    ceiling: number;
    ceilingIntensity: number;
    key: number;
    keyIntensity: number;
    fill: number;
    fillIntensity: number;
    floor: number;
    floorIntensity: number;
  };
  envIntensity: number;
  /** Post-processing. */
  bloomThreshold: number;
  bloomStrength: number;
  vignette: number;
  grain: number;
};

export type VariantConfig = {
  id: VariantId;
  label: string;
  durationInFrames: number;
  beats: Beats;
  palette: Palette;
  /** Marking rendered on the chip lid. */
  chipLabel: string;
  /** How the chip lid behaves: solid glass, iridescent, or a hologram. */
  chipStyle: "glass" | "iridescent" | "hologram";
  /** Density of the routed trace fan on the board. */
  traceDensity: number;
  /** Screen-space focus band: 0 = top of frame, 1 = bottom. */
  focusY: number;
  focusTightness: number;
  dofStrength: number;
};

const V1: VariantConfig = {
  id: "v1",
  label: "Energy Pulse",
  durationInFrames: DURATION.v1,
  beats: { descendStart: 10, seat: 40, waveEnd: 122 },
  chipLabel: "AI",
  chipStyle: "glass",
  traceDensity: 1.4,
  focusY: 0.52,
  focusTightness: 0.42,
  dofStrength: 1.0,
  palette: {
    background: "#03070e",
    board: 0x0d1e33,
    boardRoughness: 0.62,
    boardMetalness: 0.18,
    traceDark: 0x11324f,
    traceHot: 0x8fd4ff,
    traceEdge: 0x4fb8ff,
    components: [0x1b3a5c, 0x224a72, 0x15304d, 0x275685, 0x1d3f63],
    componentRoughness: 0.5,
    componentMetalness: 0.3,
    componentHeight: 1,
    socket: 0x9fb2c4,
    socketRoughness: 0.34,
    chipBody: 0x14304d,
    chipTop: 0x1d4a75,
    chipEmissive: 0x63c8ff,
    keyLight: 0xbfe4ff,
    fillLight: 0x2a6fb0,
    rimLight: 0x8fd4ff,
    ambient: 0x1b3c60,
    ambientIntensity: 1.05,
    env: {
      ceiling: 0xbfe0ff,
      ceilingIntensity: 1.5,
      key: 0xdcefff,
      keyIntensity: 2.6,
      fill: 0x2b6fb5,
      fillIntensity: 1.4,
      floor: 0x0c1c30,
      floorIntensity: 0.5,
    },
    envIntensity: 0.9,
    bloomThreshold: 0.74,
    bloomStrength: 0.95,
    vignette: 0.42,
    grain: 0.05,
  },
};

const V2: VariantConfig = {
  id: "v2",
  label: "Porcelain Lab",
  durationInFrames: DURATION.v2,
  beats: { descendStart: 16, seat: 52, waveEnd: 142 },
  chipLabel: "AI",
  chipStyle: "iridescent",
  traceDensity: 0.55,
  focusY: 0.58,
  focusTightness: 0.34,
  dofStrength: 1.35,
  palette: {
    background: "#eef1f6",
    board: 0xe9ecf2,
    boardRoughness: 0.78,
    boardMetalness: 0.02,
    traceDark: 0xd2d8e4,
    traceHot: 0x8ea8ff,
    traceEdge: 0xb9a6f0,
    components: [0xbfe4d6, 0xc4c8ea, 0xb8d0ee, 0xd8cdee, 0xe2e6ee, 0xaad8cc],
    componentRoughness: 0.28,
    componentMetalness: 0.12,
    componentHeight: 0.45,
    socket: 0xc4cad4,
    socketRoughness: 0.3,
    chipBody: 0xb8bec8,
    chipTop: 0x6455dd,
    chipEmissive: 0xc07ce8,
    keyLight: 0xffffff,
    fillLight: 0xdfe6f5,
    rimLight: 0xffffff,
    ambient: 0xe8ecf4,
    ambientIntensity: 1.5,
    env: {
      ceiling: 0xffffff,
      ceilingIntensity: 4.2,
      key: 0xffffff,
      keyIntensity: 3.4,
      fill: 0xe6ecfa,
      fillIntensity: 2.6,
      floor: 0xf2f4f9,
      floorIntensity: 2.0,
    },
    envIntensity: 1.5,
    bloomThreshold: 0.9,
    bloomStrength: 0.45,
    vignette: 0.1,
    grain: 0.03,
  },
};

const V3: VariantConfig = {
  id: "v3",
  label: "System Online",
  durationInFrames: DURATION.v3,
  beats: {
    descendStart: 14,
    seat: 46,
    waveEnd: 124,
    transformStart: 140,
    transformEnd: 200,
  },
  chipLabel: "AI",
  chipStyle: "hologram",
  traceDensity: 0.8,
  focusY: 0.55,
  focusTightness: 0.38,
  dofStrength: 1.15,
  palette: {
    background: "#05070a",
    board: 0x0d1013,
    boardRoughness: 0.55,
    boardMetalness: 0.22,
    traceDark: 0x1a2028,
    traceHot: 0x2fb8ff,
    traceEdge: 0x8fe0ff,
    components: [0x14181d, 0x0f1216, 0x1a1f25, 0x111418, 0x181d23],
    componentRoughness: 0.62,
    componentMetalness: 0.25,
    componentHeight: 1.05,
    socket: 0xb6bcc4,
    socketRoughness: 0.28,
    chipBody: 0x0c1014,
    chipTop: 0x1b6fa8,
    chipEmissive: 0x35c0ff,
    keyLight: 0xdceeff,
    fillLight: 0x1d5f92,
    rimLight: 0xffffff,
    ambient: 0x141e28,
    ambientIntensity: 0.8,
    env: {
      ceiling: 0xcfe6ff,
      ceilingIntensity: 1.3,
      key: 0xeaf6ff,
      keyIntensity: 2.4,
      fill: 0x1f6ba6,
      fillIntensity: 1.2,
      floor: 0x0b0e12,
      floorIntensity: 0.4,
    },
    envIntensity: 0.85,
    bloomThreshold: 0.76,
    bloomStrength: 0.85,
    vignette: 0.46,
    grain: 0.045,
  },
};

export const VARIANTS: Record<VariantId, VariantConfig> = { v1: V1, v2: V2, v3: V3 };
