import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { makeCode } from "../lib/code";
import { INTER, MONO } from "../lib/fonts";
import { GlowFilter } from "../lib/Glow";
import { Grain } from "../lib/Grain";
import { osc, phase, useLoopFrame, useUnits } from "../lib/loop";
import { hash01, mulberry32, range } from "../lib/random";
import { GLITCH_SCHEDULE } from "./schedules";
import type { GlitchPalette } from "./palettes";

// ---------------------------------------------------------------------------
// Background data (module level, seeded).
// ---------------------------------------------------------------------------
const LINE_H = 17; // 1080p px
const COLS = 12;
const COL_W = 1920 / COLS;
const VISIBLE = Math.ceil(1080 / LINE_H) + 2;

const colRng = mulberry32(0x2231);
const columns = Array.from({ length: COLS }, (_, i) => {
  const L = [40, 60, 80][Math.floor(colRng() * 3)]; // lines of content
  const laps = colRng() < 0.5 ? 1 : 2; // content lengths scrolled per loop
  return {
    lines: makeCode(0x5000 + i * 31, L, 19),
    L,
    laps,
    up: colRng() < 0.5,
    color: Math.floor(colRng() * 3),
    opacity: range(colRng, 0.14, 0.32),
    size: range(colRng, 10.5, 12),
    x: i * COL_W + range(colRng, -10, 10),
  };
});

// Plexus points on small closed orbits (whole cycles per loop).
const plRng = mulberry32(0x9e11);
const PLEX = Array.from({ length: 64 }, () => ({
  x: range(plRng, -40, 1960),
  y: range(plRng, -40, 1120),
  ax: range(plRng, 20, 70),
  ay: range(plRng, 15, 50),
  kx: 1 + Math.floor(plRng() * 2),
  ky: 1 + Math.floor(plRng() * 2),
  px: plRng(),
  py: plRng(),
}));
const LINK = 210;

// RGB noise patches: fixed rects, each visible in some 30-frame windows.
const nzRng = mulberry32(0x77aa);
const PATCHES = Array.from({ length: 9 }, () => ({
  x: range(nzRng, 0, 1700),
  y: range(nzRng, 0, 1000),
  w: range(nzRng, 80, 420),
  h: range(nzRng, 10, 90),
  cell: range(nzRng, 3, 9),
  salt: Math.floor(nzRng() * 1000),
}));

const eventAt = (f: number) => GLITCH_SCHEDULE.find((e) => f >= e.start && f < e.start + e.len);

// ---------------------------------------------------------------------------

const Plexus: React.FC<{ f: number; color: string }> = ({ f, color }) => {
  const pts = PLEX.map((q) => [q.x + q.ax * osc(f, q.kx, q.px), q.y + q.ay * osc(f, q.ky, q.py)]);
  const lines: React.ReactNode[] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
      if (d < LINK) {
        lines.push(
          <line key={`${i}-${j}`} x1={pts[i][0]} y1={pts[i][1]} x2={pts[j][0]} y2={pts[j][1]} strokeOpacity={(1 - d / LINK) * 0.35} />,
        );
      }
    }
  }
  return (
    <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <g stroke={color} strokeWidth={0.8}>{lines}</g>
      <g fill={color} fillOpacity={0.6}>
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={1.8} />
        ))}
      </g>
    </svg>
  );
};

const CodeColumns: React.FC<{ f: number; p: GlitchPalette; u: number }> = ({ f, p, u }) => (
  <>
    {columns.map((c, i) => {
      // Scroll exactly laps*L lines per loop, so frame 600 == frame 0.
      const off = phase(f) * c.L * c.laps;
      const base = Math.floor(off);
      const frac = off - base;
      const rows = Array.from({ length: VISIBLE }, (_, k) => {
        const idx = c.up ? base + k : -base + k;
        return c.lines[((idx % c.L) + c.L) % c.L];
      });
      const y = (c.up ? -frac : frac - 1) * LINE_H;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: c.x * u,
            top: y * u,
            width: COL_W * u,
            fontFamily: MONO,
            fontSize: c.size * u,
            lineHeight: `${LINE_H * u}px`,
            color: p.code[c.color],
            opacity: c.opacity,
            whiteSpace: "pre",
            overflow: "hidden",
            fontVariantLigatures: "none",
          }}
        >
          {rows.map((r, k) => (
            <div key={k}>{r}</div>
          ))}
        </div>
      );
    })}
  </>
);

