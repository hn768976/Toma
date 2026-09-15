export type Vec3 = [number, number, number];

export type RenderMode = "surface" | "points" | "hologram";

export interface Look {
  id: string;
  name: string;
  reference: string;
  /** Duration of the source reference in seconds; compositions run at 30fps. */
  refSeconds: number;
  durationInFrames: number;

  bg: {
    /** Full-frame CSS background (gradient stack). */
    css: string;
    /** Colour the 3D depth-fade fades toward. Must visually match `css`. */
    fog: string;
    fogNear: number;
    fogFar: number;
    vignette: number;
    vignetteColor: string;
    grain: number;
  };

  /** Additive backlight bloom behind the hero (CSS, screen-blended). */
  bloom: {
    color: string;
    x: number;
    y: number;
    size: number;
    opacity: number;
    pulse: number;
  };

  mat: {
    capsid: string;
    spike: string;
    spikeStart: number;
    spikeEnd: number;
    tipGlow: number;
    rimColor: string;
    rimPower: number;
    rimStrength: number;
    sssColor: string;
    sss: number;
    specular: number;
    shininess: number;
    bump: number;
    noiseScale: number;
    mottle: number;
    ambientColor: string;
    ambient: number;
    keyColor: string;
    keyDir: Vec3;
    key: number;
    fillColor: string;
    fillDir: Vec3;
    fill: number;
    /** 0 = hard terminator, 1 = half-lambert. High values read as soft tissue. */
    wrap: number;
  };

  /** See-through shell settings, used when mode is "hologram". */
  holo: {
    /** Opacity of faces pointing straight at the camera. */
    base: number;
    /** Falloff exponent toward the silhouette. */
    power: number;
    /** "add" on dark plates; "normal" on light ones, where additive blows out. */
    blend: "add" | "normal";
  };

  mode: RenderMode;

  points: {
    size: number;
    opacity: number;
    colorA: string;
    colorB: string;
    /** Outward dispersal distance at full dissolve (0 = never dissolves). */
    disperse: number;
    jitter: number;
    dissolveStart: number;
    dissolveEnd: number;
    /** Draw a dim solid shell under the points. */
    shell: number;
  };

  hero: {
    pos: Vec3;
    scale: number;
    tilt: Vec3;
    spin: number;
  };

  /** Camera is static; the world group moves. Values are world translations. */
  cam: {
    fov: number;
    dollyZ: [number, number];
    panX: [number, number];
    panY: [number, number];
    orbitY: [number, number];
    roll: number;
  };

  /** Defocused virus swarm, rendered at half res behind a CSS blur. */
  swarm: {
    count: number;
    blur: number;
    opacity: number;
    spreadX: number;
    spreadY: number;
    spreadZ: number;
    scale: [number, number];
    drift: number;
  };

  /** Foreground out-of-focus blobs (CSS — they are pure bokeh). */
  near: {
    count: number;
    blur: number;
    opacity: number;
    size: [number, number];
    color: string;
    drift: number;
  };

  /** Floating specks / bokeh dust. */
  dust: {
    count: number;
    color: string;
    opacity: number;
    size: [number, number];
    drift: number;
    twinkle: number;
  };

  /** Low-poly connection graph (refs 04 / 05). */
  network: {
    enabled: boolean;
    color: string;
    opacity: number;
    nodes: number;
    dashes: number;
    dashColor: string;
  };

  grade: {
    contrast: number;
    saturate: number;
    brightness: number;
  };
}

const base = {
  bg: { fogNear: 6, fogFar: 26, vignetteColor: "#000000" },
  holo: { base: 0.35, power: 2.0, blend: "normal" as const },
  points: {
    size: 0.015,
    opacity: 0.9,
    colorA: "#8fd8ff",
    colorB: "#ffffff",
    disperse: 0,
    jitter: 0.01,
    dissolveStart: 0,
    dissolveEnd: 1,
    shell: 0,
  },
  network: {
    enabled: false,
    color: "#ffffff",
    opacity: 0,
    nodes: 0,
    dashes: 0,
    dashColor: "#ffffff",
  },
};

