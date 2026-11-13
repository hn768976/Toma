import * as THREE from "three";
import type { GLSceneFactory } from "../gl/GLCanvas";
import { PostPipeline, type PostSettings } from "../gl/post";

const FAR = 400;
/** Side length of the square region (world units, centred on the origin) covered by the baked height map. */
const BAKE_EXTENT = 16;
const BAKE_SIZE = 2048;
const PLANE_SIZE = 44;
const PLANE_SEGMENTS = 900;
export const SPOT_COUNT = 6;

const NOISE = /* glsl */ `
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  return vnoise(p) * 0.55 + vnoise(p * 2.03 + 7.1) * 0.3 + vnoise(p * 4.1 + 3.7) * 0.15;
}
// distance to the nearest feature point (cellular noise)
float worley(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(i + g);
      vec2 r = g + o - f;
      d = min(d, dot(r, r));
    }
  }
  return sqrt(d);
}`;

const FS_VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/**
 * Bakes the animated wheal relief into a texture once per frame:
 *   R = height, GB = dh/dx, dh/dz, A = redness.
 */
const BAKE_FRAG = /* glsl */ `
precision highp float;
uniform vec4 uSpots[${SPOT_COUNT}];   // x, z, radius, growth 0..1
uniform float uExtent;
in vec2 vUv;
out vec4 o;
${NOISE}

// returns (height, redness)
vec2 relief(vec2 p) {
  float h = 0.0;
  float red = 0.0;
  float edgeNoise = fbm(p * 1.9 + 11.0) - 0.5;
  float fine = fbm(p * 5.5 + 3.0) - 0.5;
  float cells = worley(p * 1.9 + 5.0);
  float cells2 = worley(p * 3.9 + 1.7);
  // rounded, bubbly lumps separated by creases
  float lumps = (1.0 - smoothstep(0.0, 0.85, cells)) * 0.75 + (1.0 - smoothstep(0.0, 0.8, cells2)) * 0.25;
  for (int i = 0; i < ${SPOT_COUNT}; i++) {
    vec4 s = uSpots[i];
    float g = s.w;
    if (g <= 0.0) continue;
    float grow = 1.0 - (1.0 - g) * (1.0 - g);          // ease-out size
    float lump = smoothstep(0.38, 1.0, g);             // late: surface breaks into lumps
    float rad = s.z * mix(0.3, 1.0, grow);
    vec2 q = p - s.xy;
    float d = length(q) / rad;
    d *= 1.0 + (edgeNoise * 0.34 + fine * 0.05) * mix(0.35, 1.0, lump);
    float dome = pow(clamp(1.0 - d * d, 0.0, 1.0), 1.4);
    float plateau = smoothstep(1.0, 0.66, d);
    float prof = mix(dome, plateau * (0.86 + 0.14 * dome), lump);
    float height = s.z * 0.215 * smoothstep(0.0, 0.5, g) * mix(0.75, 1.0, grow);
    float surf = 1.0 + lump * ((lumps - 0.45) * 0.6 + fine * 0.1);
    h = max(h, height * prof * surf);
    float halo = smoothstep(1.3, 0.55, d);
    red = max(red, halo * smoothstep(0.0, 0.3, g) * (0.82 + 0.18 * lumps * lump));
  }
  return vec2(h, red);
}

void main() {
  vec2 p = (vUv - 0.5) * uExtent;
  float e = uExtent / ${BAKE_SIZE}.0;
  vec2 c = relief(p);
  float hx = relief(p + vec2(e, 0.0)).x;
  float hz = relief(p + vec2(0.0, e)).x;
  o = vec4(c.x, (hx - c.x) / e, (hz - c.x) / e, c.y);
}`;

