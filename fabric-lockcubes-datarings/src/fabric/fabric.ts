import * as THREE from "three";
import { phase, TAU } from "../lib/constants";
import { SIMPLEX4D } from "../lib/glsl";
import { PostPipeline } from "../lib/post";
import type { Look } from "../lib/Stage";

export type FabricPalette = {
  lit: string; // facing the camera
  foldA: string; // first turning-away colour
  foldB: string; // second turning-away colour
  trough: string; // deep troughs
  background: string;
  /** Tint of the soft sheen. */
  sheen: string;
};

export type FabricParams = {
  palette: FabricPalette;
  /** Global seed offset into the noise so colourways can differ slightly. */
  seed: number;
};

const SEG_X = 1024;
const SEG_Z = 576;
const PLANE_W = 30;
const PLANE_D = 26;

const VERT = /* glsl */ `
precision highp float;
in vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 ct;      // time on the unit circle
uniform float roll;   // 0..TAU over the loop
uniform float seed;
out vec3 vPos;
out vec3 vNormal;
out float vViewZ;
out float vH;
out float vCrest;
${SIMPLEX4D}

const vec2 ACROSS = vec2(0.5, 0.866); // across the folds (unit)
const float K = 2.6180;               // 2*pi / 2.4 world units

float heightAt(vec2 p, out float crest) {
  vec4 tc = vec4(ct * 0.45, 0.0, 0.0);
  float warp = snoise(vec4(p * 0.055 + seed, tc.xy)) * 2.4
             + snoise(vec4(p * 0.11 + 17.0 + seed, ct * 0.3)) * 0.8;
  float u = dot(p, ACROSS) + warp;
  // Amplitude varies along each ridge so folds swell and fade.
  float amp = 0.78 + 0.3 * snoise(vec4(p * vec2(0.05, 0.07) + 31.0 + seed, ct * 0.35));
  float s = u * K - roll;
  // Skewed sine: rounded crests leaning one way, like draped satin.
  float r = sin(s + 0.45 * sin(s));
  crest = r;
  float h = amp * 0.62 * r;
  // Slow large swell.
  h += 0.45 * snoise(vec4(p * 0.035 + 53.0 + seed, ct * 0.25));
  // Fine ripples near the crests.
  h += 0.06 * smoothstep(0.2, 1.0, r) * snoise(vec4(p * 0.55 + 71.0, ct * 0.6));
  return h;
}

void main() {
  vec2 p = position.xz;
  float c0, c1, c2;
  float h = heightAt(p, c0);
  const float e = 0.03;
  float hx = heightAt(p + vec2(e, 0.0), c1);
  float hz = heightAt(p + vec2(0.0, e), c2);
  vec3 n = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
  vec3 pos = vec3(p.x, h, p.y);
  vPos = pos;
  vNormal = n;
  vH = h;
  vCrest = c0;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
in vec3 vPos;
in vec3 vNormal;
in float vViewZ;
in float vH;
in float vCrest;
out vec4 outColor;
uniform vec3 camPos;
uniform vec3 camRight;
uniform vec3 camUp;
uniform vec3 cLit;
uniform vec3 cFoldA;
uniform vec3 cFoldB;
uniform vec3 cTrough;
uniform vec3 cSheen;

const vec2 ACROSS = vec2(0.5, 0.866);

vec3 ramp(float q) {
  // lit -> foldA -> foldB -> trough
  vec3 c = mix(cLit, cFoldA, smoothstep(0.12, 0.4, q));
  c = mix(c, cFoldB, smoothstep(0.32, 0.7, q));
  c = mix(c, cTrough, smoothstep(0.68, 1.0, q));
  return c;
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(camPos - vPos);
  float f = clamp(dot(N, V), 0.0, 1.0);
  // Key: soft, large, from the upper left (camera space -> world here).
  vec3 L = normalize(vec3(-0.55, 0.75, 0.35));
  // Cool fill from the right.
  vec3 L2 = normalize(vec3(0.8, 0.35, -0.2));
  float key = clamp((dot(N, L) + 0.35) / 1.35, 0.0, 1.0);
  float fill = clamp((dot(N, L2) + 0.2) / 1.2, 0.0, 1.0);
  // Iridescence: a hue coordinate from the surface's sideways facing plus the
  // view direction across the frame (thin-film colour shifts with angle).
  // Negative -> foldA (cyan), positive -> foldB (violet); facing crests stay
  // pale; troughs, the lower frame and surfaces turning away sink to the deep colour.
  vec3 dir = normalize(vPos - camPos);
  float vx = dot(dir, camRight);
  float vy = dot(dir, camUp);
  float sx = dot(N, camRight);
  float fl = clamp(V.y, 0.05, 1.0);
  float trough = smoothstep(-0.1, -1.2, vH);
  float h = sx * 1.5 + vx * 1.6 - 0.1;
  float d = trough * 1.0 + max(fl - f, 0.0) * 1.0 - vy * 1.9 + abs(h) * 0.25 - key * 0.25 - 0.05;
  vec3 sideA = mix(cLit, cFoldA, smoothstep(0.05, 0.38, -h));
  vec3 sideB = mix(cLit, cFoldB, smoothstep(0.28, 0.75, h));
  vec3 base = mix(sideA, sideB, smoothstep(-0.05, 0.05, h));
  base = mix(base, cTrough, smoothstep(0.3, 0.95, d));
  vec3 col = base * (0.42 + 0.7 * key) + cFoldA * fill * 0.18 * (1.0 - trough);
  // Wide anisotropic sheen along the folds (Kajiya-Kay).
  vec3 T = normalize(cross(N, vec3(ACROSS.x, 0.0, ACROSS.y)));
  vec3 H = normalize(L + V);
  float th = dot(T, H);
  float sheen = pow(max(1.0 - th * th, 0.0), 10.0);
  col += cSheen * sheen * 0.25 * key;
  // Soft broad specular lift on the lit crests.
  col += cSheen * pow(max(dot(N, H), 0.0), 18.0) * 0.45;
  outColor = vec4(col, vViewZ);
}
`;

