// Dynamic camera-facing sprites for rings, dotted data lines and packets:
// rewritten every frame from pure functions of the frame number.
import * as THREE from "three";
import { hexToLinear } from "../../lib/color";

export const SPRITE = { ring: 0, dot: 1, packet: 2, icon: 3, disc: 4 } as const;

export class SpriteBuffer {
  geo = new THREE.InstancedBufferGeometry();
  a: Float32Array; // centre xyz, size (world)
  b: Float32Array; // kind, alpha, aspect, spare
  n = 0;
  mesh: THREE.Mesh;
  constructor(public max: number, color: string, haze: string, opts: { depthTest?: boolean; extraFrag?: string } = {}) {
    this.geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    this.geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.a = new Float32Array(max * 4);
    this.b = new Float32Array(max * 4);
    this.geo.setAttribute("aA", new THREE.InstancedBufferAttribute(this.a, 4));
    this.geo.setAttribute("aB", new THREE.InstancedBufferAttribute(this.b, 4));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthTest: opts.depthTest ?? true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        uRight: { value: new THREE.Vector3(1, 0, 0) },
        uUp: { value: new THREE.Vector3(0, 1, 0) },
        uColor: { value: new THREE.Vector3(...hexToLinear(color)) },
        uHaze: { value: new THREE.Vector3(...hexToLinear(haze)) },
        uCam: { value: new THREE.Vector3() },
        uFog: { value: new THREE.Vector2(100, 300) },
      },
      vertexShader: /* glsl */ `
precision highp float;
in vec3 position;
in vec4 aA;
in vec4 aB;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 uRight;
uniform vec3 uUp;
out vec2 vUv;
out vec4 vB;
out vec3 vWorld;
void main() {
  vec3 w = aA.xyz + (uRight * position.x * aB.z + uUp * position.y) * aA.w;
  vWorld = aA.xyz;
  vUv = position.xy * vec2(aB.z, 1.0);
  vB = aB;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`,
      fragmentShader: /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform vec3 uHaze;
uniform vec3 uCam;
uniform vec2 uFog;
in vec2 vUv;
in vec4 vB;
in vec3 vWorld;
out vec4 outColor;
${opts.extraFrag ?? "vec4 extraSprite(vec2 p, float kind) { return vec4(0.0); }"}
void main() {
  int kind = int(vB.x + 0.5);
  vec2 p = vUv;
  float d;
  float aa;
  vec4 c = vec4(uColor, 1.0);
  if (kind == ${SPRITE.ring}) {
    d = abs(length(p) - 0.4) - 0.085;
  } else if (kind == ${SPRITE.dot}) {
    d = length(p) - 0.45;
  } else if (kind == ${SPRITE.packet}) {
    vec2 q = abs(p) - vec2(0.38);
    d = max(q.x, q.y);
  } else {
    vec4 e = extraSprite(p, vB.x);
    if (e.a <= 0.0) discard;
    float f = smoothstep(uFog.x, uFog.y, length(vWorld - uCam));
    outColor = vec4(mix(e.rgb, uHaze, f * f) * e.a * vB.y, e.a * vB.y);
    return;
  }
  aa = 0.7 * length(fwidth(p)) + 1e-5;
  float cov = (1.0 - smoothstep(-aa, aa, d)) * vB.y;
  if (cov <= 0.0) discard;
  float f = smoothstep(uFog.x, uFog.y, length(vWorld - uCam));
  vec3 col = mix(c.rgb, uHaze, f * f);
  outColor = vec4(col * cov, cov);
}`,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
  }
  get material() {
    return this.mesh.material as THREE.RawShaderMaterial;
  }
  reset() {
    this.n = 0;
  }
  push(p: THREE.Vector3, size: number, kind: number, alpha: number, aspect = 1) {
    if (this.n >= this.max || alpha <= 0) return;
    this.a.set([p.x, p.y, p.z, size], this.n * 4);
    this.b.set([kind, alpha, aspect, 0], this.n * 4);
    this.n++;
  }
  commit() {
    (this.geo.getAttribute("aA") as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute("aB") as THREE.BufferAttribute).needsUpdate = true;
    this.geo.instanceCount = this.n;
  }
}
