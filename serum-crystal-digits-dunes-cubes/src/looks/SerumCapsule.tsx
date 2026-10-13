import { useThree } from "@react-three/fiber";
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BG_DITHER_GLSL } from "../common/glsl";
import { bgDitherOffset, Pipeline, sharedBlueNoise } from "../common/Pipeline";
import { mulberry32 } from "../common/random";
import { clamp01, easeInOutCubic, easeOutBack, SceneCanvas, smooth, TAU, useFrameRender } from "../common/SceneCanvas";

// Look 1 — Serum Capsule (10 s story, 300 frames)

export type SerumCapsuleProps = {
  bgCenter: string;
  bgCorner: string;
  rim: string; // bubble rim / highlight tint
  shade: string; // bubble inner shading tint
  molecule: string;
  ring: string;
  iridescence: number;
};

const PERIOD = 300; // grain / dither period
const FPS = 30;

// Camera z = 12, fov 30 → visible half-height 3.215 at z = 0.
// Capsule: 38% of frame height → radius 1.22.
const CAPSULE_R = 1.22;

type Bubble = {
  base: THREE.Vector3;
  vel: THREE.Vector3;
  r: number;
  wob: number;
  wobF: number;
  wobP: number;
  merge: number; // -1 = free, 0..4 = merges into the capsule
};

const BUBBLES: Bubble[] = (() => {
  const rng = mulberry32(0x5e7a);
  const out: Bubble[] = [];
  // 5 medium bubbles that gather into the capsule
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.5 + rng() * 0.3;
    const d = 1.9 + rng() * 0.9;
    out.push({
      base: new THREE.Vector3(Math.cos(a) * d * 1.25, Math.sin(a) * d * 0.85 - 0.3, -0.5 + rng() * 1.0),
      vel: new THREE.Vector3((rng() - 0.5) * 0.08, 0.05 + rng() * 0.05, 0),
      r: 0.36 + rng() * 0.16,
      wob: 0.04 + rng() * 0.04,
      wobF: 0.4 + rng() * 0.4,
      wobP: rng() * TAU,
      merge: i,
    });
  }
  // 4 large, near, out-of-focus bubbles at the frame edges
  const near = [
    [-3.0, 1.55, 5.0, 0.85],
    [2.7, -1.75, 5.4, 0.95],
    [-3.6, -2.0, 3.6, 0.6],
    [3.9, 1.9, 3.2, 0.55],
  ];
  near.forEach(([x, y, z, r]) =>
    out.push({
      base: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3((rng() - 0.5) * 0.06, 0.06 + rng() * 0.04, 0),
      r,
      wob: 0.05,
      wobF: 0.3 + rng() * 0.3,
      wobP: rng() * TAU,
      merge: -1,
    }),
  );
  // 9 free bubbles at mixed depths; most sit off the focal plane and are
  // softened by the analytic defocus
  for (let i = 0; i < 9; i++) {
    const z = i < 5 ? 1.5 + rng() * 2.5 : -6 + rng() * 4;
    const halfH = (12 - z) * Math.tan((15 * Math.PI) / 180);
    let x = (rng() * 2 - 1) * halfH * 1.65;
    const y = (rng() * 2 - 1) * halfH * 0.9;
    if (Math.abs(x) < 1.9 && Math.abs(y) < 1.7) x += x < 0 ? -2.4 : 2.4;
    out.push({
      base: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3((rng() - 0.5) * 0.1, 0.04 + rng() * 0.08, 0),
      r: i < 5 ? 0.4 + rng() * 0.3 : 0.45 + rng() * 0.5,
      wob: 0.03 + rng() * 0.05,
      wobF: 0.3 + rng() * 0.6,
      wobP: rng() * TAU,
      merge: -1,
    });
  }
  return out;
})();

