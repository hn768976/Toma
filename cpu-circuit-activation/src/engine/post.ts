import * as THREE from "three";

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** Depth of field: golden-angle disc gather. CoC is stored in alpha for the second (refining) pass. */
const DOF_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform float uNear; uniform float uFar; uniform float uFocus; uniform float uAperture;
uniform float uAspect; uniform float uPass; uniform float uSeed;
const int TAPS = 40;
float viewZ(vec2 uv){
  float d = texture2D(tDepth, uv).x;
  float ndc = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - ndc * (uFar - uNear));
}
float cocAt(vec2 uv){
  if (uPass > 0.5) return texture2D(tColor, uv).a;
  float z = viewZ(uv);
  return min(uAperture * 0.02 * abs(z - uFocus) / z, 0.022);
}
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  float c0 = cocAt(vUv);
  float radius = c0 * (uPass > 0.5 ? 0.3 : 1.0);
  vec3 sum = texture2D(tColor, vUv).rgb; float wsum = 1.0;
  if (radius > 0.0004) {
    float rot = ign(gl_FragCoord.xy + uSeed) * 6.2831853;
    for (int i = 0; i < TAPS; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / float(TAPS));
      float a = fi * 2.39996323 + rot;
      vec2 o = vec2(cos(a) / uAspect, sin(a)) * r * radius;
      vec4 s = texture2D(tColor, vUv + o);
      float cs = uPass > 0.5 ? s.a : cocAt(vUv + o);
      // a sample only contributes if its own blur disc reaches this pixel
      float w = clamp((cs - r * radius * 0.6) / max(radius * 0.25, 1e-4) + 0.15, 0.0, 1.0);
      sum += s.rgb * w; wsum += w;
    }
  }
  gl_FragColor = vec4(sum / wsum, c0);
}`;

const BRIGHT_FRAG = /* glsl */ `
varying vec2 vUv; uniform sampler2D tColor; uniform float uThreshold; uniform vec2 uTexel;
void main(){
  vec3 c = vec3(0.0);
  c += texture2D(tColor, vUv + uTexel * vec2(-0.5, -0.5)).rgb;
  c += texture2D(tColor, vUv + uTexel * vec2(0.5, -0.5)).rgb;
  c += texture2D(tColor, vUv + uTexel * vec2(-0.5, 0.5)).rgb;
  c += texture2D(tColor, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  c *= 0.25;
  c = min(c, vec3(24.0));
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThreshold, uThreshold * 2.2, l);
  gl_FragColor = vec4(c * k, 1.0);
}`;

const BLUR_FRAG = /* glsl */ `
varying vec2 vUv; uniform sampler2D tColor; uniform vec2 uDir;
void main(){
  vec3 c = texture2D(tColor, vUv).rgb * 0.2270270270;
  c += (texture2D(tColor, vUv + uDir * 1.3846153846).rgb + texture2D(tColor, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
  c += (texture2D(tColor, vUv + uDir * 3.2307692308).rgb + texture2D(tColor, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}`;

const COPY_FRAG = /* glsl */ `
varying vec2 vUv; uniform sampler2D tColor;
void main(){ gl_FragColor = vec4(texture2D(tColor, vUv).rgb, 1.0); }`;

const FINAL_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tB0; uniform sampler2D tB1; uniform sampler2D tB2; uniform sampler2D tB3; uniform sampler2D tB4;
uniform float uBloom; uniform float uZoom; uniform vec2 uCenter; uniform float uExposure; uniform vec3 uTint;
uniform float uSaturation; uniform float uSeed; uniform float uAspect; uniform float uCA;
vec3 fetch(vec2 uv){
  vec3 c = texture2D(tColor, uv).rgb;
  vec3 b = texture2D(tB0, uv).rgb * 0.9 + texture2D(tB1, uv).rgb * 1.0 + texture2D(tB2, uv).rgb * 1.0 + texture2D(tB3, uv).rgb * 0.9 + texture2D(tB4, uv).rgb * 0.8;
  return c + b * uBloom * 0.22;
}
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 dir = vUv - uCenter;
  vec3 col;
  if (uZoom > 0.002) {
    col = vec3(0.0);
    float j = hash(gl_FragCoord.xy + uSeed);
    for (int i = 0; i < 14; i++) {
      float s = 1.0 - uZoom * (float(i) + j) / 14.0;
      col += fetch(uCenter + dir * s);
    }
    col /= 14.0;
  } else {
    col = fetch(vUv);
  }
  // gentle lens fringing towards the corners
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  float r2 = dot(q, q);
  vec2 ca = (vUv - 0.5) * r2 * uCA;
  col.r = mix(col.r, fetch(vUv + ca).r, 0.6);
  col.b = mix(col.b, fetch(vUv - ca).b, 0.6);
  col *= uExposure * uTint;
  col *= mix(1.0, 0.42, smoothstep(0.25, 1.15, r2));
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(l), col, uSaturation), 0.0);
  col = aces(col);
  col = pow(col, vec3(1.0 / 2.2));
  col += (hash(gl_FragCoord.xy * 0.71 + uSeed * 3.1) - 0.5) * 0.022;
  gl_FragColor = vec4(col, 1.0);
}`;

export type PostParams = {
  near: number;
  far: number;
  focus: number;
  aperture: number;
  bloom: number;
  zoom: number;
  center: [number, number];
  exposure: number;
  tint: [number, number, number];
  saturation: number;
  seed: number;
};

/** HDR scene target -> depth of field -> overlay -> bloom -> grade. */
export class Post {
  scene: THREE.WebGLRenderTarget;
  private dofA: THREE.WebGLRenderTarget;
  private dofB: THREE.WebGLRenderTarget;
  private mips: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget][] = [];
  private quad: THREE.Mesh;
  private qScene = new THREE.Scene();
  private qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mats: Record<string, THREE.ShaderMaterial>;
  private w = 0;
  private h = 0;

  constructor(private renderer: THREE.WebGLRenderer) {
    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    const u = (v: unknown) => ({ value: v });
    this.mats = {
      dof: mk(DOF_FRAG, {
        tColor: u(null), tDepth: u(null), uNear: u(0.1), uFar: u(400), uFocus: u(5), uAperture: u(1),
        uAspect: u(16 / 9), uPass: u(0), uSeed: u(0),
      }),
      bright: mk(BRIGHT_FRAG, { tColor: u(null), uThreshold: u(0.75), uTexel: u(new THREE.Vector2()) }),
      blur: mk(BLUR_FRAG, { tColor: u(null), uDir: u(new THREE.Vector2()) }),
      copy: mk(COPY_FRAG, { tColor: u(null) }),
      final: mk(FINAL_FRAG, {
        tColor: u(null), tB0: u(null), tB1: u(null), tB2: u(null), tB3: u(null), tB4: u(null),
        uBloom: u(1), uZoom: u(0), uCenter: u(new THREE.Vector2(0.5, 0.5)), uExposure: u(1),
        uTint: u(new THREE.Vector3(1, 1, 1)), uSaturation: u(1), uSeed: u(0), uAspect: u(16 / 9), uCA: u(0.012),
      }),
    };
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mats.copy);
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
    this.scene = this.makeTarget(4, 4, true);
    this.dofA = this.makeTarget(4, 4, false);
    this.dofB = this.makeTarget(4, 4, false);
  }

  private makeTarget(w: number, h: number, depth: boolean) {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: depth,
      samples: depth ? 4 : 0,
    });
    if (depth) {
      rt.depthTexture = new THREE.DepthTexture(w, h);
      rt.depthTexture.type = THREE.UnsignedIntType;
      rt.depthTexture.minFilter = THREE.NearestFilter;
      rt.depthTexture.magFilter = THREE.NearestFilter;
    }
    return rt;
  }

  setSize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.scene.setSize(w, h);
    this.dofA.setSize(w, h);
    this.dofB.setSize(w, h);
    for (const [a, b] of this.mips) {
      a.dispose();
      b.dispose();
    }
    this.mips = [];
    let mw = Math.max(2, Math.round(w / 2));
    let mh = Math.max(2, Math.round(h / 2));
    // fixed number of levels relative to the frame so 4K and 1080p bloom identically
    for (let i = 0; i < 5; i++) {
      this.mips.push([this.makeTarget(mw, mh, false), this.makeTarget(mw, mh, false)]);
      mw = Math.max(2, Math.round(mw / 2));
      mh = Math.max(2, Math.round(mh / 2));
    }
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qScene, this.qCam);
  }

  /** `overlay` is drawn additively on top of the depth-of-field result (pre-blurred bokeh dust). */
  render(p: PostParams, overlay: THREE.Scene, camera: THREE.Camera) {
    const { dof, bright, blur, copy, final } = this.mats;
    const aspect = this.w / this.h;
    dof.uniforms.tColor.value = this.scene.texture;
    dof.uniforms.tDepth.value = this.scene.depthTexture;
    dof.uniforms.uNear.value = p.near;
    dof.uniforms.uFar.value = p.far;
    dof.uniforms.uFocus.value = p.focus;
    dof.uniforms.uAperture.value = p.aperture;
    dof.uniforms.uAspect.value = aspect;
    dof.uniforms.uPass.value = 0;
    dof.uniforms.uSeed.value = p.seed;
    this.pass(dof, this.dofA);
    dof.uniforms.tColor.value = this.dofA.texture;
    dof.uniforms.uPass.value = 1;
    dof.uniforms.uSeed.value = p.seed + 17.3;
    this.pass(dof, this.dofB);

    this.renderer.setRenderTarget(this.dofB);
    const auto = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.render(overlay, camera);
    this.renderer.autoClear = auto;

    // bloom pyramid: each level is the blurred previous level at half size
    let src: THREE.Texture = this.dofB.texture;
    let sw = this.w;
    let sh = this.h;
    this.mips.forEach(([a, b], i) => {
      if (i === 0) {
        bright.uniforms.tColor.value = src;
        bright.uniforms.uTexel.value.set(1 / sw, 1 / sh);
        this.pass(bright, a);
      } else {
        copy.uniforms.tColor.value = src;
        this.pass(copy, a);
      }
      for (let k = 0; k < 2; k++) {
        blur.uniforms.tColor.value = a.texture;
        blur.uniforms.uDir.value.set(1 / a.width, 0);
        this.pass(blur, b);
        blur.uniforms.tColor.value = b.texture;
        blur.uniforms.uDir.value.set(0, 1 / a.height);
        this.pass(blur, a);
      }
      src = a.texture;
      sw = a.width;
      sh = a.height;
    });

    final.uniforms.tColor.value = this.dofB.texture;
    this.mips.forEach(([a], i) => (final.uniforms[`tB${i}`].value = a.texture));
    final.uniforms.uBloom.value = p.bloom;
    final.uniforms.uZoom.value = p.zoom;
    final.uniforms.uCenter.value.set(p.center[0], p.center[1]);
    final.uniforms.uExposure.value = p.exposure;
    final.uniforms.uTint.value.set(...p.tint);
    final.uniforms.uSaturation.value = p.saturation;
    final.uniforms.uSeed.value = p.seed;
    final.uniforms.uAspect.value = aspect;
    this.pass(final, null);
  }

  dispose() {
    this.scene.dispose();
    this.dofA.dispose();
    this.dofB.dispose();
    for (const [a, b] of this.mips) {
      a.dispose();
      b.dispose();
    }
    Object.values(this.mats).forEach((m) => m.dispose());
  }
}
