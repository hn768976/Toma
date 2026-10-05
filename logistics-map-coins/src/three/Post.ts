import * as THREE from 'three';

// Post pipeline shared by the three.js looks:
//   scene (HDR, 4x MSAA) -> depth of field -> bloom -> final pass
// The final pass does exposure, tone mapping, an optional screen-blended overlay
// texture, vignette, grain and +-1/255 dither, then writes sRGB to the canvas.
// No temporal effects: every pass depends only on the current frame's inputs.

export type ToneMap = 'none' | 'neutral' | 'aces';

export type PostParams = {
  // Depth of field. Blur (as a fraction of frame height) for a point at depth z
  // is aperture * |z - focus| / z, clamped to maxBlur.
  dof: boolean;
  focus: number;
  aperture: number;
  maxBlur: number;
  nearScale: number; // multiplier for points in front of the focus plane
  bloomStrength: number;
  bloomThreshold: number;
  bloomRadius: number; // 0..1, how much the wide mips contribute
  exposure: number;
  toneMap: ToneMap;
  // Vignette: darkening towards the edges and a vertical light falloff.
  vignette: number;
  topLight: number; // >0 brightens the top, <0 darkens it
  grain: number; // amplitude in display units (0.02 = 2%)
  overlay: THREE.Texture | null;
  overlayStrength: number;
  overlayMode: 0 | 1; // 0 = screen, 1 = screen + soft-light tint
  overlayProtect: number; // 0..1 reduce the screen blend over saturated pixels
  // Display-space colour tint multiplied in before the overlay (1,1,1 = none).
  tint: THREE.Color;
  saturation: number;
  grainFrame: number; // frame % 600
  // soft additive haze / flare in display space (uv position, colour * strength)
  haze: {x: number; y: number; radius: number; color: THREE.Color} | null;
};

export const defaultPostParams = (): PostParams => ({
  dof: true,
  focus: 10,
  aperture: 0.02,
  maxBlur: 0.012,
  nearScale: 1,
  bloomStrength: 0.6,
  bloomThreshold: 0.6,
  bloomRadius: 0.8,
  exposure: 1,
  toneMap: 'none',
  vignette: 0.3,
  topLight: 0,
  grain: 0.02,
  overlay: null,
  overlayStrength: 1,
  overlayMode: 0,
  overlayProtect: 0,
  tint: new THREE.Color(1, 1, 1),
  saturation: 1,
  grainFrame: 0,
  haze: null,
});

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMMON = /* glsl */ `
float viewZ(float d, float near, float far) {
  // perspective depth [0,1] -> positive view distance
  float ndc = d * 2.0 - 1.0;
  return (2.0 * near * far) / (far + near - ndc * (far - near));
}
`;

const pass = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

// --- DoF: half-res colour + CoC ------------------------------------------------
const COC_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 texel; // of the full-res source
uniform float near, far, focus, aperture, maxBlur, nearScale, heightPx;
varying vec2 vUv;
float cocPx(vec2 uv) {
  float z = viewZ(texture2D(tDepth, uv).r, near, far);
  float c = aperture * abs(z - focus) / z;
  if (z < focus) c *= nearScale;
  return min(c, maxBlur) * heightPx;
}
void main() {
  vec3 c = texture2D(tColor, vUv + texel * vec2(-0.5, -0.5)).rgb;
  c += texture2D(tColor, vUv + texel * vec2(0.5, -0.5)).rgb;
  c += texture2D(tColor, vUv + texel * vec2(-0.5, 0.5)).rgb;
  c += texture2D(tColor, vUv + texel * vec2(0.5, 0.5)).rgb;
  // Store depth too (for the gather's foreground test) in a packed way: CoC in
  // .a, colour in .rgb; depth goes to a second lookup in the gather pass.
  gl_FragColor = vec4(c * 0.25, cocPx(vUv));
}
`;

// Single-pass "scatter as gather" bokeh (after D. Gustafsson). Runs at half res;
// CoC values are in full-res pixels, so they are halved here.
const BOKEH_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D tHalf;
uniform sampler2D tDepth;
uniform vec2 texel; // half-res texel
uniform float near, far, maxRadius, radScale;
varying vec2 vUv;
const float GOLDEN = 2.39996323;
void main() {
  vec4 center = texture2D(tHalf, vUv);
  float centerDepth = viewZ(texture2D(tDepth, vUv).r, near, far);
  float centerSize = center.a * 0.5;
  vec3 color = center.rgb;
  float tot = 1.0;
  float radius = radScale;
  for (float ang = 0.0; ang < 600.0; ang += GOLDEN) {
    if (radius >= maxRadius) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * radius;
    vec4 s = texture2D(tHalf, tc);
    float sampleDepth = viewZ(texture2D(tDepth, tc).r, near, far);
    float sampleSize = s.a * 0.5;
    if (sampleDepth > centerDepth) sampleSize = clamp(sampleSize, 0.0, centerSize * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);
    color += mix(color / tot, s.rgb, m);
    tot += 1.0;
    radius += radScale / radius;
  }
  gl_FragColor = vec4(color / tot, center.a);
}
`;

