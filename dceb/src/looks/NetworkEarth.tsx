/**
 * Look 3 — Network Earth (20s loop).
 * A large, cropped Earth (NASA Blue Marble day + Black Marble night lights),
 * network arcs with travelling pulses, a plexus shell and a strong
 * atmosphere glow into the empty half. The globe sways ±15° on a cosine over
 * 600 frames (a full turn would be far too fast this close), so it loops.
 */
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { FAT_LINE_FRAGMENT_HEADER, FAT_LINE_VERTEX_HEADER, buildFatLineGeometry, uniqueEdges } from "../lib/fatLines";
import { PostSettings } from "../lib/Post";
import { mulberry32 } from "../lib/random";
import { Stage, useAssets, useBufferSize } from "../lib/Stage";

export type NetworkEarthProps = {
  /** globe on the right (false) or on the left (true) */
  mirror: boolean;
  /** longitude facing the camera (degrees) */
  centerLon: number;
  /** city-light colour, arc colour, plexus colour (display sRGB hex) */
  lights: string;
  arcs: string;
  plexus: string;
  /** limb glow (bright), mid glow, far glow */
  glowInner: string;
  glowMid: string;
  glowFar: string;
  /** day-side tint multiplier (display sRGB hex) */
  dayTint: string;
  exposure: number;
  grain: number;
};

const LOOP = 600;
const R = 1;
const FOV = 30;
const D0 = 2.85; // globe radius ≈ 70% of frame height
// off-axis framing: full frustum = FULL frame widths; globe centre at FULL/2 (= 0.975 W, or 0.025 W mirrored)
const FULL = 1.95;
const SWAY = (15 * Math.PI) / 180;
const TILT = 0.38;

const CITIES: [number, number][] = [
  [40.7, -74], [34, -118.2], [41.9, -87.6], [43.7, -79.4], [19.4, -99.1], [-23.5, -46.6], [-34.6, -58.4],
  [4.7, -74.1], [-12, -77], [51.5, -0.1], [48.9, 2.35], [40.4, -3.7], [52.5, 13.4], [41.9, 12.5], [55.75, 37.6],
  [41, 29], [30, 31.2], [6.5, 3.4], [-26.2, 28], [-1.3, 36.8], [25.2, 55.3], [19, 72.8], [28.6, 77.2],
  [13.7, 100.5], [1.35, 103.8], [22.3, 114.2], [31.2, 121.5], [39.9, 116.4], [37.6, 127], [35.7, 139.7],
  [-33.9, 151.2], [-6.2, 106.8], [14.6, 121], [25.8, -80.2], [49.3, -123.1], [64.1, -21.9], [-31.9, 115.9],
  [-33.4, -70.6], [38.7, -9.1], [59.3, 18.1], [33.6, -7.6], [9.0, 38.7], [-4.3, 15.3], [24.7, 46.7],
];

const llToVec = (lat: number, lon: number, r = 1) => {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)).multiplyScalar(r);
};

const col = (hex: string) => new THREE.Color(hex); // linear (ColorManagement)

// ---------------------------------------------------------------- shaders
const EARTH_VS = /* glsl */ `
varying vec3 vObjN;
varying vec3 vWorldN;
varying vec3 vWorldPos;
void main() {
  vObjN = normal;
  vWorldN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const NOISE = /* glsl */ `
float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i + vec3(0,0,0)), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

