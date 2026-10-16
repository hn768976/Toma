import { MONO } from "../../lib/fonts";
import { hash3 } from "../../lib/random";

// HUD tag contents, drawn to small canvases every frame from the frame
// number only (values tick on fixed frame buckets).
export const TAG_PX = 64; // canvas pixels per tag-height unit

export const TAG_KINDS = [
  { aspect: 3.0 }, // 0: "09" circle badge + label
  { aspect: 3.6 }, // 1: segmented bar meter
  { aspect: 3.2 }, // 2: waveform
  { aspect: 2.2 }, // 3: code readout
  { aspect: 2.0 }, // 4: monitor with coloured content
  { aspect: 3.4 }, // 5: small label lines
  { aspect: 3.0 }, // 6: bar panel
];

export const drawTag = (c: CanvasRenderingContext2D, kind: number, tick: number, ink: string) => {
  const W = c.canvas.width;
  const H = c.canvas.height;
  c.clearRect(0, 0, W, H);
  c.strokeStyle = ink;
  c.fillStyle = ink;
  c.lineWidth = 2;
  c.globalAlpha = 1;
  const pad = 4;
  if (kind !== 0 && kind !== 5) c.strokeRect(pad, pad, W - 2 * pad, H - 2 * pad);
  const hh = (n: number) => hash3(tick, n, kind);
  c.font = `500 ${Math.round(H * 0.38)}px ${MONO}`;
  c.textBaseline = "middle";
  if (kind === 0) {
    c.beginPath();
    c.arc(H / 2, H / 2, H / 2 - 5, 0, Math.PI * 2);
    c.stroke();
    c.textAlign = "center";
    c.font = `500 ${Math.round(H * 0.42)}px ${MONO}`;
    c.fillText(String(Math.floor(hh(1) * 90) + 10).padStart(2, "0"), H / 2, H / 2 + 1);
    c.strokeRect(H + 6, H * 0.3, W - H - 12, H * 0.4);
    c.fillRect(H + 10, H * 0.38, (W - H - 20) * (0.3 + 0.6 * hh(2)), H * 0.24);
  } else if (kind === 1) {
    const n = 8;
    const lit = 3 + Math.floor(hh(1) * 5);
    for (let i = 0; i < n; i++) {
      c.globalAlpha = i < lit ? 1 : 0.3;
      c.fillRect(pad + 8 + i * ((W - 16 - 2 * pad) / n), H * 0.28, (W - 16 - 2 * pad) / n - 6, H * 0.44);
    }
  } else if (kind === 2) {
    c.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = pad + 6 + ((W - 12 - 2 * pad) * i) / 24;
      const y = H / 2 + Math.sin(i * 0.8 + tick * 0.7) * H * 0.22 * (0.4 + 0.6 * hash3(i, tick >> 2, 4));
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();
  } else if (kind === 3) {
    c.textAlign = "center";
    c.fillText(`0X${String(Math.floor(hh(1) * 99)).padStart(2, "0")}`, W / 2, H / 2 + 1);
  } else if (kind === 4) {
    for (let i = 0; i < 4; i++) {
      c.globalAlpha = 0.9;
      c.fillStyle = i % 2 ? "#FF5A4A" : "#5AF07A";
      c.fillRect(pad + 8, pad + 6 + i * ((H - 12 - 2 * pad) / 4), (W - 2 * pad - 16) * (0.3 + 0.6 * hh(i)), (H - 2 * pad) / 4 - 6);
    }
  } else if (kind === 5) {
    c.textAlign = "left";
    c.font = `500 ${Math.round(H * 0.3)}px ${MONO}`;
    c.fillText(`ID_${String(Math.floor(hh(1) * 9000) + 1000)}`, pad, H * 0.32);
    c.globalAlpha = 0.6;
    c.fillRect(pad, H * 0.62, W * (0.4 + 0.4 * hh(2)), H * 0.12);
  } else {
    for (let i = 0; i < 9; i++) {
      const bh = (H - 2 * pad - 10) * (0.2 + 0.8 * hh(i));
      c.fillRect(pad + 8 + i * ((W - 16) / 9), H - pad - 5 - bh, (W - 16) / 9 - 5, bh);
    }
  }
  c.globalAlpha = 1;
};
