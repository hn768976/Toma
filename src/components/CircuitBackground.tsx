import {useLayoutEffect, useMemo} from 'react';
import {DRIFT_STEP, HEIGHT, WIDTH} from '../config';
import {MONO} from '../fonts';
import {DURATION_IN_FRAMES} from '../config';
import {
  ctxOf,
  inverseBounds,
  loopFrame,
  makeCanvas,
  rgba,
  rint,
  rpick,
  rrange,
} from '../lib/draw';
import {compose, setMat, translate} from '../lib/mat';
import {resetCtx, type LayersRef} from '../layers';
import type {Scene} from '../scene';
import {THEMES} from '../theme';

const GLYPHS = '0123456789ABCDEFXY<>[]{}=+-/*_:;#$%&';

/**
 * Screen-fixed plate: the ambient gradient plus the fine vertical light streaks
 * that sit over the fan side of the frame.
 */
const buildBasePlate = (scene: Scene): HTMLCanvasElement => {
  const theme = THEMES[scene.variant];
  const dir = scene.flowDirection;
  const c = makeCanvas(WIDTH, HEIGHT);
  const ctx = ctxOf(c);

  ctx.fillStyle = theme.bgDeep;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // A broad lift toward the chip, so the frame is not a flat black field.
  const glow = ctx.createRadialGradient(
    scene.chipScreen.x,
    scene.chipScreen.y,
    0,
    scene.chipScreen.x,
    scene.chipScreen.y,
    WIDTH * 0.62
  );
  glow.addColorStop(0, rgba(theme.bgMid, 0.95));
  glow.addColorStop(0.45, rgba(theme.bgMid, 0.42));
  glow.addColorStop(1, rgba(theme.bgMid, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Fine vertical light streaks, low opacity, over the mid region on the fan
  // side of frame. Mirrored with the rest of the piece by `dir`.
  const centreX = WIDTH * (0.5 - dir * 0.24);
  const spread = WIDTH * 0.19;
  for (let i = 0; i < 170; i++) {
    const seed = `${scene.variant}-streak-${i}`;
    const x = centreX + rrange(`${seed}-x`, -spread, spread);
    const h = rrange(`${seed}-h`, HEIGHT * 0.28, HEIGHT * 0.92);
    const y = rrange(`${seed}-y`, -HEIGHT * 0.1, HEIGHT - h * 0.35);
    const a = rrange(`${seed}-a`, 0.012, 0.055);
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, rgba(theme.panelBorder, 0));
    grad.addColorStop(0.5, rgba(theme.panelBorder, a));
    grad.addColorStop(1, rgba(theme.panelBorder, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, rrange(`${seed}-w`, 1, 2.6), h);
  }

  return c;
};

/**
 * Plane-space circuit texture, generated once. The content is periodic along
 * the plane's x axis with period TILE_PLANE_WIDTH, so blitting it back by one
 * whole tile over the loop is seamless.
 */
const buildTilePlate = (
  scene: Scene,
  padX: number,
  padY: number
): HTMLCanvasElement => {
  const tileW = scene.tilePlaneWidth;
  const theme = THEMES[scene.variant];
  const c = makeCanvas(WIDTH + padX * 2, HEIGHT + padY * 2);
  const ctx = ctxOf(c);
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';

  const bounds = inverseBounds(scene.inv, WIDTH, HEIGHT, Math.max(padX, padY) + 40);
  const kMin = Math.floor(bounds.minX / tileW) - 2;
  const kMax = Math.ceil(bounds.maxX / tileW) + 2;
  const yLo = bounds.minY - 200;
  const yHi = bounds.maxY + 200;

  // Copies are placed by whole-pixel SCREEN translations of DRIFT_STEP, not by
  // plane-space offsets: that is what makes the rasterised plate exactly
  // periodic under the drift vector, and therefore what makes the loop close.
  for (let k = kMin; k <= kMax; k++) {
    setMat(
      ctx,
      compose(
        translate(padX + k * DRIFT_STEP.x, padY + k * DRIFT_STEP.y),
        scene.base
      )
    );

    // Right-angle traces. Every tile draws the identical seeded content, so the
    // union across tiles is exactly periodic even where a trace overruns into
    // its neighbour.
    for (let i = 0; i < 34; i++) {
      const seed = `trace-${i}`;
      ctx.strokeStyle = rgba(theme.circuitTrace, rrange(`${seed}-a`, 0.35, 0.95));
      ctx.lineWidth = rrange(`${seed}-w`, 1.4, 2.8);
      let x = rrange(`${seed}-x`, 0, tileW);
      let y = rrange(`${seed}-y`, yLo, yHi);
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segs = rint(`${seed}-n`, 2, 5);
      let horizontal = rrange(`${seed}-o`, 0, 1) > 0.5;
      for (let s = 0; s < segs; s++) {
        const len =
          rrange(`${seed}-l${s}`, 60, 420) * (rrange(`${seed}-s${s}`, 0, 1) > 0.5 ? 1 : -1);
        if (horizontal) x += len;
        else y += len;
        ctx.lineTo(x, y);
        horizontal = !horizontal;
      }
      ctx.stroke();

      // Pad at the end of the run.
      if (rrange(`${seed}-pad`, 0, 1) > 0.55) {
        ctx.fillStyle = rgba(theme.circuitTrace, 0.8);
        ctx.fillRect(x - 7, y - 7, 14, 14);
      }
    }

    // Small nested rectangles.
    for (let i = 0; i < 22; i++) {
      const seed = `rect-${i}`;
      const x = rrange(`${seed}-x`, 0, tileW);
      const y = rrange(`${seed}-y`, yLo, yHi);
      const w = rrange(`${seed}-w`, 44, 190);
      const h = rrange(`${seed}-h`, 34, 150);
      const rings = rint(`${seed}-n`, 2, 3);
      ctx.lineWidth = 1.6;
      for (let r = 0; r < rings; r++) {
        const inset = r * rrange(`${seed}-i`, 7, 16);
        ctx.strokeStyle = rgba(theme.circuitTrace, 0.75 - r * 0.18);
        ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
      }
    }

    // Illegible glyph clusters, used purely as texture.
    for (let i = 0; i < 13; i++) {
      const seed = `glyph-${i}`;
      const size = rrange(`${seed}-s`, 15, 27);
      ctx.font = `400 ${size}px ${MONO}`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = rgba(theme.circuitTrace, rrange(`${seed}-a`, 0.5, 1));
      const x = rrange(`${seed}-x`, 0, tileW);
      const y = rrange(`${seed}-y`, yLo, yHi);
      const rows = rint(`${seed}-r`, 2, 5);
      for (let r = 0; r < rows; r++) {
        const chars = rint(`${seed}-c${r}`, 3, 9);
        let text = '';
        for (let ch = 0; ch < chars; ch++) {
          text += rpick(`${seed}-g${r}-${ch}`, GLYPHS.split(''));
        }
        ctx.fillText(text, x, y + r * size * 1.35);
      }
    }
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return c;
};

export const CircuitBackground: React.FC<{
  layers: LayersRef;
  scene: Scene;
  frame: number;
  fontsReady: boolean;
}> = ({layers, scene, frame, fontsReady}) => {
  const pad = useMemo(
    () => ({
      x: Math.abs(DRIFT_STEP.x) + 60,
      y: Math.abs(DRIFT_STEP.y) + 60,
    }),
    []
  );

  // Static. Built once and blitted every frame — nothing here is re-drawn.
  const basePlate = useMemo(() => buildBasePlate(scene), [scene]);
  const tilePlate = useMemo(
    () => (fontsReady ? buildTilePlate(scene, pad.x, pad.y) : null),
    [scene, pad, fontsReady]
  );

  // No dependency array: the draw must run on EVERY render so that the layer
  // order described in layers.ts holds. See ChipDashboard for the full pass.
  useLayoutEffect(() => {
    const L = layers.current;
    if (!L || !tilePlate) return;
    const ctx = L.main;
    resetCtx(ctx);

    ctx.drawImage(basePlate, 0, 0);

    // The whole plane drifts by exactly one tile over the loop, so frame 372
    // lands back on frame 0's texture — and because the frame is folded modulo
    // the duration first, it lands there bit-for-bit.
    const t = loopFrame(frame) / DURATION_IN_FRAMES;
    const dx = scene.flowDirection * DRIFT_STEP.x * t;
    const dy = scene.flowDirection * DRIFT_STEP.y * t;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(tilePlate, dx - pad.x, dy - pad.y);
    ctx.globalAlpha = 1;
  });

  return null;
};
