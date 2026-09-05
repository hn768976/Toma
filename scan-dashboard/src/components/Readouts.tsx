import React from 'react';
import { SW } from '../constants';
import { MODULES, type ReadoutModule } from '../layout';
import { loopSin } from '../motion';
import type { Theme } from '../theme';

const LABEL_SIZE = 28;
const VALUE_SIZE = 26;

const digits = (v: number, n: number) => String(Math.abs(Math.round(v))).padStart(n, '0');

const Shell: React.FC<{ m: ReadoutModule; theme: Theme; children: React.ReactNode }> = ({
  m,
  theme,
  children,
}) => (
  <g transform={`translate(${m.x} ${m.y})`}>
    <rect
      width={m.w}
      height={m.h}
      fill="none"
      stroke={m.accent ? theme.frame : theme.frameDim}
      strokeWidth={SW.frame}
      opacity={m.accent ? 0.72 : 0.46}
    />
    {/* Header rule under the module label. */}
    <path d={`M0 46H${m.w}`} stroke={theme.frameDim} strokeWidth={SW.hair} opacity={0.4} />
    <text x={14} y={34} fontSize={LABEL_SIZE} fill={theme.text} opacity={0.62} letterSpacing={2}>
      {m.label}
    </text>
    {children}
  </g>
);

const Bars: React.FC<{ m: ReadoutModule; theme: Theme; frame: number }> = ({ m, theme, frame }) => {
  const pad = 16;
  const trackW = m.w - pad * 2 - 96;
  return (
    <>
      {Array.from({ length: m.rows }, (_, i) => {
        const y = 78 + i * 46;
        const v = m.bases[i] + 0.22 * loopSin(frame, m.cycles[i], m.phases[i]);
        const w = Math.max(0.05, Math.min(0.97, v)) * trackW;
        return (
          <g key={i}>
            <rect x={pad} y={y} width={trackW} height={16} fill={theme.frameDim} opacity={0.22} />
            <rect
              x={pad}
              y={y}
              width={w}
              height={16}
              fill={m.accent && i === 0 ? theme.accent : theme.text}
              opacity={m.accent && i === 0 ? 0.85 : 0.5}
            />
            <rect x={pad} y={y} width={trackW} height={16} fill="none" stroke={theme.frameDim} strokeWidth={SW.hair} opacity={0.4} />
            <text x={m.w - pad} y={y + 15} fontSize={VALUE_SIZE} fill={theme.textDim} textAnchor="end" opacity={0.72}>
              {digits(v * 999, 3)}
            </text>
          </g>
        );
      })}
    </>
  );
};

const Values: React.FC<{ m: ReadoutModule; theme: Theme; frame: number }> = ({ m, theme, frame }) => {
  const pad = 16;
  return (
    <>
      {Array.from({ length: m.rows }, (_, i) => {
        const y = 82 + i * 44;
        const s = loopSin(frame, m.cycles[i], m.phases[i]);
        const v = m.bases[i] * 8000 + 900 * s;
        const sign = s >= 0 ? '+' : '-';
        return (
          <g key={i}>
            <text x={pad} y={y} fontSize={VALUE_SIZE} fill={theme.textDim} opacity={0.6}>
              {sign}
            </text>
            <text x={pad + 30} y={y} fontSize={VALUE_SIZE} fill={theme.text} opacity={0.78} letterSpacing={1}>
              {digits(v, 4)}
            </text>
            <path d={`M${pad + 178} ${y - 8}H${m.w - pad}`} stroke={theme.frameDim} strokeWidth={SW.hair} opacity={0.3} />
            <text x={m.w - pad} y={y} fontSize={VALUE_SIZE} fill={theme.textDim} textAnchor="end" opacity={0.55}>
              {digits(m.bases[i] * 90 + 9 * s, 2)}
            </text>
          </g>
        );
      })}
    </>
  );
};

