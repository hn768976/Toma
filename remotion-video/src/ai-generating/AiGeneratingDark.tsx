import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { AiEmblem } from "./AiEmblem";
import { CodeMatrix } from "./CodeMatrix";
import { ProgressBar } from "./ProgressBar";
import {
  DARK,
  DURATION_IN_FRAMES,
  FONT_MONO,
  FONT_SANS,
  scaleFor,
} from "./constants";
import { getDotCount, getProgress } from "./progress";
import { mulberry32 } from "../particle-ring/random";

export const aiGeneratingDarkSchema = z.object({
  badgeLabel: z.string(),
  headline: z.string(),
  statusLine: z.string(),
});

export const aiGeneratingDarkDefaults: z.infer<typeof aiGeneratingDarkSchema> = {
  badgeLabel: "AI",
  headline: "Generating",
  statusLine: "MODEL · INFERENCE · STREAM",
};

// Plane geometry, at 1x. The plane is much larger than the frame so its
// edges never enter shot while the camera drifts.
const PLANE_W = 5600;
const PLANE_H = 3800;

type ContentProps = {
  s: number;
  progress: number;
  dots: number;
  badgeLabel: string;
  headline: string;
  statusLine: string;
  /** Bloom pass draws only the emitting elements, blurred and screened. */
  bloom?: boolean;
};

// Emblem + wordmark + bar, laid out in the plane's own flat coordinate
// space. Drawn twice: once sharp, once blurred underneath as a bloom pass.
const PlaneUi: React.FC<ContentProps> = ({
  s,
  progress,
  dots,
  badgeLabel,
  headline,
  statusLine,
  bloom = false,
}) => {
  const glow = bloom ? 0 : 1;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Circular AI mark */}
      <div
        style={{
          position: "absolute",
          left: 1975 * s,
          top: 1230 * s,
        }}
      >
        <AiEmblem
          size={430 * s}
          color={DARK.emblem}
          accent={DARK.ink}
          label={badgeLabel}
          glow={glow * 13 * s}
          strokeScale={1.15}
        />
      </div>

      {/* Wordmark */}
      <div
        style={{
          position: "absolute",
          left: 2295 * s,
          top: 1650 * s,
          display: "flex",
          alignItems: "flex-end",
          fontFamily: FONT_SANS,
          fontWeight: 500,
          fontSize: 146 * s,
          lineHeight: 1,
          color: DARK.ink,
          letterSpacing: -1.5 * s,
          textShadow: bloom
            ? undefined
            : `0 0 ${18 * s}px rgba(88, 168, 255, 0.5)`,
        }}
      >
        <span>{headline}</span>
        <span style={{ display: "flex", marginLeft: 24 * s }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                opacity: i < dots ? 1 : 0.18,
                marginLeft: i === 0 ? 0 : 10 * s,
              }}
            >
              .
            </span>
          ))}
        </span>
      </div>

      {/* Status caption */}
      <div
        style={{
          position: "absolute",
          left: 2306 * s,
          top: 1862 * s,
          fontFamily: FONT_MONO,
          fontWeight: 400,
          fontSize: 30 * s,
          letterSpacing: 7 * s,
          color: DARK.emblem,
          opacity: 0.5,
        }}
      >
        {statusLine}
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: "absolute",
          left: 2140 * s,
          top: 1995 * s,
        }}
      >
        <ProgressBar
          width={1700 * s}
          height={46 * s}
          progress={progress}
          trackFrom={DARK.trackTop}
          trackTo={DARK.trackBottom}
          fillFrom={DARK.fillHot}
          fillTo={DARK.fillDeep}
          glow={bloom ? 0 : 12 * s}
        />
      </div>
    </div>
  );
};

