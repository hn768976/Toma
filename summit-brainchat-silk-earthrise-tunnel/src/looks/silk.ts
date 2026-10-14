// Look 3 — Black Silk. A full-frame satin sheet (400x225 segments) displaced
// by travelling diagonal fold waves with sharpened crests plus loop-periodic
// low-frequency noise. Per-fragment normals from the analytic height field,
// anisotropic (Kajiya-Kay / Ward-like) satin highlight along the folds,
// filtered fine weave.
import * as THREE from "three";
import { SNOISE3 } from "../lib/glsl";
import { LOOP, osc } from "../lib/rng";
import type { BuildCtx, LookHandle } from "../lib/types";

export type SilkParams = {
  cloth: string;
  highlight: string;
  /** Diffuse light level multiplier. */
  diffuse: number;
  /** Specular strength multiplier. */
  spec: number;
  /** Ambient (sky) level. */
  ambient: number;
  exposure: number;
  /** Fade grain to zero below this display luminance (0 = off). */
  grainFadeLum: number;
};

// Height field shared by vertex and fragment shaders. All time terms are
// whole cycles per 600-frame loop (uT = frame/600 in [0,1)).
const HEIGHT_GLSL = /* glsl */ `
${SNOISE3}
uniform float uT;
const float TAU = 6.283185307179586;
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }
// loop-periodic noise: sample along a circle in the 3rd dimension
float lnoise(vec2 p, float r, float cycles, float off){
  float a = TAU * (uT * cycles + off);
  return snoise(vec3(p, 0.0) + vec3(r * cos(a), r * sin(a), 0.0) + vec3(0.0, 0.0, off * 17.0));
}
float ridge(float th, float sharp){
  // sharpened crest: narrow peaks, broad valleys
  float s = 0.5 + 0.5 * sin(th);
  return pow(s, sharp);
}
float clothH(vec2 p){
  // propagation direction: from upper-left to lower-right; crests rise gently to the right
  vec2 d0 = normalize(vec2(0.42, -1.0));
  vec2 q = p;
  // domain warp gives the crests their soft S-curves
  q += 0.5 * vec2(lnoise(p * 0.12, 0.55, 1.0, 0.13), lnoise(p * 0.12 + 7.3, 0.55, 1.0, 0.71));
  float h = 0.0;
  h += 0.40 * ridge(dot(q, rot(d0, 0.00)) * TAU / 3.0 - TAU * (1.0 * uT) + 0.3, 2.6);
  h += 0.24 * ridge(dot(q, rot(d0, 0.14)) * TAU / 1.9 - TAU * (2.0 * uT) + 1.7, 3.2);
  h += 0.10 * ridge(dot(q, rot(d0, -0.12)) * TAU / 1.3 - TAU * (2.0 * uT) + 4.1, 3.6);
  h += 0.03 * ridge(dot(q, rot(d0, 0.22)) * TAU / 0.85 - TAU * (3.0 * uT) + 2.6, 4.0);
  // low-frequency billow
  h += 0.30 * lnoise(p * 0.08 + 3.0, 0.4, 1.0, 0.37);
  return h;
}
`;

