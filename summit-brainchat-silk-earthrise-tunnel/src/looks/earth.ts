// Look 4 — Earth Grid Rise. The top of a night Earth as a horizon, NASA
// Black Marble city lights + darkened Blue Marble base, cyan atmosphere rim,
// a geodesic (icosphere detail 3) grid, orange arcs between cities and
// pulsing location rings. The globe sways 20° and back (cosine) per loop.
import * as THREE from "three";
import { staticFile } from "remotion";
import { LOOP, TAU, mulberry32, range, oscC, fract } from "../lib/rng";
import { makeBackground, makeScreenLines, makeScreenPoints } from "../lib/lines";
import type { BuildCtx, LookHandle } from "../lib/types";

export type EarthParams = {
  skyTop: string;
  skyHorizon: string;
  grid: string;
  gridOpacity: number;
  arc: string;
  ring: string;
  rim: string;
  oceanTint: string;
  landTint: string;
  cityLights: string;
  exposure: number;
};

const R = 10;
const SEED = 0xea27;

// [lat, lon] of cities used for rings and arc endpoints
const CITIES: [number, number][] = [
  [51.5, -0.1], [48.9, 2.35], [52.5, 13.4], [40.4, -3.7], [41.9, 12.5],
  [55.75, 37.6], [41.0, 29.0], [30.0, 31.2], [59.3, 18.0], [52.2, 21.0],
  [50.45, 30.5], [33.6, -7.6], [37.98, 23.7], [35.7, 51.4], [60.17, 24.9],
  [45.46, 9.19], [38.7, -9.14], [53.35, -6.26], [36.75, 3.05], [47.5, 19.04],
  [25.2, 55.3], [64.1, -21.9], [24.7, 46.7], [19.1, 72.9], [28.6, 77.2],
  [40.7, -74.0], [45.5, -73.6], [6.5, 3.4], [-1.3, 36.8], [9.0, 38.7],
  [43.2, 76.9], [41.3, 69.2], [59.9, 30.3], [56.95, 24.1],
];

/** lat/lon -> position on three's SphereGeometry UV convention. */
function llToVec(lat: number, lon: number, r: number) {
  const phi = THREE.MathUtils.degToRad(lon + 180);
  const theta = THREE.MathUtils.degToRad(90 - lat);
  return new THREE.Vector3(-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta));
}

function loadTexture(url: string) {
  return new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, reject);
  });
}

