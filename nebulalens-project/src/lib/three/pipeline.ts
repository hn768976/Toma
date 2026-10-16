import * as THREE from "three";
import { BLUE_NOISE_SIZE, getBlueNoise } from "../blueNoise";
import { FULLSCREEN_VERT, GLSL_HEADER, GRAIN_DITHER, HASH } from "../glsl";

/**
 * Colours are authored and blended in display (sRGB-encoded) space, and the
 * canvas gets the values unchanged, so read hex strings without three's
 * sRGB→linear conversion.
 */
export const srgb = (hex: string) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const triangle = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  return g;
};

/** A full-screen fragment pass. */
export class FullscreenPass {
  readonly material: THREE.RawShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly mesh: THREE.Mesh;

  constructor(fragment: string, uniforms: Record<string, THREE.IUniform>, blending: THREE.Blending = THREE.NoBlending) {
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: fragment,
      uniforms,
      depthTest: false,
      depthWrite: false,
      blending,
      transparent: blending !== THREE.NoBlending,
    });
    this.mesh = new THREE.Mesh(triangle(), this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  get uniforms() {
    return this.material.uniforms;
  }

  render(gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    gl.setRenderTarget(target);
    gl.render(this.scene, camera);
  }

  dispose() {
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

/** Half-float colour target: no 8-bit quantisation until the final pass. */
export const halfFloatTarget = (w: number, h: number, opts: { samples?: number; depth?: boolean } = {}) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    depthBuffer: opts.depth ?? false,
    samples: opts.samples ?? 0,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    colorSpace: THREE.NoColorSpace,
  });

let blueTex: THREE.DataTexture | null = null;
export const blueNoiseTexture = () => {
  if (!blueTex) {
    blueTex = new THREE.DataTexture(
      getBlueNoise(),
      BLUE_NOISE_SIZE,
      BLUE_NOISE_SIZE,
      THREE.RedFormat,
      THREE.UnsignedByteType,
    );
    blueTex.minFilter = THREE.NearestFilter;
    blueTex.magFilter = THREE.NearestFilter;
    blueTex.wrapS = THREE.RepeatWrapping;
    blueTex.wrapT = THREE.RepeatWrapping;
    blueTex.generateMipmaps = false;
    blueTex.needsUpdate = true;
  }
  return blueTex;
};

/**
 * Final pass to the canvas: reads the half-float scene target, optionally lets
 * the caller add a few lines of colour work (`extra`, operating on `c` and
 * `uv`), then applies grain + blue-noise dither.
 */
export const makeFinalPass = (extra = "", extraUniforms: Record<string, THREE.IUniform> = {}, extraDecl = "") =>
  new FullscreenPass(
    GLSL_HEADER +
      HASH +
      GRAIN_DITHER +
      /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uRes;
${extraDecl}
in vec2 vUv;
out vec4 outColor;
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec2 uv = vUv;
  vec3 c = texelFetch(uSrc, px, 0).rgb;
  ${extra}
  outColor = vec4(grainDither(c, px), 1.0);
}
`,
    {
      uSrc: { value: null },
      uBlue: { value: blueNoiseTexture() },
      uFrame: { value: 0 },
      uRes: { value: new THREE.Vector2() },
      ...extraUniforms,
    },
  );

/**
 * Separable gaussian blur in half float. Radius is in *output pixels*; sigma
 * = radius / 2.5. Taps use linear filtering pairs.
 */
export class GaussianBlur {
  private readonly pass: FullscreenPass;
  private readonly tmp: THREE.WebGLRenderTarget;

  constructor(w: number, h: number) {
    this.tmp = halfFloatTarget(w, h);
    this.pass = new FullscreenPass(
      GLSL_HEADER +
        /* glsl */ `
uniform sampler2D uSrc;
uniform vec2 uDir;      // texel step direction (1/w,0) or (0,1/h)
uniform float uSigma;   // in pixels
in vec2 vUv;
out vec4 outColor;
void main() {
  if (uSigma < 0.3) { outColor = texture(uSrc, vUv); return; }
  float s2 = 2.0 * uSigma * uSigma;
  int n = int(ceil(uSigma * 3.0));
  vec4 acc = texture(uSrc, vUv);
  float wsum = 1.0;
  for (int i = 1; i <= 96; i += 2) {
    if (i > n) break;
    float a = exp(-float(i * i) / s2);
    float b = exp(-float((i + 1) * (i + 1)) / s2);
    float w = a + b;
    float o = float(i) + b / w;
    acc += w * (texture(uSrc, vUv + uDir * o) + texture(uSrc, vUv - uDir * o));
    wsum += 2.0 * w;
  }
  outColor = acc / wsum;
}
`,
      { uSrc: { value: null }, uDir: { value: new THREE.Vector2() }, uSigma: { value: 0 } },
    );
  }

  /** Blur src in place (src → tmp → src). */
  apply(gl: THREE.WebGLRenderer, src: THREE.WebGLRenderTarget, sigmaPx: number) {
    if (sigmaPx < 0.3) return;
    const u = this.pass.uniforms;
    u.uSigma.value = sigmaPx;
    u.uSrc.value = src.texture;
    u.uDir.value.set(1 / src.width, 0);
    this.pass.render(gl, this.tmp);
    u.uSrc.value = this.tmp.texture;
    u.uDir.value.set(0, 1 / src.height);
    this.pass.render(gl, src);
  }

  dispose() {
    this.pass.dispose();
    this.tmp.dispose();
  }
}
