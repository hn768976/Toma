import * as THREE from "three";
import { landMask } from "../lib/assets";
import { premultBlend, linearRGB } from "../lib/batch2d";
import { Billboards, Lines3D, PointCloud } from "../lib/prims3d";
import { cyc, hash2, irange, mulberry32, range } from "../lib/random";
import { BuildFn, LookProps, Stage } from "../lib/Stage";
import { LayerSpec } from "../lib/pipeline";

// Look 4 — Social Globe. A dotted globe (Natural Earth land mask) turning
// exactly once per 900 frames, dotted orbit rings, person icons on and
// around it joined by plexus lines with travelling pulses. Every periodic
// motion is a whole number of cycles per 900 frames, so the clip loops.

export const SOCIAL_FRAMES = 900;
const LOOP = 900;

const LAND = "#BFF0FF";
const OCEAN = "#1A4A8A";
const ICON = "#5FD8FF";
const LINE = "#7FD0FF";
const BG = "#020C2A";

const R = 3;
const GLOBE_POS = new THREE.Vector3(-2.3, 0.05, 0);
const TAU = Math.PI * 2;

const sph = (lat: number, lon: number, r: number) => {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
};

// --- layout at module level -----------------------------------------------

const rng = mulberry32(0x50c1a1);

type Floater = { anchor: THREE.Vector3; amp: THREE.Vector3; k: [number, number, number]; ph: [number, number, number]; size: number; bright: number };

const mkFloaters = (n: number, gen: () => THREE.Vector3, size: [number, number]): Floater[] =>
  Array.from({ length: n }, () => ({
    anchor: gen(),
    amp: new THREE.Vector3(range(rng, 0.1, 0.35), range(rng, 0.08, 0.25), range(rng, 0.05, 0.2)),
    k: [irange(rng, 1, 2), irange(rng, 1, 3), irange(rng, 1, 2)],
    ph: [rng() * TAU, rng() * TAU, rng() * TAU],
    size: range(rng, size[0], size[1]),
    bright: range(rng, 0.55, 1),
  }));

// mid layer: around the globe and spreading to the right (sharp)
const MID = mkFloaters(
  90,
  () => {
    if (rng() < 0.55) {
      const d = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
      return d.multiplyScalar(range(rng, R * 1.12, R * 1.6)).add(GLOBE_POS);
    }
    return new THREE.Vector3(range(rng, -9, 8.5), range(rng, -4.6, 4.6), range(rng, -2.5, 1.0));
  },
  [0.18, 0.26],
);
// near layer: in front, blurred
const NEAR = mkFloaters(18, () => new THREE.Vector3(range(rng, -7, 7), range(rng, -3.6, 3.6), range(rng, 4, 7)), [0.18, 0.26]);
// far layer: background web nodes, soft
const FAR = mkFloaters(150, () => new THREE.Vector3(range(rng, -14, 15), range(rng, -8, 8), range(rng, -12, -5)), [0.28, 0.4]);


type Pair = { a: number; b: number; pulse: number; period: number; ph: number };

