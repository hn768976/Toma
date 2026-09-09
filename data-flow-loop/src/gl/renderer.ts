import {
  AdditiveBlending,
  BufferAttribute,
  ColorManagement,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearSRGBColorSpace,
  Mesh,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import {LineMaterial} from 'three/examples/jsm/lines/LineMaterial.js';
import {LineSegments2} from 'three/examples/jsm/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import {
  DOF_BLUR_PX,
  LOOP_FRAMES,
  MASTER_HEIGHT,
  TILE_COPIES,
  TILE_WIDTH,
  type SceneConfig,
} from '../config';
import {buildField, type Field} from '../lib/field';
import {hexToRgb} from '../lib/prng';
import {
  blurFragment,
  COPY_FRAG,
  makeMaterial,
  makeTarget,
  QuadPass,
  THRESHOLD_FRAG,
} from './passes';
import {COMPOSITE_FRAG, GLYPH_FRAG, GLYPH_VERT} from './shaders';

ColorManagement.enabled = false;

const TAU = Math.PI * 2;
const MIN_QUAD_WIDTH_PX = 2.0;
const CHAIN_LEVELS = 4; // 1/2, 1/4, 1/8, 1/16

const pow2Divisor = (sigmaPx: number) => {
  let d = 2;
  while (d < 16 && sigmaPx / d > 2.6) d *= 2;
  return d;
};

export class DataFlowRenderer {
  readonly renderer: WebGLRenderer;
  private readonly camera: PerspectiveCamera;
  private readonly scenes: Scene[] = [];
  private readonly field: Field;
  private readonly uT = {value: 0};

  private readonly rtFull: WebGLRenderTarget;
  private readonly rtAccum: WebGLRenderTarget;
  private readonly chainA: WebGLRenderTarget[] = [];
  private readonly chainB: WebGLRenderTarget[] = [];

  private readonly quad: QuadPass;
  private readonly copyMat: ShaderMaterial;
  private readonly addMat: ShaderMaterial;
  private readonly thresholdMat: ShaderMaterial;
  private readonly compositeMat: ShaderMaterial;
  /** Per DOF bucket: divisor + the two 1-D blur materials. */
  private readonly dof: {
    divisor: number;
    blurH: ShaderMaterial;
    blurV: ShaderMaterial;
  }[] = [];
  private readonly bloomBlur: {h: ShaderMaterial; v: ShaderMaterial}[] = [];
  private readonly disposables: {dispose: () => void}[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    private readonly cfg: SceneConfig,
    private readonly width: number,
    private readonly height: number
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      // Required for headless screenshotting: the buffer must survive the
      // draw call so Remotion can capture it.
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 1);

    const hdr =
      this.renderer.capabilities.isWebGL2 &&
      (this.renderer.extensions.has('EXT_color_buffer_half_float') ||
        this.renderer.extensions.has('EXT_color_buffer_float'));

    this.quad = new QuadPass(this.renderer);
    this.field = buildField(cfg);

    this.camera = new PerspectiveCamera(cfg.camera.fov, width / height, 0.5, 420);
    this.camera.rotation.order = 'ZYX';

    for (let i = 0; i < DOF_BLUR_PX.length; i++) this.scenes.push(new Scene());

    this.buildStrands();
    this.buildGlyphs();

    // ------------------------------------------------------------ targets
    this.rtFull = makeTarget(width, height, hdr);
    this.rtAccum = makeTarget(width, height, hdr);
    for (let i = 1; i <= CHAIN_LEVELS; i++) {
      const s = 2 ** i;
      this.chainA[i] = makeTarget(width / s, height / s, hdr);
      this.chainB[i] = makeTarget(width / s, height / s, hdr);
    }

    // ------------------------------------------------------------- passes
    const scale = height / MASTER_HEIGHT;
    this.copyMat = makeMaterial(COPY_FRAG, {uTex: {value: null}, uGain: {value: 1}});
    this.addMat = makeMaterial(
      COPY_FRAG,
      {uTex: {value: null}, uGain: {value: 1}},
      true
    );
    this.thresholdMat = makeMaterial(THRESHOLD_FRAG, {
      uTex: {value: null},
      uThreshold: {value: cfg.bloom.threshold},
    });

    for (let i = 0; i < DOF_BLUR_PX.length; i++) {
      const sigmaPx = DOF_BLUR_PX[i] * scale;
      if (sigmaPx <= 0.01) {
        this.dof.push({divisor: 1, blurH: this.copyMat, blurV: this.copyMat});
        continue;
      }
      const divisor = pow2Divisor(sigmaPx);
      const frag = blurFragment(Math.max(0.55, sigmaPx / divisor));
      this.dof.push({
        divisor,
        blurH: makeMaterial(frag, {uTex: {value: null}, uStep: {value: new Vector2()}}),
        blurV: makeMaterial(frag, {uTex: {value: null}, uStep: {value: new Vector2()}}),
      });
    }

