import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { DURATION_IN_FRAMES } from "../constants";
import type { PeriodicElement } from "../data/elements";
import {
  CARD_FRACTION,
  cardLayout,
  nameFont,
  numericFont,
  symbolBaselineFromTop,
  symbolFont,
} from "../layout";
import { Grain } from "../Grain";
import { MetallicBackground } from "./MetallicBackground";

const TAU = Math.PI * 2;

/** Peak swing either side of face-on. Never far enough to go edge-on. */
const SWING_DEGREES = 25;

/** Brushed-metal ramp for the symbol. Offsets are in gradient space. */
const METAL_STOPS: [number, string][] = [
  [0.0, "#6a7079"],
  [0.16, "#cfd6de"],
  [0.32, "#ffffff"],
  [0.44, "#98a0aa"],
  [0.58, "#eef2f6"],
  [0.74, "#7d838d"],
  [0.88, "#e0e5eb"],
  [1.0, "#6a7079"],
];

export const MetallicScene: React.FC<{ element: PeriodicElement }> = ({
  element,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const t = frame / DURATION_IN_FRAMES;

  const S = height * CARD_FRACTION.metallic;
  const l = cardLayout(S, "metallic");

  // A full swing cycle across the loop: 0 -> +25 -> 0 -> -25 -> 0.
  const swing = Math.sin(TAU * t);
  const rotY = SWING_DEGREES * swing;
  const rotX = 2.2 * Math.sin(TAU * t + Math.PI / 2);

  // Everything reflective is keyed off the same swing value, so highlights
  // travel with the surface instead of sitting on it like print.
  const metalShift = -swing * 0.34;
  const sheenPos = 50 - swing * 38;
  const framePos = 50 + swing * 32;

  const gradientId = `brushed-${element.symbol}`;
  const hairlineLight = "rgba(238,242,247,0.92)";
  const hairlineDark = "rgba(122,128,137,0.75)";

  return (
    <AbsoluteFill style={{ backgroundColor: "#05020a" }}>
      <MetallicBackground />

      <AbsoluteFill
        style={{
          perspective: height * 1.6,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Contact shadow. Outside the rotating group so it stays flat on the
            ground plane, but driven by the same swing so it tracks the card. */}
        <div
          style={{
            position: "absolute",
            width: S * 1.1,
            height: S * 0.15,
            top: `calc(50% + ${S * 0.5}px)`,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.72)",
            filter: `blur(${S * 0.05}px)`,
            transform: `translateX(${-swing * S * 0.09}px) scaleX(${1 - Math.abs(swing) * 0.12})`,
            opacity: 0.8,
          }}
        />

        <div
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          }}
        >
          {/* Outer frame: a thin metallic band, brighter along the upper-left
              edge as if catching the light. */}
          <div
            style={{
              width: S,
              height: S,
              boxSizing: "border-box",
              padding: S * 0.021,
              borderStyle: "solid",
              borderWidth: S * 0.0035,
              borderTopColor: hairlineLight,
              borderLeftColor: hairlineLight,
              borderRightColor: hairlineDark,
              borderBottomColor: hairlineDark,
              background: `linear-gradient(128deg, #b8bec6 0%, #6c727b 16%, #e8ecf1 32%, #5c626b 48%, #b0b6be 64%, #6e747d 82%, #d8dde3 100%)`,
              backgroundSize: "260% 260%",
              backgroundPosition: `${framePos}% 50%`,
              boxShadow: `0 ${S * 0.02}px ${S * 0.06}px rgba(0,0,0,0.55)`,
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                border: `${S * 0.003}px solid rgba(196,202,211,0.7)`,
                background:
                  "linear-gradient(180deg, #131118 0%, #0b0a10 52%, #060509 100%)",
                overflow: "hidden",
              }}
            >
              {/* Glassy sheen. Slides across as the card turns. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(118deg, rgba(255,255,255,0) 30%, rgba(214,226,255,0.075) 46%, rgba(255,255,255,0.02) 54%, rgba(255,255,255,0) 68%)`,
                  backgroundSize: "300% 100%",
                  backgroundPosition: `${sheenPos}% 0%`,
                }}
              />

              <div
                style={{
                  position: "absolute",
                  left: l.pad,
                  top: l.pad,
                  ...numericFont(l.metaSize),
                  color: "#c1c6ce",
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
                  color: "#c1c6ce",
                }}
              >
                {element.mass}
              </div>

              {/* Symbol as live SVG text with a gradient fill. It stays vector
                  under the 3D transform, and the gradient is translated by the
                  same swing value that drives the rotation. */}
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${S} ${S}`}
                style={{ position: "absolute", inset: 0 }}
              >
                <defs>
                  <linearGradient
                    id={gradientId}
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0.85"
                    spreadMethod="reflect"
                    gradientTransform={`translate(${metalShift} 0)`}
                  >
                    {METAL_STOPS.map(([offset, colour]) => (
                      <stop key={offset} offset={offset} stopColor={colour} />
                    ))}
                  </linearGradient>
                  <filter id="metal-lift" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation={S * 0.012} />
                  </filter>
                </defs>
                {/* Faint lift under the highlight — the only bloom in V2. */}
                <text
                  x={S / 2}
                  y={symbolBaselineFromTop(S, "metallic")}
                  textAnchor="middle"
                  fill="#e9eef4"
                  opacity={0.28}
                  filter="url(#metal-lift)"
                  style={symbolFont(l.symbolSize, 600)}
                >
                  {element.symbol}
                </text>
                <text
                  x={S / 2}
                  y={symbolBaselineFromTop(S, "metallic")}
                  textAnchor="middle"
                  fill={`url(#${gradientId})`}
                  style={symbolFont(l.symbolSize, 600)}
                >
                  {element.symbol}
                </text>
              </svg>

              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: l.nameTop,
                  textAlign: "center",
                }}
              >
                <span style={{ ...nameFont(l.nameSize), color: "#cbd0d8" }}>
                  {element.name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>

      <Grain />
    </AbsoluteFill>
  );
};
