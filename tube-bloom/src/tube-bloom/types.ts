import type { ClusterParams } from "./cluster";

type Vec3 = [number, number, number];

export type Look = {
  background: { top: string; bottom: string }; // sRGB hex
  colors: {
    start: string; // tube colour at its trailing end
    mid: string;
    end: string; // tube colour at its leading end
    cap: string; // cut face at the leading end
    startCap: string; // cut face at the trailing end
    shade: string; // distant rings fade towards this
    gradient: [number, number, number];
  };
  material: {
    roughness: number;
    metalness: number;
    clearcoat: number;
    clearcoatRoughness: number;
    iridescence: number;
    iridescenceIOR: number;
    envIntensity: number;
    specularColor?: string; // tint of the dielectric specular reflection
  };
  envRotation: Vec3;
  envTint?: string; // multiplies the studio environment's colours
  lights: {
    ambient: { color: string; intensity: number };
    directional: { color: string; intensity: number; direction: Vec3 }[];
    // Rectangular area lights: long soft-box reflections give tubes one
    // continuous specular streak instead of a point highlight.
    area?: {
      color: string;
      intensity: number;
      size: [number, number];
      position: Vec3;
      lookAt: Vec3;
    }[];
  };
  // Distance fog; `max` caps its strength so distant objects keep a trace
  // of their own shading instead of turning into flat fog-coloured shapes.
  // `nearFade` [start, end]: objects closer than `start` are black, fading
  // in by `end` — lets rings enter a flow loop unseen on a black background.
  fog?: { color: string; near: number; far: number; max: number; nearFade?: [number, number] };
  exposure: number;
  knee: number;
  vignette: number;
  grain: number;
};

export type Shot = {
  position: Vec3;
  target: Vec3;
  up?: Vec3;
  fov: number;
  focusDistance: number;
  // Blur radius (as a fraction of frame height) per unit of |1/zf - 1/z|.
  aperture: number;
  maxBlur: number; // fraction of frame height
};

export type SceneSpec = {
  look: Look;
  cluster: ClusterParams;
  motion: {
    center: Vec3;
    orientation: Vec3; // Euler XYZ of the cluster axis
    loopFrames: number; // frames per seamless cycle
    spinDirection: 1 | -1;
    wobble: [number, number]; // radians
    // Whole tube spacings each ring advances per loop (default 1). Any
    // integer keeps the loop seamless.
    spins?: number;
    writhe?: number; // radians of independent per-ring rocking (non-flow)
    // Helical "screw" flow down an exponential horn. All rings are identical
    // (`count` tubes, built at y = 0 with phase i * phaseStep); each frame
    // ring i is placed at continuous index u = i - frontRings + frac, scaled
    // by scaleRatio^u and pushed down the axis, so ring i slides into ring
    // i+1's place `spacingsPerLoop` times per loop. `extraTurns` adds whole
    // tube spacings of spin per loop.
    flow?: {
      spacing: number;
      phaseStep: number;
      count: number;
      extraTurns: number;
      spacingsPerLoop: number;
      scaleRatio: number;
      frontRings: number;
      // Per-ring brightness by flow index u: fade in from black over
      // `fadeIn`, then sink towards the shade colour over `sink`.
      ringFade?: { fadeIn: [number, number]; sink: [number, number]; sinkMax: number };
    };
  };
  shot: (frame: number, fps: number) => Shot;
  quality: { radScale1080: number };
};
