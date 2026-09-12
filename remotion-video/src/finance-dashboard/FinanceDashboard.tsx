import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CAMERA_END_X,
  CAMERA_PERSPECTIVE,
  CAMERA_ROTATE_X,
  CAMERA_ROTATE_Y_END,
  CAMERA_ROTATE_Y_START,
  CAMERA_ROTATE_Z,
  CAMERA_START_X,
  CAMERA_Y,
  CAMERA_ZOOM,
  DOF_BLUR_PX,
  DOF_CLEAR_RADIUS_X,
  DOF_CLEAR_RADIUS_Y,
  DURATION_IN_FRAMES,
  GLOW_BLUR_PX,
  THEMES,
} from "./constants";
import { drawBoard, drawPixelGrid } from "./board";

export const financeDashboardSchema = z.object({
  // "reference" = red / blue / green like the source clip,
  // "dark-cyan" = monochrome cyan / teal palette.
  theme: z.enum(["reference", "dark-cyan"]),
  // 1 = 1080p (1920x1080), 2 = 4K (3840x2160). Must match the width /
  // height the Composition is registered with in Root.tsx.
  resolutionScale: z.number().positive(),
});

export type FinanceDashboardProps = z.infer<typeof financeDashboardSchema>;

export const financeDashboardDefaults: FinanceDashboardProps = {
  theme: "reference",
  resolutionScale: 1,
};

const createCanvas = (width: number, height: number) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

// Financial AI analytics dashboard: a wide HUD "board" (data matrix ->
// sankey ribbons -> seven dotted chart rows, gauges, readouts) rendered
// on a 2D canvas, viewed through a CSS 3D camera that slowly dollies
// across it. Bloom comes from a blurred, screen-blended copy; tilt-shift
// style depth of field from a second blurred copy masked to the frame
// edges. All drawing is a pure function of the frame so parallel render
// workers agree exactly.
export const FinanceDashboard: React.FC<FinanceDashboardProps> = ({
  theme: themeName,
  resolutionScale: s,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const theme = THEMES[themeName];
  const t = frame / fps;

  const boardW = BOARD_WIDTH * s;
  const boardH = BOARD_HEIGHT * s;
  const halfW = Math.round(boardW / 2);
  const halfH = Math.round(boardH / 2);

  const offscreen = useMemo(() => createCanvas(boardW, boardH), [boardW, boardH]);
  const sharpRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const dofRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const sharp = sharpRef.current;
    const glow = glowRef.current;
    const dof = dofRef.current;
    if (!offscreen || !sharp || !glow || !dof) return;
    const octx = offscreen.getContext("2d");
    const sctx = sharp.getContext("2d");
    const gctx = glow.getContext("2d");
    const dctx = dof.getContext("2d");
    if (!octx || !sctx || !gctx || !dctx) return;

    octx.setTransform(s, 0, 0, s, 0, 0);
    drawBoard(octx, t, theme);

    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.drawImage(offscreen, 0, 0);
    drawPixelGrid(sctx, boardW, boardH, s);

    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, halfW, halfH);
    gctx.drawImage(offscreen, 0, 0, halfW, halfH);

    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.drawImage(offscreen, 0, 0, halfW, halfH);
  }, [offscreen, t, theme, s, boardW, boardH, halfW, halfH]);

  // Camera: linear lateral dolly with a gentle un-twist, like the reference.
  const progress = frame / (DURATION_IN_FRAMES - 1);
  const camX = interpolate(progress, [0, 1], [CAMERA_START_X, CAMERA_END_X]);
  const rotY = interpolate(progress, [0, 1], [CAMERA_ROTATE_Y_START, CAMERA_ROTATE_Y_END]);
  const camY = CAMERA_Y;

  const layer: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: boardW,
    height: boardH,
  };

  const dofMask = `radial-gradient(ellipse ${DOF_CLEAR_RADIUS_X * 1.9 * s}px ${
    DOF_CLEAR_RADIUS_Y * 1.9 * s
  }px at ${camX * s}px ${camY * s}px, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 42%, rgba(0,0,0,1) 100%)`;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: CAMERA_PERSPECTIVE * s,
          perspectiveOrigin: "50% 50%",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: width / 2,
            top: height / 2,
            width: 0,
            height: 0,
            transformStyle: "preserve-3d",
            transform: `scale(${CAMERA_ZOOM}) rotateX(${CAMERA_ROTATE_X}deg) rotateY(${rotY}deg) rotateZ(${CAMERA_ROTATE_Z}deg)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: -camX * s,
              top: -camY * s,
              width: boardW,
              height: boardH,
            }}
          >
            <canvas ref={sharpRef} width={boardW} height={boardH} style={layer} />
            <canvas
              ref={dofRef}
              width={halfW}
              height={halfH}
              style={{
                ...layer,
                filter: `blur(${DOF_BLUR_PX * s}px)`,
                WebkitMaskImage: dofMask,
                maskImage: dofMask,
              }}
            />
            <canvas
              ref={glowRef}
              width={halfW}
              height={halfH}
              style={{
                ...layer,
                filter: `blur(${GLOW_BLUR_PX * s}px) saturate(1.4) brightness(1.35)`,
                mixBlendMode: "screen",
                opacity: 1,
              }}
            />
          </div>
        </div>
      </div>
      {/* atmosphere: cool haze + vignette, in screen space */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 60% at 55% 45%, ${theme.haze} 0%, rgba(0,0,0,0) 70%)`,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.72) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
