import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import { HEIGHT, WIDTH } from "./config";
import { buildModel, paint } from "./render";

/**
 * The whole shot is drawn into one canvas. Nothing here is stateful or
 * time-based: the frame number is the only input, so `remotion render` is
 * deterministic and every frame can be produced out of order.
 */
export const CandleChart: React.FC = () => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);

  // The price series, ladder, bokeh, flash schedule and grain tiles are all
  // built once. Regenerating any of them per frame would make the chart strobe.
  const model = useMemo(() => buildModel(), []);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    paint(ctx, frame, model);
  }, [frame, model]);

  return (
    <canvas
      ref={ref}
      width={WIDTH}
      height={HEIGHT}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
};
