import React, { useMemo } from "react";
import * as THREE from "three";
import { getAtlas, Atlas, CELL_H, CELL_W, FONT_PX, Glyph } from "../lib/atlas";
import { hexToRgb } from "../lib/color";
import { applyDof, DofParams, makeLines, makeSprites } from "../lib/gl/primitives";
import { PostParams } from "../lib/gl/post";
import { GLStage, SceneFactory } from "../lib/gl/Stage";
import { hash01, mulberry32, Rng, TAU } from "../lib/random";
import land from "../data/ne_110m_land.json";
import type { DataMapRow } from "../versions";

// A world map on a plane, built from ~600 tiny data tags placed on Natural
// Earth 1:110m land (public domain), with coastline traces and HUD lines.
// Plane coords: x = lon * K, y = lat * K (equirectangular).
const K = 0.05;
const TAG_TARGET = 600;
const POLYS = (land as unknown as { polygons: [number, number][][] }).polygons;

const inLand = (lon: number, lat: number) => {
  let inside = false;
  for (const ring of POLYS) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
};

type TagKind = "pct" | "dual" | "code" | "tri" | "bar" | "chip" | "cross";
type Tag = {
  kind: TagKind;
  x: number; // left
  y: number; // bottom
  w: number;
  h: number;
  text: string; // static text (codes)
  value: number; // static value
  tick: number; // 0 = static, else period in frames (divides 600)
  tickOff: number;
  blink: number; // 0 = never, else period
  blinkOff: number;
  tone: 0 | 1 | 2; // 0 base, 1 highlight, 2 accent
};

type Seg = { ax: number; ay: number; bx: number; by: number; alpha: number; width: number; tag: number; tone: 0 | 1 | 2 };
type TextItem = { x: number; y: number; size: number; text: string; font: "num" | "code"; alpha: number; tone: 0 | 1 | 2 };

const WORDS = ["PATH", "NODE", "LINK", "DATA", "SYNC", "GRID", "ZONE", "CORE", "SCAN", "PING"];
const LET = "ABCDEFGHJKLMNPRSTUVWXYZ";
const code4 = (rng: Rng) => {
  const pick = (s: string) => s[Math.floor(rng() * s.length)];
  const d = () => String(Math.floor(rng() * 10));
  const patterns = [() => pick(LET) + pick(LET) + d() + pick(LET), () => pick(LET) + d() + d() + d(), () => pick(LET) + pick(LET) + d() + d()];
  return patterns[Math.floor(rng() * patterns.length)]();
};
const TICKS = [30, 40, 50, 60, 75, 100, 120, 150];

type Layout = { tags: Tag[]; segs: Seg[]; texts: TextItem[] };
const cache = new Map<number, Layout>();