const NoisePatches: React.FC<{ f: number; u: number }> = ({ f, u }) => (
  <>
    {PATCHES.map((q, i) => {
      const win = Math.floor(f / 6); // patch content shifts every 6 frames
      const on = hash01(Math.floor(f / 30), q.salt) < 0.55; // visibility windows of 30 frames (20 per loop)
      if (!on) return null;
      const ox = Math.floor(hash01(win, q.salt + 1) * 64) * q.cell * u;
      const oy = Math.floor(hash01(win, q.salt + 2) * 64) * q.cell * u;
      const dx = (hash01(win, q.salt + 3) - 0.5) * 40 * u;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: q.x * u + dx,
            top: q.y * u,
            width: q.w * u,
            height: q.h * u,
            backgroundImage: `url(${staticFile("noise/colornoise.png")})`,
            backgroundSize: `${64 * q.cell * u}px ${64 * q.cell * u}px`,
            backgroundPosition: `${-ox}px ${-oy}px`,
            imageRendering: "pixelated",
            opacity: 0.16,
            mixBlendMode: "screen",
          }}
        />
      );
    })}
  </>
);

// Word box in the 1920x1080 overlay space.
const WORD_CY = 540;
const fitFont = (text: string) => {
  // Inter Black caps average ~0.74em advance; target ~62% (short) to 82% (long) width.
  const target = Math.min(1920 * 0.82, 1920 * 0.62 + (text.length - 7) * 1920 * 0.035);
  return Math.min(300, target / (text.length * 0.74));
};

const Word: React.FC<{ text: string; p: GlitchPalette; f: number }> = ({ text, p, f }) => {
  const fs = fitFont(text);
  const top = WORD_CY - fs * 0.62;
  const boxH = fs * 1.24;
  const e = eventAt(f);
  const glyph = (fill: string, dx = 0, dy = 0, extra: React.SVGProps<SVGTextElement> = {}) => (
    <text
      x={960 + dx}
      y={WORD_CY + fs * 0.36 + dy}
      textAnchor="middle"
      fontFamily={INTER}
      fontWeight={900}
      fontSize={fs}
      letterSpacing={fs * 0.02}
      fill={fill}
      {...extra}
    >
      {text}
    </text>
  );
  if (!e) {
    return (
      <g filter="url(#wordGlow)">
        {glyph(p.word)}
      </g>
    );
  }
  const W = 1920;
  return (
    <g filter="url(#wordGlow)">
      <defs>
        {e.bands.map((b, i) => (
          <clipPath key={i} id={`band${i}`}>
            <rect x={-200} y={top + b.y0 * boxH} width={W + 400} height={(b.y1 - b.y0) * boxH + 0.5} />
          </clipPath>
        ))}
      </defs>
      {e.bands.map((b, i) => {
        if (b.hide) return null;
        const dx = b.dx * W * 0.25;
        const s = e.split * W;
        return (
          <g key={i} clipPath={`url(#band${i})`}>
            {s > 0 ? (
              <g style={{ mixBlendMode: "screen" }}>
                {glyph("#00d0ff", dx + s, e.splitY * 1080, { opacity: 0.85 })}
                {glyph("#28ff4a", dx - s * 0.4, -e.splitY * 1080, { opacity: 0.55 })}
                {glyph("#ff0820", dx - s, 0)}
              </g>
            ) : (
              glyph(p.word, dx)
            )}
          </g>
        );
      })}
    </g>
  );
};

export const GlitchWord: React.FC<{ text: string; palette: GlitchPalette }> = ({ text, palette: p }) => {
  const f = useLoopFrame();
  const { u, width, height } = useUnits();
  return (
    <AbsoluteFill style={{ background: p.bg, overflow: "hidden" }}>
      <CodeColumns f={f} p={p} u={u} />
      <Plexus f={f} color={p.plexus} />
      <NoisePatches f={f} u={u} />
      {/* Dark centre panel so the word reads cleanly over the busy layers */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 52% 30% at 50% 50%, rgba(4,5,10,0.78) 0%, rgba(4,5,10,0.35) 60%, rgba(4,5,10,0) 100%)" }} />
      <svg viewBox="0 0 1920 1080" width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <GlowFilter id="wordGlow" base={2} gain={0.9} weights={[0.9, 0.55, 0.35]} />
        </defs>
        <Word text={text} p={p} f={f} />
      </svg>
      {/* Scanlines */}
      <AbsoluteFill style={{ backgroundImage: `repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) ${u}px, rgba(0,0,0,0) ${u}px, rgba(0,0,0,0) ${3 * u}px)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 80% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)" }} />
      <Grain opacity={0.02} salt={5} />
    </AbsoluteFill>
  );
};
