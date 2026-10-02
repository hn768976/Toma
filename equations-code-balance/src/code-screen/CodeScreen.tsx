import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import "../common/fonts";
import { INTER, MONO } from "../common/fonts";
import { Grain } from "../common/Grain";
import { GlowFilter } from "../common/GlowFilter";
import { loopPhase, mod, TAU } from "../common/math";
import { useUnit } from "../common/units";
import { CODE_LINES } from "./code";
import { SPHERE_POINTS } from "./sphere";
import { DARK, LIGHT, type CodeTheme } from "./themes";

export const LOOP = 600;

export type CodeScreenProps = { variant: "dark" | "light"; loopCheck?: boolean };

// Screen surface, in design px before the camera transform.
const SW = 3600;
const SH = 2300;
const FONT = 50;
const LH = 82;
const BLOCK_H = CODE_LINES.length * LH;
const EDITOR = { x: 610, y: 150, w: 1560, h: 1500 };
const SPHERE = { cx: 2780, cy: 860, r: 700 };

const lerpColor = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
};

/** The whole screen, flat. Rendered several times for the tilt-shift. */
const Screen: React.FC<{
  frame: number;
  theme: CodeTheme;
  u: (n: number) => number;
  copy: number;
}> = ({ frame, theme, u, copy }) => {
  const phase = loopPhase(frame, LOOP);
  const scroll = phase * BLOCK_H; // exactly one block per loop
  const first = Math.floor(scroll / LH) - 1;
  const visible = Math.ceil(EDITOR.h / LH) + 3;
  const lines = Array.from({ length: visible }, (_, i) => first + i);

  // Cursor: 20 blinks per loop (on 15 frames, off 15 frames).
  const cursorOn = Math.floor(mod(frame, LOOP) / 15) % 2 === 0;

  // Sphere: one full turn per loop around a tilted axis.
  const ang = phase * TAU;
  const tilt = 0.38;
  const dots = SPHERE_POINTS.map((p) => {
    const x1 = p.x * Math.cos(ang) + p.z * Math.sin(ang);
    const z1 = -p.x * Math.sin(ang) + p.z * Math.cos(ang);
    const y2 = p.y * Math.cos(tilt) - z1 * Math.sin(tilt);
    const z2 = p.y * Math.sin(tilt) + z1 * Math.cos(tilt);
    return { x: x1, y: y2, z: z2, p };
  }).sort((a, b) => a.z - b.z);

  const panel = (x: number, y: number, w: number, h: number, children?: React.ReactNode) => (
    <div
      style={{
        position: "absolute",
        left: u(x),
        top: u(y),
        width: u(w),
        height: u(h),
        borderRadius: u(22),
        background: theme.panel,
        border: `${u(2)}px solid ${theme.panelBorder}`,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );

  const bar = (x: number, y: number, w: number, o = 1, color = theme.uiMuted) => (
    <div style={{ position: "absolute", left: u(x), top: u(y), width: u(w), height: u(14), borderRadius: u(7), background: color, opacity: 0.45 * o }} />
  );

  return (
    <div
      style={{
        position: "absolute",
        width: u(SW),
        height: u(SH),
        background: theme.screen,
        borderRadius: u(30),
        overflow: "hidden",
        fontFamily: INTER,
        color: theme.uiText,
      }}
    >
      {/* Top strip */}
      <div style={{ position: "absolute", left: u(60), top: u(36), display: "flex", gap: u(70), fontSize: u(40), fontWeight: 500, color: theme.uiMuted }}>
        <span style={{ color: theme.uiText }}>Workspace</span>
        <span>Files</span>
        <span>Run</span>
        <span>Notes</span>
        <span>Settings</span>
      </div>
      <div style={{ position: "absolute", right: u(70), top: u(40), display: "flex", gap: u(26) }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: u(34), height: u(34), borderRadius: "50%", border: `${u(3)}px solid ${theme.uiMuted}`, opacity: 0.7 }} />
        ))}
      </div>

      {/* Sidebar: small panels and icons */}
      {panel(40, 150, 520, 760, (
        <>
          <div style={{ position: "absolute", left: u(34), top: u(26), fontSize: u(30), fontWeight: 600, color: theme.uiMuted, letterSpacing: u(2) }}>PROJECT</div>
          {Array.from({ length: 12 }, (_, i) => (
            <React.Fragment key={i}>
              <div style={{ position: "absolute", left: u(34 + (i % 4 === 0 ? 0 : 34)), top: u(98 + i * 52), width: u(22), height: u(22), borderRadius: u(5), border: `${u(2.5)}px solid ${i === 3 ? theme.accent : theme.uiMuted}`, opacity: 0.7 }} />
              {bar(76 + (i % 4 === 0 ? 0 : 34), 102 + i * 52, 140 + ((i * 97) % 180), i === 3 ? 1.8 : 1, i === 3 ? theme.accent : theme.uiMuted)}
            </React.Fragment>
          ))}
        </>
      ))}
      {panel(40, 940, 520, 560, (
        <svg width={u(520)} height={u(560)} style={{ position: "absolute" }}>
          {Array.from({ length: 40 }, (_, i) => {
            const x = 40 + ((i * 137) % 440);
            const y = 60 + ((i * 251) % 460);
            const c = i % 5 === 0 ? theme.tokens.string : i % 3 === 0 ? theme.accent : theme.uiMuted;
            return <circle key={i} cx={u(x)} cy={u(y)} r={u(i % 7 === 0 ? 7 : 4)} fill={c} opacity={0.55} />;
          })}
        </svg>
      ))}
      {panel(40, 1530, 520, 700, (
        <>
          <div style={{ position: "absolute", right: u(30), top: u(26), display: "flex", gap: u(18) }}>
            <svg width={u(36)} height={u(36)} viewBox="0 0 36 36"><circle cx="15" cy="15" r="10" fill="none" stroke={theme.accent} strokeWidth="3.5" /><path d="M23 23 L32 32" stroke={theme.accent} strokeWidth="3.5" strokeLinecap="round" /></svg>
            <svg width={u(36)} height={u(36)} viewBox="0 0 36 36"><circle cx="18" cy="18" r="7" fill="none" stroke={theme.accent} strokeWidth="3.5" /><circle cx="18" cy="18" r="14" fill="none" stroke={theme.accent} strokeWidth="3" strokeDasharray="5 4" /></svg>
          </div>
          {Array.from({ length: 7 }, (_, i) => bar(34, 100 + i * 58, 200 + ((i * 131) % 230), 1))}
        </>
      ))}

      {/* Code editor */}
      <div style={{ position: "absolute", left: u(EDITOR.x), top: u(EDITOR.y), width: u(EDITOR.w), height: u(EDITOR.h), borderRadius: u(24), background: theme.editor, border: `${u(2)}px solid ${theme.panelBorder}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: u(70), borderBottom: `${u(2)}px solid ${theme.panelBorder}`, display: "flex", alignItems: "center", paddingLeft: u(40), gap: u(40), fontSize: u(32), fontFamily: MONO, color: theme.uiMuted, zIndex: 2, background: theme.editor }}>
          <span style={{ color: theme.uiText }}>bst.py</span>
          <span>tests.py</span>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: u(70), bottom: 0, overflow: "hidden" }}>
          {lines.map((idx) => {
            const lineNo = mod(idx, CODE_LINES.length);
            const y = idx * LH - scroll + u(0);
            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: u(y + 20),
                  height: u(LH),
                  display: "flex",
                  alignItems: "center",
                  fontFamily: MONO,
                  fontSize: u(FONT),
                  whiteSpace: "pre",
                }}
              >
                <span style={{ width: u(120), textAlign: "right", paddingRight: u(40), color: theme.gutterText, fontSize: u(FONT * 0.8) }}>{lineNo + 1}</span>
                <span>
                  {CODE_LINES[lineNo].map((t, i) => (
                    <span key={i} style={{ color: theme.tokens[t.kind], fontWeight: t.kind === "keyword" || t.kind === "fn" ? 700 : 400 }}>{t.text}</span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI mark inside a sphere of particles */}
      <div style={{ position: "absolute", left: u(SPHERE.cx - SPHERE.r * 1.6), top: u(SPHERE.cy - SPHERE.r * 1.6), width: u(SPHERE.r * 3.2), height: u(SPHERE.r * 3.2), borderRadius: "50%", background: `radial-gradient(circle, ${theme.bloom} 0%, transparent 62%)` }} />
      <svg width={u(SW)} height={u(SH)} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <defs>
          <linearGradient id={`ai-grad-${copy}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={theme.aiGradient[0]} />
            <stop offset="1" stopColor={theme.aiGradient[1]} />
          </linearGradient>
          <GlowFilter id={`ai-glow-${copy}`} base={u(5)} strength={[0.8 * theme.aiGlow, 0.5 * theme.aiGlow, 0.35 * theme.aiGlow]} />
        </defs>
        {dots.map(({ x, y, z, p }, i) => {
          const near = (z + 1) / 2; // 0 far .. 1 near
          return (
            <circle
              key={i}
              cx={u(SPHERE.cx + x * SPHERE.r)}
              cy={u(SPHERE.cy + y * SPHERE.r)}
              r={u((3.5 + 6 * near) * p.size)}
              fill={lerpColor(theme.sphereDot[0], theme.sphereDot[1], p.tint * 0.6 + (1 - near) * 0.4)}
              opacity={(0.18 + 0.82 * near) * theme.sphereOpacity}
            />
          );
        })}
        <text
          x={u(SPHERE.cx)}
          y={u(SPHERE.cy + 190)}
          textAnchor="middle"
          fontFamily={INTER}
          fontWeight={600}
          fontSize={u(540)}
          letterSpacing={u(10)}
          fill={`url(#ai-grad-${copy})`}
          filter={`url(#ai-glow-${copy})`}
        >
          AI
        </text>
      </svg>

      {/* Prompt bar */}
      <div style={{ position: "absolute", left: u(EDITOR.x + 40), right: u(140), top: u(1690), height: u(170), borderRadius: u(85), background: theme.promptBar, border: `${u(3)}px solid ${theme.promptBorder}`, display: "flex", alignItems: "center", paddingLeft: u(760), fontSize: u(58), color: theme.promptText }}>
        <div style={{ width: u(5), height: u(62), background: theme.cursor, marginRight: u(14), opacity: cursorOn ? 1 : 0 }} />
        Type your prompt
        <div style={{ position: "absolute", right: u(22), top: u(22), width: u(100), height: u(100), borderRadius: "50%", background: `linear-gradient(135deg, ${theme.aiGradient[0]}, ${theme.aiGradient[1]})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={u(48)} height={u(48)} viewBox="0 0 48 48"><path d="M24 38 L24 12 M13 22 L24 11 L35 22" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>
    </div>
  );
};

/** Tilt-shift: blur per copy (design px) and its screen-space mask. */
const COPIES: Array<{ blur: number; mask?: string }> = [
  { blur: 30 },
  {
    blur: 14,
    mask: "radial-gradient(ellipse 66% 70% at 36% 54%, #000 45%, transparent 100%)",
  },
  {
    blur: 5,
    mask: "radial-gradient(ellipse 52% 48% at 36% 56%, #000 35%, transparent 100%)",
  },
  {
    blur: 0,
    mask: "radial-gradient(ellipse 38% 30% at 34% 54%, #000 30%, transparent 100%)",
  },
];

export const CodeScreen: React.FC<CodeScreenProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { u, width, height } = useUnit();
  const theme = variant === "dark" ? DARK : LIGHT;
  const phase = loopPhase(frame, LOOP);

  // Camera: slow closed slide along the screen (an ellipse per loop).
  const camX = 150 * Math.sin(TAU * phase);
  const camY = 60 * Math.sin(TAU * phase + Math.PI / 2) - 60 * Math.sin(TAU * 2 * phase) * 0.3;

  const screenTransform =
    `translate(-50%, -50%) translate3d(${u(260 - camX)}px, ${u(-80 - camY)}px, ${u(380)}px) ` +
    `rotateZ(-4deg) rotateY(26deg) rotateX(6deg)`;

  return (
    <AbsoluteFill style={{ background: theme.backdrop, overflow: "hidden" }}>
      {COPIES.map((c, i) => (
        <AbsoluteFill
          key={i}
          style={{
            perspective: u(2600),
            perspectiveOrigin: "50% 50%",
            filter: c.blur ? `blur(${u(c.blur)}px)` : undefined,
            WebkitMaskImage: c.mask,
            maskImage: c.mask,
          }}
        >
          <div style={{ position: "absolute", left: "50%", top: "50%", width: u(SW), height: u(SH), transform: screenTransform }}>
            <Screen frame={frame} theme={theme} u={u} copy={i} />
          </div>
        </AbsoluteFill>
      ))}
      <Grain id={`cs-${variant}`} seed={mod(frame, LOOP)} amount={theme.grain} />
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
        <rect width={width} height={height} />
      </svg>
    </AbsoluteFill>
  );
};
