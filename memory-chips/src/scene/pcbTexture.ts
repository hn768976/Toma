import * as THREE from "three";
import { MODULE, PALETTE, SEED } from "../config";
import { noiseCanvas } from "../lib/noise";
import { mulberry32, range } from "../lib/random";

/** texture resolution of the board, pixels per millimetre */
const S = 36;

export const chipCentreY = (k: number) => MODULE.chipFirstY + k * MODULE.chipPitch;

/**
 * Top face of the board: solder mask, copper traces, pads. Fully procedural and
 * seeded; the trace layout is invented (no real product is copied).
 */
export const buildPcbTexture = (): THREE.CanvasTexture => {
  const W = Math.round(MODULE.width * S);
  const H = Math.round(MODULE.length * S);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;
  const rnd = mulberry32(SEED + 11);
  // module coordinates (mm) -> canvas pixels; canvas top is the far end of the board
  const px = (x: number) => (x + MODULE.width / 2) * S;
  const py = (y: number) => (MODULE.length - y) * S;

  c.fillStyle = PALETTE.pcb;
  c.fillRect(0, 0, W, H);
  // large-scale mask variation + fine fibre weave
  c.globalCompositeOperation = "overlay";
  c.globalAlpha = 0.22;
  c.drawImage(noiseCanvas(256, 1024, SEED + 1, 3, 12, 4, 0.55), 0, 0, W, H);
  c.globalAlpha = 0.04;
  c.drawImage(noiseCanvas(512, 2048, SEED + 2, 128, 512, 2, 0.5), 0, 0, W, H);
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1;

  const [cw, cd] = MODULE.chipSize;
  const chipL = MODULE.chipX - cw / 2;
  const chipR = MODULE.chipX + cw / 2;
  const trace = (pts: [number, number][], width = 0.15) => {
    c.strokeStyle = PALETTE.trace;
    c.lineWidth = width * S;
    c.lineJoin = "miter";
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(px(x), py(y)) : c.moveTo(px(x), py(y))));
    c.stroke();
  };
  const via = (x: number, y: number) => {
    c.fillStyle = PALETTE.trace;
    c.beginPath();
    c.arc(px(x), py(y), 0.26 * S, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = PALETTE.pcbEdge;
    c.beginPath();
    c.arc(px(x), py(y), 0.11 * S, 0, Math.PI * 2);
    c.fill();
  };

  // traces in the gaps before, between and after the chips
  for (let g = 0; g <= MODULE.chips; g++) {
    const y0 = g === 0 ? 1.0 : chipCentreY(g - 1) + cd / 2 + 1.5;
    const y1 = g === MODULE.chips ? MODULE.length - 1.0 : chipCentreY(g) - cd / 2 - 1.5;
    if (y1 - y0 < 0.6) continue;
    const lanes = Math.max(2, Math.floor((y1 - y0) / 0.42));
    // long buses with jogs
    for (let l = 0; l < lanes; l++) {
      if (rnd() < 0.25) continue;
      const y = y0 + ((l + 0.5) / lanes) * (y1 - y0);
      let x = chipL + range(rnd, -0.6, 3);
      const end = chipR + range(rnd, -4, 0.5);
      const pts: [number, number][] = [[x, y]];
      let yy = y;
      while (x < end) {
        x = Math.min(end, x + range(rnd, 2.5, 8));
        pts.push([x, yy]);
        if (rnd() < 0.45 && x < end) {
          yy = Math.min(y1, Math.max(y0, yy + (rnd() < 0.5 ? -1 : 1) * ((y1 - y0) / lanes)));
          pts.push([x + 0.25, yy]);
        }
      }
      trace(pts);
      if (rnd() < 0.6) via(pts[0][0], pts[0][1]);
      if (rnd() < 0.5) via(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    }
    // a few nested rectangles (matched-length meanders) per gap
    const boxes = Math.floor(range(rnd, 2, 5));
    for (let b = 0; b < boxes; b++) {
      const bx = chipL + range(rnd, 1, cw - 5);
      const bw = range(rnd, 2.2, 4.2);
      for (let k = 0; k < 3; k++) {
        const inset = k * 0.36;
        if (bw / 2 - inset < 0.3 || (y1 - y0) / 2 - inset < 0.25) break;
        c.strokeStyle = PALETTE.trace;
        c.lineWidth = 0.13 * S;
        c.strokeRect(px(bx + inset), py(y1 - inset), (bw - inset * 2) * S, (y1 - y0 - inset * 2) * S);
      }
    }
  }
  // left margin: two long rails with stubs
  trace([[-MODULE.width / 2 + 0.7, 2.5], [-MODULE.width / 2 + 0.7, MODULE.length - 2.5]], 0.2);
  trace([[-MODULE.width / 2 + 1.25, 4], [-MODULE.width / 2 + 1.25, MODULE.length - 4]], 0.14);

  // pads under every chip pin
  c.fillStyle = PALETTE.pad;
  const pinSpan = (MODULE.pinsPerSide - 1) * MODULE.pinPitch;
  for (let k = 0; k < MODULE.chips; k++) {
    for (const side of [-1, 1]) {
      const y = chipCentreY(k) + side * (cd / 2 + 0.75);
      for (let p = 0; p < MODULE.pinsPerSide; p++) {
        const x = MODULE.chipX - pinSpan / 2 + p * MODULE.pinPitch;
        c.fillRect(px(x - 0.15), py(y + 0.55), 0.3 * S, 1.1 * S);
      }
    }
  }
  // pads + short traces for the SMD column next to the fingers
  for (let y = 4; y < MODULE.length - 4; y += MODULE.smdPitch) {
    if (Math.abs(y - MODULE.keySlotY) < 3.2) continue;
    c.fillStyle = PALETTE.pad;
    c.fillRect(px(MODULE.smdX - 1.55), py(y + 0.7), 0.6 * S, 1.4 * S);
    c.fillRect(px(MODULE.smdX + 0.95), py(y + 0.7), 0.6 * S, 1.4 * S);
    for (let j = -1; j <= 1; j++) {
      trace([[MODULE.smdX + 1.75, y + j * 0.5], [MODULE.width / 2 - MODULE.fingerLength - 0.2, y + j * 0.5]], 0.12);
      trace([[chipR + 0.4, y + j * 0.5], [MODULE.smdX - 1.75, y + j * 0.5]], 0.12);
    }
  }
  // ring around each mounting hole
  for (const hy of [3.4, MODULE.length - 3.4]) {
    c.strokeStyle = PALETTE.trace;
    c.lineWidth = 0.3 * S;
    c.beginPath();
    c.arc(px(MODULE.width / 2 - 3.6), py(hy), 2.05 * S, 0, Math.PI * 2);
    c.stroke();
  }

  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
};

/** Top of a memory chip: moulded plastic with a faint laser-etched code (made-up glyphs). */
export const buildChipTexture = (): THREE.CanvasTexture => {
  const W = 1024;
  const H = Math.round((W * MODULE.chipSize[1]) / MODULE.chipSize[0]);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d")!;
  const rnd = mulberry32(SEED + 23);
  c.fillStyle = PALETTE.chipBody;
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = "overlay";
  c.globalAlpha = 0.05;
  c.drawImage(noiseCanvas(256, 164, SEED + 5, 4, 3, 4, 0.55), 0, 0, W, H);
  c.globalAlpha = 0.14;
  c.drawImage(noiseCanvas(1024, 656, SEED + 6, 512, 328, 1), 0, 0, W, H);
  c.globalCompositeOperation = "source-over";
  // etched code: two rows of 5x7 dot-matrix glyphs with random dots (not real characters)
  c.fillStyle = PALETTE.chipMark;
  const cell = W * 0.0052;
  const rows = [
    { n: 9, y: H * 0.47, a: 0.55 },
    { n: 6, y: H * 0.6, a: 0.3 },
  ];
  for (const row of rows) {
    const glyphW = cell * 7.2;
    const x0 = W / 2 - (row.n * glyphW) / 2;
    c.globalAlpha = row.a;
    for (let g = 0; g < row.n; g++) {
      for (let gy = 0; gy < 7; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          if (rnd() < 0.52) c.fillRect(x0 + g * glyphW + gx * cell, row.y + gy * cell, cell * 0.92, cell * 0.92);
        }
      }
    }
  }
  // pin-1 dimple
  c.globalAlpha = 0.35;
  c.beginPath();
  c.arc(W * 0.045, H * 0.88, W * 0.012, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
};
