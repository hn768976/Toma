import * as THREE from "three";

// Small hand-written post pipeline: depth pre-pass, blur pyramid,
// depth-of-field by mip gathering, bloom, filmic curve, dither + grain.
// No temporal accumulation of any kind: every frame stands alone.
const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DOWN = /* glsl */ `
uniform sampler2D src; uniform vec2 texel; varying vec2 vUv;
void main() {
  vec4 c = texture2D(src, vUv + texel * vec2(-1.0, -1.0)) + texture2D(src, vUv + texel * vec2(1.0, -1.0))
         + texture2D(src, vUv + texel * vec2(-1.0, 1.0)) + texture2D(src, vUv + texel * vec2(1.0, 1.0));
  gl_FragColor = c * 0.25;
}
`;

// Box-resample a large frame down to the 720p-equivalent base (4x4 bilinear taps
// across the source footprint), so blur radii are a fixed fraction of the frame
// at any output resolution.
const RESAMPLE = /* glsl */ `
uniform sampler2D src; uniform vec2 footprint; varying vec2 vUv;
void main() {
  vec4 c = vec4(0.0);
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 o = (vec2(float(x), float(y)) + 0.5) / 4.0 - 0.5;
      c += texture2D(src, vUv + o * footprint);
    }
  }
  gl_FragColor = c / 16.0;
}
`;

const BLUR = /* glsl */ `
uniform sampler2D src; uniform vec2 dir; varying vec2 vUv;
void main() {
  vec4 c = texture2D(src, vUv) * 0.2270270270;
  c += (texture2D(src, vUv + dir * 1.3846153846) + texture2D(src, vUv - dir * 1.3846153846)) * 0.3162162162;
  c += (texture2D(src, vUv + dir * 3.2307692308) + texture2D(src, vUv - dir * 3.2307692308)) * 0.0702702703;
  gl_FragColor = c;
}
`;

