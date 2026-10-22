import * as THREE from "three";

// Depth of field + lens haze + tone mapping, done by hand instead of with
// three's BokehPass (whose few, fixed taps smear into streaks). The scene
// is rendered once at full resolution with a depth texture; a round,
// golden-angle "gather" bokeh (after Dennis Gustafsson's single-pass DOF)
// runs at quarter resolution, where large blur radii are cheap; the
// composite then picks the sharp full-res pixel wherever the circle of
// confusion is small and the blurred one elsewhere.

const LOW_RES_DIVISOR = 4;

const fullscreenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Shared circle-of-confusion maths. coc is signed (negative = in front of
// the focus plane) and normalised to [-1, 1]; multiply by the max blur
// radius for pixels.
const cocChunk = /* glsl */ `
  #include <packing>
  uniform sampler2D tDepth;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform float focus;
  uniform float focusScale;
  float viewDepth(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    return -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
  }
  float coc(float depth) {
    return clamp((1.0 / focus - 1.0 / depth) * focusScale, -1.0, 1.0);
  }
`;

const gatherFragment = /* glsl */ `
  uniform sampler2D tColor;
  uniform vec2 texel;
  uniform float maxBlur;
  varying vec2 vUv;
  ${cocChunk}
  const float GOLDEN_ANGLE = 2.39996323;
  const float RAD_SCALE = 0.6;
  void main() {
    float centerDepth = viewDepth(vUv);
    float centerSize = abs(coc(centerDepth)) * maxBlur;
    vec3 color = texture2D(tColor, vUv).rgb;
    float total = 1.0;
    float radius = RAD_SCALE;
    for (float ang = 0.0; ang < 2000.0; ang += GOLDEN_ANGLE) {
      if (radius >= maxBlur) break;
      vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * radius;
      vec3 sampleColor = texture2D(tColor, tc).rgb;
      float sampleDepth = viewDepth(tc);
      float sampleSize = abs(coc(sampleDepth)) * maxBlur;
      // Background samples may not bleed further than the centre's own
      // blur, so sharp foreground edges stay clean.
      if (sampleDepth > centerDepth) sampleSize = clamp(sampleSize, 0.0, centerSize * 2.0);
      float m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);
      color += mix(color / total, sampleColor, m);
      total += 1.0;
      radius += RAD_SCALE / radius;
    }
    gl_FragColor = vec4(color / total, 1.0);
  }
`;

const compositeFragment = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tBlur;
  uniform float maxBlur;
  uniform vec3 hazeColor;
  uniform vec2 hazeCenter;
  uniform float hazeRadius;
  uniform float hazeStrength;
  uniform float aspect;
  varying vec2 vUv;
  ${cocChunk}
  void main() {
    float blurPx = abs(coc(viewDepth(vUv))) * maxBlur;
    vec3 sharp = texture2D(tColor, vUv).rgb;
    vec3 soft = texture2D(tBlur, vUv).rgb;
    // maxBlur here is in low-res pixels; under ~1px the sharp pass wins.
    vec3 color = mix(sharp, soft, smoothstep(0.4, 1.4, blurPx));

    // Lens haze: screen-blend a soft glow around the light, washing the
    // blades nearest it out to lavender.
    vec2 d = (vUv - hazeCenter) * vec2(aspect, 1.0);
    float h = exp(-pow(length(d) / hazeRadius, 2.0) * 2.5) * hazeStrength;
    color = 1.0 - (1.0 - color) * (1.0 - hazeColor * h);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const cocUniforms = () => ({
  tDepth: { value: null as THREE.Texture | null },
  cameraNear: { value: 0.1 },
  cameraFar: { value: 100 },
  focus: { value: 5 },
  focusScale: { value: 1 },
});

export type DofParams = {
  focus: number;
  // How fast blur grows away from the focus plane.
  focusScale: number;
  // Maximum blur radius as a fraction of frame height.
  maxBlur: number;
  hazeColor: THREE.Color;
  hazeCenter: THREE.Vector2;
  hazeRadius: number;
  hazeStrength: number;
};

export class DofPipeline {
  private sceneTarget: THREE.WebGLRenderTarget;
  private blurTarget: THREE.WebGLRenderTarget;
  private gather: THREE.ShaderMaterial;
  private composite: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(
    private width: number,
    private height: number,
  ) {
    this.sceneTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      depthTexture: new THREE.DepthTexture(width, height, THREE.UnsignedIntType),
    });
    const lowW = Math.ceil(width / LOW_RES_DIVISOR);
    const lowH = Math.ceil(height / LOW_RES_DIVISOR);
    this.blurTarget = new THREE.WebGLRenderTarget(lowW, lowH, { type: THREE.HalfFloatType });

    this.gather = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: gatherFragment,
      uniforms: {
        ...cocUniforms(),
        tColor: { value: this.sceneTarget.texture },
        texel: { value: new THREE.Vector2(1 / lowW, 1 / lowH) },
        maxBlur: { value: 10 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.composite = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: compositeFragment,
      uniforms: {
        ...cocUniforms(),
        tColor: { value: this.sceneTarget.texture },
        tBlur: { value: this.blurTarget.texture },
        maxBlur: { value: 10 },
        hazeColor: { value: new THREE.Color() },
        hazeCenter: { value: new THREE.Vector2() },
        hazeRadius: { value: 0.5 },
        hazeStrength: { value: 0.5 },
        aspect: { value: width / height },
      },
      depthTest: false,
      depthWrite: false,
    });
    for (const m of [this.gather, this.composite]) {
      m.uniforms.tDepth.value = this.sceneTarget.depthTexture;
    }
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.gather);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    p: DofParams,
  ) {
    const lowH = Math.ceil(this.height / LOW_RES_DIVISOR);
    for (const m of [this.gather, this.composite]) {
      const u = m.uniforms;
      u.cameraNear.value = camera.near;
      u.cameraFar.value = camera.far;
      u.focus.value = p.focus;
      u.focusScale.value = p.focusScale;
      u.maxBlur.value = p.maxBlur * lowH;
    }
    const c = this.composite.uniforms;
    c.hazeColor.value.copy(p.hazeColor);
    c.hazeCenter.value.copy(p.hazeCenter);
    c.hazeRadius.value = p.hazeRadius;
    c.hazeStrength.value = p.hazeStrength;
    c.aspect.value = this.width / this.height;

    renderer.setRenderTarget(this.sceneTarget);
    renderer.render(scene, camera);

    this.quad.material = this.gather;
    renderer.setRenderTarget(this.blurTarget);
    renderer.render(this.quadScene, this.quadCamera);

    this.quad.material = this.composite;
    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCamera);
  }

  dispose() {
    this.sceneTarget.dispose();
    this.blurTarget.dispose();
    this.gather.dispose();
    this.composite.dispose();
  }
}
