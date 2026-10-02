import React, { useEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ASSISTANT_PALETTES, AssistantPalette, CHAT_TEXT } from "../palettes";
import { FONT_FAMILY, loadFonts } from "./fonts";
import { charsVisible, cursorOn, QUESTION_TIMES, REPLY_TIMES, TIMELINE, wrap } from "./script";

export type AssistantProps = { palette: keyof typeof ASSISTANT_PALETTES };

/*
 * Look 3 is 2D: one flat screen drawn as SVG, tilted with CSS 3D transforms.
 * Every size is a fraction of the frame: the SVG lives in a fixed design
 * space (VB_W x VB_H) and is scaled to a fraction of the composition width,
 * so stroke widths, font sizes and glow radii scale with it; the dot grid
 * spacing is computed from the width too.
 *
 * No CSS @keyframes and no CSS transitions anywhere: typing, cursor blink and
 * the send pulse are inline values computed from useCurrentFrame().
 */

const VB_W = 4000;
const VB_H = 2600;
const SCREEN_W_FRAC = 1.0; // screen width as a fraction of frame width

// layout in design units
const L = {
  titleX: 760,
  titleY: 470,
  titleSize: 165,
  input: { x: 560, y: 620, w: 3000, h: 300 },
  inputTextX: 700,
  inputTextSize: 122,
  send: { r: 100, inner: 38 },
  reply: { x: 560, y: 1080, w: 3000, h: 1300, r: 120 },
  replyTextX: 720,
  replyTextY: 1300,
  replyTextSize: 118,
  replyLine: 175,
  replyMaxChars: 27,
  stroke: 13,
};
const ADVANCE = 0.6; // JetBrains Mono advance width, in em

const REPLY_LINES = wrap(CHAT_TEXT.reply, L.replyMaxChars);

/** Blur radii for the 4 focus layers, as a fraction of frame width. */
const FOCUS_BLUR = [0, 0.0011, 0.0028, 0.006];

