import {
  BlurFilter,
  Container,
  Filter,
  GlProgram,
  Graphics,
  Particle,
  ParticleContainer,
  Rectangle,
  Renderer,
  Texture,
} from "pixi.js";
import { clamp, hash2, mulberry32, smoothstep, TAU } from "../common/random";
import { ChargeIconRow } from "../versions";

// Look 4: a dotted neon battery + bolt over a fly-through of flickering
// data-pixel clusters. Everything is laid out in 3840 x 2160 design pixels;
// the renderer's resolution maps that to the output size.

export const W = 3840;
export const H = 2160;
const CX = W / 2;
const CY = H / 2;
const LOOP = 600;

// ---------------------------------------------------------------- icon shape
// Sized to the reference clip (body ~0.5 H tall, ~0.145 W wide): the 22 % x
// 12 % of the brief looked small next to it in side-by-side checks.
const BODY_H = 0.5 * H;
const BODY_W = 0.145 * W;
const CORNER = 0.17 * BODY_W;
const CAP_W = 0.42 * BODY_W;
const CAP_H = 0.05 * BODY_H;
const DOT = 8.5; // dot diameter, design px
const DOT_STEP = DOT * 1.2;

type Pt = [number, number];

// dense polyline -> evenly spaced points
const resample = (poly: Pt[], step: number, closed: boolean): Pt[] => {
  const pts = closed ? [...poly, poly[0]] : poly;
  const out: Pt[] = [];
  let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    let d = carry;
    while (d < len) {
      const t = d / len;
      out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
      d += step;
    }
    carry = d - len;
  }
  return out;
};

const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 24): Pt[] => {
  const o: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return o;
};

// Battery outline with the terminal cap, clockwise from the cap's left foot.
const batteryOutline = (d = 0): Pt[] => {
  const l = CX - BODY_W / 2 - d;
  const r = CX + BODY_W / 2 + d;
  const t = CY - BODY_H / 2 - d;
  const b = CY + BODY_H / 2 + d;
  const c = CORNER + d;
  const cl = CX - CAP_W / 2 - d;
  const cr = CX + CAP_W / 2 + d;
  const cc = CAP_H * 0.45;
  return [
    [cl, t],
    [cl, t - CAP_H + cc + d],
    ...arc(cl + cc, t - CAP_H + cc, cc, Math.PI, 1.5 * Math.PI, 8),
    ...arc(cr - cc, t - CAP_H + cc, cc, 1.5 * Math.PI, 2 * Math.PI, 8),
    [cr, t],
    ...arc(r - c, t + c, c, 1.5 * Math.PI, 2 * Math.PI),
    ...arc(r - c, b - c, c, 0, 0.5 * Math.PI),
    ...arc(l + c, b - c, c, 0.5 * Math.PI, Math.PI),
    ...arc(l + c, t + c, c, Math.PI, 1.5 * Math.PI),
    [cl, t],
  ];
};

// Lightning bolt as a closed, bold outline, body-relative units.
const BOLT: Pt[] = [
  [0.3, -0.36],
  [-0.27, 0.07],
  [0.02, 0.07],
  [-0.25, 0.38],
  [0.31, -0.07],
  [0.03, -0.07],
];
const boltOutline = (): Pt[] =>
  BOLT.map(([x, y]) => [CX + x * BODY_W, CY + y * BODY_H] as Pt);

const mixHex = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

const strokePoly = (g: Graphics, p: Pt[], closed: boolean) => {
  g.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]);
  if (closed) g.closePath();
};

// --------------------------------------------------------------- data blocks
type Cluster = {
  cols: number;
  rows: number;
  cell: number;
  x: number;
  y: number;
  phase: number;
  wraps: number;
  color: number;
  streak: boolean; // horizontal glitch smear instead of square blocks
  red: boolean;
  cells: { i: number; j: number; id: number; shade: number; len: number }[];
};

const PALETTE = [0x1ad8b8, 0x2ae86a, 0x2a6aff, 0xe82a3a]; // teal, green, blue, red
const CLUSTERS = 240;
const Z_FAR = 3.4;
const Z_NEAR = 0.55;
const Z_SPLIT_A = 1.4;
const Z_SPLIT_B = 2.0;

