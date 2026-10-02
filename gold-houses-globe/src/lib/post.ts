import * as THREE from "three";

// Deterministic post pipeline, written by hand so every step is a pure
// function of the scene render and the frame number:
//   scene (HalfFloat, 4x MSAA, depth) -> [DOF gather at fixed res -> combine]
//   -> bloom mip chain -> exposure -> ACES/AgX -> grade -> sRGB -> grain + dither
// No temporal accumulation of any kind.

export type PostOptions = {
  exposure: number;
  tonemap: "aces" | "agx";
  bloom: {
    strength: number;
    threshold: number;
    knee: number;
    /** 0..1, weight of the wide (small mip) levels. */
    radius: number;
  };
  /** Depth of field. Distances in world units from the camera. */
  dof?: {
    focus: number;
    /** distance over which blur ramps to max (behind focus) */
    range: number;
    /** distance over which blur ramps to max (in front of focus) */
    nearRange?: number;
    /** max blur radius as a fraction of frame height */
    maxBlur: number;
    /** max blur in front of focus, fraction of frame height */
    maxNearBlur?: number;
  };
  /** grain amplitude, fraction of full scale (0.02 = 2%) */
  grain: number;
  /** grain pattern period in frames (loop length), 0 = never repeats */
  grainPeriod: number;
  grade?: {
    saturation?: number;
    /** multiplies the tonemapped colour (display space) */
    tint?: [number, number, number];
    /** 0..1 corner darkening */
    vignette?: number;
    /** lift added to blacks in display space, e.g. [0.01,0.008,0.005] */
    lift?: [number, number, number];
  };
};

const VERT = /* glsl */ `
precision highp float;
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const HEADER = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
`;

const PREFILTER = /* glsl */ `${HEADER}
uniform sampler2D tSrc;
uniform vec2 texel; // of source
uniform float threshold;
uniform float knee;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * texel).rgb; }
vec3 karis(vec3 c) { return c / (1.0 + max(c.r, max(c.g, c.b)) * 0.25); }
void main() {
  // 13-tap downsample (Jimenez 2014) with a Karis-style average on the
  // first level to stop single hot pixels from flickering.
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
  vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 col = karis(j + k + l + m) * 0.5 * 0.25
    + karis(a + b + d + e) * 0.125 * 0.25 + karis(b + c + e + f) * 0.125 * 0.25
    + karis(d + e + g + h) * 0.125 * 0.25 + karis(e + f + h + i) * 0.125 * 0.25;
  col = col / max(1.0 - max(col.r, max(col.g, col.b)) * 0.25, 0.05);
  float br = max(col.r, max(col.g, col.b));
  float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  rq = rq * rq / (4.0 * knee + 1e-5);
  float w = max(rq, br - threshold) / max(br, 1e-5);
  outColor = vec4(col * w, 1.0);
}`;

const DOWN = /* glsl */ `${HEADER}
uniform sampler2D tSrc;
uniform vec2 texel;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * texel).rgb; }
void main() {
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
  vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  outColor = vec4(col, 1.0);
}`;

const UP = /* glsl */ `${HEADER}
uniform sampler2D tSmall; // upsampled chain (smaller level)
uniform sampler2D tCur;   // this level's downsample
uniform vec2 texel;       // of tSmall
uniform float weight;     // weight of the smaller (wider) level
vec3 s(vec2 o) { return texture(tSmall, vUv + o * texel).rgb; }
void main() {
  vec3 t = s(vec2(0)) * 4.0
    + (s(vec2(-1, 0)) + s(vec2(1, 0)) + s(vec2(0, -1)) + s(vec2(0, 1))) * 2.0
    + s(vec2(-1, -1)) + s(vec2(1, -1)) + s(vec2(-1, 1)) + s(vec2(1, 1));
  t /= 16.0;
  outColor = vec4(texture(tCur, vUv).rgb + t * weight, 1.0);
}`;

