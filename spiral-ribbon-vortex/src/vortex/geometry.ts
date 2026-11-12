import * as THREE from "three";

export type SpiralSpec = {
  /** outer radius at theta = 0 */
  r0: number;
  /** log-spiral tightening per radian (radius = r0 * exp(-tighten * theta)) */
  tighten: number;
  /** how far the spiral recedes along its axis per radian */
  depthPerRad: number;
  /** ribbon width measured along the spiral axis */
  width: number;
  /** angular range (radians); negative start values form the sweeping tail */
  thetaStart: number;
  thetaEnd: number;
  /** number of stacked strips that make up the layered ribbon */
  layers: number;
  /** tail colour (outer end), mid colour, core colour (inner end) */
  colors: readonly [string, string, string];
  /** theta at which tail -> mid and mid -> core transitions are centred */
  colorStops: readonly [number, number];
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Deterministic pseudo random in [0, 1) */
const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Builds a layered ribbon that winds inward along a conical log-spiral.
 * Each layer is a thin strip (two vertex rows across its width) offset in
 * radius and depth, so the stack reads as grooved, laminated paper.
 */
export const buildLayeredSpiral = (spec: SpiralSpec, segments = 520) => {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const cTail = new THREE.Color(spec.colors[0]);
  const cMid = new THREE.Color(spec.colors[1]);
  const cCore = new THREE.Color(spec.colors[2]);
  const tmp = new THREE.Color();

  const across = 3; // vertex rows across each strip (gives a curled profile)
  let base = 0;

  for (let k = 0; k < spec.layers; k++) {
    const layerT = k / Math.max(1, spec.layers - 1);
    const rScale = 1 - 0.1 * layerT + 0.006 * (rand(k) - 0.5);
    const zShift = -0.22 * spec.width * layerT;
    const w = spec.width * (0.55 + 0.45 * rand(k + 9));
    const shade = (k % 2 === 0 ? 1.0 : 0.9) * (0.92 + 0.12 * rand(k + 31));

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const theta = spec.thetaStart + (spec.thetaEnd - spec.thetaStart) * u;
      // tail (theta<0) flares outwards faster than the inner coil
      const tailBoost = theta < 0 ? Math.exp(0.22 * theta * theta) : 1; // C1-smooth flare
      const r = spec.r0 * Math.exp(-spec.tighten * theta) * rScale * tailBoost;
      const zc = -spec.depthPerRad * theta + zShift;
      const cx = Math.cos(theta) * r;
      const cy = Math.sin(theta) * r;

      // colour along the ribbon
      const a = smooth(spec.colorStops[0] - 1.3, spec.colorStops[0] + 1.3, theta);
      const b = smooth(spec.colorStops[1] - 2.2, spec.colorStops[1] + 2.2, theta);
      tmp.copy(cTail).lerp(cMid, a).lerp(cCore, b);
      tmp.multiplyScalar(shade);

      for (let j = 0; j <= across; j++) {
        const v = j / across;
        // slight inward curl of each strip across its width
        const curl = 1 - 0.035 * Math.sin(v * Math.PI);
        positions.push(cx * curl, cy * curl, zc + (v - 0.5) * w);
        colors.push(tmp.r, tmp.g, tmp.b);
        uvs.push(u * (spec.thetaEnd - spec.thetaStart) * 0.5, v + k * 0.37);
      }
    }

    const row = across + 1;
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < across; j++) {
        const p = base + i * row + j;
        indices.push(p, p + row, p + 1, p + 1, p + row, p + row + 1);
      }
    }
    base += (segments + 1) * row;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
};

/**
 * Fine brushed groove texture: thin lines running along the ribbon, which
 * give the laminated / pleated look of the reference at close range.
 */
export const buildGrooveTexture = () => {
  const w = 16;
  const h = 512;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / h;
    let g = 0.86;
    g += 0.07 * Math.sin(v * Math.PI * 2 * 4 + 0.7);
    g += 0.035 * Math.sin(v * Math.PI * 2 * 13 + 2.1);
    g += 0.02 * (rand(y) - 0.5);
    // occasional dark seam between pleats
    if (rand(y * 3 + 1) > 0.97) g -= 0.07;
    const c = Math.round(Math.min(1, Math.max(0, g)) * 255);
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      data[o] = c;
      data[o + 1] = c;
      data[o + 2] = c;
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};
