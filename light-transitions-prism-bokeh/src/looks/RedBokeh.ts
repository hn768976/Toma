import { BLEND_MODES, Container, Sprite, Texture } from "pixi.js";
import { fullscreenMesh, GLSL_COMMON } from "../lib/gl";
import type { LookBuilder } from "../lib/stage";
import { hexToRgb } from "../lib/timeline";
import { mulberry32, range } from "../lib/random";

export interface RedBokehParams {
  bgCentre: string;
  bgCorner: string;
  bokehA: string;
  bokehB: string;
  sparkle: string;
}

const LOOP = 600;

const BG_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 finalColor;
uniform float uAspect;
uniform vec3 uCentre, uCorner;
${GLSL_COMMON}
void main() {
  vec2 q = (vUV - 0.5) * vec2(uAspect, 1.0);
  float d = length(q) / length(vec2(0.5 * uAspect, 0.5));
  float k = smoothstep(0.0, 1.0, d);
  k = k * k * (1.2 - 0.2 * k);
  finalColor = vec4(mix(uCentre, uCorner, sat(k)), 1.0);
}`;

// Pre-baked sprite textures (drawn once, before the first frame).
const canvasTex = (size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) => {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!;
  draw(g, size);
  return Texture.from(c);
};

const discTexture = (edge: number, rim: number) =>
  canvasTex(256, (g, s) => {
    const r = s / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, "rgba(255,255,255,0.78)");
    grad.addColorStop(Math.max(0.05, 1 - edge - 0.18), "rgba(255,255,255,0.84)");
    grad.addColorStop(1 - edge * 0.6, `rgba(255,255,255,${rim})`);
    grad.addColorStop(1 - edge * 0.25, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });

const glowTexture = () =>
  canvasTex(64, (g, s) => {
    const r = s / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.12, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.3, "rgba(255,255,255,0.25)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  });

const starTexture = () =>
  canvasTex(256, (g, s) => {
    const r = s / 2;
    g.globalCompositeOperation = "lighter";
    const glow = g.createRadialGradient(r, r, 0, r, r, r * 0.4);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.25, "rgba(255,255,255,0.5)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, s, s);
    // Four tapered spikes.
    for (let k = 0; k < 4; k++) {
      g.save();
      g.translate(r, r);
      g.rotate((k * Math.PI) / 2);
      const lg = g.createLinearGradient(0, 0, r, 0);
      lg.addColorStop(0, "rgba(255,255,255,1)");
      lg.addColorStop(0.5, "rgba(255,255,255,0.35)");
      lg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(0, -s * 0.03);
      g.lineTo(r, 0);
      g.lineTo(0, s * 0.03);
      g.closePath();
      g.fill();
      g.restore();
    }
  });

interface Item {
  sprite: Sprite;
  bx: number;
  by: number;
  layer: number;
  baseAlpha: number;
  baseScale: number;
  tw: number; // twinkle cycles per loop
  ph: number;
  glint: number; // 0 = none
  gc: number;
  gph: number;
  rot0: number;
}

// Layers: [repeatsX, repeatsY] per loop -> drift by whole layout repeats.
const LAYERS = [
  { count: 70, rMin: 40, rMax: 88, aMin: 0.1, aMax: 0.26, dx: 0, dy: 1, tex: 0 }, // large, faint
  { count: 150, rMin: 12, rMax: 28, aMin: 0.1, aMax: 0.24, dx: 1, dy: 1, tex: 1 }, // medium
  { count: 380, rMin: 2.5, rMax: 7, aMin: 0.14, aMax: 0.4, dx: -1, dy: 2, tex: 2 }, // small, bright
];

export const buildRedBokeh: LookBuilder<RedBokehParams> = ({ width, height }, params) => {
  const aspect = width / height;
  const S = height / 720; // layout units per 720p pixel
  const bg = fullscreenMesh(width, height, BG_FRAG, {
    uAspect: { value: aspect, type: "f32" },
    uCentre: { value: new Float32Array(hexToRgb(params.bgCentre)), type: "vec3<f32>" },
    uCorner: { value: new Float32Array(hexToRgb(params.bgCorner)), type: "vec3<f32>" },
  });
  const scene = new Container();
  scene.addChild(bg.mesh);

  const discTex = [discTexture(0.3, 0.86), discTexture(0.16, 0.95), discTexture(0.1, 1.0)];
  const glowTex = glowTexture();
  const starTex = starTexture();
  const rng = mulberry32(0x5eed_b0e);
  const margin = 100 * S;
  const domW = width + 2 * margin;
  const domH = height + 2 * margin;
  const ca = hexToRgb(params.bokehA);
  const cb = hexToRgb(params.bokehB);
  const lerpHex = (t: number) => {
    const c = [0, 1, 2].map((i) => Math.round((ca[i] + (cb[i] - ca[i]) * t) * 255));
    return (c[0] << 16) | (c[1] << 8) | c[2];
  };
  const sparkleTint = parseInt(params.sparkle.replace("#", ""), 16);
  const items: Item[] = [];

  LAYERS.forEach((L, li) => {
    const layer = new Container();
    scene.addChild(layer);
    for (let i = 0; i < L.count; i++) {
      const sp = new Sprite(discTex[L.tex]);
      sp.anchor.set(0.5);
      const rad = range(rng, L.rMin, L.rMax) * S;
      const baseScale = (rad * 2) / 256;
      sp.tint = lerpHex(Math.pow(rng(), 3.5));
      layer.addChild(sp);
      items.push({
        sprite: sp,
        bx: rng() * domW,
        by: rng() * domH,
        layer: li,
        baseAlpha: range(rng, L.aMin, L.aMax),
        baseScale,
        tw: 1 + Math.floor(rng() * 2),
        ph: rng(),
        glint: 0,
        gc: 0,
        gph: 0,
        rot0: 0,
      });
    }
  });
  // Gold sparkles ride with the medium layer.
  const sparkLayer = new Container();
  scene.addChild(sparkLayer);
  for (let i = 0; i < 1800; i++) {
    const sp = new Sprite(glowTex);
    sp.anchor.set(0.5);
    sp.blendMode = "add" as BLEND_MODES;
    sp.tint = sparkleTint;
    const size = range(rng, 3.5, 9) * S;
    sparkLayer.addChild(sp);
    items.push({
      sprite: sp,
      bx: rng() * domW,
      by: rng() * domH,
      layer: 1 + (rng() < 0.5 ? 1 : 0),
      baseAlpha: range(rng, 0.25, 0.85),
      baseScale: size / 64,
      tw: 1 + Math.floor(rng() * 7),
      ph: rng(),
      glint: rng() < 0.12 ? 1 : 0,
      gc: 1 + Math.floor(rng() * 3),
      gph: rng(),
      rot0: 0,
    });
  }
  for (let i = 0; i < 60; i++) {
    const sp = new Sprite(starTex);
    sp.anchor.set(0.5);
    sp.blendMode = "add" as BLEND_MODES;
    sp.tint = sparkleTint;
    const size = range(rng, 16, 40) * S;
    sparkLayer.addChild(sp);
    items.push({
      sprite: sp,
      bx: rng() * domW,
      by: rng() * domH,
      layer: 1,
      baseAlpha: range(rng, 0.6, 1.0),
      baseScale: size / 256,
      tw: 1 + Math.floor(rng() * 4),
      ph: rng(),
      glint: 2,
      gc: 1 + Math.floor(rng() * 2),
      gph: rng(),
      rot0: range(rng, -0.3, 0.3),
    });
  }

  const wrap = (v: number, m: number) => ((v % m) + m) % m;
  const TAU = Math.PI * 2;

  return {
    scene,
    update(frame) {
      const f = ((frame % LOOP) + LOOP) % LOOP;
      const ph = f / LOOP;
      for (const it of items) {
        const L = LAYERS[it.layer];
        const x = wrap(it.bx + L.dx * ph * domW, domW) - margin;
        const y = wrap(it.by - L.dy * ph * domH, domH) - margin;
        const sp = it.sprite;
        sp.position.set(x, y);
        const s = Math.sin(TAU * (it.tw * ph + it.ph));
        if (it.glint === 0) {
          // Bokeh: gentle breathing.
          sp.alpha = it.baseAlpha * (0.82 + 0.18 * s);
          sp.scale.set(it.baseScale);
        } else if (it.glint === 2) {
          // 4-point star: twinkle and occasional flare-up.
          const tw = Math.pow(0.5 + 0.5 * s, 2);
          const gl = Math.pow(0.5 + 0.5 * Math.sin(TAU * (it.gc * ph + it.gph)), 12);
          sp.alpha = Math.min(1, it.baseAlpha * (0.25 + 0.75 * tw) + gl * 0.5);
          sp.scale.set(it.baseScale * (0.7 + 0.3 * tw + 0.45 * gl));
          sp.rotation = it.rot0 + 0.12 * Math.sin(TAU * (ph + it.ph));
        } else {
          // Tiny point: twinkle, some with brief glints.
          const tw = Math.pow(0.5 + 0.5 * s, 3);
          const gl = it.glint ? Math.pow(0.5 + 0.5 * Math.sin(TAU * (it.gc * ph + it.gph)), 24) : 0;
          sp.alpha = Math.min(1, it.baseAlpha * (0.2 + 0.8 * tw) + gl);
          sp.scale.set(it.baseScale * (1 + 1.2 * gl));
        }
      }
    },
  };
};
