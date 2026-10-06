import * as THREE from "three";

// Treat every colour as display-referred: hex values in, same values out.
THREE.ColorManagement.enabled = false;

export type PostParams = {
  frame: number; // frame index for grain/dither (use frame % duration on loops)
  bloom: { strength: number; threshold: number; knee: number; radius?: number };
  dof?: {
    focus: number; // view-space distance in focus
    aperture: number; // CoC as fraction of frame height per unit |1 - focus/z|
    maxBlur: number; // max CoC as fraction of frame height
    nearScale?: number; // extra multiplier for things in front of focus
  };
  exposure?: number;
  vignette?: number;
  grain?: number; // peak amplitude, default 0.015
  lift?: [number, number, number]; // added before grain (black level tint)
};

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const DOWN13 = /* glsl */ `
vec3 down13(sampler2D t, vec2 uv, vec2 px) {
  vec3 a = texture(t, uv + px * vec2(-2.0, -2.0)).rgb;
  vec3 b = texture(t, uv + px * vec2( 0.0, -2.0)).rgb;
  vec3 c = texture(t, uv + px * vec2( 2.0, -2.0)).rgb;
  vec3 d = texture(t, uv + px * vec2(-2.0,  0.0)).rgb;
  vec3 e = texture(t, uv).rgb;
  vec3 f = texture(t, uv + px * vec2( 2.0,  0.0)).rgb;
  vec3 g = texture(t, uv + px * vec2(-2.0,  2.0)).rgb;
  vec3 h = texture(t, uv + px * vec2( 0.0,  2.0)).rgb;
  vec3 i = texture(t, uv + px * vec2( 2.0,  2.0)).rgb;
  vec3 j = texture(t, uv + px * vec2(-1.0, -1.0)).rgb;
  vec3 k = texture(t, uv + px * vec2( 1.0, -1.0)).rgb;
  vec3 l = texture(t, uv + px * vec2(-1.0,  1.0)).rgb;
  vec3 m = texture(t, uv + px * vec2( 1.0,  1.0)).rgb;
  vec3 o = e * 0.125;
  o += (a + c + g + i) * 0.03125;
  o += (b + d + f + h) * 0.0625;
  o += (j + k + l + m) * 0.125;
  return o;
}`;

const LINEAR_DEPTH = /* glsl */ `
uniform float uNear;
uniform float uFar;
float linDepth(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}
uniform float uFocus;
uniform float uAperture;
uniform float uMaxBlur;
uniform float uNearScale;
uniform float uHeight;
float cocPx(float d) {
  if (d >= 1.0) return uMaxBlur * uHeight; // background clear
  float z = linDepth(d);
  float k = 1.0 - uFocus / z;
  if (k < 0.0) k *= uNearScale;
  return min(abs(k) * uAperture, uMaxBlur) * uHeight;
}`;

const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const rt = (w: number, h: number, opts: Partial<THREE.RenderTargetOptions> = {}) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    ...opts,
  });

export class Post {
  readonly width: number;
  readonly height: number;
  private renderer: THREE.WebGLRenderer;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private rtScene: THREE.WebGLRenderTarget;
  private rtPre: THREE.WebGLRenderTarget;
  private rtGather: THREE.WebGLRenderTarget;
  private rtGather2: THREE.WebGLRenderTarget;
  private rtDof: THREE.WebGLRenderTarget;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private mPre: THREE.ShaderMaterial;
  private mGather: THREE.ShaderMaterial;
  private mTent: THREE.ShaderMaterial;
  private mDofComp: THREE.ShaderMaterial;
  private mBright: THREE.ShaderMaterial;
  private mDown: THREE.ShaderMaterial;
  private mUp: THREE.ShaderMaterial;
  private mFinal: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.renderer = renderer;
    this.width = width;
    this.height = height;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(geo);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    const depthTexture = new THREE.DepthTexture(width, height);
    depthTexture.type = THREE.UnsignedIntType;
    this.rtScene = rt(width, height, { samples: 4, depthBuffer: true, depthTexture });
    const hw = Math.ceil(width / 2);
    const hh = Math.ceil(height / 2);
    this.rtPre = rt(hw, hh);
    this.rtGather = rt(hw, hh);
    this.rtGather2 = rt(hw, hh);
    this.rtDof = rt(width, height);
    let w = width;
    let h = height;
    for (let i = 0; i < 7; i++) {
      w = Math.max(1, Math.ceil(w / 2));
      h = Math.max(1, Math.ceil(h / 2));
      this.down.push(rt(w, h));
      this.up.push(rt(w, h));
    }

