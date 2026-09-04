import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  FIELD,
  Z_FAR,
  blurAt,
  depthAt,
  depthT,
  fontSizeAt,
  glowAt,
  opacityAt,
  weightAt,
} from "./field";
import { Grain } from "./Grain";
import { FONT_FAMILY } from "./load-fonts";
import { Vignette } from "./Vignette";
import { Theme, colourAt } from "./themes";

/** Rough advance width of Inter uppercase, per character, in em. Only used to
 *  cull words that have travelled off the sides - never for layout. */
const EM_PER_CHAR = 0.66;

/** Lateral float, as a fraction of the frame. One sine cycle per loop, so it
 *  is seamless, and small enough to just take the rail-mounted feel off. */
const FLOAT_X = 0.01;
const FLOAT_Y = 0.007;

export const WordCloud: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // The camera advances exactly one layer-spacing cycle over the composition,
  // linearly, and the field recycles on the same period - so the last frame
  // hands straight back to the first.
  const phase = (frame % durationInFrames) / durationInFrames;
  const floatX = Math.sin(phase * Math.PI * 2) * width * FLOAT_X;
  const floatY = Math.cos(phase * Math.PI * 2) * height * FLOAT_Y;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${floatX}px, ${floatY}px)` }}>
        {FIELD.map((instance, index) => {
          const z = depthAt(instance, phase);
          const t = depthT(z);
          const opacity = opacityAt(t);
          if (opacity < 0.004) {
            return null;
          }

          // Pinhole projection: scale is 1 / z, and the font size is written
          // in absolute px so the glyph is rasterised at its final size.
          const fontSize = fontSizeAt(instance, z, width);
          const left = width / 2 + (instance.x * width) / z;
          const top = height / 2 + (instance.y * width) / z;

          const halfWidth = instance.word.length * EM_PER_CHAR * fontSize * 0.5;
          if (
            left + halfWidth < -width * 0.05 ||
            left - halfWidth > width * 1.05 ||
            top + fontSize < -height * 0.05 ||
            top - fontSize > height * 1.05
          ) {
            return null;
          }

          const weight = weightAt(t, instance.weightBias);
          const blur = blurAt(z, width);
          const [r, g, b] = colourAt(t, theme.colourStops);
          const glow = theme.glow ? glowAt(t) : 0;

          return (
            <span
              key={index}
              style={{
                position: "absolute",
                left,
                top,
                transform: "translate(-50%, -50%)",
                fontFamily: `"${FONT_FAMILY}", "Helvetica Neue", Helvetica, Arial, sans-serif`,
                fontSize,
                fontWeight: weight,
                fontVariationSettings: `"wght" ${weight}`,
                letterSpacing: "-0.022em",
                lineHeight: 1,
                whiteSpace: "nowrap",
                color: `rgb(${r}, ${g}, ${b})`,
                opacity,
                filter: blur > 0 ? `blur(${blur}px)` : "none",
                textShadow:
                  glow > 0
                    ? `0 0 ${fontSize * 0.12}px rgba(${theme.glowColour}, ${(
                        glow * 0.22
                      ).toFixed(3)})`
                    : undefined,
                zIndex: Math.round((Z_FAR - z) * 1000),
              }}
            >
              {instance.word}
            </span>
          );
        })}
      </AbsoluteFill>
      <Vignette strength={theme.vignette} />
      <Grain opacity={theme.grain} />
    </AbsoluteFill>
  );
};