const buildClusters = (shares: number[], seed: number): Cluster[] => {
  const rnd = mulberry32(seed);
  const out: Cluster[] = [];
  let id = 0;
  for (let c = 0; c < CLUSTERS; c++) {
    const cols = 5 + Math.floor(rnd() * 14);
    const rows = 5 + Math.floor(rnd() * 8);
    const cell = 16 + rnd() * 14;
    // denser in a central band behind the icon, as in the reference
    // a central band (x ~0.22-0.8 of the frame); the left fifth stays dark
    let x = -950 + rnd() * 2250;
    let y = (rnd() * 2 - 1) * 1150;
    const phase = rnd();
    const wraps = rnd() < 0.65 ? 1 : 2;
    let pick = rnd();
    let ci = 0;
    for (; ci < 3; ci++) {
      if (pick < shares[ci]) break;
      pick -= shares[ci];
    }
    // red glitch blocks gather on the right, as in the reference
    if (ci === 3) {
      // red glitch zone on the right, upper-middle
      x = 1050 + rnd() * 900;
      y = -750 + rnd() * 1000;
    }
    const density = 0.45 + rnd() * 0.45;
    const kind = rnd();
    const frame = kind < 0.1; // outlined rectangle / circuit frame
    const streak = kind > 0.84 || (ci === 3 && kind > 0.4); // horizontal smear
    const stripe = !frame && rnd() < 0.3; // row-striped grids
    const cells: Cluster["cells"] = [];
    for (let j = 0; j < rows; j++) {
      if (stripe && j % 2 === 1) continue;
      for (let i = 0; i < cols; i++) {
        const edge = i === 0 || j === 0 || i === cols - 1 || j === rows - 1;
        const inner = i === 2 || j === 2 || i === cols - 3 || j === rows - 3;
        if (frame) {
          if (!edge && !(inner && hash2(c, i + j) > 0.4)) continue;
        } else if (hash2(c * 977 + i, j * 131 + 7) > density) continue;
        if (streak && i > 0 && hash2(c * 31 + j, 5) > 0.3) continue; // one smear per row
        cells.push({
          i,
          j,
          id: id++,
          shade: 0.6 + 0.4 * hash2(id, 99),
          len: streak ? 3 + Math.floor(hash2(c, j * 7) * (cols - 2)) : 1,
        });
      }
    }
    out.push({ cols, rows, cell, x, y, phase, wraps, color: PALETTE[ci], streak, red: ci === 3, cells });
  }
  return out;
};

// ---------------------------------------------------------------- post filter
const postVertex = `in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;

const postFragment = `precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize; // must match the vertex shader's precision
uniform highp vec4 uOutputFrame;
uniform float uFrame;
uniform float uGrain;
uniform float uVig;
float hash(vec2 p, float f) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031 + f * 0.0137);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  vec3 col = c.rgb; // premultiplied over black
  vec2 uv = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
  vec2 q = uv - 0.5;
  q.x *= uOutputFrame.z / uOutputFrame.w;
  col *= 1.0 - uVig * smoothstep(0.3, 1.0, length(q));
  vec2 p = floor(uv * uOutputFrame.zw);
  float f = mod(uFrame, 600.0);
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col += (hash(p, f) - 0.5) * 2.0 * uGrain * (0.35 + luma);
  col += (hash(p + 17.0, f) + hash(p + 59.0, f + 3.0) - 1.0) / 255.0;
  finalColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// --------------------------------------------------------------------- scene
export class ChargeIconScene {
  stage = new Container();
  private far: ParticleContainer;
  private near: ParticleContainer;
  private fog: ParticleContainer;
  private fogP: Particle[] = [];
  private farP: Particle[] = [];
  private nearP: Particle[] = [];
  private clusters: Cluster[];
  private hud = new Container();
  private hudA = new Graphics();
  private hudB = new Graphics();
  private icon = new Container();
  private iconBloom = new Container();
  private fill = new Graphics();
  private fillGlow = new Graphics();
  private bolt = new Graphics();
  private post: Filter;
  private texSize: number;

