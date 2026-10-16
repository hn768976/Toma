import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { MONO, SANS } from "../lib/assets";
import { canvasTexture, depthOnlyMaterial, glowMaterial, makeCanvas, maskedDepthMaterial } from "../lib/helpers";
import { clamp01, easeInOut, easeOutBack, hash1, lerp, mulberry32, smoothstep, TAU } from "../lib/random";
import { PosedCamera, Stage } from "../lib/stage";
import { hexToLinear, PhoneVersion } from "../versions";
import { ICON_ORDER, PICTOGRAMS } from "./icons";

const LEN = 300;
const PW = 3.4; // phone width (landscape)
const PH = 1.62;
const PD = 0.11;
const LW = 4.2; // hologram layer plane
const LH = 2.1;
const CW = 2048;
const CH = 1024;

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
// layer-plane coords (x right, y up, units) -> canvas px
const cx = (x: number) => (x / LW + 0.5) * CW;
const cy = (y: number) => (0.5 - y / LH) * CH;
const cs = (s: number) => (s / LW) * CW;

const roundedRect = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
};

// ---------------------------------------------------------------- icon layout
const ICON_POS: [number, number][] = [
  [-1.62, 0.66], [-0.55, 0.98], [0.5, 0.98], [1.62, 0.72],
  [1.92, -0.12], [0.85, -0.86], [-0.42, -0.9], [-1.95, -0.22],
];
const ICON_R = 0.25;
const CLOUD_C: [number, number] = [-0.05, 0.12];

// orthogonal / 45 degree circuit path from the central cloud to an icon
const circuitPath = (i: number): [number, number][] => {
  const [tx, ty] = ICON_POS[i];
  const sx = CLOUD_C[0] + Math.sign(tx - CLOUD_C[0]) * 0.32;
  const sy = CLOUD_C[1];
  const midX = lerp(sx, tx, 0.55);
  const dy = ty - sy;
  const ex = tx - Math.sign(tx - sx) * (ICON_R + 0.02) * (Math.abs(dy) < 0.3 ? 1 : 0);
  const ey = ty - Math.sign(dy) * (Math.abs(dy) >= 0.3 ? ICON_R + 0.02 : 0);
  const pts: [number, number][] = [[sx, sy], [midX, sy]];
  if (Math.abs(dy) >= 0.3) {
    const diag = Math.min(Math.abs(dy) * 0.5, Math.abs(ex - midX));
    pts.push([midX + Math.sign(ex - midX) * diag, sy + Math.sign(dy) * diag]);
    pts.push([ex, sy + Math.sign(dy) * diag + (Math.abs(ex - midX) - diag > 0 ? 0 : 0)]);
    pts.push([ex, ey]);
  } else {
    pts.push([ex, ty]);
  }
  return pts;
};

// thin ribbon along a polyline (in the layer plane), with arc-length attribute 0..1
const ribbon = (pts: [number, number][], width: number) => {
  const seg: number[] = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = seg[seg.length - 1] || 1;
  const pos: number[] = [];
  const s: number[] = [];
  const idx: number[] = [];
  let v = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = (-(y1 - y0) / len) * width * 0.5;
    const ny = ((x1 - x0) / len) * width * 0.5;
    // extend each segment by half a width so joints close
    const ex = ((x1 - x0) / len) * width * 0.5;
    const ey = ((y1 - y0) / len) * width * 0.5;
    pos.push(x0 - ex + nx, y0 - ey + ny, 0, x0 - ex - nx, y0 - ey - ny, 0, x1 + ex + nx, y1 + ey + ny, 0, x1 + ex - nx, y1 + ey - ny, 0);
    s.push(seg[i] / total, seg[i] / total, seg[i + 1] / total, seg[i + 1] / total);
    idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    v += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("s", new THREE.Float32BufferAttribute(s, 1));
  g.setIndex(idx);
  return g;
};

