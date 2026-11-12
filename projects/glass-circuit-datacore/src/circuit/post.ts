import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";

/**
 * Layered depth of field.
 *
 * The opaque landscape and the transparent glass panels are rendered into
 * separate targets, each with its own depth texture. Each layer is blurred
 * with a single-pass golden-angle "scatter-as-gather" bokeh (after
 * D. Gustafsson) at reduced resolution and then merged with the full-res
 * sharp layer by circle-of-confusion. Because the glass has its own depth,
 * whatever is seen *through* a sharp panel is still correctly defocused.
 */

const quadVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const cocChunk = /* glsl */ `
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uBlurScale; // CoC in full-res pixels per unit of |1/f - 1/z|
uniform float uMaxCoc;    // full-res pixels
float linDepth(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
}
float cocOf(float z) {
  return clamp(uBlurScale * abs(1.0 / uFocus - 1.0 / z), 0.0, uMaxCoc);
}
`;

const dofFragment = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uFullRes;
uniform float uDownscale;   // full-res px per DOF-target px
uniform float uRadScale;    // sampling density (full-res px)
uniform float uWorldLayer;  // 1: write blur size into alpha (opaque layer)
varying vec2 vUv;
${cocChunk}
const float GOLDEN_ANGLE = 2.39996323;
void main() {
  float zc = linDepth(texture2D(tDepth, vUv).x);
  float cc = cocOf(zc);
  vec4 centre = texture2D(tColor, vUv);
  vec4 col = centre;
  float size = cc;
  float tot = 1.0;
  float radius = uRadScale;
  float ang = 0.0;
  for (int i = 0; i < 200; i++) {
    if (radius >= uMaxCoc) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * radius / uFullRes;
    vec4 sc = texture2D(tColor, tc);
    float zs = linDepth(texture2D(tDepth, tc).x);
    float ss = cocOf(zs);
    if (zs > zc) ss = min(ss, cc * 2.0);
    float m = smoothstep(radius - uRadScale, radius + uRadScale, ss);
    col += mix(col / tot, sc, m);
    size += mix(size / tot, ss, m);
    tot += 1.0;
    radius += uRadScale * uRadScale * 0.5 / radius + uRadScale * 0.15;
    ang += GOLDEN_ANGLE;
  }
  col /= tot;
  size /= tot;
  if (uWorldLayer > 0.5) col.a = size;
  gl_FragColor = col;
}
`;

const compositeFragment = /* glsl */ `
uniform sampler2D tWorld;
uniform sampler2D tWorldDepth;
uniform sampler2D tWorldDof;
uniform sampler2D tGlass;
uniform sampler2D tGlassDepth;
uniform sampler2D tGlassDof;
uniform vec2 uDofTexel;
varying vec2 vUv;
${cocChunk}
// small tent filter on the reduced-resolution bokeh to hide sampling rings
vec4 dofTap(sampler2D t, vec2 uv) {
  vec2 o = uDofTexel * 0.75;
  return 0.25 * (texture2D(t, uv + vec2(o.x, o.y)) + texture2D(t, uv + vec2(-o.x, o.y)) +
                 texture2D(t, uv + vec2(o.x, -o.y)) + texture2D(t, uv + vec2(-o.x, -o.y)));
}
void main() {
  vec3 ws = texture2D(tWorld, vUv).rgb;
  vec4 wd = dofTap(tWorldDof, vUv);
  float cw = cocOf(linDepth(texture2D(tWorldDepth, vUv).x));
  float mw = smoothstep(1.2, 4.0, max(cw, wd.a));
  vec3 world = mix(ws, wd.rgb, mw);

  vec4 gs = texture2D(tGlass, vUv);
  vec4 gd = dofTap(tGlassDof, vUv);
  float cg = cocOf(linDepth(texture2D(tGlassDepth, vUv).x));
  float mg = smoothstep(1.2, 4.0, cg);
  vec4 glass = mix(gs, gd, mg);

  gl_FragColor = vec4(world * (1.0 - glass.a) + glass.rgb, 1.0);
}
`;

export type DofParams = {
  near: number;
  far: number;
  focus: number;
  blurScale: number;
  maxCoc: number;
};

export class LayeredDofPass extends Pass {
  world: THREE.WebGLRenderTarget;
  glass: THREE.WebGLRenderTarget;
  private worldDof: THREE.WebGLRenderTarget;
  private glassDof: THREE.WebGLRenderTarget;
  private dofMat: THREE.ShaderMaterial;
  private compMat: THREE.ShaderMaterial;
  private quad: FullScreenQuad;
  params: DofParams;
  renderLayers: (renderer: THREE.WebGLRenderer) => void = () => {};

  constructor(width: number, height: number, params: DofParams, downscale = 3) {
    super();
    this.params = params;
    const mk = (w: number, h: number, depth: boolean) =>
      new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        depthBuffer: depth,
        depthTexture: depth ? new THREE.DepthTexture(w, h) : null,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
    this.world = mk(width, height, true);
    this.glass = mk(width, height, true);
    const dw = Math.round(width / downscale);
    const dh = Math.round(height / downscale);
    this.worldDof = mk(dw, dh, false);
    this.glassDof = mk(dw, dh, false);

    const shared = () => ({
      uNear: { value: params.near },
      uFar: { value: params.far },
      uFocus: { value: params.focus },
      uBlurScale: { value: params.blurScale },
      uMaxCoc: { value: params.maxCoc },
    });
    this.dofMat = new THREE.ShaderMaterial({
      uniforms: {
        ...shared(),
        tColor: { value: null },
        tDepth: { value: null },
        uFullRes: { value: new THREE.Vector2(width, height) },
        uDownscale: { value: downscale },
        uRadScale: { value: 1.25 * downscale },
        uWorldLayer: { value: 1 },
      },
      vertexShader: quadVertex,
      fragmentShader: dofFragment,
      depthTest: false,
      depthWrite: false,
    });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        ...shared(),
        tWorld: { value: this.world.texture },
        tWorldDepth: { value: this.world.depthTexture },
        tWorldDof: { value: this.worldDof.texture },
        tGlass: { value: this.glass.texture },
        tGlassDepth: { value: this.glass.depthTexture },
        tGlassDof: { value: this.glassDof.texture },
        uDofTexel: { value: new THREE.Vector2(1 / dw, 1 / dh) },
      },
      vertexShader: quadVertex,
      fragmentShader: compositeFragment,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.dofMat);
  }

  private syncParams(mat: THREE.ShaderMaterial) {
    mat.uniforms.uNear.value = this.params.near;
    mat.uniforms.uFar.value = this.params.far;
    mat.uniforms.uFocus.value = this.params.focus;
    mat.uniforms.uBlurScale.value = this.params.blurScale;
    mat.uniforms.uMaxCoc.value = this.params.maxCoc;
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
  ) {
    this.renderLayers(renderer);
    this.syncParams(this.dofMat);
    this.syncParams(this.compMat);
    this.quad.material = this.dofMat;

    this.dofMat.uniforms.tColor.value = this.world.texture;
    this.dofMat.uniforms.tDepth.value = this.world.depthTexture;
    this.dofMat.uniforms.uWorldLayer.value = 1;
    renderer.setRenderTarget(this.worldDof);
    this.quad.render(renderer);

    this.dofMat.uniforms.tColor.value = this.glass.texture;
    this.dofMat.uniforms.tDepth.value = this.glass.depthTexture;
    this.dofMat.uniforms.uWorldLayer.value = 0;
    renderer.setRenderTarget(this.glassDof);
    this.quad.render(renderer);

    this.quad.material = this.compMat;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.world.dispose();
    this.glass.dispose();
    this.worldDof.dispose();
    this.glassDof.dispose();
    this.dofMat.dispose();
    this.compMat.dispose();
    this.quad.dispose();
  }
}

/** Display-referred grade: desaturate, split-tone, vignette, fine grain. */
export const gradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uShadows: { value: new THREE.Vector3(1, 1, 1) },
    uHighlights: { value: new THREE.Vector3(1, 1, 1) },
    uSaturation: { value: 1 },
    uLift: { value: 0 },
    uVignette: { value: 0.3 },
    uGrain: { value: 0.02 },
    uSeed: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec3 uShadows;
uniform vec3 uHighlights;
uniform float uSaturation;
uniform float uLift;
uniform float uVignette;
uniform float uGrain;
uniform float uSeed;
uniform vec2 uRes;
varying vec2 vUv;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c *= mix(uShadows, uHighlights, smoothstep(0.0, 0.75, l));
  // lift > 0 raises blacks; lift < 0 sets a black point (crushes shadows)
  c = uLift >= 0.0 ? c * (1.0 - uLift) + uLift * uShadows * vec3(0.8, 0.9, 1.0)
                   : max(c + uLift, 0.0) / (1.0 + uLift);
  vec2 q = (vUv - 0.5) * vec2(1.0, 0.82);
  c *= 1.0 - uVignette * smoothstep(0.28, 0.75, length(q));
  // grain scaled to output pixels so it survives the 4K→1080p downscale softly
  float g = hash(floor(vUv * uRes * 0.5) + uSeed * 37.0) - 0.5;
  c += g * uGrain;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`,
};
