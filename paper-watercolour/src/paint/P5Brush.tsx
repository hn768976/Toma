import React, { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import p5 from "p5";
import * as brush from "p5.brush";

export type Brush = typeof brush;
export type P5Draw = (p: p5, b: Brush, frame: number) => void;

/**
 * One p5 instance in instance mode, WEBGL, noLoop(). Remotion drives every
 * redraw: each frame clears the canvas and repaints from scratch with the
 * same seeds, so nothing accumulates between frames.
 */
export const P5Brush: React.FC<{ width: number; height: number; seed: number; draw: P5Draw }> = ({
  width,
  height,
  seed,
  draw,
}) => {
  const frame = useCurrentFrame();
  const host = useRef<HTMLDivElement>(null);
  const inst = useRef<p5 | null>(null);
  const frameRef = useRef(frame);
  const doneRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const [mountHandle] = useState(() => delayRender("p5 setup", { timeoutInMilliseconds: 600_000 }));
  const readyFlag = useRef(false);
  readyFlag.current = ready;

  useLayoutEffect(() => {
    const instance = new p5((p: p5) => {
      brush.instance(p);
      p.setup = () => {
        p.pixelDensity(1);
        p.createCanvas(width, height, p.WEBGL);
        p.noLoop();
        setReady(true);
        continueRender(mountHandle);
      };
      p.draw = () => {
        if (!readyFlag.current) return;
        const t0 = performance.now();
        p.clear();
        p.background(255);
        p.randomSeed(seed);
        p.noiseSeed(seed);
        brush.seed(seed);
        brush.noiseSeed(seed);
        p.push();
        p.translate(-width / 2, -height / 2);
        draw(p, brush, frameRef.current);
        p.pop();
        // eslint-disable-next-line no-console
        console.log(`P5BRUSH_DRAW frame=${frameRef.current} ms=${(performance.now() - t0).toFixed(1)}`);
        doneRef.current?.();
        doneRef.current = null;
      };
    }, host.current!);
    inst.current = instance;
    return () => instance.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => {
    if (!ready || !inst.current) return;
    const h = delayRender(`p5 frame ${frame}`, { timeoutInMilliseconds: 600_000 });
    frameRef.current = frame;
    doneRef.current = () => continueRender(h);
    const r = inst.current.redraw() as unknown;
    if (r && typeof (r as Promise<void>).then === "function") (r as Promise<void>).catch((e) => console.error(e));
  }, [frame, ready]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#fff" }}>
      <div ref={host} style={{ width, height }} />
    </AbsoluteFill>
  );
};