const FINAL = /* glsl */ `
uniform sampler2D sharp; uniform sampler2D b1; uniform sampler2D b2; uniform sampler2D b3; uniform sampler2D b4;
uniform sampler2D depthTex; uniform sampler2D front; uniform sampler2D frontGlow; uniform sampler2D hud; uniform float hasHud; uniform float cameraNear; uniform float cameraFar;
uniform float focus; uniform float focusRange; uniform float frame; uniform float exposure;
uniform float bloom;
varying vec2 vUv;

float linDepth(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
}
uint hashu(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float hash3(vec3 p) {
  uvec3 q = uvec3(ivec3(p));
  return float(hashu(q.x ^ hashu(q.y ^ hashu(q.z)))) / 4294967295.0;
}
void main() {
  float d = linDepth(texture2D(depthTex, vUv).x);
  // Near objects closer than focus blur less than far ones (front row stays crisp).
  float off = d - focus;
  // in-focus band of +-2m around the front row, then ramps
  float coc = off > 0.0 ? clamp((off - 2.0) / focusRange, 0.0, 1.0) : clamp((-off * 2.0 - 1.5) / focusRange, 0.0, 1.0);
  float lod = coc * 3.2;
  vec3 c0 = texture2D(sharp, vUv).rgb;
  vec3 c1 = texture2D(b1, vUv).rgb;
  vec3 c2 = texture2D(b2, vUv).rgb;
  vec3 c3 = texture2D(b3, vUv).rgb;
  vec3 c4 = texture2D(b4, vUv).rgb;
  vec3 col = lod < 1.0 ? mix(c0, c1, lod) : lod < 2.0 ? mix(c1, c2, lod - 1.0) : mix(c2, c3, clamp(lod - 2.0, 0.0, 1.0));
  vec3 bl = max(c1 - 0.08, 0.0) * 0.6 + max(c2 - 0.06, 0.0) * 0.6 + max(c3 - 0.05, 0.0) * 0.4 + max(c4 - 0.04, 0.0) * 0.4;
  col += bl * bloom;
  // front-row figures: rendered separately (sharp), with their own tight glow
  col += texture2D(front, vUv).rgb + texture2D(frontGlow, vUv).rgb * 0.35;
  // lifted, slightly teal-olive shadows (atmosphere)
  col += vec3(0.0035, 0.0065, 0.0055) * (0.6 + 0.6 * vUv.y);
  // vignette
  vec2 vq = vUv - 0.5;
  col *= 1.0 - 0.55 * smoothstep(0.25, 0.75, length(vq * vec2(1.1, 1.35)));
  col = vec3(1.0) - exp(-col * exposure);
  col = pow(col, vec3(1.0 / 2.2));
  // crisp HUD overlay (rendered with MSAA, added on top of the graded image)
  col += pow(max(texture2D(hud, vUv).rgb, 0.0), vec3(1.0 / 2.2)) * hasHud;
  // grain ~1.5% p-p + TPDF dither of +-1/255, from pixel position and frame only
  vec2 px = floor(gl_FragCoord.xy);
  float h1 = hash3(vec3(px, frame * 2.0));
  float h2 = hash3(vec3(px, frame * 2.0 + 1.0));
  col += (h1 + h2 - 1.0) * (1.0 / 255.0);
  col += (hash3(vec3(px.yx, frame + 7919.0)) - 0.5) * 0.015;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const quad = new THREE.PlaneGeometry(2, 2);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const pass = (frag: string, uniforms: Record<string, THREE.IUniform>) => {
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(quad, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mat, scene };
};

const rt = (w: number, h: number, samples = 0) =>
  new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, samples, depthBuffer: samples > 0 });

export class HoloPipeline {
  w = 0;
  h = 0;
  sceneRT!: THREE.WebGLRenderTarget;
  frontRT!: THREE.WebGLRenderTarget;
  hudRT!: THREE.WebGLRenderTarget;
  frontA!: THREE.WebGLRenderTarget;
  frontB!: THREE.WebGLRenderTarget;
  depthRT!: THREE.WebGLRenderTarget;
  levels: { a: THREE.WebGLRenderTarget; b: THREE.WebGLRenderTarget }[] = [];
  down = pass(DOWN, { src: { value: null }, texel: { value: new THREE.Vector2() } });
  resample = pass(RESAMPLE, { src: { value: null }, footprint: { value: new THREE.Vector2() } });
  baseRT: THREE.WebGLRenderTarget | null = null;
  frontBaseRT: THREE.WebGLRenderTarget | null = null;
  blur = pass(BLUR, { src: { value: null }, dir: { value: new THREE.Vector2() } });
  final = pass(FINAL, {
    sharp: { value: null }, b1: { value: null }, b2: { value: null }, b3: { value: null }, b4: { value: null },
    depthTex: { value: null }, front: { value: null }, frontGlow: { value: null }, hud: { value: null }, hasHud: { value: 0 }, cameraNear: { value: 0.1 }, cameraFar: { value: 100 }, focus: { value: 8 }, focusRange: { value: 6 },
    frame: { value: 0 }, exposure: { value: 1.25 }, bloom: { value: 0.14 },
  });
  depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });

  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.dispose();
    this.w = w;
    this.h = h;
    this.sceneRT = rt(w, h, 4);
    this.frontRT = rt(w, h, 4);
    this.hudRT = rt(w, h, 4);
    // everything blurred is built from a 720p-equivalent base
    const bh = Math.min(h, 720);
    const bw = Math.max(1, Math.round((w * bh) / h));
    this.baseRT = h > 720 ? rt(bw, bh) : null;
    this.frontBaseRT = h > 720 ? rt(bw, bh) : null;
    this.frontA = rt(Math.max(1, Math.round(bw / 2)), Math.max(1, Math.round(bh / 2)));
    this.frontB = rt(Math.max(1, Math.round(bw / 2)), Math.max(1, Math.round(bh / 2)));
    this.depthRT = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true });
    this.depthRT.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    this.levels = [];
    let lw = bw;
    let lh = bh;
    for (let i = 0; i < 4; i++) {
      lw = Math.max(1, Math.round(lw / 2));
      lh = Math.max(1, Math.round(lh / 2));
      this.levels.push({ a: rt(lw, lh), b: rt(lw, lh) });
    }
  }

  dispose() {
    this.sceneRT?.dispose();
    this.frontRT?.dispose();
    this.hudRT?.dispose();
    this.frontA?.dispose();
    this.frontB?.dispose();
    this.baseRT?.dispose();
    this.frontBaseRT?.dispose();
    this.depthRT?.dispose();
    this.levels.forEach((l) => {
      l.a.dispose();
      l.b.dispose();
    });
  }

  private toBase(gl: THREE.WebGLRenderer, tex: THREE.Texture, target: THREE.WebGLRenderTarget | null) {
    if (!target) return { tex, w: this.w, h: this.h };
    this.resample.mat.uniforms.src.value = tex;
    this.resample.mat.uniforms.footprint.value.set(1 / target.width, 1 / target.height);
    gl.setRenderTarget(target);
    gl.render(this.resample.scene, ortho);
    return { tex: target.texture, w: target.width, h: target.height };
  }

  render(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    opts: { frame: number; focus: number; focusRange: number; depthLayer: number; frontLayer: number },
    overlay?: THREE.Scene,
  ) {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    this.resize(size.x, size.y);
    gl.autoClear = true;
    gl.setClearColor(0x000000, 1);

    // 1) depth pre-pass of solid proxies (figures, platforms, floor, tags)
    camera.layers.set(opts.depthLayer);
    scene.overrideMaterial = this.depthOnly;
    gl.setRenderTarget(this.depthRT);
    gl.clear();
    gl.render(scene, camera);
    scene.overrideMaterial = null;
    camera.layers.set(0);

    // 2) colour pass without the front row (MSAA, linear HDR) ...
    gl.setRenderTarget(this.sceneRT);
    gl.clear();
    gl.render(scene, camera);
    // ... and the front row alone, so the DoF blur never smears it into a halo
    camera.layers.set(opts.frontLayer);
    gl.setRenderTarget(this.frontRT);
    gl.clear();
    gl.render(scene, camera);
    camera.layers.set(0);
    // tight glow for the front row: base res / 2, one blur
    const frontSrc = this.toBase(gl, this.frontRT.texture, this.frontBaseRT);
    this.down.mat.uniforms.src.value = frontSrc.tex;
    this.down.mat.uniforms.texel.value.set(0.5 / frontSrc.w, 0.5 / frontSrc.h);
    gl.setRenderTarget(this.frontA);
    gl.render(this.down.scene, ortho);
    this.blur.mat.uniforms.src.value = this.frontA.texture;
    this.blur.mat.uniforms.dir.value.set(1 / this.frontA.width, 0);
    gl.setRenderTarget(this.frontB);
    gl.render(this.blur.scene, ortho);
    this.blur.mat.uniforms.src.value = this.frontB.texture;
    this.blur.mat.uniforms.dir.value.set(0, 1 / this.frontA.height);
    gl.setRenderTarget(this.frontA);
    gl.render(this.blur.scene, ortho);

    // 3) blur pyramid (from the 720p-equivalent base)
    const base = this.toBase(gl, this.sceneRT.texture, this.baseRT);
    let src: THREE.Texture = base.tex;
    let sw = base.w;
    let sh = base.h;
    for (const l of this.levels) {
      this.down.mat.uniforms.src.value = src;
      this.down.mat.uniforms.texel.value.set(0.5 / sw, 0.5 / sh);
      gl.setRenderTarget(l.a);
      gl.render(this.down.scene, ortho);
      const lw = l.a.width;
      const lh = l.a.height;
      this.blur.mat.uniforms.src.value = l.a.texture;
      this.blur.mat.uniforms.dir.value.set(1 / lw, 0);
      gl.setRenderTarget(l.b);
      gl.render(this.blur.scene, ortho);
      this.blur.mat.uniforms.src.value = l.b.texture;
      this.blur.mat.uniforms.dir.value.set(0, 1 / lh);
      gl.setRenderTarget(l.a);
      gl.render(this.blur.scene, ortho);
      src = l.a.texture;
      sw = lw;
      sh = lh;
    }

    // 4) composite to screen
    const u = this.final.mat.uniforms;
    u.sharp.value = this.sceneRT.texture;
    u.b1.value = this.levels[0].a.texture;
    u.b2.value = this.levels[1].a.texture;
    u.b3.value = this.levels[2].a.texture;
    u.b4.value = this.levels[3].a.texture;
    u.depthTex.value = this.depthRT.depthTexture;
    u.front.value = this.frontRT.texture;
    u.frontGlow.value = this.frontA.texture;
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    u.focus.value = opts.focus;
    u.focusRange.value = opts.focusRange;
    u.frame.value = opts.frame;
    // 5) crisp HUD overlay (tags, leader lines), composited in the final pass
    u.hasHud.value = 0;
    if (overlay) {
      gl.setRenderTarget(this.hudRT);
      gl.clear();
      gl.render(overlay, camera);
      u.hud.value = this.hudRT.texture;
      u.hasHud.value = 1;
    }
    gl.setRenderTarget(null);
    gl.render(this.final.scene, ortho);
  }
}
