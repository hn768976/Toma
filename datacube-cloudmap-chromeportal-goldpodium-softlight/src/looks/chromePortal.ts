import {
  MultiplyBlending,
  PlaneGeometry,
  ShaderMaterial,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { lin } from "../lib/color";
import { PostPipeline } from "../lib/post";
import { TAU } from "../lib/random";
import { envDome, envFromScene } from "../lib/three-helpers";
import type { Look } from "../lib/ThreeLook";

export interface ChromePortalParams {
  metal: string;
  roughness: number;
  bg: string;
  env: string;
  bar: string;
}

const LOOP = 600;

/**
 * Ring geometry: a torus (major R, minor r) whose surface is ridged by
 *   φ(u,v) = BANDS·u + K·v (+ a breathing term periodic in v)
 * so the ridges are BANDS parallel rounded bands that spiral round the tube.
 * Shifting u by 2π/BANDS maps the pattern onto itself, so turning the ring
 * by exactly one band spacing per loop is seamless.
 */
const BANDS = 52;
const K = 16;
const SQUARE = 5.0; // superellipse exponent of the tube cross-section (rounded square)
const R_MAJOR = 1.76;
const R_MINOR = 0.66; // inner edge ≈ 0.82–0.94 (≈ 42–47% of frame height at z=0, as the reference)
const RIB_H = 0.11;
const SEG_U = 1440;
const V0 = 0;
const V1 = Math.PI * 2;
const SEG_V = 420;

const buildGrid = () => {
  const g = new BufferGeometry();
  const nu = SEG_U + 1;
  const nv = SEG_V + 1;
  const pos = new Float32Array(nu * nv * 3);
  const uv = new Float32Array(nu * nv * 2);
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const k = j * nu + i;
      uv[k * 2] = (i / SEG_U) * TAU;
      uv[k * 2 + 1] = V0 + (j / SEG_V) * (V1 - V0);
    }
  }
  const idx = new Uint32Array(SEG_U * SEG_V * 6);
  let o = 0;
  for (let j = 0; j < SEG_V; j++) {
    for (let i = 0; i < SEG_U; i++) {
      const a = j * nu + i;
      const b = a + 1;
      const c = a + nu;
      const d = c + 1;
      idx[o++] = a;
      idx[o++] = b;
      idx[o++] = d;
      idx[o++] = a;
      idx[o++] = d;
      idx[o++] = c;
    }
  }
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  g.setIndex(new BufferAttribute(idx, 1));
  return g;
};

const COMMON = /* glsl */ `
uniform float uRot;      // ring turn, radians
uniform float uBreath;   // twist breathing, ±0.08
uniform float uPx;       // output scale (height / 720)
uniform float uTwistB;   // breathing of the cross-section twist, ±0.08
const float BANDS = ${BANDS.toFixed(1)};
const float KTW = ${K.toFixed(1)};
const float RMAJ = ${R_MAJOR.toFixed(4)};
const float RMIN = ${R_MINOR.toFixed(4)};
const float RIBH = ${RIB_H.toFixed(4)};
const float SQN = ${SQUARE.toFixed(2)};

// rounded band cross-section (superellipse); x in [0,1), eps limits slope
float ribD(float x, float eps) {
  float y = min(abs(2.0 * x - 1.0), 1.0 - eps);
  return pow(1.0 - pow(y, 6.0), 1.0 / 6.0);
}
float ribDD(float x, float eps) {
  float s = sign(2.0 * x - 1.0);
  float y = min(abs(2.0 * x - 1.0), 1.0 - eps);
  float a = 1.0 - pow(y, 6.0);
  return -pow(a, 1.0 / 6.0 - 1.0) * pow(y, 5.0) * 2.0 * s;
}
`;

