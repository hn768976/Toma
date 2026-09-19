import {
  Geometry,
  GlProgram,
  RenderTexture,
  Shader,
  State,
  Texture,
  UniformGroup,
  type UniformData,
  type WebGLRenderer,
} from "pixi.js";

import { QUAD_VERT } from "./shaders/lib";
import { FIELD_FRAG } from "./shaders/field.frag";
import { CELLS_FRAG } from "./shaders/cells.frag";
import { BLUR_FRAG, BRIGHT_FRAG, COMPOSITE_FRAG } from "./shaders/post.frag";
import { BASE_WIDTH, type GlitchVariant } from "./variants";

/**
 * Render graph, five stages:
 *
 *   field   1/8  low-frequency control field — the expensive fBm, kept small
 *   cells   1/1  the pixel-cell mosaic itself
 *   bright  1/2  soft-knee bright pass, box-downsampled from cells
 *   blur    1/4 then 1/8, separable and anisotropic (wide across, tight down)
 *   comp    1/1  bloom mix, aberration, scanlines, grain, vignette, tone
 *
 * Driven straight off `renderer.renderTarget` / `renderer.encoder` rather than
 * through the scene graph. Pixi's mesh pipeline injects `globalUniforms` and
 * `localUniforms` blocks that a full-screen quad has no use for; going direct
 * keeps every pass to exactly the uniforms it declares, and keeps a single
 * orientation convention across render textures and the canvas alike.
 *
 * Nothing carries over between frames — each pass is a pure function of the
 * loop phase, so Remotion may render frames in any order, on any worker.
 */

const quadState = () => {
  const state = State.for2d();
  state.blend = false;
  state.depthTest = false;
  state.culling = false;
  return state;
};

const quadGeometry = () =>
  new Geometry({
    attributes: { aPosition: [0, 0, 1, 0, 1, 1, 0, 1] },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });

const f32 = (value: number): UniformData => ({ value, type: "f32" });
const vec2 = (x: number, y: number): UniformData => ({
  value: new Float32Array([x, y]),
  type: "vec2<f32>",
});
const vec3 = (x: number, y: number, z: number): UniformData => ({
  value: new Float32Array([x, y, z]),
  type: "vec3<f32>",
});

/** 256x1 LUT baked from the variant's colour stops. Cheaper and far more
 *  expressive than packing stops into uniform arrays, whose std140 padding
 *  rules for vec3 are a recurring source of silent breakage. */
const buildPaletteTexture = (stops: string[]): Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable for palette LUT");

  const gradient = ctx.createLinearGradient(0, 0, 256, 0);
  stops.forEach((color, i) => {
    gradient.addColorStop(i / (stops.length - 1), color);
  });
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 1);

  const texture = Texture.from(canvas);
  texture.source.scaleMode = "linear";
  texture.source.addressMode = "clamp-to-edge";
  return texture;
};

type PassOptions = {
  fragment: string;
  name: string;
  uniforms: Record<string, UniformData>;
  textures?: Record<string, Texture>;
};

class Pass {
  readonly shader: Shader;
  readonly uniforms: Record<string, number | Float32Array>;
  private readonly accessor: Record<string, unknown>;

  constructor({ fragment, name, uniforms, textures = {} }: PassOptions) {
    const group = new UniformGroup(uniforms, { ubo: false });
    const resources: Record<string, unknown> = { [`${name}Uniforms`]: group };
    for (const [key, texture] of Object.entries(textures)) {
      resources[key] = texture.source;
    }

    this.shader = new Shader({
      glProgram: GlProgram.from({ vertex: QUAD_VERT, fragment, name }),
      resources,
    });
    this.uniforms = group.uniforms as Record<string, number | Float32Array>;
    this.accessor = this.shader.resources as unknown as Record<string, unknown>;
  }

  setTexture(key: string, texture: Texture) {
    this.accessor[key] = texture.source;
  }
}

const createTarget = (
  width: number,
  height: number,
  format: "rgba8unorm" | "rgba16float",
) => {
  const target = RenderTexture.create({
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    format,
    antialias: false,
  });
  target.source.scaleMode = "linear";
  target.source.addressMode = "clamp-to-edge";
  return target;
};