const SKIN_VERT = /* glsl */ `
in vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform sampler2D tBake;
uniform float uExtent;
uniform float uRelief; // 1 = displaced detail mesh, 0 = flat far-field skirt
out vec3 vWorld;
out vec3 vView;
void main() {
  vec2 uv = position.xz / uExtent + 0.5;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float h = textureLod(tBake, clamp(uv, 0.0, 1.0), 0.0).r * inside;
  vec3 p = vec3(position.x, h * uRelief - (1.0 - uRelief) * 0.004, position.z);
  vWorld = p;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const SKIN_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tBake;
uniform float uExtent;
uniform float uFar;
uniform vec3 uCamPos;
uniform vec3 uLightDir;
uniform vec3 uSkin;
uniform vec3 uRed;
uniform vec3 uDeep;
uniform vec3 uFog;
uniform float uFogDensity;
in vec3 vWorld;
in vec3 vView;
out vec4 o;
${NOISE}

vec4 bake(vec2 p) {
  vec2 uv = p / uExtent + 0.5;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  return texture(tBake, clamp(uv, 0.0, 1.0)) * inside;
}

// fine skin relief: a slightly irregular lattice of tiny plates and pores
float micro(vec2 p) {
  float w = worley(p * 11.0);
  float w2 = worley(p * 27.0 + 9.0);
  return (1.0 - smoothstep(0.0, 0.7, w)) * 0.7 + (1.0 - w2) * 0.3;
}

void main() {
  vec2 p = vWorld.xz;
  vec4 b = bake(p);
  float h = b.r;
  float red = b.a;

  // distance based fade of the micro detail to avoid shimmer far away
  float dist = length(vView);
  float detail = smoothstep(26.0, 7.0, dist);
  float e = 0.012;
  float m0 = micro(p);
  float mx = micro(p + vec2(e, 0.0));
  float mz = micro(p + vec2(0.0, e));
  vec2 mslope = vec2(mx - m0, mz - m0) / e * 0.0042 * detail;

  vec3 N = normalize(vec3(-b.g - mslope.x, 1.0, -b.b - mslope.y));
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(uCamPos - vWorld);

  // soft shadow: march the baked height field towards the light
  vec2 ldir = normalize(L.xz);
  float slope = L.y / length(L.xz);
  float occ = 0.0;
  for (int i = 1; i <= 12; i++) {
    float t = 0.09 * float(i) * (1.0 + 0.09 * float(i));
    float hs = bake(p + ldir * t).r;
    occ = max(occ, (hs - (h + slope * t)) / (0.1 + 0.22 * t));
  }
  float shadow = 1.0 - 0.6 * clamp(occ * 1.6, 0.0, 1.0);

  // ambient occlusion: how much higher is the neighbourhood than this point
  float around = bake(p + vec2(0.3, 0.0)).r + bake(p - vec2(0.3, 0.0)).r
               + bake(p + vec2(0.0, 0.3)).r + bake(p - vec2(0.0, 0.3)).r
               + bake(p + vec2(0.2, 0.2)).r + bake(p - vec2(0.2, 0.2)).r
               + bake(p + vec2(0.2, -0.2)).r + bake(p - vec2(0.2, -0.2)).r;
  float ao = 1.0 - 0.7 * clamp(around / 8.0 - h, 0.0, 0.3);

  float ndl = dot(N, L);
  float diff = clamp((ndl + 0.6) / 1.6, 0.0, 1.0);

  // albedo: pale skin, flushed halo, saturated red on the wheal itself
  vec3 albedo = mix(uSkin, uRed, smoothstep(0.0, 1.0, red) * 0.85);
  float speck = smoothstep(0.5, 0.85, m0) * detail;
  albedo = mix(albedo, albedo * 1.16 + 0.06, speck);
  albedo *= 0.985 + 0.03 * vnoise(p * 2.3);

  // subsurface feel: shadows and creases shift towards deep red instead of grey
  float lightAmt = diff * shadow;
  vec3 col = albedo * (0.5 + 0.66 * lightAmt) * ao;
  col = mix(col, col * uDeep * 1.6, (1.0 - lightAmt) * 0.14 + (1.0 - ao) * 0.4);

  // soft sheen
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 22.0) * 0.07 * shadow;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += vec3(1.0, 0.93, 0.9) * (spec + fres * 0.05);

  float fog = 1.0 - exp(-max(dist - 6.0, 0.0) * uFogDensity);
  col = mix(col, uFog, fog);
  o = vec4(col, clamp(-vView.z / uFar, 0.0, 1.0));
}`;

