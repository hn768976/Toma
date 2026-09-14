import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import {
  ANCHOR_X,
  Camera,
  QUARTER_PX,
  planeTransform,
} from "./camera";
import {
  BAR_DOWN_BOTTOM,
  BAR_DOWN_TOP,
  BAR_UP_BOTTOM,
  BAR_UP_TOP,
  CYAN,
  CYAN_BRIGHT,
  HEAT_RAMP,
  QUARTER_LABELS,
  hash01,
  rgba,
  sampleRamp,
  yearOf,
} from "./constants";
import { SegmentText, segmentTextWidth } from "./SegmentText";

/** Fine horizontal scanlines, the CRT texture inside every solid shape. */
const SCANLINES =
  "repeating-linear-gradient(180deg, rgba(255,255,255,0.14) 0px, rgba(255,255,255,0.14) 1px, rgba(0,0,0,0.26) 1px, rgba(0,0,0,0.26) 3px)";

const Stage: React.FC<{
  readonly cam: Camera;
  readonly children: React.ReactNode;
}> = ({ cam, children }) => (
  <AbsoluteFill
    style={{
      perspective: cam.perspective,
      perspectiveOrigin: "50% 44%",
    }}
  >
    <div
      style={{
        position: "absolute",
        left: ANCHOR_X,
        top: cam.anchorY,
        width: 0,
        height: 0,
        transformOrigin: "0 0",
        transformStyle: "preserve-3d",
        transform: planeTransform(cam),
      }}
    >
      {children}
    </div>
  </AbsoluteFill>
);

/** Inclusive range of quarter indices worth drawing for this camera. */
const visibleQuarters = (cam: Camera, pad = 9) => {
  const centre = cam.scroll / QUARTER_PX;
  const span = 16 / cam.scale + pad;
  return {
    from: Math.floor(centre - span),
    to: Math.ceil(centre + span),
  };
};

// ---------------------------------------------------------------- grid

export const PerspectiveGrid: React.FC<{ readonly cam: Camera }> = ({
  cam,
}) => {
  const step = 124;
  const lines = useMemo(() => {
    const half = (2600 + 1400 / cam.scale) | 0;
    const first = Math.floor((cam.scroll - half) / step) * step;
    const last = Math.ceil((cam.scroll + half) / step) * step;
    const vertical: number[] = [];
    for (let x = first; x <= last; x += step) vertical.push(x);
    const horizontal: number[] = [];
    for (let y = -1480; y <= 1480; y += step) horizontal.push(y);
    return { vertical, horizontal, first, last };
  }, [cam.scroll, cam.scale]);

  const width = lines.last - lines.first;

  return (
    <Stage cam={cam}>
      {lines.vertical.map((x) => (
        <div
          key={`v${x}`}
          style={{
            position: "absolute",
            left: x,
            top: -1480,
            width: 1.6,
            height: 2960,
            background: rgba("#5aa8ff", 0.46),
          }}
        />
      ))}
      {lines.horizontal.map((y) => (
        <div
          key={`h${y}`}
          style={{
            position: "absolute",
            left: lines.first,
            top: y,
            width,
            height: 1.6,
            background: rgba("#5aa8ff", 0.38),
          }}
        />
      ))}
    </Stage>
  );
};

// ------------------------------------------------------------ bar field

export type BarFieldProps = {
  readonly cam: Camera;
  readonly head: number;
};

/**
 * The mirrored column chart: cool green columns climbing above the axis,
 * warm amber columns hanging below it. Each column is keyed to a quarter
 * and grows in as the playhead sweeps past it.
 */
export const BarField: React.FC<BarFieldProps> = ({ cam, head }) => {
  const { from, to } = visibleQuarters(cam);
  const bars: React.ReactNode[] = [];

  const barWidth = QUARTER_PX * 0.48;

  for (let q = Math.max(0, from); q <= to; q++) {
    if (q > head) continue;
    const grow = Math.min(1, Math.max(0, (head - q) / 0.5));
    // Ease-out-back so the columns land with a little weight.
    const e =
      grow >= 1 ? 1 : 1 - Math.pow(1 - grow, 3) * (1 - 0.18 * (1 - grow));
    const trend = q * 7.5;
    const up = Math.min(
      560,
      (0.3 + 0.62 * hash01(q, 11)) * 280 + trend + 40 * hash01(q, 29),
    );
    const down = Math.min(
      400,
      (0.28 + 0.55 * hash01(q, 43)) * 210 + trend * 0.55,
    );
    const x = q * QUARTER_PX + QUARTER_PX * 0.16;

    bars.push(
      <div
        key={`u${q}`}
        style={{
          position: "absolute",
          left: x,
          top: -124 - up * e,
          width: barWidth,
          height: up * e,
          borderRadius: 9,
          background: `linear-gradient(180deg, ${BAR_UP_TOP} 0%, ${BAR_UP_BOTTOM} 100%), ${SCANLINES}`,
          backgroundBlendMode: "multiply",
          boxShadow: `0 0 18px ${rgba("#7ff0a8", 0.32)}`,
        }}
      />,
    );
    bars.push(
      <div
        key={`d${q}`}
        style={{
          position: "absolute",
          left: x,
          top: 124,
          width: barWidth,
          height: down * e,
          borderRadius: 9,
          background: `linear-gradient(180deg, ${BAR_DOWN_TOP} 0%, ${BAR_DOWN_BOTTOM} 100%), ${SCANLINES}`,
          backgroundBlendMode: "multiply",
          boxShadow: `0 0 18px ${rgba("#ffbe5c", 0.3)}`,
        }}
      />,
    );
  }

  return <Stage cam={cam}>{bars}</Stage>;
};

