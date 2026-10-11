import {
  BufferAttribute,
  BufferGeometry,
  GLSL3,
  Mesh,
  OrthographicCamera,
  RawShaderMaterial,
  Scene,
  type IUniform,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";

export const FULLSCREEN_VERT = /* glsl */ `
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

/** One full-screen triangle with a GLSL3 fragment shader. */
export class FullscreenPass {
  readonly material: RawShaderMaterial;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly geometry: BufferGeometry;

  constructor(fragmentShader: string, uniforms: Record<string, IUniform>) {
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2));
    this.material = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: "precision highp float;\nprecision highp int;\n" + fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(this.geometry, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  get uniforms() {
    return this.material.uniforms;
  }

  render(gl: WebGLRenderer, target: WebGLRenderTarget | null) {
    gl.setRenderTarget(target);
    gl.render(this.scene, this.camera);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
