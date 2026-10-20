import React from "react";
import { iso, polyPath, type Point3, type Projection, type Vec2 } from "./iso.ts";
import { LOOP } from "./camera.ts";
import { mulberry32 } from "./sim.ts";

// Water is drawn from the frame number only. Every cycle divides the 600-frame
// loop, so frame 600 draws exactly what frame 0 draws.

const G = 981; // cm/s²

/** Assert a period divides the loop (a build-time guard against seams). */
export function loopPeriod(frames: number) {
  if (LOOP % frames !== 0) throw new Error(`period ${frames} does not divide ${LOOP}`);
  return frames;
}

/**
 * Flow dashes along a projected channel path. `start` is how far along a longer
 * path this piece begins (px), so dashes run on unbroken across pieces drawn
 * in different layers.: a dash pattern that slides at a
 * constant speed. `period` frames for one dash spacing; `dash`+`gap` px.
 */
export const FlowDashes: React.FC<{ d: string; frame: number; dash: number; gap: number; period: number; width: number; color: string; opacity?: number; reverse?: boolean; start?: number }> = ({ d, frame, dash, gap, period, width, color, opacity = 1, reverse, start = 0 }) => {
  const p = loopPeriod(period);
  const phase = ((frame % p) / p) * (dash + gap);
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={start + (reverse ? phase : -phase)} opacity={opacity} />;
};

/** A straight polyline path from world points. */
export const worldPath = (P: Projection, pts: Point3[], closed = false) => polyPath(pts.map((p) => iso(p, P)), closed);

/**
 * A falling stream from a spout at world point `top`, falling `drop` cm.
 * Drawn as stacked horizontal ellipses (cross-sections) that move down and
 * speed up as they fall (y = v0·t + ½gt²); by continuity the stream thins as
 * it accelerates. Highlights ride on the lit side.
 */
export const FallingStream: React.FC<{
  P: Projection;
  top: Point3;
  drop: number;
  radius: number;
  v0: number;
  frame: number;
  /** frames between successive cross-sections passing the spout; divides 600 */
  spacing: number;
  /** horizontal drift per cm of fall (a stream leaving a lip moves sideways) */
  drift?: [number, number];
  look: { water: string; waterDeep: string; highlight: string };
  scale: number;
}> = ({ P, top, drop, radius, v0, frame, spacing, drift = [0, 0], look, scale }) => {
  loopPeriod(spacing);
  const fall = (t: number) => v0 * t + 0.5 * G * t * t;
  // time to fall the whole drop
  const tEnd = (-v0 + Math.sqrt(v0 * v0 + 2 * G * drop)) / G;
  const dtSec = spacing / 30;
  const count = Math.ceil(tEnd / dtSec) + 2;
  const phase = (frame % spacing) / spacing;
  const items: { y: number; r: number; t: number }[] = [];
  for (let i = -1; i < count; i++) {
    const t = (i + phase) * dtSec;
    if (t < 0) continue;
    const y = fall(t);
    if (y > drop) break;
    const v = v0 + G * t;
    items.push({ y, r: radius * Math.sqrt(Math.max(v0, 20) / v), t });
  }
  const at = (y: number): Point3 => [top[0] + drift[0] * y, top[1] + drift[1] * y, top[2] - y];
  // body: a smooth column through the cross-sections, then the bead ellipses
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  const steps = 40;
  for (let s = 0; s <= steps; s++) {
    const y = (drop * s) / steps;
    const t = (-v0 + Math.sqrt(v0 * v0 + 2 * G * y)) / G;
    const v = v0 + G * t;
    // small bulges ride down with the cross-sections, stretching as they speed up
    const bulge = 1 + 0.16 * Math.cos(2 * Math.PI * (t / dtSec - phase));
    const r = radius * Math.sqrt(Math.max(v0, 20) / v) * bulge;
    const c = iso(at(y), P);
    const w = r * scale;
    left.push([c[0] - w, c[1]]);
    right.push([c[0] + w, c[1]]);
  }
  const body = polyPath([...left, ...right.reverse()]);
  return (
    <g>
      <path d={body} fill={look.water} opacity={0.88} />
      {items.map((it, i) => {
        const c = iso(at(it.y), P);
        const rx = it.r * scale * 1.12;
        const ry = rx * 0.5;
        return (
          <g key={i}>
            <ellipse cx={c[0]} cy={c[1]} rx={rx} ry={ry} fill={look.waterDeep} opacity={0.55} />
            <ellipse cx={c[0] - rx * 0.35} cy={c[1] - ry * 0.25} rx={rx * 0.32} ry={ry * 0.42} fill={look.highlight} opacity={0.75} />
          </g>
        );
      })}
    </g>
  );
};

/**
 * Ripples on a level surface at world height z around (x, y): rings spawned
 * every `every` frames, expanding at a constant speed and fading. Variety
 * (small offsets and strengths) comes from a module-level seeded PRNG, indexed
 * by ring number modulo the rings per loop, so it repeats exactly each loop.
 */
export function rippleSeeds(seed: number, every: number) {
  const n = LOOP / loopPeriod(every);
  const rand = mulberry32(seed);
  return Array.from({ length: n }, () => ({ dx: (rand() - 0.5) * 1.2, dy: (rand() - 0.5) * 1.2, strength: 0.75 + rand() * 0.25, speed: 0.92 + rand() * 0.16 }));
}

export const Ripples: React.FC<{
  P: Projection;
  centre: Point3;
  frame: number;
  every: number;
  life: number;
  maxRadius: number;
  seeds: { dx: number; dy: number; strength: number; speed: number }[];
  color: string;
  width: number;
  clip?: string;
}> = ({ P, centre, frame, every, life, maxRadius, seeds, color, width, clip }) => {
  const rings: React.ReactNode[] = [];
  const n = seeds.length;
  const newest = Math.floor(frame / every);
  for (let k = newest; k > newest - Math.ceil(life / every) - 1; k--) {
    const age = frame - k * every;
    if (age < 0 || age >= life) continue;
    const seed = seeds[((k % n) + n) % n];
    const t = age / life;
    const r = maxRadius * seed.speed * (1 - Math.pow(1 - t, 1.6));
    const alpha = seed.strength * Math.pow(1 - t, 1.5) * Math.min(1, age / 4);
    const pts: Vec2[] = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      pts.push(iso([centre[0] + seed.dx + r * Math.cos(a), centre[1] + seed.dy + r * Math.sin(a), centre[2]], P));
    }
    rings.push(<path key={k} d={polyPath(pts)} fill="none" stroke={color} strokeWidth={width} opacity={alpha} />);
  }
  return <g clipPath={clip}>{rings}</g>;
};
