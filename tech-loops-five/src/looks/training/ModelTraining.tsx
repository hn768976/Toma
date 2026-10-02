import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { withAlpha } from "../../lib/color";
import { INTER, MONO } from "../../lib/fonts";
import { Grain } from "../../lib/Grain";
import { clamp, smoothstep } from "../../lib/loop";
import type { TrainingVersion } from "../../versions";
import { CODE } from "./code";
import {
  TOTAL_STEPS,
  buildLogs,
  buildSchedule,
  charsAt,
  epochAt,
  gpuAt,
  highlight,
  lossAt,
  progressAt,
  stepAt,
  valAccAt,
  vramAt,
  type LogEntry,
  type Schedule,
  type Seg,
} from "./engine";

/**
 * Look 4 — Model Training UI (2D, 600 frames, not a loop).
 * Every visible value is computed from the frame: typed characters come from
 * a seeded schedule built once at module level, logs from a precomputed list
 * filtered by emission frame.
 */

const BG = "#0A0D13";
const PANEL = "#0D1118";
const BORDER = "#1C2330";
const TEXT = "#C9D4E2";
const DIM = "#6B7889";

const TYPE_START = 30;
const TYPE_END = 540;

// module-level, seeded, built once
const SCHEDULES: Record<string, Schedule> = {};
const HIGHLIGHTS: Record<string, Seg[][]> = {};
for (const [key, c] of Object.entries(CODE)) {
  SCHEDULES[key] = buildSchedule(c.text, key.length * 1013 + 17, TYPE_START, TYPE_END);
  HIGHLIGHTS[key] = highlight(c.text);
}
const LOGS: Record<string, LogEntry[]> = {};
const logsFor = (v: TrainingVersion) => {
  const k = `${v.logs}|${v.modelName}`;
  if (!LOGS[k]) LOGS[k] = buildLogs(v.logs, v.modelName);
  return LOGS[k];
};

/* ───────────────────────── small UI parts ───────────────────────── */

const Gear: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth={7}>
    {Array.from({ length: 8 }, (_, i) => (
      <rect key={i} x={44} y={4} width={12} height={18} rx={2} fill={color} stroke="none" transform={`rotate(${i * 45} 50 50)`} />
    ))}
    <circle cx={50} cy={50} r={30} />
    <circle cx={50} cy={50} r={12} />
  </svg>
);

const SearchIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" stroke={color} strokeWidth={9} strokeLinecap="round">
    <circle cx={42} cy={42} r={28} />
    <path d="M64 64 L88 88" />
  </svg>
);

const Tab: React.FC<{ label: string; active?: boolean; accent: string }> = ({ label, active, accent }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 22,
      height: 76,
      padding: "0 34px",
      fontFamily: MONO,
      fontSize: 30,
      color: active ? TEXT : DIM,
      background: active ? PANEL : "transparent",
      borderTop: `3px solid ${active ? accent : "transparent"}`,
      borderRight: `2px solid ${BORDER}`,
    }}
  >
    {label}
    <span style={{ color: DIM, fontSize: 26 }}>×</span>
  </div>
);

/** Renders highlighted code, truncated to `visible` characters. */
const CodeView: React.FC<{
  text: string;
  lines: Seg[][];
  visible: number;
  fontSize: number;
  lineH: number;
  cursor: boolean;
  accent: string;
}> = ({ text, lines, visible, fontSize, lineH, cursor, accent }) => {
  const cursorLine = cursorLineOf(text, visible);
  const cursorCol = visible - (text.lastIndexOf("\n", visible - 1) + 1);
  const charW = fontSize * 0.6;
  const gutter = fontSize * 3.7;
  return (
    <div style={{ position: "relative", fontFamily: MONO, fontSize, lineHeight: `${lineH}px`, whiteSpace: "pre", fontVariantLigatures: "none" }}>
      {lines.slice(0, cursorLine + 1).map((segs, li) => (
        <div key={li} style={{ height: lineH, display: "flex" }}>
          <span style={{ width: fontSize * 2.6, color: "#3A4555", textAlign: "right", marginRight: fontSize * 1.1, flexShrink: 0 }}>{li + 1}</span>
          <span>
            {segs
              .filter((sg) => sg.start < visible)
              .map((sg, si) => (
                <span key={si} style={{ color: sg.color }}>
                  {sg.text.slice(0, visible - sg.start)}
                </span>
              ))}
          </span>
        </div>
      ))}
      {cursor ? (
        <div
          style={{
            position: "absolute",
            left: gutter + cursorCol * charW,
            top: cursorLine * lineH + lineH * 0.14,
            width: fontSize * 0.09 + 2,
            height: lineH * 0.72,
            background: accent,
            boxShadow: `0 0 10px ${accent}`,
          }}
        />
      ) : null}
    </div>
  );
};

