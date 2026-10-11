// Single-frame post pipeline: HDR scene (4x MSAA, half-float) -> bloom
// (downsample / tent-upsample chain) -> filmic tone map, sRGB, grain and
// dither. No temporal accumulation of any kind.
import * as THREE from "three";
import { downFrag, finalFrag, fsVert, upFrag } from "./shaders";

const rtOpts = (): THREE.RenderTargetOptions => ({
  type: THREE.HalfFloatType,
  format: THREE.RGBAFormat,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  depthBuffer: false,
  generateMipmaps: false,
  colorSpace: THREE.LinearSRGBColorSpace,
  wrapS: THREE.ClampToEdgeWrapping,
  wrapT: THREE.ClampToEdgeWrapping,
});

export class Post {
  scene: THREE.WebGLRenderTarget;
  mips: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private fsScene = new THREE.Scene();
  private down: THREE.ShaderMaterial;
  private up: THREE.ShaderMaterial;
  final: THREE.ShaderMaterial;

  constructor(public width: number, public height: number) {
    this.scene = new THREE.WebGLRenderTarget(width, height, {
      ...rtOpts(),
      depthBuffer: true,
      samples: 4,
    });
    // Bloom levels down to ~1/64 of the frame height regardless of output
    // resolution, so the glow has the same size at 720p and 4K.
    const levels = Math.max(3, Math.round(Math.log2(height / 34)));
    let w = width, h = height;
    for (let i = 0; i < levels; i++) {
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
      this.mips.push(new THREE.WebGLRenderTarget(w, h, rtOpts()));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>, blending: THREE.Blending = THREE.NoBlending) =>
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3, vertexShader: fsVert, fragmentShader: frag, uniforms,
        depthTest: false, depthWrite: false, blending, toneMapped: false,
      });
    this.down = mk(downFrag, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0.85 }, uFirst: { value: 0 } });
    this.up = mk(upFrag, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() } }, THREE.AdditiveBlending);
    this.final = mk(finalFrag, {
      uScene: { value: this.scene.texture }, uBloom: { value: null }, uBloomStrength: { value: 0.08 },
      uExposure: { value: 1 }, uGrain: { value: 0.015 }, uFrame: { value: 0 },
    });
    this.quad = new THREE.Mesh(geo, this.down);
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);
  }

  private pass(gl: THREE.WebGLRenderer, mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null, clear: boolean) {
    this.quad.material = mat;
    gl.setRenderTarget(target);
    if (clear) gl.clear(true, false, false);
    gl.render(this.fsScene, this.cam);
  }

  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, opts: { exposure: number; frame: number; bloom: number; grain: number }) {
    const prevAuto = gl.autoClear;
    gl.autoClear = false;
    gl.setClearColor(0x000000, 1);
    gl.setRenderTarget(this.scene);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    // Bloom: downsample chain.
    let src: THREE.Texture = this.scene.texture;
    let sw = this.width, sh = this.height;
    this.mips.forEach((rt, i) => {
      this.down.uniforms.uTex.value = src;
      (this.down.uniforms.uTexel.value as THREE.Vector2).set(1 / sw, 1 / sh);
      this.down.uniforms.uFirst.value = i === 0 ? 1 : 0;
      this.pass(gl, this.down, rt, true);
      src = rt.texture;
      sw = rt.width; sh = rt.height;
    });
    // Upsample and accumulate back up to the first (half-res) level.
    for (let i = this.mips.length - 1; i > 0; i--) {
      const from = this.mips[i], to = this.mips[i - 1];
      this.up.uniforms.uTex.value = from.texture;
      (this.up.uniforms.uTexel.value as THREE.Vector2).set(1 / from.width, 1 / from.height);
      this.pass(gl, this.up, to, false);
    }
    const f = this.final.uniforms;
    f.uBloom.value = this.mips[0].texture;
    f.uBloomStrength.value = opts.bloom;
    f.uExposure.value = opts.exposure;
    f.uGrain.value = opts.grain;
    f.uFrame.value = opts.frame;
    this.pass(gl, this.final, null, true);
    gl.autoClear = prevAuto;
  }

  dispose() {
    this.scene.dispose();
    this.mips.forEach((m) => m.dispose());
    this.down.dispose();
    this.up.dispose();
    this.final.dispose();
  }
}
