import * as THREE from "three";
import { FULLSCREEN_VERT, HASH, HEADER } from "./shaders";
import type { RGB } from "./color";

// Post-processing shared by all three looks. Every pass is a pure function of its inputs and
// uniforms: no history buffers, no temporal filtering.
//
//   scene RT (linear HDR, mipmapped)
//     -> [optional] depth-of-field gather (fixed golden-angle pattern, CoC from an analytic plane)
//     -> [optional] sub-frame accumulation (motion blur as an average of deterministic sub-frames)
//     -> bloom (dual-filter mip chain)
//     -> composite: chromatic aberration, bloom, grade, soft-clip, vignette, sRGB, grain, dither

const rtOpts = (mips: boolean): THREE.RenderTargetOptions => ({
  type: THREE.HalfFloatType,
  format: THREE.RGBAFormat,
  minFilter: mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  generateMipmaps: mips,
  depthBuffer: true,
  colorSpace: THREE.NoColorSpace,
  wrapS: THREE.ClampToEdgeWrapping,
  wrapT: THREE.ClampToEdgeWrapping,
});

class FullscreenPass {
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mesh: THREE.Mesh;
  constructor(public material: THREE.RawShaderMaterial) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  render(gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    gl.setRenderTarget(target);
    gl.render(this.scene, this.camera);
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const pass = (frag: string, uniforms: Record<string, THREE.IUniform>, blending: THREE.Blending = THREE.NoBlending) =>
  new FullscreenPass(
    new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: frag,
      uniforms,
      depthTest: false,
      depthWrite: false,
      blending,
    }),
  );

// ---------------------------------------------------------------- depth of field (gather)
// For a plane, 1/depth is an affine function of NDC, so the circle of confusion anywhere on
// screen is K * |invDepth(ndc) - 1/zf| with invDepth = dot(invZ.xy, ndc) + invZ.z.
// The gather runs at half resolution and is merged with the sharp full-res image by CoC.
const DOF_COC = /* glsl */ `
uniform vec3 invZ;
uniform float focusInv;
uniform float cocK;       // CoC radius in full-res pixels = cocK * |1/zf - 1/z|
uniform float maxCoc;
float cocAt(vec2 uv) {
  float iz = max(dot(invZ.xy, uv * 2.0 - 1.0) + invZ.z, 0.0);
  return min(cocK * abs(focusInv - iz), maxCoc);
}
`;
const DOF_FRAG = /* glsl */ `${HEADER}
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform vec2 res;         // full-res size
${DOF_COC}
const int TAPS = 40;
void main() {
  float coc = cocAt(vUv);
  // Tap spacing decides which mip to read, so wide discs stay smooth with a fixed tap count.
  float spacing = max(coc, 1.0) * 1.772 / sqrt(float(TAPS));
  float lod = max(log2(spacing), 1.0);
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(TAPS)) * coc;
    float a = fi * 2.39996323;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r / res;
    // Scatter-as-gather: a tap only contributes if its own disc reaches this pixel.
    float w = clamp(cocAt(uv) - r + 1.0, 0.0, 1.0);
    sum += textureLod(tColor, uv, lod).rgb * w;
    wsum += w;
  }
  outColor = vec4(sum / max(wsum, 1e-4), 1.0);
}
`;
const DOF_MERGE = /* glsl */ `${HEADER}
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform sampler2D tBlur;
${DOF_COC}
void main() {
  float coc = cocAt(vUv);
  vec3 sharp = textureLod(tColor, vUv, 0.0).rgb;
  vec3 blur = texture(tBlur, vUv).rgb;
  outColor = vec4(mix(sharp, blur, smoothstep(0.6, 2.2, coc)), 1.0);
}
`;