export function buildEarth(ctx: BuildCtx, p: EarthParams): LookHandle {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, ctx.width / ctx.height, 0.5, 200);

  scene.add(
    makeBackground(
      /* glsl */ `
      in vec2 vUv; uniform vec3 uTop, uHor;
      void main(){
        float t = smoothstep(0.35, 1.0, vUv.y);
        vec3 c = mix(uHor, uTop, t);
        // a little lighter towards the upper right, as in a lit sky
        c *= 1.0 + 0.25 * smoothstep(0.4, 1.2, vUv.x + 0.3 * vUv.y);
        gl_FragColor = vec4(c, 1.0);
      }`,
      { uTop: { value: new THREE.Color(p.skyTop) }, uHor: { value: new THREE.Color(p.skyHorizon) } },
    ),
  );

  // nested groups: tilt (fixed) > spin (sway)
  const tilt = new THREE.Group();
  tilt.rotation.x = THREE.MathUtils.degToRad(12);
  scene.add(tilt);
  const spin = new THREE.Group();
  tilt.add(spin);
  const baseYaw = THREE.MathUtils.degToRad(-90 - 32);

  // ---- globe -------------------------------------------------------------
  const globeMat = new THREE.ShaderMaterial({
    uniforms: {
      tNight: { value: null },
      tDay: { value: null },
      uOcean: { value: new THREE.Color(p.oceanTint) },
      uLand: { value: new THREE.Color(p.landTint) },
      uCity: { value: new THREE.Color(p.cityLights) },
      uRim: { value: new THREE.Color(p.rim) },
    },
    vertexShader: /* glsl */ `
      out vec2 vUv; out vec3 vN; out vec3 vV;
      void main(){
        vUv = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tNight, tDay;
      uniform vec3 uOcean, uLand, uCity, uRim;
      in vec2 vUv; in vec3 vN; in vec3 vV;
      void main(){
        vec3 day = texture(tDay, vUv).rgb;
        vec3 night = texture(tNight, vUv).rgb;
        float dl = dot(day, vec3(0.2126, 0.7152, 0.0722));
        // land vs ocean from the Blue Marble (ocean is strongly blue)
        float land = smoothstep(0.02, 0.10, (day.r + day.g) * 0.5 - day.b * 0.55);
        // Blue Marble gives the land/ocean split (darkened, tinted); the Black
        // Marble's own faint terrain gives the relief.
        float relief = dot(night, vec3(0.2, 0.3, 0.5));
        vec3 base = mix(uOcean, uLand, land) * (0.6 + 0.5 * min(dl, 0.35) + 2.2 * relief);
        // city lights: warm pixels of the Black Marble
        float city = smoothstep(0.0, 0.18, night.r - night.b) * (0.6 + 2.5 * dot(night, vec3(0.33)));
        float NdV = max(dot(normalize(vN), normalize(vV)), 0.0);
        float rim = pow(1.0 - NdV, 3.0);
        vec3 c = base + uCity * city * 7.0 + uRim * (rim * 0.4 + pow(1.0 - NdV, 10.0) * 1.4);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 256, 192), globeMat);
  spin.add(globe);

  // atmosphere: analytic glow around the limb (closest-approach distance)
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { uRim: { value: new THREE.Color(p.rim) }, uCenter: { value: new THREE.Vector3() }, uR: { value: R } },
    vertexShader: `out vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uRim, uCenter; uniform float uR;
      in vec3 vW;
      void main(){
        vec3 d = normalize(vW - cameraPosition);
        vec3 oc = uCenter - cameraPosition;
        float tca = dot(oc, d);
        float dist = length(oc - d * tca);
        float x = max(dist - uR, 0.0) / uR;
        float g = exp(-x / 0.01) * 1.0 + exp(-x / 0.06) * 0.4 + exp(-x / 0.3) * 0.18;
        g *= 1.0 - smoothstep(0.6, 0.95, x);
        gl_FragColor = vec4(uRim * g, 1.0);
      }`,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 2.0, 128, 96), atmoMat);
  scene.add(atmo);

  // ---- geodesic grid ----------------------------------------------------------
  // 3 levels of 4:1 subdivision = 1280 faces; three.js expresses that as detail 7
  const ico = new THREE.IcosahedronGeometry(R * 1.012, 7);
  const ipos = ico.attributes.position.array as Float32Array;
  const vkey = (i: number) => `${ipos[i * 3].toFixed(3)},${ipos[i * 3 + 1].toFixed(3)},${ipos[i * 3 + 2].toFixed(3)}`;
  const vmap = new Map<string, number>();
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < ipos.length / 3; i++) {
    const k = vkey(i);
    if (!vmap.has(k)) {
      vmap.set(k, verts.length / 3);
      verts.push(ipos[i * 3], ipos[i * 3 + 1], ipos[i * 3 + 2]);
    }
    idx.push(vmap.get(k)!);
  }
  const eset = new Set<string>();
  const segs: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = idx[t + e], b = idx[t + ((e + 1) % 3)];
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      if (eset.has(k)) continue;
      eset.add(k);
      // subdivide each edge along the great circle so it hugs the sphere
      const A = new THREE.Vector3(verts[a * 3], verts[a * 3 + 1], verts[a * 3 + 2]);
      const B = new THREE.Vector3(verts[b * 3], verts[b * 3 + 1], verts[b * 3 + 2]);
      const S = 2;
      let prev = A.clone();
      for (let s = 1; s <= S; s++) {
        const q = A.clone().lerp(B, s / S).setLength(R * 1.012);
        segs.push(prev.x, prev.y, prev.z, q.x, q.y, q.z);
        prev = q;
      }
    }
  }
  const grid = makeScreenLines(new Float32Array(segs), {
    color: p.grid,
    intensity: 2.6,
    opacity: p.gridOpacity,
    widthPx: 1.05,
    pxScale: ctx.pxScale,
    resolution: ctx.resolution,
  });
  spin.add(grid);
  const nodes = makeScreenPoints(new Float32Array(verts), {
    color: p.grid,
    intensity: 2.6,
    sizePx: 3.6,
    pxScale: ctx.pxScale,
    softness: 0.4,
  });
  spin.add(nodes);

  // ---- arcs ------------------------------------------------------------------
  const rnd = mulberry32(SEED);
  const NA = 22;
  const ARC_SEGS = 56;
  const periods = [120, 150, 200];
  type Arc = { a: THREE.Vector3; c: THREE.Vector3; b: THREE.Vector3; period: number; offset: number; flight: number };
  const arcs: Arc[] = [];
  const aseg: number[] = [], as: number[] = [], ap: number[] = [];
  const bez = (A: Arc, t: number, out: THREE.Vector3) => {
    const u = 1 - t;
    return out.set(0, 0, 0).addScaledVector(A.a, u * u).addScaledVector(A.c, 2 * u * t).addScaledVector(A.b, t * t);
  };
  for (let i = 0; i < NA; i++) {
    const ia = Math.floor(rnd() * CITIES.length);
    const a = llToVec(CITIES[ia][0], CITIES[ia][1], R * 1.003);
    // destination: a different city within ~40° of arc
    let b = a;
    for (let tries = 0; tries < 50; tries++) {
      const ib = Math.floor(rnd() * CITIES.length);
      const cand = llToVec(CITIES[ib][0], CITIES[ib][1], R * 1.003);
      const an = a.angleTo(cand);
      if (ib !== ia && an > 0.12 && an < 0.7) { b = cand; break; }
    }
    const ang = a.angleTo(b);
    const c = a.clone().add(b).normalize().multiplyScalar(R * (1.06 + Math.min(0.45, 0.85 * ang)));
    const arc: Arc = { a, b, c, period: periods[i % 3], offset: Math.floor(rnd() * 600), flight: Math.round(range(rnd, 55, 80)) };
    arcs.push(arc);
    const P0 = new THREE.Vector3(), P1 = new THREE.Vector3();
    for (let s = 0; s < ARC_SEGS; s++) {
      bez(arc, s / ARC_SEGS, P0);
      bez(arc, (s + 1) / ARC_SEGS, P1);
      aseg.push(P0.x, P0.y, P0.z, P1.x, P1.y, P1.z);
      as.push(s / ARC_SEGS, (s + 1) / ARC_SEGS);
      ap.push(i, 0, 0, 0);
    }
  }
  const heads = new Float32Array(NA);
  const arcLines = makeScreenLines(new Float32Array(aseg), {
    color: p.arc,
    intensity: 3.2,
    widthPx: 1.8,
    pxScale: ctx.pxScale,
    resolution: ctx.resolution,
    sParams: new Float32Array(as),
    params: new Float32Array(ap),
    uniforms: { uHeads: { value: heads } },
    decl: `uniform float uHeads[${NA}];`,
    body: /* glsl */ `
      float h = uHeads[int(P.x + 0.5)];
      float d = h - s;
      float a = (d >= 0.0 && h > 0.0) ? exp(-d / 0.32) : 0.0;
      a *= 1.0 - smoothstep(1.2, 1.5, h);
      col = vec4(base * (1.0 + 1.5 * exp(-d / 0.03)), a);`,
  });
  spin.add(arcLines);
  const headPos = new Float32Array(NA * 3);
  const headParam = new Float32Array(NA * 4);
  const headPts = makeScreenPoints(headPos, {
    color: "#FFE2B8",
    intensity: 6,
    sizePx: 7,
    pxScale: ctx.pxScale,
    params: headParam,
    softness: 0.8,
    body: `col.a = P.x;`,
  });
  spin.add(headPts);

  // ---- rings ---------------------------------------------------------------
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(p.ring) }, uPhase: { value: new Float32Array(CITIES.length) } },
    vertexShader: `in float aIdx; out vec2 vUv; out float vIdx; void main(){ vUv = uv*2.0-1.0; vIdx = aIdx; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uPhase[${CITIES.length}];
      in vec2 vUv; in float vIdx;
      float ring(float r, float rad, float w){ float aa = fwidth(r); return 1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, abs(r - rad)); }
      void main(){
        float r = length(vUv);
        float ph = uPhase[int(vIdx + 0.5)];
        float a = ring(r, 0.42, 0.06) * 0.8;            // location ring
        a += (1.0 - smoothstep(0.1, 0.14, r)) * 1.4;      // centre dot
        a += ring(r, 0.42 + 0.55 * ph, 0.05) * pow(1.0 - ph, 1.5) * 1.2; // pulse
        gl_FragColor = vec4(uColor * a * 1.6, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ringCycles = [4, 5, 6, 8, 10];
  const ringOffsets: number[] = [];
  const ringGeos: THREE.BufferGeometry[] = [];
  const NR = 15;
  for (let i = 0; i < NR; i++) {
    const [lat, lon] = CITIES[i];
    const pos = llToVec(lat, lon, R * 1.004);
    const g = new THREE.PlaneGeometry(0.42, 0.42);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), pos.clone().normalize().negate(), new THREE.Vector3(0, 1, 0));
    g.applyMatrix4(m);
    g.translate(pos.x, pos.y, pos.z);
    g.setAttribute("aIdx", new THREE.Float32BufferAttribute(new Array(4).fill(i), 1));
    ringGeos.push(g);
    ringOffsets.push(rnd());
  }
  // merge
  const merged = new THREE.BufferGeometry();
  const mp: number[] = [], mu: number[] = [], mi: number[] = [], mx: number[] = [];
  ringGeos.forEach((g, gi) => {
    mp.push(...(g.attributes.position.array as Float32Array));
    mu.push(...(g.attributes.uv.array as Float32Array));
    mi.push(...(g.attributes.aIdx.array as Float32Array));
    (g.index!.array as Uint16Array).forEach((v) => mx.push(v + gi * 4));
  });
  merged.setAttribute("position", new THREE.Float32BufferAttribute(mp, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(mu, 2));
  merged.setAttribute("aIdx", new THREE.Float32BufferAttribute(mi, 1));
  merged.setIndex(mx);
  const rings = new THREE.Mesh(merged, ringMat);
  spin.add(rings);

  // ---- textures ------------------------------------------------------------
  const ready = Promise.all([
    loadTexture(staticFile("textures/nasa_black_marble_4096.jpg")),
    loadTexture(staticFile("textures/nasa_blue_marble_4096.jpg")),
  ]).then(([night, day]) => {
    for (const t of [night, day]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, ctx.gl.capabilities.getMaxAnisotropy());
      t.needsUpdate = true;
    }
    globeMat.uniforms.tNight.value = night;
    globeMat.uniforms.tDay.value = day;
    // force upload now so the first rendered frame already has them
    ctx.gl.initTexture(night);
    ctx.gl.initTexture(day);
  });

  const camBase = new THREE.Vector3(0, 3.2, 21.5);
  const look = new THREE.Vector3(0, 10.2, 0);
  const post = {
    exposure: p.exposure,
    bloomStrength: 0.5,
    bloomThreshold: 0.85,
    bloomKnee: 0.6,
    bloomRadius: 0.85,
    dof: { focus: 15, aperture: 0.006, maxCoc: 0.008, nearScale: 1 },
    vignette: 0.3,
    grain: 0.015,
    grainFadeLum: 0,
  };
  const tmp = new THREE.Vector3();
  const phases = ringMat.uniforms.uPhase.value as Float32Array;

  const update = (f: number) => {
    const t = f / LOOP;
    // sway 20° one way and back: cosine, exact loop
    spin.rotation.y = baseYaw + THREE.MathUtils.degToRad(20) * (0.5 - 0.5 * Math.cos(TAU * t));
    // slow push ±2%
    const k = 1 - 0.02 * oscC(f, 1);
    camera.position.copy(look).addScaledVector(camBase.clone().sub(look), k);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    atmoMat.uniforms.uCenter.value.set(0, 0, 0);
    post.dof.focus = camera.position.distanceTo(new THREE.Vector3(0, R * 0.8, R * 0.55));

    for (let i = 0; i < NA; i++) {
      const A = arcs[i];
      const age = (((f - A.offset) % A.period) + A.period) % A.period;
      const h = age / A.flight;
      heads[i] = h;
      if (h > 0 && h <= 1) {
        bez(A, h, tmp);
        headPos.set([tmp.x, tmp.y, tmp.z], i * 3);
        headParam[i * 4] = 1 - smoothFade(h);
      } else {
        headParam[i * 4] = 0;
      }
    }
    headPts.geometry.attributes.position.needsUpdate = true;
    headPts.geometry.attributes.aP.needsUpdate = true;
    for (let i = 0; i < NR; i++) phases[i] = fract(t * ringCycles[i % ringCycles.length] + ringOffsets[i]);
  };

  return { scene, camera, post, update, ready };
}

function smoothFade(h: number) {
  // head dims just before landing
  const x = Math.min(1, Math.max(0, (h - 0.9) / 0.1));
  return x * x * (3 - 2 * x) * 0.6;
}