export class GlitchEngine {
  private readonly renderer: WebGLRenderer;
  private readonly variant: GlitchVariant;
  private readonly scale: number;

  private readonly geometry = quadGeometry();
  private readonly state = quadState();

  private readonly palette: Texture;
  private readonly rtField: RenderTexture;
  private readonly rtCells: RenderTexture;
  private readonly rtBright: RenderTexture;
  private readonly rtBlurA0: RenderTexture;
  private readonly rtBlurA1: RenderTexture;
  private readonly rtBlurB0: RenderTexture;
  private readonly rtBlurB1: RenderTexture;

  private readonly fieldPass: Pass;
  private readonly cellsPass: Pass;
  private readonly brightPass: Pass;
  private readonly blurPass: Pass;
  private readonly compositePass: Pass;

  constructor(
    renderer: WebGLRenderer,
    variant: GlitchVariant,
    width: number,
    height: number,
  ) {
    this.renderer = renderer;
    this.variant = variant;
    this.scale = width / BASE_WIDTH;

    // Cell brightness routinely exceeds 1.0 (hot cores times streak boost), and
    // clipping that in the base pass would flatten exactly the highlights the
    // bloom is meant to catch. Half-float targets keep the headroom where the
    // context allows it.
    const hdr = renderer.context.extensions.colorBufferFloat
      ? ("rgba16float" as const)
      : ("rgba8unorm" as const);

    this.palette = buildPaletteTexture(variant.palette);
    this.rtField = createTarget(width / 8, height / 8, "rgba8unorm");
    this.rtCells = createTarget(width, height, hdr);
    this.rtBright = createTarget(width / 2, height / 2, hdr);
    this.rtBlurA0 = createTarget(width / 4, height / 4, hdr);
    this.rtBlurA1 = createTarget(width / 4, height / 4, hdr);
    this.rtBlurB0 = createTarget(width / 8, height / 8, hdr);
    this.rtBlurB1 = createTarget(width / 8, height / 8, hdr);

    const { field, cells, post } = variant;

    this.fieldPass = new Pass({
      fragment: FIELD_FRAG,
      name: "field",
      uniforms: {
        uFieldFreq: vec2(...field.fieldFreq),
        uPeriod: vec3(...field.period),
        uDriftPeriods: vec3(...field.driftPeriods),
        uPhase: f32(0),
        uSeed: f32(variant.seed),
        uDensityBias: f32(field.densityBias),
        uDensityGain: f32(field.densityGain),
        uBandAmount: f32(field.bandAmount),
        uColumnAmount: f32(field.columnAmount),
      },
    });

    this.cellsPass = new Pass({
      fragment: CELLS_FRAG,
      name: "cells",
      textures: { uField: this.rtField, uPalette: this.palette },
      uniforms: {
        uRenderSize: vec2(width, height),
        uScale: f32(this.scale),
        uPhase: f32(0),
        uLoopTime: f32(variant.durationInSeconds),
        uSeed: f32(variant.seed),
        uCell: vec2(...cells.cell),
        uGutter: vec2(...cells.gutter),
        uSpeedSteps: f32(cells.speedSteps),
        uCoverage: f32(cells.coverage),
        uRunCoherence: f32(cells.runCoherence),
        uMaxRun: f32(cells.maxRun),
        uHoleChance: f32(cells.holeChance),
        uStreakChance: f32(cells.streakChance),
        uStreakRun: f32(cells.streakRun),
        uStreakBoost: f32(cells.streakBoost),
        uTwinkleCycles: f32(cells.twinkleCycles),
        uTwinkleDepth: f32(cells.twinkleDepth),
        uCellSparkle: f32(cells.cellSparkle),
        uHotChance: f32(cells.hotChance),
        uHotBoost: f32(cells.hotBoost),
        uPrimaryChance: f32(cells.primaryChance),
        uHueJitter: f32(cells.hueJitter),
        uRowHueJitter: f32(cells.rowHueJitter),
        uBright: f32(cells.bright),
        uSat: f32(cells.sat),
        uRowWarp: f32(cells.rowWarp),
        uRowJitter: f32(cells.rowJitter),
        uWaveFreq: f32(cells.waveFreq),
        uWaveCycles: f32(cells.waveCycles),
        uTearChance: f32(cells.tearChance),
        uTearAmount: f32(cells.tearAmount),
        uTearBlock: f32(cells.tearBlock),
        uTearSlots: f32(cells.tearSlots),
      },
    });

    this.brightPass = new Pass({
      fragment: BRIGHT_FRAG,
      name: "bright",
      textures: { uSource: this.rtCells },
      uniforms: {
        uTexel: vec2(1 / width, 1 / height),
        uThreshold: f32(post.threshold),
        uKnee: f32(post.knee),
      },
    });

    this.blurPass = new Pass({
      fragment: BLUR_FRAG,
      name: "blur",
      textures: { uSource: this.rtBright },
      uniforms: { uDirection: vec2(0, 0) },
    });

    this.compositePass = new Pass({
      fragment: COMPOSITE_FRAG,
      name: "composite",
      textures: {
        uBase: this.rtCells,
        uBloomA: this.rtBlurA1,
        uBloomB: this.rtBlurB1,
      },
      uniforms: {
        uRenderSize: vec2(width, height),
        uScale: f32(this.scale),
        uPhase: f32(0),
        uBloomAMix: f32(post.bloomAMix),
        uBloomBMix: f32(post.bloomBMix),
        uAberration: f32(post.aberration),
        uScanAmount: f32(post.scanAmount),
        uScanPeriod: f32(post.scanPeriod),
        uGrain: f32(post.grain),
        uGrainSlots: f32(Math.round(variant.durationInSeconds * 30)),
        uVignette: f32(post.vignette),
        uExposure: f32(post.exposure),
        uBlackPoint: f32(post.blackPoint),
        uLift: vec3(...post.lift),
      },
    });
  }

