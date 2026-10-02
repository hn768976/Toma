import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_B, FONT_MONO } from "../lib/fonts";
import { Grain } from "../lib/Grain";
import { GlowFilter } from "../lib/GlowFilter";
import { clamp, hash01 } from "../lib/random";
import type { WordProps } from "../lib/layout";
import {
  B_DURATION,
  buildRainSchedule,
  HEX,
  Layer,
  LETTER_DURATION,
  PULLBACK_AMOUNT,
  PULLBACK_START,
  RAIN_SCHEDULES,
  RainSchedule,
} from "./schedule";

// Every value below is a function of (frame, seed, layout) only.
// No CSS animations or transitions, no Math.random, no state.

const MARGIN = 0.08; // layers extend past the frame so the pull-back never shows an edge

const cameraScale = (frame: number) => {
  const t = clamp((frame - PULLBACK_START) / (B_DURATION - PULLBACK_START));
  const eased = t * t * (3 - 2 * t);
  return 1 - PULLBACK_AMOUNT * eased;
};

const hexAt = (key: number, a: number, b: number) =>
  HEX[Math.floor(hash01(key, a, b) * 16)];

const CharLayer: React.FC<{ layer: Layer; frame: number; W: number; H: number; cam: number }> = ({
  layer,
  frame,
  W,
  H,
  cam,
}) => {
  const lh = layer.lineH * H;
  const cw = layer.cellX * H;
  const x0 = -MARGIN * W;
  const cols = Math.ceil((W * (1 + 2 * MARGIN)) / cw);
  const rows = Math.ceil((H * (1 + 2 * MARGIN)) / lh) + 2;
  const shift = (frame * layer.speed * H) / lh;
  const whole = Math.floor(shift);
  // Camera pull-back applied to positions and sizes directly (no CSS scale).
  const sc = 1 - (1 - cam) * layer.depth;

  // One text line per ROW (not per column): far fewer line boxes for the
  // browser to lay out. Monospace + letter-spacing keeps the grid aligned.
  const periods: number[] = [];
  for (let c = 0; c < cols; c++) periods.push(6 + Math.floor(hash01(layer.key + c * 7919, 1, 1) * 12));
  const lines: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const g = r - whole;
    const parts: React.ReactNode[] = [];
    let run = "";
    for (let c = 0; c < cols; c++) {
      const key = layer.key + c * 7919;
      if (hash01(key, g, 0) >= layer.density) {
        run += " ";
        continue;
      }
      const period = periods[c];
      const phase = Math.floor(hash01(key, g, 2) * period);
      const bucket = Math.floor((frame + phase) / period);
      const ch = hexAt(key, g, bucket);
      const red = hash01(key, g, 3) < 0.035;
      const spark = hash01(key, g, bucket * 13 + 4) < 0.012;
      if (red || spark) {
        if (run) parts.push(run);
        run = "";
        const color = red ? "#ff3a55" : "#c8f4ff";
        parts.push(
          <span key={c} style={layer.blur > 0 ? { textShadow: `0 0 ${layer.blur * H * 2 * sc}px ${color}` } : { color }}>
            {ch}
          </span>,
        );
      } else {
        run += ch;
      }
    }
    if (run) parts.push(run);
    lines.push(
      <div
        key={r}
        style={{
          position: "absolute",
          left: W / 2 + (x0 - W / 2) * sc,
          top: H / 2 + (-MARGIN * H + (r + shift - whole - 1) * lh - H / 2) * sc,
          whiteSpace: "pre",
          lineHeight: `${lh * sc}px`,
        }}
      >
        {parts}
      </div>,
    );
  }
  return (
    <AbsoluteFill
      style={{
        opacity: layer.opacity,
        fontFamily: FONT_MONO,
        fontWeight: 600,
        fontSize: layer.font * H * sc,
        letterSpacing: (cw - layer.font * H * 0.6) * sc,
        // Depth blur per glyph: transparent text + a blurred shadow of itself.
        // Same look as filter: blur() on the layer, a fraction of the cost.
        ...(layer.blur > 0
          ? { color: "transparent", textShadow: `0 0 ${layer.blur * H * 2 * sc}px ${layer.color}` }
          : { color: layer.color }),
      }}
    >
      {lines}
    </AbsoluteFill>
  );
};

