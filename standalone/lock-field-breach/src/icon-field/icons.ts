import type { IconName, IconState, Palette } from "./variants";

/**
 * Every icon is drawn once into a small offscreen sprite canvas and then
 * blitted with transforms — paths are never re-stroked per icon per frame.
 *
 * Icons are solid filled silhouettes; cut-outs (keyhole, pupil, exclamation,
 * crack) are punched to transparency with destination-out so the tile colour
 * beneath shows through.
 *
 * All paths live in a 100×100 box.
 */

const SPRITE_PX = 384;
const U = SPRITE_PX / 100;

type Ctx = CanvasRenderingContext2D;

const punch = (ctx: Ctx, draw: (ctx: Ctx) => void) => {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  draw(ctx);
  ctx.restore();
};

const drawShacklePath = (ctx: Ctx) => {
  // Arch over the body: outer r 21, inner r 12, centred on the body top edge.
  const cx = 50;
  const cy = 47;
  const ro = 21;
  const ri = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, ro, Math.PI, 0, false); // outer, through the top
  ctx.lineTo(cx + ri, cy);
  ctx.arc(cx, cy, ri, 0, Math.PI, true); // inner, back through the top
  ctx.closePath();
  ctx.fill();
};

const drawPadlock = (ctx: Ctx, state: IconState) => {
  // Shackle first (behind the body).
  if (state === "open") {
    // Rotate the shackle ~35° about its ATTACHED (left) end — the hinge —
    // so the free end lifts clear of the body. Pivoting anywhere else makes
    // it look broken rather than opened.
    const hingeX = 50 - 16.5; // mid-radius of the left leg
    const hingeY = 47;
    ctx.save();
    ctx.translate(hingeX, hingeY);
    ctx.rotate((-35 * Math.PI) / 180);
    ctx.translate(-hingeX, -hingeY);
    drawShacklePath(ctx);
    ctx.restore();
  } else {
    drawShacklePath(ctx);
  }
  // Body: rounded rect, wider than tall.
  ctx.beginPath();
  ctx.roundRect(21, 47, 58, 41, 8);
  ctx.fill();
  // Keyhole cut out of the body.
  punch(ctx, (c) => {
    c.beginPath();
    c.arc(50, 61, 6.2, 0, Math.PI * 2);
    c.moveTo(46.8, 78);
    c.lineTo(53.2, 78);
    c.lineTo(51.4, 64);
    c.lineTo(48.6, 64);
    c.closePath();
    c.fill();
  });
};

const drawShield = (ctx: Ctx, state: IconState) => {
  ctx.beginPath();
  ctx.moveTo(23, 17);
  ctx.lineTo(77, 17); // flat top
  ctx.lineTo(77, 47);
  ctx.bezierCurveTo(77, 68, 65, 81, 50, 89); // pointed base
  ctx.bezierCurveTo(35, 81, 23, 68, 23, 47);
  ctx.closePath();
  ctx.fill();
  if (state === "open") {
    // Breach: a jagged crack punched through the shield.
    punch(ctx, (c) => {
      c.beginPath();
      c.moveTo(53, 15);
      c.lineTo(44, 36);
      c.lineTo(57, 50);
      c.lineTo(45, 68);
      c.lineTo(50, 91);
      c.lineWidth = 4.5;
      c.lineJoin = "miter";
      c.stroke();
    });
  }
};

const drawKey = (ctx: Ctx) => {
  // Round bow with a hole, straight shaft, two teeth.
  ctx.beginPath();
  ctx.arc(29, 50, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(40, 46, 46, 8);
  ctx.fillRect(66, 54, 7, 11);
  ctx.fillRect(79, 54, 7, 14);
  punch(ctx, (c) => {
    c.beginPath();
    c.arc(27, 50, 6.5, 0, Math.PI * 2);
    c.fill();
  });
};

const drawFingerprint = (ctx: Ctx) => {
  // Concentric arcs, open on the right side.
  ctx.lineCap = "round";
  ctx.lineWidth = 5.5;
  const cx = 48;
  const cy = 52;
  const arcs: [number, number, number][] = [
    [10, 0.25, 1.8],
    [18, 0.18, 1.86],
    [26, 0.12, 1.92],
    [34, 0.2, 1.82],
  ];
  ctx.strokeStyle = ctx.fillStyle as string;
  for (const [r, a0, a1] of arcs) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0 * Math.PI, a1 * Math.PI, false);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
  ctx.fill();
};

