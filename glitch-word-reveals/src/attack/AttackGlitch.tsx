import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_A, FONT_MONO } from "../lib/fonts";
import { Grain } from "../lib/Grain";
import { GlowFilter } from "../lib/GlowFilter";
import { hash01 } from "../lib/random";
import type { WordLayout, WordProps } from "../lib/layout";
import { SkullShape } from "./Skull";
import {
  active,
  ATTACK_SCHEDULES,
  AttackSchedule,
  buildAttackSchedule,
  CODE_CHARS,
  GLITCH_CHARS,
  REVEAL_END,
  REVEAL_START,
  revealNoise,
  SkullEvent,
} from "./schedule";
import { ATTACK_FIELDS, AttackField, buildAttackField } from "./field";

// Every value below is a function of (frame, seed, layout) only.
// No CSS animations or transitions, no Math.random, no state.

const charAt = (key: number, row: number, bucket: number) =>
  CODE_CHARS[Math.floor(hash01(key, row, bucket) * CODE_CHARS.length)];

// ---------- background ----------

const Mosaic: React.FC<{ seed: number; frame: number; W: number; H: number }> = ({
  seed,
  frame,
  W,
  H,
}) => {
  const cell = H / 24;
  const cols = Math.ceil(W / cell);
  const rects: React.ReactNode[] = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < 24; j++) {
      const base = hash01(seed, i * 97 + j);
      if (base < 0.35) continue;
      const flick = hash01(seed + 1, i * 97 + j, Math.floor((frame + base * 40) / 7));
      const a = (base - 0.35) * 0.32 * (0.55 + 0.45 * flick);
      const hue = hash01(seed + 2, i, j);
      const fill = hue < 0.6 ? "#2140c8" : hue < 0.85 ? "#3a2ab8" : "#1b78d8";
      rects.push(
        <rect key={i * 97 + j} x={i * cell} y={j * cell} width={cell * 0.96} height={cell * 0.96} fill={fill} opacity={a} />,
      );
    }
  }
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {rects}
    </svg>
  );
};

const CharField: React.FC<{ field: AttackField; frame: number; W: number; H: number }> = ({
  field,
  frame,
  W,
  H,
}) => (
  <>
    {field.columns.map((c, ci) => {
      const lh = c.size * H * 1.25;
      const rows = Math.ceil(H / lh) + 2;
      const shift = frame * c.speed;
      const whole = Math.floor(shift);
      let text = "";
      for (let r = 0; r < rows; r++) {
        const g = r - whole;
        const filled = hash01(c.key, g, 0) < c.density;
        if (!filled) {
          text += " \n";
          continue;
        }
        const phase = Math.floor(hash01(c.key, g, 1) * c.period);
        text += charAt(c.key, g, Math.floor((frame + phase) / c.period)) + "\n";
      }
      return (
        <div
          key={ci}
          style={{
            position: "absolute",
            left: c.x * W,
            top: 0,
            transform: `translateY(${(shift - whole - 1) * lh}px)`,
            fontFamily: FONT_MONO,
            fontWeight: 500,
            fontSize: c.size * H,
            lineHeight: `${lh}px`,
            whiteSpace: "pre",
            color: c.color,
            opacity: c.opacity,
          }}
        >
          {text}
        </div>
      );
    })}
  </>
);

const BigChars: React.FC<{ field: AttackField; frame: number; W: number; H: number }> = ({
  field,
  frame,
  W,
  H,
}) => (
  <>
    {field.bigChars.map((b, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: (b.x + b.vx * frame) * W,
          top: (b.y + b.vy * frame) * H,
          fontFamily: FONT_MONO,
          fontWeight: 700,
          fontSize: b.size * H,
          lineHeight: 1,
          color: b.color,
          opacity: b.opacity * (0.75 + 0.25 * hash01(b.key, Math.floor(frame / 3))),
          filter: `blur(${b.blur * H}px)`,
        }}
      >
        {charAt(b.key, 0, Math.floor(frame / b.period))}
      </div>
    ))}
  </>
);

const CodeBlocks: React.FC<{ field: AttackField; frame: number; W: number; H: number }> = ({
  field,
  frame,
  W,
  H,
}) => (
  <>
    {active(field.blocks, frame).map((b, i) => {
      const t = frame - b.start;
      let budget = Math.floor(t * b.typeSpeed);
      const fade = Math.min(1, (b.start + b.len - frame) / 6);
      const lines = b.lines.map((l) => {
        const s = l.slice(0, Math.max(0, budget));
        budget -= l.length;
        return s;
      });
      const jolt = hash01(b.start, frame) < 0.08 ? 0.006 * W : 0;
      return (
        <div
          key={b.start * 10 + i}
          style={{
            position: "absolute",
            left: b.x * W + jolt,
            top: b.y * H,
            fontFamily: FONT_MONO,
            fontSize: 0.0105 * H,
            lineHeight: `${0.016 * H}px`,
            whiteSpace: "pre",
            color: b.color,
            opacity: 0.32 * fade,
          }}
        >
          {lines.join("\n")}
        </div>
      );
    })}
  </>
);

