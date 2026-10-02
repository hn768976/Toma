import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Frame } from "../lib/Frame";
import { GlowFilter } from "../lib/Glow";
import { Grain } from "../lib/Grain";
import { DESIGN_H, DESIGN_W, OPENER_FRAMES, TAU } from "../lib/constants";
import { FONT_TITLE } from "../lib/fonts";
import { int, mulberry32, range } from "../lib/random";
import { BreakingNewsProps } from "./theme";

/*
 * Look 2 — Breaking News Opener. 450 frames, NOT a loop.
 *   0–20   background only (already moving)
 *   20–50  light streak sweeps the title zone; words slide in behind it
 *   50–70  red rule draws out from the centre, chevrons appear one by one
 *   70–450 hold; background keeps animating
 */

const rng = mulberry32(1399918677);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const easeOut = Easing.out(Easing.cubic);

// ---------- layout (design px, 1920x1080) ----------
const DIGIT_BAR = { y: 118, x0: 220, x1: 1700 };
const ZONE = { y0: 215, y1: 750 }; // title zone
const WAVE_Y = 498;
const TITLE = { cx: 950, topBaseline: 545, bottomBaseline: 715, size: 138, ruleY: 572, ruleHalf: 560 };
const GAUGE_Y = 905;
const GAUGE_R = 104;
const GAUGE_X = [400, 776, 1154, 1530];
const LEVEL_X = [214, 590, 965, 1342, 1718];

// ---------- rolling digits (top tier) ----------
type Roll = { start: number; end: number; from: number; to: number; spins: number };
const SLOTS = 9;
const SLOT_X0 = 560;
const SLOT_DX = 100;
const SLOT_H = 80;
const DIGIT_SIZE = 62;

const slotRolls: Roll[][] = Array.from({ length: SLOTS }, () => {
  const rolls: Roll[] = [];
  let f = -int(rng, 0, 30); // some slots are already rolling at frame 0
  let value = int(rng, 0, 9);
  while (f < OPENER_FRAMES) {
    const len = int(rng, 14, 42);
    const to = int(rng, 0, 9);
    rolls.push({ start: f, end: f + len, from: value, to, spins: int(rng, 1, 3) });
    value = to;
    f += len + int(rng, 35, 120); // hold time
  }
  return rolls;
});

// Returns the continuous drum position (in digits) and its speed (digits/frame).
const drum = (rolls: Roll[], frame: number) => {
  let settled = rolls[0].from;
  for (const r of rolls) {
    if (frame < r.start) break;
    const dist = r.spins * 10 + ((r.to - r.from + 10) % 10);
    if (frame < r.end) {
      const u = (frame - r.start) / (r.end - r.start);
      const pos = r.from + dist * easeOut(u);
      const du = 1 / (r.end - r.start);
      const speed = dist * (easeOut(Math.min(1, u + du)) - easeOut(u));
      return { pos, speed };
    }
    settled = r.to;
  }
  return { pos: settled, speed: 0 };
};

// ---------- dense waveform (middle tier) ----------
const WAVE_N = 6000;
const makeDense = (spread: number) => {
  const out = new Float32Array(WAVE_N);
  for (let i = 0; i < WAVE_N; i++) {
    const r = rng() * 2 - 1;
    // heavy-tailed: mostly small, sometimes very tall
    out[i] = Math.sign(r) * Math.pow(Math.abs(r), 2.6) * spread + (rng() * 2 - 1) * 0.12;
  }
  return out;
};
const DENSE_A = makeDense(1);
const DENSE_B = makeDense(0.85);
const SWELL_PHASE = rng() * TAU;
const FLICKER = Array.from({ length: OPENER_FRAMES }, () => range(rng, 0.7, 1));
const LINE_YS = [262, 300, 388, 410, 610, 668, 700, 728];
const LINE_PH = LINE_YS.map(() => rng() * TAU);

