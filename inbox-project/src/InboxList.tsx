import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  CHECKBOX_SIZE,
  COL_ENVELOPE_X,
  COL_FLAG_X,
  COL_STAR_X,
  CYCLES_RENDERED,
  CYCLE_PX,
  DURATION_IN_FRAMES,
  ENVELOPE_HEIGHT,
  ENVELOPE_WIDTH,
  FLAG_FONT_SIZE,
  FLAG_TO_SUBJECT_GAP,
  LEAD_ROWS,
  MONO_ADVANCE,
  PAD_X,
  ROWS_PER_CYCLE,
  ROW_HEIGHT,
  SEARCH_FONT_SIZE,
  SEARCH_HEIGHT,
  SEARCH_ICON_SIZE,
  SEARCH_RIGHT,
  SEARCH_X,
  SKEW_BLEED,
  SKEW_PERSPECTIVE,
  SKEW_ROTATE_Y,
  SKEW_ROTATE_Z,
  STAR_SIZE,
  SUBJECT_FONT_SIZE,
  TOOLBAR_DOTS_WIDTH,
  TOOLBAR_HEIGHT,
  TOOLBAR_TRASH_SIZE,
} from "./constants";
import type { BadgeStyle, RowSet } from "./data";
import {
  CheckboxIcon,
  DotsIcon,
  EnvelopeIcon,
  SearchIcon,
  StarIcon,
  TrashIcon,
} from "./Icons";
import { MONO_FONT_STACK, UI_FONT_STACK } from "./load-fonts";
import { THEMES, type Theme, type ThemeName } from "./theme";

export type InboxListProps = {
  rows: RowSet;
  badge: BadgeStyle;
  theme: ThemeName;
  skew: boolean;
};

/** Extra layout box around the frame; all zero for the flat compositions. */
type Bleed = { top: number; x: number; bottom: number };

const NO_BLEED: Bleed = { top: 0, x: 0, bottom: 0 };

/**
 * Width of the fixed flag column. Roboto Mono is monospaced, so the label's
 * rendered width is exactly `chars * 0.6em`; adding a constant gap keeps the
 * subject column starting the same distance after the flag for both content
 * sets, the way the references do.
 */
const flagColumnWidth = (label: string) =>
  Math.round(
    (label.length * MONO_ADVANCE * FLAG_FONT_SIZE + FLAG_TO_SUBJECT_GAP) / 2,
  ) * 2;

// ---------------------------------------------------------------------------

const Toolbar: React.FC<{ t: Theme; bleed: Bleed }> = ({ t, bleed }) => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: TOOLBAR_HEIGHT,
      background: t.page,
      borderBottom: `2px solid ${t.divider}`,
      boxSizing: "border-box",
    }}
  >
    <div
      style={{
        position: "absolute",
        left: bleed.x + PAD_X,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
      }}
    >
      <CheckboxIcon size={CHECKBOX_SIZE} color={t.icon} />
    </div>
    <div
      style={{
        position: "absolute",
        left: bleed.x + COL_STAR_X,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
      }}
    >
      <TrashIcon size={TOOLBAR_TRASH_SIZE} color={t.icon} />
    </div>
    <div
      style={{
        position: "absolute",
        left: bleed.x + COL_ENVELOPE_X,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
      }}
    >
      <DotsIcon width={TOOLBAR_DOTS_WIDTH} color={t.icon} />
    </div>
    <div
      style={{
        position: "absolute",
        left: bleed.x + SEARCH_X,
        top: "50%",
        marginTop: -SEARCH_HEIGHT / 2,
        width: SEARCH_RIGHT - SEARCH_X,
        height: SEARCH_HEIGHT,
        borderRadius: SEARCH_HEIGHT / 2,
        background: t.searchBg,
        border: `2px solid ${t.searchBorder}`,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 34,
        paddingLeft: 52,
      }}
    >
      <SearchIcon size={SEARCH_ICON_SIZE} color={t.chrome} />
      <span
        style={{
          fontFamily: UI_FONT_STACK,
          fontSize: SEARCH_FONT_SIZE,
          fontWeight: 400,
          color: t.chrome,
          lineHeight: 1,
        }}
      >
        Search
      </span>
    </div>
  </div>
);

// ---------------------------------------------------------------------------

const Row: React.FC<{
  subject: string;
  flag: string;
  flagWidth: number;
  tinted: boolean;
  badge: BadgeStyle;
  bleed: Bleed;
  t: Theme;
}> = ({ subject, flag, flagWidth, tinted, badge, bleed, t }) => {
  const bg = tinted ? t.altRow : t.page;
  return (
    <div
      style={{
        height: ROW_HEIGHT,
        boxSizing: "border-box",
        background: bg,
        borderBottom: `2px solid ${t.divider}`,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: bleed.x + PAD_X,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
        }}
      >
        <CheckboxIcon size={CHECKBOX_SIZE} color={t.icon} />
      </div>
      <div
        style={{
          position: "absolute",
          left: bleed.x + COL_STAR_X,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
        }}
      >
        <StarIcon size={STAR_SIZE} color={t.icon} />
      </div>
      <div
        style={{
          position: "absolute",
          left: bleed.x + COL_ENVELOPE_X,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
        }}
      >
        <EnvelopeIcon
          width={ENVELOPE_WIDTH}
          height={ENVELOPE_HEIGHT}
          badge={badge}
          pageColor={bg}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: bleed.x + COL_FLAG_X,
          right: bleed.x + PAD_X,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            width: flagWidth,
            flex: "0 0 auto",
            fontFamily: MONO_FONT_STACK,
            fontSize: FLAG_FONT_SIZE,
            fontWeight: 700,
            color: t.flag,
            whiteSpace: "nowrap",
            lineHeight: 1.2,
          }}
        >
          {flag}
        </span>
        <span
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            fontFamily: UI_FONT_STACK,
            fontSize: SUBJECT_FONT_SIZE,
            fontWeight: 400,
            color: t.subject,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "clip",
            lineHeight: 1.2,
          }}
        >
          {subject}
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

