import { MONO } from "../../lib/fonts";
import { HEX, Rng, binString, hash01, hexString, int, pick, range } from "../../lib/random";

// Panel content for Data Screens. Each panel is drawn in its own "design
// pixel" space; the scene scales it into a texture. Live panels expose a
// key(frame) -> integer; the texture is redrawn only when the key changes and
// the drawing is a pure function of that key.

export type PanelType =
  | "hex"
  | "binary"
  | "table"
  | "form"
  | "paragraph"
  | "marker"
  | "bracket"
  | "code"
  | "bars";

export interface PanelSpec {
  type: PanelType;
  seed: number;
  w: number; // design px
  h: number;
  live: boolean;
  period: number; // frames per step, divides 600
  key: (frame: number) => number;
  draw: (c: CanvasRenderingContext2D, key: number) => void;
}

const PERIODS = [4, 5, 6, 8, 10, 12, 15, 20, 24, 25, 30];

const letters = (r: Rng, n: number) => {
  let s = "";
  for (let i = 0; i < n; i++) s += String.fromCharCode(65 + Math.floor(r() * 26));
  return s;
};

const font = (c: CanvasRenderingContext2D, size: number, weight = 400) => {
  c.font = `${weight} ${size}px "${MONO}"`;
};

// mutate a few characters of a string, deterministically from (seed,row,key)
const roll = (s: string, seed: number, row: number, key: number, n: number, alphabet = HEX) => {
  const a = s.split("");
  for (let k = 0; k < n; k++) {
    const j = Math.floor(hash01(seed, row, key, k) * a.length);
    if (a[j] !== " ") a[j] = alphabet[Math.floor(hash01(seed, row, key, k, 7) * alphabet.length)];
  }
  return a.join("");
};

const IDENT = ["scan", "node", "trace", "link", "buf", "lvl", "grid", "seg", "chk", "idx", "rate", "sig", "gate", "pkt", "vec"];

const codeLine = (r: Rng) => {
  const a = pick(r, IDENT);
  const b = pick(r, IDENT);
  switch (int(r, 0, 7)) {
    case 0:
      return `if (${a} > ${int(r, 0, 999)}) { ${b}++; }`;
    case 1:
      return `${a}.${b}(${int(r, 0, 64)}, 0x${hexString(r, 4)});`;
    case 2:
      return `${a}_${b} = ${b}[${int(r, 0, 31)}] ^ ${int(r, 1, 255)};`;
    case 3:
      return `loop ${a} in 0..${int(r, 8, 128)} {`;
    case 4:
      return `  emit(${a}, ${b.toUpperCase()}_${int(r, 10, 99)});`;
    case 5:
      return `}`;
    case 6:
      return `// ${a} ${hexString(r, 8)}`;
    default:
      return `ret ${a} | ${b} << ${int(r, 1, 8)};`;
  }
};

