/**
 * Look 5 — Coin Growth (10s story).
 *   0–1s     coins in soft light, rings glowing, camera low and wide
 *   1–6s     24 bars rise one by one, left to right (12 frames each, staggered)
 *   5–8.5s   a line chart with candles draws across above the bars
 *   8.5–10s  hold, gentle pulse on the bars and the chart head
 * Glossy floor = mirrored copy of the scene under a semi-transparent floor.
 */
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { FAT_LINE_FRAGMENT_HEADER, FAT_LINE_VERTEX_HEADER, buildFatLineGeometry } from "../lib/fatLines";
import { PostSettings } from "../lib/Post";
import { mulberry32 } from "../lib/random";
import { Stage, useAssets, useBufferSize } from "../lib/Stage";

export type CoinGrowthProps = {
  coin: string;
  bars: string;
  chart: string;
  rings: string;
  exposure: number;
  grain: number;
};

const DURATION = 300;
const FOV = 32;
const COIN_H = 0.075;
const BARS = 24;

const col = (hex: string) => new THREE.Color(hex);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// ------------------------------------------------------------------ coin
const makeCoinGeometry = () => {
  const h = COIN_H / 2;
  // lathe profile (radius, y): plain face with a simple raised ring, bevelled rim
  const prof: [number, number][] = [
    [0.0, h - 0.006],
    [0.36, h - 0.006],
    [0.375, h],
    [0.43, h],
    [0.445, h - 0.004],
    [0.48, h - 0.006],
    [0.5, h - 0.016],
    [0.5, -h + 0.016],
    [0.48, -h + 0.006],
    [0.445, -h + 0.004],
    [0.43, -h],
    [0.375, -h],
    [0.36, -h + 0.006],
    [0.0, -h + 0.006],
  ];
  const SEG = 64;
  const g = new THREE.LatheGeometry(
    prof.map(([r, y]) => new THREE.Vector2(r, y)).reverse(),
    SEG,
  );
  // reeded edge: alternate the rim radius around the circumference
  const pos = g.getAttribute("position");
  const n = prof.length;
  for (let i = 0; i <= SEG; i++) {
    for (let j = 0; j < n; j++) {
      const v = i * n + j;
      const x = pos.getX(v);
      const z = pos.getZ(v);
      const r = Math.hypot(x, z);
      if (r > 0.495) {
        const k = i % 2 === 0 ? 1 : 0.984;
        pos.setXYZ(v, x * k, pos.getY(v), z * k);
      }
    }
  }
  g.computeVertexNormals();
  return g;
};

// ------------------------------------------------------------------ layout
type Stack = { x: number; z: number; count: number };
const BAR_W = 0.42;

const barX = (i: number) => -4.2 + i * 0.36;
const barZ = (i: number) => 0.6 - i * 0.12;

const barHeights = (() => {
  const rng = mulberry32(1108845429);
  const hs: number[] = [];
  for (let i = 0; i < BARS; i++) {
    const trend = 0.35 + 4.2 * Math.pow(i / (BARS - 1), 1.25);
    const dip = i > 2 && rng() < 0.28 ? -0.35 - 0.3 * rng() : 0.15 * (rng() - 0.5);
    hs.push(Math.max(0.25, trend + dip));
  }
  return hs;
})();