const Skull: React.FC<{ s: SkullEvent; frame: number; W: number; H: number }> = ({ s, frame, W, H }) => {
  const t = frame - s.start;
  const toEnd = s.start + s.len - 1 - frame;
  const glitching = t < 4 || toEnd < 3;
  const n = hash01(s.start * 7 + Math.round(s.x * 1000), frame);
  if (glitching && n < 0.3) return null; // flicker on entry/exit
  const size = s.size * H;
  const cx = s.x * W + (glitching ? (n - 0.5) * size * 0.5 : 0);
  const cy = s.y * H;
  const scaleIn = t < 4 ? 0.8 + 0.05 * t + 0.1 * n : 1;
  const sz = size * scaleIn;
  const tr = (dx: number) => `translate(${cx - sz / 2 + dx} ${cy - sz / 2}) scale(${sz / 100})`;
  const split = glitching ? size * 0.08 : size * 0.02;
  return (
    <g>
      <g transform={tr(-split)} opacity={0.55}>
        <SkullShape color={s.color === "#22f0ff" ? "#2b6bff" : "#ff1f3d"} />
      </g>
      <g transform={tr(split)} opacity={0.5}>
        <SkullShape color={s.color === "#22f0ff" ? "#9ffcff" : "#ff4fd8"} />
      </g>
      <g transform={tr(0)} filter="url(#skullGlow)">
        <SkullShape color={s.color} />
      </g>
    </g>
  );
};

// ---------- word ----------

type LetterState = { ch: string; visible: boolean; dx: number };

const letterStates = (
  word: string,
  seed: number,
  sched: AttackSchedule,
  frame: number,
): LetterState[] => {
  const swaps = active(sched.bursts, frame).filter((b) => b.kind === "swap");
  return [...word].map((ch, i) => {
    if (frame < REVEAL_START) return { ch, visible: false, dx: 0 };
    const r = sched.reveal[i];
    if (frame < r.appear) return { ch, visible: false, dx: 0 };
    if (frame < r.settle) {
      const n = revealNoise(seed, i, frame);
      const n2 = hash01(seed, i * 31 + 3, frame);
      return {
        ch: n2 < 0.45 ? GLITCH_CHARS[Math.floor(n2 * 1000) % GLITCH_CHARS.length] : ch,
        visible: n > 0.25,
        dx: (hash01(seed, i, frame * 3 + 1) - 0.5) * 0.25,
      };
    }
    const swap = swaps.find((b) => b.letter === i);
    if (swap && ch !== " ") return { ch: swap.char!, visible: true, dx: 0.04 };
    return { ch, visible: true, dx: 0 };
  });
};

const Letters: React.FC<{
  states: LetterState[];
  layout: WordLayout;
  left: number;
  baseline: number;
  H: number;
  fill: string;
}> = ({ states, layout, left, baseline, H, fill }) => (
  <g fill={fill}>
    {states.map((s, i) =>
      s.visible && s.ch !== " " ? (
        <text
          key={i}
          x={left + (layout.letters[i].x + s.dx * layout.capHeight) * H}
          y={baseline}
          fontFamily={FONT_A}
          fontSize={layout.fontSize * H}
        >
          {s.ch}
        </text>
      ) : null,
    )}
  </g>
);