const createMaterial = (p: ChromePortalParams) => {
  const mat = new MeshPhysicalMaterial({
    color: new Color(...lin(p.metal)),
    metalness: 1,
    roughness: p.roughness,
    envMapIntensity: 1,
  });
  const uniforms = {
    uRot: { value: 0 },
    uBreath: { value: 0 },
    uPx: { value: 1 },
    uTwistB: { value: 0 },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        ${COMMON}
        varying float vPhi;
        varying float vPhiV;
        varying vec3 vTu;
        varying vec3 vTv;
        varying vec3 vNv;
        // rounded-square cross-section, rotated once around the ring (+ breathing)
        vec3 ringP(float u, float v) {
          float c = cos(v), s = sin(v);
          vec2 q = RMIN * vec2(sign(c) * pow(abs(c), 2.0 / SQN), sign(s) * pow(abs(s), 2.0 / SQN));
          float a = u + uTwistB * sin(u * 2.0);
          q = mat2(cos(a), sin(a), -sin(a), cos(a)) * q;
          return vec3((RMAJ + q.x) * cos(u), (RMAJ + q.x) * sin(u), q.y);
        }`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `float tu = uv.x;
        float tv = uv.y;
        const float E = 1e-3;
        vec3 P0 = ringP(tu, tv);
        vec3 Pu = (ringP(tu + E, tv) - ringP(tu - E, tv)) / (2.0 * E);
        vec3 Pv = (ringP(tu, tv + E) - ringP(tu, tv - E)) / (2.0 * E);
        vec3 baseN = normalize(cross(Pu, Pv));
        vec3 objectNormal = baseN;
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(1.0, 0.0, 0.0);
        #endif`,
      )
      .replace(
        "#include <begin_vertex>",
        `// bands slide round the ring: one band spacing per loop (uRot = 2π·t/BANDS)
        float phi = BANDS * (uv.x - uRot) + KTW * tv + uBreath * KTW * 0.5 * sin(2.0 * tv);
        vPhi = phi;
        vPhiV = KTW + uBreath * KTW * cos(2.0 * tv);
        // geometry carries only part of the relief (silhouette); the full relief is in the per-pixel normal.
        // Full-height facets on diagonal bands self-occlude in a staircase that shows as dashes.
        float dsp = 0.5 * RIBH * ribD(fract(phi / PI2), 0.12);
        vec3 transformed = P0 + baseN * dsp;
        mat3 mv3 = mat3(modelViewMatrix);
        vTu = mv3 * Pu;
        vTv = mv3 * Pv;
        vNv = normalize(mv3 * baseN);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        ${COMMON}
        varying float vPhi;
        varying float vPhiV;
        varying vec3 vTu;
        varying vec3 vTv;
        varying vec3 vNv;`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        {
          float x = fract(vPhi / PI2);
          // slope limit grows with the pixel footprint → no shimmer on the ridges
          float eps = clamp(fwidth(vPhi / PI2) * 2.5, 0.12, 0.6);
          float dd = RIBH * ribDD(x, eps) / PI2;      // d(disp)/dφ
          vec3 nb = normalize(vNv);
          vec3 pu = vTu + nb * dd * BANDS;
          vec3 pv = vTv + nb * dd * vPhiV;
          normal = normalize(cross(pu, pv));
          // ambient occlusion in the grooves
          float occ = mix(0.15, 1.0, smoothstep(0.0, 0.85, ribD(x, 0.12)));
          vGrooveOcc = occ;
        }`,
      )
      .replace("#include <normal_fragment_begin>", "float vGrooveOcc = 1.0;\n#include <normal_fragment_begin>")
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
        reflectedLight.indirectSpecular *= vGrooveOcc;
        reflectedLight.indirectDiffuse *= vGrooveOcc;`,
      );
  };
  return { mat, uniforms };
};