const EARTH_FS = /* glsl */ `
uniform sampler2D tDay;
uniform sampler2D tNight;
uniform vec3 sunDir;
uniform vec3 lightColor;
uniform vec3 dayTint;
uniform vec3 atmos;
varying vec3 vObjN;
varying vec3 vWorldN;
varying vec3 vWorldPos;
${NOISE}
void main() {
  vec3 n = normalize(vObjN);
  // equirectangular lookup; pick the longitude branch with the smaller
  // derivative so the ±180° seam never shows a mip-level line
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float u1 = atan(n.x, n.z) / 6.2831853 + 0.5;
  float u2 = fract(u1 + 0.5) - 0.5;
  float u = fwidth(u1) <= fwidth(u2) + 1e-6 ? u1 : u2;
  vec2 uv = vec2(u, lat / 3.1415927 + 0.5);
  vec2 dx = vec2(fwidth(u) < 0.25 ? dFdx(u) : 0.0, dFdx(uv.y));
  vec2 dy = vec2(fwidth(u) < 0.25 ? dFdy(u) : 0.0, dFdy(uv.y));
  vec3 day = textureGrad(tDay, uv, dx, dy).rgb;
  vec3 night = textureGrad(tNight, uv, dx, dy).rgb;

  vec3 N = normalize(vWorldN);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndl = dot(N, sunDir);
  float dayAmt = smoothstep(-0.12, 0.35, ndl);

  float lum = dot(day, vec3(0.25, 0.55, 0.2));
  vec3 base = mix(vec3(lum), day, 0.3) * dayTint;
  // procedural cloud layer (fixed to the globe)
  float cl = smoothstep(0.52, 0.78, fbm(n * 3.2 + vec3(1.7, 0.3, 4.1)));
  cl *= 0.55 + 0.45 * smoothstep(0.3, 0.7, fbm(n * 9.0));
  base = mix(base, dayTint * 0.9, cl * 0.7);
  vec3 c = base * (0.035 + 1.1 * dayAmt);

  // ocean glint
  float ocean = smoothstep(0.015, 0.06, day.b - max(day.r, day.g)) * (1.0 - cl);
  vec3 H = normalize(sunDir + V);
  c += dayTint * pow(max(dot(N, H), 0.0), 70.0) * ocean * dayAmt * 0.9;

  // Black Marble city lights (warm on a faint navy base: keep only the lights)
  float L = max(0.0, (night.r + night.g) * 0.5 - night.b * 0.75 - 0.004);
  L = pow(L * 12.0, 1.2);
  c += lightColor * L * (0.18 + 0.82 * (1.0 - dayAmt));

  // limb: fresnel atmosphere
  float fr = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  c += atmos * fr * (0.35 + 0.9 * smoothstep(-0.4, 0.6, ndl + 0.3));
  gl_FragColor = vec4(c, 1.0);
}`;