    const depthUniforms = () => ({
      uNear: { value: 0.1 },
      uFar: { value: 100 },
      uFocus: { value: 10 },
      uAperture: { value: 0 },
      uMaxBlur: { value: 0 },
      uNearScale: { value: 1 },
      uHeight: { value: height },
    });

    this.mPre = mat(
      /* glsl */ `
      in vec2 vUv;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform vec2 uPx;
      ${LINEAR_DEPTH}
      void main() {
        vec3 c = texture(tColor, vUv + uPx * vec2(-0.5, -0.5)).rgb
               + texture(tColor, vUv + uPx * vec2( 0.5, -0.5)).rgb
               + texture(tColor, vUv + uPx * vec2(-0.5,  0.5)).rgb
               + texture(tColor, vUv + uPx * vec2( 0.5,  0.5)).rgb;
        float coc = cocPx(texture(tDepth, vUv).x);
        gl_FragColor = vec4(c * 0.25, coc);
      }`,
      { tColor: { value: null }, tDepth: { value: null }, uPx: { value: new THREE.Vector2() }, ...depthUniforms() },
    );

    this.mGather = mat(
      /* glsl */ `
      in vec2 vUv;
      uniform sampler2D tPre;
      uniform vec2 uPx; // half-res texel
      void main() {
        vec4 c = texture(tPre, vUv);
        float r = c.a * 0.5; // CoC radius in half-res pixels
        if (r < 0.5) { gl_FragColor = c; return; }
        vec3 acc = c.rgb;
        float wsum = 1.0;
        const int N = 64;
        for (int i = 0; i < N; i++) {
          float fi = float(i);
          float a = fi * 2.39996323;
          float rr = sqrt((fi + 0.5) / float(N)) * r;
          vec2 o = vec2(cos(a), sin(a)) * rr * uPx;
          vec4 s = texture(tPre, vUv + o);
          float sr = s.a * 0.5;
          float w = clamp(sr - rr + 1.0, 0.0, 1.0);
          acc += s.rgb * w;
          wsum += w;
        }
        gl_FragColor = vec4(acc / wsum, c.a);
      }`,
      { tPre: { value: null }, uPx: { value: new THREE.Vector2() } },
    );

    this.mTent = mat(
      /* glsl */ `
      in vec2 vUv;
      uniform sampler2D tSrc;
      uniform vec2 uPx;
      void main() {
        vec4 s = texture(tSrc, vUv) * 4.0;
        s += texture(tSrc, vUv + uPx * vec2(-1.0, 0.0)) * 2.0;
        s += texture(tSrc, vUv + uPx * vec2( 1.0, 0.0)) * 2.0;
        s += texture(tSrc, vUv + uPx * vec2( 0.0,-1.0)) * 2.0;
        s += texture(tSrc, vUv + uPx * vec2( 0.0, 1.0)) * 2.0;
        s += texture(tSrc, vUv + uPx * vec2(-1.0,-1.0));
        s += texture(tSrc, vUv + uPx * vec2( 1.0,-1.0));
        s += texture(tSrc, vUv + uPx * vec2(-1.0, 1.0));
        s += texture(tSrc, vUv + uPx * vec2( 1.0, 1.0));
        gl_FragColor = s / 16.0;
      }`,
      { tSrc: { value: null }, uPx: { value: new THREE.Vector2() } },
    );

    this.mDofComp = mat(
      /* glsl */ `
      in vec2 vUv;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform sampler2D tBlur;
      ${LINEAR_DEPTH}
      void main() {
        vec3 sharp = texture(tColor, vUv).rgb;
        vec3 blur = texture(tBlur, vUv).rgb;
        float coc = cocPx(texture(tDepth, vUv).x);
        float t = smoothstep(0.6, 2.2, coc);
        gl_FragColor = vec4(mix(sharp, blur, t), 1.0);
      }`,
      { tColor: { value: null }, tDepth: { value: null }, tBlur: { value: null }, ...depthUniforms() },
    );