// Dust motes floating between the camera and the plane.
const Motes: React.FC<{ s: number; width: number; height: number }> = ({
  s,
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const count = 46;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {new Array(count).fill(0).map((_, i) => {
        const rand = mulberry32(i * 7681 + 13);
        const x0 = rand() * width;
        const y0 = rand() * height;
        const size = (1.4 + rand() * 4.2) * s;
        const speed = 0.18 + rand() * 0.55;
        const phase = rand() * Math.PI * 2;
        const cold = rand() > 0.45;

        const y = (y0 - frame * speed * s * 1.6 + height * 2) % height;
        const x = x0 + Math.sin(frame * 0.017 + phase) * 26 * s;
        const twinkle =
          0.25 + 0.75 * (0.5 + 0.5 * Math.sin(frame * 0.06 + phase * 3));

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: cold ? DARK.codeAccent : DARK.codeHot,
              opacity: twinkle * 0.5,
              filter: `blur(${size * 0.35}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const AiGeneratingDark: React.FC<
  z.infer<typeof aiGeneratingDarkSchema>
> = ({ badgeLabel, headline, statusLine }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = scaleFor(width);
  const progress = getProgress(frame);
  const dots = getDotCount(frame);

  const ease = Easing.inOut(Easing.ease);
  const range: [number, number] = [0, DURATION_IN_FRAMES - 1];
  const opts = {
    easing: ease,
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
  };

  // Camera: starts low and close on the left of the plane, then lifts,
  // straightens and pulls back — one continuous move, no cuts.
  const rotX = interpolate(frame, range, [62, 51], opts);
  const rotZ = interpolate(frame, range, [-22, -10], opts);
  const dolly = interpolate(frame, range, [120 * s, -520 * s], opts);
  const panX = interpolate(frame, range, [0, 0], opts);
  const panY = interpolate(frame, range, [0, 0], opts);

  const planeTransform = [
    `translate(-50%, -50%)`,
    `rotateX(${rotX}deg)`,
    `rotateZ(${rotZ}deg)`,
    `translateZ(${dolly}px)`,
    `translate(${panX}px, ${panY}px)`,
  ].join(" ");

  const uiProps = {
    s,
    progress,
    dots,
    badgeLabel,
    headline,
    statusLine,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: DARK.background, overflow: "hidden" }}>
      {/* Ambient glow behind the plane */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(58% 48% at 46% 46%, ${DARK.backgroundGlow} 0%, rgba(4,6,15,0) 72%)`,
        }}
      />

      <AbsoluteFill
        style={{
          perspective: 2100 * s,
          perspectiveOrigin: "50% 6%",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: PLANE_W * s,
            height: PLANE_H * s,
            transform: planeTransform,
            transformStyle: "preserve-3d",
            backfaceVisibility: "hidden",
          }}
        >
          {/* Code field */}
          <CodeMatrix
            width={PLANE_W * s}
            height={PLANE_H * s}
            fontSize={26 * s}
            rowHeight={41 * s}
            speed={0.38 * s}
            colors={{
              dim: DARK.codeCool,
              hot: DARK.codeHot,
              accent: DARK.codeAccent,
            }}
            opacity={0.96}
          />

          {/* Second, denser field offset behind for depth */}
          <div style={{ position: "absolute", inset: 0, opacity: 0.4 }}>
            <CodeMatrix
              width={PLANE_W * s}
              height={PLANE_H * s}
              fontSize={17 * s}
              rowHeight={26 * s}
              speed={0.62 * s}
              colors={{
                dim: DARK.codeCool,
                hot: DARK.codeMid,
                accent: DARK.codeAccentSoft,
              }}
              opacity={0.5}
              flicker={0.6}
            />
          </div>

          {/* Darkening wash so the UI reads over the code */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(34% 26% at 46% 50%, rgba(3,5,12,0.7) 0%, rgba(3,5,12,0.22) 62%, rgba(3,5,12,0) 100%)`,
            }}
          />

          {/* Bloom pass */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              filter: `blur(${14 * s}px)`,
              opacity: 0.6,
              mixBlendMode: "screen",
            }}
          >
            <PlaneUi {...uiProps} bloom />
          </div>

          <PlaneUi {...uiProps} />
        </div>
      </AbsoluteFill>

      <Motes s={s} width={width} height={height} />

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(78% 72% at 50% 48%, rgba(0,0,0,0) 42%, ${DARK.vignette} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
