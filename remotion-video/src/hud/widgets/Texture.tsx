import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { pad, saw, wobble } from "../anim";
import { rngFor } from "../random";
import { FONT_MONO, type HudTheme } from "../theme";

// Block of small squares switching on and off -- the binary field along
// the top of the reference. Each cell has its own cycle length so the
// block never pulses in unison.
export const DotMatrixBlock: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  cols: number;
  rows: number;
  cell?: number;
  gap?: number;
  seed: string;
}> = ({ theme, x, y, cols, rows, cell = 7, gap = 4, seed }) => {
  const frame = useCurrentFrame();

  const cells = useMemo(() => {
    const rand = rngFor(`${seed}:matrix`);
    return Array.from({ length: cols * rows }, () => ({
      lit: rand() > 0.42,
      cycles: 1 + Math.floor(rand() * 6),
      phase: rand(),
    }));
  }, [seed, cols, rows]);

  const pitch = cell + gap;

  return (
    <g transform={`translate(${x} ${y})`}>
      {cells.map((c, i) => {
        const on = c.lit !== saw(frame, c.cycles, c.phase) > 0.5;
        return (
          <rect
            key={i}
            x={(i % cols) * pitch}
            y={Math.floor(i / cols) * pitch}
            width={cell}
            height={cell}
            fill={on ? theme.line : theme.barTrack}
            opacity={on ? 0.9 : 0.35}
          />
        );
      })}
    </g>
  );
};

// Barcode-style strip of variable-width bars.
export const BarcodeStrip: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  width: number;
  height?: number;
  seed: string;
}> = ({ theme, x, y, width, height = 22, seed }) => {
  const frame = useCurrentFrame();

  const bars = useMemo(() => {
    const rand = rngFor(`${seed}:barcode`);
    const out: { x: number; w: number; cycles: number; phase: number }[] = [];
    let cursor = 0;
    while (cursor < width) {
      const w = 2 + rand() * 9;
      if (rand() > 0.38) {
        out.push({ x: cursor, w, cycles: 1 + Math.floor(rand() * 5), phase: rand() });
      }
      cursor += w + 2 + rand() * 5;
    }
    return out;
  }, [seed, width]);

  return (
    <g transform={`translate(${x} ${y})`}>
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={0}
          width={b.w}
          height={height}
          fill={theme.line}
          opacity={0.35 + 0.55 * (saw(frame, b.cycles, b.phase) > 0.5 ? 1 : 0.25)}
        />
      ))}
    </g>
  );
};

// Stack of horizontal rules of varying length -- filler linework along
// the bottom edge of the reference.
export const RuleBars: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  width: number;
  rows?: number;
  rowHeight?: number;
  seed: string;
}> = ({ theme, x, y, width, rows = 4, rowHeight = 10, seed }) => {
  const model = useMemo(() => {
    const rand = rngFor(`${seed}:rules`);
    return Array.from({ length: rows }, () => 0.45 + rand() * 0.55);
  }, [seed, rows]);

  return (
    <g transform={`translate(${x} ${y})`}>
      {model.map((f, i) => (
        <rect
          key={i}
          x={0}
          y={i * rowHeight}
          width={width * f}
          height={4}
          fill={theme.line}
          opacity={0.55}
        />
      ))}
    </g>
  );
};

// Large scrambling numerals. Digits reshuffle on a coarse step so they
// read as a counter racing rather than as noise.
export const ScrambleDigits: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  groups?: number[];
  fontSize?: number;
  rows?: number;
  seed: string;
}> = ({ theme, x, y, groups = [3, 2, 1], fontSize = 26, rows = 2, seed }) => {
  const frame = useCurrentFrame();

  const salts = useMemo(() => {
    const rand = rngFor(`${seed}:digits`);
    return Array.from({ length: rows * groups.length }, () => rand());
  }, [seed, rows, groups.length]);

  // Step 8 times per second so the roll is visible but not strobing.
  const step = Math.floor(frame / 4);

  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: rows }, (_, r) => {
        let cursor = 0;
        return (
          <g key={r} transform={`translate(0 ${r * (fontSize + 10)})`}>
            {groups.map((len, g) => {
              const salt = salts[r * groups.length + g];
              const value = Math.floor(
                Math.abs(Math.sin((step + salt * 97) * (1.7 + g))) * 10 ** len,
              );
              const node = (
                <text
                  key={g}
                  x={cursor}
                  fontFamily={FONT_MONO}
                  fontSize={fontSize}
                  fill={theme.text}
                  opacity={0.72}
                  letterSpacing={4}
                >
                  {pad(value, len)}
                </text>
              );
              cursor += len * (fontSize * 0.62) + 26;
              return node;
            })}
          </g>
        );
      })}
    </g>
  );
};