const drawEye = (ctx: Ctx) => {
  // Lens with a filled pupil.
  ctx.beginPath();
  ctx.moveTo(13, 52);
  ctx.quadraticCurveTo(50, 14, 87, 52);
  ctx.quadraticCurveTo(50, 90, 13, 52);
  ctx.closePath();
  ctx.fill();
  punch(ctx, (c) => {
    c.beginPath();
    c.arc(50, 52, 15, 0, Math.PI * 2);
    c.fill();
  });
  ctx.beginPath();
  ctx.arc(50, 52, 8.5, 0, Math.PI * 2);
  ctx.fill();
};

const drawWarning = (ctx: Ctx) => {
  // Rounded triangle with an exclamation punched out.
  const r = 9;
  const pts: [number, number][] = [
    [50, 12],
    [90, 82],
    [10, 82],
  ];
  ctx.beginPath();
  ctx.moveTo((pts[2][0] + pts[0][0]) / 2, (pts[2][1] + pts[0][1]) / 2);
  for (let i = 0; i < 3; i++) {
    const p = pts[i];
    const n = pts[(i + 1) % 3];
    ctx.arcTo(p[0], p[1], n[0], n[1], r);
  }
  ctx.closePath();
  ctx.fill();
  punch(ctx, (c) => {
    c.beginPath();
    c.roundRect(46.6, 36, 6.8, 26, 3.4);
    c.fill();
    c.beginPath();
    c.arc(50, 72, 4.6, 0, Math.PI * 2);
    c.fill();
  });
};

const drawCheck = (ctx: Ctx) => {
  // Check inside a ring.
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(50, 50, 36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 9.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(33, 52);
  ctx.lineTo(45, 64);
  ctx.lineTo(68, 37);
  ctx.stroke();
};

export const drawIcon = (
  ctx: Ctx,
  name: IconName,
  state: IconState,
  color: string,
) => {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  switch (name) {
    case "padlock":
      drawPadlock(ctx, state);
      break;
    case "shield":
      drawShield(ctx, state);
      break;
    case "key":
      drawKey(ctx);
      break;
    case "fingerprint":
      drawFingerprint(ctx);
      break;
    case "eye":
      drawEye(ctx);
      break;
    case "warning":
      drawWarning(ctx);
      break;
    case "check":
      drawCheck(ctx);
      break;
  }
};

export type IconTier = "pale" | "white";

export type SpriteCache = Map<string, HTMLCanvasElement>;

const spriteKey = (name: IconName, state: IconState, tier: IconTier) =>
  `${name}|${state}|${tier}`;

/** Pre-render every (icon, tier) silhouette once per variant mount. */
export const buildSpriteCache = (
  names: readonly IconName[],
  state: IconState,
  palette: Palette,
): SpriteCache => {
  const cache: SpriteCache = new Map();
  const tiers: [IconTier, string][] = [
    ["pale", palette.iconPale],
    ["white", palette.iconWhite],
  ];
  for (const name of names) {
    for (const [tier, color] of tiers) {
      const canvas = document.createElement("canvas");
      canvas.width = SPRITE_PX;
      canvas.height = SPRITE_PX;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.scale(U, U);
      drawIcon(ctx, name, state, color);
      cache.set(spriteKey(name, state, tier), canvas);
    }
  }
  return cache;
};

export const getSprite = (
  cache: SpriteCache,
  name: IconName,
  state: IconState,
  tier: IconTier,
): HTMLCanvasElement | undefined => cache.get(spriteKey(name, state, tier));
