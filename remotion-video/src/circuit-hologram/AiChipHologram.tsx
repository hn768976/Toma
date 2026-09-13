import React, { useMemo } from "react";
import { buildRoundedRectOutline } from "./geometry";
import { ChipBlocks } from "./ChipBlocks";
import { HologramOutline } from "./HologramOutline";
import { DISPLAY_FONT } from "./load-fonts";

// The "AI" variant: a processor package with pins on all four sides and
// a glowing AI wordmark on the die, edged with the same electric neon
// treatment as the cloud.
export const CHIP_SIZE = 360;
const PAD = 70; // room around the package for the pins
export const CHIP_VIEW = CHIP_SIZE + PAD * 2;
const PIN_COUNT = 11;

export const AiChipHologram: React.FC<{ frame: number }> = ({ frame }) => {
  const points = useMemo(() => buildRoundedRectOutline(PAD, PAD, CHIP_SIZE, CHIP_SIZE, 26), []);
  const inside = useMemo(
    () => (x: number, y: number) => x > PAD + 16 && x < PAD + CHIP_SIZE - 16 && y > PAD + 16 && y < PAD + CHIP_SIZE - 16,
    [],
  );
  const bounds = useMemo(() => ({ x: PAD + 16, y: PAD + 16, w: CHIP_SIZE - 32, h: CHIP_SIZE - 32 }), []);

  const pins = useMemo(() => {
    const list: { x: number; y: number; w: number; h: number; idx: number }[] = [];
    const step = CHIP_SIZE / (PIN_COUNT + 1);
    for (let i = 1; i <= PIN_COUNT; i++) {
      const a = PAD + i * step;
      list.push({ x: a - 6, y: PAD - 44, w: 12, h: 38, idx: i }); // top
      list.push({ x: a - 6, y: PAD + CHIP_SIZE + 6, w: 12, h: 38, idx: i + 20 }); // bottom
      list.push({ x: PAD - 44, y: a - 6, w: 38, h: 12, idx: i + 40 }); // left
      list.push({ x: PAD + CHIP_SIZE + 6, y: a - 6, w: 38, h: 12, idx: i + 60 }); // right
    }
    return list;
  }, []);

  const textPulse = 0.8 + 0.2 * Math.sin(frame * 0.11);

  return (
    <svg width={CHIP_VIEW} height={CHIP_VIEW} viewBox={`0 0 ${CHIP_VIEW} ${CHIP_VIEW}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="chipBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0d1e4d" />
          <stop offset="60%" stopColor="#060e2a" />
          <stop offset="100%" stopColor="#030716" />
        </linearGradient>
        <linearGradient id="pinGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fc3ff" />
          <stop offset="100%" stopColor="#2f6fe0" />
        </linearGradient>
        <filter id="pinGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id="textGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id="textGlowTight" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <clipPath id="chipClip">
          <rect x={PAD + 14} y={PAD + 14} width={CHIP_SIZE - 28} height={CHIP_SIZE - 28} rx={14} />
        </clipPath>
      </defs>

      {/* Pins, with a light "charging" run around the package. */}
      <g>
        {pins.map((p) => {
          const lit = ((frame * 0.35 + p.idx * 2.3) % 44) < 6;
          return (
            <g key={p.idx}>
              {lit ? <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={3} fill="#bfe9ff" filter="url(#pinGlow)" /> : null}
              <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={3} fill="url(#pinGrad)" opacity={lit ? 1 : 0.8} />
            </g>
          );
        })}
      </g>

      {/* Package body and die. */}
      <rect x={PAD} y={PAD} width={CHIP_SIZE} height={CHIP_SIZE} rx={26} fill="url(#chipBody)" />
      <rect x={PAD + 14} y={PAD + 14} width={CHIP_SIZE - 28} height={CHIP_SIZE - 28} rx={14} fill="#050b1f" stroke="#2c5fc4" strokeWidth={1.5} opacity={0.95} />
      <g clipPath="url(#chipClip)">
        <g stroke="#173f96" strokeWidth={0.8} opacity={0.5}>
          {Array.from({ length: 20 }, (_, i) => (
            <line key={`v${i}`} x1={PAD + i * 18} y1={PAD} x2={PAD + i * 18} y2={PAD + CHIP_SIZE} />
          ))}
          {Array.from({ length: 20 }, (_, i) => (
            <line key={`h${i}`} x1={PAD} y1={PAD + i * 18} x2={PAD + CHIP_SIZE} y2={PAD + i * 18} />
          ))}
        </g>
        <ChipBlocks frame={frame} bounds={bounds} seed={311} inside={inside} density={0.8} />
        <rect x={PAD - 40 + ((frame * 2.1) % (CHIP_SIZE + 80))} y={PAD} width={22} height={CHIP_SIZE} fill="#7df0ff" opacity={0.1} />
      </g>

      {/* AI wordmark. */}
      <g fontFamily={`'${DISPLAY_FONT}', 'Orbitron', sans-serif`} fontWeight={800} fontSize={168} textAnchor="middle">
        <text x={CHIP_VIEW / 2} y={CHIP_VIEW / 2 + 60} fill="#1fb8ff" opacity={0.9 * textPulse} filter="url(#textGlow)">AI</text>
        <text x={CHIP_VIEW / 2} y={CHIP_VIEW / 2 + 60} fill="#7df0ff" opacity={0.9} filter="url(#textGlowTight)">AI</text>
        <text x={CHIP_VIEW / 2} y={CHIP_VIEW / 2 + 60} fill="#ffffff">AI</text>
      </g>

      <HologramOutline points={points} frame={frame} filterPrefix="chip" sparkSeed={23} beadCount={8} />
    </svg>
  );
};
