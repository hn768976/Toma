import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { AiEmblem } from "./AiEmblem";
import { CodeMatrix } from "./CodeMatrix";
import { ProgressBar } from "./ProgressBar";
import {
  DURATION_IN_FRAMES,
  FONT_MONO,
  FONT_SANS,
  LIGHT,
  scaleFor,
} from "./constants";
import { getDotCount, getProgress } from "./progress";

export const aiGeneratingLightSchema = z.object({
  eyebrow: z.string(),
  headline: z.string(),
  subline: z.string(),
  steps: z.array(z.string()).length(3),
});

export const aiGeneratingLightDefaults: z.infer<
  typeof aiGeneratingLightSchema
> = {
  eyebrow: "AI ENGINE",
  headline: "Generating",
  subline: "Composing your result from the model output stream.",
  steps: ["Parsing prompt", "Running inference", "Rendering output"],
};

// Progress value at which each step flips from pending to active to done.
const STEP_AT = [0, 0.34, 0.72, 1];

type StepState = "done" | "active" | "pending";

const stepState = (i: number, progress: number): StepState => {
  if (progress >= STEP_AT[i + 1]) return "done";
  if (progress >= STEP_AT[i]) return "active";
  return "pending";
};

const StepRow: React.FC<{
  s: number;
  label: string;
  state: StepState;
  index: number;
}> = ({ s, label, state, index }) => {
  const frame = useCurrentFrame();
  const dotSize = 22 * s;
  const spin = frame * 5;

  const color =
    state === "done"
      ? LIGHT.indigo
      : state === "active"
        ? LIGHT.coral
        : LIGHT.inkFaint;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20 * s,
        height: 56 * s,
        opacity: state === "pending" ? 0.45 : 1,
      }}
    >
      <div
        style={{
          position: "relative",
          width: dotSize,
          height: dotSize,
        }}
      >
        {state === "active" ? (
          <svg
            width={dotSize}
            height={dotSize}
            viewBox="0 0 24 24"
            style={{ transform: `rotate(${spin}deg)` }}
          >
            <circle
              cx={12}
              cy={12}
              r={9}
              fill="none"
              stroke={LIGHT.coralSoft}
              strokeWidth={3}
            />
            <circle
              cx={12}
              cy={12}
              r={9}
              fill="none"
              stroke={LIGHT.coral}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray="18 40"
            />
          </svg>
        ) : (
          <svg width={dotSize} height={dotSize} viewBox="0 0 24 24">
            <circle
              cx={12}
              cy={12}
              r={9}
              fill={state === "done" ? LIGHT.indigo : "none"}
              stroke={state === "done" ? LIGHT.indigo : LIGHT.inkFaint}
              strokeWidth={2}
            />
            {state === "done" ? (
              <path
                d="M8 12.4l2.7 2.7L16.4 9"
                fill="none"
                stroke="#fff"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </svg>
        )}
      </div>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 26 * s,
          letterSpacing: 1.6 * s,
          color,
          fontWeight: state === "pending" ? 400 : 500,
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          height: 1,
          background: LIGHT.panelEdge,
          marginLeft: 8 * s,
        }}
      />
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: 20 * s,
          letterSpacing: 2 * s,
          color: LIGHT.inkFaint,
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
    </div>
  );
};

// Four bars that rise and fall like an output meter, at the foot of the card.
const ActivityMeter: React.FC<{ s: number; progress: number }> = ({
  s,
  progress,
}) => {
  const frame = useCurrentFrame();
  const bars = 18;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 7 * s,
        height: 56 * s,
      }}
    >
      {new Array(bars).fill(0).map((_, i) => {
        const wave =
          0.5 +
          0.5 *
            Math.sin(frame * 0.16 - i * 0.55) *
            Math.cos(frame * 0.055 + i * 0.21);
        const h = (12 + wave * 44) * s;
        // Bars to the left of the playhead are "written" and take the warm hue.
        const written = i / bars < progress;
        return (
          <div
            key={i}
            style={{
              width: 7 * s,
              height: h,
              borderRadius: 4 * s,
              background: written ? LIGHT.coral : LIGHT.indigoSoft,
              opacity: written ? 0.85 : 0.9,
            }}
          />
        );
      })}
    </div>
  );
};

