import {
  BufferAttribute,
  CustomBlending,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OneFactor,
  ShaderMaterial,
  Texture,
  Vector2,
  WebGLRenderer,
} from "three";
import { canvasTexture, makeCanvas } from "./canvas";
import { Rng } from "./rand";
import { GLSL_COMMON, Shared } from "./shared";

/**
 * Text label atlas: `cells` text strings rendered once into a grid texture.
 * Labels are drawn as instanced quads (one draw call for hundreds of labels);
 * each label cycles through `variants` consecutive cells on a fixed frame
 * period, so "ticking" numbers never require redrawing a canvas.
 */
export interface Atlas {
  tex: Texture;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
}

export type CellDraw = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;

export const makeAtlas = (
  gl: WebGLRenderer,
  texts: (string | CellDraw)[],
  opts: { cellW: number; cellH: number; font: string; color?: string; align?: CanvasTextAlign; glow?: number },
): Atlas => {
  const cols = Math.max(1, Math.floor(4096 / opts.cellW));
  // text is drawn in the middle of each cell with empty margins (mip padding)
  const rows = Math.ceil(texts.length / cols);
  const W = cols * opts.cellW;
  const H = Math.pow(2, Math.ceil(Math.log2(rows * opts.cellH)));
  const { c, ctx } = makeCanvas(W, H);
  ctx.clearRect(0, 0, W, H);
  ctx.font = opts.font;
  ctx.textBaseline = "middle";
  ctx.textAlign = opts.align ?? "left";
  ctx.fillStyle = opts.color ?? "#fff";
  if (opts.glow) {
    ctx.shadowColor = opts.color ?? "#fff";
    ctx.shadowBlur = opts.glow;
  }
  texts.forEach((t, i) => {
    const x = (i % cols) * opts.cellW;
    const y = Math.floor(i / cols) * opts.cellH;
    const tx = opts.align === "center" ? x + opts.cellW / 2 : opts.align === "right" ? x + opts.cellW - 8 : x + 8;
    if (typeof t === "function") {
      ctx.save();
      t(ctx, x, y, opts.cellW, opts.cellH);
      ctx.restore();
    } else ctx.fillText(t, tx, y + opts.cellH / 2);
  });
  return { tex: canvasTexture(c, gl), cols, rows: H / opts.cellH, cellW: opts.cellW, cellH: opts.cellH };
};

export interface LabelSpec {
  pos: [number, number, number];
  cell: number; // first cell index
  variants: number; // number of consecutive cells to cycle through
  period: number; // frames per variant (choose so 600 / period / variants is whole for loops)
  phase: number; // frame offset
  height: number; // world height of the label quad
  color: [number, number, number];
}

