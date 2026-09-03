/**
 * The centre hub: a broken-arc ring, a thin complete circle, a fine tick ring,
 * and whichever centre element the variant asks for.
 *
 * Ring construction is identical across all three variants — only the centre
 * element differs. The rings are rigid, so each is rasterised ONCE into an
 * offscreen canvas and blitted with a rotation rather than re-stroked every
 * frame.
 *
 * LOOP CONTRACT: the arc segments have unequal lengths and unequal gaps, so
 * their symmetry period is a whole turn and they must rotate by whole turns
 * (HUB_ARC_TURNS). The tick ring is evenly divided, so it only needs to
 * advance a whole number of tick steps (HUB_TICK_STEPS) — it counter-rotates
 * against the arcs. Both land back on their frame-0 orientation at frame 450.
 */
import { useMemo } from "react";
import {
  HUB_ARC_TURNS,
  HUB_INNER_CIRCLE,
  HUB_RADIUS,
  HUB_SECONDARY_ARC,
  HUB_SECONDARY_TURNS,
  HUB_TICK_COUNT,
  HUB_TICK_INNER,
  HUB_TICK_OUTER,
  HUB_TICK_STEPS,
  PERIODS,
  loopT,
} from "../constants";
import { withAlpha } from "../color";
import { makeBloom, makeOffscreen } from "../passes";
import {
  brokenArcRing,
  strokeArcRing,
  strokeTickRing,
  type ArcSegment,
} from "../../lib/canvas/rings";
import { getIcon } from "../icons";
import { FONT_CONDENSED } from "../fonts";
import { Layer } from "./Layer";
import type { CentreConfig, Palette } from "../variants";

/** Padding around the tick ring, leaving room for the glow to fall off. */
const PAD = 150;
const WORK_RADIUS = HUB_TICK_OUTER + PAD;
const WORK_SIZE = WORK_RADIUS * 2;

/**
 * The broken-arc and tick ring builders live in the vendored library; these
 * thin wrappers pin them to this hub's work-box centre so the call sites stay
 * readable.
 */
const strokeArcs = (
  ctx: CanvasRenderingContext2D,
  segments: readonly ArcSegment[],
  radius: number,
  lineWidth: number,
  color: string,
) =>
  strokeArcRing(
    ctx,
    segments,
    { x: WORK_RADIUS, y: WORK_RADIUS },
    radius,
    lineWidth,
    color,
  );

/** Rasterises one ring into its own offscreen canvas, centred in the work box. */
const bakeRing = (paint: (ctx: CanvasRenderingContext2D) => void) => {
  const { canvas, ctx } = makeOffscreen(WORK_SIZE, WORK_SIZE);
  paint(ctx);
  return canvas;
};

const blitRotated = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  angle: number,
) => {
  ctx.save();
  ctx.translate(WORK_RADIUS, WORK_RADIUS);
  ctx.rotate(angle);
  ctx.drawImage(source, -WORK_RADIUS, -WORK_RADIUS);
  ctx.restore();
};

