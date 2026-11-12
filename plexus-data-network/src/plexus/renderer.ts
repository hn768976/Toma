import type { PlexusPalette } from "./palettes";
import type { PlexusWorld, Vec3 } from "./world";

export const FONT_FAMILY = "PlexusMono";

export type CameraState = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  focus: number;
};

/**
 * Version 1 camera: a slow forward fly-through with gentle lateral drift,
 * yaw and a breathing rack-focus, like the reference's floating camera.
 */
export const cameraAt = (t: number): CameraState => ({
  x: 9 * Math.sin(t * 0.11) + 0.55 * t - 4,
  y: 1.6 * Math.sin(t * 0.17 + 0.4),
  z: 3.5 * t,
  yaw: 0.13 * Math.sin(t * 0.09 + 0.3) - 0.03,
  pitch: 0.035 + 0.02 * Math.sin(t * 0.13),
  roll: 0.018 * Math.sin(t * 0.07 + 1.1),
  focus: 27 + 7 * Math.sin(t * 0.23 - 0.6),
});

const spriteCache = new Map<string, HTMLCanvasElement>();
const SPRITE = 256;

const makeCanvas = (size: number) => {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return c;
};

/** Sharp glowing node: white core + coloured halo. */
const glowSprite = (core: string, halo: string) => {
  const key = `glow|${core}|${halo}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const c = makeCanvas(SPRITE);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
  g.addColorStop(0, core);
  g.addColorStop(0.1, core);
  g.addColorStop(0.16, withAlpha(halo, 0.75));
  g.addColorStop(0.3, withAlpha(halo, 0.28));
  g.addColorStop(0.6, withAlpha(halo, 0.07));
  g.addColorStop(1, withAlpha(halo, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SPRITE, SPRITE);
  spriteCache.set(key, c);
  return c;
};

/** Out-of-focus disc with a soft edge and a slightly brighter rim (lens bokeh). */
const bokehSprite = (color: string) => {
  const key = `bokeh|${color}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const c = makeCanvas(SPRITE);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
  g.addColorStop(0, withAlpha(color, 0.62));
  g.addColorStop(0.45, withAlpha(color, 0.58));
  g.addColorStop(0.72, withAlpha(color, 0.42));
  g.addColorStop(0.88, withAlpha(color, 0.14));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SPRITE, SPRITE);
  spriteCache.set(key, c);
  return c;
};

const withAlpha = (hex: string, a: number) => {
  if (hex.startsWith("rgba")) {
    return hex.replace(/,\s*[\d.]+\)$/, `, ${a})`);
  }
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

type Projected = { sx: number; sy: number; z: number; ok: boolean };

/**
 * Renders one frame of the plexus network into the given 2D context.
 * All sizes are authored for 1920x1080 and multiplied by `k` (2 at 4K).
 */
