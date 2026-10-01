import { useCurrentFrame, useVideoConfig } from "remotion";
import { CHIP_RADIUS, CHIP_SIZE, DESIGN_WIDTH, RING_RADIUS } from "./constants";
import { CHIP_FONT_FAMILY } from "./load-font";
import { FlowPalette, hexToRgb, rgba } from "./palettes";
import { LOOP_FRAMES } from "./streams";

export const AiChip: React.FC<{ palette: FlowPalette; label: string }> = ({
  palette,
  label,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const k = width / DESIGN_WIDTH;
  const loopT = (frame % LOOP_FRAMES) / LOOP_FRAMES;
  const TAU = Math.PI * 2;

  // Soft "processing" pulse: 6 beats per loop.
  const pulse = 0.5 + 0.5 * Math.sin(TAU * 6 * loopT);
  const glow = hexToRgb(palette.chipGlow);
  const ring = hexToRgb(palette.ring);
  const size = CHIP_SIZE * k;
  const r = RING_RADIUS;

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* Halo behind the chip */}
      <div
        style={{
          position: "absolute",
          left: width / 2 - 260 * k,
          top: height / 2 - 260 * k,
          width: 520 * k,
          height: 520 * k,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${rgba(glow, 0.16 + 0.06 * pulse)} 0%, ${rgba(glow, 0.05)} 35%, ${rgba(glow, 0)} 70%)`,
        }}
      />
      {/* Dashed orbit rings; dash pattern repeats so rotation loops cleanly */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${DESIGN_WIDTH} ${(DESIGN_WIDTH * height) / width}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <g transform={`translate(${DESIGN_WIDTH / 2} ${(DESIGN_WIDTH * height) / width / 2})`}>
          <circle
            r={r}
            fill="none"
            stroke={rgba(ring, 0.22)}
            strokeWidth={1.4}
            strokeDasharray="2 7"
            transform={`rotate(${loopT * 360})`}
          />
          <circle
            r={r * 0.78}
            fill="none"
            stroke={rgba(ring, 0.12)}
            strokeWidth={1}
            strokeDasharray={`${TAU * r * 0.78 * 0.18} ${TAU * r * 0.78 * 0.07}`}
            transform={`rotate(${-loopT * 360})`}
          />
        </g>
      </svg>
      {/* Chip */}
      <div
        style={{
          position: "absolute",
          left: width / 2 - size / 2,
          top: height / 2 - size / 2,
          width: size,
          height: size,
          boxSizing: "border-box",
          borderRadius: CHIP_RADIUS * k,
          background: palette.chipFill,
          border: `${3 * k}px solid ${palette.chipBorder}`,
          boxShadow: [
            `0 0 ${(14 + 6 * pulse) * k}px ${rgba(glow, 0.9)}`,
            `0 0 ${(40 + 14 * pulse) * k}px ${rgba(glow, 0.45)}`,
            `inset 0 0 ${16 * k}px ${rgba(glow, 0.35)}`,
          ].join(", "),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: CHIP_FONT_FAMILY,
          fontWeight: 700,
          fontSize: 48 * k,
          letterSpacing: 1 * k,
          color: palette.chipText,
          textShadow: `0 0 ${10 * k}px ${rgba(glow, 0.8)}`,
        }}
      >
        {label}
      </div>
    </div>
  );
};
