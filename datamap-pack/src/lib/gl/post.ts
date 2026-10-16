import * as THREE from "three";
import { BLUE_NOISE_SIZE, blueNoise } from "../bluenoise";
import { hexToRgb } from "../color";
import {
  BRIGHT_FRAG,
  DOWN_FRAG,
  FINAL_FRAG,
  FULLSCREEN_VERT,
  UP_FRAG,
} from "./shaders";

export type PostParams = {
  bgTop: string;
  bgBottom: string;
  bgCenter?: string;
  bgCenterPos?: [number, number, number]; // u, v, radius (in frame heights)
  bgCenterAmt?: number;
  vignette?: number;
  grain?: number; // peak amplitude, 0.01 = 1%
  bloom?: { strength: number; threshold: number; radius: number };
};

const fullscreenGeometry = () => {
  const g = new THREE.BufferGeometry();
  // One oversized triangle covering the viewport.
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return g;
};

const pass = (frag: string, uniforms: Record<string, THREE.IUniform>) => {
  const m = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  return m;
};

const halfRT = (w: number, h: number) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });

// Post chain: scene -> half-float RT -> optional bloom (13-tap down / tent
// up, all half-float) -> final pass: background gradient + scene + bloom,
// vignette, ~1% grain (fixed formula of pixel + loop frame, faded below 3%
// luminance) and +-1/255 blue-noise dither into the 8-bit canvas.
export class PostChain {
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private sceneRT: THREE.WebGLRenderTarget;
  private mips: THREE.WebGLRenderTarget[] = [];
  private bright: THREE.RawShaderMaterial;
  private down: THREE.RawShaderMaterial;
  private up: THREE.RawShaderMaterial;
  private final: THREE.RawShaderMaterial;
  private blue: THREE.DataTexture;
  private black: THREE.DataTexture;
  readonly res = new THREE.Vector2();

  constructor(
    private w: number,
    private h: number,
    private params: PostParams,
  ) {
    this.res.set(w, h);
    this.sceneRT = halfRT(w, h);
    if (params.bloom) {
      let mw = w;
      let mh = h;
      for (let i = 0; i < 6; i++) {
        mw = Math.max(1, Math.floor(mw / 2));
        mh = Math.max(1, Math.floor(mh / 2));
        this.mips.push(halfRT(mw, mh));
      }
    }
    this.blue = new THREE.DataTexture(blueNoise(), BLUE_NOISE_SIZE, BLUE_NOISE_SIZE, THREE.RGBAFormat);
    this.blue.needsUpdate = true;
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
    this.black.needsUpdate = true;

    this.bright = pass(BRIGHT_FRAG, { uTex: { value: null }, uThreshold: { value: 0.5 } });
    this.down = pass(DOWN_FRAG, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.up = pass(UP_FRAG, {
      uTex: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uRadius: { value: 1 },
    });
    this.up.blending = THREE.CustomBlending;
    this.up.blendSrc = THREE.OneFactor;
    this.up.blendDst = THREE.OneFactor;
    this.up.transparent = true;

    const c = (hex: string) => new THREE.Vector3(...hexToRgb(hex));
    this.final = pass(FINAL_FRAG, {
      uScene: { value: this.sceneRT.texture },
      uBloom: { value: this.black },
      uBlue: { value: this.blue },
      uBloomStrength: { value: params.bloom?.strength ?? 0 },
      uBgTop: { value: c(params.bgTop) },
      uBgBottom: { value: c(params.bgBottom) },
      uBgCenter: { value: c(params.bgCenter ?? params.bgTop) },
      uBgCenterPos: { value: new THREE.Vector3(...(params.bgCenterPos ?? [0.5, 0.5, 0.5])) },
      uBgCenterAmt: { value: params.bgCenterAmt ?? 0 },
      uVignette: { value: params.vignette ?? 0 },
      uGrain: { value: params.grain ?? 0.01 },
      uFrame: { value: 0 },
      uRes: { value: new THREE.Vector2(w, h) },
    });
    this.quad = new THREE.Mesh(fullscreenGeometry(), this.final);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private blit(gl: THREE.WebGLRenderer, m: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = m;
    gl.setRenderTarget(target);
    gl.render(this.quadScene, this.quadCam);
  }

  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, loopFrame: number) {
    gl.autoClear = false;
    gl.setRenderTarget(this.sceneRT);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    if (this.params.bloom && this.mips.length) {
      const b = this.params.bloom;
      this.bright.uniforms.uTex.value = this.sceneRT.texture;
      this.bright.uniforms.uThreshold.value = b.threshold;
      gl.setRenderTarget(this.mips[0]);
      gl.clear(true, false, false);
      this.blit(gl, this.bright, this.mips[0]);
      for (let i = 1; i < this.mips.length; i++) {
        const src = this.mips[i - 1];
        this.down.uniforms.uTex.value = src.texture;
        this.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        this.blit(gl, this.down, this.mips[i]);
      }
      for (let i = this.mips.length - 1; i > 0; i--) {
        const src = this.mips[i];
        this.up.uniforms.uTex.value = src.texture;
        this.up.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        this.up.uniforms.uRadius.value = b.radius;
        this.blit(gl, this.up, this.mips[i - 1]);
      }
      this.final.uniforms.uBloom.value = this.mips[0].texture;
    }
    this.final.uniforms.uFrame.value = loopFrame;
    this.blit(gl, this.final, null);
  }

  dispose() {
    this.sceneRT.dispose();
    this.mips.forEach((m) => m.dispose());
    this.blue.dispose();
    this.black.dispose();
  }

  get size() {
    return { w: this.w, h: this.h };
  }
}
