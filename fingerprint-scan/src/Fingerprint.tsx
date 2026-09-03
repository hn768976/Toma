/**
 * The piece. One component, two versions — everything that differs between
 * "acquire" and "verify" is read from VARIANTS, including what the scan does.
 *
 * Every value below is a pure function of useCurrentFrame(): no Date.now(), no
 * requestAnimationFrame, no CSS animation, no state. Each canvas draws once per
 * React render, so `npx remotion render` is deterministic.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { VARIANTS, type VariantName } from "./variants";
import {
  CODE_A, CODE_B, DIAL, GLOBE, H, PAT_A, PAT_B,
  RULE_BOTTOM_Y, RULE_TOP_Y, RULE_V, W, drift,
} from "./layout";
import { usePrintMask } from "./lib/mask";
import { withAlpha } from "./shared/draw";
import { scanState } from "./lib/scan";
import { Backdrop } from "./components/Backdrop";
import { CodePanel } from "./components/CodePanel";
import { DotGlobe } from "./components/DotGlobe";
import { Grain } from "./components/Grain";
import { MeasureRule } from "./components/MeasureRule";
import { MinutiaeMarkers } from "./components/MinutiaeMarkers";
import { PatternPanel } from "./components/PatternPanel";
import { PercentDial } from "./components/PercentDial";
import { PrintMask } from "./components/PrintMask";
import { RuleBar } from "./components/RuleBar";
import { ScanReveal } from "./components/ScanReveal";
import { StatusPlate } from "./components/StatusPlate";

export const Fingerprint: React.FC<{ variant: VariantName }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const cfg = VARIANTS[variant];
  const { palette, scan, outcome } = cfg;
  const mask = usePrintMask();

  // ---- outcome flash: the whole frame lifts for a few frames on the stamp
  const flash =
    outcome.kind === "match" && frame >= outcome.at && frame < outcome.at + outcome.flashFrames
      ? 1 - (frame - outcome.at) / outcome.flashFrames
      : 0;

  // ---- the gentle pulse over the finished print
  const pulse =
    frame >= cfg.holdPulse.from
      ? 1 + cfg.holdPulse.amplitude * Math.sin((frame - cfg.holdPulse.from) * 0.13)
      : 1;

  // ---- readout. Sampled on a 5-frame grid so it jumps rather than counting.
  const qFrame = Math.floor(frame / 5) * 5;
  let value: number;
  let fill: number;
  if (cfg.readout.kind === "percent") {
    value = Math.round(scanState(scan, qFrame).progress * 100);
    fill = value / 100;
  } else {
    const t = Math.min(1, qFrame / cfg.readout.settleFrame);
    fill = 1 - (1 - t) ** 2.2;
    value = fill * cfg.readout.max;
  }

  // Panel values are seeded from frame % duration, so the reroll sequence is
  // defined by position within the piece rather than by absolute frame number.
  const rollFrame = frame % durationInFrames;

  const d = drift(frame, durationInFrames);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bgDeep, overflow: "hidden" }}>
      {/* Scene, carrying the ambient drift. Closed path, so 0 and 420 agree. */}
      <AbsoluteFill style={{ transform: `translate(${d.x}px, ${d.y}px)` }}>
        <Backdrop palette={palette} />

        <RuleBar y={RULE_TOP_Y} palette={palette} seed="rule-top" frame={rollFrame} />
        <RuleBar y={RULE_BOTTOM_Y} palette={palette} seed="rule-bottom" frame={rollFrame} />

        <PercentDial
          rect={DIAL}
          palette={palette}
          readout={cfg.readout}
          value={value}
          fill={fill}
        />

        <CodePanel
          rect={CODE_A} palette={palette} label="TRACE / 0x41"
          seed="code-a" frame={rollFrame} fps={fps} speed={0.32}
        />
        <CodePanel
          rect={CODE_B} palette={palette} label="SEG / 0x0C"
          seed="code-b" frame={rollFrame} fps={fps} speed={0.19}
        />

        <DotGlobe
          rect={GLOBE} palette={palette} frame={frame}
          duration={durationInFrames} seed="globe"
        />

        <MeasureRule x={RULE_V.x} y={RULE_V.y} height={RULE_V.h} palette={palette} />

        <PatternPanel
          rect={PAT_A} palette={palette} label="FIELD" kind="dots"
          seed="pat-a" frame={rollFrame} fps={fps}
        />
        <PatternPanel
          rect={PAT_B} palette={palette} label="MESH" kind="mesh"
          seed="pat-b" frame={rollFrame} fps={fps}
        />

        {mask ? (
          <>
            {/* The print at rest. In "acquire" restingRidge is 0, so nothing
                shows until <ScanReveal> reveals it. */}
            <PrintMask
              mask={mask}
              palette={palette}
              brightness={cfg.restingRidge * pulse}
            />
            <ScanReveal
              mask={mask}
              palette={palette}
              scan={scan}
              frame={frame}
              pulse={pulse}
              flash={flash}
            />
            {cfg.minutiae ? (
              <MinutiaeMarkers
                mask={mask}
                config={cfg.minutiae}
                scan={scan}
                frame={frame}
                flash={flash}
              />
            ) : null}
          </>
        ) : null}

        <StatusPlate outcome={outcome} frame={frame} />
      </AbsoluteFill>

      {/* ---- finishing passes, outside the drift ---- */}
      {flash > 0 && outcome.kind === "match" ? (
        <AbsoluteFill
          style={{
            backgroundColor: outcome.flash,
            opacity: flash * 0.17,
            mixBlendMode: "screen",
          }}
        />
      ) : null}

      {/* Vignette, ~22%. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 74% 78% at 50% 50%, rgba(0,0,0,0) 38%, ${withAlpha(
            palette.bgDeep,
            0.22,
          )} 78%, rgba(0,0,0,0.22) 100%)`,
        }}
      />

      {/* Faint horizontal scanlines every 5px at ~3%. */}
      <AbsoluteFill
        style={{
          background:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 5px)",
        }}
      />

      <Grain frame={frame} />

      {/* Keeps W/H referenced as the authoritative frame size. */}
      <div style={{ position: "absolute", width: W, height: H, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
