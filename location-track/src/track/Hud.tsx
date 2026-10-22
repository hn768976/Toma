// Vector HUD drawn as SVG in the reference's 1192 x 672 layout space, scaled to the
// composition size so every line stays crisp at 4K.

import React from "react";
import { hash1, smoothstep } from "./random";
import { Palette } from "./palette";
import { FONT_HEAD, FONT_MONO } from "./fonts";
import { FADE_END, toScreen, typed, View } from "./timeline";

const CX = 596;
const CY = 336;

// Rounded hexagon (flat top / bottom), matching the reference's target frame.
const HEX: Array<[number, number]> = [
  [357, 335],
  [455, 118],
  [737, 118],
  [836, 335],
  [737, 553],
  [455, 553],
];

const roundedPolygon = (pts: Array<[number, number]>, r: number) => {
  let d = "";
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const v1 = [p0[0] - p1[0], p0[1] - p1[1]];
    const v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(v1[0], v1[1]);
    const l2 = Math.hypot(v2[0], v2[1]);
    const a = [p1[0] + (v1[0] / l1) * r, p1[1] + (v1[1] / l1) * r];
    const b = [p1[0] + (v2[0] / l2) * r, p1[1] + (v2[1] / l2) * r];
    d += `${i === 0 ? "M" : "L"}${a[0]},${a[1]} Q${p1[0]},${p1[1]} ${b[0]},${b[1]} `;
  }
  return d + "Z";
};

const HEX_PATH = roundedPolygon(HEX, 26);

const TABLE_LABELS = [
  "IP 47039A",
  "FG 15032",
  "LATENCY",
  "C 029417",
  "OP 47039BX",
  "F-DEV1",
  "RNF 4739",
  "IRL 1827",
  "RN-ALPHA",
  "PI 939401",
  "LATTITUDE",
  "TR-1047",
  "Q-DECAY",
];

const digits = (seed: number, n: number) => {
  let s = "";
  for (let i = 0; i < n; i++)
    s += Math.floor(hash1(seed * 31.7 + i * 7.3) * 10);
  return s;
};

const fadeIn = (t: number, start: number, dur = 0.25) =>
  smoothstep(start, start + dur, t);

// Flicker-on used for HUD elements appearing (blinks twice, then holds).
const blinkOn = (t: number, start: number) => {
  if (t < start) return 0;
  const d = t - start;
  if (d < 0.05) return 1;
  if (d < 0.09) return 0.15;
  if (d < 0.13) return 1;
  if (d < 0.16) return 0.3;
  return 1;
};

type Props = { t: number; frame: number; view: View; palette: Palette };

