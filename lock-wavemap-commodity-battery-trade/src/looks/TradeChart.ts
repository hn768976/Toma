import * as THREE from "three";
import type { LookFactory } from "../core/Stage";
import { canvasTexture, font, landPath, makeCanvas, rgba, type Ctx } from "../core/canvas";
import { getLand } from "../core/assets";
import { layerMaterial } from "../core/layers";
import { clamp, easeInOutCubic, easeOutCubic, smoothstep, TAU } from "../core/random";

// Look 5 — Trade Chart. A two-line chart on a tilted plane over a dark world
// map. 15 s story: map fades in, chrome appears, lines draw on, hold.

export type Series = { label: string; color: string; values: number[] };
export type TradeChartProps = {
  title: string;
  subtitle: string;
  years: number[];
  yMax: number;
  yStep: number;
  series: Series[];
  note: string;
};

// Chart canvas design size (units); the texture is this × texScale.
const CW = 4000;
const CH = 2250;
const PLOT = { x0: 420, x1: 3760, y0: 520, y1: 1880 };
const PLANE_W = 16;
const PLANE_H = (PLANE_W * CH) / CW;

const sec = (s: number) => s * 30;

const drawMap = (ctx: Ctx) => {
  // deep blue chart field with a lighter centre, like a lit screen
  const g = ctx.createRadialGradient(CW * 0.52, CH * 0.48, 50, CW * 0.52, CH * 0.5, CW * 0.62);
  g.addColorStop(0, "rgba(16,50,140,1)");
  g.addColorStop(0.55, "rgba(6,22,80,0.85)");
  g.addColorStop(1, "rgba(2,10,42,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CW, CH);
  landPath(ctx, getLand(), { x: 260, y: 170, w: 3620, h: 2000, latTop: 80, latBottom: -58 });
  const lg = ctx.createRadialGradient(CW * 0.5, CH * 0.45, 100, CW * 0.5, CH * 0.5, CW * 0.6);
  lg.addColorStop(0, "rgba(36,76,176,0.68)");
  lg.addColorStop(0.6, "rgba(28,60,144,0.5)");
  lg.addColorStop(1, "rgba(26,58,138,0.2)");
  ctx.fillStyle = lg;
  ctx.fill();
  // fine grid over the plot
  ctx.strokeStyle = "rgba(170,205,255,0.42)";
  ctx.lineWidth = 4;
  for (let x = PLOT.x0; x <= CW - 60; x += 334) {
    ctx.beginPath();
    ctx.moveTo(x, 260);
    ctx.lineTo(x, PLOT.y1);
    ctx.stroke();
  }
  for (let y = PLOT.y1; y >= 260; y -= 170) {
    ctx.beginPath();
    ctx.moveTo(PLOT.x0, y);
    ctx.lineTo(CW - 60, y);
    ctx.stroke();
  }
};

const drawChrome = (ctx: Ctx, p: TradeChartProps) => {
  ctx.textBaseline = "alphabetic";
  // title + subtitle
  ctx.shadowColor = "rgba(160,200,255,0.55)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#F2F6FF";
  ctx.font = font(800, 190, "Inter", true);
  ctx.fillText(p.title, 300, 190);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(225,235,255,0.88)";
  ctx.font = font(600, 74, "Inter", true);
  ctx.fillText(p.subtitle, 430, 290);
  // legend
  let lx = 900;
  ctx.font = font(800, 84, "Inter", true);
  p.series.forEach((s) => {
    ctx.fillStyle = "#F2F6FF";
    ctx.fillText(s.label, lx, 420);
    const tw = ctx.measureText(s.label).width;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 22;
    ctx.lineCap = "round";
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(lx + tw + 40, 392);
    ctx.lineTo(lx + tw + 220, 386);
    ctx.stroke();
    ctx.shadowBlur = 0;
    lx += tw + 440;
  });
  // axes
  ctx.strokeStyle = "rgba(235,242,255,1)";
  ctx.lineWidth = 11;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(PLOT.x0, 300);
  ctx.lineTo(PLOT.x0, PLOT.y1);
  ctx.lineTo(CW - 40, PLOT.y1);
  ctx.stroke();
  // y labels
  ctx.font = font(600, 64, "Inter", true);
  ctx.fillStyle = "rgba(200,215,245,0.8)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let v = 0; v <= p.yMax + 1e-6; v += p.yStep) {
    const y = PLOT.y1 - (v / p.yMax) * (PLOT.y1 - PLOT.y0);
    ctx.fillText(`${v}%`, PLOT.x0 - 34, y);
  }
  // x labels
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = font(600, 66, "Inter", true);
  p.years.forEach((yr, i) => {
    const x = PLOT.x0 + (i / (p.years.length - 1)) * (PLOT.x1 - PLOT.x0);
    ctx.fillStyle = "rgba(225,235,255,0.9)";
    ctx.fillText(String(yr), x, PLOT.y1 + 50);
    ctx.fillStyle = "rgba(205,222,255,0.85)";
    ctx.fillRect(x - 2, PLOT.y1, 4, 22);
  });
  // illustrative-data note, bottom right of the chart
  // sits in the year row, between the last two year labels
  const xNote = PLOT.x1 - (PLOT.x1 - PLOT.x0) / (p.years.length - 1) / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = font(500, 42, "Inter", true);
  ctx.fillStyle = "rgba(190,205,240,0.8)";
  ctx.fillText(p.note, xNote, PLOT.y1 + 62);
  ctx.textAlign = "left";
};

const seriesPoint = (s: Series, u: number) => {
  // u in [0, n-1]
  const n = s.values.length;
  const i = Math.min(n - 2, Math.floor(u));
  const f = u - i;
  return s.values[i] * (1 - f) + s.values[i + 1] * f;
};

