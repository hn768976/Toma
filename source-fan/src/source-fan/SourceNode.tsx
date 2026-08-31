import React from "react";
import { useCurrentFrame } from "remotion";
import { hexToRgb, rgba } from "./color";
import { useCanvasLayer, useMonoFont } from "./hooks";
import { ambientDrift, nodeY, type Flow } from "./layout";
import { TAU } from "./math";
import type { VariantConfig } from "./variants";

/** Nodes pulse +/-12%, each on its own period. */
const PULSE_DEPTH = 0.12;
const LABEL_BOX = 520;

/**
 * One bright point with a soft halo in its own colour, and its label in
 * small caps just outside the fan.
 */
export const SourceNode: React.FC<{
  readonly config: VariantConfig;
  readonly flow: Flow;
  readonly index: number;
}> = ({ config, flow, index }) => {
  const frame = useCurrentFrame();
  const fontFamily = useMonoFont();
  const source = config.sources[index];
  const hue = config.palette.nodeHues[index];

  const halfW = config.nodeHaloRadius + config.labelGap + LABEL_BOX;
  const halfH = config.nodeHaloRadius + 60;
  const boxW = halfW * 2;
  const boxH = halfH * 2;

  const drift = ambientDrift(frame);
  const left = flow.x(0) - halfW + drift.dx;
  const top = nodeY(config, index) - halfH + drift.dy;

  const ref = useCanvasLayer(boxW, boxH, (ctx) => {
    const cx = halfW;
    const cy = halfH;
    const rgb = hexToRgb(hue);
    const pulse =
      1 + PULSE_DEPTH * Math.sin(TAU * ((frame % 600) / source.pulsePeriod) + index * 0.37);

    // Soft radial halo.
    const radius = config.nodeHaloRadius * pulse;
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    halo.addColorStop(0, rgba(rgb, 0.5 * pulse));
    halo.addColorStop(0.16, rgba(rgb, 0.2 * pulse));
    halo.addColorStop(0.45, rgba(rgb, 0.05 * pulse));
    halo.addColorStop(1, rgba(rgb, 0));
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = halo;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    // Bright core, with a moderate bloom.
    const core = config.nodeCoreRadius * pulse;
    ctx.shadowColor = rgba(rgb, 0.9);
    ctx.shadowBlur = core * 6;
    ctx.fillStyle = rgba(rgb, 1);
    ctx.beginPath();
    ctx.arc(cx, cy, core, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label, set outside the fan on the far side of the node from the flow.
    ctx.globalCompositeOperation = "source-over";
    ctx.font = `${config.labelSize}px ${fontFamily}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = flow.direction === 1 ? "right" : "left";
    ctx.letterSpacing = `${config.labelSpacing}px`;
    ctx.fillStyle = rgba(rgb, 0.62 + 0.14 * pulse);
    ctx.fillText(
      source.label,
      cx - flow.direction * (config.nodeCoreRadius + config.labelGap),
      cy,
    );
    ctx.letterSpacing = "0px";
  });

  return (
    <canvas
      ref={ref}
      width={boxW}
      height={boxH}
      style={{
        position: "absolute",
        left,
        top,
        width: boxW,
        height: boxH,
        mixBlendMode: "screen",
      }}
    />
  );
};
