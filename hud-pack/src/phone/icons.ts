// Generic pictograms drawn in code (no brands): cloud, mail, camera, chart, chat,
// settings, music, map. Each draws into a unit box centred on (0,0), size ~1.

type Ctx = CanvasRenderingContext2D;

const cloud = (c: Ctx) => {
  c.beginPath();
  c.moveTo(-0.38, 0.18);
  c.arc(-0.22, 0.02, 0.17, Math.PI * 0.75, Math.PI * 1.55);
  c.arc(0.02, -0.12, 0.25, Math.PI * 1.15, Math.PI * 1.9);
  c.arc(0.26, 0.04, 0.16, Math.PI * 1.45, Math.PI * 0.4);
  c.lineTo(-0.3, 0.18);
  c.closePath();
  c.stroke();
};

export const PICTOGRAMS: Record<string, (c: Ctx) => void> = {
  cloud,
  mail: (c) => {
    c.strokeRect(-0.36, -0.24, 0.72, 0.48);
    c.beginPath();
    c.moveTo(-0.36, -0.24);
    c.lineTo(0, 0.06);
    c.lineTo(0.36, -0.24);
    c.stroke();
  },
  camera: (c) => {
    c.beginPath();
    c.moveTo(-0.38, -0.16);
    c.lineTo(-0.16, -0.16);
    c.lineTo(-0.1, -0.27);
    c.lineTo(0.1, -0.27);
    c.lineTo(0.16, -0.16);
    c.lineTo(0.38, -0.16);
    c.lineTo(0.38, 0.26);
    c.lineTo(-0.38, 0.26);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.arc(0, 0.05, 0.13, 0, Math.PI * 2);
    c.stroke();
  },
  chart: (c) => {
    c.beginPath();
    c.moveTo(-0.36, -0.32);
    c.lineTo(-0.36, 0.3);
    c.lineTo(0.38, 0.3);
    c.stroke();
    [[-0.24, 0.12], [-0.08, -0.02], [0.08, -0.16], [0.24, 0.0]].forEach(([x, top]) => c.strokeRect(x - 0.05, top, 0.1, 0.26 - top));
  },
  chat: (c) => {
    c.beginPath();
    c.moveTo(-0.36, -0.26);
    c.lineTo(0.36, -0.26);
    c.lineTo(0.36, 0.14);
    c.lineTo(-0.06, 0.14);
    c.lineTo(-0.22, 0.3);
    c.lineTo(-0.22, 0.14);
    c.lineTo(-0.36, 0.14);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(-0.22, -0.12);
    c.lineTo(0.22, -0.12);
    c.moveTo(-0.22, 0.0);
    c.lineTo(0.1, 0.0);
    c.stroke();
  },
  settings: (c) => {
    c.beginPath();
    const n = 8;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? 0.34 : 0.26;
      const a0 = a - Math.PI / (n * 2) * 0.6;
      const a1 = a + Math.PI / (n * 2) * 0.6;
      if (i === 0) c.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
      c.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
      c.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
    }
    c.closePath();
    c.stroke();
    c.beginPath();
    c.arc(0, 0, 0.11, 0, Math.PI * 2);
    c.stroke();
  },
  music: (c) => {
    c.beginPath();
    c.moveTo(-0.12, 0.2);
    c.lineTo(-0.12, -0.28);
    c.lineTo(0.28, -0.36);
    c.lineTo(0.28, 0.12);
    c.moveTo(-0.12, -0.16);
    c.lineTo(0.28, -0.24);
    c.stroke();
    c.beginPath();
    c.ellipse(-0.2, 0.22, 0.09, 0.07, -0.3, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.ellipse(0.2, 0.14, 0.09, 0.07, -0.3, 0, Math.PI * 2);
    c.stroke();
  },
  map: (c) => {
    c.beginPath();
    c.moveTo(-0.38, -0.24);
    c.lineTo(-0.13, -0.32);
    c.lineTo(0.13, -0.24);
    c.lineTo(0.38, -0.32);
    c.lineTo(0.38, 0.26);
    c.lineTo(0.13, 0.34);
    c.lineTo(-0.13, 0.26);
    c.lineTo(-0.38, 0.34);
    c.closePath();
    c.moveTo(-0.13, -0.32);
    c.lineTo(-0.13, 0.26);
    c.moveTo(0.13, -0.24);
    c.lineTo(0.13, 0.34);
    c.stroke();
  },
};

export const ICON_ORDER = ["cloud", "mail", "camera", "chart", "chat", "settings", "music", "map"] as const;
