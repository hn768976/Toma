import React, { useMemo } from "react";
import { HUD_COUNT, SPREAD_X, SPREAD_Y, Z_SPAN } from "./constants";
import { defocusAt, depthAt, depthFade, place } from "./depth";
import type { Palette } from "./palette";
import { between, rngFor } from "./random";

type HudKind = "frame" | "rule" | "cross" | "bracket";

type HudItem = {
  kind: HudKind;
  x: number;
  y: number;
  z0: number;
  w: number;
  h: number;
  dashed: boolean;
  weight: number;
};

const buildHud = (): HudItem[] =>
  Array.from({ length: HUD_COUNT }, (_, i) => {
    const rand = rngFor(i, 5503);
    const roll = rand();
    const kind: HudKind =
      roll < 0.34 ? "frame" : roll < 0.66 ? "rule" : roll < 0.85 ? "bracket" : "cross";
    return {
      kind,
      x: between(rand, -SPREAD_X, SPREAD_X),
      y: between(rand, -SPREAD_Y, SPREAD_Y),
      z0: rand() * Z_SPAN,
      w:
        kind === "rule"
          ? between(rand, 2200, 6000)
          : kind === "cross"
            ? between(rand, 40, 90)
            : between(rand, 420, 1500),
      h: kind === "rule" ? 2 : kind === "cross" ? between(rand, 40, 90) : between(rand, 240, 900),
      dashed: rand() < 0.55,
      weight: between(rand, 0.3, 0.85),
    };
  });

const HudShape: React.FC<{ item: HudItem; palette: Palette }> = ({
  item,
  palette,
}) => {
  if (item.kind === "rule") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: item.dashed
            ? `repeating-linear-gradient(90deg, ${palette.hud} 0 14px, rgba(0,0,0,0) 14px 34px)`
            : palette.hud,
        }}
      />
    );
  }

  if (item.kind === "cross") {
    return (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <path
          d="M50 8 V92 M8 50 H92"
          stroke={palette.hud}
          strokeWidth="6"
          fill="none"
        />
      </svg>
    );
  }

  if (item.kind === "bracket") {
    // Corner ticks only — the reading-frame look, without a full box.
    return (
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
        <path
          d="M0 18 V0 H22 M78 0 H100 V18 M100 82 V100 H78 M22 100 H0 V82"
          stroke={palette.hud}
          strokeWidth="1.6"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: `2px ${item.dashed ? "dashed" : "solid"} ${palette.hud}`,
      }}
    />
  );
};

/** Scattered interface furniture: frames, rules, crosshairs, brackets. */
export const Hud: React.FC<{ palette: Palette; camZ: number }> = ({
  palette,
  camZ,
}) => {
  const items = useMemo(buildHud, []);

  return (
    <>
      {items.map((item, i) => {
        const z = depthAt(item.z0, camZ);
        const fade = depthFade(z);
        if (fade <= 0.004) return null;
        const blur = defocusAt(z);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: item.w,
              height: item.h,
              marginLeft: -item.w / 2,
              marginTop: -item.h / 2,
              transform: place(item.x, item.y, z),
              opacity: fade * item.weight,
              filter: blur > 0 ? `blur(${blur.toFixed(2)}px)` : undefined,
            }}
          >
            <HudShape item={item} palette={palette} />
          </div>
        );
      })}
    </>
  );
};
