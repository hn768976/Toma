import * as THREE from 'three';
import {mulberry32} from '../lib/random';

// A generic coin, built entirely in code. Units: centimetres.
// 24 mm across, 2 mm thick, reeded edge, raised rim, inner ring and an
// abstract star-in-circle emblem (normal map). No text, numbers or portraits.
export const COIN_R = 1.2;
export const COIN_T = 0.2;
const REEDS = 120;

// Face profile (radius, height above the coin's mid-plane), centre -> edge.
const FACE_PROFILE: [number, number][] = [
  [0.0, 0.074],
  [0.7, 0.074],
  [0.745, 0.08],
  [0.77, 0.084],
  [0.795, 0.08],
  [0.82, 0.074],
  [0.875, 0.074],
  [0.9, 0.094],
  [0.915, 0.1],
  [0.985, 0.1],
  [1.0, 0.092],
];

export const buildCoinGeometry = () => {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const SEG = 128;

  // --- faces (group 0) ------------------------------------------------------
  const addFace = (sign: 1 | -1) => {
    const base = positions.length / 3;
    const rings = FACE_PROFILE.length;
    for (let r = 0; r < rings; r++) {
      const [rr, hh] = FACE_PROFILE[r];
      for (let s = 0; s <= SEG; s++) {
        const a = (s / SEG) * Math.PI * 2;
        const x = Math.cos(a) * rr * COIN_R;
        const z = Math.sin(a) * rr * COIN_R;
        positions.push(x, hh * sign * (COIN_T / 0.2), z * sign);
        uvs.push(0.5 + x / (2 * COIN_R), 0.5 + (z * sign) / (2 * COIN_R));
      }
    }
    for (let r = 0; r < rings - 1; r++) {
      for (let s = 0; s < SEG; s++) {
        const a = base + r * (SEG + 1) + s;
        const b = a + SEG + 1;
        // winding so the normal faces outwards (+y for the top face)
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  };
  addFace(1);
  addFace(-1);
  const faceCount = indices.length;

  // --- reeded edge (group 1) ------------------------------------------------
  const ESEG = REEDS * 4;
  const edgeBase = positions.length / 3;
  const top = FACE_PROFILE[FACE_PROFILE.length - 1][1] * (COIN_T / 0.2);
  const heights = [top, top * 0.92, -top * 0.92, -top];
  const insets = [0.012, 0, 0, 0.012];
  for (let h = 0; h < heights.length; h++) {
    for (let s = 0; s <= ESEG; s++) {
      const a = (s / ESEG) * Math.PI * 2;
      const reed = 0.5 + 0.5 * Math.cos(a * REEDS);
      const r = COIN_R - 0.007 * reed - insets[h];
      positions.push(Math.cos(a) * r, heights[h], Math.sin(a) * r);
      uvs.push(s / ESEG, h / 3);
    }
  }
  for (let h = 0; h < heights.length - 1; h++) {
    for (let s = 0; s < ESEG; s++) {
      const a = edgeBase + h * (ESEG + 1) + s;
      const b = a + ESEG + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.addGroup(0, faceCount, 0);
  g.addGroup(faceCount, indices.length - faceCount, 1);
  g.computeVertexNormals();
  // The face's flat regions should have exact up/down normals (the shared
  // ring vertices otherwise average with the slopes).
  return g;
};

// Height field of the emblem -> tangent-space normal map.
export const buildEmblemNormalMap = () => {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  ctx.filter = 'blur(3px)';
  const cx = S / 2;
  // outer emblem circle (ring)
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = S * 0.028;
  ctx.beginPath();
  ctx.arc(cx, cx, S * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  // fine dotted ring
  ctx.fillStyle = '#bbb';
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * S * 0.345, cx + Math.sin(a) * S * 0.345, S * 0.007, 0, Math.PI * 2);
    ctx.fill();
  }
  // star with bevelled facets: brighter towards the centre
  const R = S * 0.24;
  for (let k = 0; k < 6; k++) {
    const scale = 1 - k * 0.15;
    ctx.fillStyle = `rgb(${120 + k * 27},${120 + k * 27},${120 + k * 27})`;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = (i % 2 === 0 ? R : R * 0.42) * scale;
      const x = cx + Math.cos(a) * rr;
      const y = cx + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  const src = ctx.getImageData(0, 0, S, S).data;
  const h = (x: number, y: number) => src[(Math.min(S - 1, Math.max(0, y)) * S + Math.min(S - 1, Math.max(0, x))) * 4] / 255;
  const out = new Uint8Array(S * S * 4);
  const k = 5.5;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * k;
      const dy = (h(x, y + 1) - h(x, y - 1)) * k;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * S + x) * 4;
      out[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      out[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(out, S, S, THREE.RGBAFormat);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
};

// Wear: soft roughness variation (green channel is what three.js reads).
export const buildRoughnessMap = () => {
  const S = 256;
  const rng = mulberry32(0xc0115);
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgb(200,200,200)';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const r = 4 + rng() * 26;
    const v = Math.round(150 + rng() * 105);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${v},${v},${v},0.5)`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // fine scratches
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 90; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const a = rng() * Math.PI;
    const l = 6 + rng() * 30;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

export const METALS = {
  gold: '#E8B84A',
  silver: '#D8DCE0',
  copper: '#C87A4A',
} as const;
export type Metal = keyof typeof METALS;
