import "./fonts";
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { z } from "zod";
import { CameraState, getCamera } from "./camera";
import { COLORS, HEIGHT, PERSPECTIVE_PX, WIDTH } from "./constants";
import { Page } from "./Page";
import { TiledImage } from "./TiledImage";

export const newspaperHeadlineSchema = z.object({
  cameraMove: z.enum(["reference", "orbit"]),
  lineOneBig: z.string(),
  lineOneSmall: z.string(),
  lineTwo: z.string(),
  kicker: z.string(),
});

export type NewspaperHeadlineProps = z.infer<typeof newspaperHeadlineSchema>;

export const newspaperHeadlineDefaults: NewspaperHeadlineProps = {
  cameraMove: "reference",
  lineOneBig: "AI Agents",
  lineOneSmall: "Now Run Entire",
  lineTwo: "Companies",
  kicker: "ANALYSIS",
};

const RGB_SPLIT_ID = "newspaper-rgb-split";

// Splits the image into R/G/B, offsets red left and blue right, and
// screens them back together: a lens chromatic-aberration glitch.
const RgbSplitFilter: React.FC<{ offset: number }> = ({ offset }) => {
  const channel = (r: number, g: number, b: number) =>
    `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`;
  return (
    <svg width={0} height={0} style={{ position: "absolute" }}>
      <filter
        id={RGB_SPLIT_ID}
        x="-2%"
        y="-2%"
        width="104%"
        height="104%"
        colorInterpolationFilters="sRGB"
      >
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values={channel(1, 0, 0)}
          result="r"
        />
        <feOffset in="r" dx={-offset} dy={offset * 0.15} result="rs" />
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values={channel(0, 1, 0)}
          result="g"
        />
        <feColorMatrix
          in="SourceGraphic"
          type="matrix"
          values={channel(0, 0, 1)}
          result="b"
        />
        <feOffset in="b" dx={offset} dy={-offset * 0.15} result="bs" />
        <feBlend in="rs" in2="g" mode="screen" result="rg" />
        <feBlend in="rg" in2="bs" mode="screen" />
      </filter>
    </svg>
  );
};

// One camera view of the tabletop: fixed perspective, world plane moved
// so the camera's target point sits at frame center.
const CameraView: React.FC<{
  cam: CameraState;
  copy: Omit<NewspaperHeadlineProps, "cameraMove">;
  style?: React.CSSProperties;
}> = ({ cam, copy, style }) => (
  <AbsoluteFill
    style={{
      perspective: PERSPECTIVE_PX,
      perspectiveOrigin: "50% 50%",
      overflow: "hidden",
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: WIDTH / 2 - cam.tx,
        top: HEIGHT / 2 - cam.ty,
        transformOrigin: `${cam.tx}px ${cam.ty}px`,
        transform: `translateZ(${cam.z}px) rotateY(${cam.ry}deg) rotateX(${cam.rx}deg) rotateZ(${cam.rz}deg)`,
      }}
    >
      <Page copy={copy} />
    </div>
  </AbsoluteFill>
);

// Moving film grain: four random tiles cycled per frame at a random
// offset. Tile is 2x so each grain reads ~1px in the 1080p deliverable.
const FilmGrain: React.FC<{ frame: number }> = ({ frame }) => (
  <TiledImage
    src={staticFile(`textures/grain-${frame % 4}.png`)}
    tileSize={1536}
    width={WIDTH}
    height={HEIGHT}
    offsetX={Math.floor(random(`gx${frame}`) * 1536)}
    offsetY={Math.floor(random(`gy${frame}`) * 1536)}
    style={{ mixBlendMode: "overlay", opacity: 0.15 }}
  />
);

// A handful of dust specks that pop for a single frame.
const Dust: React.FC<{ frame: number }> = ({ frame }) => {
  const count = Math.floor(random(`dc${frame}`) * 5);
  return (
    <AbsoluteFill>
      {new Array(count).fill(0).map((_, i) => {
        const size = 4 + random(`ds${frame}-${i}`) * 9;
        const light = random(`dl${frame}-${i}`) > 0.6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: random(`dx${frame}-${i}`) * WIDTH,
              top: random(`dy${frame}-${i}`) * HEIGHT,
              width: size,
              height: size * (0.6 + random(`dh${frame}-${i}`) * 0.8),
              borderRadius: "50%",
              backgroundColor: light
                ? "rgba(255,250,240,0.55)"
                : "rgba(20,18,16,0.5)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// Lens light: hazy violet/warm leaks drifting slowly plus one soft
// out-of-focus highlight, screened over the shot.
const LightLeaks: React.FC<{ frame: number }> = ({ frame }) => {
  const drift = frame / 300;
  const pulse = 0.85 + Math.sin(frame * 0.05) * 0.15;
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 1500px 700px at ${26 + drift * 10}% ${12 + drift * 4}%, rgba(170,125,255,${0.2 * pulse}), transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 1300px 1000px at ${96 - drift * 8}% ${70 - drift * 6}%, rgba(255,175,120,${0.13 * pulse}), transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle 70px at ${22 + drift * 3}% ${30 + drift * 1.5}%, rgba(235,235,255,0.55), transparent 100%)`,
          filter: "blur(10px)",
        }}
      />
    </AbsoluteFill>
  );
};

// Close-up newspaper headline shot: tilted page, shallow depth of
// field, glitch-in, light leaks, grain, and a muted warm grade.
// `cameraMove` picks between the reference truck and the orbit variant.
export const NewspaperHeadline: React.FC<NewspaperHeadlineProps> = ({
  cameraMove,
  ...copy
}) => {
  const frame = useCurrentFrame();
  const cam = getCamera(cameraMove, frame);

  const introFilters = [
    cam.aberration > 0.2 ? `url(#${RGB_SPLIT_ID})` : null,
    cam.introBlur > 0.2 ? `blur(${cam.introBlur}px)` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const focusMask = `radial-gradient(ellipse ${cam.focusW * WIDTH}px ${cam.focusH * HEIGHT}px at ${cam.focusX * 100}% ${cam.focusY * 100}%, black 30%, transparent 100%)`;

  // Fade up from black over the first few frames.
  const fadeIn = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.desk }}>
      <RgbSplitFilter offset={cam.aberration} />
      <AbsoluteFill
        style={{ filter: introFilters || undefined, opacity: fadeIn }}
      >
        {/* Out-of-focus pass underneath, in-focus pass masked on top. */}
        <CameraView
          cam={cam}
          copy={copy}
          style={{ filter: `blur(${cam.dofBlur}px)` }}
        />
        <CameraView
          cam={cam}
          copy={copy}
          style={{ maskImage: focusMask, WebkitMaskImage: focusMask }}
        />
      </AbsoluteFill>

      <LightLeaks frame={frame} />

      {/* Grade: darker, slightly cool top falloff + warm multiply + vignette. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(24,26,38,0.3), rgba(24,26,38,0) 30%)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundColor: "#f1dcc0",
          mixBlendMode: "multiply",
          opacity: 0.14,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 75% 75% at 52% 48%, rgba(0,0,0,0) 60%, rgba(8,6,10,0.38) 100%)",
        }}
      />

      <Dust frame={frame} />
      <FilmGrain frame={frame} />
    </AbsoluteFill>
  );
};
