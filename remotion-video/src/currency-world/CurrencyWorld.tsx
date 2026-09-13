import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { cameraAt, worldTransform, type CameraDirection } from "./camera";
import { BASE_HEIGHT, BASE_WIDTH, PERSPECTIVE } from "./constants";
import { place } from "./depth";
import { DotMapPlate, type PlateSpec } from "./DotMapPlate";
import "./fonts";
import { GridDecks } from "./GridDecks";
import { Hud } from "./Hud";
import { Medallions } from "./Medallions";
import { PALETTES } from "./palette";
import { PriceTags } from "./PriceTags";
import { Sparks } from "./Sparks";
import { Streaks } from "./Streaks";
import { rngFor } from "./random";

export const currencyWorldSchema = z.object({
  /** Which way the camera tracks. "ltr" matches the reference plate. */
  direction: z.enum(["ltr", "rtl"]),
  palette: z.enum(["steel", "midnight"]),
});

export type CurrencyWorldProps = z.infer<typeof currencyWorldSchema>;

// The map plates.
//
// The map is PINNED: the plates sit outside the camera rig entirely, so
// they neither pan nor dolly. They are still perspective-projected
// planes at three real depths — that is what sets their dot pitch and
// what puts them behind the token field — but the camera slides past
// them without shifting them. The whole camera move is carried by the
// currency tokens coming at the lens.
//
// Each is sized so its on-screen width covers the 1920 frame at its
// depth, at a similar dot pitch (~11-13 px), which is what makes three
// plates read as one map at three distances rather than three maps at
// three sizes.
const PLATES: PlateSpec[] = [
  {
    width: 10000,
    z: -6200,
    x: -2600,
    y: 330,
    step: 1,
    opacity: 0.34,
    dotRatio: 0.42,
    scatter: 900,
    seed: 3,
  },
  {
    width: 8200,
    z: -4300,
    x: 1900,
    y: -380,
    step: 1,
    opacity: 0.55,
    dotRatio: 0.44,
    scatter: 620,
    seed: 11,
  },
  {
    width: 6400,
    z: -2800,
    x: -600,
    y: 200,
    step: 1,
    opacity: 0.85,
    dotRatio: 0.46,
    scatter: 420,
    seed: 23,
  },
];

export const CurrencyWorld: React.FC<CurrencyWorldProps> = ({
  direction,
  palette: paletteName,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const seconds = frame / fps;

  const palette = PALETTES[paletteName];
  const cam = cameraAt(seconds, direction as CameraDirection);

  // The whole shot is authored at 1920x1080 and scaled up bodily, so
  // every composition is the same framing — 4K is a larger raster of
  // this exact scene, not a differently-composed one.
  const renderScale = width / BASE_WIDTH;

  const world = worldTransform(cam);

  const backdrop = useMemo(
    () =>
      palette.blooms
        .map(
          (b) =>
            `radial-gradient(${b.r * 1.35}% ${b.r}% at ${b.x}% ${b.y}%, ${b.color} 0%, rgba(0,0,0,0) 100%)`,
        )
        .join(","),
    [palette],
  );

  // Backdrop and haze are pinned along with the map. The warm haze
  // reads as light bleeding through the map plates, so if it drifted
  // while they held still it would give the pin away.

  return (
    <AbsoluteFill style={{ backgroundColor: palette.base, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${renderScale})`,
          transformOrigin: "0 0",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -400,
            top: -300,
            width: BASE_WIDTH + 800,
            height: BASE_HEIGHT + 600,
            backgroundImage: backdrop,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -500,
            top: -200,
            width: BASE_WIDTH + 1000,
            height: BASE_HEIGHT + 400,
            backgroundImage: `radial-gradient(48% 42% at 30% 62%, ${palette.haze} 0%, rgba(0,0,0,0) 100%), radial-gradient(36% 34% at 72% 38%, ${palette.haze} 0%, rgba(0,0,0,0) 100%)`,
            mixBlendMode: "screen",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            perspective: PERSPECTIVE,
            perspectiveOrigin: "50% 50%",
            transformStyle: "preserve-3d",
          }}
        >
          {/*
            The pinned backdrop. It sits in the same perspective stage
            but outside the camera rig, and ahead of it in paint order,
            so the map holds still behind a field that moves.
          */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 0,
              height: 0,
              transformStyle: "preserve-3d",
            }}
          >
            <GridDecks palette={palette} />
            {PLATES.map((plate, i) => (
              <DotMapPlate
                key={i}
                spec={plate}
                palette={palette}
                transform={place(plate.x, plate.y, plate.z)}
                opacity={1}
              />
            ))}
          </div>

          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 0,
              height: 0,
              transformStyle: "preserve-3d",
              transform: world,
            }}
          >
            <Hud palette={palette} camZ={cam.z} />
            <Streaks palette={palette} camZ={cam.z} />
            <PriceTags palette={palette} camZ={cam.z} frame={frame} />
            <Medallions palette={palette} camZ={cam.z} seconds={seconds} />
            <Sparks palette={palette} camZ={cam.z} seconds={seconds} />
          </div>
        </div>

        {/* Lens bloom sitting in front of the field. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(30% 26% at ${(52 + cam.sign * Math.sin(seconds * 0.4) * 6).toFixed(2)}% 34%, ${palette.ringGlow} 0%, rgba(0,0,0,0) 100%)`,
            opacity: 0.22,
            mixBlendMode: "screen",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(78% 82% at 50% 50%, rgba(0,0,0,0) 42%, ${palette.vignette} 100%)`,
          }}
        />
      </div>

      <Grain frame={frame} width={width} height={height} />
    </AbsoluteFill>
  );
};

/**
 * Fine sensor noise, laid over the finished frame.
 *
 * Drawn as a tiled SVG pattern of scattered specks rather than an
 * `feTurbulence` pass or a noise bitmap: the tile rasterises once and
 * repeats, so it costs the same at 4K as at 1080p, and there is no
 * image for Remotion to race against on the first paint of a frame.
 * Its real job is dither — without it the wide, very dark background
 * gradients band once h264 gets hold of them.
 */
const GRAIN_TILE = 160;
const GRAIN_SPECKS = 900;

const grainMarkup = (() => {
  const rand = rngFor(17, 6353);
  const specks: string[] = [];
  for (let i = 0; i < GRAIN_SPECKS; i++) {
    const x = (rand() * GRAIN_TILE).toFixed(1);
    const y = (rand() * GRAIN_TILE).toFixed(1);
    const size = (1 + rand() * 1.6).toFixed(2);
    const alpha = (0.25 + rand() * 0.75).toFixed(2);
    const tone = rand() < 0.5 ? "#ffffff" : "#000000";
    specks.push(
      `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${tone}" opacity="${alpha}"/>`,
    );
  }
  return specks.join("");
})();

const Grain: React.FC<{ frame: number; width: number; height: number }> = ({
  frame,
  width,
  height,
}) => {
  // Shuffle the tile each frame so the speckle never freezes into a
  // fixed texture stuck to the lens.
  const offsetX = (frame * 37) % GRAIN_TILE;
  const offsetY = (frame * 53) % GRAIN_TILE;
  const svg = `<defs><pattern id="cw-grain" patternUnits="userSpaceOnUse" x="${offsetX}" y="${offsetY}" width="${GRAIN_TILE}" height="${GRAIN_TILE}">${grainMarkup}</pattern></defs><rect width="100%" height="100%" fill="url(#cw-grain)"/>`;

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        opacity: 0.07,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export const currencyWorldDefaults: CurrencyWorldProps = {
  direction: "ltr",
  palette: "steel",
};
