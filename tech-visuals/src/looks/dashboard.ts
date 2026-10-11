import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { clamp, easeOut, ramp } from "../lib/ease";
import { Look } from "../lib/LookCanvas";
import { Pipeline } from "../lib/post";
import { hash1, mulberry32 } from "../lib/random";
import { buildTurbine } from "./turbine";

/**
 * Wind Turbine Monitoring dashboard. The flat UI is a Canvas-2D texture redrawn from scratch
 * every frame (pure function of the frame); the turbine and the nacelle close-up are real 3D,
 * rendered by three.js into their panel rectangles with scissored viewports.
 *
 * Every label and value lives in DASHBOARD below — edit there.
 */
export const DASHBOARD = {
  title: "Wind Turbine Monitoring",
  menus: ["Overview", "Wind Farm", "Site", "Turbine Setup"],
  series: [
    { name: "Turbine A1", color: "#E0705E", start: 150, end: 470 },
    { name: "Turbine B2", color: "#5DB8A6", start: 95, end: 400 },
    { name: "Turbine C3", color: "#FFFFFF", start: 45, end: 250 },
  ],
  status: "Active",
  info: [
    ["Site", "XXX"],
    ["Turbine", "XXX"],
    ["Model", "XXX"],
    ["Manufacturer", "XXX"],
  ],
  infoRight: [
    ["Status", "Run"],
    ["Installation Date", "XXX"],
  ],
  gauge: { label: "Power", target: 815, max: 900, unit: "kW", jitter: 20 },
  stats: [
    { label: "Wind Speed (10 min)", value: 5.9, decimals: 1, unit: "m/s" },
    { label: "Power (10 min)", value: 157.2, decimals: 1, unit: "kW" },
    { label: "Total Energy", value: 4.2, decimals: 1, unit: "GWh" },
  ],
  temperatures: [
    { label: "Ambient", value: 21.5 },
    { label: "Bearing", value: 45.5 },
    { label: "Rotor", value: 40.5 },
    { label: "Stator", value: 31.5 },
  ],
  tempMax: 80,
};

export const DURATION = 450;
const COL = {
  bg: "#0A1A20",
  panel: "#0E2A30",
  panelHi: "#12343A",
  turbinePanel: "#4A5560",
  text: "#FFFFFF",
  textDim: "#A8CCCC",
  mint: "#7AE8C8",
  grid: "rgba(168,204,204,0.22)",
  gaugeTrack: "#1A3A3A",
  gaugeFill: "#D8604A",
  tempBar: "#4A7A7A",
  red: "#D8604A",
  teal: "#3A8A7A",
  pale: "#F0C8C0",
};

// ---- layout in 3840×2160 design pixels ----
type Rect = { x: number; y: number; w: number; h: number };
const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const L = {
  menus: [R(50, 235, 900, 155), R(1000, 235, 900, 155), R(1935, 235, 900, 155), R(2875, 235, 900, 155)],
  turbine: R(75, 485, 1335, 1620),
  chart: R(1440, 470, 2300, 885),
  gauge: R(1440, 1385, 990, 745),
  tempHead: R(2455, 1380, 690, 85),
  tempCols: [R(2455, 1480, 160, 650), R(2632, 1480, 160, 650), R(2809, 1480, 160, 650), R(2986, 1480, 160, 650)],
  nacelle: R(3190, 1480, 560, 650),
};
// chart plot area
const PLOT = { x0: 1540, x1: 3690, y0: 1150, y1: 690 }; // y0 = value 0, y1 = value 500
const X_STEP = 193;
const N_PTS = 12; // x = 0..11 (labels 1..10 under x=1..10)

// ---- seeded chart data: rising walks (module level) ----
const SERIES_DATA = (() => {
  const r = mulberry32(0x7a11d00d);
  return DASHBOARD.series.map((s) => {
    const v: number[] = [];
    for (let i = 0; i < N_PTS; i++) {
      const trend = s.start + ((s.end - s.start) * i) / (N_PTS - 1);
      v.push(Math.max(10, Math.min(495, trend + (r() - 0.5) * (s.start * 0.55 + 40))));
    }
    return v;
  });
})();

