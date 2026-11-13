import * as THREE from "three";
import { mulberry32 } from "./util";

/** "AI" lettering drawn with plain strokes (no font dependency). */
export const buildTextTexture = () => {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = "#fff";
  g.lineWidth = 46;
  g.lineJoin = "miter";
  g.miterLimit = 10;
  g.lineCap = "butt";
  const top = 345;
  const bot = 679;
  // A
  g.beginPath();
  g.moveTo(262, bot);
  g.lineTo(432, top);
  g.lineTo(602, bot);
  g.stroke();
  g.beginPath();
  g.moveTo(318, 580);
  g.lineTo(546, 580);
  g.stroke();
  // I
  g.beginPath();
  g.moveTo(716, top - 12);
  g.lineTo(716, bot);
  g.stroke();
  // trim the A's feet flat
  g.fillStyle = "#000";
  g.fillRect(0, bot, 1024, 200);
  g.fillRect(0, 0, 1024, top - 12);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 8;
  return tex;
};

/** Tileable PCB artwork: thin copper traces with 45° bends and via pads. */
export const buildBoardTexture = () => {
  const S = 2048;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  const rand = mulberry32(4242);
  g.lineCap = "round";
  g.lineJoin = "round";
  const drawWrapped = (fn: () => void) => {
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        g.save();
        g.translate(ox, oy);
        fn();
        g.restore();
      }
    }
  };
  // bundles of parallel traces
  for (let b = 0; b < 150; b++) {
    let x = rand() * S;
    let y = rand() * S;
    const n = 2 + Math.floor(rand() * 6);
    const gap = 9 + rand() * 5;
    let dir = Math.floor(rand() * 4) * 2; // 0..7 in 45° steps, start axis-aligned
    const pts: [number, number][] = [[x, y]];
    const segs = 2 + Math.floor(rand() * 4);
    for (let s = 0; s < segs; s++) {
      const len = 60 + rand() * 260;
      x += Math.cos((dir * Math.PI) / 4) * len;
      y += Math.sin((dir * Math.PI) / 4) * len;
      pts.push([x, y]);
      dir = (dir + (rand() < 0.5 ? 1 : 7)) % 8;
    }
    const shade = 120 + Math.floor(rand() * 110);
    g.strokeStyle = `rgb(${shade},${shade},${shade})`;
    g.fillStyle = g.strokeStyle;
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * gap;
      drawWrapped(() => {
        g.lineWidth = 3.2;
        g.beginPath();
        pts.forEach(([px, py], i) => {
          // offset perpendicular to the first segment (good enough visually)
          const qx = px + off * 0.7;
          const qy = py - off * 0.7;
          if (i === 0) g.moveTo(qx, qy);
          else g.lineTo(qx, qy);
        });
        g.stroke();
        const [ex, ey] = pts[pts.length - 1];
        g.beginPath();
        g.arc(ex + off * 0.7, ey - off * 0.7, 6, 0, 7);
        g.fill();
      });
    }
  }
  // scattered vias
  g.fillStyle = "rgb(200,200,200)";
  for (let i = 0; i < 900; i++) {
    const x = rand() * S;
    const y = rand() * S;
    g.beginPath();
    g.arc(x, y, 3 + rand() * 3, 0, 7);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
};