const Sliders: React.FC<{ m: ReadoutModule; theme: Theme; frame: number }> = ({ m, theme, frame }) => {
  const pad = 30;
  const top = 74;
  const trackH = m.h - top - 46;
  const gap = (m.w - pad * 2) / m.cols;
  return (
    <>
      {Array.from({ length: m.cols }, (_, i) => {
        const x = pad + gap * (i + 0.5);
        const v = m.bases[i] + 0.3 * loopSin(frame, m.cycles[i], m.phases[i]);
        const y = top + Math.max(0.03, Math.min(0.97, v)) * trackH;
        const hot = m.accent && i === m.cols - 1;
        return (
          <g key={i}>
            <path d={`M${x} ${top}V${top + trackH}`} stroke={theme.frameDim} strokeWidth={SW.frame} opacity={0.45} />
            {Array.from({ length: 9 }, (_, t) => (
              <path
                key={t}
                d={`M${x - 8} ${top + (trackH / 8) * t}h16`}
                stroke={theme.frameDim}
                strokeWidth={SW.hair}
                opacity={0.3}
              />
            ))}
            <rect
              x={x - 17}
              y={y - 6}
              width={34}
              height={12}
              fill={hot ? theme.accent : theme.text}
              opacity={hot ? 0.9 : 0.62}
            />
            <text x={x} y={m.h - 16} fontSize={VALUE_SIZE - 4} fill={theme.textDim} textAnchor="middle" opacity={0.6}>
              {digits(v * 99, 2)}
            </text>
          </g>
        );
      })}
    </>
  );
};

const Cells: React.FC<{ m: ReadoutModule; theme: Theme; frame: number }> = ({ m, theme, frame }) => {
  const pad = 16;
  const cw = (m.w - pad * 2) / m.cols;
  return (
    <>
      {Array.from({ length: m.rows }, (_, r) =>
        Array.from({ length: m.cols }, (_, c) => {
          const k = (r * m.cols + c) % m.cycles.length;
          const lit = loopSin(frame, m.cycles[k], m.phases[k] + c * 0.7 + r * 1.3) > 0.45;
          return (
            <rect
              key={`${r}-${c}`}
              x={pad + c * cw + 3}
              y={74 + r * 40}
              width={cw - 8}
              height={26}
              fill={lit ? (m.accent ? theme.accent : theme.text) : theme.frameDim}
              opacity={lit ? (m.accent ? 0.8 : 0.55) : 0.2}
            />
          );
        }),
      )}
    </>
  );
};

const Ticks: React.FC<{ m: ReadoutModule; theme: Theme; frame: number }> = ({ m, theme, frame }) => {
  const pad = 16;
  const n = 18;
  const step = (m.w - pad * 2) / (n - 1);
  const head = (0.5 + 0.5 * loopSin(frame, m.cycles[0], m.phases[0])) * (n - 1);
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const on = i <= head;
        return (
          <path
            key={i}
            d={`M${pad + i * step} 64v${i % 5 === 0 ? 26 : 16}`}
            stroke={on ? theme.text : theme.frameDim}
            strokeWidth={SW.hair}
            opacity={on ? 0.6 : 0.26}
          />
        );
      })}
    </>
  );
};

export const Readouts: React.FC<{ theme: Theme; frame: number }> = ({ theme, frame }) => (
  <g>
    {MODULES.map((m, i) => (
      <Shell key={i} m={m} theme={theme}>
        {m.kind === 'bars' ? <Bars m={m} theme={theme} frame={frame} /> : null}
        {m.kind === 'values' ? <Values m={m} theme={theme} frame={frame} /> : null}
        {m.kind === 'slider' ? <Sliders m={m} theme={theme} frame={frame} /> : null}
        {m.kind === 'cells' ? <Cells m={m} theme={theme} frame={frame} /> : null}
        {m.kind === 'ticks' ? <Ticks m={m} theme={theme} frame={frame} /> : null}
      </Shell>
    ))}
  </g>
);
