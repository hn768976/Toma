import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LookFactory } from '../../lib/ThreeStage';
import { PanelsVersion } from '../../versions';
import { Rng } from '../../lib/rng';
import { hexToLinear, mod, TAU } from '../../lib/math';
import { SpriteField } from '../../lib/sprites';

export const PANELS_FRAMES = 600;

// Panels tile with period L in x and z. The camera tracks along +x by exactly
// N_TILES * L over 600 frames; laser streaks slide by whole periods.
const L = 10;
const N_TILES = 1;
const GAP = 0.12;
const LASER_Y = 1.05;
const COPIES = 3; // tile copies each side of the camera

type Leaf = { x: number; z: number; w: number; d: number };

const subdivide = (rng: Rng): Leaf[] => {
  const out: Leaf[] = [];
  const rec = (x: number, z: number, w: number, d: number, depth: number) => {
    const big = Math.max(w, d);
    const stop = big < rng.range(1.0, 2.6) || depth > 9;
    if (stop && big < 2.9) {
      out.push({ x, z, w, d });
      return;
    }
    const k = rng.range(0.3, 0.7);
    if (w >= d) {
      rec(x, z, w * k, d, depth + 1);
      rec(x + w * k, z, w * (1 - k), d, depth + 1);
    } else {
      rec(x, z, w, d * k, depth + 1);
      rec(x, z + d * k, w, d * (1 - k), depth + 1);
    }
  };
  // start from a 2x2 split so the tile edges are always seams
  rec(0, 0, L / 2, L / 2, 0);
  rec(L / 2, 0, L / 2, L / 2, 0);
  rec(0, L / 2, L / 2, L / 2, 0);
  rec(L / 2, L / 2, L / 2, L / 2, 0);
  return out;
};

type Built = { dark: THREE.BufferGeometry; silver: THREE.BufferGeometry; trim: THREE.BufferGeometry };

const buildTile = (seed: number): Built => {
  const rng = new Rng(seed);
  const leaves = subdivide(rng);
  const dark: THREE.BufferGeometry[] = [];
  const silver: THREE.BufferGeometry[] = [];
  const trim: THREE.BufferGeometry[] = [];
  const box = (arr: THREE.BufferGeometry[], cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) => {
    if (sx <= 0.002 || sy <= 0.001 || sz <= 0.002) return;
    const g = new THREE.BoxGeometry(sx, sy, sz);
    g.translate(cx, cy, cz);
    arr.push(g);
  };
  const levels = [0.18, 0.34, 0.5, 0.68];
  for (const lf of leaves) {
    const x0 = lf.x + GAP / 2;
    const z0 = lf.z + GAP / 2;
    const w = lf.w - GAP;
    const d = lf.d - GAP;
    const cx = x0 + w / 2;
    const cz = z0 + d / 2;
    const H = rng.pick(levels) * rng.range(0.9, 1.1);
    const type = rng.f();
    const f = Math.min(w, d) * rng.range(0.1, 0.18);
    // trim: a thin glowing band around the base of every block
    box(trim, cx, 0.03, cz, w + 0.014, 0.018, d + 0.014);
    if (type < 0.75) {
      // framed: recessed silver panel inside a raised dark frame
      const r = rng.range(0.05, 0.1);
      box(dark, cx, (H - r) / 2, cz, w, H - r, d);
      box(dark, cx, H - r / 2, z0 + f / 2, w, r, f);
      box(dark, cx, H - r / 2, z0 + d - f / 2, w, r, f);
      box(dark, x0 + f / 2, H - r / 2, cz, f, r, d - 2 * f);
      box(dark, x0 + w - f / 2, H - r / 2, cz, f, r, d - 2 * f);
      box(silver, cx, H - r + 0.01, cz, w - 2 * f - 0.04, 0.02, d - 2 * f - 0.04);
      if (rng.chance(0.75) && Math.min(w, d) > 0.7) {
        // nested inner frame ring
        const iw = w - 2 * f - 0.25;
        const id = d - 2 * f - 0.25;
        const f2 = Math.min(iw, id) * 0.1;
        const y2 = H - r + 0.02 + 0.03;
        box(dark, cx, y2, z0 + f + 0.125 + f2 / 2, iw, 0.06, f2);
        box(dark, cx, y2, z0 + d - f - 0.125 - f2 / 2, iw, 0.06, f2);
        box(dark, x0 + f + 0.125 + f2 / 2, y2, cz, f2, 0.06, id - 2 * f2);
        box(dark, x0 + w - f - 0.125 - f2 / 2, y2, cz, f2, 0.06, id - 2 * f2);
      }
      if (rng.chance(0.85)) {
        // glowing line along the inner edge of the frame
        const y = H - r + 0.03;
        const t = 0.016;
        box(trim, cx, y, z0 + f + t / 2, w - 2 * f, t, t);
        box(trim, cx, y, z0 + d - f - t / 2, w - 2 * f, t, t);
        box(trim, x0 + f + t / 2, y, cz, t, t, d - 2 * f);
        box(trim, x0 + w - f - t / 2, y, cz, t, t, d - 2 * f);
      }
    } else if (type < 0.9) {
      // stacked: smaller block on top
      box(dark, cx, H / 2, cz, w, H, d);
      const k = rng.range(0.55, 0.8);
      const h2 = rng.range(0.08, 0.18);
      box(dark, cx, H + h2 / 2, cz, w * k, h2, d * k);
      box(silver, cx, H + h2 + 0.006, cz, w * k - 0.08, 0.012, d * k - 0.08);
      if (rng.chance(0.4)) box(trim, cx, H + 0.02, cz, w * k + 0.012, 0.012, d * k + 0.012);

    } else {
      // flat block with an inset plate
      box(dark, cx, H / 2, cz, w, H, d);
      box(silver, cx, H + 0.006, cz, w - 2 * f, 0.012, d - 2 * f);
    }
  }
  const merge = (a: THREE.BufferGeometry[]) => {
    const g = mergeGeometries(a, false)!;
    g.computeBoundingSphere();
    return g;
  };
  return { dark: merge(dark), silver: merge(silver), trim: merge(trim) };
};

