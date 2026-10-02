import * as THREE from "three";
import { MONO, MONTSERRAT, fontsReady } from "../../lib/fonts";
import { mulberry32 } from "../../lib/random";

/**
 * Canvas-generated textures for the tunnel, drawn once (after the shipped
 * fonts are ready) with module-seeded randomness. All are greyscale/white;
 * colour is applied in the shaders from the version row.
 */
export type TunnelTextures = {
  burstLines: THREE.Texture;
  burstDigits: THREE.Texture;
  aiText: THREE.Texture;
  aiGlow: THREE.Texture;
  panels: THREE.Texture; // 4×4 atlas
  tokens: THREE.Texture; // 4×1 atlas: hex, hex-blur, square, square-blur
};

const toTex = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; // treated as linear masks
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
};

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
};

const drawBurstLines = () => {
  const S = 2048;
  const [c, g] = canvas(S, S);
  const rnd = mulberry32(9001);
  const cx = S / 2;
  // soft core
  const core = g.createRadialGradient(cx, cx, 0, cx, cx, S * 0.3);
  core.addColorStop(0, "rgba(255,255,255,0.32)");
  core.addColorStop(0.45, "rgba(255,255,255,0.14)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = core;
  g.fillRect(0, 0, S, S);
  g.lineCap = "round";
  for (let i = 0; i < 2200; i++) {
    const a = rnd() * Math.PI * 2;
    const r0 = S * (0.06 + rnd() * 0.2);
    const len = S * (0.03 + Math.pow(rnd(), 2.2) * 0.38);
    g.strokeStyle = `rgba(255,255,255,${0.1 + rnd() * 0.45})`;
    g.lineWidth = 1 + rnd() * 2.5;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cx + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a) * (r0 + len), cx + Math.sin(a) * (r0 + len));
    g.stroke();
  }
  return toTex(c);
};