export function buildSilk(ctx: BuildCtx, p: SilkParams): LookHandle {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, ctx.width / ctx.height, 0.2, 100);

  const W = 30, Hh = 19;
  const geo = new THREE.PlaneGeometry(W, Hh, 400, 225);
  const uT = { value: 0 };
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uT,
      uCloth: { value: new THREE.Color(p.cloth) },
      uHi: { value: new THREE.Color(p.highlight) },
      uDiffuse: { value: p.diffuse },
      uSpec: { value: p.spec },
      uAmb: { value: p.ambient },
      uKeyDir: { value: new THREE.Vector3(-0.45, 0.75, 0.35).normalize() },
      uRimDir: { value: new THREE.Vector3(0.7, -0.35, 0.35).normalize() },
      uCamPos: { value: new THREE.Vector3() },
      uRot: { value: new THREE.Matrix3() },
    },
    vertexShader: /* glsl */ `
      ${HEIGHT_GLSL}
      out vec2 vP;
      out vec3 vWorld;
      void main(){
        vP = position.xy;
        vec3 pos = position;
        pos.z += clothH(position.xy);
        vec4 w = modelMatrix * vec4(pos, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${HEIGHT_GLSL}
      in vec2 vP;
      in vec3 vWorld;
      uniform vec3 uCloth, uHi, uKeyDir, uRimDir, uCamPos;
      uniform float uDiffuse, uSpec, uAmb;
      uniform mat3 uRot;
      void main(){
        // crisp per-fragment normal from the height field (central differences)
        float e = 0.006;
        float hx = clothH(vP + vec2(e, 0.0)) - clothH(vP - vec2(e, 0.0));
        float hy = clothH(vP + vec2(0.0, e)) - clothH(vP - vec2(0.0, e));
        float h0 = clothH(vP);
        vec3 N = normalize(vec3(-hx / (2.0 * e), -hy / (2.0 * e), 1.0));
        // plane is rotated by modelMatrix; bring normal to world
        N = normalize(uRot * N);

        // fine weave (filtered: fades out before it can alias)
        vec2 wv = vP * 34.0;
        float fw = max(fwidth(wv.x), fwidth(wv.y));
        float weaveAmt = 1.0 - smoothstep(0.25, 0.5, fw);
        vec3 Tw = normalize(uRot * vec3(1.0, 0.0, 0.0));
        vec3 Bw = normalize(uRot * vec3(0.0, 1.0, 0.0));
        N = normalize(N + weaveAmt * 0.07 * (sin(wv.x * TAU) * Tw * (0.6 + 0.4 * cos(wv.y * TAU)) + sin(wv.y * TAU) * Bw * (0.6 + 0.4 * cos(wv.x * TAU))));

        vec3 V = normalize(uCamPos - vWorld);
        // tangent along the fold crests (perpendicular to propagation)
        vec2 crest = normalize(vec2(1.0, 0.42));
        vec3 T = normalize(uRot * vec3(crest, 0.0));
        T = normalize(T - N * dot(N, T));

        vec3 L = uKeyDir;
        vec3 Hk = normalize(L + V);
        float NdL = max(dot(N, L), 0.0);
        // anisotropic satin lobe (Kajiya-Kay): long highlights along the crest
        float TdH = dot(T, Hk);
        float sinTH = sqrt(max(0.0, 1.0 - TdH * TdH));
        float aniso = pow(sinTH, 90.0) * smoothstep(0.0, 0.25, NdL);
        float broad = pow(sinTH, 12.0) * NdL;
        // rim light
        vec3 Hr = normalize(uRimDir + V);
        float TdHr = dot(T, Hr);
        float rim = pow(sqrt(max(0.0, 1.0 - TdHr * TdHr)), 50.0) * smoothstep(0.0, 0.3, dot(N, uRimDir));
        // sheen at grazing
        float NdV = max(dot(N, V), 0.0);
        float sheen = pow(1.0 - NdV, 4.0);
        // valleys sink into shadow
        float cav = smoothstep(-0.25, 0.75, h0);
        float occ = mix(0.25, 1.0, cav);

        vec3 col = uCloth * (uAmb + uDiffuse * pow(NdL, 2.0)) * occ;
        col += uHi * uSpec * (1.1 * aniso + 0.16 * broad + 0.3 * rim) * mix(0.4, 1.0, cav);
        col += uHi * 0.06 * sheen * occ;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const cloth = new THREE.Mesh(geo, mat);
  // tilt the sheet away so DoF falls off top and bottom
  cloth.rotation.x = -0.62;
  scene.add(cloth);
  cloth.updateMatrixWorld();
  (mat.uniforms.uRot.value as THREE.Matrix3).setFromMatrix4(cloth.matrixWorld);

  const post = {
    exposure: p.exposure,
    bloomStrength: 0.18,
    bloomThreshold: 1.2,
    bloomKnee: 0.5,
    bloomRadius: 0.7,
    dof: { focus: 8.2, aperture: 0.045, maxCoc: 0.014, nearScale: 0.8 },
    vignette: 0.3,
    grain: 0.015,
    grainFadeLum: p.grainFadeLum,
  };

  const camPos = mat.uniforms.uCamPos.value as THREE.Vector3;
  const update = (f: number) => {
    uT.value = f / LOOP;
    // fixed, close, with a slight closed drift
    camera.position.set(0.18 * osc(f, 1), 0.12 * osc(f, 1, 0.25), 8.2 + 0.1 * osc(f, 2));
    camera.lookAt(0.05 * osc(f, 1, 0.1), 0, 0);
    camera.updateMatrixWorld();
    camPos.copy(camera.position);
  };

  return { scene, camera, post, update };
}
