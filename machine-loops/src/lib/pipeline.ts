// Render pipeline for the three.js compositions.
//
// The scene is drawn into a half-float, 4x MSAA render target in linear
// light. A final full-screen pass applies a per-channel tone curve that maps
// 0 -> 0 and 1 -> 1 exactly, encodes sRGB, and adds +-1/255 triangular dither
// from a static per-pixel hash. Pixels whose channels are all exactly 0 or 1
// (pure white, #00FF00, pure black) skip the curve's dither, so keying colours
// reach the screenshot untouched.
import * as THREE from "three";

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = () => /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform float exposure;
varying vec2 vUv;

// Filmic shoulder: identity up to K, then 1-(1-t)^3 up to WHITE, which maps
// to exactly 1.0 (everything above clips). Slope is continuous at K.
float curve(float x) {
  const float K = 0.7;
  const float W = ${WHITE.toFixed(3)};
  x = max(x, 0.0);
  if (x <= K) return x;
  if (x >= W) return 1.0;
  float t = (x - K) / (W - K);
  return K + (1.0 - K) * (1.0 - pow(1.0 - t, 3.0));
}
float srgb(float c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
bool isPure(float c) { return c <= 0.0 || c >= 1.0; }
void main() {
  vec3 lin = texture2D(tScene, vUv).rgb;
  vec3 c = vec3(curve(lin.r * exposure), curve(lin.g * exposure), curve(lin.b * exposure));
  vec3 s = vec3(srgb(c.r), srgb(c.g), srgb(c.b));
  if (!(isPure(c.r) && isPure(c.g) && isPure(c.b))) {
    float n = hash(gl_FragCoord.xy) + hash(gl_FragCoord.xy + 17.17) - 1.0; // triangular, -1..1
    s += n / 255.0;
  }
  gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}
`;

// Linear level that the tone curve maps to exactly 1.0. Use it (not 1.0)
// for background and screen colours so they come out as pure 255.
export const WHITE = 1.6;
export const linearKey = (r: number, g: number, b: number) =>
  new THREE.Color(r * WHITE, g * WHITE, b * WHITE);

const PATCHED = Symbol("machineLoopsPipeline");

export const installPipeline = (gl: THREE.WebGLRenderer, exposure = 1) => {
  const anyGl = gl as unknown as Record<symbol, boolean>;
  if (anyGl[PATCHED]) return;
  anyGl[PATCHED] = true;
  gl.toneMapping = THREE.NoToneMapping;
  gl.outputColorSpace = THREE.LinearSRGBColorSpace;
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;

  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag(),
    uniforms: { tScene: { value: null }, exposure: { value: exposure } },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  postScene.add(quad);

  let rt: THREE.WebGLRenderTarget | null = null;
  const size = new THREE.Vector2();
  const original = gl.render.bind(gl);
  gl.render = (scene: THREE.Object3D, camera: THREE.Camera) => {
    gl.getDrawingBufferSize(size);
    if (!rt || rt.width !== size.x || rt.height !== size.y) {
      rt?.dispose();
      rt = new THREE.WebGLRenderTarget(size.x, size.y, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        samples: 4,
        colorSpace: THREE.LinearSRGBColorSpace,
        depthBuffer: true,
      });
    }
    gl.setRenderTarget(rt);
    original(scene, camera);
    gl.setRenderTarget(null);
    mat.uniforms.tScene.value = rt.texture;
    original(postScene, postCam);
  };
};

// Inverse of the tone curve, so a colour fed through the pipeline comes out
// as the sRGB value it was written as (used for flat toon colours).
export const invCurve = (y: number) => {
  const K = 0.7;
  if (y <= K) return y;
  if (y >= 1) return WHITE;
  const t = 1 - Math.cbrt(1 - (y - K) / (1 - K));
  return K + (WHITE - K) * t;
};
export const paletteLinear = (hex: string) => {
  const c = new THREE.Color(hex); // sRGB hex -> linear working space
  return new THREE.Color(invCurve(c.r), invCurve(c.g), invCurve(c.b));
};
