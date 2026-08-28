import { useLayoutEffect, useMemo } from "react";
import { random } from "remotion";
import { HEIGHT, WIDTH } from "../constants";
import { onPlaneCtx, rgba, useScene } from "../scene";

/**
 * The deepest bucket: a gradient wash, big faint circles and arc fragments
 * far behind the HUD, and a few soft diagonal streaks in the upper left.
 *
 * None of it changes over the loop, so the whole layer is drawn once into an
 * offscreen canvas and blitted afterwards. The plane's ambient drift is a
 * pure translation, so it can be applied at blit time rather than redrawn.
 */
export const BackgroundLayer: React.FC = () => {
  const { buffers, palette, drift, seed } = useScene();
  const layer = buffers.far;

  const plate = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(WIDTH * layer.scale);
    canvas.height = Math.round(HEIGHT * layer.scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire a 2D context for the background plate");

    // Deep wash: brightest behind the glyph, falling to near-black at the
    // corners. Drawn square to the frame — this is the ground, not an
    // element on the plane.
    ctx.setTransform(layer.scale, 0, 0, layer.scale, 0, 0);
    ctx.fillStyle = palette.backgroundDeep;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const wash = ctx.createRadialGradient(
      WIDTH * 0.44,
      HEIGHT * 0.46,
      HEIGHT * 0.05,
      WIDTH * 0.44,
      HEIGHT * 0.46,
      HEIGHT * 1.15,
    );
    wash.addColorStop(0, rgba(palette.backgroundWash, 0.95));
    wash.addColorStop(0.45, rgba(palette.backgroundWash, 0.4));
    wash.addColorStop(1, rgba(palette.backgroundDeep, 0));
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const linear = ctx.createLinearGradient(0, HEIGHT, WIDTH, 0);
    linear.addColorStop(0, rgba(palette.backgroundDeep, 0.6));
    linear.addColorStop(0.5, rgba(palette.backgroundWash, 0.1));
    linear.addColorStop(1, rgba(palette.backgroundDeep, 0.65));
    ctx.fillStyle = linear;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    onPlaneCtx(ctx, { x: 0, y: 0 }, layer.scale, (c) => {
      c.lineCap = "round";

      // Big circular outlines and arc fragments, very low contrast.
      for (let i = 0; i < 5; i++) {
        const cx = WIDTH * (0.12 + random(`${seed}-circ-x-${i}`) * 0.86);
        const cy = HEIGHT * (0.1 + random(`${seed}-circ-y-${i}`) * 0.85);
        const radius = 240 + random(`${seed}-circ-r-${i}`) * 620;
        c.strokeStyle = rgba(palette.tickPale, 0.1);
        c.lineWidth = 3 + random(`${seed}-circ-w-${i}`) * 4;
        c.beginPath();
        c.arc(cx, cy, radius, 0, Math.PI * 2);
        c.stroke();

        c.strokeStyle = rgba(palette.tickPale, 0.07);
        c.lineWidth = 2;
        c.beginPath();
        c.arc(cx, cy, radius * 0.82, 0, Math.PI * 2);
        c.stroke();

        for (let a = 0; a < 2; a++) {
          const from = random(`${seed}-arc-f-${i}-${a}`) * Math.PI * 2;
          c.strokeStyle = rgba(palette.tickPale, 0.15);
          c.lineWidth = 6;
          c.beginPath();
          c.arc(cx, cy, radius * 1.14, from, from + 0.5 + random(`${seed}-arc-s-${i}-${a}`));
          c.stroke();
        }
      }

      // Faint panel frames — the chrome the readouts appear to sit inside.
      c.strokeStyle = rgba(palette.tickPale, 0.09);
      c.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        c.strokeRect(
          300 + random(`${seed}-panel-x-${i}`) * 2900,
          200 + random(`${seed}-panel-y-${i}`) * 1500,
          420 + random(`${seed}-panel-w-${i}`) * 700,
          260 + random(`${seed}-panel-h-${i}`) * 460,
        );
      }

      // Blocks of small dashes, far enough back to read as more panels of
      // numbers rather than as anything legible.
      for (let b = 0; b < 7; b++) {
        const bx = 120 + random(`${seed}-blk-x-${b}`) * 3400;
        const by = 140 + random(`${seed}-blk-y-${b}`) * 1700;
        const lines = 5 + Math.floor(random(`${seed}-blk-n-${b}`) * 8);
        for (let l = 0; l < lines; l++) {
          const width = 60 + random(`${seed}-blk-w-${b}-${l}`) * 190;
          c.fillStyle = rgba(palette.readoutDim, 0.2 + random(`${seed}-blk-a-${b}-${l}`) * 0.35);
          c.fillRect(bx, by + l * 46, width, 16);
        }
      }

      // Radar dials, the kind that sit at the edges of a panel like this.
      for (let d = 0; d < 2; d++) {
        const dx = 3180 + d * 340;
        const dy = 300 + d * 1240;
        const radius = 200 + d * 60;
        c.strokeStyle = rgba(palette.tickPale, 0.3);
        for (let ring = 1; ring <= 4; ring++) {
          c.lineWidth = ring === 4 ? 4 : 2;
          c.beginPath();
          c.arc(dx, dy, (radius * ring) / 4, 0, Math.PI * 2);
          c.stroke();
        }
        for (let spoke = 0; spoke < 12; spoke++) {
          const a = (spoke / 12) * Math.PI * 2;
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(dx + Math.cos(a) * radius * 0.7, dy + Math.sin(a) * radius * 0.7);
          c.lineTo(dx + Math.cos(a) * radius, dy + Math.sin(a) * radius);
          c.stroke();
        }
      }

      // Soft diagonal light streaks across the upper left.
      for (let i = 0; i < 4; i++) {
        const x = -200 + random(`${seed}-streak-x-${i}`) * 1400;
        const y = -100 + random(`${seed}-streak-y-${i}`) * 700;
        const length = 900 + random(`${seed}-streak-l-${i}`) * 1400;
        const gradient = c.createLinearGradient(x, y, x + length * 0.9, y - length * 0.42);
        gradient.addColorStop(0, rgba(palette.backgroundWash, 0));
        gradient.addColorStop(0.4, rgba(palette.tickPale, 0.13));
        gradient.addColorStop(1, rgba(palette.backgroundWash, 0));
        c.strokeStyle = gradient;
        c.lineWidth = 10 + random(`${seed}-streak-w-${i}`) * 26;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + length * 0.9, y - length * 0.42);
        c.stroke();
      }
    });

    return canvas;
  }, [layer.scale, palette, seed]);

  useLayoutEffect(() => {
    const { ctx } = layer;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    // Laid down twice: the first pass keeps the drift from exposing a bare
    // edge, the second carries the drift itself.
    ctx.drawImage(plate, 0, 0);
    ctx.drawImage(plate, drift.x * layer.scale, drift.y * layer.scale);
    ctx.restore();
  });

  return null;
};