/** A rounded square with short pin teeth along all four edges. */
const drawChip = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  text: string,
) => {
  const half = 104;
  const cx = WORK_RADIUS;
  const cy = WORK_RADIUS;

  ctx.save();
  // Dark semi-transparent fill, bright rim.
  ctx.beginPath();
  ctx.roundRect(cx - half, cy - half, half * 2, half * 2, 22);
  ctx.fillStyle = withAlpha(palette.bgDeep, 0.78);
  ctx.fill();
  ctx.strokeStyle = palette.hubText;
  ctx.lineWidth = 5;
  ctx.stroke();

  // Pin teeth: six per edge, reaching outward.
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.strokeStyle = palette.hubText;
  for (let i = 0; i < 6; i++) {
    const at = -half + 22 + (i * (half * 2 - 44)) / 5;
    ctx.beginPath();
    ctx.moveTo(cx + at, cy - half);
    ctx.lineTo(cx + at, cy - half - 26);
    ctx.moveTo(cx + at, cy + half);
    ctx.lineTo(cx + at, cy + half + 26);
    ctx.moveTo(cx - half, cy + at);
    ctx.lineTo(cx - half - 26, cy + at);
    ctx.moveTo(cx + half, cy + at);
    ctx.lineTo(cx + half + 26, cy + at);
    ctx.stroke();
  }

  // Inner die outline and a couple of traces.
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = withAlpha(palette.hubArc, 0.85);
  ctx.beginPath();
  ctx.roundRect(cx - 74, cy - 74, 148, 148, 10);
  ctx.stroke();

  ctx.fillStyle = palette.hubText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 116px "${FONT_CONDENSED}"`;
  ctx.fillText(text, cx, cy + 6);
  ctx.restore();
};

/**
 * A ring of thick blocks that fill progressively in the accent colour and
 * extinguish when the cycle wraps. `cycles` fills complete across the loop, so
 * the block state at frame 450 is the frame-0 state again.
 */
const drawProgressDial = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  config: Extract<CentreConfig, { kind: "progressDial" }>,
  frame: number,
) => {
  const cx = WORK_RADIUS;
  const cy = WORK_RADIUS;
  const inner = HUB_INNER_CIRCLE - 46;
  const outer = HUB_INNER_CIRCLE - 6;
  const { blocks } = config;
  const step = (Math.PI * 2) / blocks;
  const gap = step * 0.22;

  const cycleFrame = frame % PERIODS.dial;
  const progress = cycleFrame / PERIODS.dial;
  const lit = Math.floor(progress * blocks);
  const accent = palette.accent ?? palette.hubText;

  ctx.save();
  for (let i = 0; i < blocks; i++) {
    // Start at 12 o'clock and fill clockwise.
    const from = -Math.PI / 2 + i * step + gap / 2;
    const to = from + step - gap;
    const isLit = i < lit;
    const isLeading = i === lit - 1;

    ctx.beginPath();
    ctx.arc(cx, cy, inner, from, to);
    ctx.arc(cx, cy, outer, to, from, true);
    ctx.closePath();
    ctx.fillStyle = isLit
      ? withAlpha(accent, isLeading ? 1 : 0.88)
      : withAlpha(palette.hubDim, 0.55);
    ctx.fill();
    if (isLit) {
      ctx.strokeStyle = withAlpha(accent, isLeading ? 1 : 0.6);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  ctx.fillStyle = palette.textBright;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 46px "${FONT_CONDENSED}"`;
  // Small caps, letterspaced.
  const text = config.text.toUpperCase();
  const tracking = 11;
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total =
    widths.reduce((a, b) => a + b, 0) + tracking * (text.length - 1);
  let x = cx - total / 2;
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], x + widths[i] / 2, cy + 4);
    x += widths[i] + tracking;
  }
  ctx.restore();
};

/** A single large line glyph from the icon registry, rimmed and glowing. */
const drawGlyph = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  config: Extract<CentreConfig, { kind: "glyph" }>,
) => {
  const size = 232;
  const cx = WORK_RADIUS;
  const cy = WORK_RADIUS;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(palette.bgDeep, 0.7);
  ctx.fill();
  ctx.strokeStyle = withAlpha(palette.hubText, 0.9);
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.strokeStyle = palette.hubText;
  ctx.fillStyle = palette.hubText;
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  getIcon(config.icon)(ctx, size);
  ctx.restore();
};

export type CentreHubProps = {
  palette: Palette;
  centre: CentreConfig;
  frame: number;
  centreX: number;
  centreY: number;
  width: number;
  height: number;
  seed: string;
};

