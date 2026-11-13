// PixiJS 8 (WebGL2) map renderer.
// Streets are cached vector geometry: one quad per segment, expanded in the
// vertex shader to a constant screen-space width and antialiased analytically
// in the fragment shader (capsule SDF) - crisp at any zoom or rotation.
// The scene renders into a half-float MSAA render target; a final pass applies
// vignette / fade and a +-1/255 dither (never on pure black).
import {
  Application, Container, Geometry, Graphics, Matrix, Mesh, RenderTexture, Shader, UniformGroup, type BLEND_MODES,
} from 'pixi.js';
import { CITY } from '../city';
import type { RoadClass, PolyKind } from '../city/generate';

export type RGB = [number, number, number];
export const hex = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export interface ClassStyle { color: string; halfW: number; alpha: number; glow?: { color: string; sigma: number; alpha: number } }
export interface MapStyle {
  bg: string; // land colour
  polys: Partial<Record<PolyKind, string>>;
  classes: Record<RoadClass, ClassStyle>;
  route?: ClassStyle; // optional highlighted driving route (CITY.routes[0])
  widthZoomExp: number; // how much line width follows zoom (0 = constant px)
  laneFade: [number, number]; // zoom range (4K px per metre) over which lanes fade in
  streetFade: [number, number];
  vignette: number; // 0..1 strength
  vignetteColor?: string;
  bloom?: number; // 0..1
  soft?: number; // 0..1 mix toward a 2x-downsampled copy
}

const LINE_VS = /* glsl */ `#version 300 es
precision highp float;
in vec2 aP0;
in vec2 aP1;
in vec2 aCorner;
in float aShade;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform mat3 uView;
uniform float uHalfW;
uniform float uPad;
out vec2 vLocal;
out float vLen;
out float vShade;
void main() {
  vec2 a = (uView * vec3(aP0, 1.0)).xy;
  vec2 b = (uView * vec3(aP1, 1.0)).xy;
  vec2 d = b - a;
  float L = length(d);
  vec2 t = L > 1e-5 ? d / L : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  float e = uHalfW + uPad;
  vec2 pos = mix(a, b, aCorner.x) + t * (aCorner.x * 2.0 - 1.0) * e + n * aCorner.y * e;
  vLocal = vec2(dot(pos - a, t), dot(pos - a, n));
  vLen = L;
  vShade = aShade;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(pos, 1.0)).xy, 0.0, 1.0);
}`;

