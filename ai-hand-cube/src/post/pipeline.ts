// Custom deterministic post pipeline (no TAA, no accumulation):
//  1. main scene (background, hand, cube) -> half-float MSAA target + depth
//  2. HUD/particles -> separate half-float target, depth-tested against a
//     depth-only pass of the main scene (they blur themselves in-shader)
//  3. depth of field: CoC tile max (1/8 res) -> dilate -> 64-tap gather at
//     half res -> mixed with the sharp image by CoC
//  4. bloom: soft-threshold prefilter + 6-level mip down/up chain
//  5. final: soft-shoulder tone map, vignette, film grain (hash of pixel and
//     frame) and +-1/255 triangular dither, written to the 8-bit canvas
import * as THREE from "three";
import { COC, FULLSCREEN_VERT, HASH } from "./shaders";

export type PostParams = {
  frameMod: number;
  focus: number;
  nearK: number;
  farK: number;
  maxCoc: number;
  dof: boolean;
  bloomStrength: number;
  bloomThreshold: number;
  exposure: number;
  grain: number;
  vignette: number;
};

const rt = (w: number, h: number, opts: THREE.RenderTargetOptions = {}) =>
  new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...opts,
  });

const mat = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const DEPTH_UTIL = /* glsl */ `
uniform float uNear;
uniform float uFar;
float viewDist(float d) {
  // perspective depth [0,1] -> positive view distance
  float ndc = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
}
`;

const cocUniforms = () => ({
  uFocus: { value: 5 },
  uNearK: { value: 0.03 },
  uFarK: { value: 0.01 },
  uMaxCoc: { value: 0.012 },
  uHeightPx: { value: 1080 },
  uNear: { value: 0.1 },
  uFar: { value: 100 },
});

