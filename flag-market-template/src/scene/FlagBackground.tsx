import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { DURATION } from "../constants";
import { Country } from "../countries";
import { FlagSvg } from "../flags";

const OVERSCAN = 0.04; // flag box is 4% larger than the frame so drift never shows an edge

/** Cover-crop the flag into the (overscanned) frame, keeping `focus` at `anchor`. */
export const flagLayout = (country: Country, W: number, H: number) => {
  const bw = W * (1 + OVERSCAN);
  const bh = H * (1 + OVERSCAN);
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2;
  const s = Math.max(bw / country.flag.width, bh / country.flag.height) * (country.zoom ?? 1);
  const fw = country.flag.width * s;
  const fh = country.flag.height * s;
  const anchor = country.anchor ?? country.focus;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const left = clamp(anchor.x * W - country.focus.x * fw, bx + bw - fw, bx);
  const top = clamp(anchor.y * H - country.focus.y * fh, by + bh - fh, by);
  return { left, top, width: fw, height: fh, anchor };
};

/** Slow push-in (~8%) with a slight drift, as a 2D transform. */
export const useCamera = (anchor: { x: number; y: number }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const t = frame / DURATION;
  const scale = interpolate(t, [0, 1], [1, 1.08], { easing: Easing.inOut(Easing.sin) });
  const dx = (Math.sin(t * Math.PI * 0.9) * 0.006 - t * 0.004) * W;
  const dy = Math.sin(t * Math.PI * 1.3) * 0.004 * H;
  return {
    transform: `translate(${dx.toFixed(3)}px, ${dy.toFixed(3)}px) scale(${scale.toFixed(5)})`,
    transformOrigin: `${(anchor.x * 100).toFixed(2)}% ${(anchor.y * 100).toFixed(2)}%`,
  };
};

// Cosine-shaped diagonal band: light crest, dark trough, period `p` px,
// travelling by `shift` px along the gradient axis. Built from many stops so
// there is no visible kink (a 3-stop triangle wave shows Mach bands). The
// motion is a phase offset of the stops — NOT background-position, which
// would slide the element-sized tile and leave a visible seam.
const bands = (angle: number, p: number, light: number, dark: number, shift: number) => {
  const phase = ((shift % p) + p) % p;
  const stops: string[] = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const c = Math.cos((i / N) * Math.PI * 2); // 1 → -1 → 1
    const col =
      c >= 0
        ? `rgba(255,255,255,${(light * c).toFixed(4)})`
        : `rgba(0,0,0,${(-dark * c).toFixed(4)})`;
    stops.push(`${col} ${((i / N) * p - phase).toFixed(2)}px`);
  }
  return `repeating-linear-gradient(${angle}deg, ${stops.join(", ")})`;
};

export const FlagBackground: React.FC<{ country: Country; dim: number; hide?: string[] }> = ({
  country,
  dim,
  hide = [],
}) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = H / 2160;
  const box = flagLayout(country, W, H);

  // Cloth ripple: two slow diagonal light/shadow band sets, scrolling.
  const shift1 = frame * 2.4 * u;
  const shift2 = -frame * 1.5 * u;
  const p1 = 1300 * u;
  const p2 = 2100 * u;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: box.left, top: box.top, width: box.width, height: box.height }}>
        <FlagSvg flag={country.flag} />
      </div>
      {hide.includes("ripple") ? null : (
        <AbsoluteFill
          style={{
            backgroundImage: `${bands(122, p1, 0.07, 0.15, shift1)}, ${bands(138, p2, 0.0, 0.1, shift2)}`,
          }}
        />
      )}
      {/* darken to ~60% brightness */}
      <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${dim})` }} />
      {/* fine scanlines */}
      {hide.includes("scanlines") ? null : (
        <AbsoluteFill
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) ${3 * u}px, rgba(0,0,0,0) ${3 * u}px, rgba(0,0,0,0) ${9 * u}px)`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse 72% 78% at 50% 50%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.22) 62%, rgba(0,0,0,0.5) 84%, rgba(0,0,0,0.72) 100%)",
    }}
  />
);
