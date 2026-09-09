import {
  AdditiveBlending,
  ClampToEdgeWrapping,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}
`;

/**
 * Minimal fullscreen-quad pass runner. One geometry, one camera, swap the
 * material — keeps the post chain cheap under software GL.
 */
export class QuadPass {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly mesh: Mesh;

  constructor(private readonly renderer: WebGLRenderer) {
    this.mesh = new Mesh(new PlaneGeometry(1, 1));
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  run(material: ShaderMaterial, target: WebGLRenderTarget | null, clear = true) {
    this.mesh.material = material;
    this.renderer.setRenderTarget(target);
    if (clear) this.renderer.clear(true, true, false);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.mesh.geometry.dispose();
  }
}

export const makeMaterial = (
  fragment: string,
  uniforms: Record<string, {value: unknown}>,
  additive = false
) =>
  new ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: fragment,
    uniforms: uniforms as never,
    depthTest: false,
    depthWrite: false,
    blending: additive ? AdditiveBlending : NoBlending,
    transparent: additive,
  });

export const makeTarget = (w: number, h: number, hdr: boolean) =>
  new WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
    format: RGBAFormat,
    type: hdr ? HalfFloatType : UnsignedByteType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    wrapS: ClampToEdgeWrapping,
    wrapT: ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });

/** Separable gaussian, unrolled at build time (GLSL ES 1.00 friendly). */
export const blurFragment = (sigma: number) => {
  const radius = Math.max(1, Math.min(24, Math.ceil(sigma * 2.6)));
  const raw: number[] = [];
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const w = Math.exp(-(i * i) / (2 * sigma * sigma));
    raw.push(w);
    sum += w;
  }
  const taps = raw
    .map(
      (w, i) =>
        `acc += texture2D(uTex, vUv + uStep * ${(i - radius).toFixed(1)}) * ${(
          w / sum
        ).toFixed(8)};`
    )
    .join('\n  ');
  return /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uStep;
void main() {
  vec4 acc = vec4(0.0);
  ${taps}
  gl_FragColor = acc;
}
`;
};

export const COPY_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uGain;
void main() { gl_FragColor = texture2D(uTex, vUv) * uGain; }
`;

export const THRESHOLD_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uThreshold;
void main() {
  vec3 c = texture2D(uTex, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  // Soft knee so the bloom builds smoothly out of the bright glyphs.
  float k = smoothstep(uThreshold, uThreshold + 0.35, l);
  gl_FragColor = vec4(c * k, 1.0);
}
`;
