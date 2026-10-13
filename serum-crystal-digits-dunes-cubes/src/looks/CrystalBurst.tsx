import { useThree } from "@react-three/fiber";
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { BG_DITHER_GLSL } from "../common/glsl";
import { bgDitherOffset, Pipeline, sharedBlueNoise } from "../common/Pipeline";
import { mulberry32, Rng } from "../common/random";
import { SceneCanvas, TAU, useFrameRender } from "../common/SceneCanvas";

// Look 2 — Crystal Burst (20 s loop, 600 frames)

export type CrystalBurstProps = {
  base: string; // environment base tone (dominant)
  deep: string; // darkest tone (centre, gaps)
  strips: string[]; // main strip colours (white first)
  accents: string[]; // rarer accent strip colours
  tint: string; // shard attenuation tint
};

const LOOP = 600;
const SECTORS = 12; // pattern repeats every 30°
const PER_SECTOR = 35; // 12 × 35 = 420 shards
const SECTOR_ANGLE = TAU / SECTORS;

type Shard = {
  theta: number; // angle around the axis inside the sector
  tilt: number; // lift toward the camera
  z: number; // depth ring
  r0: number; // inner offset from the axis
  len: number;
  width: number;
  flat: number;
  roll: number;
  breathCycles: number;
  breathPhase: number;
};

// Seeded within one 30° sector, then replicated 12 times: rotating the burst
// by exactly one sector maps the set onto itself.
const SECTOR_SEEDED: Shard[] = (() => {
  const rng = mulberry32(0xc7a57a1);
  const rings = [
    // deep ring: long shards lying almost in the image plane (reach the edges)
    { n: 16, z: -2.6, tilt: [0.08, 0.3], len: [1.0, 1.4], r0: [0.0, 0.08], w: 1.15 },
    // middle ring: lifted toward the camera, tips land mid-frame
    { n: 11, z: -1.4, tilt: [0.4, 0.7], len: [0.7, 1.0], r0: [0.0, 0.15], w: 1.35 },
    // front ring: short, steep shards pointing at the camera around the heart
    { n: 8, z: -0.7, tilt: [0.55, 0.85], len: [0.6, 0.72], r0: [0.05, 0.3], w: 0.85 },
  ];
  const out: Shard[] = [];
  // frame half-width at the ring's depth (camera at z = 4, fov 60, 16:9)
  const halfWAt = (z: number) => (4 - z) * Math.tan(Math.PI / 6) * (16 / 9);
  const lerp = (r: Rng, [a, b]: number[]) => a + (b - a) * r();
  rings.forEach((ring) => {
    for (let i = 0; i < ring.n; i++) {
      out.push({
        theta: ((i + 0.15 + 0.7 * rng()) / ring.n) * SECTOR_ANGLE,
        tilt: lerp(rng, ring.tilt),
        z: ring.z + (rng() - 0.5) * 0.4,
        r0: lerp(rng, ring.r0),
        len: lerp(rng, ring.len) * halfWAt(ring.z),
        width: (0.4 + rng() * 0.5) * ring.w,
        flat: 0.45 + rng() * 0.45,
        roll: rng() * Math.PI,
        breathCycles: 1 + Math.floor(rng() * 2),
        breathPhase: rng() * TAU,
      });
    }
  });
  return out;
})();

// Draw order front ring → deep ring, so the depth test rejects hidden layers
// early (same image, far less shading work).
const SECTOR: Shard[] = [...SECTOR_SEEDED].reverse();

