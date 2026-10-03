import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { clockAt, getSeries } from "./engine/data";
import { getVersion } from "./engine/versions";
import { fontsReady } from "./fonts";
import { scratch } from "./render/canvasPool";
import { projection, VIEW_H, VIEW_W } from "./render/camera";
import { composeDof } from "./render/dof";
import { drawGrain, GRAIN_AMP } from "./render/grain";
import { SHOTS } from "./shots";

/** Largest texture side – stays inside common GPU/compositor limits. */
const MAX_TEX = 8192;

export const TerminalShot: React.FC<{ versionId: string }> = ({ versionId }) => {
  const frame = useCurrentFrame();
  const v = getVersion(versionId);
  const shot = SHOTS[v.shot];
  const series = getSeries(v);
  const cam = shot.camera(frame);
  const pr = projection(cam, shot.W, shot.H);
  // Remotion sets devicePixelRatio to the render --scale.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const [cx0, cy0, cx1, cy1] = shot.crop;
  const CW = cx1 - cx0;
  const CH = cy1 - cy0;
  const ts = Math.min(dpr * shot.oversample, MAX_TEX / CW, MAX_TEX / CH);
  const TW = Math.round(CW * ts);
  const TH = Math.round(CH * ts);
  const OW = Math.round(VIEW_W * dpr);
  const OH = Math.round(VIEW_H * dpr);

  const screenRef = useRef<HTMLCanvasElement>(null);
  const grainRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const handle = delayRender(`Drawing frame ${frame}`);
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        continueRender(handle);
      }
    };
    fontsReady.then(() => {
      const screen = screenRef.current;
      const grain = grainRef.current;
      if (!screen || !grain) return finish();
      const clock = clockAt(frame);

      // 1. Sharp screen
      const S = scratch("sharp", TW, TH);
      S.ctx.setTransform(ts, 0, 0, ts, -cx0 * ts, -cy0 * ts);
      shot.draw({ ctx: S.ctx, glow: false }, v, series, clock);

      // 2. Bloom from a quarter-res pass of only the light-emitting elements
      const q = 4;
      const G = scratch("glow", TW / q, TH / q);
      G.ctx.setTransform(ts / q, 0, 0, ts / q, (-cx0 * ts) / q, (-cy0 * ts) / q);
      shot.draw({ ctx: G.ctx, glow: true }, v, series, clock);
      const addBloom = (key: string, sigma: number, strength: number) => {
        if (strength <= 0) return;
        const B = scratch(key, G.canvas.width, G.canvas.height);
        B.ctx.filter = `blur(${((sigma * ts) / q).toFixed(3)}px)`;
        B.ctx.drawImage(G.canvas, 0, 0);
        B.ctx.filter = "none";
        S.ctx.setTransform(1, 0, 0, 1, 0, 0);
        S.ctx.globalCompositeOperation = "lighter";
        S.ctx.globalAlpha = strength;
        S.ctx.imageSmoothingQuality = "high";
        S.ctx.drawImage(B.canvas, 0, 0, TW, TH);
        S.ctx.globalAlpha = 1;
        S.ctx.globalCompositeOperation = "source-over";
      };
      addBloom("bloomTight", 5, shot.bloom.tight);
      addBloom("bloomWide", 18, shot.bloom.wide);

      // 3. Depth of field into the displayed canvas
      const [fx, fy] = shot.focus(frame);
      const zf = pr.depth(fx, fy);
      const out = screen.getContext("2d")!;
      composeDof(out, S.canvas, CW, CH, {
        ts,
        a: pr.plane.a,
        b: pr.plane.b,
        // Shift the depth plane into crop coordinates.
        c: pr.plane.c - zf + pr.plane.a * cx0 + pr.plane.b * cy0,
        k: shot.dof.k,
        max: shot.dof.max,
        base: shot.dof.base,
      });

      // 4. Grain in output pixels
      drawGrain(grain.getContext("2d")!, frame);
      finish();
    });
    return finish;
  }, [frame, shot, v, series, pr, ts, TW, TH, cx0, cy0, CW, CH]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#060B14",
        perspective: `${cam.perspective}px`,
        perspectiveOrigin: "50% 50%",
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      <canvas
        ref={screenRef}
        width={TW}
        height={TH}
        style={{
          position: "absolute",
          left: (VIEW_W - shot.W) / 2 + cx0,
          top: (VIEW_H - shot.H) / 2 + cy0,
          width: CW,
          height: CH,
          // Rotate about the centre of the full screen, not of the crop.
          transformOrigin: `${shot.W / 2 - cx0}px ${shot.H / 2 - cy0}px`,
          transform: pr.css,
          backfaceVisibility: "hidden",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 45%, rgba(2,5,12,${shot.vignette}) 100%)`,
        }}
      />
      <canvas
        ref={grainRef}
        width={OW}
        height={OH}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: VIEW_W,
          height: VIEW_H,
          mixBlendMode: "difference",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: `rgb(${GRAIN_AMP}, ${GRAIN_AMP}, ${GRAIN_AMP})`,
          mixBlendMode: "plus-lighter",
        }}
      />
    </AbsoluteFill>
  );
};