const BG_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`;

const BG_FS = /* glsl */ `
uniform vec2 uCenter; // uv (0..1)
uniform float uRadius; // in frame heights
uniform float uAspect;
uniform vec3 cInner, cMid, cFar;
varying vec2 vUv;
void main() {
  vec2 q = (vUv - uCenter) * vec2(uAspect, 1.0);
  float d = max(length(q) - uRadius, 0.0) / uRadius; // 0 at the limb
  vec3 c = cInner * exp(-d * 4.0) * 0.3
         + cMid * exp(-d * 2.4) * 0.9
         + cFar * exp(-d * 1.1) * 0.6;
  gl_FragColor = vec4(c, 1.0);
}`;

const ATMOS_FS = /* glsl */ `
uniform vec3 cInner;
uniform vec3 sunDir;
varying vec3 vWorldN;
varying vec3 vWorldPos;
varying vec3 vObjN;
void main() {
  vec3 N = normalize(vWorldN);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndv = dot(N, V);
  // back faces of a slightly larger sphere: bright thin halo just off the limb
  float rim = smoothstep(-0.02, 0.32, -ndv) * (1.0 - smoothstep(0.32, 0.6, -ndv));
  float g = pow(clamp(1.0 + ndv, 0.0, 1.0), 6.0);
  float side = 0.55 + 0.45 * smoothstep(-0.5, 0.5, dot(N, sunDir));
  gl_FragColor = vec4(cInner * (g * 0.55 + rim * 0.12) * side, 1.0);
}`;

const LINE_VS = /* glsl */ `
${FAT_LINE_VERTEX_HEADER}
attribute float aU;
attribute vec3 aArc; // period, phase, base
varying float vU;
varying vec3 vArc;
varying float vLimb;
uniform float uLimbBoost;
void main() {
  vU = aU;
  vArc = aArc;
  vec3 p = mix(aA, aB, aCorner.x);
  vec3 wn = normalize(mat3(modelMatrix) * p);
  vec3 wp = (modelMatrix * vec4(p, 1.0)).xyz;
  vec3 V = normalize(cameraPosition - wp);
  vLimb = pow(1.0 - abs(dot(wn, V)), 3.0) * uLimbBoost;
  gl_Position = fatLinePosition(projectionMatrix * modelViewMatrix, 1.0);
  // small constant depth pull: overlays sitting just above the surface must
  // never lose the depth test against the globe (≈0.08 units at this range)
  gl_Position.z -= 0.002 * gl_Position.w;
}`;

const LINE_FS = /* glsl */ `
${FAT_LINE_FRAGMENT_HEADER}
uniform vec3 uColor;
uniform float uOpacity;
uniform float uFrame;
uniform float uPulse;
varying float vU;
varying vec3 vArc;
varying float vLimb;
void main() {
  float a = fatLineCoverage();
  float b = uOpacity * vArc.z * (1.0 + vLimb);
  if (uPulse > 0.5) {
    float p = fract(uFrame / vArc.x + vArc.y) * 1.3 - 0.15; // head travels A->B, off both ends
    float dd = (vU - p);
    float head = exp(-pow(dd / 0.035, 2.0));
    float tail = dd < 0.0 ? exp(dd / 0.12) * step(-0.5, dd) : 0.0;
    b += (head * 5.0 + tail * 1.4);
    // fade the very ends into the city dots
    b *= smoothstep(0.0, 0.04, vU) * smoothstep(1.0, 0.96, vU);
  }
  gl_FragColor = vec4(uColor * b * a, 1.0);
}`;

const POINTS_VS = /* glsl */ `
uniform float uSize; // px at 1080p
uniform vec2 uResolution;
uniform float uLimbBoost;
attribute float aSize;
varying float vAlpha;
varying float vLimb;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z -= 0.002 * gl_Position.w; // see the line shader
  vec3 wn = normalize(mat3(modelMatrix) * position);
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  vLimb = pow(1.0 - abs(dot(wn, normalize(cameraPosition - wp))), 3.0) * uLimbBoost;
  float s = uSize * aSize * uResolution.y / 1080.0;
  gl_PointSize = max(s, 1.5);
  vAlpha = clamp(s / 1.5, 0.0, 1.0);
}`;

const POINTS_FS = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
varying float vLimb;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  float a = exp(-r * 3.5) * smoothstep(1.0, 0.6, r);
  gl_FragColor = vec4(uColor * a * uOpacity * vAlpha * (1.0 + vLimb), 1.0);
}`;

const additive = {
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
} as const;

type Assets = { day: THREE.Texture; night: THREE.Texture };

const loadTex = (url: string) =>
  new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.ClampToEdgeWrapping;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.generateMipmaps = true;
        resolve(t);
      },
      undefined,
      reject,
    );
  });

