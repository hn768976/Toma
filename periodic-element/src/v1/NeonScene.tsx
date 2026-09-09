import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DURATION_IN_FRAMES } from "../constants";
import type { PeriodicElement } from "../data/elements";
import { CARD_FRACTION, cardLayout, nameFont, numericFont, symbolFont } from "../layout";
import { Grain } from "../Grain";
import { NeonBackground } from "./NeonBackground";

const TAU = Math.PI * 2;

const CYAN = "#3aa8ff";
const CYAN_PALE = "#bfe4ff";

/** Frames the card takes to settle from its entry angle to face-on. */
const SETTLE_FRAMES = 90;
const ENTRY_ROT_Y = 35;
const ENTRY_ROT_X = -7;
const ENTRY_ROT_Z = 4;
/** Amplitude of the hold oscillation, degrees. */
const OSCILLATION = 4;

export const NeonScene: React.FC<{ element: PeriodicElement }> = ({ element }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const t = frame / DURATION_IN_FRAMES;

  const S = height * CARD_FRACTION.neon;
  const l = cardLayout(S, "neon");

  // 1 at frame 0, 0 from frame 90 on.
  //
  // An ease-out spends most of the move in the first third: it was ~10 deg by
  // frame 30, so the entrance was over before a viewer registered it. An
  // ease-in-out holds near the entry angle, turns through the middle of the
  // window and settles in — ~30 deg at frame 30, ~5 deg at frame 60 — so the
  // rotation actually reads across the full 90 frames.
  const settle = interpolate(frame, [0, SETTLE_FRAMES], [1, 0], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // The hold oscillation is a sine of the loop, so it is zero at both frame 0
  // and frame 300 and the card ends on exactly the settle position.
  const swing = Math.sin(TAU * t);
  const rotY = ENTRY_ROT_Y * settle + OSCILLATION * swing;
  const rotX = ENTRY_ROT_X * settle + OSCILLATION * 0.3 * Math.sin(TAU * t + 1.1);
  const rotZ = ENTRY_ROT_Z * settle;

  /** Glow breathing: also a sine of the loop, so it closes. */
  const breath = 1 + Math.sin(TAU * t) * 0.11;

  const glow = (px: number, alpha: number) =>
    `0 0 ${px * breath}px rgba(58,168,255,${alpha})`;

  return (
    <AbsoluteFill style={{ backgroundColor: "#03060f" }}>
      <NeonBackground />

      <AbsoluteFill
        style={{
          perspective: height * 1.45,
          // Vanishing point on the card's own centre, which is also frame
          // centre. The card carries no translation at any point in the clip;
          // all drift belongs to the background. Do not add one here.
          perspectiveOrigin: "50% 50%",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)`,
          }}
        >
          {/* Pool of light under the card, moving with it. Kept shallow so
              the glow hugs the tube instead of spilling into the frame. */}
          <div
            style={{
              position: "absolute",
              left: -S * 0.09,
              width: S * 1.18,
              top: S * 0.97,
              height: S * 0.2,
              borderRadius: "50%",
              background: `radial-gradient(ellipse, rgba(58,168,255,${0.22 * breath}) 0%, rgba(58,168,255,0) 70%)`,
              filter: `blur(${S * 0.032}px)`,
            }}
          />

          {/* Bloom pass: a blurred copy of the tube behind the crisp one. The
              blur is on this copy only — the real outline and all the type
              stay unrasterised. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: S,
              height: S,
              borderRadius: l.radius,
              border: `${S * 0.018}px solid ${CYAN}`,
              filter: `blur(${S * 0.02}px)`,
              opacity: 0.95 * breath,
            }}
          />

          {/* Faint outer contour, echoing the tube a little way out. */}
          <div
            style={{
              position: "absolute",
              left: -S * 0.032,
              top: -S * 0.032,
              width: S * 1.064,
              height: S * 1.064,
              borderRadius: l.radius + S * 0.032,
              border: `${S * 0.004}px solid rgba(90,180,255,0.42)`,
            }}
          />

          {/* The tube itself. */}
          <div
            style={{
              position: "relative",
              width: S,
              height: S,
              borderRadius: l.radius,
              border: `${S * 0.015}px solid ${CYAN}`,
              background:
                "radial-gradient(ellipse at 50% 48%, #0b1a33 0%, #071224 55%, #050d1c 100%)",
              boxShadow: [
                // brighter inner edge, so the outline reads as a lit tube
                `inset 0 0 ${S * 0.01}px rgba(225,244,255,1)`,
                `inset 0 0 ${S * 0.038}px rgba(58,168,255,0.5)`,
                // Bright core, short falloff: reads as a lit tube rather than
                // as a lamp behind a card.
                glow(S * 0.014, 1),
                glow(S * 0.04, 0.6),
                glow(S * 0.095, 0.22),
              ].join(", "),
              overflow: "hidden",
            }}
          >
            {/* Dot-matrix texture, not a solid fill. */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "radial-gradient(circle, rgba(146,206,255,0.42) 22%, rgba(146,206,255,0) 26%)",
                backgroundSize: `${S * 0.021}px ${S * 0.021}px`,
                opacity: 0.55,
                maskImage:
                  "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,1) 20%, rgba(0,0,0,0.45) 75%)",
              }}
            />

            <div
              style={{
                position: "absolute",
                left: l.pad,
                top: l.pad,
                ...numericFont(l.metaSize),
                color: CYAN_PALE,
                textShadow: `0 0 ${S * 0.014}px rgba(58,168,255,0.8)`,
              }}
            >
              {element.number}
            </div>
            <div
              style={{
                position: "absolute",
                right: l.pad,
                top: l.pad,
                ...numericFont(l.metaSize),
                color: CYAN_PALE,
                textShadow: `0 0 ${S * 0.014}px rgba(58,168,255,0.8)`,
              }}
            >
              {element.mass}
            </div>

            {/* Symbol: a blurred cyan copy for bloom, then the crisp white
                glyphs on top so the letterforms keep their edges. */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: l.symbolCentre - l.symbolSize / 2,
                textAlign: "center",
                ...symbolFont(l.symbolSize, 700),
                color: CYAN,
                filter: `blur(${S * 0.03}px)`,
                opacity: 0.9 * breath,
              }}
            >
              {element.symbol}
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: l.symbolCentre - l.symbolSize / 2,
                textAlign: "center",
                ...symbolFont(l.symbolSize, 700),
                color: "#ffffff",
                textShadow: [
                  `0 0 ${S * 0.008}px rgba(215,242,255,1)`,
                  `0 0 ${S * 0.026}px rgba(58,168,255,0.9)`,
                  `0 0 ${S * 0.062}px rgba(58,168,255,0.45)`,
                ].join(", "),
              }}
            >
              {element.symbol}
            </div>

            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: l.nameTop,
                textAlign: "center",
              }}
            >
              <span
                style={{
                  ...nameFont(l.nameSize),
                  color: CYAN_PALE,
                  textShadow: `0 0 ${S * 0.016}px rgba(58,168,255,0.85)`,
                }}
              >
                {element.name}
              </span>
            </div>
          </div>
        </div>
      </AbsoluteFill>

      <Grain />
    </AbsoluteFill>
  );
};
