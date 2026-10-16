import React, { useMemo } from "react";
import * as THREE from "three";
import { MONO, SANS } from "../../lib/fonts";
import { LOOP_FRAMES, FPS, hexToRgb, loopFrame } from "../../lib/loop";
import { PostChain } from "../../lib/post";
import { hash01, hexString, int, mulberry32 } from "../../lib/random";
import { StageCtx, StageFactory, ThreeStage } from "../../lib/ThreeStage";
import { RESP_RATE, SWEEP_S, ecg, pleth, pulseRate, resp, sinceBeat, spo2 } from "./physio";

export interface VitalMonitorProps {
  bgA: string; // screen gradient, top-left
  bgB: string; // screen gradient, bottom-right
  ecg: string;
  pleth: string;
  resp: string;
  text: string;
  grid: string;
  background: string;
}

// Screen design space (units). 1 world unit = 1000 screen units.
const SW = 2400;
const SH = 1350;
const WAVE_X0 = 90;
const WAVE_X1 = 1860;
const BANDS = {
  pleth: { y0: 95, y1: 335 },
  ecg: { y0: 395, y1: 905 },
  resp: { y0: 965, y1: 1185 },
};
const GAP_S = 0.22; // erase gap ahead of the write point
const MARGIN = [400, 1800, 500, 300]; // plane extends past the drawn screen (L, R, T, B)

// ---------------------------------------------------------------------------
// static layer: grid, labels, clutter (drawn once)
// ---------------------------------------------------------------------------
const clutterRng = mulberry32(0x7e1e7e);
const CLUTTER = Array.from({ length: 70 }, () => ({
  x: WAVE_X0 + clutterRng() * (WAVE_X1 - WAVE_X0 - 200),
  y: 90 + clutterRng() * 1150,
  w: 60 + clutterRng() * 180,
  rows: int(clutterRng, 1, 4),
  kind: int(clutterRng, 0, 3),
  s: hexString(clutterRng, 6),
}));

