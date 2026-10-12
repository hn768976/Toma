import { autoDetectRenderer, Renderer } from "pixi.js";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, useCurrentFrame } from "remotion";
import { ChargeIconRow } from "../versions";
import { ChargeIconScene, H, W } from "./scene";

// PixiJS 8 on WebGL2. No ticker: the stage is rendered by hand once per
// Remotion frame, from the frame number only.
export const ChargeIcon: React.FC<{ row: ChargeIconRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const hostRef = useRef<HTMLDivElement>(null);
  const [handle] = useState(() => delayRender("PixiJS init"));
  const ctx = useRef<{ renderer: Renderer; scene: ChargeIconScene } | null>(null);
  const rowRef = useRef(row);

  useEffect(() => {
    let disposed = false;
    const resolution = window.devicePixelRatio;
    // Each mount gets its own canvas, so a torn-down renderer can never take
    // the WebGL context of a live one with it.
    const canvas = document.createElement("canvas");
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.style.display = "block";
    hostRef.current!.appendChild(canvas);
    autoDetectRenderer({
      preference: "webgl",
      canvas,
      width: W,
      height: H,
      resolution,
      autoDensity: false,
      antialias: true,
      preserveDrawingBuffer: true,
      backgroundColor: 0x000000,
      hello: false,
    })
      .then((r) => {
        const renderer = r as Renderer;
        if (disposed) {
          renderer.destroy();
          return;
        }
        const scene = new ChargeIconScene(rowRef.current, resolution);
        ctx.current = { renderer, scene };
        scene.update(frameRef.current);
        scene.render(renderer);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      disposed = true;
      ctx.current?.renderer.destroy();
      ctx.current = null;
      canvas.remove();
    };
  }, [handle]);

  useLayoutEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.scene.update(frame);
    c.scene.render(c.renderer);
  }, [frame]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <div ref={hostRef} style={{ width: W, height: H }} />
    </AbsoluteFill>
  );
};
