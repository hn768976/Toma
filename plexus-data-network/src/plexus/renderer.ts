import type { PlexusPalette } from "./palettes";
import { labelText, type PlexusWorld, type Vec3 } from "./world";

export const MONO_FAMILY = "PlexusMono";
export const SANS_FAMILY = "PlexusSans";

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
 * Camera: a steady lateral truck to the left through the network (content
 * flows left-to-right like the reference) with a slight forward push, gentle
 * float and a breathing rack focus. Near strands sweep past faster than far
 * ones, giving strong parallax.
 */
export const cameraAt = (t: number): CameraState => ({
  x: 8 - 2.7 * t,
  y: 1.4 * Math.sin(t * 0.21 + 0.4),
  z: 1.1 * t,
  yaw: -0.06 + 0.035 * Math.sin(t * 0.13),
  pitch: 0.03 + 0.015 * Math.sin(t * 0.17),
  roll: 0.012 * Math.sin(t * 0.09 + 1.1),
  focus: 23 + 5 * Math.sin(t * 0.27 - 0.5),
});

const spriteCache = new Map<string, HTMLCanvasElement>();
const SPRITE = 256;

const makeCanvas = (size: number) => {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
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

/** Sharp glowing node: hot white core + soft coloured bloom. */
const glowSprite = (core: string, halo: string) => {
  const key = `glow|${core}|${halo}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const c = makeCanvas(SPRITE);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    SPRITE / 2,
    SPRITE / 2,
    0,
    SPRITE / 2,
    SPRITE / 2,
    SPRITE / 2,
  );
  g.addColorStop(0, core);
  g.addColorStop(0.09, core);
  g.addColorStop(0.14, withAlpha(halo, 0.8));
  g.addColorStop(0.26, withAlpha(halo, 0.32));
  g.addColorStop(0.5, withAlpha(halo, 0.09));
  g.addColorStop(1, withAlpha(halo, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SPRITE, SPRITE);
  spriteCache.set(key, c);
  return c;
};

/** Out-of-focus lens disc, soft edge. */
const bokehSprite = (color: string) => {
  const key = `bokeh|${color}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const c = makeCanvas(SPRITE);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    SPRITE / 2,
    SPRITE / 2,
    0,
    SPRITE / 2,
    SPRITE / 2,
    SPRITE / 2,
  );
  g.addColorStop(0, withAlpha(color, 0.7));
  g.addColorStop(0.4, withAlpha(color, 0.62));
  g.addColorStop(0.7, withAlpha(color, 0.4));
  g.addColorStop(0.88, withAlpha(color, 0.13));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SPRITE, SPRITE);
  spriteCache.set(key, c);
  return c;
};

