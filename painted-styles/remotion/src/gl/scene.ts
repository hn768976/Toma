import { Easing } from "remotion";
import manifest from "../manifest.json";

export type LayerDraw = { src: string; uniforms: Record<string, number | number[]> };
export type Scene = {
  draws: (frame: number) => LayerDraw[];
  finalUniforms: (frame: number) => Record<string, number | number[]>;
};
export type StyleManifest = {
  key: string;
  prefix: string;
  name: string;
  canvas: [number, number];
  bleed: [number, number];
  horizon: number;
  boatPivot: [number, number];
  layers: { group: string; src: string }[];
  drawon: { frames: string[] } | null;
};
export const STYLES = manifest.styles as unknown as StyleManifest[];

export const FPS = 30;
export const LOOP_FRAMES = 600;          // one full cycle; compositions are 601 frames so 600 can be checked against 0
export const DRAWON_FRAMES = 360;        // 0-9 s painting, 9-12 s hold
const TAU = Math.PI * 2;

type Motion = {
  cam: number;                           // camera swing amplitude (px at 4K), one cosine cycle per loop
  depth: Record<string, number>;         // parallax factor per layer group
  waterAmp: number;                      // water shimmer displacement at the bottom edge (px)
  mistDrift: number;                     // px per loop
  cloudDrift: number;
  boatAngle: number;                     // rad
  boatLift: number;                      // px
  boatCycles: number;
  birdsWrap: boolean;
  fx: number;                            // 1 = stained-glass light sweep
};

const DEPTH = { sky: 0.04, clouds: 0.1, far: 0.22, near: 0.5, fore: 1.0, mist: 0.55, boat: 0.72, boat_refl: 0.72, birds: 0.3, reeds: 1.0 };
const BASE: Motion = {
  cam: 120, depth: DEPTH, waterAmp: 5, mistDrift: 520, cloudDrift: 260,
  boatAngle: 0.018, boatLift: 5, boatCycles: 4, birdsWrap: true, fx: 0,
};
export const MOTION: Record<string, Motion> = {
  watercolour: BASE,
  artdeco: { ...BASE, waterAmp: 6 },
  linocut: { ...BASE, waterAmp: 4 },
  // a leaded window is one flat panel: keep parallax small and let light do the work
  stainedglass: { ...BASE, cam: 48, waterAmp: 0, mistDrift: 300, boatAngle: 0.01, boatLift: 3, fx: 1 },
  // ink wash: mist only, everything else perfectly still
  inkwash: { ...BASE, cam: 0, waterAmp: 0, mistDrift: 360, cloudDrift: 0, boatAngle: 0, boatLift: 0, birdsWrap: false },
};

const loopDraws = (s: StyleManifest, m: Motion, u: number, still = false): LayerDraw[] => {
  const camX = m.cam * Math.sin(TAU * u);
  const th = TAU * u;
  const base = { uCanvas: s.canvas, uBleed: s.bleed, uTheta: th };
  return s.layers.map(({ group, src }) => {
    const d = m.depth[group] ?? 0.5;
    const off = [camX * d, 0];
    let uniforms: Record<string, number | number[]> = { ...base, uMode: 0, uOff: off };
    if (group === "water") {
      uniforms = { ...base, uMode: 1, uOff: [camX * m.depth.near, 0], uOff2: [camX * m.depth.fore, 0],
        uHorizon: s.horizon, uBottom: 2160, uAmp: still ? 0 : m.waterAmp };
    } else if (group === "mist" || group === "clouds") {
      const drift = group === "mist" ? m.mistDrift : m.cloudDrift;
      uniforms = { ...base, uMode: 2, uOff: off, uDrift: [drift * u, drift * (u - 1)], uWeight: [1 - u, u] };
    } else if (group === "boat" || group === "boat_refl") {
      const sgn = group === "boat" ? 1 : -1;
      const ph = TAU * m.boatCycles * u;
      uniforms = { ...base, uMode: 4, uOff: off, uPivot: s.boatPivot,
        uAngle: sgn * m.boatAngle * Math.sin(ph), uShift: [0, -sgn * m.boatLift * Math.sin(ph + 0.6)] };
    } else if (group === "birds" && m.birdsWrap) {
      uniforms = { ...base, uMode: 3, uOff: [off[0], 6 * Math.sin(TAU * 3 * u)], uDrift: [-s.canvas[0] * u, 0] };
    }
    return { src, uniforms };
  });
};

export const loopScene = (s: StyleManifest): Scene => {
  const m = MOTION[s.key];
  return {
    draws: (frame) => loopDraws(s, m, frame / LOOP_FRAMES),
    finalUniforms: (frame) => ({ uFx: m.fx, uSweep: -1400 + (3840 * 0.8 + 2160 * 0.6 + 2800) * (frame / LOOP_FRAMES) }),
  };
};

const paintEase = Easing.bezier(0.42, 0, 0.38, 1);
export const drawOnScene = (s: StyleManifest): Scene => {
  const m = MOTION[s.key];
  const frames = s.drawon!.frames;
  const n = frames.length;
  const img = (src: string, opacity: number): LayerDraw => ({ src, uniforms: { uMode: 5, uCanvas: [3840, 2160], uOpacity: opacity } });
  return {
    draws: (frame) => {
      const t = frame / FPS;
      if (t < 9) {
        const x = paintEase(Math.min(1, t / 9)) * (n - 1);
        const i = Math.min(n - 2, Math.floor(x));
        const f = Math.min(1, x - i);
        return [img(frames[i], 1), img(frames[i + 1], f)];
      }
      // hold: the layered painting with only the mist moving, fading in from the last stage frame
      const h = (t - 9) / 3;
      const k = Easing.inOut(Easing.quad)(Math.min(1, (t - 9) / 0.6));
      const still = loopDraws(s, { ...m, cam: 0, boatAngle: 0, boatLift: 0, birdsWrap: false }, 0, true).map((d) =>
        d.src.endsWith("_mist.png")
          ? { ...d, uniforms: { ...d.uniforms, uDrift: [m.mistDrift * 0.3 * h * h, 0], uWeight: [1, 0] } }
          : d,
      );
      return [...still, img(frames[n - 1], 1 - k)];
    },
    finalUniforms: () => ({ uFx: 0, uSweep: 0 }),
  };
};
