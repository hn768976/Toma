import React, { useLayoutEffect } from "react";
import { GLOW_SCALE } from "./surfaces";
import { cameraDrift, loopPhase } from "./constants";
import { withAlpha } from "../lib/color";
import type { JetSprite } from "./JetShape";
import type { Variant } from "./variants";

/**
 * Places the aircraft in the frame and moves it. Position, bank and scale are
 * all pure functions of the frame, and the sprite is blitted rather than
 * redrawn.
 *
 * The jet flies IN FRONT of the HUD plane, frontally and untilted. That
 * separation is the whole point of the piece: share the plane's transform and
 * the aircraft becomes a decal on an interface instead of an object above one.
 * It is also the only layer exempt from depth of field — it is the subject.
 */

/**
 * Travel is expressed in signed screen-x. `flightDir` decides which end is
 * the entry, so nothing here hardcodes left-to-right.
 */
const X_START = -1000;
const X_END = 4850;

/** Quadratic through (0, low) - (0.5, high) - (1, slightly lower). */
const arcY = (u: number) => 2160 * u * u - 2540 * u + 1560;
const arcSlope = (u: number) => 4320 * u - 2540;

const BASE_SCALE = 1.2;
const CONTRAIL_LEN = 820;

export type JetTransform = {
  x: number;
  y: number;
  rotDeg: number;
  scale: number;
  mirror: number;
  alpha: number;
  /** Separate fade for the contrail — see `contrailAlpha`. */
  trailAlpha: number;
  u: number;
};

export const jetTransform = (variant: Variant, frame: number): JetTransform => {
  const u = loopPhase(frame);
  const span = X_END - X_START;
  // Signed travel: +1 enters lower-left, -1 enters upper-right.
  const x = variant.flightDir === 1 ? X_START + span * u : X_END - span * u;
  const y = arcY(u);
  const sn = Math.max(-1, Math.min(1, arcSlope(u) / 2540));
  // Bank into the arc. The sign follows flightDir so that mirroring the
  // aircraft inverts the bank with it and the nose keeps leading.
  const rotDeg = variant.flightDir * 6 * sn;
  const centred = 2 * u - 1;
  const scale = BASE_SCALE * (1 - 0.12 * centred * centred);
  // Insurance for the loop: the aircraft is already entirely off-canvas
  // outside this window, so zeroing it there is invisible and guarantees
  // frame 0 and frame 390 are identical.
  const alpha = u < 0.03 || u > 0.97 ? 0 : 1;
  // The contrail trails behind the aircraft, so at the exit end it is still
  // in frame after the airframe has left. Fading it out across a window that
  // starts once the body is fully off-canvas is what lets the traverse be
  // this tight — otherwise the exit margin has to clear the trail too, and
  // the jet spends a needless extra second offstage at both ends.
  const trailAlpha = Math.max(0, Math.min(1, (0.96 - u) / 0.06));
  return {
    x,
    y,
    rotDeg,
    scale,
    mirror: variant.flightDir,
    alpha,
    trailAlpha,
    u,
  };
};

export const FlightPath: React.FC<{
  variant: Variant;
  frame: number;
  sprite: JetSprite;
  target: React.RefObject<HTMLCanvasElement | null>;
  glow: HTMLCanvasElement;
}> = ({ variant, frame, sprite, target, glow }) => {
  useLayoutEffect(() => {
    const main = target.current?.getContext("2d");
    const glowCtx = glow.getContext("2d");
    if (!main || !glowCtx) return;
    const p = variant.palette;
    const t = jetTransform(variant, frame);
    if (t.alpha <= 0) return;

    const cam = cameraDrift(frame);
    const cx = t.x + cam.x;
    const cy = t.y + cam.y;
    const { geo } = sprite;

    const local = new DOMMatrix()
      .translate(cx, cy)
      .rotate(t.rotDeg)
      .scale(t.scale * t.mirror, t.scale);
    const dirOnly = new DOMMatrix()
      .rotate(t.rotDeg)
      .scale(t.scale * t.mirror, t.scale);

    const engine = new DOMPoint(
      geo.enginePos.x - geo.pivot.x,
      geo.enginePos.y - geo.pivot.y,
    ).matrixTransform(local);
    const aft = new DOMPoint(geo.aftDir.x, geo.aftDir.y).matrixTransform(
      dirOnly,
    );
    const aftLen = Math.hypot(aft.x, aft.y) || 1;
    const ax = aft.x / aftLen;
    const ay = aft.y / aftLen;
    const nx = -ay;
    const ny = ax;

    // ── Contrail: a soft tapering wedge, wider and dimmer with distance ──
    const len = CONTRAIL_LEN * t.scale;
    const w0 = 26 * t.scale;
    const w1 = 165 * t.scale;
    const tipX = engine.x + ax * len;
    const tipY = engine.y + ay * len;
    const grad = main.createLinearGradient(engine.x, engine.y, tipX, tipY);
    grad.addColorStop(0, withAlpha(p.textPale, 0.46 * t.trailAlpha));
    grad.addColorStop(0.3, withAlpha(p.textPale, 0.24 * t.trailAlpha));
    grad.addColorStop(1, withAlpha(p.textPale, 0));
    main.save();
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.filter = `blur(${Math.round(22 * t.scale)}px)`;
    main.fillStyle = grad;
    main.beginPath();
    main.moveTo(engine.x + nx * w0, engine.y + ny * w0);
    main.lineTo(tipX + nx * w1, tipY + ny * w1);
    main.lineTo(tipX - nx * w1, tipY - ny * w1);
    main.lineTo(engine.x - nx * w0, engine.y - ny * w0);
    main.closePath();
    main.fill();
    main.filter = "none";

    // ── Engine glow: a small warm bloom that pulses slightly ──
    // 3 pulses per loop, so it closes at frame 390.
    const pulse = 1 + 0.14 * Math.sin(loopPhase(frame) * Math.PI * 6);
    const r = 210 * t.scale * pulse;
    const bloom = main.createRadialGradient(
      engine.x,
      engine.y,
      0,
      engine.x,
      engine.y,
      r,
    );
    bloom.addColorStop(0, withAlpha(p.engineGlow, 0.95));
    bloom.addColorStop(0.28, withAlpha(p.engineGlow, 0.42));
    bloom.addColorStop(1, withAlpha(p.engineGlow, 0));
    main.globalCompositeOperation = "lighter";
    main.fillStyle = bloom;
    main.beginPath();
    main.arc(engine.x, engine.y, r, 0, Math.PI * 2);
    main.fill();
    main.globalCompositeOperation = "source-over";

    // The exhaust is the piece's brightest source, so it also feeds the bloom
    // pass. The airframe itself never does — it is a solid object.
    glowCtx.save();
    glowCtx.setTransform(GLOW_SCALE, 0, 0, GLOW_SCALE, 0, 0);
    const gb = glowCtx.createRadialGradient(
      engine.x,
      engine.y,
      0,
      engine.x,
      engine.y,
      r,
    );
    gb.addColorStop(0, withAlpha(p.engineGlow, 0.9));
    gb.addColorStop(0.4, withAlpha(p.engineGlow, 0.35));
    gb.addColorStop(1, withAlpha(p.engineGlow, 0));
    glowCtx.fillStyle = gb;
    glowCtx.beginPath();
    glowCtx.arc(engine.x, engine.y, r, 0, Math.PI * 2);
    glowCtx.fill();
    glowCtx.restore();

    // ── The aircraft itself ──
    main.setTransform(local);
    main.drawImage(sprite.canvas, -geo.pivot.x, -geo.pivot.y);
    main.restore();
  });

  return null;
};