const buildArcs = (seed: number) => {
  const rng = mulberry32(seed);
  const pts = CITIES.map(([la, lo]) => llToVec(la, lo, R * 1.01));
  const a: number[] = [];
  const b: number[] = [];
  const ua: number[] = [];
  const ub: number[] = [];
  const arc: number[] = [];
  const periods = [100, 120, 150, 200, 300];
  let made = 0;
  let guard = 0;
  while (made < 30 && guard++ < 2000) {
    const hubs = [0, 9, 29, 5]; // New York, London, Tokyo, São Paulo
    const i = made % 2 === 0 ? hubs[Math.floor(made / 2) % hubs.length] : Math.floor(rng() * pts.length);
    const j = Math.floor(rng() * pts.length);
    if (i === j) continue;
    const ang = pts[i].angleTo(pts[j]);
    if (ang < 0.25 || ang > 1.5) continue;
    const period = periods[Math.floor(rng() * periods.length)];
    const phase = rng();
    const base = 0.55 + 0.45 * rng();
    const lift = 0.02 + 0.09 * (ang / Math.PI) * 2; // low arcs that hug the globe
    const S = 64;
    const A = pts[i].clone().normalize();
    const B = pts[j].clone().normalize();
    const prev = new THREE.Vector3();
    for (let s = 0; s <= S; s++) {
      const t = s / S;
      const p = A.clone().lerp(B, t).normalize(); // fine for < 90°
      // proper slerp
      const so = Math.sin(ang);
      p.copy(A).multiplyScalar(Math.sin((1 - t) * ang) / so).add(B.clone().multiplyScalar(Math.sin(t * ang) / so));
      p.multiplyScalar(R * (1.01 + lift * Math.sin(Math.PI * t)));
      if (s > 0) {
        a.push(prev.x, prev.y, prev.z);
        b.push(p.x, p.y, p.z);
        ua.push((s - 1) / S);
        ub.push(s / S);
        arc.push(period, phase, base);
      }
      prev.copy(p);
    }
    made++;
  }
  return buildFatLineGeometry(a, b, { aU: { size: 1, a: ua, b: ub } }, { aArc: { size: 3, data: arc } });
};

const buildPlexus = () => {
  // three's detail 7 = 642 vertices / 1280 faces = a classic "detail 3" icosphere
  const ico = new THREE.IcosahedronGeometry(R * 1.06, 7);
  const { verts, edges } = uniqueEdges(ico);
  ico.dispose();
  const a: number[] = [];
  const b: number[] = [];
  const zeros: number[] = [];
  const arc: number[] = [];
  for (const [i, j] of edges) {
    a.push(verts[i].x, verts[i].y, verts[i].z);
    b.push(verts[j].x, verts[j].y, verts[j].z);
    zeros.push(0);
    arc.push(1, 0, 1);
  }
  const lines = buildFatLineGeometry(a, b, { aU: { size: 1, a: zeros, b: zeros } }, { aArc: { size: 3, data: arc } });
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.Float32BufferAttribute(verts.flatMap((v) => [v.x, v.y, v.z]), 3));
  pg.setAttribute("aSize", new THREE.Float32BufferAttribute(verts.map(() => 1), 1));
  return { lines, points: pg };
};

