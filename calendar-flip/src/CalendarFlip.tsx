import React, {useEffect, useMemo, useState} from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {CARD, COLORS} from "./theme";
import type {WeekStart} from "./calendar";
import {ensureFonts} from "./fonts";
import {getPageBitmap} from "./monthPage";
import {renderCard} from "./renderCard";
import {beatAt, MONTHS_PER_YEAR} from "./timing";

export type CalendarFlipProps = {
  year: number;
  weekStart: WeekStart;
};

export const CalendarFlip: React.FC<CalendarFlipProps> = ({year, weekStart}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const [fontsReady, setFontsReady] = useState(false);
  const [fontHandle] = useState(() => delayRender("Loading Inter"));
  useEffect(() => {
    ensureFonts().then(() => {
      setFontsReady(true);
      continueRender(fontHandle);
    });
  }, [fontHandle]);

  const card = useMemo(() => {
    const cardWidth = Math.round(width * CARD.widthFraction);
    const cardHeight = Math.round(cardWidth / CARD.aspect);
    return {
      x: Math.round((width - cardWidth) / 2),
      y: Math.round((height - cardHeight) / 2 - height * CARD.liftFraction),
      width: cardWidth,
      height: cardHeight,
    };
  }, [width, height]);

  const {monthIndex, flipProgress, sinceLanding} = beatAt(frame);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawHandle = useMemo(
    () => delayRender(`Painting frame ${frame}`),
    [frame],
  );

  useEffect(() => {
    if (!fontsReady) {
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", {willReadFrequently: true});
    if (!canvas || !ctx) {
      continueRender(drawHandle);
      return;
    }

    const page = (month: number) =>
      getPageBitmap({
        year,
        month,
        weekStart,
        width: card.width,
        height: card.height,
      });

    renderCard({
      ctx,
      card,
      top: page(monthIndex),
      next: page((monthIndex + 1) % MONTHS_PER_YEAR),
      progress: flipProgress,
    });

    continueRender(drawHandle);
  }, [drawHandle, fontsReady, card, monthIndex, flipProgress, year, weekStart]);

  // A page landing settles by a hair. Barely visible, but it is the difference
  // between paper and a slideshow.
  const settle = interpolate(sinceLanding, [0, 4], [1.002, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.background}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${width * 0.55}px ${
            height * 0.6
          }px at 50% 46%, ${COLORS.backgroundGlow} 0%, ${
            COLORS.background
          } 78%)`,
        }}
      />
      <AbsoluteFill
        style={{
          transform: `scale(${settle})`,
          transformOrigin: `${card.x + card.width / 2}px ${
            card.y + card.height / 2
          }px`,
        }}
      >
        {/* Paper reads as paper because of two stacked shadows, not one blur. */}
        <div
          style={{
            position: "absolute",
            left: card.x,
            top: card.y,
            width: card.width,
            height: card.height,
            backgroundColor: COLORS.card,
            boxShadow: `${width * 0.0028}px ${width * 0.0045}px ${
              width * 0.011
            }px rgba(0,0,0,0.13), ${width * 0.008}px ${width * 0.016}px ${
              width * 0.055
            }px rgba(0,0,0,0.09)`,
          }}
        />
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{position: "absolute", inset: 0, width, height}}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