/**
 * The whole UI: fixed toolbar plus the scrolling strip beneath it.
 *
 * The strip holds CYCLES_RENDERED copies of the data array and is moved with a
 * single CSS translateY -- there is no real scroll container. The offset is a
 * pure function of the frame, advancing exactly CYCLE_PX (14 rows) over the
 * composition's 420 frames, so frame 420 is pixel-identical to frame 0.
 * Because 14 is even, the alternating row tint keeps its parity across the
 * wrap too, which is what makes the stripes loop as cleanly as the text.
 */
const Screen: React.FC<InboxListProps & { bleed: Bleed }> = ({
  rows,
  badge,
  theme,
  bleed,
}) => {
  const t = THEMES[theme];
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const offset = (frame / DURATION_IN_FRAMES) * CYCLE_PX;
  const flagWidth = flagColumnWidth(rows.flag);
  const boxHeight = height - bleed.top + bleed.bottom;

  const strip = useMemo(() => {
    const out: { subject: string; index: number }[] = [];
    for (let c = 0; c < CYCLES_RENDERED; c++) {
      rows.subjects.forEach((subject, i) => {
        out.push({ subject, index: c * ROWS_PER_CYCLE + i });
      });
    }
    return out;
  }, [rows]);

  return (
    <div
      style={{
        position: "absolute",
        top: bleed.top,
        left: -bleed.x,
        width: `calc(100% + ${bleed.x * 2}px)`,
        height: boxHeight,
        background: t.page,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: TOOLBAR_HEIGHT,
          left: 0,
          width: "100%",
          height: boxHeight - TOOLBAR_HEIGHT,
          // Rows are clipped at the edge of the list, never faded.
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${-LEAD_ROWS * ROW_HEIGHT - offset}px)`,
            // Deliberately no `willChange: transform` here. It promotes the
            // strip to its own composited layer, and the layer's tile grid
            // then lands differently depending on the scroll offset, which
            // shifts the antialiasing on the envelope icons by a point or
            // two. Tiny, but enough to stop frame 420 being bit-identical to
            // frame 0 -- and a perfect loop is the whole point.
          }}
        >
          {strip.map(({ subject, index }) => (
            <Row
              key={index}
              subject={subject}
              flag={rows.flag}
              flagWidth={flagWidth}
              tinted={index % 2 === 0}
              badge={badge}
              bleed={bleed}
              t={t}
            />
          ))}
        </div>
        {/* Very subtle fade band under the toolbar only. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 56,
            background: `linear-gradient(to bottom, ${t.page}, rgba(0,0,0,0))`,
            opacity: 0.55,
          }}
        />
      </div>
      <Toolbar t={t} bleed={bleed} />
    </div>
  );
};

// ---------------------------------------------------------------------------

const Skewed: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ perspective: SKEW_PERSPECTIVE }}>
    <AbsoluteFill
      style={{
        transform: `rotateY(${SKEW_ROTATE_Y}deg) rotateZ(${SKEW_ROTATE_Z}deg)`,
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </AbsoluteFill>
  </AbsoluteFill>
);

/**
 * Discrete focus falloff: three stacked copies of the same content, each with
 * its own blur, revealed in a horizontal band. Not a gradient blur -- the blur
 * radius is constant inside each slice; the mask only softens the joins so the
 * steps do not read as hard seams.
 */
const BLUR_SLICES: { blur: number; from: number; ramp: number }[] = [
  { blur: 0, from: 0, ramp: 0 },
  { blur: 9, from: 0.58, ramp: 0.06 },
  { blur: 22, from: 0.8, ramp: 0.06 },
];

export const InboxList: React.FC<InboxListProps> = (props) => {
  const t = THEMES[props.theme];

  const body = props.skew ? (
    <>
      {BLUR_SLICES.map((slice) => {
        const mask =
          slice.ramp === 0
            ? undefined
            : `linear-gradient(to bottom, rgba(0,0,0,0) ${(
                slice.from * 100
              ).toFixed(2)}%, rgba(0,0,0,1) ${(
                (slice.from + slice.ramp) *
                100
              ).toFixed(2)}%, rgba(0,0,0,1) 100%)`;
        return (
          <AbsoluteFill
            key={slice.blur}
            style={{
              filter: slice.blur === 0 ? undefined : `blur(${slice.blur}px)`,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          >
            <Skewed>
              <Screen {...props} bleed={SKEW_BLEED} />
            </Skewed>
          </AbsoluteFill>
        );
      })}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 74% 68% at 50% 40%, rgba(0,0,0,0) 52%, ${t.vignette} 100%)`,
        }}
      />
    </>
  ) : (
    <Screen {...props} bleed={NO_BLEED} />
  );

  return (
    <AbsoluteFill style={{ background: t.page, overflow: "hidden" }}>
      {body}
    </AbsoluteFill>
  );
};
