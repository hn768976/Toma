/**
 * Per-frame element records — pure maths, no DOM.
 *
 * Kept separate from `draw.ts` so the loop property (frame 360 reproduces
 * frame 0 exactly) can be verified outside a browser. See `loop.test.mjs`.
 */

import {
  BEAT_EXPANSION,
  FIELD_R_MAX,
  FIELD_R_MIN,
  RADIAL_POWER,
  RINGS,
  ROTATION_TURNS,
  TAU,
} from "./constants";
import { PATTERN } from "./field";
import { bucketIndex, sectorField } from "./palette";
import { smoothstep } from "./random";
import { bandIndexAt, beatEnvelope, spectrumAt } from "./spectrum";

export type ElementRecord = {
  /** Sort key: groups blits by colour bucket, then softness tier, then shape. */
  key: number;
  shape: number;
  soft: number;
  bucket: number;
  x: number;
  y: number;
  angle: number;
  w: number;
  h: number;
  alpha: number;
  glow: number;
};

export type FieldOptions = {
  frame: number;
  width: number;
  height: number;
  duration: number;
};

export const buildRecords = ({
  frame,
  width: W,
  height: H,
  duration,
}: FieldOptions): ElementRecord[] => {
  const spec = spectrumAt(frame, duration);
  const pulse = 1 + BEAT_EXPANSION * beatEnvelope(frame);
  const t = frame / duration;
  const rot = TAU * ROTATION_TURNS * t;
  const cx = W / 2;
  const cy = H / 2;
  /** Half-diagonal in frame heights — the reference for element scale. */
  const halfDiagH = Math.hypot(W, H) / 2 / H;

  const recs: ElementRecord[] = [];
  for (let k = 0; k < RINGS; k++) {
    for (let i = 0; i < PATTERN.length; i++) {
      const e = PATTERN[i];
      // Arithmetic recycling: one ring spacing of travel per loop.
      let q = k + e.u + t;
      while (q >= RINGS) {
        q -= RINGS;
      }
      while (q < 0) {
        q += RINGS;
      }
      const qn = q / RINGS;
      const rH =
        FIELD_R_MIN + (FIELD_R_MAX - FIELD_R_MIN) * Math.pow(qn, RADIAL_POWER);
      const r = rH * H * pulse;
      const thetaField = e.theta + e.twist * q;
      const angle = thetaField + rot;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;

      const sizeScale = Math.pow(rH / halfDiagH, 1.35);
      const band = spec[bandIndexAt(thetaField)];
      const twinkle = 0.5 + 0.5 * Math.sin(TAU * (e.twCycles * t + e.twPhase));
      const fadeIn = smoothstep(0, 0.075, qn);
      const radialGain = 0.44 + 0.78 * Math.min(sizeScale, 1.3);
      // Soft knee rather than a hard clamp: without it, most outer elements
      // pin at 1 and the whole field clips to white.
      const drive =
        radialGain *
        (0.3 + 0.85 * band) *
        (0.6 + 0.5 * twinkle) *
        fadeIn *
        e.bright;
      const intensity = 1 - Math.exp(-1.35 * drive);
      if (intensity < 0.02) {
        continue;
      }

      let w: number;
      let h: number;
      if (e.shape === 0) {
        const d =
          H * (0.0019 + 0.033 * sizeScale) * e.lenMul * (0.72 + 0.5 * band);
        w = d;
        h = d;
      } else {
        // Outer elements stretch radially — the streak that reads as speed.
        const streak = 1 + 0.3 * Math.max(0, sizeScale - 0.6);
        w =
          H *
          (0.007 + 0.175 * sizeScale) *
          e.lenMul *
          streak *
          (0.7 + 0.55 * band);
        h = w * 0.24 * e.thickMul;
      }

      const m = Math.max(w, h);
      if (x < -m || x > W + m || y < -m || y > H + m) {
        continue;
      }

      const soft = rH < 0.42 ? 0 : rH < 0.78 ? 1 : 2;
      const family = sectorField(thetaField) > e.colorRand ? 0 : 1;
      const bucket = bucketIndex(family, intensity);

      recs.push({
        key: bucket * 16 + soft * 4 + e.shape,
        shape: e.shape,
        soft,
        bucket,
        x,
        y,
        angle,
        w,
        h,
        alpha: 0.2 + 0.8 * intensity,
        glow:
          e.glow > 0 && intensity > 0.42 && sizeScale > 0.3
            ? e.glow * intensity * 0.22
            : 0,
      });
    }
  }
  recs.sort((a, b) => a.key - b.key);
  return recs;
};
