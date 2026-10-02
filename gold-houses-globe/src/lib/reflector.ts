import * as THREE from "three";

// Glossy floor reflection: the scene is rendered from a mirrored camera into
// a half-float target (oblique near plane = the floor), then blurred with a
// few separable Gaussian passes at reduced resolution. The floor material
// samples it with the projective `textureMatrix`. Purely per-frame, no history.

const BLUR_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 dir; // texel step
void main() {
  vec3 c = texture(tSrc, vUv).rgb * 0.2270270270;
  c += texture(tSrc, vUv + dir * 1.3846153846).rgb * 0.3162162162;
  c += texture(tSrc, vUv - dir * 1.3846153846).rgb * 0.3162162162;
  c += texture(tSrc, vUv + dir * 3.2307692308).rgb * 0.0702702703;
  c += texture(tSrc, vUv - dir * 3.2307692308).rgb * 0.0702702703;
  outColor = vec4(c, 1.0);
}`;
const VERT = /* glsl */ `
precision highp float;
in vec3 position;
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class GlossyReflector {
  readonly textureMatrix = new THREE.Matrix4();
  private rt: THREE.WebGLRenderTarget;
  private a: THREE.WebGLRenderTarget;
  private b: THREE.WebGLRenderTarget;
  private cam = new THREE.PerspectiveCamera();
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private blurMat: THREE.RawShaderMaterial;

  /**
   * @param scale resolution of the mirror render relative to the frame
   * @param blur  blur radius as a fraction of frame height (0 = mirror)
   */
  constructor(
    width: number,
    height: number,
    scale = 0.5,
    private blur = 0.004,
    private iterations = 2,
  ) {
    const w = Math.round(width * scale), h = Math.round(height * scale);
    this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    const bw = Math.round(w / 2), bh = Math.round(h / 2);
    this.a = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType, depthBuffer: false });
    this.b = new THREE.WebGLRenderTarget(bw, bh, { type: THREE.HalfFloatType, depthBuffer: false });
    this.blurMat = new THREE.RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: BLUR_FRAG,
      glslVersion: THREE.GLSL3,
      uniforms: { tSrc: { value: null }, dir: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const q = new THREE.Mesh(geo, this.blurMat);
    q.frustumCulled = false;
    this.quadScene.add(q);
  }

  /** The texture floors should sample. */
  get texture() {
    return this.blur > 0 ? this.a.texture : this.rt.texture;
  }

  /**
   * Render the mirrored scene. `floor` is a mesh whose local +Z is the
   * reflection normal (e.g. a PlaneGeometry rotated -PI/2 about X).
   */
  update(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, floor: THREE.Object3D, hide: THREE.Object3D[] = []) {
    const normal = new THREE.Vector3(0, 0, 1);
    const rot = new THREE.Matrix4().extractRotation(floor.matrixWorld);
    normal.applyMatrix4(rot);
    const fp = new THREE.Vector3().setFromMatrixPosition(floor.matrixWorld);
    const cp = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const view = new THREE.Vector3().subVectors(fp, cp).reflect(normal).negate().add(fp);
    const crot = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const look = new THREE.Vector3(0, 0, -1).applyMatrix4(crot).add(cp);
    const target = new THREE.Vector3().subVectors(fp, look).reflect(normal).negate().add(fp);
    const vc = this.cam;
    vc.position.copy(view);
    vc.up.set(0, 1, 0).applyMatrix4(crot).reflect(normal);
    vc.lookAt(target);
    vc.near = camera.near;
    vc.far = camera.far;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);

    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);

    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, fp);
    plane.applyMatrix4(vc.matrixWorldInverse);
    const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = vc.projectionMatrix;
    const q = new THREE.Vector4(
      (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0],
      (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5],
      -1,
      (1 + pm.elements[10]) / pm.elements[14],
    );
    clip.multiplyScalar(2 / clip.dot(q));
    pm.elements[2] = clip.x;
    pm.elements[6] = clip.y;
    pm.elements[10] = clip.z + 1;
    pm.elements[14] = clip.w;
    vc.projectionMatrixInverse.copy(pm).invert();

    const vis = [floor, ...hide].map((o) => o.visible);
    floor.visible = false;
    hide.forEach((o) => (o.visible = false));
    gl.setRenderTarget(this.rt);
    gl.clear(true, true, true);
    gl.render(scene, vc);
    [floor, ...hide].forEach((o, i) => (o.visible = vis[i]));

    if (this.blur > 0) {
      const px = this.blur * this.a.height; // blur radius in blur-target px
      const step = Math.max(0.5, px / (3.2 * this.iterations));
      let src: THREE.Texture = this.rt.texture;
      for (let i = 0; i < this.iterations; i++) {
        this.blurMat.uniforms.tSrc.value = src;
        this.blurMat.uniforms.dir.value.set(step / this.a.width, 0);
        gl.setRenderTarget(this.b);
        gl.render(this.quadScene, this.quadCam);
        this.blurMat.uniforms.tSrc.value = this.b.texture;
        this.blurMat.uniforms.dir.value.set(0, step / this.a.height);
        gl.setRenderTarget(this.a);
        gl.render(this.quadScene, this.quadCam);
        src = this.a.texture;
      }
    }
  }
}

/** GLSL snippet for floor shaders: declare + sample the blurred reflection. */
export const REFLECT_GLSL = /* glsl */ `
uniform sampler2D tReflect;
uniform mat4 textureMatrix;
vec3 sampleReflection(vec3 worldPos, vec2 distort) {
  vec4 p = textureMatrix * vec4(worldPos, 1.0);
  vec2 uv = p.xy / p.w + distort;
  return texture2D(tReflect, uv).rgb;
}
`;
