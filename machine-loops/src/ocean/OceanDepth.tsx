// Ocean-depth infographic: a submarine dives through the five ocean zones
// between a feet scale and a metre scale.
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { INTER, loadInter } from "../lib/fonts";
import { TAU, mulberry32 } from "../lib/random";
import { createBackground } from "./background";
import { DIVE_END, ROW, ROW0, TICKS, depthToY, diveDepth, metresToFeet, oceanText, pressureMPa } from "./depth";

export type OceanDepthProps = { labels: boolean };

const RED = "#E3141B";
const SUB_X = 1040;
const LINE_DEPTHS = [200, 1000, 4000, 6000];

// --- seeded particles (generated once) -----------------------------------------
const rnd = mulberry32(20250611);
type Flake = { x: number; y: number; r: number; a: number; vy: number; sway: number; ph: number; soft: boolean };
const SNOW: Flake[] = Array.from({ length: 560 }, () => {
  const k = rnd();
  const big = k > 0.9;
  const mid = k > 0.75 && !big;
  return {
    x: rnd() * 1920,
    y: rnd() * 1140 - 30,
    r: big ? 6 + rnd() * 9 : mid ? 2.6 + rnd() * 2.2 : 1.0 + rnd() * 1.5,
    a: big ? 0.55 + rnd() * 0.4 : mid ? 0.25 + rnd() * 0.3 : 0.35 + rnd() * 0.5,
    vy: 0.12 + rnd() * 0.35,
    sway: 2 + rnd() * 8,
    ph: rnd() * TAU,
    soft: big || mid,
  };
});
type Bubble = { birth: number; r: number; vy: number; vx: number; ph: number; dx: number; dy: number };
const BUBBLES: Bubble[] = Array.from({ length: 60 }, (_, i) => ({
  birth: i * 7 + Math.floor(rnd() * 5),
  r: 2.5 + rnd() * 5,
  vy: 0.9 + rnd() * 1.1,
  vx: 0.25 + rnd() * 0.5,
  ph: rnd() * TAU,
  dx: rnd() * 14,
  dy: (rnd() - 0.5) * 14,
}));

// --- submarine -------------------------------------------------------------------
const subY = (f: number) => depthToY(diveDepth(f)) + 5 * Math.sin((TAU * f) / 50);
const subPitch = (f: number) => {
  const v = depthToY(diveDepth(f + 1)) - depthToY(diveDepth(f - 1));
  return -Math.min(7, v * 1.6); // degrees; nose (left) dips while descending
};

const Submarine: React.FC<{ frame: number }> = ({ frame }) => {
  const spin = Math.sin((TAU * frame) / 6);
  return (
    <g>
      {/* fins (behind hull) */}
      <path d="M92 -30 L114 -60 L128 -58 L122 -26 Z" fill="#FFFFFF" />
      <path d="M92 30 L114 60 L128 58 L122 26 Z" fill="#FFFFFF" />
      {/* conning tower and periscope */}
      <path d="M-28 -36 L-22 -70 Q-20 -76 -12 -76 L34 -76 Q42 -76 44 -68 L50 -36 Z" fill="#FFFFFF" />
      <path d="M14 -76 L14 -100 L0 -100" stroke="#FFFFFF" strokeWidth={6} fill="none" strokeLinecap="round" />
      {/* hull */}
      <path d="M-150 2 C-150 -30 -118 -44 -70 -44 L76 -40 C108 -38 126 -20 130 0 C126 20 108 38 76 40 L-70 44 C-118 44 -150 34 -150 2 Z" fill="#FFFFFF" />
      {/* details */}
      <path d="M60 -40 C66 -20 66 20 60 40" stroke="#B9C8D4" strokeWidth={3} fill="none" />
      <path d="M-120 -24 L40 -30" stroke="#D5DFE7" strokeWidth={3} fill="none" />
      <path d="M-22 -60 L42 -60" stroke="#B9C8D4" strokeWidth={2.5} />
      {[-84, -4].map((x) => (
        <g key={x}>
          <circle cx={x} cy={-2} r={15} fill="#B9C8D4" />
          <circle cx={x} cy={-2} r={11} fill="#0D2638" />
          <circle cx={x - 4} cy={-6} r={3} fill="#5D86A3" />
        </g>
      ))}
      {/* bow cap seam and keel stripe */}
      <path d="M-118 -36 C-128 -16 -128 18 -118 38" stroke="#B9C8D4" strokeWidth={3} fill="none" />
      <path d="M-100 34 L90 30" stroke="#D5DFE7" strokeWidth={3} fill="none" />
      {/* propeller */}
      <rect x={128} y={-6} width={14} height={12} rx={3} fill="#FFFFFF" />
      <ellipse cx={148} cy={-14} rx={5} ry={12 * Math.abs(spin) + 3} fill="#FFFFFF" />
      <ellipse cx={148} cy={14} rx={5} ry={12 * Math.abs(Math.cos((TAU * frame) / 6)) + 3} fill="#FFFFFF" />
      <circle cx={146} cy={0} r={6} fill="#FFFFFF" />
    </g>
  );
};