const buildLayout = () => {
  const rng = mulberry32(11088);
  const stacks: Stack[] = [];
  let guard = 0;
  while (stacks.length < 20 && guard++ < 5000) {
    const x = -6 + rng() * 11.5;
    const z = -4.2 + rng() * 6.6;
    // keep clear of the bar row and of other stacks
    let ok = true;
    for (let i = 0; i < BARS; i++) if (Math.hypot(x - barX(i), z - barZ(i)) < 0.75) ok = false;
    // the strip just in front of the bars stays clear so the bars read
    // the bars are the backdrop: stacks stand in front of the bar row (and a
    // few far behind), leaving the strip just behind the bars clear
    const rowZ = 0.6 - ((x + 4.2) / 0.36) * 0.12;
    if (z < rowZ && z > rowZ - 2.4 && x > -4.6 && x < 4.4) ok = false;
    for (const s of stacks) if (Math.hypot(x - s.x, z - s.z) < 1.08) ok = false;
    if (!ok) continue;
    // taller toward the right and the back, like the chart
    const bias = clamp01((x + 6) / 11.5) * 0.6 + clamp01((-z + 2.4) / 6.2) * 0.4;
    const front = 1;
    const count = Math.round(8 + 32 * clamp01(bias * 0.9 + rng() * 0.35) * front);
    stacks.push({ x, z, count });
  }
  const mats: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s1 = new THREE.Vector3(1, 1, 1);
  for (const s of stacks) {
    for (let c = 0; c < s.count; c++) {
      e.set((rng() - 0.5) * 0.03, rng() * Math.PI * 2, (rng() - 0.5) * 0.03);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(s.x + (rng() - 0.5) * 0.035, COIN_H * (c + 0.5), s.z + (rng() - 0.5) * 0.035), q, s1);
      mats.push(m.clone());
    }
  }
  // loose coins flat on the floor, mostly in front
  for (let i = 0; i < 26; i++) {
    const x = -6.5 + rng() * 12.5;
    const z = 1.2 + rng() * 2.6;
    e.set((rng() - 0.5) * 0.05, rng() * Math.PI * 2, (rng() - 0.5) * 0.05);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, COIN_H * 0.5, z), q, s1);
    mats.push(m.clone());
  }
  return mats;
};

// ------------------------------------------------------------------ shaders
const BAR_VS = /* glsl */ `
attribute float aIndex;
varying vec3 vN;
varying vec3 vWp;
varying vec2 vUv;
varying float vIdx;
void main() {
  vUv = uv;
  vIdx = aIndex;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const BAR_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uGain;
uniform float uMirror;
varying vec3 vN;
varying vec3 vWp;
varying vec2 vUv;
varying float vIdx;
void main() {
  vec3 V = normalize(cameraPosition - vWp);
  float fr = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
  // bright edges of each face
  vec2 e = min(vUv, 1.0 - vUv);
  float edge = 1.0 - smoothstep(0.0, 0.07, min(e.x, e.y));
  // vertical gradient: brighter toward the top
  float g = 0.55 + 0.45 * smoothstep(0.0, 1.0, vUv.y);
  vec3 c = uColor * (0.38 + 0.5 * fr + 0.35 * edge) * g * uGain;
  if (uMirror > 0.5) c *= 0.35 * smoothstep(-3.0, 0.0, vWp.y);
  gl_FragColor = vec4(c, 1.0);
}`;

const LINE_VS = /* glsl */ `
${FAT_LINE_VERTEX_HEADER}
attribute float aU;
varying float vU;
varying float vY;
void main() {
  vU = aU;
  vY = (modelMatrix * vec4(mix(aA, aB, aCorner.x), 1.0)).y;
  gl_Position = fatLinePosition(projectionMatrix * modelViewMatrix, 1.0);
}`;
const LINE_FS = /* glsl */ `
${FAT_LINE_FRAGMENT_HEADER}
uniform vec3 uColor;
uniform float uGain;
uniform float uProgress; // draw-on head (0..1)
uniform float uMirror;
varying float vU;
varying float vY;
void main() {
  if (vU > uProgress) discard;
  float head = exp(-pow((uProgress - vU) / 0.025, 2.0));
  vec3 c = uColor * uGain * (1.0 + head * 2.5) * fatLineCoverage();
  if (uMirror > 0.5) c *= 0.3 * smoothstep(-4.0, 0.0, vY);
  gl_FragColor = vec4(c, 1.0);
}`;

const DOT_VS = /* glsl */ `
uniform vec2 uResolution;
uniform float uSize;
attribute float aSize;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = uSize * aSize * uResolution.y / 1080.0 * (8.0 / -mv.z);
  gl_PointSize = max(s, 1.5);
  vA = clamp(s / 1.5, 0.0, 1.0) * step(0.001, aSize);
}`;
const DOT_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uGain;
varying float vA;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  float a = exp(-r * 3.0) * smoothstep(1.0, 0.75, r);
  gl_FragColor = vec4(uColor * a * vA * uGain, 1.0);
}`;

const FLOOR_VS = /* glsl */ `
varying vec3 vWp;
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWp = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const FLOOR_FS = /* glsl */ `
uniform vec3 uTint;
varying vec3 vWp;
void main() {
  vec3 V = normalize(cameraPosition - vWp);
  float fres = pow(1.0 - max(V.y, 0.0), 3.0);
  // glossy black: the mirrored scene shows through, more at grazing angles
  float alpha = mix(0.8, 0.45, fres);
  float far = smoothstep(4.0, 22.0, length(vWp.xz));
  gl_FragColor = vec4(uTint * (0.6 + 0.4 * fres) * (1.0 - far), mix(alpha, 1.0, far));
}`;

