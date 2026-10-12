// Post pipeline: scene -> (depth of field) -> (bloom) -> final pass with
// vignette, ±1/255 dither and a deterministic grain of pixel position and
// frame % 600. No temporal accumulation of any kind.

import * as THREE from "three";

const FS_VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const COMMON = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 fragColor;
vec4 cubicW(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0 / 6.0);
}
// smooth B-spline upsampling with 4 bilinear taps
vec4 texBicubic(sampler2D s, vec2 uv) {
  vec2 size = vec2(textureSize(s, 0));
  vec2 inv = 1.0 / size;
  uv = uv * size - 0.5;
  vec2 f = fract(uv);
  uv -= f;
  vec4 xc = cubicW(f.x);
  vec4 yc = cubicW(f.y);
  vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 sm = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 off = c + vec4(xc.yw, yc.yw) / sm;
  off *= inv.xxyy;
  vec4 s0 = texture(s, off.xz);
  vec4 s1 = texture(s, off.yz);
  vec4 s2 = texture(s, off.xw);
  vec4 s3 = texture(s, off.yw);
  float sx = sm.x / (sm.x + sm.y);
  float sy = sm.z / (sm.z + sm.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}
`;

const DOWN_FRAG = /* glsl */ `${COMMON}
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
uniform int uPrefilter;
vec4 downsample13(vec2 uv) {
  vec4 a = texture(tSrc, uv + uTexel * vec2(-2.0, -2.0));
  vec4 b = texture(tSrc, uv + uTexel * vec2(0.0, -2.0));
  vec4 c = texture(tSrc, uv + uTexel * vec2(2.0, -2.0));
  vec4 d = texture(tSrc, uv + uTexel * vec2(-1.0, -1.0));
  vec4 e = texture(tSrc, uv);
  vec4 f = texture(tSrc, uv + uTexel * vec2(1.0, -1.0));
  vec4 g = texture(tSrc, uv + uTexel * vec2(-2.0, 0.0));
  vec4 h = texture(tSrc, uv + uTexel * vec2(2.0, 0.0));
  vec4 i = texture(tSrc, uv + uTexel * vec2(-1.0, 1.0));
  vec4 j = texture(tSrc, uv + uTexel * vec2(1.0, 1.0));
  vec4 k = texture(tSrc, uv + uTexel * vec2(-2.0, 2.0));
  vec4 l = texture(tSrc, uv + uTexel * vec2(0.0, 2.0));
  vec4 m = texture(tSrc, uv + uTexel * vec2(2.0, 2.0));
  vec4 o = (d + f + i + j) * 0.125;
  o += (a + b + g + e) * 0.03125;
  o += (b + c + e + h) * 0.03125;
  o += (g + e + k + l) * 0.03125;
  o += (e + h + l + m) * 0.03125;
  return o;
}
void main() {
  vec4 c = downsample13(vUv);
  if (uPrefilter == 1) {
    float br = max(c.r, max(c.g, c.b));
    float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    rq = (rq * rq) / (4.0 * uKnee + 1e-5);
    float w = max(rq, br - uThreshold) / max(br, 1e-5);
    c.rgb *= w;
  }
  fragColor = vec4(max(c.rgb, 0.0), c.a);
}`;

const UP_FRAG = /* glsl */ `${COMMON}
uniform sampler2D tLow;
uniform sampler2D tHigh;
uniform vec2 uTexel;
uniform float uRadius;
void main() {
  vec2 d = uTexel * uRadius;
  vec3 s = texture(tLow, vUv + vec2(-d.x, -d.y)).rgb;
  s += texture(tLow, vUv + vec2(0.0, -d.y)).rgb * 2.0;
  s += texture(tLow, vUv + vec2(d.x, -d.y)).rgb;
  s += texture(tLow, vUv + vec2(-d.x, 0.0)).rgb * 2.0;
  s += texture(tLow, vUv).rgb * 4.0;
  s += texture(tLow, vUv + vec2(d.x, 0.0)).rgb * 2.0;
  s += texture(tLow, vUv + vec2(-d.x, d.y)).rgb;
  s += texture(tLow, vUv + vec2(0.0, d.y)).rgb * 2.0;
  s += texture(tLow, vUv + vec2(d.x, d.y)).rgb;
  fragColor = vec4(texture(tHigh, vUv).rgb + s / 16.0, 1.0);
}`;

// Depth of field: the scene writes its circle of confusion (0..1 of uCocMax
// pixels) into alpha. We blend between progressively blurred pyramid levels.
const DOF_FRAG = /* glsl */ `${COMMON}
uniform sampler2D tScene;
uniform sampler2D tL1;
uniform sampler2D tL2;
uniform sampler2D tL3;
uniform sampler2D tL4;
uniform sampler2D tL5;
uniform float uCocMax;
vec3 level(int i, vec2 uv) {
  if (i <= 0) return texture(tScene, uv).rgb;
  if (i == 1) return texBicubic(tL1, uv).rgb;
  if (i == 2) return texBicubic(tL2, uv).rgb;
  if (i == 3) return texBicubic(tL3, uv).rgb;
  if (i == 4) return texBicubic(tL4, uv).rgb;
  return texBicubic(tL5, uv).rgb;
}
void main() {
  float coc = texture(tScene, vUv).a * uCocMax;
  float lv = clamp(log2(max(coc, 1e-3)) + 0.3, 0.0, 5.0);
  int i0 = int(floor(lv));
  int i1 = min(i0 + 1, 5);
  float t = lv - float(i0);
  vec3 c = mix(level(i0, vUv), level(i1, vUv), t);
  fragColor = vec4(c, 1.0);
}`;

const FINAL_FRAG = /* glsl */ `${COMMON}
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uExposure;
uniform float uVignette;
uniform float uGrain;
uniform uint uFrame;
uniform vec2 uRes;
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 shoulder(vec3 x) {
  // identity up to 0.8, then a soft roll-off to 1
  vec3 over = max(x - 0.8, 0.0);
  return min(x, 0.8) + 0.2 * (1.0 - exp(-over / 0.2));
}
void main() {
  vec3 c = texture(tColor, vUv).rgb;
  if (uBloom > 0.0) c += uBloom * texBicubic(tBloom, vUv).rgb;
  c *= uExposure;
  vec2 q = vUv - 0.5;
  q.x *= uRes.x / uRes.y;
  c *= mix(1.0, 1.0 - smoothstep(0.35, 1.05, length(q)), uVignette);
  c = shoulder(max(c, 0.0));
  uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uFrame));
  vec3 r = vec3(h) * (1.0 / 4294967295.0);
  c += (r.x + r.y - 1.0) * uGrain;          // grain, triangular, ±uGrain
  c += (r.z - 0.5) * (2.0 / 255.0);         // ±1/255 dither before 8-bit
  fragColor = vec4(c, 1.0);
}`;

export interface PostOptions {
  bloom?: { strength: number; threshold: number; knee: number; radius: number };
  dof?: { cocMaxFrac: number }; // max CoC as fraction of buffer height
  vignette?: number;
  grain?: number; // fraction of full scale (0.015 = 1.5%)
  exposure?: number;
  clear?: THREE.ColorRepresentation;
}

const mkRT = (w: number, h: number, depth: boolean, samples = 0) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    stencilBuffer: false,
    generateMipmaps: false,
    samples,
  });

const mkPass = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FS_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

export class PostFX {
  private sceneRT: THREE.WebGLRenderTarget;
  private colorRT: THREE.WebGLRenderTarget | null = null;
  private dofLevels: THREE.WebGLRenderTarget[] = [];
  private bloomDown: THREE.WebGLRenderTarget[] = [];
  private bloomUp: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private down = mkPass(DOWN_FRAG, {
    tSrc: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uThreshold: { value: 1 },
    uKnee: { value: 0.5 },
    uPrefilter: { value: 0 },
  });
  private up = mkPass(UP_FRAG, {
    tLow: { value: null },
    tHigh: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uRadius: { value: 1 },
  });
  private dof = mkPass(DOF_FRAG, {
    tScene: { value: null },
    tL1: { value: null },
    tL2: { value: null },
    tL3: { value: null },
    tL4: { value: null },
    tL5: { value: null },
    uCocMax: { value: 1 },
  });
  private final = mkPass(FINAL_FRAG, {
    tColor: { value: null },
    tBloom: { value: null },
    uBloom: { value: 0 },
    uExposure: { value: 1 },
    uVignette: { value: 0 },
    uGrain: { value: 0.015 },
    uFrame: { value: 0 },
    uRes: { value: new THREE.Vector2() },
  });
  readonly width: number;
  readonly height: number;

  constructor(
    width: number,
    height: number,
    private opts: PostOptions,
  ) {
    this.width = width;
    this.height = height;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.quad = new THREE.Mesh(g, this.final);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.sceneRT = mkRT(width, height, true);
    if (opts.dof) {
      this.colorRT = mkRT(width, height, false);
      for (let i = 1; i <= 5; i++) this.dofLevels.push(mkRT(width >> i, height >> i, false));
    }
    if (opts.bloom) {
      for (let i = 1; i <= 6; i++) {
        this.bloomDown.push(mkRT(width >> i, height >> i, false));
        this.bloomUp.push(mkRT(width >> i, height >> i, false));
      }
    }
  }

  private pass(r: THREE.WebGLRenderer, mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    r.setRenderTarget(target);
    r.render(this.quadScene, this.quadCam);
  }

  // `drawScene` renders into the bound target (already cleared).
  render(r: THREE.WebGLRenderer, frame: number, drawScene: (r: THREE.WebGLRenderer) => void) {
    const { opts } = this;
    r.setRenderTarget(this.sceneRT);
    r.setClearColor(opts.clear ?? 0x000000, 0);
    r.clear(true, true, false);
    drawScene(r);

    let color: THREE.WebGLRenderTarget = this.sceneRT;
    if (opts.dof && this.colorRT) {
      let src = this.sceneRT;
      this.down.uniforms.uPrefilter.value = 0;
      for (const lvl of this.dofLevels) {
        this.down.uniforms.tSrc.value = src.texture;
        this.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        this.pass(r, this.down, lvl);
        src = lvl;
      }
      const u = this.dof.uniforms;
      u.tScene.value = this.sceneRT.texture;
      this.dofLevels.forEach((l, i) => (u[`tL${i + 1}`].value = l.texture));
      u.uCocMax.value = opts.dof.cocMaxFrac * this.height;
      this.pass(r, this.dof, this.colorRT);
      color = this.colorRT;
    }

    if (opts.bloom) {
      const b = opts.bloom;
      let src = color;
      this.bloomDown.forEach((lvl, i) => {
        this.down.uniforms.tSrc.value = src.texture;
        this.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        this.down.uniforms.uPrefilter.value = i === 0 ? 1 : 0;
        this.down.uniforms.uThreshold.value = b.threshold;
        this.down.uniforms.uKnee.value = b.knee;
        this.pass(r, this.down, lvl);
        src = lvl;
      });
      // upsample + accumulate
      let low = this.bloomDown[this.bloomDown.length - 1];
      for (let i = this.bloomDown.length - 2; i >= 0; i--) {
        this.up.uniforms.tLow.value = low.texture;
        this.up.uniforms.tHigh.value = this.bloomDown[i].texture;
        this.up.uniforms.uTexel.value.set(1 / low.width, 1 / low.height);
        this.up.uniforms.uRadius.value = b.radius;
        this.pass(r, this.up, this.bloomUp[i]);
        low = this.bloomUp[i];
      }
    }

    const f = this.final.uniforms;
    f.tColor.value = color.texture;
    f.tBloom.value = opts.bloom ? this.bloomUp[0].texture : color.texture;
    f.uBloom.value = opts.bloom ? opts.bloom.strength : 0;
    f.uExposure.value = opts.exposure ?? 1;
    f.uVignette.value = opts.vignette ?? 0;
    f.uGrain.value = opts.grain ?? 0.015;
    f.uFrame.value = frame;
    f.uRes.value.set(this.width, this.height);
    this.pass(r, this.final, null);
  }

  dispose() {
    [this.sceneRT, this.colorRT, ...this.dofLevels, ...this.bloomDown, ...this.bloomUp].forEach((t) => t?.dispose());
    [this.down, this.up, this.dof, this.final].forEach((m) => m.dispose());
    this.quad.geometry.dispose();
  }
}