const zoneMid = (top: number, bottom: number) => (depthToY(top) + depthToY(bottom)) / 2;

export const OceanDepth: React.FC<OceanDepthProps> = ({ labels }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  useMemo(() => loadInter(), []);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const drawBg = useRef<((t: number) => void) | null>(null);
  const dpr = typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  const cw = Math.round(width * dpr);
  const ch = Math.round(height * dpr);

  useLayoutEffect(() => {
    if (!drawBg.current) drawBg.current = createBackground(bgRef.current!);
    drawBg.current(frame / 30);
    // marine snow
    const ctx = fxRef.current!.getContext("2d")!;
    const s = cw / 1920;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    for (const p of SNOW) {
      const y = ((((p.y + p.vy * frame + 30) % 1140) + 1140) % 1140) - 30;
      const x = p.x + p.sway * Math.sin((TAU * frame) / 240 + p.ph);
      const lit = Math.exp(-Math.pow((x - 960) / 380, 2)) * Math.exp(-y / 420) * 0.95 + 0.05;
      const a = p.a * lit;
      if (p.soft) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, p.r);
        g.addColorStop(0, `rgba(120,215,240,${a})`);
        g.addColorStop(0.55, `rgba(110,205,235,${a * 0.6})`);
        g.addColorStop(1, "rgba(110,205,235,0)");
        ctx.fillStyle = g;
      } else ctx.fillStyle = `rgba(190,228,245,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, TAU);
      ctx.fill();
    }
    // bubbles from the propeller (emitted at the prop's position at birth)
    for (const b of BUBBLES) {
      const age = frame - b.birth;
      if (age < 0 || age > 75) continue;
      const moving = b.birth < DIVE_END + 10;
      if (!moving && b.birth % 3 !== 0) continue;
      const py = subY(b.birth);
      const x = SUB_X + 150 + b.dx + b.vx * age + 3 * Math.sin(age / 6 + b.ph);
      const y = py + b.dy - b.vy * age;
      const a = Math.min(1, age / 6) * (1 - age / 75) * 0.75;
      ctx.strokeStyle = `rgba(225,240,250,${a})`;
      ctx.fillStyle = `rgba(225,240,250,${a * 0.25})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, b.r * (1 + age / 150), 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }, [frame, cw, ch]);

  const depth = diveDepth(frame);
  const sy = subY(frame);
  const pressure = Math.round(pressureMPa(depth));
  const tag = `${pressure} ${oceanText.pressureUnit}`;
  const tagW = 34 + tag.length * 15.5;
  const text = { fontFamily: INTER, fill: "#FFFFFF" } as const;

  return (
    <AbsoluteFill style={{ backgroundColor: "#02060A" }}>
      <canvas ref={bgRef} width={cw} height={ch} style={{ position: "absolute", width, height }} />
      <canvas ref={fxRef} width={cw} height={ch} style={{ position: "absolute", width, height }} />
      <svg viewBox="0 0 1920 1080" width={width} height={height} style={{ position: "absolute" }}>
        {LINE_DEPTHS.map((d) => (
          <line key={d} x1={205} x2={1715} y1={depthToY(d)} y2={depthToY(d)} stroke="rgba(255,255,255,0.72)" strokeWidth={2} strokeDasharray="9 7" />
        ))}
        {/* badges */}
        {[
          [135, oceanText.badgeFeet],
          [1785, oceanText.badgeMetres],
        ].map(([x, label]) => (
          <g key={String(x)}>
            <circle cx={Number(x)} cy={70} r={34} fill={RED} />
            <text x={Number(x)} y={70} {...text} fontWeight={600} fontSize={label === "M" ? 30 : 26} textAnchor="middle" dominantBaseline="central">
              {label}
            </text>
          </g>
        ))}
        {/* scales */}
        {TICKS.map((m, i) => (
          <g key={m}>
            <text x={135} y={ROW0 + i * ROW} {...text} fontSize={26} textAnchor="middle" dominantBaseline="central">
              {metresToFeet(m)}
            </text>
            <text x={1785} y={ROW0 + i * ROW} {...text} fontSize={26} textAnchor="middle" dominantBaseline="central">
              {m}
            </text>
          </g>
        ))}
        {labels &&
          oceanText.zones.map((z) => (
            <text key={z.name} x={525} y={zoneMid(z.topM, z.bottomM)} {...text} fontSize={27} textAnchor="middle" dominantBaseline="central" opacity={0.95}>
              {z.name}
            </text>
          ))}
        <g transform={`translate(${SUB_X} ${sy}) rotate(${subPitch(frame)})`}>
          <Submarine frame={frame} />
        </g>
        {labels && (
          <g transform={`translate(${SUB_X + 172} ${sy - 6})`}>
            <rect x={0} y={-20} width={tagW} height={40} rx={5} fill="#FFFFFF" />
            <text x={tagW / 2} y={1} {...text} fill={RED} fontWeight={700} fontSize={25} textAnchor="middle" dominantBaseline="central">
              {tag}
            </text>
          </g>
        )}
      </svg>
    </AbsoluteFill>
  );
};
