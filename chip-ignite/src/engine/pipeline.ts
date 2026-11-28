import * as THREE from "three";
import {
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  MipmapBlurPass,
  RenderPass,
} from "postprocessing";
import { makeFullscreenTriangle } from "./output";
import type { FrameLook, Look, World } from "./types";

/**
 * Per-frame render pipeline (WebGL 2, half-float throughout):
 *
 *   scene (MSAA, HDR) -> depth of field            [pmndrs postprocessing]
 *     -> optional sub-frame accumulation (motion blur)
 *     -> bloom: soft-knee prefilter at a fixed 960x540, then two
 *        mip-chain blurs (tight core + wide halo)   [pmndrs MipmapBlurPass]
 *
 * The result (HDR colour + two bloom textures) is handed to the output
 * material, which React Three Fiber draws to the screen.
 *
 * Bloom and depth of field work at a fixed internal size, so a 1080p render
 * and a 4K render of the same frame have the same glow and blur size.
 * There is no temporal state: frame N never depends on frame N-1.
 */

const BLOOM_W = 960;
const BLOOM_H = 540;
// height of the depth-of-field blur buffers (the in-focus image stays full size)
const DOF_H = 720;

const fsVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export class Pipeline {
  readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly dof: DepthOfFieldEffect;
  private readonly dofPass: EffectPass;
  private readonly accum: THREE.WebGLRenderTarget;
  private readonly prefilter: THREE.WebGLRenderTarget;
  private readonly blurCore: MipmapBlurPass;
  private readonly blurHalo: MipmapBlurPass;
  private readonly fsScene = new THREE.Scene();
  private readonly fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly fsMesh: THREE.Mesh;
  private readonly addMat: THREE.ShaderMaterial;
  private readonly preMat: THREE.ShaderMaterial;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly world: World,
    private readonly look: Look,
    readonly width: number,
    readonly height: number,
  ) {
    const half = THREE.HalfFloatType;
    this.composer = new EffectComposer(gl, {
      frameBufferType: half,
      multisampling: look.msaa,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.composer.autoRenderToScreen = false;
    this.renderPass = new RenderPass(world.scene, world.camera);
    this.dof = new DepthOfFieldEffect(world.camera, {
      worldFocusDistance: 10,
      worldFocusRange: look.dof.focusRange,
      bokehScale: look.dof.bokehScale,
      resolutionY: DOF_H,
    });
    // Keep a fully sharp zone around the focus distance: by default the blur
    // starts growing right at the focus plane, which softens the subject.
    {
      const coc = this.dof.cocMaterial;
      const from = "smoothstep(0.0,focusRange,abs(signedDistance))";
      if (!coc.fragmentShader.includes(from)) {
        throw new Error("postprocessing: circle-of-confusion shader changed");
      }
      coc.fragmentShader = coc.fragmentShader.replace(
        from,
        "smoothstep(focusRange*0.3,focusRange,abs(signedDistance))",
      );
      coc.needsUpdate = true;
    }
    this.dofPass = new EffectPass(world.camera, this.dof);
    this.dofPass.enabled = look.dof.enabled;
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.dofPass);
    // EffectComposer.setSize() multiplies by the renderer's pixel ratio. The
    // sizes passed in here are already device pixels, so apply them with the
    // ratio set to 1 for a moment, then put the renderer back as it was.
    {
      const ratio = gl.getPixelRatio();
      const css = gl.getSize(new THREE.Vector2());
      gl.setPixelRatio(1);
      this.composer.setSize(width, height, false);
      gl.setPixelRatio(ratio);
      gl.setSize(css.x, css.y, false);
    }

    this.accum = new THREE.WebGLRenderTarget(width, height, {
      type: half,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.prefilter = new THREE.WebGLRenderTarget(BLOOM_W, BLOOM_H, {
      type: half,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.blurCore = new MipmapBlurPass();
    this.blurCore.levels = look.bloom.coreLevels;
    this.blurCore.initialize(gl, false, half);
    this.blurCore.setSize(BLOOM_W, BLOOM_H);
    this.blurHalo = new MipmapBlurPass();
    this.blurHalo.levels = look.bloom.haloLevels;
    this.blurHalo.initialize(gl, false, half);
    this.blurHalo.setSize(BLOOM_W, BLOOM_H);

    // additive copy used for the motion-blur accumulation
    this.addMat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      uniforms: { tMap: { value: null }, uWeight: { value: 1 } },
      vertexShader: fsVert,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tMap;
        uniform float uWeight;
        void main() { gl_FragColor = vec4(texture2D(tMap, vUv).rgb * uWeight, 1.0); }
      `,
    });
    // 4x4-tap box downsample + soft-knee threshold (bloom prefilter)
    this.preMat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        tMap: { value: null },
        uTexel: { value: new THREE.Vector2(1 / BLOOM_W, 1 / BLOOM_H) },
        uThreshold: { value: 1 },
        uKnee: { value: 0.5 },
      },
      vertexShader: fsVert,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tMap;
        uniform vec2 uTexel;
        uniform float uThreshold, uKnee;
        void main() {
          vec3 c = vec3(0.0);
          for (int j = 0; j < 4; j++) {
            for (int i = 0; i < 4; i++) {
              vec2 o = (vec2(float(i), float(j)) + 0.5) / 4.0 - 0.5;
              // clamp each tap so one fire-fly pixel cannot flicker the bloom
              c += min(texture2D(tMap, vUv + o * uTexel).rgb, vec3(64.0));
            }
          }
          c /= 16.0;
          float l = max(c.r, max(c.g, c.b));
          float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee);
          soft = soft * soft / (4.0 * uKnee + 1e-5);
          float w = max(soft, l - uThreshold) / max(l, 1e-5);
          gl_FragColor = vec4(c * max(w, 0.0), 1.0);
        }
      `,
    });
    this.fsMesh = new THREE.Mesh(makeFullscreenTriangle(), this.addMat);
    this.fsMesh.frustumCulled = false;
    this.fsScene.add(this.fsMesh);
  }

  private fullscreen(mat: THREE.Material, target: THREE.WebGLRenderTarget) {
    this.fsMesh.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.fsScene, this.fsCam);
  }

  /** Render one scene state through the composer; returns the HDR texture. */
  private renderScene(fl: FrameLook): THREE.Texture {
    const dofOn =
      this.look.dof.enabled && (fl.bokehScale ?? this.look.dof.bokehScale) > 0;
    this.dofPass.enabled = dofOn;
    if (dofOn) {
      // The blur buffers have a fixed height (DOF_H), so the blur is the same
      // fraction of the frame at any output size. Look values are given in
      // pixels of a 540-line frame, hence the constant factor.
      this.dof.bokehScale =
        (fl.bokehScale ?? this.look.dof.bokehScale) * (DOF_H / 540);
      const coc = this.dof.cocMaterial;
      coc.worldFocusDistance = fl.focus;
      coc.worldFocusRange = fl.focusRange ?? this.look.dof.focusRange;
    }
    this.composer.render(1 / 30);
    // RenderPass draws into inputBuffer; an enabled EffectPass swaps once.
    return dofOn
      ? this.composer.outputBuffer.texture
      : this.composer.inputBuffer.texture;
  }

  /**
   * Render frame `frame`. Returns the textures and per-frame look values the
   * output material needs.
   */
  render(frame: number) {
    const gl = this.gl;
    const prevTarget = gl.getRenderTarget();
    const prevAuto = gl.autoClear;
    gl.autoClear = true;

    const centre = this.world.apply(frame);
    const n = Math.max(1, Math.round(centre.motionSamples ?? 1));
    let hdr: THREE.Texture;
    if (n <= 1) {
      hdr = this.renderScene(centre);
    } else {
      const shutter = centre.shutter ?? 0.5;
      gl.setRenderTarget(this.accum);
      gl.setClearColor(0x000000, 1);
      gl.clear(true, false, false);
      this.addMat.uniforms.uWeight.value = 1 / n;
      for (let i = 0; i < n; i++) {
        const sub = frame + shutter * ((i + 0.5) / n - 0.5);
        const fl = this.world.apply(sub);
        const tex = this.renderScene(fl);
        this.addMat.uniforms.tMap.value = tex;
        gl.autoClear = false;
        this.fullscreen(this.addMat, this.accum);
        gl.autoClear = true;
      }
      this.world.apply(frame); // leave the scene at the frame centre
      hdr = this.accum.texture;
    }

    // ---- bloom ----------------------------------------------------------
    const b = this.look.bloom;
    this.preMat.uniforms.tMap.value = hdr;
    this.preMat.uniforms.uThreshold.value = b.threshold;
    this.preMat.uniforms.uKnee.value = b.knee;
    this.fullscreen(this.preMat, this.prefilter);
    this.blurCore.radius = b.coreRadius;
    this.blurHalo.radius = b.haloRadius;
    this.blurCore.render(gl, this.prefilter, null);
    this.blurHalo.render(gl, this.prefilter, null);

    gl.setRenderTarget(prevTarget);
    gl.autoClear = prevAuto;
    return {
      hdr,
      bloomCore: this.blurCore.texture,
      bloomHalo: this.blurHalo.texture,
      frameLook: centre,
    };
  }

  dispose() {
    this.composer.dispose();
    this.accum.dispose();
    this.prefilter.dispose();
    this.blurCore.dispose();
    this.blurHalo.dispose();
    this.addMat.dispose();
    this.preMat.dispose();
  }
}
