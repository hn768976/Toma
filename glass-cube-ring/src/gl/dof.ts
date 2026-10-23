import * as THREE from "three";

// Depth-of-field post chain (all sizes are fractions of frame height, so the
// look is identical at any render resolution):
//   1. scene -> full-res linear HDR colour + depth
//   2. half-res prepass: colour + signed circle of confusion packed in RGBA
//   3. half-res bokeh gather on a golden-angle disc (scatter-as-gather)
//   4. full-res composite: sharp pixels where in focus, bokeh elsewhere,
//      then exposure, vignette, ACES tone mapping, sRGB and fine grain.
export type DofSettings = {
  focusDistance: number; // world units from camera
  aperture: number; // CoC (fraction of height) = aperture * |1 - focus / z|
  maxCoc: number; // max blur radius, fraction of frame height
  exposure: number;
  vignette: number;
  grain: number;
};

const SAMPLES = 96;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const cocChunk = /* glsl */ `
#include <packing>
uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;
uniform float focusDistance;
uniform float aperture;
uniform float maxCoc;
float signedCoc(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  float z = -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
  return clamp(aperture * (1.0 - focusDistance / z), -maxCoc, maxCoc);
}`;

const prepassFrag = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 texel; // full-res texel size
${cocChunk}
varying vec2 vUv;
void main() {
  // 4-tap box downsample of colour; CoC from the nearest-to-camera tap so
  // foreground silhouettes keep their blur.
  vec2 o = texel * 0.5;
  vec3 c = texture2D(tColor, vUv + vec2(-o.x, -o.y)).rgb
         + texture2D(tColor, vUv + vec2( o.x, -o.y)).rgb
         + texture2D(tColor, vUv + vec2(-o.x,  o.y)).rgb
         + texture2D(tColor, vUv + vec2( o.x,  o.y)).rgb;
  float k0 = signedCoc(vUv + vec2(-o.x, -o.y));
  float k1 = signedCoc(vUv + vec2( o.x, -o.y));
  float k2 = signedCoc(vUv + vec2(-o.x,  o.y));
  float k3 = signedCoc(vUv + vec2( o.x,  o.y));
  float k = min(min(k0, k1), min(k2, k3));
  gl_FragColor = vec4(c * 0.25, k);
}`;

const gatherFrag = /* glsl */ `
uniform sampler2D tPre;
uniform float maxCoc;
uniform float aspect;
varying vec2 vUv;
void main() {
  vec4 center = texture2D(tPre, vUv);
  float kc = center.a;
  float cc = abs(kc);
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  const float GA = 2.39996323;
  for (int i = 0; i < ${SAMPLES}; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(${SAMPLES})) * maxCoc;
    float a = fi * GA;
    vec2 suv = vUv + vec2(cos(a) / aspect, sin(a)) * r;
    vec4 s = texture2D(tPre, suv);
    float cs = abs(s.a);
    // a sample behind the centre pixel may not bleed over it
    if (s.a > kc) cs = min(cs, cc);
    float w = clamp((cs - r) / (maxCoc / 10.0) + 1.0, 0.0, 1.0);
    w /= max(cs * cs, maxCoc * maxCoc * 0.01);
    acc += s.rgb * w;
    wsum += w;
  }
  vec3 col = wsum > 0.0 ? acc / wsum : center.rgb;
  gl_FragColor = vec4(col, cc);
}`;

const compositeFrag = /* glsl */ `
#include <common>
uniform sampler2D tColor;
uniform sampler2D tBokeh;
uniform float aspect;
uniform float exposure;
uniform float vignette;
uniform float grain;
uniform float seed;
${cocChunk}
varying vec2 vUv;
void main() {
  vec3 sharp = texture2D(tColor, vUv).rgb;
  vec4 bokeh = texture2D(tBokeh, vUv);
  float cc = max(abs(signedCoc(vUv)), bokeh.a);
  float k = smoothstep(maxCoc * 0.02, maxCoc * 0.12, cc);
  vec3 col = mix(sharp, bokeh.rgb, k) * exposure;
  vec2 q = vUv - 0.5;
  q.x *= aspect;
  col *= 1.0 - vignette * smoothstep(0.35, 1.1, length(q));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  float n = fract(sin(dot(floor(gl_FragCoord.xy) + seed * 17.0, vec2(12.9898, 78.233))) * 43758.5453);
  gl_FragColor.rgb += (n - 0.5) * grain;
}`;

const makeTarget = (w: number, h: number) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });

export class DofRenderer {
  private sceneTarget: THREE.WebGLRenderTarget;
  private preTarget: THREE.WebGLRenderTarget;
  private bokehTarget: THREE.WebGLRenderTarget;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private pre: THREE.ShaderMaterial;
  private gather: THREE.ShaderMaterial;
  private composite: THREE.ShaderMaterial;

  constructor(
    private renderer: THREE.WebGLRenderer,
    width: number,
    height: number,
  ) {
    const depthTexture = new THREE.DepthTexture(width, height);
    depthTexture.type = THREE.FloatType;
    this.sceneTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      depthTexture,
      depthBuffer: true,
      samples: 4,
    });
    const hw = Math.ceil(width / 2);
    const hh = Math.ceil(height / 2);
    this.preTarget = makeTarget(hw, hh);
    this.bokehTarget = makeTarget(hw, hh);
    const cocUniforms = () => ({
      tDepth: { value: depthTexture },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 100 },
      focusDistance: { value: 10 },
      aperture: { value: 0.01 },
      maxCoc: { value: 0.02 },
    });
    const common = { vertexShader, depthTest: false, depthWrite: false };
    this.pre = new THREE.ShaderMaterial({
      ...common,
      fragmentShader: prepassFrag,
      uniforms: {
        ...cocUniforms(),
        tColor: { value: this.sceneTarget.texture },
        texel: { value: new THREE.Vector2(1 / width, 1 / height) },
      },
      toneMapped: false,
    });
    this.gather = new THREE.ShaderMaterial({
      ...common,
      fragmentShader: gatherFrag,
      uniforms: {
        tPre: { value: this.preTarget.texture },
        maxCoc: { value: 0.02 },
        aspect: { value: width / height },
      },
      toneMapped: false,
    });
    this.composite = new THREE.ShaderMaterial({
      ...common,
      fragmentShader: compositeFrag,
      uniforms: {
        ...cocUniforms(),
        tColor: { value: this.sceneTarget.texture },
        tBokeh: { value: this.bokehTarget.texture },
        aspect: { value: width / height },
        exposure: { value: 1 },
        vignette: { value: 0 },
        grain: { value: 0 },
        seed: { value: 0 },
      },
      toneMapped: true,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.pre);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    s: DofSettings,
    seed: number,
  ) {
    for (const m of [this.pre, this.composite]) {
      const u = m.uniforms;
      u.cameraNear.value = camera.near;
      u.cameraFar.value = camera.far;
      u.focusDistance.value = s.focusDistance;
      u.aperture.value = s.aperture;
      u.maxCoc.value = s.maxCoc;
    }
    this.gather.uniforms.maxCoc.value = s.maxCoc;
    const cu = this.composite.uniforms;
    cu.exposure.value = s.exposure;
    cu.vignette.value = s.vignette;
    cu.grain.value = s.grain;
    cu.seed.value = seed;

    this.renderer.setRenderTarget(this.sceneTarget);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.pass(this.pre, this.preTarget);
    this.pass(this.gather, this.bokehTarget);
    this.pass(this.composite, null);
  }

  dispose() {
    this.sceneTarget.depthTexture?.dispose();
    this.sceneTarget.dispose();
    this.preTarget.dispose();
    this.bokehTarget.dispose();
    this.pre.dispose();
    this.gather.dispose();
    this.composite.dispose();
    this.quad.geometry.dispose();
  }
}
