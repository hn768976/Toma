import * as THREE from "three";
import { blueNoiseTexture } from "./blueNoise";
import { FINISH, HASH, SRGB, frag } from "./glsl";

/**
 * Minimal deterministic post chain (no TAA, no accumulation, nothing carried
 * between frames):
 *   scene → half-float target (optionally MSAA)
 *        → [bloom: threshold + 6-level down/up chain, half-float]
 *        → final pass: look-specific grade → sRGB → grain → ±1/255 dither.
 */

const FS_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fullscreenGeometry = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return g;
};

class Pass {
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mesh: THREE.Mesh;
  constructor(public material: THREE.ShaderMaterial) {
    this.mesh = new THREE.Mesh(fullscreenGeometry(), material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  render(gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    gl.setRenderTarget(target);
    gl.render(this.scene, this.camera);
  }
}

const passMaterial = (fragSrc: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FS_VERT,
    fragmentShader: frag(fragSrc),
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const PREFILTER = /* glsl */ `
in vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
void main() {
  // 4-tap box (half-res) + soft knee threshold
  vec3 c = 0.25 * (texture(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture(tSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
         + texture(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture(tSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb);
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-5);
  gl_FragColor = vec4(c * contrib, 1.0);
}
`;

const DOWN = /* glsl */ `
in vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uTexel;
void main() {
  // 13-tap (Jimenez 2014) downsample
  vec2 t = uTexel;
  vec3 a = texture(tSrc, vUv + t * vec2(-2.0, -2.0)).rgb;
  vec3 b = texture(tSrc, vUv + t * vec2(0.0, -2.0)).rgb;
  vec3 c = texture(tSrc, vUv + t * vec2(2.0, -2.0)).rgb;
  vec3 d = texture(tSrc, vUv + t * vec2(-2.0, 0.0)).rgb;
  vec3 e = texture(tSrc, vUv).rgb;
  vec3 f = texture(tSrc, vUv + t * vec2(2.0, 0.0)).rgb;
  vec3 g = texture(tSrc, vUv + t * vec2(-2.0, 2.0)).rgb;
  vec3 h = texture(tSrc, vUv + t * vec2(0.0, 2.0)).rgb;
  vec3 i = texture(tSrc, vUv + t * vec2(2.0, 2.0)).rgb;
  vec3 j = texture(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb;
  vec3 k = texture(tSrc, vUv + t * vec2(1.0, -1.0)).rgb;
  vec3 l = texture(tSrc, vUv + t * vec2(-1.0, 1.0)).rgb;
  vec3 m = texture(tSrc, vUv + t * vec2(1.0, 1.0)).rgb;
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(o, 1.0);
}
`;

const UP = /* glsl */ `
in vec2 vUv;
uniform sampler2D tSrc;   // lower (smaller) level, being upsampled
uniform sampler2D tBase;  // this level's downsample result
uniform vec2 uTexel;      // texel of tSrc
uniform float uRadius;
void main() {
  vec2 t = uTexel * uRadius;
  vec3 s = texture(tSrc, vUv + vec2(-t.x, -t.y)).rgb + 2.0 * texture(tSrc, vUv + vec2(0.0, -t.y)).rgb + texture(tSrc, vUv + vec2(t.x, -t.y)).rgb
         + 2.0 * texture(tSrc, vUv + vec2(-t.x, 0.0)).rgb + 4.0 * texture(tSrc, vUv).rgb + 2.0 * texture(tSrc, vUv + vec2(t.x, 0.0)).rgb
         + texture(tSrc, vUv + vec2(-t.x, t.y)).rgb + 2.0 * texture(tSrc, vUv + vec2(0.0, t.y)).rgb + texture(tSrc, vUv + vec2(t.x, t.y)).rgb;
  gl_FragColor = vec4(texture(tBase, vUv).rgb + s / 16.0, 1.0);
}
`;

export type PostOptions = {
  /** MSAA samples for the scene target (0 = off). */
  msaa?: number;
  bloom?: { threshold: number; knee?: number; levels?: number; radius?: number } | null;
  /**
   * GLSL defining `vec3 grade(vec3 hdr, vec3 bloom, vec2 uv)` → display-linear
   * colour (0..1). Has access to uFrame, uFrameMod, uRes, uAspect and any extra
   * uniforms passed in `uniforms`.
   */
  grade: string;
  uniforms?: Record<string, THREE.IUniform>;
  grain?: number;
  grainDarkFade?: boolean;
  blueNoise?: boolean;
  loopLength: number;
  clearColor?: THREE.ColorRepresentation;
};

export class Post {
  sceneRT: THREE.WebGLRenderTarget;
  private levels: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];
  private prefilter: Pass | null = null;
  private down: Pass | null = null;
  private up: Pass | null = null;
  private final: Pass;
  readonly uniforms: Record<string, THREE.IUniform>;
  private w = 0;
  private h = 0;

  constructor(private opts: PostOptions) {
    const rtOpts = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      samples: opts.msaa ?? 0,
    };
    this.sceneRT = new THREE.WebGLRenderTarget(4, 4, rtOpts);
    const nLevels = opts.bloom ? (opts.bloom.levels ?? 6) : 0;
    for (let i = 0; i < nLevels; i++) {
      const o = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
      this.levels.push(new THREE.WebGLRenderTarget(4, 4, o));
      this.ups.push(new THREE.WebGLRenderTarget(4, 4, o));
    }
    if (opts.bloom) {
      this.prefilter = new Pass(
        passMaterial(PREFILTER, {
          tSrc: { value: null },
          uTexel: { value: new THREE.Vector2() },
          uThreshold: { value: opts.bloom.threshold },
          uKnee: { value: opts.bloom.knee ?? 0.5 },
        }),
      );
      this.down = new Pass(passMaterial(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }));
      this.up = new Pass(
        passMaterial(UP, {
          tSrc: { value: null },
          tBase: { value: null },
          uTexel: { value: new THREE.Vector2() },
          uRadius: { value: opts.bloom.radius ?? 1.0 },
        }),
      );
    }
    this.uniforms = {
      tScene: { value: this.sceneRT.texture },
      tBloom: { value: null },
      uHasBloom: { value: opts.bloom ? 1 : 0 },
      uFrame: { value: 0 },
      uFrameMod: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uAspect: { value: 16 / 9 },
      uGrain: { value: opts.grain ?? 0.015 },
      uGrainDarkFade: { value: opts.grainDarkFade ? 1 : 0 },
      uBlueNoise: { value: blueNoiseTexture() },
      uUseBlueNoise: { value: opts.blueNoise ? 1 : 0 },
      ...(opts.uniforms ?? {}),
    };
    this.final = new Pass(
      passMaterial(
        /* glsl */ `
in vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uHasBloom;
uniform float uFrame;
uniform vec2 uRes;
uniform float uAspect;
${HASH}
${SRGB}
${FINISH}
${opts.grade}
void main() {
  vec3 hdr = texture(tScene, vUv).rgb;
  vec3 bl = uHasBloom > 0.5 ? texture(tBloom, vUv).rgb : vec3(0.0);
  vec3 c = grade(hdr, bl, vUv);
  gl_FragColor = vec4(finishOutput(linearToSrgb(c)), 1.0);
}
`,
        this.uniforms,
      ),
    );
  }

