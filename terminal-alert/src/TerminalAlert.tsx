import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AbsoluteFill, cancelRender, continueRender, delayRender, useCurrentFrame} from 'remotion';
import {Banner} from './components/Banner';
import {ColourWash} from './components/ColourWash';
import {ScanlinePass} from './components/ScanlinePass';
import {TearPass} from './components/TearPass';
import {TextLayer} from './components/TextLayer';
import {fontsReady} from './fonts';
import {buildScanlineTile, buildTextBuffer, buildWashTexture} from './lib/buffers';
import {BLOCK_HEIGHT, DURATION, HEIGHT, WIDTH} from './lib/constants';
import {buildGrainTiles, clamp01, createBuffer, lerp} from './lib/draw';
import {buildCorruptionTimeline, buildTearTimeline} from './lib/glitch';
import type {Stage} from './stage';
import {getVariant, VariantName} from './variants';

export type TerminalAlertProps = {
  variant: VariantName;
};

/**
 * Everything below is a pure function of useCurrentFrame(): no Date.now(), no
 * requestAnimationFrame, no CSS animation and no state that survives a frame, so
 * `npx remotion render` is deterministic and frames can be produced in any order.
 */
export const TerminalAlert: React.FC<TerminalAlertProps> = ({variant}) => {
  const frame = useCurrentFrame();
  const cfg = useMemo(() => getVariant(variant), [variant]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [handle] = useState(() => delayRender(`fonts-${variant}`));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fontsReady
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => cancelRender(err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Built once per variant. Laying out sixty rows of 4K monospace, or the wash
  // texture, or the grain field, on every frame is the expensive mistake here.
  const text = useMemo(() => (ready ? buildTextBuffer(cfg) : null), [cfg, ready]);
  const washTexture = useMemo(() => (ready ? buildWashTexture(cfg) : null), [cfg, ready]);
  const scanlineTile = useMemo(() => (ready ? buildScanlineTile(cfg) : null), [cfg, ready]);
  const grainTiles = useMemo(() => (ready ? buildGrainTiles(6, 256) : null), [ready]);
  const frameScratch = useMemo(() => (ready ? createBuffer(WIDTH, HEIGHT) : null), [ready]);
  const bandScratch = useMemo(() => (ready ? createBuffer(WIDTH, 260) : null), [ready]);
  const tears = useMemo(() => buildTearTimeline(cfg), [cfg]);
  const corruptions = useMemo(() => buildCorruptionTimeline(cfg), [cfg]);

  const f = frame % DURATION;
  const instability = clamp01(cfg.instability(frame));
  const pulse = clamp01(cfg.pulse(frame));

  const stage: Stage | null =
    text && washTexture && scanlineTile && grainTiles && frameScratch && bandScratch
      ? {
          canvasRef,
          cfg,
          ready,
          frame,
          f,
          instability,
          pulse,
          // One block of scroll over exactly 300 frames: the loop closes on itself.
          scrollY: (f / DURATION) * BLOCK_HEIGHT,
          washAlpha: lerp(cfg.glitch.washAlpha[0], cfg.glitch.washAlpha[1], instability),
          striation: lerp(cfg.glitch.striation[0], cfg.glitch.striation[1], instability),
          text,
          washTexture,
          scanlineTile,
          grainTiles,
          frameScratch,
          bandScratch,
          tears,
          corruptions,
        }
      : null;

  // Released only once the layers have actually painted. A parent's layout
  // effect runs after its children's, so by the time this fires the canvas holds
  // a finished frame and Remotion can safely capture it.
  const released = useRef(false);
  useLayoutEffect(() => {
    if (!stage || released.current) return;
    released.current = true;
    continueRender(handle);
  });

  return (
    <AbsoluteFill style={{backgroundColor: cfg.palette.bannerBlack}}>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{width: '100%', height: '100%', display: 'block'}}
      />
      {stage ? (
        <>
          <TextLayer stage={stage} />
          <ColourWash stage={stage} />
          <Banner stage={stage} />
          <TearPass stage={stage} />
          <ScanlinePass stage={stage} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