const ScreenSvg: React.FC<{ frame: number; pal: AssistantPalette }> = ({ frame, pal }) => {
  const q = charsVisible(QUESTION_TIMES, frame);
  const r = charsVisible(REPLY_TIMES, frame);
  const inReply = frame >= TIMELINE.replyStart;

  // cursor: solid while characters are arriving, blinking otherwise
  const typingQ = q > 0 && q < CHAT_TEXT.question.length && frame >= TIMELINE.questionStart;
  const typingR = r > 0 && r < CHAT_TEXT.reply.length;
  const showCursor = typingQ || typingR || cursorOn(frame);

  // send button: one pulse
  const ps = (frame - TIMELINE.sendPulseStart) / (TIMELINE.sendPulseEnd - TIMELINE.sendPulseStart);
  const pulse = ps > 0 && ps < 1 ? Math.sin(Math.PI * ps) : 0;

  const inp = L.input;
  const sendCx = inp.x + inp.w - inp.h / 2;
  const sendCy = inp.y + inp.h / 2;
  const inputBaseline = inp.y + inp.h / 2 + L.inputTextSize * 0.36;

  // reply text: split visible characters across the wrapped lines
  let remaining = r;
  const replyRows = REPLY_LINES.map((line) => {
    const n = Math.max(0, Math.min(line.length, remaining));
    remaining -= n;
    return line.slice(0, n);
  });
  let cursorRow = 0;
  for (let i = 0; i < replyRows.length; i++) if (replyRows[i].length > 0) cursorRow = i;
  // if the last visible row is full and there's more, the cursor goes to the next row
  if (
    replyRows[cursorRow].length === REPLY_LINES[cursorRow].length &&
    cursorRow < REPLY_LINES.length - 1 &&
    r < CHAT_TEXT.reply.length
  )
    cursorRow++;
  const cursorReplyCol = replyRows[cursorRow].length;

  const cw = L.stroke * 0.9; // cursor bar width
  const cursorInput = {
    x: L.inputTextX + q * ADVANCE * L.inputTextSize + 8,
    y: inputBaseline - L.inputTextSize * 0.82,
    h: L.inputTextSize * 0.98,
  };
  const cursorReply = {
    x: L.replyTextX + cursorReplyCol * ADVANCE * L.replyTextSize + 8,
    y: L.replyTextY + cursorRow * L.replyLine - L.replyTextSize * 0.82,
    h: L.replyTextSize * 0.98,
  };
  const cur = inReply ? cursorReply : cursorInput;

  const textStyle: React.CSSProperties = { fontFamily: FONT_FAMILY, fontWeight: 500 };

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      <defs>
        {/* stacked glow: three blur sizes 1 : 4 : 12, each fainter */}
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="28" result="b2" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="84" result="b3" />
          <feComponentTransfer in="b1" result="g1">
            <feFuncA type="linear" slope="1.1" />
          </feComponentTransfer>
          <feComponentTransfer in="b2" result="g2">
            <feFuncA type="linear" slope="0.8" />
          </feComponentTransfer>
          <feComponentTransfer in="b3" result="g3">
            <feFuncA type="linear" slope="0.5" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="g3" />
            <feMergeNode in="g2" />
            <feMergeNode in="g1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* glow colour pass: the same shapes in the glow colour, blurred */}
      <g filter="url(#glow)">
        <g stroke={pal.glow} fill="none" strokeWidth={L.stroke * 2.2} opacity={0.9}>
          <rect x={inp.x} y={inp.y} width={inp.w} height={inp.h} rx={inp.h / 2} />
          <circle cx={sendCx} cy={sendCy} r={L.send.r * (1 + 0.1 * pulse)} strokeWidth={L.stroke * (1.6 + 1.6 * pulse)} />
          <rect x={L.reply.x} y={L.reply.y} width={L.reply.w} height={L.reply.h} rx={L.reply.r} />
        </g>
        <circle cx={sendCx} cy={sendCy} r={L.send.inner * (1 + 0.25 * pulse)} fill={pal.glow} opacity={0.6 + 0.4 * pulse} />
      </g>

      {/* crisp lines and text, with the same glow stack */}
      <g filter="url(#glow)">
        <g stroke={pal.line} fill="none" strokeWidth={L.stroke}>
          <rect x={inp.x} y={inp.y} width={inp.w} height={inp.h} rx={inp.h / 2} />
          <circle cx={sendCx} cy={sendCy} r={L.send.r * (1 + 0.1 * pulse)} strokeWidth={L.stroke * (1 + 0.8 * pulse)} />
          <rect x={L.reply.x} y={L.reply.y} width={L.reply.w} height={L.reply.h} rx={L.reply.r} />
        </g>
        <circle cx={sendCx} cy={sendCy} r={L.send.inner * (1 + 0.25 * pulse)} fill={pal.line} />

        <text x={L.titleX} y={L.titleY} fill={pal.text} fontSize={L.titleSize} style={{ ...textStyle, fontWeight: 700 }}>
          {CHAT_TEXT.title}
        </text>
        <text x={L.inputTextX} y={inputBaseline} fill={pal.text} fontSize={L.inputTextSize} style={textStyle} xmlSpace="preserve">
          {CHAT_TEXT.question.slice(0, q)}
        </text>
        {replyRows.map((row, i) => (
          <text
            key={i}
            x={L.replyTextX}
            y={L.replyTextY + i * L.replyLine}
            fill={pal.text}
            fontSize={L.replyTextSize}
            style={textStyle}
            xmlSpace="preserve"
          >
            {row}
          </text>
        ))}
        {showCursor ? <rect x={cur.x} y={cur.y} width={cw} height={cur.h} fill={pal.text} /> : null}
      </g>
    </svg>
  );
};

type ScreenPart = "content" | "gridDark" | "gridDots";

/**
 * The screen surface. `content` is the gradient + SVG; the two grid parts are
 * the pixel dot pattern. The grid is drawn once, on top of the soft-focus
 * stack and unblurred, so it stays visible across the whole screen (it is
 * also what hides any banding in the gradient).
 */
