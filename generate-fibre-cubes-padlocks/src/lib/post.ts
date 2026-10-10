import * as THREE from "three";

// Shared post-processing for the three.js looks.
//
//   scene (HDR, MSAA, depth texture)
//     -> CoC tile-max (1/8 res)               [fog + CoC from depth]
//     -> DoF gather (full res, fixed Vogel disk, non-temporal)
//     -> bloom (mip chain down/up)
//     -> composite: bloom add, exposure, ACES, vignette, sRGB, grain, dither
//
// Nothing here keeps state between frames: every target is fully rewritten
// each frame and the grain/dither hash only sees pixel position and
// (frame % loop), so any frame can be rendered on its own.

export type DofOptions = {
  focus: number; // view-space distance in focus
  range: number; // distance either side that stays sharp
  ramp: number; // distance over which blur ramps to max
  nearMax: number; // max blur radius in front of focus, fraction of frame height
  farMax: number; // max blur radius behind focus, fraction of frame height
};

export type FogOptions = {
  near: number;
  far: number;
  density: number; // 0..1 at "far"
  colorTop: THREE.Color;
  colorBottom: THREE.Color;
  horizon: number; // screen y (0 bottom .. 1 top) where the bottom colour starts
};

export type PostOptions = {
  exposure: number;
  bloomStrength: number;
  bloomThreshold: number;
  bloomRadius: number; // 0..1, mix of wide vs tight bloom levels
  vignette: number;
  grain: number; // e.g. 0.015
  loopFrames: number;
  dof: DofOptions | null;
  fog: FogOptions | null;
  samples: number; // MSAA
  clearColor: THREE.Color; // linear background colour
};

const FULLSCREEN_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const COMMON = /* glsl */ `
uniform float uNear;
uniform float uFar;
float linearDepth(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}
`;

const DOF_COMMON = /* glsl */ `
uniform float uFocus;
uniform float uRange;
uniform float uRamp;
uniform float uNearMax;
uniform float uFarMax;
uniform float uDofOn;
// signed CoC in pixels: negative = in front of focus
float cocPx(float dist, float resY) {
  float d = dist - uFocus;
  float a = clamp((abs(d) - uRange) / uRamp, 0.0, 1.0);
  a = a * a * (3.0 - 2.0 * a);
  float m = d < 0.0 ? uNearMax : uFarMax;
  return uDofOn * sign(d) * a * m * resY;
}
`;

const FOG_COMMON = /* glsl */ `
uniform float uFogOn;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFogDensity;
uniform vec3 uFogTop;
uniform vec3 uFogBottom;
uniform float uFogHorizon;
vec3 applyFog(vec3 c, float dist, float sy) {
  if (uFogOn < 0.5) return c;
  float f = clamp((dist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  f = 1.0 - exp(-f * f * 3.0 * uFogDensity);
  float g = smoothstep(uFogHorizon - 0.12, 1.0, sy);
  vec3 fc = mix(uFogBottom, uFogTop, g);
  return mix(c, fc, f);
}
`;

const makeMat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

export class PostPipeline {
  readonly gl: THREE.WebGLRenderer;
  readonly width: number;
  readonly height: number;
  opts: PostOptions;
  sceneRT: THREE.WebGLRenderTarget;
  tileRT: THREE.WebGLRenderTarget;
  dofRT: THREE.WebGLRenderTarget;
  bloomDown: THREE.WebGLRenderTarget[] = [];
  bloomUp: THREE.WebGLRenderTarget[] = [];
  quad: THREE.Mesh;
  quadScene: THREE.Scene;
  quadCam: THREE.OrthographicCamera;
  tileMat: THREE.ShaderMaterial;
  gatherMat: THREE.ShaderMaterial;
  downMat: THREE.ShaderMaterial;
  upMat: THREE.ShaderMaterial;
  compMat: THREE.ShaderMaterial;

  constructor(gl: THREE.WebGLRenderer, width: number, height: number, opts: PostOptions) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.opts = opts;

