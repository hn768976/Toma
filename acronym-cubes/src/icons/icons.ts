import type { Font } from "opentype.js";

/**
 * Generic icons, drawn with Canvas 2D paths in a 100 × 100 box (y down).
 * No logos, no brands. Currency signs and the few typographic icons are glyphs
 * from the bundled OFL font (Nunito Black), never system fonts.
 *
 * Every drawer paints in opaque white; "cut" draws with destination-out so
 * details (keyholes, dots, folds) are knocked out of a filled silhouette.
 */
export type IconId =
  | "dollar"
  | "euro"
  | "pound"
  | "yen"
  | "padlock"
  | "chip"
  | "brain"
  | "binary"
  | "sparkle"
  | "leaf"
  | "drop"
  | "people"
  | "scale"
  | "wifi"
  | "house"
  | "thermometer"
  | "bulb"
  | "browser"
  | "gear"
  | "user"
  | "cloud"
  | "braces"
  | "arrows"
  | "plug"
  | "factory"
  | "box"
  | "invoice"
  | "chat"
  | "envelope"
  | "handshake"
  | "barchart"
  | "gauge"
  | "check"
  | "target"
  | "textlines";

type Ctx = CanvasRenderingContext2D;
type Drawer = (c: Ctx, font: Font) => void;


const stroke = (c: Ctx, width: number, build: () => void) => {
  c.globalCompositeOperation = "source-over";
  c.lineWidth = width;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.beginPath();
  build();
  c.stroke();
};
const fill = (c: Ctx, build: () => void) => {
  c.globalCompositeOperation = "source-over";
  c.beginPath();
  build();
  c.fill();
};
const cutFill = (c: Ctx, build: () => void) => {
  c.globalCompositeOperation = "destination-out";
  c.beginPath();
  build();
  c.fill();
  c.globalCompositeOperation = "source-over";
};
const cutStroke = (c: Ctx, width: number, build: () => void) => {
  c.globalCompositeOperation = "destination-out";
  c.lineWidth = width;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.beginPath();
  build();
  c.stroke();
  c.globalCompositeOperation = "source-over";
};
const circle = (c: Ctx, x: number, y: number, r: number) => {
  c.moveTo(x + r, y);
  c.arc(x, y, r, 0, Math.PI * 2);
};
const rrect = (c: Ctx, x0: number, y0: number, x1: number, y1: number, r: number | number[]) => {
  c.roundRect(x0, y0, x1 - x0, y1 - y0, r);
};
const poly = (c: Ctx, pts: number[], close = false) => {
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  if (close) c.closePath();
};

/** A glyph string from the font, centred in the box and fitted to `size`. */
const glyph = (text: string, size = 86): Drawer => (c, font) => {
  const probe = font.getPath(text, 0, 0, 100);
  const bb = probe.getBoundingBox();
  const s = size / Math.max(bb.x2 - bb.x1, bb.y2 - bb.y1);
  const path = font.getPath(text, 0, 0, 100 * s);
  const b = path.getBoundingBox();
  const dx = 50 - (b.x1 + b.x2) / 2;
  const dy = 50 - (b.y1 + b.y2) / 2;
  const p2 = new Path2D();
  for (const cmd of path.commands) {
    if (cmd.type === "M") p2.moveTo(cmd.x + dx, cmd.y + dy);
    else if (cmd.type === "L") p2.lineTo(cmd.x + dx, cmd.y + dy);
    else if (cmd.type === "Q") p2.quadraticCurveTo(cmd.x1 + dx, cmd.y1 + dy, cmd.x + dx, cmd.y + dy);
    else if (cmd.type === "C")
      p2.bezierCurveTo(cmd.x1 + dx, cmd.y1 + dy, cmd.x2 + dx, cmd.y2 + dy, cmd.x + dx, cmd.y + dy);
    else if (cmd.type === "Z") p2.closePath();
  }
  c.globalCompositeOperation = "source-over";
  c.fill(p2, "nonzero");
};

