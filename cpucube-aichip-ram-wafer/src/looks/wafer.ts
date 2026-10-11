import * as THREE from "three";
import { lin } from "../lib/color";
import { LookFactory } from "../lib/LookCanvas";
import { LOOP, phase, TAU, wave } from "../lib/loop";
import { defaultPost } from "../lib/post";
import { mulberry32, Rng } from "../lib/random";

export interface WaferParams {
  /** die floorplan seed */
  seed: number;
  /** wafer base colour */
  base: string;
  /** "perBlock": grating direction varies per block (patchy). "aligned": one direction (broad bands). */
  grating: "perBlock" | "aligned";
  /** dies across the frame at the focus distance */
  diesAcross: number;
  /** show the curved wafer edge on a closed camera path (4B) instead of whole-tile travel (4A) */
  edge: boolean;
  /** light tint */
  light: string;
  /** lens (vertical fov, degrees) and camera height angle */
  fov: number;
  pitch: number;
  /** scribe-line brightness relative to the base (light gaps on 4A) */
  scribe: number;
}

type BlockKind = "memory" | "logic" | "pads" | "fill" | "analog";
interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: BlockKind;
}

const TILE = 4096;

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** Seeded floorplan of one die, in tile pixels (scribe lines included in the tile). */
const floorplan = (rng: Rng) => {
  const scribe = TILE * 0.035;
  const ring = TILE * 0.075; // pad ring width
  const blocks: Block[] = [];
  // pad ring: four rows of pads along the edges
  blocks.push({ x: scribe, y: scribe, w: TILE - 2 * scribe, h: ring, kind: "pads" });
  blocks.push({ x: scribe, y: TILE - scribe - ring, w: TILE - 2 * scribe, h: ring, kind: "pads" });
  blocks.push({ x: scribe, y: scribe + ring, w: ring, h: TILE - 2 * scribe - 2 * ring, kind: "pads" });
  blocks.push({ x: TILE - scribe - ring, y: scribe + ring, w: ring, h: TILE - 2 * scribe - 2 * ring, kind: "pads" });
  // core: guillotine subdivision
  const core = { x: scribe + ring * 1.15, y: scribe + ring * 1.15, w: TILE - 2 * (scribe + ring * 1.15), h: TILE - 2 * (scribe + ring * 1.15) };
  const gap = TILE * 0.012;
  const split = (r: { x: number; y: number; w: number; h: number }, depth: number) => {
    const big = Math.max(r.w, r.h) > TILE * 0.22;
    if (depth > 4 || (!big && rng() < 0.35) || Math.min(r.w, r.h) < TILE * 0.09) {
      const t = rng();
      const kind: BlockKind = t < 0.3 ? "memory" : t < 0.58 ? "logic" : t < 0.68 ? "analog" : "fill";
      blocks.push({ x: r.x + gap / 2, y: r.y + gap / 2, w: r.w - gap, h: r.h - gap, kind });
      return;
    }
    const vertical = r.w > r.h ? rng() < 0.8 : rng() < 0.2;
    const f = 0.3 + rng() * 0.4;
    if (vertical) {
      split({ x: r.x, y: r.y, w: r.w * f, h: r.h }, depth + 1);
      split({ x: r.x + r.w * f, y: r.y, w: r.w * (1 - f), h: r.h }, depth + 1);
    } else {
      split({ x: r.x, y: r.y, w: r.w, h: r.h * f }, depth + 1);
      split({ x: r.x, y: r.y + r.h * f, w: r.w, h: r.h * (1 - f) }, depth + 1);
    }
  };
  split(core, 0);
  return { blocks, scribe };
};

const hexToRgb = (hex: string) => {
  const c = new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
  return [c.r, c.g, c.b].map((v) => Math.round(v * 255));
};

/**
 * Bake the die tile:
 *  - albedo (sRGB)
 *  - grating: R,G = (cos 2θ, sin 2θ) of the line direction (doubled angle so
 *    mipmaps average orientations correctly), B = pitch (0.5–2 µm -> 0..1)
 *  - mask: R = height, G = grating strength, B = bare-metal (pads)
 *  - normal (from the height, baked once)
 */
