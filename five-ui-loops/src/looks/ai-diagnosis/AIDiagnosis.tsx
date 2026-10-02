// Look 1 — AI Diagnosis Loading. 2.5D: a flat UI panel tilted with CSS 3D,
// shallow depth of field (sharp copy masked over a blurred copy), slow drift.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { AIDiagnosisVersion } from "../../versions";
import { MONO, MONTSERRAT } from "../../lib/fonts";
import { Grain } from "../../lib/Grain";
import { hash2, smoothstep } from "../../lib/random";
import { rgba } from "../../lib/color";
import { progressAt } from "./progress";
import { BodySilhouette, Helix, SidePanel } from "./Backdrop";

const STAGE_W = 5200;
const STAGE_H = 3000;
const PANEL_W = 3000;
const PANEL_H = 1300;
const BAR_X = 150;
const BAR_W = PANEL_W - 300;

const SmallCaps: React.FC<{ text: string; size: number }> = ({ text, size }) => (
  <>
    {text.split(" ").map((word, wi) => (
      <span key={wi} style={{ marginRight: wi < text.split(" ").length - 1 ? size * 0.55 : 0 }}>
        <span style={{ fontSize: size }}>{word[0]}</span>
        <span style={{ fontSize: size * 0.76 }}>{word.slice(1)}</span>
      </span>
    ))}
  </>
);

const Badge: React.FC<{ v: AIDiagnosisVersion; frame: number; flash: number }> = ({ v, frame, flash }) => {
  const rot = frame * 0.55;
  const glow = 0.55 + flash * 1.6;
  const ringColor = flash > 0.02 ? `rgba(235,248,255,${0.6 + 0.4 * flash})` : v.accent;
  return (
    <div style={{ position: "absolute", left: PANEL_W / 2 - 520 - 190, top: 50, width: 380, height: 380, transform: `scale(${1 + 0.07 * flash})` }}>
      <svg viewBox="0 0 380 380" style={{ position: "absolute", inset: 0, overflow: "visible", filter: `drop-shadow(0 0 ${14 + 30 * flash}px ${rgba(v.accent, Math.min(1, glow))})` }}>
        <circle cx={190} cy={190} r={128} fill="none" stroke={ringColor} strokeWidth={7} />
        <g transform={`rotate(${rot} 190 190)`}>
          <circle cx={190} cy={190} r={168} fill="none" stroke={ringColor} strokeWidth={5} strokeDasharray="300 90 140 527" strokeLinecap="round" opacity={0.9} />
        </g>
        <g transform={`rotate(${-rot * 0.6 + 40} 190 190)`}>
          <circle cx={190} cy={190} r={150} fill="none" stroke={ringColor} strokeWidth={3} strokeDasharray="60 160 30 692" opacity={0.6} />
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: MONTSERRAT,
          fontWeight: 600,
          fontSize: 150,
          color: flash > 0.02 ? "#F2FAFF" : v.accent,
          transform: "skewX(-12deg)",
          textShadow: `0 0 ${20 + 40 * flash}px ${rgba(v.accent, 0.8)}`,
          letterSpacing: 4,
        }}
      >
        AI
      </div>
    </div>
  );
};

