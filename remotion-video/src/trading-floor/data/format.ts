// Number/time formatting shared by every panel. Locale is pinned to
// en-US so a render on a differently-configured machine produces the
// same glyphs.

const grouped = new Intl.NumberFormat("en-US");

export const fmtInt = (n: number): string => grouped.format(Math.round(n));

export const fmtPrice = (n: number, dp = 2): string =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });

export const fmtSigned = (n: number, dp = 2): string =>
  (n > 0 ? "+" : n < 0 ? "" : "") + fmtPrice(n, dp);

export const fmtPercent = (n: number): string =>
  `${n > 0 ? "+" : ""}${fmtPrice(n, 2)}%`;

export const fmtClock = (
  startHour: number,
  startMinute: number,
  elapsedSeconds: number,
): string => {
  const total =
    startHour * 3600 + startMinute * 60 + Math.floor(elapsedSeconds);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

export const fmtClockShort = (
  startHour: number,
  startMinute: number,
  elapsedSeconds: number,
): string => fmtClock(startHour, startMinute, elapsedSeconds).slice(0, 5);