const bakeDie = (p: WaferParams) => {
  const rng = mulberry32(p.seed);
  const { blocks } = floorplan(rng);
  const alb = canvas(TILE, TILE);
  const grt = canvas(TILE, TILE);
  const msk = canvas(TILE, TILE);
  const a = alb.getContext("2d")!;
  const g = grt.getContext("2d")!;
  const m = msk.getContext("2d")!;
  const base = hexToRgb(p.base);
  const shade = (k: number, tint: [number, number, number] = [0, 0, 0]) =>
    `rgb(${Math.min(255, Math.max(0, Math.round(base[0] * k + tint[0])))},${Math.min(255, Math.max(0, Math.round(base[1] * k + tint[1])))},${Math.min(255, Math.max(0, Math.round(base[2] * k + tint[2])))})`;
  // scribe lines (dark gaps) everywhere first
  a.fillStyle = shade(p.scribe);
  a.fillRect(0, 0, TILE, TILE);
  g.fillStyle = "rgb(128,128,0)";
  g.fillRect(0, 0, TILE, TILE);
  m.fillStyle = "rgb(0,0,0)";
  m.fillRect(0, 0, TILE, TILE);
  const sc = TILE * 0.035;
  a.fillStyle = shade(1.0);
  a.fillRect(sc, sc, TILE - 2 * sc, TILE - 2 * sc);
  m.fillStyle = "rgb(60,10,0)";
  m.fillRect(sc, sc, TILE - 2 * sc, TILE - 2 * sc);

  const alignedTheta = 0.65; // one direction across the whole wafer (4B): lines nearly across the view, so the bands run diagonally
  const gratingFor = (kind: BlockKind) => {
    const dirs = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((k) => k * Math.PI);
    const theta = p.grating === "aligned" ? alignedTheta + (rng() - 0.5) * 0.06 : dirs[Math.floor(rng() * 8)];
    // aligned gratings share one pitch (clean bands); per-block ones vary
    const pitch = p.grating === "aligned" ? 1.95 + rng() * 0.04 : 0.5 + rng() * 1.5;
    const strength = kind === "memory" ? 0.75 + rng() * 0.25 : kind === "logic" ? 0.35 + rng() * 0.4 : kind === "analog" ? 0.25 + rng() * 0.4 : 0.05;
    const c2 = Math.cos(2 * theta) * 0.5 + 0.5;
    const s2 = Math.sin(2 * theta) * 0.5 + 0.5;
    return { theta, pitch, strength, rgb: `rgb(${Math.round(c2 * 255)},${Math.round(s2 * 255)},${Math.round(((pitch - 0.5) / 1.5) * 255)})` };
  };

  for (const b of blocks) {
    const gr = gratingFor(b.kind);
    g.fillStyle = gr.rgb;
    g.fillRect(b.x, b.y, b.w, b.h);
    const str = Math.round(gr.strength * 255);
    if (b.kind === "pads") {
      a.fillStyle = shade(0.93, [-4, 0, 3]);
      a.fillRect(b.x, b.y, b.w, b.h);
      m.fillStyle = `rgb(70,${Math.round(0.08 * 255)},0)`;
      m.fillRect(b.x, b.y, b.w, b.h);
      // a row of square bond pads
      const horiz = b.w > b.h;
      const len = horiz ? b.w : b.h;
      const thick = horiz ? b.h : b.w;
      const ps = thick * 0.62;
      const n = Math.floor(len / (ps * 1.45));
      for (let i = 0; i < n; i++) {
        const o = (i + 0.5) * (len / n) - ps / 2;
        const px = horiz ? b.x + o : b.x + (thick - ps) / 2;
        const py = horiz ? b.y + (thick - ps) / 2 : b.y + o;
        a.fillStyle = shade(1.08, [6, 5, 3]);
        a.fillRect(px, py, ps, ps);
        m.fillStyle = "rgb(120,0,255)";
        m.fillRect(px, py, ps, ps);
      }
      continue;
    }
    if (b.kind === "fill") {
      a.fillStyle = shade(0.97);
      a.fillRect(b.x, b.y, b.w, b.h);
      m.fillStyle = `rgb(90,${str},40)`;
      m.fillRect(b.x, b.y, b.w, b.h);
      continue;
    }
    if (b.kind === "memory") {
      // tinted array with a fine regular grid of cells (dark windows, violet/blue or brown)
      const tr = rng();
      const tint: [number, number, number] = tr < 0.4 ? [10, -10, -8] : tr < 0.65 ? [-6, -10, 16] : [0, 0, 0];
      a.fillStyle = shade(0.42, tint);
      a.fillRect(b.x, b.y, b.w, b.h);
      m.fillStyle = `rgb(150,${str},0)`;
      m.fillRect(b.x, b.y, b.w, b.h);
      const cell = p.grating === "aligned" ? TILE * (0.008 + rng() * 0.01) : TILE * (0.04 + rng() * 0.05);
      const nx = Math.floor(b.w / cell);
      const ny = Math.floor(b.h / cell);
      a.fillStyle = shade(0.62, tint);
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < ny; j++) a.fillRect(b.x + i * cell + cell * 0.18, b.y + j * cell + cell * 0.18, cell * 0.64, cell * 0.64);
      if (p.grating !== "aligned") {
        // large dies: dark windows separated by bright metal, small gold dots at the corners
        a.fillStyle = shade(0.98);
        a.fillRect(b.x, b.y, b.w, b.h);
        for (let i = 0; i < nx; i++)
          for (let j = 0; j < ny; j++) {
            a.fillStyle = shade(0.3, tint);
            a.fillRect(b.x + i * cell + cell * 0.12, b.y + j * cell + cell * 0.12, cell * 0.76, cell * 0.76);
            a.fillStyle = "rgb(205,170,90)";
            a.fillRect(b.x + i * cell + cell * 0.04, b.y + j * cell + cell * 0.04, cell * 0.06, cell * 0.06);
          }
      }
      // sub-array gutters
      a.fillStyle = shade(0.4, tint);
      const sub = 2 + Math.floor(rng() * 3);
      for (let k = 1; k < sub; k++) {
        if (b.w > b.h) a.fillRect(b.x + (k * b.w) / sub - cell * 0.6, b.y, cell * 1.2, b.h);
        else a.fillRect(b.x, b.y + (k * b.h) / sub - cell * 0.6, b.w, cell * 1.2);
      }
      continue;
    }
    // a share of the logic blocks are fine meshes, hole grids, stripes or plain metal
    const variant = rng();
    if (b.kind === "logic" && variant < 0.45) {
      a.fillStyle = shade(0.92);
      a.fillRect(b.x, b.y, b.w, b.h);
      m.fillStyle = `rgb(110,${str},0)`;
      m.fillRect(b.x, b.y, b.w, b.h);
      const pitchPx = TILE * (0.006 + rng() * 0.008);
      if (variant < 0.15) {
        // hole grid
        a.fillStyle = shade(0.45);
        for (let x = b.x + pitchPx / 2; x < b.x + b.w - pitchPx / 2; x += pitchPx)
          for (let y = b.y + pitchPx / 2; y < b.y + b.h - pitchPx / 2; y += pitchPx) a.fillRect(x, y, pitchPx * 0.4, pitchPx * 0.4);
      } else if (variant < 0.3) {
        // fine mesh
        a.strokeStyle = shade(0.7);
        a.lineWidth = pitchPx * 0.18;
        a.beginPath();
        for (let x = b.x; x < b.x + b.w; x += pitchPx) { a.moveTo(x, b.y); a.lineTo(x, b.y + b.h); }
        for (let y = b.y; y < b.y + b.h; y += pitchPx) { a.moveTo(b.x, y); a.lineTo(b.x + b.w, y); }
        a.stroke();
      } else if (variant < 0.4) {
        // parallel stripes
        a.fillStyle = shade(0.66, [-10, 8, -6]);
        const horiz = b.w > b.h;
        for (let o = 0; o < (horiz ? b.h : b.w); o += pitchPx * 1.6)
          if (horiz) a.fillRect(b.x, b.y + o, b.w, pitchPx * 0.7);
          else a.fillRect(b.x + o, b.y, pitchPx * 0.7, b.h);
      }
      continue;
    }
    // logic / analog: dense random small rectangles
    a.fillStyle = shade(b.kind === "logic" ? 0.82 : 0.9, b.kind === "analog" ? [10, 4, -6] : [0, 0, 0]);
    a.fillRect(b.x, b.y, b.w, b.h);
    m.fillStyle = `rgb(120,${str},0)`;
    m.fillRect(b.x, b.y, b.w, b.h);
    const n = Math.floor((b.w * b.h) / (TILE * TILE) * (b.kind === "logic" ? 9000 : 1800));
    for (let i = 0; i < n; i++) {
      const w = TILE * (0.002 + rng() * rng() * (b.kind === "logic" ? 0.012 : 0.03));
      const h = TILE * (0.002 + rng() * rng() * (b.kind === "logic" ? 0.012 : 0.03));
      const x = b.x + rng() * (b.w - w);
      const y = b.y + rng() * (b.h - h);
      const k = 0.55 + rng() * 0.6;
      a.fillStyle = shade(k);
      a.fillRect(x, y, w, h);
    }
  }

  // normal map from the height channel
  const hData = m.getImageData(0, 0, TILE, TILE).data;
  const nrm = canvas(TILE, TILE);
  const nc = nrm.getContext("2d")!;
  const out = nc.createImageData(TILE, TILE);
  const o = out.data;
  const H = (x: number, y: number) => hData[(((y + TILE) % TILE) * TILE + ((x + TILE) % TILE)) * 4] / 255;
  const strength = 6;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * TILE + x) * 4;
      o[i] = Math.round(((-dx / l) * 0.5 + 0.5) * 255);
      o[i + 1] = Math.round(((-dy / l) * 0.5 + 0.5) * 255);
      o[i + 2] = Math.round((1 / l) * 255);
      o[i + 3] = 255;
    }
  nc.putImageData(out, 0, 0);

  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 16;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return { albedo: tex(alb, true), grating: tex(grt, false), mask: tex(msk, false), normal: tex(nrm, false) };
};

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform sampler2D tAlbedo;
uniform sampler2D tGrating;
uniform sampler2D tMask;
uniform sampler2D tNormal;
uniform float uDie;          // die size, world units
uniform vec2 uTravel;
uniform float uDieAspect;    // die width / height (wide dies on 4B)        // camera travel in die tiles (4A), applied to the texture domain
uniform vec3 uLightPos;
uniform vec3 uFlarePos;      // a second, larger source ahead: the specular hot-spot
uniform float uFlare;
uniform vec3 uLightColor;
uniform float uLightPower;
uniform vec3 uFill;
uniform float uRadius;       // wafer radius (0 = infinite)
uniform float uDiffraction;  // overall diffraction strength
uniform float uLobe;         // width of the along-line lobe (light size)
uniform float uFalloff;      // light distance falloff
uniform float uDieVary;
uniform int uOrders;         // diffraction orders summed      // 1: each die gets a random 90° rotation / mirror (4A)
varying vec3 vWorld;

