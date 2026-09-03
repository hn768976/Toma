import { useCanvasPaint } from "../lib/canvas";
import { grainPass, vignettePass } from "../lib/passes";

export type FinishPassProps = {
  width: number;
  height: number;
  frame: number;
  period: number;
  vignetteStrength?: number;
  grainAlpha?: number;
};

const layerStyle = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
} as const;

/**
 * The top of the stack: a strong vignette, then fine film grain.
 *
 * The vignette pulls the black surround down to nothing, so the glow reads as
 * the only light in the frame. The grain rides above it on its own layer,
 * composited with `overlay` so it modulates the picture instead of veiling it.
 */
export const FinishPass: React.FC<FinishPassProps> = ({
  width,
  height,
  frame,
  period,
  vignetteStrength = 0.26,
  grainAlpha = 0.04,
}) => {
  const vignetteRef = useCanvasPaint(
    (ctx) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.clearRect(0, 0, width, height);
      vignettePass(ctx, width, height, vignetteStrength);
    },
    [width, height, vignetteStrength],
  );

  const grainRef = useCanvasPaint(
    (ctx) => {
      grainPass(ctx, width, height, { frame, period, alpha: grainAlpha });
    },
    [width, height, frame, period, grainAlpha],
  );

  return (
    <>
      <canvas ref={vignetteRef} width={width} height={height} style={layerStyle} />
      <canvas
        ref={grainRef}
        width={width}
        height={height}
        style={{ ...layerStyle, mixBlendMode: "overlay" }}
      />
    </>
  );
};
