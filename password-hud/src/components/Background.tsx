import React from "react";
import { useCurrentFrame } from "remotion";
import { mixRgb, rgba, type Rgb } from "../lib/color";
import { COLORS, DESIGN_HEIGHT, DESIGN_WIDTH, DOF_SLICES, FONTS, PLANE } from "../lib/design";
import { intRange, mulberry32, pick, range, type Rng } from "../lib/random";
import { useScale } from "../lib/useScale";

/**
 * Texture, not content. The glyph pool is deliberately meaningless — no words,
 * no paths, no hostnames, nothing that reads as a real system at any zoom.
 */
const GLYPHS = "0123456789ABCDEF/\\<>=+*:;.-_[]{}()";

type CodeRow = { kind: "code"; x: number; y: number; tokens: string[]; size: number; opacity: number; accent: boolean };
type Block = { kind: "block"; x: number; y: number; w: number; h: number; bars: number[]; opacity: number; accent: boolean };
type Digits = { kind: "digits"; x: number; y: number; text: string; size: number; opacity: number; accent: boolean };
type Dot = { kind: "dot"; x: number; y: number; r: number; opacity: number; accent: boolean };
type Line = { kind: "line"; x: number; y: number; length: number; vertical: boolean; opacity: number; accent: boolean };
type Item = CodeRow | Block | Digits | Dot | Line;

const word = (rng: Rng, len: number) =>
  Array.from({ length: len }, () => pick(rng, GLYPHS.split(""))).join("");

/** Items are laid out past the frame edges so the slow drift never exposes one. */
const BOUNDS = {
  x: [-700, DESIGN_WIDTH + 700],
  y: [-560, DESIGN_HEIGHT + 560],
} as const;

const buildSlice = (rng: Rng, sliceIndex: number): Item[] => {
  const items: Item[] = [];
  const near = sliceIndex === 0;
  const density = near ? 0.7 : 1;
  const px = (n: number) => Math.round(n * density);

  for (let i = 0; i < px(26); i += 1) {
    items.push({
      kind: "code",
      x: range(rng, BOUNDS.x[0], BOUNDS.x[1] - 900),
      y: range(rng, BOUNDS.y[0], BOUNDS.y[1]),
      tokens: Array.from({ length: intRange(rng, 3, 8) }, () => word(rng, intRange(rng, 2, 8))),
      size: range(rng, 22, 40),
      opacity: range(rng, 0.3, 0.72),
      accent: rng() < 0.24,
    });
  }
  for (let i = 0; i < px(17); i += 1) {
    const w = range(rng, 90, 260);
    items.push({
      kind: "block",
      x: range(rng, BOUNDS.x[0], BOUNDS.x[1] - w),
      y: range(rng, BOUNDS.y[0], BOUNDS.y[1]),
      w,
      h: range(rng, 46, 130),
      bars: Array.from({ length: intRange(rng, 2, 4) }, () => range(rng, 0.25, 0.95)),
      opacity: range(rng, 0.26, 0.6),
      accent: rng() < 0.24,
    });
  }
  for (let i = 0; i < px(48); i += 1) {
    items.push({
      kind: "digits",
      x: range(rng, BOUNDS.x[0], BOUNDS.x[1]),
      y: range(rng, BOUNDS.y[0], BOUNDS.y[1]),
      text: word(rng, intRange(rng, 1, 4)),
      size: range(rng, 20, 46),
      opacity: range(rng, 0.26, 0.64),
      accent: rng() < 0.22,
    });
  }
  for (let i = 0; i < px(26); i += 1) {
    items.push({
      kind: "dot",
      x: range(rng, BOUNDS.x[0], BOUNDS.x[1]),
      y: range(rng, BOUNDS.y[0], BOUNDS.y[1]),
      r: range(rng, 3, 8),
      opacity: range(rng, 0.45, 1),
      accent: rng() < 0.3,
    });
  }
  for (let i = 0; i < px(13); i += 1) {
    const vertical = rng() < 0.42;
    items.push({
      kind: "line",
      x: range(rng, BOUNDS.x[0], BOUNDS.x[1]),
      y: range(rng, BOUNDS.y[0], BOUNDS.y[1]),
      length: vertical ? range(rng, 300, 900) : range(rng, 400, 1400),
      vertical,
      opacity: range(rng, 0.14, 0.34),
      accent: rng() < 0.18,
    });
  }
  return items;
};

