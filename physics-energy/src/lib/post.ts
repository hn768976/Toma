import * as THREE from "three";
import { FullScreen, fsMaterial } from "./fullscreen";
import { LOOP } from "./loop";

export interface PostOptions {
  /** Keep a depth texture (needed for depth of field). */
  depth?: boolean;
  bloom: { strength: number; threshold: number; knee: number; levels?: number; radius?: number };
  dof?: { focus: number; range: number; farRange?: number; maxCocPx4k: number; near: number; far: number };
  exposure?: number;
  /** Soft shoulder start (linear). Values below pass through unchanged. */
  shoulder?: number;
  vignette?: { amount: number; start: number; end: number };
  /** Grain amplitude in display units (0.015 = 1.5 %). */
  grain: number;
  /** Fade grain to zero below ~3 % luminance (for black looks). */
  grainGate?: boolean;
}

const DOWN = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 fragColor;
in vec2 vUv;
uniform sampler2D src;
uniform vec2 texel;
uniform float threshold;
uniform float knee;
uniform float first;
vec3 s(float x, float y) { return texture(src, vUv + vec2(x, y) * texel).rgb; }
void main() {
  vec3 a = s(-2., 2.), b = s(0., 2.), c = s(2., 2.);
  vec3 d = s(-2., 0.), e = s(0., 0.), f = s(2., 0.);
  vec3 g = s(-2., -2.), h = s(0., -2.), i = s(2., -2.);
  vec3 j = s(-1., 1.), k = s(1., 1.), l = s(-1., -1.), m = s(1., -1.);
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (first > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    rq = rq * rq / (4.0 * knee + 1e-4);
    col *= max(rq, br - threshold) / max(br, 1e-4);
  }
  fragColor = vec4(max(col, 0.0), 1.0);
}`;

const UP = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 fragColor;
in vec2 vUv;
uniform sampler2D src;
uniform vec2 texel;
uniform float weight;
vec3 s(float x, float y) { return texture(src, vUv + vec2(x, y) * texel).rgb; }
void main() {
  vec3 col = s(0., 0.) * 4.0
    + (s(-1., 0.) + s(1., 0.) + s(0., -1.) + s(0., 1.)) * 2.0
    + (s(-1., -1.) + s(1., -1.) + s(-1., 1.) + s(1., 1.));
  fragColor = vec4(col / 16.0 * weight, 1.0);
}`;

const DOF = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 fragColor;
in vec2 vUv;
uniform sampler2D color;
uniform sampler2D depth;
uniform vec2 res;
uniform float near, far, focus, range, farRange, maxCoc;
float linZ(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * near * far / (far + near - z * (far - near));
}
float cocAt(vec2 uv, out float z) {
  z = linZ(texture(depth, uv).r);
  float dz = z - focus;
  float r = dz > 0.0 ? farRange : range;
  return clamp(abs(dz) / r, 0.0, 1.0) * maxCoc;
}
void main() {
  float z0;
  float c0 = cocAt(vUv, z0);
  vec3 acc = texture(color, vUv).rgb;
  float wsum = 1.0;
  const int N = 40;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(N)) * maxCoc;
    float th = fi * 2.39996323;
    vec2 off = vec2(cos(th), sin(th)) * r;
    vec2 uv = vUv + off / res;
    float zs;
    float cs = cocAt(uv, zs);
    // A sample behind the centre pixel cannot blur over it by more than the
    // centre's own CoC (keeps sharp foreground edges sharp).
    float c = zs > z0 ? min(cs, c0) : cs;
    float w = clamp(c - r + 1.0, 0.0, 1.0);
    acc += texture(color, uv).rgb * w;
    wsum += w;
  }
  fragColor = vec4(acc / wsum, 1.0);
}`;

const FINAL = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 fragColor;
in vec2 vUv;
uniform sampler2D scene;
uniform sampler2D bloom;
uniform float bloomStrength, exposure, shoulder;
uniform vec3 vig; // amount, start, end
uniform float grain, grainGate, frame;
uniform vec2 res;

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash3(vec2 p, float f) {
  uvec3 h = pcg3d(uvec3(uint(p.x), uint(p.y), uint(f)));
  return vec3(h) * (1.0 / 4294967295.0);
}
float shoulderMap(float x) {
  if (x <= shoulder) return x;
  float k = 1.0 - shoulder;
  return shoulder + k * (1.0 - exp(-(x - shoulder) / k));
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 c = texture(scene, vUv).rgb * exposure + texture(bloom, vUv).rgb * bloomStrength;
  vec2 q = (vUv - 0.5) * vec2(res.x / res.y, 1.0);
  float vr = length(q) / 0.5;
  c *= 1.0 - vig.x * smoothstep(vig.y, vig.z, vr);
  c = vec3(shoulderMap(c.r), shoulderMap(c.g), shoulderMap(c.b));
  vec3 s = toSRGB(c);
  vec3 h = hash3(floor(gl_FragCoord.xy), frame);
  float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float gate = grainGate > 0.5 ? smoothstep(0.0, 0.03, lum) : 1.0;
  s += (h.x - 0.5) * 2.0 * grain * gate;
  s += (h.y + h.z - 1.0) / 255.0; // triangular dither, +-1/255
  fragColor = vec4(s, 1.0);
}`;

