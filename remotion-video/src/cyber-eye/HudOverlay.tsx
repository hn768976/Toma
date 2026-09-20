import React, { useEffect, useState } from "react";
import {
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Palette } from "./palettes";
import { hash01 } from "./random";

// 2D HUD chrome drawn as SVG on top of the WebGPU canvas. Coordinates are in a
// 1920x1080 design space and scale losslessly to the 4K compositions. The
// layout follows the reference: everything hugs the iris disc (radius ~390px).
const FONT = "'Share Tech Mono', 'DejaVu Sans Mono', monospace";
const CX = 960;
const CY = 540;

const useHudFont = () => {
  const [handle] = useState(() => delayRender("Loading HUD font"));
  useEffect(() => {
    const face = new FontFace(
      "Share Tech Mono",
      `url(${staticFile("fonts/ShareTechMono-Regular.woff2")}) format("woff2")`,
    );
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        continueRender(handle);
      })
      .catch(() => continueRender(handle));
  }, [handle]);
};

const polar = (r: number, deg: number) => {
  const a = (deg - 90) * (Math.PI / 180);
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
};

const arcPath = (r: number, from: number, to: number) => {
  const a = polar(r, from);
  const b = polar(r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};

const pad = (n: number, w: number) => n.toString().padStart(w, "0");

type Props = { palette: Palette };

export const HudOverlay: React.FC<Props> = ({ palette }) => {
  useHudFont();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const c = palette.hud;
  const accent = palette.secondary;

  const blink = (period: number, offset: number, duty = 0.5) =>
    ((t + offset) % period) / period < duty ? 1 : 0.15;
  const glitch = (k: number) => (hash01(frame * 7 + k) > 0.12 ? 1 : 0.25);

  // Arc scale inside the outer rings: 00 .. 120 over -48..48 degrees.
  const scaleR = 300;
  const ticks: React.ReactNode[] = [];
  for (let d = -48; d <= 48; d += 4) {
    const major = d % 16 === 0;
    const p0 = polar(scaleR, d);
    const p1 = polar(scaleR + (major ? 16 : 8), d);
    ticks.push(
      <line key={`tick-${d}`} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="#ffffff" strokeWidth={major ? 3 : 1.5} opacity={major ? 0.95 : 0.5} />,
    );
    if (major) {
      const p = polar(scaleR + 34, d);
      ticks.push(
        <text key={`lbl-${d}`} x={p.x} y={p.y} fill={c} fontSize={17} textAnchor="middle" transform={`rotate(${d}, ${p.x}, ${p.y})`} opacity={0.95}>
          {pad(((d + 48) / 16) * 20, 2)}
        </text>,
      );
    }
  }
  const needleDeg = -48 + 96 * (0.5 + 0.5 * Math.sin(t * 0.5));
  const needle = polar(scaleR + 4, needleDeg);

  // Area chart on the right.
  const chartPts: string[] = [];
  const chartX0 = 1500;
  const chartY0 = 590;
  for (let i = 0; i <= 40; i++) {
    const x = chartX0 + i * 5.5;
    const v = 0.35 + 0.3 * Math.sin(i * 0.5 + t * 1.2) * Math.sin(i * 0.17 - t * 0.4) + 0.15 * hash01(i * 31 + Math.floor(t * 3));
    chartPts.push(`${x.toFixed(1)},${(chartY0 - v * 60).toFixed(1)}`);
  }
  const chartArea = `M ${chartX0} ${chartY0} L ${chartPts.join(" L ")} L ${chartX0 + 220} ${chartY0} Z`;

  const progress = 0.15 + 0.72 * (0.5 + 0.5 * Math.sin(t * 0.45 - 1.2));
  const coords = `${(40.941145 + 0.00004 * Math.sin(t * 0.7)).toFixed(6)}, ${(38.943578 + 0.00003 * Math.sin(t * 0.9 + 1)).toFixed(6)}`;
  const counter = pad(Math.floor((t * 37) % 1000), 3);

  const barRow = (x: number, y: number, n: number, seedK: number) =>
    Array.from({ length: n }, (_, i) => (
      <rect key={`bar-${seedK}-${i}`} x={x + i * 9} y={y} width={5} height={8} fill={c} opacity={hash01(seedK * 17 + i + Math.floor(t * 4)) > 0.4 ? 0.9 : 0.2} />
    ));

  const dataRows = [0, 1, 2].map((row) => {
    const seed = Math.floor(t * 6) + row * 101;
    const hex = Math.floor(hash01(seed) * 0xffff).toString(16).toUpperCase().padStart(4, "0");
    return `${hex} ${(hash01(seed + 7) * 2).toFixed(3)} ${pad(Math.floor(hash01(seed + 9) * 999), 3)}`;
  });

  const corner = (x: number, y: number, sx: number, sy: number) => (
    <path d={`M ${x + 30 * sx} ${y} H ${x} V ${y + 30 * sy}`} stroke={c} strokeWidth={2} fill="none" opacity={0.45} />
  );

  return (
    <svg viewBox="0 0 1920 1080" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, fontFamily: FONT }}>
      {corner(40, 40, 1, 1)}
      {corner(1880, 40, -1, 1)}
      {corner(40, 1040, 1, -1)}
      {corner(1880, 1040, -1, -1)}

      {/* outer guide circles and long arcs */}
      <circle cx={CX} cy={CY} r={470} stroke={c} strokeWidth={1} fill="none" opacity={0.14} strokeDasharray="4 12" />
      <path d={arcPath(455, -75, -15)} stroke={c} strokeWidth={2} fill="none" opacity={0.35 * glitch(3)} />
      <path d={arcPath(455, 150, 205)} stroke={c} strokeWidth={2} fill="none" opacity={0.3 * glitch(4)} />
      <path d={arcPath(505, 235, 300)} stroke={c} strokeWidth={1.5} fill="none" opacity={0.25} />

      {/* crosshair rails outside the disc */}
      <g stroke={c} strokeWidth={1.5} opacity={0.4}>
        <line x1={CX} y1={40} x2={CX} y2={120} />
        <line x1={CX} y1={960} x2={CX} y2={1040} />
        <line x1={120} y1={CY} x2={420} y2={CY} />
        <line x1={1500} y1={CY} x2={1800} y2={CY} />
        <line x1={420} y1={CY - 8} x2={420} y2={CY + 8} />
        <line x1={1500} y1={CY - 8} x2={1500} y2={CY + 8} />
      </g>

      {/* arc scale + target locked */}
      <path d={arcPath(scaleR, -50, 50)} stroke={c} strokeWidth={1.5} fill="none" opacity={0.6} />
      {ticks}
      <circle cx={needle.x} cy={needle.y} r={4} fill="#ffffff" opacity={0.95} />
      <text x={CX} y={CY - scaleR - 62} fill={c} fontSize={16} textAnchor="middle" letterSpacing={5} opacity={0.95 * glitch(1)}>
        TARGET LOCKED
      </text>
      <text x={CX} y={CY - scaleR - 86} fill={c} fontSize={12} textAnchor="middle" letterSpacing={3} opacity={0.55}>
        ID {counter} // DEPTH 0.{pad(Math.floor((t * 5) % 100), 2)}
      </text>
      {/* small angle readout below the scale, mirrored like the reference */}
      <text x={CX} y={CY + scaleR + 40} fill={c} fontSize={12} textAnchor="middle" letterSpacing={3} opacity={0.5}>
        {(0.2 + 0.05 * Math.sin(t)).toFixed(3)} // {(3.7 + 0.2 * Math.sin(t * 1.3)).toFixed(2)}
      </text>

      {/* top status squares in boxes */}
      {[0, 1, 2, 3].map((i) => (
        <g key={`top-${i}`}>
          <rect x={918 + i * 26} y={30} width={18} height={18} stroke={c} strokeWidth={1.5} fill="none" opacity={0.5} />
          <rect x={923 + i * 26} y={35} width={8} height={8} fill={c} opacity={blink(1.6, i * 0.4, 0.55)} />
        </g>
      ))}

      {/* top-left dial + box */}
      <circle cx={365} cy={165} r={34} stroke={c} strokeWidth={1.5} fill="none" opacity={0.6} />
      <circle cx={365} cy={165} r={34} stroke={accent} strokeWidth={3} fill="none" opacity={0.9} strokeDasharray="40 174" transform={`rotate(${(t * 90) % 360}, 365, 165)`} />
      <rect x={430} y={205} width={30} height={30} stroke={c} strokeWidth={1.5} fill="none" opacity={0.6} />
      <text x={445} y={227} fill={c} fontSize={16} textAnchor="middle" opacity={0.9}>4</text>
      <line x1={160} y1={165} x2={330} y2={165} stroke={c} strokeWidth={1} opacity={0.35} />
      <line x1={160} y1={185} x2={290} y2={185} stroke={c} strokeWidth={1} opacity={0.25} />
      <text x={160} y={150} fill={c} fontSize={12} letterSpacing={3} opacity={0.6}>SYS.04 // ACTIVE</text>

      {/* left: triangle column + brackets */}
      {[0, 1, 2].map((i) => (
        <path key={`tri-${i}`} d={`M 150 ${545 + i * 22} l 6 -10 l 6 10 z`} fill={c} opacity={blink(2.4, i * 0.5, 0.6)} />
      ))}
      <path d="M 235 470 H 205 V 610 H 235" stroke={c} strokeWidth={2} fill="none" opacity={0.6} />
      <text x={520} y={CY} fill={c} fontSize={12} letterSpacing={6} textAnchor="middle" transform={`rotate(-90, 520, ${CY})`} opacity={0.55}>
        SECONDARY
      </text>

      {/* right: coordinates, chart, readouts */}
      <text x={1440} y={CY} fill={c} fontSize={13} letterSpacing={3} textAnchor="middle" transform={`rotate(-90, 1440, ${CY})`} opacity={0.75}>
        {coords}
      </text>
      <g>
        <path d={chartArea} fill={c} opacity={0.22} />
        <polyline points={chartPts.join(" ")} stroke={c} strokeWidth={1.5} fill="none" opacity={0.8} />
        <line x1={chartX0} y1={chartY0} x2={chartX0 + 220} y2={chartY0} stroke={c} strokeWidth={1} opacity={0.5} />
        <line x1={chartX0 + 220} y1={chartY0 - 70} x2={chartX0 + 220} y2={chartY0} stroke={c} strokeWidth={1} opacity={0.5} />
      </g>
      <line x1={1350} y1={CY + 200} x2={1600} y2={CY + 200} stroke={c} strokeWidth={1} opacity={0.4} />
      {barRow(1352, CY + 205, 20, 1)}
      <line x1={1610} y1={CY + 240} x2={1810} y2={CY + 240} stroke={c} strokeWidth={1} opacity={0.4} />
      {barRow(1612, CY + 245, 14, 2)}
      <text x={1350} y={CY + 235} fill={c} fontSize={12} letterSpacing={2} opacity={0.55}>{dataRows[0]}</text>
      <text x={1610} y={CY + 275} fill={c} fontSize={12} letterSpacing={2} opacity={0.55 * glitch(21)}>{dataRows[1]}</text>

      {/* bottom-left progress bar with square end caps */}
      <g>
        <rect x={585} y={CY + 218} width={14} height={14} stroke={c} strokeWidth={1.5} fill="none" opacity={0.8} />
        <rect x={589} y={CY + 222} width={6} height={6} fill={c} opacity={0.9} />
        <line x1={610} y1={CY + 225} x2={840} y2={CY + 225} stroke={c} strokeWidth={2} opacity={0.3} />
        <line x1={610} y1={CY + 225} x2={610 + 230 * progress} y2={CY + 225} stroke="#ffffff" strokeWidth={5} opacity={0.9} />
        <rect x={610 + 230 * progress - 8} y={CY + 217} width={16} height={16} stroke={c} strokeWidth={1.5} fill="none" opacity={0.9} />
        <rect x={610 + 230 * progress - 3} y={CY + 222} width={6} height={6} fill={c} opacity={0.9} />
        <text x={610} y={CY + 205} fill={c} fontSize={12} letterSpacing={3} opacity={0.6}>SCANNING {Math.round(progress * 100)}%</text>
      </g>

      {/* bottom readouts */}
      <text x={CX} y={1010} fill={c} fontSize={12} textAnchor="middle" letterSpacing={2} opacity={0.5}>{dataRows[2]}</text>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={`bb-${i}`} x={1180 + i * 22} y={1000} width={12} height={12} stroke={c} strokeWidth={1.5} fill="none" opacity={0.5} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={`bbf-${i}`} x={1184 + i * 22} y={1004} width={4} height={4} fill={c} opacity={blink(1.3, i * 0.26, 0.5)} />
      ))}
      <line x1={1050} y1={980} x2={1290} y2={980} stroke={c} strokeWidth={1} opacity={0.35} />
    </svg>
  );
};