export class PostPipeline {
  private w = 0;
  private h = 0;
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });

  private rtMain!: THREE.WebGLRenderTarget;
  private rtHud!: THREE.WebGLRenderTarget;
  private rtHalf!: THREE.WebGLRenderTarget;
  private rtTileA!: THREE.WebGLRenderTarget;
  private rtTileB!: THREE.WebGLRenderTarget;
  private rtDof!: THREE.WebGLRenderTarget;
  private rtComp!: THREE.WebGLRenderTarget;
  private bloomDown: THREE.WebGLRenderTarget[] = [];
  private bloomUp: THREE.WebGLRenderTarget[] = [];

  private mTile: THREE.ShaderMaterial;
  private mDilate: THREE.ShaderMaterial;
  private mHalf: THREE.ShaderMaterial;
  private mDof: THREE.ShaderMaterial;
  private mComp: THREE.ShaderMaterial;
  private mPrefilter: THREE.ShaderMaterial;
  private mDown: THREE.ShaderMaterial;
  private mUp: THREE.ShaderMaterial;
  private mFinal: THREE.ShaderMaterial;

  constructor(private samples = 4) {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    this.quad = new THREE.Mesh(g);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    this.mTile = mat(
      /* glsl */ `
      precision highp float;
      ${DEPTH_UTIL}
      ${COC}
      uniform sampler2D tDepth;
      uniform vec2 uSrcTexel;
      in vec2 vUv;
      out vec4 outColor;
      void main() {
        // max CoC over the 8x8 block this tile covers (4x4 samples)
        float m = 0.0;
        for (int y = 0; y < 4; y++) {
          for (int x = 0; x < 4; x++) {
            vec2 o = (vec2(float(x), float(y)) * 2.0 - 3.0) * uSrcTexel;
            float d = texture(tDepth, vUv + o).x;
            m = max(m, cocPx(viewDist(d)));
          }
        }
        outColor = vec4(m, 0.0, 0.0, 1.0);
      }`,
      { tDepth: { value: null }, uSrcTexel: { value: new THREE.Vector2() }, ...cocUniforms() },
    );

    this.mDilate = mat(
      /* glsl */ `
      precision highp float;
      uniform sampler2D tSrc;
      uniform vec2 uDir;
      uniform int uRadius;
      in vec2 vUv;
      out vec4 outColor;
      void main() {
        float m = 0.0;
        for (int i = -12; i <= 12; i++) {
          if (abs(i) > uRadius) continue;
          m = max(m, texture(tSrc, vUv + uDir * float(i)).r);
        }
        outColor = vec4(m, 0.0, 0.0, 1.0);
      }`,
      { tSrc: { value: null }, uDir: { value: new THREE.Vector2() }, uRadius: { value: 4 } },
    );

    this.mHalf = mat(
      /* glsl */ `
      precision highp float;
      uniform sampler2D tSrc;
      uniform vec2 uSrcTexel;
      in vec2 vUv;
      out vec4 outColor;
      void main() {
        vec4 c = texture(tSrc, vUv + uSrcTexel * vec2(-0.5, -0.5));
        c += texture(tSrc, vUv + uSrcTexel * vec2(0.5, -0.5));
        c += texture(tSrc, vUv + uSrcTexel * vec2(-0.5, 0.5));
        c += texture(tSrc, vUv + uSrcTexel * vec2(0.5, 0.5));
        outColor = c * 0.25;
      }`,
      { tSrc: { value: null }, uSrcTexel: { value: new THREE.Vector2() } },
    );

    this.mDof = mat(
      /* glsl */ `
      precision highp float;
      ${DEPTH_UTIL}
      ${COC}
      uniform sampler2D tColor;   // half-res colour
      uniform sampler2D tDepth;   // full-res depth
      uniform sampler2D tTile;    // dilated tile max CoC (full-res px)
      uniform vec2 uFullTexel;
      in vec2 vUv;
      out vec4 outColor;
      const int N = 64;
      void main() {
        float zc = viewDist(texture(tDepth, vUv).x);
        float cc = cocPx(zc);
        float R = max(texture(tTile, vUv).r, cc);
        vec3 center = texture(tColor, vUv).rgb;
        if (R < 1.0) { outColor = vec4(center, 0.0); return; }
        vec3 acc = center;
        float wsum = 1.0;
        float fg = 0.0;
        for (int i = 0; i < N; i++) {
          float fi = float(i) + 0.5;
          float r = sqrt(fi / float(N)) * R;
          float a = fi * 2.39996323;
          vec2 uv = vUv + vec2(cos(a), sin(a)) * r * uFullTexel;
          float z = viewDist(texture(tDepth, uv).x);
          float c = cocPx(z);
          // background taps cannot blur over a sharper foreground
          float ce = z > zc ? min(c, cc) : c;
          float w = clamp((ce - r) / 2.0 + 0.5, 0.0, 1.0);
          acc += texture(tColor, uv).rgb * w;
          wsum += w;
          if (z < zc && c > cc + 1.0) fg += w;
        }
        float blend = max(smoothstep(0.6, 2.5, cc), clamp(2.0 * fg / float(N), 0.0, 1.0));
        outColor = vec4(acc / wsum, blend);
      }`,
      {
        tColor: { value: null },
        tDepth: { value: null },
        tTile: { value: null },
        uFullTexel: { value: new THREE.Vector2() },
        ...cocUniforms(),
      },
    );

    this.mComp = mat(
      /* glsl */ `
      precision highp float;
      uniform sampler2D tSharp;
      uniform sampler2D tDof;
      uniform sampler2D tHud;
      uniform vec2 uHalfTexel;
      uniform float uDofOn;
      in vec2 vUv;
      out vec4 outColor;
      void main() {
        vec4 sharp = texture(tSharp, vUv);
        // 4-tap tent on the half-res DoF to hide the gather pattern
        vec4 d = texture(tDof, vUv + uHalfTexel * vec2(-0.5, -0.5));
        d += texture(tDof, vUv + uHalfTexel * vec2(0.5, -0.5));
        d += texture(tDof, vUv + uHalfTexel * vec2(-0.5, 0.5));
        d += texture(tDof, vUv + uHalfTexel * vec2(0.5, 0.5));
        d *= 0.25;
        vec3 col = mix(sharp.rgb, d.rgb, uDofOn * smoothstep(0.0, 1.0, d.a));
        col += texture(tHud, vUv).rgb;
        outColor = vec4(col, 1.0);
      }`,
      {
        tSharp: { value: null },
        tDof: { value: null },
        tHud: { value: null },
        uHalfTexel: { value: new THREE.Vector2() },
        uDofOn: { value: 1 },
      },
    );

    this.mPrefilter = mat(
      /* glsl */ `
      precision highp float;
      uniform sampler2D tSrc;
      uniform vec2 uSrcTexel;
      uniform float uThreshold;
      in vec2 vUv;
      out vec4 outColor;
      void main() {
        vec3 c = texture(tSrc, vUv + uSrcTexel * vec2(-0.5, -0.5)).rgb;
        c += texture(tSrc, vUv + uSrcTexel * vec2(0.5, -0.5)).rgb;
        c += texture(tSrc, vUv + uSrcTexel * vec2(-0.5, 0.5)).rgb;
        c += texture(tSrc, vUv + uSrcTexel * vec2(0.5, 0.5)).rgb;
        c *= 0.25;
        float br = max(c.r, max(c.g, c.b));
        float knee = uThreshold * 0.7;
        float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
        soft = soft * soft / (4.0 * knee + 1e-4);
        float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
        outColor = vec4(c * contrib, 1.0);
      }`,
      { tSrc: { value: null }, uSrcTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 } },
    );

    this.mDown = mat(
      /* glsl */ `
      precision highp float;
      uniform sampler2D tSrc;
      uniform vec2 uSrcTexel;
      in vec2 vUv;
      out vec4 outColor;
      vec3 s(vec2 o) { return texture(tSrc, vUv + o * uSrcTexel).rgb; }
      void main() {
        // 13-tap downsample (Jimenez 2014)
        vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
        vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
        vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
        vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
        vec3 r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
        outColor = vec4(r, 1.0);
      }`,
      { tSrc: { value: null }, uSrcTexel: { value: new THREE.Vector2() } },
    );

    this.mUp = mat(
      /* glsl */ `
      precision highp float;
      uniform sampler2D tLow;   // smaller level (already accumulated)
      uniform sampler2D tCur;   // this level's downsampled value
      uniform vec2 uLowTexel;
      uniform float uSpread;
      in vec2 vUv;
      out vec4 outColor;
      vec3 s(vec2 o) { return texture(tLow, vUv + o * uLowTexel).rgb; }
      void main() {
        vec3 t = s(vec2(-1, 1)) + s(vec2(1, 1)) + s(vec2(-1, -1)) + s(vec2(1, -1));
        t += 2.0 * (s(vec2(0, 1)) + s(vec2(0, -1)) + s(vec2(-1, 0)) + s(vec2(1, 0)));
        t += 4.0 * s(vec2(0, 0));
        t /= 16.0;
        outColor = vec4(texture(tCur, vUv).rgb + t * uSpread, 1.0);
      }`,
      {
        tLow: { value: null },
        tCur: { value: null },
        uLowTexel: { value: new THREE.Vector2() },
        uSpread: { value: 1 },
      },
    );

    this.mFinal = mat(
      /* glsl */ `
      precision highp float;
      precision highp int;
      ${HASH}
      uniform sampler2D tComp;
      uniform sampler2D tBloom;
      uniform vec2 uBloomTexel;
      uniform float uBloom;
      uniform float uExposure;
      uniform float uGrain;
      uniform float uVignette;
      uniform float uFrame;
      uniform vec2 uRes;
      in vec2 vUv;
      out vec4 outColor;
      float shoulder(float x) {
        const float s = 0.62;
        return x < s ? x : s + (1.0 - s) * (1.0 - exp(-(x - s) / (1.0 - s)));
      }
      float toSrgb(float c) {
        return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
      }
      void main() {
        vec3 col = texture(tComp, vUv).rgb;
        vec3 b = texture(tBloom, vUv + uBloomTexel * vec2(-0.5, -0.5)).rgb;
        b += texture(tBloom, vUv + uBloomTexel * vec2(0.5, -0.5)).rgb;
        b += texture(tBloom, vUv + uBloomTexel * vec2(-0.5, 0.5)).rgb;
        b += texture(tBloom, vUv + uBloomTexel * vec2(0.5, 0.5)).rgb;
        col += b * 0.25 * uBloom;
        col *= uExposure;
        // very bright areas drift toward white before the shoulder
        float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(col, vec3(lum), smoothstep(1.0, 6.0, lum) * 0.6);
        col = vec3(shoulder(col.r), shoulder(col.g), shoulder(col.b));
        // vignette
        vec2 q = vUv - 0.5;
        q.x *= uRes.x / uRes.y;
        col *= 1.0 - uVignette * smoothstep(0.25, 1.1, dot(q, q) * 2.2);
        vec3 s = vec3(toSrgb(col.r), toSrgb(col.g), toSrgb(col.b));
        // film grain (~1.5%) + triangular dither (+-1/255): pure functions of
        // pixel position and frame index (mod composition length)
        uvec3 p = uvec3(uvec2(gl_FragCoord.xy), uint(uFrame));
        float g = hash3(p) + hash3(p + uvec3(0u, 0u, 7919u)) - 1.0;
        s += g * uGrain;
        float d = hash3(p + uvec3(1013u, 2311u, 0u)) - hash3(p + uvec3(3571u, 977u, 4409u));
        s += d / 255.0;
        outColor = vec4(clamp(s, 0.0, 1.0), 1.0);
      }`,
      {
        tComp: { value: null },
        tBloom: { value: null },
        uBloomTexel: { value: new THREE.Vector2() },
        uBloom: { value: 1 },
        uExposure: { value: 1 },
        uGrain: { value: 0.015 },
        uVignette: { value: 0.3 },
        uFrame: { value: 0 },
        uRes: { value: new THREE.Vector2() },
      },
    );
  }

  private dispose() {
    [this.rtMain, this.rtHud, this.rtHalf, this.rtTileA, this.rtTileB, this.rtDof, this.rtComp]
      .filter(Boolean)
      .forEach((r) => {
        r.depthTexture?.dispose();
        r.dispose();
      });
    this.bloomDown.forEach((r) => r.dispose());
    this.bloomUp.forEach((r) => r.dispose());
    this.bloomDown = [];
    this.bloomUp = [];
  }

  setSize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.dispose();
    this.w = w;
    this.h = h;
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedIntType;
    depthTexture.minFilter = THREE.NearestFilter;
    depthTexture.magFilter = THREE.NearestFilter;
    this.rtMain = rt(w, h, { samples: this.samples, depthBuffer: true, depthTexture });
    this.rtHud = rt(w, h, { samples: this.samples, depthBuffer: true });
    this.rtHalf = rt(w / 2, h / 2);
    this.rtTileA = rt(w / 8, h / 8, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.rtTileB = rt(w / 8, h / 8, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.rtDof = rt(w / 2, h / 2);
    this.rtComp = rt(w, h);
    let bw = w / 2;
    let bh = h / 2;
    for (let i = 0; i < 7; i++) {
      this.bloomDown.push(rt(bw, bh));
      this.bloomUp.push(rt(bw, bh));
      bw /= 2;
      bh /= 2;
    }
  }

  private pass(gl: THREE.WebGLRenderer, m: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = m;
    gl.setRenderTarget(target);
    gl.render(this.quadScene, this.quadCam);
  }

  private setCoc(m: THREE.ShaderMaterial, p: PostParams, cam: THREE.PerspectiveCamera) {
    m.uniforms.uFocus.value = p.focus;
    m.uniforms.uNearK.value = p.nearK;
    m.uniforms.uFarK.value = p.farK;
    m.uniforms.uMaxCoc.value = p.maxCoc;
    m.uniforms.uHeightPx.value = this.h;
    m.uniforms.uNear.value = cam.near;
    m.uniforms.uFar.value = cam.far;
  }

  render(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    hudScene: THREE.Scene | null,
    cam: THREE.PerspectiveCamera,
    p: PostParams,
  ) {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    this.setSize(size.x, size.y);
    const { w, h } = this;
    gl.autoClear = false;
    gl.setClearColor(0x000000, 0);

    // 1. main scene (shadow maps update once per frame, here)
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    gl.setRenderTarget(this.rtMain);
    gl.clear(true, true, true);
    gl.render(scene, cam);

    // 2. HUD + particles, depth tested against the main scene
    gl.setRenderTarget(this.rtHud);
    gl.clear(true, true, true);
    if (hudScene) {
      scene.overrideMaterial = this.depthOnly;
      gl.render(scene, cam);
      scene.overrideMaterial = null;
      gl.render(hudScene, cam);
    }

    // 3. depth of field
    this.mHalf.uniforms.tSrc.value = this.rtMain.texture;
    this.mHalf.uniforms.uSrcTexel.value.set(1 / w, 1 / h);
    this.pass(gl, this.mHalf, this.rtHalf);
    if (p.dof) {
      this.setCoc(this.mTile, p, cam);
      this.mTile.uniforms.tDepth.value = this.rtMain.depthTexture;
      this.mTile.uniforms.uSrcTexel.value.set(1 / w, 1 / h);
      this.pass(gl, this.mTile, this.rtTileA);
      const radius = Math.min(12, Math.ceil((p.maxCoc * h) / 8) + 1);
      this.mDilate.uniforms.uRadius.value = radius;
      this.mDilate.uniforms.tSrc.value = this.rtTileA.texture;
      this.mDilate.uniforms.uDir.value.set(1 / this.rtTileA.width, 0);
      this.pass(gl, this.mDilate, this.rtTileB);
      this.mDilate.uniforms.tSrc.value = this.rtTileB.texture;
      this.mDilate.uniforms.uDir.value.set(0, 1 / this.rtTileA.height);
      this.pass(gl, this.mDilate, this.rtTileA);
      this.setCoc(this.mDof, p, cam);
      this.mDof.uniforms.tColor.value = this.rtHalf.texture;
      this.mDof.uniforms.tDepth.value = this.rtMain.depthTexture;
      this.mDof.uniforms.tTile.value = this.rtTileA.texture;
      this.mDof.uniforms.uFullTexel.value.set(1 / w, 1 / h);
      this.pass(gl, this.mDof, this.rtDof);
    }
    this.mComp.uniforms.tSharp.value = this.rtMain.texture;
    this.mComp.uniforms.tDof.value = this.rtDof.texture;
    this.mComp.uniforms.tHud.value = this.rtHud.texture;
    this.mComp.uniforms.uHalfTexel.value.set(1 / this.rtDof.width, 1 / this.rtDof.height);
    this.mComp.uniforms.uDofOn.value = p.dof ? 1 : 0;
    this.pass(gl, this.mComp, this.rtComp);

    // 4. bloom
    this.mPrefilter.uniforms.tSrc.value = this.rtComp.texture;
    this.mPrefilter.uniforms.uSrcTexel.value.set(1 / w, 1 / h);
    this.mPrefilter.uniforms.uThreshold.value = p.bloomThreshold;
    this.pass(gl, this.mPrefilter, this.bloomDown[0]);
    for (let i = 1; i < this.bloomDown.length; i++) {
      const src = this.bloomDown[i - 1];
      this.mDown.uniforms.tSrc.value = src.texture;
      this.mDown.uniforms.uSrcTexel.value.set(1 / src.width, 1 / src.height);
      this.pass(gl, this.mDown, this.bloomDown[i]);
    }
    const last = this.bloomDown.length - 1;
    let low = this.bloomDown[last];
    for (let i = last - 1; i >= 0; i--) {
      this.mUp.uniforms.tLow.value = low.texture;
      this.mUp.uniforms.tCur.value = this.bloomDown[i].texture;
      this.mUp.uniforms.uLowTexel.value.set(1 / low.width, 1 / low.height);
      this.mUp.uniforms.uSpread.value = 1.0;
      this.pass(gl, this.mUp, this.bloomUp[i]);
      low = this.bloomUp[i];
    }

    // 5. final output
    const f = this.mFinal.uniforms;
    f.tComp.value = this.rtComp.texture;
    f.tBloom.value = this.bloomUp[0].texture;
    f.uBloomTexel.value.set(1 / this.bloomUp[0].width, 1 / this.bloomUp[0].height);
    f.uBloom.value = p.bloomStrength / this.bloomDown.length;
    f.uExposure.value = p.exposure;
    f.uGrain.value = p.grain;
    f.uVignette.value = p.vignette;
    f.uFrame.value = p.frameMod;
    f.uRes.value.set(w, h);
    this.pass(gl, this.mFinal, null);
  }
}