// Node/edge diagram with a pulse running along the edges.
export const NodeGraph: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  width?: number;
  height?: number;
  nodes?: number;
  seed: string;
}> = ({ theme, x, y, width = 170, height = 110, nodes = 8, seed }) => {
  const frame = useCurrentFrame();

  const model = useMemo(() => {
    const rand = rngFor(`${seed}:graph`);
    const pts = Array.from({ length: nodes }, () => ({
      x: rand() * width,
      y: rand() * height,
      r: 3 + rand() * 4,
    }));
    // Connect each node to the next two, which reliably yields a
    // connected mesh without needing a graph search.
    const edges: [number, number][] = [];
    for (let i = 0; i < nodes; i++) {
      edges.push([i, (i + 1) % nodes]);
      if (rand() > 0.4) edges.push([i, (i + 3) % nodes]);
    }
    const hub = { x: width * 0.42, y: height * 0.5, r: 11 };
    return { pts, edges, hub };
  }, [seed, nodes, width, height]);

  const pulse = saw(frame, 2);

  return (
    <g transform={`translate(${x} ${y})`}>
      {model.edges.map(([a, b], i) => (
        <line
          key={i}
          x1={model.pts[a].x}
          y1={model.pts[a].y}
          x2={model.pts[b].x}
          y2={model.pts[b].y}
          stroke={theme.lineSoft}
          strokeWidth={1.2}
          opacity={0.6}
        />
      ))}
      {model.pts.map((p, i) => (
        <line
          key={`h${i}`}
          x1={p.x}
          y1={p.y}
          x2={model.hub.x}
          y2={model.hub.y}
          stroke={theme.lineFaint}
          strokeWidth={1}
        />
      ))}
      <circle cx={model.hub.x} cy={model.hub.y} r={model.hub.r} fill={theme.lineSoft} />
      {model.pts.map((p, i) => {
        // Node brightness runs around the ring once per half loop.
        const local = ((pulse + i / model.pts.length) % 1 + 1) % 1;
        const hot = local < 0.16;
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={hot ? theme.accent : theme.line}
            opacity={hot ? 1 : 0.85}
          />
        );
      })}
    </g>
  );
};

// Lone dashed arc used as a breathing-room accent in empty regions.
export const AccentArc: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  radius?: number;
  turns?: number;
}> = ({ theme, x, y, radius = 36, turns = -1 }) => {
  const frame = useCurrentFrame();
  const rotation = (frame / 600) * 360 * turns;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotation.toFixed(2)})`}>
      <circle
        r={radius}
        fill="none"
        stroke={theme.lineSoft}
        strokeWidth={3}
        strokeDasharray="18 14"
        opacity={0.75}
      />
    </g>
  );
};

// Small fixed caption, e.g. a panel title.
export const Caption: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  text: string;
  size?: number;
  anchor?: "start" | "middle" | "end";
  dim?: boolean;
}> = ({ theme, x, y, text, size = 12, anchor = "start", dim = false }) => (
  <text
    x={x}
    y={y}
    textAnchor={anchor}
    fontFamily={FONT_MONO}
    fontSize={size}
    fill={dim ? theme.textDim : theme.text}
    letterSpacing={1.6}
  >
    {text}
  </text>
);

// A value that ticks continuously, for corner timecode-style readouts.
export const TickerValue: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  label: string;
  digits?: number;
  cycles?: number;
  size?: number;
  anchor?: "start" | "end";
}> = ({ theme, x, y, label, digits = 6, cycles = 3, size = 13, anchor = "start" }) => {
  const frame = useCurrentFrame();
  const v = Math.floor(wobble(frame, 0.5, 0.5, cycles) * 10 ** digits);
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily={FONT_MONO}
      fontSize={size}
      fill={theme.textDim}
      letterSpacing={1.4}
    >
      {label} {pad(Math.abs(v), digits)}
    </text>
  );
};

// Chamfered panel outline with an optional title bar. Used to group the
// violet layout's right-hand stack into discrete modules -- the
// reference's panels float free, so boxing them is one of the cues that
// the violet cut is a different design rather than a recolour.
export const Panel: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  /** corner chamfer length */
  notch?: number;
  children?: React.ReactNode;
}> = ({ theme, x, y, width, height, title, notch = 16, children }) => {
  const w = width;
  const h = height;
  const d =
    `M${notch} 0H${w}V${h - notch}L${w - notch} ${h}H0V${notch}Z`;
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* Two fills: a near-opaque knock-out of the backdrop so panel
          content reads against a clean ground, then a faint tint on top
          so the module still feels like part of the HUD. */}
      <path d={d} fill={theme.bgBase} opacity={0.82} />
      <path d={d} fill={theme.barTrack} opacity={0.14} />
      <path d={d} fill="none" stroke={theme.lineSoft} strokeWidth={1.6} opacity={0.8} />
      {title ? (
        <>
          <line x1={0} y1={24} x2={w} y2={24} stroke={theme.lineFaint} strokeWidth={1.2} />
          <rect x={0} y={8} width={4} height={10} fill={theme.accent} />
          <text
            x={14}
            y={18}
            fontFamily={FONT_MONO}
            fontSize={11}
            fill={theme.textDim}
            letterSpacing={2}
          >
            {title}
          </text>
        </>
      ) : null}
      {children}
    </g>
  );
};
