import * as THREE from "three";
import { mulberry32, pick, Rand } from "../lib/random";

// Generic, made-up pseudo-code. Every identifier is assembled from neutral
// syllables/words below; none is taken from a real library or product.
const VERBS = ["set", "get", "load", "sync", "push", "pull", "bind", "scan", "emit", "flush", "merge", "parse", "route", "probe", "fold", "seal", "spin", "warp", "trace", "patch"];
const NOUNS = ["Node", "Flux", "Grid", "Frame", "Packet", "Vector", "Cell", "Stream", "Queue", "Shard", "Pulse", "Index", "Block", "Field", "Token", "Layer", "Slot", "Path", "Mesh", "Core"];
const VARS = ["ctx", "buf", "pkt", "idx", "node", "cell", "val", "rc", "len", "ptr", "acc", "lim", "seg", "tmp", "hdr", "row", "col", "mask", "key", "obj"];
const CONSTS = ["MODE_IDLE", "FX_READY", "VX_OPEN", "NX_ERR_FULL", "ZQ_TIMEOUT", "KV_MAX", "GRID_SIZE", "FLAG_LOCK", "PX_DEPTH", "QN_RETRY", "LOOP_LIMIT", "STATE_ON"];
const STRS = ["\"failed to sync %s\"", "\"node %d ready\"", "\"retry in %dms\"", "\"cell out of range\"", "\"buffer sealed\"", "\"path [%s]\"", "\"queue full\"", "\"init ok\""];

const ident = (r: Rand) => pick(r, VERBS) + pick(r, NOUNS) + (r() < 0.3 ? pick(r, NOUNS) : "");
const hex = (r: Rand) => "0x" + Math.floor(r() * 0xffff).toString(16).toUpperCase().padStart(4, "0");
const arg = (r: Rand) => {
  const k = r();
  if (k < 0.45) return pick(r, VARS);
  if (k < 0.6) return pick(r, CONSTS);
  if (k < 0.72) return String(Math.floor(r() * 512));
  if (k < 0.82) return hex(r);
  if (k < 0.9) return "&" + pick(r, VARS);
  return pick(r, STRS);
};
const call = (r: Rand) => {
  const n = Math.floor(r() * 3) + 1;
  return `${ident(r)}(${Array.from({ length: n }, () => arg(r)).join(", ")})`;
};

export function codeLines(r: Rand, count: number): string[] {
  const out: string[] = [];
  let depth = 0;
  while (out.length < count) {
    const ind = "  ".repeat(depth);
    const k = r();
    if (k < 0.12 && depth < 3) {
      out.push(`${ind}if (${pick(r, VARS)} ${pick(r, ["==", "!=", "<", ">="])} ${arg(r)}) {`);
      depth++;
    } else if (k < 0.18 && depth < 3) {
      out.push(`${ind}for (${pick(r, VARS)} = 0; ${pick(r, VARS)} < ${pick(r, CONSTS)}; ++${pick(r, VARS)}) {`);
      depth++;
    } else if (k < 0.3 && depth > 0) {
      out.push(`${"  ".repeat(depth - 1)}}`);
      depth--;
    } else if (k < 0.5) {
      out.push(`${ind}${pick(r, VARS)} = ${call(r)};`);
    } else if (k < 0.62) {
      out.push(`${ind}${call(r)};`);
    } else if (k < 0.7) {
      out.push(`${ind}return ${pick(r, ["false", "true", "0", "rc", pick(r, VARS)])};`);
    } else if (k < 0.78) {
      out.push(`${ind}${pick(r, VARS)}->${pick(r, VARS)} = ${arg(r)};`);
    } else if (k < 0.84) {
      out.push(`${ind}log(${pick(r, STRS)}, ${pick(r, VARS)});`);
    } else if (k < 0.9) {
      out.push("");
    } else {
      out.push(`${ind}${pick(r, VARS)} += ${arg(r)};`);
    }
  }
  return out;
}

// Six code variants packed into one 3x2 atlas (each cell CELL_W x CELL_H).
export const ATLAS_COLS = 3;
export const ATLAS_ROWS = 2;
export const CELL_W = 1024;
export const CELL_H = 2048;

export function makeCodeAtlas(seed: number) {
  const r = mulberry32(seed);
  const canvas = document.createElement("canvas");
  canvas.width = CELL_W * ATLAS_COLS;
  canvas.height = CELL_H * ATLAS_ROWS;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.textBaseline = "top";
  for (let v = 0; v < 6; v++) {
    const ox = (v % ATLAS_COLS) * CELL_W;
    const oy = Math.floor(v / ATLAS_COLS) * CELL_H;
    g.save();
    g.beginPath();
    g.rect(ox, oy, CELL_W, CELL_H);
    g.clip();
    // Variants differ in text size and in how many columns of code they hold.
    const size = [22, 28, 18, 36, 24, 20][v];
    const cols = [2, 1, 2, 1, 2, 3][v];
    const lh = Math.round(size * 1.45);
    g.font = `400 ${size}px "JetBrains Mono"`;
    const colW = CELL_W / cols;
    for (let c = 0; c < cols; c++) {
      const lines = codeLines(r, Math.floor(CELL_H / lh));
      lines.forEach((line, i) => {
        // A few lines are highlighted (brighter), most are dim.
        const hi = r() < 0.12;
        const a = hi ? 1 : 0.35 + r() * 0.35;
        g.fillStyle = `rgba(255,255,255,${a})`;
        g.fillText(line, ox + c * colW + 16, oy + i * lh + 4, colW - 24);
      });
    }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// A single long line of code as a texture (for the near, blurred lines).
export function makeLineTexture(seed: number, count: number) {
  const r = mulberry32(seed);
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 128 * count;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.font = `400 72px "JetBrains Mono"`;
  g.textBaseline = "middle";
  g.fillStyle = "#fff";
  for (let i = 0; i < count; i++) {
    const s = r() < 0.5 ? `${pick(r, VARS)} = ${call(r)};` : `${call(r)};`;
    g.fillText(s, 20, i * 128 + 64, 2000);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}
