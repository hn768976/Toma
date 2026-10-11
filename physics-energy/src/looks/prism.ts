import * as THREE from "three";
import { Look } from "../lib/LookCanvas";
import { Post } from "../lib/post";
import { buildRibbonGeometry, ribbonMaterial } from "../lib/ribbon";
import { loopPhase, TAU } from "../lib/loop";
import { ior, spectrumSamples } from "../lib/spectrum";

/*
 * Light transport (recomputed every frame from the prism's pose):
 * a white beam (NSUB parallel sub-rays across its width) hits the prism; for
 * each of 24 wavelengths, each sub-ray is refracted at the entry face (Snell),
 * travels to the face it meets next and is split by the Fresnel equations into
 * a transmitted ray (refracted out) and a reflected one (one internal bounce,
 * total internal reflection when Snell has no solution), which then exits
 * through the next face. The entry face also reflects a faint white beam.
 * Transmission falls smoothly to zero at the critical angle, so a beam that
 * switches off by total internal reflection fades out instead of popping.
 */

type V = THREE.Vector3;
const SIDE = 1.0; // triangle side
const LENGTH = 1.25; // prism length
const INR = SIDE / (2 * Math.sqrt(3)); // inradius
const SPECTRUM = spectrumSamples(24).map((s) => ({
  ...s,
  // angular spacing between neighbouring samples grows with |dn/dlambda|
  // (largest at the violet end); widen those ribbons so the fan stays continuous
  spread: Math.abs(ior(s.lambda - 6.25) - ior(s.lambda + 6.25)),
}));
const MEAN_DN = SPECTRUM.reduce((a, s) => a + s.spread, 0) / SPECTRUM.length;
const NSUB = 7;
const BEAM_R = 0.16;
const BEAM_DIR = new THREE.Vector3(0.55, -0.82, -0.1).normalize();
const SRC_DIST = 9;

// outward face planes n.x = c in prism space (3 sides + 2 caps)
const PLANES: { n: V; c: number }[] = [
  ...[270, 30, 150].map((deg) => ({
    n: new THREE.Vector3(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 0),
    c: INR,
  })),
  { n: new THREE.Vector3(0, 0, 1), c: LENGTH / 2 },
  { n: new THREE.Vector3(0, 0, -1), c: LENGTH / 2 },
];

/** unpolarised Fresnel reflectance; n1 -> n2, cosI > 0 */
const fresnelR = (cosI: number, n1: number, n2: number) => {
  const eta = n1 / n2;
  const sin2T = eta * eta * (1 - cosI * cosI);
  if (sin2T >= 1) return 1;
  const cosT = Math.sqrt(1 - sin2T);
  const rs = (n1 * cosI - n2 * cosT) / (n1 * cosI + n2 * cosT);
  const rp = (n1 * cosT - n2 * cosI) / (n1 * cosT + n2 * cosI);
  return 0.5 * (rs * rs + rp * rp);
};

/** Snell refraction; N faces against I. Returns null on total internal reflection. */
const refract = (I: V, N: V, eta: number, out: V): V | null => {
  const cosI = -N.dot(I);
  const k = 1 - eta * eta * (1 - cosI * cosI);
  if (k < 0) return null;
  return out.copy(I).multiplyScalar(eta).addScaledVector(N, eta * cosI - Math.sqrt(k)).normalize();
};
const reflect = (I: V, N: V, out: V) => out.copy(I).addScaledVector(N, -2 * N.dot(I)).normalize();

/** entry into the convex prism: [t, plane index] or null */
const enter = (o: V, d: V): [number, number] | null => {
  let tIn = -Infinity, tOut = Infinity, face = -1;
  for (let i = 0; i < PLANES.length; i++) {
    const { n, c } = PLANES[i];
    const dn = d.dot(n), dist = c - n.dot(o);
    if (Math.abs(dn) < 1e-9) { if (dist < 0) return null; continue; }
    const t = dist / dn;
    if (dn < 0) { if (t > tIn) { tIn = t; face = i; } } else if (t < tOut) tOut = t;
  }
  return tIn < tOut && tIn > 0 ? [tIn, face] : null;
};
/** exit from inside: [t, plane index] */
const exitFace = (o: V, d: V): [number, number] => {
  let tOut = Infinity, face = 0;
  for (let i = 0; i < PLANES.length; i++) {
    const { n, c } = PLANES[i];
    const dn = d.dot(n);
    if (dn <= 1e-9) continue;
    const t = (c - n.dot(o)) / dn;
    if (t < tOut) { tOut = t; face = i; }
  }
  return [Math.max(tOut, 0), face];
};