const lin = (hex: string) => new THREE.Color(hex); // THREE.Color parses sRGB hex into linear

export const createFabric = (params: FabricParams) => (gl: THREE.WebGLRenderer): Look => {
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 16 / 9, 0.5, 80);
  const geo = new THREE.PlaneGeometry(PLANE_W, PLANE_D, SEG_X, SEG_Z);
  geo.rotateX(-Math.PI / 2);
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  const pal = params.palette;
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      ct: { value: new THREE.Vector2() },
      roll: { value: 0 },
      seed: { value: params.seed },
      camPos: { value: new THREE.Vector3() },
      camRight: { value: new THREE.Vector3() },
      camUp: { value: new THREE.Vector3() },
      cLit: { value: lin(pal.lit) },
      cFoldA: { value: lin(pal.foldA) },
      cFoldB: { value: lin(pal.foldB) },
      cTrough: { value: lin(pal.trough) },
      cSheen: { value: lin(pal.sheen) },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const post = new PostPipeline({ msaa: 0 });
  const bg = lin(pal.background);
  void gl;

  return {
    render(gl, frame, width, height) {
      const p = phase(frame);
      const t = p * TAU;
      post.setSize(width, height);
      mat.uniforms.ct.value.set(Math.cos(t), Math.sin(t));
      mat.uniforms.roll.value = t;
      // Close, low angle, very slow closed drift.
      cam.position.set(-0.8 + 0.5 * Math.cos(t), 2.6 + 0.15 * Math.sin(t), 4.4 + 0.3 * Math.sin(t));
      cam.lookAt(0.6 + 0.3 * Math.sin(t), -0.4, -1.2);
      cam.aspect = width / height;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      mat.uniforms.camPos.value.copy(cam.position);
      mat.uniforms.camRight.value.setFromMatrixColumn(cam.matrixWorld, 0);
      mat.uniforms.camUp.value.setFromMatrixColumn(cam.matrixWorld, 1);

      post.beginScene(gl, bg);
      gl.render(scene, cam);
      // Focus plane drifts across the middle third over one whole cycle.
      const focus = 5.6 + 1.0 * Math.sin(t + 0.6);
      const dof = post.dof(gl, cam, {
        enabled: true,
        focus,
        aperture: 0.3,
        maxCoc: 0.12,
        minCoc: 0.03,
        samples: 48,
      });
      post.finish(gl, dof, frame, {
        exposure: 1.0,
        tonemap: "soft",
        bloomStrength: 0.55,
        bloomThreshold: 0.75,
        bloomRadius: 0.8,
        vignette: 0,
        fringe: 0,
        grain: 0.01,
        dither: true,
        saturation: 1.12,
      });
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      post.dispose();
    },
  };
};