// ---------------------------------------------------------------- bloom
const BLOOM_PREFILTER = /* glsl */ `${HEADER}
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform vec2 texel;
uniform float threshold;
uniform float knee;
void main() {
  vec3 c = vec3(0.0);
  c += texture(tColor, vUv + texel * vec2(-1.0, -1.0)).rgb;
  c += texture(tColor, vUv + texel * vec2( 1.0, -1.0)).rgb;
  c += texture(tColor, vUv + texel * vec2(-1.0,  1.0)).rgb;
  c += texture(tColor, vUv + texel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-5);
  float contrib = max(soft, br - threshold) / max(br, 1e-5);
  outColor = vec4(c * contrib, 1.0);
}
`;
const BLOOM_DOWN = /* glsl */ `${HEADER}
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform vec2 texel;
void main() {
  vec3 c = texture(tColor, vUv).rgb * 4.0;
  c += texture(tColor, vUv + texel * vec2(-1.0, -1.0)).rgb;
  c += texture(tColor, vUv + texel * vec2( 1.0, -1.0)).rgb;
  c += texture(tColor, vUv + texel * vec2(-1.0,  1.0)).rgb;
  c += texture(tColor, vUv + texel * vec2( 1.0,  1.0)).rgb;
  outColor = vec4(c / 8.0, 1.0);
}
`;
const BLOOM_UP = /* glsl */ `${HEADER}
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform vec2 texel;
uniform float weight;
void main() {
  vec3 c = vec3(0.0);
  c += texture(tColor, vUv + texel * vec2(-2.0, 0.0)).rgb;
  c += texture(tColor, vUv + texel * vec2( 2.0, 0.0)).rgb;
  c += texture(tColor, vUv + texel * vec2(0.0, -2.0)).rgb;
  c += texture(tColor, vUv + texel * vec2(0.0,  2.0)).rgb;
  c += texture(tColor, vUv + texel * vec2(-1.0, -1.0)).rgb * 2.0;
  c += texture(tColor, vUv + texel * vec2( 1.0, -1.0)).rgb * 2.0;
  c += texture(tColor, vUv + texel * vec2(-1.0,  1.0)).rgb * 2.0;
  c += texture(tColor, vUv + texel * vec2( 1.0,  1.0)).rgb * 2.0;
  outColor = vec4(c / 12.0 * weight, 1.0);
}
`;

// ---------------------------------------------------------------- accumulation
const COPY_FRAG = /* glsl */ `${HEADER}
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform float weight;
void main() { outColor = vec4(textureLod(tColor, vUv, 0.0).rgb * weight, 1.0); }
`;

// ---------------------------------------------------------------- composite
const COMPOSITE_FRAG = /* glsl */ `${HEADER}
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform vec2 res;
uniform float bloomStrength;
uniform float caEdge;       // radial chromatic aberration at the frame corners, fraction of width
uniform float rgbSplit;     // horizontal glitch split, fraction of width
uniform vec3 gradeGain;
uniform vec3 gradeLift;
uniform float exposure;
uniform float vignette;
uniform float grain;        // amplitude in output units (0.015 = 1.5%)
uniform uint grainFrame;    // frame % loop length
${HASH}

uniform float knee;
vec3 softClip(vec3 x) {
  float k = knee;
  vec3 over = max(x - k, 0.0);
  return min(x, vec3(k)) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 d = vUv - 0.5;
  float r2 = dot(d, d) * 2.0;
  vec2 ca = d * caEdge * r2 * 2.0 + vec2(rgbSplit, 0.0);
  vec3 col;
  col.r = textureLod(tColor, vUv - ca, 0.0).r;
  col.g = textureLod(tColor, vUv, 0.0).g;
  col.b = textureLod(tColor, vUv + ca, 0.0).b;
  vec3 bl;
  bl.r = texture(tBloom, vUv - ca * 1.5).r;
  bl.g = texture(tBloom, vUv).g;
  bl.b = texture(tBloom, vUv + ca * 1.5).b;
  col += bl * bloomStrength;
  col = col * exposure * gradeGain + gradeLift;
  col = softClip(col);
  // Vignette (aspect-corrected, smooth).
  vec2 dv = d * vec2(res.x / res.y, 1.0);
  float v = 1.0 - vignette * smoothstep(0.25, 1.05, length(dv));
  col *= v;
  vec3 s = toSrgb(col);
  // Grain then dither, from pixel position and (frame % loop) only.
  uvec2 p = uvec2(gl_FragCoord.xy);
  uint base = p.x * 1973u + p.y * 9277u;
  float g1 = hash3u(base, grainFrame, 11u);
  float g2 = hash3u(base, grainFrame, 23u);
  float gn = (g1 + g2 - 1.0);              // triangular, [-1, 1]
  s += gn * grain * (0.4 + 0.6 * sqrt(max(s, 0.0)));
  float d1 = hash3u(base, grainFrame, 37u);
  float d2 = hash3u(base, grainFrame, 51u);
  s += (d1 + d2 - 1.0) / 255.0;            // +-1/255 triangular dither
  outColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}
`;

export type DofParams = {
  camera: THREE.PerspectiveCamera;
  planeView: THREE.Vector4; // plane in view space
  focusDepth: number;
  cocK: number; // pixels at the current output height
  maxCoc: number; // pixels
};

export type CompositeParams = {
  bloomStrength: number;
  bloomThreshold: number;
  bloomKnee: number;
  bloomRadius: number; // 0..1 how much the wide levels contribute
  caEdge: number;
  rgbSplit: number;
  gradeGain: RGB;
  gradeLift: RGB;
  exposure: number;
  vignette: number;
  grain: number;
  grainFrame: number;
  knee?: number; // soft-clip knee (linear), default 0.78
};

