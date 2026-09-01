import React from "react";
import { Easing, random } from "remotion";
import { CanvasLayer } from "./CanvasLayer";
import { black } from "../color";
import type { Layout } from "../layout";
import type { PointerAnchor, PointerScript, UiPalette } from "../variants";

/**
 * A mouse pointer that drives the search.
 *
 * Two details do all the work of making it read as a hand rather than a
 * tween. It travels on a slight ARC — a quadratic bezier bowed off the
 * straight line — because a real hand pivots around a wrist and never moves in
 * a straight line. And it eases out hard: ease-out-cubic puts 94% of the
 * distance in the first 60% of the move, so it arrives fast and settles,
 * instead of gliding in at constant speed like a screen recording of a robot.
 */

/** The classic arrow, tip at the origin, angled down and to the right. */
const ARROW: [number, number][] = [
  [0, 0],
  [0, 1],
  [0.28, 0.78],
  [0.44, 1.16],
  [0.59, 1.09],
  [0.44, 0.72],
  [0.72, 0.72],
];
const ARROW_HEIGHT = 1.16;

/** Height of the pointer as a fraction of the frame. */
const POINTER_SIZE = 0.022;
const CLICK_SCALE = 0.92;
const CLICK_FRAMES = 3;

const resolve = (anchor: PointerAnchor, layout: Layout) => ({
  x: layout.barX + anchor.x * layout.barW,
  y: layout.iconCy + anchor.y * layout.barH,
});

type Point = { x: number; y: number };

/**
 * The control point that bows the path. It is offset perpendicular to the
 * travel and always towards the top of the frame, so the pointer rises out of
 * the move and settles down into its target.
 */
const controlPoint = (from: Point, to: Point, seed: string, index: number): Point => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) {
    return from;
  }
  let px = dy / distance;
  let py = -dx / distance;
  if (py > 0) {
    px = -px;
    py = -py;
  }
  const bow = distance * (0.12 + random(`${seed}:bow:${index}`) * 0.1);
  return { x: (from.x + to.x) / 2 + px * bow, y: (from.y + to.y) / 2 + py * bow };
};

const quadratic = (a: Point, c: Point, b: Point, t: number): Point => {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
};

const ease = Easing.out(Easing.cubic);

/** Where the pointer is on this frame, following the script. */
const positionAt = (
  frame: number,
  script: PointerScript,
  layout: Layout,
  seed: string,
): Point => {
  let from = resolve(script.from, layout);
  for (let i = 0; i < script.moves.length; i++) {
    const move = script.moves[i];
    const to = resolve(move.to, layout);
    if (frame >= move.end) {
      from = to;
      continue;
    }
    if (frame <= move.start) {
      return from;
    }
    const t = (frame - move.start) / (move.end - move.start);
    return quadratic(from, controlPoint(from, to, seed, i), to, ease(t));
  }
  return from;
};

export const PointerCursor: React.FC<{
  layout: Layout;
  ui: UiPalette;
  script: PointerScript;
  frame: number;
  height: number;
  seed: string;
}> = ({ layout, ui, script, frame, height, seed }) => {
  const size = height * POINTER_SIZE;
  const unit = size / ARROW_HEIGHT;
  const at = positionAt(frame, script, layout, seed);

  let scale = 1;
  for (let i = 0; i < script.clicks.length; i++) {
    const click = script.clicks[i];
    if (frame >= click && frame < click + CLICK_FRAMES) {
      scale = CLICK_SCALE;
    }
  }

  const pad = unit * 0.5;
  const boxW = Math.ceil(unit * 2);
  const boxH = Math.ceil(unit * 2.4);

  return (
    <CanvasLayer
      x={Math.round(at.x - pad)}
      y={Math.round(at.y - pad)}
      width={boxW}
      height={boxH}
      draw={(ctx) => {
        ctx.save();
        // The tip stays put while the pointer dips on a click.
        ctx.translate(at.x, at.y);
        ctx.scale(unit * scale, unit * scale);

        ctx.beginPath();
        ctx.moveTo(ARROW[0][0], ARROW[0][1]);
        for (let i = 1; i < ARROW.length; i++) {
          ctx.lineTo(ARROW[i][0], ARROW[i][1]);
        }
        ctx.closePath();

        ctx.shadowColor = black(0.4);
        ctx.shadowOffsetX = unit * 0.09 * scale;
        ctx.shadowOffsetY = unit * 0.12 * scale;
        ctx.shadowBlur = unit * 0.22 * scale;
        ctx.fillStyle = ui.pointerFill;
        ctx.fill();

        ctx.shadowColor = black(0);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.lineJoin = "round";
        ctx.strokeStyle = ui.pointerOutline;
        ctx.lineWidth = 0.055;
        ctx.stroke();
        ctx.restore();
      }}
    />
  );
};
