/**
 * Framing self-test. Run: npm run verify:framing
 *
 * Rasterises the ribbon's silhouette through the real camera and checks the
 * composition rule that the band is cropped by all four frame edges at every
 * rotation.
 *
 * Done geometrically rather than by thresholding a render: the band's shadowed
 * underside is DARKER than the backdrop, so no brightness threshold can tell
 * band from background.
 */
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { buildRibbon } from '../src/ribbon/geometry';
import {
  A_RATIO,
  COMP_HEIGHT,
  COMP_WIDTH,
  DURATION_IN_FRAMES,
  H3_RATIO,
  K,
  R,
  ROTATION_PHASE_DEG,
  SEGMENTS,
  THICKNESS_RATIO,
  TWIST_PHASE_DEG,
  WIDTH_RATIO,
} from '../src/ribbon/params';
import { CAMERA } from '../src/ribbon/versions';

const W = 480;
const H = Math.round((W * COMP_HEIGHT) / COMP_WIDTH);

const { positions, indices } = buildRibbon({
  R,
  aRatio: A_RATIO,
  h3Ratio: H3_RATIO,
  k: K,
  widthRatio: WIDTH_RATIO,
  thicknessRatio: THICKNESS_RATIO,
  segments: SEGMENTS,
  twistPhase: (TWIST_PHASE_DEG * Math.PI) / 180,
});

const camera = new PerspectiveCamera(
  CAMERA.fov,
  COMP_WIDTH / COMP_HEIGHT,
  CAMERA.near,
  CAMERA.far,
);
camera.position.set(...CAMERA.position);
camera.lookAt(new Vector3(...CAMERA.lookAt));
camera.updateMatrixWorld(true);
camera.updateProjectionMatrix();

const viewProj = new Matrix4().multiplyMatrices(
  camera.projectionMatrix,
  camera.matrixWorldInverse,
);

const coverageAt = (frame: number) => {
  const rot =
    Math.PI * (frame / DURATION_IN_FRAMES) +
    (ROTATION_PHASE_DEG * Math.PI) / 180;
  const model = new Matrix4().makeRotationY(rot);
  const mvp = new Matrix4().multiplyMatrices(viewProj, model);
  const e = mvp.elements;

  const n = positions.length / 3;
  const sx = new Float64Array(n);
  const sy = new Float64Array(n);
  const behind = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (cw <= 1e-6) {
      behind[i] = 1;
      continue;
    }
    const cx = e[0] * x + e[4] * y + e[8] * z + e[12];
    const cy = e[1] * x + e[5] * y + e[9] * z + e[13];
    sx[i] = ((cx / cw) * 0.5 + 0.5) * W;
    sy[i] = (1 - (cy / cw) * 0.5 - 0.5) * H;
  }

  const mask = new Uint8Array(W * H);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t];
    const b = indices[t + 1];
    const c = indices[t + 2];
    if (behind[a] || behind[b] || behind[c]) continue;
    const minX = Math.max(0, Math.floor(Math.min(sx[a], sx[b], sx[c])));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(sx[a], sx[b], sx[c])));
    const minY = Math.max(0, Math.floor(Math.min(sy[a], sy[b], sy[c])));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(sy[a], sy[b], sy[c])));
    if (minX > maxX || minY > maxY) continue;
    const d =
      (sy[b] - sy[c]) * (sx[a] - sx[c]) + (sx[c] - sx[b]) * (sy[a] - sy[c]);
    if (d === 0) continue;
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const x = px + 0.5;
        const y = py + 0.5;
        const l1 =
          ((sy[b] - sy[c]) * (x - sx[c]) + (sx[c] - sx[b]) * (y - sy[c])) / d;
        const l2 =
          ((sy[c] - sy[a]) * (x - sx[c]) + (sx[a] - sx[c]) * (y - sy[c])) / d;
        const l3 = 1 - l1 - l2;
        if (l1 >= 0 && l2 >= 0 && l3 >= 0) mask[py * W + px] = 1;
      }
    }
  }

  let filled = 0;
  for (let i = 0; i < mask.length; i++) filled += mask[i];
  const frac = (pts: number[]) =>
    pts.reduce((s, i) => s + mask[i], 0) / pts.length;
  const top: number[] = [];
  const bottom: number[] = [];
  const left: number[] = [];
  const right: number[] = [];
  for (let x = 0; x < W; x++) {
    top.push(x);
    bottom.push((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    left.push(y * W);
    right.push(y * W + W - 1);
  }
  return {
    top: frac(top),
    bottom: frac(bottom),
    left: frac(left),
    right: frac(right),
    fill: filled / mask.length,
    mask,
  };
};

let failures = 0;
console.log(
  `camera pos=[${CAMERA.position.join(', ')}] lookAt=[${CAMERA.lookAt.join(', ')}] fov=${CAMERA.fov}`,
);
console.log(
  `k=${K} A=${A_RATIO}R width=${WIDTH_RATIO}R twistPhase=${TWIST_PHASE_DEG}deg rotationPhase=${ROTATION_PHASE_DEG}deg\n`,
);
console.log('frame   top  bottom    left   right    fill');
for (let frame = 0; frame < DURATION_IN_FRAMES; frame += 25) {
  const c = coverageAt(frame);
  const ok = c.top > 0 && c.bottom > 0 && c.left > 0 && c.right > 0;
  if (!ok) failures++;
  console.log(
    `${String(frame).padStart(5)}  ${c.top.toFixed(3)}   ${c.bottom.toFixed(3)}   ${c.left.toFixed(3)}   ${c.right.toFixed(3)}   ${c.fill.toFixed(3)}  ${ok ? '' : '<-- NOT CROPPED ON ALL FOUR EDGES'}`,
  );
}

// ASCII preview of the checkpoint frames named in the verify loop.
for (const frame of [0, 75, 150, 225]) {
  const { mask } = coverageAt(frame);
  console.log(`\nframe ${frame}`);
  for (let y = 0; y < H; y += Math.floor(H / 18)) {
    let s = '';
    for (let x = 0; x < W; x += Math.floor(W / 72)) s += mask[y * W + x] ? '#' : '.';
    console.log('  ' + s);
  }
}

console.log(
  failures === 0
    ? '\nFRAMING OK: band is cropped by all four edges at every sampled frame'
    : `\n${failures} sampled frame(s) FAILED the four-edge crop rule`,
);
process.exit(failures === 0 ? 0 : 1);
