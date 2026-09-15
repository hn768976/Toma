import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { HUD_MONO } from "./hudFont";
import { mulberry32 } from "./random";

/**
 * Sci-fi interface furniture for the HUD version. All copy here is invented
 * placeholder text — nothing is lifted from the reference clip. Swap the
 * strings in `HUD_COPY` to re-label the readout without touching the layout.
 */
export const HUD_COPY = {
  panelTitle: "DNA FRAGMENT VISUALISER",
  panelSubtitle: "SEQUENCE SET 04",
  footer: "GENOME ANALYSIS TOOLKIT",
  markers: ["RPL-13A", "ACTB-22"],
  log: [
    "> load sample dna.seq into memory buffer",
    "> dna.sequence_buffer := read_stream(ok)",
    "> align pairwise :: gap_penalty -4",
    "> matrix bloom :: parameters nominal",
    "> codon window 12 :: drift 0.004",
    "> render pass complete :: frame locked",
    "> checksum 8f21ab :: integrity verified",
  ],
};

const cyan = "#63d6ff";
const dimCyan = "rgba(99,214,255,0.55)";

const Tick: React.FC<{ x: number; tall: boolean }> = ({ x, tall }) => (
  <div
    style={{
      position: "absolute",
      left: `${x}%`,
      top: 0,
      width: 1,
      height: tall ? 14 : 7,
      background: tall ? cyan : dimCyan,
    }}
  />
);