const BLOOM_LEVELS = 6;

export class PostPipeline {
  w = 0;
  h = 0;
  scene: THREE.WebGLRenderTarget;
  dofRT: THREE.WebGLRenderTarget;
  accum: THREE.WebGLRenderTarget;
  bloomDown: THREE.WebGLRenderTarget[] = [];
  bloomUp: THREE.WebGLRenderTarget[] = [];
  private cocUniforms = {
    invZ: { value: new THREE.Vector3() },
    focusInv: { value: 0 },
    cocK: { value: 0 },
    maxCoc: { value: 0 },
  };
  private dofPass = pass(DOF_FRAG, { tColor: { value: null }, res: { value: new THREE.Vector2() }, ...this.cocUniforms });
  private dofMerge = pass(DOF_MERGE, { tColor: { value: null }, tBlur: { value: null }, ...this.cocUniforms });
  dofHalf: THREE.WebGLRenderTarget;
  private prefilter = pass(BLOOM_PREFILTER, {
    tColor: { value: null },
    texel: { value: new THREE.Vector2() },
    threshold: { value: 1 },
    knee: { value: 0.5 },
  });
  private down = pass(BLOOM_DOWN, { tColor: { value: null }, texel: { value: new THREE.Vector2() } });
  private up = pass(
    BLOOM_UP,
    { tColor: { value: null }, texel: { value: new THREE.Vector2() }, weight: { value: 1 } },
    THREE.AdditiveBlending,
  );
  private copyAdd = pass(COPY_FRAG, { tColor: { value: null }, weight: { value: 1 } }, THREE.AdditiveBlending);
  private composite = pass(COMPOSITE_FRAG, {
    tColor: { value: null },
    tBloom: { value: null },
    res: { value: new THREE.Vector2() },
    bloomStrength: { value: 0 },
    caEdge: { value: 0 },
    rgbSplit: { value: 0 },
    gradeGain: { value: new THREE.Vector3(1, 1, 1) },
    gradeLift: { value: new THREE.Vector3() },
    exposure: { value: 1 },
    vignette: { value: 0 },
    grain: { value: 0 },
    grainFrame: { value: 0 },
    knee: { value: 0.78 },
  });