const Panel: React.FC<{ v: AIDiagnosisVersion; frame: number }> = ({ v, frame }) => {
  const p = progressAt(v.seed, frame);
  const flash = frame >= 395 ? Math.exp(-(frame - 395) / 7) * smoothstep(394, 397, frame) : 0;
  // ID: digits flicker for the first second, then lock.
  const code = v.code
    .split("")
    .map((ch, i) => (/[0-9]/.test(ch) && frame < 30 ? String(Math.floor(hash2(Math.floor(frame / 2), i * 31 + v.seed) * 10)) : ch))
    .join("");
  const dots = 1 + (Math.floor(frame / 12) % 3);
  const waitOpacity = 1 - smoothstep(390, 402, frame);
  const doneOpacity = smoothstep(398, 412, frame);
  const fillW = BAR_W * p;
  const accentText = v.accent;
  return (
    <div
      style={{
        position: "absolute",
        left: (STAGE_W - PANEL_W) / 2,
        top: (STAGE_H - PANEL_H) / 2,
        width: PANEL_W,
        height: PANEL_H,
        borderRadius: 64,
        background: `linear-gradient(160deg, ${rgba(v.panel, 0.9)} 0%, ${rgba(v.panel, 0.84)} 60%, rgba(6,20,42,0.88) 100%)`,
        border: `6px solid ${rgba(v.frame, 0.9)}`,
        boxShadow: `0 0 0 18px ${rgba(v.panel, 0.35)}, 0 0 80px ${rgba(v.accent, 0.12)}, inset 0 0 120px rgba(0,0,0,0.35)`,
      }}
    >
      {/* inner hairline frame + corner ticks */}
      <div style={{ position: "absolute", inset: 34, borderRadius: 40, border: `2px solid ${rgba(v.frame, 0.35)}` }} />
      {[0, 1, 2, 3].map((c) => (
        <div
          key={c}
          style={{
            position: "absolute",
            width: 90,
            height: 90,
            left: c % 2 ? undefined : 60,
            right: c % 2 ? 60 : undefined,
            top: c < 2 ? 60 : undefined,
            bottom: c < 2 ? undefined : 60,
            borderLeft: c % 2 ? undefined : `5px solid ${rgba(v.accent, 0.55)}`,
            borderRight: c % 2 ? `5px solid ${rgba(v.accent, 0.55)}` : undefined,
            borderTop: c < 2 ? `5px solid ${rgba(v.accent, 0.55)}` : undefined,
            borderBottom: c < 2 ? undefined : `5px solid ${rgba(v.accent, 0.55)}`,
          }}
        />
      ))}
      <Badge v={v} frame={frame} flash={flash} />
      {/* Title + ID */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 470,
          display: "flex",
          justifyContent: "center",
          alignItems: "baseline",
          fontFamily: MONO,
          fontWeight: 400,
          color: accentText,
          letterSpacing: "0.16em",
          whiteSpace: "nowrap",
          textShadow: `0 0 18px ${rgba(v.accent, 0.55)}`,
        }}
      >
        <SmallCaps text={v.title} size={170} />
        <span style={{ marginLeft: 150, fontSize: 210, fontWeight: 500, color: "#E4F3FF", letterSpacing: "0.1em", textShadow: `0 0 24px ${rgba(v.accent, 0.6)}` }}>
          {code}
        </span>
      </div>
      {/* Status line */}
      <div style={{ position: "absolute", left: 640, top: 720, height: 120, fontFamily: MONO, fontSize: 104, color: v.accentDim, letterSpacing: "0.04em" }}>
        <span style={{ position: "absolute", whiteSpace: "nowrap", opacity: waitOpacity }}>
          Please wait
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ opacity: i < dots ? 1 : 0 }}>.</span>
          ))}
        </span>
        <span style={{ position: "absolute", whiteSpace: "nowrap", opacity: doneOpacity, color: v.accent, textShadow: `0 0 20px ${rgba(v.accent, 0.6)}` }}>
          <svg viewBox="0 0 100 100" style={{ width: 92, height: 92, marginRight: 34, verticalAlign: "-10px", overflow: "visible" }}>
            <circle cx={50} cy={50} r={44} fill="none" stroke={v.accent} strokeWidth={7} />
            <path d="M28,52 L44,67 L73,36" fill="none" stroke={v.accent} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={80} strokeDashoffset={80 * (1 - smoothstep(400, 416, frame))} />
          </svg>
          Complete
        </span>
      </div>
      {/* Progress bar */}
      <div style={{ position: "absolute", left: BAR_X, top: 930, width: BAR_W, height: 104, borderRadius: 14, background: rgba(v.track, 0.95), boxShadow: `inset 0 0 0 3px ${rgba(v.accent, 0.25)}` }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: fillW,
            borderRadius: 14,
            background: "linear-gradient(180deg, #FFFFFF 0%, #EAF5FF 55%, #CFE6FF 100%)",
            boxShadow: `0 0 40px ${rgba("#DDF0FF", 0.55)}, 0 0 110px ${rgba(v.accent, 0.35)}`,
          }}
        />
        {/* leading-edge glow */}
        <div
          style={{
            position: "absolute",
            left: fillW - 260,
            top: -150,
            width: 520,
            height: 404,
            borderRadius: "50%",
            background: `radial-gradient(closest-side, rgba(255,255,255,0.85) 0%, ${rgba(v.accent, 0.35)} 45%, rgba(0,0,0,0) 100%)`,
            mixBlendMode: "screen",
            opacity: smoothstep(0, 0.01, p) * (1 - smoothstep(390, 412, frame)),
          }}
        />
      </div>
      {/* small read-outs under the bar */}
      <div style={{ position: "absolute", left: BAR_X, top: 1080, width: BAR_W, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 60, color: rgba(v.accentDim, 0.9), letterSpacing: "0.12em" }}>
        <span>{"█".repeat(0)}SEQ {String(Math.min(12, Math.floor(p * 12) + (p >= 1 ? 0 : 1))).padStart(2, "0")}/12</span>
        <span>{String(Math.floor(p * 100)).padStart(3, "0")}%</span>
      </div>
    </div>
  );
};