const DOF_COMMON = /* glsl */ `
uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;
uniform float focus;
uniform float range;
uniform float nearRange;
uniform float maxBlur;     // fraction of height
uniform float maxNearBlur; // fraction of height
float linDepth(vec2 uv) {
  float d = texture(tDepth, uv).x;
  float z = d * 2.0 - 1.0;
  return 2.0 * cameraNear * cameraFar / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
}
// signed CoC as a fraction of frame height (negative = in front of focus)
float coc(float z) {
  if (z >= focus) return maxBlur * clamp((z - focus) / range, 0.0, 1.0);
  return -maxNearBlur * clamp((focus - z) / nearRange, 0.0, 1.0);
}
`;

const DOF_GATHER = /* glsl */ `${HEADER}
uniform sampler2D tColor;
uniform vec2 resolution; // of this (DOF) target
${DOF_COMMON}
const float GOLDEN = 2.39996323;
void main() {
  float cz = linDepth(vUv);
  float cc = abs(coc(cz)) * resolution.y; // centre blur in px
  vec3 col = texture(tColor, vUv).rgb;
  float tot = 1.0;
  float maxPx = max(maxBlur, maxNearBlur) * resolution.y;
  float radScale = max(0.5, maxPx / 14.0);
  float radius = radScale;
  float spread = cc;
  float ang = 0.0;
  for (int it = 0; it < 220; it++) {
    if (radius >= maxPx) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * radius / resolution;
    vec3 sc = texture(tColor, tc).rgb;
    float sz = linDepth(tc);
    float sc0 = coc(sz);
    float ss = abs(sc0) * resolution.y;
    if (sz > cz) ss = min(ss, cc * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, ss);
    col += mix(col / tot, sc, m);
    tot += 1.0;
    if (sc0 < 0.0) spread = max(spread, ss * m);
    radius += radScale / radius;
    ang += GOLDEN;
  }
  outColor = vec4(col / tot, spread / resolution.y);
}`;

const DOF_COMBINE = /* glsl */ `${HEADER}
uniform sampler2D tColor;
uniform sampler2D tDof;
uniform vec2 dofRes;
${DOF_COMMON}
void main() {
  vec3 sharp = texture(tColor, vUv).rgb;
  float z = linDepth(vUv);
  // joint-bilateral upsample of the low-res DOF: the 4 nearest DOF texels are
  // weighted by how close their depth is to this pixel's depth, so blurred
  // background never picks up sharp foreground colour along silhouettes.
  vec2 p = vUv * dofRes - 0.5;
  vec2 f = fract(p);
  vec2 b = floor(p);
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 uv = (b + o + 0.5) / dofRes;
    float bw = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);
    float zd = abs(linDepth(uv) - z) / max(z, 1e-3);
    float w = bw / (0.02 + zd * 40.0) + 1e-5;
    acc += texture(tDof, uv) * w;
    wsum += w;
  }
  vec4 blurred = acc / wsum;
  float c = max(abs(coc(z)), blurred.a) * dofRes.y; // px at DOF res
  float k = smoothstep(0.35, 1.5, c);
  outColor = vec4(mix(sharp, blurred.rgb, k), 1.0);
}`;