const Screen: React.FC<{ frame: number; pal: AssistantPalette; width: number; part: ScreenPart }> = ({
  frame,
  pal,
  width,
  part,
}) => {
  const sw = width * SCREEN_W_FRAC;
  const sh = (sw * VB_H) / VB_W;
  const dot = width / 300; // pixel pitch: a fraction of the frame
  const s = pal.dotStrength;
  const g = Math.round(255 * (1 - s));
  return (
    <div
      style={{
        position: "absolute",
        width: sw,
        height: sh,
        left: -sw * 0.04,
        top: -sh * 0.02,
        background:
          part === "content"
            ? `linear-gradient(115deg, ${pal.screenFrom} 0%, ${pal.screenTo} 100%)`
            : part === "gridDark"
              ? // dark gaps between pixels (blended with multiply)
                `radial-gradient(circle at 50% 50%, rgb(255,255,255) 0%, rgb(255,255,255) 34%, rgb(${g},${g},${g}) 62%)`
              : // a faint bright dot in each pixel (blended with screen)
                `radial-gradient(circle at 50% 50%, ${pal.dot} 0%, rgba(0,0,0,0) 32%)`,
        backgroundSize: part === "content" ? undefined : `${dot}px ${dot}px`,
        overflow: "hidden",
      }}
    >
      {part === "content" ? <ScreenSvg frame={frame} pal={pal} /> : null}
    </div>
  );
};

/** One copy of the tilted screen. */
const Tilted: React.FC<{ frame: number; pal: AssistantPalette; width: number; height: number; part: ScreenPart }> = ({
  frame,
  pal,
  width,
  height,
  part,
}) => (
  <AbsoluteFill style={{ perspective: width * 1.1, perspectiveOrigin: "40% 30%" }}>
    <div
      style={{
        position: "absolute",
        width,
        height,
        transformOrigin: "35% 30%",
        // ~17 deg of tilt overall
        transform: `rotateX(16deg) rotateY(-11deg) rotateZ(8deg) scale(1.02)`,
      }}
    >
      <Screen frame={frame} pal={pal} width={width} part={part} />
    </div>
  </AbsoluteFill>
);

export const AIAssistant: React.FC<AssistantProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const pal = ASSISTANT_PALETTES[palette];
  useEffect(() => {
    loadFonts();
  }, []);
  loadFonts();

  // Soft focus away from a band across the input field: four copies of the
  // screen, each more blurred, blended with gradient masks. The band follows
  // the screen's tilt (about 8 deg).
  const bandAngle = 172; // deg; CSS gradient direction, perpendicular to the band
  const masks = [
    null, // most blurred: full frame underneath
    `linear-gradient(${bandAngle}deg, transparent 0%, black 14%, black 52%, transparent 74%)`,
    `linear-gradient(${bandAngle}deg, transparent 6%, black 20%, black 42%, transparent 60%)`,
    `linear-gradient(${bandAngle}deg, transparent 13%, black 24%, black 36%, transparent 48%)`,
  ];
  const blurs = [FOCUS_BLUR[3], FOCUS_BLUR[2], FOCUS_BLUR[1], FOCUS_BLUR[0]];

  // key={frame}: remount the screen every frame. Chrome otherwise re-uses
  // raster tiles of the blurred layers from the previous frame drawn in the
  // same tab, which can shift a few pixels by 1/255 compared with rendering
  // that frame on its own. A fresh DOM per frame makes every frame identical
  // however (and in whatever order) it is rendered.
  return (
    <AbsoluteFill key={frame} style={{ backgroundColor: pal.bezel }}>
      {blurs.map((b, i) => (
        <AbsoluteFill
          key={i}
          style={{
            filter: b > 0 ? `blur(${b * width}px)` : undefined,
            WebkitMaskImage: masks[i] ?? undefined,
            maskImage: masks[i] ?? undefined,
          }}
        >
          <Tilted frame={frame} pal={pal} width={width} height={height} part="content" />
        </AbsoluteFill>
      ))}
      <AbsoluteFill style={{ mixBlendMode: "multiply" }}>
        <Tilted frame={frame} pal={pal} width={width} height={height} part="gridDark" />
      </AbsoluteFill>
      <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.18 + pal.dotStrength * 0.35 }}>
        <Tilted frame={frame} pal={pal} width={width} height={height} part="gridDots" />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