const xOf = (i: number) => PLOT.x0 + 0.2 * X_STEP + i * X_STEP;
const yOf = (v: number) => PLOT.y0 + ((PLOT.y1 - PLOT.y0) * v) / 500;

// ---- timing ----
const panelIn = (f: number, order: number) => easeOut(ramp(f, 2 + order * 4, 2 + order * 4 + 20));
const FILL0 = 30; // data fill 1s → 8s
const FILL1 = 240;
const chartHead = (f: number) => ramp(f, FILL0, 210);

const roundRect = (ctx: CanvasRenderingContext2D, r: Rect, rad: number) => {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rad);
};

const drawUI = (ctx: CanvasRenderingContext2D, f: number) => {
  const D = DASHBOARD;
  ctx.save();
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, 3840, 2160);
  ctx.textBaseline = "alphabetic";

  const panel = (order: number, draw: () => void) => {
    const k = panelIn(f, order);
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, (1 - k) * 60);
    draw();
    ctx.restore();
  };

  // title + underline
  panel(0, () => {
    ctx.fillStyle = COL.text;
    ctx.font = "700 96px Inter";
    ctx.fillText(D.title, 112, 128);
    ctx.fillStyle = COL.teal;
    ctx.fillRect(112, 166, 700, 15);
    ctx.fillStyle = COL.red;
    ctx.fillRect(812, 166, 210, 15);
    ctx.fillStyle = COL.pale;
    ctx.fillRect(1022, 166, 170, 15);
  });

  // dropdown menus
  L.menus.forEach((m, i) =>
    panel(1 + i * 0.5, () => {
      ctx.fillStyle = COL.panelHi;
      roundRect(ctx, m, 28);
      ctx.fill();
      ctx.fillStyle = COL.text;
      ctx.font = "500 62px Inter";
      ctx.textAlign = "center";
      ctx.fillText(D.menus[i], m.x + m.w / 2 - 30, m.y + m.h / 2 + 22);
      ctx.textAlign = "left";
      const tw = ctx.measureText(D.menus[i]).width;
      const tx = m.x + m.w / 2 - 30 + tw / 2 + 50;
      const ty = m.y + m.h / 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty - 16);
      ctx.lineTo(tx + 46, ty - 16);
      ctx.lineTo(tx + 23, ty + 20);
      ctx.closePath();
      ctx.fill();
    }),
  );

  // turbine panel (3D drawn on top later)
  panel(3, () => {
    const t = L.turbine;
    ctx.fillStyle = COL.turbinePanel;
    roundRect(ctx, t, 44);
    ctx.fill();
    ctx.fillStyle = COL.text;
    ctx.font = "400 60px Inter";
    ctx.fillText("Status :", t.x + 75, t.y + 105);
    const sw = ctx.measureText("Status :").width;
    ctx.font = "500 54px Inter";
    const pw = ctx.measureText(D.status).width + 50;
    ctx.fillStyle = COL.mint;
    roundRect(ctx, R(t.x + 100 + sw, t.y + 52, pw, 72), 20);
    ctx.fill();
    ctx.fillStyle = "#123A30";
    ctx.fillText(D.status, t.x + 125 + sw, t.y + 107);
    ctx.fillStyle = COL.text;
    ctx.font = "400 52px Inter";
    D.info.forEach(([k, v], i) => ctx.fillText(`${k} : ${v}`, t.x + 50, t.y + 1310 + i * 68));
    ctx.textAlign = "right";
    D.infoRight.forEach(([k, v], i) => ctx.fillText(`${k} : ${v}`, t.x + t.w - 50, t.y + 1446 + i * 68));
    ctx.textAlign = "left";
  });

  // chart
  panel(4, () => {
    const c = L.chart;
    ctx.fillStyle = COL.panel;
    roundRect(ctx, c, 26);
    ctx.fill();
    // legend
    ctx.font = "400 46px Inter";
    let lx = c.x + 520;
    D.series.forEach((s) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(lx, 618);
      ctx.lineTo(lx + 95, 618);
      ctx.stroke();
      ctx.fillStyle = COL.text;
      ctx.fillText(s.name, lx + 125, 634);
      lx += 125 + ctx.measureText(s.name).width + 150;
    });
    // grid + labels
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 3;
    ctx.fillStyle = COL.textDim;
    ctx.font = "400 40px Inter";
    ctx.textAlign = "right";
    for (let v = 0; v <= 500; v += 100) {
      const y = yOf(v);
      ctx.beginPath();
      ctx.moveTo(PLOT.x0, y);
      ctx.lineTo(PLOT.x1, y);
      ctx.stroke();
      ctx.fillText(String(v), PLOT.x0 - 22, y + 14);
    }
    ctx.textAlign = "center";
    for (let i = 1; i <= 10; i++) {
      const x = xOf(i);
      ctx.beginPath();
      ctx.moveTo(x, PLOT.y1);
      ctx.lineTo(x, PLOT.y0);
      ctx.stroke();
      ctx.fillText(String(i), x, PLOT.y0 + 62);
    }
    ctx.textAlign = "left";
    ctx.beginPath();
    ctx.moveTo(PLOT.x0, PLOT.y1 - 20);
    ctx.lineTo(PLOT.x0, PLOT.y0);
    ctx.lineTo(PLOT.x1, PLOT.y0);
    ctx.strokeStyle = "rgba(168,204,204,0.5)";
    ctx.stroke();

    // data: head sweeps left → right
    const head = chartHead(f);
    const headX = xOf(0) + head * (xOf(N_PTS - 1) - xOf(0));
    // bars (paired coral + teal, thin white) rise as the head passes
    for (let i = 1; i <= 10; i++) {
      const x = xOf(i);
      const k = easeOut(clamp((headX - x) / 160));
      if (k <= 0) continue;
      const w = 22;
      [0, 1, 2].forEach((si) => {
        const v = SERIES_DATA[si][i] * k;
        ctx.fillStyle = D.series[si].color;
        ctx.globalAlpha = si === 2 ? 0.55 : 0.85;
        const bx = x - 40 + si * (w + 6);
        ctx.fillRect(bx, yOf(v), w, PLOT.y0 - yOf(v));
      });
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(PLOT.x0 - 10, PLOT.y1 - 60, headX - PLOT.x0 + 10, PLOT.y0 - PLOT.y1 + 80);
    ctx.clip();
    D.series.forEach((s, si) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 11;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      SERIES_DATA[si].forEach((v, i) => (i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v))));
      ctx.stroke();
    });
    ctx.restore();
    // live hold: last point pulses
    if (f > FILL1) {
      const ph = ((f - FILL1) % 45) / 45;
      D.series.forEach((s, si) => {
        const x = xOf(N_PTS - 1);
        const y = yOf(SERIES_DATA[si][N_PTS - 1]);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = (1 - ph) * 0.6;
        ctx.beginPath();
        ctx.arc(x, y, 14 + ph * 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  });

  // power gauge + stats
  panel(5, () => {
    const g = L.gauge;
    ctx.fillStyle = COL.panel;
    roundRect(ctx, g, 26);
    ctx.fill();
    const cx = g.x + g.w / 2;
    const cy = g.y + 385;
    const rOut = 330;
    const thick = 100;
    const a0 = (Math.PI * 160) / 180; // 220° sweep (160° → 380°), symmetric about the top
    const span = (Math.PI * 220) / 180;
    const fillK = easeOut(ramp(f, FILL0, FILL1));
    let val = D.gauge.target * fillK;
    if (f >= FILL1) {
      const step = Math.floor((f - FILL1) / 12);
      val = D.gauge.target + Math.round((hash1(step, 11) - 0.5) * 2 * D.gauge.jitter);
    }
    ctx.lineWidth = thick;
    ctx.lineCap = "butt";
    ctx.strokeStyle = COL.gaugeTrack;
    ctx.beginPath();
    ctx.arc(cx, cy, rOut - thick / 2, a0, a0 + span);
    ctx.stroke();
    if (val > 0) {
      ctx.strokeStyle = COL.gaugeFill;
      ctx.beginPath();
      ctx.arc(cx, cy, rOut - thick / 2, a0, a0 + span * clamp(val / D.gauge.max));
      ctx.stroke();
    }
    ctx.fillStyle = COL.text;
    ctx.textAlign = "center";
    ctx.font = "400 62px Inter";
    ctx.fillText(D.gauge.label, cx, cy - 115);
    ctx.font = "700 110px Inter";
    ctx.fillText(String(Math.round(val)), cx, cy + 5);
    ctx.font = "400 46px Inter";
    ctx.fillText(D.gauge.unit, cx, cy + 70);
    ctx.font = "400 34px Inter";
    ctx.fillStyle = COL.textDim;
    ctx.fillText(`${D.gauge.max}${D.gauge.unit}`, cx + rOut + 10, cy + 160);
    ctx.textAlign = "left";
    // small stats
    ctx.font = "400 36px Inter";
    D.stats.forEach((s, i) => {
      const y = g.y + 620 + i * 50;
      let v = s.value * easeOut(ramp(f, FILL0 + 10, FILL1));
      if (f >= FILL1 && i === 0) v = s.value + (hash1(Math.floor((f - FILL1) / 20), 23) - 0.5) * 0.4;
      ctx.fillStyle = COL.textDim;
      ctx.fillText(s.label, g.x + 60, y);
      ctx.fillStyle = COL.text;
      ctx.textAlign = "right";
      ctx.fillText(v.toFixed(s.decimals), g.x + g.w - 200, y);
      ctx.textAlign = "left";
      ctx.fillStyle = COL.textDim;
      ctx.fillText(s.unit, g.x + g.w - 170, y);
    });
  });

  // temperatures
  panel(6, () => {
    const h = L.tempHead;
    ctx.fillStyle = COL.panel;
    roundRect(ctx, h, 18);
    ctx.fill();
    ctx.fillStyle = COL.text;
    ctx.font = "400 56px Inter";
    ctx.textAlign = "center";
    ctx.fillText("Temperatures", h.x + h.w / 2, h.y + 62);
    L.tempCols.forEach((c, i) => {
      const t = D.temperatures[i];
      ctx.fillStyle = COL.panel;
      roundRect(ctx, c, 16);
      ctx.fill();
      const k = easeOut(ramp(f, FILL0 + 15 + i * 12, FILL1 - 20 + i * 8));
      let v = t.value * k;
      if (f >= FILL1) v = t.value + Math.round((hash1(Math.floor((f - FILL1) / 18), 31 + i) - 0.5) * 2) * 0.5;
      const barBottom = c.y + c.h - 170;
      const barH = 430 * clamp(v / DASHBOARD.tempMax);
      ctx.fillStyle = COL.tempBar;
      ctx.fillRect(c.x + c.w / 2 - 26, barBottom - barH, 52, barH);
      ctx.fillStyle = COL.textDim;
      ctx.font = "400 36px Inter";
      ctx.fillText(t.label, c.x + c.w / 2, c.y + c.h - 100);
      ctx.fillStyle = COL.text;
      ctx.font = "600 38px Inter";
      ctx.fillText(`${v.toFixed(1)}°C`, c.x + c.w / 2, c.y + c.h - 45);
    });
    ctx.textAlign = "left";
  });

  // nacelle close-up backdrop: blue grid
  panel(7, () => {
    const n = L.nacelle;
    ctx.save();
    roundRect(ctx, n, 16);
    ctx.clip();
    const gr = ctx.createLinearGradient(n.x, n.y, n.x + n.w, n.y + n.h);
    gr.addColorStop(0, "#0B2A6A");
    gr.addColorStop(1, "#06163E");
    ctx.fillStyle = gr;
    ctx.fillRect(n.x, n.y, n.w, n.h);
    ctx.strokeStyle = "rgba(70,130,255,0.55)";
    ctx.lineWidth = 3;
    for (let x = n.x + 20; x < n.x + n.w; x += 56) {
      ctx.beginPath();
      ctx.moveTo(x, n.y);
      ctx.lineTo(x, n.y + n.h);
      ctx.stroke();
    }
    for (let y = n.y + 20; y < n.y + n.h; y += 56) {
      ctx.beginPath();
      ctx.moveTo(n.x, y);
      ctx.lineTo(n.x + n.w, y);
      ctx.stroke();
    }
    ctx.restore();
  });
  ctx.restore();
};

export const createDashboard = () => (): Look => {
  const pipe = new Pipeline(4);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const uiScene = new THREE.Scene();
  const uiCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex, depthTest: false, depthWrite: false }));
  quad.frustumCulled = false;
  uiScene.add(quad);

  // 3D: one turbine for the big panel, one for the close-up (separate scenes)
  const mat = new THREE.MeshStandardMaterial({ color: 0xe6e9ec, roughness: 0.4, metalness: 0 });
  const big = new THREE.Scene();
  const bigT = buildTurbine(mat);
  bigT.nacelle.rotation.y = THREE.MathUtils.degToRad(-18);
  big.add(bigT.group);
  const keyA = new THREE.DirectionalLight(0xffffff, 0.9);
  keyA.position.set(2, 3, 4);
  big.add(keyA);
  const bigCam = new THREE.PerspectiveCamera(24, 1, 0.05, 50);

  const close = new THREE.Scene();
  const closeT = buildTurbine(mat);
  closeT.markers.visible = true;
  close.add(closeT.group);
  const keyB = new THREE.DirectionalLight(0xbfd8ff, 1.0);
  keyB.position.set(-2, 2, 3);
  close.add(keyB);
  const closeCam = new THREE.PerspectiveCamera(30, 1, 0.01, 10);

  let env: THREE.Texture | null = null;
  const clear = new THREE.Color(COL.bg);

  const viewport = (gl: THREE.WebGLRenderer, r: Rect, scene: THREE.Scene, cam: THREE.PerspectiveCamera) => {
    const k = pipe.w / 3840;
    const x = Math.round(r.x * k);
    const w = Math.round(r.w * k);
    const h = Math.round(r.h * k);
    const y = Math.round(pipe.h - (r.y + r.h) * k);
    const rt = pipe.scene;
    rt.viewport.set(x, y, w, h);
    rt.scissor.set(x, y, w, h);
    rt.scissorTest = true;
    gl.setRenderTarget(rt);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    gl.clearDepth();
    gl.render(scene, cam);
    rt.viewport.set(0, 0, pipe.w, pipe.h);
    rt.scissor.set(0, 0, pipe.w, pipe.h);
    rt.scissorTest = false;
    gl.setRenderTarget(rt);
  };

  return {
    render(gl, frame) {
      const f = ((frame % DURATION) + DURATION) % DURATION;
      if (!env) {
        const pm = new THREE.PMREMGenerator(gl);
        env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
        big.environment = env;
        close.environment = env;
        big.environmentIntensity = 0.6;
        close.environmentIntensity = 0.5;
        pm.dispose();
      }
      pipe.begin(gl, clear);
      // UI texture at the actual output resolution
      if (canvas.width !== pipe.w || canvas.height !== pipe.h) {
        canvas.width = pipe.w;
        canvas.height = pipe.h;
      }
      ctx.setTransform(pipe.w / 3840, 0, 0, pipe.h / 2160, 0, 0);
      drawUI(ctx, f);
      tex.needsUpdate = true;
      gl.render(uiScene, uiCam);

      // big turbine — blades turn at a steady rate; fades in with its panel
      const k3 = panelIn(f, 3);
      const k7 = panelIn(f, 7);
      bigT.rotor.rotation.z = -f * THREE.MathUtils.degToRad(2.1);
      mat.opacity = 1;
      if (k3 > 0.02) {
        bigCam.position.set(1.45, 0.55, 4.6);
        bigCam.lookAt(0.0, 0.84, 0);
        bigCam.updateMatrixWorld();
        const r = { ...L.turbine, y: L.turbine.y + (1 - k3) * 60 };
        viewport(gl, r, big, bigCam);
      }
      // nacelle close-up: 3/4 rear view, slowly turning
      closeT.rotor.rotation.z = -f * THREE.MathUtils.degToRad(2.1);
      closeT.nacelle.rotation.y = THREE.MathUtils.degToRad(-140 + f * 0.12);
      if (k7 > 0.02) {
        closeCam.position.set(0.36, 1.2, 0.42);
        closeCam.lookAt(0, 1.04, -0.02);
        closeCam.updateMatrixWorld();
        const r = { ...L.nacelle, y: L.nacelle.y + (1 - k7) * 60 };
        viewport(gl, r, close, closeCam);
      }
      pipe.finish(gl, { final: { frame: f, period: DURATION, grain: 0.015, vignette: 0.12 } });
    },
    dispose() {
      pipe.dispose();
      tex.dispose();
    },
  };
};
