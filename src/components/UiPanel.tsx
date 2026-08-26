import {useLayoutEffect, useMemo} from 'react';
import {ICON_STRIP, type PanelSpec} from '../config';
import {activeFlickers, ringBase, type FlickerEvent} from '../flicker';
import {MONO, SANS} from '../fonts';
import {
  closedSine,
  ctxOf,
  makeCanvas,
  rgba,
  rint,
  roundedRect,
  rpick,
  rrange,
} from '../lib/draw';
import {compose, setMat, translate} from '../lib/mat';
import {resetCtx, type LayersRef} from '../layers';
import {frameMatrix, type Scene} from '../scene';
import {THEMES, type Theme} from '../theme';

/** Padding around each sprite so the border glow is not clipped. */
const PAD = 90;

const DIGITS = '0123456789';

type RowMeta = {x: number; y: number; w: number; h: number};
type RingMeta = {cx: number; cy: number; r: number; seed: string; freq: number};

type PanelMeta = {
  rows: RowMeta[];
  rings: RingMeta[];
  bars: RowMeta[];
};

type BuiltPanel = {
  canvas: HTMLCanvasElement;
  meta: PanelMeta;
};

/* --------------------------------------------------------------- chrome */

const drawShell = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  w: number,
  h: number
): number => {
  const radius = Math.min(w, h) * 0.1;

  ctx.save();
  roundedRect(ctx, 0, 0, w, h, radius);
  ctx.fillStyle = rgba(theme.panelFill, 0.74);
  ctx.fill();

  // Thin bright border with a generous outward glow.
  ctx.shadowColor = rgba(theme.panelBorder, 0.85);
  ctx.shadowBlur = 34;
  ctx.strokeStyle = rgba(theme.panelBorder, 0.92);
  ctx.lineWidth = 3.4;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Inner hairline for a little edge thickness.
  roundedRect(ctx, 5.5, 5.5, w - 11, h - 11, radius - 4);
  ctx.strokeStyle = rgba(theme.panelBorder, 0.2);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  return radius;
};

const drawTitleBar = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  w: number,
  seed: string
): number => {
  const barH = 46;
  ctx.strokeStyle = rgba(theme.panelBorder, 0.32);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(16, barH);
  ctx.lineTo(w - 16, barH);
  ctx.stroke();

  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(34 + i * 26, barH / 2, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = rgba(theme.panelBorder, 0.4 + i * 0.14);
    ctx.fill();
  }

  // Short title stub, deliberately unreadable.
  roundedRect(ctx, 122, barH / 2 - 6, rrange(`${seed}-title`, 70, 150), 12, 6);
  ctx.fillStyle = rgba(theme.textWhite, 0.28);
  ctx.fill();

  return barH;
};

/* ---------------------------------------------------------------- kinds */

const buildCode = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  spec: PanelSpec,
  meta: PanelMeta
): void => {
  const {w, h} = spec;
  const top = drawTitleBar(ctx, theme, w, spec.id) + 26;
  const rowH = 26;
  const gutter = 34;
  const rows = Math.floor((h - top - 22) / rowH);

  for (let r = 0; r < rows; r++) {
    const y = top + r * rowH;
    const seed = `${spec.id}-row-${r}`;
    meta.rows.push({x: gutter, y, w: w - gutter - 26, h: rowH});

    // Line number gutter.
    roundedRect(ctx, 16, y + 7, 12, 5, 2.5);
    ctx.fillStyle = rgba(theme.panelBorder, 0.3);
    ctx.fill();

    let x = gutter + rrange(`${seed}-in`, 0, 3) * 22;
    const tokens = rint(`${seed}-n`, 2, 5);
    for (let t = 0; t < tokens; t++) {
      const tw = rrange(`${seed}-w${t}`, 26, 128);
      if (x + tw > w - 26) break;
      // Syntax colour: mostly cool panel tints, with the accent used sparingly.
      const roll = rrange(`${seed}-c${t}`, 0, 1);
      const colour =
        roll > 0.86
          ? rgba(theme.codeAccent, 0.9)
          : roll > 0.6
            ? rgba(theme.textWhite, 0.5)
            : rgba(theme.panelBorder, 0.42 + roll * 0.3);
      roundedRect(ctx, x, y + 6, tw, 8, 4);
      ctx.fillStyle = colour;
      ctx.fill();
      x += tw + rrange(`${seed}-g${t}`, 10, 26);
    }
  }
};

