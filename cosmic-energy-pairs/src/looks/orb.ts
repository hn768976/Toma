import * as THREE from "three";
import { OrbColours } from "../colourways";
import { lin } from "../lib/color";
import { NOISE } from "../lib/glsl";
import { PostPipeline, PostSettings, rawMat } from "../lib/pipeline";
import { mulberry32 } from "../lib/random";
import { FrameInfo, Look } from "../lib/Stage";

/**
 * LOOK 2 — Plasma Energy Orb (20 s loop, 600 frames, on pure black).
 *
 * Loop design:
 *  - Ribbon deformation = 4D simplex noise sampled at (p.xy, p.z + r·cos 2πt, r·sin 2πt):
 *    the time coordinates travel a closed circle, so t = 1 equals t = 0.
 *  - Each ribbon slides along its own path a whole number of turns (±1).
 *  - The whole orb turns exactly once around its tilted axis; the inner mesh
 *    turns twice the other way.
 */

export const ORB_LOOP = 600;
export const ORB_POST: PostSettings = {
  bloomStrength: 1.35,
  bloomRadius: 0.7,
  bloomThreshold: 0.05,
  exposure: 1.0,
  grain: 0,
  pureBlack: true,
};

const RIBBONS = 18;
const SEGS = 220;
const ACROSS = 6;

const ROT = /* glsl */ `
uniform float uT;
uniform vec3 uAxis;
vec3 rotAxis(vec3 p, vec3 k, float a) {
  float c = cos(a), s = sin(a);
  return p * c + cross(k, p) * s + k * dot(k, p) * (1.0 - c);
}
`;

const RIBBON_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 uCamPos;
${ROT}
${NOISE}
in vec3 position; // unused (basis U)
in vec3 aV3;
in vec4 aRib;   // x: latitude δ, y: a0, z: arc length, w: slide turns (whole number)
in vec4 aRib2;  // x: width, y: twist phase, z: seed, w: brightness
in vec2 aSV;    // s along (0..1), v across (-1..1)
out vec2 vSV;
out vec3 vWorld;
out float vBright;
out float vFront;

float n4(vec3 p, float seed) {
  float th = 6.28318530718 * uT;
  return snoise4(vec4(p.xy + seed, p.z + 0.85 * cos(th), 0.85 * sin(th) + seed * 0.37));
}

void main() {
  vec3 U = position;
  vec3 V = aV3;
  vec3 W = cross(U, V);
  float s = aSV.x;
  float a = aRib.y + aRib.z * s + 6.28318530718 * aRib.w * uT;
  float cd = cos(aRib.x), sd = sin(aRib.x);
  vec3 P0 = cd * (cos(a) * U + sin(a) * V) + sd * W;
  vec3 T = normalize(-sin(a) * U + cos(a) * V);
  vec3 B = normalize(cross(P0, T));

  float seed = aRib2.z;
  vec3 q = P0 * 1.15;
  float dx = n4(q, seed);
  float dy = n4(q, seed + 11.3);
  float dz = n4(q * 1.7, seed + 23.9);
  vec3 P = P0 + T * dx * 0.28 + B * dy * 0.42;
  P = normalize(P) * (1.0 + dz * 0.07);

  // Twist the band between lying on the sphere and standing out of it.
  float tw = aRib2.y + 2.2 * n4(q * 0.8, seed + 37.1);
  vec3 N = normalize(P);
  vec3 cross_ = normalize(cos(tw) * B + sin(tw) * N);
  float taper = pow(sin(3.14159265 * s), 0.65);
  float w = aRib2.x * taper * (0.65 + 0.35 * n4(q * 2.3, seed + 51.7));
  vec3 pos = P + cross_ * aSV.y * w;
  // Fold: the band curls outwards towards one edge.
  pos += N * (aSV.y * aSV.y) * w * 0.35 * dz;

  pos = rotAxis(pos, uAxis, 6.28318530718 * uT);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  vWorld = pos;
  vSV = aSV;
  vBright = aRib2.w;
  vFront = dot(normalize(pos), normalize(uCamPos));
}
`;

const RIBBON_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uRibbon;
uniform vec3 uHi;
uniform vec3 uCamPos;
in vec2 vSV;
in vec3 vWorld;
in float vBright;
in float vFront;
out vec4 outColor;
void main() {
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  vec3 vd = normalize(uCamPos - vWorld);
  float facing = abs(dot(n, vd));
  // Edge-on parts of the sheet pile up light (like a real glowing film).
  float sheet = clamp(0.22 / (0.12 + facing), 0.0, 2.4);
  float av = abs(vSV.y);
  float edge = pow(av, 7.0) * 1.6 + 0.18;
  float fadeAlong = smoothstep(0.0, 0.12, vSV.x) * smoothstep(1.0, 0.82, vSV.x);
  float fadeAcross = 1.0 - smoothstep(0.86, 1.0, av);
  float back = mix(0.38, 1.0, smoothstep(-0.6, 0.4, vFront));
  float k = 1.9 * edge * sheet * fadeAlong * fadeAcross * back * vBright;
  vec3 col = uRibbon * k + uHi * max(k - 1.2, 0.0) * 1.2;
  outColor = vec4(col, 1.0);
}
`;

