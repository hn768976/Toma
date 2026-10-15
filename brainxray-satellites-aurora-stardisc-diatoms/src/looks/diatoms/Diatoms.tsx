import { Container } from "pixi.js";
import React, { useMemo } from "react";
import { canvasTexture, fullscreenMesh, GLSL_HEADER, ShaderMesh } from "../../lib/pixi/helpers";
import { makeInstanced } from "../../lib/pixi/instanced";
import { PixiCanvas, PixiLook } from "../../lib/pixi/PixiCanvas";
import { noiseTexture } from "../../lib/noisetex";
import { loopPhase, mulberry32, range, TAU } from "../../lib/rand";
import { AtlasEntry, bakeAtlas, Kind, T_SCALE } from "./sprites";

export type DiatomParams = {
  field: string; // background
  objects: number;
};

const hex = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const BG = /* glsl */ `${GLSL_HEADER}
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uNoise;
uniform vec3 uField;
uniform float uTheta;
void main() {
  vec2 s = vUV * vec2(1.7778, 1.0);
  // soft mottling (very slow, loops) and a brighter centre (Koehler illumination)
  vec2 o = vec2(cos(uTheta), sin(uTheta)) * 0.01;
  vec4 n = texture(uNoise, s * 0.35 + o);
  vec4 n2 = texture(uNoise, s * 0.9 - o);
  float mott = (n.x - 0.5) * 0.08 + (n2.z - 0.5) * 0.035;
  vec2 d = vUV - 0.5; d.x *= 1.6;
  float vig = 1.03 - 0.05 * dot(d, d) * 1.6;
  // slight warm lamp tint
  finalColor = vec4(uField * vec3(1.01, 1.0, 1.005) * (vig + mott), 1.0);
}`;

const VERT = /* glsl */ `${GLSL_HEADER}
in vec2 aPosition;
in vec4 aI0; // x, y, size (design px), angle
in vec4 aI1; // u0, v0, uw, vh (atlas rect)
in vec4 aI2; // strength, 0, 0, 0
out vec2 vUV;
out float vK;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  float c = cos(aI0.w), s = sin(aI0.w);
  vec2 q = aPosition * 0.5 * aI0.z;
  vec2 p = aI0.xy + vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(p, 1.0)).xy, 0.0, 1.0);
  vUV = aI1.xy + (aPosition * 0.5 + 0.5) * aI1.zw;
  vK = aI2.x;
}`;
const FRAG = /* glsl */ `${GLSL_HEADER}
in vec2 vUV;
in float vK;
out vec4 finalColor;
uniform sampler2D uAtlas;
void main() {
  vec3 t = texture(uAtlas, vUV).rgb * ${T_SCALE.toFixed(3)};
  // multiplicative transmission (bright-field absorption); vK fades contrast
  t = mix(vec3(1.0), t, vK);
  finalColor = vec4(t, 1.0);
}`;

// ---------------------------------------------------------------- layout
type Obj = {
  e: number; // atlas entry
  layer: 0 | 1 | 2; // 0 back (very soft), 1 middle (sharp), 2 front (soft)
  x: number;
  y: number;
  ax: number;
  ay: number;
  ph: number;
  ang: number;
  turn: number;
  turnPh: number;
  scale: number;
  k: number;
};

const KIND_MIX: [Kind, number][] = [
  ["speck", 0.4],
  ["diatom", 0.3],
  ["algae", 0.04],
  ["cluster", 0.05],
  ["bubble", 0.08],
  ["debris", 0.1],
  ["fibre", 0.03],
  ["needle", 0.01],
];