// Fine vellus hairs: tiny camera-facing blades standing on the relief.
const HAIR_VERT = /* glsl */ `
in vec3 position;      // x: side (-1..1), y: 0..1 along the hair
in vec4 aRoot;         // x, z, length, seed
in vec3 aDir;          // lean direction
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform sampler2D tBake;
uniform float uExtent;
uniform vec3 uCamPos;
out float vT;
out vec3 vView;
out float vSeed;
void main() {
  vec2 uv = aRoot.xy / uExtent + 0.5;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  vec4 b = textureLod(tBake, clamp(uv, 0.0, 1.0), 0.0) * inside;
  vec3 root = vec3(aRoot.x, b.r - 0.004, aRoot.y);
  vec3 n = normalize(vec3(-b.g, 1.0, -b.b));
  float t = position.y;
  // grows out along the surface normal, then bends over along its lean direction
  vec3 dir = normalize(n * 0.55 + aDir);
  float len = aRoot.z * (0.35 + 0.65 * smoothstep(0.05, 0.6, b.a));
  vec3 p = root + (dir * t + vec3(0.0, -0.22, 0.0) * t * t) * len;
  vec3 toCam = normalize(uCamPos - p);
  vec3 side = normalize(cross(dir, toCam));
  p += side * position.x * 0.0052 * (1.0 - 0.85 * t);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  vView = mv.xyz;
  vT = t;
  vSeed = aRoot.w;
  gl_Position = projectionMatrix * mv;
}`;

const HAIR_FRAG = /* glsl */ `
precision highp float;
uniform float uFar;
uniform vec3 uHair;
uniform vec3 uFog;
uniform float uFogDensity;
in float vT;
in vec3 vView;
in float vSeed;
out vec4 o;
void main() {
  float dist = length(vView);
  vec3 col = uHair * (0.82 + 0.3 * vT) * (0.9 + 0.2 * vSeed);
  float fog = 1.0 - exp(-max(dist - 6.0, 0.0) * uFogDensity);
  col = mix(col, uFog, fog);
  o = vec4(col, clamp(-vView.z / uFar, 0.0, 1.0));
}`;

export type SkinCamera = {
  /** Azimuth around the cluster in degrees (0 = reference view). */
  azimuth: [number, number];
  /** Elevation above the skin in degrees. */
  elevation: [number, number];
  distance: [number, number];
  target: [[number, number, number], [number, number, number]];
  fov: number;
};

/** Static camera that reproduces the framing of the reference. */
export const REFERENCE_CAMERA: SkinCamera = {
  azimuth: [0, 0],
  elevation: [30, 30],
  distance: [10.4, 10.4],
  target: [
    [0, 0, 0],
    [0, 0, 0],
  ],
  fov: 30,
};

/** Version 2: a slow, low orbiting push-in around the same cluster. */
export const ORBIT_CAMERA: SkinCamera = {
  azimuth: [-34, 26],
  elevation: [20, 27],
  distance: [10.6, 7.9],
  target: [
    [0.5, 0.0, -0.3],
    [0.6, 0.12, 0.25],
  ],
  fov: 30,
};

/** Where each wheal sits in the reference frame: [x, y] as 0..1 from the top-left, radius as a fraction of the width, first frame. */
const SPOT_LAYOUT: { x: number; y: number; r: number; start: number }[] = [
  { x: 0.625, y: 0.675, r: 0.14, start: 6 },
  { x: 0.67, y: 0.15, r: 0.112, start: 20 },
  { x: 0.795, y: 0.49, r: 0.13, start: 25 },
  { x: 0.215, y: 0.4, r: 0.125, start: 27 },
  { x: 0.54, y: 0.405, r: 0.125, start: 29 },
  { x: 0.38, y: 0.295, r: 0.105, start: 31 },
];
const GROW_FRAMES = 68;

const makeRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const placeCamera = (camera: THREE.PerspectiveCamera, cam: SkinCamera, p: number) => {
  const az = THREE.MathUtils.degToRad(lerp(cam.azimuth[0], cam.azimuth[1], p));
  const el = THREE.MathUtils.degToRad(lerp(cam.elevation[0], cam.elevation[1], p));
  const dist = lerp(cam.distance[0], cam.distance[1], p);
  const target = new THREE.Vector3(
    lerp(cam.target[0][0], cam.target[1][0], p),
    lerp(cam.target[0][1], cam.target[1][1], p),
    lerp(cam.target[0][2], cam.target[1][2], p),
  );
  camera.position.set(
    target.x + Math.sin(az) * Math.cos(el) * dist,
    target.y + Math.sin(el) * dist,
    target.z + Math.cos(az) * Math.cos(el) * dist,
  );
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return dist;
};

