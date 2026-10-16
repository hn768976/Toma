import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RectAreaLight,
  Scene,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { canvasTexture, makeCanvas } from "../lib/canvasTex";
import { makeLedMaterial } from "../lib/ledMaterial";
import { makePipeline, GradeParams } from "../lib/post";
import { LOOP_PERIODS, ledValue, mod, mulberry32, pick, Rng } from "../lib/random";
import { makeReflectiveFloorMaterial, PlanarReflection } from "../lib/reflection";
import type { LookRuntime } from "../lib/GLStage";

export type ServerAisleParams = {
  ledA: string; // cyan
  ledB: string; // green
  grade: GradeParams;
  loop: number;
};

// ---------------------------------------------------------------------------
// Geometry constants (metres)
const BAY = 0.6; // rack width and pitch
const RACK_H = 2.1;
const RACK_D = 1.0;
const TYPES = 7; // the row repeats every 7 bays
const OPEN_W = 0.53;
const OPEN_H = 1.93;
const OPEN_Y0 = 0.085;
const BAYS_BEHIND = 6;
const BAYS_AHEAD = 64;
const PANEL_EVERY = 7; // one ceiling panel per 7-bay period
const CEIL_Y = 3.05;

// Faceplate texture size (covers OPEN_W x OPEN_H)
const TW = 560;
const TH = 2040;
const U = TH / 42.5; // 42U rack plus a little margin

// ---------------------------------------------------------------------------
// Bay-type layouts, generated once at module level with a fixed seed.
type UnitKind = "1u" | "2u" | "4u" | "switch" | "blank" | "cable" | "patch";
type LedSpec = { group: number; period: number; phase: number; mode: "blink" | "breathe" };
type BayLayout = {
  units: { kind: UnitKind; u: number; silver: boolean; seed: number }[];
  groups: LedSpec[]; // 3 blink groups for this bay type
  glass: number; // door glass opacity
};

const layoutRng = mulberry32(0x5e2a17);
const KIND_SIZES: Record<UnitKind, number> = { "1u": 1, "2u": 2, "4u": 4, switch: 1, blank: 1, cable: 1, patch: 1 };

const BAY_LAYOUTS: BayLayout[] = Array.from({ length: TYPES }, (_, t) => {
  const r = mulberry32(0x1000 + t * 7919);
  const units: BayLayout["units"] = [];
  let used = 0;
  // Each type gets its own server mix.
  const mixes: UnitKind[][] = [
    ["1u", "1u", "2u", "1u", "2u", "blank", "1u"],
    ["2u", "2u", "4u", "1u", "blank", "2u"],
    ["1u", "1u", "1u", "switch", "1u", "1u", "cable"],
    ["4u", "2u", "4u", "blank", "2u", "1u"],
    ["2u", "1u", "2u", "1u", "switch", "blank", "2u"],
    ["1u", "2u", "blank", "1u", "4u", "1u", "1u"],
    ["2u", "1u", "1u", "2u", "cable", "2u", "1u"],
  ];
  const silverBias = [0.45, 0.25, 0.4, 0.2, 0.35, 0.3, 0.4][t];
  units.push({ kind: "patch", u: 1, silver: false, seed: Math.floor(r() * 1e9) });
  used += 1;
  units.push({ kind: "switch", u: 1, silver: false, seed: Math.floor(r() * 1e9) });
  used += 1;
  units.push({ kind: "cable", u: 1, silver: false, seed: Math.floor(r() * 1e9) });
  used += 1;
  while (used < 40) {
    const kind = pick(r, mixes[t]);
    const u = KIND_SIZES[kind];
    if (used + u > 40) break;
    // Runs of identical servers, as in a real rack.
    const run = kind === "blank" || kind === "cable" ? 1 : 1 + Math.floor(r() * 3);
    const silver = r() < silverBias;
    for (let k = 0; k < run && used + u <= 40; k++) {
      units.push({ kind, u, silver, seed: Math.floor(r() * 1e9) });
      used += u;
    }
  }
  const groups: LedSpec[] = [0, 1, 2].map((g) => ({
    group: g,
    period: pick(r, LOOP_PERIODS),
    phase: Math.floor(r() * 200),
    mode: g === 2 ? "breathe" : "blink",
  }));
  return { units, groups, glass: 0.22 + 0.12 * layoutRng() };
});