const MESH_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 uCamPos;
${ROT}
in vec3 position;
in vec2 uv;
out vec2 vUv;
out float vFront;
void main() {
  vec3 p = rotAxis(position, normalize(vec3(0.15, 1.0, -0.1)), -6.28318530718 * 2.0 * uT);
  vUv = uv;
  vFront = dot(normalize(p), normalize(uCamPos));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const MESH_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uMesh;
uniform float uPx;
in vec2 vUv;
in float vFront;
out vec4 outColor;
float gridLine(float x, float n) {
  float g = x * n;
  float d = abs(fract(g - 0.5) - 0.5) / fwidth(g);
  return 1.0 - clamp(d / (0.7 * uPx), 0.0, 1.0);
}
void main() {
  float lon = gridLine(vUv.x, 64.0);
  float lat = gridLine(vUv.y, 32.0);
  float pole = smoothstep(0.02, 0.12, min(vUv.y, 1.0 - vUv.y));
  float g = max(lon * pole, lat);
  // Dotted look: brighter at the crossings.
  float dots = lon * lat;
  float back = mix(0.25, 1.0, smoothstep(-0.5, 0.5, vFront));
  outColor = vec4(uMesh * (g * 0.05 + dots * 0.12) * back, 1.0);
}
`;

const HALO_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const HALO_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uHalo;
uniform float uScale;
in vec2 vUv;
out vec4 outColor;
void main() {
  float r = length(vUv) * uScale; // in orb radii
  // Limb-brightened ring + soft outer falloff, compact support (exact zero beyond 2.3 R).
  float ring = exp(-pow((r - 0.98) / 0.16, 2.0));
  float outer = exp(-max(r - 0.95, 0.0) * 3.2);
  float inner = smoothstep(0.5, 1.0, r) * 0.05;
  float c = ring * 0.32 + outer * 0.12 * step(0.95, r) + inner * step(r, 0.95);
  c *= 1.0 - smoothstep(1.6, 2.3, r);
  outColor = vec4(uHalo * c, 1.0);
}
`;

const buildRibbons = () => {
  const rng = mulberry32(0x0b5e);
  const vertsPer = (SEGS + 1) * (ACROSS + 1);
  const total = vertsPer * RIBBONS;
  const U = new Float32Array(total * 3);
  const V = new Float32Array(total * 3);
  const rib = new Float32Array(total * 4);
  const rib2 = new Float32Array(total * 4);
  const sv = new Float32Array(total * 2);
  const idx: number[] = [];
  let k = 0;
  for (let r = 0; r < RIBBONS; r++) {
    // Random orthonormal basis.
    const u = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
    const tmp = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1);
    const v = tmp.sub(u.clone().multiplyScalar(tmp.dot(u))).normalize();
    const lat = (rng() * 2 - 1) * 0.55;
    const a0 = rng() * Math.PI * 2;
    const len = Math.PI * (0.55 + rng() * 0.9);
    const slide = rng() < 0.5 ? -1 : 1;
    const width = 0.08 + rng() * 0.2;
    const twist = rng() * Math.PI * 2;
    const seed = rng() * 40;
    const bright = 0.55 + rng() * 0.75;
    const start = k;
    for (let i = 0; i <= SEGS; i++) {
      for (let j = 0; j <= ACROSS; j++) {
        U.set([u.x, u.y, u.z], k * 3);
        V.set([v.x, v.y, v.z], k * 3);
        rib.set([lat, a0, len, slide], k * 4);
        rib2.set([width, twist, seed, bright], k * 4);
        sv.set([i / SEGS, (j / ACROSS) * 2 - 1], k * 2);
        k++;
      }
    }
    for (let i = 0; i < SEGS; i++) {
      for (let j = 0; j < ACROSS; j++) {
        const a = start + i * (ACROSS + 1) + j;
        const b = a + ACROSS + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(U, 3));
  g.setAttribute("aV3", new THREE.BufferAttribute(V, 3));
  g.setAttribute("aRib", new THREE.BufferAttribute(rib, 4));
  g.setAttribute("aRib2", new THREE.BufferAttribute(rib2, 4));
  g.setAttribute("aSV", new THREE.BufferAttribute(sv, 2));
  g.setIndex(idx);
  return g;
};

let RIBBON_GEO: THREE.BufferGeometry | null = null;

export class OrbLook implements Look {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
  uniforms: Record<string, THREE.IUniform>;

  constructor(c: OrbColours) {
    const dist = 8.45;
    this.camera.position.set(0, 0, dist);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    this.uniforms = {
      uT: { value: 0 },
      uPx: { value: 1 },
      uAxis: { value: new THREE.Vector3(0.25, 1, 0.12).normalize() },
      uCamPos: { value: this.camera.position.clone() },
    };
    const add = { blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide };

    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 4.6),
      rawMat(HALO_FRAG, { uHalo: { value: lin(c.halo) }, uScale: { value: 2.3 } }, add, HALO_VERT),
    );
    halo.renderOrder = 0;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 96, 48),
      rawMat(MESH_FRAG, { ...this.uniforms, uMesh: { value: lin(c.mesh) } }, add, MESH_VERT),
    );
    mesh.renderOrder = 1;

    const ribbons = new THREE.Mesh(
      (RIBBON_GEO ??= buildRibbons()),
      rawMat(RIBBON_FRAG, { ...this.uniforms, uRibbon: { value: lin(c.ribbon) }, uHi: { value: lin(c.highlight) } }, add, RIBBON_VERT),
    );
    ribbons.frustumCulled = false;
    ribbons.renderOrder = 2;
    this.scene.add(halo, mesh, ribbons);
  }

  render(gl: THREE.WebGLRenderer, _pipe: PostPipeline, f: FrameInfo) {
    this.camera.aspect = f.width / f.height;
    this.camera.updateProjectionMatrix();
    this.uniforms.uT.value = f.frame / ORB_LOOP;
    this.uniforms.uPx.value = f.px;
    gl.render(this.scene, this.camera);
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
    });
  }
}
