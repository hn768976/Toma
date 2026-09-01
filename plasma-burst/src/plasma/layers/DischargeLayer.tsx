import { useLayoutEffect, type RefObject } from "react";
import { DISCHARGE } from "../config";
import { getWeb, type Filament } from "../geometry";
import { clear2d, getScratch } from "../scratch";
import { rgba, type PlasmaTheme } from "../theme";

/**
 * The filament web, composited from four passes with 'lighter'.
 *
 * Every pass is blurred; none of them lays down a crisp stroke. Each is
 * rendered on a reduced-resolution scratch canvas and blurred *there*, so a
 * radius of r becomes r * downsample once upscaled. Glow is low-frequency by
 * definition, so nothing is lost, and it costs a fraction of what an equivalent
 * shadow on every stroke would at 4K.
 *
 * Widths and blurs are graded so structure survives the softening: the widest
 * pass is a 92px stroke under 70px of blur and the narrowest a 6px stroke under
 * 9px, which still reads as a bright ridge down the middle of each filament
 * without ever presenting a hard edge.
 */

type Pass = {
  readonly width: number;
  readonly alpha: number;
  readonly blur: number;
  readonly downsample: number;
  readonly gain: number;
};

type ColourFor = (filament: Filament) => string;

const strokeWeb = (
  ctx: CanvasRenderingContext2D,
  filaments: readonly Filament[],
  pass: Pass,
  scale: number,
  colourFor: ColourFor,
  energy: number,
) => {
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const filament of filaments) {
    const widthScale = DISCHARGE.generationWidth[filament.generation] ?? 0.4;

    ctx.strokeStyle = colourFor(filament);
    // Filaments thin as well as thin out — the web weakens, it does not just
    // lose members.
    ctx.lineWidth = pass.width * scale * widthScale * (0.55 + 0.45 * energy);
    ctx.globalAlpha = Math.min(1, pass.alpha * filament.brightness * energy);
    ctx.stroke(filament.path);
  }

  ctx.globalAlpha = 1;
};

const drawPass = (
  target: CanvasRenderingContext2D,
  key: string,
  width: number,
  height: number,
  filaments: readonly Filament[],
  pass: Pass,
  scale: number,
  colourFor: ColourFor,
  energy: number,
) => {
  const w = Math.max(1, Math.round(width / pass.downsample));
  const h = Math.max(1, Math.round(height / pass.downsample));

  const scratch = getScratch(key, w, h);
  const sctx = clear2d(scratch);
  // Stroke the shared Path2D objects in frame coordinates, scaled down.
  sctx.scale(1 / pass.downsample, 1 / pass.downsample);
  strokeWeb(sctx, filaments, pass, scale, colourFor, energy);
  sctx.setTransform(1, 0, 0, 1, 0, 0);

  const blurred = clear2d(getScratch(`${key}-blur`, w, h));
  blurred.filter = `blur(${(pass.blur * scale) / pass.downsample}px)`;
  blurred.drawImage(scratch, 0, 0);
  blurred.filter = "none";

  target.globalCompositeOperation = "lighter";
  target.imageSmoothingEnabled = true;
  target.imageSmoothingQuality = "high";

  // Composite the pass `gain` times to put back the peak brightness the blur
  // spread out. The fractional remainder goes in as a partial-alpha draw.
  for (let remaining = pass.gain; remaining > 0; remaining -= 1) {
    target.globalAlpha = Math.min(1, remaining);
    target.drawImage(blurred.canvas, 0, 0, w, h, 0, 0, width, height);
  }

  target.globalAlpha = 1;
};

export const DischargeLayer: React.FC<{
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly frame: number;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly theme: PlasmaTheme;
  readonly energy: number;
  readonly count: number;
  readonly seedIndex: number;
}> = ({ canvasRef, frame, width, height, scale, theme, energy, count, seedIndex }) => {
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = clear2d(canvas);
    if (energy <= 0 || count <= 0) {
      return;
    }

    const web = getWeb(seedIndex, width, height);
    // Thinning the web is a slice of the memoised filament list, never a rebuild.
    const end = web.boundaries[Math.min(count, web.boundaries.length) - 1] ?? 0;
    const filaments = web.filaments.slice(0, end);

    // The sheath is the violet body of the discharge; the deep indigo of the
    // outer volume is the cloud's job, not the filaments'.
    const atmosphereColour: ColourFor = () => rgba(theme.plasmaMid, 1);
    const outerColour: ColourFor = (f) =>
      rgba(f.hot ? theme.plasmaBright : theme.plasmaMid, 1);
    const channelColour: ColourFor = (f) =>
      rgba(f.hot ? theme.plasmaCyan : theme.plasmaMid, 1);
    const coreColour: ColourFor = (f) =>
      rgba(f.hot ? theme.coreWhite : theme.plasmaBright, 1);

    const { atmosphere, outer, channel, core } = DISCHARGE.passes;

    drawPass(ctx, "pass-atmosphere", width, height, filaments, atmosphere, scale, atmosphereColour, energy);
    drawPass(ctx, "pass-outer", width, height, filaments, outer, scale, outerColour, energy);
    drawPass(ctx, "pass-channel", width, height, filaments, channel, scale, channelColour, energy);
    drawPass(ctx, "pass-core", width, height, filaments, core, scale, coreColour, Math.min(1, energy * 1.1));
  }, [canvasRef, frame, width, height, scale, theme, energy, count, seedIndex]);

  return (
    <canvas ref={canvasRef} width={width} height={height} style={{ display: "none" }} />
  );
};
