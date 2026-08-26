import {useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {
  BREATHE,
  CHART,
  DOF,
  DURATION,
  FINISH,
  HEIGHT,
  SERIES_LEN,
  VARIANTS,
  WIDTH,
  type Variant,
} from './config';
import {CandleSeries} from './layers/CandleSeries';
import {GridLayer} from './layers/GridLayer';
import {PriceLadder} from './layers/PriceLadder';
import {TrendLine} from './layers/TrendLine';
import {VolumeBars} from './layers/VolumeBars';
import {makeBuffers, makeCamera, Painter} from './paint';
import type {Scene} from './scene';
import {buildSeries} from './series';
import {rgba, THEMES} from './theme';

/** deterministic 32-bit noise, seeded per frame — no Math.random anywhere */
const xorshift = (seed: number) => {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
};

const makeScratch = (w: number, h: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return {
    canvas,
    ctx: canvas.getContext('2d') as CanvasRenderingContext2D,
  };
};

export const CandleMacro: React.FC<{variant: Variant}> = ({variant}) => {
  const frame = useCurrentFrame();
  const cfg = VARIANTS[variant];
  const theme = THEMES[variant];

  // Generated ONCE. Regenerating per frame would make the chart strobe.
  const series = useMemo(() => buildSeries(variant), [variant]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const painter = useMemo(
    () => new Painter(makeBuffers(), makeCamera(cfg)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variant]
  );

  const scratch = useMemo(() => {
    const bw = Math.round(WIDTH * FINISH.bloomScale);
    const bh = Math.round(HEIGHT * FINISH.bloomScale);
    return {
      bloomA: makeScratch(bw, bh),
      bloomB: makeScratch(bw, bh),
      grain: makeScratch(FINISH.grainTile, FINISH.grainTile),
    };
  }, []);

  const seriesWidth = SERIES_LEN * CHART.pitch;
  // one full series width of scroll per loop — this is what makes the tile close
  const offsetX = -(frame / DURATION) * seriesWidth;

  const yOf = useMemo(() => {
    const {min, max} = series;
    const span = Math.max(1e-6, max - min);
    return (p: number) =>
      CHART.priceTop + ((max - p) / span) * (CHART.priceBottom - CHART.priceTop);
  }, [series]);

  // A fresh scene each render; layers push their draw ops into it.
  const scene: Scene = {
    painter,
    series,
    cfg,
    theme,
    frame,
    offsetX,
    seriesWidth,
    yOf,
    ops: [],
  };

  // Runs after every child layer's own layout effect, so `scene.ops` is
  // complete by the time we composite.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    // slow brightness breathe; 248 divides 744, so it closes with the loop
    const breathe =
      1 + BREATHE.amount * Math.sin((2 * Math.PI * frame) / BREATHE.period);

    // ── 1. layers draw into the three focus buffers ────────────────────
    painter.begin(breathe);
    scene.ops.sort((a, b) => a.z - b.z);
    for (const op of scene.ops) op.run();

    // ── 2. ground ──────────────────────────────────────────────────────
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.fillStyle = rgba(theme.backgroundDeep, 1);
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const ground = ctx.createRadialGradient(
      WIDTH * 0.34,
      HEIGHT * 0.46,
      HEIGHT * 0.06,
      WIDTH * 0.34,
      HEIGHT * 0.46,
      HEIGHT * 1.15
    );
    ground.addColorStop(0, rgba(theme.backgroundMid, 0.95 * breathe));
    ground.addColorStop(0.55, rgba(theme.backgroundMid, 0.42 * breathe));
    ground.addColorStop(1, rgba(theme.backgroundDeep, 0));
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // ── 3. composite the buffers, far first, one blur per buffer ───────
    ctx.globalCompositeOperation = 'lighter';
    for (const buf of [painter.buffers.far, painter.buffers.mid, painter.buffers.sharp]) {
      ctx.filter = buf.blur > 0 ? `blur(${buf.blur}px)` : 'none';
      ctx.drawImage(
        buf.canvas,
        -DOF.margin,
        -DOF.margin,
        WIDTH + DOF.margin * 2,
        HEIGHT + DOF.margin * 2
      );
    }
    ctx.filter = 'none';

    // ── 4. bloom on the brightest pixels ───────────────────────────────
    const {bloomA, bloomB} = scratch;
    const bw = bloomA.canvas.width;
    const bh = bloomA.canvas.height;
    bloomA.ctx.setTransform(1, 0, 0, 1, 0, 0);
    bloomA.ctx.globalCompositeOperation = 'source-over';
    bloomA.ctx.globalAlpha = 1;
    bloomA.ctx.clearRect(0, 0, bw, bh);
    bloomA.ctx.drawImage(canvas, 0, 0, bw, bh);

    // square the signal so only genuinely bright pixels survive
    bloomB.ctx.globalCompositeOperation = 'source-over';
    bloomB.ctx.globalAlpha = 1;
    bloomB.ctx.clearRect(0, 0, bw, bh);
    bloomB.ctx.drawImage(bloomA.canvas, 0, 0);
    bloomB.ctx.globalCompositeOperation = 'multiply';
    bloomB.ctx.drawImage(bloomA.canvas, 0, 0);

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = FINISH.bloomStrength;
    ctx.filter = 'blur(26px)';
    ctx.drawImage(bloomB.canvas, 0, 0, WIDTH, HEIGHT);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;

    // ── 5. vignette ────────────────────────────────────────────────────
    ctx.globalCompositeOperation = 'source-over';
    const vig = ctx.createRadialGradient(
      WIDTH * 0.46,
      HEIGHT * 0.48,
      HEIGHT * 0.24,
      WIDTH * 0.46,
      HEIGHT * 0.48,
      HEIGHT * 0.95
    );
    vig.addColorStop(0, rgba(theme.shadow, 0));
    vig.addColorStop(0.62, rgba(theme.shadow, FINISH.vignette * 0.34));
    vig.addColorStop(1, rgba(theme.shadow, FINISH.vignette));
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // ── 6. fine grain, seeded on frame % 744 so it loops ───────────────
    const loopFrame = ((frame % DURATION) + DURATION) % DURATION;
    const rand = xorshift(loopFrame * 2654435761 + 12345);
    const tile = FINISH.grainTile;
    const img = scratch.grain.ctx.createImageData(tile, tile);
    const px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const n = rand();
      px[i] = 255;
      px[i + 1] = 255;
      px[i + 2] = 255;
      px[i + 3] = Math.round(n * n * 255);
    }
    scratch.grain.ctx.putImageData(img, 0, 0);

    const ox = Math.floor(rand() * tile);
    const oy = Math.floor(rand() * tile);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = FINISH.grainAlpha;
    for (let gx = -ox; gx < WIDTH; gx += tile) {
      for (let gy = -oy; gy < HEIGHT; gy += tile) {
        ctx.drawImage(scratch.grain.canvas, gx, gy);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  });

  return (
    <AbsoluteFill style={{backgroundColor: rgba(theme.backgroundDeep, 1)}}>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{width: '100%', height: '100%', display: 'block'}}
      />
      <GridLayer scene={scene} frame={frame} />
      <TrendLine scene={scene} frame={frame} />
      <VolumeBars scene={scene} frame={frame} />
      <CandleSeries scene={scene} frame={frame} />
      <PriceLadder scene={scene} frame={frame} />
    </AbsoluteFill>
  );
};
