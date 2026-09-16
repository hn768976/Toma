import { useCallback, useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { createEarthScene, type EarthScene } from "./scene";
import type { ShotId } from "./config";

const TEXTURE_URLS = {
  day: "textures/earth_daymap_4k.jpg",
  night: "textures/earth_night.jpg",
  bump: "textures/earth_bump_4k.jpg",
  water: "textures/earth_water_4k.png",
  clouds: "textures/earth_clouds_4k.png",
} as const;

/** Compiling the node graph on a software adapter is not fast. */
const TIMEOUT = 600_000;

export type EarthCanvasProps = {
  shot: ShotId;
  superSample: number;
  samples: number;
};

export const EarthCanvas: React.FC<EarthCanvasProps> = ({ shot, superSample, samples }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Promise<EarthScene> | null>(null);
  const [initHandle] = useState(() =>
    delayRender(`earth:${shot}:init`, { timeoutInMilliseconds: TIMEOUT }),
  );

  // The handle for the frame on screen is taken during render, not in an
  // effect, so Remotion never gets a chance to screenshot a canvas that is
  // still showing the previous frame.
  const pending = useRef<{ frame: number; handle: number } | null>(null);
  if (pending.current?.frame !== frame) {
    if (pending.current) {
      continueRender(pending.current.handle);
    }
    pending.current = {
      frame,
      handle: delayRender(`earth:${shot}:frame-${frame}`, { timeoutInMilliseconds: TIMEOUT }),
    };
  }

  const getScene = useCallback(() => {
    if (!sceneRef.current) {
      sceneRef.current = createEarthScene({
        canvas: canvasRef.current as HTMLCanvasElement,
        shot,
        width,
        height,
        durationInFrames,
        textureUrls: {
          day: staticFile(TEXTURE_URLS.day),
          night: staticFile(TEXTURE_URLS.night),
          bump: staticFile(TEXTURE_URLS.bump),
          water: staticFile(TEXTURE_URLS.water),
          clouds: staticFile(TEXTURE_URLS.clouds),
        },
        superSample,
        samples,
      }).then((scene) => {
        continueRender(initHandle);
        return scene;
      });
    }
    return sceneRef.current;
  }, [durationInFrames, height, initHandle, samples, shot, superSample, width]);

  useEffect(() => {
    let cancelled = false;
    const current = pending.current;

    getScene()
      .then(async (scene) => {
        if (cancelled) {
          return;
        }
        scene.update(frame);
        await scene.render();
        if (!cancelled && current) {
          continueRender(current.handle);
        }
      })
      .catch((err: Error) => {
        cancelRender(err);
      });

    return () => {
      cancelled = true;
    };
  }, [frame, getScene]);

  useEffect(() => {
    return () => {
      sceneRef.current?.then((scene) => scene.dispose());
    };
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
