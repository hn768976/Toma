import { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

import { HexWallScene } from "./scene";
import { HEX_WALL_THEMES, type HexWallThemeName } from "./themes";

export const hexWallSchema = z.object({
  theme: z.enum(["mono", "blue"]),
  /** Scales the shadow map with the output resolution. 1 = 1080p, 2 = 4K. */
  quality: z.number().min(0.5).max(4),
});

export type HexWallProps = z.infer<typeof hexWallSchema>;

export const hexWallDefaults: HexWallProps = {
  theme: "mono",
  quality: 1,
};

/** Remotion gives a frame at most this long to come back from the GPU. */
const RENDER_TIMEOUT = 240_000;

export const HexWall: React.FC<HexWallProps> = ({ theme, quality }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const palette = HEX_WALL_THEMES[theme as HexWallThemeName];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HexWallScene | null>(null);
  const frameRef = useRef(frame);
  const drawnRef = useRef<number | null>(null);
  frameRef.current = frame;

  const [bootHandle] = useState(() =>
    delayRender("Booting the three.js WebGPU renderer", {
      timeoutInMilliseconds: RENDER_TIMEOUT,
    }),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let disposed = false;
    const scene = new HexWallScene({ width, height, theme, quality });

    scene
      .init()
      .then(async () => {
        if (disposed) {
          return;
        }
        console.log(`[hex-wall] three.js is running on ${scene.backend}`);
        const startFrame = frameRef.current;
        await scene.renderFrame(startFrame / fps, canvas);
        if (disposed) {
          return;
        }
        sceneRef.current = scene;
        drawnRef.current = startFrame;
        setReady(true);
        continueRender(bootHandle);
      })
      .catch((err) => {
        if (!disposed) {
          cancelRender(err);
        }
      });

    return () => {
      disposed = true;
      sceneRef.current = null;
      drawnRef.current = null;
      scene.dispose();
    };
    // `frame` is deliberately left out: the scene is built once per page and
    // then driven frame by frame in the effect below.
  }, [bootHandle, fps, height, quality, theme, width]);

  useEffect(() => {
    const scene = sceneRef.current;
    const canvas = canvasRef.current;
    if (!ready || !scene || !canvas || drawnRef.current === frame) {
      return;
    }

    let cancelled = false;
    const handle = delayRender(`Drawing frame ${frame}`, {
      timeoutInMilliseconds: RENDER_TIMEOUT,
    });

    scene
      .renderFrame(frame / fps, canvas)
      .then(() => {
        if (!cancelled) {
          drawnRef.current = frame;
        }
        continueRender(handle);
      })
      .catch((err) => {
        if (cancelled) {
          continueRender(handle);
          return;
        }
        cancelRender(err);
      });

    return () => {
      cancelled = true;
    };
  }, [frame, fps, ready]);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {/* Soft box bouncing off the wall, plus a touch of vignette - the
          bloom the reference picks up from its studio lighting. */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: `radial-gradient(58% 72% at 6% 58%, ${palette.glow} 0%, rgba(255,255,255,0) 62%)`,
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: `radial-gradient(78% 88% at 50% 46%, rgba(0,0,0,0) 48%, ${palette.vignette} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