// ---------------------------------------------------------------- textures
const drawCloudBadge = (ctx: CanvasRenderingContext2D, v: PhoneVersion) => {
  ctx.save();
  ctx.translate(cx(CLOUD_C[0]), cy(CLOUD_C[1]));
  const r = cs(0.3);
  ctx.strokeStyle = rgba(v.holo, 0.9);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.18, -0.6, 1.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.18, 2.4, 4.0);
  ctx.stroke();
  ctx.scale(r * 1.25, r * 1.25);
  ctx.translate(0, -0.12);
  ctx.lineWidth = 0.06;
  ctx.strokeStyle = rgba(v.highlight, 1);
  PICTOGRAMS.cloud(ctx);
  // circuit tails under the cloud
  ctx.beginPath();
  for (const dx of [-0.16, 0, 0.16]) {
    ctx.moveTo(dx, 0.2);
    ctx.lineTo(dx, 0.42);
  }
  ctx.stroke();
  for (const dx of [-0.16, 0, 0.16]) {
    ctx.beginPath();
    ctx.arc(dx, 0.47, 0.05, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
};

const buildLayers = (v: PhoneVersion) => {
  const rng = mulberry32(v.seed * 97 + 3);

  // Layer 1: the frame — a chamfered circuit outline around the phone
  const f = makeCanvas(CW, CH);
  {
    const c = f.ctx;
    c.fillStyle = "black";
    c.fillRect(0, 0, CW, CH);
    c.strokeStyle = rgba(v.holo, 0.9);
    c.lineWidth = 3;
    c.lineJoin = "round";
    const w = PW * 0.5 + 0.12;
    const h = PH * 0.5 + 0.1;
    const k = 0.22;
    const poly: [number, number][] = [
      [-w + k, h], [w - 0.6, h], [w - 0.5, h - 0.08], [w - k, h - 0.08], [w, h - 0.08 - k],
      [w, -h + k], [w - k, -h], [-0.3, -h], [-0.4, -h - 0.1], [-w + 0.6, -h - 0.1], [-w + 0.45, -h + 0.05],
      [-w + k * 0.5, -h + 0.05], [-w - 0.12, -h + 0.05 + k], [-w - 0.12, h - k - 0.25], [-w, h - k], [-w + k, h],
    ];
    c.beginPath();
    poly.forEach(([x, y], i) => (i ? c.lineTo(cx(x), cy(y)) : c.moveTo(cx(x), cy(y))));
    c.stroke();
    c.fillStyle = rgba(v.highlight, 1);
    poly.forEach(([x, y], i) => {
      if (i % 3 === 0) {
        c.beginPath();
        c.arc(cx(x), cy(y), 7, 0, TAU);
        c.fill();
      }
    });
    // inner thin outline of the screen and corner brackets
    c.lineWidth = 2;
    c.strokeStyle = rgba(v.holo, 0.5);
    c.strokeRect(cx(-PW / 2 + 0.1), cy(PH / 2 - 0.08), cs(PW - 0.2), cs(PH - 0.16) * (CW / LW) / (CH / LH));
    // bright bars under the frame (as in the reference)
    c.fillStyle = rgba(v.highlight, 0.6);
    c.fillRect(cx(-1.3), cy(-h - 0.2), cs(1.1), 6);
    c.fillStyle = rgba(v.holo, 0.8);
    c.fillRect(cx(0.1), cy(-h - 0.24), cs(0.6), 6);
    c.font = `600 22px "${SANS}"`;
    c.fillStyle = rgba(v.holo, 0.8);
    c.fillText("ELEMENTS  DATA", cx(-0.9), cy(-h + 0.12));
  }

  // Layer 2: interface panels — small charts, rows, buttons, text, the cloud badge
  const p = makeCanvas(CW, CH);
  {
    const c = p.ctx;
    c.fillStyle = "black";
    c.fillRect(0, 0, CW, CH);
    const panel = (x: number, y: number, w: number, h: number) => {
      c.strokeStyle = rgba(v.holo, 0.55);
      c.lineWidth = 2;
      c.strokeRect(cx(x), cy(y), cs(w), cs(h) * 2 * (LW / LH) / 2);
    };
    // bar chart top right
    panel(0.75, 0.62, 0.6, 0.32);
    for (let i = 0; i < 12; i++) {
      const hh = 0.04 + rng() * 0.22;
      c.fillStyle = rgba(v.holo, 0.5 + rng() * 0.4);
      c.fillRect(cx(0.8 + i * 0.045), cy(0.32 + hh), cs(0.025), cs(hh) * (CH / LH) / (CW / LW));
    }
    // line chart left
    panel(-1.5, 0.55, 0.75, 0.35);
    c.strokeStyle = rgba(v.highlight, 0.9);
    c.lineWidth = 3;
    c.beginPath();
    for (let i = 0; i <= 20; i++) {
      const x = -1.47 + i * 0.035;
      const y = 0.32 + 0.08 * Math.sin(i * 0.7) + rng() * 0.06;
      if (i) c.lineTo(cx(x), cy(y));
      else c.moveTo(cx(x), cy(y));
    }
    c.stroke();
    // text rows
    c.font = `400 20px "${MONO}"`;
    for (let r = 0; r < 7; r++) {
      c.fillStyle = rgba(v.holo, 0.35 + rng() * 0.4);
      const s = Array.from({ length: 10 + Math.floor(rng() * 10) }, () => "0123456789ABCDEF"[Math.floor(rng() * 16)]).join("");
      c.fillText(s, cx(0.75), cy(0.15 - r * 0.07));
    }
    // progress bars + radio dots bottom
    for (let r = 0; r < 3; r++) {
      c.strokeStyle = rgba(v.holo, 0.6);
      c.lineWidth = 2;
      c.strokeRect(cx(-1.45), cy(-0.18 - r * 0.13), cs(0.7), 16);
      c.fillStyle = rgba(v.holo, 0.75);
      c.fillRect(cx(-1.45), cy(-0.18 - r * 0.13), cs(0.7) * (0.3 + rng() * 0.7), 16);
    }
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.strokeStyle = rgba(v.holo, 0.7);
      c.arc(cx(0.25 + i * 0.12), cy(-0.45), 11, 0, TAU);
      c.stroke();
      if (i % 2 === 0) {
        c.beginPath();
        c.fillStyle = rgba(v.highlight, 0.9);
        c.arc(cx(0.25 + i * 0.12), cy(-0.45), 5, 0, TAU);
        c.fill();
      }
    }
    // dotted grid of tiny squares
    for (let i = 0; i < 90; i++) {
      c.fillStyle = rgba(v.holo, 0.25 + rng() * 0.5);
      c.fillRect(cx(-0.6 + (i % 15) * 0.04), cy(-0.55 - Math.floor(i / 15) * 0.04), 7, 7);
    }
    // a pair of small framed tiles (phone + doc pictos) as in the ref
    c.lineWidth = 3;
    c.strokeStyle = rgba(v.holo, 0.85);
    c.strokeRect(cx(-0.75), cy(-0.05), cs(0.16), cs(0.24) * (CH / LH) / (CW / LW) * 1.0);
    c.strokeRect(cx(0.3), cy(-0.08), cs(0.3), cs(0.22) * (CH / LH) / (CW / LW));
    // dense circuit-board traces with node dots across the interface
    c.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      let x = (rng() - 0.5) * PW * 0.95;
      let y = (rng() - 0.5) * PH * 0.9;
      c.strokeStyle = rgba(v.holo, 0.25 + rng() * 0.45);
      c.beginPath();
      c.moveTo(cx(x), cy(y));
      for (let k = 0; k < 3; k++) {
        if (k % 2 === 0) x += (rng() - 0.5) * 0.9;
        else y += (rng() - 0.5) * 0.5;
        c.lineTo(cx(x), cy(y));
      }
      c.stroke();
      c.fillStyle = rgba(v.highlight, 0.8);
      c.beginPath();
      c.arc(cx(x), cy(y), 5, 0, TAU);
      c.fill();
    }
    drawCloudBadge(c, v);
  }

  // Phone screen (before and under the hologram): dark glass with a faint grid and dim UI
  const sc = makeCanvas(CW, CH);
  {
    const c = sc.ctx;
    const g = c.createLinearGradient(0, 0, CW, CH);
    g.addColorStop(0, "#06121e");
    g.addColorStop(1, "#0a1c2e");
    c.fillStyle = g;
    c.fillRect(0, 0, CW, CH);
    c.globalAlpha = 0.5;
    c.drawImage(p.c, 0, 0);
    c.globalAlpha = 1;
    c.strokeStyle = rgba(v.holo, 0.12);
    c.lineWidth = 1.5;
    for (let x = 0; x < CW; x += 48) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, CH);
      c.stroke();
    }
    for (let y = 0; y < CH; y += 48) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(CW, y);
      c.stroke();
    }
    // punch-hole camera (landscape: on the left short side)
    const hx = cx(-PW / 2 + 0.17);
    const hy = cy(0);
    c.fillStyle = "#010204";
    c.beginPath();
    c.arc(hx, hy, cs(0.045), 0, TAU);
    c.fill();
    c.strokeStyle = "rgba(90,110,140,0.6)";
    c.lineWidth = 3;
    c.stroke();
  }

  // icon badges
  const icons = ICON_ORDER.map((name) => {
    const ic = makeCanvas(256, 256);
    const c = ic.ctx;
    c.fillStyle = "black";
    c.fillRect(0, 0, 256, 256);
    c.translate(128, 128);
    c.strokeStyle = rgba(v.holo, 1);
    c.lineWidth = 6;
    c.beginPath();
    c.arc(0, 0, 112, 0, TAU);
    c.stroke();
    c.lineWidth = 5;
    c.strokeStyle = rgba(v.holo, 0.75);
    c.beginPath();
    c.arc(0, 0, 94, 0, TAU);
    c.stroke();
    c.fillStyle = rgba(v.holo, 0.03);
    c.fill();
    c.scale(150, 150);
    c.lineWidth = 0.055;
    c.lineJoin = "round";
    c.strokeStyle = rgba(v.highlight, 1);
    PICTOGRAMS[name](c);
    return canvasTexture(ic.c);
  });

  return { frame: canvasTexture(f.c), panels: canvasTexture(p.c), screen: canvasTexture(sc.c), icons };
};

