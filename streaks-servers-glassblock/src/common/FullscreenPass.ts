import * as THREE from "three";
import { FULLSCREEN_VERT } from "./glsl";

/** A single full-screen triangle pair drawn with a RawShaderMaterial (GLSL3). */
export class FullscreenPass {
  readonly material: THREE.RawShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly mesh: THREE.Mesh;

  constructor(
    fragmentShader: string,
    uniforms: Record<string, THREE.IUniform>,
    opts: { blending?: THREE.Blending } = {},
  ) {
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
      blending: opts.blending ?? THREE.NoBlending,
      transparent: opts.blending !== undefined && opts.blending !== THREE.NoBlending,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  get uniforms() {
    return this.material.uniforms;
  }

  render(gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    gl.setRenderTarget(target);
    gl.render(this.scene, this.camera);
  }

  dispose() {
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}

export const makeTarget = (w: number, h: number, opts: { depth?: boolean; float?: boolean } = {}) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: opts.float === false ? THREE.UnsignedByteType : THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: opts.depth ?? false,
    stencilBuffer: false,
    generateMipmaps: false,
  });

/** Resize-on-demand render target holder. */
export class TargetCache {
  private map = new Map<string, THREE.WebGLRenderTarget>();
  get(key: string, w: number, h: number, opts: { depth?: boolean; float?: boolean } = {}) {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    let t = this.map.get(key);
    if (!t) {
      t = makeTarget(w, h, opts);
      this.map.set(key, t);
    } else if (t.width !== w || t.height !== h) {
      t.setSize(w, h);
    }
    return t;
  }
  dispose() {
    this.map.forEach((t) => t.dispose());
    this.map.clear();
  }
}
