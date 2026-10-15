import React, { useCallback } from "react";
import * as THREE from "three";
import { hexToLinear } from "../../lib/color";
import { grainFrame, loopPhase, TAU } from "../../lib/loop";
import { PostPipeline } from "../../lib/post";
import { irange, mulberry32, range, Rng } from "../../lib/rng";
import { ThreeLook, ThreeLookFactory } from "../../lib/ThreeLook";

/**
 * Generic illustration of nerve-like fibres: strands with segmented sheaths and
 * glowing ends. No anatomy, labels or claims.
 */
export type NerveVariant = {
  id: string;
  fibre: string;
  fibreSheen: string;
  web: string;
  haze: string;
  hazeGlow: string;
  tip: string;
  bead: string;
  speck: string;
};

// The fibre world is a slab of depth SLAB repeated along -z. The camera travels
// exactly one slab per loop, so frame 600 sees the same world as frame 0.
const SLAB = 30;
const COPIES = [1, 0, -1, -2, -3];
const WEB_COUNT = 700;
const HERO_COUNT = 20;
const SECONDARY_COUNT = 50;
const SPECK_COUNT = 400;

const randUnit = (rng: Rng) => {
  const z = range(rng, -1, 1);
  const a = rng() * TAU;
  const s = Math.sqrt(1 - z * z);
  return new THREE.Vector3(s * Math.cos(a), s * Math.sin(a), z);
};

/** keep geometry out of the camera's flight tube around the z axis */
const pushOut = (p: THREE.Vector3, minR: number) => {
  const r = Math.hypot(p.x, p.y);
  if (r < minR) {
    const a = r < 1e-3 ? 0.7 : Math.atan2(p.y, p.x);
    p.x = Math.cos(a) * minR;
    p.y = Math.sin(a) * minR;
  }
  return p;
};

type FibreSpec = {
  curve: THREE.CatmullRomCurve3;
  radius: number;
  beads: number; // 0 = none
  tip: boolean;
  pulseCycles: number;
  pulsePhase: number;
};

const buildFibres = (rng: Rng, count: number, rMin: number, rMax: number, beadShare: number, tipShare: number) => {
  const out: FibreSpec[] = [];
  for (let i = 0; i < count; i++) {
    const pts: THREE.Vector3[] = [];
    const start = new THREE.Vector3(range(rng, -14, 14), range(rng, -9, 9), range(rng, -SLAB, 0));
    pushOut(start, 2.6);
    let dir = randUnit(rng);
    dir.z *= 0.6;
    dir.normalize();
    const n = irange(rng, 4, 6);
    let p = start.clone();
    for (let k = 0; k < n; k++) {
      pts.push(p.clone());
      const turn = randUnit(rng).multiplyScalar(0.55);
      dir = dir.add(turn).normalize();
      p = p.clone().addScaledVector(dir, range(rng, 2.2, 3.6));
      pushOut(p, 2.6);
    }
    out.push({
      curve: new THREE.CatmullRomCurve3(pts, false, "centripetal"),
      radius: range(rng, rMin, rMax),
      beads: rng() < beadShare ? irange(rng, 5, 8) : 0,
      tip: rng() < tipShare,
      pulseCycles: irange(rng, 1, 3),
      pulsePhase: rng(),
    });
  }
  return out;
};

const WEB_VERT = /* glsl */ `
attribute vec3 aBend;
attribute float aShade;
varying vec3 vN;
varying vec3 vViewPos;
varying float vShade;
void main() {
  vec3 p = position;
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  float y = position.y;                         // -0.5..0.5 along the fibre
  wp.xyz += aBend * (1.0 - 4.0 * y * y);        // gentle bow
  vN = normalize(mat3(viewMatrix) * mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vec4 mv = viewMatrix * wp;
  vViewPos = mv.xyz;
  vShade = aShade;
  gl_Position = projectionMatrix * mv;
}
`;

const WEB_FRAG = /* glsl */ `
uniform vec3 cWeb;
uniform vec3 cHaze;
uniform vec3 cLight;
uniform float uFog;
varying vec3 vN;
varying vec3 vViewPos;
varying float vShade;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(-vViewPos);
  if (dot(n, v) < 0.0) n = -n;
  vec3 L = normalize(vec3(0.3, 0.5, 0.8));
  float diff = 0.55 + 0.45 * max(dot(n, L), 0.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.0);
  vec3 col = cWeb * diff * vShade + cLight * rim * 0.25 * vShade;
  float d = length(vViewPos);
  float f = 1.0 - exp(-pow(uFog * d, 2.0));
  gl_FragColor = vec4(mix(col, cHaze, f), 1.0);
}
`;

