import { useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { HYDROGEN_BLUE } from "./palette";
import { Camera, buildWorld, cameraV1, cameraV2, renderFrame } from "./scene";
import { FONT_FAMILY, SpriteSet, makeSpriteSet } from "./sprites";

export type HydrogenProps = { variant: "v1" | "v2" };

const world = buildWorld(20261113);
// Version 2 orbits the hero, so it gets its own clear zone around it and
// skips the two corner molecules that are choreographed for the V1 framing.
const worldV2 = world.filter(
  (m) => m.hero || (!m.scripted && Math.hypot(m.p0[0], m.p0[1], m.p0[2]) > 10.5),
);
let sprites: SpriteSet | null = null;
let fontPromise: Promise<void> | null = null;

const loadAssets = () => {
  if (!fontPromise) {
    fontPromise = (async () => {
      const face = new FontFace(FONT_FAMILY, `url(${staticFile("fonts/Inter-Bold.otf")})`, {
        weight: "700",
      });
      await face.load();
      document.fonts.add(face);
      sprites = makeSpriteSet(HYDROGEN_BLUE);
    })();
  }
  return fontPromise;
};

export const HydrogenMolecules: React.FC<HydrogenProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender("Loading font + building atom sprites"));
  const [ready, setReady] = useState(false);

  // Canvas backing store follows the render scale: 3840x2160 at --scale=1,
  // 1920x1080 at --scale=0.5 (devicePixelRatio is the Remotion scale).
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);

  useLayoutEffect(() => {
    loadAssets()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
  }, [handle]);

  useLayoutEffect(() => {
    if (!ready || !ref.current || !sprites) return;
    const t = frame / fps;
    const cam: Camera = variant === "v1" ? cameraV1(t) : cameraV2(t);
    renderFrame(ref.current, t, variant === "v1" ? world : worldV2, cam, sprites, HYDROGEN_BLUE, variant);
  }, [frame, fps, ready, variant, bw, bh]);

  return (
    <AbsoluteFill style={{ backgroundColor: HYDROGEN_BLUE.bgMid }}>
      <canvas ref={ref} width={bw} height={bh} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
