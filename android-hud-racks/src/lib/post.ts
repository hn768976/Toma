import * as THREE from "three";

// The shared post chain. Every pass is a pure single-frame operation (no
// history, no TAA), so a frame rendered alone matches the same frame in a
// full render.
//
//   scene (MSAA, HDR, depth texture)
//     -> DoF prefilter (half res, colour + signed CoC)
//     -> DoF gather (half res, fixed golden-angle sample pattern)
//     -> DoF composite (full res, sharp/blur mix)
//     -> overlay hook (sharp additive layers drawn after DoF)
//     -> bloom (threshold, mip chain down, tent up)
//     -> final (chromatic aberration, bloom add, tone curve, grade,
//               vignette, then grain and dither last)

export type PostOptions = {
  dof?: {
    // CoC in 4K pixels for an object at infinity (thin-lens style
    // |z - focus| / z scaling).
    aperture: number;
    maxCoc: number; // 4K pixels
    nearScale?: number; // extra multiplier for the near field
    // Extra far-field CoC (4K px) growing with the square of the distance
    // from the frame centre: softens the edges of a square-on shot.
    edge?: number;
  };
  bloom: {
    threshold: number;
    knee: number;
    intensity: number;
  };
  grade: {
    exposure: number;
    tint: [number, number, number]; // display-space multiply
    lift: [number, number, number]; // display-space add in the shadows
    saturation: number;
    contrast: number;
  };
  vignette: { strength: number; radius: number; softness: number };
  ca?: number; // RGB split in 4K pixels at the frame corners
  grain: number; // 0.015 = 1.5 %
  loop: number; // grain repeats on frame % loop
  clearColor?: THREE.ColorRepresentation;
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const DOF_TAPS = 48;
const goldenDisk = () => {
  const pts: number[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < DOF_TAPS; i++) {
    const r = Math.sqrt((i + 0.5) / DOF_TAPS);
    const a = i * ga;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
};

const DOF_PREFILTER = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 srcTexel;
uniform float cNear, cFar, focus, aperture, maxCoc, nearScale, edgeCoc;
uniform float aspect;
varying vec2 vUv;
float viewZ(float d) {
  return (cNear * cFar) / (cFar - d * (cFar - cNear));
}
float cocAt(vec2 uv) {
  float z = viewZ(texture2D(tDepth, uv).x);
  float c = aperture * (z - focus) / max(z, 1e-4);
  if (c < 0.0) c *= nearScale;
  vec2 e = (uv - 0.5) * vec2(aspect, 1.0);
  c += edgeCoc * dot(e, e) / (0.25 * aspect * aspect + 0.25);
  return clamp(c, -maxCoc, maxCoc);
}
void main() {
  vec2 o = srcTexel * 0.5;
  vec3 a = texture2D(tColor, vUv + vec2(-o.x, -o.y)).rgb;
  vec3 b = texture2D(tColor, vUv + vec2( o.x, -o.y)).rgb;
  vec3 c = texture2D(tColor, vUv + vec2(-o.x,  o.y)).rgb;
  vec3 d = texture2D(tColor, vUv + vec2( o.x,  o.y)).rgb;
  float ca = cocAt(vUv + vec2(-o.x, -o.y));
  float cb = cocAt(vUv + vec2( o.x, -o.y));
  float cc = cocAt(vUv + vec2(-o.x,  o.y));
  float cd = cocAt(vUv + vec2( o.x,  o.y));
  // Keep the most-blurred near value so foreground edges bleed outward.
  float coc = min(min(ca, cb), min(cc, cd));
  if (coc > 0.0) coc = (ca + cb + cc + cd) * 0.25;
  // Karis-style luma weights keep single bright LEDs from flickering.
  float wa = 1.0 / (1.0 + max(a.r, max(a.g, a.b)));
  float wb = 1.0 / (1.0 + max(b.r, max(b.g, b.b)));
  float wc = 1.0 / (1.0 + max(c.r, max(c.g, c.b)));
  float wd = 1.0 / (1.0 + max(d.r, max(d.g, d.b)));
  vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
  // Store CoC in half-res pixels.
  gl_FragColor = vec4(col, coc * 0.5);
}
`;

const DOF_GATHER = /* glsl */ `
uniform sampler2D tHalf;
uniform vec2 texel;
uniform float maxCoc; // half-res pixels
uniform vec2 disk[${DOF_TAPS}];
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tHalf, vUv);
  float cc = c.a;
  // A fixed per-pixel rotation of the tap pattern (interleaved gradient
  // noise of the pixel position) breaks up ring artifacts.
  vec2 px = gl_FragCoord.xy;
  float ang = 6.2831853 * fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715))));
  mat2 rot = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
  float R = max(abs(cc), 0.0);
  // Search radius: the full max so near-field blur can reach sharp pixels.
  float S = maxCoc;
  vec3 acc = c.rgb;
  float wsum = 1.0;
  float nearW = 0.0;
  float nearN = 0.0;
  for (int i = 0; i < ${DOF_TAPS}; i++) {
    vec2 o = rot * disk[i] * S;
    float dist = length(o);
    vec4 s = texture2D(tHalf, vUv + o * texel);
    float sc = s.a;
    float eff = abs(sc);
    // Background samples may not blur over a sharper foreground.
    if (sc > cc) eff = min(eff, abs(cc) * 2.0 + 0.5);
    float w = clamp(eff - dist + 1.0, 0.0, 1.0);
    acc += s.rgb * w;
    wsum += w;
    if (sc < -0.5) { nearW += w; }
    nearN += 1.0;
  }
  vec3 col = acc / wsum;
  float nearCover = clamp(nearW / max(nearN, 1.0) * 3.0, 0.0, 1.0);
  gl_FragColor = vec4(col, max(clamp(R - 0.5, 0.0, 1.0), nearCover));
}
`;

const DOF_COMPOSITE = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBlur;
uniform vec2 halfTexel;
varying vec2 vUv;
void main() {
  vec3 sharp = texture2D(tColor, vUv).rgb;
  // 4-tap tent on the half-res blur smooths the gather pattern.
  vec2 o = halfTexel * 0.75;
  vec4 b = texture2D(tBlur, vUv + vec2(-o.x, -o.y)) + texture2D(tBlur, vUv + vec2(o.x, -o.y))
         + texture2D(tBlur, vUv + vec2(-o.x, o.y)) + texture2D(tBlur, vUv + vec2(o.x, o.y));
  b *= 0.25;
  float m = smoothstep(0.0, 1.0, texture2D(tBlur, vUv).a);
  m = max(m, smoothstep(0.0, 1.0, b.a));
  gl_FragColor = vec4(mix(sharp, b.rgb, m), 1.0);
}
`;

