import React, { useCallback } from "react";
import { CanvasStage, DrawInfo, LH, LW } from "../../lib/CanvasStage";
import { INTER, MONO } from "../../lib/fonts";
import { ICONS } from "../../lib/icons";
import { addGlow, getLayer } from "../../lib/layers";
import { clamp01, easeOutBack, easeOutCubic, hash3, TAU } from "../../lib/random";
import { BADGES, BUTTON_ROWS, CHIP, CROSSES, DIALS, ELEMENTS, KNOBS, RADARS, LOOPS, PANELS, READOUTS, Route, ROUTES, SLIDER, SQUARE_ROWS, STUBS, TRIANGLE } from "./layout";
import { AIHubVersion } from "./versions";

const SPEED = 260;

const pathOf = (c: CanvasRenderingContext2D, pts: number[]) => {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
};

// Point at arc length s along a polyline.
const pointAt = (pts: number[], s: number): [number, number] => {
  for (let i = 2; i < pts.length; i += 2) {
    const L = Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    if (s <= L) {
      const u = L > 0 ? s / L : 0;
      return [pts[i - 2] + (pts[i] - pts[i - 2]) * u, pts[i - 1] + (pts[i + 1] - pts[i - 1]) * u];
    }
    s -= L;
  }
  return [pts[pts.length - 2], pts[pts.length - 1]];
};

