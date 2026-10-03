import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { DATA, DURATION } from "./data";
import { SCREEN_H, SCREEN_W, drawScreen } from "./draw";
import { fontsPromise, fontsReady } from "./fonts";
import { drawGrain } from "./grain";

// ---------------------------------------------------------------------------
// Camera — a pure function of the frame.
// ---------------------------------------------------------------------------
const PERSPECTIVE = 9000;

export const cameraAt = (frame: number) => {
  const t = frame / (DURATION - 1);
  // Mostly linear glide with softened ends (never stops dead).
  const s = 0.55 * t + 0.45 * (0.5 - 0.5 * Math.cos(Math.PI * t));
  return {
    tx: 1280 + (1990 - 1280) * s,
    ty: 560 + (630 - 560) * s,
    scale: 2.4 + 0.18 * t,
    rx: 15 - 1.2 * t,
    ry: -20 + 2.5 * t,
  };
};

// Depth of field: the sharp band is the line of constant depth through the
// focus point. Depth on the tilted plane grows along (sin -ry, sin rx·cos ry)
// in screen coordinates, so the band runs perpendicular to that.
const dofAngle = (rx: number, ry: number) => {
  const dx = Math.sin((-ry * Math.PI) / 180);
  const dy = Math.sin((rx * Math.PI) / 180) * Math.cos((ry * Math.PI) / 180);
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
};

// Supersample factor of the screen canvas relative to the output pixel grid.
const SCREEN_RES = 2.6;

type Props = { versionId: string };

export const Terminal: React.FC<Props> = ({ versionId }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const d = DATA[versionId];

  const sharpRef = useRef<HTMLCanvasElement>(null);
  const midRef = useRef<HTMLCanvasElement>(null);
  const farRef = useRef<HTMLCanvasElement>(null);
  const grainPlusRef = useRef<HTMLCanvasElement>(null);
  const grainDiffRef = useRef<HTMLCanvasElement>(null);

  // Canvas backing stores follow the output resolution (Remotion's --scale is
  // the device pixel ratio), so a 4K render gets 4K-crisp canvases and a 720p
  // preview doesn't pay for them.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const res = SCREEN_RES * Math.min(1, dpr);
  const cw = Math.round(SCREEN_W * res);
  const ch = Math.round(SCREEN_H * res);
  const bw = Math.round(cw / 3);
  const bh = Math.round(ch / 3);
  const gw = Math.round(width * dpr);
  const gh = Math.round(height * dpr);

  useLayoutEffect(() => {
    let cancelled = false;
    const draw = () => {
      if (cancelled) return;
      const sharp = sharpRef.current!;
      const ctx = sharp.getContext("2d")!;
      ctx.setTransform(res, 0, 0, res, 0, 0);
      drawScreen(ctx, d, frame);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (const c of [midRef.current!, farRef.current!]) {
        const bctx = c.getContext("2d")!;
        bctx.imageSmoothingQuality = "high";
        bctx.drawImage(sharp, 0, 0, c.width, c.height);
      }
      drawGrain(grainPlusRef.current!, frame, 1);
      drawGrain(grainDiffRef.current!, frame, -1);
    };
    if (fontsReady()) {
      draw();
      return () => {
        cancelled = true;
      };
    }
    const handle = delayRender("Loading fonts before drawing canvases");
    fontsPromise.then(() => {
      draw();
      continueRender(handle);
    });
    return () => {
      cancelled = true;
    };
  }, [frame, d, res]);

  const cam = cameraAt(frame);
  const transform = [
    `translate(${width / 2}px, ${height / 2}px)`,
    `perspective(${PERSPECTIVE}px)`,
    // Yaw then pitch: horizontal lines stay level, verticals lean.
    `rotateY(${cam.ry}deg)`,
    `rotateX(${cam.rx}deg)`,
    `scale(${cam.scale})`,
    `translate(${-cam.tx}px, ${-cam.ty}px)`,
  ].join(" ");

  const ang = dofAngle(cam.rx, cam.ry);
  const sharpMask = `linear-gradient(${ang}deg, transparent 22%, black 39%, black 57%, transparent 74%)`;
  const midMask = `linear-gradient(${ang}deg, transparent 6%, black 28%, black 68%, transparent 90%)`;

  const screenStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: SCREEN_W,
    height: SCREEN_H,
    transformOrigin: "0 0",
    transform,
  };

  const layer = (blur: number, mask: string | null): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    filter: blur ? `blur(${blur}px)` : undefined,
    WebkitMaskImage: mask ?? undefined,
    maskImage: mask ?? undefined,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#04070D", overflow: "hidden" }}>
      <div style={layer(15, null)}>
        <canvas ref={farRef} width={bw} height={bh} style={screenStyle} />
      </div>
      <div style={layer(5.5, midMask)}>
        <canvas ref={midRef} width={bw} height={bh} style={screenStyle} />
      </div>
      <div style={layer(0, sharpMask)}>
        <canvas ref={sharpRef} width={cw} height={ch} style={screenStyle} />
      </div>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 52% 50%, rgba(0,0,0,0) 60%, rgba(2,4,9,0.35) 100%)",
        }}
      />
      <canvas
        ref={grainPlusRef}
        width={gw}
        height={gh}
        style={{ position: "absolute", inset: 0, width, height, mixBlendMode: "plus-lighter" }}
      />
      <canvas
        ref={grainDiffRef}
        width={gw}
        height={gh}
        style={{ position: "absolute", inset: 0, width, height, mixBlendMode: "difference" }}
      />
    </AbsoluteFill>
  );
};
