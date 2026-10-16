import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { GLSL_HASH } from "../random";

export interface DofParams {
  /** View-space distance that is perfectly sharp. */
  focus: number;
  /** Blur radius at 720p, in px, per unit of |1 - focus / depth|. */
  aperture: number;
  /** Cap on the blur radius at 720p, in px. */
  maxCoc: number;
}

const VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Separable depth-of-field: a Gaussian whose radius comes from each pixel's
// own depth (thin-lens circle of confusion). Run once horizontally and once
// vertically. Good for these scenes, which are made of tilted planes.
const BLUR_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform vec2 uDir;
uniform float uNear, uFar, uFocus, uAperture, uMaxCoc, uPxPer720;
float viewZ(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}
float coc(vec2 uv) {
  float z = viewZ(texture(tDepth, uv).x);
  return min(uAperture * abs(1.0 - uFocus / z), uMaxCoc) * uPxPer720;
}
void main() {
  float c = coc(vUv);
  float sigma = c * 0.5;
  if (sigma < 0.35) { outColor = texture(tColor, vUv); return; }
  const int N = 16;
  float stepPx = max(sigma * 3.0 / float(N), 0.5);
  vec4 acc = vec4(0.0);
  float wsum = 0.0;
  for (int i = -N; i <= N; i++) {
    float x = float(i) * stepPx;
    vec2 uv = vUv + uDir * uTexel * x;
    // samples much sharper than us contribute less (limits halos)
    float cs = coc(uv) * 0.5;
    float w = exp(-0.5 * (x * x) / (sigma * sigma)) * mix(0.35, 1.0, smoothstep(0.0, sigma, cs + 0.5));
    acc += texture(tColor, uv) * w;
    wsum += w;
  }
  outColor = acc / wsum;
}
`;

// Final pass: +-1/255 dither and ~1% grain, both hashed from the integer
// pixel position and the frame (never Math.random). Grain fades out below
// 3% luminance.
const FINAL_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform uint uFrame;
uniform float uGrain;
uniform float uDither;
${GLSL_HASH}
void main() {
  vec3 c = texture(tColor, vUv).rgb;
  uvec2 p = uvec2(gl_FragCoord.xy);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float g = (hash3(p.x, p.y, uFrame) - 0.5) * 2.0 * uGrain * smoothstep(0.02, 0.04, l);
  float d = (hash3(p.x + 7919u, p.y + 104729u, uFrame) + hash3(p.y + 31u, p.x + 17u, uFrame + 9001u) - 1.0) * uDither / 255.0;
  outColor = vec4(clamp(c + g + d, 0.0, 1.0), 1.0);
}
`;

const makeRT = (w: number, h: number, depth: boolean) => {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    stencilBuffer: false,
  });
  if (depth) {
    rt.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    rt.depthTexture.minFilter = THREE.NearestFilter;
    rt.depthTexture.magFilter = THREE.NearestFilter;
  }
  return rt;
};

export class PostChain {
  private readonly rtScene: THREE.WebGLRenderTarget;
  private readonly rtA: THREE.WebGLRenderTarget;
  private readonly rtB: THREE.WebGLRenderTarget;
  private readonly blur: THREE.ShaderMaterial;
  private readonly final: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;

  constructor(readonly w: number, readonly h: number) {
    this.rtScene = makeRT(w, h, true);
    this.rtA = makeRT(w, h, false);
    this.rtB = makeRT(w, h, false);
    this.blur = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: BLUR_FRAG,
      uniforms: {
        tColor: { value: null },
        tDepth: { value: this.rtScene.depthTexture },
        uTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
        uDir: { value: new THREE.Vector2(1, 0) },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uFocus: { value: 10 },
        uAperture: { value: 4 },
        uMaxCoc: { value: 8 },
        uPxPer720: { value: h / 720 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.final = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FINAL_FRAG,
      uniforms: {
        tColor: { value: this.rtB.texture },
        uFrame: { value: 0 },
        uGrain: { value: 0.01 },
        uDither: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.blur);
  }

  render(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    loopFrame: number,
    dof: DofParams,
    grain = 0.01,
    dither = 1,
  ) {
    gl.setRenderTarget(this.rtScene);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, true, false);
    gl.render(scene, camera);

    const u = this.blur.uniforms;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uFocus.value = dof.focus;
    u.uAperture.value = dof.aperture;
    u.uMaxCoc.value = dof.maxCoc;

    this.quad.material = this.blur;
    u.tColor.value = this.rtScene.texture;
    u.uDir.value.set(1, 0);
    gl.setRenderTarget(this.rtA);
    this.quad.render(gl);

    u.tColor.value = this.rtA.texture;
    u.uDir.value.set(0, 1);
    gl.setRenderTarget(this.rtB);
    this.quad.render(gl);

    this.final.uniforms.uFrame.value = loopFrame >>> 0;
    this.final.uniforms.uGrain.value = grain;
    this.final.uniforms.uDither.value = dither;
    this.quad.material = this.final;
    gl.setRenderTarget(null);
    this.quad.render(gl);
  }

  dispose() {
    this.rtScene.dispose();
    this.rtA.dispose();
    this.rtB.dispose();
    this.blur.dispose();
    this.final.dispose();
    this.quad.dispose();
  }
}