/** Gaussian-like soft cloud for the nebula haze. */
const cloudSprite = (color: string) => {
  const key = `cloud|${color}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const c = makeCanvas(SPRITE);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    SPRITE / 2,
    SPRITE / 2,
    0,
    SPRITE / 2,
    SPRITE / 2,
    SPRITE / 2,
  );
  for (let i = 0; i <= 10; i++) {
    const x = i / 10;
    g.addColorStop(x, withAlpha(color, Math.exp(-x * x * 4.5) * (1 - x)));
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SPRITE, SPRITE);
  spriteCache.set(key, c);
  return c;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

type Projected = { sx: number; sy: number; z: number };
type Rect = { x: number; y: number; w: number; h: number };

const overlapFraction = (a: Rect, b: Rect) => {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return (ix * iy) / Math.max(1, a.w * a.h);
};

/**
 * Renders one frame of the plexus network into the given 2D context.
 * Sizes are authored for 1920x1080 and multiplied by `k` (2 at 4K).
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
  const FAR = 115;
  const APERTURE = 58 * k; // circle-of-confusion scale (px)

  const cyw = Math.cos(cam.yaw);
  const syw = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const cr = Math.cos(cam.roll);
  const sr = Math.sin(cam.roll);

  const toView = (p: Vec3) => {
    const x = p.x - cam.x;
    const y = p.y - cam.y;
    const z = p.z - cam.z;
    const x1 = x * cyw - z * syw;
    const z1 = x * syw + z * cyw;
    const y2 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    return { x: x1 * cr - y2 * sr, y: x1 * sr + y2 * cr, z: z2 };
  };
  const projectView = (v: { x: number; y: number; z: number }): Projected => ({
    sx: W / 2 + (v.x / v.z) * F,
    sy: H / 2 - (v.y / v.z) * F,
    z: v.z,
  });

  const coc = (z: number) =>
    clamp((APERTURE * Math.abs(z - cam.focus)) / Math.max(z, 0.5), 0, 160 * k);
  const distFade = (z: number) =>
    smoothstep(FAR, FAR - 55, z) * smoothstep(NEAR, NEAR + 3, z);
  const onScreen = (sx: number, sy: number, m: number) =>
    sx > -m && sx < W + m && sy > -m && sy < H + m;

  // ---------- Background grade ----------
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, palette.bgTop);
  bg.addColorStop(0.5, palette.bgMid);
  bg.addColorStop(1, palette.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = "screen";
  // Brighter centre / lower-centre band
  const band = ctx.createRadialGradient(
    W * 0.5,
    H * 0.72,
    0,
    W * 0.5,
    H * 0.72,
    W * 0.6,
  );
  band.addColorStop(0, palette.floorGlow);
  band.addColorStop(0.5, withAlpha(palette.floorGlow, 0.22));
  band.addColorStop(1, withAlpha(palette.floorGlow, 0));
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, H);

  // ---------- Nebula haze ----------
  const clouds = palette.nebula.map((c) => cloudSprite(c));
  for (const n of world.nebula) {
    const v = toView(n);
    if (v.z < 4) continue;
    const p = projectView(v);
    const r = (n.size * F) / v.z;
    if (!onScreen(p.sx, p.sy, r)) continue;
    ctx.globalAlpha = Math.min(1, n.alpha * 1.8 * distFade(v.z * 0.8));
    ctx.drawImage(clouds[n.color], p.sx - r, p.sy - r * 0.7, r * 2, r * 1.4);
  }

  // ---------- Bokeh ----------
  const bokehSprites = palette.bokeh.map((c) => bokehSprite(c));
  for (const b of world.bokeh) {
    const v = toView(b);
    if (v.z < NEAR) continue;
    const p = projectView(v);
    const fade = distFade(v.z);
    if (fade <= 0.001) continue;
    const blur = coc(v.z);
    const base = (b.size * 0.75 * F) / v.z;
    const r = Math.sqrt(base * base + blur * blur * 0.35) + 2 * k;
    if (!onScreen(p.sx, p.sy, r)) continue;
    ctx.globalAlpha = clamp(
      b.alpha * fade * clamp((30 * k) / r, 0.16, 0.7),
      0,
      1,
    );
    ctx.drawImage(bokehSprites[b.color], p.sx - r, p.sy - r, r * 2, r * 2);
  }

  // ---------- Dust ----------
  const dustSprite = glowSprite(palette.nodeCore, palette.nodeHalo);
  for (const d of world.dust) {
    const v = toView(d);
    if (v.z < NEAR) continue;
    const p = projectView(v);
    const blur = coc(v.z);
    const r = 3.4 * k + blur * 0.5;
    if (!onScreen(p.sx, p.sy, r)) continue;
    ctx.globalAlpha = clamp(distFade(v.z) * 0.6 * ((3.4 * k) / r) ** 2, 0, 1);
    ctx.drawImage(dustSprite, p.sx - r, p.sy - r, r * 2, r * 2);
  }

  const [lr, lg, lb] = palette.lineRgb;
  const [gr, gg, gb] = palette.lineGlowRgb;
  ctx.lineCap = "round";
  ctx.globalAlpha = 1;

  // Draws a depth-of-field line: soft halo + body + hot core, each with a
  // gradient so each end carries its own focus/fade.
  const softLine = (
    pa: Projected,
    pb: Projected,
    ia: number,
    ib: number,
    ea: number,
    eb: number,
    w: number,
    core: number,
  ) => {
    const pass = (
      width: number,
      alphaA: number,
      alphaB: number,
      rgb: [number, number, number],
      op: GlobalCompositeOperation,
    ) => {
      if (alphaA < 0.004 && alphaB < 0.004) return;
      const g = ctx.createLinearGradient(pa.sx, pa.sy, pb.sx, pb.sy);
      g.addColorStop(
        0,
        `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp(alphaA, 0, 1)})`,
      );
      g.addColorStop(
        1,
        `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp(alphaB, 0, 1)})`,
      );
      ctx.globalCompositeOperation = op;
      ctx.strokeStyle = g;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pa.sx, pa.sy);
      ctx.lineTo(pb.sx, pb.sy);
      ctx.stroke();
    };
    // Gaussian-like cross-section from five stacked strokes (wide + faint ->
    // narrow + brighter), so blurred strands have soft edges, not "tubes".
    const blurA = ia * (1 - ea);
    const blurB = ib * (1 - eb);
    const PROFILE: [number, number][] = [
      [2.4, 0.03],
      [1.7, 0.045],
      [1.15, 0.065],
      [0.72, 0.09],
      [0.38, 0.12],
    ];
    for (const [wm, am] of PROFILE) {
      pass(
        Math.max(core, w * wm),
        (blurA + ia * 0.25) * am,
        (blurB + ib * 0.25) * am,
        [gr, gg, gb],
        "screen",
      );
    }
    // Sharp core fades in continuously with focus (no threshold -> no pops).
    const coreGate = smoothstep(0.02, 0.12, Math.max(ea, eb));
    if (coreGate > 0) {
      pass(
        core * 2.4,
        ia * ea * 0.3 * coreGate,
        ib * eb * 0.3 * coreGate,
        [lr, lg, lb],
        "screen",
      );
      pass(
        core,
        ia * ea ** 0.8 * 0.95 * coreGate,
        ib * eb ** 0.8 * 0.95 * coreGate,
        [255, 255, 255],
        "source-over",
      );
    }
  };

  // ---------- Horizontal light streaks ----------
  for (const s of world.streaks) {
    const STEPS = 8;
    for (let i = 0; i < STEPS; i++) {
      const va = toView({
        x: s.x0 + ((s.x1 - s.x0) * i) / STEPS,
        y: s.y,
        z: s.z,
      });
      const vb = toView({
        x: s.x0 + ((s.x1 - s.x0) * (i + 1)) / STEPS,
        y: s.y,
        z: s.z,
      });
      if (va.z < NEAR || vb.z < NEAR) continue;
      const pa = projectView(va);
      const pb = projectView(vb);
      const blur = coc((va.z + vb.z) / 2);
      const w = 1.4 * k + blur * 0.4;
      const ta = Math.sin((Math.PI * i) / STEPS);
      const tb = Math.sin((Math.PI * (i + 1)) / STEPS);
      const base =
        s.alpha * distFade(va.z) * clamp((2.2 * k) / w, 0.15, 1) * 0.45;
      const e = clamp((2 * k) / w, 0, 1) * 0.5;
      softLine(pa, pb, base * ta, base * tb, e, e, w, 1.2 * k);
    }
  }

  // ---------- Network edges ----------
  const CORE = 2.6 * k;
  const MAXW = 60 * k;
  const views = world.nodes.map((n) => toView(n));
  for (const e of world.edges) {
    let va = views[e.a];
    let vb = views[e.b];
    if (va.z < NEAR && vb.z < NEAR) continue;
    if (va.z > FAR && vb.z > FAR) continue;
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
    const pa0 = projectView(va);
    const pb0 = projectView(vb);
    const minX = Math.min(pa0.sx, pb0.sx);
    const maxX = Math.max(pa0.sx, pb0.sx);
    const minY = Math.min(pa0.sy, pb0.sy);
    const maxY = Math.max(pa0.sy, pb0.sy);
    // Generous margin: blurred strands are wide, so cull only when even the
    // outer halo cannot reach the frame.
    const M = 320 * k;
    if (maxX < -M || minX > W + M || maxY < -M || minY > H + M) continue;

    // Subdivide so the blur width follows depth along the line (true DOF:
    // the near end of a strand is soft and wide, the far end crisp).
    // Segment count depends only on the (static) 3D edge length, never on
    // time-varying focus, so a line can never re-tessellate between frames.
    const n0 = world.nodes[e.a];
    const n1 = world.nodes[e.b];
    const len3 = Math.hypot(n1.x - n0.x, n1.y - n0.y, n1.z - n0.z);
    const segs = Math.min(10, Math.max(2, Math.ceil(len3 / 5)));
    const at = (u: number) => {
      const v = {
        x: va.x + (vb.x - va.x) * u,
        y: va.y + (vb.y - va.y) * u,
        z: va.z + (vb.z - va.z) * u,
      };
      const c = coc(v.z);
      const eFocus = clamp(CORE / (CORE + c * 0.3), 0, 1);
      // Lines are bright where they are in focus, faint soft light elsewhere.
      const inten = e.strength * distFade(v.z) * (0.14 + 0.86 * eFocus ** 0.75);
      return { p: projectView(v), c, eFocus, inten };
    };
    let prev = at(0);
    for (let si = 1; si <= segs; si++) {
      const cur = at(si / segs);
      if (prev.inten > 0.008 || cur.inten > 0.008) {
        const w = Math.min(MAXW, CORE + ((prev.c + cur.c) / 2) * 0.55);
        softLine(
          prev.p,
          cur.p,
          prev.inten,
          cur.inten,
          prev.eFocus,
          cur.eFocus,
          w,
          CORE,
        );
      }
      prev = cur;
    }
  }

  // ---------- Nodes ----------
  ctx.globalCompositeOperation = "screen";
  const nodeGlow = glowSprite(palette.nodeCore, palette.nodeHalo);
  const nodeBokeh = bokehSprite(palette.bokeh[3]);
  type LabelJob = {
    x: number;
    y: number;
    size: number;
    alpha: number;
    text: string;
    boxed: boolean;
    side: number;
    prio: number;
  };
  const labelJobs: LabelJob[] = [];
  world.nodes.forEach((n, i) => {
    const v = views[i];
    if (v.z < NEAR) return;
    // Stable (time-independent) label priority so overlapping labels never swap.
    const p = projectView(v);
    const fade = distFade(v.z);
    if (fade <= 0.001) return;
    const blur = coc(v.z);
    const sharpR = clamp(((n.hub ? 0.75 : 0.32) * F) / v.z, 2.6 * k, 60 * k);
    const R = Math.sqrt(sharpR * sharpR + blur * blur * 0.4);
    const glowR = sharpR * (n.hub ? 6.5 : 4.4);
    // Sprites are culled tightly, labels with a wide margin so text that
    // trails off-screen slides in smoothly instead of popping at the edge.
    const spritesVisible = onScreen(p.sx, p.sy, Math.max(R, glowR));
    if (!spritesVisible && !onScreen(p.sx, p.sy, 520 * k)) return;
    const sharpness = (sharpR / R) ** 2;
    if (spritesVisible) {
      const tw = 0.92 + 0.08 * Math.sin(t * 2.1 + i * 1.7);
      const bright = n.brightness * fade * tw;
      ctx.globalAlpha = clamp(bright * sharpness ** 0.7 * 1.2, 0, 1);
      ctx.drawImage(nodeGlow, p.sx - glowR, p.sy - glowR, glowR * 2, glowR * 2);
      if (n.hub) {
        // extra hot, blown-out centre on in-focus hubs (additive -> pure white)
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = clamp(bright * sharpness * 0.9, 0, 1);
        ctx.drawImage(
          nodeGlow,
          p.sx - glowR * 0.6,
          p.sy - glowR * 0.6,
          glowR * 1.2,
          glowR * 1.2,
        );
        ctx.globalCompositeOperation = "screen";
      }
      const discAmt = smoothstep(0.97, 0.75, sharpness); // continuous, no threshold pop
      if (discAmt > 0) {
        // Defocused: blown-out glowing blob (brighter when in front of focus;
        // the switch happens at sharpness 1, where discAmt is 0)
        const nearBoost = v.z < cam.focus ? 1.4 : 0.55;
        ctx.globalAlpha = clamp(
          discAmt *
            bright *
            nearBoost *
            (1 - sharpness) *
            clamp((36 * k) / R, 0.16, 0.8),
          0,
          1,
        );
        ctx.drawImage(nodeBokeh, p.sx - R, p.sy - R, R * 2, R * 2);
      }
    }
    if (n.label) {
      const la = Math.min(1, fade * 1.4 * (1 / (1 + (blur / (16 * k)) ** 2)));
      if (la > 0.03) {
        labelJobs.push({
          x: p.sx + n.labelSide * (sharpR + 8 * k),
          y: p.sy + sharpR * 0.6 + 6 * k,
          size: clamp((26 * k * 25) / v.z, 15 * k, 38 * k),
          alpha: la,
          text: labelText(n.label, t),
          boxed: n.label.boxed,
          side: n.labelSide,
          prio: 1e6 - i,
        });
      }
    }
  });

  // ---------- Vignette (before text so readouts stay crisp) ----------
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const vg = ctx.createRadialGradient(
    W / 2,
    H * 0.6,
    H * 0.3,
    W / 2,
    H * 0.6,
    W * 0.72,
  );
  vg.addColorStop(0, withAlpha(palette.vignette, 0));
  vg.addColorStop(1, withAlpha(palette.vignette, 0.85));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // ---------- Text ----------
  ctx.textBaseline = "top";
  const [tr, tg, tb] = palette.labelRgb;

  world.freeLabels.forEach((fl, fi) => {
    const v = toView(fl);
    if (v.z < NEAR + 2) return;
    const p = projectView(v);
    if (!onScreen(p.sx, p.sy, 520 * k)) return;
    const blur = coc(v.z);
    const la = Math.min(
      1,
      distFade(v.z) * 1.3 * (1 / (1 + (blur / (16 * k)) ** 2)),
    );
    if (la < 0.03) return;
    labelJobs.push({
      x: p.sx,
      y: p.sy,
      size: clamp((22 * k * 25) / v.z, 14 * k, 32 * k),
      alpha: la,
      text: labelText(fl.label, t),
      boxed: fl.label.boxed,
      side: 1,
      prio: -fi,
    });
  });

  // Code columns: dense rows of short readouts and bars
  const codeRects: (Rect & { weight: number })[] = [];
  for (const cb of world.codeBlocks) {
    const v = toView(cb);
    if (v.z < NEAR + 2) continue;
    const p = projectView(v);
    if (!onScreen(p.sx, p.sy, 520 * k)) continue;
    const blur = coc(v.z);
    const a = Math.min(
      0.95,
      distFade(v.z) * 1.3 * (1 / (1 + (blur / (14 * k)) ** 2)),
    );
    if (a < 0.03) continue;
    const size = clamp((9 * k * 25) / v.z, 7 * k, 17 * k);
    const lh = size * 1.18;
    codeRects.push({
      x: p.sx - size,
      y: p.sy,
      w: size * 7,
      h: cb.rows.length * lh,
      weight: smoothstep(0.05, 0.4, a),
    });
    ctx.font = `500 ${size}px ${MONO_FAMILY}`;
    ctx.fillStyle = `rgb(${tr}, ${tg}, ${tb})`;
    ctx.globalAlpha = a * 0.9;
    ctx.fillRect(
      p.sx - size * 0.7,
      p.sy,
      Math.max(1, size * 0.14),
      cb.rows.length * lh,
    );
    cb.rows.forEach((row, li) => {
      ctx.globalAlpha = a * row.alpha;
      if (row.text) {
        ctx.fillText(row.text, p.sx, p.sy + li * lh);
      } else {
        ctx.fillRect(
          p.sx,
          p.sy + li * lh + size * 0.3,
          size * 6 * row.bar,
          size * 0.42,
        );
      }
    });
  }

  // Labels, with soft overlap suppression (continuous, so nothing pops)
  labelJobs.sort((a, b) => b.prio - a.prio);
  const placed: (Rect & { weight: number })[] = [...codeRects];
  for (const job of labelJobs) {
    ctx.font = `600 ${job.size}px ${SANS_FAMILY}`;
    const tw = ctx.measureText(job.text).width;
    const x = job.side > 0 ? job.x : job.x - tw;
    const padX = job.size * 0.3;
    const padY = job.size * 0.12;
    const rect = {
      x: x - padX,
      y: job.y - padY,
      w: tw + padX * 2,
      h: job.size * 1.05 + padY * 2,
    };
    let ov = 0;
    // Overlap is weighted by how visible the other element is, so the
    // suppression changes continuously as things fade in and out.
    for (const r of placed)
      ov = Math.max(ov, overlapFraction(rect, r) * r.weight);
    const alpha = job.alpha * clamp(1 - ov * 4, 0, 1);
    if (alpha < 0.02) continue;
    placed.push({ ...rect, weight: clamp(alpha * 1.5, 0, 1) });
    ctx.globalAlpha = alpha;
    // Boxes only appear once the label is reasonably in focus; a soft
    // label shows as plain white text instead of a faint grey box.
    const boxAmt = job.boxed ? smoothstep(0.45, 0.85, job.alpha) : 0;
    if (boxAmt > 0) {
      ctx.globalAlpha = alpha * boxAmt;
      ctx.fillStyle = palette.boxFill;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = palette.boxText;
      ctx.fillText(job.text, x, job.y);
    }
    if (boxAmt < 1) {
      ctx.globalAlpha = alpha * (1 - boxAmt);
      ctx.shadowColor = `rgba(${gr}, ${gg}, ${gb}, 0.9)`;
      ctx.shadowBlur = 6 * k;
      ctx.fillStyle = `rgb(${tr}, ${tg}, ${tb})`;
      ctx.fillText(job.text, x, job.y);
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    }
  }
  ctx.globalAlpha = 1;
};