const layout = (entries: AtlasEntry[], count: number): Obj[] => {
  const r = mulberry32(424242);
  const byKind = (k: Kind) => entries.map((e, i) => (e.kind === k ? i : -1)).filter((i) => i >= 0);
  const objs: Obj[] = [];
  const pickKind = () => {
    let u = r();
    for (const [k, w] of KIND_MIX) {
      if ((u -= w) <= 0) return k;
    }
    return "speck" as Kind;
  };
  const caps: Partial<Record<Kind, number>> = { needle: 1, fibre: 6, debris: 28, bubble: 20 };
  const used: Partial<Record<Kind, number>> = {};
  for (let i = 0; i < count; i++) {
    let kind = pickKind();
    if (caps[kind] !== undefined && (used[kind] ?? 0) >= caps[kind]!) kind = "speck";
    used[kind] = (used[kind] ?? 0) + 1;
    const list = byKind(kind);
    const e = list[Math.floor(r() * list.length)];
    let x = range(r, -150, 3990);
    let y = range(r, -150, 2310);
    if (kind === "debris") {
      x = range(r, 3000, 4050);
      y = r() < 0.4 ? range(r, -150, 700) : range(r, 1300, 2300);
    }
    if (kind === "fibre") {
      x = range(r, 2750, 3150);
      y = range(r, 0, 300);
    }
    if (kind === "needle") {
      x = 920;
      y = 1000;
    }
    if (kind === "debris") {
      // khaki mass at the lower right, a smaller clump at the top right
      x = range(r, 3300, 4000);
      y = r() < 0.3 ? range(r, 0, 500) : range(r, 1400, 2250);
    }
    // focus varies by region: upper left sharpest, lower left most defocused
    const sharpness = 0.55 - 0.45 * (y / 2160) + 0.15 * (1 - x / 3840) * (1 - y / 2160);
    const lr = r();
    let layer = (lr < sharpness * 0.85 ? 1 : lr < 0.75 ? 0 : 2) as 0 | 1 | 2;
    if (kind === "debris") layer = r() < 0.6 ? 2 : 0;
    // diatoms gather in the lower-right clump too
    if (kind === "diatom" && r() < 0.18) {
      x = range(r, 3000, 3950);
      y = range(r, 1350, 2250);
    }
    if (kind === "needle" || kind === "fibre") layer = 1;
    if ((kind === "algae" || kind === "cluster") && layer !== 1) layer = r() < 0.7 ? 1 : 2;
    const sizeScale =
      kind === "diatom" ? range(r, 0.55, 0.95) : kind === "debris" ? range(r, 0.8, 1.5) : kind === "speck" ? range(r, 0.4, 1.0) : range(r, 0.75, 1.2);
    const diag = 0.65; // shared lean, upper left to lower right
    objs.push({
      e,
      layer,
      x,
      y,
      ax: range(r, 20, 90) * (r() < 0.5 ? -1 : 1),
      ay: range(r, 10, 50),
      ph: r() * TAU,
      ang: kind === "needle" ? 1.5 : kind === "diatom" ? diag + range(r, -0.6, 0.6) : r() * TAU,
      turn: kind === "algae" || kind === "speck" || kind === "bubble" ? 0 : range(r, 0.04, 0.25) * (r() < 0.5 ? -1 : 1),
      turnPh: r() * TAU,
      scale: sizeScale * (layer === 2 ? 1.3 : layer === 0 ? (kind === "diatom" ? 1.8 : 1.15) : 1),
      k: kind === "speck" ? (layer !== 1 ? 0.35 : 0.7) : 1,
    });
  }
  objs.sort((a, b) => a.layer - b.layer);
  return objs;
};

type Scene = { root: Container; bg: ShaderMesh; inst: ReturnType<typeof makeInstanced>; objs: Obj[]; entries: AtlasEntry[] };

const FPI = 12;
const makeLook = (params: DiatomParams): PixiLook<Scene> => ({
  post: { grain: 0.015, darkFade: false, blueNoise: 1.0 },
  build: ({ W, H, res }) => {
    const { canvas, entries } = bakeAtlas(res);
    const atlas = canvasTexture(canvas);
    const noise = noiseTexture(256, [[4, 4], [4, 4], [8, 4], [16, 3]], 2468);
    const bg = fullscreenMesh(
      W,
      H,
      BG,
      { uField: { value: hex(params.field), type: "vec3<f32>" }, uTheta: { value: 0, type: "f32" } },
      { uNoise: noise.source },
      "diatoms-bg",
    );
    const objs = layout(entries, params.objects);
    const inst = makeInstanced({
      count: objs.length,
      floatsPerInstance: FPI,
      vertex: VERT,
      fragment: FRAG,
      uniforms: {},
      textures: { uAtlas: atlas.source },
      name: "diatoms",
    });
    inst.mesh.blendMode = "multiply";
    const root = new Container();
    root.addChild(bg.mesh, inst.mesh);
    return { root, bg, inst, objs, entries };
  },
  update: (s, frame) => {
    const th = loopPhase(frame) * TAU;
    s.bg.u.uTheta = th;
    const d = s.inst.data;
    s.objs.forEach((o, i) => {
      const e = s.entries[o.e];
      // closed drift (one whole cycle per loop) + gentle turning
      const a = o.ang + o.turn * Math.sin(th + o.turnPh);
      // drift (closed loop) plus a glide back and forth along the long axis
      const glide = o.turn !== 0 ? 40 * Math.sin(th * 2 + o.ph) : 0;
      const x = o.x + o.ax * Math.cos(th + o.ph) + Math.cos(a) * glide;
      const y = o.y + o.ay * Math.sin(th + o.ph) + Math.sin(a) * glide;
      const uv = e.uv[o.layer === 1 ? 0 : o.layer === 2 ? 1 : 2];
      const k = i * FPI;
      d[k] = x;
      d[k + 1] = y;
      d[k + 2] = e.size * o.scale;
      d[k + 3] = a;
      d[k + 4] = uv[0];
      d[k + 5] = uv[1];
      d[k + 6] = uv[2];
      d[k + 7] = uv[3];
      d[k + 8] = o.k;
    });
    s.inst.upload();
  },
  root: (s) => s.root,
});

export const Diatoms: React.FC<{ params: DiatomParams }> = ({ params }) => {
  const look = useMemo(() => makeLook(params), [params]);
  return <PixiCanvas look={look} />;
};
