import React, {useMemo, useRef} from "react";
import {useCurrentFrame} from "remotion";
import {CONFIG, FPS, HEIGHT, WIDTH} from "../config";
import {MONO_FONT_FAMILY, useMonoFontReady} from "../fonts";
import {BloomLayer} from "../lib/BloomLayer";
import {mixHex, withAlpha} from "../lib/color";
import type {MaskField} from "../lib/mask-field";
import {TextFillMask} from "../lib/TextFillMask";
import {makeCanvas, useCanvas2D} from "../lib/use-canvas";
import type {MapProjection} from "../lib/projection";
import type {LandFeature} from "../lib/natural-earth";
import type {Theme} from "../theme";

const CHARS = ["0", "1"] as const;

/**
 * The continents, filled with ones and zeroes rather than with colour.
 *
 * Three stacked pieces: a soft glow that follows the land shapes and breathes
 * on a slow sine so the map reads as lit from within; the digit field itself
 * (see `<TextFillMask>`, which owns the atlas, the grid and the incremental
 * reroll buffer); and an additive bloom taken from the digit field.
 *
 * The coastlines are defined entirely by where the text is cut off — there is
 * no stroked outline anywhere in this component. That hard text edge against
 * pure black is what makes the map legible.
 */
export const BinaryLandFill: React.FC<{
  theme: Theme;
  land: LandFeature;
  projection: MapProjection;
  mask: MaskField;
}> = ({theme, land, projection, mask}) => {
  const frame = useCurrentFrame();
  const fontReady = useMonoFontReady();

  // Mostly dim, a scattering mid, a few bright. Without this spread the
  // continents read as flat blocks of texture.
  const ramp = useMemo(
    () => [
      withAlpha(theme.landDigitDim, 0.42),
      withAlpha(theme.landDigitDim, 0.68),
      theme.landDigitDim,
      mixHex(theme.landDigitDim, theme.landDigitMid, 0.6),
      theme.landDigitMid,
      mixHex(theme.landDigitMid, theme.landDigitBright, 0.6),
      theme.landDigitBright,
    ],
    [theme],
  );
  const weights = useMemo(() => [0.25, 0.25, 0.2, 0.13, 0.08, 0.06, 0.03], []);
  const flashColor = useMemo(
    () => mixHex(theme.landDigitBright, theme.nodeWhite, 0.45),
    [theme],
  );

  const glow = useMemo(() => {
    const {canvas, ctx} = makeCanvas(WIDTH, HEIGHT);
    ctx.filter = `blur(${CONFIG.glow.blur}px)`;
    ctx.fillStyle = theme.landGlow;
    ctx.beginPath();
    projection.trace(ctx, land);
    ctx.fill();
    // A second, tighter pass concentrates the light just inside the coastline.
    ctx.filter = `blur(${Math.round(CONFIG.glow.blur * 0.35)}px)`;
    ctx.globalAlpha = 0.5;
    ctx.fill();
    return canvas;
  }, [land, projection, theme.landGlow]);

  const glowDrawn = useRef<HTMLCanvasElement | null>(null);
  const glowRef = useCanvas2D(WIDTH, HEIGHT, (ctx) => {
    if (glowDrawn.current === glow) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(glow, 0, 0);
    glowDrawn.current = glow;
  });

  const breath =
    1 + CONFIG.glow.breath * Math.sin((frame / CONFIG.glow.periodInFrames) * Math.PI * 2);

  const digitCanvas = useRef<HTMLCanvasElement | null>(null);

  return (
    <>
      <canvas
        ref={glowRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: CONFIG.glow.alpha * breath,
        }}
      />
      {fontReady ? (
        <TextFillMask
          width={WIDTH}
          height={HEIGHT}
          mask={mask}
          chars={CHARS}
          ramp={ramp}
          weights={weights}
          flashColor={flashColor}
          fontFamily={MONO_FONT_FAMILY}
          fontSize={CONFIG.digits.fontSize}
          cellWidth={CONFIG.digits.cellWidth}
          rowHeight={CONFIG.digits.rowHeight}
          jitter={CONFIG.digits.jitter}
          rerollsPerFrame={CONFIG.digits.rerollsPerSecond / FPS}
          flashFrames={CONFIG.digits.flashFrames}
          seed="binary-land"
          frame={frame}
          canvasRef={digitCanvas}
        />
      ) : null}
      <BloomLayer
        source={digitCanvas}
        width={WIDTH}
        height={HEIGHT}
        downscale={CONFIG.finish.bloomDownscale}
        blur={CONFIG.finish.bloomBlur}
        spread={CONFIG.finish.bloomSpread}
        opacity={CONFIG.finish.bloomOpacity}
        frame={frame}
      />
    </>
  );
};
