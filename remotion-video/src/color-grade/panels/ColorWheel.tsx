import React from "react";
import { HUE_WHEEL_CSS, UI } from "../constants";
import type { P } from "../cursor";

type Props = {
  /** Outer diameter of the hue ring, in plane px. */
  size: number;
  label: string;
  /** Puck position in a -1..1 square; (0,0) is neutral. */
  puck: P;
  /** Master value under the wheel, e.g. "0.580". */
  value: string;
  /** Per-channel numerals under the slider. */
  readouts?: [string, string, string, string];
  /** Lit up while the pointer is on it. */
  active?: boolean;
};

// One lift/gamma/gain/offset trackball.
//
// The ring is a conic hue gradient punched into an annulus by a radial
// mask, doubled with a blurred copy underneath. That blurred copy is the
// important half: an emissive panel photographed with a fast lens blooms,
// and without it the wheels read as flat vector art no matter how good
// the geometry is.
export const ColorWheel: React.FC<Props> = ({
  size,
  label,
  puck,
  value,
  readouts = ["0.00", "0.00", "0.00", "0.00"],
  active = false,
}) => {
  const ringMask =
    "radial-gradient(closest-side, transparent 0 54%, #000 58% 97%, transparent 100%)";
  // Keep the puck inside the dark hole rather than letting it ride out
  // over the hue ring, the way a real trackball readout behaves.
  const puckRadius = size * 0.2;
  const puckSize = size * 0.105;

  const ring: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    backgroundImage: HUE_WHEEL_CSS,
    WebkitMaskImage: ringMask,
    maskImage: ringMask,
  };

  return (
    <div style={{ width: size, position: "relative" }}>
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          marginBottom: size * 0.075,
        }}
      >
        {/* Bloom pass. */}
        <div
          style={{
            ...ring,
            filter: `blur(${size * 0.055}px) saturate(1.05)`,
            opacity: active ? 0.95 : 0.78,
            transform: "scale(1.03)",
          }}
        />
        {/* Crisp pass. */}
        <div style={{ ...ring, filter: "saturate(0.86) brightness(0.94)" }} />
        {/* Inner shading: the ring is slightly darker where it meets the
            hole, which is what gives it thickness. */}
        <div
          style={{
            ...ring,
            backgroundImage:
              "radial-gradient(closest-side, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.06) 70%, rgba(0,0,0,0) 86%, rgba(0,0,0,0.42) 100%)",
          }}
        />
        {/* The well the puck lives in. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: size * 0.56,
            height: size * 0.56,
            marginLeft: -size * 0.28,
            marginTop: -size * 0.28,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 42% 34%, #1d2935 0%, #121a23 58%, #0a0f15 100%)",
            boxShadow: `inset 0 0 ${size * 0.05}px rgba(0,0,0,0.9)`,
          }}
        />
        {/* Neutral crosshair. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: size * 0.3,
            height: 1.5,
            marginLeft: -size * 0.15,
            background: "rgba(150,180,205,0.18)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 1.5,
            height: size * 0.3,
            marginTop: -size * 0.15,
            background: "rgba(150,180,205,0.18)",
          }}
        />
        {/* Puck. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: puckSize,
            height: puckSize,
            marginLeft: -puckSize / 2 + puck.x * puckRadius,
            marginTop: -puckSize / 2 + puck.y * puckRadius,
            borderRadius: "50%",
            background: active
              ? "radial-gradient(circle at 38% 32%, #ffffff, #c8d6e2)"
              : "radial-gradient(circle at 38% 32%, #e9f1f7, #93a6b6)",
            boxShadow: `0 0 ${size * 0.05}px rgba(210,230,245,${
              active ? 0.8 : 0.45
            }), 0 ${size * 0.012}px ${size * 0.03}px rgba(0,0,0,0.8)`,
          }}
        />
      </div>

      {/* Master slider under the wheel. */}
      <div
        style={{
          position: "relative",
          height: size * 0.055,
          borderRadius: size * 0.03,
          background: "linear-gradient(#0c131a, #161f29)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.8)",
          marginBottom: size * 0.045,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: `${50 + puck.y * -26}%`,
            top: "50%",
            width: size * 0.045,
            height: size * 0.105,
            marginLeft: -size * 0.0225,
            marginTop: -size * 0.0525,
            borderRadius: size * 0.012,
            background: "linear-gradient(#c3d2de, #7b8d9c)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.75)",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: size * 0.072,
          letterSpacing: size * 0.002,
          color: UI.textDim,
          fontVariantNumeric: "tabular-nums",
          marginBottom: size * 0.03,
        }}
      >
        {readouts.map((r, i) => (
          <span key={i}>{r}</span>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            fontSize: size * 0.085,
            letterSpacing: size * 0.012,
            textTransform: "uppercase",
            color: active ? UI.textBright : UI.text,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: size * 0.082,
            color: UI.textDim,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
};
