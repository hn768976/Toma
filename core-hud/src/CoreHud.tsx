import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { PlacedEntry, Rect, ResolvedEntry } from "./layout";
import { REGISTRY } from "./registry";
import { THEME } from "./theme";
import { buildLayout, VARIANTS } from "./variants";
import type { VariantName } from "./variants";
import { closedDrift } from "./draw/util";
import { flickerSchedule, flickeringAt } from "./draw/flicker";
import { useHudFonts } from "./fonts";
import { Grain } from "./components/Grain";

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Walks the layout array and turns each entry into a pixel rect. The anchor is
 * a property of the component, not of the entry, so mirroring a top-left
 * anchored panel reflects its box rather than pushing it off the frame.
 */
const resolveLayout = (
  entries: ResolvedEntry[],
  frameWidth: number,
  frameHeight: number,
): PlacedEntry[] => {
  const boxes = entries.map((entry) => {
    const { measure, anchor } = REGISTRY[entry.component];
    const { w, h } = measure(entry, frameWidth, frameHeight);
    let left: number;
    let top: number;

    switch (anchor) {
      case "center":
        left = entry.x * frameWidth - w / 2;
        top = entry.y * frameHeight - h / 2;
        break;
      case "topLeft":
        // Mirrored, the anchor becomes the panel's top-right corner.
        left = entry.mirrored ? entry.x * frameWidth - w : entry.x * frameWidth;
        top = entry.y * frameHeight;
        break;
      case "line":
        left = entry.x * frameWidth - w / 2;
        top = entry.y * frameHeight;
        break;
      case "span":
      default:
        left = 0;
        top = entry.y * frameHeight - h / 2;
        break;
    }

    return { ...entry, left: Math.round(left), top: Math.round(top), w, h, avoid: [] as Rect[] };
  });

  // Elements that scatter their own internals are told where their neighbours
  // sit, in their own pixel space, so nothing lands on top of a panel.
  boxes.forEach((box) => {
    if (!REGISTRY[box.component].avoidsNeighbours) {
      return;
    }
    const self: Rect = { x: box.left, y: box.top, w: box.w, h: box.h };
    box.avoid = boxes
      .filter((other) => other.id !== box.id)
      .map((other): Rect => ({ x: other.left, y: other.top, w: other.w, h: other.h }))
      .filter((rect) => overlaps(self, rect))
      .map((rect) => ({
        x: rect.x - box.left,
        y: rect.y - box.top,
        w: rect.w,
        h: rect.h,
      }));
  });

  return boxes;
};

export const CoreHud: React.FC<{ variant: VariantName }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const fontsReady = useHudFonts();
  const spec = VARIANTS[variant];

  // Text-sized panels measure themselves against the loaded face, so the layout
  // is resolved again once the fonts land. Nothing renders before that.
  const placed = useMemo(
    () => resolveLayout(buildLayout(variant), width, height),
    [variant, width, height, fontsReady],
  );

  const flicker = useMemo(
    () => flickerSchedule(placed.map((p) => p.id), `flicker-${variant}`),
    [placed, variant],
  );
  const dimmedIds = flickeringAt(flicker, frame);

  // A barely perceptible ambient drift on a closed path. Whole pixels only, so
  // the line work never resamples.
  const drift = closedDrift(frame, 6, 6, 1, 2, 0, Math.PI / 3);

  return (
    <AbsoluteFill style={{ backgroundColor: THEME.bg }}>
      <AbsoluteFill
        style={{
          transform: `translate(${Math.round(drift.dx)}px, ${Math.round(drift.dy)}px)`,
        }}
      >
        {fontsReady
          ? placed.map((entry) => {
              const { Comp } = REGISTRY[entry.component];
              return (
                <div
                  key={entry.id}
                  style={{
                    position: "absolute",
                    left: entry.left,
                    top: entry.top,
                    width: entry.w,
                    height: entry.h,
                  }}
                >
                  <Comp
                    frame={frame}
                    scale={entry.scale}
                    stroke={spec.stroke}
                    config={entry.config}
                    width={entry.w}
                    height={entry.h}
                    dimmed={dimmedIds.has(entry.id)}
                    avoid={entry.avoid}
                  />
                </div>
              );
            })
          : null}
      </AbsoluteFill>
      <Grain frame={frame} width={width} height={height} />
    </AbsoluteFill>
  );
};
