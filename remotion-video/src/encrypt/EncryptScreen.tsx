import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { clearBuffer, useBuffers } from "./buffers";
import { CodeBackdrop } from "./components/CodeBackdrop";
import { Dialog } from "./components/Dialog";
import { FlashPass } from "./components/FlashPass";
import { ProgressBar } from "./components/ProgressBar";
import { SidePanel } from "./components/SidePanel";
import { StatusIcon } from "./components/StatusIcon";
import { buildFinishCaches, composite, finish } from "./finish";
import "./fonts";
import { useLayout } from "./layout";
import { LAYER, usePainter } from "./painter";
import { deriveState } from "./state";
import type { VariantName } from "./variants";
import { VARIANTS } from "./variants";

/**
 * The encryption progress screen.
 *
 * Everything is drawn into one canvas whose backing store is the full 4K
 * frame. Nothing animates itself: every value on screen is a pure function of
 * `useCurrentFrame()`, so a render is deterministic and any frame can be drawn
 * in isolation. There is no requestAnimationFrame, no Date.now, no CSS
 * animation and no component state.
 */
export const EncryptScreen: React.FC<{ variant: VariantName }> = ({
  variant,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const config = VARIANTS[variant];
  const layout = useLayout(width, height);
  const buffers = useBuffers(width, height);
  const painter = usePainter();
  const caches = useMemo(buildFinishCaches, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getCtx = useCallback(
    () => canvasRef.current?.getContext("2d") ?? null,
    [],
  );

  const state = deriveState(config, frame, fps);

  painter.register("composite", LAYER.composite, () => {
    const ctx = getCtx();
    if (!ctx) return;
    composite(ctx, buffers, config.palette, width, height);
  });

  painter.register("finish", LAYER.finish, () => {
    const ctx = getCtx();
    if (!ctx) return;
    finish(ctx, caches, state, width, height);
  });

  // Runs after every child has registered its layer, so the whole frame is
  // painted once, in order, per React render.
  useLayoutEffect(() => {
    clearBuffer(buffers.far);
    clearBuffer(buffers.mid);
    clearBuffer(buffers.near);
    painter.paint();
  });

  const shared = { painter, buffers, layout, palette: config.palette, state };

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <CodeBackdrop {...shared} />
      <SidePanel {...shared} />
      <Dialog {...shared} />
      <StatusIcon {...shared} />
      <ProgressBar {...shared} />
      <FlashPass
        painter={painter}
        getCtx={getCtx}
        buffers={buffers}
        palette={config.palette}
        state={state}
        width={width}
        height={height}
      />
    </AbsoluteFill>
  );
};
