// Look 1 — Summit Path. Low-poly crystal mountain (Delaunay over ~600
// jittered points), glowing path along mesh edges with climbing pulses,
// a waving plain flag at the summit and a breathing halo.
import * as THREE from "three";
import Delaunator from "delaunator";
import { makeSimplex3 } from "../lib/noise";
import { LOOP, TAU, mulberry32, osc, oscC, fract, smoothstep } from "../lib/rng";
import { makeBackground, makeScreenLines, makeScreenPoints } from "../lib/lines";
import type { BuildCtx, LookHandle } from "../lib/types";

export type SummitParams = {
  /** Facet colour stops (sRGB hex), low -> high. */
  facets: string[];
  /** 0 = colours scattered randomly across stops, 1 = mapped by height. */
  facetByHeight: number;
  edge: string;
  node: string;
  path: string;
  halo: string;
  haloIntensity: number;
  bgTop: string;
  bgBottom: string;
  keyLight: string;
  fill: string;
  exposure: number;
};

const SEED = 0x5a11;

// ---- geometry generated once, at module level ---------------------------
const H = 7.5; // summit height
const simplex = makeSimplex3(SEED);

function height(x: number, z: number) {
  const r = Math.sqrt(x * x + (z * 1.05) * (z * 1.05));
  const cone = 4.4 * Math.pow(Math.max(0, 1 - r / 6.8), 1.15) + 2.8 * Math.pow(Math.max(0, 1 - r / 17), 1.5);
  // close, bulging foreground dome rising from the lower left
  const dome = 1.6 * Math.exp(-((x + 7) ** 2 + (z - 10) ** 2) / 26) + 1.4 * Math.exp(-((x - 5) ** 2 + (z - 11) ** 2) / 18);
  const ridged = 1 - Math.abs(simplex(x * 0.19, 3.1, z * 0.19));
  const shoulderR = 1.2 * Math.exp(-((x - 7.5) ** 2 + (z + 0.5) ** 2) / 10);
  const shoulderL = 0.5 * Math.exp(-((x + 8.5) ** 2 + (z - 1.5) ** 2) / 12);
  const rough = 0.6 * simplex(x * 0.45, 7.7, z * 0.45);
  const away = 1 - Math.min(1, cone / H);
  let h = cone + dome + shoulderR + shoulderL + (ridged - 0.55) * 1.4 * (0.3 + 0.7 * away) + rough * (0.3 + away);
  // keep the summit the single highest point
  // lumpy, knobbly summit rather than a clean pyramid tip
  h += 0.55 * simplex(x * 0.9, 11.3, z * 0.9) * Math.exp(-(r * r) / 6);
  h = Math.min(h, H - 0.32 * Math.min(r, 4) - 0.03 * r * r);
  return Math.max(h, -0.6);
}

type MountainData = {
  pos: Float32Array; // per vertex xyz
  tris: Uint32Array;
  edges: [number, number][];
  path: number[]; // vertex indices base -> summit
  summit: number;
};

