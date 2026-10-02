import * as THREE from "three";

// Resolution-independent post chain for the WebGL looks.
//   scene -> HDR target (HalfFloat, MSAA)
//   -> blur pyramid at fixed fractions of the screen height (so bloom and
//      depth-of-field look the same at 720p preview and 4K)
//   -> optional plane-based depth of field (circle of confusion from the
//      distance of the view ray to a ground plane, or from screen radius)
//   -> bloom composite, filmic curve, sRGB encode
//   -> +-1/255 triangular dither and ~2% grain from a hash of
//      (pixel, frame). Nothing temporal; every output pixel is a pure
//      function of the current frame.

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const DOWN = /* glsl */ `
precision highp float;
uniform sampler2D src; uniform vec2 texel; uniform float threshold; uniform float knee;
in vec2 vUv; out vec4 o;
vec3 pre(vec3 c){
  if (threshold <= 0.0) return c;
  float l = max(c.r, max(c.g, c.b));
  float s = clamp(l - threshold + knee, 0.0, 2.0 * knee);
  s = s * s / (4.0 * knee + 1e-5);
  float w = max(s, l - threshold) / max(l, 1e-5);
  return c * w;
}
void main(){
  vec3 a = texture(src, vUv + texel * vec2(-1.0,-1.0)).rgb;
  vec3 b = texture(src, vUv + texel * vec2( 1.0,-1.0)).rgb;
  vec3 c = texture(src, vUv + texel * vec2(-1.0, 1.0)).rgb;
  vec3 d = texture(src, vUv + texel * vec2( 1.0, 1.0)).rgb;
  vec3 e = texture(src, vUv).rgb;
  o = vec4(pre((a + b + c + d) * 0.125 + e * 0.5), 1.0);
}`;

const BLUR = /* glsl */ `
precision highp float;
uniform sampler2D src; uniform vec2 dir; in vec2 vUv; out vec4 o;
// 17-tap gaussian (sigma ~3 texels) using linear sampling.
void main(){
  const float W0 = 0.1335;
  const float O[4] = float[4](1.4588, 3.4048, 5.3518, 7.3020);
  const float W[4] = float[4](0.2298, 0.1215, 0.0436, 0.0106);
  vec3 c = texture(src, vUv).rgb * W0;
  for (int i = 0; i < 4; i++) {
    c += texture(src, vUv + dir * O[i]).rgb * W[i];
    c += texture(src, vUv - dir * O[i]).rgb * W[i];
  }
  o = vec4(c / (W0 + 2.0 * (0.2298 + 0.1215 + 0.0436 + 0.0106)), 1.0);
}`;

const COMPOSE = /* glsl */ `
precision highp float;
uniform sampler2D sharp; uniform sampler2D overlay; uniform float useOverlay;
uniform sampler2D d1; uniform sampler2D d2; uniform sampler2D d3;
uniform int dofMode; // 0 none, 1 ground plane, 2 radial, 3 depth pass
uniform sampler2D depthTex;
uniform mat4 invProj; uniform mat4 camWorld; uniform vec3 camPos;
uniform float focusDist; uniform float focusRange; uniform float dofStrength; uniform float planeY;
uniform vec2 radialCenter; uniform float radialInner; uniform float radialOuter; uniform float aspect;
in vec2 vUv; out vec4 o;
float coc(){
  if (dofMode == 1) {
    vec4 v = invProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 dir = normalize((camWorld * vec4(normalize(v.xyz / v.w), 0.0)).xyz);
    float t = dir.y < -1e-4 ? (planeY - camPos.y) / dir.y : 1e4;
    float dist = min(t, 1e4);
    return clamp(abs(dist - focusDist) / focusRange, 0.0, 1.0) * dofStrength;
  }
  if (dofMode == 2) {
    vec2 p = (vUv - radialCenter) * vec2(aspect, 1.0);
    return smoothstep(radialInner, radialOuter, length(p)) * dofStrength;
  }
  if (dofMode == 3) {
    float dist = texture(depthTex, vUv).r;
    if (dist <= 0.0) dist = 1e4;
    return clamp(abs(dist - focusDist) / focusRange, 0.0, 1.0) * dofStrength;
  }
  return 0.0;
}
void main(){
  vec3 c = texture(sharp, vUv).rgb;
  float k = coc();
  if (k > 0.0) {
    vec3 l1 = texture(d1, vUv).rgb, l2 = texture(d2, vUv).rgb, l3 = texture(d3, vUv).rgb;
    float s = k * 3.0;
    c = s < 1.0 ? mix(c, l1, s) : s < 2.0 ? mix(l1, l2, s - 1.0) : mix(l2, l3, s - 2.0);
  }
  if (useOverlay > 0.5) c += texture(overlay, vUv).rgb;
  o = vec4(c, 1.0);
}`;

