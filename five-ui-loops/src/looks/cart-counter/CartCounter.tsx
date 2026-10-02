// Look 2 — Cart Counter. 2.5D header bar at an angle, right side farther away,
// shallow depth of field, slow camera slide. Generic shop, no store name.
import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CartCounterVersion } from "../../versions";
import { INTER } from "../../lib/fonts";
import { rgba } from "../../lib/color";
import { BellIcon, CartIcon, HeartIcon, SearchIcon, UserIcon } from "./Icons";
import { Odometer } from "./Odometer";
import { countCurve, displayedCount, priceAt, tickFrame, totals } from "./counter";

const WORLD_W = 7400;
const WORLD_H = 3000;
const BAR_TOP = 900;
const BAR_H = 1200;

const World: React.FC<{ v: CartCounterVersion; frame: number }> = ({ v, frame }) => {
  const cf = countCurve(frame, v.finalCount);
  const count = displayedCount(cf);
  const cents = priceAt(cf, totals(v.seed, v.finalCount));
  const age = count >= 2 ? frame - tickFrame(count, v.finalCount) : 99;
  const pop = age >= 0 && age < 7 ? 1 + 0.08 * Math.sin((Math.PI * age) / 7) : 1;

  const e = Easing.inOut(Easing.sin)(frame / 299);
  const dx = interpolate(e, [0, 1], [260, -320]);
  const ry = interpolate(e, [0, 1], [27, 24]);

  const priceSize = 470;
  const currency = (
    <span style={{ fontFamily: INTER, fontWeight: 400, fontSize: priceSize * 0.5, color: v.priceColor, lineHeight: 1, marginTop: priceSize * 0.2 }}>
      {v.currency}
    </span>
  );
  return (
    <AbsoluteFill style={{ perspective: 2600, perspectiveOrigin: "40% 50%" }}>
      <div
        style={{
          position: "absolute",
          left: (3840 - WORLD_W) / 2 + 1500,
          top: (2160 - WORLD_H) / 2,
          width: WORLD_W,
          height: WORLD_H,
          transformStyle: "preserve-3d",
          transformOrigin: "1000px 50%",
          transform: `translate3d(${dx}px, 0, 0) rotateY(${ry}deg) rotateX(6deg) rotateZ(-1.5deg)`,
        }}
      >
        {/* peeking round icons above the bar */}
        <div style={{ position: "absolute", left: 900, top: -170, opacity: 0.85 }}>
          <UserIcon color={v.icon} size={430} />
        </div>
        <div style={{ position: "absolute", left: 1720, top: -200, opacity: 0.85 }}>
          <HeartIcon color={v.icon} size={430} />
        </div>
        <div style={{ position: "absolute", left: 2540, top: -230, opacity: 0.85 }}>
          <BellIcon color={v.icon} size={430} />
        </div>
        {/* darker band behind, then the bar */}
        <div style={{ position: "absolute", left: -1200, right: -400, top: BAR_TOP - 150, height: BAR_H + 300, background: v.band }} />
        <div
          style={{
            position: "absolute",
            left: -1200,
            right: -400,
            top: BAR_TOP,
            height: BAR_H,
            background: `linear-gradient(180deg, ${v.bar} 0%, ${v.bar} 100%)`,
            borderTop: `12px solid ${rgba(v.barEdge, 0.55)}`,
            borderBottom: `12px solid ${rgba(v.barEdge, 0.45)}`,
            boxShadow: `0 40px 120px rgba(0,0,0,0.25)`,
          }}
        />
        <div style={{ position: "absolute", left: 120, top: BAR_TOP + 290, opacity: 0.75 }}>
          <SearchIcon color={v.icon} size={620} />
        </div>
        {/* cart + badge */}
        <div style={{ position: "absolute", left: 1150, top: BAR_TOP + 250 }}>
          <CartIcon color={v.icon} size={800} />
          <div
            style={{
              position: "absolute",
              left: 520,
              top: -90,
              width: 300,
              height: 300,
              borderRadius: "50%",
              background: v.badge,
              color: v.badgeText,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: INTER,
              fontWeight: 600,
              fontSize: 160,
              letterSpacing: -4,
              transform: `scale(${pop})`,
              boxShadow: `0 6px 30px rgba(0,0,0,0.18)`,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {count}
          </div>
        </div>
        {/* total */}
        <div style={{ position: "absolute", left: 2300, top: BAR_TOP + (BAR_H - priceSize * 1.1) / 2, display: "flex", alignItems: "flex-start", gap: 30 }}>
          {v.currencyPosition === "before" ? currency : null}
          <Odometer
            cents={cents}
            intDigits={4}
            thousands={v.thousands}
            decimal={v.decimal}
            fontSize={priceSize}
            color={v.priceColor}
            fontFamily={INTER}
            fontWeight={400}
          />
          {v.currencyPosition === "after" ? <span style={{ marginLeft: 40, display: "flex", marginTop: priceSize * 0.22 }}>{currency}</span> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const CartCounter: React.FC<{ version: CartCounterVersion }> = ({ version: v }) => {
  const frame = useCurrentFrame();
  const mask =
    "linear-gradient(90deg, transparent 6%, black 24%, black 60%, transparent 86%), linear-gradient(180deg, transparent 4%, black 26%, black 80%, transparent 98%)";
  return (
    <AbsoluteFill style={{ backgroundColor: v.background }}>
      <AbsoluteFill style={{ filter: "blur(18px)" }}>
        <World v={v} frame={frame} />
      </AbsoluteFill>
      <AbsoluteFill style={{ WebkitMaskImage: mask, maskImage: mask, WebkitMaskComposite: "source-in", maskComposite: "intersect" }}>
        <World v={v} frame={frame} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 75% at 45% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.18) 100%)" }} />
    </AbsoluteFill>
  );
};