const SPECK_VERT = /* glsl */ `
attribute vec3 aPhase;
attribute float aSize;
uniform float uT;
uniform float uPxH;
varying float vFog;
uniform float uFog;
#define TAU 6.28318530718
void main() {
  // floats on closed paths: whole sine cycles per loop
  vec3 p = position + 0.35 * vec3(
    sin(TAU * (uT + aPhase.x)),
    sin(TAU * (2.0 * uT + aPhase.y)),
    sin(TAU * (uT + aPhase.z)));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = -mv.z;
  gl_PointSize = max(aSize * uPxH * 0.9 / d, 1.5);
  vFog = 1.0 - exp(-pow(uFog * d, 2.0));
}
`;

const SPECK_FRAG = /* glsl */ `
uniform vec3 cSpeck;
varying float vFog;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float a = 1.0 - smoothstep(0.4, 1.0, r);
  gl_FragColor = vec4(cSpeck * a * (1.0 - vFog) * 0.9, 1.0);
}
`;

const GLOW_FRAG = /* glsl */ `
uniform vec3 cGlow;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float g = exp(-dot(p, p) * 9.0) * 0.6;
  gl_FragColor = vec4(cGlow * g, 1.0);
}
`;

const makeFactory =
  (v: NerveVariant): ThreeLookFactory =>
  (gl, pxW, pxH) => {
    const aspect = pxW / pxH;
    const C = (h: string) => new THREE.Color(h);
    const V3 = (h: string) => new THREE.Vector3(...hexToLinear(h));
    const FOG = 0.034;

    const scene = new THREE.Scene();
    scene.background = C(v.haze);
    scene.fog = new THREE.FogExp2(C(v.haze), FOG);
    const cam = new THREE.PerspectiveCamera(55, aspect, 0.1, 90);
    scene.add(cam);

    // ---- glow deep inside the web (camera-attached, behind everything) ----
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(150 * aspect, 150),
      new THREE.ShaderMaterial({
        uniforms: { cGlow: { value: V3(v.hazeGlow) } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: GLOW_FRAG,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        transparent: true,
        fog: false,
      }),
    );
    glow.position.set(0, 0, -85);
    glow.renderOrder = -10;
    cam.add(glow);

    // ---- lights: warm key from the front (rides with the camera) + soft fill ----
    const key = new THREE.DirectionalLight(0xfff0e0, 1.7);
    key.position.set(2, 3, 4);
    cam.add(key);
    cam.add(key.target);
    key.target.position.set(0, 0, -10);
    scene.add(new THREE.HemisphereLight(C(v.hazeGlow), C(v.web), 0.5));

    // small environment so the glossy fibres pick up soft reflections
    const envScene = new THREE.Scene();
    envScene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(10, 32, 16),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          uniforms: { a: { value: V3(v.hazeGlow) }, b: { value: V3(v.web) } },
          vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: `uniform vec3 a; uniform vec3 b; varying vec3 vP; void main(){ float k = normalize(vP).y * 0.5 + 0.5; gl_FragColor = vec4(mix(b * 0.4, a * 1.6, k), 1.0); }`,
        }),
      ),
    );
    const pmrem = new THREE.PMREMGenerator(gl);
    const envRT = pmrem.fromScene(envScene, 0.05);
    pmrem.dispose();
    scene.environment = envRT.texture;

    const world = new THREE.Group();
    scene.add(world);
    const disposables: { dispose: () => void }[] = [envRT];

    // ---- background web: ~600 thin, matte, gently bowed fibres per slab ----
    const rng = mulberry32(0xf1b3e5);
    const webGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 12, true);
    const webMat = new THREE.ShaderMaterial({
      vertexShader: WEB_VERT,
      fragmentShader: WEB_FRAG,
      uniforms: { cWeb: { value: V3(v.web) }, cHaze: { value: V3(v.haze) }, cLight: { value: V3(v.hazeGlow) }, uFog: { value: FOG } },
    });
    const total = WEB_COUNT * COPIES.length;
    const web = new THREE.InstancedMesh(webGeo, webMat, total);
    const bend = new Float32Array(total * 3);
    const shade = new Float32Array(total);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const webSpecs: { pos: THREE.Vector3; dir: THREE.Vector3; len: number; r: number; bend: THREE.Vector3; shade: number }[] = [];
    for (let i = 0; i < WEB_COUNT; i++) {
      const dir = randUnit(rng);
      const len = range(rng, 14, 30);
      const pos = new THREE.Vector3(range(rng, -24, 24), range(rng, -16, 16), range(rng, -SLAB, 0));
      // keep fibres from slicing straight through the lens
      const perp = pos.clone().sub(dir.clone().multiplyScalar(pos.dot(dir)));
      if (Math.hypot(perp.x, perp.y) < 1.5) pos.x += pos.x >= 0 ? 3 : -3;
      const side = randUnit(rng).cross(dir).normalize().multiplyScalar(range(rng, 0.3, 2.2));
      webSpecs.push({ pos, dir, len, r: range(rng, 0.014, 0.04), bend: side, shade: range(rng, 1.1, 1.9) });
    }
    let idx = 0;
    for (const k of COPIES) {
      for (const s of webSpecs) {
        q.setFromUnitVectors(up, s.dir);
        m4.compose(s.pos.clone().add(new THREE.Vector3(0, 0, k * SLAB)), q, new THREE.Vector3(s.r, s.len, s.r));
        web.setMatrixAt(idx, m4);
        bend.set([s.bend.x, s.bend.y, s.bend.z], idx * 3);
        shade[idx] = s.shade;
        idx++;
      }
    }
    webGeo.setAttribute("aBend", new THREE.InstancedBufferAttribute(bend, 3));
    webGeo.setAttribute("aShade", new THREE.InstancedBufferAttribute(shade, 1));
    web.frustumCulled = false;
    world.add(web);
    disposables.push(webGeo, webMat);

    // ---- hero + secondary fibres: glossy tubes, bead chains, glowing tips ----
    const heroMat = new THREE.MeshPhysicalMaterial({
      color: C(v.fibre),
      roughness: 0.3,
      metalness: 0,
      sheen: 0.4,
      sheenColor: C(v.fibreSheen),
      sheenRoughness: 0.45,
      clearcoat: 0.35,
      clearcoatRoughness: 0.25,
      emissive: C(v.fibre).multiplyScalar(0.05),
      envMapIntensity: 0.45,
    });
    const beadMat = new THREE.MeshPhysicalMaterial({
      color: C(v.bead),
      roughness: 0.25,
      sheen: 1,
      sheenColor: C("#ffffff"),
      emissive: C(v.bead).multiplyScalar(0.35),
      envMapIntensity: 0.8,
    });
    disposables.push(heroMat, beadMat);

    const heroes = [
      ...buildFibres(rng, HERO_COUNT, 0.11, 0.2, 0.5, 0.8),
      ...buildFibres(rng, SECONDARY_COUNT, 0.045, 0.08, 0.2, 0.75),
    ];
    const beadGeo = new THREE.SphereGeometry(1, 20, 14);
    const tipGeo = new THREE.SphereGeometry(1, 16, 12);
    disposables.push(beadGeo, tipGeo);
    const tips: { mat: THREE.MeshBasicMaterial; cycles: number; phase: number; gain: number }[] = [];
    const tipCol = C(v.tip);

    for (const h of heroes) {
      const geo = new THREE.TubeGeometry(h.curve, 80, h.radius, 12, false);
      disposables.push(geo);
      const end = h.curve.getPoint(1);
      const tan = h.curve.getTangent(1).normalize();
      // bead chain: rounded beads continuing the fibre, shrinking toward the tip
      const beads: { pos: THREE.Vector3; r: number }[] = [];
      let p = end.clone();
      if (h.beads > 0) {
        for (let b = 0; b < h.beads; b++) {
          const r = h.radius * (1.25 - (0.75 * b) / Math.max(1, h.beads - 1));
          p = p.clone().addScaledVector(tan, r * (b === 0 ? 1.0 : 1.9));
          beads.push({ pos: p.clone(), r });
        }
        p = p.clone().addScaledVector(tan, beads[beads.length - 1].r * 1.6);
      }
      const tipR = h.radius * (h.beads > 0 ? 0.75 : 1.05);
      const tipMat = new THREE.MeshBasicMaterial({ color: tipCol.clone(), fog: true });
      disposables.push(tipMat);
      if (h.tip || h.beads > 0) tips.push({ mat: tipMat, cycles: h.pulseCycles, phase: h.pulsePhase, gain: h.beads > 0 ? 7 : 4 });
      for (const k of COPIES) {
        const off = new THREE.Vector3(0, 0, k * SLAB);
        const tube = new THREE.Mesh(geo, heroMat);
        tube.position.copy(off);
        world.add(tube);
        for (const b of beads) {
          const bm = new THREE.Mesh(beadGeo, beadMat);
          bm.position.copy(b.pos).add(off);
          bm.quaternion.setFromUnitVectors(up, tan);
          bm.scale.set(b.r, b.r * 0.8, b.r);
          world.add(bm);
        }
        if (h.tip || h.beads > 0) {
          const tm = new THREE.Mesh(tipGeo, tipMat);
          tm.position.copy(p).add(off);
          tm.scale.setScalar(tipR);
          world.add(tm);
        }
      }
    }

    // ---- specks: pale dots floating between the fibres ----
    const speckPos = new Float32Array(SPECK_COUNT * COPIES.length * 3);
    const speckPh = new Float32Array(SPECK_COUNT * COPIES.length * 3);
    const speckSize = new Float32Array(SPECK_COUNT * COPIES.length);
    const base: number[][] = [];
    for (let i = 0; i < SPECK_COUNT; i++) {
      base.push([range(rng, -16, 16), range(rng, -10, 10), range(rng, -SLAB, 0), rng(), rng(), rng(), range(rng, 0.08, 0.22)]);
    }
    let si = 0;
    for (const k of COPIES) {
      for (const b of base) {
        speckPos.set([b[0], b[1], b[2] + k * SLAB], si * 3);
        speckPh.set([b[3], b[4], b[5]], si * 3);
        speckSize[si] = b[6];
        si++;
      }
    }
    const speckGeo = new THREE.BufferGeometry();
    speckGeo.setAttribute("position", new THREE.BufferAttribute(speckPos, 3));
    speckGeo.setAttribute("aPhase", new THREE.BufferAttribute(speckPh, 3));
    speckGeo.setAttribute("aSize", new THREE.BufferAttribute(speckSize, 1));
    const speckMat = new THREE.ShaderMaterial({
      vertexShader: SPECK_VERT,
      fragmentShader: SPECK_FRAG,
      uniforms: { uT: { value: 0 }, uPxH: { value: pxH }, uFog: { value: FOG }, cSpeck: { value: V3(v.speck) } },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: true,
    });
    const specks = new THREE.Points(speckGeo, speckMat);
    specks.frustumCulled = false;
    specks.renderOrder = 10;
    world.add(specks);
    disposables.push(speckGeo, speckMat);

    const post = new PostPipeline(pxW, pxH, {
      msaa: 4,
      depth: true,
      dof: { mode: "depth", focus: 7.5, band: 1.2, cocScale: 0.055, maxCoc: 0.022 },
      bloom: { strength: 0.45, threshold: 0.9, knee: 0.5 },
      vignette: { strength: 0.6, color: hexToLinear(v.web).map((c) => c * 0.35) as [number, number, number] },
      exposure: 1,
      grain: 0.015,
    });
    post.setCamera(cam);

    const tmp = new THREE.Color();
    return {
      render: (g, frame) => {
        const t = loopPhase(frame);
        // forward drift of exactly one slab per loop on a closed lateral path, gentle roll
        cam.position.set(1.1 * Math.sin(TAU * t), 0.7 * Math.sin(TAU * 2 * t + 0.6), 3 - SLAB * t);
        cam.rotation.set(0.06 * Math.sin(TAU * t + 1.1), 0.09 * Math.sin(TAU * t + 2.3), 0.14 * Math.sin(TAU * t));
        cam.updateMatrixWorld(true);
        speckMat.uniforms.uT.value = t;
        for (const tp of tips) {
          const pulse = 0.7 + 0.3 * Math.sin(TAU * (tp.cycles * t + tp.phase));
          tmp.copy(tipCol).multiplyScalar(tp.gain * pulse);
          tp.mat.color.copy(tmp);
        }
        post.render(g, scene, cam, grainFrame(frame));
      },
      dispose: () => {
        post.dispose();
        disposables.forEach((d) => d.dispose());
      },
    };
  };

export const NerveFibres: React.FC<{ variant: NerveVariant; loopCheck?: boolean }> = ({ variant }) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const create = useCallback(makeFactory(variant), [variant.id]);
  return <ThreeLook create={create} background={variant.haze} />;
};
