import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useLand, LandData } from "../../lib/geo";
import { useFonts, MONO } from "../../lib/fonts";
import { GrainLayer } from "../../lib/GrainLayer";
import { makeRand } from "../../lib/random";
import { TAU, mod, phase, wave } from "../../lib/loop";
import type { HologramPalette } from "../../versions";

const LOOP = 600;
const MAP_W = 2500;
const LAT_TOP = 84;
const LAT_BOTTOM = -57;
const MAP_H = Math.round((MAP_W * (LAT_TOP - LAT_BOTTOM)) / 360);

// ---------- map path (pure function of the land data) ----------

const buildPath = (land: LandData) => {
  const parts: string[] = [];
  for (const poly of land.polygons) {
    for (const ring of poly) {
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (const [lon, lat] of ring) {
        minX = Math.min(minX, lon); maxX = Math.max(maxX, lon);
        minY = Math.min(minY, lat); maxY = Math.max(maxY, lat);
      }
      if (maxX - minX < 0.6 && maxY - minY < 0.6) continue; // tiny islets
      let d = "";
      let px = 1e9, py = 1e9;
      ring.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * MAP_W;
        const y = ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * MAP_H;
        if (i > 0 && i < ring.length - 1 && Math.hypot(x - px, y - py) < 2.2) return;
        d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
        px = x; py = y;
      });
      parts.push(d + "Z");
    }
  }
  return parts.join("");
};

// ---------- seeded scenery ----------

const rand = makeRand(1033);

const STREAKS = Array.from({ length: 16 }, (_, i) => ({
  y: rand.range(-200, 2300),
  len: rand.range(900, 2600),
  thick: rand.next() < 0.3 ? rand.range(40, 140) : rand.range(2, 5),
  cycles: rand.int(1, 4),
  ph: rand.next(),
  alpha: rand.range(0.25, 0.8),
  alt: rand.next() < 0.3,
  front: i % 3 === 0,
}));

const BOKEH = Array.from({ length: 34 }, () => ({
  x: rand.range(0, 3840),
  y: rand.range(0, 2160),
  r: rand.range(6, 38),
  a: rand.range(0.08, 0.35),
  ax: rand.range(10, 60),
  ay: rand.range(10, 40),
  c: rand.int(1, 3),
  ph: rand.next(),
}));

const HEX = "0123456789ABCDEF";
const CODE_COLS = Array.from({ length: 9 }, (_, i) => ({
  x: 60 + i * 430 + rand.range(-40, 40),
  size: rand.range(18, 30),
  alpha: rand.range(0.12, 0.3),
  blur: rand.range(1.2, 3.5),
  lines: Array.from({ length: 40 }, () => {
    const k = rand.int(0, 4);
    if (k === 0) return Array.from({ length: rand.int(6, 14) }, () => HEX[rand.int(0, 16)]).join("");
    if (k === 1) return `${rand.range(0, 999).toFixed(2)}  ${rand.range(0, 99).toFixed(3)}`;
    if (k === 2) return `0x${Array.from({ length: 8 }, () => HEX[rand.int(0, 16)]).join("")} ${rand.int(0, 9999)}`;
    return Array.from({ length: rand.int(3, 9) }, () => (rand.next() < 0.5 ? "1" : "0")).join(" ");
  }),
}));
const CODE_LINE_H = 1.6;

// ---------- pieces ----------

const CodeBackground: React.FC<{ frame: number; color: string }> = ({ frame, color }) => (
  <>
    {CODE_COLS.map((c, i) => {
      const blockH = c.lines.length * c.size * CODE_LINE_H;
      // scroll exactly one block per loop
      const y = -blockH * phase(frame, LOOP, 1);
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: c.x,
            top: y,
            fontFamily: MONO,
            fontSize: c.size,
            lineHeight: CODE_LINE_H,
            color,
            opacity: c.alpha,
            filter: `blur(${c.blur}px)`,
            whiteSpace: "pre",
          }}
        >
          {[...c.lines, ...c.lines, ...c.lines].map((l, j) => (
            <div key={j}>{l}</div>
          ))}
        </div>
      );
    })}
  </>
);

const Streak: React.FC<{ s: (typeof STREAKS)[number]; frame: number; pal: HologramPalette }> = ({ s, frame, pal }) => {
  const p = phase(frame, LOOP, s.cycles) + s.ph;
  const span = 3840 + s.len + 800;
  const x = mod(p, 1) * span - s.len - 400;
  const color = s.alt ? pal.streakAlt : pal.streak;
  const band = s.thick > 20;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: s.y,
        width: s.len,
        height: s.thick,
        transform: "rotate(-11deg)",
        transformOrigin: "0 50%",
        background: `linear-gradient(90deg, transparent, ${color} 55%, ${color} 70%, transparent)`,
        opacity: s.alpha * (band ? 0.4 : 1),
        filter: band ? "blur(30px)" : "blur(1px)",
        boxShadow: band ? undefined : `0 0 14px ${color}`,
        mixBlendMode: "plus-lighter",
      }}
    />
  );
};