export interface Seg { a: V; d: V; len: number; rgb: [number, number, number]; w: number; kind: number; spread?: number }
// kind: 0 incoming white, 1 out (spectral), 2 inside glass, 3 entry reflection, 4 missed beam

export const traceBeam = (q: THREE.Quaternion, out: Seg[]) => {
  out.length = 0;
  const qi = q.clone().invert();
  const perp = new THREE.Vector3().crossVectors(BEAM_DIR, new THREE.Vector3(0, 0, 1)).normalize();
  const toWorldP = (v: V) => v.clone().applyQuaternion(q);
  const sigma = 0.5 * BEAM_R;
  const wsum = Array.from({ length: NSUB }, (_, k) => Math.exp(-0.5 * (((k / (NSUB - 1)) * 2 - 1) * BEAM_R / sigma) ** 2))
    .reduce((a, b) => a + b, 0);
  for (let k = 0; k < NSUB; k++) {
    const u = ((k / (NSUB - 1)) * 2 - 1) * BEAM_R;
    const wk = Math.exp(-0.5 * (u / sigma) ** 2) / wsum;
    const oW = BEAM_DIR.clone().multiplyScalar(-SRC_DIST).addScaledVector(perp, u);
    const o = oW.clone().applyQuaternion(qi), d = BEAM_DIR.clone().applyQuaternion(qi);
    const hit = enter(o, d);
    if (!hit) {
      out.push({ a: oW, d: BEAM_DIR.clone(), len: SRC_DIST * 2.2, rgb: [1, 1, 1], w: wk, kind: 4 });
      continue;
    }
    const [tIn, fIn] = hit;
    const E = o.clone().addScaledVector(d, tIn);
    out.push({ a: oW, d: BEAM_DIR.clone(), len: tIn, rgb: [1, 1, 1], w: wk, kind: 0 });
    const Nin = PLANES[fIn].n; // outward; faces against the incoming ray
    const cosI = -Nin.dot(d);
    // partial reflection of the white beam at the entry face
    const Rin = fresnelR(cosI, 1, ior(550));
    out.push({ a: toWorldP(E), d: toWorldP(reflect(d, Nin, new THREE.Vector3())), len: 7, rgb: [1, 1, 1], w: wk * Rin, kind: 3 });
    for (const s of SPECTRUM) {
      const n = ior(s.lambda);
      const T1 = refract(d, Nin, 1 / n, new THREE.Vector3());
      if (!T1) continue;
      let energy = wk * (1 - fresnelR(cosI, 1, n));
      let P = E.clone(), D = T1.clone();
      for (let bounce = 0; bounce < 2 && energy > 1e-4; bounce++) {
        const [t, f] = exitFace(P, D);
        const X = P.clone().addScaledVector(D, t);
        out.push({ a: toWorldP(P), d: toWorldP(D), len: t, rgb: s.rgb, w: energy, kind: 2 });
        const No = PLANES[f].n;
        const cosO = No.dot(D);
        const R = fresnelR(cosO, n, 1);
        const Tout = refract(D, No.clone().negate(), n, new THREE.Vector3());
        if (Tout && R < 1) out.push({ a: toWorldP(X), d: toWorldP(Tout), len: 16, rgb: s.rgb, w: energy * (1 - R), kind: 1, spread: s.spread / MEAN_DN });
        // the reflected part continues inside (one internal bounce)
        energy *= R;
        P = X;
        D = reflect(D, No, new THREE.Vector3());
      }
    }
  }
  return out;
};

