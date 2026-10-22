import { BASE_WIDTH, BARS_END, BARS_START, ICONS_START, RING_IN_END, RING_IN_START, SHOCK_END, SHOCK_START, STREAKS_START, DURATION_IN_FRAMES } from "./constants";
import { Camera, CameraMode, Projected, Vec3, cameraAt, project } from "./camera";
import { ICONS } from "./icons";
import { clamp, easeOutCubic, mulberry32, smooth } from "./random";

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
type RGB = [number, number, number];
const rgba = (c: RGB, a: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${clamp(a).toFixed(4)})`;

const BG_EDGE: RGB = [0, 12, 35];
const BG_BEAM: RGB = [13, 58, 88];
const LINE: RGB = [185, 212, 238];
const NODE_WARM: RGB = [255, 138, 18];
const NODE_COOL: RGB = [96, 186, 255];
const RING: RGB = [214, 240, 255];
const RING_GLOW: RGB = [96, 182, 255];
const HUD: RGB = [150, 205, 255];
const ICON: RGB = [222, 238, 255];

// ---------------------------------------------------------------------------
// Static scene data (generated once, deterministic)
// ---------------------------------------------------------------------------
type GridNode = { x: number; z: number; warm: boolean; size: number; ph: number; show: boolean };
type Riser = {
  kind: "icon" | "streak" | "dot";
  x: number;
  z: number;
  birth: number;
  speed: number;
  len: number;
  size: number;
  icon: number;
  ph: number;
  framed: boolean;
};
type Bokeh = { x: number; y: number; z: number; size: number; ph: number; warm: boolean };

const GRID_SPACING = 0.32;
const GRID_X = 10;
const GRID_Z0 = -7;
const GRID_Z1 = 12;

type SceneData = {
  nodes: GridNode[];
  cols: number;
  rows: number;
  edges: [number, number][];
  risers: Riser[];
  bokeh: Bokeh[];
};

let cached: SceneData | null = null;
const sceneData = (): SceneData => {
  if (cached) return cached;
  const rnd = mulberry32(20261022);
  const cols = Math.round((GRID_X * 2) / GRID_SPACING) + 1;
  const rows = Math.round((GRID_Z1 - GRID_Z0) / GRID_SPACING) + 1;
  const nodes: GridNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const jx = (rnd() - 0.5) * GRID_SPACING * 0.85;
      const jz = (rnd() - 0.5) * GRID_SPACING * 0.85;
      nodes.push({
        x: -GRID_X + c * GRID_SPACING + jx + (r % 2) * GRID_SPACING * 0.5,
        z: GRID_Z0 + r * GRID_SPACING + jz,
        warm: rnd() < 0.62,
        size: 0.7 + rnd() * 0.7,
        ph: rnd() * Math.PI * 2,
        show: rnd() < 0.72,
      });
    }
  }
  const edges: [number, number][] = [];
  const idx = (r: number, c: number) => r * cols + c;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols && rnd() < 0.9) edges.push([idx(r, c), idx(r, c + 1)]);
      if (r + 1 < rows) {
        if (rnd() < 0.9) edges.push([idx(r, c), idx(r + 1, c)]);
        // Offset rows make a triangulated (plexus) mesh.
        const cc = r % 2 === 0 ? c - 1 : c + 1;
        if (cc >= 0 && cc < cols && rnd() < 0.7) edges.push([idx(r, c), idx(r + 1, cc)]);
      }
    }
  }

  const risers: Riser[] = [];
  const end = DURATION_IN_FRAMES + 10;
  const addRisers = (kind: Riser["kind"], count: number, start: number) => {
    for (let i = 0; i < count; i++) {
      // Emission rate ramps up linearly: sqrt of a uniform variable.
      const birth = start + (end - start) * Math.sqrt(rnd());
      // Uniform over the disk of the portal.
      const a = rnd() * Math.PI * 2;
      const rr = Math.sqrt(rnd()) * 1.12;
      risers.push({
        kind,
        x: Math.cos(a) * rr,
        z: Math.sin(a) * rr,
        birth,
        speed:
          kind === "streak"
            ? 0.75 + rnd() * 0.75
            : kind === "icon"
              ? 0.32 + rnd() * 0.3
              : 0.28 + rnd() * 0.55,
        len: 0.35 + rnd() * 1.25,
        size: kind === "icon" ? 0.07 + rnd() * 0.035 : 0.6 + rnd() * 1.3,
        icon: Math.floor(rnd() * ICONS.length),
        ph: rnd() * Math.PI * 2,
        framed: rnd() < 0.45,
      });
    }
  };
  addRisers("streak", 190, STREAKS_START);
  addRisers("icon", 120, ICONS_START);
  addRisers("dot", 360, STREAKS_START);
  risers.sort((a, b) => b.z - a.z);

  const bokeh: Bokeh[] = [];
  for (let i = 0; i < 1100; i++) {
    bokeh.push({
      x: (rnd() - 0.5) * 22,
      y: Math.pow(rnd(), 2.2) * 0.5,
      z: -6 + rnd() * 18,
      size: 0.6 + rnd() * 1.4,
      ph: rnd() * Math.PI * 2,
      warm: rnd() < 0.22,
    });
  }
  cached = { nodes, cols, rows, edges, risers, bokeh };
  return cached;
};

// ---------------------------------------------------------------------------
// Buffers
// ---------------------------------------------------------------------------
export type Buffers = {
  softFar: HTMLCanvasElement;
  softNear: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  tmpA: HTMLCanvasElement;
  tmpB: HTMLCanvasElement;
  sprites: Record<"warm" | "cool" | "white" | "ring", HTMLCanvasElement>;
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

const makeSprite = (c: RGB, hotCore = true) => {
  const cv = makeCanvas(64, 64);
  const g = cv.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, hotCore ? `rgba(255,255,255,1)` : rgba(c, 1));
  grad.addColorStop(0.18, rgba(c, 0.95));
  grad.addColorStop(0.45, rgba(c, 0.28));
  grad.addColorStop(1, rgba(c, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return cv;
};

export const createBuffers = (width: number, height: number): Buffers => ({
  softFar: makeCanvas(width / 4, height / 4),
  softNear: makeCanvas(width / 4, height / 4),
  glow: makeCanvas(width / 4, height / 4),
  tmpA: makeCanvas(width / 4, height / 4),
  tmpB: makeCanvas(width / 8, height / 8),
  sprites: {
    warm: makeSprite(NODE_WARM, false),
    cool: makeSprite(NODE_COOL, false),
    white: makeSprite([200, 230, 255]),
    ring: makeSprite(RING_GLOW),
  },
});

const ctxFor = (cv: HTMLCanvasElement) => {
  const c = cv.getContext("2d")!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1;
  c.clearRect(0, 0, cv.width, cv.height);
  // Draw in 1920x1080 base units.
  const k = cv.width / BASE_WIDTH;
  c.setTransform(k, 0, 0, k, 0, 0);
  return c;
};

const blurInto = (src: HTMLCanvasElement, dst: HTMLCanvasElement, px: number) => {
  const c = dst.getContext("2d")!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1;
  c.clearRect(0, 0, dst.width, dst.height);
  c.filter = `blur(${px}px)`;
  c.drawImage(src, 0, 0, dst.width, dst.height);
  c.filter = "none";
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const groundY = (x: number, z: number, t: number) =>
  0.045 * Math.sin(0.7 * x + t * 0.5) * Math.cos(0.55 * z - t * 0.35) +
  0.02 * Math.sin(1.3 * z + 0.4 * x + t * 0.8);

const fog = (z: number) => 1 - smooth(8.5, 14, z);

// Weight of the blurred (out of focus) layer for a given depth, focus ~6.
const softness = (z: number, focus: number) => {
  const coc = Math.abs(1 / z - 1 / focus) * focus;
  return z < focus ? smooth(0.42, 0.8, coc) : smooth(0.3, 0.62, coc);
};

const circlePath = (
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  r: number,
  y: number,
  a0 = 0,
  a1 = Math.PI * 2,
  segs = 160,
) => {
  let started = false;
  for (let i = 0; i <= segs; i++) {
    const a = a0 + ((a1 - a0) * i) / segs;
    const p = project(cam, [Math.cos(a) * r, y, Math.sin(a) * r]);
    if (p.z <= 0) {
      started = false;
      continue;
    }
    if (!started) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
    started = true;
  }
};

const sprite = (ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, size: number) => {
  ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
};

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------
export const renderScene = (
  main: CanvasRenderingContext2D,
  buf: Buffers,
  width: number,
  height: number,
  frame: number,
  mode: CameraMode,
) => {
  const data = sceneData();
  const t = frame / 30;
  const cam = cameraAt(frame, mode);
  const s = width / BASE_WIDTH;
  const focus = project(cam, [0, 0, 0]).z;
  const activity = smooth(30, 300, frame);

  main.setTransform(1, 0, 0, 1, 0, 0);
  main.globalCompositeOperation = "source-over";
  main.globalAlpha = 1;
  main.setTransform(s, 0, 0, s, 0, 0);

  // ---- Background: dark navy with a soft vertical beam of light ---------
  main.fillStyle = rgba(BG_EDGE, 1);
  main.fillRect(0, 0, BASE_WIDTH, 1080);
  {
    const horizon = project(cam, [0, 0, 14]);
    const hy = horizon.z > 0 ? horizon.y : 700;
    main.save();
    main.translate(960, hy - 40);
    main.scale(1.15, 1.45);
    const g = main.createRadialGradient(0, 0, 0, 0, 0, 900);
    const b = 1 + 0.12 * activity;
    g.addColorStop(0, rgba([BG_BEAM[0] * b, BG_BEAM[1] * b, BG_BEAM[2] * b], 1));
    g.addColorStop(0.35, rgba([5, 40, 68], 0.85));
    g.addColorStop(0.7, rgba([1, 22, 46], 0.5));
    g.addColorStop(1, rgba(BG_EDGE, 0));
    main.fillStyle = g;
    main.fillRect(-1400, -1000, 2800, 2000);
    main.restore();
  }

  // ---- Ground plexus ----------------------------------------------------
  const far = ctxFor(buf.softFar);
  const near = ctxFor(buf.softNear);
  const proj: Projected[] = new Array(data.nodes.length);
  const drift = t * 0.05;
  for (let i = 0; i < data.nodes.length; i++) {
    const n = data.nodes[i];
    const x = n.x + drift;
    proj[i] = project(cam, [x, groundY(x, n.z, t), n.z]);
  }
  const ringR2 = 1.08 * 1.08;
  // The plexus inside the portal fades out as the floor disk ignites.
  const portalFade = 1 - easeOutCubic((frame - RING_IN_START) / (RING_IN_END - RING_IN_START));
  const inPortal = (i: number) => {
    const n = data.nodes[i];
    const x = n.x + drift;
    return x * x + n.z * n.z < ringR2;
  };

  // Bucket edges by layer + alpha so each bucket is a single stroke() call.
  const BUCKETS = 6;
  const sharpPaths: Path2D[] = [];
  const farPaths: Path2D[] = [];
  const nearPaths: Path2D[] = [];
  for (let k = 0; k < BUCKETS; k++) {
    sharpPaths.push(new Path2D());
    farPaths.push(new Path2D());
    nearPaths.push(new Path2D());
  }
  for (const [a, b] of data.edges) {
    const pa = proj[a];
    const pb = proj[b];
    if (pa.z <= 0.3 || pb.z <= 0.3) continue;
    const zm = (pa.z + pb.z) / 2;
    const alpha = fog(zm) * (inPortal(a) && inPortal(b) ? portalFade : 1);
    if (alpha <= 0.01) continue;
    if (
      Math.max(pa.x, pb.x) < -50 ||
      Math.min(pa.x, pb.x) > 1970 ||
      Math.min(pa.y, pb.y) > 1130 ||
      Math.max(pa.y, pb.y) < -50
    )
      continue;
    const w = softness(zm, focus);
    const sharpA = alpha * (1 - w);
    const softA = alpha * w;
    if (sharpA > 0.02) {
      const k = Math.min(BUCKETS - 1, Math.floor(sharpA * BUCKETS));
      sharpPaths[k].moveTo(pa.x, pa.y);
      sharpPaths[k].lineTo(pb.x, pb.y);
    }
    if (softA > 0.02) {
      const k = Math.min(BUCKETS - 1, Math.floor(softA * BUCKETS));
      const target = zm < focus ? nearPaths : farPaths;
      target[k].moveTo(pa.x, pa.y);
      target[k].lineTo(pb.x, pb.y);
    }
  }
  for (let k = 0; k < BUCKETS; k++) {
    const a = (k + 0.5) / BUCKETS;
    main.strokeStyle = rgba(LINE, 0.62 * a);
    main.lineWidth = 1.0;
    main.stroke(sharpPaths[k]);
    far.strokeStyle = rgba(LINE, 0.5 * a);
    far.lineWidth = 2.2;
    far.stroke(farPaths[k]);
    near.strokeStyle = rgba(LINE, 0.45 * a);
    near.lineWidth = 3.5;
    near.stroke(nearPaths[k]);
  }

  // Nodes
  main.globalCompositeOperation = "lighter";
  far.globalCompositeOperation = "lighter";
  near.globalCompositeOperation = "lighter";
  for (let i = 0; i < data.nodes.length; i++) {
    const n = data.nodes[i];
    const p = proj[i];
    if (!n.show || p.z <= 0.3) continue;
    if (p.x < -60 || p.x > 1980 || p.y < -60 || p.y > 1160) continue;
    const alpha = fog(p.z) * (inPortal(i) ? portalFade : 1);
    if (alpha <= 0.01) continue;
    const tw = 0.75 + 0.25 * Math.sin(t * 2.2 + n.ph);
    const size = (n.size * 13 * 6) / p.z;
    const w = softness(p.z, focus);
    const img = n.warm ? buf.sprites.warm : buf.sprites.cool;
    if (w < 0.98) {
      main.globalAlpha = alpha * (1 - w) * tw;
      sprite(main, img, p.x, p.y, size * 1.6);
      main.globalAlpha = alpha * (1 - w);
      main.fillStyle = rgba(n.warm ? NODE_WARM : NODE_COOL, 1);
      main.beginPath();
      main.arc(p.x, p.y, (0.0095 * n.size * cam.focal) / p.z, 0, Math.PI * 2);
      main.fill();
    }
    if (w > 0.02) {
      const c = p.z < focus ? near : far;
      c.globalAlpha = alpha * w * tw;
      sprite(c, img, p.x, p.y, size * (p.z < focus ? 2.4 : 1.8));
    }
  }

  // Floating bokeh particles hovering over the ground plane.
  for (const b of data.bokeh) {
    const x = b.x + drift * 0.6;
    const y = b.y + 0.04 * Math.sin(t * 0.8 + b.ph);
    const p = project(cam, [x, y, b.z]);
    if (p.z <= 0.5 || p.x < -80 || p.x > 2000 || p.y < -80 || p.y > 1160) continue;
    const alpha = fog(p.z) * (0.55 + 0.45 * Math.sin(t * 1.6 + b.ph));
    if (alpha <= 0.02) continue;
    const w = softness(p.z, focus);
    const size = (b.size * 20 * 6) / p.z;
    const img = b.warm ? buf.sprites.warm : buf.sprites.cool;
    if (w > 0.5) {
      const c = p.z < focus ? near : far;
      c.globalAlpha = alpha * 0.8;
      sprite(c, img, p.x, p.y, size * 2.2);
    } else {
      main.globalAlpha = alpha * 0.8;
      sprite(main, img, p.x, p.y, size);
    }
  }
  main.globalAlpha = 1;
  far.globalAlpha = 1;
  near.globalAlpha = 1;

  // Composite far (out of focus) layer.
  blurInto(buf.softFar, buf.tmpA, 2.2);
  main.setTransform(1, 0, 0, 1, 0, 0);
  main.globalCompositeOperation = "lighter";
  main.drawImage(buf.tmpA, 0, 0, width, height);
  main.setTransform(s, 0, 0, s, 0, 0);

  // ---- Portal -------------------------------------------------------------
  const glow = ctxFor(buf.glow);
  glow.globalCompositeOperation = "lighter";
  const ringIn = easeOutCubic((frame - RING_IN_START) / (RING_IN_END - RING_IN_START));
  const flash = smooth(RING_IN_START + 6, RING_IN_END - 4, frame) * (1 - smooth(RING_IN_END - 4, RING_IN_END + 30, frame));
  const pulse = 1 + 0.06 * Math.sin(t * 3.1) + 0.03 * Math.sin(t * 7.3);

  if (ringIn > 0) {
    const R = 0.72 + 0.28 * ringIn;

    // Dark translucent floor disk hides the plexus inside the portal.
    main.globalCompositeOperation = "source-over";
    main.beginPath();
    circlePath(main, cam, R * 1.04, 0);
    main.closePath();
    main.fillStyle = rgba([2, 16, 34], 0.82 * ringIn);
    main.fill();

    // Inner HUD circles.
    main.globalCompositeOperation = "lighter";
    main.lineWidth = 0.8;
    for (const [rr, a] of [
      [0.2, 0.18],
      [0.38, 0.2],
      [0.56, 0.22],
      [0.72, 0.28],
      [0.86, 0.3],
    ] as const) {
      main.beginPath();
      circlePath(main, cam, rr * R, 0.002, 0, Math.PI * 2, 96);
      main.strokeStyle = rgba(HUD, a * ringIn);
      main.stroke();
    }
    // Rotating dashed arcs.
    for (let k = 0; k < 3; k++) {
      const rr = [0.64, 0.8, 0.93][k] * R;
      const dir = k % 2 === 0 ? 1 : -1;
      const segs = [12, 24, 6][k];
      main.lineWidth = [1.6, 1.0, 2.2][k];
      main.strokeStyle = rgba(HUD, [0.35, 0.3, 0.4][k] * ringIn);
      for (let j = 0; j < segs; j++) {
        const a0 = (j / segs) * Math.PI * 2 + dir * t * (0.25 + k * 0.1);
        main.beginPath();
        circlePath(main, cam, rr, 0.003, a0, a0 + (Math.PI * 2 * 0.55) / segs, 12);
        main.stroke();
      }
    }

    // Soft light filling the disk.
    {
      const c = project(cam, [0, 0, 0]);
      const edge = project(cam, [R, 0, 0]);
      const rx = Math.abs(edge.x - c.x) || 300;
      const top = project(cam, [0, 0, R]);
      const ry = Math.max(8, Math.abs(c.y - top.y));
      main.save();
      main.translate(c.x, c.y);
      main.scale(1, ry / rx);
      const g = main.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, rgba(RING_GLOW, 0.05 * ringIn));
      g.addColorStop(0.75, rgba(RING_GLOW, 0.1 * ringIn));
      g.addColorStop(1, rgba(RING_GLOW, 0.32 * ringIn));
      main.fillStyle = g;
      main.beginPath();
      main.arc(0, 0, rx, 0, Math.PI * 2);
      main.fill();
      main.restore();
    }

    // Main ring + upper ring (crisp core on main, thick on glow buffer).
    const ringA = ringIn * pulse;
    main.lineWidth = 5;
    main.strokeStyle = rgba(RING, 0.95 * ringA);
    main.beginPath();
    circlePath(main, cam, R, 0, 0, Math.PI * 2, 220);
    main.stroke();
    main.lineWidth = 1.2;
    main.strokeStyle = rgba(RING, 0.6 * ringA);
    main.beginPath();
    circlePath(main, cam, R * 1.06, 0.0, 0, Math.PI * 2, 220);
    main.stroke();
    main.lineWidth = 1.8;
    main.strokeStyle = rgba(RING, 0.75 * ringA);
    main.beginPath();
    circlePath(main, cam, R * 0.93, 0.13 * ringIn, 0, Math.PI * 2, 200);
    main.stroke();

    glow.lineWidth = 22;
    glow.strokeStyle = rgba(RING_GLOW, 0.75 * ringA + 0.6 * flash);
    glow.beginPath();
    circlePath(glow, cam, R, 0, 0, Math.PI * 2, 120);
    glow.stroke();
    glow.lineWidth = 9;
    glow.strokeStyle = rgba(RING, 0.9 * ringA + 0.5 * flash);
    glow.beginPath();
    circlePath(glow, cam, R, 0, 0, Math.PI * 2, 120);
    glow.stroke();
    glow.lineWidth = 7;
    glow.strokeStyle = rgba(RING_GLOW, 0.45 * ringA);
    glow.beginPath();
    circlePath(glow, cam, R * 0.93, 0.13 * ringIn, 0, Math.PI * 2, 120);
    glow.stroke();

    // Vertical haze rising from the rim.
    const rimN = 110;
    for (let i = 0; i < rimN; i++) {
      const a = (i / rimN) * Math.PI * 2;
      const fl = 0.5 + 0.5 * Math.sin(t * 2.4 + i * 1.7) * Math.sin(t * 1.1 + i * 0.37);
      const h = (0.12 + 0.32 * fl) * ringIn;
      const x = Math.cos(a) * R;
      const z = Math.sin(a) * R;
      const p0 = project(cam, [x, 0, z]);
      const p1 = project(cam, [x, h * 0.5, z]);
      const p2 = project(cam, [x, h, z]);
      if (p0.z <= 0) continue;
      glow.lineWidth = 3;
      glow.strokeStyle = rgba(RING_GLOW, 0.22 * ringIn);
      glow.beginPath();
      glow.moveTo(p0.x, p0.y);
      glow.lineTo(p1.x, p1.y);
      glow.stroke();
      glow.strokeStyle = rgba(RING_GLOW, 0.08 * ringIn);
      glow.beginPath();
      glow.moveTo(p1.x, p1.y);
      glow.lineTo(p2.x, p2.y);
      glow.stroke();
    }

    // Hot spots at the silhouette edges of the ring.
    for (const sx of [-1, 1]) {
      const pr = project(cam, [sx * R, 0.02, 0]);
      if (pr.z > 0) {
        glow.globalAlpha = 0.6 * ringA;
        sprite(glow, buf.sprites.ring, pr.x, pr.y, 140);
        glow.globalAlpha = 1;
      }
    }
    // Soft column of light above the portal.
    {
      const c0 = project(cam, [0, 0.45, 0]);
      const edge = project(cam, [R, 0, 0]);
      const c = project(cam, [0, 0, 0]);
      const rx = Math.abs(edge.x - c.x);
      glow.save();
      glow.translate(c0.x, c0.y);
      glow.scale(1, 1.3);
      glow.globalAlpha = (0.08 + 0.07 * activity) * ringIn;
      sprite(glow, buf.sprites.ring, 0, 0, rx * 2.4);
      glow.restore();
      glow.globalAlpha = 1;
    }

    // Ignition shockwave sweeping outward across the floor.
    const sh = (frame - SHOCK_START) / (SHOCK_END - SHOCK_START);
    if (sh > 0 && sh < 1) {
      const rr = 1 + 1.6 * easeOutCubic(sh);
      const a = (1 - sh) * (1 - sh);
      glow.lineWidth = 10;
      glow.strokeStyle = rgba(RING_GLOW, 0.7 * a);
      glow.beginPath();
      circlePath(glow, cam, rr, 0, 0, Math.PI * 2, 120);
      glow.stroke();
      main.lineWidth = 1.5;
      main.strokeStyle = rgba(RING, 0.5 * a);
      main.beginPath();
      circlePath(main, cam, rr, 0, 0, Math.PI * 2, 160);
      main.stroke();
    }
  }

  // Outer HUD: tick ring, thin circles and equaliser bars.
  const barsIn = smooth(BARS_START, BARS_END, frame);
  if (barsIn > 0) {
    main.globalCompositeOperation = "lighter";
    main.lineWidth = 0.9;
    main.strokeStyle = rgba(HUD, 0.35 * barsIn);
    main.beginPath();
    circlePath(main, cam, 1.42, 0, 0, Math.PI * 2, 180);
    main.stroke();
    for (let k = 0; k < 4; k++) {
      const a0 = k * (Math.PI / 2) - t * 0.18;
      main.lineWidth = 1.8;
      main.strokeStyle = rgba(HUD, 0.4 * barsIn);
      main.beginPath();
      circlePath(main, cam, 1.52, 0, a0, a0 + 0.9 * barsIn, 30);
      main.stroke();
    }
    // Ground ticks
    const ticks = 140;
    const tp = new Path2D();
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2;
      const p0 = project(cam, [Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3]);
      const p1 = project(cam, [Math.cos(a) * (i % 5 === 0 ? 1.38 : 1.34), 0, Math.sin(a) * (i % 5 === 0 ? 1.38 : 1.34)]);
      if (p0.z <= 0) continue;
      tp.moveTo(p0.x, p0.y);
      tp.lineTo(p1.x, p1.y);
    }
    main.lineWidth = 1;
    main.strokeStyle = rgba(HUD, 0.45 * barsIn);
    main.stroke(tp);

    // Equaliser bars standing around the ring, revealed in a sweep that
    // starts at the front and wraps around both sides.
    const N = 96;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      // Angular distance from the front (-z, nearest the camera).
      let d = Math.abs(((a + Math.PI / 2 + Math.PI) % (Math.PI * 2)) - Math.PI) / Math.PI;
      d = clamp(d);
      const reveal = clamp(barsIn * 1.6 - d * 0.6);
      if (reveal <= 0) continue;
      const nz = 0.5 + 0.5 * Math.sin(t * 2.6 + i * 0.83) * Math.cos(t * 1.3 + i * 0.29);
      const h = (0.05 + 0.15 * nz) * reveal;
      const r = 1.2;
      const half = 0.024;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const tx = -sa * half;
      const tz = ca * half;
      const bx = ca * r;
      const bz = sa * r;
      const q: Vec3[] = [
        [bx - tx, 0, bz - tz],
        [bx + tx, 0, bz + tz],
        [bx + tx, h, bz + tz],
        [bx - tx, h, bz - tz],
      ];
      const pp = q.map((v) => project(cam, v));
      if (pp.some((p) => p.z <= 0)) continue;
      main.beginPath();
      main.moveTo(pp[0].x, pp[0].y);
      for (let j = 1; j < 4; j++) main.lineTo(pp[j].x, pp[j].y);
      main.closePath();
      main.fillStyle = rgba(HUD, (0.22 + 0.18 * nz) * reveal);
      main.fill();
      glow.globalAlpha = 0.25 * reveal;
      glow.beginPath();
      glow.moveTo(pp[0].x, pp[0].y);
      for (let j = 1; j < 4; j++) glow.lineTo(pp[j].x, pp[j].y);
      glow.closePath();
      glow.fillStyle = rgba(HUD, 1);
      glow.fill();
      glow.globalAlpha = 1;
    }
  }

  // ---- Rising data: streaks, dots and icons ---------------------------
  main.globalCompositeOperation = "lighter";
  for (const r of data.risers) {
    const age = (frame - r.birth) / 30;
    if (age < 0) continue;
    const head = age * r.speed;
    if (head > 3.4) continue;
    const spread = 1 + 0.06 * head;
    const x = r.x * spread;
    const z = r.z * spread;
    if (r.kind === "streak") {
      const tail = Math.max(0, head - r.len);
      const ph = project(cam, [x, head, z]);
      const pm = project(cam, [x, (head + tail) / 2, z]);
      const pt = project(cam, [x, tail, z]);
      if (ph.z <= 0) continue;
      const a = smooth(0, 0.25, age) * (1 - smooth(2.4, 3.3, head)) * 0.5;
      main.lineWidth = 0.9;
      main.strokeStyle = rgba(RING, a);
      main.beginPath();
      main.moveTo(ph.x, ph.y);
      main.lineTo(pm.x, pm.y);
      main.stroke();
      main.strokeStyle = rgba(RING, a * 0.4);
      main.beginPath();
      main.moveTo(pm.x, pm.y);
      main.lineTo(pt.x, pt.y);
      main.stroke();
      main.globalAlpha = clamp(a * 2);
      sprite(main, buf.sprites.white, ph.x, ph.y, 9);
      main.globalAlpha = 1;
    } else if (r.kind === "dot") {
      const p = project(cam, [x, head, z]);
      if (p.z <= 0) continue;
      const a = smooth(0, 0.3, age) * (1 - smooth(2.2, 3.2, head)) * (0.6 + 0.4 * Math.sin(t * 3 + r.ph));
      main.globalAlpha = clamp(a);
      sprite(main, r.size > 1.6 ? buf.sprites.cool : buf.sprites.white, p.x, p.y, r.size * 7);
      main.globalAlpha = 1;
    } else {
      const y = 0.08 + head;
      const p = project(cam, [x, y, z]);
      if (p.z <= 0) continue;
      const a = smooth(0, 0.6, age) * (1 - smooth(2.3, 3.2, y)) * (0.8 + 0.2 * Math.sin(t * 2 + r.ph));
      if (a <= 0.01) continue;
      const size = (r.size * cam.focal) / p.z / 2;
      main.save();
      main.translate(p.x, p.y);
      main.scale(size, size);
      main.lineWidth = 1.5 / size;
      main.lineJoin = "round";
      main.lineCap = "round";
      main.strokeStyle = rgba(ICON, a * 0.9);
      main.fillStyle = rgba(RING_GLOW, a * 0.12);
      if (r.framed) {
        main.beginPath();
        main.arc(0, 0, 1.25, 0, Math.PI * 2);
        main.fill();
        main.strokeStyle = rgba(ICON, a * 0.45);
        main.stroke();
        main.strokeStyle = rgba(ICON, a * 0.9);
      }
      ICONS[r.icon](main);
      main.restore();
      glow.globalAlpha = a * 0.22;
      sprite(glow, buf.sprites.white, p.x, p.y, size * 2.6);
      glow.globalAlpha = 1;
    }
  }

  // ---- Foreground out-of-focus layer -----------------------------------
  blurInto(buf.softNear, buf.tmpA, 2.6);
  main.setTransform(1, 0, 0, 1, 0, 0);
  main.globalCompositeOperation = "lighter";
  main.drawImage(buf.tmpA, 0, 0, width, height);

  // ---- Bloom ------------------------------------------------------------
  blurInto(buf.glow, buf.tmpA, 3);
  main.drawImage(buf.tmpA, 0, 0, width, height);
  blurInto(buf.glow, buf.tmpB, 5);
  main.globalAlpha = 0.9;
  main.drawImage(buf.tmpB, 0, 0, width, height);
  main.globalAlpha = 1;

  // ---- Vignette ---------------------------------------------------------
  main.globalCompositeOperation = "source-over";
  main.setTransform(s, 0, 0, s, 0, 0);
  const vg = main.createRadialGradient(960, 600, 300, 960, 600, 1250);
  vg.addColorStop(0, "rgba(0,6,20,0)");
  vg.addColorStop(1, "rgba(0,6,20,0.55)");
  main.fillStyle = vg;
  main.fillRect(0, 0, BASE_WIDTH, 1080);
  main.setTransform(1, 0, 0, 1, 0, 0);
};