export const AiGeneratingLight: React.FC<
  z.infer<typeof aiGeneratingLightSchema>
> = ({ eyebrow, headline, subline, steps }) => {
  const frame = useCurrentFrame();
  const { width, fps } = useVideoConfig();
  const s = scaleFor(width);
  const progress = getProgress(frame);
  const dots = getDotCount(frame);
  const percent = Math.round(progress * 100);

  // Staggered entrance — brisk, so the piece is fully assembled well inside
  // the first second and the remaining 7s belong to the loading itself.
  const enter = (delay: number) =>
    spring({
      frame: frame - delay,
      fps,
      config: { damping: 200 },
      durationInFrames: 20,
    });

  // A very slow parallax so the flat layout still breathes.
  const drift = interpolate(
    frame,
    [0, DURATION_IN_FRAMES - 1],
    [0, -26 * s],
    { easing: Easing.inOut(Easing.ease), extrapolateRight: "clamp" },
  );
  const cardFloat = Math.sin(frame * 0.045) * 9 * s;
  const cardTilt = Math.sin(frame * 0.032) * 1.6;

  return (
    <AbsoluteFill style={{ backgroundColor: LIGHT.background, overflow: "hidden" }}>
      {/* Soft colour washes */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(42% 52% at 12% 6%, rgba(58,92,224,0.16) 0%, rgba(58,92,224,0) 70%),
                       radial-gradient(46% 56% at 92% 96%, rgba(240,67,106,0.14) 0%, rgba(240,67,106,0) 72%)`,
        }}
      />

      {/* Blueprint grid */}
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${LIGHT.grid} 1px, transparent 1px),
                            linear-gradient(90deg, ${LIGHT.grid} 1px, transparent 1px)`,
          backgroundSize: `${72 * s}px ${72 * s}px`,
          transform: `translateY(${drift}px)`,
        }}
      />

      {/* --- Left column --------------------------------------------------- */}
      <div
        style={{
          position: "absolute",
          left: 150 * s,
          top: 232 * s,
          width: 900 * s,
          transform: `translateY(${drift * 0.4}px)`,
        }}
      >
        {/* Eyebrow chip */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12 * s,
            padding: `${11 * s}px ${22 * s}px`,
            borderRadius: 999,
            background: LIGHT.panel,
            border: `${1.5 * s}px solid ${LIGHT.panelEdge}`,
            boxShadow: `0 ${8 * s}px ${26 * s}px rgba(20,32,66,0.06)`,
            opacity: enter(0),
            transform: `translateY(${(1 - enter(0)) * 18 * s}px)`,
          }}
        >
          <span
            style={{
              width: 10 * s,
              height: 10 * s,
              borderRadius: "50%",
              background: LIGHT.coral,
              opacity: 0.55 + 0.45 * Math.sin(frame * 0.2),
            }}
          />
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 21 * s,
              fontWeight: 500,
              letterSpacing: 4.6 * s,
              color: LIGHT.ink,
            }}
          >
            {eyebrow}
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            marginTop: 34 * s,
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: 132 * s,
            lineHeight: 1.05,
            letterSpacing: -3 * s,
            color: LIGHT.ink,
            opacity: enter(3),
            transform: `translateY(${(1 - enter(3)) * 26 * s}px)`,
          }}
        >
          <span>{headline}</span>
          <span style={{ display: "flex", marginLeft: 14 * s, color: LIGHT.coral }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ opacity: i < dots ? 1 : 0.2 }}>
                .
              </span>
            ))}
          </span>
        </div>

        {/* Subline */}
        <div
          style={{
            marginTop: 18 * s,
            width: 720 * s,
            fontFamily: FONT_SANS,
            fontWeight: 500,
            fontSize: 30 * s,
            lineHeight: 1.5,
            color: LIGHT.inkSoft,
            opacity: enter(6) * 0.96,
            transform: `translateY(${(1 - enter(6)) * 22 * s}px)`,
          }}
        >
          {subline}
        </div>

        {/* Steps */}
        <div
          style={{
            marginTop: 46 * s,
            width: 760 * s,
            opacity: enter(9),
            transform: `translateY(${(1 - enter(9)) * 22 * s}px)`,
          }}
        >
          {steps.map((label, i) => (
            <StepRow
              key={label}
              s={s}
              label={label}
              index={i}
              state={stepState(i, progress)}
            />
          ))}
        </div>
      </div>

      {/* --- Progress row, along the foot of the left column ---------------- */}
      <div
        style={{
          position: "absolute",
          left: 150 * s,
          top: 856 * s,
          width: 980 * s,
          opacity: enter(12),
          transform: `translateY(${(1 - enter(12)) * 20 * s}px)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 18 * s,
            fontFamily: FONT_MONO,
            fontSize: 22 * s,
            letterSpacing: 4 * s,
            color: LIGHT.inkSoft,
          }}
        >
          <span>PROGRESS</span>
          <span
            style={{
              fontFamily: FONT_SANS,
              fontWeight: 700,
              fontSize: 58 * s,
              letterSpacing: -1 * s,
              color: LIGHT.ink,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {percent}
            <span style={{ fontSize: 30 * s, color: LIGHT.coral }}>%</span>
          </span>
        </div>
        <ProgressBar
          width={980 * s}
          height={16 * s}
          progress={progress}
          trackFrom={LIGHT.track}
          trackTo={LIGHT.track}
          fillFrom={LIGHT.indigo}
          fillTo={LIGHT.coral}
          sheen={false}
        />
      </div>

      {/* --- Right card ---------------------------------------------------- */}
      <div
        style={{
          position: "absolute",
          left: 1290 * s,
          top: 216 * s,
          width: 480 * s,
          height: 680 * s,
          borderRadius: 48 * s,
          background: LIGHT.panel,
          border: `${1.5 * s}px solid ${LIGHT.panelEdge}`,
          boxShadow: `0 ${40 * s}px ${90 * s}px rgba(16,26,51,0.10), 0 ${6 * s}px ${18 * s}px rgba(16,26,51,0.05)`,
          transform: `translateY(${cardFloat}px) rotate(${cardTilt}deg) scale(${0.94 + 0.06 * enter(5)})`,
          opacity: enter(5),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `${54 * s}px 0`,
          overflow: "hidden",
        }}
      >
        {/* Card texture: the model's own output, kept at a whisper and
            faded out towards the card edges so the mark stays dominant. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.16,
            WebkitMaskImage: `radial-gradient(62% 48% at 50% 46%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.35) 62%, rgba(0,0,0,0) 100%)`,
            maskImage: `radial-gradient(62% 48% at 50% 46%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.35) 62%, rgba(0,0,0,0) 100%)`,
          }}
        >
          <CodeMatrix
            width={480 * s}
            height={680 * s}
            fontSize={15 * s}
            rowHeight={24 * s}
            speed={0.28 * s}
            colors={{
              dim: LIGHT.inkFaint,
              hot: LIGHT.coral,
              accent: LIGHT.indigo,
            }}
            flicker={0.55}
          />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(70% 40% at 50% 0%, rgba(58,92,224,0.09) 0%, rgba(58,92,224,0) 70%)`,
          }}
        />

        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 20 * s,
            letterSpacing: 5 * s,
            color: LIGHT.inkFaint,
          }}
        >
          LIVE
        </div>

        <AiEmblem
          size={330 * s}
          color={LIGHT.indigo}
          accent={LIGHT.coral}
          label="AI"
          strokeScale={1.1}
        />

        <ActivityMeter s={s} progress={progress} />
      </div>

      {/* Footer rule */}
      <div
        style={{
          position: "absolute",
          left: 150 * s,
          right: 150 * s,
          top: 986 * s,
          height: 1,
          background: LIGHT.panelEdge,
          opacity: enter(15),
        }}
      />
    </AbsoluteFill>
  );
};
