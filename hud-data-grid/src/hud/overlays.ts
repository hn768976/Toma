import * as THREE from "three";
import { hash } from "../engine/random";

/** A plane lying flat on the HUD floor (y = lift), centred at plane coords (x, y). */
export const floorPlane = (
  w: number,
  h: number,
  x: number,
  y: number,
  material: THREE.Material,
  lift = 0.006,
  rotation = 0,
) => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.rotation.order = "YXZ";
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.y = rotation;
  mesh.position.set(x, lift, -y);
  mesh.renderOrder = 2;
  return mesh;
};

const additive = (map: THREE.Texture, color: THREE.Color) =>
  new THREE.MeshBasicMaterial({
    map,
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

const canvasTexture = (canvas: HTMLCanvasElement) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  return tex;
};

// ---------------------------------------------------------------------------
// Ticking serial-number readout ("808-1899-44-29")
// ---------------------------------------------------------------------------
const PATTERNS = [
  "ddd-dddd-dd-dd",
  "ddd-dddd-d-d-ddd",
  "dddd-ddd-d-d-dd",
  "ddd-dddd-d-ddd",
  "ddd-ddd-dd-d-dd",
];

export class DigitReadout {
  readonly mesh: THREE.Mesh;
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private last = "";
  constructor(
    private seed: number,
    w: number,
    x: number,
    y: number,
    color: THREE.Color,
    private fps: number,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 224;
    this.ctx = canvas.getContext("2d")!;
    this.tex = canvasTexture(canvas);
    const h = (w * canvas.height) / canvas.width;
    this.mesh = floorPlane(w, h, x, y, additive(this.tex, color));
  }

  private text(frame: number) {
    const t = frame / this.fps;
    const pIdx = Math.floor(hash(this.seed, Math.floor(t / 2.4)) * PATTERNS.length);
    const pat = PATTERNS[pIdx];
    let s = "";
    let di = 0;
    for (const ch of pat) {
      if (ch === "d") {
        const rate = 1.5 + hash(this.seed, di, 7) * 4.5;
        const step = Math.floor(t * rate + hash(this.seed, di, 3) * 5);
        const v = Math.floor(hash(this.seed, di, step) * 10);
        s += String(v);
        di++;
      } else s += ch;
    }
    return s;
  }

  update(frame: number) {
    const s = this.text(frame);
    if (s === this.last) return;
    this.last = s;
    const c = this.ctx;
    const W = c.canvas.width;
    const H = c.canvas.height;
    c.clearRect(0, 0, W, H);
    c.font = "400 132px Orbitron";
    c.textBaseline = "middle";
    c.fillStyle = "#ffffff";
    c.shadowColor = "rgba(150,200,255,0.7)";
    c.shadowBlur = 10;
    // fixed advance so the readout never "jumps" when glyph widths differ
    const adv = 128;
    let x = 30;
    for (const ch of s) {
      if (ch === "-") {
        c.fillRect(x + 8, H / 2 - 5, 38, 10);
        x += 62;
      } else {
        c.fillText(ch, x + 6, H / 2 + 6);
        // thin box framing each digit, as on the reference readout
        c.save();
        c.globalAlpha = 0.45;
        c.lineWidth = 3;
        c.shadowBlur = 4;
        c.strokeRect(x - 6, H / 2 - 74, adv - 10, 148);
        c.restore();
        x += adv;
      }
    }
    // little trailing marker dot
    c.beginPath();
    c.arc(x + 30, H / 2 + 40, 9, 0, Math.PI * 2);
    c.fill();
    this.tex.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Circular gauge with a two-digit counter
// ---------------------------------------------------------------------------
export class Gauge {
  readonly mesh: THREE.Mesh;
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private last = -1;
  constructor(
    private seed: number,
    size: number,
    x: number,
    y: number,
    color: THREE.Color,
    private fps: number,
    private accent: string,
    rotation = 0,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    this.ctx = canvas.getContext("2d")!;
    this.tex = canvasTexture(canvas);
    this.mesh = floorPlane(size, size, x, y, additive(this.tex, color), 0.006, rotation);
  }

  private value(frame: number) {
    const t = frame / this.fps;
    const step = Math.floor(t * 2.6 + hash(this.seed) * 3);
    // mostly drifts, sometimes jumps
    // holds a value, then ticks in short bursts (sparser changes, like the reference)
    const base = Math.floor(hash(this.seed, Math.floor(step / 8)) * 99);
    const burst = Math.min(step % 8, 3);
    return (base + burst) % 100;
  }

  update(frame: number) {
    const v = this.value(frame);
    const t = frame / this.fps;
    const rot = Math.floor(t * 1.2);
    const key = v * 1000 + (rot % 1000);
    if (key === this.last) return;
    this.last = key;
    const c = this.ctx;
    const S = c.canvas.width;
    const cx = S / 2;
    c.clearRect(0, 0, S, S);
    c.strokeStyle = "#ffffff";
    c.fillStyle = "#ffffff";
    c.shadowColor = "rgba(150,200,255,0.8)";
    c.shadowBlur = 10;
    // outer thin ring
    c.globalAlpha = 0.55;
    c.lineWidth = 5;
    c.beginPath();
    c.arc(cx, cx, 270, 0, Math.PI * 2);
    c.stroke();
    // tick ring
    c.globalAlpha = 0.8;
    c.lineWidth = 9;
    const ticks = 48;
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2 + rot * 0.02;
      const on = hash(this.seed, i, Math.floor(rot / 3)) > 0.25;
      if (!on) continue;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 222, cx + Math.sin(a) * 222);
      c.lineTo(cx + Math.cos(a) * 246, cx + Math.sin(a) * 246);
      c.stroke();
    }
    // progress arc
    c.globalAlpha = 1;
    c.lineWidth = 16;
    c.beginPath();
    c.arc(cx, cx, 192, -Math.PI / 2, -Math.PI / 2 + (v / 100) * Math.PI * 2);
    c.stroke();
    c.globalAlpha = 0.35;
    c.lineWidth = 4;
    c.beginPath();
    c.arc(cx, cx, 160, 0, Math.PI * 2);
    c.stroke();
    // number
    c.globalAlpha = 1;
    c.font = "600 170px Orbitron";
    c.lineWidth = 3;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(String(v).padStart(2, "0"), cx, cx + 8);
    // accent pip
    c.shadowBlur = 0;
    c.fillStyle = this.accent;
    c.beginPath();
    c.arc(cx + 280, cx - 150, 12, 0, Math.PI * 2);
    c.fill();
    this.tex.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Small monospace telemetry text blocks
// ---------------------------------------------------------------------------
export class TextBlock {
  readonly mesh: THREE.Mesh;
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  private lastStep = -1;
  constructor(
    private seed: number,
    w: number,
    x: number,
    y: number,
    color: THREE.Color,
    private fps: number,
    private lines = 6,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 64 * lines;
    this.ctx = canvas.getContext("2d")!;
    this.tex = canvasTexture(canvas);
    const h = (w * canvas.height) / canvas.width;
    this.mesh = floorPlane(w, h, x, y, additive(this.tex, color));
  }

  update(frame: number) {
    const step = Math.floor((frame / this.fps) * 3);
    if (step === this.lastStep) return;
    this.lastStep = step;
    const c = this.ctx;
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    c.font = "44px 'Share Tech Mono'";
    c.textBaseline = "top";
    c.fillStyle = "#ffffff";
    const labels = ["SYS", "NODE", "PKT", "LAT", "BUF", "CPU", "MEM", "I/O", "NET", "SEQ"];
    for (let i = 0; i < this.lines; i++) {
      const lab = labels[Math.floor(hash(this.seed, i) * labels.length)];
      const live = hash(this.seed, i, 99) > 0.5 ? step : Math.floor(step / 7);
      const n1 = Math.floor(hash(this.seed, i, live) * 9999);
      const n2 = (hash(this.seed, i, live, 2) * 999).toFixed(2);
      c.globalAlpha = 0.45 + 0.55 * hash(this.seed, i, 5);
      c.fillText(`${lab}_${String(i).padStart(2, "0")}  ${String(n1).padStart(4, "0")}  ${n2}`, 8, i * 64 + 8);
    }
    this.tex.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Cross-shaped glints that flash briefly in the distance
// ---------------------------------------------------------------------------
export const makeGlintTexture = () => {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const c = canvas.getContext("2d")!;
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.08, "rgba(220,235,255,0.7)");
  g.addColorStop(0.3, "rgba(120,170,255,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, S, S);
  c.translate(S / 2, S / 2);
  c.rotate(Math.PI / 4);
  for (let k = 0; k < 2; k++) {
    const lg = c.createLinearGradient(-S / 2, 0, S / 2, 0);
    lg.addColorStop(0, "rgba(255,255,255,0)");
    lg.addColorStop(0.5, "rgba(255,255,255,0.95)");
    lg.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = lg;
    c.fillRect(-S / 2, -3, S, 6);
    c.rotate(Math.PI / 2);
  }
  return canvasTexture(canvas);
};

// ---------------------------------------------------------------------------
// Emissive bars (orange status lamps / bright streaks) floating just above the
// floor; they sit near the lens so the depth of field turns them into bokeh.
// ---------------------------------------------------------------------------
export const makeBarTexture = () => {
  // pre-softened lamp: a rounded bar with a wide falloff, so it reads as
  // out-of-focus bokeh even before the depth-of-field pass
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const c = canvas.getContext("2d")!;
  c.filter = "blur(9px)";
  c.fillStyle = "#ffffff";
  c.beginPath();
  c.moveTo(40, 22);
  c.lineTo(216, 22);
  c.quadraticCurveTo(228, 32, 216, 42);
  c.lineTo(40, 42);
  c.quadraticCurveTo(28, 32, 40, 22);
  c.fill();
  c.filter = "none";
  return canvasTexture(canvas);
};

export class GlowBar {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  constructor(
    tex: THREE.Texture,
    private base: THREE.Color,
    w: number,
    x: number,
    y: number,
    lift: number,
    private seed: number,
    private fps: number,
    private blink: number,
  ) {
    this.mat = additive(tex, base.clone());
    this.mesh = floorPlane(w, w * 0.25, x, y, this.mat, lift);
  }
  update(frame: number) {
    const t = frame / this.fps;
    const step = Math.floor(t * (1.5 + 3 * hash(this.seed, 1)) + hash(this.seed) * 5);
    const on = hash(this.seed, step) > this.blink ? 1 : 0.25;
    this.mat.color.copy(this.base).multiplyScalar(on);
  }
}
