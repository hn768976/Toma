// Self-drawn line icons on a 24×24 grid, as SVG path data so the same
// shapes render in SVG (look 1) and Canvas 2D via Path2D (looks 2–5).

const circle = (cx: number, cy: number, r: number) =>
  `M${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} Z`;

const gearPath = (cx: number, cy: number, teeth: number, rOut: number, rIn: number, rHole: number) => {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let k = 0; k < teeth; k++) {
    const a = k * step - Math.PI / 2;
    const seq: [number, number][] = [
      [a - step * 0.3, rIn],
      [a - step * 0.17, rOut],
      [a + step * 0.17, rOut],
      [a + step * 0.3, rIn],
    ];
    for (const [ang, r] of seq) {
      pts.push(`${(cx + Math.cos(ang) * r).toFixed(3)} ${(cy + Math.sin(ang) * r).toFixed(3)}`);
    }
  }
  return `M${pts.join(" L")} Z ${circle(cx, cy, rHole)}`;
};

export type IconDef = { stroke: string; fill?: string };

export const ICONS = {
  brain: {
    stroke:
      "M12 5.2 C11 4.1 8.9 4.1 8 5.3 C6.3 5 5 6.4 5.3 8 C3.9 8.7 3.6 10.8 4.8 11.8 C4 13.3 4.8 15.2 6.4 15.4 C6.7 17.2 8.8 18.3 10.4 17.4 C10.9 18.3 11.5 18.8 12 18.8 " +
      "M12 5.2 C13 4.1 15.1 4.1 16 5.3 C17.7 5 19 6.4 18.7 8 C20.1 8.7 20.4 10.8 19.2 11.8 C20 13.3 19.2 15.2 17.6 15.4 C17.3 17.2 15.2 18.3 13.6 17.4 C13.1 18.3 12.5 18.8 12 18.8 " +
      "M12 5.2 V18.8 M8 5.3 C8.3 6.6 9.4 7.3 10.4 7.2 M5.3 8 C6 9 7.2 9.4 8.2 9 M4.8 11.8 C6 12.3 7.4 12 8 11 M6.4 15.4 C7.6 15.2 8.6 14.4 8.8 13.4 " +
      "M16 5.3 C15.7 6.6 14.6 7.3 13.6 7.2 M18.7 8 C18 9 16.8 9.4 15.8 9 M19.2 11.8 C18 12.3 16.6 12 16 11 M17.6 15.4 C16.4 15.2 15.4 14.4 15.2 13.4",
  },
  shield: {
    stroke: "M12 3 L19 5.8 V11 C19 15.5 16 18.8 12 21 C8 18.8 5 15.5 5 11 V5.8 Z M8.6 11.8 L11 14.2 L15.6 9.4",
  },
  cloud: {
    stroke:
      "M7 18 H17.5 C19.9 18 21.5 16.3 21.5 14.2 C21.5 12.2 20 10.6 18 10.4 C17.6 7.5 15.2 5.5 12.4 5.5 C10 5.5 8 7 7.2 9.1 C4.6 9.3 2.5 11.4 2.5 13.9 C2.5 16.2 4.5 18 7 18 Z",
    fill:
      "M7 18 H17.5 C19.9 18 21.5 16.3 21.5 14.2 C21.5 12.2 20 10.6 18 10.4 C17.6 7.5 15.2 5.5 12.4 5.5 C10 5.5 8 7 7.2 9.1 C4.6 9.3 2.5 11.4 2.5 13.9 C2.5 16.2 4.5 18 7 18 Z",
  },
  gear: { stroke: gearPath(12, 12, 8, 9, 7, 3) },
  gearFine: { stroke: `${gearPath(12, 12, 14, 9.2, 7.6, 3.4)} ${circle(12, 12, 5.6)}` },
  shieldOutline: { stroke: "M12 3 L19 5.8 V11 C19 15.5 16 18.8 12 21 C8 18.8 5 15.5 5 11 V5.8 Z" },
  check: { stroke: "M8.4 11.9 L11 14.4 L16 8.8" },
  document: {
    stroke:
      "M6 3 H14.5 L18.5 7 V21 H6 Z M14.5 3 V7 H18.5 M8.5 10.5 H11.5 M8.5 14 H11.5 M8.5 17.5 H11.5 M13 10.5 l1 1 l2 -2 M13 14 l1 1 l2 -2 M13 17.5 l1 1 l2 -2",
  },
  globe: {
    stroke: `${circle(12, 12, 9)} M12 3 C8.2 6 8.2 18 12 21 M12 3 C15.8 6 15.8 18 12 21 M3 12 H21 M4.6 7.5 H19.4 M4.6 16.5 H19.4 M12 3 V21`,
  },
  phone: {
    stroke:
      "M8 2.5 H16 A1.8 1.8 0 0 1 17.8 4.3 V19.7 A1.8 1.8 0 0 1 16 21.5 H8 A1.8 1.8 0 0 1 6.2 19.7 V4.3 A1.8 1.8 0 0 1 8 2.5 Z M10.5 18.8 H13.5 M10.8 4.8 H13.2",
  },
  mail: { stroke: "M3 6 H21 V18 H3 Z M3 6 L12 13 L21 6" },
  wifi: {
    stroke:
      "M3.5 9.5 C8.2 5.2 15.8 5.2 20.5 9.5 M6.5 12.6 C9.6 9.9 14.4 9.9 17.5 12.6 M9.4 15.6 C11 14.3 13 14.3 14.6 15.6",
    fill: circle(12, 18.6, 1.3),
  },
  padlock: {
    stroke:
      "M6 10.5 H18 A1.5 1.5 0 0 1 19.5 12 V19.5 A1.5 1.5 0 0 1 18 21 H6 A1.5 1.5 0 0 1 4.5 19.5 V12 A1.5 1.5 0 0 1 6 10.5 Z M8 10.5 V7.5 A4 4 0 0 1 16 7.5 V10.5 M12 14.2 V17",
  },
  chart: { stroke: "M4 3.5 V20 H20.5 M8 17 V12 M12 17 V8 M16 17 V10.5 M7 9 L11 5.5 L14 7.5 L19 4" },
  user: {
    stroke: `${circle(12, 8, 3.6)} M5 20 C5 15.8 8.2 13.8 12 13.8 C15.8 13.8 19 15.8 19 20`,
  },
  database: {
    stroke:
      "M5 6 A7 2.6 0 1 0 19 6 A7 2.6 0 1 0 5 6 Z M5 6 V18 A7 2.6 0 0 0 19 18 V6 M5 10 A7 2.6 0 0 0 19 10 M5 14 A7 2.6 0 0 0 19 14",
  },
  chat: { stroke: "M4 5 H20 V15 H10 L6 19 V15 H4 Z M7.5 8.5 H16.5 M7.5 11.5 H13.5" },
  agent: {
    // head profile with a small gear inside: "AI agent"
    stroke: `M15.5 20.5 V17.2 C18 16.4 19.2 14.6 19 12.2 L20.6 11.3 L19 9.9 C18.6 6 15.7 3.5 11.8 3.5 C7.6 3.5 4.5 6.6 4.5 10.6 C4.5 13 5.6 14.9 7.4 16.1 V20.5 ${gearPath(11.8, 10.4, 7, 3.6, 2.7, 1.2)}`,
  },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

const pathCache = new Map<string, Path2D>();
const p2d = (d: string) => {
  let p = pathCache.get(d);
  if (!p) {
    p = new Path2D(d);
    pathCache.set(d, p);
  }
  return p;
};

// Draw an icon into a 2D context centred at (cx, cy), `size` px across.
export const drawIcon = (
  ctx: CanvasRenderingContext2D,
  name: IconName,
  cx: number,
  cy: number,
  size: number,
  color: string,
  lineWidth = 1.6,
) => {
  const def: IconDef = ICONS[name];
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (def.fill) ctx.fill(p2d(def.fill), "evenodd");
  ctx.stroke(p2d(def.stroke));
  ctx.restore();
};