  constructor(public gl: THREE.WebGLRenderer) {
    this.scene = new THREE.WebGLRenderTarget(1, 1, rtOpts(true));
    this.dofRT = new THREE.WebGLRenderTarget(1, 1, rtOpts(false));
    this.dofHalf = new THREE.WebGLRenderTarget(1, 1, { ...rtOpts(false), depthBuffer: false });
    this.accum = new THREE.WebGLRenderTarget(1, 1, rtOpts(false));
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      this.bloomDown.push(new THREE.WebGLRenderTarget(1, 1, { ...rtOpts(false), depthBuffer: false }));
      this.bloomUp.push(new THREE.WebGLRenderTarget(1, 1, { ...rtOpts(false), depthBuffer: false }));
    }
  }

  setSize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.scene.setSize(w, h);
    this.dofRT.setSize(w, h);
    this.dofHalf.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    this.accum.setSize(w, h);
    let bw = w;
    let bh = h;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      bw = Math.max(1, Math.round(bw / 2));
      bh = Math.max(1, Math.round(bh / 2));
      this.bloomDown[i].setSize(bw, bh);
      this.bloomUp[i].setSize(bw, bh);
    }
  }

  // Render a scene into the HDR scene target. Mipmaps are regenerated for the DoF gather.
  renderScene(scene: THREE.Scene, camera: THREE.Camera, clear: RGB) {
    const gl = this.gl;
    gl.setRenderTarget(this.scene);
    gl.setClearColor(new THREE.Color(clear[0], clear[1], clear[2]), 1);
    gl.clear(true, true, true);
    gl.render(scene, camera);
  }

  dof(p: DofParams): THREE.Texture {
    // 1/depth at three NDC points -> affine coefficients.
    const i00 = 1 / planeDepthAtNdc(p.camera, p.planeView, 0, 0);
    const i10 = 1 / planeDepthAtNdc(p.camera, p.planeView, 1, 0);
    const i01 = 1 / planeDepthAtNdc(p.camera, p.planeView, 0, 1);
    const c = this.cocUniforms;
    c.invZ.value.set(i10 - i00, i01 - i00, i00);
    c.focusInv.value = 1 / p.focusDepth;
    c.cocK.value = p.cocK;
    c.maxCoc.value = p.maxCoc;
    const u = this.dofPass.material.uniforms;
    u.tColor.value = this.scene.texture;
    u.res.value.set(this.w, this.h);
    this.dofPass.render(this.gl, this.dofHalf);
    const m = this.dofMerge.material.uniforms;
    m.tColor.value = this.scene.texture;
    m.tBlur.value = this.dofHalf.texture;
    this.dofMerge.render(this.gl, this.dofRT);
    return this.dofRT.texture;
  }

  clearAccum() {
    this.gl.setRenderTarget(this.accum);
    this.gl.setClearColor(0x000000, 0);
    this.gl.clear(true, false, false);
  }

  accumulate(tex: THREE.Texture, weight: number) {
    const u = this.copyAdd.material.uniforms;
    u.tColor.value = tex;
    u.weight.value = weight;
    this.copyAdd.render(this.gl, this.accum);
  }

  finish(src: THREE.Texture, p: CompositeParams) {
    const gl = this.gl;
    // Bloom chain.
    const pf = this.prefilter.material.uniforms;
    pf.tColor.value = src;
    pf.texel.value.set(1 / this.w, 1 / this.h);
    pf.threshold.value = p.bloomThreshold;
    pf.knee.value = p.bloomKnee;
    this.prefilter.render(gl, this.bloomDown[0]);
    for (let i = 1; i < BLOOM_LEVELS; i++) {
      const prev = this.bloomDown[i - 1];
      const du = this.down.material.uniforms;
      du.tColor.value = prev.texture;
      du.texel.value.set(1 / prev.width, 1 / prev.height);
      this.down.render(gl, this.bloomDown[i]);
    }
    // Up: start from the smallest level, add each upsampled level onto the next larger one.
    const last = BLOOM_LEVELS - 1;
    gl.setRenderTarget(this.bloomUp[last]);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, false, false);
    this.copyAdd.material.uniforms.tColor.value = this.bloomDown[last].texture;
    this.copyAdd.material.uniforms.weight.value = 1;
    this.copyAdd.render(gl, this.bloomUp[last]);
    for (let i = last - 1; i >= 0; i--) {
      gl.setRenderTarget(this.bloomUp[i]);
      gl.clear(true, false, false);
      this.copyAdd.material.uniforms.tColor.value = this.bloomDown[i].texture;
      this.copyAdd.material.uniforms.weight.value = 1;
      this.copyAdd.render(gl, this.bloomUp[i]);
      const uu = this.up.material.uniforms;
      uu.tColor.value = this.bloomUp[i + 1].texture;
      uu.texel.value.set(1 / this.bloomUp[i + 1].width, 1 / this.bloomUp[i + 1].height);
      uu.weight.value = p.bloomRadius;
      this.up.render(gl, this.bloomUp[i]);
    }
    // Composite to the canvas.
    const c = this.composite.material.uniforms;
    c.tColor.value = src;
    c.tBloom.value = this.bloomUp[0].texture;
    c.res.value.set(this.w, this.h);
    c.bloomStrength.value = p.bloomStrength;
    c.caEdge.value = p.caEdge;
    c.rgbSplit.value = p.rgbSplit;
    c.gradeGain.value.set(...p.gradeGain);
    c.gradeLift.value.set(...p.gradeLift);
    c.exposure.value = p.exposure;
    c.vignette.value = p.vignette;
    c.grain.value = p.grain;
    c.grainFrame.value = p.grainFrame >>> 0;
    c.knee.value = p.knee ?? 0.78;
    this.composite.render(gl, null);
  }

  dispose() {
    this.scene.dispose();
    this.dofRT.dispose();
    this.dofHalf.dispose();
    this.accum.dispose();
    this.bloomDown.forEach((r) => r.dispose());
    this.bloomUp.forEach((r) => r.dispose());
    [this.dofPass, this.dofMerge, this.prefilter, this.down, this.up, this.copyAdd, this.composite].forEach((p) => p.dispose());
  }
}

// View-space plane from a world-space plane (normal n, point p).
export const viewPlane = (camera: THREE.Camera, n: THREE.Vector3, p: THREE.Vector3, out = new THREE.Vector4()) => {
  const nv = n.clone().transformDirection(camera.matrixWorldInverse);
  const pv = p.clone().applyMatrix4(camera.matrixWorldInverse);
  return out.set(nv.x, nv.y, nv.z, -nv.dot(pv));
};

// View depth (positive) where the ray through NDC (x, y) hits the view-space plane.
export const planeDepthAtNdc = (camera: THREE.PerspectiveCamera, plane: THREE.Vector4, x: number, y: number) => {
  const v = new THREE.Vector4(x, y, 1, 1).applyMatrix4(camera.projectionMatrixInverse);
  const r = new THREE.Vector3(v.x / v.w, v.y / v.w, v.z / v.w).normalize();
  const dn = plane.x * r.x + plane.y * r.y + plane.z * r.z;
  const t = -plane.w / dn;
  return t * -r.z;
};
