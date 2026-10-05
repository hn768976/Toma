import * as THREE from 'three';

// Self-drawn white line icons (tinted by the material colour). Each texture is
// drawn once per tab into a canvas; no external artwork.

export type IconKind =
  | 'pin'
  | 'pinMinor'
  | 'pinChart'
  | 'ship'
  | 'tanker'
  | 'plane'
  | 'truck'
  | 'factory'
  | 'badge'
  | 'crane'
  | 'building'
  | 'pump';

const S = 256;

const starPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

const teardrop = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, tipY: number) => {
  // circle of radius r centred (cx, cy) meeting a point at (cx, tipY)
  const d = tipY - cy;
  const a = Math.acos(r / d);
  ctx.beginPath();
  ctx.moveTo(cx, tipY);
  ctx.arc(cx, cy, r, Math.PI / 2 + a, Math.PI / 2 - a + Math.PI * 2, false);
  ctx.closePath();
};

const glowStroke = (ctx: CanvasRenderingContext2D, width: number, glow: number) => {
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur = glow;
  ctx.lineWidth = width;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.restore();
};

const drawIcon = (ctx: CanvasRenderingContext2D, kind: IconKind) => {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const w = S;
  const h = kind.startsWith('pin') ? S * 1.25 : S;
  if (kind === 'badge') {
    // ring badge: thin circle with a small star, like a map marker seen flat
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
    glowStroke(ctx, 7, 8);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.27, 0, Math.PI * 2);
    glowStroke(ctx, 4, 4);
    starPath(ctx, w / 2, h / 2, w * 0.15);
    ctx.fillStyle = '#fff';
    ctx.fill();
    return;
  }
  if (kind === 'pin' || kind === 'pinChart' || kind === 'pinMinor') {
    const cx = w / 2;
    const cy = h * 0.36;
    const r = w * 0.3;
    teardrop(ctx, cx, cy, r, h * 0.95);
    if (kind !== 'pinMinor') {
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fill();
    }
    glowStroke(ctx, kind === 'pinMinor' ? 9 : 13, kind === 'pinMinor' ? 10 : 22);
    // inner ring
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    glowStroke(ctx, kind === 'pinMinor' ? 6 : 8, 8);
    if (kind === 'pinChart') {
      ctx.beginPath();
      const bw = r * 0.18;
      [0.45, 0.75, 1.05].forEach((k, i) => {
        const x = cx - r * 0.38 + i * bw * 1.6;
        ctx.rect(x, cy + r * 0.32 - r * 0.62 * k, bw, r * 0.62 * k);
      });
      ctx.fillStyle = '#fff';
      ctx.fill();
    } else {
      starPath(ctx, cx, cy, r * 0.4);
      ctx.fillStyle = kind === 'pinMinor' ? 'rgba(255,255,255,0.85)' : '#fff';
      ctx.fill();
    }
    return;
  }
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.beginPath();
  switch (kind) {
    case 'ship': {
      // container ship, side view
      ctx.moveTo(-100, 10);
      ctx.lineTo(100, 10);
      ctx.lineTo(80, 45);
      ctx.lineTo(-88, 45);
      ctx.closePath();
      for (let i = 0; i < 5; i++) ctx.rect(-70 + i * 28, -14, 24, 24);
      ctx.rect(62, -40, 22, 50);
      break;
    }
    case 'tanker': {
      ctx.moveTo(-105, 10);
      ctx.lineTo(105, 10);
      ctx.lineTo(88, 42);
      ctx.lineTo(-92, 42);
      ctx.closePath();
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(-58 + i * 36 + 15, 10);
        ctx.arc(-58 + i * 36, 10, 15, 0, Math.PI, true);
      }
      ctx.rect(70, -30, 20, 40);
      break;
    }
    case 'plane': {
      ctx.moveTo(-100, 4);
      ctx.lineTo(70, 4);
      ctx.quadraticCurveTo(105, 0, 70, -12);
      ctx.lineTo(-80, -12);
      ctx.lineTo(-100, -45);
      ctx.lineTo(-112, -45);
      ctx.lineTo(-100, 4);
      ctx.moveTo(-10, -4);
      ctx.lineTo(-45, 45);
      ctx.lineTo(-25, 45);
      ctx.lineTo(25, -4);
      break;
    }
    case 'truck': {
      ctx.rect(-100, -45, 130, 70);
      ctx.moveTo(30, -20);
      ctx.lineTo(75, -20);
      ctx.lineTo(100, 5);
      ctx.lineTo(100, 25);
      ctx.lineTo(30, 25);
      ctx.moveTo(-70 + 16, 40);
      ctx.arc(-70, 40, 16, 0, Math.PI * 2);
      ctx.moveTo(70 + 16, 40);
      ctx.arc(70, 40, 16, 0, Math.PI * 2);
      break;
    }
    case 'factory': {
      ctx.moveTo(-100, 60);
      ctx.lineTo(-100, -10);
      ctx.lineTo(-55, 15);
      ctx.lineTo(-55, -10);
      ctx.lineTo(-10, 15);
      ctx.lineTo(-10, -10);
      ctx.lineTo(35, 15);
      ctx.lineTo(35, -80);
      ctx.lineTo(60, -80);
      ctx.lineTo(60, 15);
      ctx.lineTo(100, 15);
      ctx.lineTo(100, 60);
      ctx.closePath();
      ctx.rect(-80, 30, 18, 14);
      ctx.rect(-40, 30, 18, 14);
      ctx.rect(0, 30, 18, 14);
      break;
    }
    case 'crane': {
      ctx.moveTo(-60, 90);
      ctx.lineTo(-60, -80);
      ctx.lineTo(-30, -80);
      ctx.lineTo(-30, 90);
      ctx.moveTo(-100, -80);
      ctx.lineTo(100, -80);
      ctx.lineTo(100, -60);
      ctx.lineTo(-100, -60);
      ctx.closePath();
      ctx.moveTo(-45, -80);
      ctx.lineTo(-45, -110);
      ctx.lineTo(60, -80);
      ctx.moveTo(80, -60);
      ctx.lineTo(80, 10);
      ctx.rect(66, 10, 28, 20);
      ctx.moveTo(-100, 90);
      ctx.lineTo(20, 90);
      break;
    }
    case 'building': {
      ctx.rect(-70, -100, 70, 190);
      ctx.rect(0, -40, 70, 130);
      for (let r = 0; r < 6; r++) {
        ctx.rect(-55, -80 + r * 26, 14, 12);
        ctx.rect(-28, -80 + r * 26, 14, 12);
      }
      for (let r = 0; r < 4; r++) ctx.rect(18, -22 + r * 26, 34, 10);
      break;
    }
    case 'pump': {
      ctx.moveTo(-90, 80);
      ctx.lineTo(90, 80);
      ctx.moveTo(-50, 80);
      ctx.lineTo(-10, -20);
      ctx.lineTo(30, 80);
      ctx.moveTo(-95, -55);
      ctx.lineTo(70, -5);
      ctx.lineTo(80, -35);
      ctx.lineTo(-85, -85);
      ctx.closePath();
      ctx.moveTo(-90, -40);
      ctx.lineTo(-90, 50);
      ctx.rect(-100, 50, 20, 20);
      break;
    }
    default:
      break;
  }
  ctx.restore();
  glowStroke(ctx, 6, 8);
};

const cache = new Map<IconKind, THREE.Texture>();

export const iconTexture = (kind: IconKind) => {
  const hit = cache.get(kind);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = kind.startsWith('pin') ? S * 1.25 : S;
  drawIcon(c.getContext('2d')!, kind);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  cache.set(kind, t);
  return t;
};

export const iconAspect = (kind: IconKind) => (kind.startsWith('pin') ? 1.25 : 1);
