import {
  Application,
  BlurFilter,
  Container,
  defaultFilterVert,
  Filter,
  GlProgram,
  Graphics,
  Particle,
  ParticleContainer,
  Rectangle,
  RenderTexture,
  Sprite,
  Texture,
  UniformGroup,
} from 'pixi.js';
import type {Place, Polygon} from '../lib/geo';
import {tracePolygons} from '../lib/geo';
import {mulberry32} from '../lib/random';
import {easeInOut, phase, TAU} from '../lib/anim';

export const W = 3840;
export const H = 2160;
export const LOOP = 600;

export type DigitalVersion = {
  id: string;
  line: number; // coastline colour
  node: number; // node colour
  scale: number; // px per degree (logical 4K px)
  centerLon: number;
  centerLat: number;
  nodeCount: number;
  streakCount: number;
  curveCount: number;
  glow: number; // blur strength (logical px)
  grain: number;
  background: [number, number, number];
  haze: [number, number, number];
};

export const CYAN: DigitalVersion = {
  id: 'DigitalWorldMap-Cyan',
  line: 0x5fd8f0,
  node: 0xbff6ff,
  scale: 14.6,
  centerLon: -4,
  centerLat: 14,
  nodeCount: 40,
  streakCount: 30,
  curveCount: 6,
  glow: 18,
  grain: 0.02,
  background: [0x02 / 255, 0x0a / 255, 0x10 / 255],
  haze: [0.02, 0.11, 0.14],
};

