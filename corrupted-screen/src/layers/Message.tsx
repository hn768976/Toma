import React from "react";
import { bandRange, bandsCovering } from "../lib/plane";
import { hash, seedOf, signed } from "../lib/rand";
import { maskColor, maskRgba, Theme } from "../lib/theme";
import { MONO_FAMILY } from "../loadFonts";

/**
 * Layer 6: the warning message.
 *
 * It sits on the glass, so it takes the same slice tearing and channel split as
 * everything else. The two colour passes are pre-masked so screening them back
 * together reproduces the message colour exactly, and the block is cut into the
 * same horizontal bands the corruption uses - which is what makes the text tear
 * in lockstep with the plate behind it. It is never perfectly clean.
 */

const LINES = ["YOUR COMPUTER", "IS UNDER OUR CONTROL"];

const DROPOUT = seedOf("message/dropout");
const SHIVER = seedOf("message/shiver");
const FLICKER = seedOf("message/flicker");

/** Vertical extent of the message block inside the plane. */
const BOX_TOP = 0.36;
const BOX_HEIGHT = 0.29;
const RULE_ALPHA = 0.5;

type PassProps = {
  planeWidth: number;
  planeHeight: number;
  textColor: string;
  ruleColor: string;
  offset: number;
  blend: React.CSSProperties["mixBlendMode"];
  hiddenLine: number;
};

const Pass: React.FC<PassProps> = ({
  planeWidth,
  planeHeight,
  textColor,
  ruleColor,
  offset,
  blend,
  hiddenLine,
}) => {
  const fontSize = planeWidth * 0.0135;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: planeWidth,
        height: planeHeight,
        transform: `translateX(${offset}px)`,
        mixBlendMode: blend,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          marginTop: -planeHeight * 0.035,
          marginRight: planeWidth * 0.06,
          padding: `${fontSize * 0.7}px ${fontSize * 1.1}px`,
          border: `${Math.max(2, fontSize * 0.028)}px solid ${ruleColor}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: fontSize * 0.85,
        }}
      >
        {LINES.map((line, i) => (
          <div
            key={line}
            style={{
              fontFamily: MONO_FAMILY,
              fontSize,
              letterSpacing: "0.3em",
              // The trailing letter-space would otherwise push the line left.
              textIndent: "0.3em",
              lineHeight: 1,
              color: textColor,
              whiteSpace: "pre",
              opacity: hiddenLine === i ? 0 : 1,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
};

type Props = {
  theme: Theme;
  planeWidth: number;
  planeHeight: number;
  frame: number;
  level: number;
  /** Per band offsets shared with the corruption canvas. */
  tear: number[];
  split: number;
};

export const Message: React.FC<Props> = ({
  theme,
  planeWidth,
  planeHeight,
  frame,
  level,
  tear,
  split,
}) => {
  const top = planeHeight * BOX_TOP;
  const height = planeHeight * BOX_HEIGHT;
  const bands = bandsCovering(top, height, planeHeight);

  // Single frame dropouts: a whole line disappears now and then.
  const hiddenLine =
    hash(DROPOUT, frame) < 0.02 + level * 0.07 ? (hash(DROPOUT, frame, 1) < 0.5 ? 0 : 1) : -1;

  const textA = maskColor(theme.message, theme.splitA);
  const textB = maskColor(theme.message, theme.splitB);
  const ruleA = maskRgba(theme.messageRule, theme.splitA, RULE_ALPHA);
  const ruleB = maskRgba(theme.messageRule, theme.splitB, RULE_ALPHA);

  const shiverSlot = Math.floor(frame / 3);
  const shiverMax = planeWidth * (0.002 + level * 0.022);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: 0.86 + 0.14 * hash(FLICKER, frame),
        pointerEvents: "none",
      }}
    >
      {bands.map((i) => {
        const band = bandRange(i, planeHeight);
        const shiver =
          hash(SHIVER, i, shiverSlot) < 0.03 + level * 0.22
            ? Math.round((signed(SHIVER, i, shiverSlot, 1) * shiverMax) / 2) * 2
            : 0;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: band.top,
              width: planeWidth,
              height: band.height,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: -band.top,
                width: planeWidth,
                height: planeHeight,
                transform: `translateX(${tear[i] + shiver}px)`,
              }}
            >
              <Pass
                planeWidth={planeWidth}
                planeHeight={planeHeight}
                textColor={textA}
                ruleColor={ruleA}
                offset={-split}
                blend="normal"
                hiddenLine={hiddenLine}
              />
              <Pass
                planeWidth={planeWidth}
                planeHeight={planeHeight}
                textColor={textB}
                ruleColor={ruleB}
                offset={split}
                blend="screen"
                hiddenLine={hiddenLine}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