    const bloomFrag = blurFragment(3.0 * cfg.bloom.radius);
    for (let i = 0; i < 3; i++) {
      this.bloomBlur.push({
        h: makeMaterial(bloomFrag, {uTex: {value: null}, uStep: {value: new Vector2()}}),
        v: makeMaterial(bloomFrag, {uTex: {value: null}, uStep: {value: new Vector2()}}),
      });
    }

    const bg = cfg.background;
    this.compositeMat = makeMaterial(COMPOSITE_FRAG, {
      uScene: {value: this.rtAccum.texture},
      uBloom0: {value: this.chainB[2].texture},
      uBloom1: {value: this.chainB[3].texture},
      uBloom2: {value: this.chainB[4].texture},
      uResolution: {value: new Vector2(width, height)},
      uAspect: {value: width / height},
      uBgBase: {value: hexToRgb(bg.base)},
      uBgGlow: {value: hexToRgb(bg.glow)},
      uGlowOffset: {value: new Vector2(bg.glowOffset[0], bg.glowOffset[1])},
      uGlowRadius: {value: bg.glowRadius},
      uVignette: {value: bg.vignette},
      uExposure: {value: cfg.exposure},
      uBloomStrength: {value: cfg.bloom.strength},
      uCA: {value: cfg.chromaticAberration * scale},
      uGrain: {value: cfg.grain},
      uFrame: {value: 0},
    });
  }

  // ------------------------------------------------------------- geometry

  private buildStrands() {
    const {strands, widthBins} = this.field;
    const scale = this.height / MASTER_HEIGHT;

    for (let bucket = 0; bucket < DOF_BLUR_PX.length; bucket++) {
      for (let bin = 0; bin < widthBins.length; bin++) {
        const group = strands.filter((s) => s.bucket === bucket && s.widthBin === bin);
        if (group.length === 0) continue;

        const segsPer = group[0].positions.length / 3 - 1;
        const count = group.length * segsPer;
        const pos = new Float32Array(count * 6);
        const col = new Float32Array(count * 6);
        const a1a = new Float32Array(count * 3);
        const a1b = new Float32Array(count * 3);
        const a2a = new Float32Array(count * 3);
        const a2b = new Float32Array(count * 3);
        const wave = new Float32Array(count * 4);

        let k = 0;
        for (const s of group) {
          const [r, g, b] = s.colour;
          const o = s.opacity;
          for (let i = 0; i < segsPer; i++) {
            const a = i * 3;
            const c = (i + 1) * 3;
            pos.set([s.positions[a], s.positions[a + 1], s.positions[a + 2]], k * 6);
            pos.set([s.positions[c], s.positions[c + 1], s.positions[c + 2]], k * 6 + 3);
            col.set([r * o, g * o, b * o, r * o, g * o, b * o], k * 6);
            a1a.set([s.amp1[a], s.amp1[a + 1], s.amp1[a + 2]], k * 3);
            a1b.set([s.amp1[c], s.amp1[c + 1], s.amp1[c + 2]], k * 3);
            a2a.set([s.amp2[a], s.amp2[a + 1], s.amp2[a + 2]], k * 3);
            a2b.set([s.amp2[c], s.amp2[c + 1], s.amp2[c + 2]], k * 3);
            wave.set(s.wave, k * 4);
            k++;
          }
        }

        const geo = new LineSegmentsGeometry();
        geo.setPositions(pos);
        geo.setColors(col);
        geo.setAttribute('aAmp1A', new InstancedBufferAttribute(a1a, 3));
        geo.setAttribute('aAmp1B', new InstancedBufferAttribute(a1b, 3));
        geo.setAttribute('aAmp2A', new InstancedBufferAttribute(a2a, 3));
        geo.setAttribute('aAmp2B', new InstancedBufferAttribute(a2b, 3));
        geo.setAttribute('aWave', new InstancedBufferAttribute(wave, 4));
        this.disposables.push(geo);

        // Line width is authored in master (4K) pixels. The quad is widened to
        // give the edge falloff room; the true width drives the alpha profile,
        // so energy — and the look — is identical at any render size.
        const wantedPx = widthBins[bin] * scale;
        const quadPx = Math.max(wantedPx, MIN_QUAD_WIDTH_PX);
        const uTrueHalf = {value: wantedPx * 0.5};

        const mat = new LineMaterial({
          vertexColors: true,
          linewidth: quadPx,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          blending: AdditiveBlending,
          worldUnits: false,
        });
        mat.resolution.set(this.width, this.height);
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uT = this.uT;
          shader.uniforms.uTrueHalf = uTrueHalf;
          shader.vertexShader = shader.vertexShader
            .replace(
              'attribute vec3 instanceStart;',
              /* glsl */ `
              attribute vec3 instanceStart;
              attribute vec3 aAmp1A;
              attribute vec3 aAmp1B;
              attribute vec3 aAmp2A;
              attribute vec3 aAmp2B;
              attribute vec4 aWave;
              uniform float uT;
              vec3 dfDisp(vec3 a1, vec3 a2) {
                return a1 * sin(6.283185307 * (aWave.x * uT + aWave.y))
                     + a2 * sin(6.283185307 * (aWave.z * uT + aWave.w));
              }
              `
            )
            .replace(
              'vec4 start = modelViewMatrix * vec4( instanceStart, 1.0 );',
              'vec4 start = modelViewMatrix * vec4( instanceStart + dfDisp(aAmp1A, aAmp2A), 1.0 );'
            )
            .replace(
              'vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );',
              'vec4 end = modelViewMatrix * vec4( instanceEnd + dfDisp(aAmp1B, aAmp2B), 1.0 );'
            );
          shader.fragmentShader = shader.fragmentShader
            .replace(
              'uniform float linewidth;',
              'uniform float linewidth;\nuniform float uTrueHalf;'
            )
            .replace(
              'float alpha = opacity;',
              /* glsl */ `
              float alpha = opacity;
              // vUv.x runs across the quad's width, vUv.y along its length.
              // The quad is widened to MIN_QUAD_WIDTH_PX so the edge has room
              // to fall off; uTrueHalf is the authored half-width, so a
              // sub-pixel strand stays correctly faint instead of dropping out.
              float dpx = abs(vUv.x) * linewidth * 0.5;
              alpha *= 1.0 - smoothstep(uTrueHalf - 0.5, uTrueHalf + 0.5, dpx);
              `
            );
        };
        this.disposables.push(mat);

        for (let c = 0; c < TILE_COPIES; c++) {
          const mesh = new LineSegments2(geo, mat);
          mesh.position.x = (c - (TILE_COPIES - 1) / 2) * TILE_WIDTH;
          mesh.frustumCulled = false;
          mesh.renderOrder = 0;
          this.scenes[bucket].add(mesh);
        }
      }
    }
  }

  private buildGlyphs() {
    const plane = new PlaneGeometry(1, 1);
    const dFocus = this.cfg.camera.z - this.cfg.camera.focusZ;
    const pxToWorld =
      (2 * Math.tan((this.cfg.camera.fov * Math.PI) / 360) * dFocus) / MASTER_HEIGHT;

    for (const g of this.field.glyphs) {
      const geo = new InstancedBufferGeometry();
      geo.setIndex(plane.getIndex());
      geo.setAttribute('position', plane.getAttribute('position') as BufferAttribute);
      geo.setAttribute('uv', plane.getAttribute('uv') as BufferAttribute);
      geo.setAttribute('aOffset', new InstancedBufferAttribute(g.offset, 3));
      geo.setAttribute('aSize', new InstancedBufferAttribute(g.size, 2));
      geo.setAttribute('aType', new InstancedBufferAttribute(g.type, 1));
      geo.setAttribute('aColour', new InstancedBufferAttribute(g.colour, 3));
      geo.setAttribute('aAnim', new InstancedBufferAttribute(g.anim, 4));
      geo.instanceCount = g.type.length;
      this.disposables.push(geo);

      for (let c = 0; c < TILE_COPIES; c++) {
        const mat = new ShaderMaterial({
          vertexShader: GLYPH_VERT,
          fragmentShader: GLYPH_FRAG,
          uniforms: {
            uT: this.uT,
            uTile: {value: TILE_WIDTH},
            uTileOffset: {value: (c - (TILE_COPIES - 1) / 2) * TILE_WIDTH},
            uPxToWorld: {value: pxToWorld},
            uRenderH: {value: this.height},
            uMinPx: {value: 0.75},
          },
          transparent: true,
          blending: AdditiveBlending,
          depthTest: false,
          depthWrite: false,
        });
        this.disposables.push(mat);
        const mesh = new Mesh(geo, mat);
        mesh.frustumCulled = false;
        mesh.renderOrder = 1;
        this.scenes[g.bucket].add(mesh);
      }
    }
    plane.dispose();
  }

  // --------------------------------------------------------------- camera

  private placeCamera(frame: number) {
    const cam = this.cfg.camera;
    const t = (frame % LOOP_FRAMES) / LOOP_FRAMES;

    // Dominant move: a constant truck along -X of exactly one tile width, so
    // frame 600 sees precisely what frame 0 saw.
    const x = TILE_WIDTH / 2 - t * this.cfg.cameraTravel;
    // Everything else is built from sin/cos of an integer multiple of the loop
    // so it returns exactly to its start.
    const z = cam.z - cam.dolly * 0.5 * (1 - Math.cos(TAU * t));
    const y = cam.y + cam.bobAmplitude * Math.sin(TAU * cam.bobCycles * t);
    const roll =
      ((cam.rollDegrees * Math.PI) / 180) * Math.sin(TAU * cam.rollCycles * t);

    this.camera.position.set(x, y, z);
    this.camera.rotation.set(0, 0, roll);
    this.camera.updateMatrixWorld();
  }

  // --------------------------------------------------------------- render

  private blit(
    mat: ShaderMaterial,
    src: WebGLRenderTarget,
    dst: WebGLRenderTarget | null,
    clear: boolean,
    step?: [number, number]
  ) {
    mat.uniforms.uTex.value = src.texture;
    if (step && mat.uniforms.uStep) {
      (mat.uniforms.uStep.value as Vector2).set(step[0], step[1]);
    }
    this.quad.run(mat, dst, clear);
  }

  render(frame: number) {
    const t = (frame % LOOP_FRAMES) / LOOP_FRAMES;
    this.uT.value = t;
    this.placeCamera(frame);

    // Clear the accumulator, then fold in each depth bucket.
    this.renderer.setRenderTarget(this.rtAccum);
    this.renderer.clear(true, true, false);

    // Most defocused bucket first, sharpest last. Buckets are keyed on
    // distance from the focus plane, so this is back-to-front for everything
    // except the shallow near band — and since every layer is additive with no
    // depth writes, the order is presentational rather than load-bearing.
    for (let i = DOF_BLUR_PX.length - 1; i >= 0; i--) {
      if (this.scenes[i].children.length === 0) continue;

      this.renderer.setRenderTarget(this.rtFull);
      this.renderer.clear(true, true, false);
      this.renderer.render(this.scenes[i], this.camera);

      const {divisor, blurH, blurV} = this.dof[i];
      if (divisor === 1) {
        this.blit(this.addMat, this.rtFull, this.rtAccum, false);
        continue;
      }

      // Successive halvings — a straight bilinear jump to 1/16 would alias.
      let src: WebGLRenderTarget = this.rtFull;
      let level = 0;
      while (2 ** (level + 1) <= divisor) {
        level++;
        this.blit(this.copyMat, src, this.chainA[level], true);
        src = this.chainA[level];
      }
      const w = this.chainA[level].width;
      const h = this.chainA[level].height;
      this.blit(blurH, this.chainA[level], this.chainB[level], true, [1 / w, 0]);
      this.blit(blurV, this.chainB[level], this.chainA[level], true, [0, 1 / h]);
      this.blit(this.addMat, this.chainA[level], this.rtAccum, false);
    }

    // ---------------------------------------------------------- bloom
    this.blit(this.copyMat, this.rtAccum, this.chainA[1], true);
    this.blit(this.copyMat, this.chainA[1], this.chainA[2], true);
    this.blit(this.thresholdMat, this.chainA[2], this.chainB[2], true);

    for (let i = 0; i < 3; i++) {
      const level = i + 2;
      if (i > 0) this.blit(this.copyMat, this.chainB[level - 1], this.chainB[level], true);
      const {h: bh, v: bv} = this.bloomBlur[i];
      const w = this.chainA[level].width;
      const hgt = this.chainA[level].height;
      this.blit(bh, this.chainB[level], this.chainA[level], true, [1 / w, 0]);
      this.blit(bv, this.chainA[level], this.chainB[level], true, [0, 1 / hgt]);
    }

    // ------------------------------------------------------ final grade
    this.compositeMat.uniforms.uFrame.value = frame % LOOP_FRAMES;
    this.quad.run(this.compositeMat, null, true);
    this.renderer.setRenderTarget(null);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.rtFull.dispose();
    this.rtAccum.dispose();
    for (let i = 1; i <= CHAIN_LEVELS; i++) {
      this.chainA[i].dispose();
      this.chainB[i].dispose();
    }
    this.quad.dispose();
    this.copyMat.dispose();
    this.addMat.dispose();
    this.thresholdMat.dispose();
    this.compositeMat.dispose();
    for (const d of this.dof) {
      d.blurH.dispose();
      d.blurV.dispose();
    }
    for (const b of this.bloomBlur) {
      b.h.dispose();
      b.v.dispose();
    }
    this.renderer.dispose();
  }
}