export const CentreHub: React.FC<CentreHubProps> = ({
  palette,
  centre,
  frame,
  centreX,
  centreY,
  width,
  height,
  seed,
}) => {
  const rings = useMemo(() => {
    const segments = brokenArcRing(`${seed}/arcs`, 10);
    const secondary = brokenArcRing(`${seed}/arcs2`, 12);
    const hairline = brokenArcRing(`${seed}/arcs3`, 9);

    return {
      arcs: bakeRing((ctx) => {
        strokeArcs(ctx, segments, HUB_RADIUS, 13, palette.hubArc);
        // A hairline broken ring just inside the main one adds instrument
        // detail without adding weight; it rides along with the arcs.
        strokeArcs(
          ctx,
          hairline,
          HUB_RADIUS - 24,
          3,
          withAlpha(palette.hubArc, 0.75),
        );
      }),
      secondary: bakeRing((ctx) =>
        strokeArcs(
          ctx,
          secondary,
          HUB_SECONDARY_ARC,
          6,
          withAlpha(palette.hubArc, 0.5),
        ),
      ),
      circle: bakeRing((ctx) => {
        // A dark seat inside the thin circle, so the centre element reads as
        // sitting in a recess rather than floating on the starfield.
        ctx.beginPath();
        ctx.arc(WORK_RADIUS, WORK_RADIUS, HUB_INNER_CIRCLE, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(palette.bgDeep, 0.55);
        ctx.fill();
        ctx.strokeStyle = withAlpha(palette.hubText, 0.55);
        ctx.lineWidth = 2.6;
        ctx.stroke();
        ctx.strokeStyle = withAlpha(palette.hubArc, 0.3);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(
          WORK_RADIUS,
          WORK_RADIUS,
          HUB_INNER_CIRCLE - 18,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }),
      ticks: bakeRing((ctx) => {
        // Every tenth tick is longer, heavier and brighter, which gives the
        // ring a readable beat without making it look like a measuring dial.
        strokeTickRing(ctx, { x: WORK_RADIUS, y: WORK_RADIUS }, {
          count: HUB_TICK_COUNT,
          color: palette.hubArc,
          minor: {
            innerRadius: HUB_TICK_INNER,
            outerRadius: HUB_TICK_OUTER - 10,
            lineWidth: 2.2,
            alpha: 0.5,
          },
          majorEvery: 10,
          major: {
            innerRadius: HUB_TICK_INNER - 8,
            outerRadius: HUB_TICK_OUTER + 6,
            lineWidth: 4,
            alpha: 0.95,
          },
        });
      }),
    };
  }, [palette, seed]);

  const work = useMemo(() => makeOffscreen(WORK_SIZE, WORK_SIZE), []);
  // The hub is the brightest thing in frame, so it gets the widest bloom.
  const bloom = useMemo(() => makeBloom(WORK_SIZE, WORK_SIZE, 3), []);

  const draw = (ctx: CanvasRenderingContext2D) => {
    const t = loopT(frame);
    const { ctx: wctx } = work;
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.clearRect(0, 0, WORK_SIZE, WORK_SIZE);

    const tickStep = (Math.PI * 2) / HUB_TICK_COUNT;
    blitRotated(wctx, rings.arcs, HUB_ARC_TURNS * Math.PI * 2 * t);
    blitRotated(wctx, rings.secondary, HUB_SECONDARY_TURNS * Math.PI * 2 * t);
    blitRotated(wctx, rings.circle, 0);
    blitRotated(wctx, rings.ticks, HUB_TICK_STEPS * tickStep * t);

    switch (centre.kind) {
      case "chip":
        drawChip(wctx, palette, centre.text);
        break;
      case "progressDial":
        drawProgressDial(wctx, palette, centre, frame);
        break;
      case "glyph":
        drawGlyph(wctx, palette, centre);
        break;
    }

    const left = centreX - WORK_RADIUS;
    const top = centreY - WORK_RADIUS;
    ctx.drawImage(work.canvas, left, top);
    bloom(ctx, work.canvas, {
      radii: [70, 26, 10],
      alpha: 0.4,
      x: left,
      y: top,
    });
  };

  return <Layer draw={draw} width={width} height={height} />;
};