export const drawPlexusFrame = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  world: PlexusWorld,
  palette: PlexusPalette,
  cam: CameraState,
  t: number,
) => {
  const k = W / 1920;
  const F = W * 0.72; // focal length in px
  const NEAR = 0.9;
  const FAR = 135;
  const APERTURE = 62 * k; // circle-of-confusion scale (px)

  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const cr = Math.cos(cam.roll);
  const sr = Math.sin(cam.roll);

  const toView = (p: Vec3) => {
    let x = p.x - cam.x;
    let y = p.y - cam.y;
    let z = p.z - cam.z;
    // yaw (around Y)
    const x1 = x * cy - z * sy;
    const z1 = x * sy + z * cy;
    // pitch (around X)
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    x = x1;
    y = y2;
    z = z2;
    // roll (around Z)
    const x3 = x * cr - y * sr;
    const y3 = x * sr + y * cr;
    return { x: x3, y: y3, z };
  };

  const projectView = (v: { x: number; y: number; z: number }): Projected => ({
    sx: W / 2 + (v.x / v.z) * F,
    sy: H / 2 - (v.y / v.z) * F,
    z: v.z,
    ok: v.z > NEAR,
  });

  const coc = (z: number) => clamp((APERTURE * Math.abs(z - cam.focus)) / Math.max(z, 0.5), 0, 210 * k);
  const distFade = (z: number) => smoothstep(FAR, FAR - 55, z) * smoothstep(NEAR, NEAR + 2.5, z);
  const onScreen = (sx: number, syy: number, m: number) => sx > -m && sx < W + m && syy > -m && syy < H + m;

  // ---------- Background ----------
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, palette.bgTop);
  bg.addColorStop(0.45, palette.bgMid);
  bg.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Breathing floor glow (bottom centre), drifts subtly with the camera yaw.
  const glowX = W * (0.5 - cam.yaw * 0.8);
  const fg = ctx.createRadialGradient(glowX, H * 1.02, 0, glowX, H * 1.02, W * 0.62);
  fg.addColorStop(0, palette.floorGlow);
  fg.addColorStop(0.55, withAlpha(palette.floorGlow, 0.18));
  fg.addColorStop(1, withAlpha(palette.floorGlow, 0));
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = fg;
  ctx.fillRect(0, 0, W, H);

  // ---------- Bokeh floor ----------
  const bokehSprites = palette.bokeh.map((c) => bokehSprite(c));
  for (const b of world.bokeh) {
    const v = toView(b);
    if (v.z < NEAR) continue;
    const p = projectView(v);
    const fade = distFade(v.z);
    if (fade <= 0.001) continue;
    const blur = coc(v.z);
    const base = (b.size * 0.55 * F) / v.z;
    const r = Math.sqrt(base * base + blur * blur * 0.5) + 2 * k;
    if (!onScreen(p.sx, p.sy, r)) continue;
    const a = clamp(b.alpha * fade * clamp((26 * k) / r, 0.12, 0.6), 0, 1);
    ctx.globalAlpha = a;
    ctx.drawImage(bokehSprites[b.color], p.sx - r, p.sy - r, r * 2, r * 2);
  }

  // ---------- Dust specks ----------
  const dustSprite = glowSprite(palette.nodeCore, palette.nodeHalo);
  for (const d of world.dust) {
    const v = toView(d);
    if (v.z < NEAR) continue;
    const p = projectView(v);
    const fade = distFade(v.z);
    const blur = coc(v.z);
    const r = 3.2 * k + blur * 0.6;
    if (!onScreen(p.sx, p.sy, r)) continue;
    ctx.globalAlpha = clamp(fade * 0.55 * ((3.2 * k) / r) ** 2, 0, 1);
    ctx.drawImage(dustSprite, p.sx - r, p.sy - r, r * 2, r * 2);
  }

  // ---------- Horizontal light streaks ----------
  ctx.lineCap = "round";
  const [lr, lg, lb] = palette.lineRgb;
  const [gr, gg, gb] = palette.lineGlowRgb;
  for (const s of world.streaks) {
    const STEPS = 6;
    for (let i = 0; i < STEPS; i++) {
      const xa = s.x0 + ((s.x1 - s.x0) * i) / STEPS;
      const xb = s.x0 + ((s.x1 - s.x0) * (i + 1)) / STEPS;
      const va = toView({ x: xa, y: s.y, z: s.z });
      const vb = toView({ x: xb, y: s.y, z: s.z });
      if (va.z < NEAR || vb.z < NEAR) continue;
      const pa = projectView(va);
      const pb = projectView(vb);
      const zAvg = (va.z + vb.z) / 2;
      const blur = coc(zAvg);
      const w = 1.0 * k + blur * 0.35;
      const tEdge = Math.sin((Math.PI * (i + 0.5)) / STEPS);
      const a = s.alpha * distFade(zAvg) * tEdge * clamp((1.6 * k) / w, 0.08, 1) * 0.5;
      if (a < 0.004) continue;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = `rgba(${lr}, ${lg}, ${lb}, ${a})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(pa.sx, pa.sy);
      ctx.lineTo(pb.sx, pb.sy);
      ctx.stroke();
    }
  }

  // ---------- Network edges ----------
  const views = world.nodes.map((n) => toView(n));
  for (const e of world.edges) {
    let va = views[e.a];
    let vb = views[e.b];
    if (va.z < NEAR && vb.z < NEAR) continue;
    if (va.z > FAR && vb.z > FAR) continue;
    // Near-plane clipping
    if (va.z < NEAR || vb.z < NEAR) {
      const [inside, outside] = va.z >= NEAR ? [va, vb] : [vb, va];
      const tt = (inside.z - NEAR) / (inside.z - outside.z);
      const clipped = {
        x: inside.x + (outside.x - inside.x) * tt,
        y: inside.y + (outside.y - inside.y) * tt,
        z: NEAR,
      };
      if (va.z >= NEAR) vb = clipped;
      else va = clipped;
    }
    const pa = projectView(va);
    const pb = projectView(vb);
    // Cull lines fully off screen (cheap bbox test)
    const minX = Math.min(pa.sx, pb.sx);
    const maxX = Math.max(pa.sx, pb.sx);
    const minY = Math.min(pa.sy, pb.sy);
    const maxY = Math.max(pa.sy, pb.sy);
    if (maxX < -50 || minX > W + 50 || maxY < -50 || minY > H + 50) continue;

    const ca = coc(va.z);
    const cb = coc(vb.z);
    const fa = distFade(va.z);
    const fb = distFade(vb.z);
    const wAvg = 1.3 * k + ((ca + cb) / 2) * 0.2;
    const aa = e.strength * fa * clamp((1.7 * k) / (1.3 * k + ca * 0.3), 0.035, 1);
    const ab = e.strength * fb * clamp((1.7 * k) / (1.3 * k + cb * 0.3), 0.035, 1);
    if (aa < 0.01 && ab < 0.01) continue;

    // Glow pass
    const gGrad = ctx.createLinearGradient(pa.sx, pa.sy, pb.sx, pb.sy);
    gGrad.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, ${aa * 0.16})`);
    gGrad.addColorStop(1, `rgba(${gr}, ${gg}, ${gb}, ${ab * 0.16})`);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = gGrad;
    ctx.lineWidth = wAvg * 4.5;
    ctx.beginPath();
    ctx.moveTo(pa.sx, pa.sy);
    ctx.lineTo(pb.sx, pb.sy);
    ctx.stroke();

    // Core pass (normal blending keeps the lines white-blue instead of
    // saturating to cyan on the bright background)
    ctx.globalCompositeOperation = "source-over";
    const cGrad = ctx.createLinearGradient(pa.sx, pa.sy, pb.sx, pb.sy);
    cGrad.addColorStop(0, `rgba(${lr}, ${lg}, ${lb}, ${aa * 0.8})`);
    cGrad.addColorStop(1, `rgba(${lr}, ${lg}, ${lb}, ${ab * 0.8})`);
    ctx.strokeStyle = cGrad;
    ctx.lineWidth = wAvg;
    ctx.beginPath();
    ctx.moveTo(pa.sx, pa.sy);
    ctx.lineTo(pb.sx, pb.sy);
    ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
  }

  // ---------- Nodes ----------
  const nodeGlow = glowSprite(palette.nodeCore, palette.nodeHalo);
  const nodeBokeh = bokehSprite(palette.bokeh[5]);
  type LabelJob = { x: number; y: number; size: number; alpha: number; text: string; boxed: boolean; side: number };
  const labelJobs: LabelJob[] = [];
  world.nodes.forEach((n, i) => {
    const v = views[i];
    if (v.z < NEAR) return;
    const p = projectView(v);
    const fade = distFade(v.z);
    if (fade <= 0.001) return;
    const blur = coc(v.z);
    const sharpR = clamp(((n.hub ? 0.5 : 0.3) * F) / v.z, 2 * k, 46 * k);
    const R = Math.sqrt(sharpR * sharpR + blur * blur * 0.45);
    const glowR = sharpR * 4.2;
    if (!onScreen(p.sx, p.sy, Math.max(R, glowR))) return;
    const sharpness = (sharpR / R) ** 2;
    // Twinkle: tiny brightness shimmer (smooth, low amplitude -> no flicker)
    const tw = 0.9 + 0.1 * Math.sin(t * 2.1 + i * 1.7);
    const bright = n.brightness * fade * tw;
    // In-focus glow
    ctx.globalAlpha = clamp(bright * sharpness ** 0.8 * 1.15, 0, 1);
    ctx.drawImage(nodeGlow, p.sx - glowR, p.sy - glowR, glowR * 2, glowR * 2);
    // Defocused disc
    if (sharpness < 0.85) {
      ctx.globalAlpha = clamp(bright * (1 - sharpness) * clamp((24 * k) / R, 0.1, 0.6), 0, 1);
      ctx.drawImage(nodeBokeh, p.sx - R, p.sy - R, R * 2, R * 2);
    }
    if (n.label) {
      const la = Math.min(1, fade * 1.2 * (1 / (1 + (blur / (11 * k)) ** 2)));
      if (la > 0.03) {
        labelJobs.push({
          x: p.sx + n.labelSide * (sharpR + 7 * k),
          y: p.sy + sharpR + 10 * k,
          size: clamp((21 * k * 30) / v.z, 13 * k, 36 * k),
          alpha: la,
          text: n.label,
          boxed: n.boxed,
          side: n.labelSide,
        });
      }
    }
  });

  // ---------- Text: free labels + code readouts ----------
  ctx.globalCompositeOperation = "source-over";
  ctx.textBaseline = "top";
  const [tr, tg, tb] = palette.labelRgb;

  for (const fl of world.freeLabels) {
    const v = toView(fl);
    if (v.z < NEAR + 1) continue;
    const p = projectView(v);
    if (!onScreen(p.sx, p.sy, 100 * k)) continue;
    const blur = coc(v.z);
    const la = Math.min(1, distFade(v.z) * 1.1 * (1 / (1 + (blur / (11 * k)) ** 2)));
    if (la < 0.03) continue;
    labelJobs.push({
      x: p.sx,
      y: p.sy,
      size: clamp((18 * k * 30) / v.z, 12 * k, 32 * k),
      alpha: la,
      text: fl.text,
      boxed: fl.boxed,
      side: 1,
    });
  }

  for (const job of labelJobs) {
    ctx.font = `500 ${job.size}px ${FONT_FAMILY}`;
    const tw = ctx.measureText(job.text).width;
    const x = job.side > 0 ? job.x : job.x - tw;
    if (job.boxed) {
      const padX = job.size * 0.35;
      const padY = job.size * 0.2;
      ctx.globalAlpha = job.alpha;
      ctx.fillStyle = palette.boxFill;
      ctx.fillRect(x - padX, job.y - padY, tw + padX * 2, job.size * 1.15 + padY * 2);
      ctx.fillStyle = palette.boxText;
      ctx.fillText(job.text, x, job.y + job.size * 0.05);
    } else {
      ctx.globalAlpha = job.alpha;
      ctx.fillStyle = `rgb(${tr}, ${tg}, ${tb})`;
      ctx.fillText(job.text, x, job.y);
    }
  }

  for (const cb of world.codeBlocks) {
    const v = toView(cb);
    if (v.z < NEAR + 1) continue;
    const p = projectView(v);
    if (!onScreen(p.sx, p.sy, 200 * k)) continue;
    const blur = coc(v.z);
    const a = Math.min(0.95, distFade(v.z) * 1.0 * (1 / (1 + (blur / (10 * k)) ** 2)));
    if (a < 0.03) continue;
    const size = clamp((9 * k * 30) / v.z, 6 * k, 18 * k);
    ctx.font = `500 ${size}px ${FONT_FAMILY}`;
    ctx.globalAlpha = a;
    ctx.fillStyle = `rgb(${tr}, ${tg}, ${tb})`;
    // A thin vertical tick bar, then the readout lines
    ctx.fillRect(p.sx - size * 0.6, p.sy, Math.max(1, size * 0.12), cb.lines.length * size * 1.25);
    cb.lines.forEach((line, li) => {
      ctx.globalAlpha = a * (0.55 + 0.45 * cb.widths[li]);
      ctx.fillText(line, p.sx, p.sy + li * size * 1.25);
    });
  }

  // ---------- Vignette ----------
  ctx.globalAlpha = 1;
  const vg = ctx.createRadialGradient(W / 2, H * 0.62, H * 0.45, W / 2, H * 0.62, W * 0.78);
  vg.addColorStop(0, withAlpha(palette.vignette, 0));
  vg.addColorStop(1, withAlpha(palette.vignette, 0.7));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  // Darker top band like the reference
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.35);
  top.addColorStop(0, withAlpha(palette.vignette, 0.55));
  top.addColorStop(1, withAlpha(palette.vignette, 0));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.35);
};