const drawBurstDigits = () => {
  const S = 2048;
  const [c, g] = canvas(S, S);
  const rnd = mulberry32(9002);
  const cx = S / 2;
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let i = 0; i < 1400; i++) {
    // denser toward a spherical shell
    const a = rnd() * Math.PI * 2;
    const r = S * 0.34 * Math.sqrt(rnd());
    const size = 12 + rnd() * 22;
    g.font = `500 ${size}px ${MONO}`;
    g.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.7})`;
    g.fillText(rnd() < 0.5 ? "0" : "1", cx + Math.cos(a) * r, cx + Math.sin(a) * r);
  }
  // fine latitude/longitude rings → "data sphere"
  g.strokeStyle = "rgba(255,255,255,0.25)";
  g.lineWidth = 2;
  for (let k = 1; k <= 5; k++) {
    g.beginPath();
    g.ellipse(cx, cx, S * 0.34, S * 0.34 * (k / 6), 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.ellipse(cx, cx, S * 0.34 * (k / 6), S * 0.34, 0, 0, Math.PI * 2);
    g.stroke();
  }
  return toTex(c);
};

const drawAiText = (blur: number) => {
  const [c, g] = canvas(1024, 512);
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.font = `800 400px ${MONTSERRAT}`;
  if (blur) g.filter = `blur(${blur}px)`;
  g.fillText("AI", 512, 256 + 142);
  if (blur) {
    g.filter = `blur(${blur * 2.5}px)`;
    g.globalAlpha = 0.7;
    g.fillText("AI", 512, 256 + 142);
  }
  return toTex(c);
};

const drawPanels = () => {
  const CW = 512;
  const CH = 256;
  const [c, g] = canvas(CW * 4, CH * 4);
  const rnd = mulberry32(9003);
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      const x0 = i * CW;
      const y0 = j * CH;
      g.save();
      g.beginPath();
      g.rect(x0 + 4, y0 + 4, CW - 8, CH - 8);
      g.clip();
      g.fillStyle = "rgba(255,255,255,0.05)";
      g.fillRect(x0, y0, CW, CH);
      // fine grid
      g.strokeStyle = "rgba(255,255,255,0.14)";
      g.lineWidth = 1;
      for (let x = x0; x < x0 + CW; x += 16) {
        g.beginPath();
        g.moveTo(x + 0.5, y0);
        g.lineTo(x + 0.5, y0 + CH);
        g.stroke();
      }
      for (let y = y0; y < y0 + CH; y += 16) {
        g.beginPath();
        g.moveTo(x0, y + 0.5);
        g.lineTo(x0 + CW, y + 0.5);
        g.stroke();
      }
      // border + header
      g.strokeStyle = "rgba(255,255,255,0.8)";
      g.lineWidth = 3;
      g.strokeRect(x0 + 6, y0 + 6, CW - 12, CH - 12);
      g.fillStyle = "rgba(255,255,255,0.55)";
      g.fillRect(x0 + 6, y0 + 6, CW - 12, 18);
      // digits rows
      g.font = `400 14px ${MONO}`;
      g.fillStyle = "rgba(255,255,255,0.85)";
      const rows = 4 + Math.floor(rnd() * 6);
      for (let r = 0; r < rows; r++) {
        let s = "";
        const n = 10 + Math.floor(rnd() * 26);
        for (let k = 0; k < n; k++) s += rnd() < 0.15 ? " " : rnd() < 0.5 ? "0" : rnd() < 0.5 ? "1" : String(Math.floor(rnd() * 10));
        g.fillText(s, x0 + 18, y0 + 50 + r * 20);
      }
      // mini bars / sparkline
      if (rnd() < 0.6) {
        for (let b = 0; b < 18; b++) {
          const h = 10 + rnd() * 60;
          g.fillRect(x0 + CW - 230 + b * 12, y0 + CH - 20 - h, 7, h);
        }
      } else {
        g.beginPath();
        for (let k = 0; k <= 40; k++) {
          const xx = x0 + CW - 260 + k * 6;
          const yy = y0 + CH - 60 + Math.sin(k * 0.6 + rnd()) * 24;
          if (k) g.lineTo(xx, yy);
          else g.moveTo(xx, yy);
        }
        g.lineWidth = 2;
        g.stroke();
      }
      g.restore();
    }
  }
  return toTex(c);
};

const drawTokens = () => {
  const S = 512;
  const [c, g] = canvas(S * 4, S);
  const shape = (x0: number, kind: "hex" | "sq") => {
    g.beginPath();
    const cx = x0 + S / 2;
    const cy = S / 2;
    if (kind === "hex") {
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        const px = cx + Math.cos(a) * S * 0.4;
        const py = cy + Math.sin(a) * S * 0.4;
        if (k) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.closePath();
    } else {
      const r = S * 0.34;
      const rad = S * 0.09;
      g.roundRect(cx - r, cy - r, r * 2, r * 2, rad);
    }
    g.fillStyle = "rgba(255,255,255,0.16)";
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.95)";
    g.lineWidth = 12;
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.font = `800 ${S * 0.3}px ${MONTSERRAT}`;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillText("AI", cx, cy + S * 0.105);
  };
  const cells: ["hex" | "sq", number][] = [
    ["hex", 0],
    ["hex", 18],
    ["sq", 0],
    ["sq", 18],
  ];
  cells.forEach(([k, blur], i) => {
    g.save();
    g.beginPath();
    g.rect(i * S, 0, S, S);
    g.clip();
    g.filter = blur ? `blur(${blur}px)` : "none";
    shape(i * S, k);
    g.restore();
  });
  return toTex(c);
};

let cache: Promise<TunnelTextures> | null = null;

/** Built once per page, after fonts are ready. */
export const loadTunnelTextures = () => {
  if (!cache) {
    cache = fontsReady.then(() => ({
      burstLines: drawBurstLines(),
      burstDigits: drawBurstDigits(),
      aiText: drawAiText(0),
      aiGlow: drawAiText(26),
      panels: drawPanels(),
      tokens: drawTokens(),
    }));
  }
  return cache;
};
