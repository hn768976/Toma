import React from "react";
import { boot, code, digits, glitch, vnoise } from "../lib/anim";
import { Palette } from "../palette";
import { G, Txt } from "./primitives";

export const TopBar: React.FC<{ frame: number; p: Palette }> = ({ frame, p }) => {
  const t = frame / 30;
  const step6 = Math.floor(frame / 6);
  const step10 = Math.floor(frame / 10);

  // waveform inside the DATA ANALYSIS box
  const wave: string[] = [];
  for (let i = 0; i <= 70; i++) {
    const x = 327 + i * 2;
    const v = vnoise(i * 0.35 + t * 3, 11) * 0.7 + vnoise(i * 1.3 + t * 6, 12) * 0.3;
    wave.push(`${x},${79 - v * 34}`);
  }

  const table = (x: number, seed: number, title: string, startF: number) => (
    <G o={boot(frame, startF) * glitch(frame, seed)}>
      <Txt x={x} y={30} fill={p.text} opacity={0.85}>{title}</Txt>
      {[0, 1, 2, 3].map((r) => (
        <g key={r}>
          <Txt x={x} y={48 + r * 13} size={8.5} fill={p.text} opacity={0.6}>{digits(seed + r, 4, r === 1 ? step6 : 0)}</Txt>
          <Txt x={x + 45} y={48 + r * 13} size={8.5} fill={p.text} opacity={0.75}>{digits(seed + 10 + r, 9, r % 2 ? step10 : step6)}</Txt>
          <Txt x={x + 140} y={48 + r * 13} size={8.5} fill={p.text} opacity={0.55}>{digits(seed + 20 + r, 4, step10)}</Txt>
          <Txt x={x + 185} y={48 + r * 13} size={8.5} fill={p.text} opacity={0.5}>{code(seed + 30 + r, 3)}</Txt>
        </g>
      ))}
      <rect x={x} y={98} width={220} height={1} fill={p.line} opacity={0.5} />
      <rect x={x} y={97} width={40 + 120 * vnoise(t * 0.8, seed)} height={3} fill={p.line} opacity={0.8} />
    </G>
  );

  return (
    <g>
      {/* icon blocks */}
      <G o={boot(frame, 14)}>
        {[0, 1, 2].map((c) =>
          [0, 1].map((r) => (
            <rect key={`${c}${r}`} x={142 + c * 16} y={36 + r * 24} width={11} height={19} fill={c === 1 ? p.text : p.fill} opacity={0.35 + 0.5 * vnoise(t * 2 + c * 3 + r, 40)} />
          )),
        )}
      </G>
      {/* DATA ANALYSIS */}
      <G o={boot(frame, 12) * glitch(frame, 3)}>
        <Txt x={328} y={30} fill={p.text} opacity={0.85}>DATA ANALYSIS - 004 II</Txt>
        <rect x={325} y={37} width={145} height={45} fill="none" stroke={p.line} strokeWidth={1} opacity={0.6} />
        <polyline points={wave.join(" ")} fill="none" stroke={p.text} strokeWidth={1} opacity={0.9} />
        <polygon points={`327,80 ${wave.join(" ")} 467,80`} fill={p.fill} opacity={0.25} />
        <Txt x={232} y={48} size={8} fill={p.text} opacity={0.6}>{digits(51, 8, step6)}</Txt>
        <Txt x={232} y={60} size={8} fill={p.text} opacity={0.5}>{digits(52, 8)}</Txt>
        <Txt x={232} y={84} size={8} fill={p.text} opacity={0.5}>{`> SYNC ${digits(53, 3, step10)}`}</Txt>
      </G>
      {table(505, 100, "SYS - 001 SECTOR 007", 16)}
      {table(795, 200, "SYS - 002 SECTOR 010", 20)}
      {/* GPS */}
      <G o={boot(frame, 24) * glitch(frame, 4)}>
        <Txt x={1030} y={30} fill={p.text} opacity={0.85}>GPS - 0004</Txt>
        {[0, 1, 2].map((r) => (
          <Txt key={r} x={1030} y={48 + r * 13} size={8.5} fill={p.text} opacity={0.6}>{digits(300 + r, 10, step6 + r)}</Txt>
        ))}
        {[0, 1, 2, 3, 4].map((c) =>
          [0, 1, 2, 3].map((r) => (
            <rect key={`${c}${r}`} x={1122 + c * 13} y={34 + r * 13} width={2.5} height={2.5} fill={p.text} opacity={vnoise(t * 3 + c * 7 + r * 3, 77) > 0.3 ? 0.8 : 0.2} />
          )),
        )}
        <rect x={1030} y={98} width={160} height={1} fill={p.line} opacity={0.5} />
      </G>
      {/* CODE */}
      <G o={boot(frame, 18) * glitch(frame, 5)}>
        <rect x={1222} y={26} width={236} height={68} fill={p.fill} opacity={0.28} />
        <rect x={1222} y={26} width={236} height={68} fill="none" stroke={p.line} strokeWidth={1} opacity={0.5} />
        <Txt x={1232} y={46} size={14} fill={p.text}>CODE</Txt>
        <Txt x={1232} y={60} size={8} fill={p.text} opacity={0.7}>analysis</Txt>
        {[0, 1, 2, 3].map((r) => (
          <Txt key={r} x={1300} y={42 + r * 12} size={8} fill={p.text} opacity={0.75}>{code(400 + r, 18 - r * 3, r === 0 ? step10 : 0).toLowerCase()}</Txt>
        ))}
        <Txt x={1232} y={86} size={8} fill={p.text} opacity={0.6}>{`${digits(410, 3, step6)} . ${digits(411, 3)}`}</Txt>
      </G>
      {/* progress bars */}
      <G o={boot(frame, 9) * glitch(frame, 6)}>
        <rect x={1480} y={26} width={195} height={62} fill="none" stroke={p.line} strokeWidth={1} opacity={0.45} />
        {[0, 1, 2, 3, 4].map((r) => (
          <rect key={r} x={1486} y={33 + r * 11} width={30 + 150 * vnoise(t * 0.7 + r * 2.1, 500 + r)} height={6} fill={p.text} opacity={0.8 - r * 0.08} />
        ))}
        <Txt x={1482} y={100} size={8} fill={p.text} opacity={0.6}>{`PS ${digits(520, 4, step10)}   SYS ${digits(521, 3)}   ${code(522, 4)}`}</Txt>
      </G>
      {/* far right lists */}
      <G o={boot(frame, 6) * glitch(frame, 7)}>
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <g key={r}>
            <Txt x={1700} y={32 + r * 11} size={8} fill={p.text} opacity={0.6}>{`${code(600 + r, 4)} ${digits(610 + r, 6, step6 + r)}`}</Txt>
            <rect x={1800} y={27 + r * 11} width={8 + 40 * vnoise(t + r, 620 + r)} height={5} fill={p.text} opacity={0.55} />
          </g>
        ))}
        <rect x={1855} y={26} width={45} height={5} fill={p.text} opacity={0.85} />
        <rect x={1855} y={36} width={30} height={5} fill={p.text} opacity={0.6} />
        <Txt x={1858} y={58} size={8} fill={p.text} opacity={0.7}>{digits(630, 3, step10)}</Txt>
      </G>
      {/* rule under the bar */}
      <G o={boot(frame, 10)}>
        <rect x={232} y={104} width={1673} height={1} fill={p.line} opacity={0.22} />
      </G>
    </g>
  );
};