const densePath = (data: Float32Array, offset: number, amp: number, gain: number, swellAmp: number, frame: number) => {
  const count = 760;
  const dx = DESIGN_W / (count - 1);
  let d = "";
  for (let j = 0; j < count; j++) {
    const v = data[(offset + j) % WAVE_N];
    const x = j * dx;
    // slow travelling swell under the spikes
    const swell = swellAmp * Math.sin((j / count) * TAU * 1.4 - frame * 0.05 + SWELL_PHASE);
    // spikes are taller in the middle of the screen
    const mid = 0.55 + 0.45 * Math.sin((j / (count - 1)) * Math.PI);
    d += (j ? "L" : "M") + x.toFixed(1) + " " + (WAVE_Y + swell - v * amp * gain * mid).toFixed(1);
  }
  return d;
};

// ---------- gauges / level bars ----------
const LEVEL_PHASES = LEVEL_X.map(() => [rng() * TAU, rng() * TAU, range(rng, 0.05, 0.11), range(rng, 0.15, 0.27)]);
const BLIPS = Array.from({ length: 4 }, () => ({ a: rng() * TAU, r: range(rng, 0.3, 0.85) }));

const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
  const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p0[0]} ${p0[1]} A${r} ${r} 0 ${large} 1 ${p1[0]} ${p1[1]}`;
};

const spiralPath = (cx: number, cy: number, r: number, turns: number, rot: number) => {
  let d = "";
  const steps = 220;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const a = rot + u * turns * TAU;
    const rr = r * (0.08 + 0.92 * u);
    d += (i ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(1) + " " + (cy + rr * Math.sin(a)).toFixed(1);
  }
  return d;
};

const Gauges: React.FC<{ frame: number; p: BreakingNewsProps }> = ({ frame, p }) => {
  const [g1, g2, g3, g4] = GAUGE_X;
  const sweep = (frame * 3.6 * Math.PI) / 180; // radar: 3.6 deg per frame
  const wedges = Array.from({ length: 14 }, (_, i) => i);
  const needle = -Math.PI / 2 + 0.9 * Math.sin(frame * 0.021) + 0.35 * Math.sin(frame * 0.067 + 1.3);
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.12);
  return (
    <g filter="url(#bn-glow-soft)">
      {/* 1: radar with rotating sweep */}
      <circle cx={g1} cy={GAUGE_Y} r={GAUGE_R} fill="url(#bn-disc)" />
      {wedges.map((i) => {
        const a1 = sweep - i * 0.06;
        const a0 = a1 - 0.07;
        return (
          <path
            key={i}
            d={`M${g1} ${GAUGE_Y} L${g1 + GAUGE_R * 0.96 * Math.cos(a0)} ${GAUGE_Y + GAUGE_R * 0.96 * Math.sin(a0)} A${GAUGE_R * 0.96} ${GAUGE_R * 0.96} 0 0 1 ${g1 + GAUGE_R * 0.96 * Math.cos(a1)} ${GAUGE_Y + GAUGE_R * 0.96 * Math.sin(a1)} Z`}
            fill={p.gaugeColor}
            opacity={0.32 * (1 - i / wedges.length)}
          />
        );
      })}
      <line x1={g1} y1={GAUGE_Y} x2={g1 + GAUGE_R * 0.96 * Math.cos(sweep)} y2={GAUGE_Y + GAUGE_R * 0.96 * Math.sin(sweep)} stroke={p.gaugeColor} strokeWidth={2.5} />
      {BLIPS.map((b, i) => {
        const since = (((sweep - b.a) % TAU) + TAU) % TAU;
        return <circle key={i} cx={g1 + b.r * GAUGE_R * Math.cos(b.a)} cy={GAUGE_Y + b.r * GAUGE_R * Math.sin(b.a)} r={4} fill={p.gaugeColor} opacity={Math.exp(-since * 1.6)} />;
      })}
      <circle cx={g1} cy={GAUGE_Y} r={GAUGE_R} fill="none" stroke={p.gaugeColor} strokeWidth={2.5} opacity={0.75} />
      <path d={arc(g1, GAUGE_Y, GAUGE_R + 9, -2.6, -1.1)} stroke={p.gaugeColor} strokeWidth={3} fill="none" opacity={0.55} />

      {/* 2: concentric rings, green and orange */}
      <circle cx={g2} cy={GAUGE_Y} r={GAUGE_R} fill="url(#bn-disc)" />
      <circle cx={g2} cy={GAUGE_Y} r={GAUGE_R} fill="none" stroke={p.gaugeColor} strokeWidth={5} />
      <path d={arc(g2, GAUGE_Y, GAUGE_R + 9, frame * 0.04, frame * 0.04 + 2.4)} stroke={p.gaugeAccent} strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d={arc(g2, GAUGE_Y, GAUGE_R + 9, frame * 0.04 + 3.3, frame * 0.04 + 4.6)} stroke={p.accentColor} strokeWidth={6} fill="none" strokeLinecap="round" />
      <circle cx={g2} cy={GAUGE_Y} r={GAUGE_R * 0.66} fill="none" stroke={p.gaugeColor} strokeWidth={2} opacity={0.6} />
      <circle cx={g2} cy={GAUGE_Y} r={GAUGE_R * (0.36 + 0.06 * pulse)} fill={p.gaugeColor} opacity={0.22 + 0.2 * pulse} />
      <circle cx={g2} cy={GAUGE_Y} r={GAUGE_R * 0.2} fill="none" stroke={p.gaugeColor} strokeWidth={3} />

      {/* 3: spiral */}
      <circle cx={g3} cy={GAUGE_Y} r={GAUGE_R} fill="none" stroke={p.gaugeColor} strokeWidth={9} />
      <circle cx={g3} cy={GAUGE_Y} r={GAUGE_R * 0.84} fill="none" stroke={p.gaugeColor} strokeWidth={2} opacity={0.7} />
      <path d={spiralPath(g3, GAUGE_Y, GAUGE_R * 0.74, 4.5, -frame * 0.09)} stroke={p.gaugeColor} strokeWidth={2.2} fill="none" />
      <path d={spiralPath(g3, GAUGE_Y, GAUGE_R * 0.6, 3, frame * 0.05 + 1)} stroke={p.gaugeColor} strokeWidth={1.4} fill="none" opacity={0.5} />

      {/* 4: dim dial */}
      <circle cx={g4} cy={GAUGE_Y} r={GAUGE_R} fill="url(#bn-disc-dim)" />
      <circle cx={g4} cy={GAUGE_Y} r={GAUGE_R} fill="none" stroke={p.gaugeColor} strokeWidth={2} opacity={0.35} />
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i / 36) * TAU;
        const r0 = GAUGE_R * (i % 3 === 0 ? 0.82 : 0.88);
        return <line key={i} x1={g4 + r0 * Math.cos(a)} y1={GAUGE_Y + r0 * Math.sin(a)} x2={g4 + GAUGE_R * 0.94 * Math.cos(a)} y2={GAUGE_Y + GAUGE_R * 0.94 * Math.sin(a)} stroke={p.gaugeColor} strokeWidth={1.5} opacity={0.3} />;
      })}
      <path d={arc(g4, GAUGE_Y, GAUGE_R + 8, -1.5, -0.4)} stroke={p.gaugeColor} strokeWidth={3} fill="none" opacity={0.7} />
      <line x1={g4} y1={GAUGE_Y} x2={g4 + GAUGE_R * 0.8 * Math.cos(needle)} y2={GAUGE_Y + GAUGE_R * 0.8 * Math.sin(needle)} stroke={p.gaugeColor} strokeWidth={2.5} opacity={0.85} />
      <circle cx={g4} cy={GAUGE_Y} r={6} fill={p.gaugeColor} opacity={0.6} />
    </g>
  );
};

const LevelBars: React.FC<{ frame: number; color: string }> = ({ frame, color }) => {
  const rows = 6;
  const bh = 14;
  const gap = 12;
  const top = GAUGE_Y - ((rows * bh + (rows - 1) * gap) / 2);
  return (
    <g>
      {LEVEL_X.map((x, c) => {
        const [ph1, ph2, f1, f2] = LEVEL_PHASES[c];
        const level = 0.5 + 0.3 * Math.sin(frame * f1 + ph1) + 0.2 * Math.sin(frame * f2 + ph2); // 0..1
        const lit = Math.round(level * rows);
        return Array.from({ length: rows }, (_, r) => {
          const on = rows - r <= lit;
          return (
            <rect
              key={`${c}-${r}`}
              x={x - 24}
              y={top + r * (bh + gap)}
              width={48}
              height={bh}
              rx={2}
              fill={color}
              opacity={on ? (rows - r === lit ? 1 : 0.8) : 0.12}
              filter={on ? "url(#bn-glow-soft)" : undefined}
            />
          );
        });
      })}
    </g>
  );
};

// ---------- title ----------
const Chevron: React.FC<{ x: number; y: number; color: string; opacity: number }> = ({ x, y, color, opacity }) => (
  <path d={`M${x} ${y - 30} L${x + 26} ${y} L${x} ${y + 30}`} fill="none" stroke={color} strokeWidth={9} strokeLinejoin="miter" opacity={opacity} />
);

const TitleWord: React.FC<{ text: string; x: number; y: number; anchor: "middle" | "start"; color: string }> = ({ text, x, y, anchor, color }) => {
  const common = { x, y, textAnchor: anchor, fontFamily: FONT_TITLE, fontWeight: 700, fontSize: TITLE.size } as const;
  return (
    <g>
      {/* drop shadow */}
      <text {...common} x={x + 4} y={y + 6} fill="#000" opacity={0.7} filter="url(#bn-soft)">{text}</text>
      {/* bevel: light upper-left edge, dark lower-right edge */}
      <text {...common} x={x - 1.6} y={y - 1.6} fill="#ffffff" opacity={0.9}>{text}</text>
      <text {...common} x={x + 2} y={y + 2} fill="#5d6577">{text}</text>
      <text {...common} fill={color}>{text}</text>
      {/* face shading, darker toward the bottom */}
      <text {...common} fill="url(#bn-face-shade)">{text}</text>
    </g>
  );
};

const Streak: React.FC<{ frame: number; color: string }> = ({ frame, color }) => {
  if (frame < 20 || frame >= 50) return null;
  const u = (frame - 20) / 30;
  const env = Math.pow(Math.sin(Math.PI * u), 0.8);
  const head = interpolate(u, [0, 1], [-0.15 * DESIGN_W, 1.15 * DESIGN_W], { easing: Easing.inOut(Easing.quad) });
  const y = TITLE.ruleY + 8;
  return (
    <g style={{ mixBlendMode: "screen" }} opacity={env}>
      {/* broad orange-red band */}
      <rect x={0} y={y - 130} width={DESIGN_W} height={260} fill="url(#bn-streak-band)" opacity={0.9} />
      {/* trail behind the head */}
      <rect x={head - 1500} y={y - 55} width={1500} height={110} fill="url(#bn-streak-trail)" />
      {/* bright head */}
      <ellipse cx={head} cy={y} rx={760} ry={70} fill="url(#bn-streak-head)" />
      {/* hot white centre line + flare */}
      <rect x={0} y={y - 3} width={DESIGN_W} height={6} fill="#fff" opacity={0.8} filter="url(#bn-soft)" />
      <ellipse cx={head} cy={y} rx={520} ry={12} fill="#fff" filter="url(#bn-soft)" />
      <circle cx={head} cy={y} r={150} fill="url(#bn-flare)" />
      {[-70, -40, 36, 64].map((dy, i) => (
        <rect key={i} x={0} y={y + dy} width={DESIGN_W} height={2.5} fill={color} opacity={0.75} />
      ))}
    </g>
  );
};

export const BreakingNewsOpener: React.FC<BreakingNewsProps> = (p) => {
  const frame = useCurrentFrame();

  // Title animation
  const inT = interpolate(frame, [20, 46], [0, 1], { ...clamp, easing: easeOut });
  const topX = TITLE.cx + interpolate(inT, [0, 1], [-1500, 0]);
  const botX = TITLE.cx - 15 + interpolate(inT, [0, 1], [1500, 0]);
  const wordsOpacity = interpolate(frame, [20, 28], [0, 1], clamp);
  const rule = interpolate(frame, [50, 64], [0, 1], { ...clamp, easing: easeOut });
  const chevrons = [56, 60, 64].map((s) => interpolate(frame, [s, s + 5], [0, 1], clamp));

  // Background motion
  const waveOffset = frame * 9;
  const flicker = FLICKER[Math.min(frame, OPENER_FRAMES - 1)];

  // Grid
  const gridLines: React.ReactNode[] = [];
  for (let x = 0; x <= DESIGN_W; x += 20) gridLines.push(<line key={`v${x}`} x1={x} x2={x} y1={ZONE.y0} y2={ZONE.y1} />);
  for (let y = ZONE.y0; y <= ZONE.y1; y += 20) gridLines.push(<line key={`h${y}`} x1={0} x2={DESIGN_W} y1={y} y2={y} />);

  return (
    <Frame background="#000000">
      <defs>
        <GlowFilter id="bn-glow" base={1.4} strength={[1, 0.6, 0.35]} region={{ x: -50, y: 0, width: DESIGN_W + 100, height: DESIGN_H }} />
        <GlowFilter id="bn-glow-soft" base={1.2} strength={[0.8, 0.45, 0.22]} />
        <filter id="bn-soft" x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation={3} />
        </filter>
        <filter id="bn-dash-blur" x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation="3 1.5" />
        </filter>
        <linearGradient id="bn-digit-bar" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={p.accentColor} stopOpacity={0} />
          <stop offset="0.15" stopColor={p.accentColor} stopOpacity={0.32} />
          <stop offset="0.5" stopColor={p.accentColor} stopOpacity={0.4} />
          <stop offset="0.85" stopColor={p.accentColor} stopOpacity={0.32} />
          <stop offset="1" stopColor={p.accentColor} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="bn-digit-bar-v" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity={0.85} />
          <stop offset="0.5" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.85} />
        </linearGradient>
        <linearGradient id="bn-zone" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity={1} />
          <stop offset="0.12" stopColor="#000" stopOpacity={0} />
          <stop offset="0.88" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={1} />
        </linearGradient>
        <linearGradient id="bn-face-shade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0.35" stopColor="#0b1530" stopOpacity={0} />
          <stop offset="1" stopColor="#0b1530" stopOpacity={0.38} />
        </linearGradient>
        <radialGradient id="bn-disc">
          <stop offset="0" stopColor={p.gaugeColor} stopOpacity={0.3} />
          <stop offset="0.7" stopColor={p.gaugeColor} stopOpacity={0.12} />
          <stop offset="1" stopColor={p.gaugeColor} stopOpacity={0.04} />
        </radialGradient>
        <radialGradient id="bn-disc-dim">
          <stop offset="0" stopColor={p.gaugeColor} stopOpacity={0.12} />
          <stop offset="1" stopColor={p.gaugeColor} stopOpacity={0.03} />
        </radialGradient>
        <linearGradient id="bn-streak-band" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={p.streakColor} stopOpacity={0} />
          <stop offset="0.5" stopColor={p.streakColor} stopOpacity={0.8} />
          <stop offset="1" stopColor={p.streakColor} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="bn-streak-trail" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={p.streakColor} stopOpacity={0} />
          <stop offset="1" stopColor="#ffb040" stopOpacity={0.95} />
        </linearGradient>
        <radialGradient id="bn-streak-head">
          <stop offset="0" stopColor="#ffffff" stopOpacity={1} />
          <stop offset="0.25" stopColor="#ffc36a" stopOpacity={0.95} />
          <stop offset="0.6" stopColor={p.streakColor} stopOpacity={0.6} />
          <stop offset="1" stopColor={p.streakColor} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="bn-title-shade">
          <stop offset="0" stopColor="#000" stopOpacity={0.45} />
          <stop offset="1" stopColor="#000" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="bn-flare">
          <stop offset="0" stopColor="#ffffff" stopOpacity={1} />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity={0.7} />
          <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
        <clipPath id="bn-slot-clip">
          {Array.from({ length: SLOTS }, (_, i) => (
            <rect key={i} x={SLOT_X0 + i * SLOT_DX - 40} y={DIGIT_BAR.y - SLOT_H / 2} width={80} height={SLOT_H} />
          ))}
        </clipPath>
      </defs>

      {/* ---- top tier: red-tinted bar with rolling digits ---- */}
      <rect x={DIGIT_BAR.x0} y={DIGIT_BAR.y - 32} width={DIGIT_BAR.x1 - DIGIT_BAR.x0} height={64} fill="url(#bn-digit-bar)" />
      <rect x={DIGIT_BAR.x0} y={DIGIT_BAR.y - 32} width={DIGIT_BAR.x1 - DIGIT_BAR.x0} height={64} fill="url(#bn-digit-bar-v)" />
      <g filter="url(#bn-dash-blur)" fill="#d8a0a0" opacity={0.35}>
        {Array.from({ length: 13 }, (_, i) => {
          const x = DIGIT_BAR.x0 + 60 + i * 110;
          return <rect key={i} x={x} y={DIGIT_BAR.y - 3} width={50} height={6} />;
        })}
      </g>
      <g clipPath="url(#bn-slot-clip)" fontFamily={FONT_TITLE} fontWeight={700} fontSize={DIGIT_SIZE} textAnchor="middle">
        {slotRolls.map((rolls, i) => {
          const { pos, speed } = drum(rolls, frame);
          const base = Math.floor(pos);
          const frac = pos - base;
          const x = SLOT_X0 + i * SLOT_DX;
          const y = DIGIT_BAR.y + DIGIT_SIZE * 0.36;
          // vertical smear grows with drum speed
          const smear = Math.min(speed * SLOT_H * 0.22, 9);
          return (
            <g key={i} filter={smear > 0.3 ? `url(#bn-roll-${i})` : "url(#bn-glow-soft)"}>
              {smear > 0.3 ? (
                <filter id={`bn-roll-${i}`} x="-50%" y="-100%" width="200%" height="300%">
                  <feGaussianBlur stdDeviation={`1.2 ${smear.toFixed(2)}`} />
                </filter>
              ) : null}
              {[-1, 0, 1].map((k) => (
                <text key={k} x={x} y={y - (frac - k) * SLOT_H} fill={p.digitColor} opacity={1}>
                  {(((base + k) % 10) + 10) % 10}
                </text>
              ))}
            </g>
          );
        })}
      </g>

      {/* ---- middle tier: grid, light lines, dense waveform ---- */}
      <rect x={0} y={ZONE.y0} width={DESIGN_W} height={ZONE.y1 - ZONE.y0} fill="#06104a" opacity={0.55} />
      <g stroke={p.gridColor} strokeWidth={1} opacity={0.28}>{gridLines}</g>
      <rect x={0} y={ZONE.y0 - 2} width={DESIGN_W} height={ZONE.y1 - ZONE.y0 + 4} fill="url(#bn-zone)" />
      <g filter="url(#bn-glow)">
        {LINE_YS.map((y, i) => (
          <line key={i} x1={0} x2={DESIGN_W} y1={y} y2={y} stroke={p.gridColor} strokeWidth={i % 3 === 0 ? 2 : 1.2} opacity={0.45 + 0.35 * Math.sin(frame * 0.09 + LINE_PH[i])} />
        ))}
      </g>
      <g filter="url(#bn-glow)" fill="none" strokeLinejoin="bevel">
        <path d={densePath(DENSE_B, waveOffset + 1700, 175, flicker, 34, frame)} stroke={p.waveColorB} strokeWidth={1.4} opacity={0.85} />
        <path d={densePath(DENSE_A, waveOffset, 190, 1.7 - flicker, 18, frame)} stroke={p.waveColorA} strokeWidth={1.3} opacity={0.8} />
      </g>

      {/* ---- title ---- */}
      <ellipse cx={TITLE.cx} cy={TITLE.ruleY} rx={720} ry={190} fill="url(#bn-title-shade)" opacity={wordsOpacity} />
      <g opacity={wordsOpacity}>
        <TitleWord text={p.titleTop} x={topX} y={TITLE.topBaseline} anchor="middle" color={p.titleColor} />
        <TitleWord text={p.titleBottom} x={botX} y={TITLE.bottomBaseline} anchor="start" color={p.titleColor} />
      </g>
      {rule > 0 ? (
        <g filter="url(#bn-glow-soft)">
          <rect x={TITLE.cx - TITLE.ruleHalf * rule} y={TITLE.ruleY - 2.5} width={TITLE.ruleHalf * 2 * rule} height={5} fill={p.accentColor} />
          {chevrons.map((o, i) => (
            <Chevron key={i} x={botX - 175 + i * 40 + (1 - o) * -20} y={TITLE.bottomBaseline - 48} color={p.accentColor} opacity={o} />
          ))}
        </g>
      ) : null}

      <Streak frame={frame} color={p.streakColor} />

      {/* ---- bottom tier ---- */}
      <Gauges frame={frame} p={p} />
      <LevelBars frame={frame} color={p.levelColor} />

      <Grain seed={frame} amount={0.04} />
    </Frame>
  );
};
