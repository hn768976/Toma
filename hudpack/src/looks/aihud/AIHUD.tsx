import { useCallback } from "react";
import { CanvasLook } from "../../lib/CanvasLook";
import type { OverlayPalette } from "../../versions";
import { drawAIHud } from "./drawAIHud";

export const AIHUD: React.FC<{ palette: OverlayPalette }> = ({ palette }) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, frame: number) => drawAIHud(ctx, w, h, frame, palette.line),
    [palette.line],
  );
  return <CanvasLook draw={draw} halo={0.35} />;
};
