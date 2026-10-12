import {
  BufferAttribute,
  CanvasTexture,
  DynamicDrawUsage,
  GLSL3,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearMipmapLinearFilter,
  Mesh,
  NoBlending,
  PlaneGeometry,
  RawShaderMaterial,
  Texture,
} from "three";
import type { RGB } from "./color";
import { ADDITIVE } from "./lines";

/** A canvas drawn once (after fonts load) and uploaded as a mipmapped texture. */
export const canvasTexture = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  const t = new CanvasTexture(c);
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
};

// ---------------------------------------------------------------------------
// Textured plane (uses its own transform). Alpha of the texture = coverage.
// ---------------------------------------------------------------------------

const PLANE_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
in vec3 position; in vec2 uv;
out vec2 vUv; out float vDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z; vUv = uv;
  gl_Position = projectionMatrix * mv;
}
`;
const PLANE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity;
in vec2 vUv; in float vDepth; out vec4 o;
void main() {
  vec4 t = texture(uMap, vUv);
#ifdef DEPTH_PASS
  if (t.a * uOpacity < 0.05) discard;
  o = vec4(vDepth, 0, 0, 1);
#else
  o = vec4(uColor * t.a * uOpacity, 1.0);
#endif
}
`;

export const texturedPlane = (map: Texture, w: number, h: number, color: RGB, opacity: number, depth = false) => {
  const uniforms = { uMap: { value: map }, uColor: { value: color }, uOpacity: { value: opacity } };
  const mat = new RawShaderMaterial({ glslVersion: GLSL3, vertexShader: PLANE_VERT, fragmentShader: PLANE_FRAG, uniforms, depthTest: false, depthWrite: false, ...ADDITIVE });
  const mesh = new Mesh(new PlaneGeometry(w, h), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  if (depth) {
    mesh.userData.depthMat = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: PLANE_VERT,
      fragmentShader: PLANE_FRAG,
      uniforms,
      defines: { DEPTH_PASS: 1 },
      blending: NoBlending,
      depthTest: true,
      depthWrite: true,
    });
  }
  return { mesh, mat, uniforms };
};

// ---------------------------------------------------------------------------
// Instanced camera-facing sprites (badges, haze). Per-instance:
// iPos xyz, iSize (world w,h), iRot (screen rotation), iI (intensity),
// iUv (atlas rect x,y,w,h).
// ---------------------------------------------------------------------------