const FINAL = /* glsl */ `${HEADER}
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform float bloomStrength;
uniform float exposure;
uniform int tonemap;
uniform float grain;
uniform uint frame;
uniform float saturation;
uniform vec3 tint;
uniform vec3 lift;
uniform float vignette;
uniform vec2 resolution;

vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 color) {
  const mat3 ACESInputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(
    vec3(1.60475, -0.10208, -0.00327),
    vec3(-0.53108, 1.10813, -0.07276),
    vec3(-0.07367, -0.00605, 1.07602));
  color /= 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 agxContrast(vec3 x) {
  vec3 x2 = x * x; vec3 x4 = x2 * x2;
  return + 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agx(vec3 color) {
  const mat3 AgXInsetMatrix = mat3(
    vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 AgXOutsetMatrix = mat3(
    vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const float AgxMinEv = -12.47393;
  const float AgxMaxEv = 4.026069;
  color = AgXInsetMatrix * max(color, 1e-10);
  color = clamp(log2(color), AgxMinEv, AgxMaxEv);
  color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);
  color = agxContrast(color);
  color = AgXOutsetMatrix * color;
  color = pow(max(vec3(0.0), color), vec3(2.2));
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
// PCG hash: integer-exact, identical on every GPU/driver.
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float rnd(uvec2 p, uint f, uint salt) {
  return float(pcg(p.x + pcg(p.y + pcg(f * 4u + salt)))) / 4294967295.0;
}
void main() {
  vec3 c = texture(tColor, vUv).rgb + texture(tBloom, vUv).rgb * bloomStrength;
  c *= exposure;
  c = tonemap == 0 ? aces(c) : agx(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, saturation), 0.0) * tint + lift;
  vec2 q = vUv - 0.5;
  q.x *= resolution.x / resolution.y;
  c *= 1.0 - vignette * smoothstep(0.35, 1.05, length(q));
  c = toSRGB(clamp(c, 0.0, 1.0));
  uvec2 p = uvec2(gl_FragCoord.xy);
  // film grain, ~2% (triangular), slightly stronger in mid-tones
  float g = rnd(p, frame, 0u) + rnd(p, frame, 1u) - 1.0;
  c += g * grain * (0.6 + 0.8 * l * (1.0 - l));
  // +-1/255 triangular dither after tonemapping and sRGB encode
  float d = rnd(p, frame, 2u) + rnd(p, frame, 3u) - 1.0;
  c += d / 255.0;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.RawShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
  });

const rt = (w: number, h: number, extra: Partial<THREE.RenderTargetOptions> = {}) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...extra,
  });

const BLOOM_LEVELS = 7;
const DOF_HEIGHT = 540;

export class Post {
  readonly scene: THREE.WebGLRenderTarget;
  private dofRT?: THREE.WebGLRenderTarget;
  private combRT?: THREE.WebGLRenderTarget;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private m: Record<string, THREE.RawShaderMaterial>;

  constructor(
    private gl: THREE.WebGLRenderer,
    readonly width: number,
    readonly height: number,
    public opts: PostOptions,
  ) {
    const depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
    this.scene = rt(width, height, { samples: 4, depthBuffer: true, depthTexture });
    if (opts.dof) {
      const dh = Math.min(DOF_HEIGHT, height);
      this.dofRT = rt(Math.round((dh * width) / height), dh);
      this.combRT = rt(width, height);
    }
    let w = width, h = height;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
      this.down.push(rt(w, h));
      this.up.push(rt(w, h));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(geo);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    const dofU = () => ({
      tDepth: { value: depthTexture },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 100 },
      focus: { value: 1 },
      range: { value: 1 },
      nearRange: { value: 1 },
      maxBlur: { value: 0 },
      maxNearBlur: { value: 0 },
    });
    this.m = {
      prefilter: mat(PREFILTER, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1 }, knee: { value: 0.5 } }),
      down: mat(DOWN, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } }),
      up: mat(UP, { tSmall: { value: null }, tCur: { value: null }, texel: { value: new THREE.Vector2() }, weight: { value: 1 } }),
      gather: mat(DOF_GATHER, { tColor: { value: null }, resolution: { value: new THREE.Vector2() }, ...dofU() }),
      combine: mat(DOF_COMBINE, { tColor: { value: null }, tDof: { value: null }, dofRes: { value: new THREE.Vector2() }, ...dofU() }),
      final: mat(FINAL, {
        tColor: { value: null },
        tBloom: { value: null },
        bloomStrength: { value: 1 },
        exposure: { value: 1 },
        tonemap: { value: 0 },
        grain: { value: 0.02 },
        frame: { value: 0 },
        saturation: { value: 1 },
        tint: { value: new THREE.Vector3(1, 1, 1) },
        lift: { value: new THREE.Vector3(0, 0, 0) },
        vignette: { value: 0 },
        resolution: { value: new THREE.Vector2(width, height) },
      }),
    };
  }

  private pass(m: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = m;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  private setDof(m: THREE.RawShaderMaterial, cam: THREE.PerspectiveCamera) {
    const d = this.opts.dof!;
    const u = m.uniforms;
    u.cameraNear.value = cam.near;
    u.cameraFar.value = cam.far;
    u.focus.value = d.focus;
    u.range.value = d.range;
    u.nearRange.value = d.nearRange ?? d.range;
    u.maxBlur.value = d.maxBlur;
    u.maxNearBlur.value = d.maxNearBlur ?? d.maxBlur;
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, frame: number) {
    const gl = this.gl;
    const o = this.opts;
    gl.setRenderTarget(this.scene);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    let src: THREE.Texture = this.scene.texture;
    if (o.dof && this.dofRT && this.combRT) {
      const g = this.m.gather;
      g.uniforms.tColor.value = this.scene.texture;
      g.uniforms.resolution.value.set(this.dofRT.width, this.dofRT.height);
      this.setDof(g, camera);
      this.pass(g, this.dofRT);
      const c = this.m.combine;
      c.uniforms.tColor.value = this.scene.texture;
      c.uniforms.tDof.value = this.dofRT.texture;
      c.uniforms.dofRes.value.set(this.dofRT.width, this.dofRT.height);
      this.setDof(c, camera);
      this.pass(c, this.combRT);
      src = this.combRT.texture;
    }

    // bloom
    const pf = this.m.prefilter;
    pf.uniforms.tSrc.value = src;
    pf.uniforms.texel.value.set(1 / this.width, 1 / this.height);
    pf.uniforms.threshold.value = o.bloom.threshold;
    pf.uniforms.knee.value = o.bloom.knee;
    this.pass(pf, this.down[0]);
    for (let i = 1; i < BLOOM_LEVELS; i++) {
      const d = this.m.down;
      d.uniforms.tSrc.value = this.down[i - 1].texture;
      d.uniforms.texel.value.set(1 / this.down[i - 1].width, 1 / this.down[i - 1].height);
      this.pass(d, this.down[i]);
    }
    let small = this.down[BLOOM_LEVELS - 1];
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      const u = this.m.up;
      u.uniforms.tSmall.value = small.texture;
      u.uniforms.tCur.value = this.down[i].texture;
      u.uniforms.texel.value.set(1 / small.width, 1 / small.height);
      u.uniforms.weight.value = 0.35 + o.bloom.radius * 0.75;
      this.pass(u, this.up[i]);
      small = this.up[i];
    }

    const f = this.m.final;
    const gr = o.grade ?? {};
    f.uniforms.tColor.value = src;
    f.uniforms.tBloom.value = this.up[0].texture;
    f.uniforms.bloomStrength.value = o.bloom.strength / BLOOM_LEVELS;
    f.uniforms.exposure.value = o.exposure;
    f.uniforms.tonemap.value = o.tonemap === "aces" ? 0 : 1;
    f.uniforms.grain.value = o.grain;
    f.uniforms.frame.value = o.grainPeriod > 0 ? frame % o.grainPeriod : frame;
    f.uniforms.saturation.value = gr.saturation ?? 1;
    f.uniforms.tint.value.set(...(gr.tint ?? [1, 1, 1]));
    f.uniforms.lift.value.set(...(gr.lift ?? [0, 0, 0]));
    f.uniforms.vignette.value = gr.vignette ?? 0;
    this.pass(f, null);
  }

  dispose() {
    this.scene.dispose();
    this.dofRT?.dispose();
    this.combRT?.dispose();
    [...this.down, ...this.up].forEach((r) => r.dispose());
    Object.values(this.m).forEach((m) => m.dispose());
  }
}