export const AIHub: React.FC<{ v: AIHubVersion }> = ({ v }) => {
  const draw = useCallback(
    (main: CanvasRenderingContext2D, { frame, fps, bw, bh, k }: DrawInfo) => {
      const t = frame / fps;
      const col = [v.primary, v.secondary];
      main.fillStyle = v.background;
      main.fillRect(0, 0, LW, LH);

      // Dim layer (panels, dials): drawn straight, no glow.
      // Bright layer (lines, badges, chip): gets a soft glow.
      const c = getLayer("aihub-fg", bw, bh);
      c.setTransform(k, 0, 0, k, 0, 0);
      c.lineCap = "round";
      c.lineJoin = "round";

      const drawRoute = (r: Route, alpha: number) => {
        const s = (t - r.t0) * SPEED;
        if (s <= 0) return;
        c.strokeStyle = col[r.ink];
        c.globalAlpha = alpha;
        c.lineWidth = r.width;
        if (r.dotted) {
          // dotted line: clip the reveal instead of using the dash for it
          c.save();
          c.setLineDash([1.4, 4.2]);
          c.lineCap = "round";
          c.lineWidth = 2;
          const [hx, hy] = pointAt(r.pts, Math.min(s, r.len));
          c.beginPath();
          c.moveTo(r.pts[0], r.pts[1]);
          let acc = 0;
          for (let i = 2; i < r.pts.length; i += 2) {
            const L = Math.hypot(r.pts[i] - r.pts[i - 2], r.pts[i + 1] - r.pts[i - 1]);
            if (acc + L >= s) {
              c.lineTo(hx, hy);
              break;
            }
            c.lineTo(r.pts[i], r.pts[i + 1]);
            acc += L;
          }
          c.stroke();
          c.restore();
        } else {
          c.setLineDash(s < r.len ? [s, 1e5] : []);
          pathOf(c, r.pts);
          c.stroke();
          c.setLineDash([]);
        }
        // corner dots once reached
        c.fillStyle = col[r.ink];
        let acc = 0;
        for (let i = 2; i < r.pts.length - 2; i += 2) {
          acc += Math.hypot(r.pts[i] - r.pts[i - 2], r.pts[i + 1] - r.pts[i - 1]);
          if (acc <= s) {
            c.beginPath();
            c.arc(r.pts[i], r.pts[i + 1], r.dotted ? 2.4 : 3.3, 0, TAU);
            c.fill();
          }
        }
        if (s < r.len) {
          const [hx, hy] = pointAt(r.pts, s);
          c.globalAlpha = 1;
          c.beginPath();
          c.arc(hx, hy, 3, 0, TAU);
          c.fill();
        }
        c.globalAlpha = 1;
      };
      ROUTES.forEach((r) => drawRoute(r, 0.75));
      LOOPS.forEach((r) => drawRoute(r, 0.62));

      // Stubs with terminals.
      for (const s of STUBS) {
        const p = easeOutCubic(clamp01((t - s.t) / 0.4));
        if (p <= 0) continue;
        c.strokeStyle = col[s.ink];
        c.fillStyle = col[s.ink];
        c.globalAlpha = 0.7;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(s.x0, s.y0);
        c.lineTo(s.x0 + (s.x1 - s.x0) * p, s.y0 + (s.y1 - s.y0) * p);
        c.stroke();
        c.beginPath();
        c.arc(s.x0 + (s.x1 - s.x0) * p, s.y0 + (s.y1 - s.y0) * p, 1.8, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;

      // Pulses travelling along the routes (hold phase; whole loop length).
      const pulseA = clamp01((t - 6.5) / 0.8);
      if (pulseA > 0) {
        [...ROUTES, ...LOOPS].forEach((r, i) => {
          for (let j = 0; j < 2; j++) {
            const u = (hash3(i, j, 7) + (t * SPEED * 0.6) / r.len) % 1;
            const [px, py] = pointAt(r.pts, u * r.len);
            c.fillStyle = col[r.ink];
            c.globalAlpha = pulseA * Math.sin(u * Math.PI);
            c.beginPath();
            c.arc(px, py, 1.9, 0, TAU);
            c.fill();
          }
        });
        c.globalAlpha = 1;
      }

      // Badges.
      BADGES.forEach((b, i) => {
        const ta = ROUTES[i].arrive;
        const p = (t - ta) / 0.45;
        if (p <= 0) return;
        // hide lines under the badge
        c.save();
        c.globalCompositeOperation = "destination-out";
        c.beginPath();
        c.arc(b.x, b.y, b.r, 0, TAU);
        c.fill();
        c.restore();
        const ringP = easeOutCubic(clamp01(p));
        const other = col[1 - b.ring];
        // dark inner disc
        c.globalAlpha = 0.85;
        c.strokeStyle = col[b.ring];
        c.lineWidth = 2.2;
        c.beginPath();
        c.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + TAU * ringP);
        c.stroke();
        // inner fine ring
        c.globalAlpha = 0.4;
        c.lineWidth = 1;
        c.beginPath();
        c.arc(b.x, b.y, b.r - 7, 0, TAU * ringP);
        c.stroke();
        c.globalAlpha = 0.22;
        c.beginPath();
        c.arc(b.x, b.y, b.r - 12, 0, TAU * ringP);
        c.stroke();
        // outer tick ring in the other colour
        const rot = t * 0.22 * (i % 2 ? -1 : 1) + i;
        c.strokeStyle = other;
        c.globalAlpha = 0.5 * ringP;
        c.lineWidth = 2.2;
        for (let a = 0; a < 36; a++) {
          if (a % 9 > 6) continue;
          const an = rot + (a / 36) * TAU;
          c.beginPath();
          c.arc(b.x, b.y, b.r + 6, an, an + 0.07);
          c.stroke();
        }
        // partial arcs + knobs
        c.lineWidth = 2;
        c.globalAlpha = 0.85 * ringP;
        for (let a = 0; a < 2; a++) {
          c.beginPath();
          c.arc(b.x, b.y, b.r + 13, -rot * 0.6 + a * Math.PI, -rot * 0.6 + a * Math.PI + 0.8);
          c.stroke();
        }
        c.fillStyle = other;
        for (let a = 0; a < 2; a++) {
          const an = -rot * 0.6 + a * Math.PI + 0.8;
          c.beginPath();
          c.arc(b.x + Math.cos(an) * (b.r + 13), b.y + Math.sin(an) * (b.r + 13), 2.6, 0, TAU);
          c.fill();
        }
        c.globalAlpha = 1;
        // icon
        const ip = clamp01((t - ta - 0.3) / 0.45);
        if (ip > 0) {
          const s = b.r * 0.68 * easeOutBack(ip, 1.3);
          c.save();
          c.translate(b.x, b.y);
          c.scale(s, s);
          c.strokeStyle = col[b.ink];
          c.fillStyle = col[b.ink];
          c.lineWidth = 1.8 / s;
          c.globalAlpha = clamp01(ip * 2);
          ICONS[b.icon](c);
          c.restore();
        }
      });

      // Centre chip: ring, then square with pins, then "AI".
      const cp = clamp01(t / 1.5);
      if (cp > 0) {
        c.save();
        c.globalCompositeOperation = "destination-out";
        c.beginPath();
        c.arc(CHIP.x, CHIP.y, CHIP.r, 0, TAU);
        c.fill();
        c.restore();
        const r1 = easeOutCubic(clamp01(cp / 0.6));
        c.strokeStyle = v.primary;
        c.fillStyle = v.primary;
        c.lineWidth = 2.2;
        c.beginPath();
        c.arc(CHIP.x, CHIP.y, CHIP.r, -Math.PI / 2, -Math.PI / 2 + TAU * r1);
        c.stroke();
        c.globalAlpha = 0.5;
        c.lineWidth = 1;
        const rot = t * 0.3;
        for (let a = 0; a < 4; a++) {
          c.beginPath();
          c.arc(CHIP.x, CHIP.y, CHIP.r - 8, rot + (a * TAU) / 4, rot + (a * TAU) / 4 + 1.0 * r1);
          c.stroke();
        }
        c.lineWidth = 1.4;
        for (let a = 0; a < 2; a++) {
          c.beginPath();
          c.arc(CHIP.x, CHIP.y, CHIP.r + 9, -rot + a * Math.PI, -rot + a * Math.PI + 1.2 * r1);
          c.stroke();
        }
        c.globalAlpha = 1;
        const sq = easeOutCubic(clamp01((cp - 0.3) / 0.5));
        const h = 27;
        if (sq > 0) {
          c.lineWidth = 2.2;
          c.setLineDash([8 * h * sq, 1e5]);
          c.beginPath();
          c.roundRect(CHIP.x - h, CHIP.y - h, 2 * h, 2 * h, 3);
          c.stroke();
          c.setLineDash([]);
          c.lineWidth = 1.6;
          for (let pin = 0; pin < 5; pin++) {
            const o = -h + 7 + pin * ((2 * h - 14) / 4);
            const L = 9 * sq;
            for (const [x0, y0, dx, dy] of [
              [CHIP.x + o, CHIP.y - h, 0, -1],
              [CHIP.x + o, CHIP.y + h, 0, 1],
              [CHIP.x - h, CHIP.y + o, -1, 0],
              [CHIP.x + h, CHIP.y + o, 1, 0],
            ]) {
              c.beginPath();
              c.moveTo(x0, y0);
              c.lineTo(x0 + dx * L, y0 + dy * L);
              c.stroke();
            }
          }
        }
        const tp = clamp01((cp - 0.7) / 0.3);
        if (tp > 0) {
          c.globalAlpha = tp;
          c.lineWidth = 1.2;
          c.strokeStyle = v.secondary;
          c.strokeRect(CHIP.x - h + 6, CHIP.y - h + 6, 2 * h - 12, 2 * h - 12);
          c.strokeStyle = v.primary;
          c.fillStyle = v.secondary;
          const kn = -t * 0.3 - 0.9;
          c.beginPath();
          c.arc(CHIP.x + Math.cos(kn) * (CHIP.r + 9), CHIP.y + Math.sin(kn) * (CHIP.r + 9), 3, 0, TAU);
          c.fill();
          c.fillStyle = v.primary;
          c.font = `600 22px ${INTER}`;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.fillText("AI", CHIP.x, CHIP.y + 1);
          c.globalAlpha = 1;
        }
      }

      // Glow the bright layer, then composite it.
      addGlow(main, c.canvas, 5 * k, 0.3, "aihub-glow");

      // Dim HUD layer straight onto main (under the bright layer).
      main.save();
      const d = main;
      d.lineWidth = 1;
      for (const pn of PANELS) {
        const p = clamp01((t - pn.t) / 0.5);
        if (p <= 0) continue;
        const blink = p < 1 ? (hash3(pn.seed, Math.floor(t * 20), 1) > 0.35 ? 1 : 0.3) : 1;
        const ink = pn.ink ? col[1] : "#7A9A96";
        d.globalAlpha = 0.5 * blink;
        d.fillStyle = ink;
        d.strokeStyle = ink;
        if (pn.ink === 1) {
          d.globalAlpha = 0.09 * blink;
          d.fillRect(pn.x, pn.y, pn.w, pn.h);
        } else if (pn.kind !== 5) {
          d.globalAlpha = 0.06 * blink;
          d.fillRect(pn.x, pn.y, pn.w, pn.h);
        }
        d.globalAlpha = (pn.kind === 5 ? 0 : 0.22) * blink;
        d.strokeRect(pn.x + 0.5, pn.y + 0.5, pn.w - 1, pn.h - 1);
        d.globalAlpha = 0.38 * blink;
        const tick = Math.floor(t * 2.5);
        if (pn.kind === 0 || pn.kind === 5) {
          // text lines
          const rows = Math.floor((pn.h - 6) / 6);
          for (let r = 0; r < rows; r++) {
            const w = (0.3 + 0.65 * hash3(pn.seed, r, tick >> 1)) * (pn.w - 10) * p;
            d.fillRect(pn.x + 5, pn.y + 5 + r * 6, w, 2);
          }
        } else if (pn.kind === 1) {
          // numbers + mini bars
          d.font = `500 9px ${MONO}`;
          d.textBaseline = "top";
          d.textAlign = "left";
          const a = 10 + Math.floor(hash3(pn.seed, tick, 2) * 80);
          const b2 = 40 + Math.floor(hash3(pn.seed, tick, 3) * 50);
          d.fillText(`${a}/${b2}`, pn.x + 5, pn.y + 5);
          for (let j = 0; j < 6; j++) {
            const hh = (pn.h - 22) * (0.3 + 0.7 * hash3(pn.seed, j, tick)) * p;
            d.fillRect(pn.x + 5 + j * 7, pn.y + pn.h - 4 - hh, 4, hh);
          }
        } else if (pn.kind === 2) {
          // vertical bar chart
          const n = Math.max(3, Math.floor((pn.w - 6) / 6));
          for (let j = 0; j < n; j++) {
            const hh = (pn.h - 10) * (0.2 + 0.8 * hash3(pn.seed, j, tick)) * p;
            d.fillRect(pn.x + 4 + j * 6, pn.y + pn.h - 5 - hh, 3, hh);
          }
        } else if (pn.kind === 3) {
          // progress bar + label
          d.font = `500 8px ${MONO}`;
          d.textBaseline = "middle";
          d.textAlign = "left";
          d.fillText("SYS.04", pn.x + 5, pn.y + pn.h / 2);
          const fill = (0.35 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.9 + pn.seed))) * p;
          d.fillRect(pn.x + pn.w * 0.55, pn.y + pn.h / 2 - 2, pn.w * 0.4 * fill, 4);
        } else {
          // waveform
          d.beginPath();
          for (let j = 0; j <= 20; j++) {
            const x = pn.x + 5 + ((pn.w - 10) * j) / 20;
            const y = pn.y + pn.h / 2 + Math.sin(j * 0.9 + t * 3 + pn.seed) * (pn.h * 0.3) * hash3(pn.seed, j, 5) * p;
            if (j) d.lineTo(x, y);
            else d.moveTo(x, y);
          }
          d.stroke();
        }
      }
      const appear = (t0: number) => clamp01((t - t0) / 0.5);
      for (const dl of DIALS) {
        const p = appear(dl.t);
        if (p <= 0) continue;
        d.strokeStyle = v.primary;
        d.globalAlpha = 0.28 * p;
        d.beginPath();
        d.arc(dl.x, dl.y, dl.r, 0, TAU);
        d.stroke();
        for (let a = 0; a < 24; a++) {
          const an = (a / 24) * TAU;
          d.beginPath();
          d.moveTo(dl.x + Math.cos(an) * (dl.r + 2), dl.y + Math.sin(an) * (dl.r + 2));
          d.lineTo(dl.x + Math.cos(an) * (dl.r + 4), dl.y + Math.sin(an) * (dl.r + 4));
          d.stroke();
        }
        d.globalAlpha = 0.45 * p;
        const a0 = dl.phase * TAU + t * 0.8;
        d.lineWidth = 2;
        d.beginPath();
        d.arc(dl.x, dl.y, dl.r - 3, a0, a0 + 1.6);
        d.stroke();
        d.lineWidth = 1;
      }
      for (const rd of RADARS) {
        const p = appear(rd.t);
        if (p <= 0) continue;
        d.strokeStyle = "#7A9A96";
        for (const [rr, a] of [[rd.r, 0.3], [rd.r * 0.7, 0.2], [rd.r * 0.35, 0.25]] as const) {
          d.globalAlpha = a * p;
          d.beginPath();
          d.arc(rd.x, rd.y, rr, 0, TAU);
          d.stroke();
        }
        const sw = t * 0.9;
        d.globalAlpha = 0.35 * p;
        d.beginPath();
        d.moveTo(rd.x, rd.y);
        d.lineTo(rd.x + Math.cos(sw) * rd.r, rd.y + Math.sin(sw) * rd.r);
        d.stroke();
        for (let a = 0; a < 8; a++) {
          const an = (a / 8) * TAU;
          d.beginPath();
          d.moveTo(rd.x + Math.cos(an) * rd.r, rd.y + Math.sin(an) * rd.r);
          d.lineTo(rd.x + Math.cos(an) * (rd.r + 5), rd.y + Math.sin(an) * (rd.r + 5));
          d.stroke();
        }
      }
      {
        const p = appear(KNOBS.t);
        if (p > 0) {
          d.strokeStyle = "#7A9A96";
          for (let j = 0; j < KNOBS.n; j++) {
            const x = KNOBS.x + j * KNOBS.gap;
            d.globalAlpha = 0.35 * p;
            d.beginPath();
            d.arc(x, KNOBS.y, 7, 0, TAU);
            d.stroke();
            const an = t * 0.5 + j * 1.3;
            d.beginPath();
            d.moveTo(x, KNOBS.y);
            d.lineTo(x + Math.cos(an) * 6, KNOBS.y + Math.sin(an) * 6);
            d.stroke();
          }
        }
      }
      for (const br of BUTTON_ROWS) {
        const p = appear(br.t);
        if (p <= 0) continue;
        d.strokeStyle = v.primary;
        for (let j = 0; j < br.n; j++) {
          d.globalAlpha = 0.3 * p;
          d.beginPath();
          d.arc(br.x + j * br.gap, br.y, br.r, 0, TAU);
          d.stroke();
          d.globalAlpha = (hash3(j, Math.floor(t * 2), br.x) > 0.6 ? 0.5 : 0.18) * p;
          d.fillStyle = v.primary;
          d.beginPath();
          d.arc(br.x + j * br.gap, br.y, br.r * 0.45, 0, TAU);
          d.fill();
        }
      }
      for (const sr of SQUARE_ROWS) {
        const p = appear(sr.t);
        if (p <= 0) continue;
        d.strokeStyle = v.primary;
        d.globalAlpha = 0.35 * p;
        for (let j = 0; j < sr.n; j++) d.strokeRect(sr.x + j * sr.gap, sr.y, sr.s, sr.s);
        d.fillStyle = v.primary;
        d.fillRect(sr.x + ((Math.floor(t * 1.5) % sr.n) * sr.gap) + 2, sr.y + 2, sr.s - 4, sr.s - 4);
      }
      for (const cr of CROSSES) {
        const p = appear(cr.t);
        if (p <= 0) continue;
        d.strokeStyle = v.primary;
        d.globalAlpha = 0.4 * p;
        d.beginPath();
        d.moveTo(cr.x - 6, cr.y);
        d.lineTo(cr.x + 6, cr.y);
        d.moveTo(cr.x, cr.y - 6);
        d.lineTo(cr.x, cr.y + 6);
        d.stroke();
      }
      {
        const p = appear(TRIANGLE.t);
        if (p > 0) {
          d.strokeStyle = v.primary;
          d.globalAlpha = 0.35 * p;
          d.lineWidth = 1.4;
          for (const sc of [1, 0.6]) {
            d.beginPath();
            d.moveTo(TRIANGLE.x - TRIANGLE.s * sc, TRIANGLE.y - TRIANGLE.s * 0.7 * sc);
            d.lineTo(TRIANGLE.x + TRIANGLE.s * sc, TRIANGLE.y - TRIANGLE.s * 0.7 * sc);
            d.lineTo(TRIANGLE.x, TRIANGLE.y + TRIANGLE.s * 0.9 * sc);
            d.closePath();
            d.stroke();
          }
          d.lineWidth = 1;
        }
      }
      {
        const p = appear(SLIDER.t);
        if (p > 0) {
          d.strokeStyle = v.primary;
          d.fillStyle = v.primary;
          for (let j = 0; j < 5; j++) {
            const x = SLIDER.x + j * 10;
            d.globalAlpha = 0.3 * p;
            d.beginPath();
            d.moveTo(x, SLIDER.y);
            d.lineTo(x, SLIDER.y + SLIDER.h);
            d.stroke();
            d.globalAlpha = 0.55 * p;
            const ky = SLIDER.y + SLIDER.h * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.7 + j * 1.7)));
            d.fillRect(x - 3, ky - 1.5, 6, 3);
          }
        }
      }
      d.font = `500 10px ${MONO}`;
      d.textAlign = "left";
      d.textBaseline = "middle";
      for (const ro of READOUTS) {
        const p = appear(ro.t);
        if (p <= 0) continue;
        d.fillStyle = ro.s === "SAT" ? v.secondary : v.primary;
        d.font = ro.s === "SAT" ? `500 13px ${MONO}` : `500 10px ${MONO}`;
        d.globalAlpha = 0.6 * p;
        const txt = ro.s === "SAT" ? `SAT ${30 + Math.floor(hash3(Math.floor(t * 2), 1, 9) * 40)}/65` : ro.s === "49" ? `${40 + Math.floor(hash3(Math.floor(t * 2), 2, 9) * 20)}` : ro.s;
        d.fillText(txt, ro.x, ro.y);
        if (ro.box) {
          d.strokeStyle = v.primary;
          d.globalAlpha = 0.3 * p;
          d.beginPath();
          d.roundRect(ro.x - 8, ro.y - 9, 62, 18, 9);
          d.stroke();
        }
      }
      {
        const p = appear(ELEMENTS.t);
        if (p > 0) {
          d.fillStyle = v.primary;
          d.globalAlpha = 0.6 * p;
          d.font = `500 9px ${MONO}`;
          d.fillText("ELEMENTS / DATA", ELEMENTS.x + 60, ELEMENTS.y);
          d.globalAlpha = 0.3 * p;
          d.strokeStyle = v.primary;
          d.beginPath();
          d.roundRect(ELEMENTS.x, ELEMENTS.y + 8, ELEMENTS.w, 9, 4.5);
          d.stroke();
          d.globalAlpha = 0.45 * p;
          const segs = Math.floor(16 * (0.55 + 0.4 * Math.sin(t * 0.6)));
          for (let j = 0; j < segs; j++) d.fillRect(ELEMENTS.x + 3 + j * 12.8, ELEMENTS.y + 10, 9, 5);
        }
      }
      main.restore();

      // Bright layer on top.
      main.save();
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.filter = `blur(${0.45 * k}px)`;
      main.globalAlpha = 0.92;
      main.drawImage(c.canvas, 0, 0);
      main.filter = "none";
      main.restore();
    },
    [v],
  );
  return <CanvasStage draw={draw} post={{ grain: v.grain }} />;
};