export const LOOKS: Look[] = [
  // 01 — deep navy, magenta-cored hero, cyan spike tips, heavy defocus swarm
  {
    id: "v01",
    name: "Deep Navy Hero",
    reference: "istockphoto-2248309812",
    refSeconds: 10.0,
    durationInFrames: 300,
    bg: {
      css:
        "radial-gradient(120% 90% at 62% 46%, #16337a 0%, #0c1e52 34%, #050d2c 66%, #01030f 100%)",
      fog: "#050e2a",
      fogNear: 7,
      fogFar: 24,
      vignette: 0.72,
      vignetteColor: "#000208",
      grain: 0.05,
    },
    bloom: { color: "#c0389b", x: 54, y: 43, size: 36, opacity: 0.38, pulse: 0.1 },
    mat: {
      capsid: "#0e1c4e",
      spike: "#3fd2ff",
      spikeStart: 0.78,
      spikeEnd: 0.95,
      tipGlow: 0.55,
      rimColor: "#ff5a9e",
      rimPower: 3.2,
      rimStrength: 1.05,
      sssColor: "#ff4f93",
      sss: 0.42,
      specular: 0.75,
      shininess: 42,
      bump: 0.55,
      noiseScale: 13,
      mottle: 0.3,
      ambientColor: "#22407f",
      ambient: 0.34,
      keyColor: "#9fc6ff",
      keyDir: [-0.55, 0.45, 0.7],
      key: 1.05,
      fillColor: "#2a4ea8",
      fillDir: [0.7, -0.3, -0.6],
      fill: 0.55,
      wrap: 0.3,
    },
    holo: { base: 0.35, power: 2.0, blend: "normal" as const },
    mode: "surface",
    points: base.points,
    hero: { pos: [0.55, 0.05, 0], scale: 1.25, tilt: [0.25, 0.5, -0.12], spin: 0.0022 },
    cam: {
      fov: 38,
      dollyZ: [0, 0.75],
      panX: [0.18, -0.12],
      panY: [-0.06, 0.05],
      orbitY: [-0.1, 0.16],
      roll: 0.01,
    },
    swarm: {
      count: 9,
      blur: 16,
      opacity: 0.9,
      spreadX: 5.2,
      spreadY: 3.0,
      spreadZ: 4.5,
      scale: [0.55, 1.5],
      drift: 0.16,
    },
    near: {
      count: 3,
      blur: 46,
      opacity: 0.5,
      size: [330, 620],
      color: "#0f2a66",
      drift: 0.22,
    },
    dust: {
      count: 44,
      color: "#9dc2ff",
      opacity: 0.35,
      size: [1.5, 4],
      drift: 0.1,
      twinkle: 0.4,
    },
    network: base.network,
    grade: { contrast: 1.1, saturate: 1.16, brightness: 1.0 },
  },

  // 02 — bright clinical blue, white bloom, low-contrast pale swarm
  {
    id: "v02",
    name: "Clinical Blue",
    reference: "istockphoto-2262127445",
    refSeconds: 10.0,
    durationInFrames: 300,
    bg: {
      css:
        "radial-gradient(115% 95% at 63% 44%, #eaf2ff 0%, #b9d0f4 26%, #7fa5e6 56%, #5b84d6 100%)",
      fog: "#a8c4ee",
      fogNear: 6,
      fogFar: 22,
      vignette: 0.22,
      vignetteColor: "#3b62b4",
      grain: 0.025,
    },
    bloom: { color: "#ffffff", x: 62, y: 42, size: 52, opacity: 0.46, pulse: 0.07 },
    mat: {
      capsid: "#4470cf",
      spike: "#cfe1ff",
      spikeStart: 0.78,
      spikeEnd: 0.95,
      tipGlow: 0.2,
      rimColor: "#ffffff",
      rimPower: 2.8,
      rimStrength: 0.95,
      sssColor: "#dbe9ff",
      sss: 0.7,
      specular: 0.45,
      shininess: 26,
      bump: 0.4,
      noiseScale: 12,
      mottle: 0.2,
      ambientColor: "#b7cff5",
      ambient: 0.9,
      keyColor: "#ffffff",
      keyDir: [0.3, 0.5, 0.8],
      key: 0.85,
      fillColor: "#8fb2ea",
      fillDir: [-0.6, -0.2, -0.5],
      fill: 0.6,
      wrap: 0.45,
    },
    holo: { base: 0.35, power: 2.0, blend: "normal" as const },
    mode: "surface",
    points: base.points,
    hero: { pos: [0.5, -0.02, 0], scale: 1.32, tilt: [-0.18, 0.3, 0.1], spin: 0.0024 },
    cam: {
      fov: 40,
      dollyZ: [0, 0.45],
      panX: [-0.2, 0.22],
      panY: [0.04, -0.05],
      orbitY: [0.08, -0.12],
      roll: -0.008,
    },
    swarm: {
      count: 11,
      blur: 13,
      opacity: 0.62,
      spreadX: 5.6,
      spreadY: 3.2,
      spreadZ: 4.8,
      scale: [0.5, 1.35],
      drift: 0.18,
    },
    near: {
      count: 3,
      blur: 42,
      opacity: 0.34,
      size: [300, 560],
      color: "#8fb0e2",
      drift: 0.2,
    },
    dust: {
      count: 22,
      color: "#ffffff",
      opacity: 0.22,
      size: [2, 5],
      drift: 0.08,
      twinkle: 0.25,
    },
    network: base.network,
    grade: { contrast: 1.02, saturate: 1.05, brightness: 1.03 },
  },

  // 03 — CDC crimson: bone capsid, red spikes, maroon depth
  {
    id: "v03",
    name: "Crimson Clinical",
    reference: "istockphoto-1217649829",
    refSeconds: 16.67,
    durationInFrames: 500,
    bg: {
      css:
        "radial-gradient(120% 100% at 34% 45%, #5a0a10 0%, #300509 32%, #130203 66%, #040001 100%)",
      fog: "#3a060a",
      fogNear: 6,
      fogFar: 22,
      vignette: 0.78,
      vignetteColor: "#100002",
      grain: 0.06,
    },
    bloom: { color: "#ff5c46", x: 34, y: 40, size: 66, opacity: 0.34, pulse: 0.09 },
    mat: {
      capsid: "#ded6cb",
      spike: "#c5162a",
      spikeStart: 0.79,
      spikeEnd: 0.94,
      tipGlow: 0.08,
      rimColor: "#ff8a6a",
      rimPower: 3.4,
      rimStrength: 0.7,
      sssColor: "#ff6a52",
      sss: 0.6,
      specular: 0.18,
      shininess: 12,
      bump: 0.3,
      noiseScale: 11,
      mottle: 0.22,
      ambientColor: "#4a1416",
      ambient: 0.3,
      keyColor: "#fff0e2",
      keyDir: [-0.35, 0.6, 0.72],
      key: 1.2,
      fillColor: "#8a2420",
      fillDir: [0.65, -0.25, -0.55],
      fill: 0.5,
      wrap: 0.85,
    },
    holo: { base: 0.35, power: 2.0, blend: "normal" as const },
    mode: "surface",
    points: base.points,
    hero: { pos: [-0.35, -0.12, 0], scale: 1.05, tilt: [0.12, -0.4, 0.08], spin: 0.0018 },
    cam: {
      fov: 36,
      dollyZ: [-0.3, 0.9],
      panX: [-0.15, 0.3],
      panY: [0.08, -0.1],
      orbitY: [0.1, -0.2],
      roll: 0.012,
    },
    swarm: {
      count: 10,
      blur: 15,
      opacity: 0.95,
      spreadX: 5.4,
      spreadY: 3.1,
      spreadZ: 4.6,
      scale: [0.6, 1.5],
      drift: 0.14,
    },
    near: {
      count: 4,
      blur: 50,
      opacity: 0.4,
      size: [340, 700],
      color: "#5e0c13",
      drift: 0.18,
    },
    dust: {
      count: 40,
      color: "#ffb9a3",
      opacity: 0.3,
      size: [1.5, 4],
      drift: 0.09,
      twinkle: 0.35,
    },
    network: base.network,
    grade: { contrast: 1.12, saturate: 1.1, brightness: 1.0 },
  },

  // 04 — dark teal macro: dotted surface at frame-left, network graph, copy space right
  {
    id: "v04",
    name: "Macro Teal Data",
    reference: "istockphoto-1308357363",
    refSeconds: 15.02,
    durationInFrames: 451,
    bg: {
      css:
        "radial-gradient(110% 120% at 12% 50%, #07303a 0%, #04202a 30%, #021018 62%, #000508 100%)",
      fog: "#02121a",
      fogNear: 5,
      fogFar: 20,
      vignette: 0.6,
      vignetteColor: "#000306",
      grain: 0.05,
    },
    bloom: { color: "#25e0c8", x: 14, y: 50, size: 52, opacity: 0.3, pulse: 0.08 },
    mat: {
      capsid: "#0d5c62",
      spike: "#b6fff0",
      spikeStart: 0.76,
      spikeEnd: 0.94,
      tipGlow: 0.5,
      rimColor: "#5ffbe0",
      rimPower: 3.0,
      rimStrength: 0.9,
      sssColor: "#2ce8cc",
      sss: 0.45,
      specular: 0.5,
      shininess: 34,
      bump: 0.6,
      noiseScale: 16,
      mottle: 0.3,
      ambientColor: "#0a3a44",
      ambient: 0.3,
      keyColor: "#d7fff7",
      keyDir: [0.35, 0.5, 0.78],
      key: 0.95,
      fillColor: "#0f5a66",
      fillDir: [-0.7, -0.2, -0.5],
      fill: 0.45,
      wrap: 0.4,
    },
    holo: { base: 0.16, power: 1.7, blend: "add" as const },
    mode: "hologram",
    points: {
      size: 0.009,
      opacity: 1.0,
      colorA: "#9ffbe6",
      colorB: "#eafff9",
      disperse: 0,
      jitter: 0.012,
      dissolveStart: 0,
      dissolveEnd: 1,
      shell: 0.3,
    },
    hero: { pos: [-2.0, 0.05, 0.2], scale: 2.4, tilt: [0.1, 0.2, 0.05], spin: 0.0011 },
    cam: {
      fov: 42,
      dollyZ: [0, 0.22],
      panX: [0.05, -0.05],
      panY: [-0.18, 0.16],
      orbitY: [-0.06, 0.08],
      roll: 0.004,
    },
    swarm: {
      count: 3,
      blur: 22,
      opacity: 0.45,
      spreadX: 3.0,
      spreadY: 2.6,
      spreadZ: 5.0,
      scale: [0.4, 0.8],
      drift: 0.12,
    },
    near: { count: 2, blur: 55, opacity: 0.3, size: [300, 520], color: "#06343c", drift: 0.16 },
    dust: {
      count: 90,
      color: "#a9fff0",
      opacity: 0.42,
      size: [1, 3],
      drift: 0.14,
      twinkle: 0.55,
    },
    network: {
      enabled: true,
      color: "#2fb9b0",
      opacity: 0.36,
      nodes: 16,
      dashes: 14,
      dashColor: "#5ef2dd",
    },
    grade: { contrast: 1.12, saturate: 1.1, brightness: 1.0 },
  },

  // 05 — light twin of 04: pale grey-blue, white dotted virus, faint graph
  {
    id: "v05",
    name: "Macro Light Data",
    reference: "istockphoto-1308355965",
    refSeconds: 15.02,
    durationInFrames: 451,
    bg: {
      css:
        "linear-gradient(112deg, #93a7bd 0%, #b9c8d8 34%, #dde5ec 68%, #f2f5f8 100%)",
      fog: "#c8d5e2",
      fogNear: 5,
      fogFar: 20,
      vignette: 0.16,
      vignetteColor: "#5d7398",
      grain: 0.03,
    },
    bloom: { color: "#ffffff", x: 74, y: 44, size: 60, opacity: 0.5, pulse: 0.05 },
    mat: {
      capsid: "#63809d",
      spike: "#ffffff",
      spikeStart: 0.76,
      spikeEnd: 0.94,
      tipGlow: 0.18,
      rimColor: "#ffffff",
      rimPower: 3.0,
      rimStrength: 0.85,
      sssColor: "#dfe9f4",
      sss: 0.45,
      specular: 0.4,
      shininess: 28,
      bump: 0.55,
      noiseScale: 16,
      mottle: 0.25,
      ambientColor: "#c3d2e2",
      ambient: 0.8,
      keyColor: "#ffffff",
      keyDir: [0.4, 0.5, 0.75],
      key: 0.9,
      fillColor: "#8ea6c0",
      fillDir: [-0.7, -0.2, -0.45],
      fill: 0.55,
      wrap: 0.5,
    },
    holo: { base: 0.3, power: 1.9, blend: "normal" as const },
    mode: "hologram",
    points: {
      size: 0.009,
      opacity: 0.95,
      colorA: "#ffffff",
      colorB: "#cfe0f2",
      disperse: 0,
      jitter: 0.012,
      dissolveStart: 0,
      dissolveEnd: 1,
      shell: 0.38,
    },
    hero: { pos: [-2.0, 0.05, 0.2], scale: 2.4, tilt: [0.1, 0.2, 0.05], spin: 0.0011 },
    cam: {
      fov: 42,
      dollyZ: [0, 0.22],
      panX: [0.05, -0.05],
      panY: [-0.18, 0.16],
      orbitY: [-0.06, 0.08],
      roll: 0.004,
    },
    swarm: {
      count: 3,
      blur: 22,
      opacity: 0.35,
      spreadX: 3.0,
      spreadY: 2.6,
      spreadZ: 5.0,
      scale: [0.4, 0.8],
      drift: 0.12,
    },
    near: { count: 2, blur: 55, opacity: 0.22, size: [300, 520], color: "#9db0c6", drift: 0.16 },
    dust: {
      count: 70,
      color: "#ffffff",
      opacity: 0.5,
      size: [1, 3],
      drift: 0.14,
      twinkle: 0.5,
    },
    network: {
      enabled: true,
      color: "#ffffff",
      opacity: 0.42,
      nodes: 16,
      dashes: 14,
      dashColor: "#ffffff",
    },
    grade: { contrast: 1.0, saturate: 1.0, brightness: 1.02 },
  },

  // 06 — backlit bio green swarm on near-black
  {
    id: "v06",
    name: "Bio Green",
    reference: "istockphoto-2249957548",
    refSeconds: 9.04,
    durationInFrames: 271,
    bg: {
      css:
        "radial-gradient(105% 95% at 52% 48%, #12391a 0%, #0a2412 32%, #04120a 64%, #000603 100%)",
      fog: "#06180c",
      fogNear: 6,
      fogFar: 22,
      vignette: 0.6,
      vignetteColor: "#000603",
      grain: 0.05,
    },
    bloom: { color: "#9dff4a", x: 52, y: 47, size: 46, opacity: 0.4, pulse: 0.12 },
    mat: {
      capsid: "#6fbf2e",
      spike: "#c9ff6b",
      spikeStart: 0.74,
      spikeEnd: 0.93,
      tipGlow: 0.42,
      rimColor: "#d8ff7a",
      rimPower: 2.9,
      rimStrength: 1.0,
      sssColor: "#b6ff5c",
      sss: 0.95,
      specular: 0.4,
      shininess: 24,
      bump: 0.5,
      noiseScale: 14,
      mottle: 0.3,
      ambientColor: "#1b4a1f",
      ambient: 0.3,
      keyColor: "#eaffc9",
      keyDir: [-0.15, 0.35, 0.9],
      key: 0.85,
      fillColor: "#2f7a2c",
      fillDir: [0.6, -0.3, -0.6],
      fill: 0.45,
      wrap: 0.4,
    },
    holo: { base: 0.35, power: 2.0, blend: "normal" as const },
    mode: "surface",
    points: base.points,
    hero: { pos: [0.22, 0.0, 0], scale: 0.92, tilt: [0.15, 0.25, -0.08], spin: 0.0032 },
    cam: {
      fov: 42,
      dollyZ: [0, 0.4],
      panX: [0.3, -0.28],
      panY: [-0.05, 0.06],
      orbitY: [-0.08, 0.1],
      roll: 0.008,
    },
    swarm: {
      count: 14,
      blur: 12,
      opacity: 0.85,
      spreadX: 6.0,
      spreadY: 3.4,
      spreadZ: 5.0,
      scale: [0.4, 1.1],
      drift: 0.24,
    },
    near: { count: 3, blur: 44, opacity: 0.45, size: [280, 520], color: "#1c5a1e", drift: 0.26 },
    dust: {
      count: 30,
      color: "#c7ff87",
      opacity: 0.25,
      size: [1.5, 4],
      drift: 0.12,
      twinkle: 0.4,
    },
    network: base.network,
    grade: { contrast: 1.14, saturate: 1.2, brightness: 1.0 },
  },

  // 07 — mint microscope field, heavy defocus, long drifting take
  {
    id: "v07",
    name: "Mint Microscope",
    reference: "istockphoto-1212544935",
    refSeconds: 29.96,
    durationInFrames: 899,
    bg: {
      css:
        "radial-gradient(130% 110% at 68% 34%, #49b49b 0%, #2b8477 30%, #1b5460 62%, #10303c 100%)",
      fog: "#2a7f76",
      fogNear: 6,
      fogFar: 24,
      vignette: 0.62,
      vignetteColor: "#06202a",
      grain: 0.07,
    },
    bloom: { color: "#a8f0d8", x: 66, y: 32, size: 70, opacity: 0.35, pulse: 0.06 },
    mat: {
      capsid: "#d7f2e2",
      spike: "#f2fff8",
      spikeStart: 0.72,
      spikeEnd: 0.92,
      tipGlow: 0.14,
      rimColor: "#ffffff",
      rimPower: 3.1,
      rimStrength: 0.8,
      sssColor: "#bff0dd",
      sss: 0.6,
      specular: 0.3,
      shininess: 20,
      bump: 0.75,
      noiseScale: 20,
      mottle: 0.35,
      ambientColor: "#3f9a8c",
      ambient: 0.62,
      keyColor: "#ffffff",
      keyDir: [0.25, 0.6, 0.75],
      key: 0.8,
      fillColor: "#2f8a7e",
      fillDir: [-0.6, -0.3, -0.5],
      fill: 0.5,
      wrap: 0.55,
    },
    holo: { base: 0.35, power: 2.0, blend: "normal" as const },
    mode: "surface",
    points: base.points,
    hero: { pos: [-0.55, -0.3, 0], scale: 0.8, tilt: [0.2, 0.35, 0.1], spin: 0.0026 },
    cam: {
      fov: 44,
      dollyZ: [-0.2, 0.5],
      panX: [0.35, -0.4],
      panY: [-0.25, 0.3],
      orbitY: [-0.14, 0.18],
      roll: 0.01,
    },
    swarm: {
      count: 16,
      blur: 18,
      opacity: 0.8,
      spreadX: 6.4,
      spreadY: 3.6,
      spreadZ: 5.4,
      scale: [0.45, 1.2],
      drift: 0.2,
    },
    near: { count: 4, blur: 52, opacity: 0.42, size: [320, 640], color: "#2e8e80", drift: 0.2 },
    dust: {
      count: 70,
      color: "#ffffff",
      opacity: 0.4,
      size: [1.5, 4],
      drift: 0.16,
      twinkle: 0.5,
    },
    network: base.network,
    grade: { contrast: 1.06, saturate: 0.95, brightness: 1.02 },
  },

  // 08 — violet/cyan particle hero on starfield
  {
    id: "v08",
    name: "Violet Particle Hero",
    reference: "istockphoto-1251512321",
    refSeconds: 15.02,
    durationInFrames: 451,
    bg: {
      css:
        "radial-gradient(110% 100% at 40% 52%, #131a52 0%, #0a0e34 32%, #05061c 64%, #01020a 100%)",
      fog: "#05071e",
      fogNear: 6,
      fogFar: 22,
      vignette: 0.62,
      vignetteColor: "#01020a",
      grain: 0.05,
    },
    bloom: { color: "#5a48d8", x: 38, y: 50, size: 56, opacity: 0.42, pulse: 0.09 },
    mat: {
      capsid: "#2b2f80",
      spike: "#9a6cf0",
      spikeStart: 0.76,
      spikeEnd: 0.94,
      tipGlow: 0.5,
      rimColor: "#cf7bff",
      rimPower: 3.0,
      rimStrength: 0.95,
      sssColor: "#7f5bff",
      sss: 0.5,
      specular: 0.16,
      shininess: 11,
      bump: 0.18,
      noiseScale: 8,
      mottle: 0.18,
      ambientColor: "#1a1f56",
      ambient: 0.3,
      keyColor: "#cfd8ff",
      keyDir: [-0.6, 0.4, 0.7],
      key: 0.9,
      fillColor: "#3d55c0",
      fillDir: [0.7, -0.2, -0.5],
      fill: 0.45,
      wrap: 0.8,
    },
    holo: { base: 0.14, power: 1.8, blend: "add" as const },
    mode: "hologram",
    points: {
      size: 0.011,
      opacity: 0.9,
      colorA: "#c07bff",
      colorB: "#6fd0ff",
      disperse: 0,
      jitter: 0.014,
      dissolveStart: 0,
      dissolveEnd: 1,
      shell: 0.18,
    },
    hero: { pos: [-0.85, -0.05, 0], scale: 1.85, tilt: [0.18, 0.4, -0.06], spin: 0.0018 },
    cam: {
      fov: 40,
      dollyZ: [0, 0.35],
      panX: [0.1, -0.14],
      panY: [-0.08, 0.1],
      orbitY: [-0.1, 0.14],
      roll: 0.006,
    },
    swarm: {
      count: 2,
      blur: 26,
      opacity: 0.3,
      spreadX: 4.0,
      spreadY: 2.6,
      spreadZ: 5.0,
      scale: [0.4, 0.7],
      drift: 0.1,
    },
    near: { count: 2, blur: 60, opacity: 0.25, size: [300, 560], color: "#161a52", drift: 0.14 },
    dust: {
      count: 150,
      color: "#b9c8ff",
      opacity: 0.55,
      size: [1, 2.6],
      drift: 0.1,
      twinkle: 0.7,
    },
    network: base.network,
    grade: { contrast: 1.14, saturate: 1.18, brightness: 1.0 },
  },

  // 09 — particle dissolve, camera flies through the cloud
  {
    id: "v09",
    name: "Particle Dissolve Flythrough",
    reference: "istockphoto-1329035209",
    refSeconds: 7.04,
    durationInFrames: 211,
    bg: {
      css:
        "radial-gradient(120% 100% at 50% 50%, #0d3b78 0%, #08275a 30%, #041637 62%, #010714 100%)",
      fog: "#04163a",
      fogNear: 5,
      fogFar: 22,
      vignette: 0.58,
      vignetteColor: "#010714",
      grain: 0.05,
    },
    bloom: { color: "#2f7fd8", x: 50, y: 50, size: 70, opacity: 0.45, pulse: 0.14 },
    mat: {
      capsid: "#14417e",
      spike: "#7fd4ff",
      spikeStart: 0.76,
      spikeEnd: 0.94,
      tipGlow: 0.5,
      rimColor: "#8fdcff",
      rimPower: 3.0,
      rimStrength: 1.0,
      sssColor: "#4fa8ff",
      sss: 0.5,
      specular: 0.5,
      shininess: 30,
      bump: 0.5,
      noiseScale: 15,
      mottle: 0.3,
      ambientColor: "#0d2e5e",
      ambient: 0.3,
      keyColor: "#dbefff",
      keyDir: [-0.4, 0.45, 0.8],
      key: 0.95,
      fillColor: "#1f5aa8",
      fillDir: [0.6, -0.25, -0.5],
      fill: 0.45,
      wrap: 0.35,
    },
    holo: { base: 0.35, power: 2.0, blend: "normal" as const },
    mode: "points",
    points: {
      size: 0.014,
      opacity: 0.78,
      colorA: "#2f6ea8",
      colorB: "#5b9ed0",
      disperse: 4.2,
      jitter: 0.02,
      dissolveStart: 0.26,
      dissolveEnd: 0.95,
      shell: 0.92,
    },
    hero: { pos: [0.35, 0.06, 0], scale: 1.35, tilt: [0.15, 0.3, -0.05], spin: 0.0028 },
    cam: {
      fov: 46,
      dollyZ: [-0.4, 4.6],
      panX: [0.1, -0.35],
      panY: [-0.05, 0.18],
      orbitY: [-0.08, 0.22],
      roll: 0.02,
    },
    swarm: {
      count: 5,
      blur: 20,
      opacity: 0.5,
      spreadX: 4.6,
      spreadY: 2.8,
      spreadZ: 4.4,
      scale: [0.4, 0.95],
      drift: 0.2,
    },
    near: { count: 3, blur: 50, opacity: 0.35, size: [320, 600], color: "#0b2f68", drift: 0.3 },
    dust: {
      count: 190,
      color: "#a8d8ff",
      opacity: 0.55,
      size: [1.5, 5],
      drift: 0.3,
      twinkle: 0.6,
    },
    network: base.network,
    grade: { contrast: 1.1, saturate: 1.14, brightness: 1.0 },
  },

  // 10 — single hero dissolving into a drifting particle field
  {
    id: "v10",
    name: "Hero Dissolve",
    reference: "istockphoto-1329035137",
    refSeconds: 7.04,
    durationInFrames: 211,
    bg: {
      css:
        "radial-gradient(120% 100% at 46% 48%, #10498c 0%, #0a2c66 30%, #04183e 62%, #010816 100%)",
      fog: "#05193f",
      fogNear: 5,
      fogFar: 22,
      vignette: 0.56,
      vignetteColor: "#010816",
      grain: 0.05,
    },
    bloom: { color: "#3f93e8", x: 44, y: 46, size: 66, opacity: 0.5, pulse: 0.12 },
    mat: {
      capsid: "#16528f",
      spike: "#a6e2ff",
      spikeStart: 0.76,
      spikeEnd: 0.94,
      tipGlow: 0.55,
      rimColor: "#b3e8ff",
      rimPower: 2.9,
      rimStrength: 1.05,
      sssColor: "#5fb8ff",
      sss: 0.55,
      specular: 0.5,
      shininess: 30,
      bump: 0.5,
      noiseScale: 15,
      mottle: 0.3,
      ambientColor: "#0f3670",
      ambient: 0.32,
      keyColor: "#e8f6ff",
      keyDir: [-0.3, 0.5, 0.8],
      key: 1.0,
      fillColor: "#246bbd",
      fillDir: [0.6, -0.25, -0.5],
      fill: 0.45,
      wrap: 0.35,
    },
    holo: { base: 0.35, power: 2.0, blend: "normal" as const },
    mode: "points",
    points: {
      size: 0.015,
      opacity: 0.8,
      colorA: "#3779b4",
      colorB: "#66a9d8",
      disperse: 3.4,
      jitter: 0.018,
      dissolveStart: 0.3,
      dissolveEnd: 0.98,
      shell: 0.95,
    },
    hero: { pos: [-0.32, 0.05, 0], scale: 1.5, tilt: [0.12, -0.25, 0.06], spin: 0.0024 },
    cam: {
      fov: 42,
      dollyZ: [-0.2, 1.4],
      panX: [0.05, -0.3],
      panY: [-0.04, 0.1],
      orbitY: [0.06, -0.16],
      roll: -0.014,
    },
    swarm: {
      count: 3,
      blur: 24,
      opacity: 0.4,
      spreadX: 4.4,
      spreadY: 2.6,
      spreadZ: 4.6,
      scale: [0.35, 0.8],
      drift: 0.18,
    },
    near: { count: 3, blur: 54, opacity: 0.32, size: [320, 620], color: "#0d3672", drift: 0.26 },
    dust: {
      count: 170,
      color: "#bfe4ff",
      opacity: 0.55,
      size: [1.5, 4.5],
      drift: 0.26,
      twinkle: 0.6,
    },
    network: base.network,
    grade: { contrast: 1.1, saturate: 1.12, brightness: 1.0 },
  },
];

export const getLook = (id: string): Look => {
  const l = LOOKS.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown look: ${id}`);
  return l;
};
