// Small, explicit post-processing toolkit for the three.js looks.
// Everything renders into half-float targets; only the final pass writes
// 8-bit output (with dither). No temporal effects, no history buffers.
import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

export const makeTarget = (w: number, h: number, depth = false) => {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  return rt;
};

export const FS_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const pass = (
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  blending: THREE.Blending = THREE.NoBlending,
) => {
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FS_VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    blending,
    toneMapped: false,
  });
  return { material, quad: new FullScreenQuad(material) };
};

// ---------------------------------------------------------------- bloom
// Dual-filter style: progressive 2x downsample (13-tap), then tent upsample
// accumulating back up the chain.
const DOWN_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 uTexel; // 1 / source size
uniform float uThreshold;
uniform float uFirst;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2.0, -2.0)), b = s(vec2(0.0, -2.0)), c = s(vec2(2.0, -2.0));
  vec3 d = s(vec2(-1.0, -1.0)), e = s(vec2(1.0, -1.0));
  vec3 f = s(vec2(-2.0, 0.0)), g = s(vec2(0.0, 0.0)), h = s(vec2(2.0, 0.0));
  vec3 i = s(vec2(-1.0, 1.0)), j = s(vec2(1.0, 1.0));
  vec3 k = s(vec2(-2.0, 2.0)), l = s(vec2(0.0, 2.0)), m = s(vec2(2.0, 2.0));
  vec3 col = (d + e + i + j) * 0.125
           + (a + c + k + m) * 0.03125
           + (b + f + h + l) * 0.0625
           + g * 0.125;
  if (uFirst > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    col *= max(br - uThreshold, 0.0) / max(br, 1e-5);
  }
  outColor = vec4(col, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tLow;   // smaller level (being upsampled)
uniform sampler2D tHigh;  // this level's downsample
uniform vec2 uTexel;      // 1 / low size
uniform float uRadius;
void main() {
  vec2 o = uTexel * uRadius;
  vec3 c = texture(tLow, vUv + vec2(-o.x, -o.y)).rgb
         + texture(tLow, vUv + vec2(0.0, -o.y)).rgb * 2.0
         + texture(tLow, vUv + vec2(o.x, -o.y)).rgb
         + texture(tLow, vUv + vec2(-o.x, 0.0)).rgb * 2.0
         + texture(tLow, vUv).rgb * 4.0
         + texture(tLow, vUv + vec2(o.x, 0.0)).rgb * 2.0
         + texture(tLow, vUv + vec2(-o.x, o.y)).rgb
         + texture(tLow, vUv + vec2(0.0, o.y)).rgb * 2.0
         + texture(tLow, vUv + vec2(o.x, o.y)).rgb;
  outColor = vec4(texture(tHigh, vUv).rgb + c / 16.0, 1.0);
}
`;

export class Bloom {
  levels: number;
  down: THREE.WebGLRenderTarget[] = [];
  up: THREE.WebGLRenderTarget[] = [];
  downPass = pass(DOWN_FRAG, {
    tSrc: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uThreshold: { value: 0 },
    uFirst: { value: 0 },
  });
  upPass = pass(UP_FRAG, {
    tLow: { value: null },
    tHigh: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uRadius: { value: 1 },
  });
  constructor(levels: number) {
    this.levels = levels;
  }
  setSize(w: number, h: number) {
    this.dispose();
    for (let i = 0; i < this.levels; i++) {
      const lw = Math.max(1, Math.round(w / 2 ** (i + 1)));
      const lh = Math.max(1, Math.round(h / 2 ** (i + 1)));
      this.down.push(makeTarget(lw, lh));
      this.up.push(makeTarget(lw, lh));
    }
  }
  // Returns the full bloom texture (half resolution of the source).
  render(
    renderer: THREE.WebGLRenderer,
    src: THREE.Texture,
    srcW: number,
    srcH: number,
    threshold: number,
  ) {
    const du = this.downPass.material.uniforms;
    let prev = src;
    let pw = srcW;
    let ph = srcH;
    for (let i = 0; i < this.levels; i++) {
      du.tSrc.value = prev;
      du.uTexel.value.set(1 / pw, 1 / ph);
      du.uThreshold.value = threshold;
      du.uFirst.value = i === 0 ? 1 : 0;
      renderer.setRenderTarget(this.down[i]);
      this.downPass.quad.render(renderer);
      prev = this.down[i].texture;
      pw = this.down[i].width;
      ph = this.down[i].height;
    }
    const uu = this.upPass.material.uniforms;
    let low = this.down[this.levels - 1];
    for (let i = this.levels - 2; i >= 0; i--) {
      uu.tLow.value = low.texture;
      uu.tHigh.value = this.down[i].texture;
      uu.uTexel.value.set(1 / low.width, 1 / low.height);
      renderer.setRenderTarget(this.up[i]);
      this.upPass.quad.render(renderer);
      low = this.up[i];
    }
    return low.texture;
  }
  dispose() {
    this.down.forEach((t) => t.dispose());
    this.up.forEach((t) => t.dispose());
    this.down = [];
    this.up = [];
  }
}