export class Post {
  readonly sceneRT: THREE.WebGLRenderTarget;
  private dofRT: THREE.WebGLRenderTarget | null = null;
  private levels: THREE.WebGLRenderTarget[] = [];
  private fs = new FullScreen();
  private down: THREE.ShaderMaterial;
  private up: THREE.ShaderMaterial;
  private dof: THREE.ShaderMaterial | null = null;
  private final: THREE.ShaderMaterial;

  constructor(
    private gl: THREE.WebGLRenderer,
    readonly width: number,
    readonly height: number,
    private o: PostOptions,
  ) {
    const hf = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.sceneRT = new THREE.WebGLRenderTarget(width, height, {
      ...hf,
      samples: 4,
      depthBuffer: true,
      ...(o.depth ? { depthTexture: new THREE.DepthTexture(width, height, THREE.FloatType) } : {}),
    });
    const n = o.bloom.levels ?? 6;
    let w = width, h = height;
    for (let i = 0; i < n; i++) {
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
      this.levels.push(new THREE.WebGLRenderTarget(w, h, { ...hf, depthBuffer: false }));
    }
    this.down = fsMaterial(DOWN, {
      src: { value: null }, texel: { value: new THREE.Vector2() },
      threshold: { value: o.bloom.threshold }, knee: { value: o.bloom.knee }, first: { value: 0 },
    });
    this.up = fsMaterial(UP, { src: { value: null }, texel: { value: new THREE.Vector2() }, weight: { value: 1 } }, THREE.AdditiveBlending);
    if (o.dof) {
      this.dofRT = new THREE.WebGLRenderTarget(width, height, { ...hf, depthBuffer: false });
      const pxScale = height / 2160;
      this.dof = fsMaterial(DOF, {
        color: { value: this.sceneRT.texture }, depth: { value: this.sceneRT.depthTexture },
        res: { value: new THREE.Vector2(width, height) },
        near: { value: o.dof.near }, far: { value: o.dof.far }, focus: { value: o.dof.focus },
        range: { value: o.dof.range }, farRange: { value: o.dof.farRange ?? o.dof.range },
        maxCoc: { value: Math.max(0.75, o.dof.maxCocPx4k * pxScale) },
      });
    }
    const v = o.vignette ?? { amount: 0, start: 1, end: 2 };
    this.final = fsMaterial(FINAL, {
      scene: { value: null }, bloom: { value: this.levels[0].texture },
      bloomStrength: { value: o.bloom.strength }, exposure: { value: o.exposure ?? 1 },
      shoulder: { value: o.shoulder ?? 0.8 }, vig: { value: new THREE.Vector3(v.amount, v.start, v.end) },
      grain: { value: o.grain }, grainGate: { value: o.grainGate ? 1 : 0 }, frame: { value: 0 },
      res: { value: new THREE.Vector2(width, height) },
    });
  }

  /** Render `scene` with `camera` through the whole chain to the canvas. */
  render(scene: THREE.Scene, camera: THREE.Camera, frame: number) {
    const gl = this.gl;
    gl.setRenderTarget(this.sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);
    let src = this.sceneRT.texture;
    if (this.dof && this.dofRT) {
      if (this.o.dof) this.dof.uniforms.focus.value = this.o.dof.focus;
      this.fs.render(gl, this.dof, this.dofRT);
      src = this.dofRT.texture;
    }
    // Bloom: 13-tap downsample chain, tent upsample with additive blend.
    let prev: THREE.Texture = src;
    let pw = this.width, ph = this.height;
    this.levels.forEach((rt, i) => {
      this.down.uniforms.src.value = prev;
      this.down.uniforms.texel.value.set(1 / pw, 1 / ph);
      this.down.uniforms.first.value = i === 0 ? 1 : 0;
      this.fs.render(gl, this.down, rt);
      prev = rt.texture;
      pw = rt.width; ph = rt.height;
    });
    const radius = this.o.bloom.radius ?? 1;
    for (let i = this.levels.length - 1; i > 0; i--) {
      const lo = this.levels[i];
      this.up.uniforms.src.value = lo.texture;
      this.up.uniforms.texel.value.set(1 / lo.width, 1 / lo.height);
      this.up.uniforms.weight.value = radius;
      this.gl.autoClear = false;
      this.fs.render(gl, this.up, this.levels[i - 1]);
      this.gl.autoClear = true;
    }
    this.final.uniforms.scene.value = src;
    this.final.uniforms.frame.value = ((frame % LOOP) + LOOP) % LOOP;
    this.fs.render(gl, this.final, null);
  }

  setDofFocus(f: number) {
    if (this.o.dof) this.o.dof.focus = f;
  }

  dispose() {
    this.sceneRT.dispose();
    this.dofRT?.dispose();
    this.levels.forEach((l) => l.dispose());
    [this.down, this.up, this.dof, this.final].forEach((m) => m?.dispose());
    this.fs.dispose();
  }
}
