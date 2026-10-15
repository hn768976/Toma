import React, { useCallback } from 'react';
import { AbsoluteFill } from 'remotion';
import { Container, Mesh, RenderTexture, WebGLRenderer } from 'pixi.js';
import { BurstRow } from '../data';
import { PixiCanvas } from '../lib/PixiCanvas';
import { FULLSCREEN_VERT, fullscreenMesh, instancedQuadGeometry, makeShader } from '../lib/pixiUtil';
import { hexToRgb, mulberry32 } from '../lib/random';
import { FINISH_GLSL } from '../lib/finish';

// All lengths are in frame-height units (frame is 16/9 wide).
const ASPECT = 16 / 9;
export const BURST = {
  rays: 700,
  angleSpan: (80 * Math.PI) / 180, // -80 .. +80 deg
  origin: [0.0, 0.5] as [number, number], // on the left edge (the core is half visible)
  lenMin: 0.35 * ASPECT, // shortest rays: 35 % of frame width
  lenHero: 0.42 * ASPECT, // hero spokes end on an arc at ~42 % (max ~43 %; breathing +-6 %)
  r0: 0.24, // rays start at the rim of the hollow core
  shell: 0.23, // dotted globe around the core
  lineSegs: 10,
  spacing: 0.004 * ASPECT, // dot spacing: 0.4 % of the width
  specks: 300,
};

const LOOP = 600;

// per-dot attributes:
// aA: angle, u0, flow cycles (int), ray length
// aB: start radius, size, brightness, type (0 ray dot, 1 tip ring, 2 tip dot, 3 speck)
// aC: rgb, breathe phase
// aD: breathe cycles (int), twinkle phase, twinkle cycles (int), speck x
type Dots = { aA: Float32Array; aB: Float32Array; aC: Float32Array; aD: Float32Array; count: number };
type Lines = { aA: Float32Array; aC: Float32Array; aE: Float32Array; count: number };