const additive = { transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending } as const;

type Built = {
  group: THREE.Group;
  barMat: THREE.ShaderMaterial;
  lineMat: THREE.ShaderMaterial;
  candleMat: THREE.ShaderMaterial;
  ringMats: THREE.ShaderMaterial[];
  headMat: THREE.ShaderMaterial;
  ringGroup: THREE.Group;
  candleGroup: THREE.Group;
  head: THREE.Points;
  candles: THREE.Mesh[];
};

const chartPoints = () => {
  const rng = mulberry32(5150);
  const pts: THREE.Vector3[] = [];
  const N = 60;
  for (let k = 0; k <= N; k++) {
    const f = (k / N) * (BARS - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(BARS - 1, i0 + 1);
    const t = f - i0;
    const h = barHeights[i0] * (1 - t) + barHeights[i1] * t;
    const x = barX(0) + f * 0.36;
    const z = barZ(0) - f * 0.12 + 0.35;
    const wig = (rng() - 0.5) * 0.55 + Math.sin(k * 0.9) * 0.18;
    pts.push(new THREE.Vector3(x, h * 0.92 + 0.75 + wig, z));
  }
  return pts;
};

const buildScene = (p: CoinGrowthProps, coinGeo: THREE.BufferGeometry, coinMats: THREE.Matrix4[], resolution: THREE.Vector2, mirror: boolean): Built => {
  const group = new THREE.Group();
  const M = mirror ? 1 : 0;

  // coins
  const coinMat = new THREE.MeshStandardMaterial({ color: col(p.coin), metalness: 1, roughness: 0.3 });
  const coins = new THREE.InstancedMesh(coinGeo, coinMat, coinMats.length);
  coinMats.forEach((m, i) => coins.setMatrixAt(i, m));
  coins.frustumCulled = false;
  group.add(coins);

  // bars (unit box, origin at its base; scaled per frame)
  const box = new THREE.BoxGeometry(BAR_W, 1, BAR_W);
  box.translate(0, 0.5, 0);
  const idx = new Float32Array(BARS);
  for (let i = 0; i < BARS; i++) idx[i] = i;
  box.setAttribute("aIndex", new THREE.InstancedBufferAttribute(idx, 1));
  const barMat = new THREE.ShaderMaterial({
    vertexShader: BAR_VS,
    fragmentShader: BAR_FS,
    uniforms: { uColor: { value: col(p.bars) }, uGain: { value: 1 }, uMirror: { value: M } },
    ...additive,
  });
  const bars = new THREE.InstancedMesh(box, barMat, BARS);
  bars.frustumCulled = false;
  bars.name = "bars";
  group.add(bars);

  // line chart
  const cp = chartPoints();
  const a: number[] = [];
  const b: number[] = [];
  const ua: number[] = [];
  const ub: number[] = [];
  for (let k = 0; k + 1 < cp.length; k++) {
    a.push(...cp[k].toArray());
    b.push(...cp[k + 1].toArray());
    ua.push(k / (cp.length - 1));
    ub.push((k + 1) / (cp.length - 1));
  }
  const lineMat = new THREE.ShaderMaterial({
    vertexShader: LINE_VS,
    fragmentShader: LINE_FS,
    uniforms: {
      uResolution: { value: resolution },
      uWidth: { value: 1.7 },
      uColor: { value: col(p.chart) },
      uGain: { value: 1.0 },
      uProgress: { value: 0 },
      uMirror: { value: M },
    },
    ...additive,
  });
  const line = new THREE.Mesh(buildFatLineGeometry(a, b, { aU: { size: 1, a: ua, b: ub } }), lineMat);
  line.frustumCulled = false;
  group.add(line);

  // candles: a thin wick + a small body at every second chart point
  const candleMat = new THREE.ShaderMaterial({
    vertexShader: LINE_VS,
    fragmentShader: LINE_FS,
    uniforms: {
      uResolution: { value: resolution },
      uWidth: { value: 3.2 },
      uColor: { value: col(p.chart) },
      uGain: { value: 1.3 },
      uProgress: { value: 2 },
      uMirror: { value: M },
    },
    ...additive,
  });
  const candleGroup = new THREE.Group();
  const candles: THREE.Mesh[] = [];
  const rng = mulberry32(777);
  for (let k = 1; k < cp.length; k += 2) {
    const c = cp[k];
    const hW = 0.18 + 0.25 * rng();
    const body = 0.08 + 0.14 * rng();
    const ca: number[] = [];
    const cb: number[] = [];
    // wick
    ca.push(0, -hW, 0);
    cb.push(0, hW, 0);
    // body outline (a slim rectangle)
    const w = 0.035;
    const corners = [
      [-w, -body],
      [w, -body],
      [w, body],
      [-w, body],
    ];
    for (let q = 0; q < 4; q++) {
      const s0 = corners[q];
      const s1 = corners[(q + 1) % 4];
      ca.push(s0[0], s0[1], 0);
      cb.push(s1[0], s1[1], 0);
    }
    const zeros = ca.map(() => 0).slice(0, ca.length / 3);
    const g = buildFatLineGeometry(ca, cb, { aU: { size: 1, a: zeros, b: zeros } });
    const m = new THREE.Mesh(g, candleMat);
    m.position.copy(c).add(new THREE.Vector3(0, 0.05, 0.02));
    m.userData.u = k / (cp.length - 1);
    m.frustumCulled = false;
    candleGroup.add(m);
    candles.push(m);
  }
  group.add(candleGroup);

  // chart head
  const hg = new THREE.BufferGeometry();
  hg.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
  hg.setAttribute("aSize", new THREE.Float32BufferAttribute([1], 1));
  const headMat = new THREE.ShaderMaterial({
    vertexShader: DOT_VS,
    fragmentShader: DOT_FS,
    uniforms: { uResolution: { value: resolution }, uSize: { value: 26 }, uColor: { value: col(p.chart).lerp(new THREE.Color(1, 1, 1), 0.5) }, uGain: { value: 0 } },
    ...additive,
  });
  const head = new THREE.Points(hg, headMat);
  head.frustumCulled = false;
  group.add(head);

  // rings: 3 concentric arcs of dots and dashes on the floor, behind
  const ringGroup = new THREE.Group();
  ringGroup.position.set(0.3, 0.03, -3.0);
  const ringMats: THREE.ShaderMaterial[] = [];
  const radii = [5.0, 6.0, 7.1];
  radii.forEach((R, ri) => {
    const dotPos: number[] = [];
    const dotSize: number[] = [];
    const da: number[] = [];
    const dbb: number[] = [];
    const span = Math.PI * 2;
    const N = Math.round(R * 9);
    for (let k = 0; k <= N; k++) {
      const ang = -Math.PI / 2 - span / 2 + (k / N) * span;
      const x = Math.cos(ang) * R;
      const z = Math.sin(ang) * R;
      // inner and outer rings: long glowing dashes; middle ring: a row of dots
      const pattern = (k + ri * 3) % 9;
      if (ri === 1) {
        dotPos.push(x, 0, z);
        dotSize.push(ri === 1 ? 1.0 : 1.4);
      } else if (pattern < 7) {
        const ang2 = ang + (span / N) * 1.0;
        da.push(x, 0, z);
        dbb.push(Math.cos(ang2) * R, 0, Math.sin(ang2) * R);
      }
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.Float32BufferAttribute(dotPos, 3));
    dg.setAttribute("aSize", new THREE.Float32BufferAttribute(dotSize, 1));
    const dm = new THREE.ShaderMaterial({
      vertexShader: DOT_VS,
      fragmentShader: DOT_FS,
      uniforms: { uResolution: { value: resolution }, uSize: { value: 14 }, uColor: { value: col(p.rings) }, uGain: { value: mirror ? 0.4 : 2.2 } },
      ...additive,
    });
    const dots = new THREE.Points(dg, dm);
    dots.frustumCulled = false;
    ringGroup.add(dots);
    ringMats.push(dm);
    if (da.length) {
      const zeros = da.map(() => 0).slice(0, da.length / 3);
      const lm = new THREE.ShaderMaterial({
        vertexShader: LINE_VS,
        fragmentShader: LINE_FS,
        uniforms: {
          uResolution: { value: resolution },
          uWidth: { value: 14 },
          uColor: { value: col(p.rings) },
          uGain: { value: mirror ? 0.6 : 3.4 },
          uProgress: { value: 2 },
          uMirror: { value: 0 },
        },
        ...additive,
      });
      const dashes = new THREE.Mesh(buildFatLineGeometry(da, dbb, { aU: { size: 1, a: zeros, b: zeros } }), lm);
      dashes.frustumCulled = false;
      ringGroup.add(dashes);
      ringMats.push(lm);
    }
  });
  group.add(ringGroup);

  // coloured glow from the bars onto the coins
  const glowA = new THREE.PointLight(col(p.bars), 0, 9, 1.6);
  glowA.position.set(-1.5, 1.2, 0.4);
  glowA.name = "glowA";
  const glowB = new THREE.PointLight(col(p.bars), 0, 11, 1.6);
  glowB.position.set(2.5, 2.4, -1.0);
  glowB.name = "glowB";
  group.add(glowA, glowB);

  if (mirror) {
    group.scale.y = -1;
    // reflection first, then the glossy floor over it, then the real scene
    group.traverse((o) => (o.renderOrder = -2));
  }
  return { group, barMat, lineMat, candleMat, ringMats, headMat, ringGroup, candleGroup, head, candles };
};

type Assets = { ready: true };

const Scene: React.FC<CoinGrowthProps> = (p) => {
  const frame = useCurrentFrame();
  const { camera, gl, scene } = useThree();
  const buf = useBufferSize();
  const resolution = useMemo(() => new THREE.Vector2(1, 1), []);
  const coinGeo = useMemo(makeCoinGeometry, []);
  const coinMats = useMemo(buildLayout, []);
  const cp = useMemo(chartPoints, []);

  const env = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const rt = pm.fromScene(new RoomEnvironment(), 0.04);
    pm.dispose();
    return rt;
  }, [gl]);
  useLayoutEffect(() => {
    scene.environment = env.texture;
    // the studio environment is only a soft sheen on the metal (scene-level
    // intensity: per-material envMapIntensity does not scale scene.environment)
    scene.environmentIntensity = 0.07;
    return () => {
      scene.environmentIntensity = 1;
      scene.environment = null;
      env.dispose();
    };
  }, [scene, env]);

  const built = useMemo(() => {
    const main = buildScene(p, coinGeo, coinMats, resolution, false);
    const mirror = buildScene(p, coinGeo, coinMats, resolution, true);
    const floorMat = new THREE.ShaderMaterial({
      vertexShader: FLOOR_VS,
      fragmentShader: FLOOR_FS,
      uniforms: { uTint: { value: new THREE.Color(0.004, 0.006, 0.01) } },
      transparent: true,
      depthWrite: true,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = -1;
    const key = new THREE.DirectionalLight(0xdfe8ff, 0.45);
    key.position.set(-4, 7, 6);
    const rim = new THREE.DirectionalLight(col(p.bars), 0.45);
    rim.position.set(3, 3, -8);
    const lights = new THREE.Group();
    lights.add(key, rim);
    return { main, mirror, floor, lights };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinGeo, coinMats]);

  useLayoutEffect(() => {
    resolution.set(buf.w, buf.h);
    const f = frame;
    // ---- camera: low & wide -> pushed in and lifted
    const cam = camera as THREE.PerspectiveCamera;
    const k = interpolate(f, [0, 255], [0, 1], { easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const hold = interpolate(f, [255, 300], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const pos = new THREE.Vector3().lerpVectors(new THREE.Vector3(-1.4, 2.4, 13.5), new THREE.Vector3(-0.6, 3.0, 8.2), k);
    pos.z -= 0.2 * hold;
    const tgt = new THREE.Vector3().lerpVectors(new THREE.Vector3(-0.4, 0.9, -0.8), new THREE.Vector3(0.3, 1.95, -1.2), k);
    cam.fov = FOV;
    cam.near = 0.1;
    cam.far = 80;
    cam.position.copy(pos);
    cam.lookAt(tgt);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    // ---- bars: rise one by one (12 frames each, staggered)
    const pulse = 1 + 0.08 * Math.sin(((f - 255) / 45) * Math.PI * 2) * hold;
    const m = new THREE.Matrix4();
    let risen = 0;
    for (const set of [built.main, built.mirror]) {
      const bars = set.group.getObjectByName("bars") as THREE.InstancedMesh;
      for (let i = 0; i < BARS; i++) {
        const start = 30 + i * 6;
        const t = clamp01((f - start) / 12);
        const e = t === 0 ? 0 : Easing.out(Easing.back(1.3))(t);
        const h = Math.max(1e-4, barHeights[i] * e);
        if (set === built.main) risen += t;
        m.makeScale(1, h, 1).setPosition(barX(i), 0, barZ(i));
        bars.setMatrixAt(i, m);
      }
      bars.instanceMatrix.needsUpdate = true;
      set.barMat.uniforms.uGain.value = pulse;
      // ---- chart draws left to right, 5s -> 8.5s
      const prog = interpolate(f, [150, 255], [0, 1], { easing: Easing.inOut(Easing.quad), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      set.lineMat.uniforms.uProgress.value = f < 150 ? -1 : prog;
      // head position along the polyline
      const fi = prog * (cp.length - 1);
      const i0 = Math.min(cp.length - 2, Math.floor(fi));
      const hp = new THREE.Vector3().lerpVectors(cp[i0], cp[i0 + 1], fi - i0);
      set.head.position.copy(hp);
      set.headMat.uniforms.uGain.value = (f < 150 ? 0 : 1) * (1 + 0.25 * Math.sin(((f - 255) / 30) * Math.PI * 2) * hold) * (set === built.mirror ? 0.3 : 1);
      // candles pop in behind the head
      for (const c of set.candles) {
        const u = c.userData.u as number;
        const ct = clamp01((prog - u) / 0.05) * (f >= 150 ? 1 : 0);
        const s = ct === 0 ? 1e-4 : Easing.out(Easing.back(1.6))(ct);
        c.scale.setScalar(Math.max(1e-4, s));
      }
      // rings glow and turn slowly
      set.ringGroup.rotation.y = interpolate(f, [0, 300], [0.12, -0.12]);
      const glowA = set.group.getObjectByName("glowA") as THREE.PointLight;
      const glowB = set.group.getObjectByName("glowB") as THREE.PointLight;
      glowA.intensity = 0.5 * clamp01(risen / 12) * pulse;
      glowB.intensity = 1.2 * clamp01((risen - 8) / 16) * pulse;
    }
  }, [frame, camera, built, buf.w, buf.h, resolution, cp]);

  return (
    <>
      <primitive object={built.lights} />
      <primitive object={built.mirror.group} />
      <primitive object={built.floor} />
      <primitive object={built.main.group} />
    </>
  );
};

export const CoinGrowth: React.FC<CoinGrowthProps> = (props) => {
  const assets = useAssets<Assets>("coin scene", async () => ({ ready: true }));
  const post: PostSettings = useMemo(
    () => ({
      exposure: props.exposure,
      toneMap: "aces",
      dof: { focus: 10.5, aperture: 0.28, maxBlur: 0.014, nearScale: 3.0 },
      bloom: { strength: 0.75, threshold: 0.5, knee: 0.35, radius: 0.85 },
      grain: props.grain,
      dither: true,
      vignette: 0.3,
      clear: [0, 0, 0],
      noisePeriod: DURATION,
    }),
    [props.exposure, props.grain],
  );
  if (!assets) return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
  return (
    <Stage background="#000000" post={post} camera={{ fov: FOV, near: 0.1, far: 80 }}>
      <Scene {...props} />
    </Stage>
  );
};