/** Instanced, camera-facing (or plane-aligned) label quads from an atlas, with in-shader DoF. */
export const makeLabels = (
  atlas: Atlas,
  labels: LabelSpec[],
  shared: Shared,
  opts: {
    billboard?: boolean;
    /** Scroll labels along local X and wrap within [-wrapLen/2, wrapLen/2]
     *  (set uniforms uWrapOffset each frame; whole multiples of wrapLen loop). */
    wrapLen?: number;
  } = {},
) => {
  const g = new InstancedBufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const P: number[] = [];
  const C: number[] = [];
  const K: number[] = [];
  const S: number[] = [];
  for (const l of labels) {
    P.push(...l.pos);
    C.push(...l.color);
    K.push(l.cell, l.variants, l.period, l.phase);
    S.push(l.height);
  }
  g.setAttribute("iPos", new InstancedBufferAttribute(new Float32Array(P), 3));
  g.setAttribute("iCol", new InstancedBufferAttribute(new Float32Array(C), 3));
  g.setAttribute("iK", new InstancedBufferAttribute(new Float32Array(K), 4));
  g.setAttribute("iH", new InstancedBufferAttribute(new Float32Array(S), 1));
  g.instanceCount = labels.length;
  const aspect = atlas.cellW / atlas.cellH;
  const m = new ShaderMaterial({
    uniforms: {
      ...shared,
      uAtlas: { value: atlas.tex },
      uGrid: { value: new Vector2(atlas.cols, atlas.rows) },
      uAlpha: { value: 1 },
      uWrapOffset: { value: 0 },
      uWrapLen: { value: opts.wrapLen ?? 0 },
    },
    vertexShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform float uWrapOffset;
      uniform float uWrapLen;
      varying float vEdgeFade;
      attribute vec3 iPos;
      attribute vec3 iCol;
      attribute vec4 iK;
      attribute float iH;
      uniform vec2 uGrid;
      varying vec2 vUv;
      varying vec3 vCol;
      varying float vCoc;
      varying float vEnergy;
      varying vec4 vCell;
      void main() {
        float variant = mod(floor((uFrame + iK.w) / iK.z), iK.y);
        float cell = iK.x + variant;
        vec2 cr = vec2(mod(cell, uGrid.x), floor(cell / uGrid.x));
        vUv = vec2((cr.x + uv.x) / uGrid.x, 1.0 - (cr.y + 1.0 - uv.y) / uGrid.y);
        vec2 inset = 0.5 / (uGrid * vec2(${atlas.cellW.toFixed(1)}, ${atlas.cellH.toFixed(1)}));
        vCell = vec4(cr.x / uGrid.x + inset.x, 1.0 - (cr.y + 1.0) / uGrid.y + inset.y,
                     (cr.x + 1.0) / uGrid.x - inset.x, 1.0 - cr.y / uGrid.y - inset.y);
        vec2 sz = vec2(iH * ${aspect.toFixed(4)}, iH);
        vec3 base = iPos;
        vEdgeFade = 1.0;
        if (uWrapLen > 0.0) {
          base.x = mod(iPos.x - uWrapOffset + uWrapLen * 0.5, uWrapLen) - uWrapLen * 0.5;
          vEdgeFade = smoothstep(0.5, 0.42, abs(base.x) / uWrapLen);
        }
        vec4 mv;
        ${
          opts.billboard === false
            ? `mv = modelViewMatrix * vec4(base + vec3(position.xy * sz, 0.0), 1.0);`
            : `mv = modelViewMatrix * vec4(base, 1.0); mv.xy += position.xy * sz;`
        }
        float d = -mv.z;
        vCoc = cocPx(d);
        // pixel height of the glyph cell → fade sub-pixel text instead of shimmering
        float px = iH * projectionMatrix[1][1] / d * 0.5 * uResolution.y;
        vEnergy = smoothstep(2.0, 6.0, px);
        vCol = iCol;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform vec2 uGrid;
      uniform float uAlpha;
      varying vec2 vUv;
      varying vec3 vCol;
      varying float vCoc;
      varying float vEnergy;
      varying vec4 vCell;
      varying float vEdgeFade;
      vec4 tap(vec2 uv, float lod) { return textureLod(uAtlas, clamp(uv, vCell.xy, vCell.zw), lod); }
      void main() {
        vec2 dx = dFdx(vUv);
        vec2 dy = dFdy(vUv);
        vec2 ts = uGrid * vec2(${atlas.cellW.toFixed(1)}, ${atlas.cellH.toFixed(1)});
        float texPerPx = max(length(dx * ts), length(dy * ts));
        // base sample: mip clamped so neighbouring cells never bleed in
        float baseLod = min(log2(max(texPerPx, 1.0)), 2.0);
        vec4 c = tap(vUv, baseLod);
        float rpx = vCoc * 0.5;
        float lod = min(log2(max(rpx * texPerPx * 0.7, 1.0)), 2.0);
        vec2 o1 = (dx * 0.8 + dy * 0.3) * rpx * 0.65;
        vec2 o2 = (dx * -0.3 + dy * 0.8) * rpx * 0.65;
        vec4 b = tap(vUv + o1, lod) + tap(vUv - o1, lod) + tap(vUv + o2, lod) + tap(vUv - o2, lod);
        c = mix(c, b * 0.25, smoothstep(0.75, 2.0, vCoc));
        float k = uAlpha * vEnergy * vEdgeFade;
        if (c.a * k < 0.002) discard;
        // atlas is premultiplied: rgb carries the glyph colour (white or tinted marks)
        gl_FragColor = vec4(c.rgb * vCol * k, 0.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneFactor,
  });
  const mesh = new Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
};

/** Random invented numbers for atlas cells. */
export const numberTexts = (r: Rng, n: number, fmt: (r: Rng) => string) => Array.from({ length: n }, () => fmt(r));

