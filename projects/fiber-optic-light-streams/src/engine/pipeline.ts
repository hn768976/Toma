import * as THREE from "three";

const FS_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const makeRT = (w: number, h: number) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
  });

export type GradeOptions = {
  exposure: number;
  bloomNear: number; // strength of the tight glow
  bloomWide: number; // strength of the wide glow
  saturation: number;
  lift: [number, number, number]; // additive black-level tint
  vignette: number;
};

/**
 * HDR render pipeline: scene -> half-float target -> two-level bloom ->
 * filmic exponential tone-map + grade -> canvas.
 */
export class Pipeline {
  renderer: THREE.WebGLRenderer;
  private hdr: THREE.WebGLRenderTarget;
  private half: THREE.WebGLRenderTarget;
  private q1: THREE.WebGLRenderTarget;
  private q2: THREE.WebGLRenderTarget;
  private e1: THREE.WebGLRenderTarget;
  private e2: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private fsScene = new THREE.Scene();
  private fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private copyMat: THREE.ShaderMaterial;
  private blurMat: THREE.ShaderMaterial;
  private finalMat: THREE.ShaderMaterial;

  constructor(canvas: HTMLCanvasElement, public width: number, public height: number) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x000000, 1);
    this.hdr = makeRT(width, height);
    this.half = makeRT(width >> 1, height >> 1);
    this.q1 = makeRT(width >> 2, height >> 2);
    this.q2 = makeRT(width >> 2, height >> 2);
    this.e1 = makeRT(width >> 3, height >> 3);
    this.e2 = makeRT(width >> 3, height >> 3);

    this.copyMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5));
          c += texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5));
          c += texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5));
          c += texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5));
          gl_FragColor = c * 0.25;
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tSrc, vUv) * 0.1964825501511404;
          c += texture2D(tSrc, vUv + uDir * 1.411764705882353) * 0.2969069646728344;
          c += texture2D(tSrc, vUv - uDir * 1.411764705882353) * 0.2969069646728344;
          c += texture2D(tSrc, vUv + uDir * 3.2941176470588234) * 0.09447039785044732;
          c += texture2D(tSrc, vUv - uDir * 3.2941176470588234) * 0.09447039785044732;
          c += texture2D(tSrc, vUv + uDir * 5.176470588235294) * 0.010381362401148057;
          c += texture2D(tSrc, vUv - uDir * 5.176470588235294) * 0.010381362401148057;
          gl_FragColor = c;
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.finalMat = new THREE.ShaderMaterial({
      uniforms: {
        tHdr: { value: null },
        tNear: { value: null },
        tWide: { value: null },
        uExposure: { value: 1 },
        uNear: { value: 0.3 },
        uWide: { value: 0.3 },
        uSat: { value: 1 },
        uLift: { value: new THREE.Vector3() },
        uVignette: { value: 0 },
        uRes: { value: new THREE.Vector2(width, height) },
      },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tHdr, tNear, tWide;
        uniform float uExposure, uNear, uWide, uSat, uVignette;
        uniform vec3 uLift; uniform vec2 uRes;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          vec3 c = texture2D(tHdr, vUv).rgb;
          c += texture2D(tNear, vUv).rgb * uNear + texture2D(tWide, vUv).rgb * uWide;
          c *= uExposure;
          vec3 m = 1.0 - exp(-c);
          float l = dot(m, vec3(0.2126, 0.7152, 0.0722));
          m = mix(vec3(l), m, uSat);
          vec2 d = vUv - 0.5; d.x *= uRes.x / uRes.y;
          m *= 1.0 - uVignette * smoothstep(0.35, 1.05, length(d));
          m += uLift;
          m += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
          gl_FragColor = vec4(clamp(m, 0.0, 1.0), 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.quad = new THREE.Mesh(geo, this.copyMat);
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.fsCam);
  }

  private downsample(src: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget) {
    this.copyMat.uniforms.tSrc.value = src.texture;
    this.copyMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
    this.pass(this.copyMat, dst);
  }

  private blur(a: THREE.WebGLRenderTarget, b: THREE.WebGLRenderTarget) {
    this.blurMat.uniforms.tSrc.value = a.texture;
    this.blurMat.uniforms.uDir.value.set(1 / a.width, 0);
    this.pass(this.blurMat, b);
    this.blurMat.uniforms.tSrc.value = b.texture;
    this.blurMat.uniforms.uDir.value.set(0, 1 / a.height);
    this.pass(this.blurMat, a);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, grade: GradeOptions) {
    this.renderer.setRenderTarget(this.hdr);
    this.renderer.clear();
    this.renderer.render(scene, camera);
    this.downsample(this.hdr, this.half);
    this.downsample(this.half, this.q1);
    this.blur(this.q1, this.q2);
    this.downsample(this.q1, this.e1);
    this.blur(this.e1, this.e2);
    this.blur(this.e1, this.e2);
    const u = this.finalMat.uniforms;
    u.tHdr.value = this.hdr.texture;
    u.tNear.value = this.q1.texture;
    u.tWide.value = this.e1.texture;
    u.uExposure.value = grade.exposure;
    u.uNear.value = grade.bloomNear;
    u.uWide.value = grade.bloomWide;
    u.uSat.value = grade.saturation;
    u.uLift.value.set(...grade.lift);
    u.uVignette.value = grade.vignette;
    this.pass(this.finalMat, null);
    this.renderer.getContext().finish();
  }

  dispose() {
    for (const rt of [this.hdr, this.half, this.q1, this.q2, this.e1, this.e2]) rt.dispose();
    this.renderer.dispose();
  }
}
