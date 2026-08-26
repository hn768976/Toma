import {useCallback, useLayoutEffect, useMemo, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {ChipBadge} from './components/ChipBadge';
import {CircuitBackground} from './components/CircuitBackground';
import {Connector} from './components/Connector';
import {FibreFan} from './components/FibreFan';
import {StageClear} from './components/StageClear';
import {iconStripSpec, UiPanel} from './components/UiPanel';
import {
  DOF_BLUR,
  DURATION_IN_FRAMES,
  GRAIN_ALPHA,
  GRAIN_TILE_COUNT,
  GRAIN_TILE_SIZE,
  HEIGHT,
  VIGNETTE_STRENGTH,
  WIDTH,
} from './config';
import {buildFlickerEvents} from './flicker';
import {useFontsReady} from './fonts';
import {ctxOf, makeCanvas, rgba, rnd, rrange} from './lib/draw';
import {apply} from './lib/mat';
import {resetCtx, type Layers, type LayersRef} from './layers';
import {buildScene} from './scene';
import {THEMES, type Variant} from './theme';

const BLOOM_DIVISOR = 4;

/**
 * Grain tiles. Twelve of them, and 12 divides 372, so the tile cycle closes
 * exactly with the loop. Pixel values come from Remotion's seeded `random()`.
 */
const buildGrainTiles = (variant: Variant): HTMLCanvasElement[] =>
  Array.from({length: GRAIN_TILE_COUNT}, (_, t) => {
    const c = makeCanvas(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const ctx = ctxOf(c);
    const img = ctx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = 128 + (rnd(`${variant}-grain-${t}-${i}`) - 0.5) * 150;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });

export type ChipDashboardProps = {
  variant: Variant;
};

export const ChipDashboard: React.FC<ChipDashboardProps> = ({variant}) => {
  const frame = useCurrentFrame();
  const fontsReady = useFontsReady();
  const theme = THEMES[variant];

  const scene = useMemo(() => buildScene(variant), [variant]);
  const events = useMemo(() => buildFlickerEvents(variant), [variant]);
  const grain = useMemo(() => buildGrainTiles(variant), [variant]);

  // Three depth-of-field buckets plus the chip layer. Allocated once: blurring
  // nine panels individually at 4K is not affordable, so panels are bucketed by
  // depth and each buffer is blurred exactly once at composite time.
  const offscreens = useMemo(() => {
    const dof = [0, 1, 2].map(() => ctxOf(makeCanvas(WIDTH, HEIGHT))) as unknown as Layers['dof'];
    return {dof, top: ctxOf(makeCanvas(WIDTH, HEIGHT))};
  }, []);

  const bloom = useMemo(
    () => ({
      a: ctxOf(makeCanvas(WIDTH / BLOOM_DIVISOR, HEIGHT / BLOOM_DIVISOR)),
      b: ctxOf(makeCanvas(WIDTH / BLOOM_DIVISOR, HEIGHT / BLOOM_DIVISOR)),
    }),
    []
  );

  const layersRef = useRef<Layers | null>(null);
  const attachCanvas = useCallback(
    (c: HTMLCanvasElement | null) => {
      layersRef.current = c ? {main: ctxOf(c), dof: offscreens.dof, top: offscreens.top} : null;
    },
    [offscreens]
  );
  const layers: LayersRef = layersRef;

  const stripSpec = useMemo(() => iconStripSpec(), []);
  const stripPlane = useMemo(() => apply(scene.inv, {
    x: scene.chipScreen.x + scene.flowDirection * stripSpec.du,
    y: scene.chipScreen.y + stripSpec.dv,
  }), [scene, stripSpec]);

  /* ------------------------------------------------------------ finish */
  // Runs after every child's layout effect: flatten the buckets, then bloom,
  // vignette and grain.
  // No dependency array: the draw must run on EVERY render so that the layer
  // order described in layers.ts holds. See ChipDashboard for the full pass.
  useLayoutEffect(() => {
    const L = layersRef.current;
    if (!L || !fontsReady) return;
    const ctx = L.main;
    resetCtx(ctx);

    // Far to near, each buffer blurred once on the way in.
    for (let i = DOF_BLUR.length - 1; i >= 0; i--) {
      const blur = DOF_BLUR[i];
      ctx.filter = blur > 0 ? `blur(${blur}px)` : 'none';
      ctx.drawImage(L.dof[i].canvas, 0, 0);
      if (i === DOF_BLUR.length - 1) {
        // Defocused highlights gain, they do not just smear — without this the
        // far bucket reads as grey smudge rather than bokeh.
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45;
        ctx.drawImage(L.dof[i].canvas, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.filter = 'none';
    ctx.drawImage(L.top.canvas, 0, 0);

    /* ---- bloom -------------------------------------------------------- */
    const bw = WIDTH / BLOOM_DIVISOR;
    const bh = HEIGHT / BLOOM_DIVISOR;
    resetCtx(bloom.a);
    resetCtx(bloom.b);
    bloom.a.clearRect(0, 0, bw, bh);
    bloom.a.drawImage(ctx.canvas, 0, 0, bw, bh);

    // Multiplying the downsample by itself twice isolates the highlights, so
    // only the chip rim and the panel borders end up blooming.
    bloom.b.clearRect(0, 0, bw, bh);
    bloom.b.drawImage(bloom.a.canvas, 0, 0);
    bloom.b.globalCompositeOperation = 'multiply';
    bloom.b.drawImage(bloom.a.canvas, 0, 0);
    bloom.b.drawImage(bloom.a.canvas, 0, 0);
    bloom.b.globalCompositeOperation = 'source-over';

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.9;
    ctx.filter = 'blur(6px)';
    ctx.drawImage(bloom.b.canvas, 0, 0, WIDTH, HEIGHT);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    /* ---- vignette ------------------------------------------------------ */
    const vig = ctx.createRadialGradient(
      WIDTH / 2,
      HEIGHT / 2,
      HEIGHT * 0.32,
      WIDTH / 2,
      HEIGHT / 2,
      WIDTH * 0.68
    );
    vig.addColorStop(0, rgba(theme.voidBlack, 0));
    vig.addColorStop(1, rgba(theme.voidBlack, VIGNETTE_STRENGTH));
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    /* ---- grain --------------------------------------------------------- */
    const loopFrame = frame % DURATION_IN_FRAMES;
    const tile = grain[loopFrame % GRAIN_TILE_COUNT];
    const pattern = ctx.createPattern(tile, 'repeat');
    if (pattern) {
      const ox = rrange(`${variant}-grain-ox-${loopFrame}`, 0, GRAIN_TILE_SIZE);
      const oy = rrange(`${variant}-grain-oy-${loopFrame}`, 0, GRAIN_TILE_SIZE);
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = GRAIN_ALPHA;
      ctx.translate(-ox, -oy);
      ctx.fillStyle = pattern;
      ctx.fillRect(ox, oy, WIDTH, HEIGHT);
      ctx.restore();
    }

    resetCtx(ctx);
  });

  return (
    <AbsoluteFill style={{backgroundColor: theme.bgDeep}}>
      {/* Declared first so its ref is attached before any child draws. */}
      <canvas
        ref={attachCanvas}
        width={WIDTH}
        height={HEIGHT}
        style={{width: '100%', height: '100%', display: 'block'}}
      />

      <StageClear layers={layers} />

      <CircuitBackground
        layers={layers}
        scene={scene}
        frame={frame}
        fontsReady={fontsReady}
      />

      <FibreFan layers={layers} scene={scene} frame={frame} />

      {scene.panels.map((panel) => (
        <Connector
          key={`c-${panel.spec.id}`}
          layers={layers}
          scene={scene}
          panel={panel}
          frame={frame}
        />
      ))}

      {scene.panels.map((panel) => (
        <UiPanel
          key={panel.spec.id}
          layers={layers}
          scene={scene}
          spec={panel.spec}
          plane={panel.plane}
          depth={panel.spec.depth}
          events={events}
          frame={frame}
          fontsReady={fontsReady}
        />
      ))}

      <UiPanel
        layers={layers}
        scene={scene}
        spec={stripSpec}
        plane={stripPlane}
        depth={stripSpec.depth}
        events={events}
        frame={frame}
        fontsReady={fontsReady}
      />

      <ChipBadge
        layers={layers}
        scene={scene}
        frame={frame}
        fontsReady={fontsReady}
      />
    </AbsoluteFill>
  );
};