const World: React.FC<{ v: AIDiagnosisVersion; frame: number }> = ({ v, frame }) => {
  const t = frame / 449;
  const e = Easing.inOut(Easing.sin)(t);
  const dx = interpolate(e, [0, 1], [170, -170]);
  const dy = interpolate(e, [0, 1], [40, -30]);
  const rz = interpolate(e, [0, 1], [-8.5, -7]);
  const ry = interpolate(e, [0, 1], [-13, -9]);
  const scanY = interpolate(frame % 180, [0, 179], [-100, 2500]);
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.07);
  return (
    <AbsoluteFill style={{ perspective: 2700, perspectiveOrigin: "50% 45%" }}>
      <div
        style={{
          position: "absolute",
          left: (3840 - STAGE_W) / 2,
          top: (2160 - STAGE_H) / 2,
          width: STAGE_W,
          height: STAGE_H,
          transformStyle: "preserve-3d",
          transform: `translate3d(${dx}px, ${dy}px, 0) rotateX(20deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(1.12)`,
        }}
      >
        {/* backdrop grid */}
        <div
          style={{
            position: "absolute",
            inset: -400,
            backgroundImage: `linear-gradient(${rgba(v.frame, 0.1)} 3px, transparent 3px), linear-gradient(90deg, ${rgba(v.frame, 0.1)} 3px, transparent 3px)`,
            backgroundSize: "220px 220px",
          }}
        />
        <div style={{ position: "absolute", left: 420, top: 560, width: 900, height: 1500, filter: "blur(10px)", opacity: 0.85 }}>
          <SidePanel accent={v.accent} frameColor={v.frame} variant={0} pulse={pulse} />
        </div>
        <div style={{ position: "absolute", left: STAGE_W - 1380, top: 420, width: 900, height: 1500, filter: "blur(10px)", opacity: 0.85 }}>
          <SidePanel accent={v.accent} frameColor={v.frame} variant={1} pulse={1 - pulse} />
        </div>
        <div style={{ position: "absolute", left: 1500, top: 120, width: 1150, height: 2760, filter: "blur(9px)", opacity: 0.8 }}>
          {v.backdrop === "body" ? <BodySilhouette accent={v.accent} scanY={scanY} /> : <Helix accent={v.accent} phase={frame * 0.022} />}
        </div>
        <Panel v={v} frame={frame} />
      </div>
    </AbsoluteFill>
  );
};

export const AIDiagnosis: React.FC<{ version: AIDiagnosisVersion }> = ({ version: v }) => {
  const frame = useCurrentFrame();
  const fadeIn = smoothstep(0, 30, frame);
  // Focus band follows the title line (tilted like the panel), soft elsewhere.
  const mask =
    "linear-gradient(171deg, transparent 18%, black 33%, black 52%, transparent 70%), linear-gradient(90deg, transparent 2%, black 24%, black 82%, transparent 99%)";
  return (
    <AbsoluteFill style={{ backgroundColor: "#020A16" }}>
      <AbsoluteFill style={{ opacity: fadeIn }}>
        <AbsoluteFill style={{ filter: "blur(16px)" }}>
          <World v={v} frame={frame} />
        </AbsoluteFill>
        <AbsoluteFill
          style={{
            WebkitMaskImage: mask,
            maskImage: mask,
            WebkitMaskComposite: "source-in",
            maskComposite: "intersect",
          }}
        >
          <World v={v} frame={frame} />
        </AbsoluteFill>
      </AbsoluteFill>
      {/* lens vignette */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,4,12,0.55) 100%)" }} />
      <Grain amount={0.02} />
    </AbsoluteFill>
  );
};