const FINAL = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D comp;
uniform sampler2D b1; uniform sampler2D b2; uniform sampler2D b3; uniform sampler2D b4; uniform sampler2D b5;
uniform vec4 bloomW; uniform float bloomW5; uniform float bloomStrength;
uniform float aspect;
uniform float exposure; uniform uint seed; uniform float grain; uniform vec3 lift;
uniform float vignette;
in vec2 vUv; out vec4 o;

uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float rnd(uvec3 p){ return float(pcg(p.x + pcg(p.y + pcg(p.z)))) / 4294967295.0; }
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSrgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }

void main(){
  vec3 c = texture(comp, vUv).rgb;
  vec3 bl = texture(b1, vUv).rgb * bloomW.x + texture(b2, vUv).rgb * bloomW.y +
            texture(b3, vUv).rgb * bloomW.z + texture(b4, vUv).rgb * bloomW.w +
            texture(b5, vUv).rgb * bloomW5;
  c += bl * bloomStrength;
  vec2 q = vUv - 0.5; q.x *= aspect;
  c *= 1.0 - vignette * dot(q, q);
  c = aces(c * exposure) + lift;
  c = toSrgb(clamp(c, 0.0, 1.0));
  uvec2 px = uvec2(gl_FragCoord.xy);
  // ~2% grain (symmetric) + triangular dither of +-1/255, after bloom.
  float g = (rnd(uvec3(px, seed)) + rnd(uvec3(px + 9187u, seed + 31u)) - 1.0) * grain;
  float d = (rnd(uvec3(px + 3301u, seed + 7u)) + rnd(uvec3(px + 1777u, seed + 13u)) - 1.0) / 255.0;
  o = vec4(c + g + d, 1.0);
}`;

export type DofSettings =
  | { mode: "none" }
  | { mode: "plane"; focusDist: number; focusRange: number; strength: number; planeY?: number }
  | { mode: "depth"; focusDist: number; focusRange: number; strength: number }
  | { mode: "radial"; center: [number, number]; inner: number; outer: number; strength: number };

export type PostSettings = {
  bloomStrength: number;
  bloomThreshold: number;
  bloomWeights: [number, number, number, number, number];
  exposure: number;
  grain: number;
  vignette: number;
  lift: [number, number, number];
  dof: DofSettings;
};

const mkRT = (w: number, h: number, samples = 0) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: samples > 0,
    samples,
    colorSpace: THREE.LinearSRGBColorSpace,
  });

export class PostFX {
  private scene: THREE.WebGLRenderTarget;
  private overlay: THREE.WebGLRenderTarget;
  private comp: THREE.WebGLRenderTarget;
  private compose: THREE.ShaderMaterial;
  private depth: THREE.WebGLRenderTarget;
  private depthMat: THREE.ShaderMaterial;
  private levels: { a: THREE.WebGLRenderTarget; b: THREE.WebGLRenderTarget }[] = [];
  private dofLevels: { a: THREE.WebGLRenderTarget; b: THREE.WebGLRenderTarget }[] = [];
  private quad: THREE.Mesh;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private fsScene = new THREE.Scene();
  private down: THREE.RawShaderMaterial | THREE.ShaderMaterial;
  private blur: THREE.ShaderMaterial;
  private final: THREE.ShaderMaterial;
  private w: number;
  private h: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.scene = mkRT(w, h, 4);
    this.overlay = mkRT(w, h, 4);
    this.comp = mkRT(w, h);
    this.depth = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.FloatType,
      format: THREE.RedFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    // view distance of the nearest surface (used for depth-based DOF)
    this.depthMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `out vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `precision highp float; in vec3 vP; out vec4 o; void main(){ o = vec4(length(vP), 0.0, 0.0, 1.0); }`,
      side: THREE.DoubleSide,
    });
    for (let k = 0; k < 5; k++) {
      const lh = Math.round(h / 2 ** (k + 1));
      const lw = Math.round(w / 2 ** (k + 1));
      this.levels.push({ a: mkRT(lw, lh), b: mkRT(lw, lh) });
    }
    for (let k = 0; k < 3; k++) {
      const lh = Math.round(h / 2 ** (k + 1));
      const lw = Math.round(w / 2 ** (k + 1));
      this.dofLevels.push({ a: mkRT(lw, lh), b: mkRT(lw, lh) });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERT,
        fragmentShader: frag,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });
    this.down = mk(DOWN, {
      src: { value: null },
      texel: { value: new THREE.Vector2() },
      threshold: { value: 0 },
      knee: { value: 0.5 },
    });
    this.blur = mk(BLUR, { src: { value: null }, dir: { value: new THREE.Vector2() } });
    this.compose = mk(COMPOSE, {
      sharp: { value: null },
      depthTex: { value: null },
      overlay: { value: null },
      useOverlay: { value: 0 },
      d1: { value: null },
      d2: { value: null },
      d3: { value: null },
      dofMode: { value: 0 },
      invProj: { value: new THREE.Matrix4() },
      camWorld: { value: new THREE.Matrix4() },
      camPos: { value: new THREE.Vector3() },
      focusDist: { value: 10 },
      planeY: { value: 0 },
      focusRange: { value: 10 },
      dofStrength: { value: 0 },
      radialCenter: { value: new THREE.Vector2(0.5, 0.5) },
      radialInner: { value: 0.3 },
      radialOuter: { value: 0.8 },
      aspect: { value: w / h },
    });
    this.final = mk(FINAL, {
      comp: { value: null },
      b1: { value: null },
      b2: { value: null },
      b3: { value: null },
      b4: { value: null },
      b5: { value: null },
      bloomW: { value: new THREE.Vector4() },
      bloomW5: { value: 0 },
      bloomStrength: { value: 1 },
      aspect: { value: w / h },
      exposure: { value: 1 },
      seed: { value: 0 },
      grain: { value: 0.02 },
      lift: { value: new THREE.Vector3() },
      vignette: { value: 0 },
    });

    this.quad = new THREE.Mesh(g, this.final);
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);
  }

  private pass(r: THREE.WebGLRenderer, mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    r.setRenderTarget(target);
    r.render(this.fsScene, this.cam);
  }

  // Downsample `src` into a pyramid and blur every level.
  private pyramid(
    r: THREE.WebGLRenderer,
    src: THREE.WebGLRenderTarget,
    levels: { a: THREE.WebGLRenderTarget; b: THREE.WebGLRenderTarget }[],
    threshold: number,
  ) {
    let prev = src;
    levels.forEach((lv, i) => {
      const u = this.down.uniforms;
      u.src.value = prev.texture;
      u.texel.value.set(0.5 / prev.width, 0.5 / prev.height);
      u.threshold.value = i === 0 ? threshold : 0;
      this.pass(r, this.down, lv.a);
      const bu = this.blur.uniforms;
      bu.src.value = lv.a.texture;
      bu.dir.value.set(1 / lv.a.width, 0);
      this.pass(r, this.blur, lv.b);
      bu.src.value = lv.b.texture;
      bu.dir.value.set(0, 1 / lv.a.height);
      this.pass(r, this.blur, lv.a);
      prev = lv.a;
    });
  }

  // Objects on layer 1 form an overlay that is NOT post-blurred (they carry
  // their own per-vertex defocus) and is added before bloom.
  render(
    r: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    s: PostSettings,
    seed: number,
    useOverlay = false,
  ) {
    r.autoClear = true;
    camera.layers.set(0);
    r.setRenderTarget(this.scene);
    r.clear();
    r.render(scene, camera);
    if (useOverlay) {
      const bg = scene.background;
      scene.background = null;
      r.setClearColor(0x000000, 1);
      camera.layers.set(1);
      r.setRenderTarget(this.overlay);
      r.clear();
      r.render(scene, camera);
      camera.layers.set(0);
      scene.background = bg;
    }

    if (s.dof.mode === "depth") {
      scene.overrideMaterial = this.depthMat;
      const bg = scene.background;
      scene.background = null;
      r.setClearColor(0x000000, 0);
      r.setRenderTarget(this.depth);
      r.clear();
      r.render(scene, camera);
      scene.overrideMaterial = null;
      scene.background = bg;
    }
    const cu = this.compose.uniforms;
    cu.depthTex.value = this.depth.texture;
    if (s.dof.mode !== "none") this.pyramid(r, this.scene, this.dofLevels, 0);
    cu.sharp.value = this.scene.texture;
    cu.overlay.value = this.overlay.texture;
    cu.useOverlay.value = useOverlay ? 1 : 0;
    cu.d1.value = this.dofLevels[0].a.texture;
    cu.d2.value = this.dofLevels[1].a.texture;
    cu.d3.value = this.dofLevels[2].a.texture;
    cu.aspect.value = this.w / this.h;
    camera.updateMatrixWorld();
    if (s.dof.mode === "plane") {
      cu.dofMode.value = 1;
      cu.invProj.value.copy(camera.projectionMatrixInverse);
      cu.camWorld.value.copy(camera.matrixWorld);
      cu.camPos.value.copy(camera.position);
      cu.focusDist.value = s.dof.focusDist;
      cu.planeY.value = s.dof.planeY ?? 0;
      cu.focusRange.value = s.dof.focusRange;
      cu.dofStrength.value = s.dof.strength;
    } else if (s.dof.mode === "depth") {
      cu.dofMode.value = 3;
      cu.focusDist.value = s.dof.focusDist;
      cu.focusRange.value = s.dof.focusRange;
      cu.dofStrength.value = s.dof.strength;
    } else if (s.dof.mode === "radial") {
      cu.dofMode.value = 2;
      cu.radialCenter.value.set(...s.dof.center);
      cu.radialInner.value = s.dof.inner;
      cu.radialOuter.value = s.dof.outer;
      cu.dofStrength.value = s.dof.strength;
    } else {
      cu.dofMode.value = 0;
    }
    this.pass(r, this.compose, this.comp);

    this.pyramid(r, this.comp, this.levels, s.bloomThreshold);
    const u = this.final.uniforms;
    u.comp.value = this.comp.texture;
    ["b1", "b2", "b3", "b4", "b5"].forEach((k, i) => (u[k].value = this.levels[i].a.texture));
    const bw = s.bloomWeights;
    u.bloomW.value.set(bw[0], bw[1], bw[2], bw[3]);
    u.bloomW5.value = bw[4];
    u.bloomStrength.value = s.bloomStrength;
    u.exposure.value = s.exposure;
    u.grain.value = s.grain;
    u.vignette.value = s.vignette;
    u.lift.value.set(...s.lift);
    u.seed.value = seed >>> 0;
    u.aspect.value = this.w / this.h;
    this.pass(r, this.final, null);
  }

  dispose() {
    this.scene.dispose();
    this.overlay.dispose();
    this.depth.dispose();
    this.comp.dispose();
    [...this.levels, ...this.dofLevels].forEach((l) => {
      l.a.dispose();
      l.b.dispose();
    });
  }
}
