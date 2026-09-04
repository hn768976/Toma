import { useMemo } from "react";
import { cellUv } from "../lib/atlas";
import { hexToRgb } from "../lib/color";
import { CORE, PARTICLES, PULSES } from "./layout";
import { allocSprites, InstancedSprites, SpriteWriter } from "./InstancedSprites";
import type { Palette } from "../palettes";

/**
 * Core, haze, particles and the travelling lights that ride the board — one
 * instanced draw call for the whole atmosphere.
 *
 * The core is a stack of additive glow sprites of decreasing size: the inner
 * one is driven far past 1.0 so it clips to white, and the outer ones supply
 * the long falloff. That is the bloom, applied only where it belongs; a global
 * bloom pass at this brightness would swallow the circuit routing.
 */
const CORE_LAYERS = [
  { size: 17.0, gain: 0.11 },
  { size: 9.0, gain: 0.25 },
  { size: 4.6, gain: 0.46 },
  { size: 2.2, gain: 0.95 },
  { size: 1.05, gain: 1.9 },
  { size: 0.44, gain: 3.8 },
];

const HAZE_LAYERS = [
  { size: 22, y: 1.6, gain: 0.045 },
  { size: 13, y: 3.2, gain: 0.05 },
  { size: 9, y: 0.9, gain: 0.06 },
];

export const Atmosphere: React.FC<{
  palette: Palette;
  /** Seconds elapsed — used only through pure, frame-derived expressions. */
  seconds: number;
  coreIntensity: number;
  hazeAlpha: number;
  particleAlpha: number;
  pulseAlpha: number;
}> = ({ palette, seconds, coreIntensity, hazeAlpha, particleAlpha, pulseAlpha }) => {
  const capacity = CORE_LAYERS.length + HAZE_LAYERS.length + PARTICLES.length + PULSES.length;
  const buffers = useMemo(() => allocSprites(capacity), [capacity]);

  const core = hexToRgb(palette.core);
  const particle = hexToRgb(palette.particle);
  const trace = hexToRgb(palette.trace);
  const glowUv = cellUv("glow");
  const dotUv = cellUv("dot");

  const writer = new SpriteWriter(buffers);

  // Core. A slow flicker keeps it alive without reading as a strobe.
  const flicker = 0.94 + 0.06 * Math.sin(seconds * 2.1) + 0.03 * Math.sin(seconds * 5.7);
  for (const layer of CORE_LAYERS) {
    writer.push(
      CORE.x,
      CORE.y,
      CORE.z,
      layer.size,
      glowUv,
      [core.r, core.g, core.b],
      layer.gain * coreIntensity * flicker,
    );
  }

  // Volumetric haze sitting in the projection cone.
  for (const layer of HAZE_LAYERS) {
    writer.push(
      CORE.x,
      layer.y,
      CORE.z,
      layer.size,
      glowUv,
      [core.r * 0.8, core.g * 0.86, core.b],
      layer.gain * hazeAlpha,
    );
  }

  // Atmosphere particles: a slow vertical drift plus a per-particle twinkle.
  for (const p of PARTICLES) {
    const y = p.y + Math.sin(seconds * 0.16 * p.drift + p.phase) * 0.55;
    const tw = 0.55 + 0.45 * Math.sin(seconds * p.twinkle * 0.9 + p.phase * 3.1);
    const near = 1 / (1 + Math.hypot(p.x, p.z) * 0.055);
    writer.push(
      p.x,
      y,
      p.z,
      p.size,
      dotUv,
      [particle.r, particle.g, particle.b],
      p.alpha * tw * near * particleAlpha,
    );
  }

  // Travelling lights riding the board, outside the platform.
  for (const p of PULSES) {
    const a = p.angle + seconds * p.speed * Math.PI * 2;
    const x = Math.cos(a) * p.radius;
    const z = Math.sin(a) * p.radius;
    const beat = 0.45 + 0.55 * Math.sin(seconds * 1.4 + p.phase);
    const falloff = 1 - Math.min(1, p.radius / 42);
    writer.push(
      x,
      0.05,
      z,
      p.size,
      glowUv,
      [trace.r * 1.6, trace.g * 1.7, trace.b * 1.9],
      beat * falloff * pulseAlpha * 0.9,
    );
  }

  writer.done();

  return <InstancedSprites buffers={buffers} capacity={capacity} renderOrder={5} />;
};