const buildRobot = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  spec: PanelSpec
): void => {
  const {w, h} = spec;
  const cx = w / 2;
  const cy = h / 2 - h * 0.02;
  const hw = w * 0.29; // head half-width
  const hh = h * 0.235; // head half-height
  const bright = rgba(theme.textWhite, 0.95);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  /* ---- antenna ------------------------------------------------------- */
  ctx.shadowColor = rgba(theme.panelBorder, 0.9);
  ctx.shadowBlur = 34;
  ctx.strokeStyle = bright;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh - 52);
  ctx.lineTo(cx, cy - hh + 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy - hh - 64, 15, 0, Math.PI * 2);
  ctx.fillStyle = bright;
  ctx.fill();

  /* ---- ears ---------------------------------------------------------- */
  // Small tabs tucked behind the head on both sides.
  const earW = 20;
  const earH = hh * 0.52;
  for (const side of [-1, 1]) {
    roundedRect(ctx, cx + side * (hw + earW * 0.35) - earW / 2, cy - earH / 2, earW, earH, earW / 2);
    ctx.fillStyle = rgba(theme.textWhite, 0.8);
    ctx.fill();
  }

  /* ---- head ---------------------------------------------------------- */
  // Generous corner radius: a soft, friendly capsule rather than a box.
  roundedRect(ctx, cx - hw, cy - hh, hw * 2, hh * 2, hh * 0.52);
  ctx.fillStyle = rgba(theme.panelFill, 0.85);
  ctx.fill();
  ctx.strokeStyle = bright;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  /* ---- visor --------------------------------------------------------- */
  // A single darker plate carrying both eyes, which is what stops the face
  // reading as two loose dots on a blank panel.
  const visorW = hw * 1.42;
  const visorH = hh * 0.86;
  roundedRect(ctx, cx - visorW / 2, cy - hh * 0.62, visorW, visorH, visorH * 0.46);
  ctx.fillStyle = rgba(theme.panelBorder, 0.16);
  ctx.fill();
  ctx.strokeStyle = rgba(theme.textWhite, 0.32);
  ctx.lineWidth = 3;
  ctx.stroke();

  /* ---- eyes ---------------------------------------------------------- */
  const eyeR = hh * 0.2;
  ctx.shadowColor = rgba(theme.panelBorder, 0.95);
  ctx.shadowBlur = 22;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * hw * 0.44, cy - hh * 0.19, eyeR, eyeR * 1.06, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(theme.textWhite, 0.98);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  /* ---- smile --------------------------------------------------------- */
  ctx.strokeStyle = rgba(theme.textWhite, 0.85);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx - hw * 0.28, cy + hh * 0.36);
  ctx.quadraticCurveTo(cx, cy + hh * 0.72, cx + hw * 0.28, cy + hh * 0.36);
  ctx.stroke();

  /* ---- chin indicator ------------------------------------------------ */
  // Sits half over the head's bottom edge. Deliberately a mark rather than
  // lettering: the chip already carries the only word in the piece, and a
  // second one here just competes with it.
  const badgeR = hh * 0.28;
  ctx.beginPath();
  ctx.arc(cx, cy + hh, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = rgba(theme.panelFill, 0.98);
  ctx.fill();
  ctx.shadowColor = rgba(theme.panelBorder, 0.9);
  ctx.shadowBlur = 20;
  ctx.strokeStyle = bright;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(cx, cy + hh, badgeR * 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(theme.textWhite, 0.7);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy + hh, badgeR * 0.17, 0, Math.PI * 2);
  ctx.fillStyle = rgba(theme.textWhite, 0.95);
  ctx.fill();
  ctx.restore();

  // Caption stub under the icon.
  roundedRect(ctx, cx - 90, h - 62, 180, 13, 6.5);
  ctx.fillStyle = rgba(theme.textWhite, 0.32);
  ctx.fill();
};