const BokehField: React.FC<{ sched: RainSchedule; frame: number; W: number; H: number; cam: number }> = ({
  sched,
  frame,
  W,
  H,
  cam,
}) => (
  <AbsoluteFill>
    {sched.bokeh.map((b, i) => {
      const s = 1 - (1 - cam) * b.depth;
      const x = 0.5 + (b.x + b.ax * Math.sin(frame * b.wx + b.phase) - 0.5) * s;
      const yRaw = (((b.y + b.vy * frame + 0.05) % 1.1) + 1.1) % 1.1 - 0.05;
      const y = 0.5 + (yRaw - 0.5) * s;
      const r = b.r * H * s;
      const tw = 0.75 + 0.25 * Math.sin(frame * 0.05 + b.phase * 3);
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x * W - r,
            top: y * H - r,
            width: 2 * r,
            height: 2 * r,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${b.color} 0%, ${b.color}99 35%, ${b.color}00 70%)`,
            opacity: b.opacity * tw,
          }}
        />
      );
    })}
  </AbsoluteFill>
);

export const DataRain: React.FC<WordProps> = ({ word, seed, layout }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  if (!layout) throw new Error("layout missing: calculateMetadata did not run");
  const sched = RAIN_SCHEDULES.get(seed) ?? buildRainSchedule(seed, word);
  const cam = cameraScale(frame);

  const capH = layout.capHeight * H;
  const wordW = layout.width * H;
  const left = (W - wordW) / 2;
  const baseline = H / 2 + capH / 2;
  const capTop = baseline - capH;
  const fontSize = layout.fontSize * H;
  const chars = [...word];

  // Box used for texture, blocks and slices: a little beyond the caps so
  // round letters and the tail of Q are covered.
  const boxTop = capTop - 0.08 * capH;
  const boxH = 1.36 * capH;

  // ----- texture inside the letters -----
  const texRowH = 0.0095 * H;
  const texRows = Math.ceil(boxH / texRowH);
  const texCell = 0.0062 * H;
  const texCols = Math.ceil((wordW + 0.2 * capH) / texCell);
  const texX = left - 0.1 * capH;
  const darkRows: string[] = [];
  const brightRows: string[] = [];
  for (let r = 0; r < texRows; r++) {
    const bucket = Math.floor((frame + Math.floor(hash01(sched.textureKey, r, 9) * 4)) / 4);
    let dark = "";
    let bright = "";
    for (let c = 0; c < texCols; c++) {
      const h = hash01(sched.textureKey + r, c, 0);
      const ch = hexAt(sched.textureKey + r * 977, c, hash01(sched.textureKey, r, c) < 0.3 ? bucket : 0);
      dark += h < 0.5 ? ch : " ";
      bright += h >= 0.5 && h < 0.58 ? ch : " ";
    }
    darkRows.push(dark);
    brightRows.push(bright);
  }
  const lineOpacity = sched.lines.map(
    (l, k) => (l.bright ? 0.35 : 0.4) * (0.7 + 0.3 * hash01(k, Math.floor(frame / 5))),
  );
  // The letter fill (gradient + character texture + thin slices), drawn only
  // over the rectangle [x0,x1] x [y0,y1]. Each glyph of the texture is drawn
  // once per frame, not once per letter.
  const texPatch = (x0: number, x1: number, y0: number, y1: number) => {
    const c0 = Math.max(0, Math.floor((x0 - texX) / texCell) - 1);
    const c1 = Math.min(texCols, Math.ceil((x1 - texX) / texCell) + 1);
    const r0 = Math.max(0, Math.floor((y0 - boxTop) / texRowH) - 1);
    const r1 = Math.min(texRows, Math.ceil((y1 - boxTop) / texRowH) + 1);
    const px = texX + c0 * texCell;
    const pw = (c1 - c0) * texCell;
    const rows: number[] = [];
    for (let r = r0; r < r1; r++) rows.push(r);
    return (
      <>
        <rect x={px} y={y0} width={pw} height={y1 - y0} fill="url(#fillB)" />
        <g
          fontFamily={FONT_MONO}
          fontWeight={700}
          fontSize={0.0072 * H}
          letterSpacing={texCell - 0.0072 * H * 0.6}
          style={{ whiteSpace: "pre" }}
        >
          {[
            { rowsData: darkRows, fill: "#04577d", o: 0.42 },
            { rowsData: brightRows, fill: "#eaffff", o: 0.55 },
          ].map(({ rowsData, fill, o }) => (
            <g key={fill} fill={fill} opacity={o}>
              {rows.map((r) => (
                <text key={r} x={px} y={boxTop + (r + 0.8) * texRowH} xmlSpace="preserve">
                  {rowsData[r].slice(c0, c1)}
                </text>
              ))}
            </g>
          ))}
        </g>
        {sched.lines.map((l, k) => {
          const ly = boxTop + l.v * boxH;
          const lh = l.h * capH;
          if (ly + lh < y0 || ly > y1) return null;
          return (
            <rect key={k} x={px} y={ly} width={pw} height={lh} fill={l.bright ? "#d9ffff" : "#033e60"} opacity={lineOpacity[k]} />
          );
        })}
      </>
    );
  };

  // ----- per-letter assembly state -----
  type Piece = { i: number; j: number; dx: number; dy: number };
  const full: number[] = [];
  const red: number[] = [];
  const pieces: Piece[] = [];
  const glowAmt: number[] = [];
  chars.forEach((ch, i) => {
    glowAmt[i] = 0;
    if (ch === " ") return;
    const L = sched.letters[i];
    const t = frame - L.start;
    if (t < 0) return;
    glowAmt[i] = clamp((t - 6) / (LETTER_DURATION - 6));
    if (L.redFlicker && t >= LETTER_DURATION - 6 && t < LETTER_DURATION - 4) {
      red.push(i);
      return;
    }
    if (t >= LETTER_DURATION) {
      full.push(i);
      return;
    }
    L.blocks.forEach((b, j) => {
      const p = clamp((t - b.delay) / 7);
      if (p <= 0) return;
      if (p < 1 && hash01(seed, i * 50 + j, frame) < 0.18) return;
      const q = Math.ceil((1 - p) * 3) / 3; // snaps in steps, not a smooth slide
      pieces.push({ i, j, dx: b.dx * capH * q, dy: b.dy * capH * q });
    });
  });

  const letterBox = (i: number) => {
    const lw = layout.letters[i].w * H;
    return { x: left + layout.letters[i].x * H - 0.06 * lw, w: lw * 1.12 };
  };
  const blockRect = (i: number, j: number) => {
    const b = letterBox(i);
    const bl = sched.letters[i].blocks[j];
    return {
      x: b.x + bl.u0 * b.w,
      y: boxTop + bl.v0 * boxH,
      w: (bl.u1 - bl.u0) * b.w + 0.5,
      h: (bl.v1 - bl.v0) * boxH + 0.5,
    };
  };
  const blockPatch = (i: number, j: number) => {
    const r = blockRect(i, j);
    return texPatch(r.x, r.x + r.w, r.y, r.y + r.h);
  };
  const slice = sched.slices.find((s) => frame >= s.start && frame < s.start + s.len);

  const letterText = (i: number, fill?: string) => (
    <text key={i} x={left + layout.letters[i].x * H} y={baseline} fontFamily={FONT_B} fontSize={fontSize} fill={fill}>
      {chars[i]}
    </text>
  );

  const wordBody = (
    <>
      {full.length > 0 ? (
        <g clipPath="url(#LBfull)">
          {texPatch(
            letterBox(full[0]).x,
            letterBox(full[full.length - 1]).x + letterBox(full[full.length - 1]).w,
            boxTop,
            boxTop + boxH,
          )}
        </g>
      ) : null}
      {red.map((i) => letterText(i, "#ff3355"))}
      {pieces.map((p) => (
        <g key={`p${p.i}-${p.j}`} transform={`translate(${p.dx} ${p.dy})`}>
          <g clipPath={`url(#BB${p.i}-${p.j})`}>
            <g clipPath={`url(#LB${p.i})`}>{blockPatch(p.i, p.j)}</g>
          </g>
        </g>
      ))}
      {sched.specks
        .filter((s) => frame >= s.t0 && frame < s.t0 + s.len)
        .map((s, k) => {
          const b = letterBox(s.letter);
          const sz = s.size * capH;
          return (
            <rect
              key={`s${k}`}
              x={b.x + s.u * b.w}
              y={boxTop + s.v * boxH}
              width={sz * 1.6}
              height={sz * 0.6}
              fill={hash01(seed, k, frame) < 0.2 ? "#ff3355" : "#41e6ff"}
              opacity={0.8}
            />
          );
        })}
    </>
  );

  const glowSigma = 0.0022 * H;
  const glowRegion = {
    x: left - 40 * glowSigma,
    y: capTop - 40 * glowSigma,
    width: wordW + 80 * glowSigma,
    height: capH + 80 * glowSigma,
  };

  return (
    <AbsoluteFill style={{ background: "#01040d", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 70% 65% at 50% 50%, #0d2c60 0%, #0a2250 30%, #061738 60%, #030c22 85%, #01060f 100%)",
        }}
      />
      {sched.layers.slice(0, 2).map((l, i) => (
        <CharLayer key={i} layer={l} frame={frame} W={W} H={H} cam={cam} />
      ))}
      {/* soft haze behind the word keeps it readable over the far layers */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${(wordW / W) * 60 + 6}% 13% at 50% 50%, rgba(3,14,38,0.65) 0%, rgba(3,14,38,0.35) 60%, rgba(3,14,38,0) 100%)`,
        }}
      />

      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <linearGradient id="fillB" x1="0" y1={boxTop} x2="0" y2={boxTop + boxH} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#9af7ff" />
            <stop offset="0.45" stopColor="#3fe2ff" />
            <stop offset="1" stopColor="#0fb4e6" />
          </linearGradient>
          <GlowFilter id="glowB" sigma={glowSigma} strengths={[0.75, 0.45, 0.28]} region={glowRegion} />
          {chars.map((ch, i) =>
            ch === " " ? null : (
              <clipPath id={`LB${i}`} key={`LB${i}`}>
                {letterText(i)}
              </clipPath>
            ),
          )}
          <clipPath id="LBfull">{full.map((i) => letterText(i))}</clipPath>
          {pieces.map((p) => {
            const r = blockRect(p.i, p.j);
            return (
              <clipPath id={`BB${p.i}-${p.j}`} key={`BB${p.i}-${p.j}`}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} />
              </clipPath>
            );
          })}
          {slice ? (
            <>
              <clipPath id="sliceIn">
                <rect x={0} y={capTop + slice.v0 * capH} width={W} height={(slice.v1 - slice.v0) * capH} />
              </clipPath>
              <clipPath id="sliceOut">
                <rect x={0} y={0} width={W} height={capTop + slice.v0 * capH} />
                <rect x={0} y={capTop + slice.v1 * capH} width={W} height={H} />
              </clipPath>
            </>
          ) : null}
        </defs>

        {/* Camera pull-back as an SVG transform, not a CSS one: a CSS-scaled
            layer can be rasterised at a scale cached from an earlier frame,
            which made frames differ between render threads. */}
        <g transform={`translate(${(W * (1 - cam)) / 2} ${(H * (1 - cam)) / 2}) scale(${cam})`}>
        <g filter="url(#glowB)" fill="#18d2ff">
          {chars.map((ch, i) => (ch !== " " && glowAmt[i] > 0 ? <g key={i} opacity={glowAmt[i]}>{letterText(i)}</g> : null))}
        </g>
        {slice ? (
          <>
            <g clipPath="url(#sliceOut)">{wordBody}</g>
            <g clipPath="url(#sliceIn)">
              <g transform={`translate(${slice.dx * capH} 0)`}>{wordBody}</g>
            </g>
            <rect x={left - 0.05 * capH} y={capTop + slice.v0 * capH} width={wordW + 0.1 * capH} height={0.012 * capH} fill="#bff8ff" opacity={0.6} />
          </>
        ) : (
          wordBody
        )}
        </g>
      </svg>

      {sched.layers.slice(2).map((l, i) => (
        <CharLayer key={i} layer={l} frame={frame} W={W} H={H} cam={cam} />
      ))}
      <BokehField sched={sched} frame={frame} W={W} H={H} cam={cam} />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 80% 75% at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,2,8,0.6) 100%)",
        }}
      />
      <Grain id="grainB" amount={0.036} />
    </AbsoluteFill>
  );
};