export const buildLayout = (seed: number): Layout => {
  const c = cache.get(seed);
  if (c) return c;
  const rng = mulberry32(seed);
  const tags: Tag[] = [];
  const boxes: [number, number, number, number][] = [];
  const free = (x: number, y: number, w: number, h: number) =>
    boxes.every(([bx, by, bw, bh]) => x + w < bx - 0.008 || bx + bw < x - 0.008 || y + h < by - 0.006 || by + bh < y - 0.006);
  const onLand = (x: number, y: number, w: number, h: number) =>
    inLand((x + w * 0.5) / K, (y + h * 0.5) / K) && (inLand(x / K, y / K) || inLand((x + w) / K, (y + h) / K));
  const TS = 1.12;
  const sizes: Record<TagKind, [number, number]> = {
    pct: [0.42 * TS, 0.17 * TS],
    dual: [0.62 * TS, 0.15 * TS],
    code: [0.27 * TS, 0.15 * TS],
    tri: [0.36 * TS, 0.09 * TS],
    bar: [0.4 * TS, 0.075 * TS],
    chip: [0.3 * TS, 0.09 * TS],
    cross: [0.12 * TS, 0.12 * TS],
  };
  const kinds: [TagKind, number][] = [
    ["pct", 0.2],
    ["code", 0.24],
    ["tri", 0.17],
    ["bar", 0.15],
    ["chip", 0.1],
    ["dual", 0.06],
    ["cross", 0.04],
  ];
  const pickKind = () => {
    let r = rng();
    for (const [k, w] of kinds) {
      if ((r -= w) <= 0) return k;
    }
    return "code" as TagKind;
  };
  // Jittered grid over the map, visited in a seeded order; each cell tries
  // a tag kind and keeps it if it sits on land and doesn't collide.
  const GX = 0.14;
  const GY = 0.075;
  const cells: [number, number][] = [];
  for (let y = -58 * K; y < 80 * K; y += GY) for (let x = -170 * K; x < 180 * K; x += GX) cells.push([x, y]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  for (const [cx, cy] of cells) {
    if (tags.length >= TAG_TARGET) break;
    for (let attempt = 0; attempt < 6; attempt++) {
      const kind = attempt === 5 ? (rng() < 0.35 ? "cross" : "tri") : pickKind();
      const [w, h] = sizes[kind];
      const x = cx + (rng() - 0.5) * GX * 0.8;
      const y = cy + (rng() - 0.5) * GY * 0.8;
      if (!onLand(x, y, w, h) || !free(x, y, w, h)) continue;
      boxes.push([x, y, w, h]);
      const ticking = (kind === "pct" || kind === "dual" || kind === "bar" || kind === "tri") && rng() < 0.72;
      const r = rng();
      tags.push({
        kind,
        x,
        y,
        w,
        h,
        text: WORDS[Math.floor(rng() * WORDS.length)] + " " + code4(rng),
        value: Math.floor(rng() * 99) + 1,
        tick: ticking ? TICKS[Math.floor(rng() * TICKS.length)] : 0,
        tickOff: Math.floor(rng() * 600),
        blink: rng() < 0.05 ? [20, 30, 40][Math.floor(rng() * 3)] : 0,
        blinkOff: Math.floor(rng() * 600),
        tone: r < 0.12 ? 1 : r < 0.2 ? 2 : 0,
      });
      break;
    }
  }

  const segs: Seg[] = [];
  const line = (ax: number, ay: number, bx: number, by: number, alpha: number, width = 1.6, tag = -1, tone: 0 | 1 | 2 = 0) =>
    segs.push({ ax, ay, bx, by, alpha, width, tag, tone });
  const rect = (x: number, y: number, w: number, h: number, alpha: number, width = 1.6, tag = -1, tone: 0 | 1 | 2 = 0) => {
    line(x, y, x + w, y, alpha, width, tag, tone);
    line(x + w, y, x + w, y + h, alpha, width, tag, tone);
    line(x + w, y + h, x, y + h, alpha, width, tag, tone);
    line(x, y + h, x, y, alpha, width, tag, tone);
  };
  const plus = (x: number, y: number, s: number, alpha: number, width = 1.6) => {
    line(x - s, y, x + s, y, alpha, width);
    line(x, y - s, x, y + s, alpha, width);
  };
  tags.forEach((t, i) => {
    if (t.kind === "pct") rect(t.x, t.y, t.w, t.h, 0.85, 1.8, i, t.tone);
    if (t.kind === "dual") {
      rect(t.x, t.y, t.w * 0.47, t.h, 0.8, 1.6, i, t.tone);
      rect(t.x + t.w * 0.53, t.y, t.w * 0.47, t.h, 0.8, 1.6, i, t.tone);
    }
    if (t.kind === "bar") rect(t.x + t.w * 0.42, t.y + t.h * 0.1, t.w * 0.58, t.h * 0.8, 0.8, 1.5, i, t.tone);
    if (t.kind === "chip") {
      rect(t.x, t.y + t.h * 0.1, t.w * 0.38, t.h * 0.8, 0.85, 1.6, i, t.tone);
      line(t.x + t.w * 0.38, t.y + t.h * 0.35, t.x + t.w * 0.38, t.y + t.h * 0.65, 0.85, 3, i, t.tone);
    }
    if (t.kind === "cross") {
      const cx = t.x + t.w / 2;
      const cy = t.y + t.h / 2;
      line(cx - t.w / 2, cy, cx - t.w * 0.12, cy, 0.7, 1.4, i, t.tone);
      line(cx + t.w * 0.12, cy, cx + t.w / 2, cy, 0.7, 1.4, i, t.tone);
      line(cx, cy - t.h / 2, cx, cy - t.h * 0.12, 0.7, 1.4, i, t.tone);
      line(cx, cy + t.h * 0.12, cx, cy + t.h / 2, 0.7, 1.4, i, t.tone);
    }
  });
  // Coastline traces.
  for (const ring of POLYS)
    for (let i = 0; i < ring.length; i++) {
      const [a0, a1] = ring[i];
      const [b0, b1] = ring[(i + 1) % ring.length];
      if (Math.abs(a0 - b0) > 90) continue;
      line(a0 * K, a1 * K, b0 * K, b1 * K, 0.42, 1.5);
    }

  // HUD around the map (same plane).
  const texts: TextItem[] = [];
  const label = (x: number, y: number, size: number, text: string, alpha = 0.75, font: "num" | "code" = "code", tone: 0 | 1 | 2 = 0) =>
    texts.push({ x, y, size, text, font, alpha, tone });
  // Long horizontal rules and ticks under the map.
  for (let k = 0; k < 9; k++) {
    const y = -3.25 - k * 0.42 - rng() * 0.12;
    const x0 = -11 + rng() * 6;
    const x1 = x0 + 4 + rng() * 10;
    line(x0, y, x1, y, 0.22 + rng() * 0.2, 1.4);
    for (let t = x0; t < x1; t += 0.5 + rng() * 0.8) line(t, y, t, y + 0.06, 0.25, 1.3);
  }
  // Faint panel grid behind everything.
  for (let x = -14; x <= 14; x += 3.5) line(x, -8, x, 7, 0.07, 1.3);
  for (let y = -8; y <= 7; y += 1.5) line(-14, y, 14, y, 0.06, 1.3);
  // A few diagonal/vertical accents.
  for (let k = 0; k < 6; k++) {
    const x = -9 + rng() * 18;
    const y = -6 + rng() * 2;
    line(x, y, x + 0.6 + rng(), y + 0.9 + rng(), 0.25, 1.3);
  }
  // Bar columns on the right.
  for (let col = 0; col < 4; col++) {
    const x = 9.0 + col * 0.95;
    for (let r = 0; r < 26; r++) {
      const y = -6.5 + r * 0.42;
      const w = 0.35 + rng() * 0.45;
      rect(x, y, w, 0.12, 0.3 + rng() * 0.2, 1.4);
    }
  }
  // Dense faint data panels around the map: rows of codes and block bars.
  for (let k = 0; k < 520; k++) {
    const x = -13 + rng() * 26;
    const y = -8 + rng() * 15;
    if (inLand(x / K, y / K) || inLand((x + 0.4) / K, y / K)) continue;
    const r = rng();
    if (r < 0.45) label(x, y, 0.08 + rng() * 0.06, code4(rng) + (rng() < 0.5 ? " " + code4(rng) : ""), 0.3 + rng() * 0.3);
    else if (r < 0.75) {
      const n = 3 + Math.floor(rng() * 6);
      for (let b = 0; b < n; b++) rect(x + b * 0.13, y, 0.09, 0.05 + rng() * 0.06, 0.28 + rng() * 0.2, 1.3);
    } else line(x, y, x + 0.5 + rng() * 2.2, y, 0.2 + rng() * 0.2, 1.3);
  }
  // Long vertical traces through the scene.
  for (let k = 0; k < 14; k++) {
    const x = -12 + rng() * 24;
    const y0 = -8 + rng() * 6;
    line(x, y0, x, y0 + 3 + rng() * 8, 0.1 + rng() * 0.12, 1.2);
  }
  // Dashboard panels: framed boxes holding rows of text and bars, in the
  // margins around the map, plus right-edge data columns.
  const panel = (x: number, y: number, w: number, h: number) => {
    rect(x, y, w, h, 0.32, 1.5);
    line(x, y + h - 0.16, x + w, y + h - 0.16, 0.28, 1.4);
    label(x + 0.06, y + h - 0.08, 0.075, WORDS[Math.floor(rng() * WORDS.length)] + " " + code4(rng), 0.55);
    for (let ry = y + h - 0.3; ry > y + 0.08; ry -= 0.16) {
      if (rng() < 0.5) label(x + 0.06, ry, 0.07, code4(rng) + "  " + code4(rng), 0.32 + rng() * 0.2);
      else {
        const bw = (w - 0.12) * (0.3 + rng() * 0.7);
        rect(x + 0.06, ry - 0.035, bw, 0.07, 0.3 + rng() * 0.2, 1.3);
      }
    }
  };
  panel(-12.5, -6.2, 3.2, 1.9);
  panel(-8.8, -7.2, 2.6, 1.5);
  panel(-4.6, -6.6, 3.4, 1.4);
  panel(10.0, -2.8, 2.6, 2.6);
  panel(10.2, 0.4, 2.4, 1.8);
  panel(2.4, -7.0, 3.0, 1.3);
  panel(-12.8, 0.6, 2.4, 1.6);
  for (let c = 0; c < 3; c++)
    for (let r = 0; r < 22; r++) {
      label(9.7 + c * 1.05, -6.8 + r * 0.5, 0.08, code4(rng), 0.32 + rng() * 0.25);
      rect(9.7 + c * 1.05 + 0.45, -6.84 + r * 0.5, 0.2 + rng() * 0.35, 0.07, 0.3 + rng() * 0.2, 1.3);
    }
  // Vertical rules and a header strip of small text along the far edge.
  for (const x of [-9.5, -8.9, 4.6, 9.4]) line(x, -8, x, 6.5, 0.22, 1.4);
  for (let k = 0; k < 10; k++) label(-8 + k * 1.9 + rng() * 0.5, 4.75, 0.09, code4(rng) + " " + code4(rng).slice(0, 2), 0.45);
  // Scanline-like streaks.
  for (let k = 0; k < 40; k++) {
    const y = -8 + rng() * 15;
    const x = -13 + rng() * 22;
    line(x, y, x + 1 + rng() * 5, y, 0.08 + rng() * 0.1, 1.2);
  }
  // Labels.
  label(-6.6, -3.1, 0.13, "LOADING", 0.8);
  label(-1.2, -3.35, 0.16, "F2", 0.7);
  label(1.6, -5.4, 0.14, "G895", 0.6);
  label(-3.4, 4.25, 0.1, "H806", 0.6);
  label(5.3, 4.3, 0.1, "T 817  A1", 0.55);
  label(9.4, 2.55, 0.13, "PATH", 0.8);
  label(9.4, 2.32, 0.13, code4(rng), 0.8);
  label(-8.8, -1.6, 0.1, "PATH", 0.7);
  label(-8.8, -1.78, 0.1, code4(rng), 0.7);
  line(9.4, 2.5, 10.3, 2.5, 0.6, 1.5);
  line(-6.6, -3.15, -5.4, -3.15, 0.5, 1.5);
  for (let k = 0; k < 8; k++) label(-12 + rng() * 22, -7.5 + rng() * 3.6, 0.09, code4(rng), 0.35);
  // Scatter of + marks.
  for (let k = 0; k < 130; k++) {
    const x = -13 + rng() * 26;
    const y = -7.5 + rng() * 14;
    if (inLand(x / K, y / K)) continue;
    plus(x, y, 0.05, 0.4 + rng() * 0.4, 1.7);
  }
  const out = { tags, segs, texts };
  cache.set(seed, out);
  return out;
};

// Values that tick: a function of the loop frame only.
const tickValue = (t: Tag, i: number, frame: number, salt = 0) => {
  if (!t.tick) return salt ? (t.value * 37 + salt * 11) % 99 + 1 : t.value;
  const f = (frame + t.tickOff) % 600;
  const k = Math.floor(f / t.tick) % (600 / t.tick);
  return Math.floor(hash01(i, k, salt) * 99) + 1;
};
const visible = (t: Tag, frame: number) => {
  if (!t.blink) return 1;
  const f = (frame + t.blinkOff) % 600;
  return f % t.blink < t.blink * 0.55 ? 1 : 0;
};

// Camera: slow cosine drift (one whole cycle) plus a tiny push in/out.
const W = 3840;
const H = 2160;
const FOV = 36;
const cameraAt = (frame: number) => {
  const ph = (frame / 600) * TAU;
  const cam = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 200);
  const target = new THREE.Vector3(1.3 + 0.55 * Math.cos(ph), -0.2 + 0.25 * Math.sin(ph), 0);
  const push = 1 + 0.035 * Math.cos(ph + 1.1);
  const offset = new THREE.Vector3(4.7, -7.3, 10.2).multiplyScalar(push);
  cam.position.copy(target).add(offset);
  cam.up.set(0, 0.2, 1).normalize();
  cam.lookAt(target);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return { cam, focus: offset.length() };
};