const buildDashboard = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  spec: PanelSpec,
  meta: PanelMeta
): void => {
  const {w, h} = spec;
  const top = drawTitleBar(ctx, theme, w, spec.id) + 34;

  // Two ring charts. Only the track is baked — the value arc is drawn per frame.
  const r = Math.min(w * 0.15, 78);
  for (let i = 0; i < 2; i++) {
    const cx = w * (0.28 + i * 0.44);
    const cy = top + r + 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(theme.panelBorder, 0.2);
    ctx.lineWidth = 13;
    ctx.stroke();
    meta.rings.push({
      cx,
      cy,
      r,
      seed: `${spec.id}-ring-${i}`,
      freq: rint(`${spec.id}-ringf-${i}`, 1, 3),
    });
  }

  // Bar rows below.
  const barTop = top + r * 2 + 46;
  const rowH = 34;
  const count = Math.max(1, Math.floor((h - barTop - 20) / rowH));
  for (let i = 0; i < count; i++) {
    const y = barTop + i * rowH;
    roundedRect(ctx, 30, y, w - 60, 14, 7);
    ctx.fillStyle = rgba(theme.panelBorder, 0.16);
    ctx.fill();
    meta.bars.push({x: 30, y, w: w - 60, h: 14});
  }
};

const buildList = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  spec: PanelSpec,
  meta: PanelMeta
): void => {
  const {w, h} = spec;
  const top = drawTitleBar(ctx, theme, w, spec.id) + 24;
  const rowH = 46;
  const count = Math.max(1, Math.floor((h - top - 16) / rowH));

  for (let i = 0; i < count; i++) {
    const y = top + i * rowH;
    const seed = `${spec.id}-li-${i}`;
    ctx.beginPath();
    ctx.arc(38, y + 12, 8, 0, Math.PI * 2);
    ctx.fillStyle = rgba(theme.panelBorder, 0.75);
    ctx.fill();

    roundedRect(ctx, 62, y + 5, rrange(`${seed}-w`, w * 0.32, w * 0.66), 14, 7);
    ctx.fillStyle = rgba(theme.textWhite, 0.42);
    ctx.fill();

    roundedRect(ctx, w - 92, y + 6, 58, 11, 5.5);
    ctx.fillStyle = rgba(theme.panelBorder, 0.35);
    ctx.fill();

    meta.rows.push({x: 30, y, w: w - 60, h: rowH - 8});
  }
};

const buildGlyph = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  spec: PanelSpec
): void => {
  const {w, h} = spec;
  ctx.save();
  ctx.shadowColor = rgba(theme.panelBorder, 0.9);
  ctx.shadowBlur = 30;
  ctx.font = `700 ${Math.round(h * 0.36)}px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(theme.textWhite, 0.94);
  ctx.fillText('</>', w / 2, h / 2);
  ctx.restore();
};

const buildIcon = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  spec: PanelSpec
): void => {
  const {w, h} = spec;
  const cx = w / 2;
  const cy = h / 2;
  const s = Math.min(w, h) * 0.26;

  ctx.save();
  ctx.shadowColor = rgba(theme.panelBorder, 0.8);
  ctx.shadowBlur = 24;
  ctx.strokeStyle = rgba(theme.textWhite, 0.88);
  ctx.fillStyle = rgba(theme.textWhite, 0.88);
  ctx.lineWidth = 6;

  const which = rpick(`${spec.id}-icon`, ['grid', 'ring', 'wave'] as const);
  if (which === 'grid') {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.beginPath();
        ctx.arc(cx + (c - 1) * s * 0.7, cy + (r - 1) * s * 0.7, 6.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (which === 'ring') {
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, Math.PI * 1.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.34, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = cx - s + (i / 24) * s * 2;
      const y = cy + Math.sin((i / 24) * Math.PI * 2.4) * s * 0.55;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
};

const buildStat = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  spec: PanelSpec,
  meta: PanelMeta
): void => {
  const {w, h} = spec;
  const top = drawTitleBar(ctx, theme, w, spec.id) + 20;

  let digits = '';
  for (let i = 0; i < 3; i++) digits += rpick(`${spec.id}-d${i}`, DIGITS.split(''));
  ctx.font = `600 ${Math.round(h * 0.3)}px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = rgba(theme.textWhite, 0.9);
  ctx.fillText(digits, 30, top);

  roundedRect(ctx, 30, top + h * 0.34, w * 0.42, 12, 6);
  ctx.fillStyle = rgba(theme.panelBorder, 0.4);
  ctx.fill();

  // Sparkline.
  const base = top + h * 0.5;
  const amp = h * 0.15;
  ctx.beginPath();
  for (let i = 0; i <= 22; i++) {
    const x = 30 + (i / 22) * (w - 60);
    const y = base + (rrange(`${spec.id}-spk-${i}`, -1, 1) * amp) / 2 - i * 0.9;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = rgba(theme.panelBorder, 0.8);
  ctx.lineWidth = 3;
  ctx.stroke();

  meta.rows.push({x: 26, y: top + h * 0.32, w: w - 52, h: 20});
};

const buildStrip = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  spec: PanelSpec,
  meta: PanelMeta
): void => {
  const {w} = spec;
  const step = ICON_STRIP.size + ICON_STRIP.gap;
  for (let i = 0; i < ICON_STRIP.count; i++) {
    const y = i * step;
    roundedRect(ctx, 0, y, w, ICON_STRIP.size, 26);
    ctx.fillStyle = rgba(theme.panelFill, 0.8);
    ctx.fill();
    ctx.strokeStyle = rgba(theme.panelBorder, 0.7);
    ctx.lineWidth = 2.6;
    ctx.shadowColor = rgba(theme.panelBorder, 0.6);
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // A tiny abstract mark inside each button.
    const cx = w / 2;
    const cy = y + ICON_STRIP.size / 2;
    const m = ICON_STRIP.size * 0.2;
    ctx.strokeStyle = rgba(theme.textWhite, 0.72);
    ctx.lineWidth = 4;
    const kind = rint(`${spec.id}-b${i}`, 0, 2);
    ctx.beginPath();
    if (kind === 0) {
      ctx.moveTo(cx - m, cy - m * 0.5);
      ctx.lineTo(cx + m, cy - m * 0.5);
      ctx.moveTo(cx - m, cy + m * 0.5);
      ctx.lineTo(cx + m, cy + m * 0.5);
    } else if (kind === 1) {
      ctx.arc(cx, cy, m, 0, Math.PI * 2);
    } else {
      ctx.rect(cx - m, cy - m, m * 2, m * 2);
    }
    ctx.stroke();

    meta.rows.push({x: 0, y, w, h: ICON_STRIP.size});
  }
};