const tmpV = new THREE.Vector3();
const BEAM_VERT = /* glsl */ `
in vec3 aStart;
in vec3 aDir;
in vec2 aCorner;   // x: side -1/1, y: 0 start / 1 end
in vec4 aColor;    // rgb, intensity
in vec4 aShape;    // len, sigma0, spread, fadeLen
uniform vec3 camPos;
uniform vec3 viewDir;
out float vSide;
out float vS;
out vec4 vColor;
out float vFade;
out float vCam;
out float vLen;
void main() {
  float s = aCorner.y * aShape.x;
  vLen = aShape.x;
  vec3 P = aStart + aDir * s;
  vec3 toCam = normalize(camPos - P);
  vec3 nrm = cross(aDir, toCam);
  nrm = length(nrm) > 1e-5 ? normalize(nrm) : vec3(0.0, 1.0, 0.0);
  float sg = aShape.y + aShape.z * s;
  P += nrm * aCorner.x * sg * 4.0;
  vSide = aCorner.x * 4.0;
  vS = s;
  vColor = aColor;
  vFade = aShape.w;
  vCam = dot(P - camPos, viewDir); // view depth
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
}`;
const BEAM_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 fragColor;
in float vSide;
in float vS;
in vec4 vColor;
in float vFade;
in float vCam;
in float vLen;
void main() {
  // fade beams that come close to the camera instead of letting the near plane cut them
  float a = exp(-0.5 * vSide * vSide) * smoothstep(1.2, 4.0, vCam);
  float along = vFade > 0.0 ? exp(-vS / vFade) : 1.0;
  // every ribbon tapers out over its last quarter: no hard ends in frame
  // (beams that end on a glass surface, fade == 0, keep their crisp end)
  if (vFade > 0.0) along *= 1.0 - smoothstep(0.75 * vLen, vLen, vS);
  fragColor = vec4(vColor.rgb * vColor.a * a * along, 1.0);
}`;

class BeamBatch {
  readonly mesh: THREE.Mesh;
  private n = 0;
  private start: Float32Array; private dir: Float32Array; private col: Float32Array; private shape: Float32Array;
  private geo = new THREE.BufferGeometry();
  private view = new THREE.Vector3();
  constructor(private max: number, private camPos: V, cam: THREE.Camera) {
    cam.getWorldDirection(this.view);
    this.start = new Float32Array(max * 4 * 3);
    this.dir = new Float32Array(max * 4 * 3);
    this.col = new Float32Array(max * 4 * 4);
    this.shape = new Float32Array(max * 4 * 4);
    const corner = new Float32Array(max * 4 * 2);
    const idx = new Uint32Array(max * 6);
    for (let i = 0; i < max; i++) {
      corner.set([-1, 0, 1, 0, -1, 1, 1, 1], i * 8);
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    }
    const dyn = (a: Float32Array, k: number) => new THREE.BufferAttribute(a, k).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(max * 4 * 3), 3));
    this.geo.setAttribute("aStart", dyn(this.start, 3));
    this.geo.setAttribute("aDir", dyn(this.dir, 3));
    this.geo.setAttribute("aColor", dyn(this.col, 4));
    this.geo.setAttribute("aShape", dyn(this.shape, 4));
    this.geo.setAttribute("aCorner", new THREE.BufferAttribute(corner, 2));
    this.geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh = new THREE.Mesh(this.geo, new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
      uniforms: { camPos: { value: camPos }, viewDir: { value: this.view } },
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
  }
  begin() { this.n = 0; }
  add(a: V, d: V, len: number, rgb: ArrayLike<number>, intensity: number, sigma: number, spread: number, fade: number) {
    if (this.n >= this.max || intensity <= 1e-5) return;
    // A ray heading toward the camera stops 1 unit in front of it (the shader
    // has faded it out by then), so no vertex is ever projected from behind
    // the camera, which would cut the ribbon with a hard edge.
    const toward = -this.view.dot(d);
    if (toward > 1e-4) {
      const depth0 = tmpV.copy(a).sub(this.camPos).dot(this.view);
      len = Math.max(0, Math.min(len, (depth0 - 1.2) / toward));
      if (len <= 0) return;
    }
    for (let v = 0; v < 4; v++) {
      const o = this.n * 4 + v;
      this.start.set([a.x, a.y, a.z], o * 3);
      this.dir.set([d.x, d.y, d.z], o * 3);
      this.col.set([rgb[0], rgb[1], rgb[2], intensity], o * 4);
      this.shape.set([len, sigma, spread, fade], o * 4);
    }
    this.n++;
  }
  end() {
    this.col.fill(0, this.n * 16);
    this.shape.fill(0, this.n * 16);
    for (const k of ["aStart", "aDir", "aColor", "aShape"]) (this.geo.getAttribute(k) as THREE.BufferAttribute).needsUpdate = true;
  }
  dispose() { this.geo.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

const GLASS_VERT = /* glsl */ `
out vec3 vN;
out vec3 vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const GLASS_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 fragColor;
in vec3 vN;
in vec3 vW;
uniform vec3 camPos;
uniform vec3 lightDir;   // direction light travels
uniform vec3 segA[4];
uniform vec3 segB[4];
uniform float segW[4];
uniform float backFace;
float segDist(vec3 p, vec3 a, vec3 b) {
  vec3 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return length(p - a - ab * t);
}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(camPos - vW);
  if (!gl_FrontFacing) N = -N;
  float ndv = abs(dot(N, V));
  float fres = pow(1.0 - ndv, 3.0);
  vec3 L = -lightDir;
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 80.0) * 6.0 + pow(max(dot(N, H), 0.0), 12.0) * 0.25;
  float glow = 0.0;
  for (int i = 0; i < 4; i++) {
    float d = segDist(vW, segA[i], segB[i]);
    glow += segW[i] * (exp(-d * d / 0.012) * 1.2 + exp(-d * d / 0.15) * 0.35);
  }
  vec3 tint = vec3(0.6, 0.85, 1.0);
  vec3 c = tint * (0.02 + fres * 0.35) + vec3(spec) + vec3(0.8, 0.92, 1.0) * glow;
  c *= mix(1.0, 0.45, backFace);
  fragColor = vec4(c, 1.0);
}`;

/** equilateral triangle with slightly rounded corners, extruded with a small bevel */
const prismGeometry = () => {
  const R = SIDE / Math.sqrt(3), rc = 0.025;
  const shape = new THREE.Shape();
  const verts = [90, 210, 330].map((deg) => new THREE.Vector2(Math.cos((deg * Math.PI) / 180) * R, Math.sin((deg * Math.PI) / 180) * R));
  const bev = 0.012;
  // inset so the bevel brings faces back out to the ideal planes
  const shrink = (R - (rc + bev) * 2) / R;
  for (let i = 0; i < 3; i++) {
    const p = verts[i].clone().multiplyScalar(shrink);
    const prev = verts[(i + 2) % 3].clone().multiplyScalar(shrink), next = verts[(i + 1) % 3].clone().multiplyScalar(shrink);
    const a = p.clone().add(prev.clone().sub(p).setLength(rc * 2));
    const b = p.clone().add(next.clone().sub(p).setLength(rc * 2));
    if (i === 0) shape.moveTo(a.x, a.y); else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(p.x, p.y, b.x, b.y);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: LENGTH - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(LENGTH - 2 * bev) / 2);
  g.computeVertexNormals();
  return g;
};

export const createPrism = () => (gl: THREE.WebGLRenderer, w: number, h: number): Look => {
  const res = new THREE.Vector2(w, h);
  const pxScale = h / 2160;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const cam = new THREE.PerspectiveCamera(35, w / h, 0.05, 100);
  cam.position.set(0.15, 0.05, 6.6);
  cam.lookAt(0.15, -0.05, 0);
  cam.updateMatrixWorld();

  const beams = new BeamBatch(1600, cam.position, cam);
  beams.mesh.renderOrder = 1;
  scene.add(beams.mesh);

  const prism = new THREE.Group();
  scene.add(prism);
  const glassUniforms = (back: number) => ({
    camPos: { value: cam.position }, lightDir: { value: BEAM_DIR },
    segA: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) }, segB: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
    segW: { value: [0, 0, 0, 0] }, backFace: { value: back },
  });
  const pgeo = prismGeometry();
  const glassMats = [THREE.BackSide, THREE.FrontSide].map((side, i) => new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG, uniforms: glassUniforms(i === 0 ? 1 : 0),
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, side,
  }));
  glassMats.forEach((m, i) => { const mesh = new THREE.Mesh(pgeo, m); mesh.renderOrder = 2 + i; prism.add(mesh); });

  // bright edges (front) and faint internal edges (back) as ribbons
  const R = SIDE / Math.sqrt(3);
  const tri = [90, 210, 330].map((deg) => [Math.cos((deg * Math.PI) / 180) * R, Math.sin((deg * Math.PI) / 180) * R]);
  const edges: number[][] = [];
  for (let i = 0; i < 3; i++) {
    const [x0, y0] = tri[i], [x1, y1] = tri[(i + 1) % 3];
    for (const z of [-LENGTH / 2, LENGTH / 2]) edges.push([x0, y0, z, x1, y1, z]);
    edges.push([x0, y0, -LENGTH / 2, x0, y0, LENGTH / 2]);
  }
  const subdiv = (e: number[]) => {
    const p: number[] = [];
    for (let k = 0; k <= 20; k++) { const t = k / 20; p.push(e[0] + (e[3] - e[0]) * t, e[1] + (e[4] - e[1]) * t, e[2] + (e[5] - e[2]) * t); }
    return p;
  };
  const edgeGeo = buildRibbonGeometry(edges.map((e) => ({ p: subdiv(e), color: [0.85, 0.92, 1.0] })));
  const fade: [number, number, number] = [6.0, 7.2, 0.3];
  const edgeCore = new THREE.Mesh(edgeGeo, ribbonMaterial({ width4k: 2.5, pxScale, res, mode: "solid", additive: true, intensity: 0.28, depthTest: false, depthFade: fade }));
  const edgeGlow = new THREE.Mesh(edgeGeo, ribbonMaterial({ width4k: 14, pxScale, res, mode: "glow", additive: true, intensity: 0.12, depthTest: false, depthFade: fade }));
  [edgeGlow, edgeCore].forEach((m, i) => { m.renderOrder = 4 + i; m.frustumCulled = false; prism.add(m); });

  const post = new Post(gl, w, h, {
    bloom: { strength: 0.55, threshold: 0.8, knee: 0.4, levels: 7, radius: 0.8 },
    grain: 0.015, grainGate: true, shoulder: 0.7,
    vignette: { amount: 0.25, start: 0.6, end: 1.4 },
  });

  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  const segs: Seg[] = [];
  const HAZE: [number, number, number] = [0.35, 0.5, 1.0];
  return {
    render(frame) {
      const t = loopPhase(frame);
      // Tumble: exactly one full turn per loop about the prism's own long axis,
      // which is tilted toward the camera and wobbles (two whole cycles), so
      // the beam crosses the side faces and the rainbow sweeps across.
      qa.setFromAxisAngle(new THREE.Vector3(0, 0, 1), TAU * t);
      qb.setFromEuler(new THREE.Euler(
        0.42 + 0.22 * Math.sin(TAU * 2 * t),
        -0.5 + 0.25 * Math.sin(TAU * t + 0.8),
        0, "XYZ"));
      prism.quaternion.copy(qb).multiply(qa);
      prism.updateMatrixWorld();
      traceBeam(prism.quaternion, segs);

      beams.begin();
      // internal light for the glass shader: strongest inside segments
      const inside = segs.filter((s) => s.kind === 2).sort((a, b) => b.w - a.w);
      const gu = glassMats.map((m) => m.uniforms);
      for (let i = 0; i < 4; i++) {
        // average a few wavelengths of the same path family
        const s = inside[i * 12];
        for (const u of gu) {
          if (s) {
            u.segA.value[i].copy(s.a);
            u.segB.value[i].copy(s.a).addScaledVector(s.d, s.len);
            u.segW.value[i] = Math.min(0.4, s.w * 24 * 0.2);
          } else u.segW.value[i] = 0;
        }
      }
      for (const s of segs) {
        switch (s.kind) {
          case 0: // incoming white beam: soft volumetric + hot core + blue haze
            beams.add(s.a, s.d, s.len, [1, 1, 1], s.w * 0.6, 0.12, 0.0, 0);
            beams.add(s.a, s.d, s.len, [1, 1, 1], s.w * 1.1, 0.032, 0.0, 0);
            beams.add(s.a, s.d, s.len, HAZE, s.w * 0.03, 0.22, 0.0, 0);
            // haze cone that opens toward the prism
            beams.add(s.a, s.d, s.len, [0.85, 0.9, 1.0], s.w * 0.12, 0.04, 0.022, 0);
            break;
          case 4: // part of the beam that misses the prism
            beams.add(s.a, s.d, s.len, [1, 1, 1], s.w * 0.55, 0.05, 0.0, 0);
            beams.add(s.a, s.d, s.len, [1, 1, 1], s.w * 1.1, 0.032, 0.0, 0);
            break;
          case 1: // spectral exit rays
            beams.add(s.a, s.d, s.len, s.rgb, s.w * 2.0, 0.04, 0.008 + 0.014 * (s.spread ?? 1), 14);
            if (s.w > 0.004) beams.add(s.a, s.d, s.len, HAZE, s.w * 0.04, 0.2, 0.05, 8);
            break;
          case 2: // inside the glass
            beams.add(s.a, s.d, s.len, s.rgb, s.w * 0.6, 0.03, 0.0, 0);
            break;
          case 3: // Fresnel reflection off the entry face (visually x4)
            beams.add(s.a, s.d, s.len, [1, 1, 1], s.w * 4 * 0.5, 0.035, 0.008, 14);
            break;
        }
      }
      beams.end();
      post.render(scene, cam, frame);
    },
    dispose() {
      post.dispose();
      beams.dispose();
      pgeo.dispose();
      edgeGeo.dispose();
    },
  };
};