// ---------------------------------------------------------------------------
// Canvas drawing of one bay faceplate: albedo, emissive and blink mask.

const drawFaceplate = (t: number, ledA: string, ledB: string) => {
  const alb = makeCanvas(TW, TH);
  const emi = makeCanvas(TW, TH);
  const msk = makeCanvas(TW, TH);
  const a = alb.ctx;
  const e = emi.ctx;
  const m = msk.ctx;
  a.fillStyle = "#07080a";
  a.fillRect(0, 0, TW, TH);
  e.fillStyle = "#000";
  e.fillRect(0, 0, TW, TH);
  m.fillStyle = "#000";
  m.fillRect(0, 0, TW, TH);
  // Mounting rails with holes.
  for (const x of [0, TW - 18]) {
    a.fillStyle = "#1a1c20";
    a.fillRect(x, 0, 18, TH);
    a.fillStyle = "#050506";
    for (let y = 6; y < TH; y += U / 3) a.fillRect(x + 6, y, 6, 6);
  }
  const lay = BAY_LAYOUTS[t];
  let y = TH - U * 0.7; // fill from the bottom up
  const maskColor = (g: number) => (g === 0 ? "#ff0000" : g === 1 ? "#00ff00" : "#0000ff");

  // An LED: emissive mark plus (maybe) blink-group membership.
  const led = (r: Rng, x: number, yy: number, w: number, h: number, color: string, blinkChance: number) => {
    e.fillStyle = color;
    e.fillRect(x, yy, w, h);
    // Lens in albedo so it reads when dim.
    a.fillStyle = "#2a3236";
    a.fillRect(x, yy, w, h);
    if (r() < blinkChance) {
      m.fillStyle = maskColor(Math.floor(r() * 3));
      m.fillRect(x - 1, yy - 1, w + 2, h + 2);
    }
  };
  const lcd = (r: Rng, x: number, yy: number, w: number, h: number, color: string) => {
    // Rectangular LED window: glowing panel with a faint inner pattern.
    a.fillStyle = "#1c2a30";
    a.fillRect(x - 2, yy - 2, w + 4, h + 4);
    e.fillStyle = color;
    e.globalAlpha = 0.9;
    e.fillRect(x, yy, w, h);
    e.globalAlpha = 1;
    e.fillStyle = "rgba(255,255,255,0.35)";
    const rows = Math.max(1, Math.floor(h / 9));
    for (let k = 0; k < rows; k++) {
      const lw = w * (0.3 + 0.6 * r());
      e.fillRect(x + 4, yy + 3 + k * 9, lw, 3);
    }
    if (r() < 0.35) {
      m.fillStyle = maskColor(Math.floor(r() * 3));
      m.fillRect(x - 2, yy - 2, w + 4, h + 4);
    }
  };
  const vent = (x: number, yy: number, w: number, h: number, base: string) => {
    a.fillStyle = base;
    a.fillRect(x, yy, w, h);
    a.fillStyle = "rgba(0,0,0,0.55)";
    for (let vy = yy + 3; vy < yy + h - 3; vy += 6)
      for (let vx = x + 3 + ((vy / 6) % 2) * 3; vx < x + w - 3; vx += 6) a.fillRect(vx, vy, 3, 3);
  };
  const label = (x: number, yy: number, w: number, h: number) => {
    a.fillStyle = "#d8e2ee";
    a.fillRect(x, yy, w, h);
    a.fillStyle = "#3d6fc4";
    a.fillRect(x, yy, w * 0.28, h);
    a.fillStyle = "rgba(40,50,70,0.6)";
    for (let k = 0; k < 4; k++) a.fillRect(x + w * 0.35 + k * w * 0.15, yy + h * 0.35, w * 0.1, h * 0.3);
  };
  const plate = (yy: number, h: number, silver: boolean) => {
    const g = a.createLinearGradient(0, yy, 0, yy + h);
    if (silver) {
      g.addColorStop(0, "#80858b");
      g.addColorStop(0.5, "#62676d");
      g.addColorStop(1, "#45494e");
    } else {
      g.addColorStop(0, "#3a3d42");
      g.addColorStop(0.5, "#2a2c30");
      g.addColorStop(1, "#1d1f22");
    }
    a.fillStyle = g;
    a.fillRect(20, yy + 1, TW - 40, h - 2);
    a.fillStyle = "rgba(255,255,255,0.18)";
    a.fillRect(20, yy + 1, TW - 40, 1.5);
    a.fillStyle = "rgba(0,0,0,0.6)";
    a.fillRect(20, yy + h - 2, TW - 40, 1.5);
    // Rack ears with screws.
    a.fillStyle = silver ? "#55595e" : "#18191c";
    a.fillRect(20, yy + 1, 26, h - 2);
    a.fillRect(TW - 46, yy + 1, 26, h - 2);
    a.fillStyle = "#0c0c0d";
    a.beginPath();
    a.arc(33, yy + h / 2, 4, 0, Math.PI * 2);
    a.arc(TW - 33, yy + h / 2, 4, 0, Math.PI * 2);
    a.fill();
  };

  for (const unit of lay.units) {
    const h = unit.u * U;
    const yy = y - h;
    y = yy;
    const r = mulberry32(unit.seed);
    const x0 = 52;
    const x1 = TW - 52;
    const ww = x1 - x0;
    switch (unit.kind) {
      case "1u": {
        plate(yy, h, unit.silver);
        // Drive caddies.
        const n = r() < 0.5 ? 8 : 10;
        const cw = (ww * 0.62) / n;
        for (let k = 0; k < n; k++) {
          const cx = x0 + k * cw;
          a.fillStyle = unit.silver ? "#4a4e53" : "#141518";
          a.fillRect(cx + 1, yy + 6, cw - 2, h - 12);
          a.fillStyle = "rgba(0,0,0,0.5)";
          for (let gy = yy + 9; gy < yy + h - 9; gy += 4) a.fillRect(cx + 3, gy, cw - 10, 2);
          if (r() < 0.45) led(r, cx + cw - 7, yy + 9, 3, 3, r() < 0.4 ? ledB : ledA, 0.3);
        }
        const xr = x0 + ww * 0.64;
        if (r() < 0.16) lcd(r, xr + 4, yy + 10, ww * 0.16, h - 20, r() < 0.6 ? ledA : ledB);
        else label(xr + 4, yy + 12, ww * 0.16, h - 24);
        vent(xr + ww * 0.18, yy + 6, ww * 0.17, h - 12, unit.silver ? "#5c6066" : "#1b1c1f");
        led(r, x1 - 8, yy + h / 2 - 2, 4, 4, ledA, 0.25);
        break;
      }
      case "2u": {
        plate(yy, h, unit.silver);
        // Two rows of drive caddies with blue release tabs.
        const n = 6;
        const cw = (ww * 0.56) / n;
        for (let row = 0; row < 2; row++)
          for (let k = 0; k < n; k++) {
            const cx = x0 + k * cw;
            const cy = yy + 6 + row * (h / 2 - 3);
            a.fillStyle = unit.silver ? "#4b4f55" : "#151619";
            a.fillRect(cx + 1, cy, cw - 2, h / 2 - 9);
            a.fillStyle = "#6a5ad8";
            a.fillRect(cx + 4, cy + 3, cw * 0.3, 5);
            if (r() < 0.5) led(r, cx + cw - 8, cy + 4, 3, 3, r() < 0.35 ? ledB : ledA, 0.35);
          }
        const xr = x0 + ww * 0.58;
        if (r() < 0.2) lcd(r, xr + 6, yy + h * 0.25, ww * 0.2, h * 0.38, r() < 0.55 ? ledA : ledB);
        label(xr + 6, yy + h * 0.72, ww * 0.2, h * 0.14);
        vent(xr + ww * 0.24, yy + 6, ww * 0.17, h - 12, unit.silver ? "#5c6066" : "#1b1c1f");
        led(r, x1 - 9, yy + 10, 5, 5, ledB, 0.2);
        led(r, x1 - 9, yy + 22, 5, 5, ledA, 0.4);
        break;
      }
      case "4u": {
        plate(yy, h, unit.silver);
        const cols = 4;
        const rows = 3;
        const cw = (ww * 0.78) / cols;
        const ch = (h - 16) / rows;
        for (let row = 0; row < rows; row++)
          for (let k = 0; k < cols; k++) {
            const cx = x0 + k * cw;
            const cy = yy + 8 + row * ch;
            a.fillStyle = unit.silver ? "#50545a" : "#16171a";
            a.fillRect(cx + 2, cy + 1, cw - 4, ch - 2);
            a.fillStyle = "rgba(0,0,0,0.45)";
            for (let gx = cx + 6; gx < cx + cw - 20; gx += 5) a.fillRect(gx, cy + 5, 2, ch - 10);
            a.fillStyle = "#6a5ad8";
            a.fillRect(cx + cw - 16, cy + 5, 8, ch - 10);
            led(r, cx + cw - 15, cy + 6, 4, 4, r() < 0.5 ? ledB : ledA, 0.4);
          }
        const xr = x0 + ww * 0.8;
        if (r() < 0.5) lcd(r, xr + 4, yy + 12, ww * 0.18, h * 0.22, ledA);
        label(xr + 4, yy + h * 0.45, ww * 0.18, h * 0.08);
        vent(xr + 4, yy + h * 0.6, ww * 0.18, h * 0.32, unit.silver ? "#5c6066" : "#1b1c1f");
        break;
      }
      case "switch": {
        plate(yy, h, false);
        const n = 24;
        const pw = (ww * 0.8) / n;
        for (let k = 0; k < n; k++) {
          const px = x0 + k * pw + Math.floor(k / 6) * 3;
          a.fillStyle = "#050506";
          a.fillRect(px + 1, yy + h * 0.42, pw - 3, h * 0.42);
          led(r, px + 2, yy + h * 0.2, 3, 3, r() < 0.7 ? ledB : "#ffb040", 0.5);
        }
        led(r, x1 - 10, yy + h / 2 - 3, 6, 6, ledA, 0.0);
        break;
      }
      case "blank": {
        a.fillStyle = "#0e0f11";
        a.fillRect(20, yy + 1, TW - 40, h - 2);
        if (r() < 0.6) vent(52, yy + 6, TW - 104, h - 12, "#121316");
        break;
      }
      case "cable": {
        a.fillStyle = "#0b0b0d";
        a.fillRect(20, yy + 1, TW - 40, h - 2);
        a.fillStyle = "#1e2024";
        for (let k = 0; k < 5; k++) a.fillRect(70 + k * 92, yy + 8, 30, h - 16);
        break;
      }
      case "patch": {
        // Coloured patch leads at the bottom, as in the reference.
        a.fillStyle = "#0c0d0f";
        a.fillRect(20, yy + 1, TW - 40, h - 2);
        const cols = ["#5a2a2a", "#6a5e34", "#2c4070", "#2e5038", "#6a6a6a", "#1a1b1d", "#1a1b1d"];
        for (let k = 0; k < 30; k++) {
          a.fillStyle = cols[Math.floor(r() * cols.length)];
          a.fillRect(56 + k * 15, yy + h * 0.3, 8, h * 0.45);
        }
        break;
      }
    }
  }
  // Patch cords and side cable bundles (dark, with a soft highlight).
  const cr = mulberry32(0xcab1e + t * 37);
  a.lineCap = "round";
  for (let k = 0; k < 4; k++) {
    const side = k % 2;
    const x0 = side ? TW - 34 - cr() * 8 : 34 + cr() * 8;
    const yA = TH * (0.04 + cr() * 0.6);
    const yB = Math.min(TH - 40, yA + TH * (0.2 + cr() * 0.3));
    // A bundle: several cords leaving the ports and dropping down the side.
    for (let c = 0; c < 4; c++) {
      const off = (c - 1.5) * 5;
      for (const [w, col] of [[6, "#040405"], [2, "#24272b"]] as const) {
        a.strokeStyle = col;
        a.lineWidth = w;
        a.beginPath();
        a.moveTo(x0 + (side ? -40 - c * 18 : 40 + c * 18), yA + c * 4);
        a.bezierCurveTo(x0 + off, yA + 20, x0 + off, yA + 40, x0 + off, yA + 70);
        a.lineTo(x0 + off, yB);
        a.stroke();
      }
    }
  }
  // Slight grime / gradient so plates don't look flat.
  const g = a.createLinearGradient(0, 0, TW, 0);
  g.addColorStop(0, "rgba(0,0,0,0.25)");
  g.addColorStop(0.5, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.3)");
  a.fillStyle = g;
  a.fillRect(0, 0, TW, TH);
  return { alb: alb.canvas, emi: emi.canvas, msk: msk.canvas };
};

