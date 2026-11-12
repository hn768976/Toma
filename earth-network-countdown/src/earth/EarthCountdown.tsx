import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { HUD_FONT, HUD_RECT_4K, createHudCanvas, drawHud } from "./hud";
import { Vec3, lerp } from "./math";
import { buildNetwork, buildStars } from "./network";
import { AURORA_PALETTE, SUNRISE_PALETTE } from "./palette";
import { CameraRig, EarthRenderer } from "./renderer";
import { glitchAt, sunState, timecode } from "./timeline";

export type EarthVariant = "sunrise" | "aurora";
export type EarthCountdownProps = { variant: EarthVariant };

const FOV = (40 * Math.PI) / 180;
const DIST = 1.62; // camera distance from the planet centre (radius = 1)
const ALPHA = Math.asin(1 / DIST); // angular radius of the planet
const TOP = Math.atan(0.205 * Math.tan(FOV / 2)); // horizon sits just below frame centre
const BETA = ALPHA + TOP; // angle of the planet centre below the view axis

const rigAt = (t: number): CameraRig => {
  // A very slow push-in keeps the frame alive, the Earth turns underneath.
  const dist = lerp(DIST, DIST - 0.025, t / 29.7);
  const center: Vec3 = [0, -Math.sin(BETA) * dist, -Math.cos(BETA) * dist];
  return {
    fov: FOV,
    center,
    axis: [0.12, 1, 0.3],
    angle: 2.2 + t * 0.016,
  };
};

let fontPromise: Promise<void> | null = null;
const loadFonts = () => {
  if (!fontPromise) {
    const faces = [
      new FontFace(HUD_FONT, `url(${staticFile("fonts/exo-2-latin-400-normal.woff2")}) format("woff2")`, {
        weight: "400",
      }),
      new FontFace(HUD_FONT, `url(${staticFile("fonts/exo-2-latin-600-normal.woff2")}) format("woff2")`, {
        weight: "600",
      }),
    ];
    fontPromise = Promise.all(faces.map((f) => f.load())).then((loaded) => {
      loaded.forEach((f) => document.fonts.add(f));
    });
  }
  return fontPromise;
};

export const EarthCountdown: React.FC<EarthCountdownProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<EarthRenderer | null>(null);
  const hudRef = useRef<HTMLCanvasElement | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading HUD font"));

  const palette = variant === "aurora" ? AURORA_PALETTE : SUNRISE_PALETTE;
  const scale = width / 3840;

  const data = useMemo(
    () => ({ net: buildNetwork(2024), stars: buildStars(520, 99, Math.tan(FOV / 2), width / height) }),
    [width, height],
  );

  useEffect(() => {
    loadFonts()
      .then(() => {
        setFontsReady(true);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);

  useLayoutEffect(() => {
    if (!fontsReady) return;
    hudRef.current = createHudCanvas(scale);
    const r = new EarthRenderer(canvasRef.current!, palette, data.net, data.stars, hudRef.current, HUD_RECT_4K);
    rendererRef.current = r;
    return () => {
      r.dispose();
      rendererRef.current = null;
    };
  }, [fontsReady, palette, data, scale]);

  useLayoutEffect(() => {
    const r = rendererRef.current;
    const hud = hudRef.current;
    if (!r || !hud) return;
    const t = frame / fps;
    const sun = sunState(t);
    const g = glitchAt(frame);
    drawHud(hud, scale, timecode(frame), palette);
    r.render({
      time: t,
      rig: rigAt(t),
      sunX: sun.x,
      sunFlare: sun.flare,
      rimWarmth: sun.rim,
      glitch: g.amount,
      glitchSeed: g.seed,
      networkGain: 1,
    });
  }, [frame, fps, palette, scale, fontsReady]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
