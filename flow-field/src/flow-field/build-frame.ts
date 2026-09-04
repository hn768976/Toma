import { CAMERA } from "./camera";
import {
  BASE_HEIGHT,
  BLOOM_INTENSITY,
  BLOOM_SIGMA_CAP,
  BLOOM_THRESHOLD,
  BLOOM_WIDTH_MULT,
  DOF_FAR_SPAN,
  DOF_MAX_WIDEN,
  DOF_NEAR_SPAN,
  FADE_IN_STEPS,
  FADE_OUT_STEPS,
  FAR_DEPTH,
  FOCUS_DEPTH,
  FOG_DISTANCE,
  FOG_POWER,
  GLOW_MAX_STRIDE,
  HALO_INTENSITY,
  HALO_SIGMA_CAP,
  HALO_THRESHOLD,
  HALO_WIDTH_MULT,
  LINE_SIGMA_FAR,
  LINE_SIGMA_NEAR,
  NEAR_DEPTH,
  STEP,
  TRAIL_MAX,
} from "./constants";
import { GRID_DX, GRID_DZ, sampleGrid, updateField, type Field } from "./field";
import type { Particles } from "./particles";
import { clamp, smoothstep } from "./random";

export type TrailBuffers = {
  position: Float32Array;
  /** Position across the quad, -1..1. */
  cross: Float32Array;
  /** Position along the quad, -1..1; zero for ribbons, which do not taper. */
  along: Float32Array;
  color: Float32Array;
  index: Uint32Array;
  quadCapacity: number;
};

export const createTrailBuffers = (quadCapacity: number): TrailBuffers => {
  const index = new Uint32Array(quadCapacity * 6);
  for (let q = 0; q < quadCapacity; q++) {
    const v = q * 4;
    const o = q * 6;
    index[o] = v;
    index[o + 1] = v + 1;
    index[o + 2] = v + 2;
    index[o + 3] = v + 2;
    index[o + 4] = v + 1;
    index[o + 5] = v + 3;
  }
  return {
    position: new Float32Array(quadCapacity * 12),
    cross: new Float32Array(quadCapacity * 4),
    along: new Float32Array(quadCapacity * 4),
    color: new Float32Array(quadCapacity * 12),
    index,
    quadCapacity,
  };
};

// Scratch for one particle's trail. Module-level so the hot loop allocates
// nothing; safe because a frame is built synchronously start to finish.
const trailX = new Float32Array(TRAIL_MAX + 1);
const trailZ = new Float32Array(TRAIL_MAX + 1);
const ptX = new Float32Array(TRAIL_MAX + 1);
const ptY = new Float32Array(TRAIL_MAX + 1);
const ptZ = new Float32Array(TRAIL_MAX + 1);
const ptDepth = new Float32Array(TRAIL_MAX + 1);
const ptSigma = new Float32Array(TRAIL_MAX + 1);
const ptR = new Float32Array(TRAIL_MAX + 1);
const ptG = new Float32Array(TRAIL_MAX + 1);
const ptB = new Float32Array(TRAIL_MAX + 1);
const ptOn = new Uint8Array(TRAIL_MAX + 1);
const ptEnergy = new Float32Array(TRAIL_MAX + 1);

export type BuildArgs = {
  frame: number;
  durationInFrames: number;
  /** Composition height in pixels — line sizes are expressed against it. */
  compHeight: number;
  /** Minimum sigma that still survives the render's device-pixel grid. */
  sigmaFloor: number;
  field: Field;
  particles: Particles;
  rampLut: Float32Array;
  buffers: TrailBuffers;
};

/**
 * Rebuild the whole trail geometry for one frame.
 *
 * Returns the number of quads written; the caller sets the geometry's draw
 * range from it. Every quad is a camera-facing ribbon segment whose half-width
 * is derived from a target width in *composition* pixels, so a 1080p preview
 * and a 4K render differ only by resampling.
 */
