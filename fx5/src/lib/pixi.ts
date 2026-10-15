import {
  Geometry,
  Mesh,
  RenderTexture,
  Shader,
  UniformGroup,
  type Renderer,
  type TextureSource,
} from 'pixi.js';
import { QUAD_VERT } from './glsl';

/**
 * Pixi only compiles GLSL ES 3.00 when the source says so. Force highp for
 * floats and samplers (Pixi's defaults are mediump / lowp sampler2D, which
 * would throw away half-float precision on real GPUs).
 */
export const es3 = (src: string) =>
  src.includes('#version 300 es')
    ? src
    : `#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\n${src}`;

export type UniformSpec = Record<string, { value: unknown; type: string; size?: number }>;

/** A full-target quad with a custom fragment shader. */
export class Pass {
  mesh: Mesh<Geometry, Shader>;
  shader: Shader;
  u: Record<string, any>;
  constructor(
    w: number,
    h: number,
    fragment: string,
    uniforms: UniformSpec,
    textures: Record<string, TextureSource> = {},
  ) {
    const geometry = new Geometry({
      attributes: {
        aPosition: [0, 0, w, 0, w, h, 0, h],
        aUV: [0, 0, 1, 0, 1, 1, 0, 1],
      },
      indexBuffer: [0, 1, 2, 0, 2, 3],
    });
    const group = new UniformGroup(uniforms as any);
    this.shader = Shader.from({
      gl: { vertex: es3(QUAD_VERT), fragment: es3(fragment) },
      resources: { u: group, ...textures },
    });
    this.u = group.uniforms;
    this.mesh = new Mesh({ geometry, shader: this.shader });
  }
  tex(name: string, src: TextureSource) {
    this.shader.resources[name] = src;
  }
  draw(renderer: Renderer, target?: RenderTexture, clear = true) {
    renderer.render({
      container: this.mesh,
      target,
      clear,
      clearColor: [0, 0, 0, 0],
    });
  }
}

export function makeRT(w: number, h: number, linear = true): RenderTexture {
  return RenderTexture.create({
    width: Math.max(1, Math.round(w)),
    height: Math.max(1, Math.round(h)),
    resolution: 1,
    format: 'rgba16float',
    scaleMode: linear ? 'linear' : 'nearest',
    antialias: false,
  } as any);
}

const DOWN_FRAG = /* glsl */ `
in vec2 vUV; out vec4 finalColor;
uniform sampler2D uSrc;
uniform vec2 uTexel; // texel of the source
void main() {
  vec2 o = uTexel;
  vec4 c = texture(uSrc, vUV) * 4.0;
  c += texture(uSrc, vUV + vec2(-o.x, -o.y));
  c += texture(uSrc, vUV + vec2( o.x, -o.y));
  c += texture(uSrc, vUV + vec2(-o.x,  o.y));
  c += texture(uSrc, vUV + vec2( o.x,  o.y));
  finalColor = c / 8.0;
}
`;
const BLUR_FRAG = /* glsl */ `
in vec2 vUV; out vec4 finalColor;
uniform sampler2D uSrc;
uniform vec2 uDir; // texel step along blur direction
void main() {
  // 9-tap gaussian folded into 5 bilinear fetches
  vec4 c = texture(uSrc, vUV) * 0.2270270270;
  c += texture(uSrc, vUV + uDir * 1.3846153846) * 0.3162162162;
  c += texture(uSrc, vUV - uDir * 1.3846153846) * 0.3162162162;
  c += texture(uSrc, vUV + uDir * 3.2307692308) * 0.0702702703;
  c += texture(uSrc, vUV - uDir * 3.2307692308) * 0.0702702703;
  finalColor = c;
}
`;

/**
 * Multi-level bloom pyramid: level i is the source downsampled 2^(i+1)x
 * and gaussian blurred. Everything in half float.
 */
export class Bloom {
  levels: RenderTexture[] = [];
  private tmp: RenderTexture[] = [];
  private down: Pass[] = [];
  private blurH: Pass[] = [];
  private blurV: Pass[] = [];
  constructor(w: number, h: number, nLevels: number, firstDiv = 2) {
    let lw = w / firstDiv;
    let lh = h / firstDiv;
    let sw = w;
    let sh = h;
    for (let i = 0; i < nLevels; i++) {
      const rw = Math.max(2, Math.round(lw));
      const rh = Math.max(2, Math.round(lh));
      this.levels.push(makeRT(rw, rh));
      this.tmp.push(makeRT(rw, rh));
      this.down.push(
        new Pass(rw, rh, DOWN_FRAG, {
          uTexel: { value: [0.5 / sw, 0.5 / sh], type: 'vec2<f32>' },
        }),
      );
      this.blurH.push(
        new Pass(rw, rh, BLUR_FRAG, {
          uDir: { value: [1 / rw, 0], type: 'vec2<f32>' },
        }),
      );
      this.blurV.push(
        new Pass(rw, rh, BLUR_FRAG, {
          uDir: { value: [0, 1 / rh], type: 'vec2<f32>' },
        }),
      );
      sw = rw;
      sh = rh;
      lw = rw / 2;
      lh = rh / 2;
    }
  }
  run(renderer: Renderer, src: RenderTexture, blurIters = 1) {
    let input = src;
    for (let i = 0; i < this.levels.length; i++) {
      this.down[i].tex('uSrc', input.source);
      this.down[i].draw(renderer, this.levels[i]);
      for (let k = 0; k < blurIters; k++) {
        this.blurH[i].tex('uSrc', this.levels[i].source);
        this.blurH[i].draw(renderer, this.tmp[i]);
        this.blurV[i].tex('uSrc', this.tmp[i].source);
        this.blurV[i].draw(renderer, this.levels[i]);
      }
      input = this.levels[i];
    }
  }
}