  setSize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.sceneRT.setSize(w, h);
    let lw = Math.max(1, Math.round(w / 2));
    let lh = Math.max(1, Math.round(h / 2));
    for (let i = 0; i < this.levels.length; i++) {
      this.levels[i].setSize(lw, lh);
      this.ups[i].setSize(lw, lh);
      lw = Math.max(1, Math.round(lw / 2));
      lh = Math.max(1, Math.round(lh / 2));
    }
    (this.uniforms.uRes.value as THREE.Vector2).set(w, h);
    this.uniforms.uAspect.value = w / h;
  }

  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, frame: number) {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    this.setSize(size.x, size.y);
    this.uniforms.uFrame.value = frame;
    this.uniforms.uFrameMod.value = ((frame % this.opts.loopLength) + this.opts.loopLength) % this.opts.loopLength;

    gl.autoClear = true;
    gl.setClearColor(new THREE.Color(this.opts.clearColor ?? 0x000000), 1);
    gl.setRenderTarget(this.sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    if (this.prefilter && this.down && this.up && this.levels.length) {
      const pu = this.prefilter.material.uniforms;
      pu.tSrc.value = this.sceneRT.texture;
      (pu.uTexel.value as THREE.Vector2).set(1 / this.w, 1 / this.h);
      this.prefilter.render(gl, this.levels[0]);
      const du = this.down.material.uniforms;
      for (let i = 1; i < this.levels.length; i++) {
        du.tSrc.value = this.levels[i - 1].texture;
        (du.uTexel.value as THREE.Vector2).set(1 / this.levels[i - 1].width, 1 / this.levels[i - 1].height);
        this.down.render(gl, this.levels[i]);
      }
      const uu = this.up.material.uniforms;
      let src = this.levels[this.levels.length - 1];
      for (let i = this.levels.length - 2; i >= 0; i--) {
        uu.tSrc.value = src.texture;
        uu.tBase.value = this.levels[i].texture;
        (uu.uTexel.value as THREE.Vector2).set(1 / src.width, 1 / src.height);
        this.up.render(gl, this.ups[i]);
        src = this.ups[i];
      }
      this.uniforms.tBloom.value = src.texture;
    }
    this.final.render(gl, null);
  }
}

/** A full-screen-triangle mesh for scene backgrounds etc. (no camera math). */
export const makeFullscreenMesh = (material: THREE.ShaderMaterial) => {
  const m = new THREE.Mesh(fullscreenGeometry(), material);
  m.frustumCulled = false;
  return m;
};