  private draw(pass: Pass, target: RenderTexture | null) {
    this.renderer.renderTarget.bind({
      target: target ?? this.renderer.view.renderTarget,
      clear: true,
      clearColor: [0, 0, 0, 1],
    });
    this.renderer.encoder.draw({
      geometry: this.geometry,
      shader: pass.shader,
      state: this.state,
    });
  }

  private blur(
    source: RenderTexture,
    target: RenderTexture,
    dx: number,
    dy: number,
  ) {
    this.blurPass.setTexture("uSource", source);
    (this.blurPass.uniforms.uDirection as Float32Array).set([dx, dy]);
    this.draw(this.blurPass, target);
  }

  /** @param phase 0..1 through the loop; 1 lands exactly back on 0. */
  render(phase: number) {
    const { renderer } = this;
    const { bloomARadius: ra, bloomBRadius: rb } = this.variant.post;

    this.fieldPass.uniforms.uPhase = phase;
    this.cellsPass.uniforms.uPhase = phase;
    this.compositePass.uniforms.uPhase = phase;

    renderer.renderTarget.renderStart({
      target: renderer.view.renderTarget,
      clear: false,
    });

    this.draw(this.fieldPass, this.rtField);
    this.draw(this.cellsPass, this.rtCells);
    this.draw(this.brightPass, this.rtBright);

    // Each blur reads a texture at twice its own resolution, so the linear
    // filter contributes an exact 2x2 box downsample for free.
    this.blur(this.rtBright, this.rtBlurA0, ra[0] / this.rtBlurA0.width, 0);
    this.blur(this.rtBlurA0, this.rtBlurA1, 0, ra[1] / this.rtBlurA1.height);
    this.blur(this.rtBlurA1, this.rtBlurB0, rb[0] / this.rtBlurB0.width, 0);
    this.blur(this.rtBlurB0, this.rtBlurB1, 0, rb[1] / this.rtBlurB1.height);

    this.draw(this.compositePass, null);

    renderer.gl.flush();
  }

  destroy() {
    for (const rt of [
      this.rtField,
      this.rtCells,
      this.rtBright,
      this.rtBlurA0,
      this.rtBlurA1,
      this.rtBlurB0,
      this.rtBlurB1,
    ]) {
      rt.destroy(true);
    }
    this.palette.destroy(true);
    this.geometry.destroy();
  }
}
