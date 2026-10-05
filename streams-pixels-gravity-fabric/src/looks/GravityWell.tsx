import * as THREE from "three";
import { HASH, LINE_PROFILE, RIBBON, SIMPLEX } from "../gl/glsl";
import { Post, fullscreenMaterial } from "../gl/post";
import type { LookFactory } from "../gl/Stage";
import { phaseOf } from "../rng";

export type GravityWellOptions = {
  line: string; // outer grid line colour
  deep: string; // colour deep in the funnel
  glow: string; // throat glow
  planet?: {
    radius: number;
    light: string;
    dark: string;
    rim: string;
    moon: string;
  };
  // well profile h(r) = -k / sqrt(r^2 + eps), clamped at rMin
  k: number;
  eps: number;
  rMin: number;
};

const RINGS = 40;
const RADIALS = 64;
const RING_PTS = 360;
const RADIAL_PTS = 240;
const R_MAX = 40;
const ringRadius = (j: number, rMin: number) => rMin + 0.5 * j + 0.011 * j * j;

// Height field shared by the grid, the planet placement and the moon.
const WELL = /* glsl */ `
const float TAU = 6.28318530718;
uniform float uK, uEps, uRMin, uRMax;
uniform float uT;
uniform float uRot;
uniform vec3 uMoon;      // moon position (x, y, z); y < -50 disables the dip
float wellH(float r) {
  float rr = max(r, uRMin);
  return -uK / sqrt(rr * rr + uEps) + uK / sqrt(uRMax * uRMax + uEps);
}
float heightAt(float r, vec2 xz) {
  float h = wellH(r);
  // gentle ripples travelling inward: 3 whole waves per loop
  float env = smoothstep(uRMin, uRMin + 2.5, r) * exp(-r / 7.0);
  h += 0.06 * env * sin(TAU * (r / 2.6 + 3.0 * uT));
  if (uMoon.y > -50.0) {
    float d2 = dot(xz - uMoon.xz, xz - uMoon.xz);
    h += -0.6 / sqrt(d2 + 0.35) + 0.6 / sqrt(64.0 + 0.35);
  }
  return h;
}
vec3 gridPoint(float type, float fixedV, float u) {
  float r, phi;
  if (type < 0.5) { r = fixedV; phi = u * TAU; }
  else {
    // radial lines: denser sampling near the throat where curvature is high
    r = uRMin + (uRMax - uRMin) * u * u;
    phi = fixedV;
  }
  phi += uRot;
  vec2 xz = vec2(cos(phi), sin(phi)) * r;
  return vec3(xz.x, heightAt(r, xz), xz.y);
}
`;

const GRID_VERT = /* glsl */ `
${LINE_PROFILE}
${RIBBON}
${WELL}
attribute float aU;
attribute float aSide;
attribute vec3 aG;      // type, fixed value, du
uniform vec2 uRes;
uniform float uWidth;   // core width as fraction of height
uniform vec3 uLine, uDeep;
varying float vD;
varying float vCore;
varying float vSigma;
varying vec3 vCol;
void main() {
  vec3 p = gridPoint(aG.x, aG.y, aU);
  vec3 pa = gridPoint(aG.x, aG.y, aU - aG.z);
  vec3 pb = gridPoint(aG.x, aG.y, aU + aG.z);
  float core = uWidth * uRes.y;
  float sigma = lineSigma(core, 0.0);
  float halfW = 3.2 * sigma + 1.0;
  gl_Position = ribbonClip(p, pa, pb, aSide, halfW, uRes);
  vD = aSide * halfW;
  vCore = core;
  vSigma = sigma;
  float rr = length(p.xz);
  float depth = smoothstep(-1.2, -4.0, p.y);
  float bottom = smoothstep(uRMin + 1.3, uRMin + 0.2, rr); // deepest rings fade into violet-blue
  float distFade = 1.0 - 0.6 * smoothstep(10.0, 40.0, length(p - cameraPosition));
  vec3 col = mix(uLine, uDeep, depth * 0.7) * 1.2 * distFade;
  col = mix(col, vec3(0.04, 0.12, 0.7) * 0.45, bottom);
  // outermost ring fades so the grid edge never shows
  float r = length(p.xz);
  col *= smoothstep(uRMax, uRMax - 4.0, r);
  vCol = col;
}
`;

const GRID_FRAG = /* glsl */ `
${LINE_PROFILE}
varying float vD;
varying float vCore;
varying float vSigma;
varying vec3 vCol;
void main() {
  gl_FragColor = vec4(vCol * lineProfile(vD, vCore, vSigma), 1.0);
}
`;

// Soft glow deep in the throat (screen-space, positioned from the projected throat).
const BG_FRAG = /* glsl */ `
uniform vec2 uGlowPos;   // uv
uniform vec2 uGlowSize;  // uv radii
uniform vec3 uGlow;
varying vec2 vUv;
void main() {
  vec2 d = (vUv - uGlowPos) / uGlowSize;
  float g = exp(-dot(d, d) * 1.6);
  gl_FragColor = vec4(uGlow * g * 0.012, 1.0);
}
`;