const SPRITE_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
uniform vec2 uFog;
in vec3 position; in vec2 uv;
in vec3 iPos; in vec2 iSize; in float iRot; in float iI; in vec4 iUv;
out vec2 vUv; out float vI; out float vDepth;
void main() {
  float c = cos(iRot), s = sin(iRot);
  vec2 q = position.xy * iSize;
  vec2 rq = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
#ifdef PLANAR
  // Quad lies in the object's own XY plane (HUD text on a panel).
  vec4 mv = modelViewMatrix * vec4(iPos + vec3(rq, 0.0), 1.0);
#else
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  mv.xy += rq;
#endif
  vDepth = -mv.z;
  vUv = iUv.xy + uv * iUv.zw;
  vI = iI * (1.0 - smoothstep(uFog.x, uFog.y, vDepth));
  gl_Position = projectionMatrix * mv;
  if (vDepth < 0.05) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;
const SPRITE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap; uniform vec3 uColor, uColor2; uniform float uOpacity;
in vec2 vUv; in float vI; in float vDepth; out vec4 o;
void main() {
  vec4 t = texture(uMap, vUv);
#ifdef DEPTH_PASS
  if (t.a * vI < 0.08) discard;
  o = vec4(vDepth, 0, 0, 1);
#elif defined(TWO_TONE)
  // Red channel = shape drawn in uColor2, green channel = text drawn in uColor.
  o = vec4((uColor * t.g * 0.75 + uColor2 * t.r) * (t.a * uOpacity * vI), 1.0);
#else
  o = vec4(uColor * (t.a * uOpacity * vI), 1.0);
#endif
}
`;

export class SpriteBatch {
  mesh: Mesh;
  geom: InstancedBufferGeometry;
  mat: RawShaderMaterial;
  pos: Float32Array;
  size: Float32Array;
  rot: Float32Array;
  inten: Float32Array;
  uvr: Float32Array;

  constructor(n: number, map: Texture, color: RGB, opts: { opacity?: number; fog?: [number, number]; depth?: boolean; planar?: boolean; color2?: RGB } = {}) {
    const g = new InstancedBufferGeometry();
    const pg = new PlaneGeometry(1, 1);
    g.setIndex(pg.index);
    g.setAttribute("position", pg.attributes.position as BufferAttribute);
    g.setAttribute("uv", pg.attributes.uv as BufferAttribute);
    this.pos = new Float32Array(n * 3);
    this.size = new Float32Array(n * 2);
    this.rot = new Float32Array(n);
    this.inten = new Float32Array(n);
    this.uvr = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) this.uvr.set([0, 0, 1, 1], i * 4);
    const mk = (a: Float32Array, k: number) => {
      const at = new InstancedBufferAttribute(a, k);
      at.setUsage(DynamicDrawUsage);
      return at;
    };
    g.setAttribute("iPos", mk(this.pos, 3));
    g.setAttribute("iSize", mk(this.size, 2));
    g.setAttribute("iRot", mk(this.rot, 1));
    g.setAttribute("iI", mk(this.inten, 1));
    g.setAttribute("iUv", mk(this.uvr, 4));
    g.instanceCount = n;
    this.geom = g;
    const uniforms = { uMap: { value: map }, uColor: { value: color }, uColor2: { value: opts.color2 ?? color }, uOpacity: { value: opts.opacity ?? 1 }, uFog: { value: opts.fog ?? [1e5, 2e5] } };
    const defines: Record<string, number> = { ...(opts.planar ? { PLANAR: 1 } : {}), ...(opts.color2 ? { TWO_TONE: 1 } : {}) };
    this.mat = new RawShaderMaterial({ glslVersion: GLSL3, vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG, uniforms, defines, depthTest: false, depthWrite: false, ...ADDITIVE });
    this.mesh = new Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 8;
    if (opts.depth) {
      this.mesh.userData.depthMat = new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: SPRITE_VERT,
        fragmentShader: SPRITE_FRAG,
        uniforms,
        defines: { ...defines, DEPTH_PASS: 1 },
        blending: NoBlending,
        depthTest: true,
        depthWrite: true,
      });
    }
  }

  get u() {
    return this.mat.uniforms;
  }

  commit() {
    for (const k of ["iPos", "iSize", "iRot", "iI", "iUv"]) (this.geom.attributes[k] as InstancedBufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.geom.dispose();
    this.mat.dispose();
  }
}

// ---------------------------------------------------------------------------
// Monospace glyph atlas + planar text made of glyph sprites (for ticking HUD values).
// ---------------------------------------------------------------------------

const GLYPHS = "0123456789.-:%/ ABCDEFGHIJKLMNOPQRSTUVWXYZ_";
const CELL_W = 64,
  CELL_H = 96,
  COLS = 16;

export const glyphAtlas = (font: string) =>
  canvasTexture(CELL_W * COLS, CELL_H * Math.ceil(GLYPHS.length / COLS), (ctx) => {
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `500 ${CELL_H * 0.72}px "${font}"`;
    for (let i = 0; i < GLYPHS.length; i++) {
      const cx = (i % COLS) * CELL_W + CELL_W / 2,
        cy = Math.floor(i / COLS) * CELL_H + CELL_H / 2;
      ctx.fillText(GLYPHS[i], cx, cy);
    }
  });

/** Writes strings as planar glyph sprites into a SpriteBatch built on glyphAtlas. */
export class GlyphWriter {
  private n = 0;
  constructor(
    public batch: SpriteBatch,
    private rows: number,
  ) {}
  begin() {
    this.n = 0;
  }
  /** (x, y) = left baseline-centre of the string in the object's plane; h = glyph height. */
  text(str: string, x: number, y: number, h: number, intensity = 1) {
    const w = h * (CELL_W / CELL_H) * 0.95;
    for (let k = 0; k < str.length; k++) {
      const gi = Math.max(0, GLYPHS.indexOf(str[k].toUpperCase()));
      if (str[k] === " " || this.n >= this.batch.inten.length) continue;
      const i = this.n++;
      this.batch.pos.set([x + (k + 0.5) * w, y, 0], i * 3);
      this.batch.size.set([w / 0.95, h], i * 2);
      this.batch.rot[i] = 0;
      this.batch.inten[i] = intensity;
      const u = (gi % COLS) / COLS,
        v = 1 - (Math.floor(gi / COLS) + 1) / this.rows;
      this.batch.uvr.set([u, v, 1 / COLS, 1 / this.rows], i * 4);
    }
  }
  end() {
    for (let i = this.n; i < this.batch.inten.length; i++) this.batch.inten[i] = 0;
    this.batch.commit();
  }
}
export const glyphRows = () => Math.ceil(GLYPHS.length / COLS);