export const createChromePortal = (p: ChromePortalParams) => (renderer: WebGLRenderer): Look => {
  const scene = new Scene();
  scene.background = new Color(...lin(p.bg));
  const camera = new PerspectiveCamera(30, 16 / 9, 0.1, 50);
  const post = new PostPipeline({
    tonemap: "none",
    exposure: 1,
    bloomStrength: 0.25,
    bloomThreshold: 1.0,
    bloomKnee: 0.3,
    bloomRadius: 0.8,
    vignette: 0.16,
    vignetteStart: 0.35,
    grain: 0.015,
    grainPeriod: LOOP,
    blueNoise: true,
    msaa: 4,
  });

  // procedural white studio with grey bars
  const envScene = new Scene();
  const envTint = new Color(...lin(p.env));
  const bar = new Color(...lin(p.bar));
  envScene.add(
    envDome(
      `
      float el = d.y;
      float az = atan(d.x, d.z);
      // bright studio, darker floor
      float base = mix(0.3, 0.85, smoothstep(-0.5, 0.45, el));
      col = uTint * base;
      // grey bars — broad and soft (thin bars alias into dashed reflections on the tight ridges)
      float vb = 0.0;
      vb += 1.0 - smoothstep(0.06, 0.32, abs(az - 0.55));
      vb += 1.0 - smoothstep(0.05, 0.28, abs(az + 0.9));
      vb += 1.0 - smoothstep(0.10, 0.40, abs(az - 2.3));
      vb += 1.0 - smoothstep(0.06, 0.30, abs(az + 2.5));
      float hb = 0.0;
      hb += 1.0 - smoothstep(0.04, 0.22, abs(el - 0.18));
      hb += 1.0 - smoothstep(0.06, 0.26, abs(el + 0.32));
      hb += 1.0 - smoothstep(0.04, 0.18, abs(el - 0.66));
      col = mix(col, uBar * 0.75, clamp(vb + hb, 0.0, 1.0) * 0.6);
      // two bright softboxes
      col += uTint * 1.5 * (1.0 - smoothstep(0.12, 0.34, length(vec2(az + 0.15, el - 0.42))));
      col += uTint * 1.0 * (1.0 - smoothstep(0.06, 0.26, length(vec2((az - 1.6) * 0.5, el - 0.05))));
      `,
      { uTint: { value: envTint }, uBar: { value: bar } },
    ),
  );
  const env = envFromScene(renderer, envScene);
  scene.environment = env;

  const { mat, uniforms } = createMaterial(p);
  const ring = new Mesh(buildGrid(), mat);
  ring.frustumCulled = false;
  scene.add(ring);
  // soft occlusion where the ring meets the backdrop (multiplied into the background)
  const shadow = new Mesh(
    new PlaneGeometry(12, 12),
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: MultiplyBlending,
      premultipliedAlpha: true,
      uniforms: {},
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vP; void main(){
        float r = length(vP);
        float inner = ${(R_MAJOR - R_MINOR).toFixed(3)};
        float sh = 0.16 * exp(-pow(max(inner - r, 0.0) / 0.22, 2.0)) * smoothstep(inner - 0.6, inner - 0.05, r);
        gl_FragColor = vec4(vec3(1.0 - sh), 1.0);
      }`,
    }),
  );
  shadow.position.z = -R_MINOR - 0.05;
  shadow.renderOrder = -1;
  ring.add(shadow);

  const update = (frame: number) => {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const t = f / LOOP;
    uniforms.uRot.value = (TAU / BANDS) * t; // exactly one band spacing per loop
    uniforms.uBreath.value = 0.08 * Math.sin(TAU * t); // ±8 %, one whole cycle
    uniforms.uTwistB.value = 0.08 * Math.sin(TAU * t + 1.1);
    // slight tilt for depth; closed drift of tilt and camera
    ring.rotation.set(0.1 + 0.03 * Math.sin(TAU * t + 0.6), -0.12 + 0.03 * Math.cos(TAU * t), 0);
    const D = 1 / Math.tan((15 * Math.PI) / 180) * 1.0;
    camera.position.set(0.1 + 0.05 * Math.sin(TAU * t), -0.04 + 0.035 * Math.sin(TAU * t + 1.3), D);
    camera.lookAt(0.15, 0.04, 0);
  };

  return {
    render(gl, frame, w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      uniforms.uPx.value = h / 720;
      update(frame);
      post.renderScene(gl, scene, camera, w, h);
      post.finish(gl, frame);
    },
    dispose() {
      post.dispose();
      env.dispose();
    },
  };
};
