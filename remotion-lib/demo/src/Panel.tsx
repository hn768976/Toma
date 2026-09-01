import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { FONT, THEME } from "./theme";

/**
 * Shared chrome for every demo panel: a title, the import path, and a
 * one-line note on what the panel is demonstrating. Keeps the panels
 * themselves to just the library call being shown.
 */
export const Panel: React.FC<{
  title: string;
  importPath: string;
  note: string;
  children: React.ReactNode;
}> = ({ title, importPath, note, children }) => {
  const frame = useCurrentFrame();
  // Gentle fade so cuts between panels are not jarring in the reel.
  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.background, fontFamily: FONT }}>
      <AbsoluteFill style={{ opacity }}>
        <AbsoluteFill>{children}</AbsoluteFill>

        <div
          style={{
            position: "absolute",
            left: 64,
            top: 56,
            color: THEME.ink,
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: -0.5,
          }}
        >
          {title}
        </div>
        <div
          style={{
            position: "absolute",
            left: 64,
            top: 108,
            color: THEME.accent,
            fontSize: 20,
          }}
        >
          {importPath}
        </div>
        <div
          style={{
            position: "absolute",
            left: 64,
            bottom: 56,
            right: 64,
            color: THEME.inkDim,
            fontSize: 22,
            lineHeight: 1.45,
          }}
        >
          {note}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * A canvas that redraws every frame from a pure draw(ctx, frame) callback.
 * The demo's only stateful code — the library itself never touches a ref.
 */
export const FrameCanvas: React.FC<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, frame: number) => void;
  style?: React.CSSProperties;
}> = ({ width, height, draw, style }) => {
  const frame = useCurrentFrame();
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    draw(ctx, frame);
  }, [frame, draw, width, height]);

  return <canvas ref={ref} width={width} height={height} style={style} />;
};
