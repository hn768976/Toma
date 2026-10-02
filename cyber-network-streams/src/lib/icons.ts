// Self-drawn icon set as SVG path data on a 24×24 grid, stroked (no fills
// unless noted). Used by the HUD (inline <svg>) and by the canvas atlases
// (via Path2D). No icon libraries, no logos.

export type IconDef = { d: string; fill?: boolean };

export const ICONS: Record<string, IconDef> = {
  user: { d: "M12 12.2a4.2 4.2 0 1 0 0-8.4a4.2 4.2 0 1 0 0 8.4Z M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" },
  users: { d: "M9 11a3.4 3.4 0 1 0 0-6.8a3.4 3.4 0 1 0 0 6.8Z M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6 M16.2 10.6a2.9 2.9 0 1 0 0-5.8 M17.5 13.9c2.4 0.6 4 2.6 4 5.6" },
  mail: { d: "M3 5.5h18v13H3Z M3.5 6l8.5 7l8.5-7" },
  heart: { d: "M12 20.5s-8-4.9-8-11a4.5 4.5 0 0 1 8-2.8a4.5 4.5 0 0 1 8 2.8c0 6.1-8 11-8 11Z" },
  chart: { d: "M4 20V4 M4 20h16 M8 17v-5 M12 17V8 M16 17v-7 M20 17V6" },
  monitor: { d: "M3 4.5h18v11.5H3Z M9 20.5h6 M12 16v4.5" },
  phone: { d: "M7.5 2.5h9a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V4a1.5 1.5 0 0 1 1.5-1.5Z M10.5 18.5h3" },
  cart: { d: "M2.5 3.5h3l2.4 11h10.6l2-7.5H6.6 M9.5 20a1.3 1.3 0 1 0 0-2.6a1.3 1.3 0 1 0 0 2.6Z M17 20a1.3 1.3 0 1 0 0-2.6a1.3 1.3 0 1 0 0 2.6Z" },
  chat: { d: "M4 4.5h16v11H10l-4.5 4v-4H4Z M8 9h8 M8 12h5" },
  shield: { d: "M12 2.5c2.5 1.8 5 2.6 8 2.6c0 7.8-2.7 13-8 16.4C6.7 18.1 4 12.9 4 5.1c3 0 5.5-0.8 8-2.6Z M8.2 11.8l2.6 2.6l5-5.2" },
  globe: { d: "M12 21a9 9 0 1 0 0-18a9 9 0 1 0 0 18Z M3 12h18 M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3Z" },
  lock: { d: "M5.5 10.5h13v10h-13Z M8 10.5V7.5a4 4 0 0 1 8 0v3 M12 14.5v2.5" },
};

export const NETWORK_ICONS = ["user", "mail", "heart", "chart", "monitor", "phone", "cart", "chat", "users"] as const;

// Draws an icon centred in a box of `size` px using Canvas 2D.
export const drawIcon = (
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number,
  cy: number,
  size: number,
  color: string,
  lineWidth = 2,
) => {
  const def = ICONS[name];
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const p = new Path2D(def.d);
  if (def.fill) ctx.fill(p);
  else ctx.stroke(p);
  ctx.restore();
};
