import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Application } from "pixi.js";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { useRenderDpr } from "../three/ThreeLook";

export type PixiWorld = {
  /** Set every display object from the frame number. No state carried between frames. */
  update: (frame: number) => void;
  destroy: () => void;
};
export type PixiFactory = (app: Application, w: number, h: number, dpr: number) => PixiWorld;

/**
 * One Pixi Application per composition. Ticker stopped; for each Remotion
 * frame we update everything from the frame number and call app.render() once.
 * Stage units are composition pixels (3840x2160); the backing store is
 * composition size x devicePixelRatio.
 */
export const PixiLook: React.FC<{ create: PixiFactory }> = ({ create }) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const dpr = useRenderDpr();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [world, setWorld] = useState<{ app: Application; world: PixiWorld } | null>(null);
  const [initHandle] = useState(() => delayRender("Initialising PixiJS"));
  const released = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    let made: PixiWorld | null = null;
    app
      .init({
        canvas: canvasRef.current!,
        width,
        height,
        resolution: dpr,
        autoDensity: false,
        preference: "webgl",
        antialias: true,
        autoStart: false,
        preserveDrawingBuffer: true,
        background: 0x000000,
        backgroundAlpha: 1,
        hello: false,
      })
      .then(() => {
        if (cancelled) {
          app.destroy();
          return;
        }
        app.ticker.stop();
        made = create(app, width, height, dpr);
        setWorld({ app, world: made });
      })
      .catch((e) => console.error("PixiJS init failed", e));
    return () => {
      cancelled = true;
      made?.destroy();
      if (made) app.destroy({ removeView: false }, { children: true, texture: true, textureSource: true });
    };
  }, [create, width, height, dpr]);

  useLayoutEffect(() => {
    if (!world) return;
    world.world.update(frame);
    world.app.render();
    if (!released.current) {
      released.current = true;
      continueRender(initHandle);
    }
  }, [world, frame, initHandle]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.floor(width * dpr)}
      height={Math.floor(height * dpr)}
      style={{ width, height, display: "block" }}
    />
  );
};