/** Cursor line index for auto-scroll. */
const cursorLineOf = (text: string, visible: number) => {
  let n = 0;
  for (let i = 0; i < Math.min(visible, text.length); i++) if (text[i] === "\n") n++;
  return n;
};

/* ───────────────────────── Orb ───────────────────────── */

const Orb: React.FC<{ frame: number; colors: [string, string, string]; size: number }> = ({ frame, colors, size }) => {
  const t = frame / 30;
  const blobs = [
    { c: colors[0], ph: 0, r: 0.62 },
    { c: colors[1], ph: 2.1, r: 0.55 },
    { c: colors[2], ph: 4.2, r: 0.58 },
  ];
  return (
    <div style={{ position: "relative", width: size, height: size, borderRadius: "50%", overflow: "hidden", filter: `blur(${size * 0.035}px)`, background: colors[0] }}>
      {blobs.map((b, i) => {
        const a = b.ph + t * (0.32 + i * 0.07);
        const x = 0.5 + 0.28 * Math.cos(a) - b.r / 2;
        const y = 0.5 + 0.28 * Math.sin(a * 1.13 + i) - b.r / 2;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x * size,
              top: y * size,
              width: b.r * size,
              height: b.r * size,
              borderRadius: "50%",
              background: b.c,
              filter: `blur(${size * 0.12}px)`,
              opacity: 0.95,
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `conic-gradient(from ${t * 24}deg, ${withAlpha(colors[1], 0.55)}, ${withAlpha(colors[2], 0.55)}, ${withAlpha(colors[0], 0.55)}, ${withAlpha(colors[1], 0.55)})`,
          mixBlendMode: "soft-light",
        }}
      />
    </div>
  );
};

/* ───────────────────────── Composition ───────────────────────── */

export const ModelTraining: React.FC<{ v: TrainingVersion }> = ({ v }) => {
  const frame = useCurrentFrame();
  const accent = v.accent;
  const fadeIn = interpolate(frame, [0, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── centre editor (typing)
  const center = CODE[v.centerCode];
  const sched = SCHEDULES[v.centerCode];
  const visible = charsAt(sched, frame);
  const typing = frame >= TYPE_START && frame < TYPE_END + 4 && visible < center.text.length;
  const blinkOn = Math.floor(frame / 16) % 2 === 0;
  const cursorVisible = typing || blinkOn;
  const cLineH = 54;
  const cVisibleLines = 18;
  const cLine = cursorLineOf(center.text, visible);
  // smooth auto-scroll: keep the cursor about 3 lines above the bottom edge
  const lineFrac = (() => {
    const lastNl = center.text.lastIndexOf("\n", visible - 1);
    const nextNl = center.text.indexOf("\n", visible);
    const len = (nextNl === -1 ? center.text.length : nextNl) - lastNl;
    return clamp((visible - lastNl - 1) / Math.max(1, len));
  })();
  const cScroll = Math.max(0, cLine + lineFrac - (cVisibleLines - 3)) * cLineH;

  // ── right editor (slow scroll through a longer script)
  const right = CODE[v.rightCode];
  const rLineH = 46;
  const rLines = HIGHLIGHTS[v.rightCode].length;
  const rVisible = 38;
  const rScroll = smoothstep(40, 590, frame) * Math.max(0, rLines - rVisible + 2) * rLineH;

  // ── training state
  const step = stepAt(frame);
  const epoch = epochAt(frame);
  const done = frame >= 540;
  const loss = lossAt(step, v.logs);
  const gpu = gpuAt(frame);
  const vram = vramAt(frame);
  const etaMin = Math.max(0, Math.round((1 - progressAt(frame)) * 61));
  const valAcc = valAccAt(step);

  // ── logs: entries emitted so far, newest slides in from below
  const logs = logsFor(v).filter((l) => l.frame <= frame);
  const lastEmit = logs.length ? logs[logs.length - 1].frame : 0;
  const slide = 1 - smoothstep(0, 6, frame - lastEmit);
  const LOG_LINES = 15;
  const logLineH = 46;
  const shown = logs.slice(-LOG_LINES - 1);

  const W1 = 900; // left column
  const W2 = 1480; // centre column
  const TOP = 120;

  return (
    // key={frame}: fresh DOM/layers every frame → identical raster cold or mid-sequence
    <AbsoluteFill key={frame} style={{ backgroundColor: BG, fontVariantLigatures: "none" }}>
      <AbsoluteFill style={{ opacity: fadeIn }}>
        {/* ── top bar ── */}
        <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: TOP, borderBottom: `2px solid ${BORDER}`, display: "flex", alignItems: "center", padding: "0 48px", gap: 34, background: "#0B0F16" }}>
          <Gear size={52} color={TEXT} />
          <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 40, color: TEXT, letterSpacing: "0.02em" }}>{v.title}</div>
          <div style={{ width: 4, height: 54, background: accent, marginLeft: 20 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "12px 30px", border: `2px solid ${BORDER}`, borderRadius: 8, background: PANEL, fontFamily: MONO, fontSize: 30, color: TEXT }}>
            Project_01
            <span style={{ color: DIM }}>|</span>
            <span style={{ width: 16, height: 16, borderRadius: 8, background: done ? DIM : "#33D17A", boxShadow: done ? "none" : `0 0 ${10 + 6 * (Math.floor(frame / 20) % 2)}px #33D17A` }} />
            <span style={{ color: done ? DIM : "#33D17A" }}>{done ? "Training Complete" : "Training Active"}</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ width: 640, height: 66, border: `2px solid ${BORDER}`, borderRadius: 8, background: "#0E131B", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", fontFamily: INTER, fontSize: 28, color: DIM }}>
            Search runs, files, metrics
            <SearchIcon size={34} color={DIM} />
          </div>
        </div>

        {/* ── left column ── */}
        <div style={{ position: "absolute", left: 0, top: TOP, width: W1, bottom: 0, borderRight: `2px solid ${BORDER}` }}>
          <div style={{ height: 900, display: "flex", alignItems: "center", justifyContent: "center", background: "#07090D", borderBottom: `2px solid ${BORDER}` }}>
            <Orb frame={frame} colors={v.orb} size={600} />
          </div>
          <div style={{ padding: "56px 56px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, fontFamily: MONO, fontSize: 34, color: TEXT, marginBottom: 56 }}>
              <span style={{ width: 18, height: 18, background: accent, transform: "rotate(45deg)", boxShadow: `0 0 10px ${accent}` }} />
              Training Snapshot
            </div>
            {[
              ["Model", v.modelName, TEXT],
              ["Epoch", `${epoch} / 3`, TEXT],
              [v.logs === "llm" ? "Training Loss" : "Val Accuracy", v.logs === "llm" ? loss.toFixed(4) : valAcc.toFixed(3), accent],
              ["GPU Usage", `${Math.round(gpu)}%`, accent],
              ["VRAM", `${vram.toFixed(1)} / 80.0 GB`, TEXT],
              ["ETA", done ? "done" : `${Math.floor(etaMin / 60)}h ${String(etaMin % 60).padStart(2, "0")}m`, TEXT],
              ["Step", `${step.toLocaleString("en-US")} / ${TOTAL_STEPS.toLocaleString("en-US")}`, DIM],
            ].map(([k, val, c]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 30, height: 104, alignItems: "center", borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ color: DIM }}>{k}</span>
                <span style={{ color: c }}>{val}</span>
              </div>
            ))}
            <div style={{ marginTop: 50, height: 10, background: "#151B25", borderRadius: 5 }}>
              <div style={{ width: `${progressAt(frame) * 100}%`, height: "100%", background: accent, borderRadius: 5, boxShadow: `0 0 12px ${accent}` }} />
            </div>
            <div style={{ fontFamily: MONO, fontSize: 28, color: DIM, marginTop: 40 }}>View Full Metrics →</div>
          </div>
        </div>

        {/* ── centre: editor ── */}
        <div style={{ position: "absolute", left: W1, top: TOP, width: W2, height: 1130, borderRight: `2px solid ${BORDER}`, background: PANEL }}>
          <div style={{ display: "flex", height: 76, background: "#0A0E14", borderBottom: `2px solid ${BORDER}` }}>
            <Tab label={center.file} active accent={accent} />
          </div>
          <div style={{ position: "absolute", left: 30, right: 20, top: 110, height: cVisibleLines * cLineH, overflow: "hidden" }}>
            <div style={{ transform: `translateY(${-cScroll}px)` }}>
              <CodeView text={center.text} lines={HIGHLIGHTS[v.centerCode]} visible={visible} fontSize={31} lineH={cLineH} cursor={cursorVisible} accent={accent} />
            </div>
          </div>
        </div>

        {/* ── bottom centre: terminal / logs ── */}
        <div style={{ position: "absolute", left: W1, top: TOP + 1130, width: W2, bottom: 0, borderTop: `2px solid ${BORDER}`, borderRight: `2px solid ${BORDER}`, background: "#090C11" }}>
          <div style={{ display: "flex", gap: 0, height: 72, borderBottom: `2px solid ${BORDER}`, fontFamily: MONO, fontSize: 30 }}>
            <div style={{ padding: "0 36px", display: "flex", alignItems: "center", color: TEXT, borderBottom: `3px solid ${accent}` }}>Terminal</div>
            <div style={{ padding: "0 36px", display: "flex", alignItems: "center", color: DIM }}>Logs</div>
          </div>
          <div style={{ position: "absolute", left: 34, right: 20, top: 96, height: LOG_LINES * logLineH, overflow: "hidden" }}>
            {shown.map((l, i) => {
              const row = i - (shown.length - LOG_LINES) + slide;
              const c = l.level === "WARN" ? "#E8C25A" : l.level === "DONE" ? "#4BE08F" : i === shown.length - 1 ? TEXT : "#9AA7B8";
              return (
                <div key={`${l.frame}-${i}`} style={{ position: "absolute", top: row * logLineH, fontFamily: MONO, fontSize: 25, color: c, whiteSpace: "pre", fontWeight: l.level === "DONE" ? 700 : 400 }}>
                  {l.text}
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: 34, bottom: 34, fontFamily: MONO, fontSize: 26, color: DIM }}>
            <span style={{ color: accent }}>❯</span> python {center.file}
            <span style={{ display: "inline-block", width: 14, height: 28, marginLeft: 12, verticalAlign: "middle", background: blinkOn ? TEXT : "transparent" }} />
          </div>
        </div>

        {/* ── right: second editor, slowly scrolling ── */}
        <div style={{ position: "absolute", left: W1 + W2, top: TOP, right: 0, bottom: 0, background: PANEL }}>
          <div style={{ display: "flex", height: 76, background: "#0A0E14", borderBottom: `2px solid ${BORDER}` }}>
            <Tab label={right.file.split("/").pop()!} active accent={accent} />
            <Tab label={center.file} accent={accent} />
          </div>
          <div style={{ position: "absolute", left: 30, right: 20, top: 110, bottom: 30, overflow: "hidden" }}>
            <div style={{ transform: `translateY(${-rScroll}px)` }}>
              <CodeView text={right.text} lines={HIGHLIGHTS[v.rightCode]} visible={right.text.length} fontSize={27} lineH={rLineH} cursor={false} accent={accent} />
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Grain amount={0.015} seed={4} />
    </AbsoluteFill>
  );
};