const MapLayer: React.FC<{ d: string; frame: number; pal: HologramPalette }> = ({ d, frame, pal }) => {
  // light sweep: every 150 frames a band crosses the map in 60 frames
  const sp = mod(frame, 150) / 60;
  const sweepX = -0.3 + 1.6 * Math.min(1, sp);
  const sweepOn = sp < 1 ? Math.sin(Math.PI * sp) : 0;
  const svg = (children: React.ReactNode, style?: React.CSSProperties) => (
    <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ position: "absolute", inset: 0, overflow: "visible", ...style }}>
      {children}
    </svg>
  );
  return (
    <>
      {/* soft outer glow */}
      {svg(<path d={d} fill={pal.map} stroke={pal.map} strokeWidth={30} />, { filter: "blur(46px)", opacity: 0.42 })}
      {/* body */}
      {svg(
        <>
          <defs>
            <linearGradient id="holoFill" x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0" stopColor={pal.map} stopOpacity={0.55} />
              <stop offset="1" stopColor={pal.map} stopOpacity={0.26} />
            </linearGradient>
            <pattern id="holoTex" width="96" height="96" patternUnits="userSpaceOnUse">
              <path d="M0 0.5H96M0 24.5H96M0 48.5H96M0 72.5H96" stroke={pal.outline} strokeWidth="0.8" opacity="0.35" />
              <path d="M10 10H40V34H64M70 60V84H30M6 56H22V76" fill="none" stroke={pal.outline} strokeWidth="1.6" opacity="0.7" />
              <circle cx="64" cy="34" r="3.2" fill="none" stroke={pal.outline} strokeWidth="1.4" opacity="0.8" />
              <circle cx="30" cy="84" r="2.6" fill={pal.outline} opacity="0.7" />
              <circle cx="22" cy="76" r="2.6" fill="none" stroke={pal.outline} strokeWidth="1.2" opacity="0.7" />
            </pattern>
            <clipPath id="holoClip">
              <path d={d} />
            </clipPath>
            <linearGradient id="holoSweep" x1="0" y1="0" x2="1" y2="0.35">
              <stop offset={Math.max(0, sweepX - 0.12)} stopColor="#fff" stopOpacity={0} />
              <stop offset={Math.min(1, Math.max(0, sweepX))} stopColor="#fff" stopOpacity={0.55 * sweepOn} />
              <stop offset={Math.min(1, sweepX + 0.12)} stopColor="#fff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={d} fill="url(#holoFill)" />
          <g clipPath="url(#holoClip)">
            <rect width={MAP_W} height={MAP_H} fill="url(#holoTex)" opacity={0.45} />
            <rect width={MAP_W} height={MAP_H} fill="url(#holoSweep)" />
          </g>
        </>,
      )}
      {/* outline glow + bright outline */}
      {svg(<path d={d} fill="none" stroke={pal.outline} strokeWidth={7} strokeLinejoin="round" />, { filter: "blur(7px)", opacity: 0.8 })}
      {svg(<path d={d} fill="none" stroke={pal.outline} strokeWidth={2.4} strokeLinejoin="round" />)}
    </>
  );
};

export const HologramMap: React.FC<{ palette: HologramPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const land = useLand();
  const fonts = useFonts();
  const d = useMemo(() => (land ? buildPath(land) : ""), [land]);
  if (!land || !fonts) return <AbsoluteFill style={{ background: palette.bgDeep }} />;

  const rx = 15 + 2.2 * wave(frame, LOOP, 1);
  const ry = -10 + 3.0 * wave(frame, LOOP, 1, 0.25);
  const rz = 0.6 * wave(frame, LOOP, 2, 0.1);
  const lift = 14 * wave(frame, LOOP, 2, 0.6);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 75% 70% at 52% 45%, ${palette.bg} 0%, ${palette.bgDeep} 100%)`,
        overflow: "hidden",
      }}
    >
      {/* key={frame}: rebuild the DOM every frame so Chromium rasterises it
          from scratch (no tiles reused from earlier frames). The grain canvases
          stay outside this subtree. */}
      <AbsoluteFill key={frame}>
      <CodeBackground frame={frame} color={palette.text} />
      {BOKEH.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: b.x + b.ax * Math.sin(TAU * ((frame * b.c) / LOOP + b.ph)),
            top: b.y + b.ay * Math.cos(TAU * ((frame * b.c) / LOOP + b.ph)),
            width: b.r * 2,
            height: b.r * 2,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${palette.map} 0%, transparent 70%)`,
            opacity: b.a,
            mixBlendMode: "plus-lighter",
          }}
        />
      ))}
      {STREAKS.filter((s) => !s.front).map((s, i) => (
        <Streak key={i} s={s} frame={frame} pal={palette} />
      ))}
      <div style={{ position: "absolute", inset: 0, perspective: 3400 }}>
        <div
          style={{
            position: "absolute",
            left: (3840 - MAP_W) / 2,
            top: (2160 - MAP_H) / 2 - 40 + lift,
            width: MAP_W,
            height: MAP_H,
            transform: `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
            transformStyle: "flat",
            mixBlendMode: "plus-lighter",
          }}
        >
          <MapLayer d={d} frame={frame} pal={palette} />
        </div>
      </div>
      {STREAKS.filter((s) => s.front).map((s, i) => (
        <Streak key={i} s={s} frame={frame} pal={palette} />
      ))}
      {/* corner vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 85% 80% at 50% 48%, transparent 55%, ${palette.bgDeep} 100%)`,
          opacity: 0.7,
        }}
      />
      </AbsoluteFill>
      <GrainLayer grain={0.02} loop={LOOP} />
    </AbsoluteFill>
  );
};
