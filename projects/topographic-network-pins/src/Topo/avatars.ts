import * as THREE from "three";
import { mulberry32 } from "../lib/ThreeStage";

/**
 * Procedurally drawn avatar atlas (4x4 cells). Each cell is a flat-style
 * person icon on a pastel disc, padded with the disc colour so mip-mapped
 * (blurred) lookups never bleed into neighbouring cells.
 */
export const AVATAR_GRID = 4;
export const AVATAR_COUNT = AVATAR_GRID * AVATAR_GRID;

const BG = ["#8fd6cf", "#a9c8ef", "#f3dcc0", "#c7e6b8", "#f2c4cf", "#b9b2e8", "#9fd9ef", "#efe3a8"];
const SKIN = ["#f6d2b8", "#e8b48f", "#c98c63", "#9b6544", "#f1c7a5", "#704530"];
const HAIR = ["#2b1b14", "#5a3522", "#a0662f", "#e2c37a", "#1d1d24", "#8b2f2a", "#c9c3bd"];
const SHIRT = ["#3d7fd1", "#e2574c", "#2f9e7a", "#f2a93b", "#6a4bc4", "#ef7aa8", "#2c3e50", "#46b4c8"];

export const createAvatarAtlas = () => {
  const cell = 256;
  const size = cell * AVATAR_GRID;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d")!;
  const rnd = mulberry32(31337);
  const avg: THREE.Color[] = [];
  for (let i = 0; i < AVATAR_COUNT; i++) {
    const cx = (i % AVATAR_GRID) * cell;
    const cy = Math.floor(i / AVATAR_GRID) * cell;
    const bg = BG[i % BG.length];
    const skin = SKIN[Math.floor(rnd() * SKIN.length)];
    const hair = HAIR[Math.floor(rnd() * HAIR.length)];
    const shirt = SHIRT[Math.floor(rnd() * SHIRT.length)];
    const longHair = rnd() > 0.5;
    g.save();
    g.translate(cx, cy);
    g.fillStyle = bg;
    g.fillRect(0, 0, cell, cell);
    // subtle radial shading
    const rg = g.createRadialGradient(cell * 0.5, cell * 0.38, 10, cell * 0.5, cell * 0.5, cell * 0.6);
    rg.addColorStop(0, "rgba(255,255,255,0.25)");
    rg.addColorStop(1, "rgba(0,0,0,0.12)");
    g.fillStyle = rg;
    g.fillRect(0, 0, cell, cell);
    const s = cell / 256;
    // long hair behind the shoulders
    if (longHair) {
      g.fillStyle = hair;
      g.beginPath();
      g.ellipse(128 * s, 120 * s, 50 * s, 64 * s, 0, 0, Math.PI * 2);
      g.fill();
    }
    // shoulders
    g.fillStyle = shirt;
    g.beginPath();
    g.ellipse(128 * s, 236 * s, 86 * s, 62 * s, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillRect(42 * s, 234 * s, 172 * s, 22 * s);
    // neck
    g.fillStyle = skin;
    g.fillRect(114 * s, 140 * s, 28 * s, 40 * s);
    // collar
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.beginPath();
    g.moveTo(108 * s, 176 * s);
    g.lineTo(128 * s, 200 * s);
    g.lineTo(148 * s, 176 * s);
    g.closePath();
    g.fill();
    // head
    g.fillStyle = skin;
    g.beginPath();
    g.ellipse(128 * s, 112 * s, 40 * s, 47 * s, 0, 0, Math.PI * 2);
    g.fill();
    // hair cap
    g.fillStyle = hair;
    g.beginPath();
    g.ellipse(128 * s, 92 * s, 43 * s, 32 * s, 0, Math.PI * 0.98, Math.PI * 2.02);
    g.fill();
    g.beginPath();
    g.ellipse(128 * s, 84 * s, 40 * s, 22 * s, 0, 0, Math.PI * 2);
    g.fill();
    // eyes & smile
    g.fillStyle = "rgba(40,25,20,0.85)";
    g.beginPath();
    g.arc(113 * s, 116 * s, 4 * s, 0, Math.PI * 2);
    g.arc(143 * s, 116 * s, 4 * s, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(120,50,40,0.8)";
    g.lineWidth = 3 * s;
    g.beginPath();
    g.arc(128 * s, 128 * s, 12 * s, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
    g.restore();
    // average colour for heavy blur
    const c = new THREE.Color(bg).lerp(new THREE.Color(shirt), 0.3).lerp(new THREE.Color(skin), 0.25);
    avg.push(c);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return { texture: tex, averages: avg };
};
