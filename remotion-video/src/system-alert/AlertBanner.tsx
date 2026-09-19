import { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { BANNER, FONT_FAMILY, FONT_SIZE_FRAC, PALETTE, SCANLINE_COUNT } from "./constants";
import { bannerSlices, glitchAt } from "./glitch";

/**
 * The red alert plate and its headline.
 *
 * This is DOM rather than part of the shader on purpose: text rasterised by
 * the browser stays genuinely crisp at 4K, whereas drawing type in a fragment
 * shader would mean either a texture atlas (blurry when upscaled) or signed
 * distance fields (a lot of machinery for one line of copy).
 *
 * The glitch is built from stacked copies of the same plate:
 *   - two chroma copies offset left/right in `screen` blend for the RGB split
 *   - N clipped horizontal slices displaced sideways for the tear
 * All of them are pure functions of the frame, so workers agree.
 */
export const AlertBanner: React.FC<{ headline: string; kickPx: number }> = ({
  headline,
  kickPx,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const g = glitchAt(frame);
  const slices = useMemo(() => bannerSlices(frame, g.intensity), [frame, g.intensity]);

  const bannerW = width * BANNER.widthFrac;
  const bannerH = height * BANNER.heightFrac;
  const left = width * BANNER.centerXFrac - bannerW / 2 + kickPx;
  const top = height * BANNER.centerYFrac - bannerH / 2 + height * g.jump;

  const fontSize = height * FONT_SIZE_FRAC;
  const splitPx = g.split * width;

  // Scanline period in px, derived from a fixed line count so the plate looks
  // identical at 1080p and 4K.
  const scanPeriod = height / SCANLINE_COUNT;

  const plate = (tint?: "r" | "b") => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor:
          tint === "r" ? "#FF0000" : tint === "b" ? "#0022FF" : PALETTE.bannerRed,
        backgroundImage: [
          // Vertical brightness falloff across the plate.
          `linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.20) 100%)`,
          // The fine diagonal weave visible on the reference plate.
          `repeating-linear-gradient(135deg, rgba(0,0,0,0.035) 0px, rgba(0,0,0,0.035) ${scanPeriod.toFixed(2)}px, rgba(255,255,255,0.010) ${scanPeriod.toFixed(2)}px, rgba(255,255,255,0.010) ${(scanPeriod * 2).toFixed(2)}px)`,
          // Horizontal CRT lines over the plate.
          `repeating-linear-gradient(180deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) ${(scanPeriod * 0.5).toFixed(2)}px, rgba(255,255,255,0.03) ${(scanPeriod * 0.5).toFixed(2)}px, rgba(255,255,255,0.03) ${scanPeriod.toFixed(2)}px)`,
        ].join(", "),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Brighter top edge — a thin highlight sits along the plate's top. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(1, height * 0.0022),
          backgroundColor: PALETTE.bannerEdge,
          opacity: 0.75,
        }}
      />
      <span
        style={{
          fontFamily: `"${FONT_FAMILY}", Arial, Helvetica, sans-serif`,
          fontWeight: 700,
          fontSize,
          lineHeight: 1,
          letterSpacing: fontSize * 0.005,
          color: tint ? "#FFFFFF" : PALETTE.textWhite,
          whiteSpace: "nowrap",
          // The reference headline measures 36.3% of frame width at a 5.9%
          // cap height. Arial Bold's own proportions set ~9% wider than that
          // at the same cap height, so the reference is running a condensed
          // cut. Squeezing horizontally holds both measurements, where
          // dropping the size would have matched the width but lost the
          // cap height.
          transform: "scaleX(0.912)",
          textShadow: tint
            ? "none"
            : `0 ${(height * 0.0022).toFixed(2)}px 0 rgba(90,0,12,0.55)`,
        }}
      >
        {headline}
      </span>
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: bannerW,
        height: bannerH,
        // A hard-cut frame kills the plate's colour entirely for one frame.
        filter: g.hardCut ? "invert(1) hue-rotate(180deg)" : undefined,
      }}
    >
      {/* --- Red / blue chroma copies, screened under the main plate. --- */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateX(${-splitPx * 1.0}px)`,
          mixBlendMode: "screen",
          opacity: 0.40,
        }}
      >
        {plate("r")}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateX(${splitPx * 1.0}px)`,
          mixBlendMode: "screen",
          opacity: 0.26,
        }}
      >
        {plate("b")}
      </div>

      {/* --- The plate itself. --- */}
      {plate()}

      {/*
        Displaced tear slices, drawn over the plate and clipped to its bounds.
        Without the clip, a displaced slice drags the headline out across the
        background as a white streak halfway over the frame — the reference
        keeps its tearing inside the plate.
      */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {slices.map((s, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              clipPath: `inset(${(s.top * 100).toFixed(2)}% 0% ${((1 - s.top - s.height) * 100).toFixed(2)}% 0%)`,
              transform: `translateX(${(s.offset * bannerW).toFixed(2)}px)`,
              filter:
                s.tint > 0.6 ? `hue-rotate(${((s.tint - 0.6) * 60).toFixed(1)}deg)` : undefined,
              opacity: 0.95,
            }}
          >
            {plate()}
          </div>
        ))}
      </div>

      {/* --- UI tick marks above the plate's top-left corner. --- */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -height * 0.018,
          width: Math.max(1, height * 0.0026),
          height: height * 0.018,
          backgroundColor: PALETTE.bannerRedDeep,
          opacity: 0.85,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: bannerW * 0.03,
          top: -height * 0.011,
          width: bannerW * 0.30,
          height: Math.max(1, height * 0.0026),
          backgroundColor: PALETTE.bannerRed,
          opacity: 0.55,
        }}
      />
    </div>
  );
};