const COPY = /* glsl */ `
uniform sampler2D tColor;
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture2D(tColor, vUv).rgb, 1.0); }
`;

const BLOOM_PREFILTER = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 srcTexel;
uniform float threshold, knee;
varying vec2 vUv;
vec3 pick(vec2 uv) {
  vec3 c = texture2D(tColor, uv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  rq = rq * rq / (4.0 * knee + 1e-4);
  float w = max(rq, br - threshold) / max(br, 1e-4);
  return c * w;
}
void main() {
  vec2 o = srcTexel;
  vec3 c = pick(vUv + vec2(-o.x, -o.y)) + pick(vUv + vec2(o.x, -o.y))
         + pick(vUv + vec2(-o.x, o.y)) + pick(vUv + vec2(o.x, o.y));
  gl_FragColor = vec4(c * 0.25, 1.0);
}
`;

const BLOOM_DOWN = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 srcTexel;
varying vec2 vUv;
void main() {
  vec2 o = srcTexel;
  vec3 c = texture2D(tColor, vUv).rgb * 0.5;
  c += texture2D(tColor, vUv + vec2(-o.x, -o.y)).rgb * 0.125;
  c += texture2D(tColor, vUv + vec2( o.x, -o.y)).rgb * 0.125;
  c += texture2D(tColor, vUv + vec2(-o.x,  o.y)).rgb * 0.125;
  c += texture2D(tColor, vUv + vec2( o.x,  o.y)).rgb * 0.125;
  gl_FragColor = vec4(c, 1.0);
}
`;

const BLOOM_UP = /* glsl */ `
uniform sampler2D tColor; // smaller level
uniform sampler2D tBase;  // current level
uniform vec2 srcTexel;
uniform float scatter;
varying vec2 vUv;
void main() {
  vec2 o = srcTexel;
  vec3 c = texture2D(tColor, vUv).rgb * 4.0;
  c += texture2D(tColor, vUv + vec2(-o.x, 0.0)).rgb * 2.0;
  c += texture2D(tColor, vUv + vec2( o.x, 0.0)).rgb * 2.0;
  c += texture2D(tColor, vUv + vec2(0.0, -o.y)).rgb * 2.0;
  c += texture2D(tColor, vUv + vec2(0.0,  o.y)).rgb * 2.0;
  c += texture2D(tColor, vUv + vec2(-o.x, -o.y)).rgb;
  c += texture2D(tColor, vUv + vec2( o.x, -o.y)).rgb;
  c += texture2D(tColor, vUv + vec2(-o.x,  o.y)).rgb;
  c += texture2D(tColor, vUv + vec2( o.x,  o.y)).rgb;
  c /= 16.0;
  gl_FragColor = vec4(texture2D(tBase, vUv).rgb + c * scatter, 1.0);
}
`;

const FINAL = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform vec2 resolution;
uniform float bloomIntensity, exposure, saturation, contrast;
uniform vec3 tint, lift;
uniform float vigStrength, vigRadius, vigSoft;
uniform float caPx; // RGB split at the corners, in buffer pixels
uniform float grain;
uniform float gframe;
varying vec2 vUv;

vec3 sampleCA(vec2 uv) {
  if (caPx <= 0.0) return texture2D(tColor, uv).rgb;
  vec2 d = uv - 0.5;
  // Offset grows with the square of the radius: 0 in the centre, caPx at
  // the corners.
  float r2 = dot(d * vec2(resolution.x / resolution.y, 1.0), d * vec2(resolution.x / resolution.y, 1.0));
  float cornerR2 = dot(vec2(0.5 * resolution.x / resolution.y, 0.5), vec2(0.5 * resolution.x / resolution.y, 0.5));
  vec2 dir = normalize(d + 1e-6);
  vec2 off = dir * (caPx * r2 / cornerR2) / resolution;
  float r = texture2D(tColor, uv + off).r;
  float g = texture2D(tColor, uv).g;
  float b = texture2D(tColor, uv - off).b;
  return vec3(r, g, b);
}

vec3 softClip(vec3 x) {
  // Linear to 0.75, then an asymptotic shoulder to 1.
  vec3 t = max(x - 0.75, 0.0);
  return min(x, 0.75) + 0.25 * (1.0 - exp(-t / 0.25));
}

float lin2srgb(float c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}

float hash(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}

void main() {
  vec3 col = sampleCA(vUv);
  col += texture2D(tBloom, vUv).rgb * bloomIntensity;
  col *= exposure;
  col = softClip(col);
  vec3 s = vec3(lin2srgb(col.r), lin2srgb(col.g), lin2srgb(col.b));
  // Grade in display space.
  s = s * tint + lift * (1.0 - s);
  float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
  s = mix(vec3(l), s, saturation);
  s = (s - 0.5) * contrast + 0.5;
  // Vignette.
  vec2 d = (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
  float v = smoothstep(vigRadius, vigRadius + vigSoft, length(d));
  s *= 1.0 - vigStrength * v;
  // Grain: a fixed function of pixel position and frame % loop.
  vec2 px = gl_FragCoord.xy;
  float g1 = hash(vec3(px, gframe));
  float g2 = hash(vec3(px + 17.0, gframe + 0.5));
  s += (g1 + g2 - 1.0) * grain;
  // Triangular dither, +-1/255.
  float d1 = hash(vec3(px * 1.37, gframe + 3.1));
  float d2 = hash(vec3(px * 0.73 + 5.0, gframe + 7.7));
  s += (d1 - d2) / 255.0;
  gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}
`;

export class FullscreenQuad {
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mesh: THREE.Mesh;
  constructor() {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.mesh.frustumCulled = false;
  }
  run(
    renderer: THREE.WebGLRenderer,
    material: THREE.Material,
    target: THREE.WebGLRenderTarget | null,
  ) {
    this.mesh.material = material;
    renderer.setRenderTarget(target);
    renderer.render(this.mesh, this.camera);
  }
}

const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const rt = (w: number, h: number, samples = 0, depth = false) => {
  const t = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    samples,
  });
  if (depth) {
    t.depthTexture = new THREE.DepthTexture(w, h);
    t.depthTexture.type = THREE.FloatType;
  }
  return t;
};

export class PostChain {
  readonly width: number;
  readonly height: number;
  // Buffer pixels per 4K pixel: sizes in the brief are given at 4K.
  readonly px: number;
  scene: THREE.WebGLRenderTarget;
  composite: THREE.WebGLRenderTarget;
  private half: THREE.WebGLRenderTarget;
  private gather: THREE.WebGLRenderTarget;
  private mips: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];
  private quad = new FullscreenQuad();
  private m: Record<string, THREE.ShaderMaterial> = {};
  private opts: PostOptions;

  constructor(
    private renderer: THREE.WebGLRenderer,
    width: number,
    height: number,
    opts: PostOptions,
  ) {
    this.width = width;
    this.height = height;
    this.px = height / 2160;
    this.opts = opts;
    const hw = Math.ceil(width / 2);
    const hh = Math.ceil(height / 2);
    this.scene = rt(width, height, 4, true);
    this.composite = rt(width, height);
    this.half = rt(hw, hh);
    this.gather = rt(hw, hh);
    let w = hw;
    let h = hh;
    for (let i = 0; i < 6; i++) {
      this.mips.push(rt(w, h));
      this.ups.push(rt(w, h));
      w = Math.ceil(w / 2);
      h = Math.ceil(h / 2);
    }
    const dof = opts.dof;
    this.m.prefilter = mat(DOF_PREFILTER, {
      tColor: { value: this.scene.texture },
      tDepth: { value: this.scene.depthTexture },
      srcTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
      cNear: { value: 0.1 },
      cFar: { value: 100 },
      focus: { value: 1 },
      aperture: { value: (dof?.aperture ?? 0) * this.px },
      maxCoc: { value: (dof?.maxCoc ?? 0) * this.px },
      nearScale: { value: dof?.nearScale ?? 1 },
      edgeCoc: { value: (dof?.edge ?? 0) * this.px },
      aspect: { value: width / height },
    });
    this.m.gather = mat(DOF_GATHER, {
      tHalf: { value: this.half.texture },
      texel: { value: new THREE.Vector2(1 / hw, 1 / hh) },
      maxCoc: { value: ((dof?.maxCoc ?? 0) * this.px) / 2 },
      disk: {
        value: (() => {
          const d = goldenDisk();
          const v: THREE.Vector2[] = [];
          for (let i = 0; i < d.length; i += 2)
            v.push(new THREE.Vector2(d[i], d[i + 1]));
          return v;
        })(),
      },
    });
    this.m.dofComposite = mat(DOF_COMPOSITE, {
      tColor: { value: this.scene.texture },
      tBlur: { value: this.gather.texture },
      halfTexel: { value: new THREE.Vector2(1 / hw, 1 / hh) },
    });
    this.m.copy = mat(COPY, { tColor: { value: this.scene.texture } });
    this.m.bloomPre = mat(BLOOM_PREFILTER, {
      tColor: { value: this.composite.texture },
      srcTexel: { value: new THREE.Vector2(0.5 / width, 0.5 / height) },
      threshold: { value: opts.bloom.threshold },
      knee: { value: opts.bloom.knee },
    });
    this.m.down = mat(BLOOM_DOWN, {
      tColor: { value: null },
      srcTexel: { value: new THREE.Vector2() },
    });
    this.m.up = mat(BLOOM_UP, {
      tColor: { value: null },
      tBase: { value: null },
      srcTexel: { value: new THREE.Vector2() },
      scatter: { value: 0.85 },
    });
    const g = opts.grade;
    this.m.final = mat(FINAL, {
      tColor: { value: this.composite.texture },
      tBloom: { value: this.ups[0].texture },
      resolution: { value: new THREE.Vector2(width, height) },
      bloomIntensity: { value: opts.bloom.intensity },
      exposure: { value: g.exposure },
      saturation: { value: g.saturation },
      contrast: { value: g.contrast },
      tint: { value: new THREE.Vector3(...g.tint) },
      lift: { value: new THREE.Vector3(...g.lift) },
      vigStrength: { value: opts.vignette.strength },
      vigRadius: { value: opts.vignette.radius },
      vigSoft: { value: opts.vignette.softness },
      caPx: { value: (opts.ca ?? 0) * this.px },
      grain: { value: opts.grain },
      gframe: { value: 0 },
    });
  }

  // Renders `scene` through the chain. `focus` is the view-space distance
  // that is sharp. `overlay` may draw additive sharp layers into
  // `this.composite` after DoF and before bloom.
  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    frame: number,
    focus: number,
    overlay?: (target: THREE.WebGLRenderTarget) => void,
  ) {
    const r = this.renderer;
    r.setRenderTarget(this.scene);
    r.setClearColor(this.opts.clearColor ?? 0x000000, 1);
    r.clear(true, true, false);
    r.render(scene, camera);

    if (this.opts.dof) {
      const u = this.m.prefilter.uniforms;
      u.cNear.value = camera.near;
      u.cFar.value = camera.far;
      u.focus.value = focus;
      this.quad.run(r, this.m.prefilter, this.half);
      this.quad.run(r, this.m.gather, this.gather);
      this.quad.run(r, this.m.dofComposite, this.composite);
    } else {
      this.quad.run(r, this.m.copy, this.composite);
    }

    if (overlay) {
      r.setRenderTarget(this.composite);
      overlay(this.composite);
    }

    // Bloom.
    this.quad.run(r, this.m.bloomPre, this.mips[0]);
    for (let i = 1; i < this.mips.length; i++) {
      const src = this.mips[i - 1];
      this.m.down.uniforms.tColor.value = src.texture;
      this.m.down.uniforms.srcTexel.value.set(1 / src.width, 1 / src.height);
      this.quad.run(r, this.m.down, this.mips[i]);
    }
    const last = this.mips.length - 1;
    // Start the up chain from the smallest level.
    this.m.down.uniforms.tColor.value = this.mips[last].texture;
    this.m.down.uniforms.srcTexel.value.set(0, 0);
    this.quad.run(r, this.m.down, this.ups[last]);
    for (let i = last - 1; i >= 0; i--) {
      const small = this.ups[i + 1];
      this.m.up.uniforms.tColor.value = small.texture;
      this.m.up.uniforms.tBase.value = this.mips[i].texture;
      this.m.up.uniforms.srcTexel.value.set(1 / small.width, 1 / small.height);
      this.quad.run(r, this.m.up, this.ups[i]);
    }

    this.m.final.uniforms.gframe.value = frame % this.opts.loop;
    this.quad.run(r, this.m.final, null);
  }

  dispose() {
    for (const t of [
      this.scene,
      this.composite,
      this.half,
      this.gather,
      ...this.mips,
      ...this.ups,
    ])
      t.dispose();
    for (const m of Object.values(this.m)) m.dispose();
  }
}