const additiveTex = (tex: THREE.Texture) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { map: { value: tex }, uAmt: { value: 0 }, uGain: { value: 1.6 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float uAmt, uGain; varying vec2 vUv;
      void main(){ gl_FragColor = vec4(texture2D(map, vUv).rgb * uAmt * uGain, 1.0); }`,
  });

const lineMat = (col: [number, number, number]) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Vector3(...col) }, uProg: { value: 0 }, uPulse: { value: -1 } },
    vertexShader: /* glsl */ `attribute float s; varying float vS; void main(){ vS = s; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform float uProg, uPulse; varying float vS;
      void main(){
        if (vS > uProg) discard;
        float head = exp(-pow((vS - uProg) * 18.0, 2.0)) * step(uProg, 0.999);
        float d = vS - uPulse;
        float pulse = exp(-d * d * 300.0);
        gl_FragColor = vec4(uCol * (1.0 + 2.5 * head + 2.0 * pulse), 1.0);
      }`,
  });

// floor & background blocks: dark bodies, emissive per-instance colour on the top/front face
const blockMat = (bg: [number, number, number], emissiveFace: "top" | "front") =>
  new THREE.ShaderMaterial({
    uniforms: { uBg: { value: new THREE.Vector3(...bg) } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying vec3 vLocal;
      void main() {
        vN = normalize(mat3(instanceMatrix) * normal);
        vLocal = position;
        vCol = instanceColor;
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBg;
      varying vec3 vN; varying vec3 vW; varying vec3 vCol; varying vec3 vLocal;
      void main() {
        float face = ${emissiveFace === "top" ? "max(vN.y, 0.0)" : "max(vN.z, 0.0)"};
        vec3 c = vec3(0.002, 0.004, 0.007) + vec3(0.002, 0.005, 0.009) * max(vN.y, 0.0);
        // emissive face with a slightly brighter rim
        vec2 q = abs(${emissiveFace === "top" ? "vLocal.xz" : "vLocal.xy"}) * 2.0;
        float rim = smoothstep(0.82, 0.98, max(q.x, q.y));
        c += vCol * face * (0.6 + 0.8 * rim);
        float d = length(vW - cameraPosition);
        c = mix(uBg, c, exp(-max(d - 7.0, 0.0) * 0.06));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });

const phoneBodyMat = (hi: [number, number, number]) =>
  new THREE.ShaderMaterial({
    uniforms: { uHi: { value: new THREE.Vector3(...hi) } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vLN;
      void main() {
        vLN = normal;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHi;
      varying vec3 vN; varying vec3 vV; varying vec3 vLN;
      void main() {
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float fres = pow(1.0 - abs(dot(n, v)), 3.0);
        float side = 1.0 - abs(vLN.z);
        side = pow(side, 0.6);
        vec3 r = reflect(-v, n);
        float env = smoothstep(0.2, 0.9, r.y) * 0.5 + smoothstep(0.75, 1.0, abs(r.x)) * 0.3;
        vec3 c = vec3(0.008, 0.014, 0.024) + uHi * (fres * 0.45 + side * (0.18 + env * 0.7));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });

const screenMat = (tex: THREE.Texture) =>
  new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uOn: { value: 0 }, uDim: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float uOn, uDim; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(map, vUv).rgb;
        vec3 off = vec3(0.004, 0.006, 0.01);
        gl_FragColor = vec4(mix(off, c * 1.4 * uDim, uOn), 1.0);
      }`,
  });

// ---------------------------------------------------------------- story timing (frames)
const T = {
  screenOn: [8, 50],
  lift: [60, 150],
  iconStart: 120,
  iconStep: 10,
  iconDur: 18,
  hold: 210,
} as const;

const story = (f: number) => {
  const on = smoothstep(T.screenOn[0], T.screenOn[1], f);
  // a brief deterministic flicker as the screen wakes up
  const flick = f < 30 ? 0.65 + 0.35 * hash1(f, 7) : 1;
  const lift = easeInOut(clamp01((f - T.lift[0]) / (T.lift[1] - T.lift[0])));
  const hold = easeInOut(clamp01((f - T.hold + 10) / (LEN - T.hold + 10)));
  return { screen: on * flick, lift, hold };
};

const camera = (f: number) => {
  const app = easeInOut(clamp01(f / 200));
  const yaw = lerp(0.6, -0.3, app) - 0.05 * easeInOut(clamp01((f - 200) / 100));
  const dist = lerp(11.0, 9.1, easeInOut(clamp01(f / 230))) - 0.2 * clamp01((f - 230) / 70);
  const h = lerp(2.9, 2.1, app);
  const target = new THREE.Vector3(0, 0.55, 0);
  const pos = new THREE.Vector3(Math.sin(yaw) * dist, h, Math.cos(yaw) * dist);
  return { pos, target };
};

const PHONE_C = new THREE.Vector3(0, 0.95, 0);

const PhoneScene: React.FC<{ v: PhoneVersion; f: number }> = ({ v, f }) => {
  const holo = hexToLinear(v.holo);
  const hi = hexToLinear(v.highlight);
  const bg = hexToLinear(v.bg);
  const res = useMemo(() => {
    const L = buildLayers(v);
    const shape = roundedRect(PW, PH, 0.24);
    const body = new THREE.ExtrudeGeometry(shape, { depth: PD, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 4, curveSegments: 20 });
    body.translate(0, 0, -PD / 2);
    const scrShape = roundedRect(PW - 0.1, PH - 0.1, 0.2);
    const scr = new THREE.ShapeGeometry(scrShape, 20);
    const uv = scr.attributes.uv;
    const pa = scr.attributes.position;
    for (let i = 0; i < pa.count; i++) uv.setXY(i, pa.getX(i) / LW + 0.5, pa.getY(i) / LH + 0.5);
    const layerGeo = new THREE.PlaneGeometry(LW, LH);
    const frameMat = additiveTex(L.frame);
    const panelMat = additiveTex(L.panels);
    const iconMats = L.icons.map((t) => additiveTex(t));
    const iconGeo = new THREE.PlaneGeometry(ICON_R * 2, ICON_R * 2);
    const iconProxyGeo = new THREE.CircleGeometry(ICON_R * 0.95, 32);
    const lines = ICON_POS.map((_, i) => ({ geo: ribbon(circuitPath(i), 0.005), mat: lineMat(holo.map((x) => x * 1.1) as [number, number, number]) }));

    // floor blocks
    const rng = mulberry32(v.seed * 41 + 9);
    const NX = 64;
    const NZ = 46;
    const S = 0.44;
    const floor = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), blockMat(bg, "top"), NX * NZ);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    let k = 0;
    for (let ix = 0; ix < NX; ix++) {
      for (let iz = 0; iz < NZ; iz++) {
        const x = (ix - NX / 2) * S;
        const z = 6 - iz * S;
        const h = 0.02 + Math.pow(rng(), 4) * 0.12;
        m.makeScale(S * 0.92, h, S * 0.92);
        m.setPosition(x, h / 2 - 0.05, z);
        floor.setMatrixAt(k, m);
        const lit = rng();
        const a = lit < 0.015 ? 0.08 + rng() * 0.15 : lit < 0.25 ? 0.006 + rng() * 0.015 : 0.002;
        col.setRGB(holo[0] * a, holo[1] * a, holo[2] * a);
        floor.setColorAt(k, col);
        k++;
      }
    }
    floor.frustumCulled = false;
    // light strips (thin bright dashes lying on the floor)
    const NS = 900;
    const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), blockMat(bg, "top"), NS);
    for (let i = 0; i < NS; i++) {
      const len = 0.15 + Math.pow(rng(), 2) * 2.2;
      m.makeScale(len, 0.01, 0.018);
      m.setPosition((rng() - 0.5) * 22, 0.12, 5 - rng() * 18);
      strips.setMatrixAt(i, m);
      const a = rng() < 0.15 ? 0.6 + rng() * 0.9 : 0.05 + rng() * 0.15;
      col.setRGB(holo[0] * a, holo[1] * a, holo[2] * a);
      strips.setColorAt(i, col);
    }
    strips.frustumCulled = false;
    // distant background: a wall of blocks with lit faces (blurred by DoF)
    const NB = 700;
    const wall = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), blockMat(bg, "front"), NB);
    for (let i = 0; i < NB; i++) {
      const dash = i % 3 === 0;
      const w = dash ? 0.4 + rng() * 1.0 : 0.5 + rng() * 1.2;
      const h = dash ? 0.06 : 1.0 + rng() * 5;
      m.makeScale(w, h, 0.5);
      m.setPosition((rng() - 0.5) * 34, dash ? rng() * 7 : h / 2 + rng() * 2, -14 - rng() * 8 + (dash ? 0.4 : 0));
      wall.setMatrixAt(i, m);
      const r = rng();
      const a = dash ? (r < 0.85 ? 3.0 + rng() * 3.0 : 0) : r < 0.1 ? 0.12 + rng() * 0.2 : 0.02 + rng() * 0.05;
      col.setRGB(holo[0] * a, holo[1] * a, holo[2] * a);
      wall.setColorAt(i, col);
    }
    wall.frustumCulled = false;

    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMaterial({ core: 3, soft: 0.4, tint: holo.map((x) => x * 0.12) as [number, number, number] }));
    const bodyMat = phoneBodyMat(hi);
    return { L, panelDepth: maskedDepthMaterial(L.panels, 0.04), frameDepth: maskedDepthMaterial(L.frame, 0.03), iconProxyGeo, bodyMat, body, scr, layerGeo, frameMat, panelMat, iconMats, iconGeo, lines, floor, strips, wall, glow, depthMat: depthOnlyMaterial() };
  }, [v]);

  const s = story(f);
  const cam = camera(f);

  useLayoutEffect(() => {
    res.frameMat.uniforms.uAmt.value = smoothstep(T.lift[0], T.lift[0] + 30, f);
    res.panelMat.uniforms.uAmt.value = smoothstep(T.lift[0] + 10, T.lift[0] + 50, f) * (0.95 + 0.05 * Math.sin(TAU * f / 30));
    res.lines.forEach((l, i) => {
      const fi = T.iconStart + i * T.iconStep;
      l.mat.uniforms.uProg.value = smoothstep(fi + 4, fi + 34, f);
      // pulses run outwards along the lines during the hold
      l.mat.uniforms.uPulse.value = f > T.hold - 20 ? ((f - T.hold + 20 + i * 11) % 45) / 45 * 1.3 - 0.15 : -1;
    });
    res.iconMats.forEach((m, i) => {
      const fi = T.iconStart + i * T.iconStep;
      m.uniforms.uAmt.value = smoothstep(fi, fi + 6, f);
    });
  }, [f, res]);

  const scrMat = useMemo(() => screenMat(res.L.screen), [res]);
  scrMat.uniforms.uOn.value = s.screen;
  scrMat.uniforms.uDim.value = 1 - 0.55 * s.lift;

  const layerZ = [0.2, 0.42, 0.64].map((z) => PD / 2 + 0.03 + z * s.lift);
  const holoYaw = 0.12 * s.hold;
  const glowScale = 6.5;

  return (
    <>
      <PosedCamera position={[cam.pos.x, cam.pos.y, cam.pos.z]} target={[cam.target.x, cam.target.y, cam.target.z]} fov={30} near={0.1} far={60} />
      <primitive object={res.floor} />
      <primitive object={res.strips} />
      <primitive object={res.wall} />
      {/* soft light from underneath the phone */}
      <mesh geometry={res.glow.geometry} material={res.glow.material} position={[0, 0.34, 0.3]} rotation={[-Math.PI / 2, 0, 0]} scale={[glowScale, glowScale * 0.6, 1]} renderOrder={2} />
      <group position={PHONE_C} rotation={[-0.62, holoYaw * 0.4, -0.18]}>
        <mesh geometry={res.body} material={res.bodyMat} />
        <mesh geometry={res.scr} material={scrMat} position={[0, 0, PD / 2 + 0.027]} />
        <group rotation={[0, holoYaw, 0]}>
          <mesh geometry={res.layerGeo} material={res.frameMat} position={[0, 0, layerZ[0]]} scale={1 + 0.03 * s.lift} renderOrder={10} />
          <mesh geometry={res.layerGeo} material={res.panelMat} position={[0, 0.03 * s.lift, layerZ[1]]} renderOrder={11} />
          <mesh geometry={res.layerGeo} material={res.frameDepth} position={[0, 0, layerZ[0]]} scale={1 + 0.03 * s.lift} renderOrder={30} />
          <mesh geometry={res.layerGeo} material={res.panelDepth} position={[0, 0.03 * s.lift, layerZ[1]]} renderOrder={30} />
          <group position={[0, 0.05 * s.lift, layerZ[2]]}>
            {res.lines.map((l, i) => (
              <mesh key={i} geometry={l.geo} material={l.mat} renderOrder={12} />
            ))}
            {ICON_POS.map(([tx, ty], i) => {
              const fi = T.iconStart + i * T.iconStep;
              const p = clamp01((f - fi) / T.iconDur);
              const sc = easeOutBack(p);
              // orbit out: from near the centre, sweeping round to the target in polar coordinates
              const ta = Math.atan2(ty - CLOUD_C[1], tx - CLOUD_C[0]);
              const tr = Math.hypot(tx - CLOUD_C[0], ty - CLOUD_C[1]);
              const e = easeInOut(p);
              const a = ta - (1 - e) * 1.1;
              const r = lerp(0.25, tr, e);
              const bob = 0.03 * Math.sin(TAU * (f / 75 + i / 8)) * smoothstep(fi + T.iconDur, fi + T.iconDur + 20, f);
              const zpop = 0.1 * Math.sin(Math.PI * p);
              if (p <= 0) return null;
              return (
                <group key={i} position={[CLOUD_C[0] + Math.cos(a) * r, CLOUD_C[1] + Math.sin(a) * r + bob, 0.02 + zpop]} scale={Math.max(0.001, sc)}>
                  <mesh geometry={res.iconGeo} material={res.iconMats[i]} renderOrder={13} />
                  <mesh geometry={res.iconProxyGeo} material={res.depthMat} renderOrder={31} />
                </group>
              );
            })}
          </group>
        </group>
      </group>
    </>
  );
};

export const PhoneHologram: React.FC<{ v: PhoneVersion }> = ({ v }) => {
  const raw = useCurrentFrame();
  const f = Math.min(Math.max(raw, 0), LEN - 1);
  const cam = camera(f);
  const focus = cam.pos.distanceTo(PHONE_C);
  return (
    <Stage
      post={{
        frame: f,
        exposure: 1.2,
        bloomStrength: 0.45,
        bloomThreshold: 0.4,
        bloomRadius: 1.0,
        focusDistance: focus,
        focusBand: 0.6,
        focusRange: 5,
        maxBlur: 0.016,
        nearBlurScale: 2.6,
        saturation: 1.0,
        blackLift: [0.003, 0.006, 0.008],
        vignette: 0.5,
        clearColor: hexToLinear(v.bg),
      }}
    >
      <PhoneScene v={v} f={f} />
    </Stage>
  );
};