const LINE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vLocal;
in float vLen;
in float vShade;
uniform vec4 uLineColor;
uniform float uHalfW;
uniform float uMode;
uniform float uSigma;
out vec4 fragColor;
void main() {
  float ax = clamp(vLocal.x, 0.0, vLen);
  float d = length(vec2(vLocal.x - ax, vLocal.y));
  float a;
  if (uMode < 0.5) {
    float w = max(uHalfW, 0.5);
    a = clamp(w + 0.5 - d, 0.0, 1.0) * (uHalfW / w);
  } else {
    a = exp(-(d * d) / (uSigma * uSigma));
  }
  fragColor = uLineColor * (a * vShade);
}`;

// Generic screen-space effect quad: glow / disc / ring, centre & size in px.
const FX_VS = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPos;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec2 uCenter;
uniform float uExtent;
out vec2 vP;
void main() {
  vec2 p = uCenter + aPos * uExtent;
  vP = aPos * uExtent;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(p, 1.0)).xy, 0.0, 1.0);
}`;
const FX_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vP;
uniform vec4 uFxColor;
uniform float uFxMode;
uniform float uRadius;
uniform float uThick;
out vec4 fragColor;
void main() {
  float d = length(vP);
  float a;
  if (uFxMode < 0.5) a = exp(-(d * d) / (uRadius * uRadius));
  else if (uFxMode < 1.5) a = clamp(uRadius + 0.5 - d, 0.0, 1.0);
  else a = clamp(uThick * 0.5 + 0.5 - abs(d - uRadius), 0.0, 1.0);
  fragColor = uFxColor * a;
}`;

const FINAL_VS = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPos;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec2 uSize;
out vec2 vUV;
void main() {
  vUV = aPos;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPos * uSize, 1.0)).xy, 0.0, 1.0);
}`;
const FINAL_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uSize;
uniform float uVignette;
uniform float uFade;
uniform vec3 uVigColor;
uniform vec4 uVigShape;
uniform float uBloom;
uniform float uSoft;
out vec4 fragColor;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec3 c = texture(uTex, vUV).rgb;
  // filmic softness + bloom from the mip chain of the half-float target
  vec3 s1 = textureLod(uTex, vUV, 1.0).rgb;
  vec3 b = textureLod(uTex, vUV, 2.5).rgb * 0.45 + textureLod(uTex, vUV, 4.0).rgb * 0.35 + textureLod(uTex, vUV, 5.5).rgb * 0.2;
  c = mix(c, s1, uSoft) + b * uBloom;
  vec2 q = (vUV - 0.5 - uVigShape.xy) * vec2(uSize.x / uSize.y, 1.0);
  float r = length(q) / uVigShape.z;
  float v = 1.0 - uVignette * smoothstep(0.25, 1.05, r);
  c = mix(uVigColor, c, v) * uFade;
  float m = max(c.r, max(c.g, c.b));
  if (m > 0.5 / 255.0) c += (hash(gl_FragCoord.xy) + hash(gl_FragCoord.yx + 17.0) - 1.0) / 255.0;
  fragColor = vec4(max(c, 0.0), 1.0);
}`;

const QUAD = () => new Geometry({
  attributes: { aPos: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]) },
  indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
});
const CQUAD = () => new Geometry({
  attributes: { aPos: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]) },
  indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
});

interface Chunk { x0: number; y0: number; x1: number; y1: number; mesh: Mesh<Geometry, Shader>; glow?: Mesh<Geometry, Shader> }
type LayerKey = RoadClass | 'route';
interface ClassLayer { cls: LayerKey; uniforms: UniformGroup; glowUniforms?: UniformGroup; chunks: Chunk[] }

const CLASS_ORDER: RoadClass[] = ['lane', 'street', 'rail', 'avenue', 'highway'];
const CHUNK = 1500;

// Build per-class, per-chunk geometry once (module-level cache shared by all looks).
type ChunkData = { x0: number; y0: number; x1: number; y1: number; verts: Float32Array; idx: Uint32Array };
let GEOM_CACHE: Record<string, ChunkData[]> | null = null;
function buildGeometryData() {
  if (GEOM_CACHE) return GEOM_CACHE;
  const out: Record<string, ChunkData[]> = {};
  for (const cls of CLASS_ORDER) {
    const buckets = new Map<string, number[]>();
    CITY.raw.roads.forEach((r, ri) => {
      if (r.cls !== cls) return;
      const h = ((ri * 2654435761) >>> 0) / 4294967296;
      const shade = cls === 'street' || cls === 'lane' ? 0.72 + 0.28 * h : 0.9 + 0.1 * h;
      const p = r.pts;
      for (let i = 0; i + 3 < p.length; i += 2) {
        const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2;
        const k = Math.floor(mx / CHUNK) + ',' + Math.floor(my / CHUNK);
        let b = buckets.get(k);
        if (!b) buckets.set(k, (b = []));
        b.push(p[i], p[i + 1], p[i + 2], p[i + 3], shade);
      }
    });
    const list: ChunkData[] = [];
    for (const [k, b] of buckets) {
      const [cx, cy] = k.split(',').map(Number);
      const n = b.length / 5;
      const verts = new Float32Array(n * 4 * 7);
      const idx = new Uint32Array(n * 6);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let s = 0; s < n; s++) {
        const [ax, ay, bx, by, sh] = b.slice(s * 5, s * 5 + 5);
        x0 = Math.min(x0, ax, bx); x1 = Math.max(x1, ax, bx); y0 = Math.min(y0, ay, by); y1 = Math.max(y1, ay, by);
        const corners = [[0, -1], [1, -1], [1, 1], [0, 1]];
        for (let c = 0; c < 4; c++) verts.set([ax, ay, bx, by, corners[c][0], corners[c][1], sh], (s * 4 + c) * 7);
        idx.set([s * 4, s * 4 + 1, s * 4 + 2, s * 4, s * 4 + 2, s * 4 + 3], s * 6);
      }
      void cx; void cy;
      list.push({ x0, y0, x1, y1, verts, idx });
    }
    out[cls] = list;
  }
  // highlighted route as its own layer
  {
    const p = CITY.routes[0].pts;
    const n = p.length / 2 - 1;
    const verts = new Float32Array(n * 4 * 7), idx = new Uint32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const corners = [[0, -1], [1, -1], [1, 1], [0, 1]];
      for (let c = 0; c < 4; c++) verts.set([p[i * 2], p[i * 2 + 1], p[i * 2 + 2], p[i * 2 + 3], corners[c][0], corners[c][1], 1], (i * 4 + c) * 7);
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    out.route = [{ x0: -1e9, y0: -1e9, x1: 1e9, y1: 1e9, verts, idx }];
  }
  GEOM_CACHE = out;
  return out;
}

export interface View { cx: number; cy: number; zoom: number; rot: number }
export interface Fx { kind: 'glow' | 'disc' | 'ring'; x: number; y: number; r: number; thick?: number; color: RGB; alpha: number; world?: boolean }

export class PixiMap {
  app!: Application;
  pxW: number; pxH: number; k: number;
  style: MapStyle;
  world = new Container();
  polyLayer = new Graphics();
  layers: ClassLayer[] = [];
  fxPool: { mesh: Mesh<Geometry, Shader>; u: UniformGroup }[] = [];
  fxLayer = new Container();
  rt!: RenderTexture;
  finalMesh!: Mesh<Geometry, Shader>;
  finalU!: UniformGroup;
  scene = new Container();
  screen = new Container();
  viewM = new Matrix();

  constructor(pxW: number, pxH: number, k: number, style: MapStyle) {
    this.pxW = pxW; this.pxH = pxH; this.k = k; this.style = style;
  }

  static async create(canvas: HTMLCanvasElement, pxW: number, pxH: number, k: number, style: MapStyle) {
    const m = new PixiMap(pxW, pxH, k, style);
    m.app = new Application();
    await m.app.init({
      canvas, width: pxW, height: pxH, preference: 'webgl', antialias: false, autoStart: false,
      backgroundColor: 0x000000, preserveDrawingBuffer: true, resolution: 1, autoDensity: false,
      powerPreference: 'high-performance',
    });
    m.app.ticker.stop();
    m.build();
    return m;
  }

  private build() {
    const S = this.style;
    const geo = buildGeometryData();
    // polygons: land bg + water/parks etc. drawn in world coordinates via a container transform
    const g = this.polyLayer;
    g.rect(-5000, -5000, 25000, 20000).fill({ color: S.bg });
    const order: PolyKind[] = ['airport', 'park', 'block', 'yard', 'sea', 'river', 'pier', 'runway'];
    for (const kind of order) {
      const col = S.polys[kind];
      if (!col) continue;
      for (const p of CITY.raw.polys) if (p.kind === kind) g.poly(p.pts).fill({ color: col });
    }
    this.world.addChild(g);
    this.scene.addChild(this.world);

    const lineContainer = new Container();
    const keys: LayerKey[] = [...CLASS_ORDER, ...(S.route ? (['route'] as const) : [])];
    for (const cls of keys) {
      const cs = cls === 'route' ? S.route! : S.classes[cls];
      const mkU = () => new UniformGroup({
        uView: { value: new Matrix(), type: 'mat3x3<f32>' },
        uHalfW: { value: 1, type: 'f32' },
        uPad: { value: 1.5, type: 'f32' },
        uLineColor: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' },
        uMode: { value: 0, type: 'f32' },
        uSigma: { value: 1, type: 'f32' },
      });
      const uniforms = mkU();
      const glowUniforms = cs.glow ? mkU() : undefined;
      const layer: ClassLayer = { cls, uniforms, glowUniforms, chunks: [] };
      for (const cd of geo[cls]) {
        const geometry = new Geometry({
          attributes: {
            aP0: { buffer: cd.verts, format: 'float32x2', stride: 28, offset: 0 },
            aP1: { buffer: cd.verts, format: 'float32x2', stride: 28, offset: 8 },
            aCorner: { buffer: cd.verts, format: 'float32x2', stride: 28, offset: 16 },
            aShade: { buffer: cd.verts, format: 'float32', stride: 28, offset: 24 },
          },
          indexBuffer: cd.idx,
        });
        const mk = (u: UniformGroup, blend: BLEND_MODES) => {
          const shader = Shader.from({ gl: { vertex: LINE_VS, fragment: LINE_FS, name: 'map-line' }, resources: { lineUniforms: u } });
          const mesh = new Mesh({ geometry, shader });
          mesh.blendMode = blend;
          return mesh;
        };
        const chunk: Chunk = { x0: cd.x0, y0: cd.y0, x1: cd.x1, y1: cd.y1, mesh: mk(uniforms, 'max') };
        if (glowUniforms) chunk.glow = mk(glowUniforms, 'max');
        layer.chunks.push(chunk);
      }
      this.layers.push(layer);
    }
    // glows first (additive), then lines (max)
    for (const l of this.layers) for (const c of l.chunks) if (c.glow) lineContainer.addChild(c.glow);
    for (const l of this.layers) for (const c of l.chunks) lineContainer.addChild(c.mesh);
    this.scene.addChild(lineContainer);
    this.scene.addChild(this.fxLayer);

    this.rt = RenderTexture.create({ width: this.pxW, height: this.pxH, format: 'rgba16float', antialias: true, resolution: 1, autoGenerateMipmaps: true, scaleMode: 'linear', mipmapFilter: 'linear' } as never);
    this.finalU = new UniformGroup({
      uSize: { value: new Float32Array([this.pxW, this.pxH]), type: 'vec2<f32>' },
      uVignette: { value: S.vignette, type: 'f32' },
      uFade: { value: 1, type: 'f32' },
      uVigColor: { value: new Float32Array(hex(S.vignetteColor ?? '#000000')), type: 'vec3<f32>' },
      uVigShape: { value: new Float32Array([0, 0, 1, 0]), type: 'vec4<f32>' },
      uBloom: { value: S.bloom ?? 0.25, type: 'f32' },
      uSoft: { value: S.soft ?? 0.2, type: 'f32' },
    });
    const fs = Shader.from({
      gl: { vertex: FINAL_VS, fragment: FINAL_FS, name: 'map-final' },
      resources: { finalUniforms: this.finalU, uTex: this.rt.source, uTexSampler: this.rt.source.style },
    });
    this.finalMesh = new Mesh({ geometry: QUAD(), shader: fs });
    this.finalMesh.blendMode = 'none';
    this.screen.addChild(this.finalMesh);
  }

  private fx(i: number) {
    while (this.fxPool.length <= i) {
      const u = new UniformGroup({
        uCenter: { value: new Float32Array(2), type: 'vec2<f32>' },
        uExtent: { value: 1, type: 'f32' },
        uFxColor: { value: new Float32Array(4), type: 'vec4<f32>' },
        uFxMode: { value: 0, type: 'f32' },
        uRadius: { value: 1, type: 'f32' },
        uThick: { value: 1, type: 'f32' },
      });
      const shader = Shader.from({ gl: { vertex: FX_VS, fragment: FX_FS, name: 'map-fx' }, resources: { fxUniforms: u } });
      const mesh = new Mesh({ geometry: CQUAD(), shader });
      this.fxLayer.addChild(mesh);
      this.fxPool.push({ mesh, u });
    }
    return this.fxPool[i];
  }

  worldToScreen(x: number, y: number) {
    const m = this.viewM;
    return { x: m.a * x + m.c * y + m.tx, y: m.b * x + m.d * y + m.ty };
  }

  render(view: View, opts: { fade?: number; fx?: Fx[]; classAlpha?: Partial<Record<RoadClass, number>>; vigShape?: [number, number, number] } = {}) {
    const S = this.style;
    const k = this.k;
    const z = view.zoom * k; // device px per metre
    const m = this.viewM;
    m.identity().translate(-view.cx, -view.cy).rotate(view.rot).scale(z, z).translate(this.pxW / 2, this.pxH / 2);
    this.world.setFromMatrix(m);

    const zr = view.zoom; // 4K px per metre
    const wf = Math.pow(Math.max(zr, 0.05), S.widthZoomExp);
    const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    // visible world rect (rotated view -> axis aligned bound)
    const inv = m.clone().invert();
    const cs = [[0, 0], [this.pxW, 0], [this.pxW, this.pxH], [0, this.pxH]].map(([x, y]) => ({ x: inv.a * x + inv.c * y + inv.tx, y: inv.b * x + inv.d * y + inv.ty }));
    const vx0 = Math.min(...cs.map((p) => p.x)) - 200, vx1 = Math.max(...cs.map((p) => p.x)) + 200;
    const vy0 = Math.min(...cs.map((p) => p.y)) - 200, vy1 = Math.max(...cs.map((p) => p.y)) + 200;

    for (const l of this.layers) {
      const st = l.cls === 'route' ? S.route! : S.classes[l.cls];
      let a = st.alpha * (l.cls === 'route' ? 1 : (opts.classAlpha?.[l.cls] ?? 1));
      if (l.cls === 'lane') a *= sm(S.laneFade[0], S.laneFade[1], zr);
      if (l.cls === 'street' || l.cls === 'rail') a *= sm(S.streetFade[0], S.streetFade[1], zr);
      const col = hex(st.color);
      const u = l.uniforms.uniforms;
      (u.uView as Matrix).copyFrom(m);
      u.uHalfW = st.halfW * wf * k;
      u.uPad = 1.5;
      const c = u.uLineColor as Float32Array;
      c[0] = col[0] * a; c[1] = col[1] * a; c[2] = col[2] * a; c[3] = a;
      u.uMode = 0;
      l.uniforms.update();
      if (l.glowUniforms && st.glow) {
        const gu = l.glowUniforms.uniforms;
        (gu.uView as Matrix).copyFrom(m);
        const sig = st.glow.sigma * Math.pow(Math.max(zr, 0.05), S.widthZoomExp * 0.7) * k;
        gu.uHalfW = sig * 2.2;
        gu.uPad = 0;
        gu.uSigma = sig;
        gu.uMode = 1;
        const gc = hex(st.glow.color);
        const ga = st.glow.alpha * (l.cls === 'route' ? 1 : (opts.classAlpha?.[l.cls] ?? 1));
        const g = gu.uLineColor as Float32Array;
        g[0] = gc[0] * ga; g[1] = gc[1] * ga; g[2] = gc[2] * ga; g[3] = ga;
        l.glowUniforms.update();
      }
      const visible = a > 0.002;
      for (const ch of l.chunks) {
        const on = visible && !(ch.x1 < vx0 || ch.x0 > vx1 || ch.y1 < vy0 || ch.y0 > vy1);
        ch.mesh.visible = on;
        if (ch.glow) ch.glow.visible = on;
      }
    }

    const fxs = opts.fx ?? [];
    fxs.forEach((f, i) => {
      const { u, mesh } = this.fx(i);
      mesh.visible = true;
      const p = f.world ? this.worldToScreen(f.x, f.y) : { x: f.x * k, y: f.y * k };
      const U = u.uniforms;
      (U.uCenter as Float32Array).set([p.x, p.y]);
      const r = f.r * k;
      U.uRadius = r;
      U.uThick = Math.max(0.5, (f.thick ?? 2) * k);
      U.uFxMode = f.kind === 'glow' ? 0 : f.kind === 'disc' ? 1 : 2;
      U.uExtent = f.kind === 'glow' ? r * 3 : r + (f.thick ?? 2) * k + 2;
      (U.uFxColor as Float32Array).set([f.color[0] * f.alpha, f.color[1] * f.alpha, f.color[2] * f.alpha, f.alpha]);
      mesh.blendMode = f.kind === 'glow' ? 'add' : 'normal';
      u.update();
    });
    for (let i = fxs.length; i < this.fxPool.length; i++) this.fxPool[i].mesh.visible = false;

    const r = this.app.renderer;
    r.render({ container: this.scene, target: this.rt, clear: true, clearColor: [0, 0, 0, 1] });
    // resolve MSAA into the texture now, then build the mip chain used for bloom/softness
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rts = r.renderTarget as any;
    rts.adaptor.finishRenderPass(rts.getRenderTarget(this.rt));
    this.rt.source.updateMipmaps();
    const fu = this.finalU.uniforms;
    fu.uFade = opts.fade ?? 1;
    const vs = opts.vigShape ?? [0, 0, 1];
    (fu.uVigShape as Float32Array).set([vs[0], vs[1], vs[2], 0]);
    this.finalU.update();
    r.render({ container: this.screen, clear: true });
  }

  destroy() {
    this.app.destroy(false, { children: true });
  }
}