export const AttackGlitch: React.FC<WordProps> = ({ word, seed, layout }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  if (!layout) throw new Error("layout missing: calculateMetadata did not run");

  const sched = ATTACK_SCHEDULES.get(seed) ?? buildAttackSchedule(seed, [...word].length);
  const field = ATTACK_FIELDS.get(seed) ?? buildAttackField(seed);

  const capH = layout.capHeight * H;
  const wordW = layout.width * H;
  const left = (W - wordW) / 2;
  const baseline = H / 2 + capH / 2;
  const capTop = baseline - capH;

  const states = letterStates(word, seed, sched, frame);
  const inReveal = frame >= REVEAL_START && frame < REVEAL_END;
  const bursts = active(sched.bursts, frame);
  const sliceEv = inReveal
    ? active(sched.revealSlices, frame)[0]?.bands
    : bursts.find((b) => b.kind === "slice")?.slice;
  const rgbBoost = bursts.some((b) => b.kind === "rgb") ? 4 : inReveal ? 2.5 : 1;
  const rgb = 0.0024 * H * rgbBoost;

  const shift = active(sched.shifts, frame).reduce((a, s) => a + s.dx, 0) * W;
  const fieldFlicker = 0.88 + 0.12 * hash01(seed, frame, 99);

  const stack = (
    <>
      <g transform={`translate(${-rgb} 0)`} opacity={0.9}>
        <Letters states={states} layout={layout} left={left} baseline={baseline} H={H} fill="#ff2340" />
      </g>
      <g transform={`translate(${rgb} 0)`} opacity={0.9}>
        <Letters states={states} layout={layout} left={left} baseline={baseline} H={H} fill="#2f5cff" />
      </g>
      <Letters states={states} layout={layout} left={left} baseline={baseline} H={H} fill="#f6fcff" />
    </>
  );

  const glowSigma = 0.0028 * H;
  const glowRegion = {
    x: left - 40 * glowSigma,
    y: capTop - 40 * glowSigma,
    width: wordW + 80 * glowSigma,
    height: capH + 80 * glowSigma,
  };

  return (
    <AbsoluteFill style={{ background: "#03020a", overflow: "hidden" }}>
      {/* Base: purple-blue centre fading to near black */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 50% 50%, #241a78 0%, #15125a 35%, #0a0a30 65%, #04030f 100%)",
        }}
      />
      <AbsoluteFill style={{ opacity: fieldFlicker, transform: `translateX(${shift}px)` }}>
        <Mosaic seed={field.mosaicKey} frame={frame} W={W} H={H} />
        <CharField field={field} frame={frame} W={W} H={H} />
        <CodeBlocks field={field} frame={frame} W={W} H={H} />
      </AbsoluteFill>
      {/* Dim the clutter right behind the word, then the purple-blue glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${(wordW / W) * 62 + 8}% 16% at 50% 50%, rgba(6,4,28,0.72) 0%, rgba(6,4,28,0.45) 55%, rgba(6,4,28,0) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 42% 30% at 50% 50%, rgba(88,70,255,0.30) 0%, rgba(60,50,220,0.14) 50%, rgba(40,30,160,0) 100%)",
        }}
      />
      <BigChars field={field} frame={frame} W={W} H={H} />

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <GlowFilter id="glowA" sigma={glowSigma} region={glowRegion} />
          <filter id="skullGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={0.004 * H} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {sliceEv?.map((b, k) => (
            <clipPath id={`sliceA${k}`} key={k}>
              <rect x={0} y={capTop + b.y0 * capH} width={W} height={(b.y1 - b.y0) * capH} />
            </clipPath>
          ))}
        </defs>

        {/* Streak bars */}
        {active(sched.streaks, frame).map((s, i) => (
          <rect
            key={`s${i}`}
            x={(s.x + s.drift * (frame - s.start)) * W}
            y={s.y * H}
            width={s.w * W}
            height={s.h * H}
            fill={s.color}
            opacity={s.opacity}
          />
        ))}
        {/* Pixel blocks */}
        {active(sched.clusters, frame).map((c, i) => (
          <g key={`c${i}`}>
            {c.cells.map((cell, k) =>
              hash01(c.start, k, frame) < 0.85 ? (
                <rect
                  key={k}
                  x={c.x * W + cell.i * c.cell * H}
                  y={c.y * H + cell.j * c.cell * H}
                  width={c.cell * H * 0.92}
                  height={c.cell * H * 0.92}
                  fill={cell.color}
                  opacity={cell.o}
                />
              ) : null,
            )}
          </g>
        ))}
        {/* Skulls (never inside the word band) */}
        {active(sched.skulls, frame).map((s) => (
          <Skull key={`k${s.start}-${s.x}`} s={s} frame={frame} W={W} H={H} />
        ))}

        {/* The word: glow behind, RGB-split copies, crisp white on top */}
        <g filter="url(#glowA)">
          <Letters states={states} layout={layout} left={left} baseline={baseline} H={H} fill="#38e9ff" />
        </g>
        {sliceEv
          ? sliceEv.map((b, k) => (
              <g key={k} clipPath={`url(#sliceA${k})`}>
                <g transform={`translate(${b.dx * W} 0)`}>{stack}</g>
              </g>
            ))
          : stack}
      </svg>

      {/* Edge vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <Grain id="grainA" amount={0.036} />
    </AbsoluteFill>
  );
};
