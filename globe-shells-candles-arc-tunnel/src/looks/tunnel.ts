import * as THREE from "three";
import { z } from "zod";
import { LookFactory } from "../gl/GLStage";
import { pointsFrom, spriteMaterial } from "../gl/points";
import { hexToRgb, TAU } from "../lib/loop";
import { mulberry32 } from "../lib/random";

export const tunnelSchema = z.object({
  dotFar: z.string(),
  dotNear: z.string(),
  glow: z.string(),
  glowCore: z.string(),
  corners: z.string(),
  background: z.string(),
});
export type TunnelProps = z.infer<typeof tunnelSchema>;

// Layout: elliptical rings every 0.125 along -z, 96 fixed angular slots (dense
// rings + fewer slots make the dots read as radial spokes, as in the reference).
// The seed pattern repeats every K = 128 rings, and the camera travels exactly
// K * 0.125 = 16 units per loop, so the view at frame 600 is the view at 0.
const RX = 3.0;
const RY = 2.2;
const SPACING = 0.125;
const SLOTS = 96;
const K = 128;
const PERIODS = 5; // 640 rings drawn: covers 64+ units ahead at every frame
const TRAVEL = K * SPACING;
const FOV = 52;

type Layout = { pos: Float32Array; tw: Float32Array; size: Float32Array };
let cached: Layout | null = null;
const layout = (): Layout => {
  if (cached) return cached;
  const rng = mulberry32(0x7a11e1);
  // One period of pattern: per (ring, slot) occupancy, jitter, twinkle, size.
  const pattern: { on: boolean; jit: number; amp: number; cyc: number; ph: number; s: number }[][] = [];
  for (let r = 0; r < K; r++) {
    const ringJit = 1 + (rng() - 0.5) * 0.06;
    const row = [];
    for (let s = 0; s < SLOTS; s++) {
      const on = rng() > 0.35;
      const tw = rng() < 0.1;
      row.push({
        on,
        jit: ringJit * (1 + (rng() - 0.5) * 0.012),
        amp: tw ? 2.5 + rng() * 3 : 0,
        cyc: 1 + Math.floor(rng() * 4),
        ph: rng(),
        s: 0.75 + rng() * 0.5,
      });
    }
    pattern.push(row);
  }
  const pos: number[] = [];
  const tw: number[] = [];
  const size: number[] = [];
  for (let i = 0; i < K * PERIODS; i++) {
    const row = pattern[i % K];
    for (let s = 0; s < SLOTS; s++) {
      const p = row[s];
      if (!p.on) continue;
      const a = (s / SLOTS) * TAU;
      pos.push(Math.cos(a) * RX * p.jit, Math.sin(a) * RY * p.jit, -i * SPACING);
      tw.push(p.amp, p.cyc, p.ph);
      size.push(p.s);
    }
  }
  cached = { pos: new Float32Array(pos), tw: new Float32Array(tw), size: new Float32Array(size) };
  return cached;
};

const VERT = /* glsl */ `
attribute vec3 aTw;
attribute float aSize;
uniform vec3 uFar;
uniform vec3 uNear;
uniform float uGain;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = -mv.z;
  if (dist < 0.3) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vColor = vec3(0.); vSoft = 0.; return; }
  vec3 col = mix(uFar, uNear, smoothstep(16.0, 3.0, dist)) * (1.0 + 0.5 * smoothstep(9.0, 3.0, dist));
  float tw = 1.0 + aTw.x * pow(0.5 + 0.5 * sin(TAU * (aTw.y * uTime + aTw.z)), 10.0);
  float fade = smoothstep(60.0, 22.0, dist) * smoothstep(0.3, 1.5, dist);
  sprite(mv, 0.03 * aSize * (1.0 + 1.2 * smoothstep(10.0, 3.0, dist)), col * tw * fade * uGain);
}
`;

export const makeTunnel =
  (p: TunnelProps): LookFactory =>
  (ctx) => {
    const L = layout();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, ctx.width / ctx.height, 0.05, 200);
    const mat = spriteMaterial(
      VERT,
      {
        uFar: { value: new THREE.Vector3(...hexToRgb(p.dotFar)) },
        uNear: { value: new THREE.Vector3(...hexToRgb(p.dotNear)) },
        uGain: { value: 0.85 },
      },
      { px: ctx.px, height: ctx.height, fovDeg: FOV, focus: 16, aperture: 9, maxPx: 120 },
    );
    scene.add(
      pointsFrom(
        {
          position: { array: L.pos, size: 3 },
          aTw: { array: L.tw, size: 3 },
          aSize: { array: L.size, size: 1 },
        },
        mat,
      ),
    );
    const glow = hexToRgb(p.glow);
    const core = hexToRgb(p.glowCore);
        const post = {
      background: hexToRgb(p.background),
      glows: [
        { center: [0.5, 0.47] as [number, number], radius: [0.42, 0.26] as [number, number], color: glow, strength: 0.7, falloff: 4 },
        { center: [0.5, 0.47] as [number, number], radius: [0.2, 0.13] as [number, number], color: core, strength: 0.06, falloff: 2 },
      ],
      bloomStrength: 0.7,
      vignette: 1.0,
      vignetteColor: hexToRgb(p.corners),
      grain: 0.02,
    };
    return {
      scene,
      camera,
      post,
      update: (f) => {
        const t = f / 600;
        camera.position.set(0.15 * Math.sin(TAU * t), 0.15 * 0.6 * Math.sin(TAU * t + Math.PI / 2), -TRAVEL * t);
        camera.lookAt(camera.position.x, camera.position.y, camera.position.z - 1);
        camera.updateMatrixWorld();
        mat.uniforms.uTime.value = t;
        const breathe = 1 + 0.08 * Math.sin(TAU * 2 * t);
        post.glows[0].strength = 0.7 * breathe;
        post.glows[1].strength = 0.06 * (1 + 0.06 * Math.sin(TAU * 2 * t + 0.7));
      },
      dispose: () => {
        mat.dispose();
      },
    };
  };
