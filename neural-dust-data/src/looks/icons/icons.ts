// Self-drawn line icons, SVG path data on a 24x24 grid (no icon libraries).
const gear = (() => {
  // 8 teeth around a ring
  const pts: string[] = [];
  const teeth = 8;
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const r = i % 4 === 0 || i % 4 === 1 ? 9 : 7;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z M15 12 A3 3 0 1 0 9 12 A3 3 0 1 0 15 12 Z`;
})();

export const ICON_PATHS: { name: string; d: string }[] = [
  { name: "house", d: "M3.5 11.5 L12 4.5 L20.5 11.5 M6 10 V19.5 H18 V10 M10.2 19.5 V14.5 H13.8 V19.5" },
  { name: "cart", d: "M2.5 5 H5.5 L8 15.5 H18 L20.5 8 H6.8 M10.2 19.2 A1.3 1.3 0 1 0 7.6 19.2 A1.3 1.3 0 1 0 10.2 19.2 Z M18.2 19.2 A1.3 1.3 0 1 0 15.6 19.2 A1.3 1.3 0 1 0 18.2 19.2 Z" },
  { name: "shield", d: "M12 3 L19 6 V11 C19 15.5 16 19 12 21 C8 19 5 15.5 5 11 V6 Z M9 12 L11.2 14.2 L15.2 10" },
  { name: "cloud", d: "M7.5 18 H17 A3.8 3.8 0 0 0 17.2 10.4 A5.5 5.5 0 0 0 6.6 9.4 A4.3 4.3 0 0 0 7.5 18 Z" },
  { name: "chart", d: "M4 20 H20 M7 17 V12 M11 17 V7.5 M15 17 V10 M19 17 V5.5" },
  { name: "document", d: "M6 3 H14 L18 7 V21 H6 Z M14 3 V7 H18 M9 11.5 H15 M9 14.5 H15 M9 17.5 H13" },
  { name: "phone", d: "M8.5 2.5 H15.5 A1.5 1.5 0 0 1 17 4 V20 A1.5 1.5 0 0 1 15.5 21.5 H8.5 A1.5 1.5 0 0 1 7 20 V4 A1.5 1.5 0 0 1 8.5 2.5 Z M11 18.5 H13" },
  { name: "lock", d: "M6 11 H18 V20.5 H6 Z M8.5 11 V8 A3.5 3.5 0 0 1 15.5 8 V11 M12 14.5 V17" },
  { name: "gear", d: gear },
  { name: "user", d: "M15.8 8 A3.8 3.8 0 1 0 8.2 8 A3.8 3.8 0 1 0 15.8 8 Z M4.5 20.5 C5.5 16.5 8.5 14.5 12 14.5 C15.5 14.5 18.5 16.5 19.5 20.5" },
];

export const CHECK_PATH = "M6.5 12.5 L10.5 16.5 L17.5 8.5";