export const createSkinScene =
  (cam: SkinCamera, durationInFrames: number): GLSceneFactory =>
  (canvas, width, height) => {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x000000, 1);

    const post = new PostPipeline(renderer, width, height, FAR);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(cam.fov, width / height, 0.5, FAR);

    // ---- wheal positions: un-project the reference layout onto the skin plane ----
    const refCam = new THREE.PerspectiveCamera(REFERENCE_CAMERA.fov, 16 / 9, 0.5, FAR);
    placeCamera(refCam, REFERENCE_CAMERA, 0);
    const toPlane = (sx: number, sy: number) => {
      const v = new THREE.Vector3(sx * 2 - 1, 1 - sy * 2, 0.5).unproject(refCam);
      const dir = v.sub(refCam.position).normalize();
      const t = -refCam.position.y / dir.y;
      return refCam.position.clone().addScaledVector(dir, t);
    };
    const spots = SPOT_LAYOUT.map((s) => {
      const c = toPlane(s.x, s.y);
      const l = toPlane(s.x - s.r, s.y);
      const r = toPlane(s.x + s.r, s.y);
      return { x: c.x, z: c.z, radius: (l.distanceTo(r) / 2) * 1.16, start: s.start };
    });
    const spotUniform = spots.map((s) => new THREE.Vector4(s.x, s.z, s.radius, 0));

    // ---- bake pass ----
    const bakeTarget = new THREE.WebGLRenderTarget(BAKE_SIZE, BAKE_SIZE, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      generateMipmaps: false,
    });
    const bakeMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FS_VERT,
      fragmentShader: BAKE_FRAG,
      uniforms: { uSpots: { value: spotUniform }, uExtent: { value: BAKE_EXTENT } },
      depthTest: false,
      depthWrite: false,
    });
    const triGeo = new THREE.BufferGeometry();
    triGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    const bakeQuad = new THREE.Mesh(triGeo, bakeMaterial);
    bakeQuad.frustumCulled = false;
    const bakeScene = new THREE.Scene();
    bakeScene.add(bakeQuad);
    const bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // ---- skin surface ----
    const lin = (hex: number) => new THREE.Color().setHex(hex, THREE.SRGBColorSpace);
    const fogColor = lin(0xefb9b4);
    const shared = {
      tBake: { value: bakeTarget.texture },
      uExtent: { value: BAKE_EXTENT },
      uFar: { value: FAR },
      uCamPos: { value: new THREE.Vector3() },
      uFog: { value: fogColor },
      uFogDensity: { value: 0.022 },
    };
    const planeGeo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, PLANE_SEGMENTS, PLANE_SEGMENTS);
    planeGeo.rotateX(-Math.PI / 2);
    planeGeo.deleteAttribute("normal");
    planeGeo.deleteAttribute("uv");
    const skinMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SKIN_VERT,
      fragmentShader: SKIN_FRAG,
      uniforms: {
        ...shared,
        uLightDir: { value: new THREE.Vector3(0.62, 0.42, -0.66) },
        uSkin: { value: lin(0xeba6a1) },
        uRed: { value: lin(0xf07f7b) },
        uDeep: { value: lin(0xd9534f) },
        uRelief: { value: 1 },
      },
    });
    // Coarse far-field skirt so the skin always reaches the horizon haze.
    const skirtGeo = new THREE.PlaneGeometry(600, 600, 8, 8);
    skirtGeo.rotateX(-Math.PI / 2);
    skirtGeo.deleteAttribute("normal");
    skirtGeo.deleteAttribute("uv");
    const skirtMaterial = skinMaterial.clone();
    skirtMaterial.uniforms = { ...skinMaterial.uniforms, uRelief: { value: 0 } };
    const skirt = new THREE.Mesh(skirtGeo, skirtMaterial);
    skirt.frustumCulled = false;
    scene.add(skirt);
    const skin = new THREE.Mesh(planeGeo, skinMaterial);
    skin.frustumCulled = false;
    scene.add(skin);

    // ---- vellus hairs ----
    const rng = makeRng(77123);
    const HAIRS = 2400;
    const roots = new Float32Array(HAIRS * 4);
    const dirs = new Float32Array(HAIRS * 3);
    for (let i = 0; i < HAIRS; i++) {
      let x: number;
      let z: number;
      if (i % 4 !== 0) {
        // most hairs crowd the flanks of the wheals, pointing away from the centre
        const s = spots[Math.floor(rng() * spots.length)];
        const ang = rng() * Math.PI * 2;
        const rr = s.radius * (0.72 + rng() * 0.75);
        x = s.x + Math.cos(ang) * rr;
        z = s.z + Math.sin(ang) * rr;
        dirs[i * 3] = Math.cos(ang) * 0.5 + 0.45 + (rng() - 0.5) * 0.5;
        dirs[i * 3 + 1] = 0.25;
        dirs[i * 3 + 2] = Math.sin(ang) * 0.5 + 0.35 + (rng() - 0.5) * 0.5;
      } else {
        x = (rng() - 0.5) * 15;
        z = (rng() - 0.5) * 13;
        dirs[i * 3] = 0.55 + (rng() - 0.5) * 0.5;
        dirs[i * 3 + 1] = 0.2;
        dirs[i * 3 + 2] = 0.4 + (rng() - 0.5) * 0.5;
      }
      roots[i * 4] = x;
      roots[i * 4 + 1] = z;
      roots[i * 4 + 2] = 0.07 + rng() * 0.09;
      roots[i * 4 + 3] = rng();
    }
    const blade = new THREE.InstancedBufferGeometry();
    const SEG = 4;
    const bp: number[] = [];
    const bi: number[] = [];
    for (let i = 0; i <= SEG; i++) {
      bp.push(-1, i / SEG, 0, 1, i / SEG, 0);
      if (i < SEG) {
        const a = i * 2;
        bi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    blade.setAttribute("position", new THREE.Float32BufferAttribute(bp, 3));
    blade.setIndex(bi);
    blade.setAttribute("aRoot", new THREE.InstancedBufferAttribute(roots, 4));
    blade.setAttribute("aDir", new THREE.InstancedBufferAttribute(dirs, 3));
    blade.instanceCount = HAIRS;
    const hairMaterial = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: HAIR_VERT,
      fragmentShader: HAIR_FRAG,
      uniforms: { ...shared, uHair: { value: lin(0xf6c9c3) } },
      side: THREE.DoubleSide,
    });
    const hairs = new THREE.Mesh(blade, hairMaterial);
    hairs.frustumCulled = false;
    scene.add(hairs);

    const settings: PostSettings = {
      focus: 10.4,
      aperture: 0.024,
      maxCoc: 0.014,
      bloomThreshold: 10,
      bloomStrength: 0,
      bgInner: new THREE.Color(0, 0, 0),
      bgOuter: new THREE.Color(0, 0, 0),
      bgCenter: new THREE.Vector2(0.5, 0.5),
      vignette: 0.1,
      grain: 0.008,
      exposure: 1.0,
      filmic: 0,
      tint: new THREE.Color(1, 1, 1),
      saturation: 1.0,
    };

    const render = (frame: number) => {
      const p = smooth(Math.min(frame / Math.max(durationInFrames - 1, 1), 1));
      settings.focus = placeCamera(camera, cam, p);
      shared.uCamPos.value.copy(camera.position);

      spots.forEach((s, i) => {
        const g = Math.min(Math.max((frame - s.start) / GROW_FRAMES, 0), 1);
        // long ease-out so the relief settles gently instead of stopping dead
        spotUniform[i].w = 1 - Math.pow(1 - g, 2.2);
      });

      renderer.setRenderTarget(bakeTarget);
      renderer.render(bakeScene, bakeCam);
      renderer.setRenderTarget(post.sceneTarget);
      renderer.clear();
      renderer.render(scene, camera);
      post.render(settings, frame);
    };

    return {
      render,
      dispose: () => {
        bakeTarget.dispose();
        bakeMaterial.dispose();
        triGeo.dispose();
        planeGeo.dispose();
        skinMaterial.dispose();
        skirtGeo.dispose();
        skirtMaterial.dispose();
        blade.dispose();
        hairMaterial.dispose();
        post.dispose();
        renderer.dispose();
      },
    };
  };
