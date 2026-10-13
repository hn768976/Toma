import * as THREE from "three";

// Generic security pictograms drawn in code (no fonts, no logos):
// lock, key, cloud, monitor, fingerprint, check, gear.
export const ICON_NAMES = ["lock", "key", "cloud", "monitor", "fingerprint", "check", "gear"] as const;
const CELL = 256;

const draw: Record<(typeof ICON_NAMES)[number], (c: CanvasRenderingContext2D) => void> = {
  lock(c) {
    c.beginPath();
    c.roundRect(64, 116, 128, 100, 14);
    c.stroke();
    c.beginPath();
    c.arc(128, 116, 40, Math.PI, 0);
    c.lineTo(168, 116);
    c.moveTo(88, 116);
    c.stroke();
    c.beginPath();
    c.arc(128, 156, 11, 0, Math.PI * 2);
    c.fill();
    c.fillRect(123, 160, 10, 26);
  },
  key(c) {
    c.beginPath();
    c.arc(84, 128, 36, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(120, 128);
    c.lineTo(212, 128);
    c.moveTo(184, 128);
    c.lineTo(184, 160);
    c.moveTo(206, 128);
    c.lineTo(206, 152);
    c.stroke();
  },
  cloud(c) {
    c.beginPath();
    c.moveTo(70, 180);
    c.arc(76, 150, 30, Math.PI / 2, Math.PI * 1.5);
    c.arc(118, 112, 44, Math.PI * 1.1, Math.PI * 1.9);
    c.arc(178, 140, 36, Math.PI * 1.35, Math.PI * 0.5);
    c.closePath();
    c.stroke();
  },
  monitor(c) {
    c.beginPath();
    c.roundRect(46, 58, 164, 112, 10);
    c.stroke();
    c.beginPath();
    c.moveTo(128, 170);
    c.lineTo(128, 196);
    c.moveTo(90, 200);
    c.lineTo(166, 200);
    c.stroke();
    c.fillRect(70, 84, 60, 10);
    c.fillRect(70, 104, 96, 10);
    c.fillRect(70, 124, 44, 10);
  },
  fingerprint(c) {
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      const r = 18 + i * 18;
      c.arc(128, 140, r, Math.PI * (1.05 + i * 0.03), Math.PI * (1.95 + (i % 2) * 0.25));
      c.stroke();
    }
    c.beginPath();
    c.moveTo(128, 140);
    c.lineTo(128, 196);
    c.stroke();
  },
  check(c) {
    c.beginPath();
    c.arc(128, 128, 76, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(90, 130);
    c.lineTo(118, 158);
    c.lineTo(168, 100);
    c.stroke();
  },
  gear(c) {
    c.beginPath();
    const teeth = 8;
    for (let i = 0; i <= teeth * 4; i++) {
      const a = (i / (teeth * 4)) * Math.PI * 2;
      const r = i % 4 < 2 ? 78 : 60;
      const x = 128 + Math.cos(a) * r,
        y = 128 + Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
    c.stroke();
    c.beginPath();
    c.arc(128, 128, 24, 0, Math.PI * 2);
    c.stroke();
  },
};

// Atlas: 8 columns × 2 rows of 256 px cells. Row 0: bare glyphs, row 1: the
// same glyph on a rounded card.
export const buildIconAtlas = () => {
  const canvas = document.createElement("canvas");
  canvas.width = CELL * 8;
  canvas.height = CELL * 2;
  const c = canvas.getContext("2d")!;
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.strokeStyle = "#fff";
  c.fillStyle = "#fff";
  c.lineWidth = 14;
  c.lineCap = "round";
  c.lineJoin = "round";
  ICON_NAMES.forEach((name, i) => {
    for (let row = 0; row < 2; row++) {
      c.save();
      c.translate(i * CELL, row * CELL);
      if (row === 1) {
        c.save();
        c.lineWidth = 9;
        c.globalAlpha = 0.85;
        c.beginPath();
        c.roundRect(14, 14, 228, 228, 30);
        c.stroke();
        c.restore();
        c.translate(128, 128);
        c.scale(0.72, 0.72);
        c.translate(-128, -128);
      }
      draw[name](c);
      c.restore();
    }
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
};
