import * as THREE from "three";
import { z } from "zod";
import { LookFactory } from "../gl/GLStage";
import { pointsFrom, spriteMaterial } from "../gl/points";
import { hexToRgb, TAU } from "../lib/loop";
import { mulberry32 } from "../lib/random";

export const shellsSchema = z.object({
  base: z.string(),
  rim: z.string(),
  accentA: z.string(),
  accentB: z.string(),
  accentC: z.string(),
  background: z.string(),
});
export type ShellsProps = z.infer<typeof shellsSchema>;

// Four nested dotted spheres. Dots sit on latitude rings with the count per
// ring proportional to its circumference, and each ring's start angle is
// advanced by a fixed step, which turns the poles into spirals.
const RADII = [1.0, 1.25, 1.55, 1.95];
const RINGS = [150, 175, 200, 220];
const FOV = 73.4;
const CAM_DIST = 2.45;

type Shell = {
  pos: Float32Array; // unit-sphere positions (pole along +y), scaled by radius
  kind: Float32Array; // 0 base, 1 accent A, 2 accent B, 3 accent C
  tw: Float32Array; // twinkle cycles, phase, size jitter
  centre: THREE.Vector3;
  tilt: THREE.Quaternion;
  swayAxis: THREE.Vector3;
  swayAmp: number;
  swayPhase: number;
};

let cache: Shell[] | null = null;
const shells = (): Shell[] => {
  if (cache) return cache;
  const rng = mulberry32(0x5e11);
  cache = RADII.map((radius, si) => {
    const nRings = RINGS[si];
    // Dot spacing along a ring ~ spacing between rings (square-ish grid), so
    // the dots stay distinct instead of merging into ring lines (~210k total).
    const c = 2 * nRings * 1.1;
    const spiralStep = 0.18 + rng() * 0.2;
    const pos: number[] = [];
    const kind: number[] = [];
    const tw: number[] = [];
    for (let k = 0; k < nRings; k++) {
      const phi = (Math.PI * (k + 0.5)) / nRings;
      const n = Math.max(3, Math.round(c * Math.sin(phi)));
      const start = k * spiralStep;
      for (let j = 0; j < n; j++) {
        const a = start + (j / n) * TAU;
        pos.push(radius * Math.sin(phi) * Math.cos(a), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(a));
        const u = rng();
        kind.push(u < 0.03 ? 1 : u < 0.04 ? 2 : u < 0.062 ? 3 : 0);
        tw.push(1 + Math.floor(rng() * 4), rng(), 0.8 + rng() * 0.4);
      }
    }
    const off = () => (rng() - 0.5) * 2 * 0.12;
    const tilt = new THREE.Quaternion().setFromEuler(
      new THREE.Euler((rng() - 0.5) * 2.6, rng() * TAU, (rng() - 0.5) * 2.6),
    );
    return {
      pos: new Float32Array(pos),
      kind: new Float32Array(kind),
      tw: new Float32Array(tw),
      centre: new THREE.Vector3(off(), off(), off()),
      tilt,
      swayAxis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
      swayAmp: ((6 + rng() * 4) * Math.PI) / 180,
      swayPhase: rng(),
    };
  });
  return cache;
};

const VERT = /* glsl */ `
attribute float aKind;
attribute vec3 aTw;
uniform vec3 uCentre;
uniform vec3 uBase;
uniform vec3 uRim;
uniform vec3 uAccA;
uniform vec3 uAccB;
uniform vec3 uAccC;
uniform float uGain;
uniform float uSize;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 n = normalize(world.xyz - uCentre);
  vec3 v = normalize(cameraPosition - world.xyz);
  float rim = 1.0 - abs(dot(n, v));
  float rimK = pow(rim, 4.0);
  // Seen edge-on, a dotted sphere piles its dots up into a hard outline;
  // dim toward the silhouette so rims stay soft bands rather than lines.
  float face = abs(dot(n, v));
  vec3 col = mix(uBase, uRim, rimK) * (0.3 + 0.7 * smoothstep(0.0, 0.45, face)) * (0.75 + 0.6 * rimK);
  float size = uSize * aTw.z;
  if (aKind > 0.5) {
    vec3 acc = aKind < 1.5 ? uAccA : (aKind < 2.5 ? uAccB : uAccC);
    float tw = 0.35 + 1.4 * pow(0.5 + 0.5 * sin(TAU * (aTw.x * uTime + aTw.y)), 4.0);
    col = acc * tw * 1.3;
    size *= 1.35;
  }
  vec4 mv = viewMatrix * world;
  sprite(mv, size, col * uGain);
}
`;

export const makeShells =
  (p: ShellsProps): LookFactory =>
  (ctx) => {
    const S = shells();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, ctx.width / ctx.height, 0.05, 100);
    const colours = {
      uBase: { value: new THREE.Vector3(...hexToRgb(p.base)) },
      uRim: { value: new THREE.Vector3(...hexToRgb(p.rim)) },
      uAccA: { value: new THREE.Vector3(...hexToRgb(p.accentA)) },
      uAccB: { value: new THREE.Vector3(...hexToRgb(p.accentB)) },
      uAccC: { value: new THREE.Vector3(...hexToRgb(p.accentC)) },
      uGain: { value: 0.5 },
      uSize: { value: 0.016 },
    };
    const mats: THREE.ShaderMaterial[] = [];
    const objs = S.map((sh) => {
      const mat = spriteMaterial(
        VERT,
        { ...colours, uCentre: { value: sh.centre.clone() } },
        { px: ctx.px, height: ctx.height, fovDeg: FOV, focus: CAM_DIST - 1.25, aperture: 26, maxPx: 90 },
      );
      mats.push(mat);
      const pts = pointsFrom(
        { position: { array: sh.pos, size: 3 }, aKind: { array: sh.kind, size: 1 }, aTw: { array: sh.tw, size: 3 } },
        mat,
      );
      pts.matrixAutoUpdate = false;
      scene.add(pts);
      return pts;
    });
    const bg = hexToRgb(p.background);
    const rimCol = hexToRgb(p.rim);
    const post = {
      background: bg,
      glows: [
        { center: [-0.02, 0.5] as [number, number], radius: [0.35, 0.6] as [number, number], color: rimCol, strength: 0.08, falloff: 2 },
        { center: [1.02, 0.5] as [number, number], radius: [0.35, 0.6] as [number, number], color: rimCol, strength: 0.08, falloff: 2 },
      ],
      bloomStrength: 0.8,
      vignette: 0.55,
      vignetteColor: bg,
      grain: 0.015,
    };
    const q = new THREE.Quaternion();
    return {
      scene,
      camera,
      post,
      update: (f) => {
        const t = f / 600;
        camera.position.set(0.12 * Math.sin(TAU * t), 0.07 * Math.cos(TAU * t), CAM_DIST);
        camera.lookAt(0.05 * Math.sin(TAU * t), 0, 0);
        camera.updateMatrixWorld();
        S.forEach((sh, i) => {
          const ang = sh.swayAmp * Math.sin(TAU * (t + sh.swayPhase));
          q.setFromAxisAngle(sh.swayAxis, ang).multiply(sh.tilt);
          objs[i].matrix.compose(sh.centre, q, new THREE.Vector3(1, 1, 1));
          objs[i].matrixWorld.copy(objs[i].matrix);
          mats[i].uniforms.uTime.value = t;
        });
      },
      dispose: () => mats.forEach((m) => m.dispose()),
    };
  };