// Generic ring-structure molecule: 5 atoms in a pentagon + 2 side atoms.
const ATOMS: THREE.Vector3[] = (() => {
  const pts: THREE.Vector3[] = [];
  const R = 0.38;
  for (let k = 0; k < 5; k++) {
    const a = Math.PI / 2 + (k * TAU) / 5;
    pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0));
  }
  const side = (k: number, len: number) => pts[k].clone().multiplyScalar(1 + len / R);
  pts.push(side(1, 0.34)); // side atom on the upper-left atom
  pts.push(side(3, 0.34)); // side atom on the lower-right atom
  // centre the structure
  const c = pts.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / pts.length);
  return pts.map((p) => p.sub(c));
})();
const BONDS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 0],
  [1, 5],
  [3, 6],
];
const ATOM_ORDER = [0, 1, 5, 2, 3, 6, 4]; // pop-in order

// Background (shared by the backdrop and the bubbles' refraction).
const BG_GLSL = /* glsl */ `
uniform vec3 uBgCenter; uniform vec3 uBgCorner; uniform float uAspect;
vec3 bgAt(vec2 uv) {
  vec2 d = (uv - vec2(0.5, 0.52)) * vec2(uAspect, 1.0);
  float r = length(d) / length(vec2(uAspect, 1.0) * 0.5);
  vec3 c = mix(uBgCenter, uBgCorner, smoothstep(0.0, 0.9, r));
  // soft studio window light from the upper left
  vec2 l = (uv - vec2(0.12, 0.62)) * vec2(uAspect, 1.0);
  c += uBgCenter * 0.10 * exp(-dot(l, l) * 1.6);
  return c;
}
`;

const BUBBLE_VERT = /* glsl */ `
uniform vec3 uCenter; uniform float uR; uniform float uQuad;
varying vec2 vP; varying float vRuv;
void main() {
  vec4 mv = viewMatrix * vec4(uCenter, 1.0);
  vec4 c = projectionMatrix * mv;
  mv.xy += position.xy * uR * uQuad;
  gl_Position = projectionMatrix * mv;
  vP = position.xy * uQuad;
  // radius in screen-uv (y) units, for refraction
  vRuv = uR * projectionMatrix[1][1] / max(c.w, 1e-3) * 0.5;
}
`;

const BUBBLE_FRAG = /* glsl */ `
${BG_GLSL}
uniform vec2 uRes; uniform float uSoft; uniform float uAlpha; uniform float uInterior;
uniform vec3 uRim; uniform vec3 uShade; uniform float uIri; uniform float uRimBoost; uniform float uBody; uniform float uBandK;
varying vec2 vP; varying float vRuv;
void main() {
  float r = length(vP);
  float s = uSoft;
  float aa = fwidth(r) * 1.5;
  float mask = 1.0 - smoothstep(1.0 - s - aa, 1.0 + s * 0.6 + aa, r);
  if (mask <= 0.0) discard;
  float rc = min(r, 0.999);
  vec3 n = vec3(vP / max(r, 1e-4) * rc, sqrt(1.0 - rc * rc));
  vec2 suv = gl_FragCoord.xy / uRes;
  // thin-shell refraction of the backdrop (slight inversion toward the edge)
  vec3 refr = bgAt(suv + n.xy * vRuv * (0.35 + 0.4 * rc * rc));
  float fres = pow(1.0 - n.z, 2.5);
  vec2 ld = normalize(vec2(0.62, 0.78));
  float side = dot(normalize(vP + 1e-5), ld);
  // rim: a soft ring that widens with defocus
  float w = 0.05 + s * 0.9;
  float ring = exp(-pow((r - 0.955) / w, 2.0)) * pow(0.05 / w, 0.15);
  float rimLit = ring * (0.55 + 0.45 * smoothstep(-0.2, 0.9, side));
  float caustic = exp(-pow((r - 0.82) / (0.08 + s), 2.0)) * smoothstep(0.2, -0.9, side) * (0.55 + 0.6 * uBody);
  // inner absorption band (darker just inside the rim)
  float band = exp(-pow((r - 0.86) / (0.09 + s * 0.6), 2.0));
  vec3 col = refr;
  col = mix(col, col * uShade, band * (0.5 + 0.35 * uBody) * uBandK);
  // glass body: cooler, slightly darker toward the lower edge
  col = mix(col, col * uShade, uBody * (0.25 + 0.55 * smoothstep(0.0, 1.0, r)) * (0.5 + 0.5 * smoothstep(0.3, -0.9, vP.x * 0.6 + vP.y * 0.8)));
  // window reflection (upper left) and a small kicker (lower right)
  vec2 hp = vP - vec2(0.42, 0.5);
  float hw = 0.16 + s * 0.35;
  float hi = exp(-(hp.x * hp.x / (hw * hw * 1.6) + hp.y * hp.y / (hw * hw * 0.7)));
  vec2 kp = vP - vec2(-0.5, -0.5);
  float ki = exp(-dot(kp, kp) / pow(0.1 + s * 0.5, 2.0)) * 0.45;
  // faint iridescence on the rim
  float ang = atan(vP.y, vP.x);
  vec3 iri = 0.5 + 0.5 * cos(6.2831853 * (fract(r * 1.3 + ang * 0.16) + vec3(0.0, 0.33, 0.67)));
  vec3 rimCol = mix(uRim, uRim * iri * 1.4, uIri);
  col += rimCol * (rimLit * 0.55 * uRimBoost + fres * 0.1);
  col += uRim * caustic * 0.45;
  float sharpK = (1.0 - s) * (1.0 - s);
  col += vec3(1.0) * (hi * 0.75 + ki) * sharpK * sharpK;
  float a = mask * mix(uInterior, 1.0, clamp(ring + band * 0.6 * uBandK + hi + fres * 0.5, 0.0, 1.0));
  gl_FragColor = vec4(col, a * uAlpha);
}
`;

