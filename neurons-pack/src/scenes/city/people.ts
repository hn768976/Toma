// ~3,000 tiny figures as camera-facing sprites, drawn by an SDF silhouette
// with a 4-frame walk on twos. Walkers pace out and back along a short
// line once per 600 frames, so the crowd loops exactly.
import * as THREE from "three";
import { hexToLinear } from "../../lib/color";
import { mulberry32, range } from "../../lib/random";

export type Person = { x: number; z: number; dir: number; amp: number; phase: number; scale: number; walk: number; seed: number };

export const LOOP = 600;

export const makeCrowd = (n: number, area: { x: [number, number]; z: [number, number] }, seed: number): Person[] => {
  const rng = mulberry32(seed);
  const out: Person[] = [];
  for (let i = 0; i < n; i++) {
    const walk = rng() < 0.72 ? 1 : 0;
    out.push({
      x: range(rng, area.x[0], area.x[1]),
      z: range(rng, area.z[0], area.z[1]),
      dir: rng() * Math.PI * 2,
      amp: walk ? range(rng, 4, 10) : 0,
      phase: rng(),
      scale: range(rng, 0.85, 1.15),
      walk,
      seed: rng(),
    });
  }
  return out;
};

/** Same position as the shader computes, for attaching rings and lines. */
export const personPos = (p: Person, frame: number): THREE.Vector3 => {
  const u = (((p.phase + frame / LOOP) % 1) + 1) % 1;
  const tri = 1 - Math.abs(2 * u - 1);
  const off = p.amp * (tri - 0.5) * 2;
  return new THREE.Vector3(p.x + Math.cos(p.dir) * off, 0, p.z + Math.sin(p.dir) * off);
};

export const PERSON_H = 3.1;

export const makeCrowdMesh = (people: Person[], color: string, haze: string) => {
  const quad = new THREE.InstancedBufferGeometry();
  quad.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3));
  quad.setIndex([0, 1, 2, 0, 2, 3]);
  const a = new Float32Array(people.length * 4);
  const b = new Float32Array(people.length * 4);
  people.forEach((p, i) => {
    a.set([p.x, p.z, p.dir, p.amp], i * 4);
    b.set([p.phase, p.scale, p.walk, p.seed], i * 4);
  });
  quad.setAttribute("aA", new THREE.InstancedBufferAttribute(a, 4));
  quad.setAttribute("aB", new THREE.InstancedBufferAttribute(b, 4));
  quad.instanceCount = people.length;
  quad.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    alphaToCoverage: true,
    uniforms: {
      uFrame: { value: 0 },
      uRight: { value: new THREE.Vector3(1, 0, 0) },
      uCam: { value: new THREE.Vector3() },
      uFog: { value: new THREE.Vector2(100, 300) },
      uColor: { value: new THREE.Vector3(...hexToLinear(color)) },
      uHaze: { value: new THREE.Vector3(...hexToLinear(haze)) },
      uH: { value: PERSON_H },
    },
    vertexShader: /* glsl */ `
precision highp float;
in vec3 position;
in vec4 aA; // x, z, dir, amp
in vec4 aB; // phase, scale, walk, seed
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float uFrame;
uniform vec3 uRight;
uniform float uH;
out vec2 vUv;
out float vPose;
out vec3 vWorld;
void main() {
  float u = fract(aB.x + uFrame / ${LOOP.toFixed(1)});
  float tri = 1.0 - abs(2.0 * u - 1.0);
  vec2 dir = vec2(cos(aA.z), sin(aA.z));
  vec2 p = aA.xy + dir * aA.w * (tri - 0.5) * 2.0;
  // Face the way they walk (left or right on screen).
  vec3 move = vec3(dir.x, 0.0, dir.y) * (u < 0.5 ? 1.0 : -1.0);
  float face = dot(move, uRight) >= 0.0 ? 1.0 : -1.0;
  float h = uH * aB.y;
  vec3 w = vec3(p.x, 0.0, p.y) + uRight * position.x * h * 0.62 + vec3(0.0, position.y * h, 0.0);
  vWorld = w;
  vUv = vec2((position.x * face) + 0.5, position.y);
  // Walk on twos: pose changes every 2 frames, 4 poses per stride.
  vPose = aB.z > 0.5 ? mod(floor(uFrame / 2.0) + floor(aB.w * 4.0), 4.0) : -1.0;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`,
    fragmentShader: /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform vec3 uHaze;
uniform vec3 uCam;
uniform vec2 uFog;
in vec2 vUv;
in float vPose;
in vec3 vWorld;
out vec4 outColor;
float capsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
void main() {
  // Silhouette in a 0.62 x 1 box (x scaled to square units).
  vec2 p = vec2((vUv.x - 0.5) * 0.62, vUv.y);
  float legA = 0.0, armA = 0.0;
  if (vPose >= 0.0) {
    int k = int(vPose + 0.5);
    legA = k == 0 ? 0.42 : k == 1 ? 0.12 : k == 2 ? -0.42 : -0.12;
    armA = -legA * 0.8;
  }
  vec2 hip = vec2(0.0, 0.47);
  vec2 sh = vec2(0.0, 0.76);
  float d = length(p - vec2(0.012, 0.9)) - 0.075;
  d = min(d, capsule(p, hip, sh, 0.075));
  float L = 0.44;
  d = min(d, capsule(p, hip, hip + L * vec2(sin(legA), -cos(legA)), 0.042));
  d = min(d, capsule(p, hip, hip + L * vec2(sin(-legA), -cos(-legA)), 0.042));
  float A = 0.33;
  d = min(d, capsule(p, sh, sh + A * vec2(sin(armA), -cos(armA)), 0.034));
  d = min(d, capsule(p, sh, sh + A * vec2(sin(-armA), -cos(-armA)), 0.034));
  float aa = 0.6 * length(fwidth(p)) + 1e-5;
  float cov = 1.0 - smoothstep(-aa, aa, d);
  if (cov <= 0.0) discard;
  float dist = length(vWorld - uCam);
  float f = smoothstep(uFog.x, uFog.y, dist);
  f = f * f * (3.0 - 2.0 * f);
  outColor = vec4(mix(uColor, uHaze, f), cov);
}`,
  });
  const mesh = new THREE.Mesh(quad, mat);
  mesh.frustumCulled = false;
  return mesh;
};