// Lasers: family A runs along x (parallel to the travel), family B along z,
// repeating every L in x. Each laser shows streaks that repeat with `period`
// along its length and slide by whole periods over the loop.
type Laser = { pos: number; period: number; len: number; c0: number; m: number; inten: number };
const makeLasers = (seed: number) => {
  const rng = new Rng(seed);
  const A: Laser[] = [];
  const B: Laser[] = [];
  for (let i = 0; i < 8; i++) {
    const period = L;
    A.push({ pos: rng.range(-7, 7), period, len: period * rng.range(0.5, 0.85), c0: rng.range(0, period), m: rng.sign() * rng.int(1, 2), inten: rng.range(0.6, 1.0) });
  }
  for (let i = 0; i < 3; i++) {
    const period = rng.range(14, 22);
    B.push({ pos: rng.range(0, L), period, len: period * rng.range(0.5, 0.85), c0: rng.range(0, period), m: rng.sign() * rng.int(1, 3), inten: rng.range(0.6, 1.0) });
  }
  return { A, B };
};

const TILE = buildTile(1090975989);
const LASERS = makeLasers(5150);

const LASER_VERT = /* glsl */ `
in vec3 aA;
in vec3 aB;
in vec2 aCorner;
in vec2 aU;      // along-coordinate (world units) at A and B
in vec4 aStreak; // shift, len, period, intensity
uniform vec2 uViewport;
uniform float uHalfPx;
out float vAcrossW;
out float vW;
out float vU;
out vec4 vStreak;
out float vFade;
void main() {
  vec4 a = viewMatrix * vec4(aA, 1.0);
  vec4 b = viewMatrix * vec4(aB, 1.0);
  float ua = aU.x, ub = aU.y;
  float zn = -1.0;
  if (a.z > zn && b.z > zn) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (a.z > zn) { float k = (zn - a.z) / (b.z - a.z); a = mix(a, b, k); ua = mix(ua, ub, k); }
  if (b.z > zn) { float k = (zn - b.z) / (a.z - b.z); b = mix(b, a, k); ub = mix(ub, ua, k); }
  vec4 ca = projectionMatrix * a;
  vec4 cb = projectionMatrix * b;
  vec2 sa = ca.xy / ca.w * uViewport * 0.5;
  vec2 sb = cb.xy / cb.w * uViewport * 0.5;
  vec2 d = sb - sa;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  bool atB = aCorner.x > 0.5;
  vec4 C = atB ? cb : ca;
  vec2 off = nrm * uHalfPx * aCorner.y;
  gl_Position = C + vec4(off / (uViewport * 0.5) * C.w, 0.0, 0.0);
  vW = C.w;
  vAcrossW = aCorner.y * C.w;
  vU = atB ? ub : ua;
  vStreak = aStreak;
  vFade = 1.0 - smoothstep(12.0, 24.0, -(atB ? b.z : a.z));
}`;

