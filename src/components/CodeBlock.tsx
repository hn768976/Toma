import {useMemo} from 'react';
import {CONFIG} from '../config';
import {context2d, createBuffer} from '../lib/canvas';
import {MONO_FAMILY} from '../fonts';
import {setTransform} from '../lib/matrix';
import {cameraMatrix, depthPushMultiplier, DRIFT_DIRECTION, pushScale} from '../lib/plane';
import {tokenizeCodeLine} from '../scene/codeSource';
import {CodeBlockSpec} from '../scene/layout';
import {Theme, withAlpha} from '../theme';

/**
 * A block of floating code.
 *
 * Fictional JavaScript, above the card layer and on the same tilted plane, so it
 * drifts with everything else. This is texture, not content — if it ever starts
 * competing with the badge, halve CONFIG.code.maxOpacity.
 */

export interface BakedCodeBlock {
  spec: CodeBlockSpec;
  canvas: HTMLCanvasElement;
  /** Footprint in plane units. */
  width: number;
  height: number;
}

const PADDING = 20;
/** Indent unit, in monospace characters. */
const INDENT_CHARS = 2;

export const bakeCodeBlock = (spec: CodeBlockSpec, theme: Theme): BakedCodeBlock => {
  const {fontSize, lineHeight} = CONFIG.code;
  const font = `400 ${fontSize}px "${MONO_FAMILY}", monospace`;

  // Measure first, on a throwaway context, so the sprite is exactly the size of
  // the text it holds.
  const measure = context2d(createBuffer(8, 8));
  measure.font = font;
  const charWidth = measure.measureText('M').width;

  let widest = 0;
  for (const line of spec.lines) {
    const w = (line.indent * INDENT_CHARS) * charWidth + measure.measureText(line.text).width;
    if (w > widest) widest = w;
  }

  const width = widest + PADDING * 2;
  const height = spec.lines.length * lineHeight + PADDING * 2;
  const resolution = Math.min(
    CONFIG.sprites.supersample,
    CONFIG.sprites.maxCodeSide / Math.max(width, height),
  );

  const canvas = createBuffer(width * resolution, height * resolution);
  const ctx = context2d(canvas);
  ctx.scale(resolution, resolution);
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';

  // A tight dark halo keeps the code readable where it crosses a white card.
  ctx.shadowColor = withAlpha(theme.backgroundDeep, 0.85);
  ctx.shadowBlur = fontSize * 0.35;

  spec.lines.forEach((line, i) => {
    const y = PADDING + i * lineHeight + fontSize * 0.82;
    let x = PADDING + line.indent * INDENT_CHARS * charWidth;

    if (line.isComment) {
      ctx.fillStyle = theme.codeCyan;
      ctx.fillText(line.text, x, y);
      return;
    }
    for (const token of tokenizeCodeLine(line.text)) {
      ctx.fillStyle = token.accent ? theme.codeCyan : theme.codeWhite;
      ctx.fillText(token.text, x, y);
      x += ctx.measureText(token.text).width;
    }
  });

  return {spec, canvas, width, height};
};

export const useBakedCodeBlocks = (
  specs: CodeBlockSpec[],
  theme: Theme,
  ready: boolean,
): BakedCodeBlock[] =>
  useMemo(
    () => (ready ? specs.map((spec) => bakeCodeBlock(spec, theme)) : []),
    [specs, theme, ready],
  );

export const paintCodeBlock = (
  ctx: CanvasRenderingContext2D,
  baked: BakedCodeBlock,
  frame: number,
): void => {
  const {spec} = baked;
  const travel = spec.drift * frame;
  const angle = (2 * Math.PI * spec.bob.frequency * frame) / CONFIG.fps + spec.bob.phase;
  const x = spec.origin.x + DRIFT_DIRECTION.x * travel + Math.cos(angle) * spec.bob.radius;
  const y = spec.origin.y + DRIFT_DIRECTION.y * travel + Math.sin(angle) * spec.bob.radius;

  ctx.save();
  setTransform(ctx, cameraMatrix(pushScale(frame, depthPushMultiplier(spec.depth))));
  ctx.translate(x, y);
  ctx.globalAlpha = spec.opacity;
  ctx.drawImage(baked.canvas, -baked.width / 2, -baked.height / 2, baked.width, baked.height);
  ctx.restore();
};
