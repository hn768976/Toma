// Odometer price: each digit is a rolling strip, positioned from the value.
import React from "react";

type Slot = { kind: "digit"; place: number } | { kind: "sep"; char: string; place: number };

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

// Continuous wheel position (0..10) of the digit at `place` (power of ten, in cents).
const wheel = (v: number, place: number) => {
  const unit = Math.pow(10, place);
  if (place === 0) return ((v % 10) + 10) % 10;
  const below = v % unit;
  const carry = Math.min(1, Math.max(0, below - (unit - 1)));
  return (Math.floor(v / unit) % 10) + carry;
};

export const Odometer: React.FC<{
  cents: number;
  intDigits: number; // max integer digits shown (e.g. 4 → 9,999)
  thousands: string;
  decimal: string;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: number;
}> = ({ cents, intDigits, thousands, decimal, fontSize, color, fontFamily, fontWeight }) => {
  const slots: Slot[] = [];
  for (let i = intDigits - 1; i >= 0; i--) {
    slots.push({ kind: "digit", place: i + 2 });
    if (i % 3 === 0 && i > 0) slots.push({ kind: "sep", char: thousands, place: i + 2 });
  }
  slots.push({ kind: "sep", char: decimal, place: -1 });
  slots.push({ kind: "digit", place: 1 }, { kind: "digit", place: 0 });

  const digitW = fontSize * 0.62;
  const sepW = fontSize * 0.3;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", fontFamily, fontWeight, fontSize, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
      {slots.map((s, i) => {
        // Leading digits (and their separator) grow in as the value reaches them.
        let vis = 1;
        if (s.place >= 3) {
          const unit = Math.pow(10, s.place);
          vis = Math.min(1, Math.max(0, (cents - 0.86 * unit) / (0.14 * unit)));
        }
        if (s.kind === "sep") {
          return (
            <div key={i} style={{ width: sepW * vis, opacity: vis, overflow: "hidden", textAlign: "center", height: fontSize * 1.1 }}>
              {s.char}
            </div>
          );
        }
        const pos = wheel(cents, s.place);
        return (
          <div key={i} style={{ width: digitW * vis, opacity: vis, height: fontSize * 1.1, overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, width: digitW, top: -pos * fontSize * 1.1 }}>
              {DIGITS.map((d, j) => (
                <div key={j} style={{ height: fontSize * 1.1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {d}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
