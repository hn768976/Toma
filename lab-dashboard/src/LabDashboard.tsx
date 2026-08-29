import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";
import {
  DURATION_IN_FRAMES,
  HEIGHT,
  INDICATOR_PANELS,
  TABLE_SLOTS,
  WAVE_PANELS,
  WIDTH,
} from "./layout";
import { fontsReady } from "./fonts";
import { VARIANTS, type VariantName } from "./variants";
import { Ctx, resetCtx } from "./lib/canvas";
import type { FrameState } from "./lib/frame";
import { buildSignals } from "./lib/signals";
import {
  activeAlert,
  buildAlerts,
  glitchAt,
  instabilityAt,
} from "./lib/schedule";
import { PanelChrome } from "./components/PanelChrome";
import { HeaderBar } from "./components/HeaderBar";
import { ThumbStrip } from "./components/ThumbStrip";
import { DataTable } from "./components/DataTable";
import { ProgressStrip } from "./components/ProgressStrip";
import { WaveformPanel } from "./components/WaveformPanel";
import { ReadoutBlock } from "./components/ReadoutBlock";
import { CellMatrix } from "./components/CellMatrix";
import { SpectrumTrace } from "./components/SpectrumTrace";
import { IndicatorColumn } from "./components/IndicatorColumn";
import { GlitchLayer } from "./components/GlitchLayer";
import { PostFx } from "./components/PostFx";

export type LabDashboardProps = { variant: VariantName };

/**
 * Composes the frame on one offscreen 3840x2160 context and blits it to the
 * single visible canvas. Each child draws into that shared context during its
 * own render, in JSX order, so the layer stack reads top to bottom in the tree
 * below. Nothing here reads a clock: every value is a function of `frame`.
 */
export const LabDashboard: React.FC<LabDashboardProps> = ({ variant }) => {
  const frame = useCurrentFrame() % DURATION_IN_FRAMES;
  const cfg = VARIANTS[variant];

  // The offscreen master. Created once, so the context is always available
  // during render and no child has to deal with a null ref.
  const master = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = WIDTH;
    c.height = HEIGHT;
    return c;
  }, []);
  const ctx = useMemo(() => master.getContext("2d") as Ctx, [master]);
  const visible = useRef<HTMLCanvasElement>(null);

  // Font gating. This is the only state in the piece and it holds no motion:
  // it flips once, before any frame is captured, and never changes again.
  const [handle] = useState(() => delayRender("Loading dashboard fonts"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    fontsReady.then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    // Released only after the fonts-ready render has painted, so no frame is
    // ever captured with a fallback face.
    if (ready) continueRender(handle);
  }, [ready, handle]);

  // Generated once, seeded. Regenerating per frame would make them boil.
  const signals = useMemo(buildSignals, []);
  const alerts = useMemo(
    () =>
      buildAlerts(
        `alerts-${variant}`,
        cfg.events.alertFrom,
        cfg.events.alertGapStart,
        cfg.events.alertGapEnd,
      ),
    [cfg, variant],
  );

  const state: FrameState = useMemo(() => {
    const ev = cfg.events;
    // Reaches "only a few cells still lit" about 45 frames after the trigger
    // and stays there for the rest of the piece.
    const matrixDarkness = Number.isFinite(ev.matrixDarkFrom)
      ? Math.max(0, Math.min(1, (frame - ev.matrixDarkFrom) / 45))
      : 0;
    return {
      ctx,
      cfg,
      frame,
      instability: instabilityAt(frame, cfg.waveform.instabilityRamp),
      signals,
      alert: activeAlert(alerts, frame),
      glitch: glitchAt(`glitch-${variant}`, frame, ev.glitchFrom, HEIGHT),
      tablesFrozen: frame >= ev.tableFreezeFrom,
      tableFreezeFrame: Number.isFinite(ev.tableFreezeFrom) ? ev.tableFreezeFrom : 0,
      matrixDarkness,
    };
  }, [ctx, cfg, frame, signals, alerts, variant]);

  // Children have finished drawing by the time effects run; copy once.
  useLayoutEffect(() => {
    const target = visible.current;
    if (!target) return;
    const tctx = target.getContext("2d") as Ctx;
    resetCtx(tctx);
    tctx.drawImage(master, 0, 0);
  });

  if (!ready) {
    return <canvas ref={visible} width={WIDTH} height={HEIGHT} style={CANVAS_STYLE} />;
  }

  resetCtx(ctx);

  return (
    <>
      <canvas ref={visible} width={WIDTH} height={HEIGHT} style={CANVAS_STYLE} />
      <PanelChrome state={state} />
      <HeaderBar state={state} />
      <ThumbStrip state={state} />
      {TABLE_SLOTS.map((_, i) => (
        <DataTable key={i} state={state} index={i} />
      ))}
      <ProgressStrip state={state} />
      {WAVE_PANELS.map((_, i) => (
        <WaveformPanel key={i} state={state} index={i} />
      ))}
      {WAVE_PANELS.map((_, i) => (
        <ReadoutBlock key={i} state={state} index={i} />
      ))}
      <CellMatrix state={state} />
      <SpectrumTrace state={state} />
      {INDICATOR_PANELS.map((_, i) => (
        <IndicatorColumn key={i} state={state} index={i} />
      ))}
      <GlitchLayer state={state} />
      <PostFx state={state} />
    </>
  );
};

const CANVAS_STYLE: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: WIDTH,
  height: HEIGHT,
};
