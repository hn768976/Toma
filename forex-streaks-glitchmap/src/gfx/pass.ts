import * as THREE from "three";

// A fullscreen triangle rendered with a ShaderMaterial. All passes use it.
const triangle = new THREE.BufferGeometry();
triangle.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export const VERT_FULLSCREEN = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export class Pass {
  readonly material: THREE.ShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly mesh: THREE.Mesh;

  constructor(fragmentShader: string, uniforms: Record<string, THREE.IUniform>, opts: Partial<THREE.ShaderMaterialParameters> = {}) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT_FULLSCREEN,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
      transparent: false,
      blending: THREE.NoBlending,
      toneMapped: false,
      ...opts,
    });
    this.mesh = new THREE.Mesh(triangle, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  /** Render into `target` (null = the canvas). */
  render(gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null, clear = false): void {
    gl.setRenderTarget(target);
    if (clear) {
      gl.setClearColor(0x000000, 0);
      gl.clear(true, false, false);
    }
    gl.render(this.scene, camera);
  }

  dispose(): void {
    this.material.dispose();
  }
}

export const makeRT = (
  w: number,
  h: number,
  opts: { mipmaps?: boolean; filter?: THREE.TextureFilter; depth?: boolean } = {},
): THREE.WebGLRenderTarget => {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: opts.mipmaps ? THREE.LinearMipmapLinearFilter : (opts.filter ?? THREE.LinearFilter),
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    generateMipmaps: !!opts.mipmaps,
    depthBuffer: !!opts.depth,
    stencilBuffer: false,
    colorSpace: THREE.NoColorSpace,
  });
  return rt;
};