/* --------------------------------------------------------------- sprite */

/**
 * Every panel is drawn ONCE into its own offscreen canvas and blitted each
 * frame under the plane transform. Only the handful of pixels that actually
 * change — a re-rendered code line, a ring value — are drawn live on top.
 */
const buildPanel = (spec: PanelSpec, theme: Theme): BuiltPanel => {
  const canvas = makeCanvas(spec.w + PAD * 2, spec.h + PAD * 2);
  const ctx = ctxOf(canvas);
  const meta: PanelMeta = {rows: [], rings: [], bars: []};

  ctx.translate(PAD, PAD);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (spec.kind !== 'strip') drawShell(ctx, theme, spec.w, spec.h);

  switch (spec.kind) {
    case 'code':
      buildCode(ctx, theme, spec, meta);
      break;
    case 'robot':
      buildRobot(ctx, theme, spec);
      break;
    case 'dashboard':
      buildDashboard(ctx, theme, spec, meta);
      break;
    case 'list':
      buildList(ctx, theme, spec, meta);
      break;
    case 'glyph':
      buildGlyph(ctx, theme, spec);
      break;
    case 'icon':
      buildIcon(ctx, theme, spec);
      break;
    case 'stat':
      buildStat(ctx, theme, spec, meta);
      break;
    case 'strip':
      buildStrip(ctx, theme, spec, meta);
      break;
  }

  return {canvas, meta};
};

/* ------------------------------------------------------------ component */