const STREAK_GLSL = /* glsl */ `
float streak(float u, vec4 s) {
  float x = mod(u - s.x, s.z);
  float l = s.y;
  return smoothstep(0.0, 0.3 * l, x) * (1.0 - smoothstep(0.65 * l, l, x)) * s.w;
}`;

const LASER_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
in float vAcrossW;
in float vW;
in float vU;
in vec4 vStreak;
in float vFade;
out vec4 outColor;
${STREAK_GLSL}
void main() {
  float x = vAcrossW / vW;
  float core = exp(-x * x * 9.0) + 0.35 * exp(-x * x * 1.5);
  float k = streak(vU, vStreak);
  outColor = vec4(uColor * k * core * (1.0 + 0.6 * exp(-x * x * 60.0)) * vFade, 1.0);
}`;

const LASER_FRAG_FADE = LASER_FRAG;

export const makePanelsFactory =
  (v: PanelsVersion): LookFactory =>
  (assets, gl) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0, 0, 0);
    const pm = new THREE.PMREMGenerator(gl);
    scene.environment = pm.fromEquirectangular(assets.hdri!).texture;
    pm.dispose();
    scene.environmentIntensity = 0.15;
    // orient the studio HDRI so its softboxes reflect left of centre, leaving the right side darker
    scene.environmentRotation.set(0, Math.PI * 0.3, 0);
    scene.fog = new THREE.Fog(0x000000, 16, 32);
    const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 200);

    const laserCol = new THREE.Vector3(...hexToLinear(v.laser));
    // colour grade derived from the version's laser colour (cyan -> teal grade,
    // orange -> warm grade), so the two versions differ only in colour
    const lm = Math.max(laserCol.x, laserCol.y, laserCol.z);
    const cool = [0.96, 0.96, 1.1]; // shared by every version
    const g = [laserCol.x / lm, laserCol.y / lm, laserCol.z / lm].map((c, i) => (0.62 + 0.53 * c) * cool[i]);
    const gLum = 0.2126 * g[0] + 0.7152 * g[1] + 0.0722 * g[2];
    const gradeTint: [number, number, number] = [g[0] / gLum, g[1] / gLum, g[2] / gLum];
    const trimCol = new THREE.Color().setRGB(...hexToLinear(v.trim));
    const nA = LASERS.A.length;
    const nB = LASERS.B.length;

    // laser-light uniforms shared by the panel materials (filled every frame)
    const uLA = { value: LASERS.A.map(() => new THREE.Vector4()) }; // pos, shift, len, period
    const uLB = { value: LASERS.B.map(() => new THREE.Vector4()) };
    const uIA = { value: LASERS.A.map((l) => l.inten) };
    const uIB = { value: LASERS.B.map((l) => l.inten) };
    const uLaserCol = { value: laserCol.clone() };

    const panelMaterial = (color: string, metalness: number, roughness: number, reflect: number, noiseAlbedo: number) => {
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color().setRGB(...hexToLinear(color)),
        metalness,
        roughness,
      });
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uLA = uLA;
        sh.uniforms.uLB = uLB;
        sh.uniforms.uIA = uIA;
        sh.uniforms.uIB = uIB;
        sh.uniforms.uLaserCol = uLaserCol;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vW3;')
          .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW3 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
varying vec3 vW3;
uniform vec4 uLA[${nA}];
uniform vec4 uLB[${nB}];
uniform float uIA[${nA}];
uniform float uIB[${nB}];
uniform vec3 uLaserCol;
${STREAK_GLSL}
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.7) * 0.3 + vnoise(p * 7.3) * 0.15; }`,
          )
          .replace(
            '#include <roughnessmap_fragment>',
            `#include <roughnessmap_fragment>
            vec2 tileUv = mod(vW3.xz, ${L.toFixed(1)});
            roughnessFactor = clamp(roughnessFactor * (0.6 + 0.8 * fbm(tileUv * 9.0)), 0.05, 1.0);`,
          )
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            diffuseColor.rgb *= 1.0 + ${noiseAlbedo.toFixed(3)} * (fbm(mod(vW3.xz, ${L.toFixed(1)}) * 11.0 + 3.1) - 0.5);`,
          )
          .replace(
            '#include <opaque_fragment>',
            `vec3 laserLight = vec3(0.0);
            for (int i = 0; i < ${nA}; i++) {
              vec4 s = uLA[i];
              vec2 dv = vec2(vW3.y - ${LASER_Y.toFixed(3)}, vW3.z - s.x);
              laserLight += streak(vW3.x, vec4(s.y, s.z, s.w, uIA[i])) / (1.0 + dot(dv, dv) * 10.0);
            }
            for (int i = 0; i < ${nB}; i++) {
              vec4 s = uLB[i];
              float dx = mod(vW3.x - s.x + ${(L / 2).toFixed(1)}, ${L.toFixed(1)}) - ${(L / 2).toFixed(1)};
              vec2 dv = vec2(vW3.y - ${LASER_Y.toFixed(3)}, dx);
              laserLight += streak(vW3.z, vec4(s.y, s.z, s.w, uIB[i])) / (1.0 + dot(dv, dv) * 10.0);
            }
            outgoingLight += uLaserCol * laserLight * (0.05 + diffuseColor.rgb) * ${reflect.toFixed(3)};
            #include <opaque_fragment>`,
          );
      };
      mat.customProgramCacheKey = () => `panel-${color}-${reflect}`;
      return mat;
    };

    const darkMat = panelMaterial('#171b20', 0.8, 0.32, 3.0, 0.6);
    const silverMat = panelMaterial('#2b3137', 0.9, 0.28, 2.6, 0.9);
    const trimMat = new THREE.MeshBasicMaterial({ color: trimCol.clone().multiplyScalar(5.0), fog: true });
    const floorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...hexToLinear('#03090b')) });

    const tiles = new THREE.Group();
    for (let tz = -COPIES; tz <= COPIES; tz++) {
      for (let tx = -COPIES - 1; tx <= COPIES + 1; tx++) {
        const g = new THREE.Group();
        g.position.set(tx * L, 0, tz * L);
        g.add(new THREE.Mesh(TILE.dark, darkMat), new THREE.Mesh(TILE.silver, silverMat), new THREE.Mesh(TILE.trim, trimMat));
        tiles.add(g);
      }
    }
    scene.add(tiles);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 100, 100), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // lasers: one ribbon per visible laser line
    const nSegs = nA + nB * 9;
    const aA = new Float32Array(nSegs * 4 * 3);
    const aB = new Float32Array(nSegs * 4 * 3);
    const aU = new Float32Array(nSegs * 4 * 2);
    const aS = new Float32Array(nSegs * 4 * 4);
    const aCorner = new Float32Array(nSegs * 4 * 2);
    const idx: number[] = [];
    for (let i = 0; i < nSegs; i++) {
      aCorner.set([0, -1, 0, 1, 1, 1, 1, -1], i * 8);
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nSegs * 4 * 3), 3));
    const atA = new THREE.BufferAttribute(aA, 3).setUsage(THREE.DynamicDrawUsage);
    const atB = new THREE.BufferAttribute(aB, 3).setUsage(THREE.DynamicDrawUsage);
    const atU = new THREE.BufferAttribute(aU, 2).setUsage(THREE.DynamicDrawUsage);
    const atS = new THREE.BufferAttribute(aS, 4).setUsage(THREE.DynamicDrawUsage);
    lgeo.setAttribute('aA', atA);
    lgeo.setAttribute('aB', atB);
    lgeo.setAttribute('aU', atU);
    lgeo.setAttribute('aStreak', atS);
    lgeo.setAttribute('aCorner', new THREE.BufferAttribute(aCorner, 2));
    lgeo.setIndex(idx);
    const lmat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: LASER_VERT,
      fragmentShader: LASER_FRAG_FADE,
      uniforms: {
        uViewport: { value: new THREE.Vector2(1280, 720) },
        uHalfPx: { value: 2.0 },
        uColor: { value: laserCol.clone().multiplyScalar(4.0) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const lasers = new THREE.Mesh(lgeo, lmat);
    lasers.frustumCulled = false;
    lasers.renderOrder = 10;
    scene.add(lasers);

    // moving hot spot
    const hot = new THREE.PointLight(0xd6f0ff, 55, 9, 1.6);
    scene.add(hot);
    // soft glare around the hot spot (camera-facing, additive)
    const glareCol = new THREE.Vector3(0.75, 0.92, 1.0);
    const glare = new SpriteField(1, glareCol, glareCol, { fogNear: 40, fogFar: 60, minPx: 2, sharp: 2.5 });
    const glareMesh = glare.mesh();
    glareMesh.material.depthTest = false;
    scene.add(glareMesh);
    const fill = new THREE.DirectionalLight(0xa8d0e0, 0.3);
    fill.position.set(-4, 7, 2);
    scene.add(fill);
    scene.add(new THREE.HemisphereLight(0x6f9fb4, 0x040809, 0.32));

    const EL = THREE.MathUtils.degToRad(38);
    const YAW = THREE.MathUtils.degToRad(-42);
    const R = 9.8;
    const target = new THREE.Vector3();
    const fwd = new THREE.Vector3(Math.sin(YAW), 0, -Math.cos(YAW));

    const setSeg = (i: number, a: THREE.Vector3, b: THREE.Vector3, ua: number, ub: number, shift: number, len: number, period: number, inten: number) => {
      for (let c = 0; c < 4; c++) {
        const k = i * 4 + c;
        aA.set([a.x, a.y, a.z], k * 3);
        aB.set([b.x, b.y, b.z], k * 3);
        aU.set([ua, ub], k * 2);
        aS.set([shift, len, period, inten], k * 4);
      }
    };
    const pa = new THREE.Vector3();
    const pb = new THREE.Vector3();

    return {
      scene,
      camera,
      update: (frame, aspect, viewH) => {
        const t = frame / PANELS_FRAMES;
        // travel N_TILES*L, wrapped into one tile (the world repeats every L)
        const tx = mod(N_TILES * L * t, L);
        target.set(tx, 0.3, 0);
        camera.position.copy(target).addScaledVector(fwd, -R * Math.cos(EL));
        camera.position.y += R * Math.sin(EL);
        camera.lookAt(target);
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        // keep tile copies centred on the camera (whole tiles only)
        tiles.position.set(Math.floor(target.x / L) * L, 0, 0);
        floor.position.set(target.x, 0, target.z);

        let i = 0;
        LASERS.A.forEach((l, j) => {
          const shift = mod(l.c0 + l.m * l.period * t, l.period);
          uLA.value[j].set(l.pos, shift, l.len, l.period);
          // only the part in front of the camera (it looks toward -x/-z)
          pa.set(target.x - 40, LASER_Y, l.pos);
          pb.set(camera.position.x + 3, LASER_Y, l.pos);
          setSeg(i++, pa, pb, pa.x, pb.x, shift, l.len, l.period, l.inten);
        });
        LASERS.B.forEach((l, j) => {
          const shift = mod(l.c0 + l.m * l.period * t, l.period);
          uLB.value[j].set(l.pos, shift, l.len, l.period);
          const base = Math.floor(target.x / L) * L;
          for (let k = -4; k <= 4; k++) {
            const x = l.pos + base + k * L;
            pa.set(x, LASER_Y, target.z - 40);
            pb.set(x, LASER_Y, camera.position.z + 3);
            setSeg(i++, pa, pb, pa.z, pb.z, shift, l.len, l.period, l.inten);
          }
        });
        atA.needsUpdate = atB.needsUpdate = atU.needsUpdate = atS.needsUpdate = true;
        lmat.uniforms.uViewport.value.set(viewH * aspect, viewH);
        lmat.uniforms.uHalfPx.value = 6.0 * (viewH / 720);

        // hot spot wanders over the surface (closed path)
        // hot spot: a little left of / above frame centre, wandering on a closed path
        hot.position.set(target.x - 0.6 + 1.3 * Math.sin(TAU * t), 1.25, target.z - 0.4 + 0.9 * Math.sin(TAU * 2 * t + 0.8));
        glare.set(0, hot.position.x, 0.9, hot.position.z, 2.6, 0.22, 0);
        glare.commit(viewH);
      },
      post: () => ({
        loopFrames: PANELS_FRAMES,
        exposure: 1.0,
        bloomStrength: 1.1,
        bloomRadius: 0.7,
        bloomThreshold: 0.5,
        bloomKnee: 0.4,
        dof: { enabled: true, focusDistance: R, farBlur: 0.012, nearBlur: 0.016, nearScale: 1.0, sharpZone: 0.05 },
        tint: gradeTint,
        grain: 0.02,
        vignette: 0.45,
      }),
    };
  };