const drawStatic = (c: CanvasRenderingContext2D, p: VitalMonitorProps) => {
  c.lineCap = "round";
  c.strokeStyle = p.grid;
  c.fillStyle = p.grid;
  // band frames
  c.lineWidth = 2;
  for (const b of Object.values(BANDS)) {
    c.beginPath();
    c.moveTo(WAVE_X0 - 40, b.y1 + 22);
    c.lineTo(SW - 30, b.y1 + 22);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(WAVE_X0 - 40, 62);
  c.lineTo(SW - 30, 62);
  c.stroke();
  c.beginPath();
  c.moveTo(1890, 70);
  c.lineTo(1890, 1300);
  c.stroke();
  // vertical grid inside the wave area (dotted)
  c.lineWidth = 1.5;
  for (let x = WAVE_X0; x <= WAVE_X1; x += 100) {
    for (const b of Object.values(BANDS)) {
      for (let y = b.y0; y < b.y1; y += 12) c.fillRect(x - 1, y, 2, 4);
    }
  }
  // horizontal dotted grid in the ECG band
  for (let y = BANDS.ecg.y0; y <= BANDS.ecg.y1; y += 100) {
    for (let x = WAVE_X0; x < WAVE_X1; x += 12) c.fillRect(x, y - 1, 4, 2);
  }
  // clutter: faint bars and labels behind the traces
  c.globalAlpha = 0.5;
  for (const k of CLUTTER) {
    if (k.kind === 0) {
      for (let r = 0; r < k.rows; r++) c.fillRect(k.x, k.y + r * 16, k.w * (0.5 + 0.5 * hash01(r, k.x)), 7);
    } else if (k.kind === 1) {
      c.font = `500 22px "${SANS}"`;
      c.fillText(k.s, k.x, k.y);
    } else if (k.kind === 2) {
      c.strokeRect(k.x, k.y, k.w * 0.5, 34);
      c.fillRect(k.x + 6, k.y + 6, k.w * 0.3, 22);
    } else {
      for (let r = 0; r < 6; r++) c.fillRect(k.x + r * 14, k.y - r * 9, 8, r * 9 + 8);
    }
  }
  c.globalAlpha = 1;

  // labels
  c.fillStyle = p.text;
  c.globalAlpha = 0.7;
  c.font = `600 30px "${SANS}"`;
  c.fillText("PLETH", WAVE_X0, BANDS.pleth.y0 - 2);
  c.fillText("II", WAVE_X0, BANDS.ecg.y0 + 4);
  c.fillText("RESP", WAVE_X0, BANDS.resp.y0 + 2);
  c.font = `400 22px "${SANS}"`;
  c.fillText("x1.0   25 mm/s", WAVE_X0 + 50, BANDS.ecg.y0 + 2);
  c.fillText("1 mV", WAVE_X0 - 60, BANDS.ecg.y0 + 120);
  c.font = `500 24px "${MONO}"`;
  c.fillText("BED 07", 60, 40);
  c.fillText("ADULT", 240, 40);
  c.fillText("MONITORING", 400, 40);
  c.fillText("NODE 07   LINK OK", 1500, 40);
  // right column labels
  c.font = `600 40px "${SANS}"`;
  c.fillText("PLS", 1930, 300);
  c.fillText("SpO", 1930, 690);
  c.font = `600 26px "${SANS}"`;
  c.fillText("2", 2005, 700);
  c.font = `600 40px "${SANS}"`;
  c.fillText("RESP", 1930, 1060);
  c.font = `400 24px "${SANS}"`;
  c.fillText("bpm", 1930, 340);
  c.fillText("%", 1930, 730);
  c.fillText("rpm", 1930, 1100);
  c.fillText("120", 2310, 300);
  c.fillText("50", 2310, 340);
  c.fillText("100", 2310, 690);
  c.fillText("90", 2310, 730);
  c.fillText("30", 2310, 1060);
  c.fillText("8", 2310, 1100);
  c.font = `600 34px "${SANS}"`;
  c.save();
  c.translate(2370, 520);
  c.rotate(Math.PI / 2);
  c.fillText("ECG", 0, 0);
  c.restore();
  c.globalAlpha = 1;
};

// ---------------------------------------------------------------------------
// dynamic layer: traces, readouts, heart (redrawn every frame from time)
// ---------------------------------------------------------------------------
type Sig = (t: number) => number;

const drawTrace = (
  c: CanvasRenderingContext2D,
  t: number,
  sig: Sig,
  map: (v: number) => number,
  color: string,
  width: number,
) => {
  const span = WAVE_X1 - WAVE_X0;
  const pw = (t % SWEEP_S) / SWEEP_S; // write point, 0..1
  const gap = GAP_S / SWEEP_S;
  const step = 1.5; // screen units per sample
  const n = Math.ceil(span / step);
  const pts: [number, number][][] = [[]];
  const headA: [number, number][] = []; // just behind the write point
  const headB: [number, number][] = []; // the same, wrapped to the right edge
  for (let i = 0; i <= n; i++) {
    const px = i / n;
    let age = pw - px;
    if (age < 0) age += 1;
    if (age > 1 - gap) {
      if (pts[pts.length - 1].length) pts.push([]);
      continue;
    }
    const ts = t - age * SWEEP_S;
    const pt: [number, number] = [WAVE_X0 + px * span, map(sig(ts))];
    pts[pts.length - 1].push(pt);
    if (age < 0.05) (px <= pw ? headA : headB).push(pt);
  }
  c.strokeStyle = color;
  c.lineJoin = "round";
  c.lineCap = "round";
  // glow: blurred copy underneath
  c.save();
  c.globalAlpha = 0.45;
  c.lineWidth = width * 1.5;
  c.shadowColor = color;
  c.shadowBlur = width * 5;
  for (const seg of pts) strokePts(c, seg);
  c.restore();
  c.lineWidth = width;
  for (const seg of pts) strokePts(c, seg);
  // brighter at the write point
  for (const head of [headB, headA]) {
    if (head.length < 2) continue;
    c.save();
    c.strokeStyle = "#ffffff";
    c.globalAlpha = 0.5;
    c.lineWidth = width * 1.1;
    c.shadowColor = color;
    c.shadowBlur = width * 6;
    strokePts(c, head);
    c.restore();
  }
  if (headA.length) {
    const last = headA[headA.length - 1];
    c.save();
    c.fillStyle = "#ffffff";
    c.shadowColor = color;
    c.shadowBlur = width * 8;
    c.beginPath();
    c.arc(last[0], last[1], width * 1.1, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
};

const strokePts = (c: CanvasRenderingContext2D, seg: [number, number][]) => {
  if (seg.length < 2) return;
  c.beginPath();
  c.moveTo(seg[0][0], seg[0][1]);
  for (let i = 1; i < seg.length; i++) c.lineTo(seg[i][0], seg[i][1]);
  c.stroke();
};

const heart = (c: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  c.beginPath();
  c.moveTo(x, y + s * 0.35);
  c.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.35, y - s * 0.9, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.35, y - s * 0.9, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
  c.fill();
};

const drawDynamic = (c: CanvasRenderingContext2D, t: number, p: VitalMonitorProps) => {
  const W = 2.7; // trace width in screen units (~2.5 px at 720p mid-screen)
  const band = (b: { y0: number; y1: number }, lo: number, hi: number) => (v: number) =>
    b.y1 - ((v - lo) / (hi - lo)) * (b.y1 - b.y0);
  drawTrace(c, t, pleth, band(BANDS.pleth, -0.05, 1.08), p.pleth, W);
  drawTrace(c, t, ecg, band(BANDS.ecg, -0.42, 1.12), p.ecg, W);
  drawTrace(c, t, resp, band(BANDS.resp, -0.1, 1.1), p.resp, W);

  // readouts
  c.save();
  c.shadowBlur = 8;
  c.font = `400 120px "${SANS}"`;
  c.fillStyle = p.ecg;
  c.shadowColor = p.ecg;
  c.fillText(String(pulseRate(t)), 2060, 400);
  c.fillStyle = p.pleth;
  c.shadowColor = p.pleth;
  c.fillText(String(spo2(t)), 2060, 790);
  c.fillStyle = p.resp;
  c.shadowColor = p.resp;
  c.fillText(String(RESP_RATE), 2060, 1160);
  c.restore();

  // heart blinks for 0.16 s after each R peak
  const sb = sinceBeat(t);
  c.fillStyle = p.ecg;
  c.globalAlpha = sb < 0.16 ? 1 : 0.22;
  heart(c, 2110, 600, 52);
  c.globalAlpha = 1;

  // pleth amplitude bar indicator
  const lvl = Math.max(0, Math.min(1, pleth(t)));
  const segs = 10;
  for (let i = 0; i < segs; i++) {
    c.fillStyle = p.pleth;
    c.globalAlpha = i / segs < lvl ? 0.9 : 0.15;
    c.fillRect(2290, 960 - i * 22 - 120, 30, 16);
  }
  // faint indicator bars stepping with the beat
  for (let i = 0; i < 8; i++) {
    c.fillStyle = p.text;
    c.globalAlpha = 0.18 + 0.25 * hash01(i, Math.floor(t * 2));
    c.fillRect(1930 + i * 40, 1230, 26, 40);
  }
  c.globalAlpha = 1;
};

// ---------------------------------------------------------------------------
// three.js scene
// ---------------------------------------------------------------------------
const VS = /* glsl */ `
out vec2 vUv;
out float vViewZ;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FS = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vViewZ;
out vec4 outColor;
uniform sampler2D tStatic;
uniform sampler2D tDynamic;
uniform vec3 uBgA;
uniform vec3 uBgB;
uniform float uFocus;
uniform float uCocScale;
uniform vec4 uMargin; // left, right, top, bottom in screen units
uniform vec2 uScreen;
void main() {
  // the plane extends past the drawn screen so the frame is always filled
  vec2 design = vec2(-uMargin.x + vUv.x * (uScreen.x + uMargin.x + uMargin.y),
                     -uMargin.z + (1.0 - vUv.y) * (uScreen.y + uMargin.z + uMargin.w));
  vec2 tuv = vec2(design.x / uScreen.x, 1.0 - design.y / uScreen.y);
  float inside = step(0.0, tuv.x) * step(tuv.x, 1.0) * step(0.0, tuv.y) * step(tuv.y, 1.0);
  // smooth float gradient (dithered at the end of the post chain)
  float k = clamp(dot(vUv - vec2(0.0, 1.0), normalize(vec2(1.0, -0.6))) / 1.15, 0.0, 1.0);
  vec3 col = mix(uBgA, uBgB, k);
  // gentle vignette on the panel itself
  vec2 q = vUv - 0.5;
  col *= 1.0 - 0.35 * dot(q, q);
  vec4 s = texture(tStatic, tuv) * inside;   // premultiplied
  col = col * (1.0 - s.a) + s.rgb;
  vec4 d = texture(tDynamic, tuv) * inside;  // premultiplied
  col = col * (1.0 - d.a) + d.rgb;
  float coc = clamp(abs(1.0 - uFocus / vViewZ) * uCocScale, 0.0, 1.0);
  outColor = vec4(col, coc);
}`;

const createApp = (props: VitalMonitorProps) => (ctx: StageCtx) => {
  const { gl, width: W, height: H } = ctx;
  const post = new PostChain(gl, W, H, {
    msaa: 4,
    dof: { maxRadius720: 9 },
    dither: true,
    grain: 0.01,
  });

  const texScale = Math.min(2.6, (0.9 * W) / 1280);
  const tw = Math.round(SW * texScale);
  const th = Math.round(SH * texScale);
  const mk = () => {
    const cv = document.createElement("canvas");
    cv.width = tw;
    cv.height = th;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.NoColorSpace;
    tex.premultiplyAlpha = true;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return { cv, tex, c: cv.getContext("2d")! };
  };
  const stat = mk();
  const dyn = mk();
  stat.c.setTransform(texScale, 0, 0, texScale, 0, 0);
  drawStatic(stat.c, props);
  stat.tex.needsUpdate = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, W / H, 0.05, 50);
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VS,
    fragmentShader: FS,
    uniforms: {
      tStatic: { value: stat.tex },
      tDynamic: { value: dyn.tex },
      uBgA: { value: new THREE.Vector3(...hexToRgb(props.bgA)) },
      uBgB: { value: new THREE.Vector3(...hexToRgb(props.bgB)) },
      uFocus: { value: 1 },
      uCocScale: { value: 1.6 },
      uMargin: { value: new THREE.Vector4(MARGIN[0], MARGIN[1], MARGIN[2], MARGIN[3]) },
      uScreen: { value: new THREE.Vector2(SW, SH) },
    },
  });
  const planeGeo = new THREE.PlaneGeometry(
    (SW + MARGIN[0] + MARGIN[1]) / 1000,
    (SH + MARGIN[2] + MARGIN[3]) / 1000,
  );
  // keep the drawn screen centred on the mesh origin
  planeGeo.translate((MARGIN[1] - MARGIN[0]) / 2000, (MARGIN[2] - MARGIN[3]) / 2000, 0);
  const plane = new THREE.Mesh(planeGeo, mat);
  // turned ~30 degrees away (right side recedes) and tilted a little
  plane.rotation.order = "YXZ";
  plane.rotation.y = (40 * Math.PI) / 180;
  plane.rotation.x = (-4 * Math.PI) / 180;
  plane.rotation.z = (9 * Math.PI) / 180;
  scene.add(plane);
  // aim at a point on the screen between the ECG and the readouts
  const target = new THREE.Vector3(0.0, 0.17, 0).applyEuler(plane.rotation);
  const baseCam = target.clone().add(new THREE.Vector3(0, 0.03, 0.95));
  const fwd = target.clone().sub(baseCam);
  mat.uniforms.uFocus.value = fwd.length();

  return {
    render(frame: number) {
      const f = loopFrame(frame);
      const t = f / FPS;
      const ph = (2 * Math.PI * f) / LOOP_FRAMES;
      // slow cosine drift of a few cm, one whole cycle per loop
      camera.position.set(
        baseCam.x + 0.025 * Math.cos(ph),
        baseCam.y + 0.012 * Math.sin(ph),
        baseCam.z + 0.015 * Math.sin(ph),
      );
      camera.lookAt(target);
      const c = dyn.c;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, tw, th);
      c.setTransform(texScale, 0, 0, texScale, 0, 0);
      drawDynamic(c, t, props);
      dyn.tex.needsUpdate = true;
      post.render(scene, camera, f);
    },
    dispose() {
      post.dispose();
      stat.tex.dispose();
      dyn.tex.dispose();
      mat.dispose();
      plane.geometry.dispose();
    },
  };
};

export const VitalMonitor: React.FC<VitalMonitorProps> = (props) => {
  const factory: StageFactory = useMemo(
    () => createApp(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(props)],
  );
  return <ThreeStage factory={factory} background={props.background} />;
};