const PLANET_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vObjN;
varying vec3 vW;
void main() {
  vObjN = normal;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const PLANET_FRAG = /* glsl */ `
${SIMPLEX}
${HASH}
uniform float uSpin;       // radians, whole turns per loop
uniform vec3 uLight, uDark, uRim;
uniform float uMoonMode;   // 1 = cratered moon surface
varying vec3 vN;
varying vec3 vObjN;
varying vec3 vW;
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  // surface coordinates in the spinning frame
  vec3 o = normalize(vObjN);
  float c = cos(uSpin), s = sin(uSpin);
  vec3 q = vec3(c * o.x - s * o.z, o.y, s * o.x + c * o.z);
  float tone;
  if (uMoonMode > 0.5) {
    tone = 0.55 + 0.25 * snoise(q * 3.0) + 0.12 * snoise(q * 9.0);
  } else {
    // banded gas-giant: latitude bands warped by low-frequency noise
    float warp = 0.045 * snoise(q * 2.2) + 0.015 * snoise(q * 6.0);
    float lat = q.y + warp;
    tone = 0.5 + 0.28 * sin(lat * 15.0) + 0.16 * sin(lat * 37.0 + 1.3) + 0.08 * snoise(vec3(lat * 30.0, q.x * 2.0, q.z * 2.0));
  }
  vec3 base = mix(uDark, uLight, clamp(tone, 0.0, 1.0));
  vec3 L = normalize(vec3(-0.6, 0.75, 0.45));
  float diff = max(dot(n, L), 0.0);
  float wrap = max((dot(n, L) + 0.35) / 1.35, 0.0);
  vec3 h = normalize(L + v);
  float spec = pow(max(dot(n, h), 0.0), 60.0) * (uMoonMode > 0.5 ? 0.05 : 0.45);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = base * (0.03 + 1.1 * mix(diff, wrap, 0.4)) + vec3(spec);
  col += uRim * fres * (0.9 + 0.6 * (1.0 - diff));
  gl_FragColor = vec4(col, 1.0);
}
`;

const buildGrid = (rMin: number) => {
  const lines: { type: number; fixed: number; pts: number }[] = [];
  for (let j = 0; j < RINGS; j++) lines.push({ type: 0, fixed: ringRadius(j, rMin), pts: RING_PTS });
  for (let k = 0; k < RADIALS; k++) lines.push({ type: 1, fixed: (k / RADIALS) * Math.PI * 2, pts: RADIAL_PTS });
  const total = lines.reduce((a, l) => a + l.pts * 2, 0);
  const aU = new Float32Array(total);
  const aSide = new Float32Array(total);
  const aG = new Float32Array(total * 3);
  const idx: number[] = [];
  let v = 0;
  for (const l of lines) {
    const base = v;
    const du = 1 / (l.pts - 1);
    for (let j = 0; j < l.pts; j++) {
      for (const side of [-1, 1]) {
        aU[v] = j * du;
        aSide[v] = side;
        aG.set([l.type, l.fixed, du], v * 3);
        v++;
      }
      if (j < l.pts - 1) {
        const a = base + j * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(total * 3), 3));
  g.setAttribute("aU", new THREE.BufferAttribute(aU, 1));
  g.setAttribute("aSide", new THREE.BufferAttribute(aSide, 1));
  g.setAttribute("aG", new THREE.BufferAttribute(aG, 3));
  g.setIndex(idx);
  return g;
};

// CPU copy of wellH/heightAt for placing the planet and moon.
const wellH = (r: number, o: GravityWellOptions) => {
  const rr = Math.max(r, o.rMin);
  return -o.k / Math.sqrt(rr * rr + o.eps) + o.k / Math.sqrt(R_MAX * R_MAX + o.eps);
};

export const createGravityWell =
  (o: GravityWellOptions): LookFactory =>
  (gl) => {
    const post = new Post(gl, { msaa: 4, depth: false, dof: false });
    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);

    const wellUniforms = {
      uK: { value: o.k },
      uEps: { value: o.eps },
      uRMin: { value: o.rMin },
      uRMax: { value: R_MAX },
      uT: { value: 0 },
      uRot: { value: 0 },
      uMoon: { value: new THREE.Vector3(0, -100, 0) },
    };
    const gridMat = new THREE.ShaderMaterial({
      vertexShader: GRID_VERT,
      fragmentShader: GRID_FRAG,
      uniforms: {
        ...wellUniforms,
        uRes: { value: new THREE.Vector2(post.width, post.height) },
        uWidth: { value: 0.0008 },
        uLine: { value: new THREE.Color(o.line) },
        uDeep: { value: new THREE.Color(o.deep) },
      },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const bgMat = fullscreenMaterial(BG_FRAG, {
      uGlowPos: { value: new THREE.Vector2(0.5, 0.4) },
      uGlowSize: { value: new THREE.Vector2(0.1, 0.06) },
      uGlow: { value: new THREE.Color(o.glow) },
    });
    const scene = new THREE.Scene();
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const bg = new THREE.Mesh(bgGeo, bgMat);
    bg.renderOrder = -1;
    const grid = new THREE.Mesh(buildGrid(o.rMin), gridMat);
    [bg, grid].forEach((m) => {
      m.frustumCulled = false;
      scene.add(m);
    });
    grid.renderOrder = 2;

    let planet: THREE.Mesh | undefined;
    let moon: THREE.Mesh | undefined;
    let planetMat: THREE.ShaderMaterial | undefined;
    let moonMat: THREE.ShaderMaterial | undefined;
    const sphere = new THREE.SphereGeometry(1, 160, 96);
    if (o.planet) {
      const P = o.planet;
      planetMat = new THREE.ShaderMaterial({
        vertexShader: PLANET_VERT,
        fragmentShader: PLANET_FRAG,
        uniforms: {
          uSpin: { value: 0 },
          uLight: { value: new THREE.Color(P.light) },
          uDark: { value: new THREE.Color(P.dark) },
          uRim: { value: new THREE.Color(P.rim) },
          uMoonMode: { value: 0 },
        },
      });
      moonMat = new THREE.ShaderMaterial({
        vertexShader: PLANET_VERT,
        fragmentShader: PLANET_FRAG,
        uniforms: {
          uSpin: { value: 0 },
          uLight: { value: new THREE.Color(P.moon) },
          uDark: { value: new THREE.Color(P.moon).multiplyScalar(0.35) },
          uRim: { value: new THREE.Color(P.rim).multiplyScalar(0.5) },
          uMoonMode: { value: 1 },
        },
      });
      planet = new THREE.Mesh(sphere, planetMat);
      planet.scale.setScalar(P.radius);
      // rests in the throat: centre a little above where the wall is as wide as the planet
      planet.position.set(0, wellH(P.radius * 0.8, o) + P.radius * 0.62, 0);
      planet.rotation.z = 0.32;
      planet.renderOrder = 1;
      moon = new THREE.Mesh(sphere, moonMat);
      moon.scale.setScalar(P.radius * 0.17);
      moon.renderOrder = 1;
      scene.add(planet, moon);
    }

    const target = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    return {
      render(frame) {
        const t = phaseOf(frame);
        const th = t * Math.PI * 2;
        wellUniforms.uT.value = t;
        // one grid step (360/72 deg) per loop: the 72-fold grid returns to itself
        wellUniforms.uRot.value = (t * Math.PI * 2) / RADIALS;

        // camera: ~35 deg above the plane, partial orbit of +-10 deg and back
        const az = THREE.MathUtils.degToRad(-90 + 10 * Math.sin(th));
        const el = THREE.MathUtils.degToRad(o.planet ? 36 : 34);
        const dist = o.planet ? 16 : 15;
        target.set(0, o.planet ? -1.2 : -3.0, 0);
        camera.position.set(
          target.x + dist * Math.cos(el) * Math.cos(az),
          target.y + dist * Math.sin(el),
          target.z + dist * Math.cos(el) * Math.sin(az),
        );
        camera.lookAt(target);
        // shift the image so the funnel sits a little below centre
        camera.setViewOffset(1600, 900, 0, o.planet ? -95 : 40, 1600, 900);
        camera.updateMatrixWorld();

        if (o.planet && planet && moon && planetMat) {
          planetMat.uniforms.uSpin.value = th; // one turn per loop
          const mr = o.planet.radius * 2.5;
          const ma = th + 0.6;
          const mx = mr * Math.cos(ma);
          const mz = mr * Math.sin(ma);
          const groundY = wellH(mr, o);
          moon.position.set(mx, groundY + o.planet.radius * 0.3, mz);
          moon.rotation.y = -ma;
          wellUniforms.uMoon.value.set(mx, 0, mz);
        }

        // throat glow at the projected bottom of the well
        tmp.set(0, wellH(o.rMin, o), 0).project(camera);
        bgMat.uniforms.uGlowPos.value.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5);
        bgMat.uniforms.uGlowSize.value.set(0.2, 0.2);

        post.render(scene, camera, frame, {
          bloom: 0.5,
          threshold: 0.45,
          knee: 0.3,
          exposure: 1.0,
          grain: 0.02,
          bloomWeights: [1, 0.9, 0.8, 0.7, 0.5, 0.4, 0.3],
        });
      },
      dispose() {
        post.dispose();
        grid.geometry.dispose();
        bgGeo.dispose();
        sphere.dispose();
        gridMat.dispose();
        bgMat.dispose();
        planetMat?.dispose();
        moonMat?.dispose();
      },
    };
  };