const buildBurst = (row: BurstRow): { dots: Dots; lines: Lines } => {
  // geometry depends only on the seed (same rays for every colourway)
  const rand = mulberry32(0xb0457);
  const A: number[] = [], B: number[] = [], C: number[] = [], D: number[] = [];
  const LA: number[] = [], LC: number[] = [], LE: number[] = [];
  const tips = row.tips.map(hexToRgb);
  const dotsCol = row.dots.map(hexToRgb);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  for (let k = 0; k < BURST.rays; k++) {
    const ang = -BURST.angleSpan + (2 * BURST.angleSpan * (k + 0.5 + (rand() - 0.5) * 0.8)) / BURST.rays;
    // about one ray in nine is a "hero" spoke: bright line, ring bead on a
    // tidy outer arc. The rest are shorter and end in a small coloured dot.
    const hero = rand() < 0.11;
    const len = hero
      ? BURST.lenHero * (1 + (rand() - 0.5) * 0.09)
      : BURST.lenMin + (BURST.lenHero * 0.97 - BURST.lenMin) * Math.pow(rand(), 0.8);
    const bPhase = rand();
    const bCycles = 1 + Math.floor(rand() * 2);
    const flow = 1 + Math.floor(rand() * 2);
    const r0 = BURST.r0 * (0.95 + rand() * 0.15);
    const n = Math.max(4, Math.floor((len - r0) / BURST.spacing));
    const rayCol = pick(dotsCol);
    for (let j = 0; j < n; j++) {
      const u0 = (j + 0.3 * rand()) / n;
      const c = rand() < 0.55 ? rayCol : pick(dotsCol);
      A.push(ang, u0, flow, len);
      const bright = rand() < 0.16;
      // per-dot blur multiplier: some bright dots become big soft bokeh
      const bokeh = bright && rand() < 0.08;
      B.push(r0, bright ? 0.0016 + rand() * 0.0014 : 0.0009 + rand() * 0.0007, bokeh ? 1.4 + rand() * 1.0 : bright ? 0.8 + rand() * 0.6 : 0.04 + rand() * 0.07, 0);
      C.push(c[0], c[1], c[2], bPhase);
      D.push(bCycles, rand(), 1 + Math.floor(rand() * 3), bokeh ? 1.0 + rand() * 0.6 : 0.4);
    }
    const tc = hero ? pick(tips) : pick(dotsCol);
    A.push(ang, 1, 0, len);
    if (hero) B.push(r0, 0.0074 + rand() * 0.001, 5.5, 1);
    else B.push(r0, 0.0018 + rand() * 0.0012, 0.55 + rand() * 0.4, 2);
    C.push(tc[0], tc[1], tc[2], bPhase);
    D.push(bCycles, rand(), 1, 0);
    // the ray's thin line; some of the non-hero lines wave
    const wavy = !hero && rand() < 0.15;
    for (let sgm = 0; sgm < BURST.lineSegs; sgm++) {
      LA.push(ang, len, r0, bPhase);
      LC.push(rayCol[0], rayCol[1], rayCol[2], bCycles);
      LE.push(sgm, wavy ? 0.012 + rand() * 0.01 : 0, hero ? 1.0 : wavy ? 1.0 : 0.07, 2 + Math.floor(rand() * 3));
    }
  }
  // the dotted globe shell around the hollow core (points on a sphere, seen face on)
  for (let k = 0; k < 9000; k++) {
    // mostly near the silhouette, so the core reads as a hollow ring
    const z = (rand() * 2 - 1) * (rand() < 0.85 ? 0.55 : 1);
    const t = rand() * Math.PI * 2;
    const q = Math.sqrt(1 - z * z);
    const rr = BURST.shell * (0.97 + rand() * 0.06);
    const c = pick(dotsCol);
    A.push(0, BURST.origin[1] + rr * q * Math.sin(t), 0, 0);
    // brighter toward the rim, so it reads as a hollow globe
    B.push(rand() < 0.15 ? 0.004 + rand() * 0.006 : 0, 0.0014 + rand() * 0.0012, (0.3 + 0.8 * Math.pow(q, 8)) * (0.5 + rand() * 0.8), 3);
    C.push(c[0], c[1], c[2], 0);
    D.push(0, rand(), 1 + Math.floor(rand() * 2), BURST.origin[0] + rr * q * Math.cos(t));
  }
  // soft bokeh filling the fan near the edge (also covers the corners)
  for (let k = 0; k < 250; k++) {
    const a = ((rand() * 2 - 1) * 80 * Math.PI) / 180;
    const rr = BURST.r0 + rand() * 0.4;
    const c = pick(dotsCol);
    A.push(0, BURST.origin[1] + rr * Math.sin(a), 0, 0);
    B.push(0.008 + rand() * 0.012, 0.002, 0.3 + rand() * 0.4, 3);
    C.push(c[0], c[1], c[2], 0);
    D.push(0, rand(), 1 + Math.floor(rand() * 2), BURST.origin[0] + rr * Math.cos(a));
  }
  // faint specks across the copy space
  for (let k = 0; k < BURST.specks; k++) {
    const x = 0.25 + rand() * (ASPECT - 0.2);
    const y = rand();
    const c = rand() < 0.35 ? [0.8, 0.85, 1.0] : pick(dotsCol);
    const soft = rand() < 0.7;
    A.push(0, y, 0, 0);
    B.push(soft ? 0.004 + rand() * 0.007 : 0, 0.0012 + rand() * 0.0014, soft ? 1.1 : 0.9 + rand() * 0.9, 3);
    C.push(c[0], c[1], c[2], 0);
    D.push(0, rand(), 1 + Math.floor(rand() * 2), x);
  }
  return {
    dots: {
      aA: new Float32Array(A), aB: new Float32Array(B), aC: new Float32Array(C), aD: new Float32Array(D),
      count: A.length / 4,
    },
    lines: { aA: new Float32Array(LA), aC: new Float32Array(LC), aE: new Float32Array(LE), count: LA.length / 4 },
  };
};

const COMMON = /* glsl */ `
uniform float uLoopT;
uniform float uRot;
uniform vec2 uOrigin;
uniform float uMirror;
uniform float uAspect;
uniform float uPx;
const float TAU = 6.28318530718;
vec2 toNdc(vec2 p) {
  // p in frame-height units, origin top-left, y down
  float x = mix(p.x, uAspect - p.x, uMirror);
  return vec2(x / uAspect * 2.0 - 1.0, 1.0 - p.y * 2.0);
}
float rayLen(float len, float phase, float cycles) {
  return len * (1.0 + 0.06 * sin(TAU * (cycles * uLoopT + phase)));
}
`;

