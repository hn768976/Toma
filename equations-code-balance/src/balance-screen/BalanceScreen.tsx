import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import "../common/fonts";
import { INTER } from "../common/fonts";
import { Grain } from "../common/Grain";
import { useUnit } from "../common/units";
import { BALANCE_VERSIONS, centsAtFrame, DURATION, formatCents } from "./data";

export type BalanceScreenProps = { version: "drain" | "grow" };

// Phone screen surface in design px (before the camera transform).
const SW = 3100;
const SH = 5600;
/** Right edge of the figure: the decimals never move, whatever the value. */
const ANCHOR_X = 2220;
const ROW_Y = 3380;

const PIVOT_X = ANCHOR_X - 640;

// Camera: a low, glancing view over a phone lying almost flat.
const TX = -120;
const TY = 60;
const TZ = 600;
const RX = 44;
const RY = -6;
const RZ = -9;

const Screen: React.FC<{ cents: number; currency: string; u: (n: number) => number }> = ({ cents, currency, u }) => (
  <div
    style={{
      position: "absolute",
      width: u(SW),
      height: u(SH),
      fontFamily: INTER,
      color: "#15171c",
    }}
  >
    {/* Glass / display */}
    <div style={{ position: "absolute", inset: 0, borderRadius: u(150), background: "linear-gradient(170deg, #f3f3f9 0%, #efeff6 55%, #e9e9f2 100%)", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: u(550), top: u(ROW_Y - 800), fontSize: u(150), fontWeight: 700, letterSpacing: u(6) }}>Account Summary</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: u(ROW_Y - 260), textAlign: "center", fontSize: u(118), fontWeight: 700, letterSpacing: u(5), paddingLeft: u(580) }}>Available Balance</div>
      <div
        style={{
          position: "absolute",
          right: u(SW - ANCHOR_X),
          top: u(ROW_Y - 80),
          fontSize: u(270),
          fontWeight: 700,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: '"tnum" 1',
          letterSpacing: u(-2),
          whiteSpace: "nowrap",
        }}
      >
        {formatCents(cents)}
      </div>
      <div style={{ position: "absolute", left: u(ANCHOR_X + 14), top: u(ROW_Y + 80), fontSize: u(92), fontWeight: 500, letterSpacing: u(3) }}>{currency}</div>
      {/* Pale button */}
      <div style={{ position: "absolute", left: u(-40), right: u(-40), top: u(ROW_Y + 420), height: u(300), background: "#cdcdd8", display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: u(660), fontSize: u(118), fontWeight: 700, color: "#ececf3", letterSpacing: u(6) }}>
        Make a transfer
      </div>
    </div>
  </div>
);

/** Black device edge with a thin warm metallic rim, generic shape. */
const Edge: React.FC<{ u: (n: number) => number }> = ({ u }) => (
  <div style={{ position: "absolute", left: u(-60), top: u(-60), width: u(SW + 120), height: u(SH + 120), borderRadius: u(200), background: "#050506", boxShadow: `inset 0 0 0 ${u(10)}px #2a2016` }}>
    <div style={{ position: "absolute", inset: u(-14), borderRadius: u(212), border: `${u(16)}px solid transparent`, background: "linear-gradient(200deg, #ffd27a, #ff9a2e 14%, #6b3a10 34%, #ffb347 55%, #ffe0a0 68%, #7a4512 86%) border-box", WebkitMask: "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }} />
  </div>
);

const COPIES: Array<{ blur: number; mask?: string }> = [
  { blur: 18 },
  { blur: 8, mask: "linear-gradient(172deg, #000 0%, #000 66%, transparent 86%)" },
  { blur: 3, mask: "linear-gradient(172deg, transparent 0%, #000 18%, #000 60%, transparent 74%)" },
  { blur: 0, mask: "linear-gradient(172deg, transparent 22%, #000 34%, #000 54%, transparent 64%)" },
];

export const BalanceScreen: React.FC<BalanceScreenProps> = ({ version }) => {
  const frame = useCurrentFrame();
  const { u } = useUnit();
  const v = BALANCE_VERSIONS[version];
  const cents = centsAtFrame(v, frame);
  // Very slow straight push-in toward the screen. Linear, no other motion.
  const push = (frame / (DURATION - 1)) * 160;

  // The phone pivots around the balance figure, so TX/TY place the figure
  // relative to the frame centre and TZ sets its size.
  const transform =
    `translate3d(${u(TX)}px, ${u(TY)}px, ${u(TZ + push)}px) ` +
    `rotateZ(${RZ}deg) rotateX(${RX}deg) rotateY(${RY}deg)`;

  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 90% 10%, #1b1f2a, #07080b 60%)", overflow: "hidden" }}>
      {COPIES.map((c, i) => (
        <AbsoluteFill
          key={i}
          style={{
            perspective: u(2400),
            filter: c.blur ? `blur(${u(c.blur)}px)` : undefined,
            WebkitMaskImage: c.mask,
            maskImage: c.mask,
          }}
        >
          <div style={{ position: "absolute", left: `calc(50% - ${u(PIVOT_X)}px)`, top: `calc(50% - ${u(ROW_Y)}px)`, width: u(SW), height: u(SH), transformOrigin: `${u(PIVOT_X)}px ${u(ROW_Y)}px`, transform }}>
            <Edge u={u} />
            <Screen cents={cents} currency={v.currency} u={u} />
          </div>
        </AbsoluteFill>
      ))}
      <Grain id={`bs-${version}`} seed={frame} amount={0.018} />
    </AbsoluteFill>
  );
};
