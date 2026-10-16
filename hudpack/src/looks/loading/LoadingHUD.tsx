import { useCallback } from "react";
import { CanvasLook } from "../../lib/CanvasLook";
import type { OverlayPalette } from "../../versions";
import { drawLoadingHud } from "./drawLoadingHud";

export const LoadingHUD: React.FC<{ palette: OverlayPalette }> = ({ palette }) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, frame: number) => drawLoadingHud(ctx, w, h, frame, palette.line),
    [palette.line],
  );
  return <CanvasLook draw={draw} halo={0.35} />;
};