export const makePanel = (r: Rng, type: PanelType, live: boolean, big: boolean): PanelSpec => {
  const seed = Math.floor(r() * 1e9);
  const period = pick(r, PERIODS);
  const stepKey = (f: number) => Math.floor(f / period) % (600 / period);
  const still = () => 0;

  switch (type) {
    case "hex": {
      const cols = int(r, 10, 38);
      const rows = int(r, 3, 13);
      const size = 14;
      const lh = 17;
      const lines = Array.from({ length: rows }, () => {
        const n = r() < 0.25 ? int(r, 4, cols) : cols;
        return hexString(r, n);
      });
      const w = cols * size * 0.6 + 8;
      const h = rows * lh + 6;
      return {
        type, seed, w, h, live, period,
        key: live ? stepKey : still,
        draw: (c, key) => {
          font(c, size, 500);
          lines.forEach((s, i) => {
            c.fillText(live ? roll(s, seed, i, key, 3) : s, 4, (i + 1) * lh);
          });
        },
      };
    }
    case "binary": {
      const n = big ? int(r, 10, 14) : int(r, 6, 16);
      const rows = big ? int(r, 1, 2) : int(r, 1, 4);
      const size = big ? 64 : 18;
      const lines = Array.from({ length: rows }, () => binString(r, n, " "));
      const w = n * 2 * size * 0.6 + 10;
      const h = rows * size * 1.25 + 10;
      return {
        type, seed, w, h, live, period,
        key: live ? stepKey : still,
        draw: (c, key) => {
          font(c, size, big ? 700 : 500);
          lines.forEach((s, i) => {
            c.fillText(live ? roll(s, seed, i, key, 2, "01") : s, 5, (i + 1) * size * 1.2);
          });
        },
      };
    }
    case "table": {
      const rows = int(r, 3, 6);
      const head = pick(r, ["PASS_LOGIN", "NODE_TABLE", "LINK_MAP", "SCAN_LIST"]);
      const data = Array.from({ length: rows }, () => {
        const a = `${letters(r, 2)} = ${letters(r, 3)}-${letters(r, 5)}${int(r, 1000, 9999)}`;
        const z = "0".repeat(int(r, 10, 15));
        const b = `${letters(r, 3)} + ${letters(r, 3)}${letters(r, 4)}- ${letters(r, 3)}`;
        return [a, z, b];
      });
      const size = 13;
      const lh = 19;
      const w = 560;
      const h = (rows + 1) * lh + 12;
      return {
        type, seed, w, h, live, period,
        key: live ? (f) => Math.floor(f / (period * 3)) % rows : () => (seed % rows),
        draw: (c, key) => {
          font(c, size, 500);
          c.fillText(head, 4, lh - 2);
          c.fillRect(4, lh + 2, w - 8, 1.5);
          data.forEach((row, i) => {
            const y = (i + 2) * lh;
            if (i === key && (live || seed % 3 === 0)) {
              c.fillRect(2, y - lh + 6, w - 4, lh - 2);
              c.globalCompositeOperation = "destination-out";
            }
            c.fillText(row[0], 6, y);
            c.fillText(row[1], 216, y);
            c.fillText(row[2], 380, y);
            c.globalCompositeOperation = "source-over";
          });
        },
      };
    }
    case "form": {
      const rows = int(r, 3, 7);
      const fields = Array.from({ length: rows }, () => [
        `${pick(r, ["NODE", "PORT", "SEQ", "UNIT", "ZONE", "BAND", "CELL"])} ${int(r, 1, 99)}`,
        r() < 0.5 ? hexString(r, int(r, 2, 6)) : String(int(r, 0, 9999)),
      ]);
      const size = 12;
      const lh = 18;
      const w = 300;
      const h = rows * lh + 30;
      return {
        type, seed, w, h, live, period,
        key: live ? stepKey : still,
        draw: (c, key) => {
          c.lineWidth = 1.2;
          c.strokeStyle = "#fff";
          c.strokeRect(1, 1, w - 2, h - 2);
          font(c, 10, 700);
          c.fillText(pick(() => hash01(seed), ["ACCESS", "SESSION", "PROFILE", "STATUS"]), 8, 15);
          font(c, size, 400);
          fields.forEach(([k, v], i) => {
            const y = 22 + (i + 1) * lh;
            c.fillText(k, 8, y);
            // dotted field
            for (let x = 92; x < 220; x += 4) c.fillRect(x, y - 1, 1.5, 1.5);
            c.fillText(live && i === key % rows ? roll(v, seed, i, key, 2) : v, 226, y);
          });
        },
      };
    }
    case "paragraph": {
      const rows = int(r, 6, 18);
      const cols = int(r, 30, 70);
      const size = 8;
      const lh = 10;
      const lines = Array.from({ length: rows }, () => {
        let s = "";
        while (s.length < cols) s += (r() < 0.5 ? letters(r, int(r, 2, 8)).toLowerCase() : hexString(r, int(r, 2, 6))) + " ";
        return s.slice(0, r() < 0.2 ? int(r, 8, cols) : cols);
      });
      const w = cols * size * 0.6 + 6;
      const h = rows * lh + 4;
      return {
        type, seed, w, h, live, period,
        key: live ? stepKey : still,
        draw: (c, key) => {
          font(c, size);
          lines.forEach((s, i) => c.fillText(live ? roll(s, seed, i, key, 6) : s, 3, (i + 1) * lh));
        },
      };
    }
    case "marker": {
      const num = int(r, 10000, 99999);
      const w = 150;
      const h = 34;
      return {
        type, seed, w, h, live, period,
        key: live ? (f) => Math.floor(f / (period * 2)) % (300 / period) : still,
        draw: (c, key) => {
          c.beginPath();
          c.moveTo(4, 28);
          c.lineTo(15, 8);
          c.lineTo(26, 28);
          c.closePath();
          c.fill();
          font(c, 22, 500);
          const v = live ? 10000 + Math.floor(hash01(seed, key) * 89999) : num;
          c.fillText(String(v), 36, 28);
        },
      };
    }
    case "bracket": {
      const cols = int(r, 7, 11);
      const rows = int(r, 5, 8);
      const size = 20;
      const cw = 26;
      const lh = 26;
      const cells = Array.from({ length: rows }, () => hexString(r, cols));
      const w = cols * cw + 36;
      const h = rows * lh + 36;
      return {
        type, seed, w, h, live, period,
        key: live ? stepKey : still,
        draw: (c, key) => {
          c.lineWidth = 1.5;
          c.strokeStyle = "#fff";
          const a = 18;
          c.beginPath();
          c.moveTo(1, a); c.lineTo(1, 1); c.lineTo(a, 1);
          c.moveTo(w - a, 1); c.lineTo(w - 1, 1); c.lineTo(w - 1, a);
          c.moveTo(w - 1, h - a); c.lineTo(w - 1, h - 1); c.lineTo(w - a, h - 1);
          c.moveTo(a, h - 1); c.lineTo(1, h - 1); c.lineTo(1, h - a);
          c.stroke();
          font(c, size, 400);
          cells.forEach((s, i) => {
            const row = live ? roll(s, seed, i, key, 2) : s;
            for (let k = 0; k < row.length; k++) c.fillText(row[k], 18 + k * cw, 18 + (i + 1) * lh - 6);
          });
        },
      };
    }
    case "code": {
      const rows = int(r, 6, 14);
      const lines = Array.from({ length: rows }, () => codeLine(r));
      const size = 13;
      const lh = 17;
      const w = 330;
      const h = rows * lh + 6;
      const total = lines.reduce((a, s) => a + s.length, 0);
      // type in, hold, clear: one cycle = 300 frames (divides 600)
      const cycle = 300;
      return {
        type, seed, w, h, live, period,
        key: live ? (f) => {
          const p = (f % cycle) / cycle;
          if (p > 0.92) return 0;
          return Math.min(total, Math.floor((p / 0.7) * total / 3) * 3);
        } : () => total,
        draw: (c, key) => {
          font(c, size, 400);
          let left = key;
          lines.forEach((s, i) => {
            if (left <= 0) return;
            const shown = s.slice(0, left);
            left -= s.length;
            c.fillText(shown, 4, (i + 1) * lh);
            if (left < 0) {
              const m = c.measureText(shown).width;
              c.fillRect(6 + m, i * lh + 5, 7, 13);
            }
          });
        },
      };
    }
    case "bars":
    default: {
      const n = int(r, 4, 9);
      const vals = Array.from({ length: n }, () => range(r, 0.15, 1));
      const labels = Array.from({ length: n }, () => `${letters(r, 3)} ${int(r, 10, 99)}`);
      const w = 280;
      const h = n * 16 + 8;
      return {
        type, seed, w, h, live, period,
        key: live ? stepKey : still,
        draw: (c, key) => {
          font(c, 11, 500);
          vals.forEach((v0, i) => {
            const v = live ? 0.15 + 0.85 * hash01(seed, i, key) : v0;
            const y = 4 + i * 16;
            c.fillText(labels[i], 2, y + 11);
            c.fillRect(70, y + 2, 190 * v, 9);
            c.fillRect(70 + 190 * v + 4, y + 2, 1, 9);
          });
        },
      };
    }
  }
};