    const depthTexture = new THREE.DepthTexture(width, height);
    depthTexture.type = THREE.UnsignedIntType;
    this.sceneRT = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: opts.samples,
      depthTexture,
      depthBuffer: true,
    });
    const tw = Math.max(1, Math.ceil(width / 8));
    const th = Math.max(1, Math.ceil(height / 8));
    this.tileRT = new THREE.WebGLRenderTarget(tw, th, {
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
    });
    this.dofRT = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    let w = width;
    let h = height;
    for (let i = 0; i < 7; i++) {
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
      const mk = () =>
        new THREE.WebGLRenderTarget(w, h, {
          type: THREE.HalfFloatType,
          depthBuffer: false,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
        });
      this.bloomDown.push(mk());
      this.bloomUp.push(mk());
    }

    const dof = opts.dof;
    const fog = opts.fog;
    const dofUniforms = {
      uFocus: { value: dof?.focus ?? 1 },
      uRange: { value: dof?.range ?? 1 },
      uRamp: { value: dof?.ramp ?? 1 },
      uNearMax: { value: dof?.nearMax ?? 0 },
      uFarMax: { value: dof?.farMax ?? 0 },
      uDofOn: { value: dof ? 1 : 0 },
    };
    const fogUniforms = {
      uFogOn: { value: fog ? 1 : 0 },
      uFogNear: { value: fog?.near ?? 0 },
      uFogFar: { value: fog?.far ?? 1 },
      uFogDensity: { value: fog?.density ?? 0 },
      uFogTop: { value: fog?.colorTop ?? new THREE.Color() },
      uFogBottom: { value: fog?.colorBottom ?? new THREE.Color() },
      uFogHorizon: { value: fog?.horizon ?? 0.5 },
    };
    const camUniforms = { uNear: { value: 0.1 }, uFar: { value: 100 } };

    // 1/8-res tile pass: max |CoC| of near-field pixels, used to widen the
    // gather so blurry foreground bleeds over sharp background.
    this.tileMat = makeMat(
      /* glsl */ `
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tDepth;
      uniform vec2 uRes;
      ${COMMON}
      ${DOF_COMMON}
      void main() {
        vec2 base = floor(vUv * uRes / 8.0) * 8.0;
        float nearMax = 0.0;
        float anyMax = 0.0;
        for (int y = 0; y < 8; y += 2) {
          for (int x = 0; x < 8; x += 2) {
            vec2 p = (base + vec2(float(x), float(y)) + 1.0) / uRes;
            float c = cocPx(linearDepth(texture(tDepth, p).r), uRes.y);
            nearMax = max(nearMax, -c);
            anyMax = max(anyMax, abs(c));
          }
        }
        outColor = vec4(nearMax, anyMax, 0.0, 1.0);
      }`,
      { tDepth: { value: depthTexture }, uRes: { value: new THREE.Vector2(width, height) }, ...camUniforms, ...dofUniforms },
    );

    // Full-res gather with a fixed 64-tap Vogel disk (no per-frame jitter,
    // no history buffer): scatter-as-gather with near/far weighting.
    this.gatherMat = makeMat(
      /* glsl */ `
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform sampler2D tTile;
      uniform vec2 uRes;
      uniform vec2 uTileRes;
      ${COMMON}
      ${DOF_COMMON}
      ${FOG_COMMON}
      const int N = 64;
      vec3 fetch(vec2 uv, out float coc) {
        float dist = linearDepth(texture(tDepth, uv).r);
        coc = cocPx(dist, uRes.y);
        return applyFog(texture(tColor, uv).rgb, dist, uv.y);
      }
      void main() {
        float c0;
        vec3 col0 = fetch(vUv, c0);
        if (uDofOn < 0.5) { outColor = vec4(col0, 1.0); return; }
        float tileNear = 0.0;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          tileNear = max(tileNear, texture(tTile, vUv + vec2(float(x), float(y)) / uTileRes).r);
        }
        float radius = max(abs(c0), tileNear);
        if (radius < 0.6) { outColor = vec4(col0, 1.0); return; }
        vec3 acc = col0;
        float wsum = 1.0;
        float golden = 2.39996323;
        for (int i = 1; i < N; i++) {
          float fi = float(i);
          float r = sqrt(fi / float(N)) * radius;
          float th = fi * golden;
          vec2 off = vec2(cos(th), sin(th)) * r;
          float cs;
          vec3 s = fetch(vUv + off / uRes, cs);
          float w;
          if (cs < c0) {
            // sample is nearer (or more in front): it spreads by its own CoC
            w = clamp(abs(cs) - r + 1.0, 0.0, 1.0);
          } else {
            w = clamp(min(abs(cs), abs(c0)) - r + 1.0, 0.0, 1.0);
          }
          acc += s * w;
          wsum += w;
        }
        outColor = vec4(acc / wsum, 1.0);
      }`,
      {
        tColor: { value: this.sceneRT.texture },
        tDepth: { value: depthTexture },
        tTile: { value: this.tileRT.texture },
        uRes: { value: new THREE.Vector2(width, height) },
        uTileRes: { value: new THREE.Vector2(tw, th) },
        ...camUniforms,
        ...dofUniforms,
        ...fogUniforms,
      },
    );

    this.downMat = makeMat(
      /* glsl */ `
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tSrc;
      uniform vec2 uTexel;
      uniform float uThreshold;
      uniform float uFirst;
      vec3 prefilter(vec3 c) {
        float br = max(c.r, max(c.g, c.b));
        float soft = clamp(br - uThreshold + 0.5, 0.0, 1.0);
        soft = soft * soft * 0.5;
        float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
        return c * contrib;
      }
      void main() {
        vec2 t = uTexel;
        vec3 a = texture(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb;
        vec3 b = texture(tSrc, vUv + t * vec2( 1.0, -1.0)).rgb;
        vec3 c = texture(tSrc, vUv + t * vec2(-1.0,  1.0)).rgb;
        vec3 d = texture(tSrc, vUv + t * vec2( 1.0,  1.0)).rgb;
        vec3 e = texture(tSrc, vUv).rgb;
        vec3 col = (a + b + c + d) * 0.125 + e * 0.5;
        if (uFirst > 0.5) col = prefilter(col);
        outColor = vec4(col, 1.0);
      }`,
      { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: opts.bloomThreshold }, uFirst: { value: 0 } },
    );

    this.upMat = makeMat(
      /* glsl */ `
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tLow;
      uniform sampler2D tHigh;
      uniform vec2 uTexel;
      uniform float uMix;
      void main() {
        vec2 t = uTexel;
        vec3 s = texture(tLow, vUv).rgb * 4.0;
        s += texture(tLow, vUv + vec2(t.x, 0.0)).rgb * 2.0;
        s += texture(tLow, vUv - vec2(t.x, 0.0)).rgb * 2.0;
        s += texture(tLow, vUv + vec2(0.0, t.y)).rgb * 2.0;
        s += texture(tLow, vUv - vec2(0.0, t.y)).rgb * 2.0;
        s += texture(tLow, vUv + t).rgb;
        s += texture(tLow, vUv - t).rgb;
        s += texture(tLow, vUv + vec2(t.x, -t.y)).rgb;
        s += texture(tLow, vUv + vec2(-t.x, t.y)).rgb;
        s /= 16.0;
        outColor = vec4(texture(tHigh, vUv).rgb + s * uMix, 1.0);
      }`,
      { tLow: { value: null }, tHigh: { value: null }, uTexel: { value: new THREE.Vector2() }, uMix: { value: 1 } },
    );

    this.compMat = makeMat(
      /* glsl */ `
      precision highp float;
      in vec2 vUv;
      out vec4 outColor;
      uniform sampler2D tColor;
      uniform sampler2D tBloom;
      uniform float uExposure;
      uniform float uBloom;
      uniform float uVignette;
      uniform float uGrain;
      uniform float uFrame;
      uniform vec2 uRes;
      vec3 aces(vec3 x) {
        const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
        return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
      }
      vec3 toSRGB(vec3 c) {
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }
      uint hashu(uvec3 v) {
        v = v * 1664525u + 1013904223u;
        v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
        v ^= v >> 16u;
        v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
        return v.x ^ v.y ^ v.z;
      }
      float hash01(uvec3 v) { return float(hashu(v) & 0xffffffu) / 16777216.0; }
      void main() {
        vec3 c = texture(tColor, vUv).rgb + texture(tBloom, vUv).rgb * uBloom;
        c *= uExposure;
        vec2 q = vUv - 0.5;
        q.x *= uRes.x / uRes.y;
        float v = 1.0 - uVignette * smoothstep(0.35, 1.05, length(q));
        c *= v;
        c = aces(c);
        c = toSRGB(c);
        uvec2 p = uvec2(gl_FragCoord.xy);
        uint f = uint(uFrame);
        float lum = dot(c, vec3(0.299, 0.587, 0.114));
        // grain ~1.5%, fixed function of pixel and (frame % loop)
        float g = hash01(uvec3(p, f)) - 0.5;
        c += g * 2.0 * uGrain * (0.35 + 0.65 * sqrt(lum));
        // +-1/255 triangular dither, last
        float d = hash01(uvec3(p, f + 7919u)) + hash01(uvec3(p.yx, f + 104729u)) - 1.0;
        c += d / 255.0;
        outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
      {
        tColor: { value: this.dofRT.texture },
        tBloom: { value: this.bloomUp[0].texture },
        uExposure: { value: opts.exposure },
        uBloom: { value: opts.bloomStrength },
        uVignette: { value: opts.vignette },
        uGrain: { value: opts.grain },
        uFrame: { value: 0 },
        uRes: { value: new THREE.Vector2(width, height) },
      },
    );

    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compMat);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
  }

  private pass(mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, frame: number) {
    const gl = this.gl;
    for (const m of [this.tileMat, this.gatherMat]) {
      m.uniforms.uNear.value = camera.near;
      m.uniforms.uFar.value = camera.far;
    }
    gl.setRenderTarget(this.sceneRT);
    gl.setClearColor(this.opts.clearColor, 1);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    if (this.opts.dof) this.pass(this.tileMat, this.tileRT);
    this.pass(this.gatherMat, this.dofRT);

    // bloom
    let src: THREE.Texture = this.dofRT.texture;
    let srcW = this.width;
    let srcH = this.height;
    for (let i = 0; i < this.bloomDown.length; i++) {
      this.downMat.uniforms.tSrc.value = src;
      this.downMat.uniforms.uTexel.value.set(1 / srcW, 1 / srcH);
      this.downMat.uniforms.uFirst.value = i === 0 ? 1 : 0;
      this.pass(this.downMat, this.bloomDown[i]);
      src = this.bloomDown[i].texture;
      srcW = this.bloomDown[i].width;
      srcH = this.bloomDown[i].height;
    }
    const n = this.bloomDown.length;
    let low = this.bloomDown[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      this.upMat.uniforms.tLow.value = low.texture;
      this.upMat.uniforms.tHigh.value = this.bloomDown[i].texture;
      this.upMat.uniforms.uTexel.value.set(1 / low.width, 1 / low.height);
      // larger radius -> wider levels contribute more
      this.upMat.uniforms.uMix.value = 0.55 + 0.9 * this.opts.bloomRadius;
      this.pass(this.upMat, this.bloomUp[i]);
      low = this.bloomUp[i];
    }

    this.compMat.uniforms.uFrame.value = ((frame % this.opts.loopFrames) + this.opts.loopFrames) % this.opts.loopFrames;
    this.pass(this.compMat, null);
  }

  dispose() {
    this.sceneRT.dispose();
    this.tileRT.dispose();
    this.dofRT.dispose();
    for (const t of [...this.bloomDown, ...this.bloomUp]) t.dispose();
    for (const m of [this.tileMat, this.gatherMat, this.downMat, this.upMat, this.compMat]) m.dispose();
  }
}