// Elongated faceted bipyramid along +X: inner tip at 0, widest at 0.22, sharp
// outer tip at 1. Hexagonal cross-section; flat shading via non-indexed normals.
const makeShardGeometry = () => {
  const sides = 6;
  const pos: number[] = [];
  const uvs: number[] = [];
  const ring: THREE.Vector3[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU;
    ring.push(new THREE.Vector3(0.42, Math.cos(a), Math.sin(a)));
  }
  const tipIn = new THREE.Vector3(0, 0, 0);
  const tipOut = new THREE.Vector3(1, 0, 0);
  const push = (v: THREE.Vector3, u: number, w: number) => {
    pos.push(v.x, v.y, v.z);
    uvs.push(u, w);
  };
  for (let i = 0; i < sides; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % sides];
    const w0 = i / sides;
    const w1 = (i + 1) / sides;
    push(tipIn, 0, (w0 + w1) / 2);
    push(b, 0.42, w1);
    push(a, 0.42, w0);
    push(a, 0.42, w0);
    push(b, 0.42, w1);
    push(tipOut, 1, (w0 + w1) / 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  // soften the facets: blend each face normal with the radial direction
  // away from the shard axis, so faces carry gradients like cut glass
  const nrm = g.attributes.normal;
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < nrm.count; i++) {
    n.fromBufferAttribute(nrm, i);
    v.fromBufferAttribute(p, i);
    const radial = new THREE.Vector3(0, v.y, v.z);
    if (radial.lengthSq() < 1e-6) radial.copy(n).setX(0);
    radial.normalize();
    n.multiplyScalar(0.8).addScaledVector(radial, 0.2).normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
};

// Procedural studio environment: dark base + many coloured light strips.
const makeEnvTexture = (p: CrystalBurstProps) => {
  const W = 512;
  const H = 256;
  const data = new Float32Array(W * H * 4);
  const rng = mulberry32(0x5e7);
  const base = new THREE.Color(p.base);
  const deep = new THREE.Color(p.deep);
  type Strip = { az: number; el: number; w: number; h: number; c: THREE.Color; k: number; tilt: number };
  const strips: Strip[] = [];
  const main = p.strips.map((s) => new THREE.Color(s));
  const acc = p.accents.map((s) => new THREE.Color(s));
  for (let i = 0; i < 56; i++) {
    const isAcc = i % 9 === 8;
    const pool = isAcc ? acc : main;
    const c = !isAcc && rng() < 0.4 ? main[0] : pool[Math.floor(rng() * pool.length) % pool.length];
    strips.push({
      az: rng() * TAU,
      el: (rng() * 2 - 1) * 1.2,
      w: 0.02 + rng() * 0.07,
      h: 0.2 + rng() * 0.7,
      c,
      k: (c === main[0] ? 6.5 : 2.6) * (0.5 + rng() * 0.8),
      tilt: (rng() - 0.5) * 1.2,
    });
  }
  for (let y = 0; y < H; y++) {
    const el = (0.5 - (y + 0.5) / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const az = ((x + 0.5) / W) * TAU;
      // base: deep → base with soft large-scale variation
      const t = 0.5 + 0.5 * Math.sin(az * 2 + 0.7) * Math.cos(el * 1.5);
      const col = deep.clone().lerp(base, 0.15 + 0.6 * t * t).multiplyScalar(0.7);
      // broad soft light around one hemisphere (a big studio softbox)
      const soft = Math.max(0, Math.cos(az - 1.2) * Math.cos(el - 0.3));
      col.add(base.clone().lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(0.55 * Math.pow(soft, 4)));
      for (const s of strips) {
        let da = az - s.az;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        const de = el - s.el;
        const u = da * Math.cos(s.tilt) + de * Math.sin(s.tilt);
        const v = -da * Math.sin(s.tilt) + de * Math.cos(s.tilt);
        const fu = Math.max(0, 1 - Math.pow(Math.abs(u) / s.w, 4));
        const fv = Math.max(0, 1 - Math.pow(Math.abs(v) / s.h, 6));
        const f = fu * fv;
        if (f > 0) col.add(s.c.clone().multiplyScalar(s.k * f));
      }
      const i = (y * W + x) * 4;
      data[i] = col.r;
      data[i + 1] = col.g;
      data[i + 2] = col.b;
      data[i + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
};

// Thickness variation for the thin-film iridescence (300–800 nm range).
const makeThicknessMap = () => {
  const N = 64;
  const rng = mulberry32(0x7a1c);
  const d = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const x = i % N;
    const y = (i / N) | 0;
    const v = 0.5 + 0.3 * Math.sin((x / N) * TAU * 2 + 0.5) * Math.cos((y / N) * TAU * 3) + 0.15 * Math.sin((y / N) * TAU + rng() * 0.01);
    const b = Math.max(0, Math.min(255, Math.round(v * 255)));
    d[i * 4] = b;
    d[i * 4 + 1] = b;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};

const Scene: React.FC<CrystalBurstProps> = (p) => {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);

  const built = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 30);
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);

    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = makeEnvTexture(p);
    const envRT = pmrem.fromEquirectangular(envTex);
    envTex.dispose();
    pmrem.dispose();

    const bgMat = new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uBase: { value: new THREE.Color(p.base) },
        uDeep: { value: new THREE.Color(p.deep) },
        uAspect: { value: 16 / 9 },
        uBlueNoise: { value: sharedBlueNoise },
        uBnOffset: { value: new THREE.Vector3() },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
      fragmentShader: /* glsl */ `
        ${BG_DITHER_GLSL}
        uniform vec3 uBase; uniform vec3 uDeep; uniform float uAspect;
        varying vec2 vUv;
        void main() {
          vec2 d = (vUv - 0.5) * vec2(uAspect, 1.0);
          float r = length(d);
          vec3 c = mix(uDeep, uBase * 0.55, smoothstep(0.0, 0.9, r));
          c += bgDither(gl_FragCoord.xy) * (1.0 / 1024.0);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    bg.frustumCulled = false;
    bg.renderOrder = -10;
    scene.add(bg);

    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(p.tint),
      metalness: 0.3,
      roughness: 0.05,
      iridescence: 1,
      iridescenceIOR: 1.49,
      iridescenceThicknessRange: [300, 800],
      iridescenceThicknessMap: makeThicknessMap(),
      envMap: envRT.texture,
      envMapIntensity: 1.0,
      flatShading: false,
    });
    // Fake dispersion: sample the environment with slightly split R/G/B
    // reflection vectors.
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <envmap_physical_pars_fragment>",
        THREE.ShaderChunk.envmap_physical_pars_fragment.replace(
          "vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );",
          `vec3 nW = inverseTransformDirection( normal, viewMatrix );
           vec3 dispAxis = normalize( cross( reflectVec, nW ) + 1e-4 );
           vec4 envMapColor;
           envMapColor.r = textureCubeUV( envMap, envMapRotation * normalize( reflectVec + dispAxis * 0.015 ), roughness ).r;
           envMapColor.g = textureCubeUV( envMap, envMapRotation * reflectVec, roughness ).g;
           envMapColor.b = textureCubeUV( envMap, envMapRotation * normalize( reflectVec - dispAxis * 0.015 ), roughness ).b;
           envMapColor.a = 1.0;`,
        ),
      );
    };
    material.customProgramCacheKey = () => "crystal-dispersion";

    const geo = makeShardGeometry();
    const count = SECTORS * PER_SECTOR;
    const mesh = new THREE.InstancedMesh(geo, material, count);
    mesh.frustumCulled = false;
    const group = new THREE.Group();
    group.add(mesh);
    scene.add(group);

    const pipeline = new Pipeline({
      period: LOOP,
      samples: 4,
      bloom: { threshold: 1.2, strength: 0.18, knee: 0.2 },
      ca: 0.006,
      vignette: 0.45,
      vignetteColor: new THREE.Color(p.deep),
      grain: 0.015,
      tonemap: "aces",
      exposure: 1.35,
    });
    return { scene, camera, mesh, group, material, bgMat, pipeline, envRT };
  }, [gl, p]);

  useEffect(
    () => () => {
      built.pipeline.dispose();
      built.envRT.dispose();
    },
    [built],
  );

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      a: new THREE.Matrix4(),
    }),
    [],
  );

  useFrameRender((frame) => {
    const { scene, camera, mesh, group, material, bgMat, pipeline } = built;
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const u = f / LOOP;
    const ph = u * TAU;
    camera.aspect = size.width / size.height;
    // gentle zoom breath ±3%, whole cycles
    camera.zoom = 1 + 0.03 * Math.sin(ph * 2);
    camera.updateProjectionMatrix();
    bgMat.uniforms.uAspect.value = camera.aspect;
    bgMat.uniforms.uBnOffset.value.copy(bgDitherOffset(frame, LOOP));

    // exactly one 30° pattern repeat per loop
    group.rotation.z = u * SECTOR_ANGLE;
    // environment strips turn exactly 360° per loop
    material.envMapRotation.set(0.35, -ph, 0.2 * Math.sin(ph));

    let i = 0;
    for (let s = 0; s < SECTORS; s++) {
      for (const sh of SECTOR) {
        const breath = 1 + 0.06 * Math.sin(ph * sh.breathCycles + sh.breathPhase);
        const L = sh.len * breath;
        // order: scale → roll → offset → tilt toward camera → spin around axis
        const m = tmp.m.makeScale(L, sh.width, sh.width * sh.flat);
        m.premultiply(tmp.a.makeRotationX(sh.roll));
        m.premultiply(tmp.a.makeTranslation(sh.r0, 0, 0));
        m.premultiply(tmp.a.makeRotationY(-sh.tilt));
        m.premultiply(tmp.a.makeRotationZ(sh.theta + s * SECTOR_ANGLE));
        m.premultiply(tmp.a.makeTranslation(0, 0, sh.z));
        mesh.setMatrixAt(i++, m);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    pipeline.render(gl, scene, camera, frame);
  });
  return null;
};

export const CrystalBurst: React.FC<CrystalBurstProps> = (props) => (
  <SceneCanvas>
    <Scene {...props} />
  </SceneCanvas>
);