const RING_VERT = /* glsl */ `
attribute float aAng; attribute float aSide;
uniform float uR; uniform float uW;
varying float vAng; varying float vSide; varying float vViewZ;
void main() {
  vec3 p = vec3(cos(aAng), 0.0, sin(aAng)) * (uR + aSide * uW);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vViewZ = mv.z;
  vAng = aAng;
  vSide = aSide;
  gl_Position = projectionMatrix * mv;
}
`;
const RING_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uHead; uniform float uLen; uniform float uCenterZ;
uniform float uFront; uniform float uFade;
varying float vAng; varying float vSide; varying float vViewZ;
void main() {
  bool inFront = vViewZ > uCenterZ;
  if (inFront != (uFront > 0.5)) discard;
  float d = mod(uHead - vAng, 6.2831853); // distance behind the head
  if (d > uLen) discard;
  float tail = pow(1.0 - d / max(uLen, 1e-3), 1.6);
  float head = exp(-d * 9.0);
  // a band of fine lines across the ribbon
  float v = vSide;
  float lines = exp(-pow(v / 0.14, 2.0)) * 0.8 + 0.5 * exp(-pow((v - 0.42) / 0.1, 2.0)) + 0.4 * exp(-pow((v + 0.45) / 0.09, 2.0))
              + 0.28 * exp(-pow((v - 0.78) / 0.08, 2.0)) + 0.22 * exp(-pow((v + 0.8) / 0.08, 2.0));
  float glow = exp(-v * v * 1.8) * 0.2;
  float streak = 0.65 + 0.35 * sin(vAng * 23.0 + v * 4.0) * sin(vAng * 7.0 - 1.3);
  float k = (lines * streak + glow) * (tail * 0.5 + head * 1.4) * uFade;
  gl_FragColor = vec4(uColor * k, 1.0);
}
`;

const Scene: React.FC<SerumCapsuleProps> = (p) => {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);

  const built = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 60);

    const pmrem = new THREE.PMREMGenerator(gl);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.03);
    pmrem.dispose();

    const bgShared = {
      uBgCenter: { value: new THREE.Color(p.bgCenter) },
      uBgCorner: { value: new THREE.Color(p.bgCorner) },
      uAspect: { value: 16 / 9 },
    };
    const res = { value: new THREE.Vector2(1280, 720) };

    const bgMat = new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: false,
      uniforms: { ...bgShared, uBlueNoise: { value: sharedBlueNoise }, uBnOffset: { value: new THREE.Vector3() } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
      fragmentShader: /* glsl */ `
        ${BG_DITHER_GLSL}
        ${BG_GLSL}
        varying vec2 vUv;
        void main() {
          vec3 c = bgAt(vUv);
          c += bgDither(gl_FragCoord.xy) * (1.0 / 1024.0);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    bg.frustumCulled = false;
    bg.renderOrder = -100;
    scene.add(bg);

    const quad = new THREE.PlaneGeometry(2, 2);
    const makeBubbleMat = (interior: number, rimBoost: number) =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          ...bgShared,
          uRes: res,
          uCenter: { value: new THREE.Vector3() },
          uR: { value: 1 },
          uQuad: { value: 1.5 },
          uSoft: { value: 0 },
          uAlpha: { value: 1 },
          uInterior: { value: interior },
          uRim: { value: new THREE.Color(p.rim) },
          uShade: { value: new THREE.Color(p.shade) },
          uIri: { value: p.iridescence },
          uRimBoost: { value: rimBoost },
          uBody: { value: 0 },
          uBandK: { value: 1 },
        },
        vertexShader: BUBBLE_VERT,
        fragmentShader: BUBBLE_FRAG,
      });
    const bubbles = BUBBLES.map(() => {
      const m = new THREE.Mesh(quad, makeBubbleMat(0.2, 1));
      m.frustumCulled = false;
      scene.add(m);
      return m;
    });
    // The capsule is drawn in two passes: its glass body behind the molecule,
    // then rim, band and highlights in front of it.
    const capsule = new THREE.Mesh(quad, makeBubbleMat(0.0, 1.0));
    (capsule.material as THREE.ShaderMaterial).uniforms.uBandK.value = 0.35;
    capsule.frustumCulled = false;
    scene.add(capsule);
    const capsuleBody = new THREE.Mesh(quad, makeBubbleMat(0.88, 0.0));
    (capsuleBody.material as THREE.ShaderMaterial).uniforms.uBody.value = 1;
    capsuleBody.frustumCulled = false;
    scene.add(capsuleBody);

    // molecule
    const molGroup = new THREE.Group();
    const molMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(p.molecule),
      metalness: 0.45,
      roughness: 0.14,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMap: envRT.texture,
      envMapIntensity: 1.25,
      // in the transparent queue so it sorts between the bubbles by renderOrder
      transparent: true,
      depthWrite: true,
    });
    const atomGeo = new THREE.SphereGeometry(0.17, 48, 28);
    const atoms = ATOMS.map((a) => {
      const m = new THREE.Mesh(atomGeo, molMat);
      m.position.copy(a);
      molGroup.add(m);
      return m;
    });
    const stickGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 16, 1);
    stickGeo.translate(0, 0.5, 0);
    const sticks = BONDS.map(() => {
      const m = new THREE.Mesh(stickGeo, molMat);
      molGroup.add(m);
      return m;
    });
    molGroup.renderOrder = 5;
    scene.add(molGroup);
    const keyL = new THREE.DirectionalLight(0xffffff, 1.2);
    keyL.position.set(-3, 4, 5);
    scene.add(keyL, new THREE.AmbientLight(0xffffff, 0.35));

    // orbit rings (each drawn twice: behind and in front of the capsule)
    const SEG = 256;
    const ang: number[] = [];
    const side: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * TAU;
      ang.push(a, a);
      side.push(-1, 1);
      if (i < SEG) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const ringGeo = new THREE.BufferGeometry();
    ringGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(ang.length * 3), 3));
    ringGeo.setAttribute("aAng", new THREE.Float32BufferAttribute(ang, 1));
    ringGeo.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
    ringGeo.setIndex(idx);
    const RINGS = [
      { r: 2.35, w: 0.3, tiltX: 0.36, tiltZ: 0.3, speed: 1.0, start: 6.0, a0: 2.4 },
      { r: 2.1, w: 0.22, tiltX: 0.5, tiltZ: 0.38, speed: -0.85, start: 6.3, a0: 0.4 },
      { r: 1.8, w: 0.16, tiltX: 0.9, tiltZ: -0.5, speed: 1.2, start: 6.6, a0: 4.2 },
    ];
    const ringMeshes = RINGS.flatMap((rg) =>
      [0, 1].map((front) => {
        const mat = new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          uniforms: {
            uR: { value: rg.r },
            uW: { value: rg.w },
            uColor: { value: new THREE.Color(p.ring) },
            uHead: { value: 0 },
            uLen: { value: 0 },
            uCenterZ: { value: -12 },
            uFront: { value: front },
            uFade: { value: 0 },
          },
          vertexShader: RING_VERT,
          fragmentShader: RING_FRAG,
        });
        const m = new THREE.Mesh(ringGeo, mat);
        m.frustumCulled = false;
        m.rotation.set(rg.tiltX, 0, rg.tiltZ);
        scene.add(m);
        return { m, mat, rg, front };
      }),
    );

    const pipeline = new Pipeline({
      period: PERIOD,
      samples: 4,
      bloom: { threshold: 1.15, strength: 0.3, knee: 0.15 },
      vignette: 0.42,
      vignetteColor: new THREE.Color(p.bgCorner).multiplyScalar(0.8),
      grain: 0.015,
    });
    return { scene, camera, bgMat, bubbles, capsule, capsuleBody, molGroup, atoms, sticks, ringMeshes, pipeline, envRT, res, bgShared };
  }, [gl, p]);

  useEffect(
    () => () => {
      built.pipeline.dispose();
      built.envRT.dispose();
    },
    [built],
  );

  useFrameRender((frame) => {
    const b = built;
    const t = frame / FPS;
    const cam = b.camera;
    cam.aspect = size.width / size.height;
    // slight ease in, then a slower creep
    const camZ = 12.6 - 0.55 * easeInOutCubic(t / 2.5) - 0.25 * smooth(2.5, 10, t);
    cam.position.set(0.05 * Math.sin(t * 0.4), 0.04 * Math.sin(t * 0.3), camZ);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    b.res.value.copy(buf);
    b.bgShared.uAspect.value = cam.aspect;
    b.bgMat.uniforms.uBnOffset.value.copy(bgDitherOffset(frame, PERIOD));

    const focus = camZ; // capsule at the origin
    const gather = easeInOutCubic((t - 2.5) / 2.0); // 2.5–4.5 s
    const capGrow = smooth(3.5, 4.6, t);
    const view = new THREE.Vector3();

    // free + merging bubbles
    const order: { m: THREE.Mesh; z: number }[] = [];
    BUBBLES.forEach((bb, i) => {
      const m = b.bubbles[i];
      const mat = m.material as THREE.ShaderMaterial;
      const pos = bb.base.clone().addScaledVector(bb.vel, t);
      pos.x += bb.wob * Math.sin(t * bb.wobF * TAU * 0.25 + bb.wobP);
      pos.y += bb.wob * Math.cos(t * bb.wobF * TAU * 0.2 + bb.wobP);
      let r = bb.r;
      let alpha = 1;
      if (bb.merge >= 0) {
        // gather toward the centre, then dissolve into the growing capsule
        const tgt = new THREE.Vector3(
          Math.cos(bb.merge * 1.257) * 0.18,
          Math.sin(bb.merge * 1.257) * 0.15,
          0,
        );
        pos.lerp(tgt, gather);
        r = THREE.MathUtils.lerp(bb.r, CAPSULE_R * 0.62, smooth(3.2, 4.4, t));
        alpha = 1 - smooth(3.7, 4.5, t);
      }
      mat.uniforms.uCenter.value.copy(pos);
      mat.uniforms.uR.value = r;
      view.copy(pos).applyMatrix4(cam.matrixWorldInverse);
      const dist = -view.z;
      const soft = Math.min(0.6, Math.abs(dist - focus) * 0.13);
      mat.uniforms.uSoft.value = soft;
      mat.uniforms.uQuad.value = 1.15 + soft * 1.2;
      mat.uniforms.uAlpha.value = alpha;
      // defocused bubbles keep a bright rim and a greyer body, like the bokeh in the reference
      mat.uniforms.uRimBoost.value = 1 + soft * 2.2;
      mat.uniforms.uInterior.value = 0.2 + soft * 0.5;
      m.visible = alpha > 0.001;
      order.push({ m, z: dist });
    });

    // capsule
    const capMat = b.capsule.material as THREE.ShaderMaterial;
    const capR = CAPSULE_R * THREE.MathUtils.lerp(0.62, 1, capGrow);
    capMat.uniforms.uCenter.value.set(0, 0, 0);
    capMat.uniforms.uR.value = capR;
    capMat.uniforms.uQuad.value = 1.2;
    capMat.uniforms.uSoft.value = 0;
    capMat.uniforms.uAlpha.value = capGrow;
    b.capsule.visible = capGrow > 0.001;
    const bodyMat = b.capsuleBody.material as THREE.ShaderMaterial;
    bodyMat.uniforms.uCenter.value.set(0, 0, 0);
    bodyMat.uniforms.uR.value = capR;
    bodyMat.uniforms.uQuad.value = 1.2;
    bodyMat.uniforms.uSoft.value = 0;
    bodyMat.uniforms.uAlpha.value = capGrow;
    b.capsuleBody.visible = capGrow > 0.001;
    order.push({ m: b.capsule, z: focus });

    // back-to-front (molecule and rings slot in around the capsule)
    order.sort((x, y) => y.z - x.z);
    order.forEach((o, i) => {
      o.m.renderOrder = i * 10;
    });
    const capOrder = b.capsule.renderOrder;
    b.capsuleBody.renderOrder = capOrder - 8;

    // molecule: atoms pop in one by one (gentle overshoot), sticks draw between
    const atomT = (k: number) => 4.55 + ATOM_ORDER.indexOf(k) * 0.17;
    b.atoms.forEach((a, k) => {
      const s = easeOutBack((t - atomT(k)) / 0.4, 1.3);
      a.scale.setScalar(Math.max(0.0001, s));
      a.visible = t > atomT(k);
    });
    BONDS.forEach(([i, j], k) => {
      const st = b.sticks[k];
      const t0 = Math.max(atomT(i), atomT(j)) + 0.12;
      const g = easeInOutCubic((t - t0) / 0.35);
      const A = ATOMS[i];
      const B = ATOMS[j];
      const dir = B.clone().sub(A);
      const len = dir.length();
      st.position.copy(A);
      st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      st.scale.set(1, Math.max(0.0001, len * g), 1);
      st.visible = g > 0;
    });
    // turns slowly while staying readable: spin in its plane, gentle rock in depth
    b.molGroup.rotation.set(0.3 * Math.sin(t * 0.33) + 0.2, 0.5 * Math.sin(t * 0.42 - 1.0), -0.1 + t * 0.16);
    b.molGroup.renderOrder = capOrder - 4;
    b.molGroup.traverse((o) => (o.renderOrder = capOrder - 4));

    // orbit rings: draw on with a bright head, then circle
    view.set(0, 0, 0).applyMatrix4(cam.matrixWorldInverse);
    b.ringMeshes.forEach(({ m, mat, rg, front }) => {
      const lt = t - rg.start;
      const draw = easeInOutCubic(lt / 1.4);
      mat.uniforms.uHead.value = rg.a0 + Math.abs(rg.speed) * Math.max(0, lt) * 1.6 + draw * 2.2;
      mat.uniforms.uLen.value = draw * 4.6;
      mat.uniforms.uFade.value = clamp01(lt / 0.2);
      mat.uniforms.uCenterZ.value = view.z;
      m.rotation.set(rg.tiltX, 0.18 * Math.sin(t * 0.3), rg.tiltZ);
      m.visible = lt > 0;
      m.renderOrder = front ? capOrder + 2 : capOrder - 6;
      // mirror the ring to reverse its direction of travel
      m.scale.set(1, 1, Math.sign(rg.speed));
    });

    b.pipeline.render(gl, b.scene, cam, frame);
  });
  return null;
};

export const SerumCapsule: React.FC<SerumCapsuleProps> = (props) => (
  <SceneCanvas>
    <Scene {...props} />
  </SceneCanvas>
);