const DOT_VERT = /* glsl */ `
in vec2 aPosition;
in vec4 aA;
in vec4 aB;
in vec4 aC;
in vec4 aD;
${COMMON}
uniform float uBlur;
uniform float uGain;
out vec2 vCorner;
out vec3 vColor;
out float vEdge;
out float vType;
out float vRing;
void main() {
  float type = aB.w;
  vec2 p;
  float r = aB.y;
  float bright = aB.z;
  float rCoc = 0.0;
  float tw = 0.75 + 0.25 * cos(TAU * (aD.z * uLoopT + aD.y));
  if (type < 2.5) {
    float L = rayLen(aA.w, aC.w, aD.x);
    float r0 = aB.x;
    float u = type < 0.5 ? fract(aA.y + aA.z * uLoopT) : 1.0;
    float rad = r0 + u * (L - r0);
    float ang = aA.x + uRot;
    p = uOrigin + rad * vec2(cos(ang), sin(ang));
    if (type < 0.5) {
      // fade in from the core and out just before the tip so the flow never pops
      bright *= smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.86, 0.98, u));
      // dense, blurred inner and middle part of the fan; crisp toward the tips
      float k = smoothstep(0.0, 0.25, u) * (1.0 - smoothstep(0.3, 0.75, u));
      rCoc = uBlur * k * aD.w;
      // bokeh discs keep more of their brightness than a pure energy-conserving blur
      if (aD.w > 0.9) bright *= 1.0 + 1.5 * k * k;
      // rays converge toward the core: thin them out so it stays dark and hollow
      bright *= 0.12 + 0.88 * smoothstep(0.0, 0.55, u);
    }
  } else {
    p = vec2(aD.w, aA.y) + 0.01 * vec2(sin(TAU * (uLoopT + aD.y)), cos(TAU * (uLoopT + aD.y * 1.3)));
    rCoc = aB.x;
  }
  float rMin = 0.8 * uPx;
  float rr = sqrt(r * r + rCoc * rCoc + rMin * rMin);
  float energy = type > 0.5 && type < 1.5 ? 1.0 : r * r / (rr * rr);
  float aa = clamp(1.2 * uPx / rr, 0.04, 1.0);
  vEdge = aa;
  vType = type;
  vRing = clamp(2.6 * uPx / rr, 0.45, 0.65); // ring line width relative to radius
  vColor = aC.rgb * bright * tw * energy * uGain;
  vCorner = aPosition;
  vec2 ndc = toNdc(p);
  gl_Position = vec4(ndc + aPosition * rr * 2.0 * vec2(1.0 / uAspect, 1.0), 0.0, 1.0);
}
`;

const DOT_FRAG = /* glsl */ `
in vec2 vCorner;
in vec3 vColor;
in float vEdge;
in float vType;
in float vRing;
out vec4 finalColor;
void main() {
  float rho = length(vCorner);
  float m = clamp((1.0 - rho) / vEdge, 0.0, 1.0);
  if (vType > 0.5 && vType < 1.5) {
    // ring: line of width vRing at the rim
    float inner = clamp((rho - (1.0 - vRing)) / vEdge, 0.0, 1.0);
    m *= inner;
  }
  if (m <= 0.0) discard;
  finalColor = vec4(vColor * m, 0.0);
}
`;

const LINE_VERT = /* glsl */ `
in vec2 aPosition;
in vec4 aA; // angle, len, r0, breathe phase
in vec4 aC; // rgb, breathe cycles
in vec4 aE; // segment index, wave amplitude, brightness, wave count
${COMMON}
uniform float uLineAlpha;
uniform float uSegs;
out vec3 vColor;
out float vSide;
vec2 linePoint(float t, float L, float ang) {
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 nrm = vec2(-dir.y, dir.x);
  float rad = mix(aA.z * 0.95, L, t);
  float wave = aE.y * sin(3.14159265 * t) * sin(TAU * (aE.w * t + uLoopT) + aA.w * TAU);
  return uOrigin + dir * rad + nrm * wave;
}
void main() {
  float L = rayLen(aA.y, aA.w, aC.w);
  float ang = aA.x + uRot;
  float t0 = aE.x / uSegs;
  float t1 = (aE.x + 1.0) / uSegs;
  float t = mix(t0, t1, aPosition.x * 0.5 + 0.5);
  vec2 a = linePoint(t0, L, ang);
  vec2 b = linePoint(t1, L, ang);
  vec2 d = normalize(b - a);
  vec2 nrm = vec2(-d.y, d.x);
  float w = 0.9 * uPx; // half width ~ 0.9 output pixel
  vec2 p = linePoint(t, L, ang) + nrm * aPosition.y * w;
  vColor = mix(aC.rgb, vec3(0.75, 0.82, 1.0), 0.3) * uLineAlpha * aE.z * (0.3 + 0.7 * t) * (1.0 - smoothstep(0.96, 1.0, t));
  vSide = aPosition.y;
  gl_Position = vec4(toNdc(p), 0.0, 1.0);
}
`;

const LINE_FRAG = /* glsl */ `
in vec3 vColor;
in float vSide;
out vec4 finalColor;
void main() {
  float m = 1.0 - abs(vSide);
  finalColor = vec4(vColor * m, 0.0);
}
`;