export const UiPanel: React.FC<{
  layers: LayersRef;
  scene: Scene;
  spec: PanelSpec;
  plane: {x: number; y: number};
  depth: 0 | 1 | 2;
  events: readonly FlickerEvent[];
  frame: number;
  fontsReady: boolean;
}> = ({layers, scene, spec, plane, depth, events, frame, fontsReady}) => {
  const theme = THEMES[scene.variant];
  const built = useMemo(
    () => (fontsReady ? buildPanel(spec, theme) : null),
    [spec, theme, fontsReady]
  );

  // No dependency array: the draw must run on EVERY render so that the layer
  // order described in layers.ts holds. See ChipDashboard for the full pass.
  useLayoutEffect(() => {
    const L = layers.current;
    if (!L || !built) return;
    const ctx = L.dof[depth];
    resetCtx(ctx);

    const flickers = activeFlickers(events, spec.id, frame);
    const blink = flickers
      .filter((f) => f.kind === 'blink')
      .reduce((acc, f) => Math.max(acc, f.intensity), 0);

    // Origin at the panel's top-left, on the plane.
    const local = compose(
      frameMatrix(scene.base, frame),
      translate(plane.x - spec.w / 2, plane.y - spec.h / 2)
    );
    setMat(ctx, local);

    ctx.drawImage(built.canvas, -PAD, -PAD);

    if (blink > 0) {
      // A brief lift of the whole border.
      ctx.globalCompositeOperation = 'lighter';
      roundedRect(ctx, 0, 0, spec.w, spec.h, Math.min(spec.w, spec.h) * 0.1);
      ctx.strokeStyle = rgba(theme.panelBorder, 0.5 * blink);
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ---- live content ------------------------------------------------ */
    ctx.globalCompositeOperation = 'lighter';

    // Ring charts always breathe; a flicker event knocks the value further.
    for (let i = 0; i < built.meta.rings.length; i++) {
      const ring = built.meta.rings[i];
      const bump = flickers
        .filter((f) => f.kind === 'ring' && f.slot % built.meta.rings.length === i)
        .reduce((acc, f) => acc + f.intensity * 0.16, 0);
      const value = Math.max(
        0.06,
        Math.min(0.97, ringBase(ring.seed) + closedSine(frame, ring.freq) * 0.05 + bump)
      );
      ctx.beginPath();
      ctx.arc(ring.cx, ring.cy, ring.r, -Math.PI / 2, -Math.PI / 2 + value * Math.PI * 2);
      ctx.strokeStyle = rgba(theme.panelBorder, 0.95);
      ctx.lineWidth = 13;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Dashboard bar fills.
    for (let i = 0; i < built.meta.bars.length; i++) {
      const bar = built.meta.bars[i];
      const seed = `${spec.id}-barv-${i}`;
      const bump = flickers
        .filter((f) => f.kind === 'row' && f.slot % built.meta.bars.length === i)
        .reduce((acc, f) => acc + f.intensity * 0.2, 0);
      const value = Math.max(
        0.08,
        Math.min(1, rrange(seed, 0.2, 0.9) + closedSine(frame, rint(`${seed}-f`, 1, 3)) * 0.05 + bump)
      );
      roundedRect(ctx, bar.x, bar.y, bar.w * value, bar.h, bar.h / 2);
      ctx.fillStyle = rgba(theme.panelBorder, 0.8);
      ctx.fill();
    }

    // Re-rendered code lines and highlighted list rows.
    for (const f of flickers) {
      if (f.kind !== 'code-line' && f.kind !== 'row') continue;
      if (built.meta.rows.length === 0) continue;
      const row = built.meta.rows[f.slot % built.meta.rows.length];
      if (f.kind === 'code-line') {
        let x = row.x + rrange(`${f.seed}-in`, 0, 3) * 22;
        const tokens = rint(`${f.seed}-n`, 2, 5);
        for (let t = 0; t < tokens; t++) {
          const tw = rrange(`${f.seed}-w${t}`, 26, 128);
          if (x + tw > row.x + row.w) break;
          const roll = rrange(`${f.seed}-c${t}`, 0, 1);
          roundedRect(ctx, x, row.y + 6, tw, 8, 4);
          ctx.fillStyle =
            roll > 0.8
              ? rgba(theme.codeAccent, f.intensity)
              : rgba(theme.textWhite, 0.6 * f.intensity);
          ctx.fill();
          x += tw + rrange(`${f.seed}-g${t}`, 10, 26);
        }
        // Caret.
        roundedRect(ctx, x, row.y + 4, 10, 13, 2);
        ctx.fillStyle = rgba(theme.textWhite, 0.85 * f.intensity);
        ctx.fill();
      } else {
        roundedRect(ctx, row.x, row.y, row.w, row.h, 8);
        ctx.fillStyle = rgba(theme.panelBorder, 0.16 * f.intensity);
        ctx.fill();
      }
    }

    resetCtx(ctx);
  });

  return null;
};

export {PAD as PANEL_SPRITE_PAD};
export const iconStripSpec = (): PanelSpec => ({
  id: 'icon-strip',
  kind: 'strip',
  du: ICON_STRIP.du,
  dv: ICON_STRIP.dv,
  w: ICON_STRIP.size,
  h: ICON_STRIP.count * (ICON_STRIP.size + ICON_STRIP.gap) - ICON_STRIP.gap,
  depth: ICON_STRIP.depth,
  routeBias: 0.7,
});
