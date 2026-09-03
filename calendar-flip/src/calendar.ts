/** Calendar data, generated from real dates — never hand-typed. */

export type WeekStart = 0 | 1;

export const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
] as const;

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/** Column headers, rotated so that `weekStart` is the first column. */
export const weekdayHeader = (weekStart: WeekStart): string[] =>
  Array.from({length: 7}, (_, i) => WEEKDAY_INITIALS[(i + weekStart) % 7]);

/** Index of the Sunday column — the one drawn in red. */
export const sundayColumn = (weekStart: WeekStart): number =>
  (7 - weekStart) % 7;

/**
 * A fixed 6x7 matrix of day numbers, `null` for the leading and trailing
 * blanks. Always six rows so the grid never reflows between months.
 */
export const monthMatrix = (
  year: number,
  month: number,
  weekStart: WeekStart,
): (number | null)[][] => {
  // UTC throughout, so the render is independent of the machine's timezone.
  const firstDayOfWeek = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (firstDayOfWeek - weekStart + 7) % 7;

  return Array.from({length: 6}, (_, row) =>
    Array.from({length: 7}, (_, col) => {
      const day = row * 7 + col - lead + 1;
      return day >= 1 && day <= daysInMonth ? day : null;
    }),
  );
};