// ------------------------------------------------------- axis + readout

export type AxisProps = {
  readonly cam: Camera;
  readonly head: number;
  /** True in the chevron-only version, where years burn through a heat ramp. */
  readonly heatYears: boolean;
};

export const TimelineAxis: React.FC<AxisProps> = ({ cam, head, heatYears }) => {
  const { from, to } = visibleQuarters(cam);
  const lineFrom = (from - 4) * QUARTER_PX;
  const lineTo = (to + 4) * QUARTER_PX;

  const marks: React.ReactNode[] = [];

  for (let q = Math.max(0, from); q <= to; q++) {
    const x = q * QUARTER_PX;
    const passed = head >= q;
    // A short flare as the playhead crosses each mark.
    const flare = Math.max(0, 1 - Math.abs(head - q) / 1.2);

    marks.push(
      <div
        key={`t${q}`}
        style={{
          position: "absolute",
          left: x,
          top: 0,
          width: 2.4,
          height: q % 4 === 0 ? 26 : 17,
          background: passed ? CYAN_BRIGHT : rgba("#8fd4ff", 0.45),
          boxShadow: flare > 0 ? `0 0 ${18 * flare}px ${CYAN_BRIGHT}` : undefined,
        }}
      />,
    );

    if (q % 4 === 0) {
      const year = String(yearOf(q));
      const size = 50;
      const colour = heatYears
        ? passed
          ? sampleRamp(HEAT_RAMP, q / 4)
          : rgba("#cfe6ff", 0.75)
        : passed
          ? "#f2f9ff"
          : rgba("#cfe6ff", 0.6);
      marks.push(
        <div
          key={`y${q}`}
          style={{
            position: "absolute",
            left: x - segmentTextWidth(year, size) * 0.06,
            top: 26,
          }}
        >
          <SegmentText
            size={size}
            color={colour}
            ghostColor={rgba("#5a8ec4", 0.07)}
            glow={passed ? 3 + 3 * flare : 1.5}
          >
            {year}
          </SegmentText>
        </div>,
      );
    } else {
      const label = QUARTER_LABELS[q % 4];
      const size = 29;
      marks.push(
        <div
          key={`q${q}`}
          style={{
            position: "absolute",
            left: x + 6,
            top: 34,
          }}
        >
          <SegmentText
            size={size}
            color={passed ? "#eaf6ff" : rgba("#bcd9f5", 0.5)}
            glow={passed ? 2.5 : 0}
          >
            {label}
          </SegmentText>
        </div>,
      );
    }
  }

  return (
    <Stage cam={cam}>
      <div
        style={{
          position: "absolute",
          left: lineFrom,
          top: -2.5,
          width: lineTo - lineFrom,
          height: 5,
          background: `linear-gradient(90deg, ${rgba(CYAN, 0.25)} 0%, ${CYAN} 12%, ${CYAN} 44%, ${CYAN_BRIGHT} 56%, ${CYAN} 88%, ${rgba(
            CYAN,
            0.25,
          )} 100%)`,
          boxShadow: `0 0 16px ${rgba(CYAN, 0.85)}, 0 0 44px ${rgba(CYAN, 0.45)}`,
        }}
      />
      {marks}
    </Stage>
  );
};

// ---------------------------------------------------------- chevron trail

export type ChevronTrailProps = {
  readonly cam: Camera;
  readonly head: number;
  /** 0..1 position through the shot; drives the trail's global hue shift. */
  readonly hue: string;
};

const CHEVRON_PITCH = QUARTER_PX / 2.4;
const CHEVRON_W = 108;
const CHEVRON_H = 80;
/** An open V-stroke, not a filled arrowhead: the gap between the back of
 *  one chevron and the nose of the next is what reads as motion. */
const CHEVRON_CLIP =
  "polygon(0% 0%, 34% 0%, 100% 50%, 34% 100%, 0% 100%, 66% 50%)";

export const ChevronTrail: React.FC<ChevronTrailProps> = ({
  cam,
  head,
  hue,
}) => {
  const { from, to } = visibleQuarters(cam);
  const firstIndex = Math.max(0, Math.floor((from * QUARTER_PX) / CHEVRON_PITCH));
  const lastIndex = Math.floor(
    (Math.min(to * QUARTER_PX, head * QUARTER_PX) + CHEVRON_PITCH) /
      CHEVRON_PITCH,
  );

  const items: React.ReactNode[] = [];
  for (let i = firstIndex; i <= lastIndex; i++) {
    const x = i * CHEVRON_PITCH;
    const birth = x / QUARTER_PX;
    if (birth > head) continue;
    // Pop in over roughly a sixth of a quarter as the head reaches it.
    const age = (head - birth) / 0.17;
    const pop = Math.min(1, Math.max(0, age));
    const ease = 1 - Math.pow(1 - pop, 3);
    items.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: -52 - CHEVRON_H / 2,
          width: CHEVRON_W,
          height: CHEVRON_H,
          clipPath: CHEVRON_CLIP,
          background: `linear-gradient(180deg, ${hue} 0%, ${hue} 100%), ${SCANLINES}`,
          backgroundBlendMode: "multiply",
          opacity: 0.35 + 0.65 * ease,
          transform: `translateX(${(1 - ease) * 26}px) scale(${
            0.72 + 0.28 * ease
          })`,
          transformOrigin: "50% 50%",
        }}
      />,
    );
  }

  return <Stage cam={cam}>{items}</Stage>;
};
