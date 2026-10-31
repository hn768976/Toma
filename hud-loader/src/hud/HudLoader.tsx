import React, { useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  Easing,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  CYAN,
  drawHud,
  FONT_FAMILY,
  HudLayer,
  HudPalette,
  REGION,
  resetFontCache,
} from "./draw";

let fontPromise: Promise<void> | null = null;
const loadFont = () => {
  if (!fontPromise) {
    const face = new FontFace(
      FONT_FAMILY,
      `url(${staticFile("fonts/Orbitron-Bold.woff2")}) format("woff2")`,
      { weight: "700" },
    );
    fontPromise = face.load().then((f) => {
      document.fonts.add(f);
      resetFontCache();
    });
  }
  return fontPromise;
};

/**
 * One HUD depth layer: draws the sharp line work into an offscreen canvas, then
 * composites it with two blur passes (additive) for the neon glow.
 */
const HudCanvas: React.FC<{
  t: number;
  layers: HudLayer[];
  density: number;
  palette: HudPalette;
  style?: React.CSSProperties;
}> = ({ t, layers, density, palette, style }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const sharpRef = useRef<HTMLCanvasElement | null>(null);
  const [handle] = useState(() => delayRender("Loading HUD font"));
  const [ready, setReady] = useState(false);
  const w = Math.round(REGION.w * density);
  const h = Math.round(REGION.h * density);

  useLayoutEffect(() => {
    loadFont()
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((e) => {
        throw e;
      });
  }, [handle]);

  useLayoutEffect(() => {
    if (!ready || !ref.current) return;
    if (!sharpRef.current) sharpRef.current = document.createElement("canvas");
    const sharp = sharpRef.current;
    sharp.width = w;
    sharp.height = h;
    const s = sharp.getContext("2d");
    const out = ref.current.getContext("2d");
    if (!s || !out) return;
    s.setTransform(
      density,
      0,
      0,
      density,
      -REGION.x * density,
      -REGION.y * density,
    );
    s.clearRect(REGION.x, REGION.y, REGION.w, REGION.h);
    drawHud(s, t, layers, palette);

    out.setTransform(1, 0, 0, 1, 0, 0);
    out.clearRect(0, 0, w, h);
    out.globalCompositeOperation = "lighter";
    // wide bloom
    out.filter = `blur(${(3.2 * density).toFixed(2)}px)`;
    out.globalAlpha = 0.4;
    out.drawImage(sharp, 0, 0);
    // tight glow
    out.filter = `blur(${(0.9 * density).toFixed(2)}px)`;
    out.globalAlpha = 0.5;
    out.drawImage(sharp, 0, 0);
    // crisp core
    out.filter = "none";
    out.globalAlpha = 1;
    out.drawImage(sharp, 0, 0);
    out.globalCompositeOperation = "source-over";
  }, [ready, t, layers, density, palette, w, h]);

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      style={{ position: "absolute", width: w, height: h, ...style }}
    />
  );
};

const ALL: HudLayer[] = ["back", "mid", "front"];
const BACK: HudLayer[] = ["back"];
const MID: HudLayer[] = ["mid"];
const FRONT: HudLayer[] = ["front"];

/** Version 1: flat, locked-off framing matching the reference. */
export const HudLoaderV1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const density = width / 768; // reference was 768 px wide
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <HudCanvas
        t={frame / fps}
        layers={ALL}
        density={density}
        palette={CYAN}
        style={{ left: REGION.x * density, top: REGION.y * density }}
      />
    </AbsoluteFill>
  );
};

/**
 * Version 2: same HUD and palette, but filmed with a moving 3D camera — it starts
 * low and to the left, orbits round towards a near-frontal three-quarter view
 * while dollying in. The HUD is split into three depth layers so the move
 * reveals real parallax.
 */
export const HudLoaderV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const zoom = 1.8; // HUD drawn larger: the camera is closer than in Version 1
  const density = (width / 768) * zoom;
  const u = frame / (durationInFrames - 1);
  const ease = Easing.bezier(0.42, 0, 0.3, 1);
  const k = (a: number, b: number) =>
    interpolate(u, [0, 1], [a, b], { easing: ease });
  const unit = width / 3840; // CSS px per 4K px
  const rotY = k(38, -16);
  const rotX = k(21, 6);
  const rotZ = k(-3.5, 1.2);
  const dolly = k(-520, 160) * unit;
  const driftY = Math.sin(t * 0.55) * 14 * unit;
  const w = REGION.w * density;
  const h = REGION.h * density;
  const layerStyle = (z: number): React.CSSProperties => ({
    left: 0,
    top: 0,
    transform: `translateZ(${z * unit}px)`,
  });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        perspective: 3000 * unit,
        perspectiveOrigin: "50% 50%",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: (width - w) / 2,
          top: (height - h) / 2 + driftY,
          width: w,
          height: h,
          transformStyle: "preserve-3d",
          transform: `translateZ(${dolly}px) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`,
        }}
      >
        <HudCanvas
          t={t}
          layers={BACK}
          density={density}
          palette={CYAN}
          style={layerStyle(-110)}
        />
        <HudCanvas
          t={t}
          layers={MID}
          density={density}
          palette={CYAN}
          style={layerStyle(0)}
        />
        <HudCanvas
          t={t}
          layers={FRONT}
          density={density}
          palette={CYAN}
          style={layerStyle(130)}
        />
      </div>
    </AbsoluteFill>
  );
};
