import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { applyBloom } from "./bloom";
import { CURVE, GRAIN } from "./config";
import { drawGrain } from "./grain";
import { intensityAt, stateAt } from "./intensity";
import { CoreFlash } from "./layers/CoreFlash";
import { DischargeLayer } from "./layers/DischargeLayer";
import { PlasmaCloud } from "./layers/PlasmaCloud";
import { SparkLayer } from "./layers/SparkLayer";
import { clamp } from "./random";
import { THEME, type PlasmaVariant } from "./theme";

/** Sizes throughout are authored in 4K pixels and scaled by this. */
const DESIGN_WIDTH = 3840;

export type PlasmaBurstProps = {
  readonly variant: PlasmaVariant;
};

/**
 * A one-shot plasma discharge. Opens black, strikes, writhes, decays to glow,
 * ends black. Not a loop.
 *
 * Each layer owns a hidden canvas and draws itself in a layout effect; React
 * runs child layout effects before the parent's, so by the time this component
 * composites, all four layers are already drawn for the current frame. Nothing
 * reads the clock — every pixel is a pure function of the frame number.
 */
export const PlasmaBurst: React.FC<PlasmaBurstProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const theme = THEME[variant] ?? THEME.blue;
  const scale = width / DESIGN_WIDTH;

  const state = stateAt(frame);

  // How far through the ignition ramp we are, for the cloud's outward punch.
  const ignition = clamp(
    (frame - CURVE.blackHoldEnd) / (CURVE.peakEnd - CURVE.blackHoldEnd),
    0,
    1,
  );

  const outRef = useRef<HTMLCanvasElement>(null);
  const cloudRef = useRef<HTMLCanvasElement>(null);
  const dischargeRef = useRef<HTMLCanvasElement>(null);
  const coreRef = useRef<HTMLCanvasElement>(null);
  const sparkRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = outRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);

    if (state.intensity <= 0) {
      // Frames 0-8 and 116-120: pure black, nothing else.
      return;
    }

    // Every layer is additive, so the frame is the sum of what is glowing.
    ctx.globalCompositeOperation = "lighter";
    for (const ref of [cloudRef, dischargeRef, coreRef, sparkRef]) {
      const layer = ref.current;
      if (layer) {
        ctx.drawImage(layer, 0, 0);
      }
    }

    ctx.globalCompositeOperation = "source-over";
    applyBloom(ctx, canvas, width, height, scale, state.bloomEnergy);
    drawGrain(
      ctx,
      frame,
      width,
      height,
      GRAIN.alpha * (0.3 + 0.7 * state.intensity),
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <PlasmaCloud
        canvasRef={cloudRef}
        frame={frame}
        width={width}
        height={height}
        theme={theme}
        energy={state.cloudEnergy}
        ignition={ignition}
      />
      <DischargeLayer
        canvasRef={dischargeRef}
        frame={frame}
        width={width}
        height={height}
        scale={scale}
        theme={theme}
        energy={state.filamentEnergy}
        count={state.filamentCount}
        seedIndex={state.seedIndex}
      />
      <CoreFlash
        canvasRef={coreRef}
        frame={frame}
        width={width}
        height={height}
        theme={theme}
        energy={state.coreEnergy}
        seedIndex={state.seedIndex}
      />
      <SparkLayer
        canvasRef={sparkRef}
        frame={frame}
        width={width}
        height={height}
        scale={scale}
        theme={theme}
        gate={intensityAt(frame) > 0 ? 1 : 0}
      />
      <canvas
        ref={outRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