const makeFactory = (row: DataMapRow): SceneFactory => () => {
  const layout = buildLayout(row.seed);
  const atlas: Atlas = getAtlas();
  const tones = [hexToRgb(row.tag), hexToRgb(row.highlight), hexToRgb(row.accent)];

  const lines = makeLines(layout.segs.length, true);
  layout.segs.forEach((s, n) => {
    lines.a.set([s.ax, s.ay, 0], n * 3);
    lines.b.set([s.bx, s.by, 0], n * 3);
    lines.width[n] = s.width;
  });
  lines.touch({ pos: true, width: true });

  // Upper bound of sprite instances: 10 glyphs per tag + HUD texts.
  const maxSprites = layout.tags.length * 12 + layout.texts.reduce((a, t) => a + t.text.length, 0) + 16;
  const sprites = makeSprites(maxSprites, atlas.sharp, atlas.blur, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0));

  let count = 0;
  const putGlyph = (g: Glyph, x: number, y: number, size: number, rgb: number[], alpha: number) => {
    // x,y: pen position (left, baseline-centre) in plane units; size = font size.
    const s = size / FONT_PX;
    const qw = CELL_W * s;
    const qh = CELL_H * s;
    const cx = x + (g.adv * size) / 2;
    const o = count;
    sprites.p.set([cx - qw / 2, y - qh / 2, 0], o * 3);
    sprites.size.set([qw, qh], o * 2);
    sprites.uv.set([g.u0, g.v0, g.u1, g.v1], o * 4);
    sprites.color.set([rgb[0], rgb[1], rgb[2], alpha], o * 4);
    count++;
    return g.adv * size;
  };
  const putText = (text: string, font: "num" | "code", x: number, y: number, size: number, rgb: number[], alpha: number, track = 0.04) => {
    let pen = x;
    for (const ch of text) {
      if (ch === " ") {
        pen += size * 0.45;
        continue;
      }
      pen += putGlyph(atlas.glyph(font, ch), pen, y, size, rgb, alpha) + size * track;
    }
    return pen - x;
  };
  const putFill = (x: number, y: number, w: number, h: number, rgb: number[], alpha: number) => {
    // The fill cell has a 24px margin inside a CELL_W x CELL_H cell.
    const g = atlas.fill;
    const sx = w / (CELL_W - 48);
    const sy = h / (CELL_H - 48);
    const o = count;
    sprites.p.set([x - 24 * sx, y - 24 * sy, 0], o * 3);
    sprites.size.set([CELL_W * sx, CELL_H * sy], o * 2);
    sprites.uv.set([g.u0, g.v0, g.u1, g.v1], o * 4);
    sprites.color.set([rgb[0], rgb[1], rgb[2], alpha], o * 4);
    count++;
  };

  const scene = new THREE.Scene();
  scene.add(lines.mesh, sprites.mesh);
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 200);
  const dof: DofParams = { focus: 10, coc: 40, cocMax: 16, fade: [-1, 0, 12, 17.5], farFloor: 0.3, near: 0.1 };

  return {
    scene,
    camera,
    update: (frame, res) => {
      const { cam, focus } = cameraAt(frame);
      camera.position.copy(cam.position);
      camera.quaternion.copy(cam.quaternion);
      camera.projectionMatrix.copy(cam.projectionMatrix);
      camera.updateMatrixWorld();
      dof.focus = focus;
      dof.fade[2] = focus + 0.6;
      dof.fade[3] = focus + 6;

      // Line colours (blinking tags switch their outline too).
      layout.segs.forEach((s, n) => {
        const vis = s.tag >= 0 ? visible(layout.tags[s.tag], frame) : 1;
        const c = tones[s.tone];
        lines.color.set([c[0], c[1], c[2], s.alpha * vis], n * 4);
      });
      lines.touch({ color: true });

      count = 0;
      layout.tags.forEach((t, i) => {
        const vis = visible(t, frame);
        if (!vis) return;
        const rgb = tones[t.tone];
        const a = t.tone === 1 ? 0.92 : 0.78;
        const cy = t.y + t.h / 2;
        switch (t.kind) {
          case "pct": {
            const txt = `${tickValue(t, i, frame)}%`;
            const size = t.h * 0.72;
            const tw = txt.length * size * 0.6;
            putText(txt, "num", t.x + (t.w - tw) / 2, cy, size, rgb, a, 0.02);
            break;
          }
          case "dual": {
            const size = t.h * 0.7;
            putText(`${tickValue(t, i, frame)}%`, "num", t.x + t.w * 0.04, cy, size, rgb, a, 0.02);
            putText(`${tickValue(t, i, frame, 1)}%`, "num", t.x + t.w * 0.57, cy, size, rgb, a, 0.02);
            break;
          }
          case "code": {
            const [w1, w2] = t.text.split(" ");
            const size = t.h * 0.42;
            putText(w1, "code", t.x, t.y + t.h * 0.74, size, rgb, a);
            putText(w2, "code", t.x, t.y + t.h * 0.24, size, rgb, a * 0.85);
            break;
          }
          case "tri": {
            const size = t.h * 0.95;
            putGlyph(atlas.tri, t.x, cy, size * 0.8, rgb, a);
            const v = 10000 + ((tickValue(t, i, frame) * 7919 + i * 131) % 89999);
            putText(String(v), "num", t.x + size * 0.85, cy, size, rgb, a * 0.9, 0.02);
            break;
          }
          case "bar": {
            const size = t.h * 0.9;
            putText(t.text.split(" ")[1], "code", t.x, cy, size, rgb, a * 0.8);
            const fill = tickValue(t, i, frame) / 100;
            putFill(t.x + t.w * 0.45, t.y + t.h * 0.25, t.w * 0.52 * fill, t.h * 0.5, rgb, a * 0.55);
            break;
          }
          case "chip": {
            const fill = 0.25 + (tickValue(t, i, frame) / 100) * 0.7;
            putFill(t.x + t.w * 0.04, t.y + t.h * 0.25, t.w * 0.3 * fill, t.h * 0.5, rgb, a * 0.55);
            putText(t.text.split(" ")[1].slice(0, 3), "code", t.x + t.w * 0.48, cy, t.h * 0.8, rgb, a * 0.8);
            break;
          }
          case "cross":
            break;
        }
      });
      for (const tx of layout.texts) putText(tx.text, tx.font, tx.x, tx.y, tx.size, tones[tx.tone], tx.alpha, 0.08);
      // Park unused instances.
      for (let o = count; o < maxSprites; o++) sprites.color[o * 4 + 3] = 0;
      sprites.touch();
      applyDof(lines.material, dof, res);
      applyDof(sprites.material, dof, res);
    },
  };
};

export const DataMap: React.FC<{ row: DataMapRow }> = ({ row }) => {
  const build = useMemo(() => makeFactory(row), [row]);
  const post = useMemo<PostParams>(
    () => ({
      // Lifted, hazy: the lighter tone dominates; the darker one only at the top.
      bgTop: row.bgBottom,
      bgBottom: row.bgTop,
      bgCenter: row.bgTop,
      bgCenterPos: [0.55, 0.55, 1.1],
      bgCenterAmt: 1,
      vignette: 0.12,
      grain: 0.01,
      // Low threshold + wide radius: a soft haze around all content rather
      // than hot spots.
      bloom: { strength: 0.28, threshold: 0.0, radius: 1.8 },
    }),
    [row],
  );
  return <GLStage build={build} post={post} />;
};
