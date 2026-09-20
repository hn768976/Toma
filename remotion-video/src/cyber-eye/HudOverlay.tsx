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
// 1920x1080 design space and scale losslessly to the 4K compositions.
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

  // Deterministic per-frame flicker helpers.
  const blink = (period: number, offset: number, duty = 0.5) =>
    ((t + offset) % period) / period < duty ? 1 : 0.15;
  const glitch = (k: number) => (hash01(frame * 7 + k) > 0.12 ? 1 : 0.25);

  // Arc scale above the iris: 00 .. 120 over -60..60 degrees.
  const scaleR = 352;
  const ticks: React.ReactNode[] = [];
  for (let d = -60; d <= 60; d += 5) {
    const major = d % 20 === 0;
    const p0 = polar(scaleR, d);
    const p1 = polar(scaleR + (major ? 14 : 7), d);
    ticks.push(
      <line
        key={`tick-${d}`}
        x1={p0.x}
        y1={p0.y}
        x2={p1.x}
        y2={p1.y}
        stroke={c}
        strokeWidth={major ? 2 : 1}
        opacity={major ? 0.9 : 0.5}
      />,
    );
    if (major) {
      const p = polar(scaleR + 30, d);
      ticks.push(
        <text
          key={`lbl-${d}`}
          x={p.x}
          y={p.y}
          fill={c}
          fontSize={15}
          textAnchor="middle"
          transform={`rotate(${d}, ${p.x}, ${p.y})`}
          opacity={0.9}
        >
          {pad(((d + 60) / 20) * 20, 2)}
        </text>,
      );
    }
  }
  const scaleNeedle = polar(scaleR + 2, -60 + 120 * (0.5 + 0.5 * Math.sin(t * 0.5)));

  // Waveform on the right.
  const wavePts: string[] = [];
  for (let i = 0; i <= 64; i++) {
    const x = 1350 + i * 3.6;
    const y =
      540 +
      18 * Math.sin(i * 0.38 + t * 3.1) * Math.sin(i * 0.11 - t * 0.8) +
      4 * (hash01(i * 13 + Math.floor(t * 12)) - 0.5);
    wavePts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const progress = 0.15 + 0.72 * (0.5 + 0.5 * Math.sin(t * 0.45 - 1.2));
  const readout = (0.0428 + 0.0041 * Math.sin(t * 1.7) + 0.0009 * Math.sin(t * 9.3)).toFixed(4);
  const counter = pad(Math.floor((t * 37) % 1000), 3);

  const dataRows = [0, 1, 2, 3].map((row) => {
    const seed = Math.floor(t * 6) + row * 101;
    const hex = Math.floor(hash01(seed) * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, "0");
    const bars = Array.from({ length: 6 }, (_, i) =>
      hash01(seed * 3 + i) > 0.45 ? "|" : ".",
    ).join("");
    return `0x${hex}  ${bars}  ${(hash01(seed + 7) * 2).toFixed(3)}`;
  });

  const corner = (x: number, y: number, sx: number, sy: number) => (
    <path
      d={`M ${x + 36 * sx} ${y} H ${x} V ${y + 36 * sy}`}
      stroke={c}
      strokeWidth={2}
      fill="none"
      opacity={0.6}
    />
  );

  return (
    <svg
      viewBox="0 0 1920 1080"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, fontFamily: FONT }}
    >
      {/* corner brackets */}
      {corner(48, 48, 1, 1)}
      {corner(1872, 48, -1, 1)}
      {corner(48, 1032, 1, -1)}
      {corner(1872, 1032, -1, -1)}

      {/* crosshair rails */}
      <g stroke={c} strokeWidth={1.5} opacity={0.55}>
        <line x1={110} y1={CY} x2={585} y2={CY} />
        <line x1={1335} y1={CY} x2={1810} y2={CY} />
        <line x1={CX} y1={70} x2={CX} y2={150} />
        <line x1={CX} y1={930} x2={CX} y2={1010} />
        <line x1={585} y1={CY - 10} x2={585} y2={CY + 10} />
        <line x1={1335} y1={CY - 10} x2={1335} y2={CY + 10} />
        <line x1={110} y1={CY - 6} x2={110} y2={CY + 6} />
        <line x1={1810} y1={CY - 6} x2={1810} y2={CY + 6} />
      </g>
      {/* faint outer guide circle */}
      <circle cx={CX} cy={CY} r={430} stroke={c} strokeWidth={1} fill="none" opacity={0.12} strokeDasharray="6 14" />
      <path d={arcPath(455, 110, 160)} stroke={c} strokeWidth={2} fill="none" opacity={0.35 * glitch(3)} />
      <path d={arcPath(455, 290, 340)} stroke={c} strokeWidth={2} fill="none" opacity={0.35 * glitch(4)} />

      {/* arc scale */}
      <path d={arcPath(scaleR, -62, 62)} stroke={c} strokeWidth={1.5} fill="none" opacity={0.7} />
      {ticks}
      <circle cx={scaleNeedle.x} cy={scaleNeedle.y} r={4} fill={accent} opacity={0.95} />
      <text x={CX} y={CY - scaleR - 62} fill={c} fontSize={16} textAnchor="middle" letterSpacing={5} opacity={0.9 * glitch(1)}>
        TARGET LOCKED
      </text>
      <text x={CX} y={CY - scaleR - 84} fill={c} fontSize={12} textAnchor="middle" letterSpacing={3} opacity={0.6}>
        ID {counter} // DEPTH 0.{pad(Math.floor((t * 5) % 100), 2)}
      </text>

      {/* top status squares */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={`top-${i}`} x={928 + i * 18} y={58} width={10} height={10} fill={c} opacity={blink(1.6, i * 0.4, 0.55)} />
      ))}

      {/* left bracket */}
      <path d="M 205 455 H 150 V 625 H 205" stroke={c} strokeWidth={2} fill="none" opacity={0.75} />
      {[0, 1, 2].map((i) => (
        <rect key={`lb-${i}`} x={168} y={500 + i * 36} width={9} height={9} fill={c} opacity={blink(2.2, i * 0.7, 0.6)} />
      ))}
      <text x={150} y={440} fill={c} fontSize={13} letterSpacing={3} opacity={0.7}>
        OPTIC.L
      </text>

      {/* right bracket + waveform */}
      <path d="M 1715 455 H 1770 V 625 H 1715" stroke={c} strokeWidth={2} fill="none" opacity={0.75} />
      <text x={1770} y={440} fill={c} fontSize={13} letterSpacing={3} textAnchor="end" opacity={0.7}>
        OPTIC.R
      </text>
      <g opacity={0.9}>
        <line x1={1350} y1={CY} x2={1580} y2={CY} stroke={c} strokeWidth={1} opacity={0.3} />
        <polyline points={wavePts.join(" ")} stroke={accent} strokeWidth={2} fill="none" opacity={0.9} />
        <text x={1350} y={498} fill={c} fontSize={13} letterSpacing={2} opacity={0.75}>
          SPECTRAL {readout}
        </text>
      </g>

      {/* vertical label next to the iris */}
      <text x={1262} y={CY} fill={c} fontSize={13} letterSpacing={6} textAnchor="middle" transform={`rotate(90, 1262, ${CY})`} opacity={0.65 * glitch(9)}>
        RETINAL SCAN
      </text>
      <text x={658} y={CY} fill={c} fontSize={13} letterSpacing={6} textAnchor="middle" transform={`rotate(-90, 658, ${CY})`} opacity={0.55}>
        BIOMETRIC LINK
      </text>

      {/* bottom-left progress */}
      <g>
        <line x1={330} y1={760} x2={700} y2={760} stroke={c} strokeWidth={2} opacity={0.35} />
        <line x1={330} y1={760} x2={330 + 370 * progress} y2={760} stroke={c} strokeWidth={4} opacity={0.9} />
        <rect x={330 + 370 * progress - 5} y={753} width={10} height={14} fill={accent} />
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={`pt-${i}`} x1={330 + i * 92.5} y1={766} x2={330 + i * 92.5} y2={772} stroke={c} strokeWidth={1} opacity={0.6} />
        ))}
        <text x={330} y={742} fill={c} fontSize={13} letterSpacing={3} opacity={0.8}>
          SCANNING {Math.round(progress * 100)}%
        </text>
        <text x={700} y={742} fill={c} fontSize={13} letterSpacing={2} textAnchor="end" opacity={0.6}>
          {readout}
        </text>
      </g>

      {/* bottom-right data block */}
      <g fill={c} fontSize={13} opacity={0.7}>
        {dataRows.map((row, i) => (
          <text key={`row-${i}`} x={1290} y={708 + i * 18} opacity={glitch(20 + i)}>
            {row}
          </text>
        ))}
        <line x1={1290} y1={690} x2={1560} y2={690} stroke={c} strokeWidth={1} opacity={0.5} />
      </g>

      {/* bottom centre cluster */}
      <rect x={905} y={918} width={110} height={26} stroke={c} strokeWidth={1.5} fill="none" opacity={0.6} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={`bc-${i}`} x={922 + i * 20} y={926} width={10} height={10} fill={c} opacity={blink(1.2, i * 0.3, 0.5)} />
      ))}

      {/* top-left status dial */}
      <g>
        <circle cx={170} cy={130} r={22} stroke={c} strokeWidth={1.5} fill="none" opacity={0.6} />
        <circle cx={170} cy={130} r={22} stroke={accent} strokeWidth={3} fill="none" opacity={0.9} strokeDasharray="30 108" transform={`rotate(${(t * 90) % 360}, 170, 130)`} />
        <text x={205} y={135} fill={c} fontSize={13} letterSpacing={3} opacity={0.8}>
          SYS.04 // ACTIVE
        </text>
      </g>

      {/* stray readouts around the disc */}
      <text x={690} y={392} fill={c} fontSize={13} opacity={0.6 * glitch(30)}>
        +{(0.24 + 0.02 * Math.sin(t * 2.2)).toFixed(3)}
      </text>
      <text x={1190} y={690} fill={c} fontSize={13} opacity={0.6 * glitch(31)}>
        -{(1.08 + 0.05 * Math.sin(t * 1.4)).toFixed(3)}
      </text>
      <text x={1400} y={392} fill={c} fontSize={13} letterSpacing={2} opacity={0.55}>
        LAT {((t * 3) % 180).toFixed(2)}
      </text>
    </svg>
  );
};
