import * as THREE from "three";

// Post pipeline: scene (MSAA + depth) -> circle-of-confusion pack ->
// two-pass bokeh gather -> grade (vignette / grain) to the canvas.

const VERT = /* glsl */ `
out vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
`;

const COC_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform float uNear, uFar, uFocus, uAperture, uMaxCoc;
void main(){
  float d = texture(tDepth, vUv).x;
  float ndc = d * 2. - 1.;
  float z = 2. * uNear * uFar / (uFar + uNear - ndc * (uFar - uNear));
  float coc = clamp((1. / uFocus - 1. / z) * uAperture, -uMaxCoc, uMaxCoc);
  o = vec4(texture(tColor, vUv).rgb, coc / uMaxCoc * .5 + .5);
}
`;

const dofFrag = (taps: number) => /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tColor;
uniform float uMaxCoc, uAspect, uScale, uRot;
const int N = ${taps};
const float GA = 2.39996323;
void main(){
  vec4 c = texture(tColor, vUv);
  float cc = c.a * 2. - 1.;
  float cs = abs(cc);
  vec3 acc = c.rgb; float tot = 1.;
  float soft = 1.2 / sqrt(float(N));
  // per-pixel jitter (interleaved gradient noise) turns tap banding into
  // fine noise that the second pass smooths away
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
  for (int i = 0; i < N; i++){
    float r = sqrt((float(i) + ign) / float(N));
    float a = float(i) * GA + uRot + ign * 6.2831853;
    vec2 off = vec2(cos(a) / uAspect, sin(a)) * r * uMaxCoc * uScale;
    vec4 s = texture(tColor, vUv + off);
    float sc = s.a * 2. - 1.;
    float ss = abs(sc);
    if (sc > cc) ss = min(ss, cs * 2.);
    float m = smoothstep(r - soft, r + soft, ss);
    acc += mix(acc / tot, s.rgb, m);
    tot += 1.;
  }
  o = vec4(acc / tot, c.a);
}
`;

const GRADE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tColor;
uniform float uVignette, uGrain, uSeed, uContrast, uSat, uGrainPx;
uniform vec2 uRes;
uniform vec3 uLift;
float h12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main(){
  vec3 c = texture(tColor, vUv).rgb;
  vec2 q = vUv - .5;
  float v = 1. - uVignette * smoothstep(.25, .95, length(q * vec2(1.25, 1.)) * 1.35);
  c *= v;
  c = (c - .5) * uContrast + .5;
  float l = dot(c, vec3(.2126, .7152, .0722));
  c = mix(vec3(l), c, uSat) + uLift;
  // grain is defined on a fixed 1080p lattice so 4K and 1080p look alike
  vec2 gp = floor(vUv * uRes / uGrainPx);
  float g = h12(gp + uSeed * vec2(17.13, 31.77)) + h12(gp * 1.37 + uSeed * vec2(5.1, 9.7)) - 1.;
  c += g * uGrain;
  o = vec4(clamp(c, 0., 1.), 1.);
}
`;

export type PostOptions = {
  focus: number;
  aperture: number;
  maxCoc: number; // fraction of frame height
  vignette: number;
  grain: number;
  contrast: number;
  saturation: number;
  lift: [number, number, number];
  frame: number;
};

export class Post {
  private sceneRT: THREE.WebGLRenderTarget;
  private a: THREE.WebGLRenderTarget;
  private b: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private qScene = new THREE.Scene();
  private qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private coc: THREE.ShaderMaterial;
  private dof1: THREE.ShaderMaterial;
  private dof2: THREE.ShaderMaterial;
  private grade: THREE.ShaderMaterial;

  constructor(
    private renderer: THREE.WebGLRenderer,
    w: number,
    h: number,
  ) {
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedIntType;
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      samples: 4,
      depthTexture,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const mk = () =>
      new THREE.WebGLRenderTarget(w, h, {
        depthBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
    this.a = mk();
    this.b = mk();
    const mat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERT,
        fragmentShader: frag,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });
    this.coc = mat(COC_FRAG, {
      tColor: { value: this.sceneRT.texture },
      tDepth: { value: depthTexture },
      uNear: { value: 0.1 },
      uFar: { value: 100 },
      uFocus: { value: 8 },
      uAperture: { value: 0.3 },
      uMaxCoc: { value: 0.03 },
    });
    const dofU = (tex: THREE.Texture, scale: number, rot: number) => ({
      tColor: { value: tex },
      uMaxCoc: { value: 0.03 },
      uAspect: { value: w / h },
      uScale: { value: scale },
      uRot: { value: rot },
    });
    this.dof1 = mat(dofFrag(96), dofU(this.a.texture, 1, 0));
    this.dof2 = mat(dofFrag(32), dofU(this.b.texture, 0.2, 1.3));
    this.grade = mat(GRADE_FRAG, {
      tColor: { value: this.a.texture },
      uVignette: { value: 0.3 },
      uGrain: { value: 0.02 },
      uSeed: { value: 0 },
      uContrast: { value: 1 },
      uSat: { value: 1 },
      uLift: { value: new THREE.Vector3() },
      uRes: { value: new THREE.Vector2(w, h) },
      uGrainPx: { value: h / 1080 },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.coc);
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
  }

  private pass(
    m: THREE.ShaderMaterial,
    target: THREE.WebGLRenderTarget | null,
  ) {
    this.quad.material = m;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qScene, this.qCam);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, o: PostOptions) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);

    const cu = this.coc.uniforms;
    cu.uNear.value = camera.near;
    cu.uFar.value = camera.far;
    cu.uFocus.value = o.focus;
    cu.uAperture.value = o.aperture;
    cu.uMaxCoc.value = o.maxCoc;
    this.dof1.uniforms.uMaxCoc.value = o.maxCoc;
    this.dof2.uniforms.uMaxCoc.value = o.maxCoc;
    const gu = this.grade.uniforms;
    gu.uVignette.value = o.vignette;
    gu.uGrain.value = o.grain;
    gu.uSeed.value = (o.frame % 997) + 1;
    gu.uContrast.value = o.contrast;
    gu.uSat.value = o.saturation;
    (gu.uLift.value as THREE.Vector3).set(...o.lift);

    this.pass(this.coc, this.a);
    this.pass(this.dof1, this.b);
    this.pass(this.dof2, this.a);
    this.pass(this.grade, null);
  }

  dispose() {
    this.sceneRT.dispose();
    this.a.dispose();
    this.b.dispose();
    this.quad.geometry.dispose();
    [this.coc, this.dof1, this.dof2, this.grade].forEach((m) => m.dispose());
  }
}