function buildMountain(): MountainData {
  const rnd = mulberry32(SEED + 1);
  const pts: number[] = [];
  const NX = 30, NZ = 16;
  const x0 = -17, x1 = 17, z0 = -7, z1 = 15.5;
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const u = (i + 0.15 + 0.7 * rnd()) / NX;
      const v = (j + 0.15 + 0.7 * rnd()) / NZ;
      pts.push(x0 + (x1 - x0) * u, z0 + (z1 - z0) * v);
    }
  }
  // extra, finer samples around the summit (total stays ~600)
  for (let k = 0; k < 120; k++) {
    const a = rnd() * Math.PI * 2, rr = 0.35 + 5.0 * Math.pow(rnd(), 0.8);
    pts.push(Math.cos(a) * rr, Math.sin(a) * rr * 0.9);
  }
  // summit point: replace nearest sample
  let best = 0, bd = 1e9;
  for (let k = 0; k < pts.length / 2; k++) {
    const d = pts[k * 2] ** 2 + pts[k * 2 + 1] ** 2;
    if (d < bd) { bd = d; best = k; }
  }
  pts[best * 2] = 0;
  pts[best * 2 + 1] = 0;
  // frame corners so the hull is rectangular
  pts.push(x0, z0, x1, z0, x0, z1, x1, z1);
  const d = new Delaunator(pts);
  const n = pts.length / 2;
  const pos = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const x = pts[k * 2], z = pts[k * 2 + 1];
    pos[k * 3] = x;
    pos[k * 3 + 1] = k === best ? H : height(x, z);
    pos[k * 3 + 2] = z;
  }
  const tris = new Uint32Array(d.triangles);
  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let e = 0; e < d.triangles.length; e++) {
    const a = d.triangles[e];
    const b = d.triangles[e % 3 === 2 ? e - 2 : e + 1];
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push([a, b]);
      adj[a].push(b);
      adj[b].push(a);
    }
  }
  // seeded shortest-ascent walk through zig-zag waypoints
  const edgeNoise = new Map<string, number>();
  const prnd = mulberry32(SEED + 2);
  for (const [a, b] of edges) edgeNoise.set(a < b ? `${a},${b}` : `${b},${a}`, 1 + 0.35 * prnd());
  const nearest = (x: number, z: number) => {
    let bi = 0, bdd = 1e9;
    for (let k = 0; k < n; k++) {
      const dd = (pos[k * 3] - x) ** 2 + (pos[k * 3 + 2] - z) ** 2;
      if (dd < bdd) { bdd = dd; bi = k; }
    }
    return bi;
  };
  const dijkstra = (s: number, t: number) => {
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    dist[s] = 0;
    for (;;) {
      let u = -1, du = Infinity;
      for (let k = 0; k < n; k++) if (!done[k] && dist[k] < du) { du = dist[k]; u = k; }
      if (u < 0 || u === t) break;
      done[u] = 1;
      for (const v of adj[u]) {
        const dx = pos[v * 3] - pos[u * 3], dy = pos[v * 3 + 1] - pos[u * 3 + 1], dz = pos[v * 3 + 2] - pos[u * 3 + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const descent = Math.max(0, -dy);
        const key = u < v ? `${u},${v}` : `${v},${u}`;
        const c = len * (1 + 3 * descent / len) * edgeNoise.get(key)!;
        if (du + c < dist[v]) { dist[v] = du + c; prev[v] = u; }
      }
    }
    const out: number[] = [];
    for (let v = t; v !== -1; v = prev[v]) out.push(v);
    return out.reverse();
  };
  const way: [number, number][] = [
    [-4.0, 11.5], [2.2, 8.4], [-2.6, 5.6], [1.9, 3.4], [-1.2, 1.6], [0, 0],
  ];
  const ids = way.map(([x, z]) => nearest(x, z));
  ids[ids.length - 1] = best;
  const path: number[] = [];
  for (let k = 0; k < ids.length - 1; k++) {
    const seg = dijkstra(ids[k], ids[k + 1]);
    if (k > 0) seg.shift();
    path.push(...seg);
  }
  return { pos, tris, edges, path, summit: best };
}

const MOUNTAIN = buildMountain();

// --------------------------------------------------------------------------

