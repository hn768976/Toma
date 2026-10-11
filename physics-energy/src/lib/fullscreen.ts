import * as THREE from "three";

// One oversized triangle covering clip space; used by every post pass.
export class FullScreen {
  private mesh: THREE.Mesh;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    this.mesh = new THREE.Mesh(g);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  render(gl: THREE.WebGLRenderer, material: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.mesh.material = material;
    gl.setRenderTarget(target);
    gl.render(this.scene, this.camera);
  }

  dispose() {
    this.mesh.geometry.dispose();
  }
}

export const FS_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const fsMaterial = (
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  blending: THREE.Blending = THREE.NoBlending,
) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FS_VERT,
    fragmentShader,
    uniforms,
    blending,
    depthTest: false,
    depthWrite: false,
    transparent: blending !== THREE.NoBlending,
  });
