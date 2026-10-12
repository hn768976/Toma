import * as THREE from "three";

// Shared final pass for the three.js looks:
// HDR scene (MSAA, half float) -> gentle gather depth of field -> ACES ->
// sRGB -> vignette -> grain + dither. Grain and dither are a fixed hash of
// pixel position and (frame % 600), so every frame is reproducible on its own.

export type PostSettings = {
  focusDist: number; // view-space distance in focus
  focusDead: number; // +/- range that stays fully sharp
  focusRange: number; // distance over which blur ramps to max
  maxBlur: number; // max circle of confusion as a fraction of frame height
  exposure: number;
  vignette: number;
  grain: number; // amplitude, 0.015 = 1.5 %
  blackCut: number; // 1 = fade grain + dither to zero near black (clean black)
  bloom?: number; // strength of the soft halo around bright areas
  bloomRadius?: number; // fraction of frame height
  bloomThreshold?: number;
};

const vertex = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const TAPS = 40;

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear, uFar, uFocus, uDead, uRange, uMaxBlur;
uniform float uFrame, uExposure, uVignette, uGrain, uBlackCut;
uniform float uBloom, uBloomR, uBloomT;
in vec2 vUv;
out vec4 outColor;

float linDepth(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
float cocOf(float ld) {
  return clamp((abs(ld - uFocus) - uDead) / uRange, 0.0, 1.0) * uMaxBlur;
}
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p, float f) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031 + f * 0.0137);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 px = 1.0 / uRes;
  float cDepth = linDepth(texture(tDepth, vUv).r);
  float cCoc = cocOf(cDepth);
  vec3 acc = texture(tColor, vUv).rgb;
  float wsum = 1.0;
  if (uMaxBlur > 0.5) {
    for (int i = 0; i < ${TAPS}; i++) {
      float fi = float(i);
      float r = sqrt((fi + 0.5) / ${TAPS}.0) * uMaxBlur;
      float a = fi * 2.39996323;
      vec2 o = vec2(cos(a), sin(a)) * r;
      vec2 uv = vUv + o * px;
      float tDepthL = linDepth(texture(tDepth, uv).r);
      float tCoc = cocOf(tDepthL);
      // Background taps may not blur over a sharper foreground pixel.
      float eff = tDepthL > cDepth ? min(tCoc, cCoc) : tCoc;
      float w = clamp(eff - r + 1.0, 0.0, 1.0);
      acc += texture(tColor, uv).rgb * w;
      wsum += w;
    }
  }
  vec3 col = acc / wsum;
  // bloom: fixed golden-angle gather of the bright pass (no state, no mips)
  if (uBloom > 0.0) {
    vec3 b = vec3(0.0);
    for (int i = 0; i < 32; i++) {
      float fi = float(i);
      float r = sqrt((fi + 0.5) / 32.0) * uBloomR;
      float a = fi * 2.39996323 + 0.7;
      vec3 c = texture(tColor, vUv + vec2(cos(a), sin(a)) * r * px).rgb;
      b += max(c - uBloomT, 0.0) * (1.0 - 0.6 * (r / uBloomR));
    }
    col += uBloom * b / 32.0;
  }
  col = aces(col * uExposure);
  col = toSRGB(col);
  vec2 q = vUv - 0.5;
  q.x *= uRes.x / uRes.y;
  col *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(q));

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float f = mod(uFrame, 600.0);
  vec2 p = gl_FragCoord.xy;
  float g = (hash(p, f) - 0.5) * 2.0 * uGrain;
  float dith = (hash(p + 17.0, f) + hash(p + 59.0, f + 3.0) - 1.0) / 255.0;
  float gFade = mix(1.0, smoothstep(0.012, 0.03, luma), uBlackCut);
  float dFade = mix(1.0, smoothstep(0.0, 0.006, luma), uBlackCut);
  col += g * gFade * (0.35 + luma) + dith * dFade;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class PostPipeline {
  rt: THREE.WebGLRenderTarget;
  material: THREE.RawShaderMaterial;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(width: number, height: number) {
    const depthTexture = new THREE.DepthTexture(width, height);
    depthTexture.type = THREE.FloatType;
    this.rt = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: 4,
      depthTexture,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: vertex,
      fragmentShader: fragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.rt.texture },
        tDepth: { value: depthTexture },
        uRes: { value: new THREE.Vector2(width, height) },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uFocus: { value: 5 },
        uDead: { value: 0.5 },
        uRange: { value: 3 },
        uMaxBlur: { value: 0 },
        uFrame: { value: 0 },
        uExposure: { value: 1 },
        uVignette: { value: 0.3 },
        uGrain: { value: 0.015 },
        uBlackCut: { value: 0 },
        uBloom: { value: 0 },
        uBloomR: { value: 1 },
        uBloomT: { value: 1 },
      },
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    const tri = new THREE.Mesh(geo, this.material);
    tri.frustumCulled = false;
    this.scene.add(tri);
  }

  render(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    frame: number,
    s: PostSettings,
  ) {
    const u = this.material.uniforms;
    const h = this.rt.height;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uFocus.value = s.focusDist;
    u.uDead.value = s.focusDead;
    u.uRange.value = s.focusRange;
    u.uMaxBlur.value = s.maxBlur * h;
    u.uFrame.value = frame;
    u.uExposure.value = s.exposure;
    u.uVignette.value = s.vignette;
    u.uGrain.value = s.grain;
    u.uBlackCut.value = s.blackCut;
    u.uBloom.value = s.bloom ?? 0;
    u.uBloomR.value = (s.bloomRadius ?? 0.02) * h;
    u.uBloomT.value = s.bloomThreshold ?? 0.6;

    gl.setRenderTarget(this.rt);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, true, true);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.clear(true, true, true);
    gl.render(this.scene, this.camera);
  }

  dispose() {
    this.rt.depthTexture?.dispose();
    this.rt.dispose();
    this.material.dispose();
  }
}
