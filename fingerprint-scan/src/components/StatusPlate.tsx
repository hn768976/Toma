/**
 * <StatusPlate> — the outcome. A filled bar with a bright border carrying a
 * single word in caps, at the print's centre.
 *
 * It stamps: it appears at `fromScale` and snaps to 1.0 over `stampFrames` with
 * no easing at all, which is what makes it land rather than animate.
 */
import React, { useEffect, useRef } from "react";
import { sansFont } from "../fonts";
import { withAlpha } from "../shared/draw";
import { PRINT_CX, PRINT_CY } from "../layout";
import type { OutcomeConfig } from "../variants";

const PW = 900;
const PH = 260;

export const StatusPlate: React.FC<{ outcome: OutcomeConfig; frame: number }> = ({
  outcome,
  frame,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const visible = outcome.kind === "match" && frame >= outcome.at;

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || outcome.kind !== "match") return;
    ctx.clearRect(0, 0, PW, PH);
    if (!visible) return;

    const age = frame - outcome.at;
    // Linear, no easing — a hard snap from 1.2x to 1.0x.
    const t = Math.min(1, age / outcome.stampFrames);
    const scale = outcome.fromScale + (1 - outcome.fromScale) * t;

    const bw = 700;
    const bh = 152;
    ctx.save();
    ctx.translate(PW / 2, PH / 2);
    ctx.scale(scale, scale);

    ctx.fillStyle = withAlpha(outcome.plateFill, 0.94);
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.strokeStyle = outcome.plateBorder;
    ctx.lineWidth = 6;
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = sansFont(96, 600);
    ctx.letterSpacing = "18px";
    ctx.fillStyle = outcome.plateText;
    ctx.fillText(outcome.label, 9, 4);
    ctx.letterSpacing = "0px";
    ctx.restore();
  });

  if (outcome.kind !== "match") return null;

  return (
    <canvas
      ref={ref}
      width={PW}
      height={PH}
      style={{
        position: "absolute",
        left: PRINT_CX - PW / 2,
        top: PRINT_CY - PH / 2,
        width: PW,
        height: PH,
      }}
    />
  );
};