// Ceiling panel: 4x4 lamps in a dark frame.
const makeLampGeometry = () => {
  const geoms: BufferGeometry[] = [];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const g = new PlaneGeometry(0.11, 0.11);
      g.rotateX(Math.PI / 2);
      g.translate(-0.21 + i * 0.14, 0, -0.21 + j * 0.14);
      geoms.push(g);
    }
  return mergeGeometries(geoms)!;
};

const makeHandleGeometry = () => {
  const c = new CatmullRomCurve3([
    new Vector3(0, -0.13, 0),
    new Vector3(0, -0.12, 0.03),
    new Vector3(0, 0, 0.042),
    new Vector3(0, 0.12, 0.03),
    new Vector3(0, 0.13, 0),
  ]);
  return new TubeGeometry(c, 24, 0.008, 8, false);
};

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
};

export const buildServerAisle = (gl: WebGLRenderer, p: ServerAisleParams): LookRuntime => {
  RectAreaLightUniformsLib.init();
  const size = gl.getDrawingBufferSize(new Vector2());
  const scene = new Scene();
  scene.background = new Color(0x000000);
  const pmrem = new PMREMGenerator(gl);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.3;

  const camera = new PerspectiveCamera(44, 16 / 9, 0.05, 80);
  // Low camera (0.9 m) looking slightly up, about 35 degrees to the row.
  // Rack fronts are turned ~35 degrees away from facing the camera.
  camera.position.set(0, 0.72, 2.55);
  camera.lookAt(new Vector3(1.85, 1.1, 0));
  camera.updateMatrixWorld();

  let tileU: { uTileOffset: { value: Vector2 } } | null = null;
  const world = new Group(); // everything that scrolls with the truck
  scene.add(world);

  // --- Racks ---------------------------------------------------------------
  const nBays = BAYS_BEHIND + BAYS_AHEAD;
  const firstBay = -BAYS_BEHIND;
  const black = new MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.55, metalness: 0.35 });
  const bezelMat = new MeshStandardMaterial({ color: 0x121316, roughness: 0.42, metalness: 0.5 });
  const chrome = new MeshStandardMaterial({ color: 0xb8bec6, roughness: 0.18, metalness: 1.0 });
  const glassMat = new MeshStandardMaterial({
    color: 0x0a0d10,
    envMapIntensity: 1.2,
    roughness: 0.16,
    metalness: 0.85,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });

  const bodyGeo = box(BAY - 0.004, RACK_H, RACK_D, 0, RACK_H / 2, -RACK_D / 2 - 0.07);
  const sideW = (BAY - OPEN_W) / 2;
  const bezelGeo = mergeGeometries([
    box(sideW, RACK_H, 0.035, -BAY / 2 + sideW / 2, RACK_H / 2, -0.0175),
    box(sideW, RACK_H, 0.035, BAY / 2 - sideW / 2, RACK_H / 2, -0.0175),
    box(BAY, RACK_H - OPEN_Y0 - OPEN_H, 0.035, 0, (OPEN_Y0 + OPEN_H + RACK_H) / 2, -0.0175),
    box(BAY, OPEN_Y0, 0.04, 0, OPEN_Y0 / 2, -0.02),
  ])!;
  const e = 0.005;
  const chromeGeo = mergeGeometries([
    box(e, OPEN_H + 2 * e, 0.006, -OPEN_W / 2 - e / 2, OPEN_Y0 + OPEN_H / 2, 0.002),
    box(e, OPEN_H + 2 * e, 0.006, OPEN_W / 2 + e / 2, OPEN_Y0 + OPEN_H / 2, 0.002),
    box(OPEN_W, e, 0.006, 0, OPEN_Y0 - e / 2, 0.002),
    box(OPEN_W, e, 0.006, 0, OPEN_Y0 + OPEN_H + e / 2, 0.002),
  ])!;
  const glassGeo = new PlaneGeometry(OPEN_W, OPEN_H);
  glassGeo.translate(0, OPEN_Y0 + OPEN_H / 2, -0.004);
  const plateGeo = new PlaneGeometry(OPEN_W, OPEN_H);
  plateGeo.translate(0, OPEN_Y0 + OPEN_H / 2, -0.05);
  const handleGeo = makeHandleGeometry();
  handleGeo.translate(-OPEN_W / 2 + 0.03, OPEN_Y0 + OPEN_H * 0.62, 0.0);

  const bodies = new InstancedMesh(bodyGeo, black, nBays);
  const bezels = new InstancedMesh(bezelGeo, bezelMat, nBays);
  const chromes = new InstancedMesh(chromeGeo, chrome, nBays);
  const glasses = new InstancedMesh(glassGeo, glassMat, nBays);
  const handles = new InstancedMesh(handleGeo, new MeshStandardMaterial({ color: 0x2c2e32, roughness: 0.35, metalness: 0.9 }), nBays);
  const mtx = new Matrix4();
  for (let k = 0; k < nBays; k++) {
    mtx.makeTranslation((firstBay + k) * BAY, 0, 0);
    bodies.setMatrixAt(k, mtx);
    bezels.setMatrixAt(k, mtx);
    chromes.setMatrixAt(k, mtx);
    glasses.setMatrixAt(k, mtx);
    handles.setMatrixAt(k, mtx);
  }
  glasses.renderOrder = 2;
  world.add(bodies, bezels, chromes, glasses, handles);
  for (const im of [bodies, bezels, chromes, glasses, handles]) im.frustumCulled = false;

  // Faceplates: one instanced mesh (and one texture set) per bay type.
  const blinkUniforms: { u: { value: Vector3 }; t: number }[] = [];
  for (let t = 0; t < TYPES; t++) {
    const { alb, emi, msk } = drawFaceplate(t, p.ledA, p.ledB);
    const { material, uBlink } = makeLedMaterial({
      map: canvasTexture(gl, alb, true),
      emissiveMap: canvasTexture(gl, emi, true),
      blinkMap: canvasTexture(gl, msk, false),
      emissive: new Color(1, 1, 1),
      emissiveIntensity: 3.2,
      roughness: 0.5,
      metalness: 0.2,
    });
    blinkUniforms.push({ u: uBlink, t });
    const idx: number[] = [];
    for (let k = 0; k < nBays; k++) if (mod(firstBay + k, TYPES) === t) idx.push(k);
    const im = new InstancedMesh(plateGeo, material, idx.length);
    idx.forEach((k, n) => im.setMatrixAt(n, new Matrix4().makeTranslation((firstBay + k) * BAY, 0, 0)));
    im.frustumCulled = false;
    world.add(im);
  }

  // --- Ceiling light panels + area lights ---------------------------------
  const panelFrameMat = new MeshStandardMaterial({ color: 0x15171a, roughness: 0.6, metalness: 0.3 });
  const lampMat = new MeshBasicMaterial({ color: new Color(1, 0.98, 0.95).multiplyScalar(9), side: DoubleSide });
  const panelZ = -1.6;
  const panelIdx: number[] = [];
  for (let k = Math.floor(firstBay / PANEL_EVERY) - 1; k * PANEL_EVERY < firstBay + nBays; k++) panelIdx.push(k);
  const frameGeo = new BoxGeometry(0.62, 0.03, 0.62);
  const lampGeo = makeLampGeometry();
  const frames = new InstancedMesh(frameGeo, panelFrameMat, panelIdx.length);
  const lamps = new InstancedMesh(lampGeo, lampMat, panelIdx.length);
  panelIdx.forEach((k, n) => {
    const x = k * PANEL_EVERY * BAY + 0.3;
    frames.setMatrixAt(n, new Matrix4().makeTranslation(x, CEIL_Y + 0.016, panelZ));
    lamps.setMatrixAt(n, new Matrix4().makeTranslation(x, CEIL_Y - 0.001, panelZ));
  });
  frames.frustumCulled = lamps.frustumCulled = false;
  world.add(frames, lamps);
  // Ceiling light over the aisle: one long area light running with the row.
  // It is uniform along x, so the truck needs no per-light windowing and the
  // loop stays exact; the visible lamp panels carry the bloom.
  const aisleLight = new RectAreaLight(0xfff6ee, 5.5, 60, 0.7);
  aisleLight.position.set(10, CEIL_Y - 0.01, 1.3);
  aisleLight.lookAt(10, 0, 1.3);
  scene.add(aisleLight);

  // --- Floor ---------------------------------------------------------------
  const refl = new PlanarReflection(size.x / 2, size.y / 2, 0);
  const { material: floorMat, uniforms: floorU } = makeReflectiveFloorMaterial({
    color: new Color(0.86, 0.87, 0.88),
    roughness: 0.32,
    metalness: 0.0,
    reflection: refl,
    reflectStrength: 0.5,
    blur: 0.012,
    tile: [0.6, 0.6],
    seamDarken: 0.14,
    tileVariation: 0.04,
    lod: 2.0,
    aoZ: 0.0,
    aoWidth: 0.16,
    aoStrength: 0.65,
  });
  const floor = new Mesh(new PlaneGeometry(120, 40), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(10, 0, 18);
  scene.add(floor);
  refl.hide(floor);
  // Dark ceiling plane so reflections/env don't show a void.
  const ceil = new Mesh(new PlaneGeometry(120, 40), new MeshStandardMaterial({ color: 0x050506, roughness: 0.9 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(10, CEIL_Y + 0.04, 0);
  scene.add(ceil);
  // Ceiling structure: cable trays over the racks and the aisle, and a
  // ceiling-tile grid, so the space above the row is not a void.
  const trayMat = new MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.45, metalness: 0.8 });
  for (const [y, z, w] of [[2.42, -0.45, 0.45], [2.7, 0.9, 0.35], [2.55, -1.2, 0.3]] as const) {
    const tray = new Mesh(new BoxGeometry(120, 0.07, w), trayMat);
    tray.position.set(10, y, z);
    scene.add(tray);
  }
  const tileMat = makeReflectiveFloorMaterial({
    color: new Color(0.035, 0.037, 0.04),
    roughness: 0.8,
    reflection: refl,
    reflectStrength: 0,
    blur: 0,
    tile: [0.6, 0.6],
    seamDarken: 0.6,
    tileVariation: 0.1,
  });
  ceil.material = tileMat.material;
  ceil.material.side = DoubleSide;
  tileU = tileMat.uniforms;
  // Fill light from the aisle so the rack fronts read.
  const fill = new RectAreaLight(0xdfe8ff, 1.2, 10, 2.5);
  fill.position.set(3, 1.4, 4.5);
  fill.lookAt(3, 1.1, 0);
  scene.add(fill);
  // Key: a big soft source high and to the front-left, as in the reference,
  // so the near rack fronts and glass catch a broad highlight.
  // Placed where its mirror image lands on the near doors' glass, so the
  // camera sees a broad warm glint there (as in the reference).
  const key = new RectAreaLight(0xf2f4f8, 26, 2.6, 1.3);
  key.position.set(0.5, 2.75, 2.2);
  key.lookAt(0.4, 1.5, 0);
  scene.add(key);

  // --- Post ----------------------------------------------------------------
  // Focus on the second rack from the camera: constant, since the camera's
  // distance to the row never changes while trucking.
  const ray = new Vector3(-1, 0, 0.5).unproject(camera).sub(camera.position).normalize();
  const xLeft = camera.position.x + (ray.x * -camera.position.z) / ray.z;
  const focusPoint = new Vector3(xLeft + 1.6 * BAY, 1.0, 0);
  const focusDist = focusPoint.clone().applyMatrix4(camera.matrixWorldInverse).z * -1;
  const pipe = makePipeline(gl, scene, camera, {
    grade: p.grade,
    bloom: { threshold: 1.1, smoothing: 0.35, intensity: 0.75, radius: 0.62 },
    dof: { focusDistance: focusDist, focusRange: 2.0, bokehScale: 2.1 },
  });

  const travel = TYPES * BAY; // exactly 7 bays per loop
  return {
    render: (frame) => {
      const f = mod(frame, p.loop);
      const u = f / p.loop;
      const shift = u * travel;
      world.position.x = -shift; // camera trucks toward +x: racks slide left
      floorU.uTileOffset.value.set(shift, 0);
      tileU?.uTileOffset.value.set(shift, 0);
      for (const { u: uni, t } of blinkUniforms) {
        const gs = BAY_LAYOUTS[t].groups;
        uni.value.set(
          ledValue(f, gs[0].period, gs[0].phase, gs[0].mode),
          ledValue(f, gs[1].period, gs[1].phase, gs[1].mode),
          ledValue(f, gs[2].period, gs[2].phase, gs[2].mode),
        );
      }
      pipe.final.set("seed", f);
      world.updateMatrixWorld(true);
      refl.update(gl, scene, camera);
      pipe.render();
    },
    dispose: () => {
      pipe.dispose();
      refl.dispose();
      pmrem.dispose();
      env.dispose();
    },
  };
};

