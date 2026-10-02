import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import "../common/fonts";
import { INTER } from "../common/fonts";
import { Grain } from "../common/Grain";
import { useUnit } from "../common/units";
import { BALANCE_VERSIONS, centsAtFrame, DURATION, formatCents } from "./data";

export type BalanceScreenProps = { version: "drain" | "grow" };

// Phone screen surface in design px (before the camera transform).
const SW = 2700;
const SH = 3400;
/** Right edge of the figure: the decimals never move, whatever the value. */
const ANCHOR_X = 1820;
const ROW_Y = 1180;

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
    <div style={{ position: "absolute", inset: 0, borderRadius: u(150), background: "linear-gradient(170deg, #f6f7fa 0%, #f1f2f6 55%, #eceef3 100%)", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: u(150), top: u(380), fontSize: u(150), fontWeight: 700, letterSpacing: u(-1) }}>Account Summary</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: u(ROW_Y - 260), textAlign: "center", fontSize: u(118), fontWeight: 600, paddingLeft: u(180) }}>Available Balance</div>
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
      <div style={{ position: "absolute", left: u(ANCHOR_X + 20), top: u(ROW_Y + 50), fontSize: u(110), fontWeight: 400, letterSpacing: u(2) }}>{currency}</div>
      {/* Pale button */}
      <div style={{ position: "absolute", left: u(-40), right: u(-40), top: u(ROW_Y + 420), height: u(300), background: "#dcdee4", display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: u(260), fontSize: u(118), fontWeight: 700, color: "#f4f5f8", letterSpacing: u(3) }}>
        Make a transfer
      </div>
    </div>
  </div>
);

/** Black device edge with a thin warm metallic rim, generic shape. */
const Edge: React.FC<{ u: (n: number) => number }> = ({ u }) => (
  <div style={{ position: "absolute", left: u(-60), top: u(-60), width: u(SW + 120), height: u(SH + 120), borderRadius: u(200), background: "#050506", boxShadow: `inset 0 0 0 ${u(10)}px #2a2016` }}>
    <div style={{ position: "absolute", inset: u(-14), borderRadius: u(212), border: `${u(10)}px solid transparent`, background: "linear-gradient(200deg, #f5c77e, #8a5a24 18%, #2a1b0c 40%, #c58a45 62%, #3a2610 85%) border-box", WebkitMask: "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }} />
  </div>
);

const COPIES: Array<{ blur: number; mask?: string }> = [
  { blur: 26 },
  { blur: 12, mask: "linear-gradient(166deg, transparent 12%, #000 30%, #000 64%, transparent 84%)" },
  { blur: 5, mask: "linear-gradient(166deg, transparent 22%, #000 34%, #000 58%, transparent 72%)" },
  { blur: 0, mask: "linear-gradient(166deg, transparent 28%, #000 38%, #000 52%, transparent 62%)" },
];

export const BalanceScreen: React.FC<BalanceScreenProps> = ({ version }) => {
  const frame = useCurrentFrame();
  const { u } = useUnit();
  const v = BALANCE_VERSIONS[version];
  const cents = centsAtFrame(v, frame);
  // Very slow straight push-in toward the screen. Linear, no other motion.
  const push = (frame / (DURATION - 1)) * 160;

  const transform =
    `translate(-50%, -50%) translate3d(${u(-360)}px, ${u(330)}px, ${u(760 + push)}px) ` +
    `rotateZ(-7deg) rotateX(20deg) rotateY(-9deg)`;

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
          <div style={{ position: "absolute", left: "50%", top: "50%", width: u(SW), height: u(SH), transform }}>
            <Edge u={u} />
            <Screen cents={cents} currency={v.currency} u={u} />
          </div>
        </AbsoluteFill>
      ))}
      <Grain id={`bs-${version}`} seed={frame} amount={0.018} />
    </AbsoluteFill>
  );
};