  constructor(private row: ChargeIconRow, resolution: number) {
    this.clusters = buildClusters(row.shares, row.fill ? 4242 : 2148);
    const tex = Texture.WHITE;
    this.texSize = tex.width;
    const mk = () =>
      new ParticleContainer({
        dynamicProperties: { position: true, vertex: true, color: true, rotation: false, uvs: false },
        boundsArea: new Rectangle(0, 0, W, H),
      });
    this.far = mk();
    this.near = mk();
    this.fog = mk();
    for (const cl of this.clusters) {
      for (let k = 0; k < cl.cells.length; k++) {
        const a = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5, tint: cl.color });
        const b = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5, tint: cl.color });
        this.far.addParticle(a);
        this.near.addParticle(b);
        this.farP.push(a);
        this.nearP.push(b);
      }
    }
    for (const cl of this.clusters) {
      const f = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5, tint: cl.color });
      this.fog.addParticle(f);
      this.fogP.push(f);
    }
    // haze: one big soft quad per cluster, heavily blurred ("data fog")
    const fogWrap = new Container();
    fogWrap.addChild(this.fog);
    fogWrap.filters = [new BlurFilter({ strength: 90, quality: 4, resolution })];
    fogWrap.filterArea = new Rectangle(0, 0, W, H);
    fogWrap.blendMode = "add";
    const farWrap = new Container();
    farWrap.addChild(this.far);
    farWrap.filters = [new BlurFilter({ strength: 10, quality: 4, resolution })];
    farWrap.filterArea = new Rectangle(0, 0, W, H);
    farWrap.blendMode = "add";
    this.near.blendMode = "add";
    const nearWrap = new Container();
    nearWrap.addChild(this.near);
    nearWrap.filters = [new BlurFilter({ strength: 3, quality: 2, resolution })];
    nearWrap.filterArea = new Rectangle(0, 0, W, H);
    this.stage.addChild(fogWrap, farWrap, nearWrap);

    // HUD arcs: radius relative to the icon, as 18 % / 21 % are to a 22 % icon
    const r1 = BODY_H * (0.18 / 0.22);
    const r2 = BODY_H * (0.21 / 0.22);
    const segArc = (g: Graphics, r: number, segs: number, width: number) => {
      // pattern repeats every 90 degrees, so a 90 degree turn loops exactly
      for (let q = 0; q < 4; q++) {
        for (let s = 0; s < segs; s++) {
          const a0 = (q * TAU) / 4 + (s * TAU) / 4 / segs + 0.06;
          const a1 = a0 + (TAU / 4 / segs) * (s === 0 ? 0.62 : 0.34);
          g.moveTo(r * Math.cos(a0), r * Math.sin(a0));
          g.arc(0, 0, r, a0, a1);
        }
      }
      g.stroke({ width, color: row.glow, alpha: 0.14 });
    };
    segArc(this.hudA, r1, 3, 5);
    segArc(this.hudB, r2, 4, 3);
    this.hudA.position.set(CX, CY);
    this.hudB.position.set(CX, CY);
    this.hud.addChild(this.hudA, this.hudB);
    this.stage.addChild(this.hud);

    // Icon: glow copies (wide, faint) + dotted core
    const outline = batteryOutline();
    const bolt = boltOutline();
    // faint blue tint inside the body
    const inside = new Graphics();
    // opaque dark interior: the data field never shows through the icon
    inside.roundRect(CX - BODY_W / 2, CY - BODY_H / 2, BODY_W, BODY_H, CORNER);
    inside.fill({ color: 0x02060e, alpha: 0.96 });
    inside.roundRect(CX - BODY_W / 2, CY - BODY_H / 2, BODY_W, BODY_H, CORNER);
    inside.fill({ color: row.glow, alpha: 0.025 });
    const glow = new Graphics();
    const boltGlow = new Graphics(); // above the interior fill, unlike `glow`
    for (const [w, a] of [
      [100, 0.1],
      [52, 0.22],
      [40, 0.9],
    ] as const) {
      strokePoly(glow, outline, false);
      glow.stroke({ width: w, color: row.glow, alpha: a, join: "round", cap: "round" });
      strokePoly(boltGlow, bolt, true);
      boltGlow.stroke({ width: w * 0.8, color: row.glow, alpha: a, join: "round", cap: "round" });
    }
    // dotted strokes, coloured from the hot core colour (upper left) to a
    // blue-violet (lower right), with a few hashed sparkle dots
    const far = `#${mixHex(row.glow, "#6A5AFF", 0.6).toString(16).padStart(6, "0")}`;
    const dots = new Graphics();
    const dense = (p: Pt[], closed: boolean) => resample(p, 2, closed);
    const tint = (x: number, y: number) => {
      const t = clamp(((x - (CX - BODY_W / 2)) / BODY_W) * 0.55 + ((y - (CY - BODY_H / 2)) / BODY_H) * 0.6 - 0.15);
      return mixHex(row.outline, far, t * 0.55);
    };
    // a doubled neon tube: two rows of fine dots with grainy brightness
    let k = 0;
    for (const d of [-7, 7]) {
      for (const [x, y] of resample(dense(batteryOutline(d), false), DOT_STEP, false)) {
        const hot = hash2(k++, 7);
        dots.circle(x, y, DOT / 2);
        dots.fill({ color: hot > 0.85 ? "#FFFFFF" : tint(x, y), alpha: 0.55 + 0.45 * hot });
      }
    }
    const boltPts = resample(dense(bolt, true), DOT_STEP, false);
    boltPts.forEach(([x, y], k) => {
      this.bolt.circle(x, y, DOT / 2 + 2.5);
      // brightest near the top of the bolt
      this.bolt.fill({ color: mixHex("#FFFFFF", row.glow, clamp(k / boltPts.length) * 0.6) });
    });

    // 4B fill segments (drawn once, alpha animated)
    if (row.fill) this.buildFill();

    // interior above the glow copies: the glow only shows outside the body
    this.icon.addChild(glow, inside, this.fillGlow, this.fill, boltGlow, dots, this.bolt);
    // bloom: a blurred additive copy of the icon only
    const bloomG = new Graphics();
    strokePoly(bloomG, outline, false);
    bloomG.stroke({ width: 44, color: row.glow, alpha: 1, join: "round" });
    strokePoly(bloomG, bolt, true);
    bloomG.stroke({ width: 64, color: row.glow, alpha: 1, join: "round" });
    const bloomWide = new Graphics();
    strokePoly(bloomWide, outline, false);
    bloomWide.stroke({ width: 70, color: far, alpha: 0.85, join: "round" });
    const bloomWideWrap = new Container();
    bloomWideWrap.addChild(bloomWide);
    bloomWideWrap.filters = [new BlurFilter({ strength: 140, quality: 4, resolution })];
    bloomWideWrap.filterArea = new Rectangle(0, 0, W, H);
    const bloomTight = new Container();
    bloomTight.addChild(bloomG);
    bloomTight.filters = [new BlurFilter({ strength: 40, quality: 4, resolution })];
    bloomTight.filterArea = new Rectangle(0, 0, W, H);
    this.iconBloom.addChild(bloomWideWrap, bloomTight);
    this.iconBloom.blendMode = "add";
    this.stage.addChild(this.iconBloom, this.icon);

    this.post = new Filter({
      glProgram: GlProgram.from({ vertex: postVertex, fragment: postFragment, name: "charge-post" }),
      resources: {
        postUniforms: {
          uFrame: { value: 0, type: "f32" },
          uGrain: { value: 0.015, type: "f32" },
          uVig: { value: 0.55, type: "f32" },
        },
      },
      resolution,
    });
    this.stage.filters = [this.post];
    this.stage.filterArea = new Rectangle(0, 0, W, H);
  }

  private segRects: Rectangle[] = [];
  private buildFill() {
    const pad = 0.1 * BODY_W;
    const innerTop = CY - BODY_H / 2 + pad;
    const innerBot = CY + BODY_H / 2 - pad;
    const gap = 0.025 * BODY_H;
    const segH = (innerBot - innerTop - gap * 3) / 4;
    for (let k = 0; k < 4; k++) {
      const y = innerBot - (k + 1) * segH - k * gap;
      this.segRects.push(new Rectangle(CX - BODY_W / 2 + pad, y, BODY_W - 2 * pad, segH));
    }
  }

  // 4B timeline, two cycles of 300 frames: four segments light one by one
  // (8 frames each), flash when full, hold, fade out together, rest empty.
  static fillState(frame: number) {
    const f = frame % 300;
    const starts = [24, 70, 116, 162];
    const seg = starts.map((s) => smoothstep(s, s + 8, f));
    const fade = 1 - smoothstep(236, 266, f);
    const flash = f >= 176 ? Math.exp(-(f - 176) / 5) * (f < 206 ? 1 : 0) : 0;
    return { seg: seg.map((v) => v * fade), flash, level: seg.reduce((a, b) => a + b, 0) / 4 * fade };
  }

  update(frame: number) {
    const f = frame % LOOP;
    const t = f / LOOP;

    // ---- data background
    let n = 0;
    let ci = 0;
    const s = 1 / this.texSize;
    const bucket = Math.floor(f / 3);
    for (const cl of this.clusters) {
      const u = (cl.phase + cl.wraps * t) % 1;
      const z = Z_FAR - (Z_FAR - Z_NEAR) * u;
      const k = 1 / z;
      const fadeIn = smoothstep(Z_FAR, Z_FAR * 0.72, z);
      const fadeOut = smoothstep(Z_NEAR, Z_NEAR * 1.9, z);
      const depthB = 0.6 + 0.4 * clamp(1 - (z - Z_NEAR) / (Z_FAR - Z_NEAR) * 1.1);
      // streaks and the red zone always sit in the blurred layer
      const farW = cl.streak || cl.red ? 1 : smoothstep(Z_SPLIT_A, Z_SPLIT_B, z);
      const size = cl.cell * 0.74 * k;
      const ox = CX + cl.x * k;
      const oy = CY + cl.y * k;
      const base = fadeIn * fadeOut * depthB;
      const fp0 = this.fogP[ci++];
      fp0.x = ox;
      fp0.y = oy;
      fp0.scaleX = cl.cols * cl.cell * k * s * 1.1;
      fp0.scaleY = cl.rows * cl.cell * k * s * 1.1;
      fp0.alpha = (cl.red ? 0.18 : 0.025) * base;
      for (const c of cl.cells) {
        const h = hash2(c.id, bucket);
        const flick = h < 0.12 ? 0.12 : 0.55 + 0.45 * h;
        const a = clamp(1.5 * base * flick * c.shade);
        const w = c.len > 1 ? (c.len - 0.26) * cl.cell * k : size;
        const hgt = c.len > 1 ? size * 0.42 : size;
        const px = ox + (c.i - cl.cols / 2 + (c.len - 1) / 2) * cl.cell * k;
        const py = oy + (c.j - cl.rows / 2) * cl.cell * k;
        const fp = this.farP[n];
        const np = this.nearP[n];
        fp.x = np.x = px;
        fp.y = np.y = py;
        fp.scaleX = np.scaleX = w * s;
        fp.scaleY = np.scaleY = hgt * s;
        fp.alpha = a * farW;
        np.alpha = a * (1 - farW);
        n++;
      }
    }

    // ---- HUD arcs: opposite directions, exactly 90 deg per loop
    this.hudA.rotation = (TAU / 4) * t;
    this.hudB.rotation = -(TAU / 4) * t;

    // ---- icon: breathing (2 cycles per loop) + glitch on 3 fixed frames
    const breathe = 0.5 - 0.5 * Math.cos(TAU * 2 * t);
    let glow = 0.72 + 0.28 * breathe;
    let jx = 0;
    let jy = 0;
    const glitchFrames = [97, 331, 512];
    const gi = glitchFrames.indexOf(f);
    if (gi >= 0) {
      jx = (hash2(gi, 1) * 2 - 1) * 6;
      jy = (hash2(gi, 2) * 2 - 1) * 6;
    }
    if (this.row.fill) {
      const st = ChargeIconScene.fillState(f);
      this.fill.clear();
      this.fillGlow.clear();
      st.seg.forEach((v, k) => {
        if (v <= 0.001) return;
        const r = this.segRects[k];
        this.fill.roundRect(r.x, r.y, r.width, r.height, 10);
        this.fill.fill({ color: "#3AF08A", alpha: 0.5 * v });
        this.fillGlow.roundRect(r.x - 10, r.y - 10, r.width + 20, r.height + 20, 18);
        this.fillGlow.fill({ color: "#2AE86A", alpha: 0.16 * v });
      });
      this.bolt.alpha = 0.75 + 0.25 * st.level;
      glow = glow * (0.85 + 0.35 * st.level) + 1.2 * st.flash;
      this.icon.alpha = Math.min(1, 0.92 + 0.08 * st.level + st.flash);
    }
    this.icon.position.set(jx, jy);
    this.iconBloom.position.set(jx, jy);
    this.iconBloom.alpha = clamp(glow * 1.5, 0, 1);
    this.hud.alpha = 0.8 + 0.2 * breathe;

    this.post.resources.postUniforms.uniforms.uFrame = f;
  }

  render(renderer: Renderer) {
    renderer.render({ container: this.stage, clearColor: [0, 0, 0, 1] });
  }
}