export function buildSummit(ctx: BuildCtx, p: SummitParams): LookHandle {
  const { pos, tris, edges, path, summit } = MOUNTAIN;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, ctx.width / ctx.height, 0.5, 200);

  // background gradient
  scene.add(
    makeBackground(
      /* glsl */ `
      in vec2 vUv; uniform vec3 uTop, uBot;
      void main(){
        float t = smoothstep(0.0, 1.0, vUv.y);
        gl_FragColor = vec4(mix(uBot, uTop, t), 1.0);
      }`,
      { uTop: { value: new THREE.Color(p.bgTop) }, uBot: { value: new THREE.Color(p.bgBottom) } },
    ),
  );

  // halo (camera-facing, far behind the summit)
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(p.halo) }, uI: { value: 1 } },
    vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      in vec2 vUv; uniform vec3 uColor; uniform float uI;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float core = exp(-r * r / 0.035);
        float glow = exp(-r * r / 0.16);
        float wide = 1.0 / (1.0 + pow(r / 0.28, 2.0)) * (1.0 - smoothstep(0.6, 1.0, r));
        gl_FragColor = vec4(uColor * uI * (1.0 * core + 0.7 * glow + 0.12 * wide), 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloMat);
  halo.position.set(0, H + 0.9, -4);
  halo.renderOrder = -10;
  scene.add(halo);

  // facets: non-indexed so each face gets its own flat colour
  const stops = p.facets.map((c) => new THREE.Color(c));
  const sample = (t: number) => {
    t = Math.min(0.9999, Math.max(0, t)) * (stops.length - 1);
    const i = Math.floor(t);
    return stops[i].clone().lerp(stops[i + 1], t - i);
  };
  const crnd = mulberry32(SEED + 3);
  const fpos = new Float32Array(tris.length * 3);
  const fcol = new Float32Array(tris.length * 3);
  for (let f = 0; f < tris.length / 3; f++) {
    let cy = 0;
    for (let k = 0; k < 3; k++) {
      const v = tris[f * 3 + k];
      fpos.set(pos.subarray(v * 3, v * 3 + 3), (f * 3 + k) * 3);
      cy += pos[v * 3 + 1] / 3;
    }
    const hT = smoothstep(-0.5, H, cy);
    const t = (1 - p.facetByHeight) * crnd() + p.facetByHeight * (hT * 0.75 + 0.25 * crnd());
    const c = sample(t);
    // per-vertex brightness jitter -> a soft gradient inside each facet (glassy look)
    for (let k = 0; k < 3; k++) {
      const g = 0.78 + 0.5 * crnd();
      fcol.set([c.r * g, c.g * g, c.b * g], (f * 3 + k) * 3);
    }
  }
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute("position", new THREE.BufferAttribute(fpos, 3));
  fgeo.setAttribute("color", new THREE.BufferAttribute(fcol, 3));
  fgeo.computeVertexNormals();

  // environment for the glassy clearcoat: gradient sky + bright halo blob
  const envScene = new THREE.Scene();
  const envMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uHalo: { value: new THREE.Color(p.halo) }, uTop: { value: new THREE.Color(p.bgTop) }, uBot: { value: new THREE.Color(p.bgBottom) } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec3 vD; uniform vec3 uHalo, uTop, uBot;
      void main(){ vec3 c = mix(uBot, uTop, smoothstep(-0.2, 0.8, vD.y)) * 2.0;
        float h = max(dot(vD, normalize(vec3(0.0, 0.25, -1.0))), 0.0);
        c += uHalo * (pow(h, 10.0) * 1.2 + pow(h, 2.0) * 0.35);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), envMat));
  const pmrem = new THREE.PMREMGenerator(ctx.gl);
  const envTex = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();

  const facetMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.38,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMap: envTex,
    envMapIntensity: 0.35,
    emissive: new THREE.Color(p.facets[0]).multiplyScalar(0.06),
  });
  const mountain = new THREE.Mesh(fgeo, facetMat);
  scene.add(mountain);

  scene.add(new THREE.HemisphereLight(new THREE.Color(p.halo), new THREE.Color(p.bgBottom), 0.35));
  const key = new THREE.DirectionalLight(new THREE.Color(p.keyLight), 1.7);
  key.position.set(-8, 7, 9);
  scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(p.halo), 5.0);
  rim.position.set(0, 4, -12);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(new THREE.Color(p.fill), 0.9);
  fill.position.set(10, 2, 6);
  scene.add(fill);

  // glowing edges
  const lift = 0.012;
  const segs = new Float32Array(edges.length * 6);
  edges.forEach(([a, b], i) => {
    segs.set([pos[a * 3], pos[a * 3 + 1] + lift, pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1] + lift, pos[b * 3 + 2]], i * 6);
  });
  scene.add(
    makeScreenLines(segs, {
      color: p.edge,
      intensity: 1.9,
      opacity: 0.3,
      widthPx: 1.0,
      pxScale: ctx.pxScale,
      resolution: ctx.resolution,
    }),
  );

  // path: arc-length along polyline
  const pathPts = path.map((v) => new THREE.Vector3(pos[v * 3], pos[v * 3 + 1] + 0.05, pos[v * 3 + 2]));
  const cum = [0];
  for (let i = 1; i < pathPts.length; i++) cum.push(cum[i - 1] + pathPts[i].distanceTo(pathPts[i - 1]));
  const L = cum[cum.length - 1];
  const sOf = new Map<number, number>();
  path.forEach((v, i) => sOf.set(v, cum[i] / L));

  const curve = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 1; i < pathPts.length; i++) curve.add(new THREE.LineCurve3(pathPts[i - 1], pathPts[i]));
  const tube = new THREE.TubeGeometry(curve, 900, 0.017, 8, false);
  const pulseU = { value: 0 };
  const pathMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(p.path) }, uHead: pulseU },
    vertexShader: `out float vS; void main(){ vS = uv.x; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      in float vS; uniform vec3 uColor; uniform float uHead;
      void main(){
        float d = uHead - vS;
        float tail = d >= 0.0 ? exp(-d / 0.07) : 0.0;
        float head = exp(-d * d / 0.00012);
        gl_FragColor = vec4(uColor * (2.4 + 3.0 * tail + 4.5 * head), 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(tube, pathMat));

  // vertex nodes (path nodes flash as the pulse passes)
  const n = pos.length / 3;
  const npos = new Float32Array(n * 3);
  const nsize = new Float32Array(n);
  const nparam = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    npos.set([pos[k * 3], pos[k * 3 + 1] + lift * 2, pos[k * 3 + 2]], k * 3);
    const s = sOf.get(k);
    nsize[k] = s !== undefined ? 1.35 : 1;
    nparam[k * 4] = s !== undefined ? s : -10;
  }
  const nodes = makeScreenPoints(npos, {
    color: p.node,
    intensity: 3.4,
    sizePx: 6.0,
    pxScale: ctx.pxScale,
    sizes: nsize,
    params: nparam,
    softness: 0.9,
    uniforms: { uHead: pulseU },
    decl: "uniform float uHead;",
    body: /* glsl */ `
      if (P.x > -1.0) {
        float d = uHead - P.x;
        float flash = d >= -0.004 ? exp(-max(d, 0.0) / 0.05) : 0.0;
        col.rgb = base * (1.6 + 3.5 * flash);
      }`,
  });
  scene.add(nodes);

  // flag + pole at the summit
  const top = new THREE.Vector3(pos[summit * 3], pos[summit * 3 + 1], pos[summit * 3 + 2]);
  const poleH = 1.35;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.026, poleH, 10),
    new THREE.MeshStandardMaterial({ color: "#d8dde6", metalness: 0.6, roughness: 0.3, emissive: "#9aa6b8", emissiveIntensity: 0.4 }),
  );
  pole.position.copy(top).add(new THREE.Vector3(0, poleH / 2, 0));
  scene.add(pole);
  const FW = 0.6, FH = 0.37;
  const flagGeo = new THREE.PlaneGeometry(FW, FH, 28, 14);
  flagGeo.translate(FW / 2, 0, 0);
  const flagBase = (flagGeo.attributes.position.array as Float32Array).slice();
  const flagMat = new THREE.MeshStandardMaterial({
    color: "#a8b2c6",
    roughness: 0.6,
    side: THREE.DoubleSide,
    emissive: "#dfe6f2",
    emissiveIntensity: 0.08,
    transparent: true,
    opacity: 0.82,
  });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.copy(top).add(new THREE.Vector3(0.02, poleH - FH / 2 - 0.02, 0));
  scene.add(flag);

  // summit glow sprite when a pulse arrives
  const summitGlow = makeScreenPoints(new Float32Array([top.x, top.y + 0.05, top.z]), {
    color: p.path,
    intensity: 1,
    sizePx: 26,
    pxScale: ctx.pxScale,
    softness: 1,
    uniforms: { uHead: pulseU },
    decl: "uniform float uHead;",
    body: `float d = uHead - 1.0; col.rgb = base * (0.6 + 4.0 * (d >= 0.0 ? exp(-d / 0.05) : 0.0));`,
  });
  scene.add(summitGlow);

  // soft light flare where the path leaves the bottom of the frame
  const p0 = pathPts[0];
  scene.add(
    makeScreenPoints(new Float32Array([p0.x, p0.y + 0.05, p0.z]), {
      color: p.path,
      intensity: 1.6,
      sizePx: 70,
      pxScale: ctx.pxScale,
      softness: 1,
    }),
  );

  const focusTarget = new THREE.Vector3(0, H, 0);
  const post = {
    exposure: p.exposure,
    bloomStrength: 0.45,
    bloomThreshold: 0.9,
    bloomKnee: 0.6,
    bloomRadius: 0.85,
    dof: { focus: 21, aperture: 0.013, maxCoc: 0.013, nearScale: 2.0 },
    vignette: 0.35,
    grain: 0.015,
    grainFadeLum: 0,
  };

  const update = (f: number) => {
    const t = f / LOOP;
    // camera: low, slow closed orbit ±10°, gentle push
    const yaw = THREE.MathUtils.degToRad(10) * osc(f, 1);
    const dist = 16.5 * (1 - 0.035 * (0.5 - 0.5 * oscC(f, 1)));
    camera.position.set(Math.sin(yaw) * dist, 2.6 + 0.2 * osc(f, 1, 0.25), Math.cos(yaw) * dist);
    camera.lookAt(0, 6.8, 0);
    camera.updateMatrixWorld();
    post.dof.focus = camera.position.distanceTo(focusTarget);

    // halo faces camera and breathes (2 breaths / loop)
    halo.quaternion.copy(camera.quaternion);
    halo.scale.setScalar(17 * (1 + 0.04 * osc(f, 2)));
    haloMat.uniforms.uI.value = p.haloIntensity * (1 + 0.08 * osc(f, 2));

    // pulses: 3 climbs per loop
    pulseU.value = -0.1 + 1.25 * fract((3 * f) / LOOP);

    // flag wave: whole cycles (20 per loop = 1 Hz)
    const arr = flagGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = flagBase[i], y = flagBase[i + 1];
      const u = x / FW;
      const ph = TAU * (20 * t);
      const w = Math.sin(TAU * 1.3 * u - ph) * 0.085 + Math.sin(TAU * (2.1 * u + 0.6 * (y / FH)) - 2 * ph) * 0.025;
      arr[i] = x * (1 - 0.03 * u);
      arr[i + 1] = y - 0.04 * u * u;
      arr[i + 2] = w * Math.min(1, u * 1.6);
    }
    flagGeo.attributes.position.needsUpdate = true;
    flagGeo.computeVertexNormals();
  };

  return { scene, camera, post, update };
}
