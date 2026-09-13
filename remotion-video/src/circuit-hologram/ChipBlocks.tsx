import React, { useMemo } from "react";
import { CHIP_COLORS } from "./constants";
import { hash01, mulberry32, pickFrom, rangeFrom, type Rng } from "./random";

// The little flickering "circuitry" tiles that live inside the hologram:
// coloured chip blocks of assorted sizes, fine tracks between them, and
// tiny mono digits. Colour/geometry are seeded; visibility is gated by a
// hash of (block, time bucket) so tiles blink on and off deterministically.
type Block = { x: number; y: number; w: number; h: number; color: string; pins: number; phase: number; rate: number };
type Track = { x1: number; y1: number; x2: number; y2: number };
type Digit = { x: number; y: number; text: string; rate: number };

type Props = {
  frame: number;
  bounds: { x: number; y: number; w: number; h: number };
  seed: number;
  inside: (x: number, y: number) => boolean;
  density?: number;
};

const digitFor = (rng: Rng) => {
  const n = Math.floor(rng() * 4);
  return ["01", "10", "0F", "7A", "11", "00", "E3", "9C"][(n * 3 + Math.floor(rng() * 8)) % 8];
};

export const ChipBlocks: React.FC<Props> = ({ frame, bounds, seed, inside, density = 1 }) => {
  const { blocks, tracks, digits } = useMemo(() => {
    const rng = mulberry32(seed);
    const blocks: Block[] = [];
    const tracks: Track[] = [];
    const digits: Digit[] = [];
    let attempts = 0;
    while (blocks.length < 64 * density && attempts < 1400) {
      attempts++;
      const w = rangeFrom(rng, 7, 34);
      const h = rangeFrom(rng, 7, 30);
      const x = rangeFrom(rng, bounds.x, bounds.x + bounds.w - w);
      const y = rangeFrom(rng, bounds.y, bounds.y + bounds.h - h);
      if (!inside(x, y) || !inside(x + w, y) || !inside(x, y + h) || !inside(x + w, y + h)) continue;
      if (blocks.some((b) => x < b.x + b.w + 4 && x + w + 4 > b.x && y < b.y + b.h + 4 && y + h + 4 > b.y)) continue;
      blocks.push({ x, y, w, h, color: pickFrom(rng, CHIP_COLORS), pins: Math.floor(rangeFrom(rng, 2, 6)), phase: rng() * 100, rate: rangeFrom(rng, 6, 16) });
    }
    for (let i = 0; i < 70 * density; i++) {
      const x1 = rangeFrom(rng, bounds.x, bounds.x + bounds.w);
      const y1 = rangeFrom(rng, bounds.y, bounds.y + bounds.h);
      const horizontal = rng() < 0.5;
      const len = rangeFrom(rng, 20, 120);
      const x2 = horizontal ? x1 + len : x1;
      const y2 = horizontal ? y1 : y1 + len;
      if (!inside(x1, y1) || !inside(x2, y2)) continue;
      tracks.push({ x1, y1, x2, y2 });
    }
    for (let i = 0; i < 14 * density; i++) {
      const x = rangeFrom(rng, bounds.x, bounds.x + bounds.w);
      const y = rangeFrom(rng, bounds.y, bounds.y + bounds.h);
      if (!inside(x, y) || !inside(x + 18, y - 8)) continue;
      digits.push({ x, y, text: digitFor(rng), rate: rangeFrom(rng, 10, 30) });
    }
    return { blocks, tracks, digits };
  }, [seed, bounds, inside, density]);

  return (
    <g>
      <g stroke="#2f6fe0" strokeWidth={1.2} opacity={0.55}>
        {tracks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
        ))}
      </g>
      {blocks.map((b, i) => {
        const bucket = Math.floor((frame + b.phase) / b.rate);
        const on = hash01(i + seed, bucket) < 0.62;
        const pulse = 0.55 + 0.45 * Math.sin(frame * 0.2 + b.phase);
        const opacity = on ? 0.55 + 0.45 * pulse : 0.12;
        return (
          <g key={i}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={b.color} opacity={opacity} />
            <rect x={b.x + 3} y={b.y + 3} width={Math.max(2, b.w - 6)} height={Math.max(2, b.h - 6)} fill="#ffffff" opacity={on ? 0.28 * pulse : 0.05} />
            {Array.from({ length: b.pins }, (_, k) => (
              <rect
                key={k}
                x={b.x + 3 + ((b.w - 6) * k) / b.pins}
                y={b.y - 4}
                width={2}
                height={4}
                fill={b.color}
                opacity={opacity}
              />
            ))}
          </g>
        );
      })}
      <g fontFamily="'Share Tech Mono', monospace" fontSize={11} fill="#8fd8ff">
        {digits.map((dg, i) => {
          const bucket = Math.floor(frame / dg.rate);
          const shown = hash01(i * 31 + seed, bucket) < 0.5;
          return shown ? (
            <text key={i} x={dg.x} y={dg.y} opacity={0.85}>
              {dg.text}
            </text>
          ) : null;
        })}
      </g>
    </g>
  );
};
