import React, { useMemo } from "react";
import { interpolate, random } from "remotion";
import { CanvasLayer } from "./CanvasLayer";
import { fontString, MONO } from "../fonts";
import { withAlpha } from "../color";
import type { Layout } from "../layout";
import type { Palette, ResultCountConfig, Timing } from "../variants";

/** 4829110 -> "4,829,110", without depending on the renderer's locale. */
const groupDigits = (value: number): string => {
  const digits = String(Math.round(value));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) {
      out += ",";
    }
    out += digits.charAt(i);
  }
  return out;
};

/**
 * The v2 extra: a result line that appears once typing completes and keeps
 * re-rolling, as though the count were still resolving. The re-rolls are small
 * — the order of magnitude never moves — and they are picked from random() on
 * a fixed schedule, so the same numbers appear on every render.
 */
export const ResultCount: React.FC<{
  layout: Layout;
  palette: Palette;
  config: ResultCountConfig;
  timing: Timing;
  frame: number;
  seed: string;
}> = ({ layout, palette, config, timing, frame, seed }) => {
  // This variant always deletes, so the count always has a frame to fade on.
  const closeFrame = timing.deletion === null ? Infinity : timing.deletion.start;

  const rolls = useMemo(() => {
    const list: { frame: number; text: string }[] = [];
    let at = timing.typeEnd;
    let index = 0;
    const span = config.rerollMax - config.rerollMin + 1;
    while (at < closeFrame + config.fadeFrames) {
      const drift = index === 0 ? 0 : (random(`${seed}:count:${index}`) - 0.5) * 0.014;
      const count = config.baseCount * (1 + drift);
      const seconds =
        index === 0
          ? config.baseSeconds
          : config.baseSeconds * (1 + (random(`${seed}:secs:${index}`) - 0.5) * 0.2);
      list.push({
        frame: at,
        text: `${groupDigits(count)} ${config.label} (${seconds.toFixed(2)}${config.unit})`,
      });
      at += config.rerollMin + Math.floor(random(`${seed}:roll:${index}`) * span);
      index++;
    }
    return list;
  }, [config, timing, seed, closeFrame]);

  const opacity =
    frame < timing.typeEnd
      ? 0
      : interpolate(
          frame,
          [
            timing.typeEnd,
            timing.typeEnd + config.fadeFrames,
            closeFrame,
            closeFrame + config.fadeFrames,
          ],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

  let text = rolls.length > 0 ? rolls[0].text : "";
  for (let i = 0; i < rolls.length; i++) {
    if (rolls[i].frame <= frame) {
      text = rolls[i].text;
    }
  }

  const accent = palette.accent;

  return (
    <CanvasLayer
      x={layout.barX}
      y={Math.round(layout.countY - layout.countSize * 1.4)}
      width={layout.barW}
      height={Math.ceil(layout.countSize * 3)}
      draw={(ctx) => {
        if (opacity <= 0 || accent === null) {
          return;
        }
        ctx.font = fontString(400, layout.countSize, MONO);
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = withAlpha(accent, opacity);
        ctx.fillText(text, layout.barX + layout.barH * 0.42, layout.countY);
      }}
    />
  );
};