const knnPairs = (pts: THREE.Vector3[], k: number, maxD: number, seed: number): Pair[] => {
  const out: Pair[] = [];
  const seen = new Set<string>();
  pts.forEach((p, i) => {
    const d = pts.map((q, j) => ({ j, d: p.distanceTo(q) })).filter((o) => o.j !== i).sort((x, y) => x.d - y.d);
    for (const o of d.slice(0, k)) {
      if (o.d > maxD) continue;
      const key = i < o.j ? `${i}-${o.j}` : `${o.j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const h = hash2(seed, out.length);
      out.push({ a: i, b: o.j, pulse: h < 0.35 ? 1 : 0, period: [90, 150, 180, 225, 300][Math.floor(hash2(seed + 1, out.length) * 5)], ph: hash2(seed + 2, out.length) });
    }
  });
  return out;
};

const floaterPos = (fl: Floater, f: number, out: THREE.Vector3) =>
  out.set(
    fl.anchor.x + fl.amp.x * cyc(f, LOOP, fl.k[0], fl.ph[0]),
    fl.anchor.y + fl.amp.y * cyc(f, LOOP, fl.k[1], fl.ph[1]),
    fl.anchor.z + fl.amp.z * cyc(f, LOOP, fl.k[2], fl.ph[2]),
  );

// --- build --------------------------------------------------------------

const oceanMaterial = () =>
  premultBlend(
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthWrite: true,
      uniforms: { uCol: { value: new THREE.Vector3(...linearRGB(OCEAN)) }, uRim: { value: new THREE.Vector3(...linearRGB("#5FC8FF")) } },
      vertexShader: /* glsl */ `
        out vec3 vN; out vec3 vV;
        void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        layout(location = 0) out highp vec4 fragOut;
        in vec3 vN; in vec3 vV; uniform vec3 uCol; uniform vec3 uRim;
        void main(){
          float ndv = max(dot(normalize(vN), normalize(vV)), 0.0);
          float fr = pow(1.0 - ndv, 3.0);
          float a = 0.5 + 0.35 * fr;
          vec3 c = uCol * (0.16 + 0.22 * ndv) + uRim * fr * 0.7;
          fragOut = vec4(c * a, a);
        }`,
    }),
  ) as THREE.ShaderMaterial;

const rimHalo = () =>
  premultBlend(
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthWrite: false,
      uniforms: { uCol: { value: new THREE.Vector3(...linearRGB("#3A9AFF")) } },
      vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `precision highp float; layout(location = 0) out highp vec4 fragOut; in vec2 vUv; uniform vec3 uCol;
        void main(){ float d = length(vUv - 0.5) * 2.0 * 1.6; float g = d > 1.0 ? exp(-pow((d - 1.0) * 7.0, 2.0)) * 0.3 + exp(-(d - 1.0) * 6.0) * 0.08 : 0.05 * d * d; fragOut = vec4(uCol * g, 0.0); }`,
    }),
  );

const build: BuildFn = (assets) => {
  const camera = new THREE.PerspectiveCamera(35, 16 / 9, 1, 80);
  const mask = landMask(assets.land);

  // ---- globe layer
  const sGlobe = new THREE.Scene();
  const root = new THREE.Group();
  root.position.copy(GLOBE_POS);
  root.rotation.z = THREE.MathUtils.degToRad(-12);
  root.rotation.x = THREE.MathUtils.degToRad(14);
  sGlobe.add(root);
  const spin = new THREE.Group();
  root.add(spin);

  const ocean = new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 96, 64), oceanMaterial());
  ocean.renderOrder = 0;
  spin.add(ocean);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(R * 3.2, R * 3.2), rimHalo());
  halo.renderOrder = 3;
  // halo stays camera-facing: added to the scene, positioned at globe centre
  halo.position.copy(GLOBE_POS);
  sGlobe.add(halo);

  // land points on a Fibonacci sphere, filtered by the Natural Earth mask
  const pts: [number, number, number, number][] = [];
  {
    const N = 150000;
    const ga = Math.PI * (3 - Math.sqrt(5));
    const r = mulberry32(2024);
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N;
      const rad = Math.sqrt(1 - y * y);
      const th = ga * i;
      const x = Math.cos(th) * rad;
      const z = Math.sin(th) * rad;
      const lat = (Math.asin(y) * 180) / Math.PI;
      const lon = (Math.atan2(x, z) * 180) / Math.PI;
      if (mask.at(lon, lat) > 0.5) pts.push([x, y, z, r()]);
    }
  }
  const landPts = pts.slice(0, 42000);
  const cloud = new PointCloud({ count: landPts.length, backAlpha: 0.12, softness: 0.15, minPx: 1.3 });
  landPts.forEach(([x, y, z, h], i) => cloud.set(i, x * R, y * R, z * R, h < 0.5 ? LAND : "#6FE0FF", 0.5 + 0.5 * h, 0.028, 0.85));
  cloud.commit();
  cloud.points.renderOrder = 1;
  spin.add(cloud.points);

  // faint ocean dot grid (lat/lon) for the digital look
  const oceanDots: number[][] = [];
  for (let lat = -80; lat <= 80; lat += 4) {
    const n = Math.max(6, Math.round(90 * Math.cos((lat * Math.PI) / 180)));
    for (let k = 0; k < n; k++) {
      const lon = -180 + (k / n) * 360;
      if (mask.at(lon, lat) < 0.5) oceanDots.push([lat, lon]);
    }
  }
  const od = new PointCloud({ count: oceanDots.length, backAlpha: 0.0, softness: 0.3 });
  oceanDots.forEach(([la, lo], i) => {
    const p = sph(la, lo, R * 1.002);
    od.set(i, p.x, p.y, p.z, "#4F9BE0", 0.35, 0.02, 1);
  });
  od.commit();
  od.points.renderOrder = 1;
  spin.add(od.points);

  // orbit rings (dotted, slightly wavy), whole turns per loop
  // orbit rings: two coiled (slinky-like) helices + two plain dotted rings,
  // each turning a whole number of times per loop
  const ringDefs = [
    { r: R * 1.3, coil: R * 0.17, turns: 38, tiltX: 58, tiltZ: -24, n: 3400, k: 1 },
    { r: R * 1.42, coil: R * 0.08, turns: 26, tiltX: 40, tiltZ: 30, n: 1800, k: -1 },
    { r: R * 1.14, coil: 0, turns: 0, tiltX: 20, tiltZ: 10, n: 520, k: 2 },
    { r: R * 1.55, coil: 0, turns: 0, tiltX: 66, tiltZ: -44, n: 640, k: -1 },
  ];
  const rings = ringDefs.map((d, ri) => {
    const g = new THREE.Group();
    g.rotation.x = THREE.MathUtils.degToRad(d.tiltX);
    g.rotation.z = THREE.MathUtils.degToRad(d.tiltZ);
    const spinG = new THREE.Group();
    g.add(spinG);
    const pc = new PointCloud({ count: d.n, softness: 0.3 });
    const r = mulberry32(300 + ri);
    for (let i = 0; i < d.n; i++) {
      const a = (i / d.n) * TAU;
      const ca = Math.cos(d.turns * a);
      const sa = Math.sin(d.turns * a);
      const rr = d.r + d.coil * ca;
      const big = i % 7 === 0;
      pc.set(i, Math.cos(a) * rr, d.coil * sa, Math.sin(a) * rr, i % 3 === 0 ? "#CFF4FF" : "#6FD8FF", range(r, 0.4, 0.9) * (d.coil ? 0.85 : 1), big ? 0.034 : 0.02, big ? 1.3 : 1.0);
    }
    pc.commit();
    pc.points.renderOrder = 2;
    spinG.add(pc.points);
    root.add(g);
    return { spinG, k: d.k };
  });

  // people on the surface
  const SURF_LATLON: [number, number][] = [];
  {
    const r = mulberry32(777);
    while (SURF_LATLON.length < 48) {
      const lat = range(r, -50, 68);
      const lon = range(r, -180, 180);
      if (mask.at(lon, lat) > 0.5) SURF_LATLON.push([lat, lon]);
    }
  }
  const surfLocal = SURF_LATLON.map(([la, lo]) => sph(la, lo, R * 1.04));

  const iconsMid = new Billboards(200, { backAlpha: 0.0, center: GLOBE_POS });
  iconsMid.mesh.renderOrder = 4;
  sGlobe.add(iconsMid.mesh);
  const linesMid = new Lines3D(600);
  linesMid.mesh.renderOrder = 3;
  sGlobe.add(linesMid.mesh);
  const pulses = new Billboards(200);
  pulses.mesh.renderOrder = 5;
  sGlobe.add(pulses.mesh);

  // all "mid" nodes = surface people + mid floaters; pairs precomputed at f=0
  const surfWorld0 = surfLocal.map((p) => p.clone().applyEuler(root.rotation).add(GLOBE_POS));
  const midPos0 = MID.map((m) => m.anchor.clone());
  const midPairs = knnPairs([...surfWorld0, ...midPos0], 2, 3.0, 41);

  // ---- near layer (blurred icons + specks)
  const sNear = new THREE.Scene();
  const iconsNear = new Billboards(80);
  sNear.add(iconsNear.mesh);
  const linesNear = new Lines3D(80);
  sNear.add(linesNear.mesh);
  const nearPairs = knnPairs(NEAR.map((n) => n.anchor), 1, 5, 51);
  const SPECKS = Array.from({ length: 60 }, () => ({
    p: new THREE.Vector3(range(rng, -7, 8), range(rng, -4, 4), range(rng, 4, 7)),
    s: range(rng, 0.03, 0.12),
    a: range(rng, 0.2, 0.6),
    k: irange(rng, 1, 2),
    ph: rng() * TAU,
  }));

  // ---- far layer (plexus web + dot grid)
  const sFar = new THREE.Scene();
  const farNodes = new Billboards(200);
  sFar.add(farNodes.mesh);
  const linesFar = new Lines3D(500);
  sFar.add(linesFar.mesh);
  const farPairs = knnPairs(FAR.map((n) => n.anchor), 3, 6, 61);
  const grid = new PointCloud({ count: 2400, softness: 0.1 });
  {
    const r = mulberry32(88);
    for (let i = 0; i < 2400; i++) {
      const gx = (i % 60) - 30;
      const gy = Math.floor(i / 60) - 20;
      const on = r() < 0.5;
      grid.set(i, 2 + gx * 0.42, gy * 0.42, -14, "#3F7FD0", on ? range(r, 0.15, 0.5) : 0.05, 0.05, 1);
    }
  }
  grid.commit();
  sFar.add(grid.points);

  const layers: LayerSpec[] = [
    { scene: sFar, blur: 0.0035 },
    { scene: sGlobe, blur: 0 },
    { scene: sNear, blur: 0.009 },
  ];

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const midNow: THREE.Vector3[] = [];

  return {
    camera,
    layers,
    pipeline: { background: BG, bloomThreshold: 0.7, bloomKnee: 0.4, bloomIntensity: 0.85, bloomRadius: 0.65, vignette: 0.5 },
    update: (f) => {
      // camera: steady, slightly off-centre, gentle closed-cycle drift
      camera.position.set(0.25 * cyc(f, LOOP, 1), 0.15 * cyc(f, LOOP, 1, 1.1), 13 + 0.3 * cyc(f, LOOP, 1, 2.0));
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();

      // one full globe turn per 900 frames
      spin.rotation.y = (TAU * f) / LOOP;
      for (const r of rings) r.spinG.rotation.y = (TAU * r.k * f) / LOOP;
      root.updateMatrixWorld(true);

      // positions now
      midNow.length = 0;
      for (const p of surfLocal) midNow.push(p.clone().applyMatrix4(spin.matrixWorld));
      for (const m of MID) midNow.push(floaterPos(m, f, new THREE.Vector3()));

      iconsMid.begin();
      surfLocal.forEach((_, i) => {
        const p = midNow[i];
        const blink = 0.75 + 0.25 * cyc(f, LOOP, 1 + (i % 4), i);
        iconsMid.icon("person", p.x, p.y, p.z, 0.2, ICON, 0.95 * blink, { facing: true, i: 1.6 });
      });
      MID.forEach((m, j) => {
        const p = midNow[surfLocal.length + j];
        iconsMid.icon("person", p.x, p.y, p.z, m.size, ICON, m.bright, { i: 1.5 });
      });
      iconsMid.end();

      // plexus lines; surface ends fade on the far side of the globe
      const camPos = camera.position;
      const vis = (i: number) => {
        if (i >= surfLocal.length) return 1;
        const p = midNow[i];
        tmp.copy(p).sub(GLOBE_POS).normalize();
        tmp2.copy(camPos).sub(p).normalize();
        return THREE.MathUtils.smoothstep(tmp.dot(tmp2), -0.05, 0.25);
      };
      linesMid.begin();
      pulses.begin();
      midPairs.forEach((pr, k) => {
        const a = midNow[pr.a];
        const b = midNow[pr.b];
        const d = a.distanceTo(b);
        const al = THREE.MathUtils.smoothstep(4.2 - d, 0, 1.2) * Math.min(vis(pr.a), vis(pr.b));
        if (al <= 0.01) return;
        linesMid.seg(a.x, a.y, a.z, b.x, b.y, b.z, 1.2, LINE, 0.4 * al, 1.1);
        if (pr.pulse) {
          const t = (((f / pr.period + pr.ph) % 1) + 1) % 1;
          tmp.copy(a).lerp(b, t);
          pulses.blob(tmp.x, tmp.y, tmp.z, 0.16, "#DFF8FF", al * Math.sin(Math.PI * t), { i: 2.2 });
        }
        void k;
      });
      linesMid.end();
      pulses.end();

      // near
      iconsNear.begin();
      linesNear.begin();
      const nearNow = NEAR.map((n) => floaterPos(n, f, new THREE.Vector3()));
      NEAR.forEach((n, i) => iconsNear.icon("person", nearNow[i].x, nearNow[i].y, nearNow[i].z, n.size, ICON, 0.7 * n.bright, { i: 1.3 }));
      for (const pr of nearPairs) {
        const a = nearNow[pr.a];
        const b = nearNow[pr.b];
        linesNear.seg(a.x, a.y, a.z, b.x, b.y, b.z, 1.6, LINE, 0.3, 1);
      }
      for (const s of SPECKS) {
        iconsNear.blob(s.p.x + 0.3 * cyc(f, LOOP, s.k, s.ph), s.p.y + 0.2 * cyc(f, LOOP, 1, s.ph * 2), s.p.z, s.s, "#9FDFFF", s.a, { i: 1.4, disc: true });
      }
      iconsNear.end();
      linesNear.end();

      // far web
      farNodes.begin();
      linesFar.begin();
      const farNow = FAR.map((n) => floaterPos(n, f, new THREE.Vector3()));
      FAR.forEach((n, i) => {
        if (i % 3 !== 2) farNodes.icon("person", farNow[i].x, farNow[i].y, farNow[i].z, n.size, ICON, 0.45 * n.bright, { i: 1.2 });
        else farNodes.blob(farNow[i].x, farNow[i].y, farNow[i].z, 0.07, "#8FD8FF", 0.4 * n.bright, { i: 1.3 });
      });
      for (const pr of farPairs) {
        const a = farNow[pr.a];
        const b = farNow[pr.b];
        linesFar.seg(a.x, a.y, a.z, b.x, b.y, b.z, 1.1, "#3F8FE0", 0.18, 1);
      }
      farNodes.end();
      linesFar.end();

      return { grainFrame: f % LOOP };
    },
  };
};

export const SocialGlobe: React.FC<LookProps> = ({ grade }) => <Stage build={build} grade={grade} />;
