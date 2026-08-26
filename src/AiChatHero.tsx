import {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {paintBadge, paintBadgeGlow} from './components/Badge';
import {
  BakedCard,
  paintCard,
  paintCardWithMotionBlur,
  useBakedCards,
} from './components/Card';
import {paintCodeBlock, useBakedCodeBlocks} from './components/CodeBlock';
import {
  BloomBuffers,
  createBloomBuffers,
  createGrainTiles,
  paintBackground,
  paintBloom,
  paintGrain,
  paintVignette,
} from './components/Finish';
import {paintHeroBubble} from './components/HeroBubble';
import {CONFIG} from './config';
import {useFontsReady} from './fonts';
import {context2d, createBuffer} from './lib/canvas';
import {BUCKET_BLUR, DepthBucket, FAR, MID, SHARP} from './lib/plane';
import {buildCards, buildCodeBlocks, buildLiveVariantTimeline} from './scene/layout';
import {getTheme, Variant} from './theme';

// A type alias, not an interface: Remotion's Composition props must be
// assignable to Record<string, unknown>, which interfaces are not.
export type AiChatHeroProps = {
  variant: Variant;
  /** The glyph on the badge. A prop, not a constant, so a variant can change it. */
  badge: string;
};

interface DepthBuffers {
  sharp: HTMLCanvasElement;
  mid: HTMLCanvasElement;
  far: HTMLCanvasElement;
}

const resetContext = (ctx: CanvasRenderingContext2D) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
};

/**
 * Composite one depth bucket onto the frame: a single blur for the whole buffer,
 * then a softer additive pass so blurred white cards bloom — they are bright
 * surfaces catching the badge's glow.
 */
const compositeBucket = (
  ctx: CanvasRenderingContext2D,
  buffer: HTMLCanvasElement,
  blur: number,
): void => {
  ctx.save();
  resetContext(ctx);
  if (blur > 0) ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(buffer, 0, 0);
  ctx.restore();

  if (blur <= 0) return;

  ctx.save();
  resetContext(ctx);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = CONFIG.dof.bloomStrength;
  ctx.filter = `blur(${blur * 1.9}px)`;
  ctx.drawImage(buffer, 0, 0);
  ctx.restore();
};

export const AiChatHero: React.FC<AiChatHeroProps> = ({variant, badge}) => {
  const frame = useCurrentFrame();
  const theme = useMemo(() => getTheme(variant), [variant]);
  const fontsReady = useFontsReady();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The scene is generated once. Depth buckets in particular are fixed for the
  // whole shot: a card that changed buffers mid-push would pop.
  // Only the fills depend on the theme; the geometry these produce is identical
  // for every variant.
  const cards = useMemo(() => buildCards(theme), [theme]);
  const codeSpecs = useMemo(() => buildCodeBlocks(), []);
  const liveTimeline = useMemo(() => buildLiveVariantTimeline(cards), [cards]);

  const bakedCards = useBakedCards(cards, theme);
  const bakedCode = useBakedCodeBlocks(codeSpecs, theme, fontsReady);

  const buffers = useMemo<DepthBuffers>(
    () => ({
      sharp: createBuffer(CONFIG.width, CONFIG.height),
      mid: createBuffer(CONFIG.width, CONFIG.height),
      far: createBuffer(CONFIG.width, CONFIG.height),
    }),
    [],
  );
  const bloomBuffers = useMemo<BloomBuffers>(() => createBloomBuffers(), []);
  const grainTiles = useMemo(() => createGrainTiles(), []);

  const byBucket = useMemo(() => {
    const groups: Record<DepthBucket, BakedCard[]> = {0: [], 1: [], 2: []};
    // Far cards first within each bucket, so nearer cards occlude them.
    [...bakedCards]
      .sort((a, b) => b.spec.depth - a.spec.depth)
      .forEach((card) => groups[card.spec.bucket].push(card));
    return groups;
  }, [bakedCards]);

  // One canvas paint per React render. No requestAnimationFrame, no state, no
  // clock — every frame is a pure function of `frame`.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fontsReady) return;
    const ctx = context2d(canvas);

    const variantFor = (card: BakedCard) =>
      card.spec.liveIndex === null ? 0 : liveTimeline[card.spec.liveIndex][frame] ?? 0;

    // 1. Background.
    resetContext(ctx);
    paintBackground(ctx, theme);

    // 2-3, 5. Cards into their depth buffers, blurred once per buffer.
    for (const bucket of [FAR, MID, SHARP] as DepthBucket[]) {
      const buffer =
        bucket === FAR ? buffers.far : bucket === MID ? buffers.mid : buffers.sharp;
      const bufferCtx = context2d(buffer);
      resetContext(bufferCtx);
      bufferCtx.clearRect(0, 0, CONFIG.width, CONFIG.height);

      for (const card of byBucket[bucket]) {
        if (card.spec.motionBlur) {
          paintCardWithMotionBlur(bufferCtx, card, frame, variantFor(card));
        } else {
          paintCard(bufferCtx, card, {frame, variantIndex: variantFor(card), alpha: 1});
        }
      }
    }

    compositeBucket(ctx, buffers.far, BUCKET_BLUR[FAR]);
    compositeBucket(ctx, buffers.mid, BUCKET_BLUR[MID]);

    // 4. Floating code, above the card layer but below the sharp band.
    resetContext(ctx);
    for (const block of bakedCode) {
      paintCodeBlock(ctx, block, frame);
    }

    resetContext(ctx);
    compositeBucket(ctx, buffers.sharp, BUCKET_BLUR[SHARP]);

    // 6-8. The hero.
    resetContext(ctx);
    paintHeroBubble(ctx, theme, frame);
    paintBadgeGlow(ctx, theme, frame);
    paintBadge(ctx, theme, frame, badge);

    // 9. Finish.
    resetContext(ctx);
    paintBloom(ctx, canvas, bloomBuffers, theme);
    paintVignette(ctx, theme);
    paintGrain(ctx, grainTiles, frame);
    resetContext(ctx);
  });

  return (
    <AbsoluteFill style={{backgroundColor: theme.backgroundDeep}}>
      <canvas
        ref={canvasRef}
        width={CONFIG.width}
        height={CONFIG.height}
        style={{width: '100%', height: '100%', display: 'block'}}
      />
    </AbsoluteFill>
  );
};