export const Hud: React.FC<Props> = ({ t, frame, view, palette: P }) => {
  const mapB = view.mix > 0.5;
  const cam = view.b;
  // The target frame flashes red while the new location locks on.
  const hexWarn = t > 3.38 && t < 3.62;
  // The frame opens taller and eases down to its final size.
  const hexIn = 1 - Math.pow(1 - Math.min(1, t / 1.2), 3);
  const hexSx = 1;
  const hexSy = 1 + (1 - hexIn) * 0.28;
  const hexFlicker = hexWarn ? (Math.floor(t * 30) % 3 === 0 ? 0.55 : 1) : 1;
  const hexColor = hexWarn ? P.warn : P.hud;

  const title = typed("LOCATION TRACK", t, 0.05, 19);
  const sub = typed("DESTINATION APPROVED", t, 0.7, 34);
  const place = typed("RAU-94", t, 3.1, 18);
  const coords = typed("-12.623333, 142.086667", t, 3.45, 24);
  const loadP = smoothstep(5.0, 8.6, t);
  const tracking = smoothstep(4.55, 5.6, t);

  const sweep = (t * 140) % 360;

  const targets = mapB
    ? {
        rings: [
          { x: 617, y: 290, r: 19, at: 4.6 },
          { x: 497, y: 390, r: 21, at: 4.85 },
        ],
        circles: [
          { x: 700, y: 208, at: 5.0 },
          { x: 622, y: 424, at: 5.15 },
          { x: 757, y: 447, at: 5.3 },
        ],
        tris: [
          { x: 780, y: 240, s: 22, at: 5.4 },
          { x: 641, y: 486, s: 26, at: 5.55 },
        ],
      }
    : null;

  return (
    <svg
      viewBox="0 0 1192 672"
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0 }}
    >
      {/* Grid */}
      <g stroke={P.hud} strokeWidth={0.6} opacity={0.5}>
        {[-3, -2, -1, 1, 2, 3, 4].map((k) => (
          <line
            key={`v${k}`}
            x1={CX + k * 148}
            y1={0}
            x2={CX + k * 148}
            y2={672}
          />
        ))}
        {[-2, -1, 1, 2].map((k) => (
          <line
            key={`h${k}`}
            x1={150}
            y1={CY + k * 136}
            x2={1192}
            y2={CY + k * 136}
          />
        ))}
      </g>

      {/* Crosshair */}
      <g stroke={P.hudText} strokeWidth={0.9} opacity={0.85}>
        <line x1={200} y1={CY} x2={1000} y2={CY} />
        <line x1={CX} y1={0} x2={CX} y2={672} />
      </g>
      <g fill="none" stroke={P.hudText}>
        <circle cx={CX} cy={CY} r={7} strokeWidth={1.2} />
        <circle cx={CX} cy={CY} r={2} fill={P.hudText} strokeWidth={0} />
      </g>
      <rect
        x={214 + Math.sin(t * 1.3) * 3}
        y={333.5}
        width={13}
        height={5}
        fill={P.hudText}
        opacity={0.9}
      />

      {/* Target hexagon */}
      <g
        fill="none"
        stroke={hexColor}
        opacity={hexFlicker * (hexWarn ? 0.55 : 0.95)}
        transform={`translate(${CX},${CY}) scale(${hexSx},${hexSy}) translate(${-CX},${-CY})`}
      >
        <path d={HEX_PATH} strokeWidth={7} opacity={hexWarn ? 0.05 : 0.12} />
        <path d={HEX_PATH} strokeWidth={3.8} opacity={hexWarn ? 0.1 : 0.25} />
        <path d={HEX_PATH} strokeWidth={hexWarn ? 1.1 : 1.9} />
      </g>

      {/* Map-anchored target markers */}
      {targets && (
        <g opacity={tracking > 0 ? 1 : 0}>
          {targets.rings.map((r, i) => {
            const [x, y] = toScreen(cam, r.x, r.y);
            const a = blinkOn(t, r.at);
            const s =
              cam.zoom * (1 + (1 - smoothstep(r.at, r.at + 0.3, t)) * 0.8);
            return (
              <g
                key={`r${i}`}
                transform={`translate(${x},${y}) scale(${s})`}
                opacity={a}
              >
                <circle
                  r={r.r}
                  fill="none"
                  stroke={P.target}
                  strokeWidth={1.25}
                />
                <path
                  d={`M0,${-r.r * 0.62} L${r.r * 0.54},${r.r * 0.31} L${-r.r * 0.54},${r.r * 0.31} Z`}
                  fill="none"
                  stroke={P.target}
                  strokeWidth={1.2}
                  transform={`rotate(${t * 25 * (i ? -1 : 1)})`}
                />
              </g>
            );
          })}
          {targets.circles.map((c, i) => {
            const [x, y] = toScreen(cam, c.x, c.y);
            return (
              <circle
                key={`c${i}`}
                cx={x}
                cy={y}
                r={5.5 * cam.zoom}
                fill="none"
                stroke={P.warn}
                strokeWidth={1.3}
                opacity={blinkOn(t, c.at) * 0.9}
              />
            );
          })}
          {targets.tris.map((m, i) => {
            const [x, y] = toScreen(cam, m.x, m.y);
            const s = m.s * cam.zoom;
            return (
              <path
                key={`t${i}`}
                d={`M${x},${y - s} L${x + s * 0.9},${y + s * 0.55} L${x - s * 0.9},${y + s * 0.55} Z`}
                fill={P.marker}
                fillOpacity={0.12}
                stroke={P.marker}
                strokeWidth={1.6}
                opacity={blinkOn(t, m.at) * 0.85}
              />
            );
          })}
        </g>
      )}

      {/* Frame edges */}
      <rect x={0} y={0} width={1192} height={7} fill="#000" opacity={0.75} />
      <rect x={0} y={664} width={1192} height={8} fill="#000" opacity={0.8} />
      <rect x={1186} y={0} width={6} height={672} fill="#000" opacity={0.5} />

      {/* Left panel */}
      <rect
        x={0}
        y={0}
        width={150}
        height={672}
        fill={P.panel}
        opacity={0.55 + 0.45 * fadeIn(t, 0.1, 0.5)}
      />
      <line
        x1={150}
        y1={0}
        x2={150}
        y2={672}
        stroke={P.hud}
        strokeWidth={0.6}
        opacity={0.45}
      />
      <g fill={P.hudText}>
        <text
          x={10}
          y={46}
          fontFamily={FONT_HEAD}
          fontWeight={700}
          fontSize={15.5}
          letterSpacing={0.2}
        >
          {title}
        </text>
        <text
          x={11}
          y={58}
          fontFamily={FONT_HEAD}
          fontWeight={600}
          fontSize={6.6}
          letterSpacing={0.3}
          opacity={0.85}
        >
          {sub}
        </text>
      </g>
      <g>
        <rect
          x={10.5}
          y={65}
          width={38}
          height={10}
          fill="none"
          stroke={P.hud}
          strokeWidth={0.7}
        />
        <text
          x={14}
          y={72.6}
          fontFamily={FONT_HEAD}
          fontWeight={600}
          fontSize={6.4}
          fill={P.hudText}
        >
          ENGAGE
        </text>
        <circle cx={53} cy={66} r={2} fill={P.hud} />
      </g>

      {/* Bracket frame icon */}
      <g
        fill="none"
        stroke={P.hud}
        strokeWidth={0.9}
        opacity={blinkOn(t, 0.42) * 0.8}
        transform="translate(77,160)"
      >
        <path d="M-26,-40 A48,48 0 0 0 -26,40" />
        <path d="M26,-40 A48,48 0 0 1 26,40" />
        <path d="M-20,-46 L20,-46 M-20,46 L20,46" strokeWidth={1.4} />
        <path d="M-34,-6 L-30,-6 M30,-6 L34,-6 M-34,6 L-30,6 M30,6 L34,6" />
        <circle
          r={2}
          fill={P.hud}
          stroke="none"
          opacity={0.6 + 0.4 * Math.sin(t * 6)}
        />
      </g>

      {/* Data table */}
      <g fontFamily={FONT_MONO} fontSize={4.6} fill={P.hudText}>
        {TABLE_LABELS.map((label, i) => {
          const y = 230 + i * 8.6;
          const on = blinkOn(t, 0.35 + i * 0.05);
          const live = Math.floor(frame / 4) + i * 13;
          return (
            <g key={label} opacity={on * 0.88}>
              <text x={10} y={y}>
                {label}
              </text>
              <text x={62} y={y} opacity={0.85}>
                {digits(i * 17 + (i % 3 === 0 ? live : 0), 3)}.
                {digits(i * 5 + 1, 3)}
              </text>
              <text x={128} y={y} opacity={0.85}>
                100%
              </text>
            </g>
          );
        })}
      </g>

      {/* Disc stack */}
      <g opacity={blinkOn(t, 0.55)}>
        {[0, 1, 2, 3].map((i) => {
          const spread = smoothstep(0.55, 1.1, t);
          const y = 389 + (i - 1.5) * 11 * spread;
          return (
            <ellipse
              key={i}
              cx={66}
              cy={y}
              rx={29}
              ry={5.5}
              fill={P.hud}
              fillOpacity={0.28}
              stroke={P.hudText}
              strokeWidth={0.7}
              opacity={0.85}
            />
          );
        })}
      </g>

      {/* Radar */}
      <g
        transform="translate(66,500)"
        fill="none"
        stroke={P.hudText}
        opacity={blinkOn(t, 0.66) * 0.85}
      >
        <circle r={33} strokeWidth={1.1} />
        <circle r={27} strokeWidth={0.5} opacity={0.6} />
        <path
          d="M-20,-8 Q0,-30 22,-6 M-22,10 Q2,26 20,12"
          strokeWidth={0.6}
          opacity={0.7}
        />
        <line
          x1={0}
          y1={0}
          x2={27 * Math.cos((sweep * Math.PI) / 180)}
          y2={27 * Math.sin((sweep * Math.PI) / 180)}
          strokeWidth={0.9}
        />
        <circle r={1.6} fill={P.hudText} />
      </g>

      {/* Location readout */}
      {mapB && (
        <g fill={P.hudText}>
          <circle
            cx={173}
            cy={42}
            r={3}
            fill="none"
            stroke={P.hud}
            strokeWidth={0.8}
            opacity={blinkOn(t, FADE_END + 0.1)}
          />
          <text
            x={180}
            y={65}
            fontFamily={FONT_HEAD}
            fontWeight={600}
            fontSize={20}
            letterSpacing={0.6}
          >
            {place}
          </text>
          <text
            x={180}
            y={84}
            fontFamily={FONT_MONO}
            fontSize={10.5}
            opacity={0.92}
          >
            {coords}
          </text>
        </g>
      )}

      {/* Loading bar */}
      {t > 4.9 && (
        <g
          fontFamily={FONT_MONO}
          fill={P.hudText}
          opacity={blinkOn(t, 4.9) * 0.85}
        >
          <text x={190} y={598} fontSize={5.4} letterSpacing={0.5}>
            LOADING
          </text>
          <line
            x1={190}
            y1={607}
            x2={430}
            y2={607}
            stroke={P.hudDim}
            strokeWidth={0.6}
          />
          <line
            x1={190}
            y1={607}
            x2={190 + 240 * loadP}
            y2={607}
            stroke={P.hudText}
            strokeWidth={1.1}
          />
          <text x={425} y={624} fontSize={4.8} fill={P.target}>
            {Math.round(loadP * 100)}%
          </text>
        </g>
      )}

      {/* Frame counter */}
      <text
        x={1180}
        y={669.5}
        textAnchor="end"
        fontFamily={FONT_MONO}
        fontSize={6.6}
        fill={P.hudText}
        opacity={0.85}
      >
        {digits(frame + 1, 13)}
      </text>
    </svg>
  );
};