export const ICONS: Record<IconId, Drawer> = {
  dollar: glyph("$", 90),
  euro: glyph("€", 84),
  pound: glyph("£", 84),
  yen: glyph("¥", 84),
  binary: glyph("01", 86),
  braces: glyph("{ }", 88),

  padlock: (c) => {
    stroke(c, 11, () => {
      c.moveTo(31, 48);
      c.lineTo(31, 32);
      c.arc(50, 32, 19, Math.PI, 0);
      c.lineTo(69, 48);
    });
    fill(c, () => rrect(c, 18, 44, 82, 92, 9));
    cutFill(c, () => {
      circle(c, 50, 62, 8);
      rrect(c, 46, 62, 54, 80, 3);
    });
  },

  chip: (c) => {
    stroke(c, 8, () => rrect(c, 26, 26, 74, 74, 7));
    fill(c, () => rrect(c, 39, 39, 61, 61, 3));
    stroke(c, 7, () => {
      for (const p of [38, 50, 62]) {
        c.moveTo(p, 8);
        c.lineTo(p, 22);
        c.moveTo(p, 78);
        c.lineTo(p, 92);
        c.moveTo(8, p);
        c.lineTo(22, p);
        c.moveTo(78, p);
        c.lineTo(92, p);
      }
    });
  },

  brain: (c) => {
    fill(c, () => {
      for (const [x, y, r] of [
        [34, 32, 17],
        [24, 52, 16],
        [34, 70, 16],
        [50, 26, 14],
        [66, 32, 17],
        [76, 52, 16],
        [66, 70, 16],
        [50, 74, 12],
        [50, 50, 20],
      ])
        circle(c, x, y, r);
    });
    cutStroke(c, 5, () => {
      c.moveTo(50, 14);
      c.lineTo(50, 88);
      c.moveTo(24, 44);
      c.quadraticCurveTo(34, 48, 38, 40);
      c.moveTo(30, 66);
      c.quadraticCurveTo(38, 58, 44, 64);
      c.moveTo(76, 44);
      c.quadraticCurveTo(66, 48, 62, 40);
      c.moveTo(70, 66);
      c.quadraticCurveTo(62, 58, 56, 64);
    });
  },

  sparkle: (c) => {
    fill(c, () => {
      c.moveTo(44, 8);
      c.quadraticCurveTo(48, 48, 84, 52);
      c.quadraticCurveTo(48, 56, 44, 96);
      c.quadraticCurveTo(40, 56, 4, 52);
      c.quadraticCurveTo(40, 48, 44, 8);
      c.closePath();
      c.moveTo(80, 6);
      c.quadraticCurveTo(82, 20, 96, 22);
      c.quadraticCurveTo(82, 24, 80, 38);
      c.quadraticCurveTo(78, 24, 64, 22);
      c.quadraticCurveTo(78, 20, 80, 6);
      c.closePath();
    });
  },

  leaf: (c) => {
    fill(c, () => {
      c.moveTo(16, 86);
      c.bezierCurveTo(10, 44, 40, 14, 88, 12);
      c.bezierCurveTo(88, 60, 60, 90, 16, 86);
      c.closePath();
    });
    cutStroke(c, 6, () => {
      c.moveTo(24, 80);
      c.quadraticCurveTo(50, 50, 74, 28);
    });
    stroke(c, 7, () => {
      c.moveTo(8, 94);
      c.lineTo(24, 78);
    });
  },

  drop: (c) => {
    fill(c, () => {
      c.moveTo(50, 6);
      c.bezierCurveTo(50, 6, 20, 44, 20, 62);
      c.arc(50, 62, 30, Math.PI, 0, true);
      c.bezierCurveTo(80, 44, 50, 6, 50, 6);
      c.closePath();
    });
    cutStroke(c, 6, () => {
      c.arc(50, 62, 19, Math.PI * 0.62, Math.PI * 0.95);
    });
  },

  people: (c) => {
    // back person (right)
    fill(c, () => {
      circle(c, 66, 30, 13);
      c.moveTo(44, 78);
      c.bezierCurveTo(44, 58, 54, 50, 66, 50);
      c.bezierCurveTo(80, 50, 92, 58, 92, 78);
      c.closePath();
    });
    // separation gap
    cutStroke(c, 10, () => {
      circle(c, 38, 38, 16);
      c.moveTo(6, 90);
      c.bezierCurveTo(6, 66, 20, 58, 38, 58);
      c.bezierCurveTo(56, 58, 70, 66, 70, 90);
    });
    // front person (left)
    fill(c, () => {
      circle(c, 38, 38, 16);
      c.moveTo(6, 92);
      c.bezierCurveTo(6, 68, 20, 60, 38, 60);
      c.bezierCurveTo(56, 60, 70, 68, 70, 92);
      c.closePath();
    });
  },

  scale: (c) => {
    stroke(c, 8, () => {
      c.moveTo(50, 14);
      c.lineTo(50, 84);
      c.moveTo(14, 24);
      c.lineTo(86, 24);
      c.moveTo(30, 88);
      c.lineTo(70, 88);
    });
    stroke(c, 4, () => {
      poly(c, [8, 58, 20, 24, 32, 58]);
      poly(c, [68, 58, 80, 24, 92, 58]);
    });
    fill(c, () => {
      c.moveTo(4, 56);
      c.arc(20, 56, 16, Math.PI, 0, true);
      c.closePath();
      c.moveTo(64, 56);
      c.arc(80, 56, 16, Math.PI, 0, true);
      c.closePath();
      circle(c, 50, 14, 7);
    });
  },

  wifi: (c) => {
    stroke(c, 10, () => {
      for (const r of [18, 36, 54]) {
        c.moveTo(50 + r * Math.cos(-Math.PI * 0.78), 80 + r * Math.sin(-Math.PI * 0.78));
        c.arc(50, 80, r, -Math.PI * 0.78, -Math.PI * 0.22);
      }
    });
    fill(c, () => circle(c, 50, 80, 8));
  },

  house: (c) => {
    stroke(c, 9, () => {
      poly(c, [10, 50, 50, 14, 90, 50]);
      poly(c, [22, 44, 22, 88, 78, 88, 78, 44]);
    });
    fill(c, () => rrect(c, 41, 58, 59, 88, 3));
  },

  thermometer: (c) => {
    stroke(c, 8, () => {
      c.moveTo(38, 62);
      c.lineTo(38, 18);
      c.arc(50, 18, 12, Math.PI, 0);
      c.lineTo(62, 62);
    });
    fill(c, () => {
      circle(c, 50, 76, 18);
      rrect(c, 45, 34, 55, 74, 4);
    });
    stroke(c, 6, () => {
      for (const y of [22, 34, 46]) {
        c.moveTo(72, y);
        c.lineTo(84, y);
      }
    });
  },

  bulb: (c) => {
    fill(c, () => {
      c.moveTo(34, 68);
      c.bezierCurveTo(34, 56, 20, 50, 20, 36);
      c.arc(50, 36, 30, Math.PI, 0);
      c.bezierCurveTo(80, 50, 66, 56, 66, 68);
      c.closePath();
      rrect(c, 34, 72, 66, 80, 3);
      rrect(c, 38, 84, 62, 92, 4);
    });
    cutStroke(c, 5, () => {
      poly(c, [42, 66, 42, 46, 46, 40, 50, 46, 54, 40, 58, 46, 58, 66]);
    });
  },

  browser: (c) => {
    stroke(c, 8, () => rrect(c, 10, 16, 90, 86, 9));
    fill(c, () => rrect(c, 10, 16, 90, 38, [9, 9, 0, 0]));
    cutFill(c, () => {
      circle(c, 22, 27, 4);
      circle(c, 34, 27, 4);
      circle(c, 46, 27, 4);
    });
    stroke(c, 7, () => {
      c.moveTo(24, 54);
      c.lineTo(76, 54);
      c.moveTo(24, 70);
      c.lineTo(58, 70);
    });
  },

  gear: (c) => {
    const teeth = 8;
    fill(c, () => {
      for (let i = 0; i < teeth * 4; i++) {
        const a = (i / (teeth * 4)) * Math.PI * 2 - Math.PI / 2;
        const q = i % 4;
        const r = q === 1 || q === 2 ? 46 : 35;
        const x = 50 + r * Math.cos(a);
        const y = 50 + r * Math.sin(a);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.closePath();
    });
    cutFill(c, () => circle(c, 50, 50, 14));
  },

  user: (c) => {
    fill(c, () => {
      circle(c, 50, 32, 19);
      c.moveTo(14, 92);
      c.bezierCurveTo(14, 66, 30, 56, 50, 56);
      c.bezierCurveTo(70, 56, 86, 66, 86, 92);
      c.closePath();
    });
  },

  cloud: (c) => {
    fill(c, () => {
      circle(c, 32, 60, 18);
      circle(c, 54, 46, 24);
      circle(c, 74, 62, 16);
      rrect(c, 14, 58, 90, 78, 10);
    });
  },

  arrows: (c) => {
    stroke(c, 9, () => {
      c.moveTo(12, 34);
      c.lineTo(84, 34);
      poly(c, [68, 18, 86, 34, 68, 50]);
      c.moveTo(88, 66);
      c.lineTo(16, 66);
      poly(c, [32, 50, 14, 66, 32, 82]);
    });
  },

  plug: (c) => {
    fill(c, () => {
      rrect(c, 26, 34, 74, 66, 10);
      rrect(c, 35, 8, 45, 36, 4);
      rrect(c, 55, 8, 65, 36, 4);
    });
    stroke(c, 9, () => {
      c.moveTo(50, 66);
      c.bezierCurveTo(50, 80, 64, 82, 64, 94);
    });
  },

  factory: (c) => {
    fill(c, () => {
      poly(c, [8, 90, 8, 48, 30, 60, 30, 48, 52, 60, 52, 48, 70, 58, 70, 12, 88, 12, 88, 90], true);
    });
    cutFill(c, () => {
      for (const x of [16, 34, 52]) c.rect(x, 70, 10, 10);
    });
  },

  box: (c) => {
    stroke(c, 8, () => {
      poly(c, [50, 10, 88, 30, 88, 70, 50, 90, 12, 70, 12, 30], true);
      poly(c, [12, 30, 50, 50, 88, 30]);
      c.moveTo(50, 50);
      c.lineTo(50, 90);
    });
    stroke(c, 6, () => {
      poly(c, [31, 20, 69, 40]);
    });
  },

  invoice: (c) => {
    stroke(c, 8, () => {
      poly(c, [64, 8, 20, 8, 20, 92, 80, 92, 80, 24, 64, 8, 64, 24, 80, 24]);
    });
    stroke(c, 7, () => {
      c.moveTo(32, 40);
      c.lineTo(68, 40);
      c.moveTo(32, 54);
      c.lineTo(68, 54);
      c.moveTo(32, 68);
      c.lineTo(50, 68);
    });
    fill(c, () => rrect(c, 54, 72, 70, 82, 2));
  },

  chat: (c) => {
    fill(c, () => {
      rrect(c, 8, 12, 92, 70, 16);
      poly(c, [24, 64, 18, 92, 48, 66], true);
    });
    cutFill(c, () => {
      circle(c, 30, 41, 7);
      circle(c, 50, 41, 7);
      circle(c, 70, 41, 7);
    });
  },

  envelope: (c) => {
    stroke(c, 8, () => {
      rrect(c, 8, 22, 92, 80, 7);
      poly(c, [12, 28, 50, 56, 88, 28]);
    });
  },

  handshake: (c) => {
    // two cuffs
    fill(c, () => {
      poly(c, [0, 40, 14, 34, 24, 64, 10, 70], true);
      poly(c, [100, 40, 86, 34, 76, 64, 90, 70], true);
    });
    // clasped hands
    fill(c, () => {
      c.moveTo(20, 40);
      c.lineTo(40, 30);
      c.quadraticCurveTo(50, 26, 58, 32);
      c.lineTo(80, 40);
      c.lineTo(76, 62);
      c.lineTo(58, 78);
      c.quadraticCurveTo(52, 84, 46, 78);
      c.lineTo(26, 62);
      c.closePath();
    });
    // finger separations
    cutStroke(c, 4, () => {
      c.moveTo(40, 52);
      c.lineTo(56, 68);
      c.moveTo(46, 46);
      c.lineTo(62, 62);
      c.moveTo(52, 40);
      c.lineTo(68, 56);
      c.moveTo(42, 42);
      c.quadraticCurveTo(52, 36, 60, 44);
    });
    // cuff gaps
    cutStroke(c, 4, () => {
      poly(c, [14, 34, 24, 64]);
      poly(c, [86, 34, 76, 64]);
    });
  },

  barchart: (c) => {
    fill(c, () => {
      rrect(c, 14, 58, 30, 86, 3);
      rrect(c, 42, 38, 58, 86, 3);
      rrect(c, 70, 16, 86, 86, 3);
    });
    stroke(c, 7, () => {
      c.moveTo(6, 92);
      c.lineTo(94, 92);
    });
  },

  gauge: (c) => {
    stroke(c, 10, () => {
      c.arc(50, 66, 38, Math.PI, 0);
    });
    stroke(c, 5, () => {
      for (let i = 0; i <= 4; i++) {
        const a = Math.PI + (i / 4) * Math.PI;
        c.moveTo(50 + 24 * Math.cos(a), 66 + 24 * Math.sin(a));
        c.lineTo(50 + 18 * Math.cos(a), 66 + 18 * Math.sin(a));
      }
    });
    stroke(c, 7, () => {
      c.moveTo(50, 66);
      c.lineTo(70, 38);
    });
    fill(c, () => circle(c, 50, 66, 8));
  },

  check: (c) => {
    stroke(c, 8, () => circle(c, 50, 50, 40));
    stroke(c, 11, () => poly(c, [30, 52, 44, 66, 70, 36]));
  },

  target: (c) => {
    stroke(c, 8, () => {
      circle(c, 50, 50, 40);
      circle(c, 50, 50, 24);
    });
    fill(c, () => circle(c, 50, 50, 10));
  },

  textlines: (c) => {
    stroke(c, 9, () => {
      c.moveTo(12, 22);
      c.lineTo(88, 22);
      c.moveTo(12, 40);
      c.lineTo(88, 40);
      c.moveTo(12, 58);
      c.lineTo(76, 58);
      c.moveTo(12, 76);
      c.lineTo(56, 76);
    });
  },
};
