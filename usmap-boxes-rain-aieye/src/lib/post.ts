import * as THREE from "three";
import { FULLSCREEN_VERT, HASH_GLSL } from "./glsl";

// Minimal fixed-pattern post-processing helpers (no temporal accumulation anywhere).

const triGeometry = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
  );
  return g;
})();

export class FullscreenPass {
  readonly material: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh;
  private readonly scene = new THREE.Scene();
  private static readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(fragment: string, uniforms: Record<string, THREE.IUniform>) {
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: `precision highp float;\nprecision highp int;\n${HASH_GLSL}\n${fragment}`,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(triGeometry, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  get uniforms() {
    return this.material.uniforms;
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, FullscreenPass.camera);
  }
}

export const makeTarget = (
  w: number,
  h: number,
  opts: THREE.RenderTargetOptions = {},
) =>
  new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...opts,
  });