const FINAL_FRAG = /* glsl */ `
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec3 uBg;
uniform vec2 uRes;
uniform float uFrameMod;
uniform float uMirror;
uniform vec3 uHaze;
${FINISH_GLSL}
void main() {
  vec2 uv = vUV;
  float aspect = uRes.x / uRes.y;
  float sx = mix(uv.x, 1.0 - uv.x, uMirror);
  vec3 bg = uBg * (1.0 + 0.25 * exp(-pow(length((vec2(sx, uv.y) - vec2(0.1, 0.5)) * vec2(aspect, 1.0)), 2.0) * 1.5));
  bg *= 1.0 - 0.15 * smoothstep(0.4, 1.3, length((uv - 0.5) * vec2(aspect, 1.0)));
  // soft coloured haze through the middle radii of the fan
  float r = length(vec2(sx * aspect, uv.y - 0.5));
  bg += uHaze * exp(-pow((r - 0.42) / 0.22, 2.0)) * smoothstep(0.14, 0.24, r);
  vec3 acc = texture(uTexture, uv).rgb;
  // hue-preserving soft clip so overlapping red and blue don't turn pastel
  float m = max(acc.r, max(acc.g, acc.b));
  acc *= (1.0 - exp(-m)) / max(m, 1e-4);
  vec3 c = bg + (1.0 - bg) * acc;
  c = finishColor(c, gl_FragCoord.xy, uFrameMod, 0.015);
  finalColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

const createScene = (row: BurstRow) => async (renderer: WebGLRenderer, pw: number, ph: number) => {
  const { dots, lines } = buildBurst(row);
  const mirror = row.side === 'right' ? 1 : 0;
  const common = {
    uLoopT: { value: 0, type: 'f32' },
    uRot: { value: 0, type: 'f32' },
    uOrigin: { value: new Float32Array(BURST.origin), type: 'vec2<f32>' },
    uMirror: { value: mirror, type: 'f32' },
    uAspect: { value: pw / ph, type: 'f32' },
    uPx: { value: 1 / ph, type: 'f32' },
  };
  const dotSh = makeShader('burst-dots', DOT_VERT, DOT_FRAG, {
    ...common,
    uBlur: { value: 0.012, type: 'f32' },
    uGain: { value: 1.2, type: 'f32' },
  });
  const lineSh = makeShader('burst-lines', LINE_VERT, LINE_FRAG, {
    ...common,
    uLineAlpha: { value: 0.9, type: 'f32' },
    uSegs: { value: BURST.lineSegs, type: 'f32' },
  });
  const dotMesh = new Mesh({
    geometry: instancedQuadGeometry(
      { aA: { data: dots.aA, size: 4 }, aB: { data: dots.aB, size: 4 }, aC: { data: dots.aC, size: 4 }, aD: { data: dots.aD, size: 4 } },
      dots.count,
    ),
    shader: dotSh.shader,
  });
  dotMesh.blendMode = 'add';
  const lineMesh = new Mesh({
    geometry: instancedQuadGeometry({ aA: { data: lines.aA, size: 4 }, aC: { data: lines.aC, size: 4 }, aE: { data: lines.aE, size: 4 } }, lines.count),
    shader: lineSh.shader,
  });
  lineMesh.blendMode = 'add';
  const stage = new Container();
  stage.addChild(lineMesh);
  stage.addChild(dotMesh);
  const rt = RenderTexture.create({ width: pw, height: ph, format: 'rgba16float', resolution: 1, antialias: false });
  const fin = makeShader('burst-final', FULLSCREEN_VERT, FINAL_FRAG, {
    uBg: { value: new Float32Array(hexToRgb(row.background)), type: 'vec3<f32>' },
    uRes: { value: new Float32Array([pw, ph]), type: 'vec2<f32>' },
    uFrameMod: { value: 0, type: 'f32' },
    uMirror: { value: mirror, type: 'f32' },
    uHaze: { value: new Float32Array(hexToRgb(row.haze)), type: 'vec3<f32>' },
  }, { uTexture: rt.source });
  const { container: finalStage } = fullscreenMesh(fin.shader);

  const render = (frame: number) => {
    const loopT = (frame % LOOP) / LOOP;
    const rot = ((3 * Math.PI) / 180) * Math.cos(Math.PI * 2 * loopT);
    for (const g of [dotSh.group, lineSh.group]) {
      const u = g.uniforms as Record<string, unknown>;
      u.uLoopT = loopT;
      u.uRot = rot;
      g.update();
    }
    (fin.group.uniforms as Record<string, unknown>).uFrameMod = frame % row.durationInFrames;
    fin.group.update();
    renderer.render({ container: stage, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
    renderer.render({ container: finalStage });
  };
  return {
    render,
    destroy: () => {
      rt.destroy(true);
      stage.destroy({ children: true });
      finalStage.destroy({ children: true });
    },
  };
};

export const RadialBurst: React.FC<{ row: BurstRow }> = ({ row }) => {
  const create = useCallback(createScene(row), [row]);
  return (
    <AbsoluteFill style={{ backgroundColor: row.background }}>
      <PixiCanvas create={create} />
    </AbsoluteFill>
  );
};
