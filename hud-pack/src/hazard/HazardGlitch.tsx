import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { mulberry32 } from "../lib/random";
import { Stage } from "../lib/stage";
import { HazardVersion, hexToLinear } from "../versions";
import { HAZARD_FRAG, HAZARD_VERT } from "./shader";

const LEN = 600;

// Seeded glitch schedule: 6 events on a schedule that divides the 600-frame loop
// (one slot every 100 frames, jittered inside its slot), 3-8 frames each.
const makeSchedule = (seed: number) => {
  const rng = mulberry32(seed * 7919);
  const a: THREE.Vector4[] = [];
  const b: THREE.Vector4[] = [];
  for (let i = 0; i < 6; i++) {
    const start = i * 100 + 12 + Math.floor(rng() * 70);
    const dur = 3 + Math.floor(rng() * 6);
    const y = -0.4 + rng() * 0.8;
    const hh = 0.03 + rng() * 0.09;
    a.push(new THREE.Vector4(start, dur, y, hh));
    const shift = (rng() < 0.5 ? -1 : 1) * (4 + Math.floor(rng() * 14));
    const split = 1 + Math.floor(rng() * 2);
    b.push(new THREE.Vector4(shift, split, Math.floor(rng() * 1000), 0));
  }
  return { a, b };
};

const v3 = (hex: string) => new THREE.Vector3(...hexToLinear(hex));

const HazardScene: React.FC<{ v: HazardVersion; frame: number }> = ({ v, frame }) => {
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const mat = useMemo(() => {
    const sched = makeSchedule(v.seed);
    const rng = mulberry32(v.seed * 31 + 5);
    // streaks: y, thickness, cycles per loop (integer), phase
    const streak = [
      new THREE.Vector4(-0.36, 0.035, 2, rng()),
      new THREE.Vector4(-0.32, 0.006, 3, rng()),
      new THREE.Vector4(0.44, 0.014, 1, rng()),
      new THREE.Vector4(0.12, 0.004, 2, rng()),
    ];
    const sa = hexToLinear(v.streak_a);
    const sb = hexToLinear(v.streak_b);
    const streakC = [
      new THREE.Vector4(sa[0] * 0.8, sa[1] * 0.7, sa[2] * 0.6, 1.4),
      new THREE.Vector4(0.6, 0.45, 0.2, 0.8),
      new THREE.Vector4(sb[0] * 0.25, sb[1] * 0.25, sb[2] * 0.25, 1.0),
      new THREE.Vector4(0.07, 0.065, 0.08, 0.9),
    ];
    return new THREE.ShaderMaterial({
      vertexShader: HAZARD_VERT,
      fragmentShader: HAZARD_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uFrame: { value: 0 },
        uLen: { value: LEN },
        uAspect: { value: 16 / 9 },
        uPx: { value: 1 / 2160 },
        uSymbol: { value: v.symbol === "radiation" ? 0 : 1 },
        uSymCol: { value: v3(v.symbol_color) },
        uSymEdge: { value: v3(v.symbol_edge) },
        uGlowCol: { value: v3(v.glow) },
        uBgCol: { value: v3(v.bg) },
        uBgHot: { value: v3(v.bg_hot) },
        uStreakA: { value: v3(v.streak_a) },
        uStreakB: { value: v3(v.streak_b) },
        uHaze: { value: v3(v.haze) },
        uGlA: { value: sched.a },
        uGlB: { value: sched.b },
        uStreak: { value: streak },
        uStreakC: { value: streakC },
      },
    });
  }, [v]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    return g;
  }, []);

  useLayoutEffect(() => {
    mat.uniforms.uFrame.value = frame;
    mat.uniforms.uAspect.value = size.width / size.height;
    mat.uniforms.uPx.value = 1 / (size.height * gl.getPixelRatio());
  }, [frame, mat, size, gl]);

  return <mesh geometry={geo} material={mat} frustumCulled={false} />;
};

export const HazardGlitch: React.FC<{ v: HazardVersion }> = ({ v }) => {
  const raw = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  void durationInFrames;
  const frame = ((raw % LEN) + LEN) % LEN;
  return (
    <Stage
      post={{
        frame,
        exposure: 1.1,
        bloomStrength: 0.75,
        bloomThreshold: 0.3,
        bloomRadius: 1.0,
        focusDistance: 0,
        focusRange: 0.001,
        maxBlur: 0.0042,
        vignette: 0.55,
        blackLift: [0.006, 0.0035, 0.0012],
        saturation: 1.08,
        msaa: 0,
      }}
    >
      <HazardScene v={v} frame={frame} />
    </Stage>
  );
};