/** Floating base letters that drift up and fade, as in the reference. */
const Bases: React.FC<{ frame: number; fps: number; scale: number }> = ({
  frame,
  fps,
  scale,
}) => {
  const letters = "ATGC";
  const rand = mulberry32(9001);
  // Held inside the middle band of frame so the letters never drift through
  // the top readout, the panel or the bottom log.
  const items = Array.from({ length: 26 }, () => ({
    x: 4 + rand() * 92,
    y: 22 + rand() * 58,
    letter: letters[Math.floor(rand() * 4)],
    period: 4 + rand() * 6,
    phase: rand(),
    size: 12 + rand() * 12,
    bold: rand() > 0.6,
  }));

  return (
    <>
      {items.map((it, i) => {
        const cycle = ((frame / fps / it.period + it.phase) % 1 + 1) % 1;
        const opacity = interpolate(
          cycle,
          [0, 0.18, 0.72, 1],
          [0, 0.85, 0.7, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${it.x}%`,
              top: `${it.y - cycle * 7}%`,
              color: cyan,
              opacity,
              fontFamily: HUD_MONO,
              fontWeight: it.bold ? 700 : 400,
              fontSize: it.size * scale,
              letterSpacing: 1 * scale,
              textShadow: `0 0 ${8 * scale}px rgba(99,214,255,0.9)`,
            }}
          >
            {it.letter}
          </div>
        );
      })}
    </>
  );
};

export type HudProps = {
  frame: number;
  fps: number;
  /** 1 at 1080p, 2 at 4K. */
  scale: number;
};

export const Hud: React.FC<HudProps> = ({ frame, fps, scale }) => {
  const s = (n: number) => n * scale;
  const t = frame / fps;

  // The log types itself out one line at a time and then holds.
  const visibleLines = Math.min(
    HUD_COPY.log.length,
    Math.floor(interpolate(t, [0.8, 9], [0, HUD_COPY.log.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })),
  );

  const readout = (t * 24).toFixed(2).padStart(7, "0");
  const clock = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(
    Math.floor(t % 60),
  ).padStart(2, "0")}:${String(Math.floor((t % 1) * 30)).padStart(2, "0")}`;

  const mono: React.CSSProperties = {
    fontFamily: HUD_MONO,
    color: cyan,
    letterSpacing: s(1),
  };

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Bases frame={frame} fps={fps} scale={scale} />

      {/* Top rule with ticks and a centred marker. */}
      <div
        style={{
          position: "absolute",
          top: s(26),
          left: s(60),
          right: s(60),
          height: s(16),
          borderTop: `${Math.max(1, s(1))}px solid ${dimCyan}`,
        }}
      >
        {Array.from({ length: 41 }, (_, i) => (
          <Tick key={i} x={(i / 40) * 100} tall={i % 5 === 0} />
        ))}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: s(3),
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: `${s(5)}px solid transparent`,
            borderRight: `${s(5)}px solid transparent`,
            borderTop: `${s(7)}px solid ${cyan}`,
          }}
        />
      </div>

      <div
        style={{
          ...mono,
          position: "absolute",
          top: s(8),
          left: s(60),
          fontSize: s(11),
          opacity: 0.8,
        }}
      >
        {`ID ${readout}   ${clock}`}
      </div>

      {/* Top-left panel. */}
      <div
        style={{
          position: "absolute",
          top: s(62),
          left: s(60),
          padding: `${s(8)}px ${s(14)}px`,
          border: `${Math.max(1, s(1))}px solid rgba(99,214,255,0.35)`,
          background: "rgba(8,26,48,0.45)",
        }}
      >
        <div style={{ ...mono, fontSize: s(13), fontWeight: 700 }}>
          {HUD_COPY.panelTitle}
        </div>
        <div style={{ ...mono, fontSize: s(10), opacity: 0.6, marginTop: s(3) }}>
          {HUD_COPY.panelSubtitle}
        </div>
      </div>

      {/* Left edge status bars. */}
      <div style={{ position: "absolute", left: s(18), top: s(150) }}>
        {[0.9, 0.55, 0.35, 0.7].map((v, i) => (
          <div
            key={i}
            style={{
              width: s(4),
              height: s(46),
              marginBottom: s(8),
              background: "rgba(99,214,255,0.15)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: 0,
                width: "100%",
                height: `${
                  (v * 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.6 + i * 2))) * 100
                }%`,
                background: cyan,
                boxShadow: `0 0 ${s(8)}px rgba(99,214,255,0.8)`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Bottom-left log. */}
      <div style={{ position: "absolute", left: s(60), bottom: s(48) }}>
        {HUD_COPY.log.slice(0, visibleLines).map((line, i) => (
          <div
            key={i}
            style={{
              ...mono,
              fontSize: s(10),
              opacity: 0.35 + 0.35 * (i / Math.max(1, visibleLines - 1)),
              lineHeight: 1.7,
            }}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Bottom-right product mark. */}
      <div
        style={{
          ...mono,
          position: "absolute",
          right: s(60),
          bottom: s(48),
          fontSize: s(12),
          fontWeight: 700,
          opacity: 0.75,
          letterSpacing: s(2.5),
        }}
      >
        {HUD_COPY.footer}
      </div>

      {/* Leader-line callouts onto the strand. */}
      {[
        { x: 38, y: 24, dx: 60, dy: 46, label: HUD_COPY.markers[0], at: 2.2 },
        { x: 69, y: 74, dx: -58, dy: -44, label: HUD_COPY.markers[1], at: 4.4 },
      ].map((c, i) => {
        const on = interpolate(t, [c.at, c.at + 0.5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${c.x}%`,
              top: `${c.y}%`,
              opacity: on,
            }}
          >
            <svg
              width={s(Math.abs(c.dx) + 4)}
              height={s(Math.abs(c.dy) + 4)}
              style={{
                position: "absolute",
                left: c.dx < 0 ? s(c.dx) : 0,
                top: c.dy < 0 ? s(c.dy) : 0,
                overflow: "visible",
              }}
            >
              <line
                x1={c.dx < 0 ? s(Math.abs(c.dx)) : 0}
                y1={c.dy < 0 ? s(Math.abs(c.dy)) : 0}
                x2={c.dx < 0 ? 0 : s(c.dx)}
                y2={c.dy < 0 ? 0 : s(c.dy)}
                stroke={cyan}
                strokeWidth={Math.max(1, s(1))}
                strokeDasharray={`${s(60 * on)} ${s(200)}`}
                opacity={0.85}
              />
              <circle
                cx={c.dx < 0 ? s(Math.abs(c.dx)) : 0}
                cy={c.dy < 0 ? s(Math.abs(c.dy)) : 0}
                r={s(2.5)}
                fill={cyan}
              />
            </svg>
            <div
              style={{
                ...mono,
                position: "absolute",
                left: c.dx < 0 ? s(c.dx) : s(c.dx),
                top: s(c.dy - 14),
                fontSize: s(11),
                whiteSpace: "nowrap",
                transform: c.dx < 0 ? "translateX(-100%)" : undefined,
                textShadow: `0 0 ${s(10)}px rgba(99,214,255,0.7)`,
              }}
            >
              {c.label}
            </div>
          </div>
        );
      })}

      {/* Faint scanlines over the whole interface. */}
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, rgba(99,214,255,0.05) 0px, rgba(99,214,255,0.05) ${s(
            1,
          )}px, transparent ${s(1)}px, transparent ${s(3)}px)`,
          opacity: 0.5,
        }}
      />
    </AbsoluteFill>
  );
};