    this.mBright = mat(
      /* glsl */ `
      in vec2 vUv;
      uniform sampler2D tSrc;
      uniform vec2 uPx;
      uniform float uThreshold;
      uniform float uKnee;
      ${DOWN13}
      void main() {
        vec3 c = down13(tSrc, vUv, uPx);
        float br = max(c.r, max(c.g, c.b));
        float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
        soft = soft * soft / (4.0 * uKnee + 1e-5);
        float contrib = max(soft, br - uThreshold) / max(br, 1e-5);
        gl_FragColor = vec4(c * contrib, 1.0);
      }`,
      { tSrc: { value: null }, uPx: { value: new THREE.Vector2() }, uThreshold: { value: 0.6 }, uKnee: { value: 0.3 } },
    );

    this.mDown = mat(
      /* glsl */ `
      in vec2 vUv;
      uniform sampler2D tSrc;
      uniform vec2 uPx;
      ${DOWN13}
      void main() { gl_FragColor = vec4(down13(tSrc, vUv, uPx), 1.0); }`,
      { tSrc: { value: null }, uPx: { value: new THREE.Vector2() } },
    );

    this.mUp = mat(
      /* glsl */ `
      in vec2 vUv;
      uniform sampler2D tSmall;
      uniform sampler2D tCur;
      uniform vec2 uPx; // texel of tSmall
      uniform float uRadius;
      void main() {
        vec2 o = uPx * uRadius;
        vec3 s = texture(tSmall, vUv).rgb * 4.0;
        s += texture(tSmall, vUv + vec2(-o.x, 0.0)).rgb * 2.0;
        s += texture(tSmall, vUv + vec2( o.x, 0.0)).rgb * 2.0;
        s += texture(tSmall, vUv + vec2(0.0, -o.y)).rgb * 2.0;
        s += texture(tSmall, vUv + vec2(0.0,  o.y)).rgb * 2.0;
        s += texture(tSmall, vUv + vec2(-o.x, -o.y)).rgb;
        s += texture(tSmall, vUv + vec2( o.x, -o.y)).rgb;
        s += texture(tSmall, vUv + vec2(-o.x,  o.y)).rgb;
        s += texture(tSmall, vUv + vec2( o.x,  o.y)).rgb;
        gl_FragColor = vec4(texture(tCur, vUv).rgb + s / 16.0, 1.0);
      }`,
      {
        tSmall: { value: null },
        tCur: { value: null },
        uPx: { value: new THREE.Vector2() },
        uRadius: { value: 1 },
      },
    );

