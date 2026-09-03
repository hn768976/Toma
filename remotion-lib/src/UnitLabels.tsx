import React, { useLayoutEffect } from "react";
import { bloomPass, sharpPass } from "./effects";
import { beginScratch, claim, type Stage } from "./canvasStage";

export type UnitLabel = {
  text: string;
  /** Centre of the label, in target-space pixels. */
  x: number;
  y: number;
};

export type UnitLabelsProps = {
  stage: Stage | null;
  /** Distinguishes this instance on a shared stage. */
  id?: string;
  frame: number;
  background: string;
  labels: UnitLabel[];
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  /** Extra space added between characters. */
  letterSpacing: number;
  color: string;
};

/**
 * Short text labels painted onto a canvas stage at given points, with
 * letter-spacing and a light bloom.
 *
 * Canvas has no letter-spacing of its own, so each character is placed
 * individually and the run is centred on its measured width. Useful for
 * captions and unit labels alongside canvas-drawn artwork, where mixing
 * in DOM text would not pick up the same bloom.
 */
export const UnitLabels: React.FC<UnitLabelsProps> = ({
  stage,
  id = "unit-labels",
  frame,
  background,
  labels,
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  color,
}) => {
  useLayoutEffect(() => {
    if (!stage) return;
    const target = claim(stage, id, frame, background);
    if (!target) return;
    const ctx = beginScratch(stage);
    if (!ctx) return;

    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = color;

    for (const label of labels) {
      const chars = label.text.split("");
      const width =
        chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) +
        letterSpacing * Math.max(0, chars.length - 1);
      let x = label.x - width / 2;
      for (const char of chars) {
        ctx.fillText(char, x, label.y);
        x += ctx.measureText(char).width + letterSpacing;
      }
    }

    bloomPass(target, stage, fontSize * 0.5, 0.45);
    sharpPass(target, stage);
  }, [
    stage,
    id,
    frame,
    background,
    labels,
    fontFamily,
    fontSize,
    fontWeight,
    letterSpacing,
    color,
  ]);

  return null;
};