// Final pass: analytic background + haze (float precision, so no banding from
// 8-bit intermediates), vignette, grain from (pixel, frame % 600), +-1/255 dither.
const FINAL_FRAG = /* glsl */ `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform float uFrame;
uniform float uGrain;
uniform vec3 uBg;
uniform vec3 uHaze;
uniform vec2 uScreen;
uniform float uBlur; // max defocus radius as a fraction of frame height

// Float-only hash (D. Hoskins, "hash without sine"): uint arithmetic is not
// reliable through Pixi's GL program path, so the grain uses this instead.
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec2 px = vTextureCoord * uInputSize.xy + uOutputFrame.xy;
  vec2 uv = px / uScreen;
  // shallow-focus look: sharp band through the centre-right, defocus towards
  // the left edge and the bottom (fixed function of position)
  vec2 q = (uv - vec2(0.56, 0.42)) * vec2(1.0, 1.35);
  float rad = uBlur * smoothstep(0.28, 0.72, length(q));
  vec4 c = texture(uTexture, vTextureCoord);
  if (rad > 0.0005) {
    vec2 step = vec2(rad * uScreen.y) * uInputSize.zw;
    vec4 acc = c;
    float n = 1.0;
    for (int i = 0; i < 24; i++) {
      float fi = float(i);
      float r = sqrt((fi + 0.5) / 24.0);
      float a = fi * 2.39996323;
      acc += texture(uTexture, vTextureCoord + vec2(cos(a), sin(a)) * r * step);
      n += 1.0;
    }
    c = acc / n;
  }
  vec2 p = uv - 0.5;
  p.x *= uScreen.x / uScreen.y;
  float r = length(p);
  vec3 bg = uBg + uHaze * exp(-r * r * 3.2);
  vec3 col = bg + c.rgb;
  col *= 1.0 - 0.45 * smoothstep(0.45, 1.1, r);
  vec3 key = vec3(floor(gl_FragCoord.xy), uFrame);
  col += (hash13(key) - 0.5) * uGrain * 2.0;
  col += (hash13(key + vec3(17.0, 59.4, 15.0)) + hash13(key + vec3(91.3, 7.7, 333.0)) - 1.0) / 255.0;
  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const radialTexture = (size: number, stops: [number, number][]) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, a] of stops) g.addColorStop(o, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(c);
};

const streakTexture = () => {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.filter = 'blur(18px)';
  const g = ctx.createLinearGradient(60, 0, 964, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.55, 'rgba(255,255,255,1)');
  g.addColorStop(0.85, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(60, 44, 904, 40);
  return Texture.from(c);
};

type Node = {x: number; y: number; halo: Sprite; core: Sprite; period: number; offset: number; size: number};
type Link = {a: Node; b: Node; draw?: [number, number]; elbow: boolean};
type Streak = {sprite: Sprite; y: number; len: number; k: number; x0: number};
type Dot = {p: Particle; base: number; col: number};
type Curve = {pts: [number, number][]; amp: number; k: number; off: number; alpha: number};

export class DigitalMapScene {
  readonly app: Application;
  private v: DigitalVersion;
  private nodes: Node[] = [];
  private links: Link[] = [];
  private streaks: Streak[] = [];
  private dots: Dot[] = [];
  private curves: Curve[] = [];
  private dynLines = new Graphics();
  private curveG = new Graphics();
  private final: Filter;
  private content: Container;
  private rt: RenderTexture;

  constructor(app: Application, v: DigitalVersion, land: Polygon[], places: Place[]) {
    this.app = app;
    this.v = v;
    const X = (lon: number) => W / 2 + (lon - v.centerLon) * v.scale;
    const Y = (lat: number) => H / 2 - (lat - v.centerLat) * v.scale;
    const rng = mulberry32(0x5eed01);

    // The scene (with its glow filter) renders into an offscreen texture; the
    // stage shows that texture through the final grain/dither filter. Nesting
    // the two filters directly mis-sizes the inner one at resolution < 1.
    const content = new Container();
    this.content = content;
    this.rt = RenderTexture.create({width: W, height: H, resolution: app.renderer.resolution, antialias: true});
    const view = new Sprite(this.rt);
    app.stage.addChild(view);
    const glowLayer = new Container();

    // --- grid and rule lines -------------------------------------------------
    const grid = new Graphics();
    for (let x = 0; x <= W; x += 160) grid.moveTo(x, 0).lineTo(x, H);
    for (let y = 0; y <= H; y += 160) grid.moveTo(0, y).lineTo(W, y);
    grid.stroke({width: 1.5, color: v.line, alpha: 0.05});
    // circuit-like right-angle segments
    for (let i = 0; i < 60; i++) {
      let x = Math.round((rng() * W) / 40) * 40;
      let y = Math.round((rng() * H) / 40) * 40;
      grid.moveTo(x, y);
      for (let s = 0; s < 3; s++) {
        if ((s + i) % 2 === 0) x += (rng() - 0.5) * 900;
        else y += (rng() - 0.5) * 700;
        grid.lineTo(x, y);
      }
    }
    grid.stroke({width: 3, color: v.line, alpha: 0.36});
    // rule lines with tick marks
    for (let i = 0; i < 3; i++) {
      const y = H * (0.18 + i * 0.32);
      grid.moveTo(0, y).lineTo(W, y);
      for (let x = 0; x < W; x += 40) grid.moveTo(x, y).lineTo(x, y + (x % 200 === 0 ? 18 : 8));
    }
    for (let i = 0; i < 3; i++) {
      const x = W * (0.12 + i * 0.37);
      grid.moveTo(x, 0).lineTo(x, H);
      for (let y = 0; y < H; y += 40) grid.moveTo(x, y).lineTo(x + (y % 200 === 0 ? 18 : 8), y);
    }
    grid.stroke({width: 1.5, color: v.line, alpha: 0.09});
    content.addChild(grid);

    // --- land dot fill -------------------------------------------------------
    const mask = document.createElement('canvas');
    mask.width = W / 4;
    mask.height = H / 4;
    {
      const ctx = mask.getContext('2d')!;
      ctx.fillStyle = '#fff';
      // trace with the same projection, at quarter resolution
      const lon0 = v.centerLon - W / 2 / v.scale;
      const lon1 = v.centerLon + W / 2 / v.scale;
      const lat1 = v.centerLat + H / 2 / v.scale;
      const lat0 = v.centerLat - H / 2 / v.scale;
      tracePolygons(ctx, land, mask.width, mask.height, [lon0, lon1, lat0, lat1]);
      ctx.fill('evenodd');
    }
    const md = mask.getContext('2d')!.getImageData(0, 0, mask.width, mask.height).data;
    const isLand = (x: number, y: number) => {
      const mx = Math.floor(x / 4);
      const my = Math.floor(y / 4);
      if (mx < 0 || my < 0 || mx >= mask.width || my >= mask.height) return false;
      return md[(my * mask.width + mx) * 4] > 127;
    };
    const dotTex = radialTexture(32, [[0, 1], [0.45, 0.9], [1, 0]]);
    const dotsPC = new ParticleContainer({dynamicProperties: {color: true, position: false}});
    const colRng = mulberry32(0xd07);
    const colBright: number[] = [];
    for (let x = 0; x < W; x += 20) colBright.push(0.35 + colRng() * 0.65);
    for (let x = 10, ci = 0; x < W; x += 20, ci++) {
      for (let y = 6; y < H; y += 13) {
        if (!isLand(x, y)) continue;
        const r = rng();
        if (r < 0.12) continue; // gaps
        const base = Math.min(1, colBright[ci] * (0.5 + 0.8 * rng()));
        const p = new Particle({texture: dotTex, x, y, anchorX: 0.5, anchorY: 0.5, scaleX: 0.26, scaleY: 0.26, alpha: base, tint: v.line});
        dotsPC.addParticle(p);
        this.dots.push({p, base, col: ci});
      }
    }
    for (let i = 0; i < 26; i++) {
      const x = 10 + Math.floor(rng() * (W / 20)) * 20;
      const y0 = rng() * H;
      const n = 6 + Math.floor(rng() * 22);
      for (let k = 0; k < n; k++) {
        const y = y0 + k * 13;
        if (y > H || isLand(x, y)) continue;
        const base = 0.25 + rng() * 0.45;
        const p = new Particle({texture: dotTex, x, y, anchorX: 0.5, anchorY: 0.5, scaleX: 0.24, scaleY: 0.24, alpha: base, tint: v.line});
        dotsPC.addParticle(p);
        this.dots.push({p, base, col: Math.floor(x / 20)});
      }
    }
    content.addChild(dotsPC);

    // --- coastlines ----------------------------------------------------------
    const coast = new Graphics();
    for (const poly of land) {
      for (const ring of poly) {
        // skip tiny islands for a cleaner line
        if (ring.length < 16) continue;
        for (let i = 0; i < ring.length; i += 2) {
          const x = X(ring[i]);
          const y = Y(ring[i + 1]);
          if (i === 0) coast.moveTo(x, y);
          else coast.lineTo(x, y);
        }
        coast.closePath();
      }
    }
    coast.stroke({width: 2, color: v.line, alpha: 0.45, join: 'round'});
    content.addChild(coast);
    // pixel-dot coastline on top of the faint line
    const coastDots = new ParticleContainer({dynamicProperties: {position: false}});
    const cDotTex = radialTexture(16, [[0, 1], [0.6, 1], [1, 0]]);
    for (const poly of land) {
      for (const ring of poly) {
        if (ring.length < 16) continue;
        let carry = 0;
        for (let i = 2; i < ring.length; i += 2) {
          const x0 = X(ring[i - 2]);
          const y0 = Y(ring[i - 1]);
          const x1 = X(ring[i]);
          const y1 = Y(ring[i + 1]);
          const len = Math.hypot(x1 - x0, y1 - y0);
          let d = carry;
          while (d < len) {
            const t = d / len;
            coastDots.addParticle(new Particle({texture: cDotTex, x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, anchorX: 0.5, anchorY: 0.5, scaleX: 0.42, scaleY: 0.42, tint: v.line}));
            d += 7;
          }
          carry = d - len;
        }
      }
    }
    content.addChild(coastDots);
    // glow copy: same coastline geometry, drawn wider, then blurred and added
    const coastGlow = new Graphics();
    for (const poly of land) {
      for (const ring of poly) {
        if (ring.length < 16) continue;
        for (let i = 0; i < ring.length; i += 2) {
          if (i === 0) coastGlow.moveTo(X(ring[i]), Y(ring[i + 1]));
          else coastGlow.lineTo(X(ring[i]), Y(ring[i + 1]));
        }
        coastGlow.closePath();
      }
    }
    coastGlow.stroke({width: 8, color: v.line, alpha: 0.7, join: 'round'});
    glowLayer.addChild(coastGlow);

    // --- curves (latitude-style sweeps) --------------------------------------
    for (let i = 0; i < v.curveCount; i++) {
      const y0 = H * (0.1 + 0.85 * rng());
      const pts: [number, number][] = [];
      const dir = i % 3 === 2 ? -1 : 1;
      const tilt = (0.4 + rng() * 0.15) * dir;
      const waves = 0.8 + rng() * 0.9;
      const amp = H * (0.12 + rng() * 0.14);
      for (let s = 0; s <= 64; s++) {
        const t = s / 64;
        const x = -300 + t * (W + 600);
        const y = y0 + tilt * (x - W / 2) * 0.55 + Math.sin(t * Math.PI * 2 * waves + i) * amp;
        pts.push([x, y]);
      }
      this.curves.push({pts, amp: 30 + rng() * 50, k: 1 + (i % 2), off: rng(), alpha: 0.5 + rng() * 0.3});
    }
    content.addChild(this.curveG);
    glowLayer.addChild(new Graphics(this.curveG.context));

    // --- nodes ---------------------------------------------------------------
    const haloTex = radialTexture(128, [[0, 1], [0.15, 0.55], [0.4, 0.12], [1, 0]]);
    const coreTex = radialTexture(64, [[0, 1], [0.5, 1], [0.75, 0.6], [1, 0]]);
    const chosen: [number, number][] = [];
    for (const [lon, lat] of places) {
      const x = X(lon);
      const y = Y(lat);
      if (x < 80 || x > W - 80 || y < 80 || y > H - 80) continue;
      if (chosen.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 230)) continue;
      chosen.push([x, y]);
      if (chosen.length >= v.nodeCount - 8) break;
    }
    // a few nodes off the coast / in empty space, like the reference
    for (let i = 0; i < 12; i++) chosen.push([200 + rng() * (W - 400), 150 + rng() * (H - 300)]);
    const periods = [60, 75, 100, 120, 150];
    const stalks = new Graphics();
    chosen.forEach(([x, y], i) => {
      const size = i % 5 === 0 ? 2.2 + rng() * 0.8 : 0.7 + rng() * 0.7;
      if (rng() < 0.6) {
        const len = 150 + rng() * 550;
        const dir = rng() < 0.5 ? 1 : -1;
        if (rng() < 0.75) stalks.moveTo(x, y).lineTo(x, y + dir * len);
        else stalks.moveTo(x, y).lineTo(x + dir * len, y);
      }
      const halo = new Sprite({texture: haloTex, anchor: 0.5, x, y, tint: v.node, blendMode: 'add'});
      const core = new Sprite({texture: coreTex, anchor: 0.5, x, y, tint: v.node, blendMode: 'add'});
      content.addChild(halo, core);
      this.nodes.push({x, y, halo, core, period: periods[i % periods.length], offset: Math.floor(rng() * 150), size});
    });
    stalks.stroke({width: 3, color: v.line, alpha: 0.8});
    content.addChildAt(stalks, content.getChildIndex(this.nodes[0].halo));
    glowLayer.addChild(new Graphics(stalks.context));
    // links to nearest neighbours; some draw on and fade
    this.nodes.forEach((n, i) => {
      const near = this.nodes
        .map((m, j) => ({m, j, d: Math.hypot(m.x - n.x, m.y - n.y)}))
        .filter((o) => o.j > i && o.d < 900)
        .sort((a, b) => a.d - b.d)
        .slice(0, rng() < 0.5 ? 1 : 0);
      for (const {m} of near) {
        const draw: [number, number] | undefined = rng() < 0.45 ? [Math.floor(rng() * 300), 300] : undefined;
        this.links.push({a: n, b: m, draw, elbow: rng() < 0.45});
      }
    });
    content.addChild(this.dynLines);
    glowLayer.addChild(new Graphics(this.dynLines.context));

    // --- glow: blurred copy of the bright line layers, added on top -----------
    // BlurFilter strength is in device pixels; scale it so the glow has the
    // same size relative to the frame at every output resolution.
    const blur = new BlurFilter({strength: v.glow * app.renderer.resolution, quality: 4});
    glowLayer.filters = [blur];
    glowLayer.filterArea = new Rectangle(0, 0, W, H);
    glowLayer.blendMode = 'add';
    glowLayer.alpha = 1;
    content.addChild(glowLayer);

    // --- foreground streaks ---------------------------------------------------
    const sTex = streakTexture();
    for (let i = 0; i < v.streakCount; i++) {
      const len = 500 + rng() * 1500;
      const thick = 40 + rng() * 110;
      const k = (rng() < 0.5 ? -1 : 1) * (rng() < 0.75 ? 1 : 2);
      const sprite = new Sprite({texture: sTex, anchor: {x: 0, y: 0.5}, tint: rng() < 0.7 ? v.line : 0xd8f8ff, blendMode: 'add'});
      sprite.width = len;
      sprite.height = thick;
      sprite.alpha = 0.14 + rng() * 0.36;
      content.addChild(sprite);
      this.streaks.push({sprite, y: H * (0.04 + rng() * 0.92), len, k, x0: rng()});
    }

    this.final = new Filter({
      antialias: 'on',
      glProgram: GlProgram.from({vertex: defaultFilterVert, fragment: FINAL_FRAG, name: 'digital-final'}),
      resources: {
        finalUniforms: new UniformGroup({
          uFrame: {value: 0, type: 'f32'},
          uGrain: {value: v.grain, type: 'f32'},
          uBg: {value: new Float32Array(v.background), type: 'vec3<f32>'},
          uHaze: {value: new Float32Array(v.haze), type: 'vec3<f32>'},
          uScreen: {value: new Float32Array([W, H]), type: 'vec2<f32>'},
          uBlur: {value: 0.0035, type: 'f32'},
        }),
      },
    });
    view.filters = [this.final];
    view.filterArea = new Rectangle(0, 0, W, H);
  }

  render(frame: number) {
    const f = ((frame % LOOP) + LOOP) % LOOP;

    // dot shimmer: travelling brightness waves across columns
    for (const d of this.dots) {
      const w = 0.75 + 0.25 * Math.sin(TAU * (f / LOOP) * 2 + d.col * 0.21) * Math.sin(TAU * (f / LOOP) + d.col * 0.05);
      d.p.alpha = d.base * w;
    }

    for (const n of this.nodes) {
      const p = phase(f, n.period, n.offset);
      const pulse = 0.5 + 0.5 * Math.cos(TAU * p);
      n.halo.scale.set((0.8 + 0.35 * pulse) * n.size * 1.2);
      n.halo.alpha = 0.7 + 0.3 * pulse;
      n.core.scale.set(0.5 * n.size);
    }

    const g = this.dynLines;
    g.clear();
    for (const l of this.links) {
      let head = 1;
      let tail = 0;
      let alpha = 0.55;
      if (l.draw) {
        const local = phase(f - l.draw[0], l.draw[1]) * l.draw[1];
        head = easeInOut(local / 45);
        tail = easeInOut((local - 200) / 45);
        if (local >= 245) continue;
        alpha = 0.75;
      }
      if (head <= tail) continue;
      const pts: [number, number][] = l.elbow
        ? [[l.a.x, l.a.y], [l.a.x, l.b.y], [l.b.x, l.b.y]]
        : [[l.a.x, l.a.y], [l.b.x, l.b.y]];
      this.polyPart(g, pts, tail, head);
      g.stroke({width: 2.5, color: this.v.line, alpha});
    }

    const c = this.curveG;
    c.clear();
    for (const cv of this.curves) {
      const sh = Math.sin(TAU * (f / LOOP) * cv.k + cv.off * TAU);
      cv.pts.forEach(([x, y], i) => {
        const yy = y + sh * cv.amp * Math.sin((i / 64) * Math.PI);
        if (i === 0) c.moveTo(x, yy);
        else c.lineTo(x, yy);
      });
      c.stroke({width: 5, color: this.v.line, alpha: cv.alpha});
    }

    for (const s of this.streaks) {
      const span = W + s.len;
      const u = phase(f * Math.abs(s.k), LOOP, s.x0 * LOOP);
      const t = s.k > 0 ? u : 1 - u;
      s.sprite.x = -s.len + t * span;
      s.sprite.y = s.y;
    }

    (this.final.resources.finalUniforms as UniformGroup).uniforms.uFrame = f;
    this.app.renderer.render({container: this.content, target: this.rt, clear: true, clearColor: [0, 0, 0, 0]});
    this.app.render();
  }

  private polyPart(g: Graphics, pts: [number, number][], t0: number, t1: number) {
    const segs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    const total = segs.reduce((a, b) => a + b, 0);
    const at = (t: number): [number, number] => {
      let d = t * total;
      for (let i = 0; i < segs.length; i++) {
        if (d <= segs[i] || i === segs.length - 1) {
          const k = segs[i] ? Math.min(1, d / segs[i]) : 0;
          return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
        }
        d -= segs[i];
      }
      return pts[pts.length - 1];
    };
    const a = at(t0);
    g.moveTo(a[0], a[1]);
    let acc = 0;
    for (let i = 0; i < segs.length; i++) {
      acc += segs[i];
      if (acc / total > t0 && acc / total < t1) g.lineTo(pts[i + 1][0], pts[i + 1][1]);
    }
    const b = at(t1);
    g.lineTo(b[0], b[1]);
  }
}
