import React from "react";
import { boot, code, digits, glitch, vnoise } from "../lib/anim";
import { Palette } from "../palette";
import { G, Txt } from "./primitives";

// Left column (sector labels + horizontal bar chart), bottom graph, gauges,
// equalizer strip and the right-hand scale.
export const SidePanels: React.FC<{ frame: number; p: Palette }> = ({ frame, p }) => {
  const t = frame / 30;
  const step8 = Math.floor(frame / 8);

  // ---- left labels ----
  const labels = [0, 1, 2, 3, 4, 5, 6].map((i) => (
    <G key={i} o={boot(frame, 3 + i * 2) * glitch(frame, 900 + i)}>
      <Txt x={14} y={26 + i * 54} size={8.5} fill={p.text} opacity={0.85}>{`2000${i + 1}`}</Txt>
      <rect x={14} y={34 + i * 54} width={22 + 22 * vnoise(t * 0.5 + i, 910 + i)} height={5} fill={i % 3 === 1 ? p.accent : p.text} opacity={i % 3 === 1 ? 0.9 : 0.5} />
      <rect x={58} y={34 + i * 54} width={30} height={5} fill={p.accent} opacity={0.55} />
      <Txt x={14} y={52 + i * 54} size={7.5} fill={p.text} opacity={0.5}>{`${code(920 + i, 3)}.${digits(930 + i, 3, step8)}`}</Txt>
    </G>
  ));

  // ---- left bar chart ----
  const bars = Array.from({ length: 24 }, (_, i) => {
    const w = 20 + 70 * vnoise(t * 0.45 + i * 0.9, 1000 + i);
    const y = 430 + i * 19.5;
    return (
      <G key={i} o={boot(frame, 6 + i) * glitch(frame, 1100 + i, 0.01)}>
        <rect x={16} y={y} width={w} height={11} fill={p.fill} opacity={0.8} />
        <rect x={16} y={y} width={2} height={11} fill={p.text} opacity={0.9} />
        {i % 3 === 0 && (
          <Txt x={110} y={y + 9} size={7} fill={p.text} opacity={0.6}>{`▸ ${digits(1200 + i, 3, step8)}`}</Txt>
        )}
        {i % 4 === 1 && <circle cx={16 + w + 8} cy={y + 5.5} r={2.4} fill={p.dot} />}
      </G>
    );
  });

  // ---- bottom graph ----
  const pts = Array.from({ length: 13 }, (_, i) => {
    const x = 700 + i * 55;
    const y = 965 + 52 * vnoise(t * 0.55 + i * 0.75, 1300);
    return { x, y };
  });
  const graphO = boot(frame, 0);

  // ---- rotated text columns (bottom right) ----
  const cols = Array.from({ length: 22 }, (_, i) => {
    const len = 5 + Math.floor(9 * vnoise(i * 0.7, 1400));
    const live = i % 3 === 0 ? step8 + i : 0;
    return (
      <g key={i}>
        <Txt transform={`translate(${1497 + i * 18.5} 1046) rotate(-90)`} size={7} fill={p.text} opacity={0.4 + 0.4 * vnoise(t * 0.8 + i, 1410)}>
          {`${digits(1420 + i, 3, live)} ${code(1440 + i, len).toLowerCase()}`}
        </Txt>
        <rect x={1491 + i * 18.5} y={1046 - 8 - 50 * vnoise(t * 1.2 + i * 0.6, 1460)} width={1} height={8} fill={p.text} opacity={0.7} />
      </g>
    );
  });

  return (
    <g>
      {labels}
      <G o={boot(frame, 12)}>
        <rect x={8} y={420} width={1} height={480} fill={p.line} opacity={0.35} />
      </G>
      {bars}
      {/* bottom-left text block */}
      <G o={boot(frame, 12) * glitch(frame, 1500)}>
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <Txt key={r} x={14} y={922 + r * 13} size={8} fill={p.text} opacity={0.55}>{`${code(1510 + r, 5)} ${digits(1520 + r, 7, r < 2 ? step8 : 0)}`}</Txt>
        ))}
        <rect x={14} y={1004} width={210} height={1} fill={p.line} opacity={0.4} />
        <Txt x={14} y={1020} size={8} fill={p.text} opacity={0.45}>{`::: ${code(1530, 12)} ${digits(1531, 4, step8)}`}</Txt>
      </G>
      {/* flowing curves */}
      <G o={boot(frame, 12)}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i}>
            <path
              d={`M ${250} ${930 + i * 8} C ${400} ${930 + i * 8}, ${450} ${972 + i * 7}, ${652} ${972 + i * 7}`}
              fill="none"
              stroke={p.line}
              strokeWidth={1}
              opacity={0.5}
              strokeDasharray="60 6 4 6"
              strokeDashoffset={-t * 22 - i * 9}
            />
            <circle cx={656} cy={972 + i * 7} r={2.2} fill={i % 2 ? p.accent : p.dot} opacity={0.9} />
          </g>
        ))}
        {/* diagonal leader from the bar chart */}
        <path d="M 112 618 L 170 690 H 236" fill="none" stroke={p.line} strokeWidth={1} opacity={0.45} />
        <circle cx={112} cy={618} r={2.4} fill={p.dot} />
        <Txt x={176} y={684} size={7} fill={p.text} opacity={0.6}>{`SECTOR ${digits(1540, 3, step8)}`}</Txt>
      </G>
      {/* graph panel bracket (visible from frame 0, like the reference) */}
      <G o={graphO}>
        <rect x={670} y={918} width={1} height={132} fill={p.line} opacity={0.5} />
        <rect x={1388} y={918} width={1} height={132} fill={p.line} opacity={0.5} />
        <rect x={670} y={1049} width={719} height={1} fill={p.line} opacity={0.5} />
      </G>
      <G o={boot(frame, 24) * glitch(frame, 1600)}>
        {pts.map(({ x }, i) => (
          <g key={i}>
            <rect x={x} y={945} width={1} height={98} fill={p.line} opacity={0.3} />
            <Txt x={x - 6} y={940} size={6.5} fill={p.text} opacity={0.45}>{digits(1610 + i, 2)}</Txt>
            <Txt transform={`translate(${x - 3} ${pts[i].y - 12}) rotate(-90)`} size={6.5} fill={p.text} opacity={0.6}>{code(1620 + i, 7).toLowerCase()}</Txt>
          </g>
        ))}
        <polyline points={pts.map((q) => `${q.x},${q.y}`).join(" ")} fill="none" stroke={p.line} strokeWidth={1.2} opacity={0.8} />
        {pts.map(({ x, y }, i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={7} fill={p.dot} opacity={0.18} />
            <circle cx={x} cy={y} r={3} fill={p.dot} />
          </g>
        ))}
        <rect x={938} y={1062} width={5} height={5} fill={p.text} opacity={0.8} />
        <Txt x={950} y={1068} size={8} fill={p.text} opacity={0.7}>{`SCAN ${digits(1650, 4, step8)}`}</Txt>
      </G>
      {/* gauges */}
      <G o={boot(frame, 20) * glitch(frame, 1700)}>
        {[0, 1, 2, 3, 4].map((i) => {
          const lv = 0.25 + 0.7 * vnoise(t * 0.9 + i * 1.7, 1710 + i);
          return (
            <g key={i}>
              <rect x={1402 + i * 13} y={922} width={3} height={124} fill={p.line} opacity={0.18} />
              <rect x={1402 + i * 13} y={1046 - 124 * lv} width={3} height={124 * lv} fill={i === 2 ? p.bar : p.text} opacity={0.75} />
            </g>
          );
        })}
      </G>
      {/* rotated data columns + lavender bar */}
      <G o={boot(frame, 6) * glitch(frame, 1800)}>
        {cols}
        <rect x={1488} y={1060} width={190} height={3} fill={p.bar} opacity={0.85} />
        <rect x={1700} y={1060} width={200} height={1} fill={p.line} opacity={0.35} />
      </G>
      {/* right-hand scale */}
      <G o={boot(frame, 30)}>
        <rect x={1906} y={130} width={1} height={760} fill={p.line} opacity={0.3} />
        {Array.from({ length: 39 }, (_, i) => (
          <rect key={i} x={i % 5 === 0 ? 1896 : 1901} y={130 + i * 20} width={i % 5 === 0 ? 10 : 5} height={1} fill={p.line} opacity={0.45} />
        ))}
      </G>
    </g>
  );
};