const Scene: React.FC<NetworkEarthProps & { assets: Assets }> = (p) => {
  const frame = useCurrentFrame();
  const { camera } = useThree();
  const size = useThree((s) => s.size);
  const sx = p.mirror ? -1 : 1;
  // sun from the empty side, slightly in front: ~60% of the visible disc is night
  const sunDir = useMemo(() => new THREE.Vector3(-0.92 * sx, 0.25, 0.3).normalize(), [sx]);
  const resolution = useMemo(() => new THREE.Vector2(), []);
  const buf = useBufferSize();

  const objs = useMemo(() => {
    const globe = new THREE.Group();
    const earthMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VS,
      fragmentShader: EARTH_FS,
      uniforms: {
        tDay: { value: p.assets.day },
        tNight: { value: p.assets.night },
        sunDir: { value: sunDir },
        lightColor: { value: col(p.lights).multiplyScalar(1.3) },
        dayTint: { value: col(p.dayTint) },
        atmos: { value: col(p.glowInner).multiplyScalar(0.3) },
      },
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 192, 128), earthMat);
    globe.add(earth);

    const arcMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VS,
      fragmentShader: LINE_FS,
      uniforms: {
        uResolution: { value: resolution },
        uWidth: { value: 2.0 },
        uColor: { value: col(p.arcs) },
        uOpacity: { value: 0.9 },
        uFrame: { value: 0 },
        uPulse: { value: 1 },
        uLimbBoost: { value: 0 },
      },
      ...additive,
    });
    const arcs = new THREE.Mesh(buildArcs(1097384625), arcMat);
    arcs.frustumCulled = false;
    globe.add(arcs);

    const plex = buildPlexus();
    const plexMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VS,
      fragmentShader: LINE_FS,
      uniforms: {
        uResolution: { value: resolution },
        uWidth: { value: 1.0 },
        uColor: { value: col(p.plexus) },
        uOpacity: { value: 0.3 },
        uFrame: { value: 0 },
        uPulse: { value: 0 },
        uLimbBoost: { value: 1.5 },
      },
      ...additive,
    });
    const plexLines = new THREE.Mesh(plex.lines, plexMat);
    plexLines.frustumCulled = false;
    globe.add(plexLines);
    const ptsMat = new THREE.ShaderMaterial({
      vertexShader: POINTS_VS,
      fragmentShader: POINTS_FS,
      uniforms: {
        uSize: { value: 6.0 },
        uResolution: { value: resolution },
        uColor: { value: col(p.plexus) },
        uOpacity: { value: 0.85 },
        uLimbBoost: { value: 2.0 },
      },
      ...additive,
    });
    const plexPts = new THREE.Points(plex.points, ptsMat);
    plexPts.frustumCulled = false;
    globe.add(plexPts);

    // network specks: small bright points scattered around the cities and over the globe
    {
      const rng = mulberry32(5150);
      const sp: number[] = [];
      const ss: number[] = [];
      for (let i = 0; i < 1400; i++) {
        let v: THREE.Vector3;
        if (i % 3 !== 0) {
          const [la, lo] = CITIES[Math.floor(rng() * CITIES.length)];
          v = llToVec(la + (rng() - 0.5) * 16, lo + (rng() - 0.5) * 22, R * 1.012);
        } else {
          const u = rng() * 2 - 1;
          const th = rng() * Math.PI * 2;
          const r = Math.sqrt(1 - u * u);
          v = new THREE.Vector3(r * Math.cos(th), u, r * Math.sin(th)).multiplyScalar(R * (1.012 + rng() * 0.05));
        }
        sp.push(v.x, v.y, v.z);
        ss.push(0.35 + 0.65 * rng() * rng());
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
      sg.setAttribute("aSize", new THREE.Float32BufferAttribute(ss, 1));
      const sm = new THREE.ShaderMaterial({
        vertexShader: POINTS_VS,
        fragmentShader: POINTS_FS,
        uniforms: {
          uSize: { value: 7.0 },
          uResolution: { value: resolution },
          uColor: { value: col(p.arcs).multiplyScalar(3.0) },
          uOpacity: { value: 0.9 },
          uLimbBoost: { value: 0 },
        },
        ...additive,
      });
      const specks = new THREE.Points(sg, sm);
      specks.frustumCulled = false;
      globe.add(specks);
    }

    // city dots
    const cg = new THREE.BufferGeometry();
    const cp = CITIES.flatMap(([la, lo]) => llToVec(la, lo, R * 1.012).toArray());
    cg.setAttribute("position", new THREE.Float32BufferAttribute(cp, 3));
    cg.setAttribute("aSize", new THREE.Float32BufferAttribute(CITIES.map((_, i) => 1 + (i % 3) * 0.4), 1));
    const cityMat = new THREE.ShaderMaterial({
      vertexShader: POINTS_VS,
      fragmentShader: POINTS_FS,
      uniforms: {
        uSize: { value: 9.0 },
        uResolution: { value: resolution },
        uColor: { value: col(p.lights).multiplyScalar(1.6) },
        uOpacity: { value: 1.0 },
        uLimbBoost: { value: 0 },
      },
      ...additive,
    });
    const cities = new THREE.Points(cg, cityMat);
    cities.frustumCulled = false;
    globe.add(cities);

    // thin bright halo just off the limb
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VS,
      fragmentShader: ATMOS_FS,
      uniforms: { cInner: { value: col(p.glowInner) }, sunDir: { value: sunDir } },
      side: THREE.BackSide,
      ...additive,
    });
    const atmos = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 128, 64), atmosMat);

    // background glow (screen space, drawn first)
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: BG_VS,
      fragmentShader: BG_FS,
      uniforms: {
        uCenter: { value: new THREE.Vector2() },
        uRadius: { value: 0.7 },
        uAspect: { value: 16 / 9 },
        cInner: { value: col(p.glowInner) },
        cMid: { value: col(p.glowMid) },
        cFar: { value: col(p.glowFar) },
      },
      depthTest: false,
      depthWrite: false,
    });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    bg.frustumCulled = false;
    bg.renderOrder = -10;
    return { globe, earthMat, arcMat, plexMat, bgMat, bg, atmos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.assets, sunDir]);

  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    resolution.set(buf.w, buf.h);
    const ph = (2 * Math.PI * frame) / LOOP;
    // very slow push, ±2%
    const D = D0 * (1 + 0.02 * Math.cos(ph));
    cam.fov = FOV;
    cam.near = 0.1;
    cam.far = 20;
    cam.position.set(0, 0, D);
    cam.lookAt(0, 0, 0);
    // off-axis framing: globe centre near the frame edge, cropped by it
    const W = size.width;
    const H = size.height;
    cam.aspect = (FULL * W) / H;
    cam.setViewOffset(FULL * W, H, p.mirror ? (FULL - 1) * W : 0, 0, W, H);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    // sway ±15° on a cosine; slight axial tilt toward the viewer
    const lon0 = (p.centerLon * Math.PI) / 180;
    objs.globe.rotation.set(TILT, -lon0 + SWAY * Math.cos(ph) * sx, 0, "XYZ");
    objs.globe.updateMatrixWorld();
    objs.arcMat.uniforms.uFrame.value = frame % LOOP;

    // background glow centred on the projected globe
    const c = new THREE.Vector3(0, 0, 0).project(cam);
    const edge = new THREE.Vector3(0, R, 0).applyQuaternion(cam.quaternion).project(cam);
    objs.bgMat.uniforms.uCenter.value.set((c.x + 1) / 2, (c.y + 1) / 2);
    // apparent radius (limb of a sphere seen from distance D)
    const ang = Math.asin(R / D);
    const rNdc = Math.tan(ang) / Math.tan(((FOV / 2) * Math.PI) / 180);
    objs.bgMat.uniforms.uRadius.value = rNdc / 2;
    objs.bgMat.uniforms.uAspect.value = W / H;
    void edge;
  }, [frame, camera, buf.w, buf.h, size, objs, resolution, p.mirror, p.centerLon, sx]);

  return (
    <>
      <primitive object={objs.bg} />
      <primitive object={objs.atmos} />
      <primitive object={objs.globe} />
    </>
  );
};

export const NetworkEarth: React.FC<NetworkEarthProps> = (props) => {
  const assets = useAssets<Assets>("earth textures", async () => {
    const [day, night] = await Promise.all([
      loadTex(staticFile("textures/earth-blue-marble-day.jpg")),
      loadTex(staticFile("textures/earth-black-marble-night.jpg")),
    ]);
    return { day, night };
  });
  const post: PostSettings = useMemo(
    () => ({
      exposure: props.exposure,
      toneMap: "aces",
      bloom: { strength: 0.95, threshold: 0.45, knee: 0.35, radius: 0.9 },
      grain: props.grain,
      dither: true,
      vignette: 0.4,
      clear: [0, 0, 0],
      noisePeriod: LOOP,
    }),
    [props.exposure, props.grain],
  );
  if (!assets) return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
  return (
    <Stage background="#000000" post={post} camera={{ fov: FOV, near: 0.1, far: 20 }}>
      <Scene {...props} assets={assets} />
    </Stage>
  );
};
