import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { COUNTRIES } from "./countries";
import { FlagSvg } from "./flags";
import { INTER } from "./load-fonts";

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const ratio = (h: number, w: number) => `${h / gcd(h, w)}:${w / gcd(h, w)}`;

// Contact sheet: every flag drawn alone, uncropped, at its official ratio.
export const FlagSheet: React.FC = () => {
  const { width: W, height: H } = useVideoConfig();
  const cols = 5;
  const rows = Math.ceil(COUNTRIES.length / cols);
  const cellW = W / cols;
  const cellH = H / rows;
  const boxW = cellW * 0.86;
  const boxH = cellH * 0.62;
  return (
    <AbsoluteFill style={{ backgroundColor: "#6E737A" }}>
      {COUNTRIES.map((c, i) => {
        const s = Math.min(boxW / c.flag.width, boxH / c.flag.height);
        const fw = c.flag.width * s;
        const fh = c.flag.height * s;
        const cx = (i % cols) * cellW + cellW / 2;
        const cy = Math.floor(i / cols) * cellH + cellH * 0.44;
        return (
          <React.Fragment key={c.id}>
            <div style={{ position: "absolute", left: cx - fw / 2, top: cy - fh / 2, width: fw, height: fh }}>
              <FlagSvg flag={c.flag} />
            </div>
            <div
              style={{
                position: "absolute",
                left: cx - cellW / 2,
                width: cellW,
                top: cy + boxH / 2 + H * 0.025,
                textAlign: "center",
                fontFamily: INTER,
                fontWeight: 600,
                fontSize: H * 0.026,
                color: "#FFFFFF",
              }}
            >
              {c.name} · {ratio(c.flag.height, c.flag.width)}
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// A single flag, uncropped, filling its own frame (for spec checks).
export const FlagAlone: React.FC<{ countryId: string }> = ({ countryId }) => {
  const c = COUNTRIES.find((x) => x.id === countryId);
  if (!c) throw new Error(`Unknown country ${countryId}`);
  return (
    <AbsoluteFill>
      <FlagSvg flag={c.flag} />
    </AbsoluteFill>
  );
};