const DOF_COMPOSITE_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D tColor;
uniform sampler2D tBlur;
uniform sampler2D tDepth;
uniform float near, far, focus, aperture, maxBlur, nearScale, heightPx;
varying vec2 vUv;
void main() {
  float z = viewZ(texture2D(tDepth, vUv).r, near, far);
  float c = aperture * abs(z - focus) / z;
  if (z < focus) c *= nearScale;
  c = min(c, maxBlur) * heightPx;
  vec4 blur = texture2D(tBlur, vUv);
  float m = smoothstep(0.8, 2.5, c);
  vec3 sharp = texture2D(tColor, vUv).rgb;
  gl_FragColor = vec4(mix(sharp, blur.rgb, m), 1.0);
}
`;

// --- Bloom ---------------------------------------------------------------------
const PREFILTER_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 texel;
uniform float threshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tColor, vUv + texel * vec2(-0.5, -0.5)).rgb;
  c += texture2D(tColor, vUv + texel * vec2(0.5, -0.5)).rgb;
  c += texture2D(tColor, vUv + texel * vec2(-0.5, 0.5)).rgb;
  c += texture2D(tColor, vUv + texel * vec2(0.5, 0.5)).rgb;
  c *= 0.25;
  float br = max(c.r, max(c.g, c.b));
  float knee = threshold * 0.5;
  float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float contrib = max(soft, br - threshold) / max(br, 1e-4);
  gl_FragColor = vec4(c * contrib, 1.0);
}
`;

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel; // source texel
varying vec2 vUv;
void main() {
  // 13-tap downsample (Jimenez 2014)
  vec3 a = texture2D(tSrc, vUv + texel * vec2(-2.0, 2.0)).rgb;
  vec3 b = texture2D(tSrc, vUv + texel * vec2(0.0, 2.0)).rgb;
  vec3 c = texture2D(tSrc, vUv + texel * vec2(2.0, 2.0)).rgb;
  vec3 d = texture2D(tSrc, vUv + texel * vec2(-2.0, 0.0)).rgb;
  vec3 e = texture2D(tSrc, vUv).rgb;
  vec3 f = texture2D(tSrc, vUv + texel * vec2(2.0, 0.0)).rgb;
  vec3 g = texture2D(tSrc, vUv + texel * vec2(-2.0, -2.0)).rgb;
  vec3 h = texture2D(tSrc, vUv + texel * vec2(0.0, -2.0)).rgb;
  vec3 i = texture2D(tSrc, vUv + texel * vec2(2.0, -2.0)).rgb;
  vec3 j = texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb;
  vec3 k = texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb;
  vec3 l = texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb;
  vec3 m = texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb;
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(o, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tSrc;   // smaller mip (upsampled)
uniform sampler2D tBase;  // current mip
uniform vec2 texel;       // smaller mip texel
uniform float weight;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + texel * vec2(0.0, -1.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + texel * vec2(-1.0, 0.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv + texel * vec2(1.0, 0.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb;
  s += texture2D(tSrc, vUv + texel * vec2(0.0, 1.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(texture2D(tBase, vUv).rgb + s / 16.0 * weight, 1.0);
}
`;

// --- Final ---------------------------------------------------------------------
const FINAL_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform sampler2D tOverlay;
uniform float bloomStrength, exposure, vignette, topLight, grain, overlayStrength, saturation, overlayProtect;
uniform int toneMap, hasOverlay, overlayMode;
uniform vec3 tint;
uniform float grainFrame;
uniform vec4 hazePos;
uniform vec3 hazeColor;
uniform vec2 resolution;
varying vec2 vUv;

vec3 neutral(vec3 color) {
  // Khronos PBR Neutral
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, newPeak * vec3(1.0), g);
}
vec3 aces(vec3 x) {
  const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
// Integer hash of (pixel, frame): fixed formula, no Math.random.
float hash(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return float(v.x & 0x00ffffffu) / 16777216.0;
}
void main() {
  vec3 c = texture2D(tColor, vUv).rgb + texture2D(tBloom, vUv).rgb * bloomStrength;
  c *= exposure;
  if (toneMap == 1) c = neutral(c);
  else if (toneMap == 2) c = aces(c);
  vec3 d = toSRGB(c);
  float l = dot(d, vec3(0.2126, 0.7152, 0.0722));
  d = mix(vec3(l), d, saturation);
  d *= tint;
  if (hasOverlay == 1) {
    vec4 o = texture2D(tOverlay, vUv);
    vec3 ov = o.rgb * o.a * overlayStrength;
    // keep saturated subjects (gold coins) rich under the double exposure
    float mx = max(d.r, max(d.g, d.b));
    float sat = (mx - min(d.r, min(d.g, d.b))) / max(mx, 1e-4);
    ov *= 1.0 - overlayProtect * smoothstep(0.15, 0.45, sat);
    d = 1.0 - (1.0 - d) * (1.0 - ov);
  }
  {
    vec2 hp = (vUv - hazePos.xy) * vec2(resolution.x / resolution.y, 1.0);
    d += hazeColor * exp(-dot(hp, hp) / (hazePos.z * hazePos.z));
  }
  // vignette + vertical falloff
  vec2 p = vUv - 0.5;
  p.x *= resolution.x / resolution.y;
  float v = 1.0 - vignette * smoothstep(0.35, 1.15, length(p));
  v *= 1.0 + topLight * (vUv.y - 0.5);
  d *= v;
  uvec3 key = uvec3(uvec2(gl_FragCoord.xy), uint(grainFrame));
  float g = hash(key) - 0.5;
  d += g * grain * 2.0;
  float t1 = hash(key + uvec3(7919u, 104729u, 613u));
  float t2 = hash(key + uvec3(15485863u, 32452843u, 1223u));
  d += (t1 + t2 - 1.0) / 255.0;
  gl_FragColor = vec4(clamp(d, 0.0, 1.0), 1.0);
}
`;

const makeRT = (w: number, h: number, samples = 0, depth = false) => {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    samples,
    generateMipmaps: false,
  });
  if (depth) {
    rt.depthTexture = new THREE.DepthTexture(w, h);
    rt.depthTexture.type = THREE.FloatType;
    rt.depthTexture.format = THREE.DepthFormat;
  }
  return rt;
};

const BLOOM_MIPS = 6;

export class PostPipeline {
  readonly gl: THREE.WebGLRenderer;
  width = 0;
  height = 0;
  sceneRT!: THREE.WebGLRenderTarget;
  private halfRT!: THREE.WebGLRenderTarget;
  private bokehRT!: THREE.WebGLRenderTarget;
  private dofRT!: THREE.WebGLRenderTarget;
  private mips: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private cocMat = pass(COC_FRAG, {
    tColor: {value: null}, tDepth: {value: null}, texel: {value: new THREE.Vector2()},
    near: {value: 0.1}, far: {value: 100}, focus: {value: 10}, aperture: {value: 0}, maxBlur: {value: 0},
    nearScale: {value: 1}, heightPx: {value: 1},
  });
  private bokehMat = pass(BOKEH_FRAG, {
    tHalf: {value: null}, tDepth: {value: null}, texel: {value: new THREE.Vector2()},
    near: {value: 0.1}, far: {value: 100}, maxRadius: {value: 8}, radScale: {value: 0.6},
  });
  private dofMat = pass(DOF_COMPOSITE_FRAG, {
    tColor: {value: null}, tBlur: {value: null}, tDepth: {value: null},
    near: {value: 0.1}, far: {value: 100}, focus: {value: 10}, aperture: {value: 0}, maxBlur: {value: 0},
    nearScale: {value: 1}, heightPx: {value: 1},
  });
  private preMat = pass(PREFILTER_FRAG, {tColor: {value: null}, texel: {value: new THREE.Vector2()}, threshold: {value: 1}});
  private downMat = pass(DOWN_FRAG, {tSrc: {value: null}, texel: {value: new THREE.Vector2()}});
  private upMat = pass(UP_FRAG, {tSrc: {value: null}, tBase: {value: null}, texel: {value: new THREE.Vector2()}, weight: {value: 1}});
  private finalMat = pass(FINAL_FRAG, {
    tColor: {value: null}, tBloom: {value: null}, tOverlay: {value: null},
    bloomStrength: {value: 0}, exposure: {value: 1}, vignette: {value: 0}, topLight: {value: 0},
    grain: {value: 0}, overlayStrength: {value: 1}, saturation: {value: 1}, overlayProtect: {value: 0},
    toneMap: {value: 0}, hasOverlay: {value: 0}, overlayMode: {value: 0},
    tint: {value: new THREE.Color(1, 1, 1)}, grainFrame: {value: 0}, resolution: {value: new THREE.Vector2()},
    hazePos: {value: new THREE.Vector4(0, 0, 0.1, 0)}, hazeColor: {value: new THREE.Color(0, 0, 0)},
  });
  private blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);

  constructor(gl: THREE.WebGLRenderer) {
    this.gl = gl;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.finalMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.blackTex.needsUpdate = true;
  }

  setSize(w: number, h: number) {
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.sceneRT?.dispose();
    this.sceneRT = makeRT(w, h, 4, true);
    const hw = Math.max(1, Math.round(w / 2));
    const hh = Math.max(1, Math.round(h / 2));
    this.halfRT = makeRT(hw, hh);
    this.bokehRT = makeRT(hw, hh);
    this.dofRT = makeRT(w, h);
    this.mips = [];
    this.ups = [];
    let mw = hw;
    let mh = hh;
    for (let i = 0; i < BLOOM_MIPS; i++) {
      this.mips.push(makeRT(mw, mh));
      this.ups.push(makeRT(mw, mh));
      mw = Math.max(1, Math.round(mw / 2));
      mh = Math.max(1, Math.round(mh / 2));
    }
  }

  private draw(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  // Renders the scene into the HDR scene target (exposed so callers can add
  // extra passes, e.g. reflections, before calling post()).
  renderScene(scene: THREE.Scene, camera: THREE.Camera, clear: THREE.Color) {
    this.gl.setRenderTarget(this.sceneRT);
    this.gl.setClearColor(clear, 1);
    this.gl.clear(true, true, true);
    this.gl.render(scene, camera);
  }

  post(camera: THREE.PerspectiveCamera, p: PostParams) {
    const w = this.width;
    const h = this.height;
    let color: THREE.Texture = this.sceneRT.texture;
    const depth = this.sceneRT.depthTexture!;

    if (p.dof && p.aperture > 0) {
      const u = this.cocMat.uniforms;
      u.tColor.value = color;
      u.tDepth.value = depth;
      u.texel.value.set(1 / w, 1 / h);
      u.near.value = camera.near;
      u.far.value = camera.far;
      u.focus.value = p.focus;
      u.aperture.value = p.aperture;
      u.maxBlur.value = p.maxBlur;
      u.nearScale.value = p.nearScale;
      u.heightPx.value = h;
      this.draw(this.cocMat, this.halfRT);

      const b = this.bokehMat.uniforms;
      b.tHalf.value = this.halfRT.texture;
      b.tDepth.value = depth;
      b.texel.value.set(1 / this.halfRT.width, 1 / this.halfRT.height);
      b.near.value = camera.near;
      b.far.value = camera.far;
      b.maxRadius.value = Math.max(1.5, p.maxBlur * h * 0.5);
      // Keep the sample count roughly constant across resolutions.
      b.radScale.value = Math.max(0.5, (p.maxBlur * h * 0.5) / 10);
      this.draw(this.bokehMat, this.bokehRT);

      const d = this.dofMat.uniforms;
      d.tColor.value = color;
      d.tBlur.value = this.bokehRT.texture;
      d.tDepth.value = depth;
      d.near.value = camera.near;
      d.far.value = camera.far;
      d.focus.value = p.focus;
      d.aperture.value = p.aperture;
      d.maxBlur.value = p.maxBlur;
      d.nearScale.value = p.nearScale;
      d.heightPx.value = h;
      this.draw(this.dofMat, this.dofRT);
      color = this.dofRT.texture;
    }

    let bloomTex: THREE.Texture = this.blackTex;
    if (p.bloomStrength > 0) {
      const pre = this.preMat.uniforms;
      pre.tColor.value = color;
      pre.texel.value.set(1 / w, 1 / h);
      pre.threshold.value = p.bloomThreshold;
      this.draw(this.preMat, this.mips[0]);
      for (let i = 1; i < BLOOM_MIPS; i++) {
        const src = this.mips[i - 1];
        this.downMat.uniforms.tSrc.value = src.texture;
        this.downMat.uniforms.texel.value.set(1 / src.width, 1 / src.height);
        this.draw(this.downMat, this.mips[i]);
      }
      // Upsample: ups[i] = mips[i] + upsample(ups[i+1]) * weight
      let prev = this.mips[BLOOM_MIPS - 1];
      for (let i = BLOOM_MIPS - 2; i >= 0; i--) {
        const u = this.upMat.uniforms;
        u.tSrc.value = prev.texture;
        u.tBase.value = this.mips[i].texture;
        u.texel.value.set(1 / prev.width, 1 / prev.height);
        u.weight.value = 0.35 + 0.65 * p.bloomRadius;
        this.draw(this.upMat, this.ups[i]);
        prev = this.ups[i];
      }
      bloomTex = this.ups[0].texture;
    }

    const f = this.finalMat.uniforms;
    f.tColor.value = color;
    f.tBloom.value = bloomTex;
    f.bloomStrength.value = p.bloomStrength;
    f.exposure.value = p.exposure;
    f.toneMap.value = p.toneMap === 'neutral' ? 1 : p.toneMap === 'aces' ? 2 : 0;
    f.vignette.value = p.vignette;
    f.topLight.value = p.topLight;
    f.grain.value = p.grain;
    f.grainFrame.value = p.grainFrame;
    f.tint.value.copy(p.tint);
    f.saturation.value = p.saturation;
    f.hasOverlay.value = p.overlay ? 1 : 0;
    f.tOverlay.value = p.overlay ?? this.blackTex;
    f.overlayStrength.value = p.overlayStrength;
    f.overlayMode.value = p.overlayMode;
    f.overlayProtect.value = p.overlayProtect;
    f.resolution.value.set(w, h);
    if (p.haze) {
      f.hazePos.value.set(p.haze.x, p.haze.y, p.haze.radius, 0);
      f.hazeColor.value.copy(p.haze.color);
    } else f.hazeColor.value.setRGB(0, 0, 0);
    this.draw(this.finalMat, null);
  }
}
