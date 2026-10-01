import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { mulberry32, seededRandom } from "../particle-ring/random";
import { MONO_FONT_FAMILY } from "../load-fonts";
import { DESIGN_HEIGHT, DESIGN_WIDTH, type Palette } from "./constants";
import { tangleAmount } from "./geometry";

// Everything is laid out in the 1920x1080 design space; the SVG viewBox
// scales it to the composition size so lines and text stay crisp at 4K.

const LONG_LINES = [
  { y: 103, left: "2880", right: "5760" },
  { y: 391, left: "720", right: "1440" },
  { y: 679, left: "180", right: "360" },
  { y: 967, left: "5760", right: "100" },
];
const LONG_X0 = 139;
const LONG_X1 = 1779;

const MID_LEFT = ["1440", "360", "100", "2880", "720", "180", "5760", "1440", "360", "100"];
const MID_RIGHT = ["2880", "720", "180", "5760", "1440", "360", "100", "2880", "720", "180"];
const MID_Y0 = 245;
const MID_STEP = 64.4;
const MID_X0 = 302;
const MID_X1 = 1618;

const V_TOP = 188;
const V_BOTTOM = 883;
const VERTICALS = [
  {
    x: 435,
    top: "5760",
    bottom: "100",
    left: ["720", "1440", "2880", "5760"],
    right: ["100", "180", "360", "720"],
  },
  { x: 796, top: "100", bottom: "180", left: [], right: ["1440", "", "", "1440"] },
  {
    x: 1157,
    top: "180",
    bottom: "360",
    left: ["2880", "5760", "100", "1440"],
    right: ["360", "720", "1440", "2880"],
  },
];
const V_LEFT_Y = [264, 419, 574, 728];
const V_RIGHT_Y = [342, 497, 652, 805];

const BAR_COUNT = 16;
const BAR_X0 = 1383;
const BAR_W = 6.2;
const BAR_GAP = 4.8;
const BAR_BASE = 511;
const BAR_MAX = 215;

const RIGHT_READOUT = [
  (v: number) => `BYTES_SENT: ${(8000 + v * 1999).toFixed(0)}`,
  () => "BUFFER_SEQUENCE_ACTIVE",
  (v: number) => `LATENCY: ${(2 + v * 9).toFixed(0)}ms`,
  (v: number) => `SYNC_ID: ${Math.floor(v * 0xfffff).toString(16).toUpperCase().padStart(5, "0")}`,
  () => "ENCRYPTED_STREAM",
  (v: number) => `PACKET_LOSS: ${(v * 0.09).toFixed(2)}%`,
  (v: number) => `CORE_TEMP: ${(38 + v * 6).toFixed(1)}C`,
  (v: number) => `TRANSFER_RATE: ${(9 + v * 7).toFixed(1)}Gb/s`,
  (v: number) => `NODE_PRIMARY: ${String(Math.floor(v * 12)).padStart(2, "0")}`,
  (v: number) => `STABILITY: ${(97 + v * 2.9).toFixed(1)}%`,
];
const LEFT_READOUT = [
  "DATA_UNIT: 0x3F",
  "VECTOR_FIELD: 06",
  "GRID_SCALE: 1.00",
  "LAT_34.0522",
  "SCAN_SECTOR: A4",
  "SIG_STRENGTH: -42",
  "AXIS_ROT: 23.4",
  "SIGNAL_LOCK: 1",
  "SCALE_FACTOR: 4.0",
  "THERMAL_CLOCK: 07",
];

type Cross = { x: number; y: number; blinkPeriod: number; blinkPhase: number };

const generateCrosses = (): Cross[] => {
  const rand = mulberry32(777);
  const crosses: Cross[] = [];
  // Snap to a loose grid like the reference; skip the dense sphere core.
  for (let gx = 0; gx <= 32; gx++) {
    for (let gy = 0; gy <= 16; gy++) {
      if (rand() > 0.13) continue;
      const x = 10 + gx * 60;
      const y = 32 + gy * 64;
      if (Math.hypot(x - 796, y - 532) < 230) continue;
      // Keep the readouts and bar chart legible.
      if (x > 30 && x < 170 && y > 420 && y < 580) continue;
      if (x > 1360 && x < 1580 && y > 280 && y < 720) continue;
      crosses.push({
        x,
        y,
        blinkPeriod: rand() < 0.25 ? 20 + Math.floor(rand() * 40) : 0,
        blinkPhase: Math.floor(rand() * 60),
      });
    }
  }
  return crosses;
};

