import React, { useMemo } from "react";
import { Easing, interpolate } from "remotion";
import {
  BOIL_STEP,
  CRUMPLE_SCALE,
  IN_DURATION,
  IN_STAGGER,
  IN_START,
  OUT_DURATION,
  OUT_STAGGER,
  OUT_START,
  PAPER_EDGE_COLOR,
  PAPER_EDGE_PX,
} from "./constants";
import {
  crumpleFacets,
  crumpleShape,
  lerpShape,
  rectPerimeter,
  toClipPath,
} from "./crumple";
import { RANSOM_FONTS } from "./fonts";
import { randRange } from "./random";
import type { LetterSpec } from "./words";

// `open` runs 0 (balled up) -> 1 (flat on the table) -> 0 (balled up again).
// Returns null outside the letter's life, so it is not in the DOM at all
// before it arrives or after it is swept away.
const openness = (boiled: number, col: number): number | null => {
  const inStart = IN_START + col * IN_STAGGER;
  const inEnd = inStart + IN_DURATION;
  const outStart = OUT_START + col * OUT_STAGGER;
  const outEnd = outStart + OUT_DURATION;

  if (boiled < inStart || boiled >= outEnd) return null;
  if (boiled < inEnd) {
    return interpolate(boiled, [inStart, inEnd], [0, 1], {
      easing: Easing.bezier(0.62, 0, 0.2, 1),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  if (boiled < outStart) return 1;
  return interpolate(boiled, [outStart, outEnd], [1, 0], {
    easing: Easing.bezier(0.8, 0, 0.38, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

export const RansomLetter: React.FC<{
  spec: LetterSpec;
  seed: number;
  frame: number;
}> = ({ spec, seed, frame }) => {
  // Quantise to the stop-motion cadence. Doing this once, here, is what puts
  // the whole piece on 3s — the unfold, the drift and the jitter all step
  // together like frames of a physical shoot.
  const boiled = Math.floor(frame / BOIL_STEP) * BOIL_STEP;
  const pose = Math.floor(frame / BOIL_STEP);

  const flat = useMemo(() => rectPerimeter(), []);
  const wad = useMemo(() => crumpleShape(seed), [seed]);

  const open = openness(boiled, spec.col);

  const shape = useMemo(
    () => (open === null ? null : lerpShape(wad, flat, open)),
    [wad, flat, open],
  );
  const facets = useMemo(
    () => (shape === null ? [] : crumpleFacets(seed, shape)),
    [seed, shape],
  );

  if (open === null || shape === null) return null;

  const clipPath = toClipPath(shape);

  // Scale overshoots slightly as the sheet springs open, then settles.
  const scale =
    CRUMPLE_SCALE +
    (1 - CRUMPLE_SCALE) *
      interpolate(open, [0, 1], [0, 1], {
        easing: Easing.out(Easing.back(1.1)),
      });

  // While balled up the letter is spun and thrown off its mark; both resolve
  // as it opens.
  const spin = randRange(seed * 53, -58, 58);
  const offX = randRange(seed * 97, -46, 46);
  const offY = randRange(seed * 181, -52, 30);

  // Per-pose jitter — the paper never lands in exactly the same spot twice
  // under the camera. Runs through the hold too, so nothing is ever frozen.
  const jx = randRange(seed * 7 + pose * 31, -1.7, 1.7);
  const jy = randRange(seed * 11 + pose * 37, -1.7, 1.7);
  const jr = randRange(seed * 17 + pose * 43, -0.38, 0.38);

  const closed = 1 - open;
  const tx = offX * closed + jx;
  const ty = offY * closed + jy;
  const rot = spec.rot + spin * closed + jr;

  // The glyph itself sits a hair off-axis inside its tile: a magazine letter
  // is never scissored perfectly square to its own baseline.
  const glyphRot = randRange(seed * 211, -1.6, 1.6);

  const fontFamily = RANSOM_FONTS[spec.font];
  const fontSize = spec.h * spec.size;
  const glyphStyle: React.CSSProperties = {
    fontFamily,
    fontSize,
    lineHeight: 1,
    whiteSpace: "pre",
    transform: `translateY(${spec.dy * spec.h}px) rotate(${glyphRot}deg)`,
  };

  return (
    <div
      style={{
        position: "absolute",
        left: spec.x,
        top: spec.y,
        width: spec.w,
        height: spec.h,
        transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${scale})`,
        transformOrigin: "center center",
      }}
    >
      {/* Scissored paper edge: the white core of the page, showing just
          proud of the printed tile on every side. */}
      <div
        style={{
          position: "absolute",
          inset: -PAPER_EDGE_PX,
          background: PAPER_EDGE_COLOR,
          clipPath,
        }}
      />

      {/* The printed tile. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: spec.tile,
          clipPath,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {spec.halo ? (
          <span
            style={{
              ...glyphStyle,
              position: "absolute",
              color: spec.halo,
              WebkitTextStroke: `${spec.h * 0.055}px ${spec.halo}`,
            }}
          >
            {spec.char}
          </span>
        ) : null}
        <span
          style={{
            ...glyphStyle,
            position: "absolute",
            color: spec.strokeOnly ? "transparent" : spec.ink,
            WebkitTextStroke: spec.strokeOnly
              ? `${spec.h * 0.03}px ${spec.strokeOnly}`
              : undefined,
          }}
        >
          {spec.char}
        </span>

        {/* A wad of magazine shows mostly the blank reverse of the page —
            the printed face only comes back as the sheet flattens out. */}
        {closed > 0.01 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: PAPER_EDGE_COLOR,
              opacity: closed * 0.62,
            }}
          />
        ) : null}

        {/* Uneven ink/paper sheen so the tile is not a dead flat fill. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(125% 125% at 28% 18%, rgba(255,255,255,0.10), rgba(0,0,0,0.12))",
            mixBlendMode: "overlay",
          }}
        />
      </div>

      {/* Creases, only while the sheet is still bunched up. */}
      {closed > 0.01
        ? facets.map((f, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                background: f.color,
                clipPath: f.clipPath,
                opacity: Math.min(1, closed * 1.35),
              }}
            />
          ))
        : null}
    </div>
  );
};