// Smooth fit of the visible spectrum (Zucconi, "spectral_zucconi6"), w in nm.
vec3 bump3y(vec3 x, vec3 yoffset) {
  vec3 y = 1.0 - x * x;
  return clamp(y - yoffset, 0.0, 1.0);
}
vec3 spectral(float w) {
  float x = clamp((w - 400.0) / 300.0, 0.0, 1.0);
  const vec3 c1 = vec3(3.54585104, 2.93225262, 2.41593945);
  const vec3 x1 = vec3(0.69549072, 0.49228336, 0.27699880);
  const vec3 y1 = vec3(0.02312639, 0.15225084, 0.52607955);
  const vec3 c2 = vec3(3.90307140, 3.21182957, 3.96587128);
  const vec3 x2 = vec3(0.11748627, 0.86755042, 0.66077860);
  const vec3 y2 = vec3(0.84897130, 0.88445281, 0.73949448);
  vec3 c = bump3y(c1 * (x - x1), y1) + bump3y(c2 * (x - x2), y2);
  // fade at the ends of 380..750 nm
  float e = smoothstep(380.0, 420.0, w) * (1.0 - smoothstep(690.0, 750.0, w));
  return pow(c, vec3(2.2)) * e;
}

void main() {
  vec2 uv = vWorld.xz / (uDie * vec2(uDieAspect, 1.0)) + uTravel;
  // per-die variation: rotate the tile by k*90° and/or mirror it (and its grating field)
  vec2 cell = floor(uv);
  vec2 f = uv - cell;
  float hsh = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  float k = floor(hsh * 4.0) * uDieVary;
  float mir = step(0.5, fract(hsh * 7.31)) * uDieVary;
  if (mir > 0.5) f.x = 1.0 - f.x;
  if (k > 0.5 && k < 1.5) f = vec2(f.y, 1.0 - f.x);
  else if (k > 1.5 && k < 2.5) f = 1.0 - f;
  else if (k > 2.5) f = vec2(1.0 - f.y, f.x);
  // keep mip selection continuous across die boundaries
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  uv = cell + f;
  float r = length(vWorld.xz);
  if (uRadius > 0.0 && r > uRadius) discard;
  vec3 albedo = textureGrad(tAlbedo, uv, dx, dy).rgb;
  vec3 gr = textureGrad(tGrating, uv, dx, dy).rgb;
  vec3 mk = textureGrad(tMask, uv, dx, dy).rgb;
  vec3 nt = textureGrad(tNormal, uv, dx, dy).rgb * 2.0 - 1.0;
  // tangent frame of the wafer plane: x -> u, z -> v, y up
  vec3 N = normalize(vec3(nt.x, nt.z, nt.y) * vec3(0.35, 1.0, 0.35) + vec3(0.0, 0.0, 0.0));
  N = normalize(vec3(nt.x * 0.35, 1.0, nt.y * 0.35));
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 Lv = uLightPos - vWorld;
  float dist = length(Lv);
  vec3 L = Lv / dist;
  float atten = uLightPower / (1.0 + dist * dist * uFalloff);

  // base: diffuse + a broad specular sheen (polished silicon)
  float ndl = max(dot(N, L), 0.0);
  vec3 H = normalize(L + V);
  float ndh = max(dot(N, H), 0.0);
  float metal = mk.b;
  float rough = mix(0.32, 0.18, metal);
  float a2 = rough * rough * rough * rough;
  float d = ndh * ndh * (a2 - 1.0) + 1.0;
  float ggx = a2 / (3.14159 * d * d);
  float fres = 0.33 + 0.67 * pow(1.0 - max(dot(V, H), 0.0), 5.0);
  vec3 col = albedo * (uFill + uLightColor * ndl * atten * 0.55);
  col += uLightColor * ggx * fres * ndl * atten * 0.12 * mix(vec3(1.0), albedo * 1.4, 0.3);

  // broad specular hot-spot from the second source
  if (uFlare > 0.0) {
    vec3 L2 = normalize(uFlarePos - vWorld);
    vec3 H2 = normalize(L2 + V);
    float n2 = max(dot(N, H2), 0.0);
    float a22 = 0.22 * 0.22;
    float d2 = n2 * n2 * (a22 - 1.0) + 1.0;
    float g2 = a22 / (3.14159 * d2 * d2);
    // the dies' own reflectivity shapes the flare, so their structure stays readable inside it
    float refl = 0.25 + 0.75 * smoothstep(0.25, 0.75, dot(albedo, vec3(0.333)) * 1.6) + metal * 0.5;
    col += uLightColor * g2 * uFlare * refl * (albedo * 1.3 + 0.12) * max(dot(N, L2), 0.0);
  }

  // first-order (+2nd, 3rd) diffraction from the per-block grating
  vec2 cs = gr.rg * 2.0 - 1.0;
  // the tile transform rotates/mirrors the line directions too (doubled-angle encoding)
  if (mir > 0.5) cs.y = -cs.y;
  if (mod(k, 2.0) > 0.5) cs = -cs;
  float coherence = clamp(length(cs) * 1.15, 0.0, 1.0); // mixed orientations (mips) diffuse
  float th = 0.5 * atan(cs.y, cs.x);
  vec3 lineDir = vec3(cos(th), 0.0, sin(th));     // along the lines
  vec3 gDir = vec3(-sin(th), 0.0, cos(th));       // grating vector
  float pitch = (0.5 + gr.b * 1.5) * 1000.0;      // nm
  vec3 S = V + L;                                  // outgoing + reversed incoming
  float along = dot(S, lineDir);
  float lobe = exp(-along * along / (uLobe * uLobe));
  float s = abs(dot(S, gDir));
  vec3 diff = vec3(0.0);
  for (int m = 1; m <= 4; m++) {
    if (m > uOrders) break;
    float lambda = pitch * s / float(m);
    diff += spectral(lambda) / float(m);
  }
  float strength = mk.g * coherence * uDiffraction;
  // zeroth order: near the specular direction of the grating the surface shows a
  // bright, colourless sheen instead of a gap between the rainbow orders
  diff += vec3(0.9, 0.85, 1.0) * 0.12 * exp(-s * s / 0.015);
  col += diff * lobe * strength * uLightColor * atten * (0.6 + 0.4 * ndl);

  // the rim of the wafer: a thin bevel that catches the light
  if (uRadius > 0.0) {
    float edge = smoothstep(uRadius - uDie * 0.6, uRadius, r);
    col = mix(col, uLightColor * 0.25 * atten + albedo * 0.08, edge * 0.85);
    col *= 1.0 - smoothstep(uRadius - uDie * 0.1, uRadius, r) * 0.6;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export const wafer: LookFactory<WaferParams> = (p) => {
  const scene = new THREE.Scene();
  scene.background = lin("#000000");
  const camera = new THREE.PerspectiveCamera(p.fov, 16 / 9, 0.05, 400);
  const post = defaultPost();
  const tx = bakeDie(p);

  // die size from the requested dies-across at the focus distance
  const pitchDeg = p.pitch;
  const focus = 10;
  const frameW = 2 * focus * Math.tan(THREE.MathUtils.degToRad(p.fov / 2)) * (16 / 9);
  const die = frameW / p.diesAcross;
  const radius = p.edge ? die * 150 : 0;

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      tAlbedo: { value: tx.albedo },
      tGrating: { value: tx.grating },
      tMask: { value: tx.mask },
      tNormal: { value: tx.normal },
      uDie: { value: die },
      uTravel: { value: new THREE.Vector2() },
      uDieAspect: { value: p.edge ? 1.6 : 1.0 },
      uLightPos: { value: new THREE.Vector3() },
      uFlarePos: { value: new THREE.Vector3() },
      uFlare: { value: p.edge ? 0.0 : 7.0 },
      uDieVary: { value: p.grating === "aligned" ? 0 : 1 },
      uOrders: { value: p.grating === "aligned" ? 4 : 2 },
      uLightColor: { value: lin(p.light) },
      uLightPower: { value: 1 },
      uFill: { value: new THREE.Color(1, 1, 1).multiplyScalar(p.edge ? 0.9 : 0.62) },
      uRadius: { value: radius },
      uDiffraction: { value: p.grating === "aligned" ? 16.0 : 16.0 },
      uLobe: { value: p.grating === "aligned" ? 3.0 : 0.45 },
      uFalloff: { value: p.edge ? 0.006 : 0.02 },
    },
  });
  const size = p.edge ? radius * 2.2 : 400;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), mat);
  plane.rotation.x = -Math.PI / 2;
  scene.add(plane);

  const fwd = new THREE.Vector3();
  const target = new THREE.Vector3();
  const update = (frame: number) => {
    const t = frame / LOOP;
    let cx: number;
    let cz: number;
    let yaw: number;
    if (!p.edge) {
      // glide diagonally: exactly (3, 2) die tiles per loop
      // glide diagonally across exactly (3, 2) die tiles per loop. The surface is
      // uniform, so the travel is applied to the texture domain (exactly 0 at the loop point).
      const ph = phase(frame, 1);
      mat.uniforms.uTravel.value.set(3 * ph, -2 * ph);
      cx = 0;
      cz = 0;
      yaw = Math.atan2(3, 2) * 0 + 0.55;
    } else {
      // closed path near the rim: along the edge and back, eased, drifting in and out
      // so the curved rim is in frame at times. The camera sits outside the rim, looking in.
      const e = 0.5 - 0.5 * Math.cos(TAU * t);
      const ang = -0.3 + 0.5 * e;
      const rr = radius - die * (14 + 9 * wave(frame, 1, 0.25));
      cx = rr * Math.sin(ang);
      cz = rr * Math.cos(ang);
      yaw = ang + Math.PI + 0.3;
    }
    const pitch = THREE.MathUtils.degToRad(pitchDeg + 2 * wave(frame, 1, 0.1));
    fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    if (p.edge) fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    target.set(cx, 0, cz);
    camera.position.copy(target).addScaledVector(fwd, -focus * Math.cos(pitch));
    camera.position.y = focus * Math.sin(pitch);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    // light: a small strong source orbiting (one whole orbit), ahead of the camera
    // (above and a little behind the camera: the off-specular geometry that gives
    // wafers their rainbow; the orbit sweeps the diffraction colours)
    const la = TAU * phase(frame, 1);
    const side = new THREE.Vector3(fwd.z, 0, -fwd.x);
    mat.uniforms.uFlarePos.value
      .copy(target)
      .addScaledVector(fwd, focus * 2.4)
      .addScaledVector(side, focus * (0.32 + 0.15 * wave(frame, 1, 0.3)))
      .setY(focus * 0.5);
    if (!p.edge) {
      const lc = camera.position.clone().addScaledVector(fwd, -focus * 0.15);
      lc.y += focus * 0.55;
      mat.uniforms.uLightPos.value.set(lc.x + Math.cos(la) * focus * 0.45, lc.y + Math.sin(la) * focus * 0.1, lc.z + Math.sin(la) * focus * 0.45);
    } else {
      // 4B: a close source low over the wafer, so (V+L)·g sweeps through several
      // diffraction orders across the frame: broad diagonal rainbow bands
      const lc = target.clone().addScaledVector(fwd, -focus * 0.1);
      lc.y = focus * 0.2;
      mat.uniforms.uLightPos.value.set(lc.x + Math.cos(la) * focus * 0.3, lc.y + Math.sin(la) * focus * 0.06, lc.z + Math.sin(la) * focus * 0.3);
    }
    mat.uniforms.uLightPower.value = p.edge ? 2.6 : 2.4;
    // 4B: focus a little beyond the centre, so the upper half is sharp and the foreground soft
    post.focusDist = p.edge ? focus * 1.18 : focus;
  };

  Object.assign(post, {
    aperture: p.edge ? 0.07 : 0.06,
    maxCoc: 0.02,
    bloomStrength: p.edge ? 0.25 : 0.4,
    bloomThreshold: 1.0,
    bloomKnee: 0.5,
    bloomSpread: 0.65,
    exposure: p.edge ? 1.7 : 2.05,
    vignette: 0.3,
    grain: 0.015,
    saturation: p.edge ? 1.12 : 1.05,
  });
  return { scene, camera, post, update };
};