const Label: React.FC<{
  x: number;
  y: number;
  text: string;
  anchor?: "start" | "middle" | "end";
  size?: number;
  fill: string;
  opacity?: number;
}> = ({ x, y, text, anchor = "start", size = 8.8, fill, opacity = 1 }) => (
  <text
    x={x}
    y={y}
    fontSize={size}
    fill={fill}
    opacity={opacity}
    textAnchor={anchor}
    dominantBaseline="middle"
    fontFamily={MONO_FONT_FAMILY}
  >
    {text}
  </text>
);

export const Hud: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const crosses = useMemo(() => generateCrosses(), []);
  const tangle = tangleAmount(t);
  const lineStroke = 0.9;

  // Bar heights: each bar retargets on its own short interval and eases
  // toward it, giving the jittery "live meter" feel.
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const interval = 3 + Math.floor(seededRandom(i, 3) * 4);
    const step = Math.floor(frame / interval);
    const local = (frame % interval) / interval;
    const target = (k: number) => 0.08 + 0.92 * Math.pow(seededRandom(i * 131 + k, 11), 0.8);
    const eased = 1 - Math.pow(1 - local, 3);
    return target(step - 1) + (target(step) - target(step - 1)) * eased;
  });
  const tallest = bars.indexOf(Math.max(...bars));

  return (
    <AbsoluteFill>
      <svg
        viewBox={`0 0 ${DESIGN_WIDTH} ${DESIGN_HEIGHT}`}
        width="100%"
        height="100%"
        style={{ position: "absolute" }}
      >
        {/* Long full-width rulers */}
        {LONG_LINES.map((l) => (
          <g key={`long-${l.y}`}>
            <line x1={LONG_X0} x2={LONG_X1} y1={l.y} y2={l.y} stroke={palette.hudLine} strokeWidth={lineStroke} />
            <rect x={LONG_X0 - 1.5} y={l.y - 1.5} width={3} height={3} fill={palette.hudTick} />
            <rect x={LONG_X1 - 1.5} y={l.y - 1.5} width={3} height={3} fill={palette.hudTick} />
            <Label x={LONG_X0 - 16} y={l.y} text={l.left} anchor="end" fill={palette.hudText} />
            <Label x={LONG_X1 + 16} y={l.y} text={l.right} fill={palette.hudText} />
          </g>
        ))}

        {/* Inner rulers */}
        {MID_LEFT.map((left, i) => {
          const y = MID_Y0 + i * MID_STEP;
          return (
            <g key={`mid-${i}`}>
              <line x1={MID_X0} x2={MID_X1} y1={y} y2={y} stroke={palette.hudLine} strokeWidth={lineStroke * 0.8} opacity={0.8} />
              <rect x={MID_X0 - 1.5} y={y - 1.5} width={3} height={3} fill={palette.hudTick} />
              <rect x={MID_X1 - 1.5} y={y - 1.5} width={3} height={3} fill={palette.hudTick} />
              <Label x={MID_X0 - 22} y={y} text={left} anchor="end" fill={palette.hudText} />
              <Label x={MID_X1 + 22} y={y} text={MID_RIGHT[i]} fill={palette.hudText} />
            </g>
          );
        })}

        {/* Vertical rulers with side ticks */}
        {VERTICALS.map((v) => (
          <g key={`v-${v.x}`}>
            <line x1={v.x} x2={v.x} y1={V_TOP} y2={V_BOTTOM} stroke={palette.hudLine} strokeWidth={lineStroke} />
            <rect x={v.x - 1.5} y={V_TOP - 1.5} width={3} height={3} fill={palette.hudTick} />
            <rect x={v.x - 1.5} y={V_BOTTOM - 1.5} width={3} height={3} fill={palette.hudTick} />
            <Label x={v.x + (v.x === 796 ? -14 : 30)} y={V_TOP} text={v.top} anchor={v.x === 796 ? "end" : "middle"} fill={palette.hudText} />
            <Label x={v.x + (v.x === 796 ? 28 : -28)} y={V_BOTTOM} text={v.bottom} anchor="middle" fill={palette.hudText} />
            {v.left.map((txt, i) =>
              txt ? (
                <g key={`vl-${i}`}>
                  <line x1={v.x - 6} x2={v.x} y1={V_LEFT_Y[i]} y2={V_LEFT_Y[i]} stroke={palette.hudTick} strokeWidth={lineStroke} />
                  <Label x={v.x - 22} y={V_LEFT_Y[i]} text={txt} anchor="end" fill={palette.hudText} />
                </g>
              ) : null,
            )}
            {v.right.map((txt, i) =>
              txt ? (
                <g key={`vr-${i}`}>
                  <line x1={v.x} x2={v.x + 6} y1={V_RIGHT_Y[i]} y2={V_RIGHT_Y[i]} stroke={palette.hudTick} strokeWidth={lineStroke} />
                  <Label x={v.x + 22} y={V_RIGHT_Y[i]} text={txt} fill={palette.hudText} />
                </g>
              ) : null,
            )}
          </g>
        ))}

        {/* Faint readings that surface inside the sphere during the tangle */}
        {[
          { y: 340, text: "2880" },
          { y: 420, text: "5760" },
          { y: 500, text: "180" },
          { y: 575, text: "5760" },
          { y: 655, text: "720" },
        ].map((m, i) => (
          <Label
            key={`inner-${i}`}
            x={796 + (i % 2 === 0 ? -26 : 30)}
            y={m.y}
            text={m.text}
            anchor="middle"
            fill={palette.hudText}
            opacity={tangle * (0.35 + 0.25 * Math.sin(t * 3 + i * 1.7))}
          />
        ))}

        {/* Crosses */}
        {crosses.map((c, i) => {
          const on = c.blinkPeriod === 0 || (frame + c.blinkPhase) % c.blinkPeriod > c.blinkPeriod * 0.3;
          return (
            <g key={`c-${i}`} opacity={on ? 1 : 0.15}>
              <line x1={c.x - 9} x2={c.x + 9} y1={c.y} y2={c.y} stroke={palette.hudTick} strokeWidth={lineStroke} />
              <line x1={c.x} x2={c.x} y1={c.y - 9} y2={c.y + 9} stroke={palette.hudTick} strokeWidth={lineStroke} />
            </g>
          );
        })}

        {/* Bar chart */}
        {bars.map((h, i) => (
          <rect
            key={`bar-${i}`}
            x={BAR_X0 + i * (BAR_W + BAR_GAP)}
            y={BAR_BASE - h * BAR_MAX}
            width={BAR_W}
            height={h * BAR_MAX}
            fill={i === tallest ? palette.barAccent : palette.bar}
          />
        ))}
        <line
          x1={BAR_X0 - 4}
          x2={BAR_X0 + BAR_COUNT * (BAR_W + BAR_GAP)}
          y1={BAR_BASE + 0.5}
          y2={BAR_BASE + 0.5}
          stroke={palette.hudTick}
          strokeWidth={lineStroke}
        />

        {/* Right-side live readout */}
        {RIGHT_READOUT.map((fn, i) => {
          const tick = Math.floor(frame / (6 + (i % 4) * 3));
          const v = seededRandom(i * 97 + tick, 5);
          const flicker = seededRandom(i * 13 + Math.floor(frame / 2), 9) < 0.04 ? 0.35 : 1;
          return (
            <Label key={`rr-${i}`} x={1373} y={588 + i * 12.6} text={fn(v)} size={8.6} fill={palette.hudText} opacity={flicker} />
          );
        })}

        {/* Left-side dim readout */}
        {LEFT_READOUT.map((txt, i) => {
          const flicker = seededRandom(i * 29 + Math.floor(frame / 3), 21) < 0.05 ? 0.3 : 1;
          return (
            <Label key={`lr-${i}`} x={55} y={443 + i * 12.4} text={txt} size={7.6} fill={palette.hudTextDim} opacity={flicker} />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
