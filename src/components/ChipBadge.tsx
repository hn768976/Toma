import {useLayoutEffect} from 'react';
import {CHIP_PULSE} from '../config';
import {SANS} from '../fonts';
import {closedSine, lighten, rgba, roundedRect} from '../lib/draw';
import {compose, setMat, translate} from '../lib/mat';
import {resetCtx, type LayersRef} from '../layers';
import {frameMatrix, type Scene} from '../scene';
import {THEMES} from '../theme';

const PINS_PER_EDGE = 9;

/**
 * The processor package: a rounded square with pin teeth on all four edges, a
 * bright rim, a semi-transparent fill and a glow that spills onto everything
 * near it. It draws into the `top` layer so it stays above the blurred
 * depth-of-field buckets — it is the brightest element in frame.
 */
export const ChipBadge: React.FC<{
  layers: LayersRef;
  scene: Scene;
  frame: number;
  fontsReady: boolean;
}> = ({layers, scene, frame, fontsReady}) => {
  const theme = THEMES[scene.variant];

  // No dependency array: the draw must run on EVERY render so that the layer
  // order described in layers.ts holds. See ChipDashboard for the full pass.
  useLayoutEffect(() => {
    const L = layers.current;
    if (!L || !fontsReady) return;
    const ctx = L.top;
    resetCtx(ctx);

    const {w, h, plane} = scene.chip;
    setMat(ctx, compose(frameMatrix(scene.base, frame), translate(plane.x, plane.y)));

    // Glow breathes +/-12% on a sine whose period divides 372.
    const pulse = 1 + closedSine(frame, CHIP_PULSE.freq) * CHIP_PULSE.amount;
    const radius = h * 0.2;
    const pinLen = h * 0.055;
    const pinW = h * 0.045;

    /* ---- halo spilling onto the surroundings -------------------------- */
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 0, h * 0.2, 0, 0, h * 2.1 * pulse);
    halo.addColorStop(0, rgba(theme.chip, 0.42 * pulse));
    halo.addColorStop(0.3, rgba(theme.chip, 0.14 * pulse));
    halo.addColorStop(1, rgba(theme.chip, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(-h * 2.2, -h * 2.2, h * 4.4, h * 4.4);
    ctx.globalCompositeOperation = 'source-over';

    /* ---- pin teeth ---------------------------------------------------- */
    ctx.shadowColor = rgba(theme.chip, 0.9);
    ctx.shadowBlur = 26 * pulse;
    ctx.fillStyle = rgba(theme.chip, 0.9);
    for (let e = 0; e < 4; e++) {
      ctx.save();
      ctx.rotate((e * Math.PI) / 2);
      for (let i = 0; i < PINS_PER_EDGE; i++) {
        const t = (i + 0.5) / PINS_PER_EDGE;
        const x = -w / 2 + t * w;
        // Skip the corners so the teeth do not collide at the rounded ends.
        if (Math.abs(x) > w / 2 - radius * 0.75) continue;
        roundedRect(ctx, x - pinW / 2, -h / 2 - pinLen, pinW, pinLen + 6, pinW * 0.3);
        ctx.fill();
      }
      ctx.restore();
    }

    /* ---- package ------------------------------------------------------ */
    roundedRect(ctx, -w / 2, -h / 2, w, h, radius);
    ctx.fillStyle = rgba(theme.panelFill, 0.72);
    ctx.fill();

    ctx.shadowBlur = 60 * pulse;
    ctx.strokeStyle = lighten(theme.chip, 0.25, 1);
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner die outline.
    roundedRect(ctx, -w * 0.36, -h * 0.36, w * 0.72, h * 0.72, radius * 0.6);
    ctx.strokeStyle = rgba(theme.chip, 0.35);
    ctx.lineWidth = 2.6;
    ctx.stroke();

    /* ---- mark ---------------------------------------------------------- */
    ctx.font = `600 ${Math.round(h * 0.42)}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Glow pass, then a clean pass on top. Without the second pass the chip's
    // own hue bleeds through the glyph and the mark stops reading as near-white
    // — very visible against the warm rim of the "teal" variant.
    ctx.shadowColor = rgba(theme.chip, 0.95);
    ctx.shadowBlur = 30 * pulse;
    ctx.fillStyle = rgba(theme.textWhite, 0.9);
    ctx.fillText('Ai', 0, h * 0.02);
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(theme.textWhite, 1);
    ctx.fillText('Ai', 0, h * 0.02);

    resetCtx(ctx);
  });

  return null;
};
