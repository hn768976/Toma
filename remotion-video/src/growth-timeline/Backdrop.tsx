import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { BACKGROUND_COLOR, rgba } from "./constants";

export type BackdropProps = {
  /** Horizontal parallax of the map, in design px. */
  readonly pan: number;
  readonly mapScale: number;
  /** 0..1 vertical parallax, fraction of frame height. */
  readonly drift: number;
  readonly blur: number;
};

/**
 * The world map sits behind everything, frontal (it is not part of the
 * tilted plane) and heavily out of focus, lit by a broad blue key from
 * the right. Land is baked dark into the SVG and relit here with screen-
 * blended gradients, which is what gives Africa and Asia the milky blue
 * cast while the Pacific stays near-black.
 */
export const Backdrop: React.FC<BackdropProps> = ({
  pan,
  mapScale,
  drift,
  blur,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND_COLOR }}>
      <AbsoluteFill
        style={{
          filter: `blur(${blur}px)`,
          transform: `translate(${pan}px, ${drift}px) scale(${mapScale})`,
        }}
      >
        {/* Ocean: a pale steel plate the dark land reads against. */}
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(116deg, #061024 0%, #13294e 22%, #315f95 46%, #5686bb 64%, #26456f 84%, #0a1631 100%)",
          }}
        />
        <Img
          src={staticFile("world-land.svg")}
          style={{
            position: "absolute",
            left: "-16%",
            top: "-6%",
            width: "132%",
            height: "112%",
            objectFit: "fill",
          }}
        />
        {/* Key light: a wide blue wash that lifts the centre-right. */}
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse 62% 74% at 66% 46%, rgba(62,134,222,0.55) 0%, rgba(24,68,142,0.3) 44%, rgba(8,20,48,0) 78%)",
            mixBlendMode: "screen",
          }}
        />
        {/* Cool fill from the lower left so the frame never goes flat. */}
        <AbsoluteFill
          style={{
            background:
              "radial-gradient(ellipse 58% 66% at 14% 88%, rgba(18,56,120,0.32) 0%, rgba(6,16,40,0) 72%)",
            mixBlendMode: "screen",
          }}
        />
      </AbsoluteFill>

      {/* Contrast crush + vignette, on top of the blur so the corners
          stay dense no matter where the map has drifted to. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 74% 82% at 50% 48%, rgba(0,0,0,0) 38%, ${rgba(
            "#03081a",
            0.62,
          )} 78%, ${rgba("#01040f", 0.9)} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${rgba(
            "#02060f",
            0.55,
          )} 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 72%, ${rgba(
            "#02060f",
            0.6,
          )} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