export const buildFrame = ({
  frame,
  durationInFrames,
  compHeight,
  sigmaFloor,
  field,
  particles,
  rampLut,
  buffers,
}: BuildArgs): number => {
  updateField(field, (frame % durationInFrames) / durationInFrames);

  const cam = CAMERA;
  const { position, cross, along, color, quadCapacity } = buffers;
  const {
    seedX,
    seedZ,
    trail,
    cycle,
    phase,
    speed,
    bias,
    count,
  } = particles;
  const { vx: gvx, vz: gvz, height: gh, bright: gb } = field;

  // Composition pixels -> world units at a given view depth.
  const worldPerPxK = (2 * cam.tanHalfV) / compHeight;
  const scaleFromBase = compHeight / BASE_HEIGHT;
  const sigmaNear = LINE_SIGMA_NEAR * scaleFromBase;
  const sigmaFar = LINE_SIGMA_FAR * scaleFromBase;
  const bloomCap = BLOOM_SIGMA_CAP * scaleFromBase;
  const haloCap = HALO_SIGMA_CAP * scaleFromBase;
  const invDepthSpan = 1 / (FAR_DEPTH - NEAR_DEPTH);

  let quads = 0;

  /** One ribbon segment: a flat quad that runs along the trail. */
  const emitRibbon = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    perpX: number, perpY: number, perpZ: number,
    halfA: number, halfB: number,
    r0: number, g0: number, b0: number,
    r1: number, g1: number, b1: number,
  ) => {
    if (quads >= quadCapacity) return;
    const p = quads * 12;
    const c = quads * 4;

    position[p] = ax + perpX * halfA;
    position[p + 1] = ay + perpY * halfA;
    position[p + 2] = az + perpZ * halfA;
    position[p + 3] = ax - perpX * halfA;
    position[p + 4] = ay - perpY * halfA;
    position[p + 5] = az - perpZ * halfA;
    position[p + 6] = bx + perpX * halfB;
    position[p + 7] = by + perpY * halfB;
    position[p + 8] = bz + perpZ * halfB;
    position[p + 9] = bx - perpX * halfB;
    position[p + 10] = by - perpY * halfB;
    position[p + 11] = bz - perpZ * halfB;

    cross[c] = 1;
    cross[c + 1] = -1;
    cross[c + 2] = 1;
    cross[c + 3] = -1;
    along[c] = 0;
    along[c + 1] = 0;
    along[c + 2] = 0;
    along[c + 3] = 0;

    color[p] = r0;
    color[p + 1] = g0;
    color[p + 2] = b0;
    color[p + 3] = r0;
    color[p + 4] = g0;
    color[p + 5] = b0;
    color[p + 6] = r1;
    color[p + 7] = g1;
    color[p + 8] = b1;
    color[p + 9] = r1;
    color[p + 10] = g1;
    color[p + 11] = b1;

    quads++;
  };

  /**
   * One glow blob: a square camera-facing billboard with a radial falloff.
   *
   * Glows have to be round. Drawn as ribbons they end up many times wider than
   * they are long, and the hard ends of those quads show up as rectangles all
   * over the far field.
   */
  const emitBlob = (
    cx: number, cy: number, cz: number,
    perpX: number, perpY: number, perpZ: number,
    dirX: number, dirY: number, dirZ: number,
    half: number,
    r: number, g: number, b: number,
  ) => {
    if (quads >= quadCapacity) return;
    const p = quads * 12;
    const c = quads * 4;

    const ux = perpX * half;
    const uy = perpY * half;
    const uz = perpZ * half;
    const vx2 = dirX * half;
    const vy2 = dirY * half;
    const vz2 = dirZ * half;

    position[p] = cx + ux - vx2;
    position[p + 1] = cy + uy - vy2;
    position[p + 2] = cz + uz - vz2;
    position[p + 3] = cx - ux - vx2;
    position[p + 4] = cy - uy - vy2;
    position[p + 5] = cz - uz - vz2;
    position[p + 6] = cx + ux + vx2;
    position[p + 7] = cy + uy + vy2;
    position[p + 8] = cz + uz + vz2;
    position[p + 9] = cx - ux + vx2;
    position[p + 10] = cy - uy + vy2;
    position[p + 11] = cz - uz + vz2;

    cross[c] = 1;
    cross[c + 1] = -1;
    cross[c + 2] = 1;
    cross[c + 3] = -1;
    along[c] = -1;
    along[c + 1] = -1;
    along[c + 2] = 1;
    along[c + 3] = 1;

    for (let k = 0; k < 4; k++) {
      color[p + k * 3] = r;
      color[p + k * 3 + 1] = g;
      color[p + k * 3 + 2] = b;
    }

    quads++;
  };

  for (let i = 0; i < count; i++) {
    const c = cycle[i];
    const age = (frame + phase[i]) % c;
    if (age < 2) continue;

    const len = Math.min(trail[i], age);
    if (len < 2) continue;

    // --- integrate the streamline forward from the seed ----------------------
    const h = STEP * speed[i];
    const halfH = h * 0.5;
    let x = seedX[i];
    let z = seedZ[i];
    const skip = age - len;

    // One RK2 (midpoint) step per frame of age. Velocity is normalised, so
    // every particle moves at its own steady pace along the streamline rather
    // than racing through the strong parts of the field and stalling in the
    // weak ones — and the trail keeps a stable length.
    for (let s = 0; s < age; s++) {
      if (s === skip) {
        trailX[0] = x;
        trailZ[0] = z;
      }
      const v1x = sampleGrid(gvx, x, z);
      const v1z = sampleGrid(gvz, x, z);
      let inv = 1 / (Math.sqrt(v1x * v1x + v1z * v1z) + 1e-9);
      const mx = x + v1x * inv * halfH;
      const mz = z + v1z * inv * halfH;
      const v2x = sampleGrid(gvx, mx, mz);
      const v2z = sampleGrid(gvz, mx, mz);
      inv = 1 / (Math.sqrt(v2x * v2x + v2z * v2z) + 1e-9);
      x += v2x * inv * h;
      z += v2z * inv * h;
      if (s >= skip) {
        trailX[s - skip + 1] = x;
        trailZ[s - skip + 1] = z;
      }
    }

    // Age envelope. Trails grow from nothing at birth and dim away before the
    // reset, so the once-per-cycle jump back to the seed is never visible.
    const life =
      smoothstep(0, FADE_IN_STEPS, age) * smoothstep(0, FADE_OUT_STEPS, c - age);
    if (life <= 0.002) continue;

    const particleBias = bias[i];
    let anyOn = false;

    // --- project, shade and colour every point on the trail ------------------
    for (let j = 0; j <= len; j++) {
      const wx = trailX[j];
      const wz = trailZ[j];
      const wy = sampleGrid(gh, wx, wz);

      const relX = wx - cam.px;
      const relY = wy - cam.py;
      const relZ = wz - cam.pz;
      const depth = relX * cam.fx + relY * cam.fy + relZ * cam.fz;

      ptX[j] = wx;
      ptY[j] = wy;
      ptZ[j] = wz;
      ptDepth[j] = depth;

      if (depth < 1) {
        ptOn[j] = 0;
        ptSigma[j] = sigmaNear;
        ptR[j] = 0;
        ptG[j] = 0;
        ptB[j] = 0;
        ptEnergy[j] = 0;
        continue;
      }

      const viewX = relX;
      const viewY = relY * cam.uy + relZ * cam.uz;
      const ndcX = viewX / depth / cam.tanHalfH;
      const ndcY = viewY / depth / cam.tanHalfV;
      const on = ndcX > -1.2 && ndcX < 1.2 && ndcY > -1.2 && ndcY < 1.2 ? 1 : 0;
      ptOn[j] = on;
      if (on) anyOn = true;

      // Line width: thick at the near edge, hairline in the far field, then
      // widened again by whatever the depth of field says is out of focus.
      const depthT = clamp((depth - NEAR_DEPTH) * invDepthSpan, 0, 1);
      let sigma = sigmaNear + (sigmaFar - sigmaNear) * depthT;
      const defocus =
        depth < FOCUS_DEPTH
          ? clamp((FOCUS_DEPTH - depth) / DOF_NEAR_SPAN, 0, 1)
          : clamp((depth - FOCUS_DEPTH) / DOF_FAR_SPAN, 0, 1);
      const widen = 1 + DOF_MAX_WIDEN * defocus * defocus;
      sigma *= widen;
      // Defocus spreads a line's light, it does not destroy it, so the peak
      // drops by exactly what the width gains.
      let energyScale = 1 / widen;
      if (sigma < sigmaFloor) {
        energyScale *= sigma / sigmaFloor;
        sigma = sigmaFloor;
      }
      ptSigma[j] = sigma;

      // Brightness. The spread from dim to hot is carried by the per-particle
      // bias; the low-frequency ribbon field only modulates it up and down
      // around a solid base, so hot filaments cluster into bands without any
      // part of the frame going flat or blowing out wholesale.
      const ribbon = smoothstep(-0.55, 0.55, sampleGrid(gb, wx, wz));
      const energy = clamp(particleBias * (0.6 + 1.05 * ribbon), 0, 1);
      ptEnergy[j] = energy;

      // Surface orientation: crests turned toward the camera read brighter,
      // which is what makes the relief legible at all.
      const dhx =
        (sampleGrid(gh, wx + GRID_DX, wz) - sampleGrid(gh, wx - GRID_DX, wz)) /
        (2 * GRID_DX);
      const dhz =
        (sampleGrid(gh, wx, wz + GRID_DZ) - sampleGrid(gh, wx, wz - GRID_DZ)) /
        (2 * GRID_DZ);
      const nInv = 1 / Math.sqrt(dhx * dhx + 1 + dhz * dhz);
      const vLen = Math.sqrt(relX * relX + relY * relY + relZ * relZ);
      const facing =
        ((-dhx * -relX + 1 * -relY + -dhz * -relZ) * nInv) / (vLen + 1e-6);
      const shade = 0.55 + 1.3 * clamp(facing, 0, 1);

      const fog = Math.exp(-Math.pow(depth / FOG_DISTANCE, FOG_POWER));

      const u = j / len;
      const taper = smoothstep(0, 0.12, u) * (0.55 + 0.45 * u);

      const intensity =
        (0.5 + 1.3 * Math.pow(energy, 1.6)) *
        fog *
        shade *
        taper *
        life *
        energyScale;

      const lut = (energy * 255) | 0;
      const l3 = lut * 3;
      ptR[j] = rampLut[l3] * intensity;
      ptG[j] = rampLut[l3 + 1] * intensity;
      ptB[j] = rampLut[l3 + 2] * intensity;
    }

    if (!anyOn) continue;

    // --- emit ribbon quads ---------------------------------------------------
    for (let j = 0; j < len; j++) {
      if (!ptOn[j] && !ptOn[j + 1]) continue;
      const da = ptDepth[j];
      const db = ptDepth[j + 1];
      if (da < 1 || db < 1) continue;

      const ax = ptX[j];
      const ay = ptY[j];
      const az = ptZ[j];
      const bx = ptX[j + 1];
      const by = ptY[j + 1];
      const bz = ptZ[j + 1];

      let sx = bx - ax;
      let sy = by - ay;
      let sz = bz - az;
      const sLen = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (sLen < 1e-6) continue;
      sx /= sLen;
      sy /= sLen;
      sz /= sLen;

      // Camera-facing ribbon: perpendicular to both the segment and the line of
      // sight, so the quad always presents its full width to the lens.
      const mx = (ax + bx) * 0.5 - cam.px;
      const my = (ay + by) * 0.5 - cam.py;
      const mz = (az + bz) * 0.5 - cam.pz;
      const mInv = 1 / (Math.sqrt(mx * mx + my * my + mz * mz) + 1e-9);
      const vxn = mx * mInv;
      const vyn = my * mInv;
      const vzn = mz * mInv;

      let px = sy * vzn - sz * vyn;
      let py = sz * vxn - sx * vzn;
      let pz = sx * vyn - sy * vxn;
      const pLen = Math.sqrt(px * px + py * py + pz * pz);
      if (pLen < 1e-4) continue;
      px /= pLen;
      py /= pLen;
      pz /= pLen;

      // Quads are three sigma wide; the Gaussian in the fragment shader does the
      // antialiasing, which is what keeps sub-pixel hairlines smooth.
      const wpA = worldPerPxK * da;
      const wpB = worldPerPxK * db;
      const halfA = ptSigma[j] * 3 * wpA;
      const halfB = ptSigma[j + 1] * 3 * wpB;

      emitRibbon(
        ax, ay, az, bx, by, bz,
        px, py, pz,
        halfA, halfB,
        ptR[j], ptG[j], ptB[j],
        ptR[j + 1], ptG[j + 1], ptB[j + 1],
      );

      const eMax = ptEnergy[j] > ptEnergy[j + 1] ? ptEnergy[j] : ptEnergy[j + 1];
      if (eMax <= BLOOM_THRESHOLD) continue;

      const midDepth = (da + db) * 0.5;
      const worldPerPxMid = worldPerPxK * midDepth;
      const segLenPx = sLen / worldPerPxMid;
      const midX = (ax + bx) * 0.5;
      const midY = (ay + by) * 0.5;
      const midZ = (az + bz) * 0.5;
      const sigmaMid = (ptSigma[j] + ptSigma[j + 1]) * 0.5;
      const rMid = (ptR[j] + ptR[j + 1]) * 0.5;
      const gMid = (ptG[j] + ptG[j + 1]) * 0.5;
      const bMid = (ptB[j] + ptB[j + 1]) * 0.5;

      // Soft bloom on the brightest filaments only. Anything broader than this
      // merges the hairlines into a wash and the structure disappears.
      const bloomSigma = Math.min(sigmaMid * BLOOM_WIDTH_MULT, bloomCap);
      const bloomStride = Math.max(
        1,
        Math.min(GLOW_MAX_STRIDE, Math.round(bloomSigma / Math.max(segLenPx, 0.35))),
      );
      if (j % bloomStride === 0) {
        // Blobs are much wider than a segment, so consecutive ones pile up.
        // Dividing by that overlap keeps the total glow energy where it belongs
        // whether the trail is a few pixels long or a few hundred.
        const norm = clamp(
          (segLenPx * bloomStride) / (2 * bloomSigma),
          0.1,
          1,
        );
        const k = BLOOM_INTENSITY * norm;
        emitBlob(
          midX, midY, midZ,
          px, py, pz,
          sx, sy, sz,
          bloomSigma * 3 * worldPerPxMid,
          rMid * k, gMid * k, bMid * k,
        );
      }

      // A very faint wide glow under the hottest strands, so the frame is not
      // uniformly black between the lines.
      if (eMax > HALO_THRESHOLD) {
        const haloSigma = Math.min(sigmaMid * HALO_WIDTH_MULT, haloCap);
        const haloStride = Math.max(
          1,
          Math.min(GLOW_MAX_STRIDE, Math.round(haloSigma / Math.max(segLenPx, 0.35))),
        );
        if (j % haloStride === 0) {
          const norm = clamp(
            (segLenPx * haloStride) / (2 * haloSigma),
            0.1,
            1,
          );
          const k = HALO_INTENSITY * norm;
          emitBlob(
            midX, midY, midZ,
            px, py, pz,
            sx, sy, sz,
            haloSigma * 3 * worldPerPxMid,
            rMid * k, gMid * k, bMid * k,
          );
        }
      }
    }
  }

  return quads;
};