    this.mFinal = mat(
      /* glsl */ `
      in vec2 vUv;
      uniform sampler2D tColor;
      uniform sampler2D tBloom;
      uniform float uBloom;
      uniform float uExposure;
      uniform float uVignette;
      uniform float uGrain;
      uniform vec3 uLift;
      uniform uint uFrame;
      uniform vec2 uAspect;
      uvec3 pcg3d(uvec3 v) {
        v = v * 1664525u + 1013904223u;
        v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
        v ^= v >> 16u;
        v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
        return v;
      }
      vec3 shoulder(vec3 c) {
        vec3 over = max(c - 0.8, 0.0);
        return min(c, 0.8) + 0.2 * (1.0 - exp(-over / 0.2));
      }
      void main() {
        vec3 c = texture(tColor, vUv).rgb + texture(tBloom, vUv).rgb * uBloom;
        c *= uExposure;
        vec2 q = (vUv - 0.5) * uAspect;
        c *= 1.0 - uVignette * smoothstep(0.25, 1.05, dot(q, q) * 1.6);
        c = shoulder(c) + uLift;
        uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uFrame));
        vec4 r = vec4(h.xyzx & 0xffffu) / 65535.0;
        uvec3 h2 = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uFrame + 7919u));
        float r4 = float(h2.x & 0xffffu) / 65535.0;
        float grain = (r.x + r.y - 1.0) * uGrain;
        c += grain * (0.35 + 0.65 * sqrt(clamp(dot(c, vec3(0.3, 0.5, 0.2)), 0.0, 1.0)));
        // TPDF dither, +-1/255
        c += vec3(r.z + r4 - 1.0, r.z + r.w - 1.0, r4 + r.w - 1.0) / 255.0;
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
      {
        tColor: { value: null },
        tBloom: { value: null },
        uBloom: { value: 0 },
        uExposure: { value: 1 },
        uVignette: { value: 0.3 },
        uGrain: { value: 0.015 },
        uLift: { value: new THREE.Vector3() },
        uFrame: { value: 0 },
        uAspect: { value: new THREE.Vector2(width / height, 1) },
      },
    );
  }

  private pass(m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = m;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  private setDepthUniforms(m: THREE.ShaderMaterial, cam: THREE.PerspectiveCamera, dof: NonNullable<PostParams["dof"]>) {
    m.uniforms.uNear.value = cam.near;
    m.uniforms.uFar.value = cam.far;
    m.uniforms.uFocus.value = dof.focus;
    m.uniforms.uAperture.value = dof.aperture;
    m.uniforms.uMaxBlur.value = dof.maxBlur;
    m.uniforms.uNearScale.value = dof.nearScale ?? 1;
    m.uniforms.uHeight.value = this.height;
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, p: PostParams) {
    const r = this.renderer;
    r.autoClear = true;
    r.setRenderTarget(this.rtScene);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    r.render(scene, camera);

    let color: THREE.Texture = this.rtScene.texture;
    if (p.dof) {
      const hw = this.rtPre.width;
      const hh = this.rtPre.height;
      this.mPre.uniforms.tColor.value = this.rtScene.texture;
      this.mPre.uniforms.tDepth.value = this.rtScene.depthTexture;
      this.mPre.uniforms.uPx.value.set(1 / this.width, 1 / this.height);
      this.setDepthUniforms(this.mPre, camera, p.dof);
      this.pass(this.mPre, this.rtPre);
      this.mGather.uniforms.tPre.value = this.rtPre.texture;
      this.mGather.uniforms.uPx.value.set(1 / hw, 1 / hh);
      this.pass(this.mGather, this.rtGather);
      this.mTent.uniforms.tSrc.value = this.rtGather.texture;
      this.mTent.uniforms.uPx.value.set(1 / hw, 1 / hh);
      this.pass(this.mTent, this.rtGather2);
      this.mDofComp.uniforms.tColor.value = this.rtScene.texture;
      this.mDofComp.uniforms.tDepth.value = this.rtScene.depthTexture;
      this.mDofComp.uniforms.tBlur.value = this.rtGather2.texture;
      this.setDepthUniforms(this.mDofComp, camera, p.dof);
      this.pass(this.mDofComp, this.rtDof);
      color = this.rtDof.texture;
    }

    // Bloom: thresholded 13-tap downsample chain, tent upsample.
    const n = this.down.length;
    this.mBright.uniforms.tSrc.value = color;
    this.mBright.uniforms.uPx.value.set(1 / this.width, 1 / this.height);
    this.mBright.uniforms.uThreshold.value = p.bloom.threshold;
    this.mBright.uniforms.uKnee.value = p.bloom.knee;
    this.pass(this.mBright, this.down[0]);
    for (let i = 1; i < n; i++) {
      const src = this.down[i - 1];
      this.mDown.uniforms.tSrc.value = src.texture;
      this.mDown.uniforms.uPx.value.set(1 / src.width, 1 / src.height);
      this.pass(this.mDown, this.down[i]);
    }
    let small = this.down[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      this.mUp.uniforms.tSmall.value = small.texture;
      this.mUp.uniforms.tCur.value = this.down[i].texture;
      this.mUp.uniforms.uPx.value.set(1 / small.width, 1 / small.height);
      this.mUp.uniforms.uRadius.value = p.bloom.radius ?? 1;
      this.pass(this.mUp, this.up[i]);
      small = this.up[i];
    }

    const f = this.mFinal.uniforms;
    f.tColor.value = color;
    f.tBloom.value = this.up[0].texture;
    f.uBloom.value = p.bloom.strength;
    f.uExposure.value = p.exposure ?? 1;
    f.uVignette.value = p.vignette ?? 0.3;
    f.uGrain.value = p.grain ?? 0.015;
    const lift = p.lift ?? [0, 0, 0];
    f.uLift.value.set(lift[0], lift[1], lift[2]);
    f.uFrame.value = p.frame >>> 0;
    this.pass(this.mFinal, null);
  }

  dispose() {
    [this.rtScene, this.rtPre, this.rtGather, this.rtGather2, this.rtDof, ...this.down, ...this.up].forEach((t) =>
      t.dispose(),
    );
  }
}
