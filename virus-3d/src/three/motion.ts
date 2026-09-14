import { Easing, interpolate, random } from "remotion";
import type { Look } from "../looks";

export type WorldMotion = {
  /** progress 0..1 through the shot */
  p: number;
  /** seconds elapsed — the only time source any shader is allowed to use */
  t: number;
  groupPos: [number, number, number];
  groupRot: [number, number, number];
  heroRot: [number, number, number];
};

const EASE = Easing.bezier(0.37, 0, 0.63, 1);

export const useWorldMotion = (
  look: Look,
  frame: number,
  fps: number,
): WorldMotion => {
  const last = Math.max(look.durationInFrames - 1, 1);
  const p = frame / last;
  const t = frame / fps;

  const lerp = (range: [number, number]) =>
    interpolate(p, [0, 1], range, { easing: EASE });

  const { cam, hero } = look;

  // The camera is fixed; the world moves. Same result on screen, and it keeps
  // every transform declarative (no camera mutation during render).
  const x = lerp(cam.panX) + Math.sin(t * 0.21) * 0.035;
  const y = lerp(cam.panY) + Math.sin(t * 0.17 + 1.1) * 0.03;
  const z = lerp(cam.dollyZ);

  const rotY = lerp(cam.orbitY);
  const rotZ = cam.roll * Math.sin(t * 0.23);

  return {
    p,
    t,
    groupPos: [x, y, z],
    groupRot: [Math.sin(t * 0.13) * 0.02, rotY, rotZ],
    heroRot: [
      hero.tilt[0] + Math.sin(t * 0.19) * 0.05,
      hero.tilt[1] + frame * hero.spin,
      hero.tilt[2] + Math.cos(t * 0.16) * 0.04,
    ],
  };
};

export type SwarmMember = {
  basePos: [number, number, number];
  scale: number;
  spin: number;
  phase: number;
  axis: [number, number, number];
  driftSeed: number;
  dim: number;
};

export const buildSwarm = (look: Look, seed: string): SwarmMember[] => {
  const s = look.swarm;
  return new Array(s.count).fill(0).map((_, i) => {
    const r = (k: string) => random(`${seed}-${look.id}-${i}-${k}`);
    return {
      basePos: [
        (r("x") - 0.5) * s.spreadX,
        (r("y") - 0.5) * s.spreadY,
        -0.8 - r("z") * s.spreadZ,
      ] as [number, number, number],
      scale: s.scale[0] + r("s") * (s.scale[1] - s.scale[0]),
      spin: (r("sp") - 0.5) * 0.006,
      phase: r("ph") * Math.PI * 2,
      axis: [r("ax") * 2 - 1, r("ay") * 2 - 1, r("az") * 2 - 1] as [
        number,
        number,
        number,
      ],
      driftSeed: r("d"),
      dim: 0.55 + r("dim") * 0.6,
    };
  });
};

export const swarmTransform = (m: SwarmMember, t: number, drift: number) => {
  const pos: [number, number, number] = [
    m.basePos[0] + Math.sin(t * 0.23 + m.phase) * drift,
    m.basePos[1] + Math.cos(t * 0.19 + m.phase * 1.7) * drift * 0.8,
    m.basePos[2] + Math.sin(t * 0.14 + m.phase * 0.6) * drift * 0.5,
  ];
  const rot: [number, number, number] = [
    m.axis[0] * 2 + t * m.spin * 12,
    m.axis[1] * 2 + t * m.spin * 18,
    m.axis[2] * 2,
  ];
  return { pos, rot };
};