/** Built once, from a fixed seed: identical on every frame, thread and render. */
const SLICES: Item[][] = (() => {
  const rng = mulberry32(0x4d5a11);
  return DOF_SLICES.map((_, index) => buildSlice(rng, index));
})();

const ItemView: React.FC<{ item: Item; tint: Rgb; accentTint: Rgb; px: (v: number) => number }> = ({
  item,
  tint,
  accentTint,
  px,
}) => {
  const color = item.accent ? accentTint : tint;
  const base: React.CSSProperties = {
    position: "absolute",
    left: px(item.x),
    top: px(item.y),
  };

  if (item.kind === "code") {
    return (
      <div
        style={{
          ...base,
          display: "flex",
          gap: px(item.size * 0.9),
          fontFamily: FONTS.mono,
          fontSize: px(item.size),
          letterSpacing: px(item.size * 0.08),
          color: rgba(color, item.opacity),
          whiteSpace: "nowrap",
        }}
      >
        {item.tokens.map((token, i) => (
          <span key={i}>{token}</span>
        ))}
      </div>
    );
  }

  if (item.kind === "block") {
    return (
      <div
        style={{
          ...base,
          width: px(item.w),
          height: px(item.h),
          border: `${px(2)}px solid ${rgba(color, item.opacity)}`,
          padding: px(10),
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-around",
        }}
      >
        {item.bars.map((bar, i) => (
          <div
            key={i}
            style={{
              width: `${bar * 100}%`,
              height: px(6),
              background: rgba(color, item.opacity * 0.8),
            }}
          />
        ))}
      </div>
    );
  }

  if (item.kind === "digits") {
    return (
      <div
        style={{
          ...base,
          fontFamily: FONTS.mono,
          fontSize: px(item.size),
          letterSpacing: px(item.size * 0.14),
          color: rgba(color, item.opacity),
          whiteSpace: "nowrap",
        }}
      >
        {item.text}
      </div>
    );
  }

  if (item.kind === "dot") {
    return (
      <div
        style={{
          ...base,
          width: px(item.r * 2),
          height: px(item.r * 2),
          borderRadius: "50%",
          background: rgba(color, item.opacity),
          boxShadow: `0 0 ${px(item.r * 5)}px ${rgba(color, item.opacity * 0.7)}`,
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...base,
        width: item.vertical ? px(1.5) : px(item.length),
        height: item.vertical ? px(item.length) : px(1.5),
        background: rgba(color, item.opacity),
      }}
    />
  );
};

export const Background: React.FC<{ accent: number; accentColor: Rgb }> = ({ accent, accentColor }) => {
  const frame = useCurrentFrame();
  const px = useScale();

  const tint = COLORS.hud;
  const accentTint = mixRgb(COLORS.hud, accentColor, accent);

  return (
    <>
      {DOF_SLICES.map((slice, index) => {
        // Keep every slice the same apparent size despite its depth, and give
        // the nearer ones a touch more drift so the field parallaxes.
        const sizeCompensation = (PLANE.perspective - slice.z) / PLANE.perspective;
        const speed = 1.55 - index * 0.3;
        const dx = -frame * 0.1 * speed;
        const dy = -frame * 0.038 * speed;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              inset: 0,
              opacity: slice.opacity,
              filter: slice.blur ? `blur(${px(slice.blur)}px)` : undefined,
              transform: `translateZ(${px(slice.z)}px) scale(${sizeCompensation}) translate(${px(
                dx,
              )}px, ${px(dy)}px)`,
            }}
          >
            {SLICES[index].map((item, i) => (
              <ItemView key={i} item={item} tint={tint} accentTint={accentTint} px={px} />
            ))}
          </div>
        );
      })}
    </>
  );
};