export const tradeChartLook: LookFactory<TradeChartProps> = (env, p) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, env.aspect, 0.5, 200);
  const ts = env.texScale;

  // Background: dark navy with a lit centre and heavy vignette.
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthWrite: false,
      depthTest: false,
      uniforms: { fade: { value: 0 } },
      vertexShader: `out vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.0);} `,
      fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform float fade;
        void main(){ vec2 q=vUv-vec2(0.5,0.55); q.x*=1.78; float r=length(q);
          vec3 c=mix(vec3(0.06,0.18,0.5), vec3(0.004,0.012,0.045), smoothstep(0.0,0.8,r));
          o=vec4(c*fade,1.0);} `,
    }),
  );
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  const group = new THREE.Group();
  scene.add(group);
  group.rotation.set(-0.4, -0.3, -0.03, "YXZ");

  const mk = (draw: (ctx: Ctx) => void) => {
    const c = makeCanvas(CW * ts, CH * ts);
    c.ctx.scale(c.canvas.width / CW, c.canvas.height / CH);
    draw(c.ctx);
    return c;
  };
  const mapC = mk(drawMap);
  const chromeC = mk((ctx) => drawChrome(ctx, p));
  const lineC = makeCanvas(CW * ts, CH * ts);

  const mapMat = layerMaterial(canvasTexture(mapC.canvas, env.gl), { depthWrite: true });
  const chromeMat = layerMaterial(canvasTexture(chromeC.canvas, env.gl));
  const lineTex = canvasTexture(lineC.canvas, env.gl);
  const lineMat = layerMaterial(lineTex);
  const geo = new THREE.PlaneGeometry(PLANE_W, PLANE_H);
  const mapMesh = new THREE.Mesh(geo, mapMat);
  const chromeMesh = new THREE.Mesh(geo, chromeMat);
  const lineMesh = new THREE.Mesh(geo, lineMat);
  chromeMesh.position.z = 0.01;
  lineMesh.position.z = 0.02;
  mapMesh.renderOrder = 1;
  chromeMesh.renderOrder = 2;
  lineMesh.renderOrder = 3;
  group.add(mapMesh, chromeMesh, lineMesh);

  const n = p.series[0].values.length;
  const toX = (u: number) => PLOT.x0 + (u / (n - 1)) * (PLOT.x1 - PLOT.x0);
  const toY = (v: number) => PLOT.y1 - (clamp(v, 0, p.yMax) / p.yMax) * (PLOT.y1 - PLOT.y0);

  let drawnKey = "";
  const drawLines = (prog: number) => {
    const key = prog.toFixed(5);
    if (key === drawnKey) return;
    drawnKey = key;
    const { ctx, canvas } = lineC;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(canvas.width / CW, canvas.height / CH);
    if (prog <= 0) {
      lineTex.needsUpdate = true;
      return;
    }
    const uEnd = prog * (n - 1);
    p.series.forEach((s) => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= Math.floor(uEnd); i++) pts.push([toX(i), toY(s.values[i])]);
      if (uEnd > Math.floor(uEnd)) pts.push([toX(uEnd), toY(seriesPoint(s, uEnd))]);
      const stroke = (w: number, col: string, blur: number) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.shadowColor = col;
        ctx.shadowBlur = blur;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      };
      stroke(30, rgba(s.color, 0.16), 24);
      stroke(14, s.color, 6);
      ctx.shadowBlur = 0;
      // end tag
      const [ex, ey] = pts[pts.length - 1];
      const v = seriesPoint(s, uEnd);
      ctx.font = font(800, 62, "Inter", false);
      ctx.fillStyle = "rgba(240,244,255,0.97)";
      ctx.shadowColor = "rgba(0,0,30,0.9)";
      ctx.shadowBlur = 10;
      ctx.textBaseline = "middle";
      ctx.fillText(`${Math.round(v)}%`, ex + 34, ey - 6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(ex, ey, 9, 0, TAU);
      ctx.fill();
    });
    lineTex.needsUpdate = true;
  };

  return {
    scene,
    camera,
    post: {
      bloomStrength: 0.55,
      bloomThreshold: 0.65,
      bloomKnee: 0.3,
      bloomRadius: 0.75,
      vignette: 0.75,
      dof: { focus: 17.0, range: 1.4, ramp: 5, maxNear: 0.008, maxFar: 0.008 },
    },
    update: (frame, post) => {
      const t = frame / 30;
      // slow camera drift (dolly + slight orbit), eased over the whole clip
      const d = easeInOutCubic(frame / 450);
      camera.position.set(1.5 - 0.6 * d, -0.35 + 0.2 * d, 17.7 - 0.7 * d);
      camera.lookAt(1.3, -0.05, 0);
      const mapIn = smoothstep(0, sec(1.5), frame);
      (bg.material as THREE.ShaderMaterial).uniforms.fade.value = 0.25 + 0.75 * mapIn;
      mapMat.uniforms.opacity.value = mapIn;
      const chromeIn = easeOutCubic((frame - sec(1.5)) / sec(1.5));
      chromeMat.uniforms.opacity.value = chromeIn;
      chromeMesh.position.y = -0.25 * (1 - chromeIn);
      const prog = easeInOutCubic((frame - sec(3)) / sec(8));
      drawLines(prog);
      const hold = smoothstep(sec(11), sec(11.6), frame);
      lineMat.uniforms.gain.value = 1 + hold * 0.18 * (0.5 - 0.5 * Math.cos(TAU * ((t - 11) / 2)));
      post.opts.bloomStrength = 0.55 + 0.1 * hold * (0.5 - 0.5 * Math.cos(TAU * ((t - 11) / 2)));
    },
  };
};
