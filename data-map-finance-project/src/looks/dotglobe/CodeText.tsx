import React from "react";
import { useCurrentFrame } from "remotion";
import { MONO } from "../../lib/fonts";
import { mod } from "../../lib/loop";
import { CODE_BLOCKS } from "./codeLines";

// Code blocks type in, sit, then clear. Cycle 200 frames (600 / 200 = 3).
const CYCLE = 200;
const TYPE_END = 70;
const CLEAR_START = 150;
const CLEAR_END = 168;
const CHARS_PER_FRAME = 2.2;

const BLOCKS = [
  { x: 330, y: 300, offset: 0, size: 26 },
  { x: 1500, y: 1210, offset: 50, size: 30 },
  { x: 2950, y: 1500, offset: 100, size: 24 },
  { x: 700, y: 1580, offset: 150, size: 24 },
];

export const CodeText: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {BLOCKS.map((b, bi) => {
        const t = frame + b.offset;
        const local = mod(t, CYCLE);
        const variant = mod(Math.floor(t / CYCLE), 3);
        const lines = CODE_BLOCKS[bi][variant];
        let budget = local < TYPE_END ? Math.floor(local * CHARS_PER_FRAME) : 1e9;
        // clear: lines vanish top to bottom
        const cleared =
          local < CLEAR_START ? 0 : Math.ceil(((local - CLEAR_START) / (CLEAR_END - CLEAR_START)) * lines.length);
        const visible = local < CLEAR_END;
        const shown: string[] = [];
        let cursorLine = -1;
        for (let i = 0; i < lines.length; i++) {
          if (budget <= 0) break;
          const take = Math.min(lines[i].length, budget);
          shown.push(lines[i].slice(0, take));
          budget -= lines[i].length + 4; // small pause at each line end
          cursorLine = i;
        }
        const cursorOn = mod(frame, 20) < 11 && local < CLEAR_START;
        return (
          <div
            key={bi}
            style={{
              position: "absolute",
              left: b.x,
              top: b.y,
              fontFamily: MONO,
              fontSize: b.size,
              lineHeight: 1.45,
              color,
              opacity: 0.72,
              whiteSpace: "pre",
              textShadow: `0 0 8px ${color}55`,
            }}
          >
            {visible &&
              shown.map((s, i) => (
                <div key={i} style={{ visibility: i < cleared ? "hidden" : "visible" }}>
                  {s}
                  {i === cursorLine && cursorOn ? "█" : ""}
                </div>
              ))}
          </div>
        );
      })}
    </>
  );
};
